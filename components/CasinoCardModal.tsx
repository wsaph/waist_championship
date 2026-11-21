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
import {
  getQualityConfig,
  disposeObject3D,
  type QualityMode,
} from '@/lib/device_perf';
import type { VolleyballPlayerSummary } from '@/components/BeachVolleyballModal';
import {
  createShuffledDeck,
  createOldMaidDeck52,
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
  qualityMode?: QualityMode;
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
  points: number;
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
  oldMaidHiddenCard?: PlayingCard | null; // 1 secret mystery card from 52-card deck!
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
    title: 'อีแก่กินน้ำ (52 ใบ)',
    playersText: '2–5 คน',
    desc: 'สำรับเต็ม 52 ใบ สุ่มคว่ำ 1 ใบปริศนากลางโต๊ะ • คนสุดท้ายถือใบไร้คู่จ่ายรอบวง!',
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
  const rTxt = rankLabel(card.rank);
  const sTxt = SUIT_SYMBOL[card.suit];

  return (
    <div
      className={`${sizeCls} relative bg-gradient-to-b from-white to-slate-100 border-2 ${
        highlight
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
        {sTxt}
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
  const isCry = mood.id === 'cry';

  return (
    <div className="relative shrink-0">
      {isTroll && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-xl animate-bounce z-20 drop-shadow">
          👑
        </div>
      )}
      <div
        className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-3 ${mood.ringClass} bg-slate-900 transition-all duration-300 ${
          isTroll ? 'scale-105' : isCry ? 'scale-95' : ''
        }`}
      >
        <img
          src="/images/guard_face.jpg"
          alt="เจ้ามือพี่ยาม"
          className={`w-full h-full object-cover ${isCry ? 'saturate-50 brightness-90' : ''}`}
        />
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
  qualityMode = 'auto',
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

  const casinoCanvasRef = useRef<HTMLDivElement | null>(null);
  const guardMoodRef = useRef<GuardMoodMeta>(guardMood);
  guardMoodRef.current = guardMood;
  const guardBankRef = useRef(guardBank);
  guardBankRef.current = guardBank;

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
  const playersRef = useRef(players);
  playersRef.current = players;
  const handlePlayerActionAsHostRef = useRef<
    (seatId: SeatId, action: string, value?: number) => void
  >(() => {});

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

  const returnToLobbyAsHost = useCallback(() => {
    setRound(null);
    roundRef.current = null;
    setGuardMood(resolveGuardMood(0));
    screenRef.current = 'lobby';
    setScreen('lobby');
    sendRoomMsg('back_to_lobby', {});
    broadcastArenaLobby('waiting', gameTypeRef.current, membersRef.current);
  }, [sendRoomMsg, broadcastArenaLobby]);

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

          const updatedPlayers: Array<{ userId: number; points: number }> = Array.isArray(data.updatedPlayers)
            ? data.updatedPlayers
            : [];
          if (updatedPlayers.length > 0) {
            const nextMem = { ...membersRef.current };
            (Object.keys(nextMem) as SeatId[]).forEach((s) => {
              const m = nextMem[s];
              if (!m) return;
              const up = updatedPlayers.find((u) => u.userId === m.userId);
              if (up) nextMem[s] = { ...m, points: up.points };
            });
            setMembers(nextMem);
            membersRef.current = nextMem;
          }

          const updatedRound: CasinoRoundState = {
            ...finalRound,
            dealerNetGp: dealerNet,
          };
          // Guard against stale async settlement overwriting state after Host clicked "เปลี่ยนเกม"
          const stillSameRound =
            screenRef.current === 'table' &&
            roundRef.current === finalRound;
          if (stillSameRound) {
            setRound(updatedRound);
            roundRef.current = updatedRound;
            sendRoomMsg('round_sync', { round: updatedRound, guardBank: nextBank, guardMood: mood, members: membersRef.current });
          } else {
            sendRoomMsg('lobby_sync', { gameType: gameTypeRef.current, members: membersRef.current });
          }
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
      // Only members with >= 5 GP can play; players with < 5 GP stay as spectators!
      const seats: SeatRoundState[] = SEAT_ORDER.filter((s) => {
        const m = memObj[s];
        return Boolean(m) && (m!.points ?? 0) >= 5;
      }).map((s) => {
        const m = memObj[s]!;
        const defaultBet = m.points >= 10 ? 10 : 5;
        return {
          seatId: s,
          userId: m.userId,
          name: m.name,
          emoji: m.emoji,
          bet: defaultBet,
          ready: false,
          cards: [],
          done: false,
        };
      });
      return {
        gameType: gType,
        phase: 'betting',
        oldMaidStake: 5,
        oldMaidHiddenCard: null,
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
        const { dealDeck, hiddenCard } = createOldMaidDeck52();
        const buckets: PlayingCard[][] = cur.seats.map(() => []);
        let bi = 0;
        while (dealDeck.length > 0) {
          buckets[bi % cur.seats.length].push(dealDeck.pop()!);
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
          oldMaidHiddenCard: hiddenCard,
          deck: [],
          dealerCards: [],
          dealerRevealed: false,
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
            const hiddenTxt = cur.oldMaidHiddenCard
              ? `${rankLabel(cur.oldMaidHiddenCard.rank)}${SUIT_SYMBOL[cur.oldMaidHiddenCard.suit]}`
              : 'อีแก่';
            const settled: CasinoRoundState = {
              ...cur,
              phase: 'settled',
              dealerRevealed: true,
              seats: settledSeats,
              dealerNetGp: rakeGp,
              summaryText: `👵💧 เฉลยไพ่ปริศนา: ${hiddenTxt}! ${loser?.emoji || ''} ${loser?.name || 'คนแพ้'} ถือคู่ไร้คู่อยู่คามือ จ่ายรอบวงคนละ ${stake} 💰!`,
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
  handlePlayerActionAsHostRef.current = handlePlayerActionAsHost;

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
      points: currentUserPoints,
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
            points: Number(payload.points ?? 0),
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
        setGuardMood(resolveGuardMood(0));
        screenRef.current = 'table';
        setScreen('table');
      } else if (event === 'back_to_lobby') {
        screenRef.current = 'lobby';
        setScreen('lobby');
        setRound(null);
        roundRef.current = null;
        setGuardMood(resolveGuardMood(0));
      } else if (event === 'player_action' && isHostRef.current) {
        handlePlayerActionAsHostRef.current(
          payload.seatId as SeatId,
          String(payload.action || ''),
          payload.value !== undefined ? Number(payload.value) : undefined
        );
      } else if (event === 'round_sync' && !isHostRef.current) {
        const incRound = payload.round as CasinoRoundState | undefined;
        if (
          incRound &&
          screenRef.current === 'table' &&
          incRound.gameType === gameTypeRef.current
        ) {
          setRound(incRound);
          roundRef.current = incRound;
        }
        if (payload.guardBank) {
          const b = payload.guardBank as { guardBalance: number; guardTotalWon: number; guardRoundsPlayed: number };
          setGuardBank(b);
          onPointsUpdatedRef.current?.();
        }
        if (payload.members) {
          const incMem = payload.members as Partial<Record<SeatId, TableMember>>;
          setMembers(incMem);
          membersRef.current = incMem;
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

  // ============================================================
  // 3D CASINO TABLE + LIVE EXPRESSIVE 3D GUARD DEALER SCENE
  // ============================================================
  useEffect(() => {
    if (!isOpen || screen !== 'table' || !casinoCanvasRef.current) return;
    const container = casinoCanvasRef.current;
    container.innerHTML = '';

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    const qCfg = getQualityConfig(qualityMode);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1320);
    scene.fog = new THREE.FogExp2(0x0b1320, 0.032);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 80);
    const updateCam = (w: number, h: number) => {
      const aspect = Math.max(0.45, w / Math.max(1, h));
      const pullBack = aspect < 1.15 ? (1.15 / aspect) * 0.78 : 1;
      camera.aspect = aspect;
      // Movie-style angled overhead shot framing the full round table, 3D Guard, and all seated players
      camera.position.set(0, 5.7 * Math.max(1, pullBack * 0.88), 7.6 * Math.max(1, pullBack));
      camera.lookAt(0, 0.95, -0.35);
      camera.updateProjectionMatrix();
    };
    updateCam(width, height);

    const renderer = new THREE.WebGLRenderer({ antialias: qCfg.antialias });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, qCfg.maxPixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = qCfg.shadowType;
    container.appendChild(renderer.domElement);

    // Warm Casino Overhead Spotlight + Rim Lights + Ambient Floor
    scene.add(new THREE.HemisphereLight(0xfef3c7, 0x052e16, 0.9));
    const spotLight = new THREE.DirectionalLight(0xfffbeb, 1.45);
    spotLight.position.set(1.5, 9.5, 5.5);
    spotLight.castShadow = true;
    const sSize = Math.min(1024, qCfg.shadowMapSize);
    spotLight.shadow.mapSize.set(sSize, sSize);
    scene.add(spotLight);

    const rimLight = new THREE.DirectionalLight(0xfacc15, 0.6);
    rimLight.position.set(-4, 5, -4);
    scene.add(rimLight);

    // Plush Dark Casino Carpet Floor
    const floorMesh = new THREE.Mesh(
      new THREE.CircleGeometry(14, 48),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.92 })
    );
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = 0;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Luxury Round Emerald Felt Casino Table (True Circle: radius 2.65)
    const TABLE_RADIUS = 2.65;
    const tableGroup = new THREE.Group();
    const felt = new THREE.Mesh(
      new THREE.CylinderGeometry(TABLE_RADIUS, TABLE_RADIUS, 0.22, 48),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 })
    );
    felt.position.y = 0.88;
    felt.receiveShadow = true;
    tableGroup.add(felt);

    // Mahogany Wood & Gold Beveled Rail
    const woodRim = new THREE.Mesh(
      new THREE.TorusGeometry(TABLE_RADIUS + 0.05, 0.22, 14, 56),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.42, metalness: 0.15 })
    );
    woodRim.rotation.x = Math.PI / 2;
    woodRim.position.y = 1.0;
    woodRim.castShadow = true;
    tableGroup.add(woodRim);

    const goldLine = new THREE.Mesh(
      new THREE.TorusGeometry(TABLE_RADIUS - 0.55, 0.03, 8, 56),
      new THREE.MeshBasicMaterial({ color: 0xfacc15 })
    );
    goldLine.rotation.x = Math.PI / 2;
    goldLine.position.y = 0.995;
    tableGroup.add(goldLine);

    // Pedestal under table
    const tableBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.55, 0.88, 24),
      new THREE.MeshStandardMaterial({ color: 0x271202, roughness: 0.7 })
    );
    tableBase.position.y = 0.44;
    tableGroup.add(tableBase);

    // Card Shoe & Stack of Casino Chips on Table
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.28, 0.68),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.5 })
    );
    shoe.position.set(1.25, 1.13, -1.2);
    shoe.rotation.y = -0.5;
    tableGroup.add(shoe);

    // Guard's Gold Chip Stacks (grow visually with Guard Bank!)
    const guardChipsGroup = new THREE.Group();
    const chipMatGold = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.72, roughness: 0.22 });
    const chipMatRed = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
    const chipMatBlue = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.35 });
    const chipMats = [chipMatGold, chipMatRed, chipMatBlue, chipMatGold, chipMatGold];
    const chipStacks: THREE.Mesh[] = [];
    for (let si = 0; si < 5; si++) {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 16), chipMats[si]);
      stack.position.set(-1.35 + si * 0.28, 1.1, -1.3 + (si % 2) * 0.18);
      stack.castShadow = true;
      guardChipsGroup.add(stack);
      chipStacks.push(stack);
    }
    tableGroup.add(guardChipsGroup);

    // Center Betting Pot Chips
    const potChipGroup = new THREE.Group();
    for (let pi = 0; pi < 6; pi++) {
      const a = (pi / 6) * Math.PI * 2;
      const chip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.15, 0.1 + (pi % 3) * 0.07, 14),
        pi % 2 === 0 ? chipMatGold : chipMatRed
      );
      chip.position.set(Math.cos(a) * 0.3, 1.05, Math.sin(a) * 0.28);
      potChipGroup.add(chip);
    }
    potChipGroup.position.set(0, 0, -0.1);
    tableGroup.add(potChipGroup);

    scene.add(tableGroup);

    // Helper: Velvet Casino Chair facing local +X
    const chairWoodMat = new THREE.MeshStandardMaterial({ color: 0x3b1706, roughness: 0.55 });
    const chairVelvetMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.85 });
    const createCasinoChair = (x: number, z: number, yaw: number) => {
      const cg = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.86), chairVelvetMat);
      seat.position.y = 0.56;
      seat.castShadow = true;
      cg.add(seat);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.92, 0.86), chairVelvetMat);
      back.position.set(-0.38, 1.02, 0);
      back.castShadow = true;
      cg.add(back);
      const legGeo = new THREE.CylinderGeometry(0.05, 0.04, 0.56, 8);
      [
        [-0.34, -0.34],
        [0.34, -0.34],
        [-0.34, 0.34],
        [0.34, 0.34],
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(legGeo, chairWoodMat);
        leg.position.set(lx, 0.28, lz);
        cg.add(leg);
      });
      cg.position.set(x, 0, z);
      cg.rotation.y = yaw;
      scene.add(cg);
    };

    // ==================== 3D GUARD DEALER AT 12 O'CLOCK OF ROUND TABLE ====================
    const guardParts = buildCustomGuardCharacter();
    const GUARD_Z = -3.4;
    guardParts.rootGroup.position.set(0, 0.18, GUARD_Z);
    guardParts.rootGroup.rotation.y = -Math.PI / 2; // local +X -> +Z (facing table center & camera!)
    guardParts.rootGroup.scale.setScalar(1.18);
    scene.add(guardParts.rootGroup);
    createCasinoChair(0, GUARD_Z - 0.28, -Math.PI / 2);

    // 3D Expressive Facial Features mounted accurately on Guard's 3D Head (headGroup at x=0.04, y=2.12, z=0; front x≈0.56)
    const guardCrown = new THREE.Group();
    const crownBand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.28, 0.24, 8),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.78, roughness: 0.2 })
    );
    guardCrown.add(crownBand);
    for (let ci = 0; ci < 5; ci++) {
      const a = (ci / 5) * Math.PI * 2;
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.08, 0.2, 5),
        new THREE.MeshStandardMaterial({ color: 0xfde047, metalness: 0.8, roughness: 0.2 })
      );
      spike.position.set(Math.cos(a) * 0.26, 0.2, Math.sin(a) * 0.26);
      guardCrown.add(spike);
    }
    guardCrown.position.set(0.04, 2.78, 0);
    guardCrown.visible = false;
    guardParts.bounceGroup.add(guardCrown);

    // 3D Expressive Eyebrows (change angle & height with every mood!)
    const browMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 });
    const browL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.055, 0.22), browMat);
    browL.position.set(0.56, 2.34, -0.17);
    const browR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.055, 0.22), browMat);
    browR.position.set(0.56, 2.34, 0.17);
    guardParts.bounceGroup.add(browL, browR);

    // 3D Cool Deal-With-It Sunglasses (drops down when Guard wins!)
    const guardShades = new THREE.Group();
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.12, metalness: 0.85 });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.8, roughness: 0.2 });
    const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.24), lensMat);
    lensL.position.set(0.58, 2.2, -0.17);
    const lensR = lensL.clone();
    lensR.position.z = 0.17;
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.62), frameMat);
    bridge.position.set(0.59, 2.25, 0);
    guardShades.add(lensL, lensR, bridge);
    guardShades.visible = false;
    guardParts.bounceGroup.add(guardShades);

    // 3D Punchable Wide Toothy Grin (scales bigger from smirk -> grin -> mega_troll!)
    const guardGrin = new THREE.Group();
    const smileOuter = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.14, 0.38),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    const smileBorder = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.18, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x1e293b })
    );
    smileBorder.position.x = -0.012;
    guardGrin.add(smileBorder, smileOuter);
    guardGrin.position.set(0.55, 1.9, 0);
    guardGrin.visible = false;
    guardParts.bounceGroup.add(guardGrin);

    // 3D Frown / Trembling Mouth when Guard is Annoyed or Crying!
    const guardFrown = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.028, 8, 16, Math.PI),
      new THREE.MeshBasicMaterial({ color: 0x1e293b })
    );
    guardFrown.rotation.y = Math.PI / 2;
    guardFrown.position.set(0.55, 1.84, 0);
    guardFrown.visible = false;
    guardParts.bounceGroup.add(guardFrown);

    // 3D Red Angry Vein Mark (💢) on forehead when annoyed!
    const angryMark = new THREE.Group();
    const veinMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
    const vBar1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.045), veinMat);
    const vBar2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.18), veinMat);
    angryMark.add(vBar1, vBar2);
    angryMark.position.set(0.51, 2.48, -0.3);
    angryMark.visible = false;
    guardParts.bounceGroup.add(angryMark);

    // 3D Blue Tear Drops streaming from Guard's eyes when losing!
    const tearMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const tearL = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), tearMat);
    tearL.scale.set(0.8, 1.5, 0.8);
    tearL.position.set(0.57, 2.12, -0.19);
    const tearR = tearL.clone();
    tearR.position.z = 0.19;
    const tearGroup = new THREE.Group();
    tearGroup.add(tearL, tearR);
    tearGroup.visible = false;
    guardParts.bounceGroup.add(tearGroup);

    // 3D Sparkling Coins floating around Guard on mega_troll!
    const trollCoins: THREE.Mesh[] = [];
    for (let tc = 0; tc < 8; tc++) {
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.04, 14),
        chipMatGold
      );
      coin.rotation.x = Math.PI / 2;
      const a = (tc / 8) * Math.PI * 2;
      coin.position.set(Math.cos(a) * 1.15, 1.8 + (tc % 3) * 0.45, GUARD_Z + Math.sin(a) * 0.7);
      coin.visible = false;
      scene.add(coin);
      trollCoins.push(coin);
    }

    // ==================== 3D SEATED PLAYERS AROUND THE ROUND TABLE (OUTSIDE EDGE, FACING INWARD!) ====================
    // Angles around circle (radians, 0 = +X right, PI/2 = +Z front closest to camera, PI = -X left; Guard is at -PI/2)
    const seatAnglesByCount: Record<number, number[]> = {
      1: [Math.PI * 0.5],
      2: [Math.PI * 0.72, Math.PI * 0.28],
      3: [Math.PI * 0.82, Math.PI * 0.5, Math.PI * 0.18],
      4: [Math.PI * 0.9, Math.PI * 0.64, Math.PI * 0.36, Math.PI * 0.1],
      5: [Math.PI * 0.96, Math.PI * 0.73, Math.PI * 0.5, Math.PI * 0.27, Math.PI * 0.04],
    };
    const SEAT_RADIUS = 3.45; // Outside TABLE_RADIUS (2.65) so full bodies sit cleanly outside the table!
    const CHAIR_RADIUS = 3.72;
    const seatChars: CharacterMeshParts[] = [];
    const activeMembers = SEAT_ORDER.filter((s) => Boolean(membersRef.current[s])).map((s) => membersRef.current[s]!);
    const angles = seatAnglesByCount[Math.min(5, Math.max(1, activeMembers.length))] || seatAnglesByCount[5];
    activeMembers.forEach((m, idx) => {
      const found = playersRef.current.find((p) => p.id === m.userId);
      const theta = angles[idx % angles.length];
      const px = Math.cos(theta) * SEAT_RADIUS;
      const pz = Math.sin(theta) * SEAT_RADIUS;
      const cx = Math.cos(theta) * CHAIR_RADIUS;
      const cz = Math.sin(theta) * CHAIR_RADIUS;
      // Local +X rotated by yaw points toward (cos(yaw), -sin(yaw)) -> atan2(pz, -px) faces (0, 0) exactly!
      const yaw = Math.atan2(pz, -px);

      createCasinoChair(cx, cz, yaw);

      const cp = buildCharacterMesh({
        colorHex: found?.colorHex || '#F8FAFC',
        accessory: 'none',
        bandColor: found?.bandColor || '#FACC15',
        bellyScale: found?.bellyScale ?? found?.bmiBellyScale ?? 1,
        muscleScale: found?.muscleScale ?? 1,
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
        animSeed: idx * 1.3,
      });
      cp.rootGroup.position.set(px, 0.28, pz);
      cp.rootGroup.rotation.y = yaw;
      cp.rootGroup.scale.setScalar(0.92);
      scene.add(cp.rootGroup);
      seatChars.push(cp);
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
    let t = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      if (typeof document !== 'undefined' && document.hidden) {
        clock.getDelta();
        return;
      }
      const delta = Math.min(0.04, clock.getDelta());
      t += delta;

      const moodId = guardMoodRef.current.id;
      const isTroll = moodId === 'mega_troll';
      const isGrin = moodId === 'grin';
      const isSmirk = moodId === 'smirk';
      const isCry = moodId === 'cry';
      const isAnnoyed = moodId === 'annoyed';

      // Toggle 3D Guard Facial Expressions directly on the 3D Guard Head!
      guardCrown.visible = isTroll;
      guardShades.visible = isSmirk || isGrin || isTroll;
      guardGrin.visible = isSmirk || isGrin || isTroll;
      guardFrown.visible = isAnnoyed || isCry;
      angryMark.visible = isAnnoyed;
      tearGroup.visible = isCry;

      // Animate 3D Eyebrows + Mouth + Body per mood
      if (isTroll) {
        browL.position.y = 2.42;
        browR.position.y = 2.42;
        browL.rotation.x = 0.25;
        browR.rotation.x = -0.25;
        guardGrin.scale.set(1.2, 1.35 + Math.sin(t * 18) * 0.2, 1.25);
        guardCrown.rotation.y = t * 1.8;
        guardParts.bounceGroup.position.y = Math.abs(Math.sin(t * 10)) * 0.2;
        guardParts.bounceGroup.rotation.z = Math.sin(t * 8) * 0.1;
        guardParts.armL.rotation.z = 2.1 + Math.sin(t * 14) * 0.45;
        guardParts.armR.rotation.z = -2.1 - Math.sin(t * 14) * 0.45;
      } else if (isGrin) {
        browL.position.y = 2.39;
        browR.position.y = 2.39;
        browL.rotation.x = 0.15;
        browR.rotation.x = -0.15;
        guardGrin.scale.set(1.08, 1.05 + Math.sin(t * 12) * 0.12, 1.08);
        guardParts.bounceGroup.position.y = Math.abs(Math.sin(t * 6.5)) * 0.11;
        guardParts.bounceGroup.rotation.z = Math.sin(t * 4.5) * 0.05;
        guardParts.armL.rotation.z = 1.2 + Math.sin(t * 8) * 0.3;
        guardParts.armR.rotation.z = -1.2 - Math.sin(t * 8) * 0.3;
      } else if (isSmirk) {
        browL.position.y = 2.39;
        browR.position.y = 2.32;
        browL.rotation.x = 0.22;
        browR.rotation.x = -0.08;
        guardGrin.scale.set(1, 0.58, 0.72);
        guardParts.bounceGroup.position.y = Math.sin(t * 3.5) * 0.04;
        guardParts.bounceGroup.rotation.z = 0.05;
        guardParts.armL.rotation.z = 0.45;
        guardParts.armR.rotation.z = -0.45;
      } else if (isCry) {
        browL.position.y = 2.32;
        browR.position.y = 2.32;
        browL.rotation.x = -0.35;
        browR.rotation.x = 0.35;
        guardFrown.scale.set(1, 1 + Math.sin(t * 24) * 0.14, 1);
        guardParts.bounceGroup.position.y = -0.06 + Math.sin(t * 22) * 0.03;
        guardParts.bounceGroup.rotation.z = Math.sin(t * 24) * 0.07;
        guardParts.armL.rotation.z = 2.45;
        guardParts.armR.rotation.z = -2.45;
        tearL.position.y = 2.12 - ((t * 1.1) % 0.34);
        tearR.position.y = 2.12 - (((t * 1.1) + 0.17) % 0.34);
      } else if (isAnnoyed) {
        browL.position.y = 2.3;
        browR.position.y = 2.3;
        browL.rotation.x = 0.42;
        browR.rotation.x = -0.42;
        guardFrown.scale.set(1, 0.8, 1);
        const pulse = 1 + Math.sin(t * 14) * 0.18;
        angryMark.scale.setScalar(pulse);
        guardParts.bounceGroup.position.y = 0;
        guardParts.bounceGroup.rotation.z = Math.sin(t * 14) * 0.04;
        guardParts.armL.rotation.z = 0.9;
        guardParts.armR.rotation.z = -0.9;
      } else {
        browL.position.y = 2.34;
        browR.position.y = 2.34;
        browL.rotation.x = 0;
        browR.rotation.x = 0;
        guardParts.bounceGroup.position.y = Math.sin(t * 2.5) * 0.03;
        guardParts.bounceGroup.rotation.z = 0;
        guardParts.armL.rotation.z = Math.sin(t * 2.8) * 0.18;
        guardParts.armR.rotation.z = -Math.sin(t * 2.8) * 0.18;
      }

      // Update Guard's Gold Chip Stack height based on persistent Guard Bank!
      const bankScale = Math.min(3.5, Math.max(0.4, 0.5 + guardBankRef.current.guardBalance / 80));
      chipStacks.forEach((st, idx) => {
        const sy = bankScale * (0.7 + (idx % 3) * 0.25);
        st.scale.y = sy;
        st.position.y = 0.95 + sy * 0.14;
      });

      // Floating gold coins around Guard on mega_troll!
      trollCoins.forEach((coin, idx) => {
        coin.visible = isTroll || isGrin;
        if (coin.visible) {
          coin.rotation.y = t * 4 + idx;
          coin.position.y = 1.35 + ((t * 1.1 + idx * 0.35) % 1.45);
        }
      });

      // Subtle idle animation for seated 3D player avatars
      seatChars.forEach((cp, idx) => {
        cp.mixer?.update(delta);
        if (cp.auraSpinGroup) cp.auraSpinGroup.rotation.y = t * 1.5;
        if (!cp.mixer) {
          cp.bounceGroup.position.y = Math.sin(t * 2.6 + idx) * 0.04;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      seatChars.forEach((cp) => {
        cp.rootGroup.userData.disposed = true;
      });
      disposeObject3D(scene);
      renderer.dispose();
    };
  }, [isOpen, screen, qualityMode]);

  if (!isOpen) return null;

  const joinedCount = Object.keys(members).length;
  const playableCount = Object.values(members).filter((m) => (m?.points ?? 0) >= 5).length;
  const minPlayersNeeded = gameType === 'oldmaid' ? 2 : 1;
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
                  const isBroke = Boolean(m) && (m!.points ?? 0) < 5;
                  return (
                    <div
                      key={sid}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-extrabold ${
                        isBroke
                          ? 'bg-slate-900/90 border-rose-400/60 text-rose-200'
                          : m
                          ? 'bg-emerald-950/90 border-amber-300 text-amber-100'
                          : 'bg-slate-950/70 border-dashed border-slate-700 text-slate-500'
                      }`}
                    >
                      {m
                        ? `${m.emoji} ${m.name}${sid === mySeat ? ' (คุณ)' : ''}${
                            isBroke ? ' 👀 นั่งดู (GP หมด)' : ''
                          }`
                        : `ที่นั่ง ${idx + 1} (ว่าง)`}
                    </div>
                  );
                })}
              </div>
              {currentUserPoints < 5 && (
                <div className="bg-rose-950/80 border border-rose-400/70 rounded-xl px-3 py-1.5 text-[11px] font-bold text-rose-200">
                  💸 GP ของคุณไม่พอเดิมพัน (ต้องมีอย่างน้อย 5 GP) — คุณสามารถเข้าห้องไป **นั่งดูเพื่อนเล่น** ได้อย่างเดียวครับ!
                </div>
              )}
            </div>

            {initialIsHost ? (
              <button
                type="button"
                disabled={playableCount < minPlayersNeeded}
                onClick={() => {
                  const fresh = createFreshBettingRound(gameType, membersRef.current);
                  setGuardMood(resolveGuardMood(0));
                  setRound(fresh);
                  roundRef.current = fresh;
                  screenRef.current = 'table';
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
                {playableCount < minPlayersNeeded
                  ? gameType === 'oldmaid'
                    ? `⏳ อีแก่กินน้ำต้องมีคนที่มี GP ≥ 5 อย่างน้อย 2 คน (ตอนนี้ ${playableCount}/2)`
                    : '💸 ต้องมีผู้เล่นที่มี GP ≥ 5 อย่างน้อย 1 คนถึงจะเปิดโต๊ะได้'
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
        /* ==================== 3D CASINO TABLE + FLOATING HUD SCREEN ==================== */
        <div className="relative w-full h-dvh overflow-hidden flex flex-col justify-between">
          {/* Full-Screen 3D Casino Table & Expressive 3D Guard Dealer Backdrop */}
          <div ref={casinoCanvasRef} className="fixed inset-0 w-full h-full z-0 pointer-events-none" />

          {/* Top Bar: Exit + Game Badge + Persistent Guard Bank + Sound */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-2.5 sm:px-4 pt-2.5 sm:pt-3 pt-safe">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-amber-100 hover:bg-rose-600 cursor-pointer"
              >
                ← ออก
              </button>
              {initialIsHost && (
                <button
                  type="button"
                  onClick={returnToLobbyAsHost}
                  className="rpg-panel px-2.5 py-1.5 rounded-xl text-xs font-extrabold text-amber-200 hover:bg-amber-400 hover:text-black cursor-pointer"
                >
                  🔄 เปลี่ยนเกม
                </button>
              )}
            </div>

            <div className="rpg-banner rounded-full px-3 sm:px-4 py-1 text-xs font-extrabold flex items-center gap-2 shadow-xl">
              <span>{activeGameMeta.icon} {activeGameMeta.title}</span>
              <span className="text-amber-300">|</span>
              <span className="text-yellow-300">🏦 คลังพี่ยาม: {guardBank.guardBalance.toLocaleString()} 💰</span>
              <span className="hidden md:inline text-emerald-300 text-[10.5px]">
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

          {/* UPPER STAGE OVERLAY: Clean Speech Bubble only (3D Guard Dealer & full round table stay completely unobstructed!) */}
          <div className="relative z-10 flex flex-col items-center px-3 pt-1 pointer-events-none">
            <div className="flex items-center gap-2 bg-slate-950/65 backdrop-blur-xs border border-amber-400/70 rounded-full px-3 py-1 shadow-xl max-w-[94vw]">
              <span className="shrink-0 bg-amber-400/20 border border-amber-300/70 text-amber-200 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                {guardMood.badge}
              </span>
              <div className="text-xs font-extrabold text-amber-100 truncate">
                💬 &ldquo;{guardMood.speech}&rdquo;
              </div>
            </div>

            {/* Dealer Cards / Hold'em Community Cards floating cleanly over the 3D green felt */}
            {round && round.dealerCards.length > 0 && (
              <div className="mt-2 flex items-center justify-center gap-2 bg-black/45 backdrop-blur-xs border border-amber-400/50 rounded-2xl px-3 py-1.5 shadow-xl pointer-events-auto">
                <span className="text-[10.5px] font-extrabold text-amber-300">👮 เจ้ามือ:</span>
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

            {round && round.gameType === 'holdem' && round.phase !== 'betting' && (
              <div className="mt-2 bg-black/50 backdrop-blur-xs border border-amber-400/60 rounded-2xl px-3 py-1.5 text-center space-y-1 shadow-xl pointer-events-auto">
                <div className="text-xs font-extrabold text-amber-300">
                  💰 กองกลาง (Pot): {round.pot || 0} GP • {(round.street || 'preflop').toUpperCase()}
                </div>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
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

            {/* Old Maid Secret Mystery Card (1 hidden card from full 52-card deck!) */}
            {round && round.gameType === 'oldmaid' && round.oldMaidHiddenCard && (
              <div className="mt-2 flex items-center justify-center gap-2.5 bg-black/55 backdrop-blur-xs border border-amber-400/70 rounded-2xl px-3.5 py-1.5 shadow-xl pointer-events-auto">
                <span className="text-[11px] font-extrabold text-amber-200">
                  {round.dealerRevealed ? '👵 เฉลยไพ่ปริศนา (อีแก่):' : '❓ ไพ่ปริศนา 1/52 ใบ:'}
                </span>
                <PlayingCardView
                  card={round.oldMaidHiddenCard}
                  compact
                  faceDown={!round.dealerRevealed}
                  highlight={round.dealerRevealed}
                />
              </div>
            )}

            {round && round.phase === 'settled' && round.summaryText && (
              <div className="mt-2 rpg-btn-gold px-4 py-1.5 rounded-2xl text-xs sm:text-sm font-extrabold text-center shadow-xl max-w-xl">
                {round.summaryText}
              </div>
            )}

            {/* Old Maid Interactive Draw Fan */}
            {round &&
              round.gameType === 'oldmaid' &&
              round.phase === 'playing' &&
              oldMaidTargetSeat &&
              round.seats[round.turnIndex ?? 0]?.seatId === mySeat && (
                <div className="mt-2 bg-amber-950/90 border-2 border-yellow-300 rounded-2xl p-2.5 text-center space-y-1.5 shadow-2xl max-w-xl w-full pointer-events-auto">
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
          </div>

          {/* BOTTOM DOCK: Slim Player Hand Strip + Action Bar (keeps 3D round table & seated players clearly visible!) */}
          <div className="relative z-10 mt-auto px-2 sm:px-4 pb-2 sm:pb-3 pb-safe space-y-1.5 max-w-5xl w-full mx-auto">
            {round && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 justify-start sm:justify-center">
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
                      className={`shrink-0 ${
                        isMe ? 'min-w-[155px] sm:min-w-[185px]' : 'min-w-[125px] sm:min-w-[148px]'
                      } rounded-xl px-2 py-1.5 border-2 backdrop-blur-xs transition ${
                        isTurn
                          ? 'bg-amber-500/30 border-yellow-300 shadow-[0_0_16px_rgba(250,204,21,0.7)]'
                          : isMe
                          ? 'bg-slate-950/75 border-amber-400'
                          : 'bg-slate-950/55 border-emerald-400/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="text-[11px] font-extrabold text-amber-100 truncate">
                          {seat.emoji} {seat.name} {isMe ? '⭐' : ''}
                        </div>
                        <div className="text-[10px] font-extrabold text-amber-300 shrink-0">
                          {round.gameType === 'oldmaid'
                            ? seat.safe
                              ? '✅ รอด!'
                              : `${seat.cards.length} ใบ`
                            : `${seat.bet}💰`}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-1 min-h-[52px]">
                        {seat.cards.length === 0 ? (
                          <span className="text-[10.5px] font-bold text-emerald-200/80">
                            {round.phase === 'betting'
                              ? seat.ready
                                ? '✅ พร้อมแล้ว'
                                : 'เลือกชิป...'
                              : seat.safe
                              ? '🎉 รอดแล้ว!'
                              : 'รอแจก...'}
                          </span>
                        ) : (
                          seat.cards.map((c) => (
                            <PlayingCardView
                              key={c.id}
                              card={c}
                              compact
                              faceDown={!showFaceUp}
                              highlight={
                                round.gameType === 'oldmaid' &&
                                round.phase === 'settled' &&
                                !seat.safe
                              }
                            />
                          ))
                        )}
                      </div>

                      <div className="mt-1.5 text-center min-h-[16px]">
                        {seat.resultLabel ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black ${
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
                          <span className="text-[10.5px] font-extrabold text-yellow-300">
                            {evaluatePokDengHand(seat.cards).label}
                          </span>
                        ) : isMe && seat.cards.length > 0 && round.gameType === 'blackjack' ? (
                          <span className="text-[10.5px] font-extrabold text-yellow-300">
                            {evaluateBlackjackHand(seat.cards).label}
                          </span>
                        ) : isMe && seat.cards.length > 0 && round.gameType === 'holdem' && round.community.length >= 3 ? (
                          <span className="text-[10.5px] font-extrabold text-yellow-300">
                            {evaluateTexasHoldem7([...seat.cards, ...round.community]).label}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          {/* BOTTOM ACTION BAR (Context-aware for all 4 games + Spectator Lock when GP < 5!) */}
          {round && (
            <div className="z-10 max-w-2xl w-full mx-auto rpg-panel rounded-2xl p-2.5 sm:p-3 flex flex-wrap items-center justify-center gap-2 shadow-2xl">
              {/* SPECTATOR BANNER when current user has < 5 GP */}
              {!mySeatState && round.phase !== 'settled' && (
                <div className="text-xs font-extrabold text-rose-200 text-center py-0.5">
                  👀 โหมดผู้ชม (GP ของคุณมี {currentUserPoints} GP น้อยกว่าขั้นต่ำ 5 GP — นั่งดูเพื่อนเล่นได้อย่างเดียวนะ!)
                </div>
              )}

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
                        const canAfford = chip <= currentUserPoints;
                        const canPick =
                          (round.gameType === 'oldmaid' ? initialIsHost : !mySeatState.ready) && canAfford;
                        return (
                          <button
                            key={chip}
                            type="button"
                            disabled={!canPick}
                            onClick={() => dispatchAction('set_bet', chip)}
                            className={`px-3 py-1.5 rounded-full text-xs font-black border-2 cursor-pointer transition disabled:opacity-35 disabled:cursor-not-allowed ${
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
                    disabled={mySeatState.ready || currentUserPoints < 5 || mySeatState.bet > currentUserPoints}
                    onClick={() => dispatchAction('ready_bet')}
                    className="rpg-btn-gold px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-50"
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
                        {mySeatState.cards.length === 2 && mySeatState.bet * 2 <= currentUserPoints && (
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
                          disabled={mySeatState.bet + 10 > currentUserPoints}
                          onClick={() => dispatchAction('raise', 10)}
                          className="rpg-btn-gold px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-40"
                        >
                          ⬆️ เกทับ +10💰
                        </button>
                        <button
                          type="button"
                          disabled={mySeatState.bet + 20 > currentUserPoints}
                          onClick={() => dispatchAction('raise', 20)}
                          className="rpg-btn-blue px-3.5 py-2 rounded-xl text-xs sm:text-sm font-extrabold cursor-pointer disabled:opacity-40"
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
                        if (fresh.seats.length < (gameType === 'oldmaid' ? 2 : 1)) {
                          returnToLobbyAsHost();
                          return;
                        }
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
        </div>
      )}
    </div>
  );
}
