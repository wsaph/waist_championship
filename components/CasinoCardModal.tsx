'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type { VolleyballPlayerSummary } from '@/components/BeachVolleyballModal';
import {
  createShuffledDeck,
  createOldMaidDeck,
  discardOldMaidPairs,
  evaluatePokDengHand,
  comparePokDeng,
  evaluateBlackjackHand,
  compareBlackjack,
  evaluateTexasHoldem7,
  resolveGuardMood,
  playCasinoSound,
  rankLabel,
  SUIT_SYMBOL,
  SUIT_IS_RED,
  OLD_MAID_CARD_ID,
  type CasinoGameType,
  type PlayingCard,
  type GuardMoodMeta,
} from '@/lib/casino_cards_engine';

export interface CardLobbyBroadcastInfo {
  roomCode: string;
  gameType: CasinoGameType;
  hostUserId: number;
  hostName: string;
  hostEmoji: string;
  targetName?: string;
  count: number;
  max: number;
  status: 'waiting' | 'started' | 'closed';
}

interface CasinoCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: VolleyballPlayerSummary[];
  currentUserId: number | null;
  currentUserPoints: number;
  initialRoomCode: string;
  initialIsHost: boolean;
  invitedTargetName?: string;
  onLobbyBroadcast?: (info: CardLobbyBroadcastInfo) => void;
  onPointsUpdated?: () => void;
}

type SeatId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
const SEAT_ORDER: SeatId[] = ['S1', 'S2', 'S3', 'S4', 'S5'];
const CHIP_OPTIONS = [5, 10, 20, 50] as const;

interface TableMember {
  clientId: string;
  seatId: SeatId;
  userId: number;
  name: string;
  emoji: string;
}

interface SeatRoundState {
  seatId: SeatId;
  userId: number;
  name: string;
  emoji: string;
  bet: number;
  ready: boolean;
  cards: PlayingCard[];
  done: boolean;
  folded?: boolean;
  safe?: boolean; // Old Maid survivor
  roundBet?: number; // Hold'em street bet
  deltaGp?: number;
  resultLabel?: string;
}

interface CasinoRoundState {
  gameType: CasinoGameType;
  phase: 'betting' | 'playing' | 'settled';
  street?: 'preflop' | 'flop' | 'turn' | 'river'; // Hold'em
  pot?: number; // Hold'em
  currentBet?: number; // Hold'em
  turnIndex?: number; // Hold'em / Old Maid
  oldMaidStake?: number;
  deck: PlayingCard[];
  community: PlayingCard[];
  dealerCards: PlayingCard[];
  dealerRevealed: boolean;
  dealerFolded?: boolean;
  dealerRoundBet?: number;
  seats: SeatRoundState[];
  summaryText?: string;
  dealerNetGp?: number;
}

const GAME_CATALOG: Array<{
  id: CasinoGameType;
  icon: string;
  title: string;
  playersText: string;
  desc: string;
}> = [
  {
    id: 'pokdeng',
    icon: '🃏',
    title: 'ป๊อกเด้ง (Pok Deng)',
    playersText: '1–5 คน',
    desc: 'สู้เจ้ามือพี่ยาม • ป๊อก 8/9, ตอง ×5, สเตรทฟลัช, เด้งครบสูตร!',
  },
  {
    id: 'blackjack',
    icon: '🂡',
    title: 'แบล็คแจ็ค 21',
    playersText: '1–5 คน',
    desc: 'จั่วให้ใกล้ 21 ที่สุดห้ามเกิน • แบล็คแจ็คจ่าย 1.5× • ดับเบิลได้!',
  },
  {
    id: 'holdem',
    icon: '🤠',
    title: "Texas Hold'em",
    playersText: '1–5 คน',
    desc: 'ไพ่ในมือ 2 + ไพ่กลาง 5 ใบ • เช็ค/ตาม/เกทับ/หมอบ (1 คนดวลพี่ยาม!)',
  },
  {
    id: 'oldmaid',
    icon: '👵',
    title: 'อีแก่กินน้ำ',
    playersText: '2–5 คน',
    desc: 'ดึงไพ่จับคู่ทิ้ง • คนสุดท้ายถืออีแก่ Q♠ จ่ายรอบวงให้เพื่อนทุกคน!',
  },
];

function PlayingCardView({
  card,
  faceDown = false,
  compact = false,
  highlight = false,
  onClick,
}: {
  card?: PlayingCard;
  faceDown?: boolean;
  compact?: boolean;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const sizeCls = compact
    ? 'w-11 h-16 sm:w-13 sm:h-19 rounded-lg text-xs'
    : 'w-14 h-20 sm:w-16 sm:h-24 rounded-xl text-sm';

  if (faceDown || !card) {
    return (
      <button
        type="button"
        disabled={!onClick}
        onClick={onClick}
        className={`${sizeCls} relative bg-gradient-to-br from-blue-800 via-indigo-900 to-slate-950 border-2 border-amber-300 shadow-md flex items-center justify-center shrink-0 transition ${
          onClick ? 'cursor-pointer hover:-translate-y-2 hover:ring-2 hover:ring-yellow-300' : 'cursor-default'
        }`}
      >
        <div className="w-[80%] h-[82%] rounded border border-amber-400/60 bg-[repeating-linear-gradient(45deg,rgba(250,204,21,0.12)_0px,rgba(250,204,21,0.12)_3px,transparent_3px,transparent_7px)] flex items-center justify-center text-amber-300 text-base">
          ♠
        </div>
      </button>
    );
  }

  const isRed = SUIT_IS_RED[card.suit];
  const isOldMaid = card.id === OLD_MAID_CARD_ID;
  const rTxt = rankLabel(card.rank);
  const sTxt = SUIT_SYMBOL[card.suit];

  return (
    <div
      className={`${sizeCls} relative bg-gradient-to-b from-white to-slate-100 border-2 ${
        highlight || isOldMaid
          ? 'border-amber-400 ring-2 ring-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.7)]'
          : 'border-slate-300 shadow-md'
      } flex flex-col justify-between p-1 sm:p-1.5 select-none shrink-0 ${
        isRed ? 'text-rose-600' : 'text-slate-900'
      }`}
    >
      <div className="font-black leading-none flex items-center gap-0.5">
        <span>{rTxt}</span>
        <span className="text-[10px]">{sTxt}</span>
      </div>
      <div className="text-center text-xl sm:text-2xl leading-none font-black">
        {isOldMaid ? '👵' : sTxt}
      </div>
      <div className="font-black leading-none text-right rotate-180 flex items-center gap-0.5">
        <span>{rTxt}</span>
        <span className="text-[10px]">{sTxt}</span>
      </div>
    </div>
  );
}

function GuardDealerAvatar({ mood }: { mood: GuardMoodMeta }) {
  const isTroll = mood.id === 'mega_troll';
  const isGrin = mood.id === 'grin';
  const isSmirk = mood.id === 'smirk';
  const isCry = mood.id === 'cry';
  const isAnnoyed = mood.id === 'annoyed';

  return (
    <div className="relative shrink-0">
      {isTroll && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xl animate-bounce z-20 drop-shadow">
          👑
        </div>
      )}
      <div
        className={`relative w-18 h-18 sm:w-22 sm:h-22 rounded-full overflow-hidden border-3 ${mood.ringClass} bg-slate-900 transition-all duration-300 ${
          isTroll ? 'scale-110' : isCry ? 'scale-95' : ''
        }`}
      >
        <img
          src="/images/guard_face.jpg"
          alt="เจ้ามือพี่ยาม"
          className={`w-full h-full object-cover ${isCry ? 'saturate-50 brightness-90' : ''}`}
        />
        {/* Dynamic Expressive SVG Overlay based on Guard's Winnings! */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none">
          {/* Sunglasses for Smirk / Grin / Mega Troll */}
          {(isSmirk || isGrin || isTroll) && (
            <g>
              <rect x="18" y="34" width="27" height="14" rx="4" fill="#0f172a" stroke="#facc15" strokeWidth="2" />
              <rect x="55" y="34" width="27" height="14" rx="4" fill="#0f172a" stroke="#facc15" strokeWidth="2" />
              <line x1="45" y1="39" x2="55" y2="39" stroke="#facc15" strokeWidth="2.5" />
              <line x1="23" y1="38" x2="32" y2="44" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
              <line x1="60" y1="38" x2="69" y2="44" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
            </g>
          )}
          {/* Cheeky Smirk */}
          {isSmirk && (
            <path d="M 38 68 Q 54 74 66 63" fill="none" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          )}
          {/* Wide Sparkling Toothy Grin */}
          {isGrin && (
            <g>
              <path d="M 28 63 Q 50 84 72 63 Z" fill="#ffffff" stroke="#1e293b" strokeWidth="2.5" />
              <line x1="35" y1="68" x2="65" y2="68" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="72" y="64" fontSize="16">✨</text>
            </g>
          )}
          {/* MAX Punchable Troll Grin + Gold Sparkles */}
          {isTroll && (
            <g>
              <path d="M 22 60 Q 50 92 78 60 Q 50 68 22 60 Z" fill="#ffffff" stroke="#1e293b" strokeWidth="3" />
              <line x1="32" y1="66" x2="32" y2="75" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="50" y1="66" x2="50" y2="78" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="68" y1="66" x2="68" y2="75" stroke="#94a3b8" strokeWidth="1.5" />
              <text x="74" y="56" fontSize="18">✨</text>
              <text x="8" y="62" fontSize="16">💰</text>
            </g>
          )}
          {/* Annoyed / Cry */}
          {isAnnoyed && (
            <g stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round">
              <line x1="25" y1="32" x2="43" y2="38" />
              <line x1="75" y1="32" x2="57" y2="38" />
            </g>
          )}
          {isCry && (
            <g>
              <ellipse cx="32" cy="56" rx="4" ry="7" fill="#38bdf8" opacity="0.9" />
              <ellipse cx="68" cy="56" rx="4" ry="7" fill="#38bdf8" opacity="0.9" />
              <path d="M 36 74 Q 50 64 64 74" fill="none" stroke="#1e293b" strokeWidth="3.5" strokeLinecap="round" />
            </g>
          )}
        </svg>
      </div>
      <div className="mt-1 text-center">
        <span className="inline-block bg-slate-950/90 border border-amber-400 text-amber-300 text-[9.5px] font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap">
          {mood.badge}
        </span>
      </div>
    </div>
  );
}

export function CasinoCardModal({
  isOpen,
  onClose,
  players,
  currentUserId,
  currentUserPoints,
  initialRoomCode,
  initialIsHost,
  invitedTargetName,
  onLobbyBroadcast,
  onPointsUpdated,
}: CasinoCardModalProps) {
  const [screen, setScreen] = useState<'lobby' | 'table'>('lobby');
  const [gameType, setGameType] = useState<CasinoGameType>('pokdeng');
  const [muted, setMuted] = useState<boolean>(false);

  const myClientIdRef = useRef<string>(`card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
  const [mySeat, setMySeat] = useState<SeatId>('S1');
  const [members, setMembers] = useState<Partial<Record<SeatId, TableMember>>>({});
  const [round, setRound] = useState<CasinoRoundState | null>(null);

  // Persistent Guard Dealer Bank
  const [guardBank, setGuardBank] = useState<{
    guardBalance: number;
    guardTotalWon: number;
    guardRoundsPlayed: number;
  }>({ guardBalance: 0, guardTotalWon: 0, guardRoundsPlayed: 0 });
  const [guardMood, setGuardMood] = useState<GuardMoodMeta>(() => resolveGuardMood(0));
  const [settling, setSettling] = useState<boolean>(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const membersRef = useRef(members);
  membersRef.current = members;
  const gameTypeRef = useRef(gameType);
  gameTypeRef.current = gameType;
  const roundRef = useRef(round);
  roundRef.current = round;
  const isHostRef = useRef(initialIsHost);
  isHostRef.current = initialIsHost;
  const screenRef = useRef(screen);
  screenRef.current = screen;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const onLobbyBroadcastRef = useRef(onLobbyBroadcast);
  onLobbyBroadcastRef.current = onLobbyBroadcast;
  const onPointsUpdatedRef = useRef(onPointsUpdated);
  onPointsUpdatedRef.current = onPointsUpdated;

  const fetchGuardBank = useCallback(async () => {
    try {
      const res = await fetch('/api/pokdeng', { cache: 'no-store' });
      if (res.ok) {
        const d = await res.json();
        setGuardBank({
          guardBalance: Number(d.guardBalance ?? 0),
          guardTotalWon: Number(d.guardTotalWon ?? 0),
          guardRoundsPlayed: Number(d.guardRoundsPlayed ?? 0),
        });
      }
    } catch {
      // ignore
    }
  }, []);

  const sendRoomMsg = useCallback((event: string, payload: Record<string, unknown>) => {
    if (channelRef.current) {
      channelRef.current.send({ type: 'broadcast', event, payload });
    }
    if (bcRef.current) {
      bcRef.current.postMessage({ event, payload });
    }
  }, []);

  const broadcastArenaLobby = useCallback(
    (status: 'waiting' | 'started' | 'closed', gType: CasinoGameType, memObj: Partial<Record<SeatId, TableMember>>) => {
      if (!isHostRef.current || !initialRoomCode) return;
      const host = memObj.S1;
      onLobbyBroadcastRef.current?.({
        roomCode: initialRoomCode,
        gameType: gType,
        hostUserId: host?.userId ?? (currentUserId || 0),
        hostName: host?.name || 'เพื่อนในสนาม',
        hostEmoji: host?.emoji || '🃏',
        targetName: invitedTargetName,
        count: Object.keys(memObj).length,
        max: 5,
        status,
      });
    },
    [initialRoomCode, currentUserId, invitedTargetName]
  );

  // ============================================================
  // HOST-AUTHORITATIVE SETTLEMENT TO /api/pokdeng
  // ============================================================
  const settleRoundOnServer = useCallback(
    async (finalRound: CasinoRoundState, guardPlays: boolean, rakeGp = 0) => {
      setSettling(true);
      try {
        const entries = finalRound.seats
          .filter((s) => s.userId > 0 && typeof s.deltaGp === 'number' && s.deltaGp !== 0)
          .map((s) => ({ userId: s.userId, deltaGp: s.deltaGp || 0 }));

        const res = await fetch('/api/pokdeng', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries, guardPlays, rakeGp }),
        });
        if (res.ok) {
          const data = await res.json();
          const nextBank = {
            guardBalance: Number(data.guardBalance ?? 0),
            guardTotalWon: Number(data.guardTotalWon ?? 0),
            guardRoundsPlayed: Number(data.guardRoundsPlayed ?? 0),
          };
          const dealerNet = Number(data.dealerNetGp ?? finalRound.dealerNetGp ?? 0);
          const mood = resolveGuardMood(dealerNet);
          setGuardBank(nextBank);
          setGuardMood(mood);

          const updatedRound: CasinoRoundState = {
            ...finalRound,
            dealerNetGp: dealerNet,
          };
          setRound(updatedRound);
          roundRef.current = updatedRound;
          sendRoomMsg('round_sync', { round: updatedRound, guardBank: nextBank, guardMood: mood });
          onPointsUpdatedRef.current?.();
        }
      } catch {
        // ignore
      } finally {
        setSettling(false);
      }
    },
    [sendRoomMsg]
  );

  // ============================================================
  // HOST GAME LOGIC FOR ALL 4 GAMES
  // ============================================================
  const createFreshBettingRound = useCallback(
    (gType: CasinoGameType, memObj: Partial<Record<SeatId, TableMember>>): CasinoRoundState => {
      const seats: SeatRoundState[] = SEAT_ORDER.filter((s) => Boolean(memObj[s])).map((s) => {
        const m = memObj[s]!;
        return {
          seatId: s,
          userId: m.userId,
          name: m.name,
          emoji: m.emoji,
          bet: 10,
          ready: false,
          cards: [],
          done: false,
        };
      });
      return {
        gameType: gType,
        phase: 'betting',
        oldMaidStake: 10,
        deck: [],
        community: [],
        dealerCards: [],
        dealerRevealed: false,
        seats,
      };
    },
    []
  );

  const pushRoundSync = useCallback(
    (nextRound: CasinoRoundState) => {
      setRound(nextRound);
      roundRef.current = nextRound;
      sendRoomMsg('round_sync', { round: nextRound });
    },
    [sendRoomMsg]
  );

  const finishPokDengAsHost = useCallback(
    (cur: CasinoRoundState) => {
      const deck = [...cur.deck];
      const dealerCards = [...cur.dealerCards];
      const dEvalInit = evaluatePokDengHand(dealerCards);
      if (!dEvalInit.isPok && dEvalInit.points < 5 && deck.length > 0) {
        dealerCards.push(deck.pop()!);
      }

      let dealerNet = 0;
      const seats = cur.seats.map((s) => {
        const cmp = comparePokDeng(s.cards, dealerCards);
        const delta =
          cmp.outcome === 'win'
            ? s.bet * cmp.multiplier
            : cmp.outcome === 'lose'
            ? -(s.bet * cmp.multiplier)
            : 0;
        dealerNet -= delta;
        return {
          ...s,
          done: true,
          deltaGp: delta,
          resultLabel: `${cmp.playerEval.label} • ${
            cmp.outcome === 'win' ? `ชนะ +${delta}💰` : cmp.outcome === 'lose' ? `เสีย ${delta}💰` : 'เสมอ'
          }`,
        };
      });

      const dFinal = evaluatePokDengHand(dealerCards);
      const settled: CasinoRoundState = {
        ...cur,
        phase: 'settled',
        deck,
        dealerCards,
        dealerRevealed: true,
        seats,
        dealerNetGp: dealerNet,
        summaryText: `เจ้ามือพี่ยาม: ${dFinal.label} (${dealerNet >= 0 ? `พี่ยามกิน +${dealerNet}` : `พี่ยามเสีย ${dealerNet}`} 💰 GP)`,
      };
      if (dealerNet <= 0) playCasinoSound('win', mutedRef.current);
      else playCasinoSound('lose', mutedRef.current);
      if (dealerNet < 0) confetti({ particleCount: 65, spread: 70, origin: { y: 0.6 } });

      pushRoundSync(settled);
      void settleRoundOnServer(settled, true, 0);
    },
    [pushRoundSync, settleRoundOnServer]
  );

  const finishBlackjackAsHost = useCallback(
    (cur: CasinoRoundState) => {
      const deck = [...cur.deck];
      const dealerCards = [...cur.dealerCards];
      while (evaluateBlackjackHand(dealerCards).total < 17 && deck.length > 0) {
        dealerCards.push(deck.pop()!);
      }

      let dealerNet = 0;
      const seats = cur.seats.map((s) => {
        const cmp = compareBlackjack(s.cards, dealerCards);
        const pEval = evaluateBlackjackHand(s.cards);
        const delta =
          cmp.outcome === 'win'
            ? Math.round(s.bet * cmp.payoutRatio)
            : cmp.outcome === 'lose'
            ? -s.bet
            : 0;
        dealerNet -= delta;
        return {
          ...s,
          done: true,
          deltaGp: delta,
          resultLabel: `${pEval.label} • ${
            cmp.outcome === 'win' ? `ชนะ +${delta}💰` : cmp.outcome === 'lose' ? `เสีย ${delta}💰` : 'เสมอ'
          }`,
        };
      });

      const dEval = evaluateBlackjackHand(dealerCards);
      const settled: CasinoRoundState = {
        ...cur,
        phase: 'settled',
        deck,
        dealerCards,
        dealerRevealed: true,
        seats,
        dealerNetGp: dealerNet,
        summaryText: `เจ้ามือพี่ยาม: ${dEval.label} (${dealerNet >= 0 ? `พี่ยามกิน +${dealerNet}` : `พี่ยามเสีย ${dealerNet}`} 💰 GP)`,
      };
      if (dealerNet <= 0) playCasinoSound('win', mutedRef.current);
      else playCasinoSound('lose', mutedRef.current);
      if (dealerNet < 0) confetti({ particleCount: 65, spread: 70, origin: { y: 0.6 } });

      pushRoundSync(settled);
      void settleRoundOnServer(settled, true, 0);
    },
    [pushRoundSync, settleRoundOnServer]
  );

  const finishHoldemAsHost = useCallback(
    (cur: CasinoRoundState) => {
      const deck = [...cur.deck];
      const community = [...cur.community];
      while (community.length < 5 && deck.length > 0) {
        community.push(deck.pop()!);
      }
      const isHeadsUpGuard = cur.seats.length === 1;
      const pot = cur.pot || 0;

      // Evaluate all non-folded contenders
      interface Contender {
        key: string; // seatId or 'DEALER'
        score: number;
        label: string;
      }
      const contenders: Contender[] = [];
      for (const s of cur.seats) {
        if (!s.folded) {
          const ev = evaluateTexasHoldem7([...s.cards, ...community]);
          contenders.push({ key: s.seatId, score: ev.score, label: ev.label });
        }
      }
      if (isHeadsUpGuard && !cur.dealerFolded) {
        const ev = evaluateTexasHoldem7([...cur.dealerCards, ...community]);
        contenders.push({ key: 'DEALER', score: ev.score, label: ev.label });
      }

      const maxScore = contenders.reduce((m, c) => Math.max(m, c.score), -1);
      const winners = contenders.filter((c) => c.score === maxScore);
      const rakeGp = !isHeadsUpGuard && pot > 0 ? Math.max(1, Math.round(pot * 0.05)) : 0;
      const distributable = Math.max(0, pot - rakeGp);
      const share = winners.length > 0 ? Math.floor(distributable / winners.length) : 0;

      const seats = cur.seats.map((s) => {
        const isWin = winners.some((w) => w.key === s.seatId);
        const ev = s.folded
          ? { label: 'หมอบ (Fold)' }
          : evaluateTexasHoldem7([...s.cards, ...community]);
        const delta = (isWin ? share : 0) - s.bet;
        return {
          ...s,
          done: true,
          deltaGp: delta,
          resultLabel: `${ev.label} • ${delta >= 0 ? `+${delta}💰` : `${delta}💰`}`,
        };
      });

      const dealerWon = winners.some((w) => w.key === 'DEALER');
      const dealerNet = isHeadsUpGuard
        ? -(seats[0]?.deltaGp || 0)
        : rakeGp;

      const winnerNames = winners
        .map((w) =>
          w.key === 'DEALER'
            ? `👮 พี่ยาม (${w.label})`
            : `${seats.find((s) => s.seatId === w.key)?.name || ''} (${w.label})`
        )
        .join(', ');

      const settled: CasinoRoundState = {
        ...cur,
        phase: 'settled',
        deck,
        community,
        dealerRevealed: true,
        seats,
        dealerNetGp: dealerNet,
        summaryText: dealerWon
          ? `😈 พี่ยามชนะกองกลาง ${pot} 💰! (${winnerNames})`
          : `🏆 ผู้ชนะ: ${winnerNames} • กองกลาง ${pot} 💰${rakeGp > 0 ? ` (พี่ยามเก็บต๋ง +${rakeGp}💰)` : ''}`,
      };

      if (dealerWon) playCasinoSound('lose', mutedRef.current);
      else {
        playCasinoSound('win', mutedRef.current);
        confetti({ particleCount: 70, spread: 75, origin: { y: 0.55 } });
      }

      pushRoundSync(settled);
      void settleRoundOnServer(settled, isHeadsUpGuard, rakeGp);
    },
    [pushRoundSync, settleRoundOnServer]
  );

  const advanceHoldemStreetAsHost = useCallback(
    (cur: CasinoRoundState) => {
      const deck = [...cur.deck];
      const community = [...cur.community];
      let nextStreet = cur.street || 'preflop';

      if (nextStreet === 'preflop') {
        nextStreet = 'flop';
        for (let i = 0; i < 3 && deck.length > 0; i++) community.push(deck.pop()!);
      } else if (nextStreet === 'flop') {
        nextStreet = 'turn';
        if (deck.length > 0) community.push(deck.pop()!);
      } else if (nextStreet === 'turn') {
        nextStreet = 'river';
        if (deck.length > 0) community.push(deck.pop()!);
      } else {
        finishHoldemAsHost(cur);
        return;
      }

      playCasinoSound('deal', mutedRef.current);
      const resetSeats = cur.seats.map((s) => ({
        ...s,
        done: Boolean(s.folded),
        roundBet: 0,
      }));
      const firstActive = resetSeats.findIndex((s) => !s.folded);
      if (firstActive === -1) {
        finishHoldemAsHost({ ...cur, deck, community, seats: resetSeats });
        return;
      }

      pushRoundSync({
        ...cur,
        deck,
        community,
        street: nextStreet,
        currentBet: 0,
        dealerRoundBet: 0,
        seats: resetSeats,
        turnIndex: firstActive,
      });
    },
    [finishHoldemAsHost, pushRoundSync]
  );

  const dealCurrentRoundAsHost = useCallback(
    (cur: CasinoRoundState) => {
      playCasinoSound('deal', mutedRef.current);
      if (cur.gameType === 'pokdeng') {
        const deck = createShuffledDeck();
        const seats = cur.seats.map((s) => {
          const c = [deck.pop()!, deck.pop()!];
          const ev = evaluatePokDengHand(c);
          return {
            ...s,
            cards: c,
            done: ev.isPok,
            resultLabel: ev.isPok ? ev.label : undefined,
          };
        });
        const dealerCards = [deck.pop()!, deck.pop()!];
        const dEval = evaluatePokDengHand(dealerCards);
        const next: CasinoRoundState = {
          ...cur,
          phase: 'playing',
          deck,
          dealerCards,
          dealerRevealed: dEval.isPok,
          seats,
        };
        if (dEval.isPok || seats.every((s) => s.done)) {
          finishPokDengAsHost(next);
        } else {
          pushRoundSync(next);
        }
      } else if (cur.gameType === 'blackjack') {
        const deck = createShuffledDeck();
        const seats = cur.seats.map((s) => {
          const c = [deck.pop()!, deck.pop()!];
          const ev = evaluateBlackjackHand(c);
          return {
            ...s,
            cards: c,
            done: ev.isBlackjack,
            resultLabel: ev.isBlackjack ? ev.label : undefined,
          };
        });
        const dealerCards = [deck.pop()!, deck.pop()!];
        const next: CasinoRoundState = {
          ...cur,
          phase: 'playing',
          deck,
          dealerCards,
          dealerRevealed: false,
          seats,
        };
        if (seats.every((s) => s.done)) {
          finishBlackjackAsHost(next);
        } else {
          pushRoundSync(next);
        }
      } else if (cur.gameType === 'holdem') {
        const deck = createShuffledDeck();
        const ante = 5;
        const isHeadsUp = cur.seats.length === 1;
        const seats = cur.seats.map((s) => ({
          ...s,
          bet: ante,
          roundBet: 0,
          cards: [deck.pop()!, deck.pop()!],
          done: false,
          folded: false,
        }));
        const dealerCards = isHeadsUp ? [deck.pop()!, deck.pop()!] : [];
        const pot = ante * (seats.length + (isHeadsUp ? 1 : 0));
        pushRoundSync({
          ...cur,
          phase: 'playing',
          street: 'preflop',
          pot,
          currentBet: 0,
          dealerRoundBet: 0,
          dealerFolded: false,
          turnIndex: 0,
          deck,
          community: [],
          dealerCards,
          dealerRevealed: false,
          seats,
        });
      } else if (cur.gameType === 'oldmaid') {
        const deck = createOldMaidDeck();
        const buckets: PlayingCard[][] = cur.seats.map(() => []);
        let bi = 0;
        while (deck.length > 0) {
          buckets[bi % cur.seats.length].push(deck.pop()!);
          bi++;
        }
        const seats = cur.seats.map((s, i) => {
          const { remaining } = discardOldMaidPairs(buckets[i]);
          return {
            ...s,
            cards: remaining,
            safe: remaining.length === 0,
            done: remaining.length === 0,
          };
        });
        const firstActive = seats.findIndex((s) => !s.safe);
        pushRoundSync({
          ...cur,
          phase: 'playing',
          deck: [],
          dealerCards: [],
          dealerRevealed: true,
          turnIndex: firstActive >= 0 ? firstActive : 0,
          seats,
        });
      }
    },
    [finishPokDengAsHost, finishBlackjackAsHost, pushRoundSync]
  );

  // Process any player action on Host
  const handlePlayerActionAsHost = useCallback(
    (seatId: SeatId, action: string, value?: number) => {
      const cur = roundRef.current;
      if (!cur) return;

      if (action === 'set_bet' && cur.phase === 'betting') {
        playCasinoSound('chip', mutedRef.current);
        const betVal = Number(value || 10);
        if (cur.gameType === 'oldmaid') {
          pushRoundSync({ ...cur, oldMaidStake: betVal });
          return;
        }
        const seats = cur.seats.map((s) => (s.seatId === seatId ? { ...s, bet: betVal } : s));
        pushRoundSync({ ...cur, seats });
        return;
      }

      if (action === 'ready_bet' && cur.phase === 'betting') {
        playCasinoSound('chip', mutedRef.current);
        const seats = cur.seats.map((s) => (s.seatId === seatId ? { ...s, ready: true } : s));
        const next = { ...cur, seats };
        if (seats.every((s) => s.ready)) {
          dealCurrentRoundAsHost(next);
        } else {
          pushRoundSync(next);
        }
        return;
      }

      if (cur.phase !== 'playing') return;

      // ---- POK DENG ----
      if (cur.gameType === 'pokdeng') {
        const deck = [...cur.deck];
        const seats = cur.seats.map((s) => {
          if (s.seatId !== seatId || s.done) return s;
          if (action === 'draw' && s.cards.length < 3 && deck.length > 0) {
            playCasinoSound('deal', mutedRef.current);
            const nextCards = [...s.cards, deck.pop()!];
            return { ...s, cards: nextCards, done: true };
          }
          if (action === 'stand') {
            return { ...s, done: true };
          }
          return s;
        });
        const next = { ...cur, deck, seats };
        if (seats.every((s) => s.done)) finishPokDengAsHost(next);
        else pushRoundSync(next);
        return;
      }

      // ---- BLACKJACK 21 ----
      if (cur.gameType === 'blackjack') {
        const deck = [...cur.deck];
        const seats = cur.seats.map((s) => {
          if (s.seatId !== seatId || s.done) return s;
          if (action === 'hit' && deck.length > 0) {
            playCasinoSound('deal', mutedRef.current);
            const nextCards = [...s.cards, deck.pop()!];
            const ev = evaluateBlackjackHand(nextCards);
            return { ...s, cards: nextCards, done: ev.isBust || ev.total === 21 };
          }
          if (action === 'double' && s.cards.length === 2 && deck.length > 0) {
            playCasinoSound('chip', mutedRef.current);
            const nextCards = [...s.cards, deck.pop()!];
            return { ...s, bet: s.bet * 2, cards: nextCards, done: true };
          }
          if (action === 'stand') {
            return { ...s, done: true };
          }
          return s;
        });
        const next = { ...cur, deck, seats };
        if (seats.every((s) => s.done)) finishBlackjackAsHost(next);
        else pushRoundSync(next);
        return;
      }

      // ---- TEXAS HOLD'EM ----
      if (cur.gameType === 'holdem') {
        const turnIdx = cur.turnIndex ?? 0;
        const activeSeat = cur.seats[turnIdx];
        if (!activeSeat || activeSeat.seatId !== seatId) return;

        let pot = cur.pot || 0;
        let currentBet = cur.currentBet || 0;
        let seats = [...cur.seats];

        if (action === 'fold') {
          seats[turnIdx] = { ...activeSeat, folded: true, done: true };
        } else if (action === 'call') {
          const toPay = Math.max(0, currentBet - (activeSeat.roundBet || 0));
          pot += toPay;
          if (toPay > 0) playCasinoSound('chip', mutedRef.current);
          seats[turnIdx] = {
            ...activeSeat,
            bet: activeSeat.bet + toPay,
            roundBet: currentBet,
            done: true,
          };
        } else if (action === 'raise') {
          const raiseAmt = Number(value || 10);
          const newTarget = currentBet + raiseAmt;
          const toPay = Math.max(0, newTarget - (activeSeat.roundBet || 0));
          pot += toPay;
          currentBet = newTarget;
          playCasinoSound('chip', mutedRef.current);
          seats = seats.map((s, idx) =>
            idx === turnIdx
              ? { ...s, bet: s.bet + toPay, roundBet: newTarget, done: true }
              : { ...s, done: Boolean(s.folded) }
          );
        }

        // Check if only 1 contender left
        const isHeadsUp = seats.length === 1;
        const alivePlayers = seats.filter((s) => !s.folded);
        if (alivePlayers.length === 0) {
          finishHoldemAsHost({ ...cur, pot, currentBet, seats });
          return;
        }
        if (!isHeadsUp && alivePlayers.length === 1) {
          finishHoldemAsHost({ ...cur, pot, currentBet, seats });
          return;
        }

        // In 1P Heads-up, Guard Dealer responds immediately after player acts!
        if (isHeadsUp) {
          const dNeed = Math.max(0, currentBet - (cur.dealerRoundBet || 0));
          const dealerPotAdd = dNeed;
          const nextCur: CasinoRoundState = {
            ...cur,
            pot: pot + dealerPotAdd,
            currentBet,
            dealerRoundBet: currentBet,
            seats,
          };
          advanceHoldemStreetAsHost(nextCur);
          return;
        }

        // Multi-player: find next seat that hasn't finished this street
        let nextIdx = -1;
        for (let step = 1; step <= seats.length; step++) {
          const cand = (turnIdx + step) % seats.length;
          if (!seats[cand].folded && (!seats[cand].done || (seats[cand].roundBet || 0) < currentBet)) {
            nextIdx = cand;
            break;
          }
        }

        if (nextIdx === -1) {
          advanceHoldemStreetAsHost({ ...cur, pot, currentBet, seats });
        } else {
          pushRoundSync({ ...cur, pot, currentBet, seats, turnIndex: nextIdx });
        }
        return;
      }

      // ---- OLD MAID (อีแก่กินน้ำ) ----
      if (cur.gameType === 'oldmaid') {
        if (action === 'shuffle_hand') {
          const seats = cur.seats.map((s) => {
            if (s.seatId !== seatId) return s;
            const c = [...s.cards];
            for (let i = c.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [c[i], c[j]] = [c[j], c[i]];
            }
            return { ...s, cards: c };
          });
          pushRoundSync({ ...cur, seats });
          return;
        }

        if (action === 'pick_card') {
          const turnIdx = cur.turnIndex ?? 0;
          const activeSeat = cur.seats[turnIdx];
          if (!activeSeat || activeSeat.seatId !== seatId) return;

          // Target is next non-safe seat clockwise
          let targetIdx = -1;
          for (let step = 1; step < cur.seats.length; step++) {
            const cand = (turnIdx + step) % cur.seats.length;
            if (!cur.seats[cand].safe && cur.seats[cand].cards.length > 0) {
              targetIdx = cand;
              break;
            }
          }
          if (targetIdx === -1) return;

          const cardIdx = Math.max(
            0,
            Math.min(cur.seats[targetIdx].cards.length - 1, Number(value || 0))
          );
          playCasinoSound('deal', mutedRef.current);

          const seats = cur.seats.map((s) => ({ ...s, cards: [...s.cards] }));
          const [picked] = seats[targetIdx].cards.splice(cardIdx, 1);
          if (seats[targetIdx].cards.length === 0) {
            seats[targetIdx].safe = true;
            seats[targetIdx].done = true;
          }

          seats[turnIdx].cards.push(picked);
          const { remaining } = discardOldMaidPairs(seats[turnIdx].cards);
          seats[turnIdx].cards = remaining;
          if (remaining.length === 0) {
            seats[turnIdx].safe = true;
            seats[turnIdx].done = true;
          }

          const remainingActive = seats.filter((s) => !s.safe);
          if (remainingActive.length <= 1) {
            // Game Over! Single loser holding Q♠ pays every survivor!
            const loser = remainingActive[0];
            const stake = cur.oldMaidStake || 10;
            const survivors = seats.filter((s) => s.seatId !== loser?.seatId);
            const rakeGp = 1;
            const settledSeats = seats.map((s) => {
              if (loser && s.seatId === loser.seatId) {
                const loseTotal = -(stake * survivors.length + rakeGp);
                return {
                  ...s,
                  done: true,
                  deltaGp: loseTotal,
                  resultLabel: `👵 อีแก่กินน้ำ!! เสีย ${loseTotal}💰`,
                };
              }
              return {
                ...s,
                done: true,
                deltaGp: stake,
                resultLabel: `✅ รอดแล้ว! +${stake}💰`,
              };
            });

            playCasinoSound('lose', mutedRef.current);
            const settled: CasinoRoundState = {
              ...cur,
              phase: 'settled',
              seats: settledSeats,
              dealerNetGp: rakeGp,
              summaryText: `👵💧 ${loser?.emoji || ''} ${loser?.name || 'คนแพ้'} ถืออีแก่คามือ! โดนกินน้ำ + จ่ายรอบวงคนละ ${stake} 💰!`,
            };
            pushRoundSync(settled);
            void settleRoundOnServer(settled, false, rakeGp);
            return;
          }

          // Advance turn to next active player
          let nextTurn = targetIdx;
          if (seats[nextTurn].safe) {
            for (let step = 1; step <= seats.length; step++) {
              const cand = (turnIdx + step) % seats.length;
              if (!seats[cand].safe) {
                nextTurn = cand;
                break;
              }
            }
          }
          pushRoundSync({ ...cur, seats, turnIndex: nextTurn });
        }
      }
    },
    [
      pushRoundSync,
      dealCurrentRoundAsHost,
      finishPokDengAsHost,
      finishBlackjackAsHost,
      finishHoldemAsHost,
      advanceHoldemStreetAsHost,
      settleRoundOnServer,
    ]
  );

  // Connect to Realtime Casino Room on open
  useEffect(() => {
    if (!isOpen || !initialRoomCode) return;

    void fetchGuardBank();
    setScreen('lobby');
    setRound(null);
    roundRef.current = null;
    setGuardMood(resolveGuardMood(0));

    const me = players.find((p) => p.id === currentUserId) || players[0];
    const myInfo: Omit<TableMember, 'seatId'> = {
      clientId: myClientIdRef.current,
      userId: me?.id ?? 0,
      name: me?.name ?? 'ผู้กล้า',
      emoji: me?.emoji ?? '🐰',
    };

    if (initialIsHost) {
      const initMem: Partial<Record<SeatId, TableMember>> = {
        S1: { ...myInfo, seatId: 'S1' },
      };
      setMySeat('S1');
      setMembers(initMem);
      membersRef.current = initMem;
      broadcastArenaLobby('waiting', gameTypeRef.current, initMem);
    } else {
      setMembers({});
      membersRef.current = {};
    }

    const handleRoomEvent = (event: string, payload: Record<string, unknown>) => {
      if (!payload) return;

      if (event === 'join_req' && isHostRef.current) {
        if (screenRef.current === 'table') return;
        const cid = String(payload.clientId || '');
        if (!cid || cid === myClientIdRef.current) return;
        const cur = { ...membersRef.current };
        let assigned = (Object.keys(cur) as SeatId[]).find((s) => cur[s]?.clientId === cid);
        if (!assigned) assigned = SEAT_ORDER.find((s) => !cur[s]);
        if (assigned) {
          cur[assigned] = {
            seatId: assigned,
            clientId: cid,
            userId: Number(payload.userId ?? 0),
            name: String(payload.name || 'เพื่อน'),
            emoji: String(payload.emoji || '🦊'),
          };
          setMembers(cur);
          membersRef.current = cur;
          sendRoomMsg('lobby_sync', { gameType: gameTypeRef.current, members: cur });
          broadcastArenaLobby('waiting', gameTypeRef.current, cur);
        }
      } else if (event === 'leave_req' && isHostRef.current) {
        const cid = String(payload.clientId || '');
        const cur = { ...membersRef.current };
        (Object.keys(cur) as SeatId[]).forEach((s) => {
          if (cur[s]?.clientId === cid) delete cur[s];
        });
        setMembers(cur);
        membersRef.current = cur;
        sendRoomMsg('lobby_sync', { gameType: gameTypeRef.current, members: cur });
        if (screenRef.current === 'lobby') {
          broadcastArenaLobby('waiting', gameTypeRef.current, cur);
        }
      } else if (event === 'lobby_sync' && !isHostRef.current) {
        const incMem = (payload.members || {}) as Partial<Record<SeatId, TableMember>>;
        const incGame = (payload.gameType as CasinoGameType) || 'pokdeng';
        setGameType(incGame);
        gameTypeRef.current = incGame;
        setMembers(incMem);
        membersRef.current = incMem;
        const mine = (Object.keys(incMem) as SeatId[]).find(
          (s) => incMem[s]?.clientId === myClientIdRef.current
        );
        if (mine) setMySeat(mine);
      } else if (event === 'enter_table') {
        const incMem = (payload.members || {}) as Partial<Record<SeatId, TableMember>>;
        const incGame = (payload.gameType as CasinoGameType) || 'pokdeng';
        const incRound = payload.round as CasinoRoundState | undefined;
        setGameType(incGame);
        gameTypeRef.current = incGame;
        setMembers(incMem);
        membersRef.current = incMem;
        const mine = (Object.keys(incMem) as SeatId[]).find(
          (s) => incMem[s]?.clientId === myClientIdRef.current
        );
        if (mine) setMySeat(mine);
        if (incRound) {
          setRound(incRound);
          roundRef.current = incRound;
        }
        setScreen('table');
      } else if (event === 'back_to_lobby') {
        setScreen('lobby');
        setRound(null);
        roundRef.current = null;
      } else if (event === 'player_action' && isHostRef.current) {
        handlePlayerActionAsHost(
          payload.seatId as SeatId,
          String(payload.action || ''),
          payload.value !== undefined ? Number(payload.value) : undefined
        );
      } else if (event === 'round_sync' && !isHostRef.current) {
        const incRound = payload.round as CasinoRoundState | undefined;
        if (incRound) {
          setRound(incRound);
          roundRef.current = incRound;
        }
        if (payload.guardBank) {
          const b = payload.guardBank as { guardBalance: number; guardTotalWon: number; guardRoundsPlayed: number };
          setGuardBank(b);
          onPointsUpdatedRef.current?.();
        }
        if (payload.guardMood) {
          setGuardMood(payload.guardMood as GuardMoodMeta);
        }
      }
    };

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(`waist-card-room-${initialRoomCode}`);
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
        realtime: { params: { eventsPerSecond: 20 } },
      });
      const ch = sb.channel(`waist-card-room-${initialRoomCode}`, {
        config: { broadcast: { self: false } },
      });
      ch.on('broadcast', { event: 'join_req' }, ({ payload }) => handleRoomEvent('join_req', payload))
        .on('broadcast', { event: 'leave_req' }, ({ payload }) => handleRoomEvent('leave_req', payload))
        .on('broadcast', { event: 'lobby_sync' }, ({ payload }) => handleRoomEvent('lobby_sync', payload))
        .on('broadcast', { event: 'enter_table' }, ({ payload }) => handleRoomEvent('enter_table', payload))
        .on('broadcast', { event: 'back_to_lobby' }, ({ payload }) => handleRoomEvent('back_to_lobby', payload))
        .on('broadcast', { event: 'player_action' }, ({ payload }) => handleRoomEvent('player_action', payload))
        .on('broadcast', { event: 'round_sync' }, ({ payload }) => handleRoomEvent('round_sync', payload))
        .subscribe((status) => {
          if (status === 'SUBSCRIBED' && !initialIsHost) {
            ch.send({ type: 'broadcast', event: 'join_req', payload: { ...myInfo } });
          }
        });
      supabaseRef.current = sb;
      channelRef.current = ch;
    }

    let hb: ReturnType<typeof setInterval> | null = null;
    if (initialIsHost) {
      hb = setInterval(() => {
        if (screenRef.current === 'lobby') {
          broadcastArenaLobby('waiting', gameTypeRef.current, membersRef.current);
        }
      }, 4500);
    } else {
      setTimeout(() => sendRoomMsg('join_req', { ...myInfo }), 120);
      hb = setInterval(() => {
        if (
          screenRef.current === 'lobby' &&
          !Object.values(membersRef.current).some((m) => m?.clientId === myClientIdRef.current)
        ) {
          sendRoomMsg('join_req', { ...myInfo });
        }
      }, 1200);
    }

    return () => {
      if (hb) clearInterval(hb);
      if (initialIsHost) {
        broadcastArenaLobby('closed', gameTypeRef.current, membersRef.current);
      } else {
        sendRoomMsg('leave_req', { clientId: myClientIdRef.current });
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

  const dispatchAction = (action: string, value?: number) => {
    if (initialIsHost) {
      handlePlayerActionAsHost(mySeat, action, value);
    } else {
      sendRoomMsg('player_action', { seatId: mySeat, action, value });
    }
  };

  if (!isOpen) return null;

  const joinedCount = Object.keys(members).length;
  const mySeatState = round?.seats.find((s) => s.seatId === mySeat) || null;
  const activeGameMeta = GAME_CATALOG.find((g) => g.id === gameType) || GAME_CATALOG[0];

  // For Old Maid: find target seat clockwise from active turn
  let oldMaidTargetSeat: SeatRoundState | null = null;
  if (round && round.gameType === 'oldmaid' && round.phase === 'playing') {
    const tIdx = round.turnIndex ?? 0;
    for (let step = 1; step < round.seats.length; step++) {
      const cand = round.seats[(tIdx + step) % round.seats.length];
      if (!cand.safe && cand.cards.length > 0) {
        oldMaidTargetSeat = cand;
        break;
      }
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/92 flex flex-col overflow-hidden">
      {screen === 'lobby' ? (
        <div className="w-full h-dvh overflow-y-auto flex items-center justify-center p-3 sm:p-5 pt-safe pb-safe">
          <div className="rpg-stone-frame rounded-2xl max-w-2xl w-full p-4 sm:p-5 space-y-4 relative my-auto">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 bg-rose-600 hover:bg-rose-500 text-white border-2 border-amber-300 rounded-xl font-extrabold cursor-pointer"
            >
              ✕
            </button>

            <div className="flex flex-wrap items-center gap-3 pr-10">
              <GuardDealerAvatar mood={guardMood} />
              <div className="flex-1 min-w-[200px]">
                <h2 className="font-[family-name:var(--font-kanit)] text-lg sm:text-2xl font-extrabold text-amber-300 leading-tight">
                  🃏 วงไพ่คาสิโนเจ้ามือพี่ยาม
                </h2>
                <div className="mt-1 inline-flex flex-wrap items-center gap-1.5 bg-emerald-950/90 border border-amber-400/70 rounded-xl px-2.5 py-1 text-[11px] font-extrabold text-amber-200">
                  <span>🏦 คลังเจ้ามือพี่ยาม:</span>
                  <span className="text-yellow-300 text-xs">{guardBank.guardBalance.toLocaleString()} 💰 GP</span>
                  <span className="text-emerald-300/85">
                    (กินรวม {guardBank.guardTotalWon.toLocaleString()} • {guardBank.guardRoundsPlayed} รอบ)
                  </span>
                </div>
              </div>
            </div>

            {/* Game Selector Cards (4 Playable Games!) */}
            <div className="space-y-1.5">
              <div className="text-xs font-extrabold text-amber-200">
                เลือกเกมไพ่ที่จะเล่น {initialIsHost ? '(หัวตี้เลือกได้เลย)' : '(หัวตี้กำลังเลือก)'}:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GAME_CATALOG.map((g) => {
                  const sel = gameType === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={!initialIsHost}
                      onClick={() => {
                        if (!initialIsHost) return;
                        setGameType(g.id);
                        gameTypeRef.current = g.id;
                        sendRoomMsg('lobby_sync', { gameType: g.id, members: membersRef.current });
                        broadcastArenaLobby('waiting', g.id, membersRef.current);
                      }}
                      className={`text-left p-2.5 rounded-xl border-2 transition cursor-pointer disabled:cursor-default ${
                        sel
                          ? 'bg-emerald-900/80 border-yellow-300 shadow-[0_0_14px_rgba(250,204,21,0.45)]'
                          : 'bg-slate-900/85 border-slate-700 hover:border-amber-400/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-[family-name:var(--font-kanit)] font-extrabold text-sm text-amber-200">
                          {g.icon} {g.title}
                        </span>
                        <span className="text-[10px] font-extrabold bg-black/50 text-emerald-300 px-1.5 py-0.5 rounded-full border border-emerald-500/40">
                          {g.playersText}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-amber-100/75 font-semibold mt-0.5">{g.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seated Players (1-5) */}
            <div className="bg-slate-900/85 border border-amber-500/40 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs font-extrabold text-amber-200">
                <span>👥 สมาชิกในวง ({joinedCount}/5 คน)</span>
                <span className="text-emerald-300">💰 ของคุณ: {currentUserPoints.toLocaleString()} GP</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SEAT_ORDER.map((sid, idx) => {
                  const m = members[sid];
                  return (
                    <div
                      key={sid}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold ${
                        m
                          ? 'bg-emerald-950/90 border-amber-300 text-amber-100'
                          : 'bg-slate-950/70 border-dashed border-slate-700 text-slate-500'
                      }`}
                    >
                      {m ? `${m.emoji} ${m.name}${sid === mySeat ? ' (คุณ)' : ''}` : `ที่นั่ง ${idx + 1} (ว่าง)`}
                    </div>
                  );
                })}
              </div>
            </div>

            {initialIsHost ? (
              <button
                type="button"
                disabled={gameType === 'oldmaid' && joinedCount < 2}
                onClick={() => {
                  const fresh = createFreshBettingRound(gameType, membersRef.current);
                  setRound(fresh);
                  roundRef.current = fresh;
                  broadcastArenaLobby('started', gameType, membersRef.current);
                  sendRoomMsg('enter_table', {
                    gameType,
                    members: membersRef.current,
                    round: fresh,
                  });
                  setScreen('table');
                }}
                className="w-full rpg-btn-gold font-[family-name:var(--font-kanit)] py-3 rounded-xl text-sm sm:text-base font-extrabold cursor-pointer disabled:opacity-45"
              >
                {gameType === 'oldmaid' && joinedCount < 2
                  ? '⏳ อีแก่กินน้ำต้องมีเพื่อนอย่างน้อย 2 คน (รอเพื่อนกดเข้าวง...)'
                  : `${activeGameMeta.icon} เปิดโต๊ะ ${activeGameMeta.title} เลย!`}
              </button>
            ) : (
              <div className="w-full py-2.5 rounded-xl bg-amber-500/15 border border-amber-400/50 text-center text-xs font-extrabold text-amber-200">
                ⏳ รอหัวตี้กดเปิดโต๊ะ {activeGameMeta.title}...
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ==================== CASINO FELT TABLE SCREEN ==================== */
        <div
          className="relative w-full h-dvh overflow-y-auto flex flex-col justify-between p-2.5 sm:p-4 pt-safe pb-safe"
          style={{
            background:
              'radial-gradient(ellipse at 50% 42%, #15803d 0%, #14532d 55%, #052e16 100%)',
          }}
        >
          {/* Top Bar: Exit + Game Badge + Guard Bank + Sound */}
          <div className="flex flex-wrap items-center justify-between gap-2 z-10">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-amber-100 hover:bg-rose-600 cursor-pointer"
              >
                ← ออกจากโต๊ะ
              </button>
              {initialIsHost && (
                <button
                  type="button"
                  onClick={() => {
                    sendRoomMsg('back_to_lobby', {});
                    setScreen('lobby');
                  }}
                  className="rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-amber-200 hover:bg-amber-400 hover:text-black cursor-pointer"
                >
                  🔄 เปลี่ยนเกม
                </button>
              )}
            </div>

            <div className="rpg-banner rounded-full px-3.5 py-1 text-xs font-extrabold flex items-center gap-2 shadow-lg">
              <span>{activeGameMeta.icon} {activeGameMeta.title}</span>
              <span className="text-amber-300">|</span>
              <span className="text-yellow-300">🏦 คลังพี่ยาม: {guardBank.guardBalance.toLocaleString()} 💰</span>
              <span className="hidden sm:inline text-emerald-300 text-[10.5px]">
                (กินรวม {guardBank.guardTotalWon.toLocaleString()} • {guardBank.guardRoundsPlayed} รอบ)
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-amber-300">
                💰 {currentUserPoints.toLocaleString()} GP
              </span>
              <button
                type="button"
                onClick={() => setMuted((v) => !v)}
                className="rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-amber-100 cursor-pointer"
              >
                {muted ? '🔇' : '🔊'}
              </button>
            </div>
          </div>

          {/* CENTER FELT ARENA: GUARD DEALER + TABLE CARDS + PLAYERS */}
          <div className="flex-1 flex flex-col items-center justify-center gap-3 sm:gap-4 my-2 max-w-4xl w-full mx-auto">
            {/* Guard Dealer Head-of-Table Area */}
            <div className="flex flex-col sm:flex-row items-center gap-3 bg-black/30 border-2 border-amber-400/60 rounded-3xl px-4 py-3 shadow-2xl w-full max-w-2xl">
              <GuardDealerAvatar mood={guardMood} />
              <div className="flex-1 text-center sm:text-left space-y-1.5">
                <div className="bg-white/95 text-slate-900 border-2 border-amber-400 rounded-2xl px-3 py-1.5 text-xs font-extrabold shadow inline-block">
                  💬 &ldquo;{guardMood.speech}&rdquo;
                </div>

                {/* Dealer Cards (Pok Deng / Blackjack / 1P Hold'em) */}
                {round && round.dealerCards.length > 0 && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                    {round.dealerCards.map((c, idx) => (
                      <PlayingCardView
                        key={c.id}
                        card={c}
                        compact
                        faceDown={
                          !round.dealerRevealed &&
                          !(round.gameType === 'blackjack' && idx === 0)
                        }
                      />
                    ))}
                    {round.dealerRevealed && round.gameType === 'pokdeng' && (
                      <span className="bg-amber-400 text-black px-2 py-1 rounded-lg text-xs font-black">
                        {evaluatePokDengHand(round.dealerCards).label}
                      </span>
                    )}
                    {round.dealerRevealed && round.gameType === 'blackjack' && (
                      <span className="bg-amber-400 text-black px-2 py-1 rounded-lg text-xs font-black">
                        {evaluateBlackjackHand(round.dealerCards).label}
                      </span>
                    )}
                  </div>
                )}

                {/* Texas Hold'em Community Cards & Pot */}
                {round && round.gameType === 'holdem' && round.phase !== 'betting' && (
                  <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-extrabold text-amber-300">
                      💰 กองกลาง (Pot): {round.pot || 0} GP • รอบ: {(round.street || 'preflop').toUpperCase()}
                    </div>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
                      {[0, 1, 2, 3, 4].map((ci) => (
                        <PlayingCardView
                          key={ci}
                          card={round.community[ci]}
                          compact
                          faceDown={!round.community[ci]}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Settled Round Summary Banner */}
            {round && round.phase === 'settled' && round.summaryText && (
              <div className="rpg-btn-gold px-4 py-2 rounded-2xl text-xs sm:text-sm font-extrabold text-center shadow-xl max-w-xl">
                {round.summaryText}
              </div>
            )}

            {/* Old Maid Interactive Draw Fan (when it's YOUR turn to pick from target!) */}
            {round &&
              round.gameType === 'oldmaid' &&
              round.phase === 'playing' &&
              oldMaidTargetSeat &&
              round.seats[round.turnIndex ?? 0]?.seatId === mySeat && (
                <div className="bg-amber-950/85 border-2 border-yellow-300 rounded-2xl p-3 text-center space-y-2 shadow-2xl max-w-xl w-full">
                  <div className="text-xs sm:text-sm font-extrabold text-yellow-300 animate-pulse">
                    👆 ตาคุณแล้ว! แตะเลือกดึงไพ่ 1 ใบจากมือ {oldMaidTargetSeat.emoji} {oldMaidTargetSeat.name}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {oldMaidTargetSeat.cards.map((_, idx) => (
                      <PlayingCardView
                        key={idx}
                        faceDown
                        compact
                        onClick={() => dispatchAction('pick_card', idx)}
                      />
                    ))}
                  </div>
                </div>
              )}

            {/* Player Seats Around the Emerald Table */}
            {round && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 w-full">
                {round.seats.map((seat, idx) => {
                  const isMe = seat.seatId === mySeat;
                  const isTurn =
                    round.phase === 'playing' &&
                    (round.gameType === 'holdem' || round.gameType === 'oldmaid') &&
                    round.turnIndex === idx;
                  const showFaceUp = isMe || round.phase === 'settled';

                  return (
                    <div
                      key={seat.seatId}
                      className={`rounded-2xl p-2.5 border-2 transition ${
                        isTurn
                          ? 'bg-amber-500/25 border-yellow-300 shadow-[0_0_18px_rgba(250,204,21,0.65)]'
                          : isMe
                          ? 'bg-black/45 border-amber-400'
                          : 'bg-black/30 border-emerald-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="text-xs font-extrabold text-amber-100 truncate">
                          {seat.emoji} {seat.name} {isMe ? '⭐' : ''}
                        </div>
                        <div className="text-[10.5px] font-extrabold text-amber-300 shrink-0">
                          {round.gameType === 'oldmaid'
                            ? seat.safe
                              ? '✅ รอดแล้ว!'
                              : `ถือ ${seat.cards.length} ใบ`
                            : `เดิมพัน ${seat.bet} 💰`}
                        </div>
                      </div>

                      {/* Cards */}
                      <div className="flex flex-wrap items-center justify-center gap-1.5 min-h-[68px]">
                        {seat.cards.length === 0 ? (
                          <span className="text-[11px] font-bold text-emerald-200/70">
                            {round.phase === 'betting'
                              ? seat.ready
                                ? '✅ ลงชิปพร้อมแล้ว'
                                : 'กำลังเลือกชิป...'
                              : seat.safe
                              ? '🎉 ไพ่หมดมือแล้ว!'
                              : 'รอแจกไพ่...'}
                          </span>
                        ) : (
                          seat.cards.map((c) => (
                            <PlayingCardView
                              key={c.id}
                              card={c}
                              compact
                              faceDown={!showFaceUp}
                              highlight={showFaceUp && c.id === OLD_MAID_CARD_ID}
                            />
                          ))
                        )}
                      </div>

                      {/* Live Hand Badge / Final Delta */}
                      <div className="mt-2 text-center min-h-[18px]">
                        {seat.resultLabel ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-black ${
                              (seat.deltaGp ?? 0) > 0
                                ? 'bg-emerald-500 text-black'
                                : (seat.deltaGp ?? 0) < 0
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-700 text-amber-100'
                            }`}
                          >
                            {seat.resultLabel}
                          </span>
                        ) : isMe && seat.cards.length > 0 && round.gameType === 'pokdeng' ? (
                          <span className="text-[11px] font-extrabold text-yellow-300">
                            {evaluatePokDengHand(seat.cards).label}
                          </span>
                        ) : isMe && seat.cards.length > 0 && round.gameType === 'blackjack' ? (
                          <span className="text-[11px] font-extrabold text-yellow-300">
                            {evaluateBlackjackHand(seat.cards).label}
                          </span>
                        ) : isMe && seat.cards.length > 0 && round.gameType === 'holdem' && round.community.length >= 3 ? (
                          <span className="text-[11px] font-extrabold text-yellow-300">
                            {evaluateTexasHoldem7([...seat.cards, ...round.community]).label}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BOTTOM ACTION BAR (Context-aware for all 4 games!) */}
          {round && (
            <div className="z-10 max-w-2xl w-full mx-auto rpg-panel rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-center gap-2 shadow-2xl">
              {/* PHASE 1: BETTING */}
              {round.phase === 'betting' && mySeatState && (
                <>
                  {round.gameType === 'holdem' ? (
                    <span className="text-xs font-extrabold text-amber-200">
                      🤠 ค่าต๋งเริ่มต้น (Ante): 5 💰 GP
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      <span className="text-xs font-extrabold text-amber-200">
                        {round.gameType === 'oldmaid' ? 'เดิมพันคนละ:' : 'เลือกชิป:'}
                      </span>
                      {CHIP_OPTIONS.map((chip) => {
                        const activeVal =
                          round.gameType === 'oldmaid' ? round.oldMaidStake : mySeatState.bet;
                        const canPick =
                          round.gameType === 'oldmaid' ? initialIsHost : !mySeatState.ready;
                        return (
                          <button
                            key={chip}
                            type="button"
                            disabled={!canPick}
                            onClick={() => dispatchAction('set_bet', chip)}
                            className={`px-3 py-1.5 rounded-full text-xs font-black border-2 cursor-pointer transition disabled:opacity-55 ${
                              activeVal === chip
                                ? 'bg-amber-400 text-black border-white scale-105'
                                : 'bg-slate-900 text-amber-200 border-amber-600/70'
                            }`}
                          >
                            {chip}💰
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={mySeatState.ready}
                    onClick={() => dispatchAction('ready_bet')}
                    className="rpg-btn-gold px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-55"
                  >
                    {mySeatState.ready ? '⏳ รอเพื่อนกดพร้อม...' : '✅ ลงชิป & พร้อมแจกไพ่!'}
                  </button>
                </>
              )}

              {/* PHASE 2: PLAYING */}
              {round.phase === 'playing' && mySeatState && (
                <>
                  {round.gameType === 'pokdeng' &&
                    (!mySeatState.done ? (
                      <>
                        <button
                          type="button"
                          onClick={() => dispatchAction('draw')}
                          className="rpg-btn-gold px-5 py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
                        >
                          🃏 จั่วใบที่ 3
                        </button>
                        <button
                          type="button"
                          onClick={() => dispatchAction('stand')}
                          className="rpg-btn-blue px-5 py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
                        >
                          ✋ อยู่ (ไม่จั่ว)
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-extrabold text-amber-200">
                        ⏳ รอเพื่อนและเจ้ามือพี่ยามเปิดไพ่...
                      </span>
                    ))}

                  {round.gameType === 'blackjack' &&
                    (!mySeatState.done ? (
                      <>
                        <button
                          type="button"
                          onClick={() => dispatchAction('hit')}
                          className="rpg-btn-gold px-4 py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
                        >
                          🃏 จั่ว (Hit)
                        </button>
                        <button
                          type="button"
                          onClick={() => dispatchAction('stand')}
                          className="rpg-btn-blue px-4 py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
                        >
                          ✋ อยู่ (Stand)
                        </button>
                        {mySeatState.cards.length === 2 && (
                          <button
                            type="button"
                            onClick={() => dispatchAction('double')}
                            className="rpg-btn-green px-4 py-2.5 rounded-xl text-sm font-extrabold cursor-pointer"
                          >
                            ×2 ดับเบิล
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-extrabold text-amber-200">
                        ⏳ รอเจ้ามือพี่ยามจั่วไพ่...
                      </span>
                    ))}

                  {round.gameType === 'holdem' &&
                    (round.seats[round.turnIndex ?? 0]?.seatId === mySeat && !mySeatState.folded ? (
                      <>
                        <button
                          type="button"
                          onClick={() => dispatchAction('call')}
                          className="rpg-btn-green px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer"
                        >
                          {(round.currentBet || 0) > (mySeatState.roundBet || 0)
                            ? `✅ ตาม (+${(round.currentBet || 0) - (mySeatState.roundBet || 0)}💰)`
                            : '✅ เช็ค (Check)'}
                        </button>
                        <button
                          type="button"
                          onClick={() => dispatchAction('raise', 10)}
                          className="rpg-btn-gold px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer"
                        >
                          ⬆️ เกทับ +10💰
                        </button>
                        <button
                          type="button"
                          onClick={() => dispatchAction('raise', 20)}
                          className="rpg-btn-blue px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer"
                        >
                          🔥 เกทับ +20💰
                        </button>
                        <button
                          type="button"
                          onClick={() => dispatchAction('fold')}
                          className="bg-rose-700 hover:bg-rose-600 text-white border-2 border-amber-300 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer"
                        >
                          🏳️ หมอบ
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-extrabold text-amber-200">
                        ⏳ รอตาของ {round.seats[round.turnIndex ?? 0]?.name || 'เพื่อน'}...
                      </span>
                    ))}

                  {round.gameType === 'oldmaid' && (
                    <div className="flex items-center gap-2">
                      {!mySeatState.safe && mySeatState.cards.length > 1 && (
                        <button
                          type="button"
                          onClick={() => dispatchAction('shuffle_hand')}
                          className="rpg-btn-blue px-4 py-2 rounded-xl text-xs font-extrabold cursor-pointer"
                        >
                          🔀 สลับไพ่ในมือหลอกเพื่อน
                        </button>
                      )}
                      <span className="text-xs font-extrabold text-amber-200">
                        {round.seats[round.turnIndex ?? 0]?.seatId === mySeat
                          ? '👆 แตะดึงไพ่จากมือเพื่อนด้านบน!'
                          : `⏳ รอ ${round.seats[round.turnIndex ?? 0]?.name || 'เพื่อน'} ดึงไพ่...`}
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* PHASE 3: SETTLED */}
              {round.phase === 'settled' && (
                <>
                  {initialIsHost ? (
                    <button
                      type="button"
                      disabled={settling}
                      onClick={() => {
                        const fresh = createFreshBettingRound(gameType, membersRef.current);
                        pushRoundSync(fresh);
                      }}
                      className="rpg-btn-gold px-6 py-2.5 rounded-xl text-sm font-extrabold cursor-pointer disabled:opacity-50"
                    >
                      {settling ? 'กำลังคิดเงิน...' : '🃏 เล่นรอบต่อไป!'}
                    </button>
                  ) : (
                    <span className="text-xs font-extrabold text-amber-200">
                      ⏳ รอหัวตี้กดแจกไพ่รอบต่อไป...
                    </span>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
