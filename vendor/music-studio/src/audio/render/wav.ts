import { mulberry32 } from '../../model/rng';

function writeStr(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

function clampSample(x: number): number {
  if (x > 1) return 1;
  if (x < -1) return -1;
  return x;
}

export function encodeWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bitDepth: 16 | 24,
  ditherSeed = 1,
): Uint8Array {
  const frames = Math.min(left.length, right.length);
  const channels = 2;
  const bytesPer = bitDepth === 16 ? 2 : 3;
  const blockAlign = channels * bytesPer;
  const dataSize = frames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const rng = mulberry32(ditherSeed >>> 0);
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    writeOne(view, offset, left[i], bitDepth, rng);
    offset += bytesPer;
    writeOne(view, offset, right[i], bitDepth, rng);
    offset += bytesPer;
  }
  return new Uint8Array(buffer);
}

function writeOne(view: DataView, offset: number, sample: number, bitDepth: 16 | 24, rng: () => number): void {
  const clipped = clampSample(sample);
  if (bitDepth === 16) {
    const lsb = 1 / 32768;
    const dither = (rng() - rng()) * lsb;
    let q = Math.round((clipped + dither) * 32767);
    if (q > 32767) q = 32767;
    if (q < -32768) q = -32768;
    view.setInt16(offset, q, true);
    return;
  }
  let q = Math.round(clipped * 8388607);
  if (q > 8388607) q = 8388607;
  if (q < -8388608) q = -8388608;
  view.setUint8(offset, q & 0xff);
  view.setUint8(offset + 1, (q >> 8) & 0xff);
  view.setUint8(offset + 2, (q >> 16) & 0xff);
}
