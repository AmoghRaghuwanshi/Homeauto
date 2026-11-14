# HomeAuto implicit state-machine inventory

Audited 2026-11-14 against `5e0a040fef9025c85847193cc39f326f43ec8c11`, before the requested Stageshow frontend rebuild. This snapshot records existing behavior; subsequent rebuild changes need separate verification. No production or hardware requests were made for this audit.

## Scope and interpretation

An implicit machine is behavior whose next action depends on remembered events, flags, pending work, or elapsed time, without one enforced transition model. Some machines already have a `state` string, but their transitions remain distributed across callbacks, SQL, timers and rendering. Those are marked **mixed**. Derived status projections are listed separately: they are not additional independent mutable machines.

Coverage: current browser ES-module graph starting at `public/index.html`/`main.js`; local Node entrypoint `server/server.js`/`lifecycle.js`; Vercel `api/index.js`; cloud auth/store/SQL and gateway worker; optional catalog mirror; both firmware sketches; recovery/provisioning/model utilities; and the older unwired UI/backend. Test runners, third-party internals and passive configuration values are not counted as product machines. This is a source inventory at logical workflow granularity, not a proof enumerating every possible program state.

Source locations below refer to this audited commit. Firmware and operator paths were inspected, not executed. The QR/pairing-code proposal from November10 is not implemented in this snapshot and therefore is not an existing machine.

## Confirmed transition hazards

### A1 — Failed demo exit can expose real transport to stale demo controls

`public/js/main.js:56` disconnects state, calls `Api.exitDemo()`, clears `realDemoSession`, and only then awaits `/api/auth/session`. A rejected session request exits before replacing the rendered view. `public/js/api.js:20` consequently no longer intercepts non-auth calls, although the old demo controls are still displayed. `ctx.command` at `main.js:27` sends its request before checking whether a session remains. Its initial `render()` can show sign-in, but does not stop that request.

An isolated probe using the actual extracted `ctx`, `switchDemo` and `disconnectState` implementations confirmed: failed exit -> session null -> demo transport null -> no replacement render before failure -> stale command callback makes one mocked real-transport device request. Existing server authentication, authorization and physical command gates still apply; this is a realm-confusion risk, not a demonstrated authorization bypass or physical actuation.

The missing state is `exiting_demo`: keep simulator isolation until real-session/snapshot reconciliation succeeds, or retire all old controls before changing transport. Commands must require a valid current realm/session before sending, not only before accepting the response.

### A2 — Preference-save lock survives a realm change

`public/js/main.js:34` clears `preferenceBusy` only when the captured `Api.sessionVersion` still matches. `switchDemo` increments that version but does not reset the busy flag. A save pending while demo entry runs can finish with `preferenceBusy === true`; settings/favorite controls then remain disabled. Logout and household switching do reset this flag, demonstrating inconsistent transition cleanup.

The second isolated probe confirmed this final state. Associate busy ownership with an operation/realm, and release only that owner's lock, or reset the preference operation during every realm switch.

Evidence retained outside the application: `D:/homeauto-audit-tools/state-machines-20261114/probe.js` and `probe-results.json`. Both probes passed their assertions; all HTTP, DOM and device effects were mocked. They establish control-flow behavior, not end-to-end live reproduction. No app code was changed during these probes.

## Browser machines

| ID | Workflow and encoding | States / transitions and guards | Baseline source |
|---|---|---|---|
| U01 | Bootstrap / screen selection; flags and nullable session | boot -> runtime detection -> session lookup -> snapshot -> app;401 -> sign-in; other errors -> unavailable -> retry. `authInitialized` prevents early preference events rebuilding auth. | `public/js/main.js:291`, `public/js/api.js:9` |
| U02 | Signup; request object, draft, failure and notice | editing -> invalid or submitting -> confirmed/login, rejected/editing, or unknown outcome/sign-in recovery. Pending survives language rerenders; draft cleared in finally. | `public/js/main.js:215` |
| U03 | Sign-in / logout; disabled button and session | signed-out -> submitting -> snapshot hydration -> connected; rejected -> form error. Logout waits for server before reset; failure retains session/UI. | `public/js/main.js:25`, `public/js/main.js:265`, `public/js/main.js:277` |
| U04 | Reauthentication / sensitive action | ordinary session -> password modal -> rotated session with5-minute freshness -> deferred confirmation/action; cancel/error returns to modal/previous view. | `public/js/main.js:36`, `public/js/main.js:42` |
| U05 | Real/demo realm switch | real -> disconnect/clear -> simulator -> demo; demo -> disconnect/clear -> real auth/snapshot -> real. No explicit switching/failed-switch state; see A1. | `public/js/main.js:56`, `public/js/api.js:5` |
| U06 | Household switch | idle -> switchingHome -> server rotation -> transport teardown -> new snapshot -> Home -> idle. Generation counters invalidate assistant work; finally clears switch flag. | `public/js/main.js:26` |
| U07 | Each HTTP request and auth generation | created -> pending -> JSON success/error, abort or timeout -> cleanup. Session-version guards control401 and CSRF effects; demo diverts non-auth requests. | `public/js/api.js:18` |
| U08 | Async rendering / ownership | old render -> loading -> candidate view -> committed only for latest renderId/current session; failure -> error page. Shell and assistant caches are independent flags. Focus, drafts and disclosure state are restored. | `public/js/main.js:158` |
| U09 | Cloud polling | connecting -> busy -> connected or disconnected/backoff -> retry; hidden tab15s; foreground exponential2–30s; generation change stops scheduling. Visibility can trigger pollNow. | `public/js/cloud-state.js:37`, `public/js/state.js:20` |
| U10 | Local state WebSocket | connecting -> open -> snapshot stream -> closed -> jittered retry -> reconnect; old socket callbacks ignored. Explicit teardown increments generation and clears session/snapshot. | `public/js/state.js:7` |
| U11 | Snapshot acceptance and identity | new epoch accepted; same epoch/cursor/sequence older data rejected; preference version cannot regress in same cloud user. Local socket sequence resets on open. | `public/js/state.js:6`, `public/js/cloud-state.js:16` |
| U12 | Navigation / restoration | current history entry -> saved scroll/focus -> pushed/replaced entry -> forward/back restoration; absent logical history -> explicit parent fallback. Debounced history writes are a nested pending/committed machine. | `public/js/navigation.js:53` |
| U13 | Shared async button | enabled -> promise pending/disabled/aria-busy -> enabled; sync/async failure emits action-error. This DOM lock is separate from domain pending flags. | `public/js/components.js:9` |
| U14 | Dialog lifetime | open -> submitting -> closed on success or open/error on failure; Escape blocked while submitting; close restores opener/fallback focus. Opening another dialog closes the previous one. | `public/js/components.js:70` |
| U15 | Preference save | idle -> preferenceBusy -> versioned PUT -> refresh or error -> idle, provided session version matches; A2 shows missing reset on realm transition. | `public/js/main.js:34` |
| U16 | Preference durability | persisted defaults/read values -> applied -> storage write or session-only fallback; storage event reloads another tab's values; one-time failure notice. Theme selection itself is configuration, not four separate machines. | `public/js/preferences.js:8`, `public/js/main.js:281` |
| U17 | Per-device UI command | idle -> ctx.pending -> request accepted -> backend pending/terminal feedback; request failure -> feedback; old session response ignored. Server pending ID and browser pending Set jointly disable actions. | `public/js/main.js:27`, `public/js/views.js:24` |
| U18 | Bulk light command | idle -> sequential batches of at most2 concurrent device operations -> accumulated outcomes -> unavailable summary. No atomic group success. | `public/js/main.js:33` |
| U19 | Assistant conversation | draft -> interpreting -> sensitive-action diversion, query answer or executing commands -> waiting -> terminal summary; assistantGeneration invalidates stale replies after route/session changes or clear. | `public/js/main.js:43`, `public/js/main.js:80`, `public/js/main.js:98` |
| U20 | VoiceCapture (mixed) | ready -> permission/ticket -> microphone -> socket handshake -> worklet/graph -> listening -> processing -> ready/intent; errors/cancel clean capture and invalidate generation. `stage` and `state` are separate dimensions. | `public/js/voice-controller.js:3` |
| U21 | Audio worklet VAD / utterance | waiting for speech -> speaking -> trailing silence -> done;20s total,0.7s trailing silence,5s no-speech stop. Resampling phase/frame accumulation is continuous state inside the control machine. | `public/js/capture-processor.js:4` |
| U22 | Spoken reply / playback | stopped -> synthesis request -> job polling -> ready/audio.play -> playing or error; stop/navigation increments audioGeneration and pauses.60 polls at500ms; server job lifetime differs. | `public/js/main.js:45` |
| U23 | Activity list / pagination | uncached/loading -> cached page -> load-more or exhausted; invalid filter -> empty/error; refresh clears cache. Query key and cursor identify list state; live updates deliberately do not replace the visible list. | `public/js/views.js:149`, `public/js/main.js:196` |
| U24 | Room search debounce | input -> URL query saved -> pending150ms render -> matching/empty list; navigation cancels timer. | `public/js/views.js:100`, `public/js/main.js:114` |
| U25 | Alert presentation / notification permission | initial snapshot seeds knownAlerts without notifying; later unseen active alert -> toast/optional OS notification -> remembered. Detail read uses readingAlerts in-flight suppression; failure releases it. Permission default -> granted/denied, unsupported is separate. | `public/js/main.js:190`, `public/js/views.js:168`, `public/js/views.js:207` |
| U26 | Toast lifetime | visible/countdown -> hover-paused -> resumed -> removed; maximum3 retained; error timeout12s versus6.5s. | `public/js/main.js:19` |
| U27 | Gateway setup / one-time download | loading status -> eligible or existing/revoked; eligible -> reauth -> confirm -> enrollment request -> secret held in closure -> download/Done. Explicit unused-file replacement revokes prior key. Closing loses retrieval. | `public/js/gateway-ui.js:15` |
| U28 | Demo devices/scenarios (mixed) | simulated light on/off; gas normal/alert; motion clear/detected; scenario change resolves previous alert and may create new active alert; receipt states are independent; reset restores defaults. Door is a fixed read-only example. | `public/js/demo.js:11`, `public/js/demo.js:31`, `public/js/demo.js:40` |
| U29 | Demo intents / tab persistence | parse -> bounded30s one-use intent -> query/command or expired; tab marker matches user/home before restore; only simulated values/favorites restored; reset and logout have different clearing scopes. | `public/js/demo.js:11`, `public/js/demo.js:60`, `public/js/api.js:5` |

## Server and database machines

| ID | Workflow and encoding | States / transitions and guards | Baseline source |
|---|---|---|---|
| S01 | Local session validity | absent -> issued -> active/touched -> recently reauthenticated/rotated -> idle-expired, absolute-expired, disabled-user or deleted. Reauth keeps absolute expiry; restart deletes sessions. | `server/auth/sessions.js:32`, `server/auth/sessions.js:47`, `server/db/repository.js:102` |
| S02 | Cloud session family / membership | issued -> valid -> rotated into new household or reauth -> old token revoked; logout revokes family.30-minute idle/8-hour absolute/disabled user/inactive membership invalidate actor. Delayed control rechecks valid_controller. | `server/online/auth.js:101`, `server/online/migrations/001_online.sql:104` |
| S03 | Rate-limit windows | available counter -> consumed -> blocked at limit -> new window resets. Local failed-login Maps and cloud SQL buckets differ; API read/write/device/signup/reauth limits share this pattern with different scopes. | `server/auth/sessions.js:33`, `server/online/auth.js:31`, `server/online/migrations/002_bounded_maintenance.sql:3` |
| S04 | Password hashing admission | available -> one/two in-flight verifications or signup hashes -> saturated -> finally releases slot. This is process-local, separate from persistent request buckets. | `server/auth/sessions.js:31`, `server/online/auth.js:55`, `server/online/auth.js:86` |
| S05 | Local door confirmation | issued session-bound challenge -> consumed once, expired or invalidated by session/restart;30s challenge plus fresh reauth and hardware gate required. | `server/services/home.js:49`, `server/services/home.js:80` |
| S06 | Local physical command (mixed) | accepted -> published -> observed; accepted/published -> uncertain on disconnect/deadline/publish uncertainty; accepted -> failed on failed admission. Fresh matching nonretained report can observe before publish callback. Non-unlock no-op starts observed. Restart makes pending uncertain. | `server/services/home.js:58`, `server/services/home.js:110`, `server/services/home.js:148` |
| S07 | MQTT broker bridge | disabled or connecting -> subscribed/connected -> offline/closed -> reconnect; errors latch fault; publish requires client.connected. Physical state is established by reports, not publish callback. | `server/mqtt/broker.js:1` |
| S08 | Board presence and observation provenance | boot offline -> nonretained heartbeat/report -> live board; false/offline/age -> unavailable. Retained history cannot overwrite a live report. Observations record epoch/time/source; status denied is an access event rather than a lock position. | `server/services/home.js:19`, `server/services/home.js:119`, `server/services/home.js:142` |
| S09 | Sensor alert episode (mixed) | no episode -> active on gas/motion -> repeated active updates same episode -> resolved on clearing report; later detection creates a new episode. Cloud mirrors versioned gateway episodes. | `server/services/home.js:168`, `server/online/store.js:551` |
| S10 | Per-user alert receipt | unseen/unacknowledged -> read and/or acknowledged independently; receipt never resolves sensor condition. Read/ack writes are idempotent timestamps. | `server/app.js:128`, `server/online/store.js:800` |
| S11 | RFID scan handling | eligible -> UID cooldown -> suppressed repeat or fresh lookup -> authorized gated unlock / denial -> cooldown. Card authorization/version is separately persisted; no browser/cloud unlock substitute. | `server/services/home.js:174`, `server/app.js:141` |
| S12 | Assistant intent execution (mixed) | interpreted session-bound intent -> unused -> executed with stable key/result; same key replays result, different key conflicts; sensitive action refused;30s expiry -> pruned. Cloud query repeats recompute current answers. | `server/services/assistant.js:8`, `server/online/app.js:414`, `server/online/app.js:465` |
| S13 | Assistant answer / speech evidence | result cached -> available to owning actor ->60s expiry/prune; command results resolve against latest command state, query speech refreshes device facts. | `server/services/assistant.js:32`, `server/services/assistant.js:51` |
| S14 | State WebSocket and heartbeat | upgrade eligible -> active/read-only -> ping outstanding -> pong/alive or terminate; expiry/revocation/backpressure close. Per-socket snapshot sequence advances independently. | `server/realtime.js:3`, `server/realtime.js:13`, `server/realtime.js:23` |
| S15 | Voice WebSocket recording protocol | awaiting start -> ticket consumed/capturing -> chunks -> ending/transcribing -> transcript/intent -> close; cancel/error/timeout resets.3s handshake,23s recording deadline; PCM length/control guards. | `server/realtime.js:31` |
| S16 | Global voice-capture ownership | no capturing socket -> one capturing owner -> released on end/cancel/close. Up to2 voice sockets may connect, but capture mutex permits only1 at a time. | `server/realtime.js:12`, `server/realtime.js:42` |
| S17 | Speech worker readiness | disabled or unverified -> verify assets -> child starting -> ready -> unavailable on error/exit -> closed on shutdown. No automatic worker-restart transition. STT/TTS readiness is independent. | `server/voice/speech-service.js:14`, `server/voice/speech-service.js:33`, `server/voice/assets.js:3` |
| S18 | Speech RPC admission | idle -> busy/pending request -> IPC response, timeout, worker unavailable or shutdown -> promise settled. Shared busy flag serializes STT and TTS; timeout30s kills worker. | `server/voice/speech-service.js:42`, `server/voice/speech-service.js:49` |
| S19 | TTS job (mixed) | queued -> ready(audio) or failed -> expired/pruned after60s; only owning actor can inspect/download. Ready does not mean browser playback succeeded. | `server/voice/speech-service.js:77` |
| S20 | Voice ticket | issued session-bound ticket -> consumed once or expired/pruned after30s. Consumption deletes before validating. | `server/voice/speech-service.js:59` |
| S21 | Gateway enrollment (mixed) | absent -> registered/awaiting first report -> connected/offline; revoked is terminal for browser enrollment. Fresh owner reauth required; unused replacement retains gateway identity and revokes old keys; household/user locks serialize enrollment. | `server/online/gateway-setup.js:9`, `server/online/migrations/004_gateway_onboarding.sql:6` |
| S22 | Gateway credential validity | issued -> valid -> expired or revoked; operator can overlap keys during rotation; gateway revocation invalidates all associated credentials. Key life is independent of connectivity. | `server/online/migrations/001_online.sql:151`, `server/scripts/online-operator.js:129` |
| S23 | Cloud command (mixed) | queued -> delivered(lease) -> pending_observation(redeemed) -> observed/rejected/failed/uncertain. Undelivered queued timeout -> expired; delivered/redeemed timeout -> uncertain. Revocation/quarantine reject unredeemed work and make redeemed work uncertain. | `server/online/store.js:50`, `server/online/store.js:328`, `server/online/store.js:653`, `server/online/store.js:729`, `server/scripts/online-operator.js:199` |
| S24 | Gateway local command journal (mixed) | unseen -> durable claimed before redeem -> local pending_observation or immediate observed -> observed/failed/uncertain/rejected; duplicate command IDs ignored; claimed at restart -> uncertain, never blindly replayed. | `server/online/gateway.js:51`, `server/online/gateway.js:278`, `server/online/gateway.js:391` |
| S25 | Gateway network worker | disabled/connecting -> running exchange -> connected -> retry/backoff or permanent blocked -> stopped. busy suppresses overlapping runs; stop aborts current fetch. Fresh snapshots coalesce each attempt. | `server/online/gateway.js:81`, `server/online/gateway.js:234`, `server/online/gateway.js:401` |
| S26 | Exchange ticket / replay control | ticket issued -> consumed or expired; message unseen -> accepted/inbox record; exact replay -> duplicate ack; lower sequence -> stale; same identity with different digest -> conflict. Epoch and sequence are distinct dimensions. | `server/online/store.js:355`, `server/online/store.js:382` |
| S27 | Gateway result acknowledgment | local result differs from ack_state -> included in exchange -> matching accepted acknowledgment copies state to ack_state -> eligible for eventual pruning. Pending local observations advance independently of network delivery. | `server/online/gateway.js:163`, `server/online/gateway.js:432` |
| S28 | Versioned edits and creation idempotency | read version -> submit expected version -> commit next version or conflict; create key absent -> stored result -> same-request replay / different-request conflict -> expiry cleanup. Applies home/rooms/device metadata/preferences/cards, with local/cloud capability differences. | `server/app.js:79`, `server/app.js:96`, `server/online/store.js:784`, `server/db/maintenance.js:22` |
| S29 | Local application lifecycle / faults | starting -> dependencies allocated -> listening/running -> stopping once -> closed; partial startup failure cleans up. Periodic maintenance/persistence/broker errors latch fault; transport recovery does not uniformly clear it. | `server/lifecycle.js:30`, `server/server.js:8` |
| S30 | Repository durability / writer ownership | acquire lock -> open/migrate -> healthy -> transaction -> memory commit/durable export; failed export restores memory; selected IO errors latch unhealthy and reject writes; close releases lock. Restart invalidates sessions/challenges/pending commands. | `server/db/repository.js:13`, `server/db/repository.js:37`, `server/db/repository.js:47`, `server/db/repository.js:102` |
| S31 | Cloud API initialization and scoped SQL transaction | singleton app absent -> initializing promise -> ready or reset-to-null/retry; per request checkout -> BEGIN -> identity/advisory locks -> COMMIT or ROLLBACK -> release/discard broken connection. | `api/index.js:10`, `server/online/db.js:14`, `server/cloud/postgres.js:32` |

## Derived projections: do not confuse these with independent machine owners

| Projection | Inputs and meaning | Source |
|---|---|---|
| Report unknown/current/stale | Observation epoch, retained flag, report age, board age/online, broker connection, cloud gateway age and clock offset. Gas10s; other reports65s; board60s; gateway15s. The same device can have a known historical value and unavailable control. | `server/services/home.js:20`, `server/online/store.js:133`, `public/js/cloud-state.js:1` |
| Device/action eligibility | Role/can_unlock, reauth age, physical safety gates, persistence health, source/currentness, pending UI/server commands and remote-light capability. This is a product of machines, not one enabled/disabled boolean. | `server/auth/sessions.js:76`, `public/js/views.js:24`, `server/online/store.js:275` |
| Gateway online/setup summary | No row, revoked_at, last_seen_at and15s freshness produce not_enrolled/awaiting_connection/connected/offline/revoked. Key expiry is a different machine and must not be inferred from this label alone. | `server/online/gateway-setup.js:9`, `server/online/store.js:234` |

## Optional catalog transport

These modules remain selectable via explicit configuration, but are mutually exclusive with the online gateway. They are not the production browser command pipeline.

| ID | Machine | Transitions | Source |
|---|---|---|---|
| C01 | Metadata capture/coalescing | uninitialized -> journal ready; unchanged hash -> no-op; changed catalog -> next revision/new outbox record replacing older catalog; invalid projection -> capture_error/blocked and clears outbox. | `server/cloud/journal.js:6` |
| C02 | Catalog sync worker | idle/pending -> sending -> acknowledged/idle; temporary error -> persistent retry deadline; permanent error/CLOUD_AHEAD -> blocked; stop aborts. Newer catalog may replace an in-flight revision; its old ack must not delete the replacement. | `server/cloud/worker.js:19`, `server/cloud/journal.js:37` |
| C03 | Cloud catalog receipt/revision | unseen -> accepted(newer catalog) or stale; exact operation repeat returns receipt; operation/revision collisions conflict. Receipt and catalog replacement commit together. | `server/cloud/postgres.js:49` |

## ESP32 firmware machines

| ID | Machine | Transitions / constraints | Source |
|---|---|---|---|
| F01 | Wi-Fi on each board | connecting/polling -> connected or restart after40 half-second attempts; main loop reconnects after loss. Blocking function, not background recovery. | `firmware/light_controller/light_controller.ino:52`, `firmware/door_security/door_security.ino:61` |
| F02 | MQTT on each board | disconnected -> blocking connect/retry every5s -> online/LWT registered/subscribed -> loop -> reconnect on loss. | `firmware/light_controller/light_controller.ino:121`, `firmware/door_security/door_security.ino:191` |
| F03 | Four relay latches (mixed) | boot off -> on/off/toggle command -> GPIO output -> retained reported state. RAM state resets on reboot; publish is not a physical relay sensor. | `firmware/light_controller/light_controller.ino:25`, `firmware/light_controller/light_controller.ino:83` |
| F04 | Door relay/timed relock | boot locked -> unlock sets timer/output -> lock command or5s elapsed -> locked. Repeated unlock resets timer. deny flashes LEDs and reports denied but does not change doorLocked. | `firmware/door_security/door_security.ino:109`, `firmware/door_security/door_security.ino:129`, `firmware/door_security/door_security.ino:263` |
| F05 | RFID reader/cooldown | waiting -> read UID -> publish event / suppress during2s cooldown -> LED feedback -> halt reader transaction -> waiting. Authorization comes from hub. | `firmware/door_security/door_security.ino:153` |
| F06 | Motion hold/debounce | clear -> PIR high sets detected/time -> repeated high extends hold ->5s low interval clears; publish only on change using lastMotionState. | `firmware/light_controller/light_controller.ino:186` |
| F07 | Gas sampling cadence | interval not due -> sample after2s -> calculate raw/approximate ppm/threshold flag -> publish -> await next interval. Threshold comparison itself is stateless; it is not an alarm episode owner. | `firmware/light_controller/light_controller.ino:158`, `firmware/light_controller/light_controller.ino:268` |
| F08 | Heartbeat cadence | lastHeartbeat ->30s due -> publish current relay/door state -> reset timestamp; loop blocking delays this schedule. | `firmware/light_controller/light_controller.ino:277`, `firmware/door_security/door_security.ino:269` |

Critical coupling: the door main loop calls blocking Wi-Fi/MQTT recovery before reaching timed relock. A prolonged network recovery can delay that relock transition. The deny LED routine also blocks. This is visible in source and already reflected in product warnings; no hardware timing experiment was performed and no firmware was altered.

## Operational / installation machines

| ID | Machine | Transitions | Source |
|---|---|---|---|
| O01 | Schema ledger / readiness | inspect existing ledger/checksums -> apply missing forward migrations under lock -> commit or rollback; incompatible/newer schema or unsafe role -> refuse runtime. Local schema migration additionally invalidates transient state. | `server/online/migrate.js:21`, `server/cloud/migrate.js:4`, `server/online/db.js:46`, `server/db/repository.js:65` |
| O02 | Owner/user setup and password recovery | validate operator/session role -> password hash -> transactional user creation or password replacement -> session invalidation -> commit/rollback. This is not self-service browser password reset. | `server/scripts/operator.js:6`, `server/scripts/online-operator.js:31` |
| O03 | Gateway key rotation/revocation/quarantine | enroll/overlap active keys -> private output written exclusively -> DB commit; uncertain commit retains output for reconciliation. Revoke gateway/key/quarantine invalidates related access/pending commands with distinct outcomes. | `server/scripts/online-operator.js:129`, `server/scripts/online-operator.js:165`, `server/scripts/online-operator.js:199` |
| O04 | Daily backup and retention | daily backup absent -> copy + checksum -> eligible retention/pruning; existing day's backup -> reuse; failed backup blocks pruning; preserve latest7 generated backups. | `server/db/maintenance.js:2` |
| O05 | Restore | require stopped writer -> inspect integrity/schema/checksum -> trial migration -> preserve existing DB -> temporary file/atomic rename -> reopen invalidates transient credentials/commands. | `server/scripts/recovery.js:16` |
| O06 | TLS provisioning | no existing key/cert -> validate names -> generate -> write private key/cert; existing or partial pair refuses overwrite. Runtime switches between loopback HTTP and TLS based on files; LAN HTTP is rejected. | `server/scripts/tls-setup.js:2`, `server/lifecycle.js:31` |
| O07 | Model install / verification | missing model -> download -> extract -> rename -> archive cleanup -> installed or failure; existing nonempty folder skips download. Runtime independently verifies manifest size/hash before worker readiness. Downloader's final ready message is not proof workers are ready. | `server/voice/download-models.js:97`, `server/voice/assets.js:3` |
| O08 | Benchmark-only Whisper process | synthetic PCM -> temporary WAV -> child running -> bounded output/success, error, abort or timeout -> cleanup. Not wired into production SpeechService. | `server/voice/whisper.js:6`, `server/scripts/benchmark-speech.js:2` |

## Older/unwired implementations

These are present in source but not loaded by the current index/module graph or current local/Vercel server entrypoints. They are important when searching for states: mixing their transitions with active code would produce a false model. They were not deleted.

| ID | Older family | States encoded in old implementation | Source |
|---|---|---|---|
| L01 | Browser WebSocket | connected flag, increasing reconnectDelay, callbacks -> reconnect loop. | `public/js/websocket.js:9` |
| L02 | Always-listening browser voice | permission modal -> capture -> socket connected/reconnecting -> listening/speaking/wake/success/error -> feedback timeout -> listening; stop tears down resources. | `public/js/voice.js:21`, `public/js/voice.js:191`, `public/js/voice.js:417` |
| L03 | Earlier VAD variants | silence -> speaking -> trailing-silence counter -> silence; both AudioWorklet and ScriptProcessor fallback. | `public/js/audio-processor.js:6`, `public/js/voice.js:117` |
| L04 | Earlier server recognizers | models absent/loading/ready; per socket active -> partial/final transcript -> wake match -> command -> reset/free on close/error. | `server/voice/voiceEngine.js:18`, `server/voice/voiceHandler.js:18` |
| L05 | Earlier broker/presence | broker connect/offline/reconnect; ESP online flag + lastSeen -> timeout offline; direct command publication path. | `server/mqtt/mqttClient.js:16`, `server/mqtt/mqttClient.js:294`, `server/mqtt/mqttClient.js:331` |
| L06 | Earlier sql.js autosave | db absent -> initialized -> periodic disk export -> close; separate from current transactional/lock/healthy repository. | `server/db/database.js:12`, `server/db/database.js:70`, `server/db/database.js:211` |
| L07 | Earlier notifications | unsupported/default/granted/denied -> request/banner/dismiss -> delivery/audio -> timeout-close. | `public/js/notifications.js:11`, `public/js/notifications.js:60` |
| L08 | Earlier dashboard/device requests | bootstrap/list fetch -> populated/empty -> WS patches; commands -> success/offline/error feedback; separate endpoints/contracts in legacy routes. | `public/js/app.js:1`, `public/js/devices.js:154`, `server/routes/commands.js:1` |

## Models worth making explicit first

1. **Realm transition and operation ownership (U05/U06/U07/U15/U17):** one current realm/generation, explicit switching/error states, atomic transport/UI commit. Cover A1/A2 before layering new presentation over it.
2. **End-to-end command coordination (S06/S23/S24/S27):** retain three separate records; define message-driven transitions and terminal invariants in one contract. `published` is not `observed`; `delivered` is not `redeemed`; `observed` is not physical verification.
3. **Voice session (U19–U22/S15–S20):** distinguish permission, capture, processing, interpretation, confirmation, execution, synthesis and playback. Each has a separate cancellation/timeout owner.
4. **Gateway setup (U27/S21/S22/S25):** enrollment, credential validity and connectivity are separate dimensions. A future pairing-code flow needs issued/awaiting-approval/approved/claimed/expired/cancelled states; those do not exist yet.
5. **Door relock (F01/F02/F04/F05):** model independent safety timing alongside network recovery rather than assuming the next loop iteration runs on time. Requires separate supervised firmware remediation, outside a frontend rebuild.

Useful invariants for follow-up tests: an old realm cannot send a command; stale async completions cannot own current busy flags; terminal commands do not revert; retries do not duplicate physical actions; retained reports never confirm new actions; acknowledging an alert does not resolve it; cancelling voice stops microphone tracks; reconnect cannot restore revoked authorization; restored databases do not revive old sessions or pending actions.

## Verification and limits

Repository search, entrypoint/import tracing, mutation/timer/SQL transition inspection and the two mocked probes were completed. This audit did not run the live gateway, alter a database, flash firmware, deploy code or claim complete model-based state-space coverage. Existing test suites were inspected as context rather than rerun merely to produce a pass count. No unrelated files or user changes were removed. The frontend rebuild requested while this audit was in progress will preserve this baseline report and record its own fixes and tests separately.
