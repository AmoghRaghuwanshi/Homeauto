const { createOnlineApp } = require("../server/online/app");
const {
  loadOnlineConfig,
  assertOnlineRole,
  createPool,
  OnlineError,
} = require("../server/online/db");
let pool, application;
async function initialize() {
  if (!application) {
    application = (async () => {
      const config = loadOnlineConfig();
      if (!pool) {
        pool = createPool(process.env.DATABASE_URL);
        require("@vercel/functions").attachDatabasePool(pool);
      }
      await assertOnlineRole(pool);
      return createOnlineApp({ pool, config });
    })().catch((error) => {
      application = null;
      throw error;
    });
  }
  return application;
}
function restoreRoute(req) {
  const url = new URL(req.url, "https://localhost");
  const routed = url.searchParams.get("__route");
  if (routed !== null) {
    if (!/^[A-Za-z0-9_\/-]*$/.test(routed) || routed.includes(".."))
      throw new OnlineError("NOT_FOUND", 404);
    url.searchParams.delete("__route");
    req.url =
      "/api/" +
      routed +
      (url.searchParams.size ? "?" + url.searchParams.toString() : "");
  }
}
function normalizePlatformBody(req) {
  if (req.body === undefined) return;
  const raw = Buffer.isBuffer(req.body)
    ? req.body.toString("utf8")
    : typeof req.body === "string"
      ? req.body
      : JSON.stringify(req.body);
  if (Buffer.byteLength(raw || "") > 65536)
    throw new OnlineError("BODY_TOO_LARGE", 413);
  if (/^application\/json(?:;|$)/i.test(req.headers["content-type"] || "")) {
    try {
      const value =
        typeof req.body === "string" || Buffer.isBuffer(req.body)
          ? JSON.parse(raw)
          : req.body;
      if (value === null || typeof value !== "object")
        throw new Error("JSON object required");
      req.body = value;
    } catch {
      throw new OnlineError("INVALID_JSON", 400);
    }
    // Vercel may consume/parse the stream before Express. Do not read it twice.
    req._body = true;
  }
}
async function handler(req, res) {
  try {
    restoreRoute(req);
    normalizePlatformBody(req);
    const app = await initialize();
    return app(req, res);
  } catch (error) {
    const known = error instanceof OnlineError;
    const status = known ? error.status : 503;
    const code = known ? error.code : "CLOUD_UNAVAILABLE";
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.statusCode = status;
    res.end(
      JSON.stringify({
        mode: "cloud",
        error: {
          code,
          message: known
            ? error.message
            : "HomeAuto could not connect. Try again.",
          retryable: status >= 500,
        },
      }),
    );
    console.error(
      JSON.stringify({ event: "cloud_initialization_failed", code, status }),
    );
  }
}
module.exports = handler;
module.exports.restoreRoute = restoreRoute;
module.exports.normalizePlatformBody = normalizePlatformBody;
