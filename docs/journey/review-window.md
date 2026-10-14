disposition: ship

14 October 2026 · source **9f25dd0** · narrow review of the detached baked window surround.

## persistence

Pass. Opened Petr's unmodified `window-jamb-rejected.png`, all eight actual textured captures **81–88**, and all three new back-wall maps. Dimensions match the named captures: desktop **1440×900**, phone **390×844**, Wood reference **664×640**. Reviewed the latest spatial note, source changes, measurement script, map sidecars and before/after receipts. No product code was changed by this review.

## fidelity

| Finding | Result |
| --- | --- |
| Detached bright back-wall surround | **Resolved.** It is absent in Wood/Stone/Pixel desktop and phone captures. Wood also remains clear at Petr's reference size and after pan. The back wall begins with dark paneling; the bright window belongs to the side wall. |
| MATERIAL — crop before filtering | **Resolved.** The loader fetches `*-back-wall.webp`, decodes that cropped image, then derives every mip from it. The removed strip is absent from the mip source, rather than hidden by a later UV offset. |
| Measurement and provenance | **Verified.** Independently reran the read-only check: Wood **419**, Stone **449**, Pixel **418**, all pass. Separate checks matched each sidecar's source SHA-256 and size, and every decoded crop pixel to its exact source rectangle. These reproduce the after receipt; the old 12% mapping begins at **330**, before every detected wall start. |
| TYPE / GROUND | **Preserved at this scope.** Existing controls and dark room field remain; the deleted bright strip is the intended local change. Inherited material quality and smoke appearance were not reassessed. |

The detector uses median arithmetic RGB brightness in a sampled row band, a strong edge threshold and sixteen dark columns. Its boundaries are specific to these artworks; neither the script nor its `excludedWindowPixels` flag independently recognizes every possible window. The exact decoded crops plus the actual textured captures establish this correction. Wood alone has supplied reference-size and after-pan captures; do not describe those as visual coverage of every style at every camera position.

## ceiling

Reached for this feature: one side-wall window, without the rejected detached bright surround on the back wall in the reviewed views.

## material_fixes

None for this correction. This local review does not establish deployment, physical trackpad comfort, frame rate or new owner acceptance.

## keep

Keep the measured maps and provenance, incumbent artwork, side-wall opening, room camera, approved rays, smoke solver/settings, bubbles and frame timing; no broader redesign follows from this verdict.
