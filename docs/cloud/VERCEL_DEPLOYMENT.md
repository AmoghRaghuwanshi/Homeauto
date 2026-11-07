# Vercel and custom-domain preparation

Prepared, not deployed. Root `package.json` is the lean Node 22 cloud runtime; `server/package.json` remains the local hub/native speech runtime. `vercel.json` serves `public`, rewrites API routes to `api/index.js`, then provides SPA fallback for nested app routes. No Next.js migration is involved. The API restores the rewritten path, validates platform-parsed bodies, lazily creates a restricted PostgreSQL pool and attaches Vercel pool lifecycle handling. DDL and native speech never run during requests.

`npm ci --ignore-scripts` then `npm run build` runs the committed bundle guard. It traces the function and rejects SQLite runtime/data, MQTT/native voice modules, model files and certificates. `.vercelignore` and `.gitignore` exclude local databases, private environment files, credentials, native assets and generated outputs. The source workspace currently has no Git metadata; exclusions are prepared, not evidence of a clean remote commit. Do not upload the hub's whole private runtime as deployment input.

## Environment setup after approval

Use the platform's secure environment management, separately for Development, Preview and Production:

| Variable | Value source |
|---|---|
| DATABASE_URL | Neon restricted runtime role, pooled connection; server only |
| APP_BASE_URL | Exact HTTPS origin of this environment's canonical domain |
| ALLOWED_ORIGINS | Optional comma-separated exact HTTPS aliases, no wildcard/path/trailing slash |
| HOMEAUTO_CLOUD_REMOTE_LIGHTS_ENABLED | `0` initially |
| HOMEAUTO_REMOTE_LIGHTS_APPROVED | `0` initially; independent later authorization |

If APP_BASE_URL is absent, VERCEL_URL supplies the environment's exact deployment origin; no arbitrary Host header is trusted. `PUBLIC_APP_URL` and `SESSION_COOKIE_DOMAIN` are unnecessary: browser calls are same-origin and the Secure, HttpOnly, SameSite=Strict `__Host-` cookie is host-only. A sibling domain does not share a session. No database variable may have a public/client prefix. Do not set gateway tokens, native MQTT credentials or operator passwords in frontend assets.

Connect Neon using the [Vercel storage integration](https://vercel.com/docs/marketplace-storage). Inspect the actual injected variable names; integration defaults do not guarantee least privilege. Use an isolated preview branch and replace the runtime URL with the restricted role connection. Keep the direct owner URL in an approved operator context. Do not run production migrations from build hooks or preview builds. No service or paid plan has been provisioned here.

## Deployment/domain acceptance

1. Approve staging deployment, select the root project, verify Node 22 and the supplied build/output settings. Run staging PostgreSQL/auth/tenant/failure tests first. The local build trace is not a hosted Vercel build.
2. Inspect deployed health/configuration behavior, API rewrites and direct nested refreshes; sign-in/CSRF/logout/idle expiry; no-store API headers; CSP and disabled cloud microphone. Verify no secret/source/database download is possible. Use an isolated simulated gateway, with remote lights OFF by default.
3. Add the user's actual domain in Vercel and complete its ownership verification. Apply **only the DNS records shown for that project/domain** at the registrar; no domain or record values are invented here. Wait for DNS and certificate issuance, select canonical redirects, then update APP_BASE_URL/allowed aliases and redeploy approved configuration.
4. Verify HTTPS, certificate chain, redirect behavior, host-only Secure cookies, exact origins, browser history/refresh, sign-out, gateway TLS, headers and access from an actual phone. Do not enable HSTS subdomain/preload policies without reviewing the entire domain estate.

Official guidance reviewed 2026-11-06/07: [configuration](https://vercel.com/docs/project-configuration/vercel-json), [environment variables](https://vercel.com/docs/environment-variables), [database pool lifecycle](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package), [custom domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain). Function budget is explicitly 30s, with 3s pool acquisition/5s statement bounds and 5s gateway requests; platform quotas/ingress/region/cost still require deployment checks.
