import type { DrumParams, SynthParams, Track } from '../model/types';
import { field, h } from './dom';
import { selectedTrack } from './sequencer';
import type { Shell } from './transport';

export function mountSynthPanel(parent: HTMLElement, shell: Shell, getSelected: () => string): { refresh(): void } {
  const body = h('div');
  parent.append(h('h2', { text: 'Voice' }), body);

  function refresh(): void {
    const track = selectedTrack(shell.project, getSelected());
    body.innerHTML = '';
    if (track.kind === 'drum') body.append(drumEditor(track));
    else body.append(synthEditor(track));
  }

  function synthEditor(track: Track): HTMLElement {
    const params = track.params as SynthParams;
    const locked = track.voice === 'bass' || track.voice === 'pad';
    const wave = h('select');
    for (const value of ['sine', 'triangle', 'sawtooth', 'square', 'pulse12', 'pulse25']) {
      wave.append(h('option', { value, text: value }));
    }
    wave.value = params.wave;
    wave.disabled = locked;
    wave.addEventListener('change', () => {
      params.wave = wave.value as SynthParams['wave'];
    });
    const detune = slider(-40, 40, 1, params.detuneCents, (n) => {
      params.detuneCents = n;
    });
    const octave = slider(-2, 2, 1, params.octave, (n) => {
      params.octave = n;
    });
    const attack = slider(0.001, 1.2, 0.001, params.adsr.a, (n) => {
      params.adsr.a = n;
    });
    const decay = slider(0.01, 1.2, 0.001, params.adsr.d, (n) => {
      params.adsr.d = n;
    });
    const sustain = slider(0, 1, 0.01, params.adsr.s, (n) => {
      params.adsr.s = n;
    });
    const release = slider(0.01, 2, 0.001, params.adsr.r, (n) => {
      params.adsr.r = n;
    });
    const type = h('select');
    for (const value of ['lowpass', 'highpass', 'bandpass']) type.append(h('option', { value, text: value }));
    type.value = params.filter.type;
    type.addEventListener('change', () => {
      params.filter.type = type.value as SynthParams['filter']['type'];
    });
    const cutoff = slider(80, 8000, 1, params.filter.cutoff, (n) => {
      params.filter.cutoff = n;
    });
    const q = slider(0.2, 12, 0.1, params.filter.q, (n) => {
      params.filter.q = n;
    });
    const env = slider(0, 1, 0.01, params.filter.envAmount, (n) => {
      params.filter.envAmount = n;
    });
    const hint = track.voice === 'bass'
      ? 'Bass plays a sine plus a square one octave down.'
      : track.voice === 'pad'
        ? 'Pad plays two detuned saws. Attack is at least 0.4 s.'
        : 'Two oscillators, filter, then an amplitude envelope.';
    return h(
      'div',
      null,
      h('p', { class: 'hint', text: `${track.name} · ${track.voice}` }),
      field('Wave', wave),
      field('Detune cents', detune),
      field('Octave', octave),
      field('Attack', attack),
      field('Decay', decay),
      field('Sustain', sustain),
      field('Release', release),
      field('Filter', type),
      field('Cutoff', cutoff),
      field('Q', q),
      field('Filter env', env),
      h('p', { class: 'hint', text: hint }),
    );
  }

  function drumEditor(track: Track): HTMLElement {
    const params = track.params as DrumParams;
    return h(
      'div',
      null,
      h('p', { class: 'hint', text: `${track.name} · ${track.voice}` }),
      field('Tune semis', slider(-12, 12, 1, params.tuneSemis, (n) => {
        params.tuneSemis = n;
      })),
      field('Decay', slider(0.02, 1.2, 0.01, params.decay, (n) => {
        params.decay = n;
      })),
      field('Tone', slider(0, 1, 0.01, params.tone, (n) => {
        params.tone = n;
      })),
    );
  }

  return { refresh };
}

function slider(min: number, max: number, step: number, value: number, on: (n: number) => void): HTMLElement {
  const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
  const read = h('span', { text: format(value) });
  input.addEventListener('input', () => {
    const n = Number(input.value);
    read.textContent = format(n);
    on(n);
  });
  return h('span', { class: 'inline' }, input, read);
}

function format(n: number): string {
  return Math.abs(n) >= 10 ? n.toFixed(0) : n.toFixed(2);
}
