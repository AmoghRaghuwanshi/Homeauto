# HomeAuto — active execution plan

> UI refinement update, 2026-11-05: shared navigation/history and My Home repair, URL/list/preference restoration, four-theme component polish and Unslop audit are implemented. Current evidence and exact continuation are in [docs/DEVELOPMENT_STATE.md](../docs/DEVELOPMENT_STATE.md) and [UX test results](../docs/ux/TEST_RESULTS.md). Prior hardware, speech-human and manual accessibility release gates remain open.


Revision 4, 2026-11-05. Direct implementation is authorized and has proceeded through the dependency-safe software work. No model handoff. Preserve the original design specifications and original source backup; actual code and RUNTIME_CONTRACTS.md define current behavior.

Completed implementation groups: injectable runtime and isolated tests; durable schema-v5 storage and auth; central command/observation service; four-theme components and responsive router; rooms/devices/home/security/cards/alerts/activity/settings; deterministic bilingual assistant; bounded capture and isolated CPU STT/TTS; local operational tooling and documentation. IMPLEMENTATION_JOURNAL.md records exact paths and actual verification. TASKS.md separates verified tasks from incomplete acceptance gates.

Remaining dependency order:

1. Resolve HA-009/010 deployment dependencies: actual broker credentials/CA/interface, Mosquitto ACL test fixture, ESP32 TLS/auth configuration and relock-priority implementation/build. Do not flash or actuate a real lock without explicit supervised approval.
2. Obtain consented human speech and native language/voice review (HA-032/033); benchmark holdout false actions, rejection, CPU, peak RAM and latency on the target hub. Keep reviewed voice controls and typed/manual fallback.
3. Complete phone/trusted-HTTPS, microphone, assistive technology, zoom/forced-colors, storage-denied and household trials (HA-036/038/039). Keep actual coverage separate from automated axe.
4. Complete Windows process/power/service recovery and real broker regression gates (HA-037/040).
5. Supervised hardware fixtures HA-041/042, then release/packaging/security review HA-043/044. Keep door disabled until those safety gates pass.

The offline application already has local assets/help/manifest; service worker caching is optional and omitted to avoid caching household/API/audio/session data. All source changes stay local. Review screens and tests while release gates are pending; simulation does not waive physical validation.
