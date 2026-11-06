import { h } from './dom';
import type { Shell } from './transport';
import { PRESETS } from '../style/batch';
import { APP_VERSION } from '../version';

export function mountBatchPanel(parent: HTMLElement, shell: Shell): { refresh(): void } {
  const preset = h('select', { id: 'batch-preset' });
  preset.append(h('option', { value: '', text: 'Custom JSON' }));
  for (const id of PRESETS) preset.append(h('option', { value: id, text: id }));
  const plan = h('textarea', { id: 'batch-plan', rows: '4' });
  plan.value = 'fill-library-20';
  const packaging = h('select', { id: 'batch-pack' });
  packaging.append(h('option', { value: 'files', text: 'Files' }), h('option', { value: 'zip', text: 'Zip' }));
  const bit = h('select', { id: 'batch-bit' });
  bit.append(h('option', { value: '16', text: '16-bit' }), h('option', { value: '24', text: '24-bit' }));
  const pictures = h('input', { id: 'batch-pictures', type: 'checkbox' });
  const useRatings = h('input', { id: 'batch-ratings', type: 'checkbox' });
  const run = h('button', { class: 'primary', type: 'button', text: 'Run batch' });
  const cancel = h('button', { type: 'button', text: 'Cancel' });
  const bar = h('progress', { id: 'batch-progress', max: '1', value: '0' });
  const table = h('div', { id: 'batch-table', class: 'readout' });
  const version = h('p', { class: 'hint', text: APP_VERSION });

  run.addEventListener('click', () => {
    const chosen = preset.value || plan.value.trim();
    let parsed: unknown = chosen;
    if (chosen.startsWith('[') || chosen.startsWith('{')) {
      try { parsed = JSON.parse(chosen); } catch { table.textContent = 'Batch plan is not valid JSON'; return; }
    }
    table.textContent = 'Batch is running.';
    void window.musicStudio.batch(parsed as never, {
      download: false,
      packaging: packaging.value === 'zip' ? 'zip' : 'files',
      bitDepth: bit.value === '24' ? 24 : 16,
      pictures: pictures.checked,
      useRatings: useRatings.checked,
      onProgress: (progress) => {
        bar.value = progress.fraction;
        shell.status(progress.message);
      },
    }).then((result) => {
      if (!result.ok) {
        table.textContent = result.error;
        shell.status(result.error);
        return;
      }
      const lines = result.items.map((item) => {
        const row = item as { base?: string; status?: string; seed?: number; reseeds?: number; bpm?: number; lufs?: number; truePeak?: number; timingMs?: number; error?: string };
        return `${row.status} ${row.base ?? ''} seed ${row.seed ?? ''} reseeds ${row.reseeds ?? 0} bpm ${row.bpm ?? ''} LUFS ${row.lufs ?? ''} TP ${row.truePeak ?? ''} ${row.timingMs ?? 0} ms ${row.error ?? ''}`;
      });
      table.textContent = [`ok ${result.totals.ok}, error ${result.totals.error}, ${result.totals.ms} ms`, ...lines, ...result.files].join('\n');
      shell.status(`Batch ${result.batchId} finished. ${result.totals.ok} ok.`);
    }).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : 'Batch failed';
      table.textContent = message;
      shell.status(message);
    });
  });
  cancel.addEventListener('click', () => {
    window.musicStudio.cancelBatch();
    shell.status('Batch cancel requested');
  });

  const matchInput = h('textarea', { id: 'match-profile', rows: '3' });
  matchInput.placeholder = '{"mood":"hype","bpm":144} or a LIBRARY.md row';
  const matchButton = h('button', { type: 'button', text: 'Match' });
  const prefsButton = h('button', { type: 'button', text: 'Preferences' });
  const matchOut = h('div', { id: 'match-out', class: 'readout' });
  matchButton.addEventListener('click', () => {
    const text = matchInput.value.trim();
    let profile: unknown = text;
    if (text.startsWith('{')) {
      try { profile = JSON.parse(text); } catch { matchOut.textContent = 'Profile is not valid JSON'; return; }
    } else if (text.includes('|')) {
      const parsed = window.musicStudio.profileFromLibraryRow(text);
      if ('ok' in parsed && parsed.ok === false) { matchOut.textContent = parsed.error; return; }
      profile = parsed;
    }
    matchOut.textContent = 'Matching.';
    void window.musicStudio.match(profile as never, { tries: 4 }).then((result) => {
      if (!result.ok) { matchOut.textContent = result.error; return; }
      const lines = result.candidates.map((row) => `${row.style} ${row.mood} seed ${row.seed} distance ${row.distance.toFixed(3)}`);
      matchOut.textContent = [`origin synthesized, samples false`, `chosen ${result.chosen.style} ${result.chosen.mood} bpm ${result.chosen.bpm}`, ...lines].join('\n');
      shell.refresh();
    }).catch((err: unknown) => {
      matchOut.textContent = err instanceof Error ? err.message : 'Match failed';
    });
  });
  prefsButton.addEventListener('click', () => {
    const prefs = window.musicStudio.preferences();
    matchOut.textContent = `ratings ${prefs.total}, hash ${prefs.hash}, density bias ${prefs.bias.density.toFixed(3)}, brightness bias ${prefs.bias.brightness.toFixed(3)}`;
  });

  parent.append(
    h('h2', { text: 'Batch' }),
    h('div', { class: 'toolbar' }, preset, packaging, bit, h('label', { text: 'Pictures' }, pictures), h('label', { text: 'Use my ratings' }, useRatings), run, cancel),
    plan,
    bar,
    table,
    h('h2', { text: 'Match' }),
    matchInput,
    h('div', { class: 'toolbar' }, matchButton, prefsButton),
    matchOut,
    version,
  );
  return { refresh() { version.textContent = APP_VERSION; } };
}
