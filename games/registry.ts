import type * as THREE from 'three';
import { volleyballGameModule } from './volleyball';
import { soccerGameModule } from './soccer';
import { sumoGameModule } from './sumo';
import { taekwondoGameModule } from './taekwondo';
import { casinoGameModule } from './casino';
import { shabuGameModule } from './shabu';
import type {
  GameId,
  GameIslandZoneContext,
  GameIslandZoneFrame,
  GameIslandZoneInstance,
  GameModule,
} from './types';

export const GAME_MODULES: readonly GameModule[] = [
  volleyballGameModule,
  soccerGameModule,
  sumoGameModule,
  taekwondoGameModule,
  casinoGameModule,
  shabuGameModule,
];

export const ALL_GAME_REALTIME_EVENTS: readonly string[] = GAME_MODULES.map(
  (m) => m.definition.realtimeEvent
);

export function getGameModuleById(gameId: GameId): GameModule | undefined {
  return GAME_MODULES.find((m) => m.definition.id === gameId);
}

export interface IslandGameZonesController {
  zones: GameIslandZoneInstance[];
  getZone: (gameId: GameId) => GameIslandZoneInstance | undefined;
  updateAll: (
    frame: GameIslandZoneFrame,
    activeSpectatorPos: THREE.Vector3 | null,
    onProximityChange: (gameId: GameId, isNear: boolean) => void
  ) => void;
  disposeAll: () => void;
}

export function createIslandGameZonesController(
  ctx: GameIslandZoneContext
): IslandGameZonesController {
  const zones: GameIslandZoneInstance[] = [];
  const byId = new Map<GameId, GameIslandZoneInstance>();

  for (const mod of GAME_MODULES) {
    if (mod.createIslandZone) {
      const inst = mod.createIslandZone(ctx);
      zones.push(inst);
      byId.set(inst.gameId, inst);
    }
  }

  return {
    zones,
    getZone: (gameId) => byId.get(gameId),
    updateAll: (frame, activeSpectatorPos, onProximityChange) => {
      for (const z of zones) {
        if (activeSpectatorPos) {
          const dist = Math.hypot(
            activeSpectatorPos.x - z.position.x,
            activeSpectatorPos.z - z.position.z
          );
          onProximityChange(z.gameId, dist < z.proximityRadius);
        } else {
          onProximityChange(z.gameId, false);
        }
        z.update(frame);
      }
    },
    disposeAll: () => {
      for (const z of zones) {
        z.dispose();
      }
      zones.length = 0;
      byId.clear();
    },
  };
}
