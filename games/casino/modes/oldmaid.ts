import { createShuffledDeck, type CardRank, type PlayingCard } from '../deck';

export const OLD_MAID_CARD_ID = 'MYSTERY';

/**
 * Full 52-card deck: draw 1 random secret card face-down in the center of the table,
 * and deal the remaining 51 cards so nobody knows which rank is the Old Maid until the end!
 */
export function createOldMaidDeck52(): { dealDeck: PlayingCard[]; hiddenCard: PlayingCard } {
  const full52 = createShuffledDeck();
  const hiddenCard = full52.pop()!;
  return { dealDeck: full52, hiddenCard };
}

/**
 * Strip all matching rank pairs from a hand (works cleanly with the 52-card mystery-card rule).
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

  byRank.forEach((cards) => {
    const pairs = Math.floor(cards.length / 2);
    discardedPairs += pairs;
    if (cards.length % 2 === 1) {
      remaining.push(cards[cards.length - 1]);
    }
  });

  // Shuffle remaining slightly
  for (let i = remaining.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
  }
  return { remaining, discardedPairs };
}
