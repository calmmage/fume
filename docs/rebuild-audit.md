# What was misread, and what this version preserves

All [23 user messages](petr-messages.md) in the shared Grok conversation were read. Later corrections in the current chat override earlier exploratory requests.

| User's words | Misinterpretation | Current decision |
|---|---|---|
| “CURRENT SETTINGS SHOULD STAY WORKING AS IS … EXTEND” (#12); “That smoke simulation was perfect” (current chat) | Treating visual dissatisfaction as permission to retune the fluid, or replace the working engine. Our first rebuild repeated this mistake. | Original solver, presets, game timing and smoke shading preserved from `1864ab7`; only explicitly requested tool/startup behavior and image pointer mapping change. Rejected rebuild parked at `7908330`, not in this build. |
| “Soft glowing floating dots … across 3d space” (#21); Beat Saber / motion cues (current chat) | Large animated fog blobs, with unstable identities, instead of subtle depth references. | Small points with fixed world positions. Camera-driven parallax; separate Spatial points switch. No claim of preventing motion sickness. |
| “Room … scene … move together” (#21) | Screen overlays and drifting visual stripes that do not belong to the room. | Geometry retains the original projection. Generated image backgrounds, devices and smoke share bounded camera translation; spatial markers retain depth parallax. |
| “Rays are amazing!”; “Low poly textures … cheap” (latest correction) | Changing the already approved light to compensate for poor materials. | Freeze the approved ray functions. The first surface-map attempt was still rejected; replace the repeated corridor presentation with composed Nano Banana backgrounds based on the actual reference. |
| “Circles filled with smoke … textures [unimportant]” (#11) | Spending effort on optics while degrading smoke. | Film highlights are restrained; the actual enclosed smoke and its original behavior remain. Filled bubbles still look gray: they contain the original smoke field. |
| “FULL COPY … Then will switch if I like it” (#19) | Replacing the primary experience before the comparison was accepted. | Alternative engine is parked; no second GPU simulation runs beside the active preview. |
| “Layers is for woods.. did you delete them?” (#21) | Removing earlier options to make the latest experiment fit. | Keep the old woods/depth modes, palettes and scenes. The latest explicit background request supersedes Studio/Wireframe naming: Geometry is default, alongside Pixel art, Cosmos, Stone and Wood. Remove the inert Layers slider rather than pretend it works. |

## Later corrections that override the earlier pass

| User's words | What went wrong | Correction |
|---|---|---|
| “Textures/ final look are still cheap ugly shit … THIS IS WHAT IT SHOULD FEEL LIKE!!!” | Optimizing texture detail while keeping a deep tiled tunnel. That did not match the reference's close wall and subtle light. | Reference-conditioned shallow environment images; full composition reviewed in the app. These are image environments with gentle pan, not a new PBR renderer. |
| “ALL ASSETS GENERATED TOO!!! … EACH STYLE UNIQUE!!” | Generic surfaces and palette changes were passed off as different art directions. | Dedicated Nano Banana assets, originals and generation provenance. Geometry's runtime lines remain mathematical; its picker image is generated. |
| “Start with candle tool, not hand … Instead of 'pin' always allow to spawn by clicking” | Conflating placement with whether the pointer emits smoke. | Active held Candle on start; one held-effect switch; clicks place active devices independently. |
| “Dragging on touch pad should move the room by default” | Wheel movement changed depth/tool size, resembling zoomed light. | Ordinary two-axis scrolling pans for all tools. Shift/Alt provide deliberate tool adjustments. |
| “WE HAVE GEMINI API KEY / MIDJOURNEY VIA DISCORD … ALSO GEMINI PRO SUBSCRIPTION” / “msuorange has the subscription” | Choosing an unfunded aggregator and treating another Google account's Upgrade UI as proof of no subscription. | Verify the correct account and brokered API access. Document included browser generation, metered API/possible activated Cloud credits, native Codex, human Midjourney and fallbacks separately. |

The user explicitly authorized uploading the FUME reference to Gemini on msuorange after automatic approval review stopped the first attempt. No upload workaround was used.

## References

- Exact attached [Fume target](references/fume-visual-target.jpg): charcoal paneling, warm light, fine smoke and transparent films. The current real-time room is not a photorealistic match to this rendered still.
- Saved Instagram: [@speedy_devv / Hairline](https://www.instagram.com/p/DeIQfJsz2vc/), [official site](https://hairline.lucasmarkes.com), [source](https://github.com/lucasmarkes/hairline). Local Jev index `ig:DeIQfJsz2vc`, `jev-1.13.0`, repo_or_tool / namedrop. The cached reel shows the contour terrain at 23.4 seconds. Retrieved offline, without Instagram account access. Save-as-bot observation October 8; not proof of the exact save time.
- [Blender Made Easy glowing smoke video](https://www.youtube.com/watch?v=2Or8467vLoY): full available captions 00:00–14:34 read. Opposing blue/hot and pink/cold inflows, sealed domain, density-driven emission, wireframe box, stop/dissolve loop and fog glow. It uses 3D Mantaflow and Cycles. That optional experiment remains in the rejected/parked rebuild; it is not integrated into the preserved smoke version.

## Validation boundary

`node scripts/check-preserved-smoke.mjs` protects the original source and separately protects the rays approved in this chat. Typecheck, production build and the local browser walkthrough are recorded in [the report](journey/index.html).

No deployment, historic browser-only preset reconstruction, or measured frame-rate guarantee is claimed. The repository's inherited full test runner has export-template dependencies missing outside the app; it is not presented as green.
