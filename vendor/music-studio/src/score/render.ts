import type { SynthBackend } from './backend';
import { silentStems } from './buffers';
import { mixdown, type MixOptions, type MixResult } from './mixdown';
import type { ScorePlan, StemMap } from './plan';
import { SAMPLE_RATE, SEGMENT_SECONDS, SEGMENT_TAIL_SECONDS } from './targets';

export interface RenderProgress {
  fraction: number;
  message: string;
}

export interface RenderSuccess {
  ok: true;
  buses: StemMap;
  music: MixResult['music'];
  sfx: MixResult['sfx'];
  mix: MixResult['mix'];
  sampleRate: number;
  samples: number;
  mixReport: MixResult;
  mixMs: number;
}

export interface RenderFailure {
  ok: false;
  error: string;
}

export async function renderScore(
  plan: ScorePlan,
  backend: SynthBackend,
  opts: { onProgress?: (progress: RenderProgress) => void; tailSeconds?: number; mix?: MixOptions } = {},
): Promise<RenderSuccess | RenderFailure> {
  const sampleRate = plan.sampleRate || SAMPLE_RATE;
  const tailSeconds = opts.tailSeconds ?? 0;
  const total = Math.round((plan.videoLengthSeconds + tailSeconds) * sampleRate);
  const buses = silentStems(total);
  const segment = Math.round(SEGMENT_SECONDS * sampleRate);
  const tail = Math.round(SEGMENT_TAIL_SECONDS * sampleRate);
  const segments = Math.max(1, Math.ceil(total / segment));
  try {
    for (let index = 0; index < segments; index++) {
      const start = index * segment;
      const body = Math.min(segment, total - start);
      const lengthSamples = body + tail;
      const startSec = start / sampleRate;
      const endSec = (start + body) / sampleRate;
      const events = plan.events.filter((event) => event.time >= startSec - 1e-6 && event.time < endSec - 1e-9);
      let rendered: StemMap;
      try {
        rendered = await backend.render(events, start, lengthSamples, sampleRate);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'render failed';
        return { ok: false, error: `segment ${index} failed: ${message}` };
      }
      addSegment(buses, rendered, start, body, total);
      opts.onProgress?.({
        fraction: (index + 1) / (segments + 1),
        message: `Rendered segment ${index + 1} of ${segments}`,
      });
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    const mixStarted = performance.now();
    opts.onProgress?.({ fraction: 0.9, message: 'mix' });
    const mixed = mixdown(buses, plan, opts.mix);
    const mixMs = performance.now() - mixStarted;
    opts.onProgress?.({ fraction: 1, message: 'Mixed' });
    return {
      ok: true,
      buses,
      music: mixed.music,
      sfx: mixed.sfx,
      mix: mixed.mix,
      sampleRate,
      samples: total,
      mixReport: mixed,
      mixMs,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Score render failed' };
  }
}

function addSegment(dest: StemMap, src: StemMap, start: number, body: number, total: number): void {
  const names = Object.keys(dest) as Array<keyof StemMap>;
  for (const name of names) {
    const from = src[name];
    const to = dest[name];
    if (!from) continue;
    for (let i = 0; i < from.left.length; i++) {
      const idx = start + i;
      if (idx < 0 || idx >= total) continue;
      if (i >= body && idx >= total) continue;
      to.left[idx] += from.left[i] || 0;
      to.right[idx] += from.right[i] || 0;
    }
  }
}
