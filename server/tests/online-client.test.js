const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { restoreRoute, normalizePlatformBody } = require("../../api/index");
const {
  stagingTarget,
  main: nativeStaging,
} = require("../scripts/online-staging-check");

test("native online staging guard refuses unapproved, mismatched or privileged targets before connecting", async () => {
  let connections = 0;
  const poolFactory = () => {
    connections++;
    throw new Error("must not connect");
  };
  await assert.rejects(nativeStaging([], {}, { poolFactory }));
  const env = {
    HOMEAUTO_ONLINE_STAGING_APPROVED: "1",
    HOMEAUTO_EXPECTED_DATABASE: "synthetic",
    HOMEAUTO_EXPECTED_STAGING_HOST: "branch.invalid",
    DATABASE_URL_UNPOOLED: "postgresql://operator@branch.invalid/synthetic",
    DATABASE_URL: "postgresql://runtime@branch-pooler.invalid/synthetic",
  };
  assert.equal(stagingTarget(["--apply"], env).runtime, env.DATABASE_URL);
  for (const changed of [
    { HOMEAUTO_EXPECTED_STAGING_HOST: "other.invalid" },
    { DATABASE_URL: "postgresql://operator@branch-pooler.invalid/synthetic" },
    {
      DATABASE_URL_UNPOOLED:
        "postgresql://operator@branch-pooler.invalid/synthetic",
    },
    { HOMEAUTO_EXPECTED_DATABASE: "wrong" },
  ])
    await assert.rejects(
      nativeStaging(["--apply"], { ...env, ...changed }, { poolFactory }),
    );
  assert.equal(connections, 0);
});
const loadClient = (filename) =>
  import(
    "data:text/javascript;base64," +
      fs
        .readFileSync(path.join(__dirname, "../../public/js", filename))
        .toString("base64")
  );

test("cloud snapshots reject old events, old gateway sequences and stale preferences", async () => {
  const { acceptCloudOrder } = await loadClient("cloud-state.js");
  const before = {
    server_epoch: "cloud:house",
    cloud_cursor: "9007199254740993",
    gateway_sequence: 20,
    server_time: "2026-11-07T00:00:02Z",
    session: { id: "user" },
    preferences: { version: 3 },
  };
  assert.equal(
    acceptCloudOrder({ ...before, cloud_cursor: "9007199254740992" }, before),
    false,
  );
  assert.equal(
    acceptCloudOrder({ ...before, gateway_sequence: 19 }, before),
    false,
  );
  assert.equal(
    acceptCloudOrder(
      { ...before, server_time: "2026-11-07T00:00:01Z" },
      before,
    ),
    false,
  );
  const after = {
    ...before,
    preferences: { version: 2 },
    server_time: "2026-11-07T00:00:03Z",
  };
  assert.equal(acceptCloudOrder(after, before), true);
  assert.equal(after.preferences.version, 3);
  assert.equal(
    acceptCloudOrder(
      {
        ...before,
        server_epoch: "cloud:other",
        cloud_cursor: "0",
        gateway_sequence: 0,
      },
      before,
    ),
    true,
  );
});

test("browser freshness fails closed for stale, retained, disconnected and future reports", async () => {
  const { reportCurrent, cloudGatewayCurrent } =
    await loadClient("cloud-state.js");
  const now = Date.now(),
    at = (ms) => new Date(now - ms).toISOString();
  const device = {
    id: "light-1",
    board_id: "lights",
    connectivity: "online",
    observation: {
      freshness: "current",
      retained: false,
      received_at: at(1000),
    },
  };
  const state = {
    connected: true,
    serverOffset: 0,
    snapshot: {
      gateway: { connected: true, last_seen_at: at(1000) },
      espBoards: { lights: { online: true, lastSeen: at(1000) } },
    },
  };
  assert.equal(reportCurrent(state, device, true), true);
  for (const change of [
    { received_at: at(66000) },
    { received_at: at(-60000) },
    { retained: true },
    { freshness: "stale" },
  ])
    assert.equal(
      reportCurrent(
        state,
        { ...device, observation: { ...device.observation, ...change } },
        true,
      ),
      false,
    );
  assert.equal(
    reportCurrent(
      state,
      {
        ...device,
        id: "sensor-gas",
        observation: { ...device.observation, received_at: at(11000) },
      },
      true,
    ),
    false,
  );
  state.snapshot.gateway.last_seen_at = at(16000);
  assert.equal(cloudGatewayCurrent(state), false);
  assert.equal(reportCurrent(state, device, true), false);
  assert.equal(reportCurrent(state, device, false), true);
  state.connected = false;
  assert.equal(reportCurrent(state, device, false), false);
});

test("late authentication failures cannot log out a newly rotated browser session", async () => {
  const { Api } = await loadClient("api.js");
  const originalFetch = global.fetch,
    originalWindow = global.window;
  const events = [];
  global.window = { dispatchEvent: (event) => events.push(event.type) };
  try {
    let finish;
    global.fetch = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const old = Api.request("/api/snapshot");
    Api.sessionVersion++;
    Api.csrf = "new-session";
    finish(
      new Response(JSON.stringify({ error: { code: "LOGIN_REQUIRED" } }), {
        status: 401,
      }),
    );
    await assert.rejects(old);
    assert.deepEqual(events, []);
    global.fetch = async () =>
      new Response(JSON.stringify({ error: { code: "LOGIN_REQUIRED" } }), {
        status: 401,
      });
    await assert.rejects(Api.request("/api/snapshot"));
    assert.deepEqual(events, ["session-expired"]);
  } finally {
    global.fetch = originalFetch;
    global.window = originalWindow;
  }
});

test('API transport preserves upstream errors and never retries an uncertain signup', async () => {
  const original = global.fetch; const { Api } = await loadClient('api.js'); let calls = 0;
  try {
    global.fetch = async () => { calls++; return new Response('<html>Upstream unavailable</html>', { status: 503, headers: { 'x-request-id': 'synthetic-trace' } }); };
    await assert.rejects(Api.request('/api/auth/signup', { method: 'POST', body: {} }), { code: 'RESPONSE_UNAVAILABLE', status: 503, request_id: 'synthetic-trace', retryable: true }); assert.equal(calls, 1);
    global.fetch = async () => new Response('null', { status: 201 });
    await assert.rejects(Api.request('/api/auth/signup', { method: 'POST', body: {} }), { code: 'RESPONSE_UNAVAILABLE', status: 201 });
    global.fetch = async () => { throw new DOMException('Aborted', 'AbortError'); };
    await assert.rejects(Api.request('/api/auth/signup', { method: 'POST', body: {} }), { code: 'CONNECTION_LOST' });
  } finally { global.fetch = original; }
});

test('API caller cancellation and the request deadline both cancel the actual fetch', async () => {
  const original = global.fetch; const { Api } = await loadClient('api.js');
  try {
    let usedSignal;
    global.fetch = (path, { signal }) => { usedSignal = signal; return new Promise((resolve, reject) => { const abort = () => reject(new DOMException('Aborted', 'AbortError')); if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); }); };
    const caller = new AbortController(); const pending = Api.request('/api/auth/session', { signal: caller.signal }); caller.abort();
    await assert.rejects(pending, { code: 'CONNECTION_LOST' }); assert.equal(usedSignal.aborted, true);
    const second = new AbortController();
    await assert.rejects(Api.request('/api/auth/session', { signal: second.signal, timeoutMs: 1000 }), { code: 'CONNECTION_LOST' });
    assert.equal(usedSignal.aborted, true); assert.equal(second.signal.aborted, false);
  } finally { global.fetch = original; }
});

test("Vercel route restoration preserves filters and rejects malformed internal paths", () => {
  const req = {
    url: "/api/index?__route=security/activity&limit=30&category=lights",
  };
  restoreRoute(req);
  assert.equal(req.url, "/api/security/activity?limit=30&category=lights");
  assert.throws(() => restoreRoute({ url: "/api/index?__route=../private" }), {
    code: "NOT_FOUND",
  });
  assert.throws(() => restoreRoute({ url: "/api/index?__route=%2F%3Fbad" }), {
    code: "NOT_FOUND",
  });
});

test("platform-consumed JSON reaches Express without a second stream read", async () => {
  const express = require("express"),
    app = express();
  app.use(async (req, res, next) => {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      req.body = Buffer.concat(chunks).toString();
      normalizePlatformBody(req);
      next();
    } catch (error) {
      res.statusCode = error.status || 500;
      res.end(error.code);
    }
  });
  app.use(express.json());
  app.post("/api/test", (req, res) => res.json(req.body));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const url = "http://127.0.0.1:" + server.address().port + "/api/test";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"action":"on"}',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { action: "on" });
    const invalid = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "null",
    });
    assert.equal(invalid.status, 400);
    const tooBig = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: "x".repeat(65536) }),
    });
    assert.equal(tooBig.status, 413);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("all cloud and Hindi assistant suggestions use the bounded existing intent grammar", () => {
  const { resolveCommand } = require("../voice/intent"),
    { devices } = require("../lib/registry");
  for (const text of [
    "Light 1 status",
    "Gas sensor status",
    "Motion sensor status",
    "Door status",
    "लाइट 1 की स्थिति",
    "गैस की स्थिति",
    "मोशन की स्थिति",
    "दरवाजा की स्थिति",
    "गैस की स्थिति क्या है",
  ])
    assert.equal(resolveCommand(text, devices, []).ok, true, text);
});
