# Operator-owned release remediation proposals

2026-11-06. AUD-001/002/003 remain blocked pending separately authorized implementation/deployment and validation. No firmware, credential, broker or live-service changes were made.

## AUD-001: nonblocking door controller

Current loop calls blocking broker reconnect before checking the five-second unlock deadline; Wi-Fi recovery and denial LED delays can also postpone relocking. Preserve relay GPIO4 polarity (HIGH unlock, LOW lock), RC522 SPI/SS5/RST21, indicators15/16/17 and existing numeric MQTT vocabulary.

Proposed separate firmware change: enforce the relay deadline at the beginning of every loop iteration and before/after each bounded network operation. Use uint32_t elapsed arithmetic (now - unlockedAt >= duration), including millis rollover. Give relay state one owner; unlocking sets a deadline, locking clears it. Replace delay-based feedback with independent LED/buzzer deadlines. Wi-Fi/MQTT reconnect should use scheduled attempts/backoff and short bounded transport timeouts; never wait in a retry loop or replay commands. Enforce safe initial relay level before network initialization. Preserve authorization/deny behavior and explicitly specify repeated-unlock deadline semantics before implementation.

Isolated validation: host state-machine clock tests across rollover, indicator-load firmware bench (no lock), repeated scans/denials, transport stalls, Wi-Fi/broker outage/recovery and reboot. Compile for the actual board/library versions. Then separately approved supervised physical power/fail-mode/egress testing with manual isolation and an independent safe exit. No source patch or software test alone closes this issue; keep HOMEAUTO_DOOR_ENABLED=0.

## AUD-002: authenticated MQTT migration

Existing sketches use anonymous WiFiClient TCP1883; active backend requires credentials and remote TLS. Do not weaken the backend or broker. Inventory actual broker interface, CA/SANs and board capabilities; assign unique principals and secrets to hub and each board. Preserve every command/status/sensor topic and payload; implement CA-validated WiFiClientSecure and bounded reconnect in a separately authorized firmware change. Provision private credentials outside source control.

Disposable broker fixture: verify each principal can publish/subscribe only its own exact topics, denied cross-board actions, bad credentials, untrusted CA, hostname mismatch, expired certificate, retained/LWT behavior and reconnect with no queued command. Operator checklist: credentials/CA/interface supplied; ACL tests pass; board builds pass; indicator-load tests pass; household trust/rollback plan reviewed; supervised device tests authorized; only then review enabling the physical gate. Never restore anonymous access as a compatibility shortcut.

## AUD-003: exposed historical key retirement

Treat the historical bundled key as compromised. Operator inventories deployed certificate fingerprints and all browser/OS trust entries without logging private bytes. Prepare fresh private keys/certificates with correct SANs and private permissions; verify a disposable TLS fixture and recovery access before deployment. Separately authorize credential rotation, remove retired trust, verify old credentials no longer work and preserve only nonsecret forensic metadata. Public history cleanup is secondary and cannot undo disclosure. This session neither changed certificates nor edited remote history.
