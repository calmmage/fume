import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, X } from "lucide-react";
import { ROOM_STYLES, type LookState } from "@/game/look";
import { cn } from "@/lib/utils";

export function StylePicker({ look, onLook }: { look: LookState; onLook: (next: LookState) => void }) {
  const [open, setOpen] = useState(false);
  const selected = ROOM_STYLES.find((style) => style.id === look.roomStyle) ?? ROOM_STYLES[0];
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button type="button" aria-label={`Background style: ${selected.label}`} className="absolute top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-30 flex min-h-11 items-center gap-3 rounded-full border border-white/15 bg-black/65 px-4 font-sans text-xs text-white/85 backdrop-blur-md hover:bg-black/85">
          <span>{selected.label}</span><ChevronDown className="size-3.5" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={10} collisionPadding={16} className="z-50 max-h-[calc(100dvh-6rem)] w-[420px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-white/15 bg-[#101011]/95 p-4 text-white shadow-2xl backdrop-blur-xl">
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="font-display text-xl">Choose a world</h2><p className="mt-1 font-sans text-xs text-white/50">Same smoke. A different atmosphere.</p></div>
            <Popover.Close aria-label="Close background styles" className="flex size-11 items-center justify-center rounded-full hover:bg-white/10"><X className="size-4" /></Popover.Close>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {ROOM_STYLES.map((style) => (
              <button key={style.id} type="button" aria-label={`${style.label} background`} aria-pressed={look.room && style.id === look.roomStyle} onClick={() => { onLook({ ...look, room: true, roomStyle: style.id, pixel: false, grain: false }); setOpen(false); }} className={cn("group relative overflow-hidden rounded-xl border text-left transition-colors hover:border-white/60", style.id === look.roomStyle ? "border-white/80" : "border-white/10", style.id === "geometry" && "col-span-2")}>
                <img src={`/styles/${style.image}.webp`} alt="" className={cn("w-full object-cover", style.id === "geometry" ? "h-24" : "h-20")} />
                <div className="bg-black/30 px-3 py-2.5"><span className="block font-sans text-sm">{style.label}</span><span className="mt-0.5 block font-sans text-[11px] text-white/50">{style.detail}</span></div>
                {style.id === look.roomStyle && <Check className="absolute top-2 right-2 size-5 rounded-full bg-white p-1 text-black" />}
              </button>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
