# Deployment guide — templates, not a deployment

No Neon account/project/branch, SQL role, cloud host, production migration or household service was created/changed by this assignment. The existing loopback preview remains on port3001. Physical release gates are unchanged. Do not run npm start against the protected original database merely to preview changes; use the existing running preview or an isolated simulator.

## Processes and environments

| Environment/process | Placement and authority |
| --- | --- |
| Local browser | Served by local hub; existing SPA routes/themes; no online font/API dependency |
| Local Node hub | Household machine; SQLite, private broker connection, local session authority and optional outbound catalog worker |
| Vosk/Kokoro | Local child processes and locally pinned assets; no cloud DB/AI dependency |
| Test PostgreSQL | Disposable in-memory PGlite with synthetic data; no native server, network role login or PgBouncer claim |
| Future dev/staging | Separately authorized empty/schema-only Neon branch, synthetic data, separate API secrets/enrollment |
| Future production cloud API | One supervised Node process on loopback4000 behind HTTPS reverse proxy, near Neon; catalog only |
| Future production PostgreSQL | Protected project/branch; pooled runtime role and direct migration credential; no household audio/identity/hardware records |

Local Node20.19.0 was used for these tests. The new pg/PGlite versions are locked in server/package-lock.json. Native Vosk bindings constrain hub Node upgrades; do not adopt Functions' Node24 runtime on the hub without native compatibility tests. A separate cloud API can use a supported Node LTS after its own staging checks. Functions deployment is not implemented; no neon.ts was created because Neon is used only as optional PostgreSQL here.

## Safe developer checks

```powershell
cd D:/homeauto-main/server
npm ci
npm test
npm run test:remediation
npm run test:ux
node scripts/cloud.js plan
node scripts/cloud.js grants homeauto_catalog_runtime
```

Tests do not require cloud credentials, live MQTT or native voice. Do not run native speech/browser benchmarks automatically. Run the simulator on an unused port if another is needed; do not start a second3001 listener. The simulator explicitly disables cloud sync even if the shell contains real cloud settings.

## Separately authorized Neon staging procedure

1. Operator selects account/project/region and an empty or schema-only development branch. Do not clone household data. Follow [official branching guidance](https://neon.com/docs/introduction/branching); schema-only availability/CLI flags must be checked for the installed CLI. No account or branch is assumed to exist.
2. Store direct migration URL and pooled restricted-runtime URL in a secret manager/operator session. Review scripts/cloud.js plan and target identity before any DDL. Do not overwrite an existing environment file; do not print URLs in logs.
3. In the approved migration-only environment, set DATABASE_URL_UNPOOLED and HOMEAUTO_CLOUD_MIGRATION_APPROVED=1; run node scripts/cloud.js migrate --apply. Remove that approval flag/direct credential from the API/hub environment afterward. The CLI refuses a -pooler migration hostname. It does not provision infrastructure.
4. DBA creates a dedicated LOGIN role without ownership, superuser, BYPASSRLS or inherited administrative memberships; set its password through a secure administrative channel. Review/apply the output of cloud.js grants ROLE. Enrollment is explicit admin SQL inserting household_id into homeauto_cloud.households and household_id/hub_id into hubs. Runtime cannot perform enrollment.
5. Generate a separate random32-byte hex token for each synthetic hub in the secret manager. Mount an external private JSON registry using the shape in deploy/cloud-hubs.example.json; never use the placeholder or commit real registry files. IDs must match DB enrollment, and tokens/households must be unique.
6. Start node scripts/cloud.js serve with pooled DATABASE_URL and HOMEAUTO_CLOUD_HUBS_FILE. Startup checks role/forced RLS. It listens only on127.0.0.1; configure a reviewed HTTPS proxy with body/connection/IP limits and secret-redacting logs. Expose only the catalog API, never household HTTP/MQTT or local native services. DNS/TLS/private ingress remain operator work.
7. Use a disposable hub database and fake hardware with catalog-v1 consent. Verify uploads, duplicate/commit-loss retries, revoked token/hub,503, cold start, native concurrent transactions, pool saturation, TLS verification, restart and restore reconciliation on staging. Measure India-to-region latency; do not infer it from geography.
8. Review bills/branch TTL, backup/restore drill, user consent and security gates before any production activation. A passing build or local PGlite test is not this approval.

The checked-in npm run test:cloud-staging harness refuses to connect without HOMEAUTO_CLOUD_STAGING_TEST_APPROVED=1 and HOMEAUTO_STAGING_EXPECTED_DATABASE matching the URL database. Supply HOMEAUTO_STAGING_HOUSEHOLD_ID/HUB_ID and HOMEAUTO_STAGING_OTHER_HOUSEHOLD_ID/OTHER_HUB_ID for two separately enrolled synthetic households. It refuses to replace a non-fixture catalog, runs eight concurrent/out-of-order operations through the real pg pool, checks duplicate/scope/context isolation, and leaves nine unique synthetic receipts/catalog operations for inspection. It runs no DDL, hardware, speech or deletion. Its approval/target guards were tested locally; actual network execution was not possible without authorized credentials. Cleanup is a separate reviewed operator action.

## Environment variables

New template: deploy/cloud.env.example. No dotenv loader was added: use the operator's secret injection or service manager.

| Variable | Process / default / requirement |
| --- | --- |
| HOMEAUTO_CLOUD_SYNC_ENABLED | Hub; default disabled; only exact1 enables |
| HOMEAUTO_CLOUD_CONSENT | Hub; must be catalog-v1 when enabled |
| HOMEAUTO_HOUSEHOLD_ID, HOMEAUTO_HUB_ID | Hub; stable lowercase UUIDs, matching journal and cloud enrollment |
| HOMEAUTO_CLOUD_ORIGIN | Hub; HTTPS origin only, no path/query/userinfo/fragment |
| HOMEAUTO_HUB_TOKEN | Hub;32-byte random lowercase hex; never browser/voice environment |
| DATABASE_URL | Separate cloud API only; pooled restricted-role PostgreSQL URL; verified TLS |
| DATABASE_URL_UNPOOLED | Reviewed migration operator only; direct URL; not required by hub/API serving |
| HOMEAUTO_CLOUD_MIGRATION_APPROVED | Migration operator; default0; exact1 plus --apply required; never proof of authorization by itself |
| HOMEAUTO_CLOUD_HUBS_FILE | Cloud API; external private registry path, not a frontend asset |
| HOMEAUTO_CLOUD_PORT | Cloud API; integer1–65535, default4000; loopback binding fixed |
| HOMEAUTO_CLOUD_STAGING_TEST_APPROVED | Staging harness only; exact1; never set for normal hub/API operation |
| HOMEAUTO_STAGING_EXPECTED_DATABASE | Staging harness; exact approved database name; checked before connection |
| HOMEAUTO_STAGING_HOUSEHOLD_ID, HOMEAUTO_STAGING_HUB_ID | Staging harness; first enrolled synthetic writer |
| HOMEAUTO_STAGING_OTHER_HOUSEHOLD_ID, HOMEAUTO_STAGING_OTHER_HUB_ID | Staging harness; separate enrolled synthetic tenant |

Retained hub variables are documented in lifecycle.loadConfig: HOMEAUTO_HOST/PORT/DB_PATH, CERT_PATH/KEY_PATH/ALLOWED_HOSTS, MQTT_ENABLED/BROKER/USERNAME/PASSWORD/CA, DOOR_ENABLED, VOICE_ENABLED/MODELS_DIR, TTS_PYTHON/MODEL/VOICES. Host defaults127.0.0.1; LAN binding requires new local TLS files. MQTT and physical door are off by default; voice is local. The in-memory simulator can simulate door actions without enabling any physical gate. Do not change deployed broker/door/TLS settings as part of cloud setup.

## Operations and release

Use a local service supervisor for the hub and a separate single-instance supervisor for the optional API. Configure restart-on-failure with bounded delay and enough shutdown time for SQL timeout/connection cleanup. Source includes clean SIGINT/SIGTERM API close and pool shutdown; actual OS service units, proxy certificates, monitoring and secret-manager configuration are not installed. Keep API concurrency/rate controls at ingress before scaling replicas.

CI should run npm ci, npm test and isolated browser suites, then approved staging tests with synthetic credentials; protect production jobs and never run firmware/door/native speech tests as CI side effects. No remote CI was configured. Monitor local persistence health, board age, speech readiness, cloud blocked/pending state, last ack/retry count, API503/429, SQL pool waits, receipt growth and spending. /health/live is liveness only; use an authenticated catalog read with a synthetic enrolled canary for cloud readiness, and owner /api/system for local diagnostics. Existing /api/health also remains liveness only.

Rollback: disable catalog sync, retain local DB/backup and old application, roll API source back while keeping the additive cloud schema/receipts. Do not restore cloud metadata over local hardware state. Read RECOVERY_PLAN.md before restoring a journal. Production activation remains blocked on actual Neon transport/concurrency/operational tests and separate hardware/TLS release work.
