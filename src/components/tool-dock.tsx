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

const SHORT_HINTS: Record<ToolKind, string> = {
  hand: "Drag tools or move the room",
  wand: "Hold to blow · tap bubbles to pop",
  candle: "Tap to place a candle",
  smoke: "Tap to place · drag to aim",
  fan: "Tap to place · drag to aim",
  block: "Drag to draw a barrier",
  vent: "Tap to place a smoke outlet",
  vortex: "Tap to place a spiral",
  fire: "Tap to place · drag to aim",
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
  const detailHint = coarse
    ? tool === "hand"
      ? "Tap bubbles to pop"
      : hasHeldDevice
        ? "Power toggles only the held tool"
        : "Release to stop blowing"
    : hasHeldDevice
      ? "Scroll moves room · Shift-scroll size · Alt-scroll adjusts"
      : "Scroll moves room · tap bubbles to pop";

  return (
    <div
      data-tool-dock
      className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <p
        data-tool-hint
        className="h-8 w-[298px] max-w-full overflow-hidden text-center font-sans text-xs leading-4 text-subtle sm:w-[538px]"
      >
        <span className="block truncate">
          {active.label}
          <span className="text-muted"> · {SHORT_HINTS[tool]}</span>
        </span>
        <span className="block truncate text-muted">{detailHint}</span>
      </p>
      <div
        data-tool-grid
        className="pointer-events-auto grid grid-cols-[repeat(6,2.75rem)] gap-1 rounded-[6px] border border-border bg-surface/80 p-1.5 backdrop-blur-sm sm:grid-cols-[repeat(11,2.75rem)]"
      >
        <button
          type="button"
          role="switch"
          aria-label="Held tool active"
          aria-checked={hasHeldDevice && heldToolActive}
          disabled={!hasHeldDevice}
          title={
            hasHeldDevice
              ? "Turn the tool at your pointer on or off. Click to place an active copy either way."
              : "Hand and Wand have no held device to switch on or off."
          }
          onClick={() => onHeldToolActive(!heldToolActive)}
          className={cn(
            "flex size-11 items-center justify-center rounded-[6px] transition-colors duration-150 disabled:opacity-30",
            hasHeldDevice && heldToolActive ? "bg-fg text-bg" : "text-muted enabled:hover:text-fg",
          )}
        >
          <Power className="size-4" />
        </button>
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
                "flex size-11 items-center justify-center rounded-[6px] transition-colors duration-150",
                selected ? "bg-fg text-bg" : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-4" />
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Clear placed tools"
          title="Clear placed tools"
          disabled={gadgetCount === 0}
          onClick={onClear}
          className="flex size-11 items-center justify-center rounded-[6px] text-muted transition-opacity duration-150 enabled:hover:text-fg disabled:opacity-30"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div data-tool-action className="h-11 w-36">
        <button
          type="button"
          aria-pressed={blowing}
          aria-hidden={tool !== "wand"}
          disabled={tool !== "wand"}
          tabIndex={tool === "wand" ? 0 : -1}
          className={cn(
            "h-11 w-full rounded-[6px] border font-sans text-sm font-medium backdrop-blur-sm transition-colors duration-150",
            tool === "wand" ? "pointer-events-auto" : "invisible pointer-events-none",
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
          Hold to blow
        </button>
      </div>
    </div>
  );
}
