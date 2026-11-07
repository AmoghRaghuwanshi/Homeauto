# HomeAuto — canonical theme tokens and persistence

> **Active implementation revision 4 — 2026-11-05.** The exact four-theme matrix is implemented in public/css/tokens.css; browser persistence/bootstrap in public/js/preferences.js and theme-bootstrap.js. Theme03 uses the blue microphone and larger baseline; Theme04 has pastel room covers. Decorative room numbers were made high-contrast after axe findings. Manual assistive-technology and household review remain pending. Earlier “current/planned/no implementation” statements below refer to the preserved revision-3 audit/specification, not the active runtime. The full revision-3 originals are in history/revision-3.


Revision 3, 2026-11-05, **IMPLEMENTED TOKEN SPECIFICATION**. This is the definitive token registry; it completes the palettes already approved in [design.md](design.md) and resolves its earlier size/breakpoint examples. Same components, routes, data, permissions and command behavior in all four themes. Preserve reference files and IDs: **05 Serene Emerald default**, 01 Warm Organic, 03 Universal Comfort, 04 Friendly Pastel. Theme02 is excluded.

## 1. Theme registration and complete color matrix

Use `:root, :root[data-theme="05"]` as default and root selectors for the three alternatives, `color-scheme:light`. Every theme must assign each row below, including identical values. Values are design choices informed by visually inspected concept boards, not sampled measurements. No dark theme is implied. Components never embed random color values; new color requires a semantic registry entry.

| Token | 05 Serene Emerald | 01 Warm Organic | 03 Universal Comfort | 04 Friendly Pastel |
|---|---|---|---|---|
| `--bg` | #F8F9F7 | #FAF8F2 | #F8F9F6 | #F7F9FE |
| `--surface` | #FFFFFF | #FFFFFF | #FFFFFF | #FFFFFF |
| `--surface-elevated` | #FFFFFF | #FFFFFF | #FFFFFF | #FFFFFF |
| `--surface-muted` | #F0F3EF | #F4F1EA | #EEF2ED | #EEF3FB |
| `--surface-hover` | #EAF0EB | #EEECE3 | #E6EEE7 | #E5ECF9 |
| `--surface-disabled` | #E9EDE9 | #EDEBE3 | #E7ECE7 | #E8EDF6 |
| `--text` | #19231F | #18251F | #182333 | #17243D |
| `--text-subtle` | #58655F | #52615A | #4F5B65 | #55667E |
| `--text-disabled` | #5B665F | #62665B | #56616A | #5B677A |
| `--on-primary` | #FFFFFF | #FFFFFF | #FFFFFF | #FFFFFF |
| `--primary` | #166F46 | #1D7049 | #187A48 | #2565C7 |
| `--primary-hover` | #125E3C | #195F3E | #14663C | #2058B0 |
| `--primary-pressed` | #105537 | #155738 | #115C35 | #1A4FA4 |
| `--primary-soft` | #E5F3E9 | #E3F2E8 | #E2F3E8 | #E5EEFF |
| `--secondary` | #3469B8 | #2869BD | #246BC4 | #6251A3 |
| `--secondary-soft` | #E8F0FF | #E8F0FF | #E8F0FF | #F0E9FF |
| `--accent-blue` | #3469B8 | #2869BD | #246BC4 | #2D74E6 |
| `--accent-warm` | #A86A1A | #B36A19 | #A96111 | #AA5C13 |
| `--success` | #166F46 | #1D7049 | #187A48 | #176C43 |
| `--success-soft` | #E5F3E9 | #E3F2E8 | #E2F3E8 | #E2F6EC |
| `--warning` | #805000 | #805000 | #805000 | #805000 |
| `--warning-soft` | #FFF2D8 | #FFF2D8 | #FFF2D8 | #FFF2D8 |
| `--danger` | #B7353D | #B83E45 | #BD333B | #B93746 |
| `--danger-hover` | #9C2931 | #9C3038 | #A12931 | #9D2C3A |
| `--danger-soft` | #FAE9E8 | #FBE9E9 | #FBE6E7 | #FCE8ED |
| `--info` | #225A9E | #225A9E | #225A9E | #225A9E |
| `--info-soft` | #E8F0FF | #E8F0FF | #E8F0FF | #E8F0FF |
| `--border` | #E5EAE5 | #E4E8E2 | #E0E6E0 | #E1E8F2 |
| `--border-strong` | #718078 | #738076 | #6C7B73 | #738197 |
| `--ring` | #166F46 | #176D45 | #165E3B | #1F57B4 |
| `--overlay` | rgba(16,24,20,.48) | rgba(16,24,20,.48) | rgba(16,24,20,.48) | rgba(16,24,20,.48) |
| `--mic` | #166F46 | #1D7049 | #246BC4 | #2565C7 |
| `--mic-soft` | #E5F3E9 | #E3F2E8 | #E8F0FF | #E5EEFF |
| `--category-light` | #FFF2D8 | #FFF2D8 | #FFF2D8 | #FFF1D9 |
| `--category-door` | #DDF4E7 | #DDF4E7 | #DDF4E7 | #E2F6EC |
| `--category-room-1` | #F0F3EF | #F4F1EA | #EEF2ED | #E8F1FF |
| `--category-room-2` | #F0F3EF | #F4F1EA | #EEF2ED | #E2F6EC |
| `--category-kitchen` | #F0F3EF | #F4F1EA | #EEF2ED | #FFF1D9 |
| `--category-entrance` | #F0F3EF | #F4F1EA | #EEF2ED | #FFE7E5 |
| `--category-hallway` | #F0F3EF | #F4F1EA | #EEF2ED | #F0E9FF |

`--border` is decorative separation, not enough to identify a control by itself. Inputs, unchecked switches and essential outlined controls use `--border-strong`; focus uses `--ring` with a 3px outline and 3px surface-colored separation. Primary/hover/pressed use on-primary text. Secondary filled uses `--secondary` + on-primary; tonal uses text + secondary-soft. Category tints pair with `--text`, not white. Icons carrying meaning use text/semantic colors with ≥3:1 contrast; decorative tints do not convey state. Disabled controls retain explanation text in `--text-disabled`, not whole-card opacity. Danger never changes meaning between themes.

## 2. Geometry, spacing, typography and motion

| Shared token | Exact value |
|---|---|
| `--space-1/2/3/4/5/6/8/10/12` | 4/8/12/16/20/24/32/40/48px |
| `--radius-xs/sm/md/xl/pill` | 10/14/18/28/999px |
| `--radius-control` | 14px |
| `--border-width` | 1px (2px in stronger-outline preference) |
| `--touch-min` | 48px; 56px for theme03 or Large controls |
| `--button-min` | 52px; 56px for theme03 or Large controls |
| `--nav-height` | minimum76px + `env(safe-area-inset-bottom)`; grows for translation/zoom |
| `--sidebar-width` | 228px |
| `--content-max` | 1180px |
| `--reading-max` | 740px assistant, 780px settings |
| `--font-ui` | system-ui, 'Segoe UI', 'Noto Sans Devanagari', sans-serif; optional locally licensed Inter precedes system-ui |
| `--font-mono` | ui-monospace, Consolas, monospace |
| `--font-body` | 1rem; root16px standard,18px theme03; Large text root20px in any theme (does not multiply theme03) |
| `--font-meta` | .875rem /1.5 /400 |
| `--font-card` | 1.0625rem /1.4 /600 |
| `--font-section` | 1.1875rem /1.35 /700 |
| `--font-title` | 1.75rem mobile,2rem desktop /1.25 /700 |
| `--font-button` | 1rem /1.4 /600 |
| `--line-body` | 1.5;1.65 for `lang=hi`; normal letter spacing |
| `--duration-fast/base/panel` | 120/180/220ms |
| `--ease` | cubic-bezier(.2,.8,.2,1) |
| `--z-header/nav/popover/dialog/toast` | 10/20/30/40/50; native dialog top layer preferred |

| Per-theme geometry | 05 | 01 | 03 | 04 |
|---|---|---|---|---|
| `--radius-card` | 22px | 24px | 20px | 24px |
| `--shadow-card` | 0 5px 22px rgba(24,39,30,.045) | 0 6px 22px rgba(70,57,36,.06) | 0 3px 16px rgba(22,34,29,.035) | 0 5px 18px rgba(24,59,118,.045) |
| `--shadow-dialog` | 0 16px 48px rgba(16,24,20,.16) | same | same | same |

All dimensions involving text use rem/min-height and intrinsic wrapping, not clipped fixed height. Historical aliases `--card-radius`, `--radius-lg`, `--card-shadow`, `--radius` resolve to canonical `--radius-card`/`--shadow-card` during migration; remove aliases after no consumers remain. `--radius-lg` if needed aliases card radius, never introduces a second competing card size. Root font-size user browser scaling is respected; implement 100%/112.5%/125% rather than overriding browser base in absolute pixels.

Buttons change background only on press; optional 0.98 scale only for fine pointers. Page transition opacity180ms, no mandatory translation. Mic optional slow ring1.8s, no glow. If OS reduced-motion OR app Reduce motion is true, all decorative transitions/pulses/shimmer disabled, progress text retained; user cannot override OS reduce with false. Dialog focus is immediate. Forced-colors uses system colors, currentColor borders, no shadow-only affordance.

## 3. Responsive grid (one application)

| Width | Navigation | Main layout / gaps |
|---|---|---|
| 320–599px | five labelled bottom items; app bar with logo/back+bell | 16px gutter/gap; single room list; 2-column light tiles only if min128px + text fits, else1; stacked Security |
| 600–767px | same bottom nav | 24px gutter/gap; two-column cards; main headings span grid |
| 768–1023px | left compact80px rail, 5 icon+text labels | 24px gutters; two-column cards, Security door+support; rail labels wrap, use expanded nav below if zoom needs it |
| ≥1024px | 228px sidebar | 32px gutters, 24px gaps, max1180px; Home primary2:1 columns; Rooms3 cards only with min240px; Security2 columns |

Breakpoints are viewport CSS px; use content-aware wrapping too. At200% zoom sidebar may collapse to mobile scheme; at400%/320px reflow no two-dimensional scroll except explicitly bounded technical tables. Bottom content padding at least nav height+24px; toast bottom above nav, on-screen keyboard must not hide assistant Send or modal Cancel. Safe-area insets on all relevant edges. No reorder of critical buttons between themes or widths.

## 4. Preferences, startup and persistence

| Key | Value / scope / default |
|---|---|
| `homeauto.theme.v1` | string 05/01/03/04; browser;05 |
| `homeauto.largeText.v1` | JSON boolean; browser; false |
| `homeauto.largeControls.v1` | JSON boolean; browser; false |
| `homeauto.reducedMotion.v1` | JSON boolean; browser; false (effective OR OS) |
| `homeauto.strongOutlines.v1` | JSON boolean; browser; false; strengthens borders/focus while retaining theme identity |
| `homeauto.language.v1` | en/hi; browser; en; owner onboarding can select Hindi immediately |

Home name is shared DB setting, not an independent localStorage truth; migrate historical `homeauto.homeName.v1` only after owner confirms and remove obsolete preference. Voice/favorites/category preferences belong to own server user as defined in API_CONTRACTS. Never invent cross-device persistence for local browser theme; browser restarts preserve it, clearing browser data resets to05. OS dark mode must not silently change chosen theme. If storage read fails choose05, accessibility defaults+OS reduce; if write fails apply in memory and show one nonblocking “Preference saved for this visit” notice. Validate storage values and ignore invalid/corrupt keys. Cross-tab storage event applies allowed preferences only, preserves pending commands and focus, does not cause write loops.

Apply theme/size/lang in a small **local** bootstrap before visible app paint. To support CSP without unsafe-inline, use a blocking same-origin `theme-bootstrap.js` or a fixed hash for the tiny inline bootstrap, then defer the main scripts. Keep fallback CSS05 present even if script fails. Update manifest branding/background in coding task; fixed manifest theme_color05 with document meta theme-color updated from chosen background. Appearance radio choices ordered05,01,03,04; selection immediate, reset changes theme only; previews use inert sample DOM, no device callbacks.

## 5. Reference reconciliation

All four boards were opened visually in this planning session. 01 uses cream/warm photos/green mic;03 larger labels, safety/door prominence and blue mic;04 soft blue/mint/peach/lavender category blocks and optional illustrated avatar;05 calm whites/emerald mic and clean room rows. Photo mood is optional local decoration; controls never depend on photos. Theme04's “Nova”, mock family names and theme05's extra cameras/back door are generated illustration, not product identity or hardware. Keep Shrimaan in all themes. Home/Away/Night, AC, curtains, fans, music, smoke/water/window sensors, extra locks and cameras remain absent until independent implementation/hardware exists. No new screens are inferred from poster footers.

## 6. Theme acceptance

THEME-01 absent/invalid storage→05 before paint; THEME-02 radio selection applies globally and survives browser restart without WAN; THEME-03 denied storage→session fallback; THEME-04 other tab sync preserves pending action; THEME-05 4 themes×5 screens×320/390/768/1024/1440 widths; THEME-06 typography, Devanagari,200%/400%, forced-colors; THEME-07 contrast all intended text/background and essential control pairs, focus/pressed/errors; THEME-08 reduced motion and local asset requests; THEME-09 reset doesn't reset language/accessibility or send commands. Automated palette calculation is useful evidence, but rendered states/screens must still be checked. Accessibility thresholds reference [WCAG 2.2](https://www.w3.org/TR/WCAG22/); the product's48px minimum exceeds the standard's AA minimum, and is an intentional usability choice.
