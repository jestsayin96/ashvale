import { renderSting } from '../audio/render/offline';
import { encodeWav } from '../audio/render/wav';
import { normalizeToTarget } from '../dsp/normalize';
import { downloadBytes } from '../io/download';
import type { FxParams, StingPreset } from '../audio/voices/fx';
import { field, h } from './dom';
import type { Shell } from './transport';

const PRESETS: Array<{ id: StingPreset; label: string }> = [
  { id: 'whoosh', label: 'Hype whoosh' },
  { id: 'hit', label: 'Hit' },
  { id: 'riser', label: 'Riser' },
  { id: 'blip', label: 'Playful blip' },
];

export function mountStingPanel(parent: HTMLElement, shell: Shell): void {
  let history = [1];
  let index = 0;
  const preset = h('select');
  for (const item of PRESETS) preset.append(h('option', { value: item.id, text: item.label }));
  const duration = h('input', { type: 'range', min: '2', max: '5', step: '0.1', value: '3' });
  const durRead = h('span', { text: '3.0 s' });
  duration.addEventListener('input', () => {
    durRead.textContent = `${Number(duration.value).toFixed(1)} s`;
  });
  const pitch = h('input', { type: 'range', min: '36', max: '84', step: '1', value: '60' });
  const bright = h('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '0.6' });
  const intensity = h('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '0.7' });
  const seedRead = h('span', { text: 'seed 1 (1)' });
  const randomize = h('button', { type: 'button', text: 'Randomize' });
  const back = h('button', { type: 'button', text: 'Back' });
  const reroll = h('button', { type: 'button', text: 'Re-roll' });
  const preview = h('button', { type: 'button', text: 'Preview' });
  const exp = h('button', { type: 'button', text: 'Export' });

  function params(): FxParams {
    return {
      duration: Number(duration.value),
      pitch: Number(pitch.value),
      brightness: Number(bright.value),
      intensity: Number(intensity.value),
      seed: history[index],
    };
  }

  function showSeed(): void {
    const seed = history[index] >>> 0;
    seedRead.textContent = `seed ${seed} (${seed.toString(16)})`;
    back.disabled = index <= 0;
  }

  randomize.addEventListener('click', () => {
    const next = (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1;
    history = history.slice(0, index + 1);
    history.push(next);
    index = history.length - 1;
    showSeed();
  });
  reroll.addEventListener('click', () => {
    const next = (history[index] + 0x9e3779b9) >>> 0;
    history = history.slice(0, index + 1);
    history.push(next);
    index = history.length - 1;
    showSeed();
  });
  back.addEventListener('click', () => {
    if (index > 0) index -= 1;
    showSeed();
  });
  preview.addEventListener('click', () => {
    shell.engine.startAudio().then(() => shell.engine.previewSting(preset.value as StingPreset, params()));
  });
  exp.addEventListener('click', () => {
    exp.disabled = true;
    const p = params();
    const id = preset.value as StingPreset;
    renderSting(id, p)
      .then((buffers) => {
        const norm = normalizeToTarget(buffers.left, buffers.right, 44100, {
          targetLufs: shell.project.master.targetLufs,
          ceilingDbtp: shell.project.master.ceilingDbtp,
        });
        const wav = encodeWav(norm.left, norm.right, 44100, 16, p.seed || 1);
        const file = `sting_${id}_${(p.seed >>> 0).toString(16)}.wav`;
        downloadBytes(wav, file, 'audio/wav');
        shell.status(`Exported ${file}`);
      })
      .catch((err: unknown) => shell.status(err instanceof Error ? err.message : 'Sting export failed'))
      .finally(() => {
        exp.disabled = false;
      });
  });

  parent.append(
    h('h2', { text: 'Sting' }),
    field('Preset', preset),
    field('Duration', h('span', { class: 'inline' }, duration, durRead)),
    field('Pitch', pitch),
    field('Brightness', bright),
    field('Intensity', intensity),
    h('div', { class: 'inline' }, randomize, reroll, back, seedRead),
    h('div', { class: 'inline' }, preview, exp),
  );
  showSeed();
}
