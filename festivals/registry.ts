import {
  createDefaultIslandNightSky,
  createIslandNightSkyController,
} from './defaultSky3d';
import {
  computeFestivalPhase,
  resolveIslandWeatherTargets,
  selectActiveFestivalDefinition,
  type FestivalResolutionOptions,
} from './schedule';
import type { ActiveFestivalPhase, FestivalModule } from './types';
import { loyKrathongFestivalModule } from './loy-krathong';

/**
 * Master list of seasonal island festivals.
 * To add a new festival (e.g., Songkran, New Year, Halloween, Valentine):
 * 1. Create `festivals/<slug>/index.ts` exporting a `FestivalModule`
 * 2. Append it to `FESTIVAL_MODULES` below (and register DB schema/API handlers in `festivals/schema.ts` & `festivals/server.ts` if DB-backed)
 */
export const FESTIVAL_MODULES: readonly FestivalModule[] = [
  loyKrathongFestivalModule,
];

export const ALL_FESTIVAL_REALTIME_EVENTS: readonly string[] = Array.from(
  new Set(FESTIVAL_MODULES.flatMap((m) => m.definition.realtimeEvents))
);

let bgmsRegistered = false;

export function ensureFestivalBgmsRegistered(): void {
  if (bgmsRegistered) return;
  bgmsRegistered = true;
  for (const mod of FESTIVAL_MODULES) {
    mod.registerBgm?.();
  }
}

export function getFestivalModuleById(id: string | null | undefined): FestivalModule | null {
  if (!id) return null;
  return FESTIVAL_MODULES.find((m) => m.definition.id === id) ?? null;
}

export function resolveActiveFestival(
  nowMs: number = Date.now(),
  options?: FestivalResolutionOptions
): { module: FestivalModule; phase: ActiveFestivalPhase } | null {
  const picked = selectActiveFestivalDefinition(FESTIVAL_MODULES, nowMs, options);
  if (!picked) return null;
  return { module: picked.entry, phase: picked.phase };
}

export {
  computeFestivalPhase,
  createDefaultIslandNightSky,
  createIslandNightSkyController,
  resolveIslandWeatherTargets,
  selectActiveFestivalDefinition,
  type FestivalResolutionOptions,
};
