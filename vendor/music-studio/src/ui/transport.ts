import type { AudioEngine } from '../audio/engine';
import { saveProject, loadProjectFile } from '../io/projectFile';
import { applyMood } from '../model/moods';
import { NOTE_NAMES, SCALE_LABELS } from '../model/scales';
import type { Project, Scale } from '../model/types';
import { BAR_VALUES } from '../model/types';
import { field, h } from './dom';
import { APP_VERSION } from '../version';
import { runSelfTest } from './selftest';

export interface Shell {
  project: Project;
  engine: AudioEngine;
  replaceProject(project: Project): void;
  refresh(): void;
  status(text: string): void;
}

export function mountHeader(parent: HTMLElement, shell: Shell, selfOut: HTMLElement): { refresh(): void } {
  const name = h('input', { class: 'name-input', type: 'text', value: shell.project.name });
  name.addEventListener('input', () => {
    shell.project.name = name.value || 'Untitled';
  });
  const file = h('input', { type: 'file', accept: '.json,.studio.json' });
  file.hidden = true;
  file.addEventListener('change', () => {
    const picked = file.files?.[0];
    file.value = '';
    if (!picked) return;
    loadProjectFile(picked)
      .then((project) => {
        shell.replaceProject(project);
        shell.status(`Loaded ${project.name}`);
      })
      .catch((err: unknown) => {
        shell.status(err instanceof Error ? err.message : 'Could not load project');
      });
  });
  const save = h('button', { type: 'button', text: 'Save' });
  save.addEventListener('click', () => {
    saveProject(shell.project);
    shell.status('Saved project JSON to Downloads');
  });
  const load = h('button', { type: 'button', text: 'Load' });
  load.addEventListener('click', () => file.click());

  const start = h('button', { class: 'primary', type: 'button', text: 'Start audio' });
  start.addEventListener('click', () => {
    shell.engine.startAudio().then(() => {
      start.textContent = 'Audio on';
      shell.status('Audio context is running');
    });
  });

  const self = h('button', { type: 'button', text: 'Self-test' });
  self.addEventListener('click', () => {
    self.disabled = true;
    selfOut.textContent = 'Running self-test…';
    shell.status('Rendering the demo project');
    runSelfTest()
      .then((lines) => {
        selfOut.innerHTML = '';
        for (const row of lines) {
          const ok = row.startsWith('PASS');
          selfOut.append(h('div', { class: ok ? 'pass' : 'fail', text: row }));
        }
        shell.status(lines.every((row) => row.startsWith('PASS')) ? 'Self-test passed' : 'Self-test found a failure');
      })
      .catch((err: unknown) => {
        selfOut.textContent = err instanceof Error ? err.message : 'Self-test failed to run';
      })
      .finally(() => {
        self.disabled = false;
      });
  });

  const moods = (['hype', 'playful', 'lowkey'] as const).map((mood) => {
    const label = mood === 'lowkey' ? 'Low-key' : mood[0].toUpperCase() + mood.slice(1);
    const button = h('button', { type: 'button', text: label });
    button.addEventListener('click', () => {
      shell.replaceProject(applyMood(shell.project, mood, shell.project.seed || 1));
      shell.status(`${label} mood, seed ${shell.project.seed}`);
    });
    return button;
  });

  const random = h('button', { type: 'button', text: 'Randomize' });
  random.addEventListener('click', () => {
    const mood = shell.project.mood;
    if (mood !== 'hype' && mood !== 'playful' && mood !== 'lowkey') {
      shell.status('Pick a mood first');
      return;
    }
    const seed = (shell.project.seed + 0x9e3779b9) >>> 0;
    shell.replaceProject(applyMood(shell.project, mood, seed));
    shell.status(`Re-rolled seed ${seed}`);
  });

  parent.append(h('h1', { text: 'Music Studio' }), h('span', { class: 'version', text: APP_VERSION }), name, save, load, ...moods, random, start, self, file);

  return {
    refresh() {
      if (document.activeElement !== name) name.value = shell.project.name;
    },
  };
}

export function mountTransport(parent: HTMLElement, shell: Shell): { refresh(): void; syncPlay(): void } {
  const play = h('button', { class: 'primary', type: 'button', text: 'Play' });
  play.addEventListener('click', () => {
    shell.engine.toggle().then(() => syncPlay());
  });

  const bpm = h('input', { type: 'number', min: '60', max: '200', step: '1', value: String(shell.project.bpm) });
  bpm.addEventListener('input', () => {
    const n = Number(bpm.value);
    if (n >= 60 && n <= 200) shell.project.bpm = n;
  });

  const swing = h('input', { type: 'range', min: '0', max: '60', step: '1', value: String(shell.project.swing * 100) });
  const swingRead = h('span', { text: `${Math.round(shell.project.swing * 100)}%` });
  swing.addEventListener('input', () => {
    shell.project.swing = Number(swing.value) / 100;
    swingRead.textContent = `${swing.value}%`;
  });

  const bars = h('select');
  for (const value of BAR_VALUES) {
    bars.append(h('option', { value: String(value), text: String(value) }));
  }
  bars.value = String(shell.project.bars);
  bars.addEventListener('change', () => {
    shell.project.bars = Number(bars.value) as Project['bars'];
    shell.refresh();
  });

  const root = h('select');
  NOTE_NAMES.forEach((note, i) => root.append(h('option', { value: String(i), text: note })));
  root.value = String(((shell.project.key.root % 12) + 12) % 12);
  root.addEventListener('change', () => {
    shell.project.key.root = Number(root.value);
  });

  const scale = h('select');
  for (const [id, label] of Object.entries(SCALE_LABELS)) {
    scale.append(h('option', { value: id, text: label }));
  }
  scale.value = shell.project.key.scale;
  scale.addEventListener('change', () => {
    shell.project.key.scale = scale.value as Scale;
  });

  parent.append(
    play,
    field('Tempo', bpm),
    field('Swing', h('span', { class: 'inline' }, swing, swingRead)),
    field('Bars', bars),
    field('Root', root),
    field('Scale', scale),
    h('span', { class: 'hint', text: 'Space plays and stops. A–K trigger pads.' }),
  );

  function syncPlay(): void {
    play.textContent = shell.engine.playing ? 'Stop' : 'Play';
  }

  function refresh(): void {
    syncPlay();
    if (document.activeElement !== bpm) bpm.value = String(shell.project.bpm);
    if (document.activeElement !== swing) {
      swing.value = String(Math.round(shell.project.swing * 100));
      swingRead.textContent = `${swing.value}%`;
    }
    bars.value = String(shell.project.bars);
    root.value = String(((shell.project.key.root % 12) + 12) % 12);
    scale.value = shell.project.key.scale;
  }

  return { refresh, syncPlay };
}
