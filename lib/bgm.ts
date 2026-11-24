export type BgmTrack = 'arena' | (string & {});

export interface SynthBgmHelpers {
  audioCtx: AudioContext;
  playTone: (freq: number, duration: number, type: OscillatorType, gainVal: number) => void;
}

export interface FestivalBgmTrackSpec {
  trackId: string;
  youtubeVideoId?: string;
  volume?: number;
  stepIntervalMs: number;
  onSynthStep: (stepIndex: number, helpers: SynthBgmHelpers) => void;
}

interface YTPlayerInstance {
  playVideo: () => void;
  pauseVideo: () => void;
  stopVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  loadVideoById?: (videoId: string, startSeconds?: number) => void;
  cueVideoById?: (videoId: string, startSeconds?: number) => void;
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

const festivalTracks = new Map<string, FestivalBgmTrackSpec>();

let audioCtx: AudioContext | null = null;
let bgmTimer: number | null = null;
let step = 0;
let currentTrack: BgmTrack = 'arena';
let wantPlaying = false;

let ytPlayer: YTPlayerInstance | null = null;
let ytLoadedVideoId: string | null = null;
let ytTargetVideoId: string | null = null;
let ytReady = false;
let ytInitStarted = false;
let ytFailed = false;

// Hokkaido Winter Crystal Music-Box RPG Melody (F Major / D Minor sparkling chime)
const ARENA_MELODY = [
  698.46, 880.0, 1046.5, 0, 1174.66, 1046.5, 880.0, 783.99,
  698.46, 0, 587.33, 698.46, 880.0, 0, 783.99, 0,
  880.0, 1046.5, 1318.51, 0, 1174.66, 1046.5, 880.0, 698.46,
  783.99, 880.0, 698.46, 0, 587.33, 659.25, 698.46, 0,
];

const ARENA_SHIMMER = [
  1396.91, 0, 0, 1760.0, 0, 0, 1567.98, 0,
  1174.66, 0, 0, 1396.91, 0, 0, 1567.98, 0,
];

const ARENA_BASS = [
  174.61, 261.63, 146.83, 220.0, 196.0, 293.66, 130.81, 196.0,
  174.61, 261.63, 220.0, 329.63, 196.0, 261.63, 174.61, 174.61,
];

export function registerFestivalBgmTrack(spec: FestivalBgmTrackSpec): void {
  festivalTracks.set(spec.trackId, spec);
}

export function getRegisteredFestivalBgmTrack(trackId: string): FestivalBgmTrackSpec | undefined {
  return festivalTracks.get(trackId);
}

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

function startArenaSynth() {
  if (!ensureAudioCtx() || bgmTimer !== null) return;
  bgmTimer = window.setInterval(() => {
    const mel = ARENA_MELODY[step % ARENA_MELODY.length];
    const shimmer = ARENA_SHIMMER[step % ARENA_SHIMMER.length];
    const bass = ARENA_BASS[Math.floor(step / 2) % ARENA_BASS.length];
    if (mel > 0) playTone(mel, 0.24, 'sine', 0.042);
    if (shimmer > 0) playTone(shimmer, 0.18, 'triangle', 0.018);
    if (step % 2 === 0 && bass > 0) playTone(bass, 0.28, 'triangle', 0.032);
    step++;
  }, 215);
}

function startFestivalSynthFallback(spec: FestivalBgmTrackSpec) {
  if (!ensureAudioCtx() || !audioCtx || bgmTimer !== null) return;
  bgmTimer = window.setInterval(() => {
    if (!audioCtx) return;
    spec.onSynthStep(step, { audioCtx, playTone });
    step++;
  }, spec.stepIntervalMs);
}

function resolveDefaultYoutubeVideoId(trackId?: string): string | null {
  if (trackId) {
    const spec = festivalTracks.get(trackId);
    if (spec?.youtubeVideoId) return spec.youtubeVideoId;
  }
  for (const spec of festivalTracks.values()) {
    if (spec.youtubeVideoId) return spec.youtubeVideoId;
  }
  return null;
}

function ensureYoutubePlayerBootstrapped(videoId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined' || ytFailed) return;
  ytTargetVideoId = videoId;
  if (ytInitStarted) return;
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
    const initialVideoId = ytTargetVideoId || videoId;
    if (!window.YT?.Player || ytPlayer) return;
    try {
      ytLoadedVideoId = initialVideoId;
      ytPlayer = new window.YT.Player('waist-yt-bgm-host', {
        width: 200,
        height: 113,
        videoId: initialVideoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (ev) => {
            ytReady = true;
            try {
              const activeSpec = festivalTracks.get(currentTrack);
              ev.target.unMute();
              ev.target.setVolume(activeSpec?.volume ?? 55);
              if (wantPlaying && activeSpec?.youtubeVideoId) {
                stopSynthTimer();
                if (
                  ytLoadedVideoId !== activeSpec.youtubeVideoId &&
                  typeof ev.target.loadVideoById === 'function'
                ) {
                  ytLoadedVideoId = activeSpec.youtubeVideoId;
                  ev.target.loadVideoById(activeSpec.youtubeVideoId, 0);
                } else {
                  ev.target.playVideo();
                }
              }
            } catch {
              // ignore
            }
          },
          onStateChange: (ev) => {
            const activeSpec = festivalTracks.get(currentTrack);
            if (ev.data === 0 && wantPlaying && activeSpec?.youtubeVideoId) {
              try {
                if (
                  ytLoadedVideoId !== activeSpec.youtubeVideoId &&
                  typeof ev.target.loadVideoById === 'function'
                ) {
                  ytLoadedVideoId = activeSpec.youtubeVideoId;
                  ev.target.loadVideoById(activeSpec.youtubeVideoId, 0);
                } else {
                  ev.target.seekTo(0, true);
                  ev.target.playVideo();
                }
              } catch {
                // ignore
              }
            }
          },
          onError: () => {
            ytFailed = true;
            ytReady = false;
            const activeSpec = festivalTracks.get(currentTrack);
            if (wantPlaying && activeSpec) {
              startFestivalSynthFallback(activeSpec);
            }
          },
        },
      });
    } catch {
      ytFailed = true;
      const activeSpec = festivalTracks.get(currentTrack);
      if (wantPlaying && activeSpec) {
        startFestivalSynthFallback(activeSpec);
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
      const activeSpec = festivalTracks.get(currentTrack);
      if (wantPlaying && activeSpec) {
        startFestivalSynthFallback(activeSpec);
      }
    };
    document.head.appendChild(tag);
  }
}

/**
 * Pre-loads the hidden YouTube IFrame Player for a festival BGM track
 * so clicking anywhere in the arena starts the song instantaneously.
 */
export function preloadBgm(trackId?: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const videoId = resolveDefaultYoutubeVideoId(trackId);
  if (!videoId || ytFailed) return;

  if (ytPlayer && ytReady) {
    // Only pre-cue when idle so active playback is never interrupted
    if (!wantPlaying && ytLoadedVideoId !== videoId && typeof ytPlayer.cueVideoById === 'function') {
      try {
        ytPlayer.cueVideoById(videoId, 0);
        ytLoadedVideoId = videoId;
      } catch {
        // ignore cue error
      }
    }
    return;
  }

  ensureYoutubePlayerBootstrapped(videoId);
}

export function isBgmPlaying(): boolean {
  return wantPlaying;
}

export function getCurrentBgmTrack(): BgmTrack {
  return currentTrack;
}

export function startBgm(track?: BgmTrack) {
  if (typeof window === 'undefined') return;
  if (track) currentTrack = track;
  wantPlaying = true;

  const festSpec = festivalTracks.get(currentTrack);
  if (festSpec) {
    stopSynthTimer();
    if (!festSpec.youtubeVideoId || ytFailed) {
      startFestivalSynthFallback(festSpec);
      return;
    }
    ensureYoutubePlayerBootstrapped(festSpec.youtubeVideoId);
    if (ytPlayer && ytReady) {
      try {
        ytPlayer.unMute();
        ytPlayer.setVolume(festSpec.volume ?? 55);
        if (
          ytLoadedVideoId !== festSpec.youtubeVideoId &&
          typeof ytPlayer.loadVideoById === 'function'
        ) {
          ytLoadedVideoId = festSpec.youtubeVideoId;
          ytPlayer.loadVideoById(festSpec.youtubeVideoId, 0);
        } else {
          ytPlayer.playVideo();
        }
      } catch {
        startFestivalSynthFallback(festSpec);
      }
    }
    return;
  }

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

/** Resets internal BGM module state (intended for unit testing). */
export function __resetBgmStateForTests(): void {
  stopSynthTimer();
  audioCtx = null;
  step = 0;
  currentTrack = 'arena';
  wantPlaying = false;
  ytPlayer = null;
  ytLoadedVideoId = null;
  ytTargetVideoId = null;
  ytReady = false;
  ytInitStarted = false;
  ytFailed = false;
}
