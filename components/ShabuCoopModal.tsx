'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildCharacterMesh,
  buildCustomGuardCharacter,
  type CharacterMeshParts,
} from '@/lib/character_3d';
import type { VolleyballPlayerSummary } from '@/components/BeachVolleyballModal';
import {
  detectDeviceTier,
  getQualityConfig,
  disposeObject3D,
  type QualityMode,
} from '@/lib/device_perf';
import {
  SHABU_STATIONS,
  SHABU_STATION_MAP,
  SHABU_POT_POS,
  SHABU_GUARD_POS,
  createInitialShabuState,
  stepShabuGame,
  computeShabuGpReward,
  playShabuSound,
  type ShabuSlotId,
  type ShabuIngredient,
  type ShabuInputState,
  type ShabuGameState,
  type ShabuOrderItem,
} from '@/lib/shabu_engine';

export interface ShabuLobbyBroadcastInfo {
  roomCode: string;
  hostUserId: number;
  hostName: string;
  hostEmoji: string;
  targetName?: string;
  count: number;
  max: number;
  status: 'waiting' | 'started' | 'closed';
}

interface ShabuCoopModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: VolleyballPlayerSummary[];
  currentUserId: number | null;
  qualityMode?: QualityMode;
  initialRoomCode: string;
  initialIsHost: boolean;
  invitedTargetName?: string;
  onLobbyBroadcast?: (info: ShabuLobbyBroadcastInfo) => void;
  onRewardEarned?: (earned: number, newPoints: number) => void;
}

interface ShabuMember {
  clientId: string;
  playerId: number;
  name: string;
  emoji: string;
}

const EMPTY_INPUT: ShabuInputState = { mx: 0, mz: 0, interact: false, dash: false };
const SLOT_ORDER: ShabuSlotId[] = ['P1', 'P2', 'P3', 'P4'];

function makeLabelSprite(text: string, bgHex: string, borderHex: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bgHex;
    ctx.strokeStyle = borderHex;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(6, 6, 244, 68, 18);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 42);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(2.5, 0.78, 1);
  return sp;
}

function makeHoldingSprite(emoji: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = '64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 64, 68);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(1.05, 1.05, 1);
  return sp;
}

export function ShabuCoopModal({
  isOpen,
  onClose,
  players,
  currentUserId,
  qualityMode = 'auto',
  initialRoomCode,
  initialIsHost,
  invitedTargetName,
  onLobbyBroadcast,
  onRewardEarned,
}: ShabuCoopModalProps) {
  const [screen, setScreen] = useState<'waiting' | 'playing'>('waiting');
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

  const myClientIdRef = useRef<string>(`shabu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const [mySlot, setMySlot] = useState<ShabuSlotId>('P1');
  const [members, setMembers] = useState<Partial<Record<ShabuSlotId, ShabuMember>>>({});

  // Live HUD state
  const [hudScore, setHudScore] = useState<number>(0);
  const [hudCombo, setHudCombo] = useState<number>(0);
  const [hudMaxCombo, setHudMaxCombo] = useState<number>(0);
  const [hudDishes, setHudDishes] = useState<number>(0);
  const [hudHunger, setHudHunger] = useState<number>(100);
  const [hudSpeed, setHudSpeed] = useState<number>(1.0);
  const [hudOrder, setHudOrder] = useState<ShabuOrderItem[]>([]);
  const [hudFeedback, setHudFeedback] = useState<string>('');
  const [hudHolding, setHudHolding] = useState<ShabuIngredient | null>(null);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [shakeActive, setShakeActive] = useState<boolean>(false);
  const [rewardStatus, setRewardStatus] = useState<string>('');

  // Virtual Joystick state
  const [joyKnob, setJoyKnob] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const joyPointerIdRef = useRef<number | null>(null);
  const joyOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const localInputRef = useRef<ShabuInputState>({ ...EMPTY_INPUT });
  const keyStateRef = useRef<{ up: boolean; down: boolean; left: boolean; right: boolean }>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const remoteInputsRef = useRef<Record<ShabuSlotId, ShabuInputState>>({
    P1: { ...EMPTY_INPUT },
    P2: { ...EMPTY_INPUT },
    P3: { ...EMPTY_INPUT },
    P4: { ...EMPTY_INPUT },
  });
  const gameStateRef = useRef<ShabuGameState | null>(null);
  const netTargetStateRef = useRef<ShabuGameState | null>(null);
  const lastSentInputSigRef = useRef<string>('');
  const rewardClaimedRef = useRef<boolean>(false);
  const mutedRef = useRef<boolean>(false);
  mutedRef.current = muted;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const membersRef = useRef(members);
  membersRef.current = members;
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
    (status: 'waiting' | 'started' | 'closed', memObj: Partial<Record<ShabuSlotId, ShabuMember>>) => {
      if (!isHostRef.current || !initialRoomCode) return;
      const host = memObj.P1;
      onLobbyBroadcastRef.current?.({
        roomCode: initialRoomCode,
        hostUserId: host?.playerId ?? (currentUserId || 0),
        hostName: host?.name || 'เพื่อนในสนาม',
        hostEmoji: host?.emoji || '🍲',
        targetName: invitedTargetName,
        count: Object.keys(memObj).length,
        max: 4,
        status,
      });
    },
    [initialRoomCode, currentUserId, invitedTargetName]
  );

  const claimShabuReward = useCallback(
    async (finalScore: number) => {
      if (rewardClaimedRef.current) return;
      rewardClaimedRef.current = true;
      if (!currentUserId || currentUserId <= 0) {
        setRewardStatus('ล็อกอินเพื่อรับรางวัล Gacha Pong จากคะแนนตี้ชาบู!');
        return;
      }
      try {
        const res = await fetch('/api/rewards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: currentUserId, type: 'shabu_coop_finish', score: finalScore }),
        });
        const data = await res.json();
        if (res.ok && data.earned > 0) {
          setRewardStatus(
            `🎁 ทุกคนในตี้รับโบนัส +${data.earned} 💰 GP! (สะสมวันนี้ ${data.earnedToday}/${data.dailyCap} GP)`
          );
          onRewardEarned?.(data.earned, data.points);
        } else if (res.ok && data.capReached) {
          setRewardStatus(`รับโบนัสชาบูครบ ${data.dailyCap}/${data.dailyCap} GP ของวันนี้แล้ว (ยังเล่นทำสถิติต่อได้!)`);
        } else {
          setRewardStatus('ทำคะแนนอย่างน้อย 100 แต้มเพื่อรับ +1 💰 GP นะ!');
        }
      } catch {
        // ignore
      }
    },
    [currentUserId, onRewardEarned]
  );

  // Connect to Shabu Co-op Room immediately on open
  useEffect(() => {
    if (!isOpen || !initialRoomCode) return;

    setScreen('waiting');
    setIsFinished(false);
    setRewardStatus('');
    setHudScore(0);
    setHudCombo(0);
    setHudDishes(0);
    setHudHunger(100);
    rewardClaimedRef.current = false;

    const me = players.find((p) => p.id === currentUserId) || players[0];
    const myInfo: ShabuMember = {
      clientId: myClientIdRef.current,
      playerId: me?.id ?? 0,
      name: me?.name ?? 'ผู้กล้า',
      emoji: me?.emoji ?? '🐰',
    };

    if (initialIsHost) {
      const initMem: Partial<Record<ShabuSlotId, ShabuMember>> = { P1: myInfo };
      setMySlot('P1');
      mySlotRef.current = 'P1';
      setMembers(initMem);
      membersRef.current = initMem;
      broadcastArenaLobby('waiting', initMem);
    } else {
      setMembers({});
      membersRef.current = {};
    }

    const handleRoomEvent = (event: string, payload: Record<string, unknown>) => {
      if (!payload) return;

      if (event === 'join_req' && isHostRef.current) {
        if (screenRef.current === 'playing') return;
        const cid = String(payload.clientId || '');
        if (!cid || cid === myClientIdRef.current) return;
        const cur = { ...membersRef.current };
        let assigned = (Object.keys(cur) as ShabuSlotId[]).find((s) => cur[s]?.clientId === cid);
        if (!assigned) {
          assigned = SLOT_ORDER.find((s) => !cur[s]);
        }
        if (assigned) {
          cur[assigned] = {
            clientId: cid,
            playerId: Number(payload.playerId ?? 0),
            name: String(payload.name || 'เพื่อน'),
            emoji: String(payload.emoji || '🦊'),
          };
          setMembers(cur);
          membersRef.current = cur;
          sendRoomMessage('room_sync', { members: cur });
          broadcastArenaLobby('waiting', cur);
        }
      } else if (event === 'leave_req' && isHostRef.current) {
        const cid = String(payload.clientId || '');
        if (!cid) return;
        const cur = { ...membersRef.current };
        (Object.keys(cur) as ShabuSlotId[]).forEach((s) => {
          if (cur[s]?.clientId === cid) delete cur[s];
        });
        setMembers(cur);
        membersRef.current = cur;
        sendRoomMessage('room_sync', { members: cur });
        if (screenRef.current === 'waiting') {
          broadcastArenaLobby('waiting', cur);
        }
      } else if (event === 'room_sync' && !isHostRef.current) {
        const inc = (payload.members || {}) as Partial<Record<ShabuSlotId, ShabuMember>>;
        setMembers(inc);
        membersRef.current = inc;
        const myAssigned = (Object.keys(inc) as ShabuSlotId[]).find(
          (s) => inc[s]?.clientId === myClientIdRef.current
        );
        if (myAssigned) {
          setMySlot(myAssigned);
          mySlotRef.current = myAssigned;
        }
      } else if (event === 'start_shabu') {
        const inc = (payload.members || {}) as Partial<Record<ShabuSlotId, ShabuMember>>;
        setMembers(inc);
        membersRef.current = inc;
        const myAssigned = (Object.keys(inc) as ShabuSlotId[]).find(
          (s) => inc[s]?.clientId === myClientIdRef.current
        );
        if (myAssigned) {
          setMySlot(myAssigned);
          mySlotRef.current = myAssigned;
        }
        setIsFinished(false);
        setRewardStatus('');
        rewardClaimedRef.current = false;
        setScreen('playing');
      } else if (event === 'shabu_input' && isHostRef.current) {
        const slot = payload.slot as ShabuSlotId;
        const inp = payload.input as ShabuInputState;
        if (slot && inp) {
          remoteInputsRef.current[slot] = inp;
        }
      } else if (event === 'shabu_state' && !isHostRef.current) {
        const snap = payload.state as ShabuGameState | undefined;
        if (snap) {
          netTargetStateRef.current = snap;
        }
      }
    };

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(`waist-shabu-room-${initialRoomCode}`);
      bc.onmessage = (ev) => {
        if (ev.data && typeof ev.data.event === 'string') {
          handleRoomEvent(ev.data.event, ev.data.payload);
        }
      };
      bcRef.current = bc;
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && key) {
      const sb = createClient(url, key, {
        realtime: { params: { eventsPerSecond: 25 } },
      });
      const ch = sb.channel(`waist-shabu-room-${initialRoomCode}`, {
        config: { broadcast: { self: false } },
      });
      ch.on('broadcast', { event: 'join_req' }, ({ payload }) => handleRoomEvent('join_req', payload))
        .on('broadcast', { event: 'leave_req' }, ({ payload }) => handleRoomEvent('leave_req', payload))
        .on('broadcast', { event: 'room_sync' }, ({ payload }) => handleRoomEvent('room_sync', payload))
        .on('broadcast', { event: 'start_shabu' }, ({ payload }) => handleRoomEvent('start_shabu', payload))
        .on('broadcast', { event: 'shabu_input' }, ({ payload }) => handleRoomEvent('shabu_input', payload))
        .on('broadcast', { event: 'shabu_state' }, ({ payload }) => handleRoomEvent('shabu_state', payload))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' && !initialIsHost) {
            ch.send({ type: 'broadcast', event: 'join_req', payload: { ...myInfo } });
          }
        });
      supabaseRef.current = sb;
      channelRef.current = ch;
    }

    let heartbeatIv: ReturnType<typeof setInterval> | null = null;
    if (initialIsHost) {
      heartbeatIv = setInterval(() => {
        if (screenRef.current === 'waiting') {
          broadcastArenaLobby('waiting', membersRef.current);
        }
      }, 4500);
    } else {
      setTimeout(() => sendRoomMessage('join_req', { ...myInfo }), 120);
      heartbeatIv = setInterval(() => {
        if (
          screenRef.current === 'waiting' &&
          !Object.values(membersRef.current).some((m) => m?.clientId === myClientIdRef.current)
        ) {
          sendRoomMessage('join_req', { ...myInfo });
        }
      }, 1200);
    }

    return () => {
      if (heartbeatIv) clearInterval(heartbeatIv);
      if (initialIsHost) {
        broadcastArenaLobby('closed', membersRef.current);
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
  }, [isOpen, initialRoomCode, initialIsHost]);

  // Keyboard bindings while playing
  useEffect(() => {
    if (!isOpen || screen !== 'playing') return;
    const syncAxis = () => {
      const k = keyStateRef.current;
      localInputRef.current.mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      localInputRef.current.mz = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    };
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', ' '].includes(e.key)) {
        e.preventDefault();
      }
      const key = e.key.toLowerCase();
      if (key === 'a' || e.key === 'ArrowLeft') {
        keyStateRef.current.left = down;
        syncAxis();
      }
      if (key === 'd' || e.key === 'ArrowRight') {
        keyStateRef.current.right = down;
        syncAxis();
      }
      if (key === 'w' || e.key === 'ArrowUp') {
        keyStateRef.current.up = down;
        syncAxis();
      }
      if (key === 's' || e.key === 'ArrowDown') {
        keyStateRef.current.down = down;
        syncAxis();
      }
      if (e.key === ' ' || key === 'e' || e.key === 'Enter') {
        localInputRef.current.interact = down;
      }
      if (e.key === 'Shift' || key === 'j') {
        localInputRef.current.dash = down;
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    const onBlur = () => {
      keyStateRef.current = { up: false, down: false, left: false, right: false };
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

  // Main 3D Top-Down Shabu Buffet Scene & 60 FPS Game Loop
  useEffect(() => {
    if (!isOpen || screen !== 'playing' || !canvasWrapRef.current) return;
    const container = canvasWrapRef.current;
    container.innerHTML = '';

    const activeSlots = (Object.keys(membersRef.current) as ShabuSlotId[]).filter((s) =>
      Boolean(membersRef.current[s])
    );
    const slotsToUse: ShabuSlotId[] = activeSlots.length > 0 ? activeSlots : ['P1'];
    const game = createInitialShabuState(slotsToUse);
    gameStateRef.current = game;
    netTargetStateRef.current = null;
    lastSentInputSigRef.current = '';

    setHudOrder([...game.order]);
    setHudScore(0);
    setHudCombo(0);
    setHudMaxCombo(0);
    setHudDishes(0);
    setHudHunger(100);
    setHudSpeed(1.0);
    setHudHolding(null);
    setIsFinished(false);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const qCfg = getQualityConfig(qualityMode);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x271810);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    const updateCam = (w: number, h: number) => {
      const aspect = Math.max(0.48, w / Math.max(1, h));
      const boost = aspect < 1.25 ? (1.25 / aspect) * 0.78 : 1;
      camera.aspect = aspect;
      camera.position.set(0, 12.2 * Math.max(1, boost), 10.6 * Math.max(1, boost));
      camera.lookAt(0, 0.3, 0.25);
      camera.updateProjectionMatrix();
    };
    updateCam(width, height);

    const renderer = new THREE.WebGLRenderer({ antialias: qCfg.antialias });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qCfg.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = qCfg.shadowType;
    container.appendChild(renderer.domElement);

    // Warm Shabu Restaurant Lighting
    scene.add(new THREE.HemisphereLight(0xfffbeb, 0x451a03, 1.0));
    const mainLight = new THREE.DirectionalLight(0xfff7ed, 1.25);
    mainLight.position.set(5, 16, 8);
    mainLight.castShadow = true;
    const sSize = Math.min(1024, qCfg.shadowMapSize);
    mainLight.shadow.mapSize.set(sSize, sSize);
    mainLight.shadow.camera.left = -10;
    mainLight.shadow.camera.right = 10;
    mainLight.shadow.camera.top = 10;
    mainLight.shadow.camera.bottom = -10;
    scene.add(mainLight);

    // Wooden Restaurant Floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(15.6, 0.6, 10.8),
      new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.85 })
    );
    floor.position.set(0, -0.3, 0.2);
    floor.receiveShadow = true;
    scene.add(floor);

    // Decorative Tatami/Border Rug under Center Table
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.015, 0.55);
    rug.receiveShadow = true;
    scene.add(rug);

    // 4 Buffet Counters
    SHABU_STATIONS.forEach((st) => {
      const grp = new THREE.Group();
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 1.05, 1.55),
        new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.7 })
      );
      counter.position.y = 0.525;
      counter.castShadow = true;
      counter.receiveShadow = true;
      grp.add(counter);

      const topTrim = new THREE.Mesh(
        new THREE.BoxGeometry(2.62, 0.14, 1.66),
        new THREE.MeshStandardMaterial({ color: st.colorHex, roughness: 0.4 })
      );
      topTrim.position.y = 1.08;
      grp.add(topTrim);

      const tray = new THREE.Mesh(
        new THREE.BoxGeometry(1.75, 0.12, 0.95),
        new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.25, metalness: 0.4 })
      );
      tray.position.y = 1.18;
      grp.add(tray);

      const labelSp = makeLabelSprite(`${st.emoji} ${st.label}`, '#0f172a', `#${st.colorHex.toString(16).padStart(6, '0')}`);
      labelSp.position.set(0, 2.15, 0);
      grp.add(labelSp);

      grp.position.set(st.x, 0, st.z);
      scene.add(grp);
    });

    // Center Shabu Table + Induction Stove + Flippable 2-Broth Hotpot!
    const tableMesh = new THREE.Mesh(
      new THREE.BoxGeometry(3.1, 0.88, 2.05),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.65 })
    );
    tableMesh.position.set(SHABU_POT_POS.x, 0.44, SHABU_POT_POS.z);
    tableMesh.castShadow = true;
    tableMesh.receiveShadow = true;
    scene.add(tableMesh);

    const potGroup = new THREE.Group();
    const potOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.76, 0.68, 0.36, 24),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.65 })
    );
    potOuter.castShadow = true;
    potGroup.add(potOuter);

    // Split 2-broth soup (Clear Golden + Spicy Red Mala!)
    const clearSoup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.04, 20, 1, false, 0, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xfde68a })
    );
    clearSoup.position.y = 0.16;
    const malaSoup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 0.04, 20, 1, false, Math.PI, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    malaSoup.position.y = 0.16;
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.12, 1.4),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.7, roughness: 0.2 })
    );
    divider.position.y = 0.16;
    potGroup.add(clearSoup, malaSoup, divider);

    // Floating Steam Orbs above Pot
    const steamOrbs: THREE.Mesh[] = [];
    for (let si = 0; si < 5; si++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })
      );
      orb.position.set((si - 2) * 0.22, 0.4 + si * 0.22, (si % 2 - 0.5) * 0.25);
      potGroup.add(orb);
      steamOrbs.push(orb);
    }

    potGroup.position.set(SHABU_POT_POS.x, 0.95, SHABU_POT_POS.z);
    scene.add(potGroup);

    // Guard Boss sitting at head of table!
    const guardParts = buildCustomGuardCharacter();
    guardParts.rootGroup.position.set(SHABU_GUARD_POS.x, 0, SHABU_GUARD_POS.z);
    guardParts.rootGroup.rotation.y = Math.PI / 2; // face +Z (toward the hotpot!)
    guardParts.rootGroup.scale.setScalar(0.95);
    scene.add(guardParts.rootGroup);

    // Build Real 3D Players with Equipped Props + Holding Badges
    const activeMySlot = mySlotRef.current;
    const ringColors: Record<ShabuSlotId, number> = {
      P1: 0xfacc15,
      P2: 0x38bdf8,
      P3: 0x4ade80,
      P4: 0xf472b6,
    };

    interface PlayerVisual {
      slotId: ShabuSlotId;
      root: THREE.Group;
      charParts: CharacterMeshParts;
      ring: THREE.Mesh;
      holdSprites: Record<ShabuIngredient, THREE.Sprite>;
    }

    const visuals: PlayerVisual[] = slotsToUse.map((slotId, idx) => {
      const member = membersRef.current[slotId];
      const found =
        players.find((p) => p.id === member?.playerId) || players[idx % Math.max(1, players.length)];

      const wrapper = new THREE.Group();
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
        animSeed: idx * 1.4,
      });
      charParts.rootGroup.scale.setScalar(0.76);
      wrapper.add(charParts.rootGroup);

      // Pre-built holding sprites (toggle visibility = zero allocation per frame!)
      const holdSprites: Record<ShabuIngredient, THREE.Sprite> = {
        meat: makeHoldingSprite('🥩'),
        seafood: makeHoldingSprite('🦐'),
        veggie: makeHoldingSprite('🥬'),
        sauce: makeHoldingSprite('🥣'),
      };
      (Object.keys(holdSprites) as ShabuIngredient[]).forEach((k) => {
        holdSprites[k].position.set(0, 2.75, 0);
        holdSprites[k].visible = false;
        wrapper.add(holdSprites[k]);
      });

      const ringColor = slotId === activeMySlot ? 0xfacc15 : ringColors[slotId];
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.74, 24),
        new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      scene.add(ring);
      scene.add(wrapper);

      return { slotId, root: wrapper, charParts, ring, holdSprites };
    });

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      updateCam(w, h);
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let elapsed = 0;
    let lastNetSend = 0;
    let lastHudSync = 0;
    let finishHandled = false;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (typeof document !== 'undefined' && document.hidden) {
        clock.getDelta();
        return;
      }

      const delta = Math.min(0.033, clock.getDelta());
      elapsed += delta;
      const st = gameStateRef.current;
      if (!st) return;

      const nowMs = performance.now();

      if (isHostRef.current) {
        const inputs: Record<ShabuSlotId, ShabuInputState> = {
          P1: { ...EMPTY_INPUT },
          P2: { ...EMPTY_INPUT },
          P3: { ...EMPTY_INPUT },
          P4: { ...EMPTY_INPUT },
        };
        for (const p of st.players) {
          inputs[p.slotId] =
            p.slotId === activeMySlot
              ? localInputRef.current
              : remoteInputsRef.current[p.slotId] || EMPTY_INPUT;
        }

        const ev = stepShabuGame(st, inputs, delta);
        if (ev.pickup) playShabuSound('pickup', mutedRef.current);
        if (ev.drop) playShabuSound('drop', mutedRef.current);
        if (ev.serve) {
          playShabuSound('serve', mutedRef.current);
          confetti({ particleCount: 35, spread: 55, origin: { y: 0.45 } });
        }
        if (ev.wrong) playShabuSound('wrong', mutedRef.current);
        if (ev.dash) playShabuSound('dash', mutedRef.current);
        if (ev.flip) {
          playShabuSound('flip', mutedRef.current);
          setShakeActive(true);
          setTimeout(() => setShakeActive(false), 650);
        }

        if (nowMs - lastNetSend > 33) {
          lastNetSend = nowMs;
          sendRoomMessage('shabu_state', { state: st });
        }
      } else {
        // Guest: immediate input send on change + 65ms keepalive
        const curInp = localInputRef.current;
        const sig = `${curInp.mx.toFixed(1)},${curInp.mz.toFixed(1)},${curInp.interact ? 1 : 0},${curInp.dash ? 1 : 0}`;
        if (sig !== lastSentInputSigRef.current || nowMs - lastNetSend > 65) {
          lastSentInputSigRef.current = sig;
          lastNetSend = nowMs;
          sendRoomMessage('shabu_input', { slot: activeMySlot, input: { ...curInp } });
        }

        // Guest 60FPS local movement prediction + smooth reconciliation
        const guestInputs: Record<ShabuSlotId, ShabuInputState> = {
          P1: { ...EMPTY_INPUT },
          P2: { ...EMPTY_INPUT },
          P3: { ...EMPTY_INPUT },
          P4: { ...EMPTY_INPUT },
        };
        guestInputs[activeMySlot] = curInp;
        stepShabuGame(st, guestInputs, delta);

        const netSnap = netTargetStateRef.current;
        if (netSnap) {
          st.order = netSnap.order;
          st.hunger = netSnap.hunger;
          st.speedMult = netSnap.speedMult;
          st.score = netSnap.score;
          st.combo = netSnap.combo;
          st.maxCombo = netSnap.maxCombo;
          st.dishesServed = netSnap.dishesServed;
          if (st.phase === 'playing' && netSnap.phase === 'pot_flipped') {
            playShabuSound('flip', mutedRef.current);
            setShakeActive(true);
            setTimeout(() => setShakeActive(false), 650);
          }
          st.phase = netSnap.phase;
          st.potY = netSnap.potY;
          st.potRotX = netSnap.potRotX;
          st.potRotZ = netSnap.potRotZ;
          st.feedbackText = netSnap.feedbackText;

          for (const netP of netSnap.players) {
            const localP = st.players.find((lp) => lp.slotId === netP.slotId);
            if (!localP) continue;
            const isLocal = netP.slotId === activeMySlot;
            const blend = isLocal ? 0.25 : 0.36;
            localP.x += (netP.x - localP.x) * blend;
            localP.z += (netP.z - localP.z) * blend;
            localP.holding = netP.holding;
            if (!isLocal) {
              localP.rotY = netP.rotY;
              localP.vx = netP.vx;
              localP.vz = netP.vz;
            }
          }
        }
      }

      // Sync React HUD at ~12Hz (super light, zero frame drops!)
      if (nowMs - lastHudSync > 80) {
        lastHudSync = nowMs;
        setHudScore(st.score);
        setHudCombo(st.combo);
        setHudMaxCombo(st.maxCombo);
        setHudDishes(st.dishesServed);
        setHudHunger(Math.round(st.hunger));
        setHudSpeed(Number(st.speedMult.toFixed(1)));
        setHudOrder(st.order.map((o) => ({ ...o })));
        setHudFeedback(st.feedbackText);
        const meP = st.players.find((p) => p.slotId === activeMySlot);
        setHudHolding(meP?.holding ?? null);
      }

      if (st.phase === 'finished' && !finishHandled) {
        finishHandled = true;
        setIsFinished(true);
        setHudScore(st.score);
        setHudMaxCombo(st.maxCombo);
        setHudDishes(st.dishesServed);
        void claimShabuReward(st.score);
      }

      // Animate Pot & Steam
      potGroup.position.set(SHABU_POT_POS.x, st.potY, SHABU_POT_POS.z);
      potGroup.rotation.set(st.potRotX, 0, st.potRotZ);
      steamOrbs.forEach((orb, idx) => {
        orb.visible = st.phase === 'playing';
        orb.position.y = 0.35 + ((elapsed * 0.9 + idx * 0.37) % 1.25);
        const s = 0.65 + ((elapsed * 0.9 + idx * 0.37) % 1.25) * 0.5;
        orb.scale.setScalar(s);
      });

      // Animate Guard Boss (chill -> nervous -> angry pot flip!)
      const isAngry = st.hunger < 32 || st.phase !== 'playing';
      const shakeAmt = isAngry ? Math.sin(elapsed * 32) * 0.1 : 0;
      guardParts.rootGroup.position.set(SHABU_GUARD_POS.x + shakeAmt, 0, SHABU_GUARD_POS.z);
      guardParts.armL.rotation.z = st.phase !== 'playing' ? 2.6 : isAngry ? 1.6 + Math.sin(elapsed * 18) * 0.4 : Math.sin(elapsed * 4) * 0.25;
      guardParts.armR.rotation.z = st.phase !== 'playing' ? -2.6 : isAngry ? -1.6 - Math.sin(elapsed * 18) * 0.4 : -Math.sin(elapsed * 4) * 0.25;

      // Animate 3D Players
      for (const vis of visuals) {
        const p = st.players.find((pl) => pl.slotId === vis.slotId);
        if (!p) continue;
        vis.root.position.set(p.x, 0, p.z);
        vis.ring.position.set(p.x, 0.03, p.z);
        vis.root.rotation.y = p.rotY;

        (Object.keys(vis.holdSprites) as ShabuIngredient[]).forEach((k) => {
          vis.holdSprites[k].visible = p.holding === k;
        });

        vis.charParts.mixer?.update(delta);
        if (vis.charParts.auraSpinGroup) {
          vis.charParts.auraSpinGroup.rotation.y = elapsed * 1.8;
        }
        if (!vis.charParts.mixer) {
          const moving = Math.hypot(p.vx, p.vz) > 0.35;
          const runCycle = moving ? Math.sin(elapsed * 14) * 0.5 : 0;
          vis.charParts.legL.rotation.z = runCycle;
          vis.charParts.legR.rotation.z = -runCycle;
          vis.charParts.armL.rotation.z = p.holding ? 2.1 : -runCycle * 0.7;
          vis.charParts.armR.rotation.z = p.holding ? 2.1 : runCycle * 0.7;
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
  }, [isOpen, screen, qualityMode, players, sendRoomMessage, claimShabuReward]);

  if (!isOpen) return null;

  const joinedCount = Object.keys(members).length;
  const estGp = computeShabuGpReward(hudScore);
  const isDanger = hudHunger < 30;

  // Virtual 360° Joystick Handlers
  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerIdRef.current = e.pointerId;
    joyOriginRef.current = { x: e.clientX, y: e.clientY };
    setJoyKnob({ x: 0, y: 0 });
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - joyOriginRef.current.x;
    const dy = e.clientY - joyOriginRef.current.y;
    const maxR = 38;
    const dist = Math.hypot(dx, dy);
    const scale = dist > maxR ? maxR / dist : 1;
    const kx = dx * scale;
    const ky = dy * scale;
    setJoyKnob({ x: kx, y: ky });
    localInputRef.current.mx = dist > 8 ? kx / maxR : 0;
    localInputRef.current.mz = dist > 8 ? ky / maxR : 0;
  };

  const handleJoyEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    joyPointerIdRef.current = null;
    setJoyKnob({ x: 0, y: 0 });
    localInputRef.current.mx = 0;
    localInputRef.current.mz = 0;
  };

  return (
    <div className={`fixed inset-0 z-50 bg-slate-950/92 flex flex-col overflow-hidden ${shakeActive ? 'shake-active' : ''}`}>
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
                🍲
              </div>
              <div>
                <h2 className="font-[family-name:var(--font-kanit)] text-lg sm:text-2xl font-extrabold text-amber-300 leading-tight">
                  ตั้งวงชาบูบุฟเฟ่ต์ป้อนพี่ยาม!
                </h2>
                <p className="text-[11px] sm:text-xs text-amber-100/80 font-semibold">
                  Co-op 1–4 คน • ช่วยกันตักของลงหม้อก่อนพี่ยามโมโหคว่ำโต๊ะ • ทุก 100 แต้ม = +1 💰 GP
                </p>
              </div>
            </div>

            <div className="bg-amber-950/70 border-2 border-amber-400/70 rounded-xl p-3 text-center space-y-1">
              <div className="font-[family-name:var(--font-kanit)] text-base sm:text-lg font-extrabold text-amber-300">
                👥 สมาชิกตี้ชาบู ({joinedCount}/4 คน)
              </div>
              <div className="text-[11px] text-amber-100/90 font-semibold">
                {invitedTargetName
                  ? `ส่งแจ้งเตือนชวน ${invitedTargetName} และเพื่อนในสนามแล้ว! กดเริ่มได้เลยเมื่อพร้อม (1–4 คน)`
                  : 'เพื่อนที่ออนไลน์ในสนามเห็นป้ายแจ้งเตือนชวนเข้าตี้แล้ว กดเข้าร่วมได้สูงสุด 4 คน!'}
              </div>
            </div>

            {/* 4 Co-op Player Slots */}
            <div className="grid grid-cols-2 gap-2">
              {SLOT_ORDER.map((sid, idx) => {
                const m = members[sid];
                return (
                  <div
                    key={sid}
                    className={`rounded-xl p-3 border text-center ${
                      m
                        ? 'bg-amber-500/20 border-amber-300 text-amber-100'
                        : 'bg-slate-950/70 border-dashed border-slate-600 text-slate-400'
                    }`}
                  >
                    <div className="text-[10px] font-bold opacity-75 mb-0.5">
                      เชฟคนที่ {idx + 1} {sid === 'P1' ? '(หัวตี้)' : ''}
                    </div>
                    {m ? (
                      <div className="text-xs sm:text-sm font-extrabold truncate">
                        {m.emoji} {m.name} {sid === mySlot ? '(คุณ)' : ''}
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold animate-pulse">⏳ ว่าง (รอเพื่อนเข้า)</div>
                    )}
                  </div>
                );
              })}
            </div>

            {initialIsHost ? (
              <button
                type="button"
                onClick={() => {
                  const curMem = membersRef.current;
                  broadcastArenaLobby('started', curMem);
                  sendRoomMessage('start_shabu', { members: curMem });
                  setIsFinished(false);
                  setRewardStatus('');
                  rewardClaimedRef.current = false;
                  setScreen('playing');
                }}
                className="w-full rpg-btn-gold font-[family-name:var(--font-kanit)] py-3 rounded-xl text-sm sm:text-base font-extrabold cursor-pointer"
              >
                🍲 เปิดเตาเริ่มเลย! ({joinedCount} คน)
              </button>
            ) : (
              <div className="w-full py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-center text-xs font-extrabold text-amber-200">
                ⏳ รอหัวตี้กดเปิดเตาเริ่มเกม...
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 rounded-xl bg-slate-900 border border-slate-600 text-amber-100 text-xs font-extrabold cursor-pointer hover:bg-rose-900/60"
            >
              ยกเลิก / กลับไปเดินเล่น
            </button>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-dvh overflow-hidden select-none">
          <div ref={canvasWrapRef} className="fixed inset-0 w-full h-full touch-none" />

          {/* Red Pulsing Border when Guard is about to flip the pot! */}
          {isDanger && !isFinished && (
            <div className="fixed inset-0 pointer-events-none z-10 border-4 sm:border-8 border-rose-500/85 animate-pulse" />
          )}

          {/* Top RPG HUD */}
          <div className="fixed top-2 sm:top-3 inset-x-2 sm:inset-x-4 pt-safe z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <button
              type="button"
              onClick={onClose}
              className="pointer-events-auto rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-amber-100 hover:bg-rose-600 cursor-pointer"
            >
              ← ออก
            </button>

            {/* Score + Hunger Meter */}
            <div className="pointer-events-auto rpg-banner rounded-2xl px-3 sm:px-4 py-1.5 flex flex-wrap items-center justify-center gap-2 sm:gap-3 shadow-xl">
              <div className="flex items-center gap-1.5">
                <span className="font-[family-name:var(--font-kanit)] font-black text-sm sm:text-base text-amber-300">
                  🏆 {hudScore.toLocaleString()}
                </span>
                {hudCombo > 1 && (
                  <span className="bg-orange-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    🔥x{hudCombo}
                  </span>
                )}
                <span className="text-[10.5px] font-extrabold text-emerald-300">
                  ≈ +{estGp}💰
                </span>
              </div>

              <div className="flex items-center gap-1.5 min-w-[140px] sm:min-w-[190px]">
                <span className="text-xs font-extrabold">{isDanger ? '🤬' : '👮'}</span>
                <div className="flex-1 h-3.5 bg-slate-950 border border-amber-400 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-100 ${
                      hudHunger > 55
                        ? 'bg-emerald-400'
                        : hudHunger > 30
                        ? 'bg-amber-400'
                        : 'bg-rose-500 animate-pulse'
                    }`}
                    style={{ width: `${Math.max(0, Math.min(100, hudHunger))}%` }}
                  />
                </div>
                <span className="text-[10px] font-extrabold text-amber-200">x{hudSpeed}⚡</span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowTouchControls((v) => !v)}
                className={`rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${
                  showTouchControls ? 'text-amber-300 ring-1 ring-amber-300' : 'text-amber-100/75'
                }`}
                title="เปิด/ปิดจอยสติ๊กบนหน้าจอ"
              >
                🎮
              </button>
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                className="rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-amber-100 cursor-pointer"
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>

          {/* Guard's Current Order Ticket Card */}
          {!isFinished && (
            <div className="fixed top-16 sm:top-18 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1">
              <div className="bg-white/95 text-slate-900 border-3 border-amber-500 rounded-2xl px-3.5 py-1.5 shadow-xl flex items-center gap-2">
                <span className="text-xs font-black text-rose-700 whitespace-nowrap">
                  {isDanger ? '🤬 รีบใส่หม้อ!!' : '👮 พี่ยามสั่ง:'}
                </span>
                <div className="flex items-center gap-1.5">
                  {hudOrder.map((item, idx) => {
                    const meta = SHABU_STATION_MAP[item.ingredient];
                    return (
                      <div
                        key={idx}
                        className={`px-2 py-0.5 rounded-xl border-2 text-sm sm:text-base font-extrabold flex items-center gap-1 ${
                          item.delivered
                            ? 'bg-emerald-100 border-emerald-500 opacity-55 line-through'
                            : 'bg-amber-50 border-amber-400'
                        }`}
                      >
                        <span>{meta.emoji}</span>
                        {item.delivered && <span className="text-emerald-600 text-xs">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {hudFeedback && (
                <div className="bg-slate-950/90 border border-amber-400 text-amber-200 px-3 py-1 rounded-full text-xs font-extrabold shadow-lg">
                  {hudFeedback}
                </div>
              )}
            </div>
          )}

          {/* Desktop Controls Hint */}
          {!showTouchControls && !isFinished && (
            <div className="hidden lg:flex fixed bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="rpg-panel rounded-full px-4 py-1.5 text-xs font-bold text-amber-100 flex items-center gap-3">
                <span>WASD / ลูกศร เดิน</span>
                <span>•</span>
                <span>Space / E หยิบของ หรือ โยนลงหม้อ</span>
                <span>•</span>
                <span>Shift พุ่งไว ⚡</span>
                {hudHolding && (
                  <span className="text-amber-300">
                    • กำลังถือ: {SHABU_STATION_MAP[hudHolding].emoji} {SHABU_STATION_MAP[hudHolding].label}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Mobile & iPad Multi-Touch Controls (360° Joystick + Dash + Pick/Drop) */}
          {!isFinished && showTouchControls && (
            <div className="flex fixed bottom-4 inset-x-4 pb-safe z-30 items-end justify-between pointer-events-none">
              {/* Left Thumb: 360° Virtual Joystick */}
              <div
                onPointerDown={handleJoyDown}
                onPointerMove={handleJoyMove}
                onPointerUp={handleJoyEnd}
                onPointerCancel={handleJoyEnd}
                className="pointer-events-auto relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-900/65 border-2 border-amber-300/80 shadow-xl flex items-center justify-center touch-none select-none"
              >
                <div
                  style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-stone-950 font-black pointer-events-none"
                >
                  👆
                </div>
              </div>

              {/* Right Thumb: Dash + Pick/Drop */}
              <div className="flex items-end gap-3 pointer-events-auto">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    localInputRef.current.dash = true;
                  }}
                  onPointerUp={() => {
                    localInputRef.current.dash = false;
                  }}
                  onPointerCancel={() => {
                    localInputRef.current.dash = false;
                  }}
                  className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-b from-sky-500/95 to-blue-700/95 active:scale-95 border-2 border-sky-200 text-white flex flex-col items-center justify-center font-extrabold shadow-xl touch-none"
                >
                  <span className="text-xl leading-none">⚡</span>
                  <span className="text-[10px] mt-0.5">พุ่งไว</span>
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    localInputRef.current.interact = true;
                  }}
                  onPointerUp={() => {
                    localInputRef.current.interact = false;
                  }}
                  onPointerCancel={() => {
                    localInputRef.current.interact = false;
                  }}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-b from-orange-500/95 to-rose-600/95 active:scale-95 border-2 border-amber-200 text-white flex flex-col items-center justify-center font-extrabold shadow-xl touch-none"
                >
                  <span className="text-2xl leading-none">
                    {hudHolding ? SHABU_STATION_MAP[hudHolding].emoji : '🖐️'}
                  </span>
                  <span className="text-[10.5px] sm:text-xs mt-0.5">
                    {hudHolding ? 'ใส่หม้อ!' : 'หยิบของ'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Game Over (Pot Flipped!) Summary Overlay */}
          {isFinished && (
            <div className="fixed inset-0 z-30 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="rpg-stone-frame rounded-3xl max-w-md w-full p-5 text-center space-y-3.5">
                <div className="text-4xl">🤬🍲💥</div>
                <h3 className="font-[family-name:var(--font-kanit)] text-2xl font-extrabold text-rose-400">
                  พี่ยามโมโหคว่ำหม้อชาบูแล้ว!!
                </h3>
                <div className="grid grid-cols-3 gap-2 bg-slate-900/85 border border-amber-500/40 rounded-2xl p-3">
                  <div>
                    <div className="text-[10px] text-amber-200/75 font-bold">คะแนนรวม</div>
                    <div className="font-[family-name:var(--font-kanit)] text-xl font-black text-amber-300">
                      {hudScore.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-200/75 font-bold">เสิร์ฟไป</div>
                    <div className="font-[family-name:var(--font-kanit)] text-xl font-black text-emerald-300">
                      {hudDishes} รอบ
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-amber-200/75 font-bold">คอมโบสูงสุด</div>
                    <div className="font-[family-name:var(--font-kanit)] text-xl font-black text-orange-400">
                      x{hudMaxCombo}
                    </div>
                  </div>
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
                      const curMem = membersRef.current;
                      sendRoomMessage('start_shabu', { members: curMem });
                      setIsFinished(false);
                      setRewardStatus('');
                      rewardClaimedRef.current = false;
                      // Toggle screen briefly to remount cleanly
                      setScreen('waiting');
                      setTimeout(() => setScreen('playing'), 30);
                    }}
                    className="w-full rpg-btn-gold py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
                  >
                    🔄 ตั้งวงชาบูใหม่อีกรอบ!
                  </button>
                ) : (
                  <div className="text-xs font-bold text-amber-200/80">
                    รอหัวตี้กดเริ่มรอบใหม่ หรือกดกลับสนามหลักด้านล่าง
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
