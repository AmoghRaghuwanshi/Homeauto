# HomeAuto — threat model, safety gates and security plan

Revision 3, 2026-11-05. Findings come from static inspection and isolated read-only reproductions. No mitigation was implemented during planning. Related contracts: [ARCHITECTURE.md](ARCHITECTURE.md), [API_CONTRACTS.md](API_CONTRACTS.md), [TEST_PLAN.md](TEST_PLAN.md).

## 1. Assets and trust boundaries

Protect physical access and egress, light actuation, RFID authorization, occupancy/activity information, credentials and sessions, audio privacy, broker/device credentials, TLS keys, database integrity and critical warnings. Consider untrusted LAN guests, compromised household clients, hostile websites, injected names/logs, forged MQTT messages, cloned/replayed UIDs, recorded voices/TV audio, resource exhaustion, operator error and power/network/storage failure. OS administrator compromise defeats application isolation; service-account and disk protection remain deployment prerequisites.

Trust boundaries are browser→API, API/WS→session policy, hub→broker, broker→each board, model files→native worker, in-memory database→durable snapshot and sensor reading→user interpretation. Voice recognition is untrusted input. LAN membership and a confirmation dialog are insufficient authentication.

## 2. Verified issue register

| Finding / severity | Evidence and consequence | Planned mitigation and validation |
|---|---|---|
| SEC-F01 critical | No auth on REST, device/voice WS or RFID administration; permissive cors and 0.0.0.0 listeners. Reachable clients can request physical actions. | Local sessions, roles, CSRF, Host/Origin checks and one command service. AUTH-01..05, SEC-01. |
| SEC-F02 critical | Private key exists in workspace. Older docs claim public tracking, but this local copy has no Git metadata to confirm history. Treat it as shared/compromised. | Rotate outside source, provision trust, inspect actual repository history later. Never print key material. Rotation has not happened. |
| SEC-F03 high | Device/card/log/RFID strings enter innerHTML; UID enters inline onclick. | Safe DOM text binding, trusted static SVG, no inline handlers, enforced CSP. COMP-15 injection fixtures. |
| SEC-F04 critical | Parser accepts negated unlock and resolves Hinglish band to lock for a light. Voice executes parsed commands directly. | Capability-aware grammar, negation/ambiguity rejection, central authorization; voice/text unlock redirects to Security. INTENT negative cases. |
| SEC-F05 high | REST, voice and RFID optimistically update reported state; publish returns before callback. | Persist commands separately, update observations only from validated reports, expose uncertain outcomes. CMD-01..06. |
| SEC-F06 critical | Anonymous plaintext MQTT firmware and no broker ACL configuration. API auth cannot prevent forged broker commands. | Unique board credentials, topic ACLs, trusted transport and device network segmentation; coordinated firmware provisioning. MQTT-04. |
| SEC-F07 critical safety | Door reconnect loops block before auto-relock check; broker/WiFi failure while unlocked can stall relocking. Physical fail mode unknown. | Nonblocking reconnect, relock priority, wiring/egress review and supervised network/power failure tests. HW-02 is a release blocker. |
| SEC-F08 high | UID-only card matching and unsigned uptime timestamp allow cloning/replay risks. | Restrict publishers, normalize/deduplicate scans, audit grants/denials, disclose UID limits. Stronger RFID authentication is future hardware work. |
| SEC-F09 high | Retained status/online messages and persisted online bits can be stale; PIR has no initial/periodic clear; denied is an event, not lock mode. | Epoch and freshness policy, separate denial events, unknown PIR/current state. SENSOR and SYNC tests. |
| SEC-F10 high | Automatic microphone startup, transcript logging/broadcast and unbounded recognizers/audio. | Gesture-only bounded capture, private session results, worker limits and cleanup; PRIV/AI tests. |
| SEC-F11 high | Whole-file synchronous sql.js writes lack atomic replacement, recovery and retention. | Serialized durable snapshots, backup/migration tests, transition logging, fail closed on security-write failure. DB-01..04. |
| SEC-F12 medium | Arbitrary action/type/ID, RFID silent replacement, unbounded log limit. | Strict schemas and fixed capability registry, duplicate409, bounded queries. VALID/SEC tests. |
| SEC-F13 medium | Isolated dual WSS attachment reproduces voice400; text control can enter audio branch. | Single upgrade dispatcher, noServer instances and isBinary framing. WS-01/02. |
| SEC-F14 high safety claims | Gas ADC linear mapping is not calibrated PPM; missing reading becomes zero; browser alerts not reliable life-safety delivery. | Prototype wording, unknown readings, persistent alert episodes and independent alarms. SENSOR/ALERT tests. |
| SEC-F15 medium | Remote font URLs, empty manifest icons and no service worker. | Local assets and deliberate static-only cache if introduced. OFFLINE tests; no implied installed-PWA guarantee. |

These are product-context severity assessments, not CVSS scores or proof of exploitation. Do not demonstrate vulnerabilities by unlocking real doors.

## 3. Selected authentication and permissions

Provision one owner locally through the host console, then additional resident/viewer accounts through the console in the first release. No default password, hardcoded PIN, password printed to logs, public setup mutation or network password reset. Lost-owner recovery requires local OS access, revokes sessions and writes an audit event.

Use async Node crypto.scrypt with random salt of at least16 bytes, versioned parameters and constant-time verification. Starting parameters N=32768, r=8, p=1, maxmem128MiB must be benchmarked on target; cap concurrent hashes at2. Passwords12–256 characters, spaces/Unicode/paste supported; usernames normalized NFC/case,1–80. Store algorithm, parameters, salt and derived hash only. Session token32 random bytes; store SHA256 hash only. Absolute expiry8h, idle expiry30min. Rate-limit5 failed logins per15min per account and IP, bounded backoff; generic errors, no permanent lockout or username disclosure.

Use secure HttpOnly SameSite=Strict cookies over trusted HTTPS and session-bound CSRF headers. Host allowlist protects against DNS rebinding; Origin checks plus CSRF protect browser mutations. Disable cross-origin API access unless an exact trusted deployment origin is deliberately added. HTTP cannot remain an alternative physical-action channel. API_CONTRACTS defines exact cookie/header rules.

All household reads require a session. Owner manages shared metadata, cards and diagnostics; resident controls lights/locking; viewer reads and manages own display preferences only. Unlock additionally requires explicit can_unlock permission, password reauthentication within5min and a one-use30s challenge bound to session/device/action. No client-side permission flag is authoritative. RFID uses a constrained hardware principal and authorized-card lookup, not a public bypass to the command service.

Apply policy at every REST, device WS, voice WS, text/voice execution and RFID path. Logout, disabled user or expiry closes sockets, cancels unexecuted intents and stops capture. Already published actions cannot be unsent and must retain outcome tracking. Never automatically retry unlock after timeout,503 or reconnect. Exact accepted idempotency replay returns the prior record without republishing; new action needs new consent.

Upgrade authentication, Origin validation, bounded messages and safe logging follow [OWASP WebSocket security guidance](https://cheatsheetseries.owasp.org/cheatsheets/WebSocket_Security_Cheat_Sheet.html). One dispatcher routes authenticated noServer instances; voice uses a short-lived ticket, not a token in query logs. Enforce expiry after connection, not only at handshake.

## 4. Browser and data hardening

Render names, UIDs, transcripts, logs and restored preferences using textContent/DOM properties. Only registry-controlled IDs, local relative URLs and trusted static SVG. No inline onclick or untrusted style/HTML strings. Enforce CSP after migrating existing inline handlers/styles:

```text
default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self';
img-src 'self' data:; font-src 'self'; media-src 'self' blob:;
object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'
```

Verify connect-src handling of WSS in target browsers; add exact trusted WSS origins if necessary, never wildcard LAN. A local blocking theme-bootstrap file avoids unsafe-inline. Report-only CSP during development is not release completion. Add nosniff, no-referrer and Permissions-Policy microphone=(self), camera=(), geolocation=(). Enable HSTS only after the local trust setup is reviewed to avoid development lockout.

Keep DB/models/certificates/config outside public root; restrict filesystem access to the service account and operator. Use encrypted volume/backups where deployment requires at-rest protection; sql.js is not encryption. Preserve prepared SQL bindings and free statements in finally. Validate MQTT as strictly as HTTP; bounded sanitized diagnostics must not dump raw payloads or native errors.

Native inference has no broker credentials, public listener or arbitrary file/URL input. Pin model provenance, hash, runtime and license; import assets through controlled operator setup. Never interpolate speech into shell commands, allow free-form SSML or map generated audio to arbitrary paths. Restore DB with hub stopped; validate file size/schema/integrity, keep rollback backup and invalidate sessions so old credentials/permissions cannot revive unnoticed.

## 5. Broker and firmware deployment gate

Current boards connect anonymously. Enforcing credentials on the broker before provisioning boards will break both. Start with an isolated authenticated test broker, then provision unique credentials and trusted transport on real firmware under operator supervision. Segmented plaintext interim deployment cannot be described as full production transport security.

Server identity can publish assigned light/door commands and subscribe to known telemetry. Lights identity can publish its own light statuses, sensors and online status and subscribe to its four command topics. Door identity can publish its status/RFID/online and subscribe to door command. Boards cannot publish commands or impersonate each other. Firewall excludes guest clients; never port-forward broker/hub. Firmware secrets are external/ignored, never public responses or documents. Verify ESP32 certificate validation, time/renewal and memory behavior; do not disable validation to get a green connection indicator.

No retained commands; clear old retained command messages during supervised setup and verify reconnect does not actuate unexpectedly. Existing text payload lacks expiry and dedup IDs; server prevention of its own replay does not give end-to-end exactly-once or delivery expiry. Stronger guarantees need a separately versioned firmware protocol. Preserve literal legacy topics/payloads during current refactor; transport policy changes require explicit tests.

Door status is software/relay mode, not a bolt/contact measurement. Verify electrical fail-safe/fail-secure behavior, actual latch movement and safe egress with an operator. Nonblocking relock work is mandatory before unattended use; preserving the current protocol does not justify retaining unsafe reconnect control flow. Never promise exact5s relock from a UI timer.

## 6. Alerts, microphone and recovery

Gas values are uncalibrated ADC-derived estimates; no calibrated concentration or absence-of-gas claim. Source has no independent gas buzzer/alarm. Browser notifications are best-effort and do not guarantee delivery when backgrounded/closed. Persist active episodes, recover on reconnect, deduplicate repeated samples, keep acknowledgment separate from resolution. Resolve only after a fresh valid normal reading. DB failure must produce persistent degraded diagnostics; telemetry QoS0 can be lost. Real gas protection requires an independent suitable detector/alarm. No gas-triggered relay automation in this release.

Microphone starts only after a deliberate gesture; previously granted browser permission is not permission to auto-record on load. Bound capture to20s, free tracks/socket/buffers on cancel/navigation/logout/visibility loss/error. Browser media access needs a secure context; validate trusted HTTPS on phones, not merely desktop localhost. [MDN getUserMedia documentation](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). Audio stays on encrypted LAN to local hub; it is not necessarily processed on the phone. No raw audio/transcript retention by default; consented benchmark corpus stays outside served/Git paths. Lock-screen notifications omit UID and occupancy detail by default.

Shutdown stops new actions, marks unresolved commands uncertain, drains durable writes and closes workers/WS/MQTT/timers once. Process supervision restarts services without replaying physical actions. Test disk-full, abrupt termination, second writer, restore and power/network failures. Software tests imply no safety certification.

## 7. Release gates

- GateA, isolated development: injected DB/publisher, no production broker/hardware calls, no exposed secrets, no incidental actuation.
- GateB, supervised control: auth/CSRF/Host/Origin/XSS/WS/command suites pass; broker credentials/ACL verified; truthful observations; safe fixture and operator present.
- GateC, household candidate: door relock/network/power/egress tests, persistent alerts, backup/restore, licensing, offline packaging, accessibility and user trials pass. Independent alarm limitations documented.
- Voice gate: local corpus, CPU, Hindi/English TTS and zero-dangerous-action checks pass. A polished screen cannot waive any gate.

Cases: AUTH-01..05, SEC-01..05, COMP-15, CMD-01..06, MQTT-01..05, DB-01..04, PRIV-01, HW-01..04 in TEST_PLAN. Current status: all mitigations pending; no production server start, hardware actuation, key rotation, firmware flash or history rewrite performed during planning.
