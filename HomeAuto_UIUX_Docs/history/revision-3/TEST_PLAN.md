# HomeAuto — verification and release evidence

Revision 3,2026-11-05. Cases below are **planned** except the explicit planning results. Distinguish source inspection, simulator, rendered browser, native inference and physical hardware. A simulator pass is not physical validation. [TASKS.md](TASKS.md) owns progress.

## 1. Results obtained during planning

| Check | Result and limitation |
|---|---|
| Inventory | All source/config/scripts and3 previous docs read;4 reference PNGs opened visually. No AGENTS.md or application tests found. |
| Syntax | Corrected absolute-path loop checked19 application JS files with node --check; all passed. Earlier relative-path attempt matched0 and is not counted. |
| Packages | npm ls --depth=0 --ignore-scripts passed. Installed express4.22.2, ws8.20.1, mqtt5.15.1, sql.js1.14.1, vosk0.3.39, cors2.8.6, selfsigned5.5.0, nodemon3.1.14. No native-load/security-advisory test. |
| Pure parser | Normal English off targets light1/2. Hinglish band incorrectly yields lock for lights; negated unlock yields unlock; gas query returns null; light99 accepted; bare turn on light selects all4. No execution or publication. |
| Isolated WS | Two automatic WSS instances on one ephemeral loopback server reproduce /voice400. No application server, broker or models involved. |
| DB read-only | Separate in-memory sql.js SELECTs:7 devices,0 cards,44activity rows; file28672 bytes. No export/write. Old online bits are historical. |
| Not run | App rendering, live broker, firmware build/flash, physical relay/door/RFID/sensors, microphone, STT/TTS, CPU or recognition benchmark. Reference images are not app QA. |

No npm test exists yet. npm start/dev initialize/write/seed DB and connect MQTT; never use them as isolated baseline checks.

## 2. Harness and commands

HA-002 extracts createApp(deps), then Node built-in node:test suites with fake publisher, temporary DB, injected auth/speech/clock. Import must not start listeners, seed real data, load native models or connect MQTT. Tests reject production DB/broker config. HTTP uses ephemeral loopback; MQTT uses an isolated broker with no production bridge. Native corpus checks are explicit profiles; hardware never runs in default CI.

Future scripts:test, test:unit, test:integration, test:browser, test:ai. Add them before claiming availability; verify Node20 file discovery and use explicit file lists if needed. Hardware checks require operator and safe fixture. No dependency installation occurred in planning. Avoid tests that merely mirror implementation; exercise failure, authorization and observable outcomes.

Current safe syntax check from workspace root:

```powershell
$ErrorActionPreference = 'Stop'
$files = Get-ChildItem -LiteralPath '.\public\js','.\server' -Recurse -File -Filter '*.js' |
  Where-Object { $_.FullName -notmatch '\\node_modules\\|\\models\\' }
foreach ($file in $files) {
  node --check $file.FullName
  if ($LASTEXITCODE -ne 0) { throw "Syntax failure: $($file.FullName)" }
}
```

From server:npm ls --depth=0 --ignore-scripts. Pure commandParser is safe to require without execution dependencies. Advisory lookup is separate read-only work; no npm audit fix or incidental lockfile update. Inject filesystem/time/IDs/worker to make failure tests repeatable.

## 3. Security and command cases

| ID | Stimulus | Required assertions |
|---|---|---|
| AUTH-01 | Missing/expired/forged cookie on REST/WS/voice |401/rejected upgrade; no household data or publish. |
| AUTH-02 | All roles and can_unlock combinations | Exact server permission matrix on every path; UI is insufficient authority. |
| AUTH-03 | Bad Host/Origin/CSRF, DNS rebinding, text/plain mutation |403/415, no mutation; trusted origin works; no secret logging. |
| AUTH-04 | Logout/expiry/user disable during socket/capture | Close sockets, stop tracks, reject unexecuted intents; track published outcomes. |
| AUTH-05 | Failed login, rotation, recovery | Generic401, bounded429, hashed tokens/passwords, old session revoked, no default credential, paste supported. |
| SEC-01 | Direct unlock without role/grant |403, zero publish; RFID hardware principal separately constrained. |
| SEC-02 | Cancel, failed reauth, challenge expiry/reuse | No Cancel publication;30s session/device/action binding; accepted key replay never republishes. |
| SEC-03 | Arbitrary action/type/ID, sensor command, status edit |400/422; no arbitrary topic; fixed hardware deletion409. |
| SEC-04 | UID formats, duplicate, revocation, concurrent edit |4/7/10byte canonical UID; create409; owner+reauth; version conflict; audit durable; injection inert. |
| SEC-05 | Scan replay, broker/disk failure, busy door | Fail closed, no optimistic unlock; dedup still permits legitimate later scan. |
| VALID-01 | Invalid limits, unknown fields, large JSON, unknown API |400/413/404 promptly; no stack/SQL leak or hung request. |
| CMD-01 | Explicit on, delayed publish callback |202accepted→published on callback only; reported state unchanged before observation. |
| CMD-02 | Retained/old/invalid matching status | Cannot complete command or fabricate liveness; fresh report gives temporal evidence, physical_verified=false. |
| CMD-03 | Unlock/lock, denied while locked, late locked heartbeat | Denied is event; missed unlock uncertain; no physical proof/countdown guarantee. |
| CMD-04 |8s light/3s door deadline, loss, restart, late report | Uncertain, no replay; late state updates without invented causality. |
| CMD-05 | Two clients/keys, voice/manual/RFID concurrency | Same key/body same record; different body409; one pending/device; no duplicate publish. |
| CMD-06 | Bulk off with mixed known/unknown/offline | At most2 concurrent; per-device outcomes; never all off while unknown. |

## 4. State, transport, sensors and DB

| ID | Stimulus | Required assertions |
|---|---|---|
| STATE-01 | Old online1 on boot, mixed freshness | Startup stale; known/unknown separate; unknown never off/locked/normal. |
| SYNC-01 | Event before snapshot, late REST, seq gap, reconnect | Correct epoch/version ordering; resnapshot on gap; one subscription; no mutation replay. |
| SYNC-02 | Two browsers/tabs and role-redacted events | Consistent state; private transcripts; per-user receipts; no permanent seq gaps. |
| WS-01 | /ws,/voice, unknown upgrade | One dispatcher; both authorized paths work; unknown rejected; heartbeat/expiry enforced. |
| WS-02 | Buffer text, binary PCM, bad/oversized/replayed start | isBinary classification; control never STT; ticket/caps/busy/cleanup enforced. |
| MQTT-01 | Exact legacy fixtures | Correct7ID mapping; validate topic/types/ranges; unknown cannot mutate DB. |
| MQTT-02 | LWT false, retained true, heartbeat, timeout | Loss immediately unavailable; fresh epoch needed; board heartbeat not fresh sensor state. |
| MQTT-03 | Reconnect, QoS loss, retained command, outgoing queue | No offline unlock replay; explicit actions; delivery limits honest. |
| MQTT-04 | Server/board/guest attempt topic directions | ACL allows intended paths only; no board command publication/peer impersonation. |
| MQTT-05 | Firmware payload vocabulary | Numeric light/door suffixes, gas/motion, denial/retention compatible except declared security changes. |
| SENSOR-01 | Gas missing/normal/alert/stale/malformed | No missing0/calibrated PPM;10s freshness; invalid rejected; disconnect doesn't resolve warning. |
| SENSOR-02 | Quiet PIR boot, hold, event-only heartbeat | Unknown before report; last-event age; no guaranteed absence/person identification. |
| ALERT-01 | Repeated2s gas alert, normal, restart | One active episode; last_seen updates; fresh normal resolves; restart restores; no announcement storm. |
| ALERT-02 | Read/ack across users | Own receipts; ack not resolution; viewer ack403. |
| ALERT-03 | OS denied/unsupported/background, door denied | In-app warning persists; no denied→locked; opt-in sound; private preview; no closed-app guarantee. |
| DB-01 | Migrate old DB copy, repeat, force failure | Preserve7IDs/44 historical events; FK/version valid; rollback/readable backup. |
| DB-02 | Crash export/flush/replace, disk full | Old/new valid DB, recovery backup; security writes fail closed; no fake durable success. |
| DB-03 | Two writers, gas volume, retention | Second writer refused; transition audit, bounded latest flush; active alerts retained. |
| DB-04 | Corrupt/old restore | Validate size/schema/integrity; invalidate sessions; no action replay; rollback documented. |

## 5. Speech, privacy and UI

| ID | Stimulus | Required assertions |
|---|---|---|
| INTENT-01 | English/Hindi/Hinglish phrases and aliases | Exact action+target; band→off for light; queries independent of action; confirmed aliases. |
| INTENT-02 | Negation/conflict/bare target/99/unsupported hardware | Reject/clarify, no publish; no default all lights, substring unlock or partial execution. |
| INTENT-03 | Dual finals, duplicate utterance, late canceled job | At most one intent/execution; ignore stale result. |
| AI-01 | Granted/denied mic, Stop/Cancel, navigate/logout/hidden/unplug | Gesture only; stop tracks/socket/buffers;20s cap; end once/cancel discards;44.1/48k continuity. |
| AI-02 | Consented corpus, noise, silence, slow elderly speech | Measure latency/intent/rejections/RAM; silence no actuation; no guessed confidence. |
| AI-03 | Hindi/English TTS, short phrases, names, autoplay block | Native intelligibility review, correct language, Replay gesture, Stop, text fallback, no cloud. |
| AI-04 | Missing/corrupt/unlicensed assets, busy/crashed worker, activation failure | Honest readiness, previous profile retained, manual/text unaffected, caps/cleanup. |
| AI-05 | Voice/text unlock, viewer action, stale target | Protected UI redirect, no unlock publish; shared policy; query freshness. |
| AI-06 | Speech→simulated report→TTS, WAN blocked | Zero external calls; spoken report/uncertainty matches lifecycle; physical test separate. |
| AI-07 | Actual CPU run/manifest | Record hashes, threads, bytes/RAM, percentiles/corpus counts; OFFLINE_AI gates; no GPU/cloud fallback. |
| PRIV-01 | Capture/logout/logs/new client, debug off | No raw audio/transcripts in DB/logs/global broadcast; TTL cleanup; no session token localStorage. |
| UI-01 | Home normal/empty/unknown/alert | Real counts/favorites/links; no concept hardware; pending/unknown honest. |
| UI-03 | Light keyboard, double tap, slow report | One request; switch follows report; pending survives theme; uncertain remains inline. |
| UI-04 | Details/edit/capabilities | No brightness/camera/AC/fake pairing; all7IDs reachable; ID/topic stable. |
| UI-07 | Every Settings route and role | Real navigation, persistence scopes,4 themes, owner diagnostics. |
| UI-08 | Offline Help/About | Local content, actual version, prototype/privacy explanation. |
| NAV-01 | Direct refresh/back/login return/notfound |5destinations, deep links, focus/scroll, no external redirect, unknown API JSON404. |
| ROOM-01 | List/search/filter/add | Real grouping, durable create, empty vs error, no guessed mapping. |
| ROOM-02 | Rename/reassign/delete empty | Version/alias409, IDs stable, nonempty delete409, partial assignments explicit. |
| PREF-01 | Blocked/corrupt storage |05fallback, current-visit notice, OS reduce, no crash. |
| PREF-02 | Two users/tabs, versions, favorites | Own favorites/browser theme,409 preserves draft, no permission in preferences. |
| PREF-03 | Shared home name | Owner validated durable edit, all users saved value, no mock surname. |
| LANG-01 | English/Hindi, long labels, zoom | Local dictionaries, document.lang, Devanagari, no critical English-only release copy. |
| LANG-02 | Replies, names, template parameters | Safe binding, language selection, native pronunciation/copy review, no RTL assumption. |
| OPS-01 | About/build unknown | Actual metadata only, unknown labelled, local licenses. |
| OPS-02 | Broker/DB/worker down, Advanced direct URL | Honest diagnostics, no secrets, owner-only, manual degradation. |

COMP-01..17 are individually defined in COMPONENT_SPEC; THEME-01..09 in THEMES. Test observable behavior rather than implementation-shaped assertions. Accessibility:48px targets/56px comfort; keyboard Tab/ShiftTab/Enter/Space/Esc, visible focus, no traps; NVDA Chrome/Edge and a target phone browser;4.5:1 normal text,3:1 large text/essential UI; forced colors;200% text/400% reflow at320CSSpx; Hindi errors/shaping; OS reduced motion; no color-only state; typing alternative. [WCAG2.2](https://www.w3.org/TR/WCAG22/) is the reference; product48px exceeds its AA minimum. Capture5 screens×4 themes×5widths=100 primary combinations, then relevant pending/unknown/alert/denied states.

| ID | Required offline evidence |
|---|---|
| OFFLINE-01 | WAN blocked, LAN up, cold hub, new browser; assets/auth/controls/preinstalled speech local; zero external calls recorded. |
| OFFLINE-02 | Hub/broker/board loss separately; distinct truthful states, no queued commands. |
| OFFLINE-03 | If SW added:versioned static shell only; no API/audio/session cache or background actuation; updates don't interrupt capture/confirmation. |
| OFFLINE-04 | Trusted HTTPS on phone, mic/audio without WAN; certificate-warning bypass is not a pass. |

## 6. Physical validation and evidence gates

| ID | Safe setup and pass criteria |
|---|---|
| HW-01 |4relay test loads, operator checks wiring/pins; reports compared to actual relay/load change; boot off; manual/voice/sync preserved; physical observation method recorded. |
| HW-02 | Door fixture detached from occupied access/egress, operator present; test lock/unlock/deny, relock timing, WiFi/broker loss while unlocked, power/reboot/reconnect; nonblocking failsafe/egress verified; no contact sensor claim. |
| HW-03 | Authorized/revoked/unknown cards, secured broker; correct grant/deny, durable revocation, cooldown, reconnect no replay, server loss fail closed; no clone-resistance claim. |
| HW-04 | Safe approved sensor signal simulation; gas raw/alert and PIR hold/stabilization/unknown startup; warning recovery; no hazardous gas release for software testing; calibration separate. |

Per-task evidence:date, source checkout/hash, changed paths, fixture/level, exact commands, pass/fail/skip counts, actual output, screenshot paths, hardware operator/setup, remaining risks, next task. Missing hardware/inference cannot be marked passed by simulation. GateA/B/C and voice gate in SECURITY stay explicit.
