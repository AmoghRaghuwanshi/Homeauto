# Production acceptance — 2026-11-07

Target: https://homeauto.amoghbuilds.tech, existing Homeauto Vercel project and its existing Neon production branch. This continues the published application; no firmware, MQTT vocabulary, physical controller behavior or local household database changed.

## Initial connection repair

The first live check returned CLOUD_CONFIGURATION_REQUIRED because DATABASE_URL was absent. After the user's Marketplace connection, the API reached Neon but correctly rejected neondb_owner with UNSAFE_DATABASE_ROLE. Both the production and development HomeAuto schemas were initially absent.

The existing production database was verified empty of HomeAuto objects and snapshotted before installation. An isolated acceptance branch was created first. The original migrations 001 and002 were installed atomically with their original SHA256 ledger entries. The new homeauto_online_api role has no superuser, RLS-bypass or table-owner membership. Its explicit grants exclude direct users/sessions access and global maintenance. Native Neon queries verified20 tables,15 forced-RLS tables, tenant isolation and the expected restricted permissions.

Production received the same checked schema and grants after the empty-target guard and snapshot. Both pooled DATABASE_URL and direct DATABASE_URL_UNPOOLED in the Production environment now use the restricted role; owner credentials are not injected into the deployed function. APP_BASE_URL is the exact custom HTTPS origin. The Vercel project was changed from its26.x default to the tested22.x runtime. Remote-light gates remain0; remote door requests stay disabled.

The source0536222 production deployment then returned200 for health/runtime and401 for an unauthenticated session. Real Neon-backed owner sign-in, Secure/HttpOnly/Strict response-cookie attributes,15 routes, all four themes, nested refresh/history, mobile landscape navigation and tablet/desktop layouts passed in Chromium:19 screenshots,0 page/server errors or external requests. An initial owner account was created with a generated password saved outside the checkout in a user/SYSTEM-only directory. Passwords and connection strings are excluded from reports and source.

There are no production device reports or simulated hardware confirmations. The home correctly asks for gateway enrollment.

## Signup continuation

The user requested public signup after the connection repair. The implementation retains the working PostgreSQL-backed identity system. Additive003_self_service_signup.sql creates a narrowly defined SECURITY DEFINER registration function; it never alters existing passwords, households or device state. New registrations create their own private household and owner membership atomically. They cannot select a role or join an existing household. PUBLIC cannot execute the helper; only the restricted backend role receives the reviewed grant.

The API validates origin/content type, permitted fields, display name, username and12–256-character passwords. Scrypt hashing shares the bounded authentication worker limit. Signup is limited to5 attempts/IP/hour and50 globally/hour. Duplicate names return409 without replacing credentials or leaving an orphan home. Signup returns201 without a session; separate sign-in uses the existing secure session flow.

The public/signup page links to/login and is linked from sign-in. It includes confirmation, password visibility, Hindi/English, native autofill, hints and accessible error feedback. Language switching retains only live form values; passwords are never written to browser storage. The four theme palettes/default05 remain. Mobile auth headings are compact and auth padding includes safe-area insets.

Readiness accepts schema2 or3 during this additive rollout so existing sign-in stays available. Registration fails closed until003 and its grants are installed. Production is upgraded only after the compatible release is Ready. System diagnostics read the actual migration version.

Fresh local backend verification:161 tests passed. Both engines passed the focused account lifecycle; the complete32-layout/33-accessibility-scan auth matrix per engine is required by CI before deployment. Initial test failures exposed verbose labels when helper text entered the accessible name, translated language-picker endonyms and a premature dialog-focus assertion; corrections and raw evidence are retained outside the publish tree.

## Evidence boundaries

Evidence directory: D:/homeauto-audit-tools/production-acceptance-20261107. The Windows resolver refused Neon endpoint DNS, so the standalone native staging harness could not run locally. Actual PostgreSQL18 installation, role and RLS checks used the authenticated Neon connector. Vercel function connections and production HTTP/auth flows were tested on the real custom domain.

Protected-preview browsing is unavailable through the current connector scope (403 reading protection-bypass metadata). Protection was not disabled. A WebKit-on-Windows cookie diagnostic reports sameSite=None in browser metadata despite the actual Set-Cookie header explicitly containing SameSite=Strict, Secure and HttpOnly; that discrepancy remains separately recorded and is not presented as weakened application policy or verified native-Safari enforcement.

Real gateway/firmware/broker rollout, physical actuation/relock, sensor calibration, native voice, real phone keyboards/notches and human screen-reader/language acceptance remain separate gates. No paid-plan upgrade, DNS change, hardware command or automatic Git-deployment enablement occurred. Exact final release/CI/deployment and live signup results are recorded when execution completes.
