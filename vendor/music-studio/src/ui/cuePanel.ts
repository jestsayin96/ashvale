import shortExample from '../../examples/short_multikill_death.cues.json';
import longExample from '../../examples/longform_10min.cues.json';
import funnyExample from '../../examples/funny_fail.cues.txt?raw';
import type { ScoreSuccess, ScoreVideoOptions } from '../score/api';
import { DEFAULT_BUS_MIX } from '../score/targets';
import type { MusicBus } from '../score/plan';
import { field, h } from './dom';
import type { Shell } from './transport';

const BUSES: MusicBus[] = ['drums', 'bass', 'harmony', 'melody', 'sfx'];

const CUE_COLOR: Record<string, string> = {
  calm: '#67e8f9',
  talking: '#86efac',
  tension: '#f0b429',
  build: '#fb923c',
  hype: '#fb7185',
  multikill: '#f43f5e',
  kill: '#fda4af',
  death: '#c4b5fd',
  sad: '#818cf8',
  funny: '#facc15',
  fail: '#f97316',
  victory: '#34d399',
  clutch: '#f472b6',
  jumpscare: '#f87171',
  reveal: '#a5b4fc',
  transition: '#94a3b8',
  outro: '#64748b',
  sfx: '#e8eaf0',
};

export function mountCuePanel(parent: HTMLElement, shell: Shell): { refresh(): void } {
  const text = h('textarea', { id: 'cue-sheet', rows: '8' });
  text.value = JSON.stringify(shortExample, null, 2);
  const examples = h('select', { id: 'cue-example' });
  examples.append(
    h('option', { value: 'short', text: 'Short multikill' }),
    h('option', { value: 'funny', text: 'Funny fail' }),
    h('option', { value: 'long', text: 'Long form' }),
  );
  const seedInput = h('input', { id: 'cue-seed', type: 'number', value: '1' });
  const bitDepth = h('select', { id: 'cue-bitdepth' });
  bitDepth.append(h('option', { value: '16', text: '16-bit' }), h('option', { value: '24', text: '24-bit' }));
  const stemsBox = h('input', { id: 'cue-stems', type: 'checkbox' });
  const picturesBox = h('input', { id: 'cue-pictures', type: 'checkbox' });
  const sfxFilesBox = h('input', { id: 'cue-sfxfiles', type: 'checkbox' });
  stemsBox.checked = true;
  picturesBox.checked = true;
  const validate = h('button', { type: 'button', text: 'Validate' });
  const compose = h('button', { class: 'primary', type: 'button', text: 'Compose' });
  const play = h('button', { type: 'button', text: 'Play' });
  const stop = h('button', { type: 'button', text: 'Stop' });
  const exportAll = h('button', { type: 'button', text: 'Export all' });
  const selfTest = h('button', { type: 'button', text: 'Score self-test' });
  const progress = h('progress', { id: 'cue-progress', max: '1', value: '0' });
  const status = h('p', { class: 'readout', text: 'Paste a cue sheet, validate it, then compose.' });
  const canvas = h('canvas', { id: 'cue-timeline', width: '1100', height: '168' });
  const table = h('table', { class: 'cue-table' });
  table.append(h('thead', null, h('tr', null,
    h('th', { text: 'Time' }),
    h('th', { text: 'Type' }),
    h('th', { text: 'Sync ms' }),
    h('th', { text: 'Verdict' }),
    h('th', { text: 'Suggestion' }),
  )));
  const tbody = h('tbody');
  table.append(tbody);
  const mixer = h('div', { class: 'mixer' });
  const controls = mixerControls();

  let last: ScoreSuccess | null = null;
  let cursor = 0;
  let frame = 0;

  examples.addEventListener('change', () => {
    if (examples.value === 'funny') text.value = funnyExample;
    else if (examples.value === 'long') text.value = JSON.stringify(longExample, null, 2);
    else text.value = JSON.stringify(shortExample, null, 2);
  });

  validate.addEventListener('click', () => {
    const parsed = window.musicStudio.parseCues(text.value);
    const problems = [...parsed.errors.map((error) => `line ${error.line}: ${error.message}`), ...parsed.warnings];
    status.textContent = parsed.ok
      ? `Accepted ${parsed.sheet?.cues.length ?? 0} cues.${problems.length ? ` ${problems.join(' ')}` : ''}`
      : problems.join(' ') || 'Cue sheet was not accepted';
    shell.status(status.textContent);
  });

  compose.addEventListener('click', () => {
    void runScore(false);
  });
  exportAll.addEventListener('click', () => {
    void runScore(true);
  });
  play.addEventListener('click', () => {
    if (!last) {
      status.textContent = 'Compose a score before play.';
      return;
    }
    void shell.engine.startAudio().then(() => {
      shell.engine.playBuffer(last!.playback.left, last!.playback.right, last!.playback.sampleRate, 1);
      const ctx = shell.engine.context;
      const started = ctx ? ctx.currentTime : 0;
      cancelAnimationFrame(frame);
      const tick = () => {
        const now = shell.engine.context?.currentTime ?? started;
        cursor = Math.max(0, now - started);
        draw(last, cursor);
        if (cursor < last!.playback.seconds) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
  });
  stop.addEventListener('click', () => {
    cancelAnimationFrame(frame);
    shell.engine.stop();
    cursor = 0;
    draw(last, 0);
  });
  selfTest.addEventListener('click', () => {
    status.textContent = 'Score self-test is rendering the example sheets with the Web Audio voices.';
    progress.value = 0;
    void window.musicStudio.selfTestScore().then((result) => {
      progress.value = 1;
      status.textContent = result.lines.join('\n');
      shell.status(result.ok ? 'Score self-test passed' : 'Score self-test found a failure');
    });
  });

  parent.append(
    h('h2', { text: 'Cue sheet' }),
    examples,
    text,
    h('div', { class: 'inline' },
      field('Seed', seedInput),
      field('Bit depth', bitDepth),
      field('Stems', stemsBox),
      field('Pictures', picturesBox),
      field('SFX files', sfxFilesBox),
    ),
    h('div', { class: 'inline' }, validate, compose, play, stop, exportAll, selfTest),
    progress,
    status,
    canvas,
    table,
    h('h2', { text: 'Mixer' }),
    mixer,
  );

  draw(null, 0);

  async function runScore(download: boolean): Promise<void> {
    status.textContent = download ? 'Rendering and exporting…' : 'Composing…';
    progress.value = 0;
    const scored = await window.musicStudio.scoreVideo(text.value, {
      ...readOptions(),
      download,
      onProgress: (step) => {
        progress.value = step.fraction;
        status.textContent = step.message;
      },
    });
    progress.value = scored.ok ? 1 : 0;
    if (!scored.ok) {
      status.textContent = scored.error;
      shell.status(scored.error);
      return;
    }
    last = scored;
    cursor = 0;
    fillTable(scored);
    draw(scored, 0);
    const files = scored.files.length ? ` Files: ${scored.files.join(', ')}` : '';
    status.textContent = `${scored.summary}${files}`;
    shell.status(scored.summary);
  }

  function readOptions(): ScoreVideoOptions {
    const buses: NonNullable<ScoreVideoOptions['mix']>['buses'] = {};
    for (const bus of BUSES) {
      buses[bus] = {
        gainDb: num(controls[`${bus}-gain`], DEFAULT_BUS_MIX[bus].gainDb),
        pan: num(controls[`${bus}-pan`], DEFAULT_BUS_MIX[bus].pan),
        reverbSend: num(controls[`${bus}-reverb`], DEFAULT_BUS_MIX[bus].reverbSend),
        delaySend: num(controls[`${bus}-delay`], DEFAULT_BUS_MIX[bus].delaySend),
        saturation: num(controls[`${bus}-sat`], DEFAULT_BUS_MIX[bus].saturation),
      };
    }
    return {
      seed: Number(seedInput.value) || 1,
      bitDepth: bitDepth.value === '24' ? 24 : 16,
      stems: stemsBox.checked,
      pictures: picturesBox.checked,
      sfxFiles: sfxFilesBox.checked,
      musicLufs: num(controls.musicLufs, -18),
      targetLufs: num(controls.targetLufs, -16),
      ceilingDbtp: num(controls.ceiling, -1),
      duckDb: num(controls.duck, -10),
      speechDipDb: num(controls.speech, -6),
      mix: { masterGainDb: num(controls.master, 0), buses },
    };
  }

  function mixerControls(): Record<string, HTMLInputElement> {
    const inputs: Record<string, HTMLInputElement> = {};
    for (const bus of BUSES) {
      const row = h('div', { class: 'mixer-row' });
      row.append(h('strong', { text: bus }));
      inputs[`${bus}-gain`] = slider(row, 'Gain', DEFAULT_BUS_MIX[bus].gainDb, -24, 6, 0.5);
      inputs[`${bus}-pan`] = slider(row, 'Pan', DEFAULT_BUS_MIX[bus].pan, -1, 1, 0.01);
      inputs[`${bus}-reverb`] = slider(row, 'Reverb', DEFAULT_BUS_MIX[bus].reverbSend, 0, 1, 0.01);
      inputs[`${bus}-delay`] = slider(row, 'Delay', DEFAULT_BUS_MIX[bus].delaySend, 0, 1, 0.01);
      inputs[`${bus}-sat`] = slider(row, 'Sat', DEFAULT_BUS_MIX[bus].saturation, 0, 1, 0.01);
      mixer.append(row);
    }
    const master = h('div', { class: 'mixer-row' });
    inputs.master = slider(master, 'Master', 0, -12, 6, 0.5);
    inputs.musicLufs = slider(master, 'Music LUFS', -18, -24, -12, 0.5);
    inputs.targetLufs = slider(master, 'Mix LUFS', -16, -20, -12, 0.5);
    inputs.ceiling = slider(master, 'Ceiling', -1, -3, -0.5, 0.1);
    inputs.duck = slider(master, 'Duck', -10, -14, -8, 0.5);
    inputs.speech = slider(master, 'Speech dip', -6, -12, 0, 0.5);
    mixer.append(master);
    return inputs;
  }

  function fillTable(scored: ScoreSuccess): void {
    tbody.replaceChildren();
    for (const cue of scored.listenReport.perCue) {
      const sync = scored.syncReport.cues[cue.index];
      const errors = sync?.sfx.map((hit) => Math.abs(hit.errorMs)) ?? [];
      if (sync?.boundary) errors.push(Math.abs(sync.boundary.errorMs));
      const worst = errors.length ? Math.max(...errors) : 0;
      const verdict = h('td', { class: cue.verdict === 'fail' ? 'fail' : 'pass', text: cue.verdict });
      tbody.append(h('tr', null,
        h('td', { text: cue.t.toFixed(2) }),
        h('td', { text: cue.type }),
        h('td', { text: worst.toFixed(3) }),
        verdict,
        h('td', { text: cue.suggestion }),
      ));
    }
  }

  function draw(scored: ScoreSuccess | null, playhead: number): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#12141a';
    ctx.fillRect(0, 0, width, height);
    const span = Math.max(0.001, scored?.playback.seconds ?? 30);
    const xAt = (time: number) => 16 + ((width - 32) * time) / span;
    ctx.fillStyle = '#252a3d';
    for (const section of scored?.listenReport.plan.tempoMap ?? []) {
      ctx.fillRect(xAt(section.startSec), 28, Math.max(1, xAt(section.endSec) - xAt(section.startSec)), 28);
    }
    ctx.font = '14px Segoe UI, sans-serif';
    scored?.listenReport.plan.tempoMap.forEach((section, index) => {
      ctx.fillStyle = '#e8eaf0';
      ctx.fillText(`${Math.round(section.bpm) || 'free'}`, xAt(section.startSec) + 4, 46);
      ctx.fillStyle = '#a4acc4';
      ctx.fillText(scored.listenReport.plan.keys[index] ?? '', xAt(section.startSec) + 4, 24);
    });
    for (const cue of scored?.listenReport.perCue ?? []) {
      if (cue.type !== 'talking') continue;
      ctx.fillStyle = 'rgba(134, 239, 172, 0.18)';
      ctx.fillRect(xAt(cue.t), 56, Math.max(2, xAt(cue.t + cue.duration) - xAt(cue.t)), 70);
    }
    for (const cue of scored?.listenReport.markers ?? []) {
      const x = xAt(cue.t);
      ctx.strokeStyle = CUE_COLOR[cue.type] ?? '#e8eaf0';
      ctx.beginPath();
      ctx.moveTo(x, 56);
      ctx.lineTo(x, 140);
      ctx.stroke();
      ctx.fillStyle = CUE_COLOR[cue.type] ?? '#e8eaf0';
      ctx.fillText(cue.label, x + 3, 70 + (cue.t * 10) % 48);
    }
    const px = xAt(playhead);
    ctx.strokeStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(px, 16);
    ctx.lineTo(px, height - 8);
    ctx.stroke();
  }

  return { refresh() {} };
}

function slider(parent: HTMLElement, label: string, value: number, min: number, max: number, step: number): HTMLInputElement {
  const input = h('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(value) });
  parent.append(field(label, input));
  return input;
}

function num(input: HTMLInputElement | undefined, fallback: number): number {
  const value = Number(input?.value);
  return Number.isFinite(value) ? value : fallback;
}
