import type { AudioEngine } from '../audio/engine';
import { linToDb } from '../audio/units';
import { h } from './dom';

export function mountMeters(parent: HTMLElement, engine: AudioEngine): void {
  const bar = h('span');
  const read = h('p', { class: 'readout', text: 'Peak —' });
  parent.append(h('h2', { text: 'Meters' }), h('div', { class: 'meter' }, bar), read);
  const data = new Float32Array(2048);
  const frame = (): void => {
    const analyser = engine.meter;
    if (analyser) {
      analyser.getFloatTimeDomainData(data);
      let peak = 0;
      for (let i = 0; i < data.length; i++) {
        const a = data[i] < 0 ? -data[i] : data[i];
        if (a > peak) peak = a;
      }
      const db = linToDb(peak);
      const width = Math.max(0, Math.min(100, ((db + 48) / 48) * 100));
      bar.style.width = `${Number.isFinite(db) ? width : 0}%`;
      read.textContent = Number.isFinite(db) ? `Peak ${db.toFixed(1)} dBFS` : 'Peak -inf';
    }
    requestAnimationFrame(frame);
  };
  frame();
}
