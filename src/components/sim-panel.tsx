import { useEffect, useId, useState, type ReactNode } from "react";
import * as Slider from "@radix-ui/react-slider";
import { Bookmark, Dices, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import {
  DEFAULT_PARAMS,
  formatParam,
  loadPreset,
  PARAM_FIELDS,
  PARAM_GROUPS,
  randomizeField,
  randomizeGroup,
  randomizeParams,
  type ParamField,
  type ParamGroup,
  type SimParams,
} from "@/game/params";
import { SCENES } from "@/game/scenes";
import type { LookState } from "@/game/look";
import { cn } from "@/lib/utils";

const FEEL: { key: keyof SimParams; label: string }[] = [
  { key: "buoyancy", label: "Rise" },
  { key: "smokeDecay", label: "Fade" },
  { key: "blowForce", label: "Blow" },
  { key: "vorticity", label: "Curl" },
];

export function SimPanel({
  params,
  onChange,
  look,
  onLook,
  sceneId,
  onScene,
  onKeep,
}: {
  params: SimParams;
  onChange: (next: SimParams) => void;
  look: LookState;
  onLook: (next: LookState) => void;
  sceneId: string;
  onScene: (id: string) => void;
  onKeep: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [fine, setFine] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const reset = () => onChange(loadPreset());
  const rollAll = () => onChange(randomizeParams(params));
  const rollGroup = (group: ParamGroup) => onChange(randomizeGroup(params, group));
  const rollFeel = () =>
    onChange(
      randomizeParams(
        params,
        FEEL.map((f) => f.key),
      ),
    );

  return (
    <>
      <button
        type="button"
        aria-label="Open simulation lab"
        aria-expanded={open}
        aria-hidden={open}
        tabIndex={open ? -1 : 0}
        onClick={() => setOpen(true)}
        className={cn(
          "absolute top-1/2 left-[max(1rem,env(safe-area-inset-left))] z-30 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/75 text-fg backdrop-blur-sm transition-opacity duration-200 ease-out hover:opacity-90 active:scale-[0.96]",
          open ? "pointer-events-none opacity-0" : "opacity-100",
        )}
      >
        <SlidersHorizontal className="size-4" />
      </button>

      <button
        type="button"
        aria-label="Close simulation lab"
        tabIndex={open ? 0 : -1}
        onClick={() => setOpen(false)}
        className={cn(
          "absolute inset-0 z-30 bg-bg/40 transition-opacity duration-200 ease-out md:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        data-open={open}
        inert={!open}
        className="fume-lab absolute top-0 left-0 z-40 flex h-dvh w-80 max-w-full flex-col border-r border-border bg-surface/90 pt-[max(0.75rem,env(safe-area-inset-top))] pr-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] backdrop-blur-md"
        aria-hidden={!open}
      >
        <header className="flex items-center justify-between gap-3 px-1 pb-3">
          <div>
            <p className="font-sans text-xs tracking-[0.22em] text-muted uppercase">Lab</p>
            <h2 className="mt-1 font-display text-lg tracking-tight text-fg italic">Room</h2>
          </div>
          <div className="flex items-center">
            <IconBtn label="Keep these parameters" onClick={onKeep} disabled={!open}>
              <Bookmark className="size-4" />
            </IconBtn>
            <IconBtn label="Randomize all parameters" onClick={rollAll} disabled={!open}>
              <Dices className="size-4" />
            </IconBtn>
            <IconBtn label="Reset parameters" onClick={reset} disabled={!open}>
              <RotateCcw className="size-4" />
            </IconBtn>
            <IconBtn label="Close lab" onClick={() => setOpen(false)} disabled={!open}>
              <X className="size-4" />
            </IconBtn>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 pb-4">
          {open ? (
            <>
              <section>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="font-sans text-xs tracking-[0.18em] text-subtle uppercase">Feel</p>
                  <IconBtn label="Randomize feel" onClick={rollFeel}>
                    <Dices className="size-3.5" />
                  </IconBtn>
                </div>
                <div className="flex flex-col gap-4">
                  {FEEL.map((feel) => {
                    const field = PARAM_FIELDS.find((f) => f.key === feel.key);
                    if (!field) return null;
                    return (
                      <ParamRow
                        key={feel.key}
                        field={{ ...field, label: feel.label }}
                        value={params[feel.key]}
                        onChange={(n) => onChange({ ...params, [feel.key]: n })}
                        onRandomize={() => onChange({ ...params, [feel.key]: randomizeField(field) })}
                      />
                    );
                  })}
                </div>
              </section>

              <section className="mt-6">
                <p className="mb-2 font-sans text-xs tracking-[0.18em] text-subtle uppercase">Scenes</p>
                <div className="flex flex-wrap gap-1.5">
                  {SCENES.map((scene) => (
                    <Chip
                      key={scene.id}
                      label={scene.blurb}
                      pressed={sceneId === scene.id}
                      onClick={() => onScene(scene.id)}
                    >
                      {scene.label}
                    </Chip>
                  ))}
                </div>
              </section>

              <section className="mt-6">
                <p className="mb-2 font-sans text-xs tracking-[0.18em] text-subtle uppercase">Room</p>
                <p className="mb-1.5 font-sans text-xs text-muted">Mood</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {(
                    [
                      ["ink", "Ink"],
                      ["dusk", "Dusk"],
                      ["blue", "Blue hour"],
                      ["ember", "Ember"],
                      ["mist", "Mist"],
                      ["violet", "Violet"],
                    ] as const
                  ).map(([id, label]) => (
                    <Chip
                      key={id}
                      pressed={look.palette === id}
                      onClick={() => onLook({ ...look, palette: id })}
                    >
                      {label}
                    </Chip>
                  ))}
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <Chip
                    pressed={look.room}
                    label="Stone corridor. Off returns the flat room, so the woods layers can show."
                    onClick={() => onLook({ ...look, room: !look.room })}
                  >
                    Room
                  </Chip>
                  <Chip pressed={look.grain} onClick={() => onLook({ ...look, grain: !look.grain })}>
                    Grain
                  </Chip>
                </div>
                {look.room ? (
                  <div className="mb-3 flex flex-col gap-2.5">
                    <Range
                      label="Layers"
                      min={6}
                      max={28}
                      step={1}
                      value={look.slices}
                      onChange={(n) => onLook({ ...look, slices: n })}
                    />
                    <Range
                      label="Depth"
                      min={1.6}
                      max={9}
                      step={0.1}
                      value={look.roomDepth}
                      onChange={(n) => onLook({ ...look, roomDepth: n })}
                    />
                    <Range
                      label="Scene"
                      min={0.12}
                      max={0.88}
                      step={0.01}
                      value={look.sceneZ}
                      onChange={(n) => onLook({ ...look, sceneZ: n })}
                    />
                    <Range
                      label="X"
                      min={0.2}
                      max={0.8}
                      step={0.01}
                      value={look.roomX}
                      onChange={(n) => onLook({ ...look, roomX: n })}
                    />
                    <Range
                      label="Y"
                      min={0.25}
                      max={0.75}
                      step={0.01}
                      value={look.roomY}
                      onChange={(n) => onLook({ ...look, roomY: n })}
                    />
                    <Range
                      label="Width"
                      min={0.35}
                      max={1.6}
                      step={0.01}
                      value={look.roomW}
                      onChange={(n) => onLook({ ...look, roomW: n })}
                    />
                    <Range
                      label="Height"
                      min={0.25}
                      max={1.2}
                      step={0.01}
                      value={look.roomH}
                      onChange={(n) => onLook({ ...look, roomH: n })}
                    />
                  </div>
                ) : (
                  <>
                    <p className="mb-1.5 font-sans text-xs text-muted">Depth</p>
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {(
                        [
                          ["off", "Flat"],
                          ["layers", "Layers"],
                          ["lines", "Lines"],
                          ["woods", "Woods"],
                        ] as const
                      ).map(([id, label]) => (
                        <Chip
                          key={id}
                          pressed={look.depth === id}
                          label={id === "woods" ? "Layered forest. Drag to slide the trees." : undefined}
                          onClick={() => onLook({ ...look, depth: id })}
                        >
                          {label}
                        </Chip>
                      ))}
                    </div>
                  </>
                )}
                <p className="mb-1.5 font-sans text-xs text-muted">Light</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {(
                    [
                      ["off", "Off"],
                      ["shafts", "Shafts"],
                      ["sun", "Sun"],
                    ] as const
                  ).map(([id, label]) => (
                    <Chip key={id} pressed={look.rays === id} onClick={() => onLook({ ...look, rays: id })}>
                      {label}
                    </Chip>
                  ))}
                </div>
              </section>

              <section className="mt-6">
                <button
                  type="button"
                  aria-expanded={fine}
                  onClick={() => setFine((v) => !v)}
                  className="font-sans text-xs tracking-[0.18em] text-subtle uppercase"
                >
                  {fine ? "Hide fine controls" : "Fine controls"}
                </button>
                {fine
                  ? PARAM_GROUPS.map((group) => (
                      <section key={group} className="mt-5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="font-sans text-xs tracking-[0.18em] text-subtle uppercase">{group}</p>
                          <IconBtn
                            label={`Randomize ${group.toLowerCase()} parameters`}
                            onClick={() => rollGroup(group)}
                          >
                            <Dices className="size-3.5" />
                          </IconBtn>
                        </div>
                        <div className="flex flex-col gap-4">
                          {PARAM_FIELDS.filter((f) => f.group === group).map((field) => (
                            <ParamRow
                              key={field.key}
                              field={field}
                              value={params[field.key] ?? DEFAULT_PARAMS[field.key]}
                              onChange={(n) => onChange({ ...params, [field.key]: n })}
                              onRandomize={() =>
                                onChange({ ...params, [field.key]: randomizeField(field) })
                              }
                            />
                          ))}
                        </div>
                      </section>
                    ))
                  : null}
              </section>
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function Range({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const shown = step >= 1 ? String(Math.round(value)) : value.toFixed(2);
  return (
    <label className="flex items-center gap-3 font-sans text-xs text-muted">
      <span className="w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 flex-1 accent-fg"
      />
      <span className="w-8 tabular-nums text-subtle">{shown}</span>
    </label>
  );
}

function Chip({
  pressed,
  onClick,
  label,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  label?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-3 font-sans text-xs",
        pressed ? "border-fg/30 bg-fg text-bg" : "border-border text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-opacity duration-150 hover:text-fg disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ParamRow({
  field,
  value,
  onChange,
  onRandomize,
  disabled = false,
}: {
  field: ParamField;
  value: number;
  onChange: (n: number) => void;
  onRandomize: () => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(() => formatParam(value, field.step));

  useEffect(() => {
    setText(formatParam(value, field.step));
  }, [value, field.step]);

  const commit = (raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      setText(formatParam(value, field.step));
      return;
    }
    const clamped = Math.min(field.max, Math.max(field.min, n));
    onChange(clamped);
    setText(formatParam(clamped, field.step));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="min-w-0 flex-1 font-sans text-xs text-muted">
          {field.label}
        </label>
        <div className="flex items-center">
          <button
            type="button"
            aria-label={`Randomize ${field.label}`}
            title={`Randomize ${field.label}`}
            disabled={disabled}
            onClick={onRandomize}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-subtle transition-opacity duration-150 hover:text-fg disabled:opacity-40"
          >
            <Dices className="size-3.5" />
          </button>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            disabled={disabled}
            min={field.min}
            max={field.max}
            step={field.step}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="h-8 w-16 rounded-sm border border-border bg-bg/50 px-2 text-right font-mono text-xs tabular-nums text-fg outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-fg/30"
          />
        </div>
      </div>
      <Slider.Root
        value={[value]}
        min={field.min}
        max={field.max}
        step={field.step}
        disabled={disabled}
        onValueChange={([n]) => {
          if (typeof n === "number") onChange(Number(formatParam(n, field.step)));
        }}
        className="relative flex h-11 w-full touch-none items-center select-none"
      >
        <Slider.Track className="relative h-1 w-full grow rounded-pill bg-fg/10">
          <Slider.Range className="absolute h-full rounded-pill bg-fg/55" />
        </Slider.Track>
        <Slider.Thumb
          aria-label={field.label}
          className="block size-4 rounded-full bg-fg outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-fg/30"
        />
      </Slider.Root>
    </div>
  );
}
