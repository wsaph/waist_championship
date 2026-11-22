export type TaekwondoKickPose =
  | 'idle'
  | 'front_kick'
  | 'high_kick'
  | 'side_kick'
  | 'axe_kick'
  | 'back_kick'
  | 'flying_spin'
  | 'hurricane_540'
  | 'sky_dragon'
  | 'hurt';

export interface TaekwondoMove {
  id: string;
  minTier: number;
  codeName: string;
  thName: string;
  emoji: string;
  pose: TaekwondoKickPose;
  trailHex: string;
  bonusDesc: string;
  scoreBonusPct: number;
  splashTargets: number; // 1 = single target, 2 = 2 targets, 99 = all non-decoy targets
  cooldownSec: number;
  slot: 'basic' | 'mid' | 'ultimate';
}

export interface TaekwondoBelt {
  tier: number;
  id: string;
  name: string;
  enName: string;
  minXp: number;
  beltHex: string;
  secondaryHex?: string; // สำหรับสาย 2 สี (Half / Two-Tone Belt)
  stripeHex?: string; // แถบดั้งสำหรับสายดำ
  badgeClass: string;
  promotionCoins: number;
  unlockMoveId?: string;
}

export const TAEKWONDO_MOVES: TaekwondoMove[] = [
  {
    id: 'front_kick',
    minTier: 0,
    codeName: 'AP CHAGI',
    thName: 'เตะตรงพื้นฐาน',
    emoji: '🦵',
    pose: 'front_kick',
    trailHex: '#38bdf8',
    bonusDesc: 'ท่าเริ่มต้นสายขาว เตะเร็วแม่นยำ',
    scoreBonusPct: 0,
    splashTargets: 1,
    cooldownSec: 0,
    slot: 'basic',
  },
  {
    id: 'high_roundhouse',
    minTier: 2,
    codeName: 'DOLLYO CHAGI',
    thName: 'เตะตวัดสูง',
    emoji: '🔥',
    pose: 'high_kick',
    trailHex: '#facc15',
    bonusDesc: 'โบนัส +10% แต้มทุกเป้า',
    scoreBonusPct: 10,
    splashTargets: 1,
    cooldownSec: 0,
    slot: 'mid',
  },
  {
    id: 'axe_kick',
    minTier: 4,
    codeName: 'NAERYO CHAGI',
    thName: 'เตะขวานสับฟ้า',
    emoji: '🪓',
    pose: 'axe_kick',
    trailHex: '#22c55e',
    bonusDesc: 'โบนัส +18% ฟาดแผ่นไม้ 🪵 แรงสุด',
    scoreBonusPct: 18,
    splashTargets: 1,
    cooldownSec: 0,
    slot: 'mid',
  },
  {
    id: 'back_kick',
    minTier: 6,
    codeName: 'DWI CHAGI',
    thName: 'หมุนตัวถีบหลังสายฟ้า',
    emoji: '⚡',
    pose: 'back_kick',
    trailHex: '#3b82f6',
    bonusDesc: 'โบนัส +25% + ประกายสายฟ้า',
    scoreBonusPct: 25,
    splashTargets: 1,
    cooldownSec: 0,
    slot: 'mid',
  },
  {
    id: 'piercing_side_kick',
    minTier: 8,
    codeName: 'YEOP CHAGI',
    thName: 'ถีบข้างทะลวงเกราะ',
    emoji: '💥',
    pose: 'side_kick',
    trailHex: '#b45309',
    bonusDesc: 'ท่าสายน้ำตาล โบนัส +32% แรงสะเทือน',
    scoreBonusPct: 32,
    splashTargets: 1,
    cooldownSec: 0,
    slot: 'mid',
  },
  {
    id: 'tornado_360',
    minTier: 10,
    codeName: 'TORNADO 360°',
    thName: 'พายุหมุน 360°',
    emoji: '🌪️',
    pose: 'flying_spin',
    trailHex: '#ef4444',
    bonusDesc: 'ท่าไม้ตายสายแดง +40% แต้ม (คูลดาวน์ 4 วิ)',
    scoreBonusPct: 40,
    splashTargets: 1,
    cooldownSec: 4,
    slot: 'ultimate',
  },
  {
    id: 'hurricane_540',
    minTier: 12,
    codeName: 'HURRICANE 540°',
    thName: 'เฮอริเคน 540°',
    emoji: '🌀',
    pose: 'hurricane_540',
    trailHex: '#f59e0b',
    bonusDesc: 'สายดำ! กวาดทีเดียว 2 เป้า +45% (คูลดาวน์ 6 วิ)',
    scoreBonusPct: 45,
    splashTargets: 2,
    cooldownSec: 6,
    slot: 'ultimate',
  },
  {
    id: 'sky_dragon_720',
    minTier: 13,
    codeName: 'RAGE ART 720°',
    thName: 'มังกรเหิน 720°',
    emoji: '🐉',
    pose: 'sky_dragon',
    trailHex: '#fde047',
    bonusDesc: 'RAGE ART กวาดทุกเป้าบนจอ! (คูลดาวน์ 9 วิ)',
    scoreBonusPct: 60,
    splashTargets: 99,
    cooldownSec: 9,
    slot: 'ultimate',
  },
];

// ลำดับสายเทควันโดมาตรฐานไทยครบทั้งสาย 2 สี (สายแถบ) และสายน้ำตาล!
export const TAEKWONDO_BELTS: TaekwondoBelt[] = [
  {
    tier: 0,
    id: 'white',
    name: 'สายขาว',
    enName: 'White Belt',
    minXp: 0,
    beltHex: '#F8FAFC',
    badgeClass: 'bg-slate-100 text-slate-900 border-slate-400',
    promotionCoins: 0,
    unlockMoveId: 'front_kick',
  },
  {
    tier: 1,
    id: 'white_yellow',
    name: 'สายขาว-เหลือง (2 สี)',
    enName: 'White-Yellow Belt',
    minXp: 80,
    beltHex: '#F8FAFC',
    secondaryHex: '#FACC15',
    badgeClass: 'bg-gradient-to-r from-slate-100 to-yellow-300 text-slate-950 border-yellow-400',
    promotionCoins: 10,
  },
  {
    tier: 2,
    id: 'yellow',
    name: 'สายเหลือง',
    enName: 'Yellow Belt',
    minXp: 180,
    beltHex: '#FACC15',
    badgeClass: 'bg-yellow-400 text-stone-950 border-yellow-200',
    promotionCoins: 15,
    unlockMoveId: 'high_roundhouse',
  },
  {
    tier: 3,
    id: 'yellow_green',
    name: 'สายเหลือง-เขียว (2 สี)',
    enName: 'Yellow-Green Belt',
    minXp: 300,
    beltHex: '#FACC15',
    secondaryHex: '#22C55E',
    badgeClass: 'bg-gradient-to-r from-yellow-300 to-emerald-500 text-slate-950 border-emerald-300',
    promotionCoins: 15,
  },
  {
    tier: 4,
    id: 'green',
    name: 'สายเขียว',
    enName: 'Green Belt',
    minXp: 450,
    beltHex: '#22C55E',
    badgeClass: 'bg-emerald-500 text-white border-emerald-200',
    promotionCoins: 20,
    unlockMoveId: 'axe_kick',
  },
  {
    tier: 5,
    id: 'green_blue',
    name: 'สายเขียว-ฟ้า (2 สี)',
    enName: 'Green-Blue Belt',
    minXp: 650,
    beltHex: '#22C55E',
    secondaryHex: '#3B82F6',
    badgeClass: 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white border-sky-200',
    promotionCoins: 25,
  },
  {
    tier: 6,
    id: 'blue',
    name: 'สายฟ้า',
    enName: 'Blue Belt',
    minXp: 900,
    beltHex: '#3B82F6',
    badgeClass: 'bg-blue-500 text-white border-sky-200',
    promotionCoins: 30,
    unlockMoveId: 'back_kick',
  },
  {
    tier: 7,
    id: 'blue_brown',
    name: 'สายฟ้า-น้ำตาล (2 สี)',
    enName: 'Blue-Brown Belt',
    minXp: 1200,
    beltHex: '#3B82F6',
    secondaryHex: '#92400E',
    badgeClass: 'bg-gradient-to-r from-blue-500 to-amber-800 text-white border-amber-300',
    promotionCoins: 35,
  },
  {
    tier: 8,
    id: 'brown',
    name: 'สายน้ำตาล',
    enName: 'Brown Belt',
    minXp: 1550,
    beltHex: '#92400E',
    badgeClass: 'bg-amber-800 text-amber-100 border-amber-400',
    promotionCoins: 45,
    unlockMoveId: 'piercing_side_kick',
  },
  {
    tier: 9,
    id: 'brown_red',
    name: 'สายน้ำตาล-แดง (2 สี)',
    enName: 'Brown-Red Belt',
    minXp: 1950,
    beltHex: '#92400E',
    secondaryHex: '#EF4444',
    badgeClass: 'bg-gradient-to-r from-amber-800 to-red-600 text-white border-rose-300',
    promotionCoins: 50,
  },
  {
    tier: 10,
    id: 'red',
    name: 'สายแดง',
    enName: 'Red Belt',
    minXp: 2400,
    beltHex: '#EF4444',
    badgeClass: 'bg-red-600 text-white border-rose-200',
    promotionCoins: 60,
    unlockMoveId: 'tornado_360',
  },
  {
    tier: 11,
    id: 'red_black',
    name: 'สายแดง-ดำ (พูม 2 สี)',
    enName: 'Red-Black Poom Belt',
    minXp: 2950,
    beltHex: '#EF4444',
    secondaryHex: '#18181B',
    badgeClass: 'bg-gradient-to-r from-red-600 to-zinc-900 text-white border-amber-300',
    promotionCoins: 75,
  },
  {
    tier: 12,
    id: 'black',
    name: 'สายดำ ดั้ง 1',
    enName: 'Black Belt 1st Dan',
    minXp: 3600,
    beltHex: '#18181B',
    stripeHex: '#FACC15',
    badgeClass: 'bg-zinc-900 text-amber-300 border-amber-400',
    promotionCoins: 100,
    unlockMoveId: 'hurricane_540',
  },
  {
    tier: 13,
    id: 'grandmaster',
    name: 'สายดำแกรนด์มาสเตอร์',
    enName: 'Grandmaster',
    minXp: 4500,
    beltHex: '#18181B',
    stripeHex: '#F59E0B',
    badgeClass: 'bg-gradient-to-r from-zinc-900 via-amber-500 to-zinc-900 text-white border-yellow-300',
    promotionCoins: 150,
    unlockMoveId: 'sky_dragon_720',
  },
];

export function getMoveById(id: string): TaekwondoMove {
  return TAEKWONDO_MOVES.find((m) => m.id === id) ?? TAEKWONDO_MOVES[0];
}

export function getUnlockedTaekwondoMoves(tier: number): TaekwondoMove[] {
  return TAEKWONDO_MOVES.filter((m) => m.minTier <= tier);
}

export function getBeltCommandLoadout(tier: number): {
  basic: TaekwondoMove;
  mid: TaekwondoMove | null;
  ultimate: TaekwondoMove | null;
} {
  const unlocked = getUnlockedTaekwondoMoves(tier);
  const basic = unlocked.find((m) => m.slot === 'basic') ?? TAEKWONDO_MOVES[0];
  const midMoves = unlocked.filter((m) => m.slot === 'mid');
  const ultMoves = unlocked.filter((m) => m.slot === 'ultimate');
  return {
    basic,
    mid: midMoves.length > 0 ? midMoves[midMoves.length - 1] : null,
    ultimate: ultMoves.length > 0 ? ultMoves[ultMoves.length - 1] : null,
  };
}

export function getBeltSwatchStyle(beltHex: string, secondaryHex?: string | null): React.CSSProperties {
  if (secondaryHex) {
    return {
      background: `linear-gradient(135deg, ${beltHex} 50%, ${secondaryHex} 50%)`,
    };
  }
  return { backgroundColor: beltHex };
}

export function resolveTaekwondoBelt(totalXp: number): {
  belt: TaekwondoBelt;
  nextBelt: TaekwondoBelt | null;
  progressPct: number;
} {
  const safeXp = Math.max(0, Math.floor(totalXp || 0));
  let current = TAEKWONDO_BELTS[0];
  for (const b of TAEKWONDO_BELTS) {
    if (safeXp >= b.minXp) {
      current = b;
    }
  }
  const next = TAEKWONDO_BELTS.find((b) => b.tier === current.tier + 1) ?? null;
  if (!next) {
    return { belt: current, nextBelt: null, progressPct: 100 };
  }
  const span = Math.max(1, next.minXp - current.minXp);
  const progressPct = Math.min(100, Math.max(0, Math.round(((safeXp - current.minXp) / span) * 100)));
  return { belt: current, nextBelt: next, progressPct };
}
