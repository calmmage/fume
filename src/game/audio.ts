/** Procedural soap-film audio — pops, blow hiss, quiet room. */

export class FumeAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private blowGain: GainNode | null = null;
  private blowSrc: AudioBufferSourceNode | null = null;
  private muted = false;
  private unlocked = false;

  unlock() {
    if (this.unlocked && this.ctx && this.ctx.state !== "suspended") return;
    const ctx = this.ensure();
    if (ctx.state === "suspended") void ctx.resume();
    this.unlocked = true;
    this.startAmbient();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    const master = this.master;
    const ctx = this.ctx;
    if (!master || !ctx) return;
    master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.04);
  }

  startBlow() {
    const ctx = this.ctx;
    const gain = this.blowGain;
    if (!ctx || !gain || this.muted) return;
    gain.gain.setTargetAtTime(0.07, ctx.currentTime, 0.05);
  }

  stopBlow() {
    const ctx = this.ctx;
    const gain = this.blowGain;
    if (!ctx || !gain) return;
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
  }

  pop(radius: number, xNorm: number) {
    const ctx = this.ctx;
    const sfx = this.sfx;
    if (!ctx || !sfx || this.muted) return;
    const t = ctx.currentTime;
    const freq = 420 + Math.max(18, 140 - radius) * 9 + Math.random() * 40;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.28), t + 0.09);

    const og = ctx.createGain();
    const peak = 0.09 + Math.min(0.08, radius / 900);
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(Math.max(-0.7, Math.min(0.7, xNorm)), t);

    osc.connect(og);
    og.connect(pan);
    pan.connect(sfx);
    osc.start(t);
    osc.stop(t + 0.16);
    osc.onended = () => {
      osc.disconnect();
      og.disconnect();
      pan.disconnect();
    };

    this.noiseClick(t, 0.045 + radius / 2500, xNorm);
  }

  puff(xNorm: number) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    this.noiseClick(ctx.currentTime, 0.03, xNorm, 900);
  }

  private noiseClick(t: number, amp: number, xNorm: number, hp = 1400) {
    const ctx = this.ctx;
    const sfx = this.sfx;
    if (!ctx || !sfx) return;
    const len = Math.floor(ctx.sampleRate * 0.06);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = 1 - i / len;
      data[i] = (Math.random() * 2 - 1) * env * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(Math.max(-0.7, Math.min(0.7, xNorm)), t);
    src.connect(filter);
    filter.connect(g);
    g.connect(pan);
    pan.connect(sfx);
    src.start(t);
    src.stop(t + 0.06);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
      pan.disconnect();
    };
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx({ latencyHint: "interactive" });
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 1;
    master.connect(ctx.destination);
    const sfx = ctx.createGain();
    sfx.gain.value = 0.9;
    sfx.connect(master);

    const blowGain = ctx.createGain();
    blowGain.gain.value = 0;
    const blowFilter = ctx.createBiquadFilter();
    blowFilter.type = "bandpass";
    blowFilter.frequency.value = 680;
    blowFilter.Q.value = 0.7;
    blowGain.connect(blowFilter);
    blowFilter.connect(master);

    const noise = ctx.createBufferSource();
    noise.buffer = this.brownNoise(ctx);
    noise.loop = true;
    noise.connect(blowGain);
    noise.start();
    this.blowSrc = noise;

    this.ctx = ctx;
    this.master = master;
    this.sfx = sfx;
    this.blowGain = blowGain;
    return ctx;
  }

  private startAmbient() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 92;
    const g = ctx.createGain();
    g.gain.value = 0.012;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 180;
    osc.connect(f);
    f.connect(g);
    g.connect(master);
    osc.start();
  }

  private brownNoise(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    return buf;
  }

  dispose() {
    this.stopBlow();
    try {
      this.blowSrc?.stop();
    } catch {
      /* already stopped */
    }
    void this.ctx?.close();
    this.ctx = null;
  }
}
