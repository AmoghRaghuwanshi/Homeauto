const express = require("express");
const http = require("http");
const path = require("path");
const { onlineFixture } = require("./online-fixture");
const { createOnlineApp } = require("../../online/app");
const { createRepository } = require("../../db/repository");
const { Home } = require("../../services/home");
const { createGatewayWorker } = require("../../online/gateway");
async function createOnlinePreview({
  allowCommands = true,
  autoObserve = true,
  startGateway = true,
  databaseFixture = null,
} = {}) {
  const database = databaseFixture || (await onlineFixture());
  const config = {
    origins: new Set(),
    secure: false,
    allowCommands,
    simulation: true,
  };
  const api = createOnlineApp({
    pool: database.pool,
    config,
    logger: { info: () => {} },
  });
  const frontend = express();
  const securityHeaders = require("../../../vercel.json").headers.find(
    (rule) => rule.source === "/(.*)",
  ).headers;
  frontend.use((req, res, next) => {
    for (const header of securityHeaders) res.set(header.key, header.value);
    next();
  });
  let cloudUnavailable = false;
  frontend.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    if (cloudUnavailable)
      return res.status(503).json({
        mode: "cloud",
        error: {
          code: "CLOUD_UNAVAILABLE",
          message: "Synthetic cloud outage",
          retryable: true,
        },
      });
    api(req, res, next);
  });
  frontend.get("/__qa/axe.js", (req, res) =>
    res.sendFile(require.resolve("axe-core")),
  );
  frontend.use(
    express.static(path.join(__dirname, "../../../public"), { index: false }),
  );
  frontend.get("*", (req, res) => {
    if (path.extname(req.path)) return res.sendStatus(404);
    res.sendFile(path.join(__dirname, "../../../public/index.html"));
  });
  const server = http.createServer(frontend);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = "http://127.0.0.1:" + server.address().port;
  config.origins.add(url);
  const gatewayConfig = {
    householdId: database.household,
    gatewayId: database.gateway,
    token: database.token,
    origin: "https://synthetic-cloud.invalid",
    allowLights: true,
  };
  const repo = await createRepository({ gateway: gatewayConfig });
  const publications = [];
  const home = new Home(repo, { simulation: true });
  let broker = true;
  const boards = { lights: true, door: true };
  home.publisher = (topic, payload, options, callback) => {
    publications.push({ topic, payload, options });
    callback(null);
    if (autoObserve)
      setTimeout(() => {
        if (!closed)
          home.ingest(
            topic.replace("/command", "/status"),
            Buffer.from(payload),
          );
      }, 100).unref();
  };
  let closed = false;
  function report() {
    if (!broker) return;
    for (const [board, online] of Object.entries(boards))
      home.ingest(
        "home/esp32/" + board + "/online",
        Buffer.from(String(online)),
      );
    if (boards.lights) {
      for (let i = 1; i <= 4; i++) {
        const d = home.device("light-" + i);
        home.ingest(
          "home/light/" + i + "/status",
          Buffer.from(d.observation.reported_status === "on" ? "on" : "off"),
        );
      }
      const gas = repo.one(
        "SELECT payload_json FROM sensor_latest WHERE device_id='sensor-gas'",
      );
      home.ingest(
        "home/sensor/gas/data",
        Buffer.from(
          gas?.payload_json || '{"raw":200,"gas_ppm":49,"alert":false}',
        ),
      );
      const motion = repo.one(
        "SELECT payload_json FROM sensor_latest WHERE device_id='sensor-motion'",
      );
      home.ingest(
        "home/sensor/motion/data",
        Buffer.from(motion?.payload_json || '{"motion":false}'),
      );
    }
    if (boards.door)
      home.ingest(
        "home/door/1/status",
        Buffer.from(
          home.device("door-1").observation.reported_status === "unlocked"
            ? "unlocked"
            : "locked",
        ),
      );
  }
  home.setConnected(true);
  report();
  const worker = createGatewayWorker(home, gatewayConfig, {
    fetchImpl: (endpoint, options) =>
      fetch(endpoint.replace(gatewayConfig.origin, url), options),
  });
  await worker.runOnce();
  if (startGateway) worker.start();
  const timer = setInterval(report, 5000);
  timer.unref();
  return {
    url,
    database,
    repo,
    home,
    worker,
    publications,
    api,
    config,
    credentials: {
      username: database.username || "cloud-owner",
      password: database.password,
    },
    setCloudUnavailable(value) {
      cloudUnavailable = value;
    },
    setBroker(value) {
      broker = value;
      home.setConnected(value);
      if (value) report();
    },
    setBoard(id, value) {
      boards[id] = value;
      report();
    },
    async pulse() {
      report();
      await worker.runOnce();
    },
    async stop() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      worker.stop();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      repo.close();
      await database.close();
    },
  };
}
module.exports = { createOnlinePreview };
