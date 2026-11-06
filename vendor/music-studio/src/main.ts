import './ui/styles.css';
import { installMusicStudio } from './ai/bridge';
import { AudioEngine } from './audio/engine';
import { newProject } from './model/defaults';
import type { Project } from './model/types';
import { h } from './ui/dom';
import { mountExportPanel } from './ui/exportPanel';
import { mountLoopPanel, type LoopOptions } from './ui/loopPanel';
import { mountMeters } from './ui/meters';
import { mountPads } from './ui/pads';
import { mountSequencer } from './ui/sequencer';
import { mountStingPanel } from './ui/stingPanel';
import { mountSynthPanel } from './ui/synthPanel';
import { mountRatingPanel } from './ui/ratingPanel';
import { mountHeader, mountTransport, type Shell } from './ui/transport';
import { mountCuePanel } from './ui/cuePanel';
import { mountVideoPanel } from './ui/videoPanel';
import { mountBatchPanel } from './ui/batchPanel';

const root = document.querySelector('#app');
if (!root) throw new Error('Missing #app');

const engine = new AudioEngine();
let project = newProject();
engine.project = project;
let selectedId = project.tracks[0].id;
const loopOptions: LoopOptions = { snap: false, crossfade: false, crossfadeMs: 10 };

const headerEl = h('header');
const videoEl = h('section', { class: 'panel' });
const cueEl = h('section', { class: 'panel' });
const batchEl = h('section', { class: 'panel' });
const selfOut = h('div', { class: 'readout' });
const transportEl = h('section', { class: 'transport' });
const seqEl = h('section', { class: 'panel' });
const padsEl = h('section', { class: 'panel' });
const voiceEl = h('section', { class: 'panel' });
const loopEl = h('section', { class: 'panel' });
const stingEl = h('section', { class: 'panel' });
const exportEl = h('section', { class: 'panel' });
const ratingEl = h('section', { class: 'panel' });
const meterEl = h('section', { class: 'panel' });
const statusEl = h('p', { id: 'status', class: 'hint', text: 'Click Start audio, then Play.' });

const shell: Shell = {
  get project() {
    return project;
  },
  set project(next: Project) {
    project = next;
  },
  engine,
  replaceProject(next) {
    project = next;
    engine.project = next;
    if (!next.tracks.some((t) => t.id === selectedId)) selectedId = next.tracks[0].id;
    refresh();
  },
  refresh() {
    refresh();
  },
  status(text) {
    statusEl.textContent = text;
  },
};

const header = mountHeader(headerEl, shell, selfOut);
const video = mountVideoPanel(videoEl, shell);
mountCuePanel(cueEl, shell);
mountBatchPanel(batchEl, shell);
const transport = mountTransport(transportEl, shell);
const sequencer = mountSequencer(seqEl, shell, () => selectedId, (id) => {
  selectedId = id;
});
const voice = mountSynthPanel(voiceEl, shell, () => selectedId);
const loop = mountLoopPanel(loopEl, shell, loopOptions);
mountPads(padsEl, shell);
mountStingPanel(stingEl, shell);
const exporter = mountExportPanel(exportEl, shell, loopOptions);
mountMeters(meterEl, engine);
installMusicStudio(shell, loopOptions);
const rating = mountRatingPanel(ratingEl, shell);

engine.onPlayhead = (step) => {
  sequencer.setPlayhead(step);
  if (step < 0) transport.syncPlay();
};

engine.project = project;

function refresh(): void {
  engine.project = project;
  engine.setMasterGain(project.master.gainDb);
  header.refresh();
  video.refresh();
  transport.refresh();
  sequencer.refresh();
  voice.refresh();
  loop.refresh();
  exporter.refresh();
  rating.refresh();
}

refresh();

window.addEventListener('keydown', (event) => {
  if (event.code !== 'Space' || event.repeat) return;
  const target = event.target as HTMLElement | null;
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) return;
  event.preventDefault();
  engine.toggle().then(() => transport.syncPlay());
});

root.append(
  headerEl,
  videoEl,
  cueEl,
  batchEl,
  selfOut,
  transportEl,
  seqEl,
  h('div', { class: 'mid' }, padsEl, voiceEl),
  h('div', { class: 'bottom' }, loopEl, stingEl, exportEl),
  ratingEl,
  meterEl,
  statusEl,
);
