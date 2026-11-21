export type FishingRarity = 'common' | 'uncommon' | 'rare' | 'legendary' | 'guard_troll';

export interface FishingCatch {
  id: string;
  name: string;
  icon: string;
  rarity: FishingRarity;
  coins: number;
  desc: string;
  weight: number;
}

export const FISHING_DAILY_REWARD_LIMIT = 5;

export const FISHING_RARITY_META: Record<
  FishingRarity,
  {
    label: string;
    badgeClass: string;
    cardBorderClass: string;
    beamHex: number;
    confettiColors: string[];
  }
> = {
  common: {
    label: 'COMMON • สายฮา',
    badgeClass: 'bg-slate-700 text-slate-100 border-slate-400',
    cardBorderClass: 'border-slate-400',
    beamHex: 0x94a3b8,
    confettiColors: ['#94a3b8', '#e2e8f0'],
  },
  uncommon: {
    label: 'UNCOMMON • สายอร่อย',
    badgeClass: 'bg-emerald-600 text-emerald-50 border-emerald-300',
    cardBorderClass: 'border-emerald-400',
    beamHex: 0x34d399,
    confettiColors: ['#34d399', '#38bdf8', '#a7f3d0'],
  },
  rare: {
    label: 'RARE • หายาก!',
    badgeClass: 'bg-fuchsia-600 text-fuchsia-50 border-fuchsia-300',
    cardBorderClass: 'border-fuchsia-400',
    beamHex: 0xc084fc,
    confettiColors: ['#c084fc', '#f472b6', '#38bdf8', '#fde047'],
  },
  legendary: {
    label: 'LEGENDARY • ตำนาน!',
    badgeClass: 'bg-gradient-to-r from-amber-400 via-yellow-300 to-orange-400 text-black border-white',
    cardBorderClass: 'border-amber-300',
    beamHex: 0xfacc15,
    confettiColors: ['#facc15', '#fb923c', '#fef08a', '#ffffff'],
  },
  guard_troll: {
    label: '🚨 โดนพี่ยามจับได้!!',
    badgeClass: 'bg-gradient-to-r from-rose-600 via-red-500 to-amber-400 text-white border-white',
    cardBorderClass: 'border-rose-400',
    beamHex: 0xef4444,
    confettiColors: ['#ef4444', '#facc15', '#ffffff'],
  },
};

export const FISHING_CATALOG: FishingCatch[] = [
  // Common (52% total weight) — +1 💰
  {
    id: 'old_flipflop',
    name: 'รองเท้าแตะขาด',
    icon: '🥾',
    rarity: 'common',
    coins: 1,
    desc: 'ตกได้รองเท้าแตะใครไม่รู้ ลอยมาจากไหนเนี่ย!',
    weight: 14,
  },
  {
    id: 'boba_cup',
    name: 'แก้วชานมไข่มุก',
    icon: '🧋',
    rarity: 'common',
    coins: 1,
    desc: 'ยังเหลือไข่มุกก้นแก้ว แคลอรี่ตามมาหลอกหลอนถึงทะเล!',
    weight: 14,
  },
  {
    id: 'pinchy_crab',
    name: 'ปูทะเลจอมหนีบ',
    icon: '🦀',
    rarity: 'common',
    coins: 1,
    desc: 'งับนิ้วโป้งร้องจ๊ากก่อนจะกระโดดหนีลงน้ำ!',
    weight: 12,
  },
  {
    id: 'rusty_can',
    name: 'กระป๋องสนิมโบราณ',
    icon: '🥫',
    rarity: 'common',
    coins: 1,
    desc: 'ช่วยเก็บขยะรักษ์โลก รับโบนัสปลอบใจไป 1 เหรียญ!',
    weight: 12,
  },

  // Uncommon (30% total weight) — +3 💰
  {
    id: 'mackerel',
    name: 'ปลาทูแม่กลอง',
    icon: '🐟',
    rarity: 'uncommon',
    coins: 3,
    desc: 'หน้างอคอหัก โปรตีนเน้นๆ ไร้ไขมัน!',
    weight: 9,
  },
  {
    id: 'grilled_squid',
    name: 'หมึกสดริมหาด',
    icon: '🦑',
    rarity: 'uncommon',
    coins: 3,
    desc: 'สดเด้งดึ๋ง น่าเอาไปย่างจิ้มซีฟู้ดแซ่บๆ!',
    weight: 8,
  },
  {
    id: 'river_prawn',
    name: 'กุ้งมังกรตัวเบิ้ม',
    icon: '🦐',
    rarity: 'uncommon',
    coins: 3,
    desc: 'เนื้อแน่นหวานฉ่ำ สายคลีนต้องปลื้ม!',
    weight: 7,
  },
  {
    id: 'pufferfish',
    name: 'ปลาปักเป้าพองตัว',
    icon: '🐡',
    rarity: 'uncommon',
    coins: 3,
    desc: 'พองกลมยังกับลูกโป่ง น่ารักจนต้องปล่อยกลับทะเล!',
    weight: 6,
  },

  // Rare (13% total weight) — +7 💰
  {
    id: 'baby_shark',
    name: 'ลูกฉลามเบบี้ชาร์ก',
    icon: '🦈',
    rarity: 'rare',
    coins: 7,
    desc: 'ดู๊ดูดู๊ดู๊ดู! ดึงเบ็ดแรงจนเกือบปลิวลงน้ำ!',
    weight: 4,
  },
  {
    id: 'golden_turtle',
    name: 'เต่าทะเลกระดองทอง',
    icon: '🐢',
    rarity: 'rare',
    coins: 7,
    desc: 'สัตว์มงคลแห่งท้องทะเล แวะมาให้โชคแล้วว่ายกลับไป!',
    weight: 3,
  },
  {
    id: 'mini_kraken',
    name: 'หมึกยักษ์คราเคน',
    icon: '🐙',
    rarity: 'rare',
    coins: 7,
    desc: 'หนวดพันคันเบ็ดแน่นจนต้องช่วยกันดึง!',
    weight: 3,
  },
  {
    id: 'king_lobster',
    name: 'ล็อบสเตอร์จักรพรรดิ',
    icon: '🦞',
    rarity: 'rare',
    coins: 7,
    desc: 'ระดับพรีเมียม ตัวใหญ่เท่าแขน!',
    weight: 3,
  },

  // Legendary (5% total weight) — +15 💰
  {
    id: 'legendary_goldfish',
    name: 'ปลาทองในตำนาน',
    icon: '👑',
    rarity: 'legendary',
    coins: 15,
    desc: 'เปล่งแสงสีทองอร่ามทั่วทั้งเกาะ! โคตรดวงดี!',
    weight: 2,
  },
  {
    id: 'pirate_chest',
    name: 'หีบสมบัติโจรสลัด',
    icon: '🏴‍☠️',
    rarity: 'legendary',
    coins: 15,
    desc: 'สมบัติลับก้นมหาสมุทรที่สาบสูญมานับร้อยปี!',
    weight: 2,
  },
  {
    id: 'sea_dragon',
    name: 'ลูกพญานาคน้ำลึก',
    icon: '🐉',
    rarity: 'legendary',
    coins: 15,
    desc: 'มังกรวารีโบราณโผล่พ้นคลื่น! ทั้งสนามต้องหันมามอง!',
    weight: 1,
  },
];

export const GUARD_TROLL_CATCHES: FishingCatch[] = [
  {
    id: 'guard_hooked',
    name: 'พี่ยามติดเบ็ดขึ้นมา!!',
    icon: '👮',
    rarity: 'guard_troll',
    coins: 0,
    desc: '"เฮ้ย!! ตกปลาเยอะไปแล้วนะ! กลับไปเดินเก็บก้าวเดี๋ยวนี้!!"',
    weight: 40,
  },
  {
    id: 'guard_diver',
    name: 'พี่ยามดำน้ำมาจับถึงที่!',
    icon: '🤿',
    rarity: 'guard_troll',
    coins: 0,
    desc: '"นึกว่าแอบตกไกลๆ แล้วพี่ไม่เห็นเหรอ! ดำน้ำมาดักตัดสายเบ็ดเลย!"',
    weight: 28,
  },
  {
    id: 'guard_ticket',
    name: 'ใบสั่งจับอู้งานของพี่ยาม',
    icon: '📜',
    rarity: 'guard_troll',
    coins: 0,
    desc: '"ข้อหาอู้งานตกปลาเกินโควต้าวันนี้ ปรับให้ไปเดินเพิ่ม 1,000 ก้าว!"',
    weight: 18,
  },
  {
    id: 'guard_no_fishing_sign',
    name: 'ป้ายห้ามตกปลา (ลงชื่อ: พี่ยาม)',
    icon: '🚫',
    rarity: 'guard_troll',
    coins: 0,
    desc: '"ทะเลปิดปรับปรุง ปลาหมดบ่อแล้ว! พรุ่งนี้ 07:00 น. ค่อยมาใหม่!"',
    weight: 14,
  },
];

export function rollFishingCatch(): FishingCatch {
  const totalWeight = FISHING_CATALOG.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of FISHING_CATALOG) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return FISHING_CATALOG[0];
}

export function rollGuardTrollCatch(): FishingCatch {
  const totalWeight = GUARD_TROLL_CATCHES.reduce((sum, item) => sum + item.weight, 0);
  let r = Math.random() * totalWeight;
  for (const item of GUARD_TROLL_CATCHES) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return GUARD_TROLL_CATCHES[0];
}
