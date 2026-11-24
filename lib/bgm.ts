export type BgmTrack = 'loy_krathong' | 'arena';

// Official YouTube video requested: "เพลงลอยกระทง 🌕 รำวงลอยกระทง ดั้งเดิม | วันเพ็ญเดือนสิบสอง"
const LOY_KRATHONG_YT_ID = '95s3Y8nVMV4';

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  unMute: () => void;
  setVolume: (volume: number) => void;
  getPlayerState?: () => number;
}

interface YTGlobal {
  Player: new (
    elementId: string | HTMLElement,
    options: {
      width?: string | number;
      height?: string | number;
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (ev: { target: YTPlayerInstance }) => void;
        onStateChange?: (ev: { data: number; target: YTPlayerInstance }) => void;
        onError?: () => void;
      };
    }
  ) => YTPlayerInstance;
}

declare global {
  interface Window {
    YT?: YTGlobal;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let audioCtx: AudioContext | null = null;
let bgmTimer: number | null = null;
let step = 0;
let currentTrack: BgmTrack = 'loy_krathong';
let wantPlaying = false;

let ytPlayer: YTPlayerInstance | null = null;
let ytReady = false;
let ytInitStarted = false;
let ytFailed = false;

// Frequencies in Hz for fallback Ranat-Ek / Arena synth
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

const ARENA_MELODY = [
  523.25, 0, 659.25, 783.99, 0, 659.25, 587.33, 523.25,
  587.33, 0, 659.25, 523.25, 0, 392.0, 440.0, 523.25,
  659.25, 0, 783.99, 880.0, 0, 783.99, 659.25, 587.33,
  523.25, 587.33, 659.25, 0, 523.25, 0, 392.0, 0,
];

const ARENA_BASS = [
  130.81, 130.81, 196.0, 196.0, 146.83, 146.83, 196.0, 196.0,
  174.61, 174.61, 130.81, 130.81, 196.0, 196.0, 130.81, 130.81,
];

function stopSynthTimer() {
  if (bgmTimer !== null) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
}

function ensureAudioCtx(): boolean {
  if (typeof window === 'undefined') return false;
  if (!audioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return true;
}

function playTone(freq: number, duration: number, type: OscillatorType, gainVal: number) {
  if (!audioCtx || freq <= 0) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(gainVal, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playThaiMalletNote(freq: number, duration: number) {
  if (!audioCtx || freq <= 0) return;
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

function playChhing(isChhap: boolean) {
  if (!audioCtx) return;
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

function startSynthFallbackLoyKrathong() {
  if (!ensureAudioCtx() || bgmTimer !== null) return;
  const stepSec = 0.175;
  bgmTimer = window.setInterval(() => {
    const idx = step % LOY_KRATHONG_MELODY.length;
    const barIdx = Math.floor(idx / 8);
    const beatInBar = idx % 8;

    const note = LOY_KRATHONG_MELODY[idx];
    if (note && note[0] > 0) {
      playThaiMalletNote(note[0], Math.max(0.18, note[1] * stepSec * 0.96));
    }
    const rootHz = LOY_KRATHONG_BAR_BASS[barIdx % LOY_KRATHONG_BAR_BASS.length];
    if (beatInBar === 0) playTone(rootHz, 0.34, 'sine', 0.042);
    else if (beatInBar === 4) playTone(rootHz * 1.5, 0.3, 'sine', 0.032);

    if (beatInBar === 2) playChhing(false);
    else if (beatInBar === 6) playChhing(true);
    step++;
  }, stepSec * 1000);
}

function startArenaSynth() {
  if (!ensureAudioCtx() || bgmTimer !== null) return;
  bgmTimer = window.setInterval(() => {
    const mel = ARENA_MELODY[step % ARENA_MELODY.length];
    const bass = ARENA_BASS[Math.floor(step / 2) % ARENA_BASS.length];
    if (mel > 0) playTone(mel, 0.16, 'triangle', 0.045);
    if (step % 2 === 0 && bass > 0) playTone(bass, 0.22, 'sine', 0.04);
    step++;
  }, 190);
}

/**
 * Pre-loads the hidden YouTube IFrame Player for 95s3Y8nVMV4 on mount
 * so clicking anywhere in the arena starts the song instantaneously!
 */
export function preloadBgm() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (ytInitStarted || ytFailed) return;
  ytInitStarted = true;

  let hostEl = document.getElementById('waist-yt-bgm-host');
  if (!hostEl) {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    wrapper.style.bottom = '0px';
    wrapper.style.width = '200px';
    wrapper.style.height = '113px';
    wrapper.style.opacity = '0.01';
    wrapper.style.pointerEvents = 'none';
    wrapper.style.zIndex = '-1';
    wrapper.setAttribute('aria-hidden', 'true');

    hostEl = document.createElement('div');
    hostEl.id = 'waist-yt-bgm-host';
    wrapper.appendChild(hostEl);
    document.body.appendChild(wrapper);
  }

  const createPlayer = () => {
    if (!window.YT?.Player || ytPlayer) return;
    try {
      ytPlayer = new window.YT.Player('waist-yt-bgm-host', {
        width: 200,
        height: 113,
        videoId: LOY_KRATHONG_YT_ID,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          loop: 1,
          playlist: LOY_KRATHONG_YT_ID,
          origin: window.location.origin,
        },
        events: {
          onReady: (ev) => {
            ytReady = true;
            try {
              ev.target.unMute();
              ev.target.setVolume(55);
              if (wantPlaying && currentTrack === 'loy_krathong') {
                stopSynthTimer();
                ev.target.playVideo();
              }
            } catch {
              // ignore
            }
          },
          onStateChange: (ev) => {
            // 0 === YT.PlayerState.ENDED -> loop seamlessly
            if (ev.data === 0 && wantPlaying && currentTrack === 'loy_krathong') {
              try {
                ev.target.seekTo(0, true);
                ev.target.playVideo();
              } catch {
                // ignore
              }
            }
          },
          onError: () => {
            ytFailed = true;
            ytReady = false;
            if (wantPlaying && currentTrack === 'loy_krathong') {
              startSynthFallbackLoyKrathong();
            }
          },
        },
      });
    } catch {
      ytFailed = true;
      if (wantPlaying && currentTrack === 'loy_krathong') {
        startSynthFallbackLoyKrathong();
      }
    }
  };

  if (window.YT?.Player) {
    createPlayer();
    return;
  }

  const prevCallback = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => {
    if (typeof prevCallback === 'function') prevCallback();
    createPlayer();
  };

  if (!document.getElementById('waist-yt-iframe-api')) {
    const tag = document.createElement('script');
    tag.id = 'waist-yt-iframe-api';
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.onerror = () => {
      ytFailed = true;
      if (wantPlaying && currentTrack === 'loy_krathong') {
        startSynthFallbackLoyKrathong();
      }
    };
    document.head.appendChild(tag);
  }
}

export function isBgmPlaying(): boolean {
  return wantPlaying;
}

export function startBgm(track?: BgmTrack) {
  if (typeof window === 'undefined') return;
  if (track) currentTrack = track;
  wantPlaying = true;

  if (currentTrack === 'loy_krathong') {
    stopSynthTimer();
    if (ytFailed) {
      startSynthFallbackLoyKrathong();
      return;
    }
    preloadBgm();
    if (ytPlayer && ytReady) {
      try {
        ytPlayer.unMute();
        ytPlayer.setVolume(55);
        ytPlayer.playVideo();
      } catch {
        startSynthFallbackLoyKrathong();
      }
    }
  } else {
    if (ytPlayer && ytReady) {
      try {
        ytPlayer.pauseVideo();
      } catch {
        // ignore
      }
    }
    stopSynthTimer();
    startArenaSynth();
  }
}

export function stopBgm() {
  wantPlaying = false;
  stopSynthTimer();
  if (ytPlayer && ytReady) {
    try {
      ytPlayer.pauseVideo();
    } catch {
      // ignore
    }
  }
}
