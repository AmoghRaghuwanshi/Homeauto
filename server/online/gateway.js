const crypto = require("crypto");
const { performance } = require("perf_hooks");
const { byId } = require("../lib/registry");
const { uuid } = require("../lib/errors");
const { projectCatalog } = require("../cloud/protocol");
const { canonical, hash, validateExchange } = require("./protocol");
const { endpoint } = require("../cloud/config");
function loadGatewayConfig(env = process.env) {
  if (env.HOMEAUTO_GATEWAY_ENABLED !== "1") return null;
  if (
    env.HOMEAUTO_GATEWAY_CONSENT !== "telemetry-v1" ||
    !uuid(env.HOMEAUTO_HOUSEHOLD_ID) ||
    !uuid(env.HOMEAUTO_GATEWAY_ID) ||
    !/^[a-f0-9]{64}$/.test(env.HOMEAUTO_GATEWAY_TOKEN || "")
  )
    throw new Error(
      "Gateway needs telemetry-v1 consent, UUID identities and a private gateway token.",
    );
  if (
    [env.HOMEAUTO_HOUSEHOLD_ID, env.HOMEAUTO_GATEWAY_ID].some(
      (id) => id !== id.toLowerCase(),
    )
  )
    throw new Error("Gateway UUIDs must be lowercase.");
  if (env.HOMEAUTO_DOOR_ENABLED === "1")
    throw new Error("Keep the physical door gate off during gateway rollout.");
  if (env.HOMEAUTO_CLOUD_SYNC_ENABLED === "1")
    throw new Error(
      "Select one cloud transport; disable the legacy catalog mirror before gateway enrollment.",
    );
  const allowLights = env.HOMEAUTO_REMOTE_LIGHTS_ENABLED === "1";
  if (
    allowLights &&
    (env.HOMEAUTO_SECURE_GATEWAY_APPROVED !== "1" ||
      env.HOMEAUTO_MQTT_ENABLED !== "1" ||
      !env.HOMEAUTO_MQTT_BROKER?.startsWith("mqtts://") ||
      !env.HOMEAUTO_MQTT_USERNAME ||
      !env.HOMEAUTO_MQTT_PASSWORD)
  )
    throw new Error(
      "Remote lighting requires separately validated secure gateway and broker configuration.",
    );
  return {
    householdId: env.HOMEAUTO_HOUSEHOLD_ID,
    gatewayId: env.HOMEAUTO_GATEWAY_ID,
    token: env.HOMEAUTO_GATEWAY_TOKEN,
    origin: endpoint(env.HOMEAUTO_GATEWAY_ORIGIN),
    allowLights,
  };
}
function initializeGatewayJournal(tx, config) {
  tx.run(`CREATE TABLE IF NOT EXISTS online_gateway_state(singleton INTEGER PRIMARY KEY CHECK(singleton=1),schema_version INTEGER NOT NULL DEFAULT 1,household_id TEXT NOT NULL,gateway_id TEXT NOT NULL,key_fingerprint TEXT NOT NULL,sequence INTEGER NOT NULL DEFAULT 0,last_ack_at INTEGER,last_error TEXT,blocked INTEGER NOT NULL DEFAULT 0);
 CREATE TABLE IF NOT EXISTS online_gateway_outbox(event_id TEXT PRIMARY KEY,sequence INTEGER NOT NULL,body_json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS online_gateway_commands(command_id TEXT PRIMARY KEY,lease_id TEXT NOT NULL,device_id TEXT NOT NULL,action TEXT NOT NULL,local_command_id TEXT,state TEXT NOT NULL,error_code TEXT,ack_state TEXT,created_at INTEGER NOT NULL);`);
  const fingerprint = crypto
    .createHash("sha256")
    .update(config.token)
    .digest("hex");
  tx.run(
    "INSERT OR IGNORE INTO online_gateway_state(singleton,household_id,gateway_id,key_fingerprint) VALUES(1,?,?,?)",
    [config.householdId, config.gatewayId, fingerprint],
  );
  const row = tx.one("SELECT * FROM online_gateway_state WHERE singleton=1");
  if (
    row.schema_version !== 1 ||
    row.household_id !== config.householdId ||
    row.gateway_id !== config.gatewayId
  )
    throw new Error(
      "Gateway identity mismatch; disable sync and reconcile the restored journal.",
    );
  if (row.key_fingerprint !== fingerprint)
    tx.run(
      "UPDATE online_gateway_state SET key_fingerprint=?,blocked=0,last_error=NULL WHERE singleton=1",
      [fingerprint],
    );
  tx.run(
    "UPDATE online_gateway_commands SET state='uncertain',error_code='GATEWAY_RESTARTED' WHERE state='claimed'",
  );
}
function gatewayStatus(repo, enabled, now = Date.now()) {
  if (!enabled) return { enabled: false, state: "disabled" };
  const row = repo.one(
    "SELECT last_ack_at,last_error,blocked,sequence FROM online_gateway_state WHERE singleton=1",
  );
  return {
    enabled: true,
    state: row.blocked
      ? "blocked"
      : row.last_error
        ? "retrying"
        : !row.last_ack_at
          ? "connecting"
          : now - row.last_ack_at > 15000
            ? "stale"
            : "connected",
    last_ack_at: row.last_ack_at,
    last_error: row.last_error,
    sequence: row.sequence,
    pending_results: repo.one(
      "SELECT count(*) n FROM online_gateway_commands WHERE ack_state IS NULL OR ack_state<>state",
    ).n,
  };
}
function buildExchange(home, config, ticket) {
  const repo = home.repo,
    now = home.now();
  home.expire();
  const devices = Object.keys(byId)
    .sort()
    .map((id) => {
      const d = home.device(id),
        age =
          d.observation.received_at === null
            ? null
            : now - Date.parse(d.observation.received_at);
      const validAge = Number.isFinite(age) && age >= 0 && age <= 86400000;
      let payload = null;
      if (id === "sensor-gas" && d.latest)
        payload = {
          raw: d.latest.raw,
          gas_ppm: d.latest.gas_ppm,
          alert: d.latest.alert,
        };
      if (id === "sensor-motion" && d.latest)
        payload = { motion: d.latest.motion };
      const validState = (
        byId[id].type === "light"
          ? ["on", "off"]
          : id === "door-1"
            ? ["locked", "unlocked"]
            : id === "sensor-gas"
              ? ["normal", "alert"]
              : ["clear", "detected"]
      ).includes(d.observation.reported_status);
      return {
        id,
        reported_status: validState ? d.observation.reported_status : null,
        age_ms: validAge ? Math.floor(age) : null,
        current: validAge && d.observation.freshness === "current",
        retained: d.observation.retained,
        board_online: home.boardOnline(byId[id].board_id),
        payload,
      };
    });
  const boards = Object.fromEntries(
    Object.entries(home.boards).map(([id, b]) => {
      const age = b.lastSeen === null ? null : now - b.lastSeen,
        valid = Number.isFinite(age) && age >= 0 && age <= 86400000;
      return [
        id,
        {
          online: valid && home.boardOnline(id),
          age_ms: valid ? Math.floor(age) : null,
        },
      ];
    }),
  );
  const alerts = repo.all(
    "SELECT id,device_id,kind,severity,state,opened_at,last_seen_at,resolved_at,version FROM alerts WHERE kind IN('gas','motion') ORDER BY opened_at DESC LIMIT 100",
  );
  const rows = repo.all(
    "SELECT * FROM online_gateway_commands WHERE state='pending_observation' OR ack_state IS NULL OR ack_state<>state ORDER BY created_at LIMIT 32",
  );
  for (const row of rows) {
    if (!row.local_command_id) continue;
    const command = home.command(row.local_command_id);
    const state =
      command?.state === "observed"
        ? "observed"
        : ["accepted", "published"].includes(command?.state)
          ? "pending_observation"
          : command?.state === "failed"
            ? "failed"
            : "uncertain";
    if (state !== row.state)
      repo.write(
        "UPDATE online_gateway_commands SET state=?,error_code=? WHERE command_id=?",
        [state, command?.error_code || null, row.command_id],
      );
  }
  const results = repo.all(
    "SELECT command_id,lease_id,state,error_code FROM online_gateway_commands WHERE (ack_state IS NULL OR ack_state<>state) AND state<>'claimed' ORDER BY created_at LIMIT 32",
  );
  return repo.transaction((tx) => {
    const row = tx.one(
      "SELECT sequence FROM online_gateway_state WHERE singleton=1",
    );
    const body = {
      schema_version: 1,
      event_id: crypto.randomUUID(),
      ticket_id: ticket.ticket_id,
      household_id: config.householdId,
      gateway_id: config.gatewayId,
      sequence: row.sequence + 1,
      epoch: home.epoch,
      catalog: projectCatalog(tx),
      mqtt_connected: !!home.connected,
      boards,
      devices,
      alerts,
      results,
    };
    const message = validateExchange({ ...body, digest: hash(body) });
    tx.run("DELETE FROM online_gateway_outbox");
    tx.run(
      "INSERT INTO online_gateway_outbox(event_id,sequence,body_json) VALUES(?,?,?)",
      [message.event_id, message.sequence, canonical(message)],
    );
    tx.run("UPDATE online_gateway_state SET sequence=? WHERE singleton=1", [
      message.sequence,
    ]);
    return message;
  });
}
async function readJSON(response, max = 16384) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Invalid cloud response");
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > max) throw new Error("Cloud response too large");
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function createGatewayWorker(
  home,
  config,
  { fetchImpl = fetch, random = Math.random } = {},
) {
  const repo = home.repo,
    origin = endpoint(config.origin);
  let busy = false,
    stopped = false,
    timer,
    controller,
    failures = 0;
  const remoteActor = {
    user_id: "gateway:" + config.gatewayId,
    role: "resident",
    can_unlock: false,
  };
  async function post(path, body) {
    const timeout = setTimeout(() => controller.abort(), 5000);
    timeout.unref();
    try {
      const response = await fetchImpl(origin + path, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Authorization: "Bearer " + config.token,
          "Content-Type": "application/json",
        },
        body: canonical(body),
      });
      if (!response.ok) {
        let details;
        try {
          details = await readJSON(response, 2048);
        } catch {}
        const e = new Error("Cloud rejected request");
        e.status = response.status;
        e.code = details?.error?.code;
        throw e;
      }
      return await readJSON(response);
    } finally {
      clearTimeout(timeout);
    }
  }
  async function processCommand(command, serverTime) {
    const keys = [
      "command_id",
      "device_id",
      "action",
      "lease_id",
      "expires_at",
    ];
    if (
      !command ||
      Object.keys(command).length !== keys.length ||
      keys.some((k) => !Object.hasOwn(command, k)) ||
      !uuid(command.command_id) ||
      command.command_id !== command.command_id.toLowerCase() ||
      !uuid(command.lease_id) ||
      command.lease_id !== command.lease_id.toLowerCase() ||
      !["light-1", "light-2", "light-3", "light-4"].includes(
        command.device_id,
      ) ||
      !["on", "off"].includes(command.action) ||
      !Number.isFinite(Date.parse(command.expires_at))
    )
      throw new Error("Invalid command envelope");
    if (
      repo.one(
        "SELECT command_id FROM online_gateway_commands WHERE command_id=?",
        [command.command_id],
      )
    )
      return;
    if (
      repo.one(
        "SELECT count(*) n FROM online_gateway_commands WHERE ack_state IS NULL OR ack_state<>state",
      ).n >= 32
    )
      return;
    // Persist consumption before requesting permission or touching the local command path.
    repo.write(
      "INSERT INTO online_gateway_commands(command_id,lease_id,device_id,action,state,created_at) VALUES(?,?,?,?,?,?)",
      [
        command.command_id,
        command.lease_id,
        command.device_id,
        command.action,
        "claimed",
        home.now(),
      ],
    );
    try {
      if (!config.allowLights)
        throw Object.assign(new Error(), {
          code: "REMOTE_CONTROL_NOT_ENABLED",
        });
      const started = performance.now();
      const permit = await post(
        "/api/gateway/commands/" + command.command_id + "/redeem",
        { lease_id: command.lease_id },
      );
      const elapsed = performance.now() - started;
      if (
        permit.allowed !== true ||
        permit.command_id !== command.command_id ||
        permit.device_id !== command.device_id ||
        permit.action !== command.action ||
        permit.lease_id !== command.lease_id ||
        permit.expires_at !== command.expires_at
      )
        throw Object.assign(new Error(), { code: "AUTHORIZATION_REVOKED" });
      const budget =
        Date.parse(permit.expires_at) -
        Date.parse(permit.server_time) -
        elapsed;
      if (!Number.isFinite(budget) || budget <= 1000 || budget > 20000)
        throw Object.assign(new Error(), { code: "COMMAND_EXPIRED" });
      const admissionDeadline = performance.now() + budget - 100;
      if (stopped) return;
      const d = home.device(command.device_id),
        age =
          d.observation.received_at === null
            ? Infinity
            : home.now() - Date.parse(d.observation.received_at);
      if (
        !home.connected ||
        !home.boardOnline("lights") ||
        d.observation.freshness !== "current" ||
        age < 0 ||
        age > 65000
      )
        throw Object.assign(new Error(), { code: "DEVICE_UNAVAILABLE" });
      const local = home.request(
        command.device_id,
        { action: command.action, idempotency_key: command.command_id },
        remoteActor,
        "cloud",
        () => !stopped && performance.now() < admissionDeadline,
      );
      repo.write(
        "UPDATE online_gateway_commands SET local_command_id=?,state=?,error_code=? WHERE command_id=?",
        [
          local.id,
          local.state === "observed"
            ? "observed"
            : ["accepted", "published"].includes(local.state)
              ? "pending_observation"
              : local.state,
          local.error_code || null,
          command.command_id,
        ],
      );
    } catch (error) {
      repo.write(
        "UPDATE online_gateway_commands SET state=?,error_code=? WHERE command_id=?",
        [
          error.status || !error.code ? "uncertain" : "rejected",
          /^[A-Z_]{1,64}$/.test(error.code || "")
            ? error.code
            : "GATEWAY_REQUEST_UNCERTAIN",
          command.command_id,
        ],
      );
    }
  }
  async function runOnce() {
    if (busy || stopped) return { state: "skipped" };
    if (
      repo.one("SELECT blocked FROM online_gateway_state WHERE singleton=1")
        .blocked
    )
      return { state: "blocked" };
    busy = true;
    controller = new AbortController();
    try {
      // Never replay an aged stored snapshot as current: coalesce fresh state on every attempt.
      const ticket = await post("/api/gateway/ticket", {});
      if (!uuid(ticket.ticket_id)) throw new Error("Invalid gateway ticket");
      const message = buildExchange(home, config, ticket);
      const result = await post("/api/gateway/exchange", message);
      if (
        result.schema_version !== 1 ||
        result.event_id !== message.event_id ||
        result.sequence !== message.sequence ||
        result.digest !== message.digest ||
        !["accepted", "stale"].includes(result.status) ||
        !Number.isFinite(Date.parse(result.server_time)) ||
        !Array.isArray(result.commands) ||
        result.commands.length > 4
      )
        throw new Error("Invalid cloud acknowledgment");
      if (stopped) return { state: "stopped" };
      if (result.status === "stale")
        throw Object.assign(new Error(), { status: 409 });
      repo.transaction((tx) => {
        tx.run("DELETE FROM online_gateway_outbox WHERE event_id=?", [
          message.event_id,
        ]);
        tx.run(
          "UPDATE online_gateway_state SET last_ack_at=?,last_error=NULL WHERE singleton=1",
          [home.now()],
        );
        for (const r of message.results)
          tx.run(
            "UPDATE online_gateway_commands SET ack_state=? WHERE command_id=? AND state=?",
            [r.state, r.command_id, r.state],
          );
        tx.run(
          "DELETE FROM online_gateway_commands WHERE state IN('observed','failed','rejected','uncertain') AND ack_state=state AND created_at<?",
          [home.now() - 30 * 86400000],
        );
      });
      for (const command of result.commands) {
        if (stopped) break;
        await processCommand(command, result.server_time);
      }
      failures = 0;
      return { state: "connected" };
    } catch (error) {
      if (stopped) return { state: "stopped" };
      failures++;
      const blocked =
        error.status >= 400 &&
        error.status < 500 &&
        ![408, 425, 429].includes(error.status) &&
        error.code !== "EXCHANGE_TICKET_EXPIRED";
      repo.write(
        "UPDATE online_gateway_state SET last_error=?,blocked=? WHERE singleton=1",
        [blocked ? "GATEWAY_REJECTED" : "CLOUD_UNAVAILABLE", +blocked],
      );
      return { state: blocked ? "blocked" : "retry" };
    } finally {
      busy = false;
      controller = null;
    }
  }
  async function tick() {
    try {
      await runOnce();
    } catch {
      failures++;
    }
    if (!stopped) {
      timer = setTimeout(
        tick,
        Math.min(
          30000,
          2000 * 2 ** Math.min(failures, 4) * (0.9 + 0.2 * random()),
        ),
      );
      timer.unref();
    }
  }
  return {
    runOnce,
    start() {
      if (!timer && !stopped) {
        timer = setTimeout(tick, 0);
        timer.unref();
      }
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
    },
    status: () => gatewayStatus(repo, true),
  };
}
module.exports = {
  loadGatewayConfig,
  initializeGatewayJournal,
  gatewayStatus,
  buildExchange,
  createGatewayWorker,
  readJSON,
};
