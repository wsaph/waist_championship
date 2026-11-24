import type * as THREE from 'three';
import type React from 'react';
import type { ResolvedQualityTier } from '@/lib/device_perf';

export type FestivalPhase = 'upcoming' | 'live' | 'encore' | 'ended';
export type ActiveFestivalPhase = 'live' | 'encore';

export interface FestivalSchedule {
  /** Optional start timestamp (ms). If omitted, festival is 'live' until liveEndMs. */
  liveStartMs?: number;
  /** Timestamp (ms) when live festival automatically cuts off (e.g. 07:00 ICT morning after). */
  liveEndMs: number;
  /** Optional timestamp (ms) when post-event encore button ("ควันหลง") expires. */
  encoreEndMs?: number;
}

export interface BangkokWeatherSnapshot {
  temp: number;
  windKmh?: number;
  snowfallCm?: number;
  isDay: boolean;
  dayPhase: 'dawn' | 'day' | 'dusk' | 'night';
  condition: 'clear' | 'cloudy' | 'snow' | 'blizzard' | 'rain' | 'storm';
  label: string;
  emoji: string;
}

export interface FestivalWeatherLightingOverride {
  skyHex: number;
  lightHex: number;
  hemiIntensity: number;
  dirIntensity: number;
  isRaining: boolean;
  isSnowing?: boolean;
  isBlizzard?: boolean;
  isDiamondDust?: boolean;
  fogDensity?: number;
  showNightSky: boolean;
  oceanColorHex?: number;
  oceanEmissiveHex?: number;
  cloudColorHex?: number;
}

export interface ResolvedWeatherTargets {
  targetHex: number;
  targetLightHex: number;
  targetHemi: number;
  targetDir: number;
  isRaining: boolean;
  isSnowing: boolean;
  isBlizzard: boolean;
  isDiamondDust: boolean;
  fogDensity: number;
  showNight: boolean;
  oceanColorHex: number;
  oceanEmissiveHex: number;
  cloudColorHex: number;
}

export interface FestivalBgmDescriptor {
  trackId: string;
  youtubeVideoId?: string;
  volume?: number;
  buttonLabel: string;
  buttonTitle: string;
  mobileOnLabel: string;
  mobileOffLabel: string;
  autoPlayOnLiveInteraction: boolean;
}

export interface FestivalHudCopy {
  liveActiveIcon: string;
  liveActiveLabel: string;
  liveInactiveIcon: string;
  liveInactiveLabel: string;
  liveToggleTitle: string;
  encoreActiveIcon: string;
  encoreActiveLabel: string;
  encoreInactiveIcon: string;
  encoreInactiveLabel: string;
  encoreToggleTitle: string;
  encoreActivatedToast?: {
    emoji: string;
    title: string;
    text: string;
  };
  mobileActiveIcon: string;
  mobileActiveLabel: string;
  mobileLiveInactiveIcon: string;
  mobileLiveInactiveLabel: string;
  mobileEncoreInactiveIcon: string;
  mobileEncoreInactiveLabel: string;
  busyModalLabel: string;
}

export interface FestivalDefinition {
  id: string;
  /** Higher number wins if two festivals overlap in the same phase. Defaults to 0. */
  priority?: number;
  nameTh: string;
  nameEn: string;
  emoji: string;
  apiBasePath: string;
  realtimeEvents: string[];
  schedule: FestivalSchedule;
  weatherOverride?: FestivalWeatherLightingOverride;
  bgm: FestivalBgmDescriptor;
  hud: FestivalHudCopy;
}

export interface FestivalPlayerIdentity {
  id: number | null;
  name: string;
  emoji: string;
  colorHex: string;
  bandColor: string;
  species: string;
}

export interface FestivalSkyContext {
  scene: THREE.Scene;
  islandCenterX: number;
  islandW: number;
  islandD: number;
  qualityTier: ResolvedQualityTier;
  starCount: number;
  initialVisible: boolean;
}

export interface FestivalSkyController {
  group: THREE.Group;
  setVisible: (visible: boolean) => void;
  update: (elapsed: number, isFestivalSkyActive: boolean) => void;
}

export interface FestivalSceneContext {
  scene: THREE.Scene;
  labelsContainer: HTMLElement;
  qualityTier: ResolvedQualityTier;
  islandCenterX: number;
  islandW: number;
  islandD: number;
  showToast: (emoji: string, title: string, text: string) => void;
  onFocusItem: (itemId: string | number, durationMs: number) => void;
}

export interface FestivalFrameContext<TItem = unknown> {
  elapsed: number;
  nowPerfMs: number;
  nowWallMs: number;
  isVisible: boolean;
  viewerUserId: number | null;
  items: TItem[];
  itemsSig: string;
  focusedItemId: string | number | null;
  focusedUntilPerfMs: number;
  camera: THREE.PerspectiveCamera;
  viewportWidth: number;
  viewportHeight: number;
}

export interface FestivalSceneController<TItem = unknown> {
  group: THREE.Group;
  update: (frame: FestivalFrameContext<TItem>) => void;
  onPointerTap?: (raycaster: THREE.Raycaster) => boolean;
  dispose: () => void;
}

export interface FestivalLaunchOrigin {
  startX: number | null;
  startZ: number | null;
  islandCenterX: number;
  islandW: number;
  islandD: number;
}

export interface FestivalCameraFocusTarget {
  lookAtX: number;
  lookAtY: number;
  lookAtZ: number;
  posX: number;
  posY: number;
  posZ: number;
}

export interface FestivalClientActionContext<TItem = unknown> {
  currentUserId: number | null;
  player: FestivalPlayerIdentity;
  phase: FestivalPhase;
  isWorldActive: boolean;
  items: TItem[];
  setItems: (nextItems: TItem[]) => void;
  closeModal: () => void;
  focusItem: (itemId: string | number, durationMs: number) => void;
  focusWorldCamera: (target: FestivalCameraFocusTarget) => void;
  prepareShoreLaunchOrigin: () => FestivalLaunchOrigin;
  showToast: (emoji: string, title: string, text: string) => void;
  broadcastRealtimeEvent: (event: string, payload: Record<string, unknown>) => void;
}

export interface FestivalClientAdapter<TItem = unknown, TInput = unknown> {
  initialItems: TItem[];
  pollIntervalMs: number;
  getItemId: (item: TItem) => string | number;
  fetchItems: () => Promise<TItem[] | null>;
  countUserItems: (items: TItem[], userId: number | null) => number;
  cycleUserItem?: (
    items: TItem[],
    userId: number | null,
    cycleIndex: number,
    ctx: Pick<
      FestivalClientActionContext<TItem>,
      'focusItem' | 'focusWorldCamera' | 'showToast' | 'prepareShoreLaunchOrigin'
    >
  ) => void;
  submitAction: (input: TInput, ctx: FestivalClientActionContext<TItem>) => Promise<void>;
  onRealtimeEvent?: (
    event: string,
    payload: Record<string, unknown>,
    ctx: Pick<
      FestivalClientActionContext<TItem>,
      'items' | 'setItems' | 'isWorldActive' | 'phase' | 'focusItem' | 'showToast'
    >
  ) => void;
}

export interface FestivalShoreActionsProps {
  isNearOcean: boolean;
  fishingPhase: 'idle' | 'waiting' | 'bite' | 'reeling';
  isPairMenuOpen: boolean;
  myItemsCount: number;
  onOpenModal: () => void;
  onCycleMyItems: () => void;
}

export interface FestivalModalProps<TInput = unknown> {
  isOpen: boolean;
  onClose: () => void;
  player: FestivalPlayerIdentity;
  submitting?: boolean;
  isMusicOn?: boolean;
  onToggleMusic?: () => void;
  onLaunch: (input: TInput) => Promise<void> | void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface FestivalModule<TItem = any, TInput = any> {
  definition: FestivalDefinition;
  registerBgm?: () => void;
  clientAdapter: FestivalClientAdapter<TItem, TInput>;
  createSkyController?: (ctx: FestivalSkyContext) => FestivalSkyController;
  createSceneController: (ctx: FestivalSceneContext) => FestivalSceneController<TItem>;
  ShoreActionsComponent?: React.ComponentType<FestivalShoreActionsProps>;
  ModalComponent?: React.ComponentType<FestivalModalProps<TInput>>;
}
