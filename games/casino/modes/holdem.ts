import type { CardRank, PlayingCard } from '../deck';

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
