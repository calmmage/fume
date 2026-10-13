# Challenges: design documentation outcome

13 October 2026. Final source revision `a0cda91`; earlier ordinary-flow captures are from `1c40483`, and the final desktop Draft completion is from `a0cda91`. **Ordinary extension; incumbent system preserved.** The [independent finish review](review-challenges.md) gives **ship for local review** for the optional Challenges feature, followed by the same disposition within the failure-recovery scope. This document records the source and evidence checked for design-system preservation; it does not claim deployment or Petr’s visual acceptance.

## Authority and scope

The approved direction is the 13 October section of [the visual brief](../visual-brief.md) and [the challenge implementation boundary](../challenges.md): keep the playground as the default and add three optional, untimed puzzles using actual simulated smoke and the unchanged kept preset. The dark room, serif headings, sans-serif controls, 44px targets and 6px control corners are inherited.

The Impeccable context loader found the incumbent visual implementation and no `PRODUCT.md`, `DESIGN.md` or registered surface brief. The approved documents above were read directly. The ordinary-extension rule in `reference/new-work.md` requires comparison with the incumbent system, preservation of its files and a report of the evidence checked. It explicitly reserves new token-bearing `DESIGN.md` and `.impeccable/design.json` for a new visual world or an approved durable system change.

This extension introduces neither. **No new global tokens, system rewrite, `DESIGN.md` or sidecar are owed.** The documentation write is confined to this file.

## Comparison with the incumbent

Checked [the global stylesheet](../../src/styles.css), [ToolDock](../../src/components/tool-dock.tsx), [SimPanel](../../src/components/sim-panel.tsx), [ChallengePanel and picker](../../src/components/challenge-panel.tsx), and [the app integration](../../src/components/fume-app.tsx). The working-tree comparison showed no changes to the global stylesheet, ToolDock or SimPanel.

| Element | Incumbent evidence | Challenge result |
| --- | --- | --- |
| Palette | Existing `bg`, `surface`, `fg` and `border` colors in the global stylesheet | Uses those same roles and opacity variants; adds no color primitive. |
| Type | `font-display` serif headings and `font-sans` controls | Picker and puzzle headings use the display family; instructions, controls and status use sans. |
| Control geometry | ToolDock and SimPanel use 44px controls with 6px corners | Challenge buttons, selector and degree input retain that geometry; picker choices exceed the minimum target height. |
| Selected state | Foreground fill with dark text in the tool dock | Move and placement selection use the same inversion. Disabled tools remain visible. |
| Surfaces | Translucent dark panels, fine borders and backdrop blur | Picker and challenge dock retain those treatments without introducing a card or elevation family. |
| Positioning | Existing controls account for safe-area insets | Playground, challenge entry and bottom tools reuse that positioning approach. |
| Feedback | Reserved hint/action space prevents the playground dock from shifting | Three fixed 44px challenge rows and a 40px feedback area preserve layout during placement, completion and reset. |

The target ring, fixed/movable labels, finite-kit quantities and settling bar belong to this puzzle interaction. The bar uses existing foreground colors, carries an accessible progress value, and reflects confirmed hold rather than elapsed play time. The 348px dock width and small annotation corners are local composition choices; they are not new system tokens.

`fume-app.tsx` retains direct playground entry and renders the challenge panel only while a challenge is active. Its challenge callbacks, completion marks and error messages remain within the approved optional flow. The picker exposes all three choices immediately.

Rechecked the later recovery change in `fume-app.tsx`: the exported `SessionNotice` uses the existing surface, foreground and border roles, sans-serif text, 6px corners and a 44×44 dismiss target. It sits below the header and announces recovery politely. Immediate failure branches read the runtime notice and close the picker; the notice-driven effect handles notices arriving later and clears stale guidance. Ordinary readiness failures keep their existing guidance. The runtime notice and dismiss methods were also checked in [FumeGame](../../src/game/fume-game.ts). This additional state preserves the incumbent identity and creates no global-token or design-scaffold obligation.

## Evidence inspected

Opened and visually inspected these actual local captures, rather than relying on filenames:

- [Desktop picker](img/53-challenges-picker-desktop.webp): three immediately available routes, serif heading and existing room/dock behind the picker.
- [Desktop Draft completion](img/55-draft-complete-desktop.webp): actual smoke, target, quiet success and three-row controls.
- [Phone Draft completion](img/56-draft-complete-phone.webp) and [phone reset](img/57-retry-phone.webp): the same control geometry, restored kit and disabled unavailable actions.
- [Phone playground before entry](img/58-park-phone.webp) and [after return](img/59-return-phone.webp): retained two-candle arrangement, Hand selection and Geometry room. These images show the visible arrangement; exact retained GPU state is supported by the receipt below.
- [Final phone movement and aiming](img/63-move-aim-phone.webp): the repositioned fan is selected and its degree input remains −37°. The validation receipt records the pointer movement and preserved angle; the screenshot shows its resulting state.
- [Final resized completion](img/64-resize-letterbox.webp): the retained portrait field is centered and letterboxed inside a valid 1440×900 capture, with its target, visible smoke and full controls. The quiet settling bar is visible beneath success.
- [Final desktop Passage completion](img/62-passage-complete-desktop.webp) and [three completion marks](img/65-completion-marks.webp): actual routed smoke, enabled Choose and all three completed choices. Passage's barrier annotation briefly overlaps the success copy at the placement shown in the first image; the second shows the barrier farther up with the same dock rows. This placement-dependent overlap is recorded without claiming a dock layout shift or expanding the accepted review scope.
- [Controlled recovery-notice layout](img/66-recovery-notice-phone.webp), source `a0cda91`: the actual exported component and production CSS render the supplied runtime memory-failure copy at 390×844. Wrapping is clear, with a 358×122 notice at (16, 76), a 44×44 dismiss target and no overflow recorded in the validation receipt. The caption explicitly identifies this as controlled layout proof with no live simulation; it is not an in-browser GPU fault or hardware memory-exhaustion capture.
- [Incumbent desktop](img/41-geometry-desktop.webp) and [incumbent phone](img/45-geometry-phone-smoke.webp): existing contour room and controls used as comparison evidence. These earlier captures include unused browser edge area and are not final challenge viewport evidence.

The ordinary-flow capture origin records identify local browser screenshots and their source files. The recovery proof has its separate controlled-render origin and explicit scope. These are evidence images, not generated artwork shipped in the simulation.

Read the [GPU probe receipt](validation-challenge-gpu.json): empty and invisible-density samples do not count, the circular target excludes square corners, disabled probing makes zero dispatches or reads, and 5,734,400 parked bytes retain the same before/after hash. The receipt records retained World/Fluid/buffer identity and parity through resize and retry, with no GPU errors. Its overhead values are probe-only measurements, not whole-app frame rate.

Rechecked that receipt after the allocation correction: native invalid-buffer and first-use validation failures, an injected OOM result and a partial synchronous failure release their candidate resources while preserving the parked bytes, parity and seeded IDs. Candidate dispatches after rollback are zero, failed probes produce zero successful samples, returned-playground draws make zero probe calls, and the final native/library GPU error arrays are empty. These separate native and controlled fault checks support rollback; they do not turn the notice-layout screenshot into a live browser fault or establish hardware memory exhaustion.

Read the [desktop Passage calibration](calibration-passage-1440.json) and [phone Passage calibration](calibration-passage-390.json). They record exact geometry and actual completion output at both logical sizes; these diagnostic timestamps are not player timers. The [journey section](index.html#challenges) records entry, aiming, completion, reset and return, plus the five corrected frictions.

Read the updated [final validation receipt](validation-challenges.json): 85 focused tests pass with no failures or skips at `a0cda91`; typecheck, scoped lint, production compilation and the original-smoke preservation guard each exit successfully. The recorded ordinary-flow measurements retain 44px rows, a 40px feedback reserve and stable phone/desktop row positions. The [initial five-section review](review-challenges.md) records 19 independently passing UI/session checks; its allocation/recovery supplement records 34 independently passing renderer, session, probe and UI checks with **ship for local review within the failure-recovery scope**. These are separate review passes, not counts of unique additional tests. Missing settling feedback and drag-induced angle changes were resolved before the initial final checks; the late recovery change was then rechecked in its own scope. These are read receipt results; this documentation pass did not rerun tests or operate the browser.

## Existing documentation gaps

There is no global token-bearing design document or Impeccable sidecar to compare for document drift. The context loader also does not discover the approved visual brief through registered surface metadata. These are existing documentation gaps, not permission to invent product identity or broaden this extension.

The global radius scale does not name the 6px corner value already used directly by ToolDock, SimPanel and the mute control. The challenge intentionally matches those incumbent controls. This pre-existing difference between the radius scale and control source remains documented here without a token migration or unrelated repair.

The updated validation receipt records 14 new report WebPs with origin text and tool-generated provenance sidecars and zero missing origin records, including the controlled recovery proof. The builder's earlier whole-incumbent scan counted 81 rasters and found 68 pre-existing files missing origin records; that inherited gap remains recorded in the final receipt. The old images remain unchanged, as the ordinary-extension rule requires. This documentation pass inspected captures and available origin records but did not rerun the raster audit.

The design-system documentation obligation is discharged at the scope of this ordinary extension, including the required recheck after the later recovery edit. Physical touch hardware, trackpad comfort, deployment and owner acceptance remain outside the evidence inspected in this pass.
