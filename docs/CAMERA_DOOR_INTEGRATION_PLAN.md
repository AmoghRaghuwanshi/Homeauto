# CP Plus CP‑E31A camera and door integration plan

2026-11-19 · Local ONVIF commissioning and isolated simulation

## Current direction and verified camera metadata

The user has temporarily restored simulation while the ESP32 is unfinished. `Start-HomeAuto.bat` opens the isolated in-memory simulation on loopback port 3002; `Start-HomeAuto-Hardware.bat` retains the real hub on 3001. Modules in simulation provides generated camera frames, live/stale/offline/fault scenarios and simulated sensors. These never connect to a real camera, MQTT or the durable household DB. The real hub's Modules page stays available without an ESP32 for deliberately configured camera reachability checks.

With the user's CP-E31A on the same phone hotspot, bounded local discovery matched the supplied camera MAC to a private IPv4 address. Before ONVIF was enabled, it did not answer discovery or the tested default service ports. After the user enabled ONVIF, WS-Discovery returned the device service on port **8000**. A read-only GetCapabilities call succeeded; authenticated GetProfiles accepted the camera's fixed **admin** account and user-supplied ONVIF password. Two profiles advertise **H.264 video** and **G.711 microphone audio**. GetStreamUri returned an RTSP URI on port **5543**. These are measurements for this unit/firmware, not defaults guaranteed for every CP Plus model. Do not substitute a guessed RTSP path or default port.

Credentials were entered through a hidden prompt and held in process memory, not source or output. Private camera IP/MAC, SOAP capability responses and redacted metadata results remain under ignored `.local/qa/simulation-return`. No actual camera video or audio was recorded, no PTZ/control operation was issued, and no door action was sent during discovery/metadata checks. The camera's actual video playback, decoded microphone audio and speaker talkback are **not yet verified**. A generated fixture preview must never be presented as this camera's video or face-recognition evidence.

### Video, microphone and speaker are distinct integration paths

1. **Video:** the local hub authenticates against the discovered media service, obtains the profile's URI and consumes its RTSP stream. A bounded decoder/relay then supplies a browser-supported presentation. Browser JavaScript cannot treat an arbitrary Wi-Fi camera as a directly attached webcam or rely on native RTSP playback. Prefer a low-latency authenticated WebRTC relay after testing this exact H.264 profile; keep decoding away from the command/event loop.
2. **Camera microphone:** audio arrives as a separate track in the camera's media stream when that profile actually carries it. Verify packets and playback before showing a microphone-connected state. G.711 may need conversion or compatible negotiation for the chosen browser transport. Feeding it into the assistant is separate work involving explicit listening controls, endpointing and echo prevention; current voice input remains the laptop/browser microphone.
3. **Camera speaker:** do not assume that receiving audio means the speaker can be controlled. Inspect ONVIF AudioOutput/backchannel support and test only an advertised, authenticated path. ONVIF Profile T describes bidirectional audio where supported, but does not establish conformance by this camera. ezyKam+ talkback may use a vendor-specific interface. Keep talkback unavailable until a supported path and actual playback are verified.

For later access, keep the local hub and camera on a reachable LAN, reserve the camera's private IP if the network permits it, and enter its local credentials in private hub configuration when the authenticated stream adapter is implemented. Do not send passwords, cloud account access or pairing QR codes in chat, and do not forward camera ports to the internet. A phone hotspot can isolate clients or change addresses after reconnection. Use a known private VPN path for remote commissioning only if it is explicitly configured and authorized; sharing the internet-facing address alone does not grant local camera access.

Implementation still needs a credential-aware media adapter, protected browser relay, genuine stream freshness/codec checks and separate talkback capability handling. Face recognition and automatic physical unlock remain later, independently gated work.

> Updated user direction, 2026-11-18. Normal application startup now uses the hardware runtime and the Modules page on port 3001. Camera simulation UI and its standalone launch command were retired. The generated frame source remains a test fixture. Local model/assistant functionality requires a fresh ESP32 connection. Camera configuration is optional and currently supports saved LAN settings and reachability checks, with explicit unverified video status. The following Stage 1 fixture checkpoint records the preceding implementation. See `docs/DEVELOPMENT_STATE.md` for current verification and deployment state.

## Current implementation checkpoint

Stage 1 capture and preview foundations are implemented in `server/camera/frame-source.js`, `fixture-source.js` and `service.js`. They provide a bounded latest-frame buffer, source generations, strictly increasing sequences, freshness checks, copied frame buffers and deterministic live/stale/offline/fault simulation. Fixture mode is restricted to the simulator. The local service defaults to disabled and supports a read-only owner preview. Fixture initialization and startup failures are isolated to the camera status. Runtime shutdown clears the fixture timer and frame.

The existing local session, owner and CSRF middleware protects `GET /api/camera/status`, `GET /api/camera/frame` and the simulation-only `POST /api/camera/fixture`. The new service has no command publisher. The Security camera panel loads independently, displays a generated PNG test pattern in an accessible dialog and exercises failures/recovery. Hindi labels and the four existing semantic themes are supported. At this checkpoint, no face verification, enrollment, recording, vehicle inference or camera-assisted unlock flow is implemented. The source reports these capabilities as disabled.

Verification evidence is in `.local/qa/camera-foundation`. Before edits, 23 focused voice/chat tests passed. Four new backend tests then passed for source epochs, stale/backward-clock handling, replayed sequence rejection, independent buffer ownership, disabled defaults, real-profile exclusion, recovery, startup failure, owner/session/CSRF checks, closed body schemas and zero commands/publications. The full suite passed 265 tests with no failures or skips. The camera browser check passed four groups and eight four-theme mobile/desktop captures with no page errors, external requests or commands. It verified preview decoding, focus restoration, stale/offline/fault recovery, continued manual door confirmation, and a stalled camera request that leaves Security navigation available. Its first run exposed an ambiguous test selector shared with a select option. The corrected selector targets the actual status element and passed. The cloud build boundary passed with 458 traced files and zero native hub files.

A separate fixture demo is running on port 3002 at implementation handoff. Use Security → Entrance camera. Node.js 22 and the normal server dependencies are sufficient for this fixture. The CP‑E31A local stream, real CPU vision models, hardware and physical access still need the later stages below. All verification in this checkpoint used an in-memory home and generated non-personal frames.

HomeAuto will ingest video on the laptop that runs the local hub. The first milestone is a working camera preview and a simulated access flow. An enrolled resident initiates a local access check, the hub evaluates fresh camera frames, and an authorized person confirms the existing unlock action. Vehicle recognition is a separate arrival signal. Recording and continuous monitoring are later features.

## 1. What we know about the camera

The [CP Plus ezyKam+ setup guide](https://cpplusworld.com/ezykamplus/cp-e21a-e31a-e41a-e51ar-e81ar.html) identifies the CP‑E31A as a 2304 × 1296 camera at 20 fps with H.265 video and 2.4 GHz Wi‑Fi. The guide describes provisioning through ezyKam+ and lists an internet connection for its documented setup. It does not give a supported RTSP URL, an ONVIF procedure, or a firmware-specific guarantee of independent LAN operation. A working preview in ezyKam+ therefore does not prove the hub can ingest video. We also need to verify the actual unit's mounting and environmental suitability before choosing a permanent position.

| What the unit provides | Integration decision |
| --- | --- |
| Supported local ONVIF media service | Read authenticated device information and media profiles, then use the reported URI for the selected profile. Check codec, resolution and usable face detail. |
| Documented local RTSP access without ONVIF | Configure the supported URI manually and confirm video decoding. Use the documented source settings for any substream. |
| Local stream works but camera requires internet at boot or after reconnect | Label it internet-dependent. Keep it out of the offline access path. |
| ezyKam+ preview only, or a stream that cannot be authenticated or decoded reliably | Demonstrate with consented local clips or a USB webcam. If local camera access is needed for the permanent setup, choose a camera with documented local streams and suitable installation specifications. |

[ONVIF Profile T](https://www.onvif.org/profiles/profile-t/) describes H.264/H.265 interoperability for conformant equipment. That is a protocol reference, not evidence of conformance by this unit or firmware.

## 2. HomeAuto integration boundary

```text
CP‑E31A → local read-only camera adapter → video decoder → latest-frame buffer
                                                          ↓
                                             isolated CPU vision worker
                                                          ↓
                                            hub evidence and policy service
                                                          ↓
                                  local Security screen + authorized confirmation
                                                          ↓
                                         existing HomeAuto door command service
                                                          ↓
                                              MQTT → ESP32 → relay/report
```

- **Camera and worker** supply evidence. They have no MQTT credentials or access to command routes. A camera notification, result score, uploaded photo or client JSON claiming `matched` cannot authorize an unlock. Vercel and Neon are outside this path.
- **Node hub** owns event freshness, access attempts, identity binding, feature flags and audit outcomes. Its session and permission checks apply to camera settings, enrollment, previews and confirmation. It evaluates results from its managed worker rather than accepting them from the browser.
- **Existing actuator** remains `door-1`. `POST /api/security/unlock-challenges` and `Home.request()` currently enforce the physical door gate, actor permissions, fresh reauthentication, session-bound one-use challenge, controller availability, database health, pending-command checks and idempotency. Preserve those controls. The first camera-assisted flow is an optional Security entry point to this manual flow. It does not add a camera source to `Home.request()`, impersonate RFID, or publish directly to the broker.
- **Physical status** stays distinct from authorization and command delivery. A command response or controller report does not prove bolt position, and seeing the door on camera is not a substitute for a suitable contact or bolt sensor. Keep the existing relay timing and firmware contract during software work.

References in this checkout: [hub HTTP routes](../server/app.js), [door command service](../server/services/home.js), [ESP32 door sketch](../firmware/door_security/door_security.ino), and [hardware release gates](HARDWARE_RELEASE_REMEDIATION_PROPOSALS.md).

## 3. Implementation order and exit gates

| Stage | Work that can be assigned separately | Evidence before moving forward |
| --- | --- | --- |
| 1. Offline fixture | Define the frame source interface and add a local file or webcam adapter. Add a dry-run fixture that replays frame sequences, disconnects and timeouts. Keep the camera feature off by default. | Existing simulator actions still work. Fixtures can exercise the camera workflow with zero MQTT publications. |
| 2. Read-only camera connection | Verify the actual firmware, LAN connection, authentication, supported profiles, decoding, timestamps and behavior without WAN. Show health and live preview in local Security. | Exact unit and supported path documented. Cold start and reconnection demonstrated. The fixture remains available as a fallback. |
| 3. CPU face verification | Add face detection, alignment, embedding comparison and quality checks. Enroll consenting test users locally. Evaluate presentation attack detection separately. | A held-out report documents false accepts, false rejects, video freshness and CPU cost. Every uncertain attempt produces a clear reason. |
| 4. Simulated access | Add an explicit local check and a confirmation flow using the simulated door. Add expiry, idempotency, cancellation and audit entries. | End-to-end tests prove denied, expired and replayed attempts send zero commands, and an accepted confirmation triggers at most one simulated command. |
| 5. Supervised hardware review | Close existing firmware and MQTT release gates. Demonstrate normal relock, outage relock, power recovery and independent egress on the relevant fixture. | Confirm actual board configuration, relay polarity and physical behavior. Keep automated camera access disabled unless the separate release decision and prerequisites are met. |
| 6. Vehicle arrival | Add vehicle presence detection in a driveway zone. Consider a separate plate capture test only if the location supplies readable images. Use arrivals to show a prompt. | Report missed arrivals, duplicates and false alerts. Vehicle results never confer door authority. |

### Stage 1 and 2 details

- Use one camera initially. A `FrameSource` should expose `start`, `latestFrame`, `health` and `stop`. Use a bounded buffer of one or two frames and drop old work when inference falls behind. Track a source ID, stream generation, frame sequence, hub receive time, codec and decode status. A fresh arrival timestamp on the hub is insufficient evidence by itself if a feed is buffered, frozen or replayed.
- Keep decoding in a separate process so decode failures or CPU saturation do not stall HomeAuto controls. Pin the decoder and supported build. Try a supported lower-resolution stream first, with a baseline sample rate around 3–5 frames per second for inference. If face crops are too small, correct placement or choose a better stream before adjusting thresholds. Retest daytime, night IR, backlighting, camera movement and mounting distance.
- For commissioning, put the camera and hub on networks with authorized local reachability. Prefer a reserved address and a dedicated read-only account where supported. Store credentials outside the repo with restricted access. Do not log a full URI containing credentials. Use configured device destinations and restrict adapter connections and redirects to that device. Keep the feed on the LAN and avoid exposing the camera or decoder to the internet.
- Prefer authenticated and encrypted transport where the firmware supports it. If the device only provides an unverified or unencrypted feed, it can be used for preview and shadow-mode experiments on an isolated network. It is not trusted evidence for automatic physical access. Check WAN independence with WAN unavailable while the LAN stays up, including a camera and hub restart. Record whether provisioning, playback, time synchronization or recovery depend on the vendor service.
- Show `Disabled`, `Connecting`, `Live`, `Reconnecting`, `Stale` and `Unavailable` with clear errors. A saved last image must be labeled as such and excluded from access decisions. Enforce bounded reconnect with backoff, drop stale queued frames and reset all pending evidence when the source restarts.

### Stage 3 face evaluation

- Start with **1:1 verification**. An already authenticated local user chooses to verify their own enrolled identity. Do not start with background identification of every person entering the frame. Enrollment is an explicit owner-managed action with fresh reauthentication and the resident's consent. Revocation immediately disables the profile and invalidates its unconsumed evidence.
- Benchmark **YuNet** for detection and **SFace** for comparison as small CPU candidates. [OpenCV documents the two ONNX models](https://docs.opencv.org/4.x/d0/dd4/tutorial_dnn_face.html). Verify model provenance and terms, pin model files by hash, and provision them separately. Run on CPU first. Measure H.265 decoding and inference separately and together on the actual hub. These models do not establish liveness. Their example thresholds and benchmark accuracy are not acceptance criteria for our camera.
- Use a fixed entry region and collect multiple quality samples for each consented enrollment. Evaluate illumination, minimum usable face size, blur, angle and occlusion. Reject multiple or inconsistent faces for an access check. Use separate collection sessions for enrollment, threshold selection and evaluation so near duplicate frames do not inflate the results. Calibrate a versioned threshold before the held-out test and record every inconclusive attempt. Do not lower the threshold to pass a demo.
- Evaluate a dedicated presentation attack detection method with the actual RGB camera, lighting and placement before even considering biometric authority. Include supervised photo and display presentation tests, frozen video and interrupted streams using fixtures or test media. Basic motion, a blink or a match across several frames alone is insufficient. [NIST's digital identity guidance](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/) provides a design benchmark for presentation attack detection, use with a physical authenticator and alternative access. This home hardware plan makes no claim of NIST conformance.
- For future physical access that depends on biometrics as a factor, require deliberate intent and a separate cryptographic possession factor, for example an enrolled hardware security key or device-bound credential with suitable local verification. The existing cloneable RFID UID and a vehicle or plate match do not qualify as that factor. Until the stronger design is validated, the camera can assist the authorized person's existing confirmation, which still governs access.

### Stage 4 access attempt and operator UI

`Idle → Checking → Eligible to confirm → Request submitted → Controller reported / Uncertain`

`Checking` and `Eligible to confirm` can also exit to `Denied`, `Expired`, `Cancelled` or `Unavailable`. The UI distinguishes “Face check passed”, “Confirm unlock”, “Request sent” and “Controller reports unlocked”. It offers the existing manual option when the camera is unavailable. Add this as a section in the existing Security screen using Serene Emerald tokens and current responsive components.

- Generate the attempt ID on the hub. Bind it to the claimed user, session, `door-1`, purpose, camera, stream generation and policy version. Grant eligibility from recent qualified frames after the attempt began. Start with a short configurable window, such as 10 seconds after eligibility, then measure usability. Expiry also respects the existing door challenge lifetime. Base expiry on a hub clock and invalidate attempts on hub/worker restart, camera reconnect, session change, camera/door disable, policy change or profile revocation.
- Any future dedicated camera confirmation handler must verify all camera requirements server-side, consume its attempt once and use the existing one-use, session-bound door challenge. Plan atomic consumption with command admission before adding the mutation. Competing clicks or expired attempts must not publish twice, and a disconnect must not cause an automatic retry. Retain the existing manual entry point as independent fallback.
- Store audit metadata such as event ID, UTC time, source ID, outcome reason, applicable profile reference, policy/model version and command ID when present. Keep face images and embeddings out of ordinary logs, cloud sync, settings payloads and build artifacts. By default use transient frames only. Encrypt any local enrollment templates with a key kept apart from the data, restrict access, provide deletion and document backup/retention before enabling durable storage. Set a bounded local audit retention period and make preview access explicit. No camera microphone or continuous recording in this milestone.

### Stage 5 physical safety gate

The checked-in ESP32 door sketch uses a nominal five-second relay timer, but the release report documents a blocking network recovery path that can delay relock. Keep `HOMEAUTO_DOOR_ENABLED=0` for camera development. Before any real lock integration, validate fail mode, independent exit, manual backup access, reboot behavior, reconnect timing, broker isolation and controller readiness. Begin with a detached indicator/relay fixture. An ambiguous command stays uncertain and is not replayed automatically. Camera startup failure must leave the normal authorized manual/RFID paths subject to their existing controls. See [hardware release gates](HARDWARE_RELEASE_REMEDIATION_PROPOSALS.md).

### Stage 6 vehicles and future monitoring

Separate vehicle presence, plate reading and access approval. Start with dwell and direction within a defined region and a cooldown per arrival, for example “Vehicle detected, check entrance”. A plate detector/OCR experiment needs a stable capture angle and clear plate detail by day and night. Store no plates by default. A car's make, color or plate cannot establish the driver or passenger's authority. The CP‑E31A may be suitable for the entrance demo without being suitable as a driveway or plate camera. Use an appropriately positioned source if evaluation shows inadequate detail.

Design a read-only event interface so future monitoring can subscribe without inheriting lock permissions. A later recording feature needs a separate consent and access model, event-only or continuous mode selection, retention, disk quotas, encrypted storage, deletion and clear UI indicators. Do not use future recording or classification events as new authorization paths by default.

## 4. Suggested code handoff

These are proposed locations. The implementation should adapt to the repository's actual modules when started.

| Part | Files or interfaces | Deliverable |
| --- | --- | --- |
| Capture | `server/camera/frame-source.js`, `fixture-source.js`, `rtsp-source.js` or equivalent | Fixture first, then verified camera adapter with bounded decode and health. |
| CPU vision | `server/camera/vision-worker.py`, `model-manifest.json` | Versioned local worker protocol and pinned assets. Return measurements and reasons through a constrained IPC channel, without shell interpolation or camera credentials in output. |
| Policy | `server/services/camera-access.js` and local migrations only when needed | Server-owned attempt evidence, ownership, expiry, revocation, dry-run outcomes and audit events. No command publisher in the worker. |
| Routes/UI | Local Security routes, `public/js/views.js` or a focused camera view module | Initial health and preview UI. Add check and confirm controls only after fixture acceptance, with explicit disabled and error states. |
| Tests | `server/tests/camera-source.test.js`, `camera-access.test.js`, isolated browser fixture | Deterministic fake frames, clocks and publisher spies. Add real-camera acceptance separately after access is available. |

## 5. Verification and handoff inputs

- **Compatibility:** actual firmware version, supported profile/codec and first-frame/reconnect behavior after power, Wi‑Fi and WAN interruptions. Inspect on the same LAN with the operator's approval. No camera admin account or secret is needed to start fixture code.
- **Safety:** invalid session or role, stale reauthentication, revoked enrollment, duplicate click, replayed outcome, stale or frozen stream, two faces, sensor/worker failure, hub restart, unavailable controller, pending command, persistence failure and relock during outage. Assert no publication for every denial. Run the real lock cases only in the supervised phase.
- **Quality and performance:** measure request-to-first-usable-frame, decode time, per-frame CPU inference, request-to-decision (median and p95), CPU/RAM and normal hub responsiveness when recognition is active. Use an initial usability target of p95 under two seconds from the first usable live frame to decision on the laptop, as a target rather than a claim. Record false matches, misses, inconclusive attempts and sample counts across realistic conditions and consenting participants. Report the limits of small trials rather than inferring a production error rate.
- **When the camera is available:** record model label, firmware, whether ezyKam+ shows ONVIF/RTSP or local/NVR access, the intended indoor or outdoor placement, approximate face/driveway distance and whether the laptop can reach the camera on the LAN. Enter any password only through the eventual local configuration. Do not share a device QR code, camera password, cloud account password or credential-bearing stream URL in chat.

The first implementation ticket is Stage 1: build the read-only frame source and dry-run fixture, then show a local camera status with no command publisher attached. This can proceed before hardware access and gives the next implementation agent a small piece to verify independently.
