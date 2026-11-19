# HomeAuto website deployment

This folder is the standalone cloud website and API for the HomeAuto domain. It contains no firmware or local broker runtime. The existing Vercel project can keep its repository root setting: root `api/index.js` loads this folder's API, and root `vercel.json` builds and serves `website/public`. Git deployments are enabled in both configurations. The project can also be switched to Root Directory `website` later without changing this folder.

The canonical source remains at the repository root. Run `npm run site:sync` at the root after editing the frontend or cloud API. CI runs `npm run site:check` and rejects an out-of-date website copy. The laptop hub stays in `server/` at the repository root and runs separately.

See [the remote hub flow](../docs/cloud/REMOTE_HUB_ARCHITECTURE.md) for the phone to cloud to laptop to ESP32 path and required operator gates.
