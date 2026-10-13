# Empty background, room windows and anchored dust

Petr, 13 October 2026:

> Why don't we just have an empty background, just smoke?
>
> In all of the rooms, the background has a window full size but the room geometry has a window very small.
>
> They should be anchored to each other!! They are part of the same 3D space. The whole point was to anchor the room to the space.

Empty is the first background choice and the default for a fresh visitor. It displays the existing smoke and tools on black, without room artwork, dust, grain or light shafts. A returning visitor keeps a valid previously selected style. Empty persists like the other styles; changing a background never writes smoke settings. Pointer placement in Empty uses the full canvas directly, including after switching from a panned room.

Wood, Stone and Pixel use a tall opening sized relative to the actual wall height and room depth. The pane bounds, glass UVs, mullions and ray coordinates derive from that same opening. The existing generated textures are reused. The approved ray-function bodies remain unchanged; their caller maps the light into the corrected architectural opening.

The independent review caught a diagonal bar baked into Pixel's previous glass crop. Pixel now samples only pixels 11–63 by 6–160 of the same artwork, leaving the architectural mullions as its sole frame. Empty also omits room movement instructions from the dock and tooltips while keeping all controls and reserved layout slots.

The contour drawing and its dust now receive one camera position, framing and focal length. The previous dust camera moved linearly while the contour drawing used a bounded transform, and its clipping used an obsolete smaller room box. That made dust keep moving after the room stopped, then disappear. Dust identities now come from a stationary lateral lattice with no finite scrollable edge. Material-room dust uses that room's same camera and wall intersections. Near and distant objects retain perspective parallax, while camera direction, framing and stopping behavior remain shared.

The original fluid solver, numerical defaults, smoke-shading functions, bubbles and frame timing are preserved. A source guard still protects them; its only additional view exception is Empty's identity pointer mapping. The optional Challenges flow remains available.

## Verification

`scripts/check-spatial-view.mjs` renders the actual composite shader with isolated inputs on the native GPU. Before the fix, Geometry dust fell from 218 visible pixels to zero after long horizontal scrolling, the window occupied 21.75% of frame height, and Empty was missing. Afterward, the same long-scroll cases retain 755–844 visible pixels, the architectural opening spans 75.25% of frame height and 18.125% of width in Wood, Stone and Pixel, and Empty emits zero background pixels while still displaying actual fluid density.

Phone inspection also caught a remaining narrow opening; its width rose from 8.28% to 18.125% of the diagnostic frame, filling most of the 20% side wall.

A nearest-slice diagnostic tracks the shader's actual dust points across a camera move: all 16 sampled visible pixels follow the expected 39.81px architectural displacement. Material-room frames at the camera limit and after further scrolling are byte-identical; reversing changes them immediately. These measurements describe a fixed diagnostic viewport, not whole-app performance or physical trackpad comfort.

Focused tests cover camera agreement with the actual contour drawing, cached textures, Empty persistence and identity placement, material limits, bubbles, toolkit controls, challenge lifecycle and asynchronous probe failures. Desktop and phone captures and the final check receipt are linked from the existing [journey report](journey/index.html#anchored-room).
