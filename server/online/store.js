const crypto = require("crypto");
const { scoped, fail } = require("./db");
const { fn } = require("./auth");
const { validateExchange, hash, canonical } = require("./protocol");
const { byId } = require("../lib/registry");
const { uuid } = require("../lib/errors");
const { defaults } = require("../services/home");
const active = ["queued", "delivered", "pending_observation"];
const commandDTO = (c) => ({
  id: c.command_id,
  device_id: c.device_id,
  actor_id: c.actor_id,
  action: c.action,
  state: c.state,
  idempotency_key: c.idempotency_key,
  requested_at: c.created_at,
  deadline_at: c.expires_at,
  observed_at: c.observed_at,
  error_code: c.error_code,
  already_reported: false,
  evidence: c.state === "observed" ? "controller_report" : null,
  correlation: c.state === "observed" ? "temporal" : null,
  physical_verified: false,
  source: "cloud",
});
async function databaseNow(client) {
  return new Date(
    (await client.query("SELECT clock_timestamp() AS now")).rows[0].now,
  );
}
async function event(client, a, type, payload = {}, device = null) {
  const sequence = (
    await client.query(
      "INSERT INTO homeauto_online.events(event_id,household_id,type,device_id,payload) VALUES($1,$2,$3,$4,$5::jsonb) RETURNING sequence",
      [
        crypto.randomUUID(),
        a.household_id,
        type,
        device,
        JSON.stringify(payload),
      ],
    )
  ).rows[0].sequence;
  await client.query(
    "UPDATE homeauto_online.households SET event_highwater=greatest(event_highwater,$2::bigint) WHERE household_id=$1",
    [a.household_id, sequence],
  );
  return sequence;
}
async function expire(client, a) {
  const { rows } = await client.query(
    "UPDATE homeauto_online.commands SET state=CASE WHEN state='queued' THEN 'expired' ELSE 'uncertain' END,error_code=CASE WHEN state='queued' THEN 'COMMAND_EXPIRED' ELSE 'OBSERVATION_TIMEOUT' END,finished_at=now() WHERE household_id=$1 AND state IN('queued','delivered','pending_observation') AND expires_at<=now() RETURNING *",
    [a.household_id],
  );
  for (const c of rows)
    await event(
      client,
      a,
      "command_" + c.state,
      { command_id: c.command_id, state: c.state },
      c.device_id,
    );
}
function createOnlineStore(
  pool,
  { allowCommands = false, simulation = false } = {},
) {
  const tx = (a, work) => scoped(pool, a, work);
  async function snapshotIn(client, a) {
    await expire(client, a);
    const now = await databaseNow(client);
    const gateway = (
      await client.query(
        "SELECT * FROM homeauto_online.gateways WHERE household_id=$1",
        [a.household_id],
      )
    ).rows[0];
    const gatewayCurrent = !!(
      gateway &&
      !gateway.revoked_at &&
      gateway.last_seen_at &&
      now - new Date(gateway.last_seen_at) <= 15000
    );
    const rooms = (
      await client.query(
        "SELECT room_id AS id,name,name_key,sort_order,version FROM homeauto_online.rooms WHERE household_id=$1 ORDER BY sort_order,name",
        [a.household_id],
      )
    ).rows;
    const observations = (
      await client.query(
        "SELECT * FROM homeauto_online.observations WHERE household_id=$1",
        [a.household_id],
      )
    ).rows;
    const commands = (
      await client.query(
        "SELECT * FROM homeauto_online.commands WHERE household_id=$1 AND (actor_id=$2 OR $3) ORDER BY created_at DESC LIMIT 40",
        [a.household_id, a.user_id || null, a.role === "owner"],
      )
    ).rows;
    const pending = (
      await client.query(
        "SELECT device_id,command_id FROM homeauto_online.commands WHERE household_id=$1 AND state IN('queued','delivered','pending_observation')",
        [a.household_id],
      )
    ).rows;
    const espBoards = Object.fromEntries(
      ["lights", "door"].map((id) => {
        const b = gateway?.boards?.[id],
          seen =
            b?.age_ms !== null &&
            b?.age_ms !== undefined &&
            gateway?.last_seen_at
              ? new Date(new Date(gateway.last_seen_at).getTime() - b.age_ms)
              : null;
        return [
          id,
          {
            name:
              id === "lights"
                ? "ESP32-A (Lights + Sensors)"
                : "ESP32-B (Door Security)",
            online: !!(
              gatewayCurrent &&
              gateway.mqtt_connected &&
              b?.online &&
              seen &&
              now - seen <= 60000
            ),
            lastSeen: seen?.toISOString() || null,
          },
        ];
      }),
    );
    const stored = (
      await client.query(
        "SELECT * FROM homeauto_online.devices WHERE household_id=$1 ORDER BY device_id",
        [a.household_id],
      )
    ).rows;
    const devices = stored.map((d) => {
      const o = observations.find((v) => v.device_id === d.device_id),
        reg = byId[d.device_id];
      const current = !!(
        o &&
        o.current_report &&
        !o.retained &&
        o.epoch === gateway?.epoch &&
        gatewayCurrent &&
        espBoards[reg.board_id].online &&
        o.reported_at &&
        now - new Date(o.reported_at) >= 0 &&
        now - new Date(o.reported_at) <
          (d.device_id === "sensor-gas" ? 10000 : 65000)
      );
      return {
        id: d.device_id,
        name: d.name,
        type: d.type,
        room_id: d.room_id,
        location: rooms.find((r) => r.id === d.room_id)?.name || "",
        version: d.version,
        status: o?.reported_status || null,
        is_online: +current,
        connectivity: espBoards[reg.board_id].online ? "online" : "offline",
        board_id: reg.board_id,
        capabilities: reg.capabilities,
        observation: {
          reported_status: o?.reported_status || null,
          received_at: o?.reported_at
            ? new Date(o.reported_at).toISOString()
            : null,
          freshness: current ? "current" : o?.reported_at ? "stale" : "unknown",
          retained: !!o?.retained,
          physical_verified: false,
          source: o?.reported_at ? "controller_report" : "legacy_db",
          version: d.version,
        },
        latest: o?.payload
          ? {
              ...o.payload,
              received_at: o.reported_at
                ? new Date(o.reported_at).toISOString()
                : null,
            }
          : null,
        pending_command_id:
          pending.find((p) => p.device_id === d.device_id)?.command_id || null,
      };
    });
    const alerts = (
      await client.query(
        "SELECT a.*,r.read_at,r.acknowledged_at FROM homeauto_online.alerts a LEFT JOIN homeauto_online.alert_receipts r ON r.household_id=a.household_id AND r.alert_id=a.alert_id AND r.user_id=$2 WHERE a.household_id=$1 ORDER BY (a.state='active') DESC,a.opened_at DESC LIMIT 100",
        [a.household_id, a.user_id || null],
      )
    ).rows.map((r) => ({
      ...r,
      id: r.alert_id,
      receipt: { read_at: r.read_at, acknowledged_at: r.acknowledged_at },
    }));
    const pref = (
      await client.query(
        "SELECT value,version FROM homeauto_online.preferences WHERE household_id=$1 AND user_id=$2",
        [a.household_id, a.user_id || null],
      )
    ).rows[0];
    const home = (
      await client.query(
        "SELECT name AS home_name,version FROM homeauto_online.households WHERE household_id=$1",
        [a.household_id],
      )
    ).rows[0];
    if (!home) fail("FORBIDDEN", 403);
    const cursor = String(
      (
        await client.query(
          "SELECT event_highwater AS cursor FROM homeauto_online.households WHERE household_id=$1",
          [a.household_id],
        )
      ).rows[0].cursor,
    );
    return {
      schema_version: 1,
      server_epoch: "cloud:" + a.household_id,
      server_time: now.toISOString(),
      cloud_cursor: cursor,
      gateway_sequence: Number(gateway?.last_sequence || 0),
      devices,
      rooms,
      espBoards,
      mqtt: { connected: !!(gatewayCurrent && gateway.mqtt_connected) },
      gateway: {
        registered: !!gateway && !gateway.revoked_at,
        state: !gateway ? 'not_enrolled' : gateway.revoked_at ? 'revoked' : !gateway.last_seen_at ? 'awaiting_connection' : gatewayCurrent ? 'connected' : 'offline',
        connected: gatewayCurrent,
        last_seen_at: gateway?.last_seen_at || null,
      },
      commands: commands.map(commandDTO),
      alerts,
      session: {
        id: a.user_id,
        display_name: a.display_name,
        role: a.role,
        can_unlock: false,
      },
      preferences: { ...defaults, ...pref?.value, version: pref?.version || 0 },
      home,
      speech: {
        stt_ready: false,
        tts_ready: false,
        input_languages: [],
        reply_languages: [],
        voices: [],
      },
      system: {
        simulation,
        mode: "cloud",
        door_enabled: false,
        persistence_healthy: true,
        fault: null,
        remote_lights_enabled: allowCommands,
      },
      capabilities: {
        metadata_edit: false,
        rfid: false,
        local_voice: false,
        remote_lights: allowCommands,
      },
    };
  }
  async function requestIn(client, a, id, input) {
    if (!["owner", "resident"].includes(a.role)) fail("FORBIDDEN", 403);
    if (!uuid(input.idempotency_key)) fail("INVALID_IDEMPOTENCY_KEY");
    const reg = byId[id];
    if (!reg) fail("NOT_FOUND", 404);
    if (reg.type === "door") fail("REMOTE_DOOR_DISABLED", 403);
    if (reg.type !== "light") fail("UNSUPPORTED_ACTION", 422);
    if (!["on", "off", "toggle"].includes(input.action))
      fail("UNSUPPORTED_ACTION", 422);
    if (!allowCommands) fail("REMOTE_CONTROL_NOT_ENABLED", 503);
    const requestHash = hash({ id, action: input.action });
    const old = (
      await client.query(
        "SELECT * FROM homeauto_online.commands WHERE household_id=$1 AND actor_id=$2 AND idempotency_key=$3",
        [a.household_id, a.user_id, input.idempotency_key],
      )
    ).rows[0];
    if (old) {
      if (old.request_hash !== requestHash) fail("IDEMPOTENCY_CONFLICT", 409);
      return commandDTO(old);
    }
    if (
      !(await fn(client, "take_limit", [
        hash("device-command:" + a.household_id + ":" + id),
        20,
        60,
      ]))
    )
      fail("RATE_LIMITED", 429);
    if (
      !(await fn(client, "valid_controller", [
        a.user_id,
        a.household_id,
        a.token_hash,
      ]))
    )
      fail("LOGIN_REQUIRED", 401);
    await expire(client, a);
    const s = await snapshotIn(client, a),
      device = s.devices.find((d) => d.id === id);
    if (!device) fail("NOT_FOUND", 404);
    if (
      !s.gateway.connected ||
      device.connectivity !== "online" ||
      device.observation.freshness !== "current"
    )
      fail("DEVICE_UNAVAILABLE", 503);
    if (device.pending_command_id) fail("DEVICE_BUSY", 409);
    const action =
      input.action === "toggle"
        ? device.observation.reported_status === "on"
          ? "off"
          : "on"
        : input.action;
    const idempotency = input.idempotency_key;
    const { rows } = await client.query(
      "INSERT INTO homeauto_online.commands(command_id,household_id,device_id,actor_id,session_hash,action,state,idempotency_key,request_hash,expires_at) VALUES($1,$2,$3,$4,$5,$6,'queued',$7,$8,now()+interval '15 seconds') RETURNING *",
      [
        crypto.randomUUID(),
        a.household_id,
        id,
        a.user_id,
        a.token_hash,
        action,
        idempotency,
        requestHash,
      ],
    );
    await event(
      client,
      a,
      "command_queued",
      { command_id: rows[0].command_id, state: "queued", action },
      id,
    );
    return commandDTO(rows[0]);
  }
  return {
    tx,
    snapshot: (a) => tx(a, (c) => snapshotIn(c, a)),
    request: (a, id, body) => tx(a, (c) => requestIn(c, a, id, body)),
    requestIn,
    snapshotIn,
    async ticket(a) {
      return tx(a, async (c) => {
        await c.query(
          "DELETE FROM homeauto_online.gateway_tickets WHERE household_id=$1 AND expires_at<=now()",
          [a.household_id],
        );
        return (
          await c.query(
            "INSERT INTO homeauto_online.gateway_tickets(ticket_id,household_id,gateway_id,expires_at) VALUES($1,$2,$3,now()+interval '10 seconds') RETURNING ticket_id,expires_at,created_at AS server_time",
            [crypto.randomUUID(), a.household_id, a.gateway_id],
          )
        ).rows[0];
      });
    },
    async command(a, id) {
      return tx(a, async (c) => {
        await expire(c, a);
        const command = (
          await c.query(
            "SELECT * FROM homeauto_online.commands WHERE command_id=$1 AND household_id=$2 AND (actor_id=$3 OR $4)",
            [id, a.household_id, a.user_id, a.role === "owner"],
          )
        ).rows[0];
        if (!command) fail("NOT_FOUND", 404);
        return commandDTO(command);
      });
    },
    async exchange(a, input) {
      const message = validateExchange(input);
      if (
        message.household_id !== a.household_id ||
        message.gateway_id !== a.gateway_id
      )
        fail("GATEWAY_SCOPE_MISMATCH", 403);
      return tx(a, async (client) => {
        const gateway = (
          await client.query(
            "SELECT * FROM homeauto_online.gateways WHERE household_id=$1 AND gateway_id=$2 AND revoked_at IS NULL",
            [a.household_id, a.gateway_id],
          )
        ).rows[0];
        if (!gateway) fail("GATEWAY_REVOKED", 403);
        const seen = (
          await client.query(
            "SELECT * FROM homeauto_online.gateway_inbox WHERE gateway_id=$1 AND (event_id=$2 OR sequence=$3)",
            [a.gateway_id, message.event_id, message.sequence],
          )
        ).rows[0];
        const now = await databaseNow(client);
        const response = {
          schema_version: 1,
          event_id: message.event_id,
          sequence: message.sequence,
          digest: message.digest,
          server_time: now.toISOString(),
          status: "accepted",
          commands: [],
        };
        if (seen) {
          if (
            seen.event_id !== message.event_id ||
            seen.digest !== message.digest
          )
            fail("GATEWAY_REPLAY_CONFLICT", 409);
          return { ...response, duplicate: true };
        }
        if (message.sequence <= Number(gateway.last_sequence))
          return { ...response, status: "stale" };
        const ticket = (
          await client.query(
            "UPDATE homeauto_online.gateway_tickets SET consumed=true WHERE ticket_id=$1 AND household_id=$2 AND gateway_id=$3 AND NOT consumed AND expires_at>now() RETURNING created_at",
            [message.ticket_id, a.household_id, a.gateway_id],
          )
        ).rows[0];
        if (!ticket) fail("EXCHANGE_TICKET_EXPIRED", 409);
        const transitAge = Math.max(0, now - new Date(ticket.created_at));
        await expire(client, a);
        if (gateway.catalog_digest !== hash(message.catalog)) {
          const prefix = "__sync_" + crypto.randomUUID();
          await client.query(
            "UPDATE homeauto_online.rooms SET name_key=$2||room_id WHERE household_id=$1",
            [a.household_id, prefix],
          );
          for (const r of message.catalog.rooms)
            await client.query(
              "INSERT INTO homeauto_online.rooms(household_id,room_id,name,name_key,sort_order,version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(household_id,room_id) DO UPDATE SET name=EXCLUDED.name,name_key=EXCLUDED.name_key,sort_order=EXCLUDED.sort_order,version=EXCLUDED.version",
              [
                a.household_id,
                r.id,
                r.name,
                r.name.toLowerCase(),
                r.sort_order,
                r.version,
              ],
            );
          for (const d of message.catalog.devices)
            await client.query(
              "INSERT INTO homeauto_online.devices(household_id,device_id,name,type,room_id,version) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(household_id,device_id) DO UPDATE SET name=EXCLUDED.name,room_id=EXCLUDED.room_id,version=EXCLUDED.version",
              [a.household_id, d.id, d.name, d.type, d.room_id, d.version],
            );
          await client.query(
            "DELETE FROM homeauto_online.rooms WHERE household_id=$1 AND NOT(room_id=ANY($2::text[]))",
            [a.household_id, message.catalog.rooms.map((r) => r.id)],
          );
          await client.query(
            "UPDATE homeauto_online.households SET name=$2,version=$3 WHERE household_id=$1",
            [
              a.household_id,
              message.catalog.home.name,
              message.catalog.home.version,
            ],
          );
          await event(client, a, "metadata_updated", {});
        }
        const previous = (
          await client.query(
            "SELECT * FROM homeauto_online.observations WHERE household_id=$1",
            [a.household_id],
          )
        ).rows;
        const history = (
          await client.query(
            "SELECT device_id,max(received_at) AS last_at FROM homeauto_online.observation_history WHERE household_id=$1 GROUP BY device_id",
            [a.household_id],
          )
        ).rows;
        let changed = false;
        for (const d of message.devices) {
          const old = previous.find((o) => o.device_id === d.id),
            reported =
              d.age_ms === null
                ? null
                : new Date(now.getTime() - d.age_ms - transitAge);
          const different =
            old?.reported_status !== d.reported_status ||
            canonical(old?.payload ?? null) !== canonical(d.payload);
          const board = message.boards[byId[d.id].board_id];
          const current =
            d.current &&
            d.age_ms + transitAge < (d.id === "sensor-gas" ? 10000 : 65000) &&
            board.online &&
            board.age_ms !== null &&
            board.age_ms + transitAge <= 60000;
          const sameTime =
            (old?.reported_at &&
              reported &&
              Math.abs(new Date(old.reported_at) - reported) < 500) ||
            (!old?.reported_at && !reported);
          if (
            !old ||
            different ||
            !sameTime ||
            old.epoch !== message.epoch ||
            old.current_report !== !!current ||
            old.retained !== d.retained ||
            old.board_online !== d.board_online
          )
            await client.query(
              "INSERT INTO homeauto_online.observations(household_id,device_id,gateway_id,epoch,sequence,reported_status,reported_at,current_report,retained,board_online,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) ON CONFLICT(household_id,device_id) DO UPDATE SET gateway_id=EXCLUDED.gateway_id,epoch=EXCLUDED.epoch,sequence=EXCLUDED.sequence,reported_status=EXCLUDED.reported_status,reported_at=EXCLUDED.reported_at,current_report=EXCLUDED.current_report,retained=EXCLUDED.retained,board_online=EXCLUDED.board_online,payload=EXCLUDED.payload,received_at=now()",
              [
                a.household_id,
                d.id,
                a.gateway_id,
                message.epoch,
                message.sequence,
                d.reported_status,
                reported,
                !!current,
                d.retained,
                d.board_online,
                JSON.stringify(d.payload),
              ],
            );
          if (different) {
            changed = changed || old?.reported_status !== d.reported_status;
            const last = history.find((h) => h.device_id === d.id)?.last_at;
            if (
              old?.reported_status !== d.reported_status ||
              !last ||
              now - new Date(last) >= 60000
            )
              await client.query(
                "INSERT INTO homeauto_online.observation_history(household_id,device_id,sequence,reported_status,reported_at,payload) VALUES($1,$2,$3,$4,$5,$6::jsonb)",
                [
                  a.household_id,
                  d.id,
                  message.sequence,
                  d.reported_status,
                  reported,
                  JSON.stringify(d.payload),
                ],
              );
          }
        }
        for (const alert of message.alerts)
          await client.query(
            "INSERT INTO homeauto_online.alerts(household_id,alert_id,device_id,kind,severity,state,opened_at,last_seen_at,resolved_at,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(household_id,alert_id) DO UPDATE SET state=EXCLUDED.state,last_seen_at=EXCLUDED.last_seen_at,resolved_at=EXCLUDED.resolved_at,version=EXCLUDED.version WHERE homeauto_online.alerts.version<=EXCLUDED.version",
            [
              a.household_id,
              alert.id,
              alert.device_id,
              alert.kind,
              alert.severity,
              alert.state,
              alert.opened_at,
              alert.last_seen_at,
              alert.resolved_at,
              alert.version,
            ],
          );
        const receivedBoards = Object.fromEntries(
          Object.entries(message.boards).map(([id, b]) => [
            id,
            { ...b, age_ms: b.age_ms === null ? null : b.age_ms + transitAge },
          ]),
        );
        await client.query(
          "UPDATE homeauto_online.gateways SET epoch=$3,last_sequence=$4,last_seen_at=now(),mqtt_connected=$5,boards=$6::jsonb,catalog_digest=$7 WHERE household_id=$1 AND gateway_id=$2",
          [
            a.household_id,
            a.gateway_id,
            message.epoch,
            message.sequence,
            message.mqtt_connected,
            JSON.stringify(receivedBoards),
            hash(message.catalog),
          ],
        );
        for (const result of message.results) {
          const command = (
            await client.query(
              "SELECT * FROM homeauto_online.commands WHERE command_id=$1 AND household_id=$2 AND gateway_id=$3 AND lease_id=$4",
              [
                result.command_id,
                a.household_id,
                a.gateway_id,
                result.lease_id,
              ],
            )
          ).rows[0];
          if (!command) continue;
          if (command.state !== "pending_observation") continue;
          if (result.state === "pending_observation") continue;
          if (
            result.state === "observed" &&
            !message.devices.some(
              (d) =>
                d.id === command.device_id &&
                d.current &&
                !d.retained &&
                d.board_online &&
                message.mqtt_connected &&
                message.boards[byId[d.id].board_id].online &&
                message.boards[byId[d.id].board_id].age_ms !== null &&
                message.boards[byId[d.id].board_id].age_ms + transitAge <=
                  60000 &&
                d.age_ms !== null &&
                d.age_ms + transitAge < 65000 &&
                d.reported_status === command.action,
            )
          )
            continue;
          await client.query(
            "UPDATE homeauto_online.commands SET state=$2,error_code=$3,observed_at=CASE WHEN $2='observed' THEN now() ELSE NULL END,finished_at=now() WHERE command_id=$1",
            [command.command_id, result.state, result.error_code],
          );
          await event(
            client,
            a,
            "command_" + result.state,
            { command_id: command.command_id, state: result.state },
            command.device_id,
          );
        }
        await client.query(
          "INSERT INTO homeauto_online.gateway_inbox(household_id,gateway_id,event_id,sequence,digest) VALUES($1,$2,$3,$4,$5)",
          [
            a.household_id,
            a.gateway_id,
            message.event_id,
            message.sequence,
            message.digest,
          ],
        );
        if (message.sequence % 150 === 0)
          await fn(client, "prune_household", [a.household_id]);
        if (
          changed ||
          gateway.mqtt_connected !== message.mqtt_connected ||
          gateway.epoch !== message.epoch
        )
          await event(client, a, "gateway_report", {
            gateway_id: a.gateway_id,
            sequence: message.sequence,
            epoch: message.epoch,
          });
        const pending = (
          await client.query(
            "SELECT * FROM homeauto_online.commands WHERE household_id=$1 AND state='queued' AND expires_at>now() ORDER BY created_at LIMIT 4",
            [a.household_id],
          )
        ).rows;
        for (const command of pending) {
          const report = message.devices.find(
            (d) => d.id === command.device_id,
          );
          const board = message.boards.lights;
          if (
            !report?.current ||
            report.retained ||
            !report.board_online ||
            !message.mqtt_connected ||
            !board.online ||
            board.age_ms === null ||
            board.age_ms + transitAge > 60000 ||
            report.age_ms === null ||
            report.age_ms + transitAge >= 65000
          ) {
            await client.query(
              "UPDATE homeauto_online.commands SET state='rejected',error_code='DEVICE_UNAVAILABLE',finished_at=now() WHERE command_id=$1",
              [command.command_id],
            );
            await event(
              client,
              a,
              "command_rejected",
              { command_id: command.command_id, state: "rejected" },
              command.device_id,
            );
            continue;
          }
          if (
            !(await fn(client, "valid_controller", [
              command.actor_id,
              a.household_id,
              command.session_hash,
            ]))
          ) {
            await client.query(
              "UPDATE homeauto_online.commands SET state='rejected',error_code='AUTHORIZATION_REVOKED',finished_at=now() WHERE command_id=$1",
              [command.command_id],
            );
            await event(
              client,
              a,
              "command_rejected",
              { command_id: command.command_id },
              command.device_id,
            );
            continue;
          }
          const lease = crypto.randomUUID();
          await client.query(
            "UPDATE homeauto_online.commands SET state='delivered',gateway_id=$2,lease_id=$3,delivered_at=now() WHERE command_id=$1",
            [command.command_id, a.gateway_id, lease],
          );
          await event(
            client,
            a,
            "command_delivered",
            { command_id: command.command_id },
            command.device_id,
          );
          response.commands.push({
            command_id: command.command_id,
            device_id: command.device_id,
            action: command.action,
            lease_id: lease,
            expires_at: new Date(command.expires_at).toISOString(),
          });
        }
        return response;
      });
    },
    async redeem(a, id, lease) {
      return tx(a, async (c) => {
        await expire(c, a);
        const command = (
          await c.query(
            "SELECT * FROM homeauto_online.commands WHERE command_id=$1 AND household_id=$2 AND gateway_id=$3 AND lease_id=$4",
            [id, a.household_id, a.gateway_id, lease],
          )
        ).rows[0];
        if (!command) fail("NOT_FOUND", 404);
        if (command.state !== "delivered") fail("COMMAND_NOT_DELIVERABLE", 409);
        if (
          !allowCommands ||
          !(await fn(c, "valid_controller", [
            command.actor_id,
            a.household_id,
            command.session_hash,
          ]))
        ) {
          await c.query(
            "UPDATE homeauto_online.commands SET state='rejected',error_code='AUTHORIZATION_REVOKED',finished_at=now() WHERE command_id=$1",
            [id],
          );
          await event(
            c,
            a,
            "command_rejected",
            { command_id: id },
            command.device_id,
          );
          return { allowed: false };
        }
        await c.query(
          "UPDATE homeauto_online.commands SET state='pending_observation',redeemed_at=now() WHERE command_id=$1",
          [id],
        );
        await event(
          c,
          a,
          "command_pending_observation",
          { command_id: id },
          command.device_id,
        );
        const now = await databaseNow(c);
        return {
          allowed: true,
          command_id: id,
          device_id: command.device_id,
          action: command.action,
          lease_id: lease,
          server_time: now.toISOString(),
          expires_at: new Date(command.expires_at).toISOString(),
        };
      });
    },
    async preferences(a, value, version) {
      return tx(a, async (c) => {
        const old = (
          await c.query(
            "SELECT version FROM homeauto_online.preferences WHERE household_id=$1 AND user_id=$2",
            [a.household_id, a.user_id],
          )
        ).rows[0];
        if (version !== (old?.version || 0)) fail("VERSION_CONFLICT", 409);
        await c.query(
          "INSERT INTO homeauto_online.preferences(household_id,user_id,value,version) VALUES($1,$2,$3::jsonb,$4) ON CONFLICT(household_id,user_id) DO UPDATE SET value=EXCLUDED.value,version=EXCLUDED.version",
          [a.household_id, a.user_id, JSON.stringify(value), version + 1],
        );
        return { ...value, version: version + 1 };
      });
    },
    async receipt(a, id, action) {
      return tx(a, async (c) => {
        if (action === "acknowledge" && !["owner", "resident"].includes(a.role))
          fail("FORBIDDEN", 403);
        if (
          !(
            await c.query(
              "SELECT alert_id FROM homeauto_online.alerts WHERE household_id=$1 AND alert_id=$2",
              [a.household_id, id],
            )
          ).rows.length
        )
          fail("NOT_FOUND", 404);
        const column = action === "read" ? "read_at" : "acknowledged_at";
        return {
          receipt: (
            await c.query(
              `INSERT INTO homeauto_online.alert_receipts(household_id,alert_id,user_id,${column}) VALUES($1,$2,$3,now()) ON CONFLICT(household_id,alert_id,user_id) DO UPDATE SET ${column}=coalesce(homeauto_online.alert_receipts.${column},EXCLUDED.${column}) RETURNING read_at,acknowledged_at`,
              [a.household_id, id, a.user_id],
            )
          ).rows[0],
        };
      });
    },
    async events(
      a,
      {
        cursor = "0",
        limit = 30,
        category = "all",
        device_id,
        type,
        from,
        to,
        q,
      } = {},
    ) {
      return tx(a, async (c) => {
        await expire(c, a);
        const args = [a.household_id],
          where = ["household_id=$1"];
        if (cursor !== "0") {
          args.push(cursor);
          where.push("sequence<$" + args.length + "::bigint");
        }
        if (device_id) {
          args.push(device_id);
          where.push("device_id=$" + args.length);
        } else if (category !== "all") {
          const pattern =
            category === "lights"
              ? "light-%"
              : category === "doors"
                ? "door-%"
                : category === "sensors"
                  ? "sensor-%"
                  : null;
          if (pattern) {
            args.push(pattern);
            where.push("device_id LIKE $" + args.length);
          } else where.push("device_id IS NULL");
        }
        if (type) {
          args.push(type);
          where.push("type=$" + args.length);
        }
        for (const [key, value] of [
          ["from", from],
          ["to", to],
        ])
          if (value) {
            args.push(value);
            where.push(
              "created_at" +
                (key === "from" ? ">=" : "<=") +
                "$" +
                args.length +
                "::timestamptz",
            );
          }
        if (q) {
          args.push("%" + q + "%");
          where.push(
            "(type LIKE $" +
              args.length +
              " OR device_id LIKE $" +
              args.length +
              ")",
          );
        }
        args.push(limit + 1);
        const rows = (
          await c.query(
            "SELECT sequence,event_id,type,device_id,payload,created_at FROM homeauto_online.events WHERE " +
              where.join(" AND ") +
              " ORDER BY sequence DESC LIMIT $" +
              args.length,
            args,
          )
        ).rows;
        return {
          items: rows.slice(0, limit).map((r) => ({
            id: String(r.sequence),
            event_id: r.event_id,
            event_type: r.type,
            device_id: r.device_id,
            timestamp: r.created_at,
            details: r.payload,
            summary_key: r.type,
          })),
          next_cursor:
            rows.length > limit ? String(rows[limit - 1].sequence) : null,
        };
      });
    },
    async feed(a, cursor = "0") {
      return tx(a, async (c) => {
        const floor = String(
          (
            await c.query(
              "SELECT coalesce(min(sequence),0) AS floor FROM homeauto_online.events WHERE household_id=$1",
              [a.household_id],
            )
          ).rows[0].floor,
        );
        const rows = (
          await c.query(
            "SELECT sequence,event_id,type,device_id,payload,created_at FROM homeauto_online.events WHERE household_id=$1 AND sequence>$2::bigint ORDER BY sequence LIMIT 100",
            [a.household_id, cursor],
          )
        ).rows;
        return {
          schema_version: 1,
          source: "cloud",
          reset_required: cursor !== "0" && BigInt(cursor) < BigInt(floor),
          events: rows.map((r) => ({ ...r, sequence: String(r.sequence) })),
          next_cursor: rows.length ? String(rows.at(-1).sequence) : cursor,
          server_time: (await databaseNow(c)).toISOString(),
        };
      });
    },
    async diagnostics(a) {
      return tx(a, async (c) => {
        await expire(c, a);
        return {
          commands: (
            await c.query(
              "SELECT state,count(*)::int count FROM homeauto_online.commands WHERE household_id=$1 GROUP BY state",
              [a.household_id],
            )
          ).rows,
          mean_observed_ms: (
            await c.query(
              "SELECT avg(extract(epoch FROM (observed_at-created_at))*1000) AS latency FROM homeauto_online.commands WHERE household_id=$1 AND state='observed'",
              [a.household_id],
            )
          ).rows[0].latency,
        };
      });
    },
  };
}
module.exports = { createOnlineStore, commandDTO, event, expire, databaseNow };
