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
  setCharacterExpression,
  buildPetMesh,
  animatePetMotion,
  buildFlowerMesh,
  buildFoodPileMesh,
  buildDeliveryRider,
} from '@/lib/character_3d';
import {
  getDailySpectatorActivity,
  isEatPath,
  getBangkok7AmDayKey,
  FIT_ACTIVITIES,
  EAT_ACTIVITIES,
  type SpectatorActivity,
} from '@/lib/spectator_activities';
import { startBgm, stopBgm } from '@/lib/bgm';
import CharacterPreview3D from '@/components/CharacterPreview3D';

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
  startWeight: number;
  currentWeight: number;
  goalWeight: number;
  taunt: string;
  cheerCount?: number;
  temptCount?: number;
  lostKg?: number;
  pctLost?: number;
  progressRatio?: number;
  bellyScale?: number;
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
  const [editingPlayerId, setEditingPlayerId] = useState<number | null>(null);
  const [joinRole, setJoinRole] = useState<'competitor' | 'spectator'>('competitor');
  const [joinWorkout, setJoinWorkout] = useState('fit');
  const [joinPet, setJoinPet] = useState('none');
  const [joinName, setJoinName] = useState('');
  const [joinEmoji, setJoinEmoji] = useState('🦊');
  const [joinColor, setJoinColor] = useState('#38BDF8');
  const [joinAccessory, setJoinAccessory] = useState('headband');
  const [joinBandColor, setJoinBandColor] = useState('#FFE600');
  const [joinPin, setJoinPin] = useState('');
  const [joinStatus, setJoinStatus] = useState('');
  const [quickStatusInput, setQuickStatusInput] = useState('');
  const [joinStart, setJoinStart] = useState('');
  const [joinGoal, setJoinGoal] = useState('');
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
  const remoteSpectatorStateRef = useRef<
    Record<number, { x: number; y: number; z: number; rotY: number; isWalking: boolean; updatedAt: number }>
  >({});
  const lastMoveBroadcastAtRef = useRef<number>(0);
  const wasWalkingRef = useRef<boolean>(false);

  const showToast = (emoji: string, title: string, text: string) => {
    setToast({ show: true, emoji, title, text });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 4000);
  };

  const fetchArenaData = useCallback(async () => {
    try {
      const res = await fetch('/api/weights');
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        console.error('Failed to fetch /api/weights:', data?.error || res.statusText);
        return;
      }
      if (data.participants) {
        setPlayers(data.participants);
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
        if (savedId) {
          const me = (data.participants as Player[]).find((p) => p.id === Number(savedId));
          if (!me) {
            localStorage.removeItem('waist_user_id');
            setCurrentUserId(null);
            setWalkingSpectatorId(null);
          } else if (walkingSpectatorIdRef.current === null && me.role === 'spectator') {
            setWalkingSpectatorId(me.id);
          }
        }
        const competitors = (data.participants as Player[]).filter((p) => p.role !== 'spectator');
        if (competitors.length > 0) {
          setSelectedPlayerId((prev) =>
            competitors.some((p) => p.id === prev) ? prev : competitors[0].id
          );
          setBoardTargetId((prev) =>
            competitors.some((p) => p.id === prev) ? prev : competitors[0].id
          );
        }
      }
      if (data.feed) setRoastFeed(data.feed);
    } catch (e) {
      console.error(e);
    }
  }, []);

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
    fetchArenaData();
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
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;

    const supabase = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 20 } },
    });

    const channel = supabase.channel('waist-arena-live', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        if (!payload || typeof payload.userId !== 'number') return;
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
      })
      .on('broadcast', { event: 'status' }, ({ payload }) => {
        if (!payload || typeof payload.userId !== 'number') return;
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
      })
      .on('broadcast', { event: 'activity' }, ({ payload }) => {
        if (!payload) return;
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
      })
      .on('broadcast', { event: 'hello' }, () => {
        const myId = walkingSpectatorIdRef.current;
        if (myId === null) return;
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
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'hello', payload: {} });
        }
      });

    realtimeChannelRef.current = channel;

    return () => {
      realtimeChannelRef.current = null;
      supabase.removeChannel(channel);
    };
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
        const lostKg = p.startWeight - p.currentWeight;
        const pctLost = p.startWeight > 0 ? (lostKg / p.startWeight) * 100 : 0;
        const totalGoalKg = p.startWeight - p.goalWeight;
        const progressRatio = totalGoalKg > 0 ? Math.max(0, Math.min(1, lostKg / totalGoalKg)) : 0;
        const weightDiffRatio = p.startWeight > 0 ? (p.currentWeight - p.startWeight) / p.startWeight : 0;
        const bellyScale = Math.max(0.76, Math.min(1.48, 1.0 + weightDiffRatio * 4.2));

        return {
          ...p,
          lostKg: Number(lostKg.toFixed(1)),
          pctLost: Number(pctLost.toFixed(2)),
          progressRatio,
          bellyScale,
        };
      })
      .sort((a, b) => (b.pctLost ?? 0) - (a.pctLost ?? 0));
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
      realtimeChannelRef.current?.send({
        type: 'broadcast',
        event: 'activity',
        payload: { userId: currentUserId, animType: act.animType, label: act.label },
      });
      showToast('🎡', 'เปลี่ยนกิจกรรมแล้ว!', act.label);
    },
    [currentUserId]
  );

  const openCreateModal = useCallback(() => {
    setJoinMode('create');
    setEditingPlayerId(null);
    setJoinRole('competitor');
    setJoinWorkout('fit');
    setJoinPet('none');
    setJoinName('');
    setJoinEmoji('🦊');
    setJoinColor('#38BDF8');
    setJoinAccessory('headband');
    setJoinBandColor('#FFE600');
    setJoinPin('');
    setJoinStatus('');
    setJoinStart('');
    setJoinGoal('');
    setJoinError('');
    setIsJoinOpen(true);
  }, []);

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
      setJoinMode('edit');
      setEditingPlayerId(p.id);
      setJoinRole(p.role === 'spectator' ? 'spectator' : 'competitor');
      setJoinWorkout(isEatPath(p.workoutType) ? 'eat' : 'fit');
      setJoinPet(p.petType || 'none');
      setJoinStart(p.startWeight > 0 ? String(p.startWeight) : '');
      setJoinGoal(p.goalWeight > 0 ? String(p.goalWeight) : '');
      setJoinName(p.name);
      setJoinEmoji(p.emoji);
      setJoinColor(p.colorHex || '#38BDF8');
      setJoinAccessory(p.accessory || 'headband');
      setJoinBandColor(p.bandColor || '#FFE600');
      setJoinPin('');
      setJoinStatus(p.statusText || '');
      setJoinError('');
      setIsJoinOpen(true);
    },
    [focusOnCharacter, currentUserId]
  );

  const getOverviewCameraPos = () => {
    const isPortrait = typeof window !== 'undefined' && window.innerWidth < window.innerHeight;
    const extra = Math.max(0, competitors.length - 6) * 0.9;
    return isPortrait
      ? new THREE.Vector3(0, 24 + extra, 36 + extra * 1.2)
      : new THREE.Vector3(0, 17 + extra, 26 + extra);
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

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xdbeafe, 0.014);

    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
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
    controls.maxDistance = 110;
    controls.target.copy(cameraLookAtRef.current);
    controlsRef.current = controls;

    controls.addEventListener('start', () => {
      cameraTargetPosRef.current = null;
    });

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfef08a, 0.75);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(12, 24, 14);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    const spectatorList = players.filter((pl) => pl.role === 'spectator');
    const halfLen = competitors.length >= 8 || spectatorList.length >= 10 ? 22 : 15;
    const trackWidth = Math.max(8.5, competitors.length * 2.1 + 1.5);
    const islandW = halfLen * 2 + 14;
    const islandD = Math.max(30, trackWidth + 16);

    dirLight.shadow.camera.near = 5;
    dirLight.shadow.camera.far = 110;
    const d = Math.max(28, Math.max(islandW, islandD) / 2 + 4);
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const island = new THREE.Mesh(
      new THREE.BoxGeometry(islandW, 2.2, islandD),
      new THREE.MeshStandardMaterial({ color: 0x86EFAC, roughness: 0.7 })
    );
    island.position.set(0, -1.15, 0);
    island.receiveShadow = true;
    scene.add(island);

    const dirt = new THREE.Mesh(
      new THREE.BoxGeometry(islandW - 1.5, 1.8, islandD - 1.5),
      new THREE.MeshStandardMaterial({ color: 0xFDBA74, roughness: 0.9 })
    );
    dirt.position.set(0, -3.1, 0);
    scene.add(dirt);

    // Long straight track (stretches automatically when there are more players)
    const trackCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-halfLen, 0.14, 0),
      new THREE.Vector3(0, 0.14, 0),
      new THREE.Vector3(halfLen, 0.14, 0),
    ]);

    const segments = 120;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = trackCurve.getPointAt(t);
      const tan = trackCurve.getTangentAt(t);
      const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
      const left = pt.clone().addScaledVector(normal, -trackWidth / 2);
      const right = pt.clone().addScaledVector(normal, trackWidth / 2);
      positions.push(left.x, left.y, left.z, right.x, right.y, right.z);
      if (i < segments) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      }
    }
    const trackGeo = new THREE.BufferGeometry();
    trackGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    trackGeo.setIndex(indices);
    trackGeo.computeVertexNormals();
    const trackMesh = new THREE.Mesh(
      trackGeo,
      new THREE.MeshStandardMaterial({ color: 0xFB7185, roughness: 0.6, side: THREE.DoubleSide })
    );
    trackMesh.receiveShadow = true;
    scene.add(trackMesh);

    // Raised yellow/white curbs & center line along the S-curve
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const curbMat = new THREE.MeshStandardMaterial({ color: 0xFFE600, roughness: 0.4 });
    [
      { offset: -trackWidth / 2, radius: 0.16, mat: curbMat },
      { offset: 0, radius: 0.08, mat: lineMat },
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

    const pillarGeo = new THREE.CylinderGeometry(0.35, 0.4, 5.2, 16);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xFFE600, roughness: 0.3 });

    const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
    leftPillar.position.set(0, 2.6, -trackWidth / 2 - 0.3);
    leftPillar.castShadow = true;
    const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
    rightPillar.position.set(0, 2.6, trackWidth / 2 + 0.3);
    rightPillar.castShadow = true;

    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1.2, trackWidth + 0.8),
      new THREE.MeshStandardMaterial({ color: 0x18181B, roughness: 0.4 })
    );
    banner.position.set(0, 5.2, 0);
    banner.castShadow = true;

    const trophyMesh = new THREE.Group();
    const cupMat = new THREE.MeshStandardMaterial({ color: 0xFACC15, metalness: 0.6, roughness: 0.2 });
    const cupBody = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.35, 1.1, 16), cupMat);
    cupBody.position.y = 0.7;
    const cupBase = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.3, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x18181B })
    );
    cupBase.position.y = 0.15;
    trophyMesh.add(cupBody, cupBase);
    trophyMesh.position.set(0, 5.8, 0);

    finishGroup.add(leftPillar, rightPillar, banner, trophyMesh);
    scene.add(finishGroup);

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

    // Track samples for spectator trespassing detection
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
      const onTrack = dist < trackWidth / 2 - 0.15;
      const dxC = pos.x - crosswalkPt.x;
      const dzC = pos.z - crosswalkPt.z;
      const alongCrosswalk = Math.abs(dxC * crosswalkTan.x + dzC * crosswalkTan.z);
      const onCrosswalk = alongCrosswalk < 1.85;
      return { onTrack, onCrosswalk, t, pt: trackSamples[nearestIdx] };
    };

    // 3D Security Guard (ยาม) patrolling near the crosswalk
    const guardPostPos = crosswalkPt.clone().addScaledVector(crosswalkNorm, -(trackWidth / 2 + 2.2));
    guardPostPos.y = 0.2;
    const guardParts = buildCharacterMesh({
      colorHex: '#1E3A8A',
      accessory: 'cap',
      bandColor: '#FACC15',
      bellyScale: 1.05,
    });
    const vestMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.68, 0.72, 0.65, 16),
      new THREE.MeshStandardMaterial({ color: 0xBEF264, roughness: 0.4 })
    );
    vestMesh.position.y = 1.05;
    guardParts.bodyMesh.add(vestMesh);
    guardParts.rootGroup.position.copy(guardPostPos);
    guardParts.rootGroup.rotation.y = Math.atan2(-crosswalkNorm.z, crosswalkNorm.x);
    scene.add(guardParts.rootGroup);

    const guardTagEl = document.createElement('div');
    guardTagEl.className = 'player-tag';
    guardTagEl.innerHTML = `
      <div class="bg-[#18181B] text-[#FFE600] border-2 border-[#FFE600] rounded-xl px-2 py-0.5 shadow-[2px_2px_0px_#000] text-[10px] font-extrabold whitespace-nowrap">
        👮 พี่ยาม (ข้ามเฉพาะทางม้าลาย!)
      </div>
    `;
    labelsContainer.appendChild(guardTagEl);
    let lastGuardWarnAt = 0;

    const treeX = islandW / 2 - 4;
    const treeZ = islandD / 2 - 3.5;
    const treePositions = [
      [-treeX, -treeZ], [0, -treeZ], [treeX, -treeZ],
      [-treeX, treeZ], [0, treeZ], [treeX, treeZ],
    ];
    treePositions.forEach(([tx, tz], idx) => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.3, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x92400E })
      );
      trunk.position.y = 0.6;
      trunk.castShadow = true;
      const leaves = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.05, 1),
        new THREE.MeshStandardMaterial({ color: idx % 2 === 0 ? 0x22C55E : 0x4ADE80, roughness: 0.6 })
      );
      leaves.position.y = 1.8;
      leaves.castShadow = true;
      tree.add(trunk, leaves);
      tree.position.set(tx, 0, tz);
      scene.add(tree);
    });

    const clouds: THREE.Group[] = [];
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
      const cloud = new THREE.Group();
      for (let j = 0; j < 3; j++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random() * 0.5, 12, 12), cloudMat);
        puff.position.set((j - 1) * 0.9, Math.random() * 0.3, 0);
        cloud.add(puff);
      }
      cloud.position.set(-22 + i * 9, 10 + (i % 3) * 1.8, -22 - (i % 2) * 4);
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
    const fitSpectators = spectatorList.filter((pl) => !isEatPath(pl.workoutType));
    const eatSpectators = spectatorList.filter((pl) => isEatPath(pl.workoutType));
    let compIdx = 0;
    let specIdx = 0;

    players.forEach((p, idx) => {
      const isSpectator = p.role === 'spectator';
      const rankedInfo = !isSpectator ? rankedPlayers.find((r) => r.id === p.id) : undefined;
      const rankIndex = !isSpectator ? rankedPlayers.findIndex((r) => r.id === p.id) : -1;
      const style = STYLES[idx % STYLES.length];

      const isEat = isSpectator && isEatPath(p.workoutType);
      const samePathList = isEat ? eatSpectators : fitSpectators;
      const indexInPath = isSpectator ? samePathList.findIndex((pl) => pl.id === p.id) : 0;
      const customPair = isSpectator ? pairedActivities[p.id] : undefined;
      const dailyAct = isSpectator
        ? customPair || getDailySpectatorActivity(p.id, p.workoutType, samePathList.length, indexInPath)
        : null;

      let targetPos = new THREE.Vector3(0, 0.2, 0);
      let facingY = 0;

      if (isSpectator) {
        const currentSpec = specIdx++;
        const side = currentSpec % 2 === 0 ? 1 : -1;
        const sideIdx = Math.floor(currentSpec / 2);
        const perSide = Math.max(1, Math.ceil(spectatorList.length / 2));
        const row = perSide > 14 ? Math.floor(sideIdx / Math.ceil(perSide / 2)) : 0;
        const idxInRow = perSide > 14 ? sideIdx % Math.ceil(perSide / 2) : sideIdx;
        const rowTotal = perSide > 14 ? Math.ceil(perSide / 2) : perSide;
        const t = 0.05 + (rowTotal > 1 ? idxInRow / (rowTotal - 1) : 0.5) * 0.9;
        const pt = trackCurve.getPointAt(t);
        const tan = trackCurve.getTangentAt(t);
        const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const dist = trackWidth / 2 + 1.85 + row * 2.1;
        targetPos = pt.clone().addScaledVector(normal, side * dist);
        targetPos.y = 0.2;
        const inward = normal.clone().multiplyScalar(-side);
        facingY = Math.atan2(-inward.z, inward.x);
      } else {
        const currentComp = compIdx++;
        const t = Math.max(0.03, Math.min(0.95, 0.04 + (rankedInfo?.progressRatio ?? 0) * 0.9));
        const pt = trackCurve.getPointAt(t);
        const tan = trackCurve.getTangentAt(t);
        const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
        const laneSpread = competitors.length > 1 ? (currentComp / (competitors.length - 1) - 0.5) * (trackWidth - 1.6) : 0;
        targetPos = pt.clone().addScaledVector(normal, laneSpread);
        targetPos.y = 0.2;
        facingY = Math.atan2(-tan.z, tan.x);
      }

      const initialBellyScale = rankedInfo?.bellyScale ?? 1;
      const charParts = buildCharacterMesh({
        colorHex: p.colorHex || style.bodyColor,
        accessory: p.accessory || style.accessory,
        bandColor: p.bandColor || style.bandColor,
        bellyScale: initialBellyScale,
        spectatorProp: dailyAct ? dailyAct.animType : '',
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

      const petType = !isSpectator ? p.petType || 'none' : 'none';
      const petParts = buildPetMesh(petType);
      if (petParts) {
        rootGroup.add(petParts.petGroup);
        if (petParts.leashMesh) rootGroup.add(petParts.leashMesh);
      }

      if (!isSpectator) {
        const flowerCount = Math.min(20, p.cheerCount ?? 0);
        for (let fi = 0; fi < flowerCount; fi++) {
          const fl = buildFlowerMesh(fi);
          fl.scale.setScalar(1.45);
          const ring = Math.floor(fi / 5);
          const angle = (fi % 5) * 0.55 - 1.1;
          fl.position.set(
            -0.35 + Math.cos(angle) * (0.55 + ring * 0.34),
            ring * 0.12,
            -0.95 - Math.sin(angle) * 0.3 - ring * 0.25
          );
          rootGroup.add(fl);
        }

        const foodCount = Math.min(20, p.temptCount ?? 0);
        for (let di = 0; di < foodCount; di++) {
          const fd = buildFoodPileMesh(di);
          fd.scale.setScalar(1.45);
          const layer = Math.floor(di / 4);
          const slot = di % 4;
          fd.position.set(
            -0.35 + (slot - 1.5) * 0.36,
            layer * 0.2,
            0.95 + (slot % 2) * 0.32
          );
          rootGroup.add(fd);
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
      const speechHtml = `<div data-speech-bubble class="mb-1 bg-[#FFFDF7] border-2 border-black rounded-2xl px-3 py-1 shadow-[3px_3px_0px_#18181B] text-xs font-extrabold text-black max-w-[200px] truncate ${trimmedStatus ? '' : 'hidden'}">💬 ${escapeHtml(trimmedStatus)}</div>`;

      if (isSpectator) {
        const workoutLabel = dailyAct?.label || '📣 เชียร์สุดใจ';
        tagEl.innerHTML = `
          ${speechHtml}
          <div class="bg-[#FEF08A] border-2 border-black rounded-xl px-2.5 py-1 shadow-[3px_3px_0px_#18181B] text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1 font-[family-name:var(--font-kanit)] font-extrabold text-xs text-black">
              <span>👀</span>
              <span>${p.emoji} ${p.name}</span>
            </div>
            <div class="text-[10px] font-bold text-zinc-700 max-w-[145px] truncate">
              ${workoutLabel}
            </div>
          </div>
          <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black mx-auto"></div>
        `;
      } else {
        const rankLabel =
          rankIndex === 0 ? '👑 #1' : rankIndex === rankedPlayers.length - 1 && rankedPlayers.length > 1 ? '🔥 บ๊วย' : `#${rankIndex + 1}`;
        const pctVal = rankedInfo?.pctLost ?? 0;
        const sign = pctVal > 0 ? '-' : pctVal < 0 ? '+' : '';
        const pctColor = pctVal >= 0 ? 'text-emerald-600' : 'text-rose-600';

        const cheerBadge = (p.cheerCount ?? 0) > 0 ? `<span class="text-emerald-600">🌸${p.cheerCount}</span>` : '';
        const temptBadge = (p.temptCount ?? 0) > 0 ? `<span class="text-rose-600">😈${p.temptCount}</span>` : '';

        tagEl.innerHTML = `
          ${speechHtml}
          <div class="bg-white border-2 border-black rounded-xl px-2.5 py-1 shadow-[3px_3px_0px_#18181B] text-center whitespace-nowrap">
            <div class="flex items-center justify-center gap-1 font-[family-name:var(--font-kanit)] font-extrabold text-xs text-black">
              <span>${rankLabel}</span>
              <span>${p.emoji} ${p.name}</span>
              <span class="${pctColor}">${sign}${Math.abs(pctVal)}%</span>
              ${cheerBadge}
              ${temptBadge}
            </div>
            <div class="text-[10px] font-semibold text-zinc-600 max-w-[145px] truncate">
              ${p.taunt}
            </div>
          </div>
          <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-black mx-auto"></div>
        `;
      }
      labelsContainer.appendChild(tagEl);

      meshes.push({
        id: p.id,
        player: p,
        isSpectator,
        cheerCount: p.cheerCount ?? 0,
        temptCount: p.temptCount ?? 0,
        isCloseToFinish: !isSpectator && (rankedInfo?.progressRatio ?? 0) >= 0.6,
        workoutType: dailyAct ? dailyAct.animType : 'cheer',
        petType,
        petParts,
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
        activityLabel: dailyAct?.label || '📣 เชียร์สุดใจ',
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

    const flowerThrowGroup = new THREE.Group();
    flowerThrowGroup.visible = false;
    for (let i = 0; i < 3; i++) {
      const fl = buildFlowerMesh(i);
      fl.position.set((i - 1) * 0.22, 0, 0);
      fl.scale.setScalar(1.5);
      flowerThrowGroup.add(fl);
    }
    scene.add(flowerThrowGroup);

    const deliveryRiderGroup = buildDeliveryRider();
    deliveryRiderGroup.visible = false;
    scene.add(deliveryRiderGroup);

    let frameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const elapsed = clock.getElapsedTime();

      trophyMesh.rotation.y = elapsed * 1.2;

      clouds.forEach((c) => {
        c.position.x += 0.012;
        if (c.position.x > 22) c.position.x = -22;
      });

      const now = performance.now();
      const activeWalkerId = walkingSpectatorIdRef.current;
      let foundCurrentUserMesh = false;

      meshes.forEach((c, idx) => {
        if (c.id === currentUserId) {
          foundCurrentUserMesh = true;
          plumbobMesh.visible = true;
          plumbobMesh.position.set(
            c.rootGroup.position.x,
            c.rootGroup.position.y + 3.55 + Math.sin(elapsed * 3.5) * 0.14,
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
            c.rootGroup.position.x = Math.max(-29, Math.min(29, c.rootGroup.position.x + dx * speed));
            c.rootGroup.position.z = Math.max(-26, Math.min(26, c.rootGroup.position.z + dz * speed));
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
            c.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.2;
            c.bounceGroup.rotation.z = Math.sin(elapsed * 10) * 0.06;
            c.legL.rotation.z = Math.sin(elapsed * 10) * 0.65;
            c.legR.rotation.z = -Math.sin(elapsed * 10) * 0.65;
            c.armL.position.x = Math.sin(elapsed * 10) * 0.25;
            c.armR.position.x = -Math.sin(elapsed * 10) * 0.25;
          } else {
            animateCharacterMotion(c, elapsed, idx, c.currentBellyScale);
          }

          if (realtimeChannelRef.current && (isWalking || wasWalkingRef.current)) {
            if (!isWalking || now - lastMoveBroadcastAtRef.current >= 85) {
              lastMoveBroadcastAtRef.current = now;
              realtimeChannelRef.current.send({
                type: 'broadcast',
                event: 'move',
                payload: {
                  userId: c.id,
                  x: Number(c.rootGroup.position.x.toFixed(2)),
                  y: Number(c.rootGroup.position.y.toFixed(2)),
                  z: Number(c.rootGroup.position.z.toFixed(2)),
                  rotY: Number(c.rootGroup.rotation.y.toFixed(2)),
                  isWalking,
                },
              });
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

          // Security Guard (ยาม) chases spectator if they step on the track outside the zebra crossing!
          const trackInfo = getNearestTrackInfo(c.rootGroup.position);
          if (trackInfo.onTrack && !trackInfo.onCrosswalk) {
            setCharacterExpression(guardParts, 'angry');
            const gPos = guardParts.rootGroup.position;
            const toWalkerX = c.rootGroup.position.x - gPos.x;
            const toWalkerZ = c.rootGroup.position.z - gPos.z;
            const distToWalker = Math.hypot(toWalkerX, toWalkerZ);

            if (now - lastGuardWarnAt > 2500) {
              lastGuardWarnAt = now;
              showToast('🚨', 'พี่ยามเป่านกหวีด!', 'ห้ามเดินลงลู่วิ่ง! ให้ไปข้ามตรงทางม้าลายกลางสนาม!');
            }

            if (distToWalker > 1.7) {
              const gSpeed = 0.25;
              gPos.x += (toWalkerX / distToWalker) * gSpeed;
              gPos.z += (toWalkerZ / distToWalker) * gSpeed;
              guardParts.rootGroup.rotation.y = Math.atan2(-toWalkerZ, toWalkerX);
              guardParts.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 14)) * 0.25;
              guardParts.legL.rotation.z = Math.sin(elapsed * 14) * 0.75;
              guardParts.legR.rotation.z = -Math.sin(elapsed * 14) * 0.75;
              guardParts.armL.position.x = Math.sin(elapsed * 14) * 0.3;
              guardParts.armR.position.x = -Math.sin(elapsed * 14) * 0.3;
            } else {
              // Caught! Push spectator off the track
              const tan = trackCurve.getTangentAt(trackInfo.t);
              const normal = new THREE.Vector3(-tan.z, 0, tan.x).normalize();
              const sideSign =
                (c.rootGroup.position.x - trackInfo.pt.x) * normal.x +
                  (c.rootGroup.position.z - trackInfo.pt.z) * normal.z >=
                0
                  ? 1
                  : -1;
              const ejected = trackInfo.pt.clone().addScaledVector(normal, sideSign * (trackWidth / 2 + 2.4));
              c.rootGroup.position.set(ejected.x, 0.2, ejected.z);
              c.targetPos.copy(c.rootGroup.position);
              walkTargetRef.current = null;
              setShakeScreen(true);
              setTimeout(() => setShakeScreen(false), 450);
              showToast('👮', 'โดนพี่ยามไล่ออกจากสนาม!', 'กรุณาข้ามลู่วิ่งตรงทางม้าลายเท่านั้นนะ!');
            }
          } else {
            setCharacterExpression(guardParts, 'normal');
            const gPos = guardParts.rootGroup.position;
            const backX = guardPostPos.x - gPos.x;
            const backZ = guardPostPos.z - gPos.z;
            const backDist = Math.hypot(backX, backZ);
            if (backDist > 0.2) {
              gPos.x += (backX / backDist) * 0.1;
              gPos.z += (backZ / backDist) * 0.1;
              guardParts.rootGroup.rotation.y = Math.atan2(-backZ, backX);
              guardParts.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 8)) * 0.15;
              guardParts.legL.rotation.z = Math.sin(elapsed * 8) * 0.5;
              guardParts.legR.rotation.z = -Math.sin(elapsed * 8) * 0.5;
            } else {
              guardParts.bounceGroup.position.y = 0;
              guardParts.legL.rotation.z = 0;
              guardParts.legR.rotation.z = 0;
              guardParts.rootGroup.rotation.y = Math.atan2(-crosswalkNorm.z, crosswalkNorm.x);
            }
          }
          return;
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
          c.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 10)) * 0.2;
          c.bounceGroup.rotation.z = Math.sin(elapsed * 10) * 0.06;
          c.legL.rotation.z = Math.sin(elapsed * 10) * 0.65;
          c.legR.rotation.z = -Math.sin(elapsed * 10) * 0.65;
          c.armL.position.x = Math.sin(elapsed * 10) * 0.25;
          c.armR.position.x = -Math.sin(elapsed * 10) * 0.25;
        } else {
          animateCharacterMotion(c, elapsed, idx, nextScale);
        }
        if (c.petParts) {
          animatePetMotion(c.petParts, c, c.petType, c.isCloseToFinish, elapsed, idx);
        }

        if (c.id === leaderIdRef.current) {
          crownMesh.position.set(
            c.rootGroup.position.x + 0.05,
            c.rootGroup.position.y + c.bounceGroup.position.y + 2.85 + Math.sin(elapsed * 4) * 0.08,
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
          c.rootGroup.position.y + 3.15,
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
              const fi = Math.min(19, targetChar.cheerCount ?? 0);
              targetChar.cheerCount = (targetChar.cheerCount ?? 0) + 1;
              if (fi < 20) {
                const fl = buildFlowerMesh(fi);
                fl.scale.setScalar(1.45);
                const ring = Math.floor(fi / 5);
                const angle = (fi % 5) * 0.55 - 1.1;
                fl.position.set(
                  -0.35 + Math.cos(angle) * (0.55 + ring * 0.34),
                  ring * 0.12,
                  -0.95 - Math.sin(angle) * 0.3 - ring * 0.25
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

      const guardHeadPos = new THREE.Vector3(
        guardParts.rootGroup.position.x,
        guardParts.rootGroup.position.y + 3.0,
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
      const hits = raycaster.intersectObjects(meshes.map((m) => m.rootGroup), true);
      if (hits.length > 0) {
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && obj.userData.playerId === undefined) {
          obj = obj.parent;
        }
        if (obj?.userData.playerId !== undefined) {
          const found = players.find((pl) => pl.id === obj!.userData.playerId);
          if (found) {
            if (found.role !== 'spectator') {
              openEditModal(found);
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
          walkTargetRef.current = new THREE.Vector3(
            Math.max(-29, Math.min(29, pHit.x)),
            0.2,
            Math.max(-26, Math.min(26, pHit.z))
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
      meshes.forEach((m) => {
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
  }, [players, competitors, rankedPlayers, openEditModal, focusOnCharacter, pairedActivities, currentUserId]);

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
          excuseTag: selectedExcuse,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModalError(data.error || 'เกิดข้อผิดพลาด');
      } else {
        const player = players.find((p) => p.id === selectedPlayerId);
        if (data.diff < 0) {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          showToast('🎉', 'น้ำหนักลดลง! หุ่น 3D เพรียวขึ้นแล้ว', `${player?.name} ลดไป ${Math.abs(data.diff)} กก. วิ่งนำลิ่ว!`);
        } else if (data.diff > 0) {
          setShakeScreen(true);
          setTimeout(() => setShakeScreen(false), 500);
          showToast('🚨', 'อุ๊ย! พุง 3D ขยายใหญ่ขึ้น!', `${player?.name} น้ำหนักเพิ่ม +${data.diff} กก. โดนระบบแฉแล้ว!`);
        } else {
          showToast('⚖️', 'อัปเดตเรียบร้อย', `น้ำหนักเท่าเดิมเป๊ะ ${newWeightInput} กก.`);
        }
        setIsLogOpen(false);
        setPinInput('');
        await fetchArenaData();
        setTimeout(() => focusOnCharacter(selectedPlayerId), 300);
      }
    } catch {
      setModalError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setSubmitting(false);
    }
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
  };

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoining(true);

    try {
      const isEdit = joinMode === 'edit' && editingPlayerId !== null;
      const isSelf = isEdit && editingPlayerId === currentUserId;
      const res = await fetch('/api/users', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isEdit
            ? {
                userId: editingPlayerId,
                isSelf,
                pinCode: joinPin,
                name: joinName,
                avatarEmoji: joinEmoji,
                colorHex: joinColor,
                accessory: joinAccessory,
                bandColor: joinBandColor,
                role: joinRole,
                workoutType: joinWorkout,
                petType: joinPet,
                statusText: joinStatus,
                startWeight: joinRole === 'competitor' && joinStart ? parseFloat(joinStart) : undefined,
                goalWeight: joinRole === 'competitor' && joinGoal ? parseFloat(joinGoal) : undefined,
              }
            : {
                name: joinName,
                avatarEmoji: joinEmoji,
                colorHex: joinColor,
                accessory: joinAccessory,
                bandColor: joinBandColor,
                role: joinRole,
                workoutType: joinWorkout,
                petType: joinPet,
                pinCode: joinPin || '1234',
                startWeight: joinRole === 'competitor' ? parseFloat(joinStart) : 0,
                goalWeight: joinRole === 'competitor' ? parseFloat(joinGoal) : 0,
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
        setIsJoinOpen(false);
        setJoinName('');
        setJoinPin('');
        setJoinStart('');
        setJoinGoal('');
        await fetchArenaData();
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
      const res = await fetch('/api/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          senderId: boardSenderId ? Number(boardSenderId) : null,
          targetUserId: boardTargetId,
          kind: boardKind,
          message: boardMessage,
        }),
      });
      const data = await res.json();
      if (res.ok && data.interaction) {
        const inter = data.interaction;
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
          label: `${inter.kind === 'cheer' ? '💐' : '😈'} ${inter.giftItem}`,
          startTime: performance.now(),
        };
        if (inter.kind === 'cheer') {
          confetti({ particleCount: 50, spread: 55, origin: { y: 0.65 } });
          showToast('🌸', `ส่งกำลังใจให้ ${inter.targetName}!`, `${inter.senderName} มอบ ${inter.giftItem}`);
        } else {
          showToast('😈', `ส่งมารผจญไปยั่ว ${inter.targetName}!`, `${inter.senderName} เอา ${inter.giftItem} ไปล่อถึงที่!`);
        }
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
    realtimeChannelRef.current?.send({
      type: 'broadcast',
      event: 'status',
      payload: { userId: currentUserId, statusText: trimmed },
    });
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
        <div className="neo-card rounded-2xl px-4 py-2.5 pointer-events-auto flex items-center gap-3 bg-[#FFE600]">
          <div className="w-10 h-10 bg-[#FF4D8D] border-2 border-black rounded-xl flex items-center justify-center text-xl shadow-[2px_2px_0px_#000] shrink-0">
            🏆
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-[family-name:var(--font-kanit)] font-extrabold text-lg sm:text-xl text-black leading-none">
                ศึกชิงบัลลังก์เอวเอส 3D
              </h1>
              <span className="bg-black text-[#BEF264] text-[10px] font-bold px-1.5 py-0.5 rounded">LIVE</span>
            </div>
            <p className="text-[11px] font-semibold text-zinc-800 mt-0.5">
              หมุนดูพุงเพื่อนได้ 360° • ใครแพ้เลี้ยงชาบู!
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          <div className="neo-card rounded-xl p-1 flex items-center gap-1 bg-white">
            <button
              onClick={() => setCameraView('overview')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#38BDF8] hover:text-black transition cursor-pointer flex items-center gap-1"
            >
              🎥 <span className="hidden md:inline">มุมมองรวม</span>
            </button>
            <button
              onClick={() => setCameraView('leader')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#FFE600] transition cursor-pointer flex items-center gap-1"
            >
              👑 <span className="hidden md:inline">ซูมผู้นำ</span>
            </button>
            <button
              onClick={() => setCameraView('loser')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-[#FF4D8D] hover:text-white transition cursor-pointer flex items-center gap-1"
            >
              🔥 <span className="hidden md:inline">ส่องคนบ๊วย</span>
            </button>
          </div>

          <button
            onClick={toggleMusic}
            className={`neo-btn font-bold text-xs sm:text-sm px-3 py-2.5 rounded-xl flex items-center gap-1 cursor-pointer ${
              isMusicOn ? 'bg-[#FFE600] text-black' : 'bg-white text-zinc-700'
            }`}
            title="เปิด/ปิดเพลงประกอบ"
          >
            <span>{isMusicOn ? '🔊' : '🔇'}</span>
            <span className="hidden md:inline">{isMusicOn ? 'เพลง' : 'ปิดเสียง'}</span>
          </button>

          <button
            onClick={() => setIsDrawerOpen((v) => !v)}
            className="neo-btn bg-white text-black font-bold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
          >
            <Trophy className="w-4 h-4" />
            <span className="hidden sm:inline">อันดับ & แซวสด</span>
          </button>

          {(() => {
            const currentUser = players.find((pl) => pl.id === currentUserId);
            if (!currentUser) {
              return (
                <button
                  onClick={openCreateModal}
                  className="neo-btn bg-[#38BDF8] hover:bg-[#7dd3fc] text-black font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-3.5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4 stroke-[2.5]" />
                  <span>+ สมัคร / เข้าร่วม</span>
                </button>
              );
            }
            return (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openEditModal(currentUser)}
                  className="neo-btn bg-[#38BDF8] hover:bg-[#7dd3fc] text-black font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
                  title="แก้ไขโปรไฟล์ / เปลี่ยนสาย"
                >
                  <span>{currentUser.emoji}</span>
                  <span>{currentUser.name}</span>
                  <span className="text-[10px] bg-white/80 px-1.5 py-0.5 rounded border border-black">
                    {currentUser.role === 'spectator' ? 'ผู้ชม' : 'นักแข่ง'}
                  </span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="neo-btn bg-white hover:bg-zinc-100 text-black font-bold text-xs px-2.5 py-2 rounded-xl cursor-pointer"
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
            return (
              <button
                onClick={() => {
                  setSelectedPlayerId(currentUser.id);
                  setNewWeightInput(String(currentUser.currentWeight));
                  setModalError('');
                  setIsLogOpen(true);
                }}
                className="neo-btn bg-[#A3E635] hover:bg-[#bef264] text-black font-[family-name:var(--font-kanit)] font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Scale className="w-4 h-4 stroke-[2.5]" />
                <span>+ อัปเดตน้ำหนักวันนี้</span>
              </button>
            );
          })()}
        </div>
      </header>

      <aside
        className={`fixed top-32 sm:top-20 right-3 bottom-3 w-[340px] max-w-[calc(100vw-24px)] z-20 flex flex-col gap-3 transition-transform duration-300 pointer-events-none ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-[120%]'
        }`}
      >
        <div className="neo-card rounded-2xl p-3.5 pointer-events-auto flex flex-col max-h-[48%]">
          <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-black shrink-0">
            <h2 className="font-[family-name:var(--font-kanit)] font-extrabold text-base flex items-center gap-1.5">
              <span>📊 อันดับเอวเอส</span>
            </h2>
            <span className="text-[10px] font-bold bg-[#FFE600] border border-black px-2 py-0.5 rounded-full">
              วัดจาก % ที่ลดได้
            </span>
          </div>
          <div className="overflow-y-auto space-y-2 pr-1">
            {rankedPlayers.length === 0 ? (
              <p className="text-xs text-center py-4 font-bold text-zinc-500">
                ยังไม่มีผู้เข้าแข่งขัน กด &quot;+ สมัครลงแข่ง&quot; ได้เลย!
              </p>
            ) : (
              rankedPlayers.map((p, idx) => {
                const isFirst = idx === 0;
                const isLast = idx === rankedPlayers.length - 1 && rankedPlayers.length > 1;
                const pctVal = p.pctLost ?? 0;
                const sign = pctVal > 0 ? '-' : pctVal < 0 ? '+' : '';
                const cardBg = isFirst ? 'bg-[#FFE600]' : isLast ? 'bg-[#FF4D8D]/20' : 'bg-white';

                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      focusOnCharacter(p.id);
                      if (window.innerWidth < 768) setIsDrawerOpen(false);
                    }}
                    className={`${cardBg} border-2 border-black rounded-xl p-2 flex items-center justify-between gap-2 cursor-pointer hover:translate-x-0.5 transition`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-black text-white font-[family-name:var(--font-kanit)] font-extrabold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <span className="text-xl shrink-0">{p.emoji}</span>
                      <div className="min-w-0">
                        <div className="font-extrabold text-xs text-black truncate">
                          {p.name} {isFirst ? '👑' : isLast ? '🔥' : ''}
                        </div>
                        <div className="text-[10px] font-semibold text-zinc-600">
                          {p.startWeight} ➔ <strong className="text-black">{p.currentWeight} กก.</strong>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-[family-name:var(--font-kanit)] font-extrabold text-sm ${
                          pctVal >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {sign}
                        {Math.abs(pctVal)}%
                      </div>
                      <div className="text-[9px] font-bold text-zinc-500">เป้า {p.goalWeight} กก.</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="neo-card rounded-2xl p-3.5 pointer-events-auto flex flex-col flex-1 min-h-0 bg-[#FEF08A]/95">
          <div className="flex items-center justify-between pb-2 mb-2 border-b-2 border-black shrink-0 gap-2">
            <h2 className="font-[family-name:var(--font-kanit)] font-extrabold text-base flex items-center gap-1.5">
              <span>📢 กระดานแซวสด</span>
            </h2>
            <span className="bg-[#FF4D8D] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-black animate-pulse">
              PUBLIC
            </span>
          </div>
          <p className="text-[10px] font-bold text-zinc-600 mb-2 shrink-0">
            👆 คลิกที่ตัวผู้เข้าแข่งขันในสนามเพื่อส่งดอกไม้หรือมารผจญได้เลย!
          </p>

          <div className="overflow-y-auto space-y-2 pr-1 flex-1">
            {roastFeed.map((item) => {
              if (item.type === 'cheer' || item.type === 'tempt') {
                const isTempt = item.type === 'tempt';
                return (
                  <div
                    key={item.id}
                    className={`border-2 border-black rounded-xl p-2.5 shadow-[2px_2px_0px_#18181B] ${
                      isTempt ? 'bg-[#FFF1F2]' : 'bg-[#ECFCCB]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-extrabold text-xs truncate">
                        {item.emoji} {item.user} ➔ {item.targetEmoji} {item.targetName}
                      </span>
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-black shrink-0 ${
                          isTempt ? 'bg-[#FF4D8D] text-white' : 'bg-[#A3E635] text-black'
                        }`}
                      >
                        {isTempt ? '😈 มารผจญ' : '🌸 กำลังใจ'}
                      </span>
                    </div>
                    <div className="text-[11px] font-bold text-zinc-900">
                      ส่ง {item.giftItem}
                    </div>
                    {item.roast && (
                      <p className="text-[11px] font-semibold text-zinc-700 bg-white/80 px-2 py-1 rounded border border-zinc-300 mt-1">
                        💬 &quot;{item.roast}&quot;
                      </p>
                    )}
                  </div>
                );
              }

              const diffVal = item.diff ?? 0;
              const isUp = diffVal > 0;
              return (
                <div key={item.id} className="bg-white border-2 border-black rounded-xl p-2.5 shadow-[2px_2px_0px_#18181B]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-extrabold text-xs">
                      {item.emoji} {item.user} ({item.weight} กก.)
                    </span>
                    {isUp ? (
                      <span className="bg-[#FF4D8D] text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-black">
                        +{diffVal.toFixed(1)} กก.
                      </span>
                    ) : (
                      <span className="bg-[#A3E635] text-black text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-black">
                        {diffVal.toFixed(1)} กก.
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-bold text-zinc-800 bg-zinc-100 px-2 py-1 rounded border border-zinc-200 mb-1">
                    {item.roast}
                  </p>
                  <div className="text-[10px] text-zinc-500 font-semibold truncate">
                    💬 &quot;{item.excuse}&quot;
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="fixed bottom-3 left-3 z-20 pointer-events-none hidden sm:block">
        <div className="neo-card rounded-xl px-3 py-1.5 text-[11px] font-bold text-zinc-700 flex items-center gap-2 bg-white/90">
          <span>🖱️ ลากเพื่อหมุนกล้อง</span>
          <span>•</span>
          <span>🔍 สกรอลล์เพื่อซูม</span>
          <span>•</span>
          <span>👆 คลิกตัวละครเพื่อแต่งตัว</span>
          <span>•</span>
          <span>🤚 ลูบพุงตัวละครดูอาการ!</span>
        </div>
      </div>

      {isLogOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-3 border-black shadow-[6px_6px_0px_#18181B] rounded-2xl max-w-md w-full max-h-[90dvh] overflow-y-auto p-5 relative">
            <button
              onClick={() => setIsLogOpen(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 bg-[#FF4D8D] text-white neo-btn rounded-lg flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-3xl">⚖️</span>
              <div>
                <h3 className="font-[family-name:var(--font-kanit)] text-xl font-extrabold">ขึ้นเขียงชั่งน้ำหนัก 3D</h3>
                <p className="text-xs text-zinc-600 font-medium">น้ำหนักเปลี่ยน = หุ่น 3D เปลี่ยนทันที!</p>
              </div>
            </div>

            <form onSubmit={handleWeightSubmit} className="space-y-3.5">
              {selectedPlayerObj && (
                <div className="bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 flex items-center justify-between">
                  <span className="font-extrabold text-sm">
                    {selectedPlayerObj.emoji} {selectedPlayerObj.name}
                  </span>
                  <span className="text-xs font-bold text-zinc-600">
                    ล่าสุด {selectedPlayerObj.currentWeight} กก. • เป้า {selectedPlayerObj.goalWeight} กก.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold mb-1">น้ำหนักวันนี้ (กก.)</label>
                <input
                  type="number"
                  step="0.1"
                  min="30"
                  max="250"
                  required
                  value={newWeightInput}
                  onChange={(e) => setNewWeightInput(e.target.value)}
                  className="w-full bg-[#BEF264]/40 border-2 border-black rounded-xl px-3 py-2 font-[family-name:var(--font-kanit)] font-extrabold text-center text-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5">4. เลือกสถานะ / ข้อแก้ตัวสุดกวน</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {EXCUSES.map((ex) => (
                    <button
                      type="button"
                      key={ex.text}
                      onClick={() => setSelectedExcuse(ex.text)}
                      className={`${
                        selectedExcuse === ex.text ? 'bg-[#FFE600]' : 'bg-zinc-100'
                      } border-2 border-black rounded-lg px-2.5 py-1.5 text-xs font-bold text-left cursor-pointer`}
                    >
                      {ex.text}
                    </button>
                  ))}
                </div>
              </div>

              {modalError && (
                <div className="bg-[#FF4D8D] text-white border-2 border-black rounded-xl p-2 text-xs font-bold text-center">
                  {modalError}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full neo-btn bg-[#A3E635] hover:bg-[#bef264] text-black font-[family-name:var(--font-kanit)] font-extrabold text-base py-3 rounded-xl cursor-pointer mt-1"
              >
                {submitting ? 'กำลังอัปเดต...' : '🚀 อัปเดตลงสนาม 3D!'}
              </button>
            </form>
          </div>
        </div>
      )}

      {isJoinOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-3 border-black shadow-[6px_6px_0px_#18181B] rounded-2xl max-w-4xl w-full max-h-[90dvh] overflow-y-auto p-5 relative">
            <button
              onClick={() => setIsJoinOpen(false)}
              className="absolute top-3.5 right-3.5 w-8 h-8 bg-[#FF4D8D] text-white neo-btn rounded-lg flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <span className="text-3xl">{joinMode === 'edit' ? '🎨' : joinRole === 'spectator' ? '👀' : '🔥'}</span>
              <div>
                <h3 className="font-[family-name:var(--font-kanit)] text-xl font-extrabold">
                  {joinMode === 'edit' ? 'แต่งตัว & แก้ไขตัวละคร 3D' : 'ลงทะเบียนเข้าศึก 3D'}
                </h3>
                <p className="text-xs text-zinc-600 font-medium">
                  {joinMode === 'edit'
                    ? 'ปรับสี เครื่องประดับ หรือท่าออกกำลังกายแล้วใส่ PIN เพื่อบันทึก'
                    : 'เลือกลงแข่งลดน้ำหนัก หรือเป็นผู้ชมออกกำลังกายข้างสนาม'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-5 items-stretch">
              <div className="flex flex-col gap-2">
                <CharacterPreview3D
                  colorHex={joinColor}
                  accessory={joinAccessory}
                  bandColor={joinBandColor}
                  isSpectator={joinRole === 'spectator'}
                  workoutType={joinWorkout}
                  petType={joinPet}
                />
                <div className="bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 flex items-center gap-2 shadow-[2px_2px_0px_#18181B]">
                  <span className="text-xl">{joinEmoji}</span>
                  <div className="min-w-0">
                    <div className="font-[family-name:var(--font-kanit)] font-extrabold text-xs text-black truncate">
                      {joinName.trim() || (joinRole === 'spectator' ? 'ผู้ชมสายฟิต' : 'นักสู้เอวเอสคนใหม่')}
                    </div>
                    <div className="text-[10px] font-semibold text-zinc-600 truncate">
                      {joinRole === 'spectator'
                        ? isEatPath(joinWorkout)
                          ? '🍔 สายกิน (สุ่มกิจกรรมใหม่ทุกวัน 07:00 น.)'
                          : '💪 สายออกกำลัง (สุ่มกิจกรรมใหม่ทุกวัน 07:00 น.)'
                        : ACCESSORY_OPTIONS.find((a) => a.id === joinAccessory)?.label}
                    </div>
                  </div>
                </div>
              </div>

              <form onSubmit={handleJoinSubmit} className="space-y-3.5">

              {(joinMode === 'create' || (joinMode === 'edit' && editingPlayerId === currentUserId)) && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setJoinRole('competitor')}
                    className={`border-2 border-black rounded-xl py-2 px-3 text-xs font-extrabold cursor-pointer transition ${
                      joinRole === 'competitor'
                        ? 'bg-[#A3E635] shadow-[2px_2px_0px_#000]'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    🏃 ลงแข่งลดน้ำหนัก
                  </button>
                  <button
                    type="button"
                    onClick={() => setJoinRole('spectator')}
                    className={`border-2 border-black rounded-xl py-2 px-3 text-xs font-extrabold cursor-pointer transition ${
                      joinRole === 'spectator'
                        ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000]'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    👀 ผู้ชมข้างสนาม
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold mb-1">1. เลือกตัวละครประจำตัว</label>
                <div className="flex flex-wrap gap-1.5">
                  {AVATARS.map((emo) => (
                    <button
                      type="button"
                      key={emo}
                      onClick={() => setJoinEmoji(emo)}
                      className={`text-xl p-2 rounded-xl border-2 border-black cursor-pointer ${
                        joinEmoji === emo ? 'bg-[#FFE600] scale-110' : 'bg-zinc-100'
                      }`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">2. สีตัวละคร 3D</label>
                <div className="flex flex-wrap items-center gap-2">
                  {BODY_COLORS.map((hex) => (
                    <button
                      type="button"
                      key={hex}
                      onClick={() => setJoinColor(hex)}
                      aria-label={`เลือกสี ${hex}`}
                      className={`w-7 h-7 rounded-full border-2 border-black cursor-pointer transition ${
                        joinColor.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-black ring-offset-2 scale-110' : ''
                      }`}
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                  <label className="flex items-center gap-1 text-[11px] font-bold bg-zinc-100 border-2 border-black rounded-lg px-2 py-1 cursor-pointer">
                    <span>🎨</span>
                    <input
                      type="color"
                      value={joinColor}
                      onChange={(e) => setJoinColor(e.target.value)}
                      className="w-5 h-5 border-0 bg-transparent p-0 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">3. แต่งตัว / เครื่องประดับ</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {ACCESSORY_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => setJoinAccessory(opt.id)}
                      className={`border-2 border-black rounded-xl px-2 py-1.5 text-xs font-bold cursor-pointer transition ${
                        joinAccessory === opt.id ? 'bg-[#FFE600] shadow-[2px_2px_0px_#000]' : 'bg-zinc-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {joinAccessory !== 'none' && joinAccessory !== 'ears' && joinAccessory !== 'cat' && (
                <div>
                  <label className="block text-xs font-bold mb-1">สีเครื่องประดับ</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {BAND_COLORS.map((hex) => (
                      <button
                        type="button"
                        key={hex}
                        onClick={() => setJoinBandColor(hex)}
                        aria-label={`เลือกสีเครื่องประดับ ${hex}`}
                        className={`w-6 h-6 rounded-full border-2 border-black cursor-pointer transition ${
                          joinBandColor.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-black ring-offset-2 scale-110' : ''
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {joinRole === 'competitor' && (
                <div>
                  <label className="block text-xs font-bold mb-1">4. สัตว์คู่กาย (นิสัยเปลี่ยนตามระยะเส้นชัย!)</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                    {PET_OPTIONS.map((pet) => (
                      <button
                        type="button"
                        key={pet.id}
                        onClick={() => setJoinPet(pet.id)}
                        className={`border-2 border-black rounded-xl px-2 py-1.5 text-xs font-bold cursor-pointer transition ${
                          joinPet === pet.id ? 'bg-[#38BDF8] text-black shadow-[2px_2px_0px_#000]' : 'bg-zinc-100'
                        }`}
                      >
                        {pet.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {joinRole === 'spectator' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold">4. เลือกสายของผู้ชม</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setJoinWorkout('fit')}
                      className={`border-2 border-black rounded-xl py-2.5 px-3 text-xs font-extrabold cursor-pointer transition ${
                        !isEatPath(joinWorkout) ? 'bg-[#A3E635] shadow-[2px_2px_0px_#000]' : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      💪 สายออกกำลังกาย
                    </button>
                    <button
                      type="button"
                      onClick={() => setJoinWorkout('eat')}
                      className={`border-2 border-black rounded-xl py-2.5 px-3 text-xs font-extrabold cursor-pointer transition ${
                        isEatPath(joinWorkout) ? 'bg-[#FF4D8D] text-white shadow-[2px_2px_0px_#000]' : 'bg-zinc-100 text-zinc-700'
                      }`}
                    >
                      🍔 สายกินยั่วเพื่อน
                    </button>
                  </div>
                  <p className="text-[11px] font-semibold text-zinc-600 bg-[#FEF08A]/70 border border-black rounded-xl px-3 py-2">
                    ✨ ระบบจะสุ่มกิจกรรมเซอร์ไพรส์ให้ใหม่ทุกวันตอน 7:00 น. (สายละ 30 กิจกรรม + กิจกรรมกลุ่มเมื่อมีเพื่อนสายเดียวกัน!)
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className={joinMode === 'create' || (joinMode === 'edit' && editingPlayerId === currentUserId) ? 'col-span-2' : ''}>
                  <label className="block text-xs font-bold mb-1">ชื่อเล่น (Username)</label>
                  <input
                    type="text"
                    required
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                    className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 font-bold text-sm"
                  />
                </div>
                {joinMode === 'edit' && editingPlayerId !== currentUserId && (
                  <div>
                    <label className="block text-xs font-bold mb-1">รหัส PIN 4 หลัก (ยืนยัน)</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={joinPin}
                      onChange={(e) => setJoinPin(e.target.value)}
                      className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 font-bold text-center tracking-widest"
                    />
                  </div>
                )}
              </div>

              {joinRole === 'competitor' &&
                (joinMode === 'create' ||
                  (editingPlayerId === currentUserId && (!joinStart || Number(joinStart) <= 0))) && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold mb-1">น้ำหนักเริ่มต้น (กก.)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={joinStart}
                      onChange={(e) => setJoinStart(e.target.value)}
                      className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 font-extrabold text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">น้ำหนักเป้าหมาย (กก.)</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={joinGoal}
                      onChange={(e) => setJoinGoal(e.target.value)}
                      className="w-full bg-[#BEF264]/40 border-2 border-black rounded-xl px-3 py-2 font-extrabold text-center"
                    />
                  </div>
                </div>
              )}

              {joinMode === 'edit' && (
                <div>
                  <label className="block text-xs font-bold mb-1">💬 ข้อความบนหัว (Speech Bubble)</label>
                  <input
                    type="text"
                    maxLength={60}
                    placeholder="เช่น วันนี้สู้ตาย! / หิวชาบู..."
                    value={joinStatus}
                    onChange={(e) => setJoinStatus(e.target.value)}
                    className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 font-semibold text-xs"
                  />
                </div>
              )}

              {joinError && (
                <div className="bg-[#FF4D8D] text-white border-2 border-black rounded-xl p-2 text-xs font-bold text-center">
                  {joinError}
                </div>
              )}

              <button
                type="submit"
                disabled={joining}
                className="w-full neo-btn bg-[#FFE600] hover:bg-[#fef08a] text-black font-[family-name:var(--font-kanit)] font-extrabold text-base py-3 rounded-xl cursor-pointer mt-1"
              >
                {joining
                  ? 'กำลังบันทึก...'
                  : joinMode === 'edit'
                  ? '✨ บันทึกการแต่งตัว!'
                  : joinRole === 'spectator'
                  ? '👀 ส่งตัวละครไปเชียร์ข้างสนาม!'
                  : '🏁 เข้าสู่สนามแข่ง 3D!'}
              </button>
            </form>
            </div>
          </div>
        </div>
      )}

      {actionTargetPlayer && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-3 border-black shadow-[6px_6px_0px_#18181B] rounded-2xl max-w-sm w-full p-5 relative">
            <button
              onClick={() => setActionTargetPlayer(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-[#FF4D8D] text-white neo-btn rounded-lg flex items-center justify-center font-bold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-12 h-12 rounded-2xl border-2 border-black flex items-center justify-center text-2xl shadow-[2px_2px_0px_#000] shrink-0"
                style={{ backgroundColor: actionTargetPlayer.colorHex }}
              >
                {actionTargetPlayer.emoji}
              </div>
              <div className="min-w-0">
                <h3 className="font-[family-name:var(--font-kanit)] text-lg font-extrabold truncate">
                  {actionTargetPlayer.name}
                </h3>
                <p className="text-xs text-zinc-600 font-semibold">
                  {actionTargetPlayer.startWeight} ➔ {actionTargetPlayer.currentWeight} กก. (เป้า {actionTargetPlayer.goalWeight} กก.)
                </p>
              </div>
            </div>

            {actionTargetPlayer.id === currentUserId && (
              <button
                type="button"
                onClick={() => {
                  const p = actionTargetPlayer;
                  setActionTargetPlayer(null);
                  setJoinMode('edit');
                  setEditingPlayerId(p.id);
                  setJoinRole('competitor');
                  setJoinWorkout(isEatPath(p.workoutType) ? 'eat' : 'fit');
                  setJoinPet(p.petType || 'none');
                  setJoinStart(p.startWeight > 0 ? String(p.startWeight) : '');
                  setJoinGoal(p.goalWeight > 0 ? String(p.goalWeight) : '');
                  setJoinName(p.name);
                  setJoinEmoji(p.emoji);
                  setJoinColor(p.colorHex || '#38BDF8');
                  setJoinAccessory(p.accessory || 'headband');
                  setJoinBandColor(p.bandColor || '#FFE600');
                  setJoinPin('');
                  setJoinError('');
                  setIsJoinOpen(true);
                }}
                className="w-full neo-btn bg-[#38BDF8] text-black font-extrabold text-xs py-2 rounded-xl mb-3 cursor-pointer"
              >
                🎨 แต่งตัว / เปลี่ยนสัตว์คู่กาย / เปลี่ยนสาย
              </button>
            )}

            <form onSubmit={handleBoardSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBoardKind('cheer')}
                  className={`border-2 border-black rounded-xl py-2 text-xs font-extrabold cursor-pointer transition ${
                    boardKind === 'cheer' ? 'bg-[#A3E635] shadow-[2px_2px_0px_#000]' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  🌸 ให้กำลังใจ/ดอกไม้
                </button>
                <button
                  type="button"
                  onClick={() => setBoardKind('tempt')}
                  className={`border-2 border-black rounded-xl py-2 text-xs font-extrabold cursor-pointer transition ${
                    boardKind === 'tempt' ? 'bg-[#FF4D8D] text-white shadow-[2px_2px_0px_#000]' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  😈 มารผจญ/ส่งของกิน
                </button>
              </div>

              <input
                type="text"
                maxLength={120}
                placeholder="พิมพ์ข้อความถึงเพื่อน (ไม่ใส่ก็ได้)"
                value={boardMessage}
                onChange={(e) => setBoardMessage(e.target.value)}
                className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2 text-xs font-semibold"
              />

              <button
                type="submit"
                disabled={sendingBoard}
                className="w-full neo-btn bg-[#FFE600] hover:bg-[#fef08a] text-black font-[family-name:var(--font-kanit)] font-extrabold text-sm py-2.5 rounded-xl cursor-pointer"
              >
                {sendingBoard ? 'กำลังส่ง...' : boardKind === 'cheer' ? '🌸 ส่งดอกไม้ให้กำลังใจ!' : '🛵 ส่งไรเดอร์เอาของกินไปล่อ!'}
              </button>
            </form>
          </div>
        </div>
      )}

      {authChecked && currentUserId === null && !isJoinOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border-3 border-black shadow-[6px_6px_0px_#18181B] rounded-2xl max-w-sm w-full p-6 relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-[#FFE600] border-2 border-black rounded-2xl flex items-center justify-center text-2xl shadow-[2px_2px_0px_#000] shrink-0">
                🏆
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-kanit)] text-xl font-extrabold leading-tight">
                  เข้าสู่สนามเอวเอส 3D
                </h2>
                <p className="text-xs text-zinc-600 font-medium">
                  ใส่ชื่อผู้ใช้ (Username) เพื่อเข้าใช้งานได้เลย
                </p>
              </div>
            </div>

            <form onSubmit={handleSignInSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">ชื่อผู้ใช้ (Username)</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={signInUsername}
                  onChange={(e) => {
                    setSignInUsername(e.target.value);
                    if (signInError) setSignInError('');
                  }}
                  placeholder="พิมพ์ชื่อ หรือเลือกจากด้านล่าง..."
                  className="w-full bg-[#FFFDF7] border-2 border-black rounded-xl px-3 py-2.5 font-bold text-base"
                />
              </div>

              {players.length > 0 && (() => {
                const q = signInUsername.trim().toLowerCase();
                const matched = q
                  ? players.filter((pl) => pl.name.toLowerCase().includes(q))
                  : players;
                if (matched.length === 0) return null;
                return (
                  <div className="bg-[#FFFDF7] border-2 border-black rounded-xl p-2.5">
                    <div className="text-[11px] font-bold text-zinc-600 mb-1.5">
                      ผู้เล่นที่สร้างไว้แล้ว (คลิกเพื่อเลือก):
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                      {matched.map((pl) => {
                        const isSelected = signInUsername.trim().toLowerCase() === pl.name.toLowerCase();
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            onClick={() => {
                              setSignInUsername(pl.name);
                              setSignInError('');
                            }}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border-2 border-black text-xs font-extrabold cursor-pointer transition ${
                              isSelected
                                ? 'bg-[#FFE600] text-black'
                                : 'bg-white hover:bg-[#FEF08A] text-black'
                            }`}
                          >
                            <span>{pl.emoji}</span>
                            <span>{pl.name}</span>
                            <span className="text-[10px] opacity-70">
                              {pl.role === 'spectator' ? '👀' : '🔥'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {signInError && (
                <div className="bg-[#FF4D8D] text-white border-2 border-black rounded-xl p-2 text-xs font-bold text-center">
                  {signInError}
                </div>
              )}

              <button
                type="submit"
                disabled={signingIn}
                className="w-full neo-btn bg-[#A3E635] hover:bg-[#bef264] text-black font-[family-name:var(--font-kanit)] font-extrabold text-base py-3 rounded-xl cursor-pointer"
              >
                {signingIn ? 'กำลังตรวจสอบ...' : '🚀 เข้าใช้งาน!'}
              </button>
              <p className="text-[11px] text-center text-zinc-500 font-semibold">
                เข้าครั้งแรกจะให้เลือกเป็น ผู้เข้าแข่งขัน หรือ ผู้ชม (เปลี่ยนทีหลังได้)
              </p>
            </form>
          </div>
        </div>
      )}

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
                          realtimeChannelRef.current?.send({
                            type: 'broadcast',
                            event: 'activity',
                            payload: {
                              userId: walkingSpectatorId,
                              animType: nearMesh.workoutType,
                              label: nearMesh.activityLabel,
                            },
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
                        realtimeChannelRef.current?.send({
                          type: 'broadcast',
                          event: 'activity',
                          payload: {
                            updates: {
                              [walkingSpectatorId]: { animType: act.animType, label: act.label },
                              [nearbySpectator.id]: { animType: act.animType, label: act.label },
                            },
                          },
                        });
                        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
                        showToast(
                          '🤝',
                          'ตั้งวงทำกิจกรรมคู่!',
                          `${walker?.name || ''} ชวน ${nearbySpectator.name} มา${act.label}`
                        );
                      }}
                      className="border-2 border-black bg-[#FEF08A] hover:bg-[#FFE600] rounded-xl px-2.5 py-1.5 text-xs font-extrabold cursor-pointer transition"
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
              className="bg-white text-black border-2 border-white rounded-lg px-2.5 py-1 text-xs font-semibold w-40 sm:w-48"
            />
            <button
              type="button"
              onClick={() => openRadialActivityMenu(window.innerWidth / 2, window.innerHeight / 2)}
              className="bg-[#38BDF8] text-black border-2 border-white rounded-lg px-2.5 py-1 text-xs font-extrabold cursor-pointer"
              title="สุ่มเปลี่ยนกิจกรรม"
            >
              🎡 กิจกรรม
            </button>
            <button
              type="button"
              onClick={() => setWalkingSpectatorId(null)}
              className="bg-[#FF4D8D] text-white border-2 border-white rounded-lg px-2.5 py-1 text-xs font-extrabold cursor-pointer"
            >
              ✕ ออก
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
                className="w-16 h-16 rounded-full bg-[#FFE600] border-3 border-black shadow-[3px_3px_0px_#18181B] font-extrabold text-xs flex flex-col items-center justify-center cursor-pointer hover:scale-105 transition z-10"
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
