# Unslop content audit

## Cloud integration —2026-11-07

Loaded the installed2.3.0 skill/core contract/cleanup/rewrite/fact-preservation/crisp-human references. Audited actual cloud labels, network/authentication errors, capability notes and assistant responses before editing. Clear existing labels and operational warnings were retained. Confirmed corrections:

| Defective span/context | Minimal correction | Preservation |
|---|---|---|
| Gateway admission jargon in pending UI | Waiting for home hub / Queued for home hub | Delivery remains distinct from waiting for controller/observed |
| Local setup required in cloud Assistant | Voice is local; disabled mic label says Voice stays on the home hub | No promise that setup enables cloud microphone; local voice remains intact |
| Lock the front door suggestion on cloud screen | Supported status-query suggestions and explicit remote-door-disabled note | No unlock/door-control bypass; bounded parser unchanged |
| New subtitle missing in Hindi dictionary | Contextual Hindi translation | No English scanner claim about Hindi/Hinglish |
| Cloud query returned a bare on/off value | Controller reports on/off; door query retains unsensed-position qualifier | No physical-success claim |

The English eligible-copy sample at D:/homeauto-audit-tools/production-cloud-20261107/evidence/cloud-copy.txt had phrase0 and silhouette0. Structure raised one soft opener-repetition flag; readability raised similar-length/repetition advisories (grade6.3). These are protected: the sample combines independent UI states, where consistent Request/Voice/Home labels aid scanning, not a paragraph for reconstruction. No bulk synonyms or artificial sentence variation were introduced. Four safety warnings were checked verbatim against actual views.js source; preservation utility returned passed with0 extracted constraints, so source-string verification/manual meaning review supplies the substantive evidence rather than an inflated scanner claim. Raw outputs are unslop-*.json in that evidence directory.

Hindi cloud screenshots were visually reviewed and grammatical/meaning scope checked manually; native-speaker/usability acceptance remains open. Independent Hallmark's3 cloud-copy findings were corrected and recaptured. All English exceptions above are documented decisions, not claims that installation automatically improves design. Earlier audits below retain their historical scope/counts.

## Backend continuation —2026-11-06

The installed2.3.0 audit-first/preservation process was retained for the PostgreSQL extension. All26 public frontend files are unchanged. Existing concise labels, Hindi/Hinglish and physical/security qualifiers were accepted without rewriting. New cloud responses contain diagnostic enums and metadata acknowledgments, with no physical-success claim. Documentation explicitly distinguishes metadata idle/accepted from cloud reachability and device state. No new English prose defect required a UI rewrite, and no new automated writing-scanner or visual-render result is claimed for this backend stage. See docs/backend/IMPLEMENTATION_TRACKER.md for actual tests and limitations.

Performed 2026-11-05. This audit applies writing review to the existing HomeAuto
UI; visual design was refined separately. No Unslop file is bundled with the
frontend or required at application runtime.

## Installation and method

No existing installation was found in the Codex/agent skill directories. The
[original repository](https://github.com/theclaymethod/unslop) documented the
Skills CLI, which was run once:

```text
npx --yes skills add theclaymethod/unslop -g -a codex --yes
```

Installed skill version 2.3.0 is under
`C:/Users/Amogh/.agents/skills/unslop`. Read: `SKILL.md`,
`references/core-contract.md`, cleanup/report-only and rewrite command files,
`fact-preservation.md`, the relevant phrase/structure/silhouette scanner guidance
and script interfaces, and the shipped `presets/crisp-human.md`. The router refers
to `crisp.md`; the actual preset filename is `crisp-human.md`. No duplicate install
was attempted. Scanners use the local Python environment and run offline.

The first pass captured and read rendered copy from 24 existing routes. It also
reviewed shared labels, errors, helper text, help topics, notifications and trusted
assistant response templates in source. English was reviewed before consulting
scanner output. Hindi additions were reviewed separately for meaning and glyph
layout; no English-language scanner decision was applied to Hindi or Hinglish.
Native-speaker acceptance remains open.

## Findings and decisions

| Finding | Decision |
|---|---|
| Home's “A calmer day.” | Remove the empty benefit phrase; retain “Simple controls.” |
| Security's “A little peace of mind.” | Replace with the actual screen scope: doors, access cards and sensors. |
| Settings' “Make yourself at home.” | Remove the decorative subtitle. |
| “Four ways to feel at home” | “Choose from four themes”; keep the four-theme count. |
| Theme03 “Larger, clearer, easier.” | “Larger text and controls.” matches the implemented differences. |
| Theme05 “Calm whites. A little emerald.” | Describe white surfaces and emerald accents directly. |
| Activity's “Your home, at a glance.” | Name requests, reports and access events instead of a home overview. |
| Stale door “Controller reports Unavailable” | “Door status unavailable”; freshness is an app assessment, not a new controller report. |
| Gas “normal” | Display “No alert reported”; do not imply calibrated safety. |
| PIR “clear” | Display “No motion reported”; do not imply proof of an empty room. |

Exact before/after pairs and reasons are in `COPY_CHANGES.json`. Operational
status-label changes affect presentation only; payloads, keys and state logic
remain untouched. New microphone/connection/storage error messages give a useful
next action without claiming a failed or successful physical command. Unclear
network outcomes advise checking device status before retrying.

## Protected and rejected suggestions

The baseline phrase scanner returned one soft `anti_slop_register` candidate
around the privacy copy's consecutive “No…” statements. It was **protected**:
those negations express actual processing and retention constraints. Structure
and readability scans also flagged the concatenated inventory's short paragraphs
and repeated words such as Home and Door. A list of labels is not continuous
prose; merging controls or replacing established nouns would damage usability.
The silhouette scan did not flag the baseline inventory. No scanner score proves
authorship or complete writing quality.

Clear copy such as Turn on, Turn off, Cancel, Save, Which light do you mean?,
permission checks and the assistant's controller-report/uncertain templates was
left unchanged. No new spoken success claim or direct voice unlock was added.
Eight selected safety/privacy messages remain verbatim, including physical lock
sensing, conditional five-second relock, uncalibrated gas, PIR absence limits,
cloneable UIDs, acknowledgment semantics and local audio processing/retention.

## Validation and limits

`server/scripts/audit-copy.py` runs the actual Unslop preservation, phrase,
structure, silhouette, readability and diff tools on the edited spans and strict
preservation on protected messages. Results live in
`.local/qa/ux/copy/validation.json`; the original report is
`.local/qa/ux/baseline/unslop-audit.json`.

All edited spans pass fact/constraint preservation. Nonempty replacement spans
have no phrase/structure/silhouette findings. The deliberately deleted Settings
subtitle has empty output, so the phrase/readability tools decline it; this is
not a new language defect. The readability tool flags the three-word status Door status unavailable because of the syllable count in unavailable; that score does not establish a clarity defect in a short, conventional status. Diff percentage warnings are expected for short
standalone labels, and were reviewed against context rather than waived as a
document-wide rewrite. The unedited safety messages pass strict preservation.
All remaining source copy was retained unless a concrete UX defect justified a
separate correction. Human language/voice review remains a release gate.

README and the operator guide were also audited with documentation genre settings.
README had no phrase, structure or silhouette flags. The operator guide had no
phrase/structure flags and one soft silhouette/heading-overlap warning. Its
ordered safety/setup headings are necessary reference organization, so no
reconstruction was justified. Raw results are in
`.local/qa/ux/copy/documentation-audit.json`.
