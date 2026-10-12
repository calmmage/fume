# Fume: preserve the smoke, correct the atmosphere

## The visual authority

“That smoke simulation was perfect.”

“Textures/ final look are still cheap ugly shit. LET ME SHOW YOU AGAIN: THIS IS WHAT IT SHOULD FEEL LIKE!!!”

The attached [Fume reference](references/fume-visual-target.jpg) is the authority: an intimate, almost frontal charcoal paneled wall, pale light entering at the far left, deep quiet shadows, fine live smoke and restrained iridescent bubbles. Repeating a high-resolution tile down a deep box failed the composition even when the tile itself looked detailed. The background must give the smoke space.

## Required behavior

- Default: furnished Geometry room drawn in fine white contours on black, following Petr's 12 October clarification below. Window panes remain black and outlined.
- Five distinct backgrounds: Geometry, Pixel art, Cosmos, Stone, Wood. A visible image picker, available without opening the simulation lab.
- Candle selected on entry. Held effect enabled. Click places an active copy, even with the held effect disabled. No Follow/Pin mode split.
- “Dragging on touch pad should move the room by default … Right now it zooms the light”: ordinary two-axis wheel movement pans, regardless of the selected tool. Modified scrolling adjusts tools; Ctrl/Meta leaves native zoom alone.
- Keep the accepted rays: “Rays are amazing!”

## Implementation boundary

Keep the original fluid solver, presets, numerical defaults, smoke shading and frame timing from `1864ab7`. Changes to startup, held/placed devices and image pointer mapping are explicit, separately tested exceptions; they are not smoke retuning. `scripts/check-preserved-smoke.mjs` compares eighteen whole simulation files, all tool defaults except the explicitly requested upright Fire pose, remaining simulation code, the smoke helpers and the accepted light functions.

Geometry projects an original furnished contour drawing, cached between camera or viewport changes. Its simulation plane retains the corrected isotropic projection. Cosmos now projects individual stars and galactic dust from continuous world-space depths, with native-resolution GPU sprites and depth-dependent camera movement. Pixel art, Stone and Wood use generated environment images with bounded camera translation and matching pointer/smoke translation. Those images are composed views, **not reconstructed 3D rooms or calibrated PBR materials**. Full-resolution source material images remain in `docs/style-assets/originals`; do not call them measured albedo/normal/roughness maps. The Geometry picker preview is generated from its actual contour drawing with `node scripts/render-contour-preview.mjs`.

Generate the room art through Gemini on `msuorange`, using the explicitly authorized reference upload. Keep actual model labels, download dimensions, prompts and source files in [the provenance record](style-assets/provenance.json). Use the [image route guide](/Users/petrlavrov/calm/skills/library/automation/generate-cool-images/routes.md); no automatic Higgsfield detour.

Spatial points are fixed small marks at four depths, moved by the camera. No autonomous fog blobs. This is a visual reference, not a claim to prevent motion sickness.

## 12 October: Cosmos, controls and Fire

Petr: “The cosmos scene is fucking FLAT!!!”; “AT LEAST … 8k!!! or 16 k!!”; “rounded rectangles with TIGHT corners and MATCH SIZE”; “the bottom panel CHANGES … LAYOUT”; “Why have title screen at all?”; “DO PROPER … FIRE!! AND WTF IT STARTS ON ITS SIDE?!”

Cosmos contains 14,000 seeded individual stars at continuous depths from 5 to 160 and 38,000 luminous dust points in folded galactic filaments. Near and far points move by different amounts, in the same direction as the preserved smoke plane. One instanced GPU pass draws the sky at the actual surface resolution; a stationary camera reuses it. The old low-resolution Cosmos photograph is no longer loaded by the renderer. The picker has a small preview of the new scene. The actual runtime shader also rendered a lossless [7680×4320 PNG](style-assets/generated/cosmos-native-8k.png) and a [WebP](style-assets/generated/cosmos-native-8k.webp); neither is a source bitmap stretched in the app. Reproduce with `node scripts/render-cosmos-preview.mjs /private/tmp/fume-cosmos-8k.png` on a GPU-enabled host.

The app opens directly into the simulation, muted with Candle selected and held effect on. New visitors retain Geometry as the default; returning visitors keep their chosen style. Tool, mute and Settings icons are 44×44 with 6px corners; the labeled style selector has the same height. The dock reserves the held switch, two hint lines and Wand action space for every tool, so selection and emission changes cannot reflow it. The unused Spatial points toggle is hidden while native Cosmos is shown.

Fire now starts at angle 0 rather than −π/2. Five animated tapered flame tongues, warm edges, hot cores, charred crossed logs and pulsing ember cells replace the old two-blob shape. Source dimensions, emission power and fluid integration remain unchanged. The full shader's Fire work exits early outside its local footprint.

Code `2a4204d`, local only. The independent review caught and corrected opposite camera movement before the final captures. Production compilation, typecheck, scoped lint, 37 focused tests and the smoke/ray preservation guard pass. The existing [journey](journey/index.html#cosmos-controls) records all five corrections, actual browser measurements and image provenance. No full frame-rate benchmark or photographic-fire claim is made.

## Top five fixes and verification

1. Tiled corridor composition → shallow, reference-based environment plates; inspect the complete app, not only the assets.
2. Similar/hidden styles → five distinct image cards directly on the canvas.
3. Wrong initial tool and confusing Pin switch → Candle, one held-effect toggle, click always places.
4. Trackpad changes the effect → ordinary scrolling moves the room; modifiers deliberately adjust devices.
5. Returning style breaks hydration / asset failure sticks forever → identical initial markup, load saved settings before game start, retry failed maps with bounded backoff and ignore stale results. Overscan keeps every visible canvas corner inside the smoke field; bounded framing prevents stretched image edges.

Walk through the same local URL on desktop and a 390×844 phone. Capture before/after, persistence, click placement, held-off behavior and scrolling. Geometry's former portrait distortion was fixed on 12 October. Hardware trackpad feel and frame-rate benchmarking require separate measurement.

## Saved contour reference

[Hairline, @speedy_devv](https://www.instagram.com/p/DeIQfJsz2vc/), underlying [Hairline by Lucas Marques](https://hairline.lucasmarkes.com). Local Jev index `ig:DeIQfJsz2vc`, `jev-1.13.0`, `repo_or_tool`, `namedrop`. The cached reel shows the contour terrain at 23.4 seconds. Retrieved offline; no Instagram account access. October 8 is the save-as-bot observation, not a proven save time.

## 12 October follow-up

Petr: “Make sound off by default”; “I think you broke the bubbles”. Start audio muted in both the UI and audio engine. Fix Geometry projection with one scale shared by X/Y, keeping bubble film, smoke and pointer hit testing aligned. The previous portrait-stretch limitation is resolved; solver, smoke parameters, dynamics and rays remain unchanged. Regression failed at 3.14:1 and now passes over 12 viewport/room combinations. Browser evidence is in the existing journey report.

## 12 October: furnished contour room

Petr: “What I meant: What you did:” with a furnished white-line interior beside the rejected empty wire box. This concrete reference corrects the earlier interpretation of “empty room / geometry”. The intended scene has a sofa, low table, TV/console, curved chaise, framed wall details and a plant. Use original geometry; the supplied reference and its attribution are evidence, not an asset to place in the simulation.

Top five for this correction, all implemented and pictured in the same journey report:

1. Empty box has no room identity → a recognizable furnished architectural composition.
2. Bare enclosure edges lack the reference's detail → fine outlines on cushions, the table, frames, console drawers, vessels and stems.
3. Background detail competes with smoke → black faces, outlined window panes, no material textures or new animated fog.
4. Desktop framing fails on phones → a narrower room arrangement with a landscape TV; confirm at 390×844 and 1440×900. The first inspection also moved the vases out from behind the chaise.
5. Picker artwork does not represent the actual scene → an SVG generated from the live contour model, fitted without cropping.

Verified locally at code revision `26efd61`: Begin, Candle selected, muted audio, placed Candle continues with held effect off, horizontal scroll moves room contours, Wood → Geometry switching, and the updated picker. 31 focused tests, typecheck, scoped lint, preservation guard and production build pass. Static frames reuse one room texture; resize releases the previous one. This is decorative perspective geometry, not new furniture collision bodies or a replacement fluid solver.
