# What was misread, and what this version preserves

All [23 user messages](petr-messages.md) in the shared Grok conversation were read. Later corrections in the current chat override earlier exploratory requests.

| User's words | Misinterpretation | Current decision |
|---|---|---|
| “CURRENT SETTINGS SHOULD STAY WORKING AS IS … EXTEND” (#12); “That smoke simulation was perfect” (current chat) | Treating visual dissatisfaction as permission to retune the fluid, or replace the working engine. Our first rebuild repeated this mistake. | Original solver, presets, tools, game timing and smoke shading preserved exactly from `1864ab7`. Rejected rebuild parked at `7908330`, not in this build. |
| “Soft glowing floating dots … across 3d space” (#21); Beat Saber / motion cues (current chat) | Large animated fog blobs, with unstable identities, instead of subtle depth references. | Small points with fixed world positions. Camera-driven parallax; separate Spatial points switch. No claim of preventing motion sickness. |
| “Room … scene … move together” (#21) | Screen overlays and drifting visual stripes that do not belong to the room. | Keep the original shared projection; cast the room's window light in its world coordinates. |
| “Rays are amazing!”; “Low poly textures … cheap” (latest correction) | Changing the already approved light to compensate for poor materials. | Freeze the approved ray functions. Add scanned wood, moulding, recessed glass, an outdoor panorama and floor surface variation around them. |
| “Circles filled with smoke … textures [unimportant]” (#11) | Spending effort on optics while degrading smoke. | Film highlights are restrained; the actual enclosed smoke and its original behavior remain. Filled bubbles still look gray: they contain the original smoke field. |
| “FULL COPY … Then will switch if I like it” (#19) | Replacing the primary experience before the comparison was accepted. | Alternative engine is parked; no second GPU simulation runs beside the active preview. |
| “Layers is for woods.. did you delete them?” (#21) | Removing earlier options to make the latest experiment fit. | Stone, woods, palettes, scenes and existing controls remain available. Studio and wireframe are optional presentation choices. |

## References

- Exact attached [Fume target](references/fume-visual-target.jpg): charcoal paneling, warm light, fine smoke and transparent films. The current real-time room is not a photorealistic match to this rendered still.
- Saved Instagram: [@speedy_devv / Hairline](https://www.instagram.com/p/DeIQfJsz2vc/), [official site](https://hairline.lucasmarkes.com), [source](https://github.com/lucasmarkes/hairline). Local Jev index `ig:DeIQfJsz2vc`, `jev-1.13.0`, repo_or_tool / namedrop. The cached reel shows the contour terrain at 23.4 seconds. Retrieved offline, without Instagram account access. Save-as-bot observation October 8; not proof of the exact save time.
- [Blender Made Easy glowing smoke video](https://www.youtube.com/watch?v=2Or8467vLoY): full available captions 00:00–14:34 read. Opposing blue/hot and pink/cold inflows, sealed domain, density-driven emission, wireframe box, stop/dissolve loop and fog glow. It uses 3D Mantaflow and Cycles. That optional experiment remains in the rejected/parked rebuild; it is not integrated into the preserved smoke version.

## Validation boundary

`node scripts/check-preserved-smoke.mjs` protects the original source and separately protects the rays approved in this chat. Typecheck, production build and the local browser walkthrough are recorded in [the report](journey/index.html).

No deployment, historic browser-only preset reconstruction, or measured frame-rate guarantee is claimed. The repository's inherited full test runner has export-template dependencies missing outside the app; it is not presented as green.
