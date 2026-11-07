# HomeAuto — architectural decisions

Revision3,2026-11-05. **Accepted plan** means selected architecture, not implemented code. Start [HANDOFF_TO_GPT6.md](HANDOFF_TO_GPT6.md).

| ADR | Status | Decision and rationale | Alternatives, consequences and verification |
|---|---|---|---|
|001 | Accepted plan | Local workspace governs current facts; no Git metadata. | Prior remote SHA is historical. Establish backup/checkout before coding, HA-002; never overwrite local tree. |
|002 | Accepted plan | Keep vanilla JS, Express/CommonJS, MQTT, sql.js, two ESP32s. | Framework/native-SQLite rewrite unjustified now; durability/volume tests inform a later DB migration. |
|003 | Approved product |05default with01/03/04 selectable, same five destinations/components. | No02/automatic dark/four page forks. THEMES exact registry;100 primary theme-width captures plus states. |
|004 | Accepted plan | Seven fixed hardware IDs; editable display metadata. | No invented cameras/AC/dimming/arm modes; fixed deletion rejected because firmware/seed would resurrect records. |
|005 | Accepted plan | Local accounts, async scrypt, cookies, CSRF, Host/Origin, roles+can_unlock, reauth/challenge. | LAN/PIN/confirmation alone insufficient; console identity provisioning bounds first release. |
|006 | Accepted plan | One command service for REST/voice/RFID; reported observations separate from accepted/published/uncertain. | Legacy reports lack IDs; temporal correlation weak, no physical verification or exactly-once claim. |
|007 | Accepted plan | No automatic unlock retries/offline queue/retained commands; QoS0 legacy timed door actions, explicit light actions. | Existing server QoS1 isn't end-to-end acknowledgment; test transport change and expose ambiguity. |
|008 | Safety blocker | Door relay report isn't bolt/contact proof; blocking reconnect can stall relock. | Supervised firmware/fail-mode/egress validation mandatory before unattended use; no guaranteed UI countdown. |
|009 | Accepted plan | Epoch/retain-aware freshness, gas10s, board60s, PIR last event. | Board liveness cannot manufacture PIR clear; periodic PIR snapshot needs future firmware validation. |
|010 | Accepted plan | Browser theme/accessibility/UI language; own-user favorites/voice/categories; shared home/rooms. | No fictional cross-device localStorage persistence; login doesn't overwrite local theme. |
|011 | Approved product | Hindi and English UI required for household release; Hinglish input measured. | English-first is staging only; native copy/pronunciation review required. |
|012 | Accepted plan | Gesture-only bounded utterance, Stop/Cancel, text fallback, isolated worker. | No default continuous wakeword; no duplicate execution from dual recognizers. |
|013 | Benchmark pending | First STT challenger multilingual Whisperbaseq5_1; small if needed; retain Vosk baseline. | Names don't establish quality/latency. Local corpus and CPU/RAM gate determine winner. |
|014 | Audition/rights pending | First bilingual TTS audition Kokoro ONNX; Piper only after specific voice provenance review. | Piper Hindi candidate dataset card NC-SA; Kokoro short-phrase warning; particular sherpa wrapper may lack Hindi. |
|015 | Accepted plan | Deterministic constrained intent, negation/ambiguity rejection, voice unlock redirects to Security. | LLM unnecessary for7 devices; future conversation needs separate resource budget and no independent actuation authority. |
|016 | Accepted plan | Persistent deduplicated gas episodes, own read/ack, foreground notification best-effort. | Ack isn't resolution; no life-safety guarantee or gas relay rule; independent detector/alarm. |
|017 | Accepted plan | Serialized atomic sql.js snapshots, backup, transition audit/latest telemetry,90day activity retention. | Full2s sample audit grows rapidly; security writes fail closed; Windows crash/restore tests required. |
|018 | Accepted plan | Single WSS upgrader, noServer paths, session/origin checks, bounded voice. | Existing dual attachment reproduces400; schema/epoch/seq resync and private transcripts required. |
|019 | Accepted plan | Local assets/system fonts; optional static-only service worker. | Manifest isn't complete offline PWA; no command/audio/session cache or background action replay. |
|020 | Planning boundary | Markdown specifications only this session. | No install/download/source edit/flash/push; planning complete doesn't mean runtime/security ready. |

## Open verification questions

| Question | Evidence and task | Blocks |
|---|---|---|
| Actual local Git provenance? | Check real checkout or explicit backup/source hash comparison; HA-002. | Safe coding checkpoint. |
| Door electrical fail mode, latch/egress? | Operator wiring review, safe fixture, network/power tests; HA-010/042. | Household release. |
| Broker/version/firewall/trusted hostname? | Deployment inventory and credential/trust provisioning; HA-009/036. | Secure live control. |
| Vosk Windows/native load and browser audio graph? | Isolated native probe and capture fixtures; HA-031. | Speech readiness. |
| Hindi voice rights and pronunciation? | Exact asset terms, wrapper support and native audition; HA-033. | Redistributable bilingual speech release. |
| CPU/RAM/latency/Hinglish quality? | Corpus, host RAM/power profile and measured metrics; HA-032/033. | Speech profile promotion. |
| Real room aliases/names? | Owner confirmation via local alias workflow; HA-017/029. | Ambiguous alias execution. |
| Phone certificate/notification behavior? | Trusted origin and target browser tests; HA-026/036/038. | Claims beyond tested foreground behavior. |
| Atomic DB replace/restore on Windows? | Injected failure and abrupt termination on test copies; HA-003/011/037. | Durable security configuration. |

Each uncertainty has a verification task. None requires changing the agreed themes, stack or navigation. Update ADR status with evidence; never silently substitute assumptions.
