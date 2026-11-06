import { AI_HELP, applyCommand, applyCommandAsync } from '../ai/commands';
import { looksLikeScoreInput } from '../score/api';
import { ORIGIN_NOTE, describeProject, type VideoBrief } from '../model/video';
import { STYLE_IDS } from '../style/styles';
import type { ComposeBrief } from '../style/compose';
import type { VideoRole } from '../model/types';
import { field, h } from './dom';
import type { Shell } from './transport';

const ROLES: Array<[VideoRole, string]> = [
  ['bed', 'Under talking'],
  ['music', 'Music only'],
  ['intro', 'Intro'],
  ['outro', 'Outro'],
];

export function mountVideoPanel(parent: HTMLElement, shell: Shell): { refresh(): void } {
  const role = h('select', { id: 'video-role' });
  for (const [value, label] of ROLES) role.append(h('option', { value, text: label }));
  role.value = 'bed';

  const mood = h('select', { id: 'video-mood' });
  mood.append(
    h('option', { value: 'lowkey', text: 'Low-key' }),
    h('option', { value: 'playful', text: 'Playful' }),
    h('option', { value: 'hype', text: 'Hype' }),
  );

  const seconds = h('input', { id: 'video-seconds', type: 'number', min: '2', max: '120', step: '1', value: '30' });
  const seed = h('input', { id: 'video-seed', type: 'number', step: '1', value: String(shell.project.seed || 1) });
  const style = h('select', { id: 'video-style' });
  style.append(h('option', { value: '', text: 'Legacy (no style)' }));
  for (const id of STYLE_IDS) style.append(h('option', { value: id, text: id }));
  const lengthMode = h('select', { id: 'video-length' });
  lengthMode.append(h('option', { value: '', text: 'Default length' }), h('option', { value: 'loop', text: 'Loop' }), h('option', { value: 'exact', text: 'Exact' }));
  const variety = h('select', { id: 'video-variety' });
  variety.append(h('option', { value: 'warn', text: 'Warn if similar' }), h('option', { value: 'reseed', text: 'Reseed' }), h('option', { value: 'refuse', text: 'Refuse' }), h('option', { value: 'off', text: 'Off' }));
  const useRatings = h('input', { id: 'video-ratings', type: 'checkbox' });
  const compose = h('button', { class: 'primary', type: 'button', text: 'Compose for video' });
  const summary = h('p', { class: 'readout', text: 'Pick a job, then compose. The loop can repeat under a longer video.' });

  const presets = [15, 30, 60].map((n) => {
    const button = h('button', { type: 'button', text: `${n}s` });
    button.addEventListener('click', () => {
      seconds.value = String(n);
    });
    return button;
  });

  compose.addEventListener('click', () => {
    const brief = readBrief();
    if (!brief) return;
    const result = applyCommand(shell.project, { op: 'compose', ...brief });
    if (!result.ok) {
      shell.status(result.error);
      summary.textContent = result.error;
      return;
    }
    if (result.project) shell.replaceProject(result.project);
    const similarity = result.similarity && typeof result.similarity === 'object' ? ` Nearest distance ${(result.similarity as { nearestDistance: number }).nearestDistance.toFixed(3)}.` : '';
    summary.textContent = `${result.summary}${result.fitWarning ? ` ${result.fitWarning}` : ''}${similarity}`;
    shell.status(describeProject(result.project ?? shell.project));
  });

  const command = h('textarea', { id: 'ai-command', rows: '4' });
  command.value = '{ "op": "compose", "role": "bed", "mood": "lowkey", "seconds": 30, "seed": 1 }';
  const run = h('button', { type: 'button', text: 'Run command' });
  const copy = h('button', { type: 'button', text: 'Copy AI help' });
  const commandOut = h('p', { class: 'readout', text: 'An AI can also call window.musicStudio from this page.' });

  run.addEventListener('click', () => {
    void (async () => {
      if (looksLikeScoreInput(command.value)) {
        commandOut.textContent = 'Scoring the cue sheet…';
        run.disabled = true;
        try {
          const scored = await window.musicStudio.scoreVideo(command.value);
          if (!scored.ok) {
            commandOut.textContent = scored.error;
            shell.status(scored.error);
            return;
          }
          commandOut.textContent = scored.summary;
          shell.status(scored.summary);
        } finally {
          run.disabled = false;
        }
        return;
      }
      run.disabled = true;
      try {
        const result = await applyCommandAsync(shell.project, command.value, (url) => window.musicStudio.loadSamples(url));
        if (!result.ok) {
          commandOut.textContent = result.error;
          shell.status(result.error);
          return;
        }
        if (result.project && result.op !== 'get' && result.op !== 'export' && result.op !== 'help') {
          shell.replaceProject(result.project);
        }
        if (result.op === 'export') {
          commandOut.textContent = 'Export is running through musicStudio.exportWav().';
          void window.musicStudio.exportWav();
          return;
        }
        commandOut.textContent = result.summary;
        shell.status(result.op === 'help' ? 'AI help is in the command result' : result.summary);
      } finally {
        run.disabled = false;
      }
    })();
  });

  copy.addEventListener('click', () => {
    void navigator.clipboard.writeText(AI_HELP).then(() => {
      shell.status('Copied the AI instructions');
    });
  });

  parent.append(
    h('h2', { text: 'For a video' }),
    h('div', { class: 'toolbar' },
      field('Use', role),
      field('Feel', mood),
      field('Seconds', seconds),
      ...presets,
      field('Seed', seed),
      field('Style', style),
      field('Length', lengthMode),
      field('Variety', variety),
      field('Use my ratings', useRatings),
      compose,
    ),
    summary,
    h('p', { class: 'hint', text: ORIGIN_NOTE }),
    h('h2', { text: 'AI command' }),
    command,
    h('div', { class: 'inline' }, run, copy),
    commandOut,
  );

  function readBrief(): ComposeBrief | null {
    const n = Number(seconds.value);
    if (!Number.isFinite(n) || n <= 0) {
      shell.status('Seconds must be a positive number');
      return null;
    }
    const s = Number(seed.value);
    return {
      role: role.value as VideoRole,
      mood: mood.value as VideoBrief['mood'],
      seconds: n,
      ...(style.value ? { style: style.value } : {}),
      ...(lengthMode.value === 'loop' || lengthMode.value === 'exact' ? { lengthMode: lengthMode.value as 'loop' | 'exact' } : {}),
      ...(style.value ? { varietyGuard: variety.value as 'warn' | 'reseed' | 'refuse' | 'off' } : {}),
      ...(useRatings.checked ? { useRatings: true } : {}),
      seed: Number.isFinite(s) ? s : 1,
    };
  }

  return {
    refresh() {
      if (document.activeElement !== seed) seed.value = String(shell.project.seed || 1);
      summary.textContent = shell.project.origin
        ? describeProject(shell.project)
        : 'Pick a job, then compose. The loop can repeat under a longer video.';
    },
  };
}
