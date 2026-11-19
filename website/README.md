# HomeAuto website deployment

This folder is the standalone cloud website and API for the HomeAuto domain. It contains no firmware or local broker runtime. Point the existing Vercel project's Root Directory at `website` after applying the cloud database migrations. Git deployments are enabled in this folder's `vercel.json`.

The canonical source remains at the repository root. Run `npm run site:sync` at the root after editing the frontend or cloud API. CI runs `npm run site:check` and rejects an out-of-date website copy. The laptop hub stays in `server/` at the repository root and runs separately.

See [the remote hub flow](../docs/cloud/REMOTE_HUB_ARCHITECTURE.md) for the phone to cloud to laptop to ESP32 path and required operator gates.
