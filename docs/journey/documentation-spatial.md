# Spatial backgrounds: incumbent system comparison

13 October 2026 · product source `7da7b25` · local artifact

**Ordinary extension documentation complete.** The final build extends FUME's existing visual system with smoke-only Empty and corrects the room opening, dust projection and camera limits. The comparison below includes the later Pixel glass and Empty hint corrections. It establishes continuity with the incumbent system; it does not establish owner acceptance or deployment.

## Authority and write boundary

The latest **13 October: smoke-only Empty and one spatial camera** section of [the visual brief](../visual-brief.md) carries Petr's request and the five scoped frictions. The incumbent components, global styles, generated room artwork and original simulation remain the visual authority. No PRODUCT.md, DESIGN.md, approved comp or new-world direction contract exists in this packet.

Applied the ordinary-extension finish rule in Impeccable's `new-work.md` with `document.md` as the extraction reference: compare the finished surface with its incumbent system and preserve that system. This pass writes only this comparison. It creates no global design scaffold or sidecar, changes no tokens or source, and makes no independent identity choice.

## Finished build against the incumbent

Compared the relevant source changes from the pre-spatial revision `3e5a670` through `7da7b25`, including [FumeApp](../../src/components/fume-app.tsx), [ToolDock](../../src/components/tool-dock.tsx), [StylePicker](../../src/components/style-picker.tsx), [SimPanel](../../src/components/sim-panel.tsx), [look state](../../src/game/look.ts), [room camera](../../src/game/material-room.ts), [contour room](../../src/game/contour-room.ts), [renderer](../../src/game/renderer.ts), [material loader](../../src/game/materials.ts) and [composite shader](../../src/game/wgsl/composite.wgsl). Read the current [global styles](../../src/styles.css); they have no change in that comparison.

| Existing system | Final extension | Comparison evidence |
| --- | --- | --- |
| Restrained serif headings and small sans-serif controls | The six-choice picker uses the same heading, label and detail styles | Capture 73 and StylePicker retain the display/sans roles; no typography token changed. |
| Quiet dark surfaces, warm pale foreground and selected control fill | Empty adds an explicitly requested black canvas behind smoke and tools | Captures 67/72 retain the same selector, mute control, settings trigger and tool dock. Empty has no room art, ambient dots or shafts. |
| 44px tool targets with 6px corners, fixed hint/action slots | Empty removes inapplicable room instructions without changing those slots | ToolDock's two-line 32px hint reserve, grid classes and 44px action reserve are unchanged. The supplied regression covers all 18 desktop/phone tool combinations. |
| Direct image picker with rounded cards and selected check mark | Empty is first, with a black preview; all six choices share the two-column grid | Capture 73 shows Geometry still available with its real contour preview. Empty needs no invented image asset. |
| Furnished fine-line Geometry room | Its drawing receives the shared camera used by stationary dust | Captures 70/71 and the incumbent 41/45 retain the furniture, black faces and fine contours. The source difference delegates projection values without replacing the drawing. |
| Pixel, Stone and Wood appearance maps and perspective rooms | The opening becomes tall and wall-relative; glass, mullions and light use its bounds | Captures 68/74/75/76/77 retain the existing paneling and materials. The material-loader difference only skips texture requests for Empty; no material artwork is replaced. |
| Pixel's original artwork and discrete texture sampling | Glass samples the unframed region, leaving one architectural frame | Captures 76/79/80 show no former baked diagonal bar. The shader samples pixels 11–63 by 6–160 of the same 2752×1536 artwork and retains Pixel's texture-load sampling. |
| Actual simulated smoke, existing tools and optional puzzles | Empty keeps the fluid visible and supports the incumbent challenge flow | Captures 67/72 show visible smoke. Capture 78 shows Draft completion in Empty; this is scoped regression evidence for the retained flow. |

Empty's fresh-visit default follows the latest explicit request. Valid returning styles remain accepted by the saved-state loader. Its direct full-canvas placement is a view exception, rather than smoke retuning. SimPanel hides inapplicable room, grain, spatial-point and light controls for Empty while retaining the existing simulation controls.

The room camera supplies position, framing and focal length to the contour draw and background shader. The dust lattice is stationary in world coordinates, with four depth slices and no time-driven movement or finite lateral edge. Near and far points therefore retain different perspective displacement. “One camera” does not mean a flat screen offset or a new 3D fluid simulation. The material opening and its light mapping preserve the approved ray-function bodies, as recorded by the preservation receipt.

## Evidence actually inspected

Opened each capture below and checked its visible state. Independently measured the three required PNG dimensions and the final Empty/Pixel/user-size WebPs: desktop **1440×900**, phone **390×844**, supplied user viewport **1406×1474**. The complete lower viewport and dock are present in the tall captures.

- [Empty desktop, 67](img/67-empty-desktop.webp) and [phone, 72](img/72-empty-phone.webp): existing candle smoke on black, existing controls, and two hint lines without room movement copy.
- [Picker, 73](img/73-styles-phone.webp): directly selectable Empty and five retained backgrounds, with incumbent type, card treatment and selection mark.
- [Wood desktop, 68](img/68-wood-desktop.webp), [after pan, 69](img/69-wood-after-pan.webp), [phone, 74](img/74-wood-phone.webp) and [user viewport, 77](img/77-wood-user-width.webp): a tall perspective opening, existing walnut/pane artwork and retained room identity. The before/after pair shows changed framing; the motion measurements come from the receipt below.
- [Geometry before pan, 70](img/70-geometry-before-pan.webp) and [after pan, 71](img/71-geometry-after-pan.webp): furnished contours and visible points remain present after the named long pan.
- [Stone phone, 75](img/75-stone-phone.webp): incumbent dark marble appearance with the corrected opening.
- [Actual textured Pixel phone, 76](img/76-pixel-phone.webp), [desktop, 79](img/79-pixel-desktop.webp) and [user viewport, 80](img/80-pixel-user-width.webp): enlarged glass with one geometry-owned frame at every required size. The white-glass diagnostic cannot establish this texture correction.
- [Draft in Empty, 78](img/78-empty-challenge-phone.webp): actual smoke through the target, quiet completion feedback, selected fan angle −37° and enabled Next. Its origin identifies source `f8c9a14`; it was not recaptured after the two later fixes. The other named final captures identify `7da7b25`.
- Required reviewer files [desktop](../../.impeccable/review/desktop.png), [mobile](../../.impeccable/review/mobile.png) and [user-1406](../../.impeccable/review/user-1406.png): valid Wood views at the three measured sizes.
- [Petr's rejected window screenshot](../references/room-window-before.png): the supplied arrows point to the small opening and tall back-wall artwork. The report preserves it before the corrected captures, with an origin record distinguishing rejected evidence from the current build.
- Incumbent [Geometry desktop, 41](img/41-geometry-desktop.webp) and [phone, 45](img/45-geometry-phone-smoke.webp): the existing contour/control grammar used for comparison. Their unused browser edge area makes them historical comparison images, not final viewport proof.

Read the ordinary screenshot origin records, the [implementation boundary](../spatial-backgrounds.md), the [journey section](index.html#anchored-room), [validation receipt](validation-spatial.json) and [independent review](review-spatial.md).

The receipt records 89 focused tests passing without failures or skips, successful typecheck/scoped lint/production compilation, and an 18-file preservation guard protecting the original solver, numerical defaults, smoke shading, bubbles, ray-function bodies and frame timing. The additional view exceptions are Empty identity placement and Geometry's camera-only bounded pan/coast delegates. These are supplied check results; this documentation pass did not rerun them.

The native-GPU receipt reproduces the old zero-dust long-scroll failure. Corrected cases retain **755–844 visible pixels**; all **16** tracked nearest-slice pixels match the expected **39.81px** architectural displacement. Wood, Stone and Pixel diagnostic openings span **75.25%** of frame height and **18.125%** of frame width. Material-room frames at the camera limit remain byte-identical after more scrolling and change on reverse. Empty emits zero isolated background pixels while rendering actual fluid density; native validation reports no errors. These are fixed-input rendering diagnostics, not frame-rate or comfort measurements.

The final review says **ship for the two scored fixes in the local artifact**: Pixel frame alignment and Empty instructions are resolved. Its verdict is confined to those corrections, following the earlier full review; this comparison does not promote it into a new whole-surface approval. The builder's one detector result is `[]`; no second detector ran here. The supplied final provenance scan records 18 rasters, including the preserved user reference, and zero missing records. The report's phone/desktop check records all latest images loaded and no horizontal overflow; that verifies the report, not a broader UI audit.

## Existing gaps and limits

There is no token-bearing DESIGN.md or design sidecar to check for document drift. The unchanged global radius scale names 4/8/12/16/24px steps, while the incumbent tool, picker-trigger and mute controls use 6px directly. The extension follows those controls. This observed pre-existing token gap is recorded without a migration or unrelated repair.

Existing generated material appearance and baked lighting remain. This pass supplies no calibrated PBR claim, no physical touch/trackpad test, no whole-app FPS measurement, no deployment evidence and no owner acceptance. Documentation is complete for this ordinary local extension and its final two corrections; later product edits require a new comparison.
