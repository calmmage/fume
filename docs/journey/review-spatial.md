disposition: fix

No PRODUCT.md, DESIGN.md, approved comp, QUALITY BAR card or new-world direction contract was supplied. The context loader permits this narrow refinement to use the incumbent implementation and the latest 13 October visual brief as authority; this review does not create a replacement world.

## persistence

Pass within the scoped existing system. Reviewed source revision **f8c9a14**, Petr's rejected screenshot, every named capture **67–77**, all three required reviewer viewport files, the additional Empty challenge capture **78**, the spatial implementation note, latest brief, source changes and validation receipt.

The required captures are now valid: desktop **1440×900**, phone **390×844**, and user **1406×1474**. The user-size PNG and WebP were independently measured and opened after replacement; the complete bottom viewport is present. Empty's black field is intentional and contains actual visible smoke and controls. The initial **1406×1410** user-size capture caused a `recapture` disposition; it was replaced before this binding review.

Nine narrow checks were independently rerun and passed: actual contour-camera agreement across desktop/phone and scroll limits, texture reuse/resize, default entry, hydration, valid saved-style persistence and recovery. The broader 88-test, typecheck, lint, build, 18-file preservation and native-GPU results are the supplied receipt, not reruns by this reviewer. The parent reports one detector pass with `[]` and complete raster provenance; no second detector ran.

This is a review of the local artifact. I had no browser and did not independently operate gestures, measure physical trackpad comfort or whole-app frame rate, or verify deployment. Still images alone do not prove anchored motion; the supplied actual-GPU measurements and inspected camera code provide that evidence.

## fidelity

| Element or promise | State | Evidence |
| --- | --- | --- |
| TYPE | match | Incumbent serif picker heading and small sans-serif controls remain in capture 73; this scope introduces no lettering or token change. |
| MATERIAL — room surfaces | match | Wood, Stone and Pixel retain their incumbent appearance maps, back-wall paneling and perspective surfaces; no material-art replacement is implied. |
| MATERIAL — Pixel glass/frame | contradicted | Capture 76 shows a baked diagonal bar running through the upper glass around y170–270, while the actual architectural mullion runs around y335. `windowMap` uses `pixel-room.webp`; its current UV crop includes the original framed window. The new height and width therefore leave two conflicting frame systems. |
| GROUND | match | Empty is black behind smoke/tools in 67 and 72; the other rooms retain their existing deep dark ground and material temperature. Black for Empty is explicitly authorized by the brief. |
| Directly selectable Empty | match | Empty is the first picker choice in 73 and visibly emits no room art, rays or ambient points in 67/72. Independently passing state/hydration tests support the fresh-visit default and retained valid returning style. |
| Wood and Stone wall-relative opening | match | 68/69, 74/75 and the corrected full-height 77 show a tall opening occupying most of the side wall. The small isolated window in Petr's rejection is removed. Glass and geometric framing read as one opening in these captures. |
| Shared room/dust camera | match | The inspected contour renderer and shader receive one camera/framing source. The independently passing drawn-corner test checks the actual contour projection. The supplied nearest-slice GPU diagnostic matches all 16 tracked pixels to the expected 39.81px camera displacement. Perspective parallax remains depth-dependent. |
| Dust continuity and shared limits | match | Dust remains visible across 70/71 and 68/69. The actual-GPU receipt retains 755–844 visible dust pixels at long pans and shows identical material-room frames at the limit after overscroll, with a changed frame on reverse. The fixed lattice contains no time-driven displacement or finite lateral edge. |
| Empty interaction instructions | contradicted | 67 and 72 still say “Scroll moves room”; the ToolDock detail hint supplies this text without checking Empty. There is no room in this state, and the Empty renderer uses direct smoke placement. The Hand label likewise retains “move the room.” |
| Incumbent tools and optional challenges | match | Existing dock/selector geometry remains visible. Capture 78 shows Draft in Empty, actual smoke through the target, completion feedback and enabled Next; the supplied receipt records return to the original Empty playground. This is scoped regression evidence, not a new full challenge review. |

## ceiling

The room's native depth, wall geometry and perspective framing are in use. The scoped finish is incomplete where Pixel's glass carries a second baked frame; one geometry-owned frame is the native device this mapping has not achieved. No broader material or Cosmos redesign follows from this finding.

## material_fixes

1. **Window-alignment promise:** change Pixel's glass sampling to a glass-only region of its incumbent `pixel-room.webp`, excluding the baked diagonal bar and frame edges, so the architectural opening and mullions supply the only frame. Preserve the artwork, pixel sampling and approved ray bodies. Verify with the actual Pixel texture in the recaptured phone, desktop and user-size views; the current white-glass diagnostic cannot detect this mismatch. Update the journey's alignment claim to reflect the resulting evidence.
2. **Empty clarity / craft-floor copy:** make the Empty dock hints omit “Scroll moves room” and the Hand action “move the room”; retain applicable tool instructions and the existing fixed layout and controls. Confirm the Empty hint on desktop and phone.

## keep

Keep the original solver/settings, smoke, bubble dynamics, approved ray bodies/frame timing, incumbent materials and room identity, optional challenges, quiet controls, smoke-only Empty, and the shared camera/lattice/limit behavior while applying only these two fixes.

---

## verdict

13 October 2026 · source **7da7b25** · scoring only the two material fixes above.

The same required viewport files were reopened and are valid at **1440×900**, **390×844** and **1406×1474**. Refreshed captures 67–77 show their named states; the additional actual-texture Pixel captures 79/80 are valid at desktop and user dimensions.

1. **Pixel frame alignment — resolved.** Refreshed 76, 79 and 80 show glass inside the enlarged opening with one architectural mullion system; the previously visible diagonal bar and inset frame are absent from the glass. The source now samples only pixels 11–63 by 6–160 of the same incumbent `pixel-room.webp`. This is judged from the actual textured captures, not the white-glass GPU fixture.
2. **Empty room instructions — resolved.** Refreshed 67/72 visibly omit “Scroll moves room” while retaining the two hint lines and existing dock footprint. The current source passes Empty's actual style into ToolDock and changes Hand's short hint and title to “Drag placed tools”; detail and tool titles omit room movement. The independently rerun named regression passes all 18 desktop/phone tool combinations and identical slot-class checks. The receipt additionally records ordinary-UI Hand, Wand and tooltip observations.

No regression introduced by these two corrections was observed in the corrected frame, hints or dock layout. This verdict does not open a new whole-surface review. The supplied 89-test, native-GPU, build and preservation receipts remain supplied evidence rather than independent reruns; no second detector ran. Physical gesture comfort, whole-app frame rate and deployment remain outside this pass.

## remaining

Clear for the two scored fixes. The earlier full-review findings are preserved above as history; both are resolved at **7da7b25**. `ship` here covers those fixes in the local artifact.

disposition: ship
