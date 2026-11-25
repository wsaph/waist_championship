import type * as THREE from 'three';
import type React from 'react';
import type { QualityMode, ResolvedQualityTier } from '@/lib/device_perf';
import type { PropColorMap } from '@/lib/rpg_catalog';

export type GameId =
  | 'volleyball'
  | 'soccer'
  | 'sumo'
  | 'taekwondo'
  | 'casino'
  | 'shabu';

export interface GamePlayerSummary {
  id: number;
  name: string;
  emoji: string;
  colorHex: string;
  points?: number;
  bandColor?: string;
  species?: string;
  breed?: string;
  equipHat?: string;
  equipFace?: string;
  equipArmor?: string;
  equipWeapon?: string;
  equipWings?: string;
  equipAura?: string;
  propColors?: PropColorMap;
  bellyScale?: number;
  bmiBellyScale?: number;
  muscleScale?: number;
  goalType?: string;
}

export interface GameRosterSlot {
  slotId: string;
  clientId?: string;
  playerId: number;
  name: string;
  emoji: string;
  team?: 'left' | 'right' | 'coop';
  isBot?: boolean;
}

export interface GameLobbyBroadcastInfo {
  gameId: GameId;
  roomCode: string;
  mode?: string;
  gameType?: string;
  hostUserId: number;
  hostName: string;
  hostEmoji: string;
  targetName?: string;
  count: number;
  max: number;
  status: 'waiting' | 'started' | 'closed';
  scoreLeft?: number;
  scoreRight?: number;
  roster?: GameRosterSlot[];
  updatedAt: number;
}

export type GameLobbyBroadcastInput = Omit<
  GameLobbyBroadcastInfo,
  'gameId' | 'updatedAt'
> & {
  gameId?: GameId;
};

export interface GameActiveSession {
  gameId: GameId;
  roomCode: string;
  mode?: string;
  isHost: boolean;
  targetName?: string;
}

export interface GameIslandZoneContext {
  scene: THREE.Scene;
  labelsContainer: HTMLElement;
  qualityTier: ResolvedQualityTier;
  islandCenterX: number;
  islandW: number;
  islandD: number;
  sportsPlazaX: number;
  sportsPlazaBackX?: number;
  getPlayers: () => GamePlayerSummary[];
  getLiveLobby: (gameId: GameId) => GameLobbyBroadcastInfo | null;
  getWalkingSpectatorId: () => number | null;
  isNearZone: (gameId: GameId) => boolean;
  focusCamera: (lookAt: THREE.Vector3, camPos: THREE.Vector3) => void;
  walkSpectatorTo: (target: THREE.Vector3) => void;
  openGame: (opts: {
    gameId: GameId;
    roomCode?: string;
    mode?: string;
    isHost?: boolean;
    targetName?: string;
  }) => void;
}

export interface GameIslandZoneFrame {
  elapsed: number;
  delta: number;
  camera: THREE.PerspectiveCamera;
  viewportWidth: number;
  viewportHeight: number;
}

export interface GameIslandZoneInstance {
  gameId: GameId;
  group: THREE.Group;
  position: THREE.Vector3;
  proximityRadius: number;
  update: (frame: GameIslandZoneFrame) => void;
  dispose: () => void;
}

export interface GameModalHostProps {
  isOpen: boolean;
  session: GameActiveSession;
  onClose: () => void;
  players: GamePlayerSummary[];
  currentUserId: number | null;
  qualityMode: QualityMode;
  externalLobbyInfo: GameLobbyBroadcastInfo | null;
  onLobbyBroadcast: (info: GameLobbyBroadcastInput) => void;
  onRewardEarned: (earned: number, newPoints?: number) => void;
  onPointsUpdated: () => void;
}

export interface GameDefinition {
  id: GameId;
  nameTh: string;
  shortNameTh: string;
  emoji: string;
  defaultRoomCode: string;
  defaultMode?: string;
  realtimeEvent: string;
  pairActivityAnimType?: string;
  busyStatusLabel: string;
  singleSessionLock: boolean;
  proximitySource: 'own_zone' | 'guard' | 'food_stall';
  bannerBorderClass: string;
  proximityBtnClass: string;
  proximityIdleText: string;
  proximitySubText?: string;
  rewardWinTitleTh?: string;
}

export interface GameModule {
  definition: GameDefinition;
  createIslandZone?: (ctx: GameIslandZoneContext) => GameIslandZoneInstance;
  ModalComponent: React.ComponentType<GameModalHostProps>;
}
