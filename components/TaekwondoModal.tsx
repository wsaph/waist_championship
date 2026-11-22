'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  getBeltCommandLoadout,
  getBeltSwatchStyle,
  getMoveById,
  getUnlockedTaekwondoMoves,
  resolveTaekwondoBelt,
  TAEKWONDO_BELTS,
  TAEKWONDO_MOVES,
  type TaekwondoBelt,
  type TaekwondoKickPose,
  type TaekwondoMove,
} from '@/lib/taekwondo_catalog';
import { TaekwondoPvpArena } from '@/components/TaekwondoPvpArena';

interface TaekwondoModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: number | null;
  playerName?: string;
  playerEmoji?: string;
  onPointsUpdated?: () => void;
}

type TargetKind = 'pad' | 'board' | 'golden' | 'decoy';

interface FloatingTarget {
  id: number;
  kind: TargetKind;
  xPct: number; // 24..84
  yPct: number; // 20..70
  spawnedAt: number;
  lifeMs: number;
  basePoints: number;
  hit?: 'perfect' | 'good' | 'bad';
}

interface HitPopup {
  id: number;
  xPct: number;
  yPct: number;
  text: string;
  subText?: string;
  colorClass: string;
}

interface FighterMotionState {
  pose: TaekwondoKickPose;
  facing: 'left' | 'right';
  xPct: number;
  yPct: number;
  moveName?: string;
  trailHex?: string;
}

interface KickImpactFx {
  id: number;
  xPct: number;
  yPct: number;
  kind: TargetKind;
  isPerfect: boolean;
  colorHex?: string;
}

interface LeaderboardEntry {
  userId: number;
  name: string;
  emoji: string;
  totalXp: number;
  bestScore: number;
  beltName: string;
  beltHex: string;
  secondaryHex?: string | null;
}

const ROUND_SECONDS = 30;
const MAX_HEARTS = 3;

interface TekkenFighterProps {
  emoji: string;
  belt: TaekwondoBelt;
  pose: TaekwondoKickPose;
  facing: 'left' | 'right';
  rageActive?: boolean;
  trailHex?: string;
  size?: 'sm' | 'lg';
}

function TekkenTaekwondoFighter({
  emoji,
  belt,
  pose,
  facing,
  rageActive = false,
  trailHex,
  size = 'lg',
}: TekkenFighterProps) {
  const isKicking = pose !== 'idle' && pose !== 'hurt';
  const isAerial =
    pose === 'flying_spin' || pose === 'hurricane_540' || pose === 'sky_dragon';
  const flipX = facing === 'left' ? -1 : 1;
  const dims = size === 'sm' ? 'w-28 h-32' : 'w-36 h-40 sm:w-44 sm:h-48';
  const activeTrail = trailHex || (rageActive ? '#facc15' : '#38bdf8');

  const torsoRotate =
    pose === 'axe_kick'
      ? -18
      : pose === 'back_kick'
        ? 24
        : pose === 'high_kick'
          ? -28
          : pose === 'side_kick'
            ? -36
            : pose === 'front_kick'
              ? -16
              : pose === 'flying_spin'
                ? -22
                : pose === 'hurricane_540'
                  ? -34
                  : pose === 'sky_dragon'
                    ? -42
                    : pose === 'hurt'
                      ? -32
                      : 4;

  const kickLegAngle =
    pose === 'axe_kick'
      ? -158
      : pose === 'back_kick'
        ? -102
        : pose === 'high_kick'
          ? -134
          : pose === 'side_kick'
            ? -92
            : pose === 'front_kick'
              ? -76
              : pose === 'flying_spin'
                ? -116
                : pose === 'hurricane_540'
                  ? -138
                  : pose === 'sky_dragon'
                    ? -148
                    : pose === 'hurt'
                      ? -18
                      : 14;

  const supportLegAngle =
    pose === 'sky_dragon'
      ? 54
      : pose === 'hurricane_540'
        ? 48
        : pose === 'flying_spin'
          ? 36
          : pose === 'axe_kick'
            ? 4
            : pose === 'back_kick'
              ? -18
              : pose === 'high_kick'
                ? 12
                : pose === 'side_kick'
                  ? 16
                  : pose === 'front_kick'
                    ? 8
                    : pose === 'hurt'
                      ? 24
                      : -14;

  const frontArmAngle =
    pose === 'sky_dragon'
      ? -115
      : pose === 'hurricane_540'
        ? -98
        : pose === 'flying_spin'
          ? -84
          : pose === 'axe_kick'
            ? 48
            : pose === 'back_kick'
              ? -70
              : pose === 'high_kick'
                ? -44
                : pose === 'side_kick'
                  ? -62
                  : pose === 'front_kick'
                    ? -38
                    : pose === 'hurt'
                      ? -130
                      : -34;

  const backArmAngle =
    pose === 'sky_dragon'
      ? 110
      : pose === 'hurricane_540'
        ? 96
        : pose === 'flying_spin'
          ? 88
          : pose === 'axe_kick'
            ? 68
            : pose === 'back_kick'
              ? 80
              : pose === 'high_kick'
                ? 56
                : pose === 'side_kick'
                  ? 70
                  : pose === 'front_kick'
                    ? 44
                    : pose === 'hurt'
                      ? 100
                      : 32;

  const bodyLiftY =
    pose === 'sky_dragon'
      ? -22
      : pose === 'hurricane_540'
        ? -16
        : pose === 'flying_spin'
          ? -10
          : 0;

  return (
    <div
      className={`relative ${dims} select-none`}
      style={{
        transform: `scaleX(${flipX})`,
        transition: 'transform 75ms ease-out',
      }}
    >
      <svg
        viewBox="0 0 140 155"
        className="w-full h-full overflow-visible drop-shadow-[0_10px_14px_rgba(0,0,0,0.85)]"
      >
        <defs>
          <radialGradient id="tekkenRageAura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={pose === 'sky_dragon' ? '#facc15' : '#ef4444'} stopOpacity="0.7" />
            <stop offset="60%" stopColor="#f97316" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Tekken Rage / Dragon Aura */}
        {(rageActive || pose === 'sky_dragon' || pose === 'hurricane_540') && (
          <ellipse cx="68" cy={88 + bodyLiftY} rx="58" ry="62" fill="url(#tekkenRageAura)" className="animate-pulse" />
        )}

        {/* Perspective Ground Shadow */}
        <ellipse
          cx="68"
          cy="144"
          rx={isAerial ? 20 : 34}
          ry="8"
          fill="rgba(0,0,0,0.6)"
        />

        {/* Dynamic Move-Specific Kick Swoosh Trails */}
        {isKicking && (
          <g>
            {pose === 'axe_kick' ? (
              <>
                <path
                  d="M 88 10 Q 124 44 106 112"
                  fill="none"
                  stroke={activeTrail}
                  strokeWidth="13"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <path
                  d="M 92 16 Q 118 46 102 104"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </>
            ) : pose === 'hurricane_540' || pose === 'sky_dragon' ? (
              <>
                <ellipse
                  cx="76"
                  cy={72 + bodyLiftY}
                  rx="62"
                  ry="24"
                  fill="none"
                  stroke={activeTrail}
                  strokeWidth="10"
                  strokeDasharray="34 14"
                  opacity="0.9"
                />
                <ellipse
                  cx="76"
                  cy={64 + bodyLiftY}
                  rx="54"
                  ry="18"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeDasharray="24 16"
                />
              </>
            ) : (
              <>
                <path
                  d={
                    pose === 'high_kick'
                      ? 'M 72 108 Q 134 80 128 22'
                      : pose === 'flying_spin'
                        ? 'M 56 112 Q 142 74 134 18'
                        : pose === 'back_kick'
                          ? 'M 42 102 Q 108 106 138 66'
                          : 'M 70 106 Q 124 96 140 66'
                  }
                  fill="none"
                  stroke={activeTrail}
                  strokeWidth="12"
                  strokeLinecap="round"
                  opacity="0.85"
                />
                <path
                  d={
                    pose === 'high_kick'
                      ? 'M 78 100 Q 124 76 120 28'
                      : pose === 'flying_spin'
                        ? 'M 64 104 Q 132 72 124 26'
                        : 'M 76 100 Q 118 92 132 68'
                  }
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
              </>
            )}
          </g>
        )}

        {/* Main Articulated Fighter Body */}
        <g
          transform={`translate(68, ${94 + bodyLiftY}) rotate(${torsoRotate})`}
          style={{ transition: 'transform 95ms cubic-bezier(0.2, 1, 0.35, 1)' }}
        >
          {/* Back Arm */}
          <g
            transform={`translate(-12, -28) rotate(${backArmAngle})`}
            style={{ transition: 'transform 95ms ease-out' }}
          >
            <rect x="-8" y="0" width="16" height="26" rx="7" fill="#cbd5e1" stroke="#475569" strokeWidth="2.2" />
            <circle cx="0" cy="30" r="7" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
          </g>

          {/* Support Leg */}
          <g
            transform={`translate(-10, 4) rotate(${supportLegAngle})`}
            style={{ transition: 'transform 95ms ease-out' }}
          >
            <rect x="-9" y="0" width="18" height="38" rx="7" fill="#e2e8f0" stroke="#475569" strokeWidth="2.2" />
            <ellipse cx="4" cy="41" rx="10" ry="5.5" fill="#fde68a" stroke="#92400e" strokeWidth="1.8" />
          </g>

          {/* Kicking Leg */}
          <g
            transform={`translate(10, 2) rotate(${kickLegAngle})`}
            style={{ transition: 'transform 85ms cubic-bezier(0.18, 0.95, 0.3, 1.15)' }}
          >
            <rect
              x="-9"
              y="0"
              width="18"
              height={isKicking ? 50 : 38}
              rx="7"
              fill="#ffffff"
              stroke="#334155"
              strokeWidth="2.2"
            />
            <rect
              x="-8"
              y={isKicking ? 32 : 24}
              width="16"
              height="10"
              rx="3"
              fill={rageActive ? '#dc2626' : belt.tier >= 3 ? belt.beltHex : '#1d4ed8'}
              opacity="0.95"
            />
            <ellipse
              cx="5"
              cy={isKicking ? 53 : 41}
              rx={isKicking ? 12 : 9.5}
              ry="5.5"
              fill="#fde68a"
              stroke="#92400e"
              strokeWidth="2"
            />
            {isKicking && (
              <g transform="translate(12, 53)">
                <circle cx="0" cy="0" r="9.5" fill={activeTrail} opacity="0.9" />
                <circle cx="0" cy="0" r="4.5" fill="#ffffff" />
              </g>
            )}
          </g>

          {/* Crisp White Taekwondo Dobok Torso */}
          <path
            d="M -20 -36 L 20 -36 L 23 8 L -23 8 Z"
            fill="#ffffff"
            stroke="#334155"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <path
            d="M -11 -36 L 0 -17 L 11 -36"
            fill="none"
            stroke={belt.tier >= 5 ? '#0f172a' : '#1e293b'}
            strokeWidth="4"
            strokeLinejoin="round"
          />

          {/* Belt Waistband + Dynamic Flowing Tails (supports 2-color / half belts!) */}
          <rect
            x="-23"
            y="-4"
            width="46"
            height="10"
            rx="3.5"
            fill={belt.beltHex}
            stroke="#0f172a"
            strokeWidth="2"
          />
          {belt.secondaryHex && (
            <rect
              x="-22"
              y="1"
              width="44"
              height="4.5"
              rx="1.5"
              fill={belt.secondaryHex}
            />
          )}
          {belt.stripeHex && <rect x="8" y="-4" width="6" height="10" fill={belt.stripeHex} />}
          <path
            d={isKicking ? 'M -4 4 L -28 22 L -19 27 L 2 8 Z' : 'M -4 4 L -14 27 L -6 29 L 3 8 Z'}
            fill={belt.beltHex}
            stroke="#0f172a"
            strokeWidth="1.6"
          />
          <path
            d={isKicking ? 'M 4 4 L -18 28 L -9 31 L 8 8 Z' : 'M 4 4 L 13 27 L 20 23 L 9 8 Z'}
            fill={belt.secondaryHex || belt.beltHex}
            stroke="#0f172a"
            strokeWidth="1.6"
          />
          <circle cx="0" cy="1" r="5" fill={belt.beltHex} stroke="#0f172a" strokeWidth="1.8" />
          {belt.secondaryHex && (
            <path d="M -4.2 1 A 4.2 4.2 0 0 0 4.2 1 Z" fill={belt.secondaryHex} />
          )}

          {/* Front Guard Arm */}
          <g
            transform={`translate(13, -27) rotate(${frontArmAngle})`}
            style={{ transition: 'transform 95ms ease-out' }}
          >
            <rect x="-8" y="0" width="16" height="25" rx="7" fill="#ffffff" stroke="#334155" strokeWidth="2.2" />
            <circle cx="0" cy="29" r="7.2" fill="#fde68a" stroke="#92400e" strokeWidth="2" />
          </g>

          {/* Fighter Head with Player Emoji + Belt-Colored Headband (supports 2-color!) */}
          <g transform="translate(0, -56)">
            <circle cx="0" cy="0" r="20" fill="#fef3c7" stroke="#78350f" strokeWidth="2.4" />
            <path
              d="M -19 -7 Q 0 -13 19 -7 L 18 -1 Q 0 -7 -18 -1 Z"
              fill={belt.beltHex}
              stroke="#0f172a"
              strokeWidth="1.6"
            />
            {belt.secondaryHex && (
              <path
                d="M -18 -4 Q 0 -9.5 18 -4 L 18 -1 Q 0 -6.5 -18 -1 Z"
                fill={belt.secondaryHex}
              />
            )}
            <path
              d={isKicking ? 'M -18 -6 L -38 -15 L -33 -5 Z' : 'M -18 -5 L -30 -2 L -28 5 Z'}
              fill={belt.secondaryHex || belt.beltHex}
              stroke="#0f172a"
              strokeWidth="1.4"
            />
            <text
              x="0"
              y="8"
              textAnchor="middle"
              fontSize="23"
              style={{ transform: `scaleX(${flipX})`, transformOrigin: '0px 0px' }}
            >
              {pose === 'hurt' ? '😵' : emoji}
            </text>
          </g>
        </g>
      </svg>
    </div>
  );
}

export function TaekwondoModal({
  isOpen,
  onClose,
  currentUserId,
  playerName = 'ผู้กล้า',
  playerEmoji = '🥋',
  onPointsUpdated,
}: TaekwondoModalProps) {
  const [phase, setPhase] = useState<'lobby' | 'playing' | 'result' | 'pvp'>('lobby');
  const [totalXp, setTotalXp] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(0);
  const [equippedBeltTier, setEquippedBeltTier] = useState<number | null>(null);
  const [savingBeltTier, setSavingBeltTier] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(false);

  // Active Tekken-style gameplay state
  const [score, setScore] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);
  const [hearts, setHearts] = useState<number>(MAX_HEARTS);
  const [timeLeft, setTimeLeft] = useState<number>(ROUND_SECONDS);
  const [targets, setTargets] = useState<FloatingTarget[]>([]);
  const [popups, setPopups] = useState<HitPopup[]>([]);
  const [kickImpacts, setKickImpacts] = useState<KickImpactFx[]>([]);
  const [fighter, setFighter] = useState<FighterMotionState>({
    pose: 'idle',
    facing: 'right',
    xPct: 26,
    yPct: 72,
  });
  const [lobbyPreviewMove, setLobbyPreviewMove] = useState<TaekwondoMove | null>(null);
  const [ultReadyAt, setUltReadyAt] = useState<number>(0);
  const [roundBanner, setRoundBanner] = useState<string | null>(null);
  const [arenaShake, setArenaShake] = useState<boolean>(false);
  const [hitFlash, setHitFlash] = useState<boolean>(false);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // Post-round result
  const [savingResult, setSavingResult] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<{
    xpGained: number;
    promotedBelts: TaekwondoBelt[];
    coinsEarned: number;
    endedByKo?: boolean;
    cappedToOneBelt?: boolean;
  } | null>(null);

  const scoreRef = useRef<number>(0);
  const comboRef = useRef<number>(0);
  const maxComboRef = useRef<number>(0);
  const heartsRef = useRef<number>(MAX_HEARTS);
  const phaseRef = useRef<'lobby' | 'playing' | 'result' | 'pvp'>('lobby');
  const targetsRef = useRef<FloatingTarget[]>([]);
  targetsRef.current = targets;
  const targetIdRef = useRef<number>(1);
  const popupIdRef = useRef<number>(1);
  const kickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { belt, nextBelt, progressPct } = resolveTaekwondoBelt(totalXp);
  const wornBelt =
    equippedBeltTier !== null && equippedBeltTier >= 0 && equippedBeltTier <= belt.tier
      ? TAEKWONDO_BELTS[equippedBeltTier] ?? belt
      : belt;
  const isWearingLowerBelt = wornBelt.tier < belt.tier;
  const unlockedMoves = getUnlockedTaekwondoMoves(belt.tier);
  const loadout = getBeltCommandLoadout(belt.tier);
  const isRageMode = combo >= 5;
  const hpPct = Math.round((hearts / MAX_HEARTS) * 100);
  const ragePct = Math.min(100, combo * 10);
  const ultCdLeftSec = Math.max(0, Math.ceil((ultReadyAt - nowTick) / 1000));

  const playKickSfx = useCallback(
    (kind: 'perfect' | 'good' | 'board' | 'ultimate' | 'bad' | 'miss' | 'rankup') => {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const t = ctx.currentTime;
        const tone = (
          f1: number,
          f2: number,
          start: number,
          dur: number,
          type: OscillatorType = 'triangle',
          vol = 0.16
        ) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type;
          osc.frequency.setValueAtTime(f1, t + start);
          osc.frequency.exponentialRampToValueAtTime(f2, t + start + dur);
          gain.gain.setValueAtTime(vol, t + start);
          gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(t + start);
          osc.stop(t + start + dur + 0.02);
        };

        if (kind === 'ultimate') {
          tone(140, 48, 0, 0.18, 'sawtooth', 0.26);
          tone(440, 1320, 0.04, 0.18, 'triangle', 0.22);
          tone(880, 1760, 0.12, 0.2, 'sine', 0.18);
        } else if (kind === 'perfect') {
          tone(160, 62, 0, 0.1, 'sawtooth', 0.22);
          tone(340, 1080, 0.03, 0.12, 'triangle', 0.2);
        } else if (kind === 'board') {
          tone(190, 55, 0, 0.14, 'sawtooth', 0.24);
          tone(680, 980, 0.04, 0.1, 'triangle', 0.15);
        } else if (kind === 'good') {
          tone(220, 95, 0, 0.08, 'sawtooth', 0.16);
          tone(320, 540, 0.02, 0.09, 'triangle', 0.14);
        } else if (kind === 'bad' || kind === 'miss') {
          tone(240, 95, 0, 0.22, 'sawtooth', 0.18);
        } else if (kind === 'rankup') {
          tone(523, 523, 0, 0.1, 'triangle', 0.16);
          tone(659, 659, 0.1, 0.1, 'triangle', 0.16);
          tone(784, 784, 0.2, 0.1, 'triangle', 0.16);
          tone(1046, 1175, 0.3, 0.28, 'triangle', 0.2);
        }
        setTimeout(() => ctx.close().catch(() => { }), 750);
      } catch {
        // ignore
      }
    },
    []
  );

  const loadProfile = useCallback(async () => {
    setLoadingProfile(true);
    try {
      const res = await fetch(`/api/taekwondo?userId=${currentUserId || 0}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTotalXp(Number(data.totalXp ?? 0));
        setBestScore(Number(data.bestScore ?? 0));
        setEquippedBeltTier(
          data.equippedBeltTier === null || data.equippedBeltTier === undefined
            ? null
            : Number(data.equippedBeltTier)
        );
        if (Array.isArray(data.leaderboard)) {
          setLeaderboard(data.leaderboard);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoadingProfile(false);
    }
  }, [currentUserId]);

  const handleEquipBelt = useCallback(
    async (tier: number | null) => {
      if (tier !== null && tier > belt.tier) return;
      const targetTier = tier === belt.tier ? null : tier;
      setSavingBeltTier(tier ?? belt.tier);
      setEquippedBeltTier(targetTier);
      try {
        await fetch('/api/taekwondo', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            tier: targetTier,
          }),
        });
        void loadProfile();
      } catch {
        // keep optimistic local state
      } finally {
        setSavingBeltTier(null);
      }
    },
    [belt.tier, currentUserId, loadProfile]
  );

  useEffect(() => {
    if (!isOpen) return;
    setPhase('lobby');
    phaseRef.current = 'lobby';
    setLastResult(null);
    void loadProfile();
  }, [isOpen, loadProfile]);

  const spawnPopup = useCallback(
    (xPct: number, yPct: number, text: string, colorClass: string, subText?: string) => {
      const id = popupIdRef.current++;
      setPopups((prev) => [...prev.slice(-10), { id, xPct, yPct, text, subText, colorClass }]);
      setTimeout(() => {
        setPopups((prev) => prev.filter((p) => p.id !== id));
      }, 720);
    },
    []
  );

  const finishRound = useCallback(
    async (endedByKo = false) => {
      if (phaseRef.current !== 'playing') return;
      phaseRef.current = 'result';
      setRoundBanner(endedByKo ? 'K.O.!' : 'TIME OVER!');
      setTargets([]);
      setSavingResult(true);

      const finalScore = scoreRef.current;
      const finalMaxCombo = maxComboRef.current;

      setTimeout(() => {
        setRoundBanner(null);
        setPhase('result');
      }, 620);

      try {
        const res = await fetch('/api/taekwondo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserId,
            score: finalScore,
            maxCombo: finalMaxCombo,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.success) {
          setTotalXp(Number(data.totalXp ?? 0));
          setBestScore(Number(data.bestScore ?? finalScore));
          setEquippedBeltTier(
            data.equippedBeltTier === null || data.equippedBeltTier === undefined
              ? null
              : Number(data.equippedBeltTier)
          );
          const promoted: TaekwondoBelt[] = Array.isArray(data.promotedBelts) ? data.promotedBelts : [];
          const coinsEarned = Number(data.coinsEarned ?? 0);
          setLastResult({
            xpGained: Number(data.xpGained ?? finalScore),
            promotedBelts: promoted,
            coinsEarned,
            endedByKo,
            cappedToOneBelt: Boolean(data.cappedToOneBelt),
          });
          if (promoted.length > 0) {
            playKickSfx('rankup');
            confetti({ particleCount: 120, spread: 90, origin: { y: 0.55 } });
            onPointsUpdated?.();
          }
          void loadProfile();
        }
      } catch {
        setLastResult({ xpGained: finalScore, promotedBelts: [], coinsEarned: 0, endedByKo });
      } finally {
        setSavingResult(false);
      }
    },
    [currentUserId, loadProfile, onPointsUpdated, playKickSfx]
  );

  const startRound = useCallback(() => {
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    heartsRef.current = MAX_HEARTS;
    phaseRef.current = 'playing';

    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setHearts(MAX_HEARTS);
    setTimeLeft(ROUND_SECONDS);
    setTargets([]);
    setPopups([]);
    setKickImpacts([]);
    setUltReadyAt(0);
    setLastResult(null);
    setFighter({ pose: 'idle', facing: 'right', xPct: 26, yPct: 72 });
    setPhase('playing');
    setRoundBanner('ROUND 1 • FIGHT!');
    setTimeout(() => setRoundBanner(null), 850);
  }, []);

  // Main game timers
  useEffect(() => {
    if (!isOpen || phase !== 'playing') return;

    const countdownIv = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          void finishRound(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const frameIv = setInterval(() => {
      const now = Date.now();
      setNowTick(now);
      setTargets((prev) => {
        const next: FloatingTarget[] = [];
        let missedCount = 0;
        for (const t of prev) {
          if (t.hit) continue;
          if (now - t.spawnedAt >= t.lifeMs) {
            if (t.kind !== 'decoy') {
              missedCount++;
            }
          } else {
            next.push(t);
          }
        }
        if (missedCount > 0) {
          comboRef.current = 0;
          setCombo(0);
          heartsRef.current = Math.max(0, heartsRef.current - missedCount);
          setHearts(heartsRef.current);
          playKickSfx('miss');
          if (heartsRef.current <= 0) {
            void finishRound(true);
          }
        }
        return next;
      });
    }, 55);

    const spawnOne = () => {
      if (phaseRef.current !== 'playing') return;
      const now = Date.now();
      const speedBoost = Math.min(480, Math.floor(scoreRef.current / 30) * 35);
      const r = Math.random();
      let kind: TargetKind = 'pad';
      let lifeMs = Math.max(920, 1750 - speedBoost);
      let basePoints = 10;

      if (r < 0.15) {
        kind = 'golden';
        lifeMs = Math.max(760, 1260 - speedBoost * 0.7);
        basePoints = 35;
      } else if (r < 0.43) {
        kind = 'board';
        lifeMs = Math.max(900, 1600 - speedBoost * 0.85);
        basePoints = 20;
      } else if (r < 0.56) {
        kind = 'decoy';
        lifeMs = 1450;
        basePoints = 0;
      }

      const newTarget: FloatingTarget = {
        id: targetIdRef.current++,
        kind,
        xPct: 26 + Math.random() * 58,
        yPct: 20 + Math.random() * 48,
        spawnedAt: now,
        lifeMs,
        basePoints,
      };
      setTargets((prev) => [...prev.slice(-4), newTarget]);
    };

    const firstTimer = setTimeout(spawnOne, 380);
    const spawnIv = setInterval(spawnOne, 820);

    return () => {
      clearInterval(countdownIv);
      clearInterval(frameIv);
      clearInterval(spawnIv);
      clearTimeout(firstTimer);
    };
  }, [isOpen, phase, finishRound, playKickSfx]);

  // Pick the coolest unlocked move automatically when tapping a floating target directly
  const pickAutoMoveForTarget = useCallback(
    (target: FloatingTarget, nextCombo: number): TaekwondoMove => {
      if (target.kind === 'golden' && loadout.ultimate) {
        return loadout.ultimate;
      }
      const unlockedIds = new Set(unlockedMoves.map((m) => m.id));
      if (target.kind === 'board' && unlockedIds.has('piercing_side_kick')) {
        return getMoveById('piercing_side_kick');
      }
      if (target.kind === 'board' && unlockedIds.has('axe_kick')) {
        return getMoveById('axe_kick');
      }
      if (nextCombo >= 5 && unlockedIds.has('back_kick')) {
        return getMoveById('back_kick');
      }
      if (target.yPct < 42 && unlockedIds.has('high_roundhouse')) {
        return getMoveById('high_roundhouse');
      }
      return loadout.mid && target.yPct < 52 ? loadout.mid : loadout.basic;
    },
    [loadout.basic, loadout.mid, loadout.ultimate, unlockedMoves]
  );

  const executeMoveOnTargets = useCallback(
    (hitTargets: FloatingTarget[], move: TaekwondoMove) => {
      if (phaseRef.current !== 'playing' || hitTargets.length === 0) return;
      const now = Date.now();
      const hitIds = new Set(hitTargets.map((t) => t.id));
      setTargets((prev) => prev.filter((t) => !hitIds.has(t.id)));
      if (kickTimerRef.current) clearTimeout(kickTimerRef.current);

      const primary = hitTargets[0];

      // Handle decoy bomb hit
      if (primary.kind === 'decoy') {
        comboRef.current = 0;
        setCombo(0);
        heartsRef.current = Math.max(0, heartsRef.current - 1);
        setHearts(heartsRef.current);
        const facing: 'left' | 'right' = primary.xPct < 50 ? 'left' : 'right';
        setFighter({
          pose: 'hurt',
          facing,
          xPct: Math.max(20, Math.min(80, primary.xPct + (facing === 'right' ? -15 : 15))),
          yPct: 74,
          moveName: 'GUARD BREAK!',
          trailHex: '#ef4444',
        });
        const impactId = popupIdRef.current++;
        setKickImpacts((prev) => [
          ...prev.slice(-6),
          { id: impactId, xPct: primary.xPct, yPct: primary.yPct, kind: 'decoy', isPerfect: false },
        ]);
        setTimeout(() => setKickImpacts((prev) => prev.filter((fx) => fx.id !== impactId)), 320);
        setArenaShake(true);
        setTimeout(() => setArenaShake(false), 300);
        playKickSfx('bad');
        spawnPopup(primary.xPct, primary.yPct, '💣 COUNTER! -HP', 'text-rose-400', 'ห้ามเตะระเบิด!');
        kickTimerRef.current = setTimeout(
          () => setFighter({ pose: 'idle', facing: 'right', xPct: 26, yPct: 72 }),
          280
        );
        if (heartsRef.current <= 0) {
          void finishRound(true);
        }
        return;
      }

      let totalGained = 0;
      let anyPerfect = false;

      for (const t of hitTargets) {
        const ageRatio = (now - t.spawnedAt) / t.lifeMs;
        const isPerfect = ageRatio >= 0.35 && ageRatio <= 0.85 || move.slot === 'ultimate';
        if (isPerfect) anyPerfect = true;

        const nextCombo = comboRef.current + 1;
        comboRef.current = nextCombo;
        if (nextCombo > maxComboRef.current) {
          maxComboRef.current = nextCombo;
          setMaxCombo(nextCombo);
        }

        const comboMult = nextCombo >= 10 ? 3 : nextCombo >= 5 ? 2 : 1;
        const moveBonusMult = 1 + move.scoreBonusPct / 100;
        const gained = Math.round(t.basePoints * (isPerfect ? 1.5 : 1) * comboMult * moveBonusMult);
        totalGained += gained;

        const impactId = popupIdRef.current++;
        setKickImpacts((prev) => [
          ...prev.slice(-8),
          {
            id: impactId,
            xPct: t.xPct,
            yPct: t.yPct,
            kind: t.kind,
            isPerfect,
            colorHex: move.trailHex,
          },
        ]);
        setTimeout(() => setKickImpacts((prev) => prev.filter((fx) => fx.id !== impactId)), 340);

        spawnPopup(
          t.xPct,
          t.yPct,
          move.slot === 'ultimate'
            ? `${move.emoji} +${gained}`
            : isPerfect
              ? `⚡ PERFECT! +${gained}`
              : `💥 +${gained}`,
          move.slot === 'ultimate'
            ? 'text-yellow-300'
            : isPerfect
              ? 'text-amber-300'
              : 'text-sky-300',
          hitTargets.length > 1 ? `MULTI-HIT x${hitTargets.length}!` : undefined
        );
      }

      setCombo(comboRef.current);
      scoreRef.current += totalGained;
      setScore(scoreRef.current);

      const facing: 'left' | 'right' = primary.xPct < fighter.xPct ? 'left' : 'right';
      const strikeX = Math.max(15, Math.min(85, primary.xPct + (facing === 'right' ? -15 : 15)));
      const strikeY = Math.max(36, Math.min(76, primary.yPct + 14));

      setFighter({
        pose: move.pose,
        facing,
        xPct: strikeX,
        yPct: strikeY,
        moveName: `${move.emoji} ${move.codeName}!`,
        trailHex: move.trailHex,
      });

      kickTimerRef.current = setTimeout(
        () =>
          setFighter((prev) => ({
            ...prev,
            pose: 'idle',
            yPct: 72,
            moveName: undefined,
          })),
        move.slot === 'ultimate' ? 360 : 250
      );

      if (move.slot === 'ultimate') {
        playKickSfx('ultimate');
        setArenaShake(true);
        setHitFlash(true);
        setTimeout(() => setArenaShake(false), 200);
        setTimeout(() => setHitFlash(false), 140);
      } else if (primary.kind === 'board') {
        playKickSfx('board');
      } else if (anyPerfect) {
        playKickSfx('perfect');
        setArenaShake(true);
        setHitFlash(true);
        setTimeout(() => setArenaShake(false), 110);
        setTimeout(() => setHitFlash(false), 85);
      } else {
        playKickSfx('good');
      }
    },
    [fighter.xPct, finishRound, playKickSfx, spawnPopup]
  );

  const handleKickTarget = useCallback(
    (target: FloatingTarget) => {
      if (phaseRef.current !== 'playing') return;
      const move = pickAutoMoveForTarget(target, comboRef.current + 1);
      executeMoveOnTargets([target], move);
    },
    [executeMoveOnTargets, pickAutoMoveForTarget]
  );

  // Tekken Arcade Command Pad button press
  const triggerCommandMove = useCallback(
    (move: TaekwondoMove | null) => {
      if (phaseRef.current !== 'playing' || !move) return;
      const now = Date.now();
      if (move.cooldownSec > 0 && now < ultReadyAt) return;

      const valid = targetsRef.current.filter((t) => t.kind !== 'decoy');
      if (valid.length === 0) {
        if (kickTimerRef.current) clearTimeout(kickTimerRef.current);
        setFighter((prev) => ({
          ...prev,
          pose: move.pose,
          moveName: `${move.emoji} ${move.codeName}`,
          trailHex: move.trailHex,
        }));
        playKickSfx('good');
        kickTimerRef.current = setTimeout(
          () => setFighter((prev) => ({ ...prev, pose: 'idle', moveName: undefined })),
          230
        );
        return;
      }

      if (move.cooldownSec > 0) {
        setUltReadyAt(now + move.cooldownSec * 1000);
      }

      const sorted = [...valid].sort((a, b) => a.spawnedAt - b.spawnedAt);
      const picked =
        move.splashTargets >= 99
          ? sorted
          : sorted.slice(0, Math.max(1, move.splashTargets));

      executeMoveOnTargets(picked, move);
    },
    [executeMoveOnTargets, playKickSfx, ultReadyAt]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 select-none">
      <div
        className={`relative w-full max-w-3xl max-h-[95dvh] flex flex-col rounded-2xl border-2 border-red-500/90 bg-gradient-to-b from-zinc-950 via-slate-950 to-black shadow-[0_0_50px_rgba(220,38,38,0.45)] overflow-hidden transition-transform duration-75 ${arenaShake ? 'translate-x-1.5 -translate-y-1' : ''
          }`}
      >
        {/* Top Tekken Arcade Title Strip */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-red-950 via-zinc-900 to-blue-950 border-b-2 border-amber-400/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-2xl sm:text-3xl drop-shadow">🥋</span>
            <div className="min-w-0">
              <h2 className="font-[family-name:var(--font-kanit)] font-black italic tracking-wide text-base sm:text-lg text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 via-amber-400 to-red-500 truncate">
                TEKKEN DOJANG • เตะเป้าลอยปลดล็อกท่าสาย!
              </h2>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-zinc-200">
                <span className={`px-2 py-0.5 rounded-sm border text-[10px] font-black uppercase ${wornBelt.badgeClass}`}>
                  {wornBelt.name}
                </span>
                {isWearingLowerBelt && (
                  <button
                    type="button"
                    onClick={() => void handleEquipBelt(null)}
                    className="px-1.5 py-0.5 rounded-sm bg-amber-400/20 hover:bg-amber-400/35 border border-amber-300/70 text-[9.5px] font-extrabold text-amber-200 cursor-pointer"
                  >
                    กลับสายสูงสุด ({belt.name})
                  </button>
                )}
                <span className="text-amber-300 font-black">XP: {totalXp.toLocaleString()}</span>
                <span className="text-sky-300 hidden sm:inline">
                  • ท่าที่ปลดล็อก: {unlockedMoves.length}/{TAEKWONDO_MOVES.length}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg bg-red-600 hover:bg-red-500 text-white border-2 border-amber-300 font-black text-base flex items-center justify-center cursor-pointer shrink-0 shadow"
          >
            ✕
          </button>
        </div>

        {/* Belt Rank Progress Strip */}
        <div className="px-4 py-1.5 bg-zinc-950/90 border-b border-zinc-800 space-y-1">
          <div className="flex items-center justify-between text-[10.5px] font-extrabold gap-2">
            <span className="text-amber-200 truncate">
              {nextBelt
                ? `สายถัดไป: ${nextBelt.name} (${nextBelt.minXp.toLocaleString()} XP)${nextBelt.unlockMoveId
                  ? ` • ปลดล็อกท่า ${getMoveById(nextBelt.unlockMoveId).emoji} ${getMoveById(nextBelt.unlockMoveId).thName}`
                  : ''
                } +${nextBelt.promotionCoins}💰`
                : '👑 GRANDMASTER BLACK BELT — ปลดล็อกครบทุกท่าไม้ตายแล้ว!'}
            </span>
            <span className="text-yellow-300 shrink-0">{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-zinc-900 rounded-sm overflow-hidden border border-zinc-700">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${Math.max(4, progressPct)}%`,
                background:
                  belt.id === 'white'
                    ? 'linear-gradient(90deg, #e2e8f0, #facc15)'
                    : `linear-gradient(90deg, ${belt.beltHex}, ${nextBelt?.beltHex || '#facc15'})`,
              }}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {phase === 'lobby' && (
            <div className="space-y-3.5">
              {/* Tekken Character Select Card */}
              <div className="relative rounded-xl bg-gradient-to-r from-red-950/70 via-zinc-900/90 to-blue-950/70 border-2 border-amber-400/70 p-4 flex flex-col sm:flex-row items-center gap-4 overflow-hidden">
                <div className="pointer-events-none absolute -right-10 -top-10 w-44 h-44 rounded-full bg-red-600/15 blur-2xl" />

                {/* Interactive Fighter Preview */}
                <button
                  type="button"
                  onClick={() => {
                    const next = unlockedMoves[Math.floor(Math.random() * unlockedMoves.length)];
                    setLobbyPreviewMove(next);
                    playKickSfx(next.slot === 'ultimate' ? 'ultimate' : 'perfect');
                    setTimeout(() => setLobbyPreviewMove(null), 380);
                  }}
                  title="กดเพื่อลองท่าเตะที่ปลดล็อก!"
                  className="relative w-32 h-36 rounded-xl bg-gradient-to-b from-zinc-900 via-red-950/50 to-black border-2 border-yellow-400 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(250,204,21,0.25)] cursor-pointer hover:scale-[1.03] transition"
                >
                  <TekkenTaekwondoFighter
                    emoji={playerEmoji}
                    belt={wornBelt}
                    pose={lobbyPreviewMove?.pose || 'idle'}
                    facing="right"
                    trailHex={lobbyPreviewMove?.trailHex}
                    rageActive={lobbyPreviewMove?.slot === 'ultimate'}
                    size="sm"
                  />
                  <span className="absolute -bottom-2 px-2 py-0.5 rounded-sm bg-yellow-400 text-black text-[9px] font-black italic uppercase shadow whitespace-nowrap">
                    {lobbyPreviewMove ? `${lobbyPreviewMove.emoji} ${lobbyPreviewMove.codeName}` : 'TAP TO KICK!'}
                  </span>
                </button>

                <div className="flex-1 text-center sm:text-left space-y-1.5 relative z-10">
                  <div className="text-[10px] font-black tracking-widest uppercase text-red-400">
                    FIGHTER READY • {belt.enName}
                  </div>
                  <div className="font-[family-name:var(--font-kanit)] font-black italic text-xl text-white">
                    {playerName}
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    ยิ่งเลื่อนสายสูงขึ้น ยิ่งปลดล็อก <b className="text-yellow-300">ท่าเตะใหม่ + โบนัสคะแนน + ท่ากวาดหลายเป้า!</b>{' '}
                    กดปุ่มท่าด้านล่างเพื่อลองดูท่าที่ปลดล็อกแล้วได้เลย
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] font-bold pt-1">
                    <span className="px-2 py-0.5 rounded bg-black/70 border border-amber-400/60 text-amber-300">
                      🏆 BEST: {bestScore.toLocaleString()} PTS
                    </span>
                    <span className="px-2 py-0.5 rounded bg-black/70 border border-sky-400/60 text-sky-300">
                      🥋 ท่าสูงสุด: {unlockedMoves[unlockedMoves.length - 1].emoji}{' '}
                      {unlockedMoves[unlockedMoves.length - 1].thName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Command List / Unlockable Moves by Belt (including 2-color belts, Brown belt & equip/downgrade!) */}
              <div className="rounded-xl bg-zinc-950/90 border border-zinc-800 p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-xs font-black italic uppercase tracking-wide text-amber-300">
                    🥋 BELT & COMMAND LIST • เลือกย้อนสายที่ปลดล็อกแล้วได้ตลอด (XP และท่าไม่หาย!)
                  </div>
                  {isWearingLowerBelt && (
                    <button
                      type="button"
                      onClick={() => void handleEquipBelt(null)}
                      className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-yellow-400 text-black hover:brightness-110 cursor-pointer shrink-0"
                    >
                      ⬆️ ใส่สายสูงสุด
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[215px] overflow-y-auto pr-1">
                  {TAEKWONDO_BELTS.map((b) => {
                    const move = b.unlockMoveId ? getMoveById(b.unlockMoveId) : null;
                    const unlocked = totalXp >= b.minXp;
                    const isWorn = b.tier === wornBelt.tier;
                    const isMax = b.tier === belt.tier;
                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          if (!unlocked || !move) return;
                          setLobbyPreviewMove(move);
                          playKickSfx(move.slot === 'ultimate' ? 'ultimate' : 'perfect');
                          setTimeout(() => setLobbyPreviewMove(null), 420);
                        }}
                        className={`text-left rounded-lg px-2.5 py-1.5 border text-[11px] flex items-center gap-2 transition ${
                          isWorn
                            ? 'bg-red-950/65 border-yellow-400 ring-1 ring-yellow-400'
                            : unlocked
                            ? 'bg-emerald-950/35 border-emerald-500/50 hover:bg-emerald-950/60'
                            : 'bg-zinc-900/60 border-zinc-800 opacity-55'
                        } ${unlocked && move ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <span
                          className="w-5 h-5 rounded-sm border border-white/80 shrink-0 flex items-center justify-center text-[10px]"
                          style={getBeltSwatchStyle(b.beltHex, b.secondaryHex)}
                        >
                          {unlocked ? '' : '🔒'}
                        </span>
                        <div className="min-w-0 flex-1 leading-tight">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-extrabold text-white truncate">
                              {b.name}
                              {move ? ` • ${move.emoji} ${move.thName}` : ''}
                            </span>
                            <span className="text-[9.5px] text-amber-300 shrink-0 font-bold">
                              {b.minXp} XP
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1.5 mt-0.5">
                            <span className="text-[10px] text-zinc-300/85 truncate">
                              {move ? move.bonusDesc : 'สายขั้นเตรียมเลื่อนระดับ (สาย 2 สี)'}
                              {b.promotionCoins > 0 ? ` • +${b.promotionCoins}💰` : ''}
                            </span>
                            {unlocked && (
                              <button
                                type="button"
                                disabled={isWorn || savingBeltTier !== null}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleEquipBelt(isMax ? null : b.tier);
                                }}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 transition ${
                                  isWorn
                                    ? 'bg-yellow-400 text-black cursor-default'
                                    : 'bg-zinc-800 hover:bg-amber-400 hover:text-black text-amber-200 border border-amber-400/60 cursor-pointer'
                                }`}
                              >
                                {isWorn ? '✓ กำลังใส่' : 'ใส่สายนี้'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leaderboard */}
              {leaderboard.length > 0 && (
                <div className="rounded-xl bg-zinc-950/90 border border-zinc-800 p-3">
                  <div className="text-xs font-black italic uppercase tracking-wide text-sky-400 mb-1.5">
                    🏆 KING OF IRON WAIST • ทำเนียบยอดฝีมือสำนัก
                  </div>
                  <div className="space-y-1">
                    {leaderboard.map((entry, idx) => (
                      <div
                        key={entry.userId}
                        className="flex items-center justify-between text-xs px-2.5 py-1 rounded bg-zinc-900/90 border border-zinc-800/80"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-black italic text-yellow-400 w-5">#{idx + 1}</span>
                          <span>{entry.emoji}</span>
                          <span className="font-bold text-white truncate">{entry.name}</span>
                          <span
                            className="w-3.5 h-3.5 rounded-sm border border-white/70 shrink-0"
                            style={getBeltSwatchStyle(entry.beltHex, entry.secondaryHex)}
                            title={entry.beltName}
                          />
                        </div>
                        <span className="font-black text-emerald-400 shrink-0">
                          {entry.totalXp.toLocaleString()} XP
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={loadingProfile}
                  onClick={startRound}
                  className="py-3.5 px-3 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 hover:brightness-110 text-black border-2 border-white font-[family-name:var(--font-kanit)] font-black italic tracking-wide text-sm sm:text-base shadow-[0_4px_0_#7f1d1d] cursor-pointer uppercase"
                >
                  🎯 ฝึกเตะเป้าลอย ({ROUND_SECONDS} วิ)
                </button>
                <button
                  type="button"
                  disabled={loadingProfile}
                  onClick={() => {
                    phaseRef.current = 'pvp';
                    setPhase('pvp');
                  }}
                  className="py-3.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 hover:brightness-110 text-white border-2 border-white font-[family-name:var(--font-kanit)] font-black italic tracking-wide text-sm sm:text-base shadow-[0_4px_0_#1e3a8a] cursor-pointer uppercase"
                >
                  🥊 ประลอง Tekken 1v1 กับเพื่อน!
                </button>
              </div>
            </div>
          )}

          {phase === 'pvp' && (
            <TaekwondoPvpArena
              currentUserId={currentUserId}
              playerName={playerName}
              playerEmoji={playerEmoji}
              realBelt={belt}
              wornBelt={wornBelt}
              onBackToLobby={() => {
                phaseRef.current = 'lobby';
                setPhase('lobby');
                void loadProfile();
              }}
              onMatchXpEarned={(xpScore) => {
                void (async () => {
                  try {
                    const res = await fetch('/api/taekwondo', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ userId: currentUserId, score: xpScore, maxCombo: 1 }),
                    });
                    const data = await res.json();
                    if (res.ok && data?.success) {
                      setTotalXp(Number(data.totalXp ?? 0));
                      if (Array.isArray(data.promotedBelts) && data.promotedBelts.length > 0) {
                        playKickSfx('rankup');
                        onPointsUpdated?.();
                      }
                      void loadProfile();
                    }
                  } catch {
                    // ignore
                  }
                })();
              }}
            />
          )}

          {phase === 'playing' && (
            <div className="space-y-2.5">
              {/* Classic Tekken Arcade Battle HUD */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-3 px-1">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-black italic uppercase">
                    <span className="text-yellow-300 truncate">{playerName}</span>
                    <span className="text-rose-400">
                      {'❤️'.repeat(hearts)}
                      {'🖤'.repeat(Math.max(0, MAX_HEARTS - hearts))}
                    </span>
                  </div>
                  <div className="h-4 sm:h-5 w-full bg-zinc-900 border-2 border-zinc-300/80 -skew-x-12 overflow-hidden p-0.5 shadow-inner">
                    <div
                      className={`h-full transition-all duration-300 ${hearts === 1
                          ? 'bg-gradient-to-r from-red-600 to-rose-400 animate-pulse'
                          : 'bg-gradient-to-r from-red-500 via-amber-400 to-yellow-300'
                        }`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center px-2.5 py-1 rounded-lg bg-gradient-to-b from-zinc-800 to-black border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)] min-w-[58px]">
                  <span className="text-[8px] font-black tracking-widest text-amber-300 uppercase">TIME</span>
                  <span
                    className={`font-[family-name:var(--font-kanit)] font-black italic text-xl sm:text-2xl leading-none ${timeLeft <= 7 ? 'text-red-500 animate-pulse' : 'text-yellow-300'
                      }`}
                  >
                    {timeLeft}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-black italic uppercase">
                    <span className={isRageMode ? 'text-red-400 animate-pulse' : 'text-sky-300'}>
                      {isRageMode ? '🔥 RAGE ACTIVE!' : 'RAGE GAUGE'}
                    </span>
                    <span className="text-amber-300">{score.toLocaleString()} PTS</span>
                  </div>
                  <div className="h-4 sm:h-5 w-full bg-zinc-900 border-2 border-zinc-300/80 skew-x-12 overflow-hidden p-0.5 shadow-inner">
                    <div
                      className={`h-full ml-auto transition-all duration-200 ${isRageMode
                          ? 'bg-gradient-to-l from-red-600 via-orange-500 to-yellow-300 animate-pulse'
                          : 'bg-gradient-to-l from-blue-600 via-sky-400 to-cyan-300'
                        }`}
                      style={{ width: `${Math.max(8, ragePct)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Tekken 3D-Perspective Dojang Stage */}
              <div
                className={`relative w-full h-[330px] sm:h-[370px] rounded-xl border-2 border-amber-500/80 overflow-hidden shadow-2xl ${isRageMode
                    ? 'ring-2 ring-red-500 shadow-[0_0_30px_rgba(239,68,68,0.5)]'
                    : ''
                  }`}
                style={{
                  background:
                    'linear-gradient(180deg, #1a0b0e 0%, #3b1319 32%, #7c2d12 56%, #1e293b 57%, #0f172a 100%)',
                }}
              >
                <div className="pointer-events-none absolute left-1/2 top-[26%] -translate-x-1/2 -translate-y-1/2 w-44 h-44 rounded-full bg-gradient-to-b from-amber-300/35 via-orange-500/20 to-transparent blur-md" />
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-[56%] opacity-20"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(90deg, transparent, transparent 46px, rgba(255,255,255,0.4) 46px, rgba(255,255,255,0.4) 48px)',
                  }}
                />
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-[44%] border-t-2 border-amber-400/50"
                  style={{
                    background:
                      'repeating-linear-gradient(90deg, rgba(29,78,216,0.22) 0px, rgba(29,78,216,0.22) 38px, rgba(220,38,38,0.22) 38px, rgba(220,38,38,0.22) 76px)',
                    transform: 'perspective(260px) rotateX(36deg)',
                    transformOrigin: 'bottom center',
                  }}
                />

                {hitFlash && (
                  <div className="pointer-events-none absolute inset-0 bg-yellow-200/20 z-30" />
                )}

                {combo >= 2 && (
                  <div className="pointer-events-none absolute left-3 top-3 z-20 -skew-x-12">
                    <div className="font-[family-name:var(--font-kanit)] font-black italic text-3xl sm:text-4xl leading-none text-transparent bg-clip-text bg-gradient-to-b from-yellow-200 via-amber-400 to-red-600 drop-shadow-[0_3px_0_#000]">
                      {combo} HITS!
                    </div>
                    <div className="text-[10px] font-black tracking-widest uppercase text-amber-200 drop-shadow">
                      {combo >= 10 ? '⚡ MAXIMUM x3' : combo >= 5 ? '🔥 RAGE x2' : 'GREAT COMBO'}
                    </div>
                  </div>
                )}

                {roundBanner && (
                  <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/35">
                    <div className="px-6 py-2 -skew-x-12 bg-gradient-to-r from-red-700 via-amber-500 to-red-700 border-y-4 border-yellow-200 shadow-[0_0_30px_rgba(250,204,21,0.7)]">
                      <span className="font-[family-name:var(--font-kanit)] font-black italic text-3xl sm:text-4xl text-white drop-shadow-[0_3px_0_#000]">
                        {roundBanner}
                      </span>
                    </div>
                  </div>
                )}

                {/* Floating Targets */}
                {targets.map((t) => {
                  const elapsedRatio = Math.min(1, Math.max(0, (nowTick - t.spawnedAt) / t.lifeMs));
                  const ringScale = 1.65 - elapsedRatio * 0.72;
                  const isSweetSpot = elapsedRatio >= 0.35 && elapsedRatio <= 0.85;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        handleKickTarget(t);
                      }}
                      style={{ left: `${t.xPct}%`, top: `${t.yPct}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 w-18 h-18 sm:w-20 sm:h-20 flex items-center justify-center cursor-pointer active:scale-90 transition-transform z-20"
                    >
                      {t.kind !== 'decoy' && (
                        <span
                          style={{ transform: `scale(${ringScale})` }}
                          className={`absolute inset-0 rounded-full border-3 pointer-events-none ${isSweetSpot ? 'border-yellow-300 shadow-[0_0_12px_#facc15]' : 'border-white/55'
                            }`}
                        />
                      )}
                      <span
                        className={`relative z-10 w-14 h-14 sm:w-16 sm:h-16 rounded-full border-3 shadow-xl flex flex-col items-center justify-center font-extrabold ${t.kind === 'golden'
                            ? 'bg-gradient-to-br from-yellow-300 via-amber-400 to-orange-500 border-white text-black animate-pulse'
                            : t.kind === 'board'
                              ? 'bg-gradient-to-br from-amber-600 to-amber-900 border-amber-200 text-amber-100'
                              : t.kind === 'decoy'
                                ? 'bg-gradient-to-br from-zinc-900 to-rose-950 border-rose-500 text-rose-200'
                                : 'bg-gradient-to-br from-red-600 to-rose-800 border-white text-white'
                          }`}
                      >
                        <span className="text-2xl leading-none">
                          {t.kind === 'golden'
                            ? '⚡'
                            : t.kind === 'board'
                              ? '🪵'
                              : t.kind === 'decoy'
                                ? '💣'
                                : '🥋'}
                        </span>
                        <span className="text-[9px] font-black leading-none mt-0.5">
                          {t.kind === 'decoy' ? 'ห้ามเตะ' : `+${t.basePoints}`}
                        </span>
                      </span>
                    </button>
                  );
                })}

                {/* Tekken Electric Hit Sparks */}
                {kickImpacts.map((fx) => (
                  <div
                    key={fx.id}
                    style={{ left: `${fx.xPct}%`, top: `${fx.yPct}%` }}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-25"
                  >
                    <svg viewBox="0 0 100 100" className="w-24 h-24 animate-ping">
                      <polygon
                        points="50,2 60,36 96,26 68,52 94,80 58,66 50,98 40,66 6,80 32,52 4,26 40,36"
                        fill={
                          fx.kind === 'decoy'
                            ? '#ef4444'
                            : fx.colorHex || (fx.kind === 'golden' || fx.isPerfect ? '#fde047' : '#38bdf8')
                        }
                        opacity="0.9"
                      />
                    </svg>
                  </div>
                ))}

                {/* Floating Hit Callouts */}
                {popups.map((p) => (
                  <div
                    key={p.id}
                    style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
                    className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-center -skew-x-12 font-[family-name:var(--font-kanit)] font-black italic text-sm sm:text-base drop-shadow-[0_2px_2px_rgba(0,0,0,1)] animate-bounce z-30 whitespace-nowrap ${p.colorClass}`}
                  >
                    <div>{p.text}</div>
                    {p.subText && <div className="text-[10px] text-white">{p.subText}</div>}
                  </div>
                ))}

                {/* Tekken Articulated Fighter Leaping & Kicking on Stage */}
                <div
                  style={{
                    left: `${fighter.xPct}%`,
                    top: `${fighter.yPct}%`,
                  }}
                  className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-15 transition-all duration-100 ease-out"
                >
                  {fighter.moveName && (
                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 -skew-x-12 px-2.5 py-0.5 bg-gradient-to-r from-yellow-400 to-amber-500 text-black border border-white font-[family-name:var(--font-kanit)] font-black italic text-[11px] whitespace-nowrap shadow">
                      {fighter.moveName}
                    </div>
                  )}
                  <TekkenTaekwondoFighter
                    emoji={playerEmoji}
                    belt={wornBelt}
                    pose={fighter.pose}
                    facing={fighter.facing}
                    trailHex={fighter.trailHex}
                    rageActive={isRageMode || fighter.pose === 'sky_dragon'}
                    size="lg"
                  />
                </div>
              </div>

              {/* Dynamic Belt-Unlocked Tekken Command Pad */}
              <div className="grid grid-cols-3 gap-2">
                {/* Slot 1: Basic Move (Always Unlocked) */}
                <button
                  type="button"
                  onPointerDown={() => triggerCommandMove(loadout.basic)}
                  className="py-2 px-1.5 rounded-lg bg-gradient-to-b from-sky-500 to-blue-700 hover:brightness-110 active:translate-y-0.5 text-white border-2 border-sky-200 font-[family-name:var(--font-kanit)] font-black italic text-[11px] sm:text-xs shadow-[0_3px_0_#1e3a8a] cursor-pointer truncate"
                >
                  {loadout.basic.emoji} {loadout.basic.thName}
                </button>

                {/* Slot 2: Mid-Tier Belt Move (Yellow -> Green -> Blue) */}
                <button
                  type="button"
                  disabled={!loadout.mid}
                  onPointerDown={() => triggerCommandMove(loadout.mid)}
                  className={`py-2 px-1.5 rounded-lg border-2 font-[family-name:var(--font-kanit)] font-black italic text-[11px] sm:text-xs truncate ${loadout.mid
                      ? 'bg-gradient-to-b from-amber-400 to-orange-600 hover:brightness-110 active:translate-y-0.5 text-black border-yellow-100 shadow-[0_3px_0_#7c2d12] cursor-pointer'
                      : 'bg-zinc-900 text-zinc-500 border-zinc-700 cursor-not-allowed'
                    }`}
                >
                  {loadout.mid
                    ? `${loadout.mid.emoji} ${loadout.mid.thName}`
                    : '🔒 สายเหลืองปลดล็อก'}
                </button>

                {/* Slot 3: Ultimate Belt Move (Red -> Black -> Grandmaster) */}
                <button
                  type="button"
                  disabled={!loadout.ultimate || ultCdLeftSec > 0}
                  onPointerDown={() => triggerCommandMove(loadout.ultimate)}
                  className={`py-2 px-1.5 rounded-lg border-2 font-[family-name:var(--font-kanit)] font-black italic text-[11px] sm:text-xs truncate ${loadout.ultimate && ultCdLeftSec === 0
                      ? 'bg-gradient-to-b from-red-500 via-rose-600 to-amber-500 hover:brightness-110 active:translate-y-0.5 text-white border-yellow-300 shadow-[0_3px_0_#4c0519] cursor-pointer animate-pulse'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-700 cursor-not-allowed'
                    }`}
                >
                  {!loadout.ultimate
                    ? '🔒 สายแดงปลดล็อก'
                    : ultCdLeftSec > 0
                      ? `⏳ รอ ${ultCdLeftSec} วิ`
                      : `${loadout.ultimate.emoji} ${loadout.ultimate.thName}`}
                </button>
              </div>
            </div>
          )}

          {phase === 'result' && (
            <div className="text-center space-y-4 py-2">
              <div className="inline-block px-5 py-1 -skew-x-12 bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-black font-[family-name:var(--font-kanit)] font-black italic text-xl shadow">
                {lastResult?.endedByKo ? 'K.O. — BATTLE FINISHED!' : 'YOU WIN • GREAT FIGHT!'}
              </div>

              <div>
                <h3 className="font-[family-name:var(--font-kanit)] font-black italic text-3xl text-yellow-300 drop-shadow">
                  {score.toLocaleString()} PTS
                </h3>
                <p className="text-xs text-zinc-300 mt-1">
                  MAX COMBO: <b className="text-amber-300">{maxCombo} HITS</b> • ได้รับค่าประสบการณ์สาย{' '}
                  <b className="text-emerald-400">+{lastResult?.xpGained ?? score} XP</b>
                </p>
              </div>

              {savingResult && (
                <div className="text-xs font-bold text-sky-300 animate-pulse">
                  ⏳ กำลังบันทึกคะแนนและเช็กการเลื่อนระดับสาย...
                </div>
              )}

              {lastResult && lastResult.promotedBelts.length > 0 && (
                <div className="rounded-xl bg-gradient-to-r from-red-900/50 via-amber-600/35 to-yellow-500/35 border-2 border-yellow-300 p-3.5 space-y-1.5">
                  <div className="font-[family-name:var(--font-kanit)] font-black italic text-xl text-yellow-300 animate-bounce">
                    🎊 PROMOTION CHANCE CLEARED!! เลื่อนสายสำเร็จ! 🎊
                  </div>
                  <div className="text-sm font-extrabold text-white">
                    เลื่อนขั้นเป็น: {lastResult.promotedBelts.map((b) => b.name).join(' → ')}
                  </div>
                  {lastResult.promotedBelts.some((b) => b.unlockMoveId) && (
                    <div className="text-xs font-extrabold text-amber-200">
                      ✨ ปลดล็อกท่าใหม่:{' '}
                      {lastResult.promotedBelts
                        .filter((b) => Boolean(b.unlockMoveId))
                        .map((b) => {
                          const mv = getMoveById(b.unlockMoveId!);
                          return `${mv.emoji} ${mv.thName} (${mv.codeName})`;
                        })
                        .join(', ')}
                    </div>
                  )}
                  {lastResult.coinsEarned > 0 && (
                    <div className="text-xs font-extrabold text-emerald-300">
                      🎁 รับโบนัสเลื่อนสายเข้ากระเป๋า +{lastResult.coinsEarned} 💰 Gacha!
                    </div>
                  )}
                  {lastResult.cappedToOneBelt && (
                    <div className="text-[11px] font-bold text-sky-200">
                      ⚡ แต่ละรอบเลื่อนได้สูงสุด 1 สาย — เตะรอบถัดไปเพื่อสอบเลื่อนสายขั้นต่อไปได้เลย!
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={startRound}
                  className="py-3 rounded-xl bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-black border-2 border-white font-[family-name:var(--font-kanit)] font-black italic text-sm cursor-pointer shadow-[0_3px_0_#7f1d1d]"
                >
                  🥊 REMATCH! เตะอีกรอบ
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('lobby')}
                  className="py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-amber-200 border-2 border-amber-400/70 font-[family-name:var(--font-kanit)] font-extrabold text-sm cursor-pointer"
                >
                  📋 ดูระดับสาย & ท่าเตะ
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
