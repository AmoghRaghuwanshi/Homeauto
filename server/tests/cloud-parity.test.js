const test = require("node:test"),
  assert = require("node:assert/strict"),
  http = require("node:http"),
  crypto = require("node:crypto");
const { onlineFixture } = require("./helpers/online-fixture");
const { createOnlineApp } = require("../online/app");
const { createRepository } = require("../db/repository");
const { Home } = require("../services/home");
const { Assistant } = require("../services/assistant");
const { Sessions } = require("../auth/sessions");
const { BrowserSpeechService } = require("../voice/browser-speech-service");
const { createApp } = require("../app");
const { createGatewayWorker } = require("../online/gateway");
const { createHubHandler } = require("../online/hub-handler");
test("cloud voice and encrypted owner management reach the local handlers with session and replay protection", async (t) => {
  const db = await onlineFixture();
  t.after(() => db.close());
  const config = {
    secure: false,
    origins: new Set(),
    allowCommands: true,
    hubRelayKey: "c".repeat(64),
  };
  const cloud = createOnlineApp({
      pool: db.pool,
      config,
      logger: { info() {} },
    }),
    cloudServer = http.createServer(cloud);
  await new Promise((r) => cloudServer.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + cloudServer.address().port;
  config.origins.add(url);
  t.after(async () => {
    cloudServer.closeAllConnections();
    await new Promise((r) => cloudServer.close(r));
  });
  const gatewayConfig = {
    householdId: db.household,
    gatewayId: db.gateway,
    token: db.token,
    origin: "https://cloud.invalid",
    allowLights: true,
  };
  const repo = await createRepository({ gateway: gatewayConfig });
  t.after(() => repo.close());
  const home = new Home(repo, { simulation: true });
  home.setConnected(true);
  home.ingest("home/esp32/lights/online", Buffer.from("true"));
  for (let i = 1; i <= 4; i++)
    home.ingest(`home/light/${i}/status`, Buffer.from("off"));
  const sessions = new Sessions(repo, {
      secure: false,
      gateway: gatewayConfig,
    }),
    assistant = new Assistant(home),
    speech = new BrowserSpeechService(home, assistant);
  const local = createApp({
      repo,
      home,
      sessions,
      assistant,
      speech,
      modules: {
        status: () => ({
          hardware_ready: true,
          mqtt: { connected: true },
          boards: [],
          camera: { configured: false },
          sensors: [],
        }),
      },
    }),
    localServer = http.createServer(local);
  await new Promise((r) => localServer.listen(0, "127.0.0.1", r));
  t.after(async () => {
    localServer.closeAllConnections();
    await new Promise((r) => localServer.close(r));
  });
  const fetchImpl = (target, options) =>
    fetch(url + new URL(target).pathname, options);
  const worker = createGatewayWorker(home, gatewayConfig, { fetchImpl });
  t.after(() => worker.stop());
  await worker.runOnce();
  const auth = cloud.locals.auth,
    login = await auth.login("cloud-owner", db.password, "parity");
  let actor = login.session,
    token = login.token;
  const call = async (path, method = "GET", body) => {
    const response = await fetch(url + path, {
      method,
      headers: {
        Origin: url,
        Cookie: auth.cookieName + "=" + token,
        "Content-Type": "application/json",
        "X-CSRF-Token": actor.csrf_token,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json(),
    };
  };
  const gateway = async (path, body = {}) => {
    const response = await fetch(url + "/api/gateway/hub-requests/" + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + db.token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  await t.test(
    "same voice readiness, Hindi dialogue, signed-in speech and HTTP microphone policy",
    async () => {
      const snapshot = await call("/api/snapshot");
      assert.equal(snapshot.body.speech.provider, "browser");
      assert.equal(snapshot.body.speech.stt_ready, true);
      assert.equal(snapshot.body.capabilities.metadata_edit, true);
      const ticket = await call("/api/assistant/voice-tickets", "POST", {});
      assert.equal(ticket.body.transport, "http");
      assert.match(
        ticket.headers.get("permissions-policy"),
        /microphone=\(self\)/,
      );
      const parsed = await call("/api/assistant/interpret", "POST", {
        text: "नमस्ते",
        language: "hi",
      });
      assert.equal(parsed.status, 200);
      assert.equal(parsed.body.intent.kind, "conversation");
      const answer = await call("/api/assistant/execute", "POST", {
        intent_id: parsed.body.intent_id,
        idempotency_key: crypto.randomUUID(),
      });
      assert.match(answer.body.answer.text, /नमस्ते/);
      const spoken = await call("/api/assistant/speech", "POST", {
        result_id: answer.body.answer.result_id,
        language: "hi",
      });
      assert.equal(spoken.body.provider, "browser");
      assert.match(spoken.body.text, /नमस्ते/);
      const wake = await call("/api/assistant/interpret", "POST", {
        text: "light one status",
        wake_required: true,
      });
      assert.equal(wake.body.error.code, "WAKE_PHRASE_REQUIRED");
    },
  );
  const relay = cloud.locals.hubRelay,
    gate = { household_id: db.household, gateway_id: db.gateway };
  const process = async (id) => {
    const claim = await gateway("claim");
    assert.ok(claim.body.tasks.some((r) => r.id === id));
    const redeem = await gateway(id + "/redeem");
    assert.equal(redeem.status, 200);
    const task = redeem.body;
    task.expires = Date.now() + task.ttl_ms;
    if (task.actor.reauth_age_ms !== null)
      task.actor.reauth_at = new Date(
        Date.now() - task.actor.reauth_age_ms,
      ).toISOString();
    const handler = createHubHandler({
      sessions,
      config: {},
      getServer: () => localServer,
    });
    const result = await handler(task);
    assert.equal((await gateway(id + "/result", result)).status, 200);
    return result;
  };
  await t.test(
    "home metadata and module diagnostics execute on the paired hub, never a cloud copy",
    async () => {
      const before = home.homeSettings();
      const queued = await call("/api/settings/home", "PUT", {
        home_name: "Cloud-managed home",
        version: before.version,
      });
      assert.equal(queued.status, 202);
      const result = await process(queued.body.hub_request);
      assert.equal(result.status, 200);
      assert.equal(home.homeSettings().home_name, "Cloud-managed home");
      const response = await call(
        "/api/hub-requests/" + queued.body.hub_request,
      );
      assert.equal(
        response.body.hub_result.body.home_name,
        "Cloud-managed home",
      );
      assert.equal(
        (await gateway(queued.body.hub_request + "/redeem")).status,
        409,
      );
      const modules = await call("/api/modules");
      assert.equal(
        (await process(modules.body.hub_request)).body.hardware_ready,
        true,
      );
      assert.equal(repo.one("SELECT count(*) n FROM sessions").n, 0);
    },
  );
  await t.test(
    "sensitive requests are encrypted, hidden from activity, and revoked sessions cannot execute",
    async () => {
      const denied = await call("/api/door/pin", "PUT", { pin: "872616" });
      assert.equal(denied.body.error.code, "REAUTH_REQUIRED");
      const refreshed = await auth.reauth(actor, token, db.password);
      actor = refreshed.session;
      token = refreshed.token;
      const card = await call('/api/logs/rfid-cards','POST',{uid:'AA:BB:CC:DD',owner_name:'Parity fixture',is_authorized:true});
      assert.equal((await process(card.body.hub_request)).status,201);
      assert.equal(repo.one("SELECT owner_name FROM rfid_cards WHERE uid='AA:BB:CC:DD'").owner_name,'Parity fixture');
      const queued = await call("/api/door/pin", "PUT", { pin: "872616" });
      assert.equal(queued.status, 202);
      const raw = await relay.result(actor, queued.body.hub_request);
      assert.equal(raw.hub_request, queued.body.hub_request);
      const events = await cloud.locals.store.events(actor);
      assert.ok(
        events.items.every((e) => !e.event_type.startsWith("_hub_rpc_")),
      );
      const stored = await cloud.locals.store.tx(actor, (c) =>
        c.query(
          "SELECT payload FROM homeauto_online.events WHERE event_id=$1",
          [queued.body.hub_request],
        ),
      );
      assert.doesNotMatch(JSON.stringify(stored.rows), /872616/);
      const viewer = await auth.login("cloud-viewer", db.password, "viewer");
      await assert.rejects(
        relay.enqueue(viewer.session, "GET", "/api/modules", {}),
        { code: "FORBIDDEN" },
      );
      await gateway("claim");
      await auth.logout(token);
      const revoked = await gateway(queued.body.hub_request + "/redeem");
      assert.equal(revoked.body.error.code, "AUTHORIZATION_REVOKED");
      const other = await auth.login("other-owner", db.password, "other");
      await assert.rejects(
        relay.result(other.session, queued.body.hub_request),
        { code: "HUB_REQUEST_EXPIRED" },
      );
    },
  );
});
