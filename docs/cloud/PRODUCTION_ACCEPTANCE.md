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

Fresh local backend verification:161 tests passed before the final rollout regression was added; the final focused signup suite passed13 tests. [Release CI42359856117](https://github.com/AmoghRaghuwanshi/Homeauto/actions/runs/42359856117) passed all four jobs for96d2429cbe4e86aa6d306145b48c8701715674e9: secrets, software, mobile Chromium and mobile WebKit. Each browser job includes the existing mobile suite and the complete32-layout/33-accessibility-scan auth matrix. Initial test failures exposed verbose labels when helper text entered the accessible name, translated language-picker endonyms and a premature dialog-focus assertion; corrections and raw evidence are retained outside the publish tree.

## Production signup release

Vercel deployment dpl_kkJ9TcsWLfjUnPfchs2wmfhhWy12 is Ready in the existing homeauto project, built from96d2429cbe4e86aa6d306145b48c8701715674e9 on Node22. The custom domain serves that commit's main.js and app.css exactly as Git blobs; the Windows checkout's CRLF conversion was accounted for. No automatic Git deployment was enabled.

After the compatible application was Ready and health returned200, production received003 and the reviewed runtime grants atomically under the migration advisory lock and an exact001/002 checksum guard. Schema version3,15 forced-RLS tables, no runtime RLS bypass, no direct credential-table SELECT and the registration EXECUTE grant were verified on the actual production branch. The requested additional pre003 snapshot was refused by the account's snapshot limit; the original pre-install snapshot remains. No snapshot was deleted and no plan was upgraded.

The public page is [Create account](https://homeauto.amoghbuilds.tech/signup), also linked from [Sign in](https://homeauto.amoghbuilds.tech/login). Live Chromium verification passed8 groups and46 screenshots: four themes at320/390/844/768/1440 widths, direct route/history, confirmation, Hindi drafts, actual201 registration, duplicate409 feedback, separate sign-in, new private owner household, empty device inventory, authenticated schema3, Home navigation and logout401. Cookie response attributes and Chromium metadata both confirm Host prefix, Secure, HttpOnly and SameSite=Strict. No application errors, observed5xx, external requests or disallowed mutations occurred in the successful run. One clearly labeled QA account was created; its generated credentials remain in the protected private evidence directory and all successful test sessions were logged out. No device data was seeded.

The first live matrix attempt hit a30-second navigation/load timeout after30 captures while the API stayed healthy200; its failure is retained separately. The completed run uses the application's normal internal links for repeated layout checks. An initial Chromium launch also selected a WebKit-only browser directory; the corrected launch uses the installed Chromium cache. These are separate from the successful results.

## Safari history follow-up

The first live WebKit internal-navigation matrix exposed an actual navigation defect after24 captures: focus/scroll events called replaceState often enough to reach WebKit's100-writes/10-second limit. This failed run is retained in live-signup-webkit-final. Passive state writes now coalesce for300ms and skip unchanged entries; explicit navigation/query changes/page hide flush state and popstate cancels pending writes. The existing focus/scroll restoration behavior remains covered by the30-group UX suite.

Source d8eae6d581c8aafdfa2af5687b3d128e85a3438d adds that repair and a120-focus/60-scroll browser regression. Both focused engine runs passed5 groups with zero errors. [CI42386978810](https://github.com/AmoghRaghuwanshi/Homeauto/actions/runs/42386978810) passed all four jobs, including the complete signup/mobile matrices, before production deployment dpl_EojWN9ERnmvEHXEEJ4zXWfYSm7rg became Ready. The public domain's navigation.js, main.js and app.css match that exact Git source. Database schema3 remains unchanged by this follow-up.

Final production reruns passed in both Chromium and WebKit:7 groups and46 screenshots per engine, zero page errors, observed5xx, external requests or disallowed mutations. Both repeated the live rapid focus/scroll regression, four-theme auth layouts across five widths, real Neon-backed sign-in/private household, schema3, gateway-required state, My home and logout401. These reruns reuse the one QA identity rather than creating extra public accounts. Evidence: live-signup-chromium-verified/results.json and live-signup-webkit-verified/results.json. Representative phone and desktop captures were visually inspected. Three final health reads per engine returned200. The earlier actual signup/duplicate checks remain the separate successful Chromium registration evidence above.

## Evidence boundaries

Evidence directory: D:/homeauto-audit-tools/production-acceptance-20261107. The Windows resolver refused Neon endpoint DNS, so the standalone native staging harness could not run locally. Actual PostgreSQL18 installation, role and RLS checks used the authenticated Neon connector. Vercel function connections and production HTTP/auth flows were tested on the real custom domain.

Protected-preview browsing is unavailable through the current connector scope (403 reading protection-bypass metadata). Protection was not disabled. A WebKit-on-Windows cookie diagnostic reports sameSite=None in browser metadata despite the actual Set-Cookie header explicitly containing SameSite=Strict, Secure and HttpOnly; that discrepancy remains separately recorded and is not presented as weakened application policy or verified native-Safari enforcement.

The Vercel runtime-log query for the exact new deployment also returned403, not an empty successful error scan. No authenticated CLI fallback is installed. Successful browser runs record observed response statuses/page errors, but centralized platform-log access remains unverified; no clean platform-log claim is made.

Real gateway/firmware/broker rollout, physical actuation/relock, sensor calibration, native voice, real phone keyboards/notches and human screen-reader/language acceptance remain separate gates. No paid-plan upgrade, DNS change, hardware command or automatic Git-deployment enablement occurred. Documentation-only follow-up commits retain the deployed application's runtime files; another deployment is not required for those report edits.
