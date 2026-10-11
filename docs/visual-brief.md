# Fume: preserve the smoke, correct the atmosphere

## User's constraints

“That smoke simulation was perfect.”

“Old simulation dust particles implementation is REALLY bad.. I imagined something like what beat saber background ambience has … Like what iphone car motion cues thing does … And it created ugly amorphous blobs.”

The attached Fume image is the visual authority: a dark paneled room, soft left window light, fine smoke, transparent bubble films with restrained iridescence. See `references/fume-visual-target.jpg`.

## Implementation boundary

- Keep `fluid.ts`, simulation WGSL passes, `sim.ts`, `params.ts`, game timing, numerical defaults and saved smoke presets identical to baseline `1864ab7`.
- Keep `smoke_volume` and smoke compositing unchanged. Correct room material, light and dust presentation; bubble film highlights are appearance only.
- Points have fixed 3D positions, finite small screen footprints and camera-derived parallax. No autonomous wobble, Gaussian fog blobs or light-band animation.
- Reuse the current renderer. No second fluid engine, Three.js bundle or simultaneous GPU previews.
- Keep existing tools, woods, moods and stone-room option. The reference studio is the default presentation.

## Saved reference

`ig:DeIQfJsz2vc`, @speedy_devv, posted October 5; save-as-bot observation October 8, 2026 (not a proven save timestamp). Jev label `jev-1.13.0`, `repo_or_tool`, `namedrop`. Transcript: “It's called Hairline, isometric figures that move with your cursor.” Retrieved from the local index; no Instagram account access.

## Top five fixes to verify

1. Amorphous dust blobs → small, fixed spatial markers with an off switch.
2. Moving stripes → soft illumination from a fixed room window; Light off actually removes the shafts.
3. Flat beige window / cheap room → scanned charcoal wood, recessed glass and varied floor material; preserve the accepted rays exactly.
4. Overflowing phone controls / lost camera position → wrapped touch controls and Reset view.
5. Visual changes risking the loved smoke → exact source-preservation check and one live preview only.

Desktop and 390×844 phone screenshots, camera movement and pointer alignment must be checked before calling this complete. The reference is a still image; this pass does not claim photorealistic 3D volume rendering or a motion-sickness treatment.
