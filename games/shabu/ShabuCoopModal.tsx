'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildCharacterMesh,
  buildCustomGuardCharacter,
  type CharacterMeshParts,
} from '@/lib/character_3d';
import type { VolleyballPlayerSummary } from '@/games/volleyball/VolleyballModal';
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
  stepLocalShabuPlayer,
  computeShabuGpReward,
  playShabuSound,
  type ShabuSlotId,
  type ShabuIngredient,
  type ShabuInputState,
  type ShabuGameState,
  type ShabuOrderItem,
} from './engine';
import {
  GUEST_HELD_KEEPALIVE_MS,
  GUEST_IDLE_ECHO_DELAY_MS,
  GuestInputWatchdog,
  HOST_YIELD_DELAY_MS,
  createBackgroundHostTicker,
} from '@/games/shared/realtimeSync';

export interface ShabuLobbyBroadcastInfo {
  roomCode: string;
  hostUserId: number;
  hostName: string;
  hostEmoji: string;
  targetName?: string;
  count: number;
  max: number;
  status: 'waiting' | 'started' | 'closed';
  roster?: Array<{
    slotId: string;
    clientId?: string;
    playerId: number;
    name: string;
    emoji: string;
    team?: 'coop';
  }>;
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
  onParticipationChange?: (participating: boolean, clientId: string) => void;
  onLobbyBroadcast?: (info: ShabuLobbyBroadcastInfo) => void;
  onRewardEarned?: (earned: number, newPoints: number) => void;
}

interface ShabuPresenceMember {
  clientId: string;
  playerId: number;
  name: string;
  emoji: string;
  joinedAt: number;
  isHidden?: boolean;
}

interface CompactShabuSnap {
  seq: number;
  hid?: string;
  s: ShabuGameState;
}

const EMPTY_INPUT: ShabuInputState = { mx: 0, mz: 0, interact: false, dash: false };
const SLOT_ORDER: ShabuSlotId[] = ['P1', 'P2', 'P3', 'P4'];
const SHABU_BROADCAST_MS = 50; // 20 Hz Host-Authoritative broadcast!
const r2 = (n: number) => Math.round(n * 100) / 100;

function resolveShabuLobby(list: ShabuPresenceMember[]): {
  hostClientId: string | null;
  slots: Partial<Record<ShabuSlotId, ShabuPresenceMember>>;
  sorted: ShabuPresenceMember[];
} {
  const byHostOrder = [...list].sort((a, b) => {
    if (Boolean(a.isHidden) !== Boolean(b.isHidden)) return a.isHidden ? 1 : -1;
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.clientId.localeCompare(b.clientId);
  });
  const sorted = [...list].sort((a, b) => {
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.clientId.localeCompare(b.clientId);
  });
  const slots: Partial<Record<ShabuSlotId, ShabuPresenceMember>> = {};
  sorted.slice(0, 4).forEach((m, idx) => {
    slots[SLOT_ORDER[idx]] = m;
  });
  return {
    hostClientId: byHostOrder[0]?.clientId ?? null,
    slots,
    sorted,
  };
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
  invitedTargetName,
  onParticipationChange,
  onLobbyBroadcast,
  onRewardEarned,
}: ShabuCoopModalProps) {
  const [screen, setScreen] = useState<'waiting' | 'playing'>('waiting');
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode || '5555');
  const [shabuRunId, setShabuRunId] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string>('');
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
  const [presenceList, setPresenceList] = useState<ShabuPresenceMember[]>([]);
  const [activeMatchMembers, setActiveMatchMembers] = useState<
    Partial<Record<ShabuSlotId, ShabuPresenceMember>>
  >({});
  const [myPlayingSlot, setMyPlayingSlot] = useState<ShabuSlotId>('P1');
  const [amIMatchHost, setAmIMatchHost] = useState<boolean>(true);

  // Live HUD state
  const [hudScore, setHudScore] = useState<number>(0);
  const [hudCombo, setHudCombo] = useState<number>(0);
  const [hudMaxCombo, setHudMaxCombo] = useState<number>(0);
  const [hudDishes, setHudDishes] = useState<number>(0);
  const [isHungerDanger, setIsHungerDanger] = useState<boolean>(false);
  const [hudSpeed, setHudSpeed] = useState<number>(1.0);
  const [hudOrder, setHudOrder] = useState<ShabuOrderItem[]>([]);
  const [hudFeedback, setHudFeedback] = useState<string>('');
  const [hudHolding, setHudHolding] = useState<ShabuIngredient | null>(null);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  const [shakeActive, setShakeActive] = useState<boolean>(false);
  const [rewardStatus, setRewardStatus] = useState<string>('');

  // Zero-rerender DOM refs for 60 FPS Hunger Bar & Virtual Joystick
  const hungerBarDomRef = useRef<HTMLDivElement | null>(null);
  const hudOrderSigRef = useRef<string>('');
  const joyKnobDomRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);
  const joyOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const shabuWatchdogRef = useRef<GuestInputWatchdog<ShabuSlotId, ShabuInputState>>(
    new GuestInputWatchdog()
  );
  const shabuIdleEchoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shabuKeepaliveIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const localInputRef = useRef<ShabuInputState>({ ...EMPTY_INPUT });
  const lastSentSigRef = useRef<string>('0,0,0,0');
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

  // 20Hz Snapshot Lerp Buffer for Guest
  const prevSnapRef = useRef<ShabuGameState | null>(null);
  const currSnapRef = useRef<ShabuGameState | null>(null);
  const currSnapRecvMsRef = useRef<number>(0);
  const lastRecvSeqRef = useRef<number>(0);
  const lastRecvHostIdRef = useRef<string | null>(null);

  const gameStateRef = useRef<ShabuGameState | null>(null);
  const activeRunUidRef = useRef<string>('');
  const rewardClaimedRef = useRef<boolean>(false);
  const isFinishedRef = useRef<boolean>(false);
  isFinishedRef.current = isFinished;

  const mutedRef = useRef<boolean>(false);
  mutedRef.current = muted;
  const playersRef = useRef(players);
  playersRef.current = players;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const amIMatchHostRef = useRef(amIMatchHost);
  amIMatchHostRef.current = amIMatchHost;
  const myPlayingSlotRef = useRef(myPlayingSlot);
  myPlayingSlotRef.current = myPlayingSlot;
  const activeMatchMembersRef = useRef(activeMatchMembers);
  activeMatchMembersRef.current = activeMatchMembers;
  const presenceListRef = useRef(presenceList);
  presenceListRef.current = presenceList;
  const onParticipationChangeRef = useRef(onParticipationChange);
  onParticipationChangeRef.current = onParticipationChange;
  const onLobbyBroadcastRef = useRef(onLobbyBroadcast);
  onLobbyBroadcastRef.current = onLobbyBroadcast;
  const onRewardEarnedRef = useRef(onRewardEarned);
  onRewardEarnedRef.current = onRewardEarned;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const currentHostIdRef = useRef<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((c) => (c === msg ? '' : c)), 4000);
  }, []);

  const effectivePresenceList = useMemo<ShabuPresenceMember[]>(() => {
    if (presenceList.some((m) => m.clientId === myClientIdRef.current)) {
      return presenceList;
    }
    const me =
      currentUserId != null
        ? players.find((p) => p.id === currentUserId)
        : undefined;
    return [
      {
        clientId: myClientIdRef.current,
        playerId: me?.id ?? 0,
        name: me?.name ?? `เชฟ #${myClientIdRef.current.slice(-3)}`,
        emoji: me?.emoji ?? '🍲',
        joinedAt: 0,
      },
      ...presenceList,
    ];
  }, [presenceList, currentUserId, players]);

  const lobbyResolved = useMemo(
    () => resolveShabuLobby(effectivePresenceList),
    [effectivePresenceList]
  );
  currentHostIdRef.current = lobbyResolved.hostClientId;
  const amILobbyHost = lobbyResolved.hostClientId === myClientIdRef.current;

  const myLobbySlot = useMemo<ShabuSlotId>(() => {
    for (const [sid, m] of Object.entries(lobbyResolved.slots)) {
      if (m?.clientId === myClientIdRef.current) return sid as ShabuSlotId;
    }
    return 'P1';
  }, [lobbyResolved.slots]);

  const sendRoomMessage = useCallback((event: string, payload: unknown) => {
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event, payload });
    }
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({ event, payload });
      } catch {
        // ignore
      }
    }
  }, []);
  const sendRoomMessageRef = useRef(sendRoomMessage);
  sendRoomMessageRef.current = sendRoomMessage;

  // Event-Driven Guest Input: Only sends when quantized direction or button state actually changes,
  // plus 150ms Idle Echo Pulse on full release & 1.2s Keepalive while held!
  const notifyLocalInputChanged = useCallback(() => {
    if (amIMatchHostRef.current || screenRef.current !== 'playing') return;
    const inp = localInputRef.current;
    // Quantize analog joystick to 0.25 steps so thumb micro-jitter never floods WebSocket!
    const qx = Math.round(inp.mx * 4) / 4;
    const qz = Math.round(inp.mz * 4) / 4;
    const sig = `${qx},${qz},${inp.interact ? 1 : 0},${inp.dash ? 1 : 0}`;
    if (sig === lastSentSigRef.current) return;
    lastSentSigRef.current = sig;

    const sendQuantized = (mxVal: number, mzVal: number, act: boolean, dsh: boolean) => {
      sendRoomMessageRef.current('shabu_input', {
        clientId: myClientIdRef.current,
        slot: myPlayingSlotRef.current,
        input: { mx: mxVal, mz: mzVal, interact: act, dash: dsh },
      });
    };

    sendQuantized(qx, qz, inp.interact, inp.dash);

    const isNeutral = qx === 0 && qz === 0 && !inp.interact && !inp.dash;
    if (shabuIdleEchoRef.current) {
      clearTimeout(shabuIdleEchoRef.current);
      shabuIdleEchoRef.current = null;
    }
    if (isNeutral) {
      if (shabuKeepaliveIvRef.current) {
        clearInterval(shabuKeepaliveIvRef.current);
        shabuKeepaliveIvRef.current = null;
      }
      shabuIdleEchoRef.current = setTimeout(() => {
        shabuIdleEchoRef.current = null;
        if (amIMatchHostRef.current || screenRef.current !== 'playing') return;
        const cur = localInputRef.current;
        const cqx = Math.round(cur.mx * 4) / 4;
        const cqz = Math.round(cur.mz * 4) / 4;
        if (cqx === 0 && cqz === 0 && !cur.interact && !cur.dash) {
          sendQuantized(0, 0, false, false);
        }
      }, GUEST_IDLE_ECHO_DELAY_MS);
    } else if (!shabuKeepaliveIvRef.current) {
      shabuKeepaliveIvRef.current = setInterval(() => {
        if (amIMatchHostRef.current || screenRef.current !== 'playing') return;
        const cur = localInputRef.current;
        const cqx = Math.round(cur.mx * 4) / 4;
        const cqz = Math.round(cur.mz * 4) / 4;
        if (cqx !== 0 || cqz !== 0 || cur.interact || cur.dash) {
          sendQuantized(cqx, cqz, cur.interact, cur.dash);
        }
      }, GUEST_HELD_KEEPALIVE_MS);
    }
  }, []);

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
          onRewardEarnedRef.current?.(data.earned, data.points);
        } else if (res.ok && data.capReached) {
          setRewardStatus(`รับโบนัสชาบูครบ ${data.dailyCap}/${data.dailyCap} GP ของวันนี้แล้ว (ยังเล่นทำสถิติต่อได้!)`);
        } else {
          setRewardStatus('ทำคะแนนอย่างน้อย 100 แต้มเพื่อรับ +1 💰 GP นะ!');
        }
      } catch {
        // ignore
      }
    },
    [currentUserId]
  );
  const claimShabuRewardRef = useRef(claimShabuReward);
  claimShabuRewardRef.current = claimShabuReward;

  const startShabuFromPayload = useCallback(
    (pkt: {
      runUid: string;
      hostClientId: string;
      members: Partial<Record<ShabuSlotId, ShabuPresenceMember>>;
    }) => {
      if (pkt.runUid && pkt.runUid === activeRunUidRef.current && screenRef.current === 'playing') {
        return;
      }
      if (screenRef.current === 'playing' && !isFinishedRef.current) {
        return;
      }

      let foundSlot: ShabuSlotId = 'P1';
      for (const sid of SLOT_ORDER) {
        if (pkt.members[sid]?.clientId === myClientIdRef.current) {
          foundSlot = sid;
        }
      }

      const iAmHost = pkt.hostClientId === myClientIdRef.current;
      activeRunUidRef.current = pkt.runUid;
      setActiveMatchMembers(pkt.members);
      activeMatchMembersRef.current = pkt.members;
      setMyPlayingSlot(foundSlot);
      myPlayingSlotRef.current = foundSlot;
      setAmIMatchHost(iAmHost);
      amIMatchHostRef.current = iAmHost;

      prevSnapRef.current = null;
      currSnapRef.current = null;
      lastRecvSeqRef.current = 0;
      lastRecvHostIdRef.current = pkt.hostClientId || null;
      lastSentSigRef.current = '0,0,0,0';
      localInputRef.current = { ...EMPTY_INPUT };
      remoteInputsRef.current = {
        P1: { ...EMPTY_INPUT },
        P2: { ...EMPTY_INPUT },
        P3: { ...EMPTY_INPUT },
        P4: { ...EMPTY_INPUT },
      };

      rewardClaimedRef.current = false;
      setRewardStatus('');
      setIsFinished(false);
      isFinishedRef.current = false;
      setShabuRunId((n) => n + 1);
      screenRef.current = 'playing';
      setScreen('playing');
    },
    []
  );

  // Sync invited pot roomCode (#5555 / #5556) & report active participation to ModalHost
  useEffect(() => {
    if (isOpen && initialRoomCode && screen === 'waiting' && initialRoomCode !== roomCode) {
      setRoomCode(initialRoomCode);
    }
  }, [isOpen, initialRoomCode, screen, roomCode]);

  useEffect(() => {
    if (!isOpen) return;
    const seatedWaiting =
      screen === 'waiting' &&
      SLOT_ORDER.some((sid) => lobbyResolved.slots[sid]?.clientId === myClientIdRef.current);
    const seatedPlaying =
      screen === 'playing' &&
      SLOT_ORDER.some((sid) => activeMatchMembers[sid]?.clientId === myClientIdRef.current);
    onParticipationChangeRef.current?.(seatedWaiting || seatedPlaying, myClientIdRef.current);
  }, [isOpen, screen, lobbyResolved.slots, activeMatchMembers]);

  // Broadcast open lobby banner to the 3D Island while waiting as Host
  useEffect(() => {
    if (!isOpen || screen !== 'waiting' || !amILobbyHost) return;
    const me = playersRef.current.find((p) => p.id === currentUserId) || playersRef.current[0];
    const roster = SLOT_ORDER.flatMap((sid) => {
      const m = lobbyResolved.slots[sid];
      if (!m) return [];
      return [
        {
          slotId: sid,
          clientId: m.clientId,
          playerId: m.playerId,
          name: m.name,
          emoji: m.emoji,
          team: 'coop' as const,
        },
      ];
    });
    onLobbyBroadcastRef.current?.({
      roomCode,
      hostUserId: me?.id ?? (currentUserId || 0),
      hostName: me?.name || 'เพื่อนในสนาม',
      hostEmoji: me?.emoji || '🍲',
      targetName: invitedTargetName,
      count: lobbyResolved.sorted.length,
      max: 4,
      status: 'waiting',
      roster,
    });
  }, [isOpen, screen, amILobbyHost, roomCode, lobbyResolved.slots, lobbyResolved.sorted.length, currentUserId, invitedTargetName]);

  // Periodic heartbeat while match is running so single-table lock & 3D character showcase stay fresh
  useEffect(() => {
    if (!isOpen || screen !== 'playing' || !amIMatchHost) return;
    const emitActive = () => {
      const me = playersRef.current.find((p) => p.id === currentUserId) || playersRef.current[0];
      const mems = activeMatchMembersRef.current;
      const roster = SLOT_ORDER.flatMap((sid) => {
        const m = mems[sid];
        if (!m) return [];
        return [
          {
            slotId: sid,
            clientId: m.clientId,
            playerId: m.playerId,
            name: m.name,
            emoji: m.emoji,
            team: 'coop' as const,
          },
        ];
      });
      onLobbyBroadcastRef.current?.({
        roomCode,
        hostUserId: me?.id ?? (currentUserId || 0),
        hostName: me?.name || 'เพื่อน',
        hostEmoji: me?.emoji || '🍲',
        count: Math.max(1, roster.length),
        max: 4,
        status: 'started',
        roster,
      });
    };
    const iv = setInterval(emitActive, 4500);
    return () => clearInterval(iv);
  }, [isOpen, screen, amIMatchHost, roomCode, currentUserId]);

  // Connect to Supabase Realtime Presence + Broadcast (isolated client per room session)
  useEffect(() => {
    if (!isOpen || !roomCode) return;

    const me =
      currentUserId != null
        ? playersRef.current.find((p) => p.id === currentUserId)
        : undefined;
    const now = Date.now();
    const myInfo: ShabuPresenceMember = {
      clientId: myClientIdRef.current,
      playerId: me?.id ?? 0,
      name: me?.name ?? `เชฟ #${myClientIdRef.current.slice(-3)}`,
      emoji: me?.emoji ?? '🍲',
      joinedAt: now,
    };
    setPresenceList([myInfo]);

    let destroyed = false;
    let isSub = false;
    const bcastPeers = new Map<string, ShabuPresenceMember>();
    const localPeers = new Map<string, { member: ShabuPresenceMember; seenAt: number }>();
    localPeers.set(myInfo.clientId, { member: myInfo, seenAt: now });

    const clearDisconnectedChef = (leftClientId: string) => {
      for (const [sid, m] of Object.entries(activeMatchMembersRef.current)) {
        if (m?.clientId === leftClientId) {
          const slotKey = sid as ShabuSlotId;
          remoteInputsRef.current[slotKey] = { ...EMPTY_INPUT };
          if (gameStateRef.current) {
            const chef = gameStateRef.current.players.find((pl) => pl.slotId === slotKey);
            if (chef) {
              chef.holding = null;
              chef.vx = 0;
              chef.vz = 0;
              chef.x = -5.2;
              chef.z = -3.1;
            }
          }
        }
      }
    };

    const reconcileMemberList = (list: ShabuPresenceMember[]) => {
      const prevHost = currentHostIdRef.current;
      const resolved = resolveShabuLobby(list);
      setPresenceList(list);

      // Automatic Host Migration if P1 drops OR yields (hidden mobile tab) mid-cooking!
      const prevHostObj = list.find((m) => m.clientId === prevHost);
      if (
        prevHost &&
        resolved.hostClientId &&
        prevHost !== resolved.hostClientId &&
        (!prevHostObj || Boolean(prevHostObj.isHidden))
      ) {
        const newHost = list.find((m) => m.clientId === resolved.hostClientId);
        const iAmNewHost = resolved.hostClientId === myClientIdRef.current;
        lastRecvSeqRef.current = 0;
        lastRecvHostIdRef.current = resolved.hostClientId;
        shabuWatchdogRef.current.clear();
        if (screenRef.current === 'playing') {
          setAmIMatchHost(iAmNewHost);
          amIMatchHostRef.current = iAmNewHost;
        }
        if (newHost) {
          showToast(`👑 โอนสิทธิ์หัวตี้ชาบูให้ ${newHost.name} ดูแลเตาต่ออัตโนมัติ!`);
        }
      }
    };

    const handleEvent = (event: string, payload: Record<string, unknown>) => {
      if (destroyed || !payload) return;
      if (event === 'start_shabu') {
        startShabuFromPayload(
          payload as unknown as {
            runUid: string;
            hostClientId: string;
            members: Partial<Record<ShabuSlotId, ShabuPresenceMember>>;
          }
        );
      } else if (event === 'back_to_waiting') {
        activeRunUidRef.current = '';
        isFinishedRef.current = false;
        setIsFinished(false);
        setRewardStatus('');
        screenRef.current = 'waiting';
        setScreen('waiting');
      } else if (event === 'shabu_input' && amIMatchHostRef.current) {
        const slot = payload.slot as ShabuSlotId;
        const inp = payload.input as ShabuInputState;
        const expectedCid = activeMatchMembersRef.current[slot]?.clientId;
        if (slot && inp && (!expectedCid || expectedCid === payload.clientId)) {
          remoteInputsRef.current[slot] = inp;
          shabuWatchdogRef.current.record(slot, inp, performance.now());
        }
      } else if (event === 'shabu_state' && !amIMatchHostRef.current) {
        const pkt = payload as unknown as CompactShabuSnap;
        if (!pkt?.s) return;
        const hostChanged = Boolean(
          pkt.hid && lastRecvHostIdRef.current && pkt.hid !== lastRecvHostIdRef.current
        );
        const seqRestarted =
          !pkt.hid && typeof pkt.seq === 'number' && pkt.seq <= 5 && lastRecvSeqRef.current > 15;
        if (hostChanged || seqRestarted) {
          lastRecvSeqRef.current = 0;
        }
        if (typeof pkt.seq === 'number' && pkt.seq <= lastRecvSeqRef.current) return;
        if (typeof pkt.seq === 'number') lastRecvSeqRef.current = pkt.seq;
        if (pkt.hid) lastRecvHostIdRef.current = pkt.hid;

        prevSnapRef.current = currSnapRef.current || pkt.s;
        currSnapRef.current = pkt.s;
        currSnapRecvMsRef.current = performance.now();
      }
    };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let localHb: ReturnType<typeof setInterval> | null = null;

    if (url && key) {
      const sb = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 40 } },
      });
      const ch = sb.channel(`waist-shabu-presence-${roomCode}`, {
        config: {
          presence: { key: myInfo.clientId },
          broadcast: { self: false, ack: false },
        },
      });

      const reconcile = () => {
        if (destroyed) return;
        const raw = ch.presenceState<ShabuPresenceMember>();
        const merged = new Map<string, ShabuPresenceMember>();
        for (const [cid, bp] of bcastPeers.entries()) {
          merged.set(cid, bp);
        }
        for (const arr of Object.values(raw)) {
          if (Array.isArray(arr) && arr.length > 0) {
            const latest = arr[arr.length - 1];
            if (latest?.clientId) {
              const cached = bcastPeers.get(latest.clientId);
              const mergedPeer: ShabuPresenceMember = cached
                ? { ...latest, isHidden: cached.isHidden }
                : latest;
              merged.set(latest.clientId, mergedPeer);
              bcastPeers.set(latest.clientId, mergedPeer);
            }
          }
        }
        merged.set(myInfo.clientId, myInfo);
        reconcileMemberList(Array.from(merged.values()));
      };

      ch.on('presence', { event: 'sync' }, reconcile)
        .on('presence', { event: 'join' }, reconcile)
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          if (destroyed) return;
          const leftArr = (leftPresences || []) as unknown as ShabuPresenceMember[];
          for (const lp of leftArr) {
            if (lp?.clientId) bcastPeers.delete(lp.clientId);
          }
          reconcile();
          for (const left of leftArr) {
            if (!left?.clientId || left.clientId === myClientIdRef.current) continue;
            showToast(`⚠️ ${left.emoji} ${left.name} ออกจากวงชาบู`);
            clearDisconnectedChef(left.clientId);
          }
        })
        .on('broadcast', { event: 'peer_hello' }, ({ payload }) => {
          if (destroyed || !payload) return;
          const p = payload as { member?: ShabuPresenceMember; requestReply?: boolean };
          if (p.member?.clientId && p.member.clientId !== myClientIdRef.current) {
            bcastPeers.set(p.member.clientId, p.member);
            reconcile();
            if (p.requestReply) {
              ch.send({
                type: 'broadcast',
                event: 'peer_hello',
                payload: { member: myInfo, requestReply: false },
              });
            }
          }
        })
        .on('broadcast', { event: 'peer_bye' }, ({ payload }) => {
          if (destroyed || !payload) return;
          const cid = String((payload as { clientId?: string }).clientId || '');
          if (cid && cid !== myClientIdRef.current) {
            const gone = bcastPeers.get(cid);
            bcastPeers.delete(cid);
            reconcile();
            if (gone) showToast(`⚠️ ${gone.emoji} ${gone.name} ออกจากวงชาบู`);
            clearDisconnectedChef(cid);
          }
        })
        .on('broadcast', { event: 'host_yield' }, ({ payload }) => {
          if (destroyed || !payload) return;
          const cid = String((payload as { clientId?: string }).clientId || '');
          const hidden = Boolean((payload as { isHidden?: boolean }).isHidden);
          if (cid && cid !== myClientIdRef.current) {
            const target = bcastPeers.get(cid);
            if (target) {
              bcastPeers.set(cid, { ...target, isHidden: hidden });
              reconcile();
            }
          }
        })
        .on('broadcast', { event: 'start_shabu' }, ({ payload }) => handleEvent('start_shabu', payload))
        .on('broadcast', { event: 'back_to_waiting' }, ({ payload }) => handleEvent('back_to_waiting', payload || {}))
        .on('broadcast', { event: 'shabu_input' }, ({ payload }) => handleEvent('shabu_input', payload))
        .on('broadcast', { event: 'shabu_state' }, ({ payload }) => handleEvent('shabu_state', payload))
        .subscribe(async (status) => {
          if (!destroyed && status === 'SUBSCRIBED') {
            isSub = true;
            ch.send({
              type: 'broadcast',
              event: 'peer_hello',
              payload: { member: myInfo, requestReply: true },
            });
            const res = await ch.track(myInfo);
            if (res !== 'ok' && !destroyed) {
              setTimeout(() => {
                if (!destroyed && isSub) void ch.track(myInfo);
              }, 750);
            }
          }
        });

      supabaseRef.current = sb;
      channelRef.current = ch;
    } else if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(`waist-shabu-local-${roomCode}`);
      bc.onmessage = (ev) => {
        if (destroyed || !ev.data) return;
        const { event, payload } = ev.data;
        if (event === 'presence_ping' && payload?.clientId && payload.clientId !== myClientIdRef.current) {
          localPeers.set(payload.clientId, { member: payload as ShabuPresenceMember, seenAt: Date.now() });
          reconcileMemberList(Array.from(localPeers.values()).map((v) => v.member));
        } else if (event === 'presence_leave' && payload?.clientId) {
          const gone = localPeers.get(payload.clientId)?.member;
          localPeers.delete(payload.clientId);
          reconcileMemberList(Array.from(localPeers.values()).map((v) => v.member));
          if (gone) {
            showToast(`⚠️ ${gone.emoji} ${gone.name} ออกจากวงชาบู`);
            clearDisconnectedChef(gone.clientId);
          }
        } else if (event === 'host_yield' && payload?.clientId && payload.clientId !== myClientIdRef.current) {
          const cur = localPeers.get(payload.clientId);
          if (cur) {
            localPeers.set(payload.clientId, {
              ...cur,
              member: { ...cur.member, isHidden: Boolean(payload.isHidden) },
            });
            reconcileMemberList(Array.from(localPeers.values()).map((v) => v.member));
          }
        } else {
          handleEvent(event, payload);
        }
      };
      bcRef.current = bc;
      bc.postMessage({ event: 'presence_ping', payload: myInfo });
      localHb = setInterval(() => {
        if (destroyed) return;
        const t = Date.now();
        localPeers.set(myInfo.clientId, { member: myInfo, seenAt: t });
        bc.postMessage({ event: 'presence_ping', payload: myInfo });
        let peerExpired = false;
        for (const [cid, entry] of localPeers.entries()) {
          if (cid !== myInfo.clientId && t - entry.seenAt > 3500) {
            localPeers.delete(cid);
            peerExpired = true;
            showToast(`⚠️ ${entry.member.name} หลุดออกจากวงชาบู`);
            clearDisconnectedChef(cid);
          }
        }
        if (peerExpired) {
          reconcileMemberList(Array.from(localPeers.values()).map((v) => v.member));
        }
      }, 1100);
    }

    let hideYieldTimer: ReturnType<typeof setTimeout> | null = null;
    const setLocalShabuHidden = (hidden: boolean) => {
      if (destroyed) return;
      myInfo.isHidden = hidden;
      reconcileMemberList(
        presenceListRef.current.map((m) =>
          m.clientId === myInfo.clientId ? { ...m, isHidden: hidden } : m
        )
      );
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'host_yield',
          payload: { clientId: myInfo.clientId, isHidden: hidden },
        });
      }
      if (bcRef.current) {
        bcRef.current.postMessage({
          event: 'host_yield',
          payload: { clientId: myInfo.clientId, isHidden: hidden },
        });
      }
    };

    const onRoomVis = () => {
      if (destroyed || typeof document === 'undefined') return;
      if (document.hidden) {
        if (!hideYieldTimer) {
          hideYieldTimer = setTimeout(() => {
            hideYieldTimer = null;
            if (!destroyed && document.hidden && presenceListRef.current.length > 1) {
              setLocalShabuHidden(true);
            }
          }, HOST_YIELD_DELAY_MS);
        }
      } else {
        if (hideYieldTimer) {
          clearTimeout(hideYieldTimer);
          hideYieldTimer = null;
        }
        if (myInfo.isHidden) {
          setLocalShabuHidden(false);
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onRoomVis);
    }

    return () => {
      destroyed = true;
      if (hideYieldTimer) clearTimeout(hideYieldTimer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onRoomVis);
      }
      if (localHb) clearInterval(localHb);
      const hasOtherPeers = presenceListRef.current.some(
        (m) => m.clientId !== myClientIdRef.current
      );
      if (currentHostIdRef.current === myClientIdRef.current && !hasOtherPeers) {
        onLobbyBroadcastRef.current?.({
          roomCode,
          hostUserId: currentUserId || 0,
          hostName: me?.name || 'เพื่อน',
          hostEmoji: me?.emoji || '🍲',
          count: 0,
          max: 4,
          status: 'closed',
        });
      }
      if (bcRef.current) {
        try {
          bcRef.current.postMessage({ event: 'presence_leave', payload: { clientId: myClientIdRef.current } });
          bcRef.current.close();
        } catch {
          // ignore
        }
        bcRef.current = null;
      }
      const sb = supabaseRef.current;
      const ch = channelRef.current;
      supabaseRef.current = null;
      channelRef.current = null;
      if (ch && sb) {
        if (isSub) {
          ch.send({
            type: 'broadcast',
            event: 'peer_bye',
            payload: { clientId: myClientIdRef.current },
          });
        }
        void ch
          .untrack()
          .catch(() => { })
          .finally(() => {
            void sb.removeChannel(ch).finally(() => {
              sb.realtime.disconnect();
            });
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, roomCode]);

  // Event-Driven Keyboard bindings while playing
  useEffect(() => {
    if (!isOpen || screen !== 'playing') return;
    const syncAxis = () => {
      const k = keyStateRef.current;
      localInputRef.current.mx = (k.right ? 1 : 0) - (k.left ? 1 : 0);
      localInputRef.current.mz = (k.down ? 1 : 0) - (k.up ? 1 : 0);
      notifyLocalInputChanged();
    };
    const onKey = (e: KeyboardEvent, down: boolean) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
      if (down && e.repeat) return;
      const c = e.code;
      if (c === 'KeyA' || c === 'ArrowLeft') {
        keyStateRef.current.left = down;
        syncAxis();
      } else if (c === 'KeyD' || codeIsRight(c)) {
        keyStateRef.current.right = down;
        syncAxis();
      } else if (c === 'KeyW' || c === 'ArrowUp') {
        keyStateRef.current.up = down;
        syncAxis();
      } else if (c === 'KeyS' || c === 'ArrowDown') {
        keyStateRef.current.down = down;
        syncAxis();
      } else if (c === 'Space' || c === 'KeyE' || c === 'Enter') {
        localInputRef.current.interact = down;
        notifyLocalInputChanged();
      } else if (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'KeyJ') {
        localInputRef.current.dash = down;
        notifyLocalInputChanged();
      }
    };
    function codeIsRight(c: string) {
      return c === 'ArrowRight';
    }
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    const onBlur = () => {
      keyStateRef.current = { up: false, down: false, left: false, right: false };
      localInputRef.current = { ...EMPTY_INPUT };
      notifyLocalInputChanged();
    };
    const onVis = () => {
      if (document.hidden) onBlur();
    };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      if (shabuIdleEchoRef.current) {
        clearTimeout(shabuIdleEchoRef.current);
        shabuIdleEchoRef.current = null;
      }
      if (shabuKeepaliveIvRef.current) {
        clearInterval(shabuKeepaliveIvRef.current);
        shabuKeepaliveIvRef.current = null;
      }
      localInputRef.current = { ...EMPTY_INPUT };
    };
  }, [isOpen, screen, notifyLocalInputChanged]);

  // Main 3D Top-Down Shabu Buffet Scene & 60 FPS Game Loop (immune to Arena3DPage background re-renders!)
  useEffect(() => {
    if (!isOpen || screen !== 'playing' || !canvasWrapRef.current) return;
    const container = canvasWrapRef.current;
    container.innerHTML = '';

    const memSnap = activeMatchMembersRef.current;
    const activeSlots = SLOT_ORDER.filter((s) => Boolean(memSnap[s]));
    const slotsToUse: ShabuSlotId[] = activeSlots.length > 0 ? activeSlots : ['P1'];
    const game = createInitialShabuState(slotsToUse);
    gameStateRef.current = game;

    hudOrderSigRef.current = game.order
      .map((o) => `${o.ingredient}:${o.delivered ? 1 : 0}`)
      .join(',');
    setHudOrder([...game.order]);
    setHudScore(0);
    setHudCombo(0);
    setHudMaxCombo(0);
    setHudDishes(0);
    setIsHungerDanger(false);
    if (hungerBarDomRef.current) {
      hungerBarDomRef.current.style.width = '100%';
      hungerBarDomRef.current.className = 'h-full transition-colors duration-150 bg-emerald-400';
    }
    setHudSpeed(1.0);
    setHudHolding(null);
    setIsFinished(false);
    isFinishedRef.current = false;

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

    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(15.6, 0.6, 10.8),
      new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.85 })
    );
    floor.position.set(0, -0.3, 0.2);
    floor.receiveShadow = true;
    scene.add(floor);

    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 4.4),
      new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.015, 0.55);
    rug.receiveShadow = true;
    scene.add(rug);

    // 4 Sculpted 3D Buffet Counters with Appetizing 3D Food Platters
    SHABU_STATIONS.forEach((st) => {
      const grp = new THREE.Group();
      const counter = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 1.02, 1.6),
        new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.72 })
      );
      counter.position.y = 0.51;
      counter.castShadow = true;
      counter.receiveShadow = true;
      grp.add(counter);

      const topTrim = new THREE.Mesh(
        new THREE.BoxGeometry(2.74, 0.14, 1.74),
        new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.35 })
      );
      topTrim.position.y = 1.07;
      grp.add(topTrim);

      const neonStrip = new THREE.Mesh(
        new THREE.BoxGeometry(2.64, 0.1, 1.64),
        new THREE.MeshBasicMaterial({ color: st.colorHex })
      );
      neonStrip.position.y = 0.96;
      grp.add(neonStrip);

      if (st.id === 'meat') {
        const board = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.08, 1.15),
          new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.65 })
        );
        board.position.y = 1.18;
        grp.add(board);

        const meatRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.45 });
        const fatWhiteMat = new THREE.MeshStandardMaterial({ color: 0xfef2f2, roughness: 0.4 });
        for (let r = 0; r < 6; r++) {
          const rx = -0.72 + (r % 3) * 0.72;
          const rz = r < 3 ? -0.26 : 0.26;
          const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.48, 12), meatRedMat);
          roll.rotation.z = Math.PI / 2;
          roll.position.set(rx, 1.35, rz);
          roll.castShadow = true;
          const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.166, 0.166, 0.12, 12), fatWhiteMat);
          stripe.rotation.z = Math.PI / 2;
          stripe.position.set(rx, 1.35, rz);
          grp.add(roll, stripe);
        }
      } else if (st.id === 'seafood') {
        const iceBed = new THREE.Mesh(
          new THREE.BoxGeometry(2.15, 0.14, 1.2),
          new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.15, metalness: 0.1 })
        );
        iceBed.position.y = 1.2;
        grp.add(iceBed);

        const shrimpMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 });
        const squidMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });
        for (let i = 0; i < 4; i++) {
          const shrimp = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.075, 8, 14, Math.PI * 1.35), shrimpMat);
          shrimp.rotation.x = Math.PI / 2;
          shrimp.position.set(-0.65 + i * 0.44, 1.33, -0.22);
          grp.add(shrimp);
        }
        for (let i = 0; i < 4; i++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.055, 8, 14), squidMat);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(-0.6 + i * 0.42, 1.32, 0.26);
          grp.add(ring);
        }
      } else if (st.id === 'veggie') {
        const basket = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 0.16, 1.18),
          new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 })
        );
        basket.position.y = 1.2;
        grp.add(basket);

        const leafGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.55 });
        const stemLight = new THREE.MeshStandardMaterial({ color: 0xd9f99d, roughness: 0.5 });
        for (let v = 0; v < 5; v++) {
          const vx = -0.72 + v * 0.36;
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), leafGreen);
          leaf.scale.set(1.1, 0.7, 1.3);
          leaf.position.set(vx, 1.36, -0.18);
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 8), stemLight);
          stem.rotation.x = Math.PI / 2;
          stem.position.set(vx, 1.32, 0.16);
          grp.add(leaf, stem);
        }
      } else {
        const tray = new THREE.Mesh(
          new THREE.BoxGeometry(2.05, 0.08, 1.15),
          new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 })
        );
        tray.position.y = 1.18;
        grp.add(tray);

        const bowlMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.35 });
        const sauceCols = [0xea580c, 0xdc2626, 0xb45309];
        [-0.62, 0, 0.62].forEach((bx, bi) => {
          const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.18, 0.22, 14), bowlMat);
          bowl.position.set(bx, 1.32, 0);
          const dip = new THREE.Mesh(
            new THREE.CylinderGeometry(0.23, 0.23, 0.04, 14),
            new THREE.MeshBasicMaterial({ color: sauceCols[bi] })
          );
          dip.position.set(bx, 1.42, 0);
          grp.add(bowl, dip);
        });
      }

      const glowRing = new THREE.Mesh(
        new THREE.RingGeometry(1.15, 1.36, 28),
        new THREE.MeshBasicMaterial({
          color: st.colorHex,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.55,
        })
      );
      glowRing.rotation.x = -Math.PI / 2;
      glowRing.position.set(0, 0.025, 0);
      grp.add(glowRing);

      grp.position.set(st.x, 0, st.z);
      scene.add(grp);
    });

    // Center Shabu Table + Twin-Soup Hotpot
    const centerTable = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.25, 0.96, 24),
      new THREE.MeshStandardMaterial({ color: 0x29170b, roughness: 0.6 })
    );
    centerTable.position.set(SHABU_POT_POS.x, 0.48, SHABU_POT_POS.z);
    centerTable.castShadow = true;
    scene.add(centerTable);

    const potGroup = new THREE.Group();
    const potOuter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.95, 0.78, 0.42, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.25 })
    );
    potOuter.castShadow = true;
    potGroup.add(potOuter);

    const malaHalf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.88, 0.06, 20, 1, false, 0, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xdc2626 })
    );
    malaHalf.position.y = 0.19;
    const clearHalf = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 0.88, 0.06, 20, 1, false, Math.PI, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0xfde047 })
    );
    clearHalf.position.y = 0.19;
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(1.76, 0.12, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.8 })
    );
    divider.position.y = 0.2;
    potGroup.add(malaHalf, clearHalf, divider);

    const steamOrbs: THREE.Mesh[] = [];
    for (let si = 0; si < 6; si++) {
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
      );
      orb.position.set((si - 2.5) * 0.2, 0.4 + si * 0.2, (si % 2 - 0.5) * 0.28);
      potGroup.add(orb);
      steamOrbs.push(orb);
    }

    potGroup.position.set(SHABU_POT_POS.x, 1.05, SHABU_POT_POS.z);
    scene.add(potGroup);

    // Guard Boss sitting in front of the pot
    const guardParts = buildCustomGuardCharacter();
    guardParts.rootGroup.position.set(SHABU_GUARD_POS.x, 0, SHABU_GUARD_POS.z);
    guardParts.rootGroup.rotation.y = -Math.PI / 2;
    guardParts.rootGroup.scale.setScalar(1.0);
    scene.add(guardParts.rootGroup);

    // Build Real 3D Players with Equipped Props + Holding Badges
    const activeMySlot = myPlayingSlotRef.current;
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

    const curPlayersList = playersRef.current;
    const visuals: PlayerVisual[] = slotsToUse.map((slotId, idx) => {
      const member = memSnap[slotId];
      const found =
        curPlayersList.find((p) => p.id === member?.playerId) ||
        curPlayersList[idx % Math.max(1, curPlayersList.length)];

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
    let hostSeq = 0;

    const stepShabuTick = (delta: number, nowMs: number, skipWebgl: boolean) => {
      elapsed += delta;
      const st = gameStateRef.current;
      if (!st) return;

      if (amIMatchHostRef.current) {
        const inputs: Record<ShabuSlotId, ShabuInputState> = {
          P1: { ...EMPTY_INPUT },
          P2: { ...EMPTY_INPUT },
          P3: { ...EMPTY_INPUT },
          P4: { ...EMPTY_INPUT },
        };
        for (const p of st.players) {
          inputs[p.slotId] =
            p.slotId === myPlayingSlotRef.current
              ? localInputRef.current
              : shabuWatchdogRef.current.read(p.slotId, nowMs, EMPTY_INPUT);
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

        // Broadcast at 20 Hz (50ms) with rounded floats — saves 40%+ bandwidth and never hits rate limit!
        const urgent = Boolean(ev.serve || ev.flip);
        if (urgent || nowMs - lastNetSend >= SHABU_BROADCAST_MS) {
          lastNetSend = nowMs;
          hostSeq += 1;
          const compactState: ShabuGameState = {
            ...st,
            hunger: r2(st.hunger),
            speedMult: r2(st.speedMult),
            potY: r2(st.potY),
            potRotX: r2(st.potRotX),
            potRotZ: r2(st.potRotZ),
            players: st.players.map((pl) => ({
              ...pl,
              x: r2(pl.x),
              z: r2(pl.z),
              vx: r2(pl.vx),
              vz: r2(pl.vz),
              rotY: r2(pl.rotY),
            })),
          };
          sendRoomMessageRef.current('shabu_state', {
            seq: hostSeq,
            hid: myClientIdRef.current,
            s: compactState,
          });
        }
      } else {
        // Guest: 60 FPS Client-Side Prediction for Local Chef + Smooth Reconciliation & Snapshot Lerp!
        const mySlot = myPlayingSlotRef.current;
        const myLocalChef = st.players.find((lp) => lp.slotId === mySlot);
        if (myLocalChef && st.phase === 'playing') {
          const dashed = stepLocalShabuPlayer(myLocalChef, localInputRef.current, delta);
          if (dashed) {
            playShabuSound('dash', mutedRef.current);
          }
        }

        const curr = currSnapRef.current;
        if (curr) {
          const prev = prevSnapRef.current || curr;
          if (st.phase === 'playing' && curr.phase === 'pot_flipped') {
            playShabuSound('flip', mutedRef.current);
            setShakeActive(true);
            setTimeout(() => setShakeActive(false), 650);
          }
          if (curr.dishesServed > st.dishesServed) {
            playShabuSound('serve', mutedRef.current);
            confetti({ particleCount: 35, spread: 55, origin: { y: 0.45 } });
          }
          st.order = curr.order;
          st.hunger = curr.hunger;
          st.speedMult = curr.speedMult;
          st.score = curr.score;
          st.combo = curr.combo;
          st.maxCombo = curr.maxCombo;
          st.dishesServed = curr.dishesServed;
          st.phase = curr.phase;
          st.potY = curr.potY;
          st.potRotX = curr.potRotX;
          st.potRotZ = curr.potRotZ;
          st.feedbackText = curr.feedbackText;

          const elapsedSnapMs = Math.max(0, nowMs - currSnapRecvMsRef.current);
          const rawAlpha = elapsedSnapMs / SHABU_BROADCAST_MS;
          const lerpT = Math.min(1, rawAlpha);
          const extraHostSec =
            rawAlpha > 1 ? Math.min(0.05, (elapsedSnapMs - SHABU_BROADCAST_MS) / 1000) : 0;

          for (const netP of curr.players) {
            const localP = st.players.find((lp) => lp.slotId === netP.slotId);
            if (!localP) continue;
            if (netP.slotId === mySlot && st.phase === 'playing') {
              localP.holding = netP.holding;
              const authX = netP.x + netP.vx * extraHostSec;
              const authZ = netP.z + netP.vz * extraHostSec;
              const errDist = Math.hypot(authX - localP.x, authZ - localP.z);
              if (errDist > 2.2) {
                localP.x = authX;
                localP.z = authZ;
              } else if (errDist > 0.12) {
                const reconRate = 1 - Math.exp(-12 * delta);
                localP.x += (authX - localP.x) * reconRate;
                localP.z += (authZ - localP.z) * reconRate;
              }
              continue;
            }
            const prevP = prev.players.find((pp) => pp.slotId === netP.slotId) || netP;
            if (rawAlpha <= 1) {
              localP.x = prevP.x + (netP.x - prevP.x) * lerpT;
              localP.z = prevP.z + (netP.z - prevP.z) * lerpT;
            } else {
              localP.x = netP.x + netP.vx * extraHostSec;
              localP.z = netP.z + netP.vz * extraHostSec;
            }
            localP.vx = netP.vx;
            localP.vz = netP.vz;
            localP.rotY = netP.rotY;
            localP.holding = netP.holding;
          }
        }
      }

      if (!skipWebgl && hungerBarDomRef.current) {
        const clampedH = Math.max(0, Math.min(100, st.hunger));
        hungerBarDomRef.current.style.width = `${clampedH.toFixed(1)}%`;
        const nextToneClass =
          clampedH > 55
            ? 'h-full transition-colors duration-150 bg-emerald-400'
            : clampedH > 30
              ? 'h-full transition-colors duration-150 bg-amber-400'
              : 'h-full transition-colors duration-150 bg-rose-500 animate-pulse';
        if (hungerBarDomRef.current.className !== nextToneClass) {
          hungerBarDomRef.current.className = nextToneClass;
        }
      }

      // Sync discrete React HUD values ONLY when score, order, or discrete state actually changes
      if (!skipWebgl && nowMs - lastHudSync > 95) {
        lastHudSync = nowMs;
        const dangerNow = st.hunger < 30;
        setIsHungerDanger((prev) => (prev !== dangerNow ? dangerNow : prev));
        setHudScore((prev) => (prev !== st.score ? st.score : prev));
        setHudCombo((prev) => (prev !== st.combo ? st.combo : prev));
        setHudMaxCombo((prev) => (prev !== st.maxCombo ? st.maxCombo : prev));
        setHudDishes((prev) => (prev !== st.dishesServed ? st.dishesServed : prev));
        const nextSpd = Number(st.speedMult.toFixed(1));
        setHudSpeed((prev) => (prev !== nextSpd ? nextSpd : prev));
        const nextOrderSig = st.order
          .map((o) => `${o.ingredient}:${o.delivered ? 1 : 0}`)
          .join(',');
        if (nextOrderSig !== hudOrderSigRef.current) {
          hudOrderSigRef.current = nextOrderSig;
          setHudOrder([...st.order]);
        }
        setHudFeedback((prev) => (prev !== st.feedbackText ? st.feedbackText : prev));
        const meP = st.players.find((p) => p.slotId === myPlayingSlotRef.current);
        const nextHold = meP?.holding ?? null;
        setHudHolding((prev) => (prev !== nextHold ? nextHold : prev));
      }

      if (st.phase === 'pot_flipped' && !finishHandled) {
        finishHandled = true;
        setIsFinished(true);
        isFinishedRef.current = true;
        void claimShabuRewardRef.current(st.score);
      }

      // Animate Pot & Steam
      potGroup.position.y = 1.05 + st.potY;
      potGroup.rotation.x = st.potRotX;
      potGroup.rotation.z = st.potRotZ;
      steamOrbs.forEach((orb, idx) => {
        orb.visible = st.phase === 'playing';
        if (orb.visible) {
          orb.position.y = 0.35 + ((elapsed * 1.2 + idx * 0.35) % 1.4);
          orb.scale.setScalar(0.8 + Math.sin(elapsed * 4 + idx) * 0.25);
        }
      });

      // Animate Guard Boss mood based on hunger!
      const rage = Math.max(0, (45 - st.hunger) / 45);
      guardParts.bounceGroup.position.y = rage > 0.1 ? Math.abs(Math.sin(elapsed * 16)) * 0.16 * rage : Math.sin(elapsed * 2.5) * 0.03;
      guardParts.armL.rotation.z = rage > 0.2 ? 2.2 + Math.sin(elapsed * 18) * 0.4 : 0.25;
      guardParts.armR.rotation.z = rage > 0.2 ? -2.2 - Math.sin(elapsed * 18) * 0.4 : -0.25;

      // Sync 3D Chef Characters
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

      if (!skipWebgl) {
        renderer.render(scene, camera);
      }
    };

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (typeof document !== 'undefined' && document.hidden) {
        clock.getDelta();
        return;
      }
      const delta = Math.min(0.033, clock.getDelta());
      stepShabuTick(delta, performance.now(), false);
    };

    let lastBgShabuMs = performance.now();
    const disposeBgShabu = createBackgroundHostTicker((bgNowMs) => {
      if (amIMatchHostRef.current && !isFinishedRef.current) {
        const bgDt = Math.min(0.033, Math.max(0.016, (bgNowMs - lastBgShabuMs) / 1000));
        lastBgShabuMs = bgNowMs;
        stepShabuTick(bgDt, bgNowMs, true);
      }
    }, SHABU_BROADCAST_MS);

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      disposeBgShabu();
      window.removeEventListener('resize', onResize);
      visuals.forEach((v) => {
        v.charParts.rootGroup.userData.disposed = true;
      });
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, [isOpen, screen, qualityMode, shabuRunId]);

  if (!isOpen) return null;

  const joinedCount = Object.keys(lobbyResolved.slots).length;
  const estGp = computeShabuGpReward(hudScore);
  const isDanger = isHungerDanger;

  const handleHostStartShabu = () => {
    if (!amILobbyHost) return;
    const pkt = {
      runUid: `${roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      hostClientId: myClientIdRef.current,
      members: lobbyResolved.slots,
    };
    const me = players.find((p) => p.id === currentUserId) || players[0];
    const roster = SLOT_ORDER.flatMap((sid) => {
      const m = lobbyResolved.slots[sid];
      if (!m) return [];
      return [
        {
          slotId: sid,
          clientId: m.clientId,
          playerId: m.playerId,
          name: m.name,
          emoji: m.emoji,
          team: 'coop' as const,
        },
      ];
    });
    onLobbyBroadcastRef.current?.({
      roomCode,
      hostUserId: me?.id ?? (currentUserId || 0),
      hostName: me?.name || 'เพื่อน',
      hostEmoji: me?.emoji || '🍲',
      count: lobbyResolved.sorted.length,
      max: 4,
      status: 'started',
      roster,
    });
    sendRoomMessage('start_shabu', pkt);
    startShabuFromPayload(pkt);
  };

  // Virtual 360° Joystick Handlers (Direct DOM transform — zero React re-renders on pointermove!)
  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerIdRef.current = e.pointerId;
    joyOriginRef.current = { x: e.clientX, y: e.clientY };
    if (joyKnobDomRef.current) {
      joyKnobDomRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
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
    if (joyKnobDomRef.current) {
      joyKnobDomRef.current.style.transform = `translate3d(${kx.toFixed(1)}px, ${ky.toFixed(1)}px, 0)`;
    }
    localInputRef.current.mx = dist > 8 ? kx / maxR : 0;
    localInputRef.current.mz = dist > 8 ? ky / maxR : 0;
    notifyLocalInputChanged();
  };

  const handleJoyEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    joyPointerIdRef.current = null;
    if (joyKnobDomRef.current) {
      joyKnobDomRef.current.style.transform = 'translate3d(0px, 0px, 0)';
    }
    localInputRef.current.mx = 0;
    localInputRef.current.mz = 0;
    notifyLocalInputChanged();
  };

  return (
    <div className={`fixed inset-0 z-50 bg-slate-950/92 flex flex-col overflow-hidden ${shakeActive ? 'shake-active' : ''}`}>
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[92vw]">
          <div className="rpg-banner border-2 border-amber-300 rounded-2xl px-4 py-2 text-xs sm:text-sm font-extrabold text-amber-200 shadow-2xl">
            {toastMsg}
          </div>
        </div>
      )}

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

            {/* Single Shared Hotpot Room Strip */}
            <div className="flex items-center justify-between bg-slate-900/90 border border-amber-500/40 rounded-xl px-3 py-2">
              <span className="text-xs font-extrabold text-amber-200">
                🍲 เตาชาบูกลางเกาะ (รวมตี้ในห้องรอนี้อัตโนมัติ • เล่นทีละ 1 กลุ่ม)
              </span>
              <span className="text-[11px] font-bold text-emerald-300 shrink-0">🟢 Presence Live</span>
            </div>

            <div className="bg-amber-950/70 border-2 border-amber-400/70 rounded-xl p-3 text-center space-y-1">
              <div className="font-[family-name:var(--font-kanit)] text-base sm:text-lg font-extrabold text-amber-300">
                👥 สมาชิกตี้ชาบู ({joinedCount}/4 คน)
              </div>
              <div className="text-[11px] text-amber-100/90 font-semibold">
                เพื่อนเดินมาที่ซุ้มอาหารบนเกาะแล้วกดเข้าตี้ชาบู จะเข้ามาเจอกันในห้องรอนี้อัตโนมัติ!
              </div>
            </div>

            {/* 4 Co-op Player Slots */}
            <div className="grid grid-cols-2 gap-2">
              {SLOT_ORDER.map((sid, idx) => {
                const m = lobbyResolved.slots[sid];
                const isSlotHost = m?.clientId === lobbyResolved.hostClientId;
                return (
                  <div
                    key={sid}
                    className={`rounded-xl p-3 border text-center ${m
                      ? 'bg-amber-500/20 border-amber-300 text-amber-100'
                      : 'bg-slate-950/70 border-dashed border-slate-600 text-slate-400'
                      }`}
                  >
                    <div className="text-[10px] font-bold opacity-75 mb-0.5">
                      เชฟคนที่ {idx + 1} {isSlotHost ? '👑 (หัวตี้)' : ''}
                    </div>
                    {m ? (
                      <div className="text-xs sm:text-sm font-extrabold truncate">
                        {m.emoji} {m.name} {sid === myLobbySlot ? '(คุณ)' : ''}
                      </div>
                    ) : (
                      <div className="text-[11px] font-bold animate-pulse">⏳ ว่าง (รอเพื่อนเข้า)</div>
                    )}
                  </div>
                );
              })}
            </div>

            {amILobbyHost ? (
              <button
                type="button"
                onClick={handleHostStartShabu}
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
                    ref={hungerBarDomRef}
                    className="h-full transition-colors duration-150 bg-emerald-400"
                    style={{ width: '100%' }}
                  />
                </div>
                <span className="text-[10px] font-extrabold text-amber-200">x{hudSpeed}⚡</span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowTouchControls((v) => !v)}
                className={`rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold cursor-pointer ${showTouchControls ? 'text-amber-300 ring-1 ring-amber-300' : 'text-amber-100/75'
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
                        className={`px-2 py-0.5 rounded-xl border-2 text-sm sm:text-base font-extrabold flex items-center gap-1 ${item.delivered
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

          {/* Mobile & iPad Multi-Touch Controls */}
          {!isFinished && showTouchControls && (
            <div className="flex fixed bottom-4 inset-x-4 pb-safe z-30 items-end justify-between pointer-events-none">
              <div
                onPointerDown={handleJoyDown}
                onPointerMove={handleJoyMove}
                onPointerUp={handleJoyEnd}
                onPointerCancel={handleJoyEnd}
                className="pointer-events-auto relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-slate-900/65 border-2 border-amber-300/80 shadow-xl flex items-center justify-center touch-none select-none"
              >
                <div
                  ref={joyKnobDomRef}
                  style={{ transform: 'translate3d(0px, 0px, 0)' }}
                  className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 border-2 border-white shadow-lg flex items-center justify-center text-stone-950 font-black pointer-events-none will-change-transform"
                >
                  👆
                </div>
              </div>

              <div className="flex items-end gap-3 pointer-events-auto">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    localInputRef.current.dash = true;
                    notifyLocalInputChanged();
                  }}
                  onPointerUp={() => {
                    localInputRef.current.dash = false;
                    notifyLocalInputChanged();
                  }}
                  onPointerCancel={() => {
                    localInputRef.current.dash = false;
                    notifyLocalInputChanged();
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
                    notifyLocalInputChanged();
                  }}
                  onPointerUp={() => {
                    localInputRef.current.interact = false;
                    notifyLocalInputChanged();
                  }}
                  onPointerCancel={() => {
                    localInputRef.current.interact = false;
                    notifyLocalInputChanged();
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
                {amIMatchHost ? (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        const pkt = {
                          runUid: `${roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                          hostClientId: myClientIdRef.current,
                          members: lobbyResolved.slots,
                        };
                        sendRoomMessage('start_shabu', pkt);
                        startShabuFromPayload(pkt);
                      }}
                      className="w-full rpg-btn-gold py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
                    >
                      🔄 ตั้งวงชาบูใหม่อีกรอบ!
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sendRoomMessage('back_to_waiting', { ts: Date.now() });
                        activeRunUidRef.current = '';
                        isFinishedRef.current = false;
                        setIsFinished(false);
                        setRewardStatus('');
                        screenRef.current = 'waiting';
                        setScreen('waiting');
                      }}
                      className="w-full py-2.5 rounded-xl bg-amber-950/80 hover:bg-amber-900 border border-amber-400/70 text-amber-200 text-xs font-extrabold cursor-pointer"
                    >
                      🏠 พาทั้งตี้กลับห้องรอ (ชวนเพื่อนเพิ่ม)
                    </button>
                  </div>
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
