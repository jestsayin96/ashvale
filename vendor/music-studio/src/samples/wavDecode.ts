/**
 * Pure-TS RIFF/WAVE decoder.
 * Supports PCM 16/24/32-bit int and IEEE float 32, mono or stereo.
 * Unknown chunks are skipped. decodeAudioData is not used.
 */

export interface DecodedWav {
  sampleRate: number;
  channels: Float32Array[];
}

function readStr(view: DataView, offset: number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) s += String.fromCharCode(view.getUint8(offset + i));
  return s;
}

function fail(message: string): never {
  throw new Error(message);
}

function readInt24(view: DataView, offset: number): number {
  const b0 = view.getUint8(offset);
  const b1 = view.getUint8(offset + 1);
  const b2 = view.getUint8(offset + 2);
  let v = b0 | (b1 << 8) | (b2 << 16);
  if (v & 0x800000) v |= ~0xffffff;
  return v;
}

export function decodeWav(bytes: ArrayBuffer | Uint8Array): DecodedWav {
  const buf = bytes instanceof Uint8Array
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    : bytes;
  if (buf.byteLength < 12) fail('WAV is too short');
  const view = new DataView(buf);
  if (readStr(view, 0, 4) !== 'RIFF') fail('WAV missing RIFF header');
  if (readStr(view, 8, 4) !== 'WAVE') fail('WAV missing WAVE marker');

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  // WAVE_FORMAT_EXTENSIBLE SubFormat GUIDs (PCM / IEEE float).
  const PCM_GUID = '0100000000001000800000aa00389b71';
  const FLOAT_GUID = '0300000000001000800000aa00389b71';

  while (offset + 8 <= view.byteLength) {
    const id = readStr(view, offset, 4);
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (body + size > view.byteLength) fail(`WAV chunk ${id} overruns the file`);
    if (id === 'fmt ') {
      if (size < 16) fail('WAV fmt chunk is too short');
      audioFormat = view.getUint16(body, true);
      channels = view.getUint16(body + 2, true);
      sampleRate = view.getUint32(body + 4, true);
      bitsPerSample = view.getUint16(body + 14, true);
      if (audioFormat === 65534) {
        if (size < 40) fail('WAVE_FORMAT_EXTENSIBLE fmt chunk is too short');
        const validBits = view.getUint16(body + 18, true);
        if (validBits > 0) bitsPerSample = validBits;
        let guid = '';
        for (let i = 0; i < 16; i++) guid += view.getUint8(body + 24 + i).toString(16).padStart(2, '0');
        if (guid === PCM_GUID) audioFormat = 1;
        else if (guid === FLOAT_GUID) audioFormat = 3;
        else fail(`Unsupported WAVE_FORMAT_EXTENSIBLE SubFormat ${guid}`);
      }
    } else if (id === 'data') {
      dataOffset = body;
      dataSize = size;
    }
    offset = body + size + (size & 1);
  }

  if (!(sampleRate > 0) || !(channels >= 1 && channels <= 2)) fail('WAV fmt chunk is missing or invalid');
  if (dataOffset < 0) fail('WAV has no data chunk');
  if (audioFormat !== 1 && audioFormat !== 3) fail(`Unsupported WAV format ${audioFormat}`);
  if (audioFormat === 1 && ![16, 24, 32].includes(bitsPerSample)) fail(`Unsupported PCM bit depth ${bitsPerSample}`);
  if (audioFormat === 3 && bitsPerSample !== 32) fail('Float WAV must be 32-bit');

  const bytesPer = bitsPerSample / 8;
  const frameSize = channels * bytesPer;
  const frames = Math.floor(dataSize / frameSize);
  const outs = Array.from({ length: channels }, () => new Float32Array(frames));

  for (let i = 0; i < frames; i++) {
    const base = dataOffset + i * frameSize;
    for (let c = 0; c < channels; c++) {
      const at = base + c * bytesPer;
      let sample = 0;
      if (audioFormat === 3) {
        sample = view.getFloat32(at, true);
      } else if (bitsPerSample === 16) {
        sample = view.getInt16(at, true) / 32768;
      } else if (bitsPerSample === 24) {
        sample = readInt24(view, at) / 8388608;
      } else {
        sample = view.getInt32(at, true) / 2147483648;
      }
      outs[c][i] = sample;
    }
  }

  return { sampleRate, channels: outs };
}
