import { formatSeamText } from '../analysis/seamCheck';
import type { ListenReport } from '../analysis/listen';
import { field, h } from './dom';
import type { LoopOptions } from './loopPanel';
import type { Shell } from './transport';

export function mountExportPanel(parent: HTMLElement, shell: Shell, loopOptions: LoopOptions): { refresh(): void } {
  const bits = h('select');
  bits.append(h('option', { value: '16', text: '16-bit' }), h('option', { value: '24', text: '24-bit' }));
  const target = h('input', { type: 'number', step: '0.1', value: String(shell.project.master.targetLufs) });
  const ceiling = h('input', { type: 'number', step: '0.1', value: String(shell.project.master.ceilingDbtp) });
  const speech = h('input', { type: 'checkbox' });
  speech.checked = shell.project.master.speechPocket;
  const dip = h('input', { type: 'range', min: '-9', max: '0', step: '0.5', value: String(shell.project.master.speechDipDb) });
  const dipRead = h('span', { text: `${shell.project.master.speechDipDb} dB` });
  const pictures = h('input', { type: 'checkbox' });
  pictures.checked = true;
  const stems = h('input', { type: 'checkbox' });
  stems.checked = false;
  const go = h('button', { class: 'primary', type: 'button', text: 'Normalize + Export WAV' });
  const exportStemsBtn = h('button', { type: 'button', text: 'Export stems' });
  const out = h('div', { class: 'readout', text: 'Before / after measurements show up here.' });
  const verdict = h('div', { class: 'readout', text: '' });
  const stemsTable = h('div', { class: 'readout', text: '' });

  target.addEventListener('input', () => {
    shell.project.master.targetLufs = Number(target.value);
  });
  ceiling.addEventListener('input', () => {
    shell.project.master.ceilingDbtp = Number(ceiling.value);
  });
  speech.addEventListener('change', () => {
    shell.project.master.speechPocket = speech.checked;
  });
  dip.addEventListener('input', () => {
    shell.project.master.speechDipDb = Number(dip.value);
    dipRead.textContent = `${dip.value} dB`;
  });

  go.addEventListener('click', () => {
    go.disabled = true;
    shell.status('Rendering, normalizing, and exporting…');
    const bitDepth = Number(bits.value) as 16 | 24;
    const job = pictures.checked || stems.checked
      ? window.musicStudio.exportAll({ bitDepth, stems: stems.checked })
      : window.musicStudio.exportWav({ bitDepth });
    job
      .then(async (result) => {
        if (!result.ok) {
          shell.status(result.error);
          return;
        }
        const described = await window.musicStudio.describe();
        out.innerHTML = '';
        if (described.ok) {
          out.append(renderReadoutFromListen(described.report));
          verdict.textContent = [
            described.report.summary.paragraph,
            `Mood ${described.report.mood.requested ?? 'none'}: ${String(described.report.mood.pass)} (best ${described.report.mood.best}).`,
            `Speech room: ${described.report.speechRoom.verdict}. ${described.report.speechRoom.message}`,
          ].join('\n');
        }
        shell.status('summary' in result ? result.summary : 'Exported');
      })
      .catch((err: unknown) => {
        shell.status(err instanceof Error ? err.message : 'Export failed');
      })
      .finally(() => {
        go.disabled = false;
      });
  });

  exportStemsBtn.addEventListener('click', () => {
    exportStemsBtn.disabled = true;
    const bitDepth = Number(bits.value) as 16 | 24;
    void window.musicStudio.exportStems({ bitDepth }).then((result) => {
      if (!result.ok) {
        stemsTable.textContent = result.error;
        shell.status(result.error);
        return;
      }
      stemsTable.textContent = result.report.files
        .map((row) => `${row.file}: ${row.lufs.toFixed(2)} LUFS, ${row.truePeakDbtp.toFixed(2)} dBTP, trim ${row.trimDb.toFixed(2)} dB`)
        .join('\n');
      shell.status(result.summary);
    }).finally(() => {
      exportStemsBtn.disabled = false;
    });
  });

  parent.append(
    h('h2', { text: 'Export' }),
    field('Bit depth', bits),
    field('Target LUFS', target),
    field('Ceiling dBTP', ceiling),
    h('label', { class: 'inline' }, speech, 'Stay out of speech range'),
    field('Dip', h('span', { class: 'inline' }, dip, dipRead)),
    h('label', { class: 'inline' }, pictures, 'Include pictures + listening report'),
    h('label', { class: 'inline' }, stems, 'Export stems (mix / music / sfx)'),
    h('div', { class: 'inline' }, go, exportStemsBtn),
    out,
    verdict,
    stemsTable,
  );

  return {
    refresh() {
      if (document.activeElement !== target) target.value = String(shell.project.master.targetLufs);
      if (document.activeElement !== ceiling) ceiling.value = String(shell.project.master.ceilingDbtp);
      speech.checked = shell.project.master.speechPocket;
      if (document.activeElement !== dip) {
        dip.value = String(shell.project.master.speechDipDb);
        dipRead.textContent = `${dip.value} dB`;
      }
    },
  };
}

function num(n: number): string {
  return Number.isFinite(n) ? n.toFixed(2) : '-inf';
}

function renderReadoutFromListen(report: ListenReport): HTMLElement {
  const text = [
    `Exported  LUFS ${num(report.loudness.integratedLufs)}  short-term ${num(report.loudness.shortTermMax)}  sample ${num(report.loudness.samplePeakDbfs)} dBFS  true ${num(report.loudness.truePeakDbtp)} dBTP`,
    formatSeamText(report.seam),
  ].join('\n');
  return h('div', { class: report.seam.pass ? 'pass' : 'check', text });
}
