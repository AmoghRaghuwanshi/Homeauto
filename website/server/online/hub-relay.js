// Short-lived, encrypted management messages use the existing household journal.
// Device actuation stays on the separate leased command path.
const crypto = require("node:crypto");
const { fn } = require("./auth");
const { fail } = require("./db");
const types = [
  "_hub_rpc_request",
  "_hub_rpc_claim",
  "_hub_rpc_admit",
  "_hub_rpc_result",
];
function allowed(method, path) {
  return (
    (method === "GET" &&
      /^\/api\/(?:modules|system|camera\/(?:status|frame)|logs\/rfid-cards|door\/pin)$/.test(
        path,
      )) ||
    (method === "PUT" &&
      /^\/api\/(?:settings\/home|devices\/[a-z0-9-]+|rooms\/[a-z0-9-]+|door\/pin|logs\/rfid-cards\/[A-Fa-f0-9:%-]+|modules\/(?:esp32|camera))$/.test(
        path,
      )) ||
    (method === "POST" &&
      /^\/api\/(?:rooms|logs\/rfid-cards|modules\/(?:esp32|camera)\/connect)$/.test(
        path,
      )) ||
    (method === "DELETE" &&
      /^\/api\/(?:rooms\/[a-z0-9-]+|logs\/rfid-cards\/[A-Fa-f0-9:%-]+)$/.test(
        path,
      ))
  );
}
const sensitive = (method, path) =>
  method !== "GET" && /\/(?:modules|door|logs\/rfid-cards)\b/.test(path);
function createHubRelay(store, key) {
  const secret = Buffer.from(key || "", "hex");
  const enabled = secret.length === 32;
  const seal = (value) => {
    const iv = crypto.randomBytes(12),
      c = crypto.createCipheriv("aes-256-gcm", secret, iv);
    return Buffer.concat([
      iv,
      c.update(JSON.stringify(value)),
      c.final(),
      c.getAuthTag(),
    ]).toString("base64");
  };
  const open = (value) => {
    const b = Buffer.from(value, "base64"),
      c = crypto.createDecipheriv("aes-256-gcm", secret, b.subarray(0, 12));
    c.setAuthTag(b.subarray(-16));
    return JSON.parse(
      Buffer.concat([c.update(b.subarray(12, -16)), c.final()]),
    );
  };
  const requireEnabled = () => {
    if (!enabled) fail("HUB_RELAY_UNAVAILABLE", 503);
  };
  async function append(c, a, type, payload, id = crypto.randomUUID()) {
    await c.query(
      "INSERT INTO homeauto_online.events(event_id,household_id,type,payload) VALUES($1,$2,$3,$4::jsonb)",
      [id, a.household_id, type, JSON.stringify(payload)],
    );
    return id;
  }
  async function row(c, a, id) {
    return (
      await c.query(
        "SELECT * FROM homeauto_online.events WHERE household_id=$1 AND event_id=$2 AND type='_hub_rpc_request' AND created_at>now()-interval '60 seconds'",
        [a.household_id, id],
      )
    ).rows[0];
  }
  async function checkActor(c, a, request) {
    const actor = await fn(c, "session_actor", [request.session_hash]);
    if (
      !actor ||
      actor.household_id !== a.household_id ||
      actor.user_id !== request.user_id ||
      actor.role !== "owner"
    )
      fail("AUTHORIZATION_REVOKED", 403);
    const reauth = Date.parse(actor.reauth_at || "");
    if (
      sensitive(request.method, request.path) &&
      (!Number.isFinite(reauth) ||
        Date.now() - reauth < 0 ||
        Date.now() - reauth >= 300000)
    )
      fail("REAUTH_REQUIRED", 403);
    return actor;
  }
  return {
    enabled,
    async enqueue(a, method, path, body) {
      requireEnabled();
      if (a.role !== "owner") fail("FORBIDDEN", 403);
      if (!allowed(method, path)) fail("NOT_FOUND", 404);
      if (sensitive(method, path)) {
        const at = Date.parse(a.reauth_at || "");
        if (
          !Number.isFinite(at) ||
          Date.now() - at < 0 ||
          Date.now() - at >= 300000
        )
          fail("REAUTH_REQUIRED", 403);
      }
      if (Buffer.byteLength(JSON.stringify(body || {})) > 16384)
        fail("BODY_TOO_LARGE", 413);
      return store.tx(a, async (c) => {
        const gate = (
          await c.query(
            "SELECT * FROM homeauto_online.gateways WHERE household_id=$1 FOR UPDATE",
            [a.household_id],
          )
        ).rows[0];
        if (
          !gate ||
          gate.revoked_at ||
          !gate.last_seen_at ||
          Date.now() - Date.parse(gate.last_seen_at) > 15000
        )
          fail("HUB_UNAVAILABLE", 503);
        const pending = (
          await c.query(
            "SELECT * FROM homeauto_online.events r WHERE r.household_id=$1 AND r.type='_hub_rpc_request' AND r.created_at>now()-interval '25 seconds' AND NOT EXISTS(SELECT 1 FROM homeauto_online.events done WHERE done.household_id=$1 AND done.type='_hub_rpc_result' AND done.payload->>'request_id'=r.event_id::text) ORDER BY r.sequence DESC LIMIT 30",
            [a.household_id],
          )
        ).rows;
        let count = 0;
        for (const r of pending) {
          const old = open(r.payload.encrypted);
          if (old.user_id !== a.user_id) continue;
          count++;
          if (
            method === "GET" &&
            old.method === method &&
            old.path === path &&
            old.session_hash === a.token_hash
          )
            return { hub_request: r.event_id };
        }
        if (count >= 8) fail("HUB_BUSY", 429);
        const request = {
          method,
          path,
          body: body || {},
          user_id: a.user_id,
          session_hash: a.token_hash,
          gateway_id: gate.gateway_id,
          expires: Date.now() + 25000,
        };
        const id = await append(c, a, types[0], { encrypted: seal(request) });
        return { hub_request: id };
      });
    },
    async result(a, id) {
      requireEnabled();
      return store.tx(a, async (c) => {
        const r = await row(c, a, id);
        if (!r) fail("HUB_REQUEST_EXPIRED", 410);
        const request = open(r.payload.encrypted);
        if (
          request.user_id !== a.user_id ||
          request.session_hash !== a.token_hash
        )
          fail("NOT_FOUND", 404);
        const result = (
          await c.query(
            "SELECT payload FROM homeauto_online.events WHERE household_id=$1 AND type='_hub_rpc_result' AND payload->>'request_id'=$2 ORDER BY sequence DESC LIMIT 1",
            [a.household_id, id],
          )
        ).rows[0];
        if (result) return { hub_result: open(result.payload.encrypted) };
        if (request.expires < Date.now()) fail("HUB_REQUEST_UNCERTAIN", 504);
        return { hub_request: id };
      });
    },
    async claim(a) {
      requireEnabled();
      return store.tx(a, async (c) => {
        await c.query(
          "SELECT gateway_id FROM homeauto_online.gateways WHERE household_id=$1 FOR UPDATE",
          [a.household_id],
        );
        const rows = (
          await c.query(
            "SELECT * FROM homeauto_online.events r WHERE r.household_id=$1 AND r.type='_hub_rpc_request' AND r.created_at>now()-interval '25 seconds' AND NOT EXISTS(SELECT 1 FROM homeauto_online.events claimed WHERE claimed.household_id=$1 AND claimed.type='_hub_rpc_claim' AND claimed.payload->>'request_id'=r.event_id::text) ORDER BY r.sequence LIMIT 4",
            [a.household_id],
          )
        ).rows;
        const tasks = [];
        for (const r of rows) {
          const request = open(r.payload.encrypted);
          if (
            request.gateway_id !== a.gateway_id ||
            request.expires < Date.now()
          )
            continue;
          await append(c, a, types[1], {
            request_id: r.event_id,
            gateway_id: a.gateway_id,
          });
          tasks.push({ id: r.event_id });
        }
        return { tasks };
      });
    },
    async redeem(a, id) {
      requireEnabled();
      return store.tx(a, async (c) => {
        await c.query(
          "SELECT gateway_id FROM homeauto_online.gateways WHERE household_id=$1 FOR UPDATE",
          [a.household_id],
        );
        const r = await row(c, a, id);
        if (!r) fail("NOT_FOUND", 404);
        const request = open(r.payload.encrypted);
        if (
          request.gateway_id !== a.gateway_id ||
          request.expires < Date.now() ||
          !allowed(request.method, request.path)
        )
          fail("HUB_REQUEST_EXPIRED", 410);
        const events = (
          await c.query(
            "SELECT type,payload FROM homeauto_online.events WHERE household_id=$1 AND type IN('_hub_rpc_claim','_hub_rpc_admit') AND payload->>'request_id'=$2",
            [a.household_id, id],
          )
        ).rows;
        if (
          !events.some(
            (r) => r.type === types[1] && r.payload.gateway_id === a.gateway_id,
          ) ||
          events.some((r) => r.type === types[2])
        )
          fail("HUB_REQUEST_ALREADY_DELIVERED", 409);
        const actor = await checkActor(c, a, request);
        await append(c, a, types[2], {
          request_id: id,
          gateway_id: a.gateway_id,
        });
        return {
          request: {
            method: request.method,
            path: request.path,
            body: request.body,
          },
          actor: {
            user_id: actor.user_id,
            username: actor.username,
            display_name: actor.display_name,
            role: actor.role,
            reauth_age_ms: actor.reauth_at
              ? Math.max(0, Date.now() - Date.parse(actor.reauth_at))
              : null,
          },
          ttl_ms: Math.min(request.expires - Date.now(), 5000),
        };
      });
    },
    async complete(a, id, result) {
      requireEnabled();
      if (
        !result ||
        !Number.isInteger(result.status) ||
        result.status < 200 ||
        result.status > 599 ||
        Buffer.byteLength(JSON.stringify(result)) > 200000
      )
        fail("VALIDATION_ERROR");
      return store.tx(a, async (c) => {
        const r = await row(c, a, id);
        if (!r || open(r.payload.encrypted).gateway_id !== a.gateway_id)
          fail("NOT_FOUND", 404);
        const admitted = (
          await c.query(
            "SELECT 1 FROM homeauto_online.events WHERE household_id=$1 AND type='_hub_rpc_admit' AND payload->>'request_id'=$2 AND payload->>'gateway_id'=$3",
            [a.household_id, id, a.gateway_id],
          )
        ).rows[0];
        if (!admitted) fail("FORBIDDEN", 403);
        const old = (
          await c.query(
            "SELECT 1 FROM homeauto_online.events WHERE household_id=$1 AND type='_hub_rpc_result' AND payload->>'request_id'=$2",
            [a.household_id, id],
          )
        ).rows[0];
        if (!old)
          await append(c, a, types[3], {
            request_id: id,
            encrypted: seal(result),
          });
        return { accepted: true };
      });
    },
  };
}
module.exports = { createHubRelay, allowed, sensitive, types };
