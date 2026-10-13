# Optional smoke-routing challenges

Petr’s approved brief, 13 October 2026: “Keep FUME’s current playground as the default. Add three optional, untimed puzzles where players shape actual simulated smoke using a small supplied toolkit.”

“Use your kept preset, unchanged. Validate layouts against that preset; adjust puzzle geometry rather than smoke tuning.”

Open the local playground, choose **Challenges**, then choose any puzzle. A fixed candle emits the original simulated smoke. Place the supplied tools, move them and adjust their angles to guide visible smoke through the target. Reset provides a free retry; completion enables Next or Choose. Playground returns to the parked session. All three puzzles are available immediately, and completion marks use local storage without scores, timers or unlocks.

| Puzzle | Toolkit | Route |
| --- | --- | --- |
| Draft | One fan | Bend the plume upward and right. |
| Around the ledge | Two fans | Pass the end of the fixed horizontal ledge, then rise into the ring. |
| Make a passage | Two fans and one movable barrier | Route around the fixed vertical obstruction without choking the plume. |

Fixed tools have lock labels and cannot be moved, deleted or rotated. Movable tools can be dragged. The selected tool has 44px angle buttons and a degree input; keyboard Enter commits the typed angle. A placement preview is inactive until placed, and quantities are enforced by the controller. Three fixed control rows and a reserved feedback row prevent layout changes during placement, aiming, completion and retry.

## Simulation and completion

Challenges load the existing kept preset with `loadPreset()`. Each attempt clones its parameters and appearance into a separate World. Challenge input cannot write playground settings, select other tools or replace the scene. The playground keeps Candle and sound-off defaults.

The same renderer and GPU retain the complete original World, timing accumulator and Fluid buffers. Only the active session advances. Retry clears and reuses the challenge’s field; returning restores the original objects, ping-pong parity and seeded IDs before the first resumed step. Logical dimensions remain locked after challenge entry. Resizing letterboxes the retained domain and applies the same viewport to input, rendering and target labels.

The read-only probe uses the smoke shader’s bilinear sampling, maximum RGB density, blur, cutoff and opacity formula. A circular subset of a 16×16 sample grid reduces to 16 bytes. It polls at 10 Hz with one asynchronous read in flight, without awaiting in the animation loop. Ordinary playground mode performs no probe dispatch or readback. Attempt tokens discard late samples after retry or exit.

Initial success requires mean normalized opacity ≥12% and visible coverage ≥10%, continuously for 1.5 seconds. Each sample’s visible opacity is normalized against 0.10; coverage counts opacity ≥0.02. Empty smoke, faint traces, isolated dense pixels, dips and suspended-time gaps cannot complete. A small settling bar reports confirmed dwell; the success message appears only after actual detection.

Native validation, memory and internal error scopes check allocation and the first lazy uniform use. The pending field is withheld from presentation/probing. Allocation failure returns the original World, accumulator and GPU buffers, releases partial resources and shows a dismissible recovery message. First-use validation may encode candidate compute attempts before its asynchronous result; none are presented or probed, and none occur after rollback. A lost GPU device displays an explicit reload message. Ordinary pause/resume preserves the smoke; recovery after GPU device loss does not promise exact restoration.

## Layout validation

These reproducible routes use the unchanged canonical default/kept baseline. The runtime uses the owner’s current kept preset. Geometry was authored against the original fluid behavior; no solver, smoke shading, ray, numerical-default or frame-timing exceptions were added.

| Logical domain | Draft completes | Ledge completes | Passage completes |
| --- | --- | --- | --- |
| 1440×900 | 5.9 s | 4.6 s | 4.5 s |
| 390×844 | 4.0 s | 3.9 s | 4.8 s |

These are diagnostic simulation timestamps, not player timers. Each [calibration receipt](journey/calibration-draft-1440.json) stores exact normalized tool coordinates, angles, target geometry and actual completion-reducer output. The corresponding ledge, passage and phone receipts are beside it. `scripts/calibrate-challenges.mjs` steps the actual protected solver. Its full-field reads are diagnostic only and do not run in the app.

The [GPU receipt](journey/validation-challenge-gpu.json) checks real smoke density, circular sampling, read-only behavior and unchanged parked buffers: 5,734,400 bytes have identical before/after SHA-256. Probe-only measurements over 100 samples give p95 host submission 0.452 ms and p95 asynchronous result latency 0.996 ms. These are idle harness measurements, not a whole-app frame-rate benchmark; other applications were not controlled. Disabled measurement performs zero dispatches and reads.

## Reference and reusable skill

The design draws on Roger Boesch’s [Game Mechanics Compendium](https://www.rogerboesch.com/game-mechanics/), especially [Physics & Simulation](https://www.rogerboesch.com/game-mechanics/#phys), indirect control, route planning and teaching through layout. FUME’s puzzles and artwork are our own.

The complete page is preserved separately for personal reference in `/Users/petrlavrov/calm/skills/library/dev/game-mechanics/`: untouched source, offline derivative, all 269 mechanics, 21 categories and inline animations, searchable JSON and category references. Source SHA-256 is `fd9c22d87a24b2e7aa1aec16b38fdb80c76145e5da3ffc86fa8109d84145f99c`; capture date is 13 October 2026. The offline derivative keeps the original scripts and uses local font fallbacks without automatic network dependencies.

Skill-manager registered and deployed only **dev:game-mechanics**. A fresh independent agent discovered the native skill and used its references for an unrelated synthetic brief. Browser checks verified search, category filtering and running animations. The archive’s provenance and validation records retain this evidence. No compendium source is bundled into the application runtime.

## Delivery boundary

Source revisions: `1c40483` adds the challenges; `a0cda91` closes asynchronous allocation/probe failure paths. All 85 focused tests, typecheck, scoped lint, production compilation and preservation checks pass.

This is a local implementation with [desktop and phone walkthrough evidence](journey/index.html#challenges). Rendering and pointer flows are inspected locally; physical touch hardware and trackpad comfort are not claimed verified. No deployment, push or public release is part of this work.
