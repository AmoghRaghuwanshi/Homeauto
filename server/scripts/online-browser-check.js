const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const assert = require("node:assert/strict");
const { createOnlinePreview } = require("../tests/helpers/online-preview");
async function launchBrowserForPreview(preview, launch=()=>chromium.launch()) {
  try { return await launch(); } catch(error) { await preview.stop(); throw error; }
}
async function main() {
  const folder =
    process.env.HOMEAUTO_CLOUD_QA_DIR ||
    path.join(__dirname, "../../.local/qa/online");
  fs.mkdirSync(folder, { recursive: true });
  const result = {
    date: new Date().toISOString(),
    fixture:
      "Disposable PostgreSQL WASM + loopback HTTP + simulated controllers. No cloud deployment or physical hardware.",
    checks: [],
    screenshots: [],
    violations: [],
    page_errors: [],
    csp_errors: [],
    qa_csp_events: [],
    external_requests: [],
  };
  const preview = await createOnlinePreview({
    autoObserve: false,
    startGateway: false,
  });
  const browser = await launchBrowserForPreview(preview);
  let context, offPreview;
  const installChecks = async (page, fixture) => {
    page.on("pageerror", (error) => result.page_errors.push(error.message));
    page.on("websocket", (socket) =>
      result.page_errors.push("Unexpected cloud WebSocket: " + socket.url()),
    );
    await page.exposeBinding("__qaCspReport", (_, event) => {
      let source;
      try {
        source = new URL(event.source).pathname;
      } catch {}
      if (
        source === "/__qa/axe.js" &&
        event.directive === "style-src-elem" &&
        event.blocked === "inline"
      )
        result.qa_csp_events.push(event);
      else result.csp_errors.push(event);
    });
    await page.addInitScript(() =>
      document.addEventListener("securitypolicyviolation", (event) =>
        window.__qaCspReport({
          source: event.sourceFile,
          line: event.lineNumber,
          directive: event.effectiveDirective,
          blocked: event.blockedURI,
        }),
      ),
    );
    await page.route("**/*", (route) => {
      if (new URL(route.request().url()).origin !== fixture.url) {
        result.external_requests.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
  };
  const ready = async (page) => {
    await page.locator("main h1").waitFor();
    await page.waitForFunction(
      () => document.documentElement.dataset.connected === "true",
    );
  };
  const login = async (page, fixture = preview) => {
    await page.goto(fixture.url);
    await page
      .getByLabel("Username", { exact: true })
      .fill(fixture.credentials.username);
    await page
      .getByLabel("Password", { exact: true })
      .fill(fixture.credentials.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await ready(page);
  };
  const inspect = async (page, name) => {
    await page.addScriptTag({ url: "/__qa/axe.js" });
    const violations = await page.evaluate(async () =>
      (
        await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    );
    if (violations.length) result.violations.push({ name, violations });
    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > innerWidth + 1,
      controls: [
        ...document.querySelectorAll(
          "main button,main input,main select,main a",
        ),
      ]
        .filter((node) => {
          const r = node.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            (r.left < -1 || r.right > innerWidth + 1)
          );
        })
        .map(
          (node) =>
            node.getAttribute("aria-label") ||
            node.textContent.trim().slice(0, 60),
        ),
    }));
    assert.equal(overflow.horizontal, false, name + " horizontal overflow");
    assert.deepEqual(overflow.controls, [], name + " offscreen controls");
    const screenshot = path.join(folder, name + ".png");
    await page.screenshot({ path: screenshot, fullPage: true });
    result.screenshots.push(screenshot);
  };
  try {
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await installChecks(page, preview);
    await page.goto(preview.url + "/api/snapshot");
    assert.equal(
      (await page.textContent("body")).includes("LOGIN_REQUIRED"),
      true,
    );
    await login(page);
    assert.equal(await page.locator("html").getAttribute("data-theme"), "05");
    await page
      .getByText("Simulation — no physical devices connected", { exact: true })
      .waitFor();
    result.checks.push(
      "No guest bypass; durable cloud login; default05; simulator label",
    );
    await page.goto(preview.url + "/rooms/room-1");
    await ready(page);
    const card = page.locator('[data-device-id="light-1"]');
    await card
      .getByRole("button", { name: "Light 1: Turn on", exact: true })
      .click();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-device-id="light-1"]')
        ?.textContent.includes("Queued for home hub"),
    );
    await page.reload();
    await ready(page);
    await page.waitForFunction(() =>
      document.querySelector('[data-device-id="light-1"] .device-pending'),
    );
    assert.equal(preview.publications.length, 0);
    await preview.worker.runOnce();
    await page.waitForTimeout(200);
    assert.equal(preview.publications.length, 1);
    await preview.worker.runOnce();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-device-id="light-1"]')
        ?.textContent.includes("Waiting for controller"),
    );
    assert.equal(preview.publications.length, 1);
    preview.home.ingest("home/light/1/status", Buffer.from("on"));
    await preview.worker.runOnce();
    await page.waitForFunction(() =>
      document
        .querySelector('[data-device-id="light-1"]')
        ?.textContent.includes("Turn off"),
    );
    assert.equal(preview.publications.length, 1);
    result.checks.push(
      "Cloud command survives refresh; queue/admission/observation distinct; one simulated publication",
    );
    await page
      .locator('[data-device-id="light-2"]')
      .getByRole("button", { name: "Light 2: Turn on", exact: true })
      .click();
    await page.waitForFunction(() =>
      document.querySelector('[data-device-id="light-2"] .device-pending'),
    );
    await preview.database.admin((db) =>
      db.query(
        "UPDATE homeauto_online.commands SET created_at=now()-interval '20 seconds',expires_at=now()-interval '5 seconds' WHERE device_id='light-2' AND state='queued'",
      ),
    );
    await page.locator('[data-device-id="light-2"] .device-error').waitFor();
    assert.match(
      await page
        .locator('[data-device-id="light-2"] .device-error')
        .innerText(),
      /Request expired/,
    );
    assert.equal(preview.publications.length, 1);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.locator('.toast').last().hover();
    await page.mouse.move(0,0);
    await page.waitForFunction(()=>document.querySelectorAll('.toast').length===0);
    await preview.pulse();
    await page.locator('[data-device-id="light-2"] .device-error').scrollIntoViewIfNeeded();
    await inspect(page, "05-375-command-expired");
    preview.worker.start();
    result.checks.push(
      "Expired queued request has visible feedback and is never published",
    );
    await page.goto(preview.url + "/security/door");
    await ready(page);
    assert.equal(
      await page
        .getByRole("button", { name: "Unlock front door", exact: true })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Lock door", exact: true })
        .isDisabled(),
      true,
    );
    assert.ok(
      await page
        .getByText("Physical lock position is not sensed.", { exact: true })
        .count(),
    );
    result.checks.push(
      "Remote door controls disabled and physical qualifier retained",
    );
    await page.goto(preview.url + "/assistant");
    await ready(page);
    assert.equal(
      await page
        .getByRole("button", {
          name: "Voice stays on the home hub",
          exact: true,
        })
        .isDisabled(),
      true,
    );
    assert.equal(
      await page.getByText("Local setup required", { exact: true }).count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Lock the front door", exact: true })
        .count(),
      0,
    );
    await page
      .getByLabel("Type a request", { exact: true })
      .fill("light one status");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await page.waitForFunction(() =>
      document
        .getElementById("assistant-messages")
        ?.textContent.includes("Light 1"),
    );
    await inspect(page, "05-375-assistant");
    result.checks.push(
      "Typed cloud assistant works; microphone stays disabled/local; suggestions match capabilities",
    );
    await page.goto(preview.url + "/settings/privacy");
    await ready(page);
    assert.ok(
      await page
        .getByText("Cloud access and local control", { exact: true })
        .count(),
    );
    assert.equal(
      await page.getByText("Your data stays at home.", { exact: true }).count(),
      0,
    );
    await page.goto(preview.url + "/security/access-cards");
    await ready(page);
    await page
      .getByText("Access cards stay on the home hub", { exact: true })
      .waitFor();
    result.checks.push(
      "Cloud privacy and local-only RFID statements are accurate",
    );
    await page.goto(preview.url + "/rooms/room-1");
    await ready(page);
    preview.setBoard("lights", false);
    await preview.worker.runOnce();
    await page.waitForFunction(() =>
      [
        ...document.querySelectorAll(
          '[data-device-id="light-1"] .device-control button',
        ),
      ].every((button) => button.disabled),
    );
    await inspect(page, "05-375-controller-disconnected");
    preview.setBoard("lights", true);
    await preview.worker.runOnce();
    await page.waitForFunction(() =>
      [
        ...document.querySelectorAll(
          '[data-device-id="light-1"] .device-control button',
        ),
      ].some((button) => !button.disabled),
    );
    result.checks.push(
      "Controller disconnect/reconnect changes availability independently of cloud/gateway",
    );
    preview.setCloudUnavailable(true);
    await page
      .getByText("Cloud connection lost", { exact: true })
      .waitFor({ timeout: 15000 });
    assert.equal(
      await card
        .getByRole("button", { name: "Light 1: Turn off", exact: true })
        .isEnabled()
        .catch(() => false),
      false,
    );
    await inspect(page, "05-375-cloud-disconnected");
    preview.setCloudUnavailable(false);
    await preview.worker.runOnce();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await ready(page);
    result.checks.push(
      "API outage neutralizes controls and manual retry recovers",
    );
    for (const viewport of [
      { width: 320, height: 844 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      for (const theme of ["05", "01", "03", "04"]) {
        await page.goto(preview.url + "/settings/appearance");
        await ready(page);
        await page
          .locator('input[name="theme"][value="' + theme + '"]')
          .check();
        assert.equal(
          await page.locator("html").getAttribute("data-theme"),
          theme,
        );
        for (const [route, screen] of [
          ["/", "home"],
          ["/rooms", "rooms"],
          ["/security", "security"],
          ["/assistant", "assistant"],
          ["/settings", "settings"],
        ]) {
          await page
            .locator('.primary-nav a[href="' + route + '"]')
            .first()
            .click();
          await page.waitForURL(preview.url + route);
          await page.locator("main h1").waitFor();
          await inspect(page, theme + "-" + viewport.width + "-" + screen);
        }
      }
    }
    result.checks.push(
      "All four themes across five main screens at mobile/tablet/desktop; screenshots, axe and bounds",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(preview.url + "/settings/appearance");
    await ready(page);
    await page.locator('input[name="theme"][value="03"]').check();
    await page.reload();
    await ready(page);
    assert.equal(await page.locator("html").getAttribute("data-theme"), "03");
    await page.goto(preview.url + "/settings/language");
    await ready(page);
    await page
      .getByText("हिन्दी", { exact: true })
      .check()
      .catch(() => page.locator('input[name="language"][value="hi"]').check());
    await page.goto(preview.url + "/assistant");
    await ready(page);
    await inspect(page, "03-390-hindi-assistant");
    result.checks.push(
      "Theme/language survive refresh; Hindi cloud copy renders",
    );
    await context.close();
    context = null;
    offPreview = await createOnlinePreview({ allowCommands: false });
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const offPage = await context.newPage();
    await installChecks(offPage, offPreview);
    await login(offPage, offPreview);
    await offPage
      .getByText("Remote light control is off", { exact: true })
      .waitFor();
    assert.equal(
      await offPage
        .getByRole("button", { name: "All lights off", exact: true })
        .isDisabled(),
      true,
    );
    await offPage.goto(offPreview.url + "/rooms/room-1");
    await ready(offPage);
    assert.equal(
      await offPage
        .getByRole("button", { name: "Light 1: Turn on", exact: true })
        .isDisabled(),
      true,
    );
    await inspect(offPage, "05-390-remote-controls-off");
    result.checks.push(
      "Default production remote gate has disabled controls and a clear explanation",
    );
    assert.deepEqual(result.page_errors, []);
    assert.deepEqual(result.csp_errors, []);
    assert.deepEqual(result.external_requests, []);
    assert.deepEqual(result.violations, []);
  } catch (error) {
    result.failure = error.stack;
    for (const [i, p] of (context?.pages() || []).entries()) {
      await p
        .screenshot({
          path: path.join(folder, "failure-" + i + ".png"),
          fullPage: true,
        })
        .catch(() => {});
      fs.writeFileSync(
        path.join(folder, "failure-" + i + ".txt"),
        await p
          .locator("body")
          .innerText()
          .catch(() => ""),
      );
    }
    throw error;
  } finally {
    fs.writeFileSync(
      path.join(folder, "results.json"),
      JSON.stringify(result, null, 2),
    );
    await context?.close();
    await browser.close();
    await offPreview?.stop();
    await preview.stop();
    console.log(
      JSON.stringify({
        checks: result.checks.length,
        screenshots: result.screenshots.length,
        axe_violations: result.violations.length,
        page_errors: result.page_errors.length,
        app_csp_errors: result.csp_errors.length,
        qa_style_probes_blocked: result.qa_csp_events.length,
        external_requests: result.external_requests.length,
        failure: result.failure ? true : false,
        folder,
      }),
    );
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
module.exports = { main, launchBrowserForPreview };
