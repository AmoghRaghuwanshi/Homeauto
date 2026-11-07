# HomeAuto — API, WebSocket and MQTT contracts

Revision 3, 2026-11-05. **Existing** means observed in local source; **planned** means coding work remains. [ARCHITECTURE.md](ARCHITECTURE.md) owns lifecycle and method semantics; [SECURITY.md](SECURITY.md) owns authorization policy. JSON examples are schemas/examples, not live device observations.

## 1. Existing REST baseline (all currently unauthenticated)

| Method / endpoint | Request | Success | Current errors / caveats |
|---|---|---|---|
| GET `/api/health` | none | 200 `{status:"ok",uptime:number,timestamp:string}` | Liveness only |
| GET `/api/devices` | none | 200 DeviceRow[] | 500 `{error:message}` |
| GET `/api/devices/:id` | none | 200 DeviceRow | 404, 500 |
| POST `/api/devices` | `{id,name,type,location?,status?}` | 201 DeviceRow | 400 missing truthy required field, 409 DB error, 500; arbitrary IDs/types currently permitted |
| PUT `/api/devices/:id` | `{name?,type?,location?}` | 200 DeviceRow | 404, 500; empty name/type falls back to old, arbitrary location allowed |
| DELETE `/api/devices/:id` | none | 200 `{success:true}` | 404/500; firmware continues and next boot reseeds baseline IDs |
| POST `/api/devices/:id/command` | `{action}` | 200 `{success:true,device:DeviceRow}` | 400 missing action, 404, 503 board/broker unavailable, 500. Arbitrary truthy action currently published; toggle resolves using DB. **Optimistic, not acknowledgment.** |
| GET `/api/logs` | `limit?`, `type?` | 200 ActivityRow[] newest first | default 50, parseInt, unbounded/negative currently; exact event_type only |
| GET `/api/logs/rfid-cards` | none | 200 CardRow[] | Owner label/full UID exposed |
| POST `/api/logs/rfid-cards` | `{uid,owner_name,is_authorized?}` | 201 CardRow | 400/409/500; `INSERT OR REPLACE`, duplicate overwrites; only literal false revokes |
| DELETE `/api/logs/rfid-cards/:uid` | none | 200 `{success:true}` | 404/500 |

`DeviceRow={id,name,type,location,status,is_online:0|1,last_seen:string|null,created_at}`. `ActivityRow={id:number,timestamp,device_id:string|null,event_type,details:string|null}`. `CardRow={uid,owner_name,is_authorized:0|1,created_at}`. RFID route comments saying `/api/rfid-cards` are inaccurate: mounted path is `/api/logs/rfid-cards`. Unknown GET `/api/...` can hang because the fallback never responds for API paths; add final JSON 404 middleware.

## 2. Planned common HTTP rules

Preserve existing route paths and base DeviceRow fields, deliberately upgrade command success to 202 and update the bundled frontend in the same task. Do not keep an insecure legacy alias. Version new DTOs with `schema_version:1` where wrapping is possible; retain devices/cards/logs arrays for compatibility, extend rows additively. New pagination endpoint is `/api/activity`, so old logs consumers still get an array. Auth protects all household reads, not just mutations. Public routes: local static login/help, minimal health, and narrowly controlled setup status. No credentials in URLs.

Origin and Host allowlists; HTTPS same-origin cookies (`__Host-homeauto`, Secure, HttpOnly, SameSite=Strict, Path=/, no Domain). Non-GET mutations require matching CSRF header `X-CSRF-Token` issued per session, valid Origin and JSON Content-Type; logout included. Browser script cannot read session cookie. Auth tokens never enter localStorage. REST bodies ≤16 KiB (assistant text ≤500 Unicode characters); reject unknown keys/types, limit strings and nesting. Request ID generated server-side. GET returns `Cache-Control:no-store` for household data; static assets may be locally cached. Never cache or background-replay command requests.

All errors use this planned envelope (including compatibility routes):

```json
{"error":{"code":"DEVICE_UNAVAILABLE","message":"This light is unavailable.","retryable":true,"fields":{}},"request_id":"uuid"}
```

400 malformed/validation; 401 login missing/expired; 403 insufficient permission or CSRF/origin; 404 missing entity/route; 409 version/name/key/busy conflict; 413 body/audio limit; 415 unsupported media; 422 valid syntax but unsupported/ambiguous intent or action; 429 rate/concurrency; 503 dependency/freshness unavailable; 500 sanitized internal error. `Retry-After` for throttling. Don't reveal whether a username exists. Frontend maps code to local bilingual text, never trusts server string as HTML.

Shared permissions: R=any authenticated role; C=owner or resident; U=C **and** `can_unlock=true`, fresh password reauth and single-use challenge; O=owner, recent reauth for security/identity/AI activation changes. RFID hardware principal is separate, can request only unlock/deny for `door-1` after CardService authorization. Viewer never mutates home state. Preference/read receipts for own account are allowed to viewer.

## 3. Planned schemas

```ts
type Observation = {
  reported_status: string|null; received_at: string|null;
  freshness: 'current'|'stale'|'unknown'; source: 'controller_report'|'legacy_db';
  retained: boolean; physical_verified: false; version: number;
};
type DeviceDTO = DeviceRow & {
  room_id: string; board_id: 'lights'|'door';
  capabilities: ('switch'|'lock'|'unlock'|'gas_reading'|'motion_event')[];
  connectivity: 'online'|'offline'|'unknown'; observation: Observation;
  pending_command_id: string|null; version: number;
};
type Command = {
  id: string; device_id: string; action:'on'|'off'|'lock'|'unlock';
  state:'accepted'|'published'|'observed'|'uncertain'|'failed';
  requested_at:string; deadline_at:string; published_at:string|null;
  observed_at:string|null; error_code:string|null; already_reported:boolean;
  evidence:'controller_report'|null; correlation:'temporal'|null;
  physical_verified:false;
};
type Room = { id:string; name:string; cover_key:string|null; sort_order:number; version:number };
type Alert = { id:string; device_id:string; kind:'gas'|'motion'|'access_denied'|'system';
  severity:'critical'|'warning'|'info'; state:'active'|'resolved'; opened_at:string;
  last_seen_at:string; resolved_at:string|null; version:number;
  receipt:{read_at:string|null;acknowledged_at:string|null} };
type Snapshot = { schema_version:1; server_epoch:string; snapshot_seq:number;
  devices:DeviceDTO[]; rooms:Room[]; espBoards:Record<string,BoardDTO>;
  mqtt:{connected:boolean}; commands:Command[]; alerts:Alert[];
  session:{user_id:string;role:string;can_unlock:boolean}; preferences:object;
  home:{home_name:string;version:number};
  speech:{stt_ready:boolean;tts_ready:boolean;input_languages:string[];reply_languages:string[];voices:{id:string;language:string}[]} };
// BoardDTO keeps existing name,online,lastSeen; adds epoch,freshness and version.
```

Capabilities derive from fixed device registry, never user-provided type. Gas payload remains raw/prototype. Motion observation is an event with age; a healthy board alone cannot set current motion to clear.

## 4. Planned REST endpoint catalogue

All endpoint rows inherit the shared error and validation rules; errors listed below are additional expected cases. Success wrappers include `request_id` unless preserving an existing array. No routes below exist yet except the explicitly reused baseline paths.

### Authentication and snapshot

| Method / path | Inputs / validation | Success / error details | Permission / idempotency |
|---|---|---|---|
| GET `/api/auth/setup-status` | exact permitted Host, loopback only pre-setup | 200 `{setup_required:boolean}`; 403 nonlocal | Public local; no remote bootstrap mutation |
| POST `/api/auth/login` | `{username,password}`; username 1–80; password ≤256; Origin required | 200 `{user:{id,display_name,role,can_unlock},csrf_token,expires_at}` + cookie; 401/429 | Public login, limited 5 failures/15min account+IP; no default credentials |
| GET `/api/auth/session` | cookie | 200 same session DTO + CSRF; 401 | R; safe repeat |
| POST `/api/auth/reauth` | `{password}` | 200 `{reauth_until,csrf_token}` + rotated cookie; 401/429 | R own session; five-minute freshness; no PIN-only gate |
| POST `/api/auth/logout` | `{}` + CSRF | 200 `{success:true}`; clears cookie/sockets | Own active session; safely repeat logout, missing session still clears cookie |
| GET `/api/snapshot` | none | 200 Snapshot | R; role-filtered atomic logical view |

Owner provisioning and additional user creation/reset are console-only in this release. Settings shows actual identity/role and offline operator instructions; no fake self-service family directory. Password storage uses async Node scrypt with random salt, documented versioned parameters benchmarked before release. Lost-owner recovery requires OS-local console, invalidates sessions and writes audit; no network reset or hardcoded master PIN.

### Devices and commands

| Method / path | Input | Success / expected failures | Permission / idempotency |
|---|---|---|---|
| GET `/api/devices[/:id]` | known ID | 200 DeviceDTO[] / DeviceDTO; 404 | R; preserves existing shapes + fields |
| PUT `/api/devices/:id` | `{name?,room_id?,version}`; do not accept status/type/ID | 200 DeviceDTO; 409 stale version; 422 forbidden type/status fields | O; same values no-op; room updates legacy location; existing location clients get deliberate 422 with migration message |
| POST `/api/devices` | future hardware provisioning | 422 `PROVISIONING_UNSUPPORTED` for known baseline release; 401/403 before body details | O only; no arbitrary records that pretend to pair |
| DELETE `/api/devices/:id` | none | 409 `FIXED_HARDWARE_DEVICE` for seven baseline IDs; 404 unknown | O; remove display favorite/reassign room instead; deliberate restriction fixes reseed/phantom-device issue |
| POST `/api/devices/:id/command` | `{action,idempotency_key,confirmation_id?}`; key UUID; lights on/off; light toggle accepted only as compatibility input when fresh; door lock/unlock; no sensor command | 202 `{command:Command}`; no-op 200 with observed record; 422 action; 409 busy/key/challenge; 503 stale/broker/persistence | C for on/off/lock; U for unlock. Persist actor+key+request hash 24h; exact duplicate returns original command even after timeout, never republishes. Different body same key→409. No automatic client retry with new key. |
| GET `/api/commands/:id` | UUID | 200 `{command}`; 404 | Requesting user or O; read-only polling 1s max, fallback to WS |
| POST `/api/security/unlock-challenges` | `{device_id:"door-1"}` after reauth | 201 `{confirmation_id,device_id,expires_at}`; 409 busy; 503 offline | U; bound session/device/action, 30s expiry; cryptographic random token hashed server-side; consume once atomically with command acceptance |

Confirmation modal opens only after session authorization; if reauth needed, return to the same explicit modal after credential check. Confirm uses challenge and a new idempotency key. Cancel consumes nothing and sends nothing. Key replay after acceptance returns old result without consuming/requiring another challenge, only for the same actor/request; an expired/revoked session still fails authentication. A new unlock requires fresh consent and key/challenge. `confirmation_id` is not a substitute for server authorization.

### Rooms and preferences

| Method / path | Input | Success / expected failures | Permission / idempotency |
|---|---|---|---|
| GET `/api/rooms` | none | 200 Room[] | R |
| POST `/api/rooms` | `{name,cover_key?,idempotency_key}`; cover from local allowlist | 201 Room; 409 duplicate/alias collision | O; key reuse exact response |
| PUT `/api/rooms/:id` | `{name?,cover_key?,sort_order?,version}` | 200 Room; 404/409 | O; no device ID changes; no-op same values |
| DELETE `/api/rooms/:id` | none | 200 `{success:true}`; 409 `ROOM_NOT_EMPTY`; 404 | O; confirm in UI; don't cascade-delete devices |
| GET `/api/settings/home` | none | 200 `{home_name,version}` | R |
| PUT `/api/settings/home` | `{home_name,version}` | 200 updated; 409 | O |
| GET `/api/preferences` | none | 200 `{favorites:string[],reply_language:"auto"|"en"|"hi",input_language:"auto"|"en"|"hi",spoken_replies:boolean,voice_rate:number,notification_categories:string[],version}` | R own; favorites known IDs, max7; rate 0.8–1.2 |
| PUT `/api/preferences` | typed subset plus version | 200 same DTO; 400/409 | R own; no role/session/theme fields accepted |

Room reassignment uses device PUT, not an invented second membership route. Aliases initially exposed only through owner Advanced diagnostics/configuration; ambiguous alias adds remain unavailable until a tested management API exists.

### Access cards, activity and alerts

| Method / path | Input | Success / expected failures | Permission / idempotency |
|---|---|---|---|
| GET `/api/logs/rfid-cards` | none | 200 CardRow[] + version per row | O; full UID never in resident response |
| POST `/api/logs/rfid-cards` | `{uid,owner_name,is_authorized}` strictly boolean | 201 CardRow; 409 duplicate; 400 UID format | O+recent reauth; **create only**, stop silent replacement |
| PUT `/api/logs/rfid-cards/:uid` | `{owner_name?,is_authorized?,version}` | 200 updated CardRow; 409 version; 404 | O+recent reauth; repeat same state no extra grant |
| DELETE `/api/logs/rfid-cards/:uid` | none | 200 `{success:true}`; absent→404 (compatibility) | O+recent reauth; retry absence means already absent, never error notification implying revocation failed |
| GET `/api/logs` | limit 1–100, optional known type | 200 ActivityRow[] | R redacted; retains simple baseline contract |
| GET `/api/activity` | `limit=30`, opaque cursor, category all/doors/lights/sensors/system, from/to UTC, device_id?, q?≤100 | 200 `{items:ActivityDTO[],next_cursor:string|null}` | R; 400 invalid cursor/date, no arbitrary SQL type; cursor stable id-desc; filter performed before pagination |
| GET `/api/alerts` | state active/resolved/all; limit1–100; cursor? | 200 `{items:Alert[],next_cursor}` | R per-user receipts |
| POST `/api/alerts/:id/read` | `{}` | 200 `{receipt}` | R own, idempotent; reading is not acknowledgment |
| POST `/api/alerts/:id/acknowledge` | `{}` | 200 `{receipt}` | C, own receipt; idempotent; sensor state unchanged |

UID canonical pattern is colon-separated uppercase hex, byte count 4,7,10. Accept compact hex or spaced input then normalize server-side, reject incomplete/odd-length/nonhex; never trust client normalization. Firmware timestamp is uptime millis, not UTC. Manual registration only; a scan in the owner manager may populate a suggested UID after explicit selection, with no enrollment authority or automatic authorization. No scan-to-enroll mode is promised. Activity DTO={id, timestamp, device_id, event_type, summary_key, summary_params, command_id?, outcome?, source?}; non-owner parameters have no full UID or raw transcript. q searches bounded safe event summary fields, no raw credential data.

### Assistant, speech assets and diagnostics

| Method / path | Input | Success / expected failures | Permission / idempotency |
|---|---|---|---|
| POST `/api/assistant/interpret` | `{text,language:"auto"|"en"|"hi"}` ≤500 | 200 `{intent:Intent,expires_at,intent_id}`; 422 `{error,...,clarification:{reason,choices}}` | R; parse only, no MQTT; server stores intent bound user/version/30s |
| POST `/api/assistant/execute` | `{intent_id,idempotency_key}` | 202 `{commands:Command[]}` or 200 `{answer:{result_id,message_key,params,text,language}}` for query; 409 stale/ambiguous; 403 `SENSITIVE_ACTION_REQUIRES_UI` | C mutations, R queries; voice/typed unlock always redirected to protected manual flow. No arbitrary intent JSON accepted. |
| POST `/api/assistant/speech` | `{result_id?,test_phrase?:"voice_check",language:"en"|"hi",voice_id?}`; exactly one of result_id/test_phrase. Server derives all text from the owned command/query result or fixed harmless test phrase. | 202 `{job_id}`; 404/410 result missing/expired;503 voice missing | R, max one TTS job per session; command result ID is its UUID, query answer token is session-bound with60sTTL. No client-supplied message text/parameters/SSML; server composes honest current outcome before synthesis. |
| GET `/api/assistant/speech/:job_id` | session-bound UUID | 200 `{state:"queued"|"ready"|"failed",audio_url?,error_code?}` | R job owner; 404/410 missing/expired |
| GET `/api/assistant/audio/:id` | session-bound generated ID | 200 `audio/wav`, private/no-store; 404/410 | R owner; RAM/temp TTL60s; no static filesystem mapping |
| GET `/api/system` | none | 200 `{version,broker,boards,database,speech,cert_health}` | O; sanitized no secrets |
| GET `/api/ai/models` | none | 200 `{assets:[{id,provider,languages,bytes,version,license_status,ready,active,error_code?}]}` | O; local registry only |
| POST `/api/ai/models/:id/activate` | `{}` + recent reauth | 200 `{active_id,ready}` or 409 worker busy, 503 probe fails | O+reauth; idempotent if already active; does not download |

No runtime model download/delete/upload, firmware flash, arbitrary URL, backup-file download or shell command endpoint. Offline setup/import is an operator workflow documented in OFFLINE_AI. Avoid adding risky admin interfaces to satisfy decorative Settings rows.

## 5. Existing WebSockets and planned migration

Currently two `WebSocketServer({server,path})` instances share each HTTP/S server. The installed ws version reproduces a 400 `/voice` handshake in an isolated test because both receive upgrade events. Replace with **one** upgrade dispatcher, authenticate/origin-check once, route `/ws` and `/voice` to `noServer:true` instances, destroy unknown upgrades. Do not instantiate competing automatic upgrade listeners.

Existing `/ws` envelopes `{type,data}`:

| Type | Current data |
|---|---|
| init | `{devices:DeviceRow[],espBoards:{[id]:{name,online,lastSeen}}}` |
| device_update | DeviceRow (occasionally fallback `{id,status}`) |
| esp_status | board map as above |
| mqtt_status | `{connected:boolean}` |
| sensor_data | `{device_id,gas_ppm?,raw?,alert?,motion?,timestamp}` |
| rfid_event | `{device_id,uid,owner,authorized,timestamp}` |
| log | `{device_id,event_type,details:JSON-string,timestamp}` without DB log ID in live broadcast |
| alert | `{device_id,level:"danger"|"warning",message,timestamp}` |
| voice_result | **top-level** `{type,success,transcript,...}`, not nested data; current WS client emits only msg.data, so notification handler may receive undefined |

Planned `/ws` keeps type/data and adds `{schema_version:1,server_epoch,seq,sent_at}`. `init.data` becomes Snapshot; `device_update.data` full DeviceDTO; `command_update.data` Command; `alert.data` Alert; `log.data` persisted ActivityDTO with ID; other existing event types remain validated, owner-sensitive fields redacted. `voice_result` becomes nested data, sent only to requesting session, never broadcast transcripts household-wide. Client buffers deltas until snapshot and checks epoch/seq. Seq is per connection after redaction (or use sanitized no-op sequence frames) so owner-only events do not create permanent gaps for residents. Reconnect starts fresh snapshot, not event replay. Send WS ping every20s, close after40s no pong; force close on logout/session expiry. Max device WS message 16KiB; no client mutation messages there. Error close codes1008 policy,1009 too large,1013 overloaded; do not log tokens/audio.

### `/voice` protocol

Existing server messages: `voice_ready`, `partial{text}`, `transcript{text,lang}`, `wake_word{command}`, `voice_result{success,transcript,action?,devices?,message?,error?}`, `voice_error{error}`. Existing inbound reset JSON is incorrectly detected via typeof data; ws text may be Buffer. All control parsing must use callback `(data,isBinary)`.

Planned voice is one deliberate utterance, session+Origin checked. Authenticate cookie and a short-lived one-use voice ticket obtained by POST `/api/assistant/voice-tickets` (`{}` + CSRF→201 `{ticket,expires_at}`, R; 30s); provide ticket as first text frame within3s, not URL query. Ticket authorizes audio processing only, never unlock. Maximum two voice sockets per hub, one active utterance/inference job globally initially; 429/1013 busy, not unbounded queues.

| Direction | Frame / contract | Effect |
|---|---|---|
| C→S | JSON `{type:"start",schema_version:1,ticket,session_id,utterance_id,format:"pcm_s16le",sample_rate:16000,channels:1,language:"auto"|"en"|"hi"}` | Validate IDs/ticket/config; allocate bounded buffer; replies ready |
| C→S | Binary ≤3200 bytes (≤100ms PCM) | Audio only during accepted utterance; 640kB total maximum20s |
| C→S | JSON `{type:"end",utterance_id}` | Flush final tail once, stop capture; enqueue STT |
| C→S | JSON `{type:"cancel",utterance_id}` | Stop/discard capture, cancel unexecuted job; cannot undo published action |
| S→C | `{type:"voice_ready",utterance_id}` | Browser may stream |
| S→C | `{type:"partial",utterance_id,text}` optional | Display only; never execute partial |
| S→C | `{type:"transcript",utterance_id,text,lang}` | Exact recognized text; parse once |
| S→C | `{type:"intent",utterance_id,intent_id,intent,expires_at}` | Deterministic safe action/query; manual confirmation required for unlock |
| S→C | `{type:"voice_error",utterance_id,code,retryable}` | Cleanup; no action from error |

After final intent, the client calls the same assistant execute API once for an unambiguous allowed light/lock command; this explicit client step does not weaken server policy. Response and TTS use the command observation result over authenticated REST/WS. **Stop listening** sends end and processes the captured utterance once; **Cancel request** discards unexecuted work. Route departure, logout, visibility loss and transport failure use Cancel semantics and ignore late results by utterance ID. A published command cannot be canceled; show “Request already sent; checking result.” No wake-word requirement for tap-to-speak. Opt-in continuous wake-word stays future until privacy/false-activation validation.

## 6. Exact legacy MQTT contracts — preserve with adapter

Broker URL currently `mqtt://localhost:1883`; ESP32 uses configured LAN broker. Current auth null, board IDs `lights` and `door`, server random clientId, clean session. Topic numeric suffix is **not** full DB ID: light-1→`home/light/1/...`; sensor-gas→`home/sensor/gas/...`.

| Topic | Publisher→subscriber | Payload | Retained / timing |
|---|---|---|---|
| `home/light/{1..4}/command` | server→lights | exact text on/off/toggle | Server QoS1, retain false by default; firmware default subscription QoS0 |
| `home/light/{1..4}/status` | lights→server | text on/off | retained; startup/reconnect, command callback and every30s |
| `home/door/1/command` | server→door | text lock/unlock/deny/toggle_lock | Currently server QoS1; firmware default subscription QoS0. UI `toggle` is server-resolved, not firmware door toggle. Planned dispatch avoids toggle_lock. |
| `home/door/1/status` | door→server | locked/unlocked/denied | retained; startup/reconnect, actions, heartbeat30s; denial is event only |
| `home/door/1/rfid` | door→server | `{"uid":"AA:BB:CC:DD","timestamp":12345}` | non-retained; timestamp uptime millis; scan cooldown2s |
| `home/sensor/gas/data` | lights→server | `{"gas_ppm":0..1000,"raw":0..4095,"alert":boolean}` | non-retained every2s; linear ADC map, alert >=400; warn constant200 is unused |
| `home/sensor/motion/data` | lights→server | `{"motion":boolean}` | non-retained on change only; clear after >5s since HIGH, no boot-clear message |
| `home/esp32/lights/online` | lights/broker LWT→server | true/false text | retained; connect true, LWT false QoS1 |
| `home/esp32/door/online` | door/broker LWT→server | true/false text | same |

PubSubClient publishes ordinary telemetry at QoS0; server QoS1 publishing does not make the downstream firmware subscription/telemetry QoS1. Confirm broker delivery behavior in the integration simulator, then real hardware. [PubSubClient project documentation](https://github.com/knolleary/pubsubclient) describes its QoS limits.

New adapter rejects unknown topic lengths/suffixes, status enum errors, malformed JSON and types/ranges; never call DB for arbitrary device IDs. No executable commands on sensor topics. Broker ACL must allow server command writes/status reads, each board its own status/online/telemetry writes and assigned command reads. Retained commands must be administratively cleared during supervised setup, not by this planning session. Auth/TLS credentials require coordinated firmware provisioning before strict ACL enforcement. Preserve literal topics/payloads while adding authentication; future command IDs need an explicitly versioned protocol and dual compatibility tests.
