'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { sessionFetch } from '@/lib/client_session';
import { detectDeviceTier } from '@/lib/device_perf';
import {
  GK_DECISION_SECONDS,
  GOAL_ZONES,
  MATCH_DURATION_SEC_FALLBACK,
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
  type FootballAvatarProfile,
  type KeeperLockChoice,
  type KickDotStatus,
  type PenaltyDifficulty,
  type PenaltySide,
  type PenaltyZone,
  type PowerBarZone,
  type ResolvedTurnResult,
  type ShooterLockChoice,
} from './penalty/rules';
import {
  createPenaltyStadiumScene,
  playPenaltySfx,
  type PenaltySceneController,
} from './penalty/scene3d';
import {
  ALL_FOOTBALL_SLOTS,
  BALL_RADIUS,
  BLUE_SLOTS,
  EMPTY_TEAM_INPUT,
  MATCH_DURATION_SEC,
  RED_SLOTS,
  createInitialFootballMatchState,
  getSlotTeam,
  setFootballSlotBotMode,
  stepFootballMatch,
  type FootballFrameEvents,
  type FootballMatchState,
  type FootballSlotId,
  type FootballTeam,
  type TeamControlInput,
} from './match3v3/physics';
import { stepAllFootballAI } from './match3v3/ai';
import {
  createFootball3v3StadiumScene,
  type Football3v3SceneController,
  type RenderPitchSnapshot,
} from './match3v3/scene3d';
import { VirtualGamepad } from './shared/VirtualGamepad';
import {
  FOOTBALL_BROADCAST_INTERVAL_MS,
  FootballStateInterpolator,
  PenaltyRoomController,
  generateRoomCode,
  isSupabaseConfigured,
  serializeFootballSnapshot,
  type FootballLobbyMode,
  type FootballNetSnapshot,
  type PenaltyKeeperLockPacket,
  type PenaltyPresenceMember,
  type PenaltyResolvedLobby,
  type PenaltyShooterLockPacket,
  type PenaltyStartPacket,
} from '@/games/shared/realtimeSync';
import {
  fetchPenaltyLeaderboard,
  recordPenaltyMatchByHost,
  type PenaltyLeaderRow,
  type PenaltyMatchHistoryRow,
  type PenaltyPlayerStatEntry,
} from './stats';

void MATCH_DURATION_SEC_FALLBACK;

function formatMatchClock(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

const SLOT_ROLE_LABELS: Record<FootballSlotId, string> = {
  B1: 'ฟ้า #1 (หน้าเป้า)',
  B2: 'ฟ้า #2 (ริมเส้นซ้าย)',
  B3: 'ฟ้า #3 (ตัวกวาด/ขวา)',
  R1: 'แดง #1 (หน้าเป้า)',
  R2: 'แดง #2 (ริมเส้นซ้าย)',
  R3: 'แดง #3 (ตัวกวาด/ขวา)',
};

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
              ตารางอันดับศึกฟุตบอลโกลหนู 3v3 & ดวลจุดโทษ
            </h2>
            <p className="text-xs text-emerald-200/80 font-semibold">
              บันทึกสถิติผู้เล่นทุกคนเฉพาะตอนจบแมตช์ออนไลน์ 1 ครั้งโดย Host ({source === 'supabase' ? 'Supabase PostgreSQL' : 'Local DB'})
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
          <p className="text-sm font-extrabold text-amber-200">ยังไม่มีสถิติแมตช์ออนไลน์</p>
          <p className="text-xs text-slate-400">
            สร้างห้องชวนเพื่อนแข่งฟุตบอลโกลหนู 3v3 (สูงสุด 6 คน) หรือดวลจุดโทษ 1v1 ให้จบแมตช์เพื่อขึ้นแท่นอันดับ #1!
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-slate-800/90 text-amber-300 font-extrabold">
              <tr>
                <th className="py-2.5 px-3">#</th>
                <th className="py-2.5 px-3">นักเตะ</th>
                <th className="py-2.5 px-3 text-center">ชนะ</th>
                <th className="py-2.5 px-3 text-center">แพ้</th>
                <th className="py-2.5 px-3 text-center">Win Rate</th>
                <th className="py-2.5 px-3 text-center">ประตูรวม</th>
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
            📜 ประวัติผลการแข่งขันล่าสุด
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
                        PK
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
// Unified 6-Player Street Football 3v3 ("โกลหนู") + 1v1 Penalty Shootout Game
// ============================================================================

export interface PenaltyLobbyBroadcastInfo {
  roomCode: string;
  mode?: string;
  hostUserId: number;
  hostName: string;
  hostEmoji: string;
  targetName?: string;
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
}

export interface PenaltyShootoutGameProps {
  embeddedModal?: boolean;
  onClose?: () => void;
  defaultNickname?: string;
  defaultModelId?: string;
  myIslandAvatar?: FootballAvatarProfile | null;
  islandAvatarsPool?: FootballAvatarProfile[];
  currentUserId?: number | null;
  autoRoomCode?: string;
  autoIsCreator?: boolean;
  invitedTargetName?: string;
  onParticipationChange?: (participating: boolean, clientId: string, isHostNow: boolean) => void;
  onLobbyBroadcast?: (info: PenaltyLobbyBroadcastInfo) => void;
  onRewardEarned?: (earned: number, totalPoints: number) => void;
}

interface ActiveSlotParticipant {
  slotId: FootballSlotId;
  clientId: string;
  userId?: number | null;
  name: string;
  modelId: string;
  avatar?: FootballAvatarProfile | null;
  isBot: boolean;
}

function createDefaultMatchSlots(): Record<FootballSlotId, ActiveSlotParticipant> {
  return {
    B1: { slotId: 'B1', clientId: 'b1', name: 'กัปตันฟ้า', modelId: 'fox_hero', avatar: null, isBot: false },
    B2: { slotId: 'B2', clientId: 'bot_B2', name: 'AI ฟ้า #2', modelId: 'bunny_hero', avatar: null, isBot: true },
    B3: { slotId: 'B3', clientId: 'bot_B3', name: 'AI ฟ้า #3', modelId: 'panda_hero', avatar: null, isBot: true },
    R1: { slotId: 'R1', clientId: 'bot_R1', name: 'AI แดง #1', modelId: 'husky_hero', avatar: null, isBot: true },
    R2: { slotId: 'R2', clientId: 'bot_R2', name: 'AI แดง #2', modelId: 'tiger_hero', avatar: null, isBot: true },
    R3: { slotId: 'R3', clientId: 'bot_R3', name: 'AI แดง #3', modelId: 'bear_hero', avatar: null, isBot: true },
  };
}

function buildSixSlotParticipants(opts: {
  humanSlots: Partial<Record<FootballSlotId, PenaltyPresenceMember>>;
  islandPool: FootballAvatarProfile[];
  presetAvatars?: Partial<Record<FootballSlotId, FootballAvatarProfile>>;
  presetModels?: Partial<Record<FootballSlotId, string>>;
  presetNames?: Partial<Record<FootballSlotId, string>>;
}): Record<FootballSlotId, ActiveSlotParticipant> {
  const usedPlayerIds = new Set<number>();
  const usedModels = new Set<string>();

  for (const s of ALL_FOOTBALL_SLOTS) {
    const h = opts.humanSlots[s];
    if (h?.avatar?.playerId) usedPlayerIds.add(h.avatar.playerId);
    if (h?.modelId) usedModels.add(h.modelId);
  }

  const friendCandidates = opts.islandPool.filter(
    (p) => !p.playerId || !usedPlayerIds.has(p.playerId)
  );
  let friendCursor = 0;

  const result = {} as Record<FootballSlotId, ActiveSlotParticipant>;
  ALL_FOOTBALL_SLOTS.forEach((slotId, idx) => {
    const human = opts.humanSlots[slotId];
    if (human) {
      result[slotId] = {
        slotId,
        clientId: human.clientId,
        userId: human.userId,
        name: human.name,
        modelId: human.modelId || 'fox_hero',
        avatar: human.avatar ?? opts.presetAvatars?.[slotId] ?? null,
        isBot: false,
      };
      return;
    }

    // AI Bot fills this empty slot!
    const presetAv = opts.presetAvatars?.[slotId];
    const presetModel = opts.presetModels?.[slotId];
    const presetName = opts.presetNames?.[slotId];

    if (presetName || presetAv || presetModel) {
      result[slotId] = {
        slotId,
        clientId: `bot_${slotId}`,
        userId: presetAv?.playerId ?? 0,
        name: presetName || (presetAv ? `AI ${presetAv.name}` : `AI ${slotId}`),
        modelId: presetModel || PENALTY_CHARACTERS[idx % PENALTY_CHARACTERS.length].id,
        avatar: presetAv ?? null,
        isBot: true,
      };
      return;
    }

    const friendAv =
      friendCursor < friendCandidates.length ? friendCandidates[friendCursor++] : null;
    if (friendAv?.playerId) usedPlayerIds.add(friendAv.playerId);

    const charCand =
      PENALTY_CHARACTERS.find((c) => !usedModels.has(c.id)) ||
      PENALTY_CHARACTERS[idx % PENALTY_CHARACTERS.length];
    usedModels.add(charCand.id);

    result[slotId] = {
      slotId,
      clientId: `bot_${slotId}`,
      userId: friendAv?.playerId ?? 0,
      name: friendAv ? `AI ${friendAv.name}` : `AI ${charCand.name.split(' ')[0]}`,
      modelId: charCand.id,
      avatar: friendAv,
      isBot: true,
    };
  });

  return result;
}

type TurnPhase = 'selecting' | 'waiting_peer' | 'animating' | 'finished';

export function PenaltyShootoutGame({
  embeddedModal = false,
  onClose,
  defaultNickname = '',
  defaultModelId = 'fox_hero',
  myIslandAvatar = null,
  islandAvatarsPool = [],
  currentUserId = null,
  autoRoomCode,
  autoIsCreator = false,
  invitedTargetName,
  onParticipationChange,
  onLobbyBroadcast,
  onRewardEarned,
}: PenaltyShootoutGameProps) {
  const [screen, setScreen] = useState<
    'home' | 'lobby' | 'playing_3v3' | 'playing_penalty' | 'leaderboard'
  >(() => (autoRoomCode ? 'lobby' : 'home'));

  const [selectedMode, setSelectedMode] = useState<FootballLobbyMode>('match_3v3');
  const [nickname, setNickname] = useState<string>(defaultNickname || 'กัปตันสายฟ้า');
  const [selectedModelId, setSelectedModelId] = useState<string>(defaultModelId || 'fox_hero');
  const [useMyIslandChar, setUseMyIslandChar] = useState<boolean>(() => Boolean(myIslandAvatar));
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

  const [showVirtualPad, setShowVirtualPad] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const tier = detectDeviceTier();
    return (
      tier !== 'desktop' ||
      navigator.maxTouchPoints > 0 ||
      'ontouchstart' in window ||
      window.innerWidth <= 1180
    );
  });

  const clientIdRef = useRef<string>(
    `fb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  );
  const roomCtrlRef = useRef<PenaltyRoomController | null>(null);

  const [lobbyState, setLobbyState] = useState<PenaltyResolvedLobby>({
    matchMode: 'match_3v3',
    hostClientId: null,
    slots: {},
    p1: null,
    p2: null,
    onlinePlayers: [],
    humanCount: 0,
    maxPlayers: 6,
    bothPresent: false,
    allSlotsFilled: false,
    allHumansReady: false,
    allReady: false,
  });

  const [matchSlots, setMatchSlots] = useState<Record<FootballSlotId, ActiveSlotParticipant>>(
    createDefaultMatchSlots
  );
  const matchSlotsRef = useRef<Record<FootballSlotId, ActiveSlotParticipant>>(matchSlots);
  matchSlotsRef.current = matchSlots;

  const [mySlotId, setMySlotId] = useState<FootballSlotId>('B1');
  const mySlotIdRef = useRef<FootballSlotId>('B1');
  mySlotIdRef.current = mySlotId;

  const islandPoolRef = useRef<FootballAvatarProfile[]>(islandAvatarsPool);
  islandPoolRef.current = islandAvatarsPool;

  const activeMyAvatar: FootballAvatarProfile | null = useMemo(
    () =>
      useMyIslandChar && myIslandAvatar
        ? { ...myIslandAvatar, name: nickname.trim() || myIslandAvatar.name }
        : null,
    [useMyIslandChar, myIslandAvatar, nickname]
  );

  const [mySide, setMySide] = useState<PenaltySide>('p1'); // 'p1' = Blue Team, 'p2' = Red Team
  const [amIMatchHost, setAmIMatchHost] = useState<boolean>(true);
  const [cameFrom3v3TieScore, setCameFrom3v3TieScore] = useState<number | null>(null);

  // ==================== Phase 2 (Street 3v3 โกลหนู) Live HUD States ====================
  const [fbScoreBlue, setFbScoreBlue] = useState<number>(0);
  const [fbScoreRed, setFbScoreRed] = useState<number>(0);
  const [fbClockSec, setFbClockSec] = useState<number>(MATCH_DURATION_SEC);
  const [fbGoalSplash, setFbGoalSplash] = useState<{
    team: FootballTeam;
    scorerName: string;
  } | null>(null);
  const [fbTieTransitionBanner, setFbTieTransitionBanner] = useState<boolean>(false);
  const [fbWinnerTeam, setFbWinnerTeam] = useState<FootballTeam | null>(null);

  // ==================== Phase 1 (Penalty Shootout) States ====================
  const [turnHistory, setTurnHistory] = useState<ResolvedTurnResult[]>([]);
  const [turnPhase, setTurnPhase] = useState<TurnPhase>('selecting');
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

  // Refs for stable callbacks
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
  const cameFrom3v3TieRef = useRef<number | null>(cameFrom3v3TieScore);
  cameFrom3v3TieRef.current = cameFrom3v3TieScore;
  const turnHistoryRef = useRef<ResolvedTurnResult[]>(turnHistory);
  turnHistoryRef.current = turnHistory;
  const turnPhaseRef = useRef<TurnPhase>(turnPhase);
  turnPhaseRef.current = turnPhase;
  const selectedZoneRef = useRef<PenaltyZone>(selectedZone);
  selectedZoneRef.current = selectedZone;
  const onLobbyBroadcastRef = useRef(onLobbyBroadcast);
  onLobbyBroadcastRef.current = onLobbyBroadcast;
  const onParticipationChangeRef = useRef(onParticipationChange);
  onParticipationChangeRef.current = onParticipationChange;
  const onRewardEarnedRef = useRef(onRewardEarned);
  onRewardEarnedRef.current = onRewardEarned;
  const hadIslandAvatarRef = useRef<boolean>(Boolean(myIslandAvatar));
  const lastTeammateCallSfxMsRef = useRef<number>(0);

  const activeMatchUidRef = useRef<string>('');
  const matchStartedAtRef = useRef<number>(0);
  const matchSavedRef = useRef<boolean>(false);
  const rewardClaimedRef = useRef<boolean>(false);
  const recentPlayerShotsRef = useRef<PenaltyZone[]>([]);

  // 3v3 Input, Physics & Lerp Refs (Supports up to 5 Remote Guests + 1 Host = 6 Players!)
  const fbMatchStateRef = useRef<FootballMatchState | null>(null);
  const localFbInputRef = useRef<TeamControlInput>({ ...EMPTY_TEAM_INPUT });
  const remoteSlotInputsRef = useRef<Partial<Record<FootballSlotId, TeamControlInput>>>({});
  const fbGoalsBySlotRef = useRef<Record<FootballSlotId, number>>({
    B1: 0,
    B2: 0,
    B3: 0,
    R1: 0,
    R2: 0,
    R3: 0,
  });
  const fbScoreBlueRef = useRef<number>(0);
  fbScoreBlueRef.current = fbScoreBlue;
  const fbScoreRedRef = useRef<number>(0);
  fbScoreRedRef.current = fbScoreRed;
  const fbClockSecRef = useRef<number>(MATCH_DURATION_SEC);
  fbClockSecRef.current = fbClockSec;
  const fbInterpolatorRef = useRef<FootballStateInterpolator>(new FootballStateInterpolator());
  const fbSceneWrapRef = useRef<HTMLDivElement | null>(null);
  const fbHudLayerRef = useRef<HTMLDivElement | null>(null);
  const fbSceneCtrlRef = useRef<Football3v3SceneController | null>(null);
  const fbMatchRunIdRef = useRef<number>(0);
  const [fbMatchRunId, setFbMatchRunId] = useState<number>(0);

  // Penalty Shootout Refs
  const pendingShooterLockRef = useRef<{ turnIndex: number; choice: ShooterLockChoice } | null>(
    null
  );
  const pendingKeeperLockRef = useRef<{ turnIndex: number; choice: KeeperLockChoice } | null>(null);
  const revealedTurnsSetRef = useRef<Set<number>>(new Set());
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
    }, 4200);
  }, []);

  const scoreSummary = useMemo(() => evaluateShootoutProgress(turnHistory), [turnHistory]);
  const currentTurnIndex = turnHistory.length;
  const currentShooterSide: PenaltySide = scoreSummary.nextShooter;

  // Rotate Penalty Shooters & Keepers across all human teammates when coming from a 3v3 tie!
  const activePenaltyActors = useMemo(() => {
    const teamKickIdx = Math.floor(currentTurnIndex / 2);
    if (cameFrom3v3TieScore !== null) {
      const blueHumans = BLUE_SLOTS.map((s) => matchSlots[s]).filter((p) => !p.isBot);
      const redHumans = RED_SLOTS.map((s) => matchSlots[s]).filter((p) => !p.isBot);
      const blueOrder =
        blueHumans.length > 0 ? blueHumans : BLUE_SLOTS.map((s) => matchSlots[s]);
      const redOrder =
        redHumans.length > 0 ? redHumans : RED_SLOTS.map((s) => matchSlots[s]);

      const blueActor = blueOrder[teamKickIdx % blueOrder.length] || matchSlots.B1;
      const redActor = redOrder[teamKickIdx % redOrder.length] || matchSlots.R1;
      return currentShooterSide === 'p1'
        ? { shooter: blueActor, keeper: redActor }
        : { shooter: redActor, keeper: blueActor };
    }
    return currentShooterSide === 'p1'
      ? { shooter: matchSlots.B1, keeper: matchSlots.R1 }
      : { shooter: matchSlots.R1, keeper: matchSlots.B1 };
  }, [cameFrom3v3TieScore, currentShooterSide, currentTurnIndex, matchSlots]);

  const amIShooter =
    !activePenaltyActors.shooter.isBot &&
    activePenaltyActors.shooter.clientId === clientIdRef.current;
  const amIKeeper =
    !activePenaltyActors.keeper.isBot &&
    activePenaltyActors.keeper.clientId === clientIdRef.current;
  const amISpectatingPenaltyTurn = !amIShooter && !amIKeeper;

  const blueTeamDisplayLabel = useMemo(() => {
    const humans = BLUE_SLOTS.map((s) => matchSlots[s]).filter((p) => !p.isBot);
    if (humans.length === 0) return matchSlots.B1.name;
    if (humans.length === 1) return humans[0].name;
    return `${humans[0].name} +${humans.length - 1}`;
  }, [matchSlots]);

  const redTeamDisplayLabel = useMemo(() => {
    const humans = RED_SLOTS.map((s) => matchSlots[s]).filter((p) => !p.isBot);
    if (humans.length === 0) return matchSlots.R1.name;
    if (humans.length === 1) return humans[0].name;
    return `${humans[0].name} +${humans.length - 1}`;
  }, [matchSlots]);

  // Claim +5 GP daily win reward for EVERY human player on the winning team!
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
          `🎁 โบนัสทีมชนะศึกฟุตบอล +${data.earned} 💰 GP! (${data.winsToday}/${data.dailyCap} รอบวันนี้)`
        );
        onRewardEarnedRef.current?.(data.earned, data.points);
      } else if (res.ok && data.capReached) {
        setRewardNotice(
          `รับโบนัส GP ครบ ${data.dailyCap}/${data.dailyCap} รอบของวันนี้แล้ว (แข่งต่อได้ไม่จำกัด!)`
        );
      }
    } catch {
      // ignore
    }
  }, [currentUserId]);

  const persistCompletedMatch = useCallback(
    (opts: {
      winnerSide: PenaltySide;
      blueGoals: number;
      redGoals: number;
      totalRounds: number;
      decidedByPenalty: boolean;
    }) => {
      const didIWin = opts.winnerSide === mySideRef.current;
      if (didIWin) {
        confetti({ particleCount: 115, spread: 85, origin: { y: 0.55 } });
        if (!isPracticeRef.current) {
          void claimIslandWinReward();
        }
      }

      const slotsSnap = matchSlotsRef.current;
      if (amIMatchHostRef.current || isPracticeRef.current) {
        onLobbyBroadcastRef.current?.({
          roomCode: roomCode || '6666',
          mode: selectedMode,
          hostUserId: currentUserId || 0,
          hostName: slotsSnap.B1.name,
          hostEmoji: '⚽',
          count: 0,
          max: selectedMode === 'penalty' ? 2 : 6,
          status: 'closed',
          scoreLeft: opts.blueGoals,
          scoreRight: opts.redGoals,
          roster: [],
        });
      }

      // Host-only single write to Supabase & Turso crediting ALL human players (up to 6)!
      if (amIMatchHostRef.current && !isPracticeRef.current && !matchSavedRef.current && roomCode) {
        matchSavedRef.current = true;
        const blueCap =
          BLUE_SLOTS.map((s) => slotsSnap[s]).find((p) => !p.isBot) || slotsSnap.B1;
        const redCap =
          RED_SLOTS.map((s) => slotsSnap[s]).find((p) => !p.isBot) || slotsSnap.R1;
        const winCap = opts.winnerSide === 'p1' ? blueCap : redCap;
        const loseCap = opts.winnerSide === 'p1' ? redCap : blueCap;
        const winScore = opts.winnerSide === 'p1' ? opts.blueGoals : opts.redGoals;
        const loseScore = opts.winnerSide === 'p1' ? opts.redGoals : opts.blueGoals;

        const is3v3Match =
          screenRef.current === 'playing_3v3' || cameFrom3v3TieRef.current !== null;
        const activeList: readonly FootballSlotId[] = is3v3Match
          ? ALL_FOOTBALL_SLOTS
          : (['B1', 'R1'] as const);

        const playerEntries: PenaltyPlayerStatEntry[] = activeList
          .map((s) => slotsSnap[s])
          .filter((p) => !p.isBot)
          .map((p) => {
            const pSide: PenaltySide = getSlotTeam(p.slotId) === 'blue' ? 'p1' : 'p2';
            const individualGoals = is3v3Match
              ? fbGoalsBySlotRef.current[p.slotId] || 0
              : pSide === 'p1'
                ? opts.blueGoals
                : opts.redGoals;
            return {
              name: p.name,
              modelId: p.modelId,
              won: pSide === opts.winnerSide,
              goals: individualGoals,
              isBot: false,
            };
          });

        void recordPenaltyMatchByHost({
          matchUid: activeMatchUidRef.current || `${roomCode}-${Date.now()}`,
          roomCode,
          winnerName: winCap.name,
          loserName: loseCap.name,
          winnerModel: winCap.modelId,
          loserModel: loseCap.modelId,
          winnerScore: winScore,
          loserScore: loseScore,
          totalRounds: opts.totalRounds,
          suddenDeath: opts.decidedByPenalty,
          durationSeconds: Math.max(
            8,
            Math.round((Date.now() - matchStartedAtRef.current) / 1000)
          ),
          playerEntries,
        }).then(({ savedSupabase, savedLocal }) => {
          if (savedSupabase || savedLocal) {
            setDbSaveNotice(
              savedSupabase
                ? '💾 Host บันทึกผลชนะ-แพ้ของผู้เล่นทุกคนลง Supabase เรียบร้อยแล้ว!'
                : '💾 Host บันทึกผลลงตารางอันดับเรียบร้อยแล้ว!'
            );
          }
        });
      }
    },
    [claimIslandWinReward, currentUserId, roomCode, selectedMode]
  );
  const persistCompletedMatchRef = useRef(persistCompletedMatch);
  persistCompletedMatchRef.current = persistCompletedMatch;

  // ==================== Phase 1 Penalty Helpers ====================
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

  const transitionFrom3v3TieToPenalty = useCallback(
    (tiedGoalsEach: number) => {
      setFbTieTransitionBanner(true);
      playPenaltySfx('whistle', mutedRef.current);
      setTimeout(() => {
        setFbTieTransitionBanner(false);
        cameFrom3v3TieRef.current = tiedGoalsEach;
        setCameFrom3v3TieScore(tiedGoalsEach);
        recentPlayerShotsRef.current = [];
        revealedTurnsSetRef.current.clear();
        turnHistoryRef.current = [];
        setTurnHistory([]);
        screenRef.current = 'playing_penalty';
        setScreen('playing_penalty');
        prepareTurnUI();
      }, 2100);
    },
    [prepareTurnUI]
  );
  const transitionFrom3v3TieToPenaltyRef = useRef(transitionFrom3v3TieToPenalty);
  transitionFrom3v3TieToPenaltyRef.current = transitionFrom3v3TieToPenalty;

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
            subtitle: `อ่านใจถูก! พุ่งปัดมุม${getGoalZoneMeta(res.keeperZone).label}ได้ทัน!`,
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
        if (nextSummary.isFinished && nextSummary.winner) {
          setTurnPhase('finished');
          turnPhaseRef.current = 'finished';
          persistCompletedMatchRef.current({
            winnerSide: nextSummary.winner,
            blueGoals: nextSummary.p1Goals + (cameFrom3v3TieRef.current ?? 0),
            redGoals: nextSummary.p2Goals + (cameFrom3v3TieRef.current ?? 0),
            totalRounds: Math.max(nextSummary.p1Taken, nextSummary.p2Taken),
            decidedByPenalty: nextSummary.isSuddenDeath || cameFrom3v3TieRef.current !== null,
          });
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

  // Auto-drive AI Shooter / AI Keeper when an AI slot participates in Penalty Tie-Breaker (e.g. Co-op vs AI!)
  useEffect(() => {
    if (screen !== 'playing_penalty' || turnPhase !== 'selecting') return;
    if (!amIMatchHost && !isPractice) return;
    if (isPractice) return; // Practice mode handles AI locks directly inside handleLockShooterPower / handleLockKeeperDive

    const tIdx = currentTurnIndex;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    if (activePenaltyActors.shooter.isBot) {
      timers.push(
        setTimeout(() => {
          if (turnPhaseRef.current !== 'selecting' || turnHistoryRef.current.length !== tIdx) return;
          pendingShooterLockRef.current = {
            turnIndex: tIdx,
            choice: chooseAiShooterAction(aiDifficultyRef.current),
          };
          roomCtrlRef.current?.sendShooterLock(
            {
              matchUid: activeMatchUidRef.current,
              turnIndex: tIdx,
              clientId: 'ai_bot',
              choice: pendingShooterLockRef.current.choice,
            },
            true
          );
          tryResolveTurnAsHostRef.current();
        }, 650)
      );
    }

    if (activePenaltyActors.keeper.isBot) {
      timers.push(
        setTimeout(() => {
          if (turnPhaseRef.current !== 'selecting' || turnHistoryRef.current.length !== tIdx) return;
          pendingKeeperLockRef.current = {
            turnIndex: tIdx,
            choice: chooseAiKeeperZone(aiDifficultyRef.current, recentPlayerShotsRef.current),
          };
          roomCtrlRef.current?.sendKeeperLock(
            {
              matchUid: activeMatchUidRef.current,
              turnIndex: tIdx,
              clientId: 'ai_bot',
              choice: pendingKeeperLockRef.current.choice,
            },
            true
          );
          tryResolveTurnAsHostRef.current();
        }, 550)
      );
    }

    return () => timers.forEach((tm) => clearTimeout(tm));
  }, [
    screen,
    turnPhase,
    currentTurnIndex,
    amIMatchHost,
    isPractice,
    activePenaltyActors.shooter.isBot,
    activePenaltyActors.keeper.isBot,
  ]);

  // ==================== Launchers (Practice & Online up to 6 Players!) ====================
  const launchMatchWithSlots = useCallback(
    (opts: {
      mode: FootballLobbyMode;
      practice: boolean;
      iAmHost: boolean;
      myAssignedSlot: FootballSlotId;
      slotsMap: Record<FootballSlotId, ActiveSlotParticipant>;
      matchUid: string;
      startedAt: number;
    }) => {
      const side: PenaltySide = getSlotTeam(opts.myAssignedSlot) === 'blue' ? 'p1' : 'p2';
      isPracticeRef.current = opts.practice;
      setIsPractice(opts.practice);
      amIMatchHostRef.current = opts.iAmHost;
      setAmIMatchHost(opts.iAmHost);
      mySlotIdRef.current = opts.myAssignedSlot;
      setMySlotId(opts.myAssignedSlot);
      mySideRef.current = side;
      setMySide(side);

      matchSlotsRef.current = opts.slotsMap;
      setMatchSlots(opts.slotsMap);

      activeMatchUidRef.current = opts.matchUid;
      matchStartedAtRef.current = opts.startedAt;
      matchSavedRef.current = false;
      rewardClaimedRef.current = false;
      cameFrom3v3TieRef.current = null;
      setCameFrom3v3TieScore(null);
      setRewardNotice('');
      setDbSaveNotice('');

      if (opts.mode === 'match_3v3') {
        localFbInputRef.current = { ...EMPTY_TEAM_INPUT };
        remoteSlotInputsRef.current = {};
        fbGoalsBySlotRef.current = { B1: 0, B2: 0, B3: 0, R1: 0, R2: 0, R3: 0 };
        fbInterpolatorRef.current.reset();
        roomCtrlRef.current?.resetFootballInputCache();

        setFbScoreBlue(0);
        setFbScoreRed(0);
        setFbClockSec(MATCH_DURATION_SEC);
        setFbGoalSplash(null);
        setFbTieTransitionBanner(false);
        setFbWinnerTeam(null);
        fbMatchRunIdRef.current += 1;
        setFbMatchRunId(fbMatchRunIdRef.current);

        screenRef.current = 'playing_3v3';
        setScreen('playing_3v3');
      } else {
        recentPlayerShotsRef.current = [];
        revealedTurnsSetRef.current.clear();
        turnHistoryRef.current = [];
        setTurnHistory([]);
        screenRef.current = 'playing_penalty';
        setScreen('playing_penalty');
        prepareTurnUI();
      }
    },
    [prepareTurnUI]
  );

  const startOnlineMatchFromPacket = useCallback(
    (pkt: PenaltyStartPacket) => {
      const iAmHost = pkt.hostClientId === clientIdRef.current;
      const incomingSlots: Partial<Record<FootballSlotId, PenaltyPresenceMember>> =
        pkt.slots && Object.keys(pkt.slots).length > 0
          ? pkt.slots
          : { B1: pkt.p1, R1: pkt.p2 };

      const slotsMap = buildSixSlotParticipants({
        humanSlots: incomingSlots,
        islandPool: islandPoolRef.current,
        presetAvatars: pkt.slotAvatars,
        presetModels: pkt.slotModels,
        presetNames: pkt.slotNames,
      });

      const foundMySlot =
        ALL_FOOTBALL_SLOTS.find((s) => incomingSlots[s]?.clientId === clientIdRef.current) ||
        (pkt.p2?.clientId === clientIdRef.current ? 'R1' : 'B1');

      launchMatchWithSlots({
        mode: pkt.matchMode || 'match_3v3',
        practice: false,
        iAmHost,
        myAssignedSlot: foundMySlot,
        slotsMap,
        matchUid: pkt.matchUid,
        startedAt: pkt.startedAt || Date.now(),
      });
    },
    [launchMatchWithSlots]
  );

  const startPracticeMatch = useCallback(
    (overrideMode?: FootballLobbyMode) => {
      const targetMode = overrideMode || selectedMode;
      const cleanName = nickname.trim() || 'กัปตันสายฟ้า';
      setNickname(cleanName);

      const meMember: PenaltyPresenceMember = {
        clientId: clientIdRef.current,
        userId: currentUserId,
        name: cleanName,
        modelId: selectedModelId,
        avatar: activeMyAvatar,
        ready: true,
        joinedAt: Date.now(),
        isCreator: true,
      };

      const slotsMap = buildSixSlotParticipants({
        humanSlots: { B1: meMember },
        islandPool: islandPoolRef.current,
      });

      launchMatchWithSlots({
        mode: targetMode,
        practice: true,
        iAmHost: true,
        myAssignedSlot: 'B1',
        slotsMap,
        matchUid: `practice-${Date.now()}`,
        startedAt: Date.now(),
      });
    },
    [activeMyAvatar, currentUserId, launchMatchWithSlots, nickname, selectedMode, selectedModelId]
  );

  const returnToLobbyOrHome = useCallback((target: 'home' | 'lobby') => {
    screenRef.current = target;
    isPracticeRef.current = false;
    turnPhaseRef.current = 'selecting';
    pendingShooterLockRef.current = null;
    pendingKeeperLockRef.current = null;
    revealedTurnsSetRef.current.clear();
    turnHistoryRef.current = [];
    fbMatchStateRef.current = null;
    localFbInputRef.current = { ...EMPTY_TEAM_INPUT };
    remoteSlotInputsRef.current = {};
    fbInterpolatorRef.current.reset();
    cameFrom3v3TieRef.current = null;

    setIsPractice(false);
    setTurnHistory([]);
    setImpactBanner(null);
    setPeerReadyBanner('');
    setLockedPower(null);
    setFbGoalSplash(null);
    setFbTieTransitionBanner(false);
    setFbWinnerTeam(null);
    setCameFrom3v3TieScore(null);
    setRewardNotice('');
    setDbSaveNotice('');
    setScreen(target);

    if (target === 'lobby') {
      void roomCtrlRef.current?.updateMyPresence({ ready: false });
    }
  }, []);

  // Sync invited roomCode & late-hydrating 3D island character into Presence automatically
  useEffect(() => {
    if (
      autoRoomCode &&
      autoRoomCode !== roomCode &&
      (screen === 'home' || screen === 'lobby')
    ) {
      setRoomCode(autoRoomCode);
      if (screen === 'home') {
        setScreen('lobby');
      }
    }
  }, [autoRoomCode, roomCode, screen]);

  useEffect(() => {
    if (myIslandAvatar && !hadIslandAvatarRef.current) {
      hadIslandAvatarRef.current = true;
      setUseMyIslandChar(true);
      if (!nickname.trim() || nickname === 'กัปตันสายฟ้า') {
        setNickname(myIslandAvatar.name);
      }
      const syncedName =
        !nickname.trim() || nickname === 'กัปตันสายฟ้า'
          ? myIslandAvatar.name
          : nickname.trim();
      void roomCtrlRef.current?.updateMyPresence({
        name: syncedName,
        avatar: { ...myIslandAvatar, name: syncedName },
      });
    }
  }, [myIslandAvatar, nickname]);

  // Report live participation to ModalHost so invited guests & teammates are never locked out!
  useEffect(() => {
    const seatedInLobby =
      screen === 'lobby' &&
      Boolean(roomCode) &&
      ALL_FOOTBALL_SLOTS.some((s) => lobbyState.slots[s]?.clientId === clientIdRef.current);
    const activelyInMatch = screen === 'playing_3v3' || screen === 'playing_penalty';
    const participating = seatedInLobby || activelyInMatch;
    const isHostNow =
      activelyInMatch
        ? amIMatchHost && !isPractice
        : screen === 'lobby' && lobbyState.hostClientId === clientIdRef.current;
    onParticipationChangeRef.current?.(participating, clientIdRef.current, isHostNow);
  }, [screen, roomCode, lobbyState.slots, lobbyState.hostClientId, amIMatchHost, isPractice]);

  // Broadcast floating invite & active match lock banner (up to 6 players!) to 3D Island
  useEffect(() => {
    if (!onLobbyBroadcastRef.current) return;
    const activeCode = roomCode || '6666';

    if (
      screen === 'lobby' &&
      !isPractice &&
      roomCode &&
      lobbyState.hostClientId === clientIdRef.current
    ) {
      const emitWaiting = () => {
        const isPen = lobbyState.matchMode === 'penalty';
        const slotOrder: readonly FootballSlotId[] = isPen
          ? (['B1', 'R1'] as const)
          : ALL_FOOTBALL_SLOTS;
        const waitRoster = slotOrder
          .map((s) => {
            const m = lobbyState.slots[s];
            if (!m) return null;
            return {
              slotId: s,
              clientId: m.clientId,
              playerId: m.userId || 0,
              name: m.name,
              emoji: m.avatar?.emoji || getPenaltyCharacter(m.modelId).emoji,
              team: getSlotTeam(s) === 'blue' ? ('left' as const) : ('right' as const),
              isBot: false,
            };
          })
          .filter((x): x is NonNullable<typeof x> => Boolean(x));

        const myEmoji = activeMyAvatar?.emoji || getPenaltyCharacter(selectedModelId).emoji;
        onLobbyBroadcastRef.current?.({
          roomCode: activeCode,
          mode: isPen ? 'penalty' : '3v3',
          hostUserId: currentUserId || 0,
          hostName: nickname.trim() || 'เพื่อน',
          hostEmoji: myEmoji,
          targetName: invitedTargetName,
          count: Math.max(1, waitRoster.length),
          max: isPen ? 2 : 6,
          status: 'waiting',
          roster: waitRoster,
        });
      };
      emitWaiting();
      const hb = setInterval(emitWaiting, 4800);
      return () => clearInterval(hb);
    }

    const isPlayingNow =
      (screen === 'playing_3v3' && !fbWinnerTeam) ||
      (screen === 'playing_penalty' && !scoreSummary.isFinished);
    if (isPlayingNow && (amIMatchHost || isPractice)) {
      const emitStarted = () => {
        const is3v3Context = screen === 'playing_3v3' || cameFrom3v3TieScore !== null;
        const slotOrder: readonly FootballSlotId[] = is3v3Context
          ? ALL_FOOTBALL_SLOTS
          : (['B1', 'R1'] as const);
        const slotsSnap = matchSlotsRef.current;
        const sl = screen === 'playing_3v3' ? fbScoreBlue : scoreSummary.p1Goals;
        const sr = screen === 'playing_3v3' ? fbScoreRed : scoreSummary.p2Goals;

        const activeRoster = slotOrder.map((s) => {
          const p = slotsSnap[s];
          return {
            slotId: s,
            clientId: p.clientId,
            playerId: p.avatar?.playerId || p.userId || 0,
            name: p.name,
            emoji: p.avatar?.emoji || getPenaltyCharacter(p.modelId).emoji,
            team: getSlotTeam(s) === 'blue' ? ('left' as const) : ('right' as const),
            isBot: p.isBot,
          };
        });
        const humanTotal = activeRoster.filter((r) => !r.isBot).length;

        onLobbyBroadcastRef.current?.({
          roomCode: activeCode,
          mode: screen === 'playing_3v3' ? '3v3' : 'penalty',
          hostUserId: currentUserId || 0,
          hostName: slotsSnap.B1.name || nickname.trim() || 'กัปตัน',
          hostEmoji: slotsSnap.B1.avatar?.emoji || '⚽',
          count: Math.max(1, humanTotal),
          max: is3v3Context ? 6 : 2,
          status: 'started',
          scoreLeft: sl,
          scoreRight: sr,
          roster: activeRoster,
        });
      };
      emitStarted();
      const hb = setInterval(emitStarted, 4500);
      return () => clearInterval(hb);
    }
  }, [
    screen,
    roomCode,
    isPractice,
    amIMatchHost,
    fbWinnerTeam,
    fbScoreBlue,
    fbScoreRed,
    cameFrom3v3TieScore,
    scoreSummary.isFinished,
    scoreSummary.p1Goals,
    scoreSummary.p2Goals,
    lobbyState,
    selectedModelId,
    activeMyAvatar,
    currentUserId,
    nickname,
    invitedTargetName,
  ]);

  // Connect Supabase Realtime Presence + Broadcast Room when `roomCode` is active
  useEffect(() => {
    const shouldStayConnected =
      Boolean(roomCode) &&
      (screen === 'lobby' ||
        screen === 'playing_3v3' ||
        screen === 'playing_penalty' ||
        screen === 'leaderboard');
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
      initialMatchMode: selectedMode,
      me: {
        clientId: clientIdRef.current,
        userId: currentUserId,
        name: nickname.trim() || 'กัปตันสายฟ้า',
        modelId: selectedModelId,
        avatar: activeMyAvatar,
        ready: false,
        isCreator,
      },
      callbacks: {
        onLobbyChange: (nextLobby) => {
          setLobbyState(nextLobby);
          setSelectedMode(nextLobby.matchMode);
        },
        onOpponentLeft: (leftMember, newHostId) => {
          if (isPracticeRef.current) return;

          if (screenRef.current === 'playing_3v3') {
            // Convert the disconnected player's slot to AI Bot so the other players keep playing!
            const currentSlots = { ...matchSlotsRef.current };
            const leftSlot = ALL_FOOTBALL_SLOTS.find(
              (s) => currentSlots[s]?.clientId === leftMember.clientId
            );
            if (leftSlot) {
              const botName = `AI ${leftMember.name}`;
              currentSlots[leftSlot] = {
                ...currentSlots[leftSlot],
                clientId: `bot_${leftSlot}`,
                name: botName,
                isBot: true,
              };
              matchSlotsRef.current = currentSlots;
              setMatchSlots(currentSlots);
              delete remoteSlotInputsRef.current[leftSlot];
              if (fbMatchStateRef.current) {
                setFootballSlotBotMode(fbMatchStateRef.current, leftSlot, true, botName);
              }
            }

            // Host Migration if Host left mid-match!
            if (!amIMatchHostRef.current && newHostId === clientIdRef.current) {
              amIMatchHostRef.current = true;
              setAmIMatchHost(true);
              const snapSample = fbInterpolatorRef.current.sample(performance.now());
              fbInterpolatorRef.current.reset();
              const initConfigs = {} as Record<
                FootballSlotId,
                { name: string; modelId: string; isBot: boolean }
              >;
              for (const s of ALL_FOOTBALL_SLOTS) {
                initConfigs[s] = {
                  name: currentSlots[s].name,
                  modelId: currentSlots[s].modelId,
                  isBot: currentSlots[s].isBot,
                };
              }
              const migrated = createInitialFootballMatchState({
                slots: initConfigs,
                durationSec: Math.max(5, fbClockSecRef.current),
              });
              migrated.scoreBlue = fbScoreBlueRef.current;
              migrated.scoreRed = fbScoreRedRef.current;
              migrated.goalsBySlot = { ...fbGoalsBySlotRef.current };
              if (snapSample) {
                migrated.ball.x = snapSample.ballX;
                migrated.ball.y = Math.max(BALL_RADIUS, snapSample.ballY);
                migrated.ball.z = snapSample.ballZ;
                migrated.ball.vx = snapSample.ballVx;
                migrated.ball.vz = snapSample.ballVz;
                for (const pf of snapSample.players) {
                  const ent = migrated.players.find((p) => p.id === pf.id);
                  if (ent) {
                    ent.x = pf.x;
                    ent.z = pf.z;
                    ent.vx = pf.vx;
                    ent.vz = pf.vz;
                    ent.facingYaw = pf.yaw;
                    ent.stamina = pf.stamina;
                  }
                }
              }
              fbMatchStateRef.current = migrated;
              fbMatchRunIdRef.current += 1;
              setFbMatchRunId(fbMatchRunIdRef.current);
              showToast(
                `👑 ${leftMember.name} ออกจากเกม — คุณรับหน้าที่ Host ต่อ & AI ลงแทนช่อง ${leftSlot || ''}!`
              );
            } else {
              // Reset interpolator sequence if Host migrated to another teammate so snapshots never stall!
              if (newHostId) {
                fbInterpolatorRef.current.reset();
              }
              showToast(
                `🤖 ${leftMember.name} ออกจากเกม — AI ลงเล่นช่อง ${leftSlot || ''} แทนต่อเนื่อง!`
              );
            }
            return;
          }

          if (screenRef.current === 'playing_penalty' && cameFrom3v3TieRef.current !== null) {
            const currentSlots = { ...matchSlotsRef.current };
            const leftSlot = ALL_FOOTBALL_SLOTS.find(
              (s) => currentSlots[s]?.clientId === leftMember.clientId
            );
            if (leftSlot) {
              currentSlots[leftSlot] = {
                ...currentSlots[leftSlot],
                clientId: `bot_${leftSlot}`,
                name: `AI ${leftMember.name}`,
                isBot: true,
              };
              matchSlotsRef.current = currentSlots;
              setMatchSlots(currentSlots);
            }
            const remainingHumans = ALL_FOOTBALL_SLOTS.filter(
              (s) => !currentSlots[s].isBot
            ).length;
            if (remainingHumans >= 1) {
              if (!amIMatchHostRef.current && newHostId === clientIdRef.current) {
                amIMatchHostRef.current = true;
                setAmIMatchHost(true);
              }
              showToast(
                `🤖 ${leftMember.name} ออกจากเกม — AI รับช่วงดวลจุดโทษแทนเพื่อให้แมตช์เล่นต่อจนจบ!`
              );
              return;
            }
          }

          showToast(`⚠️ ${leftMember.name} ออกจากห้องแข่งขัน`);
          if (screenRef.current === 'playing_penalty') {
            returnToLobbyOrHome('lobby');
          }
        },
        onMatchStart: (pkt) => {
          if (isPracticeRef.current) return;
          startOnlineMatchFromPacket(pkt);
        },
        onShooterLockedNotice: (tIdx) => {
          if (isPracticeRef.current || tIdx !== turnHistoryRef.current.length) return;
          setPeerReadyBanner('⚡ คนยิงล็อกมุมและพลังยิงแล้ว! ลุ้นจังหวะเซฟเลย!');
        },
        onKeeperLockedNotice: (tIdx) => {
          if (isPracticeRef.current || tIdx !== turnHistoryRef.current.length) return;
          setPeerReadyBanner('🧤 คนเฝ้าเสาเตรียมพุ่งแล้ว! เล็งมุมแล้วกดหยุดพลังยิงเลย!');
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
        onFootballGuestInput: (pkt) => {
          if (!amIMatchHostRef.current || isPracticeRef.current) return;
          remoteSlotInputsRef.current[pkt.slot] = pkt.inp;
        },
        onFootballStateSnapshot: (snap: FootballNetSnapshot) => {
          if (
            amIMatchHostRef.current ||
            isPracticeRef.current ||
            screenRef.current !== 'playing_3v3'
          ) {
            return;
          }
          const accepted = fbInterpolatorRef.current.pushSnapshot(snap, performance.now());
          if (!accepted) return;

          setFbScoreBlue((prev) => (prev !== snap.sb ? snap.sb : prev));
          setFbScoreRed((prev) => (prev !== snap.sr ? snap.sr : prev));
          setFbClockSec((prev) => (Math.abs(prev - snap.tm) >= 0.2 ? snap.tm : prev));
          if (snap.gs) {
            fbGoalsBySlotRef.current = {
              B1: snap.gs.B1 ?? 0,
              B2: snap.gs.B2 ?? 0,
              B3: snap.gs.B3 ?? 0,
              R1: snap.gs.R1 ?? 0,
              R2: snap.gs.R2 ?? 0,
              R3: snap.gs.R3 ?? 0,
            };
          }

          if (snap.ev) {
            if (snap.ev.goalTeam) {
              fbSceneCtrlRef.current?.triggerGoalFx(snap.ev.goalTeam);
              const scorerSlot =
                snap.ev.scorerSlotId || (snap.ev.goalTeam === 'blue' ? 'B1' : 'R1');
              const scorerName = matchSlotsRef.current[scorerSlot]?.name || scorerSlot;
              setFbGoalSplash({ team: snap.ev.goalTeam, scorerName });
              confetti({ particleCount: 65, spread: 75, origin: { y: 0.45 } });
              setTimeout(() => setFbGoalSplash(null), 2000);
            } else {
              if (snap.ev.kick) playPenaltySfx('kick', mutedRef.current);
              if (snap.ev.pass || snap.ev.tackle) playPenaltySfx('lock', mutedRef.current);
              if (snap.ev.save) playPenaltySfx('saved', mutedRef.current);
              if (snap.ev.post) playPenaltySfx('post', mutedRef.current);
              if (snap.ev.whistle) playPenaltySfx('whistle', mutedRef.current);
            }
          }

          // Audible chirp when a same-team human partner calls for a pass (`🙋 ส่งมา!`)
          const myTeam = getSlotTeam(mySlotIdRef.current);
          const teammateCalling = snap.pl.some(
            (pl) =>
              pl.cp === 1 &&
              pl.b !== 1 &&
              pl.id !== mySlotIdRef.current &&
              getSlotTeam(pl.id) === myTeam
          );
          if (teammateCalling) {
            const nowT = performance.now();
            if (nowT - lastTeammateCallSfxMsRef.current > 950) {
              lastTeammateCallSfxMsRef.current = nowT;
              playPenaltySfx('lock', mutedRef.current);
            }
          }

          if (snap.ph === 'finished' && snap.w) {
            setFbWinnerTeam((prev) => {
              if (!prev) {
                persistCompletedMatchRef.current({
                  winnerSide: snap.w === 'blue' ? 'p1' : 'p2',
                  blueGoals: snap.sb,
                  redGoals: snap.sr,
                  totalRounds: 3,
                  decidedByPenalty: false,
                });
              }
              return snap.w;
            });
          }
        },
        onTieBreakToPenalty: (_matchUid, tiedScore) => {
          if (isPracticeRef.current || amIMatchHostRef.current) return;
          transitionFrom3v3TieToPenaltyRef.current(
            typeof tiedScore === 'number' ? tiedScore : fbScoreBlueRef.current
          );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ============================================================================
  // PHASE 2: Street 3v3 โกลหนู Engine + Keyboard + Touch + ~18Hz Sync + 60FPS Lerp
  // ============================================================================

  const updateLocalFbInput = useCallback((mutator: (prev: TeamControlInput) => TeamControlInput) => {
    const next = mutator(localFbInputRef.current);
    localFbInputRef.current = next;
    if (!isPracticeRef.current && !amIMatchHostRef.current && roomCtrlRef.current) {
      roomCtrlRef.current.sendFootballGuestInputOnChange(mySlotIdRef.current, next);
    }
  }, []);

  useEffect(() => {
    if (screen !== 'playing_3v3') return;
    const keys: Record<string, boolean> = {};
    let usingWasdMove = false;
    let chargingByKey = false;

    const recomputeAxes = () => {
      const right =
        (keys['ArrowRight'] || (usingWasdMove && keys['KeyD']) ? 1 : 0) -
        (keys['ArrowLeft'] || keys['KeyA'] ? 1 : 0);
      const down =
        (keys['ArrowDown'] || keys['KeyS'] ? 1 : 0) -
        (keys['ArrowUp'] || keys['KeyW'] ? 1 : 0);
      updateLocalFbInput((prev) => ({
        ...prev,
        moveX: right,
        moveZ: down,
      }));
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        code.startsWith('Arrow') ||
        code === 'Space' ||
        code === 'KeyW' ||
        code === 'KeyA' ||
        code === 'KeyS' ||
        code === 'KeyD' ||
        code === 'KeyX' ||
        code === 'KeyJ' ||
        code === 'KeyK' ||
        code === 'ShiftLeft' ||
        code === 'ShiftRight'
      ) {
        e.preventDefault();
      }
      if (e.repeat) return;

      if (code === 'KeyW' || code === 'KeyA' || code === 'KeyS') {
        usingWasdMove = true;
      } else if (code.startsWith('Arrow')) {
        usingWasdMove = false;
      }

      keys[code] = true;

      // Pass / Call for Pass from AI Teammate (`X` or `J`)
      if (code === 'KeyX' || code === 'KeyJ') {
        updateLocalFbInput((prev) => ({ ...prev, passSeq: prev.passSeq + 1 }));
        return;
      }

      // Hold-to-Charge Shoot (`K` always, or `D` when steering with Arrow Keys)
      if (code === 'KeyK' || (code === 'KeyD' && !usingWasdMove)) {
        chargingByKey = true;
        updateLocalFbInput((prev) => ({ ...prev, shootCharging: true }));
        return;
      }

      // Sprint (offense) / Slide Shot-Block & Tackle (defense) (`Shift` or `Spacebar`)
      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') {
        updateLocalFbInput((prev) => ({
          ...prev,
          sprint: true,
          tackleSeq: prev.tackleSeq + 1,
        }));
        return;
      }

      recomputeAxes();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;
      keys[code] = false;

      if (chargingByKey && (code === 'KeyK' || code === 'KeyD')) {
        chargingByKey = false;
        updateLocalFbInput((prev) => ({
          ...prev,
          shootCharging: false,
          shootSeq: prev.shootSeq + 1,
        }));
      }

      if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'Space') {
        const stillSprint = Boolean(keys['ShiftLeft'] || keys['ShiftRight'] || keys['Space']);
        updateLocalFbInput((prev) => ({ ...prev, sprint: stillSprint }));
      }

      recomputeAxes();
    };

    const onBlur = () => {
      Object.keys(keys).forEach((k) => {
        keys[k] = false;
      });
      chargingByKey = false;
      updateLocalFbInput((prev) => ({
        ...prev,
        moveX: 0,
        moveZ: 0,
        shootCharging: false,
        sprint: false,
      }));
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [screen, updateLocalFbInput]);

  // Mount Three.js 3v3 Street Mini-Goal Stadium + Run 60FPS Host Physics / ~18Hz Sync / 60FPS Guest Lerp!
  useEffect(() => {
    if (screen !== 'playing_3v3' || !fbSceneWrapRef.current || !fbHudLayerRef.current) return;

    const slotsSnap = matchSlotsRef.current;
    const slotInitConfigs = {} as Record<
      FootballSlotId,
      { name: string; modelId: string; isBot: boolean }
    >;
    const slotAvatars = {} as Partial<Record<FootballSlotId, FootballAvatarProfile>>;

    for (const s of ALL_FOOTBALL_SLOTS) {
      slotInitConfigs[s] = {
        name: slotsSnap[s].name,
        modelId: slotsSnap[s].modelId,
        isBot: slotsSnap[s].isBot,
      };
      if (slotsSnap[s].avatar) {
        slotAvatars[s] = slotsSnap[s].avatar!;
      }
    }

    const match =
      fbMatchStateRef.current ||
      createInitialFootballMatchState({
        slots: slotInitConfigs,
        durationSec: MATCH_DURATION_SEC,
      });
    fbMatchStateRef.current = match;

    const sceneCtrl = createFootball3v3StadiumScene({
      container: fbSceneWrapRef.current,
      hudOverlay: fbHudLayerRef.current,
      mySlotId: mySlotIdRef.current,
      entities: match.players,
      slotAvatars,
      muted: mutedRef.current,
    });
    fbSceneCtrlRef.current = sceneCtrl;
    playPenaltySfx('whistle', mutedRef.current);

    let rafId = 0;
    let lastTickMs = performance.now();
    let lastBroadcastMs = 0;
    let hostSnapSeq = 0;
    let pendingBroadcastEvents: FootballFrameEvents = {};
    let endHandled = false;

    const loop = (nowMs: number) => {
      rafId = requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastTickMs) / 1000));
      lastTickMs = nowMs;

      if (amIMatchHostRef.current || isPracticeRef.current) {
        const humanInputs: Partial<Record<FootballSlotId, TeamControlInput>> = isPracticeRef.current
          ? { [mySlotIdRef.current]: localFbInputRef.current }
          : {
            ...remoteSlotInputsRef.current,
            [mySlotIdRef.current]: localFbInputRef.current,
          };

        stepFootballMatch(match, humanInputs, dt, (st, stepDt, ops) => {
          stepAllFootballAI(st, stepDt, ops, aiDifficultyRef.current);
        });

        fbGoalsBySlotRef.current = { ...match.goalsBySlot };

        const ev = match.events;
        if (ev.goalTeam) {
          pendingBroadcastEvents.goalTeam = ev.goalTeam;
          pendingBroadcastEvents.scorerSlotId = ev.scorerSlotId;
          sceneCtrl.triggerGoalFx(ev.goalTeam);
          const scorerSlot = ev.scorerSlotId || (ev.goalTeam === 'blue' ? 'B1' : 'R1');
          const scorerName = matchSlotsRef.current[scorerSlot]?.name || scorerSlot;
          setFbGoalSplash({ team: ev.goalTeam, scorerName });
          setFbScoreBlue(match.scoreBlue);
          setFbScoreRed(match.scoreRed);
          confetti({ particleCount: 70, spread: 75, origin: { y: 0.45 } });
          setTimeout(() => setFbGoalSplash(null), 2000);
        } else {
          if (ev.kick) {
            pendingBroadcastEvents.kick = true;
            playPenaltySfx('kick', mutedRef.current);
          }
          if (ev.pass) {
            pendingBroadcastEvents.pass = true;
            playPenaltySfx('lock', mutedRef.current);
          }
          if (ev.tackle) {
            pendingBroadcastEvents.tackle = true;
            playPenaltySfx('lock', mutedRef.current);
          }
          if (ev.save) {
            pendingBroadcastEvents.save = true;
            playPenaltySfx('saved', mutedRef.current);
          }
          if (ev.post) {
            pendingBroadcastEvents.post = true;
            playPenaltySfx('post', mutedRef.current);
          }
          if (ev.whistle) {
            pendingBroadcastEvents.whistle = true;
            playPenaltySfx('whistle', mutedRef.current);
          }
        }

        setFbClockSec((prev) =>
          Math.abs(prev - match.timeRemaining) >= 0.25 ? match.timeRemaining : prev
        );

        const renderSnap: RenderPitchSnapshot = {
          ballX: match.ball.x,
          ballY: match.ball.y,
          ballZ: match.ball.z,
          ballVx: match.ball.vx,
          ballVz: match.ball.vz,
          isPowerShot: match.ball.isPowerShot,
          players: match.players.map((p) => ({
            id: p.id,
            isBot: p.isBot,
            x: p.x,
            z: p.z,
            vx: p.vx,
            vz: p.vz,
            yaw: p.facingYaw,
            stamina: p.stamina,
            shootCharge: p.shootCharge,
            slideTimer: p.slideTimer,
            callForPass: p.callForPassTimer > 0.05,
          })),
        };
        sceneCtrl.pushRenderState(renderSnap);

        // Audible chirp for Host when a same-team human teammate calls for a pass (`🙋 ส่งมา!`)
        const hostMyTeam = getSlotTeam(mySlotIdRef.current);
        const hostTeammateCalling = match.players.some(
          (pl) =>
            pl.callForPassTimer > 0.65 &&
            !pl.isBot &&
            pl.id !== mySlotIdRef.current &&
            pl.team === hostMyTeam
        );
        if (hostTeammateCalling && nowMs - lastTeammateCallSfxMsRef.current > 950) {
          lastTeammateCallSfxMsRef.current = nowMs;
          playPenaltySfx('lock', mutedRef.current);
        }

        // Broadcast at ~18 Hz (every 55 ms) to all Guests!
        if (
          !isPracticeRef.current &&
          roomCtrlRef.current &&
          (nowMs - lastBroadcastMs >= FOOTBALL_BROADCAST_INTERVAL_MS ||
            Boolean(ev.goalTeam) ||
            match.phase === 'finished' ||
            match.phase === 'tie_to_penalty')
        ) {
          lastBroadcastMs = nowMs;
          hostSnapSeq += 1;
          const netSnap = serializeFootballSnapshot(
            match,
            hostSnapSeq,
            pendingBroadcastEvents,
            clientIdRef.current
          );
          pendingBroadcastEvents = {};
          roomCtrlRef.current.broadcastFootballHostState(netSnap);
        }

        if (!endHandled && match.phase === 'tie_to_penalty') {
          endHandled = true;
          if (!isPracticeRef.current && roomCtrlRef.current) {
            roomCtrlRef.current.broadcastTieBreakToPenalty(
              activeMatchUidRef.current,
              match.scoreBlue
            );
          }
          transitionFrom3v3TieToPenaltyRef.current(match.scoreBlue);
        } else if (!endHandled && match.phase === 'finished' && match.winner) {
          endHandled = true;
          setFbWinnerTeam(match.winner);
          persistCompletedMatchRef.current({
            winnerSide: match.winner === 'blue' ? 'p1' : 'p2',
            blueGoals: match.scoreBlue,
            redGoals: match.scoreRed,
            totalRounds: 3,
            decidedByPenalty: false,
          });
        }
      } else {
        const lerped = fbInterpolatorRef.current.sample(nowMs);
        if (lerped) {
          sceneCtrl.pushRenderState(lerped);
        }
      }
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
      sceneCtrl.dispose();
      fbSceneCtrlRef.current = null;
    };
  }, [screen, fbMatchRunId]);

  useEffect(() => {
    fbSceneCtrlRef.current?.setMuted(muted);
  }, [muted]);

  // ============================================================================
  // PHASE 1: 3D Penalty Shootout Scene & Timing Power Bar Hooks
  // ============================================================================

  const currentShooterModelId = activePenaltyActors.shooter.modelId;
  const currentKeeperModelId = activePenaltyActors.keeper.modelId;
  const currentShooterAvatar = activePenaltyActors.shooter.avatar ?? null;
  const currentKeeperAvatar = activePenaltyActors.keeper.avatar ?? null;

  useEffect(() => {
    if (screen !== 'playing_penalty' || !sceneContainerRef.current) return;
    const ctrl = createPenaltyStadiumScene({
      container: sceneContainerRef.current,
      shooterModelId: currentShooterModelId,
      keeperModelId: currentKeeperModelId,
      shooterAvatar: currentShooterAvatar,
      keeperAvatar: currentKeeperAvatar,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen !== 'playing_penalty' || !sceneCtrlRef.current) return;
    sceneCtrlRef.current.setActors(
      currentShooterModelId,
      currentKeeperModelId,
      currentShooterAvatar,
      currentKeeperAvatar
    );
    sceneCtrlRef.current.resetPositionsForTurn();
  }, [
    screen,
    currentShooterModelId,
    currentKeeperModelId,
    currentShooterAvatar,
    currentKeeperAvatar,
    currentTurnIndex,
  ]);

  useEffect(() => {
    sceneCtrlRef.current?.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const ctrl = sceneCtrlRef.current;
    if (!ctrl || screen !== 'playing_penalty') return;
    const canPick = turnPhase === 'selecting' && (amIShooter || amIKeeper);
    ctrl.setZonePickingEnabled(canPick);
    if (turnPhase === 'selecting' || turnPhase === 'waiting_peer') {
      if (amIShooter) {
        ctrl.setHighlightedZone(selectedZone, 'shooter');
      } else if (amIKeeper && (keeperZonePicked || turnPhase === 'waiting_peer')) {
        ctrl.setHighlightedZone(selectedZone, 'keeper');
      } else {
        ctrl.setHighlightedZone(null, 'hidden');
      }
    } else {
      ctrl.setHighlightedZone(null, 'hidden');
    }
  }, [screen, turnPhase, amIShooter, amIKeeper, selectedZone, keeperZonePicked]);

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
          slot: mySlotIdRef.current,
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
      if (turnPhaseRef.current !== 'selecting' || !amIKeeper) return;
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
            slot: mySlotIdRef.current,
            choice,
          },
          amIMatchHostRef.current
        );
        if (amIMatchHostRef.current) {
          tryResolveTurnAsHostRef.current();
        }
      }
    },
    [amIKeeper]
  );

  useEffect(() => {
    if (screen !== 'playing_penalty' || !amIShooter || turnPhase !== 'selecting') return;
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

  useEffect(() => {
    if (screen !== 'playing_penalty' || !amIKeeper || turnPhase !== 'selecting') return;
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
  }, [screen, amIKeeper, turnPhase, currentTurnIndex, keeperZonePicked, handleLockKeeperDive]);

  useEffect(() => {
    if (screen !== 'playing_penalty' || turnPhase !== 'selecting' || (!amIShooter && !amIKeeper)) {
      return;
    }
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.repeat) return;
      if (ev.code === 'Space' || ev.code === 'Enter') {
        ev.preventDefault();
        if (amIShooter) {
          handleLockShooterPower();
        } else if (amIKeeper) {
          handleLockKeeperDive();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, turnPhase, amIShooter, amIKeeper, handleLockShooterPower, handleLockKeeperDive]);

  // ==================== Room & Rematch Actions ====================
  const handleCreateRoom = () => {
    const cleanName = nickname.trim() || 'กัปตันสายฟ้า';
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
    const cleanName = nickname.trim() || 'กัปตันสายฟ้า';
    setNickname(cleanName);
    setIsPractice(false);
    setIsCreator(false);
    setRoomCode(code);
    setScreen('lobby');
  };

  const broadcastAndLaunchOnline = (modeToLaunch: FootballLobbyMode) => {
    if (lobbyState.hostClientId !== clientIdRef.current) return;
    if (modeToLaunch === 'penalty') {
      if (!lobbyState.slots.B1 || !lobbyState.slots.R1 || !lobbyState.allHumansReady) return;
    } else if (!lobbyState.allHumansReady) {
      return;
    }

    const slotsMap = buildSixSlotParticipants({
      humanSlots: lobbyState.slots,
      islandPool: islandPoolRef.current,
    });

    const slotAvatars: Partial<Record<FootballSlotId, FootballAvatarProfile>> = {};
    const slotModels: Partial<Record<FootballSlotId, string>> = {};
    const slotNames: Partial<Record<FootballSlotId, string>> = {};
    for (const s of ALL_FOOTBALL_SLOTS) {
      if (slotsMap[s].avatar) slotAvatars[s] = slotsMap[s].avatar!;
      slotModels[s] = slotsMap[s].modelId;
      slotNames[s] = slotsMap[s].name;
    }

    const p1Fallback: PenaltyPresenceMember = lobbyState.p1 || {
      clientId: slotsMap.B1.clientId,
      userId: slotsMap.B1.userId,
      name: slotsMap.B1.name,
      modelId: slotsMap.B1.modelId,
      avatar: slotsMap.B1.avatar,
      ready: true,
      joinedAt: Date.now(),
      isCreator: true,
    };
    const p2Fallback: PenaltyPresenceMember = lobbyState.p2 || {
      clientId: slotsMap.R1.clientId,
      userId: slotsMap.R1.userId,
      name: slotsMap.R1.name,
      modelId: slotsMap.R1.modelId,
      avatar: slotsMap.R1.avatar,
      ready: true,
      joinedAt: Date.now(),
      isCreator: false,
    };

    const pkt: PenaltyStartPacket = {
      matchUid: `${roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      roomCode,
      matchMode: modeToLaunch,
      hostClientId: clientIdRef.current,
      slots: lobbyState.slots,
      slotAvatars,
      slotModels,
      slotNames,
      p1: p1Fallback,
      p2: p2Fallback,
      startedAt: Date.now(),
    };

    roomCtrlRef.current?.broadcastMatchStart(pkt);
    startOnlineMatchFromPacket(pkt);
  };

  const handleRematch = (rematchMode: FootballLobbyMode) => {
    if (isPractice) {
      startPracticeMatch(rematchMode);
    } else if (amIMatchHost) {
      broadcastAndLaunchOnline(rematchMode);
    }
  };

  const handleCloseExit = () => {
    const hasOtherHumans = lobbyState.onlinePlayers.some(
      (p) => p.clientId !== clientIdRef.current
    );
    if (
      lobbyState.hostClientId === clientIdRef.current &&
      roomCode &&
      !hasOtherHumans
    ) {
      const myChar = getPenaltyCharacter(selectedModelId);
      onLobbyBroadcastRef.current?.({
        roomCode,
        hostUserId: currentUserId || 0,
        hostName: nickname.trim() || 'เพื่อน',
        hostEmoji: myChar.emoji,
        count: 0,
        max: selectedMode === 'penalty' ? 2 : 6,
        status: 'closed',
        roster: [],
      });
    }
    onParticipationChangeRef.current?.(false, clientIdRef.current, false);
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
            className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border transition ${st === 'goal'
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
  const myLobbySlot =
    ALL_FOOTBALL_SLOTS.find((s) => lobbyState.slots[s]?.clientId === clientIdRef.current) || null;
  const myTeam3v3: FootballTeam = mySide === 'p1' ? 'blue' : 'red';

  const readyHumanCount = useMemo(() => {
    return Object.values(lobbyState.slots).filter(
      (m) => m && (m.clientId === lobbyState.hostClientId || m.ready)
    ).length;
  }, [lobbyState.hostClientId, lobbyState.slots]);

  const canHostStartNow =
    lobbyState.matchMode === 'penalty'
      ? Boolean(lobbyState.slots.B1 && lobbyState.slots.R1 && lobbyState.allHumansReady)
      : Boolean(lobbyState.humanCount >= 1 && lobbyState.allHumansReady);

  const renderModeSelectorCards = (
    canEdit: boolean,
    activeModeValue: FootballLobbyMode,
    onSelect: (m: FootballLobbyMode) => void
  ) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {(
        [
          {
            id: 'match_3v3' as const,
            badge: 'ปาร์ตี้สูงสุด 6 คน!',
            icon: '🏟️',
            title: 'ฟุตบอลโกลหนู 3v3 (ไม่มีโกล)',
            desc: 'บังคับตัวใครตัวมัน 3 ต่อ 3 ประตูโกลหนู บล็อกลูกยิงหน้าโกลได้ ช่องว่างเติม AI อัตโนมัติ!',
          },
          {
            id: 'penalty' as const,
            badge: 'ดวลวัดใจ 1v1',
            icon: '🥅',
            title: 'ดวลจุดโทษ 1v1 (Penalty)',
            desc: 'สลับยิง-เซฟ 5 ลูก + Sudden Death เล็ง 6 โซน หยุดแถบพลังยิงสีเขียว',
          },
        ]
      ).map((m) => {
        const active = activeModeValue === m.id;
        return (
          <button
            key={m.id}
            type="button"
            disabled={!canEdit}
            onClick={() => canEdit && onSelect(m.id)}
            className={`p-3 rounded-2xl border-2 text-left transition ${active
                ? 'bg-emerald-950/90 border-amber-300 shadow-[0_0_16px_rgba(250,204,21,0.32)]'
                : 'bg-slate-950/70 border-slate-800 hover:border-slate-600'
              } ${canEdit ? 'cursor-pointer' : 'opacity-90 cursor-default'}`}
          >
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-black text-amber-300 flex items-center gap-1.5">
                <span>{m.icon}</span>
                <span>{m.title}</span>
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold shrink-0 ${active ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-300'
                  }`}
              >
                {m.badge}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">{m.desc}</p>
          </button>
        );
      })}
    </div>
  );

  const renderSlotCard = (slotId: FootballSlotId, customLabel?: string) => {
    const team = getSlotTeam(slotId);
    const member = lobbyState.slots[slotId] || null;
    const ch = getPenaltyCharacter(member?.modelId);
    const isHostCard = Boolean(member && member.clientId === lobbyState.hostClientId);
    const isMe = Boolean(member && member.clientId === clientIdRef.current);

    return (
      <div
        key={slotId}
        className={`rounded-2xl p-2.5 sm:p-3 border-2 transition ${member
            ? isMe
              ? 'bg-emerald-950/75 border-amber-300 shadow-[0_0_12px_rgba(250,204,21,0.28)]'
              : team === 'blue'
                ? 'bg-sky-950/55 border-sky-400/80'
                : 'bg-rose-950/55 border-rose-400/80'
            : 'bg-slate-950/60 border-dashed border-slate-700'
          }`}
      >
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <span
            className={`text-[10.5px] font-black ${team === 'blue' ? 'text-sky-300' : 'text-rose-300'
              }`}
          >
            {customLabel || SLOT_ROLE_LABELS[slotId]}
          </span>
          {member && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${isHostCard || member.ready
                  ? 'bg-emerald-400 text-slate-950'
                  : 'bg-slate-800 text-amber-300'
                }`}
            >
              {isHostCard ? '👑 HOST' : member.ready ? '✅ READY' : 'รอ Ready'}
            </span>
          )}
        </div>

        {member ? (
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/20 flex items-center justify-center text-xl shrink-0">
              {member.avatar?.emoji || ch.emoji}
            </div>
            <div className="min-w-0">
              <div className="font-extrabold text-xs sm:text-sm text-white truncate">
                {member.name}
                {isMe && ' (คุณ)'}
              </div>
              <div className="text-[10px] text-amber-200/85 truncate">
                {member.avatar ? '✨ ตัวละคร 3D บนเกาะ' : ch.name.split(' (')[0]}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 py-1">
            <span className="text-[11px] font-bold text-slate-400">
              {lobbyState.matchMode === 'match_3v3'
                ? '🤖 ว่าง (AI ลงแทนได้)'
                : '⏳ รอผู้เล่นเข้าช่อง...'}
            </span>
            {myLobbySlot !== slotId && (
              <button
                type="button"
                onClick={() =>
                  void roomCtrlRef.current?.updateMyPresence({
                    desiredSlot: slotId,
                    slotUpdatedAt: Date.now(),
                  })
                }
                className={`px-2.5 py-1 rounded-xl text-[11px] font-black cursor-pointer shrink-0 ${team === 'blue'
                    ? 'bg-sky-500/25 hover:bg-sky-400 hover:text-slate-950 border border-sky-400/70 text-sky-200'
                    : 'bg-rose-500/25 hover:bg-rose-400 hover:text-slate-950 border border-rose-400/70 text-rose-200'
                  }`}
              >
                ➕ ย้ายมานี่
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className={`${embeddedModal ? 'fixed inset-0 z-50' : 'min-h-dvh w-full'
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
          <div className="w-full max-w-3xl bg-slate-900/95 border-2 border-emerald-400/80 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 relative my-auto">
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
                  ศึกฟุตบอลโกลหนู 3v3 (6 คน) & ดวลจุดโทษ 3D
                </h1>
                <p className="text-xs sm:text-sm text-emerald-200/85 font-semibold">
                  ปาร์ตี้สตรีทฟุตบอล 3 ต่อ 3 ไม่มีโกล บังคับตัวใครตัวมัน • รองรับ PC / iPad / มือถือ สูงสุด 6 คน!
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-amber-200 block">
                1. เลือกโหมดการแข่งขัน (ใช้ได้ทั้งโหมดซ้อม AI และสร้างห้องปาร์ตี้ออนไลน์)
              </label>
              {renderModeSelectorCards(true, selectedMode, setSelectedMode)}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-amber-200 block">
                2. ชื่อเล่นนักเตะของคุณ
              </label>
              <input
                type="text"
                maxLength={22}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="กรอกชื่อเล่น..."
                className="w-full px-4 py-2 rounded-xl bg-slate-950 border-2 border-slate-700 focus:border-emerald-400 outline-none text-sm font-extrabold text-white select-text"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-amber-200">
                  3. เลือกโมเดลตัวละครของคุณ (`public/models/*.glb`)
                </label>
                <span className="text-[11px] text-emerald-300 font-bold">
                  ทีมฟ้า vs ทีมแดง (3v3 โกลหนู)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-44 overflow-y-auto pr-1">
                {PENALTY_CHARACTERS.map((ch) => {
                  const active = selectedModelId === ch.id;
                  const fileBadge = ch.glbPath.replace('/models/', '');
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => setSelectedModelId(ch.id)}
                      className={`p-2 rounded-2xl border-2 text-left transition cursor-pointer flex items-center gap-2 ${active
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {/* Practice vs AI */}
              <div className="bg-slate-950/85 border-2 border-emerald-500/50 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-emerald-300">
                      🤖 โหมดซ้อมกับบอท (Practice vs AI)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                      เล่นทันที
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {selectedMode === 'match_3v3'
                      ? 'บังคับตัวคุณเองร่วมกับเพื่อน AI 2 ตัว ดวลโกลหนู 3v3 (ส่งบอล / เรียกขอบอล / ยิง / สไลด์บล็อก)'
                      : 'ฝึกเล็ง 6 โซนประตูและหยุดแถบพลังยิงสีเขียวดวลกับ AI'}
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
                        className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${aiDifficulty === d.id
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
                  onClick={() => startPracticeMatch(selectedMode)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-lime-400 hover:from-emerald-300 hover:to-lime-300 text-slate-950 font-black text-sm shadow-lg cursor-pointer"
                >
                  ⚡ เริ่มซ้อม {selectedMode === 'match_3v3' ? 'โกลหนู 3v3' : 'ดวลจุดโทษ 1v1'} ทันที!
                </button>
              </div>

              {/* Online Party Match */}
              <div className="bg-slate-950/85 border-2 border-amber-400/60 rounded-2xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-amber-300">
                      🌐 ปาร์ตี้ออนไลน์ข้ามเครื่อง (สูงสุด 6 คน!)
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-bold">
                      {transportKind === 'supabase' ? 'Supabase Live' : 'Local Multi-Tab'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    เลือกอยู่ทีมฟ้าหรือทีมแดงได้อิสระ 1–6 คน ช่องที่เหลือเติม AI ให้อัตโนมัติ!
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateRoom}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-black text-sm shadow cursor-pointer"
                  >
                    🏟️ สร้างห้อง ({selectedMode === 'match_3v3' ? 'โกลหนู 3v3 • 6 คน' : 'ดวลจุดโทษ 1v1'})
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

      {/* ==================== 2. ONLINE ROOM LOBBY (6-Slot Party 3v3 & 1v1 Penalty!) ==================== */}
      {screen === 'lobby' && (
        <div className="flex-1 overflow-y-auto flex items-center justify-center p-3 sm:p-5">
          <div className="w-full max-w-3xl bg-slate-900/95 border-2 border-amber-400/80 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-3.5 my-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-emerald-300">
                  🏟️ ห้องรอปาร์ตี้ฟุตบอลโกลหนู ({lobbyState.humanCount}/{lobbyState.maxPlayers} คน •{' '}
                  {transportKind === 'supabase' ? 'Supabase Presence' : 'Local Multi-Tab'})
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
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold cursor-pointer ${roomCode === preset
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

            {/* Lobby Mode Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-extrabold">
                <span className="text-amber-200">
                  🎮 โหมดการแข่งขันของห้องนี้ {!amILobbyHost && '(Host เป็นผู้เลือก)'}
                </span>
                {lobbyState.matchMode === 'match_3v3' && (
                  <span className="text-[11px] text-emerald-300">
                    คลิกปุ่ม &ldquo;➕ ย้ายมานี่&rdquo; เพื่อสลับอยู่ทีมฟ้าหรือทีมแดงได้เลย!
                  </span>
                )}
              </div>
              {renderModeSelectorCards(amILobbyHost, lobbyState.matchMode, (nextMode) => {
                setSelectedMode(nextMode);
                roomCtrlRef.current?.setLobbyMatchMode(nextMode);
              })}
            </div>

            {/* 6-Slot Team Grid (3v3 Mode) OR 2-Slot Duel Grid (Penalty Mode) */}
            {lobbyState.matchMode === 'match_3v3' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-sky-950/25 border border-sky-500/40 rounded-2xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black text-sky-300">
                      🔵 ทีมฟ้า (บุกฝั่งขวา • 3 คน ไม่มีโกล)
                    </span>
                    <span className="text-[10px] font-extrabold text-sky-200/80">
                      {BLUE_SLOTS.filter((s) => Boolean(lobbyState.slots[s])).length}/3 คน
                    </span>
                  </div>
                  {BLUE_SLOTS.map((s) => renderSlotCard(s))}
                </div>

                <div className="bg-rose-950/25 border border-rose-500/40 rounded-2xl p-2.5 space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black text-rose-300">
                      🔴 ทีมแดง (บุกฝั่งซ้าย • 3 คน ไม่มีโกล)
                    </span>
                    <span className="text-[10px] font-extrabold text-rose-200/80">
                      {RED_SLOTS.filter((s) => Boolean(lobbyState.slots[s])).length}/3 คน
                    </span>
                  </div>
                  {RED_SLOTS.map((s) => renderSlotCard(s))}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderSlotCard('B1', '🔵 ฝั่งเจ้าบ้าน (B1 • ยิงลูกแรกก่อน)')}
                {renderSlotCard('R1', '🔴 ฝั่งผู้ท้าชิง (R1 • เซฟลูกแรกก่อน)')}
              </div>
            )}

            {/* Quick Avatar / .glb Model Switcher inside Lobby */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-extrabold text-amber-200">
                  🎭 ตัวละครลงสนามของคุณ:
                </div>
                {myIslandAvatar && (
                  <span className="text-[10.5px] font-bold text-emerald-300">
                    {useMyIslandChar
                      ? '✨ ใช้ตัวละคร 3D ประจำตัวบนเกาะ (หมวก/ชุด/ปีกครบ!)'
                      : 'ใช้โมเดลสัตว์ .glb พื้นฐาน'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {myIslandAvatar && (
                  <button
                    type="button"
                    onClick={() => {
                      setUseMyIslandChar(true);
                      const nextAv = {
                        ...myIslandAvatar,
                        name: nickname.trim() || myIslandAvatar.name,
                      };
                      void roomCtrlRef.current?.updateMyPresence({ avatar: nextAv });
                    }}
                    className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black shrink-0 cursor-pointer flex items-center gap-1.5 ${useMyIslandChar
                        ? 'bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 border-white shadow'
                        : 'bg-slate-900 text-emerald-300 border-emerald-500/60 hover:border-emerald-400'
                      }`}
                  >
                    <span>{myIslandAvatar.emoji || '🌟'}</span>
                    <span>ตัวละครของฉัน ({myIslandAvatar.name})</span>
                  </button>
                )}
                {PENALTY_CHARACTERS.map((ch) => {
                  const selected =
                    !useMyIslandChar && (myPresence?.modelId || selectedModelId) === ch.id;
                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        setUseMyIslandChar(false);
                        setSelectedModelId(ch.id);
                        void roomCtrlRef.current?.updateMyPresence({
                          modelId: ch.id,
                          avatar: null,
                        });
                      }}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold shrink-0 cursor-pointer flex items-center gap-1 ${selected
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
                  disabled={!canHostStartNow}
                  onClick={() => broadcastAndLaunchOnline(lobbyState.matchMode)}
                  className={`flex-1 py-3.5 rounded-2xl font-black text-sm sm:text-base transition ${canHostStartNow
                      ? 'bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 shadow-xl cursor-pointer hover:scale-[1.01]'
                      : 'bg-slate-800 text-slate-400 cursor-not-allowed'
                    }`}
                >
                  {lobbyState.matchMode === 'penalty'
                    ? canHostStartNow
                      ? '🥅 เริ่มศึกดวลจุดโทษ 1v1 เลย!'
                      : lobbyState.slots.B1 && lobbyState.slots.R1
                        ? '⏳ รอผู้ท้าชิงกดปุ่ม Ready...'
                        : '⏳ รอเพื่อนเข้าช่องอีก 1 คน...'
                    : !lobbyState.allHumansReady
                      ? `⏳ รอเพื่อนในห้องกด Ready (${readyHumanCount}/${lobbyState.humanCount} คน)...`
                      : lobbyState.humanCount >= 6
                        ? '⚽ เริ่มศึกโกลหนู 3v3 ครบ 6 คนเลย!'
                        : `⚽ เริ่มโกลหนู 3v3 เลย! (คนเล่น ${lobbyState.humanCount} + 🤖 เติม AI ${6 - lobbyState.humanCount} ตัว)`}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    void roomCtrlRef.current?.updateMyPresence({
                      ready: !myPresence?.ready,
                    })
                  }
                  className={`flex-1 py-3.5 rounded-2xl font-black text-sm sm:text-base cursor-pointer transition ${myPresence?.ready
                      ? 'bg-emerald-400 text-slate-950 shadow-lg'
                      : 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow-lg'
                    }`}
                >
                  {myPresence?.ready
                    ? '✅ พร้อมแล้ว! (กดซ้ำเพื่อยกเลิก)'
                    : '🔥 กด READY พร้อมลงสนาม!'}
                </button>
              )}

              <button
                type="button"
                onClick={() => startPracticeMatch(lobbyState.matchMode)}
                className="px-4 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-emerald-400/50 text-emerald-300 text-xs sm:text-sm font-extrabold cursor-pointer"
              >
                🤖 ซ้อมเดี่ยวกับ AI
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
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

      {/* ==================== 3A. PHASE 2: STREET 3v3 โกลหนู MATCH SCREEN ==================== */}
      {screen === 'playing_3v3' && (
        <div
          className="relative w-full h-dvh overflow-hidden select-none touch-none"
          style={{ touchAction: 'none' }}
        >
          <div ref={fbSceneWrapRef} className="fixed inset-0 w-full h-full touch-none" />
          <div
            ref={fbHudLayerRef}
            className="fixed inset-0 pointer-events-none z-10 overflow-hidden"
          />

          {/* Top Broadcast Scoreboard HUD */}
          <div className="fixed top-2 sm:top-3 inset-x-2 sm:inset-x-4 pt-safe z-20 flex items-center justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (!isPractice && amIMatchHost && roomCtrlRef.current) {
                    roomCtrlRef.current.broadcastReturnToLobby();
                  }
                  returnToLobbyOrHome(roomCode ? 'lobby' : 'home');
                }}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-950/85 hover:bg-amber-400 hover:text-slate-950 border border-amber-300/60 text-xs font-extrabold text-amber-100 cursor-pointer shadow"
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

            {/* Street 3v3 Score Bug */}
            <div className="pointer-events-auto bg-slate-950/92 border-2 border-amber-400 rounded-2xl px-3 sm:px-5 py-1.5 flex items-center gap-2 sm:gap-4 shadow-2xl">
              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-sky-300 max-w-[90px] sm:max-w-[145px] truncate">
                <span>🔵</span>
                <span className="truncate">{blueTeamDisplayLabel}</span>
              </div>

              <div className="flex items-center gap-1.5 font-[family-name:var(--font-kanit)] text-xl sm:text-2xl font-black">
                <span className="px-2.5 py-0.5 rounded-lg bg-sky-500 text-slate-950 min-w-[32px] text-center">
                  {fbScoreBlue}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-lg font-mono text-sm sm:text-base border ${fbClockSec <= 30
                      ? 'bg-rose-600 text-white border-white animate-pulse'
                      : 'bg-slate-900 text-amber-300 border-amber-400/50'
                    }`}
                >
                  ⏱ {formatMatchClock(fbClockSec)}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-rose-500 text-white min-w-[32px] text-center">
                  {fbScoreRed}
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-rose-300 max-w-[90px] sm:max-w-[145px] truncate">
                <span className="truncate">{redTeamDisplayLabel}</span>
                <span>🔴</span>
              </div>
            </div>

            <div className="pointer-events-auto flex items-center gap-1.5">
              <span
                className={`hidden md:inline-flex px-2.5 py-1.5 rounded-xl border text-[11px] font-black shadow ${myTeam3v3 === 'blue'
                    ? 'bg-sky-950/90 text-sky-200 border-sky-400'
                    : 'bg-rose-950/90 text-rose-200 border-rose-400'
                  }`}
              >
                ⭐ ช่อง {mySlotId}
              </span>
              <button
                type="button"
                onClick={() => setShowVirtualPad((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold cursor-pointer shadow ${showVirtualPad
                    ? 'bg-amber-400 text-slate-950 border-white'
                    : 'bg-slate-950/85 text-slate-200 border-slate-600'
                  }`}
                title="เปิด/ปิดจอยจำลองบนจอ (Virtual Gamepad)"
              >
                🎮
              </button>
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-950/85 border border-slate-600 text-xs font-extrabold cursor-pointer shadow"
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>

          {/* Goal Scored Celebration Splash */}
          {fbGoalSplash && (
            <div className="fixed top-[28%] left-1/2 -translate-x-1/2 z-30 pointer-events-none text-center">
              <div
                className={`px-7 py-4 rounded-3xl border-4 border-white shadow-2xl animate-bounce ${fbGoalSplash.team === 'blue'
                    ? 'bg-gradient-to-r from-sky-500 via-blue-600 to-cyan-400 text-white'
                    : 'bg-gradient-to-r from-rose-500 via-red-600 to-amber-400 text-white'
                  }`}
              >
                <div className="font-[family-name:var(--font-kanit)] text-3xl sm:text-5xl font-black tracking-wide">
                  ⚽ GOAL!!
                </div>
                <div className="text-xs sm:text-base font-extrabold mt-1">
                  {fbGoalSplash.team === 'blue'
                    ? `🔵 ${fbGoalSplash.scorerName} ซัดเสียบโกลหนู! เขี่ยบอลใหม่กลางสนาม!`
                    : `🔴 ${fbGoalSplash.scorerName} ซัดเสียบโกลหนู! เขี่ยบอลใหม่กลางสนาม!`}
                </div>
              </div>
            </div>
          )}

          {/* Full-Time Tied -> Transition to Team Rotation Penalty Shootout Banner! */}
          {fbTieTransitionBanner && (
            <div className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 pointer-events-none">
              <div className="bg-slate-900 border-3 border-amber-400 rounded-3xl p-6 text-center space-y-2 shadow-2xl max-w-md animate-bounce">
                <div className="text-5xl">⚡🥅</div>
                <h3 className="font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-black text-amber-300">
                  หมดเวลา 3 นาที เสมอกัน {fbScoreBlue} - {fbScoreRed}!
                </h3>
                <p className="text-xs sm:text-sm font-extrabold text-emerald-300">
                  ตัดเข้าสู่โหมดเวียนยิงจุดโทษทั้งทีมตัดสินแชมป์ทันที!
                </p>
              </div>
            </div>
          )}

          {/* Desktop Controls Hint Pill */}
          {!showVirtualPad && !fbWinnerTeam && (
            <div className="hidden lg:flex fixed bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="bg-slate-950/85 border border-amber-400/50 rounded-full px-4 py-1.5 text-[11px] font-extrabold text-amber-100 flex items-center gap-3 shadow-xl">
                <span>🕹️ ลูกศร + X(ส่งบอล / ขอบอลจาก AI) + D(กดค้างยิงโกลหนู)</span>
                <span className="text-slate-500">|</span>
                <span>⌨️ หรือ WASD + J(ส่ง/ขอบอล) + K(กดค้างยิง)</span>
                <span className="text-slate-500">|</span>
                <span>⚡ Shift / Space วิ่งเร็ว & พุ่งสไลด์บล็อกลูกยิง!</span>
              </div>
            </div>
          )}

          {/* Multi-Touch Virtual Gamepad for iPad & Mobile */}
          {!fbWinnerTeam && !fbTieTransitionBanner && (
            <VirtualGamepad
              visible={showVirtualPad}
              onMoveChange={(mx, mz) =>
                updateLocalFbInput((prev) => ({ ...prev, moveX: mx, moveZ: mz }))
              }
              onPassPress={() =>
                updateLocalFbInput((prev) => ({ ...prev, passSeq: prev.passSeq + 1 }))
              }
              onShootChargeStart={() =>
                updateLocalFbInput((prev) => ({ ...prev, shootCharging: true }))
              }
              onShootRelease={() =>
                updateLocalFbInput((prev) => ({
                  ...prev,
                  shootCharging: false,
                  shootSeq: prev.shootSeq + 1,
                }))
              }
              onSprintOrTackleChange={(pressed, fresh) =>
                updateLocalFbInput((prev) => ({
                  ...prev,
                  sprint: pressed,
                  tackleSeq: fresh ? prev.tackleSeq + 1 : prev.tackleSeq,
                }))
              }
            />
          )}

          {/* 3v3 Match Finished Overlay */}
          {fbWinnerTeam && (
            <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 text-center space-y-3.5 shadow-2xl">
                <div className="text-5xl">{fbWinnerTeam === myTeam3v3 ? '🏆⚽' : '👏🏟️'}</div>
                <h3 className="font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-black text-amber-300">
                  {fbWinnerTeam === 'blue' ? '🔵 ทีมฟ้าคว้าแชมป์โกลหนู!' : '🔴 ทีมแดงคว้าแชมป์โกลหนู!'}
                </h3>
                <div className="font-[family-name:var(--font-kanit)] text-3xl font-black">
                  <span className="text-sky-400">{fbScoreBlue}</span>
                  <span className="text-slate-500 mx-2">-</span>
                  <span className="text-rose-400">{fbScoreRed}</span>
                </div>

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
                      onClick={() => handleRematch('match_3v3')}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 font-black text-sm cursor-pointer"
                    >
                      🔄 แข่งโกลหนู 3v3 อีกรอบ (Rematch!)
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

      {/* ==================== 3B. PHASE 1: 3D PENALTY SHOOTOUT SCREEN ==================== */}
      {screen === 'playing_penalty' && (
        <div
          className="relative w-full h-dvh overflow-hidden select-none touch-none"
          style={{ touchAction: 'none' }}
        >
          <div ref={sceneContainerRef} className="fixed inset-0 w-full h-full touch-none" />

          {/* Top Scoreboard HUD */}
          <div className="fixed top-2 sm:top-3 inset-x-2 sm:inset-x-4 pt-safe z-20 flex items-start justify-between gap-2 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (!isPractice && amIMatchHost && roomCtrlRef.current) {
                    roomCtrlRef.current.broadcastReturnToLobby();
                  }
                  returnToLobbyOrHome(roomCode ? 'lobby' : 'home');
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

            <div className="pointer-events-auto bg-slate-950/90 border-2 border-amber-400 rounded-2xl px-3 sm:px-5 py-1.5 sm:py-2 shadow-2xl flex flex-col items-center gap-1 max-w-[68vw]">
              {cameFrom3v3TieScore !== null && (
                <div className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-extrabold">
                  ⚡ เวียนยิงจุดโทษตัดสินหลังเสมอ 3v3 ({cameFrom3v3TieScore}-{cameFrom3v3TieScore})
                </div>
              )}
              <div className="flex items-center gap-2.5 sm:gap-5">
                <div className="flex flex-col items-end min-w-0">
                  <div className="text-[11px] sm:text-xs font-extrabold text-sky-300 truncate max-w-[90px] sm:max-w-[140px]">
                    🔵 {blueTeamDisplayLabel}
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
                    {redTeamDisplayLabel} 🔴
                  </div>
                  {renderDotRow(scoreSummary.p2Dots, currentShooterSide === 'p2')}
                </div>
              </div>

              <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-extrabold text-center">
                {scoreSummary.isSuddenDeath ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                    🔥 SUDDEN DEATH (ลูกที่ {scoreSummary.currentRound}) • {activePenaltyActors.shooter.name} vs {activePenaltyActors.keeper.name}
                  </span>
                ) : (
                  <span className="text-amber-200/90">
                    ลูกที่ {Math.min(scoreSummary.currentRound, REGULATION_KICKS)}/{REGULATION_KICKS} •{' '}
                    {amIShooter
                      ? '⚽ ตาคุณยิง!'
                      : amIKeeper
                        ? '🧤 ตาคุณเฝ้าเสาพุ่งปัด!'
                        : `📣 ${activePenaltyActors.shooter.name} ยิงดวลกับ ${activePenaltyActors.keeper.name}`}
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

          {turnPhase !== 'finished' && (peerReadyBanner || (amIKeeper && turnPhase === 'selecting')) && (
            <div className="fixed top-24 sm:top-26 left-1/2 -translate-x-1/2 z-20 pointer-events-none flex flex-col items-center gap-1 w-[92vw] max-w-md">
              {amIKeeper && turnPhase === 'selecting' && (
                <div
                  className={`px-3.5 py-1 rounded-full border-2 text-xs sm:text-sm font-black shadow-lg ${keeperTimeLeft <= 3
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

          {turnPhase === 'selecting' && (amIShooter || amIKeeper) && (
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
                        if (amIKeeper) {
                          setKeeperZonePicked(true);
                        }
                      }}
                      className={`rounded-xl border-2 flex flex-col items-center justify-center transition touch-none cursor-pointer ${isPicked
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

          {impactBanner && turnPhase !== 'finished' && (
            <div className="fixed top-[34%] left-1/2 -translate-x-1/2 z-30 pointer-events-none w-[92vw] max-w-md text-center">
              <div
                className={`px-5 py-3.5 rounded-3xl border-3 shadow-2xl animate-bounce ${impactBanner.tone === 'goal'
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

                    <div
                      ref={powerBarFillRef}
                      className="absolute inset-y-0 left-0 bg-white/15 pointer-events-none"
                      style={{ width: '0%' }}
                    />
                    <div
                      ref={powerBarCursorRef}
                      className="absolute top-0 bottom-0 w-2 -ml-1 bg-slate-950 border-x-2 border-white shadow-[0_0_10px_#fff] pointer-events-none"
                      style={{ left: '0%' }}
                    />
                  </div>

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

              {turnPhase === 'selecting' && amIKeeper && (
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

              {turnPhase === 'selecting' && amISpectatingPenaltyTurn && (
                <div className="px-5 py-3 rounded-2xl bg-slate-950/90 border-2 border-emerald-400 text-emerald-200 text-xs sm:text-sm font-extrabold shadow-xl pointer-events-auto text-center">
                  📣 ตาเพื่อนร่วมทีม! <strong>{activePenaltyActors.shooter.name}</strong> กำลังดวลจุดโทษกับ{' '}
                  <strong>{activePenaltyActors.keeper.name}</strong> (สลับคิวยิงทุกคนในทีม!)
                </div>
              )}

              {turnPhase === 'waiting_peer' && (
                <div className="px-6 py-3 rounded-2xl bg-slate-950/90 border-2 border-amber-300 text-amber-200 text-xs sm:text-sm font-extrabold shadow-xl animate-pulse pointer-events-auto">
                  {amIShooter
                    ? `✅ ล็อกลูกยิง (${Math.round(lockedPower ?? 0)}%) แล้ว! รอฝั่งเซฟเลือกมุมพุ่งปัด...`
                    : `🧤 ล็อกมุมพุ่งปัดแล้ว! รอคนยิงสับไก...`}
                </div>
              )}
            </div>
          )}

          {turnPhase === 'finished' && scoreSummary.winner && (
            <div className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 sm:p-6 text-center space-y-3.5 shadow-2xl">
                <div className="text-5xl">
                  {scoreSummary.winner === mySide ? '🏆⚽' : '🧤👏'}
                </div>
                <h3 className="font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-black text-amber-300">
                  {scoreSummary.winner === mySide
                    ? 'ทีมของคุณชนะดวลจุดโทษ!! สุดยอดแชมเปี้ยน!'
                    : 'พ่ายจุดโทษไปนิดเดียว! แก้มือรอบหน้า!'}
                </h3>
                <div className="font-[family-name:var(--font-kanit)] text-3xl font-black">
                  <span className="text-sky-400">{scoreSummary.p1Goals}</span>
                  <span className="text-slate-500 mx-2">-</span>
                  <span className="text-rose-400">{scoreSummary.p2Goals}</span>
                </div>
                {(scoreSummary.isSuddenDeath || cameFrom3v3TieScore !== null) && (
                  <div className="inline-block px-3 py-0.5 rounded-full bg-rose-600/30 border border-rose-400 text-xs font-extrabold text-rose-200">
                    {cameFrom3v3TieScore !== null
                      ? `⚡ ชนะจุดโทษหลังเสมอโกลหนู 3v3 (${cameFrom3v3TieScore}-${cameFrom3v3TieScore})`
                      : '🔥 ตัดสินในช่วง Sudden Death!'}
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
                      onClick={() =>
                        handleRematch(cameFrom3v3TieScore !== null ? 'match_3v3' : 'penalty')
                      }
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-amber-300 text-slate-950 font-black text-sm cursor-pointer"
                    >
                      🔄 แข่งอีกรอบ (Rematch!)
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
  colorHex?: string;
  bandColor?: string;
  species?: string;
  breed?: string;
  equipHat?: string;
  equipFace?: string;
  equipArmor?: string;
  equipWings?: string;
  equipAura?: string;
  propColors?: Record<string, string>;
  bellyScale?: number;
  bmiBellyScale?: number;
  muscleScale?: number;
}

function toFootballAvatarProfile(p?: PenaltyModalPlayerSummary): FootballAvatarProfile | null {
  if (!p) return null;
  return {
    playerId: p.id,
    name: p.name,
    emoji: p.emoji || '⚽',
    colorHex: p.colorHex || '#F8FAFC',
    species: p.breed || p.species || 'bunny',
    equipHat: p.equipHat || 'none',
    equipFace: p.equipFace || 'face_none',
    equipArmor: p.equipArmor || 'armor_none',
    equipWings: p.equipWings || 'wings_none',
    equipAura: p.equipAura || 'aura_none',
    propColors: p.propColors,
    bellyScale: p.bellyScale ?? p.bmiBellyScale ?? 1,
    muscleScale: p.muscleScale ?? 1,
  };
}

export function PenaltyShootoutModal({
  isOpen,
  onClose,
  players,
  currentUserId,
  initialRoomCode,
  initialIsHost = false,
  invitedTargetName,
  onParticipationChange,
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
  onParticipationChange?: (participating: boolean, clientId: string, isHostNow: boolean) => void;
  onLobbyBroadcast?: (info: PenaltyLobbyBroadcastInfo) => void;
  onRewardEarned?: (earned: number, totalPoints: number) => void;
}) {
  if (!isOpen) return null;
  const me = players.find((p) => p.id === currentUserId) || players[0];
  const mappedModel = mapSpeciesOrEmojiToPenaltyChar(me?.breed || me?.species, me?.emoji);
  const myAvatar = toFootballAvatarProfile(me);
  const pool = players
    .map((pl) => toFootballAvatarProfile(pl))
    .filter((x): x is FootballAvatarProfile => Boolean(x));

  return (
    <PenaltyShootoutGame
      embeddedModal
      onClose={onClose}
      defaultNickname={me?.name || 'กัปตันสายฟ้า'}
      defaultModelId={mappedModel}
      myIslandAvatar={myAvatar}
      islandAvatarsPool={pool}
      currentUserId={currentUserId}
      autoRoomCode={initialRoomCode || '6666'}
      autoIsCreator={initialIsHost}
      invitedTargetName={invitedTargetName}
      onParticipationChange={onParticipationChange}
      onLobbyBroadcast={onLobbyBroadcast}
      onRewardEarned={onRewardEarned}
    />
  );
}
