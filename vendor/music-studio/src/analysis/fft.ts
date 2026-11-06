/** In-place radix-2 FFT. `re` and `im` must share a power-of-two length. */
export function fft(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (n !== im.length || n < 2 || (n & (n - 1)) !== 0) {
    throw new Error('FFT length must be a power of two');
  }
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; (j & bit) !== 0; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wlenRe = Math.cos(ang);
    const wlenIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let wRe = 1;
      let wIm = 0;
      const half = len >> 1;
      for (let j = 0; j < half; j++) {
        const ur = re[i + j];
        const ui = im[i + j];
        const vr = re[i + j + half] * wRe - im[i + j + half] * wIm;
        const vi = re[i + j + half] * wIm + im[i + j + half] * wRe;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + half] = ur - vr;
        im[i + j + half] = ui - vi;
        const next = wRe * wlenRe - wIm * wlenIm;
        wIm = wRe * wlenIm + wIm * wlenRe;
        wRe = next;
      }
    }
  }
}

/** Periodic Hann window. */
export function hann(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / n));
  return w;
}

const HANN = hann(2048);

/** One-sided power spectrum of a real frame. Bins 1..N/2-1 are doubled. */
export function powerSpectrum(frame: Float32Array, window: Float32Array = HANN): Float32Array {
  const n = window.length;
  const re = new Float32Array(n);
  const im = new Float32Array(n);
  const copy = Math.min(n, frame.length);
  for (let i = 0; i < copy; i++) re[i] = frame[i] * window[i];
  fft(re, im);
  const bins = n / 2 + 1;
  const power = new Float32Array(bins);
  for (let k = 0; k < bins; k++) {
    let p = re[k] * re[k] + im[k] * im[k];
    if (k > 0 && k < n / 2) p *= 2;
    power[k] = p;
  }
  return power;
}
