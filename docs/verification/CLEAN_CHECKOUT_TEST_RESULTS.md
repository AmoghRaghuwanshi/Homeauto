# Clean public checkout results

An anonymous HTTPS clone of public main03dbea10cb2e5e978acf191e3e1c5f9bfee809d6 was created outside the project. Source tree and exclusions matched; both lockfile installs with --ignore-scripts succeeded with0 reported vulnerabilities. No private files, models or dependency folders were copied from the development workspace.

The first actual Linux Node22 Actions run exposed3 backend tests that required the excluded household SQLite file (146/149 passed). They now construct a synthetic legacy database rather than copying household data. All48 core tests pass locally with this fixture. Final corrected checkout and Actions results are pending execution.

After the gated push, clone the exact public main into a disposable external directory, verify SHA/tree and excluded artifacts, install both lockfiles without native lifecycle scripts, then run publication/syntax/build/backend/isolated cloud-browser/local UX checks. Start only the loopback in-memory/fake-broker preview, never server.js against household data. Verify startup with optional voice/models absent. Root is the Vercel cloud package; server is the offline hub package. No original node_modules, private assets/.local/state, certificates or production configuration may be copied to satisfy checkout tests.

Native speech on the original host is a separately measured synthetic fixture and depends on excluded privately provisioned models/Python/native dependencies. Its result is not a clean-checkout native speech acceptance claim. Actual Neon/Vercel/DNS/household hardware remains untested.
