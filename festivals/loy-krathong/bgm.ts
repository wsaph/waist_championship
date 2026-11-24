import { registerFestivalBgmTrack, type SynthBgmHelpers } from '@/lib/bgm';
import { LOY_KRATHONG_BGM_TRACK_ID, LOY_KRATHONG_YT_ID } from './catalog';

// Frequencies in Hz for fallback Ranat-Ek + Chhing Thai traditional synth
const F4 = 349.23;
const G4 = 392.0;
const A4 = 440.0;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const F5 = 698.46;
const G5 = 783.99;
const A5 = 880.0;

type NoteStep = [freq: number, holdSteps: number] | null;

const LOY_KRATHONG_MELODY: NoteStep[] = [
  null, null, [C5, 1], [C5, 1], [A4, 1], [C5, 1], [D5, 2], null,
  [F5, 5], null, null, null, null, [G5, 1], [F5, 1], [D5, 1],
  [C5, 2], null, [A4, 4], null, null, null, [C5, 1], [D5, 1],
  [F5, 2], null, [D5, 2], null, [F5, 4], null, null, null,
  [C5, 1], [D5, 1], [F5, 2], null, [G5, 4], null, null, null,
  [F5, 2], null, [D5, 1], [C5, 1], [C5, 4], null, null, null,
  [F5, 2], null, [F5, 1], [D5, 1], [F5, 4], null, null, null,
  [C5, 2], null, [C5, 1], [A4, 1], [C5, 4], null, null, null,
  [F5, 1], [F5, 1], [F5, 2], null, [G5, 2], null, [A5, 2], null,
  null, [A5, 1], [G5, 1], [F5, 1], [D5, 2], null, [C5, 1], [D5, 1],
  [F5, 2], null, [G5, 6], null, null, null, null, null,
  [E5, 2], null, [E5, 2], null, [E5, 1], [D5, 1], [C5, 2], null,
  [C5, 2], null, [C5, 2], null, [D5, 1], [C5, 1], [A4, 2], null,
  [C5, 2], null, [A4, 1], [G4, 1], [A4, 2], null, [C5, 2], null,
  [D5, 2], null, [C5, 6], null, null, null, null, null,
  [C5, 2], null, [A4, 1], [G4, 1], [A4, 2], null, [C5, 2], null,
  [G4, 2], null, [F4, 6], null, null, null, null, null,
  [F4, 2], null, [A4, 2], null, [C5, 2], null, [D5, 2], null,
];

const LOY_KRATHONG_BAR_BASS = [
  174.61, 174.61, 130.81, 174.61, 146.83, 130.81,
  174.61, 130.81, 174.61, 146.83, 130.81, 130.81,
  174.61, 174.61, 130.81, 146.83, 174.61, 130.81,
];

const STEP_SEC = 0.175;

function playThaiMalletNote(audioCtx: AudioContext, freq: number, duration: number) {
  if (freq <= 0) return;
  const now = audioCtx.currentTime;
  const mainOsc = audioCtx.createOscillator();
  const mainGain = audioCtx.createGain();
  mainOsc.type = 'triangle';
  mainOsc.frequency.setValueAtTime(freq, now);
  mainGain.gain.setValueAtTime(0.001, now);
  mainGain.gain.linearRampToValueAtTime(0.055, now + 0.01);
  mainGain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
  mainOsc.connect(mainGain);
  mainGain.connect(audioCtx.destination);
  mainOsc.start(now);
  mainOsc.stop(now + duration + 0.02);

  const overtoneOsc = audioCtx.createOscillator();
  const overtoneGain = audioCtx.createGain();
  overtoneOsc.type = 'sine';
  overtoneOsc.frequency.setValueAtTime(freq * 2, now);
  overtoneGain.gain.setValueAtTime(0.001, now);
  overtoneGain.gain.linearRampToValueAtTime(0.018, now + 0.008);
  overtoneGain.gain.exponentialRampToValueAtTime(0.0005, now + Math.min(duration * 0.65, 0.35));
  overtoneOsc.connect(overtoneGain);
  overtoneGain.connect(audioCtx.destination);
  overtoneOsc.start(now);
  overtoneOsc.stop(now + Math.min(duration * 0.65, 0.35) + 0.02);
}

function playChhing(audioCtx: AudioContext, isChhap: boolean) {
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(isChhap ? 2637 : 3136, now);
  const dur = isChhap ? 0.065 : 0.22;
  gain.gain.setValueAtTime(0.0005, now);
  gain.gain.linearRampToValueAtTime(isChhap ? 0.009 : 0.011, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0004, now + dur);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + dur + 0.01);
}

function onLoyKrathongSynthStep(stepIndex: number, { audioCtx, playTone }: SynthBgmHelpers) {
  const idx = stepIndex % LOY_KRATHONG_MELODY.length;
  const barIdx = Math.floor(idx / 8);
  const beatInBar = idx % 8;

  const note = LOY_KRATHONG_MELODY[idx];
  if (note && note[0] > 0) {
    playThaiMalletNote(audioCtx, note[0], Math.max(0.18, note[1] * STEP_SEC * 0.96));
  }
  const rootHz = LOY_KRATHONG_BAR_BASS[barIdx % LOY_KRATHONG_BAR_BASS.length];
  if (beatInBar === 0) playTone(rootHz, 0.34, 'sine', 0.042);
  else if (beatInBar === 4) playTone(rootHz * 1.5, 0.3, 'sine', 0.032);

  if (beatInBar === 2) playChhing(audioCtx, false);
  else if (beatInBar === 6) playChhing(audioCtx, true);
}

export function registerLoyKrathongBgm(): void {
  registerFestivalBgmTrack({
    trackId: LOY_KRATHONG_BGM_TRACK_ID,
    youtubeVideoId: LOY_KRATHONG_YT_ID,
    volume: 55,
    stepIntervalMs: STEP_SEC * 1000,
    onSynthStep: onLoyKrathongSynthStep,
  });
}

export function playKrathongLaunchSfx(): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.09 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.6);
    });
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 1200);
  } catch {
    // ignore audio context restriction
  }
}
