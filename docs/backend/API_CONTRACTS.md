# API contracts — current implementation

Local source: server/app.js, services/home.js, services/assistant.js, auth/sessions.js and realtime.js. This inventory includes the frontend dependencies; it does not supersede their exact executable validators. Existing revision-4 DTOs remain compatible. Only owner /api/system adds cloud_sync; existing fields are unchanged. No cloud settings UI, cloud login or remote control route was added.

## Shared local rules and DTOs

All local HTTP requests require an allowed Host; supplied Origin must match scheme/host/port. All private endpoints require a valid local session. Every private mutation additionally requires same-origin Origin, application/json, matching X-CSRF-Token, maximum 16-KiB body, and at most 90 mutations/user/minute. Login instead uses login/IP throttles (5 username/IP failures, 20 IP failures/15 minutes), two concurrent password checks, and Origin/JSON. Setup status is loopback-only. Fields validators reject unknown body fields where invoked; DELETE/logout/ticket/model-activation routes do not promise strict empty-body validation.

Errors are {error:{code,message,retryable,fields},request_id}, except the narrow setup-status denial shape. Common statuses: 400 validation/invalid JSON, 401 expired session, 403 Origin/CSRF/permissions/reauth, 404 absent resource, 409 version/key/busy conflict, 413 body size, 415 content type, 422 unsupported action/intent, 429 rate/busy, 500 unknown failure, 503 device/persistence/readiness unavailable. Retry-After=60 on local 429. A successful command acceptance is not a hardware confirmation.

| DTO | Fields |
| --- | --- |
| Session | user{id,display_name,role,can_unlock}, csrf_token, expires_at ISO, reauth_until ISO/null |
| Room | id,name,name_key (stored rows), cover_key,sort_order,version; create response excludes name_key |
| Device | Stored registry metadata/status/times/version plus board_id,capabilities,connectivity,is_online,observation,latest,pending_command_id |
| Observation | reported_status,received_at,freshness=current/stale/unknown,retained,physical_verified=false,source,version |
| Command | Stored command fields plus already_reported boolean,evidence=controller_report/null,correlation=temporal/null,physical_verified=false |
| Snapshot | schema_version=1,server_epoch,devices,rooms,espBoards,mqtt,commands,alerts,session,preferences,home,speech,system |
| Preferences | favorites (unique supported IDs, max7), reply_language/input_language=auto/en/hi, spoken_replies boolean, voice_rate .8–1.2, notification_categories, version |
| Alert | ID/device/kind/severity/state/opened/seen/resolved/version plus per-user receipt{read_at,acknowledged_at} |
| Speech readiness | stt_ready,tts_ready,input_languages,reply_languages,voices[{language,id}] |

## Local endpoint inventory

Roles: R=any authenticated reader; C=owner/resident control; O=owner; S=owner plus fresh reauth. Unknown API routes return structured 404. Reads have no hardware side effects and do not extend idle lifetime. Unless stated, mutations are not safe for automatic replay; version conflicts require rereading current state. Empty input means no documented body/query fields.

| Method / path | Input | Success output | Permission / validation / idempotency / side effect |
| --- | --- | --- | --- |
| GET /api/health | Empty | 200 {status:ok,timestamp} | Public liveness, Host boundary; does not prove hardware/readiness |
| GET /api/auth/setup-status | Empty | 200 {setup_required:boolean} | Loopback only; no account creation |
| POST /api/auth/login | username,password | 200 Session + cookie | Public narrow exception; local credentials; creates session; not replay-safe |
| GET /api/auth/session | Empty | 200 Session | R; read-only |
| POST /api/auth/activity | {} | 200 {success:true} | R; explicit user activity; writes at most once/minute; no passive WS renewal |
| POST /api/auth/logout | Empty | 200 {success:true} + expired cookie | R; removes token and revokes sockets |
| POST /api/auth/reauth | password | 200 Session + rotated cookie | R; password/rate checks; rotates token, preserves absolute deadline, revokes old sockets |
| GET /api/snapshot | Empty | 200 Snapshot | R; role-filtered commands/activity details |
| GET /api/devices | Empty | 200 Device[] | R |
| GET /api/devices/:id | Hardware ID | 200 Device | R; 404 unknown |
| POST /api/devices | No supported creation | 422 PROVISIONING_UNSUPPORTED | O; no provisioning |
| DELETE /api/devices/:id | Hardware ID | 409 FIXED_HARDWARE_DEVICE | O; 404 unknown; no deletion |
| PUT /api/devices/:id | version; optional name,room_id | 200 Device | O; name NFC/trim 1–80, valid room/current version; metadata/log/optional journal only |
| POST /api/devices/:id/command | action,idempotency_key; optional confirmation_id | 202 {command}, or 200 already_reported | C; same actor/key/request hash replay returns record; conflicting key409; on/off/toggle lights, lock/unlock gated door; no sensor commands |
| GET /api/commands/:id | Command ID | 200 {command} | Actor owner or O; 404 otherwise |
| POST /api/security/unlock-challenges | device_id=door-1 | 201 {confirmation_id,device_id,expires_at} | Local unlock permission + fresh reauth, gate, available board/storage; single use/30s/session bound; no actuation |
| GET /api/rooms | Empty | 200 Room[] | R |
| POST /api/rooms | name,idempotency_key; cover_key unsupported | 201 Room | O; name1–60, unique normalized key/no alias conflict; actor/key idempotent; creates metadata |
| PUT /api/rooms/:id | version; optional name,sort_order,cover_key | 200 Room | O; current version, order nonnegative integer, cover unsupported; updates device location/version too |
| DELETE /api/rooms/:id | Room ID | 200 {success:true} | O; 409 if occupied; removes aliases/empty room; repeated absent404 |
| GET /api/preferences | Empty | 200 Preferences | R, own user only |
| PUT /api/preferences | version; optional supported preference keys | 200 Preferences | R, own; category enum gas/motion/access_denied/device; optimistic version; local only |
| GET /api/settings/home | Empty | 200 {home_name,version} | R |
| PUT /api/settings/home | home_name,version | 200 {home_name,version} | O; name1–60/current version; metadata/optional journal |
| GET /api/logs/rfid-cards | Empty | 200 Card[] | O; private local UID/owner/authorization/version |
| POST /api/logs/rfid-cards | uid,owner_name,is_authorized:boolean | 201 Card | S; canonical4/7/10-byte UID, unique, owner1–80; local DB/log only |
| PUT /api/logs/rfid-cards/:uid | version; optional owner_name,is_authorized | 200 Card | S; version conflict409; no cloud copy |
| DELETE /api/logs/rfid-cards/:uid | UID | 200 {success:true} | S; local deletion/log; absent404 |
| GET /api/activity | limit1–100 default30,cursor,category,device_id,type,from,to,q | 200 {items,next_cursor} | R; cursor digits, known category/device, valid ordered dates, q max100; redacts UID/owner/transcript details for nonowners |
| GET /api/logs | Same filters | 200 Activity[] | Compatibility alias; same role filtering, no cursor wrapper |
| GET /api/alerts | state=active/resolved/all | 200 {items,next_cursor:null} | R; maximum100 returned |
| POST /api/alerts/:id/read | Empty | 200 {receipt} | R; idempotent COALESCE timestamp; never resolves hazard |
| POST /api/alerts/:id/acknowledge | Empty | 200 {receipt} | C; same receipt semantics; never resolves hazard |
| POST /api/assistant/interpret | text1–500, optional language=auto/en/hi | 200 {intent,intent_id,expires_at} | R; strict deterministic parser, RAM-only30s actor/session-bound intent; 422 unclear/unsafe |
| POST /api/assistant/execute | intent_id,idempotency_key | 200 {answer} query or 202 {commands,errors,result_id,language} | R query/C control; exact key replay; stable per-target command keys; sensitive actions require UI; partial errors preserved |
| POST /api/assistant/voice-tickets | Empty | 201 {ticket,expires_at} | R; local STT readiness, actor-owned single use30s; capacity50 |
| POST /api/assistant/speech | language=en/hi, exactly one result_id or test_phrase=voice_check; optional voice_id | 202 {job_id} | R; owned result/trusted test text; fixed installed voices (voice_id is not a provider selector); global speech capacity; no arbitrary text synthesis |
| GET /api/assistant/speech/:id | Job ID | 200 {state,error_code?,audio_url?,duration_ms?} | R/own job; expires60s; 404 absent |
| GET /api/assistant/audio/:id | Job ID | 200 WAV | R/own ready job; 409 not ready; no-store |
| GET /api/ai/models | Empty | 200 {assets} | O; fixed installed profiles, file-size/license/readiness DTO |
| POST /api/ai/models/:id/activate | Fixed model ID | 200 {active_id,ready:true} | S; verifies already loaded readiness, no provider download/switch; 409 busy/503 unavailable |
| GET /api/system | Empty | 200 {version,broker,boards,database,speech,door_enabled,simulation,cloud_sync} | O; no secrets; cloud_sync is optional metadata diagnostics, not device status |

No /api/cloud mutation endpoint exists on the household hub. Configuration remains explicit operator work. Local diagnostics expose no PostgreSQL URL, origin, token, household ID or hub ID.

## Realtime and MQTT compatibility

/ws requires local session+Origin at upgrade. The server sends {type:init,schema_version:1,server_epoch,seq,sent_at,data:Snapshot+snapshot_seq}; seq increases per connection. Source authority is the local hub epoch; per-device observation.source identifies controller_report/legacy_db, with physical_verified:false. Do not break existing consumers by inventing a new source/version wrapper. Client must discard old-epoch/stale sequence data and fetch a new snapshot on reconnect. Client messages are rejected; maximum20 sockets,16-KiB inbound,1-MiB outbound buffer; guarded20s heartbeat rechecks current session and closes failed/expired sockets. It never extends session idle expiry.

/voice additionally limits voice sockets to two and globally captures one utterance. Start text contains type:start,utterance_id,ticket,format:pcm_s16le,sample_rate:16000,channels:1,language:auto/en/hi,optional wake_required. Server returns voice_ready. Binary chunks are at most3200 bytes/even length; total640000 bytes/20s, minimum6400 bytes. End/cancel use matching utterance_id. Result messages are transcript{text,lang,utterance_id}, intent{intent,intent_id,expires_at,utterance_id} or voice_error{code,retryable,utterance_id}. Voice uses correlated utterance IDs, not the /ws snapshot sequence. It is intentionally not a broadcast stream or persisted recording. Start deadline3s, total socket capture deadline23s, worker timeout30s. Disconnect clears capture state.

MQTT remains home/light/{1..4}/command (on/off), home/door/1/command (lock/unlock/deny), status topics home/light/+/status and home/door/1/status, home/door/1/rfid, home/sensor/+/data, home/esp32/+/online. Actual payload parsing/validation remains services/home.js. QoS0, retain=false, clean session, queueQoSZero=false. No cloud operation maps to these topics. Gas values remain uncalibrated; controller lock reports never prove bolt position.

## Separate cloud API

| Method / path | Input / output | Authorization / failure / side effects |
| --- | --- | --- |
| GET /health/live | Empty → {status:ok} | Public liveness only; no DB/hardware guarantee |
| POST /v1/sync/catalog | Exact operation → exact receipt (SYNC_PROTOCOL.md) | Bearer hub token, no browser Origin; fixed token-derived scope; max32KiB;60/min/hub/process; transactional catalog+receipt; duplicate-safe |
| GET /v1/sync/catalog | Empty → {metadata:null|CloudMetadata} | Same hub authorization, active DB enrollment and rate limit; scoped read; no device freshness claims |

Cloud errors are {error:{code,retryable}}. 400 invalid JSON/catalog/digest;401 missing/invalid token;403 browser Origin/scope/unregistered/revoked hub;404 unknown path;409 operation/revision conflict;413 size;415 JSON required;422 unsupported sync version;429 rate (Retry-After60);503 DB/pool/unexpected unavailability. Tokens/URLs/SQL errors are not included. There is no remote control, remote unlock, cloud user login, RFID, audio or authoritative sensor endpoint.
