import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, X } from "lucide-react";
import { FumeGame, type HudSnapshot } from "@/game/fume-game";
import { paintLayerRoom } from "@/game/layer-room";
import {
  DEFAULT_PARAMS,
  loadParams,
  loadPreset,
  saveParams,
  savePreset,
  type SimParams,
} from "@/game/params";
import { DEFAULT_LOOK, loadLook, saveLook, type LookState } from "@/game/look";
import {
  CHALLENGES,
  readChallengeCompletions,
  saveChallengeCompletion,
  type ChallengeId,
} from "@/game/challenges";
import { ChallengeOverlay, ChallengePanel, ChallengePicker } from "@/components/challenge-panel";
import { SimPanel } from "@/components/sim-panel";
import { ToolDock } from "@/components/tool-dock";
import type { ToolKind } from "@/game/tools";

const EMPTY: HudSnapshot = {
  score: 0,
  best: 0,
  combo: 0,
  pops: 0,
  blowing: false,
  bubbleCount: 0,
  playing: true,
  floaters: [],
  width: 1,
  height: 1,
  glError: null,
  sessionNotice: null,
  tool: "candle",
  heldToolActive: true,
  gadgetCount: 0,
  challenge: null,
};

export function SessionNotice({
  notice,
  onDismiss,
}: {
  notice: string | null;
  onDismiss: () => void;
}) {
  if (notice === null) return null;
  return (
    <div
      data-session-notice
      className="absolute top-[calc(max(1rem,env(safe-area-inset-top))+3.75rem)] left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-start gap-2 rounded-[6px] border border-border bg-surface/95 p-2 pl-4 text-fg backdrop-blur-sm"
    >
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="min-w-0 flex-1 py-3 font-sans text-xs leading-5"
      >
        {notice}
      </p>
      <button
        type="button"
        aria-label="Dismiss message"
        onClick={onDismiss}
        className="flex size-11 shrink-0 items-center justify-center rounded-[6px] text-fg hover:bg-fg/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
      >
        <X aria-hidden className="size-4" />
      </button>
    </div>
  );
}

export function FumeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<FumeGame | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY);
  const [muted, setMuted] = useState(true);
  const [coarse, setCoarse] = useState(false);
  // Match the server markup first; the mount effect applies saved settings
  // before starting the game, without rendering browser-only state during hydration.
  const [params, setParams] = useState<SimParams>(() => ({ ...DEFAULT_PARAMS }));
  const [look, setLook] = useState<LookState>(() => ({ ...DEFAULT_LOOK }));
  const [sceneId, setSceneId] = useState("empty");
  const [challengesOpen, setChallengesOpen] = useState(false);
  const [completed, setCompleted] = useState<ChallengeId[]>([]);
  const recordedCompletions = useRef(new Set<ChallengeId>());
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const challenge = hud.challenge;
  const challengeId = challenge?.id;
  const challengeStatus = challenge?.status;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const next = loadParams();
    const lookNext = loadLook();
    setParams(next);
    setLook(lookNext);
    const savedCompletions = readChallengeCompletions();
    setCompleted(savedCompletions);
    recordedCompletions.current = new Set(savedCompletions);
    const game = new FumeGame(canvas, setHud);
    gameRef.current = game;
    game.setParams(next);
    game.setLook(lookNext);
    game.setMuted(true);
    game.setPlaying(true);
    game.start();
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches);
    const onMq = () => setCoarse(mq.matches);
    mq.addEventListener("change", onMq);
    return () => {
      mq.removeEventListener("change", onMq);
      game.destroy();
      gameRef.current = null;
    };
    // Game owns the canvas for the session; params stream in via setParams.
  }, []);

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const room = roomRef.current;
      const state = gameRef.current?.frameState();
      if (room && state?.look.pixel) {
        room.style.opacity = "1";
        paintLayerRoom(room, {
          palette: state.look.palette,
          cols: state.look.pixelCols,
          parallaxX: state.look.parallaxX,
          parallaxY: state.look.parallaxY,
          time: state.time,
        });
      } else if (room) {
        room.style.opacity = "0";
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    gameRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    if (!hud.sessionNotice) return;
    setChallengesOpen(false);
    setChallengeError(null);
  }, [hud.sessionNotice]);

  useEffect(() => {
    if (
      !challengeId ||
      challengeStatus !== "complete" ||
      recordedCompletions.current.has(challengeId)
    )
      return;
    recordedCompletions.current.add(challengeId);
    const persisted = saveChallengeCompletion(challengeId);
    setCompleted((previous) => [...new Set([...previous, ...persisted, challengeId])]);
  }, [challengeId, challengeStatus]);

  const onLook = (next: LookState) => {
    setLook(next);
    saveLook(next);
    gameRef.current?.setLook(next);
  };

  const onScene = (id: string) => {
    setSceneId(id);
    gameRef.current?.loadScene(id);
  };

  const onKeep = () => savePreset(params);

  const onParams = (next: SimParams) => {
    setParams(next);
    saveParams(next);
    gameRef.current?.setParams(next);
  };

  const onChallenge = (id: ChallengeId) => {
    const game = gameRef.current;
    if (!game?.enterChallenge(id, loadPreset())) {
      if (game?.getSessionNotice()) {
        setChallengesOpen(false);
        setChallengeError(null);
      } else {
        setChallengeError(
          "The smoke is still getting ready. Try this challenge again in a moment.",
        );
      }
      return;
    }
    setChallengeError(null);
    setChallengesOpen(false);
  };

  const onLeaveChallenge = () => {
    gameRef.current?.leaveChallenge();
    setChallengeError(null);
    setChallengesOpen(false);
  };

  const onRetryChallenge = () => {
    const game = gameRef.current;
    if (game?.retryChallenge()) {
      setChallengeError(null);
    } else if (game?.getSessionNotice()) {
      setChallengesOpen(false);
      setChallengeError(null);
    } else {
      setChallengeError(
        "This challenge could not restart. Return to the playground and try again.",
      );
    }
  };

  const nextChallenge = challenge
    ? CHALLENGES[CHALLENGES.findIndex((item) => item.id === challenge.id) + 1]
    : undefined;

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <canvas
        ref={roomRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full"
        style={{ imageRendering: "pixelated", opacity: 0 }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-[1] size-full touch-none"
        style={{ touchAction: "none" }}
        aria-label="Smoke lab canvas"
      />

      {hud.glError ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-[max(5.5rem,env(safe-area-inset-bottom))] z-30 flex justify-center px-6">
          <p className="max-w-md rounded-md border border-border bg-surface/90 px-4 py-3 text-center text-sm text-muted backdrop-blur-sm">
            {hud.glError}
          </p>
        </div>
      ) : null}

      <SessionNotice
        notice={hud.sessionNotice}
        onDismiss={() => gameRef.current?.dismissSessionNotice()}
      />

      {hud.floaters.map((f) => (
        <span
          key={f.id}
          className="fume-float-pts pointer-events-none absolute z-10 font-sans text-sm font-medium tabular-nums text-fg"
          style={{
            left: `${(f.x / hud.width) * 100}%`,
            top: `${(f.y / hud.height) * 100}%`,
            animation: "fume-float-pts 800ms var(--ease-out) forwards",
          }}
        >
          {f.text}
        </span>
      ))}

      {challenge ? <ChallengeOverlay challenge={challenge} /> : null}

      <ChallengePicker
        choices={CHALLENGES}
        completed={completed}
        activeId={challenge?.id ?? null}
        open={challengesOpen}
        onOpenChange={setChallengesOpen}
        onChoose={onChallenge}
        error={challengeError}
      />

      <button
        type="button"
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={() => setMuted((m) => !m)}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-30 flex size-11 items-center justify-center rounded-[6px] border border-border bg-surface/70 text-fg backdrop-blur-sm transition-opacity duration-150 hover:opacity-90"
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>

      {challenge ? (
        <ChallengePanel
          challenge={challenge}
          nextLabel={nextChallenge ? "Next" : "Choose"}
          error={challengeError}
          onLeave={onLeaveChallenge}
          onRetry={onRetryChallenge}
          onNext={() => (nextChallenge ? onChallenge(nextChallenge.id) : setChallengesOpen(true))}
          onTool={(kind) => gameRef.current?.selectChallengeTool(kind)}
          onSelect={(id) => gameRef.current?.selectChallengeGadget(id)}
          onAngle={(degrees) => gameRef.current?.setChallengeAngle(degrees)}
          onRemove={() => gameRef.current?.removeChallengeGadget()}
        />
      ) : (
        <>
          <ToolDock
            tool={hud.tool}
            heldToolActive={hud.heldToolActive}
            gadgetCount={hud.gadgetCount}
            blowing={hud.blowing}
            coarse={coarse}
            roomAvailable={look.roomStyle !== "empty"}
            onTool={(t: ToolKind) => gameRef.current?.setTool(t)}
            onHeldToolActive={(on) => gameRef.current?.setHeldToolActive(on)}
            onClear={() => gameRef.current?.clearPlaced()}
            onBlow={(on) => gameRef.current?.holdBlow(on)}
          />

          <SimPanel
            params={params}
            onChange={onParams}
            look={look}
            onLook={onLook}
            sceneId={sceneId}
            onScene={onScene}
            onKeep={onKeep}
            onResetView={() => gameRef.current?.resetView()}
          />
        </>
      )}
    </main>
  );
}
