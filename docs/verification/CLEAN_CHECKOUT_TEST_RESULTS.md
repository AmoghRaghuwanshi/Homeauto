# Clean public checkout results

An anonymous HTTPS clone of public main03dbea10cb2e5e978acf191e3e1c5f9bfee809d6 was created outside the project. Source tree and exclusions matched; both lockfile installs with --ignore-scripts succeeded with0 reported vulnerabilities. No private files, models or dependency folders were copied from the development workspace.

The first actual Linux Node22 Actions run exposed 3 backend tests that required the excluded household SQLite file (146/149 passed). They now construct a synthetic legacy database rather than copying household data. The anonymous clone fetched and fast-forwarded to implementation714530c2a178804994f4c3491bd6ce5fc6423f43; application code was never copied from the development workspace.

Verified in D:/homeauto-audit-tools/publication-20261107/clean-checkout using separately downloaded, official-checksum-verified Node22.23.4:

| Check | Result |
|---|---|
| Anonymous HTTPS clone/fetch, exact source manifest | Pass; 216 files, no private/generated paths |
| Root and server lockfile installs, --ignore-scripts | Pass; 0 reported vulnerabilities |
| JavaScript syntax | 92 files, 0 failures |
| Cloud build trace | 456 files, 0 native hub/private artifacts |
| Backend | 149/149 pass, no skipped/cancelled tests |
| Local navigation/UX | 30 groups pass, 0 browser errors |
| Remediation | 9 groups pass, 0 browser errors |
| Safe loopback preview, voice:false, port:0 | Nested /rooms/hallway returns200; models, certificates and household DB absent |
| Linux Node22 GitHub Actions | Run42352624674: both jobs pass, including cloud86 captures |
| Isolated Windows cloud browser rerun | 86 screenshots/11 groups; 0 axe/page/app-CSP errors/external requests; 172 separately attributed blocked QA style probes |

The first Windows cloud browser attempt, concurrent with the other verification workloads, timed out at login. Its failure image/results are preserved. A separate diagnostic then received login200 and snapshot200. The isolated full-matrix rerun passed unchanged, with results under D:/homeauto-audit-tools/publication-20261107/clean-cloud-isolated. Resource contention is a possible cause, not a proven diagnosis. No timeout, auth rule or assertion was weakened. The public clone remained clean after testing; only ignored/disposable output was generated.

Only in-memory/disposable PostgreSQL WASM/SQLite and fake publishers were used. Root is the Vercel cloud package; server is the offline hub package. No original node_modules, private assets/state, certificates or production configuration were copied to satisfy checkout tests.

Native speech on the original host is a separately measured synthetic fixture and depends on excluded privately provisioned models/Python/native dependencies. Its result is not a clean-checkout native speech acceptance claim. Actual Neon/Vercel/DNS/household hardware remains untested.
