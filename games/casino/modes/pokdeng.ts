import { rankLabel, type CardRank, type PlayingCard } from '../deck';

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
  if (playerEval.deng !== dealerEval.deng) {
    if (playerEval.deng > dealerEval.deng) {
      return { outcome: 'win', multiplier: playerEval.deng, playerEval, dealerEval };
    }
    return { outcome: 'lose', multiplier: dealerEval.deng, playerEval, dealerEval };
  }
  return { outcome: 'tie', multiplier: 0, playerEval, dealerEval };
}
