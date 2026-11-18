'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import confetti from 'canvas-confetti';
import { Trophy, Scale, UserPlus } from 'lucide-react';
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
import { startBgm, stopBgm } from '@/lib/bgm';
import {
  computeGoalProgress,
  getGoalTypeMeta,
  resolveBreedOption,
  type GenderType,
  type GoalType,
  type ShopCategory,
  type ShopItem,
  type PropColorMap,
} from '@/lib/rpg_catalog';
import {
  WardrobeShopModal,
  LoginGateModal,
} from '@/lib/WardrobeAndAdminModals';

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

const EXCUSES = [
  { icon: '🥓', text: 'ชาบูเมื่อคืนเป็นเหตุ 🥓' },
  { icon: '🥗', text: 'คลีนจัดปลัดบอก 🥗' },
  { icon: '💧', text: 'บวมน้ำเฉยๆ ไม่ได้อ้วน 💧' },
  { icon: '👟', text: 'เดิน 10,000 ก้าวแล้ว 👟' },
  { icon: '🧋', text: 'แพ้ชานมไข่มุก 🧋' },
  { icon: '💪', text: 'กล้ามเนื้อล้วนๆ 💪' },
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
  { animType: 'badminton', label: '🏸 ตีแบดด้วยกัน' },
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
  const [roastFeed, setRoastFeed] = useState<FeedItem[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  const [isMusicOn, setIsMusicOn] = useState(false);
  const [shakeScreen, setShakeScreen] = useState(false);

  const [isLogOpen, setIsLogOpen] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number>(1);
  const [pinInput, setPinInput] = useState('');
  const [newWeightInput, setNewWeightInput] = useState('');
  const [selectedExcuse, setSelectedExcuse] = useState(EXCUSES[0].text);
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

  const [walkingSpectatorId, setWalkingSpectatorId] = useState<number | null>(null);
  const [nearbySpectator, setNearbySpectator] = useState<Player | null>(null);
  const [isPairMenuOpen, setIsPairMenuOpen] = useState(false);
  const [radialMenu, setRadialMenu] = useState<{ x: number; y: number; options: SpectatorActivity[] } | null>(null);
  const [pairedActivities, setPairedActivities] = useState<Record<number, { animType: string; label: string }>>({});

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [signInUsername, setSignInUsername] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState('');

  const walkingSpectatorIdRef = useRef<number | null>(null);
  const nearbySpectatorIdRef = useRef<number | null>(null);
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
  const openEditModalRef = useRef<(p: Player) => void>(() => {});
  const fetchArenaDataRef = useRef<(opts?: { force?: boolean; viewerId?: number | null }) => Promise<void>>(
    async () => {}
  );
  const lastDataSignatureRef = useRef<string>('');
  const clientInstanceIdRef = useRef<string>(
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const remoteSpectatorStateRef = useRef<
    Record<number, { x: number; y: number; z: number; rotY: number; isWalking: boolean; updatedAt: number }>
  >({});
  const lastMoveBroadcastAtRef = useRef<number>(0);
  const lastLocalEjectAtRef = useRef<number>(0);
  const wasWalkingRef = useRef<boolean>(false);
  const currentUserIdRef = useRef<number | null>(null);
  const claimingCoinRef = useRef<boolean>(false);
  const claimBeachCoinRef = useRef<(slotId: number, spawnToken: string) => Promise<void>>(async () => {});
  const lunchCoinsRef = useRef<Array<{ slotId: number; spawnToken: string; x: number; z: number }>>([]);
  const claimedTokensRef = useRef<Set<string>>(new Set());
  const [isLunchRush, setIsLunchRush] = useState<boolean>(false);
  const [claimingCheckin, setClaimingCheckin] = useState<boolean>(false);

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
          // หากผู้เล่นเปลี่ยนบทบาทจากผู้ชม (spectator) เป็นผู้เข้าแข่งขัน (competitor) ให้ล้างพิกัดเดินเล่นเก่าออก
          if (p.role !== 'spectator') {
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
            p.workoutType,
            p.petType,
            p.statusText,
            p.goalType,
            p.startVal,
            p.currentVal,
            p.targetVal,
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
            if (!me) {
              localStorage.removeItem('waist_user_id');
              setCurrentUserId(null);
              setWalkingSpectatorId(null);
            } else if (me.role === 'spectator' && walkingSpectatorIdRef.current === null) {
              setWalkingSpectatorId(me.id);
            } else if (me.role !== 'spectator' && walkingSpectatorIdRef.current === me.id) {
              setWalkingSpectatorId(null);
            }
          }
          const comps = nextParticipants.filter((p) => p.role !== 'spectator');
          if (comps.length > 0) {
            setSelectedPlayerId((prev) => (comps.some((p) => p.id === prev) ? prev : comps[0].id));
            setBoardTargetId((prev) => (comps.some((p) => p.id === prev) ? prev : comps[0].id));
          }
        }
        if (data.feed && Array.isArray(data.feed) && data.feed.length > 0) {
          setRoastFeed(data.feed);
        }
      } catch (e) {
        console.error(e);
      }
    },
    []
  );

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

  const broadcastArenaSync = useCallback(
    (
      reason: 'user_created' | 'user_updated' | 'weight_logged' | 'shop_updated',
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

  useEffect(() => {
    walkingSpectatorIdRef.current = walkingSpectatorId;
    if (walkingSpectatorId === null) {
      setNearbySpectator(null);
      nearbySpectatorIdRef.current = null;
      setIsPairMenuOpen(false);
      walkTargetRef.current = null;
    }
  }, [walkingSpectatorId]);

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
          } else if (payload.reason === 'weight_logged') {
            const divs = Array.isArray(payload.dividends) ? payload.dividends : [];
            const myWin = divs.find((d: any) => Number(d.userId) === currentUserIdRef.current);
            if (myWin) {
              confetti({ particleCount: 95, spread: 80, origin: { y: 0.6 } });
              if (myWin.kind === 'cheer') {
                showToast(
                  '💰',
                  `ปันผลวงแชร์เข้ากระเป๋า! (+${myWin.payout} 🪙)`,
                  `เพราะคุณส่งไฟเชียร์ให้ ${payload.actorEmoji || ''} ${payload.actorName} แล้วเพื่อนทำแต้มได้สำเร็จ!`
                );
              } else {
                showToast(
                  '😈',
                  `${myWin.jackpot ? 'แจ็กพอตซุ้มอาหาร!!' : 'แผนขุนพุงสำเร็จ!!'} (+${myWin.payout} 🪙)`,
                  `คุณส่งของกินแกล้ง ${payload.actorEmoji || ''} ${payload.actorName} จนพัฒนาการถอยหลัง รับทรัพย์เต็มๆ!`
                );
              }
            } else {
              showToast(
                '⚡',
                'อัปเดตผลภารกิจสด!',
                `${payload.actorEmoji || ''} ${payload.actorName} ส่งผลภารกิจใหม่ในสนามแล้ว!${
                  divs.length > 0 ? ` (แจกปันผล ${divs.length} คน!)` : ''
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
            '🪙',
            `${payload.winnerEmoji || '⚡'} ${payload.winnerName} ไวจัด!`,
            'แย่งชิงเหรียญทองพักเที่ยงไปได้ +1 🪙! รออีก 15 วินาทีเหรียญลูกใหม่จะสุ่มโผล่นะ!'
          );
          fetchArenaDataRef.current({ force: true });
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
              ? ` (คุณได้รับแต้มกำลังใจ +${inter.receiverBonusEarned} 🪙 ด้วย!)`
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

    // 2. Smart Background Diff-Polling + Tab Focus Sync (รับประกันการอัปเดตสด 100% ทุกกรณีโดยไม่กระพริบ)
    const pollInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
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
        .on('broadcast', { event: 'status' }, ({ payload }) => handleIncomingRealtimeEvent('status', payload))
        .on('broadcast', { event: 'activity' }, ({ payload }) => handleIncomingRealtimeEvent('activity', payload))
        .on('broadcast', { event: 'arena_sync' }, ({ payload }) =>
          handleIncomingRealtimeEvent('arena_sync', payload)
        )
        .on('broadcast', { event: 'interaction' }, ({ payload }) =>
          handleIncomingRealtimeEvent('interaction', payload)
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
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' && channel) {
            channel.send({ type: 'broadcast', event: 'hello', payload: {} });
          }
        });

      realtimeChannelRef.current = channel;
    }

    return () => {
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
    return competitors
      .map((p) => {
        const gType = p.goalType || 'weight_loss';
        const sVal = p.startVal ?? p.startWeight;
        const cVal = p.currentVal ?? p.currentWeight;
        const tVal = p.targetVal ?? p.goalWeight;
        const hasOwnVals =
          typeof sVal === 'number' && typeof cVal === 'number' && typeof tVal === 'number';
        const { pct, diffLabel, isInFoodStall } = hasOwnVals
          ? computeGoalProgress(gType, sVal, cVal, tVal)
          : {
              pct: p.progressPct ?? 0,
              diffLabel: p.diffLabel ?? '',
              isInFoodStall: Boolean(p.isInFoodStall),
            };
        const progressRatio = Math.max(0, Math.min(1, pct / 100));
        const negRatio = pct < 0 ? Math.min(1, Math.abs(pct) / 45) : 0;

        let bellyScale = 1.0;
        let muscleScale = 1.0;
        const hasBmiScale = typeof p.bmiBellyScale === 'number';
        if (gType === 'muscle_gain') {
          bellyScale = hasBmiScale
            ? Math.max(0.88, Math.min(1.45, p.bmiBellyScale! * 0.94 + (isInFoodStall ? 0.1 : 0)))
            : isInFoodStall
            ? 1.18
            : 1.04;
          muscleScale = Math.max(0.92, 1.05 + progressRatio * 0.65 - negRatio * 0.12);
        } else if (hasBmiScale) {
          bellyScale = Math.max(
            0.75,
            Math.min(1.55, p.bmiBellyScale! + (isInFoodStall ? 0.08 : 0))
          );
          if (gType === 'reps_accumulate' || gType === 'distance_accumulate') {
            muscleScale = 1.1 + progressRatio * 0.25;
          }
        } else if (gType === 'weight_loss') {
          bellyScale = Math.max(0.78, Math.min(1.55, 1.25 - progressRatio * 0.42 + negRatio * 0.25));
        } else if (gType === 'weight_gain') {
          bellyScale = Math.max(0.76, Math.min(1.45, 0.86 + progressRatio * 0.45 - negRatio * 0.08));
        } else {
          bellyScale = 0.94;
          muscleScale = 1.1 + progressRatio * 0.25;
        }

        return {
          ...p,
          goalType: gType,
          progressPct: pct,
          diffLabel,
          isInFoodStall,
          lostKg: hasOwnVals ? Number((sVal - cVal).toFixed(1)) : undefined,
          pctLost: pct,
          progressRatio,
          bellyScale,
          muscleScale,
        };
      })
      .sort((a, b) => (b.progressPct ?? 0) - (a.progressPct ?? 0));
  }, [competitors]);

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
        p.workoutType,
        p.petType,
        p.goalType,
        p.startVal,
        p.currentVal,
        p.targetVal,
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
        JSON.stringify(p.propColors || {}),
        p.cheerCount,
        p.temptCount,
      ])
    );
  }, [players]);

  const focusOnCharacter = useCallback((playerId: number) => {
    const charObj = charMeshesRef.current.find((c) => c.id === playerId);
    if (!charObj) return;
    const pos = charObj.rootGroup.position;
    cameraLookAtRef.current.set(pos.x, 1.6, pos.z);
    cameraTargetPosRef.current = new THREE.Vector3(pos.x + 2.5, 5.2, pos.z + 7.5);
  }, []);

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
    const pad = 145;
    const x = Math.max(pad, Math.min(window.innerWidth - pad, cx));
    const y = Math.max(pad, Math.min(window.innerHeight - pad, cy));
    setRadialMenu({ x, y, options: shuffled });
  }, []);

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
      setJoinRole(p.role === 'spectator' ? 'spectator' : 'competitor');
      setJoinWorkout(isEatPath(p.workoutType) ? 'eat' : 'fit');
      setJoinPet(p.petType || 'none');
      setJoinGoalType((p.goalType as GoalType) || 'weight_loss');
      const sVal = p.startVal ?? p.startWeight ?? 0;
      const tVal = p.targetVal ?? p.goalWeight ?? 0;
      const bwVal = p.bodyWeight ?? p.currentVal ?? p.currentWeight ?? sVal;
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

  useEffect(() => {
    openEditModalRef.current = openEditModal;
  }, [openEditModal]);

  const getOverviewCameraPos = () => {
    const isPortrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
    const extra = Math.max(0, players.length - 6) * 0.95;
    return isPortrait
      ? new THREE.Vector3(-2, 30 + extra, 46 + extra * 1.3)
      : new THREE.Vector3(-2, 22 + extra, 34 + extra * 1.15);
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
    if (!canvasRef.current || !labelsRef.current) return;

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
    scene.fog = new THREE.FogExp2(initWeather.targetHex, 0.0065);

    const spectatorList = players.filter((pl) => pl.role === 'spectator');
    const laneCount = Math.min(20, Math.max(6, competitors.length));
    const halfLen = Math.min(
      40,
      Math.max(23, 20 + Math.floor(Math.max(competitors.length, spectatorList.length) * 0.45))
    );
    const trackWidth = laneCount * 2.55 + 1.2;
    const specPerSide = Math.max(1, Math.ceil(spectatorList.length / 2));
    const specRows = Math.max(1, Math.ceil(specPerSide / 14));
    const islandCenterX = -4.0;
    const islandW = halfLen * 2 + 36;
    const islandD = Math.max(54, trackWidth + 32 + (specRows - 1) * 6.5);

    // 3D Rain particles (synced with Bangkok weather)
    const rainCount = 520;
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
    const starCount = 200;
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

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controls.minDistance = 4.5;
    controls.maxDistance = 165;
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
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;

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
      // Glowing magic rune circle in the center of the arena
      tCtx.save();
      tCtx.translate(512, 512);
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
    const foodStallCompetitorList = rankedPlayers.filter((r) => r.isInFoodStall);
    const activeTrackCompetitorCount = Math.max(0, competitors.length - foodStallCompetitorList.length);
    let compIdx = 0;
    let foodStallIdx = 0;
    let specIdx = 0;

    players.forEach((p, idx) => {
      const isSpectator = p.role === 'spectator';
      const rankedInfo = !isSpectator ? rankedPlayers.find((r) => r.id === p.id) : undefined;
      const rankIndex = !isSpectator ? rankedPlayers.findIndex((r) => r.id === p.id) : -1;
      const isInFoodStall = Boolean(!isSpectator && rankedInfo?.isInFoodStall);
      const style = STYLES[idx % STYLES.length];

      const indexInSpectators = isSpectator ? spectatorList.findIndex((pl) => pl.id === p.id) : 0;
      const customPair = isSpectator ? pairedActivities[p.id] : undefined;
      const dailyAct = isSpectator
        ? customPair ||
          getDailySpectatorActivity(p.id, p.workoutType, spectatorList.length, indexInSpectators)
        : null;

      let slackerAct: ReturnType<typeof getFoodStallSlackerActivity> | null = null;
      let targetPos = new THREE.Vector3(0, 0.2, 0);
      let facingY = 0;

      if (isSpectator) {
        const currentSpec = specIdx++;
        const side = currentSpec % 2 === 0 ? 1 : -1;
        const sideIdx = Math.floor(currentSpec / 2);
        const maxPerRow = 14;
        const row = Math.floor(sideIdx / maxPerRow);
        const idxInRow = sideIdx % maxPerRow;
        const rowTotal = Math.min(maxPerRow, Math.max(1, specPerSide - row * maxPerRow));
        const staggerT = (row % 2) * 0.025;
        const t = Math.min(
          0.95,
          0.05 + staggerT + (rowTotal > 1 ? idxInRow / (rowTotal - 1) : 0.5) * 0.88
        );
        const pt = trackCurve.getPointAt(t);
        const tan = trackCurve.getTangentAt(t);
        const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const dist = trackWidth / 2 + 2.8 + row * 3.4;
        targetPos = pt.clone().addScaledVector(normal, side * dist);
        targetPos.y = 0.2;
        const inward = normal.clone().multiplyScalar(-side);
        facingY = Math.atan2(-inward.z, inward.x);
      } else if (isInFoodStall) {
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
        targetPos.set(xPos, 0.2, zOff);
        // หันหน้าเฉียงออกหาผู้ชมและลู่วิ่งจะได้เห็นท่านั่งกิน/นอนกลิ้งชัดๆ
        facingY = zOff > 0.5 ? 0.38 : zOff < -0.5 ? -0.38 : -0.18;
      } else {
        const currentComp = compIdx++;
        const laneSlot = currentComp % laneCount;
        const tierInLane = Math.floor(currentComp / laneCount);
        const baseT = Math.max(
          0.03,
          Math.min(0.95, 0.04 + (rankedInfo?.progressRatio ?? 0) * 0.9)
        );
        const t = Math.max(0.025, Math.min(0.96, baseT + (tierInLane > 0 ? (tierInLane % 3 - 1) * 0.016 : 0)));
        const pt = trackCurve.getPointAt(t);
        const tan = trackCurve.getTangentAt(t);
        const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        // จัดตำแหน่งนักวิ่งแต่ละคนให้อยู่กึ่งกลางช่องลู่ของตัวเองพอดี ไม่เหยียบเส้นขาว
        const laneCenterRatio = (laneSlot + 0.5) / laneCount - 0.5;
        const laneSpread = laneCenterRatio * (trackWidth - 0.8);
        targetPos = pt.clone().addScaledVector(normal, laneSpread);
        targetPos.y = 0.2;
        facingY = Math.atan2(-tan.z, tan.x);
      }

      const activePropType = dailyAct
        ? dailyAct.animType
        : slackerAct
        ? slackerAct.animType
        : '';
      const initialBellyScale = rankedInfo?.bellyScale ?? p.bmiBellyScale ?? 1;
      const initialMuscleScale = rankedInfo?.muscleScale ?? 1;
      const powerMeta = !isSpectator
        ? resolvePowerBoostMeta(p.cheerCount ?? 0, p.temptCount ?? 0)
        : null;
      const charParts = buildCharacterMesh({
        colorHex: p.colorHex || style.bodyColor,
        accessory: 'none',
        bandColor: p.bandColor || style.bandColor,
        bellyScale: initialBellyScale,
        muscleScale: initialMuscleScale,
        showDumbbells: !isSpectator && !isInFoodStall && p.goalType === 'muscle_gain',
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
        animMode: isSpectator || isInFoodStall ? 'spectator' : 'run',
        animSeed: idx,
        netPower: powerMeta ? powerMeta.netPower : 0,
      });
      const { rootGroup, bounceGroup, bodyMesh, legL, legR, armL, armR, normalEyes, happyFace, angryFace } = charParts;
      const savedPos = isSpectator ? savedSpectatorPosRef.current[p.id] : undefined;
      if (savedPos) {
        targetPos.set(savedPos.x, savedPos.y, savedPos.z);
        facingY = savedPos.rotY;
      }
      rootGroup.position.copy(targetPos);
      rootGroup.rotation.y = facingY;
      rootGroup.userData.playerId = p.id;

      const petType =
        p.equipPetGear && p.equipPetGear !== 'pet_none'
          ? p.equipPetGear
          : !isSpectator
          ? p.petType || 'none'
          : 'none';
      const petParts = buildPetMesh(petType, p.propColors?.pet);
      if (petParts) {
        rootGroup.add(petParts.petGroup);
        if (petParts.leashMesh) rootGroup.add(petParts.leashMesh);
      }

      if (!isSpectator && powerMeta) {
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
      tagEl.className = 'player-tag flex flex-col items-center';
      tagEl.onclick = () => {
        if (p.role !== 'spectator') {
          openEditModal(p);
        } else {
          focusOnCharacter(p.id);
        }
      };

      const escapeHtml = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const trimmedStatus = (p.statusText || '').trim();
      const speechHtml = `<div data-speech-bubble class="mb-1 bg-[#FFFDF7] border-2 border-amber-500 rounded-2xl px-3 py-1 shadow-[0_3px_0_#422006] text-xs font-extrabold text-black max-w-[200px] truncate ${trimmedStatus ? '' : 'hidden'}">💬 ${escapeHtml(trimmedStatus)}</div>`;

      if (isSpectator) {
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
        const slackerHtml =
          isInFoodStall && slackerAct
            ? `<div class="mt-1 px-2 py-0.5 rounded-full bg-rose-600/95 border border-amber-300 text-[10px] font-extrabold text-amber-100 shadow-sm">${escapeHtml(slackerAct.statusBadge)} • ${escapeHtml(slackerAct.label)}</div>`
            : '';

        tagEl.innerHTML = `
          ${speechHtml}
          <div class="rpg-banner rounded-xl px-3 py-1 text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1 font-[family-name:var(--font-kanit)] font-extrabold text-xs text-amber-200">
              <span>${rankLabel}</span>
              <span>${p.emoji} ${escapeHtml(p.name)}</span>
              <span class="${pctColorClass}">(${pctVal}%)</span>
            </div>
            <div class="flex items-center justify-center gap-1 text-[10px] font-bold text-amber-100/90 mt-0.5">
              <span class="px-1.5 py-0.2 rounded bg-black/50 border border-amber-500/50">${gMeta.shortTag}</span>
              ${powerPillHtml}
            </div>
            ${slackerHtml}
          </div>
          <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-amber-400 mx-auto"></div>
        `;
      }
      labelsContainer.appendChild(tagEl);

      meshes.push({
        id: p.id,
        player: p,
        isSpectator,
        isInFoodStall,
        cheerCount: p.cheerCount ?? 0,
        temptCount: p.temptCount ?? 0,
        isCloseToFinish: !isSpectator && (rankedInfo?.progressRatio ?? 0) >= 0.6,
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
    // 🪙 ศึกแย่งเหรียญทองพักเที่ยง 3D (โผล่เฉพาะ จันทร์–ศุกร์ 12:00–13:00 น. เหรียญละ +1 🪙 แย่งกันทั้งห้อง!)
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
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
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
      if (oceanMesh) {
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

        const targetCol = new THREE.Color(targetHex);
        skyColor.lerp(targetCol, 0.03);
        scene.background = skyColor;
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.lerp(targetCol, 0.03);
        }
        dirLight.color.lerp(new THREE.Color(targetLightHex), 0.04);
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
          const plumbobMountLift = (c.charParts?.riderGroup?.position.y ?? 0) * hScale;
          plumbobMesh.visible = true;
          plumbobMesh.position.set(
            c.rootGroup.position.x,
            c.rootGroup.position.y + plumbobMountLift + 3.55 * hScale + Math.sin(elapsed * 3.5) * 0.14,
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
        } else {
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

        const riderLift = (c.charParts?.riderGroup?.position.y ?? 0) * hScale;

        if (c.id === leaderIdRef.current) {
          crownMesh.position.set(
            c.rootGroup.position.x + 0.05,
            c.rootGroup.position.y + riderLift + c.bounceGroup.position.y + 2.85 * hScale + Math.sin(elapsed * 4) * 0.08,
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

        const headWorldPos = new THREE.Vector3(
          c.rootGroup.position.x,
          c.rootGroup.position.y + riderLift + 3.15 * hScale,
          c.rootGroup.position.z
        );
        headWorldPos.project(camera);

        if (headWorldPos.z < 1) {
          const x = (headWorldPos.x * 0.5 + 0.5) * window.innerWidth;
          const rawY = (-headWorldPos.y * 0.5 + 0.5) * window.innerHeight;
          const headerBottom = headerRef.current ? headerRef.current.getBoundingClientRect().bottom : 88;
          const minBottomY = headerBottom + 12 + (c.tagEl.offsetHeight || 100);
          const y = c.id === currentUserId ? Math.max(minBottomY, rawY) : rawY;
          c.tagEl.style.left = `${x}px`;
          c.tagEl.style.top = `${y}px`;
          c.tagEl.style.opacity = '1';
          c.tagEl.style.zIndex = String(Math.round((1 - headWorldPos.z) * 100));
        } else {
          c.tagEl.style.opacity = '0';
        }
      });
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
        // โหมดสงบ: เดินกลับป้อมทางม้าลาย ยืนกินหมูกรอบเหล่ซ้าย-ขวาชิลๆ
        setCharacterExpression(guardParts, 'normal');
        if (guardBadgeEl && currentGuardBadgeKey !== 'idle') {
          currentGuardBadgeKey = 'idle';
          guardBadgeEl.className =
            'bg-[#18181B] text-[#FFE600] border-2 border-[#FFE600] rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10px] font-extrabold whitespace-nowrap hover:scale-105 transition';
          guardBadgeEl.textContent = '🍴 พี่ยามคุมลู่สายกิน (ข้ามเฉพาะทางม้าลาย!)';
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
          }
        }
      });

      const guardHeadPos = new THREE.Vector3(
        guardParts.rootGroup.position.x,
        guardParts.rootGroup.position.y + 3.45,
        guardParts.rootGroup.position.z
      );
      guardHeadPos.project(camera);
      if (guardHeadPos.z < 1) {
        guardTagEl.style.left = `${(guardHeadPos.x * 0.5 + 0.5) * window.innerWidth}px`;
        guardTagEl.style.top = `${(-guardHeadPos.y * 0.5 + 0.5) * window.innerHeight}px`;
        guardTagEl.style.opacity = '1';
      } else {
        guardTagEl.style.opacity = '0';
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
      el.className = `thought-bubble border-2 border-black rounded-full px-2.5 py-1 text-xs font-extrabold shadow-[2px_2px_0px_#18181B] whitespace-nowrap ${
        charObj.isCloseToFinish ? 'bg-[#FF4D8D] text-white' : 'bg-[#FFFDF7] text-black'
      }`;
      el.style.left = `${sx}px`;
      el.style.top = `${sy}px`;
      el.textContent = text;
      labelsContainer.appendChild(el);
      setTimeout(() => el.remove(), 1400);
    };

    const getPointerHitBelly = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(meshes.map((m) => m.bodyMesh), true);
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
      const hitChar = getPointerHitBelly(e);
      if (!hitChar) return;
      const now = performance.now();
      hitChar.rubbedUntil = now + 750;
      if (now - hitChar.lastBubbleAt > 340) {
        hitChar.lastBubbleAt = now;
        spawnThoughtBubble(hitChar);
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

      // คลิกเก็บเหรียญทองนำโชค 3D บนชายหาด! (+10 🪙)
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

      const hits = raycaster.intersectObjects(meshes.map((m) => m.rootGroup), true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && obj.userData.playerId === undefined) {
          obj = obj.parent;
        }
        if (obj?.userData.playerId !== undefined) {
          const found = playersRef.current.find((pl) => pl.id === obj!.userData.playerId);
          if (found) {
            if (found.role !== 'spectator') {
              openEditModalRef.current(found);
            } else {
              focusOnCharacter(found.id);
            }
          }
          return;
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
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      savedCameraPosRef.current = camera.position.clone();
      cameraLookAtRef.current.copy(controls.target);
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
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneSignature, pairedActivities, currentUserId]);

  const handleDailyCheckin = async () => {
    if (!currentUserId || currentUserId <= 0 || claimingCheckin) return;
    setClaimingCheckin(true);
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, type: 'daily_checkin' }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('🌅', 'เช็คอินวันนี้แล้ว', data.error || 'พรุ่งนี้มารับใหม่นะ');
      } else {
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.28 } });
        showToast(
          '🎁',
          `รับโบนัสเช็คอินรายวัน +${data.earned} 🪙!`,
          `สะสมเป็น ${data.points} 🪙 แล้ว! (อย่าลืมมาแย่งเหรียญพักเที่ยง จ.-ศ. 12:00-13:00 น. นะ!)`
        );
        await fetchArenaData({ force: true });
      }
    } catch {
      showToast('❌', 'เช็คอินไม่สำเร็จ', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setClaimingCheckin(false);
    }
  };

  claimBeachCoinRef.current = async (slotId: number, spawnToken: string) => {
    const uid = currentUserIdRef.current;
    if (!uid || uid <= 0) {
      claimedTokensRef.current.delete(spawnToken);
      showToast('🪙', 'เข้าสู่ระบบเพื่อแย่งเหรียญ!', 'ล็อกอินหรือสร้างตัวละครก่อน แล้วมาร่วมศึกชิงเหรียญพักเที่ยงได้เลย!');
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
          '🪙',
          `ชิงเหรียญพักเที่ยงสำเร็จ! (+${data.earned} 🪙)`,
          `มือไวสุดในสนาม! สะสมรวมเป็น ${data.points} 🪙 แล้ว!`
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

  const handleWeightSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');
    setSubmitting(true);

    const activeUserId = currentUserId || selectedPlayerId;
    try {
      const res = await fetch('/api/weights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeUserId,
          isSelf: true,
          weight: parseFloat(newWeightInput),
          value: parseFloat(newWeightInput),
          excuseTag: selectedExcuse,
        }),
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

        if (data.earnedPoints > 0 || data.diff < 0) {
          confetti({ particleCount: 85, spread: 72, origin: { y: 0.6 } });
        }

        const cheerWinners = divs.filter((d) => d.kind === 'cheer');
        const temptWinners = divs.filter((d) => d.kind === 'tempt');
        if (cheerWinners.length > 0) {
          const names = cheerWinners.map((w) => `${w.emoji}${w.name} (+${w.payout}🪙)`).join(', ');
          showToast(
            '🤝',
            `คุณรับ +${data.earnedPoints} 🪙 & แจกปันผลวงแชร์!`,
            `กองเชียร์รับปันผลไปด้วย: ${names}`
          );
        } else if (temptWinners.length > 0) {
          const names = temptWinners.map((w) => `${w.emoji}${w.name} (+${w.payout}🪙)`).join(', ');
          showToast(
            '😈',
            'พลาดท่าให้สายมารขุนพุง!!',
            `แก๊งแกล้งเพื่อนรับทรัพย์ไปเต็มๆ: ${names}`
          );
        } else if (data.earnedPoints > 0) {
          showToast(
            '🪙',
            `อัปเดตภารกิจสำเร็จ! รับ +${data.earnedPoints} 🪙`,
            data.dailyLogBonus > 0
              ? `รวมโบนัสส่งผลรายวัน +${data.dailyLogBonus} 🪙 แล้ว! (มีทั้งหมด ${data.points} 🪙)`
              : data.roast || 'พุ่งเข้าใกล้เส้นชัยไปอีกขั้น!'
          );
        } else {
          showToast('⚖️', 'อัปเดตภารกิจแล้ว!', data.roast || 'บันทึกค่าล่าสุดเรียบร้อย!');
        }

        setIsLogOpen(false);
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

  const handleSpinGacha = async (): Promise<ShopItem> => {
    const targetUid = editingPlayerId || currentUserId;
    if (!targetUid) {
      throw new Error('กรุณาเข้าสู่ระบบก่อนหมุนกาชาปอง');
    }
    const res = await fetch('/api/gacha', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUid }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'หมุนกาชาปองไม่สำเร็จ');
    }
    await fetchArenaData({ force: true });
    broadcastArenaSync('shop_updated', {
      actorId: targetUid,
      detail: `🎰 สุ่มกาชาปองได้ ${data.wonItem?.icon || ''} ${data.wonItem?.name || ''}!`,
    });
    return data.wonItem as ShopItem;
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
        if (data.user.role === 'spectator') {
          setWalkingSpectatorId(data.user.id);
        } else {
          setSelectedPlayerId(data.user.id);
        }
        setSignInUsername('');
        await fetchArenaData({ force: true, viewerId: data.user.id });
        showToast(
          '👋',
          'เข้าสู่ระบบสำเร็จ!',
          data.user.role === 'spectator'
            ? `ยินดีต้อนรับ ${data.user.emoji} ${data.user.name} — ใช้ WASD / ลูกศร หรือแตะพื้นเพื่อเดินเล่นได้เลย!`
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
        role: joinRole,
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
        propColors: joinPropColors,
        goalType: joinGoalType,
        bodyWeight: effectiveBodyWeightStr ? parseFloat(effectiveBodyWeightStr) : 0,
        heightCm: joinHeightCm ? parseFloat(joinHeightCm) : 0,
        gender: joinGender,
        startVal: joinRole === 'competitor' && effectiveStartStr ? parseFloat(effectiveStartStr) : 0,
        targetVal: joinRole === 'competitor' && joinGoal ? parseFloat(joinGoal) : 0,
        startWeight: joinRole === 'competitor' && effectiveStartStr ? parseFloat(effectiveStartStr) : 0,
        goalWeight: joinRole === 'competitor' && joinGoal ? parseFloat(joinGoal) : 0,
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
          if (joinRole === 'competitor') setSelectedPlayerId(Number(data.id));
        }
        if (joinRole === 'spectator' && activeId) {
          setWalkingSpectatorId(activeId);
        } else if (isEdit && editingPlayerId === walkingSpectatorId && joinRole === 'competitor') {
          setWalkingSpectatorId(null);
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
    setSendingBoard(true);
    try {
      const effectiveSenderId =
        currentUserId && currentUserId > 0
          ? currentUserId
          : boardSenderId
          ? Number(boardSenderId)
          : null;
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
          inter.senderBonusEarned > 0 ? ` (รับโบนัส +${inter.senderBonusEarned} 🪙!)` : '';
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
      }
    } catch {
      showToast('❌', 'ส่งไม่สำเร็จ', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSendingBoard(false);
    }
  };

  useEffect(() => {
    if (currentUserId === null) {
      setQuickStatusInput('');
      return;
    }
    const me = players.find((p) => p.id === currentUserId);
    if (me) {
      setQuickStatusInput(me.statusText || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

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
    broadcastRealtimeEvent('status', { userId: currentUserId, statusText: trimmed });
    if (statusSaveTimerRef.current) clearTimeout(statusSaveTimerRef.current);
    const targetUserId = currentUserId;
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
      }
    }, 400);
  };

  const selectedPlayerObj = players.find((p) => p.id === selectedPlayerId);

  return (
    <div className={`w-full h-dvh overflow-hidden relative ${shakeScreen ? 'shake-active' : ''}`}>
      <div ref={canvasRef} className="fixed inset-0 w-full h-full z-[1] touch-none cursor-grab active:cursor-grabbing" />
      <div ref={labelsRef} className="fixed inset-0 pointer-events-none z-10 overflow-hidden" />

      <header ref={headerRef} className="fixed top-3 left-3 right-3 z-20 pointer-events-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="rpg-banner rounded-2xl px-4 py-2.5 pointer-events-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-400 border-2 border-amber-100 rounded-xl flex items-center justify-center text-xl shadow-[0_2px_0_#422006] shrink-0">
            ⚔️
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="font-[family-name:var(--font-kanit)] font-extrabold text-base sm:text-lg text-amber-300 leading-none drop-shadow">
                ศึกชิงบัลลังก์เอวเอส 3D
              </h1>
              <span className="bg-emerald-500 text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                MMO ARENA
              </span>
            </div>
            <p className="text-[11px] font-semibold text-amber-100/80 mt-0.5">
              รวมทุกสายในสนามเดียวด้วย Progress % • ทุก +1% รับ +15 🪙 แต้มแลกเสื้อผ้า &amp; พรอพ!
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {isLunchRush && (
            <div
              className="bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-400 text-stone-950 border-2 border-white rounded-xl px-2.5 py-1.5 text-xs font-extrabold flex items-center gap-1.5 shadow-[0_2px_0_#000] animate-pulse"
              title="เปิดเฉพาะวันจันทร์–ศุกร์ เวลา 12:00–13:00 น. คลิกหรือเดินชนเหรียญทองบนหาดทราย แย่งกันรับเหรียญละ +1 🪙!"
            >
              <span>🪙</span>
              <span>แย่งเหรียญเที่ยง LIVE! (+1🪙)</span>
            </div>
          )}

          {bkkWeather && (
            <div
              className="rpg-panel rounded-xl px-2.5 py-1.5 text-amber-200 text-xs font-extrabold flex items-center gap-1.5"
              title={`สภาพอากาศกรุงเทพฯ ล่าสุด: ${bkkWeather.label} ${bkkWeather.temp}°C`}
            >
              <span>{bkkWeather.emoji}</span>
              <span>กทม. {bkkWeather.temp}°C</span>
              <span className="hidden lg:inline text-amber-100/75 font-bold">· {bkkWeather.label}</span>
            </div>
          )}

          <div className="rpg-panel rounded-xl p-1 flex items-center gap-1">
            <button
              onClick={() => setCameraView('overview')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-100 hover:bg-amber-400 hover:text-black transition cursor-pointer flex items-center gap-1"
            >
              🎥 <span className="hidden md:inline">มุมมองรวม</span>
            </button>
            <button
              onClick={() => setCameraView('leader')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-100 hover:bg-amber-400 hover:text-black transition cursor-pointer flex items-center gap-1"
            >
              👑 <span className="hidden md:inline">ซูมผู้นำ</span>
            </button>
            <button
              onClick={() => setCameraView('loser')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-100 hover:bg-rose-500 hover:text-white transition cursor-pointer flex items-center gap-1"
            >
              🔥 <span className="hidden md:inline">ส่องคนรั้งท้าย</span>
            </button>
          </div>

          <button
            onClick={toggleMusic}
            className={`neo-btn font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer ${
              isMusicOn ? 'rpg-btn-gold' : 'rpg-panel text-amber-100'
            }`}
            title="เปิด/ปิดเพลงประกอบ"
          >
            <span>{isMusicOn ? '🔊' : '🔇'}</span>
          </button>

          <button
            onClick={() => setIsDrawerOpen((v) => !v)}
            className="neo-btn rpg-panel text-amber-200 font-bold text-xs px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">อันดับ</span>
          </button>

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
            return (
              <div className="flex items-center gap-1.5">
                {!currentUser.checkedInToday && (
                  <button
                    onClick={handleDailyCheckin}
                    disabled={claimingCheckin}
                    className="neo-btn rpg-btn-gold font-[family-name:var(--font-kanit)] font-extrabold text-xs px-3 py-2 rounded-xl flex items-center gap-1 cursor-pointer animate-bounce"
                    title="รับโบนัสเช็คอินรายวันฟรี +10 🪙!"
                  >
                    <span>🎁</span>
                    <span>เช็คอิน +10🪙</span>
                  </button>
                )}
                <button
                  onClick={() => openWardrobeModal(currentUser, 'gacha')}
                  className="neo-btn bg-gradient-to-r from-fuchsia-600 via-amber-400 to-cyan-400 text-black border-2 border-white font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-[0_3px_0_#000]"
                  title="เปิดตู้สุ่มกาชาปองลุ้นชุดและออร่าลิมิเต็ด!"
                >
                  <span>🎰</span>
                  <span className="hidden sm:inline">กาชาปอง</span>
                </button>
                <button
                  onClick={() => openWardrobeModal(currentUser, 'armor')}
                  className="neo-btn rpg-btn-blue font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  title="เปิดหน้าต่างแต่งตัว 3D & ร้านค้าแต้ม"
                >
                  <span>{currentUser.emoji}</span>
                  <span>{currentUser.name}</span>
                  <span className="text-[10px] bg-black/50 text-amber-300 px-1.5 py-0.5 rounded border border-amber-400">
                    🪙 {currentUser.points ?? 100}
                  </span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="neo-btn rpg-panel text-amber-200 font-bold text-xs px-2.5 py-2 rounded-xl cursor-pointer"
                  title="สลับบัญชี"
                >
                  สลับ
                </button>
              </div>
            );
          })()}

          {(() => {
            const currentUser = players.find((pl) => pl.id === currentUserId);
            if (!currentUser || currentUser.role === 'spectator') return null;
            const gMeta = getGoalTypeMeta(currentUser.goalType);
            return (
              <button
                onClick={() => {
                  setSelectedPlayerId(currentUser.id);
                  const curVal = currentUser.currentVal ?? currentUser.currentWeight;
                  setNewWeightInput(
                    gMeta.isCumulative || curVal === undefined ? '' : String(curVal)
                  );
                  setModalError('');
                  setIsLogOpen(true);
                }}
                className="neo-btn rpg-btn-green font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-3.5 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Scale className="w-4 h-4 stroke-[2.5]" />
                <span>+ ส่งผลภารกิจ ({gMeta.shortTag})</span>
              </button>
            );
          })()}
        </div>
      </header>

      <aside
        className={`fixed top-32 sm:top-20 right-3 bottom-3 w-[345px] max-w-[calc(100vw-24px)] z-20 flex flex-col gap-3 transition-transform duration-300 pointer-events-none ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-[120%]'
        }`}
      >
        <div className="rpg-panel rounded-2xl p-3.5 pointer-events-auto flex flex-col max-h-[58%]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-amber-500/40 shrink-0">
            <h2 className="font-[family-name:var(--font-kanit)] font-extrabold text-base text-amber-300 flex items-center gap-1.5">
              <span>🏆 อันดับผู้กล้าในสนาม</span>
            </h2>
            <span className="text-[10px] font-extrabold bg-amber-400 text-black px-2 py-0.5 rounded-full">
              Progress %
            </span>
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
                    className={`rounded-xl p-2 flex items-center justify-between gap-2 cursor-pointer hover:translate-x-0.5 transition border-2 ${
                      isFirst
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
                          {p.isInFoodStall && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-rose-600 text-amber-100 border border-amber-300 shrink-0">
                              🍖 ซุ้มอาหาร
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] font-semibold text-amber-200/80 flex flex-wrap items-center gap-1">
                          <span className="px-1 rounded bg-black/50 border border-amber-500/40">
                            {gMeta.shortTag}
                          </span>
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
                        className={`font-[family-name:var(--font-kanit)] font-extrabold text-sm ${
                          pctVal < 0 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {pctVal}%
                      </div>
                      <div className="text-[9px] font-bold text-amber-300/80">🪙 {p.points ?? 100}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </aside>

      <div className="fixed bottom-3 left-3 z-20 pointer-events-none hidden sm:block">
        <div className="rpg-panel rounded-xl px-3 py-1.5 text-[11px] font-bold text-amber-200 flex items-center gap-2">
          <span>🖱️ ลากเพื่อหมุนกล้อง</span>
          <span>•</span>
          <span>🔍 สกรอลล์เพื่อซูม</span>
          <span>•</span>
          <span>👆 คลิกผู้กล้าเพื่อส่งกำลังใจ/ของกิน</span>
          <span>•</span>
          <span>🤚 ลูบพุงดูอาการ!</span>
        </div>
      </div>

      {/* Bottom-Right RPG Progress Bar HUD for Competitor (matching Reference Image 2) */}
      {(() => {
        const me = rankedPlayers.find((pl) => pl.id === currentUserId);
        if (!me) return null;
        const pct = me.progressPct ?? 0;
        const gMeta = getGoalTypeMeta(me.goalType);
        return (
          <div className="fixed bottom-3 right-3 z-20 pointer-events-auto hidden md:flex flex-col gap-1.5 w-[320px] rpg-panel rounded-2xl p-3">
            <div className="flex items-center justify-between text-xs font-extrabold text-amber-200">
              <span>
                {me.emoji} {me.name} • {gMeta.shortTag}
              </span>
              <span className={pct < 0 ? 'text-rose-400' : 'text-emerald-400'}>{pct}%</span>
            </div>
            <div className="w-full h-3.5 bg-slate-950 border-2 border-amber-500 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  pct < 0
                    ? 'bg-gradient-to-r from-rose-500 to-orange-400'
                    : 'bg-gradient-to-r from-lime-400 via-emerald-400 to-amber-400'
                }`}
                style={{ width: `${Math.max(5, Math.min(100, Math.max(0, pct)))}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] font-bold text-amber-100/80">
              <span>{me.isInFoodStall ? '🍖 นอนซุ้มอาหาร!' : '0% ร่างเริ่มต้น'}</span>
              <span>{me.diffLabel}</span>
              <span className="text-amber-300">100% เส้นชัย! 🏆</span>
            </div>
          </div>
        );
      })()}

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
              return (
                <>
                  <div className="flex items-center gap-2.5 mb-4">
                    <span className="text-3xl">{gMeta.icon}</span>
                    <div>
                      <h3 className="font-[family-name:var(--font-kanit)] text-xl font-extrabold text-amber-300">
                        บันทึกผลภารกิจผู้กล้า 3D
                      </h3>
                      <p className="text-xs text-amber-100/80 font-medium">
                        ทุกๆ +1% ความคืบหน้าที่เพิ่มขึ้น รับทันที +15 🪙 (+10 🪙 โบนัสส่งผลรายวัน)!
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleWeightSubmit} className="space-y-3.5">
                    {selectedPlayerObj && (
                      <div className="rpg-panel-wood rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="font-extrabold text-sm text-amber-200">
                          {selectedPlayerObj.emoji} {selectedPlayerObj.name} ({gMeta.shortTag})
                        </span>
                        {selectedPlayerObj.id === currentUserId &&
                        (selectedPlayerObj.currentVal ?? selectedPlayerObj.currentWeight) !== undefined ? (
                          <span className="text-xs font-bold text-amber-100">
                            ปัจจุบัน {selectedPlayerObj.currentVal ?? selectedPlayerObj.currentWeight} / เป้า{' '}
                            {selectedPlayerObj.targetVal ?? selectedPlayerObj.goalWeight} {gMeta.unit}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-amber-100">
                            ความคืบหน้า {selectedPlayerObj.progressPct ?? 0}%
                          </span>
                        )}
                      </div>
                    )}

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

                    <div>
                      <label className="block text-xs font-bold text-amber-200 mb-1.5">
                        เลือกสถานะ / คำคมผู้กล้า
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {EXCUSES.map((ex) => (
                          <button
                            type="button"
                            key={ex.text}
                            onClick={() => setSelectedExcuse(ex.text)}
                            className={`${
                              selectedExcuse === ex.text
                                ? 'bg-amber-400 text-black border-white'
                                : 'bg-slate-900 text-amber-100 border-slate-700'
                            } border-2 rounded-lg px-2.5 py-1.5 text-xs font-bold text-left cursor-pointer`}
                          >
                            {ex.text}
                          </button>
                        ))}
                      </div>
                    </div>

                    {modalError && (
                      <div className="bg-rose-600 text-white border-2 border-amber-300 rounded-xl p-2 text-xs font-bold text-center">
                        {modalError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full rpg-btn-green font-[family-name:var(--font-kanit)] font-extrabold text-base py-3 rounded-xl cursor-pointer mt-1"
                    >
                      {submitting ? 'กำลังอัปเดต...' : '🚀 ส่งผลภารกิจ & รับแต้ม!'}
                    </button>
                  </form>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <WardrobeShopModal
        isOpen={isJoinOpen}
        onClose={() => setIsJoinOpen(false)}
        mode={joinMode}
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
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="rpg-panel rounded-2xl max-w-sm w-full p-5 relative">
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
                <p className="text-xs text-amber-100/80 font-semibold">
                  {getGoalTypeMeta(liveTarget.goalType).shortTag} • ความคืบหน้า{' '}
                  {liveTarget.progressPct ?? 0}%
                </p>
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
                  className={`font-[family-name:var(--font-kanit)] font-extrabold text-sm ${
                    pBoost.netPower > 0
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

              {/* Bi-directional Tug-of-War Gauge (-6 .. 0 .. +6) */}
              <div className="relative w-full h-4 bg-slate-900 border-2 border-black rounded-full overflow-visible shadow-inner">
                {/* Left Negative Fill (Food / Kabigon / Majin Buu) */}
                {pBoost.netPower < 0 && (
                  <div
                    className="absolute top-0 bottom-0 rounded-l-full bg-gradient-to-l from-cyan-400 via-pink-500 to-fuchsia-500 transition-all duration-300"
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

                {/* Milestone Ticks: -3 (25%), 0 (50%), +3 (75%) */}
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
                <span className="text-pink-300">🩷-6 บู</span>
                <span className="text-cyan-300">💤-3 คาบิก้อน</span>
                <span className="text-slate-300">0</span>
                <span className="text-orange-300">🔥+3 บูสต์</span>
                <span className="text-yellow-300">⚡+6 ไซย่า</span>
              </div>

              <div className="text-[10px] font-semibold text-amber-100/85 bg-black/40 rounded-lg px-2 py-1 leading-snug">
                💡 {pBoost.nextHint}
              </div>
              <div className="text-[9px] font-bold text-amber-200/65 text-center">
                ⏰ เกจพลัง +/- รีเซ็ตกลับเป็น 0 ใหม่ทุกวันเวลา 07:00 น. เช้า
              </div>
            </div>

            {liveTarget.id === currentUserId && (
              <button
                type="button"
                onClick={() => {
                  setActionTargetPlayer(null);
                  openWardrobeModal(liveTarget);
                }}
                className="w-full rpg-btn-blue font-extrabold text-xs py-2 rounded-xl mb-3 cursor-pointer"
              >
                🎨 เปิดหน้าต่างแต่งตัว 3D &amp; ร้านค้าแต้ม
              </button>
            )}

            <form onSubmit={handleBoardSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBoardKind('cheer')}
                  className={`border-2 border-black rounded-xl py-2 text-xs font-extrabold cursor-pointer transition ${
                    boardKind === 'cheer'
                      ? 'bg-gradient-to-r from-[#A3E635] to-[#FACC15] text-black shadow-[2px_2px_0px_#000]'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  🔥 เติมไฟบูสต์ (+1)
                </button>
                <button
                  type="button"
                  onClick={() => setBoardKind('tempt')}
                  className={`border-2 border-black rounded-xl py-2 text-xs font-extrabold cursor-pointer transition ${
                    boardKind === 'tempt'
                      ? 'bg-[#FF4D8D] text-white shadow-[2px_2px_0px_#000]'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  😈 มารผจญ/ขุนพุง (-1)
                </button>
              </div>

              {/* กติกาวงแชร์ปันผลสายเชียร์ & สายมารแทงสวนรับทรัพย์ */}
              <div
                className={`rounded-xl border-2 border-black px-3 py-2 text-[11px] font-bold leading-snug ${
                  boardKind === 'cheer'
                    ? 'bg-amber-100 text-stone-900'
                    : 'bg-rose-100 text-rose-950'
                }`}
              >
                {boardKind === 'cheer' ? (
                  <>
                    <div>🤝 <strong>วงแชร์สายส่งไฟ:</strong> คนส่งได้ <strong>+2 🪙</strong> &amp; <strong>คนได้รับไฟก็ได้ +2 🪙</strong> ทันที! (สูงสุด 5 ครั้ง/วัน)</div>
                    <div className="text-[10.5px] text-amber-900 mt-0.5">
                      💰 ถ้าเพื่อนอัปเดตผลรอบถัดไปแล้ว<strong>พัฒนาขึ้น/ได้แต้ม</strong> คนส่งไฟรับปันผลอีก <strong>+8 🪙/ดวง (สูงสุด 3 ดวง) + โบนัส 25% ของแต้มเพื่อน!</strong>
                    </div>
                  </>
                ) : (
                  <>
                    <div>😈 <strong>สายมารแทงสวนขุนพุง:</strong> คนส่งแกล้งเพื่อนรับทันที <strong>+2 🪙</strong> (สูงสุด 5 ครั้ง/วัน)</div>
                    <div className="text-[10.5px] text-rose-900 mt-0.5">
                      🍔 ถ้าเพื่อนตบะแตกอัปเดตผล<strong>ถอยหลัง</strong> รับรางวัลนำจับ <strong>+12 🪙/ชิ้น</strong> (และถ้าร่วงเข้าซุ้มอาหารริมหาด รับแจ็กพอต <strong>+20 🪙/ชิ้น!</strong>)
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
                className={`w-full neo-btn font-[family-name:var(--font-kanit)] font-extrabold text-sm py-2.5 rounded-xl cursor-pointer ${
                  boardKind === 'cheer'
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
        </div>
        );
      })()}

      <LoginGateModal
        isOpen={Boolean(authChecked && currentUserId === null && !isJoinOpen)}
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

      {walkingSpectatorId !== null && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 max-w-[94vw]">
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
                      className="border-2 border-black bg-[#FEF08A] hover:bg-[#FFE600] text-black rounded-xl px-2.5 py-1.5 text-xs font-extrabold cursor-pointer transition"
                    >
                      {act.label}
                    </button>
                  ))}
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setIsPairMenuOpen((v) => !v)}
                className="neo-btn bg-[#FF4D8D] text-white font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-4 py-2 rounded-full cursor-pointer animate-bounce"
              >
                🤝 ชวน {nearbySpectator.emoji} {nearbySpectator.name} ทำกิจกรรมด้วยกัน!
              </button>
            </div>
          )}

          <div className="neo-card bg-[#18181B] text-white rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-center gap-2.5">
            <span className="text-xs font-extrabold text-[#BEF264]">
              🚶 เดินเล่น: {players.find((pl) => pl.id === walkingSpectatorId)?.emoji}{' '}
              {players.find((pl) => pl.id === walkingSpectatorId)?.name}
            </span>
            <input
              type="text"
              maxLength={60}
              placeholder="💬 พิมพ์คำพูดบนหัว..."
              value={quickStatusInput}
              onChange={(e) => handleQuickStatusChange(e.target.value)}
              className="bg-white text-black placeholder:text-zinc-500 border-2 border-white rounded-lg px-2.5 py-1 text-xs font-semibold w-40 sm:w-48"
            />
            <button
              type="button"
              onClick={() => openRadialActivityMenu(window.innerWidth / 2, window.innerHeight / 2)}
              className="bg-[#38BDF8] text-black border-2 border-white rounded-lg px-2.5 py-1 text-xs font-extrabold cursor-pointer"
              title="สุ่มเปลี่ยนกิจกรรม"
            >
              🎡 กิจกรรม
            </button>
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
            <div className="relative -translate-x-1/2 -translate-y-1/2 w-[260px] h-[260px] rounded-full bg-black/25 backdrop-blur-xs border-2 border-dashed border-black/40 flex items-center justify-center">
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

    </div>
  );
}
