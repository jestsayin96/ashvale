import { drumParams } from '../model/defaults';
import type { DrumVoice } from '../model/types';
import type { Shell } from './transport';
import { h } from './dom';

const PADS: Array<{ key: string; code: string; label: string; voice: DrumVoice; tune: number }> = [
  { key: 'A', code: 'KeyA', label: 'Kick', voice: 'kick', tune: 0 },
  { key: 'S', code: 'KeyS', label: 'Snare', voice: 'snare', tune: 0 },
  { key: 'D', code: 'KeyD', label: 'Clap', voice: 'clap', tune: 0 },
  { key: 'F', code: 'KeyF', label: 'Hat', voice: 'hatClosed', tune: 0 },
  { key: 'G', code: 'KeyG', label: 'Open', voice: 'hatOpen', tune: 0 },
  { key: 'H', code: 'KeyH', label: 'Tom', voice: 'tom', tune: 0 },
  { key: 'J', code: 'KeyJ', label: 'Rim', voice: 'rim', tune: 0 },
  { key: 'K', code: 'KeyK', label: 'Low tom', voice: 'tom', tune: -7 },
];

export function mountPads(parent: HTMLElement, shell: Shell): void {
  const row = h('div', { class: 'pad-row' });
  for (const pad of PADS) {
    const button = h('button', { class: 'pad', type: 'button', text: `${pad.label} ${pad.key}` });
    button.addEventListener('click', () => hit(pad));
    row.append(button);
  }
  parent.append(h('h2', { text: 'Pads' }), row, h('p', { class: 'hint', text: 'Click a pad or press A S D F G H J K.' }));

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
    const pad = PADS.find((item) => item.code === event.code);
    if (!pad) return;
    event.preventDefault();
    hit(pad);
  });

  function hit(pad: (typeof PADS)[number]): void {
    shell.engine.startAudio().then(() => {
      const decay = pad.voice === 'hatOpen' ? 0.22 : pad.voice === 'kick' ? 0.25 : 0.14;
      shell.engine.previewDrum(pad.voice, drumParams(pad.tune, decay, 0.6));
    });
  }
}
