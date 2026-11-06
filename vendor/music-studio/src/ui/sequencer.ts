import { drumParams, emptyStep, makePattern, samplerParams, synthParams } from '../model/defaults';
import { noteName, scaleNotesBetween } from '../model/scales';
import type { DrumVoice, Pattern, Project, SamplerParams, Step, SynthVoice, Track } from '../model/types';
import { loadLibraryLabel } from '../ai/commands';
import { addSampleFromBytes, getCachedLibrary, listSamples, setCachedLibrary } from '../samples/library';
import { TRACK_LIMIT } from '../style/targets';
import type { Shell } from './transport';
import { h } from './dom';

export { loadLibraryLabel };

const DRUMS: DrumVoice[] = ['kick', 'snare', 'clap', 'hatClosed', 'hatOpen', 'tom', 'rim', 'kick808', 'shaker', 'crash', 'chipNoise', 'snareTight'];
const SYNTHS: SynthVoice[] = ['lead', 'bass', 'pad', 'pluck', 'pulse', 'bell', 'strings', 'brass', 'pizz', 'sub808'];
const SLOT_CYCLE = ['A', 'B', 'C', 'D', null] as const;

export function mountSequencer(parent: HTMLElement, shell: Shell, getSelected: () => string, setSelected: (id: string) => void): {
  refresh(): void;
  setPlayhead(step: number): void;
} {
  const list = h('div');
  const arranger = h('div', { class: 'arranger' });
  const pages: Record<string, number> = {};
  const activeSlot: Record<string, string> = {};
  let playStep = -1;
  let pickerStep: { trackId: string; index: number } | null = null;

  const picker = h('div', { class: 'panel' });
  picker.hidden = true;
  const pickerNotes = h('div', { class: 'notes' });
  const vel = h('input', { type: 'range', min: '0', max: '1', step: '0.01' });
  const len = h('input', { type: 'range', min: '1', max: '16', step: '1' });
  const off = h('button', { type: 'button', text: 'Off' });
  picker.append(h('strong', { text: 'Note' }), pickerNotes, h('label', { class: 'field', text: 'Velocity' }, vel), h('label', { class: 'field', text: 'Length' }, len), off);

  const addDrumVoice = h('select');
  for (const voice of DRUMS) addDrumVoice.append(h('option', { value: voice, text: voice }));
  const addSynthVoice = h('select');
  for (const voice of SYNTHS) addSynthVoice.append(h('option', { value: voice, text: voice }));
  const addDrum = h('button', { type: 'button', text: 'Add drum' });
  const addSynth = h('button', { type: 'button', text: 'Add synth' });
  const addSample = h('button', { type: 'button', text: 'Add sample' });
  const remove = h('button', { type: 'button', text: 'Remove track' });
  const loadSamples = h('input', { type: 'file', accept: '.wav,audio/wav,application/json,.json', multiple: 'true' });
  loadSamples.title = 'Load WAV samples';
  const loadLibrary = h('button', { type: 'button', text: 'Load library' });
  const libraryOut = h('span', { class: 'hint', text: '' });

  addDrum.addEventListener('click', () => addTrack('drum', addDrumVoice.value as DrumVoice));
  addSynth.addEventListener('click', () => addTrack('synth', addSynthVoice.value as SynthVoice));
  addSample.addEventListener('click', () => addSampleTrack());
  remove.addEventListener('click', () => {
    if (shell.project.tracks.length <= 1) return;
    shell.project.tracks = shell.project.tracks.filter((t) => t.id !== getSelected());
    setSelected(shell.project.tracks[0].id);
    shell.refresh();
  });
  loadSamples.addEventListener('change', () => {
    void importSamples(loadSamples.files);
    loadSamples.value = '';
  });
  loadLibrary.addEventListener('click', () => {
    void (async () => {
      loadLibrary.disabled = true;
      try {
        const result = await window.musicStudio.loadSamples();
        const label = loadLibraryLabel(result);
        libraryOut.textContent = label;
        if (result.ok && result.warnings.length) {
          libraryOut.title = result.warnings.join('\n');
        } else {
          libraryOut.title = '';
        }
        shell.status(label);
        refresh();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Load library failed';
        libraryOut.textContent = message;
        shell.status(message);
      } finally {
        loadLibrary.disabled = false;
      }
    })();
  });

  parent.append(
    h('div', { class: 'toolbar' }, h('h2', { text: 'Sequencer' }), addDrumVoice, addDrum, addSynthVoice, addSynth, addSample, remove, h('label', { class: 'field', text: 'Load WAV samples' }, loadSamples), loadLibrary, libraryOut),
    list,
    h('div', { class: 'panel' }, h('strong', { text: 'Arranger' }), arranger),
    picker,
  );

  function atLimit(): boolean {
    return shell.project.tracks.length >= TRACK_LIMIT;
  }

  function addTrack(kind: 'drum' | 'synth', voice: DrumVoice | SynthVoice): void {
    if (atLimit()) {
      shell.status(`${TRACK_LIMIT} tracks is the maximum`);
      return;
    }
    const id = `${voice}-${Math.floor(Math.random() * 1e6).toString(16)}`;
    const track: Track = kind === 'drum'
      ? {
          id, name: voice, kind, voice: voice as DrumVoice,
          params: drumParams(), gainDb: -8, pan: 0, mute: false, solo: false,
          pattern: { length: 16, steps: Array.from({ length: 16 }, () => emptyStep()) },
        }
      : {
          id, name: voice, kind, voice: voice as SynthVoice,
          params: synthParams({ wave: voice === 'bass' ? 'square' : voice === 'pad' ? 'sawtooth' : 'triangle', octave: voice === 'bass' ? -1 : 0 }),
          gainDb: -10, pan: 0, mute: false, solo: false,
          pattern: { length: 16, steps: Array.from({ length: 16 }, () => emptyStep()) },
        };
    shell.project.tracks.push(track);
    setSelected(id);
    shell.refresh();
  }

  function addSampleTrack(): void {
    if (atLimit()) {
      shell.status(`${TRACK_LIMIT} tracks is the maximum`);
      return;
    }
    const samples = listSamples();
    const sampleId = samples[0]?.id ?? 'missing';
    const id = `sample-${Math.floor(Math.random() * 1e6).toString(16)}`;
    const pattern = makePattern(16, [{ i: 0, vel: 0.8 }]);
    const track: Track = {
      id,
      name: samples[0]?.id ?? 'Sample',
      kind: 'sample',
      voice: 'sampler',
      params: samplerParams({ sampleId, group: samples[0]?.group }),
      gainDb: -6,
      pan: 0,
      mute: false,
      solo: false,
      pattern,
      slots: [
        { id: 'A', name: 'A', pattern },
        { id: 'B', name: 'B', pattern: makePattern(16) },
      ],
      arrangement: structureSections(shell.project).map((section) => ({ section: section.name, slot: 'A' as string | null })),
    };
    shell.project.tracks.push(track);
    setSelected(id);
    shell.refresh();
  }

  async function importSamples(files: FileList | null): Promise<void> {
    if (!files || files.length === 0) return;
    const library = getCachedLibrary();
    let added = 0;
    const warnings: string[] = [];
    for (const file of Array.from(files)) {
      if (file.name.toLowerCase().endsWith('.json')) continue;
      const bytes = await file.arrayBuffer();
      const id = file.name.replace(/\.wav$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const result = addSampleFromBytes(library, id, bytes, { file: file.name });
      if (result.ok) added += 1;
      else warnings.push(result.error);
    }
    setCachedLibrary(library, warnings);
    shell.status(added ? `Loaded ${added} sample(s)` : `No samples loaded. ${warnings.join('; ')}`);
    refresh();
  }

  off.addEventListener('click', () => {
    const found = currentStep();
    if (!found) return;
    found.step.on = false;
    picker.hidden = true;
    refresh();
  });
  vel.addEventListener('input', () => {
    const found = currentStep();
    if (!found) return;
    found.step.vel = Number(vel.value);
  });
  len.addEventListener('input', () => {
    const found = currentStep();
    if (!found) return;
    found.step.len = Number(len.value);
  });

  function currentStep(): { step: Step } | null {
    if (!pickerStep) return null;
    const track = shell.project.tracks.find((t) => t.id === pickerStep?.trackId);
    if (!track) return null;
    return { step: track.pattern.steps[pickerStep.index] };
  }

  function openPicker(track: Track, index: number, step: Step): void {
    pickerStep = { trackId: track.id, index };
    picker.hidden = false;
    vel.value = String(step.vel);
    len.value = String(step.len);
    pickerNotes.innerHTML = '';
    const from = track.voice === 'bass' ? 36 : track.voice === 'pad' ? 48 : 60;
    const notes = scaleNotesBetween(shell.project.key.root, shell.project.key.scale, from, from + 24);
    for (const note of notes) {
      const button = h('button', { type: 'button', text: noteName(note) });
      if (step.note === note) button.classList.add('on');
      button.addEventListener('click', () => {
        step.on = true;
        step.note = note;
        if (step.vel <= 0) step.vel = 0.8;
        openPicker(track, index, step);
        refresh();
        picker.hidden = false;
      });
      pickerNotes.append(button);
    }
  }

  function refresh(): void {
    const selected = getSelected();
    addDrum.disabled = atLimit();
    addSynth.disabled = atLimit();
    addSample.disabled = atLimit();
    remove.disabled = shell.project.tracks.length <= 1;
    list.innerHTML = '';
    for (const track of shell.project.tracks) {
      list.append(renderTrack(track, track.id === selected));
    }
    renderArranger();
    setPlayhead(playStep);
  }

  function ensureSlots(track: Track): void {
    if (!track.slots || track.slots.length === 0) {
      track.slots = [
        { id: 'A', name: 'A', pattern: track.pattern },
        { id: 'B', name: 'B', pattern: makePattern(track.pattern.length) },
      ];
    }
    if (!track.arrangement) {
      track.arrangement = structureSections(shell.project).map((section) => ({ section: section.name, slot: 'A' as string | null }));
    }
  }

  function renderTrack(track: Track, selected: boolean): HTMLElement {
    if (track.kind === 'sample') ensureSlots(track);
    const editingSlot = activeSlot[track.id] ?? 'A';
    if (track.kind === 'sample' && track.slots) {
      const slot = track.slots.find((row) => row.id === editingSlot);
      if (slot) track.pattern = slot.pattern;
    }
    const pageSize = 64;
    const pagesCount = Math.max(1, Math.ceil(track.pattern.length / pageSize));
    const page = Math.min(pages[track.id] ?? 0, pagesCount - 1);
    pages[track.id] = page;
    const name = h('button', { class: 'track-name', type: 'button', text: track.name });
    name.addEventListener('click', () => {
      setSelected(track.id);
      shell.refresh();
    });
    const mute = h('button', { type: 'button', text: track.mute ? 'Muted' : 'Mute' });
    if (track.mute) mute.classList.add('on');
    mute.addEventListener('click', () => {
      track.mute = !track.mute;
      refresh();
    });
    const solo = h('button', { type: 'button', text: track.solo ? 'Solo' : 'Solo' });
    solo.textContent = track.solo ? 'Solo on' : 'Solo';
    if (track.solo) solo.classList.add('on');
    solo.addEventListener('click', () => {
      track.solo = !track.solo;
      refresh();
    });
    const gain = h('input', { type: 'range', min: '-24', max: '6', step: '0.5', value: String(track.gainDb) });
    const gainRead = h('span', { text: `${track.gainDb.toFixed(1)} dB` });
    gain.addEventListener('input', () => {
      track.gainDb = Number(gain.value);
      gainRead.textContent = `${track.gainDb.toFixed(1)} dB`;
    });
    const pan = h('input', { type: 'range', min: '-1', max: '1', step: '0.01', value: String(track.pan) });
    const panRead = h('span', { text: track.pan.toFixed(2) });
    pan.addEventListener('input', () => {
      track.pan = Number(pan.value);
      panRead.textContent = track.pan.toFixed(2);
    });
    const length = h('select');
    for (const value of [16, 32, 64, 128, 256, 512, 1024, 2048]) length.append(h('option', { value: String(value), text: `${value} steps` }));
    length.value = String(track.pattern.length);
    length.addEventListener('change', () => {
      track.pattern = resize(track.pattern, Number(length.value));
      if (track.slots) {
        for (const slot of track.slots) {
          if (slot.id === editingSlot) slot.pattern = track.pattern;
          else slot.pattern = resize(slot.pattern, Number(length.value));
        }
      }
      refresh();
    });

    const extras: HTMLElement[] = [];
    if (track.kind === 'sample') {
      extras.push(renderSampleControls(track, editingSlot));
    }

    const steps = h('div', { class: 'steps' });
    const start = page * pageSize;
    for (let i = start; i < Math.min(track.pattern.length, start + pageSize); i++) {
      const step = track.pattern.steps[i];
      const cell = h('button', {
        class: `step${step.on ? ' on' : ''}${i % 4 === 0 ? ' beat' : ''}`,
        type: 'button',
        title: step.note !== undefined ? noteName(step.note) : track.voice,
      });
      cell.dataset.track = track.id;
      cell.dataset.i = String(i);
      cell.addEventListener('click', () => {
        setSelected(track.id);
        if (track.kind === 'drum' || track.kind === 'sample') {
          step.on = !step.on;
          if (track.kind === 'sample' && step.on && step.note === undefined) {
            step.note = (track.params as SamplerParams).rootMidi;
          }
          shell.refresh();
        } else {
          if (!step.on && step.note === undefined) {
            const notes = scaleNotesBetween(shell.project.key.root, shell.project.key.scale, 48, 72);
            step.note = notes[0] ?? 60;
          }
          openPicker(track, i, step);
          shell.refresh();
          picker.hidden = false;
        }
      });
      steps.append(cell);
    }

    const pager = h('div', { class: 'inline' });
    if (pagesCount > 1) {
      for (let p = 0; p < pagesCount; p++) {
        const button = h('button', { type: 'button', text: `Page ${p + 1}` });
        if (p === page) button.classList.add('on');
        button.addEventListener('click', () => {
          pages[track.id] = p;
          refresh();
        });
        pager.append(button);
      }
    }

    return h(
      'div',
      { class: `track${selected ? ' selected' : ''}` },
      h('div', { class: 'track-meta' }, name, h('div', { class: 'inline' }, mute, solo, length), h('label', { class: 'field', text: 'Gain' }, gain, gainRead), h('label', { class: 'field', text: 'Pan' }, pan, panRead), ...extras),
      h('div', null, steps, pager),
    );
  }

  function renderSampleControls(track: Track, editingSlot: string): HTMLElement {
    ensureSlots(track);
    const params = track.params as SamplerParams;
    const sampleSelect = h('select');
    const rows = listSamples(getCachedLibrary());
    if (rows.length === 0) sampleSelect.append(h('option', { value: params.sampleId, text: `${params.sampleId} (missing)` }));
    for (const row of rows) {
      sampleSelect.append(h('option', { value: row.id, text: `${row.id} (${row.type})` }));
    }
    sampleSelect.value = params.sampleId;
    sampleSelect.addEventListener('change', () => {
      params.sampleId = sampleSelect.value;
      const meta = rows.find((row) => row.id === params.sampleId);
      if (meta) params.group = meta.group;
      shell.refresh();
    });

    const slots = h('div', { class: 'inline' });
    for (const slot of track.slots ?? []) {
      const button = h('button', { type: 'button', text: slot.name });
      if (slot.id === editingSlot) button.classList.add('on');
      button.addEventListener('click', () => {
        activeSlot[track.id] = slot.id;
        track.pattern = slot.pattern;
        refresh();
      });
      slots.append(button);
    }
    const addSlot = h('button', { type: 'button', text: '+' });
    addSlot.addEventListener('click', () => {
      const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
      const next = ids.find((id) => !(track.slots ?? []).some((slot) => slot.id === id));
      if (!next) return;
      track.slots = [...(track.slots ?? []), { id: next, name: next, pattern: makePattern(track.pattern.length) }];
      activeSlot[track.id] = next;
      refresh();
    });
    slots.append(addSlot);

    const pitch = h('input', { type: 'range', min: '-24', max: '24', step: '1', value: String(params.pitchSemis) });
    const pitchRead = h('span', { text: `${params.pitchSemis}` });
    pitch.addEventListener('input', () => {
      params.pitchSemis = Number(pitch.value);
      pitchRead.textContent = String(params.pitchSemis);
    });
    const start = h('input', { type: 'range', min: '0', max: '4', step: '0.01', value: String(params.start) });
    const startRead = h('span', { text: params.start.toFixed(2) });
    start.addEventListener('input', () => {
      params.start = Number(start.value);
      startRead.textContent = params.start.toFixed(2);
    });
    const end = h('input', { type: 'range', min: '0', max: '8', step: '0.01', value: String(params.end ?? 0) });
    const endRead = h('span', { text: params.end === null ? 'end' : params.end.toFixed(2) });
    end.addEventListener('input', () => {
      const value = Number(end.value);
      params.end = value <= 0 ? null : value;
      endRead.textContent = params.end === null ? 'end' : params.end.toFixed(2);
    });
    const sampleGain = h('input', { type: 'range', min: '-24', max: '6', step: '0.5', value: String(params.gainDb) });
    const sampleGainRead = h('span', { text: `${params.gainDb.toFixed(1)} dB` });
    sampleGain.addEventListener('input', () => {
      params.gainDb = Number(sampleGain.value);
      sampleGainRead.textContent = `${params.gainDb.toFixed(1)} dB`;
    });
    const loop = h('input', { type: 'checkbox' });
    loop.checked = params.loop;
    loop.addEventListener('change', () => {
      params.loop = loop.checked;
    });
    const attack = h('input', { type: 'range', min: '0', max: '1', step: '0.001', value: String(params.adsr.a) });
    attack.addEventListener('input', () => { params.adsr.a = Number(attack.value); });
    const release = h('input', { type: 'range', min: '0', max: '2', step: '0.01', value: String(params.adsr.r) });
    release.addEventListener('input', () => { params.adsr.r = Number(release.value); });

    return h(
      'div',
      { class: 'sample-controls' },
      h('label', { class: 'field', text: 'Sample' }, sampleSelect),
      h('div', { class: 'inline' }, h('span', { text: 'Slots' }), slots),
      h('label', { class: 'field', text: 'Pitch' }, pitch, pitchRead),
      h('label', { class: 'field', text: 'Start s' }, start, startRead),
      h('label', { class: 'field', text: 'End s' }, end, endRead),
      h('label', { class: 'field', text: 'Sample gain' }, sampleGain, sampleGainRead),
      h('label', { class: 'field', text: 'Loop' }, loop),
      h('label', { class: 'field', text: 'Attack' }, attack),
      h('label', { class: 'field', text: 'Release' }, release),
    );
  }

  function renderArranger(): void {
    arranger.innerHTML = '';
    const sections = structureSections(shell.project);
    if (sections.length === 0) {
      arranger.append(h('p', { class: 'hint', text: 'Compose a styled project (or set sections) to edit the arranger grid.' }));
      return;
    }
    const header = h('div', { class: 'arranger-row' }, h('span', { text: 'Track' }), ...sections.map((section) => h('span', { text: section.name })));
    arranger.append(header);
    for (const track of shell.project.tracks) {
      if (track.kind !== 'sample' && !track.arrangement) continue;
      ensureSlots(track);
      const cells = sections.map((section) => {
        const cell = track.arrangement?.find((row) => row.section === section.name);
        const label = cell?.slot ?? 'off';
        const button = h('button', { type: 'button', text: String(label) });
        button.addEventListener('click', () => {
          if (!track.arrangement) return;
          const row = track.arrangement.find((item) => item.section === section.name);
          if (!row) return;
          const index = SLOT_CYCLE.indexOf((row.slot as typeof SLOT_CYCLE[number]) ?? null);
          row.slot = SLOT_CYCLE[(index + 1) % SLOT_CYCLE.length];
          refresh();
        });
        return button;
      });
      arranger.append(h('div', { class: 'arranger-row' }, h('span', { text: track.name }), ...cells));
    }
  }

  function setPlayhead(step: number): void {
    playStep = step;
    list.querySelectorAll('.step.play').forEach((el) => el.classList.remove('play'));
    if (step < 0) return;
    for (const track of shell.project.tracks) {
      const local = step % track.pattern.length;
      const cell = list.querySelector(`[data-track="${CSS.escape(track.id)}"][data-i="${local}"]`);
      cell?.classList.add('play');
    }
  }

  return { refresh, setPlayhead };
}

function structureSections(project: Project): Array<{ name: string; bars: number }> {
  return project.sections ?? project.style?.structure ?? [];
}

function resize(pattern: Pattern, length: number): Pattern {
  const steps = pattern.steps.slice(0, length);
  while (steps.length < length) steps.push(emptyStep());
  return { length, steps };
}

export function selectedTrack(project: Project, id: string): Track {
  return project.tracks.find((t) => t.id === id) ?? project.tracks[0];
}
