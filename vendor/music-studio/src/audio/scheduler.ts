import { buildEvents, type MusicEvent } from './events';
import type { Project } from '../model/types';
import { triggerEvent } from './trigger';

export class LookaheadScheduler {
  private timer = 0;
  private rafId = 0;
  private playing = false;
  private loopStart = 0;
  private loopDur = 1;
  private events: MusicEvent[] = [];
  private nextIndex = 0;
  private sources: AudioScheduledSourceNode[] = [];

  constructor(
    private opts: {
      ctx: AudioContext;
      dest: AudioNode;
      getProject: () => Project;
      onPlayhead: (step: number, stepCount: number) => void;
    },
  ) {}

  get isPlaying(): boolean {
    return this.playing;
  }

  start(): void {
    this.stopSources();
    const ctx = this.opts.ctx;
    this.playing = true;
    this.loopStart = ctx.currentTime + 0.08;
    this.armLoop();
    this.timer = window.setInterval(() => this.tick(), 25);
    this.tick();
    this.frame();
  }

  stop(): void {
    this.playing = false;
    window.clearInterval(this.timer);
    window.cancelAnimationFrame(this.rafId);
    this.stopSources();
    this.opts.onPlayhead(-1, 1);
  }

  private stopSources(): void {
    const now = this.opts.ctx.currentTime;
    for (const src of this.sources) {
      try {
        src.stop(now);
      } catch {
        /* already stopped */
      }
    }
    this.sources = [];
  }

  private armLoop(): void {
    const project = this.opts.getProject();
    this.events = buildEvents(project, project.bars);
    this.loopDur = project.bars * 4 * (60 / project.bpm);
    this.nextIndex = 0;
  }

  private tick(): void {
    if (!this.playing) return;
    const horizon = this.opts.ctx.currentTime + 0.12;
    let guard = 0;
    while (guard++ < 10000) {
      if (this.nextIndex >= this.events.length) {
        const nextStart = this.loopStart + this.loopDur;
        if (nextStart > horizon) break;
        this.loopStart = nextStart;
        this.armLoop();
        continue;
      }
      const ev = this.events[this.nextIndex];
      const when = this.loopStart + ev.time;
      if (when > horizon) break;
      const nodes = triggerEvent(this.opts.ctx, this.opts.dest, ev, when);
      for (const n of nodes) this.sources.push(n);
      this.nextIndex++;
    }
  }

  private frame = (): void => {
    if (!this.playing) return;
    const project = this.opts.getProject();
    const stepDur = 60 / project.bpm / 4;
    const elapsed = this.opts.ctx.currentTime - this.loopStart;
    const total = project.bars * 16;
    if (elapsed < 0) this.opts.onPlayhead(-1, total);
    else {
      const wrapped = elapsed % this.loopDur;
      const step = Math.floor(wrapped / stepDur) % total;
      this.opts.onPlayhead(step, total);
    }
    this.rafId = window.requestAnimationFrame(this.frame);
  };
}
