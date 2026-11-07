# HomeAuto — active decision record

Revision 4, 2026-11-05. Prior accepted product/design decisions remain in history/revision-3/DECISIONS.md. The following implementation decisions refine them; none silently changes Theme05, hardware IDs, offline processing or door safety.

| ID | Decision | Reason and evidence |
|---|---|---|
|024|Direct implementation, same agent; no model handoff|User full execution directive removes planning-only restriction.|
|025|Keep Express/CommonJS, vanilla ES modules, sql.js and legacy numeric MQTT protocol|No framework migration needed; preserves hardware vocabulary and low frontend overhead.|
|026|Source/DB/cert/reference backup before edits; no Git history fabricated|Workspace lacks .git; hash baseline in .local/backups/baseline-20261105.|
|027|Additive schema v5 consolidates planned M01–M05|Single explicit migration transaction preserves existing devices/cards/44 activity rows; repeatability tested on a copy.|
|028|Synchronous serialized transactions with atomic exports|Small local sql.js dataset; security writes durable before side effects, memory rollback after failed export; disk failure/lock/recovery tested. Legacy audit preserved beyond new retention policy.|
|029|Full authoritative socket snapshots with epoch/per-connection seq|Seven devices make payload bounded; avoids delta gap/reducer complexity. Stale sockets/fetch revisions guarded. No transcript broadcast.|
|030|QoS0 for every command, retainfalse/clean/no offline queue|MQTT QoS1 can resend old unacknowledged light commands after reconnect. Explicit retry and controller reports are safer than delayed action replay.|
|031|Door gate off by default; firmware unchanged pending supervised build/fixture|Original reconnect can block relock; no bolt/contact sensing; authentication and UI confirmation cannot prove physical safety.|
|032|Vosk/Kokoro fixed active profile; Whisper Base/Small benchmark-only|Native probes work; neither Whisper candidate improved tiny-corpus outcome enough or met quality/latency gates. No human accuracy claim.|
|033|Review recognized voice controls before actuation|Measured room-number omissions; user sees actual interpreted devices/action and may Cancel. Typed commands use the same strict parser/service. Unlock remains UI-only.|
|034|No always-on wake microphone|Optional wake phrase checked inside deliberately tapped capture; privacy, CPU and phone browser constraints.|
|035|SHA256 verification + native load/probe, fixed-profile confirmation|Owner cannot upload paths/executables/models or trigger runtime downloads. Dynamic provider activation/rollback omitted rather than exposed as nonfunctional controls.|
|036|Omit service worker caching|Local shell/help/manifest are provided; no session/API/audio caching or offline replay. LAN hub must remain reachable.|
|037|Only gas/motion notification categories in UI|Those have implemented persistent episodes; no fake device/access notification switches or closed-browser guarantee.|
|038|Archive revision3, synchronize active docs and retain design specs|Keeps audit/history without treating historical unauthenticated code or planning-only statements as current.|
|039|Synthetic-stream browser speech test distinct from microphone hardware test|Chromium fake-file getUserMedia returned NotSupportedError; injected stream verifies worklet/WSS/native pipeline without inventing permission/hardware success.|

See RUNTIME_CONTRACTS.md for API/module details, IMPLEMENTATION_JOURNAL.md for evidence, TASKS.md for unresolved acceptance, and OPERATIONS.md for deployment prerequisites. Firmware flash, real lock actuation, trust installation, service deployment and pushes remain outside the authorization exercised in this session.


### UI refinement decisions, 2026-11-05

- ADR040: one native History API controller/route registry; owned previous entry for Back, safe parent replacement without one; no edge-swipe implementation.
- ADR041: Room/Activity filters in URLs; scroll/focus in owned history entries; Activity cursor data only in session memory and cleared on logout. No sensitive/device-state persistence.
- ADR042: keep the approved four semantic palettes and05default; compact purposeful component layouts replace decorative headers/numbers. Qualify stale door and sensor reports without changing wire values.
- ADR043: use Unslop as offline development writing tooling only. Audit candidates first, preserve accurate safety negations and short UI labels, review Hindi separately; no blanket prose rewrite/scanner-score claim.
- ADR044: preserve login-free isolated preview and separate authenticated physical runtime. Hash checks and mock/native integration evidence do not waive hardware or household gates.
