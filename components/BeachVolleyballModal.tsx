'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildCharacterMesh,
  type CharacterMeshParts,
} from '@/lib/character_3d';
import type { PropColorMap } from '@/lib/rpg_catalog';
import {
  detectDeviceTier,
  getQualityConfig,
  disposeObject3D,
  type QualityMode,
} from '@/lib/device_perf';
import {
  createInitialMatchState,
  resetRallyPositions,
  stepVolleyballMatch,
  playVbSound,
  VB_WIN_SCORE,
  type VbMode,
  type VbSlotId,
  type VbTeam,
  type VbInputState,
  type VbMatchState,
} from '@/lib/volleyball_engine';

export interface VolleyballPlayerSummary {
  id: number;
  name: string;
  emoji: string;
  colorHex: string;
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

export interface VbLobbyBroadcastInfo {
  roomCode: string;
  mode: VbMode;
  hostUserId: number;
  hostName: string;
  hostEmoji: string;
  targetName?: string;
  count: number;
  max: number;
  status: 'waiting' | 'started' | 'closed';
}

interface BeachVolleyballModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: VolleyballPlayerSummary[];
  currentUserId: number | null;
  qualityMode?: QualityMode;
  initialRoomCode: string;
  initialMode: VbMode;
  initialIsHost: boolean;
  invitedTargetName?: string;
  onLobbyBroadcast?: (info: VbLobbyBroadcastInfo) => void;
  onRewardEarned?: (earned: number, newPoints: number) => void;
}

interface HumanSlotMember {
  clientId: string;
  playerId: number;
  name: string;
  emoji: string;
}

interface CompactNetPlayer {
  s: VbSlotId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  f: 1 | -1;
  dt: number;
  dd: 1 | -1;
  sf: number;
}

interface CompactNetState {
  ph: VbMatchState['phase'];
  pt: number;
  sl: number;
  sr: number;
  sv: VbTeam;
  w: VbTeam | null;
  bx: number;
  by: number;
  bvx: number;
  bvy: number;
  bsp: boolean;
  pl: CompactNetPlayer[];
  ev?: { h?: 1; sp?: 1; dv?: 1; sc?: VbTeam };
  consumed?: boolean;
}

interface GuestSyncPacket {
  slot: VbSlotId;
  input: VbInputState;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  f?: 1 | -1;
  dt?: number;
  dd?: 1 | -1;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const EMPTY_INPUT: VbInputState = { left: false, right: false, jump: false, action: false };

function buildVolleyballTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const colors = ['#ffffff', '#facc15', '#38bdf8', '#fb7185', '#ffffff', '#facc15'];
    const stripeW = canvas.width / colors.length;
    colors.forEach((col, i) => {
      ctx.fillStyle = col;
      ctx.fillRect(i * stripeW, 0, stripeW + 1, canvas.height);
    });
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    for (let i = 0; i <= colors.length; i++) {
      ctx.beginPath();
      ctx.moveTo(i * stripeW, 0);
      ctx.lineTo(i * stripeW, canvas.height);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildNetTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(255,255,255,0.88)';
    ctx.lineWidth = 4;
    for (let x = 0; x <= 128; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 128);
      ctx.stroke();
    }
    for (let y = 0; y <= 128; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(128, y);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 3);
  return tex;
}

export function BeachVolleyballModal({
  isOpen,
  onClose,
  players,
  currentUserId,
  qualityMode = 'auto',
  initialRoomCode,
  initialMode,
  initialIsHost,
  invitedTargetName,
  onLobbyBroadcast,
  onRewardEarned,
}: BeachVolleyballModalProps) {
  const [screen, setScreen] = useState<'waiting' | 'playing'>('waiting');
  const [mode, setMode] = useState<VbMode>(initialMode);
  const [muted, setMuted] = useState<boolean>(false);
  const [showTouchControls, setShowTouchControls] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const tier = detectDeviceTier();
    return (
      tier !== 'desktop' ||
      navigator.maxTouchPoints > 0 ||
      'ontouchstart' in window ||
      window.innerWidth <= 1280
    );
  });
  const slideKnobDomRef = useRef<HTMLDivElement | null>(null);
  const slidePointerIdRef = useRef<number | null>(null);
  const slideOriginXRef = useRef<number>(0);
  const slideOriginYRef = useRef<number>(0);

  const myClientIdRef = useRef<string>(`vb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const [mySlot, setMySlot] = useState<VbSlotId>(initialIsHost ? 'L1' : 'R1');
  const [humanSlots, setHumanSlots] = useState<Partial<Record<VbSlotId, HumanSlotMember>>>({});

  // Live HUD state
  const [scoreLeft, setScoreLeft] = useState<number>(0);
  const [scoreRight, setScoreRight] = useState<number>(0);
  const [pointBanner, setPointBanner] = useState<string>('');
  const [winnerTeam, setWinnerTeam] = useState<VbTeam | null>(null);
  const [rewardStatus, setRewardStatus] = useState<string>('');
  const [shakeActive, setShakeActive] = useState<boolean>(false);

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const localInputRef = useRef<VbInputState>({ ...EMPTY_INPUT });
  const remoteInputsRef = useRef<Record<VbSlotId, VbInputState>>({
    L1: { ...EMPTY_INPUT },
    L2: { ...EMPTY_INPUT },
    R1: { ...EMPTY_INPUT },
    R2: { ...EMPTY_INPUT },
  });
  const remoteKinematicsRef = useRef<Partial<Record<VbSlotId, GuestSyncPacket>>>({});
  const matchStateRef = useRef<VbMatchState | null>(null);
  const netTargetStateRef = useRef<CompactNetState | null>(null);
  const lastSentInputSigRef = useRef<string>('');
  const rewardClaimedRef = useRef<boolean>(false);
  const winHandledRef = useRef<boolean>(false);
  const mutedRef = useRef<boolean>(false);
  mutedRef.current = muted;
  const playersRef = useRef(players);
  playersRef.current = players;
  const claimWinRewardRef = useRef<() => Promise<void>>(async () => {});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const humanSlotsRef = useRef(humanSlots);
  humanSlotsRef.current = humanSlots;
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const isHostRef = useRef(initialIsHost);
  isHostRef.current = initialIsHost;
  const mySlotRef = useRef(mySlot);
  mySlotRef.current = mySlot;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const onLobbyBroadcastRef = useRef(onLobbyBroadcast);
  onLobbyBroadcastRef.current = onLobbyBroadcast;

  const sendRoomMessage = useCallback((event: string, payload: Record<string, unknown>) => {
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event, payload });
    }
    if (bcRef.current) {
      bcRef.current.postMessage({ event, payload });
    }
  }, []);

  const broadcastArenaLobby = useCallback(
    (status: 'waiting' | 'started' | 'closed', nextMode: VbMode, slotsObj: Partial<Record<VbSlotId, HumanSlotMember>>) => {
      if (!isHostRef.current || !initialRoomCode) return;
      const host = slotsObj.L1;
      const maxPlayers = nextMode === '2v2' ? 4 : 2;
      onLobbyBroadcastRef.current?.({
        roomCode: initialRoomCode,
        mode: nextMode,
        hostUserId: host?.playerId ?? (currentUserId || 0),
        hostName: host?.name || 'เพื่อนในสนาม',
        hostEmoji: host?.emoji || '🏐',
        targetName: invitedTargetName,
        count: Object.keys(slotsObj).length,
        max: maxPlayers,
        status,
      });
    },
    [initialRoomCode, currentUserId, invitedTargetName]
  );

  // Claim daily win reward when local player's team wins
  const claimWinReward = useCallback(async () => {
    if (rewardClaimedRef.current) return;
    rewardClaimedRef.current = true;
    if (!currentUserId || currentUserId <= 0) {
      setRewardStatus('ล็อกอินเพื่อรับโบนัสผู้ชนะ +5 💰 GP (สูงสุด 3 ครั้ง/วัน)');
      return;
    }
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, type: 'volleyball_win' }),
      });
      const data = await res.json();
      if (res.ok && data.earned > 0) {
        setRewardStatus(`🎁 รับโบนัสผู้ชนะ +${data.earned} 💰 GP! (${data.winsToday}/${data.dailyCap} รอบวันนี้)`);
        onRewardEarned?.(data.earned, data.points);
      } else if (res.ok && data.capReached) {
        setRewardStatus(`รับโบนัสครบ ${data.dailyCap}/${data.dailyCap} รอบของวันนี้แล้ว (ยังเล่นต่อได้ไม่จำกัด!)`);
      }
    } catch {
      // ignore
    }
  }, [currentUserId, onRewardEarned]);
  claimWinRewardRef.current = claimWinReward;

  // Connect to PvP Room immediately on open & Auto-start when full!
  useEffect(() => {
    if (!isOpen || !initialRoomCode) return;

    setScreen('waiting');
    setMode(initialMode);
    modeRef.current = initialMode;
    setWinnerTeam(null);
    setRewardStatus('');
    setScoreLeft(0);
    setScoreRight(0);
    setPointBanner('');
    rewardClaimedRef.current = false;

    const me = players.find((p) => p.id === currentUserId) || players[0];
    const myInfo: HumanSlotMember = {
      clientId: myClientIdRef.current,
      playerId: me?.id ?? 0,
      name: me?.name ?? 'ผู้กล้า',
      emoji: me?.emoji ?? '🐰',
    };

    if (initialIsHost) {
      const initSlots: Partial<Record<VbSlotId, HumanSlotMember>> = { L1: myInfo };
      setMySlot('L1');
      mySlotRef.current = 'L1';
      setHumanSlots(initSlots);
      humanSlotsRef.current = initSlots;
      broadcastArenaLobby('waiting', initialMode, initSlots);
    } else {
      setHumanSlots({});
      humanSlotsRef.current = {};
    }

    const handleRoomEvent = (event: string, payload: Record<string, unknown>) => {
      if (!payload) return;

      if (event === 'join_req' && isHostRef.current) {
        if (screenRef.current === 'playing') return;
        const cid = String(payload.clientId || '');
        if (!cid || cid === myClientIdRef.current) return;
        const curMode = modeRef.current;
        const slotOrder: VbSlotId[] = curMode === '2v2' ? ['L1', 'R1', 'L2', 'R2'] : ['L1', 'R1'];
        const current = { ...humanSlotsRef.current };

        let assigned = (Object.keys(current) as VbSlotId[]).find(
          (s) => current[s]?.clientId === cid
        );
        if (!assigned) {
          assigned = slotOrder.find((s) => !current[s]);
        }
        if (assigned) {
          current[assigned] = {
            clientId: cid,
            playerId: Number(payload.playerId ?? 0),
            name: String(payload.name || 'เพื่อน'),
            emoji: String(payload.emoji || '🦊'),
          };
          setHumanSlots(current);
          humanSlotsRef.current = current;
          sendRoomMessage('room_sync', { mode: curMode, humanSlots: current });
          broadcastArenaLobby('waiting', curMode, current);
        }
      } else if (event === 'leave_req' && isHostRef.current) {
        const cid = String(payload.clientId || '');
        if (!cid) return;
        const current = { ...humanSlotsRef.current };
        (Object.keys(current) as VbSlotId[]).forEach((s) => {
          if (current[s]?.clientId === cid) delete current[s];
        });
        setHumanSlots(current);
        humanSlotsRef.current = current;
        sendRoomMessage('room_sync', { mode: modeRef.current, humanSlots: current });
        if (screenRef.current === 'waiting') {
          broadcastArenaLobby('waiting', modeRef.current, current);
        }
      } else if (event === 'room_sync' && !isHostRef.current) {
        const incomingMode = payload.mode === '2v2' ? '2v2' : '1v1';
        const incomingHumans = (payload.humanSlots || {}) as Partial<Record<VbSlotId, HumanSlotMember>>;
        setMode(incomingMode);
        modeRef.current = incomingMode;
        setHumanSlots(incomingHumans);
        humanSlotsRef.current = incomingHumans;
        const myAssigned = (Object.keys(incomingHumans) as VbSlotId[]).find(
          (s) => incomingHumans[s]?.clientId === myClientIdRef.current
        );
        if (myAssigned) {
          setMySlot(myAssigned);
          mySlotRef.current = myAssigned;
        }
      } else if (event === 'start_match') {
        const incomingMode = payload.mode === '2v2' ? '2v2' : '1v1';
        const incomingHumans = (payload.humanSlots || {}) as Partial<Record<VbSlotId, HumanSlotMember>>;
        setMode(incomingMode);
        modeRef.current = incomingMode;
        setHumanSlots(incomingHumans);
        humanSlotsRef.current = incomingHumans;
        const myAssigned = (Object.keys(incomingHumans) as VbSlotId[]).find(
          (s) => incomingHumans[s]?.clientId === myClientIdRef.current
        );
        if (myAssigned) {
          setMySlot(myAssigned);
          mySlotRef.current = myAssigned;
        }
        // Reset active match state cleanly (supports Rematch without rebuilding WebGL!)
        if (matchStateRef.current && matchStateRef.current.court.mode === incomingMode) {
          matchStateRef.current.scoreLeft = 0;
          matchStateRef.current.scoreRight = 0;
          matchStateRef.current.winner = null;
          resetRallyPositions(matchStateRef.current, 'left');
        }
        netTargetStateRef.current = null;
        remoteKinematicsRef.current = {};
        winHandledRef.current = false;
        rewardClaimedRef.current = false;
        setWinnerTeam(null);
        setRewardStatus('');
        setPointBanner('');
        setScoreLeft(0);
        setScoreRight(0);
        screenRef.current = 'playing';
        setScreen('playing');
      } else if (event === 'vb_input' && isHostRef.current) {
        const pkt = payload as unknown as GuestSyncPacket;
        if (pkt.slot && pkt.input) {
          remoteInputsRef.current[pkt.slot] = pkt.input;
          remoteKinematicsRef.current[pkt.slot] = pkt;
        }
      } else if (event === 'vb_state' && !isHostRef.current) {
        const snap = payload.s as CompactNetState | undefined;
        if (snap) {
          snap.consumed = false;
          netTargetStateRef.current = snap;
          setScoreLeft((prev) => (prev !== snap.sl ? snap.sl : prev));
          setScoreRight((prev) => (prev !== snap.sr ? snap.sr : prev));
          if (snap.ev) {
            if (snap.ev.sp) {
              playVbSound('spike', mutedRef.current);
              setShakeActive(true);
              setTimeout(() => setShakeActive(false), 260);
            } else if (snap.ev.h) {
              playVbSound('hit', mutedRef.current);
            }
            if (snap.ev.dv) playVbSound('dive', mutedRef.current);
            if (snap.ev.sc) {
              playVbSound('score', mutedRef.current);
              setPointBanner(snap.ev.sc === 'left' ? '🔥 ทีมซ้ายได้แต้ม!' : '⚡ ทีมขวาได้แต้ม!');
              setTimeout(() => setPointBanner(''), 1050);
            }
          }
          if (snap.ph === 'finished' && snap.w) {
            setWinnerTeam((prev) => (prev !== snap.w ? snap.w : prev));
          }
        }
      }
    };

    // 1. BroadcastChannel (same-browser multi-tab support)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(`waist-volleyball-room-${initialRoomCode}`);
      bc.onmessage = (ev) => {
        if (ev.data && typeof ev.data.event === 'string') {
          handleRoomEvent(ev.data.event, ev.data.payload);
        }
      };
      bcRef.current = bc;
    }

    // 2. Supabase Realtime (cross-device online play)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const sb = createClient(url, key, {
        realtime: { params: { eventsPerSecond: 45 } },
      });
      const ch = sb.channel(`waist-volleyball-room-${initialRoomCode}`, {
        config: { broadcast: { self: false } },
      });
      ch.on('broadcast', { event: 'join_req' }, ({ payload }) => handleRoomEvent('join_req', payload))
        .on('broadcast', { event: 'leave_req' }, ({ payload }) => handleRoomEvent('leave_req', payload))
        .on('broadcast', { event: 'room_sync' }, ({ payload }) => handleRoomEvent('room_sync', payload))
        .on('broadcast', { event: 'start_match' }, ({ payload }) => handleRoomEvent('start_match', payload))
        .on('broadcast', { event: 'vb_input' }, ({ payload }) => handleRoomEvent('vb_input', payload))
        .on('broadcast', { event: 'vb_state' }, ({ payload }) => handleRoomEvent('vb_state', payload))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' && !initialIsHost) {
            ch.send({ type: 'broadcast', event: 'join_req', payload: myInfo });
          }
        });
      supabaseRef.current = sb;
      channelRef.current = ch;
    }

    // Keep-alive heartbeat so friends joining late into the arena also see the open lobby banner
    let heartbeatIv: ReturnType<typeof setInterval> | null = null;
    if (initialIsHost) {
      heartbeatIv = setInterval(() => {
        if (screenRef.current === 'waiting') {
          broadcastArenaLobby('waiting', modeRef.current, humanSlotsRef.current);
        }
      }, 4500);
    } else {
      setTimeout(() => sendRoomMessage('join_req', { ...myInfo }), 120);
      heartbeatIv = setInterval(() => {
        if (screenRef.current === 'waiting' && !Object.values(humanSlotsRef.current).some((m) => m?.clientId === myClientIdRef.current)) {
          sendRoomMessage('join_req', { ...myInfo });
        }
      }, 1200);
    }

    return () => {
      if (heartbeatIv) clearInterval(heartbeatIv);
      if (initialIsHost) {
        broadcastArenaLobby('closed', modeRef.current, humanSlotsRef.current);
      } else {
        sendRoomMessage('leave_req', { clientId: myClientIdRef.current });
      }
      if (bcRef.current) {
        bcRef.current.close();
        bcRef.current = null;
      }
      if (supabaseRef.current && channelRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
        channelRef.current = null;
        supabaseRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialRoomCode, initialMode, initialIsHost]);

  // Keyboard bindings while playing
  useEffect(() => {
    if (!isOpen || screen !== 'playing') return;
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      const c = e.code;
      if (c === 'KeyA' || c === 'ArrowLeft') localInputRef.current.left = down;
      if (c === 'KeyD' || c === 'ArrowRight') localInputRef.current.right = down;
      if (c === 'KeyW' || c === 'ArrowUp' || c === 'Space') localInputRef.current.jump = down;
      if (c === 'KeyS' || c === 'ArrowDown') localInputRef.current.down = down;
      if (
        c === 'ShiftLeft' ||
        c === 'ShiftRight' ||
        c === 'Enter' ||
        c === 'KeyZ' ||
        c === 'KeyJ' ||
        c === 'KeyK'
      ) {
        localInputRef.current.action = down;
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    const onBlur = () => {
      localInputRef.current = { ...EMPTY_INPUT };
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', onBlur);
      localInputRef.current = { ...EMPTY_INPUT };
    };
  }, [isOpen, screen]);

  // Main 3D Beach Volleyball Scene & Game Loop (100% Real Players — No Bots!)
  useEffect(() => {
    if (!isOpen || screen !== 'playing' || !canvasWrapRef.current) return;
    const container = canvasWrapRef.current;
    container.innerHTML = '';

    const activeSlotIds: VbSlotId[] = mode === '2v2' ? ['L1', 'L2', 'R1', 'R2'] : ['L1', 'R1'];
    const botFlags: Record<VbSlotId, boolean> = { L1: false, L2: false, R1: false, R2: false };
    const match = createInitialMatchState(mode, botFlags, 'left');
    matchStateRef.current = match;
    netTargetStateRef.current = null;
    lastSentInputSigRef.current = '';
    const { court } = match;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const qCfg = getQualityConfig(qualityMode);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x38bdf8);
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0055);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 180);
    const updateCameraForAspect = (w: number, h: number) => {
      const aspect = Math.max(0.42, w / Math.max(1, h));
      const isPortrait = aspect < 0.95;
      const tanHalfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
      // Exact trigonometry so 100% of both sidelines + high ball arc always fit on Phone (Portrait & Landscape), iPad, and PC!
      const reqHalfW = court.halfWidth + 1.15;
      const reqHalfH = isPortrait ? 6.4 : 5.6;
      const zForWidth = reqHalfW / (tanHalfFov * aspect);
      const zForHeight = reqHalfH / tanHalfFov;
      const camZ = Math.max(zForWidth, zForHeight);
      // On portrait phones/iPads, look slightly lower so the court sits higher up on screen, clear of bottom touch pads!
      const lookY = isPortrait ? 0.55 : 2.25;
      const camY = isPortrait ? 3.6 + camZ * 0.06 : mode === '2v2' ? 4.8 : 4.3;
      camera.aspect = aspect;
      camera.position.set(0, camY, camZ);
      camera.lookAt(0, lookY, 0);
      camera.updateProjectionMatrix();
    };
    updateCameraForAspect(width, height);

    const renderer = new THREE.WebGLRenderer({ antialias: qCfg.antialias });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qCfg.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = qCfg.shadowType;
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xfef08a, 0.95);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfffbeb, 1.3);
    sun.position.set(8, 18, 12);
    sun.castShadow = true;
    const sSize = Math.min(1024, qCfg.shadowMapSize);
    sun.shadow.mapSize.set(sSize, sSize);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 12;
    sun.shadow.camera.bottom = -4;
    scene.add(sun);

    // Sandy Beach Court Floor
    const sandMesh = new THREE.Mesh(
      new THREE.BoxGeometry(court.halfWidth * 2 + 12, 1.0, 14),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.88 })
    );
    sandMesh.position.set(0, -0.5, 0);
    sandMesh.receiveShadow = true;
    scene.add(sandMesh);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const frontLine = new THREE.Mesh(new THREE.PlaneGeometry(court.halfWidth * 2, 0.14), lineMat);
    frontLine.rotation.x = -Math.PI / 2;
    frontLine.position.set(0, 0.02, 1.6);
    scene.add(frontLine);

    const backLine = frontLine.clone();
    backLine.position.z = -1.6;
    scene.add(backLine);

    [-court.halfWidth, court.halfWidth].forEach((lx) => {
      const sideLine = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 3.2), lineMat);
      sideLine.rotation.x = -Math.PI / 2;
      sideLine.position.set(lx, 0.02, 0);
      scene.add(sideLine);
    });

    const ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 60),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, roughness: 0.2, metalness: 0.1 })
    );
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, -0.45, -34);
    scene.add(ocean);

    // Palm Trees
    const palmTrunkMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
    const palmLeafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6, side: THREE.DoubleSide });
    [-court.halfWidth - 2.6, court.halfWidth + 2.6].forEach((px) => {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 4.6, 8), palmTrunkMat);
      trunk.position.y = 2.3;
      trunk.rotation.z = px < 0 ? -0.14 : 0.14;
      palm.add(trunk);
      for (let li = 0; li < 6; li++) {
        const ang = (li / 6) * Math.PI * 2;
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 5), palmLeafMat);
        leaf.position.set(Math.cos(ang) * 0.8 + (px < 0 ? 0.3 : -0.3), 4.5, Math.sin(ang) * 0.8);
        leaf.rotation.z = Math.cos(ang) * 1.1;
        leaf.rotation.x = Math.sin(ang) * 1.1;
        palm.add(leaf);
      }
      palm.position.set(px, 0, -4.5);
      scene.add(palm);
    });

    // Center Volleyball Net
    const netGroup = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, metalness: 0.2 });
    const postFront = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, court.netHeight + 0.2, 10), postMat);
    postFront.position.set(0, (court.netHeight + 0.2) / 2, 1.7);
    const postBack = postFront.clone();
    postBack.position.z = -1.7;
    netGroup.add(postFront, postBack);

    const topTape = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.16, 3.5),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
    );
    topTape.position.set(0, court.netHeight, 0);
    netGroup.add(topTape);

    const netTex = buildNetTexture();
    const netMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, court.netHeight - 0.55),
      new THREE.MeshBasicMaterial({ map: netTex, transparent: true, side: THREE.DoubleSide })
    );
    netMesh.rotation.y = Math.PI / 2;
    netMesh.position.set(0, court.netHeight - (court.netHeight - 0.55) / 2 - 0.06, 0);
    netGroup.add(netMesh);
    scene.add(netGroup);

    // 3D Beach Volleyball + Shadow + Fiery Spike Glow
    const ballTex = buildVolleyballTexture();
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(court.ballRadius, 22, 18),
      new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35 })
    );
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    const ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(court.ballRadius * 1.15, 20),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.42 })
    );
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.y = 0.03;
    scene.add(ballShadow);

    const spikeGlow = new THREE.Mesh(
      new THREE.SphereGeometry(court.ballRadius * 1.38, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.55 })
    );
    spikeGlow.visible = false;
    ballMesh.add(spikeGlow);

    // Classic Pikachu Volleyball Afterimage Trail Spheres on Power Spike!
    const trailHistory: Array<{ x: number; y: number }> = [];
    const trailMeshes = [0.42, 0.26, 0.14].map((op, ti) => {
      const tm = new THREE.Mesh(
        new THREE.SphereGeometry(court.ballRadius * (0.9 - ti * 0.14), 12, 10),
        new THREE.MeshBasicMaterial({ color: ti === 0 ? 0xfb923c : 0xfacc15, transparent: true, opacity: op })
      );
      tm.visible = false;
      scene.add(tm);
      return tm;
    });

    // Build Real Player Meshes with all Equipped Cosmetics
    const activeMySlot = mySlotRef.current;
    const myTeam: VbTeam = activeMySlot.startsWith('L') ? 'left' : 'right';

    interface SlotVisual {
      slotId: VbSlotId;
      root: THREE.Group;
      charParts: CharacterMeshParts;
      ring: THREE.Mesh;
      zOffset: number;
    }

    const visuals: SlotVisual[] = activeSlotIds.map((slotId, idx) => {
      const wrapper = new THREE.Group();
      const member = humanSlotsRef.current[slotId];
      const curPlayers = playersRef.current;
      const found =
        curPlayers.find((p) => p.id === member?.playerId) ||
        curPlayers[idx % Math.max(1, curPlayers.length)];
      const team: VbTeam = slotId.startsWith('L') ? 'left' : 'right';

      const charParts = buildCharacterMesh({
        colorHex: found?.colorHex || '#F8FAFC',
        accessory: 'none',
        bandColor: found?.bandColor || '#FACC15',
        bellyScale: found?.bellyScale ?? found?.bmiBellyScale ?? 1,
        muscleScale: found?.muscleScale ?? 1,
        showDumbbells: found?.goalType === 'muscle_gain',
        species: found?.breed || found?.species || 'bunny',
        equipHat: found?.equipHat || 'none',
        equipFace: found?.equipFace || 'face_none',
        equipArmor: found?.equipArmor || 'armor_none',
        equipWeapon: found?.equipWeapon || 'weapon_none',
        equipWings: found?.equipWings || 'wings_none',
        equipAura: found?.equipAura || 'aura_none',
        equipMount: 'mount_none',
        propColors: found?.propColors,
        animMode: 'cheer',
        animSeed: idx * 1.7,
      });
      charParts.rootGroup.scale.setScalar(0.82);
      wrapper.add(charParts.rootGroup);

      const isMe = slotId === activeMySlot;
      const isTeammate = !isMe && team === myTeam;
      const ringColor = isMe ? 0xfacc15 : isTeammate ? 0x38bdf8 : 0xf43f5e;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.56, 0.72, 24),
        new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.035;
      scene.add(ring);

      const zOffset = mode === '2v2' ? (slotId.endsWith('1') ? 0.42 : -0.42) : 0;
      scene.add(wrapper);

      return { slotId, root: wrapper, charParts, ring, zOffset };
    });

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      updateCameraForAspect(w, h);
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let elapsed = 0;
    let lastNetSend = 0;
    let lastScoreL = 0;
    let lastScoreR = 0;
    winHandledRef.current = false;

    // Visual-space smoothing offsets (eliminates sawtooth rubber-banding & packet-arrival pops on Guest!)
    let ballErrX = 0;
    let ballErrY = 0;
    const playerErrX: Record<VbSlotId, number> = { L1: 0, L2: 0, R1: 0, R2: 0 };
    const playerErrY: Record<VbSlotId, number> = { L1: 0, L2: 0, R1: 0, R2: 0 };

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (typeof document !== 'undefined' && document.hidden) {
        clock.getDelta();
        return;
      }

      const delta = Math.min(0.033, clock.getDelta());
      elapsed += delta;
      const st = matchStateRef.current;
      if (!st) return;

      const nowMs = performance.now();

      if (isHostRef.current) {
        const inputs: Record<VbSlotId, VbInputState> = {
          L1: { ...EMPTY_INPUT },
          L2: { ...EMPTY_INPUT },
          R1: { ...EMPTY_INPUT },
          R2: { ...EMPTY_INPUT },
        };

        for (const p of st.players) {
          if (p.slotId === activeMySlot) {
            inputs[p.slotId] = localInputRef.current;
          } else {
            inputs[p.slotId] = remoteInputsRef.current[p.slotId] || EMPTY_INPUT;
            // Apply Guest's client-authoritative position (clamped safely to Guest's side of the court!)
            const rk = remoteKinematicsRef.current[p.slotId];
            if (rk && st.phase !== 'serve_wait' && typeof rk.x === 'number' && typeof rk.y === 'number') {
              const minX =
                p.team === 'left'
                  ? -st.court.halfWidth + st.court.playerRadius
                  : st.court.netHalfThickness + st.court.playerRadius;
              const maxX =
                p.team === 'left'
                  ? -st.court.netHalfThickness - st.court.playerRadius
                  : st.court.halfWidth - st.court.playerRadius;
              p.x = Math.max(minX, Math.min(maxX, rk.x));
              p.y = Math.max(0, Math.min(5.5, rk.y));
              if (typeof rk.vx === 'number') p.vx = rk.vx;
              if (typeof rk.vy === 'number') p.vy = rk.vy;
              if (rk.f) p.facing = rk.f;
              if (typeof rk.dt === 'number') p.diveTimer = rk.dt;
              if (rk.dd) p.diveDir = rk.dd;
              // Consume position sample once; stepVolleyballMatch continues dead-reckoning with rk.input until next packet
              rk.x = undefined;
            }
          }
        }

        const ev = stepVolleyballMatch(st, inputs, delta);
        if (ev.spike) {
          playVbSound('spike', mutedRef.current);
          setShakeActive(true);
          setTimeout(() => setShakeActive(false), 260);
        } else if (ev.hit) {
          playVbSound('hit', mutedRef.current);
        }
        if (ev.dive) playVbSound('dive', mutedRef.current);
        if (ev.score) {
          playVbSound('score', mutedRef.current);
          setPointBanner(ev.score === 'left' ? '🔥 ทีมซ้ายได้แต้ม!' : '⚡ ทีมขวาได้แต้ม!');
          setTimeout(() => setPointBanner(''), 1050);
        }
        if (ev.win && !winHandledRef.current) {
          winHandledRef.current = true;
          playVbSound('win', mutedRef.current);
          setWinnerTeam(ev.win);
          if (ev.win === myTeam) {
            confetti({ particleCount: 95, spread: 80, origin: { y: 0.55 } });
            void claimWinRewardRef.current();
          }
        }

        if (st.scoreLeft !== lastScoreL || st.scoreRight !== lastScoreR) {
          lastScoreL = st.scoreLeft;
          lastScoreR = st.scoreRight;
          setScoreLeft(st.scoreLeft);
          setScoreRight(st.scoreRight);
        }

        const hasImportantEvent = Boolean(ev.hit || ev.spike || ev.dive || ev.score || ev.win);
        if (hasImportantEvent || nowMs - lastNetSend >= 50) {
          lastNetSend = nowMs;
          const compact: CompactNetState = {
            ph: st.phase,
            pt: r2(st.phaseTimer),
            sl: st.scoreLeft,
            sr: st.scoreRight,
            sv: st.servingTeam,
            w: st.winner,
            bx: r2(st.ball.x),
            by: r2(st.ball.y),
            bvx: r2(st.ball.vx),
            bvy: r2(st.ball.vy),
            bsp: st.ball.isSpiked,
            pl: st.players.map((p) => ({
              s: p.slotId,
              x: r2(p.x),
              y: r2(p.y),
              vx: r2(p.vx),
              vy: r2(p.vy),
              f: p.facing,
              dt: r2(p.diveTimer),
              dd: p.diveDir,
              sf: r2(p.spikeFlash),
            })),
            ev: hasImportantEvent
              ? {
                  h: ev.hit ? 1 : undefined,
                  sp: ev.spike ? 1 : undefined,
                  dv: ev.dive ? 1 : undefined,
                  sc: ev.score,
                }
              : undefined,
          };
          sendRoomMessage('vb_state', { s: compact });
        }
      } else {
        // Guest: decay visual smoothing offsets smoothly at display refresh rate (60-120fps)
        const errDecay = Math.exp(-15 * delta);
        ballErrX *= errDecay;
        ballErrY *= errDecay;
        for (const sid of activeSlotIds) {
          playerErrX[sid] *= errDecay;
          playerErrY[sid] *= errDecay;
        }

        // 1. Consume NEW Host packet ONCE when it arrives (zero sawtooth yanks on intermediate frames!)
        const netSnap = netTargetStateRef.current;
        if (netSnap && !netSnap.consumed) {
          netSnap.consumed = true;
          const prevPhase = st.phase;
          st.phase = netSnap.ph;
          st.phaseTimer = netSnap.pt;
          st.scoreLeft = netSnap.sl;
          st.scoreRight = netSnap.sr;
          st.servingTeam = netSnap.sv;
          st.winner = netSnap.w;
          st.ball.isSpiked = netSnap.bsp;

          const curRenderBx = st.ball.x + ballErrX;
          const curRenderBy = st.ball.y + ballErrY;
          st.ball.x = netSnap.bx;
          st.ball.y = netSnap.by;
          st.ball.vx = netSnap.bvx;
          st.ball.vy = netSnap.bvy;

          const jumpDist = Math.hypot(curRenderBx - netSnap.bx, curRenderBy - netSnap.by);
          if (netSnap.ph === 'serve_wait' || prevPhase === 'serve_wait' || jumpDist > 3.8) {
            ballErrX = 0;
            ballErrY = 0;
          } else {
            ballErrX = curRenderBx - netSnap.bx;
            ballErrY = curRenderBy - netSnap.by;
          }

          for (const netP of netSnap.pl) {
            const localP = st.players.find((lp) => lp.slotId === netP.s);
            if (!localP) continue;
            const isLocal = netP.s === activeMySlot;
            if (isLocal) {
              // Local player is 100% client-authoritative during active play (zero rubber-banding!); snap only on rally reset!
              if (netSnap.ph === 'serve_wait' && prevPhase !== 'serve_wait') {
                localP.x = netP.x;
                localP.y = netP.y;
                localP.vx = 0;
                localP.vy = 0;
                playerErrX[netP.s] = 0;
                playerErrY[netP.s] = 0;
              }
            } else {
              const curRx = localP.x + playerErrX[netP.s];
              const curRy = localP.y + playerErrY[netP.s];
              localP.x = netP.x;
              localP.y = netP.y;
              localP.vx = netP.vx;
              localP.vy = netP.vy;
              localP.facing = netP.f;
              localP.diveTimer = netP.dt;
              localP.diveDir = netP.dd;
              localP.spikeFlash = netP.sf;
              const pJump = Math.hypot(curRx - netP.x, curRy - netP.y);
              if (netSnap.ph === 'serve_wait' || pJump > 3.0) {
                playerErrX[netP.s] = 0;
                playerErrY[netP.s] = 0;
              } else {
                playerErrX[netP.s] = curRx - netP.x;
                playerErrY[netP.s] = curRy - netP.y;
              }
            }
          }
        }

        // 2. Step pure 60fps local physics (local player uses live input; remote players extrapolate velocity smoothly!)
        const curInp = localInputRef.current;
        const guestInputs: Record<VbSlotId, VbInputState> = {
          L1: { ...EMPTY_INPUT },
          L2: { ...EMPTY_INPUT },
          R1: { ...EMPTY_INPUT },
          R2: { ...EMPTY_INPUT },
        };
        for (const p of st.players) {
          if (p.slotId === activeMySlot) {
            guestInputs[p.slotId] = curInp;
          } else {
            // Reconstruct horizontal hold from latest remote velocity so remote players don't decelerate to 0 between packets!
            guestInputs[p.slotId] = {
              left: p.vx < -1.5,
              right: p.vx > 1.5,
              jump: false,
              action: false,
            };
          }
        }
        stepVolleyballMatch(st, guestInputs, delta);

        // 3. Send local input + exact local kinematics to Host (immediate on input change + 45ms while moving/airborne)
        const myP = st.players.find((lp) => lp.slotId === activeMySlot);
        const inpSig = `${curInp.left ? 1 : 0}${curInp.right ? 1 : 0}${curInp.jump ? 1 : 0}${curInp.down ? 1 : 0}${curInp.action ? 1 : 0}`;
        const isMovingOrAir = Boolean(
          myP && (Math.abs(myP.vx) > 0.1 || myP.y > 0.01 || myP.diveTimer > 0)
        );
        const sendInterval = isMovingOrAir ? 45 : 140;
        if (inpSig !== lastSentInputSigRef.current || nowMs - lastNetSend >= sendInterval) {
          lastSentInputSigRef.current = inpSig;
          lastNetSend = nowMs;
          sendRoomMessage('vb_input', {
            slot: activeMySlot,
            input: { ...curInp },
            x: myP ? r2(myP.x) : undefined,
            y: myP ? r2(myP.y) : undefined,
            vx: myP ? r2(myP.vx) : undefined,
            vy: myP ? r2(myP.vy) : undefined,
            f: myP?.facing,
            dt: myP ? r2(myP.diveTimer) : undefined,
            dd: myP?.diveDir,
          });
        }

        if (st.phase === 'finished' && st.winner && !winHandledRef.current) {
          winHandledRef.current = true;
          playVbSound('win', mutedRef.current);
          setWinnerTeam(st.winner);
          if (st.winner === myTeam) {
            confetti({ particleCount: 95, spread: 80, origin: { y: 0.55 } });
            void claimWinRewardRef.current();
          }
        }
      }

      // Sync 3D Ball & Shadow (with visual smoothing offset)
      const renderBx = st.ball.x + ballErrX;
      const renderBy = Math.max(st.court.ballRadius, st.ball.y + ballErrY);
      ballMesh.position.set(renderBx, renderBy, 0);
      ballMesh.rotation.z = -st.ball.spin;
      ballMesh.rotation.x = st.ball.spin * 0.4;
      spikeGlow.visible = st.ball.isSpiked;
      if (st.ball.isSpiked) {
        spikeGlow.scale.setScalar(1.25 + Math.sin(elapsed * 28) * 0.16);
        trailHistory.unshift({ x: renderBx, y: renderBy });
        if (trailHistory.length > 7) trailHistory.pop();
        trailMeshes.forEach((tm, ti) => {
          const hist = trailHistory[Math.min(trailHistory.length - 1, (ti + 1) * 2)];
          if (hist) {
            tm.position.set(hist.x, hist.y, -0.05);
            tm.visible = true;
          }
        });
      } else {
        trailHistory.length = 0;
        trailMeshes.forEach((tm) => {
          tm.visible = false;
        });
      }

      ballShadow.position.set(renderBx, 0.03, 0);
      const hFactor = Math.max(0.35, 1 - renderBy / 11);
      ballShadow.scale.setScalar(hFactor);
      (ballShadow.material as THREE.MeshBasicMaterial).opacity = 0.45 * hFactor;

      // Sync 3D Characters (with visual smoothing offset on remote slots)
      for (const vis of visuals) {
        const p = st.players.find((pl) => pl.slotId === vis.slotId);
        if (!p) continue;
        const rx = p.x + playerErrX[vis.slotId];
        const ry = Math.max(0, p.y + playerErrY[vis.slotId]);
        vis.root.position.set(rx, ry, vis.zOffset);
        vis.ring.position.set(rx, 0.035, vis.zOffset);

        const targetYaw = p.facing > 0 ? 0.2 : Math.PI - 0.2;
        vis.root.rotation.y += (targetYaw - vis.root.rotation.y) * 0.25;

        const targetTilt = p.diveTimer > 0 ? -p.diveDir * 0.85 : p.spikeFlash > 0 ? p.facing * 0.25 : 0;
        vis.root.rotation.z += (targetTilt - vis.root.rotation.z) * 0.35;

        vis.charParts.mixer?.update(delta);
        if (vis.charParts.auraSpinGroup) {
          vis.charParts.auraSpinGroup.rotation.y = elapsed * 1.8;
        }
        if (!vis.charParts.mixer) {
          const runCycle = Math.abs(p.vx) > 0.4 ? Math.sin(elapsed * 14) * 0.45 : 0;
          vis.charParts.legL.rotation.z = runCycle;
          vis.charParts.legR.rotation.z = -runCycle;
          vis.charParts.armL.rotation.z = p.y > 0.2 ? 2.4 : -runCycle * 0.8;
          vis.charParts.armR.rotation.z = p.y > 0.2 ? 2.4 : runCycle * 0.8;
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      visuals.forEach((v) => {
        v.charParts.rootGroup.userData.disposed = true;
      });
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, [isOpen, screen, mode, qualityMode, sendRoomMessage]);

  if (!isOpen) return null;

  const maxPlayers = mode === '2v2' ? 4 : 2;
  const joinedCount = Object.keys(humanSlots).length;
  const leftSlotIds: VbSlotId[] = mode === '2v2' ? ['L1', 'L2'] : ['L1'];
  const rightSlotIds: VbSlotId[] = mode === '2v2' ? ['R1', 'R2'] : ['R1'];
  const myTeam: VbTeam = mySlot.startsWith('L') ? 'left' : 'right';

  const setTouchKey = (key: keyof VbInputState, val: boolean) => {
    localInputRef.current[key] = val;
  };

  const setSlideKnobDom = (px: number, py: number) => {
    if (slideKnobDomRef.current) {
      slideKnobDomRef.current.style.transform = `translate(${px}px, ${py}px)`;
    }
  };

  const handleSlideDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    slidePointerIdRef.current = e.pointerId;
    slideOriginXRef.current = e.clientX;
    slideOriginYRef.current = e.clientY;
    setSlideKnobDom(0, 0);
  };

  const handleSlideMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (slidePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - slideOriginXRef.current;
    const dy = e.clientY - slideOriginYRef.current;
    const dist = Math.hypot(dx, dy);
    const maxR = 40;
    const scale = dist > maxR ? maxR / dist : 1;
    setSlideKnobDom(dx * scale, dy * scale);
    const deadzone = 12;
    localInputRef.current.left = dx < -deadzone;
    localInputRef.current.right = dx > deadzone;
    localInputRef.current.down = dy > 16;
  };

  const handleSlideEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (slidePointerIdRef.current !== e.pointerId) return;
    slidePointerIdRef.current = null;
    setSlideKnobDom(0, 0);
    localInputRef.current.left = false;
    localInputRef.current.right = false;
    localInputRef.current.down = false;
  };

  return (
    <div className={`fixed inset-0 z-50 bg-slate-950/90 flex flex-col overflow-hidden ${shakeActive ? 'shake-active' : ''}`}>
      {screen === 'waiting' ? (
        <div className="w-full h-dvh overflow-y-auto flex items-center justify-center p-3 sm:p-5 pt-safe pb-safe">
          <div className="rpg-stone-frame rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-4 relative my-auto">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 bg-rose-600 hover:bg-rose-500 text-white border-2 border-amber-300 rounded-xl font-extrabold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex items-center gap-2.5 pr-10">
              <div className="w-11 h-11 rounded-xl bg-amber-400 border-2 border-white flex items-center justify-center text-2xl shadow">
                🏐
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-kanit)] text-lg sm:text-2xl font-extrabold text-amber-300 leading-tight">
                  ตี้วอลเลย์บอลชายหาด 3D
                </h2>
                <p className="text-[11px] sm:text-xs text-amber-100/80 font-semibold">
                  แข่งกับคนจริงเท่านั้น • เลือก 1v1 หรือ 2v2 ได้ตลอดก่อนกดเริ่ม ({VB_WIN_SCORE} แต้มชนะ +5 💰)
                </p>
              </div>
            </div>

            {/* Host Mode Switcher (1v1 / 2v2) */}
            <div className="bg-slate-900/85 border border-amber-500/40 rounded-xl p-1.5 flex gap-1.5">
              {(
                [
                  { id: '1v1', label: '⚔️ 1 vs 1 (2 คน)' },
                  { id: '2v2', label: '👥 2 vs 2 (4 คน)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!initialIsHost}
                  onClick={() => {
                    if (!initialIsHost || mode === opt.id) return;
                    let nextSlots = { ...humanSlotsRef.current };
                    if (opt.id === '1v1') {
                      const l1 = nextSlots.L1;
                      const r1 = nextSlots.R1 || nextSlots.L2 || nextSlots.R2;
                      nextSlots = {};
                      if (l1) nextSlots.L1 = l1;
                      if (r1) nextSlots.R1 = r1;
                    }
                    setMode(opt.id);
                    modeRef.current = opt.id;
                    setHumanSlots(nextSlots);
                    humanSlotsRef.current = nextSlots;
                    sendRoomMessage('room_sync', { mode: opt.id, humanSlots: nextSlots });
                    broadcastArenaLobby('waiting', opt.id, nextSlots);
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-extrabold cursor-pointer transition disabled:cursor-default ${mode === opt.id
                      ? 'rpg-btn-gold'
                      : 'text-amber-100/75 hover:bg-slate-800 disabled:hover:bg-transparent'
                    }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Live Waiting Status */}
            <div
              className={`border-2 rounded-xl p-3 text-center space-y-1 ${joinedCount >= maxPlayers
                  ? 'bg-emerald-950/75 border-emerald-400/80'
                  : 'bg-sky-950/75 border-sky-400/70'
                }`}
            >
              <div className="font-[family-name:var(--font-kanit)] text-base sm:text-lg font-extrabold text-amber-300">
                {joinedCount >= maxPlayers
                  ? `✅ คนครบแล้ว! (${joinedCount}/${maxPlayers} คน)`
                  : `⏳ กำลังรอเพื่อนกดเข้าร่วม... (${joinedCount}/${maxPlayers} คน)`}
              </div>
              <div className="text-[11px] text-sky-200 font-semibold">
                {joinedCount >= maxPlayers
                  ? initialIsHost
                    ? 'กดปุ่มเริ่มแข่งด้านล่างได้เลย หรือสลับเป็น 2 vs 2 เพื่อรอเพื่อนเพิ่ม!'
                    : 'รอหัวห้องกดปุ่มเริ่มแข่ง...'
                  : invitedTargetName
                    ? `ส่งคำชวนไปยัง ${invitedTargetName} และเพื่อนในสนามแล้ว! เพื่อนแค่กดปุ่มแจ้งเตือนหน้าจอเพื่อเข้าตี้ได้เลย`
                    : 'เพื่อนที่ออนไลน์ในสนามจะเห็นปุ่มแจ้งเตือนชวนตีบอลบนหน้าจอทันที!'}
              </div>
            </div>

            {/* Slots Display */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-900/85 border-2 border-amber-400/60 rounded-xl p-2.5 space-y-2">
                <div className="text-xs font-extrabold text-amber-300 text-center">🟡 ทีมซ้าย</div>
                {leftSlotIds.map((sid) => {
                  const m = humanSlots[sid];
                  return (
                    <div
                      key={sid}
                      className={`rounded-xl p-2.5 border text-center ${m
                        ? 'bg-amber-500/20 border-amber-300 text-amber-100'
                        : 'bg-slate-950/70 border-dashed border-slate-600 text-slate-400'
                        }`}
                    >
                      {m ? (
                        <div className="text-xs font-extrabold truncate">
                          {m.emoji} {m.name} {sid === mySlot ? '(คุณ)' : ''}
                        </div>
                      ) : (
                        <div className="text-[11px] font-bold animate-pulse">⏳ รอเพื่อนเข้า...</div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-900/85 border-2 border-rose-400/60 rounded-xl p-2.5 space-y-2">
                <div className="text-xs font-extrabold text-rose-300 text-center">🔴 ทีมขวา</div>
                {rightSlotIds.map((sid) => {
                  const m = humanSlots[sid];
                  return (
                    <div
                      key={sid}
                      className={`rounded-xl p-2.5 border text-center ${m
                        ? 'bg-rose-500/20 border-rose-300 text-rose-100'
                        : 'bg-slate-950/70 border-dashed border-slate-600 text-slate-400'
                        }`}
                    >
                      {m ? (
                        <div className="text-xs font-extrabold truncate">
                          {m.emoji} {m.name} {sid === mySlot ? '(คุณ)' : ''}
                        </div>
                      ) : (
                        <div className="text-[11px] font-bold animate-pulse">⏳ รอเพื่อนเข้า...</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Host Start Button (manual start so Host can switch 1v1 <-> 2v2 before starting!) */}
            {initialIsHost ? (
              <button
                type="button"
                disabled={joinedCount < maxPlayers}
                onClick={() => {
                  const curSlots = humanSlotsRef.current;
                  broadcastArenaLobby('started', mode, curSlots);
                  sendRoomMessage('start_match', { mode, humanSlots: curSlots });
                  winHandledRef.current = false;
                  rewardClaimedRef.current = false;
                  remoteKinematicsRef.current = {};
                  setWinnerTeam(null);
                  setRewardStatus('');
                  setPointBanner('');
                  setScoreLeft(0);
                  setScoreRight(0);
                  screenRef.current = 'playing';
                  setScreen('playing');
                }}
                className="w-full rpg-btn-gold font-[family-name:var(--font-kanit)] py-3 rounded-xl text-sm sm:text-base font-extrabold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {joinedCount >= maxPlayers
                  ? `🏐 เริ่มแข่ง ${mode === '2v2' ? '2 vs 2' : '1 vs 1'} เลย! (START)`
                  : `⏳ รอเพื่อนให้ครบ ${maxPlayers} คน (${joinedCount}/${maxPlayers})`}
              </button>
            ) : (
              <div className="w-full py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-center text-xs font-extrabold text-amber-200">
                {joinedCount >= maxPlayers
                  ? '✅ พร้อมแล้ว! รอหัวห้องกดเริ่มแข่ง...'
                  : `⏳ รอเพื่อนเพิ่มให้ครบ ${maxPlayers} คน...`}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-amber-100 text-xs font-extrabold cursor-pointer hover:bg-rose-900/60"
            >
              ยกเลิก / กลับไปเดินเล่น
            </button>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-dvh overflow-hidden select-none">
          <div ref={canvasWrapRef} className="fixed inset-0 w-full h-full touch-none" />

          {/* Top RPG Scoreboard HUD */}
          <div className="fixed top-2 sm:top-3 inset-x-2 sm:inset-x-4 pt-safe z-20 flex items-center justify-between gap-2 pointer-events-none">
            <button
              type="button"
              onClick={onClose}
              className="pointer-events-auto rpg-panel px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-extrabold text-amber-100 hover:bg-rose-600 cursor-pointer"
            >
              ← ออก
            </button>

            <div className="pointer-events-auto rpg-banner rounded-2xl px-3 sm:px-5 py-1.5 flex items-center gap-2 sm:gap-4 shadow-xl">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-amber-200 max-w-[110px] sm:max-w-[160px] truncate">
                <span>{leftSlotIds.map((s) => humanSlots[s]?.emoji || '🐰').join('')}</span>
                <span className="hidden sm:inline truncate">{humanSlots.L1?.name || 'ทีมซ้าย'}</span>
              </div>
              <div className="flex items-center gap-2 font-[family-name:var(--font-kanit)] font-black text-xl sm:text-2xl">
                <span className="bg-amber-400 text-black px-2.5 py-0.5 rounded-lg min-w-[34px] text-center">
                  {scoreLeft}
                </span>
                <span className="text-amber-300 text-base">⚡</span>
                <span className="bg-rose-500 text-white px-2.5 py-0.5 rounded-lg min-w-[34px] text-center">
                  {scoreRight}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-rose-200 max-w-[110px] sm:max-w-[160px] truncate">
                <span className="hidden sm:inline truncate">{humanSlots.R1?.name || 'ทีมขวา'}</span>
                <span>{rightSlotIds.map((s) => humanSlots[s]?.emoji || '🦊').join('')}</span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowTouchControls((v) => !v)}
                className={`rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${showTouchControls ? 'text-amber-300 ring-1 ring-amber-300' : 'text-amber-100/75'
                  }`}
                title="เปิด/ปิดปุ่มบังคับบนหน้าจอ (มือถือ / iPad)"
              >
                🎮
              </button>
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                className="rpg-panel px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-extrabold text-amber-100 cursor-pointer"
                title="เปิด/ปิดเสียงเอฟเฟกต์"
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>

          {pointBanner && !winnerTeam && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="rpg-btn-gold px-5 py-2 rounded-full font-[family-name:var(--font-kanit)] font-extrabold text-base sm:text-lg shadow-2xl animate-bounce">
                {pointBanner}
              </div>
            </div>
          )}

          {/* Desktop Controls Hint (shown when touch controls are off) */}
          {!showTouchControls && (
            <div className="hidden lg:flex fixed bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="rpg-panel rounded-full px-4 py-1.5 text-xs font-bold text-amber-100 flex items-center gap-2.5">
                <span>⬅️➡️ / A,D เดิน</span>
                <span>•</span>
                <span>⬆️ / W / Space กระโดด</span>
                <span>•</span>
                <span>💥 Enter / Z / Shift + ทิศทาง (⬆️โด่ง / ➡️พุ่ง / ⬇️ตบปักพื้น!)</span>
              </div>
            </div>
          )}

          {/* Multi-Touch Controls: 2D Pikachu Directional Pad + Right Jump & Spike Buttons */}
          {!winnerTeam && showTouchControls && (
            <div className="flex fixed bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-5 pb-safe z-30 items-end justify-between pointer-events-none">
              {/* Left Thumb: 2D Pad (Left/Right to Move & Aim, Down to Aim Steep Smash!) */}
              <div
                onPointerDown={handleSlideDown}
                onPointerMove={handleSlideMove}
                onPointerUp={handleSlideEnd}
                onPointerCancel={handleSlideEnd}
                className="pointer-events-auto relative w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-slate-900/65 border-2 border-amber-300/80 shadow-xl flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
              >
                <span className="absolute left-2 text-amber-300/85 text-xs sm:text-sm font-black pointer-events-none">
                  ◀
                </span>
                <span className="absolute right-2 text-amber-300/85 text-xs sm:text-sm font-black pointer-events-none">
                  ▶
                </span>
                <span className="absolute bottom-1 text-rose-300/90 text-[9px] sm:text-[10px] font-black pointer-events-none">
                  ▼ ตบปัก
                </span>
                <div
                  ref={slideKnobDomRef}
                  className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 border-2 border-white shadow-lg flex flex-col items-center justify-center text-stone-950 font-black pointer-events-none"
                >
                  <span className="text-sm sm:text-base leading-none">🕹️</span>
                </div>
              </div>

              {/* Right Thumb: Spike/Dive + Jump */}
              <div className="flex gap-2.5 sm:gap-3.5 pointer-events-auto">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setTouchKey('action', true);
                  }}
                  onPointerUp={() => setTouchKey('action', false)}
                  onPointerCancel={() => setTouchKey('action', false)}
                  className="w-16 h-16 sm:w-21 sm:h-21 rounded-full bg-gradient-to-b from-orange-500/95 to-rose-600/95 active:scale-95 border-2 border-amber-200 text-white flex flex-col items-center justify-center font-extrabold shadow-xl touch-none"
                >
                  <span className="text-xl sm:text-2xl leading-none">💥</span>
                  <span className="text-[10px] sm:text-xs mt-0.5">ตบ/พุ่ง</span>
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setTouchKey('jump', true);
                  }}
                  onPointerUp={() => setTouchKey('jump', false)}
                  onPointerCancel={() => setTouchKey('jump', false)}
                  className="w-16 h-16 sm:w-21 sm:h-21 rounded-full bg-gradient-to-b from-sky-500/95 to-blue-700/95 active:scale-95 border-2 border-amber-200 text-white flex flex-col items-center justify-center font-extrabold shadow-xl touch-none"
                >
                  <span className="text-2xl leading-none">⬆</span>
                  <span className="text-[10.5px] sm:text-xs mt-0.5">กระโดด</span>
                </button>
              </div>
            </div>
          )}

          {/* Victory / Rematch Overlay */}
          {winnerTeam && (
            <div className="fixed inset-0 z-30 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="rpg-stone-frame rounded-3xl max-w-md w-full p-5 text-center space-y-3.5">
                <div className="text-4xl">{winnerTeam === myTeam ? '🏆' : '😅'}</div>
                <h3 className="font-[family-name:var(--font-kanit)] text-2xl font-extrabold text-amber-300">
                  {winnerTeam === myTeam ? 'ชนะแล้ว!! สุดยอดนักตบ!' : 'แพ้ไปนิดเดียว เอาใหม่!'}
                </h3>
                <div className="font-[family-name:var(--font-kanit)] text-3xl font-black text-white">
                  {scoreLeft} <span className="text-amber-400">-</span> {scoreRight}
                </div>
                {rewardStatus && (
                  <div className="bg-emerald-950/80 border border-emerald-400/70 rounded-xl px-3 py-2 text-xs font-extrabold text-emerald-200">
                    {rewardStatus}
                  </div>
                )}
                {initialIsHost ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (matchStateRef.current) {
                        matchStateRef.current.scoreLeft = 0;
                        matchStateRef.current.scoreRight = 0;
                        matchStateRef.current.winner = null;
                        resetRallyPositions(matchStateRef.current, 'left');
                      }
                      winHandledRef.current = false;
                      rewardClaimedRef.current = false;
                      remoteKinematicsRef.current = {};
                      setScoreLeft(0);
                      setScoreRight(0);
                      setWinnerTeam(null);
                      setPointBanner('');
                      setRewardStatus('');
                      sendRoomMessage('start_match', { mode, humanSlots: humanSlotsRef.current });
                    }}
                    className="w-full rpg-btn-gold py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
                  >
                    🔄 แข่งอีกรอบกับตี้เดิม!
                  </button>
                ) : (
                  <div className="text-xs font-bold text-amber-200/80">
                    รอหัวห้องกดแข่งอีกรอบ หรือกดกลับสนามหลักด้านล่าง
                  </div>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-amber-100 text-xs font-extrabold cursor-pointer"
                >
                  🏖️ กลับสู่สนามหลัก
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
