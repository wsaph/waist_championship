export type SumoMoveId = 'tsuppari' | 'yorikiri' | 'shiko_quake';

export interface SumoMove {
  id: SumoMoveId;
  codeName: string;
  thName: string;
  emoji: string;
  desc: string;
  cooldownMs: number;
  dashSpeed: number;
  knockback: number;
  reach: number;
  isAoe?: boolean;
  colorHex: string;
}

export interface SumoRank {
  tier: number;
  id: string;
  name: string;
  jpTitle: string;
  minXp: number;
  mawashiHex: string;
  secondaryHex?: string;
  isYokozuna?: boolean;
  badgeClass: string;
  promotionCoins: number;
}

export interface SumoBotOpponent {
  id: string;
  name: string;
  title: string;
  emoji: string;
  rankTier: number;
  colorHex: string;
  bandColor: string;
  species: string;
  bellyScale: number;
  massMult: number;
  aiSpeedMult: number;
  aggression: number; // 0..1
  winXp: number;
  loseXp: number;
  desc: string;
}

export const DOHYO_RING_RADIUS = 3.25;
export const DOHYO_MOUND_RADIUS = 3.95;

export const SUMO_MOVES: Record<SumoMoveId, SumoMove> = {
  tsuppari: {
    id: 'tsuppari',
    codeName: 'TSUPPARI',
    thName: 'ฝ่ามือรัวซุปปาริ',
    emoji: '✋',
    desc: 'กระแทกฝ่ามือรัวระยะประชิด ดันคู่ต่อสู้ถอยหลังต่อเนื่อง',
    cooldownMs: 420,
    dashSpeed: 3.2,
    knockback: 5.6,
    reach: 1.58,
    colorHex: '#38bdf8',
  },
  yorikiri: {
    id: 'yorikiri',
    codeName: 'BELLY CHARGE',
    thName: 'พุ่งชนพุงกระแทก!',
    emoji: '🐗',
    desc: 'พุ่งเอาพุงชนเต็มแรง ส่งคู่ต่อสู้ปลิวกระเด็นไปขอบเชือกฟาง (ระวังพุ่งหลุดเวทีเอง!)',
    cooldownMs: 1750,
    dashSpeed: 9.6,
    knockback: 9.8,
    reach: 1.68,
    colorHex: '#f97316',
  },
  shiko_quake: {
    id: 'shiko_quake',
    codeName: 'SHIKO QUAKE',
    thName: 'กระทืบพื้นแผ่นดินไหว!',
    emoji: '🌋',
    desc: 'ยกขากระทืบสังเวียนปล่อยคลื่นกระแทกรอบตัว 360° ซัดกระเด็นทุกทิศทาง',
    cooldownMs: 4200,
    dashSpeed: 0.8,
    knockback: 11.4,
    reach: 2.45,
    isAoe: true,
    colorHex: '#facc15',
  },
};

export const SUMO_RANKS: SumoRank[] = [
  {
    tier: 0,
    id: 'jonokuchi',
    name: 'โจโนคุจิ (ฝึกหัด)',
    jpTitle: '序ノ口 • Jonokuchi',
    minXp: 0,
    mawashiHex: '#f8fafc',
    badgeClass: 'bg-slate-100 text-slate-900 border-slate-400',
    promotionCoins: 0,
  },
  {
    tier: 1,
    id: 'jonidan',
    name: 'โจนิดัน (ขั้นต้น)',
    jpTitle: '序二段 • Jonidan',
    minXp: 140,
    mawashiHex: '#38bdf8',
    badgeClass: 'bg-sky-400 text-slate-950 border-sky-200',
    promotionCoins: 15,
  },
  {
    tier: 2,
    id: 'sandanme',
    name: 'ซันดันเมะ (ดาวรุ่ง)',
    jpTitle: '三段目 • Sandanme',
    minXp: 340,
    mawashiHex: '#22c55e',
    badgeClass: 'bg-emerald-500 text-slate-950 border-emerald-200',
    promotionCoins: 20,
  },
  {
    tier: 3,
    id: 'makushita',
    name: 'มาคุชิตะ (จอมพลัง)',
    jpTitle: '幕下 • Makushita',
    minXp: 620,
    mawashiHex: '#2563eb',
    badgeClass: 'bg-blue-600 text-white border-blue-300',
    promotionCoins: 25,
  },
  {
    tier: 4,
    id: 'juryo',
    name: 'จูเรียว (นักสู้ผ้าไหม)',
    jpTitle: '十両 • Juryo',
    minXp: 980,
    mawashiHex: '#f97316',
    badgeClass: 'bg-orange-500 text-slate-950 border-amber-200',
    promotionCoins: 35,
  },
  {
    tier: 5,
    id: 'maegashira',
    name: 'มาเอกาชิระ (แถวหน้า)',
    jpTitle: '前頭 • Maegashira',
    minXp: 1450,
    mawashiHex: '#dc2626',
    badgeClass: 'bg-red-600 text-white border-red-300',
    promotionCoins: 45,
  },
  {
    tier: 6,
    id: 'komusubi',
    name: 'โคมุซุบิ (ขุนพลน้อย)',
    jpTitle: '小結 • Komusubi',
    minXp: 2050,
    mawashiHex: '#7e22ce',
    badgeClass: 'bg-purple-700 text-amber-100 border-purple-300',
    promotionCoins: 55,
  },
  {
    tier: 7,
    id: 'sekiwake',
    name: 'เซกิวาเกะ (รองแม่ทัพ)',
    jpTitle: '関脇 • Sekiwake',
    minXp: 2800,
    mawashiHex: '#9333ea',
    secondaryHex: '#facc15',
    badgeClass: 'bg-gradient-to-r from-purple-700 to-amber-500 text-white border-amber-200',
    promotionCoins: 70,
  },
  {
    tier: 8,
    id: 'ozeki',
    name: 'โอเซกิ (แชมเปี้ยน)',
    jpTitle: '大関 • Ozeki',
    minXp: 3750,
    mawashiHex: '#eab308',
    secondaryHex: '#dc2626',
    badgeClass: 'bg-gradient-to-r from-amber-400 to-red-600 text-slate-950 border-yellow-100',
    promotionCoins: 90,
  },
  {
    tier: 9,
    id: 'yokozuna',
    name: 'โยโกซึนะ (จักรพรรดิซูโม่!)',
    jpTitle: '横綱 • Grand Yokozuna',
    minXp: 4900,
    mawashiHex: '#ffffff',
    secondaryHex: '#facc15',
    isYokozuna: true,
    badgeClass: 'bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 text-slate-950 border-white',
    promotionCoins: 120,
  },
];

export const SUMO_BOT_OPPONENTS: SumoBotOpponent[] = [
  {
    id: 'bot_snowman',
    name: 'ยูกิดารุมะจูเนียร์',
    title: 'โจโนคุจิ • ตุ๊กตาหิมะซ้อมมือ',
    emoji: '⛄',
    rankTier: 0,
    colorHex: '#E0F2FE',
    bandColor: '#EF4444',
    species: 'bunny',
    bellyScale: 1.22,
    massMult: 0.92,
    aiSpeedMult: 0.78,
    aggression: 0.35,
    winXp: 95,
    loseXp: 30,
    desc: 'เคลื่อนไหวช้า กระเด็นง่าย เหมาะสำหรับวอร์มเครื่องฝึกดันออกนอกเชือกฟาง!',
  },
  {
    id: 'bot_capybara',
    name: 'กัปตันกะปิปลาร่าออนเซ็น',
    title: 'จูเรียว • สายชิลล์พุงแน่น',
    emoji: '🍊',
    rankTier: 4,
    colorHex: '#D97706',
    bandColor: '#FDE047',
    species: 'bear',
    bellyScale: 1.38,
    massMult: 1.08,
    aiSpeedMult: 0.92,
    aggression: 0.55,
    winXp: 155,
    loseXp: 45,
    desc: 'ตัวหนักยืนปักหลักกลางเวที ชอบสวนด้วยท่าพุ่งชนพุงกระแทก!',
  },
  {
    id: 'bot_crab',
    name: 'ขุนพลทาราบะก้ามเหล็ก',
    title: 'โอเซกิ • จ้าวสมุทรฮอกไกโด',
    emoji: '🦀',
    rankTier: 8,
    colorHex: '#EF4444',
    bandColor: '#FACC15',
    species: 'fox',
    bellyScale: 1.48,
    massMult: 1.18,
    aiSpeedMult: 1.06,
    aggression: 0.76,
    winXp: 230,
    loseXp: 60,
    desc: 'เดินบีบพื้นที่ไว รัวฝ่ามือ Tsuppari แม่นยำและรู้จักเบรกขอบเชือก!',
  },
  {
    id: 'bot_guard_yokozuna',
    name: 'โยโกซึนะพี่ยามหมูกรอบ!',
    title: 'โยโกซึนะ • จักรพรรดิพุงสะท้านเกาะ',
    emoji: '👮',
    rankTier: 9,
    colorHex: '#FACC15',
    bandColor: '#18181B',
    species: 'pig',
    bellyScale: 1.65,
    massMult: 1.3,
    aiSpeedMult: 1.16,
    aggression: 0.9,
    winXp: 320,
    loseXp: 75,
    desc: 'บอสใหญ่ประจำสังเวียนฮอกไกโด! กระทืบพื้น Shiko แรงจัด ต้องหลอกล่อให้พุ่งหลุดขอบเวที!',
  },
];

export function resolveSumoRank(totalXp: number): {
  rank: SumoRank;
  nextRank: SumoRank | null;
  progressPct: number;
} {
  const safeXp = Math.max(0, Math.floor(Number.isFinite(totalXp) ? totalXp : 0));
  let current = SUMO_RANKS[0];
  for (const r of SUMO_RANKS) {
    if (safeXp >= r.minXp) {
      current = r;
    }
  }
  const nextRank = SUMO_RANKS.find((r) => r.tier === current.tier + 1) ?? null;
  if (!nextRank) {
    return { rank: current, nextRank: null, progressPct: 100 };
  }
  const span = Math.max(1, nextRank.minXp - current.minXp);
  const progressPct = Math.max(
    0,
    Math.min(100, Math.round(((safeXp - current.minXp) / span) * 100))
  );
  return { rank: current, nextRank, progressPct };
}

export interface SumoFighterBody {
  x: number;
  z: number;
  vx: number;
  vz: number;
  rotY: number;
  mass: number;
  bracing: boolean;
}

/**
 * Pure 2D circular Dohyo physics step: integrates velocity, applies clay friction,
 * resolves elastic belly-to-belly collision, and reports whether either fighter stepped out (`ringOut`).
 */
export function stepSumoRingPhysics(
  p1: SumoFighterBody,
  p2: SumoFighterBody,
  dt: number,
  ringRadius: number = DOHYO_RING_RADIUS
): {
  collided: boolean;
  impactSpeed: number;
  p1RingOut: boolean;
  p2RingOut: boolean;
} {
  const clampedDt = Math.min(0.05, Math.max(0.001, dt));
  const friction = Math.pow(0.0018, clampedDt); // Crisp clay surface deceleration

  p1.x += p1.vx * clampedDt;
  p1.z += p1.vz * clampedDt;
  p2.x += p2.vx * clampedDt;
  p2.z += p2.vz * clampedDt;

  p1.vx *= friction;
  p1.vz *= friction;
  p2.vx *= friction;
  p2.vz *= friction;

  let collided = false;
  let impactSpeed = 0;

  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const dist = Math.hypot(dx, dz);
  const minSep = 0.98;

  if (dist < minSep) {
    collided = true;
    const nx = dist > 0.0001 ? dx / dist : 1;
    const nz = dist > 0.0001 ? dz / dist : 0;
    const overlap = minSep - dist;

    const totalMass = Math.max(0.2, p1.mass + p2.mass);
    const r1 = p2.mass / totalMass;
    const r2 = p1.mass / totalMass;

    p1.x -= nx * overlap * r1;
    p1.z -= nz * overlap * r1;
    p2.x += nx * overlap * r2;
    p2.z += nz * overlap * r2;

    const rvx = p2.vx - p1.vx;
    const rvz = p2.vz - p1.vz;
    const velAlongNormal = rvx * nx + rvz * nz;

    if (velAlongNormal < 0) {
      impactSpeed = -velAlongNormal;
      const restitution = 0.85;
      const j = (-(1 + restitution) * velAlongNormal) / (1 / p1.mass + 1 / p2.mass);
      const brace1 = p1.bracing ? 0.48 : 1;
      const brace2 = p2.bracing ? 0.48 : 1;

      p1.vx -= (j / p1.mass) * nx * brace1;
      p1.vz -= (j / p1.mass) * nz * brace1;
      p2.vx += (j / p2.mass) * nx * brace2;
      p2.vz += (j / p2.mass) * nz * brace2;

      // Minimum belly-bounce push so collisions always feel chunky and impactful
      const minPush = 2.1;
      p1.vx -= nx * minPush * r1 * brace1;
      p1.vz -= nz * minPush * r1 * brace1;
      p2.vx += nx * minPush * r2 * brace2;
      p2.vz += nz * minPush * r2 * brace2;
    }
  }

  const r1Dist = Math.hypot(p1.x, p1.z);
  const r2Dist = Math.hypot(p2.x, p2.z);

  return {
    collided,
    impactSpeed,
    p1RingOut: r1Dist > ringRadius,
    p2RingOut: r2Dist > ringRadius,
  };
}
