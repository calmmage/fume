import {
  AirVent,
  CircleDot,
  CloudFog,
  Fan,
  Flame,
  FlameKindling,
  Hand,
  Power,
  Square,
  Trash2,
  Tornado,
} from "lucide-react";
import { TOOLS, type ToolKind } from "@/game/tools";
import { cn } from "@/lib/utils";

const ICONS: Record<ToolKind, typeof Flame> = {
  hand: Hand,
  wand: CircleDot,
  candle: Flame,
  smoke: CloudFog,
  fan: Fan,
  block: Square,
  vent: AirVent,
  vortex: Tornado,
  fire: FlameKindling,
};

const ADJUST_HINTS: Partial<Record<ToolKind, string>> = {
  candle: "Shift-scroll size",
  smoke: "Alt-scroll aim · Shift-scroll size · Alt+Shift-scroll stretch",
  fan: "Alt-scroll aim · Shift-scroll size · Alt+Shift-scroll stretch",
  block: "Shift-scroll thickness · Alt-scroll length · Alt+Shift-scroll shape",
  vent: "Shift-scroll size",
  vortex: "Alt-scroll spin · Shift-scroll size",
  fire: "Alt-scroll aim · Shift-scroll size · Alt+Shift-scroll stretch",
};

function toolHint(tool: ToolKind) {
  if (tool === "block") return "Drag to draw it";
  if (tool === "vortex") return "A spiral";
  return TOOLS.find((item) => item.id === tool)?.hint ?? "";
}

export function ToolDock({
  tool,
  heldToolActive,
  gadgetCount,
  blowing,
  coarse,
  onTool,
  onHeldToolActive,
  onClear,
  onBlow,
}: {
  tool: ToolKind;
  heldToolActive: boolean;
  gadgetCount: number;
  blowing: boolean;
  coarse: boolean;
  onTool: (t: ToolKind) => void;
  onHeldToolActive: (on: boolean) => void;
  onClear: () => void;
  onBlow: (on: boolean) => void;
}) {
  const active = TOOLS.find((t) => t.id === tool) ?? TOOLS[0];
  const hasHeldDevice = tool !== "hand" && tool !== "wand";
  const followHint =
    tool === "hand"
      ? "Drag a tool to move it · drag empty space to move the room · tap a circle to pop"
      : tool === "wand"
        ? coarse
          ? "Hold Blow · tap a circle"
          : toolHint(tool)
        : `Click to place · ${toolHint(tool)}`;
  const scrollHint = coarse ? "" : `Scroll moves the room${ADJUST_HINTS[tool] ? ` · ${ADJUST_HINTS[tool]}` : ""}`;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <p className="max-w-md px-3 text-center font-sans text-xs text-subtle">
        {active.label}
        <span className="text-muted"> · {followHint}</span>
        {scrollHint ? <span className="block text-muted">{scrollHint}</span> : null}
      </p>
      <div className="pointer-events-auto flex max-w-full flex-wrap justify-center items-center gap-1 rounded-2xl border border-border bg-surface/80 p-1.5 backdrop-blur-sm sm:flex-nowrap sm:gap-2 sm:rounded-pill">
        {hasHeldDevice ? (
          <button
            type="button"
            role="switch"
            aria-label="Held tool active"
            aria-checked={heldToolActive}
            title="Turn the tool at your pointer on or off. Click to place an active copy either way."
            onClick={() => onHeldToolActive(!heldToolActive)}
            className={cn(
              "flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full px-3 text-xs transition-colors duration-150",
              heldToolActive ? "bg-fg text-bg" : "text-muted hover:text-fg",
            )}
          >
            <Power className="size-4" />
            <span>Held tool {heldToolActive ? "on" : "off"}</span>
          </button>
        ) : null}
        {hasHeldDevice ? (
          <span className="hidden h-6 w-px shrink-0 bg-border sm:block" />
        ) : null}
        <div className="contents sm:flex sm:items-center sm:gap-0.5">
          {TOOLS.map((item) => {
            const Icon = ICONS[item.id];
            const selected = item.id === tool;
            return (
              <button
                key={item.id}
                type="button"
                title={`${item.id === "hand" ? "Drag placed tools or pan empty space" : item.id === "wand" ? toolHint(item.id) : `Click to place · ${toolHint(item.id)}`} · Scroll moves the room${ADJUST_HINTS[item.id] ? ` · ${ADJUST_HINTS[item.id]}` : ""}`}
                aria-label={item.label}
                aria-pressed={selected}
                onClick={() => onTool(item.id)}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
                  selected ? "bg-fg text-bg" : "text-muted hover:text-fg",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
        <span className="hidden h-6 w-px shrink-0 bg-border sm:block" />
        <button
          type="button"
          aria-label="Clear placed tools"
          title="Clear placed tools"
          disabled={gadgetCount === 0}
          onClick={onClear}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-opacity duration-150 hover:text-fg disabled:opacity-30"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      {tool === "wand" ? (
        <button
          type="button"
          className={cn(
            "pointer-events-auto min-h-11 min-w-36 rounded-full border px-7 font-sans text-sm font-medium backdrop-blur-sm transition-colors duration-150",
            blowing ? "border-fg/25 bg-fg/90 text-bg" : "border-border bg-surface/45 text-fg",
          )}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
            onBlow(true);
          }}
          onPointerUp={() => onBlow(false)}
          onPointerCancel={() => onBlow(false)}
          onKeyDown={(e) => {
            if (e.code !== "Space" && e.code !== "Enter") return;
            e.preventDefault();
            onBlow(true);
          }}
          onKeyUp={(e) => {
            if (e.code !== "Space" && e.code !== "Enter") return;
            e.preventDefault();
            onBlow(false);
          }}
          onBlur={() => onBlow(false)}
        >
          {blowing ? "Blowing" : "Hold to blow"}
        </button>
      ) : null}
    </div>
  );
}
