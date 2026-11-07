# HomeAuto — current implementation context

> UI refinement update, 2026-11-05: shared navigation/history and My Home repair, URL/list/preference restoration, four-theme component polish and Unslop audit are implemented. Current evidence and exact continuation are in [docs/DEVELOPMENT_STATE.md](../docs/DEVELOPMENT_STATE.md) and [UX test results](../docs/ux/TEST_RESULTS.md). Prior hardware, speech-human and manual accessibility release gates remain open.


Active revision 4, 2026-11-05. Workspace D:\homeauto-main has no .git metadata. The user's full execution directive authorizes implementation and replaces the earlier planning-only/model-handoff restriction. This agent remains the implementing engineer; there is no handoff.

The actual active application is version 2.0.0: Node/Express/CommonJS backend, vanilla browser ES modules, MQTT/ws/sql.js and isolated native Vosk/Kokoro CPU workers. Read IMPLEMENTATION_JOURNAL.md for exact paths and evidence, RUNTIME_CONTRACTS.md for actual behavior, OPERATIONS.md for startup/recovery, and TASKS.md for remaining gates. Revision-3 documents are preserved under history/revision-3 and describe the historical baseline and approved specifications.

Implemented: four selectable themes with 05 default; responsive five-route shell and secondary screens; rooms/devices/favorites; protected door/cards; persistent alerts/activity; bilingual interface; local users/sessions/roles/CSRF/Origin/Host; central command tracking and truthful controller-report freshness; typed assistant and reviewed voice controls; local STT/TTS and asset verification; atomic DB snapshots/backups/retention/recovery; safe TLS/broker templates.

Tests: 63 Node/HTTP/WS/TLS regressions pass. Browser matrix, secondary screens and native speech evidence are recorded in .local/qa and the journal. Native English/Hindi synthesis and recognition were executed. Hindi room-number recognition remains unreliable. Synthetic English/Hindi/Hinglish comparison is not human accuracy evidence. No automatic always-on microphone or cloud fallback is used.

Original production DB remains untouched: 7 devices, 0 cards, 44 historical activity rows. All test databases are memory or temporary copies. Existing firmware, pins, IDs, reference PNGs and bundled certificate/key were preserved. Baseline source and docs have SHA256 backup in .local/backups/baseline-20261105. New runtime never reads the bundled exposed key. Old frontend/backend handlers remain as unmounted historical source, not supported startup paths.

Secure defaults: loopback only; MQTT disabled; physical door disabled; no default password; no action replay. The isolated preview is explicitly labelled Simulation and now opens directly without login; account/sign-out options and password prompts are hidden for this in-memory mode. Authentication remains enforced by the separate physical-device runtime. Real hardware and broker validation has not occurred.

Open release gates: authenticated TLS firmware/broker ACL fixture, relock priority and supervised door/egress/outage tests, consented human speech holdout/voice auditions, native Hindi translation review, actual microphones/phones/trusted HTTPS, NVDA/keyboard/zoom/forced-colors and older-user trials, Windows interruption/service recovery and redistribution notices. Keep the door gate off.

Next: use npm run preview:isolated for UI review; prepare HA-009/010 credentialed TLS firmware plus a supervised fixture before release. No hardware flash/push/deploy is authorized.
