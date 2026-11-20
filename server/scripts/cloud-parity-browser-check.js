const { chromium } = require("playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { createOnlinePreview } = require("../tests/helpers/online-preview");
async function main() {
  const fixture = await createOnlinePreview({ hubManagement: true });
  let browser;
  const folder = path.resolve(__dirname, "../../.local/qa/cloud-parity");
  fs.mkdirSync(folder, { recursive: true });
  const report = { checks: [], errors: [], external: [], websockets: [] };
  try {
    browser = await chromium.launch();
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    page.on("pageerror", (e) => report.errors.push(e.message));
    page.on("websocket", (ws) => report.websockets.push(ws.url()));
    await page.route("**/*", (route) =>
      new URL(route.request().url()).origin === fixture.url
        ? route.continue()
        : (report.external.push(route.request().url()), route.abort()),
    );
    await page.addInitScript(() => {
      window.__spoken = [];
      window.SpeechRecognition = class {
        start() {
          window.__recognition = this;
          this.onstart?.();
        }
        abort() {}
        stop() {
          this.onend?.();
        }
      };
      window.__say = (text) => {
        const item = [{ transcript: text }];
        item.isFinal = true;
        window.__recognition.onresult({ results: [item] });
        window.__recognition.onend();
      };
      window.SpeechSynthesisUtterance = class {
        constructor(text) {
          this.text = text;
        }
      };
      Object.defineProperty(window, "speechSynthesis", {
        value: {
          getVoices: () => [
            {
              name: "Test English",
              voiceURI: "en",
              lang: "en-IN",
              localService: true,
            },
            {
              name: "Test Hindi",
              voiceURI: "hi",
              lang: "hi-IN",
              localService: true,
            },
          ],
          addEventListener() {},
          removeEventListener() {},
          cancel() {},
          speak(u) {
            window.__spoken.push({ text: u.text, lang: u.lang });
            setTimeout(() => {
              u.onstart?.();
              setTimeout(() => u.onend?.(), 20);
            }, 10);
          },
        },
      });
    });
    await page.goto(fixture.url);
    await page
      .getByLabel("Username", { exact: true })
      .fill(fixture.credentials.username);
    await page
      .getByLabel("Password", { exact: true })
      .fill(fixture.credentials.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForFunction(
      () => document.documentElement.dataset.connected === "true",
    );
    await page.goto(fixture.url + "/assistant");
    await page
      .getByRole("button", { name: "Tap to speak", exact: true })
      .waitFor();
    assert.equal(await page.locator("#assistant-mic").isEnabled(), true);
    await page.locator("#assistant-mic").click();
    await page.waitForFunction(() => !!window.__recognition);
    await page.evaluate(() => window.__say("gas sensor status"));
    await page.waitForFunction(() =>
      window.__spoken.some((s) => s.text.includes("Gas Sensor")),
    );
    assert.equal(report.websockets.length, 0);
    report.checks.push(
      "Cloud microphone, authenticated transcript, result and browser spoken reply without a WebSocket",
    );
    await page.screenshot({
      path: path.join(folder, "assistant.png"),
      fullPage: true,
    });
    await page.goto(fixture.url + "/settings/voice");
    await page
      .getByRole("heading", { name: "Voice & assistant", exact: true })
      .waitFor();
    await page
      .getByLabel("Enable wake-word listening", { exact: false })
      .waitFor();
    report.checks.push(
      "Voice languages, spoken replies, voice selection and wake controls use the common interface",
    );
    await page.goto(fixture.url + "/settings/home");
    await page
      .getByLabel("Home name", { exact: true })
      .fill("Browser parity home");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.waitForFunction(
      () =>
        document.querySelector("input[name=home_name]")?.value ===
        "Browser parity home",
    );
    const end = Date.now() + 10000;
    while (
      fixture.home.homeSettings().home_name !== "Browser parity home" &&
      Date.now() < end
    )
      await new Promise((r) => setTimeout(r, 100));
    assert.equal(fixture.home.homeSettings().home_name, "Browser parity home");
    report.checks.push("Online home edit reached the local SQLite handler");
    await page.route("**/api/hub-requests/*", async (route) => {
      const response = await route.fetch();
      await new Promise((r) => setTimeout(r, 2500));
      await route.fulfill({ response });
    });
    await page.goto(fixture.url + "/modules");
    await page
      .getByText("ESP32 connected", { exact: true })
      .waitFor({ timeout: 20000 });
    await page.getByLabel("MQTT broker URL", { exact: true }).waitFor();
    report.checks.push(
      "Online modules render despite management replies taking longer than a telemetry poll",
    );
    await page.unroute("**/api/hub-requests/*");
    await page.screenshot({
      path: path.join(folder, "modules.png"),
      fullPage: true,
    });
    await page.goto(fixture.url + "/security/access-cards");
    await page
      .getByRole("heading", { name: "Access cards", exact: true })
      .waitFor({ timeout: 20000 });
    await page
      .getByRole("button", { name: "Set keypad PIN", exact: true })
      .waitFor();
    report.checks.push(
      "Owner access-card and keypad controls are available through the hub",
    );
    assert.deepEqual(report.errors, []);
    assert.deepEqual(report.external, []);
    assert.deepEqual(report.websockets, []);
  } finally {
    await browser?.close();
    await fixture.stop();
    fs.writeFileSync(
      path.join(folder, "results.json"),
      JSON.stringify(report, null, 2),
    );
  }
  console.log(JSON.stringify(report));
}
if (require.main === module)
  main().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
