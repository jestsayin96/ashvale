import { mulberry32 } from '../model/rng';
import { tagSeed } from './styles';

const A = ['Bouncy', 'Amber', 'Quiet', 'Neon', 'Copper', 'Little', 'Silver', 'Velvet', 'Rapid', 'Hollow', 'Bright', 'Soft'];
const B = ['Pixel', 'Harbor', 'Circuit', 'Meadow', 'Arcade', 'Lantern', 'Marble', 'Signal', 'Pocket', 'Ribbon', 'Canyon', 'Clock'];
const C = ['Run', 'Drift', 'Loop', 'March', 'Glow', 'Step', 'Wave', 'Path', 'Sketch', 'Pulse', 'Turn', 'Line'];

export function titleWords(styleId: string, seed: number): string {
  const rng = mulberry32(tagSeed(seed, `titles:${styleId}`));
  const a = A[Math.floor(rng() * A.length)];
  const b = B[Math.floor(rng() * B.length)];
  const c = C[Math.floor(rng() * C.length)];
  const n = 1 + Math.floor(rng() * 9);
  return `${a} ${b} ${c} ${n}`;
}
