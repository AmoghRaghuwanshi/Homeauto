# Security model

Existing controls remain: local scrypt N=32768/r=8/p=1, random salts, hashed random session tokens, HttpOnly/SameSite Strict cookies, Secure __Host cookie under TLS; 30-minute idle and eight-hour absolute lifetime; five-minute fresh reauthentication for sensitive operations; owner/resident/viewer checks on the server. Read-only WebSocket pings do not renew idle sessions. Explicit authenticated/CSRF-protected user activity does. Logout/reauth revokes sockets. Local account recovery stays an operator procedure, not cloud password reset.

HTTP enforces configured Host names and same Origin, JSON limits, CSRF for mutations, mutation rate limiting, bounded login attempts and scrypt concurrency. CSP/fonts/scripts/media remain local. WebSocket upgrades require session and Origin, bounded connections/payload/buffers, current authorization and guarded heartbeats. Offline voice keeps ticket/job/audio ownership, private local processing, explicit microphone input, strict intent resolution and local permissions. No new login options or cloud authentication UI was added.

## New boundaries

| Boundary | Enforcement |
| --- | --- |
| Browser → local hub | Existing cookie/Origin/CSRF/role checks; cloud configuration never enters browser bundles |
| Hub → catalog API | Opt-in HTTPS; random 32-byte per-hub token; no redirects; bounded body/reply/time; no cookies or arbitrary endpoints |
| Catalog API authorization | Private registry maps token digest to fixed household/hub; body must match; revoked DB enrollment rejects requests |
| API → PostgreSQL | Verified TLS, small server-side pool, parameterized SQL, per-transaction trusted RLS context and lock |
| SQL runtime | Non-owner/non-superuser/non-bypass role, forced RLS checked at boot; limited grants; separate migration credential |
| Cloud → local | Matching metadata acknowledgments only; no message-to-command dispatcher |

The implemented API is server-to-server. Browser Origin requests are rejected; CORS and cookie auth are absent. Authenticated requests are limited to 60/minute per enrolled hub per process; JSON body is 32 KiB. Place one API process behind an HTTPS ingress with independent unauthenticated IP/body/connection limits, trusted TLS termination and secret-redacting logs. Application rate state is not distributed; do not scale replicas without ingress/distributed enforcement. Tokens are never logged; the API stores digest values in process memory, while the secret registry is an external mounted file. No real tokens were generated or deployed by this assignment.

RLS protects against accidental cross-household SQL. Its context is supplied by trusted authenticated server code. A stolen shared database credential can deliberately set another context; RLS is not protection against complete API/DB-secret compromise. Use network restrictions where available, restricted credentials, audited enrollment and separate secrets. A compromised hub can change its consented metadata mirror, not authorize local residents or execute devices in another household. Rotate/revoke a hub token and restart the catalog API registry when compromised; coordinate the corresponding hub secret outside source.

No hub gets DATABASE_URL. No browser gets either database or hub credentials. Migrations do not run on API or hub startup. The CLI needs both --apply and HOMEAUTO_CLOUD_MIGRATION_APPROVED=1 plus a direct URL for DDL. This is an operator guard, not proof of human approval; only use it on separately authorized targets. SQL role creation, password setting, TLS/private networking and enrollment require operator review. No provisioning or production migration occurred.

## Physical and privacy gates

HOMEAUTO_DOOR_ENABLED remains off. No source changes to firmware, MQTT topics, RFID rules, deployed broker credentials or certificates. AUD-001 blocking firmware relock, AUD-002 broker/firmware TLS/credential mismatch and AUD-003 historical exposed key remain release blockers. Existing software checks do not prove safe physical relock, broker compatibility or certificate rotation.

Backups and manifests stay private; whole-table hashes and schema/count information can still reveal operational metadata. Encrypt household backups at rest using the operator's established vault/storage controls and restrict Windows ACLs. Local repository file mode requests do not establish Windows ACL guarantees. No cloud backup uploads, encryption-key system, remote account recovery, remote unlock or public broker exposure was added. Retain independent local backups even when the mirror is enabled.
