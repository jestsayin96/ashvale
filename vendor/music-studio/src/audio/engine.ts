import type { Project } from '../model/types';
import type { DrumVoice } from '../model/types';
import { drumParams } from '../model/defaults';
import { LookaheadScheduler } from './scheduler';
import { triggerSting } from './trigger';
import { dbToLin } from './units';
import { playDrum } from './voices/drums';
import type { FxParams, StingPreset } from './voices/fx';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;
  private analyser: AnalyserNode | null = null;
  private scheduler: LookaheadScheduler | null = null;
  private extras: AudioScheduledSourceNode[] = [];
  project: Project | null = null;
  onPlayhead: (step: number, stepCount: number) => void = () => {};

  get context(): AudioContext | null {
    return this.ctx;
  }

  get meter(): AnalyserNode | null {
    return this.analyser;
  }

  get playing(): boolean {
    return this.scheduler?.isPlaying ?? false;
  }

  async startAudio(): Promise<void> {
    if (!this.ctx) this.build();
    await this.ctx!.resume();
  }

  private build(): void {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = this.project ? dbToLin(this.project.master.gainDb) : 1;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    master.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);
    this.ctx = ctx;
    this.master = master;
    this.comp = comp;
    this.analyser = analyser;
    this.scheduler = new LookaheadScheduler({
      ctx,
      dest: master,
      getProject: () => this.project as Project,
      onPlayhead: (step, count) => this.onPlayhead(step, count),
    });
  }

  setMasterGain(db: number): void {
    if (this.master) this.master.gain.value = dbToLin(db);
  }

  async toggle(): Promise<void> {
    if (!this.project) return;
    await this.startAudio();
    if (this.playing) this.scheduler?.stop();
    else this.scheduler?.start();
  }

  stop(): void {
    this.scheduler?.stop();
    this.stopExtras();
  }

  private stopExtras(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const s of this.extras) {
      try {
        s.stop(now);
      } catch {
        /* already stopped */
      }
    }
    this.extras = [];
  }

  previewDrum(voice: DrumVoice, params = drumParams(0, voice === 'hatOpen' ? 0.2 : 0.16, 0.6)): void {
    if (!this.ctx || !this.master) return;
    const gain = this.ctx.createGain();
    gain.gain.value = dbToLin(-6);
    gain.connect(this.master);
    const nodes = playDrum(this.ctx, gain, this.ctx.currentTime + 0.01, voice, params, 0.9);
    this.extras.push(...nodes);
  }

  previewSting(preset: StingPreset, params: FxParams): void {
    if (!this.ctx || !this.comp) return;
    const nodes = triggerSting(this.ctx, this.comp, this.ctx.currentTime + 0.02, preset, params);
    this.extras.push(...nodes);
  }

  playBuffer(left: Float32Array, right: Float32Array, sampleRate: number, repeats: number): void {
    if (!this.ctx || !this.comp) return;
    this.stopExtras();
    let peak = 0;
    for (let i = 0; i < left.length; i++) {
      peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    }
    const gain = peak > 0.98 ? 0.98 / peak : 1;
    const buffer = this.ctx.createBuffer(2, left.length, sampleRate);
    const l = new Float32Array(left.length);
    const r = new Float32Array(right.length);
    for (let i = 0; i < left.length; i++) l[i] = left[i] * gain;
    for (let i = 0; i < right.length; i++) r[i] = right[i] * gain;
    buffer.copyToChannel(l, 0);
    buffer.copyToChannel(r, 1);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = repeats > 1;
    src.connect(this.comp);
    const dur = (left.length / sampleRate) * repeats;
    src.start();
    src.stop(this.ctx.currentTime + dur);
    this.extras.push(src);
  }
}
