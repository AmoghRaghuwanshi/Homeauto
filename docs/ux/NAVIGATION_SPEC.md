# Navigation behavior

Implemented 2026-11-05 in `public/js/navigation.js`, with shared presentation in
`main.js` and `app.css`. No framework or backend route change was required.

## Routes and ownership

Five root destinations remain Home `/`, Rooms `/rooms`, Security `/security`,
Shrimaan `/assistant` and Settings `/settings`. The sidebar and mobile bottom
navigation share that registry. Device details belong to Rooms except the door,
which belongs to Security. A device's default parent is its actual room.

| Screen family | Parent without valid in-app history |
|---|---|
| Room detail | Rooms |
| Light/gas/motion detail | Device's actual room |
| Door detail, access cards, Activity, Alerts | Security |
| Alert detail | Alerts |
| Settings subpages | Settings |
| Local AI | Advanced |
| Unsupported URL | Home |

`routeInfo` is the single route registry. Unknown children, including
`/assistant/extra` and `/settings/advanced/extra`, display a not-found screen;
they no longer silently render a valid parent. Express's existing shell fallback
continues to support direct URLs and refreshes. Document titles identify the
current page and HomeAuto. Existing hardware IDs and endpoint schemas are intact.

## Home and Back

The actual home name in the top bar is a native anchor to `/`, labelled **My
home** for assistive technology. It always works, including from Settings,
Activity, Assistant, RFID and device details. The sidebar's decorative group
heading is now **Controls**, so it cannot be mistaken for another My Home action.
The brand and primary Home destination also use the same router.

Nested screens receive a shared top-left Back control, page title and contextual
actions. Back returns to the previous valid HomeAuto entry when one exists;
otherwise it replaces the current entry with the logical parent above. It never
sends a direct-entry visitor to an unrelated external history entry. The mobile
button shows a directional icon; its accessible name includes the destination.
Desktop also shows that destination label. Long titles and actions wrap without
overlap. Touch targets remain at least 48px.

Direct-entry root sections have no meaningless back control. A root section
reached from another HomeAuto page may show contextual Back, allowing Home →
Security → Back → Home. Home itself has no Back button. Browser Back and Forward
continue to traverse the native browser stack.

## History, restoration and transient state

Passive focus/scroll changes update the current entry in memory and coalesce History API writes over300ms. Unchanged entries do not produce a replaceState call. Explicit navigation, query changes and page hide flush pending state; popstate cancels a pending write before reading the restored entry. This keeps frequent focus/scroll events within Safari's history-write budget while retaining native Back/Forward and list restoration. Public cloud `/login` and `/signup` use normal internal links and direct-route fallback; signed-in visits to either replace the route with Home. Passwords never enter history state.

`Navigation` owns `pushState`, `replaceState` and `popstate`. Selecting the current
destination does not add a duplicate history entry. Native links retain their
hrefs, modifier-key behavior, new-tab behavior and fragment links.

Each owned entry contains a version, key, path, up to 32 prior logical entries,
scroll coordinates and a stable focus descriptor. Native Back/Forward restores
scroll and the initiating control; new navigation focuses the page heading
immediately. Direct detail reloads preserve their supported URL and parent
fallback. No custom edge-swipe gesture or browser Back interception was added.

Room type/search and Activity category/date/search/device filters are in URL
query parameters. Filter edits replace the current entry, rather than adding an
entry for each keystroke. Room search debounces rendering for 150ms. Navigating
away cancels its timer. Activity retains fetched cursor pages in memory while
returning within the session; Refresh explicitly fetches a new first page. That
cache is cleared on logout and is never a source of device state.

Navigation closes dialogs, ends capture and stops pending/playing audio. Dialogs
are not restored after refresh. Dialog focus returns to the opener, even if a
live snapshot replaced it. Submissions disable conflicting Cancel/Escape while
the request is being sent. No password, unlock challenge, UID form draft or
hardware state enters history or localStorage.

Forward/back transitions move content only 8px over 150ms and do not delay focus
or controls. OS or app reduced-motion settings disable them. Mobile navigation
and content padding account for safe-area insets; no custom native gestures are
claimed. Real notched-phone validation remains pending.

Design references: [Apple navigation and search](https://developer.apple.com/design/human-interface-guidelines/navigation-and-search)
and [tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars).
These informed predictable hierarchy and persistent destinations; no branded
assets or layouts were copied.

## Gateway setup and Demo home, 2026-11-08

`/settings/gateway` is a Settings detail screen with parent Settings and the existing logical/browser back behavior. My home always returns to `/`. Empty cloud homes offer gateway setup first and Demo home alongside; they do not show an offline fault for an unenrolled gateway. Awaiting first report, offline and revoked gateways are distinct. Settings → Home gateway remains available to owners.

Demo entry/exit replaces the current route with Home, disconnects the previous transport, clears pending commands and transient conversations, and reconciles a new snapshot. The demo marker restores only for the same authenticated user and household. Auth endpoints always use the real server. Other demo calls stay inside the simulator; no fallback to hardware is permitted. Nested routes, themes and the existing navigation model work in both homes.
