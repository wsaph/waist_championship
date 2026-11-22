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
  stripeHex?: string;
  badgeClass: string;
  promotionCoins: number;
  unlockMoveId: string;
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
    minTier: 1,
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
    minTier: 2,
    codeName: 'NAERYO CHAGI',
    thName: 'เตะขวานสับฟ้า',
    emoji: '🪓',
    pose: 'axe_kick',
    trailHex: '#22c55e',
    bonusDesc: 'โบนัส +20% ฟาดแผ่นไม้ 🪵 แรงสุด',
    scoreBonusPct: 20,
    splashTargets: 1,
    cooldownSec: 0,
    slot: 'mid',
  },
  {
    id: 'back_kick',
    minTier: 3,
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
    id: 'tornado_360',
    minTier: 4,
    codeName: 'TORNADO 360°',
    thName: 'พายุหมุน 360°',
    emoji: '🌪️',
    pose: 'flying_spin',
    trailHex: '#ef4444',
    bonusDesc: 'ท่าไม้ตาย +35% แต้ม (คูลดาวน์ 4 วิ)',
    scoreBonusPct: 35,
    splashTargets: 1,
    cooldownSec: 4,
    slot: 'ultimate',
  },
  {
    id: 'hurricane_540',
    minTier: 5,
    codeName: 'HURRICANE 540°',
    thName: 'เฮอริเคน 540°',
    emoji: '🌀',
    pose: 'hurricane_540',
    trailHex: '#f59e0b',
    bonusDesc: 'กวาดทีเดียว 2 เป้า +40% (คูลดาวน์ 6 วิ)',
    scoreBonusPct: 40,
    splashTargets: 2,
    cooldownSec: 6,
    slot: 'ultimate',
  },
  {
    id: 'sky_dragon_720',
    minTier: 6,
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
    id: 'yellow',
    name: 'สายเหลือง',
    enName: 'Yellow Belt',
    minXp: 120,
    beltHex: '#FACC15',
    badgeClass: 'bg-yellow-400 text-stone-950 border-yellow-200',
    promotionCoins: 15,
    unlockMoveId: 'high_roundhouse',
  },
  {
    tier: 2,
    id: 'green',
    name: 'สายเขียว',
    enName: 'Green Belt',
    minXp: 300,
    beltHex: '#22C55E',
    badgeClass: 'bg-emerald-500 text-white border-emerald-200',
    promotionCoins: 25,
    unlockMoveId: 'axe_kick',
  },
  {
    tier: 3,
    id: 'blue',
    name: 'สายฟ้า',
    enName: 'Blue Belt',
    minXp: 600,
    beltHex: '#3B82F6',
    badgeClass: 'bg-blue-500 text-white border-sky-200',
    promotionCoins: 40,
    unlockMoveId: 'back_kick',
  },
  {
    tier: 4,
    id: 'red',
    name: 'สายแดง',
    enName: 'Red Belt',
    minXp: 1000,
    beltHex: '#EF4444',
    badgeClass: 'bg-red-600 text-white border-rose-200',
    promotionCoins: 60,
    unlockMoveId: 'tornado_360',
  },
  {
    tier: 5,
    id: 'black',
    name: 'สายดำ ดั้ง 1',
    enName: 'Black Belt 1st Dan',
    minXp: 1600,
    beltHex: '#18181B',
    stripeHex: '#FACC15',
    badgeClass: 'bg-zinc-900 text-amber-300 border-amber-400',
    promotionCoins: 100,
    unlockMoveId: 'hurricane_540',
  },
  {
    tier: 6,
    id: 'grandmaster',
    name: 'สายดำแกรนด์มาสเตอร์',
    enName: 'Grandmaster',
    minXp: 2500,
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
