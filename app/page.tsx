'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';
import { Trophy, Scale, UserPlus, Menu, LogOut } from 'lucide-react';
import {
  buildCharacterMesh,
  animateCharacterMotion,
  syncCharacterMountPose,
  setCharacterExpression,
  resolveRpgAnimPatterns,
  buildPetMesh,
  animatePetMotion,
  buildFireOrbProjectileMesh,
  buildFireEmberPileMesh,
  buildFoodPileMesh,
  buildDeliveryRider,
  buildCustomGuardCharacter,
  buildFantasyArenaDecor,
  buildTrackMarkerMesh,
  animateTrackMarkerMesh,
  type TrackMarkerParts,
} from '@/lib/character_3d';
import { resolvePowerBoostMeta } from '@/lib/power_boost';
import {
  getDailySpectatorActivity,
  getFoodStallSlackerActivity,
  isEatPath,
  getBangkok7AmDayKey,
  FIT_ACTIVITIES,
  EAT_ACTIVITIES,
  type SpectatorActivity,
} from '@/lib/spectator_activities';
import {
  GUARD_PRANKS,
  pickRandomGuardPranks,
  type GuardPrank,
} from '@/lib/guard_pranks';
import { createGuardPrankFxRig } from '@/lib/guard_prank_fx';
import { startBgm, stopBgm } from '@/lib/bgm';
import {
  SHOP_ITEMS,
  FREE_DEFAULT_ITEMS,
  computeGoalProgress,
  getGoalTypeMeta,
  getSideQuestRewardHint,
  resolveBreedOption,
  type GenderType,
  type GoalType,
  type ShopCategory,
  type ShopItem,
  type PropColorMap,
} from '@/lib/rpg_catalog';
import {
  loadQualityMode,
  saveQualityMode,
  getQualityConfig,
  disposeObject3D,
  QUALITY_MODE_OPTIONS,
  type QualityMode,
} from '@/lib/device_perf';
import {
  FISHING_RARITY_META,
  type FishingCatch,
  type FishingRarity,
} from '@/lib/fishing_catalog';
import { GuardDanceLoader } from '@/components/GuardDanceLoader';

const WardrobeShopModal = dynamic(
  () => import('@/lib/WardrobeAndAdminModals').then((m) => m.WardrobeShopModal),
  { ssr: false }
);
const LoginGateModal = dynamic(
  () => import('@/lib/WardrobeAndAdminModals').then((m) => m.LoginGateModal),
  { ssr: false }
);
const BeachVolleyballModal = dynamic(
  () => import('@/components/BeachVolleyballModal').then((m) => m.BeachVolleyballModal),
  { ssr: false }
);
const ShabuCoopModal = dynamic(
  () => import('@/components/ShabuCoopModal').then((m) => m.ShabuCoopModal),
  { ssr: false }
);
const PetCafeModal = dynamic(
  () => import('@/components/PetCafeModal').then((m) => m.PetCafeModal),
  { ssr: false }
);
const CasinoCardModal = dynamic(
  () => import('@/components/CasinoCardModal').then((m) => m.CasinoCardModal),
  { ssr: false }
);
const QuestBoardModal = dynamic(
  () => import('@/components/QuestBoardModal').then((m) => m.QuestBoardModal),
  { ssr: false }
);
const TaekwondoModal = dynamic(
  () => import('@/components/TaekwondoModal').then((m) => m.TaekwondoModal),
  { ssr: false }
);
import { formatCountdownTh, type QuestBoardItem } from '@/lib/quest_board';

interface Player {
  id: number;
  name: string;
  emoji: string;
  colorHex: string;
  accessory?: string;
  bandColor?: string;
  role?: 'competitor' | 'spectator';
  workoutType?: string;
  petType?: string;
  statusText?: string;
  startWeight?: number;
  currentWeight?: number;
  goalWeight?: number;
  bodyWeight?: number;
  heightCm?: number;
  gender?: GenderType;
  bmiBellyScale?: number;
  goalType?: GoalType;
  startVal?: number;
  currentVal?: number;
  targetVal?: number;
  stepCount?: number;
  stepTarget?: number;
  stepProgressPct?: number;
  todaySyncedSteps?: number;
  sideGoalProgressPct?: number;
  progressPct?: number;
  diffLabel?: string;
  isInFoodStall?: boolean;
  points?: number;
  checkedInToday?: boolean;
  beachCoinsToday?: number;
  species?: string;
  breed?: string;
  themeId?: string;
  equipHat?: string;
  equipFace?: string;
  equipArmor?: string;
  equipWeapon?: string;
  equipWings?: string;
  equipAura?: string;
  equipPetGear?: string;
  equipMount?: string;
  equipMarker?: string;
  isRoaming?: boolean;
  propColors?: PropColorMap;
  unlockedItems?: string[];
  taunt: string;
  cheerCount?: number;
  temptCount?: number;
  lostKg?: number;
  pctLost?: number;
  progressRatio?: number;
  bellyScale?: number;
  muscleScale?: number;
}

interface FeedItem {
  id: string | number;
  type?: 'weight' | 'cheer' | 'tempt';
  user: string;
  emoji: string;
  weight?: number;
  diff?: number;
  roast: string;
  excuse?: string;
  targetName?: string;
  targetEmoji?: string;
  giftItem?: string;
  time: string;
}

const STYLES = [
  { bodyColor: 0x38BDF8, bandColor: 0xFFE600, accessory: 'headband' },
  { bodyColor: 0xA3E635, bandColor: 0xFF4D8D, accessory: 'ears' },
  { bodyColor: 0xFACC15, bandColor: 0x18181B, accessory: 'shades' },
  { bodyColor: 0xF472B6, bandColor: 0xFFFFFF, accessory: 'cat' },
  { bodyColor: 0xFB923C, bandColor: 0xEF4444, accessory: 'chubby' },
  { bodyColor: 0xC084FC, bandColor: 0xFFE600, accessory: 'ears' },
];

const AVATARS = ['🦊', '🐰', '🐸', '🐱', '🐷', '🐼', '🐶', '🦁', '🐨', '🦄'];

const BODY_COLORS = ['#38BDF8', '#A3E635', '#FACC15', '#F472B6', '#FB923C', '#C084FC', '#EF4444', '#2DD4BF'];
const BAND_COLORS = ['#FFE600', '#FF4D8D', '#18181B', '#FFFFFF', '#38BDF8', '#A3E635', '#EF4444'];
const ACCESSORY_OPTIONS = [
  { id: 'headband', label: '🥋 ผ้าคาดหัว' },
  { id: 'ears', label: '🐰 หูกระต่าย' },
  { id: 'cat', label: '🐱 หูแมว' },
  { id: 'shades', label: '😎 แว่นกันแดด' },
  { id: 'cap', label: '🧢 หมวกแก๊ป' },
  { id: 'none', label: '✨ ไม่ใส่' },
];

const WORKOUT_OPTIONS = [
  { id: 'dumbbell', label: '🏋️ ยกดัมเบล', group: 'fit' },
  { id: 'squat', label: '🦵 สควอท', group: 'fit' },
  { id: 'pullup', label: '🤸‍♂️ ดึงข้อบาร์', group: 'fit' },
  { id: 'pushup', label: '💪 วิดพื้น', group: 'fit' },
  { id: 'situp', label: '🧘‍♂️ ซิทอัพ', group: 'fit' },
  { id: 'cheer', label: '📣 เชียร์สุดใจ', group: 'fit' },
  { id: 'picnic_shabu', label: '🍲 ปิกนิกชาบู', group: 'eat' },
  { id: 'eat_pizza', label: '🍕 กินพิซซ่า', group: 'eat' },
  { id: 'boba_tea', label: '🧋 ยืนกินชานม', group: 'eat' },
  { id: 'food_roll', label: '😴 นอนกลิ้ง', group: 'eat' },
];

const PET_OPTIONS = [
  { id: 'none', label: '✨ ไม่มี' },
  { id: 'dog', label: '🐶 น้องหมา' },
  { id: 'cat', label: '🐱 น้องแมว' },
  { id: 'rabbit', label: '🐰 กระต่าย' },
  { id: 'pig', label: '🐷 น้องหมู' },
];

const GROUP_PAIR_ACTIVITIES = [
  { animType: 'volleyball', label: '🏐 ตีวอลเลย์บอลด้วยกัน' },
  { animType: 'picnic_shabu', label: '🍲 ตั้งวงชาบูด้วยกัน' },
  { animType: 'play_cards', label: '🃏 ตั้งวงเล่นไพ่ด้วยกัน' },
  { animType: 'boxing', label: '🥊 ซ้อมมวยคู่กัน' },
  { animType: 'dumbbell', label: '🏋️ ยกดัมเบลด้วยกัน' },
  { animType: 'pushup', label: '💪 วิดพื้นข้างกัน' },
];

const FOOD_THOUGHTS = [
  '💭 🥓 ชาบู~',
  '💭 🧋 ชานมไข่มุก',
  '💭 🍕 พิซซ่า',
  '💭 🍗 ไก่ทอด',
  '💭 🍰 เค้กหวานๆ',
  '💭 🍜 หมูกระทะ',
];

const FIERCE_THOUGHTS = [
  '😤 ไม่กินเว้ย!',
  '🔥 จะถึงเส้นชัยแล้ว!',
  '💪 ฮึดสู้โว้ย!',
  '⚡ อย่ามาล่อ!',
  '🏆 เอวเอสอยู่แค่เอื้อม!',
];

const TRACK_START_X = -13;
const TRACK_END_X = 13;

export default function Arena3DPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playersLoadedOnce, setPlayersLoadedOnce] = useState<boolean>(false);
  const [initialArenaReady, setInitialArenaReady] = useState<boolean>(false);
  const [roastFeed, setRoastFeed] = useState<FeedItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isMusicOn, setIsMusicOn] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [logTab, setLogTab] = useState<'steps' | 'side_goal'>('steps');
  const [stepInput, setStepInput] = useState('');
  const [stepInputMode, setStepInputMode] = useState<'daily_sync' | 'add' | 'set'>('daily_sync');
  const [stepSyncSource, setStepSyncSource] = useState<'web_daily_sync' | 'ocr_screenshot'>('web_daily_sync');
  const [syncKey, setSyncKey] = useState('');
  const [showSyncKey, setShowSyncKey] = useState(false);
  const [loadingSyncStatus, setLoadingSyncStatus] = useState(false);
  const [rotatingSyncKey, setRotatingSyncKey] = useState(false);
  const [confirmRotateKey, setConfirmRotateKey] = useState(false);
  const [copiedSyncField, setCopiedSyncField] = useState<'key' | 'url' | null>(null);
  const [todaySyncedSteps, setTodaySyncedSteps] = useState(0);
  const [showIosShortcutGuide, setShowIosShortcutGuide] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [ocrPreviewUrl, setOcrPreviewUrl] = useState('');
  const [ocrResult, setOcrResult] = useState<{
    steps: number;
    appName: string;
    dateHint: string;
  } | null>(null);
  const healthFileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSeason, setActiveSeason] = useState<{
    id: number;
    name: string;
    endDate: string;
    stepTarget: number;
  } | null>(null);
  const [isStepAdminOpen, setIsStepAdminOpen] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminStepTargetInput, setAdminStepTargetInput] = useState('300000');
  const [adminStepError, setAdminStepError] = useState('');
  const [savingAdminStep, setSavingAdminStep] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(1);
  const [pinInput, setPinInput] = useState('');
  const [newWeightInput, setNewWeightInput] = useState('');
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [joinMode, setJoinMode] = useState<'create' | 'edit'>('create');
  const [wardrobeInitialTab, setWardrobeInitialTab] = useState<ShopCategory | 'gacha'>('armor');
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [joinRole, setJoinRole] = useState<'competitor' | 'spectator'>('competitor');
  const [joinWorkout, setJoinWorkout] = useState<'fit' | 'eat'>('fit');
  const [joinPet, setJoinPet] = useState('none');
  const [joinName, setJoinName] = useState('');
  const [joinEmoji, setJoinEmoji] = useState('🐰');
  const [joinColor, setJoinColor] = useState('#F8FAFC');
  const [joinAccessory, setJoinAccessory] = useState('headband');
  const [joinBandColor, setJoinBandColor] = useState('#FFE600');
  const [joinSpecies, setJoinSpecies] = useState('bunny');
  const [joinThemeId, setJoinThemeId] = useState('none');
  const [joinEquipHat, setJoinEquipHat] = useState('none');
  const [joinEquipFace, setJoinEquipFace] = useState('face_none');
  const [joinEquipArmor, setJoinEquipArmor] = useState('armor_none');
  const [joinEquipWeapon, setJoinEquipWeapon] = useState('weapon_none');
  const [joinEquipWings, setJoinEquipWings] = useState('wings_none');
  const [joinEquipAura, setJoinEquipAura] = useState('aura_none');
  const [joinEquipPetGear, setJoinEquipPetGear] = useState('pet_none');
  const [joinEquipMount, setJoinEquipMount] = useState('mount_none');
  const [joinEquipMarker, setJoinEquipMarker] = useState('marker_wood');
  const [togglingRoam, setTogglingRoam] = useState(false);
  const [joinPropColors, setJoinPropColors] = useState<PropColorMap>({});
  const [joinGoalType, setJoinGoalType] = useState<GoalType>('weight_loss');
  const [joinPin, setJoinPin] = useState('');
  const [joinStatus, setJoinStatus] = useState('');
  const [quickStatusInput, setQuickStatusInput] = useState('');
  const [joinStart, setJoinStart] = useState('');
  const [joinGoal, setJoinGoal] = useState('');
  const [joinBodyWeight, setJoinBodyWeight] = useState('');
  const [joinHeightCm, setJoinHeightCm] = useState('');
  const [joinGender, setJoinGender] = useState<GenderType>('female');
  const [joinError, setJoinError] = useState('');
  const [joining, setJoining] = useState(false);

  const [boardSenderId, setBoardSenderId] = useState<string>('');
  const [boardTargetId, setBoardTargetId] = useState<number>(0);
  const [boardKind, setBoardKind] = useState<'cheer' | 'tempt'>('cheer');
  const [boardMessage, setBoardMessage] = useState('');
  const [sendingBoard, setSendingBoard] = useState(false);
  const [actionTargetPlayer, setActionTargetPlayer] = useState<Player | null>(null);
  const [giftTargetPlayer, setGiftTargetPlayer] = useState<Player | null>(null);
  const [giftCategory, setGiftCategory] = useState<ShopCategory>('mount');
  const [giftMessage, setGiftMessage] = useState('');
  const [sendingGiftId, setSendingGiftId] = useState<string | null>(null);
  const [giftError, setGiftError] = useState('');

  const [walkingSpectatorId, setWalkingSpectatorId] = useState<number | null>(null);
  const [nearbySpectator, setNearbySpectator] = useState<Player | null>(null);
  const [isNearGuard, setIsNearGuard] = useState(false);
  const [isNearCafe, setIsNearCafe] = useState(false);
  const [isNearDojang, setIsNearDojang] = useState(false);
  const [isNearQuestBoard, setIsNearQuestBoard] = useState(false);
  const [isPetCafeOpen, setIsPetCafeOpen] = useState(false);
  const [isTaekwondoOpen, setIsTaekwondoOpen] = useState(false);
  const [isQuestBoardOpen, setIsQuestBoardOpen] = useState(false);
  const [questBoardFocusId, setQuestBoardFocusId] = useState<number | null>(null);
  const [quests, setQuests] = useState<QuestBoardItem[]>([]);
  const activeQuestTagByUserId = React.useMemo(() => {
    const map: Record<number, string> = {};
    const countMap: Record<number, number> = {};
    for (const q of quests) {
      if (q.status !== 'active' && q.status !== 'voting') continue;
      for (const m of q.party) {
        if (m.inviteStatus !== 'accepted') continue;
        countMap[m.userId] = (countMap[m.userId] || 0) + 1;
        if (!map[m.userId]) {
          const clean = q.title.trim();
          map[m.userId] = clean.length > 20 ? `${clean.slice(0, 19)}…` : clean;
        }
      }
    }
    for (const uidStr of Object.keys(countMap)) {
      const uid = Number(uidStr);
      if (countMap[uid] > 1) {
        map[uid] = `${map[uid]} (+${countMap[uid] - 1})`;
      }
    }
    return map;
  }, [quests]);
  const activeQuestTagByUserIdRef = useRef<Record<number, string>>(activeQuestTagByUserId);
  activeQuestTagByUserIdRef.current = activeQuestTagByUserId;
  const [betBannerDismissed, setBetBannerDismissed] = useState(false);
  const [isNearOcean, setIsNearOcean] = useState(false);
  const [fishingPhase, setFishingPhase] = useState<'idle' | 'waiting' | 'bite' | 'reeling'>('idle');
  const [fishingResult, setFishingResult] = useState<{
    caught: FishingCatch;
    coinsEarned: number;
    dailyRewardCount: number;
    dailyRewardLimit: number;
    quotaReached?: boolean;
    guestMode?: boolean;
  } | null>(null);
  const [legendaryFlash, setLegendaryFlash] = useState(false);
  const [isPairMenuOpen, setIsPairMenuOpen] = useState(false);
  const [radialMenu, setRadialMenu] = useState<{ x: number; y: number; options: SpectatorActivity[] } | null>(null);
  const [guardPrankMenu, setGuardPrankMenu] = useState<{ x: number; y: number; options: GuardPrank[] } | null>(null);
  const [prankingGuard, setPrankingGuard] = useState(false);
  const [pairedActivities, setPairedActivities] = useState<Record<number, { animType: string; label: string }>>({});

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [signInUsername, setSignInUsername] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');

  const walkingSpectatorIdRef = useRef<number | null>(null);
  const nearbySpectatorIdRef = useRef<number | null>(null);
  const isNearGuardRef = useRef<boolean>(false);
  const isNearCafeRef = useRef<boolean>(false);
  const isNearDojangRef = useRef<boolean>(false);
  const isNearQuestBoardRef = useRef<boolean>(false);
  const isNearOceanRef = useRef<boolean>(false);
  const oceanDirRef = useRef<{ dx: number; dz: number }>({ dx: 0, dz: 1 });
  const fishingPhaseRef = useRef<'idle' | 'waiting' | 'bite' | 'reeling'>('idle');
  const fishingFxRef = useRef<{
    rarity: FishingRarity;
    caughtId?: string;
    startedAt: number;
    durationMs: number;
    bobberX: number;
    bobberZ: number;
  } | null>(null);
  const fishingBobberPosRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 });
  const fishingNibbleUntilRef = useRef<number>(0);
  const fishingTimersRef = useRef<{
    nibbleTimer?: ReturnType<typeof setTimeout>;
    biteTimer?: ReturnType<typeof setTimeout>;
    missTimer?: ReturnType<typeof setTimeout>;
  }>({});
  const guardPrankFxRef = useRef<{
    prank: GuardPrank;
    actorName: string;
    startedAt: number;
    durationMs: number;
  } | null>(null);
  const guardRageRef = useRef<number>(0);
  const guardLastRageThrowRef = useRef<number>(0);
  const isEditingQuickStatusRef = useRef<boolean>(false);
  const keysPressedRef = useRef<Record<string, boolean>>({});
  const walkTargetRef = useRef<THREE.Vector3 | null>(null);

  const pendingDeliveryRef = useRef<{
    targetId: number;
    kind: 'cheer' | 'tempt';
    label: string;
    startTime: number;
    addedToPile?: boolean;
  } | null>(null);

  const [bkkWeather, setBkkWeather] = useState<{
    temp: number;
    isDay: boolean;
    dayPhase: 'dawn' | 'day' | 'dusk' | 'night';
    condition: 'clear' | 'cloudy' | 'rain' | 'storm';
    label: string;
    emoji: string;
  } | null>(null);
  const bkkWeatherRef = useRef<{
    temp: number;
    isDay: boolean;
    dayPhase: 'dawn' | 'day' | 'dusk' | 'night';
    condition: 'clear' | 'cloudy' | 'rain' | 'storm';
    label: string;
    emoji: string;
  } | null>(null);

  const [toast, setToast] = useState<{ show: boolean; emoji: string; title: string; text: string }>({
    show: false,
    emoji: '🎉',
    title: '',
    text: '',
  });

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const labelsRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const statusSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraTargetPosRef = useRef<THREE.Vector3 | null>(null);
  const cameraLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 1.2, 0));
  const charMeshesRef = useRef<any[]>([]);
  const leaderIdRef = useRef<number | null>(null);
  const loserIdRef = useRef<number | null>(null);
  const savedSpectatorPosRef = useRef<Record<number, { x: number; y: number; z: number; rotY: number }>>({});
  const savedCameraPosRef = useRef<THREE.Vector3 | null>(null);
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
  const localBroadcastRef = useRef<BroadcastChannel | null>(null);
  const playersRef = useRef<Player[]>([]);
  const fetchArenaDataRef = useRef<(opts?: { force?: boolean; viewerId?: number | null }) => Promise<void>>(
    async () => { }
  );
  const lastDataSignatureRef = useRef<string>('');
  const clientInstanceIdRef = useRef<string>(
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const remoteSpectatorStateRef = useRef<
    Record<number, { x: number; y: number; z: number; rotY: number; isWalking: boolean; updatedAt: number }>
  >({});
  const remoteFishingStateRef = useRef<
    Record<number, { phase: 'idle' | 'waiting' | 'bite' | 'reeling'; dx: number; dz: number; updatedAt: number }>
  >({});
  const remoteBusyStatusRef = useRef<Record<number, { label: string; updatedAt: number }>>({});
  const myBusyLabelRef = useRef<string>('');
  const lastRubBroadcastRef = useRef<Record<number, number>>({});
  const lastMoveBroadcastAtRef = useRef<number>(0);
  const lastLocalEjectAtRef = useRef<number>(0);
  const wasWalkingRef = useRef<boolean>(false);
  const currentUserIdRef = useRef<number | null>(null);
  const pauseArenaRenderRef = useRef<boolean>(false);
  const claimingCoinRef = useRef<boolean>(false);
  const claimBeachCoinRef = useRef<(slotId: number, spawnToken: string) => Promise<void>>(async () => { });
  const lunchCoinsRef = useRef<Array<{ slotId: number; spawnToken: string; x: number; z: number }>>([]);
  const claimedTokensRef = useRef<Set<string>>(new Set());
  const [isLunchRush, setIsLunchRush] = useState<boolean>(false);
  const autoCheckinTriedRef = useRef<Set<number>>(new Set());
  const [qualityMode, setQualityMode] = useState<QualityMode>('auto');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [vbSession, setVbSession] = useState<{
    roomCode: string;
    mode: '1v1' | '2v2';
    isHost: boolean;
    targetName?: string;
  } | null>(null);
  const [liveVbLobby, setLiveVbLobby] = useState<{
    roomCode: string;
    mode: '1v1' | '2v2';
    hostUserId: number;
    hostName: string;
    hostEmoji: string;
    targetName?: string;
    count: number;
    max: number;
    updatedAt: number;
  } | null>(null);
  const isVolleyballOpen = Boolean(vbSession);
  const [shabuSession, setShabuSession] = useState<{
    roomCode: string;
    isHost: boolean;
    targetName?: string;
  } | null>(null);
  const [liveShabuLobby, setLiveShabuLobby] = useState<{
    roomCode: string;
    hostUserId: number;
    hostName: string;
    hostEmoji: string;
    targetName?: string;
    count: number;
    max: number;
    updatedAt: number;
  } | null>(null);
  const isShabuOpen = Boolean(shabuSession);
  const [cardSession, setCardSession] = useState<{
    roomCode: string;
    isHost: boolean;
    targetName?: string;
  } | null>(null);
  const [liveCardLobby, setLiveCardLobby] = useState<{
    roomCode: string;
    gameType: string;
    hostUserId: number;
    hostName: string;
    hostEmoji: string;
    targetName?: string;
    count: number;
    max: number;
    updatedAt: number;
  } | null>(null);
  const isCardOpen = Boolean(cardSession);
  const realtimeSubscribedRef = useRef<boolean>(false);

  useEffect(() => {
    setQualityMode(loadQualityMode());
  }, []);

  const handleChangeQualityMode = useCallback((next: QualityMode) => {
    setQualityMode(next);
    saveQualityMode(next);
  }, []);

  const [isFeedbackOpen, setIsFeedbackOpen] = useState<boolean>(false);
  const [feedbackTab, setFeedbackTab] = useState<'submit' | 'board'>('submit');
  const [feedbackCategory, setFeedbackCategory] = useState<'bug' | 'idea' | 'cosmetic'>('bug');
  const [feedbackMessage, setFeedbackMessage] = useState<string>('');
  const [feedbackError, setFeedbackError] = useState<string>('');
  const [submittingFeedback, setSubmittingFeedback] = useState<boolean>(false);
  const [loadingFeedback, setLoadingFeedback] = useState<boolean>(false);
  const [feedbackItems, setFeedbackItems] = useState<
    Array<{
      id: number;
      userId: number | null;
      userName: string;
      userEmoji: string;
      category: string;
      message: string;
      deviceInfo: string;
      status: 'open' | 'resolved';
      createdAt: string;
    }>
  >([]);

  useEffect(() => {
    const syncLunchCoins = async () => {
      const bkk = new Date(Date.now() + 7 * 3600 * 1000);
      const day = bkk.getUTCDay();
      const hour = bkk.getUTCHours();
      const inWindow = day >= 1 && day <= 5 && hour === 12;
      if (!inWindow) {
        lunchCoinsRef.current = [];
        setIsLunchRush(false);
        return;
      }
      try {
        const res = await fetch('/api/rewards', { cache: 'no-store' });
        if (res.ok) {
          const d = await res.json();
          setIsLunchRush(Boolean(d.isLunchRush));
          lunchCoinsRef.current = Array.isArray(d.coins) ? d.coins : [];
        }
      } catch {
        // ignore transient poll error
      }
    };
    const iv = setInterval(syncLunchCoins, 3800);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    pauseArenaRenderRef.current = Boolean(
      isJoinOpen ||
      isVolleyballOpen ||
      isShabuOpen ||
      isCardOpen ||
      isQuestBoardOpen ||
      (authChecked && currentUserId === null)
    );
  }, [isJoinOpen, isVolleyballOpen, isShabuOpen, isCardOpen, isQuestBoardOpen, authChecked, currentUserId]);

  const fetchQuests = useCallback(async () => {
    try {
      const res = await fetch('/api/quests', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.quests)) {
        setQuests(data.quests);
      }
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    fetchQuests();
    const iv = setInterval(fetchQuests, 30_000);
    return () => clearInterval(iv);
  }, [fetchQuests]);

  const openQuestBoard = useCallback(
    (focusQuestId: number | null = null) => {
      setQuestBoardFocusId(focusQuestId);
      setIsQuestBoardOpen(true);
      fetchQuests();
    },
    [fetchQuests]
  );
  const openQuestBoardRef = useRef(openQuestBoard);
  useEffect(() => {
    openQuestBoardRef.current = openQuestBoard;
  }, [openQuestBoard]);

  const handleQuestsUpdated = useCallback(
    (nextQuests: QuestBoardItem[], nextUserPoints?: number) => {
      setQuests(nextQuests);
      if (typeof nextUserPoints === 'number' && currentUserId !== null) {
        setPlayers((prev) =>
          prev.map((p) => (p.id === currentUserId ? { ...p, points: nextUserPoints } : p))
        );
      }
    },
    [currentUserId]
  );

  useEffect(() => {
    playersRef.current = players;
  }, [players]);

  const showToast = useCallback((emoji: string, title: string, text: string) => {
    setToast({ show: true, emoji, title, text });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 4000);
  }, []);

  const fetchArenaData = useCallback(
    async (opts?: { force?: boolean; viewerId?: number | null }) => {
      try {
        const activeViewerId =
          opts?.viewerId !== undefined
            ? Number(opts.viewerId || 0)
            : Number(localStorage.getItem('waist_user_id') || 0);
        const query = activeViewerId > 0 ? `?viewerId=${activeViewerId}` : '';
        const res = await fetch(`/api/weights${query}`, { cache: 'no-store' });
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        if (!res.ok) {
          console.error('Failed to fetch /api/weights:', data?.error || res.statusText);
          return;
        }

        const nextParticipants: Player[] = Array.isArray(data.participants) ? data.participants : [];
        if (data.lunchRush) {
          setIsLunchRush(Boolean(data.lunchRush.isLunchRush));
          lunchCoinsRef.current = Array.isArray(data.lunchRush.coins) ? data.lunchRush.coins : [];
        }

        // ซิงก์ข้อความ Speech Bubble บนหัวแบบสดๆ ใน DOM ทันที แม้ยังไม่ต้องสร้างฉาก 3D ใหม่
        nextParticipants.forEach((p) => {
          const meshEntry = charMeshesRef.current.find((m) => m.id === p.id);
          const bubbleEl = meshEntry?.tagEl?.querySelector('[data-speech-bubble]') as HTMLElement | null;
          if (bubbleEl && p.id !== walkingSpectatorIdRef.current) {
            const trimmed = (p.statusText || '').trim();
            if (trimmed) {
              bubbleEl.textContent = `💬 ${trimmed}`;
              bubbleEl.classList.remove('hidden');
            } else {
              bubbleEl.textContent = '';
              bubbleEl.classList.add('hidden');
            }
          }
          // หากผู้เล่นไม่ได้อยู่ในโหมดปักป้ายเดินเล่น ให้ล้างพิกัดเดินเล่นริมหาดเก่าออก
          if (!p.isRoaming && p.role !== 'spectator') {
            delete remoteSpectatorStateRef.current[p.id];
            delete savedSpectatorPosRef.current[p.id];
          }
        });

        // สร้างลายเซ็นข้อมูล (Data Signature) เพื่อตรวจว่ามีอะไรเปลี่ยนจริงหรือไม่ ป้องกันการกระพริบตอน Polling
        const fullSig = JSON.stringify({
          viewerId: activeViewerId,
          participants: nextParticipants.map((p) => [
            p.id,
            p.name,
            p.emoji,
            p.colorHex,
            p.bandColor,
            p.accessory,
            p.role,
            p.isRoaming,
            p.workoutType,
            p.petType,
            p.statusText,
            p.goalType,
            p.startVal,
            p.currentVal,
            p.targetVal,
            p.stepCount,
            p.stepTarget,
            p.stepProgressPct,
            p.todaySyncedSteps,
            p.sideGoalProgressPct,
            p.progressPct,
            p.bmiBellyScale,
            p.heightCm,
            p.gender,
            p.points,
            p.checkedInToday,
            p.beachCoinsToday,
            p.species,
            p.breed,
            p.themeId,
            p.equipHat,
            p.equipFace,
            p.equipArmor,
            p.equipWeapon,
            p.equipWings,
            p.equipAura,
            p.equipPetGear,
            p.equipMount,
            p.equipMarker,
            JSON.stringify(p.propColors || {}),
            p.cheerCount,
            p.temptCount,
            p.taunt,
            (p.unlockedItems || []).length,
          ]),
        });

        if (!opts?.force && fullSig === lastDataSignatureRef.current) {
          return;
        }
        lastDataSignatureRef.current = fullSig;

        if (data.participants) {
          try {
            const savedPosStr = localStorage.getItem('waist_spectator_positions');
            if (savedPosStr) {
              const parsedPos = JSON.parse(savedPosStr);
              // Merge โดยไม่ทับพิกัดสดของผู้เล่นอื่นที่เพิ่งเดินผ่าน Realtime
              savedSpectatorPosRef.current = {
                ...parsedPos,
                ...savedSpectatorPosRef.current,
              };
            }
            const savedPairStr = localStorage.getItem(`waist_paired_activities_${getBangkok7AmDayKey()}`);
            if (savedPairStr) {
              setPairedActivities((prev) => ({ ...JSON.parse(savedPairStr), ...prev }));
            }
          } catch {
            // ignore invalid storage
          }

          setPlayers(nextParticipants);

          const savedId = localStorage.getItem('waist_user_id');
          if (savedId) {
            const me = nextParticipants.find((p) => p.id === Number(savedId));
            const shouldWalk = Boolean(me && (me.isRoaming || me.role === 'spectator'));
            if (!me) {
              localStorage.removeItem('waist_user_id');
              setCurrentUserId(null);
              setWalkingSpectatorId(null);
            } else if (shouldWalk && walkingSpectatorIdRef.current === null) {
              setWalkingSpectatorId(me.id);
            } else if (!shouldWalk && walkingSpectatorIdRef.current === me.id) {
              setWalkingSpectatorId(null);
            }
          }
          const comps = nextParticipants.filter((p) => p.role !== 'spectator');
          if (comps.length > 0) {
            setSelectedPlayerId((prev) => (comps.some((p) => p.id === prev) ? prev : comps[0].id));
            setBoardTargetId((prev) => (comps.some((p) => p.id === prev) ? prev : comps[0].id));
          }
        }
        if (data.activeSeason) {
          setActiveSeason({
            id: Number(data.activeSeason.id),
            name: String(data.activeSeason.name || ''),
            endDate: String(data.activeSeason.endDate || ''),
            stepTarget: Math.max(1000, Number(data.activeSeason.stepTarget || 300000)),
          });
        }
        if (data.feed && Array.isArray(data.feed) && data.feed.length > 0) {
          setRoastFeed(data.feed);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setPlayersLoadedOnce(true);
      }
    },
    []
  );

  // Safety fallback: never stay stuck on loading screen if network is extremely slow
  useEffect(() => {
    const t = setTimeout(() => {
      setPlayersLoadedOnce(true);
      setInitialArenaReady(true);
    }, 5500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    fetchArenaDataRef.current = fetchArenaData;
  }, [fetchArenaData]);

  const broadcastRealtimeEvent = useCallback((event: string, payload: Record<string, any>) => {
    const enriched = { ...payload, _senderInstance: clientInstanceIdRef.current };
    realtimeChannelRef.current?.send({
      type: 'broadcast',
      event,
      payload: enriched,
    });
    try {
      localBroadcastRef.current?.postMessage({ event, payload: enriched });
    } catch {
      // ignore closed channel
    }
  }, []);

  // ซิงก์สถานะว่าผู้เล่นกำลังทำกิจกรรมหน้าต่างไหนอยู่ ให้เพื่อนเห็นป้ายบนหัวแบบเรียลไทม์!
  useEffect(() => {
    const label = isCardOpen
      ? '🃏 กำลังเล่นไพ่คาสิโน...'
      : isShabuOpen
        ? '🍲 กำลังต้มชาบู...'
        : isVolleyballOpen
          ? '🏐 กำลังตีวอลเลย์บอล...'
          : isPetCafeOpen
            ? '☕ อยู่ในคาเฟ่สัตว์เลี้ยง...'
            : isTaekwondoOpen
              ? '🥋 กำลังฝึกเตะเทควันโด...'
              : isQuestBoardOpen
                ? '📋 กำลังดูกระดานภารกิจ...'
                : isJoinOpen
                  ? '👗 กำลังแต่งตัว...'
                  : '';
    myBusyLabelRef.current = label;
    if (currentUserId && currentUserId > 0) {
      broadcastRealtimeEvent('busy_status', { userId: currentUserId, label });
    }
  }, [
    isCardOpen,
    isShabuOpen,
    isVolleyballOpen,
    isPetCafeOpen,
    isTaekwondoOpen,
    isQuestBoardOpen,
    isJoinOpen,
    currentUserId,
    broadcastRealtimeEvent,
  ]);

  const broadcastArenaSync = useCallback(
    (
      reason: 'user_created' | 'user_updated' | 'weight_logged' | 'shop_updated' | 'roam_toggled' | 'gift_sent',
      meta?: {
        actorId?: number | null;
        actorName?: string;
        actorEmoji?: string;
        detail?: string;
        dividends?: any[];
      }
    ) => {
      broadcastRealtimeEvent('arena_sync', {
        reason,
        actorId: meta?.actorId ?? currentUserId,
        actorName: meta?.actorName ?? '',
        actorEmoji: meta?.actorEmoji ?? '✨',
        detail: meta?.detail ?? '',
        dividends: meta?.dividends ?? [],
        ts: Date.now(),
      });
    },
    [broadcastRealtimeEvent, currentUserId]
  );

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsDrawerOpen(false);
    }
    try {
      const savedPosStr = localStorage.getItem('waist_spectator_positions');
      if (savedPosStr) {
        savedSpectatorPosRef.current = JSON.parse(savedPosStr);
      }
      const savedPairStr = localStorage.getItem(`waist_paired_activities_${getBangkok7AmDayKey()}`);
      if (savedPairStr) {
        setPairedActivities(JSON.parse(savedPairStr));
      }
    } catch {
      // ignore invalid storage
    }
    const savedId = localStorage.getItem('waist_user_id');
    if (savedId && !Number.isNaN(Number(savedId))) {
      const uid = Number(savedId);
      setCurrentUserId(uid);
      setBoardSenderId(String(uid));
    }
    setAuthChecked(true);
    fetchArenaData({ force: true });
  }, [fetchArenaData]);

  const playFishingSfx = useCallback((kind: 'cast' | 'nibble' | 'bite' | 'miss' | 'catch') => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const nowT = ctx.currentTime;
      const playTone = (freq: number, endFreq: number, startOffset: number, dur: number, vol = 0.14) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = kind === 'bite' || kind === 'catch' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, nowT + startOffset);
        osc.frequency.exponentialRampToValueAtTime(endFreq, nowT + startOffset + dur);
        gain.gain.setValueAtTime(vol, nowT + startOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, nowT + startOffset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(nowT + startOffset);
        osc.stop(nowT + startOffset + dur + 0.02);
      };

      if (kind === 'cast') {
        playTone(440, 170, 0, 0.16, 0.11);
      } else if (kind === 'nibble') {
        playTone(540, 420, 0, 0.08, 0.07);
      } else if (kind === 'bite') {
        // Harvest Moon BTN crisp alert chime!
        playTone(980, 1180, 0, 0.09, 0.18);
        playTone(1320, 1560, 0.09, 0.14, 0.2);
      } else if (kind === 'miss') {
        playTone(320, 150, 0, 0.22, 0.12);
      } else if (kind === 'catch') {
        playTone(523, 523, 0, 0.09, 0.14);
        playTone(659, 659, 0.09, 0.09, 0.14);
        playTone(784, 1046, 0.18, 0.18, 0.16);
      }
      setTimeout(() => {
        ctx.close().catch(() => { });
      }, 600);
    } catch {
      // ignore autoplay/audio restrictions
    }
  }, []);

  const cancelFishing = useCallback(() => {
    if (fishingTimersRef.current.nibbleTimer) {
      clearTimeout(fishingTimersRef.current.nibbleTimer);
      fishingTimersRef.current.nibbleTimer = undefined;
    }
    if (fishingTimersRef.current.biteTimer) {
      clearTimeout(fishingTimersRef.current.biteTimer);
      fishingTimersRef.current.biteTimer = undefined;
    }
    if (fishingTimersRef.current.missTimer) {
      clearTimeout(fishingTimersRef.current.missTimer);
      fishingTimersRef.current.missTimer = undefined;
    }
    fishingNibbleUntilRef.current = 0;
    const wasFishing = fishingPhaseRef.current !== 'idle';
    fishingPhaseRef.current = 'idle';
    setFishingPhase('idle');
    if (wasFishing && walkingSpectatorIdRef.current !== null) {
      broadcastRealtimeEvent('fishing', {
        userId: walkingSpectatorIdRef.current,
        phase: 'idle',
        dx: oceanDirRef.current.dx,
        dz: oceanDirRef.current.dz,
      });
    }
  }, [broadcastRealtimeEvent]);

  const startFishing = useCallback(() => {
    cancelFishing();
    setFishingResult(null);
    walkTargetRef.current = null;
    fishingPhaseRef.current = 'waiting';
    setFishingPhase('waiting');
    playFishingSfx('cast');
    if (walkingSpectatorIdRef.current !== null) {
      broadcastRealtimeEvent('fishing', {
        userId: walkingSpectatorIdRef.current,
        phase: 'waiting',
        dx: oceanDirRef.current.dx,
        dz: oceanDirRef.current.dz,
      });
    }

    // สไตล์ Harvest Moon: Back to Nature แท้ๆ — ถ้าสั่นแล้วไม่กดดึง เบ็ดจะยังแช่อยู่ในน้ำและรอปลามากินรอบใหม่ไปเรื่อยๆ!
    const scheduleNextBite = () => {
      if (fishingPhaseRef.current !== 'waiting') return;

      const hasNibble = Math.random() < 0.65;
      const nibbleDelay = 1100 + Math.floor(Math.random() * 1000);
      const biteDelay = hasNibble
        ? nibbleDelay + 1150 + Math.floor(Math.random() * 1300)
        : 1800 + Math.floor(Math.random() * 2000);

      if (hasNibble) {
        fishingTimersRef.current.nibbleTimer = setTimeout(() => {
          if (fishingPhaseRef.current !== 'waiting') return;
          fishingNibbleUntilRef.current = performance.now() + 340;
          playFishingSfx('nibble');
        }, nibbleDelay);
      }

      // สุ่มช่วงเวลาให้กดดึง (มีรอบนรก 0.35–0.45 วิ, รอบโหด, รอบกลาง, รอบชิล)
      // โดยผลปลาที่ตกได้ยังคงสุ่มอิสระฝั่ง Server (สั่นแวบเดียวก็อาจได้รองเท้าแตะหรือปลาธรรมดาได้!)
      const rollSpeed = Math.random();
      const biteWindowMs =
        rollSpeed < 0.15
          ? 350 + Math.floor(Math.random() * 100) // โหมดนรก: 350–450ms!
          : rollSpeed < 0.35
            ? 460 + Math.floor(Math.random() * 140) // โหมดโหด: 460–600ms
            : rollSpeed < 0.75
              ? 620 + Math.floor(Math.random() * 260) // โหมดกลาง: 620–880ms
              : 900 + Math.floor(Math.random() * 250); // โหมดชิล: 900–1150ms

      fishingTimersRef.current.biteTimer = setTimeout(() => {
        if (fishingPhaseRef.current !== 'waiting') return;
        fishingNibbleUntilRef.current = 0;
        fishingPhaseRef.current = 'bite';
        setFishingPhase('bite');
        playFishingSfx('bite');
        if (walkingSpectatorIdRef.current !== null) {
          broadcastRealtimeEvent('fishing', {
            userId: walkingSpectatorIdRef.current,
            phase: 'bite',
            dx: oceanDirRef.current.dx,
            dz: oceanDirRef.current.dz,
          });
        }
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate([90, 35, 90]);
          } catch {
            // ignore
          }
        }
        fishingTimersRef.current.missTimer = setTimeout(() => {
          if (fishingPhaseRef.current !== 'bite') return;
          // ไม่กดดึง → หยุดสั่น กลับไปแช่เบ็ดรอปลามากินรอบถัดไปเรื่อยๆ (ไม่ตัดจบเหมือน BTN!)
          fishingPhaseRef.current = 'waiting';
          setFishingPhase('waiting');
          if (walkingSpectatorIdRef.current !== null) {
            broadcastRealtimeEvent('fishing', {
              userId: walkingSpectatorIdRef.current,
              phase: 'waiting',
              dx: oceanDirRef.current.dx,
              dz: oceanDirRef.current.dz,
            });
          }
          scheduleNextBite();
        }, biteWindowMs);
      }, biteDelay);
    };

    scheduleNextBite();
  }, [cancelFishing, playFishingSfx, broadcastRealtimeEvent]);

  const reelInFish = useCallback(async () => {
    // กดดึงเร็วเกินไปก่อนขึ้น ! (สไตล์ Harvest Moon BTN)
    if (fishingPhaseRef.current === 'waiting') {
      cancelFishing();
      playFishingSfx('miss');
      showToast('💨', 'รีบดึงเร็วไปนิด!', 'รอให้ตัวละครสั่นและขึ้น ! บนหัวก่อนค่อยกดดึงนะ 🎣');
      return;
    }
    if (fishingPhaseRef.current !== 'bite') return;
    if (fishingTimersRef.current.missTimer) {
      clearTimeout(fishingTimersRef.current.missTimer);
      fishingTimersRef.current.missTimer = undefined;
    }
    fishingPhaseRef.current = 'reeling';
    setFishingPhase('reeling');
    playFishingSfx('catch');
    if (walkingSpectatorIdRef.current !== null) {
      broadcastRealtimeEvent('fishing', {
        userId: walkingSpectatorIdRef.current,
        phase: 'reeling',
        dx: oceanDirRef.current.dx,
        dz: oceanDirRef.current.dz,
      });
    }

    try {
      const res = await fetch('/api/fishing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId }),
      });
      const data = await res.json();
      if (!res.ok || !data?.caught) {
        showToast('🚫', 'ดึงเบ็ดไม่สำเร็จ', data?.error || 'ลองเหวี่ยงเบ็ดใหม่อีกครั้งนะ');
        fishingPhaseRef.current = 'idle';
        setFishingPhase('idle');
        return;
      }

      const caught: FishingCatch = data.caught;
      const meta = FISHING_RARITY_META[caught.rarity];

      if (typeof data.points === 'number' && currentUserId && currentUserId > 0) {
        setPlayers((prev) =>
          prev.map((pl) => (pl.id === currentUserId ? { ...pl, points: data.points } : pl))
        );
      }

      // Trigger 3D water splash / rarity light pillar / Guard Sea Pop FX at bobber position (and broadcast to friends!)
      const bPos = fishingBobberPosRef.current;
      const fxDurationMs =
        caught.rarity === 'legendary' || caught.rarity === 'guard_troll'
          ? 3400
          : caught.rarity === 'rare'
            ? 2500
            : caught.rarity === 'uncommon'
              ? 1700
              : 1200;
      fishingFxRef.current = {
        rarity: caught.rarity,
        caughtId: caught.id,
        startedAt: performance.now(),
        durationMs: fxDurationMs,
        bobberX: bPos.x,
        bobberZ: bPos.z,
      };
      broadcastRealtimeEvent('fishing_fx', {
        rarity: caught.rarity,
        caughtId: caught.id,
        durationMs: fxDurationMs,
        bobberX: Number(bPos.x.toFixed(2)),
        bobberZ: Number(bPos.z.toFixed(2)),
      });

      // Tier-specific celebration effects
      if (caught.rarity === 'guard_troll') {
        // แกล้งแฟลชทองให้ดีใจเก้อ แล้วค่อยสั่นจอเมื่อพี่ยามโผล่!!
        setLegendaryFlash(true);
        setTimeout(() => {
          setLegendaryFlash(false);
          setShakeScreen(true);
          setTimeout(() => setShakeScreen(false), 450);
        }, 420);
        confetti({
          particleCount: 55,
          spread: 70,
          origin: { y: 0.62 },
          colors: meta.confettiColors,
        });
      } else if (caught.rarity === 'uncommon') {
        confetti({
          particleCount: 40,
          spread: 58,
          origin: { y: 0.68 },
          colors: meta.confettiColors,
        });
      } else if (caught.rarity === 'rare') {
        confetti({
          particleCount: 85,
          spread: 78,
          origin: { y: 0.6 },
          colors: meta.confettiColors,
        });
      } else if (caught.rarity === 'legendary') {
        setLegendaryFlash(true);
        setTimeout(() => setLegendaryFlash(false), 650);
        confetti({
          particleCount: 120,
          spread: 95,
          origin: { y: 0.55 },
          colors: meta.confettiColors,
        });
        setTimeout(() => {
          confetti({
            particleCount: 95,
            spread: 110,
            origin: { y: 0.48 },
            colors: meta.confettiColors,
          });
        }, 380);

        const me = playersRef.current.find((pl) => pl.id === currentUserId);
        if (me) {
          broadcastRealtimeEvent('arena_sync', {
            reason: 'legendary_fish',
            actorId: me.id,
            actorName: me.name,
            actorEmoji: me.emoji,
            detail: `ตกได้ ${caught.icon} ${caught.name} ระดับ LEGENDARY ริมทะเล! 🎣✨`,
          });
        }
      }

      setFishingResult({
        caught,
        coinsEarned: Number(data.coinsEarned ?? 0),
        dailyRewardCount: Number(data.dailyRewardCount ?? 0),
        dailyRewardLimit: Number(data.dailyRewardLimit ?? 5),
        quotaReached: Boolean(data.quotaReached),
        guestMode: Boolean(data.guestMode),
      });
    } catch {
      showToast('🚫', 'เชื่อมต่อไม่ได้', 'ดึงเบ็ดไม่สำเร็จ ลองใหม่อีกครั้งนะ');
    } finally {
      fishingPhaseRef.current = 'idle';
      setFishingPhase('idle');
      if (walkingSpectatorIdRef.current !== null) {
        broadcastRealtimeEvent('fishing', {
          userId: walkingSpectatorIdRef.current,
          phase: 'idle',
          dx: oceanDirRef.current.dx,
          dz: oceanDirRef.current.dz,
        });
      }
    }
  }, [currentUserId, showToast, broadcastRealtimeEvent, cancelFishing, playFishingSfx]);

  // กด Spacebar เพื่อดึงเบ็ดได้ทันทีแบบจอย PS1 (Harvest Moon BTN)
  useEffect(() => {
    if (fishingPhase !== 'waiting' && fishingPhase !== 'bite') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      reelInFish();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [fishingPhase, reelInFish]);

  useEffect(() => {
    walkingSpectatorIdRef.current = walkingSpectatorId;
    if (walkingSpectatorId === null) {
      setNearbySpectator(null);
      nearbySpectatorIdRef.current = null;
      setIsPairMenuOpen(false);
      walkTargetRef.current = null;
      isNearOceanRef.current = false;
      setIsNearOcean(false);
      isNearCafeRef.current = false;
      setIsNearCafe(false);
      isNearDojangRef.current = false;
      setIsNearDojang(false);
      isNearQuestBoardRef.current = false;
      setIsNearQuestBoard(false);
      setFishingResult(null);
      cancelFishing();
    }
  }, [walkingSpectatorId, cancelFishing]);

  useEffect(() => {
    const handleIncomingRealtimeEvent = (event: string, payload: any) => {
      if (!payload) return;
      if (payload._senderInstance && payload._senderInstance === clientInstanceIdRef.current) {
        return;
      }

      if (event === 'move') {
        if (typeof payload.userId !== 'number') return;
        if (payload.userId === walkingSpectatorIdRef.current) return;
        remoteSpectatorStateRef.current[payload.userId] = {
          x: payload.x,
          y: payload.y ?? 0.2,
          z: payload.z,
          rotY: payload.rotY ?? 0,
          isWalking: Boolean(payload.isWalking),
          updatedAt: performance.now(),
        };
        savedSpectatorPosRef.current[payload.userId] = {
          x: payload.x,
          y: payload.y ?? 0.2,
          z: payload.z,
          rotY: payload.rotY ?? 0,
        };
      } else if (event === 'guard_eject') {
        if (typeof payload.userId !== 'number') return;
        const ejX = Number(payload.x);
        const ejY = Number(payload.y ?? 0.2);
        const ejZ = Number(payload.z);
        const ejRot = Number(payload.rotY ?? 0);
        savedSpectatorPosRef.current[payload.userId] = { x: ejX, y: ejY, z: ejZ, rotY: ejRot };
        remoteSpectatorStateRef.current[payload.userId] = {
          x: ejX,
          y: ejY,
          z: ejZ,
          rotY: ejRot,
          isWalking: false,
          updatedAt: performance.now(),
        };
        const targetMesh = charMeshesRef.current.find((m) => m.id === payload.userId);
        if (targetMesh) {
          targetMesh.rootGroup.position.set(ejX, ejY, ejZ);
          targetMesh.targetPos.set(ejX, ejY, ejZ);
          targetMesh.rootGroup.rotation.y = ejRot;
        }
        if (payload.userId === walkingSpectatorIdRef.current) {
          walkTargetRef.current = null;
          const nowT = performance.now();
          if (nowT - lastLocalEjectAtRef.current > 900) {
            lastLocalEjectAtRef.current = nowT;
            setShakeScreen(true);
            setTimeout(() => setShakeScreen(false), 450);
            if (payload.mode === 'food') {
              showToast(
                '🍖',
                'โดนพี่ยามปาอาหารอัดกระเด็น!',
                'แห่เข้าสนามพร้อมกันหลายคน พี่ยามเลยสาดหมูกรอบในจานไล่ซะเลย!'
              );
            } else {
              showToast('👮', 'โดนพี่ยามไล่ออกจากสนาม!', 'กรุณาข้ามลู่วิ่งตรงทางม้าลายเท่านั้นนะ!');
            }
          }
        }
      } else if (event === 'guard_prank') {
        const prank = GUARD_PRANKS.find((p) => p.id === payload.prankId);
        if (prank) {
          const actorName = String(payload.actorName || 'ผู้กล้า');
          const actorGender = payload.actorGender === 'female' ? 'female' : 'male';
          if (actorGender === 'female') {
            guardRageRef.current = Math.max(0, guardRageRef.current - 2.6);
          } else {
            guardRageRef.current = Math.min(10, guardRageRef.current + 2.8);
          }
          guardPrankFxRef.current = {
            prank,
            actorName,
            startedAt: performance.now(),
            durationMs: 3600,
          };
          showToast(prank.icon, `${actorName} แกล้งพี่ยาม!`, `${prank.label} — "${prank.guardSpeech}"`);
        }
      } else if (event === 'status') {
        if (typeof payload.userId !== 'number') return;
        const text = String(payload.statusText || '').trim();
        const targetMesh = charMeshesRef.current.find((m) => m.id === payload.userId);
        const bubbleEl = targetMesh?.tagEl?.querySelector('[data-speech-bubble]') as HTMLElement | null;
        if (bubbleEl) {
          if (text) {
            bubbleEl.textContent = `💬 ${text}`;
            bubbleEl.classList.remove('hidden');
          } else {
            bubbleEl.textContent = '';
            bubbleEl.classList.add('hidden');
          }
        }
      } else if (event === 'activity') {
        const incoming: Record<number, { animType: string; label: string }> = {};
        if (payload.updates && typeof payload.updates === 'object') {
          Object.entries(payload.updates).forEach(([k, v]: [string, any]) => {
            const uid = Number(k);
            if (!Number.isNaN(uid) && v && typeof v.animType === 'string' && typeof v.label === 'string') {
              incoming[uid] = { animType: v.animType, label: v.label };
            }
          });
        } else if (typeof payload.userId === 'number' && typeof payload.animType === 'string') {
          incoming[payload.userId] = { animType: payload.animType, label: payload.label };
        }
        if (Object.keys(incoming).length === 0) return;
        setPairedActivities((prev) => {
          const next = { ...prev, ...incoming };
          try {
            localStorage.setItem(`waist_paired_activities_${getBangkok7AmDayKey()}`, JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      } else if (event === 'arena_sync') {
        // ซิงก์ทันทีเมื่อมีผู้เล่นสร้างตัวละครใหม่ เปลี่ยนบทบาท แต่งตัว หรืออัปเดตน้ำหนัก
        fetchArenaDataRef.current({ force: true });

        if (payload.actorName) {
          if (payload.reason === 'user_created') {
            showToast(
              payload.actorEmoji || '🆕',
              'ผู้เล่นใหม่เข้าสู่สนาม!',
              `${payload.actorEmoji || ''} ${payload.actorName} ${payload.detail || 'เข้าร่วมอารีน่าแล้ว!'}`
            );
          } else if (payload.reason === 'user_updated' && payload.detail) {
            showToast(
              payload.actorEmoji || '✨',
              'อัปเดตตัวละครสด!',
              `${payload.actorEmoji || ''} ${payload.actorName} ${payload.detail}`
            );
          } else if (payload.reason === 'roam_toggled' && payload.detail) {
            showToast(
              payload.actorEmoji || '🚩',
              'อัปเดตสนามสด!',
              `${payload.actorEmoji || ''} ${payload.actorName} ${payload.detail}`
            );
          } else if (payload.reason === 'legendary_fish' && payload.detail) {
            confetti({
              particleCount: 95,
              spread: 85,
              origin: { y: 0.55 },
              colors: ['#facc15', '#fb923c', '#fef08a', '#ffffff'],
            });
            showToast(
              payload.actorEmoji || '👑',
              'LEGENDARY ริมทะเล!!',
              `${payload.actorEmoji || ''} ${payload.actorName} ${payload.detail}`
            );
          } else if (payload.reason === 'gift_sent' && payload.detail) {
            confetti({ particleCount: 75, spread: 75, origin: { y: 0.6 } });
            showToast(
              '🎁',
              'มีของขวัญส่งถึงกลางสนาม!!',
              `${payload.actorEmoji || ''} ${payload.actorName} ${payload.detail}`
            );
          } else if (payload.reason === 'weight_logged') {
            const divs = Array.isArray(payload.dividends) ? payload.dividends : [];
            const myWin = divs.find((d: any) => Number(d.userId) === currentUserIdRef.current);
            if (myWin) {
              confetti({ particleCount: 95, spread: 80, origin: { y: 0.6 } });
              if (myWin.kind === 'cheer') {
                showToast(
                  '💰',
                  `ปันผลวงแชร์เข้ากระเป๋า! (+${myWin.payout} 💰)`,
                  `เพราะคุณส่งไฟเชียร์ให้ ${payload.actorEmoji || ''} ${payload.actorName} แล้วเพื่อนทำแต้มได้สำเร็จ!`
                );
              } else {
                showToast(
                  '😈',
                  `${myWin.jackpot ? 'แจ็กพอตซุ้มอาหาร!!' : 'แผนขุนพุงสำเร็จ!!'} (+${myWin.payout} 💰)`,
                  `คุณส่งของกินแกล้ง ${payload.actorEmoji || ''} ${payload.actorName} จนพัฒนาการถอยหลัง รับทรัพย์เต็มๆ!`
                );
              }
            } else {
              showToast(
                '⚡',
                'อัปเดตผลภารกิจสด!',
                `${payload.actorEmoji || ''} ${payload.actorName} ส่งผลภารกิจใหม่ในสนามแล้ว!${divs.length > 0 ? ` (แจกปันผล ${divs.length} คน!)` : ''
                }`
              );
            }
          }
        }
      } else if (event === 'coin_claimed') {
        if (payload.spawnToken) {
          claimedTokensRef.current.add(String(payload.spawnToken));
          lunchCoinsRef.current = lunchCoinsRef.current.filter(
            (c) => c.spawnToken !== payload.spawnToken
          );
        }
        if (payload.winnerName && Number(payload.winnerId) !== currentUserIdRef.current) {
          showToast(
            '💰',
            `${payload.winnerEmoji || '⚡'} ${payload.winnerName} ไวจัด!`,
            'แย่งชิงเหรียญทองพักเที่ยงไปได้ +1 💰! รออีก 15 วินาทีเหรียญลูกใหม่จะสุ่มโผล่นะ!'
          );
          fetchArenaDataRef.current({ force: true });
        }
      } else if (event === 'vb_lobby') {
        if (payload.status === 'waiting' && payload.roomCode) {
          setLiveVbLobby({
            roomCode: String(payload.roomCode),
            mode: payload.mode === '2v2' ? '2v2' : '1v1',
            hostUserId: Number(payload.hostUserId || 0),
            hostName: String(payload.hostName || 'เพื่อน'),
            hostEmoji: String(payload.hostEmoji || '🏐'),
            targetName: payload.targetName ? String(payload.targetName) : undefined,
            count: Number(payload.count || 1),
            max: Number(payload.max || 2),
            updatedAt: Date.now(),
          });
        } else {
          setLiveVbLobby((prev) =>
            prev && prev.roomCode === String(payload.roomCode || '') ? null : prev
          );
        }
      } else if (event === 'shabu_lobby') {
        if (payload.status === 'waiting' && payload.roomCode) {
          setLiveShabuLobby({
            roomCode: String(payload.roomCode),
            hostUserId: Number(payload.hostUserId || 0),
            hostName: String(payload.hostName || 'เพื่อน'),
            hostEmoji: String(payload.hostEmoji || '🍲'),
            targetName: payload.targetName ? String(payload.targetName) : undefined,
            count: Number(payload.count || 1),
            max: Number(payload.max || 4),
            updatedAt: Date.now(),
          });
        } else {
          setLiveShabuLobby((prev) =>
            prev && prev.roomCode === String(payload.roomCode || '') ? null : prev
          );
        }
      } else if (event === 'fishing') {
        if (typeof payload.userId !== 'number') return;
        if (payload.userId === walkingSpectatorIdRef.current) return;
        const ph = payload.phase;
        if (ph === 'waiting' || ph === 'bite' || ph === 'reeling') {
          remoteFishingStateRef.current[payload.userId] = {
            phase: ph,
            dx: Number(payload.dx ?? 0),
            dz: Number(payload.dz ?? 1),
            updatedAt: performance.now(),
          };
        } else {
          delete remoteFishingStateRef.current[payload.userId];
        }
      } else if (event === 'fishing_fx') {
        if (payload.rarity && typeof payload.bobberX === 'number' && typeof payload.bobberZ === 'number') {
          fishingFxRef.current = {
            rarity: payload.rarity as FishingRarity,
            caughtId: payload.caughtId ? String(payload.caughtId) : undefined,
            startedAt: performance.now(),
            durationMs: Math.min(4000, Math.max(800, Number(payload.durationMs || 1800))),
            bobberX: payload.bobberX,
            bobberZ: payload.bobberZ,
          };
        }
      } else if (event === 'belly_rub') {
        const targetId = Number(payload.targetUserId);
        if (!targetId) return;
        const targetMesh = charMeshesRef.current.find((m) => m.id === targetId);
        if (targetMesh) {
          targetMesh.rubbedUntil = performance.now() + 950;
        }
        if (targetId === currentUserIdRef.current && Number(payload.actorId) !== currentUserIdRef.current) {
          const actorLabel = payload.actorName
            ? `${payload.actorEmoji || '🤚'} ${payload.actorName}`
            : 'เพื่อนในสนาม';
          showToast('🤚', `${actorLabel} แอบมาลูบพุงคุณ!`, 'จั๊กจี้เลยทีเดียว~ 😄');
        }
      } else if (event === 'busy_status') {
        const uid = Number(payload.userId);
        if (!uid) return;
        const lbl = typeof payload.label === 'string' ? payload.label.trim() : '';
        if (lbl) {
          remoteBusyStatusRef.current[uid] = { label: lbl, updatedAt: performance.now() };
        } else {
          delete remoteBusyStatusRef.current[uid];
        }
      } else if (event === 'card_lobby') {
        if (payload.status === 'waiting' && payload.roomCode) {
          setLiveCardLobby({
            roomCode: String(payload.roomCode),
            gameType: String(payload.gameType || 'pokdeng'),
            hostUserId: Number(payload.hostUserId || 0),
            hostName: String(payload.hostName || 'เพื่อน'),
            hostEmoji: String(payload.hostEmoji || '🃏'),
            targetName: payload.targetName ? String(payload.targetName) : undefined,
            count: Number(payload.count || 1),
            max: Number(payload.max || 5),
            updatedAt: Date.now(),
          });
        } else {
          setLiveCardLobby((prev) =>
            prev && prev.roomCode === String(payload.roomCode || '') ? null : prev
          );
        }
      } else if (event === 'interaction') {
        // แสดงแอนิเมชันยิงลูกไฟเติมพลัง / ไรเดอร์ส่งของกิน 3D ให้ผู้เล่นทุกคนเห็นแบบ Realtime!
        const inter = payload;
        if (typeof inter.targetUserId === 'number') {
          setRoastFeed((prev) => [
            {
              id: `i-${inter.id || Date.now()}`,
              type: inter.kind,
              user: inter.senderName || 'เพื่อนในสนาม',
              emoji: inter.senderEmoji || '📣',
              targetName: inter.targetName || '',
              targetEmoji: inter.targetEmoji || '',
              giftItem: inter.giftItem || '',
              roast: inter.message || '',
              time: new Date().toISOString(),
            },
            ...prev,
          ]);
          pendingDeliveryRef.current = {
            targetId: inter.targetUserId,
            kind: inter.kind === 'tempt' ? 'tempt' : 'cheer',
            label: `${inter.kind === 'cheer' ? '🔥' : '😈'} ${inter.giftItem || ''}`,
            startTime: performance.now(),
          };
          const nextNet = typeof inter.netPower === 'number' ? inter.netPower : null;
          const recvCoinTxt =
            inter.targetUserId === currentUserIdRef.current && inter.receiverBonusEarned > 0
              ? ` (คุณได้รับแต้มกำลังใจ +${inter.receiverBonusEarned} 💰 ด้วย!)`
              : '';
          if (inter.kind === 'cheer') {
            if (nextNet === 6) {
              showToast('⚡', `${inter.targetName} แปลงร่าง SUPER SAIYAN!!`, `${inter.senderName} เติมไฟทะลุขีดจำกัด (+6)!${recvCoinTxt}`);
            } else if (nextNet === 3) {
              showToast('🔥', `${inter.targetName} ติดโหมดไฟบูสต์!!`, `${inter.senderName} เติมเชื้อเพลิง ${inter.giftItem}!${recvCoinTxt}`);
            } else {
              showToast(
                '🔥',
                `เติมไฟให้ ${inter.targetName}! (+1)`,
                `${inter.senderName} ส่ง ${inter.giftItem}${recvCoinTxt}`
              );
            }
          } else {
            if (nextNet === -6) {
              showToast('🩷', `${inter.targetName} กลายร่างเป็นจอมมารบู!!`, `โดน ${inter.senderName} ขุนของกินทะลุพิกัด (-6)!`);
            } else if (nextNet === -3) {
              showToast('💤', `${inter.targetName} ขยายร่างเป็นคาบิก้อน!!`, `โดน ${inter.senderName} ส่ง ${inter.giftItem} จนพุงกาง (-3)!`);
            } else {
              showToast(
                '😈',
                `มารผจญบุกขุน ${inter.targetName}! (-1)`,
                `${inter.senderName} ส่ง ${inter.giftItem} ไปล่อถึงที่!`
              );
            }
          }
          // ซิงก์เกจพลัง +/- จากเซิร์ฟเวอร์ทันทีที่ลูกไฟ/ไรเดอร์ส่งถึงเป้าหมาย
          setTimeout(() => {
            fetchArenaDataRef.current({ force: true });
          }, 1150);
        }
      }
    };

    // 1. BroadcastChannel สำหรับซิงก์ข้ามแท็บในเบราว์เซอร์เดียวกันทันที (ทำงานได้แม้ไม่ตั้งค่า Supabase)
    let bc: BroadcastChannel | null = null;
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      bc = new BroadcastChannel('waist-arena-local-sync');
      bc.onmessage = (ev) => {
        if (ev.data && typeof ev.data.event === 'string') {
          handleIncomingRealtimeEvent(ev.data.event, ev.data.payload);
        }
      };
      localBroadcastRef.current = bc;
    }

    // 2. Smart Background Diff-Polling + Tab Focus Sync (ยืดรอบเป็น 25 วิเมื่อ Realtime ทำงานอยู่ เพื่อประหยัดแบตมือถือ)
    let pollTick = 0;
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        pollTick++;
        if (realtimeSubscribedRef.current && pollTick % 5 !== 0) {
          return;
        }
        fetchArenaDataRef.current();
      }
    }, 5000);

    const onVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        fetchArenaDataRef.current();
      }
    };
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    // 3. Supabase Realtime สำหรับซิงก์ข้ามเครื่องแบบเสี้ยววินาที
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let supabase: ReturnType<typeof createClient> | null = null;
    let channel: RealtimeChannel | null = null;

    if (url && key) {
      supabase = createClient(url, key, {
        realtime: { params: { eventsPerSecond: 20 } },
      });

      channel = supabase.channel('waist-arena-live', {
        config: { broadcast: { self: false } },
      });

      channel
        .on('broadcast', { event: 'move' }, ({ payload }) => handleIncomingRealtimeEvent('move', payload))
        .on('broadcast', { event: 'guard_eject' }, ({ payload }) =>
          handleIncomingRealtimeEvent('guard_eject', payload)
        )
        .on('broadcast', { event: 'guard_prank' }, ({ payload }) =>
          handleIncomingRealtimeEvent('guard_prank', payload)
        )
        .on('broadcast', { event: 'status' }, ({ payload }) => handleIncomingRealtimeEvent('status', payload))
        .on('broadcast', { event: 'activity' }, ({ payload }) => handleIncomingRealtimeEvent('activity', payload))
        .on('broadcast', { event: 'arena_sync' }, ({ payload }) =>
          handleIncomingRealtimeEvent('arena_sync', payload)
        )
        .on('broadcast', { event: 'coin_claimed' }, ({ payload }) =>
          handleIncomingRealtimeEvent('coin_claimed', payload)
        )
        .on('broadcast', { event: 'interaction' }, ({ payload }) =>
          handleIncomingRealtimeEvent('interaction', payload)
        )
        .on('broadcast', { event: 'vb_lobby' }, ({ payload }) =>
          handleIncomingRealtimeEvent('vb_lobby', payload)
        )
        .on('broadcast', { event: 'shabu_lobby' }, ({ payload }) =>
          handleIncomingRealtimeEvent('shabu_lobby', payload)
        )
        .on('broadcast', { event: 'card_lobby' }, ({ payload }) =>
          handleIncomingRealtimeEvent('card_lobby', payload)
        )
        .on('broadcast', { event: 'fishing' }, ({ payload }) =>
          handleIncomingRealtimeEvent('fishing', payload)
        )
        .on('broadcast', { event: 'fishing_fx' }, ({ payload }) =>
          handleIncomingRealtimeEvent('fishing_fx', payload)
        )
        .on('broadcast', { event: 'belly_rub' }, ({ payload }) =>
          handleIncomingRealtimeEvent('belly_rub', payload)
        )
        .on('broadcast', { event: 'busy_status' }, ({ payload }) =>
          handleIncomingRealtimeEvent('busy_status', payload)
        )
        .on('broadcast', { event: 'hello' }, () => {
          const myId = walkingSpectatorIdRef.current;
          if (myId === null || !channel) return;
          const myMesh = charMeshesRef.current.find((m) => m.id === myId);
          if (myMesh) {
            channel.send({
              type: 'broadcast',
              event: 'move',
              payload: {
                userId: myId,
                x: Number(myMesh.rootGroup.position.x.toFixed(2)),
                y: Number(myMesh.rootGroup.position.y.toFixed(2)),
                z: Number(myMesh.rootGroup.position.z.toFixed(2)),
                rotY: Number(myMesh.rootGroup.rotation.y.toFixed(2)),
                isWalking: false,
              },
            });
            channel.send({
              type: 'broadcast',
              event: 'activity',
              payload: {
                userId: myId,
                animType: myMesh.workoutType,
                label: myMesh.activityLabel,
              },
            });
            if (fishingPhaseRef.current !== 'idle') {
              channel.send({
                type: 'broadcast',
                event: 'fishing',
                payload: {
                  userId: myId,
                  phase: fishingPhaseRef.current,
                  dx: oceanDirRef.current.dx,
                  dz: oceanDirRef.current.dz,
                },
              });
            }
            if (myBusyLabelRef.current && currentUserIdRef.current && currentUserIdRef.current > 0) {
              channel.send({
                type: 'broadcast',
                event: 'busy_status',
                payload: {
                  userId: currentUserIdRef.current,
                  label: myBusyLabelRef.current,
                },
              });
            }
          }
        })
        .subscribe((status) => {
          realtimeSubscribedRef.current = status === 'SUBSCRIBED';
          if (status === 'SUBSCRIBED' && channel) {
            channel.send({ type: 'broadcast', event: 'hello', payload: {} });
          }
        });

      realtimeChannelRef.current = channel;
    }

    return () => {
      realtimeSubscribedRef.current = false;
      clearInterval(pollInterval);
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
      if (bc) {
        bc.close();
        localBroadcastRef.current = null;
      }
      if (supabase && channel) {
        realtimeChannelRef.current = null;
        supabase.removeChannel(channel);
      }
    };
  }, [showToast]);

  useEffect(() => {
    const getBangkokDayPhase = (): 'dawn' | 'day' | 'dusk' | 'night' => {
      const bkkNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
      const bkkHour = bkkNow.getUTCHours() + bkkNow.getUTCMinutes() / 60;
      if (bkkHour >= 5.5 && bkkHour < 8) return 'dawn';
      if (bkkHour >= 8 && bkkHour < 17) return 'day';
      if (bkkHour >= 17 && bkkHour < 19) return 'dusk';
      return 'night';
    };

    const mapWmoWeather = (code: number, dayPhase: 'dawn' | 'day' | 'dusk' | 'night') => {
      const isDay = dayPhase !== 'night';
      if (code === 95 || code === 96 || code === 99) {
        return { condition: 'storm' as const, label: 'พายุฝนฟ้าคะนอง', emoji: '⛈️' };
      }
      if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
        return { condition: 'rain' as const, label: 'ฝนตก', emoji: '🌧️' };
      }
      if (code === 0 || code === 1) {
        if (dayPhase === 'dawn') return { condition: 'clear' as const, label: 'หัวเช้าสดใส', emoji: '🌅' };
        if (dayPhase === 'dusk') return { condition: 'clear' as const, label: 'ยามเย็น', emoji: '🌇' };
        return {
          condition: 'clear' as const,
          label: isDay ? 'แดดจ้า' : 'ฟ้าโปร่ง',
          emoji: isDay ? '☀️' : '🌙',
        };
      }
      if (dayPhase === 'dawn') return { condition: 'cloudy' as const, label: 'หัวเช้ามีเมฆ', emoji: '🌅' };
      if (dayPhase === 'dusk') return { condition: 'cloudy' as const, label: 'ยามเย็นครึ้มๆ', emoji: '🌇' };
      return {
        condition: 'cloudy' as const,
        label: isDay ? 'มีเมฆมาก' : 'มีเมฆครึ้ม',
        emoji: isDay ? '⛅' : '☁️',
      };
    };

    const fetchBangkokWeather = async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=13.7563&longitude=100.5018&current=temperature_2m,weather_code,is_day&timezone=Asia%2FBangkok'
        );
        if (!res.ok) return;
        const data = await res.json();
        const cur = data?.current;
        if (!cur) return;
        const dayPhase = getBangkokDayPhase();
        const isDay = dayPhase !== 'night' && Number(cur.is_day) === 1 ? true : dayPhase !== 'night';
        const code = Number(cur.weather_code ?? 0);
        const temp = Math.round(Number(cur.temperature_2m ?? 30));
        const mapped = mapWmoWeather(code, dayPhase);
        const nextWeather = { temp, isDay, dayPhase, ...mapped };
        bkkWeatherRef.current = nextWeather;
        setBkkWeather(nextWeather);
      } catch {
        // ignore network errors
      }
    };

    fetchBangkokWeather();
    const timer = setInterval(fetchBangkokWeather, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      keysPressedRef.current[e.code] = true;
      keysPressedRef.current[e.key.toLowerCase()] = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.code] = false;
      keysPressedRef.current[e.key.toLowerCase()] = false;
    };
    const onBlur = () => {
      keysPressedRef.current = {};
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      stopBgm();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const toggleMusic = () => {
    setIsMusicOn((prev) => {
      const next = !prev;
      if (next) startBgm();
      else stopBgm();
      return next;
    });
  };

  const competitors = React.useMemo(
    () => players.filter((p) => p.role !== 'spectator'),
    [players]
  );

  const rankedPlayers = React.useMemo(() => {
    const seasonStepTarget = activeSeason?.stepTarget || 300000;
    return competitors
      .map((p) => {
        const gType = p.goalType || 'weight_loss';
        const sVal = p.startVal ?? p.startWeight;
        const cVal = p.currentVal ?? p.currentWeight;
        const tVal = p.targetVal ?? p.goalWeight;
        const hasOwnVals =
          typeof sVal === 'number' && typeof cVal === 'number' && typeof tVal === 'number';
        const { pct: sidePct, diffLabel, isInFoodStall } = hasOwnVals
          ? computeGoalProgress(gType, sVal, cVal, tVal)
          : {
            pct: p.sideGoalProgressPct ?? 0,
            diffLabel: p.diffLabel ?? '',
            isInFoodStall: Boolean(p.isInFoodStall),
          };

        const stepCount = Math.max(0, Number(p.stepCount ?? 0));
        const stepTarget = Math.max(1000, Number(p.stepTarget ?? seasonStepTarget));
        const stepPct =
          typeof p.stepProgressPct === 'number'
            ? p.stepProgressPct
            : Math.round((stepCount / stepTarget) * 1000) / 10;

        // ลู่วิ่ง 3D และอันดับอิงจาก Step Challenge (เป้าหลัก) ส่วนรูปร่าง 3D ยังอิงจาก BMI & ภารกิจรอง
        const progressRatio = Math.max(0, Math.min(1, stepPct / 100));
        const sideRatio = Math.max(0, Math.min(1, sidePct / 100));
        const negRatio = sidePct < 0 ? Math.min(1, Math.abs(sidePct) / 45) : 0;

        let bellyScale = 1.0;
        let muscleScale = 1.0;
        const hasBmiScale = typeof p.bmiBellyScale === 'number';
        if (gType === 'muscle_gain') {
          bellyScale = hasBmiScale
            ? Math.max(0.88, Math.min(1.45, p.bmiBellyScale! * 0.94 + (isInFoodStall ? 0.1 : 0)))
            : isInFoodStall
              ? 1.18
              : 1.04;
          muscleScale = Math.max(0.92, 1.05 + sideRatio * 0.65 - negRatio * 0.12);
        } else if (hasBmiScale) {
          bellyScale = Math.max(
            0.75,
            Math.min(1.55, p.bmiBellyScale! + (isInFoodStall ? 0.08 : 0))
          );
          if (gType === 'reps_accumulate' || gType === 'distance_accumulate') {
            muscleScale = 1.1 + sideRatio * 0.25;
          }
        } else if (gType === 'weight_loss') {
          bellyScale = Math.max(0.78, Math.min(1.55, 1.25 - sideRatio * 0.42 + negRatio * 0.25));
        } else if (gType === 'weight_gain') {
          bellyScale = Math.max(0.76, Math.min(1.45, 0.86 + sideRatio * 0.45 - negRatio * 0.08));
        } else {
          bellyScale = 0.94;
          muscleScale = 1.1 + sideRatio * 0.25;
        }

        return {
          ...p,
          goalType: gType,
          stepCount,
          stepTarget,
          stepProgressPct: stepPct,
          sideGoalProgressPct: sidePct,
          progressPct: stepPct,
          diffLabel,
          isInFoodStall,
          lostKg: hasOwnVals ? Number((sVal - cVal).toFixed(1)) : undefined,
          pctLost: sidePct,
          progressRatio,
          bellyScale,
          muscleScale,
        };
      })
      .sort(
        (a, b) =>
          (b.stepProgressPct ?? 0) - (a.stepProgressPct ?? 0) ||
          (b.stepCount ?? 0) - (a.stepCount ?? 0) ||
          (b.sideGoalProgressPct ?? 0) - (a.sideGoalProgressPct ?? 0)
      );
  }, [competitors, activeSeason]);

  // ลายเซ็นเฉพาะฟิลด์ที่ส่งผลต่อโมเดลและตำแหน่ง 3D ในสนาม เพื่อไม่ให้ฉาก 3D ถูกรีเซ็ตหากเปลี่ยนแค่แต้มหรือข้อความพูดคุย
  const sceneSignature = React.useMemo(() => {
    return JSON.stringify(
      players.map((p) => [
        p.id,
        p.name,
        p.emoji,
        p.colorHex,
        p.bandColor,
        p.accessory,
        p.role,
        p.isRoaming,
        p.workoutType,
        p.petType,
        p.goalType,
        p.startVal,
        p.currentVal,
        p.targetVal,
        p.stepCount,
        p.stepTarget,
        p.stepProgressPct,
        p.sideGoalProgressPct,
        p.progressPct,
        p.bmiBellyScale,
        p.isInFoodStall,
        p.species,
        p.breed,
        p.themeId,
        p.equipHat,
        p.equipFace,
        p.equipArmor,
        p.equipWeapon,
        p.equipWings,
        p.equipAura,
        p.equipPetGear,
        p.equipMount,
        p.equipMarker,
        JSON.stringify(p.propColors || {}),
        p.cheerCount,
        p.temptCount,
      ])
    );
  }, [players]);

  const autoFocusedUserIdRef = useRef<number | null>(null);

  const focusOnCharacter = useCallback((playerId: number) => {
    const charObj = charMeshesRef.current.find((c) => c.id === playerId);
    if (!charObj) return;
    const pos = charObj.rootGroup.position;
    cameraLookAtRef.current.set(pos.x, 1.6, pos.z);
    cameraTargetPosRef.current = new THREE.Vector3(pos.x + 2.5, 5.2, pos.z + 7.5);
  }, []);

  // Auto-focus camera onto the signed-in player's 3D character once on entry / character switch
  useEffect(() => {
    if (!currentUserId || currentUserId <= 0) {
      autoFocusedUserIdRef.current = null;
      return;
    }
    if (!initialArenaReady) return;
    if (autoFocusedUserIdRef.current === currentUserId) return;
    if (charMeshesRef.current.some((c) => c.id === currentUserId)) {
      autoFocusedUserIdRef.current = currentUserId;
      focusOnCharacter(currentUserId);
    }
  }, [initialArenaReady, currentUserId, players, focusOnCharacter]);

  const openRadialActivityMenu = useCallback((cx: number, cy: number) => {
    const pool = [...FIT_ACTIVITIES, ...EAT_ACTIVITIES];
    const seen = new Set<string>();
    const shuffled = pool
      .slice()
      .sort(() => Math.random() - 0.5)
      .filter((item) => {
        if (seen.has(item.animType)) return false;
        seen.add(item.animType);
        return true;
      })
      .slice(0, 6);
    const padX = Math.min(145, Math.max(115, window.innerWidth / 2 - 12));
    const padY = Math.min(155, Math.max(125, window.innerHeight / 2 - 12));
    const x = Math.max(padX, Math.min(window.innerWidth - padX, cx));
    const y = Math.max(padY, Math.min(window.innerHeight - padY, cy));
    setRadialMenu({ x, y, options: shuffled });
  }, []);

  const openGuardPrankMenu = useCallback((cx: number, cy: number) => {
    const padX = Math.min(152, Math.max(120, window.innerWidth / 2 - 12));
    const padY = Math.min(160, Math.max(130, window.innerHeight / 2 - 12));
    const x = Math.max(padX, Math.min(window.innerWidth - padX, cx));
    const y = Math.max(padY, Math.min(window.innerHeight - padY, cy));
    setGuardPrankMenu({ x, y, options: pickRandomGuardPranks(6) });
  }, []);

  const handleTriggerGuardPrank = useCallback(
    async (prank: GuardPrank) => {
      const uid = currentUserId;
      if (!uid || uid <= 0) {
        showToast('🔒', 'กรุณาเข้าสู่ระบบก่อน', 'เข้าสู่ระบบเพื่อใช้แต้มแกล้งพี่ยาม!');
        return;
      }
      if (prankingGuard) return;
      setPrankingGuard(true);
      try {
        const res = await fetch('/api/guard-prank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: uid, prankId: prank.id }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast('💰', 'แกล้งพี่ยามไม่สำเร็จ', data.error || 'แต้มไม่พอหรือเกิดข้อผิดพลาด');
          return;
        }
        const me = playersRef.current.find((p) => p.id === uid);
        const actorName = me?.name || 'ผู้กล้า';
        const actorGender = data.actorGender === 'female' || me?.gender === 'female' ? 'female' : 'male';
        if (actorGender === 'female') {
          guardRageRef.current = Math.max(0, guardRageRef.current - 2.6);
        } else {
          guardRageRef.current = Math.min(10, guardRageRef.current + 2.8);
        }
        if (typeof data.points === 'number') {
          setPlayers((prev) => prev.map((p) => (p.id === uid ? { ...p, points: data.points } : p)));
        }
        setGuardPrankMenu(null);
        guardPrankFxRef.current = {
          prank,
          actorName,
          startedAt: performance.now(),
          durationMs: 3600,
        };
        setShakeScreen(true);
        setTimeout(() => setShakeScreen(false), 450);
        confetti({
          particleCount: 70,
          spread: 85,
          origin: { y: 0.6 },
          colors: ['#facc15', '#ef4444', '#f472b6', '#38bdf8'],
        });
        showToast(
          prank.icon,
          `แกล้งพี่ยามสำเร็จ! (-${prank.cost} 💰)`,
          `${prank.label} • พี่ยามร้อง: "${prank.guardSpeech}"`
        );
        broadcastRealtimeEvent('guard_prank', {
          prankId: prank.id,
          actorId: uid,
          actorName,
          actorGender,
        });
      } catch {
        showToast('❌', 'เชื่อมต่อไม่สำเร็จ', 'ลองใหม่อีกครั้งนะ');
      } finally {
        setPrankingGuard(false);
      }
    },
    [currentUserId, prankingGuard, showToast, broadcastRealtimeEvent]
  );

  const applySpectatorActivity = useCallback(
    (act: SpectatorActivity) => {
      if (!currentUserId) return;
      setPairedActivities((prev) => {
        const next = {
          ...prev,
          [currentUserId]: { animType: act.animType, label: act.label },
        };
        try {
          localStorage.setItem(`waist_paired_activities_${getBangkok7AmDayKey()}`, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
      setRadialMenu(null);
      broadcastRealtimeEvent('activity', {
        userId: currentUserId,
        animType: act.animType,
        label: act.label,
      });
      showToast('🎡', 'เปลี่ยนกิจกรรมแล้ว!', act.label);
    },
    [currentUserId, broadcastRealtimeEvent, showToast]
  );

  const openCreateModal = useCallback(() => {
    setJoinMode('create');
    setWardrobeInitialTab('armor');
    setEditingPlayerId(null);
    setJoinRole('competitor');
    setJoinWorkout('fit');
    setJoinPet('none');
    setJoinName('');
    setJoinEmoji('🐰');
    setJoinColor('#F8FAFC');
    setJoinAccessory('headband');
    setJoinBandColor('#FFE600');
    setJoinSpecies('bunny');
    setJoinThemeId('none');
    setJoinEquipHat('hat_red_bow');
    setJoinEquipFace('face_none');
    setJoinEquipArmor('armor_snow_dress');
    setJoinEquipWeapon('weapon_none');
    setJoinEquipWings('wings_none');
    setJoinEquipAura('aura_none');
    setJoinEquipPetGear('pet_none');
    setJoinEquipMount('mount_none');
    setJoinEquipMarker('marker_wood');
    setJoinPropColors({});
    setJoinGoalType('weight_loss');
    setJoinPin('');
    setJoinStatus('');
    setJoinStart('');
    setJoinGoal('');
    setJoinBodyWeight('');
    setJoinHeightCm('');
    setJoinGender('female');
    setJoinError('');
    setIsJoinOpen(true);
  }, []);

  const openWardrobeModal = useCallback(
    (p: Player, tab: ShopCategory | 'gacha' = 'armor') => {
      setJoinMode('edit');
      setWardrobeInitialTab(tab);
      setEditingPlayerId(p.id);
      setJoinRole('competitor');
      setJoinWorkout(isEatPath(p.workoutType) ? 'eat' : 'fit');
      setJoinPet(p.petType || 'none');
      setJoinGoalType((p.goalType as GoalType) || 'weight_loss');
      const sVal = p.startVal ?? p.startWeight ?? 0;
      const tVal = p.targetVal ?? p.goalWeight ?? 0;
      const isCumulativeGoal = p.goalType === 'reps_accumulate' || p.goalType === 'distance_accumulate';
      const bwVal = p.bodyWeight ?? (!isCumulativeGoal ? (p.currentVal ?? p.currentWeight ?? sVal) : 0);
      const hVal = p.heightCm ?? 0;
      setJoinStart(p.id === currentUserId && sVal > 0 ? String(sVal) : '');
      setJoinGoal(p.id === currentUserId && tVal > 0 ? String(tVal) : '');
      setJoinBodyWeight(p.id === currentUserId && bwVal > 0 ? String(bwVal) : '');
      setJoinHeightCm(p.id === currentUserId && hVal > 0 ? String(hVal) : '');
      setJoinGender(p.id === currentUserId && p.gender === 'male' ? 'male' : 'female');
      setJoinName(p.name);
      setJoinEmoji(p.emoji);
      setJoinColor(p.colorHex || '#F8FAFC');
      setJoinAccessory(p.accessory || 'headband');
      setJoinBandColor(p.bandColor || '#FFE600');
      setJoinSpecies(p.breed || p.species || 'bunny');
      setJoinThemeId(p.themeId || 'none');
      setJoinEquipHat(p.equipHat || 'none');
      setJoinEquipFace(p.equipFace || 'face_none');
      setJoinEquipArmor(p.equipArmor || 'armor_none');
      setJoinEquipWeapon(p.equipWeapon || 'weapon_none');
      setJoinEquipWings(p.equipWings || 'wings_none');
      setJoinEquipAura(p.equipAura || 'aura_none');
      setJoinEquipPetGear(p.equipPetGear || 'pet_none');
      setJoinEquipMount(p.equipMount || 'mount_none');
      setJoinEquipMarker(p.equipMarker || 'marker_wood');
      setJoinPropColors(p.propColors || {});
      setJoinPin('');
      setJoinStatus(p.statusText || '');
      setJoinError('');
      setIsJoinOpen(true);
    },
    [currentUserId]
  );

  const openEditModal = useCallback(
    (p: Player) => {
      focusOnCharacter(p.id);
      if (p.role !== 'spectator') {
        setBoardTargetId(p.id);
        setBoardMessage('');
        setActionTargetPlayer(p);
        return;
      }
      if (p.id !== currentUserId) {
        return;
      }
      openWardrobeModal(p);
    },
    [focusOnCharacter, currentUserId, openWardrobeModal]
  );

  const getOverviewCameraPos = () => {
    const isPortrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
    const extra = Math.min(6, Math.max(0, players.length - 6) * 0.35);
    return isPortrait
      ? new THREE.Vector3(-2, 26 + extra, 40 + extra * 0.9)
      : new THREE.Vector3(-2, 19 + extra, 29 + extra * 0.8);
  };

  const setCameraView = (mode: 'overview' | 'leader' | 'loser') => {
    if (mode === 'overview') {
      cameraTargetPosRef.current = getOverviewCameraPos();
      cameraLookAtRef.current.set(0, 1.2, 0);
    } else if (mode === 'leader' && leaderIdRef.current !== null) {
      focusOnCharacter(leaderIdRef.current);
    } else if (mode === 'loser' && loserIdRef.current !== null) {
      focusOnCharacter(loserIdRef.current);
    }
  };

  useEffect(() => {
    if (!playersLoadedOnce) return;
    if (!canvasRef.current || !labelsRef.current) return;

    const readyTimer = setTimeout(() => {
      setInitialArenaReady(true);
    }, 800);

    const container = canvasRef.current;
    const labelsContainer = labelsRef.current;
    container.innerHTML = '';
    labelsContainer.innerHTML = '';

    leaderIdRef.current = rankedPlayers[0]?.id ?? null;
    loserIdRef.current = rankedPlayers.length > 1 ? rankedPlayers[rankedPlayers.length - 1].id : null;

    const resolveWeatherTargets = (w: typeof bkkWeatherRef.current) => {
      let targetHex = 0xbae6fd;
      let targetLightHex = 0xffffff;
      let targetHemi = 0.78;
      let targetDir = 0.95;
      if (w) {
        if (w.dayPhase === 'night') {
          targetLightHex = 0xcbd5e1;
          if (w.condition === 'rain' || w.condition === 'storm') {
            targetHex = 0x090d16;
            targetHemi = 0.38;
            targetDir = 0.35;
          } else {
            targetHex = 0x0f172a;
            targetHemi = 0.45;
            targetDir = 0.48;
          }
        } else if (w.dayPhase === 'dawn') {
          targetLightHex = 0xffedd5;
          if (w.condition === 'rain' || w.condition === 'storm') {
            targetHex = 0x6b7280;
            targetHemi = 0.52;
            targetDir = 0.45;
          } else if (w.condition === 'cloudy') {
            targetHex = 0xfbcfe8;
            targetHemi = 0.68;
            targetDir = 0.65;
          } else {
            targetHex = 0xfde68a;
            targetHemi = 0.74;
            targetDir = 0.8;
          }
        } else if (w.dayPhase === 'dusk') {
          targetLightHex = 0xfdba74;
          if (w.condition === 'rain' || w.condition === 'storm') {
            targetHex = 0x57534e;
            targetHemi = 0.48;
            targetDir = 0.42;
          } else if (w.condition === 'cloudy') {
            targetHex = 0xfdba74;
            targetHemi = 0.62;
            targetDir = 0.62;
          } else {
            targetHex = 0xfb923c;
            targetHemi = 0.68;
            targetDir = 0.78;
          }
        } else if (w.condition === 'rain' || w.condition === 'storm') {
          targetHex = 0x64748b;
          targetHemi = 0.52;
          targetDir = 0.45;
        } else if (w.condition === 'cloudy') {
          targetHex = 0xcbd5e1;
          targetHemi = 0.65;
          targetDir = 0.68;
        }
      }
      const isRaining = Boolean(w && (w.condition === 'rain' || w.condition === 'storm'));
      const showNight = Boolean(w && w.dayPhase === 'night' && !isRaining);
      return { targetHex, targetLightHex, targetHemi, targetDir, isRaining, showNight };
    };

    const initWeather = resolveWeatherTargets(bkkWeatherRef.current);
    const scene = new THREE.Scene();
    const skyColor = new THREE.Color(initWeather.targetHex);
    scene.background = skyColor;
    scene.fog = new THREE.FogExp2(initWeather.targetHex, 0.0048);

    const roamingList = players.filter((pl) => pl.isRoaming || pl.role === 'spectator');
    // ล็อกความกว้างลู่วิ่งสวยๆ ที่ 7 ช่องหลัก (Top 7 ตัวใหญ่เต็มลู่ • อันดับ #8 ลงไปย่อเป็นจิบิมินิวิ่งตามหลัง!)
    const laneCount = 7;
    const halfLen = Math.min(
      28,
      Math.max(22, 20 + Math.floor(Math.max(competitors.length, roamingList.length) * 0.25))
    );
    const trackWidth = laneCount * 2.2 + 1.2;
    const specPerSide = Math.max(1, Math.ceil(roamingList.length / 2));
    const specRows = Math.max(1, Math.ceil(specPerSide / 14));
    const islandCenterX = -2.5;
    const islandW = halfLen * 2 + 24;
    const islandD = Math.max(38, trackWidth + 21 + (specRows - 1) * 5.0);

    // Adaptive quality profile (Desktop = High unchanged, iPad = Medium, Mobile = Lite)
    const qCfg = getQualityConfig(qualityMode);

    // 3D Rain particles (synced with Bangkok weather)
    const rainCount = qCfg.rainCount;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPositions[i * 3] = islandCenterX + (Math.random() - 0.5) * (islandW + 16);
      rainPositions[i * 3 + 1] = Math.random() * 28;
      rainPositions[i * 3 + 2] = (Math.random() - 0.5) * (islandD + 16);
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 0.22,
      transparent: true,
      opacity: 0.78,
    });
    const rainPoints = new THREE.Points(rainGeo, rainMat);
    rainPoints.visible = initWeather.isRaining;
    scene.add(rainPoints);

    // Night moon + stars (synced with Bangkok is_day)
    const nightGroup = new THREE.Group();
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.0, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    moonMesh.position.set(-24, 28, -(islandD / 2 + 22));
    nightGroup.add(moonMesh);
    const starCount = qCfg.starCount;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * (islandW + 60);
      starPos[i * 3 + 1] = 18 + Math.random() * 28;
      starPos[i * 3 + 2] = -(islandD / 2 + 8) - Math.random() * 45;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, transparent: true, opacity: 0.85 });
    nightGroup.add(new THREE.Points(starGeo, starMat));
    nightGroup.visible = initWeather.showNight;
    scene.add(nightGroup);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 340);
    if (savedCameraPosRef.current) {
      camera.position.copy(savedCameraPosRef.current);
    } else {
      camera.position.copy(getOverviewCameraPos());
    }
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: qCfg.antialias, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qCfg.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = qCfg.shadowType;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minDistance = 4.5;
    controls.maxDistance = 210;
    controls.target.copy(cameraLookAtRef.current);
    controlsRef.current = controls;

    controls.addEventListener('start', () => {
      cameraTargetPosRef.current = null;
    });

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfef08a, initWeather.targetHemi);
    hemiLight.position.set(0, 34, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(initWeather.targetLightHex, initWeather.targetDir);
    dirLight.position.set(16, 32, 18);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = qCfg.shadowMapSize;
    dirLight.shadow.mapSize.height = qCfg.shadowMapSize;

    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 160;
    const d = Math.max(32, Math.max(islandW, islandD) / 2 + 6);
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    // Golden Tropical Sandy Beach Island Texture
    const sandCanvas = document.createElement('canvas');
    sandCanvas.width = 512;
    sandCanvas.height = 512;
    const sCtx = sandCanvas.getContext('2d');
    if (sCtx) {
      const grad = sCtx.createRadialGradient(256, 256, 80, 256, 256, 340);
      grad.addColorStop(0, '#fef3c7');
      grad.addColorStop(0.72, '#fde68a');
      grad.addColorStop(1, '#fcd34d');
      sCtx.fillStyle = grad;
      sCtx.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 1600; i++) {
        const sx = (i * 73) % 512;
        const sy = (i * 137) % 512;
        sCtx.fillStyle = i % 2 === 0 ? 'rgba(217, 119, 6, 0.12)' : 'rgba(255, 255, 255, 0.22)';
        sCtx.fillRect(sx, sy, 2, 2);
      }
    }
    const sandTex = new THREE.CanvasTexture(sandCanvas);
    sandTex.colorSpace = THREE.SRGBColorSpace;

    const island = new THREE.Mesh(
      new THREE.BoxGeometry(islandW, 1.1, islandD),
      new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.86 })
    );
    island.position.set(islandCenterX, -0.55, 0);
    island.receiveShadow = true;
    scene.add(island);

    // Long straight track (stretches automatically when there are more players)
    const trackCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-halfLen, 0.14, 0),
      new THREE.Vector3(0, 0.14, 0),
      new THREE.Vector3(halfLen, 0.14, 0),
    ]);

    const segments = 120;
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = trackCurve.getPointAt(t);
      const tan = trackCurve.getTangentAt(t);
      const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const left = pt.clone().addScaledVector(normal, -trackWidth / 2);
      const right = pt.clone().addScaledVector(normal, trackWidth / 2);
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      uvs.push(t, 0, t, 1);
      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    trackGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    trackGeo.setIndex(indices);
    trackGeo.computeVertexNormals();

    // Procedural grassy racing track texture with dynamic multi-lane dividers + glowing magic rune circle
    const trackCanvas = document.createElement('canvas');
    trackCanvas.width = 1024;
    trackCanvas.height = 1024;
    const tCtx = trackCanvas.getContext('2d');
    if (tCtx) {
      tCtx.fillStyle = '#65a30d';
      tCtx.fillRect(0, 0, 1024, 1024);
      const lanePx = 1024 / laneCount;
      // Alternating subtle grass stripes
      tCtx.fillStyle = '#84cc16';
      for (let l = 0; l < laneCount; l += 2) {
        tCtx.fillRect(0, l * lanePx, 1024, lanePx);
      }
      // Crisp white lane dividers
      tCtx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      for (let l = 1; l < laneCount; l++) {
        tCtx.fillRect(0, l * lanePx - 3, 1024, 6);
      }
      // Glowing magic rune circle in the center of the arena (aspect-compensated so it stays round on the longer track)
      tCtx.save();
      tCtx.translate(512, 512);
      tCtx.scale(Math.min(1, trackWidth / (halfLen * 2)), 1);
      tCtx.strokeStyle = 'rgba(254, 240, 138, 0.65)';
      tCtx.lineWidth = 10;
      tCtx.beginPath();
      tCtx.arc(0, 0, 220, 0, Math.PI * 2);
      tCtx.stroke();
      tCtx.lineWidth = 5;
      tCtx.beginPath();
      tCtx.arc(0, 0, 174, 0, Math.PI * 2);
      tCtx.stroke();
      for (let r = 0; r < 8; r++) {
        const a = (r / 8) * Math.PI * 2;
        tCtx.beginPath();
        tCtx.moveTo(Math.cos(a) * 174, Math.sin(a) * 174);
        tCtx.lineTo(Math.cos(a) * 220, Math.sin(a) * 220);
        tCtx.stroke();
      }
      tCtx.restore();
    }
    const trackTex = new THREE.CanvasTexture(trackCanvas);
    trackTex.colorSpace = THREE.SRGBColorSpace;

    const trackMesh = new THREE.Mesh(
      trackGeo,
      new THREE.MeshStandardMaterial({ map: trackTex, roughness: 0.75, side: THREE.DoubleSide })
    );
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Stone curbs along the outer edges of the track
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.7 });
    [
      { offset: -trackWidth / 2, radius: 0.16, mat: curbMat },
      { offset: trackWidth / 2, radius: 0.16, mat: curbMat },
    ].forEach(({ offset, radius, mat }) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const pt = trackCurve.getPointAt(t);
        const tan = trackCurve.getTangentAt(t);
        const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        pts.push(pt.clone().addScaledVector(normal, offset).setY(0.2));
      }
      const lineCurve = new THREE.CatmullRomCurve3(pts);
      const lineTube = new THREE.Mesh(new THREE.TubeGeometry(lineCurve, 120, radius, 8, false), mat);
      scene.add(lineTube);
    });

    const startPt = trackCurve.getPointAt(0.01);
    const startTan = trackCurve.getTangentAt(0.01);
    const startAngle = Math.atan2(-startTan.z, startTan.x);
    const startLine = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, trackWidth - 0.2), lineMat);
    startLine.position.set(startPt.x, 0.19, startPt.z);
    startLine.rotation.y = startAngle;
    scene.add(startLine);

    const endPt = trackCurve.getPointAt(0.98);
    const endTan = trackCurve.getTangentAt(0.98);
    const endAngle = Math.atan2(-endTan.z, endTan.x);
    const finishGroup = new THREE.Group();
    finishGroup.position.set(endPt.x, 0, endPt.z);
    finishGroup.rotation.y = endAngle;

    const sqSize = 0.6;
    const rows = Math.floor((trackWidth - 0.4) / sqSize);
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x18181B });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 3; c++) {
        const sq = new THREE.Mesh(
          new THREE.BoxGeometry(sqSize, 0.06, sqSize),
          (r + c) % 2 === 0 ? blackMat : whiteMat
        );
        sq.position.set(-0.6 + c * sqSize, 0.2, -(rows * sqSize) / 2 + r * sqSize + sqSize / 2);
        finishGroup.add(sq);
      }
    }
    scene.add(finishGroup);

    const { decorGroup, balloons, floatingIslands, oceanMesh, foamRings, palmCrowns } =
      buildFantasyArenaDecor(halfLen, trackWidth, endPt, endTan, {
        islandCenterX,
        islandW,
        islandD,
        specRows,
        oceanSegments: qCfg.oceanSegments,
      });
    scene.add(decorGroup);

    // Zebra crossing (ทางม้าลาย) at center of S-curve (t = 0.5)
    const crosswalkPt = trackCurve.getPointAt(0.5);
    const crosswalkTan = trackCurve.getTangentAt(0.5);
    const crosswalkNorm = new THREE.Vector3(-crosswalkTan.z, 0, crosswalkTan.x).normalize();
    const crosswalkAngle = Math.atan2(-crosswalkTan.z, crosswalkTan.x);
    const crosswalkGroup = new THREE.Group();
    crosswalkGroup.position.set(crosswalkPt.x, 0.2, crosswalkPt.z);
    crosswalkGroup.rotation.y = crosswalkAngle;
    const stripeCount = Math.floor((trackWidth - 0.6) / 0.85);
    for (let s = 0; s < stripeCount; s++) {
      const zOff = (s - (stripeCount - 1) / 2) * 0.85;
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.45), whiteMat);
      stripe.position.set(0, 0, zOff);
      crosswalkGroup.add(stripe);
    }
    [-trackWidth / 2 - 0.35, trackWidth / 2 + 0.35].forEach((zSign) => {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8),
        new THREE.MeshStandardMaterial({ color: 0x18181B })
      );
      post.position.set(0, 0.9, zSign);
      const signBoard = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.5, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xFFE600 })
      );
      signBoard.position.set(0, 1.8, zSign);
      crosswalkGroup.add(post, signBoard);
    });
    scene.add(crosswalkGroup);

    // Track samples for spectator trespassing detection (เฉพาะช่วงลู่วิ่งระหว่างจุดเริ่มต้นถึงเส้นชัยเท่านั้น)
    const trackSamples = trackCurve.getSpacedPoints(80);
    const getNearestTrackInfo = (pos: THREE.Vector3) => {
      let minDist = Infinity;
      let nearestIdx = 0;
      for (let i = 0; i < trackSamples.length; i++) {
        const dx = pos.x - trackSamples[i].x;
        const dz = pos.z - trackSamples[i].z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDist) {
          minDist = dSq;
          nearestIdx = i;
        }
      }
      const dist = Math.sqrt(minDist);
      const t = nearestIdx / (trackSamples.length - 1);
      // ก่อนจุดสตาร์ท (ซุ้มอาหาร/หลังเส้นเริ่ม) และหลังเส้นชัย ให้เดินเล่นได้อิสระ พี่ยามไม่ไล่!
      const afterStartLine = (pos.x - startPt.x) * startTan.x + (pos.z - startPt.z) * startTan.z > 0.2;
      const beforeFinishLine = (pos.x - endPt.x) * endTan.x + (pos.z - endPt.z) * endTan.z < -0.6;
      const onTrack = afterStartLine && beforeFinishLine && dist < trackWidth / 2 - 0.15;
      const dxC = pos.x - crosswalkPt.x;
      const dzC = pos.z - crosswalkPt.z;
      const alongCrosswalk = Math.abs(dxC * crosswalkTan.x + dzC * crosswalkTan.z);
      const onCrosswalk = alongCrosswalk < 1.85;
      return { onTrack, onCrosswalk, t, pt: trackSamples[nearestIdx] };
    };

    // 3D Real-Person Full-Body Arena Guard (พี่ยามคุมลู่สายกิน) patrolling near the crosswalk
    const guardPostPos = crosswalkPt.clone().addScaledVector(crosswalkNorm, -(trackWidth / 2 + 2.2));
    guardPostPos.y = 0.2;
    const guardParts = buildCustomGuardCharacter('/images/guard_face_tex.jpg');
    guardParts.rootGroup.position.copy(guardPostPos);
    guardParts.rootGroup.rotation.y = Math.atan2(-crosswalkNorm.z, crosswalkNorm.x);
    scene.add(guardParts.rootGroup);
    const guardPrankRig = createGuardPrankFxRig(scene);

    const guardTagEl = document.createElement('div');
    guardTagEl.className = 'player-tag cursor-pointer';
    guardTagEl.onclick = () => {
      const gp = guardParts.rootGroup.position;
      cameraLookAtRef.current.set(gp.x, 1.95, gp.z);
      cameraTargetPosRef.current = new THREE.Vector3(gp.x + 1.2, 3.4, gp.z + 5.2);
    };
    guardTagEl.innerHTML = `
      <div data-guard-badge class="bg-[#18181B] text-[#FFE600] border-2 border-[#FFE600] rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10px] font-extrabold whitespace-nowrap hover:scale-105 transition">
        🍴 พี่ยามคุมลู่สายกิน (ข้ามเฉพาะทางม้าลาย!)
      </div>
    `;
    labelsContainer.appendChild(guardTagEl);
    const guardBadgeEl = guardTagEl.querySelector('[data-guard-badge]') as HTMLElement | null;
    let currentGuardBadgeKey = 'idle';
    let lastGuardWarnAt = 0;

    // 3D Pet Café Building (โซนอาหาร ใกล้จุดเริ่มต้น — เดินเข้าไปใกล้แล้วกดเข้าคาเฟ่เล่นกับน้องๆ ได้!)
    const rawCafeX = -halfLen - 8.5;
    const rawCafeZ = trackWidth / 2 + 5.2;
    const cafePos = new THREE.Vector3(
      Math.max(islandCenterX - islandW / 2 + 4.2, Math.min(islandCenterX + islandW / 2 - 4.2, rawCafeX)),
      0.2,
      Math.max(-(islandD / 2 - 4.2), Math.min(islandD / 2 - 4.2, rawCafeZ))
    );
    const petCafeGroup = new THREE.Group();
    petCafeGroup.position.copy(cafePos);
    petCafeGroup.rotation.y = Math.PI * 0.85; // หันหน้าร้านเข้าหาลานอาหารและจุดเริ่มต้น

    // Wooden Deck
    const cafeDeck = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.22, 4.6),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 })
    );
    cafeDeck.position.y = 0.11;
    cafeDeck.receiveShadow = true;
    petCafeGroup.add(cafeDeck);

    // Warm Cream Café Walls
    const cafeBody = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 2.7, 3.3),
      new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.7 })
    );
    cafeBody.position.set(0, 1.55, -0.35);
    cafeBody.castShadow = true;
    cafeBody.receiveShadow = true;
    petCafeGroup.add(cafeBody);

    // Pitched Cozy Brown Roof
    const cafeRoof = new THREE.Mesh(
      new THREE.ConeGeometry(3.45, 1.65, 4),
      new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.65 })
    );
    cafeRoof.rotation.y = Math.PI / 4;
    cafeRoof.position.set(0, 3.65, -0.35);
    cafeRoof.castShadow = true;
    petCafeGroup.add(cafeRoof);

    // Cute Pink-and-White Striped Awning over front entrance
    for (let i = 0; i < 6; i++) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(0.68, 0.12, 1.05),
        new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xf472b6 : 0xffffff,
          roughness: 0.5,
        })
      );
      stripe.position.set(-1.7 + i * 0.68, 2.32, 1.65);
      stripe.rotation.x = 0.28;
      petCafeGroup.add(stripe);
    }

    // Warm Glowing Café Door & Window
    const cafeDoor = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 1.85, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 })
    );
    cafeDoor.position.set(-0.9, 1.12, 1.32);
    const cafeWindow = new THREE.Mesh(
      new THREE.BoxGeometry(1.55, 1.15, 0.12),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.55,
        roughness: 0.2,
      })
    );
    cafeWindow.position.set(0.85, 1.45, 1.32);
    petCafeGroup.add(cafeDoor, cafeWindow);

    // Giant Glowing Paw Emblem on Roof
    const pawSign = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 0.16, 16),
      new THREE.MeshStandardMaterial({
        color: 0xfbcfe8,
        emissive: 0xf472b6,
        emissiveIntensity: 0.35,
      })
    );
    pawSign.rotation.x = Math.PI / 2;
    pawSign.position.set(0, 3.25, 1.2);
    petCafeGroup.add(pawSign);

    scene.add(petCafeGroup);

    const cafeTagEl = document.createElement('div');
    cafeTagEl.className = 'player-tag cursor-pointer';
    cafeTagEl.onclick = () => {
      cameraLookAtRef.current.set(cafePos.x, 1.9, cafePos.z);
      cameraTargetPosRef.current = new THREE.Vector3(cafePos.x + 2.2, 4.5, cafePos.z + 6.8);
      if (isNearCafeRef.current) {
        setIsPetCafeOpen(true);
      }
    };
    cafeTagEl.innerHTML = `
      <div class="bg-gradient-to-r from-pink-500 via-amber-400 to-rose-500 text-slate-950 border-2 border-white rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
        ☕🐾 Pet Café (เดินเข้ามาเล่นกับน้อง!)
      </div>
    `;
    labelsContainer.appendChild(cafeTagEl);

    // 3D Taekwondo Dojang Pavilion (สนามหลังจุดเริ่มต้น ฝั่งตรงข้าม Pet Café — เดินเข้ามาฝึกเตะเป้าเลื่อนสาย!)
    const rawDojangX = -halfLen - 8.5;
    const rawDojangZ = -(trackWidth / 2 + 5.2);
    const dojangPos = new THREE.Vector3(
      Math.max(islandCenterX - islandW / 2 + 4.2, Math.min(islandCenterX + islandW / 2 - 4.2, rawDojangX)),
      0.2,
      Math.max(-(islandD / 2 - 4.2), Math.min(islandD / 2 - 4.2, rawDojangZ))
    );
    const dojangGroup = new THREE.Group();
    dojangGroup.position.copy(dojangPos);
    dojangGroup.rotation.y = Math.PI * 0.15; // หันหน้าสำนักเข้าหาลานด้านหลังจุดเริ่มต้น

    // Wooden Raised Stage
    const dojangDeck = new THREE.Mesh(
      new THREE.BoxGeometry(5.6, 0.24, 5.0),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
    );
    dojangDeck.position.y = 0.12;
    dojangDeck.receiveShadow = true;
    dojangGroup.add(dojangDeck);

    // Classic Blue & Red Taekwondo Competition Mat
    const matBlue = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 0.08, 4.0),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7 })
    );
    matBlue.position.set(0, 0.28, 0);
    matBlue.receiveShadow = true;
    const matRed = new THREE.Mesh(
      new THREE.BoxGeometry(2.8, 0.09, 2.4),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 })
    );
    matRed.position.set(0, 0.285, 0);
    dojangGroup.add(matBlue, matRed);

    // Traditional White Back Wall & 4 Red Wooden Pillars
    const dojangBackWall = new THREE.Mesh(
      new THREE.BoxGeometry(4.6, 2.6, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 })
    );
    dojangBackWall.position.set(0, 1.54, -1.9);
    dojangBackWall.castShadow = true;
    dojangBackWall.receiveShadow = true;
    dojangGroup.add(dojangBackWall);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 });
    const pillarCoords: [number, number][] = [
      [-2.25, -1.85],
      [2.25, -1.85],
      [-2.25, 1.85],
      [2.25, 1.85],
    ];
    for (const [px, pz] of pillarCoords) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.7, 10), pillarMat);
      pillar.position.set(px, 1.58, pz);
      pillar.castShadow = true;
      dojangGroup.add(pillar);
    }

    // Traditional Dark-Slate Korean Dojang Roof + Gold Trim
    const dojangRoofBase = new THREE.Mesh(
      new THREE.BoxGeometry(6.1, 0.26, 5.4),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 })
    );
    dojangRoofBase.position.set(0, 2.98, 0);
    dojangRoofBase.castShadow = true;
    const dojangRoofTop = new THREE.Mesh(
      new THREE.ConeGeometry(4.15, 1.45, 4),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55 })
    );
    dojangRoofTop.rotation.y = Math.PI / 4;
    dojangRoofTop.position.set(0, 3.82, 0);
    dojangRoofTop.castShadow = true;
    const dojangTrim = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.1, 0.16),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xd97706, emissiveIntensity: 0.35 })
    );
    dojangTrim.position.set(0, 2.94, 2.72);
    dojangGroup.add(dojangRoofBase, dojangRoofTop, dojangTrim);

    // Taegeuk Crest Emblem on Front Roof
    const crestRed = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.14, 18),
      new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.35 })
    );
    crestRed.rotation.x = Math.PI / 2;
    crestRed.position.set(0, 3.45, 1.95);
    const crestBlue = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.17, 16),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, emissive: 0x1d4ed8, emissiveIntensity: 0.35 })
    );
    crestBlue.rotation.x = Math.PI / 2;
    crestBlue.position.set(0, 3.45, 1.97);
    dojangGroup.add(crestRed, crestBlue);

    // Standing Kicking Target Pad on Front-Right Corner
    const padStand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.42, 0.32, 12),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
    );
    padStand.position.set(1.35, 0.44, 0.95);
    const padBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 1.35, 12),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })
    );
    padBody.position.set(1.35, 1.28, 0.95);
    padBody.castShadow = true;
    const padStripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.255, 0.255, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xf59e0b, emissiveIntensity: 0.4 })
    );
    padStripe.position.set(1.35, 1.38, 0.95);
    dojangGroup.add(padStand, padBody, padStripe);

    scene.add(dojangGroup);

    const dojangTagEl = document.createElement('div');
    dojangTagEl.className = 'player-tag cursor-pointer';
    dojangTagEl.onclick = () => {
      cameraLookAtRef.current.set(dojangPos.x, 1.9, dojangPos.z);
      cameraTargetPosRef.current = new THREE.Vector3(dojangPos.x + 2.4, 4.6, dojangPos.z + 6.8);
      if (isNearDojangRef.current) {
        setIsTaekwondoOpen(true);
      }
    };
    dojangTagEl.innerHTML = `
      <div class="bg-gradient-to-r from-red-600 via-amber-400 to-blue-600 text-white border-2 border-white rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
        🥋 สำนักเทควันโด (เดินเข้ามาเตะเป้าเลื่อนสาย!)
      </div>
    `;
    labelsContainer.appendChild(dojangTagEl);

    // 3D Ragnarok Mobile Style Wooden Quest Board (วางไว้ใกล้พี่ยามแบบมีระยะห่างกำลังดี — กดเปิดกระดานเควสได้ทันที!)
    const rawBoardPos = guardPostPos
      .clone()
      .addScaledVector(crosswalkTan, 6.2)
      .addScaledVector(crosswalkNorm, -1.2);
    const questBoardPos = new THREE.Vector3(
      Math.max(islandCenterX - islandW / 2 + 3.8, Math.min(islandCenterX + islandW / 2 - 3.8, rawBoardPos.x)),
      0.2,
      Math.max(-(islandD / 2 - 3.8), Math.min(islandD / 2 - 3.8, rawBoardPos.z))
    );
    const questBoardGroup = new THREE.Group();
    questBoardGroup.position.copy(questBoardPos);
    questBoardGroup.rotation.y = -0.18;

    const roWoodDarkMat = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.82 });
    const roWoodMidMat = new THREE.MeshStandardMaterial({ color: 0x7c4821, roughness: 0.78 });
    const roWoodRoofMat = new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.72 });
    const roCorkMat = new THREE.MeshStandardMaterial({ color: 0x4a2912, roughness: 0.92 });

    // Stone base plinth
    const boardPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 0.16, 1.3),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 })
    );
    boardPlinth.position.y = 0.08;
    boardPlinth.receiveShadow = true;
    questBoardGroup.add(boardPlinth);

    // Curved/angled sturdy wooden side posts (RO Mobile silhouette)
    [-1.32, 1.32].forEach((px) => {
      const lowerPost = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.35, 8), roWoodDarkMat);
      lowerPost.position.set(px, 0.72, 0.1);
      lowerPost.rotation.x = -0.14;
      lowerPost.castShadow = true;
      const upperPost = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 1.45, 8), roWoodDarkMat);
      upperPost.position.set(px, 1.98, 0.02);
      upperPost.rotation.x = 0.1;
      upperPost.castShadow = true;
      questBoardGroup.add(lowerPost, upperPost);
    });

    // Main wooden bulletin frame & recessed corkboard
    const boardFrame = new THREE.Mesh(new THREE.BoxGeometry(2.68, 1.72, 0.22), roWoodMidMat);
    boardFrame.position.set(0, 1.78, 0);
    boardFrame.castShadow = true;
    boardFrame.receiveShadow = true;
    const boardBack = new THREE.Mesh(new THREE.BoxGeometry(2.34, 1.42, 0.25), roCorkMat);
    boardBack.position.set(0, 1.78, 0.01);
    questBoardGroup.add(boardFrame, boardBack);

    // Sloped shingled wooden roof + carved crest on top
    const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.16, 1.15), roWoodRoofMat);
    roofLeft.position.set(-0.76, 2.86, 0.06);
    roofLeft.rotation.z = 0.28;
    roofLeft.castShadow = true;
    const roofRight = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.16, 1.15), roWoodRoofMat);
    roofRight.position.set(0.76, 2.86, 0.06);
    roofRight.rotation.z = -0.28;
    roofRight.castShadow = true;
    const roofCrest = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.42, 0.26), roWoodMidMat);
    roofCrest.position.set(0, 3.22, 0.06);
    roofCrest.castShadow = true;
    questBoardGroup.add(roofLeft, roofRight, roofCrest);

    // Pinned parchment quest notices (cream, gold, mint green) with red/gold pushpins
    const pinnedNotices = [
      { x: -0.78, y: 2.02, w: 0.48, h: 0.6, rot: 0.08, color: 0xf7e7c4, pin: 0xef4444 },
      { x: -0.22, y: 2.06, w: 0.44, h: 0.56, rot: -0.06, color: 0x6ee7b7, pin: 0xfacc15 },
      { x: 0.34, y: 1.98, w: 0.5, h: 0.62, rot: 0.05, color: 0xfef08a, pin: 0xef4444 },
      { x: 0.84, y: 1.88, w: 0.46, h: 0.55, rot: -0.1, color: 0xf3dfb6, pin: 0xf97316 },
      { x: -0.52, y: 1.42, w: 0.52, h: 0.46, rot: -0.05, color: 0xfde68a, pin: 0xef4444 },
      { x: 0.16, y: 1.38, w: 0.5, h: 0.44, rot: 0.09, color: 0xf7e7c4, pin: 0xef4444 },
    ];
    pinnedNotices.forEach((n) => {
      const paper = new THREE.Mesh(
        new THREE.BoxGeometry(n.w, n.h, 0.03),
        new THREE.MeshStandardMaterial({ color: n.color, roughness: 0.7 })
      );
      paper.position.set(n.x, n.y, 0.155);
      paper.rotation.z = n.rot;
      const pin = new THREE.Mesh(
        new THREE.SphereGeometry(0.045, 8, 8),
        new THREE.MeshStandardMaterial({ color: n.pin, roughness: 0.35 })
      );
      pin.position.set(n.x, n.y + n.h * 0.38, 0.185);
      questBoardGroup.add(paper, pin);
    });

    questBoardGroup.traverse((obj) => {
      obj.userData.isQuestBoard = true;
    });
    scene.add(questBoardGroup);

    const questBoardTagEl = document.createElement('div');
    questBoardTagEl.className = 'player-tag pointer-events-none';
    questBoardTagEl.innerHTML = `
      <div class="bg-gradient-to-r from-[#ffdf6b] via-[#f5a623] to-[#d97706] text-[#3d1b06] border-2 border-[#fff7d6] rounded-xl px-2.5 py-0.5 shadow-[0_3px_0_#5c2d0c,0_4px_10px_rgba(0,0,0,0.5)] text-[10.5px] font-black whitespace-nowrap">
        📜 กระดานเควส • Mission Board
      </div>
    `;
    labelsContainer.appendChild(questBoardTagEl);

    // 3D Fishing Rig (คันเบ็ด + สายเบ็ด + ทุ่นลอยน้ำ + วงคลื่น + เสาแสงตามระดับความแรร์!)
    const fishingRigGroup = new THREE.Group();
    fishingRigGroup.visible = false;

    const rodPivot = new THREE.Group();
    const rodShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.055, 2.9, 8),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.65 })
    );
    rodShaft.rotation.z = -Math.PI / 3.2;
    rodShaft.position.set(1.15, 0.85, 0);
    rodPivot.add(rodShaft);
    const rodGrip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.065, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
    );
    rodGrip.rotation.z = -Math.PI / 3.2;
    rodGrip.position.set(0.12, 0.14, 0);
    rodPivot.add(rodGrip);
    fishingRigGroup.add(rodPivot);

    const fishingLineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -1, 0),
    ]);
    const fishingLineMat = new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.85 });
    const fishingLineMesh = new THREE.Line(fishingLineGeo, fishingLineMat);
    fishingRigGroup.add(fishingLineMesh);

    const bobberGroup = new THREE.Group();
    const bobberTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
    );
    const bobberBottom = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
    );
    bobberGroup.add(bobberTop, bobberBottom);
    fishingRigGroup.add(bobberGroup);

    const splashRingMat = new THREE.MeshBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    });
    const splashRingMesh = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.42, 24), splashRingMat);
    splashRingMesh.rotation.x = -Math.PI / 2;
    splashRingMesh.visible = false;
    fishingRigGroup.add(splashRingMesh);

    // Lazy 3D Fishing Rigs for Remote Players so everyone sees friends fishing in real time!
    interface RemoteFishingRig {
      group: THREE.Group;
      rodPivot: THREE.Group;
      bobberGroup: THREE.Group;
      lineGeo: THREE.BufferGeometry;
      splashRing: THREE.Mesh;
      splashMat: THREE.MeshBasicMaterial;
      biteSprite: THREE.Sprite;
    }
    const remoteFishingRigs = new Map<number, RemoteFishingRig>();
    const getOrCreateRemoteFishingRig = (uid: number): RemoteFishingRig => {
      const existing = remoteFishingRigs.get(uid);
      if (existing) return existing;
      const group = new THREE.Group();
      const rPivot = new THREE.Group();
      const rShaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.055, 2.9, 8),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.65 })
      );
      rShaft.rotation.z = -Math.PI / 3.2;
      rShaft.position.set(1.15, 0.85, 0);
      const rGrip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.065, 0.065, 0.45, 8),
        new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
      );
      rGrip.rotation.z = -Math.PI / 3.2;
      rGrip.position.set(0.12, 0.14, 0);
      rPivot.add(rShaft, rGrip);
      group.add(rPivot);

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, -1, 0),
      ]);
      const lineMesh = new THREE.Line(
        lineGeo,
        new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.85 })
      );
      group.add(lineMesh);

      const bGroup = new THREE.Group();
      const bTop = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 })
      );
      const bBot = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })
      );
      bGroup.add(bTop, bBot);
      group.add(bGroup);

      const sMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      });
      const sRing = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.42, 20), sMat);
      sRing.rotation.x = -Math.PI / 2;
      sRing.visible = false;
      group.add(sRing);

      const bSprite = new THREE.Sprite(biteAlertSprite.material);
      bSprite.scale.set(1.1, 1.1, 1);
      bSprite.visible = false;
      group.add(bSprite);

      group.visible = false;
      scene.add(group);
      const rig: RemoteFishingRig = {
        group,
        rodPivot: rPivot,
        bobberGroup: bGroup,
        lineGeo,
        splashRing: sRing,
        splashMat: sMat,
        biteSprite: bSprite,
      };
      remoteFishingRigs.set(uid, rig);
      return rig;
    };

    // Harvest Moon BTN Iconic "!" Exclamation Mark Sprite above character head
    const biteAlertCanvas = document.createElement('canvas');
    biteAlertCanvas.width = 128;
    biteAlertCanvas.height = 128;
    const baCtx = biteAlertCanvas.getContext('2d');
    if (baCtx) {
      baCtx.fillStyle = '#ffffff';
      baCtx.beginPath();
      baCtx.arc(64, 64, 54, 0, Math.PI * 2);
      baCtx.fill();
      baCtx.lineWidth = 8;
      baCtx.strokeStyle = '#dc2626';
      baCtx.stroke();
      baCtx.fillStyle = '#dc2626';
      baCtx.font = '900 84px sans-serif';
      baCtx.textAlign = 'center';
      baCtx.textBaseline = 'middle';
      baCtx.fillText('!', 64, 68);
    }
    const biteAlertTex = new THREE.CanvasTexture(biteAlertCanvas);
    const biteAlertSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: biteAlertTex, transparent: true, depthTest: false })
    );
    biteAlertSprite.scale.set(1.15, 1.15, 1);
    biteAlertSprite.visible = false;
    fishingRigGroup.add(biteAlertSprite);

    // 3D Catch Celebration FX (วงคลื่น + เสาแสง Rare/Legendary แยกจากคันเบ็ดเพื่อให้โชว์ต่อหลังดึงเบ็ดได้)
    const fishingFxGroup = new THREE.Group();
    fishingFxGroup.visible = false;
    const catchBeamMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const catchBeamMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.05, 16, 20, 1, true), catchBeamMat);
    catchBeamMesh.position.y = 8;
    fishingFxGroup.add(catchBeamMesh);

    const catchRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const catchRingMesh = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.82, 28), catchRingMat);
    catchRingMesh.rotation.x = -Math.PI / 2;
    catchRingMesh.position.y = 0.08;
    fishingFxGroup.add(catchRingMesh);

    const catchRing2Mat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const catchRing2Mesh = new THREE.Mesh(new THREE.RingGeometry(0.65, 1.05, 28), catchRing2Mat);
    catchRing2Mesh.rotation.x = -Math.PI / 2;
    catchRing2Mesh.position.y = 0.14;
    fishingFxGroup.add(catchRing2Mesh);

    // พี่ยาม 3D พุ่งขึ้นมาจากทะเลตอนแอบตกปลาเกินโควต้า!
    const seaGuardPopParts = buildCustomGuardCharacter('/images/guard_face_tex.jpg');
    seaGuardPopParts.rootGroup.visible = false;
    fishingFxGroup.add(seaGuardPopParts.rootGroup);

    scene.add(fishingRigGroup);
    scene.add(fishingFxGroup);
    let lastFoodVolleyAt = 0;
    const remoteEjectSentAt: Record<number, number> = {};

    // 3D Flying Food Projectiles Pool (หมูกรอบ / น่องไก่ทอด / ลูกชิ้นปิ้ง ที่พี่ยามปาไล่เมื่อคนบุกสนามหลายคน!)
    interface GuardFoodProjectile {
      mesh: THREE.Group;
      active: boolean;
      startPos: THREE.Vector3;
      targetUserId: number;
      launchedAt: number;
      durationMs: number;
    }
    const guardProjectiles: GuardFoodProjectile[] = [];
    const porkMeatMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 });
    const porkFatMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.45 });
    const porkCrustMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
    const boneWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 });

    for (let pi = 0; pi < 10; pi++) {
      const pGroup = new THREE.Group();
      if (pi % 3 === 0) {
        // หมูกรอบ 3 ชั้นชิ้นยักษ์
        const meat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.24), porkMeatMat);
        const fat = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.24), porkFatMat);
        fat.position.y = 0.11;
        const crust = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.26), porkCrustMat);
        crust.position.y = 0.18;
        pGroup.add(meat, fat, crust);
      } else if (pi % 3 === 1) {
        // น่องไก่ทอดสีทอง
        const drum = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), porkCrustMat);
        drum.scale.set(1.35, 0.95, 0.95);
        const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8), boneWhiteMat);
        bone.rotation.z = Math.PI / 2;
        bone.position.x = -0.24;
        pGroup.add(drum, bone);
      } else {
        // ลูกชิ้นปิ้งเสียบไม้
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.56, 6), porkFatMat);
        stick.rotation.z = Math.PI / 2;
        [-0.14, 0, 0.14].forEach((bx) => {
          const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), porkMeatMat);
          ball.position.x = bx;
          pGroup.add(ball);
        });
        pGroup.add(stick);
      }
      pGroup.scale.setScalar(1.45);
      pGroup.visible = false;
      scene.add(pGroup);
      guardProjectiles.push({
        mesh: pGroup,
        active: false,
        startPos: new THREE.Vector3(),
        targetUserId: -1,
        launchedAt: 0,
        durationMs: 420,
      });
    }

    const clouds: THREE.Group[] = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.9 });
    const cloudBoundX = halfLen + 26;
    for (let i = 0; i < 8; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.9 + Math.random() * 0.6, 12, 12), cloudMat);
        puff.position.set((j - 1) * 1.0, Math.random() * 0.3, 0);
        cloud.add(puff);
      }
      cloud.position.set(
        -cloudBoundX + (i / 7) * cloudBoundX * 2,
        12 + (i % 3) * 2.2,
        -(islandD / 2 + 6) - (i % 2) * 6
      );
      scene.add(cloud);
      clouds.push(cloud);
    }

    const crownMesh = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xFACC15,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0xCA8A04,
      emissiveIntensity: 0.25,
    });
    crownMesh.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.22, 16), goldMat));
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), goldMat);
      spike.position.set(Math.cos(angle) * 0.26, 0.22, Math.sin(angle) * 0.26);
      crownMesh.add(spike);
    }
    if (leaderIdRef.current === null) crownMesh.visible = false;
    scene.add(crownMesh);

    const flameParticles: { mesh: THREE.Mesh; offset: number; speed: number }[] = [];
    const fireGeo = new THREE.SphereGeometry(0.18, 8, 8);
    for (let i = 0; i < 14; i++) {
      const fireMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xFF4D8D : 0xFACC15,
        transparent: true,
        opacity: 0.85,
      });
      const pMesh = new THREE.Mesh(fireGeo, fireMat);
      if (loserIdRef.current === null) pMesh.visible = false;
      scene.add(pMesh);
      flameParticles.push({ mesh: pMesh, offset: Math.random() * Math.PI * 2, speed: 1.5 + Math.random() * 1.5 });
    }

    const meshes: any[] = [];
    const trackMarkers: Array<{
      id: number;
      parts: TrackMarkerParts;
      tagEl: HTMLElement;
      pos: THREE.Vector3;
    }> = [];
    const foodStallCompetitorList = rankedPlayers.filter((r) => r.isInFoodStall);
    const TOP7_LANE_ORDER = [3, 2, 4, 1, 5, 0, 6];
    let foodStallIdx = 0;
    let specIdx = 0;

    players.forEach((p, idx) => {
      const isLegacySpectator = p.role === 'spectator';
      const isRoamingCompetitor = Boolean(!isLegacySpectator && p.isRoaming);
      const isBeachWalker = isLegacySpectator || isRoamingCompetitor;
      const rankedInfo = !isLegacySpectator ? rankedPlayers.find((r) => r.id === p.id) : undefined;
      const rankIndex = !isLegacySpectator ? rankedPlayers.findIndex((r) => r.id === p.id) : -1;
      const isTop7 = !isLegacySpectator && rankIndex >= 0 && rankIndex < 7;
      const isMiniRank = !isLegacySpectator && !isTop7;
      const rankScale = isMiniRank ? (isBeachWalker ? 0.78 : 0.62) : 1.0;
      const isInFoodStall = Boolean(!isLegacySpectator && rankedInfo?.isInFoodStall);
      const style = STYLES[idx % STYLES.length];

      const indexInRoamers = isBeachWalker ? Math.max(0, roamingList.findIndex((pl) => pl.id === p.id)) : 0;
      const customPair = isBeachWalker ? pairedActivities[p.id] : undefined;
      const dailyAct = isBeachWalker
        ? customPair ||
        getDailySpectatorActivity(
          p.id,
          p.workoutType,
          Math.max(1, roamingList.length),
          indexInRoamers
        )
        : null;

      let slackerAct: ReturnType<typeof getFoodStallSlackerActivity> | null = null;
      let laneTargetPos = new THREE.Vector3(0, 0.2, 0);
      let laneFacingY = 0;
      let laneTrackT = 0.5;

      if (!isLegacySpectator) {
        if (isInFoodStall) {
          const slot = foodStallIdx++;
          slackerAct = getFoodStallSlackerActivity(p.id, slot);
          const perRow = Math.max(6, Math.floor((trackWidth + 4) / 2.6));
          const row = Math.floor(slot / perRow);
          const col = slot % perRow;
          const countInThisRow = Math.min(perRow, foodStallCompetitorList.length - row * perRow);
          const zSpan = trackWidth + 2.5;
          const zOff =
            countInThisRow > 1
              ? (col / (countInThisRow - 1) - 0.5) * zSpan
              : (slot % 2 === 0 ? -1 : 1) * 1.8;
          const xPos = -halfLen - 4.2 - row * 2.85;
          laneTargetPos.set(xPos, 0.2, zOff);
          laneFacingY = zOff > 0.5 ? 0.38 : zOff < -0.5 ? -0.38 : -0.18;
          laneTrackT = 0.04;
        } else {
          const laneSlot = isTop7
            ? TOP7_LANE_ORDER[rankIndex] ?? rankIndex % laneCount
            : (Math.max(0, rankIndex - 7) % laneCount);
          const tierInLane = isTop7 ? 0 : Math.floor(Math.max(0, rankIndex - 7) / laneCount) + 1;
          const baseT = Math.max(
            0.03,
            Math.min(0.95, 0.04 + (rankedInfo?.progressRatio ?? 0) * 0.9)
          );
          const staggerBack = tierInLane > 0 ? Math.min(0.032, tierInLane * 0.011) : 0;
          const t = Math.max(0.02, Math.min(0.96, baseT - staggerBack));
          laneTrackT = t;
          const pt = trackCurve.getPointAt(t);
          const tan = trackCurve.getTangentAt(t);
          const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
          const laneCenterRatio = (laneSlot + 0.5) / laneCount - 0.5;
          const miniSideJitter = tierInLane > 0 ? ((tierInLane % 2 === 0 ? 1 : -1) * 0.42) : 0;
          const laneSpread = laneCenterRatio * (trackWidth - 0.8) + miniSideJitter;
          laneTargetPos = pt.clone().addScaledVector(normal, laneSpread);
          laneTargetPos.y = 0.2;
          laneFacingY = Math.atan2(-tan.z, tan.x);
        }
      }

      const escapeHtml = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      // หากผู้เข้าแข่งขันกด "ปักป้ายเดินเล่น" ให้วางป้าย 3D ประจำตัวไว้ตรงตำแหน่งลู่แข่งของตัวเอง!
      if (isRoamingCompetitor) {
        const markerParts = buildTrackMarkerMesh(
          p.equipMarker || 'marker_wood',
          p.bandColor || p.colorHex || '#FFE600'
        );
        markerParts.group.position.copy(laneTargetPos);
        markerParts.group.rotation.y = laneFacingY - Math.PI * 0.38;
        markerParts.group.userData.markerOwnerId = p.id;
        markerParts.group.traverse((ch) => {
          ch.userData.markerOwnerId = p.id;
        });
        scene.add(markerParts.group);

        const rankLabel =
          rankIndex === 0
            ? '👑 #1'
            : rankIndex === rankedPlayers.length - 1 && rankedPlayers.length > 1
              ? '💀 รั้งท้าย'
              : `#${rankIndex + 1}`;
        const pctVal = rankedInfo?.progressPct ?? 0;
        const pctColorClass = pctVal < 0 ? 'text-rose-300' : 'text-emerald-300';

        const markerTagEl = document.createElement('div');
        markerTagEl.className = 'player-tag cursor-pointer flex flex-col items-center';
        markerTagEl.onclick = () => {
          openEditModal(p);
        };
        markerTagEl.innerHTML = `
          <div class="rpg-panel-wood rounded-xl px-2.5 py-1 text-center whitespace-nowrap border-2 border-amber-400/90 hover:scale-105 transition">
            <div class="flex items-center justify-center gap-1 font-[family-name:var(--font-kanit)] font-extrabold text-[11px] text-amber-200">
              <span>🚩 ${rankLabel}</span>
              <span>${p.emoji} ${escapeHtml(p.name)}</span>
              <span class="${pctColorClass}">(${pctVal}%)</span>
            </div>
            <div class="text-[9.5px] font-bold text-cyan-200">
              🏖️ ปักป้ายจองที่ • เดินเล่นริมหาด
            </div>
          </div>
          <div class="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[5px] border-t-amber-400 mx-auto"></div>
        `;
        labelsContainer.appendChild(markerTagEl);
        trackMarkers.push({
          id: p.id,
          parts: markerParts,
          tagEl: markerTagEl,
          pos: laneTargetPos.clone(),
        });
      }

      let targetPos = laneTargetPos.clone();
      let facingY = laneFacingY;

      if (isBeachWalker) {
        const currentSpec = specIdx++;
        const side = currentSpec % 2 === 0 ? 1 : -1;
        const sideIdx = Math.floor(currentSpec / 2);
        const maxPerRow = 14;
        const row = Math.floor(sideIdx / maxPerRow);
        const idxInRow = sideIdx % maxPerRow;
        const rowTotal = Math.min(maxPerRow, Math.max(1, specPerSide - row * maxPerRow));
        const staggerT = (row % 2) * 0.025;
        const defaultT = isRoamingCompetitor
          ? Math.max(0.06, Math.min(0.94, laneTrackT))
          : Math.min(
            0.95,
            0.05 + staggerT + (rowTotal > 1 ? idxInRow / (rowTotal - 1) : 0.5) * 0.88
          );
        const pt = trackCurve.getPointAt(defaultT);
        const tan = trackCurve.getTangentAt(defaultT);
        const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const dist = trackWidth / 2 + 3.0 + row * 3.4;
        targetPos = pt.clone().addScaledVector(normal, side * dist);
        targetPos.y = 0.2;
        const inward = normal.clone().multiplyScalar(-side);
        facingY = Math.atan2(-inward.z, inward.x);
      }

      const activePropType = dailyAct
        ? dailyAct.animType
        : slackerAct
          ? slackerAct.animType
          : '';
      const initialBellyScale = rankedInfo?.bellyScale ?? p.bmiBellyScale ?? 1;
      const initialMuscleScale = rankedInfo?.muscleScale ?? 1;
      const powerMeta = !isLegacySpectator
        ? resolvePowerBoostMeta(p.cheerCount ?? 0, p.temptCount ?? 0)
        : null;
      const charParts = buildCharacterMesh({
        colorHex: p.colorHex || style.bodyColor,
        accessory: 'none',
        bandColor: p.bandColor || style.bandColor,
        bellyScale: initialBellyScale,
        muscleScale: initialMuscleScale,
        showDumbbells: !isBeachWalker && !isInFoodStall && p.goalType === 'muscle_gain',
        spectatorProp: activePropType,
        species: p.breed || p.species || 'bunny',
        equipHat: p.equipHat || 'none',
        equipFace: p.equipFace || 'face_none',
        equipArmor: p.equipArmor || 'armor_none',
        equipWeapon: p.equipWeapon || 'weapon_none',
        equipWings: p.equipWings || 'wings_none',
        equipAura: p.equipAura || 'aura_none',
        equipMount: p.equipMount || 'mount_none',
        propColors: p.propColors,
        animMode: isBeachWalker || isInFoodStall ? 'spectator' : 'run',
        animSeed: idx,
        netPower: powerMeta ? powerMeta.netPower : 0,
      });
      const { rootGroup, bounceGroup, bodyMesh, legL, legR, armL, armR, normalEyes, happyFace, angryFace } = charParts;
      const savedPos = isBeachWalker ? savedSpectatorPosRef.current[p.id] : undefined;
      if (savedPos) {
        targetPos.set(savedPos.x, savedPos.y, savedPos.z);
        facingY = savedPos.rotY;
      }
      rootGroup.position.copy(targetPos);
      rootGroup.rotation.y = facingY;
      if (rankScale !== 1.0) {
        rootGroup.scale.setScalar(rankScale);
      }
      rootGroup.userData.playerId = p.id;

      const petType =
        p.equipPetGear && p.equipPetGear !== 'pet_none'
          ? p.equipPetGear
          : !isLegacySpectator
            ? p.petType || 'none'
            : 'none';
      const petParts = buildPetMesh(petType, p.propColors?.pet);
      if (petParts) {
        rootGroup.add(petParts.petGroup);
        if (petParts.leashMesh) rootGroup.add(petParts.leashMesh);
      }

      if (!isBeachWalker && powerMeta) {
        if (powerMeta.netPower > 0) {
          const fireCount = Math.min(12, powerMeta.netPower);
          for (let fi = 0; fi < fireCount; fi++) {
            const fl = buildFireEmberPileMesh(fi);
            fl.scale.setScalar(1.3);
            const ring = Math.floor(fi / 4);
            const angle = (fi % 4) * 0.65 - 0.95;
            fl.position.set(
              -0.35 + Math.cos(angle) * (0.62 + ring * 0.36),
              0,
              -1.0 - Math.sin(angle) * 0.32 - ring * 0.28
            );
            rootGroup.add(fl);
          }
        } else if (powerMeta.netPower < 0) {
          const foodCount = Math.min(20, Math.abs(powerMeta.netPower));
          for (let di = 0; di < foodCount; di++) {
            const fd = buildFoodPileMesh(di);
            fd.scale.setScalar(1.45);
            const layer = Math.floor(di / 4);
            const slot = di % 4;
            fd.position.set(
              -0.35 + (slot - 1.5) * 0.36,
              layer * 0.2,
              1.1 + (slot % 2) * 0.34
            );
            rootGroup.add(fd);
          }
        }
      }

      scene.add(rootGroup);

      const tagEl = document.createElement('div');
      tagEl.className = 'player-tag cursor-pointer flex flex-col items-center';
      tagEl.onclick = () => {
        if (p.role !== 'spectator') {
          openEditModal(p);
        } else {
          focusOnCharacter(p.id);
        }
      };

      const trimmedStatus = (p.statusText || '').trim();
      const speechHtml = `<div data-busy-badge class="hidden mb-1 bg-slate-950/90 border border-cyan-300 text-cyan-200 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold shadow whitespace-nowrap"></div><div data-speech-bubble class="mb-1 bg-[#FFFDF7] border-2 border-amber-500 rounded-2xl px-3 py-1 shadow-[0_3px_0_#422006] text-xs font-extrabold text-black max-w-[200px] truncate ${trimmedStatus ? '' : 'hidden'}">💬 ${escapeHtml(trimmedStatus)}</div>`;

      if (isLegacySpectator) {
        const workoutLabel = dailyAct?.label || '📣 เชียร์สุดใจ';
        tagEl.innerHTML = `
          ${speechHtml}
          <div class="rpg-panel-wood rounded-xl px-2.5 py-1 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1 font-[family-name:var(--font-kanit)] font-extrabold text-xs text-amber-200">
              <span>👀</span>
              <span>${p.emoji} ${escapeHtml(p.name)}</span>
            </div>
            <div class="text-[10px] font-bold text-amber-100/85 max-w-[155px] truncate">
              ${workoutLabel}
            </div>
          </div>
          <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-amber-500 mx-auto"></div>
        `;
      } else {
        const rankLabel =
          rankIndex === 0 ? '👑 #1' : rankIndex === rankedPlayers.length - 1 && rankedPlayers.length > 1 ? '💀 รั้งท้าย' : `#${rankIndex + 1}`;
        const pctVal = rankedInfo?.progressPct ?? 0;
        const gMeta = getGoalTypeMeta(p.goalType);

        const powerPillHtml =
          powerMeta && powerMeta.netPower !== 0
            ? `<span class="px-1.5 py-0.2 rounded-full border text-[10px] font-extrabold ${powerMeta.badgeBgClass}">${escapeHtml(powerMeta.shortLabel)}</span>`
            : '';
        const pctColorClass = pctVal < 0 ? 'text-rose-300' : 'text-emerald-300';
        const workoutLabel = dailyAct?.label || '🏖️ เดินเล่นริมหาด';
        const slackerHtml = isRoamingCompetitor
          ? `<div class="mt-1 px-2 py-0.5 rounded-full bg-cyan-900/95 border border-cyan-300 text-[10px] font-extrabold text-cyan-100 shadow-sm">🚩 เดินเล่น • ${escapeHtml(workoutLabel)}</div>`
          : isInFoodStall && slackerAct
            ? `<div class="mt-1 px-2 py-0.5 rounded-full bg-rose-600/95 border border-amber-300 text-[10px] font-extrabold text-amber-100 shadow-sm">${escapeHtml(slackerAct.statusBadge)} • ${escapeHtml(slackerAct.label)}</div>`
            : '';

        const isCompactMiniTag = isMiniRank && !isRoamingCompetitor && !isInFoodStall;
        if (isRoamingCompetitor) {
          // ป้ายชื่อแบบแคปซูลกะทัดรัด 1 แถวสำหรับคนเดินเล่นนอกลู่ (ไม่บังตัวละครและไม่ทับเพื่อน!)
          const isMe = p.id === currentUserId;
          const actBadge = dailyAct?.label
            ? `<span class="text-[9.5px] text-cyan-200/95 font-bold truncate max-w-[90px]">• ${escapeHtml(dailyAct.label)}</span>`
            : '';
          tagEl.innerHTML = `
            ${speechHtml}
            <div class="rounded-full px-2.5 py-0.5 text-center whitespace-nowrap border shadow-md backdrop-blur-xs transition ${isMe
              ? 'bg-amber-950/92 border-amber-300 ring-2 ring-amber-300/65'
              : 'bg-slate-950/82 border-cyan-400/75 hover:border-amber-300'
            }">
              <div class="flex items-center justify-center gap-1 font-[family-name:var(--font-kanit)] font-extrabold text-[11px] text-amber-100">
                <span>${p.emoji} ${escapeHtml(p.name)}</span>
                ${actBadge}
              </div>
            </div>
          `;
        } else if (isCompactMiniTag) {
          const isMe = p.id === currentUserId;
          tagEl.innerHTML = `
            ${speechHtml}
            <div class="rounded-full px-2 py-0.5 text-center whitespace-nowrap border shadow-md transition ${isMe
              ? 'bg-amber-950/95 border-amber-300 ring-2 ring-amber-300/70'
              : 'bg-slate-950/82 border-slate-500/80 hover:border-amber-300'
            }">
              <div class="flex items-center justify-center gap-1 font-[family-name:var(--font-kanit)] font-extrabold text-[10px] text-amber-100">
                <span class="text-slate-300">${rankLabel}</span>
                <span>${p.emoji} ${escapeHtml(p.name)}</span>
                <span class="${pctColorClass}">(${pctVal}%)</span>
              </div>
            </div>
          `;
        } else {
          const activeQTag = activeQuestTagByUserIdRef.current[p.id] || '';
          const subRowHtml =
            activeQTag || powerPillHtml
              ? `<div class="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-100/90 mt-0.5">
                  ${activeQTag ? `<span class="px-1.5 py-0.2 rounded bg-black/50 border border-amber-500/50">📜 ${escapeHtml(activeQTag)}</span>` : ''}
                  ${powerPillHtml}
                </div>`
              : '';
          tagEl.innerHTML = `
            ${speechHtml}
            <div class="rpg-banner rounded-xl px-3 py-1 text-center whitespace-nowrap">
              <div class="flex items-center justify-center gap-1 font-[family-name:var(--font-kanit)] font-extrabold text-xs text-amber-200">
                <span>${rankLabel}</span>
                <span>${p.emoji} ${escapeHtml(p.name)}</span>
                <span class="${pctColorClass}">(${pctVal}%)</span>
              </div>
              ${subRowHtml}
              ${slackerHtml}
            </div>
            <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-amber-400 mx-auto"></div>
          `;
        }
      }
      labelsContainer.appendChild(tagEl);

      meshes.push({
        id: p.id,
        player: p,
        rankScale,
        isSpectator: isBeachWalker,
        isInFoodStall: !isBeachWalker && isInFoodStall,
        cheerCount: p.cheerCount ?? 0,
        temptCount: p.temptCount ?? 0,
        isCloseToFinish: !isLegacySpectator && (rankedInfo?.progressRatio ?? 0) >= 0.6,
        workoutType: dailyAct ? dailyAct.animType : slackerAct ? slackerAct.animType : 'cheer',
        petType,
        petParts,
        charParts,
        rootGroup,
        bounceGroup,
        bodyMesh,
        legL,
        legR,
        armL,
        armR,
        normalEyes,
        happyFace,
        angryFace,
        tagEl,
        activityLabel: dailyAct?.label || slackerAct?.label || '📣 เชียร์สุดใจ',
        targetPos,
        currentBellyScale: initialBellyScale,
        targetBellyScale: initialBellyScale,
        rubbedUntil: 0,
        lastBubbleAt: 0,
      });
    });

    charMeshesRef.current = meshes;

    // Immediately focus camera on the signed-in player once their 3D character mesh spawns
    const curUid = currentUserIdRef.current;
    if (curUid && curUid > 0 && autoFocusedUserIdRef.current !== curUid) {
      const meMesh = meshes.find((m) => m.id === curUid);
      if (meMesh) {
        autoFocusedUserIdRef.current = curUid;
        const pos = meMesh.rootGroup.position;
        cameraLookAtRef.current.set(pos.x, 1.6, pos.z);
        cameraTargetPosRef.current = new THREE.Vector3(pos.x + 2.5, 5.2, pos.z + 7.5);
      }
    }

    const plumbobMesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 0),
      new THREE.MeshStandardMaterial({
        color: 0x22C55E,
        emissive: 0x4ADE80,
        emissiveIntensity: 0.45,
        roughness: 0.2,
        metalness: 0.1,
      })
    );
    plumbobMesh.scale.set(0.85, 1.55, 0.85);
    plumbobMesh.visible = false;
    scene.add(plumbobMesh);

    const flowerThrowGroup = buildFireOrbProjectileMesh();
    flowerThrowGroup.visible = false;
    flowerThrowGroup.scale.setScalar(1.35);
    scene.add(flowerThrowGroup);

    const deliveryRiderGroup = buildDeliveryRider();
    deliveryRiderGroup.visible = false;
    scene.add(deliveryRiderGroup);

    // =========================================================================
    // 💰 ศึกแย่งเหรียญทองพักเที่ยง 3D (โผล่เฉพาะ จันทร์–ศุกร์ 12:00–13:00 น. เหรียญละ +1 💰 แย่งกันทั้งห้อง!)
    // =========================================================================
    const goldCoinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.48,
      metalness: 0.78,
      roughness: 0.18,
    });
    const goldRimMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.35,
      metalness: 0.85,
      roughness: 0.15,
    });
    const coinGlowRingMat = new THREE.MeshBasicMaterial({
      color: 0xfde047,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    const beachCoins: Array<{
      index: number;
      group: THREE.Group;
      spinner: THREE.Group;
      activeToken: string;
    }> = [];

    for (let ci = 0; ci < 3; ci++) {
      const cGroup = new THREE.Group();
      cGroup.userData.beachCoinIndex = ci;
      cGroup.visible = false;
      const spinner = new THREE.Group();
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.12, 24), goldCoinMat);
      disc.rotation.x = Math.PI / 2;
      disc.castShadow = true;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.055, 10, 24), goldRimMat);
      const starFront = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), goldRimMat);
      starFront.scale.set(1, 1, 0.45);
      starFront.position.z = 0.06;
      const starBack = starFront.clone();
      starBack.position.z = -0.06;
      spinner.add(disc, rim, starFront, starBack);

      const groundGlow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.68, 24), coinGlowRingMat);
      groundGlow.rotation.x = -Math.PI / 2;
      groundGlow.position.y = -0.56;

      cGroup.add(spinner, groundGlow);
      cGroup.traverse((ch) => {
        ch.userData.beachCoinIndex = ci;
      });
      scene.add(cGroup);
      beachCoins.push({ index: ci, group: cGroup, spinner, activeToken: '' });
    }

    const collectBeachCoinObj = (coinObj: (typeof beachCoins)[number]) => {
      if (!coinObj.group.visible || !coinObj.activeToken) return;
      const tok = coinObj.activeToken;
      claimedTokensRef.current.add(tok);
      coinObj.group.visible = false;
      void claimBeachCoinRef.current(coinObj.index, tok);
    };

    let frameId: number;
    let elapsed = 0;
    let frameCounter = 0;
    const clock = new THREE.Clock();
    const tempProjVec = new THREE.Vector3();
    const tempSkyCol = new THREE.Color();
    const tempLightCol = new THREE.Color();
    let cachedVw = window.innerWidth;
    let cachedVh = window.innerHeight;
    let cachedHeaderBottom = 88;
    let cachedMyTagHeight = 100;

    const refreshLayoutMetrics = () => {
      cachedVw = window.innerWidth;
      cachedVh = window.innerHeight;
      cachedHeaderBottom = headerRef.current
        ? headerRef.current.getBoundingClientRect().bottom
        : 88;
      const myEntry = meshes.find((m) => m.id === currentUserId);
      if (myEntry?.tagEl) {
        cachedMyTagHeight = myEntry.tagEl.offsetHeight || 100;
      }
    };
    requestAnimationFrame(refreshLayoutMetrics);

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      frameCounter++;
      // หยุดเรนเดอร์ฉากสนามด้านหลังชั่วคราวเมื่อพับแท็บ, เปิดหน้าแต่งตัวเต็มจอ, หรือหน้าล็อกอิน เพื่อไม่ให้การ์ดจอทำงานซ้อน 2 WebGL พร้อมกัน!
      if ((typeof document !== 'undefined' && document.hidden) || (pauseArenaRenderRef.current && frameCounter > 30)) {
        clock.getDelta();
        return;
      }
      const delta = Math.min(0.05, clock.getDelta());
      elapsed += delta;

      const walkerMesh =
        walkingSpectatorIdRef.current !== null
          ? meshes.find((m) => m.id === walkingSpectatorIdRef.current)
          : null;
      beachCoins.forEach((bc, bci) => {
        const serverCoin = lunchCoinsRef.current.find(
          (sc) => sc.slotId === bc.index && !claimedTokensRef.current.has(sc.spawnToken)
        );
        if (!serverCoin) {
          bc.group.visible = false;
          bc.activeToken = '';
          return;
        }
        bc.activeToken = serverCoin.spawnToken;
        bc.group.position.set(serverCoin.x, 0.78, serverCoin.z);
        bc.group.visible = true;
        bc.spinner.rotation.y = elapsed * 2.8 + bci * 1.8;
        bc.spinner.position.y = Math.sin(elapsed * 3.4 + bci * 1.4) * 0.14;
        if (walkerMesh) {
          const dx = walkerMesh.rootGroup.position.x - bc.group.position.x;
          const dz = walkerMesh.rootGroup.position.z - bc.group.position.z;
          if (dx * dx + dz * dz < 3.2) {
            collectBeachCoinObj(bc);
          }
        }
      });

      clouds.forEach((c) => {
        c.position.x += 0.015;
        if (c.position.x > cloudBoundX) c.position.x = -cloudBoundX;
      });
      balloons.forEach((b, bi) => {
        b.position.y += Math.sin(elapsed * 1.4 + bi * 1.7) * 0.012;
        b.rotation.y = Math.sin(elapsed * 0.5 + bi) * 0.15;
      });
      floatingIslands.forEach((isl, ii) => {
        isl.position.y = -0.35 + Math.sin(elapsed * 1.6 + ii * 2.1) * 0.08;
        isl.rotation.z = Math.sin(elapsed * 1.25 + ii * 1.5) * 0.045;
      });
      palmCrowns.forEach((crown, pi) => {
        crown.rotation.z = Math.sin(elapsed * 1.5 + pi * 0.85) * 0.05;
        crown.rotation.x = Math.cos(elapsed * 1.2 + pi * 1.1) * 0.038;
      });
      foamRings.forEach((foam, fi) => {
        const wave = Math.sin(elapsed * 2.1 - fi * 1.4);
        const sc = 1 + wave * 0.016;
        foam.scale.set(sc, sc, 1);
        const fMat = foam.material as THREE.MeshBasicMaterial;
        fMat.opacity = (fi === 0 ? 0.66 : 0.38) + wave * 0.14;
      });
      if (oceanMesh && frameCounter % qCfg.oceanFrameSkip === 0) {
        const oPos = oceanMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
        for (let oi = 0; oi < oPos.count; oi++) {
          const ox = oPos.getX(oi);
          const oy = oPos.getY(oi);
          const inIsland =
            Math.abs(ox - islandCenterX) < islandW / 2 + 2.5 &&
            Math.abs(oy) < islandD / 2 + 2.5;
          const amp = inIsland ? 0.04 : 0.16;
          const wh =
            (Math.sin(ox * 0.18 + elapsed * 1.9) + Math.cos(oy * 0.21 + elapsed * 1.5)) *
            0.5 *
            amp;
          oPos.setZ(oi, wh);
        }
        oPos.needsUpdate = true;
      }

      const bkkW = bkkWeatherRef.current;
      if (bkkW) {
        const { targetHex, targetLightHex, targetHemi, targetDir, isRaining, showNight } = resolveWeatherTargets(bkkW);

        tempSkyCol.setHex(targetHex);
        skyColor.lerp(tempSkyCol, 0.03);
        scene.background = skyColor;
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.lerp(tempSkyCol, 0.03);
        }
        tempLightCol.setHex(targetLightHex);
        dirLight.color.lerp(tempLightCol, 0.04);
        hemiLight.intensity += (targetHemi - hemiLight.intensity) * 0.04;
        const lightningFlash =
          bkkW.condition === 'storm' && Math.sin(elapsed * 7.3) > 0.97 && Math.sin(elapsed * 19.1) > 0.6 ? 1.5 : 0;
        dirLight.intensity += (targetDir + lightningFlash - dirLight.intensity) * 0.12;

        rainPoints.visible = isRaining;
        if (isRaining) {
          const dropSpeed = bkkW.condition === 'storm' ? 0.65 : 0.42;
          const posAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < rainCount; i++) {
            let py = posAttr.getY(i) - dropSpeed;
            if (py < 0) py = 24;
            posAttr.setY(i, py);
          }
          posAttr.needsUpdate = true;
        }
        nightGroup.visible = showNight;
      }

      const now = performance.now();
      const activeWalkerId = walkingSpectatorIdRef.current;
      let foundCurrentUserMesh = false;

      const visibleTags: Array<{
        mesh: (typeof meshes)[number];
        x: number;
        y: number;
        z: number;
        w: number;
        h: number;
        isMe: boolean;
      }> = [];

      meshes.forEach((c, idx) => {
        const hScale = c.charParts?.formHeightScale ?? 1;
        if (c.charParts) {
          c.glbGroup = c.charParts.glbGroup;
          c.mixer = c.charParts.mixer;
          c.rpgBones = c.charParts.rpgBones;
          c.isChibiAnimalGlb = c.charParts.isChibiAnimalGlb;
          c.charParts.mixer?.update(delta * (c.charParts.animSpeedMult ?? 1));
        }
        c.petParts?.mixer?.update(delta);
        if (c.id === currentUserId) {
          foundCurrentUserMesh = true;
          const rSc = c.rankScale ?? 1;
          const plumbobMountLift = (c.charParts?.riderGroup?.position.y ?? 0) * hScale * rSc;
          plumbobMesh.visible = true;
          plumbobMesh.position.set(
            c.rootGroup.position.x,
            c.rootGroup.position.y + plumbobMountLift + 3.55 * hScale * rSc + Math.sin(elapsed * 3.5) * 0.14,
            c.rootGroup.position.z
          );
          plumbobMesh.rotation.y = elapsed * 2.4;
        }
        if (activeWalkerId === c.id) {
          const keys = keysPressedRef.current;
          const inputRight =
            (keys['KeyD'] || keys['ArrowRight'] || keys['d'] || keys['arrowright'] ? 1 : 0) -
            (keys['KeyA'] || keys['ArrowLeft'] || keys['a'] || keys['arrowleft'] ? 1 : 0);
          const inputForward =
            (keys['KeyW'] || keys['ArrowUp'] || keys['w'] || keys['arrowup'] ? 1 : 0) -
            (keys['KeyS'] || keys['ArrowDown'] || keys['s'] || keys['arrowdown'] ? 1 : 0);
          let dx = 0;
          let dz = 0;
          let isWalking = false;

          if (inputRight !== 0 || inputForward !== 0) {
            walkTargetRef.current = null;
            const camForward = new THREE.Vector3();
            camera.getWorldDirection(camForward);
            camForward.y = 0;
            if (camForward.lengthSq() > 0.0001) camForward.normalize();
            else camForward.set(0, 0, -1);
            const camRight = new THREE.Vector3(-camForward.z, 0, camForward.x).normalize();
            const moveVec = new THREE.Vector3()
              .addScaledVector(camRight, inputRight)
              .addScaledVector(camForward, inputForward)
              .normalize();
            dx = moveVec.x;
            dz = moveVec.z;
            isWalking = true;
          } else if (walkTargetRef.current) {
            const toTargetX = walkTargetRef.current.x - c.rootGroup.position.x;
            const toTargetZ = walkTargetRef.current.z - c.rootGroup.position.z;
            const dist = Math.hypot(toTargetX, toTargetZ);
            if (dist > 0.25) {
              dx = toTargetX / dist;
              dz = toTargetZ / dist;
              isWalking = true;
            } else {
              walkTargetRef.current = null;
            }
          }

          if (isWalking) {
            const speed = 0.16;
            const minBeachX = islandCenterX - islandW / 2 + 1.8;
            const maxBeachX = islandCenterX + islandW / 2 - 1.8;
            const maxBeachZ = islandD / 2 - 1.8;
            c.rootGroup.position.x = Math.max(minBeachX, Math.min(maxBeachX, c.rootGroup.position.x + dx * speed));
            c.rootGroup.position.z = Math.max(-maxBeachZ, Math.min(maxBeachZ, c.rootGroup.position.z + dz * speed));
            c.targetPos.copy(c.rootGroup.position);
            c.rootGroup.rotation.y = Math.atan2(-dz, dx);
            savedSpectatorPosRef.current[c.id] = {
              x: c.rootGroup.position.x,
              y: c.rootGroup.position.y,
              z: c.rootGroup.position.z,
              rotY: c.rootGroup.rotation.y,
            };
            if (Math.floor(elapsed * 2) !== Math.floor((elapsed - 0.016) * 2)) {
              try {
                localStorage.setItem('waist_spectator_positions', JSON.stringify(savedSpectatorPosRef.current));
              } catch {
                // ignore quota errors
              }
            }
            if (c.charParts?.groundPropGroup) {
              c.charParts.groundPropGroup.visible = false;
            }
            if (c.charParts?.playClip && c.charParts.mixer) {
              c.charParts.playClip(resolveRpgAnimPatterns('run'));
              c.bounceGroup.position.set(0, 0, 0);
              c.bounceGroup.rotation.set(0, 0, 0);
            } else {
              c.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.2;
              c.bounceGroup.rotation.z = Math.sin(elapsed * 10) * 0.06;
              c.legL.rotation.z = Math.sin(elapsed * 10) * 0.65;
              c.legR.rotation.z = -Math.sin(elapsed * 10) * 0.65;
              c.armL.position.x = Math.sin(elapsed * 10) * 0.25;
              c.armR.position.x = -Math.sin(elapsed * 10) * 0.25;
            }
            syncCharacterMountPose(c, elapsed, idx, true, false);
          } else {
            if (c.charParts?.groundPropGroup) {
              c.charParts.groundPropGroup.visible = true;
            }
            if (c.charParts?.playClip && c.charParts.mixer) {
              c.charParts.playClip(resolveRpgAnimPatterns('spectator', c.workoutType));
            }
            animateCharacterMotion(c, elapsed, idx, c.currentBellyScale);
          }

          if ((realtimeChannelRef.current || localBroadcastRef.current) && (isWalking || wasWalkingRef.current)) {
            if (!isWalking || now - lastMoveBroadcastAtRef.current >= 85) {
              lastMoveBroadcastAtRef.current = now;
              const movePayload = {
                userId: c.id,
                x: Number(c.rootGroup.position.x.toFixed(2)),
                y: Number(c.rootGroup.position.y.toFixed(2)),
                z: Number(c.rootGroup.position.z.toFixed(2)),
                rotY: Number(c.rootGroup.rotation.y.toFixed(2)),
                isWalking,
                _senderInstance: clientInstanceIdRef.current,
              };
              realtimeChannelRef.current?.send({
                type: 'broadcast',
                event: 'move',
                payload: movePayload,
              });
              try {
                localBroadcastRef.current?.postMessage({ event: 'move', payload: movePayload });
              } catch {
                // ignore
              }
            }
          }
          wasWalkingRef.current = isWalking;

          if (isWalking && !cameraTargetPosRef.current) {
            controls.target.lerp(
              new THREE.Vector3(c.rootGroup.position.x, 1.4, c.rootGroup.position.z),
              0.08
            );
          }

          // Find nearest other spectator within 4.2 units
          let closest: Player | null = null;
          let minDist = 4.2;
          meshes.forEach((other) => {
            if (other.id !== c.id && other.isSpectator) {
              const dist = c.rootGroup.position.distanceTo(other.rootGroup.position);
              if (dist < minDist) {
                minDist = dist;
                closest = other.player;
              }
            }
          });
          const nextNearId = closest ? (closest as Player).id : null;
          if (nextNearId !== nearbySpectatorIdRef.current) {
            nearbySpectatorIdRef.current = nextNearId;
            setNearbySpectator(closest);
            if (!closest) setIsPairMenuOpen(false);
          }

          const distToGuard = c.rootGroup.position.distanceTo(guardParts.rootGroup.position);
          const nearGuardNow = distToGuard < 5.2;
          if (nearGuardNow !== isNearGuardRef.current) {
            isNearGuardRef.current = nearGuardNow;
            setIsNearGuard(nearGuardNow);
            if (!nearGuardNow) setGuardPrankMenu(null);
          }

          const distToCafe = c.rootGroup.position.distanceTo(cafePos);
          const nearCafeNow = distToCafe < 5.8;
          if (nearCafeNow !== isNearCafeRef.current) {
            isNearCafeRef.current = nearCafeNow;
            setIsNearCafe(nearCafeNow);
          }

          const distToDojang = c.rootGroup.position.distanceTo(dojangPos);
          const nearDojangNow = distToDojang < 5.8;
          if (nearDojangNow !== isNearDojangRef.current) {
            isNearDojangRef.current = nearDojangNow;
            setIsNearDojang(nearDojangNow);
          }

          const distToBoard = c.rootGroup.position.distanceTo(questBoardPos);
          const nearBoardNow = distToBoard < 5.0;
          if (nearBoardNow !== isNearQuestBoardRef.current) {
            isNearQuestBoardRef.current = nearBoardNow;
            setIsNearQuestBoard(nearBoardNow);
          }

          // ตรวจระยะใกล้ขอบทะเล (ริมเกาะ) เพื่อเปิดกิจกรรมตกปลา 🎣
          const edgeMinX = islandCenterX - islandW / 2 + 1.8;
          const edgeMaxX = islandCenterX + islandW / 2 - 1.8;
          const edgeMaxZ = islandD / 2 - 1.8;
          const dLeft = c.rootGroup.position.x - edgeMinX;
          const dRight = edgeMaxX - c.rootGroup.position.x;
          const dTop = c.rootGroup.position.z - -edgeMaxZ;
          const dBottom = edgeMaxZ - c.rootGroup.position.z;
          const minOceanDist = Math.min(dLeft, dRight, dTop, dBottom);
          const nearOceanNow = minOceanDist < 2.8;

          if (nearOceanNow) {
            if (minOceanDist === dLeft) oceanDirRef.current = { dx: -1, dz: 0 };
            else if (minOceanDist === dRight) oceanDirRef.current = { dx: 1, dz: 0 };
            else if (minOceanDist === dTop) oceanDirRef.current = { dx: 0, dz: -1 };
            else oceanDirRef.current = { dx: 0, dz: 1 };
          }
          if (nearOceanNow !== isNearOceanRef.current) {
            isNearOceanRef.current = nearOceanNow;
            setIsNearOcean(nearOceanNow);
            if (!nearOceanNow && fishingPhaseRef.current !== 'idle') {
              cancelFishing();
            }
          }

          if (isWalking && fishingPhaseRef.current !== 'idle') {
            cancelFishing();
          }

          // อัปเดตคันเบ็ด 3D + ทุ่นลอยน้ำเมื่อกำลังตกปลา
          const fPhase = fishingPhaseRef.current;
          if (fPhase !== 'idle' && nearOceanNow) {
            const od = oceanDirRef.current;
            const targetFacing = Math.atan2(-od.dz, od.dx);
            c.rootGroup.rotation.y = targetFacing;

            fishingRigGroup.visible = true;
            const px = c.rootGroup.position.x;
            const py = c.rootGroup.position.y;
            const pz = c.rootGroup.position.z;

            const isNibbling = fPhase === 'waiting' && now < fishingNibbleUntilRef.current;

            rodPivot.position.set(px + od.dx * 0.45, py + 1.05, pz + od.dz * 0.45);
            const rodTilt =
              fPhase === 'bite'
                ? Math.sin(elapsed * 42) * 0.22
                : fPhase === 'reeling'
                  ? 0.52
                  : isNibbling
                    ? Math.sin(elapsed * 24) * 0.07
                    : Math.sin(elapsed * 2.2) * 0.025;
            rodPivot.rotation.set(0, targetFacing, rodTilt);

            // สไตล์ Harvest Moon BTN: ตัวละครสั่นแรง + เครื่องหมาย ! เด้งบนหัวตอนปลากินเบ็ด!
            if (fPhase === 'bite') {
              c.bounceGroup.position.x = Math.sin(elapsed * 55) * 0.09;
              c.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 32)) * 0.14;
              biteAlertSprite.visible = true;
              biteAlertSprite.position.set(px, py + 3.15 + Math.abs(Math.sin(elapsed * 16)) * 0.25, pz);
              const popScale = 1.05 + Math.sin(elapsed * 22) * 0.14;
              biteAlertSprite.scale.set(popScale, popScale, 1);
            } else {
              c.bounceGroup.position.x = 0;
              biteAlertSprite.visible = false;
            }

            const tipX = px + od.dx * 2.75;
            const tipY = py + 2.45 + rodTilt * 1.1;
            const tipZ = pz + od.dz * 2.75;

            const bobX = px + od.dx * 5.6;
            const bobZ = pz + od.dz * 5.6;
            const bobY =
              fPhase === 'bite'
                ? -0.62 + Math.sin(elapsed * 36) * 0.18
                : isNibbling
                  ? -0.46 + Math.sin(elapsed * 22) * 0.06
                  : -0.34 + Math.sin(elapsed * 3.5) * 0.06;

            bobberGroup.position.set(bobX, bobY, bobZ);
            fishingBobberPosRef.current = { x: bobX, z: bobZ };

            const lineAttr = fishingLineGeo.attributes.position as THREE.BufferAttribute;
            lineAttr.setXYZ(0, tipX, tipY, tipZ);
            lineAttr.setXYZ(1, bobX, bobY + 0.14, bobZ);
            lineAttr.needsUpdate = true;

            if (fPhase === 'bite') {
              splashRingMesh.visible = true;
              const pulse = (elapsed * 3.6) % 1;
              splashRingMesh.position.set(bobX, -0.36, bobZ);
              splashRingMesh.scale.setScalar(1 + pulse * 3.6);
              splashRingMat.opacity = (1 - pulse) * 0.9;
            } else if (isNibbling) {
              splashRingMesh.visible = true;
              const pulse = (elapsed * 2.4) % 1;
              splashRingMesh.position.set(bobX, -0.36, bobZ);
              splashRingMesh.scale.setScalar(0.8 + pulse * 1.6);
              splashRingMat.opacity = (1 - pulse) * 0.55;
            } else {
              splashRingMesh.visible = false;
            }
          } else {
            fishingRigGroup.visible = false;
            biteAlertSprite.visible = false;
          }
        } else {
          const remoteFish = remoteFishingStateRef.current[c.id];
          const isRemoteFishing =
            Boolean(remoteFish) &&
            remoteFish.phase !== 'idle' &&
            now - remoteFish.updatedAt < 45000;
          if (isRemoteFishing && remoteFish) {
            const rig = getOrCreateRemoteFishingRig(c.id);
            const targetFacing = Math.atan2(-remoteFish.dz, remoteFish.dx);
            c.rootGroup.rotation.y = targetFacing;
            rig.group.visible = true;

            const px = c.rootGroup.position.x;
            const py = c.rootGroup.position.y;
            const pz = c.rootGroup.position.z;
            const rTilt =
              remoteFish.phase === 'bite'
                ? Math.sin(elapsed * 42) * 0.22
                : remoteFish.phase === 'reeling'
                  ? 0.52
                  : Math.sin(elapsed * 2.2) * 0.025;
            rig.rodPivot.position.set(px + remoteFish.dx * 0.45, py + 1.05, pz + remoteFish.dz * 0.45);
            rig.rodPivot.rotation.set(0, targetFacing, rTilt);

            const tipX = px + remoteFish.dx * 2.75;
            const tipY = py + 2.45 + rTilt * 1.1;
            const tipZ = pz + remoteFish.dz * 2.75;
            const bobX = px + remoteFish.dx * 5.6;
            const bobZ = pz + remoteFish.dz * 5.6;
            const bobY =
              remoteFish.phase === 'bite'
                ? -0.62 + Math.sin(elapsed * 36) * 0.18
                : -0.34 + Math.sin(elapsed * 3.5) * 0.06;
            rig.bobberGroup.position.set(bobX, bobY, bobZ);

            const lAttr = rig.lineGeo.attributes.position as THREE.BufferAttribute;
            lAttr.setXYZ(0, tipX, tipY, tipZ);
            lAttr.setXYZ(1, bobX, bobY + 0.14, bobZ);
            lAttr.needsUpdate = true;

            if (remoteFish.phase === 'bite') {
              rig.splashRing.visible = true;
              const pulse = (elapsed * 3.6) % 1;
              rig.splashRing.position.set(bobX, -0.36, bobZ);
              rig.splashRing.scale.setScalar(1 + pulse * 3.6);
              rig.splashMat.opacity = (1 - pulse) * 0.9;
              c.bounceGroup.position.x = Math.sin(elapsed * 55) * 0.08;
              rig.biteSprite.visible = true;
              rig.biteSprite.position.set(px, py + 3.15 + Math.abs(Math.sin(elapsed * 16)) * 0.25, pz);
              const popSc = 1.05 + Math.sin(elapsed * 22) * 0.14;
              rig.biteSprite.scale.set(popSc, popSc, 1);
            } else {
              rig.splashRing.visible = false;
              rig.biteSprite.visible = false;
              c.bounceGroup.position.x = 0;
            }
          } else {
            const existingRig = remoteFishingRigs.get(c.id);
            if (existingRig) {
              existingRig.group.visible = false;
              existingRig.biteSprite.visible = false;
            }
          }

          // Update Busy Status Badge above remote player's head (แต่งตัว / คาเฟ่ / วอลเลย์บอล / ชาบู / ไพ่)
          if (c.tagEl) {
            const busyEl = c.tagEl.querySelector('[data-busy-badge]') as HTMLElement | null;
            if (busyEl) {
              const bInfo = remoteBusyStatusRef.current[c.id];
              const nextBusy = bInfo && now - bInfo.updatedAt < 180000 ? bInfo.label : '';
              if (busyEl.dataset.lastBusy !== nextBusy) {
                busyEl.dataset.lastBusy = nextBusy;
                if (nextBusy) {
                  busyEl.textContent = nextBusy;
                  busyEl.classList.remove('hidden');
                } else {
                  busyEl.classList.add('hidden');
                }
              }
            }
          }

          const remoteState = c.isSpectator ? remoteSpectatorStateRef.current[c.id] : undefined;
          if (remoteState) {
            c.targetPos.set(remoteState.x, remoteState.y, remoteState.z);
            c.rootGroup.position.lerp(c.targetPos, 0.18);
            let rotDiff = remoteState.rotY - c.rootGroup.rotation.y;
            while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
            while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
            c.rootGroup.rotation.y += rotDiff * 0.22;
          } else {
            c.rootGroup.position.lerp(c.targetPos, 0.06);
          }
          c.currentBellyScale += (c.targetBellyScale - c.currentBellyScale) * 0.08;
          const isRubbed = now < c.rubbedUntil;
          const jiggle = isRubbed ? Math.sin(elapsed * 22) * 0.05 : 0;
          const nextScale = c.currentBellyScale + jiggle;
          setCharacterExpression(c, isRubbed ? (c.isCloseToFinish ? 'angry' : 'happy') : 'normal');
          const isRemoteWalking =
            Boolean(remoteState) &&
            ((remoteState!.isWalking && now - remoteState!.updatedAt < 450) ||
              c.rootGroup.position.distanceTo(c.targetPos) > 0.12);
          if (isRemoteWalking) {
            if (c.charParts?.groundPropGroup) {
              c.charParts.groundPropGroup.visible = false;
            }
            if (c.charParts?.playClip && c.charParts.mixer) {
              c.charParts.playClip(resolveRpgAnimPatterns('run'));
              c.bounceGroup.position.set(0, 0, 0);
              c.bounceGroup.rotation.set(0, 0, 0);
            } else {
              c.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.2;
              c.bounceGroup.rotation.z = Math.sin(elapsed * 10) * 0.06;
              c.legL.rotation.z = Math.sin(elapsed * 10) * 0.65;
              c.legR.rotation.z = -Math.sin(elapsed * 10) * 0.65;
              c.armL.position.x = Math.sin(elapsed * 10) * 0.25;
              c.armR.position.x = -Math.sin(elapsed * 10) * 0.25;
            }
            syncCharacterMountPose(c, elapsed, idx, true, false);
          } else {
            if (c.charParts?.groundPropGroup) {
              c.charParts.groundPropGroup.visible = true;
            }
            if (c.charParts?.playClip && c.charParts.mixer) {
              c.charParts.playClip(
                c.isSpectator || c.isInFoodStall
                  ? resolveRpgAnimPatterns('spectator', c.workoutType)
                  : resolveRpgAnimPatterns('run'),
                idx * 0.37
              );
            }
            animateCharacterMotion(c, elapsed, idx, nextScale);
          }
        }
        if (c.petParts) {
          animatePetMotion(c.petParts, c, c.petType, c.isCloseToFinish, elapsed, idx);
        }

        const rScale = c.rankScale ?? 1;
        const riderLift = (c.charParts?.riderGroup?.position.y ?? 0) * hScale * rScale;

        if (c.id === leaderIdRef.current) {
          crownMesh.position.set(
            c.rootGroup.position.x + 0.05,
            c.rootGroup.position.y + riderLift + c.bounceGroup.position.y * rScale + 2.85 * hScale * rScale + Math.sin(elapsed * 4) * 0.08,
            c.rootGroup.position.z
          );
          crownMesh.rotation.y = elapsed * 2.2;
        }

        if (c.id === loserIdRef.current && meshes.length > 1) {
          flameParticles.forEach((fp, fIdx) => {
            const t = (elapsed * fp.speed + fp.offset) % 1;
            fp.mesh.position.set(
              c.rootGroup.position.x - 0.7 - t * 1.4,
              c.rootGroup.position.y + 0.6 + t * 1.1,
              c.rootGroup.position.z + Math.sin(elapsed * 8 + fIdx) * 0.28
            );
            const s = (1 - t) * 1.1;
            fp.mesh.scale.set(s, s, s);
          });
        }

        tempProjVec.set(
          c.rootGroup.position.x,
          c.rootGroup.position.y + riderLift + 3.15 * hScale * rScale,
          c.rootGroup.position.z
        );
        tempProjVec.project(camera);

        if (tempProjVec.z < 1) {
          const x = (tempProjVec.x * 0.5 + 0.5) * cachedVw;
          const rawY = (-tempProjVec.y * 0.5 + 0.5) * cachedVh;
          const minBottomY = cachedHeaderBottom + 12 + cachedMyTagHeight;
          const isMe = c.id === currentUserId;
          const y = isMe ? Math.max(minBottomY, rawY) : rawY;
          visibleTags.push({
            mesh: c,
            x,
            y,
            z: tempProjVec.z,
            w: c.isSpectator ? 118 : 150,
            h: c.isSpectator ? 32 : 54,
            isMe,
          });
        } else if (c.lastVisible !== false) {
          c.tagEl.style.opacity = '0';
          c.lastVisible = false;
        }
      });

      // 2D Anti-Overlap Pass: ดันป้ายขึ้นเบาๆ ไม่เกิน 22px (กันป้ายลอยขึ้นฟ้าเมื่อยืนรวมกันเยอะๆ!)
      visibleTags.sort((a, b) => {
        if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
        return a.z - b.z;
      });
      const MAX_LIFT_PX = 22;
      for (let i = 0; i < visibleTags.length; i++) {
        const cur = visibleTags[i];
        const origY = cur.y;
        if (!cur.isMe) {
          for (let j = 0; j < i; j++) {
            const other = visibleTags[j];
            const minDx = (cur.w + other.w) * 0.4;
            const minDy = Math.min(cur.h, other.h) * 0.75;
            if (Math.abs(cur.x - other.x) < minDx && Math.abs(cur.y - other.y) < minDy) {
              const candidateY = other.y - minDy - 2;
              // Allow only a gentle lift close to the character's head; if too crowded, keep anchored on head!
              if (origY - candidateY <= MAX_LIFT_PX) {
                cur.y = candidateY;
              }
            }
          }
          cur.y = Math.max(origY - MAX_LIFT_PX, cur.y);
        }
        const m = cur.mesh;
        m.tagEl.style.setProperty('--tag-x', `${cur.x.toFixed(1)}px`);
        m.tagEl.style.setProperty('--tag-y', `${cur.y.toFixed(1)}px`);
        if (m.lastVisible !== true) {
          m.tagEl.style.opacity = '1';
          m.lastVisible = true;
        }
        const nextZ = cur.isMe ? 180 : Math.round((1 - cur.z) * 100);
        if (m.lastZIndex !== nextZ) {
          m.tagEl.style.zIndex = String(nextZ);
          m.lastZIndex = nextZ;
        }
      }
      if (!foundCurrentUserMesh) plumbobMesh.visible = false;

      const delivery = pendingDeliveryRef.current;
      if (delivery) {
        const dt = (now - delivery.startTime) / 1000;
        const targetChar = meshes.find((m) => m.id === delivery.targetId);
        if (dt < 2.4 && targetChar) {
          if (delivery.kind === 'cheer') {
            deliveryRiderGroup.visible = false;
            const tNorm = Math.min(1, dt / 1.1);
            const endPos = targetChar.rootGroup.localToWorld(new THREE.Vector3(-0.35, 0.25, -0.95));
            const startPos = endPos.clone().add(new THREE.Vector3(0, 1.2, -7.5));
            flowerThrowGroup.visible = true;
            flowerThrowGroup.position.lerpVectors(startPos, endPos, tNorm);
            flowerThrowGroup.position.y += Math.sin(tNorm * Math.PI) * 3.0;
            flowerThrowGroup.rotation.y = elapsed * 6;
          } else {
            flowerThrowGroup.visible = false;
            deliveryRiderGroup.visible = true;
            const dropPos = targetChar.rootGroup.localToWorld(new THREE.Vector3(-0.35, 0.0, 1.15));
            const edgePos = dropPos.clone().add(new THREE.Vector3(-9, 0, 5.5));
            if (dt < 1.1) {
              const tIn = dt / 1.1;
              deliveryRiderGroup.position.lerpVectors(edgePos, dropPos, tIn);
              deliveryRiderGroup.rotation.y = Math.atan2(-(dropPos.z - edgePos.z), dropPos.x - edgePos.x);
            } else {
              const tOut = Math.min(1, (dt - 1.1) / 1.1);
              const exitPos = dropPos.clone().add(new THREE.Vector3(10, 0, 5.5));
              deliveryRiderGroup.position.lerpVectors(dropPos, exitPos, tOut);
              deliveryRiderGroup.rotation.y = Math.atan2(-(exitPos.z - dropPos.z), exitPos.x - dropPos.x);
            }
          }
          if (dt >= 1.1 && !delivery.addedToPile) {
            delivery.addedToPile = true;
            if (delivery.kind === 'cheer') {
              const fi = Math.min(11, targetChar.cheerCount ?? 0);
              targetChar.cheerCount = (targetChar.cheerCount ?? 0) + 1;
              if (fi < 12) {
                const fl = buildFireEmberPileMesh(fi);
                fl.scale.setScalar(1.3);
                const ring = Math.floor(fi / 4);
                const angle = (fi % 4) * 0.65 - 0.95;
                fl.position.set(
                  -0.35 + Math.cos(angle) * (0.62 + ring * 0.36),
                  0,
                  -1.0 - Math.sin(angle) * 0.32 - ring * 0.28
                );
                targetChar.rootGroup.add(fl);
              }
            } else {
              const di = Math.min(19, targetChar.temptCount ?? 0);
              targetChar.temptCount = (targetChar.temptCount ?? 0) + 1;
              if (di < 20) {
                const fd = buildFoodPileMesh(di);
                fd.scale.setScalar(1.45);
                const layer = Math.floor(di / 4);
                const slot = di % 4;
                fd.position.set(
                  -0.35 + (slot - 1.5) * 0.36,
                  layer * 0.2,
                  0.95 + (slot % 2) * 0.32
                );
                targetChar.rootGroup.add(fd);
              }
            }
          }
        } else {
          flowerThrowGroup.visible = false;
          deliveryRiderGroup.visible = false;
          pendingDeliveryRef.current = null;
        }
      } else {
        flowerThrowGroup.visible = false;
        deliveryRiderGroup.visible = false;
      }

      // Shared Synchronized Arena Guard AI (ทุกคนเห็นพร้อมกันทั้งหมด: คนเดียววิ่งไล่ • หลายคนปาอาหารในจานใส่!)
      const ejectSpectatorOffTrack = (
        targetMesh: any,
        tInfo: ReturnType<typeof getNearestTrackInfo>,
        mode: 'fork' | 'food'
      ) => {
        const tan = trackCurve.getTangentAt(tInfo.t);
        const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const sideSign =
          (targetMesh.rootGroup.position.x - tInfo.pt.x) * normal.x +
            (targetMesh.rootGroup.position.z - tInfo.pt.z) * normal.z >=
            0
            ? 1
            : -1;
        const ejected = tInfo.pt.clone().addScaledVector(normal, sideSign * (trackWidth / 2 + 2.5));
        const ejX = Number(ejected.x.toFixed(2));
        const ejZ = Number(ejected.z.toFixed(2));
        const ejRot = Number(targetMesh.rootGroup.rotation.y.toFixed(2));

        targetMesh.rootGroup.position.set(ejX, 0.2, ejZ);
        targetMesh.targetPos.set(ejX, 0.2, ejZ);
        savedSpectatorPosRef.current[targetMesh.id] = { x: ejX, y: 0.2, z: ejZ, rotY: ejRot };
        remoteSpectatorStateRef.current[targetMesh.id] = {
          x: ejX,
          y: 0.2,
          z: ejZ,
          rotY: ejRot,
          isWalking: false,
          updatedAt: now,
        };

        if (targetMesh.id === activeWalkerId) {
          walkTargetRef.current = null;
          if (now - lastLocalEjectAtRef.current > 900) {
            lastLocalEjectAtRef.current = now;
            setShakeScreen(true);
            setTimeout(() => setShakeScreen(false), 450);
            if (mode === 'food') {
              showToast(
                '🍖',
                'โดนพี่ยามปาอาหารอัดกระเด็น!',
                'แห่เข้าสนามพร้อมกันหลายคน พี่ยามเลยสาดหมูกรอบในจานไล่ซะเลย!'
              );
            } else {
              showToast('👮', 'โดนพี่ยามไล่ออกจากสนาม!', 'กรุณาข้ามลู่วิ่งตรงทางม้าลายเท่านั้นนะ!');
            }
          }
          broadcastRealtimeEvent('guard_eject', {
            userId: targetMesh.id,
            x: ejX,
            y: 0.2,
            z: ejZ,
            rotY: ejRot,
            mode,
          });
          broadcastRealtimeEvent('move', {
            userId: targetMesh.id,
            x: ejX,
            y: 0.2,
            z: ejZ,
            rotY: ejRot,
            isWalking: false,
          });
        } else if (now - (remoteEjectSentAt[targetMesh.id] || 0) > 900) {
          remoteEjectSentAt[targetMesh.id] = now;
          broadcastRealtimeEvent('guard_eject', {
            userId: targetMesh.id,
            x: ejX,
            y: 0.2,
            z: ejZ,
            rotY: ejRot,
            mode,
          });
        }
      };

      const trespassers = meshes
        .filter((m) => m.isSpectator)
        .map((m) => ({ mesh: m, info: getNearestTrackInfo(m.rootGroup.position) }))
        .filter((item) => item.info.onTrack && !item.info.onCrosswalk)
        .sort((a, b) => a.mesh.id - b.mesh.id);

      const gPos = guardParts.rootGroup.position;
      if (walkingSpectatorIdRef.current === null) {
        fishingRigGroup.visible = false;
      }

      // เอฟเฟกต์ 3D ฉลองตกปลาตามระดับความแรร์ (Common / Uncommon / Rare / Legendary)
      const activeFishFx = fishingFxRef.current;
      if (activeFishFx) {
        const fxAge = now - activeFishFx.startedAt;
        const p = Math.min(1, fxAge / activeFishFx.durationMs);
        if (p >= 1) {
          fishingFxRef.current = null;
          fishingFxGroup.visible = false;
        } else {
          fishingFxGroup.visible = true;
          fishingFxGroup.position.set(activeFishFx.bobberX, -0.35, activeFishFx.bobberZ);
          const rarity = activeFishFx.rarity;
          const beamHex = FISHING_RARITY_META[rarity].beamHex;

          // วงคลื่นน้ำกระจาย (มีทุกระดับ แต่ใหญ่และสีต่างกัน)
          catchRingMesh.visible = true;
          catchRingMat.color.setHex(rarity === 'common' ? 0xe0f2fe : beamHex);
          const ringScale =
            rarity === 'legendary'
              ? 1 + p * 7.5
              : rarity === 'rare'
                ? 1 + p * 5.2
                : rarity === 'uncommon'
                  ? 1 + p * 3.6
                  : 1 + p * 2.2;
          catchRingMesh.scale.setScalar(ringScale);
          catchRingMat.opacity = (1 - p) * 0.9;

          // เสาแสงพุ่งขึ้นฟ้าสำหรับ Rare, Legendary และ Fake-out แสงทองของพี่ยาม!
          if (rarity === 'rare' || rarity === 'legendary' || rarity === 'guard_troll') {
            catchBeamMesh.visible = true;
            // guard_troll แกล้งเป็นเสาแสงสีทองหลอกๆ ช่วงแรก แล้วสลับเป็นสีแดง-ทองตอนพี่ยามโผล่!
            const effectiveBeamHex =
              rarity === 'guard_troll'
                ? p < 0.22
                  ? 0xfacc15
                  : Math.floor(elapsed * 12) % 2 === 0
                    ? 0xef4444
                    : 0xfacc15
                : beamHex;
            catchBeamMat.color.setHex(effectiveBeamHex);
            const widthBoost = rarity === 'legendary' || rarity === 'guard_troll' ? 1.55 : 0.95;
            const fade = p < 0.15 ? p / 0.15 : 1 - (p - 0.15) / 0.85;
            catchBeamMesh.scale.set(
              widthBoost * (0.85 + Math.sin(elapsed * 14) * 0.12),
              rarity === 'legendary' || rarity === 'guard_troll' ? 1.35 : 0.9,
              widthBoost * (0.85 + Math.sin(elapsed * 14) * 0.12)
            );
            catchBeamMat.opacity = Math.max(0, fade * (rarity === 'legendary' ? 0.65 : 0.48));
            catchBeamMesh.rotation.y = elapsed * 2.4;
          } else {
            catchBeamMesh.visible = false;
          }

          // พี่ยาม 3D พุ่งขึ้นมาจากทะเลเกาะเบ็ดขึ้นมา!
          const isGuardPop =
            rarity === 'guard_troll' &&
            (activeFishFx.caughtId === 'guard_hooked' || activeFishFx.caughtId === 'guard_diver');
          if (isGuardPop && p >= 0.16) {
            seaGuardPopParts.rootGroup.visible = true;
            const popP = (p - 0.16) / 0.84;
            const riseY =
              popP < 0.2
                ? -1.8 + (popP / 0.2) * 3.2
                : popP < 0.82
                  ? 1.4 + Math.sin(elapsed * 10) * 0.16
                  : 1.4 - ((popP - 0.82) / 0.18) * 3.4;
            seaGuardPopParts.rootGroup.position.set(0, riseY, 0);
            seaGuardPopParts.rootGroup.rotation.y = elapsed * 2.8;
            seaGuardPopParts.armL.rotation.z = 1.1 + Math.sin(elapsed * 22) * 0.6;
            seaGuardPopParts.armR.rotation.z = -1.1 - Math.sin(elapsed * 22) * 0.6;
            seaGuardPopParts.legL.rotation.z = Math.sin(elapsed * 18) * 0.5;
            seaGuardPopParts.legR.rotation.z = -Math.sin(elapsed * 18) * 0.5;
            setCharacterExpression(seaGuardPopParts, 'angry');
          } else {
            seaGuardPopParts.rootGroup.visible = false;
          }

          // วงแหวนทองชั้นที่ 2 เฉพาะ Legendary และ guard_troll
          if (rarity === 'legendary' || rarity === 'guard_troll') {
            catchRing2Mesh.visible = true;
            const p2 = (p * 2.2) % 1;
            catchRing2Mesh.scale.setScalar(1 + p2 * 6.5);
            catchRing2Mat.opacity = (1 - p2) * 0.85;
          } else {
            catchRing2Mesh.visible = false;
          }
        }
      } else {
        fishingFxGroup.visible = false;
        seaGuardPopParts.rootGroup.visible = false;
      }

      const activePrank = guardPrankFxRef.current;

      if (activePrank && now - activePrank.startedAt < activePrank.durationMs) {
        const pNorm = (now - activePrank.startedAt) / activePrank.durationMs;
        const rx = activePrank.prank.reaction;
        setCharacterExpression(guardParts, rx === 'dance' ? 'normal' : 'angry');
        const nextKey = `prank-${activePrank.prank.id}-${activePrank.startedAt}`;
        if (guardBadgeEl && currentGuardBadgeKey !== nextKey) {
          currentGuardBadgeKey = nextKey;
          guardBadgeEl.className =
            'bg-fuchsia-600 text-yellow-200 border-2 border-white rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap animate-bounce';
          guardBadgeEl.textContent = `${activePrank.prank.icon} ${activePrank.prank.guardSpeech}`;
        }

        // แสดงพรอพ 3D + ท่าทางเฉพาะของแต่ละวิธีแกล้งทั้ง 12 แบบ!
        guardPrankRig.update(activePrank.prank.id, pNorm, elapsed, gPos, guardPostPos, guardParts);
      } else {
        guardPrankRig.hideAll();
        if (activePrank) {
          guardPrankFxRef.current = null;
          guardParts.rootGroup.scale.set(1, 1, 1);
          guardParts.rootGroup.rotation.x = 0;
          guardParts.rootGroup.rotation.z = 0;
          gPos.y = guardPostPos.y;
        }
        if (trespassers.length >= 2) {
          // โหมดหลายคน: พี่ยามหยุดวิ่งไล่ แล้วหันไปหยิบอาหารในจานปาใส่รัวๆ จนกระเด็นออกจากสนามทุกคน!
          setCharacterExpression(guardParts, 'angry');
          const nextKey = `barrage-${trespassers.length}`;
          if (guardBadgeEl && currentGuardBadgeKey !== nextKey) {
            currentGuardBadgeKey = nextKey;
            guardBadgeEl.className =
              'bg-rose-600 text-amber-100 border-2 border-amber-300 rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10px] font-extrabold whitespace-nowrap';
            guardBadgeEl.textContent = `🍖 พี่ยามของขึ้น! ปาอาหารในมือไล่แก๊งบุกสนาม (${trespassers.length} คน)!!`;
          }

          if (
            activeWalkerId !== null &&
            trespassers.some((t) => t.mesh.id === activeWalkerId) &&
            now - lastGuardWarnAt > 2500
          ) {
            lastGuardWarnAt = now;
            showToast('🍖', 'พี่ยามหยิบของกินขึ้นปาแล้ว!', 'ลงสนามพร้อมกันหลายคนระวังหมูกรอบบินอัดหน้านะ!');
          }

          // หันหน้าเล็งไปทางจุดกึ่งกลางของกลุ่มผู้บุกรุก พร้อมท่าควักของกินจากจานขว้างรัวๆ
          let avgX = 0;
          let avgZ = 0;
          trespassers.forEach((tr) => {
            avgX += tr.mesh.rootGroup.position.x;
            avgZ += tr.mesh.rootGroup.position.z;
          });
          avgX /= trespassers.length;
          avgZ /= trespassers.length;

          guardParts.rootGroup.rotation.y = Math.atan2(-(avgZ - gPos.z), avgX - gPos.x);
          guardParts.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 16)) * 0.16;
          guardParts.legL.rotation.z = Math.sin(elapsed * 16) * 0.22;
          guardParts.legR.rotation.z = -Math.sin(elapsed * 16) * 0.22;
          guardParts.armL.rotation.z = 0.38 + Math.sin(elapsed * 10) * 0.12;
          guardParts.armR.rotation.z = 0.65 + Math.sin(elapsed * 22) * 0.85;

          // ปล่อยกระสุนอาหารจากจานในมือพุ่งโค้งเข้าใส่ผู้บุกรุกทุกคนเป็นชุดๆ
          if (now - lastFoodVolleyAt > 290) {
            lastFoodVolleyAt = now;
            trespassers.forEach((tr) => {
              const alreadyFlying = guardProjectiles.some(
                (p) => p.active && p.targetUserId === tr.mesh.id
              );
              if (alreadyFlying) return;
              const slotProj = guardProjectiles.find((p) => !p.active);
              if (!slotProj) return;
              slotProj.active = true;
              slotProj.targetUserId = tr.mesh.id;
              slotProj.startPos.set(gPos.x, gPos.y + 1.95, gPos.z);
              slotProj.launchedAt = now;
              const dist = Math.hypot(
                tr.mesh.rootGroup.position.x - gPos.x,
                tr.mesh.rootGroup.position.z - gPos.z
              );
              slotProj.durationMs = Math.max(280, Math.min(560, dist * 34));
              slotProj.mesh.position.copy(slotProj.startPos);
              slotProj.mesh.visible = true;
            });
          }
        } else if (trespassers.length === 1) {
          // โหมดคนเดียว: ทุกคนในห้องเห็นพี่ยามวิ่งหน้าตั้งถือส้อมเงินไล่กวดผู้บุกรุก!
          const single = trespassers[0];
          setCharacterExpression(guardParts, 'angry');
          const nextKey = `chase-${single.mesh.id}`;
          if (guardBadgeEl && currentGuardBadgeKey !== nextKey) {
            currentGuardBadgeKey = nextKey;
            guardBadgeEl.className =
              'bg-amber-500 text-black border-2 border-black rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10px] font-extrabold whitespace-nowrap';
            guardBadgeEl.textContent = `🚨 พี่ยามวิ่งไล่ตะเพิด ${single.mesh.player.name}!`;
          }

          if (single.mesh.id === activeWalkerId && now - lastGuardWarnAt > 2500) {
            lastGuardWarnAt = now;
            showToast('🚨', 'พี่ยามเป่านกหวีด!', 'ห้ามเดินลงลู่วิ่ง! ให้ไปข้ามตรงทางม้าลายกลางสนาม!');
          }

          const toWalkerX = single.mesh.rootGroup.position.x - gPos.x;
          const toWalkerZ = single.mesh.rootGroup.position.z - gPos.z;
          const distToWalker = Math.hypot(toWalkerX, toWalkerZ);

          if (distToWalker > 1.72) {
            const gSpeed = 0.25;
            gPos.x += (toWalkerX / distToWalker) * gSpeed;
            gPos.z += (toWalkerZ / distToWalker) * gSpeed;
            guardParts.rootGroup.rotation.y = Math.atan2(-toWalkerZ, toWalkerX);
            guardParts.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 14)) * 0.24;
            guardParts.legL.rotation.z = Math.sin(elapsed * 14) * 0.72;
            guardParts.legR.rotation.z = -Math.sin(elapsed * 14) * 0.72;
            guardParts.armR.rotation.z = 0.52 + Math.sin(elapsed * 18) * 0.55;
            guardParts.armL.rotation.z = -Math.sin(elapsed * 14) * 0.22;
          } else {
            ejectSpectatorOffTrack(single.mesh, single.info, 'fork');
          }
        } else {
          // ค่อยๆ สงบลงตามเวลา แต่ถ้าเกรี้ยวกราดหนัก (>= 5) จะพาลขว้างอาหารใส่คนรอบข้างแม้ไม่ได้ข้ามสนาม!
          guardRageRef.current = Math.max(0, guardRageRef.current - 0.0012);
          const isFurious = guardRageRef.current >= 5;

          setCharacterExpression(guardParts, isFurious ? 'angry' : 'normal');
          const nextIdleKey = isFurious ? 'furious' : 'idle';
          if (guardBadgeEl && currentGuardBadgeKey !== nextIdleKey) {
            currentGuardBadgeKey = nextIdleKey;
            if (isFurious) {
              guardBadgeEl.className =
                'bg-rose-600 text-amber-100 border-2 border-amber-300 rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10px] font-extrabold whitespace-nowrap';
              guardBadgeEl.textContent = '🤬 พี่ยามเกรี้ยวกราด! ระวังหมูกรอบปลิวว่อน!!';
            } else {
              guardBadgeEl.className =
                'bg-[#18181B] text-[#FFE600] border-2 border-[#FFE600] rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10px] font-extrabold whitespace-nowrap hover:scale-105 transition';
              guardBadgeEl.textContent = '🍴 พี่ยามคุมลู่สายกิน (ข้ามเฉพาะทางม้าลาย!)';
            }
          }

          if (isFurious) {
            const throwInterval = guardRageRef.current >= 8 ? 15000 : 16000;
            if (now - guardLastRageThrowRef.current > throwInterval) {
              const nearbyTargets = meshes.filter(
                (m) => m.rootGroup.position.distanceTo(gPos) < 18
              );
              if (nearbyTargets.length > 0) {
                const victim = nearbyTargets[Math.floor(Math.random() * nearbyTargets.length)];
                const slotProj = guardProjectiles.find((p) => !p.active);
                if (slotProj) {
                  guardLastRageThrowRef.current = now;
                  slotProj.active = true;
                  slotProj.targetUserId = victim.id;
                  slotProj.launchedAt = now;
                  slotProj.durationMs = 780;
                  slotProj.startPos.set(gPos.x, gPos.y + 1.55, gPos.z);
                  slotProj.mesh.position.copy(slotProj.startPos);
                  slotProj.mesh.visible = true;
                  guardParts.rootGroup.rotation.y = Math.atan2(
                    -(victim.rootGroup.position.z - gPos.z),
                    victim.rootGroup.position.x - gPos.x
                  );
                }
              }
            }
          }

          const backX = guardPostPos.x - gPos.x;
          const backZ = guardPostPos.z - gPos.z;
          const backDist = Math.hypot(backX, backZ);
          if (backDist > 0.2) {
            gPos.x += (backX / backDist) * 0.12;
            gPos.z += (backZ / backDist) * 0.12;
            guardParts.rootGroup.rotation.y = Math.atan2(-backZ, backX);
            guardParts.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 8)) * 0.15;
            guardParts.legL.rotation.z = Math.sin(elapsed * 8) * 0.5;
            guardParts.legR.rotation.z = -Math.sin(elapsed * 8) * 0.5;
            guardParts.armR.rotation.z = 0;
            guardParts.armL.rotation.z = 0;
          } else {
            guardParts.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 2.2)) * 0.03;
            guardParts.legL.rotation.z = 0;
            guardParts.legR.rotation.z = 0;
            guardParts.armR.rotation.z = Math.max(0, Math.sin(elapsed * 1.8)) * 0.26;
            guardParts.armL.rotation.z = 0;
            guardParts.rootGroup.rotation.y =
              Math.atan2(-crosswalkNorm.z, crosswalkNorm.x) + Math.sin(elapsed * 0.9) * 0.12;
          }
        }
      }

      // อัปเดตวิถีโค้งของอาหารที่พี่ยามปาออกไปทุกเฟรม (ทุกคนในสนามเห็นอาหารลอยไปชนเป้าหมายพร้อมกัน!)
      guardProjectiles.forEach((proj) => {
        if (!proj.active) return;
        const targetMesh = meshes.find((m) => m.id === proj.targetUserId);
        if (!targetMesh) {
          proj.active = false;
          proj.mesh.visible = false;
          return;
        }
        const p = Math.min(1, (now - proj.launchedAt) / proj.durationMs);
        const tx = targetMesh.rootGroup.position.x;
        const ty = targetMesh.rootGroup.position.y + 1.35;
        const tz = targetMesh.rootGroup.position.z;
        const arcH = Math.sin(p * Math.PI) * 2.25;

        proj.mesh.position.set(
          proj.startPos.x + (tx - proj.startPos.x) * p,
          proj.startPos.y + (ty - proj.startPos.y) * p + arcH,
          proj.startPos.z + (tz - proj.startPos.z) * p
        );
        proj.mesh.rotation.x += 0.32;
        proj.mesh.rotation.y += 0.24;
        proj.mesh.rotation.z += 0.28;

        if (p >= 1) {
          proj.active = false;
          proj.mesh.visible = false;
          const hitInfo = getNearestTrackInfo(targetMesh.rootGroup.position);
          if (hitInfo.onTrack && !hitInfo.onCrosswalk) {
            ejectSpectatorOffTrack(targetMesh, hitInfo, 'food');
          } else if (targetMesh.id === activeWalkerId) {
            setShakeScreen(true);
            setTimeout(() => setShakeScreen(false), 380);
            showToast(
              '🍖',
              'โดนพี่ยามพาลขว้างหมูกรอบใส่!',
              'พี่ยามกำลังเกรี้ยวกราดจัด ใครเดินผ่านแถวนี้โดนลูกหลงหมด!'
            );
          }
        }
      });

      trackMarkers.forEach((tm, tmIdx) => {
        animateTrackMarkerMesh(tm.parts, elapsed, tmIdx);
        tempProjVec.set(tm.pos.x, tm.pos.y + 2.55, tm.pos.z);
        tempProjVec.project(camera);
        if (tempProjVec.z < 1) {
          tm.tagEl.style.setProperty('--tag-x', `${((tempProjVec.x * 0.5 + 0.5) * cachedVw).toFixed(1)}px`);
          tm.tagEl.style.setProperty('--tag-y', `${((-tempProjVec.y * 0.5 + 0.5) * cachedVh).toFixed(1)}px`);
          tm.tagEl.style.opacity = '1';
          tm.tagEl.style.zIndex = String(Math.max(1, Math.round((1 - tempProjVec.z) * 95)));
        } else {
          tm.tagEl.style.opacity = '0';
        }
      });

      tempProjVec.set(
        guardParts.rootGroup.position.x,
        guardParts.rootGroup.position.y + 3.45,
        guardParts.rootGroup.position.z
      );
      tempProjVec.project(camera);
      if (tempProjVec.z < 1) {
        guardTagEl.style.setProperty('--tag-x', `${((tempProjVec.x * 0.5 + 0.5) * cachedVw).toFixed(1)}px`);
        guardTagEl.style.setProperty('--tag-y', `${((-tempProjVec.y * 0.5 + 0.5) * cachedVh).toFixed(1)}px`);
        guardTagEl.style.opacity = '1';
      } else {
        guardTagEl.style.opacity = '0';
      }

      tempProjVec.set(cafePos.x, cafePos.y + 4.65, cafePos.z);
      tempProjVec.project(camera);
      if (tempProjVec.z < 1) {
        cafeTagEl.style.setProperty('--tag-x', `${((tempProjVec.x * 0.5 + 0.5) * cachedVw).toFixed(1)}px`);
        cafeTagEl.style.setProperty('--tag-y', `${((-tempProjVec.y * 0.5 + 0.5) * cachedVh).toFixed(1)}px`);
        cafeTagEl.style.opacity = '1';
      } else {
        cafeTagEl.style.opacity = '0';
      }

      tempProjVec.set(dojangPos.x, dojangPos.y + 4.75, dojangPos.z);
      tempProjVec.project(camera);
      if (tempProjVec.z < 1) {
        dojangTagEl.style.setProperty('--tag-x', `${((tempProjVec.x * 0.5 + 0.5) * cachedVw).toFixed(1)}px`);
        dojangTagEl.style.setProperty('--tag-y', `${((-tempProjVec.y * 0.5 + 0.5) * cachedVh).toFixed(1)}px`);
        dojangTagEl.style.opacity = '1';
      } else {
        dojangTagEl.style.opacity = '0';
      }

      tempProjVec.set(questBoardPos.x, questBoardPos.y + 3.85, questBoardPos.z);
      tempProjVec.project(camera);
      if (tempProjVec.z < 1) {
        questBoardTagEl.style.setProperty('--tag-x', `${((tempProjVec.x * 0.5 + 0.5) * cachedVw).toFixed(1)}px`);
        questBoardTagEl.style.setProperty('--tag-y', `${((-tempProjVec.y * 0.5 + 0.5) * cachedVh).toFixed(1)}px`);
        questBoardTagEl.style.opacity = '1';
      } else {
        questBoardTagEl.style.opacity = '0';
      }

      if (cameraTargetPosRef.current) {
        camera.position.lerp(cameraTargetPosRef.current, 0.06);
        controls.target.lerp(cameraLookAtRef.current, 0.08);
        if (camera.position.distanceTo(cameraTargetPosRef.current) < 0.15) {
          cameraTargetPosRef.current = null;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let isRubbingTouch = false;

    const spawnThoughtBubble = (charObj: any) => {
      const worldPos = new THREE.Vector3(
        charObj.rootGroup.position.x,
        charObj.rootGroup.position.y + 3.0,
        charObj.rootGroup.position.z
      );
      worldPos.project(camera);
      if (worldPos.z >= 1) return;
      const sx = (worldPos.x * 0.5 + 0.5) * window.innerWidth + (Math.random() * 44 - 22);
      const sy = (-worldPos.y * 0.5 + 0.5) * window.innerHeight;
      const list = charObj.isCloseToFinish ? FIERCE_THOUGHTS : FOOD_THOUGHTS;
      const text = list[Math.floor(Math.random() * list.length)];
      const el = document.createElement('div');
      el.className = `thought-bubble border-2 border-black rounded-full px-2.5 py-1 text-xs font-extrabold shadow-[2px_2px_0px_#18181B] whitespace-nowrap ${charObj.isCloseToFinish ? 'bg-[#FF4D8D] text-white' : 'bg-[#FFFDF7] text-black'
        }`;
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
      el.textContent = text;
      labelsContainer.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    };

    const bellySphereCenter = new THREE.Vector3();
    let lastBellyHoverCheckAt = 0;

    const getPointerHitBelly = (e: PointerEvent) => {
      pointer.x = (e.clientX / cachedVw) * 2 - 1;
      pointer.y = -(e.clientY / cachedVh) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      // คัดกรองเฉพาะตัวละครที่อยู่ใกล้เส้นสายตาเมาส์ก่อน ไม่ต้องยิง Raycast ทะลุโมเดล GLB ทั้งสนามทุกครั้งที่ขยับเมาส์!
      const candidates: THREE.Object3D[] = [];
      for (let mi = 0; mi < meshes.length; mi++) {
        const m = meshes[mi];
        if (m.isSpectator || !m.bodyMesh) continue;
        bellySphereCenter.set(
          m.rootGroup.position.x,
          m.rootGroup.position.y + 1.35,
          m.rootGroup.position.z
        );
        if (raycaster.ray.distanceSqToPoint(bellySphereCenter) <= 3.6) {
          candidates.push(m.bodyMesh);
        }
      }
      if (candidates.length === 0) return null;
      const hits = raycaster.intersectObjects(candidates, true);
      if (hits.length === 0) return null;
      let obj: THREE.Object3D | null = hits[0].object;
      while (obj && obj.userData.playerId === undefined) {
        obj = obj.parent;
      }
      if (obj?.userData.playerId === undefined) return null;
      const found = meshes.find((m) => m.id === obj!.userData.playerId) || null;
      return found && !found.isSpectator ? found : null;
    };

    const onPointerDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
      if (e.pointerType === 'touch') {
        const hitChar = getPointerHitBelly(e);
        if (hitChar) {
          isRubbingTouch = true;
          controls.enabled = false;
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const canRubMouse = e.pointerType === 'mouse' && e.buttons === 0;
      if (!canRubMouse && !isRubbingTouch) return;
      const now = performance.now();
      if (!isRubbingTouch && now - lastBellyHoverCheckAt < 55) return;
      lastBellyHoverCheckAt = now;
      const hitChar = getPointerHitBelly(e);
      if (!hitChar) return;
      hitChar.rubbedUntil = now + 750;
      if (now - hitChar.lastBubbleAt > 340) {
        hitChar.lastBubbleAt = now;
        spawnThoughtBubble(hitChar);
      }
      const lastRubSent = lastRubBroadcastRef.current[hitChar.id] || 0;
      if (now - lastRubSent > 1400) {
        lastRubBroadcastRef.current[hitChar.id] = now;
        const meActor = playersRef.current.find((pl) => pl.id === currentUserIdRef.current);
        broadcastRealtimeEvent('belly_rub', {
          targetUserId: hitChar.id,
          actorId: currentUserIdRef.current,
          actorName: meActor?.name || '',
          actorEmoji: meActor?.emoji || '🤚',
        });
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isRubbingTouch) {
        isRubbingTouch = false;
        controls.enabled = true;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      // คลิกเก็บเหรียญทองนำโชค 3D บนชายหาด! (+10 💰)
      const visibleCoins = beachCoins.filter((bc) => bc.group.visible).map((bc) => bc.group);
      if (visibleCoins.length > 0) {
        const coinHits = raycaster.intersectObjects(visibleCoins, true);
        if (coinHits.length > 0) {
          const cIdx = coinHits[0].object.userData.beachCoinIndex;
          const targetCoin = beachCoins.find((bc) => bc.index === cIdx);
          if (targetCoin) {
            collectBeachCoinObj(targetCoin);
            return;
          }
        }
      }

      if (walkingSpectatorIdRef.current !== null) {
        const groundHits = raycaster.intersectObject(island, false);
        if (groundHits.length > 0) {
          const pHit = groundHits[0].point;
          const minBeachX = islandCenterX - islandW / 2 + 1.8;
          const maxBeachX = islandCenterX + islandW / 2 - 1.8;
          const maxBeachZ = islandD / 2 - 1.8;
          walkTargetRef.current = new THREE.Vector3(
            Math.max(minBeachX, Math.min(maxBeachX, pHit.x)),
            0.2,
            Math.max(-maxBeachZ, Math.min(maxBeachZ, pHit.z))
          );
        }
      }
    };

    const onPointerCancel = () => {
      isRubbingTouch = false;
      controls.enabled = true;
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointercancel', onPointerCancel);

    const handleResize = () => {
      refreshLayoutMetrics();
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      savedCameraPosRef.current = camera.position.clone();
      cameraLookAtRef.current.copy(controls.target);
      trackMarkers.forEach((tm) => {
        tm.parts.group.userData.disposed = true;
      });
      meshes.forEach((m) => {
        m.rootGroup.userData.disposed = true;
        if (m.petParts) m.petParts.petGroup.userData.disposed = true;
        if (m.isSpectator) {
          savedSpectatorPosRef.current[m.id] = {
            x: m.rootGroup.position.x,
            y: m.rootGroup.position.y,
            z: m.rootGroup.position.z,
            rotY: m.rootGroup.rotation.y,
          };
        }
      });
      try {
        localStorage.setItem('waist_spectator_positions', JSON.stringify(savedSpectatorPosRef.current));
      } catch {
        // ignore
      }
      cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      disposeObject3D(scene);
      clearTimeout(readyTimer);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playersLoadedOnce, sceneSignature, pairedActivities, currentUserId, qualityMode]);

  const loadFeedbackItems = useCallback(async () => {
    setLoadingFeedback(true);
    try {
      const res = await fetch('/api/feedback', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setFeedbackItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch {
      // ignore transient error
    } finally {
      setLoadingFeedback(false);
    }
  }, []);

  const openFeedbackModal = useCallback(() => {
    setFeedbackError('');
    setIsFeedbackOpen(true);
    void loadFeedbackItems();
  }, [loadFeedbackItems]);

  const getDeviceSummary = () => {
    if (typeof window === 'undefined') return '';
    const ua = navigator.userAgent || '';
    const isIpad = /iPad|Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    const isMobile = /iPhone|Android.*Mobile|Mobile/i.test(ua);
    const kind = isIpad ? 'iPad/Tablet' : isMobile ? 'Mobile' : 'Desktop';
    return `${kind} (${window.innerWidth}×${window.innerHeight})`;
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError('');
    if (feedbackMessage.trim().length < 3) {
      setFeedbackError('กรุณาพิมพ์รายละเอียดอย่างน้อย 3 ตัวอักษรครับ');
      return;
    }
    setSubmittingFeedback(true);
    try {
      const me = playersRef.current.find((pl) => pl.id === currentUserId);
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: me ? me.id : null,
          userName: me ? me.name : 'ผู้เล่นนิรนาม',
          userEmoji: me ? me.emoji : '💬',
          category: feedbackCategory,
          message: feedbackMessage.trim(),
          deviceInfo: getDeviceSummary(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedbackError(data.error || 'ส่งไม่สำเร็จ');
      } else {
        setFeedbackMessage('');
        await loadFeedbackItems();
        if (data.bonusEarned > 0) {
          confetti({ particleCount: 55, spread: 60, origin: { y: 0.6 } });
          showToast(
            '💬',
            `ขอบคุณที่แจ้ง Beta Feedback! (+${data.bonusEarned} 💰)`,
            `รับโบนัส +${data.bonusEarned} Gacha เข้ากระเป๋าเรียบร้อย!`
          );
          await fetchArenaData({ force: true });
        } else {
          showToast('💬', 'ส่ง Beta Feedback สำเร็จ!', 'ขอบคุณที่ช่วยพัฒนาเกมให้ดียิ่งขึ้นครับ!');
        }
        setFeedbackTab('board');
      }
    } catch {
      setFeedbackError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleToggleFeedbackStatus = async (id: number, currentStatus: 'open' | 'resolved') => {
    const nextStatus = currentStatus === 'resolved' ? 'open' : 'resolved';
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (res.ok) {
        setFeedbackItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: nextStatus } : it))
        );
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteFeedback = async (id: number) => {
    try {
      const res = await fetch('/api/feedback', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' }),
      });
      if (res.ok) {
        setFeedbackItems((prev) => prev.filter((it) => it.id !== id));
      }
    } catch {
      // ignore
    }
  };

  const handleSendGiftItem = async (item: ShopItem) => {
    if (!currentUserId || currentUserId <= 0 || !giftTargetPlayer || sendingGiftId) return;
    setGiftError('');
    setSendingGiftId(item.id);
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          recipientId: giftTargetPlayer.id,
          itemId: item.id,
          giftMessage: giftMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGiftError(data.error || 'ส่งของขวัญไม่สำเร็จ');
      } else {
        confetti({ particleCount: 90, spread: 80, origin: { y: 0.58 } });
        const msgSuffix = data.giftMessage ? ` ("${data.giftMessage}")` : '';
        showToast(
          '🎁',
          `ส่งของขวัญให้ ${data.recipientName} สำเร็จ!`,
          `ส่ง ${item.icon} ${item.name} เข้าตู้เสื้อผ้าเพื่อนเรียบร้อยแล้ว!${msgSuffix}`
        );
        setGiftMessage('');
        setGiftTargetPlayer(null);
        await fetchArenaData({ force: true });
        broadcastArenaSync('gift_sent', {
          actorId: currentUserId,
          actorName: data.senderName || '',
          actorEmoji: data.senderEmoji || '🎁',
          detail: `ส่งของขวัญ ${item.icon} ${item.name} ให้ ${data.recipientEmoji || ''} ${data.recipientName}!${msgSuffix}`,
        });
      }
    } catch {
      setGiftError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSendingGiftId(null);
    }
  };

  // Auto-claim daily +10 GP login bonus once per day when entering the arena
  useEffect(() => {
    if (!initialArenaReady || !currentUserId || currentUserId <= 0) return;
    const me = players.find((p) => p.id === currentUserId);
    if (!me || me.checkedInToday) return;
    if (autoCheckinTriedRef.current.has(me.id)) return;
    autoCheckinTriedRef.current.add(me.id);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: me.id, type: 'daily_checkin' }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.28 } });
        showToast(
          '🎁',
          `รับโบนัสเข้าเกมรายวัน +${data.earned} 💰!`,
          `สะสมเป็น ${data.points} 💰 แล้ว! (รีเซ็ตใหม่ทุกวัน 07:00 น.)`
        );
        await fetchArenaData({ force: true });
      } catch {
        // Silent fail for automatic login bonus
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialArenaReady, currentUserId, players]);

  claimBeachCoinRef.current = async (slotId: number, spawnToken: string) => {
    const uid = currentUserIdRef.current;
    if (!uid || uid <= 0) {
      claimedTokensRef.current.delete(spawnToken);
      showToast('💰', 'เข้าสู่ระบบเพื่อแย่งเหรียญ!', 'ล็อกอินหรือสร้างตัวละครก่อน แล้วมาร่วมศึกชิงเหรียญพักเที่ยงได้เลย!');
      return;
    }
    if (claimingCoinRef.current) return;
    claimingCoinRef.current = true;
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, type: 'beach_coin', slotId, spawnToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('⚡', 'ช้าไปเสี้ยววินาที!!', data.error || 'เพื่อนแย่งเก็บเหรียญนี้ตัดหน้าไปแล้ว!');
      } else {
        lunchCoinsRef.current = lunchCoinsRef.current.filter((c) => c.spawnToken !== spawnToken);
        confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 } });
        showToast(
          '💰',
          `ชิงเหรียญพักเที่ยงสำเร็จ! (+${data.earned} 💰)`,
          `มือไวสุดในสนาม! สะสมรวมเป็น ${data.points} 💰 แล้ว!`
        );
        broadcastRealtimeEvent('coin_claimed', {
          slotId,
          spawnToken,
          winnerId: uid,
          winnerName: data.winnerName || '',
          winnerEmoji: data.winnerEmoji || '⚡',
        });
        await fetchArenaDataRef.current({ force: true });
      }
    } catch {
      claimedTokensRef.current.delete(spawnToken);
    } finally {
      claimingCoinRef.current = false;
    }
  };

  const handleAdminStepTargetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSeason) return;
    setAdminStepError('');
    setSavingAdminStep(true);
    try {
      const targetNum = Math.round(Number(adminStepTargetInput));
      if (Number.isNaN(targetNum) || targetNum < 1000) {
        setAdminStepError('กรุณากรอกเป้าก้าวเดินอย่างน้อย 1,000 ก้าว');
        return;
      }
      const res = await fetch('/api/seasons', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPin: adminPinInput,
          seasonId: activeSeason.id,
          stepTarget: targetNum,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdminStepError(data.error || 'อัปเดตเป้าก้าวเดินไม่สำเร็จ');
      } else {
        setIsStepAdminOpen(false);
        setAdminPinInput('');
        showToast(
          '👟',
          'อัปเดตเป้าก้าวเดินซีซั่นแล้ว!',
          `ตั้งเป้า Step Challenge ใหม่เป็น ${targetNum.toLocaleString()} ก้าวเรียบร้อย`
        );
        await fetchArenaData({ force: true });
      }
    } catch {
      setAdminStepError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSavingAdminStep(false);
    }
  };

  useEffect(() => {
    setSyncKey('');
    setShowSyncKey(false);
    setTodaySyncedSteps(0);
  }, [currentUserId]);

  useEffect(() => {
    if (!isLogOpen) {
      setOcrResult(null);
      setOcrPreviewUrl('');
      setConfirmRotateKey(false);
      setCopiedSyncField(null);
      setShowSyncKey(false);
      return;
    }
    const targetUid = currentUserId;
    if (!targetUid || targetUid <= 0) return;

    let cancelled = false;
    setLoadingSyncStatus(true);
    const qSeason = activeSeason?.id ? `&seasonId=${activeSeason.id}` : '';
    fetch(`/api/health-sync?userId=${targetUid}&viewerId=${targetUid}${qSeason}`, {
      cache: 'no-store',
    })
      .then(async (r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => {
        if (cancelled || !d) return;
        if (typeof d.syncKey === 'string') setSyncKey(d.syncKey);
        if (typeof d.todaySyncedSteps === 'number') setTodaySyncedSteps(d.todaySyncedSteps);
      })
      .catch(() => {
        // ignore transient error
      })
      .finally(() => {
        if (!cancelled) setLoadingSyncStatus(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLogOpen, currentUserId, activeSeason?.id]);

  const handleCopySyncText = async (text: string, field: 'key' | 'url') => {
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopiedSyncField(field);
      setTimeout(() => {
        setCopiedSyncField((cur) => (cur === field ? null : cur));
      }, 2400);
      showToast(
        '📋',
        field === 'url' ? 'คัดลอก URL พร้อมคีย์แล้ว!' : 'คัดลอก Sync Key แล้ว!',
        field === 'url'
          ? 'นำไปวางในช่อง URL ของแอปคำสั่งลัด (Shortcuts) บน iPhone ได้เลย'
          : 'เก็บรหัสนี้ไว้เป็นส่วนตัวสำหรับซิงก์ก้าวเดินของคุณ'
      );
    } catch {
      setModalError('คัดลอกอัตโนมัติไม่สำเร็จ กรุณากดดูรหัสแล้วคัดลอกด้วยตัวเอง');
    }
  };

  const handleRotateSyncKey = async () => {
    const activeUid = currentUserId || selectedPlayerId;
    if (!activeUid) return;
    if (!confirmRotateKey) {
      setConfirmRotateKey(true);
      setTimeout(() => setConfirmRotateKey(false), 4500);
      return;
    }
    setRotatingSyncKey(true);
    setModalError('');
    try {
      const res = await fetch('/api/health-sync', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: activeUid, isSelf: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'สุ่มเปลี่ยนรหัสไม่สำเร็จ');
      } else {
        setSyncKey(String(data.syncKey || ''));
        setShowSyncKey(true);
        setConfirmRotateKey(false);
        showToast(
          '🔄',
          'สุ่มรหัส Sync Key ใหม่เรียบร้อย!',
          'อย่าลืมอัปเดต URL หรือรหัสใหม่ในแอป Apple Shortcuts ของคุณด้วยนะครับ'
        );
      }
    } catch {
      setModalError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setRotatingSyncKey(false);
    }
  };

  const compressImageForOcr = async (
    file: File
  ): Promise<{ dataUrl: string; mimeType: string } | null> => {
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('decode_failed'));
        el.src = objectUrl;
      });
      const maxDim = 1440;
      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;
      if (!width || !height) return null;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.max(1, Math.round(width * ratio));
        height = Math.max(1, Math.round(height * ratio));
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      return { dataUrl, mimeType: 'image/jpeg' };
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleHealthScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const activeUid = currentUserId || selectedPlayerId;
    setModalError('');
    setOcrScanning(true);
    setOcrResult(null);

    try {
      const compressed = await compressImageForOcr(file);
      let res: Response;
      if (compressed) {
        setOcrPreviewUrl(compressed.dataUrl);
        res = await fetch('/api/health-sync/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: compressed.dataUrl,
            mimeType: compressed.mimeType,
            fileName: file.name,
            userId: activeUid,
            seasonId: activeSeason?.id,
          }),
        });
      } else {
        if (file.size > 4.2 * 1024 * 1024) {
          setModalError(
            'ไฟล์รูปภาพมีขนาดใหญ่เกินไปและเบราว์เซอร์ย่อรูปไม่ได้ กรุณาแคปหน้าจอเป็นไฟล์ JPG/PNG ขนาดไม่เกิน 4MB'
          );
          return;
        }
        const fd = new FormData();
        fd.append('file', file);
        if (activeUid) fd.append('userId', String(activeUid));
        if (activeSeason?.id) fd.append('seasonId', String(activeSeason.id));
        res = await fetch('/api/health-sync/ocr', {
          method: 'POST',
          body: fd,
        });
      }

      const rawText = await res.text();
      let data: Record<string, unknown> | null = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        if (res.status === 413) {
          setModalError('ขนาดไฟล์รูปภาพใหญ่เกินเพดานเซิร์ฟเวอร์ กรุณาเลือกภาพแคปหน้าจอที่เล็กลง');
          return;
        }
        if (res.status === 504) {
          setModalError('ระบบ AI ใช้เวลาประมวลผลนานเกินกำหนด กรุณากดลองใหม่อีกครั้งหรือพิมพ์ก้าวเอง');
          return;
        }
        setModalError('อ่านผลลัพธ์จากระบบ AI ไม่สำเร็จ กรุณาลองใหม่อีกครั้งหรือพิมพ์ตัวเลขก้าวเอง');
        return;
      }
      if (!res.ok || !data?.success) {
        setModalError(
          (typeof data?.error === 'string' && data.error) ||
          'อ่านตัวเลขก้าวจากรูปไม่สำเร็จ กรุณาลองรูปอื่นหรือพิมพ์ตัวเลขเอง'
        );
        return;
      }

      const detectedSteps = Number(data.steps || 0);
      if (typeof data.todaySyncedSteps === 'number') {
        setTodaySyncedSteps(data.todaySyncedSteps);
      }
      setStepInputMode('daily_sync');
      setStepSyncSource('ocr_screenshot');
      setStepInput(String(detectedSteps));
      setOcrResult({
        steps: detectedSteps,
        appName: String(data.appName || ''),
        dateHint: String(data.dateHint || ''),
      });
    } catch {
      setModalError('เชื่อมต่อระบบ AI อ่านรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setOcrScanning(false);
    }
  };

  const handleWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    const activeUserId = currentUserId || selectedPlayerId;
    const isStepSubmission = logTab === 'steps';
    const trimmedStepStr = stepInput.trim();
    if (isStepSubmission && (!trimmedStepStr || !/^\d+$/.test(trimmedStepStr))) {
      setModalError('กรุณากรอกจำนวนก้าวเดินเป็นตัวเลขจำนวนเต็ม');
      return;
    }

    setSubmitting(true);
    try {
      const payload = isStepSubmission
        ? {
          userId: activeUserId,
          isSelf: true,
          logType: 'steps',
          steps: trimmedStepStr,
          stepMode: stepInputMode,
          syncSource:
            stepInputMode === 'daily_sync'
              ? stepSyncSource
              : stepInputMode === 'set'
                ? 'manual_set'
                : 'manual_add',
          excuseTag: '',
        }
        : {
          userId: activeUserId,
          isSelf: true,
          logType: 'side_goal',
          weight: parseFloat(newWeightInput),
          value: parseFloat(newWeightInput),
          excuseTag: '',
        };

      const res = await fetch('/api/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'เกิดข้อผิดพลาด');
      } else {
        const divs: Array<{
          userId: number;
          name: string;
          emoji: string;
          kind: 'cheer' | 'tempt';
          payout: number;
          jackpot?: boolean;
        }> = Array.isArray(data.dividends) ? data.dividends : [];

        if (typeof data.todaySyncedSteps === 'number') {
          setTodaySyncedSteps(data.todaySyncedSteps);
        }

        if (data.alreadySynced) {
          showToast(
            '✅',
            'ยอดก้าววันนี้ซิงก์ครบแล้ว!',
            data.roast || 'ยังไม่มีก้าวเดินเพิ่มขึ้นจากรอบที่ซิงก์ก่อนหน้าในวันนี้'
          );
          setIsLogOpen(false);
          setStepInput('');
          setPinInput('');
          await fetchArenaData({ force: true });
          return;
        }

        if (data.earnedPoints > 0 || (isStepSubmission ? data.diff > 0 : data.diff < 0)) {
          confetti({ particleCount: 85, spread: 72, origin: { y: 0.6 } });
        }

        const cheerWinners = divs.filter((d) => d.kind === 'cheer');
        const temptWinners = divs.filter((d) => d.kind === 'tempt');
        if (cheerWinners.length > 0) {
          const names = cheerWinners.map((w) => `${w.emoji}${w.name} (+${w.payout}💰)`).join(', ');
          showToast(
            '🤝',
            `คุณรับ +${data.earnedPoints} 💰 & แจกปันผลวงแชร์!`,
            `กองเชียร์รับปันผลไปด้วย: ${names}`
          );
        } else if (temptWinners.length > 0) {
          const names = temptWinners.map((w) => `${w.emoji}${w.name} (+${w.payout}💰)`).join(', ');
          showToast(
            '😈',
            'พลาดท่าให้สายมารขุนพุง!!',
            `แก๊งแกล้งเพื่อนรับทรัพย์ไปเต็มๆ: ${names}`
          );
        } else if (data.earnedPoints > 0) {
          showToast(
            '💰',
            `${isStepSubmission ? 'บันทึกก้าวเดินสำเร็จ!' : 'อัปเดตภารกิจรองสำเร็จ!'} รับ +${data.earnedPoints} 💰`,
            data.dailyLogBonus > 0
              ? `รวมโบนัสส่งผลรายวัน +${data.dailyLogBonus} 💰 แล้ว! (มีทั้งหมด ${data.points} 💰)`
              : data.roast || 'พุ่งเข้าใกล้เส้นชัยไปอีกขั้น!'
          );
        } else {
          showToast(
            isStepSubmission ? '👟' : '⚖️',
            isStepSubmission ? 'อัปเดตก้าวเดินแล้ว!' : 'อัปเดตภารกิจรองแล้ว!',
            data.roast || 'บันทึกค่าล่าสุดเรียบร้อย!'
          );
        }

        setIsLogOpen(false);
        setStepInput('');
        setPinInput('');
        await fetchArenaData({ force: true });
        const actor = playersRef.current.find((pl) => pl.id === activeUserId);
        broadcastArenaSync('weight_logged', {
          actorId: activeUserId,
          actorName: actor?.name || '',
          actorEmoji: actor?.emoji || '⚡',
          dividends: divs,
        });
        setTimeout(() => focusOnCharacter(activeUserId), 300);
      }
    } catch {
      setModalError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlockOrEquipItem = async (itemId: string) => {
    const targetUid = editingPlayerId || currentUserId;
    if (!targetUid) return;
    const res = await fetch('/api/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUid, itemId }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'ทำรายการร้านค้าไม่สำเร็จ');
    }
    await fetchArenaData({ force: true });
    broadcastArenaSync('shop_updated', { actorId: targetUid });
  };

  const handleSpinGacha = async (count: 1 | 8 = 1) => {
    const targetUid = editingPlayerId || currentUserId;
    if (!targetUid) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนหมุนGacha');
    }
    const res = await fetch('/api/gacha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUid, count }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'หมุนGachaไม่สำเร็จ');
    }
    const results: Array<{ item: ShopItem; isDuplicate: boolean; refundPoints: number }> =
      Array.isArray(data.results)
        ? data.results
        : data.wonItem
          ? [{ item: data.wonItem, isDuplicate: false, refundPoints: 0 }]
          : [];
    await fetchArenaData({ force: true });
    broadcastArenaSync('shop_updated', {
      actorId: targetUid,
      detail:
        results.length > 1
          ? `🌟 อัญเชิญGacha ×${results.length} ได้ ${data.wonItem?.icon || ''} ${data.wonItem?.name || ''} และอีก ${results.length - 1} ชิ้น!`
          : `🎰 สุ่มGachaได้ ${data.wonItem?.icon || ''} ${data.wonItem?.name || ''}!`,
    });
    return results;
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError('');
    setSigningIn(true);
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: signInUsername }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSignInError(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
      } else if (data.exists && data.user) {
        localStorage.setItem('waist_user_id', String(data.user.id));
        setCurrentUserId(data.user.id);
        setBoardSenderId(String(data.user.id));
        const shouldWalk = Boolean(data.user.isRoaming || data.user.role === 'spectator');
        setWalkingSpectatorId(shouldWalk ? data.user.id : null);
        setSelectedPlayerId(data.user.id);
        setSignInUsername('');
        await fetchArenaData({ force: true, viewerId: data.user.id });
        showToast(
          '👋',
          'เข้าสู่ระบบสำเร็จ!',
          shouldWalk
            ? `ยินดีต้อนรับ ${data.user.emoji} ${data.user.name} — ป้ายยังปักจองลู่อยู่ เดินเล่นต่อได้เลย!`
            : `ยินดีต้อนรับกลับมา ${data.user.emoji} ${data.user.name}`
        );
        setTimeout(() => focusOnCharacter(data.user.id), 250);
      } else {
        openCreateModal();
        setJoinName(data.username || signInUsername.trim());
      }
    } catch {
      setSignInError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('waist_user_id');
    setCurrentUserId(null);
    setWalkingSpectatorId(null);
    setSignInUsername('');
    setSignInError('');
    setPlayers((prev) =>
      prev.map((pl) => ({
        ...pl,
        startWeight: undefined,
        currentWeight: undefined,
        goalWeight: undefined,
        bodyWeight: undefined,
        heightCm: undefined,
        gender: undefined,
        startVal: undefined,
        currentVal: undefined,
        targetVal: undefined,
        diffLabel: undefined,
      }))
    );
    void fetchArenaData({ force: true, viewerId: 0 });
  };

  const handleToggleRoam = async () => {
    if (!currentUserId || currentUserId <= 0 || togglingRoam) return;
    const me = playersRef.current.find((pl) => pl.id === currentUserId);
    if (!me) return;
    const nextRoam = !Boolean(me.isRoaming);
    setTogglingRoam(true);

    if (!nextRoam) {
      delete savedSpectatorPosRef.current[me.id];
      delete remoteSpectatorStateRef.current[me.id];
      try {
        localStorage.setItem(
          'waist_spectator_positions',
          JSON.stringify(savedSpectatorPosRef.current)
        );
      } catch {
        // ignore
      }
    }

    setPlayers((prev) =>
      prev.map((pl) => (pl.id === me.id ? { ...pl, isRoaming: nextRoam } : pl))
    );
    setWalkingSpectatorId(nextRoam ? me.id : null);

    try {
      const res = await fetch('/api/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: me.id,
          isSelf: true,
          roamOnly: true,
          isRoaming: nextRoam,
        }),
      });
      if (!res.ok) {
        throw new Error('toggle failed');
      }
      await fetchArenaData({ force: true });
      broadcastArenaSync('roam_toggled', {
        actorId: me.id,
        actorName: me.name,
        actorEmoji: me.emoji,
        detail: nextRoam
          ? 'ปักป้ายจองที่ในลู่ แล้วออกมาเดินเล่นริมหาด!'
          : 'เก็บป้ายกลับเข้าลู่วิ่งแล้ว!',
      });
      showToast(
        nextRoam ? '🚩' : '🏃',
        nextRoam ? 'ปักป้ายจองที่ในลู่แล้ว!' : 'เก็บป้ายกลับเข้าลู่แล้ว!',
        nextRoam
          ? 'ใช้ปุ่ม WASD / ลูกศร หรือแตะพื้นหาดทรายเพื่อเดินเล่น ชวนเพื่อน หรือเก็บเหรียญเที่ยงได้เลย! (อัปเกรดป้ายสวยๆ ได้ในร้านค้า)'
          : 'ตัวละครกลับเข้าไปวิ่งประจำตำแหน่งในลู่เรียบร้อย!'
      );
      setTimeout(() => focusOnCharacter(me.id), 140);
    } catch {
      await fetchArenaData({ force: true });
      showToast('❌', 'สลับโหมดเดินเล่นไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setTogglingRoam(false);
    }
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoining(true);

    try {
      const isEdit = joinMode === 'edit' && editingPlayerId !== null;
      const isSelf = isEdit && editingPlayerId === currentUserId;
      const isCumulativeGoal =
        joinGoalType === 'reps_accumulate' || joinGoalType === 'distance_accumulate';
      const effectiveStartStr = joinStart || (!isCumulativeGoal ? joinBodyWeight : '');
      const effectiveBodyWeightStr = joinBodyWeight || (!isCumulativeGoal ? joinStart : '');
      const payloadCommon = {
        name: joinName,
        avatarEmoji: joinEmoji,
        colorHex: joinColor,
        accessory: joinAccessory,
        bandColor: joinBandColor,
        role: 'competitor',
        workoutType: joinWorkout,
        petType: joinPet,
        statusText: joinStatus,
        species: resolveBreedOption(joinSpecies).category,
        breed: joinSpecies,
        themeId: joinThemeId,
        equipHat: joinEquipHat,
        equipFace: joinEquipFace,
        equipArmor: joinEquipArmor,
        equipWeapon: joinEquipWeapon,
        equipWings: joinEquipWings,
        equipAura: joinEquipAura,
        equipPetGear: joinEquipPetGear,
        equipMount: joinEquipMount,
        equipMarker: joinEquipMarker,
        propColors: joinPropColors,
        goalType: joinGoalType,
        bodyWeight: effectiveBodyWeightStr ? parseFloat(effectiveBodyWeightStr) : 0,
        heightCm: joinHeightCm ? parseFloat(joinHeightCm) : 0,
        gender: joinGender,
        startVal: effectiveStartStr ? parseFloat(effectiveStartStr) : 0,
        targetVal: joinGoal ? parseFloat(joinGoal) : 0,
        startWeight: effectiveStartStr ? parseFloat(effectiveStartStr) : 0,
        goalWeight: joinGoal ? parseFloat(joinGoal) : 0,
      };
      const res = await fetch('/api/users', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? {
              ...payloadCommon,
              userId: editingPlayerId,
              isSelf,
              pinCode: joinPin,
            }
            : {
              ...payloadCommon,
              pinCode: joinPin || '1234',
            }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || (isEdit ? 'อัปเดตไม่สำเร็จ' : 'สมัครไม่สำเร็จ'));
      } else {
        const activeId = !isEdit && data.id ? Number(data.id) : editingPlayerId;
        if (!isEdit && data.id) {
          localStorage.setItem('waist_user_id', String(data.id));
          setCurrentUserId(Number(data.id));
          setBoardSenderId(String(data.id));
          setSelectedPlayerId(Number(data.id));
        }
        confetti({ particleCount: isEdit ? 45 : 70, spread: 60, origin: { y: 0.6 } });
        showToast(
          isEdit ? '✨' : '🏁',
          isEdit ? 'อัปเดตโปรไฟล์เรียบร้อย!' : 'ลงทะเบียนสำเร็จ!',
          isEdit
            ? `บันทึกข้อมูลของ ${joinEmoji} ${joinName} เรียบร้อยแล้ว!`
            : joinRole === 'spectator'
              ? `ยินดีต้อนรับผู้ชม ${joinEmoji} ${joinName} สู่ขอบสนาม!`
              : `ยินดีต้อนรับ ${joinEmoji} ${joinName} เข้าสู่สนาม 3D!`
        );
        const submittedName = joinName;
        const submittedEmoji = joinEmoji;
        const submittedRole = joinRole;
        const prevPlayer = isEdit ? playersRef.current.find((pl) => pl.id === editingPlayerId) : null;
        const roleSwitched = Boolean(prevPlayer && prevPlayer.role !== submittedRole);

        setIsJoinOpen(false);
        setJoinName('');
        setJoinPin('');
        setJoinStart('');
        setJoinGoal('');
        setJoinBodyWeight('');
        setJoinHeightCm('');
        await fetchArenaData({ force: true });

        broadcastArenaSync(isEdit ? 'user_updated' : 'user_created', {
          actorId: activeId,
          actorName: submittedName,
          actorEmoji: submittedEmoji,
          detail: !isEdit
            ? submittedRole === 'spectator'
              ? 'เข้าร่วมเป็นผู้ชมขอบสนามแล้ว!'
              : 'ลงสนามเป็นผู้เข้าแข่งขันคนใหม่!'
            : roleSwitched
              ? submittedRole === 'spectator'
                ? 'สลับบทบาทเป็นผู้ชมขอบสนาม!'
                : 'เปลี่ยนบทบาทลงลู่เป็นผู้เข้าแข่งขัน!'
              : 'อัปเดตชุดและตัวละครใหม่แล้ว!',
        });
      }
    } catch {
      setJoinError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setJoining(false);
    }
  };

  const handleBoardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardTargetId) return;
    const effectiveSenderId =
      currentUserId && currentUserId > 0
        ? currentUserId
        : boardSenderId
          ? Number(boardSenderId)
          : null;
    if (effectiveSenderId && effectiveSenderId === boardTargetId) {
      showToast('🚫', 'ส่งให้ตัวเองไม่ได้นะ!', 'เลือกคลิกตัวละครเพื่อนคนอื่นเพื่อเติมไฟหรือแกล้งเพื่อน 🔥');
      return;
    }
    setSendingBoard(true);
    try {
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: effectiveSenderId,
          targetUserId: boardTargetId,
          kind: boardKind,
          message: boardMessage,
        }),
      });
      const data = await res.json();
      if (res.ok && data.interaction) {
        const inter = data.interaction;
        const bonusTxt =
          inter.senderBonusEarned > 0 ? ` (รับโบนัส +${inter.senderBonusEarned} 💰!)` : '';
        setBoardMessage('');
        setRoastFeed((prev) => [
          {
            id: `i-${inter.id}`,
            type: inter.kind,
            user: inter.senderName,
            emoji: inter.senderEmoji,
            targetName: inter.targetName,
            targetEmoji: inter.targetEmoji,
            giftItem: inter.giftItem,
            roast: inter.message || '',
            time: new Date().toISOString(),
          },
          ...prev,
        ]);
        pendingDeliveryRef.current = {
          targetId: inter.targetUserId,
          kind: inter.kind,
          label: `${inter.kind === 'cheer' ? '🔥' : '😈'} ${inter.giftItem}`,
          startTime: performance.now(),
        };
        broadcastRealtimeEvent('interaction', inter);
        const nextNet = typeof inter.netPower === 'number' ? inter.netPower : null;
        if (inter.kind === 'cheer') {
          confetti({
            particleCount: nextNet && nextNet >= 6 ? 100 : 50,
            spread: nextNet && nextNet >= 6 ? 80 : 55,
            origin: { y: 0.65 },
          });
          if (nextNet === 6) {
            showToast('⚡', `${inter.targetName} แปลงร่าง SUPER SAIYAN!!`, `พลังไฟทะลุ +6!${bonusTxt}`);
          } else if (nextNet === 3) {
            showToast('🔥', `${inter.targetName} ติดโหมดไฟบูสต์!!`, `เติมไฟครบ +3!${bonusTxt}`);
          } else {
            showToast(
              '🔥',
              `เติมไฟลงขันแชร์ให้ ${inter.targetName}! (+1)`,
              `ส่ง ${inter.giftItem}${bonusTxt} • ถ้าเพื่อนทำแต้มได้ รับปันผลอีก!`
            );
          }
        } else {
          if (nextNet === -6) {
            showToast('🩷', `${inter.targetName} กลายร่างเป็นจอมมารบู!!`, `โดนขุนของกินครบ -6!${bonusTxt}`);
          } else if (nextNet === -3) {
            showToast('💤', `${inter.targetName} ขยายร่างเป็นคาบิก้อน!!`, `โดนส่ง ${inter.giftItem} จนพุงป่อง (-3)!${bonusTxt}`);
          } else {
            showToast(
              '😈',
              `ส่งของกินดักทาง ${inter.targetName}! (-1)`,
              `ล่อด้วย ${inter.giftItem}${bonusTxt} • ถ้าเพื่อนถอยหลัง รับทรัพย์ทันที!`
            );
          }
        }
        // ซิงก์สถานะร่างแปลง 3D ทันทีเมื่อลูกไฟ/ไรเดอร์พุ่งถึงตัวละคร
        setTimeout(() => {
          fetchArenaDataRef.current({ force: true });
        }, 1150);
        setActionTargetPlayer(null);
        focusOnCharacter(inter.targetUserId);
      } else if (data?.error) {
        showToast('🚫', 'ส่งไม่สำเร็จ', data.error);
      }
    } catch {
      showToast('❌', 'ส่งไม่สำเร็จ', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSendingBoard(false);
    }
  };

  const currentUserStatusText =
    currentUserId !== null
      ? players.find((p) => p.id === currentUserId)?.statusText || ''
      : '';

  useEffect(() => {
    if (currentUserId === null) {
      setQuickStatusInput('');
      return;
    }
    if (isEditingQuickStatusRef.current || statusSaveTimerRef.current) return;
    setQuickStatusInput(currentUserStatusText);
  }, [currentUserId, currentUserStatusText]);

  const handleQuickStatusChange = (val: string) => {
    setQuickStatusInput(val);
    const trimmed = val.trim();
    const myMesh = charMeshesRef.current.find((m) => m.id === currentUserId);
    const bubbleEl = myMesh?.tagEl?.querySelector('[data-speech-bubble]') as HTMLElement | null;
    if (bubbleEl) {
      if (trimmed) {
        bubbleEl.textContent = `💬 ${trimmed}`;
        bubbleEl.classList.remove('hidden');
      } else {
        bubbleEl.textContent = '';
        bubbleEl.classList.add('hidden');
      }
    }
    if (!currentUserId) return;
    const targetUserId = currentUserId;
    setPlayers((prev) =>
      prev.map((p) => (p.id === targetUserId ? { ...p, statusText: trimmed } : p))
    );
    broadcastRealtimeEvent('status', { userId: targetUserId, statusText: trimmed });
    if (statusSaveTimerRef.current) clearTimeout(statusSaveTimerRef.current);
    statusSaveTimerRef.current = setTimeout(async () => {
      try {
        await fetch('/api/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: targetUserId,
            isSelf: true,
            statusText: trimmed,
          }),
        });
      } catch {
        // ignore background save failure
      } finally {
        statusSaveTimerRef.current = null;
      }
    }, 400);
  };

  const selectedPlayerObj = players.find((p) => p.id === selectedPlayerId);

  return (
    <div className={`w-full h-dvh overflow-hidden relative ${shakeScreen ? 'shake-active' : ''}`}>
      <div ref={canvasRef} className="fixed inset-0 w-full h-full z-[1] touch-none cursor-grab active:cursor-grabbing" />
      <div ref={labelsRef} className="fixed inset-0 pointer-events-none z-10 overflow-hidden" />

      <header ref={headerRef} className="fixed top-2 sm:top-3 left-2 sm:left-3 right-2 sm:right-3 pt-safe z-30 pointer-events-none flex flex-nowrap md:flex-wrap items-center justify-between gap-1.5 sm:gap-2">
        <div className="rpg-banner rounded-xl sm:rounded-2xl px-2.5 sm:px-3.5 py-1.5 sm:py-2 pointer-events-auto flex items-center gap-2 sm:gap-2.5 min-w-0">
          <div className="w-7 h-7 sm:w-9 sm:h-9 bg-amber-400 border-2 border-amber-100 rounded-lg sm:rounded-xl flex items-center justify-center text-sm sm:text-lg shadow-[0_2px_0_#422006] shrink-0">
            ⚔️
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 sm:gap-1.5 flex-nowrap sm:flex-wrap">
              <h1 className="font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-base text-amber-300 leading-none drop-shadow truncate">
                ศึกชิงบัลลังก์เอวเอส 3D
              </h1>
              <span className="hidden sm:inline bg-emerald-500 text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded">
                MMO ARENA
              </span>
              {bkkWeather && (
                <span
                  className="bg-black/45 border border-amber-400/50 text-amber-200 text-[9.5px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-0.5 sm:gap-1 shrink-0"
                  title={`สภาพอากาศกรุงเทพฯ ล่าสุด: ${bkkWeather.label} ${bkkWeather.temp}°C`}
                >
                  <span>{bkkWeather.emoji}</span>
                  <span>{bkkWeather.temp}°C</span>
                </span>
              )}
            </div>
            <p className="hidden xl:block text-[10.5px] font-semibold text-amber-100/80 mt-0.5">
              ทุก +1% รับ +15 💰 Gacha แลกเสื้อผ้า สัตว์ขี่ &amp; ป้ายจองลู่!
            </p>
          </div>
        </div>

        {/* Desktop & iPad (md+) Action Buttons + Control Bar (คงหน้าตาเดิม 100%) */}
        <div className="hidden md:flex flex-wrap items-center gap-1.5 pointer-events-auto">
          {isLunchRush && (
            <div
              className="bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 text-stone-950 border-2 border-white rounded-xl px-2.5 py-1.5 text-xs font-extrabold flex items-center gap-1 shadow-[0_2px_0_#000] animate-pulse"
              title="เปิดเฉพาะวันจันทร์–ศุกร์ เวลา 12:00–13:00 น. คลิกหรือเดินชนเหรียญทองบนหาดทราย แย่งกันรับเหรียญละ +1 💰!"
            >
              <span>💰</span>
              <span>แย่งเหรียญเที่ยง LIVE!</span>
            </div>
          )}

          {(() => {
            const currentUser = players.find((pl) => pl.id === currentUserId);
            if (!currentUser) {
              return (
                <button
                  onClick={openCreateModal}
                  className="neo-btn rpg-btn-gold font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 stroke-[2.5]" />
                  <span>+ สร้างผู้กล้า / เข้าร่วม</span>
                </button>
              );
            }
            const gMeta = getGoalTypeMeta(currentUser.goalType);
            return (
              <>
                {currentUser.role !== 'spectator' && (
                  <button
                    onClick={() => {
                      setSelectedPlayerId(currentUser.id);
                      const curVal = currentUser.currentVal ?? currentUser.currentWeight;
                      setNewWeightInput(
                        gMeta.isCumulative || curVal === undefined ? '' : String(curVal)
                      );
                      setStepInput('');
                      setStepInputMode('daily_sync');
                      setStepSyncSource('web_daily_sync');
                      setTodaySyncedSteps(currentUser.todaySyncedSteps ?? 0);
                      setLogTab('steps');
                      setModalError('');
                      setIsLogOpen(true);
                    }}
                    className="neo-btn rpg-btn-green font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                    title="บันทึกก้าวเดิน Step Challenge"
                  >
                    <Scale className="w-4 h-4 stroke-[2.5]" />
                    <span>+ ส่งก้าวเดิน</span>
                  </button>
                )}
                <button
                  onClick={() => openWardrobeModal(currentUser, 'gacha')}
                  className="neo-btn bg-gradient-to-r from-fuchsia-600 via-amber-400 to-cyan-400 text-black border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer shadow-[0_3px_0_#000]"
                  title="เปิดตู้สุ่มGachaลุ้นชุด สัตว์ขี่ และออร่าลิมิเต็ด!"
                >
                  <span>🎰</span>
                  <span className="hidden sm:inline">Gacha</span>
                </button>
                <button
                  onClick={() => openWardrobeModal(currentUser, 'armor')}
                  className="neo-btn rpg-btn-blue font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  title="เปิดหน้าต่างแต่งตัว 3D & ร้านค้า Gacha"
                >
                  <span>{currentUser.name}</span>
                  <span className="text-[10px] bg-black/50 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400">
                    💰 {currentUser.points ?? 100} GP
                  </span>
                </button>
              </>
            );
          })()}

          <div className="rpg-panel rounded-xl p-1 flex items-center gap-0.5 relative">
            <button
              onClick={() => setIsDrawerOpen((v) => !v)}
              className={`px-2 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1 ${isDrawerOpen
                  ? 'bg-amber-400/25 text-amber-200'
                  : 'text-amber-100 hover:bg-amber-400 hover:text-black'
                }`}
              title="เปิด/ปิดกระดานอันดับ"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">อันดับ</span>
            </button>
            <button
              onClick={openFeedbackModal}
              className="px-2 py-1.5 rounded-lg text-xs font-extrabold text-cyan-200 hover:bg-cyan-400 hover:text-black transition cursor-pointer flex items-center gap-1"
              title="แจ้งบั๊ก / เสนอไอเดียปรับปรุงเกม (Beta Feedback)"
            >
              <span>💬</span>
              <span className="hidden lg:inline">Feedback</span>
            </button>
            <button
              onClick={() => {
                const idx = QUALITY_MODE_OPTIONS.findIndex((o) => o.id === qualityMode);
                const next = QUALITY_MODE_OPTIONS[(idx + 1) % QUALITY_MODE_OPTIONS.length];
                handleChangeQualityMode(next.id);
                showToast('⚡', `โหมดกราฟิก: ${next.label}`, 'ปรับความละเอียดและเอฟเฟกต์ 3D เรียบร้อยแล้ว');
              }}
              className="px-2 py-1.5 rounded-lg text-xs font-extrabold text-amber-200 hover:bg-amber-400 hover:text-black transition cursor-pointer flex items-center gap-1"
              title={`สลับโหมดกราฟิก 3D (ปัจจุบัน: ${QUALITY_MODE_OPTIONS.find((o) => o.id === qualityMode)?.label || 'อัตโนมัติ'})`}
            >
              <span>⚡</span>
              <span className="text-[10px]">
                {QUALITY_MODE_OPTIONS.find((o) => o.id === qualityMode)?.short || 'Auto'}
              </span>
            </button>
            <button
              onClick={toggleMusic}
              className={`px-2 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer ${isMusicOn
                  ? 'bg-amber-400 text-black'
                  : 'text-amber-100 hover:bg-amber-400 hover:text-black'
                }`}
              title="เปิด/ปิดเพลงประกอบ"
            >
              <span>{isMusicOn ? '🔊' : '🔇'}</span>
            </button>
            {players.some((pl) => pl.id === currentUserId) && (
              <button
                onClick={handleSignOut}
                className="px-2 py-1.5 rounded-lg text-xs font-extrabold text-amber-200 hover:bg-rose-500 hover:text-white transition cursor-pointer flex items-center justify-center"
                title="ออกจากตัวละคร / สลับบัญชี"
                aria-label="ออกจากตัวละคร / สลับบัญชี"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Mobile (< md) Compact 1-Row Right Controls */}
        <div className="flex md:hidden items-center gap-1 pointer-events-auto shrink-0 relative">
          <button
            type="button"
            onClick={() => {
              setIsMobileMenuOpen(false);
              setIsDrawerOpen((v) => !v);
            }}
            className={`rpg-panel rounded-xl px-2.5 py-2 text-xs font-extrabold flex items-center gap-1 cursor-pointer ${isDrawerOpen ? 'ring-2 ring-amber-300 text-amber-300' : 'text-amber-100'
              }`}
            aria-label="เปิด/ปิดกระดานอันดับ"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((v) => !v)}
            className={`rpg-panel rounded-xl px-2.5 py-2 text-xs font-extrabold flex items-center cursor-pointer ${isMobileMenuOpen ? 'ring-2 ring-amber-300 text-amber-300' : 'text-amber-100'
              }`}
            aria-label="เมนูเพิ่มเติม"
          >
            <Menu className="w-4 h-4" />
          </button>

          {isMobileMenuOpen && (
            <div className="absolute right-0 top-12 w-56 rpg-panel rounded-2xl p-2.5 space-y-1.5 shadow-2xl z-40">
              <div className="text-[10px] font-extrabold text-amber-300/90 px-1.5 pb-1 border-b border-amber-500/30">
                ⚡ โหมดกราฟิก 3D
              </div>
              <div className="grid grid-cols-2 gap-1">
                {QUALITY_MODE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      handleChangeQualityMode(opt.id);
                      showToast('⚡', `โหมดกราฟิก: ${opt.label}`, 'ปรับความละเอียดและเอฟเฟกต์ 3D เรียบร้อย');
                    }}
                    className={`py-1.5 px-2 rounded-lg text-[10px] font-extrabold border cursor-pointer transition ${qualityMode === opt.id
                        ? 'bg-amber-400 text-black border-white'
                        : 'bg-slate-900/90 text-amber-100 border-slate-700'
                      }`}
                  >
                    {opt.short}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  openFeedbackModal();
                }}
                className="w-full text-left px-2.5 py-2 rounded-xl bg-slate-900/80 text-cyan-200 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
              >
                <span>💬</span>
                <span>แจ้งบั๊ก / Feedback</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  toggleMusic();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full text-left px-2.5 py-2 rounded-xl bg-slate-900/80 text-amber-100 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
              >
                <span>{isMusicOn ? '🔊' : '🔇'}</span>
                <span>{isMusicOn ? 'ปิดเพลงประกอบ' : 'เปิดเพลงประกอบ'}</span>
              </button>
              {players.some((pl) => pl.id === currentUserId) && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    handleSignOut();
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-xl bg-rose-950/80 text-rose-200 text-xs font-extrabold flex items-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>ออกจากตัวละคร / สลับบัญชี</span>
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Screen Alert Banner: 7-Day Quest Betting Window */}
      {(() => {
        const activeBetting = quests.filter((q) => q.isBettingOpen);
        if (activeBetting.length === 0 || betBannerDismissed || isQuestBoardOpen) return null;
        const featured = activeBetting[0];
        return (
          <div className="fixed top-[62px] md:top-[76px] left-1/2 -translate-x-1/2 z-20 max-w-[94vw] pointer-events-auto">
            <div className="flex items-center gap-2 bg-gradient-to-r from-[#5a2e0f] via-[#8b4d1d] to-[#5a2e0f] border-2 border-[#ffd86b] text-[#fff6dc] rounded-full pl-3 pr-2 py-1.5 shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
              <button
                type="button"
                onClick={() => openQuestBoard(featured.id)}
                className="flex items-center gap-2 text-left cursor-pointer hover:brightness-110 transition min-w-0"
              >
                <span className="text-base shrink-0 animate-bounce">🎲</span>
                <span className="text-[11px] sm:text-xs font-extrabold truncate max-w-[58vw] sm:max-w-[440px]">
                  <span className="text-amber-300">ช่วงวางเดิมพันเปิดแล้ว!</span> เควส &ldquo;{featured.title}&rdquo;
                  {activeBetting.length > 1 ? ` (+${activeBetting.length - 1} เควส)` : ''} • เหลือ{' '}
                  {formatCountdownTh(featured.bettingMsRemaining)}
                </span>
                <span className="hidden sm:inline-block bg-amber-300 text-amber-950 text-[10.5px] font-black px-2.5 py-0.5 rounded-full shrink-0">
                  วางเดิมพันเลย →
                </span>
              </button>
              <button
                type="button"
                onClick={() => setBetBannerDismissed(true)}
                className="w-5 h-5 rounded-full bg-black/35 hover:bg-black/60 text-amber-200 text-[10px] font-bold flex items-center justify-center cursor-pointer shrink-0"
                title="ซ่อนแถบแจ้งเตือนชั่วคราว"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })()}

      <aside
        className={`fixed top-16 md:top-20 right-2 sm:right-3 bottom-24 md:bottom-3 w-[345px] max-w-[calc(100vw-16px)] z-20 flex flex-col gap-3 transition-transform duration-300 pointer-events-none ${isDrawerOpen ? 'translate-x-0' : 'translate-x-[120%]'
          }`}
      >
        <div className="rpg-panel rounded-2xl p-3.5 pointer-events-auto flex flex-col max-h-[52%]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-amber-500/40 shrink-0 gap-1">
            <h2 className="font-[family-name:var(--font-kanit)] font-extrabold text-base text-amber-300 flex items-center gap-1.5">
              <span>🏆 อันดับ Step Challenge</span>
            </h2>
            <div className="flex items-center gap-1">
              <span
                className="text-[10px] font-extrabold bg-amber-400 text-black px-2 py-0.5 rounded-full"
                title={`เป้ารวมซีซั่น: ${(activeSeason?.stepTarget || 300000).toLocaleString()} ก้าว`}
              >
                👟 {((activeSeason?.stepTarget || 300000) / 1000).toFixed(0)}k ก้าว
              </span>
              <button
                type="button"
                onClick={() => {
                  setAdminStepTargetInput(String(activeSeason?.stepTarget || 300000));
                  setAdminPinInput('');
                  setAdminStepError('');
                  setIsStepAdminOpen(true);
                }}
                className="w-6 h-6 rounded-full bg-slate-800 hover:bg-amber-400 hover:text-black text-amber-200 border border-amber-500/60 text-[11px] flex items-center justify-center cursor-pointer transition"
                title="Admin: ปรับเป้าก้าวเดินประจำซีซั่น"
              >
                ⚙️
              </button>
            </div>
          </div>
          <div className="overflow-y-auto space-y-2 pr-1">
            {rankedPlayers.length === 0 ? (
              <p className="text-xs text-center py-4 font-bold text-amber-100/70">
                ยังไม่มีผู้กล้าในสนาม กด &quot;+ สร้างผู้กล้า&quot; ได้เลย!
              </p>
            ) : (
              rankedPlayers.map((p, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === rankedPlayers.length - 1 && rankedPlayers.length > 1;
                const pctVal = p.progressPct ?? 0;
                const gMeta = getGoalTypeMeta(p.goalType);
                const pBoost = resolvePowerBoostMeta(p.cheerCount ?? 0, p.temptCount ?? 0);

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      focusOnCharacter(p.id);
                      if (window.innerWidth < 768) setIsDrawerOpen(false);
                    }}
                    className={`rounded-xl p-2 flex items-center justify-between gap-2 cursor-pointer hover:translate-x-0.5 transition border-2 ${isFirst
                        ? 'bg-amber-500/25 border-amber-300'
                        : p.isInFoodStall || isLast
                          ? 'bg-rose-900/40 border-rose-500/60'
                          : 'bg-slate-900/80 border-slate-700'
                      }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-amber-400 text-black font-[family-name:var(--font-kanit)] font-extrabold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xl shrink-0">{p.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs text-amber-100 truncate flex items-center gap-1">
                          <span>{p.name}</span>
                          <span>{isFirst ? '👑' : isLast ? '💀' : ''}</span>
                          {p.isRoaming && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-cyan-700 text-cyan-100 border border-cyan-300 shrink-0">
                              🚩 เดินเล่น
                            </span>
                          )}
                          {p.isInFoodStall && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-600 text-amber-100 border border-amber-300 shrink-0">
                              🍖 ซุ้มอาหาร
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-semibold text-amber-200/80 flex flex-wrap items-center gap-1">
                          <span className="px-1 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold">
                            👟 {(p.stepCount ?? 0).toLocaleString()} ก้าว
                          </span>
                          {activeQuestTagByUserId[p.id] && (
                            <span className="px-1 rounded bg-amber-950/75 text-amber-200 border border-amber-500/40 truncate max-w-[140px]">
                              📜 {activeQuestTagByUserId[p.id]}
                            </span>
                          )}
                          {pBoost.netPower !== 0 && (
                            <span
                              className={`px-1.5 rounded-full border text-[9px] font-extrabold ${pBoost.badgeBgClass}`}
                            >
                              {pBoost.shortLabel}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-[family-name:var(--font-kanit)] font-extrabold text-sm ${pctVal < 0 ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                      >
                        {pctVal}%
                      </div>
                      <div className="text-[9px] font-bold text-amber-300/80">💰 {p.points ?? 100}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {walkingSpectatorId === null && (
        <div className="fixed bottom-3 left-3 z-20 pointer-events-none hidden xl:block">
          <div className="rpg-panel rounded-xl px-3 py-1.5 text-[11px] font-bold text-amber-200 flex items-center gap-1.5">
            <span>🖱️ ลากหมุน</span>
            <span>•</span>
            <span>🔍 ซูม</span>
            <span>•</span>
            <span>👆 คลิกผู้กล้า</span>
            <span>•</span>
            <span>🤚 ลูบพุง!</span>
          </div>
        </div>
      )}

      {/* Bottom-Right RPG Progress Bar HUD for Competitor (matching Reference Image 2) */}
      {(() => {
        const me = rankedPlayers.find((pl) => pl.id === currentUserId);
        if (!me) return null;
        const pct = me.progressPct ?? 0;
        const gMeta = getGoalTypeMeta(me.goalType);
        return (
          <div
            onClick={() => setActionTargetPlayer(me)}
            title="คลิกเพื่อดูเกจพลัง +/- ประจำวันของคุณ"
            className={`fixed right-3 z-20 pointer-events-auto flex-col gap-1.5 w-[300px] rpg-panel rounded-2xl p-3 cursor-pointer hover:brightness-110 transition ${walkingSpectatorId !== null
                ? 'hidden xl:flex bottom-20'
                : 'hidden lg:flex bottom-3'
              }`}
          >
            <div className="flex items-center justify-between text-xs font-extrabold text-amber-200">
              <span>
                {me.emoji} {me.name} • 👟 Step Challenge
              </span>
              <span className="text-emerald-400">{pct}%</span>
            </div>
            <div className="w-full h-3.5 bg-slate-950 border-2 border-amber-500 rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500 bg-gradient-to-r from-lime-400 via-emerald-400 to-amber-400"
                style={{ width: `${Math.max(5, Math.min(100, Math.max(0, pct)))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-100/85">
              <span>👟 {(me.stepCount ?? 0).toLocaleString()} / {(me.stepTarget ?? activeSeason?.stepTarget ?? 300000).toLocaleString()} ก้าว</span>
              {activeQuestTagByUserId[me.id] && (
                <span className="text-amber-300 truncate max-w-[180px]">
                  📜 {activeQuestTagByUserId[me.id]}
                </span>
              )}
            </div>
          </div>
        );
      })()}

      {isFeedbackOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="rpg-panel rounded-2xl max-w-lg w-full max-h-[88dvh] flex flex-col p-5 relative">
            <button
              onClick={() => setIsFeedbackOpen(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 bg-rose-600 text-white rounded-lg flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 mb-3 pr-8">
              <span className="text-3xl">💬</span>
              <div>
                <h3 className="font-[family-name:var(--font-kanit)] text-xl font-extrabold text-amber-300 leading-tight">
                  Beta Feedback &amp; เสนอไอเดีย
                </h3>
                <p className="text-xs text-amber-100/80 font-medium">
                  พบบั๊ก กระตุก หรืออยากได้สัตว์ขี่/ฟีเจอร์อะไรใหม่ แจ้งไว้ตรงนี้ได้เลย!
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                type="button"
                onClick={() => setFeedbackTab('submit')}
                className={`py-2 rounded-xl text-xs font-extrabold border-2 cursor-pointer transition ${feedbackTab === 'submit'
                    ? 'bg-amber-400 text-black border-white'
                    : 'bg-slate-900/80 text-amber-100 border-slate-700'
                  }`}
              >
                ✍️ ส่งเรื่อง (+5 💰/วัน)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFeedbackTab('board');
                  void loadFeedbackItems();
                }}
                className={`py-2 rounded-xl text-xs font-extrabold border-2 cursor-pointer transition ${feedbackTab === 'board'
                    ? 'bg-cyan-400 text-black border-white'
                    : 'bg-slate-900/80 text-amber-100 border-slate-700'
                  }`}
              >
                📋 กระดานติดตาม ({feedbackItems.length})
              </button>
            </div>

            {feedbackTab === 'submit' ? (
              <form onSubmit={handleFeedbackSubmit} className="space-y-3 overflow-y-auto pr-1">
                <div>
                  <label className="block text-xs font-bold text-amber-200 mb-1.5">
                    เลือกหมวดหมู่
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'bug', label: '🐛 แจ้งบั๊ก/กระตุก' },
                        { id: 'idea', label: '💡 เสนอไอเดีย' },
                        { id: 'cosmetic', label: '🎨 พรอพ/สัตว์ขี่' },
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFeedbackCategory(cat.id)}
                        className={`py-2 px-2 rounded-xl border-2 text-[11px] font-extrabold cursor-pointer transition ${feedbackCategory === cat.id
                            ? 'bg-amber-400 text-black border-white'
                            : 'bg-slate-900 text-amber-100 border-slate-700'
                          }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-amber-200 mb-1">
                    รายละเอียดปัญหา หรือ ข้อเสนอแนะ
                  </label>
                  <textarea
                    rows={4}
                    maxLength={500}
                    required
                    value={feedbackMessage}
                    onChange={(e) => setFeedbackMessage(e.target.value)}
                    placeholder="เช่น เปิดใน iPad แล้วตรงป้ายชื่อซ้อนกัน, อยากได้สัตว์ขี่แพนด้า หรือ อยากให้มีระบบ..."
                    className="w-full bg-slate-900 text-amber-100 placeholder:text-slate-500 border-2 border-amber-400/80 rounded-xl p-3 text-xs font-medium resize-none"
                  />
                  <div className="flex items-center justify-between text-[10px] text-amber-100/65 mt-1">
                    <span>📱 แนบข้อมูลอุปกรณ์ให้อัตโนมัติ: {getDeviceSummary()}</span>
                    <span>{feedbackMessage.length}/500</span>
                  </div>
                </div>

                <div className="bg-emerald-950/70 border border-emerald-400/60 rounded-xl px-3 py-2 text-[11px] font-bold text-emerald-200">
                  🎁 ผู้เล่นที่ล็อกอินจะได้รับโบนัส <span className="text-amber-300">+5 💰 Gacha</span> ทันทีเมื่อส่งฟีดแบ็ก (สูงสุดวันละ 1 ครั้ง)
                </div>

                {feedbackError && (
                  <div className="bg-rose-600 text-white border-2 border-amber-300 rounded-xl p-2 text-xs font-bold text-center">
                    {feedbackError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingFeedback}
                  className="w-full rpg-btn-green font-[family-name:var(--font-kanit)] font-extrabold text-sm py-2.5 rounded-xl cursor-pointer"
                >
                  {submittingFeedback ? 'กำลังส่ง...' : '🚀 ส่ง Beta Feedback'}
                </button>
              </form>
            ) : (
              <div className="overflow-y-auto space-y-2 pr-1 flex-1 min-h-[220px]">
                {loadingFeedback ? (
                  <p className="text-xs text-center py-8 text-amber-100/70 font-bold">
                    กำลังโหลดรายการ...
                  </p>
                ) : feedbackItems.length === 0 ? (
                  <p className="text-xs text-center py-8 text-amber-100/70 font-bold">
                    ยังไม่มีรายการแจ้งปัญหา กดแท็บ &quot;ส่งเรื่อง&quot; เพื่อเป็นคนแรกได้เลย!
                  </p>
                ) : (
                  feedbackItems.map((it) => {
                    const catBadge =
                      it.category === 'idea'
                        ? { text: '💡 ไอเดีย', cls: 'bg-sky-600/90 text-white border-sky-300' }
                        : it.category === 'cosmetic'
                          ? { text: '🎨 พรอพ/สัตว์ขี่', cls: 'bg-fuchsia-600/90 text-white border-fuchsia-300' }
                          : { text: '🐛 บั๊ก/กระตุก', cls: 'bg-rose-600/90 text-white border-rose-300' };
                    return (
                      <div
                        key={it.id}
                        className={`rounded-xl p-3 border-2 space-y-1.5 ${it.status === 'resolved'
                            ? 'bg-emerald-950/45 border-emerald-500/60'
                            : 'bg-slate-900/85 border-slate-700'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs font-extrabold text-amber-200">
                            <span>{it.userEmoji}</span>
                            <span>{it.userName}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${catBadge.cls}`}>
                              {catBadge.text}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleFeedbackStatus(it.id, it.status)}
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border cursor-pointer ${it.status === 'resolved'
                                  ? 'bg-emerald-500 text-black border-white'
                                  : 'bg-amber-500/20 text-amber-200 border-amber-400/70 hover:bg-amber-400 hover:text-black'
                                }`}
                              title="คลิกเพื่อสลับสถานะ รอตรวจสอบ / แก้ไขแล้ว"
                            >
                              {it.status === 'resolved' ? '✅ แก้ไขแล้ว' : '⏳ รอตรวจสอบ'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteFeedback(it.id)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/70 hover:bg-rose-600 text-rose-200 cursor-pointer"
                              title="ลบรายการนี้"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <p className="text-xs text-amber-50/95 whitespace-pre-wrap leading-relaxed">
                          {it.message}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-amber-100/55">
                          <span>{it.deviceInfo || 'Unknown device'}</span>
                          <span>#{it.id}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {isLogOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="rpg-panel rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 relative">
            <button
              onClick={() => setIsLogOpen(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 bg-rose-600 text-white rounded-lg flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            {(() => {
              const gMeta = getGoalTypeMeta(selectedPlayerObj?.goalType);
              const mySteps = selectedPlayerObj?.stepCount ?? 0;
              const myStepTarget =
                selectedPlayerObj?.stepTarget ?? activeSeason?.stepTarget ?? 300000;
              const myStepPct =
                selectedPlayerObj?.stepProgressPct ??
                Math.round((mySteps / Math.max(1, myStepTarget)) * 1000) / 10;
              const mySidePct = selectedPlayerObj?.sideGoalProgressPct ?? 0;

              return (
                <>
                  <div className="flex items-center gap-2.5 mb-3">
                    <span className="text-3xl">{logTab === 'steps' ? '👟' : gMeta.icon}</span>
                    <div>
                      <h3 className="font-[family-name:var(--font-kanit)] text-xl font-extrabold text-amber-300">
                        {logTab === 'steps'
                          ? 'บันทึกก้าวเดิน Step Challenge'
                          : 'บันทึกผลภารกิจรอง (Side Quest)'}
                      </h3>
                      <p className="text-[11px] text-amber-100/80 font-medium">
                        {logTab === 'steps'
                          ? 'ทุก +1% ก้าวเดินรับ +10 💰 (สูงสุด 1,000 💰/ซีซั่น) + โบนัสส่งผลรายวัน +10 💰'
                          : getSideQuestRewardHint(selectedPlayerObj?.goalType)}
                      </p>
                    </div>
                  </div>

                  {/* สลับแท็บเป้าหลัก (ก้าวเดิน) vs กระดานบอร์ดเควส (แทนที่ภารกิจรองเดิม) */}
                  <div className="grid grid-cols-2 gap-2 mb-3.5">
                    <button
                      type="button"
                      onClick={() => {
                        setLogTab('steps');
                        setModalError('');
                      }}
                      className={`border-2 border-black rounded-xl py-2 px-2 text-xs font-extrabold cursor-pointer transition ${logTab === 'steps'
                          ? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-black shadow-[2px_2px_0px_#000]'
                          : 'bg-slate-900 text-amber-100/75'
                        }`}
                    >
                      👟 ก้าวเดิน (เป้าหลัก)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsLogOpen(false);
                        openQuestBoard(null);
                      }}
                      className="border-2 border-[#ffd86b] rounded-xl py-2 px-2 text-xs font-extrabold cursor-pointer transition bg-gradient-to-b from-[#9c5d29] to-[#5a2d0d] text-[#ffefc8] hover:brightness-110 shadow-[2px_2px_0px_#000]"
                    >
                      📜 เปิดกระดานเควส
                    </button>
                  </div>

                  <form onSubmit={handleWeightSubmit} className="space-y-3.5">
                    {selectedPlayerObj && (
                      <div className="rpg-panel-wood rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                        <span className="font-extrabold text-sm text-amber-200 truncate">
                          {selectedPlayerObj.emoji} {selectedPlayerObj.name}
                        </span>
                        {logTab === 'steps' ? (
                          <span className="text-xs font-bold text-emerald-300 shrink-0">
                            {mySteps.toLocaleString()} / {myStepTarget.toLocaleString()} ก้าว ({myStepPct}%)
                          </span>
                        ) : selectedPlayerObj.id === currentUserId &&
                          (selectedPlayerObj.currentVal ?? selectedPlayerObj.currentWeight) !== undefined ? (
                          <span className="text-xs font-bold text-amber-100 shrink-0">
                            ปัจจุบัน {selectedPlayerObj.currentVal ?? selectedPlayerObj.currentWeight} / เป้า{' '}
                            {selectedPlayerObj.targetVal ?? selectedPlayerObj.goalWeight} {gMeta.unit} ({mySidePct}%)
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-amber-100 shrink-0">
                            ความคืบหน้า {mySidePct}%
                          </span>
                        )}
                      </div>
                    )}

                    {logTab === 'steps' ? (
                      (() => {
                        const effectiveSyncedToday = todaySyncedSteps;
                        const parsedTypedSteps =
                          stepInput.trim() !== '' && !Number.isNaN(Number(stepInput))
                            ? Math.round(Number(stepInput))
                            : null;
                        const liveDelta =
                          stepInputMode === 'daily_sync' && parsedTypedSteps !== null
                            ? Math.max(0, parsedTypedSteps - effectiveSyncedToday)
                            : null;
                        const originUrl =
                          typeof window !== 'undefined' ? window.location.origin : '';
                        const shortcutEndpointUrl = syncKey
                          ? `${originUrl}/api/health-sync?key=${syncKey}`
                          : `${originUrl}/api/health-sync`;
                        const maskedKey =
                          syncKey.length > 10
                            ? `${syncKey.slice(0, 6)}••••••••••••${syncKey.slice(-4)}`
                            : 'กำลังสร้างรหัส...';

                        return (
                          <div className="space-y-2.5">
                            {/* กล่องซิงก์ด่วนจากแอปสุขภาพ (Android / iOS) */}
                            <div className="bg-slate-950/85 border-2 border-emerald-500/60 rounded-xl p-2.5 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-extrabold text-emerald-300">
                                  📲 ซิงก์จากแอปสุขภาพ (กันก้าวเบิ้ลอัตโนมัติ)
                                </span>
                                <span className="text-[10px] font-bold text-amber-200/90 bg-slate-900 border border-amber-400/40 rounded-full px-2 py-0.5 shrink-0">
                                  วันนี้ซิงก์แล้ว {effectiveSyncedToday.toLocaleString()} ก้าว
                                </span>
                              </div>

                              <input
                                ref={healthFileInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleHealthScreenshotChange}
                                className="hidden"
                              />

                              {/* วิธีที่ 2: แนบรูปแคปหน้าจอ อ่านตัวเลขก้าวอัตโนมัติด้วย Gemini AI */}
                              <button
                                type="button"
                                disabled={ocrScanning || submitting}
                                onClick={() => healthFileInputRef.current?.click()}
                                className="w-full bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-300 text-slate-950 border-2 border-black shadow-[0_3px_0_#000] active:translate-y-0.5 rounded-xl py-2 px-3 flex items-center justify-center gap-2 font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm cursor-pointer disabled:opacity-60"
                              >
                                <span className="text-base">{ocrScanning ? '🤖' : '📸'}</span>
                                <span>
                                  {ocrScanning
                                    ? 'AI กำลังอ่านยอดก้าวจากรูปแคปหน้าจอ...'
                                    : 'แนบรูปแคปหน้าจอแอปสุขภาพ (AI อ่านก้าวให้)'}
                                </span>
                              </button>
                              <p className="text-[10px] text-amber-100/70 text-center leading-tight">
                                ใช้ได้ทั้ง Android (Health Connect / Samsung / Google Fit / Zepp / Garmin) และ iOS
                              </p>

                              {ocrResult && (
                                <div className="bg-emerald-950/70 border border-emerald-400/70 rounded-xl p-2 flex items-center gap-2.5">
                                  {ocrPreviewUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={ocrPreviewUrl}
                                      alt="Health screenshot preview"
                                      className="w-11 h-14 object-cover rounded-lg border border-emerald-300/60 shrink-0"
                                    />
                                  )}
                                  <div className="min-w-0 flex-1 text-left">
                                    <div className="text-xs font-extrabold text-emerald-300 truncate">
                                      🤖 อ่านได้ {ocrResult.steps.toLocaleString()} ก้าว
                                      {ocrResult.appName ? ` • ${ocrResult.appName}` : ''}
                                    </div>
                                    <div className="text-[11px] font-bold text-amber-200 leading-snug">
                                      {ocrResult.steps > effectiveSyncedToday
                                        ? `บวกส่วนต่างเข้าสนาม +${(
                                          ocrResult.steps - effectiveSyncedToday
                                        ).toLocaleString()} ก้าว (จากเดิมวันนี้ ${effectiveSyncedToday.toLocaleString()})`
                                        : `ซิงก์ยอดวันนี้ครบ ${effectiveSyncedToday.toLocaleString()} ก้าวแล้ว (ไม่มีส่วนต่างเพิ่ม)`}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* วิธีที่ 1: สำหรับ iOS / Apple Health ผ่าน Apple Shortcuts */}
                              <div className="pt-1 border-t border-slate-800">
                                <button
                                  type="button"
                                  onClick={() => setShowIosShortcutGuide((v) => !v)}
                                  className="w-full bg-slate-900 hover:bg-slate-800 border border-sky-400/50 rounded-lg py-1.5 px-2.5 flex items-center justify-between text-[11px] font-extrabold text-sky-300 cursor-pointer transition"
                                >
                                  <span>🍎 เชื่อม Apple Health อัตโนมัติ (iOS Shortcuts)</span>
                                  <span>{showIosShortcutGuide ? '▲ ซ่อน' : '▼ ตั้งค่า / ดูรหัส'}</span>
                                </button>

                                {showIosShortcutGuide && (
                                  <div className="mt-2 bg-slate-900/95 border border-sky-500/40 rounded-xl p-2.5 space-y-2.5 text-left">
                                    <div>
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-[11px] font-extrabold text-amber-300">
                                          🔑 รหัส Sync Key เฉพาะตัวของคุณ
                                        </span>
                                        {loadingSyncStatus && (
                                          <span className="text-[10px] text-sky-300">กำลังโหลด...</span>
                                        )}
                                      </div>

                                      <div className="bg-black/70 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-[11px] text-emerald-300 break-all select-all">
                                        {showSyncKey ? syncKey || '...' : maskedKey}
                                      </div>

                                      <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                                        <button
                                          type="button"
                                          disabled={!syncKey}
                                          onClick={() => setShowSyncKey((v) => !v)}
                                          className="bg-slate-800 hover:bg-slate-700 text-amber-100 border border-slate-600 rounded-lg py-1 text-[10.5px] font-bold cursor-pointer disabled:opacity-50"
                                        >
                                          {showSyncKey ? '🙈 ซ่อนรหัส' : '👁️ ดูรหัส'}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={!syncKey}
                                          onClick={() => handleCopySyncText(syncKey, 'key')}
                                          className="bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/50 rounded-lg py-1 text-[10.5px] font-bold cursor-pointer disabled:opacity-50"
                                        >
                                          {copiedSyncField === 'key' ? '✅ คัดลอกแล้ว' : '📋 คัดลอกคีย์'}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={!syncKey || rotatingSyncKey}
                                          onClick={handleRotateSyncKey}
                                          className={`rounded-lg py-1 text-[10.5px] font-bold border cursor-pointer disabled:opacity-50 ${confirmRotateKey
                                              ? 'bg-rose-600 text-white border-amber-300'
                                              : 'bg-slate-800 hover:bg-slate-700 text-rose-300 border-rose-500/40'
                                            }`}
                                        >
                                          {rotatingSyncKey
                                            ? 'กำลังสุ่ม...'
                                            : confirmRotateKey
                                              ? '⚠️ กดยืนยันสุ่ม'
                                              : '🔄 สุ่มใหม่'}
                                        </button>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={!syncKey}
                                        onClick={() => handleCopySyncText(shortcutEndpointUrl, 'url')}
                                        className="w-full mt-1.5 bg-sky-400 hover:bg-sky-300 text-slate-950 border-2 border-black rounded-lg py-1.5 px-2 text-[11px] font-extrabold cursor-pointer disabled:opacity-50"
                                      >
                                        {copiedSyncField === 'url'
                                          ? '✅ คัดลอก URL พร้อมคีย์แล้ว! นำไปวางใน Shortcuts ได้เลย'
                                          : '🔗 คัดลอก URL พร้อมคีย์ (วางใน Shortcuts ได้ทันที)'}
                                      </button>
                                    </div>

                                    <div className="border-t border-slate-800 pt-2 space-y-1 text-[11px] text-amber-100/90 leading-relaxed">
                                      <div className="font-extrabold text-sky-300">
                                        📖 วิธีตั้งค่า Apple Shortcuts บน iPhone (ทำครั้งเดียวจบ):
                                      </div>
                                      <ol className="list-decimal list-inside space-y-1 text-[10.5px] text-amber-100/85">
                                        <li>
                                          เปิดแอป <b>คำสั่งลัด (Shortcuts)</b> กด <b>+</b> สร้างคำสั่งลัดใหม่
                                        </li>
                                        <li>
                                          เพิ่มคำสั่ง <b>ค้นหาตัวอย่างข้อมูลสุขภาพ (Find Health Samples)</b> → เลือกประเภท{' '}
                                          <b>จำนวนก้าว (Steps)</b> และวันที่เริ่ม <b>คือวันนี้ (is Today)</b>
                                          <span className="text-amber-300/80">
                                            {' '}
                                            (หากใส่ Apple Watch คู่ iPhone แล้วก้าวเบิ้ล ให้กรอง Source เลือกเครื่องเดียว)
                                          </span>
                                        </li>
                                        <li>
                                          เพิ่มคำสั่ง <b>คำนวณสถิติ (Calculate Statistics)</b> → เลือก{' '}
                                          <b>ผลรวม (Sum)</b> จากตัวอย่างข้อมูลสุขภาพ
                                        </li>
                                        <li>
                                          เพิ่มคำสั่ง <b>รับเนื้อหาของ URL (Get Contents of URL)</b>:
                                          <div className="pl-3 mt-0.5 text-sky-200/90 space-y-0.5">
                                            <div>• ช่อง URL: กดวางลิงก์จากปุ่ม <b>คัดลอก URL พร้อมคีย์</b> ด้านบน</div>
                                            <div>• วิธีการ (Method): <b>POST</b> • เนื้อหาคำขอ: <b>JSON</b></div>
                                            <div>
                                              • กดเพิ่มช่องข้อมูลใหม่ เลือกชนิด <b>ข้อความ (Text)</b> ตั้งชื่อว่า{' '}
                                              <code className="bg-black px-1 rounded text-emerald-300">steps</code>{' '}
                                              แล้วจิ้มเลือกตัวแปร <b>ผลรวม (Sum)</b> จากข้อ 3
                                            </div>
                                          </div>
                                        </li>
                                        <li>
                                          <i>(แนะนำ)</i> เพิ่ม <b>แสดงการแจ้งเตือน (Show Notification)</b> เลือกค่า{' '}
                                          <code className="bg-black px-1 rounded text-amber-300">message</code> จากผลลัพธ์ URL
                                          แล้วกดแชร์เพิ่มลงหน้าจอโฮม หรือตั้ง Automation รันเองทุกเย็นได้เลย! (กดซ้ำกี่รอบในวันเดียวก็ไม่เบิ้ล)
                                        </li>
                                      </ol>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* โหมดการกรอกตัวเลขก้าว */}
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setStepInputMode('daily_sync')}
                                className={`rounded-lg py-1.5 px-1 text-[10.5px] font-extrabold border-2 cursor-pointer transition ${stepInputMode === 'daily_sync'
                                    ? 'bg-amber-300 text-black border-white'
                                    : 'bg-slate-900 text-amber-100/75 border-slate-700'
                                  }`}
                              >
                                🔄 ยอดวันนี้ (กันเบิ้ล)
                              </button>
                              <button
                                type="button"
                                onClick={() => setStepInputMode('add')}
                                className={`rounded-lg py-1.5 px-1 text-[10.5px] font-extrabold border-2 cursor-pointer transition ${stepInputMode === 'add'
                                    ? 'bg-emerald-400 text-black border-white'
                                    : 'bg-slate-900 text-amber-100/75 border-slate-700'
                                  }`}
                              >
                                ➕ บวกเพิ่มเอง
                              </button>
                              <button
                                type="button"
                                onClick={() => setStepInputMode('set')}
                                className={`rounded-lg py-1.5 px-1 text-[10.5px] font-extrabold border-2 cursor-pointer transition ${stepInputMode === 'set'
                                    ? 'bg-sky-400 text-black border-white'
                                    : 'bg-slate-900 text-amber-100/75 border-slate-700'
                                  }`}
                              >
                                📝 รวมทั้งซีซั่น
                              </button>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-amber-200 mb-1">
                                {stepInputMode === 'daily_sync'
                                  ? 'ยอดก้าวเดินรวมของวันนี้จากแอปสุขภาพ (ระบบหักส่วนที่ซิงก์ไปแล้วให้อัตโนมัติ)'
                                  : stepInputMode === 'add'
                                    ? 'จำนวนก้าวที่เดินเพิ่มในครั้งนี้ (+ก้าว)'
                                    : 'ยอดก้าวเดินสะสมรวมทั้งซีซั่น (ก้าว)'}
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                required
                                value={stepInput}
                                onChange={(e) => {
                                  const thaiDigits = '๐๑๒๓๔๕๖๗๘๙';
                                  let val = e.target.value;
                                  for (let i = 0; i < 10; i++) {
                                    val = val.replaceAll(thaiDigits[i], String(i));
                                  }
                                  val = val.replace(/[^0-9]/g, '');
                                  setStepInput(val);
                                  setStepSyncSource(
                                    ocrResult && val !== '' && Number(val) === ocrResult.steps
                                      ? 'ocr_screenshot'
                                      : 'web_daily_sync'
                                  );
                                }}
                                placeholder={
                                  stepInputMode === 'daily_sync'
                                    ? 'เช่น 8500 (ยอดก้าวของวันนี้)'
                                    : stepInputMode === 'add'
                                      ? 'เช่น 3500'
                                      : 'เช่น 45000'
                                }
                                className="w-full bg-slate-900 text-emerald-300 placeholder:text-slate-500 border-2 border-emerald-400 rounded-xl px-3 py-2 font-[family-name:var(--font-kanit)] font-extrabold text-center text-lg"
                              />

                              {stepInputMode === 'daily_sync' && parsedTypedSteps !== null && (
                                <p
                                  className={`mt-1 text-[11px] font-bold text-center ${liveDelta && liveDelta > 0 ? 'text-emerald-300' : 'text-amber-200/80'
                                    }`}
                                >
                                  {liveDelta && liveDelta > 0
                                    ? `✨ จะบวกเข้าสนามเฉพาะส่วนต่าง +${liveDelta.toLocaleString()} ก้าว (ซิงก์วันนี้ไปแล้ว ${effectiveSyncedToday.toLocaleString()} ก้าว)`
                                    : `ℹ️ ยอดนี้ซิงก์ไปแล้วในวันนี้ (${effectiveSyncedToday.toLocaleString()} ก้าว) ระบบจะไม่บวกก้าวซ้ำ`}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div>
                        <label className="block text-xs font-bold text-amber-200 mb-1">
                          {gMeta.isCumulative
                            ? `จำนวนที่ทำเพิ่มในครั้งนี้ (+${gMeta.unit})`
                            : `ค่าล่าสุดวันนี้ (${gMeta.unit})`}
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          required
                          value={newWeightInput}
                          onChange={(e) => setNewWeightInput(e.target.value)}
                          placeholder={gMeta.isCumulative ? `เช่น +50 ${gMeta.unit}` : 'เช่น 62.5'}
                          className="w-full bg-slate-900 text-amber-300 placeholder:text-slate-500 border-2 border-amber-400 rounded-xl px-3 py-2 font-[family-name:var(--font-kanit)] font-extrabold text-center text-lg"
                        />
                      </div>
                    )}

                    {modalError && (
                      <div className="bg-rose-600 text-white border-2 border-amber-300 rounded-xl p-2 text-xs font-bold text-center">
                        {modalError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting || ocrScanning}
                      className="w-full rpg-btn-green font-[family-name:var(--font-kanit)] font-extrabold text-base py-3 rounded-xl cursor-pointer mt-1 disabled:opacity-60"
                    >
                      {submitting
                        ? 'กำลังอัปเดต...'
                        : ocrScanning
                          ? 'กำลังอ่านรูปด้วย AI...'
                          : logTab === 'steps'
                            ? stepInputMode === 'daily_sync' &&
                              stepInput.trim() !== '' &&
                              !Number.isNaN(Number(stepInput)) &&
                              Math.round(Number(stepInput)) > todaySyncedSteps
                              ? `👟 ซิงก์ก้าววันนี้ (+${(
                                Math.round(Number(stepInput)) - todaySyncedSteps
                              ).toLocaleString()} ก้าว) เข้าสนาม!`
                              : '👟 บันทึกก้าวเดิน & วิ่งเข้าเส้นชัย!'
                            : '🚀 ส่งผลภารกิจรอง & รับโบนัส!'}
                    </button>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {isStepAdminOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="rpg-panel rounded-2xl max-w-sm w-full p-5 relative">
            <button
              onClick={() => setIsStepAdminOpen(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 bg-rose-600 text-white rounded-lg flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>
            <div className="mb-3">
              <h3 className="font-[family-name:var(--font-kanit)] text-lg font-extrabold text-amber-300">
                ⚙️ ตั้งเป้าก้าวเดินซีซั่น (Admin)
              </h3>
              <p className="text-[11px] text-amber-100/80">
                {activeSeason?.name || 'Active Season'} • ทุกคนในสนามจะใช้เป้าก้าวเดินร่วมกัน
              </p>
            </div>
            <form onSubmit={handleAdminStepTargetSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-amber-200 mb-1">
                  เป้าหมายก้าวเดินประจำซีซั่น (ก้าว)
                </label>
                <input
                  type="number"
                  min="1000"
                  max="10000000"
                  step="1000"
                  required
                  value={adminStepTargetInput}
                  onChange={(e) => setAdminStepTargetInput(e.target.value)}
                  placeholder="เช่น 300000"
                  className="w-full bg-slate-900 text-emerald-300 border-2 border-emerald-400 rounded-xl px-3 py-2 font-[family-name:var(--font-kanit)] font-extrabold text-center text-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-amber-200 mb-1">
                  รหัส Admin PIN
                </label>
                <input
                  type="password"
                  required
                  value={adminPinInput}
                  onChange={(e) => setAdminPinInput(e.target.value)}
                  placeholder="กรอก Admin PIN"
                  className="w-full bg-slate-900 text-amber-200 border-2 border-amber-500 rounded-xl px-3 py-2 text-sm font-bold text-center"
                />
              </div>
              {adminStepError && (
                <div className="bg-rose-600 text-white border-2 border-amber-300 rounded-xl p-2 text-xs font-bold text-center">
                  {adminStepError}
                </div>
              )}
              <button
                type="submit"
                disabled={savingAdminStep}
                className="w-full rpg-btn-gold font-[family-name:var(--font-kanit)] font-extrabold text-sm py-2.5 rounded-xl cursor-pointer"
              >
                {savingAdminStep ? 'กำลังบันทึก...' : '💾 บันทึกเป้าก้าวเดินซีซั่น'}
              </button>
            </form>
          </div>
        </div>
      )}

      <WardrobeShopModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        mode={joinMode}
        qualityMode={qualityMode}
        editingPlayerId={editingPlayerId}
        currentUserId={currentUserId}
        userPoints={
          players.find((pl) => pl.id === (editingPlayerId || currentUserId))?.points ?? 100
        }
        unlockedItems={
          players.find((pl) => pl.id === (editingPlayerId || currentUserId))?.unlockedItems ?? []
        }
        onUnlockOrEquipItem={handleUnlockOrEquipItem}
        onSpinGacha={handleSpinGacha}
        initialRightTab={wardrobeInitialTab}
        joinRole={joinRole}
        setJoinRole={setJoinRole}
        joinName={joinName}
        setJoinName={setJoinName}
        joinEmoji={joinEmoji}
        setJoinEmoji={setJoinEmoji}
        joinColor={joinColor}
        setJoinColor={setJoinColor}
        joinBandColor={joinBandColor}
        setJoinBandColor={setJoinBandColor}
        joinSpecies={joinSpecies}
        setJoinSpecies={setJoinSpecies}
        joinThemeId={joinThemeId}
        setJoinThemeId={setJoinThemeId}
        joinEquipHat={joinEquipHat}
        setJoinEquipHat={setJoinEquipHat}
        joinEquipFace={joinEquipFace}
        setJoinEquipFace={setJoinEquipFace}
        joinEquipArmor={joinEquipArmor}
        setJoinEquipArmor={setJoinEquipArmor}
        joinEquipWeapon={joinEquipWeapon}
        setJoinEquipWeapon={setJoinEquipWeapon}
        joinEquipWings={joinEquipWings}
        setJoinEquipWings={setJoinEquipWings}
        joinEquipAura={joinEquipAura}
        setJoinEquipAura={setJoinEquipAura}
        joinEquipPetGear={joinEquipPetGear}
        setJoinEquipPetGear={setJoinEquipPetGear}
        joinEquipMount={joinEquipMount}
        setJoinEquipMount={setJoinEquipMount}
        joinEquipMarker={joinEquipMarker}
        setJoinEquipMarker={setJoinEquipMarker}
        joinPropColors={joinPropColors}
        setJoinPropColors={setJoinPropColors}
        joinGoalType={joinGoalType}
        setJoinGoalType={setJoinGoalType}
        joinStart={joinStart}
        setJoinStart={setJoinStart}
        joinGoal={joinGoal}
        setJoinGoal={setJoinGoal}
        joinBodyWeight={joinBodyWeight}
        setJoinBodyWeight={setJoinBodyWeight}
        joinHeightCm={joinHeightCm}
        setJoinHeightCm={setJoinHeightCm}
        joinGender={joinGender}
        setJoinGender={setJoinGender}
        joinWorkout={joinWorkout}
        setJoinWorkout={setJoinWorkout}
        joinStatus={joinStatus}
        setJoinStatus={setJoinStatus}
        joinPin={joinPin}
        setJoinPin={setJoinPin}
        joinError={joinError}
        joining={joining}
        onSubmit={handleJoinSubmit}
      />

      {actionTargetPlayer && (() => {
        const liveTarget =
          rankedPlayers.find((pl) => pl.id === actionTargetPlayer.id) ||
          players.find((pl) => pl.id === actionTargetPlayer.id) ||
          actionTargetPlayer;
        const pBoost = resolvePowerBoostMeta(
          liveTarget.cheerCount ?? 0,
          liveTarget.temptCount ?? 0
        );
        const fillPct = Math.abs(pBoost.gaugeRatio) * 50;
        const thumbLeftPct = 50 + pBoost.gaugeRatio * 50;
        const netLabel =
          pBoost.netPower > 0 ? `+${pBoost.netPower}` : String(pBoost.netPower);

        return (
          <div
            onClick={() => setActionTargetPlayer(null)}
            className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="rpg-panel rounded-2xl max-w-sm w-full p-5 relative"
            >
              <button
                onClick={() => setActionTargetPlayer(null)}
                className="absolute top-3 right-3 w-8 h-8 bg-rose-600 text-white rounded-lg flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-2xl border-2 border-amber-400 flex items-center justify-center text-2xl shrink-0"
                  style={{ backgroundColor: liveTarget.colorHex }}
                >
                  {liveTarget.emoji}
                </div>
                <div className="min-w-0">
                  <h3 className="font-[family-name:var(--font-kanit)] text-lg font-extrabold text-amber-300 truncate">
                    {liveTarget.name}
                  </h3>
                  <p className="text-xs text-emerald-300 font-bold">
                    👟 {(liveTarget.stepCount ?? 0).toLocaleString()} / {(liveTarget.stepTarget ?? activeSeason?.stepTarget ?? 300000).toLocaleString()} ก้าว ({liveTarget.stepProgressPct ?? liveTarget.progressPct ?? 0}%)
                  </p>
                  {(() => {
                    const activePlayerQuest = quests.find(
                      (q) =>
                        (q.status === 'active' || q.status === 'voting') &&
                        q.party.some((m) => m.userId === liveTarget.id && m.inviteStatus === 'accepted')
                    );
                    if (!activePlayerQuest) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setActionTargetPlayer(null);
                          openQuestBoard(activePlayerQuest.id);
                        }}
                        className="text-[11px] text-amber-200 hover:text-amber-100 font-bold underline decoration-amber-400/70 cursor-pointer text-left"
                      >
                        📜 กำลังทำเควส: {activePlayerQuest.title}
                      </button>
                    );
                  })()}
                </div>
              </div>

              {/* บาร์สมดุลพลัง +/- รายวัน: มารผจญ (คาบิก้อน/จอมมารบู) vs เติมไฟ (ไฟบูสต์/Super Saiyan) */}
              <div className="bg-slate-950/90 border-2 border-amber-500/60 rounded-xl p-3 mb-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[11px] font-extrabold ${pBoost.badgeBgClass}`}
                  >
                    {pBoost.title}
                  </span>
                  <span
                    className={`font-[family-name:var(--font-kanit)] font-extrabold text-sm ${pBoost.netPower > 0
                        ? 'text-amber-300'
                        : pBoost.netPower < 0
                          ? 'text-pink-400'
                          : 'text-slate-300'
                      }`}
                  >
                    เกจรวม: {netLabel}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] font-bold">
                  <span className="text-pink-300">😈 มารผจญ (-{pBoost.temptCount})</span>
                  <span className="text-slate-400">ชักเย่อ +/-</span>
                  <span className="text-amber-300">🔥 เติมไฟ (+{pBoost.cheerCount})</span>
                </div>

                {/* Bi-directional Tug-of-War Gauge (-10 .. 0 .. +10) */}
                <div className="relative w-full h-4 bg-slate-900 border-2 border-black rounded-full overflow-visible shadow-inner">
                  {/* Left Negative Fill (Food Coma / Giant Kabigon) */}
                  {pBoost.netPower < 0 && (
                    <div
                      className="absolute top-0 bottom-0 rounded-l-full bg-gradient-to-l from-sky-400 via-cyan-500 to-teal-300 transition-all duration-300"
                      style={{
                        right: '50%',
                        width: `${fillPct}%`,
                      }}
                    />
                  )}
                  {/* Right Positive Fill (Fire Boost / Super Saiyan) */}
                  {pBoost.netPower > 0 && (
                    <div
                      className="absolute top-0 bottom-0 rounded-r-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-200 transition-all duration-300"
                      style={{
                        left: '50%',
                        width: `${fillPct}%`,
                      }}
                    />
                  )}

                  {/* Milestone Ticks: -5 (25%), 0 (50%), +5 (75%) */}
                  <div className="absolute top-0 bottom-0 left-1/4 w-[1.5px] bg-white/30" />
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-white/85 z-10" />
                  <div className="absolute top-0 bottom-0 left-3/4 w-[1.5px] bg-white/30" />

                  {/* Thumb Indicator */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-black shadow z-20 transition-all duration-300"
                    style={{ left: `${thumbLeftPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[9px] font-extrabold text-amber-100/80 pt-0.5">
                  <span className="text-cyan-300">💤-10 คาบิก้อน</span>
                  <span className="text-sky-300">😴-5 จุกแน่น</span>
                  <span className="text-slate-300">0</span>
                  <span className="text-orange-300">🔥+5 บูสต์</span>
                  <span className="text-yellow-300">⚡+10 ไซย่า</span>
                </div>

                <div className="text-[10px] font-semibold text-amber-100/85 bg-black/40 rounded-lg px-2 py-1 leading-snug">
                  💡 {pBoost.nextHint}
                </div>
                <div className="text-[9px] font-bold text-amber-200/65 text-center">
                  ⏰ เกจพลัง +/- รีเซ็ตกลับเป็น 0 ใหม่ทุกวันเวลา 07:00 น. เช้า
                </div>
              </div>

              {liveTarget.id === currentUserId ? (
                <div className="rounded-xl border-2 border-black bg-amber-100/90 px-3 py-2 text-[11px] font-bold text-stone-800 text-center leading-snug">
                  💡 ไม่สามารถเติมไฟหรือแกล้งตัวเองได้ — คลิกที่ป้ายชื่อบนหัวเพื่อนในสนามเพื่อส่งไฟเชียร์ (+1) หรือแกล้งเพื่อน (-1) และรับโบนัสเหรียญ!
                </div>
              ) : (
                <div className="space-y-3">
                  {currentUserId && currentUserId > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setActionTargetPlayer(null);
                        setGiftError('');
                        setGiftMessage('');
                        setGiftCategory('mount');
                        setGiftTargetPlayer(liveTarget);
                      }}
                      className="w-full neo-btn bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 text-white border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-xs py-2 rounded-xl cursor-pointer shadow-[0_3px_0_#000] hover:brightness-110"
                    >
                      🎁 ส่งพรอพ/สัตว์ขี่เป็นของขวัญให้ {liveTarget.name}!
                    </button>
                  )}
                  <form onSubmit={handleBoardSubmit} className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBoardKind('cheer')}
                        className={`border-2 border-black rounded-xl py-2 text-xs font-extrabold cursor-pointer transition ${boardKind === 'cheer'
                            ? 'bg-gradient-to-r from-[#A3E635] to-[#FACC15] text-black shadow-[2px_2px_0px_#000]'
                            : 'bg-zinc-100 text-zinc-600'
                          }`}
                      >
                        🔥 เติมไฟบูสต์ (+1)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBoardKind('tempt')}
                        className={`border-2 border-black rounded-xl py-2 text-xs font-extrabold cursor-pointer transition ${boardKind === 'tempt'
                            ? 'bg-[#FF4D8D] text-white shadow-[2px_2px_0px_#000]'
                            : 'bg-zinc-100 text-zinc-600'
                          }`}
                      >
                        😈 มารผจญ/ขุนพุง (-1)
                      </button>
                    </div>

                    {/* กติกาวงแชร์ปันผลสายเชียร์ & สายมารแทงสวนรับทรัพย์ */}
                    <div
                      className={`rounded-xl border-2 border-black px-3 py-2 text-[11px] font-bold leading-snug ${boardKind === 'cheer'
                          ? 'bg-amber-100 text-stone-900'
                          : 'bg-rose-100 text-rose-950'
                        }`}
                    >
                      {boardKind === 'cheer' ? (
                        <>
                          <div>🤝 <strong>วงแชร์สายส่งไฟ:</strong> คนส่งได้ <strong>+2 💰</strong> &amp; <strong>คนได้รับไฟก็ได้ +2 💰</strong> ทันที! (สูงสุด 5 ครั้ง/วัน)</div>
                          <div className="text-[10.5px] text-amber-900 mt-0.5">
                            💰 ถ้าเพื่อนอัปเดตผลรอบถัดไปแล้ว<strong>พัฒนาขึ้น/ได้แต้ม</strong> คนส่งไฟรับปันผลอีก <strong>+8 💰/ดวง (สูงสุด 3 ดวง) + โบนัส 25% ของแต้มเพื่อน</strong> (รับปันผลรวมสูงสุด <strong>40 💰/วัน</strong>)
                          </div>
                        </>
                      ) : (
                        <>
                          <div>😈 <strong>สายมารแทงสวนขุนพุง:</strong> คนส่งแกล้งเพื่อนรับทันที <strong>+2 💰</strong> (สูงสุด 5 ครั้ง/วัน)</div>
                          <div className="text-[10.5px] text-rose-900 mt-0.5">
                            🍔 ถ้าเพื่อนตบะแตกอัปเดตผล<strong>ถอยหลัง</strong> รับรางวัลนำจับ <strong>+12 💰/ชิ้น</strong> (ร่วงซุ้มอาหาร <strong>+20 💰/ชิ้น</strong> • รับปันผลรวมสูงสุด <strong>40 💰/วัน</strong>)
                          </div>
                        </>
                      )}
                    </div>

                    <input
                      type="text"
                      maxLength={120}
                      placeholder="พิมพ์ข้อความถึงเพื่อน (ไม่ใส่ก็ได้)"
                      value={boardMessage}
                      onChange={(e) => setBoardMessage(e.target.value)}
                      className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 text-xs font-semibold text-black placeholder:text-zinc-500"
                    />

                    <button
                      type="submit"
                      disabled={sendingBoard}
                      className={`w-full neo-btn font-[family-name:var(--font-kanit)] font-extrabold text-sm py-2.5 rounded-xl cursor-pointer ${boardKind === 'cheer'
                          ? 'bg-[#FFE600] hover:bg-[#fef08a] text-black'
                          : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-400 hover:to-rose-400 text-white'
                        }`}
                    >
                      {sendingBoard
                        ? 'กำลังส่ง...'
                        : boardKind === 'cheer'
                          ? '🔥 ยิงลูกไฟเติมพลังให้เพื่อน! (+1)'
                          : '🍔 ส่งไรเดอร์เอาของกินไปขุน! (-1)'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* 🎁 GIFT PROP TO FRIEND MODAL */}
      {giftTargetPlayer && (() => {
        const senderObj = players.find((pl) => pl.id === currentUserId);
        const liveRecipient =
          players.find((pl) => pl.id === giftTargetPlayer.id) || giftTargetPlayer;
        const recipientOwned = new Set<string>([
          ...Array.from(FREE_DEFAULT_ITEMS),
          ...(liveRecipient.unlockedItems || []),
        ]);
        const giftableItems = SHOP_ITEMS.filter(
          (it) =>
            it.category === giftCategory &&
            !it.isGachaOnly &&
            it.cost > 0 &&
            !FREE_DEFAULT_ITEMS.has(it.id)
        );
        const senderPoints = senderObj?.points ?? 0;

        return (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="rpg-panel rounded-2xl max-w-lg w-full max-h-[88dvh] flex flex-col p-5 relative">
              <button
                onClick={() => setGiftTargetPlayer(null)}
                className="absolute top-3.5 right-3.5 w-8 h-8 bg-rose-600 text-white rounded-lg flex items-center justify-center font-bold cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-3 pr-8">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-amber-400 border-2 border-white flex items-center justify-center text-2xl shrink-0 shadow">
                  🎁
                </div>
                <div className="min-w-0">
                  <h3 className="font-[family-name:var(--font-kanit)] text-lg font-extrabold text-amber-300 truncate">
                    ส่งของขวัญให้ {liveRecipient.emoji} {liveRecipient.name}
                  </h3>
                  <p className="text-[11px] text-amber-100/85 font-bold">
                    💰 Gacha ของคุณ: <span className="text-amber-300">{senderPoints.toLocaleString()} GP</span> • ของจะเข้าตู้เพื่อนทันที!
                  </p>
                </div>
              </div>

              <input
                type="text"
                maxLength={100}
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="💌 เขียนการ์ดอวยพรแนบของขวัญ (ไม่ใส่ก็ได้ เช่น เอาไปขี่หมูเด้งเลยเพื่อน!)"
                className="w-full bg-slate-900 text-amber-100 placeholder:text-slate-500 border-2 border-amber-400/70 rounded-xl px-3 py-2 text-xs font-semibold mb-2.5 shrink-0"
              />

              {/* Category strip */}
              <div className="flex gap-1 overflow-x-auto pb-1.5 mb-2 shrink-0">
                {(
                  [
                    { id: 'mount' as ShopCategory, label: '🐎 สัตว์ขี่' },
                    { id: 'armor' as ShopCategory, label: '👕 ชุด' },
                    { id: 'hat' as ShopCategory, label: '🎩 หมวก' },
                    { id: 'face' as ShopCategory, label: '🕶️ แว่น' },
                    { id: 'weapon' as ShopCategory, label: '⚔️ ของถือ' },
                    { id: 'wings' as ShopCategory, label: '🎒 เป้/ปีก' },
                    { id: 'aura' as ShopCategory, label: '✨ ออร่า' },
                    { id: 'pet' as ShopCategory, label: '🐾 สัตว์เลี้ยง' },
                    { id: 'marker' as ShopCategory, label: '📍 ป้ายลู่' },
                  ] as const
                ).map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setGiftCategory(cat.id);
                      setGiftError('');
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold border-2 whitespace-nowrap cursor-pointer transition shrink-0 ${giftCategory === cat.id
                        ? 'rpg-btn-gold'
                        : 'bg-slate-900/90 text-amber-100 border-slate-700 hover:border-amber-400'
                      }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {giftError && (
                <div className="bg-rose-600 text-white border-2 border-amber-300 rounded-xl p-2 text-xs font-bold text-center mb-2 shrink-0">
                  {giftError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 flex-1 min-h-[200px] content-start">
                {giftableItems.map((item) => {
                  const friendHas = recipientOwned.has(item.id);
                  const canAfford = senderPoints >= item.cost;
                  const busy = sendingGiftId === item.id;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl p-2.5 border-2 flex flex-col justify-between gap-2 ${friendHas
                          ? 'bg-slate-900/50 border-slate-700 opacity-65'
                          : 'bg-slate-900/90 border-amber-500/50 hover:border-amber-300'
                        }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-9 h-9 rounded-xl bg-slate-950 border border-amber-500/40 flex items-center justify-center text-xl shrink-0">
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-amber-100 truncate">
                            {item.name}
                          </div>
                          <div className="text-[10px] font-bold text-amber-300">
                            💰 {item.cost} GP
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={friendHas || !canAfford || Boolean(sendingGiftId)}
                        onClick={() => handleSendGiftItem(item)}
                        className={`w-full py-1.5 rounded-xl text-[11px] font-extrabold border cursor-pointer transition ${friendHas
                            ? 'bg-slate-800 text-slate-400 border-slate-600 cursor-not-allowed'
                            : !canAfford
                              ? 'bg-slate-800 text-rose-300 border-rose-500/50 cursor-not-allowed'
                              : 'bg-gradient-to-r from-fuchsia-500 to-amber-400 text-black border-white hover:brightness-110'
                          }`}
                      >
                        {busy
                          ? 'กำลังส่ง...'
                          : friendHas
                            ? '✓ เพื่อนมีแล้ว'
                            : !canAfford
                              ? `GP ไม่พอ (${item.cost})`
                              : `🎁 ส่งให้เพื่อน (${item.cost} 💰)`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      <LoginGateModal
        isOpen={Boolean(authChecked && currentUserId === null && !isJoinOpen)}
        qualityMode={qualityMode}
        players={players}
        champion={rankedPlayers[0] ?? competitors[0] ?? null}
        signInUsername={signInUsername}
        setSignInUsername={setSignInUsername}
        signInError={signInError}
        setSignInError={setSignInError}
        signingIn={signingIn}
        onSubmitSignIn={handleSignInSubmit}
        onOpenCreate={() => openCreateModal()}
        onSpectateGuest={() => {
          setCurrentUserId(-1);
          showToast('👀', 'เข้าชมโหมดผู้ชม', 'รับชมการแข่งขันในสนามได้ทันที (กดเข้าสู่ระบบได้ตลอดเวลา)');
        }}
      />

      {/* Desktop/iPad Roam Pill (md+) */}
      {walkingSpectatorId === null && (() => {
        const me = players.find((pl) => pl.id === currentUserId);
        if (!me || me.role === 'spectator' || isJoinOpen) return null;
        return (
          <div className="hidden md:flex fixed bottom-4 left-1/2 -translate-x-1/2 z-30 items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={handleToggleRoam}
              disabled={togglingRoam}
              className="neo-btn bg-gradient-to-r from-cyan-400 to-teal-300 text-slate-950 border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-4 py-2 rounded-full flex items-center gap-1.5 cursor-pointer shadow-[0_3px_0_#000]"
              title="ปักป้ายจองตำแหน่งบนลู่วิ่งไว้ แล้วเดินออกมาเล่นริมหาดทราย!"
            >
              <span>🚩</span>
              <span>ปักป้ายเดินเล่นริมหาด</span>
            </button>
          </div>
        );
      })()}

      {/* Mobile (< md) Thumb-Friendly Bottom Action Bar */}
      {walkingSpectatorId === null && !isJoinOpen && (() => {
        const currentUser = players.find((pl) => pl.id === currentUserId);
        return (
          <div className="flex md:hidden fixed bottom-2 inset-x-2 pb-safe z-30 flex-col items-center gap-1.5 pointer-events-none">
            <div className="flex flex-wrap items-center justify-center gap-1.5 pointer-events-auto">
              {isLunchRush && (
                <div className="bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 text-stone-950 border-2 border-white rounded-full px-3 py-1 text-[11px] font-extrabold flex items-center gap-1 shadow animate-pulse">
                  <span>💰</span>
                  <span>แย่งเหรียญเที่ยง LIVE!</span>
                </div>
              )}
              {currentUser && currentUser.role !== 'spectator' && (
                <button
                  type="button"
                  onClick={handleToggleRoam}
                  disabled={togglingRoam}
                  className="neo-btn bg-gradient-to-r from-cyan-400 to-teal-300 text-slate-950 border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-xs px-3 py-1.5 rounded-full flex items-center gap-1 cursor-pointer"
                >
                  <span>🚩</span>
                  <span>เดินเล่นริมหาด</span>
                </button>
              )}
            </div>

            {!currentUser ? (
              <button
                type="button"
                onClick={openCreateModal}
                className="pointer-events-auto neo-btn rpg-btn-gold font-[family-name:var(--font-kanit)] font-extrabold text-sm px-5 py-2.5 rounded-2xl flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 stroke-[2.5]" />
                <span>+ สร้างผู้กล้า / เข้าร่วม</span>
              </button>
            ) : (
              <div className="pointer-events-auto w-full max-w-md rpg-panel rounded-2xl p-1.5 grid grid-cols-3 gap-1.5 shadow-2xl">
                {currentUser.role !== 'spectator' ? (
                  <button
                    type="button"
                    onClick={() => {
                      const gMeta = getGoalTypeMeta(currentUser.goalType);
                      setSelectedPlayerId(currentUser.id);
                      const curVal = currentUser.currentVal ?? currentUser.currentWeight;
                      setNewWeightInput(
                        gMeta.isCumulative || curVal === undefined ? '' : String(curVal)
                      );
                      setStepInput('');
                      setStepInputMode('daily_sync');
                      setStepSyncSource('web_daily_sync');
                      setTodaySyncedSteps(currentUser.todaySyncedSteps ?? 0);
                      setLogTab('steps');
                      setModalError('');
                      setIsLogOpen(true);
                    }}
                    className="rpg-btn-green rounded-xl py-2 px-1.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                  >
                    <span className="text-base leading-none">👟</span>
                    <span className="text-[10.5px] font-extrabold leading-none">ส่งก้าว/ภารกิจ</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen((v) => !v)}
                    className="rpg-btn-green rounded-xl py-2 px-1.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
                  >
                    <span className="text-base leading-none">🏆</span>
                    <span className="text-[10.5px] font-extrabold leading-none">กระดานอันดับ</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => openWardrobeModal(currentUser, 'gacha')}
                  className="bg-gradient-to-r from-fuchsia-600 via-amber-400 to-cyan-400 text-black border-2 border-white rounded-xl py-2 px-1.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer shadow"
                >
                  <span className="text-base leading-none">🎰</span>
                  <span className="text-[10.5px] font-extrabold leading-none">Gacha</span>
                </button>

                <button
                  type="button"
                  onClick={() => openWardrobeModal(currentUser, 'armor')}
                  className="rpg-btn-blue rounded-xl py-2 px-1.5 flex flex-col items-center justify-center gap-0.5 cursor-pointer min-w-0"
                >
                  <span className="text-[10px] bg-black/50 text-amber-300 px-1.5 py-0.2 rounded border border-amber-400 font-extrabold">
                    💰 {currentUser.points ?? 100}
                  </span>
                  <span className="text-[10.5px] font-extrabold leading-none truncate max-w-full">
                    แต่งตัว/ร้านค้า
                  </span>
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {walkingSpectatorId !== null && (
        <div className="fixed bottom-3 sm:bottom-4 pb-safe left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 max-w-[95vw]">
          {nearbySpectator && (
            <div className="flex flex-col items-center gap-2">
              {isPairMenuOpen && (
                <div className="neo-card bg-white rounded-2xl p-2.5 space-y-2 shadow-[4px_4px_0px_#18181B]">
                  {(() => {
                    const nearMesh = charMeshesRef.current.find((m) => m.id === nearbySpectator.id);
                    if (!nearMesh) return null;
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          const walker = players.find((pl) => pl.id === walkingSpectatorId);
                          setPairedActivities((prev) => {
                            const next = {
                              ...prev,
                              [walkingSpectatorId]: {
                                animType: nearMesh.workoutType,
                                label: nearMesh.activityLabel,
                              },
                            };
                            try {
                              localStorage.setItem(
                                `waist_paired_activities_${getBangkok7AmDayKey()}`,
                                JSON.stringify(next)
                              );
                            } catch {
                              // ignore
                            }
                            return next;
                          });
                          setIsPairMenuOpen(false);
                          broadcastRealtimeEvent('activity', {
                            userId: walkingSpectatorId,
                            animType: nearMesh.workoutType,
                            label: nearMesh.activityLabel,
                          });
                          confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 } });
                          showToast(
                            '👯',
                            'ก๊อปปี้ท่าเพื่อนสำเร็จ!',
                            `${walker?.name || ''} ทำ ${nearMesh.activityLabel} ตาม ${nearbySpectator.name} แล้ว!`
                          );
                        }}
                        className="w-full border-2 border-black bg-[#38BDF8] hover:bg-[#7dd3fc] text-black rounded-xl px-3 py-2 text-xs font-extrabold cursor-pointer transition"
                      >
                        👯 ทำตาม {nearbySpectator.name}: {nearMesh.activityLabel}
                      </button>
                    );
                  })()}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {GROUP_PAIR_ACTIVITIES.map((act) => (
                      <button
                        key={act.animType}
                        type="button"
                        onClick={() => {
                          if (act.animType === 'volleyball') {
                            setIsPairMenuOpen(false);
                            if (liveVbLobby && liveVbLobby.count < liveVbLobby.max) {
                              setVbSession({
                                roomCode: liveVbLobby.roomCode,
                                mode: liveVbLobby.mode,
                                isHost: false,
                                targetName: liveVbLobby.hostName,
                              });
                            } else {
                              const newCode = String(Math.floor(1000 + Math.random() * 9000));
                              setVbSession({
                                roomCode: newCode,
                                mode: '1v1',
                                isHost: true,
                                targetName: nearbySpectator.name,
                              });
                            }
                            return;
                          }
                          if (act.animType === 'play_cards') {
                            setIsPairMenuOpen(false);
                            if (liveCardLobby && liveCardLobby.count < liveCardLobby.max) {
                              setCardSession({
                                roomCode: liveCardLobby.roomCode,
                                isHost: false,
                                targetName: liveCardLobby.hostName,
                              });
                            } else {
                              const newCode = String(Math.floor(1000 + Math.random() * 9000));
                              setCardSession({
                                roomCode: newCode,
                                isHost: true,
                                targetName: nearbySpectator.name,
                              });
                            }
                            return;
                          }
                          if (act.animType === 'picnic_shabu') {
                            setIsPairMenuOpen(false);
                            if (liveShabuLobby && liveShabuLobby.count < liveShabuLobby.max) {
                              setShabuSession({
                                roomCode: liveShabuLobby.roomCode,
                                isHost: false,
                                targetName: liveShabuLobby.hostName,
                              });
                            } else {
                              const newCode = String(Math.floor(1000 + Math.random() * 9000));
                              setShabuSession({
                                roomCode: newCode,
                                isHost: true,
                                targetName: nearbySpectator.name,
                              });
                            }
                            return;
                          }
                          const walker = players.find((pl) => pl.id === walkingSpectatorId);
                          setPairedActivities((prev) => {
                            const next = {
                              ...prev,
                              [walkingSpectatorId]: { animType: act.animType, label: act.label },
                              [nearbySpectator.id]: { animType: act.animType, label: act.label },
                            };
                            try {
                              localStorage.setItem(
                                `waist_paired_activities_${getBangkok7AmDayKey()}`,
                                JSON.stringify(next)
                              );
                            } catch {
                              // ignore
                            }
                            return next;
                          });
                          setIsPairMenuOpen(false);
                          broadcastRealtimeEvent('activity', {
                            updates: {
                              [walkingSpectatorId]: { animType: act.animType, label: act.label },
                              [nearbySpectator.id]: { animType: act.animType, label: act.label },
                            },
                          });
                          confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
                          showToast(
                            '🤝',
                            'ตั้งวงทำกิจกรรมคู่!',
                            `${walker?.name || ''} ชวน ${nearbySpectator.name} มา${act.label}`
                          );
                        }}
                        className={`border-2 border-black rounded-xl px-2.5 py-1.5 text-xs font-extrabold cursor-pointer transition ${act.animType === 'volleyball'
                            ? 'bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 text-black hover:brightness-105 shadow'
                            : act.animType === 'picnic_shabu'
                              ? 'bg-gradient-to-r from-orange-300 via-amber-300 to-red-400 text-black hover:brightness-105 shadow'
                              : act.animType === 'play_cards'
                                ? 'bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 text-black hover:brightness-105 shadow'
                                : 'bg-[#FEF08A] hover:bg-[#FFE600] text-black'
                          }`}
                      >
                        {act.animType === 'volleyball' && liveVbLobby && liveVbLobby.count < liveVbLobby.max
                          ? `🏐 เข้าตี้บอล (${liveVbLobby.count}/${liveVbLobby.max})`
                          : act.animType === 'picnic_shabu' && liveShabuLobby && liveShabuLobby.count < liveShabuLobby.max
                            ? `🍲 เข้าตี้ชาบู (${liveShabuLobby.count}/${liveShabuLobby.max})`
                            : act.animType === 'play_cards' && liveCardLobby && liveCardLobby.count < liveCardLobby.max
                              ? `🃏 เข้าวงไพ่ (${liveCardLobby.count}/${liveCardLobby.max})`
                              : act.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* แถวปุ่มกิจกรรมใกล้ตัวแบบแนวนอน 1 แถว (ไม่ซ้อนสูงบังจอบนมือถือ และซ่อนอัตโนมัติตอนกำลังตกปลา/ดูผลปลา) */}
          {fishingPhase === 'idle' && !fishingResult && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-[94vw]">
              {nearbySpectator && (
                <button
                  type="button"
                  onClick={() => setIsPairMenuOpen((v) => !v)}
                  className="neo-btn bg-[#FF4D8D] text-white font-[family-name:var(--font-kanit)] font-extrabold text-[11.5px] sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full cursor-pointer shadow-[0_3px_0_#000] whitespace-nowrap"
                >
                  🤝 ชวน {nearbySpectator.emoji} {nearbySpectator.name}
                  <span className="hidden sm:inline"> ทำกิจกรรม!</span>
                </button>
              )}

              {!isPairMenuOpen && isNearGuard && (
                <button
                  type="button"
                  onClick={() => openGuardPrankMenu(window.innerWidth / 2, window.innerHeight / 2)}
                  className="neo-btn bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 text-white border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-[11.5px] sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full cursor-pointer shadow-[0_3px_0_#000] whitespace-nowrap"
                >
                  😈 แกล้งพี่ยาม!
                </button>
              )}

              {!isPairMenuOpen && isNearCafe && (
                <button
                  type="button"
                  onClick={() => setIsPetCafeOpen(true)}
                  className="neo-btn bg-gradient-to-r from-pink-400 via-amber-300 to-rose-400 text-stone-950 border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-[11.5px] sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full cursor-pointer shadow-[0_3px_0_#000] whitespace-nowrap"
                >
                  ☕🐾 คาเฟ่<span className="hidden sm:inline">สัตว์เลี้ยง (Pet Café)!</span>
                </button>
              )}

              {!isPairMenuOpen && isNearDojang && (
                <button
                  type="button"
                  onClick={() => setIsTaekwondoOpen(true)}
                  className="neo-btn bg-gradient-to-r from-red-600 via-amber-400 to-blue-600 text-white border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-[11.5px] sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full cursor-pointer shadow-[0_3px_0_#000] whitespace-nowrap"
                >
                  🥋 สำนักเทควันโด<span className="hidden sm:inline"> (เตะเป้าเลื่อนสาย!)</span>
                </button>
              )}

              {!isPairMenuOpen && isNearQuestBoard && (
                <button
                  type="button"
                  onClick={() => openQuestBoard(null)}
                  className="neo-btn bg-gradient-to-b from-[#ffdf6b] via-[#f5a623] to-[#d97706] text-[#3d1b06] border-2 border-[#fff7d6] font-[family-name:var(--font-kanit)] font-extrabold text-[11.5px] sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full cursor-pointer shadow-[0_3px_0_#5c2d0c] whitespace-nowrap"
                >
                  📜 กระดานเควส<span className="hidden sm:inline"> • Mission Board!</span>
                </button>
              )}

              {!isPairMenuOpen && isNearOcean && (
                <button
                  type="button"
                  onClick={startFishing}
                  className="neo-btn bg-gradient-to-r from-sky-400 via-cyan-400 to-teal-300 text-slate-950 border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-[11.5px] sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-full cursor-pointer shadow-[0_3px_0_#000] whitespace-nowrap"
                >
                  🎣 ตกปลา<span className="hidden sm:inline">ริมทะเล!</span>
                </button>
              )}
            </div>
          )}

          {/* การ์ดผลลัพธ์ตกปลาริมทะเล */}
          {fishingResult && (() => {
            const rMeta = FISHING_RARITY_META[fishingResult.caught.rarity];
            return (
              <div
                className={`rpg-panel rounded-2xl px-3.5 py-2.5 shadow-2xl border-2 ${rMeta.cardBorderClass} max-w-[92vw] w-[320px] sm:w-[360px]`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-slate-900/90 border-2 border-amber-300/70 flex items-center justify-center text-2xl shrink-0">
                      {fishingResult.caught.icon}
                    </div>
                    <div className="min-w-0">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full border text-[9px] font-extrabold mb-0.5 ${rMeta.badgeClass}`}
                      >
                        {rMeta.label}
                      </span>
                      <div className="font-[family-name:var(--font-kanit)] font-extrabold text-sm text-amber-200 truncate">
                        {fishingResult.caught.name}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFishingResult(null)}
                    className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-rose-600 text-amber-100 text-xs font-extrabold flex items-center justify-center cursor-pointer shrink-0"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[11px] font-semibold text-amber-100/85 mt-1.5 leading-snug">
                  {fishingResult.caught.desc}
                </p>
                <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-amber-500/25">
                  <div className="text-[11px] font-extrabold">
                    {fishingResult.coinsEarned > 0 ? (
                      <span className="text-amber-300">
                        +{fishingResult.coinsEarned} 💰 ({fishingResult.dailyRewardCount}/{fishingResult.dailyRewardLimit} วันนี้)
                      </span>
                    ) : fishingResult.quotaReached ? (
                      <span className="text-rose-300">
                        👮 พี่ยามจับได้! ครบ {fishingResult.dailyRewardLimit}/{fishingResult.dailyRewardLimit} ครั้งวันนี้แล้ว (แอบตกปั่นพี่ยามต่อได้!)
                      </span>
                    ) : (
                      <span className="text-cyan-300">โหมดผู้ชม • ล็อกอินเพื่อสะสมเหรียญ!</span>
                    )}
                  </div>
                  {isNearOcean && fishingPhase === 'idle' && (
                    <button
                      type="button"
                      onClick={startFishing}
                      className="bg-cyan-400 hover:bg-cyan-300 text-slate-950 border-2 border-black rounded-lg px-2.5 py-1 text-[11px] font-extrabold cursor-pointer shrink-0"
                    >
                      🎣 ตกอีกรอบ
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {fishingPhase === 'waiting' && (
            <div className="flex flex-col items-center gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={reelInFish}
                  className="neo-btn bg-slate-900/95 hover:bg-slate-800 text-cyan-200 border-2 border-cyan-400 font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-5 py-2 rounded-full cursor-pointer shadow-xl"
                >
                  🎣 ดึงเบ็ด <span className="hidden sm:inline opacity-75 text-[11px]">(Space)</span>
                </button>
                <button
                  type="button"
                  onClick={cancelFishing}
                  className="text-[11px] font-extrabold bg-slate-800/90 hover:bg-rose-600 text-white border border-slate-500 px-3 py-2 rounded-full cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>
              <span className="text-[11px] font-bold text-cyan-100/90 bg-black/55 px-3 py-0.5 rounded-full">
                👀 รอจนตัวละครสั่นและขึ้น ❗ บนหัวค่อยกดดึง!
              </span>
            </div>
          )}

          {fishingPhase === 'bite' && (
            <button
              type="button"
              onClick={reelInFish}
              className="neo-btn bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300 text-black border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-sm sm:text-base px-6 py-2.5 rounded-full cursor-pointer shadow-[0_0_24px_rgba(250,204,21,0.9)] animate-bounce"
            >
              ❗ กดดึงเบ็ดเลย!! <span className="hidden sm:inline text-xs">(Space)</span> 🎣
            </button>
          )}

          {fishingPhase === 'reeling' && (
            <div className="bg-slate-950/90 border-2 border-amber-400 rounded-full px-4 py-1.5 text-xs font-extrabold text-amber-200 shadow-xl">
              🎣 กำลังดึงเบ็ดขึ้นมา...
            </div>
          )}

          <div className="neo-card bg-[#18181B] text-white rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-extrabold text-[#BEF264]">
              🚩 เดินเล่น: {players.find((pl) => pl.id === walkingSpectatorId)?.emoji}{' '}
              {players.find((pl) => pl.id === walkingSpectatorId)?.name}
            </span>
            <input
              type="text"
              maxLength={60}
              placeholder="💬 พิมพ์คำพูดบนหัว..."
              value={quickStatusInput}
              onFocus={() => {
                isEditingQuickStatusRef.current = true;
              }}
              onBlur={() => {
                isEditingQuickStatusRef.current = false;
              }}
              onChange={(e) => handleQuickStatusChange(e.target.value)}
              className="bg-white text-black placeholder:text-zinc-500 border-2 border-white rounded-lg px-2.5 py-1 text-xs font-semibold w-36 sm:w-44"
            />
            <button
              type="button"
              onClick={() => openRadialActivityMenu(window.innerWidth / 2, window.innerHeight / 2)}
              className="bg-[#38BDF8] text-black border-2 border-white rounded-lg px-2.5 py-1 text-xs font-extrabold cursor-pointer"
              title="สุ่มเปลี่ยนกิจกรรมริมหาด"
            >
              🎡 กิจกรรม
            </button>
            {(() => {
              const walker = players.find((pl) => pl.id === walkingSpectatorId);
              if (!walker || walker.id !== currentUserId || !walker.isRoaming) return null;
              return (
                <button
                  type="button"
                  onClick={handleToggleRoam}
                  disabled={togglingRoam}
                  className="bg-emerald-400 text-black border-2 border-white rounded-lg px-2.5 py-1 text-xs font-extrabold cursor-pointer"
                  title="เก็บป้ายแล้วพาร่างกลับเข้าลู่วิ่ง"
                >
                  🏃 กลับเข้าลู่
                </button>
              );
            })()}
          </div>
        </div>
      )}

      {radialMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setRadialMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setRadialMenu(null);
          }}
        >
          <div
            className="absolute"
            style={{ left: radialMenu.x, top: radialMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2 scale-90 sm:scale-100 w-[260px] h-[260px] rounded-full bg-black/25 backdrop-blur-xs border-2 border-dashed border-black/40 flex items-center justify-center">
              <button
                type="button"
                onClick={() => openRadialActivityMenu(radialMenu.x, radialMenu.y)}
                className="w-16 h-16 rounded-full bg-[#FFE600] text-black border-3 border-black shadow-[3px_3px_0px_#18181B] font-extrabold text-xs flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition z-10"
              >
                <span className="text-lg leading-none">🎲</span>
                <span className="text-[10px]">สุ่มใหม่</span>
              </button>
              {radialMenu.options.map((act, i) => {
                const angle = (i / radialMenu.options.length) * Math.PI * 2 - Math.PI / 2;
                const radius = 92;
                const bx = Math.cos(angle) * radius;
                const by = Math.sin(angle) * radius;
                const icon = act.label.split(' ')[0];
                const shortText = act.label.split(' ').slice(1).join(' ');
                return (
                  <button
                    key={`${act.animType}-${i}`}
                    type="button"
                    onClick={() => applySpectatorActivity(act)}
                    style={{ transform: `translate(${bx}px, ${by}px)` }}
                    className="absolute w-20 h-20 rounded-full bg-white hover:bg-[#A3E635] border-3 border-black shadow-[3px_3px_0px_#18181B] flex flex-col items-center justify-center p-1 cursor-pointer transition hover:scale-110"
                  >
                    <span className="text-xl leading-none">{icon}</span>
                    <span className="text-[9px] font-extrabold text-black leading-tight text-center line-clamp-2 mt-0.5">
                      {shortText}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {guardPrankMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setGuardPrankMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setGuardPrankMenu(null);
          }}
        >
          <div
            className="absolute"
            style={{ left: guardPrankMenu.x, top: guardPrankMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2 scale-90 sm:scale-100 w-[285px] h-[285px] rounded-full bg-rose-950/55 backdrop-blur-xs border-2 border-dashed border-amber-300/80 flex items-center justify-center shadow-[0_0_40px_rgba(244,63,94,0.45)]">
              <button
                type="button"
                onClick={() => openGuardPrankMenu(guardPrankMenu.x, guardPrankMenu.y)}
                className="w-18 h-18 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-black border-3 border-black shadow-[3px_3px_0px_#18181B] font-extrabold text-xs flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition z-10"
                title="สุ่มวิธีแกล้งพี่ยามใหม่"
              >
                <span className="text-lg leading-none">🎲</span>
                <span className="text-[10px]">สุ่มใหม่</span>
              </button>
              {guardPrankMenu.options.map((prank, i) => {
                const angle = (i / guardPrankMenu.options.length) * Math.PI * 2 - Math.PI / 2;
                const radius = 102;
                const bx = Math.cos(angle) * radius;
                const by = Math.sin(angle) * radius;
                return (
                  <button
                    key={`${prank.id}-${i}`}
                    type="button"
                    disabled={prankingGuard}
                    onClick={() => handleTriggerGuardPrank(prank)}
                    style={{ transform: `translate(${bx}px, ${by}px)` }}
                    className="absolute w-[88px] h-[88px] rounded-full bg-slate-950 hover:bg-rose-600 text-amber-100 hover:text-white border-3 border-amber-300 shadow-[3px_3px_0px_#000] flex flex-col items-center justify-center p-1 cursor-pointer transition hover:scale-110 disabled:opacity-50"
                  >
                    <span className="text-xl leading-none">{prank.icon}</span>
                    <span className="text-[9px] font-extrabold leading-tight text-center line-clamp-2 mt-0.5">
                      {prank.label}
                    </span>
                    <span className="mt-0.5 px-1.5 py-0.2 rounded-full bg-amber-400 text-black text-[8.5px] font-black">
                      {prank.cost} 💰
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {legendaryFlash && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-gradient-to-b from-amber-300/45 via-yellow-200/25 to-transparent animate-pulse" />
      )}

      {/* Live Floating Invite Banner when a friend opens a Volleyball PvP Lobby */}
      {liveVbLobby && !vbSession && !isJoinOpen && (
        <div className="fixed top-16 md:top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[92vw]">
          <div className="rpg-banner rounded-full px-3.5 py-1.5 flex items-center gap-2.5 shadow-2xl border-2 border-amber-300">
            <span className="text-base animate-bounce">🏐</span>
            <span className="text-xs font-extrabold text-amber-100 truncate">
              {liveVbLobby.hostEmoji} {liveVbLobby.hostName} ชวนตีวอลเลย์บอล {liveVbLobby.mode} ({liveVbLobby.count}/{liveVbLobby.max})
            </span>
            <button
              type="button"
              onClick={() => {
                setVbSession({
                  roomCode: liveVbLobby.roomCode,
                  mode: liveVbLobby.mode,
                  isHost: false,
                  targetName: liveVbLobby.hostName,
                });
              }}
              className="rpg-btn-gold px-3 py-1 rounded-full text-xs font-extrabold cursor-pointer shrink-0"
            >
              เข้าร่วมเลย!
            </button>
            <button
              type="button"
              onClick={() => setLiveVbLobby(null)}
              className="text-amber-200/80 hover:text-white text-xs font-bold px-1 cursor-pointer"
              title="ซ่อนแจ้งเตือน"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {vbSession && (
        <BeachVolleyballModal
          isOpen={Boolean(vbSession)}
          onClose={() => setVbSession(null)}
          players={players}
          currentUserId={currentUserId}
          qualityMode={qualityMode}
          initialRoomCode={vbSession.roomCode}
          initialMode={vbSession.mode}
          initialIsHost={vbSession.isHost}
          invitedTargetName={vbSession.targetName}
          onLobbyBroadcast={(info) => {
            broadcastRealtimeEvent('vb_lobby', { ...info });
          }}
          onRewardEarned={(earned, newPoints) => {
            showToast(
              '🏐',
              `ชนะวอลเลย์บอลชายหาด! (+${earned} 💰)`,
              `รับโบนัสผู้ชนะแล้ว สะสมรวมเป็น ${newPoints} 💰 GP!`
            );
            void fetchArenaData({ force: true });
          }}
        />
      )}

      {/* Live Floating Invite Banner when a friend opens a Shabu Co-op Buffet Lobby */}
      {liveShabuLobby && !shabuSession && !vbSession && !isJoinOpen && (
        <div
          className={`fixed ${liveVbLobby ? 'top-28 md:top-32' : 'top-16 md:top-20'} left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[92vw]`}
        >
          <div className="rpg-banner rounded-full px-3.5 py-1.5 flex items-center gap-2.5 shadow-2xl border-2 border-orange-300">
            <span className="text-base animate-bounce">🍲</span>
            <span className="text-xs font-extrabold text-amber-100 truncate">
              {liveShabuLobby.hostEmoji} {liveShabuLobby.hostName} เปิดตี้ชาบูบุฟเฟ่ต์ ({liveShabuLobby.count}/{liveShabuLobby.max})
            </span>
            <button
              type="button"
              onClick={() => {
                setShabuSession({
                  roomCode: liveShabuLobby.roomCode,
                  isHost: false,
                  targetName: liveShabuLobby.hostName,
                });
              }}
              className="rpg-btn-gold px-3 py-1 rounded-full text-xs font-extrabold cursor-pointer shrink-0"
            >
              เข้าร่วมตี้เลย!
            </button>
            <button
              type="button"
              onClick={() => setLiveShabuLobby(null)}
              className="text-amber-200/80 hover:text-white text-xs font-bold px-1 cursor-pointer"
              title="ซ่อนแจ้งเตือน"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {isPetCafeOpen && (
        <PetCafeModal
          isOpen={isPetCafeOpen}
          onClose={() => setIsPetCafeOpen(false)}
          qualityMode={qualityMode}
          playerName={players.find((pl) => pl.id === currentUserId)?.name || 'ผู้กล้า'}
        />
      )}

      {isTaekwondoOpen && (
        <TaekwondoModal
          isOpen={isTaekwondoOpen}
          onClose={() => setIsTaekwondoOpen(false)}
          currentUserId={currentUserId}
          playerName={players.find((pl) => pl.id === currentUserId)?.name || 'ผู้กล้า'}
          playerEmoji={players.find((pl) => pl.id === currentUserId)?.emoji || '🥋'}
          onPointsUpdated={() => void fetchArenaData({ force: true })}
        />
      )}

      {isQuestBoardOpen && (
        <QuestBoardModal
          isOpen={isQuestBoardOpen}
          onClose={() => setIsQuestBoardOpen(false)}
          currentUser={(() => {
            const u = players.find((pl) => pl.id === currentUserId);
            if (!u) return null;
            return {
              id: u.id,
              name: u.name,
              emoji: u.emoji,
              colorHex: u.colorHex,
              points: u.points ?? 0,
            };
          })()}
          allPlayers={players.map((pl) => ({
            id: pl.id,
            name: pl.name,
            emoji: pl.emoji,
            colorHex: pl.colorHex,
          }))}
          quests={quests}
          initialQuestId={questBoardFocusId}
          onQuestsUpdated={handleQuestsUpdated}
          onShowToast={(icon, title, desc) => showToast(icon, title, desc || '')}
        />
      )}

      {shabuSession && (
        <ShabuCoopModal
          isOpen={Boolean(shabuSession)}
          onClose={() => setShabuSession(null)}
          players={players}
          currentUserId={currentUserId}
          qualityMode={qualityMode}
          initialRoomCode={shabuSession.roomCode}
          initialIsHost={shabuSession.isHost}
          invitedTargetName={shabuSession.targetName}
          onLobbyBroadcast={(info) => {
            broadcastRealtimeEvent('shabu_lobby', { ...info });
          }}
          onRewardEarned={(earned, newPoints) => {
            showToast(
              '🍲',
              `ตั้งวงชาบูสำเร็จ! (+${earned} 💰)`,
              `รับโบนัสจากแต้มตี้ชาบูแล้ว สะสมรวมเป็น ${newPoints} 💰 GP!`
            );
            void fetchArenaData({ force: true });
          }}
        />
      )}

      {/* Live Floating Invite Banner when a friend opens a Guard Casino Card Table */}
      {liveCardLobby && !cardSession && !shabuSession && !vbSession && !isJoinOpen && (
        <div
          className={`fixed ${liveVbLobby || liveShabuLobby ? 'top-28 md:top-32' : 'top-16 md:top-20'} left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[92vw]`}
        >
          <div className="rpg-banner rounded-full px-3.5 py-1.5 flex items-center gap-2.5 shadow-2xl border-2 border-emerald-300">
            <span className="text-base animate-bounce">🃏</span>
            <span className="text-xs font-extrabold text-amber-100 truncate">
              {liveCardLobby.hostEmoji} {liveCardLobby.hostName} เปิดวงไพ่คาสิโนพี่ยาม ({liveCardLobby.count}/{liveCardLobby.max})
            </span>
            <button
              type="button"
              onClick={() => {
                setCardSession({
                  roomCode: liveCardLobby.roomCode,
                  isHost: false,
                  targetName: liveCardLobby.hostName,
                });
              }}
              className="rpg-btn-gold px-3 py-1 rounded-full text-xs font-extrabold cursor-pointer shrink-0"
            >
              เข้าวงเลย!
            </button>
            <button
              type="button"
              onClick={() => setLiveCardLobby(null)}
              className="text-amber-200/80 hover:text-white text-xs font-bold px-1 cursor-pointer"
              title="ซ่อนแจ้งเตือน"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {cardSession && (
        <CasinoCardModal
          isOpen={Boolean(cardSession)}
          onClose={() => setCardSession(null)}
          players={players}
          currentUserId={currentUserId}
          currentUserPoints={players.find((pl) => pl.id === currentUserId)?.points ?? 0}
          qualityMode={qualityMode}
          initialRoomCode={cardSession.roomCode}
          initialIsHost={cardSession.isHost}
          invitedTargetName={cardSession.targetName}
          onLobbyBroadcast={(info) => {
            broadcastRealtimeEvent('card_lobby', { ...info });
          }}
          onPointsUpdated={() => {
            void fetchArenaData({ force: true });
          }}
        />
      )}

      <GuardDanceLoader visible={!initialArenaReady} />

    </div>
  );
}
