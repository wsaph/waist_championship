'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
import { sessionFetch } from '@/lib/client_session';
import {
  createInitialMatchState,
  resetRallyPositions,
  stepVolleyballMatch,
  computeBotInput,
  playVbSound,
  VB_WIN_SCORE,
  type VbMode,
  type VbDifficulty,
  type VbSlotId,
  type VbTeam,
  type VbInputState,
  type VbMatchState,
} from './engine';
import { mapEmojiToChibiSkin } from './2d/physics2d';
import { recordMatchResultByHost } from './stats';
import { LeaderboardPanel } from './2d/PikachuCanvasVolleyball';

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

export const SINGLE_VB_ROOM_CODE = '7777';

export interface VbCourtRosterSlot {
  slotId: VbSlotId;
  clientId?: string;
  playerId: number;
  name: string;
  emoji: string;
  isBot?: boolean;
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
  scoreLeft?: number;
  scoreRight?: number;
  roster?: VbCourtRosterSlot[];
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
  externalLobbyInfo?: VbLobbyBroadcastInfo | null;
  onLobbyBroadcast?: (info: VbLobbyBroadcastInfo) => void;
  onRewardEarned?: (earned: number, newPoints: number) => void;
}

interface PresenceSlotMember {
  clientId: string;
  playerId: number;
  name: string;
  emoji: string;
  desiredSlot: VbSlotId;
  slotUpdatedAt: number;
  ready: boolean;
  joinedAt: number;
  inMatch?: boolean;
  matchMode?: VbMode;
  scoreLeft?: number;
  scoreRight?: number;
  matchRoster?: VbCourtRosterSlot[];
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
  bot?: 1;
}

interface CompactNetState {
  seq: number;
  hid?: string;
  ph: VbMatchState['phase'];
  pt: number;
  sl: number;
  sr: number;
  sv: VbTeam;
  ls: VbTeam | null;
  w: VbTeam | null;
  bx: number;
  by: number;
  bvx: number;
  bvy: number;
  bsp: boolean;
  pl: CompactNetPlayer[];
  ev?: { h?: 1; sp?: 1; dv?: 1; sc?: VbTeam; win?: VbTeam };
}

interface EventDrivenGuestInputPacket {
  clientId: string;
  slot: VbSlotId;
  seq: number;
  input: VbInputState;
}

interface StartMatchPayload {
  matchUid: string;
  mode: VbMode;
  hostClientId: string;
  slots: Partial<Record<VbSlotId, PresenceSlotMember>>;
  startedAt: number;
}

const FIXED_DT = 1 / 60;
const HOST_BROADCAST_INTERVAL_MS = 50; // Exact 20 Hz!
const r2 = (n: number) => Math.round(n * 100) / 100;

const EMPTY_INPUT: VbInputState = {
  left: false,
  right: false,
  jump: false,
  down: false,
  action: false,
};

function inputsMatch(a: VbInputState, b: VbInputState): boolean {
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.jump === b.jump &&
    Boolean(a.down) === Boolean(b.down) &&
    a.action === b.action
  );
}

/**
 * Deterministic Host Election & Conflict-Free Slot Assignment across all Presence members.
 * Balances teams automatically: L1 -> R1 -> L2 -> R2, while respecting clicked slots!
 */
function resolvePresenceSlots(
  members: PresenceSlotMember[],
  mode: VbMode
): {
  hostClientId: string | null;
  slots: Partial<Record<VbSlotId, PresenceSlotMember>>;
  onlineList: PresenceSlotMember[];
  allFilled: boolean;
  allReady: boolean;
} {
  const byJoin = [...members].sort((a, b) => {
    if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
    return a.clientId.localeCompare(b.clientId);
  });
  const hostClientId = byJoin[0]?.clientId ?? null;
  const validSlots: VbSlotId[] = mode === '2v2' ? ['L1', 'L2', 'R1', 'R2'] : ['L1', 'R1'];
  const balancedOrder: VbSlotId[] = mode === '2v2' ? ['L1', 'R1', 'L2', 'R2'] : ['L1', 'R1'];

  const assigned: Partial<Record<VbSlotId, PresenceSlotMember>> = {};
  const overflow: PresenceSlotMember[] = [];

  const bySlotClaim = [...byJoin].sort((a, b) => {
    if (a.slotUpdatedAt !== b.slotUpdatedAt) return a.slotUpdatedAt - b.slotUpdatedAt;
    return a.joinedAt - b.joinedAt;
  });

  for (const m of bySlotClaim) {
    if (validSlots.includes(m.desiredSlot) && !assigned[m.desiredSlot]) {
      assigned[m.desiredSlot] = m;
    } else {
      overflow.push(m);
    }
  }

  for (const m of overflow) {
    const open = balancedOrder.find((s) => !assigned[s]);
    if (open) assigned[open] = m;
  }

  const filledCount = validSlots.filter((s) => Boolean(assigned[s])).length;
  const allFilled = filledCount === validSlots.length;
  const allReady =
    allFilled &&
    validSlots.every((s) => {
      const occ = assigned[s];
      if (!occ) return false;
      return occ.clientId === hostClientId || occ.ready;
    });

  return { hostClientId, slots: assigned, onlineList: byJoin, allFilled, allReady };
}

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
  initialMode,
  invitedTargetName,
  externalLobbyInfo = null,
  onLobbyBroadcast,
  onRewardEarned,
}: BeachVolleyballModalProps) {
  const [screen, setScreen] = useState<'waiting' | 'playing' | 'leaderboard'>('waiting');
  const roomCode = SINGLE_VB_ROOM_CODE;
  const [mode, setMode] = useState<VbMode>(initialMode || '2v2');
  const [isPractice, setIsPractice] = useState<boolean>(false);
  const [botDifficulty, setBotDifficulty] = useState<VbDifficulty>('normal');
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

  const slideKnobDomRef = useRef<HTMLDivElement | null>(null);
  const slidePointerIdRef = useRef<number | null>(null);
  const slideOriginXRef = useRef<number>(0);
  const slideOriginYRef = useRef<number>(0);

  const myClientIdRef = useRef<string>(`vb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const [presenceMembers, setPresenceMembers] = useState<PresenceSlotMember[]>([]);
  const [activeMatchSlots, setActiveMatchSlots] = useState<
    Partial<Record<VbSlotId, PresenceSlotMember>>
  >({});
  const [myPlayingSlot, setMyPlayingSlot] = useState<VbSlotId>('L1');
  const [amIMatchHost, setAmIMatchHost] = useState<boolean>(true);

  // Live HUD state
  const [scoreLeft, setScoreLeft] = useState<number>(0);
  const [scoreRight, setScoreRight] = useState<number>(0);
  const [pointBanner, setPointBanner] = useState<string>('');
  const [winnerTeam, setWinnerTeam] = useState<VbTeam | null>(null);
  const [matchRunId, setMatchRunId] = useState<number>(0);
  const [rewardStatus, setRewardStatus] = useState<string>('');
  const [shakeActive, setShakeActive] = useState<boolean>(false);

  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const labelsOverlayRef = useRef<HTMLDivElement | null>(null);

  const localInputRef = useRef<VbInputState>({ ...EMPTY_INPUT });
  const lastSentInputRef = useRef<VbInputState>({ ...EMPTY_INPUT });
  const guestInputSeqRef = useRef<number>(0);
  const remoteInputsRef = useRef<Record<VbSlotId, VbInputState>>({
    L1: { ...EMPTY_INPUT },
    L2: { ...EMPTY_INPUT },
    R1: { ...EMPTY_INPUT },
    R2: { ...EMPTY_INPUT },
  });

  // 20Hz Snapshot Linear Interpolation (Lerp) Buffer on Guest
  const prevNetSnapRef = useRef<CompactNetState | null>(null);
  const currNetSnapRef = useRef<CompactNetState | null>(null);
  const currSnapRecvMsRef = useRef<number>(0);
  const lastRecvSeqRef = useRef<number>(0);
  const lastRecvHostIdRef = useRef<string | null>(null);

  const matchStateRef = useRef<VbMatchState | null>(null);
  const activeMatchUidRef = useRef<string>('');
  const matchStartedAtRef = useRef<number>(0);
  const matchSavedRef = useRef<boolean>(false);
  const rewardClaimedRef = useRef<boolean>(false);
  const winHandledRef = useRef<boolean>(false);

  const mutedRef = useRef<boolean>(false);
  mutedRef.current = muted;
  const playersRef = useRef(players);
  playersRef.current = players;
  const modeRef = useRef<VbMode>(mode);
  modeRef.current = mode;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const isPracticeRef = useRef(isPractice);
  isPracticeRef.current = isPractice;
  const botDifficultyRef = useRef(botDifficulty);
  botDifficultyRef.current = botDifficulty;
  const amIMatchHostRef = useRef(amIMatchHost);
  amIMatchHostRef.current = amIMatchHost;
  const myPlayingSlotRef = useRef(myPlayingSlot);
  myPlayingSlotRef.current = myPlayingSlot;
  const activeMatchSlotsRef = useRef(activeMatchSlots);
  activeMatchSlotsRef.current = activeMatchSlots;
  const winnerTeamRef = useRef<VbTeam | null>(winnerTeam);
  winnerTeamRef.current = winnerTeam;
  const onLobbyBroadcastRef = useRef(onLobbyBroadcast);
  onLobbyBroadcastRef.current = onLobbyBroadcast;
  const onRewardEarnedRef = useRef(onRewardEarned);
  onRewardEarnedRef.current = onRewardEarned;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const mePresenceRef = useRef<PresenceSlotMember | null>(null);
  const currentHostIdRef = useRef<string | null>(null);

  const showRoomToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? '' : cur));
    }, 4200);
  }, []);

  const lobbyResolved = useMemo(
    () => resolvePresenceSlots(presenceMembers, mode),
    [presenceMembers, mode]
  );
  currentHostIdRef.current = lobbyResolved.hostClientId;

  const amILobbyHost = lobbyResolved.hostClientId === myClientIdRef.current;

  const myLobbySlot = useMemo<VbSlotId>(() => {
    for (const [sid, m] of Object.entries(lobbyResolved.slots)) {
      if (m?.clientId === myClientIdRef.current) return sid as VbSlotId;
    }
    return 'L1';
  }, [lobbyResolved.slots]);

  const myPresenceEntry = useMemo(
    () => presenceMembers.find((m) => m.clientId === myClientIdRef.current),
    [presenceMembers]
  );

  const buildMatchRosterSnapshot = useCallback(
    (
      slotsMap: Partial<Record<VbSlotId, PresenceSlotMember>>,
      mMode: VbMode,
      st?: VbMatchState | null
    ): VbCourtRosterSlot[] => {
      const slotList: VbSlotId[] = mMode === '2v2' ? ['L1', 'L2', 'R1', 'R2'] : ['L1', 'R1'];
      const curPlayers = playersRef.current;
      return slotList.map((sid, idx) => {
        const mem = slotsMap[sid];
        const physPl = st?.players.find((p) => p.slotId === sid);
        const isBot = Boolean(physPl ? physPl.isBot || !mem : !mem);
        const standIn = curPlayers[(idx + 1) % Math.max(1, curPlayers.length)];
        if (mem && !isBot) {
          return {
            slotId: sid,
            clientId: mem.clientId,
            playerId: mem.playerId,
            name: mem.name,
            emoji: mem.emoji,
            isBot: false,
          };
        }
        return {
          slotId: sid,
          playerId: mem?.playerId || standIn?.id || 0,
          name: mem ? `บอท (${mem.name})` : `บอท ${standIn?.name || sid}`,
          emoji: '🤖',
          isBot: true,
        };
      });
    },
    []
  );

  const waitingRoster = useMemo<VbCourtRosterSlot[]>(() => {
    const slotList: VbSlotId[] = mode === '2v2' ? ['L1', 'L2', 'R1', 'R2'] : ['L1', 'R1'];
    const out: VbCourtRosterSlot[] = [];
    for (const sid of slotList) {
      const m = lobbyResolved.slots[sid];
      if (m) {
        out.push({
          slotId: sid,
          clientId: m.clientId,
          playerId: m.playerId,
          name: m.name,
          emoji: m.emoji,
          isBot: false,
        });
      }
    }
    return out;
  }, [lobbyResolved.slots, mode]);

  // Detect if another group is currently playing a live round on the single court
  const amIInExternalMatch = useMemo(() => {
    if (!externalLobbyInfo || externalLobbyInfo.status !== 'started') return false;
    if (screen === 'playing') return true;
    const roster = externalLobbyInfo.roster || [];
    return roster.some(
      (r) =>
        !r.isBot &&
        (r.clientId === myClientIdRef.current ||
          Boolean(currentUserId && currentUserId > 0 && r.playerId === currentUserId))
    );
  }, [externalLobbyInfo, screen, currentUserId]);

  const amIAssignedInConnectedLobby = useMemo(() => {
    if (!channelRef.current && !bcRef.current) return false;
    return Object.values(lobbyResolved.slots).some(
      (m) => m?.clientId === myClientIdRef.current
    );
  }, [lobbyResolved.slots]);

  const externalLockedMatch = useMemo<VbLobbyBroadcastInfo | null>(() => {
    if (screen === 'playing') return null;
    if (
      externalLobbyInfo &&
      externalLobbyInfo.status === 'started' &&
      !amIInExternalMatch &&
      !amIAssignedInConnectedLobby
    ) {
      return externalLobbyInfo;
    }
    return null;
  }, [screen, externalLobbyInfo, amIInExternalMatch, amIAssignedInConnectedLobby]);

  const presenceLockedMatch = useMemo<VbLobbyBroadcastInfo | null>(() => {
    if (screen === 'playing') return null;
    const activeHost = presenceMembers.find(
      (m) => m.inMatch && m.clientId !== myClientIdRef.current
    );
    if (!activeHost) return null;
    const mRoster = activeHost.matchRoster || [];
    const amIListed = mRoster.some(
      (r) => !r.isBot && r.clientId === myClientIdRef.current
    );
    if (amIListed) return null;
    const mMode: VbMode = activeHost.matchMode === '1v1' ? '1v1' : '2v2';
    return {
      roomCode,
      mode: mMode,
      hostUserId: activeHost.playerId,
      hostName: activeHost.name,
      hostEmoji: activeHost.emoji,
      count: mRoster.filter((r) => !r.isBot).length || 1,
      max: mMode === '2v2' ? 4 : 2,
      status: 'started',
      scoreLeft: activeHost.scoreLeft ?? 0,
      scoreRight: activeHost.scoreRight ?? 0,
      roster: mRoster,
    };
  }, [screen, presenceMembers, roomCode]);

  const lockedMatchInfo = externalLockedMatch || presenceLockedMatch;
  const isLockedSpectator = Boolean(lockedMatchInfo) && screen !== 'playing';
  const isLockedSpectatorRef = useRef<boolean>(isLockedSpectator);
  isLockedSpectatorRef.current = isLockedSpectator;
  const lockedMatchInfoRef = useRef<VbLobbyBroadcastInfo | null>(lockedMatchInfo);
  lockedMatchInfoRef.current = lockedMatchInfo;
  const skipRoomConnection = Boolean(externalLockedMatch) || isPractice;

  const sendBroadcast = useCallback((event: string, payload: unknown) => {
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

  const broadcastActiveMatchToIsland = useCallback(
    (sl: number, sr: number, statusOverride: 'started' | 'closed' = 'started') => {
      if (!amIMatchHostRef.current && !isPracticeRef.current) return;
      const me = playersRef.current.find((p) => p.id === currentUserId) || playersRef.current[0];
      const mMode = modeRef.current;
      const roster = buildMatchRosterSnapshot(
        activeMatchSlotsRef.current,
        mMode,
        matchStateRef.current
      );
      const humanCount = Math.max(1, roster.filter((r) => !r.isBot).length);
      onLobbyBroadcastRef.current?.({
        roomCode,
        mode: mMode,
        hostUserId: me?.id ?? (currentUserId || 0),
        hostName: me?.name || 'เพื่อนในสนาม',
        hostEmoji: me?.emoji || '🏐',
        count: statusOverride === 'closed' ? 0 : humanCount,
        max: mMode === '2v2' ? 4 : 2,
        status: statusOverride,
        scoreLeft: sl,
        scoreRight: sr,
        roster: statusOverride === 'closed' ? [] : roster,
      });
    },
    [buildMatchRosterSnapshot, currentUserId, roomCode]
  );
  const broadcastActiveMatchToIslandRef = useRef(broadcastActiveMatchToIsland);
  broadcastActiveMatchToIslandRef.current = broadcastActiveMatchToIsland;

  // Claim daily +5 GP win reward when local player's team wins
  const claimWinReward = useCallback(async () => {
    if (rewardClaimedRef.current) return;
    rewardClaimedRef.current = true;
    if (!currentUserId || currentUserId <= 0) {
      setRewardStatus('ล็อกอินตัวละครในสนามหลักเพื่อรับโบนัสผู้ชนะ +5 💰 GP');
      return;
    }
    try {
      const res = await sessionFetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, type: 'volleyball_win' }),
      });
      const data = await res.json();
      if (res.ok && data.earned > 0) {
        setRewardStatus(`🎁 รับโบนัสผู้ชนะ +${data.earned} 💰 GP! (${data.winsToday}/${data.dailyCap} รอบวันนี้)`);
        onRewardEarnedRef.current?.(data.earned, data.points);
      } else if (res.ok && data.capReached) {
        setRewardStatus(`รับโบนัสครบ ${data.dailyCap}/${data.dailyCap} รอบของวันนี้แล้ว (ยังตีบอลต่อได้ไม่จำกัด!)`);
      }
    } catch {
      // ignore
    }
  }, [currentUserId]);

  const handleMatchEndOnce = useCallback(
    (st: VbMatchState, winSide: VbTeam) => {
      if (winHandledRef.current) return;
      winHandledRef.current = true;
      playVbSound('win', mutedRef.current);
      setWinnerTeam(winSide);

      const myTeam: VbTeam = myPlayingSlotRef.current.startsWith('L') ? 'left' : 'right';
      if (winSide === myTeam) {
        confetti({ particleCount: 95, spread: 80, origin: { y: 0.55 } });
        if (!isPracticeRef.current) {
          void claimWinReward();
        }
      }

      // Clear court lock immediately once the single round finishes!
      if (amIMatchHostRef.current || isPracticeRef.current) {
        broadcastActiveMatchToIslandRef.current(st.scoreLeft, st.scoreRight, 'closed');
        void updateMyPresenceRef.current({
          inMatch: false,
          matchRoster: undefined,
        });
      }

      // Host-only single write to Leaderboard DB at match end (never during gameplay!)
      if (amIMatchHostRef.current && !isPracticeRef.current && !matchSavedRef.current) {
        matchSavedRef.current = true;
        const slotsMap = activeMatchSlotsRef.current;
        const winningTeamDb = winSide === 'left' ? 'blue' : 'red';
        const winners: string[] = [];
        const losers: string[] = [];
        const entries: Array<{
          name: string;
          skin: ReturnType<typeof mapEmojiToChibiSkin>;
          won: boolean;
          points: number;
          isBot: boolean;
        }> = [];

        for (const p of st.players) {
          const mem = slotsMap[p.slotId];
          const isBot = p.isBot || !mem;
          const pName = mem?.name || '';
          const won = p.team === winSide;
          if (!isBot && pName) {
            if (won) winners.push(pName);
            else losers.push(pName);
          }
          entries.push({
            name: pName,
            skin: mapEmojiToChibiSkin(mem?.emoji),
            won,
            points: p.team === 'left' ? st.scoreLeft : st.scoreRight,
            isBot,
          });
        }

        void recordMatchResultByHost({
          matchUid: activeMatchUidRef.current || `${roomCode}-${Date.now()}`,
          roomCode,
          mode: st.court.mode,
          winningTeam: winningTeamDb,
          winners,
          losers,
          scoreBlue: st.scoreLeft,
          scoreRed: st.scoreRight,
          durationSeconds: Math.max(5, Math.round((Date.now() - matchStartedAtRef.current) / 1000)),
          playerEntries: entries,
        });
      }
    },
    [claimWinReward, roomCode]
  );
  const handleMatchEndOnceRef = useRef(handleMatchEndOnce);
  handleMatchEndOnceRef.current = handleMatchEndOnce;
  const sendBroadcastRef = useRef(sendBroadcast);
  sendBroadcastRef.current = sendBroadcast;

  const startFromMatchPacket = useCallback((pkt: StartMatchPayload) => {
    // Prevent duplicate or mid-rally accidental restarts while a live rally is already running!
    if (pkt.matchUid && pkt.matchUid === activeMatchUidRef.current && screenRef.current === 'playing') {
      return;
    }
    if (screenRef.current === 'playing' && !winnerTeamRef.current) {
      return;
    }
    const validSlots: VbSlotId[] = pkt.mode === '2v2' ? ['L1', 'L2', 'R1', 'R2'] : ['L1', 'R1'];
    let foundMySlot: VbSlotId = 'L1';
    for (const s of validSlots) {
      if (pkt.slots[s]?.clientId === myClientIdRef.current) {
        foundMySlot = s;
      }
    }

    const iAmHost = pkt.hostClientId === myClientIdRef.current;
    setIsPractice(false);
    isPracticeRef.current = false;
    setMode(pkt.mode);
    modeRef.current = pkt.mode;
    setActiveMatchSlots(pkt.slots);
    activeMatchSlotsRef.current = pkt.slots;
    setMyPlayingSlot(foundMySlot);
    myPlayingSlotRef.current = foundMySlot;
    setAmIMatchHost(iAmHost);
    amIMatchHostRef.current = iAmHost;

    activeMatchUidRef.current = pkt.matchUid;
    matchStartedAtRef.current = pkt.startedAt || Date.now();
    matchSavedRef.current = false;
    rewardClaimedRef.current = false;
    winHandledRef.current = false;

    prevNetSnapRef.current = null;
    currNetSnapRef.current = null;
    lastRecvSeqRef.current = 0;
    localInputRef.current = { ...EMPTY_INPUT };
    lastSentInputRef.current = { ...EMPTY_INPUT };
    slidePointerIdRef.current = null;
    remoteInputsRef.current = {
      L1: { ...EMPTY_INPUT },
      L2: { ...EMPTY_INPUT },
      R1: { ...EMPTY_INPUT },
      R2: { ...EMPTY_INPUT },
    };

    setScoreLeft(0);
    setScoreRight(0);
    setWinnerTeam(null);
    winnerTeamRef.current = null;
    setPointBanner('');
    setRewardStatus('');
    setShakeActive(false);
    setMatchRunId((n) => n + 1);
    screenRef.current = 'playing';
    setScreen('playing');

    if (iAmHost) {
      const initRoster = buildMatchRosterSnapshot(pkt.slots, pkt.mode, null);
      void updateMyPresenceRef.current({
        inMatch: true,
        matchMode: pkt.mode,
        scoreLeft: 0,
        scoreRight: 0,
        matchRoster: initRoster,
      });
      broadcastActiveMatchToIslandRef.current(0, 0, 'started');
    }
  }, [buildMatchRosterSnapshot]);

  const updateMyPresenceRef = useRef<
    (
      patch: Partial<
        Pick<
          PresenceSlotMember,
          'desiredSlot' | 'ready' | 'inMatch' | 'matchMode' | 'scoreLeft' | 'scoreRight' | 'matchRoster'
        >
      >
    ) => Promise<void>
  >(async () => { });

  const returnToWaitingRoom = useCallback(
    (origin: 'practice' | 'host_all' | 'guest_self' | 'from_remote') => {
      if (origin === 'host_all') {
        sendBroadcastRef.current('back_to_waiting', {});
      } else if (origin === 'practice') {
        broadcastActiveMatchToIslandRef.current(0, 0, 'closed');
      } else if (origin === 'guest_self') {
        sendBroadcastRef.current('guest_leave_match', {
          clientId: myClientIdRef.current,
          slot: myPlayingSlotRef.current,
          name: mePresenceRef.current?.name || 'ผู้เล่น',
          emoji: mePresenceRef.current?.emoji || '🏐',
        });
      }

      screenRef.current = 'waiting';
      isPracticeRef.current = false;
      winnerTeamRef.current = null;
      winHandledRef.current = false;
      rewardClaimedRef.current = false;
      matchSavedRef.current = false;
      activeMatchUidRef.current = '';
      matchStateRef.current = null;
      prevNetSnapRef.current = null;
      currNetSnapRef.current = null;
      lastRecvSeqRef.current = 0;
      localInputRef.current = { ...EMPTY_INPUT };
      lastSentInputRef.current = { ...EMPTY_INPUT };
      slidePointerIdRef.current = null;
      remoteInputsRef.current = {
        L1: { ...EMPTY_INPUT },
        L2: { ...EMPTY_INPUT },
        R1: { ...EMPTY_INPUT },
        R2: { ...EMPTY_INPUT },
      };

      setIsPractice(false);
      setWinnerTeam(null);
      setScoreLeft(0);
      setScoreRight(0);
      setPointBanner('');
      setRewardStatus('');
      setShakeActive(false);
      setScreen('waiting');

      // Reset Ready & Match lock state so players can change slots/modes cleanly in the waiting room
      void updateMyPresenceRef.current({
        ready: false,
        inMatch: false,
        matchRoster: undefined,
        scoreLeft: 0,
        scoreRight: 0,
      });
    },
    []
  );
  const returnToWaitingRoomRef = useRef(returnToWaitingRoom);
  returnToWaitingRoomRef.current = returnToWaitingRoom;

  const handleCloseToIsland = useCallback(() => {
    if (!isPracticeRef.current && screenRef.current === 'playing' && !amIMatchHostRef.current) {
      sendBroadcastRef.current('guest_leave_match', {
        clientId: myClientIdRef.current,
        slot: myPlayingSlotRef.current,
        name: mePresenceRef.current?.name || 'ผู้เล่น',
        emoji: mePresenceRef.current?.emoji || '🏐',
      });
    }
    const otherHumansStillPlaying =
      screenRef.current === 'playing' &&
      !isPracticeRef.current &&
      Object.values(activeMatchSlotsRef.current).some(
        (m) => m && m.clientId !== myClientIdRef.current
      );
    if (
      !isLockedSpectatorRef.current &&
      (isPracticeRef.current ||
        (currentHostIdRef.current === myClientIdRef.current && !otherHumansStillPlaying))
    ) {
      const me = playersRef.current.find((p) => p.id === currentUserId) || playersRef.current[0];
      onLobbyBroadcastRef.current?.({
        roomCode,
        mode: modeRef.current,
        hostUserId: currentUserId || 0,
        hostName: me?.name || 'เพื่อน',
        hostEmoji: me?.emoji || '🏐',
        count: 0,
        max: modeRef.current === '2v2' ? 4 : 2,
        status: 'closed',
        roster: [],
      });
    }
    localInputRef.current = { ...EMPTY_INPUT };
    slidePointerIdRef.current = null;
    setShakeActive(false);
    onClose();
  }, [currentUserId, onClose, roomCode]);

  // Broadcast open lobby banner + waiting roster to the 3D Arena island when waiting as Host
  useEffect(() => {
    if (!isOpen || isPractice || isLockedSpectator || screen !== 'waiting' || !amILobbyHost) return;
    const emitWaiting = () => {
      const me = playersRef.current.find((p) => p.id === currentUserId) || playersRef.current[0];
      const maxPlayers = mode === '2v2' ? 4 : 2;
      onLobbyBroadcastRef.current?.({
        roomCode,
        mode,
        hostUserId: me?.id ?? (currentUserId || 0),
        hostName: me?.name || 'เพื่อนในสนาม',
        hostEmoji: me?.emoji || '🏐',
        targetName: invitedTargetName,
        count: Math.min(maxPlayers, waitingRoster.length || 1),
        max: maxPlayers,
        status: 'waiting',
        roster: waitingRoster,
      });
    };
    emitWaiting();
    const hb = setInterval(emitWaiting, 5000);
    return () => clearInterval(hb);
  }, [
    isOpen,
    isPractice,
    isLockedSpectator,
    screen,
    amILobbyHost,
    roomCode,
    mode,
    waitingRoster,
    currentUserId,
    invitedTargetName,
  ]);

  // Lightweight island heartbeat (every 4.5s) while a match is running so all islanders see the playing characters & lock!
  useEffect(() => {
    if (!isOpen || screen !== 'playing' || Boolean(winnerTeam) || (!amIMatchHost && !isPractice)) {
      return;
    }
    const emitLiveMatch = () => {
      const st = matchStateRef.current;
      const sl = st ? st.scoreLeft : scoreLeft;
      const sr = st ? st.scoreRight : scoreRight;
      broadcastActiveMatchToIslandRef.current(sl, sr, 'started');
      if (!isPracticeRef.current && amIMatchHostRef.current) {
        const roster = buildMatchRosterSnapshot(activeMatchSlotsRef.current, modeRef.current, st);
        void updateMyPresenceRef.current({
          inMatch: true,
          matchMode: modeRef.current,
          scoreLeft: sl,
          scoreRight: sr,
          matchRoster: roster,
        });
      }
    };
    emitLiveMatch();
    const hb = setInterval(emitLiveMatch, 4500);
    return () => clearInterval(hb);
  }, [isOpen, screen, winnerTeam, amIMatchHost, isPractice, scoreLeft, scoreRight, buildMatchRosterSnapshot]);

  // Auto-return to waiting room 20s after single round finishes so nobody leaves the victory screen idle
  useEffect(() => {
    if (!isOpen || screen !== 'playing' || !winnerTeam) return;
    const t = setTimeout(() => {
      if (isPracticeRef.current) {
        returnToWaitingRoomRef.current('practice');
      } else if (amIMatchHostRef.current) {
        returnToWaitingRoomRef.current('host_all');
      } else {
        returnToWaitingRoomRef.current('guest_self');
      }
    }, 20000);
    return () => clearTimeout(t);
  }, [isOpen, screen, winnerTeam]);

  // Connect to Supabase Realtime Presence + Broadcast Channel (skipped automatically for locked spectators & solo practice!)
  useEffect(() => {
    if (!isOpen || !roomCode || skipRoomConnection) return;

    const me = playersRef.current.find((p) => p.id === currentUserId) || playersRef.current[0];
    const now = Date.now();
    const myPresence: PresenceSlotMember = {
      clientId: myClientIdRef.current,
      playerId: me?.id ?? 0,
      name: me?.name ?? 'ผู้กล้า',
      emoji: me?.emoji ?? '🐰',
      desiredSlot: 'L1',
      slotUpdatedAt: now,
      ready: false,
      joinedAt: now,
    };
    mePresenceRef.current = myPresence;
    setPresenceMembers([myPresence]);

    let destroyed = false;
    const localPeers = new Map<string, { member: PresenceSlotMember; seenAt: number }>();
    localPeers.set(myPresence.clientId, { member: myPresence, seenAt: now });

    const handleBroadcastEvent = (event: string, payload: Record<string, unknown>) => {
      if (destroyed || !payload) return;
      if (event === 'room_mode') {
        // Never mutate mode mid-match if a bystander joins the room code while we are playing!
        if (screenRef.current === 'playing') return;
        const nextMode: VbMode = payload.mode === '1v1' ? '1v1' : '2v2';
        setMode(nextMode);
        modeRef.current = nextMode;
      } else if (event === 'start_match') {
        if (isPracticeRef.current) return;
        startFromMatchPacket(payload as unknown as StartMatchPayload);
      } else if (event === 'back_to_waiting') {
        if (isPracticeRef.current) return;
        returnToWaitingRoomRef.current('from_remote');
      } else if (event === 'guest_leave_match') {
        if (isPracticeRef.current || screenRef.current !== 'playing') return;
        const leftSlot = payload.slot as VbSlotId | undefined;
        const leftClientId = String(payload.clientId || '');
        const leftName = String(payload.name || 'ผู้เล่น');
        const leftEmoji = String(payload.emoji || '🏐');
        if (leftSlot && matchStateRef.current) {
          const expected = activeMatchSlotsRef.current[leftSlot]?.clientId;
          if (!expected || expected === leftClientId) {
            const pl = matchStateRef.current.players.find((p) => p.slotId === leftSlot);
            if (pl) pl.isBot = true;
            remoteInputsRef.current[leftSlot] = { ...EMPTY_INPUT };
            showRoomToast(`ℹ️ ${leftEmoji} ${leftName} กลับห้องรอ (บอท AI ลงเล่นแทน)`);
          }
        }
      } else if (event === 'vb_input' && amIMatchHostRef.current && !isPracticeRef.current) {
        const pkt = payload as unknown as EventDrivenGuestInputPacket;
        if (pkt.slot && pkt.input) {
          const expectedClient = activeMatchSlotsRef.current[pkt.slot]?.clientId;
          if (!expectedClient || expectedClient === pkt.clientId) {
            remoteInputsRef.current[pkt.slot] = pkt.input;
          }
        }
      } else if (event === 'vb_state' && !amIMatchHostRef.current && !isPracticeRef.current && screenRef.current === 'playing') {
        const snap = payload.s as CompactNetState | undefined;
        if (!snap) return;
        const hostChanged = Boolean(
          snap.hid && lastRecvHostIdRef.current && snap.hid !== lastRecvHostIdRef.current
        );
        const seqRestarted = !snap.hid && snap.seq <= 5 && lastRecvSeqRef.current > 15;
        if (hostChanged || seqRestarted) {
          lastRecvSeqRef.current = 0;
        }
        if (snap.seq <= lastRecvSeqRef.current) return;
        lastRecvSeqRef.current = snap.seq;
        if (snap.hid) lastRecvHostIdRef.current = snap.hid;

        prevNetSnapRef.current = currNetSnapRef.current || snap;
        currNetSnapRef.current = snap;
        currSnapRecvMsRef.current = performance.now();

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
        if (snap.ph === 'finished' && snap.w && matchStateRef.current) {
          matchStateRef.current.scoreLeft = snap.sl;
          matchStateRef.current.scoreRight = snap.sr;
          matchStateRef.current.phase = 'finished';
          matchStateRef.current.winner = snap.w;
          handleMatchEndOnceRef.current(matchStateRef.current, snap.w);
        }
      }
    };

    const applyMemberListAndMigrate = (list: PresenceSlotMember[]) => {
      const prevHost = currentHostIdRef.current;
      const nextResolved = resolvePresenceSlots(list, modeRef.current);
      setPresenceMembers(list);

      // Safe automatic Host migration if previous Host disconnected!
      if (
        prevHost &&
        nextResolved.hostClientId &&
        prevHost !== nextResolved.hostClientId &&
        !list.some((m) => m.clientId === prevHost)
      ) {
        const newHostObj = list.find((m) => m.clientId === nextResolved.hostClientId);
        const iAmNewHost = nextResolved.hostClientId === myClientIdRef.current;
        lastRecvSeqRef.current = 0;
        lastRecvHostIdRef.current = nextResolved.hostClientId;
        if (screenRef.current === 'playing') {
          setAmIMatchHost(iAmNewHost);
          amIMatchHostRef.current = iAmNewHost;
        }
        if (newHostObj) {
          showRoomToast(`👑 หัวห้องเดิมหลุด — โอนสิทธิ์หัวห้องให้ ${newHostObj.name} อัตโนมัติ!`);
        }
      }
      return nextResolved;
    };

    const markPeerBotMidMatch = (leftClientId: string) => {
      if (screenRef.current === 'playing' && matchStateRef.current) {
        for (const [sid, m] of Object.entries(activeMatchSlotsRef.current)) {
          if (m?.clientId === leftClientId) {
            const pl = matchStateRef.current.players.find((p) => p.slotId === (sid as VbSlotId));
            if (pl) pl.isBot = true;
            remoteInputsRef.current[sid as VbSlotId] = { ...EMPTY_INPUT };
          }
        }
      }
    };

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let localHb: ReturnType<typeof setInterval> | null = null;

    if (url && key) {
      // Dedicated isolated client per room session prevents StrictMode channel reuse crashes!
      const sb = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 40 } },
      });
      const ch = sb.channel(`waist-vb3d-room-${roomCode}`, {
        config: {
          presence: { key: myPresence.clientId },
          broadcast: { self: false, ack: false },
        },
      });

      const syncFromPresence = () => {
        if (destroyed) return;
        const state = ch.presenceState<PresenceSlotMember>();
        const list: PresenceSlotMember[] = [];
        const seen = new Set<string>();
        for (const arr of Object.values(state)) {
          if (Array.isArray(arr) && arr.length > 0) {
            const latest = arr[arr.length - 1];
            if (latest?.clientId && !seen.has(latest.clientId)) {
              seen.add(latest.clientId);
              list.push(latest);
            }
          }
        }
        if (!seen.has(myPresence.clientId) && mePresenceRef.current) {
          list.push(mePresenceRef.current);
        }

        const nextResolved = applyMemberListAndMigrate(list);
        if (nextResolved.hostClientId === myClientIdRef.current) {
          ch.send({ type: 'broadcast', event: 'room_mode', payload: { mode: modeRef.current } });
        }
      };

      ch.on('presence', { event: 'sync' }, syncFromPresence)
        .on('presence', { event: 'leave' }, ({ leftPresences }) => {
          if (destroyed) return;
          syncFromPresence();
          const leftArr = (leftPresences || []) as unknown as PresenceSlotMember[];
          for (const left of leftArr) {
            if (!left?.clientId || left.clientId === myClientIdRef.current) continue;
            showRoomToast(`⚠️ ${left.emoji} ${left.name} ออกจากห้อง`);
            // If mid-match, let smart AI bot take over the disconnected slot so 2v2 never freezes!
            markPeerBotMidMatch(left.clientId);
          }
        })
        .on('broadcast', { event: 'room_mode' }, ({ payload }) => handleBroadcastEvent('room_mode', payload))
        .on('broadcast', { event: 'start_match' }, ({ payload }) => handleBroadcastEvent('start_match', payload))
        .on('broadcast', { event: 'back_to_waiting' }, ({ payload }) => handleBroadcastEvent('back_to_waiting', payload || {}))
        .on('broadcast', { event: 'guest_leave_match' }, ({ payload }) => handleBroadcastEvent('guest_leave_match', payload || {}))
        .on('broadcast', { event: 'vb_input' }, ({ payload }) => handleBroadcastEvent('vb_input', payload))
        .on('broadcast', { event: 'vb_state' }, ({ payload }) => handleBroadcastEvent('vb_state', payload))
        .subscribe(async (status) => {
          if (!destroyed && status === 'SUBSCRIBED' && mePresenceRef.current) {
            await ch.track(mePresenceRef.current);
          }
        });

      supabaseRef.current = sb;
      channelRef.current = ch;
    } else if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      // Multi-tab fallback when Supabase env vars aren't set
      const bc = new BroadcastChannel(`waist-vb3d-local-${roomCode}`);
      bc.onmessage = (ev) => {
        if (destroyed || !ev.data) return;
        const { event, payload } = ev.data;
        if (event === 'presence_ping' && payload?.clientId && payload.clientId !== myClientIdRef.current) {
          const isNew = !localPeers.has(payload.clientId);
          localPeers.set(payload.clientId, { member: payload as PresenceSlotMember, seenAt: Date.now() });
          const nextResolved = applyMemberListAndMigrate(
            Array.from(localPeers.values()).map((v) => v.member)
          );
          if (isNew && nextResolved.hostClientId === myClientIdRef.current) {
            bc.postMessage({ event: 'room_mode', payload: { mode: modeRef.current } });
          }
        } else if (event === 'presence_leave' && payload?.clientId) {
          const gone = localPeers.get(payload.clientId)?.member;
          localPeers.delete(payload.clientId);
          applyMemberListAndMigrate(Array.from(localPeers.values()).map((v) => v.member));
          if (gone) {
            showRoomToast(`⚠️ ${gone.emoji} ${gone.name} ออกจากห้อง`);
            markPeerBotMidMatch(gone.clientId);
          }
        } else {
          handleBroadcastEvent(event, payload);
        }
      };
      bcRef.current = bc;
      bc.postMessage({ event: 'presence_ping', payload: myPresence });
      localHb = setInterval(() => {
        if (destroyed || !mePresenceRef.current) return;
        const t = Date.now();
        localPeers.set(myClientIdRef.current, { member: mePresenceRef.current, seenAt: t });
        bc.postMessage({ event: 'presence_ping', payload: mePresenceRef.current });
        let peerExpired = false;
        for (const [cid, entry] of localPeers.entries()) {
          if (cid !== myClientIdRef.current && t - entry.seenAt > 3500) {
            localPeers.delete(cid);
            peerExpired = true;
            showRoomToast(`⚠️ ${entry.member.name} หลุดออกจากห้อง`);
            markPeerBotMidMatch(cid);
          }
        }
        if (peerExpired) {
          applyMemberListAndMigrate(Array.from(localPeers.values()).map((v) => v.member));
        }
      }, 1100);
    }

    return () => {
      destroyed = true;
      if (localHb) clearInterval(localHb);
      if (
        !isLockedSpectatorRef.current &&
        !isPracticeRef.current &&
        currentHostIdRef.current === myClientIdRef.current
      ) {
        const stillHasPeers =
          screenRef.current === 'playing' &&
          Object.values(activeMatchSlotsRef.current).some(
            (m) => m && m.clientId !== myClientIdRef.current
          );
        if (!stillHasPeers) {
          onLobbyBroadcastRef.current?.({
            roomCode,
            mode: modeRef.current,
            hostUserId: currentUserId || 0,
            hostName: me?.name || 'เพื่อน',
            hostEmoji: me?.emoji || '🏐',
            count: 0,
            max: modeRef.current === '2v2' ? 4 : 2,
            status: 'closed',
            roster: [],
          });
        }
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
  }, [isOpen, roomCode, skipRoomConnection]);

  const updateMyPresence = useCallback(
    async (
      patch: Partial<
        Pick<
          PresenceSlotMember,
          'desiredSlot' | 'ready' | 'inMatch' | 'matchMode' | 'scoreLeft' | 'scoreRight' | 'matchRoster'
        >
      >
    ) => {
      if (!mePresenceRef.current) return;
      const slotChanged =
        patch.desiredSlot !== undefined && patch.desiredSlot !== mePresenceRef.current.desiredSlot;
      const updated: PresenceSlotMember = {
        ...mePresenceRef.current,
        ...patch,
        slotUpdatedAt: slotChanged ? Date.now() : mePresenceRef.current.slotUpdatedAt,
      };
      mePresenceRef.current = updated;
      setPresenceMembers((prev) =>
        prev.map((m) => (m.clientId === updated.clientId ? updated : m))
      );
      if (channelRef.current) {
        await channelRef.current.track(updated);
      }
      if (bcRef.current) {
        bcRef.current.postMessage({ event: 'presence_ping', payload: updated });
      }
    },
    []
  );
  updateMyPresenceRef.current = updateMyPresence;

  // Event-Driven Local Input Updater: Guests transmit ONLY on keydown/keyup transitions!
  const applyInputChange = useCallback(
    (patch: Partial<VbInputState>) => {
      const next: VbInputState = { ...localInputRef.current, ...patch };
      if (inputsMatch(localInputRef.current, next)) return;
      localInputRef.current = next;

      if (!isPracticeRef.current && !amIMatchHostRef.current && !inputsMatch(lastSentInputRef.current, next)) {
        lastSentInputRef.current = { ...next };
        guestInputSeqRef.current += 1;
        const pkt: EventDrivenGuestInputPacket = {
          clientId: myClientIdRef.current,
          slot: myPlayingSlotRef.current,
          seq: guestInputSeqRef.current,
          input: { ...next },
        };
        sendBroadcast('vb_input', pkt);
      }
    },
    [sendBroadcast]
  );

  // Keyboard bindings while playing (A/D or Left/Right, W or Up = Jump, S or Down = Steep Smash, Space/Enter/Shift/Z = Dive or Power Spike!)
  useEffect(() => {
    if (!isOpen || screen !== 'playing') return;

    const resolveField = (code: string): keyof VbInputState | null => {
      if (code === 'KeyA' || code === 'ArrowLeft') return 'left';
      if (code === 'KeyD' || code === 'ArrowRight') return 'right';
      if (code === 'KeyW' || code === 'ArrowUp') return 'jump';
      if (code === 'KeyS' || code === 'ArrowDown') return 'down';
      if (
        code === 'Space' ||
        code === 'Enter' ||
        code === 'NumpadEnter' ||
        code === 'ShiftLeft' ||
        code === 'ShiftRight' ||
        code === 'KeyZ' ||
        code === 'KeyJ' ||
        code === 'KeyK'
      ) {
        return 'action';
      }
      return null;
    };

    const kd = (e: KeyboardEvent) => {
      const f = resolveField(e.code);
      if (!f) return;
      e.preventDefault();
      if (e.repeat) return;
      applyInputChange({ [f]: true });
    };
    const ku = (e: KeyboardEvent) => {
      const f = resolveField(e.code);
      if (!f) return;
      e.preventDefault();
      applyInputChange({ [f]: false });
    };
    const onBlur = () => {
      applyInputChange({ ...EMPTY_INPUT });
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
  }, [isOpen, screen, applyInputChange]);

  const lockedShowcaseSig = useMemo(() => {
    if (!lockedMatchInfo) return '';
    const rKey = (lockedMatchInfo.roster || [])
      .map((r) => `${r.slotId}:${r.playerId}:${r.name}:${r.isBot ? 1 : 0}`)
      .join('|');
    return `${lockedMatchInfo.mode}|${rKey}`;
  }, [lockedMatchInfo]);

  // Main 3D Beach Volleyball Scene with YOUR OWN 3D Arena Characters + 60FPS Host / 20Hz Sync / 60FPS Guest Lerp + Zero-Quota Locked Showcase!
  useEffect(() => {
    const show3dScene =
      screen === 'playing' || (isLockedSpectator && screen !== 'leaderboard');
    if (!isOpen || !show3dScene || !canvasWrapRef.current) return;
    const container = canvasWrapRef.current;
    const labelsLayer = labelsOverlayRef.current;
    container.innerHTML = '';
    if (labelsLayer) labelsLayer.innerHTML = '';

    const showcaseInfo = isLockedSpectatorRef.current ? lockedMatchInfoRef.current : null;
    const isShowcaseOnly = Boolean(showcaseInfo) && screenRef.current !== 'playing';
    const sceneMode: VbMode = showcaseInfo && isShowcaseOnly ? showcaseInfo.mode : mode;
    const activeSlotIds: VbSlotId[] = sceneMode === '2v2' ? ['L1', 'L2', 'R1', 'R2'] : ['L1', 'R1'];
    const slotsSnap = activeMatchSlotsRef.current;
    const botFlags: Record<VbSlotId, boolean> = isShowcaseOnly
      ? { L1: true, L2: true, R1: true, R2: true }
      : {
        L1: !slotsSnap.L1,
        L2: !slotsSnap.L2,
        R1: !slotsSnap.R1,
        R2: !slotsSnap.R2,
      };

    const match = createInitialMatchState(sceneMode, botFlags, 'left');
    if (!isShowcaseOnly) {
      matchStateRef.current = match;
    }
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
      const reqHalfW = court.halfWidth + 1.15;
      const reqHalfH = isPortrait ? 6.4 : 5.6;
      const zForWidth = reqHalfW / (tanHalfFov * aspect);
      const zForHeight = reqHalfH / tanHalfFov;
      const camZ = Math.max(zForWidth, zForHeight);
      const lookY = isPortrait ? 0.55 : 2.25;
      const camY = isPortrait ? 3.6 + camZ * 0.06 : sceneMode === '2v2' ? 4.8 : 4.3;
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

    // 3D Beach Volleyball + Shadow + Fiery Red/Orange Spike Glow
    const ballTex = buildVolleyballTexture();
    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(court.ballRadius, 22, 18),
      new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.35 })
    );
    ballMesh.castShadow = true;
    scene.add(ballMesh);

    const ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(court.ballRadius * 1.15, 20),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.44 })
    );
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.position.y = 0.03;
    scene.add(ballShadow);

    const spikeGlow = new THREE.Mesh(
      new THREE.SphereGeometry(court.ballRadius * 1.4, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.58 })
    );
    spikeGlow.visible = false;
    ballMesh.add(spikeGlow);

    const trailHistory: Array<{ x: number; y: number }> = [];
    const trailMeshes = [0.44, 0.28, 0.15].map((op, ti) => {
      const tm = new THREE.Mesh(
        new THREE.SphereGeometry(court.ballRadius * (0.9 - ti * 0.14), 12, 10),
        new THREE.MeshBasicMaterial({ color: ti === 0 ? 0xef4444 : 0xfacc15, transparent: true, opacity: op })
      );
      tm.visible = false;
      scene.add(tm);
      return tm;
    });

    // Build Real 3D Arena Player Meshes with ALL Equipped Cosmetics!
    const activeMySlot = myPlayingSlotRef.current;
    const myTeam: VbTeam = activeMySlot.startsWith('L') ? 'left' : 'right';

    interface SlotVisual {
      slotId: VbSlotId;
      root: THREE.Group;
      charParts: CharacterMeshParts;
      ring: THREE.Mesh;
      shadowDisc: THREE.Mesh;
      tagEl: HTMLDivElement | null;
      zOffset: number;
    }

    const visuals: SlotVisual[] = activeSlotIds.map((slotId, idx) => {
      const wrapper = new THREE.Group();
      const showcaseSlot =
        isShowcaseOnly && showcaseInfo
          ? (showcaseInfo.roster || []).find((r) => r.slotId === slotId)
          : undefined;
      const member = isShowcaseOnly ? undefined : slotsSnap[slotId];
      const curPlayers = playersRef.current;
      const lookupPlayerId = isShowcaseOnly ? showcaseSlot?.playerId : member?.playerId;
      const found = lookupPlayerId
        ? curPlayers.find((p) => p.id === lookupPlayerId) ||
        curPlayers[(idx + 1) % Math.max(1, curPlayers.length)]
        : curPlayers[(idx + 1) % Math.max(1, curPlayers.length)];
      const team: VbTeam = slotId.startsWith('L') ? 'left' : 'right';

      const charParts = buildCharacterMesh({
        colorHex: found?.colorHex || (team === 'left' ? '#38BDF8' : '#FB7185'),
        accessory: 'headband',
        bandColor: team === 'left' ? '#38BDF8' : '#EF4444',
        bellyScale: found?.bellyScale ?? found?.bmiBellyScale ?? 1,
        muscleScale: found?.muscleScale ?? 1,
        showDumbbells: false,
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

      const isMe = !isShowcaseOnly && slotId === activeMySlot && Boolean(member);
      const isTeammate = !isShowcaseOnly ? !isMe && team === myTeam : team === 'left';
      const ringColor = isMe ? 0xfacc15 : isTeammate ? 0x38bdf8 : 0xf43f5e;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.56, 0.72, 24),
        new THREE.MeshBasicMaterial({ color: ringColor, side: THREE.DoubleSide, transparent: true, opacity: 0.9 })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.035;
      scene.add(ring);

      const shadowDisc = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 16),
        new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.34 })
      );
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = 0.025;
      scene.add(shadowDisc);

      let tagEl: HTMLDivElement | null = null;
      if (labelsLayer) {
        tagEl = document.createElement('div');
        tagEl.className = 'absolute -translate-x-1/2 -translate-y-full pointer-events-none whitespace-nowrap';
        const displayName = isShowcaseOnly
          ? showcaseSlot?.name || found?.name || slotId
          : member
            ? member.name
            : `AI ${found?.name || slotId}`;
        const displayEmoji = isShowcaseOnly
          ? showcaseSlot?.emoji || found?.emoji || '🏐'
          : member?.emoji || '🤖';
        const pillCls =
          team === 'left'
            ? 'bg-sky-950/90 border-sky-400 text-sky-100'
            : 'bg-rose-950/90 border-rose-400 text-rose-100';
        tagEl.innerHTML = `
          <div class="px-2 py-0.5 rounded-full border ${isMe ? 'ring-2 ring-amber-300' : ''} ${pillCls} text-[10px] sm:text-[11px] font-extrabold shadow">
            ${displayEmoji} ${displayName}${isMe ? ' (คุณ)' : isShowcaseOnly && !showcaseSlot?.isBot ? ' • กำลังเล่น' : ''}
          </div>
        `;
        labelsLayer.appendChild(tagEl);
      }

      const zOffset = sceneMode === '2v2' ? (slotId.endsWith('1') ? 0.44 : -0.44) : 0;
      scene.add(wrapper);

      return { slotId, root: wrapper, charParts, ring, shadowDisc, tagEl, zOffset };
    });

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      updateCameraForAspect(w, h);
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    const projVec = new THREE.Vector3();
    let frameId = 0;
    let elapsed = 0;
    let physAccum = 0;
    let lastBroadcastMs = 0;
    let hostSeq = 0;
    let pendingEv: CompactNetState['ev'] = undefined;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (typeof document !== 'undefined' && document.hidden) {
        clock.getDelta();
        return;
      }

      const delta = Math.min(0.05, clock.getDelta());
      elapsed += delta;
      const st = isShowcaseOnly ? match : matchStateRef.current;
      if (!st) return;

      const nowMs = performance.now();

      if (isShowcaseOnly) {
        // Zero-network local 60FPS showcase of the active players' 3D characters rallying on court!
        physAccum += delta;
        while (physAccum >= FIXED_DT) {
          physAccum -= FIXED_DT;
          const stepInputs: Record<VbSlotId, VbInputState> = {
            L1: { ...EMPTY_INPUT },
            L2: { ...EMPTY_INPUT },
            R1: { ...EMPTY_INPUT },
            R2: { ...EMPTY_INPUT },
          };
          for (const p of st.players) {
            stepInputs[p.slotId] = computeBotInput(st, p, 'normal');
          }
          stepVolleyballMatch(st, stepInputs, FIXED_DT);
          if (st.phase === 'finished') {
            st.scoreLeft = 0;
            st.scoreRight = 0;
            st.winner = null;
            resetRallyPositions(st, 'left');
          }
        }
      } else if (amIMatchHostRef.current || isPracticeRef.current) {
        // Host-Authoritative Fixed-60FPS Physics Simulation
        physAccum += delta;
        while (physAccum >= FIXED_DT) {
          physAccum -= FIXED_DT;
          const stepInputs: Record<VbSlotId, VbInputState> = {
            L1: { ...EMPTY_INPUT },
            L2: { ...EMPTY_INPUT },
            R1: { ...EMPTY_INPUT },
            R2: { ...EMPTY_INPUT },
          };

          for (const p of st.players) {
            if (p.slotId === activeMySlot && !p.isBot) {
              stepInputs[p.slotId] = localInputRef.current;
            } else if (p.isBot) {
              stepInputs[p.slotId] = computeBotInput(st, p, botDifficultyRef.current);
            } else {
              stepInputs[p.slotId] = remoteInputsRef.current[p.slotId] || EMPTY_INPUT;
            }
          }

          const ev = stepVolleyballMatch(st, stepInputs, FIXED_DT);
          if (ev.spike) {
            playVbSound('spike', mutedRef.current);
            setShakeActive(true);
            setTimeout(() => setShakeActive(false), 260);
            pendingEv = { ...pendingEv, sp: 1 };
          } else if (ev.hit) {
            playVbSound('hit', mutedRef.current);
            pendingEv = { ...pendingEv, h: 1 };
          }
          if (ev.dive) {
            playVbSound('dive', mutedRef.current);
            pendingEv = { ...pendingEv, dv: 1 };
          }
          if (ev.score) {
            playVbSound('score', mutedRef.current);
            setScoreLeft(st.scoreLeft);
            setScoreRight(st.scoreRight);
            setPointBanner(ev.score === 'left' ? '🔥 ทีมซ้ายได้แต้ม!' : '⚡ ทีมขวาได้แต้ม!');
            setTimeout(() => setPointBanner(''), 1050);
            pendingEv = { ...pendingEv, sc: ev.score };
            if (!ev.win) {
              broadcastActiveMatchToIslandRef.current(st.scoreLeft, st.scoreRight, 'started');
            }
          }
          if (ev.win) {
            pendingEv = { ...pendingEv, win: ev.win };
            handleMatchEndOnceRef.current(st, ev.win);
          }
        }

        // Broadcast consolidated court state at 20 Hz ONLY when active remote human guests are playing!
        const hasActiveRemoteHumanGuest =
          !isPracticeRef.current &&
          Object.entries(activeMatchSlotsRef.current).some(([sid, mem]) => {
            if (!mem || mem.clientId === myClientIdRef.current) return false;
            const pl = st.players.find((p) => p.slotId === (sid as VbSlotId));
            return Boolean(pl && !pl.isBot);
          });

        if (hasActiveRemoteHumanGuest && (st.phase !== 'finished' || Boolean(pendingEv?.win))) {
          const urgent = Boolean(pendingEv?.sc || pendingEv?.win);
          if (urgent || nowMs - lastBroadcastMs >= HOST_BROADCAST_INTERVAL_MS) {
            lastBroadcastMs = nowMs;
            hostSeq += 1;
            const snap: CompactNetState = {
              seq: hostSeq,
              hid: myClientIdRef.current,
              ph: st.phase,
              pt: r2(st.phaseTimer),
              sl: st.scoreLeft,
              sr: st.scoreRight,
              sv: st.servingTeam,
              ls: st.lastScorer,
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
                bot: p.isBot ? 1 : undefined,
              })),
              ev: pendingEv,
            };
            sendBroadcastRef.current('vb_state', { s: snap });
            pendingEv = undefined;
          }
        } else {
          pendingEv = undefined;
        }
      } else {
        // Guest: Smooth 60 FPS Client-Side Linear Interpolation (Lerp) between 20Hz Host Snapshots!
        const curr = currNetSnapRef.current;
        if (curr) {
          const prev = prevNetSnapRef.current || curr;
          st.phase = curr.ph;
          st.phaseTimer = curr.pt;
          st.scoreLeft = curr.sl;
          st.scoreRight = curr.sr;
          st.servingTeam = curr.sv;
          st.lastScorer = curr.ls;
          st.winner = curr.w;
          st.ball.isSpiked = curr.bsp;

          const elapsedSnapMs = Math.max(0, nowMs - currSnapRecvMsRef.current);
          const alpha = elapsedSnapMs / 55;
          const teleported =
            Math.hypot(curr.bx - prev.bx, curr.by - prev.by) > 4.2 ||
            (curr.ph === 'serve_wait' && prev.ph !== 'serve_wait');

          if (teleported) {
            st.ball.x = curr.bx;
            st.ball.y = curr.by;
          } else if (alpha <= 1.0) {
            st.ball.x = prev.bx + (curr.bx - prev.bx) * alpha;
            st.ball.y = prev.by + (curr.by - prev.by) * alpha;
          } else {
            const extraSec = Math.min(0.055, (elapsedSnapMs - 55) / 1000);
            st.ball.x = Math.max(
              -court.halfWidth + court.ballRadius,
              Math.min(court.halfWidth - court.ballRadius, curr.bx + curr.bvx * extraSec)
            );
            st.ball.y = Math.max(court.ballRadius, curr.by + curr.bvy * extraSec);
          }
          st.ball.vx = curr.bvx;
          st.ball.vy = curr.bvy;
          st.ball.spin += curr.bvx * delta * 0.9;

          for (const np of curr.pl) {
            const lp = st.players.find((p) => p.slotId === np.s);
            if (!lp) continue;
            const pp = prev.pl.find((p) => p.s === np.s) || np;
            const pTeleported =
              Math.hypot(np.x - pp.x, np.y - pp.y) > 3.5 ||
              (curr.ph === 'serve_wait' && prev.ph !== 'serve_wait');

            if (pTeleported) {
              lp.x = np.x;
              lp.y = np.y;
            } else if (alpha <= 1.0) {
              lp.x = pp.x + (np.x - pp.x) * alpha;
              lp.y = Math.max(0, pp.y + (np.y - pp.y) * alpha);
            } else {
              const extraSec = Math.min(0.05, (elapsedSnapMs - 55) / 1000);
              lp.x = np.x + np.vx * extraSec;
              lp.y = Math.max(0, np.y + np.vy * extraSec);
            }
            lp.vx = np.vx;
            lp.vy = np.vy;
            lp.facing = np.f;
            lp.diveTimer = np.dt;
            lp.diveDir = np.dd;
            lp.spikeFlash = np.sf;
            lp.isBot = np.bot === 1;
          }
        }
      }

      // Sync 3D Ball & Ground Shadow
      const renderBx = st.ball.x;
      const renderBy = Math.max(st.court.ballRadius, st.ball.y);
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
      const hFactor = Math.max(0.32, 1 - renderBy / 11);
      ballShadow.scale.setScalar(hFactor);
      (ballShadow.material as THREE.MeshBasicMaterial).opacity = 0.46 * hFactor;

      // Sync 3D RPG Characters + Shadows + Celebration Dance + Floating Name Tags
      const cw = container.clientWidth || window.innerWidth;
      const ch = container.clientHeight || window.innerHeight;

      for (const vis of visuals) {
        const p = st.players.find((pl) => pl.slotId === vis.slotId);
        if (!p) continue;
        const isScoringTeam =
          (st.phase === 'point_pause' && st.lastScorer === p.team) ||
          (st.phase === 'finished' && st.winner === p.team);
        const celebrateHop = isScoringTeam ? Math.abs(Math.sin(elapsed * 11 + p.x)) * 0.35 : 0;

        const rx = p.x;
        const ry = Math.max(0, p.y) + celebrateHop;
        vis.root.position.set(rx, ry, vis.zOffset);
        vis.ring.position.set(rx, 0.035, vis.zOffset);
        vis.shadowDisc.position.set(rx, 0.025, vis.zOffset);
        const pShadowScale = Math.max(0.45, 1 - ry / 7.5);
        vis.shadowDisc.scale.setScalar(pShadowScale);

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
          const armsUp = ry > 0.2 || isScoringTeam;
          vis.charParts.armL.rotation.z = armsUp ? 2.4 : -runCycle * 0.8;
          vis.charParts.armR.rotation.z = armsUp ? 2.4 : runCycle * 0.8;
        }

        if (vis.tagEl) {
          projVec.set(rx, ry + 2.05, vis.zOffset);
          projVec.project(camera);
          if (projVec.z < 1) {
            const sx = (projVec.x * 0.5 + 0.5) * cw;
            const sy = (-projVec.y * 0.5 + 0.5) * ch;
            vis.tagEl.style.left = `${sx.toFixed(1)}px`;
            vis.tagEl.style.top = `${sy.toFixed(1)}px`;
            vis.tagEl.style.opacity = '1';
          } else {
            vis.tagEl.style.opacity = '0';
          }
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
  }, [isOpen, screen, isLockedSpectator, lockedShowcaseSig, mode, qualityMode, matchRunId]);

  if (!isOpen) return null;

  const maxPlayers = mode === '2v2' ? 4 : 2;
  const joinedCount = Object.keys(lobbyResolved.slots).length;
  const amIAssignedSlot = Object.values(lobbyResolved.slots).some(
    (m) => m?.clientId === myClientIdRef.current
  );
  const leftSlotIds: VbSlotId[] = mode === '2v2' ? ['L1', 'L2'] : ['L1'];
  const rightSlotIds: VbSlotId[] = mode === '2v2' ? ['R1', 'R2'] : ['R1'];
  const myPlayingTeam: VbTeam = myPlayingSlot.startsWith('L') ? 'left' : 'right';
  const nonHostAllReady = presenceMembers.every(
    (m) => m.clientId === lobbyResolved.hostClientId || m.ready
  );
  const isDeuce = scoreLeft >= VB_WIN_SCORE - 1 && scoreRight >= VB_WIN_SCORE - 1;

  const handleHostStart = (fillBots: boolean) => {
    if (!amILobbyHost || isLockedSpectator) return;
    if (!fillBots && !lobbyResolved.allReady) return;
    const pkt: StartMatchPayload = {
      matchUid: `${roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode,
      hostClientId: myClientIdRef.current,
      slots: lobbyResolved.slots,
      startedAt: Date.now(),
    };
    sendBroadcast('start_match', pkt);
    startFromMatchPacket(pkt);
  };

  const handleStartPracticeVsBot = () => {
    if (isLockedSpectator) return;
    const me = players.find((p) => p.id === currentUserId) || players[0];
    const myMember: PresenceSlotMember = {
      clientId: myClientIdRef.current,
      playerId: me?.id ?? 0,
      name: me?.name ?? 'ผู้กล้า',
      emoji: me?.emoji ?? '🐰',
      desiredSlot: 'L1',
      slotUpdatedAt: Date.now(),
      ready: true,
      joinedAt: Date.now(),
    };
    setIsPractice(true);
    isPracticeRef.current = true;
    setActiveMatchSlots({ L1: myMember });
    activeMatchSlotsRef.current = { L1: myMember };
    setMyPlayingSlot('L1');
    myPlayingSlotRef.current = 'L1';
    setAmIMatchHost(true);
    amIMatchHostRef.current = true;
    winHandledRef.current = false;
    rewardClaimedRef.current = false;
    matchSavedRef.current = false;
    winnerTeamRef.current = null;
    activeMatchUidRef.current = `practice-${Date.now()}`;
    localInputRef.current = { ...EMPTY_INPUT };
    lastSentInputRef.current = { ...EMPTY_INPUT };
    slidePointerIdRef.current = null;
    setScoreLeft(0);
    setScoreRight(0);
    setWinnerTeam(null);
    setPointBanner('');
    setRewardStatus('');
    setShakeActive(false);
    setMatchRunId((n) => n + 1);
    screenRef.current = 'playing';
    setScreen('playing');
    broadcastActiveMatchToIslandRef.current(0, 0, 'started');
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
    applyInputChange({
      left: dx < -12,
      right: dx > 12,
      down: dy > 16,
    });
  };

  const handleSlideEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (slidePointerIdRef.current !== e.pointerId) return;
    slidePointerIdRef.current = null;
    setSlideKnobDom(0, 0);
    applyInputChange({ left: false, right: false, down: false });
  };

  return (
    <div className={`fixed inset-0 z-50 bg-slate-950/90 flex flex-col overflow-hidden ${shakeActive ? 'shake-active' : ''}`}>
      {/* Automatic Disconnect / Host Migration Alert Banner */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[92vw]">
          <div className="rpg-banner border-2 border-amber-300 rounded-2xl px-4 py-2 text-xs sm:text-sm font-extrabold text-amber-200 shadow-2xl">
            {toastMsg}
          </div>
        </div>
      )}

      {screen === 'leaderboard' ? (
        <div className="w-full h-dvh overflow-y-auto flex items-center justify-center p-3">
          <LeaderboardPanel onBack={() => setScreen('waiting')} />
        </div>
      ) : isLockedSpectator && lockedMatchInfo ? (
        <div className="relative w-full h-dvh overflow-hidden select-none">
          {/* Live 3D Beach Court Showcase of the Active Players' 3D Characters (0 Supabase messages!) */}
          <div ref={canvasWrapRef} className="fixed inset-0 w-full h-full touch-none" />
          <div ref={labelsOverlayRef} className="fixed inset-0 pointer-events-none z-10 overflow-hidden" />

          {/* Top Live Spectator Scoreboard */}
          <div className="fixed top-2 sm:top-3 inset-x-2 sm:inset-x-4 pt-safe z-20 flex items-center justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCloseToIsland}
                className="rpg-panel px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-extrabold text-amber-100 hover:bg-rose-600 hover:text-white cursor-pointer"
              >
                ← 🏖️ กลับเกาะหลัก
              </button>
            </div>

            <div className="pointer-events-auto rpg-banner rounded-2xl px-3 sm:px-5 py-1.5 flex items-center gap-2 sm:gap-3.5 shadow-xl border-2 border-amber-300">
              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                🔴 LIVE
              </span>
              <div className="flex items-center gap-2 font-[family-name:var(--font-kanit)] font-black text-xl sm:text-2xl">
                <span className="bg-sky-400 text-black px-2.5 py-0.5 rounded-lg min-w-[34px] text-center">
                  {lockedMatchInfo.scoreLeft ?? 0}
                </span>
                <span className="text-amber-300 text-base">⚡</span>
                <span className="bg-rose-500 text-white px-2.5 py-0.5 rounded-lg min-w-[34px] text-center">
                  {lockedMatchInfo.scoreRight ?? 0}
                </span>
              </div>
              <span className="hidden sm:inline text-xs font-extrabold text-amber-200">
                โหมด {lockedMatchInfo.mode.toUpperCase()}
              </span>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setScreen('leaderboard')}
                className="rpg-panel px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-extrabold text-amber-200 hover:bg-amber-400 hover:text-slate-950 cursor-pointer"
              >
                🏆 <span className="hidden sm:inline">อันดับ</span>
              </button>
            </div>
          </div>

          {/* Bottom Compact Locked Court Banner showing who is playing */}
          <div className="fixed bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-4 pb-safe z-30 flex justify-center pointer-events-none">
            <div className="pointer-events-auto rpg-stone-frame rounded-2xl max-w-xl w-full p-3.5 sm:p-4 space-y-2.5 shadow-2xl border-2 border-amber-400/90 bg-slate-950/90 backdrop-blur-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-rose-600 border border-amber-300 flex items-center justify-center text-base shadow">
                    🔒
                  </span>
                  <div>
                    <h3 className="font-[family-name:var(--font-kanit)] text-sm sm:text-base font-extrabold text-amber-300 leading-tight">
                      สนามไม่ว่าง — กำลังแข่งขันอยู่ (ล็อกเล่นทีละ 1 รอบ)
                    </h3>
                    <p className="text-[11px] text-amber-100/85 font-semibold">
                      จำกัดทีละ 1 คู่เพื่อแบ่งโควตาเซิร์ฟเวอร์ให้เพื่อนๆ เล่นกิจกรรมอื่นบนเกาะได้ลื่นไหล • จบรอบนี้เข้าต่อได้ทันที!
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-sky-950/80 border border-sky-400/70 rounded-xl px-2.5 py-1.5">
                  <div className="text-[10px] font-extrabold text-sky-300">🔵 ทีมซ้ายกำลังลงสนาม</div>
                  <div className="font-extrabold text-white truncate">
                    {(lockedMatchInfo.roster || [])
                      .filter((r) => r.slotId.startsWith('L'))
                      .map((r) => `${r.emoji} ${r.name}`)
                      .join(' • ') || `${lockedMatchInfo.hostEmoji} ${lockedMatchInfo.hostName}`}
                  </div>
                </div>
                <div className="bg-rose-950/80 border border-rose-400/70 rounded-xl px-2.5 py-1.5">
                  <div className="text-[10px] font-extrabold text-rose-300">🔴 ทีมขวากำลังลงสนาม</div>
                  <div className="font-extrabold text-white truncate">
                    {(lockedMatchInfo.roster || [])
                      .filter((r) => r.slotId.startsWith('R'))
                      .map((r) => `${r.emoji} ${r.name}`)
                      .join(' • ') || '🤖 บอท AI'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="flex-1 py-2 px-3 rounded-xl bg-slate-800/90 border border-slate-600 text-slate-300 text-xs font-extrabold cursor-not-allowed"
                >
                  ⏳ รอคู่นี้แข่งถึง {VB_WIN_SCORE} แต้มก่อนนะ (จะปลดล็อกอัตโนมัติ)
                </button>
                <button
                  type="button"
                  onClick={handleCloseToIsland}
                  className="rpg-btn-gold py-2 px-3.5 rounded-xl text-xs font-extrabold cursor-pointer shrink-0"
                >
                  🏖️ ไปเล่นกิจกรรมอื่นก่อน
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : screen === 'waiting' ? (
        <div className="w-full h-dvh overflow-y-auto flex items-center justify-center p-3 sm:p-5 pt-safe pb-safe">
          <div className="rpg-stone-frame rounded-2xl max-w-lg w-full p-4 sm:p-5 space-y-3.5 relative my-auto">
            <button
              type="button"
              onClick={handleCloseToIsland}
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
                  ใช้ตัวละคร 3D ของคุณลงสนาม • แข่ง {VB_WIN_SCORE} แต้ม Win-by-2 (ชนะรับ +5 💰)
                </p>
              </div>
            </div>

            {/* Single Shared Island Court Notice + Leaderboard */}
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900/90 border border-amber-500/40 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-black">
                  🏝️ สนามเดียวของเกาะ
                </span>
                <span className="text-[11px] font-bold text-amber-100/90">
                  เล่นได้ทีละ 1 รอบ (เผื่อโควตาให้กิจกรรมอื่น)
                </span>
              </div>

              <button
                type="button"
                onClick={() => setScreen('leaderboard')}
                className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-400/60 text-[11px] font-extrabold text-amber-200 hover:bg-amber-400 hover:text-black cursor-pointer"
              >
                🏆 อันดับ
              </button>
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
                  disabled={!amILobbyHost}
                  onClick={() => {
                    if (!amILobbyHost || mode === opt.id) return;
                    setMode(opt.id);
                    modeRef.current = opt.id;
                    sendBroadcast('room_mode', { mode: opt.id });
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

            {/* Live Presence Waiting Status */}
            <div
              className={`border-2 rounded-xl p-2.5 text-center space-y-0.5 ${lobbyResolved.allReady
                  ? 'bg-emerald-950/75 border-emerald-400/80'
                  : 'bg-sky-950/75 border-sky-400/70'
                }`}
            >
              <div className="font-[family-name:var(--font-kanit)] text-sm sm:text-base font-extrabold text-amber-300">
                {lobbyResolved.allReady
                  ? `✅ ทุกคนพร้อมแล้ว! (${joinedCount}/${maxPlayers} คน)`
                  : `🟢 ออนไลน์ในห้องรอ (${joinedCount}/${maxPlayers} คน) • เลือกฝั่งแล้วกด Ready!`}
              </div>
              <div className="text-[11px] text-sky-200 font-semibold">
                เพื่อนเดินเข้าสนามวอลเลย์บอลบนเกาะแล้วกดเข้าห้อง จะมาโผล่ในห้องรอนี้อัตโนมัติ!
              </div>
            </div>

            {/* Team Slots Display & Picker: Blue Left (L1, L2) vs Red Right (R1, R2) */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-slate-900/85 border-2 border-sky-400/70 rounded-xl p-2.5 space-y-2">
                <div className="text-xs font-extrabold text-sky-300 text-center">
                  🔵 ทีมซ้าย ({mode === '2v2' ? 'P1, P2' : 'P1'})
                </div>
                {leftSlotIds.map((sid, idx) => {
                  const m = lobbyResolved.slots[sid];
                  const isMe = m?.clientId === myClientIdRef.current;
                  const isHostSlot = m?.clientId === lobbyResolved.hostClientId;
                  return (
                    <div
                      key={sid}
                      className={`rounded-xl p-2.5 border text-center space-y-1 ${m
                          ? isMe
                            ? 'bg-sky-500/25 border-amber-300 text-sky-100'
                            : 'bg-sky-500/15 border-sky-400/70 text-sky-100'
                          : 'bg-slate-950/70 border-dashed border-slate-600 text-slate-400'
                        }`}
                    >
                      {m ? (
                        <>
                          <div className="text-xs font-extrabold truncate">
                            {isHostSlot ? '👑 ' : ''}
                            {m.emoji} {m.name} {isMe ? '(คุณ)' : ''}
                          </div>
                          <div className="text-[10px] font-bold">
                            {isHostSlot || m.ready ? (
                              <span className="text-emerald-300">✅ พร้อมแข่ง</span>
                            ) : (
                              <span className="text-amber-300">⏳ รอกดพร้อม...</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void updateMyPresence({ desiredSlot: sid, ready: false })
                          }
                          className="w-full py-1 rounded-lg bg-sky-600/30 hover:bg-sky-500/50 text-sky-200 text-[11px] font-extrabold cursor-pointer"
                        >
                          + ย้ายมา P{idx + 1} (ฝั่งฟ้า)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-900/85 border-2 border-rose-400/70 rounded-xl p-2.5 space-y-2">
                <div className="text-xs font-extrabold text-rose-300 text-center">
                  🔴 ทีมขวา ({mode === '2v2' ? 'P3, P4' : 'P3'})
                </div>
                {rightSlotIds.map((sid, idx) => {
                  const m = lobbyResolved.slots[sid];
                  const isMe = m?.clientId === myClientIdRef.current;
                  const isHostSlot = m?.clientId === lobbyResolved.hostClientId;
                  return (
                    <div
                      key={sid}
                      className={`rounded-xl p-2.5 border text-center space-y-1 ${m
                          ? isMe
                            ? 'bg-rose-500/25 border-amber-300 text-rose-100'
                            : 'bg-rose-500/15 border-rose-400/70 text-rose-100'
                          : 'bg-slate-950/70 border-dashed border-slate-600 text-slate-400'
                        }`}
                    >
                      {m ? (
                        <>
                          <div className="text-xs font-extrabold truncate">
                            {isHostSlot ? '👑 ' : ''}
                            {m.emoji} {m.name} {isMe ? '(คุณ)' : ''}
                          </div>
                          <div className="text-[10px] font-bold">
                            {isHostSlot || m.ready ? (
                              <span className="text-emerald-300">✅ พร้อมแข่ง</span>
                            ) : (
                              <span className="text-amber-300">⏳ รอกดพร้อม...</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            void updateMyPresence({ desiredSlot: sid, ready: false })
                          }
                          className="w-full py-1 rounded-lg bg-rose-600/30 hover:bg-rose-500/50 text-rose-200 text-[11px] font-extrabold cursor-pointer"
                        >
                          + ย้ายมา P{idx + 3} (ฝั่งแดง)
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ready / Start Buttons */}
            {amILobbyHost ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={!lobbyResolved.allReady}
                  onClick={() => handleHostStart(false)}
                  className="w-full rpg-btn-gold font-[family-name:var(--font-kanit)] py-3 rounded-xl text-sm sm:text-base font-extrabold cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  {lobbyResolved.allReady
                    ? `🏐 เริ่มแข่ง ${mode === '2v2' ? '2 vs 2' : '1 vs 1'} เลย! (START)`
                    : lobbyResolved.allFilled
                      ? '⏳ รอเพื่อนกดปุ่ม Ready ให้ครบทุกคน...'
                      : `⏳ รอเพื่อนเข้าให้ครบ ${maxPlayers} คน (${joinedCount}/${maxPlayers})`}
                </button>

                {!lobbyResolved.allFilled && joinedCount >= 2 && nonHostAllReady && (
                  <button
                    type="button"
                    onClick={() => handleHostStart(true)}
                    className="w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-300 text-white text-xs font-extrabold cursor-pointer"
                  >
                    🤖 เติมบอท AI ในช่องที่ว่างแล้วเริ่มแข่งเลย!
                  </button>
                )}
              </div>
            ) : !amIAssignedSlot && lobbyResolved.allFilled ? (
              <div className="w-full py-3 px-3 rounded-xl bg-slate-900 border-2 border-rose-400/70 text-center text-xs sm:text-sm font-extrabold text-rose-200">
                🔒 สล็อตผู้เล่นรอบนี้เต็มครบ {maxPlayers}/{maxPlayers} คนแล้ว • กรุณารอรอบถัดไปนะ!
              </div>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void updateMyPresence({ ready: !myPresenceEntry?.ready })
                }
                className={`w-full font-[family-name:var(--font-kanit)] py-3 rounded-xl text-sm sm:text-base font-extrabold cursor-pointer transition ${myPresenceEntry?.ready
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-2 border-white'
                    : 'rpg-btn-gold'
                  }`}
              >
                {myPresenceEntry?.ready
                  ? `✅ พร้อมแล้ว! (${myLobbySlot}) — คลิกเพื่อยกเลิกพร้อม`
                  : `✋ กดพร้อมแข่ง! (READY)`}
              </button>
            )}

            {/* Solo vs AI Bar (only enabled when no other players are waiting in the lobby) */}
            {presenceMembers.length <= 1 && (
              <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-extrabold text-emerald-300">🤖 เล่นกับบอท 1 รอบ:</span>
                  {(
                    [
                      { id: 'chill', label: 'ชิลๆ' },
                      { id: 'normal', label: 'ปกติ' },
                      { id: 'pro', label: 'โหด' },
                    ] as const
                  ).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setBotDifficulty(d.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-extrabold cursor-pointer ${botDifficulty === d.id
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
                        }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleStartPracticeVsBot}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer"
                >
                  ⚡ เริ่มตีกับบอท ({mode === '2v2' ? '2v2' : '1v1'})
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleCloseToIsland}
              className="w-full py-2 rounded-xl bg-slate-900 border border-slate-600 text-amber-100 text-xs font-extrabold cursor-pointer hover:bg-rose-900/60"
            >
              ยกเลิก / กลับไปเดินเล่นบนเกาะ
            </button>
          </div>
        </div>
      ) : (
        <div className="relative w-full h-dvh overflow-hidden select-none">
          <div ref={canvasWrapRef} className="fixed inset-0 w-full h-full touch-none" />
          <div ref={labelsOverlayRef} className="fixed inset-0 pointer-events-none z-10 overflow-hidden" />

          {/* Top RPG Scoreboard HUD */}
          <div className="fixed top-2 sm:top-3 inset-x-2 sm:inset-x-4 pt-safe z-20 flex items-center justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (isPractice) {
                    returnToWaitingRoom('practice');
                  } else if (amIMatchHost) {
                    returnToWaitingRoom('host_all');
                  } else {
                    returnToWaitingRoom('guest_self');
                  }
                }}
                className="rpg-panel px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-extrabold text-amber-100 hover:bg-amber-600/80 cursor-pointer"
              >
                ← {isPractice ? 'ห้องรอ' : amIMatchHost ? 'พากลับห้องรอ' : 'ห้องรอ'}
              </button>
              <button
                type="button"
                onClick={handleCloseToIsland}
                className="rpg-panel px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-rose-200 hover:bg-rose-600 hover:text-white cursor-pointer"
                title="ออกจากสนามวอลเลย์กลับสู่เกาะหลัก"
              >
                🏖️ <span className="hidden sm:inline">เกาะหลัก</span>
              </button>
            </div>

            <div className="pointer-events-auto rpg-banner rounded-2xl px-3 sm:px-5 py-1.5 flex items-center gap-2 sm:gap-4 shadow-xl">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-sky-200 max-w-[110px] sm:max-w-[160px] truncate">
                <span>{leftSlotIds.map((s) => activeMatchSlots[s]?.emoji || '🤖').join('')}</span>
                <span className="hidden sm:inline truncate">
                  {activeMatchSlots.L1?.name || 'ทีมซ้าย'}
                </span>
              </div>
              <div className="flex items-center gap-2 font-[family-name:var(--font-kanit)] font-black text-xl sm:text-2xl">
                <span className="bg-sky-400 text-black px-2.5 py-0.5 rounded-lg min-w-[34px] text-center">
                  {scoreLeft}
                </span>
                <span className="text-amber-300 text-base">⚡</span>
                <span className="bg-rose-500 text-white px-2.5 py-0.5 rounded-lg min-w-[34px] text-center">
                  {scoreRight}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-rose-200 max-w-[110px] sm:max-w-[160px] truncate">
                <span className="hidden sm:inline truncate">
                  {activeMatchSlots.R1?.name || 'ทีมขวา'}
                </span>
                <span>{rightSlotIds.map((s) => activeMatchSlots[s]?.emoji || '🤖').join('')}</span>
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

          {isDeuce && !winnerTeam && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <span className="px-3 py-0.5 rounded-full bg-rose-600 border border-amber-300 text-[11px] font-extrabold text-white shadow animate-pulse">
                🔥 DEUCE! ต้องชนะห่าง 2 แต้ม!
              </span>
            </div>
          )}

          {pointBanner && !winnerTeam && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="rpg-btn-gold px-5 py-2 rounded-full font-[family-name:var(--font-kanit)] font-extrabold text-base sm:text-lg shadow-2xl animate-bounce">
                {pointBanner}
              </div>
            </div>
          )}

          {/* Desktop Controls Hint */}
          {!showTouchControls && (
            <div className="hidden lg:flex fixed bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="rpg-panel rounded-full px-4 py-1.5 text-xs font-bold text-amber-100 flex items-center gap-2.5">
                <span>⬅️➡️ / A,D เดิน</span>
                <span>•</span>
                <span>⬆️ / W กระโดด</span>
                <span>•</span>
                <span>💥 Space / Enter + ทิศทาง (บนพื้น = พุ่งรับลูก / กลางอากาศ = ตบลูกไฟ!)</span>
              </div>
            </div>
          )}

          {/* Multi-Touch Controls */}
          {!winnerTeam && showTouchControls && (
            <div className="flex fixed bottom-3 sm:bottom-4 inset-x-3 sm:inset-x-5 pb-safe z-30 items-end justify-between pointer-events-none">
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

              <div className="flex gap-2.5 sm:gap-3.5 pointer-events-auto">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    applyInputChange({ action: true });
                  }}
                  onPointerUp={() => applyInputChange({ action: false })}
                  onPointerCancel={() => applyInputChange({ action: false })}
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
                    applyInputChange({ jump: true });
                  }}
                  onPointerUp={() => applyInputChange({ jump: false })}
                  onPointerCancel={() => applyInputChange({ jump: false })}
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
                <div className="text-4xl">{winnerTeam === myPlayingTeam ? '🏆' : '😅'}</div>
                <h3 className="font-[family-name:var(--font-kanit)] text-2xl font-extrabold text-amber-300">
                  {winnerTeam === myPlayingTeam ? 'ชนะแล้ว!! สุดยอดนักตบ!' : 'แพ้ไปนิดเดียว เอาใหม่!'}
                </h3>
                <div className="font-[family-name:var(--font-kanit)] text-3xl font-black text-white">
                  {scoreLeft} <span className="text-amber-400">-</span> {scoreRight}
                </div>
                {rewardStatus && (
                  <div className="bg-emerald-950/80 border border-emerald-400/70 rounded-xl px-3 py-2 text-xs font-extrabold text-emerald-200">
                    {rewardStatus}
                  </div>
                )}
                <div className="bg-slate-900/85 border border-amber-400/40 rounded-xl px-3 py-2 text-[11px] font-bold text-amber-200/90">
                  🏁 จบการแข่งขันรอบนี้แล้ว (จำกัดเล่นทีละ 1 รอบ เพื่อเปิดสนามให้เพื่อนๆ สลับกันเล่นได้)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (isPractice) {
                      returnToWaitingRoom('practice');
                    } else if (amIMatchHost) {
                      returnToWaitingRoom('host_all');
                    } else {
                      returnToWaitingRoom('guest_self');
                    }
                  }}
                  className="w-full rpg-btn-gold py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
                >
                  🏠 {isPractice ? 'กลับห้องรอวอลเลย์' : amIMatchHost ? 'พาตี้กลับห้องรอ (เปิดรับรอบใหม่)' : 'กลับห้องรอวอลเลย์'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseToIsland}
                  className="w-full py-2.5 rounded-xl bg-slate-900 border border-slate-600 text-amber-100 text-xs font-extrabold cursor-pointer hover:bg-rose-900/50"
                >
                  🏖️ กลับสู่เกาะหลัก
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
