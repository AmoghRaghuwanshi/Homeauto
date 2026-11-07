const express = require("express");
const crypto = require("crypto");
const { DomainError, fields, text, uuid } = require("../lib/errors");
const { OnlineError, fail } = require("./db");
const { createCloudAuth, fn, secureEqual } = require("./auth");
const { createOnlineStore, event } = require("./store");
const { byId } = require("../lib/registry");
const { defaults } = require("../services/home");
const { resolveCommand } = require("../voice/intent");
function createOnlineApp({ pool, config, logger = console }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("query parser", "simple");
  const auth = createCloudAuth(pool, { secure: config.secure !== false }),
    store = createOnlineStore(pool, {
      allowCommands: !!config.allowCommands,
      simulation: !!config.simulation,
    });
  app.locals.auth = auth;
  app.locals.store = store;
  const route = (fn) => (req, res, next) =>
    Promise.resolve()
      .then(() => fn(req, res, next))
      .catch(next);
  app.use((req, res, next) => {
    req.requestId = crypto.randomUUID();
    const started = process.hrtime.bigint();
    res.on("finish", () => {
      const path =
        typeof req.route?.path === "string" ? req.route.path : "unmatched";
      if (
        res.statusCode >= 400 ||
        path.endsWith("/command") ||
        path.endsWith("/redeem")
      )
        logger.info?.(
          JSON.stringify({
            event: "cloud_api_result",
            request_id: req.requestId,
            route: path,
            status: res.statusCode,
            code: res.locals.failureCode || null,
            duration_ms: Math.round(
              Number(process.hrtime.bigint() - started) / 1e6,
            ),
          }),
        );
    });
    res.set({
      "Cache-Control": "no-store",
      "X-Request-Id": req.requestId,
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self';script-src 'self';style-src 'self';connect-src 'self';img-src 'self' data:;font-src 'self';media-src 'self' blob:;object-src 'none';base-uri 'self';frame-ancestors 'none';form-action 'self'",
      "Permissions-Policy": "microphone=(),camera=(),geolocation=()",
    });
    if (config.secure !== false)
      res.set("Strict-Transport-Security", "max-age=31536000");
    try {
      const host = new URL("https://" + req.headers.host);
      if (
        ![...config.origins].some(
          (origin) => new URL(origin).host === host.host,
        ) ||
        host.username ||
        host.password
      )
        fail("INVALID_HOST", 403);
      if (req.headers.origin && !config.origins.has(req.headers.origin))
        fail("INVALID_ORIGIN", 403);
      next();
    } catch (e) {
      next(e instanceof OnlineError ? e : new OnlineError("INVALID_HOST", 403));
    }
  });
  app.get("/api/runtime", (req, res) =>
    res.json({
      mode: "cloud",
      transport: "poll",
      poll_ms: 2000,
      capabilities: {
        metadata_edit: false,
        rfid: false,
        local_voice: false,
        remote_lights: !!config.allowCommands,
      },
    }),
  );
  app.get("/api/health", (req, res) =>
    res.json({
      status: "ok",
      mode: "cloud",
      timestamp: new Date().toISOString(),
    }),
  );
  app.use(express.json({ limit: "64kb", strict: true }));
  const mutation = (req) => {
    if (!req.headers.origin || !config.origins.has(req.headers.origin))
      fail("ORIGIN_REQUIRED", 403);
    if (!req.is("application/json")) fail("JSON_REQUIRED", 415);
  };
  app.post(
    "/api/auth/login",
    route(async (req, res) => {
      mutation(req);
      fields(req.body, ["username", "password"], ["username", "password"]);
      const ip =
        process.env.VERCEL === "1"
          ? req.headers["x-real-ip"] || "platform"
          : req.socket.remoteAddress;
      const result = await auth.login(
        req.body.username,
        req.body.password,
        String(ip).slice(0, 100),
      );
      res.set("Set-Cookie", auth.cookie(result.token));
      res.json(auth.dto(result.session));
    }),
  );
  app.use(
    "/api/gateway",
    route(async (req, res, next) => {
      if (req.headers.origin) fail("BROWSER_ORIGIN_FORBIDDEN", 403);
      if (req.method !== "POST" || !req.is("application/json"))
        fail("JSON_REQUIRED", 415);
      const token = /^Bearer ([a-f0-9]{64})$/.exec(
        req.headers.authorization || "",
      )?.[1];
      req.gateway = await auth.gateway(token);
      if (!req.gateway) fail("GATEWAY_AUTH_REQUIRED", 401);
      await auth.rate("gateway:" + req.gateway.gateway_id, 120);
      next();
    }),
  );
  app.post(
    "/api/gateway/exchange",
    route(async (req, res) =>
      res.json(await store.exchange(req.gateway, req.body)),
    ),
  );
  app.post(
    "/api/gateway/ticket",
    route(async (req, res) => {
      fields(req.body, []);
      res.status(201).json(await store.ticket(req.gateway));
    }),
  );
  app.post(
    "/api/gateway/commands/:id/redeem",
    route(async (req, res) => {
      fields(req.body, ["lease_id"], ["lease_id"]);
      if (!uuid(req.params.id) || !uuid(req.body.lease_id))
        fail("VALIDATION_ERROR");
      res.json(
        await store.redeem(req.gateway, req.params.id, req.body.lease_id),
      );
    }),
  );
  app.use("/api/gateway", (req, res) =>
    res.status(404).json({ error: { code: "NOT_FOUND", retryable: false } }),
  );
  app.use(
    "/api",
    route(async (req, res, next) => {
      req.token = auth.readToken(req);
      req.actor = await auth.actor(req.token);
      if (!req.actor) fail("LOGIN_REQUIRED", 401);
      await auth.rate(
        (["GET", "HEAD"].includes(req.method) ? "read:" : "write:") +
          req.actor.user_id,
        ["GET", "HEAD"].includes(req.method) ? 180 : 90,
      );
      if (!["GET", "HEAD"].includes(req.method)) {
        mutation(req);
        if (!secureEqual(req.headers["x-csrf-token"], req.actor.csrf_token))
          fail("INVALID_CSRF", 403);
        if (Buffer.byteLength(JSON.stringify(req.body || {})) > 16384)
          fail("BODY_TOO_LARGE", 413);
      }
      next();
    }),
  );
  app.get("/api/auth/session", (req, res) => res.json(auth.dto(req.actor)));
  app.post(
    "/api/auth/activity",
    route(async (req, res) => {
      fields(req.body, []);
      await auth.touch(req.token);
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/auth/logout",
    route(async (req, res) => {
      await auth.logout(req.token);
      res.set("Set-Cookie", auth.cookie("", true));
      res.json({ success: true });
    }),
  );
  app.post(
    "/api/auth/reauth",
    route(async (req, res) => {
      fields(req.body, ["password"], ["password"]);
      const result = await auth.reauth(req.actor, req.token, req.body.password);
      res.set("Set-Cookie", auth.cookie(result.token));
      res.json(auth.dto(result.session));
    }),
  );
  app.get(
    "/api/households",
    route(async (req, res) =>
      res.json({ items: await auth.households(req.actor) }),
    ),
  );
  app.post(
    "/api/auth/household",
    route(async (req, res) => {
      fields(req.body, ["household_id"], ["household_id"]);
      if (!uuid(req.body.household_id)) fail("VALIDATION_ERROR");
      const result = await auth.switchHousehold(
        req.actor,
        req.token,
        req.body.household_id,
      );
      res.set("Set-Cookie", auth.cookie(result.token));
      res.json(auth.dto(result.session));
    }),
  );
  app.get(
    "/api/snapshot",
    route(async (req, res) => res.json(await store.snapshot(req.actor))),
  );
  app.get(
    "/api/devices",
    route(async (req, res) =>
      res.json((await store.snapshot(req.actor)).devices),
    ),
  );
  app.get(
    "/api/devices/:id",
    route(async (req, res) => {
      const device = (await store.snapshot(req.actor)).devices.find(
        (d) => d.id === req.params.id,
      );
      if (!device) fail("NOT_FOUND", 404);
      res.json(device);
    }),
  );
  app.post(
    "/api/devices/:id/command",
    route(async (req, res) => {
      fields(
        req.body,
        ["action", "idempotency_key"],
        ["action", "idempotency_key"],
      );
      res.status(202).json({
        command: await store.request(req.actor, req.params.id, req.body),
      });
    }),
  );
  app.get(
    "/api/commands/:id",
    route(async (req, res) => {
      if (!uuid(req.params.id)) fail("NOT_FOUND", 404);
      res.json({ command: await store.command(req.actor, req.params.id) });
    }),
  );
  app.post("/api/security/unlock-challenges", (req, res, next) =>
    next(new OnlineError("REMOTE_DOOR_DISABLED", 403)),
  );
  app.get(
    "/api/rooms",
    route(async (req, res) =>
      res.json((await store.snapshot(req.actor)).rooms),
    ),
  );
  app.get(
    "/api/preferences",
    route(async (req, res) =>
      res.json((await store.snapshot(req.actor)).preferences),
    ),
  );
  app.put(
    "/api/preferences",
    route(async (req, res) => {
      fields(req.body, [...Object.keys(defaults), "version"], ["version"]);
      const before = (await store.snapshot(req.actor)).preferences;
      if (req.body.version !== before.version) fail("VERSION_CONFLICT", 409);
      const value = { ...before, ...req.body };
      delete value.version;
      if (
        !Array.isArray(value.favorites) ||
        value.favorites.length > 7 ||
        new Set(value.favorites).size !== value.favorites.length ||
        value.favorites.some((id) => !byId[id])
      )
        fail("VALIDATION_ERROR");
      for (const k of ["input_language", "reply_language"])
        if (!["auto", "en", "hi"].includes(value[k])) fail("VALIDATION_ERROR");
      if (
        typeof value.spoken_replies !== "boolean" ||
        typeof value.voice_rate !== "number" ||
        value.voice_rate < 0.8 ||
        value.voice_rate > 1.2 ||
        !Array.isArray(value.notification_categories) ||
        value.notification_categories.some(
          (k) => !["gas", "motion", "access_denied", "device"].includes(k),
        )
      )
        fail("VALIDATION_ERROR");
      res.json(await store.preferences(req.actor, value, req.body.version));
    }),
  );
  app.get(
    "/api/settings/home",
    route(async (req, res) => res.json((await store.snapshot(req.actor)).home)),
  );
  for (const path of [
    "/api/rooms",
    "/api/rooms/:id",
    "/api/devices",
    "/api/devices/:id",
    "/api/settings/home",
  ])
    app.all(path, (req, res, next) =>
      ["GET", "HEAD"].includes(req.method)
        ? next()
        : next(new OnlineError("LOCAL_METADATA_ONLY", 409)),
    );
  app.all("/api/logs/rfid-cards*", (req, res, next) =>
    next(new OnlineError("RFID_LOCAL_ONLY", 403)),
  );
  app.get(
    "/api/alerts",
    route(async (req, res) => {
      const state = req.query.state || "all";
      if (!["active", "resolved", "all"].includes(state))
        fail("VALIDATION_ERROR");
      res.json({
        items: (await store.snapshot(req.actor)).alerts.filter(
          (a) => state === "all" || a.state === state,
        ),
        next_cursor: null,
      });
    }),
  );
  for (const action of ["read", "acknowledge"])
    app.post(
      "/api/alerts/:id/" + action,
      route(async (req, res) => {
        if (!uuid(req.params.id)) fail("NOT_FOUND", 404);
        res.json(await store.receipt(req.actor, req.params.id, action));
      }),
    );
  async function activity(req) {
    const query = req.query,
      limit = query.limit === undefined ? 30 : Number(query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      fail("INVALID_LIMIT");
    if (query.cursor && !/^\d{1,18}$/.test(query.cursor))
      fail("INVALID_CURSOR");
    const category = query.category || "all";
    if (!["all", "lights", "doors", "sensors", "system"].includes(category))
      fail("INVALID_CATEGORY");
    if (query.device_id && !byId[query.device_id]) fail("NOT_FOUND", 404);
    for (const k of ["from", "to"])
      if (query[k] && !Number.isFinite(Date.parse(query[k])))
        fail("INVALID_DATE");
    if (query.from && query.to && Date.parse(query.from) > Date.parse(query.to))
      fail("INVALID_DATE");
    return store.events(req.actor, {
      ...query,
      limit,
      category,
      ...(query.q ? { q: text(query.q, 100) } : {}),
      ...(query.type ? { type: text(query.type, 60) } : {}),
    });
  }
  app.get(
    "/api/activity",
    route(async (req, res) => res.json(await activity(req))),
  );
  app.get(
    "/api/logs",
    route(async (req, res) => res.json((await activity(req)).items)),
  );
  app.get(
    "/api/events",
    route(async (req, res) => {
      const cursor = req.query.cursor || "0";
      if (!/^\d{1,18}$/.test(cursor)) fail("INVALID_CURSOR");
      res.json(await store.feed(req.actor, cursor));
    }),
  );
  app.post(
    "/api/assistant/interpret",
    route(async (req, res) => {
      fields(req.body, ["text", "language"], ["text"]);
      if (
        req.body.language &&
        !["en", "hi", "auto"].includes(req.body.language)
      )
        fail("VALIDATION_ERROR");
      const input = text(req.body.text, 500);
      const s = await store.snapshot(req.actor);
      const parsed = resolveCommand(input, s.devices, s.rooms, []);
      if (!parsed.ok) fail("INTENT_" + parsed.reason.toUpperCase(), 422);
      const id = crypto.randomUUID();
      await store.tx(req.actor, async (c) => {
        const count = (
          await c.query(
            "SELECT count(*)::int n FROM homeauto_online.intents WHERE household_id=$1 AND user_id=$2 AND expires_at>now()",
            [req.actor.household_id, req.actor.user_id],
          )
        ).rows[0].n;
        if (count >= 20) fail("ASSISTANT_BUSY", 429);
        await c.query(
          "INSERT INTO homeauto_online.intents(intent_id,household_id,user_id,session_hash,intent,expires_at) VALUES($1,$2,$3,$4,$5::jsonb,now()+interval '30 seconds')",
          [
            id,
            req.actor.household_id,
            req.actor.user_id,
            req.actor.token_hash,
            JSON.stringify(parsed.intent),
          ],
        );
      });
      res.json({
        intent: parsed.intent,
        intent_id: id,
        expires_at: new Date(Date.now() + 30000).toISOString(),
      });
    }),
  );
  app.post(
    "/api/assistant/execute",
    route(async (req, res) => {
      fields(
        req.body,
        ["intent_id", "idempotency_key"],
        ["intent_id", "idempotency_key"],
      );
      if (!uuid(req.body.intent_id) || !uuid(req.body.idempotency_key))
        fail("VALIDATION_ERROR");
      const result = await store.tx(req.actor, async (c) => {
        const saved = (
          await c.query(
            "SELECT * FROM homeauto_online.intents WHERE intent_id=$1 AND household_id=$2 AND user_id=$3 AND session_hash=$4 AND expires_at>now()",
            [
              req.body.intent_id,
              req.actor.household_id,
              req.actor.user_id,
              req.actor.token_hash,
            ],
          )
        ).rows[0];
        if (!saved) fail("INTENT_EXPIRED", 409);
        if (
          saved.execution_key &&
          saved.execution_key !== req.body.idempotency_key
        )
          fail("INTENT_ALREADY_USED", 409);
        const intent = saved.intent;
        if (intent.sensitive) fail("REMOTE_DOOR_DISABLED", 403);
        if (saved.result && intent.kind !== "query") return saved.result;
        const preferred =
          (
            await c.query(
              "SELECT value FROM homeauto_online.preferences WHERE household_id=$1 AND user_id=$2",
              [req.actor.household_id, req.actor.user_id],
            )
          ).rows[0]?.value?.reply_language || "auto";
        const language =
          preferred === "auto"
            ? intent.language === "hi"
              ? "hi"
              : "en"
            : preferred;
        let answer;
        if (intent.kind === "query") {
          const s = await store.snapshotIn(c, req.actor);
          answer = {
            answer: {
              result_id: crypto.randomUUID(),
              message_key: "query_result",
              language,
              text: intent.device_ids
                .map((id) => {
                  const d = s.devices.find((d) => d.id === id);
                  const labels = {
                    on: "चालू",
                    off: "बंद",
                    locked: "लॉक",
                    unlocked: "अनलॉक",
                    normal: "सामान्य",
                    alert: "चेतावनी",
                    clear: "हलचल नहीं",
                    detected: "हलचल हुई",
                  };
                  const value =
                    d.observation.freshness === "current"
                      ? language === "hi"
                        ? labels[d.observation.reported_status] ||
                          "स्थिति उपलब्ध नहीं है"
                        : d.observation.reported_status
                      : language === "hi"
                        ? "स्थिति उपलब्ध नहीं है"
                        : "status unavailable";
                  const qualifier =
                    d.type === "door"
                      ? language === "hi"
                        ? " वास्तविक लॉक की स्थिति मापी नहीं जाती।"
                        : " Physical lock position is not sensed."
                      : "";
                  const report =
                    d.observation.freshness === "current"
                      ? language === "hi"
                        ? `कंट्रोलर की रिपोर्ट: ${value}`
                        : `Controller reports ${value}`
                      : value;
                  return `${d.name}: ${report}.${qualifier}`;
                })
                .join(" "),
            },
          };
        } else {
          const commands = [],
            errors = [];
          for (const id of intent.device_ids) {
            const key = crypto
              .createHash("sha256")
              .update(req.body.idempotency_key + id)
              .digest("hex");
            const derived = `${key.slice(0, 8)}-${key.slice(8, 12)}-4${key.slice(13, 16)}-8${key.slice(17, 20)}-${key.slice(20, 32)}`;
            try {
              commands.push(
                await store.requestIn(c, req.actor, id, {
                  action: intent.action,
                  idempotency_key: derived,
                }),
              );
            } catch (e) {
              if (!(e instanceof OnlineError)) throw e;
              errors.push({ device_id: id, code: e.code });
            }
          }
          answer = {
            commands,
            errors,
            result_id: crypto.randomUUID(),
            language,
          };
        }
        await c.query(
          "UPDATE homeauto_online.intents SET execution_key=$2,result=$3::jsonb WHERE intent_id=$1",
          [saved.intent_id, req.body.idempotency_key, JSON.stringify(answer)],
        );
        return answer;
      });
      res.status(result.answer ? 200 : 202).json(result);
    }),
  );
  app.all("/api/assistant/voice-tickets", (req, res, next) =>
    next(new OnlineError("LOCAL_VOICE_ONLY", 503)),
  );
  app.all("/api/assistant/speech*", (req, res, next) =>
    next(new OnlineError("LOCAL_VOICE_ONLY", 503)),
  );
  app.all("/api/assistant/audio*", (req, res, next) =>
    next(new OnlineError("LOCAL_VOICE_ONLY", 503)),
  );
  app.get("/api/ai/models", (req, res, next) =>
    req.actor.role === "owner"
      ? res.json({ assets: [] })
      : next(new OnlineError("FORBIDDEN", 403)),
  );
  app.post("/api/ai/models/:id/activate", (req, res, next) =>
    next(new OnlineError("LOCAL_VOICE_ONLY", 503)),
  );
  app.get(
    "/api/system",
    route(async (req, res) => {
      if (req.actor.role !== "owner") fail("FORBIDDEN", 403);
      const s = await store.snapshot(req.actor);
      res.json({
        version: "2.0.0",
        mode: "cloud",
        broker: { connected: s.mqtt.connected, enabled: false },
        gateway: s.gateway,
        boards: s.espBoards,
        database: { healthy: true, schema_version: 2, engine: "PostgreSQL" },
        speech: s.speech,
        door_enabled: false,
        simulation: !!config.simulation,
        resources: {
          scope: "function_instance",
          uptime_seconds: Math.floor(process.uptime()),
          rss_bytes: process.memoryUsage().rss,
        },
        diagnostics: await store.diagnostics(req.actor),
      });
    }),
  );
  app.use((req, res) =>
    res.status(404).json({
      error: { code: "NOT_FOUND", retryable: false },
      request_id: req.requestId,
    }),
  );
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const known = error instanceof OnlineError || error instanceof DomainError,
      status = known
        ? error.status
        : error.type === "entity.too.large"
          ? 413
          : error instanceof SyntaxError
            ? 400
            : error.code === "23505"
              ? 409
              : 503;
    const code = known
      ? error.code
      : status === 413
        ? "BODY_TOO_LARGE"
        : status === 400
          ? "INVALID_JSON"
          : status === 409
            ? "VERSION_CONFLICT"
            : "CLOUD_UNAVAILABLE";
    res.locals.failureCode = code;
    if (status === 429) res.set("Retry-After", "60");
    res.status(status).json({
      error: {
        code,
        message: known
          ? error.message
          : "HomeAuto could not complete the request. Try again.",
        retryable: status >= 500,
      },
      request_id: req.requestId,
    });
  });
  return app;
}
module.exports = { createOnlineApp };
