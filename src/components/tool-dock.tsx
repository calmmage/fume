import type { ReactNode } from "react";
import {
  AirVent,
  CircleDot,
  CloudFog,
  Fan,
  Flame,
  FlameKindling,
  Hand,
  MousePointer2,
  Pin,
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

export function ToolDock({
  tool,
  placeMode,
  gadgetCount,
  blowing,
  coarse,
  onTool,
  onPlaceMode,
  onClear,
  onBlow,
}: {
  tool: ToolKind;
  placeMode: boolean;
  gadgetCount: number;
  blowing: boolean;
  coarse: boolean;
  onTool: (t: ToolKind) => void;
  onPlaceMode: (on: boolean) => void;
  onClear: () => void;
  onBlow: (on: boolean) => void;
}) {
  const active = TOOLS.find((t) => t.id === tool) ?? TOOLS[0];
  const held = tool === "hand" || tool === "wand";
  const followHint =
    tool === "hand"
      ? active.hint
      : tool === "wand"
        ? coarse
          ? "Hold Blow · tap a circle"
          : active.hint
        : placeMode
          ? `Pin · ${active.hint}`
          : `Follows the pointer · ${active.hint}`;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <p className="max-w-md px-3 text-center font-sans text-xs text-subtle">
        {active.label}
        <span className="text-muted"> · {followHint}</span>
      </p>
      <div className="pointer-events-auto flex max-w-full items-center gap-2 overflow-x-auto overscroll-contain rounded-pill border border-border bg-surface/80 p-1.5 backdrop-blur-sm">
        {held ? null : (
          <div className="flex shrink-0 rounded-pill bg-bg/40 p-0.5">
            <ModeBtn
              label="Follow pointer"
              active={!placeMode}
              onClick={() => onPlaceMode(false)}
            >
              <MousePointer2 className="size-4" />
            </ModeBtn>
            <ModeBtn
              label="Place in the room"
              active={placeMode}
              onClick={() => onPlaceMode(true)}
            >
              <Pin className="size-4" />
            </ModeBtn>
          </div>
        )}
        {held ? null : <span className="hidden h-6 w-px shrink-0 bg-border sm:block" />}
        <div className="flex items-center gap-0.5">
          {TOOLS.map((item) => {
            const Icon = ICONS[item.id];
            const selected = item.id === tool;
            return (
              <button
                key={item.id}
                type="button"
                title={item.hint}
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
        >
          {blowing ? "Blowing" : "Hold to blow"}
        </button>
      ) : null}
    </div>
  );
}

function ModeBtn({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-full transition-colors duration-150",
        active ? "bg-fg text-bg" : "text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
