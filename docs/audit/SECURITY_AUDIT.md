# Security audit

Date: 2026-11-06. Read-only source/credential-provenance review plus isolated API and mock tests. No intrusive network scan, key exploitation, production authentication attempt, physical unlock or real RFID administration occurred.

## Current security posture

The replacement backend is materially safer than the original: session protection applies to household reads and writes, mutations require same-origin JSON and CSRF, Host/Origin checks apply to HTTP and both socket paths, scrypt hashes replace any implicit identity, and roles/grants/challenges protect sensitive operations. It is still a development system with unresolved high-priority failures and physical deployment gates.

The login-free UI requested by the user is confined to scripts/preview.js: an explicit loopback in-memory fixture installs a guest session adapter and a fake publisher. The production lifecycle does not install that adapter. Do not transfer it into production to hide login controls.

## Findings and exploitability assumptions

| Issue | Priority | Security relevance / preconditions |
|---|---|---|
| AUD-001 | P0 | Inherited firmware safety failure if an energized unlock overlaps reconnect/blocking work. Backend default gate mitigates current runtime exposure; actual installed hardware not inspected. |
| AUD-002 | P1 | Secure firmware/broker rollout incomplete. Weakening broker authentication would allow direct actuator commands outside HTTP policy. |
| AUD-003 | P1 | Original private server key remains public and local byte identity was confirmed. Exploitation depends on a deployment/client still using/trusting it and an appropriate network position. New default paths avoid it. |
| AUD-004 | P1 | Authorized user text may request a query but cause a control. Voice review and backend unlock rejection limit impact; this is not an unauthenticated unlock bypass. |
| AUD-005 | P1 | Passive sockets keep an unattended authenticated browser alive for up to the absolute lifetime;30-minute idle logout claim is false for that path. Unlock still needs recent reauthentication. |
| AUD-006 | P1 | Storage/session-touch failure escapes heartbeat callback, risking hub process death. Requires a relevant storage failure/touch, not an arbitrary remote crash proven in this audit. |
| AUD-009 / AUD-011 / AUD-012 | P2 | Stale/partial safety-relevant feedback can mislead a legitimate resident; no physical verification is available. |
| AUD-016 | P2 | Operator restore can replace a usable DB with an unsupported schema before detecting the problem; recoverable prior copy is retained. |

See [BUG_REPORT.md](BUG_REPORT.md) for source lines, safe reproductions, confidence and required tests. Severity is not an assertion that all conditions are exploitable on the currently running preview.

## Controls verified or traced

| Boundary | Evidence and limits |
|---|---|
| Authentication/roles | Fresh14-case HTTP/WS suite passed unauthenticated rejection, owner/viewer boundaries, login cookie handling and reauthentication. Code validates roles and can_unlock separately. |
| CSRF, Origin, Host | Mutation JSON/Origin/header checks, Host allowlist and cross-origin socket rejection tested. No permissive CORS in active app. |
| Sessions | Random32-byte tokens, stored hashes, HttpOnly/SameSiteStrict, Secure __Host cookies when TLS; absolute8h and reauth5m code traced. Idle30m needs AUD-005. |
| Unlock | Gate off by default; explicit fixed action; manual grant+reauth+challenge; challenge consumed durably; assistant unlock refused; no automatic command retry. No live unlock tested. |
| RFID | Owner-sensitive writes, canonical UID, version validation, durable card data/audit; fresh suite uses synthetic in-memory cards only. Hardware scan identity is still cloneable. |
| Input/data | Strict allowed JSON fields, bounded16KiB body, bounded strings/cursors, prepared SQL, fixed device registry, rejected sensor actuation. Database bytes loaded read-only for baseline inspection. |
| Rendering | Active components create text nodes/attributes rather than inserting user HTML; self-only CSP, no inline event attributes/remote fonts. Legacy innerHTML scripts remain unloaded. |
| WebSockets | One upgrade dispatcher, authenticated Origin/session, voice ticket, bounded payload/clients/backpressure, heartbeat/revocation. Heartbeat error containment needs AUD-006. |
| Speech privacy | Explicit capture, filtered worker environment, in-memory bounded audio, per-user expiring no-store output. Real OS/microphone cleanup not exercised here. |
| Models | Fresh hash verification of30 files/506,702,900 bytes passed. Fixed profiles, no arbitrary URL/path/upload API. Manifest provenance is not a universal supply-chain signature. |
| Local network/TLS | LAN startup requires certificate/key presence and broker rejects remote plaintext URLs. Actual trusted chain, SANs, firewall, listener and ACL configuration remain operator validation. |
| Errors/logging | Error envelope avoids stack/SQL detail to clients; active audit stores full UID for owners and redacts selected fields for other roles. At-rest records/backups are not encrypted. UI rejection handling needs AUD-014. |

The original public repo still exposes the retired key artifact: [original repository](https://github.com/Mishrajishri/homeauto). Merely adding .gitignore does not remove upstream copies/history. Rotation and removal of old trust take precedence over cosmetic source cleanup. No key/certificate private material, real password or token is copied into the reports.

## Dependency and provenance checks

Installed primary versions were read from local package files: Node20.19.0, Express4.22.3, MQTT.js5.16.1, ws8.22.1, sql.js1.15.2 and Vosk0.3.39. A direct read-only npm advisory bulk request submitted production package names/versions from package-lock.json; **145 package names returned no advisories** at audit time. No dependency was installed, updated or automatically fixed.

This result covers that registry response only. Native Vosk/FFI/ONNX/eSpeak code, Python package advisories, firmware libraries/toolchain, browser/OS and package-source provenance were not exhaustively audited. No broad “zero vulnerabilities” security certification follows from a registry result.

## Code-derived risks not counted as additional confirmed exploits

- UID-only authorization lacks cryptographic anti-cloning; scan timestamp/cooldown is not a nonce. Retained scans are rejected but a privileged republisher can send fresh-labelled captures.
- The board directly accepts unlock/toggle_lock. A broker ACL failure or compromised board principal can bypass the hub's UI challenge. No actual broker ACL enforcement was tested.
- Commands are not retained/queued by the hub, but the legacy wire has no command ID, expiry or authentication. End-to-end exactly-once and bounded-delivery claims are unjustified.
- Restore checks lock existence before swapping but does not hold an atomic exclusive writer lock throughout validation/replacement; concurrent operator startup deserves an isolated race test.
- Session touch maps, mutation counters and long-running worker/process failures merit longevity/resource tests; no remote resource-exhaustion exploit was demonstrated.
- Filesystem modes do not by themselves establish correct Windows ACLs. DB, backups, credentials, local speech assets and private keys need operator-owned permissions and recovery policy.
- Native child failure/stdio errors and Windows launcher/worker process-tree cleanup need fault injection; do not assume a launcher PID is the inference worker.
- No security conclusion was drawn from the dangerous code remaining in unmounted legacy modules. Loading/mounting it later would reintroduce known unsafe behavior.

## Safe remediation ordering

1. Keep the door gate off. Establish an operator plan for the exposed old key/trust and the secure firmware/broker migration (AUD-001–003). This audit does not authorize remote history edits, trust changes or flashing.
2. Fix query/action parsing and passive session renewal; then contain storage errors in every asynchronous boundary (AUD-004–006). Add isolated regressions before changing behavior.
3. Correct state/response honesty, metadata/restart persistence and restore preflight; retain failure visibility and all authorization boundaries.
4. Run role/CSRF/Origin/Host/WS/audio ownership and no-replay suites with injected dependencies. Use an isolated credentialed broker/emulator for transport policy.
5. Only after build/software gates and explicit authorization perform supervised fixture and real household trust/egress testing. Do not deploy a public listener or weaken verification as a shortcut.

