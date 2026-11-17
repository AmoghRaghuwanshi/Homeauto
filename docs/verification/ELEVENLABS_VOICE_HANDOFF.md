# HomeAuto voice preview continuation — 2026-11-15

> Superseded task priority, 2026-11-15: the user explicitly deferred ElevenLabs and asked to focus on Web Speech API voices. Do not resume paid generation, connection setup or voice design unless requested again. Browser voice selection, per-language previews and browser-local volume/preferences are implemented; current evidence is in [BROWSER_VOICE_ASSISTANT.md](BROWSER_VOICE_ASSISTANT.md). Raj and Viraj were rejected. No replacement ElevenLabs voice was approved or installed. The following notes preserve the earlier deferred work.

## Immediate task

Generate a voice preview using the user's **direct ElevenLabs plugin and personal ElevenLabs credits**, not Creative Claw. The user has explicitly selected and mentioned plugin `app-6a8d784b60cc81919aeafbfaeda5fbcf@openai-curated-remote`. Do not ask again which plugin, language or voice style they want. Do not request an API key in chat.

Desired voice: an original **young, energetic male**, natural rather than a radio announcer, with clear Indian English and Hindi, audible full-bodied output, steady conversational pace and natural intonation. No real-person imitation or voice cloning. The user disliked the previous Raj stock-voice sample. No replacement voice has been approved.

Create one batch of three custom voice auditions if the direct plugin exposes voice design, then let the user hear and choose before saving a final voice or deploying it. Do not repeatedly generate paid replacements. Discover the direct plugin's current tools/schema; do not invent tool names or silently switch services. Its Creative Studio speech tool requires a voice ID obtained from the actual voice-list tool. A stock-voice list is not a newly designed voice.

## Prepared voice-design brief

Description:

> An original young adult male voice, approximately 24 years old, with a natural educated Indian accent in Indian English and Hindi. Warm, bright and energetic while relaxed and conversational, like a friendly helpful person at home. Clear consonants, full-bodied audible tone, comfortable medium-low pitch, steady medium pace and natural sentence intonation. Confident and easy to understand, with clean studio audio. Avoid exaggerated announcer delivery, shouting, whispering or robotic rhythm. Do not imitate any real person.

Bilingual audition script:

> Hello! I'm Shrimaan. How can I help you with your home? नमस्ते! मैं श्रीमान हूँ। आप मुझसे अपने घर की लाइट, कमरे और सेंसर के बारे में पूछ सकते हैं। Let's make everyday home controls simple.

Use the provider's supported voice-design parameters; do not assume Creative Claw settings apply to direct ElevenLabs tools. A prepared direct API request is outside the repository at `D:/homeauto-audit-tools/elevenlabs-design-20261115/voice-design-request.json`; it is only request data, not evidence of a successful generation.

## Actual connection state in the originating chat

The direct plugin is installed locally and its skill files are present at `C:/Users/Amogh/.codex/plugins/cache/openai-curated-remote/app-6a8d784b60cc81919aeafbfaeda5fbcf/1.0.0/skills`. The `.app.json` requires app ID `asdk_app_6a8d784b60cc81919aeafbfaeda5fbcf`. Permission inspection recognizes this exact ElevenLabs app, using the default low-risk action policy.

After the explicit plugin mention, the originating chat loaded the ElevenLabs skills but exposed **no direct ElevenLabs MCP tools**: no voice list, voice design, creative speech generation or flow-status tools appeared in either tool metadata or callable-tool discovery. Plugin-management search also returned no directory entries despite the local installation. Do not say the account is disconnected merely from that search result, and do not claim generation succeeded. The missing tool exposure is the current blocker; its underlying cause has not been proven.

Relevant skills read: direct plugin `creative-studio`, `text-to-speech`, `setup-api-key`, and `speech-engine` (the latter is not needed to create an audition). Creative Studio explicitly requires the plugin's ElevenLabs MCP server. Official OpenAI plugin guidance says new chats can load installed plugin tools; a fresh chat with ElevenLabs selected is the next supported step, preserving this brief.

No direct ElevenLabs generation has run or been charged by this work. A previous Creative Claw English greeting completed, cost 2 Creative Claw credits, and was rejected by the user. Creative Claw then reported 1 credit available against approximately 4 required for the custom preview, so those requests were blocked before generation without charge. Its balance is separate from the user's personal ElevenLabs credits. Do not send the requested preview through Creative Claw again.

Earlier official CLI OAuth setup reported a browser success according to the user, but the local CLI received neither callback nor credential. Its stalled, owned callback worker was stopped. A private local credential helper was prepared outside the project; the user now explicitly prefers the plugin, so do not redirect them to that helper as the first step. No key was found in the process/user/machine environment, project env files or the dedicated helper's credential files at last inspection. Never print credential contents.

Automatic approval review rejected launching Chrome through `Start-Process`, with “blocked by policy” and no detailed reason. That action was not retried through another mechanism.

## Broader work to preserve

The user also requested louder/clearer, more realistic speech; richer basic Hindi/English/Hinglish conversation and project-specific explanations; and stop phrases such as **bas karo / बस करो / stop talking**. These improvements are still pending. They must not be claimed implemented or trained. Discussion of a small curated/trained FAQ classifier was exploratory; no new corpus, classifier weights or training run has been created.

Do not claim knowledge distillation or speech-model training without actually doing and evaluating it. Browser/OS speech cannot be retrained through Web Speech API. Keep physical-device execution behind the existing strict parser, fresh backend state, role checks and Security confirmation. A conversational stop must cancel voice/session/output, not switch home devices or undo a command already published. Preserve anti-echo and avoid claiming spoken interruption works while the microphone is deliberately off.

## Existing project baseline

Workspace: `D:/homeauto-main`, Windows PowerShell. Use Node 22 at `D:/homeauto-audit-tools/publication-20261107/tools/node22/node-v22.23.4-win-x64/node.exe`. Preserve the substantial existing uncommitted work. No push or deployment is authorized by the voice-preview request.

The local app previously ran at `http://localhost:3001/assistant` as an isolated simulator. Current code uses browser recognition/synthesis and an authenticated final-text WebSocket. Native speech weights and Python environments were archived outside the checkout; do not reinstall them for this task. Manual mic use bypasses the optional wake word. Optional foreground wake listening, bilingual reply selection and an in-memory multi-turn chat log were already implemented and tested.

Previous verification: 257 full regression tests passed, an additional 26-test focused navigation run passed, 11 browser acceptance groups plus 16 theme/language/width captures passed, and 30 existing UX groups passed. Evidence is at `D:/homeauto-audit-tools/chat-wake-20261115`; detailed baseline documentation is `docs/verification/BROWSER_VOICE_ASSISTANT.md`. Browser speech was substituted and hardware simulated in acceptance; real microphone/accent quality and physical commissioning are not certified.

No HomeAuto application code has changed during the subsequent voice audition/account-connection attempts. This handoff is documentation only.
