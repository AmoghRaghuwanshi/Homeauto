const { canonical, hash, validateCatalog } = require("../cloud/protocol");
const { uuid } = require("../lib/errors");
const { byId } = require("../lib/registry");
const { fail } = require("./db");
const exact = (v, keys) => {
  if (
    !v ||
    typeof v !== "object" ||
    Array.isArray(v) ||
    Object.keys(v).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(v, k))
  )
    fail("INVALID_GATEWAY_MESSAGE");
};
const boolean = (v) => {
  if (typeof v !== "boolean") fail("INVALID_GATEWAY_MESSAGE");
};
function validateExchange(input) {
  exact(input, [
    "schema_version",
    "event_id",
    "ticket_id",
    "gateway_id",
    "household_id",
    "sequence",
    "epoch",
    "catalog",
    "mqtt_connected",
    "boards",
    "devices",
    "alerts",
    "results",
    "digest",
  ]);
  if (input.schema_version !== 1) fail("UNSUPPORTED_GATEWAY_VERSION", 422);
  for (const field of [
    "event_id",
    "ticket_id",
    "gateway_id",
    "household_id",
    "epoch",
  ])
    if (!uuid(input[field]) || input[field] !== input[field].toLowerCase())
      fail("INVALID_GATEWAY_MESSAGE");
  if (!Number.isSafeInteger(input.sequence) || input.sequence < 1)
    fail("INVALID_GATEWAY_MESSAGE");
  try {
    validateCatalog(input.catalog);
  } catch {
    fail("INVALID_GATEWAY_CATALOG");
  }
  boolean(input.mqtt_connected);
  exact(input.boards, ["lights", "door"]);
  for (const b of Object.values(input.boards)) {
    exact(b, ["online", "age_ms"]);
    boolean(b.online);
    if (
      b.age_ms !== null &&
      (!Number.isSafeInteger(b.age_ms) || b.age_ms < 0 || b.age_ms > 86400000)
    )
      fail("INVALID_GATEWAY_MESSAGE");
  }
  if (
    !Array.isArray(input.devices) ||
    input.devices.length !== 7 ||
    new Set(input.devices.map((d) => d.id)).size !== 7
  )
    fail("INVALID_GATEWAY_MESSAGE");
  for (const d of input.devices) {
    exact(d, [
      "id",
      "reported_status",
      "age_ms",
      "current",
      "retained",
      "board_online",
      "payload",
    ]);
    if (!byId[d.id]) fail("INVALID_GATEWAY_MESSAGE");
    for (const k of ["current", "retained", "board_online"]) boolean(d[k]);
    if (
      d.age_ms !== null &&
      (!Number.isSafeInteger(d.age_ms) || d.age_ms < 0 || d.age_ms > 86400000)
    )
      fail("INVALID_GATEWAY_MESSAGE");
    const states =
      byId[d.id].type === "light"
        ? ["on", "off"]
        : d.id === "door-1"
          ? ["locked", "unlocked"]
          : d.id === "sensor-gas"
            ? ["normal", "alert"]
            : ["clear", "detected"];
    if (d.reported_status !== null && !states.includes(d.reported_status))
      fail("INVALID_DEVICE_REPORT");
    if (
      d.current &&
      (d.age_ms === null ||
        d.retained ||
        !d.board_online ||
        !input.mqtt_connected ||
        !input.boards[byId[d.id].board_id].online)
    )
      fail("INVALID_DEVICE_REPORT");
    if (d.payload !== null) {
      if (d.id === "sensor-gas") {
        exact(d.payload, ["raw", "gas_ppm", "alert"]);
        if (
          !Number.isInteger(d.payload.raw) ||
          d.payload.raw < 0 ||
          d.payload.raw > 4095 ||
          !Number.isFinite(d.payload.gas_ppm) ||
          d.payload.gas_ppm < 0 ||
          d.payload.gas_ppm > 1000
        )
          fail("INVALID_SENSOR_REPORT");
        boolean(d.payload.alert);
      } else if (d.id === "sensor-motion") {
        exact(d.payload, ["motion"]);
        boolean(d.payload.motion);
      } else fail("INVALID_SENSOR_REPORT");
    }
  }
  if (!Array.isArray(input.alerts) || input.alerts.length > 100)
    fail("INVALID_GATEWAY_MESSAGE");
  for (const a of input.alerts) {
    exact(a, [
      "id",
      "device_id",
      "kind",
      "severity",
      "state",
      "opened_at",
      "last_seen_at",
      "resolved_at",
      "version",
    ]);
    if (
      !uuid(a.id) ||
      !["sensor-gas", "sensor-motion"].includes(a.device_id) ||
      a.kind !== (a.device_id === "sensor-gas" ? "gas" : "motion") ||
      !["info", "warning", "critical"].includes(a.severity) ||
      !["active", "resolved"].includes(a.state) ||
      !Number.isInteger(a.version) ||
      a.version < 1
    )
      fail("INVALID_GATEWAY_MESSAGE");
    for (const k of ["opened_at", "last_seen_at", "resolved_at"])
      if (
        a[k] !== null &&
        (!Number.isFinite(Date.parse(a[k])) || typeof a[k] !== "string")
      )
        fail("INVALID_GATEWAY_MESSAGE");
  }
  if (!Array.isArray(input.results) || input.results.length > 32)
    fail("INVALID_GATEWAY_MESSAGE");
  for (const r of input.results) {
    exact(r, ["command_id", "lease_id", "state", "error_code"]);
    if (
      !uuid(r.command_id) ||
      !uuid(r.lease_id) ||
      ![
        "pending_observation",
        "observed",
        "failed",
        "rejected",
        "uncertain",
      ].includes(r.state) ||
      (r.error_code !== null && !/^[A-Z_]{1,64}$/.test(r.error_code))
    )
      fail("INVALID_GATEWAY_MESSAGE");
  }
  const { digest, ...body } = input;
  if (digest !== hash(body)) fail("DIGEST_MISMATCH");
  if (Buffer.byteLength(canonical(input)) > 65536) fail("BODY_TOO_LARGE", 413);
  return input;
}
module.exports = { exact, canonical, hash, validateExchange };
