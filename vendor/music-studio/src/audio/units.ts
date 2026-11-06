export function dbToLin(db: number): number {
  return Math.pow(10, db / 20);
}

export function linToDb(lin: number): number {
  if (!(lin > 0)) return Number.NEGATIVE_INFINITY;
  return 20 * Math.log10(lin);
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
