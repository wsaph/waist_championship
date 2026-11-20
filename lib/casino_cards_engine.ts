export type CasinoGameType = 'pokdeng' | 'blackjack' | 'holdem' | 'oldmaid';
export type CardSuit = 'S' | 'H' | 'D' | 'C';
export type CardRank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13; // 1=A, 11=J, 12=Q, 13=K

export interface PlayingCard {
  id: string;
  suit: CardSuit;
  rank: CardRank;
}

export const SUIT_SYMBOL: Record<CardSuit, string> = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
};

export const SUIT_IS_RED: Record<CardSuit, boolean> = {
  S: false,
  H: true,
  D: true,
  C: false,
};

export function rankLabel(rank: CardRank): string {
  if (rank === 1) return 'A';
  if (rank === 11) return 'J';
  if (rank === 12) return 'Q';
  if (rank === 13) return 'K';
  return String(rank);
}

export function createShuffledDeck(excludeCardId?: string): PlayingCard[] {
  const suits: CardSuit[] = ['S', 'H', 'D', 'C'];
  const deck: PlayingCard[] = [];
  for (const suit of suits) {
    for (let r = 1; r <= 13; r++) {
      const rank = r as CardRank;
      const id = `${rank}${suit}`;
      if (excludeCardId && id === excludeCardId) continue;
      deck.push({ id, suit, rank });
    }
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ============================================================
// 1. POK DENG (ป๊อกเด้ง) EVALUATOR
// ============================================================
export interface PokDengEval {
  tier: number; // 7=Pok9, 6=Pok8, 5=Tong, 4=StraightFlush, 3=Straight, 2=Sian, 1=Normal
  points: number; // 0..9
  deng: number; // 1, 2, 3, or 5
  label: string;
  isPok: boolean;
}

function pokCardVal(rank: CardRank): number {
  if (rank >= 10) return 0;
  return rank;
}

function isThreeCardStraight(ranks: CardRank[]): boolean {
  if (ranks.length !== 3) return false;
  const s = [...ranks].sort((a, b) => a - b);
  if (s[0] + 1 === s[1] && s[1] + 1 === s[2]) return true;
  // Q-K-A straight
  if (s[0] === 1 && s[1] === 12 && s[2] === 13) return true;
  return false;
}

export function evaluatePokDengHand(cards: PlayingCard[]): PokDengEval {
  if (cards.length === 0) {
    return { tier: 1, points: 0, deng: 1, label: '0 แต้ม', isPok: false };
  }
  const sum = cards.reduce((acc, c) => acc + pokCardVal(c.rank), 0);
  const points = sum % 10;
  const allSameSuit = cards.every((c) => c.suit === cards[0].suit);

  if (cards.length === 2) {
    const isPair = cards[0].rank === cards[1].rank;
    const deng = allSameSuit || isPair ? 2 : 1;
    if (points === 9) {
      return {
        tier: 7,
        points: 9,
        deng,
        label: deng > 1 ? `🔥 ป๊อก 9 (${deng} เด้ง!)` : '🔥 ป๊อก 9!',
        isPok: true,
      };
    }
    if (points === 8) {
      return {
        tier: 6,
        points: 8,
        deng,
        label: deng > 1 ? `⚡ ป๊อก 8 (${deng} เด้ง!)` : '⚡ ป๊อก 8!',
        isPok: true,
      };
    }
    return {
      tier: 1,
      points,
      deng,
      label: deng > 1 ? `${points} แต้ม (${deng} เด้ง)` : `${points} แต้ม`,
      isPok: false,
    };
  }

  // 3 cards
  const ranks = cards.map((c) => c.rank);
  const isTong = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  if (isTong) {
    return { tier: 5, points, deng: 5, label: `👑 ตอง ${rankLabel(ranks[0])}! (×5)`, isPok: false };
  }
  const isStraight = isThreeCardStraight(ranks);
  if (isStraight && allSameSuit) {
    return { tier: 4, points, deng: 5, label: '💎 สเตรทฟลัช! (×5)', isPok: false };
  }
  if (isStraight) {
    return { tier: 3, points, deng: 3, label: '✨ ไพ่เรียง! (×3)', isPok: false };
  }
  const isSian = ranks.every((r) => r >= 11);
  if (isSian) {
    return { tier: 2, points, deng: 3, label: '🎩 เซียน / สามเหลือง! (×3)', isPok: false };
  }
  const deng = allSameSuit ? 3 : 1;
  return {
    tier: 1,
    points,
    deng,
    label: deng > 1 ? `${points} แต้ม (${deng} เด้ง)` : `${points} แต้ม`,
    isPok: false,
  };
}

export function comparePokDeng(
  playerCards: PlayingCard[],
  dealerCards: PlayingCard[]
): { outcome: 'win' | 'lose' | 'tie'; multiplier: number; playerEval: PokDengEval; dealerEval: PokDengEval } {
  const playerEval = evaluatePokDengHand(playerCards);
  const dealerEval = evaluatePokDengHand(dealerCards);

  if (playerEval.tier !== dealerEval.tier) {
    if (playerEval.tier > dealerEval.tier) {
      return { outcome: 'win', multiplier: playerEval.deng, playerEval, dealerEval };
    }
    return { outcome: 'lose', multiplier: dealerEval.deng, playerEval, dealerEval };
  }
  if (playerEval.points !== dealerEval.points) {
    if (playerEval.points > dealerEval.points) {
      return { outcome: 'win', multiplier: playerEval.deng, playerEval, dealerEval };
    }
    return { outcome: 'lose', multiplier: dealerEval.deng, playerEval, dealerEval };
  }
  return { outcome: 'tie', multiplier: 0, playerEval, dealerEval };
}

// ============================================================
// 2. BLACKJACK 21 (แบล็คแจ็ค) EVALUATOR
// ============================================================
export interface BlackjackEval {
  total: number;
  isSoft: boolean;
  isBlackjack: boolean;
  isBust: boolean;
  label: string;
}

export function evaluateBlackjackHand(cards: PlayingCard[]): BlackjackEval {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 1) {
      aces++;
      total += 11;
    } else if (c.rank >= 10) {
      total += 10;
    } else {
      total += c.rank;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  const isSoft = aces > 0;
  const isBlackjack = cards.length === 2 && total === 21;
  const isBust = total > 21;
  const label = isBlackjack
    ? '🔥 BLACKJACK 21!'
    : isBust
    ? `💥 ทะลุ (${total})`
    : `${total} แต้ม${isSoft ? ' (Soft)' : ''}`;
  return { total, isSoft, isBlackjack, isBust, label };
}

export function compareBlackjack(
  playerCards: PlayingCard[],
  dealerCards: PlayingCard[]
): { outcome: 'win' | 'lose' | 'tie'; payoutRatio: number } {
  const p = evaluateBlackjackHand(playerCards);
  const d = evaluateBlackjackHand(dealerCards);
  if (p.isBust) return { outcome: 'lose', payoutRatio: 1 };
  if (p.isBlackjack && !d.isBlackjack) return { outcome: 'win', payoutRatio: 1.5 };
  if (!p.isBlackjack && d.isBlackjack) return { outcome: 'lose', payoutRatio: 1 };
  if (d.isBust) return { outcome: 'win', payoutRatio: 1 };
  if (p.total > d.total) return { outcome: 'win', payoutRatio: 1 };
  if (p.total < d.total) return { outcome: 'lose', payoutRatio: 1 };
  return { outcome: 'tie', payoutRatio: 0 };
}

// ============================================================
// 3. TEXAS HOLD'EM 7-CARD EVALUATOR (โป๊กเกอร์ เท็กซัส โฮลเอ็ม)
// ============================================================
export interface HoldemEval {
  category: number; // 0=HighCard .. 9=RoyalFlush
  score: number; // comparable numeric score
  label: string;
}

function holdemRankVal(r: CardRank): number {
  return r === 1 ? 14 : r;
}

function evaluate5Cards(cards: PlayingCard[]): HoldemEval {
  const vals = cards.map((c) => holdemRankVal(c.rank)).sort((a, b) => b - a);
  const isFlush = cards.every((c) => c.suit === cards[0].suit);

  // Check straight
  const unique = Array.from(new Set(vals));
  let straightHigh = 0;
  if (unique.length === 5) {
    if (unique[0] - unique[4] === 4) {
      straightHigh = unique[0];
    } else if (unique[0] === 14 && unique[1] === 5 && unique[2] === 4 && unique[3] === 3 && unique[4] === 2) {
      straightHigh = 5;
    }
  }
  const isStraight = straightHigh > 0;

  // Count frequencies
  const counts = new Map<number, number>();
  for (const v of vals) counts.set(v, (counts.get(v) || 0) + 1);
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  const encode = (cat: number, kickers: number[]): number => {
    let sc = cat * 1_000_000;
    const weights = [38416, 2744, 196, 14, 1];
    for (let i = 0; i < Math.min(5, kickers.length); i++) {
      sc += kickers[i] * weights[i];
    }
    return sc;
  };

  if (isStraight && isFlush) {
    if (straightHigh === 14) {
      return { category: 9, score: encode(9, [14]), label: '👑 Royal Flush!' };
    }
    return { category: 8, score: encode(8, [straightHigh]), label: '💎 Straight Flush!' };
  }
  if (groups[0][1] === 4) {
    return { category: 7, score: encode(7, [groups[0][0], groups[1][0]]), label: '🔥 Four of a Kind!' };
  }
  if (groups[0][1] === 3 && groups[1][1] === 2) {
    return { category: 6, score: encode(6, [groups[0][0], groups[1][0]]), label: '🏠 Full House!' };
  }
  if (isFlush) {
    return { category: 5, score: encode(5, vals), label: '♠️ Flush (สี)' };
  }
  if (isStraight) {
    return { category: 4, score: encode(4, [straightHigh]), label: '✨ Straight (เรียง)' };
  }
  if (groups[0][1] === 3) {
    return {
      category: 3,
      score: encode(3, [groups[0][0], groups[1][0], groups[2][0]]),
      label: '🎯 ตอง (Three of a Kind)',
    };
  }
  if (groups[0][1] === 2 && groups[1][1] === 2) {
    return {
      category: 2,
      score: encode(2, [groups[0][0], groups[1][0], groups[2][0]]),
      label: '✌️ สองคู่ (Two Pair)',
    };
  }
  if (groups[0][1] === 2) {
    return {
      category: 1,
      score: encode(1, [groups[0][0], groups[1][0], groups[2][0], groups[3][0]]),
      label: '☝️ หนึ่งคู่ (One Pair)',
    };
  }
  return { category: 0, score: encode(0, vals), label: 'ไพ่สูง (High Card)' };
}

export function evaluateTexasHoldem7(cards: PlayingCard[]): HoldemEval {
  if (cards.length < 5) {
    return { category: 0, score: 0, label: 'รอเปิดไพ่กลาง' };
  }
  let best: HoldemEval | null = null;
  const n = cards.length;
  for (let a = 0; a < n - 4; a++) {
    for (let b = a + 1; b < n - 3; b++) {
      for (let c = b + 1; c < n - 2; c++) {
        for (let d = c + 1; d < n - 1; d++) {
          for (let e = d + 1; e < n; e++) {
            const ev = evaluate5Cards([cards[a], cards[b], cards[c], cards[d], cards[e]]);
            if (!best || ev.score > best.score) best = ev;
          }
        }
      }
    }
  }
  return best || { category: 0, score: 0, label: 'High Card' };
}

// ============================================================
// 4. OLD MAID (อีแก่กินน้ำ) HELPERS
// ============================================================
export const OLD_MAID_CARD_ID = '12S'; // Q♠ = อีแก่!

/**
 * Create a 51-card deck by removing Q♣ so Q♠ (อีแก่) has no matching pair!
 * Actually in classic 51-card Old Maid, remove Q♣ (12C) and Q♦/Q♥ pair up, leaving Q♠ (12S) unpaired.
 * Better: remove ONLY Q♣ (12C) -> 3 Queens remain (12S, 12H, 12D). Pair 12H+12D -> 12S is always the single Old Maid!
 */
export function createOldMaidDeck(): PlayingCard[] {
  return createShuffledDeck('12C');
}

/**
 * Strip all rank pairs from a hand, keeping Q♠ (12S) unpairable if 3 Queens are present.
 */
export function discardOldMaidPairs(hand: PlayingCard[]): {
  remaining: PlayingCard[];
  discardedPairs: number;
} {
  const byRank = new Map<CardRank, PlayingCard[]>();
  for (const c of hand) {
    const arr = byRank.get(c.rank) || [];
    arr.push(c);
    byRank.set(c.rank, arr);
  }
  const remaining: PlayingCard[] = [];
  let discardedPairs = 0;

  byRank.forEach((cards, rank) => {
    // Keep 12S (Q♠) at the end so if 3 Queens are held, 12H & 12D pair up leaving 12S
    const sorted =
      rank === 12
        ? [...cards].sort((a, b) => (a.id === OLD_MAID_CARD_ID ? 1 : b.id === OLD_MAID_CARD_ID ? -1 : 0))
        : cards;
    const pairs = Math.floor(sorted.length / 2);
    discardedPairs += pairs;
    if (sorted.length % 2 === 1) {
      remaining.push(sorted[sorted.length - 1]);
    }
  });

  // Shuffle remaining slightly
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  return { remaining, discardedPairs };
}

// ============================================================
// 5. GUARD DEALER SMUGNESS SYSTEM (ยิ่งกินเยอะ ยิ่งยิ้มน่าเตะ!)
// ============================================================
export type GuardMoodId = 'cry' | 'annoyed' | 'neutral' | 'smirk' | 'grin' | 'mega_troll';

export interface GuardMoodMeta {
  id: GuardMoodId;
  badge: string;
  speech: string;
  ringClass: string;
}

const MOOD_LINES: Record<GuardMoodId, string[]> = {
  cry: [
    'โอ๊ยยย หมดตูดแล้ว!! ใครแอบสับไพ่?! 😭',
    'พี่ยามร้องไห้แล้วนะ กินกันไม่เกรงใจเลย!!',
    'ขอเวลาทำใจแป๊บ โดนป๊อกเด้งยับเลย!!',
  ],
  annoyed: [
    'ฟลุ๊คเฉยๆ ตาหน้าพี่ยามเอาคืนแน่! 😒',
    'เชอะ! ดวงดีแค่ตานี้แหละ เดี๋ยวรู้เรื่อง!',
  ],
  neutral: [
    'วางชิปมาได้เลยจ้า พี่ยามพร้อมแจกไพ่แล้ว!',
    'เจ๊ากันไป ตาหน้าลงหนักๆ หน่อยสิ!',
  ],
  smirk: [
    'ขอบใจนะจ๊ะ ขอรับ GP ไปเก็บก่อนนะ~ 😏',
    'หึๆ นิดๆ หน่อยๆ พี่ยามก็เก็บหมดแหละ~',
  ],
  grin: [
    'ฮ่าๆๆ หวานเจี๊ยบ!! เติม GP มาให้พี่ยามอีก! 😁✨',
    'ยิ้มจนปวดแก้มแล้วเนี่ย ขอบคุณผู้ใจบุญทุกคน!!',
  ],
  mega_troll: [
    'รวยเละ!! กินเรียบรอบวง!! ขอบคุณผู้สนับสนุนหลักอย่างเป็นทางการ!! 😈👑💰',
    'ฮ่าๆๆๆ ยิ้มน่าเตะไหมล่ะ?! หมดหน้าตักกันยังพวกเรา!! 😈✨',
  ],
};

export function resolveGuardMood(dealerNetGp: number): GuardMoodMeta {
  let id: GuardMoodId = 'neutral';
  if (dealerNetGp <= -20) id = 'cry';
  else if (dealerNetGp < 0) id = 'annoyed';
  else if (dealerNetGp === 0) id = 'neutral';
  else if (dealerNetGp < 20) id = 'smirk';
  else if (dealerNetGp < 50) id = 'grin';
  else id = 'mega_troll';

  const pool = MOOD_LINES[id];
  const speech = pool[Math.floor(Math.random() * pool.length)];

  const badges: Record<GuardMoodId, { badge: string; ringClass: string }> = {
    cry: { badge: '😭 พี่ยามร้องไห้', ringClass: 'border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.6)]' },
    annoyed: { badge: '😒 พี่ยามคิ้วขมวด', ringClass: 'border-amber-500' },
    neutral: { badge: '👮 เจ้ามือพี่ยาม', ringClass: 'border-amber-400' },
    smirk: { badge: '😏 ยิ้มมุมปาก', ringClass: 'border-amber-300 shadow-[0_0_18px_rgba(250,204,21,0.55)]' },
    grin: { badge: '😁 ยิ้มกว้างฟันขาว!', ringClass: 'border-yellow-300 shadow-[0_0_26px_rgba(250,204,21,0.85)]' },
    mega_troll: { badge: '😈 ยิ้มน่าเตะ MAX!!', ringClass: 'border-yellow-200 shadow-[0_0_36px_rgba(253,224,71,1)]' },
  };

  return { id, speech, ...badges[id] };
}

// ============================================================
// 6. CASINO AUDIO SFX (Web Audio API)
// ============================================================
let casinoAudioCtx: AudioContext | null = null;
function getCasinoAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!casinoAudioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) casinoAudioCtx = new Ctx();
  }
  if (casinoAudioCtx && casinoAudioCtx.state === 'suspended') {
    casinoAudioCtx.resume().catch(() => {});
  }
  return casinoAudioCtx;
}

export function playCasinoSound(kind: 'deal' | 'chip' | 'win' | 'lose' | 'pok', muted = false): void {
  if (muted) return;
  const ctx = getCasinoAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (kind === 'deal') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.055);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.065);
  } else if (kind === 'chip') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(1480, now + 0.05);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.start(now);
    osc.stop(now + 0.065);
  } else if (kind === 'pok' || kind === 'win') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.09);
    osc.frequency.setValueAtTime(783.99, now + 0.18);
    osc.frequency.setValueAtTime(1046.5, now + 0.27);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    osc.start(now);
    osc.stop(now + 0.45);
  } else if (kind === 'lose') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.setValueAtTime(260, now + 0.1);
    osc.frequency.setValueAtTime(180, now + 0.2);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
    osc.start(now);
    osc.stop(now + 0.35);
  }
}
