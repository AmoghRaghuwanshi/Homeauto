# HomeAuto — screen and interaction specification

Revision3,2026-11-05, **PLANNED**. This completes [design.md](design.md); tokens and components are authoritative in [THEMES.md](THEMES.md) and [COMPONENT_SPEC.md](COMPONENT_SPEC.md). Routes use History API with Express fallback. No concept image is a working screenshot. All service routes in this document are planned secure versions from [API_CONTRACTS.md](API_CONTRACTS.md), even when a path already exists today.

## Shared contract inherited by every screen

The numbered fields in each screen cover the14 requested specification dimensions. All screens use the same five labelled primary destinations, Home/Rooms/Security/Assistant/Settings. App bar: HomeAuto link→`/`, alerts bell→`/security/alerts`, actual home name; secondary routes get Back48px with parent fallback. No invented user avatars; session menu shows actual user/role, Sign out→logout+close sockets+stop mic. Viewer can navigate all resident reads but gets explanatory read-only controls. Owner-only Settings sections and access cards are absent to other roles; direct URL returns Access denied.

Global states: initial loading (skeleton + meaningful label), usable, empty, partial/stale, hub unavailable, dependency unavailable, permission denied, session expired, fetch error. Never show empty on a failed fetch. Keep last known data visibly dated; disable mutations on lost hub/broker/board or unsafe persistence. Retry fetches only; it never repeats physical commands. Primary focus moves to H1 on route navigation, Back restores prior focus/scroll; field errors focus first invalid input. New alert announces once; no microphone starts on entry. At320–599px bottom nav and one main column;600–767px two-column;768–1023px rail/two-column;≥1024px sidebar/max1180px. Reflow/zoom can override columns. Minimum48px controls, English/Hindi local dictionaries, appropriate `lang`, normal spacing and no clipped labels. CSRF/auth on all writes. See shared states/errors in API_CONTRACTS; no screen depends on internet.

## S01 Home — `/`

1. **Purpose:** show known household status and let residents reach familiar controls quickly.
2. **Users:** all signed-in household members, including elders and keyboard/screen-reader users.
3. **Layout:** H1 greeting/home name→critical alert banner if any→concise availability summary→favorites→Rooms shortcuts→Lights/Front door/Gas/Motion summary cards→Quick actions→Shrimaan entry. Desktop primary column favorites+rooms, secondary column door/sensors. Do not insert cameras, weather, temperature, home-arm modes or scene rows.
4. **Components:** AppShell, AlertBanner, SummaryCard, DeviceCard, RoomCard, Button, AsyncPanel. Optional local room photo is decorative and cannot obscure text.
5. **Controls:** favorite light explicit On/Off; favorite door opens door detail; favorite sensors Details; Manage favorites→Settings devices; room card→room detail; Lights summary→`/rooms?type=light`; Front door→`/security/door`; Gas/Motion→device detail; View alerts→alerts; All lights off; Lock front door; Check status→Security; Talk to Shrimaan→Assistant with mic off.
6. **After interaction:** ordinary light action immediately shows requested/pending, accepted202 then published, controller report updates state. Bulk lights off shows4 individual results, unknown/offline never counted off. Lock acts through CommandService; no unlock on Home. Navigation only actions don't publish. Favorites empty→“Choose favorite devices” opens device list, not automatic defaults guessed from household use.
7. **Services:** snapshot+WS, device command per ID, preferences, rooms; no separate fake Home API.
8. **Data:** home_name, user favorites, registered7 devices, observations, boards, commands, active alerts. Counts show known-on and unavailable separately, e.g.“2 on · 1 unavailable”; no bare0 for unknown.
9. **States:** no devices→owner setup instructions; no favorites→chooser; new gas alert highest priority; unknown lock→“Door status unavailable”; all-current calm copy→“Devices connected” and explicit door report, never “Home protected”.
10. **Responsive:** same order at all widths; desktop2:1, quick actions wrap, not horizontally hidden. At320px favorite cards single-column if translated labels need space.
11. **Accessibility:** labels include device and action, reported state independent of pending; summary navigation names useful without images; no automatic focus on updated alert.
12. **Security:** no unprotected quick-action path; viewer controls read-only; only supported registry devices; no public leak of household names/events.
13. **Errors:** partial bulk result stays visible with per-device “Not confirmed”; Check again refetches, not reissues. Missing preference service leaves favorite chooser retry, not artificial success.
14. **Acceptance:** UI-01/03, STATE-01: seven actual IDs reachable, correct unknown counts, all actions genuine,05 default,4 themes+mobile/desktop, no mic on load, no false physical confirmation.

## S02 Rooms — `/rooms`

1. **Purpose:** organize real devices by actual persisted rooms.
2. **Users:** all residents; owner manages grouping.
3. **Layout:** H1 Rooms+owner Add room→search→All/Lights/Sensors/Door chips→room-card grid→empty/no-match panel. Start with Room1, Room2, Entrance, Kitchen, Hallway (display names include spaces).
4. **Components:** Field, ChipGroup, RoomCard, Dialog, AsyncPanel.
5. **Controls:** search name/device name; chips filter rooms with matching capabilities; room link; Add room opens name+optional local cover key form; Save/Cancel; Clear filters; empty Add first room only owner.
6. **Behavior:** search is local over complete snapshot, debounced150ms; selection preserved in URL query; create requires durable201 then update list/navigate; Cancel no mutation. Filtering never assigns a room or sends action.
7. **Services:** GET/POST rooms, snapshot+WS room update (or resnapshot after own writes).
8. **Data:** rooms, device room_id and display names, observations; no config-only alias mislabeling.
9. **States:** loading, error, no rooms, no matches, empty rooms, partially disconnected devices; empty room card still opens.
10. **Responsive:** mobile full-width cards; tablet2; desktop up to3 min240px. Search and Add remain reachable with Hindi labels.
11. **Accessibility:** search visible label, filter pressed state, result count polite only on settled input; no nested action buttons inside room navigation links.
12. **Security:** owner creation, known cover keys only, no external photo URL or injected SVG.
13. **Errors:** duplicate/alias-conflicting room→field error; failed save retains entered name;401 login return route; delete absent here.
14. **Acceptance:** ROOM-01: every device in exactly one room; filters use real types; empty state distinct from fetch failure; Room1 not silently Living Room.

## S03 Room detail — `/rooms/:roomId`

1. **Purpose:** control devices within one recognizable room.
2. **Users:** residents; owner edit/reassign.
3. **Layout:** Back→room H1/optional cover→availability/count summary→devices→owner Edit room.
4. **Components:** DeviceCard, PowerSwitch, StatusLabel, Dialog, SelectField.
5. **Controls:** lights explicit on/off, device title Details; door card opens protected detail; gas/motion Details; favorite pressed button; Edit opens name/cover and assigned device chooser; Save/Cancel; Remove room only when empty and confirmed.
6. **Behavior:** power request uses shared pending state, disables competing action; favorite updates own preference; reassign PUTs preserve IDs and MQTT. Edit membership changes save each affected device with per-row result and version; failure leaves explicit partial assignment list, not all-or-nothing claim. Delete409 if nonempty.
7. **Services:** device command, PUT devices(room_id), rooms PUT/DELETE, preferences.
8. **Data:** Room, DeviceDTO list, session role, versions, pending records.
9. **States:** room not found→not-found with Rooms link; room empty→owner Assign device link to Settings devices; board unavailable→read-only cards; unknown light offers explicit actions only if board live+policy permits.
10. **Responsive:** single column at narrow width;2/3 device grid as content fits; Edit form max440px, dialog scroll with actions visible.
11. **Accessibility:** back and H1 predictable; switch checked tracks reported state; edit group labelled; no focus loss from live device updates.
12. **Security:** owner shared metadata only, viewer cannot action; type changes unsupported; aliases checked for collision before rename.
13. **Errors:** version409 reload current values with explanation, never silent overwrite; busy409 shows existing pending; timeout uncertainty inline.
14. **Acceptance:** ROOM-02/UI-03: rename/reassign changes no topic/ID; all7 devices remain reachable; no brightness control.

## S04 Device detail — `/devices/:id`

1. **Purpose:** understand one device and its supported behavior.
2. **Users:** all signed-in, owner for edits.
3. **Layout:** Back, H1/name/room→reported state+age→supported control→recent activity→Information→owner Edit. Door ID routes to same DoorDetail component as S06; not a second unlock implementation.
4. **Components:** DeviceCard/PowerSwitch, SensorDetail, ActivityList, Field, SelectField, StatusLabel.
5. **Controls:** light On/Off, favorite, History→activity?device_id, Edit name+room Save/Cancel, Information disclosure. Door S06 controls. Gas/motion have no actuator. Remove fixed hardware is not offered; help explains hide from favorites/reassign. Unsupported registry ID→not found.
6. **Behavior:** save only valid name/room with version; read-only device ID/board under Info. No artificial brightness slider, sensor sensitivity control or calibration knob. A future extension is absent from control area.
7. **Services:** device GET/PUT, command, preferences, activity filtered.
8. **Data:** registry capabilities, latest observation, sensor_latest, command history, metadata.
9. **States:** pending, observed, uncertain, stale, offline, no sensor reading, denied access event separate from lock state. Gas shows“Experimental gas sensor”+alert/normal/stale; rawADC only owner Advanced, never calibrated PPM gauge.
10. **Responsive:** main card+activity stacked; desktop2 columns, max900px; long technical ID can wrap or copy as text, never layout overflow.
11. **Accessibility:** information definition list, visible timestamp label, icons decorative; status change polite; critical gas alert assertive once.
12. **Security:** no status editing; safe metadata rendering; owner-only raw diagnostics; no inferred sensor accuracy.
13. **Errors:**invalid IDs404, save409 preserves draft, missing telemetry“Not received”, not0; connection stale disables unsafe command.
14. **Acceptance:** SENSOR-01/02, UI-04:gas no fake zero/PPM; motion no fresh-clear assumption; controller report wording honest.

## S05 Security — `/security`

1. **Purpose:** view door report, sensor alerts and recent access without technical clutter.
2. **Users:** all residents; owner access-card administration.
3. **Layout:** H1→critical active alert→door summary with large explicit state→Lock/Unlock controls→Gas/Motion cards→Access cards owner link→last5 relevant events→View all activity/alerts. Desktop door left, sensors/activity right.
4. **Components:** StatusLabel, Button, Dialog, AlertBanner, SensorDetail, ActivityList.
5. **Controls:** Door details→S06; Lock; Unlock→protected S06 dialog; Access cards→S07; View alerts; gas/motion Details; View all activity.
6. **Behavior:** Lock shared service; Unlock never direct publish, reauth+confirm. Known reported locked has state“Controller reports locked”; explanation “Lock position is not physically sensed” nearby or details accessible. Alert read doesn't clear sensor danger. No arm/disarm/Home/Away/Night buttons.
7. **Services:** snapshot, commands, unlock challenge, alerts, activity categories doors/sensors.
8. **Data:** door observation and freshness, board connection, critical alert episodes, motion event age, audit summaries, session can_unlock.
9. **States:** unknown/stale/offline door never green secure; RFID denied shown event banner without overwriting locked state; unknown gas normal not inferred; viewer locks disabled with reason.
10. **Responsive:** paired Lock/Unlock actions can stack on narrow/large Hindi text; consistent order; sidebar desktop, one clear door card.
11. **Accessibility:**worded status+icon, Unlock clearly labelled, pending status associated, keyboard Cancel always reachable.
12. **Security:** U-only unlock, O-only cards, reauth freshness and server enforcement; no raw UID on resident security overview.
13. **Errors:**no broker/DB→sensitive actions unavailable, unknown outcome→“We couldn't confirm the controller changed”, not failure implying still locked.
14. **Acceptance:** SEC-01..05, CMD-03; unknown never secure; direct endpoint cannot bypass roles; all denied states understandable.

## S06 Front door and unlock flow — `/security/door`

1. **Purpose:** safely operate the existing timed relay lock and inspect access.
2. **Users:** residents with lock permission; U users for unlock.
3. **Layout:** Back, H1 Front door→controller-reported mode+receive time→Lock primary/Unlock secondary→auto-relock behavior note→last access events→owner Access cards.
4. **Components:** Button, StatusLabel, Dialog, Field(password), ActivityList, AsyncPanel.
5. **Controls:**Lock, Unlock, reauth password+Show password+Continue/Cancel, confirmation “Request unlock”/Cancel, Check status read-only, View activity. No tactile hold-only interaction; keyboard works equally.
6. **Behavior:**Unlock selection verifies U and current board/persistence. If >5min reauth, password required; then confirmation explicitly “Request front-door unlock? The controller normally relocks after about5 seconds. Physical lock position is not sensed.” Cancel default focus. Request unlock obtains30s bound challenge and dispatches once; button disabled while pending. Published→“Request sent; waiting for controller”. Live unlocked report→“Controller reports unlocked”. Do not run a countdown that guarantees relock. A later live locked report updates mode. Timeout/connection loss→uncertain; Check status only. A new attempt requires fresh explicit consent, never automatic retry.
7. **Services:** auth reauth, unlock-challenges, device command, command GET, activity. Same component used for `/devices/door-1`.
8. **Data:**session permissions/reauth, challenge expiry, door freshness, command record, observations.
9. **States:**locked, unlocked, unknown, stale, offline, pending, reported, uncertain, session expired, reauth failed/challenge expired. Denial is history, not mode.
10. **Responsive:**desktop max740px, mobile full-width confirmation with text wrapping, sticky action footer above keyboard; no close icon crowding Cancel.
11. **Accessibility:**dialog labelled/focus trapped, Cancel initial, Esc cancels before submit, credentials support paste; progress not color-only.
12. **Security:**reauth not a client boolean; single-use server challenge/CSRF; logout/expiry cancels unexecuted flow; UID clone and network risks described in owner Help.
13. **Errors:**publish ambiguity never automatic replay; expired challenge requires reviewing confirmation again; concurrent RFID activity409 device busy; firmware reconnect can delay relock→deployment release blocker, not hidden in UI promise.
14. **Acceptance:**SEC-02, CMD-03/04, HW-02:Cancel emits0 MQTT; one confirm≤one application publish; no “physically locked” claim; network interruption behavior tested by supervised operator.

## S07 Access cards — `/security/access-cards` and `/:uid`

1. **Purpose:**owner manages recognized RFID UIDs and labels.
2. **Users:**owner only; non-owner direct URL403 with Security return.
3. **Layout:**Back, H1→UID-security explanation→Add card→list→card detail/editor dialog; empty state Add card. No generic enrollment spinner pretending reader pairing.
4. **Components:**AccessCardRow, Field, Button, Dialog, StatusLabel.
5. **Controls:**Add, UID, label, Authorized checkbox(default true with explicit label), Save/Cancel; row Details→fullUID(owner), Edit label/authorization; Revoke authorization toggle; Remove card confirmation. Reauthenticate as needed. Optional last scan suggestion only after explicit selection; manual UID entry always available.
6. **Behavior:**normalize UID hex+colons,4/7/10 bytes; save create201 only, duplicate409 suggests opening existing card; edit PUT/version preserves UID. Revoking leaves row“Not authorized”; remove deletes after confirmation. All server durability+audit before success; list refetch. Revoked card scan denies; UI never unlocks by row tap.
7. **Services:**GET/POST/PUT/DELETE `/api/logs/rfid-cards`, auth reauth, owner-redacted RFID WS/events.
8. **Data:**cards versions, latest eligible scan owner-only, audit, role; no preseed cards (local DB currently0).
9. **States:**empty, loading, save pending, error, reauth needed, invalidUID, duplicate, removed concurrently, no broker (administration can persist but show scanner unavailable; grant still fails closed).
10. **Responsive:**list rows stack owner/UID/status; mobile edit full-width dialog; desktop max780px; fullUID selectable and wraps safely.
11. **Accessibility:**per-field visible labels/errors, authorization text not colored dot, Remove names card owner, confirmation focus Cancel.
12. **Security:**owner+reauth on every write; UID masking in overview, full value only owner detail; no UID in general notifications; UID authentication is clonable, not strong identity.
13. **Errors:**failed save keeps values, no form reset until durable response;404 on remove means already absent after confirmation;409 version reload without losing draft.
14. **Acceptance:**SEC-04/05:unauthorized403, duplicates don't overwrite, revocation+removal audited, HTML label inert, Cancel no write.

## S08 Activity — `/security/activity`

1. **Purpose:**read actual household events and command outcomes.
2. **Users:**all signed-in, role-redacted.
3. **Layout:**H1→category chips→date range→search/device filter→grouped event list→Load more. Event detail inline or dialog with exact supported fields.
4. **Components:**ActivityList, ChipGroup, Field, SelectField, Dialog, AsyncPanel.
5. **Controls:**All/Doors/Lights/Sensors/System; From/To dates; search; device selector; Clear filters; Load more; event Details if available; Back. Legacy Clear display is removed from main feed to avoid audit-erasure confusion; no delete-history/export buttons in release.
6. **Behavior:**server filters before pagination, stable newest id descending, cursor not fake page count; local date inputs converted timezone-aware to UTC range including selected last day. New events insert once by persistedID; reading old page doesn't scroll user to top. Details shows requested/published/controller report/uncertain distinctly.
7. **Services:**`/api/activity`, WS log with persistedID; no client pretending one event_type equals broad category.
8. **Data:**audit rows, display names, source/outcome, cursor; legacy details parsed defensively.
9. **States:**no events yet, no matching period, error, loading more, stale/offline cached display, unknown legacy detail safely formatted.
10. **Responsive:**mobile date fields stack; desktop single filter row if room; event list reading column≤900px; technical details wrap.
11. **Accessibility:**list/time semantics, Load more preserves focus, result count polite, visible date labels, local timezone displayed once.
12. **Security:**read requires session; viewer/resident no fullUID/transcripts; no mutation in detail; safe text even malformed JSON.
13. **Errors:**invalid date/cursor400 fields; pagination fetch failure preserves already loaded rows and offers read retry; no duplicated events after reconnect.
14. **Acceptance:**ACT-01..03:stable pagination, category/date correctness, role redaction, persisted44 historical baseline rows preserved by migrations.

## S09 Alerts — `/security/alerts` and `/:alertId`

1. **Purpose:**review persistent current warnings and acknowledged/resolved history.
2. **Users:**all residents; acknowledge owner/resident.
3. **Layout:**H1→Active/History chips→severity-ordered alerts→detail with sensor provenance+timestamps+meaning→acknowledgment receipt.
4. **Components:**AlertBanner, ActivityList, ChipGroup, Button, StatusLabel.
5. **Controls:**filter, View alert, Mark read, acknowledge(“I've seen this”), Device details, Back, Load more. No “Make safe”,“Reset sensor” or “Dismiss gas alarm” button.
6. **Behavior:**opening detail marks read only; ack receipt doesn't resolve active sensor alert. Gas resolution needs fresh validated normal reading; dedup2s repeated alerts into one active episode with last_seen update; new episode after resolution gets new ID. Motion events not intruder detection; access denied is event, not lock change.
7. **Services:**alerts GET/read/acknowledge, WS alert, sensor latest.
8. **Data:**alert state, severity, read/ack per user, source/freshness, controller receive timestamps.
9. **States:**none active, resolved history, new critical, ongoing critical, stale current sensor, ack pending, error. Stale sensor doesn't automatically resolve existing alert.
10. **Responsive:**critical first full-width card, mobile same reading/action order; desktop max900px. No alert obscured by fixed nav.
11. **Accessibility:**new critical once role alert, ack button clear, history headings/dates, do not repeatedly announce unchanged readings.
12. **Security:**R reads, C acknowledges, no weakening alarm based on viewer receipt; do not expose raw UID. No claim browser alerts work closed/background.
13. **Errors:**receipt failure retains unread/ack status; hub disconnect preserves unresolved warning; notification denial doesn't hide in-app alerts.
14. **Acceptance:**ALERT-01..03:ongoing gas generates one episode; ack never clears danger; reconnect restores active warnings; prototype wording.

## S10 Shrimaan — `/assistant`

1. **Purpose:**approachable bilingual offline speech/text device control.
2. **Users:**all residents; viewer queries only.
3. **Layout:**H1 Shrimaan→readiness/privacy line→128px microphone→visible state/Stop→transcript→reply→typed input+Send→safe suggestion chips→Voice settings. No debug model tables or fake avatar identity.
4. **Components:**MicrophoneControl, ConversationPanel, Field, Button, ChipGroup, AsyncPanel.
5. **Controls:**Tap to speak; Stop listening(always visible active, ends recording and processes once); Cancel request(discards unexecuted work); Type request; Send; edit transcript; Try again(requires gesture); Replay/Stop speech; language link; example chips prefill only; Clear this conversation(in-memory, not audit). Examples use actual room names “Turn off Room1 lights”,“Lock front door”,“Check gas sensor”; no unsupported weather/music/AC.
6. **Behavior:**first mic gesture checks local readiness then asks permission; capture≤20s with manual stop/VAD ending. End utterance→local STT→one final transcript→deterministic intent→shared execute for safe unambiguous action; ambiguous reply asks Which light? with local choices and no publish. Typed Send same path, works without STT/TTS. Unlock requests say“Use Security to confirm unlocking” and link there, never execute from voice/text. Speak actual observed outcome only; uncertain says couldn't confirm. Speech playback requires opt-in and browser gesture handling. Stop listening ends capture and processes once; Cancel request discards unexecuted work; published command remains tracked.
7. **Services:**voice ticket+WSS `/voice`, assistant interpret/execute, speech jobs/audio, command WS, preferences; local CPU worker behind server.
8. **Data:**current utteranceID/session, readiness, input/reply language, safe aliases, registry, command outcomes. Transcript session-memory only, not saved by default.
9. **States:**not setup, ready, permission needed/denied, no mic, listening, processing, busy, ambiguous, awaiting controller, speaking, completed, error, hub disconnected. Distinguish STT-ready/TTS-missing/manual text-ready;“Offline voice ready” only after both installed and probed. No wakeword default.
10. **Responsive:**mobile mic and input above nav/keyboard; desktop centered≤740px with input always visible; no horizontal conversation bubbles causing Hindi overflow.
11. **Accessibility:**microphone labelled start/stop, final text announced once, partial transcript visual only; all voice functionality has text/manual equivalent; language preference independent from interface language.
12. **Security:**auth throughout, no unlock by voice, no cloud requests, no hidden background recording, capture stops on navigation/logout/visibility loss/device unplug. No household-wide transcript broadcasts.
13. **Errors:**unclear recognition doesn't default all lights; model crash frees job and restores typing; denied permission help doesn't reopen prompt; TTS failure text remains; bad alias requests clarification; stale late utterance ignored.
14. **Acceptance:**AI-01..07, LANG-01:Hindi/English typed/manual and voice where assets validated; Hinglish corpus benchmark; no mic on load; Stop frees tracks; WAN0; precise accuracy/latency only measured.

## S11 Settings — `/settings`

1. **Purpose:**make personal comfort and household maintenance findable without technical clutter.
2. **Users:**all residents, owner manages shared/security/diagnostics.
3. **Layout:**H1→You/session role→Appearance, Accessibility, Language, Voice & assistant, Notifications→Devices, Rooms, Home details(owner edit)→Security & privacy, Help, About→Advanced(owner). No unsupported Automations/Cameras directory.
4. **Components:**SettingsRow, StatusLabel, Button, AsyncPanel.
5. **Controls:**each row navigates to route below; Sign out; no switches hidden in navigation rows. Rooms link uses S02; Devices uses S13. No fake member admin:owner console identity instructions in Security settings.
6. **Behavior:**local preferences apply immediately; shared edits require durable server response; read-only personal settings remain usable when hub unavailable. Sign out invalidates server session and closes capture/sockets, retains nonsensitive local theme/lang.
7. **Services:**session/preferences/home settings; most links local route changes.
8. **Data:**local preferences, own user preferences, actual role, home metadata; no fabricated avatars/cloud profiles.
9. **States:**ready, local-only during outage, settings fetch failure, role-limited, session expired. Omit advanced to viewer/resident.
10. **Responsive:**max780px, rows min64px grows for labels; mobile single column, desktop grouped sections with same order.
11. **Accessibility:**full labelled rows, headings, clear value summaries, keyboard logout; Hindi translations of all navigation and safety copy required for release.
12. **Security:**no credentials in localStorage or rendered diagnostics; server policy applies regardless of hidden row.
13. **Errors:**preference save conflict shows reload/retry; local storage blocked shows session-only notice; server absent doesn't prevent theme selection.
14. **Acceptance:**UI-07/THEME suite:every visible row opens implemented page;05/01/03/04 available; Advanced contains MQTT/model details, Home does not.

## S12 Settings subpages — individual route specifications

Each route below inherits all14 shared dimensions: purpose/users/layout/components/controls/behavior/services/data/states/responsiveness/accessibility/security/errors/acceptance. The columns explicitly define its individual differences; no row is a placeholder. Desktop max780px (Advanced1180px), mobile single-column+Back; all Save failures preserve drafts and all routes have loading/read-error/empty/denied/hub-offline states where they fetch data. Local-only settings have blocked-storage state instead of network loading. This avoids duplicate descriptions of the identical shell.

| Route / purpose / users (1–2) | Layout+components (3–4) | Controls+behavior (5–6) | Service+data (7–8) | States+responsive+a11y (9–11) | Security+errors+acceptance (12–14) |
|---|---|---|---|---|---|
| `/settings/appearance`:select theme; all | H1, ThemePicker4 previews, selected name, Reset | radios apply immediately; Reset→05 only; Text size link→accessibility | Theme/Preferences local, exact keys THEMES | selected, session-only; previews2col where fit else1; radio arrows, checked+text | inert samples never publish; invalid storage05; THEME-01..09 |
| `/settings/accessibility`:comfort; all | text preview, Large text checkbox, Large controls checkbox, Reduce motion, stronger outlines, Reset accessibility | immediate typed local prefs; Reset false app prefs but OS reduce retained | local preferences; no new API | effective OS reduce read-only explanation;200/400% reflow; switch labels and explanatory text | no authority changes; storage failure current visit; COMP-14/THEME-06/07 |
| `/settings/language`:interface language; all | fieldset English/हिन्दी, local sample, current label | applies immediately to all labels/formatters+document.lang; user names unchanged | I18n local dictionaries+language key | en/hi, missing translation English fallback; Hindi line1.65; focus stays selection | no remote translation; all safety copy human-reviewed before release; LANG-01/02 |
| `/settings/voice`:input/output; all | Input Auto/Hindi/English; Reply Auto/Hindi/English; Spoken replies opt-in; installed voice select; voice-rate slider; test phrase; privacy link | save own prefs; Test voice deliberate local synthesis; Stop playback; wakeword option absent except read-only “Tap to speak is active” | preferences + speech API; model readiness sanitized for all via Snapshot speech extension | STT/TTSmissing, busy, permissiondenied, autoplayblocked; select only verified voices; slider keyboard | no mic auto-start; voice doesn't grant unlock; TTS fail leaves text; AI-03/04 |
| `/settings/notifications`:category and permission; all | in-app status always on, OS permission status, Enable browser alerts button, category checkboxes gas/motion/access/device, sound opt-in+Test sound | request permission only button; save own prefs; critical in-app stays visible even category muted; Test sound gesture | NotificationController, preferences, Notification permission | granted/default/denied/unsupported, foreground-only note; controls48px | lockscreen previews omitUID/person detail by default; no false background delivery; ALERT-03 |
| `/settings/home`:shared name; all read, owner edit | H1, home name Field, Save/Cancel, rooms link | validate1–60; Save versioned; Cancel reset draft | GET/PUT settings/home | read-only resident/viewer, conflict; long Hindi name wraps | owner only; no surname/address inferred; PREF-03 |
| `/settings/privacy`:data/microphone/security; all, owner section | plain local data explanation, session identity/role, Clear current conversation, Sign out; owner last backup age+operator instructions | clear memory transcript only; logout stops capture; owner instructions for local account setup/rotation, not arbitrary admin API | session, Voice.stopCapture; owner system metadata | current-session transcript none/cleared; readable≤65ch; confirm only destructive data operation | no “delete all audit” promise; micLAN transport and no retention disclosed; PRIV-01 |
| `/settings/help`:offline recovery; all | local topic list Lights, Door, Access cards, Voice, Connection, Sensor limitations; expand/collapse | disclosure opens local text; Open Security/Assistant contextual link | bundled local strings+help, read-only | usable WAN0; native details summaries,200%zoom; no unsupported feature articles as setup | no phone numbers or emergency medical procedures invented; no network workaround that disables trust/auth; UI-08 |
| `/settings/about`:version/licenses; all | app name, actual version, local build ID if available, OSS attribution list | local license disclosure links; Back; no Check cloud update action | bundled metadata actual package version+assets registry summaries | unknown build labelled unavailable; licenses readable offline | no secrets/host paths; no fictitious model active; OPS-01 |
| `/settings/advanced`:diagnose; owner | sections Hub, Broker, Boards, Observation age, Persistence, Certificates, Local AI, Backups; read-only technical table +Refresh | Refresh GET; AI row→S14; Backup/Restore instructions only until secure operator tools implemented | system+model registry; board receive times, not heartbeat-guaranteed sensor state | degraded/brokeroff/DBreadonly/workerdown; tables wrap or boundedscroll; strong header labels | never passwords/keys/fullfilesystempaths;403 direct route; OPS-02 |

## S13 Device management — `/settings/devices`

1. **Purpose:**configure names, room assignment and personal favorites for the fixed hardware baseline.
2. **Users:**all own favorites; owner shared editing.
3. **Layout:**H1→supported hardware explanation→search→all7 device rows→room assignment/name editor. Separate Favorites checkbox from owner metadata action.
4. **Components:**Field, SelectField, SettingsRow, Dialog, Button.
5. **Controls:**Details, Rename, Assign room, favorite checkbox, Save/Cancel; Rooms link;“Add hardware” informational Help link only, no fake pairing or deletion of fixed device.
6. **Behavior:**own favorites immediate pending→save; name/room owner PUT versioned; cannot edit ID/type/status; room label changes only. No delete/re-add workaround that loses firmware identity.
7. **Services:**devices GET/PUT, rooms GET, preferences PUT.
8. **Data:**DeviceDTO list, Room list, role, versions, favorites.
9. **States:**none/registry drift, filter empty, save pending, conflict, offline hub; device offline still editable if hub persistence healthy (metadata change independent of relay connectivity).
10. **Responsive:**mobile row labels wrap, desktop table only if accessible with action labels; max900px.
11. **Accessibility:**distinct favourite/rename names per device, checkbox correct, errors next to field, search result count.
12. **Security:**owner metadata, viewer personal preferences only; unknown record can't gain capabilities from type string.
13. **Errors:**invalid name/room400/404;409 reload actual version; save failure retains draft and prior saved data; favorites service outage doesn't show durable star success.
14. **Acceptance:**ROOM-02, PREF-02, UI-04:IDs stable, capabilities fixed, favorite preference per-user; all hardware remains reachable.

## S14 Local AI management — `/settings/advanced/ai`

1. **Purpose:**owner understands installed speech assets and activates a validated profile.
2. **Users:**owner; no household user needs model details to turn on light.
3. **Layout:**H1→STT/TTS ready summary→registry list(provider, language, model bytes, license status, active)→Activate→offline provisioning instructions→last probe/error. Runtime RAM shown only if measured, not copied from file size.
4. **Components:**StatusLabel, ActivityList/read-only rows, Button, Dialog.
5. **Controls:**Refresh, Activate installed profile, Cancel/Confirm activation, Test voice, Stop playback, Help. No Download now/Upload arbitrary model/Delete/Run command endpoint in this release.
6. **Behavior:**activate only idle worker, verify hash/readability/language config+load probe; failed activation retains prior asset; manual home controls unaffected. Test audio is generated locally. Missing assets use documented operator setup when internet is available once.
7. **Services:**ai/models GET/activate, system, speech test; ModelService.
8. **Data:**registry/readiness/license review, worker health, measured model bytes; no invented benchmark scores. Candidate choice per OFFLINE_AI.
9. **States:**not installed, integrity fail, license unresolved, ready, loading, busy, failed probe, inference unavailable; release readiness needs Hindi+English tests.
10. **Responsive:**mobile asset cards, desktop bounded table; long model IDs wrap; max1180px.
11. **Accessibility:**readiness text, activation warning+focus Cancel, progress actual job, keyboard test/stop.
12. **Security:**owner+reauth, registry ID only, no public filesystem paths, no runtime inference network; provenance gates redistribution.
13. **Errors:**409 busy wait/manualretry,503 probe fail preserves old profile, storage unavailable no activation. No package/model install triggered by page visit.
14. **Acceptance:**AI-04/07:missing/corrupt assets don't crash app; activation rollback; WAN0; storage/RAM reported separately.

## S15 Login, access denied and route recovery

1. **Purpose:**local authentication and understandable recovery from missing routes/session.
2. **Users:**all household accounts; initial owner provisioned on host console.
3. **Layout:**`/login` local HomeAuto logo, H1, username/password, Sign in, offline help;`/not-found` clear message+Home; access denied H1+safe Back; no live household cards before auth.
4. **Components:**Field, Button, AsyncPanel, StatusLabel.
5. **Controls:**username/password, Show password, Sign in, Help, Back to Home. Safe in-app return path only; not arbitrary return URL.
6. **Behavior:**sign-in sets server cookie+CSRF then snapshot/navigation; invalid login generic message; expired session stops mic/closes sensitive views, returns login; local theme/lang remain. First-install page shows “Set up an owner on the home hub” instructions, not network-open bootstrap password.
7. **Services:**auth login/session/logout; public minimalhealth; console-only provisioning.
8. **Data:**no user enumeration, only actual session after login; local display preferences.
9. **States:**setup required, login ready, busy, error, throttled, hub absent, notfound,403; no cached private home snapshot before auth on shared browser.
10. **Responsive:**single column max440px; keyboard never covers submit/cancel; same theme background.
11. **Accessibility:**autocomplete username/current-password, paste, password manager, visible labels, generic error announced, focus only after submit failure; not memory puzzles.
12. **Security:**HTTPS, strict Host/Origin, rate limit, securecookie, CSRF subsequent writes; no account creation/reset over LAN.
13. **Errors:**401 generic,429 retrytime,503 no fake empty account; unknown API respondsJSON404 while unknown UI shows notfound.
14. **Acceptance:**AUTH-01..05, NAV-01:direct protected route checks auth, login redirect confined local, logout revokesSockets, theme and Hindi selection usable before login.

## Completion evidence

For each route record actual UI screenshot/DOM checks at390px and1440px, plus320px/Hindi/zoom/error examples across the suite. For5 primary screens, all4 themes and5 widths produce100 visual combinations, then key states in each theme; scripted screenshots may be later combined into contact sheets. Documentation does not mark any of these render tests passed today. [TEST_PLAN.md](TEST_PLAN.md) supplies IDs and release gates.
