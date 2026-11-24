'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { sessionFetch } from '@/lib/client_session';
import {
  GK_DECISION_SECONDS,
  GOAL_ZONES,
  PENALTY_CHARACTERS,
  POWER_GREEN_MAX,
  POWER_GREEN_MIN,
  REGULATION_KICKS,
  chooseAiKeeperZone,
  chooseAiShooterAction,
  classifyPowerZone,
  computePowerBarCursor,
  evaluateShootoutProgress,
  getGoalZoneMeta,
  getPenaltyCharacter,
  mapSpeciesOrEmojiToPenaltyChar,
  resolvePenaltyTurn,
  type KeeperLockChoice,
  type KickDotStatus,
  type PenaltyDifficulty,
  type PenaltySide,
  type PenaltyZone,
  type PowerBarZone,
  type ResolvedTurnResult,
  type ShooterLockChoice,
} from '@/lib/penalty_rules';
import {
  createPenaltyStadiumScene,
  playPenaltySfx,
  type PenaltySceneController,
} from '@/lib/penalty_scene';
import {
  PenaltyRoomController,
  generateRoomCode,
  isSupabaseConfigured,
  type PenaltyKeeperLockPacket,
  type PenaltyPresenceMember,
  type PenaltyResolvedLobby,
  type PenaltyShooterLockPacket,
  type PenaltyStartPacket,
} from '@/lib/realtime_sync';
import {
  fetchPenaltyLeaderboard,
  recordPenaltyMatchByHost,
  type PenaltyLeaderRow,
  type PenaltyMatchHistoryRow,
} from '@/lib/penalty_stats';

// ============================================================================
// Standalone & Reusable Leaderboard Panel
// ============================================================================

export function PenaltyLeaderboardPanel({
  onBack,
  standaloneLink = false,
}: {
  onBack?: () => void;
  standaloneLink?: boolean;
}) {
  const [leaders, setLeaders] = useState<PenaltyLeaderRow[]>([]);
  const [recentMatches, setRecentMatches] = useState<PenaltyMatchHistoryRow[]>([]);
  const [source, setSource] = useState<'supabase' | 'local'>('local');
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetchPenaltyLeaderboard();
    setLeaders(res.leaders);
    setRecentMatches(res.recentMatches);
    setSource(res.source);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 sm:p-6 bg-slate-900/95 border-2 border-emerald-400/80 rounded-3xl shadow-2xl text-white space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-amber-400 flex items-center justify-center text-2xl shadow-lg text-slate-950">
            🏆
          </div>
          <div>
            <h2 className="font-[family-name:var(--font-kanit)] text-xl sm:text-2xl font-black text-amber-300">
              ตารางอันดับจอมสังหารจุดโทษ 3D
            </h2>
            <p className="text-xs text-emerald-200/80 font-semibold">
              บันทึกสถิติเฉพาะตอนจบแมตช์ 1v1 ออนไลน์โดย Host ({source === 'supabase' ? 'Supabase PostgreSQL' : 'Local DB'})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData()}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-extrabold cursor-pointer"
          >
            🔄 รีเฟรช
          </button>
          {standaloneLink && (
            <Link
              href="/penalty/leaderboard"
              className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-extrabold"
            >
              🔗 เปิดหน้าเต็ม
            </Link>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
            >
              ← กลับ
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="py-14 text-center text-sm font-bold text-emerald-200 animate-pulse">
          ⚽ กำลังโหลดอันดับดาวซัลโว...
        </div>
      ) : leaders.length === 0 ? (
        <div className="py-12 text-center bg-slate-950/70 rounded-2xl border border-slate-800 space-y-2">
          <div className="text-4xl">🥅</div>
          <p className="text-sm font-extrabold text-amber-200">ยังไม่มีสถิติแมตช์ออนไลน์ 1v1</p>
          <p className="text-xs text-slate-400">
            สร้างห้องชวนเพื่อนดวลจุดโทษ 1v1 ให้จบแมตช์เพื่อประเดิมชื่อขึ้นอันดับ #1!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-800/90 text-amber-300 font-extrabold">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">ผู้เล่น</th>
                <th className="py-2.5 px-3 text-center">ชนะ</th>
                <th className="py-2.5 px-3 text-center">แพ้</th>
                <th className="py-2.5 px-3 text-center">Win Rate</th>
                <th className="py-2.5 px-3 text-center">ยิงเข้า (ลูก)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {leaders.map((row, idx) => {
                const charDef = getPenaltyCharacter(row.model_id);
                const total = Math.max(1, row.wins + row.losses);
                const winPct = Math.round((row.wins / total) * 100);
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
                return (
                  <tr key={row.player_name} className="hover:bg-slate-900/70">
                    <td className="py-2.5 px-3 font-black text-amber-300">{medal}</td>
                    <td className="py-2.5 px-3 font-extrabold flex items-center gap-2">
                      <span className="text-lg">{charDef.emoji}</span>
                      <span>{row.player_name}</span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-black text-emerald-400">{row.wins}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-400">{row.losses}</td>
                    <td className="py-2.5 px-3 text-center font-extrabold text-sky-300">{winPct}%</td>
                    <td className="py-2.5 px-3 text-center font-black text-amber-300">
                      ⚽ {row.goals_scored}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {recentMatches.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">
            📜 ประวัติการดวลจุดโทษล่าสุด
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {recentMatches.slice(0, 6).map((m) => {
              const wChar = getPenaltyCharacter(m.winner_model);
              const lChar = getPenaltyCharacter(m.loser_model);
              return (
                <div
                  key={m.match_uid}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="truncate font-bold">
                    <span className="text-emerald-400 font-extrabold">
                      👑 {wChar.emoji} {m.winner_name}
                    </span>{' '}
                    <span className="text-slate-500">ชนะ</span>{' '}
                    <span className="text-rose-300">
                      {lChar.emoji} {m.loser_name}
                    </span>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/50 font-black text-emerald-300">
                      {m.winner_score} - {m.loser_score}
                    </span>
                    {m.sudden_death && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold">
                        SD
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main 3D Penalty Shootout Game (Home, Online 1v1 Lobby, PES 3D Gameplay)
// ============================================================================

export interface PenaltyLobbyBroadcastInfo {
  roomCode: string;
  hostUserId: number;
  hostName: string;
  hostEmoji: string;
  targetName?: string;
  count: number;
  max: number;
  status: 'waiting' | 'started' | 'closed';
}

export interface PenaltyShootoutGameProps {
  embeddedModal?: boolean;
  onClose?: () => void;
  defaultNickname?: string;
  defaultModelId?: string;
  currentUserId?: number | null;
  autoRoomCode?: string;
  autoIsCreator?: boolean;
  invitedTargetName?: string;
  onLobbyBroadcast?: (info: PenaltyLobbyBroadcastInfo) => void;
  onRewardEarned?: (earned: number, totalPoints: number) => void;
}

type TurnPhase = 'selecting' | 'waiting_peer' | 'animating' | 'finished';

export function PenaltyShootoutGame({
  embeddedModal = false,
  onClose,
  defaultNickname = '',
  defaultModelId = 'fox_hero',
  currentUserId = null,
  autoRoomCode,
  autoIsCreator = false,
  invitedTargetName,
  onLobbyBroadcast,
  onRewardEarned,
}: PenaltyShootoutGameProps) {
  const [screen, setScreen] = useState<'home' | 'lobby' | 'playing' | 'leaderboard'>(() =>
    autoRoomCode ? 'lobby' : 'home'
  );
  const [nickname, setNickname] = useState<string>(defaultNickname || 'นักเตะสายฟ้า');
  const [selectedModelId, setSelectedModelId] = useState<string>(defaultModelId || 'fox_hero');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>(autoRoomCode || '');
  const [isCreator, setIsCreator] = useState<boolean>(autoIsCreator);
  const [isPractice, setIsPractice] = useState<boolean>(false);
  const [aiDifficulty, setAiDifficulty] = useState<PenaltyDifficulty>('normal');
  const [muted, setMuted] = useState<boolean>(false);
  const [transportKind, setTransportKind] = useState<'supabase' | 'local_tab'>(
    isSupabaseConfigured() ? 'supabase' : 'local_tab'
  );
  const [toastAlert, setToastAlert] = useState<string>('');

  const clientIdRef = useRef<string>(
    `pen-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  );
  const roomCtrlRef = useRef<PenaltyRoomController | null>(null);

  const [lobbyState, setLobbyState] = useState<PenaltyResolvedLobby>({
    hostClientId: null,
    p1: null,
    p2: null,
    onlinePlayers: [],
    bothPresent: false,
    allReady: false,
  });

  // Match participants & score state
  const [matchP1, setMatchP1] = useState<{ clientId: string; name: string; modelId: string }>({
    clientId: 'p1',
    name: 'ผู้เล่น 1',
    modelId: 'fox_hero',
  });
  const [matchP2, setMatchP2] = useState<{ clientId: string; name: string; modelId: string }>({
    clientId: 'ai',
    name: 'AI ผู้รักษาประตู',
    modelId: 'husky_hero',
  });
  const [mySide, setMySide] = useState<PenaltySide>('p1');
  const [amIMatchHost, setAmIMatchHost] = useState<boolean>(true);
  const [turnHistory, setTurnHistory] = useState<ResolvedTurnResult[]>([]);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('selecting');

  // Shooter & Goalkeeper per-turn UI states
  const [selectedZone, setSelectedZone] = useState<PenaltyZone>('top_left');
  const [keeperZonePicked, setKeeperZonePicked] = useState<boolean>(false);
  const [lockedPower, setLockedPower] = useState<number | null>(null);
  const [peerReadyBanner, setPeerReadyBanner] = useState<string>('');
  const [keeperTimeLeft, setKeeperTimeLeft] = useState<number>(GK_DECISION_SECONDS);
  const [impactBanner, setImpactBanner] = useState<{
    title: string;
    subtitle: string;
    tone: 'goal' | 'saved' | 'miss';
  } | null>(null);
  const [rewardNotice, setRewardNotice] = useState<string>('');
  const [dbSaveNotice, setDbSaveNotice] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Refs for stable callbacks (prevents mid-match scene resets!)
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const isPracticeRef = useRef(isPractice);
  isPracticeRef.current = isPractice;
  const aiDifficultyRef = useRef(aiDifficulty);
  aiDifficultyRef.current = aiDifficulty;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const mySideRef = useRef<PenaltySide>(mySide);
  mySideRef.current = mySide;
  const amIMatchHostRef = useRef(amIMatchHost);
  amIMatchHostRef.current = amIMatchHost;
  const turnHistoryRef = useRef<ResolvedTurnResult[]>(turnHistory);
  turnHistoryRef.current = turnHistory;
  const turnPhaseRef = useRef<TurnPhase>(turnPhase);
  turnPhaseRef.current = turnPhase;
  const selectedZoneRef = useRef<PenaltyZone>(selectedZone);
  selectedZoneRef.current = selectedZone;
  const onLobbyBroadcastRef = useRef(onLobbyBroadcast);
  onLobbyBroadcastRef.current = onLobbyBroadcast;
  const onRewardEarnedRef = useRef(onRewardEarned);
  onRewardEarnedRef.current = onRewardEarned;

  const activeMatchUidRef = useRef<string>('');
  const matchStartedAtRef = useRef<number>(0);
  const matchSavedRef = useRef<boolean>(false);
  const rewardClaimedRef = useRef<boolean>(false);
  const recentPlayerShotsRef = useRef<PenaltyZone[]>([]);

  // Host turn lock buffers (for simultaneous reveal when BOTH Shooter and Keeper lock!)
  const pendingShooterLockRef = useRef<{ turnIndex: number; choice: ShooterLockChoice } | null>(
    null
  );
  const pendingKeeperLockRef = useRef<{ turnIndex: number; choice: KeeperLockChoice } | null>(null);
  const revealedTurnsSetRef = useRef<Set<number>>(new Set());

  // 3D Stadium Scene & 60FPS Power Bar DOM Refs
  const sceneContainerRef = useRef<HTMLDivElement | null>(null);
  const sceneCtrlRef = useRef<PenaltySceneController | null>(null);
  const powerBarFillRef = useRef<HTMLDivElement | null>(null);
  const powerBarCursorRef = useRef<HTMLDivElement | null>(null);
  const powerBarValueTextRef = useRef<HTMLSpanElement | null>(null);
  const powerStartPerfRef = useRef<number>(0);

  const showToast = useCallback((msg: string) => {
    setToastAlert(msg);
    setTimeout(() => {
      setToastAlert((prev) => (prev === msg ? '' : prev));
    }, 4000);
  }, []);

  const scoreSummary = useMemo(() => evaluateShootoutProgress(turnHistory), [turnHistory]);
  const currentTurnIndex = turnHistory.length;
  const currentShooterSide: PenaltySide = scoreSummary.nextShooter;
  const amIShooter = mySide === currentShooterSide;

  const currentShooterModelId =
    currentShooterSide === 'p1' ? matchP1.modelId : matchP2.modelId;
  const currentKeeperModelId =
    currentShooterSide === 'p1' ? matchP2.modelId : matchP1.modelId;

  // Claim +5 GP daily win reward when played inside the 3D Island Arena
  const claimIslandWinReward = useCallback(async () => {
    if (rewardClaimedRef.current || !currentUserId || currentUserId <= 0) return;
    rewardClaimedRef.current = true;
    try {
      const res = await sessionFetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, type: 'penalty_win' }),
      });
      const data = await res.json();
      if (res.ok && data.earned > 0) {
        setRewardNotice(
          `🎁 โบนัสผู้ชนะดวลจุดโทษ +${data.earned} 💰 GP! (${data.winsToday}/${data.dailyCap} รอบวันนี้)`
        );
        onRewardEarnedRef.current?.(data.earned, data.points);
      } else if (res.ok && data.capReached) {
        setRewardNotice(
          `รับโบนัส GP ครบ ${data.dailyCap}/${data.dailyCap} รอบของวันนี้แล้ว (ดวลจุดโทษต่อได้ไม่จำกัด!)`
        );
      }
    } catch {
      // ignore
    }
  }, [currentUserId]);

  const finalizeMatchEnd = useCallback(
    (finalHistory: ResolvedTurnResult[]) => {
      const summary = evaluateShootoutProgress(finalHistory);
      if (!summary.isFinished || !summary.winner) return;

      setTurnPhase('finished');
      turnPhaseRef.current = 'finished';

      const didIWin = summary.winner === mySideRef.current;
      if (didIWin) {
        confetti({ particleCount: 110, spread: 85, origin: { y: 0.55 } });
        if (!isPracticeRef.current) {
          void claimIslandWinReward();
        }
      }

      // Host-only single write to Supabase `penalty_matches` & `player_stats`!
      if (amIMatchHostRef.current && !isPracticeRef.current && !matchSavedRef.current && roomCode) {
        matchSavedRef.current = true;
        const winPlayer = summary.winner === 'p1' ? matchP1 : matchP2;
        const losePlayer = summary.winner === 'p1' ? matchP2 : matchP1;
        const winScore = summary.winner === 'p1' ? summary.p1Goals : summary.p2Goals;
        const loseScore = summary.winner === 'p1' ? summary.p2Goals : summary.p1Goals;

        void recordPenaltyMatchByHost({
          matchUid: activeMatchUidRef.current || `${roomCode}-${Date.now()}`,
          roomCode,
          winnerName: winPlayer.name,
          loserName: losePlayer.name,
          winnerModel: winPlayer.modelId,
          loserModel: losePlayer.modelId,
          winnerScore: winScore,
          loserScore: loseScore,
          totalRounds: Math.max(summary.p1Taken, summary.p2Taken),
          suddenDeath: summary.isSuddenDeath,
          durationSeconds: Math.max(
            8,
            Math.round((Date.now() - matchStartedAtRef.current) / 1000)
          ),
        }).then(({ savedSupabase, savedLocal }) => {
          if (savedSupabase || savedLocal) {
            setDbSaveNotice(
              savedSupabase
                ? '💾 Host บันทึกผลลง Supabase (penalty_matches & player_stats) แล้ว!'
                : '💾 Host บันทึกผลลงตารางอันดับเรียบร้อยแล้ว!'
            );
          }
        });
      }
    },
    [claimIslandWinReward, matchP1, matchP2, roomCode]
  );
  const finalizeMatchEndRef = useRef(finalizeMatchEnd);
  finalizeMatchEndRef.current = finalizeMatchEnd;

  // Prepare clean turn state before each kick
  const prepareTurnUI = useCallback(() => {
    pendingShooterLockRef.current = null;
    pendingKeeperLockRef.current = null;
    setSelectedZone('top_left');
    selectedZoneRef.current = 'top_left';
    setKeeperZonePicked(false);
    setLockedPower(null);
    setPeerReadyBanner('');
    setImpactBanner(null);
    setKeeperTimeLeft(GK_DECISION_SECONDS);
    powerStartPerfRef.current = performance.now();
    setTurnPhase('selecting');
    turnPhaseRef.current = 'selecting';
    playPenaltySfx('whistle', mutedRef.current);
  }, []);

  // Execute simultaneous 3D Reveal Animation on both Shooter & Goalkeeper!
  const executeTurnReveal = useCallback(
    (result: ResolvedTurnResult) => {
      if (revealedTurnsSetRef.current.has(result.turnIndex)) return;
      revealedTurnsSetRef.current.add(result.turnIndex);

      setTurnPhase('animating');
      turnPhaseRef.current = 'animating';
      setPeerReadyBanner('');

      const runScene = sceneCtrlRef.current;
      const onImpact = (res: ResolvedTurnResult) => {
        if (res.outcome === 'goal') {
          setImpactBanner({
            title: '⚽ GOAL!! ตุงตาข่าย!',
            subtitle:
              res.powerZone === 'green'
                ? '🔥 เขียวเพอร์เฟกต์! พุ่งเสียบสามเหลี่ยมคมกริบ!'
                : 'ซัดเข้าประตูไปอย่างสวยงาม!',
            tone: 'goal',
          });
          confetti({ particleCount: 55, spread: 65, origin: { y: 0.5 } });
        } else if (res.outcome === 'saved') {
          setImpactBanner({
            title: '🧤 SAVED!! ซูเปอร์เซฟ!',
            subtitle: `ผู้รักษาประตูอ่านใจถูก พุ่งปัดมุม${getGoalZoneMeta(res.keeperZone).label}ได้ทัน!`,
            tone: 'saved',
          });
        } else if (res.outcome === 'post') {
          setImpactBanner({
            title: '💥 ชนเสา/คานเต็มข้อ!!',
            subtitle: 'กดพลังติดโซนสีแดง ลูกพุ่งกระแทกเสาเด้งออก!',
            tone: 'miss',
          });
        } else {
          setImpactBanner({
            title: '🚀 เหินข้ามคาน!!',
            subtitle: 'กดพลังติดโซนสีแดง ยิงแรงเกินจนลอยข้ามคาน!',
            tone: 'miss',
          });
        }
      };

      const onFinished = () => {
        const updatedHistory = [...turnHistoryRef.current, result];
        turnHistoryRef.current = updatedHistory;
        setTurnHistory(updatedHistory);

        const nextSummary = evaluateShootoutProgress(updatedHistory);
        if (nextSummary.isFinished) {
          finalizeMatchEndRef.current(updatedHistory);
        } else {
          prepareTurnUI();
        }
      };

      if (runScene) {
        runScene.playTurnReveal(result, onImpact, onFinished);
      } else {
        onImpact(result);
        setTimeout(onFinished, 1200);
      }
    },
    [prepareTurnUI]
  );
  const executeTurnRevealRef = useRef(executeTurnReveal);
  executeTurnRevealRef.current = executeTurnReveal;

  // Host checks if BOTH Shooter & Keeper have locked for the current turnIndex
  const tryResolveTurnAsHost = useCallback(() => {
    if (!amIMatchHostRef.current && !isPracticeRef.current) return;
    const tIdx = turnHistoryRef.current.length;
    const sLock = pendingShooterLockRef.current;
    const kLock = pendingKeeperLockRef.current;
    if (!sLock || !kLock) return;
    if (sLock.turnIndex !== tIdx || kLock.turnIndex !== tIdx) return;

    const shooterSide: PenaltySide = tIdx % 2 === 0 ? 'p1' : 'p2';
    const result = resolvePenaltyTurn({
      turnIndex: tIdx,
      shooterSide,
      shooter: sLock.choice,
      keeper: kLock.choice,
      roll: Math.random(),
    });

    if (!isPracticeRef.current && roomCtrlRef.current) {
      roomCtrlRef.current.broadcastTurnReveal({
        matchUid: activeMatchUidRef.current,
        result,
      });
    }
    executeTurnRevealRef.current(result);
  }, []);
  const tryResolveTurnAsHostRef = useRef(tryResolveTurnAsHost);
  tryResolveTurnAsHostRef.current = tryResolveTurnAsHost;

  // Start Online Match from Packet
  const startOnlineMatchFromPacket = useCallback(
    (pkt: PenaltyStartPacket) => {
      const iAmHost = pkt.hostClientId === clientIdRef.current;
      const resolvedSide: PenaltySide = pkt.p1.clientId === clientIdRef.current ? 'p1' : 'p2';

      isPracticeRef.current = false;
      setIsPractice(false);
      amIMatchHostRef.current = iAmHost;
      setAmIMatchHost(iAmHost);
      mySideRef.current = resolvedSide;
      setMySide(resolvedSide);

      setMatchP1({
        clientId: pkt.p1.clientId,
        name: pkt.p1.name,
        modelId: pkt.p1.modelId,
      });
      setMatchP2({
        clientId: pkt.p2.clientId,
        name: pkt.p2.name,
        modelId: pkt.p2.modelId,
      });

      activeMatchUidRef.current = pkt.matchUid;
      matchStartedAtRef.current = pkt.startedAt || Date.now();
      matchSavedRef.current = false;
      rewardClaimedRef.current = false;
      recentPlayerShotsRef.current = [];
      revealedTurnsSetRef.current.clear();

      turnHistoryRef.current = [];
      setTurnHistory([]);
      setRewardNotice('');
      setDbSaveNotice('');
      screenRef.current = 'playing';
      setScreen('playing');
      prepareTurnUI();
    },
    [prepareTurnUI]
  );

  // Start Solo Practice vs AI immediately without needing Supabase
  const startPracticeMatch = useCallback(() => {
    const cleanName = nickname.trim() || 'นักเตะสายฟ้า';
    setNickname(cleanName);

    const botCandidates = PENALTY_CHARACTERS.filter((c) => c.id !== selectedModelId);
    const botChar =
      botCandidates[Math.floor(Math.random() * botCandidates.length)] || PENALTY_CHARACTERS[1];

    isPracticeRef.current = true;
    setIsPractice(true);
    amIMatchHostRef.current = true;
    setAmIMatchHost(true);
    mySideRef.current = 'p1';
    setMySide('p1');

    setMatchP1({
      clientId: clientIdRef.current,
      name: cleanName,
      modelId: selectedModelId,
    });
    setMatchP2({
      clientId: 'ai_bot',
      name: `AI ${botChar.name.split(' ')[0]}`,
      modelId: botChar.id,
    });

    activeMatchUidRef.current = `practice-${Date.now()}`;
    matchStartedAtRef.current = Date.now();
    matchSavedRef.current = false;
    rewardClaimedRef.current = false;
    recentPlayerShotsRef.current = [];
    revealedTurnsSetRef.current.clear();

    turnHistoryRef.current = [];
    setTurnHistory([]);
    setRewardNotice('');
    setDbSaveNotice('');
    screenRef.current = 'playing';
    setScreen('playing');
    prepareTurnUI();
  }, [nickname, prepareTurnUI, selectedModelId]);

  const returnToLobbyOrHome = useCallback((target: 'home' | 'lobby') => {
    screenRef.current = target;
    isPracticeRef.current = false;
    turnPhaseRef.current = 'selecting';
    pendingShooterLockRef.current = null;
    pendingKeeperLockRef.current = null;
    revealedTurnsSetRef.current.clear();
    turnHistoryRef.current = [];

    setIsPractice(false);
    setTurnHistory([]);
    setImpactBanner(null);
    setPeerReadyBanner('');
    setLockedPower(null);
    setRewardNotice('');
    setDbSaveNotice('');
    setScreen(target);

    if (target === 'lobby') {
      void roomCtrlRef.current?.updateMyPresence({ ready: false });
    }
  }, []);

  // Broadcast floating invite banner to 3D Island when waiting in lobby as Host
  useEffect(() => {
    if (!onLobbyBroadcastRef.current || !roomCode || isPractice) return;
    if (screen === 'lobby' && lobbyState.hostClientId === clientIdRef.current) {
      const myChar = getPenaltyCharacter(selectedModelId);
      onLobbyBroadcastRef.current({
        roomCode,
        hostUserId: currentUserId || 0,
        hostName: nickname.trim() || 'เพื่อน',
        hostEmoji: myChar.emoji,
        targetName: invitedTargetName,
        count: lobbyState.onlinePlayers.length,
        max: 2,
        status: 'waiting',
      });
    }
  }, [screen, roomCode, isPractice, lobbyState, selectedModelId, currentUserId, nickname, invitedTargetName]);

  // Connect Supabase Realtime Presence Room when `roomCode` is active
  useEffect(() => {
    const shouldStayConnected =
      Boolean(roomCode) && (screen === 'lobby' || screen === 'playing' || screen === 'leaderboard');
    if (!shouldStayConnected) {
      if (roomCtrlRef.current) {
        roomCtrlRef.current.destroy();
        roomCtrlRef.current = null;
      }
      return;
    }

    if (roomCtrlRef.current && roomCtrlRef.current.roomCode === roomCode) {
      return;
    }

    roomCtrlRef.current?.destroy();
    const ctrl = new PenaltyRoomController({
      roomCode,
      me: {
        clientId: clientIdRef.current,
        userId: currentUserId,
        name: nickname.trim() || 'นักเตะสายฟ้า',
        modelId: selectedModelId,
        ready: false,
        isCreator,
      },
      callbacks: {
        onLobbyChange: (nextLobby) => {
          setLobbyState(nextLobby);
        },
        onOpponentLeft: (leftMember) => {
          showToast(`⚠️ ${leftMember.name} ออกจากห้องแข่งขัน`);
          if (screenRef.current === 'playing' && !isPracticeRef.current) {
            returnToLobbyOrHome('lobby');
          }
        },
        onMatchStart: (pkt) => {
          if (isPracticeRef.current) return;
          startOnlineMatchFromPacket(pkt);
        },
        onShooterLockedNotice: (tIdx) => {
          if (isPracticeRef.current || tIdx !== turnHistoryRef.current.length) return;
          setPeerReadyBanner('⚡ คนยิงล็อกมุมและพลังยิงแล้ว! รีบเลือกมุมพุ่งปัดเลย!');
        },
        onKeeperLockedNotice: (tIdx) => {
          if (isPracticeRef.current || tIdx !== turnHistoryRef.current.length) return;
          setPeerReadyBanner('🧤 ผู้รักษาประตูเตรียมพุ่งแล้ว! เล็งมุมแล้วกดหยุดพลังยิงเลย!');
        },
        onShooterChoiceForHost: (pkt: PenaltyShooterLockPacket) => {
          if (!amIMatchHostRef.current || isPracticeRef.current) return;
          if (pkt.turnIndex !== turnHistoryRef.current.length) return;
          pendingShooterLockRef.current = { turnIndex: pkt.turnIndex, choice: pkt.choice };
          tryResolveTurnAsHostRef.current();
        },
        onKeeperChoiceForHost: (pkt: PenaltyKeeperLockPacket) => {
          if (!amIMatchHostRef.current || isPracticeRef.current) return;
          if (pkt.turnIndex !== turnHistoryRef.current.length) return;
          pendingKeeperLockRef.current = { turnIndex: pkt.turnIndex, choice: pkt.choice };
          tryResolveTurnAsHostRef.current();
        },
        onTurnReveal: (pkt) => {
          if (isPracticeRef.current || amIMatchHostRef.current) return;
          executeTurnRevealRef.current(pkt.result);
        },
        onReturnToLobby: () => {
          if (isPracticeRef.current) return;
          returnToLobbyOrHome('lobby');
        },
        onConnectionStatus: (_ok, kind) => {
          setTransportKind(kind);
        },
      },
    });

    ctrl.connect();
    roomCtrlRef.current = ctrl;
  }, [
    roomCode,
    screen,
    currentUserId,
    nickname,
    selectedModelId,
    isCreator,
    showToast,
    startOnlineMatchFromPacket,
    returnToLobbyOrHome,
  ]);

  useEffect(() => {
    return () => {
      roomCtrlRef.current?.destroy();
      roomCtrlRef.current = null;
    };
  }, []);

  // Mount Three.js 3D Penalty Stadium Scene when `screen === 'playing'`
  useEffect(() => {
    if (screen !== 'playing' || !sceneContainerRef.current) return;
    const ctrl = createPenaltyStadiumScene({
      container: sceneContainerRef.current,
      shooterModelId: currentShooterModelId,
      keeperModelId: currentKeeperModelId,
      muted: mutedRef.current,
      onZoneSelect: (zone) => {
        if (turnPhaseRef.current !== 'selecting') return;
        setSelectedZone(zone);
        selectedZoneRef.current = zone;
        setKeeperZonePicked(true);
      },
    });
    sceneCtrlRef.current = ctrl;

    return () => {
      ctrl.dispose();
      sceneCtrlRef.current = null;
    };
    // Intentionally mounted once per match screen; actor swaps & highlights update imperatively below!
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Swap Shooter & Goalkeeper .glb models cleanly whenever turn alternates!
  useEffect(() => {
    if (screen !== 'playing' || !sceneCtrlRef.current) return;
    sceneCtrlRef.current.setActors(currentShooterModelId, currentKeeperModelId);
    sceneCtrlRef.current.resetPositionsForTurn();
  }, [screen, currentShooterModelId, currentKeeperModelId, currentTurnIndex]);

  useEffect(() => {
    sceneCtrlRef.current?.setMuted(muted);
  }, [muted]);

  // Keep secret target hidden on opponent's screen; highlight only local player's own pick!
  useEffect(() => {
    const ctrl = sceneCtrlRef.current;
    if (!ctrl || screen !== 'playing') return;
    const canPick = turnPhase === 'selecting';
    ctrl.setZonePickingEnabled(canPick);
    if (turnPhase === 'selecting' || turnPhase === 'waiting_peer') {
      if (amIShooter) {
        ctrl.setHighlightedZone(selectedZone, 'shooter');
      } else if (keeperZonePicked || turnPhase === 'waiting_peer') {
        ctrl.setHighlightedZone(selectedZone, 'keeper');
      } else {
        ctrl.setHighlightedZone(null, 'keeper');
      }
    } else {
      ctrl.setHighlightedZone(null, 'hidden');
    }
  }, [screen, turnPhase, amIShooter, selectedZone, keeperZonePicked]);

  // Lock Actions for Shooter & Goalkeeper
  const handleLockShooterPower = useCallback(() => {
    if (turnPhaseRef.current !== 'selecting' || !amIShooter) return;
    const elapsedSec = (performance.now() - powerStartPerfRef.current) / 1000;
    const powerVal = computePowerBarCursor(elapsedSec);
    const pZone = classifyPowerZone(powerVal);
    const z = selectedZoneRef.current;

    playPenaltySfx('lock', mutedRef.current);
    setLockedPower(powerVal);
    setTurnPhase('waiting_peer');
    turnPhaseRef.current = 'waiting_peer';
    recentPlayerShotsRef.current.push(z);

    const choice: ShooterLockChoice = {
      zone: z,
      power: powerVal,
      powerZone: pZone,
    };
    const tIdx = turnHistoryRef.current.length;

    if (isPracticeRef.current) {
      pendingShooterLockRef.current = { turnIndex: tIdx, choice };
      const aiKeeper = chooseAiKeeperZone(aiDifficultyRef.current, recentPlayerShotsRef.current);
      pendingKeeperLockRef.current = { turnIndex: tIdx, choice: aiKeeper };
      setTimeout(() => {
        tryResolveTurnAsHostRef.current();
      }, 280);
    } else {
      if (amIMatchHostRef.current) {
        pendingShooterLockRef.current = { turnIndex: tIdx, choice };
      }
      roomCtrlRef.current?.sendShooterLock(
        {
          matchUid: activeMatchUidRef.current,
          turnIndex: tIdx,
          clientId: clientIdRef.current,
          choice,
        },
        amIMatchHostRef.current
      );
      if (amIMatchHostRef.current) {
        tryResolveTurnAsHostRef.current();
      }
    }
  }, [amIShooter]);

  const handleLockKeeperDive = useCallback(
    (explicitZone?: PenaltyZone, timedOut = false) => {
      if (turnPhaseRef.current !== 'selecting' || amIShooter) return;
      const chosenZone = explicitZone ?? selectedZoneRef.current;
      setSelectedZone(chosenZone);
      selectedZoneRef.current = chosenZone;
      setKeeperZonePicked(true);

      playPenaltySfx('lock', mutedRef.current);
      setTurnPhase('waiting_peer');
      turnPhaseRef.current = 'waiting_peer';

      const choice: KeeperLockChoice = { zone: chosenZone, timedOut };
      const tIdx = turnHistoryRef.current.length;

      if (isPracticeRef.current) {
        pendingKeeperLockRef.current = { turnIndex: tIdx, choice };
        const aiShot = chooseAiShooterAction(aiDifficultyRef.current);
        pendingShooterLockRef.current = { turnIndex: tIdx, choice: aiShot };
        setTimeout(() => {
          tryResolveTurnAsHostRef.current();
        }, 320);
      } else {
        if (amIMatchHostRef.current) {
          pendingKeeperLockRef.current = { turnIndex: tIdx, choice };
        }
        roomCtrlRef.current?.sendKeeperLock(
          {
            matchUid: activeMatchUidRef.current,
            turnIndex: tIdx,
            clientId: clientIdRef.current,
            choice,
          },
          amIMatchHostRef.current
        );
        if (amIMatchHostRef.current) {
          tryResolveTurnAsHostRef.current();
        }
      }
    },
    [amIShooter]
  );

  // 60FPS Timing Power Bar Loop when local player is Shooter in 'selecting' phase
  useEffect(() => {
    if (screen !== 'playing' || !amIShooter || turnPhase !== 'selecting') return;
    powerStartPerfRef.current = performance.now();
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const elapsedSec = (performance.now() - powerStartPerfRef.current) / 1000;
      const val = computePowerBarCursor(elapsedSec);
      const pZone: PowerBarZone = classifyPowerZone(val);

      if (powerBarCursorRef.current) {
        powerBarCursorRef.current.style.left = `${val}%`;
      }
      if (powerBarFillRef.current) {
        powerBarFillRef.current.style.width = `${val}%`;
      }
      if (powerBarValueTextRef.current) {
        const label =
          pZone === 'green'
            ? `🟢 ${Math.round(val)}% ยิงคมและแรง!`
            : pZone === 'red'
              ? `🔴 ${Math.round(val)}% แรงเกินระวังข้ามคาน!`
              : `🟡 ${Math.round(val)}% ยิงปกติ`;
        powerBarValueTextRef.current.textContent = label;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [screen, amIShooter, turnPhase, currentTurnIndex]);

  // 8-Second Countdown Timer for Goalkeeper (auto-picks random zone if time expires!)
  useEffect(() => {
    if (screen !== 'playing' || amIShooter || turnPhase !== 'selecting') return;
    const deadline = Date.now() + GK_DECISION_SECONDS * 1000;
    setKeeperTimeLeft(GK_DECISION_SECONDS);

    const iv = setInterval(() => {
      const rem = Math.max(0, (deadline - Date.now()) / 1000);
      setKeeperTimeLeft(Math.round(rem * 10) / 10);
      if (rem <= 0) {
        clearInterval(iv);
        if (turnPhaseRef.current === 'selecting') {
          const fallbackZone = keeperZonePicked
            ? selectedZoneRef.current
            : GOAL_ZONES[Math.floor(Math.random() * GOAL_ZONES.length)].id;
          handleLockKeeperDive(fallbackZone, true);
        }
      }
    }, 100);

    return () => clearInterval(iv);
  }, [screen, amIShooter, turnPhase, currentTurnIndex, keeperZonePicked, handleLockKeeperDive]);

  // Optional Desktop Space/Enter shortcut (Touch & Click work 100% without keyboard!)
  useEffect(() => {
    if (screen !== 'playing' || turnPhase !== 'selecting') return;
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.code === 'Space' || ev.code === 'Enter') {
        ev.preventDefault();
        if (amIShooter) {
          handleLockShooterPower();
        } else {
          handleLockKeeperDive();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, turnPhase, amIShooter, handleLockShooterPower, handleLockKeeperDive]);

  // Lobby Handlers
  const handleCreateRoom = () => {
    const cleanName = nickname.trim() || 'นักเตะสายฟ้า';
    setNickname(cleanName);
    const code = generateRoomCode();
    setIsPractice(false);
    setIsCreator(true);
    setRoomCode(code);
    setScreen('lobby');
  };

  const handleJoinRoom = () => {
    const code = joinCodeInput.replace(/\D/g, '').slice(0, 4);
    if (code.length < 4) {
      showToast('⚠️ กรุณากรอกรหัสห้องให้ครบ 4 หลัก');
      return;
    }
    const cleanName = nickname.trim() || 'นักเตะสายฟ้า';
    setNickname(cleanName);
    setIsPractice(false);
    setIsCreator(false);
    setRoomCode(code);
    setScreen('lobby');
  };

  const handleHostStartOnline = () => {
    if (!lobbyState.p1 || !lobbyState.p2 || !lobbyState.allReady) return;
    if (lobbyState.hostClientId !== clientIdRef.current) return;

    const pkt: PenaltyStartPacket = {
      matchUid: `${roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roomCode,
      hostClientId: clientIdRef.current,
      p1: lobbyState.p1,
      p2: lobbyState.p2,
      startedAt: Date.now(),
    };

    const myChar = getPenaltyCharacter(selectedModelId);
    onLobbyBroadcastRef.current?.({
      roomCode,
      hostUserId: currentUserId || 0,
      hostName: nickname.trim() || 'เพื่อน',
      hostEmoji: myChar.emoji,
      count: 2,
      max: 2,
      status: 'started',
    });

    roomCtrlRef.current?.broadcastMatchStart(pkt);
    startOnlineMatchFromPacket(pkt);
  };

  const handleRematch = () => {
    if (isPractice) {
      startPracticeMatch();
    } else if (amIMatchHost && lobbyState.p1 && lobbyState.p2) {
      const pkt: PenaltyStartPacket = {
        matchUid: `${roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        roomCode,
        hostClientId: clientIdRef.current,
        p1: lobbyState.p1,
        p2: lobbyState.p2,
        startedAt: Date.now(),
      };
      roomCtrlRef.current?.broadcastMatchStart(pkt);
      startOnlineMatchFromPacket(pkt);
    }
  };

  const handleCloseExit = () => {
    if (lobbyState.hostClientId === clientIdRef.current && roomCode) {
      const myChar = getPenaltyCharacter(selectedModelId);
      onLobbyBroadcastRef.current?.({
        roomCode,
        hostUserId: currentUserId || 0,
        hostName: nickname.trim() || 'เพื่อน',
        hostEmoji: myChar.emoji,
        count: 0,
        max: 2,
        status: 'closed',
      });
    }
    roomCtrlRef.current?.destroy();
    roomCtrlRef.current = null;
    onClose?.();
  };

  const renderDotRow = (dots: KickDotStatus[], activeSide: boolean) => (
    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
      {dots.map((st, idx) => {
        const isNextDot =
          activeSide &&
          turnPhase !== 'finished' &&
          st === 'pending' &&
          dots.findIndex((d) => d === 'pending') === idx;
        return (
          <span
            key={idx}
            className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border transition ${
              st === 'goal'
                ? 'bg-emerald-400 border-white shadow-[0_0_8px_#34d399]'
                : st === 'miss'
                  ? 'bg-rose-500 border-rose-200 shadow-[0_0_6px_#f43f5e]'
                  : isNextDot
                    ? 'bg-amber-300/40 border-amber-300 animate-pulse scale-110'
                    : 'bg-slate-800 border-slate-500'
            }`}
          />
        );
      })}
    </div>
  );

  const amILobbyHost = lobbyState.hostClientId === clientIdRef.current;
  const myPresence = lobbyState.onlinePlayers.find((p) => p.clientId === clientIdRef.current);

  return (
    <div
      className={`${
        embeddedModal ? 'fixed inset-0 z-50' : 'min-h-dvh w-full'
      } bg-gradient-to-b from-sky-950 via-emerald-950 to-slate-950 text-white flex flex-col select-none overflow-x-hidden`}
    >
      {/* Toast Alert */}
      {toastAlert && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none max-w-[92vw]">
          <div className="px-4 py-2 rounded-2xl bg-slate-950/95 border-2 border-amber-400 text-amber-200 text-xs sm:text-sm font-extrabold shadow-2xl">
            {toastAlert}
          </div>
        </div>
      )}

      {/* ==================== 1. HOME SCREEN ==================== */}
      {screen === 'home' && (
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-3xl bg-slate-900/95 border-2 border-emerald-400/80 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5 relative my-auto">
            {onClose && (
              <button
                type="button"
                onClick={handleCloseExit}
                className="absolute top-4 right-4 w-9 h-9 rounded-xl bg-rose-600 hover:bg-rose-500 border-2 border-amber-300 font-black cursor-pointer"
              >
                ✕
              </button>
            )}

            <div className="flex items-center gap-3 pr-10">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 via-lime-400 to-amber-300 flex items-center justify-center text-3xl shadow-lg text-slate-950 shrink-0">
                ⚽
              </div>
              <div>
                <h1 className="font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-black text-amber-300 leading-tight">
                  3D Penalty Shootout Online 1v1
                </h1>
                <p className="text-xs sm:text-sm text-emerald-200/85 font-semibold">
                  ศึกดวลจุดโทษวัดใจ 3 มิติ มุมกล้อง PES • สลับยิง 5 ลูก + Sudden Death • รองรับ PC / iPad / มือถือ
                </p>
              </div>
            </div>

            {/* Nickname Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-amber-200 block">
                1. ชื่อเล่นนักเตะของคุณ
              </label>
              <input
                type="text"
                maxLength={22}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="กรอกชื่อเล่น..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 outline-none text-sm font-extrabold text-white select-text"
              />
            </div>

            {/* .glb 3D Model Character Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-amber-200">
                  2. เลือกโมเดลตัวละคร 3D (`public/models/*.glb`)
                </label>
                <span className="text-[11px] text-emerald-300 font-bold">
                  Auto-Normalize + Chibi 3D Fallback
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-52 overflow-y-auto pr-1">
                {PENALTY_CHARACTERS.map((ch) => {
                  const active = selectedModelId === ch.id;
                  const fileBadge = ch.glbPath.replace('/models/', '');
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedModelId(ch.id)}
                      className={`p-2.5 rounded-2xl border-2 text-left transition cursor-pointer flex items-center gap-2 ${
                        active
                          ? 'bg-emerald-950/90 border-amber-300 shadow-[0_0_12px_rgba(250,204,21,0.35)]'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <span className="text-2xl shrink-0">{ch.emoji}</span>
                      <div className="min-w-0">
                        <div className="text-xs font-extrabold text-white truncate">
                          {ch.name.split(' (')[0]}
                        </div>
                        <div className="text-[10px] font-mono text-emerald-300/80 truncate">
                          {fileBadge}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode Cards: Practice vs AI & Online 1v1 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Practice vs AI */}
              <div className="bg-slate-950/85 border-2 border-emerald-500/50 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-emerald-300">
                      🤖 โหมดซ้อมกับบอท (Practice vs AI)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                      เล่นได้ทันที
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    ฝึกเล็ง 6 มุมประตูและกะจังหวะหยุดแถบพลังยิงสีเขียวได้ทันทีโดยไม่ต้องต่อเซิร์ฟเวอร์
                  </p>
                  <div className="flex items-center gap-1.5 pt-1">
                    {(
                      [
                        { id: 'easy', label: 'ชิล' },
                        { id: 'normal', label: 'ปกติ' },
                        { id: 'hard', label: 'โหด' },
                      ] as const
                    ).map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setAiDifficulty(d.id)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                          aiDifficulty === d.id
                            ? 'bg-emerald-400 text-slate-950'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        AI {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startPracticeMatch}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-lime-400 hover:from-emerald-300 hover:to-lime-300 text-slate-950 font-black text-sm shadow-lg cursor-pointer"
                >
                  ⚡ เริ่มดวลจุดโทษกับ AI ทันที!
                </button>
              </div>

              {/* Online 1v1 via Supabase */}
              <div className="bg-slate-950/85 border-2 border-amber-400/60 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-amber-300">
                      🌐 โหมดออนไลน์ 1v1 (Online Match)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-bold">
                      {transportKind === 'supabase' ? 'Supabase Live' : 'Local Multi-Tab'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    ซิงก์เฉพาะจังหวะล็อกเป้าและพุ่งเซฟ (Turn-based) ลื่นไหล ไม่แล็ก ประหยัดโควต้าสุดๆ
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-sm shadow cursor-pointer"
                  >
                    🏟️ สร้างห้อง 1v1 (สุ่มรหัส 4 หลัก)
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={joinCodeInput}
                    onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="รหัส 4 หลัก"
                    className="w-32 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-center font-mono text-sm font-black tracking-widest text-amber-300 outline-none focus:border-amber-400 select-text"
                  />
                  <button
                    type="button"
                    onClick={handleJoinRoom}
                    className="flex-1 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs sm:text-sm cursor-pointer"
                  >
                    🔑 เข้าห้อง
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={() => setScreen('leaderboard')}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-400/50 text-amber-200 text-xs font-extrabold cursor-pointer"
              >
                🏆 ดูตารางอันดับ (Leaderboard)
              </button>
              {!embeddedModal && (
                <Link
                  href="/"
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-extrabold"
                >
                  🏖️ กลับเกาะหลัก 3D Arena
                </Link>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 2. ONLINE 1v1 PRESENCE LOBBY ==================== */}
      {screen === 'lobby' && (
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-2xl bg-slate-900/95 border-2 border-amber-400/80 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 my-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-emerald-300">
                  🏟️ ห้องรอดวลจุดโทษ 1v1 ({transportKind === 'supabase' ? 'Supabase Presence' : 'Local Multi-Tab'})
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-black text-amber-300 tracking-wider">
                    ห้อง #{roomCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard?.writeText(roomCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 1800);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold cursor-pointer"
                  >
                    {copiedCode ? '✅ คัดลอกแล้ว' : '📋 คัดลอกรหัส'}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {embeddedModal && (
                  <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-xl p-1">
                    {['6666', '6667'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setRoomCode(preset)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${
                          roomCode === preset
                            ? 'bg-amber-400 text-slate-950'
                            : 'text-slate-300 hover:text-white'
                        }`}
                      >
                        สนาม #{preset === '6666' ? '1' : '2'}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    roomCtrlRef.current?.destroy();
                    roomCtrlRef.current = null;
                    if (embeddedModal && onClose) {
                      handleCloseExit();
                    } else {
                      setRoomCode('');
                      setScreen('home');
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-extrabold cursor-pointer"
                >
                  {embeddedModal ? '✕ ปิด' : '← ออกห้อง'}
                </button>
              </div>
            </div>

            {/* P1 vs P2 Presence Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  { side: 'p1', label: 'ฝั่งเจ้าบ้าน (P1 • ยิงก่อน)', member: lobbyState.p1 },
                  { side: 'p2', label: 'ฝั่งผู้ท้าชิง (P2 • เซฟก่อน)', member: lobbyState.p2 },
                ] as const
              ).map(({ side, label, member }) => {
                const ch = getPenaltyCharacter(member?.modelId);
                const isHostCard = member && member.clientId === lobbyState.hostClientId;
                const isMe = member?.clientId === clientIdRef.current;
                return (
                  <div
                    key={side}
                    className={`rounded-2xl p-4 border-2 ${
                      member
                        ? side === 'p1'
                          ? 'bg-sky-950/55 border-sky-400/80'
                          : 'bg-rose-950/55 border-rose-400/80'
                        : 'bg-slate-950/60 border-dashed border-slate-700'
                    }`}
                  >
                    <div className="text-[11px] font-extrabold text-slate-300 mb-2">{label}</div>
                    {member ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-white/20 flex items-center justify-center text-2xl shrink-0">
                            {ch.emoji}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-sm text-white truncate">
                              {isHostCard && '👑 '}
                              {member.name}
                              {isMe && ' (คุณ)'}
                            </div>
                            <div className="text-[11px] text-amber-200/85 truncate">
                              {ch.name.split(' (')[0]}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-black shrink-0 ${
                            isHostCard || member.ready
                              ? 'bg-emerald-400 text-slate-950'
                              : 'bg-slate-800 text-amber-300'
                          }`}
                        >
                          {isHostCard ? 'HOST' : member.ready ? 'READY!' : 'รอ Ready'}
                        </span>
                      </div>
                    ) : (
                      <div className="py-3 text-center text-xs font-bold text-slate-400 animate-pulse">
                        ⏳ รอผู้เล่นอีกฝ่ายเข้าห้อง #{roomCode}...
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Quick .glb Model Switcher inside Lobby */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2">
              <div className="text-xs font-extrabold text-amber-200">
                🎭 เปลี่ยนตัวละคร 3D `.glb` ของคุณ:
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {PENALTY_CHARACTERS.map((ch) => {
                  const selected = (myPresence?.modelId || selectedModelId) === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        setSelectedModelId(ch.id);
                        void roomCtrlRef.current?.updateMyPresence({ modelId: ch.id });
                      }}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold shrink-0 cursor-pointer flex items-center gap-1 ${
                        selected
                          ? 'bg-amber-400 text-slate-950 border-white'
                          : 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      <span>{ch.emoji}</span>
                      <span>{ch.name.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ready / Start Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5">
              {amILobbyHost ? (
                <button
                  type="button"
                  disabled={!lobbyState.allReady}
                  onClick={handleHostStartOnline}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-sm sm:text-base transition ${
                    lobbyState.allReady
                      ? 'bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 shadow-xl cursor-pointer hover:scale-[1.01]'
                      : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {lobbyState.allReady
                    ? '⚽ เริ่มศึกดวลจุดโทษ 1v1 เลย!'
                    : lobbyState.bothPresent
                      ? '⏳ รอผู้ท้าชิงกดปุ่ม Ready...'
                      : '⏳ รอเพื่อนเข้าห้องอีก 1 คน...'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void roomCtrlRef.current?.updateMyPresence({
                      ready: !myPresence?.ready,
                    })
                  }
                  className={`flex-1 py-3.5 rounded-2xl font-black text-sm sm:text-base cursor-pointer transition ${
                    myPresence?.ready
                      ? 'bg-emerald-400 text-slate-950 shadow-lg'
                      : 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-lg'
                  }`}
                >
                  {myPresence?.ready ? '✅ พร้อมแล้ว! (กดซ้ำเพื่อยกเลิก)' : '🔥 กด READY พร้อมดวล!'}
                </button>
              )}

              <button
                type="button"
                onClick={startPracticeMatch}
                className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-emerald-400/50 text-emerald-300 text-xs sm:text-sm font-extrabold cursor-pointer"
              >
                🤖 ซ้อมกับ AI พลางๆ
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => setScreen('leaderboard')}
                className="text-amber-300 hover:underline font-extrabold cursor-pointer"
              >
                🏆 ตารางอันดับดาวซัลโว
              </button>
              {embeddedModal && onClose && (
                <button
                  type="button"
                  onClick={handleCloseExit}
                  className="text-slate-300 hover:text-white font-bold cursor-pointer"
                >
                  🏖️ กลับไปเดินเล่นบนเกาะ
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 3. 3D PES PENALTY SHOOTOUT GAMEPLAY ==================== */}
      {screen === 'playing' && (
        <div
          className="relative w-full h-dvh overflow-hidden select-none touch-none"
          style={{ touchAction: 'none' }}
        >
          {/* Three.js 3D Stadium Canvas */}
          <div ref={sceneContainerRef} className="fixed inset-0 w-full h-full touch-none" />

          {/* Top Scoreboard HUD (5 Green/Red Dots + Sudden Death) */}
          <div className="fixed top-2 sm:top-3 inset-x-2 sm:inset-x-4 pt-safe z-20 flex items-start justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (isPractice) {
                    returnToLobbyOrHome(roomCode ? 'lobby' : 'home');
                  } else if (amIMatchHost && roomCtrlRef.current) {
                    roomCtrlRef.current.broadcastReturnToLobby();
                    returnToLobbyOrHome('lobby');
                  } else {
                    returnToLobbyOrHome(roomCode ? 'lobby' : 'home');
                  }
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-950/85 hover:bg-amber-500 hover:text-slate-950 border border-amber-300/60 text-xs font-extrabold text-amber-100 cursor-pointer shadow"
              >
                ← {roomCode ? 'ห้องรอ' : 'หน้าแรก'}
              </button>
              {embeddedModal && onClose && (
                <button
                  type="button"
                  onClick={handleCloseExit}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-950/85 hover:bg-rose-600 border border-rose-400/50 text-xs font-extrabold text-rose-200 hover:text-white cursor-pointer shadow"
                >
                  🏖️ <span className="hidden sm:inline">เกาะหลัก</span>
                </button>
              )}
            </div>

            {/* Center 5-Kick + Sudden Death Scoreboard */}
            <div className="pointer-events-auto bg-slate-950/90 border-2 border-amber-400 rounded-2xl px-3 sm:px-5 py-1.5 sm:py-2 shadow-2xl flex flex-col items-center gap-1 max-w-[66vw]">
              <div className="flex items-center gap-2.5 sm:gap-5">
                <div className="flex flex-col items-end min-w-0">
                  <div className="text-[11px] sm:text-xs font-extrabold text-sky-300 truncate max-w-[90px] sm:max-w-[140px]">
                    {getPenaltyCharacter(matchP1.modelId).emoji} {matchP1.name}
                  </div>
                  {renderDotRow(scoreSummary.p1Dots, currentShooterSide === 'p1')}
                </div>

                <div className="flex items-center gap-1.5 font-[family-name:var(--font-kanit)] text-xl sm:text-2xl font-black">
                  <span className="px-2.5 py-0.5 rounded-lg bg-sky-500 text-slate-950 min-w-[32px] text-center">
                    {scoreSummary.p1Goals}
                  </span>
                  <span className="text-amber-300 text-sm">-</span>
                  <span className="px-2.5 py-0.5 rounded-lg bg-rose-500 text-white min-w-[32px] text-center">
                    {scoreSummary.p2Goals}
                  </span>
                </div>

                <div className="flex flex-col items-start min-w-0">
                  <div className="text-[11px] sm:text-xs font-extrabold text-rose-300 truncate max-w-[90px] sm:max-w-[140px]">
                    {matchP2.name} {getPenaltyCharacter(matchP2.modelId).emoji}
                  </div>
                  {renderDotRow(scoreSummary.p2Dots, currentShooterSide === 'p2')}
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-extrabold">
                {scoreSummary.isSuddenDeath ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                    🔥 SUDDEN DEATH (ลูกที่ {scoreSummary.currentRound})
                  </span>
                ) : (
                  <span className="text-amber-200/90">
                    ลูกที่ {Math.min(scoreSummary.currentRound, REGULATION_KICKS)}/{REGULATION_KICKS} •{' '}
                    {amIShooter ? '⚽ ตาคุณยิง!' : '🧤 ตาคุณเป็นผู้รักษาประตู!'}
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMuted((v) => !v)}
              className="pointer-events-auto px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-950/85 border border-slate-600 text-xs font-extrabold cursor-pointer shadow"
            >
              {muted ? '🔇' : '🔊'}
            </button>
          </div>

          {/* Peer Status / Countdown Sub-Banner */}
          {turnPhase !== 'finished' && (peerReadyBanner || (!amIShooter && turnPhase === 'selecting')) && (
            <div className="fixed top-22 sm:top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1 w-[92vw] max-w-md">
              {!amIShooter && turnPhase === 'selecting' && (
                <div
                  className={`px-3.5 py-1 rounded-full border-2 text-xs sm:text-sm font-black shadow-lg ${
                    keeperTimeLeft <= 3
                      ? 'bg-rose-600 border-white text-white animate-bounce'
                      : 'bg-slate-950/90 border-sky-400 text-sky-200'
                  }`}
                >
                  ⏱️ เลือกโซนพุ่งปัดใน {keeperTimeLeft.toFixed(1)} วินาที!
                </div>
              )}
              {peerReadyBanner && (
                <div className="px-3.5 py-1 rounded-full bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-black shadow-lg">
                  {peerReadyBanner}
                </div>
              )}
            </div>
          )}

          {/* Direct Touch & Click 6-Zone Goal Target Pad (Overlay aligned with Goal Frame for iPad/Mobile/PC!) */}
          {turnPhase === 'selecting' && (
            <div className="fixed inset-x-3 sm:inset-x-8 top-[24%] sm:top-[22%] flex justify-center z-20 pointer-events-none">
              <div className="w-full max-w-[500px] aspect-[2.65/1] grid grid-cols-3 grid-rows-2 gap-1.5 sm:gap-2 p-1.5 rounded-2xl border-2 border-white/45 bg-slate-950/20 backdrop-blur-[1px] pointer-events-auto">
                {GOAL_ZONES.map((z) => {
                  const isPicked = amIShooter
                    ? selectedZone === z.id
                    : keeperZonePicked && selectedZone === z.id;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        playPenaltySfx('lock', mutedRef.current);
                        setSelectedZone(z.id);
                        selectedZoneRef.current = z.id;
                        if (!amIShooter) {
                          setKeeperZonePicked(true);
                        }
                      }}
                      className={`rounded-xl border-2 flex flex-col items-center justify-center transition touch-none cursor-pointer ${
                        isPicked
                          ? amIShooter
                            ? 'bg-emerald-500/45 border-amber-300 shadow-[0_0_16px_rgba(52,211,153,0.75)] scale-[1.02]'
                            : 'bg-sky-500/50 border-amber-300 shadow-[0_0_16px_rgba(56,189,248,0.75)] scale-[1.02]'
                          : 'bg-slate-950/30 hover:bg-white/15 border-white/30'
                      }`}
                    >
                      <span className="text-sm sm:text-lg leading-none">
                        {amIShooter ? '🎯' : '🧤'}
                      </span>
                      <span className="text-[10px] sm:text-xs font-black text-white drop-shadow mt-0.5">
                        {z.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Impact Result Banner (GOAL! / SAVED! / POST! / OVER!) */}
          {impactBanner && turnPhase !== 'finished' && (
            <div className="fixed top-[34%] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[92vw] max-w-md text-center">
              <div
                className={`px-5 py-3.5 rounded-3xl border-3 shadow-2xl animate-bounce ${
                  impactBanner.tone === 'goal'
                    ? 'bg-gradient-to-r from-emerald-500 via-lime-400 to-amber-300 border-white text-slate-950'
                    : impactBanner.tone === 'saved'
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-600 border-amber-300 text-white'
                      : 'bg-gradient-to-r from-rose-600 to-orange-600 border-amber-200 text-white'
                }`}
              >
                <div className="font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-black">
                  {impactBanner.title}
                </div>
                <div className="text-xs sm:text-sm font-extrabold mt-0.5 opacity-95">
                  {impactBanner.subtitle}
                </div>
              </div>
            </div>
          )}

          {/* Bottom Touch Action Dock (Timing Power Bar + Giant Tap Button for Mobile / iPad / PC) */}
          {turnPhase !== 'finished' && (
            <div className="fixed bottom-3 sm:bottom-5 inset-x-3 sm:inset-x-6 pb-safe z-30 flex flex-col items-center gap-2.5 pointer-events-none">
              {turnPhase === 'selecting' && amIShooter && (
                <div className="w-full max-w-lg bg-slate-950/92 border-2 border-amber-400/90 rounded-3xl p-3 sm:p-4 shadow-2xl space-y-2.5 pointer-events-auto">
                  <div className="flex items-center justify-between text-xs font-extrabold">
                    <span className="text-emerald-300">
                      🤫 มุมเล็งลับ: <strong className="text-amber-300">{getGoalZoneMeta(selectedZone).label}</strong> (ผู้รักษาประตูไม่เห็น)
                    </span>
                    <span ref={powerBarValueTextRef} className="text-amber-200 font-black">
                      🟢 กะจังหวะสีเขียว!
                    </span>
                  </div>

                  {/* Oscillating Timing Power Bar (Yellow 0..55% | Green 55..80% | Red 80..100%) */}
                  <div className="relative w-full h-7 sm:h-8 rounded-full overflow-hidden border-2 border-white shadow-inner flex">
                    <div
                      style={{ width: `${POWER_GREEN_MIN}%` }}
                      className="h-full bg-gradient-to-r from-amber-300 to-yellow-400 flex items-center justify-center text-[10px] font-black text-slate-950"
                    >
                      ปกติ
                    </div>
                    <div
                      style={{ width: `${POWER_GREEN_MAX - POWER_GREEN_MIN}%` }}
                      className="h-full bg-gradient-to-r from-emerald-400 to-green-500 flex items-center justify-center text-[10px] font-black text-slate-950 border-x-2 border-white"
                    >
                      คมกริบ!
                    </div>
                    <div
                      style={{ width: `${100 - POWER_GREEN_MAX}%` }}
                      className="h-full bg-gradient-to-r from-orange-500 to-rose-600 flex items-center justify-center text-[10px] font-black text-white"
                    >
                      แรงเกิน!
                    </div>

                    {/* Subtle progress tint */}
                    <div
                      ref={powerBarFillRef}
                      className="absolute inset-y-0 left-0 bg-white/15 pointer-events-none"
                      style={{ width: '0%' }}
                    />
                    {/* Moving Indicator Needle */}
                    <div
                      ref={powerBarCursorRef}
                      className="absolute top-0 bottom-0 w-2 -ml-1 bg-slate-950 border-x-2 border-white shadow-[0_0_10px_#fff] pointer-events-none"
                      style={{ left: '0%' }}
                    />
                  </div>

                  {/* Giant Touch Button to Stop Power Bar & Shoot */}
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleLockShooterPower();
                    }}
                    className="w-full py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-300 active:scale-[0.98] border-2 border-white text-slate-950 font-[family-name:var(--font-kanit)] font-black text-base sm:text-xl shadow-xl cursor-pointer touch-none"
                  >
                    💥 แตะหยุดแถบพลัง & ซัดจุดโทษ!
                  </button>
                </div>
              )}

              {turnPhase === 'selecting' && !amIShooter && (
                <div className="w-full max-w-lg bg-slate-950/92 border-2 border-sky-400/90 rounded-3xl p-3 sm:p-4 shadow-2xl space-y-2.5 pointer-events-auto">
                  <div className="flex items-center justify-between text-xs font-extrabold">
                    <span className="text-sky-200">
                      🧤 แตะเลือก 1 ใน 6 โซนบนกรอบประตูด้านบน ({keeperZonePicked ? `เลือก: ${getGoalZoneMeta(selectedZone).label}` : 'แตะเลือกโซนได้เลย'})
                    </span>
                    <span className="text-amber-300 font-black">{keeperTimeLeft.toFixed(1)}s</span>
                  </div>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleLockKeeperDive(selectedZone, false);
                    }}
                    className="w-full py-3.5 sm:py-4 rounded-2xl bg-gradient-to-r from-sky-400 via-cyan-400 to-indigo-400 active:scale-[0.98] border-2 border-white text-slate-950 font-[family-name:var(--font-kanit)] font-black text-base sm:text-xl shadow-xl cursor-pointer touch-none"
                  >
                    🧤 ล็อกมุมพุ่งปัด ({getGoalZoneMeta(selectedZone).label})!
                  </button>
                </div>
              )}

              {turnPhase === 'waiting_peer' && (
                <div className="px-6 py-3 rounded-2xl bg-slate-950/90 border-2 border-amber-300 text-amber-200 text-xs sm:text-sm font-extrabold shadow-xl animate-pulse pointer-events-auto">
                  {amIShooter
                    ? `✅ ล็อกลูกยิง (${Math.round(lockedPower ?? 0)}%) แล้ว! รอผู้รักษาประตูเลือกมุมพุ่งปัด...`
                    : `🧤 ล็อกมุมพุ่งปัดแล้ว! รอคนยิงสับไก...`}
                </div>
              )}
            </div>
          )}

          {/* Match Finished Overlay */}
          {turnPhase === 'finished' && scoreSummary.winner && (
            <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 text-center space-y-3.5 shadow-2xl">
                <div className="text-5xl">
                  {scoreSummary.winner === mySide ? '🏆⚽' : '🧤👏'}
                </div>
                <h3 className="font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-black text-amber-300">
                  {scoreSummary.winner === mySide
                    ? 'ชนะดวลจุดโทษ!! สุดยอดดาวซัลโว!'
                    : 'พ่ายไปนิดเดียว! แก้มือรอบหน้า!'}
                </h3>
                <div className="font-[family-name:var(--font-kanit)] text-3xl font-black">
                  <span className="text-sky-400">{scoreSummary.p1Goals}</span>
                  <span className="text-slate-500 mx-2">-</span>
                  <span className="text-rose-400">{scoreSummary.p2Goals}</span>
                </div>
                {scoreSummary.isSuddenDeath && (
                  <div className="inline-block px-3 py-0.5 rounded-full bg-rose-600/30 border border-rose-400 text-xs font-extrabold text-rose-200">
                    🔥 ตัดสินในช่วง Sudden Death!
                  </div>
                )}

                {rewardNotice && (
                  <div className="rounded-xl bg-emerald-950/90 border border-emerald-400 px-3 py-2 text-xs font-extrabold text-emerald-200">
                    {rewardNotice}
                  </div>
                )}
                {dbSaveNotice && (
                  <div className="rounded-xl bg-sky-950/90 border border-sky-400 px-3 py-1.5 text-[11px] font-bold text-sky-200">
                    {dbSaveNotice}
                  </div>
                )}

                <div className="flex flex-col gap-2 pt-1">
                  {isPractice || amIMatchHost ? (
                    <button
                      type="button"
                      onClick={handleRematch}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 font-black text-sm cursor-pointer"
                    >
                      🔄 ดวลจุดโทษอีกรอบ (Rematch!)
                    </button>
                  ) : (
                    <div className="text-xs font-bold text-amber-200/85 py-1">
                      รอ Host กดเริ่มรอบใหม่ หรือกลับห้องรอด้านล่าง
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      if (!isPractice && amIMatchHost && roomCtrlRef.current) {
                        roomCtrlRef.current.broadcastReturnToLobby();
                      }
                      returnToLobbyOrHome(roomCode ? 'lobby' : 'home');
                    }}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-400/50 text-xs font-extrabold text-amber-200 cursor-pointer"
                  >
                    🏠 {roomCode ? 'กลับห้องรอ (Lobby)' : 'กลับหน้าแรก'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setScreen('leaderboard')}
                    className="w-full py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-xs font-extrabold text-white cursor-pointer"
                  >
                    🏆 ดูตารางอันดับ (Leaderboard)
                  </button>

                  {embeddedModal && onClose && (
                    <button
                      type="button"
                      onClick={handleCloseExit}
                      className="w-full py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-extrabold text-slate-200 cursor-pointer"
                    >
                      🏖️ กลับสู่เกาะหลัก
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== 4. LEADERBOARD SCREEN ==================== */}
      {screen === 'leaderboard' && (
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-3 sm:p-6">
          <PenaltyLeaderboardPanel
            standaloneLink={!embeddedModal}
            onBack={() => setScreen(roomCode && !isPractice ? 'lobby' : 'home')}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Modal Wrapper for the 3D Weight-Loss Island Arena (`app/page.tsx`)
// ============================================================================

export interface PenaltyModalPlayerSummary {
  id: number;
  name: string;
  emoji?: string;
  species?: string;
  breed?: string;
}

export function PenaltyShootoutModal({
  isOpen,
  onClose,
  players,
  currentUserId,
  initialRoomCode,
  initialIsHost = false,
  invitedTargetName,
  onLobbyBroadcast,
  onRewardEarned,
}: {
  isOpen: boolean;
  onClose: () => void;
  players: PenaltyModalPlayerSummary[];
  currentUserId: number | null;
  initialRoomCode?: string;
  initialIsHost?: boolean;
  invitedTargetName?: string;
  onLobbyBroadcast?: (info: PenaltyLobbyBroadcastInfo) => void;
  onRewardEarned?: (earned: number, totalPoints: number) => void;
}) {
  if (!isOpen) return null;
  const me = players.find((p) => p.id === currentUserId) || players[0];
  const mappedModel = mapSpeciesOrEmojiToPenaltyChar(me?.breed || me?.species, me?.emoji);

  return (
    <PenaltyShootoutGame
      embeddedModal
      onClose={onClose}
      defaultNickname={me?.name || 'นักเตะสายฟ้า'}
      defaultModelId={mappedModel}
      currentUserId={currentUserId}
      autoRoomCode={initialRoomCode || '6666'}
      autoIsCreator={initialIsHost}
      invitedTargetName={invitedTargetName}
      onLobbyBroadcast={onLobbyBroadcast}
      onRewardEarned={onRewardEarned}
    />
  );
}
