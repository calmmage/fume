import { FumeAudio } from "./audio";
import type { Renderer } from "./renderer";
import {
  beginBlow,
  createWorld,
  endBlow,
  endGadgetDrag,
  beginGadgetDrag,
  hitBubble,
  movePointer,
  panRoom,
  pickGadget,
  screenToWorld,
  placeGadgetAt,
  popBubble,
  removeGadget,
  resizeWorld,
  rotateGadget,
  scaleGadget,
  stretchGadget,
  setHeldToolActive,
  setTool,
  setWorldParams,
  setWorldLook,
  applyScene,
  clearGadgets,
  tuneBlock,
  STEP,
  stepWorld,
  type Floater,
  type World,
} from "./sim";
import { clampParams, type SimParams } from "./params";
import type { LookState } from "./look";
import type { Gadget, ToolKind } from "./tools";
import {
  createChallengeSetup,
  getChallenge,
  remainingKit,
  emptyChallengeProgress,
  advanceChallengeProgress,
  TARGET_HOLD_SECONDS,
  VISIBLE_OPACITY,
  type ChallengeId,
  type ChallengeHud,
  type ChallengeSetup,
  type ChallengeProgress,
} from "./challenges";
import { sessionPoint, sessionPointer, sessionViewport } from "./session-view";
import type { ProbeSession } from "./smoke-probe";

interface ChallengeSession {
  setup: ChallengeSetup;
  progress: ChallengeProgress;
  selectedId: number | null;
  probeReady: boolean;
  error: string | null;
}

export interface HudSnapshot {
  score: number;
  best: number;
  combo: number;
  pops: number;
  blowing: boolean;
  bubbleCount: number;
  playing: boolean;
  floaters: Floater[];
  width: number;
  height: number;
  glError: string | null;
  tool: ToolKind;
  heldToolActive: boolean;
  gadgetCount: number;
  challenge: ChallengeHud | null;
}

export type HudListener = (s: HudSnapshot) => void;

export class FumeGame {
  private canvas: HTMLCanvasElement;
  private world: World;
  private renderer: Renderer | null = null;
  private audio = new FumeAudio();
  private raf = 0;
  private acc = 0;
  private last = 0;
  private running = false;
  private keys = new Set<string>();
  private blowPointer: number | null = null;
  private uiBlow = false;
  private panning = false;
  private panX = 0;
  private panY = 0;
  private panStamp = 0;
  private handTap = false;
  private tapX = 0;
  private tapY = 0;
  private onHud: HudListener;
  private lastHud = 0;
  glError: string | null = null;
  private disposed = false;
  private parked: { world: World; acc: number } | null = null;
  private challenge: ChallengeSession | null = null;
  private logicalSizeLocked = false;

  constructor(canvas: HTMLCanvasElement, onHud: HudListener) {
    this.canvas = canvas;
    this.onHud = onHud;
    const { w, h } = this.cssSize();
    this.world = createWorld(w, h);
    this.world.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.world.onPop = (b) => {
      this.audio.pop(b.r, (b.x / Math.max(1, this.world.w)) * 2 - 1);
    };
    this.bind();
    this.syncCursor();
    this.emitHud();
    this.expose();
    void this.boot();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.raf = requestAnimationFrame(this.frame);
  }

  setPlaying(playing: boolean) {
    this.world.playing = playing;
    if (playing) {
      this.audio.unlock();
      this.world.scoreArmed = this.world.time + 0.35;
    }
    this.emitHud();
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted);
  }

  setParams(params: SimParams) {
    if (this.challenge) return;
    setWorldParams(this.world, clampParams(params));
  }

  setLook(look: LookState) {
    setWorldLook(this.world, look);
    if (this.challenge && this.world.dragMode === "move")
      this.moveInputPointer(this.world.pointerX, this.world.pointerY);
  }

  resetView() {
    this.world.look.parallaxX = 0;
    this.world.look.parallaxY = 0;
    this.world.look.panVx = 0;
    this.world.look.panVy = 0;
    if (this.challenge && this.world.dragMode === "move")
      this.moveInputPointer(this.world.pointerX, this.world.pointerY);
  }

  loadScene(id: string) {
    if (this.challenge) return;
    applyScene(this.world, id);
    this.emitHud();
  }

  getParams(): SimParams {
    return this.world.params;
  }

  holdBlow(on: boolean) {
    if (this.challenge) return;
    this.uiBlow = on;
    this.applyBlow();
  }

  frameState() {
    const look = this.world.look;
    return { look, time: this.world.time };
  }

  setTool(tool: ToolKind) {
    if (
      this.challenge &&
      tool !== "hand" &&
      ((tool !== "fan" && tool !== "block") || !this.availableChallengeTool(tool))
    )
      return;
    setTool(this.world, tool);
    if (this.challenge) setHeldToolActive(this.world, false);
    this.panning = false;
    this.world.look.dragging = false;
    if (tool !== "wand") {
      this.uiBlow = false;
      this.blowPointer = null;
      this.applyBlow();
    }
    this.syncCursor();
    this.emitHud();
  }

  setHeldToolActive(active: boolean) {
    if (this.challenge) return;
    setHeldToolActive(this.world, active);
    this.emitHud();
  }

  clearPlaced() {
    if (this.challenge) return;
    clearGadgets(this.world);
    this.emitHud();
  }

  enterChallenge(id: ChallengeId, keptParams: SimParams): boolean {
    if (!this.renderer || this.disposed || this.glError) return false;
    let setup: ChallengeSetup;
    try {
      getChallenge(id);
      setup = createChallengeSetup(
        id,
        this.world.w,
        this.world.h,
        keptParams,
        this.world.look,
        this.world.reducedMotion,
      );
    } catch {
      return false;
    }
    const attempt: ChallengeSession = {
      setup,
      progress: emptyChallengeProgress(),
      selectedId: null,
      probeReady: false,
      error: null,
    };
    const probe = this.challengeProbe(attempt);
    const replacing = this.challenge !== null;
    const entered = replacing
      ? this.renderer.replaceSession(setup.world, probe)
      : this.renderer.enterSession(setup.world, probe);
    if (!entered) {
      if (replacing) this.leaveChallenge();
      return false;
    }
    this.onBlur();
    if (!this.parked) this.parked = { world: this.world, acc: this.acc };
    this.world = setup.world;
    this.challenge = attempt;
    this.logicalSizeLocked = true;
    this.acc = 0;
    this.last = performance.now();
    this.syncCursor();
    this.emitHud();
    return true;
  }

  retryChallenge(): boolean {
    if (!this.challenge) return false;
    return this.enterChallenge(
      this.challenge.setup.definition.id,
      this.challenge.setup.world.params,
    );
  }

  leaveChallenge(): void {
    if (!this.parked) return;
    this.onBlur();
    this.renderer?.restoreSession();
    this.world = this.parked.world;
    this.acc = this.parked.acc;
    this.parked = null;
    this.challenge = null;
    this.last = performance.now();
    this.syncCursor();
    this.emitHud();
  }

  selectChallengeTool(kind: "fan" | "block" | null): void {
    if (!this.challenge) return;
    if (kind && !this.availableChallengeTool(kind)) return;
    this.challenge.selectedId = null;
    this.setTool(kind ?? "hand");
  }

  selectChallengeGadget(id: number | null): void {
    if (!this.challenge) return;
    const gadget = this.world.gadgets.find((g) => !g.bound && g.id === id);
    this.challenge.selectedId = gadget?.id ?? null;
    this.setTool("hand");
  }

  setChallengeAngle(degrees: number): void {
    const gadget = this.selectedChallengeGadget();
    if (!gadget || !this.canEditGadget(gadget) || !Number.isFinite(degrees)) return;
    rotateGadget(this.world, gadget, (degrees * Math.PI) / 180 - gadget.angle);
    this.emitHud();
  }

  removeChallengeGadget(): void {
    const gadget = this.selectedChallengeGadget();
    if (!gadget || !this.canEditGadget(gadget)) return;
    removeGadget(this.world, gadget);
    if (this.challenge) this.challenge.selectedId = null;
    this.emitHud();
  }

  private availableChallengeTool(kind: "fan" | "block") {
    return (
      this.challenge &&
      remainingKit(this.world, this.challenge.setup).some(
        (item) => item.kind === kind && item.remaining > 0,
      )
    );
  }

  private selectedChallengeGadget() {
    return this.world.gadgets.find((g) => !g.bound && g.id === this.challenge?.selectedId);
  }

  private canEditGadget(gadget: Gadget) {
    return !this.challenge || !this.challenge.setup.fixedIds.has(gadget.id);
  }

  private placeAt(x: number, y: number) {
    const kind = this.world.tool;
    if (
      this.challenge &&
      ((kind !== "fan" && kind !== "block") || !this.availableChallengeTool(kind))
    )
      return null;
    const gadget = placeGadgetAt(this.world, x, y);
    if (gadget && this.challenge) this.challenge.selectedId = gadget.id;
    return gadget;
  }

  private finishChallengePlacement() {
    const kind = this.world.tool;
    if (
      this.challenge &&
      (kind === "fan" || kind === "block") &&
      !this.availableChallengeTool(kind)
    )
      this.setTool("hand");
  }

  private challengeProbe(attempt: ChallengeSession): ProbeSession {
    return {
      target: { ...attempt.setup.target, visibleOpacity: VISIBLE_OPACITY },
      onSample: (sample) => {
        if (this.disposed || this.challenge !== attempt || attempt.error || this.glError) return;
        attempt.probeReady = true;
        attempt.progress = advanceChallengeProgress(attempt.progress, sample);
        this.emitHud();
      },
      onError: (message) => {
        if (this.disposed || this.challenge !== attempt) return;
        attempt.error = `Smoke measurement unavailable: ${message}`;
        this.emitHud();
      },
    };
  }

  private challengeHud(): ChallengeHud | null {
    const challenge = this.challenge;
    if (!challenge) return null;
    const { setup, progress } = challenge;
    const viewport = this.viewport();
    const selected = this.selectedChallengeGadget();
    const angle = (g: Gadget) => ((((g.angle * 180) / Math.PI) % 360) + 360) % 360;
    const error = challenge.error ?? this.glError;
    return {
      id: setup.definition.id,
      title: setup.definition.title,
      description: setup.definition.description,
      hint: setup.definition.hint,
      status: error ? "error" : progress.complete ? "complete" : "running",
      fill: progress.fill,
      coverage: progress.coverage,
      hold: progress.heldSeconds / TARGET_HOLD_SECONDS,
      probeReady: challenge.probeReady,
      error,
      kit: remainingKit(this.world, setup),
      placement: this.world.tool === "fan" || this.world.tool === "block" ? this.world.tool : null,
      selected: selected
        ? {
            id: selected.id,
            kind: selected.kind,
            angle: angle(selected),
            fixed: setup.fixedIds.has(selected.id),
          }
        : null,
      tools: this.world.gadgets
        .filter((g) => !g.bound)
        .map((g) => ({
          id: g.id,
          kind: g.kind,
          angle: angle(g),
          fixed: setup.fixedIds.has(g.id),
          selected: selected?.id === g.id,
          ...sessionPoint(this.world, viewport, g),
        })),
      screenTarget: sessionPoint(this.world, viewport, setup.target),
      viewport,
    };
  }

  destroy() {
    this.disposed = true;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.audio.dispose();
    this.renderer?.dispose();
    delete window.__fume;
  }

  private async boot() {
    try {
      const { Renderer } = await import("./renderer");
      if (this.disposed) return;
      const renderer = await Renderer.create(this.canvas, (message) => {
        if (this.disposed) return;
        console.error("[fume gpu]", message);
        this.glError = friendlyGpuError(message);
        this.emitHud();
      });
      if (this.disposed) {
        renderer.dispose();
        return;
      }
      const { w, h } = this.cssSize();
      renderer.resize(w, h, Math.min(2, window.devicePixelRatio || 1));
      this.renderer = renderer;
      this.glError = null;
      this.emitHud();
    } catch (err) {
      if (this.disposed) return;
      const message = err instanceof Error ? err.message : "WebGPU unavailable";
      const friendly = friendlyGpuError(message);
      if (!isMissingGpu(message)) console.error("[fume boot]", err);
      this.glError = friendly;
      this.emitHud();
    }
  }

  private frame = (now: number) => {
    if (!this.running) return;
    const raw = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += raw;
    this.applyBlow();

    let steps = 0;
    while (this.acc >= STEP && steps < 5) {
      stepWorld(this.world, STEP);
      this.acc -= STEP;
      steps += 1;
    }
    const alpha = this.acc / STEP;
    try {
      this.renderer?.draw(this.world, alpha, raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[fume draw]", err);
      this.glError = friendlyGpuError(message);
      this.renderer?.dispose();
      this.renderer = null;
      this.emitHud();
    }
    if (now - this.lastHud > 80) {
      this.emitHud();
      this.lastHud = now;
    }
    this.raf = requestAnimationFrame(this.frame);
  };

  private cssSize() {
    const rect = this.canvas.getBoundingClientRect();
    return {
      w: Math.max(1, rect.width || window.innerWidth),
      h: Math.max(1, rect.height || window.innerHeight),
    };
  }

  private resize = () => {
    const { w, h } = this.cssSize();
    if (!this.logicalSizeLocked) resizeWorld(this.world, w, h);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer?.resize(w, h, dpr);
    this.emitHud();
  };

  private viewport() {
    const { w, h } = this.cssSize();
    return sessionViewport(w, h, this.world.w, this.world.h);
  }

  private toLocal(e: { clientX: number; clientY: number }) {
    const rect = this.canvas.getBoundingClientRect();
    return sessionPointer(
      this.viewport(),
      this.world.w,
      this.world.h,
      e.clientX - rect.left,
      e.clientY - rect.top,
    );
  }

  private onPointerDown = (e: PointerEvent) => {
    this.audio.unlock();
    const s = this.toLocal(e);
    if (!s.inside) return;
    this.moveInputPointer(s.x, s.y);
    const p = screenToWorld(this.world, s.x, s.y);
    const right = e.button === 2 || e.ctrlKey || e.metaKey;
    const gadget = pickGadget(this.world, p.x, p.y);
    if (right) {
      if (gadget && this.canEditGadget(gadget)) {
        removeGadget(this.world, gadget);
        if (this.challenge?.selectedId === gadget.id) this.challenge.selectedId = null;
        this.emitHud();
      }
      return;
    }
    if (this.world.tool === "hand") {
      if (gadget) {
        if (this.challenge) {
          this.challenge.selectedId = gadget.id;
          this.emitHud();
        }
      }
      if (gadget && this.canEditGadget(gadget)) {
        beginGadgetDrag(this.world, gadget, p.x, p.y, "move");
        if (this.challenge) this.world.look.dragging = true;
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      this.panning = true;
      this.handTap = !this.challenge;
      this.tapX = s.x;
      this.tapY = s.y;
      this.panX = s.x;
      this.panY = s.y;
      this.panStamp = e.timeStamp;
      this.world.look.dragging = true;
      this.syncCursor();
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      return;
    }
    if (this.world.tool !== "wand") {
      const g = this.placeAt(p.x, p.y);
      if (g) {
        const mode =
          g.kind === "block" ? "draw" : g.kind === "fan" || g.kind === "smoke" ? "aim" : "move";
        beginGadgetDrag(this.world, g, p.x, p.y, mode);
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      this.emitHud();
      return;
    }
    const hit = hitBubble(this.world, p.x, p.y);
    if (hit) {
      const scored = this.world.playing && this.world.time >= this.world.scoreArmed;
      popBubble(this.world, hit, p.x, p.y, scored);
      this.emitHud();
      return;
    }
    if (this.world.tool === "wand") {
      this.blowPointer = e.pointerId;
      this.applyBlow();
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const s = this.toLocal(e);
    if (!s.inside && !this.panning && this.world.dragId == null && this.blowPointer == null) return;
    if (this.panning) {
      if (Math.hypot(s.x - this.tapX, s.y - this.tapY) > 7) this.handTap = false;
      const dt = Math.max(0.008, (e.timeStamp - this.panStamp) / 1000);
      this.panStamp = e.timeStamp;
      panRoom(this.world, s.x - this.panX, s.y - this.panY, dt);
      this.panX = s.x;
      this.panY = s.y;
    }
    this.moveInputPointer(s.x, s.y);
  };

  private moveInputPointer(x: number, y: number) {
    const drag =
      this.challenge && this.world.dragMode === "move"
        ? this.world.gadgets.find((gadget) => gadget.id === this.world.dragId)
        : undefined;
    const angle = drag?.angle;
    movePointer(this.world, x, y);
    if (drag && angle !== undefined) {
      // Challenge movement and aiming are separate controls. Rebase the move
      // anchor too: stepWorld reapplies applyDrag between pointer events.
      drag.angle = angle;
      this.world.dragX = drag.x;
      this.world.dragY = drag.y;
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    if (this.panning) {
      const tap = this.handTap;
      const x = this.tapX;
      const y = this.tapY;
      this.panning = false;
      this.handTap = false;
      this.world.look.dragging = false;
      this.syncCursor();
      if (tap) {
        const w = screenToWorld(this.world, x, y);
        const hit = hitBubble(this.world, w.x, w.y);
        if (hit) {
          const scored = this.world.playing && this.world.time >= this.world.scoreArmed;
          popBubble(this.world, hit, w.x, w.y, scored);
          this.emitHud();
        }
      }
    }
    if (this.blowPointer === e.pointerId) {
      this.blowPointer = null;
      this.applyBlow();
    }
    if (this.world.dragId != null) {
      if (this.challenge && this.world.dragMode === "move") this.world.look.dragging = false;
      endGadgetDrag(this.world);
    }
    this.finishChallengePlacement();
    if (this.challenge) this.emitHud();
  };

  private onPointerCancel = (e: PointerEvent) => {
    this.handTap = false;
    this.onPointerUp(e);
  };

  private onWheel = (e: WheelEvent) => {
    // Browsers send Ctrl-wheel for trackpad pinch; leave native zoom alone.
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : 1;
    const dx = e.deltaX * (e.deltaMode === 2 ? this.world.w : unit);
    const dy = e.deltaY * (e.deltaMode === 2 ? this.world.h : unit);
    if (!e.altKey && !e.shiftKey) {
      const viewport = this.viewport();
      const scale = e.deltaMode === 2 ? 1 : this.world.w / viewport.width;
      panRoom(this.world, -dx * scale, -dy * scale, 1 / 60);
      // Trackpads supply their own momentum through wheel events. Adding room
      // inertia again would make the room drift after the gesture has stopped.
      this.world.look.panVx = 0;
      this.world.look.panVy = 0;
      // Keep the held preview under the pointer without interpreting camera
      // movement as an aiming gesture on the next simulation step.
      if (this.world.dragId == null || (this.challenge && this.world.dragMode === "move"))
        this.moveInputPointer(this.world.pointerX, this.world.pointerY);
      return;
    }
    const delta = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
    if (delta === 0) return;
    const s = this.toLocal(e);
    if (!s.inside) return;
    const p = screenToWorld(this.world, s.x, s.y);
    const bound = this.world.gadgets.find((g) => g.bound);
    const hit = pickGadget(this.world, p.x, p.y) ?? bound;
    if (!hit || !this.canEditGadget(hit)) return;
    if (hit.kind === "block") {
      if (e.altKey && e.shiftKey) {
        if (Math.abs(delta) > 18) tuneBlock(this.world, hit, delta, true);
      } else if (e.altKey && hit.shape < 0.5 && this.world.dragMode !== "draw") {
        const factor = Math.exp(-delta * 0.0016);
        hit.w = Math.min(540, Math.max(22, hit.w * factor));
      } else {
        tuneBlock(this.world, hit, delta, false);
      }
      return;
    }
    if (hit.kind === "vortex" && e.altKey && !e.shiftKey) {
      if (Math.abs(delta) < 18) return;
      hit.power = delta > 0 ? -Math.abs(hit.power) : Math.abs(hit.power);
      return;
    }
    const factor = Math.exp(-delta * 0.0016);
    if (e.altKey && e.shiftKey) stretchGadget(this.world, hit, factor);
    else if (e.shiftKey || hit.kind === "candle" || hit.kind === "vent")
      scaleGadget(this.world, hit, factor);
    else rotateGadget(this.world, hit, delta * 0.004);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== "Space" || e.defaultPrevented || this.world.tool !== "wand") return;
    // A focused control owns its keyboard input; the shortcut belongs to the room.
    if (
      e.target !== this.canvas &&
      e.target !== document.body &&
      e.target !== document.documentElement
    )
      return;
    e.preventDefault();
    this.audio.unlock();
    this.keys.add(e.code);
    this.applyBlow();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === "Space") this.applyBlow();
  };

  private onBlur = () => {
    this.keys.clear();
    this.blowPointer = null;
    this.uiBlow = false;
    this.panning = false;
    this.handTap = false;
    endGadgetDrag(this.world);
    this.world.look.dragging = false;
    this.world.look.panVx = 0;
    this.world.look.panVy = 0;
    this.syncCursor();
    this.applyBlow();
  };

  private syncCursor() {
    this.canvas.style.cursor = this.panning ? "grabbing" : this.world.tool === "hand" ? "grab" : "";
  }

  private applyBlow() {
    const blowing =
      this.world.tool === "wand" &&
      (this.keys.has("Space") || this.blowPointer != null || this.uiBlow);
    if (blowing && !this.world.blowing) {
      beginBlow(this.world);
      this.audio.startBlow();
    } else if (!blowing && this.world.blowing) {
      endBlow(this.world);
      this.audio.stopBlow();
    }
  }

  private bind() {
    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVis);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerCancel);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.resize();
  }

  private unbind() {
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVis);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerCancel);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }

  private onVis = () => {
    if (document.hidden) this.onBlur();
    if (!document.hidden) this.last = performance.now();
  };

  private emitHud() {
    this.onHud({
      score: this.world.score,
      best: this.world.best,
      combo: this.world.combo,
      pops: this.world.pops,
      blowing: this.world.blowing,
      bubbleCount: this.world.bubbles.length,
      playing: this.world.playing,
      floaters: this.world.floaters.slice(),
      width: this.world.w,
      height: this.world.h,
      glError: this.glError,
      tool: this.world.tool,
      heldToolActive: this.world.heldToolActive,
      gadgetCount: this.world.gadgets.filter((g) => !g.bound).length,
      challenge: this.challengeHud(),
    });
  }

  private expose() {
    window.__fume = {
      getState: () => ({
        score: this.world.score,
        bubbles: this.world.bubbles.length,
        playing: this.world.playing,
        blowing: this.world.blowing,
        pops: this.world.pops,
        challenge: this.challengeHud(),
      }),
      popNearest: () => {
        if (this.challenge) return false;
        const b = this.world.bubbles.find((x) => x.alive && !x.popping);
        if (!b) return false;
        popBubble(this.world, b, b.x, b.y, true);
        this.emitHud();
        return true;
      },
      beginBlow: () => this.holdBlow(true),
      endBlow: () => this.holdBlow(false),
      getParams: () => ({ ...this.world.params }),
      setParams: (p: Partial<SimParams>) => {
        this.setParams({ ...this.world.params, ...p });
      },
      setTool: (t: string) => this.setTool(t as ToolKind),
      setHeldToolActive: (on: boolean) => this.setHeldToolActive(on),
      // Older local scripts used Pin to silence the held device. Placement is
      // now unconditional; keep only that effect of the old debug command.
      setPlaceMode: (on: boolean) => this.setHeldToolActive(!on),
      placeAt: (x: number, y: number) => {
        const gadget = this.placeAt(x, y);
        this.finishChallengePlacement();
        this.emitHud();
        return gadget;
      },
      clearGadgets: () => this.clearPlaced(),
      getTools: () => ({
        tool: this.world.tool,
        heldToolActive: this.world.heldToolActive,
        gadgets: this.world.gadgets.filter((g) => !g.bound).map((g) => g.kind),
      }),
      getLook: () => ({ ...this.world.look }),
    };
  }
}

function isMissingGpu(message: string) {
  return (
    /not supported|no adapter|requestAdapter|navigator\.gpu/i.test(message) &&
    !/VGPU-|WGSL|shader|ident|set-value|bind group|pipeline/i.test(message)
  );
}

function friendlyGpuError(message: string) {
  if (isMissingGpu(message)) {
    return "WebGPU is required for Fume. Try a recent Chrome or Edge.";
  }
  return message;
}

declare global {
  interface Window {
    __fume?: {
      getState: () => {
        score: number;
        bubbles: number;
        playing: boolean;
        blowing: boolean;
        pops: number;
        challenge: ChallengeHud | null;
      };
      popNearest: () => boolean;
      beginBlow: () => void;
      endBlow: () => void;
      getParams: () => SimParams;
      setParams: (p: Partial<SimParams>) => void;
      setTool: (t: string) => void;
      setHeldToolActive: (on: boolean) => void;
      setPlaceMode: (on: boolean) => void;
      placeAt: (x: number, y: number) => unknown;
      clearGadgets: () => void;
      getTools: () => { tool: string; heldToolActive: boolean; gadgets: string[] };
      getLook: () => { parallaxX: number; parallaxY: number };
    };
  }
}
