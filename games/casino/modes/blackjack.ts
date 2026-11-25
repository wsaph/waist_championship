import type { PlayingCard } from '../deck';

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
