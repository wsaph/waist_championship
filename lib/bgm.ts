let audioCtx: AudioContext | null = null;
let bgmTimer: number | null = null;
let step = 0;

// Cheerful upbeat arcade stadium melody (frequencies in Hz, 0 = rest)
const MELODY = [
  523.25, 0, 659.25, 783.99, 0, 659.25, 587.33, 523.25,
  587.33, 0, 659.25, 523.25, 0, 392.0, 440.0, 523.25,
  659.25, 0, 783.99, 880.0, 0, 783.99, 659.25, 587.33,
  523.25, 587.33, 659.25, 0, 523.25, 0, 392.0, 0,
];

const BASS = [
  130.81, 130.81, 196.0, 196.0, 146.83, 146.83, 196.0, 196.0,
  174.61, 174.61, 130.81, 130.81, 196.0, 196.0, 130.81, 130.81,
];

function playTone(freq: number, duration: number, type: OscillatorType, gainVal: number) {
  if (!audioCtx || freq <= 0) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(gainVal, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration);
}

export function startBgm() {
  if (typeof window === 'undefined') return;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  if (bgmTimer !== null) return;

  bgmTimer = window.setInterval(() => {
    const mel = MELODY[step % MELODY.length];
    const bass = BASS[Math.floor(step / 2) % BASS.length];
    if (mel > 0) playTone(mel, 0.16, 'triangle', 0.045);
    if (step % 2 === 0 && bass > 0) playTone(bass, 0.22, 'sine', 0.04);
    step++;
  }, 190);
}

export function stopBgm() {
  if (bgmTimer !== null) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}
