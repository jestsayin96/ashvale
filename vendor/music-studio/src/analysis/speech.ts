import { averagePower, bandShares } from './features';
import { SPEECH_PASS_MAX, SPEECH_WARN_MAX } from './targets';
import type { VideoRole } from '../model/types';

export interface SpeechRoom {
  speechShare: number;
  speechBandDbBelowTotal: number;
  restShare: number;
  role: string | null;
  threshold: { pass: number; warn: number } | null;
  verdict: 'pass' | 'warn' | 'fail' | 'n/a';
  message: string;
}

const POCKET = 'musicStudio.run({ op: "set", speechPocket: true, speechDipDb: -6 })';

export function speechRoomCheck(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  role?: VideoRole | string | null,
): SpeechRoom {
  const power = averagePower(left, right, sampleRate);
  const bands = bandShares(power, sampleRate);
  const speechShare = bands.speech.fraction;
  const speechBandDbBelowTotal = bands.speech.dbBelowTotal;
  const restShare = Math.max(0, 1 - speechShare);
  const gated = role === 'bed' || role === 'outro';
  let verdict: SpeechRoom['verdict'] = 'n/a';
  if (gated) {
    if (speechShare <= SPEECH_PASS_MAX) verdict = 'pass';
    else if (speechShare <= SPEECH_WARN_MAX) verdict = 'warn';
    else verdict = 'fail';
  }
  const pct = (speechShare * 100).toFixed(1);
  const db = speechBandDbBelowTotal.toFixed(1);
  let message = `Speech band (300-3000 Hz) is ${pct}% of the energy, ${db} dB below the total.`;
  if (verdict === 'pass') message += ` That is at or under ${(SPEECH_PASS_MAX * 100).toFixed(0)}% for a ${role}.`;
  if (verdict === 'warn' || verdict === 'fail') {
    message += ` ${verdict === 'warn' ? 'Warn' : 'Fail'} for a ${role}: above ${(SPEECH_PASS_MAX * 100).toFixed(0)}%. Turn the speech pocket on with ${POCKET}, or use a sparser pad and bass.`;
  }
  if (verdict === 'n/a') message += ' No speech-room limit for this role. Numbers only.';
  return {
    speechShare,
    speechBandDbBelowTotal,
    restShare,
    role: role ?? null,
    threshold: gated ? { pass: SPEECH_PASS_MAX, warn: SPEECH_WARN_MAX } : null,
    verdict,
    message,
  };
}
