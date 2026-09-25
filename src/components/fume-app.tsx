import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { FumeGame, type HudSnapshot } from "@/game/fume-game";
import { paintLayerRoom } from "@/game/layer-room";
import { loadParams, saveParams, savePreset, type SimParams } from "@/game/params";
import { loadLook, saveLook, type LookState } from "@/game/look";
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
  playing: false,
  floaters: [],
  width: 1,
  height: 1,
  glError: null,
  tool: "hand",
  placeMode: false,
  gadgetCount: 0,
};

export function FumeApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roomRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<FumeGame | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(EMPTY);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [params, setParams] = useState<SimParams>(loadParams);
  const [look, setLook] = useState<LookState>(loadLook);
  const [sceneId, setSceneId] = useState("shelf");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const next = loadParams();
    const lookNext = loadLook();
    setParams(next);
    setLook(lookNext);
    const game = new FumeGame(canvas, setHud);
    gameRef.current = game;
    game.setParams(next);
    game.setLook(lookNext);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    gameRef.current?.setPlaying(playing);
  }, [playing]);

  useEffect(() => {
    gameRef.current?.setMuted(muted);
  }, [muted]);

  const begin = () => {
    setPlaying(true);
    gameRef.current?.setPlaying(true);
  };

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

      {!playing ? <TitleScreen onBegin={begin} /> : null}

      <button
        type="button"
        aria-label={muted ? "Unmute" : "Mute"}
        onClick={() => setMuted((m) => !m)}
        className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-30 flex size-11 items-center justify-center rounded-full border border-border bg-surface/70 text-fg backdrop-blur-sm transition-opacity duration-150 hover:opacity-90"
      >
        {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </button>

      <ToolDock
        tool={hud.tool}
        placeMode={hud.placeMode}
        gadgetCount={hud.gadgetCount}
        blowing={hud.blowing}
        coarse={coarse}
        onTool={(t: ToolKind) => gameRef.current?.setTool(t)}
        onPlaceMode={(on) => gameRef.current?.setPlaceMode(on)}
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
      />
    </main>
  );
}

function TitleScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6 pb-36">
      <div className="flex max-w-lg flex-col items-center text-center">
        <p
          className="fume-rise font-sans text-xs tracking-[0.28em] text-muted uppercase"
          style={{ animation: "fume-rise 500ms var(--ease-out) both" }}
        >
          soap lab
        </p>
        <h1
          className="fume-rise mt-3 font-display text-3xl leading-tight tracking-tight text-fg italic"
          style={{ animation: "fume-rise 500ms var(--ease-out) 60ms both" }}
        >
          Fume
        </h1>
        <p
          className="fume-rise mt-5 max-w-sm font-sans text-sm leading-normal text-muted"
          style={{ animation: "fume-rise 500ms var(--ease-out) 110ms both" }}
        >
          Circles of smoke. Pop one and the smoke comes out. Drag a fan to aim it,
          draw a block, and let the plume slide around it.
        </p>
        <button
          type="button"
          className="fume-rise pointer-events-auto mt-8 min-h-11 rounded-full bg-fg px-8 py-3 font-sans text-sm font-medium text-bg transition-transform duration-150 ease-out hover:opacity-90 active:scale-[0.98]"
          style={{ animation: "fume-rise 500ms var(--ease-out) 180ms both" }}
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onBegin();
          }}
        >
          Begin
        </button>
      </div>
    </div>
  );
}


