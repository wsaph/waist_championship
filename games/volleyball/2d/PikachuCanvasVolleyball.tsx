'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import type { PropColorMap } from '@/lib/rpg_catalog';
import type { QualityMode } from '@/lib/device_perf';
import {
  CHIBI_SKINS,
  COURT_HEIGHT,
  COURT_WIDTH,
  DEFAULT_WIN_SCORE,
  EMPTY_PLAYER_INPUT,
  FIXED_DT,
  SKIN_COLOR_PALETTE,
  computeAiInput,
  createMatchState,
  getActiveSlots,
  getTeamForSlot,
  mapEmojiToChibiSkin,
  playVolleyballSfx,
  resetForNextServe,
  stepGamePhysics,
  type AiDifficulty,
  type ChibiSkinId,
  type GameEvents,
  type GameMode,
  type MatchState,
  type PlayerInput,
  type PlayerSlot,
  type SlotProfile,
  type TeamSide,
} from './physics2d';
import { CanvasFxState, renderVolleyballCanvas } from './canvasRenderer2d';
import {
  ClientStateInterpolator,
  HOST_BROADCAST_INTERVAL_MS,
  VolleyballRoomController,
  generateRoomCode,
  isSupabaseConfigured,
  packNetState,
  type GuestInputPacket,
  type NetStateSnapshot,
  type PresencePlayer,
  type ResolvedLobbyState,
  type StartMatchPacket,
} from '@/games/shared/realtimeSync';
import {
  fetchVolleyballLeaderboard,
  recordMatchResultByHost,
  type MatchHistoryRow,
  type PlayerStatRow,
} from '../stats';

// --- Backwards-compatible exports for 3D Arena (app/page.tsx) ---
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

export interface VbCourtRosterSlot {
  slotId: 'L1' | 'L2' | 'R1' | 'R2';
  clientId?: string;
  playerId: number;
  name: string;
  emoji: string;
  isBot?: boolean;
}

export interface VbLobbyBroadcastInfo {
  roomCode: string;
  mode: GameMode;
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

export interface BeachVolleyballModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: VolleyballPlayerSummary[];
  currentUserId: number | null;
  qualityMode?: QualityMode;
  initialRoomCode: string;
  initialMode: GameMode;
  initialIsHost: boolean;
  invitedTargetName?: string;
  externalLobbyInfo?: VbLobbyBroadcastInfo | null;
  onLobbyBroadcast?: (info: VbLobbyBroadcastInfo) => void;
  onRewardEarned?: (earned: number, newPoints: number) => void;
}

export interface PikachuVolleyballGameProps {
  embeddedModal?: boolean;
  onClose?: () => void;
  defaultNickname?: string;
  defaultSkin?: ChibiSkinId;
  defaultColor?: string;
  currentUserId?: number | null;
  autoRoomCode?: string;
  autoMode?: GameMode;
  autoIsCreator?: boolean;
  invitedTargetName?: string;
  onLobbyBroadcast?: (info: VbLobbyBroadcastInfo) => void;
  onRewardEarned?: (earned: number, newPoints: number) => void;
}

type ScreenPhase = 'home' | 'lobby' | 'playing' | 'leaderboard';

interface RoomAlertToast {
  id: number;
  kind: 'warn' | 'info' | 'success';
  message: string;
}

function getSkinEmoji(skin: ChibiSkinId): string {
  return CHIBI_SKINS.find((s) => s.id === skin)?.emoji || '⚡';
}

export function LeaderboardPanel({
  onBack,
  standaloneLink = false,
}: {
  onBack?: () => void;
  standaloneLink?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [leaders, setLeaders] = useState<PlayerStatRow[]>([]);
  const [recentMatches, setRecentMatches] = useState<MatchHistoryRow[]>([]);
  const [source, setSource] = useState<'supabase' | 'local'>('local');

  const loadData = useCallback(async () => {
    setLoading(true);
    const res = await fetchVolleyballLeaderboard();
    setLeaders(res.leaders);
    setRecentMatches(res.recentMatches);
    setSource(res.source);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="w-full max-w-4xl mx-auto p-3 sm:p-6 space-y-4 text-slate-100">
      <div className="bg-slate-900/95 border-2 border-amber-400/70 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-300 to-orange-500 border-2 border-white flex items-center justify-center text-2xl shadow-lg">
              🏆
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-kanit)] text-xl sm:text-2xl font-black text-amber-300">
                ตารางอันดับยอดนักตบ Chibi Volleyball
              </h1>
              <p className="text-xs text-sky-200/85 font-semibold">
                จัดอันดับผู้ชนะสูงสุด • บันทึกผลเฉพาะตอนจบเกมโดย Host เท่านั้น (
                {source === 'supabase' ? 'Supabase PostgreSQL' : 'Local / Turso DB'})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-extrabold text-amber-200 cursor-pointer"
            >
              🔄 รีเฟรช
            </button>
            {standaloneLink && (
              <Link
                href="/volleyball/leaderboard"
                target="_blank"
                className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 border border-sky-300 text-xs font-extrabold text-white"
              >
                ↗ เปิดหน้าเต็ม
              </Link>
            )}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
              >
                ← กลับไปหน้าเกม
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-14 text-center text-amber-200 font-bold animate-pulse">
            🏐 กำลังโหลดข้อมูลตารางอันดับ...
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Top Winners Table */}
            <div className="lg:col-span-3 bg-slate-950/75 border border-slate-700/80 rounded-2xl p-3.5 space-y-3">
              <h2 className="font-[family-name:var(--font-kanit)] text-base font-extrabold text-amber-300 flex items-center gap-2">
                <span>👑 อันดับผู้เล่นที่ชนะสูงสุด</span>
                <span className="text-xs text-slate-400 font-normal">({leaders.length} อันดับ)</span>
              </h2>

              {leaders.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 font-semibold">
                  ยังไม่มีประวัติการแข่งขันออนไลน์ มาสร้างห้องเปิดศึกนัดแรกกันเลย!
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2">ผู้เล่น</th>
                        <th className="py-2 text-center">ชนะ</th>
                        <th className="py-2 text-center">แพ้</th>
                        <th className="py-2 text-center">Win%</th>
                        <th className="py-2 text-right">แต้มรวม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70">
                      {leaders.map((row, idx) => {
                        const total = Math.max(1, row.wins + row.losses);
                        const winRate = Math.round((row.wins / total) * 100);
                        const medal =
                          idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}`;
                        return (
                          <tr key={row.player_name} className="hover:bg-slate-900/65">
                            <td className="py-2.5 pr-2 font-black text-amber-300">{medal}</td>
                            <td className="py-2.5 font-extrabold text-white flex items-center gap-1.5">
                              <span>{getSkinEmoji(row.skin as ChibiSkinId)}</span>
                              <span className="truncate max-w-[140px]">{row.player_name}</span>
                            </td>
                            <td className="py-2.5 text-center font-black text-emerald-400">
                              {row.wins}
                            </td>
                            <td className="py-2.5 text-center font-bold text-rose-400">
                              {row.losses}
                            </td>
                            <td className="py-2.5 text-center font-bold text-sky-300">
                              {winRate}%
                            </td>
                            <td className="py-2.5 text-right font-black text-amber-300">
                              {row.total_points}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent Match History */}
            <div className="lg:col-span-2 bg-slate-950/75 border border-slate-700/80 rounded-2xl p-3.5 space-y-3">
              <h2 className="font-[family-name:var(--font-kanit)] text-base font-extrabold text-sky-300">
                🕒 ประวัติแมตช์ล่าสุด
              </h2>

              {recentMatches.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400 font-semibold">
                  ยังไม่มีประวัติแมตช์ล่าสุด
                </div>
              ) : (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {recentMatches.map((m) => (
                    <div
                      key={m.match_uid}
                      className="rounded-xl bg-slate-900/90 border border-slate-800 p-2.5 space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 font-extrabold text-[10px]">
                          ห้อง #{m.room_code} • {m.mode.toUpperCase()}
                        </span>
                        <span className="font-black text-sm">
                          <span className="text-sky-400">{m.score_blue}</span>
                          <span className="text-slate-500 mx-1">:</span>
                          <span className="text-rose-400">{m.score_red}</span>
                        </span>
                      </div>
                      <div className="text-[11px] text-emerald-300 font-bold truncate">
                        🏆 ชนะ ({m.winning_team === 'blue' ? 'ทีมฟ้า' : 'ทีมแดง'}):{' '}
                        {m.winners.join(', ') || '-'}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        พ่ายแพ้: {m.losers.join(', ') || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function PikachuVolleyballGame({
  embeddedModal = false,
  onClose,
  defaultNickname = '',
  defaultSkin = 'pikamouse',
  defaultColor = '#FACC15',
  currentUserId = null,
  autoRoomCode,
  autoMode = '2v2',
  autoIsCreator = false,
  invitedTargetName,
  onLobbyBroadcast,
  onRewardEarned,
}: PikachuVolleyballGameProps) {
  const clientIdRef = useRef<string>(
    `pvb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );

  // Player Profile Setup
  const [nickname, setNickname] = useState<string>(() => {
    if (defaultNickname) return defaultNickname;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pvb_nickname') || 'พิคาชูซ่า';
    }
    return 'พิคาชูซ่า';
  });
  const [skin, setSkin] = useState<ChibiSkinId>(defaultSkin);
  const [bodyColor, setBodyColor] = useState<string>(defaultColor);

  // Navigation & Room Setup
  const [screen, setScreen] = useState<ScreenPhase>(autoRoomCode ? 'lobby' : 'home');
  const [roomCode, setRoomCode] = useState<string>(autoRoomCode || '');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [preferredCreateMode, setPreferredCreateMode] = useState<GameMode>(autoMode);
  const [isCreator, setIsCreator] = useState<boolean>(autoIsCreator);

  // Practice vs AI Settings
  const [isPracticeMatch, setIsPracticeMatch] = useState<boolean>(false);
  const [practiceMode, setPracticeMode] = useState<GameMode>('2v2');
  const [aiDifficulty, setAiDifficulty] = useState<AiDifficulty>('normal');

  // Realtime Lobby State (from Supabase Presence)
  const [lobbyState, setLobbyState] = useState<ResolvedLobbyState>({
    mode: autoMode,
    hostClientId: null,
    slots: {},
    onlinePlayers: [],
    allSlotsFilled: false,
    allReady: false,
  });
  const [transportKind, setTransportKind] = useState<'supabase' | 'local_tab'>(
    isSupabaseConfigured() ? 'supabase' : 'local_tab'
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [alerts, setAlerts] = useState<RoomAlertToast[]>([]);

  // Active Match HUD State
  const [activeMode, setActiveMode] = useState<GameMode>(autoMode);
  const [myActiveSlot, setMyActiveSlot] = useState<PlayerSlot>('P1');
  const [hostActiveSlot, setHostActiveSlot] = useState<PlayerSlot>('P1');
  const [amIAuthoritativeHost, setAmIAuthoritativeHost] = useState<boolean>(true);
  const [scoreBlue, setScoreBlue] = useState<number>(0);
  const [scoreRed, setScoreRed] = useState<number>(0);
  const [pointBanner, setPointBanner] = useState<string>('');
  const [winnerTeam, setWinnerTeam] = useState<TeamSide | null>(null);
  const [rewardNotice, setRewardNotice] = useState<string>('');
  const [dbSaveNotice, setDbSaveNotice] = useState<string>('');
  const [muted, setMuted] = useState<boolean>(false);
  const [showTouchPad, setShowTouchPad] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return navigator.maxTouchPoints > 0 || window.innerWidth <= 1024;
  });

  // Mutable Refs for 60 FPS Loop & Event-Driven Networking
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const roomCtrlRef = useRef<VolleyballRoomController | null>(null);
  const matchStateRef = useRef<MatchState | null>(null);
  const interpolatorRef = useRef<ClientStateInterpolator>(new ClientStateInterpolator());
  const localInputRef = useRef<PlayerInput>({ ...EMPTY_PLAYER_INPUT });
  const guestInputsBySlotRef = useRef<Partial<Record<PlayerSlot, PlayerInput>>>({});
  const activeMatchUidRef = useRef<string>('');
  const matchStartedAtRef = useRef<number>(0);
  const matchSavedRef = useRef<boolean>(false);
  const rewardClaimedRef = useRef<boolean>(false);
  const mutedRef = useRef<boolean>(false);
  mutedRef.current = muted;

  const amIHostRef = useRef<boolean>(true);
  amIHostRef.current = amIAuthoritativeHost;
  const myActiveSlotRef = useRef<PlayerSlot>('P1');
  myActiveSlotRef.current = myActiveSlot;
  const isPracticeRef = useRef<boolean>(false);
  isPracticeRef.current = isPracticeMatch;
  const aiDiffRef = useRef<AiDifficulty>('normal');
  aiDiffRef.current = aiDifficulty;
  const screenRef = useRef<ScreenPhase>(screen);
  screenRef.current = screen;
  const lobbyRef = useRef<ResolvedLobbyState>(lobbyState);
  lobbyRef.current = lobbyState;
  const slotClientMapRef = useRef<Partial<Record<PlayerSlot, string>>>({});

  // Touch virtual joystick refs
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const joyPointerIdRef = useRef<number | null>(null);
  const joyOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const pushAlert = useCallback(
    (kind: RoomAlertToast['kind'], message: string) => {
      const id = Date.now() + Math.random();
      setAlerts((prev) => [...prev.slice(-3), { id, kind, message }]);
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }, 4500);
    },
    []
  );

  // Persist nickname locally
  useEffect(() => {
    if (typeof window !== 'undefined' && nickname.trim()) {
      localStorage.setItem('pvb_nickname', nickname.trim());
    }
  }, [nickname]);

  // Claim 3D Arena daily GP bonus if applicable
  const claimArenaReward = useCallback(async () => {
    if (rewardClaimedRef.current || !currentUserId || currentUserId <= 0) return;
    rewardClaimedRef.current = true;
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, type: 'volleyball_win' }),
      });
      const data = await res.json();
      if (res.ok && data.earned > 0) {
        setRewardNotice(
          `🎁 โบนัสผู้ชนะ +${data.earned} 💰 GP! (${data.winsToday}/${data.dailyCap} รอบวันนี้)`
        );
        onRewardEarned?.(data.earned, data.points);
      } else if (res.ok && data.capReached) {
        setRewardNotice(
          `รับโบนัส GP ครบ ${data.dailyCap}/${data.dailyCap} รอบของวันนี้แล้ว (เล่นต่อได้ไม่จำกัด!)`
        );
      }
    } catch {
      // ignore
    }
  }, [currentUserId, onRewardEarned]);

  // Save finished online match ONCE by Host only
  const handleMatchFinished = useCallback(
    (st: MatchState, winner: TeamSide) => {
      setWinnerTeam(winner);
      playVolleyballSfx('win', mutedRef.current);

      const myTeam = getTeamForSlot(myActiveSlotRef.current);
      if (winner === myTeam) {
        confetti({ particleCount: 95, spread: 80, origin: { y: 0.55 } });
        if (!isPracticeRef.current) {
          void claimArenaReward();
        }
      }

      // Strictly Host-only single write to PostgreSQL (`match_history` & `player_stats`) for online rooms!
      if (amIHostRef.current && !isPracticeRef.current && !matchSavedRef.current && roomCode) {
        matchSavedRef.current = true;
        const winners = st.players
          .filter((p) => p.team === winner && !p.isBot)
          .map((p) => p.name);
        const losers = st.players
          .filter((p) => p.team !== winner && !p.isBot)
          .map((p) => p.name);
        const durationSeconds = Math.max(
          5,
          Math.round((Date.now() - matchStartedAtRef.current) / 1000)
        );

        void recordMatchResultByHost({
          matchUid: activeMatchUidRef.current || `${roomCode}-${Date.now()}`,
          roomCode,
          mode: st.mode,
          winningTeam: winner,
          winners,
          losers,
          scoreBlue: st.scoreBlue,
          scoreRed: st.scoreRed,
          durationSeconds,
          playerEntries: st.players.map((p) => ({
            name: p.name,
            skin: p.skin,
            won: p.team === winner,
            points: p.team === 'blue' ? st.scoreBlue : st.scoreRed,
            isBot: p.isBot,
          })),
        }).then(({ savedSupabase, savedLocal }) => {
          if (savedSupabase || savedLocal) {
            setDbSaveNotice(
              savedSupabase
                ? '💾 Host บันทึกสถิติลง Supabase Leaderboard เรียบร้อยแล้ว!'
                : '💾 Host บันทึกสถิติลงตารางอันดับเรียบร้อยแล้ว!'
            );
          }
        });
      }
    },
    [claimArenaReward, roomCode]
  );

  // Start a match from StartMatchPacket (called on both Host and Guests)
  const launchOnlineMatchFromPacket = useCallback(
    (pkt: StartMatchPacket) => {
      const validSlots = getActiveSlots(pkt.mode);
      const profiles: Partial<Record<PlayerSlot, SlotProfile>> = {};
      const clientMap: Partial<Record<PlayerSlot, string>> = {};
      let resolvedMySlot: PlayerSlot = 'P1';
      let resolvedHostSlot: PlayerSlot = 'P1';

      for (const s of validSlots) {
        const member = pkt.slots[s];
        if (member) {
          profiles[s] = {
            name: member.name,
            skin: member.skin,
            color: member.color,
            isBot: false,
          };
          clientMap[s] = member.clientId;
          if (member.clientId === clientIdRef.current) {
            resolvedMySlot = s;
          }
          if (member.clientId === pkt.hostClientId) {
            resolvedHostSlot = s;
          }
        } else {
          // Unfilled slot becomes smart AI partner/opponent
          const fallbackIdx = s === 'P1' ? 0 : s === 'P2' ? 1 : s === 'P3' ? 6 : 2;
          const aiSkin = CHIBI_SKINS[fallbackIdx];
          profiles[s] = {
            name: `AI ${aiSkin.name}`,
            skin: aiSkin.id,
            color: aiSkin.defaultColor,
            isBot: true,
          };
        }
      }

      slotClientMapRef.current = clientMap;
      const isMeHost = pkt.hostClientId === clientIdRef.current;
      setAmIAuthoritativeHost(isMeHost);
      amIHostRef.current = isMeHost;
      setIsPracticeMatch(false);
      isPracticeRef.current = false;
      setActiveMode(pkt.mode);
      setMyActiveSlot(resolvedMySlot);
      myActiveSlotRef.current = resolvedMySlot;
      setHostActiveSlot(resolvedHostSlot);

      activeMatchUidRef.current = pkt.matchUid;
      matchStartedAtRef.current = pkt.startedAt || Date.now();
      matchSavedRef.current = false;
      rewardClaimedRef.current = false;
      guestInputsBySlotRef.current = {};
      localInputRef.current = { ...EMPTY_PLAYER_INPUT };
      roomCtrlRef.current?.resetSentInputState();
      interpolatorRef.current.reset();

      matchStateRef.current = createMatchState(pkt.mode, profiles, 'blue', DEFAULT_WIN_SCORE);
      setScoreBlue(0);
      setScoreRed(0);
      setWinnerTeam(null);
      setPointBanner('');
      setRewardNotice('');
      setDbSaveNotice('');
      screenRef.current = 'playing';
      setScreen('playing');
    },
    []
  );

  // Broadcast lobby status to 3D Arena floating invite banner (if opened inside 3D Arena)
  const onLobbyBroadcastRef = useRef(onLobbyBroadcast);
  onLobbyBroadcastRef.current = onLobbyBroadcast;

  useEffect(() => {
    if (!onLobbyBroadcastRef.current || !roomCode) return;
    if (screen === 'lobby' && lobbyState.hostClientId === clientIdRef.current) {
      const max = lobbyState.mode === '2v2' ? 4 : 2;
      onLobbyBroadcastRef.current({
        roomCode,
        mode: lobbyState.mode,
        hostUserId: currentUserId || 0,
        hostName: nickname.trim() || 'เพื่อน',
        hostEmoji: getSkinEmoji(skin),
        targetName: invitedTargetName,
        count: lobbyState.onlinePlayers.length,
        max,
        status: 'waiting',
      });
    }
  }, [screen, roomCode, lobbyState, currentUserId, nickname, skin, invitedTargetName]);

  const resetMatchToTargetScreen = useCallback((target: 'home' | 'lobby') => {
    screenRef.current = target;
    isPracticeRef.current = false;
    activeMatchUidRef.current = '';
    matchStateRef.current = null;
    guestInputsBySlotRef.current = {};
    localInputRef.current = { ...EMPTY_PLAYER_INPUT };
    roomCtrlRef.current?.resetSentInputState();
    interpolatorRef.current.reset();
    if (target === 'lobby') {
      void roomCtrlRef.current?.updateMyPresence({ ready: false });
    }
    setIsPracticeMatch(false);
    setScoreBlue(0);
    setScoreRed(0);
    setWinnerTeam(null);
    setPointBanner('');
    setRewardNotice('');
    setDbSaveNotice('');
    setScreen(target);
  }, []);

  // Connect / Disconnect Supabase Realtime Presence Room when entering `lobby` or `playing` (online)
  useEffect(() => {
    const isOnlineRoomActive =
      Boolean(roomCode) && (screen === 'lobby' || screen === 'playing' || screen === 'leaderboard');
    if (!isOnlineRoomActive) {
      if (roomCtrlRef.current) {
        if (lobbyRef.current.hostClientId === clientIdRef.current && roomCode) {
          onLobbyBroadcastRef.current?.({
            roomCode,
            mode: lobbyRef.current.mode,
            hostUserId: currentUserId || 0,
            hostName: nickname.trim() || 'เพื่อน',
            hostEmoji: getSkinEmoji(skin),
            count: 0,
            max: lobbyRef.current.mode === '2v2' ? 4 : 2,
            status: 'closed',
          });
        }
        roomCtrlRef.current.destroy();
        roomCtrlRef.current = null;
      }
      return;
    }

    // Already connected to this exact roomCode -> keep existing Presence channel alive across lobby <-> playing!
    if (roomCtrlRef.current && roomCtrlRef.current.roomCode === roomCode) {
      return;
    }

    roomCtrlRef.current?.destroy();

    const initialSlot: PlayerSlot = 'P1';
    const ctrl = new VolleyballRoomController({
      roomCode,
      initialMode: preferredCreateMode,
      me: {
        clientId: clientIdRef.current,
        userId: currentUserId,
        name: nickname.trim() || 'ผู้เล่นปริศนา',
        skin,
        color: bodyColor,
        desiredSlot: initialSlot,
        ready: false,
        isCreator,
      },
      callbacks: {
        onLobbyChange: (nextLobby) => {
          setLobbyState(nextLobby);
          lobbyRef.current = nextLobby;
        },
        onPlayerDisconnected: (leftMember, migratedHostName) => {
          pushAlert(
            'warn',
            migratedHostName
              ? `⚠️ ${leftMember.name} (Host) หลุดออกจากห้อง! โอนสิทธิ์ Host ให้ 👑 ${migratedHostName} อัตโนมัติ`
              : `⚠️ ผู้เล่น ${leftMember.name} หลุดออกจากห้อง`
          );

          // If mid-match, convert disconnected player's slot into an AI stand-in so 2v2 never freezes!
          const st = matchStateRef.current;
          if (st && screenRef.current === 'playing') {
            for (const [slotKey, cid] of Object.entries(slotClientMapRef.current)) {
              if (cid === leftMember.clientId) {
                const pl = st.players.find((p) => p.slot === (slotKey as PlayerSlot));
                if (pl) {
                  pl.isBot = true;
                  pl.name = `${leftMember.name} (AI แทน)`;
                }
                delete guestInputsBySlotRef.current[slotKey as PlayerSlot];
              }
            }
          }
        },
        onHostMigrated: (newHostClientId, newHostName) => {
          const iAmNewHost = newHostClientId === clientIdRef.current;
          if (screenRef.current === 'playing') {
            interpolatorRef.current.reset();
            setAmIAuthoritativeHost(iAmNewHost);
            amIHostRef.current = iAmNewHost;
            for (const [slotKey, cid] of Object.entries(slotClientMapRef.current)) {
              if (cid === newHostClientId) {
                setHostActiveSlot(slotKey as PlayerSlot);
              }
            }
            if (iAmNewHost) {
              pushAlert(
                'info',
                `👑 คุณได้รับโอนสิทธิ์เป็น Host คำนวณฟิสิกส์ต่ออัตโนมัติ!`
              );
            } else {
              pushAlert('info', `👑 โอนสิทธิ์ Host ให้ ${newHostName} เรียบร้อย`);
            }
          }
        },
        onMatchStart: (pkt) => {
          if (isPracticeRef.current) return;
          launchOnlineMatchFromPacket(pkt);
        },
        onReturnToLobby: () => {
          if (isPracticeRef.current) return;
          resetMatchToTargetScreen('lobby');
        },
        onGuestInput: (pkt: GuestInputPacket) => {
          if (!amIHostRef.current || isPracticeRef.current) return;
          // Verify packet comes from the client assigned to that slot
          const expectedCid = slotClientMapRef.current[pkt.slot];
          if (!expectedCid || expectedCid === pkt.clientId) {
            guestInputsBySlotRef.current[pkt.slot] = pkt.inp;
          }
        },
        onStateSnapshot: (snap: NetStateSnapshot) => {
          if (amIHostRef.current || isPracticeRef.current || screenRef.current !== 'playing') return;
          const accepted = interpolatorRef.current.pushSnapshot(snap, performance.now());
          if (!accepted) return;

          setScoreBlue((prev) => (prev !== snap.sb ? snap.sb : prev));
          setScoreRed((prev) => (prev !== snap.sr ? snap.sr : prev));

          if (snap.ev) {
            if (snap.ev.spike) {
              playVolleyballSfx('spike', mutedRef.current);
              if (matchStateRef.current) matchStateRef.current.screenShake = 1.0;
            } else if (snap.ev.hit) {
              playVolleyballSfx('hit', mutedRef.current);
            }
            if (snap.ev.dive) {
              playVolleyballSfx('dive', mutedRef.current);
            }
            if (snap.ev.scored) {
              playVolleyballSfx('score', mutedRef.current);
              setPointBanner(
                snap.ev.scored === 'blue' ? '🔵 ทีมฟ้าได้แต้ม!' : '🔴 ทีมแดงได้แต้ม!'
              );
              setTimeout(() => setPointBanner(''), 1100);
            }
          }

          if (snap.ph === 'finished' && snap.w && matchStateRef.current) {
            setWinnerTeam((prev) => {
              if (prev !== snap.w && snap.w && matchStateRef.current) {
                matchStateRef.current.scoreBlue = snap.sb;
                matchStateRef.current.scoreRed = snap.sr;
                matchStateRef.current.winner = snap.w;
                matchStateRef.current.phase = 'finished';
                handleMatchFinished(matchStateRef.current, snap.w);
              }
              return snap.w;
            });
          }
        },
        onConnectionStatus: (_connected, transport) => {
          setTransportKind(transport);
        },
      },
    });

    ctrl.connect();
    roomCtrlRef.current = ctrl;
  }, [
    roomCode,
    screen,
    isCreator,
    preferredCreateMode,
    currentUserId,
    nickname,
    skin,
    bodyColor,
    pushAlert,
    launchOnlineMatchFromPacket,
    resetMatchToTargetScreen,
    handleMatchFinished,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      roomCtrlRef.current?.destroy();
      roomCtrlRef.current = null;
    };
  }, []);

  // Helper to apply local input change AND emit Event-Driven Guest Input ONLY on transition!
  const applyLocalInputPatch = useCallback((patch: Partial<PlayerInput>) => {
    const prev = localInputRef.current;
    const next: PlayerInput = { ...prev, ...patch };
    if (
      prev.left === next.left &&
      prev.right === next.right &&
      prev.jump === next.jump &&
      prev.down === next.down &&
      prev.action === next.action
    ) {
      return; // Ignore OS key-repeat! Zero duplicate packets sent!
    }
    localInputRef.current = next;

    // Event-Driven Guest Input: send ONLY on keydown/keyup state transition
    if (!isPracticeRef.current && !amIHostRef.current && roomCtrlRef.current) {
      roomCtrlRef.current.sendGuestInputOnChange(myActiveSlotRef.current, next);
    }
  }, []);

  // Keyboard Listeners (A/D or Left/Right, W or Up = Jump, S or Down = Steep Aim, Space/Enter = Dive / Power Spike)
  useEffect(() => {
    if (screen !== 'playing') return;

    const mapKeyToField = (code: string): keyof PlayerInput | null => {
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
        code === 'KeyZ'
      ) {
        return 'action';
      }
      return null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const field = mapKeyToField(e.code);
      if (!field) return;
      e.preventDefault();
      if (e.repeat) return; // Extra hardware repeat guard
      applyLocalInputPatch({ [field]: true });
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const field = mapKeyToField(e.code);
      if (!field) return;
      e.preventDefault();
      applyLocalInputPatch({ [field]: false });
    };

    const releaseAll = () => {
      applyLocalInputPatch({ ...EMPTY_PLAYER_INPUT });
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', releaseAll);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', releaseAll);
      localInputRef.current = { ...EMPTY_PLAYER_INPUT };
    };
  }, [screen, applyLocalInputPatch]);

  // Main 60 FPS HTML5 Canvas Loop (Host Authoritative 60FPS + 20Hz Broadcast | Guest 60FPS Lerp)
  useEffect(() => {
    if (screen !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const fx = new CanvasFxState();
    let rafId = 0;
    let lastPerfMs = performance.now();
    let physicsAccum = 0;
    let lastBroadcastPerfMs = 0;
    let netSeq = 0;
    let elapsedSec = 0;
    let pendingBroadcastEvents: GameEvents = {};

    const frame = (nowPerfMs: number) => {
      rafId = requestAnimationFrame(frame);
      const rawDt = Math.min(0.05, Math.max(0.001, (nowPerfMs - lastPerfMs) / 1000));
      lastPerfMs = nowPerfMs;
      elapsedSec += rawDt;

      const st = matchStateRef.current;
      if (!st) return;

      if (amIHostRef.current || isPracticeRef.current) {
        physicsAccum += rawDt;
        // Step deterministic 60 FPS physics ticks
        while (physicsAccum >= FIXED_DT) {
          physicsAccum -= FIXED_DT;
          const stepInputs: Partial<Record<PlayerSlot, PlayerInput>> = {};

          for (const p of st.players) {
            if (p.slot === myActiveSlotRef.current && !p.isBot) {
              stepInputs[p.slot] = localInputRef.current;
            } else if (p.isBot) {
              stepInputs[p.slot] = computeAiInput(st, p, aiDiffRef.current);
            } else {
              stepInputs[p.slot] = guestInputsBySlotRef.current[p.slot] || EMPTY_PLAYER_INPUT;
            }
          }

          const ev = stepGamePhysics(st, stepInputs, FIXED_DT);

          if (ev.spike) {
            playVolleyballSfx('spike', mutedRef.current);
            pendingBroadcastEvents.spike = true;
          } else if (ev.hit) {
            playVolleyballSfx('hit', mutedRef.current);
            pendingBroadcastEvents.hit = true;
          }
          if (ev.dive) {
            playVolleyballSfx('dive', mutedRef.current);
            pendingBroadcastEvents.dive = true;
          }
          if (ev.scored) {
            playVolleyballSfx('score', mutedRef.current);
            pendingBroadcastEvents.scored = ev.scored;
            setScoreBlue(st.scoreBlue);
            setScoreRed(st.scoreRed);
            setPointBanner(
              ev.scored === 'blue' ? '🔵 ทีมฟ้าได้แต้ม!' : '🔴 ทีมแดงได้แต้ม!'
            );
            setTimeout(() => setPointBanner(''), 1100);
          }
          if (ev.matchWon) {
            pendingBroadcastEvents.matchWon = ev.matchWon;
            handleMatchFinished(st, ev.matchWon);
          }
        }

        // Host Broadcasts at 20 Hz (every 50 ms) over Supabase Realtime Broadcast (NEVER DB!)
        if (!isPracticeRef.current && roomCtrlRef.current) {
          const urgentScoreOrWin = Boolean(
            pendingBroadcastEvents.scored || pendingBroadcastEvents.matchWon
          );
          if (
            urgentScoreOrWin ||
            nowPerfMs - lastBroadcastPerfMs >= HOST_BROADCAST_INTERVAL_MS
          ) {
            lastBroadcastPerfMs = nowPerfMs;
            netSeq += 1;
            const packet = packNetState(st, netSeq, pendingBroadcastEvents);
            roomCtrlRef.current.broadcastHostState(packet);
            pendingBroadcastEvents = {};
          }
        } else {
          pendingBroadcastEvents = {};
        }
      } else {
        // Guest: Smooth 60 FPS Client-Side Linear Interpolation (Lerp)
        interpolatorRef.current.applyInterpolated(st, nowPerfMs, rawDt);
      }

      fx.update(st, rawDt);
      renderVolleyballCanvas(ctx, canvas, st, fx, {
        mySlot: myActiveSlotRef.current,
        hostSlot: hostActiveSlot,
        timeSec: elapsedSec,
      });
    };

    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, [screen, hostActiveSlot, handleMatchFinished]);

  // --- User Actions ---
  const handleCreateRoom = () => {
    const cleanName = nickname.trim() || 'พิคาชูซ่า';
    setNickname(cleanName);
    const code = generateRoomCode();
    setIsPracticeMatch(false);
    setIsCreator(true);
    setRoomCode(code);
    setScreen('lobby');
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = joinCodeInput.replace(/\D/g, '').slice(0, 4);
    if (cleanedCode.length !== 4) {
      pushAlert('warn', 'กรุณากรอกรหัสห้องตัวเลข 4 หลักให้ครบครับ');
      return;
    }
    const cleanName = nickname.trim() || 'พิคาชูซ่า';
    setNickname(cleanName);
    setIsPracticeMatch(false);
    setIsCreator(false);
    setRoomCode(cleanedCode);
    setScreen('lobby');
  };

  const handleStartPractice = () => {
    const cleanName = nickname.trim() || 'พิคาชูซ่า';
    setNickname(cleanName);
    setIsPracticeMatch(true);
    isPracticeRef.current = true;
    setAmIAuthoritativeHost(true);
    amIHostRef.current = true;
    setActiveMode(practiceMode);
    setMyActiveSlot('P1');
    myActiveSlotRef.current = 'P1';
    setHostActiveSlot('P1');

    const profiles: Partial<Record<PlayerSlot, SlotProfile>> = {
      P1: { name: cleanName, skin, color: bodyColor, isBot: false },
      P2: { name: 'AI คู่หูต่ายซิ่ง', skin: 'bunny', color: '#38BDF8', isBot: true },
      P3: { name: 'AI จิ้งจอกไฟ', skin: 'fox', color: '#F97316', isBot: true },
      P4: { name: 'AI ชิบะจอมตบ', skin: 'shiba', color: '#FB7185', isBot: true },
    };

    matchStateRef.current = createMatchState(practiceMode, profiles, 'blue', DEFAULT_WIN_SCORE);
    localInputRef.current = { ...EMPTY_PLAYER_INPUT };
    setScoreBlue(0);
    setScoreRed(0);
    setWinnerTeam(null);
    setPointBanner('');
    setRewardNotice('');
    setDbSaveNotice('');
    screenRef.current = 'playing';
    setScreen('playing');
  };

  const handleHostStartOnlineMatch = (allowAiFill: boolean) => {
    if (lobbyState.hostClientId !== clientIdRef.current || !roomCtrlRef.current) return;
    if (!allowAiFill && !lobbyState.allReady) return;

    const pkt: StartMatchPacket = {
      matchUid: `${roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      mode: lobbyState.mode,
      hostClientId: clientIdRef.current,
      slots: lobbyState.slots,
      startedAt: Date.now(),
    };

    onLobbyBroadcastRef.current?.({
      roomCode,
      mode: lobbyState.mode,
      hostUserId: currentUserId || 0,
      hostName: nickname.trim() || 'เพื่อน',
      hostEmoji: getSkinEmoji(skin),
      count: lobbyState.onlinePlayers.length,
      max: lobbyState.mode === '2v2' ? 4 : 2,
      status: 'started',
    });

    roomCtrlRef.current.broadcastMatchStart(pkt);
    launchOnlineMatchFromPacket(pkt);
  };

  const handleRematch = () => {
    if (isPracticeMatch) {
      if (matchStateRef.current) {
        matchStateRef.current.scoreBlue = 0;
        matchStateRef.current.scoreRed = 0;
        matchStateRef.current.winner = null;
        resetForNextServe(matchStateRef.current, 'blue');
      }
      setScoreBlue(0);
      setScoreRed(0);
      setWinnerTeam(null);
      setPointBanner('');
      return;
    }

    if (amIAuthoritativeHost && roomCtrlRef.current) {
      const pkt: StartMatchPacket = {
        matchUid: `${roomCode}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        mode: activeMode,
        hostClientId: clientIdRef.current,
        slots: lobbyState.slots,
        startedAt: Date.now(),
      };
      roomCtrlRef.current.broadcastMatchStart(pkt);
      launchOnlineMatchFromPacket(pkt);
    }
  };

  const handleLeaveLobby = () => {
    roomCtrlRef.current?.destroy();
    roomCtrlRef.current = null;
    setRoomCode('');
    setWinnerTeam(null);
    setScreen('home');
  };

  // Virtual Joystick Touch Handlers
  const setJoyVisualOffset = (dx: number, dy: number) => {
    if (joyKnobRef.current) {
      joyKnobRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
    }
  };

  const onJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerIdRef.current = e.pointerId;
    joyOriginRef.current = { x: e.clientX, y: e.clientY };
    setJoyVisualOffset(0, 0);
  };

  const onJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - joyOriginRef.current.x;
    const dy = e.clientY - joyOriginRef.current.y;
    const dist = Math.hypot(dx, dy);
    const maxR = 38;
    const scale = dist > maxR ? maxR / dist : 1;
    setJoyVisualOffset(dx * scale, dy * scale);
    applyLocalInputPatch({
      left: dx < -12,
      right: dx > 12,
      down: dy > 16,
    });
  };

  const onJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerIdRef.current !== e.pointerId) return;
    joyPointerIdRef.current = null;
    setJoyVisualOffset(0, 0);
    applyLocalInputPatch({ left: false, right: false, down: false });
  };

  // Derived Lobby Values
  const amILobbyHost = lobbyState.hostClientId === clientIdRef.current;
  const myLobbySlot = useMemo<PlayerSlot | null>(() => {
    for (const [s, m] of Object.entries(lobbyState.slots)) {
      if (m?.clientId === clientIdRef.current) return s as PlayerSlot;
    }
    return null;
  }, [lobbyState.slots]);

  const myPresenceObj = useMemo(
    () => lobbyState.onlinePlayers.find((p) => p.clientId === clientIdRef.current),
    [lobbyState.onlinePlayers]
  );

  const nonHostGuestsReady = useMemo(() => {
    return lobbyState.onlinePlayers.every(
      (p) => p.clientId === lobbyState.hostClientId || p.ready
    );
  }, [lobbyState.onlinePlayers, lobbyState.hostClientId]);

  const isDeuce = scoreBlue >= DEFAULT_WIN_SCORE - 1 && scoreRed >= DEFAULT_WIN_SCORE - 1;
  const myTeamSide = getTeamForSlot(myActiveSlot);

  return (
    <div
      className={`${
        embeddedModal ? 'fixed inset-0 z-50' : 'min-h-dvh w-full'
      } bg-gradient-to-b from-sky-950 via-slate-950 to-indigo-950 text-white flex flex-col overflow-y-auto select-none`}
    >
      {/* Floating Presence Disconnect / Host Migration Toasts */}
      {alerts.length > 0 && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[92vw] max-w-md pointer-events-none">
          {alerts.map((al) => (
            <div
              key={al.id}
              className={`px-4 py-2.5 rounded-2xl border-2 text-xs sm:text-sm font-extrabold shadow-2xl text-center ${
                al.kind === 'warn'
                  ? 'bg-rose-950/95 border-rose-400 text-rose-100'
                  : al.kind === 'info'
                    ? 'bg-amber-950/95 border-amber-400 text-amber-100'
                    : 'bg-emerald-950/95 border-emerald-400 text-emerald-100'
              }`}
            >
              {al.message}
            </div>
          ))}
        </div>
      )}

      {/* ==================== 1. HOME / CHARACTER & MODE SCREEN ==================== */}
      {screen === 'home' && (
        <div className="flex-1 flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-4xl bg-slate-900/90 border-2 border-amber-400/70 rounded-3xl p-4 sm:p-7 shadow-2xl space-y-6 relative">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-4 right-4 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 border border-amber-200 text-xs font-black cursor-pointer"
              >
                ✕ ปิด
              </button>
            )}

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 pr-16">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 border-2 border-white flex items-center justify-center text-3xl shadow-lg">
                  🏐
                </div>
                <div>
                  <h1 className="font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-black text-amber-300 leading-tight">
                    Pikachu Chibi Volleyball 2D
                  </h1>
                  <p className="text-xs sm:text-sm text-sky-200/90 font-semibold">
                    วอลเลย์บอลชายหาดฟิสิกส์เด้งดึ๋ง 1v1 & 2v2 • แข่งถึง 15 แต้ม (Win-by-2)
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setScreen('leaderboard')}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:brightness-105 text-slate-950 font-black text-xs sm:text-sm shadow-lg cursor-pointer"
              >
                🏆 ตารางอันดับ (Leaderboard)
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Nickname + Chibi Animal Skin & Color */}
              <div className="lg:col-span-5 bg-slate-950/80 border border-sky-400/35 rounded-2xl p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-[family-name:var(--font-kanit)] text-base font-extrabold text-sky-300">
                    1. ตั้งชื่อ & เลือกสัตว์จิ๋ว Chibi
                  </h2>
                  <div
                    className="px-3 py-1 rounded-full border-2 border-white text-slate-950 font-black text-xs flex items-center gap-1.5 shadow"
                    style={{ backgroundColor: bodyColor }}
                  >
                    <span>{getSkinEmoji(skin)}</span>
                    <span className="truncate max-w-[96px]">{nickname || 'ผู้เล่น'}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    ชื่อเล่นบนหัวตัวละคร
                  </label>
                  <input
                    type="text"
                    maxLength={16}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="กรอกชื่อเล่น..."
                    className="w-full rounded-xl bg-slate-900 border-2 border-sky-400/60 focus:border-amber-300 outline-none px-3.5 py-2 text-sm font-extrabold text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    เลือกสกินสัตว์จิ๋ว
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {CHIBI_SKINS.map((opt) => {
                      const active = skin === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setSkin(opt.id);
                            setBodyColor(opt.defaultColor);
                          }}
                          className={`rounded-xl p-2 border-2 flex flex-col items-center gap-0.5 transition cursor-pointer ${
                            active
                              ? 'bg-amber-400/20 border-amber-300 scale-[1.03]'
                              : 'bg-slate-900 border-slate-700 hover:border-slate-500'
                          }`}
                        >
                          <span className="text-xl">{opt.emoji}</span>
                          <span className="text-[10px] font-bold text-slate-200 truncate w-full text-center">
                            {opt.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    สีตัวละคร
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_COLOR_PALETTE.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setBodyColor(hex)}
                        style={{ backgroundColor: hex }}
                        className={`w-8 h-8 rounded-full border-2 transition cursor-pointer ${
                          bodyColor === hex
                            ? 'border-white ring-2 ring-amber-300 scale-110'
                            : 'border-slate-800 opacity-85 hover:opacity-100'
                        }`}
                        title={hex}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Online Create/Join Room + Local Practice vs AI */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                {/* Online Multiplayer Card */}
                <div className="bg-slate-950/80 border border-amber-400/45 rounded-2xl p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-[family-name:var(--font-kanit)] text-base font-extrabold text-amber-300">
                      2. เล่นออนไลน์กับเพื่อน (1v1 / 2v2 สูงสุด 4 คน)
                    </h2>
                    <span
                      className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                        isSupabaseConfigured()
                          ? 'bg-emerald-950 border-emerald-400 text-emerald-300'
                          : 'bg-amber-950 border-amber-400 text-amber-200'
                      }`}
                    >
                      {isSupabaseConfigured()
                        ? '🟢 Supabase Realtime พร้อมใช้งาน'
                        : '🟡 โหมดทดสอบหลายแท็บ (ยังไม่ตั้ง .env)'}
                    </span>
                  </div>

                  {/* Create Room */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-3 space-y-2.5">
                      <div className="text-xs font-extrabold text-sky-200">
                        🏠 สร้างห้องใหม่ (สุ่มรหัส 4 หลัก)
                      </div>
                      <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                        {(['1v1', '2v2'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPreferredCreateMode(m)}
                            className={`flex-1 py-1.5 rounded-md text-xs font-black cursor-pointer transition ${
                              preferredCreateMode === m
                                ? 'bg-amber-400 text-slate-950'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {m === '1v1' ? '⚔️ 1 vs 1' : '👥 2 vs 2'}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={handleCreateRoom}
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:brightness-105 text-slate-950 font-[family-name:var(--font-kanit)] font-black text-sm shadow cursor-pointer"
                      >
                        + สร้างห้อง (Create Room)
                      </button>
                    </div>

                    {/* Join Room */}
                    <form
                      onSubmit={handleJoinRoom}
                      className="bg-slate-900/90 border border-slate-700 rounded-xl p-3 space-y-2.5 flex flex-col justify-between"
                    >
                      <div className="text-xs font-extrabold text-rose-200">
                        🔑 เข้าห้องเพื่อนด้วยรหัส 4 หลัก
                      </div>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={4}
                        value={joinCodeInput}
                        onChange={(e) =>
                          setJoinCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))
                        }
                        placeholder="เช่น 4829"
                        className="w-full rounded-lg bg-slate-950 border-2 border-rose-400/60 focus:border-amber-300 outline-none py-1.5 px-3 text-center font-[family-name:var(--font-kanit)] text-lg font-black tracking-[0.25em] text-amber-300"
                      />
                      <button
                        type="submit"
                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:brightness-110 text-white font-[family-name:var(--font-kanit)] font-black text-sm shadow cursor-pointer"
                      >
                        เข้าห้อง (Join Room) →
                      </button>
                    </form>
                  </div>
                </div>

                {/* Solo Practice / Local vs AI Card */}
                <div className="bg-gradient-to-r from-emerald-950/85 via-teal-950/80 to-slate-950/90 border border-emerald-400/50 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="font-[family-name:var(--font-kanit)] text-base font-extrabold text-emerald-300">
                        3. โหมดซ้อมคนเดียว (Practice / Local vs AI)
                      </h2>
                      <p className="text-[11px] text-emerald-100/80 font-semibold">
                        ทดสอบฟิสิกส์เด้งดึ๋ง พุ่งรับ และกระโดดตบลูกไฟได้ทันที ไม่ต้องรอคนครบ!
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="flex gap-1 bg-slate-950/80 p-1 rounded-xl border border-emerald-500/30">
                      {(['1v1', '2v2'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPracticeMode(m)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                            practiceMode === m
                              ? 'bg-emerald-400 text-slate-950'
                              : 'text-emerald-200/75 hover:text-white'
                          }`}
                        >
                          {m === '1v1' ? '🤖 ซ้อม 1v1' : '🤖 ซ้อม 2v2'}
                        </button>
                      ))}
                    </div>

                    <div className="flex gap-1 bg-slate-950/80 p-1 rounded-xl border border-emerald-500/30">
                      {(
                        [
                          { id: 'easy', label: 'ชิลๆ' },
                          { id: 'normal', label: 'ปกติ' },
                          { id: 'hard', label: 'บอสโหด' },
                        ] as const
                      ).map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setAiDifficulty(d.id)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                            aiDifficulty === d.id
                              ? 'bg-amber-300 text-slate-950'
                              : 'text-emerald-200/75 hover:text-white'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartPractice}
                    className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-[family-name:var(--font-kanit)] font-black text-sm shadow-lg cursor-pointer"
                  >
                    ⚡ เริ่มซ้อมตบกับ AI ทันที!
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Controls Guide Footer */}
            <div className="bg-slate-950/75 border border-slate-800 rounded-2xl px-4 py-2.5 text-xs text-slate-300 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-semibold">
              <span>🎮 บังคับ: <strong className="text-amber-300">A / D</strong> หรือ <strong className="text-amber-300">◀ / ▶</strong> เดิน</span>
              <span>• <strong className="text-sky-300">W</strong> หรือ <strong className="text-sky-300">▲</strong> กระโดด</span>
              <span>• <strong className="text-emerald-300">Space / Enter</strong> (บนพื้น) = พุ่งรับลูก (Dive)</span>
              <span>• <strong className="text-rose-400">Space / Enter + ทิศทาง</strong> (กลางอากาศ) = ตบลูกไฟสีแดง (Power Spike!)</span>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 2. SUPABASE PRESENCE LOBBY SCREEN ==================== */}
      {screen === 'lobby' && (
        <div className="flex-1 flex items-center justify-center p-3 sm:p-6">
          <div className="w-full max-w-3xl bg-slate-900/95 border-2 border-amber-400/75 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-5">
            {/* Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleLeaveLobby}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-extrabold text-slate-200 cursor-pointer"
                >
                  ← หน้าเมนู / ซ้อม AI
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-[family-name:var(--font-kanit)] text-lg sm:text-xl font-black text-amber-300">
                      ห้องรอแข่งขัน (Lobby)
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-950 border border-emerald-400 text-emerald-300">
                      {transportKind === 'supabase' ? '🟢 Presence Live' : '🟡 Local Tab Sync'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 font-semibold">
                    เลือกสล็อตทีมฟ้า (P1, P2) หรือทีมแดง (P3, P4) แล้วกด Ready!
                  </p>
                </div>
              </div>

              {/* 4-Digit Room Code Badge + Quick Island Court Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                {embeddedModal && (roomCode === '7777' || roomCode === '8888') && (
                  <div className="flex items-center gap-1 bg-slate-950 border border-sky-400/50 rounded-xl p-1">
                    {(
                      [
                        { code: '7777', label: '🏝️ คอร์ท 1' },
                        { code: '8888', label: '🏖️ คอร์ท 2' },
                      ] as const
                    ).map((ct) => (
                      <button
                        key={ct.code}
                        type="button"
                        onClick={() => {
                          if (roomCode === ct.code) return;
                          roomCtrlRef.current?.destroy();
                          roomCtrlRef.current = null;
                          setIsCreator(false);
                          setRoomCode(ct.code);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black cursor-pointer transition ${
                          roomCode === ct.code
                            ? 'bg-sky-400 text-slate-950'
                            : 'text-sky-200/75 hover:text-white'
                        }`}
                      >
                        {ct.label}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2 bg-slate-950 border-2 border-amber-400 rounded-2xl px-3.5 py-1.5">
                  <span className="text-xs text-slate-400 font-bold">รหัสห้อง:</span>
                  <span className="font-[family-name:var(--font-kanit)] text-xl font-black tracking-widest text-amber-300">
                    {roomCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(roomCode);
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 1800);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black cursor-pointer"
                  >
                    {copiedCode ? 'คัดลอกแล้ว ✓' : '📋 คัดลอก'}
                  </button>
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      className="ml-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-black cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 1v1 / 2v2 Mode Switcher (Host controls, Guests see live) */}
            <div className="bg-slate-950/90 border border-slate-700 rounded-2xl p-1.5 flex gap-2">
              {(
                [
                  { id: '1v1', label: '⚔️ โหมด 1 vs 1 (2 คน: P1 vs P3)' },
                  { id: '2v2', label: '👥 โหมด 2 vs 2 (4 คน: P1,P2 vs P3,P4)' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!amILobbyHost}
                  onClick={() => roomCtrlRef.current?.setRoomMode(opt.id)}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-black transition cursor-pointer disabled:cursor-default ${
                    lobbyState.mode === opt.id
                      ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-white disabled:hover:text-slate-400'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Team Slots Grid: Left Blue Team (P1, P2) vs Right Red Team (P3, P4) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Blue Team */}
              <div className="bg-blue-950/45 border-2 border-blue-400/70 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-kanit)] text-sm sm:text-base font-black text-sky-300">
                    🔵 ทีมซ้ายสีฟ้า (Blue Team)
                  </span>
                  <span className="text-[11px] font-bold text-sky-200/80">ผ้าคาดหัวสีฟ้า</span>
                </div>

                {(lobbyState.mode === '2v2'
                  ? (['P1', 'P2'] as PlayerSlot[])
                  : (['P1'] as PlayerSlot[])
                ).map((slot) => {
                  const occ = lobbyState.slots[slot];
                  const isMe = occ?.clientId === clientIdRef.current;
                  const isSlotHost = occ?.clientId === lobbyState.hostClientId;
                  return (
                    <div
                      key={slot}
                      className={`rounded-xl p-3 border-2 flex items-center justify-between gap-2 transition ${
                        occ
                          ? isMe
                            ? 'bg-blue-600/35 border-amber-300'
                            : 'bg-slate-900/90 border-blue-400/60'
                          : 'bg-slate-950/65 border-dashed border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-1 rounded-lg bg-blue-500 text-white text-xs font-black shrink-0">
                          {slot}
                        </span>
                        {occ ? (
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-white truncate flex items-center gap-1.5">
                              <span>{getSkinEmoji(occ.skin)}</span>
                              <span className="truncate">{occ.name}</span>
                              {isMe && (
                                <span className="text-[10px] text-amber-300 font-black">(คุณ)</span>
                              )}
                              {isSlotHost && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
                                  👑 HOST
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-bold">
                              {isSlotHost || occ.ready ? (
                                <span className="text-emerald-300">✅ พร้อมแล้ว (Ready)</span>
                              ) : (
                                <span className="text-amber-300">⏳ รอกดพร้อม...</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-bold">ว่าง — กดเลือกสล็อตนี้ได้</span>
                        )}
                      </div>

                      {!occ && myLobbySlot !== slot && (
                        <button
                          type="button"
                          onClick={() =>
                            void roomCtrlRef.current?.updateMyPresence({
                              desiredSlot: slot,
                              ready: amILobbyHost,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white text-xs font-black shrink-0 cursor-pointer"
                        >
                          เลือก {slot}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Red Team */}
              <div className="bg-rose-950/45 border-2 border-rose-400/70 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-[family-name:var(--font-kanit)] text-sm sm:text-base font-black text-rose-300">
                    🔴 ทีมขวาสีแดง (Red Team)
                  </span>
                  <span className="text-[11px] font-bold text-rose-200/80">ผ้าคาดหัวสีแดง</span>
                </div>

                {(lobbyState.mode === '2v2'
                  ? (['P3', 'P4'] as PlayerSlot[])
                  : (['P3'] as PlayerSlot[])
                ).map((slot) => {
                  const occ = lobbyState.slots[slot];
                  const isMe = occ?.clientId === clientIdRef.current;
                  const isSlotHost = occ?.clientId === lobbyState.hostClientId;
                  return (
                    <div
                      key={slot}
                      className={`rounded-xl p-3 border-2 flex items-center justify-between gap-2 transition ${
                        occ
                          ? isMe
                            ? 'bg-rose-600/35 border-amber-300'
                            : 'bg-slate-900/90 border-rose-400/60'
                          : 'bg-slate-950/65 border-dashed border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="px-2 py-1 rounded-lg bg-rose-500 text-white text-xs font-black shrink-0">
                          {slot}
                        </span>
                        {occ ? (
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-white truncate flex items-center gap-1.5">
                              <span>{getSkinEmoji(occ.skin)}</span>
                              <span className="truncate">{occ.name}</span>
                              {isMe && (
                                <span className="text-[10px] text-amber-300 font-black">(คุณ)</span>
                              )}
                              {isSlotHost && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black">
                                  👑 HOST
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] font-bold">
                              {isSlotHost || occ.ready ? (
                                <span className="text-emerald-300">✅ พร้อมแล้ว (Ready)</span>
                              ) : (
                                <span className="text-amber-300">⏳ รอกดพร้อม...</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-bold">ว่าง — กดเลือกสล็อตนี้ได้</span>
                        )}
                      </div>

                      {!occ && myLobbySlot !== slot && (
                        <button
                          type="button"
                          onClick={() =>
                            void roomCtrlRef.current?.updateMyPresence({
                              desiredSlot: slot,
                              ready: amILobbyHost,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-black shrink-0 cursor-pointer"
                        >
                          เลือก {slot}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Online Presence Roster */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-extrabold text-slate-400">
                  🟢 ออนไลน์ในห้อง ({lobbyState.onlinePlayers.length} คน):
                </span>
                {lobbyState.onlinePlayers.map((p) => (
                  <span
                    key={p.clientId}
                    className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 font-bold text-slate-200 flex items-center gap-1"
                  >
                    <span>{getSkinEmoji(p.skin)}</span>
                    <span>{p.name}</span>
                    {p.clientId === lobbyState.hostClientId && <span>👑</span>}
                  </span>
                ))}
              </div>
            </div>

            {/* Ready / Start Controls */}
            <div className="flex flex-col sm:flex-row gap-3">
              {!amILobbyHost ? (
                <button
                  type="button"
                  onClick={() =>
                    void roomCtrlRef.current?.updateMyPresence({
                      ready: !myPresenceObj?.ready,
                    })
                  }
                  className={`w-full py-3.5 rounded-2xl font-[family-name:var(--font-kanit)] text-base font-black shadow-lg cursor-pointer transition ${
                    myPresenceObj?.ready
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                      : 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  }`}
                >
                  {myPresenceObj?.ready
                    ? '✅ พร้อมแล้ว! (คลิกหากต้องการยกเลิกพร้อม)'
                    : '✋ กดพร้อมแข่งขัน (READY!)'}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={!lobbyState.allReady}
                    onClick={() => handleHostStartOnlineMatch(false)}
                    className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-orange-400 hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-[family-name:var(--font-kanit)] text-base font-black shadow-lg cursor-pointer"
                  >
                    {lobbyState.allReady
                      ? `🏐 เริ่มแข่งขัน ${lobbyState.mode.toUpperCase()} เลย!`
                      : lobbyState.allSlotsFilled
                        ? '⏳ รอผู้เล่นทุกคนกด Ready...'
                        : `⏳ รอผู้เล่นเข้าสล็อตให้ครบ (${Object.keys(lobbyState.slots).length}/${
                            lobbyState.mode === '2v2' ? 4 : 2
                          })`}
                  </button>

                  {!lobbyState.allSlotsFilled && nonHostGuestsReady && (
                    <button
                      type="button"
                      onClick={() => handleHostStartOnlineMatch(true)}
                      className="sm:w-auto px-4 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm cursor-pointer"
                      title="เติมบอท AI ลงในช่องที่ยังว่างแล้วเริ่มทันที"
                    >
                      🤖 เติม AI ช่องว่าง & เริ่มเลย
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== 3. 2D HTML5 CANVAS GAMEPLAY SCREEN ==================== */}
      {screen === 'playing' && (
        <div className="flex-1 flex flex-col items-center justify-between p-2 sm:p-4 relative overflow-hidden">
          {/* Top Scoreboard HUD */}
          <div className="w-full max-w-[1100px] flex items-center justify-between gap-2 z-20 mb-1.5">
            <button
              type="button"
              onClick={() => {
                if (isPracticeMatch) {
                  resetMatchToTargetScreen(roomCode ? 'lobby' : 'home');
                } else if (amIAuthoritativeHost && roomCtrlRef.current) {
                  roomCtrlRef.current.broadcastReturnToLobby();
                  resetMatchToTargetScreen('lobby');
                } else {
                  handleLeaveLobby();
                }
              }}
              className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-rose-600 border border-slate-600 text-xs font-extrabold text-white cursor-pointer"
            >
              ← {isPracticeMatch ? (roomCode ? 'กลับห้องรอ' : 'ออกโหมดซ้อม') : amIAuthoritativeHost ? 'กลับห้องรอ' : 'ออกจากห้อง'}
            </button>

            {/* Center Scoreboard */}
            <div className="bg-slate-900/95 border-2 border-amber-400 rounded-2xl px-4 sm:px-6 py-1.5 flex items-center gap-3 sm:gap-5 shadow-xl">
              <div className="text-right">
                <div className="text-[10px] sm:text-xs font-black text-sky-300">🔵 ทีมฟ้า</div>
                <div className="text-[10px] text-slate-400 hidden sm:block">P1{activeMode === '2v2' ? ' • P2' : ''}</div>
              </div>

              <div className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-2xl sm:text-3xl font-black">
                <span className="px-3 py-0.5 rounded-xl bg-blue-600 text-white min-w-[42px] text-center">
                  {scoreBlue}
                </span>
                <span className="text-amber-300 text-lg">:</span>
                <span className="px-3 py-0.5 rounded-xl bg-rose-600 text-white min-w-[42px] text-center">
                  {scoreRed}
                </span>
              </div>

              <div className="text-left">
                <div className="text-[10px] sm:text-xs font-black text-rose-300">🔴 ทีมแดง</div>
                <div className="text-[10px] text-slate-400 hidden sm:block">P3{activeMode === '2v2' ? ' • P4' : ''}</div>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5">
              <span className="hidden md:inline-block px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-[11px] font-extrabold text-amber-300">
                {isPracticeMatch ? `🤖 ซ้อม ${activeMode}` : `ห้อง #${roomCode} • ${myActiveSlot}`}
              </span>
              <button
                type="button"
                onClick={() => setShowTouchPad((v) => !v)}
                className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold cursor-pointer ${
                  showTouchPad
                    ? 'bg-amber-400 text-slate-950 border-white'
                    : 'bg-slate-900/90 text-slate-200 border-slate-700'
                }`}
                title="เปิด/ปิดปุ่มสัมผัสบนจอ"
              >
                🕹️
              </button>
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-700 text-xs font-extrabold cursor-pointer"
                title="เปิด/ปิดเสียง"
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>

          {/* Sub-banner: 15 pts Win-by-2 & Deuce */}
          <div className="text-[11px] font-extrabold text-sky-200/90 mb-1 flex items-center gap-2">
            <span>🏁 แข่งถึง {DEFAULT_WIN_SCORE} แต้ม (Win-by-2)</span>
            {isDeuce && (
              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white animate-pulse">
                🔥 DEUCE! ต้องห่าง 2 แต้ม!
              </span>
            )}
          </div>

          {/* Responsive 1100 x 600 HTML5 Canvas Stage */}
          <div className="relative w-full max-w-[1100px] flex-1 flex items-center justify-center min-h-0">
            <div className="relative w-full aspect-[11/6] max-h-[76dvh] rounded-2xl overflow-hidden border-3 border-amber-300/80 shadow-2xl bg-sky-400">
              <canvas
                ref={canvasRef}
                width={COURT_WIDTH}
                height={COURT_HEIGHT}
                className="w-full h-full block touch-none"
              />

              {/* Point Scored Floating Banner */}
              {pointBanner && !winnerTeam && (
                <div className="absolute top-5 left-1/2 -translate-x-1/2 pointer-events-none">
                  <div className="px-5 py-2 rounded-full bg-slate-950/90 border-2 border-amber-300 font-[family-name:var(--font-kanit)] text-base sm:text-xl font-black text-amber-300 shadow-2xl animate-bounce">
                    {pointBanner}
                  </div>
                </div>
              )}

              {/* End of Match Overlay */}
              {winnerTeam && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-30">
                  <div className="w-full max-w-md bg-slate-900 border-2 border-amber-400 rounded-3xl p-5 text-center space-y-3.5 shadow-2xl">
                    <div className="text-4xl">
                      {winnerTeam === myTeamSide ? '🏆🎉' : '👏🏐'}
                    </div>
                    <h3 className="font-[family-name:var(--font-kanit)] text-2xl font-black text-amber-300">
                      {winnerTeam === 'blue' ? '🔵 ทีมซ้ายสีฟ้าชนะ!' : '🔴 ทีมขวาสีแดงชนะ!'}
                    </h3>
                    <div className="font-[family-name:var(--font-kanit)] text-3xl font-black">
                      <span className="text-sky-400">{scoreBlue}</span>
                      <span className="text-slate-500 mx-2">-</span>
                      <span className="text-rose-400">{scoreRed}</span>
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
                      {isPracticeMatch || amIAuthoritativeHost ? (
                        <button
                          type="button"
                          onClick={handleRematch}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-slate-950 font-black text-sm cursor-pointer"
                        >
                          🔄 แข่งอีกรอบ (Rematch!)
                        </button>
                      ) : (
                        <div className="text-xs font-bold text-amber-200/85 py-1">
                          รอ Host กดเริ่มรอบใหม่...
                        </div>
                      )}

                      {!isPracticeMatch && amIAuthoritativeHost && (
                        <button
                          type="button"
                          onClick={() => {
                            roomCtrlRef.current?.broadcastReturnToLobby();
                            resetMatchToTargetScreen('lobby');
                          }}
                          className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-extrabold text-white cursor-pointer"
                        >
                          🏠 พาทุกคนกลับห้องรอ (Lobby)
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setWinnerTeam(null);
                          setScreen('leaderboard');
                        }}
                        className="w-full py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-xs font-extrabold text-white cursor-pointer"
                      >
                        🏆 ดูตารางอันดับ (Leaderboard)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Desktop Controls Hint Bar */}
          {!showTouchPad && (
            <div className="mt-1.5 px-4 py-1 rounded-full bg-slate-900/85 border border-slate-800 text-[11px] text-slate-300 font-bold hidden sm:flex items-center gap-4">
              <span>◀ ▶ / A,D เดิน</span>
              <span>▲ / W กระโดด</span>
              <span>Space / Enter (พื้น) = พุ่งรับลูก</span>
              <span>Space / Enter + ทิศทาง (อากาศ) = 🔥 ตบลูกไฟ!</span>
            </div>
          )}

          {/* Mobile / Tablet Touch Controls */}
          {showTouchPad && !winnerTeam && (
            <div className="w-full max-w-[1100px] flex items-end justify-between px-2 pt-2 pb-safe z-30">
              <div
                onPointerDown={onJoyDown}
                onPointerMove={onJoyMove}
                onPointerUp={onJoyUp}
                onPointerCancel={onJoyUp}
                className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-slate-900/80 border-2 border-amber-300 flex items-center justify-center touch-none"
              >
                <span className="absolute left-2 text-xs text-amber-300 font-black">◀</span>
                <span className="absolute right-2 text-xs text-amber-300 font-black">▶</span>
                <span className="absolute bottom-1 text-[9px] text-rose-300 font-black">▼กดตบ</span>
                <div
                  ref={joyKnobRef}
                  className="w-11 h-11 rounded-full bg-amber-400 border-2 border-white shadow flex items-center justify-center text-slate-950 font-black pointer-events-none"
                >
                  🕹️
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    applyLocalInputPatch({ action: true });
                  }}
                  onPointerUp={() => applyLocalInputPatch({ action: false })}
                  onPointerCancel={() => applyLocalInputPatch({ action: false })}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-orange-500 to-rose-600 border-2 border-amber-200 text-white font-black flex flex-col items-center justify-center shadow-xl touch-none"
                >
                  <span className="text-xl leading-none">🔥</span>
                  <span className="text-[10px] mt-0.5">ตบ/พุ่ง</span>
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    applyLocalInputPatch({ jump: true });
                  }}
                  onPointerUp={() => applyLocalInputPatch({ jump: false })}
                  onPointerCancel={() => applyLocalInputPatch({ jump: false })}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-b from-sky-500 to-blue-700 border-2 border-white text-white font-black flex flex-col items-center justify-center shadow-xl touch-none"
                >
                  <span className="text-xl leading-none">⬆️</span>
                  <span className="text-[10px] mt-0.5">กระโดด</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================== 4. LEADERBOARD SCREEN ==================== */}
      {screen === 'leaderboard' && (
        <div className="flex-1 flex items-center justify-center">
          <LeaderboardPanel
            standaloneLink
            onBack={() => setScreen(roomCode && !isPracticeMatch ? 'lobby' : 'home')}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Modal wrapper used inside the 3D Weight-Loss Arena (`app/page.tsx`).
 */
export function BeachVolleyballModal({
  isOpen,
  onClose,
  players,
  currentUserId,
  initialRoomCode,
  initialMode,
  initialIsHost,
  invitedTargetName,
  onLobbyBroadcast,
  onRewardEarned,
}: BeachVolleyballModalProps) {
  if (!isOpen) return null;

  const me = players.find((p) => p.id === currentUserId) || players[0];
  const defaultSkin = mapEmojiToChibiSkin(me?.emoji);
  const defaultColor = me?.colorHex || '#FACC15';

  return (
    <PikachuVolleyballGame
      embeddedModal
      onClose={onClose}
      defaultNickname={me?.name || 'นักตบชายหาด'}
      defaultSkin={defaultSkin}
      defaultColor={defaultColor}
      currentUserId={currentUserId}
      autoRoomCode={initialRoomCode || undefined}
      autoMode={initialMode}
      autoIsCreator={initialIsHost}
      invitedTargetName={invitedTargetName}
      onLobbyBroadcast={onLobbyBroadcast}
      onRewardEarned={onRewardEarned}
    />
  );
}
