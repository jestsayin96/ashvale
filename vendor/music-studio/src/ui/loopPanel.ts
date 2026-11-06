import { formatSeamText } from '../analysis/seamCheck';
import { renderLoop } from '../audio/render/loop';
import type { Project } from '../model/types';
import { BAR_VALUES } from '../model/types';
import { field, h } from './dom';
import type { Shell } from './transport';

export interface LoopOptions {
  snap: boolean;
  crossfade: boolean;
  crossfadeMs: number;
}

export function mountLoopPanel(parent: HTMLElement, shell: Shell, options: LoopOptions): { refresh(): void } {
  const bars = h('select');
  for (const value of BAR_VALUES) bars.append(h('option', { value: String(value), text: String(value) }));
  bars.addEventListener('change', () => {
    shell.project.bars = Number(bars.value) as Project['bars'];
    shell.refresh();
  });
  const snap = h('input', { type: 'checkbox' });
  snap.addEventListener('change', () => {
    options.snap = snap.checked;
  });
  const fadeOn = h('input', { type: 'checkbox' });
  const fadeMs = h('input', { type: 'number', min: '1', max: '50', step: '1', value: '10' });
  fadeOn.addEventListener('change', () => {
    options.crossfade = fadeOn.checked;
  });
  fadeMs.addEventListener('input', () => {
    options.crossfadeMs = Math.max(1, Number(fadeMs.value) || 10);
  });
  const out = h('p', { class: 'readout', text: 'Seam: render a loop to measure the join.' });
  const render = h('button', { type: 'button', text: 'Render loop' });
  const preview = h('button', { type: 'button', text: 'Play loop (x4 preview)' });

  render.addEventListener('click', () => run(false));
  preview.addEventListener('click', () => run(true));

  parent.append(
    h('h2', { text: 'Loop' }),
    field('Bars', bars),
    h('label', { class: 'inline' }, snap, 'Snap seam to zero crossing'),
    h('label', { class: 'inline' }, fadeOn, 'Short crossfade (ms)'),
    fadeMs,
    h('div', { class: 'inline' }, render, preview),
    out,
  );

  async function run(play: boolean): Promise<void> {
    render.disabled = true;
    preview.disabled = true;
    shell.status('Rendering loop…');
    try {
      await shell.engine.startAudio();
      const loop = await renderLoop(shell.project, {
        snap: options.snap,
        crossfadeMs: options.crossfade ? options.crossfadeMs : 0,
      });
      const seam = loop.seam;
      out.className = seam.pass ? 'readout pass' : 'readout check';
      out.textContent = `${formatSeamText(seam)} ${loop.samples} samples${loop.snapped ? ' (end moved)' : ''}.`;
      if (play) shell.engine.playBuffer(loop.left, loop.right, loop.sampleRate, 4);
      shell.status(play ? 'Playing the loop four times' : 'Loop rendered');
    } catch (err) {
      shell.status(err instanceof Error ? err.message : 'Loop render failed');
    } finally {
      render.disabled = false;
      preview.disabled = false;
    }
  }

  return {
    refresh() {
      bars.value = String(shell.project.bars);
    },
  };
}
