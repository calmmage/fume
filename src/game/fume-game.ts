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
import type { ToolKind } from "./tools";

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
    setWorldParams(this.world, clampParams(params));
  }

  setLook(look: LookState) {
    setWorldLook(this.world, look);
  }

  resetView() {
    this.world.look.parallaxX = 0;
    this.world.look.parallaxY = 0;
    this.world.look.panVx = 0;
    this.world.look.panVy = 0;
  }

  loadScene(id: string) {
    applyScene(this.world, id);
    this.emitHud();
  }

  getParams(): SimParams {
    return this.world.params;
  }

  holdBlow(on: boolean) {
    this.uiBlow = on;
    this.applyBlow();
  }

  frameState() {
    const look = this.world.look;
    return { look, time: this.world.time };
  }

  setTool(tool: ToolKind) {
    setTool(this.world, tool);
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
    setHeldToolActive(this.world, active);
    this.emitHud();
  }

  clearPlaced() {
    clearGadgets(this.world);
    this.emitHud();
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
    resizeWorld(this.world, w, h);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer?.resize(w, h, dpr);
  };

  private toLocal(e: { clientX: number; clientY: number }) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * this.world.w,
      y: ((e.clientY - rect.top) / rect.height) * this.world.h,
    };
  }

  private onPointerDown = (e: PointerEvent) => {
    this.audio.unlock();
    const s = this.toLocal(e);
    movePointer(this.world, s.x, s.y);
    const p = screenToWorld(this.world, s.x, s.y);
    const right = e.button === 2 || e.ctrlKey || e.metaKey;
    const gadget = pickGadget(this.world, p.x, p.y);
    if (right) {
      if (gadget) {
        removeGadget(this.world, gadget);
        this.emitHud();
      }
      return;
    }
    if (this.world.tool === "hand") {
      if (gadget) {
        beginGadgetDrag(this.world, gadget, p.x, p.y, "move");
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }
      this.panning = true;
      this.handTap = true;
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
      const g = placeGadgetAt(this.world, p.x, p.y);
      if (g) {
        const mode = g.kind === "block" ? "draw" : g.kind === "fan" || g.kind === "smoke" ? "aim" : "move";
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
    if (this.panning) {
      if (Math.hypot(s.x - this.tapX, s.y - this.tapY) > 7) this.handTap = false;
      const dt = Math.max(0.008, (e.timeStamp - this.panStamp) / 1000);
      this.panStamp = e.timeStamp;
      panRoom(this.world, s.x - this.panX, s.y - this.panY, dt);
      this.panX = s.x;
      this.panY = s.y;
    }
    movePointer(this.world, s.x, s.y);
  };

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
    if (this.world.dragId != null) endGadgetDrag(this.world);
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
      panRoom(this.world, -dx, -dy, 1 / 60);
      // Trackpads supply their own momentum through wheel events. Adding room
      // inertia again would make the room drift after the gesture has stopped.
      this.world.look.panVx = 0;
      this.world.look.panVy = 0;
      // Keep the held preview under the pointer without interpreting camera
      // movement as an aiming gesture on the next simulation step.
      if (this.world.dragId == null) movePointer(this.world, this.world.pointerX, this.world.pointerY);
      return;
    }
    const delta = Math.abs(dy) >= Math.abs(dx) ? dy : dx;
    if (delta === 0) return;
    const s = this.toLocal(e);
    const p = screenToWorld(this.world, s.x, s.y);
    const bound = this.world.gadgets.find((g) => g.bound);
    const hit = pickGadget(this.world, p.x, p.y) ?? bound;
    if (!hit) return;
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
    else if (e.shiftKey || hit.kind === "candle" || hit.kind === "vent") scaleGadget(this.world, hit, factor);
    else rotateGadget(this.world, hit, delta * 0.004);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.code !== "Space" || e.defaultPrevented || this.world.tool !== "wand") return;
    // A focused control owns its keyboard input; the shortcut belongs to the room.
    if (e.target !== this.canvas && e.target !== document.body && e.target !== document.documentElement) return;
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
      }),
      popNearest: () => {
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
      placeAt: (x: number, y: number) => placeGadgetAt(this.world, x, y),
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
