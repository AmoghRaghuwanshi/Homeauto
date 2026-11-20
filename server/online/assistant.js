const crypto = require("node:crypto");
const { fields, text, uuid } = require("../lib/errors");
const { fail, OnlineError } = require("./db");
const { resolveCommand, detectWakeWord } = require("../voice/intent");
const { dialogueKind, dialogueText } = require("../voice/dialogue");
const { inputLanguage } = require("../../public/js/assistant-language");
function facade(snapshot, config) {
  return {
    repo: { getDevices: () => snapshot.devices },
    allowDoor: !!config.allowDoor,
  };
}
function queryText(devices, language) {
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
  return devices
    .map(
      (d) =>
        `${d.name}: ${d.observation.freshness !== "current" ? (language === "hi" ? "स्थिति उपलब्ध नहीं है" : "status unavailable") : language === "hi" ? "कंट्रोलर की रिपोर्ट: " + labels[d.observation.reported_status] : "Controller reports " + d.observation.reported_status}${d.id === 'sensor-gas' && d.observation.freshness === 'current' && Number.isFinite(d.latest?.gas_ppm) ? language === 'hi' ? `। कंट्रोलर का गैस अनुमान ${d.latest.gas_ppm} पीपीएम है।` : `. Controller gas estimate: ${d.latest.gas_ppm} ppm.` : ''}${d.type === "door" ? " " + (language === "hi" ? "वास्तविक लॉक की स्थिति मापी नहीं जाती।" : "Physical lock position is not sensed.") : ""}`,
    )
    .join(". ");
}
function installOnlineAssistant(app, { store, config, route }) {
  app.post(
    "/api/assistant/interpret",
    route(async (req, res) => {
      fields(req.body, ["text", "language", "wake_required"], ["text"]);
      const language = req.body.language || "auto";
      if (
        !["auto", "en", "hi"].includes(language) ||
        (req.body.wake_required !== undefined &&
          typeof req.body.wake_required !== "boolean")
      )
        fail("VALIDATION_ERROR");
      const input = text(req.body.text, 500);
      if (req.body.wake_required && !detectWakeWord(input).found)
        fail("WAKE_PHRASE_REQUIRED", 422);
      const snapshot = await store.snapshot(req.actor),
        parsed = resolveCommand(input, snapshot.devices, snapshot.rooms, []);
      const reply = dialogueKind(input, parsed);
      if (reply) {
        parsed.ok = true;
        parsed.intent = {
          kind: "conversation",
          action: "reply",
          reply_key: reply,
          device_ids: [],
          sensitive: false,
        };
      }
      if (!parsed.ok) fail("INTENT_" + parsed.reason.toUpperCase(), 422);
      parsed.intent.reply_language = inputLanguage(input, language);
      parsed.intent.language = parsed.intent.reply_language;
      const id = crypto.randomUUID();
      await store.tx(req.actor, async (c) => {
        if (
          (
            await c.query(
              "SELECT count(*)::int n FROM homeauto_online.intents WHERE household_id=$1 AND user_id=$2 AND expires_at>now()",
              [req.actor.household_id, req.actor.user_id],
            )
          ).rows[0].n >= 20
        )
          fail("ASSISTANT_BUSY", 429);
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
            "SELECT * FROM homeauto_online.intents WHERE intent_id=$1 AND household_id=$2 AND user_id=$3 AND session_hash=$4 AND expires_at>now() FOR UPDATE",
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
        if (!["query", "conversation", "control"].includes(intent.kind))
          fail("INTENT_UNSUPPORTED", 422);
        if (intent.sensitive) fail("REMOTE_DOOR_DISABLED", 403);
        if (saved.result && intent.kind !== "query") return saved.result;
        const snapshot = await store.snapshotIn(c, req.actor),
          preferred = snapshot.preferences.reply_language;
        const language =
          preferred === "auto"
            ? intent.reply_language || intent.language || "en"
            : preferred;
        let answer;
        if (["query", "conversation"].includes(intent.kind))
          answer = {
            answer: {
              result_id: crypto.randomUUID(),
              message_key:
                intent.kind === "query"
                  ? "query_result"
                  : "conversation_" + intent.reply_key,
              language,
              text:
                intent.kind === "query"
                  ? queryText(
                      intent.device_ids.map((id) =>
                        snapshot.devices.find((d) => d.id === id),
                      ),
                      language,
                    )
                  : dialogueText(
                      intent.reply_key,
                      facade(snapshot, config),
                      req.actor,
                      language,
                    ),
            },
          };
        else {
          const commands = [],
            errors = [];
          for (const id of intent.device_ids) {
            const k = crypto
                .createHash("sha256")
                .update(req.body.idempotency_key + id)
                .digest("hex"),
              key = `${k.slice(0, 8)}-${k.slice(8, 12)}-4${k.slice(13, 16)}-8${k.slice(17, 20)}-${k.slice(20, 32)}`;
            try {
              commands.push(
                await store.requestIn(c, req.actor, id, {
                  action: intent.action,
                  idempotency_key: key,
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
  app.post("/api/assistant/voice-tickets", (req, res) =>
    res.json({ provider: "browser", transport: "http" }),
  );
  app.post(
    "/api/assistant/speech",
    route(async (req, res) => {
      fields(
        req.body,
        ["result_id", "language", "test_phrase", "message_code", "voice_id"],
        ["language"],
      );
      const language = req.body.language;
      if (
        !["en", "hi"].includes(language) ||
        [
          req.body.result_id,
          req.body.test_phrase,
          req.body.message_code,
        ].filter((x) => x !== undefined).length !== 1
      )
        fail("VALIDATION_ERROR");
      const snapshot = await store.snapshot(req.actor);
      let output;
      if (req.body.test_phrase !== undefined) {
        if (req.body.test_phrase !== "voice_check") fail("VALIDATION_ERROR");
        output =
          language === "hi"
            ? "नमस्ते। मैं श्रीमान हूँ। आप मुझसे घर के उपकरणों के बारे में पूछ सकते हैं।"
            : "Hello. I am Shrimaan. You can ask me about your home devices.";
      } else if (req.body.message_code !== undefined) {
        const prompts = {
          SENSITIVE_ACTION_REQUIRES_UI: [
            "Open Security to review and confirm unlocking the door.",
            "दरवाज़ा अनलॉक करने की पुष्टि के लिए सुरक्षा पेज खोलें।",
          ],
          MICROPHONE_NO_SPEECH: [
            "No speech was detected. Please try again.",
            "आवाज़ नहीं मिली। फिर कोशिश करें।",
          ],
          WAKE_PHRASE_REQUIRED: ["Start with Shrimaan.", "पहले श्रीमान कहें।"],
        };
        const allowed = [
          "INTENT_AMBIGUOUS",
          "RECOGNITION_UNCLEAR",
          "RECOGNITION_AMBIGUOUS",
          "VOICE_REQUEST_TOO_LONG",
          "INTENT_UNSUPPORTED",
          "INTENT_UNKNOWN_TARGET",
          "INTENT_NEGATED",
          "INTENT_CONFLICTING",
        ];
        if (
          !prompts[req.body.message_code] &&
          !allowed.includes(req.body.message_code)
        )
          fail("VALIDATION_ERROR");
        output =
          prompts[req.body.message_code]?.[language === "hi" ? 1 : 0] ||
          (language === "hi"
            ? "अनुरोध की पुष्टि नहीं हुई। कोई कमांड नहीं भेजी गई।"
            : "The request was not confirmed. No command was sent.");
      } else {
        if (!uuid(req.body.result_id)) fail("VALIDATION_ERROR");
        const saved = await store.tx(
          req.actor,
          async (c) =>
            (
              await c.query(
                "SELECT intent,result FROM homeauto_online.intents WHERE household_id=$1 AND user_id=$2 AND session_hash=$3 AND expires_at>now()-interval '60 seconds' AND (result->>'result_id'=$4 OR result->'answer'->>'result_id'=$4)",
                [
                  req.actor.household_id,
                  req.actor.user_id,
                  req.actor.token_hash,
                  req.body.result_id,
                ],
              )
            ).rows[0],
        );
        if (!saved) fail("RESULT_EXPIRED", 410);
        if (saved.intent.kind === "conversation")
          output = dialogueText(
            saved.intent.reply_key,
            facade(snapshot, config),
            req.actor,
            language,
          );
        else if (saved.intent.kind === "query")
          output = queryText(
            saved.intent.device_ids.map((id) =>
              snapshot.devices.find((d) => d.id === id),
            ),
            language,
          );
        else
          output = [
            ...(saved.result.commands || []).map((old) => {
              const c = snapshot.commands.find((c) => c.id === old.id) || old;
              const name =
                snapshot.devices.find((d) => d.id === c.device_id)?.name ||
                c.device_id;
              return c.state === "observed"
                ? language === "hi"
                  ? `${name}: कंट्रोलर की रिपोर्ट ${c.action === "on" ? "चालू" : "बंद"}।`
                  : `${name}: earlier controller report at ${c.observed_at}: ${c.action}.`
                : language === "hi"
                  ? `${name}: बदलाव की पुष्टि नहीं हुई है।`
                  : `${name}: the change has not been confirmed.`;
            }),
            ...(saved.result.errors || []).map(
              (e) => `${e.device_id}: ${e.code}`,
            ),
          ].join(" ");
      }
      res.json({
        provider: "browser",
        text: output,
        language,
        rate: snapshot.preferences.voice_rate,
      });
    }),
  );
}
module.exports = { installOnlineAssistant };
