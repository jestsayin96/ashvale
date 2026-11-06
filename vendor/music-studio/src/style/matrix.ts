import { styleById, type StyleId } from './styles';

export const MOODS = ['hype', 'playful', 'lowkey'] as const;
export type StyleMood = (typeof MOODS)[number];

export const MOOD_POSITION = { hype: 0.8, playful: 0.5, lowkey: 0.2 } as const;
export const DENSITY_MUL = { hype: 1.25, playful: 1, lowkey: 0.6 } as const;
export const BRIGHTNESS_SHIFT = { hype: 0.1, playful: 0, lowkey: -0.12 } as const;

export const DEFAULT_STYLE: Record<StyleMood, StyleId> = {
  hype: 'arcade_upbeat',
  playful: 'chiptune_bounce',
  lowkey: 'lofi_chill',
};

export interface MoodCell {
  tempoPos: number;
  densityMul: number;
  brightnessShift: number;
  fit: 'native' | 'ok' | 'stretch';
  warning?: string;
}

const STRETCH = new Set(['ambient_calm|hype', 'lofi_chill|hype']);

export function moodCell(styleId: string, mood: StyleMood): MoodCell {
  const style = styleById(styleId);
  const native = style?.defaultMood === mood;
  const stretch = STRETCH.has(`${styleId}|${mood}`);
  const cell: MoodCell = {
    tempoPos: MOOD_POSITION[mood],
    densityMul: DENSITY_MUL[mood],
    brightnessShift: BRIGHTNESS_SHIFT[mood],
    fit: stretch ? 'stretch' : native ? 'native' : 'ok',
  };
  if (stretch) {
    cell.tempoPos = Math.min(cell.tempoPos, 0.7);
    cell.densityMul = Math.min(cell.densityMul, 0.5);
    cell.warning = `${styleId} x ${mood} is a stretch: density is clamped to 0.5 and tempo to 70% of the range`;
  }
  return cell;
}

export function tempoFromCell(range: [number, number], cell: MoodCell): number {
  return range[0] + cell.tempoPos * (range[1] - range[0]);
}
