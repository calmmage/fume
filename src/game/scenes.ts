import { createGadget, type Gadget } from "./tools";

export interface SceneDef {
  id: string;
  label: string;
  blurb: string;
}

export const SCENES: SceneDef[] = [
  { id: "shelf", label: "Shelf", blurb: "Candle under a ledge" },
  { id: "empty", label: "Empty", blurb: "Just air" },
  { id: "draft", label: "Draft", blurb: "A fan aimed at a vent" },
  { id: "whirl", label: "Whirl", blurb: "Two opposing spirals" },
  { id: "hearth", label: "Hearth", blurb: "Fire, a wall, a high vent" },
];

function placed(
  kind: Exclude<Gadget["kind"], never>,
  x: number,
  y: number,
  tune?: (g: Gadget) => void,
): Gadget {
  const g = createGadget(kind, x, y, false);
  g.on = true;
  tune?.(g);
  return g;
}

export function sceneGadgets(id: string, w: number, h: number): Gadget[] {
  switch (id) {
    case "empty":
      return [];
    case "draft":
      return [
        placed("fan", w * 0.28, h * 0.62, (g) => {
          g.angle = -0.2;
          g.power = 1.25;
        }),
        placed("vent", w * 0.74, h * 0.26, (g) => {
          g.w = 44;
          g.h = 44;
        }),
      ];
    case "whirl":
      return [
        placed("vortex", w * 0.36, h * 0.48, (g) => {
          g.power = 1.1;
        }),
        placed("vortex", w * 0.66, h * 0.4, (g) => {
          g.power = -1.1;
        }),
      ];
    case "hearth":
      return [
        placed("fire", w * 0.5, h * 0.8, (g) => {
          g.w = 70;
          g.h = 38;
        }),
        placed("block", w * 0.5, h * 0.64, (g) => {
          g.w = 190;
          g.h = 16;
        }),
        placed("candle", w * 0.22, h * 0.76),
        placed("vent", w * 0.84, h * 0.18, (g) => {
          g.w = 40;
          g.h = 40;
        }),
      ];
    case "shelf":
    default:
      return [
        placed("candle", w * 0.34, h * 0.78),
        placed("block", w * 0.34, h * 0.48, (g) => {
          g.w = 200;
          g.h = 22;
        }),
      ];
  }
}
