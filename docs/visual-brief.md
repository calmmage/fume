# Fume: preserve the smoke, correct the atmosphere

## The visual authority

“That smoke simulation was perfect.”

“Textures/ final look are still cheap ugly shit. LET ME SHOW YOU AGAIN: THIS IS WHAT IT SHOULD FEEL LIKE!!!”

The attached [Fume reference](references/fume-visual-target.jpg) is the authority: an intimate, almost frontal charcoal paneled wall, pale light entering at the far left, deep quiet shadows, fine live smoke and restrained iridescent bubbles. Repeating a high-resolution tile down a deep box failed the composition even when the tile itself looked detailed. The background must give the smoke space.

## Required behavior

- Default: empty Geometry room, black surfaces, thin white edges, window outlines only.
- Five distinct backgrounds: Geometry, Pixel art, Cosmos, Stone, Wood. A visible image picker, available without opening the simulation lab.
- Candle selected on entry. Held effect enabled. Click places an active copy, even with the held effect disabled. No Follow/Pin mode split.
- “Dragging on touch pad should move the room by default … Right now it zooms the light”: ordinary two-axis wheel movement pans, regardless of the selected tool. Modified scrolling adjusts tools; Ctrl/Meta leaves native zoom alone.
- Keep the accepted rays: “Rays are amazing!”

## Implementation boundary

Keep the original fluid solver, presets, numerical defaults, smoke shading and frame timing from `1864ab7`. Changes to startup, held/placed devices and image pointer mapping are explicit, separately tested exceptions; they are not smoke retuning. `scripts/check-preserved-smoke.mjs` compares nineteen whole simulation files, remaining simulation code, the smoke helpers and the accepted light functions.

Geometry retains the original room projection. The other backgrounds use generated environment images with bounded camera translation and matching pointer/smoke translation. They are composed views, **not a reconstructed 3D room or calibrated PBR materials**. Full-resolution source material images remain in `docs/style-assets/originals`; do not call them measured albedo/normal/roughness maps. Geometry is drawn as crisp lines; its generated image is a picker preview only.

Generate the room art through Gemini on `msuorange`, using the explicitly authorized reference upload. Keep actual model labels, download dimensions, prompts and source files in [the provenance record](style-assets/provenance.json). Use the [image route guide](/Users/petrlavrov/calm/skills/library/automation/generate-cool-images/routes.md); no automatic Higgsfield detour.

Spatial points are fixed small marks at four depths, moved by the camera. No autonomous fog blobs. This is a visual reference, not a claim to prevent motion sickness.

## Top five fixes and verification

1. Tiled corridor composition → shallow, reference-based environment plates; inspect the complete app, not only the assets.
2. Similar/hidden styles → five distinct image cards directly on the canvas.
3. Wrong initial tool and confusing Pin switch → Candle, one held-effect toggle, click always places.
4. Trackpad changes the effect → ordinary scrolling moves the room; modifiers deliberately adjust devices.
5. Returning style breaks hydration / asset failure sticks forever → identical initial markup, load saved settings before game start, retry failed maps with bounded backoff and ignore stale results. Overscan keeps every visible canvas corner inside the smoke field; bounded framing prevents stretched image edges.

Walk through the same local URL on desktop and a 390×844 phone. Capture before/after, persistence, click placement, held-off behavior and scrolling. The original geometry projection's portrait device distortion remains a known limitation; image backgrounds use full-canvas aspect-correct placement. Hardware trackpad feel and frame-rate benchmarking require separate measurement.

## Saved contour reference

[Hairline, @speedy_devv](https://www.instagram.com/p/DeIQfJsz2vc/), underlying [Hairline by Lucas Marques](https://hairline.lucasmarkes.com). Local Jev index `ig:DeIQfJsz2vc`, `jev-1.13.0`, `repo_or_tool`, `namedrop`. The cached reel shows the contour terrain at 23.4 seconds. Retrieved offline; no Instagram account access. October 8 is the save-as-bot observation, not a proven save time.

## 12 October follow-up

Petr: “Make sound off by default”; “I think you broke the bubbles”. Start audio muted in both the UI and audio engine. Fix Geometry projection with one scale shared by X/Y, keeping bubble film, smoke and pointer hit testing aligned. The previous portrait-stretch limitation is resolved; solver, smoke parameters, dynamics and rays remain unchanged. Regression failed at 3.14:1 and now passes over 12 viewport/room combinations. Browser evidence is in the existing journey report.
