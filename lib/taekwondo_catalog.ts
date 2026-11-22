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
}

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
  },
];

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
