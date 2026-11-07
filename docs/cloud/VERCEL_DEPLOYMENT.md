# Vercel and custom-domain deployment

The existing homeauto project now serves [HomeAuto](https://homeauto.amoghbuilds.tech) with the authorized restricted Neon configuration. Exact release evidence is in [production acceptance](PRODUCTION_ACCEPTANCE.md). Root `package.json` is the lean Node 22 cloud runtime; `server/package.json` remains the local hub/native speech runtime. `vercel.json` serves `public`, rewrites API routes to `api/index.js`, then provides SPA fallback for nested app routes. No Next.js migration is involved. The API restores the rewritten path, validates platform-parsed bodies, lazily creates a restricted PostgreSQL pool and attaches Vercel pool lifecycle handling. DDL and native speech never run during requests.

`npm ci --ignore-scripts` then `npm run build` runs the committed bundle guard. It traces the function and rejects SQLite runtime/data, MQTT/native voice modules, model files and certificates. `.vercelignore` and `.gitignore` exclude local databases, private environment files, credentials, native assets and generated outputs. The sanitized source is published to [AmoghRaghuwanshi/Homeauto](https://github.com/AmoghRaghuwanshi/Homeauto); exact manifest, secret scans, Actions and anonymous-clone evidence are in [publication verification](../verification/GITHUB_PUBLICATION_REPORT.md). Do not upload the hub's whole private runtime as deployment input.

## Import selections

| Vercel field | Selection |
|---|---|
| Repository / branch | AmoghRaghuwanshi/Homeauto / main |
| Framework Preset | Other |
| Root Directory | Repository root (`./`), not server |
| Node.js Version | 22.x |
| Install Command | `npm ci --ignore-scripts` |
| Build Command | `npm run build` |
| Output Directory | `public` |

Git-triggered deployment remains disabled by `git.deploymentEnabled=false` in vercel.json. These selections document the existing deployment and future imports. Keep Preview and Production database roles/branches separate and run the acceptance checks below for future releases. Do not enable remote-light flags when importing.

## Update an existing Vercel site

Pushing to GitHub updates the source repository. It does not update this site's deployment while automatic Git deployment is disabled.

1. In the existing Vercel project, check Settings → Git connects to AmoghRaghuwanshi/Homeauto. Check Production branch tracking uses main.
2. Open Deployments → Create Deployment (it may be in the header's three-dot menu).
3. Enter the exact verified commit SHA, or https://github.com/AmoghRaghuwanshi/Homeauto/tree/main to build current main. Use the existing project's reviewed environment settings. Check the selected source commit before creating the deployment.
4. Wait for Ready, then check the deployment's commit and generated URL. For staged production releases, build with Production configuration without assigning the domain, test that build, then promote it. A Preview promotion may rebuild with different environment values; do not assume it is the same tested build. Check the production domain serves the intended deployment.
5. Refresh the phone browser after the new production deployment is ready. If the page remains old, compare the displayed deployment's source SHA before changing caches or build settings.

Redeploy on an older deployment rebuilds that deployment's source; use Create Deployment to select the new commit. No automatic-deployment flag, Vercel setting, database variable, domain or remote-control gate was changed by the mobile UI verification. [Official Git-reference deployment instructions](https://vercel.com/docs/git#creating-a-deployment-from-a-git-reference), [deployment management](https://vercel.com/docs/deployments/managing-deployments).

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
