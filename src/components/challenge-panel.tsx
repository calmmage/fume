import { useEffect, useId, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Fan,
  Hand,
  LockKeyhole,
  RotateCcw,
  RotateCw,
  Square,
  Trash2,
  X,
} from "lucide-react";
import type { ChallengeDef, ChallengeHud, ChallengeId, ChallengeToolKind } from "@/game/challenges";

const BUTTON =
  "flex h-11 items-center justify-center gap-2 rounded-[6px] px-3 font-sans text-xs transition-colors hover:bg-fg/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-default disabled:opacity-35";

export function ChallengeChoices({
  choices,
  completed,
  activeId,
  onChoose,
}: {
  choices: readonly ChallengeDef[];
  completed: readonly ChallengeId[];
  activeId: ChallengeId | null;
  onChoose: (id: ChallengeId) => void;
}) {
  return (
    <div className="divide-y divide-border">
      {choices.map((choice) => (
        <button
          key={choice.id}
          type="button"
          aria-label={`${choice.title}${completed.includes(choice.id) ? ", completed" : ""}`}
          aria-current={activeId === choice.id ? "true" : undefined}
          onClick={() => onChoose(choice.id)}
          className="group grid min-h-20 w-full grid-cols-[1fr_1.25rem] items-center gap-4 rounded-[6px] px-2 py-3 text-left hover:bg-fg/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
        >
          <span>
            <span className="block font-sans text-sm text-fg">{choice.title}</span>
            <span className="mt-1 block font-sans text-xs leading-5 text-fg/70">
              {choice.description}
            </span>
          </span>
          {completed.includes(choice.id) ? (
            <Check aria-hidden className="size-4 text-fg/70" />
          ) : (
            <ChevronRight aria-hidden className="size-4 text-fg/50 group-hover:text-fg" />
          )}
        </button>
      ))}
    </div>
  );
}

export function ChallengePicker({
  choices,
  completed,
  activeId,
  open,
  onOpenChange,
  onChoose,
  error,
}: {
  choices: readonly ChallengeDef[];
  completed: readonly ChallengeId[];
  activeId: ChallengeId | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (id: ChallengeId) => void;
  error: string | null;
}) {
  const headingId = useId();
  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Choose a smoke challenge"
          className={`${BUTTON} absolute top-[max(1rem,env(safe-area-inset-top))] right-[calc(max(1rem,env(safe-area-inset-right))+3.25rem)] z-30 border border-border bg-surface/70 text-fg backdrop-blur-sm`}
        >
          Challenges
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          aria-labelledby={headingId}
          className="z-50 max-h-[calc(100dvh-6rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain rounded-[6px] border border-border bg-surface/95 p-3 text-fg backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-2 pl-2">
            <h2 id={headingId} className="font-display text-xl">
              Follow the smoke
            </h2>
            <Popover.Close className={`${BUTTON} w-11 px-0`} aria-label="Close challenges">
              <X aria-hidden className="size-4" />
            </Popover.Close>
          </div>
          <p className="px-2 pb-3 font-sans text-xs leading-5 text-fg/70">
            Three small puzzles. Start wherever you like.
          </p>
          <ChallengeChoices
            choices={choices}
            completed={completed}
            activeId={activeId}
            onChoose={onChoose}
          />
          {error ? (
            <p role="alert" className="px-2 pt-3 font-sans text-xs leading-5 text-fg">
              {error}
            </p>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function toolLabel(kind: ChallengeHud["tools"][number]["kind"]) {
  return kind === "block"
    ? "Barrier"
    : kind === "candle"
      ? "Candle"
      : kind === "fan"
        ? "Fan"
        : kind;
}

function AngleInput({
  angle,
  disabled,
  onAngle,
}: {
  angle: number;
  disabled: boolean;
  onAngle: (angle: number) => void;
}) {
  const angleId = useId();
  const shownAngle = Math.round((((angle % 360) + 540) % 360) - 180);
  const [draft, setDraft] = useState(String(shownAngle));
  useEffect(() => setDraft(String(shownAngle)), [shownAngle]);
  const commit = () => {
    const parsed = Number(draft);
    if (draft.trim() && Number.isFinite(parsed)) {
      const bounded = Math.max(-180, Math.min(180, parsed));
      setDraft(String(bounded));
      if (bounded !== shownAngle) onAngle(bounded);
    } else {
      setDraft(String(shownAngle));
    }
  };
  return (
    <div className="relative min-w-0">
      <label htmlFor={angleId} className="sr-only">
        Selected tool angle in degrees
      </label>
      <input
        id={angleId}
        type="number"
        inputMode="numeric"
        min={-180}
        max={180}
        step={5}
        disabled={disabled}
        value={disabled ? "" : draft}
        placeholder="—"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(String(shownAngle));
            event.stopPropagation();
          }
        }}
        className="h-11 w-full rounded-[6px] border border-border bg-bg/50 pr-4 pl-2 text-center font-sans text-xs text-fg tabular-nums caret-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-35"
      />
      <span aria-hidden className="pointer-events-none absolute top-3 right-1 text-xs text-fg/60">
        °
      </span>
    </div>
  );
}

export function ChallengePanel({
  challenge,
  nextLabel,
  error,
  onLeave,
  onRetry,
  onNext,
  onTool,
  onSelect,
  onAngle,
  onRemove,
}: {
  challenge: ChallengeHud;
  nextLabel: string;
  error: string | null;
  onLeave: () => void;
  onRetry: () => void;
  onNext: () => void;
  onTool: (kind: ChallengeToolKind | null) => void;
  onSelect: (id: number | null) => void;
  onAngle: (degrees: number) => void;
  onRemove: () => void;
}) {
  const selectionId = useId();
  const selected = challenge.selected;
  const movable = selected !== null && !selected.fixed;
  const complete = challenge.status === "complete";
  const failure = error ?? challenge.error;
  const tools = challenge.tools;
  const settlingProgress =
    !challenge.probeReady || failure
      ? 0
      : complete
        ? 100
        : Number.isFinite(challenge.hold)
          ? Math.round(Math.max(0, Math.min(1, challenge.hold)) * 100)
          : 0;
  const message = failure
    ? failure
    : complete
      ? "The smoke found its way."
      : !challenge.probeReady
        ? "Preparing the smoke…"
        : settlingProgress > 0
          ? "Smoke is settling in the ring."
          : challenge.placement
            ? `${toolLabel(challenge.placement)} ready · tap the room to place it.`
            : selected?.fixed
              ? "This piece stays fixed. Your kit can move."
              : "Drag your tools to move them. Adjust their angle below.";

  return (
    <>
      <button
        type="button"
        onClick={onLeave}
        className={`${BUTTON} absolute top-[max(1rem,env(safe-area-inset-top))] left-[max(1rem,env(safe-area-inset-left))] z-30 border border-border bg-surface/70 text-fg backdrop-blur-sm`}
      >
        <ArrowLeft aria-hidden className="size-4" /> Playground
      </button>

      <section
        aria-label="Challenge objective"
        className="pointer-events-none absolute top-[calc(max(1rem,env(safe-area-inset-top))+3.75rem)] left-[max(1rem,env(safe-area-inset-left))] z-20 w-[calc(100%-2rem)] max-w-md font-sans"
      >
        <h2 className="font-display text-lg text-fg">{challenge.title}</h2>
        <p className="mt-1 text-sm leading-5 text-fg">{challenge.description}</p>
        <p className="mt-1 text-xs leading-4 text-fg/70">{challenge.hint}</p>
      </section>

      <section
        aria-label="Challenge tools"
        data-challenge-controls
        className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 px-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div
          data-challenge-feedback
          className="flex h-10 w-full max-w-[348px] flex-col items-center justify-center gap-1"
        >
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            data-challenge-status={complete ? "complete" : "running"}
            className="flex h-8 items-center justify-center gap-2 text-center font-sans text-xs leading-4 text-fg/80"
          >
            {complete && !failure ? <Check aria-hidden className="size-4 shrink-0" /> : null}
            <span>{message}</span>
          </p>
          <div
            role="progressbar"
            aria-label="Smoke settling in target"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={settlingProgress}
            aria-valuetext={
              complete && !failure
                ? "Target reached"
                : settlingProgress > 0
                  ? "Smoke is settling"
                  : "Waiting for steady smoke"
            }
            className="h-0.5 w-16 shrink-0 overflow-hidden bg-fg/20"
          >
            <div className="h-full bg-fg/70" style={{ width: `${settlingProgress}%` }} />
          </div>
        </div>

        <div className="pointer-events-auto w-full max-w-[348px] space-y-1 rounded-[6px] border border-border bg-surface/90 p-1.5 text-fg backdrop-blur-sm">
          <div data-challenge-kit className="grid h-11 grid-cols-3 gap-1">
            <button
              type="button"
              aria-pressed={challenge.placement === null}
              onClick={() => onTool(null)}
              className={`${BUTTON} ${challenge.placement === null ? "bg-fg text-bg hover:bg-fg/90" : "text-fg/75"}`}
            >
              <Hand aria-hidden className="size-4 shrink-0" /> Move
            </button>
            {(["fan", "block"] as const).map((kind) => {
              const item = challenge.kit.find((entry) => entry.kind === kind);
              const active = challenge.placement === kind;
              const Icon = kind === "fan" ? Fan : Square;
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={!item || item.remaining === 0}
                  aria-pressed={active}
                  aria-label={
                    item
                      ? `Place ${item.label.toLowerCase()}, ${item.remaining} remaining`
                      : `${toolLabel(kind)} not in this kit`
                  }
                  onClick={() => onTool(kind)}
                  className={`${BUTTON} ${active ? "bg-fg text-bg hover:bg-fg/90" : "text-fg/75"}`}
                >
                  <Icon aria-hidden className="size-4 shrink-0" />
                  <span className="text-left leading-4">
                    <span className="block">{toolLabel(kind)}</span>
                    <span className="block text-[10px] tabular-nums">
                      {item ? `${item.remaining} left` : "Not in kit"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            data-challenge-angle
            className="grid h-11 grid-cols-[minmax(0,1fr)_2.75rem_4.5rem_2.75rem] gap-1"
          >
            <label htmlFor={selectionId} className="sr-only">
              Select placed tool
            </label>
            <select
              id={selectionId}
              aria-label="Select placed tool"
              value={selected?.id ?? ""}
              onChange={(event) =>
                onSelect(event.target.value === "" ? null : Number(event.target.value))
              }
              className="h-11 min-w-0 rounded-[6px] border border-border bg-surface px-2 font-sans text-xs text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
            >
              <option value="">Select a tool</option>
              {tools.map((tool, index) => (
                <option key={tool.id} value={tool.id}>
                  {toolLabel(tool.kind)}{" "}
                  {
                    tools
                      .slice(0, index + 1)
                      .filter((entry) => entry.kind === tool.kind && entry.fixed === tool.fixed)
                      .length
                  }{" "}
                  · {tool.fixed ? "fixed" : "movable"}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-label="Rotate selected tool counterclockwise by 15 degrees"
              disabled={!movable}
              onClick={() => selected && onAngle(selected.angle - 15)}
              className={`${BUTTON} px-0`}
            >
              <RotateCcw aria-hidden className="size-4" />
            </button>
            <AngleInput
              key={selected?.id ?? "none"}
              angle={selected?.angle ?? 0}
              disabled={!movable}
              onAngle={onAngle}
            />
            <button
              type="button"
              aria-label="Rotate selected tool clockwise by 15 degrees"
              disabled={!movable}
              onClick={() => selected && onAngle(selected.angle + 15)}
              className={`${BUTTON} px-0`}
            >
              <RotateCw aria-hidden className="size-4" />
            </button>
          </div>

          <div data-challenge-actions className="grid h-11 grid-cols-3 gap-1">
            <button type="button" onClick={onRetry} className={BUTTON}>
              <RotateCcw aria-hidden className="size-3.5" /> Reset
            </button>
            <button type="button" onClick={onRemove} disabled={!movable} className={BUTTON}>
              <Trash2 aria-hidden className="size-3.5" /> Remove
            </button>
            <button type="button" onClick={onNext} disabled={!complete} className={BUTTON}>
              {nextLabel}
              <ChevronRight aria-hidden className="size-3.5 shrink-0" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

export function ChallengeOverlay({ challenge }: { challenge: ChallengeHud }) {
  const { screenTarget: target, viewport } = challenge;
  if (
    ![target.x, target.y, target.r, viewport.width, viewport.height].every(Number.isFinite) ||
    target.r <= 0
  )
    return null;
  return (
    <div
      aria-hidden
      data-challenge-overlay
      className="pointer-events-none absolute overflow-hidden"
      style={{
        left: viewport.x,
        top: viewport.y,
        width: viewport.width,
        height: viewport.height,
        zIndex: 10,
      }}
    >
      <div
        data-challenge-target
        className="absolute -translate-x-1/2 -translate-y-1/2 text-fg/80"
        style={{
          left: target.x - viewport.x,
          top: target.y - viewport.y,
          width: target.r * 2,
          height: target.r * 2,
        }}
      >
        <svg viewBox="0 0 100 100" className="size-full overflow-visible" fill="none">
          <circle
            cx="50"
            cy="50"
            r="49"
            stroke="currentColor"
            strokeWidth={challenge.status === "complete" ? 2 : 1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="absolute top-full left-1/2 mt-1.5 -translate-x-1/2 whitespace-nowrap font-sans text-[10px]">
          Target
        </span>
      </div>
      {challenge.tools.map((tool, index) => (
        <span
          key={tool.id}
          className="absolute flex items-center gap-1 whitespace-nowrap rounded-[3px] bg-bg/70 px-1 py-0.5 font-sans text-[10px] text-fg/80"
          style={{ left: tool.x - viewport.x + 16, top: tool.y - viewport.y + 14 }}
        >
          {tool.fixed ? <LockKeyhole className="size-2.5" /> : <Hand className="size-2.5" />}
          {tool.fixed
            ? "Fixed"
            : `${toolLabel(tool.kind)} ${challenge.tools.slice(0, index + 1).filter((entry) => entry.kind === tool.kind && !entry.fixed).length}`}
          {tool.selected && !tool.fixed ? <span className="size-1 rounded-full bg-fg" /> : null}
        </span>
      ))}
    </div>
  );
}
