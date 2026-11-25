'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import confetti from 'canvas-confetti';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { buildCharacterMesh, type CharacterMeshParts } from '@/lib/character_3d';
import type { PropColorMap } from '@/lib/rpg_catalog';
import {
  disposeObject3D,
  getQualityConfig,
  type QualityMode,
} from '@/lib/device_perf';
import { sessionFetch } from '@/lib/client_session';
import {
  DOHYO_RING_RADIUS,
  resolveSumoRank,
  stepSumoRingPhysics,
  SUMO_BOT_OPPONENTS,
  SUMO_MOVES,
  SUMO_RANKS,
  type SumoBotOpponent,
  type SumoFighterBody,
  type SumoMoveId,
  type SumoRank,
} from './catalog';

export interface SumoCharacterAppearance {
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
}

interface SumoArenaModalProps {
  isOpen: boolean;
  onClose: () => void;
  players?: SumoCharacterAppearance[];
  qualityMode?: QualityMode;
  currentUserId: number | null;
  playerName?: string;
  playerEmoji?: string;
  autoJoinPvpRoomCode?: string;
  onParticipationChange?: (participating: boolean, clientId: string, isHostNow: boolean) => void;
  onLobbyBroadcast?: (info: {
    roomCode: string;
    hostUserId: number;
    hostName: string;
    hostEmoji: string;
    count: number;
    max: number;
    status: 'waiting' | 'started' | 'closed';
    scoreLeft?: number;
    scoreRight?: number;
    roster?: Array<{
      slotId: string;
      clientId?: string;
      playerId: number;
      name: string;
      emoji: string;
      team?: 'left' | 'right';
      isBot?: boolean;
    }>;
  }) => void;
  onPointsUpdated?: () => void;
}

interface SumoFighterProfile {
  clientId: string;
  userId: number;
  name: string;
  emoji: string;
  rankTier: number;
  colorHex: string;
  bandColor?: string;
  species?: string;
  equipHat?: string;
  equipFace?: string;
  equipArmor?: string;
  equipWings?: string;
  equipAura?: string;
  bellyScale: number;
  massMult: number;
  isBot?: boolean;
}

interface SumoLeaderboardEntry {
  userId: number;
  name: string;
  emoji: string;
  totalXp: number;
  wins: number;
  rankName: string;
  mawashiHex: string;
  isYokozuna: boolean;
}

interface SumoSpark {
  id: number;
  xPct: number;
  yPct: number;
  text: string;
  colorHex: string;
}

const WINS_TO_TAKE_MATCH = 2; // Best of 3 rounds

function buildHokkaidoSumoBackdrop(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.45, '#1e293b');
    grad.addColorStop(0.82, '#3b0764');
    grad.addColorStop(1, '#451a03');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 512);

    // Rising golden-crimson Japanese sun emblem behind snowy Hokkaido peak
    const sun = ctx.createRadialGradient(512, 230, 18, 512, 230, 175);
    sun.addColorStop(0, 'rgba(254, 240, 138, 0.92)');
    sun.addColorStop(0.45, 'rgba(239, 68, 68, 0.62)');
    sun.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(512, 230, 175, 0, Math.PI * 2);
    ctx.fill();

    // Mt. Yotei ("Ezo Fuji") snow-capped silhouette
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(150, 410);
    ctx.lineTo(465, 155);
    ctx.lineTo(558, 155);
    ctx.lineTo(875, 410);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(465, 155);
    ctx.lineTo(558, 155);
    ctx.lineTo(632, 232);
    ctx.lineTo(560, 212);
    ctx.lineTo(512, 242);
    ctx.lineTo(462, 212);
    ctx.lineTo(392, 232);
    ctx.closePath();
    ctx.fill();

    // Kokugikan purple ceremonial banner strip at bottom
    ctx.fillStyle = '#3b0764';
    ctx.fillRect(0, 405, 1024, 107);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 405, 1024, 6);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function attachSumoMawashi3D(
  charParts: CharacterMeshParts,
  rank: SumoRank,
  bellyScale = 1.25
): THREE.Group {
  const group = new THREE.Group();
  const radius = 0.48 * Math.max(0.95, Math.min(1.48, bellyScale * 0.96));

  const mainMat = new THREE.MeshStandardMaterial({
    color: rank.mawashiHex,
    roughness: 0.48,
    metalness: rank.isYokozuna ? 0.25 : 0.08,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: rank.secondaryHex || '#facc15',
    roughness: 0.35,
    metalness: 0.4,
  });

  // Thick Rikishi Mawashi Waist Belt
  const waistBand = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.085, 10, 28),
    mainMat
  );
  waistBand.rotation.x = Math.PI / 2;
  group.add(waistBand);

  // Ornamental Sagari fringes hanging across the front of the Mawashi
  for (let i = -2; i <= 2; i++) {
    const fringe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.014, 0.3, 6),
      i % 2 === 0 ? mainMat : accentMat
    );
    const angle = i * 0.22;
    fringe.position.set(
      Math.sin(angle) * (radius + 0.05),
      -0.16,
      Math.cos(angle) * (radius + 0.05)
    );
    group.add(fringe);
  }

  // Grand Yokozuna Sacred White Tsuna Rope & Zigzag Gohei Paper Strips!
  if (rank.isYokozuna) {
    const tsunaMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 0.25,
      roughness: 0.35,
    });
    const tsunaRope = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.05, 0.055, 10, 28),
      tsunaMat
    );
    tsunaRope.rotation.x = Math.PI / 2;
    tsunaRope.position.y = 0.08;
    group.add(tsunaRope);

    // Back sacred knot bow
    const backKnot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), tsunaMat);
    backKnot.position.set(0, 0.1, -(radius + 0.07));
    group.add(backKnot);

    [-0.24, 0, 0.24].forEach((gx) => {
      const gohei = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.24, 0.02),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      gohei.position.set(gx, -0.06, radius + 0.09);
      group.add(gohei);
    });
  }

  group.position.set(0, 0.7, 0);
  charParts.bounceGroup.add(group);
  return group;
}

export function SumoArenaModal({
  isOpen,
  onClose,
  players = [],
  qualityMode = 'auto',
  currentUserId,
  playerName = 'นักซูโม่ปริศนา',
  playerEmoji = '🏯',
  autoJoinPvpRoomCode,
  onParticipationChange,
  onLobbyBroadcast,
  onPointsUpdated,
}: SumoArenaModalProps) {
  const onLobbyBroadcastRef = useRef(onLobbyBroadcast);
  onLobbyBroadcastRef.current = onLobbyBroadcast;
  const onParticipationChangeRef = useRef(onParticipationChange);
  onParticipationChangeRef.current = onParticipationChange;
  const [activeTab, setActiveTab] = useState<'solo' | 'pvp' | 'ranks'>(() =>
    autoJoinPvpRoomCode ? 'pvp' : 'solo'
  );
  const [totalXp, setTotalXp] = useState<number>(0);
  const [wins, setWins] = useState<number>(0);
  const [dailyWinCoins, setDailyWinCoins] = useState<number>(0);
  const [dailyWinCoinCap, setDailyWinCoinCap] = useState<number>(25);
  const [equippedRankTier, setEquippedRankTier] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<SumoLeaderboardEntry[]>([]);

  const [modeState, setModeState] = useState<'lobby' | 'waiting_pvp' | 'fighting' | 'match_end'>('lobby');
  const [isBotMatch, setIsBotMatch] = useState<boolean>(true);
  const [selectedBot, setSelectedBot] = useState<SumoBotOpponent>(SUMO_BOT_OPPONENTS[0]);
  const [roomInput, setRoomInput] = useState<string>('SUMO');
  const [roomCode, setRoomCode] = useState<string>('SUMO');
  const [connError, setConnError] = useState<string>('');
  const [mySide, setMySide] = useState<'p1' | 'p2'>('p1');

  const [p1Profile, setP1Profile] = useState<SumoFighterProfile | null>(null);
  const [p2Profile, setP2Profile] = useState<SumoFighterProfile | null>(null);
  const p1ProfileRef = useRef<SumoFighterProfile | null>(null);
  p1ProfileRef.current = p1Profile;
  const p2ProfileRef = useRef<SumoFighterProfile | null>(null);
  p2ProfileRef.current = p2Profile;
  const [roundScore, setRoundScore] = useState<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [banner, setBanner] = useState<string | null>(null);
  const [matchWinner, setMatchWinner] = useState<'p1' | 'p2' | null>(null);
  const [matchRewardSummary, setMatchRewardSummary] = useState<{
    xpGained: number;
    coinsEarned: number;
    promotedName?: string;
  } | null>(null);
  const [sparks, setSparks] = useState<SumoSpark[]>([]);
  const [shake, setShake] = useState<boolean>(false);

  const [cdTsuppariUntil, setCdTsuppariUntil] = useState<number>(0);
  const [cdYorikiriUntil, setCdYorikiriUntil] = useState<number>(0);
  const [cdShikoUntil, setCdShikoUntil] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const stageRef = useRef<HTMLDivElement | null>(null);
  const mySideRef = useRef<'p1' | 'p2'>('p1');
  mySideRef.current = mySide;
  const isBotMatchRef = useRef<boolean>(true);
  isBotMatchRef.current = isBotMatch;
  const selectedBotRef = useRef<SumoBotOpponent>(selectedBot);
  selectedBotRef.current = selectedBot;
  const modeStateRef = useRef(modeState);
  modeStateRef.current = modeState;
  const roundFrozenRef = useRef<boolean>(false);
  const roundScoreRef = useRef<{ p1: number; p2: number }>({ p1: 0, p2: 0 });
  const sparkIdRef = useRef<number>(1);
  const clientIdRef = useRef<string>(
    `sumo-${currentUserId || 'g'}-${Math.random().toString(36).slice(2, 8)}`
  );
  const sbRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  const inputRef = useRef<{
    up: boolean;
    down: boolean;
    left: boolean;
    right: boolean;
    brace: boolean;
  }>({ up: false, down: false, left: false, right: false, brace: false });

  const bodiesRef = useRef<{
    p1: SumoFighterBody & { attackPose: SumoMoveId | null; poseUntil: number; ringOutFall: number };
    p2: SumoFighterBody & { attackPose: SumoMoveId | null; poseUntil: number; ringOutFall: number };
    quakeWave: { x: number; z: number; startedAt: number; active: boolean };
  }>({
    p1: { x: -1.35, z: 0, vx: 0, vz: 0, rotY: 0, mass: 1, bracing: false, attackPose: null, poseUntil: 0, ringOutFall: 0 },
    p2: { x: 1.35, z: 0, vx: 0, vz: 0, rotY: Math.PI, mass: 1, bracing: false, attackPose: null, poseUntil: 0, ringOutFall: 0 },
    quakeWave: { x: 0, z: 0, startedAt: 0, active: false },
  });

  const remoteTargetRef = useRef<{ x: number; z: number; vx: number; vz: number; rotY: number; bracing: boolean; updatedAt: number }>({
    x: 1.35,
    z: 0,
    vx: 0,
    vz: 0,
    rotY: Math.PI,
    bracing: false,
    updatedAt: 0,
  });

  const resolvedRank = useMemo(() => resolveSumoRank(totalXp), [totalXp]);

  useEffect(() => {
    if (!isOpen) return;
    const participating =
      modeState === 'waiting_pvp' || modeState === 'fighting' || modeState === 'match_end';
    const isHostNow =
      !isBotMatch &&
      mySide === 'p1' &&
      (modeState === 'waiting_pvp' || modeState === 'fighting');
    onParticipationChangeRef.current?.(participating, clientIdRef.current, isHostNow);
  }, [isOpen, modeState, isBotMatch, mySide]);

  useEffect(() => {
    if (!isOpen || !onLobbyBroadcastRef.current) return;
    if (modeState === 'waiting_pvp' && mySide === 'p1') {
      const emitWait = () => {
        onLobbyBroadcastRef.current?.({
          roomCode: roomCode || 'SUMO',
          hostUserId: currentUserId || 0,
          hostName: p1Profile?.name || playerName,
          hostEmoji: p1Profile?.emoji || playerEmoji,
          count: p2Profile ? 2 : 1,
          max: 2,
          status: 'waiting',
          roster: [
            ...(p1Profile
              ? [
                  {
                    slotId: 'p1',
                    clientId: p1Profile.clientId,
                    playerId: p1Profile.userId,
                    name: p1Profile.name,
                    emoji: p1Profile.emoji,
                    team: 'left' as const,
                    isBot: false,
                  },
                ]
              : []),
            ...(p2Profile
              ? [
                  {
                    slotId: 'p2',
                    clientId: p2Profile.clientId,
                    playerId: p2Profile.userId,
                    name: p2Profile.name,
                    emoji: p2Profile.emoji,
                    team: 'right' as const,
                    isBot: Boolean(p2Profile.isBot),
                  },
                ]
              : []),
          ],
        });
      };
      emitWait();
      const iv = setInterval(emitWait, 5000);
      return () => clearInterval(iv);
    }
    if (modeState === 'fighting' && (isBotMatch || mySide === 'p1')) {
      const emitFight = () => {
        onLobbyBroadcastRef.current?.({
          roomCode: roomCode || 'SUMO',
          hostUserId: currentUserId || 0,
          hostName: p1Profile?.name || playerName,
          hostEmoji: p1Profile?.emoji || playerEmoji,
          count: isBotMatch ? 1 : 2,
          max: 2,
          status: 'started',
          scoreLeft: roundScore.p1,
          scoreRight: roundScore.p2,
          roster: [
            {
              slotId: 'p1',
              clientId: p1Profile?.clientId || clientIdRef.current,
              playerId: p1Profile?.userId || (currentUserId || 0),
              name: p1Profile?.name || playerName,
              emoji: p1Profile?.emoji || playerEmoji,
              team: 'left',
              isBot: false,
            },
            {
              slotId: 'p2',
              clientId: p2Profile?.clientId || 'bot',
              playerId: p2Profile?.userId || 0,
              name: p2Profile?.name || 'ริกิชิบอท',
              emoji: p2Profile?.emoji || '🤖',
              team: 'right',
              isBot: Boolean(isBotMatch || p2Profile?.isBot),
            },
          ],
        });
      };
      emitFight();
      const iv = setInterval(emitFight, 4500);
      return () => clearInterval(iv);
    }
    if (modeState === 'match_end' && (isBotMatch || mySide === 'p1')) {
      onLobbyBroadcastRef.current?.({
        roomCode: roomCode || 'SUMO',
        hostUserId: currentUserId || 0,
        hostName: playerName,
        hostEmoji: playerEmoji,
        count: 0,
        max: 2,
        status: 'closed',
        roster: [],
      });
    }
  }, [
    isOpen,
    modeState,
    isBotMatch,
    mySide,
    roomCode,
    currentUserId,
    playerName,
    playerEmoji,
    p1Profile,
    p2Profile,
    roundScore.p1,
    roundScore.p2,
  ]);
  const wornRank = useMemo(() => {
    if (equippedRankTier !== null && equippedRankTier <= resolvedRank.rank.tier) {
      return SUMO_RANKS[equippedRankTier] ?? resolvedRank.rank;
    }
    return resolvedRank.rank;
  }, [equippedRankTier, resolvedRank.rank]);

  const playSumoSfx = useCallback((kind: 'taiko' | 'slap' | 'charge' | 'quake' | 'ringout') => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const t = ctx.currentTime;
      const tone = (f1: number, f2: number, start: number, dur: number, type: OscillatorType, vol: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f1, t + start);
        osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + start + dur);
        g.gain.setValueAtTime(vol, t + start);
        g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t + start);
        osc.stop(t + start + dur + 0.02);
      };

      if (kind === 'taiko') {
        tone(115, 48, 0, 0.24, 'sine', 0.32);
        tone(118, 50, 0.26, 0.32, 'triangle', 0.36);
      } else if (kind === 'slap') {
        tone(340, 110, 0, 0.1, 'triangle', 0.22);
      } else if (kind === 'charge') {
        tone(180, 62, 0, 0.18, 'sawtooth', 0.25);
      } else if (kind === 'quake') {
        tone(95, 34, 0, 0.38, 'sawtooth', 0.32);
        tone(280, 80, 0.04, 0.25, 'triangle', 0.22);
      } else if (kind === 'ringout') {
        tone(150, 42, 0, 0.42, 'sawtooth', 0.34);
        tone(523.25, 783.99, 0.16, 0.3, 'triangle', 0.22);
      }
      setTimeout(() => ctx.close().catch(() => {}), 800);
    } catch {
      // ignore audio error
    }
  }, []);

  const addSpark = useCallback((worldX: number, worldZ: number, text: string, colorHex: string) => {
    const id = sparkIdRef.current++;
    const xPct = Math.max(14, Math.min(86, 50 + (worldX / 4.2) * 38));
    const yPct = Math.max(18, Math.min(78, 50 + (worldZ / 4.2) * 28));
    setSparks((prev) => [...prev.slice(-5), { id, xPct, yPct, text, colorHex }]);
    setTimeout(() => setSparks((prev) => prev.filter((s) => s.id !== id)), 680);
  }, []);

  const fetchSumoProgress = useCallback(async () => {
    try {
      const q = currentUserId ? `?userId=${currentUserId}` : '';
      const res = await fetch(`/api/sumo${q}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setTotalXp(Number(data.totalXp ?? 0));
      setWins(Number(data.wins ?? 0));
      setDailyWinCoins(Number(data.dailyWinCoins ?? 0));
      setDailyWinCoinCap(Number(data.dailyWinCoinCap ?? 25));
      setEquippedRankTier(data.equippedRankTier ?? null);
      if (Array.isArray(data.leaderboard)) {
        setLeaderboard(data.leaderboard);
      }
    } catch {
      // ignore
    }
  }, [currentUserId]);

  useEffect(() => {
    if (isOpen) {
      void fetchSumoProgress();
    }
  }, [isOpen, fetchSumoProgress]);

  useEffect(() => {
    if (modeState !== 'fighting') return;
    const iv = setInterval(() => setNowTick(Date.now()), 90);
    return () => clearInterval(iv);
  }, [modeState]);

  const buildMyFighterProfile = useCallback((): SumoFighterProfile => {
    const me = players.find((p) => p.id === currentUserId);
    const belly = Math.max(1.16, (me?.bellyScale ?? me?.bmiBellyScale ?? 1.05) * 1.12);
    return {
      clientId: clientIdRef.current,
      userId: currentUserId || 0,
      name: me?.name || playerName,
      emoji: me?.emoji || playerEmoji,
      rankTier: wornRank.tier,
      colorHex: me?.colorHex || '#38BDF8',
      bandColor: wornRank.mawashiHex,
      species: me?.breed || me?.species || 'bunny',
      equipHat: me?.equipHat || 'none',
      equipFace: me?.equipFace || 'face_none',
      equipArmor: me?.equipArmor || 'armor_none',
      equipWings: me?.equipWings || 'wings_none',
      equipAura: me?.equipAura || 'aura_none',
      bellyScale: belly,
      massMult: 1 + Math.min(0.22, (belly - 1) * 0.25),
    };
  }, [currentUserId, playerEmoji, playerName, players, wornRank.mawashiHex, wornRank.tier]);

  const cleanupPvpChannels = useCallback(() => {
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({
          event: 'bye_peer',
          payload: { clientId: clientIdRef.current, _sender: clientIdRef.current },
        });
        bcRef.current.close();
      } catch {
        // ignore
      }
      bcRef.current = null;
    }
    const ch = channelRef.current;
    const sb = sbRef.current;
    channelRef.current = null;
    sbRef.current = null;
    if (ch && sb) {
      void ch.untrack().catch(() => {}).finally(() => {
        void sb.removeChannel(ch).finally(() => sb.realtime.disconnect());
      });
    } else if (sb) {
      sb.realtime.disconnect();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      cleanupPvpChannels();
      setModeState('lobby');
    }
    return () => cleanupPvpChannels();
  }, [isOpen, cleanupPvpChannels]);

  const resetRoundPositions = useCallback((p1Mass = 1, p2Mass = 1) => {
    bodiesRef.current.p1 = {
      x: -1.42,
      z: 0,
      vx: 0,
      vz: 0,
      rotY: 0,
      mass: p1Mass,
      bracing: false,
      attackPose: null,
      poseUntil: 0,
      ringOutFall: 0,
    };
    bodiesRef.current.p2 = {
      x: 1.42,
      z: 0,
      vx: 0,
      vz: 0,
      rotY: Math.PI,
      mass: p2Mass,
      bracing: false,
      attackPose: null,
      poseUntil: 0,
      ringOutFall: 0,
    };
    bodiesRef.current.quakeWave = { x: 0, z: 0, startedAt: 0, active: false };
    remoteTargetRef.current = {
      x: mySideRef.current === 'p1' ? 1.42 : -1.42,
      z: 0,
      vx: 0,
      vz: 0,
      rotY: mySideRef.current === 'p1' ? Math.PI : 0,
      bracing: false,
      updatedAt: performance.now(),
    };
    inputRef.current = { up: false, down: false, left: false, right: false, brace: false };
    setCdTsuppariUntil(0);
    setCdYorikiriUntil(0);
    setCdShikoUntil(0);
  }, []);

  const broadcastPvpPacket = useCallback((event: string, payload: Record<string, unknown>) => {
    const packet = { ...payload, _sender: clientIdRef.current };
    channelRef.current?.send({ type: 'broadcast', event, payload: packet });
    try {
      bcRef.current?.postMessage({ event, payload: packet });
    } catch {
      // ignore
    }
  }, []);

  const submitMatchResult = useCallback(
    async (didWin: boolean, xpAmount: number) => {
      try {
        const res = await sessionFetch('/api/sumo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            won: didWin,
            xpEarned: xpAmount,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setTotalXp(Number(data.totalXp ?? totalXp));
        setWins(Number(data.wins ?? wins));
        setDailyWinCoins(Number(data.dailyWinCoins ?? dailyWinCoins));
        const promoted = Array.isArray(data.promotedRanks) && data.promotedRanks[0];
        const coinsEarned = Number(data.coinsEarned ?? 0);
        setMatchRewardSummary({
          xpGained: Number(data.xpGained ?? xpAmount),
          coinsEarned,
          promotedName: promoted ? promoted.name : undefined,
        });
        if (didWin || promoted) {
          confetti({ particleCount: promoted ? 95 : 55, spread: 72, origin: { y: 0.6 } });
        }
        if (coinsEarned > 0) {
          onPointsUpdated?.();
        }
        void fetchSumoProgress();
      } catch {
        // ignore
      }
    },
    [currentUserId, dailyWinCoins, fetchSumoProgress, onPointsUpdated, totalXp, wins]
  );

  const handleRoundRingOut = useCallback(
    (roundWinner: 'p1' | 'p2', fromNetwork = false) => {
      if (roundFrozenRef.current || modeStateRef.current !== 'fighting') return;
      roundFrozenRef.current = true;

      if (!fromNetwork && !isBotMatchRef.current) {
        broadcastPvpPacket('ring_out', { winner: roundWinner });
      }

      const loserSide = roundWinner === 'p1' ? 'p2' : 'p1';
      bodiesRef.current[loserSide].ringOutFall = 0.01;
      playSumoSfx('ringout');
      setShake(true);
      setTimeout(() => setShake(false), 340);

      const nextScores = {
        p1: roundScoreRef.current.p1 + (roundWinner === 'p1' ? 1 : 0),
        p2: roundScoreRef.current.p2 + (roundWinner === 'p2' ? 1 : 0),
      };
      roundScoreRef.current = nextScores;
      setRoundScore(nextScores);

      const winnerName = roundWinner === 'p1' ? p1Profile?.name : p2Profile?.name;
      setBanner(`🏯 RING OUT! ${winnerName || ''} ชนะยกนี้!`);

      if (nextScores.p1 >= WINS_TO_TAKE_MATCH || nextScores.p2 >= WINS_TO_TAKE_MATCH) {
        const finalWinner: 'p1' | 'p2' = nextScores.p1 >= WINS_TO_TAKE_MATCH ? 'p1' : 'p2';
        setTimeout(() => {
          setMatchWinner(finalWinner);
          setModeState('match_end');
          setBanner(null);
          const didIWin = finalWinner === mySideRef.current;
          const xpReward = isBotMatchRef.current
            ? didIWin
              ? selectedBotRef.current.winXp
              : selectedBotRef.current.loseXp
            : didIWin
              ? 210
              : 65;
          void submitMatchResult(didIWin, xpReward);
        }, 1250);
      } else {
        setTimeout(() => {
          const nextR = nextScores.p1 + nextScores.p2 + 1;
          setRoundNumber(nextR);
          resetRoundPositions(p1Profile?.massMult ?? 1, p2Profile?.massMult ?? 1);
          playSumoSfx('taiko');
          setBanner(`ยกที่ ${nextR} • HAKKEYOI... NOKOTTA!!`);
          setTimeout(() => {
            roundFrozenRef.current = false;
            setBanner(null);
          }, 850);
        }, 1350);
      }
    },
    [broadcastPvpPacket, p1Profile, p2Profile, playSumoSfx, resetRoundPositions, submitMatchResult]
  );

  const startBotChallenge = useCallback(
    (bot: SumoBotOpponent) => {
      cleanupPvpChannels();
      setSelectedBot(bot);
      setIsBotMatch(true);
      setMySide('p1');
      const meProf = buildMyFighterProfile();
      const botProf: SumoFighterProfile = {
        clientId: bot.id,
        userId: -1,
        name: bot.name,
        emoji: bot.emoji,
        rankTier: bot.rankTier,
        colorHex: bot.colorHex,
        bandColor: bot.bandColor,
        species: bot.species,
        bellyScale: bot.bellyScale,
        massMult: bot.massMult,
        isBot: true,
      };
      setP1Profile(meProf);
      setP2Profile(botProf);
      roundScoreRef.current = { p1: 0, p2: 0 };
      setRoundScore({ p1: 0, p2: 0 });
      setRoundNumber(1);
      setMatchWinner(null);
      setMatchRewardSummary(null);
      resetRoundPositions(meProf.massMult, botProf.massMult);
      roundFrozenRef.current = true;
      setModeState('fighting');
      playSumoSfx('taiko');
      setBanner('❄️ HAKKEYOI... NOKOTTA!! 🏯');
      setTimeout(() => {
        roundFrozenRef.current = false;
        setBanner(null);
      }, 900);
    },
    [buildMyFighterProfile, cleanupPvpChannels, playSumoSfx, resetRoundPositions]
  );

  const executeSumoMove = useCallback(
    (side: 'p1' | 'p2', moveId: SumoMoveId, fromNetwork = false) => {
      if (modeStateRef.current !== 'fighting' || roundFrozenRef.current) return;
      const move = SUMO_MOVES[moveId];
      const now = Date.now();

      if (side === mySideRef.current && !fromNetwork) {
        if (moveId === 'tsuppari' && now < cdTsuppariUntil) return;
        if (moveId === 'yorikiri' && now < cdYorikiriUntil) return;
        if (moveId === 'shiko_quake' && now < cdShikoUntil) return;

        if (moveId === 'tsuppari') setCdTsuppariUntil(now + move.cooldownMs);
        if (moveId === 'yorikiri') setCdYorikiriUntil(now + move.cooldownMs);
        if (moveId === 'shiko_quake') setCdShikoUntil(now + move.cooldownMs);

        if (!isBotMatchRef.current) {
          broadcastPvpPacket('sumo_move', { side, moveId });
        }
      }

      const attacker = bodiesRef.current[side];
      const defenderSide = side === 'p1' ? 'p2' : 'p1';
      const defender = bodiesRef.current[defenderSide];

      const toDefX = defender.x - attacker.x;
      const toDefZ = defender.z - attacker.z;
      const dist = Math.hypot(toDefX, toDefZ);
      const dirX = dist > 0.001 ? toDefX / dist : Math.cos(attacker.rotY);
      const dirZ = dist > 0.001 ? toDefZ / dist : -Math.sin(attacker.rotY);

      attacker.rotY = Math.atan2(-dirZ, dirX);
      attacker.attackPose = moveId;
      attacker.poseUntil = performance.now() + (moveId === 'shiko_quake' ? 460 : 300);

      if (moveId === 'yorikiri') {
        // Explosive Belly Charge forward (carries momentum — can self-ring-out if dodged!)
        attacker.vx += dirX * move.dashSpeed;
        attacker.vz += dirZ * move.dashSpeed;
        playSumoSfx('charge');
      } else if (moveId === 'tsuppari') {
        attacker.vx += dirX * move.dashSpeed;
        attacker.vz += dirZ * move.dashSpeed;
        playSumoSfx('slap');
      } else if (moveId === 'shiko_quake') {
        bodiesRef.current.quakeWave = {
          x: attacker.x,
          z: attacker.z,
          startedAt: performance.now(),
          active: true,
        };
        playSumoSfx('quake');
        setShake(true);
        setTimeout(() => setShake(false), 240);
      }

      if (dist <= move.reach) {
        const braceMult = defender.bracing ? 0.45 : 1;
        const pushPower = (move.knockback / Math.max(0.85, defender.mass)) * braceMult;
        defender.vx += dirX * pushPower;
        defender.vz += dirZ * pushPower;
        addSpark(
          defender.x,
          defender.z,
          defender.bracing ? `🛡️ ตั้งหลักรับ! ${move.emoji}` : `${move.emoji} ${move.codeName}!`,
          move.colorHex
        );
      } else if (moveId === 'shiko_quake') {
        addSpark(attacker.x, attacker.z, '🌋 SHIKO STOMP!', move.colorHex);
      }
    },
    [
      addSpark,
      broadcastPvpPacket,
      cdShikoUntil,
      cdTsuppariUntil,
      cdYorikiriUntil,
      playSumoSfx,
    ]
  );

  const joinPvpRoom = useCallback(
    (explicitCode?: string | React.SyntheticEvent) => {
      const sourceCode = typeof explicitCode === 'string' ? explicitCode : roomInput;
      const clean = (sourceCode.trim().toUpperCase() || 'SUMO').slice(0, 12);
      setRoomInput(clean);
      setRoomCode(clean);
      setConnError('');
      cleanupPvpChannels();
      setIsBotMatch(false);

      const meProf = buildMyFighterProfile();
      const peerMap = new Map<string, SumoFighterProfile & { joinedAt: number }>();
      const myJoinedAt = Date.now();
      peerMap.set(meProf.clientId, { ...meProf, joinedAt: myJoinedAt });

      const syncLobbyPeers = () => {
        const sorted = Array.from(peerMap.values()).sort((a, b) =>
          a.joinedAt !== b.joinedAt ? a.joinedAt - b.joinedAt : a.clientId.localeCompare(b.clientId)
        );
        const first = sorted[0] ?? null;
        const second = sorted[1] ?? null;
        setP1Profile(first);
        setP2Profile(second);
        if (first?.clientId === meProf.clientId) setMySide('p1');
        else if (second?.clientId === meProf.clientId) setMySide('p2');
      };
      syncLobbyPeers();
      setModeState('waiting_pvp');

      const handlePeerDeparture = (departedId: string) => {
        if (!departedId || departedId === meProf.clientId || !peerMap.has(departedId)) return;
        const departed = peerMap.get(departedId);
        peerMap.delete(departedId);
        syncLobbyPeers();
        if (modeStateRef.current === 'fighting') {
          roundFrozenRef.current = false;
          setModeState('waiting_pvp');
          setBanner(`⚠️ ${departed?.name || 'คู่ต่อสู้'} ออกจากสังเวียน!`);
          setTimeout(() => setBanner(null), 1800);
        }
      };

      const handleIncomingPacket = (event: string, payload: Record<string, unknown>) => {
        if (!payload || payload._sender === clientIdRef.current) return;
        if (event === 'hello_peer' && payload.profile) {
          const prof = payload.profile as SumoFighterProfile;
          const jAt = Number(payload.joinedAt || Date.now());
          const hadPeer = peerMap.has(prof.clientId);
          peerMap.set(prof.clientId, { ...prof, joinedAt: jAt });
          syncLobbyPeers();
          if (!hadPeer) {
            broadcastPvpPacket('hello_peer', { profile: meProf, joinedAt: myJoinedAt });
          }
        } else if (event === 'bye_peer' && payload.clientId) {
          handlePeerDeparture(String(payload.clientId));
        } else if (event === 'start_pvp_match') {
          roundScoreRef.current = { p1: 0, p2: 0 };
          setRoundScore({ p1: 0, p2: 0 });
          setRoundNumber(1);
          setMatchWinner(null);
          setMatchRewardSummary(null);
          const m1 = Number(payload.p1Mass || p1ProfileRef.current?.massMult || 1);
          const m2 = Number(payload.p2Mass || p2ProfileRef.current?.massMult || 1);
          resetRoundPositions(m1, m2);
          roundFrozenRef.current = true;
          setModeState('fighting');
          playSumoSfx('taiko');
          setBanner('⚔️ HAKKEYOI... NOKOTTA!! 🏯');
          setTimeout(() => {
            roundFrozenRef.current = false;
            setBanner(null);
          }, 900);
        } else if (event === 'pos_sync') {
          remoteTargetRef.current = {
            x: Number(payload.x ?? 0),
            z: Number(payload.z ?? 0),
            vx: Number(payload.vx ?? 0),
            vz: Number(payload.vz ?? 0),
            rotY: Number(payload.rotY ?? 0),
            bracing: Boolean(payload.bracing),
            updatedAt: performance.now(),
          };
        } else if (event === 'sumo_move') {
          const s = payload.side === 'p1' ? 'p1' : 'p2';
          const mId = payload.moveId as SumoMoveId;
          if (SUMO_MOVES[mId]) {
            executeSumoMove(s, mId, true);
          }
        } else if (event === 'ring_out') {
          const w = payload.winner === 'p1' ? 'p1' : 'p2';
          handleRoundRingOut(w, true);
        }
      };

      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(`waist-sumo-local-${clean}`);
        bc.onmessage = (ev) => {
          if (ev.data?.event) handleIncomingPacket(ev.data.event, ev.data.payload);
        };
        bcRef.current = bc;
        bc.postMessage({
          event: 'hello_peer',
          payload: { profile: meProf, joinedAt: myJoinedAt, _sender: clientIdRef.current },
        });
      }

      const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (sbUrl && sbKey) {
        const sb = createClient(sbUrl, sbKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        sbRef.current = sb;
        const ch = sb.channel(`waist-sumo-pvp-${clean}`, {
          config: { presence: { key: meProf.clientId } },
        });
        channelRef.current = ch;

        ch.on('presence', { event: 'sync' }, () => {
          const state = ch.presenceState();
          const activeIds = new Set<string>([meProf.clientId]);
          Object.values(state).forEach((entries) => {
            const entry = entries[0] as unknown as
              | (SumoFighterProfile & { joinedAt: number })
              | undefined;
            if (entry?.clientId) {
              activeIds.add(entry.clientId);
              peerMap.set(entry.clientId, entry);
            }
          });
          for (const cid of Array.from(peerMap.keys())) {
            if (!activeIds.has(cid)) {
              handlePeerDeparture(cid);
            }
          }
          syncLobbyPeers();
        });

        ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
          for (const lp of (leftPresences || []) as unknown as Array<{ clientId?: string }>) {
            if (lp?.clientId) {
              handlePeerDeparture(lp.clientId);
            }
          }
        });

        [
          'hello_peer',
          'bye_peer',
          'start_pvp_match',
          'pos_sync',
          'sumo_move',
          'ring_out',
        ].forEach((evName) => {
          ch.on('broadcast', { event: evName }, ({ payload }) =>
            handleIncomingPacket(evName, payload)
          );
        });

        ch.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await ch.track({ ...meProf, joinedAt: myJoinedAt });
            broadcastPvpPacket('hello_peer', { profile: meProf, joinedAt: myJoinedAt });
          } else if (status === 'CHANNEL_ERROR') {
            setConnError('เชื่อมต่อเซิร์ฟเวอร์ห้องไม่สำเร็จ (ยังเล่นผ่านแท็บในเครื่องเดียวกันได้)');
          }
        });
      }
    },
    [
      broadcastPvpPacket,
      buildMyFighterProfile,
      cleanupPvpChannels,
      executeSumoMove,
      handleRoundRingOut,
      playSumoSfx,
      resetRoundPositions,
      roomInput,
    ]
  );

  const autoJoinedSumoRef = useRef<string>('');
  useEffect(() => {
    if (!isOpen) {
      autoJoinedSumoRef.current = '';
      return;
    }
    if (
      autoJoinPvpRoomCode &&
      autoJoinedSumoRef.current !== autoJoinPvpRoomCode &&
      modeState === 'lobby'
    ) {
      autoJoinedSumoRef.current = autoJoinPvpRoomCode;
      setActiveTab('pvp');
      joinPvpRoom(autoJoinPvpRoomCode);
    }
  }, [isOpen, autoJoinPvpRoomCode, modeState, joinPvpRoom]);

  const startLivePvpMatch = useCallback(() => {
    if (!p1Profile || !p2Profile) return;
    broadcastPvpPacket('start_pvp_match', {
      at: Date.now(),
      p1Mass: p1Profile.massMult,
      p2Mass: p2Profile.massMult,
    });
    roundScoreRef.current = { p1: 0, p2: 0 };
    setRoundScore({ p1: 0, p2: 0 });
    setRoundNumber(1);
    setMatchWinner(null);
    setMatchRewardSummary(null);
    resetRoundPositions(p1Profile.massMult, p2Profile.massMult);
    roundFrozenRef.current = true;
    setModeState('fighting');
    playSumoSfx('taiko');
    setBanner('⚔️ HAKKEYOI... NOKOTTA!! 🏯');
    setTimeout(() => {
      roundFrozenRef.current = false;
      setBanner(null);
    }, 900);
  }, [broadcastPvpPacket, p1Profile, p2Profile, playSumoSfx, resetRoundPositions]);

  // Keyboard Controls during fighting
  useEffect(() => {
    if (!isOpen || modeState !== 'fighting') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') inputRef.current.up = true;
      if (k === 's' || e.key === 'ArrowDown') inputRef.current.down = true;
      if (k === 'a' || e.key === 'ArrowLeft') inputRef.current.left = true;
      if (k === 'd' || e.key === 'ArrowRight') inputRef.current.right = true;
      if (e.key === 'Shift') inputRef.current.brace = true;

      if (e.repeat) return;
      if (e.code === 'Space' || k === 'j') {
        e.preventDefault();
        executeSumoMove(mySideRef.current, 'tsuppari');
      } else if (k === 'k') {
        e.preventDefault();
        executeSumoMove(mySideRef.current, 'yorikiri');
      } else if (k === 'l') {
        e.preventDefault();
        executeSumoMove(mySideRef.current, 'shiko_quake');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || e.key === 'ArrowUp') inputRef.current.up = false;
      if (k === 's' || e.key === 'ArrowDown') inputRef.current.down = false;
      if (k === 'a' || e.key === 'ArrowLeft') inputRef.current.left = false;
      if (k === 'd' || e.key === 'ArrowRight') inputRef.current.right = false;
      if (e.key === 'Shift') inputRef.current.brace = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [executeSumoMove, isOpen, modeState]);

  // 3D Sumo Dohyo Renderer & 60 FPS Physics Loop
  useEffect(() => {
    const showStage = modeState === 'fighting' || modeState === 'match_end';
    if (!isOpen || !showStage || !p1Profile || !p2Profile || !stageRef.current) return;

    const container = stageRef.current;
    const qCfg = getQualityConfig(qualityMode);
    const w = container.clientWidth || 640;
    const h = container.clientHeight || 340;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 6.2, 7.6);
    camera.lookAt(0, 0.4, 0.2);

    const renderer = new THREE.WebGLRenderer({ antialias: qCfg.antialias, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qCfg.maxPixelRatio));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xfffbeb, 0.95));
    const mainLight = new THREE.DirectionalLight(0xfef3c7, 1.35);
    mainLight.position.set(4, 9, 6);
    scene.add(mainLight);
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    rimLight.position.set(-6, 5, -5);
    scene.add(rimLight);

    // Backdrop: Snowy Mt. Yotei & Kokugikan Banner
    const bgTex = buildHokkaidoSumoBackdrop();
    const bgMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 12),
      new THREE.MeshBasicMaterial({ map: bgTex })
    );
    bgMesh.position.set(0, 3.2, -6.8);
    scene.add(bgMesh);

    // Raised Clay Dohyo Mound + Golden Tawara Straw Ring + Shikiri-sen Lines
    const dohyoGroup = new THREE.Group();
    const outerFloor = new THREE.Mesh(
      new THREE.BoxGeometry(18, 0.4, 14),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
    );
    outerFloor.position.y = -0.78;
    dohyoGroup.add(outerFloor);

    const clayMound = new THREE.Mesh(
      new THREE.CylinderGeometry(4.35, 4.95, 0.62, 4),
      new THREE.MeshStandardMaterial({ color: 0xc8a276, roughness: 0.86 })
    );
    clayMound.rotation.y = Math.PI / 4;
    clayMound.position.y = -0.32;
    dohyoGroup.add(clayMound);

    const innerClay = new THREE.Mesh(
      new THREE.CylinderGeometry(DOHYO_RING_RADIUS, DOHYO_RING_RADIUS, 0.05, 48),
      new THREE.MeshStandardMaterial({ color: 0xe7cfa8, roughness: 0.8 })
    );
    innerClay.position.y = -0.01;
    dohyoGroup.add(innerClay);

    const tawaraRope = new THREE.Mesh(
      new THREE.TorusGeometry(DOHYO_RING_RADIUS, 0.13, 12, 48),
      new THREE.MeshStandardMaterial({
        color: 0xeab308,
        emissive: 0xa16207,
        emissiveIntensity: 0.16,
        roughness: 0.72,
      })
    );
    tawaraRope.rotation.x = Math.PI / 2;
    tawaraRope.position.y = 0.04;
    dohyoGroup.add(tawaraRope);

    [-0.65, 0.65].forEach((sx) => {
      const sLine = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.02, 1.15),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      sLine.position.set(sx, 0.025, 0);
      dohyoGroup.add(sLine);
    });

    // Back Kohaku-maku Hinoki Shrine Pillars framing the Dohyo
    const hinokiMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
    const redWrapMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 });
    [-4.1, 4.1].forEach((px) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 5.2, 12), hinokiMat);
      col.position.set(px, 2.2, -3.9);
      const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.29, 1.2, 12), redWrapMat);
      wrap.position.set(px, 0.5, -3.9);
      dohyoGroup.add(col, wrap);
    });
    scene.add(dohyoGroup);

    // Shiko Quake Expanding Shockwave Ring
    const quakeRingMat = new THREE.MeshBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const quakeRing = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.75, 32), quakeRingMat);
    quakeRing.rotation.x = -Math.PI / 2;
    quakeRing.position.y = 0.06;
    scene.add(quakeRing);

    // Falling Hokkaido Snowflakes inside the Arena
    const snowCount = qCfg.tier === 'lite' ? 45 : 90;
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3] = (Math.random() - 0.5) * 16;
      snowPos[i * 3 + 1] = Math.random() * 8;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 10;
    }
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowPts = new THREE.Points(
      snowGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.14, transparent: true, opacity: 0.8 })
    );
    scene.add(snowPts);

    const buildRikishiVisual = (prof: SumoFighterProfile, isMe: boolean, seed: number) => {
      const wrapper = new THREE.Group();
      const rk = SUMO_RANKS[prof.rankTier] ?? SUMO_RANKS[0];
      const charParts = buildCharacterMesh({
        colorHex: prof.colorHex || '#F8FAFC',
        accessory: 'headband',
        bandColor: rk.mawashiHex,
        bellyScale: prof.bellyScale,
        muscleScale: 1.15,
        species: prof.species || 'bunny',
        equipHat: prof.equipHat || 'none',
        equipFace: prof.equipFace || 'face_none',
        equipArmor: prof.equipArmor || 'armor_none',
        equipWeapon: 'weapon_none',
        equipWings: prof.equipWings || 'wings_none',
        equipAura: prof.equipAura || 'aura_none',
        equipMount: 'mount_none',
        animMode: 'idle',
        animSeed: seed,
      });
      charParts.angryFace.visible = true;
      charParts.normalEyes.visible = false;
      charParts.happyFace.visible = false;
      attachSumoMawashi3D(charParts, rk, prof.bellyScale);
      charParts.rootGroup.scale.setScalar(1.1);
      wrapper.add(charParts.rootGroup);

      const footRingMat = new THREE.MeshBasicMaterial({
        color: isMe ? 0xfacc15 : 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      });
      const footRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 24), footRingMat);
      footRing.rotation.x = -Math.PI / 2;
      footRing.position.y = 0.03;
      scene.add(footRing);
      scene.add(wrapper);
      return { wrapper, charParts, footRing, footRingMat };
    };

    const visP1 = buildRikishiVisual(p1Profile, mySideRef.current === 'p1', 0.3);
    const visP2 = buildRikishiVisual(p2Profile, mySideRef.current === 'p2', 1.9);

    const onResize = () => {
      if (!stageRef.current) return;
      const nw = stageRef.current.clientWidth || 640;
      const nh = stageRef.current.clientHeight || 340;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let lastNetSendAt = 0;
    let lastBotActionAt = 0;

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;
      const nowPerf = performance.now();

      // Gentle snowfall
      const sAttr = snowGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < snowCount; i++) {
        let sy = sAttr.getY(i) - 0.028;
        if (sy < -0.5) sy = 7.5;
        sAttr.setY(i, sy);
      }
      sAttr.needsUpdate = true;

      const b1 = bodiesRef.current.p1;
      const b2 = bodiesRef.current.p2;
      const me = mySideRef.current === 'p1' ? b1 : b2;
      const opp = mySideRef.current === 'p1' ? b2 : b1;

      if (modeStateRef.current === 'fighting' && !roundFrozenRef.current) {
        // Local player movement input
        const inp = inputRef.current;
        const mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
        const mz = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
        me.bracing = inp.brace;
        if (mx !== 0 || mz !== 0) {
          const len = Math.hypot(mx, mz);
          const speed = (me.bracing ? 7.5 : 13.5) * dt;
          me.vx += (mx / len) * speed;
          me.vz += (mz / len) * speed;
        }

        // Face opponent naturally
        me.rotY = Math.atan2(-(opp.z - me.z), opp.x - me.x);

        if (isBotMatchRef.current) {
          // Smart Hokkaido Sumo AI Bot
          const botCfg = selectedBotRef.current;
          const dx = b1.x - b2.x;
          const dz = b1.z - b2.z;
          const dist = Math.hypot(dx, dz);
          const b2CenterDist = Math.hypot(b2.x, b2.z);
          b2.rotY = Math.atan2(-dz, dx);

          // If dangerously near the straw rope, push back toward center (0,0)!
          if (b2CenterDist > DOHYO_RING_RADIUS * 0.72) {
            const toCenterLen = Math.max(0.01, b2CenterDist);
            b2.vx += (-b2.x / toCenterLen) * 15.5 * botCfg.aiSpeedMult * dt;
            b2.vz += (-b2.z / toCenterLen) * 15.5 * botCfg.aiSpeedMult * dt;
            b2.bracing = b2CenterDist > DOHYO_RING_RADIUS * 0.85;
          } else {
            b2.bracing = false;
            const nx = dist > 0.01 ? dx / dist : -1;
            const nz = dist > 0.01 ? dz / dist : 0;
            // Strafe slightly + press forward
            const strafe = Math.sin(elapsed * 2.1) * 0.35;
            b2.vx += (nx - nz * strafe) * 12.2 * botCfg.aiSpeedMult * dt;
            b2.vz += (nz + nx * strafe) * 12.2 * botCfg.aiSpeedMult * dt;
          }

          if (nowPerf - lastBotActionAt > 680 / Math.max(0.6, botCfg.aggression + 0.35)) {
            lastBotActionAt = nowPerf;
            if (dist < 2.2 && botCfg.rankTier >= 8 && Math.random() < 0.28) {
              executeSumoMove('p2', 'shiko_quake', true);
            } else if (dist < 2.4 && b2CenterDist < 2.0 && Math.random() < botCfg.aggression * 0.55) {
              executeSumoMove('p2', 'yorikiri', true);
            } else if (dist < 1.75) {
              executeSumoMove('p2', 'tsuppari', true);
            }
          }
        } else {
          // Live PvP: smoothly blend opponent position & broadcast our own at 20Hz
          const rt = remoteTargetRef.current;
          if (nowPerf - rt.updatedAt < 2500) {
            opp.x += (rt.x - opp.x) * 0.28;
            opp.z += (rt.z - opp.z) * 0.28;
            opp.vx = rt.vx;
            opp.vz = rt.vz;
            opp.rotY = rt.rotY;
            opp.bracing = rt.bracing;
          }
          if (nowPerf - lastNetSendAt >= 50) {
            lastNetSendAt = nowPerf;
            broadcastPvpPacket('pos_sync', {
              x: Number(me.x.toFixed(3)),
              z: Number(me.z.toFixed(3)),
              vx: Number(me.vx.toFixed(2)),
              vz: Number(me.vz.toFixed(2)),
              rotY: Number(me.rotY.toFixed(2)),
              bracing: me.bracing,
            });
          }
        }

        const stepRes = stepSumoRingPhysics(b1, b2, dt, DOHYO_RING_RADIUS);
        if (stepRes.collided && stepRes.impactSpeed > 2.4) {
          playSumoSfx('slap');
          addSpark((b1.x + b2.x) * 0.5, (b1.z + b2.z) * 0.5, '💥 พุงชนพุง!!', '#facc15');
        }

        // Authoritative Ring-Out check (in bot match or for our own side falling out in PvP)
        if (isBotMatchRef.current) {
          if (stepRes.p1RingOut && stepRes.p2RingOut) {
            const d1 = Math.hypot(b1.x, b1.z);
            const d2 = Math.hypot(b2.x, b2.z);
            handleRoundRingOut(d1 > d2 ? 'p2' : 'p1');
          } else if (stepRes.p2RingOut) {
            handleRoundRingOut('p1');
          } else if (stepRes.p1RingOut) {
            handleRoundRingOut('p2');
          }
        } else {
          const myDist = Math.hypot(me.x, me.z);
          if (myDist > DOHYO_RING_RADIUS) {
            handleRoundRingOut(mySideRef.current === 'p1' ? 'p2' : 'p1');
          }
        }
      }

      // Animate Quake Shockwave
      const qw = bodiesRef.current.quakeWave;
      if (qw.active) {
        const qAge = (nowPerf - qw.startedAt) / 480;
        if (qAge >= 1) {
          qw.active = false;
          quakeRingMat.opacity = 0;
        } else {
          quakeRing.position.set(qw.x, 0.06, qw.z);
          quakeRing.scale.setScalar(1 + qAge * 3.4);
          quakeRingMat.opacity = (1 - qAge) * 0.85;
        }
      }

      // Update 3D Rikishi Meshes
      (
        [
          [b1, visP1, mySideRef.current === 'p1'],
          [b2, visP2, mySideRef.current === 'p2'],
        ] as const
      ).forEach(([body, vis, isMe]) => {
        let yPos = 0;
        if (body.ringOutFall > 0) {
          body.ringOutFall = Math.min(1, body.ringOutFall + dt * 2.5);
          yPos = -body.ringOutFall * 0.72;
          vis.wrapper.rotation.z = body.ringOutFall * 1.15;
        } else {
          vis.wrapper.rotation.z = 0;
        }

        const speed = Math.hypot(body.vx, body.vz);
        const isPoseActive = body.attackPose && nowPerf < body.poseUntil;
        const stompLift =
          isPoseActive && body.attackPose === 'shiko_quake'
            ? Math.sin(((body.poseUntil - nowPerf) / 460) * Math.PI) * 0.55
            : 0;

        vis.wrapper.position.set(
          body.x,
          yPos + stompLift + (speed > 0.4 ? Math.abs(Math.sin(elapsed * 14)) * 0.1 : 0),
          body.z
        );
        vis.wrapper.rotation.y = body.rotY;

        // Wide low Sumo crouch when bracing or attacking!
        vis.charParts.bounceGroup.position.y = body.bracing ? -0.14 : 0;
        if (isPoseActive && body.attackPose === 'tsuppari') {
          vis.charParts.armL.rotation.z = Math.sin(elapsed * 45) * 0.8;
          vis.charParts.armR.rotation.z = -Math.sin(elapsed * 45) * 0.8;
        } else {
          vis.charParts.armL.rotation.z = 0.25;
          vis.charParts.armR.rotation.z = -0.25;
        }

        const edgeDist = Math.hypot(body.x, body.z);
        const inDanger = edgeDist > DOHYO_RING_RADIUS * 0.78;
        vis.footRing.position.set(body.x, 0.03, body.z);
        vis.footRingMat.color.setHex(inDanger ? 0xef4444 : isMe ? 0xfacc15 : 0x38bdf8);
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      disposeObject3D(scene);
      bgTex.dispose();
      renderer.dispose();
    };
  }, [
    addSpark,
    broadcastPvpPacket,
    executeSumoMove,
    handleRoundRingOut,
    isOpen,
    modeState,
    p1Profile,
    p2Profile,
    playSumoSfx,
    qualityMode,
  ]);

  const handleEquipRank = async (tier: number | null) => {
    setEquippedRankTier(tier);
    try {
      await sessionFetch('/api/sumo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, tier }),
      });
      void fetchSumoProgress();
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  const cdTsuppariLeft = Math.max(0, Math.ceil((cdTsuppariUntil - nowTick) / 100) / 10);
  const cdYorikiriLeft = Math.max(0, Math.ceil((cdYorikiriUntil - nowTick) / 100) / 10);
  const cdShikoLeft = Math.max(0, Math.ceil((cdShikoUntil - nowTick) / 100) / 10);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none">
      <div
        className={`relative w-full max-w-3xl max-h-[95dvh] flex flex-col rounded-2xl border-2 border-amber-400/90 bg-gradient-to-b from-purple-950 via-slate-950 to-zinc-950 shadow-[0_0_50px_rgba(245,158,11,0.38)] overflow-hidden transition-transform duration-75 ${
          shake ? 'translate-x-1.5 -translate-y-1' : ''
        }`}
      >
        {/* Top Kokugikan Sumo Header */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-purple-950 via-red-950 to-amber-950 border-b-2 border-amber-400/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl sm:text-3xl drop-shadow">🏯</span>
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-kanit)] font-black tracking-wide text-base sm:text-lg text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-red-400 truncate">
                สังเวียนซูโม่ฮอกไกโด • ดันพุงชิงตำแหน่งโยโกซึนะ!
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-amber-100">
                <span className={`px-2 py-0.5 rounded border text-[10px] font-black ${wornRank.badgeClass}`}>
                  {wornRank.isYokozuna ? '👑 ' : ''}
                  {wornRank.name}
                </span>
                <span className="text-amber-300 font-black">XP: {totalXp.toLocaleString()}</span>
                <span className="text-emerald-300">• ชนะ {wins} แมตช์</span>
                <span className="text-sky-300 hidden sm:inline">
                  • โบนัสชนะวันนี้ {dailyWinCoins}/{dailyWinCoinCap} 💰
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              cleanupPvpChannels();
              setModeState('lobby');
              onClose();
            }}
            className="w-9 h-9 rounded-lg bg-red-600 hover:bg-red-500 text-white border-2 border-amber-300 font-black text-base flex items-center justify-center cursor-pointer shrink-0 shadow"
          >
            ✕
          </button>
        </div>

        {/* Rank Progress Bar */}
        <div className="px-4 py-1.5 bg-slate-950/90 border-b border-purple-900/60">
          <div className="flex items-center justify-between text-[10.5px] font-extrabold text-amber-200 mb-1">
            <span>
              {resolvedRank.nextRank
                ? `ยศถัดไป: ${resolvedRank.nextRank.name} (${resolvedRank.nextRank.minXp.toLocaleString()} XP • รับโบนัส +${resolvedRank.nextRank.promotionCoins} 💰)`
                : '👑 คุณบรรลุจุดสูงสุดแห่งซูโม่: จักรพรรดิโยโกซึนะ (Grand Yokozuna)!'}
            </span>
            <span>{resolvedRank.progressPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
            <div
              className="h-full bg-gradient-to-r from-amber-400 via-red-500 to-purple-500 transition-all duration-300"
              style={{ width: `${resolvedRank.progressPct}%` }}
            />
          </div>
        </div>

        {/* Main Content Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {modeState === 'lobby' && (
            <>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-amber-400/30">
                <button
                  type="button"
                  onClick={() => setActiveTab('solo')}
                  className={`py-2 rounded-lg text-xs sm:text-sm font-extrabold cursor-pointer transition ${
                    activeTab === 'solo'
                      ? 'bg-gradient-to-r from-red-600 to-amber-500 text-white shadow'
                      : 'text-amber-100/75 hover:bg-slate-800'
                  }`}
                >
                  🤖 ดวลบอทไต่ยศ
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('pvp')}
                  className={`py-2 rounded-lg text-xs sm:text-sm font-extrabold cursor-pointer transition ${
                    activeTab === 'pvp'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-500 text-white shadow'
                      : 'text-amber-100/75 hover:bg-slate-800'
                  }`}
                >
                  ⚔️ ดวลสด 1v1
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('ranks')}
                  className={`py-2 rounded-lg text-xs sm:text-sm font-extrabold cursor-pointer transition ${
                    activeTab === 'ranks'
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow'
                      : 'text-amber-100/75 hover:bg-slate-800'
                  }`}
                >
                  🏆 ทำเนียบ & ยศ
                </button>
              </div>

              {activeTab === 'solo' && (
                <div className="space-y-2.5">
                  <div className="bg-purple-950/50 border border-amber-400/40 rounded-xl p-2.5 text-xs text-amber-100/90 flex items-center justify-between gap-2">
                    <span>
                      💡 <b>กติกาซูโม่แท้ (ชนะ 2 ใน 3 ยก):</b> ดันคู่ต่อสู้ให้หลุดออกนอกวงเชือกฟางสีทอง (Ring Out!) ชนะรับทันที <b>+5 💰</b> และสะสม XP เลื่อนยศถึง <b>โยโกซึนะ</b>!
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {SUMO_BOT_OPPONENTS.map((bot) => {
                      const botRank = SUMO_RANKS[bot.rankTier] ?? SUMO_RANKS[0];
                      return (
                        <div
                          key={bot.id}
                          className="rounded-xl border-2 border-amber-400/40 bg-slate-900/90 p-3 flex flex-col justify-between gap-2.5 hover:border-amber-300 transition"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-900 to-red-900 border border-amber-300/60 flex items-center justify-center text-2xl shrink-0">
                              {bot.emoji}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-extrabold text-sm text-amber-200 truncate">
                                {bot.name}
                              </div>
                              <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded border text-[9.5px] font-black ${botRank.badgeClass}`}>
                                {bot.title}
                              </span>
                              <p className="text-[11px] text-slate-300 mt-1 leading-snug">
                                {bot.desc}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                            <span className="text-[11px] font-extrabold text-emerald-300">
                              ชนะรับ +{bot.winXp} XP • +5 💰
                            </span>
                            <button
                              type="button"
                              onClick={() => startBotChallenge(bot)}
                              className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-slate-950 font-black text-xs border border-white cursor-pointer hover:brightness-110 shadow"
                            >
                              🏯 ขึ้นสังเวียน!
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activeTab === 'pvp' && (
                <div className="rounded-2xl border-2 border-purple-400/50 bg-slate-900/90 p-4 space-y-3 text-center">
                  <div className="text-3xl">⚔️🏯</div>
                  <h3 className="font-[family-name:var(--font-kanit)] text-lg font-black text-amber-300">
                    เปิดศึกซูโม่ดันพุงสด 1v1 กับเพื่อน!
                  </h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto">
                    ตั้งรหัสห้องเดียวกันทั้ง 2 คน แล้วกดเข้าห้องเพื่อขึ้นสังเวียนชนพุงแบบเรียลไทม์ ใครหลุดออกนอกวงเชือกฟางก่อนแพ้ยกนั้นทันที!
                  </p>
                  <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
                    <input
                      type="text"
                      value={roomInput}
                      onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                      maxLength={12}
                      placeholder="รหัสห้อง เช่น SUMO"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border-2 border-amber-400/60 text-center font-black text-amber-200 tracking-widest uppercase"
                    />
                    <button
                      type="button"
                      onClick={joinPvpRoom}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-500 to-amber-400 text-slate-950 font-black text-xs sm:text-sm border-2 border-white shrink-0 cursor-pointer shadow"
                    >
                      เข้าห้อง 1v1
                    </button>
                  </div>
                  {connError && <p className="text-xs text-rose-400 font-bold">{connError}</p>}
                </div>
              )}

              {activeTab === 'ranks' && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-amber-400/40 bg-slate-900/90 p-3">
                    <h4 className="text-xs font-black text-amber-300 mb-2">
                      🏆 ทำเนียบยอดริกิชิสูงสุดประจำเกาะฮอกไกโด (Top 5)
                    </h4>
                    {leaderboard.length === 0 ? (
                      <p className="text-xs text-slate-400">ยังไม่มีผู้ประเดิมสังเวียน มาเป็นโยโกซึนะคนแรกของเกาะกัน!</p>
                    ) : (
                      <div className="space-y-1.5">
                        {leaderboard.map((lb, idx) => (
                          <div
                            key={lb.userId}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-black text-amber-400 w-5">#{idx + 1}</span>
                              <span>{lb.emoji}</span>
                              <span className="font-extrabold text-white truncate">{lb.name}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-amber-200 border border-amber-400/40">
                                {lb.isYokozuna ? '👑 ' : ''}
                                {lb.rankName}
                              </span>
                            </div>
                            <span className="font-black text-emerald-300 shrink-0">
                              {lb.totalXp.toLocaleString()} XP ({lb.wins} ชนะ)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-purple-500/40 bg-slate-900/90 p-3">
                    <h4 className="text-xs font-black text-amber-200 mb-2">
                      🎽 เลือกสีผ้าคาดเอว Mawashi (ปลดล็อกตามยศ Banzuke)
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {SUMO_RANKS.map((rk) => {
                        const unlocked = rk.tier <= resolvedRank.rank.tier;
                        const active = wornRank.tier === rk.tier;
                        return (
                          <button
                            key={rk.id}
                            type="button"
                            disabled={!unlocked}
                            onClick={() => void handleEquipRank(rk.tier === resolvedRank.rank.tier ? null : rk.tier)}
                            className={`p-2 rounded-lg border text-left transition ${
                              active
                                ? 'border-amber-300 bg-purple-950/90 ring-1 ring-amber-300 cursor-pointer'
                                : unlocked
                                  ? 'border-slate-700 bg-slate-950/70 hover:border-amber-400/60 cursor-pointer'
                                  : 'border-slate-800 bg-slate-950/40 opacity-45 cursor-not-allowed'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-extrabold text-amber-100 truncate">
                                {rk.isYokozuna ? '👑 ' : ''}
                                {rk.name}
                              </span>
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-white shrink-0"
                                style={{ backgroundColor: rk.mawashiHex }}
                              />
                            </div>
                            <div className="text-[9.5px] text-slate-400 mt-0.5">
                              {rk.minXp.toLocaleString()} XP {rk.promotionCoins > 0 ? `• +${rk.promotionCoins} 💰` : ''}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {modeState === 'waiting_pvp' && (
            <div className="rounded-2xl border-2 border-amber-400/60 bg-slate-900/95 p-5 text-center space-y-4">
              <div className="text-xs font-black text-amber-300 uppercase tracking-widest">
                ห้องประลองซูโม่ #{roomCode}
              </div>
              <div className="grid grid-cols-3 items-center gap-2 max-w-md mx-auto">
                <div className="p-3 rounded-xl bg-slate-950 border border-amber-400/50">
                  <div className="text-2xl">{p1Profile?.emoji || '⏳'}</div>
                  <div className="text-xs font-extrabold text-amber-200 truncate mt-1">
                    {p1Profile?.name || 'รอผู้เล่น 1...'}
                  </div>
                </div>
                <div className="font-black text-xl text-red-400">VS</div>
                <div className="p-3 rounded-xl bg-slate-950 border border-sky-400/50">
                  <div className="text-2xl">{p2Profile?.emoji || '⏳'}</div>
                  <div className="text-xs font-extrabold text-sky-200 truncate mt-1">
                    {p2Profile?.name || 'รอเพื่อนเข้าห้อง...'}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    cleanupPvpChannels();
                    setModeState('lobby');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-bold cursor-pointer"
                >
                  กลับหน้าล็อบบี้
                </button>
                <button
                  type="button"
                  disabled={!p1Profile || !p2Profile}
                  onClick={startLivePvpMatch}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-slate-950 font-black text-xs sm:text-sm border-2 border-white cursor-pointer disabled:opacity-40"
                >
                  {p1Profile && p2Profile ? '🏯 เริ่มประลองซูโม่!' : 'กำลังรอคู่ต่อสู้...'}
                </button>
              </div>
            </div>
          )}

          {(modeState === 'fighting' || modeState === 'match_end') && (
            <div className="space-y-2.5">
              {/* Match Scoreboard Strip */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/90 border border-amber-400/50 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{p1Profile?.emoji}</span>
                  <div className="min-w-0">
                    <div className="font-extrabold text-amber-200 truncate">{p1Profile?.name}</div>
                    <div className="flex gap-1 mt-0.5">
                      {[0, 1].map((i) => (
                        <span
                          key={i}
                          className={`w-2.5 h-2.5 rounded-full border border-white ${
                            roundScore.p1 > i ? 'bg-amber-400' : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="text-center shrink-0 px-2">
                  <div className="text-[10px] font-black text-amber-400">ยกที่ {roundNumber} (2 ใน 3)</div>
                  <div className="font-black text-sm text-white">
                    {roundScore.p1} - {roundScore.p2}
                  </div>
                </div>

                <div className="flex items-center gap-2 min-w-0 text-right">
                  <div className="min-w-0">
                    <div className="font-extrabold text-sky-200 truncate">{p2Profile?.name}</div>
                    <div className="flex justify-end gap-1 mt-0.5">
                      {[0, 1].map((i) => (
                        <span
                          key={i}
                          className={`w-2.5 h-2.5 rounded-full border border-white ${
                            roundScore.p2 > i ? 'bg-sky-400' : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <span className="text-lg">{p2Profile?.emoji}</span>
                </div>
              </div>

              {/* 3D Sumo Dohyo Viewport */}
              <div className="relative w-full h-[250px] sm:h-[310px] rounded-2xl overflow-hidden border-2 border-amber-400/70 bg-slate-950">
                <div ref={stageRef} className="w-full h-full" />

                {/* Impact Sparks */}
                {sparks.map((sp) => (
                  <div
                    key={sp.id}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 font-black text-xs sm:text-sm drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)] animate-bounce whitespace-nowrap"
                    style={{ left: `${sp.xPct}%`, top: `${sp.yPct}%`, color: sp.colorHex }}
                  >
                    {sp.text}
                  </div>
                ))}

                {/* Round Banner */}
                {banner && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                    <div className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-700 via-amber-500 to-purple-800 border-2 border-white text-white font-black text-base sm:text-xl shadow-2xl">
                      {banner}
                    </div>
                  </div>
                )}

                {/* Match End Overlay */}
                {modeState === 'match_end' && matchWinner && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center space-y-2.5">
                    <div className="text-4xl">
                      {matchWinner === mySide ? '🏆🏯' : '❄️💪'}
                    </div>
                    <h3 className="font-[family-name:var(--font-kanit)] text-xl sm:text-2xl font-black text-amber-300">
                      {matchWinner === mySide
                        ? 'ชนะศึกสังเวียนซูโม่ฮอกไกโด!!'
                        : `${(matchWinner === 'p1' ? p1Profile?.name : p2Profile?.name) || 'คู่ต่อสู้'} ชนะการประลอง!`}
                    </h3>
                    {matchRewardSummary && (
                      <div className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-amber-400/60 text-xs font-extrabold text-emerald-300 space-y-0.5">
                        <div>
                          ได้รับ +{matchRewardSummary.xpGained} Sumo XP
                          {matchRewardSummary.coinsEarned > 0 ? ` • +${matchRewardSummary.coinsEarned} 💰 GP!` : ''}
                        </div>
                        {matchRewardSummary.promotedName && (
                          <div className="text-amber-300">
                            🎉 เลื่อนยศใหม่เป็น: {matchRewardSummary.promotedName}!
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setModeState('lobby')}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-extrabold border border-slate-600 cursor-pointer"
                      >
                        กลับล็อบบี้สังเวียน
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          isBotMatch ? startBotChallenge(selectedBot) : startLivePvpMatch()
                        }
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-slate-950 text-xs font-black border-2 border-white cursor-pointer"
                      >
                        🏯 ประลองซ้ำอีกครั้ง!
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tactile Touch + Keyboard Controls */}
              {modeState === 'fighting' && (
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-950/90 border border-slate-800 rounded-xl p-2.5">
                  {/* Left: 4-way D-Pad + Brace */}
                  <div className="sm:col-span-5 flex items-center justify-center gap-2">
                    <div className="grid grid-cols-3 gap-1 w-28">
                      <div />
                      <button
                        type="button"
                        onPointerDown={() => (inputRef.current.up = true)}
                        onPointerUp={() => (inputRef.current.up = false)}
                        onPointerLeave={() => (inputRef.current.up = false)}
                        className="h-8 rounded bg-slate-800 active:bg-amber-400 active:text-black text-white font-black text-xs border border-slate-600"
                      >
                        ▲
                      </button>
                      <div />
                      <button
                        type="button"
                        onPointerDown={() => (inputRef.current.left = true)}
                        onPointerUp={() => (inputRef.current.left = false)}
                        onPointerLeave={() => (inputRef.current.left = false)}
                        className="h-8 rounded bg-slate-800 active:bg-amber-400 active:text-black text-white font-black text-xs border border-slate-600"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onPointerDown={() => (inputRef.current.down = true)}
                        onPointerUp={() => (inputRef.current.down = false)}
                        onPointerLeave={() => (inputRef.current.down = false)}
                        className="h-8 rounded bg-slate-800 active:bg-amber-400 active:text-black text-white font-black text-xs border border-slate-600"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onPointerDown={() => (inputRef.current.right = true)}
                        onPointerUp={() => (inputRef.current.right = false)}
                        onPointerLeave={() => (inputRef.current.right = false)}
                        className="h-8 rounded bg-slate-800 active:bg-amber-400 active:text-black text-white font-black text-xs border border-slate-600"
                      >
                        ▶
                      </button>
                    </div>

                    <button
                      type="button"
                      onPointerDown={() => (inputRef.current.brace = true)}
                      onPointerUp={() => (inputRef.current.brace = false)}
                      onPointerLeave={() => (inputRef.current.brace = false)}
                      className="px-2.5 py-3 rounded-xl bg-sky-950 active:bg-sky-400 active:text-slate-950 text-sky-200 border border-sky-400/60 font-extrabold text-[11px]"
                    >
                      🛡️ ย่อตั้งหลัก
                      <div className="text-[9px] opacity-75">กดค้าง / Shift</div>
                    </button>
                  </div>

                  {/* Right: 3 Sumo Techniques */}
                  <div className="sm:col-span-7 grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={cdTsuppariLeft > 0}
                      onClick={() => executeSumoMove(mySide, 'tsuppari')}
                      className="py-2 px-1.5 rounded-xl bg-gradient-to-b from-sky-400 to-blue-600 text-slate-950 border-2 border-white font-black text-[11px] cursor-pointer disabled:opacity-45 shadow"
                    >
                      <div>✋ ฝ่ามือรัว</div>
                      <div className="text-[9.5px] font-bold">
                        {cdTsuppariLeft > 0 ? `${cdTsuppariLeft}s` : '[Space / J]'}
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={cdYorikiriLeft > 0}
                      onClick={() => executeSumoMove(mySide, 'yorikiri')}
                      className="py-2 px-1.5 rounded-xl bg-gradient-to-b from-orange-400 to-red-600 text-white border-2 border-amber-200 font-black text-[11px] cursor-pointer disabled:opacity-45 shadow"
                    >
                      <div>🐗 พุ่งชนพุง!</div>
                      <div className="text-[9.5px] font-bold">
                        {cdYorikiriLeft > 0 ? `${cdYorikiriLeft}s` : '[ปุ่ม K]'}
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={cdShikoLeft > 0}
                      onClick={() => executeSumoMove(mySide, 'shiko_quake')}
                      className="py-2 px-1.5 rounded-xl bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 text-slate-950 border-2 border-white font-black text-[11px] cursor-pointer disabled:opacity-45 shadow"
                    >
                      <div>🌋 กระทืบพื้น!</div>
                      <div className="text-[9.5px] font-bold">
                        {cdShikoLeft > 0 ? `${cdShikoLeft}s` : '[ปุ่ม L]'}
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
