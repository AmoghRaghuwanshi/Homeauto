const http = require("node:http"),
  https = require("node:https"),
  fs = require("node:fs");
const { allowed } = require("./hub-relay");
function createHubHandler({ sessions, config, getServer }) {
  return async (task) => {
    if (
      !task ||
      task.expires < Date.now() ||
      !allowed(task.request?.method, task.request?.path)
    )
      throw Error("Invalid hub request");
    const session = await sessions.importGatewayActor(task.actor);
    try {
      if (task.expires < Date.now()) throw Error('Hub admission expired');
      const server = getServer(),
        secure = !!server.setSecureContext,
        port = server.address().port,
        origin = `${secure ? "https" : "http"}://127.0.0.1:${port}`;
      const body =
        task.request.method === "GET"
          ? null
          : JSON.stringify(task.request.body);
      return await new Promise((resolve, reject) => {
        const req = (secure ? https : http).request(
          origin + task.request.path,
          {
            method: task.request.method,
            ...(secure ? { ca: fs.readFileSync(config.CERT_PATH) } : {}),
            headers: {
              Cookie: `${sessions.cookieName()}=${session.token}`,
              Origin: origin,
              "Content-Type": "application/json",
              "X-CSRF-Token": session.csrf_token,
              ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
            },
          },
          (res) => {
            const chunks = [];
            let size = 0;
            res.on("data", (chunk) => {
              size += chunk.length;
              if (size > 140000) req.destroy(Error("Hub response too large"));
              else chunks.push(chunk);
            });
            res.on("error", reject);
            res.on("end", () => {
              try {
                const bytes = Buffer.concat(chunks);
                resolve({
                  status: res.statusCode,
                  body: res.headers["content-type"]?.includes(
                    "application/json",
                  )
                    ? JSON.parse(bytes)
                    : {
                        base64: bytes.toString("base64"),
                        content_type: res.headers["content-type"],
                      },
                });
              } catch (e) {
                reject(e);
              }
            });
          },
        );
        req.setTimeout(5000, () => req.destroy(Error("Hub request timeout")));
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
      });
    } finally {
      sessions.logout(session.token);
    }
  };
}
module.exports = { createHubHandler };
