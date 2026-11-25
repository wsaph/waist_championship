'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  getBeltCommandLoadout,
  getBeltSwatchStyle,
  TAEKWONDO_BELTS,
  type TaekwondoBelt,
  type TaekwondoKickPose,
  type TaekwondoMove,
} from './catalog';
import {
  ACTION_GRACE_BUFFER_MS,
  GUEST_HELD_KEEPALIVE_MS,
  GUEST_IDLE_ECHO_DELAY_MS,
  GuestInputWatchdog,
  createBackgroundHostTicker,
} from '@/games/shared/realtimeSync';

export interface TkdCharacterAppearance {
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

interface TaekwondoPvpArenaProps {
  players?: TkdCharacterAppearance[];
  qualityMode?: QualityMode;
  currentUserId: number | null;
  playerName: string;
  playerEmoji: string;
  realBelt: TaekwondoBelt;
  wornBelt: TaekwondoBelt;
  autoJoinRoomCode?: string;
  onParticipationChange?: (participating: boolean, clientId: string, isHostNow: boolean) => void;
  onBackToLobby: () => void;
  onMatchXpEarned?: (xpScore: number) => void;
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
}

interface PvpFighterProfile {
  clientId: string;
  userId: number;
  name: string;
  emoji: string;
  beltTier: number;
  wornTier: number;
  colorHex: string;
  bandColor?: string;
  species?: string;
  equipHat?: string;
  equipFace?: string;
  equipArmor?: string;
  equipWeapon?: string;
  equipWings?: string;
  equipAura?: string;
  bellyScale?: number;
  muscleScale?: number;
}

interface FighterKinematics {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  blocking: boolean;
  pose: TaekwondoKickPose;
  attackTimer: number;
  spinType: 'none' | 'flip' | 'spin360' | 'dragon720';
  trailHex: string;
  hurtTimer: number;
  wobbleVel: number;
  wobbleAngle: number;
}

interface PvpSpark {
  id: number;
  xPct: number;
  yPct: number;
  text: string;
  colorHex: string;
}

const MAX_HP = 100;
const PVP_ROUND_SECONDS = 60;
const STAGE_HALF_WIDTH = 4.6;
const GRAVITY = -25;
const JUMP_VY = 10.2;
const MOVE_SPEED = 5.4;

const FALLBACK_PVP_MID: TaekwondoMove = {
  id: 'pvp_side_kick',
  minTier: 0,
  codeName: 'SIDE KICK',
  thName: 'พุ่งเตะข้าง',
  emoji: '💥',
  pose: 'side_kick',
  trailHex: '#f97316',
  bonusDesc: 'พุ่งเตะข้างกระเด็น',
  scoreBonusPct: 10,
  splashTargets: 1,
  cooldownSec: 1,
  slot: 'mid',
};

const FALLBACK_PVP_ULT: TaekwondoMove = {
  id: 'pvp_flip_kick',
  minTier: 0,
  codeName: 'SOMERSAULT KICK',
  thName: 'ตีลังกาเตะไข่แตก!',
  emoji: '🥚',
  pose: 'flying_spin',
  trailHex: '#facc15',
  bonusDesc: 'กระโดดตีลังกาฟาดกลางอากาศ',
  scoreBonusPct: 15,
  splashTargets: 1,
  cooldownSec: 4,
  slot: 'ultimate',
};

function buildSunsetBackdropTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Iconic Egg-Fighter warm orange/red/purple sunset gradient sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 360);
    skyGrad.addColorStop(0, '#a82218');
    skyGrad.addColorStop(0.35, '#e86a24');
    skyGrad.addColorStop(0.72, '#f5a742');
    skyGrad.addColorStop(1, '#fbd07c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 1024, 360);

    // Glowing Sunset Sun on the upper-left (just like the Egg Fighter reference!)
    const sunGrad = ctx.createRadialGradient(145, 115, 10, 145, 115, 92);
    sunGrad.addColorStop(0, '#fff7cc');
    sunGrad.addColorStop(0.45, '#ff8c24');
    sunGrad.addColorStop(0.8, 'rgba(255,94,19,0.55)');
    sunGrad.addColorStop(1, 'rgba(255,94,19,0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(145, 115, 92, 0, Math.PI * 2);
    ctx.fill();

    // Left warm sunset mountain peak + snow cap
    ctx.fillStyle = '#c25953';
    ctx.beginPath();
    ctx.moveTo(-40, 355);
    ctx.lineTo(145, 155);
    ctx.lineTo(360, 355);
    ctx.closePath();
    ctx.fill();

    // Right purple/indigo Fuji-style mountains with snow caps
    const drawMountain = (peakX: number, peakY: number, baseHalfW: number, bodyCol: string) => {
      ctx.fillStyle = bodyCol;
      ctx.beginPath();
      ctx.moveTo(peakX - baseHalfW, 360);
      ctx.lineTo(peakX, peakY);
      ctx.lineTo(peakX + baseHalfW, 360);
      ctx.closePath();
      ctx.fill();

      // Snow cap
      ctx.fillStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(peakX, peakY);
      ctx.lineTo(peakX - baseHalfW * 0.24, peakY + (360 - peakY) * 0.26);
      ctx.lineTo(peakX - baseHalfW * 0.06, peakY + (360 - peakY) * 0.21);
      ctx.lineTo(peakX + baseHalfW * 0.08, peakY + (360 - peakY) * 0.28);
      ctx.lineTo(peakX + baseHalfW * 0.22, peakY + (360 - peakY) * 0.24);
      ctx.closePath();
      ctx.fill();
    };

    drawMountain(310, 215, 160, '#a64d59');
    drawMountain(935, 225, 185, '#5b3e82');
    drawMountain(710, 148, 285, '#4c2f7a');

    // Calm purple-blue evening water strip along horizon
    const waterGrad = ctx.createLinearGradient(0, 345, 0, 512);
    waterGrad.addColorStop(0, '#5a4378');
    waterGrad.addColorStop(0.25, '#433266');
    waterGrad.addColorStop(1, '#2b1e3d');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, 345, 1024, 167);

    // Subtle horizontal water shimmer lines
    ctx.strokeStyle = 'rgba(255,215,150,0.22)';
    ctx.lineWidth = 2;
    for (let y = 356; y < 420; y += 11) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(980, y);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function attachTaekwondoBelt3D(
  charParts: CharacterMeshParts,
  belt: TaekwondoBelt,
  bellyScale = 1
): THREE.Group {
  const beltGroup = new THREE.Group();
  const radius = 0.44 * Math.max(0.86, Math.min(1.38, bellyScale * 0.95));

  // Primary belt ring around waist
  const topRing = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.055, 10, 28),
    new THREE.MeshStandardMaterial({ color: belt.beltHex, roughness: 0.55 })
  );
  topRing.rotation.x = Math.PI / 2;
  beltGroup.add(topRing);

  // Secondary ring for authentic 2-color belts!
  if (belt.secondaryHex) {
    const subRing = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.01, 0.036, 10, 28),
      new THREE.MeshStandardMaterial({ color: belt.secondaryHex, roughness: 0.55 })
    );
    subRing.rotation.x = Math.PI / 2;
    subRing.position.y = -0.032;
    beltGroup.add(subRing);
  }

  // Front knot + 2 hanging tails
  const knot = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 10, 10),
    new THREE.MeshStandardMaterial({ color: belt.beltHex, roughness: 0.5 })
  );
  knot.position.set(0, -0.01, radius + 0.03);
  beltGroup.add(knot);

  const tailL = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.34, 0.03),
    new THREE.MeshStandardMaterial({ color: belt.beltHex, roughness: 0.6 })
  );
  tailL.position.set(-0.07, -0.17, radius + 0.04);
  tailL.rotation.z = 0.24;

  const tailR = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.34, 0.03),
    new THREE.MeshStandardMaterial({
      color: belt.secondaryHex || belt.stripeHex || belt.beltHex,
      roughness: 0.6,
    })
  );
  tailR.position.set(0.07, -0.17, radius + 0.04);
  tailR.rotation.z = -0.24;
  beltGroup.add(tailL, tailR);

  beltGroup.position.set(0, 0.72, 0);
  charParts.bounceGroup.add(beltGroup);
  return beltGroup;
}

export function TaekwondoPvpArena({
  players = [],
  qualityMode = 'auto',
  currentUserId,
  playerName,
  playerEmoji,
  realBelt,
  wornBelt,
  autoJoinRoomCode,
  onParticipationChange,
  onBackToLobby,
  onMatchXpEarned,
  onLobbyBroadcast,
}: TaekwondoPvpArenaProps) {
  const onLobbyBroadcastRef = useRef(onLobbyBroadcast);
  onLobbyBroadcastRef.current = onLobbyBroadcast;
  const onParticipationChangeRef = useRef(onParticipationChange);
  onParticipationChangeRef.current = onParticipationChange;
  const [roomCode, setRoomCode] = useState<string>(autoJoinRoomCode || 'DOJO');
  const [roomInput, setRoomInput] = useState<string>(autoJoinRoomCode || 'DOJO');
  const [connStatus, setConnStatus] = useState<
    'setup' | 'connecting' | 'waiting' | 'fighting' | 'finished'
  >('setup');
  const [isBotMatch, setIsBotMatch] = useState<boolean>(false);
  const [connError, setConnError] = useState<string>('');
  const [mySide, setMySide] = useState<'p1' | 'p2'>('p1');
  const [timeLeft, setTimeLeft] = useState<number>(PVP_ROUND_SECONDS);
  const [banner, setBanner] = useState<string | null>(null);
  const [winnerSide, setWinnerSide] = useState<'p1' | 'p2' | 'draw' | null>(null);
  const [shake, setShake] = useState<boolean>(false);
  const [sparks, setSparks] = useState<PvpSpark[]>([]);
  const [hpHud, setHpHud] = useState<{ p1: number; p2: number }>({ p1: MAX_HP, p2: MAX_HP });
  const [activeMoveBanner, setActiveMoveBanner] = useState<{ side: 'p1' | 'p2'; text: string } | null>(null);
  const [cdBasicUntil, setCdBasicUntil] = useState<number>(0);
  const [cdMidUntil, setCdMidUntil] = useState<number>(0);
  const [cdUltUntil, setCdUltUntil] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  const [p1Profile, setP1Profile] = useState<PvpFighterProfile | null>(null);
  const [p2Profile, setP2Profile] = useState<PvpFighterProfile | null>(null);

  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const clientIdRef = useRef<string>(
    `tkd-${currentUserId || 'g'}-${Math.random().toString(36).slice(2, 8)}`
  );
  const sbRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const mySideRef = useRef<'p1' | 'p2'>('p1');
  const isBotMatchRef = useRef<boolean>(false);
  isBotMatchRef.current = isBotMatch;
  const connStatusRef = useRef(connStatus);
  connStatusRef.current = connStatus;
  const winnerSideRef = useRef<'p1' | 'p2' | 'draw' | null>(null);
  winnerSideRef.current = winnerSide;
  const sparkIdRef = useRef<number>(1);
  const rewardClaimedRef = useRef<boolean>(false);
  // Remote opponent target for smooth 60 FPS Lerp (eliminates 16Hz packet snap jitter!)
  const remoteTargetRef = useRef<{ x: number; y: number; active: boolean }>({
    x: 2.3,
    y: 0,
    active: false,
  });

  // Live 60fps input & kinematics refs for Three.js loop
  const holdInputRef = useRef<{ left: boolean; right: boolean; block: boolean }>({
    left: false,
    right: false,
    block: false,
  });
  const lastSentTkdInputSigRef = useRef<string>('0,0,0');
  const remoteHoldInputRef = useRef<{ left: boolean; right: boolean; block: boolean }>({
    left: false,
    right: false,
    block: false,
  });
  const tkdWatchdogRef = useRef<
    GuestInputWatchdog<'p2', { left: boolean; right: boolean; block: boolean }>
  >(new GuestInputWatchdog());
  const guestJumpBufferedUntilRef = useRef<number>(0);
  const tkdIdleEchoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tkdKeepaliveIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  interface TkdNetSnap {
    seq: number;
    p1x: number;
    p1y: number;
    p1vx: number;
    p1vy: number;
    p1f: 1 | -1;
    p1b: boolean;
    p2x: number;
    p2y: number;
    p2vx: number;
    p2vy: number;
    p2f: 1 | -1;
    p2b: boolean;
  }
  const prevTkdSnapRef = useRef<TkdNetSnap | null>(null);
  const currTkdSnapRef = useRef<TkdNetSnap | null>(null);
  const currTkdSnapRecvMsRef = useRef<number>(0);
  const tkdHostSeqRef = useRef<number>(0);
  const lastRecvTkdSeqRef = useRef<number>(0);

  const kinRef = useRef<{ p1: FighterKinematics; p2: FighterKinematics }>({
    p1: {
      x: -2.3,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      hp: MAX_HP,
      blocking: false,
      pose: 'idle',
      attackTimer: 0,
      spinType: 'none',
      trailHex: '#38bdf8',
      hurtTimer: 0,
      wobbleVel: 0,
      wobbleAngle: 0,
    },
    p2: {
      x: 2.3,
      y: 0,
      vx: 0,
      vy: 0,
      facing: -1,
      hp: MAX_HP,
      blocking: false,
      pose: 'idle',
      attackTimer: 0,
      spinType: 'none',
      trailHex: '#facc15',
      hurtTimer: 0,
      wobbleVel: 0,
      wobbleAngle: 0,
    },
  });

  const meAppearance = players.find((p) => p.id === currentUserId);
  const buildMyProfile = useCallback((): PvpFighterProfile => {
    return {
      clientId: clientIdRef.current,
      userId: currentUserId || 0,
      name: meAppearance?.name || playerName,
      emoji: meAppearance?.emoji || playerEmoji,
      beltTier: realBelt.tier,
      wornTier: wornBelt.tier,
      colorHex: meAppearance?.colorHex || '#F8FAFC',
      bandColor: meAppearance?.bandColor || wornBelt.beltHex,
      species: meAppearance?.species || 'egg',
      equipHat: meAppearance?.equipHat || 'none',
      equipFace: meAppearance?.equipFace || 'face_none',
      equipArmor: meAppearance?.equipArmor || 'armor_none',
      equipWeapon: 'weapon_none',
      equipWings: meAppearance?.equipWings || 'wings_none',
      equipAura: meAppearance?.equipAura || 'aura_none',
      bellyScale: meAppearance?.bellyScale ?? meAppearance?.bmiBellyScale ?? 1.08,
      muscleScale: meAppearance?.muscleScale ?? 1,
    };
  }, [currentUserId, meAppearance, playerEmoji, playerName, realBelt.tier, wornBelt.beltHex, wornBelt.tier]);

  const loadout = getBeltCommandLoadout(realBelt.tier);

  useEffect(() => {
    const participating =
      connStatus === 'connecting' ||
      connStatus === 'waiting' ||
      connStatus === 'fighting' ||
      connStatus === 'finished';
    const isHostNow =
      !isBotMatch &&
      mySide === 'p1' &&
      (connStatus === 'waiting' || connStatus === 'fighting');
    onParticipationChangeRef.current?.(participating, clientIdRef.current, isHostNow);
  }, [connStatus, isBotMatch, mySide]);

  useEffect(() => {
    if (!onLobbyBroadcastRef.current) return;
    if (connStatus === 'waiting' && mySide === 'p1') {
      const emitWait = () => {
        onLobbyBroadcastRef.current?.({
          roomCode: roomCode || 'DOJO',
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
                    isBot: false,
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
    if (connStatus === 'fighting' && (isBotMatch || mySide === 'p1')) {
      const emitFight = () => {
        onLobbyBroadcastRef.current?.({
          roomCode: roomCode || 'DOJO',
          hostUserId: currentUserId || 0,
          hostName: p1Profile?.name || playerName,
          hostEmoji: p1Profile?.emoji || playerEmoji,
          count: isBotMatch ? 1 : 2,
          max: 2,
          status: 'started',
          scoreLeft: Math.round(hpHud.p1),
          scoreRight: Math.round(hpHud.p2),
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
              name: p2Profile?.name || 'คู่ซ้อม AI',
              emoji: p2Profile?.emoji || '🤖',
              team: 'right',
              isBot: isBotMatch,
            },
          ],
        });
      };
      emitFight();
      const iv = setInterval(emitFight, 4500);
      return () => clearInterval(iv);
    }
    if (connStatus === 'finished' && (isBotMatch || mySide === 'p1')) {
      onLobbyBroadcastRef.current?.({
        roomCode: roomCode || 'DOJO',
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
    connStatus,
    isBotMatch,
    mySide,
    roomCode,
    currentUserId,
    playerName,
    playerEmoji,
    p1Profile,
    p2Profile,
    hpHud.p1,
    hpHud.p2,
  ]);
  const moveBasic = loadout.basic;
  const moveMid = loadout.mid || FALLBACK_PVP_MID;
  const moveUlt = loadout.ultimate || FALLBACK_PVP_ULT;

  const playSfx = useCallback((kind: 'jump' | 'hit' | 'block' | 'whiff' | 'ult' | 'ko') => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const t = ctx.currentTime;
      const tone = (f1: number, f2: number, start: number, dur: number, type: OscillatorType, vol: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f1, t + start);
        osc.frequency.exponentialRampToValueAtTime(f2, t + start + dur);
        g.gain.setValueAtTime(vol, t + start);
        g.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(t + start);
        osc.stop(t + start + dur + 0.02);
      };
      if (kind === 'jump') {
        tone(210, 480, 0, 0.11, 'sine', 0.14);
      } else if (kind === 'ult') {
        tone(140, 48, 0, 0.2, 'sawtooth', 0.26);
        tone(420, 1280, 0.04, 0.18, 'triangle', 0.22);
      } else if (kind === 'hit') {
        tone(185, 58, 0, 0.13, 'sawtooth', 0.23);
        tone(380, 760, 0.02, 0.1, 'triangle', 0.15);
      } else if (kind === 'block') {
        tone(520, 310, 0, 0.09, 'square', 0.14);
      } else if (kind === 'ko') {
        tone(320, 72, 0, 0.38, 'sawtooth', 0.25);
        tone(660, 920, 0.18, 0.26, 'triangle', 0.18);
      } else {
        tone(260, 160, 0, 0.08, 'triangle', 0.1);
      }
      setTimeout(() => ctx.close().catch(() => { }), 750);
    } catch {
      // ignore
    }
  }, []);

  const addSpark = useCallback((worldX: number, worldY: number, text: string, colorHex: string) => {
    const id = sparkIdRef.current++;
    const xPct = Math.max(12, Math.min(88, ((worldX + 5.2) / 10.4) * 100));
    const yPct = Math.max(16, Math.min(82, 76 - worldY * 14));
    setSparks((prev) => [...prev.slice(-6), { id, xPct, yPct, text, colorHex }]);
    setTimeout(() => setSparks((prev) => prev.filter((s) => s.id !== id)), 620);
  }, []);

  const resetKinematics = useCallback(() => {
    kinRef.current.p1 = {
      x: -2.3,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      hp: MAX_HP,
      blocking: false,
      pose: 'idle',
      attackTimer: 0,
      spinType: 'none',
      trailHex: '#38bdf8',
      hurtTimer: 0,
      wobbleVel: 0,
      wobbleAngle: 0,
    };
    kinRef.current.p2 = {
      x: 2.3,
      y: 0,
      vx: 0,
      vy: 0,
      facing: -1,
      hp: MAX_HP,
      blocking: false,
      pose: 'idle',
      attackTimer: 0,
      spinType: 'none',
      trailHex: '#facc15',
      hurtTimer: 0,
      wobbleVel: 0,
      wobbleAngle: 0,
    };
    holdInputRef.current = { left: false, right: false, block: false };
    remoteHoldInputRef.current = { left: false, right: false, block: false };
    lastSentTkdInputSigRef.current = '0,0,0';
    prevTkdSnapRef.current = null;
    currTkdSnapRef.current = null;
    lastRecvTkdSeqRef.current = 0;
    setHpHud({ p1: MAX_HP, p2: MAX_HP });
  }, []);

  const sendPvpPacket = useCallback((event: string, payload: Record<string, unknown>) => {
    const packet = { ...payload, _sender: clientIdRef.current };
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event, payload: packet });
    }
    if (bcRef.current) {
      try {
        bcRef.current.postMessage({
          event,
          payload: packet,
        });
      } catch {
        // ignore
      }
    }
  }, []);

  // Event-driven Guest input sender: transmits ONLY on keydown/keyup or touch button press/release,
  // plus 150ms Idle Echo Pulse on full release & 1.2s Keepalive while held!
  const setLocalTkdHoldInput = useCallback(
    (field: 'left' | 'right' | 'block', val: boolean) => {
      if (holdInputRef.current[field] === val) return;
      holdInputRef.current[field] = val;
      if (isBotMatchRef.current || mySideRef.current === 'p1' || connStatusRef.current !== 'fighting') {
        return;
      }
      const inp = holdInputRef.current;
      const sig = `${inp.left ? 1 : 0},${inp.right ? 1 : 0},${inp.block ? 1 : 0}`;
      if (sig === lastSentTkdInputSigRef.current) return;
      lastSentTkdInputSigRef.current = sig;
      sendPvpPacket('tkd_input', { ...inp });

      const isNeutral = !inp.left && !inp.right && !inp.block;
      if (tkdIdleEchoRef.current) {
        clearTimeout(tkdIdleEchoRef.current);
        tkdIdleEchoRef.current = null;
      }
      if (isNeutral) {
        if (tkdKeepaliveIvRef.current) {
          clearInterval(tkdKeepaliveIvRef.current);
          tkdKeepaliveIvRef.current = null;
        }
        tkdIdleEchoRef.current = setTimeout(() => {
          tkdIdleEchoRef.current = null;
          const cur = holdInputRef.current;
          if (!cur.left && !cur.right && !cur.block) {
            sendPvpPacket('tkd_input', { ...cur });
          }
        }, GUEST_IDLE_ECHO_DELAY_MS);
      } else if (!tkdKeepaliveIvRef.current) {
        tkdKeepaliveIvRef.current = setInterval(() => {
          if (
            isBotMatchRef.current ||
            mySideRef.current === 'p1' ||
            connStatusRef.current !== 'fighting'
          ) {
            return;
          }
          const cur = holdInputRef.current;
          if (cur.left || cur.right || cur.block) {
            sendPvpPacket('tkd_input', { ...cur });
          }
        }, GUEST_HELD_KEEPALIVE_MS);
      }
    },
    [sendPvpPacket]
  );

  const leaveRoom = useCallback(() => {
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
      void ch
        .untrack()
        .catch(() => {})
        .finally(() => {
          void sb.removeChannel(ch).finally(() => {
            sb.realtime.disconnect();
          });
        });
    } else if (sb) {
      sb.realtime.disconnect();
    }
    remoteTargetRef.current.active = false;
    setIsBotMatch(false);
    setP1Profile(null);
    setP2Profile(null);
    setWinnerSide(null);
    setBanner(null);
    setConnStatus('setup');
  }, []);

  useEffect(() => {
    return () => {
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
        void ch
          .untrack()
          .catch(() => {})
          .finally(() => {
            void sb.removeChannel(ch).finally(() => {
              sb.realtime.disconnect();
            });
          });
      } else if (sb) {
        sb.realtime.disconnect();
      }
    };
  }, []);

  const finishPvpMatch = useCallback(
    (winner: 'p1' | 'p2' | 'draw', isKo: boolean) => {
      if (connStatusRef.current === 'finished') return;
      connStatusRef.current = 'finished';
      setConnStatus('finished');
      setWinnerSide(winner);
      setBanner(isKo ? 'K.O.!!' : 'TIME OVER!');
      playSfx('ko');

      const iWon = winner === mySideRef.current;
      if (iWon) {
        confetti({ particleCount: 110, spread: 85, origin: { y: 0.55 } });
      }
      if (!rewardClaimedRef.current) {
        rewardClaimedRef.current = true;
        onMatchXpEarned?.(iWon ? 85 : 40);
      }
      setTimeout(() => setBanner(null), 1400);
    },
    [onMatchXpEarned, playSfx]
  );

  // Start instant 1v1 sparring against an Egg-Master AI Bot (uses another player's 3D character or Sensei Egg!)
  const startBotSparring = useCallback(() => {
    leaveRoom();
    const meProf = buildMyProfile();
    const rivalCandidate = players.find((p) => p.id !== currentUserId);
    const botTier = Math.min(TAEKWONDO_BELTS.length - 1, Math.max(2, wornBelt.tier + 1));
    const botProf: PvpFighterProfile = {
      clientId: 'ai-egg-sensei',
      userId: rivalCandidate?.id || -99,
      name: rivalCandidate ? `${rivalCandidate.name} (บอท)` : 'อาจารย์ไข่ทองคำ',
      emoji: rivalCandidate?.emoji || '🥚',
      beltTier: botTier,
      wornTier: botTier,
      colorHex: rivalCandidate?.colorHex || '#FACC15',
      bandColor: TAEKWONDO_BELTS[botTier].beltHex,
      species: rivalCandidate?.species || 'egg',
      equipHat: rivalCandidate?.equipHat || 'none',
      equipFace: rivalCandidate?.equipFace || 'face_none',
      equipArmor: rivalCandidate?.equipArmor || 'armor_none',
      equipWeapon: 'weapon_none',
      equipWings: rivalCandidate?.equipWings || 'wings_none',
      equipAura: rivalCandidate?.equipAura || 'aura_none',
      bellyScale: rivalCandidate?.bellyScale ?? 1.15,
      muscleScale: 1,
    };

    mySideRef.current = 'p1';
    setMySide('p1');
    setIsBotMatch(true);
    setRoomCode('BOT');
    setP1Profile(meProf);
    setP2Profile(botProf);
    rewardClaimedRef.current = false;
    resetKinematics();
    setTimeLeft(PVP_ROUND_SECONDS);
    setWinnerSide(null);
    setConnStatus('fighting');
    setBanner('ROUND 1 • FIGHT!');
    setTimeout(() => setBanner(null), 950);
  }, [buildMyProfile, currentUserId, leaveRoom, players, resetKinematics, wornBelt.tier]);

  // Apply hit resolution on defender (shared by Realtime & AI Bot)
  const applyHitToFighter = useCallback(
    (
      defenderSide: 'p1' | 'p2',
      attackerX: number,
      dmg: number,
      knockPower: number,
      trailHex: string,
      isUlt: boolean,
      broadcastConfirm: boolean
    ) => {
      const def = kinRef.current[defenderSide];
      const blocked = def.blocking;
      const actualDmg = blocked ? Math.max(2, Math.round(dmg * 0.25)) : dmg;
      def.hp = Math.max(0, def.hp - actualDmg);
      const knockDir = def.x >= attackerX ? 1 : -1;
      def.vx = knockDir * (blocked ? knockPower * 0.35 : knockPower);
      if (!blocked) {
        def.vy = Math.max(def.vy, isUlt ? 7.8 : 5.2);
        def.hurtTimer = 0.32;
        def.wobbleVel = -knockDir * 14;
      }

      setHpHud({ p1: kinRef.current.p1.hp, p2: kinRef.current.p2.hp });
      playSfx(blocked ? 'block' : isUlt ? 'ult' : 'hit');
      addSpark(
        def.x,
        def.y + 0.9,
        blocked ? `🛡️ กันได้! -${actualDmg}` : `💥 -${actualDmg}`,
        blocked ? '#38bdf8' : trailHex
      );
      if (!blocked) {
        setShake(true);
        setTimeout(() => setShake(false), 150);
      }

      if (broadcastConfirm) {
        sendPvpPacket('hit_confirm', {
          defenderSide,
          hp: def.hp,
          x: def.x,
          y: def.y,
          vx: def.vx,
          vy: def.vy,
          actualDmg,
          blocked,
          trailHex,
        });
      }

      if (def.hp <= 0) {
        finishPvpMatch(defenderSide === 'p1' ? 'p2' : 'p1', true);
      }
    },
    [addSpark, finishPvpMatch, playSfx, sendPvpPacket]
  );

  // Connect to Real-time 1v1 Room via Supabase + BroadcastChannel multi-tab support
  const joinRoom = useCallback(
    (rawCode: string) => {
      const cleanCode =
        rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'DOJO';
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      leaveRoom();
      setIsBotMatch(false);
      setRoomInput(cleanCode);
      setRoomCode(cleanCode);
      setConnError('');
      setConnStatus('connecting');

      const meProf = buildMyProfile();
      const myJoinedAt = Date.now();
      const peerMap = new Map<string, PvpFighterProfile & { joinedAt: number }>();
      peerMap.set(meProf.clientId, { ...meProf, joinedAt: myJoinedAt });

      // Hydrate full player props from local `players` list when userId matches!
      const enrich = (prof: PvpFighterProfile | null): PvpFighterProfile | null => {
        if (!prof) return null;
        const found = players.find((pl) => pl.id === prof.userId);
        if (!found) return prof;
        return {
          ...prof,
          colorHex: found.colorHex || prof.colorHex,
          bandColor: found.bandColor || prof.bandColor,
          species: found.species || prof.species,
          equipHat: found.equipHat || prof.equipHat,
          equipFace: found.equipFace || prof.equipFace,
          equipArmor: found.equipArmor || prof.equipArmor,
          equipWings: found.equipWings || prof.equipWings,
          equipAura: found.equipAura || prof.equipAura,
          bellyScale: found.bellyScale ?? found.bmiBellyScale ?? prof.bellyScale,
          muscleScale: found.muscleScale ?? prof.muscleScale,
        };
      };

      const syncPeerMapToState = () => {
        const sorted = Array.from(peerMap.values()).sort((a, b) =>
          (a.joinedAt || 0) !== (b.joinedAt || 0)
            ? (a.joinedAt || 0) - (b.joinedAt || 0)
            : a.clientId.localeCompare(b.clientId)
        );
        const slot1 = sorted[0] || null;
        const slot2 = sorted[1] || null;
        setP1Profile(enrich(slot1));
        setP2Profile(enrich(slot2));
        const side: 'p1' | 'p2' = slot2?.clientId === clientIdRef.current ? 'p2' : 'p1';
        mySideRef.current = side;
        setMySide(side);
      };
      syncPeerMapToState();

      const handlePeerLeft = (leftId: string) => {
        if (!leftId || leftId === clientIdRef.current || !peerMap.has(leftId)) return;
        const departed = peerMap.get(leftId);
        peerMap.delete(leftId);
        syncPeerMapToState();
        if (connStatusRef.current === 'fighting') {
          connStatusRef.current = 'waiting';
          setConnStatus('waiting');
          setBanner(`⚠️ ${departed?.name || 'คู่ต่อสู้'} ออกจากห้องดวล!`);
          setTimeout(() => setBanner(null), 1800);
        }
      };

      const handlePvpEvent = (event: string, payload: Record<string, unknown>) => {
        if (!payload || payload._sender === clientIdRef.current) return;
        if (event === 'hello_peer' && payload.profile) {
          const prof = payload.profile as PvpFighterProfile;
          const jAt = Number(payload.joinedAt || Date.now());
          const had = peerMap.has(prof.clientId);
          peerMap.set(prof.clientId, { ...prof, joinedAt: jAt });
          syncPeerMapToState();
          if (!had) {
            sendPvpPacket('hello_peer', { profile: meProf, joinedAt: myJoinedAt });
          }
        } else if (event === 'bye_peer' && payload.clientId) {
          handlePeerLeft(String(payload.clientId));
        } else if (event === 'start_fight') {
          rewardClaimedRef.current = false;
          resetKinematics();
          setTimeLeft(PVP_ROUND_SECONDS);
          setWinnerSide(null);
          connStatusRef.current = 'fighting';
          setConnStatus('fighting');
          setBanner('ROUND 1 • FIGHT!');
          setTimeout(() => setBanner(null), 950);
        } else if (event === 'tkd_input' && mySideRef.current === 'p1') {
          if (connStatusRef.current !== 'fighting') return;
          const nextG = {
            left: Boolean(payload.left),
            right: Boolean(payload.right),
            block: Boolean(payload.block),
          };
          remoteHoldInputRef.current = nextG;
          tkdWatchdogRef.current.record('p2', nextG, performance.now());
        } else if (event === 'tkd_jump' && mySideRef.current === 'p1') {
          if (connStatusRef.current !== 'fighting') return;
          const gK = kinRef.current.p2;
          if (gK.y <= 0.08) {
            gK.vy = JUMP_VY;
            gK.blocking = false;
            guestJumpBufferedUntilRef.current = 0;
            playSfx('jump');
          } else {
            // 120ms Jump Grace Buffer if Guest tapped jump just before landing!
            guestJumpBufferedUntilRef.current = performance.now() + ACTION_GRACE_BUFFER_MS;
          }
        } else if (event === 'tkd_state' && mySideRef.current === 'p2') {
          if (connStatusRef.current !== 'fighting') return;
          const seq = Number(payload.seq || 0);
          if (seq <= lastRecvTkdSeqRef.current) return;
          lastRecvTkdSeqRef.current = seq;
          const snap: TkdNetSnap = {
            seq,
            p1x: Number(payload.p1x ?? -2.3),
            p1y: Number(payload.p1y ?? 0),
            p1vx: Number(payload.p1vx ?? 0),
            p1vy: Number(payload.p1vy ?? 0),
            p1f: payload.p1f === -1 ? -1 : 1,
            p1b: Boolean(payload.p1b),
            p2x: Number(payload.p2x ?? 2.3),
            p2y: Number(payload.p2y ?? 0),
            p2vx: Number(payload.p2vx ?? 0),
            p2vy: Number(payload.p2vy ?? 0),
            p2f: payload.p2f === 1 ? 1 : -1,
            p2b: Boolean(payload.p2b),
          };
          prevTkdSnapRef.current = currTkdSnapRef.current || snap;
          currTkdSnapRef.current = snap;
          currTkdSnapRecvMsRef.current = performance.now();
        } else if (event === 'kin_sync') {
          if (connStatusRef.current !== 'fighting') return;
          const side: 'p1' | 'p2' = payload.side === 'p1' ? 'p1' : 'p2';
          if (side === mySideRef.current) return;
          const k = kinRef.current[side];
          if (typeof payload.x === 'number' && typeof payload.y === 'number') {
            remoteTargetRef.current = { x: payload.x, y: payload.y, active: true };
          }
          if (typeof payload.vx === 'number') k.vx = payload.vx;
          if (typeof payload.vy === 'number') k.vy = payload.vy;
          if (payload.facing === 1 || payload.facing === -1) k.facing = payload.facing;
          k.blocking = Boolean(payload.blocking);
        } else if (event === 'fighter_attack') {
          if (connStatusRef.current !== 'fighting') return;
          const attackerSide: 'p1' | 'p2' = payload.side === 'p1' ? 'p1' : 'p2';
          if (attackerSide === mySideRef.current) return;
          const defenderSide: 'p1' | 'p2' = attackerSide === 'p1' ? 'p2' : 'p1';

          const atk = kinRef.current[attackerSide];
          if (typeof payload.x === 'number') atk.x = payload.x;
          if (typeof payload.y === 'number') atk.y = payload.y;
          if (typeof payload.vx === 'number') atk.vx = payload.vx;
          if (typeof payload.vy === 'number') atk.vy = payload.vy;
          atk.pose = (payload.pose as TaekwondoKickPose) || 'front_kick';
          atk.attackTimer = payload.isUlt ? 0.48 : 0.3;
          atk.spinType = (payload.spinType as FighterKinematics['spinType']) || 'none';
          atk.trailHex = String(payload.trailHex || '#facc15');
          atk.blocking = false;

          const moveName = String(payload.moveName || 'KICK!');
          setActiveMoveBanner({ side: attackerSide, text: moveName });
          setTimeout(() => setActiveMoveBanner(null), 520);

          // Authoritative defender hit check!
          if (defenderSide === mySideRef.current) {
            const def = kinRef.current[defenderSide];
            const dx = Math.abs(atk.x - def.x);
            const dy = Math.abs(atk.y - def.y);
            const range = Number(payload.range || 1.9);
            if (dx <= range && dy <= 1.65) {
              applyHitToFighter(
                defenderSide,
                atk.x,
                Number(payload.dmg || 12),
                Number(payload.knock || 7.5),
                atk.trailHex,
                Boolean(payload.isUlt),
                true
              );
            } else {
              playSfx('whiff');
            }
          }
        } else if (event === 'hit_confirm') {
          const defenderSide: 'p1' | 'p2' = payload.defenderSide === 'p1' ? 'p1' : 'p2';
          if (defenderSide === mySideRef.current) return;
          const def = kinRef.current[defenderSide];
          def.hp = Number(payload.hp ?? def.hp);
          if (typeof payload.vx === 'number') def.vx = payload.vx;
          if (typeof payload.vy === 'number') def.vy = payload.vy;
          const blocked = Boolean(payload.blocked);
          const actualDmg = Number(payload.actualDmg ?? 0);
          const trailHex = String(payload.trailHex || '#facc15');
          if (!blocked) {
            def.hurtTimer = 0.32;
            def.wobbleVel = (def.vx >= 0 ? -1 : 1) * 14;
            setShake(true);
            setTimeout(() => setShake(false), 140);
          }
          setHpHud({ p1: kinRef.current.p1.hp, p2: kinRef.current.p2.hp });
          playSfx(blocked ? 'block' : 'hit');
          addSpark(
            def.x,
            def.y + 0.9,
            blocked ? `🛡️ BLOCK -${actualDmg}` : `⚡ HIT! -${actualDmg}`,
            blocked ? '#38bdf8' : trailHex
          );
          if (def.hp <= 0) {
            finishPvpMatch(defenderSide === 'p1' ? 'p2' : 'p1', true);
          }
        }
      };

      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(`waist-tkd-local-${cleanCode}`);
        bc.onmessage = (ev) => {
          if (ev.data?.event) handlePvpEvent(ev.data.event, ev.data.payload);
        };
        bcRef.current = bc;
        bc.postMessage({
          event: 'hello_peer',
          payload: { profile: meProf, joinedAt: myJoinedAt, _sender: clientIdRef.current },
        });
        if (!url || !key) {
          connStatusRef.current = 'waiting';
          setConnStatus('waiting');
        }
      }

      if (!url || !key) {
        if (typeof BroadcastChannel === 'undefined') {
          setConnError('ยังไม่ได้ตั้งค่า Supabase Realtime ในโปรเจกต์');
          setConnStatus('setup');
        }
        return;
      }

      // Create isolated SupabaseClient per room join so rapid exit/rejoin never reuses a channel mid-untrack!
      const sb = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        realtime: { params: { eventsPerSecond: 40 } },
      });
      sbRef.current = sb;

      const ch = sb.channel(`waist-tkd-egg-${cleanCode}`, {
        config: {
          broadcast: { self: false, ack: false },
          presence: { key: clientIdRef.current },
        },
      });
      channelRef.current = ch;

      const syncPresence = () => {
        const state = ch.presenceState<PvpFighterProfile & { joinedAt: number }>();
        for (const m of Object.values(state).flat()) {
          if (m?.clientId) {
            peerMap.set(m.clientId, m);
          }
        }
        syncPeerMapToState();
      };

      ch.on('presence', { event: 'sync' }, syncPresence);
      ch.on('presence', { event: 'join' }, syncPresence);
      ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        syncPresence();
        for (const lp of (leftPresences || []) as unknown as Array<{ clientId?: string }>) {
          if (lp?.clientId) {
            handlePeerLeft(lp.clientId);
          }
        }
      });

      [
        'hello_peer',
        'bye_peer',
        'start_fight',
        'tkd_input',
        'tkd_jump',
        'tkd_state',
        'kin_sync',
        'fighter_attack',
        'hit_confirm',
      ].forEach((evName) => {
        ch.on('broadcast', { event: evName }, ({ payload }) =>
          handlePvpEvent(evName, (payload || {}) as Record<string, unknown>)
        );
      });

      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({
            ...meProf,
            joinedAt: myJoinedAt,
          });
          sendPvpPacket('hello_peer', { profile: meProf, joinedAt: myJoinedAt });
          connStatusRef.current = 'waiting';
          setConnStatus('waiting');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (!bcRef.current) {
            setConnError('เชื่อมต่อห้องเรียลไทม์ไม่สำเร็จ ลองกดเข้าใหม่อีกครั้ง');
            setConnStatus('setup');
          } else {
            connStatusRef.current = 'waiting';
            setConnStatus('waiting');
          }
        }
      });
    },
    [
      addSpark,
      applyHitToFighter,
      buildMyProfile,
      finishPvpMatch,
      leaveRoom,
      playSfx,
      players,
      resetKinematics,
      sendPvpPacket,
    ]
  );

  const autoJoinedTkdRef = useRef<string>('');
  useEffect(() => {
    if (
      autoJoinRoomCode &&
      autoJoinedTkdRef.current !== autoJoinRoomCode &&
      connStatus === 'setup'
    ) {
      autoJoinedTkdRef.current = autoJoinRoomCode;
      joinRoom(autoJoinRoomCode);
    }
  }, [autoJoinRoomCode, connStatus, joinRoom]);

  const startFight = useCallback(() => {
    if (isBotMatchRef.current) {
      startBotSparring();
      return;
    }
    if ((!channelRef.current && !bcRef.current) || !p1Profile || !p2Profile) return;
    rewardClaimedRef.current = false;
    resetKinematics();
    setTimeLeft(PVP_ROUND_SECONDS);
    setWinnerSide(null);
    connStatusRef.current = 'fighting';
    setConnStatus('fighting');
    setBanner('ROUND 1 • FIGHT!');
    setTimeout(() => setBanner(null), 950);
    sendPvpPacket('start_fight', { at: Date.now() });
  }, [p1Profile, p2Profile, resetKinematics, sendPvpPacket, startBotSparring]);

  const triggerJump = useCallback(() => {
    if (connStatusRef.current !== 'fighting') return;
    const me = kinRef.current[mySideRef.current];
    if (me.y <= 0.08) {
      me.vy = JUMP_VY;
      me.blocking = false;
      playSfx('jump');
      if (!isBotMatchRef.current && mySideRef.current === 'p2') {
        sendPvpPacket('tkd_jump', { at: Date.now() });
      }
    }
  }, [playSfx, sendPvpPacket]);

  const performPvpKick = useCallback(
    (slot: 'basic' | 'mid' | 'ult') => {
      if (connStatusRef.current !== 'fighting') return;
      const now = Date.now();
      if (slot === 'basic' && now < cdBasicUntil) return;
      if (slot === 'mid' && now < cdMidUntil) return;
      if (slot === 'ult' && now < cdUltUntil) return;

      const move = slot === 'basic' ? moveBasic : slot === 'mid' ? moveMid : moveUlt;
      const dmg = slot === 'basic' ? 10 : slot === 'mid' ? 16 : 26;
      const range = slot === 'basic' ? 1.85 : slot === 'mid' ? 2.15 : 2.55;
      const knock = slot === 'basic' ? 6.2 : slot === 'mid' ? 8.5 : 11.5;
      const cdMs = slot === 'basic' ? 420 : slot === 'mid' ? 1100 : 4000;

      if (slot === 'basic') setCdBasicUntil(now + cdMs);
      else if (slot === 'mid') setCdMidUntil(now + cdMs);
      else setCdUltUntil(now + cdMs);

      const side = mySideRef.current;
      const oppSide: 'p1' | 'p2' = side === 'p1' ? 'p2' : 'p1';
      const me = kinRef.current[side];
      const opp = kinRef.current[oppSide];

      const dir: 1 | -1 = opp.x >= me.x ? 1 : -1;
      me.facing = dir;
      me.blocking = false;
      holdInputRef.current.block = false;
      me.vx = dir * (slot === 'ult' ? 7.4 : slot === 'mid' ? 5.8 : 4.2);
      if (slot === 'ult' && me.y < 0.4) {
        me.vy = 8.4; // Egg-Fighter aerial somersault leap!
      } else if (slot === 'mid' && me.y <= 0.05) {
        me.vy = 4.2;
      }

      const spinType: FighterKinematics['spinType'] =
        slot === 'ult'
          ? move.pose === 'sky_dragon'
            ? 'dragon720'
            : 'flip'
          : move.pose === 'back_kick' || move.pose === 'flying_spin'
            ? 'spin360'
            : 'none';

      me.pose = move.pose;
      me.attackTimer = slot === 'ult' ? 0.48 : 0.3;
      me.spinType = spinType;
      me.trailHex = move.trailHex;

      const moveLabel = `${move.emoji} ${move.thName}!`;
      setActiveMoveBanner({ side, text: moveLabel });
      setTimeout(() => setActiveMoveBanner(null), 520);
      playSfx(slot === 'ult' ? 'ult' : 'whiff');

      if (isBotMatchRef.current) {
        // Resolve hit locally against AI Bot after a tiny strike-impact frame!
        setTimeout(() => {
          if (connStatusRef.current !== 'fighting') return;
          const dx = Math.abs(kinRef.current[side].x - kinRef.current[oppSide].x);
          const dy = Math.abs(kinRef.current[side].y - kinRef.current[oppSide].y);
          if (dx <= range && dy <= 1.65) {
            applyHitToFighter(oppSide, kinRef.current[side].x, dmg, knock, move.trailHex, slot === 'ult', false);
          }
        }, 70);
      } else {
        sendPvpPacket('fighter_attack', {
          side,
          x: me.x,
          y: me.y,
          vx: me.vx,
          vy: me.vy,
          pose: move.pose,
          spinType,
          dmg,
          range,
          knock,
          moveName: moveLabel,
          trailHex: move.trailHex,
          isUlt: slot === 'ult',
        });
      }
    },
    [
      applyHitToFighter,
      cdBasicUntil,
      cdMidUntil,
      cdUltUntil,
      moveBasic,
      moveMid,
      moveUlt,
      playSfx,
      sendPvpPacket,
    ]
  );

  // Round 1 Hz countdown (no 120ms idle re-render ticker!)
  useEffect(() => {
    if (connStatus !== 'fighting') return;
    const secIv = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          const hp1 = kinRef.current.p1.hp;
          const hp2 = kinRef.current.p2.hp;
          const winner: 'p1' | 'p2' | 'draw' = hp1 > hp2 ? 'p1' : hp2 > hp1 ? 'p2' : 'draw';
          finishPvpMatch(winner, false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      clearInterval(secIv);
    };
  }, [connStatus, finishPvpMatch]);

  // Cooldown ticker ONLY runs when a kick move is actually cooling down!
  useEffect(() => {
    if (connStatus !== 'fighting') return;
    const maxCd = Math.max(cdBasicUntil, cdMidUntil, cdUltUntil);
    if (maxCd <= Date.now()) return;
    setNowTick(Date.now());
    const tickIv = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      if (now >= maxCd) {
        clearInterval(tickIv);
      }
    }, 120);
    return () => clearInterval(tickIv);
  }, [connStatus, cdBasicUntil, cdMidUntil, cdUltUntil]);

  // Keyboard controls (A/D move, W/Space jump, S block, J/K/L kicks — event-driven keydown/keyup!)
  useEffect(() => {
    if (connStatus !== 'fighting') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') setLocalTkdHoldInput('left', true);
      else if (k === 'd' || k === 'arrowright') setLocalTkdHoldInput('right', true);
      else if (k === 'w' || k === 'arrowup' || k === ' ') {
        e.preventDefault();
        if (!e.repeat) triggerJump();
      } else if (k === 's' || k === 'arrowdown') {
        setLocalTkdHoldInput('block', true);
      } else if (!e.repeat && k === 'j') performPvpKick('basic');
      else if (!e.repeat && k === 'k') performPvpKick('mid');
      else if (!e.repeat && k === 'l') performPvpKick('ult');
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'a' || k === 'arrowleft') setLocalTkdHoldInput('left', false);
      else if (k === 'd' || k === 'arrowright') setLocalTkdHoldInput('right', false);
      else if (k === 's' || k === 'arrowdown') setLocalTkdHoldInput('block', false);
    };
    const onBlur = () => {
      setLocalTkdHoldInput('left', false);
      setLocalTkdHoldInput('right', false);
      setLocalTkdHoldInput('block', false);
    };
    const onVis = () => {
      if (document.hidden) onBlur();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      if (tkdIdleEchoRef.current) {
        clearTimeout(tkdIdleEchoRef.current);
        tkdIdleEchoRef.current = null;
      }
      if (tkdKeepaliveIvRef.current) {
        clearInterval(tkdKeepaliveIvRef.current);
        tkdKeepaliveIvRef.current = null;
      }
    };
  }, [connStatus, performPvpKick, setLocalTkdHoldInput, triggerJump]);

  // Three.js 3D Sunset Torii Gate + Real Player 3D Characters + Bouncy Egg-Fighter Physics!
  useEffect(() => {
    const isStageVisible = connStatus === 'fighting' || connStatus === 'finished';
    if (!isStageVisible || !p1Profile || !p2Profile || !stageContainerRef.current) return;

    const container = stageContainerRef.current;
    const qCfg = getQualityConfig(qualityMode);

    const w = container.clientWidth || 640;
    const h = container.clientHeight || 340;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 2.35, 9.4);
    camera.lookAt(0, 1.35, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: qCfg.antialias, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qCfg.maxPixelRatio));
    renderer.setSize(w, h);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Warm Golden Sunset Lighting (matches Egg Fighter screenshot!)
    const ambLight = new THREE.AmbientLight(0xffdcb8, 1.05);
    scene.add(ambLight);
    const sunLight = new THREE.DirectionalLight(0xff9e44, 1.45);
    sunLight.position.set(-6, 7, 5);
    scene.add(sunLight);
    const rimLight = new THREE.DirectionalLight(0xa855f7, 0.55);
    rimLight.position.set(6, 4, -4);
    scene.add(rimLight);

    // 1. Sunset + Mountains + Evening Water Sky Backdrop Plane
    const skyTex = buildSunsetBackdropTexture();
    const skyPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 13),
      new THREE.MeshBasicMaterial({ map: skyTex })
    );
    skyPlane.position.set(0, 3.8, -6.2);
    scene.add(skyPlane);

    // 2. Wooden Dojo Bridge Floor (warm brown planks with dark plank seams!)
    const floorGroup = new THREE.Group();
    const baseFloor = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.4, 6.2),
      new THREE.MeshStandardMaterial({ color: 0x855836, roughness: 0.85 })
    );
    baseFloor.position.set(0, -0.2, 0);
    floorGroup.add(baseFloor);

    const seamMat = new THREE.MeshBasicMaterial({ color: 0x54341d });
    for (let sx = -6.5; sx <= 6.5; sx += 1.3) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 6.2), seamMat);
      seam.position.set(sx, 0.01, 0);
      floorGroup.add(seam);
    }

    // Cute river stones on far left & right edges (just like screenshot!)
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.75 });
    for (const [rx, rz, rs] of [
      [-5.3, 0.8, 0.28],
      [-5.0, 1.05, 0.2],
      [5.2, 0.9, 0.26],
      [4.9, 1.12, 0.18],
    ]) {
      const stone = new THREE.Mesh(new THREE.SphereGeometry(rs, 10, 8), stoneMat);
      stone.scale.y = 0.55;
      stone.position.set(rx, 0.08, rz);
      floorGroup.add(stone);
    }
    scene.add(floorGroup);

    // 3. Iconic Giant Red-Brown Torii Gate Centered Behind Fighters!
    const toriiGroup = new THREE.Group();
    toriiGroup.position.set(0, 0, -2.35);
    const toriiRedMat = new THREE.MeshStandardMaterial({ color: 0x6b140b, roughness: 0.65 });
    const toriiTrimMat = new THREE.MeshStandardMaterial({ color: 0x3f2312, roughness: 0.75 });

    // Two thick pillars
    for (const px of [-1.85, 1.85]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.29, 4.7, 14), toriiRedMat);
      pillar.position.set(px, 2.35, 0);
      toriiGroup.add(pillar);

      const baseBlock = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.28, 12), toriiTrimMat);
      baseBlock.position.set(px, 0.14, 0);
      toriiGroup.add(baseBlock);
    }
    // Lower horizontal tie-beam (Nuki)
    const nuki = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.36, 0.28), toriiRedMat);
    nuki.position.set(0, 3.35, 0);
    toriiGroup.add(nuki);
    // Center strut (Gakuzuka)
    const centerStrut = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.24), toriiTrimMat);
    centerStrut.position.set(0, 3.9, 0);
    toriiGroup.add(centerStrut);
    // Upper lintel (Kasagi + Shimagi)
    const shimagi = new THREE.Mesh(new THREE.BoxGeometry(5.9, 0.26, 0.34), toriiTrimMat);
    shimagi.position.set(0, 4.35, 0);
    const kasagi = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.34, 0.44), toriiRedMat);
    kasagi.position.set(0, 4.62, 0);
    toriiGroup.add(shimagi, kasagi);
    scene.add(toriiGroup);

    // 4. Build Real 3D Player Characters (`buildCharacterMesh`) + 3D Taekwondo Belts!
    const buildFighterVisual = (prof: PvpFighterProfile, isMe: boolean, seed: number) => {
      const wrapper = new THREE.Group();
      const worn = TAEKWONDO_BELTS[prof.wornTier] ?? TAEKWONDO_BELTS[0];
      const charParts = buildCharacterMesh({
        colorHex: prof.colorHex || '#F8FAFC',
        accessory: 'headband',
        bandColor: worn.beltHex,
        bellyScale: prof.bellyScale ?? 1.08,
        muscleScale: prof.muscleScale ?? 1,
        species: prof.species || 'egg',
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

      // Fierce Egg-Fighter determined expression!
      charParts.angryFace.visible = true;
      charParts.normalEyes.visible = false;
      charParts.happyFace.visible = false;

      attachTaekwondoBelt3D(charParts, worn, prof.bellyScale ?? 1.08);
      charParts.rootGroup.scale.setScalar(1.06);
      wrapper.add(charParts.rootGroup);

      // Energy Block Shield Mesh
      const shieldMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 18, 18),
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.32,
          wireframe: false,
        })
      );
      shieldMesh.position.set(0, 0.85, 0);
      shieldMesh.visible = false;
      wrapper.add(shieldMesh);

      // 3D Kick Swoosh Ring
      const kickRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.08, 8, 24, Math.PI * 1.25),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9 })
      );
      kickRing.position.set(0, 0.85, 0);
      kickRing.visible = false;
      wrapper.add(kickRing);

      // Ground indicator ring (Gold = You, Red = Opponent)
      const groundRing = new THREE.Mesh(
        new THREE.RingGeometry(0.58, 0.74, 24),
        new THREE.MeshBasicMaterial({
          color: isMe ? 0xfacc15 : 0xf43f5e,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.85,
        })
      );
      groundRing.rotation.x = -Math.PI / 2;
      groundRing.position.y = 0.025;
      scene.add(groundRing);
      scene.add(wrapper);

      return { wrapper, charParts, shieldMesh, kickRing, groundRing };
    };

    const visP1 = buildFighterVisual(p1Profile, mySideRef.current === 'p1', 0.5);
    const visP2 = buildFighterVisual(p2Profile, mySideRef.current === 'p2', 2.1);

    const onResize = () => {
      if (!stageContainerRef.current) return;
      const nw = stageContainerRef.current.clientWidth || 640;
      const nh = stageContainerRef.current.clientHeight || 340;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let elapsed = 0;
    let lastNetSyncMs = 0;
    let botThinkTimer = 0.6;

    const stepTkdTick = (dt: number, nowMs: number, skipWebgl: boolean) => {
      elapsed += dt;

      const k1 = kinRef.current.p1;
      const k2 = kinRef.current.p2;
      const myK = mySideRef.current === 'p1' ? k1 : k2;
      const oppK = mySideRef.current === 'p1' ? k2 : k1;

      if (connStatusRef.current === 'fighting') {
        // 1. Local fighter input -> smooth horizontal motion & facing
        const inp = holdInputRef.current;
        myK.blocking = inp.block && myK.attackTimer <= 0 && myK.hurtTimer <= 0;
        if (myK.hurtTimer <= 0 && myK.attackTimer <= 0) {
          const moveDir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
          if (myK.blocking) {
            myK.vx *= 0.75;
          } else if (moveDir !== 0) {
            myK.vx = moveDir * MOVE_SPEED;
          } else {
            myK.vx *= 0.78;
          }
        }
        myK.facing = oppK.x >= myK.x ? 1 : -1;
        oppK.facing = myK.x >= oppK.x ? 1 : -1;

        // 2. AI Bot Brain when in Bot Sparring mode!
        if (isBotMatchRef.current) {
          botThinkTimer -= dt;
          const dist = Math.abs(k2.x - k1.x);
          if (k2.hurtTimer <= 0 && k2.attackTimer <= 0) {
            if (dist > 2.05) {
              k2.blocking = false;
              k2.vx = (k1.x > k2.x ? 1 : -1) * (MOVE_SPEED * 0.76);
            } else {
              k2.vx *= 0.8;
            }
            if (botThinkTimer <= 0) {
              botThinkTimer = 0.55 + Math.random() * 0.55;
              const r = Math.random();
              if (k1.attackTimer > 0 && r < 0.42) {
                k2.blocking = true;
                setTimeout(() => {
                  kinRef.current.p2.blocking = false;
                }, 380);
              } else if (dist < 2.25 && r < 0.78) {
                const isHeavy = r > 0.52;
                k2.blocking = false;
                k2.pose = isHeavy ? 'flying_spin' : 'high_kick';
                k2.spinType = isHeavy ? 'flip' : 'none';
                k2.attackTimer = isHeavy ? 0.42 : 0.28;
                k2.trailHex = isHeavy ? '#ef4444' : '#facc15';
                k2.vx = (k1.x >= k2.x ? 1 : -1) * 5.0;
                if (isHeavy && k2.y <= 0.05) k2.vy = 7.4;
                playSfx('whiff');
                setTimeout(() => {
                  if (connStatusRef.current !== 'fighting') return;
                  const curDx = Math.abs(kinRef.current.p2.x - kinRef.current.p1.x);
                  const curDy = Math.abs(kinRef.current.p2.y - kinRef.current.p1.y);
                  if (curDx <= (isHeavy ? 2.2 : 1.85) && curDy <= 1.6) {
                    applyHitToFighter('p1', kinRef.current.p2.x, isHeavy ? 15 : 10, isHeavy ? 8.2 : 6.0, k2.trailHex, isHeavy, false);
                  }
                }, 85);
              } else if (k2.y <= 0.05 && r > 0.82) {
                k2.vy = JUMP_VY * 0.92;
              }
            }
          }
        }

        // 2b. Host (P1) steps Guest (P2) via Watchdog-guarded `tkd_input` + 120ms Jump Grace Buffer!
        if (!isBotMatchRef.current && mySideRef.current === 'p1') {
          const gInp = tkdWatchdogRef.current.read('p2', nowMs, {
            left: false,
            right: false,
            block: false,
          });
          if (nowMs <= guestJumpBufferedUntilRef.current && k2.y <= 0.08) {
            guestJumpBufferedUntilRef.current = 0;
            k2.vy = JUMP_VY;
            k2.blocking = false;
            playSfx('jump');
          }
          k2.blocking = gInp.block && k2.attackTimer <= 0 && k2.hurtTimer <= 0;
          if (k2.hurtTimer <= 0 && k2.attackTimer <= 0) {
            const gDir = (gInp.right ? 1 : 0) - (gInp.left ? 1 : 0);
            if (k2.blocking) {
              k2.vx *= 0.75;
            } else if (gDir !== 0) {
              k2.vx = gDir * MOVE_SPEED;
            } else {
              k2.vx *= 0.78;
            }
          }
        }

        // 3. Step gravity, floor bounce, egg-collision pushback & wobble physics for both fighters
        for (const k of [k1, k2]) {
          k.x += k.vx * dt;
          k.y += k.vy * dt;
          if (k.y > 0) {
            k.vy += GRAVITY * dt;
          }
          if (k.y <= 0) {
            if (k.vy < -4.5) {
              // Cute Egg-Fighter subtle landing bounce!
              k.wobbleVel += (Math.random() > 0.5 ? 1 : -1) * 5;
            }
            k.y = 0;
            k.vy = 0;
          }
          if (k.x < -STAGE_HALF_WIDTH) {
            k.x = -STAGE_HALF_WIDTH;
            k.vx = Math.abs(k.vx) * 0.35;
          } else if (k.x > STAGE_HALF_WIDTH) {
            k.x = STAGE_HALF_WIDTH;
            k.vx = -Math.abs(k.vx) * 0.35;
          }

          if (k.attackTimer > 0) {
            k.attackTimer = Math.max(0, k.attackTimer - dt);
            if (k.attackTimer === 0) {
              k.pose = 'idle';
              k.spinType = 'none';
            }
          }
          if (k.hurtTimer > 0) {
            k.hurtTimer = Math.max(0, k.hurtTimer - dt);
            k.vx *= 0.92;
          }

          // Spring-damper egg wobble
          const springForce = -k.wobbleAngle * 42 - k.wobbleVel * 6.5;
          k.wobbleVel += springForce * dt;
          k.wobbleAngle += k.wobbleVel * dt;
        }

        // Prevent horizontal body overlap on ground
        const minSep = 0.98;
        const dx = k2.x - k1.x;
        if (Math.abs(dx) < minSep && Math.abs(k2.y - k1.y) < 1.0) {
          const push = (minSep - Math.abs(dx)) * 0.5;
          const sign = dx >= 0 ? 1 : -1;
          k1.x = Math.max(-STAGE_HALF_WIDTH, k1.x - sign * push);
          k2.x = Math.min(STAGE_HALF_WIDTH, k2.x + sign * push);
        }

        if (!isBotMatchRef.current) {
          if (mySideRef.current === 'p1') {
            // Host (P1): Broadcast authoritative arena snapshot at exact 20 Hz (every 50 ms)!
            if (nowMs - lastNetSyncMs >= 50) {
              lastNetSyncMs = nowMs;
              tkdHostSeqRef.current += 1;
              sendPvpPacket('tkd_state', {
                seq: tkdHostSeqRef.current,
                p1x: Math.round(k1.x * 100) / 100,
                p1y: Math.round(k1.y * 100) / 100,
                p1vx: Math.round(k1.vx * 100) / 100,
                p1vy: Math.round(k1.vy * 100) / 100,
                p1f: k1.facing,
                p1b: k1.blocking,
                p2x: Math.round(k2.x * 100) / 100,
                p2y: Math.round(k2.y * 100) / 100,
                p2vx: Math.round(k2.vx * 100) / 100,
                p2vy: Math.round(k2.vy * 100) / 100,
                p2f: k2.facing,
                p2b: k2.blocking,
              });
            }
          } else {
            // Guest (P2): 60 FPS Linear Interpolation for P1 + Smooth Reconciliation for predicted local P2!
            const curr = currTkdSnapRef.current;
            if (curr) {
              const prev = prevTkdSnapRef.current || curr;
              const elapsedSnapMs = Math.max(0, nowMs - currTkdSnapRecvMsRef.current);
              const alpha = elapsedSnapMs / 50;
              if (k1.hurtTimer <= 0) {
                if (alpha <= 1.0) {
                  k1.x = prev.p1x + (curr.p1x - prev.p1x) * alpha;
                  k1.y = Math.max(0, prev.p1y + (curr.p1y - prev.p1y) * alpha);
                } else {
                  const extraSec = Math.min(0.05, (elapsedSnapMs - 50) / 1000);
                  k1.x = Math.max(-STAGE_HALF_WIDTH, Math.min(STAGE_HALF_WIDTH, curr.p1x + curr.p1vx * extraSec));
                  k1.y = Math.max(0, curr.p1y + curr.p1vy * extraSec);
                }
                k1.vx = curr.p1vx;
                k1.vy = curr.p1vy;
                k1.facing = curr.p1f;
                k1.blocking = curr.p1b;
              }

              if (k2.hurtTimer <= 0) {
                const extraHostSec = Math.min(0.05, elapsedSnapMs / 1000);
                const authX = Math.max(
                  -STAGE_HALF_WIDTH,
                  Math.min(STAGE_HALF_WIDTH, curr.p2x + curr.p2vx * extraHostSec)
                );
                const authY = Math.max(0, curr.p2y + curr.p2vy * extraHostSec);
                const errDist = Math.hypot(authX - k2.x, authY - k2.y);
                if (errDist > 1.8) {
                  k2.x = curr.p2x;
                  k2.y = Math.max(0, curr.p2y);
                  k2.vx = curr.p2vx;
                  k2.vy = curr.p2vy;
                } else if (errDist > 0.1) {
                  const corr = 1 - Math.exp(-12 * dt);
                  k2.x += (authX - k2.x) * corr;
                  k2.y = Math.max(0, k2.y + (authY - k2.y) * corr);
                }
              }
            }
          }
        }
      }

      // 5. Render 3D Characters, Limbs, Flips, Kicks & KO Poses!
      const syncVisual = (
        vis: ReturnType<typeof buildFighterVisual>,
        k: FighterKinematics,
        side: 'p1' | 'p2'
      ) => {
        const idleHop =
          connStatusRef.current === 'fighting' && k.y <= 0.02 && k.attackTimer <= 0
            ? Math.abs(Math.sin(elapsed * 6.5 + (side === 'p1' ? 0 : 1.6))) * 0.08
            : 0;

        vis.wrapper.position.set(k.x, k.y + idleHop, 0);
        vis.groundRing.position.set(k.x, 0.025, 0);
        const shadowScale = Math.max(0.45, 1 - k.y * 0.16);
        vis.groundRing.scale.setScalar(shadowScale);

        // Face opponent along X axis! (`buildCharacterMesh` faces +Z at yaw=0, so +X is +PI/2, -X is -PI/2)
        let targetYaw = k.facing > 0 ? Math.PI * 0.42 : -Math.PI * 0.42;
        if (k.attackTimer > 0 && (k.spinType === 'spin360' || k.spinType === 'dragon720')) {
          const mult = k.spinType === 'dragon720' ? Math.PI * 4 : Math.PI * 2;
          targetYaw += (1 - k.attackTimer / 0.45) * mult * k.facing;
        }
        vis.wrapper.rotation.y = targetYaw;

        // Egg-Fighter somersault flip / wobble / K.O. knockdown!
        if (connStatusRef.current === 'finished' && k.hp <= 0) {
          vis.wrapper.rotation.z = -k.facing * (Math.PI * 0.46);
          vis.wrapper.position.y = 0.35;
          vis.charParts.angryFace.visible = false;
          vis.charParts.normalEyes.visible = true;
        } else if (connStatusRef.current === 'finished' && winnerSideRef.current === side) {
          vis.wrapper.rotation.z = Math.sin(elapsed * 10) * 0.12;
          vis.wrapper.position.y = Math.abs(Math.sin(elapsed * 8)) * 0.35;
          vis.charParts.angryFace.visible = false;
          vis.charParts.happyFace.visible = true;
        } else if (k.attackTimer > 0 && k.spinType === 'flip') {
          const prog = 1 - k.attackTimer / 0.48;
          vis.wrapper.rotation.z = -k.facing * prog * Math.PI * 2;
        } else {
          const leanForward = k.attackTimer > 0 ? -k.facing * 0.38 : -k.vx * 0.035;
          const idleRock = Math.sin(elapsed * 6.5 + (side === 'p1' ? 0 : 1.6)) * 0.05;
          vis.wrapper.rotation.z = leanForward + k.wobbleAngle + idleRock;
        }

        vis.shieldMesh.visible = k.blocking;
        vis.kickRing.visible = k.attackTimer > 0;
        if (k.attackTimer > 0) {
          (vis.kickRing.material as THREE.MeshBasicMaterial).color.set(k.trailHex);
          vis.kickRing.rotation.z = elapsed * 18 * k.facing;
          vis.kickRing.position.set(k.facing * 0.55, 0.85, 0.25);
        }

        vis.charParts.mixer?.update(dt);
        if (!vis.charParts.mixer) {
          if (k.attackTimer > 0) {
            // Extend kicking leg high out toward opponent!
            vis.charParts.legR.rotation.x = -1.55;
            vis.charParts.legL.rotation.x = 0.35;
            vis.charParts.armL.rotation.z = 1.1;
            vis.charParts.armR.rotation.z = -1.1;
          } else if (k.blocking) {
            vis.charParts.armL.rotation.x = -1.3;
            vis.charParts.armR.rotation.x = -1.3;
            vis.charParts.legL.rotation.x = 0;
            vis.charParts.legR.rotation.x = 0;
          } else {
            const walk = Math.abs(k.vx) > 0.4 ? Math.sin(elapsed * 15) * 0.55 : 0;
            vis.charParts.legL.rotation.x = walk;
            vis.charParts.legR.rotation.x = -walk;
            vis.charParts.armL.rotation.x = -walk * 0.7;
            vis.charParts.armR.rotation.x = walk * 0.7;
            vis.charParts.armL.rotation.z = 0.25;
            vis.charParts.armR.rotation.z = -0.25;
          }
        }
      };

      if (!skipWebgl) {
        syncVisual(visP1, k1, 'p1');
        syncVisual(visP2, k2, 'p2');
        renderer.render(scene, camera);
      }
    };

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (typeof document !== 'undefined' && document.hidden) {
        clock.getDelta();
        return;
      }
      const dt = Math.min(0.033, clock.getDelta());
      stepTkdTick(dt, performance.now(), false);
    };

    let lastBgTkdMs = performance.now();
    const disposeBgTkd = createBackgroundHostTicker((bgNowMs) => {
      if (!isBotMatchRef.current && mySideRef.current === 'p1' && connStatusRef.current === 'fighting') {
        const bgDt = Math.min(0.033, Math.max(0.016, (bgNowMs - lastBgTkdMs) / 1000));
        lastBgTkdMs = bgNowMs;
        stepTkdTick(bgDt, bgNowMs, true);
      }
    }, 50);

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      disposeBgTkd();
      window.removeEventListener('resize', onResize);
      visP1.charParts.rootGroup.userData.disposed = true;
      visP2.charParts.rootGroup.userData.disposed = true;
      skyTex.dispose();
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, [applyHitToFighter, connStatus, p1Profile, p2Profile, playSfx, qualityMode]);

  const p1Belt = TAEKWONDO_BELTS[p1Profile?.wornTier ?? 0] ?? TAEKWONDO_BELTS[0];
  const p2Belt = TAEKWONDO_BELTS[p2Profile?.wornTier ?? 0] ?? TAEKWONDO_BELTS[0];
  const midCdSec = Math.max(0, Math.ceil((cdMidUntil - nowTick) / 1000));
  const ultCdSec = Math.max(0, Math.ceil((cdUltUntil - nowTick) / 1000));

  return (
    <div className="space-y-3">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            leaveRoom();
            onBackToLobby();
          }}
          className="px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-extrabold text-amber-200 cursor-pointer"
        >
          ← กลับหน้าสำนัก
        </button>
        {connStatus !== 'setup' && (
          <span className="px-2.5 py-0.5 rounded bg-orange-950 border border-amber-400 text-yellow-300 text-xs font-black">
            {isBotMatch ? '🤖 โหมดซ้อมบอท' : `⛩️ ห้อง: ${roomCode} (${mySide.toUpperCase()})`}
          </span>
        )}
      </div>

      {/* Setup Screen */}
      {connStatus === 'setup' && (
        <div className="rounded-xl bg-gradient-to-b from-orange-950/70 via-zinc-900 to-black border-2 border-amber-400/80 p-4 space-y-4">
          <div className="text-center space-y-1">
            <div className="text-xs font-black tracking-widest uppercase text-orange-400">
              ⛩️ SUNSET TORII 3D BRAWL • REALTIME 1 VS 1
            </div>
            <h3 className="font-[family-name:var(--font-kanit)] font-black italic text-xl text-yellow-300">
              🥚🥋 ดวลตัวละคร 3D สไตล์เกมไข่สู้กัน หน้าเสาโทริอิ!
            </h3>
            <p className="text-xs text-zinc-300">
              นำตัวละคร 3D ของคุณคาดสายเทควันโดลงไปกระโดด ตีลังกา พุ่งเตะซัดเพื่อนให้กระเด็นแบบเรียลไทม์!
            </p>
          </div>

          {connError && (
            <div className="rounded-lg bg-rose-950/80 border border-rose-500 px-3 py-2 text-xs font-bold text-rose-200 text-center">
              ⚠️ {connError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => joinRoom('DOJO')}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 hover:brightness-110 text-black border-2 border-white font-[family-name:var(--font-kanit)] font-black italic text-sm sm:text-base shadow-[0_4px_0_#7f1d1d] cursor-pointer"
            >
              ⚡ เข้าห้องด่วนกับเพื่อน (ห้อง DOJO)
            </button>
            <button
              type="button"
              onClick={startBotSparring}
              className="py-3 px-3 rounded-xl bg-gradient-to-r from-orange-700 via-amber-700 to-yellow-600 hover:brightness-110 text-white border-2 border-amber-200 font-[family-name:var(--font-kanit)] font-black italic text-sm sm:text-base shadow-[0_4px_0_#451a03] cursor-pointer"
            >
              🤖 ลองซ้อมดวล 1v1 กับบอททันที!
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              placeholder="ใส่รหัสห้องส่วนตัว เช่น 1234"
              maxLength={8}
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-950 border-2 border-zinc-700 text-white font-black uppercase tracking-widest text-sm focus:border-yellow-400 outline-none"
            />
            <button
              type="button"
              onClick={() => joinRoom(roomInput)}
              className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm cursor-pointer"
            >
              เข้าห้อง
            </button>
            <button
              type="button"
              onClick={() => {
                const rand = String(Math.floor(1000 + Math.random() * 9000));
                setRoomInput(rand);
                joinRoom(rand);
              }}
              className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-amber-400/60 text-amber-200 font-extrabold text-xs cursor-pointer whitespace-nowrap"
            >
              🎲 สุ่มห้อง
            </button>
          </div>
        </div>
      )}

      {/* Waiting Room */}
      {(connStatus === 'connecting' || connStatus === 'waiting') && (
        <div className="rounded-xl bg-zinc-950/90 border-2 border-amber-400/70 p-4 space-y-3.5">
          <div className="text-center text-xs font-black uppercase tracking-widest text-amber-300">
            ⛩️ ห้องดวล 1v1 หน้าเสาโทริอิ
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <div className="rounded-xl bg-orange-950/40 border-2 border-amber-400/80 p-3 flex flex-col items-center text-center">
              <span className="text-[10px] font-black text-amber-300 mb-1">PLAYER 1</span>
              {p1Profile ? (
                <>
                  <div className="text-4xl my-2">{p1Profile.emoji}</div>
                  <div className="font-extrabold text-white text-xs truncate max-w-full">{p1Profile.name}</div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-200">
                    <span
                      className="w-3 h-3 rounded-sm border border-white/80 inline-block"
                      style={getBeltSwatchStyle(p1Belt.beltHex, p1Belt.secondaryHex)}
                    />
                    <span>{p1Belt.name}</span>
                  </div>
                </>
              ) : (
                <div className="h-20 flex items-center text-xs text-zinc-500 animate-pulse">กำลังเชื่อมต่อ...</div>
              )}
            </div>

            <div className="font-[family-name:var(--font-kanit)] font-black italic text-3xl text-yellow-400">
              VS
            </div>

            <div className="rounded-xl bg-indigo-950/40 border-2 border-sky-400/80 p-3 flex flex-col items-center text-center">
              <span className="text-[10px] font-black text-sky-300 mb-1">PLAYER 2</span>
              {p2Profile ? (
                <>
                  <div className="text-4xl my-2">{p2Profile.emoji}</div>
                  <div className="font-extrabold text-white text-xs truncate max-w-full">{p2Profile.name}</div>
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-amber-200">
                    <span
                      className="w-3 h-3 rounded-sm border border-white/80 inline-block"
                      style={getBeltSwatchStyle(p2Belt.beltHex, p2Belt.secondaryHex)}
                    />
                    <span>{p2Belt.name}</span>
                  </div>
                </>
              ) : (
                <div className="h-20 flex items-center justify-center text-xs text-zinc-400 animate-pulse">
                  ⏳ รอเพื่อนเข้าห้อง...
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={!p1Profile || !p2Profile}
            onClick={startFight}
            className={`w-full py-3 rounded-xl border-2 font-[family-name:var(--font-kanit)] font-black italic text-base uppercase ${p1Profile && p2Profile
                ? 'bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-black border-white shadow-[0_4px_0_#7f1d1d] cursor-pointer hover:brightness-110'
                : 'bg-zinc-900 text-zinc-500 border-zinc-700 cursor-not-allowed'
              }`}
          >
            {p1Profile && p2Profile ? '⛩️ FIGHT!! เริ่มดวลหน้าเสาโทริอิ!' : '⏳ รอเพื่อนอีกคนเข้าห้อง...'}
          </button>
        </div>
      )}

      {/* Live 3D Sunset Torii Fighting Arena */}
      {(connStatus === 'fighting' || connStatus === 'finished') && p1Profile && p2Profile && (
        <div className={`space-y-2.5 transition-transform duration-75 ${shake ? 'translate-x-1.5 -translate-y-1' : ''}`}>
          {/* Top Health Bars */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-black italic">
                <span className="text-yellow-300 truncate">
                  {p1Profile.emoji} {p1Profile.name} {mySide === 'p1' ? '(คุณ)' : ''}
                </span>
                <span className="text-white">{hpHud.p1} HP</span>
              </div>
              <div className="h-4 sm:h-5 w-full bg-zinc-900 border-2 border-zinc-200 -skew-x-12 overflow-hidden p-0.5">
                <div
                  className={`h-full transition-all duration-150 ${hpHud.p1 <= 25
                      ? 'bg-red-600 animate-pulse'
                      : 'bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300'
                    }`}
                  style={{ width: `${hpHud.p1}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col items-center justify-center px-2.5 py-1 rounded-lg bg-black border-2 border-yellow-400 min-w-[54px]">
              <span className="text-[8px] font-black text-amber-300">TIME</span>
              <span className="font-[family-name:var(--font-kanit)] font-black italic text-xl text-yellow-300 leading-none">
                {timeLeft}
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-black italic">
                <span className="text-white">{hpHud.p2} HP</span>
                <span className="text-sky-300 truncate">
                  {p2Profile.emoji} {p2Profile.name} {mySide === 'p2' ? '(คุณ)' : ''}
                </span>
              </div>
              <div className="h-4 sm:h-5 w-full bg-zinc-900 border-2 border-zinc-200 skew-x-12 overflow-hidden p-0.5">
                <div
                  className={`h-full ml-auto transition-all duration-150 ${hpHud.p2 <= 25
                      ? 'bg-red-600 animate-pulse'
                      : 'bg-gradient-to-l from-blue-500 via-sky-400 to-cyan-300'
                    }`}
                  style={{ width: `${hpHud.p2}%` }}
                />
              </div>
            </div>
          </div>

          {/* 3D WebGL Sunset Torii Stage + Overlays */}
          <div className="relative w-full h-[300px] sm:h-[345px] rounded-xl border-2 border-amber-500/90 overflow-hidden shadow-2xl bg-orange-950">
            <div ref={stageContainerRef} className="w-full h-full" />

            {/* Move Callout Pill */}
            {activeMoveBanner && (
              <div
                className={`pointer-events-none absolute top-3 ${activeMoveBanner.side === 'p1' ? 'left-3' : 'right-3'
                  } -skew-x-12 px-3 py-0.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black border border-white font-[family-name:var(--font-kanit)] font-black italic text-xs shadow-lg z-20`}
              >
                {activeMoveBanner.text}
              </div>
            )}

            {/* Hit / Damage Popups */}
            {sparks.map((s) => (
              <div
                key={s.id}
                style={{ left: `${s.xPct}%`, top: `${s.yPct}%` }}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20"
              >
                <div
                  className="font-[family-name:var(--font-kanit)] font-black italic text-base sm:text-lg drop-shadow-[0_2px_2px_#000] animate-bounce whitespace-nowrap"
                  style={{ color: s.colorHex }}
                >
                  {s.text}
                </div>
              </div>
            ))}

            {/* ROUND 1 • FIGHT! / K.O.! Overlay */}
            {banner && (
              <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/30">
                <div className="px-6 py-2 -skew-x-12 bg-gradient-to-r from-red-700 via-amber-500 to-red-700 border-y-4 border-yellow-200 shadow-2xl">
                  <span className="font-[family-name:var(--font-kanit)] font-black italic text-3xl text-white drop-shadow-[0_3px_0_#000]">
                    {banner}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Bouncy Egg-Fighter Touch & Keyboard Controls */}
          {connStatus === 'fighting' ? (
            <div className="space-y-2">
              {/* Row 1: Left / Jump / Guard / Right */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onPointerDown={() => setLocalTkdHoldInput('left', true)}
                  onPointerUp={() => setLocalTkdHoldInput('left', false)}
                  onPointerLeave={() => setLocalTkdHoldInput('left', false)}
                  className="py-2 rounded-lg bg-zinc-800 active:bg-zinc-600 text-white border-2 border-zinc-500 font-black text-xs cursor-pointer"
                >
                  ⬅️ ซ้าย (A)
                </button>
                <button
                  type="button"
                  onPointerDown={triggerJump}
                  className="py-2 rounded-lg bg-amber-600 hover:bg-amber-500 active:translate-y-0.5 text-white border-2 border-amber-200 font-black text-xs cursor-pointer"
                >
                  ⬆️ กระโดด (W)
                </button>
                <button
                  type="button"
                  onPointerDown={() => setLocalTkdHoldInput('block', true)}
                  onPointerUp={() => setLocalTkdHoldInput('block', false)}
                  onPointerLeave={() => setLocalTkdHoldInput('block', false)}
                  className="py-2 rounded-lg bg-sky-900 active:bg-sky-600 text-sky-100 border-2 border-sky-400 font-black text-xs cursor-pointer"
                >
                  🛡️ การ์ด (S)
                </button>
                <button
                  type="button"
                  onPointerDown={() => setLocalTkdHoldInput('right', true)}
                  onPointerUp={() => setLocalTkdHoldInput('right', false)}
                  onPointerLeave={() => setLocalTkdHoldInput('right', false)}
                  className="py-2 rounded-lg bg-zinc-800 active:bg-zinc-600 text-white border-2 border-zinc-500 font-black text-xs cursor-pointer"
                >
                  ขวา (D) ➡️
                </button>
              </div>

              {/* Row 2: 3 Belt Kick Moves */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onPointerDown={() => performPvpKick('basic')}
                  className="py-2.5 px-1.5 rounded-lg bg-gradient-to-b from-sky-500 to-blue-700 active:translate-y-0.5 text-white border-2 border-sky-200 font-[family-name:var(--font-kanit)] font-black italic text-xs shadow-[0_3px_0_#1e3a8a] cursor-pointer truncate"
                >
                  {moveBasic.emoji} {moveBasic.thName} (J)
                </button>
                <button
                  type="button"
                  disabled={midCdSec > 0}
                  onPointerDown={() => performPvpKick('mid')}
                  className={`py-2.5 px-1.5 rounded-lg border-2 font-[family-name:var(--font-kanit)] font-black italic text-xs truncate ${midCdSec === 0
                      ? 'bg-gradient-to-b from-amber-400 to-orange-600 active:translate-y-0.5 text-black border-yellow-100 shadow-[0_3px_0_#7c2d12] cursor-pointer'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-700 cursor-not-allowed'
                    }`}
                >
                  {midCdSec > 0 ? `⏳ ${midCdSec} วิ` : `${moveMid.emoji} ${moveMid.thName} (K)`}
                </button>
                <button
                  type="button"
                  disabled={ultCdSec > 0}
                  onPointerDown={() => performPvpKick('ult')}
                  className={`py-2.5 px-1.5 rounded-lg border-2 font-[family-name:var(--font-kanit)] font-black italic text-xs truncate ${ultCdSec === 0
                      ? 'bg-gradient-to-b from-red-500 via-rose-600 to-amber-500 active:translate-y-0.5 text-white border-yellow-300 shadow-[0_3px_0_#4c0519] cursor-pointer animate-pulse'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-700 cursor-not-allowed'
                    }`}
                >
                  {ultCdSec > 0 ? `⏳ ${ultCdSec} วิ` : `${moveUlt.emoji} ${moveUlt.thName} (L)`}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-zinc-950/90 border-2 border-yellow-400 p-3 text-center space-y-2.5">
              <div className="font-[family-name:var(--font-kanit)] font-black italic text-xl text-yellow-300">
                {winnerSide === 'draw'
                  ? '🤝 เสมอกัน! (DRAW GAME)'
                  : winnerSide === mySide
                    ? '🏆 ชนะน็อก!! (+85 XP สายเทควันโด)'
                    : `💥 ${winnerSide === 'p1' ? p1Profile.name : p2Profile.name} ชนะ! (+40 XP ฝึกซ้อม)`}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={startFight}
                  className="py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-black border-2 border-white font-[family-name:var(--font-kanit)] font-black italic text-sm cursor-pointer"
                >
                  ⛩️ REMATCH! ดวลอีกรอบ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    leaveRoom();
                    onBackToLobby();
                  }}
                  className="py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-amber-200 border border-amber-400/60 font-extrabold text-sm cursor-pointer"
                >
                  📋 กลับหน้าสำนัก
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
