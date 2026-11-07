# HomeAuto — UI/UX Design Specification

> **Active revision 3,2026-11-05.** Existing visual analysis and images below are retained. [THEMES.md](THEMES.md) is now the single exact registry for colors, geometry, type, motion, breakpoints and preferences;[COMPONENT_SPEC.md](COMPONENT_SPEC.md) owns reusable interaction contracts;[SCREENS.md](SCREENS.md) completes every route/control/state/security/acceptance specification. These resolve earlier alternative dimensions/examples below. [API_CONTRACTS.md](API_CONTRACTS.md) defines actual vs planned services;[TASKS.md](TASKS.md) is the coding order.

## Revision3 reconciliations

- Theme05default,01/03/04alternatives unchanged. Same functional component architecture; Theme03blue mic/larger baseline; Theme04pastels; Theme01warm cream. All4 reference boards were visually inspected2026-11-05 and preserved unchanged. Names/avatars/devices/counts from the posters are not resident data.
- Canonical card radii05=22px,01=24px,03=20px,04=24px; controls14px; body16px except03=18px; Large text20px in any theme without multiplication. Header28pxmobile/32pxdesktop. Exactmatrix in THEMES supersedes earlier20/22px/card-radius naming variants.
- Breakpoints320–599mobile bottomnav,600–767two-column bottomnav,768–1023compact80pxrail,1024+228pxsidebar; maxcontent1180px. Atzoom/contentoverflowcollapse adaptively. Earlier alternate768tablet/1280content/220–240sidebar choices are illustrative only.
- Minimum48px targets,52pxordinarybuttons,56pxcomfort controls; all text containers grow. Strong control outlines distinct from decorative subtle borders. All meaningful states use text+icon and WCAGAA contrast. Optional stronger outlines and large text independent of theme.
- Hindi **and** English interface/critical copy are required for household release; the earlier English-first note is staging only. Input/reply speech language independent from interface language; Hinglish quality measured, not assumed.
- Controller-reported relay mode is the strongest current evidence; there is no physical lock/door contact. Replace “physically confirmed” expectations with explicit controller-report+freshness semantics. No green “Home protected”/“everything safe” or guaranteed auto-relock countdown; the firmware reconnect loop can delay relock. “Controller reports locked” with a position-sensing caveat is truthful.
- Gas is experimental rawADC-derived state, no calibratedPPMgauge/no missingreading0. PIRno initial/periodicclear; showlast event age/unknown current state. Alert acknowledgment doesn't resolve sensor danger.
- Rooms/home metadata are shared DB data with owner permissions; favorites/voice/categories are own-user DB preferences; theme/accessibility/interface language browserlocal. No competing home-name localStorage source.
- Doorunlock requires granted server permission, freshpasswordreauth, single-usechallenge and explicit Cancel/Requestunlock dialog. Voice/typed unlock links to protected Security flow; it never directlypublishes. Sensitive retry never automatic.
- No unsupported hardware pairing or deletion of7fixedrecords in UI; owner can rename/reassign, personal favorite controls work. Familyidentity provisioning initiallyconsole-only; no fake cloudprofiles or member list.
- Strict offline runtime means local fonts/icons/help/inference, not a service-worker guarantee. Microphoneoffonload even if permissiongranted; visibleStop/Cancel and text path. No life-safety notification guarantee when app closed/background.

The retained tables below explain visual intent and earlier click inventories; implement exact behavior from the revision3 linked contracts where wording differs. This is an enrichment of selected design, not permission to change product scope.

> **Design handoff v2.0** · Target implementer: GPT-6.1 High (Sol) / Codex. The images are inspiration; THIS written specification defines realistic behavior and approved scope. If code and prose conflict on what is already supported, the inspected code and `context.md` decide the baseline.

> **Version:** 1.0 design contract · **Default visual theme:** 05 Serene Emerald  
> **Alternate visual themes:** 01 Warm Organic · 03 Universal Comfort · 04 Friendly Pastel  
> **Visual references:** `reference-images/` · **Implementation plan:** `plan.md` · **Real feature inventory:** `context.md`

## A. Design intent and non-goals

**Product personality:** a welcoming, quiet, home-oriented app that a nontechnical adult or older person can understand without instructions. The software is sophisticated underneath; the interface should not advertise complexity.

**Four usability promises**
1. **One glance:** tell whether the home is safe, which light/door states are known, and whether an alert needs attention.
2. **One tap:** toggle a light, open room controls, view security, or start speech without hunting through menus.
3. **One clear answer:** show what happened, what is still pending, and what failed—in plain language.
4. **No internet dependency:** all critical screens, icons, typography, settings, data, and local speech work without cloud services.

**Non-goals:** cyber/neon console aesthetics, huge data charts on Home, developer jargon on resident-facing screens, decorative 3D transitions, cloning Google Home/Mi Home branding, and showing imaginary hardware as functional.

## B. Exactly which four generated images to use

| ID | Name / asset | Selection | What to adopt | What *not* to copy literally |
|---|---|---|---|---|
| **01** | **Warm Organic** — `reference-images/theme-01-warm-organic.png` | Selectable | Cream background, warm photos, dark evergreen brand, gentle compact tiles, illustrated Shrimaan identity. | Generated family names/counts, unsupported cameras/AC/fans/scenes. |
| **03** | **Universal Comfort** — `reference-images/theme-03-accessible-family.png` | Selectable | Senior-friendly larger readable cards, clear protective-door banner, large blue mic, simple security action buttons, “Accessibility” setting. | Unimplemented temperature controller, cameras and additional accessories. |
| **04** | **Friendly Pastel** — `reference-images/theme-04-pastel-blue.png` | Selectable | Cool blue mood, distinct room-color blocks, friendly category colors, approachable avatar and wide message buttons. | Unimplemented security arm/disarm, climate/media features and camera previews. |
| **05** | **Serene Emerald** — `reference-images/theme-05-serene-emerald-default.png` | **Default** | Calm white surfaces, emerald green mic and selections, lush but restrained room photography, clean numbered screen hierarchy, easy security controls. | Imagined extra devices, multi-camera feeds, hardcoded avatars and unverified comfort mode. |

### Reference images (the exact previously generated boards)

**Theme 05 — default**

![Theme 05 Serene Emerald — default](reference-images/theme-05-serene-emerald-default.png)

**Theme 01 — Warm Organic**

![Theme 01 Warm Organic](reference-images/theme-01-warm-organic.png)

**Theme 03 — Universal Comfort**

![Theme 03 Universal Comfort](reference-images/theme-03-accessible-family.png)

**Theme 04 — Friendly Pastel**

![Theme 04 Friendly Pastel](reference-images/theme-04-pastel-blue.png)

Every image is a **presentation board with five phone screenshots** (Home / Rooms / Security / Assistant / Settings). Rebuild the **app screen contents**, not the physical iPhone frame, promotional headline, background scene, author avatar, footer slogan, or billboard typography. Image-generation text can contain inconsistencies; use the exact labels in this document as implementation copy.

### B1. Screen anatomy directly observed in the images

**Image 01 (Warm Organic).** Large brand header on cream backdrop and white phone screens; Home shows a greeting, household-wide summary, three summary tiles, Quick Controls grid and scene chips. Rooms shows tabs and cards with room photos and mini device-type icons. Security includes a prominent “Home is Secure” card, four comfort/security shortcuts, a camera-preview concept and sensor status. Shrimaan uses a large green circular microphone plus message history and suggestion chips. Settings is a stacked list of icon-leading menu rows.

**Image 03 (Universal Comfort).** Family-oriented photography and large status text; Home emphasizes “Home is secure,” large Lights/Front Door/At Home/Temperature cards. Rooms is a scannable vertical list with larger tiles. Security foregrounds a very large Lock and Unlock pair, clearly separated from secondary sensors/history. Assistant uses an especially large blue mic and sample phrases. Settings explicitly contains an Accessibility row. The **large type and control sizing** are the important part of this variation.

**Image 04 (Friendly Pastel).** Powder-blue and cream background; Home uses colored quick controls and scene chips. Rooms has separate tinted bands per room (blue Living Room, mint Bedroom, apricot Kitchen, violet Bathroom, coral Entrance). Security is grouped as a green status banner, mode shortcuts, camera concepts, and sensor rows. Assistant has a friendly character illustration, blue mic footer bar, and wide conversational suggestions. Settings uses colored category-icon circles. Use vivid colors only in **small isolated regions**—never as full-screen harsh backgrounds.

**Image 05 (Serene Emerald).** A restrained near-white composition; Home features large household greeting, modest photo-led comfort banner, six simple Quick Controls tiles, and optional camera preview. Rooms uses white photo-and-device cards with friendly labels. Security uses “Home is Protected,” mode shortcuts, real door/access section, optional camera previews and sensor chips. Assistant centers a large green mic with exact text transcript/confirmation and common command suggestions. Settings is a quiet vertical list with thin separators and monochrome icons. This is the **baseline layout and visual hierarchy**.

## C. Theme system

Theme selection must change colors, typography **scale where appropriate**, borders, shadows, and card emphasis without moving critical controls around or changing their meaning. No theme may hide labels or reduce accessibility.

### C1. Theme palettes — implementation tokens

These are **design-token choices derived visually from the mockups, not exact pixel/color measurements of the generated imagery**. Tune during QA while retaining readable contrast.

| CSS variable | Theme 01 Warm Organic | Theme 03 Universal Comfort | Theme 04 Friendly Pastel | Theme 05 Serene Emerald **default** |
|---|---|---|---|---|
| `--bg` | `#FAF8F2` | `#F8F9F6` | `#F7F9FE` | `#F8F9F7` |
| `--surface` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` | `#FFFFFF` |
| `--surface-muted` | `#F4F1EA` | `#EEF2ED` | `#EEF3FB` | `#F0F3EF` |
| `--text` | `#18251F` | `#182333` | `#17243D` | `#19231F` |
| `--text-subtle` | `#52615A` | `#4F5B65` | `#55667E` | `#58655F` |
| `--primary` | `#1D7049` | `#187A48` | `#2565C7` | `#166F46` |
| `--primary-pressed` | `#155738` | `#115C35` | `#1A4FA4` | `#105537` |
| `--primary-soft` | `#E3F2E8` | `#E2F3E8` | `#E5EEFF` | `#E5F3E9` |
| `--accent-blue` | `#2869BD` | `#246BC4` | `#2D74E6` | `#3469B8` |
| `--accent-warm` | `#B36A19` | `#A96111` | `#AA5C13` | `#A86A1A` |
| `--danger` | `#B83E45` | `#BD333B` | `#B93746` | `#B7353D` |
| `--danger-soft` | `#FBE9E9` | `#FBE6E7` | `#FCE8ED` | `#FAE9E8` |
| `--border` | `#E4E8E2` | `#E0E6E0` | `#E1E8F2` | `#E5EAE5` |
| `--ring` | `#176D45` | `#165E3B` | `#1F57B4` | `#166F46` |

Additional category backgrounds, always paired with dark text/icon and **explicit state text**:

- **Lights:** `#FFF2D8` with dark amber glyph, independent of on/off status.
- **Door/Security:** `#DDF4E7` with dark forest glyph.
- **Assistant:** theme primary-soft; blue option in Theme 03, green option in Theme 05.
- **Information:** `#E8F0FF` with dark blue glyph.
- **Danger:** `#FBE6E8` with dark red glyph; never green for danger.
- **Theme 04 extra room tints:** Living Room `#E8F1FF`; Bedroom `#E2F6EC`; Kitchen `#FFF1D9`; Bathroom `#F0E9FF`; Entrance `#FFE7E5`.

**State colors are semantic, not artistic.** Do not invert danger/success meaning when switching themes. Status must always also appear in text, icons or both. Check WCAG AA contrast on all text and UI components after implementation.

### C2. Theme selection interaction

- Open **Settings > Appearance > Theme**.
- Show a row of four **image swatches** with title, short description, and radio-style selected ring.
- The options are in this order: **Serene Emerald (Default)**, Warm Organic, Universal Comfort, Friendly Pastel.
- Choosing a theme applies it immediately, without reloading, without network, and without changing devices.
- Persist `localStorage['homeauto.theme.v1'] = '05' | '01' | '03' | '04'`.
- On absent/invalid value, choose `05`.
- All pages must share `data-theme="05"` / `01` / `03` / `04` at document root; component styles use tokens, never per-page hardcoded greens/blues.
- User may reset to default using **Reset theme**. Appearance should also offer a local **Large text** option independent of Theme 03 (Theme 03 uses a slightly larger baseline).

### C3. CSS architecture example

```css
:root, [data-theme="05"] {
  --bg: #F8F9F7; --surface: #FFFFFF; --surface-muted: #F0F3EF;
  --text: #19231F; --text-subtle: #58655F;
  --primary: #166F46; --primary-pressed: #105537;
  --primary-soft: #E5F3E9; --border: #E5EAE5;
  --ring: #166F46; --danger: #B7353D;
  --radius-card: 20px; --radius-control: 14px;
  color-scheme: light;
}
[data-theme="01"] { --bg:#FAF8F2; --text:#18251F; --primary:#1D7049; --primary-soft:#E3F2E8; --border:#E4E8E2; }
[data-theme="03"] { --bg:#F8F9F6; --text:#182333; --primary:#187A48; --primary-soft:#E2F3E8; --border:#E0E6E0; --base-font-size:18px; }
[data-theme="04"] { --bg:#F7F9FE; --text:#17243D; --primary:#2565C7; --primary-soft:#E5EEFF; --border:#E1E8F2; }
```

**Implementation requirement:** the full theme definitions must declare **every** common token (including danger/accent/ring/pressed etc.) rather than rely on these abbreviated sample overrides. In CSS, avoid `!important` for theme switching. Prefer custom properties and semantic utility classes.

## D. Brand, font, icons and imagery

### D1. Name and logo

- Brand wordmark: **HomeAuto** (one word, upper-case H/A). The assistant's name is **Shrimaan**.
- Logo: an **original compact house silhouette** with softly rounded roof corners and a doorway/negative-space opening (the references use a green house shape). Keep the icon recognizable at 20–28 px.
- Create as **original inline SVG** with `currentColor` or `var(--primary)`, and provide 24px/32px/192px/512px icon variants from that source. Do not trace another company's logo.
- Logo placement: top left of mobile app bar and desktop sidebar. Wordmark label adjacent; never depend on icon alone for identification in expanded navigation.
- Assistant identity: do **not** make a cartoon elderly male mandatory; the green mic + “Shrimaan” text is the permanent, accessible identity. A locally bundled illustrated portrait is an optional accent in 01/04, hidden in Easy Mode.

### D2. Typography

Use a highly legible sans-serif, **locally hosted or system fallback**. Suggested: `Inter` for Latin, `Noto Sans Devanagari` for Hindi, with `Arial`, `system-ui`, `sans-serif` fallback. Do **not** depend on Google Fonts CDN; no external requests after app installation. A system-font-only initial build is preferable to a remotely fetched font.

| Role | Mobile | Desktop | Weight | Guidance |
|---|---:|---:|---:|---|
| App greeting / page title | 26px / 32px line | 30–34px | 700 | Only one primary page title |
| Card title | 17–19px / 24px | 18–20px | 650–700 | Never abbreviate device labels unnaturally |
| Body / device state | 16px / 24px | 16px | 400–500 | Main legibility baseline |
| Secondary text | 14–15px / 21px | 14–15px | 400–500 | Avoid below 14px outside metadata |
| Buttons | 16px | 16px | 600 | Sentence case; action verb |
| Micro-metadata | 13–14px | 13–14px | 500 | Never only way to convey alert |
| Easy / Large text | scale body to 18–20px | scale body to 18–20px | 500 | Controls adapt vertically; no clipping |

Line lengths around 35–65 characters for conversational explanations. Honor Hindi glyph metrics: do not use too-tight line-height, letter spacing, or artificial uppercase on Hindi text. Prefer numeral/tabular fonts for timestamps only.

### D3. Component geometry

| Element | Base spec | Senior-friendly condition |
|---|---|---|
| Root content width | Mobile 100%; desktop max `1280px` centered | Maintain large readable content column |
| Page padding | 16px mobile, 24px tablet, 32px desktop | >=16px always |
| Spacing scale | 4, 8, 12, 16, 24, 32px | 16–24px between core actions |
| Card radius | 20px | Rounded enough to look warm, not pill-shaped body |
| Buttons | Height 52px, radius 14px | 56–60px in Easy Mode |
| Icon button | At least 48x48px target | 56x56px in Easy Mode |
| Bottom navigation | 5 items, icons and labels, safe-area padding, 64–76px high | No unlabeled icons; larger target hit zones |
| Room image | `aspect-ratio: 16 / 9`, object-fit cover | Decorative only; room name remains in text |
| Card border | 1px subtle line and restrained shadow | Increase contrast slightly in Easy Mode |
| Modal | ≤440px on desktop, near-full-width on mobile | Visible cancel; focus trap; ESC except critical handling |
| Toggle | 48–54px wide, 28–32px high, large clickable card area | Text “On”/“Off” paired with switch |

**Shadow example:** `0 2px 12px rgb(18 37 26 / 0.045)`; stronger on hover only for pointer devices. No glowing neon, no heavy blur on scroll.

### D4. Icons and photos

- Use one consistent **outline SVG icon library** or project-local SVG set (home, grid, shield, mic, gear, bell, chevron-right, lightbulb, lock, unlock, flame, person-running, clock, plus, pencil, info, volume, wifi-off, check-circle, alert-triangle, moon, sun, play, filter, search, trash, arrow-left).
- Icons should share a uniform **2px stroke and 24px optical box**, with 20px in list rows and 28px in hero/large button. The logo is filled SVG, not an outline icon.
- Room photography in references is a mood cue, not required for controls. Bundled photos are optional; otherwise use tasteful flat illustrated room covers or icon blocks. Do not fetch images externally at runtime.
- **No false Live badges.** A camera tile may only appear when an integrated camera actually streams. No camera feed in current repo.
- User avatar is optional. Use an initials circle by default; do not hardcode reference-image faces or names.

## E. Navigation model and information architecture

### E1. Primary navigation (all four themes)

Mobile bottom bar has five items, order is fixed:

| Icon | Visible label | Route / view | Behavior |
|---|---|---|---|
| `house` | **Home** | `/` | Current household summary and direct controls |
| `grid-2x2` | **Rooms** | `/rooms` | Room list and selection |
| `shield-check` | **Security** | `/security` | Door, sensors, RFID cards, security activity |
| `mic` | **Assistant** | `/assistant` | Local Shrimaan voice/text interface |
| `settings` | **Settings** | `/settings` | Preferences and technical details |

- Active tab: solid semantic color icon, darker label, subtle marker under/behind icon. Non-active labels remain readable.
- Desktop: transform into a **left sidebar** (220–240px wide, icon + text), and show Home header and content area. Do not simply stretch phone cards edge to edge.
- Route changes should preserve app state and data subscriptions, stop voice capture unless session is explicitly kept active, and restore sensible scroll position.
- URL hash router or History API router is acceptable if Express serves the entry page for non-API routes.
- Secondary routes: `/rooms/:roomId`, `/devices/:id`, `/security/access-cards`, `/security/activity`, `/security/alerts`, `/assistant/history`, `/settings/appearance`, `/settings/accessibility`, `/settings/devices`, `/settings/voice`, `/settings/advanced`.

### E2. Shared top app bar (all pages)

| Element | Visual treatment | Interaction / rule |
|---|---|---|
| House logo + **HomeAuto** | Small green house SVG + 16px semibold wordmark | Clicking logo returns Home; accessible label “Go to Home” |
| Page heading or Home greeting | 26px text, high contrast | Informational, not a button |
| Notification bell | 48px borderless icon button with count only for unread critical items | Opens Alerts; badges only if unread exists; permission prompts happen after user gesture |
| Profile/household avatar | Small initials circle, optional | Opens household settings (not fake account login) |
| Network/connection badge | Subtle under greeting when relevant | Human copy: “Home connected” / “Can't reach home hub”; tooltip/detail under Advanced |
| Back arrow on secondary pages | 48px icon button | Returns to previous in-app location; no dead-end screen |

## F. Screen-by-screen controls and exact behavior

### F1. Home (`/`) — default Theme 05 reference

**Hierarchy:** app bar → greeting + one-line summary → optionally one authentic home image → safety/door banner → household control tiles → Quick Actions → optional supported scenes → optional camera panel (hidden now) → bottom nav.

**Normal first-run example:** “Good evening” / “Your home is ready.” Security status must be derived only from confirmed data; when the broker or ESP32 is offline say “Some devices are unavailable.”

| Object / button | Visual anatomy | Exact action / semantics | Availability |
|---|---|---|---|
| HomeAuto wordmark | House glyph + name, upper left | Go Home | Current |
| Alerts bell | Bell icon, small count badge if needed | Open Security > Alerts | Build on existing event messages |
| Greeting | Local-time greeting, optional editable household name | Informational; no surname hardcoded | UI |
| Safety summary | Green shield, plain sentence, status line | Tap opens Security; do not declare safe from stale readings | Current with truthful status logic |
| Hero comfort/photo card | 16:9 soft room image, short overlay | Tap opens primary room; if image absent show plain card | Visual only / optional |
| Lights summary tile | Bulb icon, “Lights”, “3 on” or “All off” | Open Rooms filtered to lights | Current |
| Front Door tile | Lock icon, “Front Door”, “Locked/Unlocked/Unknown” | Open Security > Door | Current |
| Gas tile | Flame/sensor icon, “Gas sensor”, “Normal/Alert/Unavailable” | Open gas detail | Current (uncalibrated) |
| Motion tile | Motion icon, “Motion”, “No movement/Detected/Unavailable” | Open motion detail | Current |
| Voice / Shrimaan tile | Mic icon, “Talk to Shrimaan” | Open Assistant; do not start mic before consent | Current UI; new STT/TTS planned |
| Quick Controls: Lights | Rounded icon+label tile | Open all light controls, no surprise bulk action | Current |
| Quick Controls: Turn all lights off | One large explicit action | Confirm? Not needed for ordinary lighting; show pending and per-light outcomes | Current with reliability upgrade |
| Quick Controls: Lock door | Lock tile | Sends `lock` after verifying status; shows pending then confirmed | Current with auth/status upgrade |
| Quick Controls: Check home | Shield tile | Opens detailed known/unknown state and alerts | UI aggregation |
| Quick Controls: Gas status | Flame tile | Shows raw reading and warning that PPM is estimated | Current |
| Scenes row: Good morning / Good night / Away | Small pill cards | Only show once scene engine exists; otherwise omit | Future |
| “See all” link beside Quick Controls | Text link with chevron | Open Rooms | Current |
| Cameras / live preview | Optional photo/thumbnail with Play | **Hide** until integrated camera exists; no dummy playback | Future |
| Offline indicator | Small neutral “Works without internet” label in Settings or onboarding | Information, not connection-health guarantee | UI |

**State handling:** all connected, partial device offline, server disconnected, no devices, alert, updating, slow ACK, stale data, new unacknowledged alert. Present the most urgent truthful summary in a single sentence; don't show technical MQTT indicators unless user opens Advanced.

### F2. Rooms (`/rooms`) — overview, search, and device detail

**Reference anatomy:** top title + plus button; category chips; vertical room-card list; each room card optionally has a scene photo and icon-labeled device summaries; selection opens room detail.

| Object / button | Visual anatomy | Action / semantic | Availability |
|---|---|---|---|
| Header **Rooms** | H1 and short “Control each room” helper | Informational | UI |
| `+` Add room | 48px icon button | Opens Create Room form, validates name, persists to room metadata store | Planned room data layer |
| Filter chip **All** | Filled selected pill | Show all rooms | UI |
| Filter chip **Lights** | Muted selected pill | Show rooms with light devices | Current |
| Filter chip **Sensors** | Muted selected pill | Show rooms with gas/motion devices | Current |
| Filter chip **Door** | Muted selected pill | Show entrance/door group | Current |
| Room card / room photo | Image left/top, strong room name, device count, chevron | Open `/rooms/:roomId` | UI |
| Room status micro-label | e.g. “2 lights on” / “Sensor unavailable” | Read-only; reflect real state | Current |
| Device mini icon (bulb/lock/sensor) | Rounded light tinted icon chip | Prefer navigation to device rather than hidden action | UI |
| Empty-state Add first room | Illustration + visible `Add room` button | Open Create Room | Planned |
| Room detail title + Back | H1, arrow left | Return to Rooms | UI |
| Edit room / pencil | Action menu or header button | Rename room, change cover, reassign devices | Planned |
| Room device card | Name, icon, explicit state and action | Open device detail or trigger clear primary action | Current |
| Light On/Off switch | Large accessible switch + text | `POST /api/devices/:id/command`; await confirmation | Current with reliability upgrade |
| Door Lock/Unlock | Large labeled button; separate style for unlock | Lock directly, unlock after auth/confirmation | Current with security upgrade |
| Gas sensor / Motion status | Non-interactive status tile with `Details` | View alert history and sensor readout | Current |
| Rename device | Overflow > Rename | `PUT /api/devices/:id`, preserve ID | Current |
| Remove device | Overflow > Remove | Destructive confirmation; `DELETE` only after appropriate permission | Current |
| Add device | Visible if supported setup exists | Show real setup flow; don't imply auto-discovery exists | API exists; pairing UX future |
| Offline device | Muted button and “Unavailable” | No toggle attempt; show last seen | Current derived status |

**User-friendly room labels:** let the resident edit `Room 1` -> `Living room` and `Room 2` -> `Bedroom`. Keep backend device IDs stable; never rename MQTT IDs based on UI labels.

### F3. Security (`/security`) — door, sensors, alerts, access, history

**Reference anatomy:** readable protection summary → prominent Front Door state/actions → Access cards → Sensors → Recent Activity → optional security modes and cameras only when implemented.

| Object / button | Visual anatomy | Action / rule | Availability |
|---|---|---|---|
| Header **Security** | Clear heading, no technical subtitle | Informational | UI |
| Status banner | Shield + “Front door locked” / “Action needed” / “Status unavailable” | Opens state detail; colors only reflect verified truth | Current with truthful aggregation |
| Front Door state | Large lock image, timestamp, clear word | Read-only confirmed status | Current |
| **Lock door** | Full-width emerald primary CTA when unlocked | Command; waiting state; success only after device status ACK | Current with upgrade |
| **Unlock door** | Clearly labeled secondary CTA | Require authorized session/PIN and explicit confirm dialog, show 5s auto-relock note | Security work required |
| Cancel unlock | Plain visible button in confirmation dialog | Close; send no command | UI |
| Confirm unlock | Descriptive button **Unlock for 5 seconds** | Verify permissions, send command, wait for actual status | Security work required |
| RFID / Access cards | Icon tile “Access cards” with count | Navigate `/security/access-cards` | Current |
| **Add access card** | Primary button in card manager | Form for UID + owner label; validation; secure write | Current endpoint, must secure |
| UID input | Uppercase/colon format helper | Validate length/allowed characters, normalize consistently | UI/security |
| Owner name input | Text field with descriptive label | Save owner label; sanitize rendering | Current endpoint |
| **Save card** | Form submit, disabled until valid | POST `/api/logs/rfid-cards`; update list after response | Current |
| Card overflow / Remove | 48px menu button, destructive menu item | Confirm revoke and DELETE card | Current, secure required |
| Authorized cards list | Owner + masked UID + status | No tap-to-unlock; details only | Current |
| Gas tile | Flame icon and reading label | Open sensor detail, warn readings are uncalibrated | Current |
| Motion tile | Human motion icon, text | Open details and event history | Current |
| **View alerts** | Link/button | Open `/security/alerts`, show type/urgency/date | Current event data |
| **View all activity** | Link with chevron | Open `/security/activity` | Current log API |
| Recent entry | icon, plain event text, timestamp | Optional event detail; no action if not implemented | Current |
| Home / Away / Night / Custom chips | Round icon+label | Only enable when authorized scene/security-mode engine exists | Future |
| Live camera tiles / play | Feed preview + live status | Hide without real camera integration | Future |
| Emergency alert banner | Red soft fill, clear details, button “View alert” | Navigates relevant sensor event; never replaces physical alarms | Current events, needs alert workflow |

**Activity page controls**

| Object / button | Required behavior |
|---|---|
| **All / Doors / Lights / Sensors / System** filter chips | Filter real log entries; current `/api/logs?type=...` only accepts one event type, so some categories require frontend aggregation or a new API. |
| Date filter / picker | Query or locally filter a bounded fetched history; no fake pagination. |
| Search | Search event text/device/name safely with debounced local filtering. |
| Event row | Icon + household-friendly summary + time + details. |
| Clear display | Clear current on-screen list **only**, do not imply history was deleted. |
| Export | Future: local CSV download after consent; not currently implemented. |
| Empty state | “No activity for this period.” Provide “Clear filters.” |

**Alert semantics:** Critical gas alert -> prominent red plain-language warning, haptic (where available)/audible alert only with permission; motion detected -> not necessarily an emergency; RFID denied -> access alert. Never use “All secure” if door/ESP32 state is stale.

### F4. Assistant (`/assistant`) — Shrimaan (fully offline target)

**Reference anatomy:** page title, short privacy guarantee, large green/blue mic focal point, live/last transcript, text response, suggestion chips, optional typed message, language/audio settings entry.

| Object / button | Visual anatomy | Exact behavior | Availability |
|---|---|---|---|
| **Shrimaan** heading | Simple H1, no tech terms | Informational | UI |
| “Works offline” helper | Small line under title | Honest only when speech models are locally present; distinguish from currently working status | Planned |
| Large **Tap to speak** microphone | 112–144px visual button with 56px+ actionable target | First tap requests mic permission; then record single utterance; show capture state | Existing capture, new UX |
| Active **Stop listening** | Same mic switches to square/stop icon + label | Stop mic tracks and streaming immediately | Must implement reliably |
| Pause / mute control | Secondary explicit button | Disable always-listening / wake-word capture | Must implement |
| Voice status | “Ready”, “Listening…”, “Understanding…”, “Working…”, “Speaking…”, “Couldn't hear you” | Follows real speech state machine, never arbitrary animation | Upgrade |
| Transcript card | “You said: …” | Display exact locally transcribed text; editable correction if desired | Existing transcript events |
| Answer card | “Shrimaan: …” | Actual outcome, e.g. “The light is now off” **after confirmation** | TTS + ACK upgrade |
| Replay speech | Speaker icon on answer | Locally synthesize/play last response; accessible alt text | Planned |
| Type a command | Text entry icon or input | Opens keyboard and submits to same parser, no mic needed | Planned |
| Suggested command **Turn off all lights** | Chip with bulb icon | Prefills (or executes after explicit tap) safe light action; no ambiguous action | Current backend command, UX planned |
| Suggested command **Lock the door** | Lock chip | Lock command after clear user action | Current with reliability upgrade |
| Suggested command **Check gas sensor** | Flame chip | Read last confirmed status and calibration disclaimer | Current |
| Suggested command **Check home status** | Home/shield chip | Read supported sensor/door/light statuses | Aggregation planned |
| Suggested phrase **Turn on room light** | Room chip | Prefill instruction; use room aliases mapping | Planned |
| Voice language / voice speed link | Settings icon | Opens `/settings/voice`; stores selected local preferences | Planned |
| Delete transcripts | Overflow / history settings | Remove locally stored transcript history, not activity/security logs | Planned |
| Response loading | Small spinner/message, no blocking overlay | Show only while STT/command/TTS working | Planned |
| Model missing panel | “Voice isn't set up on this home hub” + **Open setup** | Navigate Advanced > Local AI; keep manual control usable | Planned |
| Permission denied panel | Explanation + **Open browser instructions** | No repeated forced permission prompt | UI |

**Language strategy:** Provide interface in English first with Hindi-language speech and basic Hindi UI strings later; use local font fallbacks and allow independent **speech input language: Auto / Hindi / English** and **reply language: Auto / Hindi / English** after model validation. Code-switched Hinglish needs testing. Do not claim universal accent support without testing.

**Voice safety:** wake word should not be the sole authorization for door unlock; no unconfirmed message like “Unlocked” while status is unknown; no silent background mic; offline speech engine must keep raw audio local. Use actual device confirmation to decide spoken success.

### F5. Settings (`/settings`) — calm and structured

**Reference anatomy:** flat white header, stacked 56–76px rows with 36–44px icon circles, left-aligned text label and optional subtitle, right chevron, subtle separators; avoid dense configuration forms on the main Settings page.

| Row / control | Plain label and helper | Exact navigation/behavior | Availability |
|---|---|---|---|
| Appearance | “Themes and colors” | Open four-theme selector and reset theme | Build now |
| Large text / Easy Mode | “Make text and controls larger” | Apply accessible global size independent of theme; persist locally | Build now |
| Voice & Assistant | “Language, microphone, voice” | Settings for local speech modes, enable/disable wake word, TTS voice | Partial existing; expand |
| Notifications | “Choose which alerts you receive” | Browser permission only after interaction; allow local in-app alerts even if denied | Existing subsystem |
| Devices | “Rename or manage devices” | Open device management; permissions for destructive actions | Current CRUD |
| Rooms | “Names and device groups” | Edit user-facing room labels and covers | Planned room model |
| Home Details | “Home name and preferences” | Edit local household display name, not cloud profile | Planned |
| Home Members | “Who can use this home” | Show “Not yet available” or hide until authentication/members built | Future |
| Routines & Automations | “Quick actions for your home” | Hide until scenes/rules engine exists | Future |
| Data & Privacy | “Your home data stays local” | Explain local storage, logs, voice/transcripts; optional delete controls | Build informational view |
| Help & Support | “How to use your home” | Offline bundled help and troubleshooting | Build now |
| Advanced | “Network, ESP32 and local AI” | Device diagnostics, broker, model installed status, backups | Existing data / new UI |
| About | “Version and app information” | Local version, OSS attributions | Build now |

**Advanced subpage** (for technical users only): connectivity for server, MQTT broker, ESP32-A/B (and last heartbeat), local STT/TTS model readiness/storage, sensor calibration notice, database/backup, certificate and local-host warnings. Never show Wi-Fi passwords or private-key text in UI.

**Appearance subpage** includes four theme swatch tiles + “Reset to Serene Emerald” + preview and large-text toggle. The preview should display a safe sample card and never send device commands.

### F6. Global dialogs, banners and buttons

| Common element | Exact rule |
|---|---|
| Primary button | Solid `--primary` with white text; 52px height; on active states color darkens; avoid multiple adjacent primaries. |
| Secondary button | White / muted fill + 1px border, dark readable text. |
| Destructive button | Dark red label or solid red only inside destructive confirmation, never green. |
| Toggle | Label + on/off text + switch. Disable with explanation when device offline or command pending. |
| Chip | Rounded 999px for filters/suggestions; only selected chip uses solid/strong tint and selected semantics. |
| Card chevron | Navigation indicator, visible 20px; whole card keyboard/touch accessible. |
| Toast | “Living Room light turned off” (confirmed), “Couldn't reach light—Try again”, time-limited but available in status history. |
| Progress indicator | Subtle spinner or skeleton; no fake 3-second loading loops. |
| Permission dialog | Describe why mic/notifications needed and offer “Not now”; don't show on every visit. |
| Unlock confirmation | State “Unlock front door for 5 seconds?” + Cancel and Unlock buttons, auth required. |
| Error inline | Explanatory text and a “Try again” action, never just red icon. |
| Loading skeleton | Respect reduced motion, no shimmer needed. |
| “Unavailable” disabled control | Preserve card data with last-known timestamp, explain device offline. |
| Focus ring | Visible 2–3px outline using `--ring`, not box-shadow alone. |
| Keyboard support | Enter/Space for buttons, Esc for dialogs, accessible tab order; no div-as-button without role/key handling. |

## G. App states and response copy

| Situation | User-facing wording | What not to say |
|---|---|---|
| Home running locally, no internet | “Your home is connected. Internet isn't needed.” | “Disconnected” because the WAN is down |
| Browser cannot reach home server | “Can't reach your home hub. Check the local connection.” | “Everything secure” |
| Light board offline | “Lights are unavailable right now.” | “Lights are off” unless confirmed |
| Door lock confirmed | “Front door locked” | “Lock command sent” as the only indication |
| Unlock pending | “Unlocking… Waiting for your door.” | “Door unlocked” |
| Gas sensor reported alert | “Gas sensor reports a possible issue. Check safely.” | “100% gas leak detected” from uncalibrated ADC |
| Motion event | “Movement detected near hallway” | “Intruder detected” |
| Voice no permission | “Microphone is off. Tap to enable speaking.” | “Always listening” |
| Speech model not installed | “Voice assistant needs local setup. You can still use the controls.” | “Offline AI ready” |
| No rooms set up | “Add a room to organize your devices.” | Empty grid / no guidance |
| Feature not supported | “This home doesn't have a camera connected.” | Dummy live camera tile |

## H. Accessibility and inclusion rules

- Text, not icon alone, must describe every critical state. Add Hindi/Hinglish text support, but avoid mixing languages within the same screen unless the resident selected it.
- Minimum touch target **48x48px** (56x56px preferred for older users). No tiny tap-only overflow menu.
- Body ≥16px; Easy Mode ≥18px, titles and controls scale without truncation. No important copy smaller than 14px.
- WCAG **2.2 AA** target: normal text ≥4.5:1; large text and visual UI indicators ≥3:1 where applicable. Validate all four theme palettes, danger, disabled, focused and selected states.
- Avoid color-only signals, autoplay voice responses unless enabled, animations lasting longer than necessary, and flashing alerts.
- Respect `prefers-reduced-motion: reduce`, system zoom, small-screen orientation, screen-reader labels, RTL not assumed for Hindi (Hindi script remains LTR).
- Hindi labels must use legible Devanagari with adequate line height and a font installed locally or system fallback.
- Add explicit voice-off toggle, keyboard text-command alternative, and optional high-contrast mode; normal tap controls must not require the voice module.
- Do not bury door locking under a small menu; destructive settings require confirmations.

## I. Responsive behavior: mobile, tablet, desktop

- **320–479px:** single content column, 2-across compact quick tiles if labels fit or switch to one, full-width big door controls, bottom nav fixed with safe-area inset. No horizontal scroll.
- **480–767px:** 2-column action tile grid, room cards full width, security layout stacked.
- **768–1023px:** side or bottom navigation based on available width, 2-column Home and Security panels, rooms in 2-column cards.
- **1024px+:** left sidebar 220–240px, content max 1280px, Home 2–3-column composition, Rooms 2–3 columns, Security door + sensors + activity distributed in predictable regions. Assistant central column max 740px; Settings max 780px.
- Reflow while preserving user location and focus, not recreating separate desktop app with completely different functionality.
- Portrait-first design references must remain workable on desktop because original repo is a desktop-oriented browser dashboard.

## J. Motion and microinteraction rules

| Interaction | Motion spec |
|---|---|
| Button press | 100–160ms scale 0.98 or subtle background change |
| Page change | 150–220ms opacity/translate 4–8px; no immersive transitions |
| Toggle | 140–180ms thumb movement; confirmed state shown only after response |
| Alert entrance | Soft fade/slide 150–200ms; never shake uncontrollably |
| Assistant mic while listening | Slow breathing ring, 1.4–2s loop; **reduced motion removes pulse** |
| Theme switch | Instant or 120ms color fade; never blank screen |
| Loading | Static label + optional spinner with aria-live; timeout and retry |

**No design-only false states:** avoid active glow implying connection if WebSocket has disconnected; don't animate voice capture when browser mic is off.

## K. Backend-facing UI contracts

Use an adapter layer rather than directly coupling visual cards to backend fields. Suggested normalized device shape (presentation adapter only):

```js
{
  id: 'light-1',                  // Stable backend and MQTT ID
  type: 'light',
  label: 'Living Room Light',     // User-editable display name
  roomId: 'room-1',              // Presentation grouping
  reportedStatus: 'off',         // Last hardware-confirmed state
  commandState: 'idle',          // idle|sending|awaiting|failed
  online: true,                 // Board/device connectivity
  lastSeen: '2026-10-31T...',   // Actual timestamp, if known
  capabilities: ['switch']      // Only observed supported abilities
}
```

- **Rendering:** never interpolate untrusted strings into `innerHTML`; use safe text binding/DOM APIs.
- **Mutations:** use `fetch` API with robust status parsing, timeout/abort and error states.
- **Realtime:** WebSocket update reconciles *reported hardware state* with pending commands. Use a command ID/acknowledgment design if firmware/backend support is added; until then, prefer the next actual device status payload with a timeout.
- **Scenes:** implement and validate before UI shows scene buttons. Need status/result per device and partial failure handling.
- **Rooms:** add room metadata via local config first, or a new persisted table/API with migration; don't modify device IDs.
- **Offline:** all resources, theme CSS, UI icons, Hindi fonts if bundled, and required frontend files must be available without external requests.

## L. Component inventory and coding structure suggestion

```text
public/
├── index.html                  # SPA document + navigation mount point
├── css/
│   ├── tokens.css             # theme 01/03/04/05 declarations
│   ├── base.css               # reset, fonts, sizing, focus, common states
│   ├── components.css         # buttons, cards, dialogs, nav, badges
│   └── pages.css              # Home, Rooms, Security, Assistant, Settings
├── js/
│   ├── app.js                 # bootstrap and routing
│   ├── state.js               # normalized device and UI state (new)
│   ├── theme.js               # theme persistence and switching (new)
│   ├── accessibility.js       # large text/reduced motion (new)
│   ├── components.js          # safe DOM helper functions (new)
│   ├── rooms.js               # grouping/display labels (new)
│   ├── security.js            # access, status, alerts (new)
│   ├── settings.js            # preferences (new)
│   ├── devices.js             # existing device interactions: adapt
│   ├── logs.js                # existing history/RFID: adapt
│   ├── websocket.js           # existing: preserve protocol
│   ├── voice.js               # existing: adapt speech session UX
│   ├── audio-processor.js     # existing: refine audio pipeline as needed
│   └── notifications.js       # existing: maintain permission safety
└── assets/
    ├── icons/                # self-created bundled SVGs
    ├── rooms/                # optional locally licensed photos
    └── fonts/                # optional locally licensed fonts; no CDN
```

This is a **proposed target layout**, not the current one. Developers may keep CSS/JS consolidated if it improves simplicity, provided behavior, tokens and accessibility are preserved.

## M. Theme-specific implementation differences (not different applications)

| Design property | 01 Warm Organic | 03 Universal Comfort | 04 Friendly Pastel | 05 Serene Emerald |
|---|---|---|---|---|
| Mood | Warm household | Accessible/familiar | Cheerful & modern | Calm/premium home |
| Color emphasis | Evergreen + wheat | Green safety + blue mic | Blue primary + restrained room pastels | Emerald + neutral surfaces |
| Room cards | Photo-led cozy | Simple large list | Distinct pastel category block | Clean photo + device summary |
| Home hero | Warm photo/scene | Safety and status first | Color-block actions | Optional comfort photo + quiet control grid |
| Assistant mic | Green | Larger blue/high-contrast | Blue, with illustration optional | Large green, no illustration necessary |
| Density | Medium-low | **Lowest** | Medium | Low |
| Button sizes | Standard | Large by default | Standard | Standard |
| A11y | AA target | AA + large font baseline | AA target | AA target |

### Theme 03 is not the only accessible theme

All themes must be accessible, with the *user choice* of large text and reduced motion. Theme 03 adds an especially familiar, high-clarity treatment, but the default theme 05 must still be comfortable for older adults.

## N. Handoff checklist — visual acceptance

- [ ] Matches Theme 05 reference **in spirit**, not pixel clone; no neon console.
- [ ] Theme 01/03/04 option previews and switching work with no reload and no internet.
- [ ] All five primary pages have complete empty/loading/error/offline states.
- [ ] Real seven seeded devices are rendered with correct dynamic state; no unsupported camera/AC/fan tile appears live.
- [ ] Every prominent button has defined action and response; no dead tap targets.
- [ ] Front door unlock is secured, confirmed, and explicit; no fake success.
- [ ] Voice controls have visible permission/capture status, stop action, and text alternative.
- [ ] Theme defaults to `05` on new browser install.
- [ ] No CDN font/image/icon/API requests.
- [ ] Keyboard navigation, readable Hindi, text zoom, ARIA, focus, AA contrast, reduced motion validated.
- [ ] Mobile 320/375/390/430px and desktop 1024/1440px layouts work without clipping.
- [ ] Original mockup names, made-up devices, hardcoded family names, and marketing decoration are not shipped as real state.


---

## O. Design interpretation protocol for GPT-6.1 High (Sol)

**The images are concept mood boards, not an exact Figma project.** Their composition includes five phones in a marketing spread. Do not implement the full promotional poster as the app or use those image files as full-screen UI backgrounds. Instead build live HTML/CSS/SVG components in a responsive product interface. All references should be recognizable in visual *hierarchy, atmosphere, palette, typography and geometry*, not by pixel copying or fake content.

**Visual hierarchy rule (at any breakpoint):** Home state -> room/location -> device and current state -> explicit primary action -> supporting detail. One view must not contain more than a few competing primary actions. Prioritize legibility over visually impressive gloss; no neon halos, glass panels, or unnecessary gradients.

**Shared interaction rule:** UI content and available capabilities are consistent across themes. Themes change presentation only, never which device is present or what permissions apply.

## P. Pixel-oriented build tokens and responsive layout specification

### P1. Space, radius, elevation, borders, motion

| Token | Value | Intended use |
|---|---|---|
| `--space-1` | 4px | Icon/text micro-gap |
| `--space-2` | 8px | Compact item gap |
| `--space-3` | 12px | Internal chips and rows |
| `--space-4` | 16px | Standard mobile gutter/card padding |
| `--space-5` | 20px | Larger padding |
| `--space-6` | 24px | Section spacing |
| `--space-8` | 32px | Major sections |
| `--space-10` | 40px | Desktop breathing room |
| `--radius-xs` | 10px | Small badges/input tokens |
| `--radius-sm` | 14px | Small action/chip tiles |
| `--radius-md` | 18px | Buttons, settings rows |
| `--radius-lg` | 22px | Cards, device tiles |
| `--radius-xl` | 28px | Hero/room summary cards |
| `--radius-pill` | 999px | Pills, toggles |
| `--shadow-card` | `0 5px 22px rgba(24,39,30,.045)` | Optional elevation; never heavy black |
| `--stroke-weak` | 1px solid theme `--border` | Card edge and separators |
| `--duration-fast` | 120ms | Immediate pressed feedback |
| `--duration-base` | 180ms | Card hover / menu visibility |
| `--duration-panel` | 220ms | Dialog/sheet transition |
| `--ease` | `cubic-bezier(.2,.8,.2,1)` | Subtle UI movement |

Defaults are a proposed precise implementation grid. Scale using rem/custom tokens so Large Text works; do not use fixed-height text containers that clip translations.

### P2. Typography system — readable on normal and older-user screens

| Role | Mobile size / weight / line height | Desktop | Notes |
|---|---|---|---|
| Main page headline | 28px / 700 / 1.18 | 32px | “Home”, “Rooms”, “Security”, etc. |
| Greeting | 25px / 700 / 1.2 | 32px | Avoid overly long family surname |
| Section title | 19px / 650 / 1.25 | 21px | “Quick controls”, “Your rooms” |
| Card title | 17px / 650 / 1.3 | 18px | “Front Door” |
| Body | 16px / 400 / 1.5 | 16px | Prefer one or two concise lines |
| Button | 16px / 600 / 1.2 | 16px | Verb first: “Lock door”, “Turn on” |
| Secondary/meta | 14px / 400 / 1.45 | 14px | Safe to reduce only for noncritical metadata |
| Status/critical alert | 16px / 650 / 1.35 | 17px | Never tiny for important alerts |
| Easy Mode | Base 18–20px; title 22–36px | Fluid | At least 56px minimum touch target |

Prefer locally bundled `Inter` Latin and a suitable locally bundled Devanagari companion (e.g. Noto Sans Devanagari if licensing and files permit), else system UI fallbacks. Use meaningful font-weight hierarchy, normal letter spacing for body and Hindi. Don't depend on foreign CDN fonts. Avoid text placed over complex photographs unless a high-opacity backdrop guarantees contrast.

### P3. Screen grid rules

```text
MOBILE <= 599px              TABLET 600–1023px              DESKTOP >= 1024px
┌────────────────────────┐    ┌────────────────────────┐      ┌──────┬────────────────────────┐
│ Header                 │    │ Header                 │      │ Side │ Header                 │
│ Greeting / status      │    │ Greeting / status      │      │ nav  │ Greeting / status      │
│ ┌────────────────────┐ │    │ ┌──────────┬─────────┐ │      │      │ ┌──────────┬─────────┐ │
│ │ Status summary     │ │    │ │ Main     │ Summary │ │      │      │ │ Main     │ Summary │ │
│ └────────────────────┘ │    │ └──────────┴─────────┘ │      │      │ └──────────┴─────────┘ │
│ ┌─────────┬──────────┐ │    │ ┌──────────┬─────────┐ │      │      │ ┌────┬────┬────┬────┐ │
│ │ Control │ Control  │ │    │ │ Controls │ Controls│ │      │      │ │ A  │ B  │ C  │ D  │ │
│ └─────────┴──────────┘ │    │ └──────────┴─────────┘ │      │      │ └────┴────┴────┴────┘ │
│ Additional content     │    │ Supporting content     │      │      │ Supporting content     │
│────────────────────────│    │────────────────────────│      └──────┴────────────────────────┘
│ Home Rooms Sec AI Set  │    │ Home Rooms Sec AI Set  │
└────────────────────────┘    └────────────────────────┘
```

- Mobile gutter: 16px, layout max width 100%, no horizontal scrolling on 320px. 2-column controls only where label remains fully readable; otherwise one column.
- Tablet gutters: 24px, main content max ~920px; bottom nav may remain when useful.
- Desktop: side rail width about 228px; content max ~1180px centered; navigation exactly five primary items; no giant full-width switch and no empty 3D panels.
- Header mobile height auto based on content; bottom nav minimum 64px plus safe-area padding, static or sticky without covering cards.
- Assistant primary mic can be 112–144px circle, but its control must remain discoverable with visible text below. The microphone is the visual hero **only on Assistant**, not on every page.
- Images are optional decoration, not critical data; implement thoughtful icon-and-color room placeholders if no approved local photographs exist.

## Q. Theme architecture: complete role tokens, not scattered per-page colors

The existing C section lists the core HEX values. Use them consistently through roles. The following CSS is a **reference architecture** for the implementing agent; adjust exact syntax to project conventions, but keep identical semantic names across themes.

```css
:root, :root[data-theme="05"] {
  color-scheme: light;
  --bg:#F8F9F7; --surface:#FFFFFF; --surface-muted:#F0F3EF;
  --text:#19231F; --text-subtle:#58655F; --primary:#166F46;
  --primary-pressed:#105537; --primary-soft:#E5F3E9;
  --accent-blue:#3469B8; --accent-warm:#A86A1A;
  --danger:#B7353D; --danger-soft:#FAE9E8;
  --border:#E5EAE5; --ring:#166F46;
  --card-radius:22px; --card-shadow:0 5px 22px rgba(24,39,30,.045);
}
:root[data-theme="01"] {
  --bg:#FAF8F2; --surface:#FFFFFF; --surface-muted:#F4F1EA;
  --text:#18251F; --text-subtle:#52615A; --primary:#1D7049;
  --primary-pressed:#155738; --primary-soft:#E3F2E8;
  --accent-blue:#2869BD; --accent-warm:#B36A19;
  --danger:#B83E45; --danger-soft:#FBE9E9;
  --border:#E4E8E2; --ring:#176D45;
  --card-radius:24px; --card-shadow:0 6px 22px rgba(70,57,36,.06);
}
:root[data-theme="03"] {
  --bg:#F8F9F6; --surface:#FFFFFF; --surface-muted:#EEF2ED;
  --text:#182333; --text-subtle:#4F5B65; --primary:#187A48;
  --primary-pressed:#115C35; --primary-soft:#E2F3E8;
  --accent-blue:#246BC4; --accent-warm:#A96111;
  --danger:#BD333B; --danger-soft:#FBE6E7;
  --border:#E0E6E0; --ring:#165E3B;
  --card-radius:20px; --card-shadow:0 3px 16px rgba(22,34,29,.035);
}
:root[data-theme="04"] {
  --bg:#F7F9FE; --surface:#FFFFFF; --surface-muted:#EEF3FB;
  --text:#17243D; --text-subtle:#55667E; --primary:#2565C7;
  --primary-pressed:#1A4FA4; --primary-soft:#E5EEFF;
  --accent-blue:#2D74E6; --accent-warm:#AA5C13;
  --danger:#B93746; --danger-soft:#FCE8ED;
  --border:#E1E8F2; --ring:#1F57B4;
  --card-radius:24px; --card-shadow:0 5px 18px rgba(24,59,118,.045);
}
```

`--primary` styles the brand/selected actions only; critical severity stays red, all themes. Add `--on-primary:#FFFFFF` for legible button text, and use `:focus-visible` with `--ring`; **check WCAG contrast**, including text against pastel tinted surfaces. Darken text or fill where contrast fails. UI text must never rely on theme's primary as the only state signal.

**Loading preference without flash:** read stored theme synchronously before visible app paint (a tiny local inline bootstrap can set `document.documentElement.dataset.theme` from an allowlisted value). Then hydrate UI. The storage key must remain consistent (`homeauto.theme.v1`) and 05 is the absolute fallback. Support unavailable/private-mode storage with a safe 05 default.

**Important:** Theme 03 has a comfortable slightly larger default typography/controls, but users must be able to apply Large Text separately in ANY theme. Theme 04's pastel backgrounds are for room categorization, **not** red = all security, green = all safe; maintain clear words/icons.

## R. Screen-by-screen interaction inventory (every prominent click target)

The tables in F define components. This matrix establishes exact **source / user gesture / state transition / target / failure response** so a coding agent cannot leave dead elements. `API` = existing, `UI` = local presentation, `NEW` = requires implementation, `HIDE` = currently unavailable. Implement click feedback via semantic `<button>` and `<a>`.

| Screen | Target and user action | State transition / data operation | Missing/error behavior | Stage |
|---|---|---|---|---|
| Global | Tap house logo | Navigate to `/`; preserve theme/preferences | In-app navigation always available | UI |
| Global | Tap Home/Rooms/Security/Assistant/Settings nav | Navigate to route, announce selected tab, preserve history | Always accessible; no nested dead routes | UI |
| Global | Tap Alerts bell | Open `/security/alerts`; unread count only if accurate | Show “No new alerts” if empty | NEW |
| Global | Tap back | Return to previous valid route; fallback parent | Never dead-end or leave app unexpectedly | UI |
| Home | Tap safety banner | Open `/security` | Offline -> explanatory warning | UI |
| Home | Tap light summary | Open `/rooms?type=light` or equivalent | No lights -> empty/filter reset | UI |
| Home | Tap front-door card | Open `/security/door` | Unknown -> Unavailable detail | UI |
| Home | Tap gas/motion status | Open matching `/devices/:id` | No sensor -> not-found explanation | UI |
| Home | Tap Shrimaan | Open `/assistant`, mic remains off until user tap | Missing model -> typed alternative | UI |
| Home | Tap All lights off | Validate current supported lights, issue off requests safely; track each ACK | Partial errors; no fake single success | API + NEW ACK |
| Home | Tap Lock door | Ensure permissions, send lock request and await status | Blocked/offline -> message and retry | API + security |
| Home | Tap Check status | Open Security with reliable current/unknown summary | Display what cannot be verified | UI |
| Home | Tap See all | Open Rooms | Always available | UI |
| Rooms | Tap a room card | Open `/rooms/:roomId` | If room no longer exists -> return | UI |
| Rooms | Tap All/Lights/Sensors/Door filter | Filter based on real supported types/locations, selected aria state | Empty -> “No matching devices” | UI |
| Rooms | Tap `+ Add room` | Open form only if persistence is implemented | Otherwise HIDE; no decorative + | PLANNED |
| Room | Tap supported light switch | Accessible On/Off -> request pending -> confirmed | Disabled if offline; timeout copy | API + NEW ACK |
| Room | Tap a device row | Open `/devices/:id` | Unknown -> help link | UI |
| Device | Tap Rename | Show validated form, update device name via PUT | Error preserves old label | API |
| Device | Tap Remove | Confirmation dialog; protected DELETE | Cancel means no mutation | API + security |
| Device | Tap sensor history | Open filtered Activity | No events -> truthful empty | API |
| Security | Tap Lock | Lock pending until confirmed | Timeout does not state locked | API + NEW ACK |
| Security | Tap Unlock | Owner/resident authorization gate + explicit confirmation | Unauthorized/offline -> refuse | API + security |
| Security | Tap Cancel on unlock modal | Close without any command | Always safe | UI |
| Security | Tap confirm Unlock | Dispatch exactly `unlock` for authorized door; await status | Report uncertain if no ACK | API + security |
| Security | Tap Access cards | Open `/security/access-cards` | Empty -> “No cards added” | UI/API |
| Cards | Tap Add | Open UID/owner form after owner authorization | Not authorized -> explanation | UI/API/security |
| Cards | Tap Save | Validate inputs, POST card, refetch actual list | Conflict/failure -> inline message | API/security |
| Cards | Tap card options | Open menu for card details or revoke | No automatic unlock | UI |
| Cards | Tap Revoke | Ask for confirmation, DELETE UID, refetch and log | Error -> stay in list with message | API/security |
| Security | Tap Recent Activity/View all | Open `/security/activity` | Empty -> “No events yet” | API/UI |
| Activity | Tap date/category filter | Filter fetched events; remain within truthful supported history | Empty state + reset filters | UI/NEW filters |
| Activity | Tap Clear display | Clears transient presentation ONLY; do not delete stored audit log | Confirm? no destructive impact | UI |
| Activity | Tap event row | Show event detail if supported; otherwise row is not styled clickable | No fictional event-detail route | UI |
| Assistant | Tap large mic first time | Request mic permission after gesture; open recording if granted | Denied -> typed command/help | UI + speech |
| Assistant | Tap active mic/Stop | Stop recording, close/stop stream, show Ready | Must also stop when navigating away | UI + speech |
| Assistant | Tap Try again | Reopen recording after last recognition failure | Keep controls available | UI |
| Assistant | Tap type command | Focus input; use constrained same intent/safety parser | Invalid -> clarification, no MQTT | NEW |
| Assistant | Tap Send | Validate typed request; resolve intent; send approved action | Pending/status errors visible | NEW |
| Assistant | Tap suggested phrase chip | Prefer prefilling text, then explicit Send; no surprise locks | Planned actions omitted | UI |
| Assistant | Tap Replay | Generate/play last local answer only if TTS ready | Hidden/disabled if voice missing | NEW |
| Assistant | Tap language/settings | Open `/settings/voice` | Explain unsupported voice option | UI |
| Settings | Tap Appearance | Open `/settings/appearance` | Always available | UI |
| Appearance | Tap a theme preview | Apply immediately to all visible components, store setting | Invalid theme never applied | UI |
| Appearance | Tap Reset | Return to 05; keep other accessibility preferences | Theme preview updates | UI |
| Settings | Tap Large Text | Toggle large text across all routes/themes | Storage fails -> current-session fallback | UI |
| Settings | Tap Reduce Motion | Remove non-essential animation without hiding statuses | Honors OS setting as default | UI |
| Settings | Tap Notifications | Permission in response to user gesture | Denied -> in-app alerts remain | UI |
| Settings | Tap Voice options | Choose validated installed language/voice, toggle opt-in wake word | Missing model -> setup explanation | NEW |
| Settings | Tap Devices | Device management with authorized actions | Unauthorized -> read-only content | API/UI |
| Settings | Tap Home Details | Edit nonsecurity local display name only | No cloud identity assumption | NEW/local UI |
| Settings | Tap Data & Privacy | Open local data explanation, microphone and logs policy | Do not pretend to erase DB audit history | UI |
| Settings | Tap Help | Open bundled offline help topics | Available with WAN off | UI |
| Settings | Tap Advanced | Open MQTT/ESP32/AI diagnostics as read-only for most users | Show technical troubleshooting, no secrets | UI |
| Settings | Tap unsupported Family/Scene/Camera item | It must be HIDDEN until implemented | Never dead clickable UI | HIDE |

### R1. Preferred failure language

| Situation | Exact preferred copy | CTA |
|---|---|---|
| Home hub can't be reached | “We can't connect to your home right now.” | `Try again` |
| One ESP offline | “Living room lights are unavailable.” | `View details` |
| Pending light | “Turning on…” | Optionally `Cancel` only if cancel is supported |
| No light confirmation | “We couldn't confirm the light changed.” | `Check again` |
| Door offline | “Door status unavailable. Try again when it reconnects.” | `Retry` |
| Gas alarm from uncalibrated sensor | “Gas sensor detected a possible issue. Check the area and your dedicated alarm.” | `View alert` |
| Mic permission denied | “Microphone access is off. You can still type a request.” | `Type a request` |
| Model missing | “Shrimaan needs local voice setup. Home controls still work.” | `Open setup` |
| Unclear command | “Which light do you mean?” | Room selection or typed correction |
| No security logs | “Nothing to show for this period.” | `Clear filters` |

## S. Component DOM/accessibility contract and icon meanings

| Component | Semantic element / behavior | Visible state and assistive label |
|---|---|---|
| Home navigation item | `<a href>` with `aria-current="page"` on active | Label, icon, selected indicator |
| Light action | `<button>` or `<input type="checkbox" role="switch">` with status text | “Living room light, on, turn off”; disabled with reason when unavailable |
| Door unlock | `<button>` opening modal; no direct fire before confirmation | “Unlock front door” |
| Confirmation dialog | `role="dialog"`, `aria-modal`, labelled heading; focus trap/restore | “Unlock front door for approximately 5 seconds?” |
| Room filter | `<button aria-pressed="true/false">` | “Lights, selected” |
| Alert banner | Section with clear text, `role="alert"` only for genuinely new urgent items | Critical copy readable without color cues |
| Status | Text plus optional icon, never colored dot alone | “Locked”, “Unavailable”, “Pending” |
| Toast | Polite `aria-live` for success, assertive only for critical errors | Accessible outcome after action |
| Microphone | Button `aria-pressed`/explicit state, visible Start/Stop label | “Start speaking” / “Stop listening” |
| Theme card | Radio button inside labelled preview/card or `role="radio"` group | Theme name, selected state, sample colors |
| Settings row | Link/button; entire 56px+ row hit area | Label + subtitle + chevron |
| RFID UID | Monospace, selectable text within authorized management view | Mask/last bytes in overview; complete value only where needed |

**Icons (consistent 24px optical artboard):** filled simple house/logo (Home), doorway/room (Rooms), shield + lock (Security), centered microphone (Assistant), gear (Settings), bulb (Lights), lock/unlock (Door), simple flame/exclamation (Gas), walking/motion lines (Motion), bell (Alerts), chevron (navigate), arrow-left (Back), sun/moon (appearance/scene if supported), info (help). Use **single consistent stroke family**, no arbitrary emoji as primary controls, and no technical circuit-board symbols on consumer-facing cards.

**Logo specification:** original, not copied from Google/Mi. Build a simple filled home outline, about 24px icon in nav, 26–32px in header; rounded roof corners, one doorway in negative space, solid theme-primary fill. Pair with `HomeAuto` in semibold; allow standalone glyph at compact widths. This is a reproducible design rule, **not** a request for a copyrighted Google Home/Mi Home logo.

**Photography policy:** image boards show room photos and promotional illustrated avatars. They are visual references only. Prefer optional locally bundled, licensed, realistic home/room photographs with accessible alt text; if no such media exists, use the original icon + soft tinted gradient-free surface. Images are never controls without a label. Do **not** bundle a mockup board as an uneditable rendered application background.

## T. Meaningful differences between the four accepted themes

| Design attribute | 01 Warm Organic | 03 Universal Comfort | 04 Friendly Pastel | 05 Serene Emerald (default) |
|---|---|---|---|---|
| Emotional impression | Comfortable family warmth | Confidence and clarity | Welcoming and gentle | Quiet premium simplicity |
| Primary | Pine/forest green | Clear, slightly bolder green | Modern muted blue | Refined emerald |
| Secondary surfaces | Cream and parchment | Clear white, deliberate borders | Powder blue, room-specific pastels | Warm off-white, calm whites |
| Card geometry | 24px with soft shadow | 20px with very clear outlines | 24px, soft pastel category blocks | 22px, restrained spacing |
| Font treatment | Friendly, moderate weight | Larger label/body baseline | Spacious header and icon labels | Balanced modern body hierarchy |
| Voice focal point | Green round button | Blue/green, maximum visual clarity | Blue primary orb, no 3D effects | Emerald primary orb |
| Room grouping | Warm optional photography | Clear list with strong names | Subtle room tint strips/cards | Simple room rows and selective photos |
| Security priority | Strong plain safety summary | Most prominent door state | Soft banner except urgent red alerts | One prominent verified status banner |
| Icon containers | Cream/green tint | Solid strong contrast | Soft blue/peach/lilac (decorative) | Light emerald/neutral |
| Primary expected user | Warm, family-oriented preference | Senior/new/low-tech preference | Friendly colorful preference | Broad default for all ages |

A theme is **not** a new set of routes or separate file forks. It is a stable CSS design-token skin with small presentation nuances. If a user swaps theme during a pending device command, the pending command and its output must be unchanged.

## U. Per-theme per-screen visual check script

Before declaring visual completeness, answer the following for each of the four reference images:

**Home:** Is there a visible greeting, an unambiguous secure/unknown summary, actual lights/door/sensor quick access, and no crowded technical telemetry? Do two medium-sized control tiles fit on a 390px screen without truncation? Is the Shrimaan entry recognizable without automatically listening?

**Rooms:** Does the resident identify room names before device IDs? Can a room be opened from the entire card? Does every real device remain reachable? Are filters understandable as controls rather than decorative chips?

**Security:** Is the door status unmistakable without reading a tooltip? Is Unlock visually distinguished from Lock and separately confirmed? Are owner-only access cards and historical events findable? Does unknown/offline safety never use a green “All secure” banner?

**Assistant:** Is there one clear tap-to-speak action and a visible Stop? Are real transcript/response messages distinct? Does it show Listening/Processing/Speaking without neon sci-fi effects? Can a user type instead? Is Hindi text readable in local fonts?

**Settings:** Can anyone find “Appearance”, “Text size”, “Notifications”, “Voice & Assistant”, “Help”, and “Advanced”? Are currently unsupported settings absent? Do theme previews apply instantly and persist with browser reload?

## V. Multi-language and ageing-friendly behavior in real daily usage

- **Terminology:** prefer “Lights” rather than “Relay output”; “Front door” not “Door-1”; “Something needs attention” not “sensor_data.alert=true”. Technical ID only on Advanced/Device details.
- **Labels remain on icons:** Home/Rooms/Security/Assistant/Settings are always text-labelled on mobile; users shouldn't need to memorize symbols.
- **Action affordance:** any direct action explicitly says “Turn on”, “Turn off”, “Lock”, “Unlock”; do not rely on toggle color alone. Separate read-only sensor tiles from clickable controls.
- **Confirmation:** never add friction to routine light toggles, but protect door unlock, card revoke and deletion. Use simple “Cancel” and explicit descriptive confirm.
- **Errors:** do not auto-dismiss the only explanation of an important failure; preserve an accessible inline status/alert history.
- **Accessibility:** minimum WCAG 2.2 AA for mainstream text/controls where applicable; respect large text, high contrast and reduced motion, with usable labels at 200% browser zoom. Color is an addition to text, never a substitute.
- **Language:** Hindi speech is a separate **voice capability** from translating the entire UI. UI may remain English initially. Avoid mixing English and Devanagari words in confusing ways; if Hindi UI arrives later, budget for longer labels and RTL is not assumed for Hindi.
- **Cognitive load:** do not ask users to understand LAN/WAN, MQTT, port, model quantization, RFID UID format unless they intentionally open technical setup. The status “Internet not needed” is not a substitute for actual local hub connectivity health.

## W. Final UI deliverable checklist for GPT-6.1 High

- [ ] Five real screens + secondary routes; no marketing-poster rendering.
- [ ] All four themes (05 default), previews and persistence, per-page application.
- [ ] Every displayed button/link/chip described in the click matrix has a genuine result, or is hidden.
- [ ] Existing seven seeded device IDs remain intact; room labels editable rather than assumed.
- [ ] All physical status changes depend on controller confirmation.
- [ ] Voice UI is tap-initiated, stoppable, readable and works in error/denied cases.
- [ ] Browser runtime has no external font/photo/voice API dependency.
- [ ] Touch targets, keyboard focus, screen reader semantics, 200% zoom, reduced-motion tested.
- [ ] Security uses distinct red alerts and state honesty in every theme.
- [ ] Current photos/assets in `reference-images` are not mistaken for production thumbnails/screenshots.
- [ ] Mobile + tablet + desktop layout screenshots obtained or explicit visual verification limitation stated.
