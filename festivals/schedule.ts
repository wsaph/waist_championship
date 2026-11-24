import type {
  ActiveFestivalPhase,
  BangkokWeatherSnapshot,
  FestivalDefinition,
  FestivalPhase,
  FestivalSchedule,
  FestivalWeatherLightingOverride,
  ResolvedWeatherTargets,
} from './types';

/**
 * Computes the lifecycle phase of a festival at a given wall-clock timestamp (ms).
 * - 'upcoming': before schedule.liveStartMs (when configured)
 * - 'live': active festival night/period
 * - 'encore': post-event revisit window ("ควันหลง") so players who missed live night can revisit
 * - 'ended': completely finished and hidden
 */
export function computeFestivalPhase(
  schedule: FestivalSchedule,
  nowMs: number = Date.now()
): FestivalPhase {
  if (schedule.liveStartMs !== undefined && nowMs < schedule.liveStartMs) {
    return 'upcoming';
  }
  if (nowMs < schedule.liveEndMs) {
    return 'live';
  }
  if (schedule.encoreEndMs !== undefined && nowMs < schedule.encoreEndMs) {
    return 'encore';
  }
  return 'ended';
}

export interface FestivalResolutionOptions {
  forceFestivalId?: string;
  forcePhase?: ActiveFestivalPhase;
}

/**
 * Selects which seasonal festival (if any) should be active at `nowMs`.
 * Priority rules:
 * 1. Explicit `options.forceFestivalId` (for previews/testing)
 * 2. Any festival currently in `'live'` phase (ordered by descending `priority`, then registration order)
 * 3. Any festival currently in `'encore'` phase (ordered by descending `priority`, then registration order)
 * 4. `null` when all registered festivals are `'upcoming'` or `'ended'`
 */
export function selectActiveFestivalDefinition<T extends { definition: FestivalDefinition }>(
  candidates: readonly T[],
  nowMs: number = Date.now(),
  options?: FestivalResolutionOptions
): { entry: T; phase: ActiveFestivalPhase } | null {
  if (options?.forceFestivalId) {
    const forced = candidates.find((c) => c.definition.id === options.forceFestivalId);
    if (!forced) return null;
    const naturalPhase = computeFestivalPhase(forced.definition.schedule, nowMs);
    const phase: ActiveFestivalPhase =
      options.forcePhase ?? (naturalPhase === 'encore' ? 'encore' : 'live');
    return { entry: forced, phase };
  }

  let bestLive: T | null = null;
  let bestLivePriority = -Infinity;
  let bestEncore: T | null = null;
  let bestEncorePriority = -Infinity;

  for (const candidate of candidates) {
    const phase = computeFestivalPhase(candidate.definition.schedule, nowMs);
    const prio = candidate.definition.priority ?? 0;
    if (phase === 'live' && prio > bestLivePriority) {
      bestLive = candidate;
      bestLivePriority = prio;
    } else if (phase === 'encore' && prio > bestEncorePriority) {
      bestEncore = candidate;
      bestEncorePriority = prio;
    }
  }

  if (bestLive) {
    return { entry: bestLive, phase: 'live' };
  }
  if (bestEncore) {
    return { entry: bestEncore, phase: 'encore' };
  }
  return null;
}

/**
 * Resolves sky, lighting, snow/rain, fog, ocean, and cloud color targets for the 3D Hokkaido island,
 * applying a festival weather/sky override when active or using live Hokkaido weather × Thai time.
 */
export function resolveIslandWeatherTargets(
  w: BangkokWeatherSnapshot | null,
  festivalOverride: FestivalWeatherLightingOverride | null = null
): ResolvedWeatherTargets {
  if (festivalOverride) {
    const showNight = festivalOverride.showNightSky;
    return {
      targetHex: festivalOverride.skyHex,
      targetLightHex: festivalOverride.lightHex,
      targetHemi: festivalOverride.hemiIntensity,
      targetDir: festivalOverride.dirIntensity,
      isRaining: festivalOverride.isRaining,
      isSnowing: festivalOverride.isSnowing ?? false,
      isBlizzard: festivalOverride.isBlizzard ?? false,
      isDiamondDust: festivalOverride.isDiamondDust ?? false,
      fogDensity: festivalOverride.fogDensity ?? 0.0034,
      showNight,
      oceanColorHex: festivalOverride.oceanColorHex ?? (showNight ? 0x06244a : 0x0369a1),
      oceanEmissiveHex: festivalOverride.oceanEmissiveHex ?? (showNight ? 0x0a3a66 : 0x075985),
      cloudColorHex: festivalOverride.cloudColorHex ?? (showNight ? 0x475569 : 0xf8fafc),
    };
  }

  // Crisp Hokkaido Alpine Winter defaults (clear daytime)
  let targetHex = 0xa5d8ff;
  let targetLightHex = 0xf8fafc;
  let targetHemi = 0.84;
  let targetDir = 0.96;
  let fogDensity = 0.0032;

  const isSnowing = Boolean(w && (w.condition === 'snow' || w.condition === 'blizzard'));
  const isBlizzard = Boolean(w && w.condition === 'blizzard');
  const isRaining = Boolean(w && (w.condition === 'rain' || w.condition === 'storm'));
  const isPrecip = isSnowing || isRaining;
  const isDiamondDust = Boolean(w && w.condition === 'clear' && w.temp <= 0);

  if (w) {
    if (w.dayPhase === 'night') {
      targetLightHex = 0xe0f2fe;
      if (isBlizzard) {
        targetHex = 0x162238;
        targetHemi = 0.56;
        targetDir = 0.46;
        fogDensity = 0.0084;
      } else if (w.condition === 'snow') {
        targetHex = 0x101d36;
        targetHemi = 0.64;
        targetDir = 0.58;
        fogDensity = 0.0052;
      } else if (isRaining) {
        targetHex = 0x090d16;
        targetHemi = 0.44;
        targetDir = 0.4;
        fogDensity = 0.0056;
      } else {
        targetHex = 0x08142e;
        targetHemi = 0.66;
        targetDir = 0.8;
        fogDensity = 0.003;
      }
    } else if (w.dayPhase === 'dawn') {
      targetLightHex = 0xffe4e6;
      if (isBlizzard) {
        targetHex = 0x94a3b8;
        targetHemi = 0.66;
        targetDir = 0.52;
        fogDensity = 0.0082;
      } else if (w.condition === 'snow') {
        targetHex = 0xcbd5e1;
        targetHemi = 0.74;
        targetDir = 0.64;
        fogDensity = 0.0052;
      } else if (isRaining) {
        targetHex = 0x6b7280;
        targetHemi = 0.54;
        targetDir = 0.46;
        fogDensity = 0.0056;
      } else if (w.condition === 'cloudy') {
        targetHex = 0xe2e8f0;
        targetHemi = 0.74;
        targetDir = 0.68;
        fogDensity = 0.0038;
      } else {
        targetHex = 0xfecdd3;
        targetHemi = 0.8;
        targetDir = 0.84;
        fogDensity = 0.0032;
      }
    } else if (w.dayPhase === 'dusk') {
      // Otaru Canal Pastel Winter Twilight (17:00-19:00 Thai time)
      targetLightHex = 0xfed7aa;
      if (isBlizzard) {
        targetHex = 0x64748b;
        targetHemi = 0.58;
        targetDir = 0.46;
        fogDensity = 0.0084;
      } else if (w.condition === 'snow') {
        targetHex = 0x94a3b8;
        targetHemi = 0.68;
        targetDir = 0.58;
        fogDensity = 0.0054;
      } else if (isRaining) {
        targetHex = 0x57534e;
        targetHemi = 0.5;
        targetDir = 0.44;
        fogDensity = 0.0056;
      } else if (w.condition === 'cloudy') {
        targetHex = 0xc4b5fd;
        targetHemi = 0.68;
        targetDir = 0.64;
        fogDensity = 0.0038;
      } else {
        targetHex = 0xf9a8d4;
        targetHemi = 0.74;
        targetDir = 0.8;
        fogDensity = 0.0033;
      }
    } else {
      // Daytime (08:00-17:00 Thai time)
      if (isBlizzard) {
        targetHex = 0xcbd5e1;
        targetLightHex = 0xe2e8f0;
        targetHemi = 0.74;
        targetDir = 0.55;
        fogDensity = 0.0086;
      } else if (w.condition === 'snow') {
        targetHex = 0xdbeafe;
        targetLightHex = 0xf1f5f9;
        targetHemi = 0.8;
        targetDir = 0.72;
        fogDensity = 0.0052;
      } else if (isRaining) {
        targetHex = 0x64748b;
        targetHemi = 0.54;
        targetDir = 0.46;
        fogDensity = 0.0055;
      } else if (w.condition === 'cloudy') {
        targetHex = 0xcbd5e1;
        targetHemi = 0.72;
        targetDir = 0.7;
        fogDensity = 0.0038;
      }
    }
  }

  const showNight = Boolean(w && w.dayPhase === 'night' && !isRaining);

  return {
    targetHex,
    targetLightHex,
    targetHemi,
    targetDir,
    isRaining,
    isSnowing,
    isBlizzard,
    isDiamondDust,
    fogDensity,
    showNight,
    oceanColorHex: showNight ? 0x052042 : isPrecip ? 0x0c4a6e : 0x0369a1,
    oceanEmissiveHex: showNight ? 0x083358 : 0x075985,
    cloudColorHex: showNight ? 0x475569 : isBlizzard ? 0xe2e8f0 : 0xffffff,
  };
}
