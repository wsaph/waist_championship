import {
  ANIME_CATEGORIES,
  ANIME_LIST,
  type AnimeCategoryId,
  type AnimeCategoryMeta,
} from '@/lib/anime_catalog';
import {
  MONSTER_CATEGORIES,
  MONSTER_LIST,
  type MonsterCategoryId,
  type MonsterCategoryMeta,
} from '@/lib/monster_catalog';
import {
  JOB_CATEGORIES,
  JOB_LIST,
  type JobCategoryId,
  type JobCategoryMeta,
} from '@/lib/job_catalog';
import { EXTRA_SHOP_ITEMS, EXTRA_FREE_ITEM_IDS } from '@/lib/extra_shop_items';

export {
  ANIME_CATEGORIES,
  ANIME_LIST,
  MONSTER_CATEGORIES,
  MONSTER_LIST,
  JOB_CATEGORIES,
  JOB_LIST,
  type AnimeCategoryId,
  type AnimeCategoryMeta,
  type MonsterCategoryId,
  type MonsterCategoryMeta,
  type JobCategoryId,
  type JobCategoryMeta,
};

export type GoalType =
  | 'none'
  | 'weight_loss'
  | 'weight_gain'
  | 'muscle_gain'
  | 'reps_accumulate'
  | 'distance_accumulate';

export interface GoalTypeMeta {
  id: GoalType;
  label: string;
  shortTag: string;
  unit: string;
  icon: string;
  badgeColor: string;
  isCumulative: boolean;
  description: string;
}

export const GOAL_TYPES: GoalTypeMeta[] = [
  {
    id: 'none',
    label: 'ไม่รับภารกิจเสริม (แข่ง Step Challenge อย่างเดียว)',
    shortTag: 'ไม่มีภารกิจเสริม',
    unit: 'ก้าว',
    icon: '👟',
    badgeColor: '#64748B',
    isCumulative: true,
    description: 'เน้นแข่งสะสมก้าวเดินหลักอย่างเดียว ไม่ต้องตั้งเป้าหมายเสริม (กลับมาเลือกทีหลังได้)',
  },
  {
    id: 'weight_loss',
    label: 'ลดน้ำหนัก (Weight Loss)',
    shortTag: '🔥 รีดไขมัน',
    unit: 'กก.',
    icon: '🔥',
    badgeColor: '#EF4444',
    isCumulative: false,
    description: 'ยิ่งลดพุง 3D ยิ่งยุบ วิ่งฉิวเข้าเส้นชัย',
  },
  {
    id: 'weight_gain',
    label: 'เพิ่มน้ำหนัก (Bulk Up)',
    shortTag: '🍖 ขุนน้ำหนัก',
    unit: 'กก.',
    icon: '🍖',
    badgeColor: '#F59E0B',
    isCumulative: false,
    description: 'สายเพิ่มมวล เพิ่มน้ำหนักให้ถึงเป้าหมาย',
  },
  {
    id: 'muscle_gain',
    label: 'ปั้นกล้ามเนื้อ (Muscle Gain)',
    shortTag: '💪 ปั้นกล้าม',
    unit: 'กก.',
    icon: '💪',
    badgeColor: '#3B82F6',
    isCumulative: false,
    description: 'ยิ่งกล้ามขึ้น แขน 3D ยิ่งล่ำถือดัมเบลทอง!',
  },
  {
    id: 'reps_accumulate',
    label: 'สะสมจำนวนครั้ง (Reps Quest)',
    shortTag: '⚡ สะสมครั้ง',
    unit: 'ครั้ง',
    icon: '⚡',
    badgeColor: '#10B981',
    isCumulative: true,
    description: 'สะสมจำนวนครั้ง เช่น วิดพื้น สควอท ซิทอัพ',
  },
  {
    id: 'distance_accumulate',
    label: 'สะสมระยะทาง (Distance Quest)',
    shortTag: '🏃 สะสมระยะ',
    unit: 'กม.',
    icon: '🏃',
    badgeColor: '#8B5CF6',
    isCumulative: true,
    description: 'สะสมระยะทางวิ่ง/เดินให้ครบเป้าหมาย',
  },
];

export function getGoalTypeMeta(goalType?: string): GoalTypeMeta {
  return (
    GOAL_TYPES.find((g) => g.id === goalType) ||
    GOAL_TYPES.find((g) => g.id === 'weight_loss') ||
    GOAL_TYPES[0]
  );
}

export function computeGoalProgress(
  goalType: string,
  startVal: number,
  currentVal: number,
  targetVal: number
): { pct: number; diffLabel: string; isInFoodStall: boolean } {
  if (goalType === 'none') {
    return { pct: 0, diffLabel: '👟 Step Challenge', isInFoodStall: false };
  }
  const meta = getGoalTypeMeta(goalType);
  let rawPct = 0;
  let diffLabel = '';
  let regressUnits = 0;
  let isInFoodStall = false;

  if (goalType === 'weight_loss') {
    const totalToLose = Math.max(0.1, startVal - targetVal);
    const lost = startVal - currentVal;
    rawPct = (lost / totalToLose) * 100;
    regressUnits = Math.max(0, currentVal - startVal);
    isInFoodStall = rawPct <= -15 || regressUnits >= 1.5;
    const sign = lost > 0 ? '-' : lost < 0 ? '+' : '';
    diffLabel = `${sign}${Math.abs(lost).toFixed(1)} ${meta.unit}`;
  } else if (goalType === 'weight_gain' || goalType === 'muscle_gain') {
    const totalToGain = Math.max(0.1, targetVal - startVal);
    const gained = currentVal - startVal;
    rawPct = (gained / totalToGain) * 100;
    regressUnits = Math.max(0, startVal - currentVal);
    isInFoodStall = rawPct <= -15 || regressUnits >= 1.5;
    const sign = gained >= 0 ? '+' : '-';
    const prefix = goalType === 'muscle_gain' ? 'กล้ามเนื้อ ' : '';
    diffLabel = `${prefix}${sign}${Math.abs(gained).toFixed(1)} ${meta.unit}`;
  } else {
    // reps_accumulate or distance_accumulate
    const denom = Math.max(0.1, targetVal);
    rawPct = (currentVal / denom) * 100;
    const valStr = goalType === 'reps_accumulate' ? Math.round(currentVal).toLocaleString() : currentVal.toFixed(1);
    const targetStr = goalType === 'reps_accumulate' ? Math.round(targetVal).toLocaleString() : targetVal.toFixed(1);
    diffLabel = `${valStr}/${targetStr} ${meta.unit}`;
  }

  const clamped = Math.max(-999, Math.min(100, Number(rawPct.toFixed(1))));
  return { pct: clamped, diffLabel, isInFoodStall };
}

export const SIDE_QUEST_SEASON_CAP = 500;

/**
 * คำนวณเหรียญสะสมสูงสุดที่ควรได้รับจาก "ภารกิจรอง" ตามปริมาณที่ทำได้จริง (ไม่สน % เป้าที่ตั้งเอง)
 * เพดานสูงสุด 500 🪙/ซีซั่น เพื่อป้องกันการตั้งเป้าง่ายเกินไปจนปั๊มกาชาเฟ้อ
 */
export function computeSideQuestCoins(
  goalType: string,
  startVal: number,
  currentVal: number
): number {
  if (goalType === 'weight_loss') {
    const achievedKg = Math.max(0, startVal - currentVal);
    return Math.min(SIDE_QUEST_SEASON_CAP, Math.floor(achievedKg * 80));
  }
  if (goalType === 'weight_gain' || goalType === 'muscle_gain') {
    const achievedKg = Math.max(0, currentVal - startVal);
    return Math.min(SIDE_QUEST_SEASON_CAP, Math.floor(achievedKg * 80));
  }
  if (goalType === 'distance_accumulate') {
    const achievedKm = Math.max(0, currentVal);
    return Math.min(SIDE_QUEST_SEASON_CAP, Math.floor(achievedKm * 10));
  }
  if (goalType === 'reps_accumulate') {
    const achievedReps = Math.max(0, currentVal);
    return Math.min(SIDE_QUEST_SEASON_CAP, Math.floor(achievedReps / 10));
  }
  return 0;
}

export function getSideQuestRewardHint(goalType?: string): string {
  if (goalType === 'distance_accumulate') {
    return 'สะสมจริง +10 💰/กม. (สูงสุด 500 💰/ซีซั่น) + โบนัสส่งผลรายวัน +10 💰';
  }
  if (goalType === 'reps_accumulate') {
    return 'สะสมจริง +1 💰/10 ครั้ง (สูงสุด 500 💰/ซีซั่น) + โบนัสส่งผลรายวัน +10 💰';
  }
  return 'ทำได้จริง +80 💰/กก. (สูงสุด 500 💰/ซีซั่น) + โบนัสส่งผลรายวัน +10 💰';
}

export type GenderType = 'female' | 'male';

export interface BmiMeta {
  isValid: boolean;
  bmi: number;
  tier: 'underweight' | 'normal' | 'overweight' | 'obese1' | 'obese2';
  label: string;
  badgeClass: string;
  bellyScale: number;
  gaugePct: number;
  healthyMinKg: number;
  healthyMaxKg: number;
  recommendedTargetKg: number;
}

export function computeBmiMeta(
  weightKg: number,
  heightCm: number,
  gender: GenderType = 'female'
): BmiMeta {
  const valid = Number.isFinite(weightKg) && Number.isFinite(heightCm) && weightKg >= 16 && weightKg <= 300 && heightCm >= 80 && heightCm <= 250;
  if (!valid) {
    return {
      isValid: false,
      bmi: 0,
      tier: 'normal',
      label: 'กรอกน้ำหนัก & ส่วนสูง',
      badgeClass: 'bg-slate-800 text-slate-300 border-slate-500',
      bellyScale: 1.0,
      gaugePct: 32,
      healthyMinKg: 0,
      healthyMaxKg: 0,
      recommendedTargetKg: 0,
    };
  }

  const hM = heightCm / 100;
  const h2 = hM * hM;
  const rawBmi = weightKg / h2;
  const bmi = Number(rawBmi.toFixed(1));

  let tier: BmiMeta['tier'] = 'normal';
  let label = 'สมส่วนสุขภาพดี';
  let badgeClass = 'bg-emerald-500/25 text-emerald-300 border-emerald-400';
  let gaugePct = 32;
  let baseScale = 1.0;

  // Piecewise mapping across 5 Asian BMI visual segments (20% each = 0..20..40..60..80..100%)
  if (rawBmi < 18.5) {
    tier = 'underweight';
    label = 'ผอมเพรียว';
    badgeClass = 'bg-sky-500/25 text-sky-300 border-sky-400';
    const t = Math.max(0, Math.min(1, (rawBmi - 14.5) / (18.5 - 14.5)));
    gaugePct = t * 20;
    baseScale = 0.75 + t * (0.88 - 0.75);
  } else if (rawBmi < 23.0) {
    tier = 'normal';
    label = 'สมส่วนสุขภาพดี';
    badgeClass = 'bg-emerald-500/25 text-emerald-300 border-emerald-400';
    const t = (rawBmi - 18.5) / (23.0 - 18.5);
    gaugePct = 20 + t * 20;
    baseScale = 0.88 + t * (1.05 - 0.88);
  } else if (rawBmi < 25.0) {
    tier = 'overweight';
    label = 'เริ่มท้วม';
    badgeClass = 'bg-amber-500/25 text-amber-300 border-amber-400';
    const t = (rawBmi - 23.0) / (25.0 - 23.0);
    gaugePct = 40 + t * 20;
    baseScale = 1.05 + t * (1.18 - 1.05);
  } else if (rawBmi < 30.0) {
    tier = 'obese1';
    label = 'อ้วนระดับ 1';
    badgeClass = 'bg-orange-500/25 text-orange-300 border-orange-400';
    const t = (rawBmi - 25.0) / (30.0 - 25.0);
    gaugePct = 60 + t * 20;
    baseScale = 1.18 + t * (1.38 - 1.18);
  } else {
    tier = 'obese2';
    label = 'อ้วนระดับ 2';
    badgeClass = 'bg-rose-500/25 text-rose-300 border-rose-400';
    const t = Math.max(0, Math.min(1, (rawBmi - 30.0) / (36.0 - 30.0)));
    gaugePct = 80 + t * 20;
    baseScale = 1.38 + t * (1.55 - 1.38);
  }

  const genderOffset = gender === 'male' ? 0.02 : -0.02;
  const bellyScale = Number(Math.max(0.75, Math.min(1.55, baseScale + genderOffset)).toFixed(2));
  const healthyMinKg = Number((18.5 * h2).toFixed(1));
  const healthyMaxKg = Number((22.9 * h2).toFixed(1));
  const idealBmi = gender === 'male' ? 22.0 : 20.5;
  const recommendedTargetKg = Math.round(idealBmi * h2 * 2) / 2;

  return {
    isValid: true,
    bmi,
    tier,
    label,
    badgeClass,
    bellyScale,
    gaugePct: Number(Math.max(2, Math.min(98, gaugePct)).toFixed(1)),
    healthyMinKg,
    healthyMaxKg,
    recommendedTargetKg,
  };
}

export type SpeciesCategoryId = 'pet' | 'wild' | 'extinct' | 'mythical';

export interface SpeciesCategoryMeta {
  id: SpeciesCategoryId;
  name: string;
  emoji: string;
  desc: string;
}

export const SPECIES_CATEGORIES: SpeciesCategoryMeta[] = [
  { id: 'pet', name: 'สัตว์เลี้ยง', emoji: '🐾', desc: 'แก๊งสัตว์เลี้ยงคู่ใจสายน่ารัก' },
  { id: 'wild', name: 'สัตว์ป่า', emoji: '🦁', desc: 'สัตว์ป่าตัวตึงสายลุยธรรมชาติ' },
  { id: 'extinct', name: 'สูญพันธุ์', emoji: '🦖', desc: 'ตำนานดึกดำบรรพ์คืนชีพลงสนาม' },
  { id: 'mythical', name: 'เทพนิยาย', emoji: '🐉', desc: 'สัตว์วิเศษในตำนานพลังเวทล้นพุง' },
];

export type HeroCategoryId = 'princess' | 'classic' | 'pixar' | 'villain';

export interface HeroCategoryMeta {
  id: HeroCategoryId;
  name: string;
  emoji: string;
  desc: string;
}

export const HERO_CATEGORIES: HeroCategoryMeta[] = [
  { id: 'princess', name: 'เจ้าหญิง', emoji: '👑', desc: 'สโนว์ไวท์ เอลซ่า ซินเดอเรลล่า แอเรียล ราพันเซล' },
  { id: 'classic', name: 'คลาสสิก', emoji: '🏰', desc: 'มิกกี้ มินนี่ สติทช์ อะลาดิน จินนี่ ปีเตอร์แพน' },
  { id: 'pixar', name: 'พิกซาร์/ฮิต', emoji: '🚀', desc: 'วู้ดดี้ บัซ เบย์แมกซ์ ซัลลี่ ไมค์ โอลาฟ Inside Out' },
  { id: 'villain', name: 'วายร้าย', emoji: '😈', desc: 'มาเลฟิเซนต์ เออร์ซูล่า ครูเอลล่า ฮาเดส ล็อตโซ่' },
];

export type HeroHeadStyle =
  | 'bald_hero'
  | 'snow_bob_bow'
  | 'elsa_side_braid'
  | 'anna_twin_braids'
  | 'cinderella_updo'
  | 'ariel_wave_flower'
  | 'rapunzel_floral_long'
  | 'jasmine_ponytail_gem'
  | 'mulan_jade_bun'
  | 'royal_tiara_curls'
  | 'merida_wild_curls'
  | 'tinker_pom_bun'
  | 'aladdin_fez'
  | 'genie_topknot_beard'
  | 'peter_robin_cap'
  | 'pinocchio_hat_nose'
  | 'mickey_ears'
  | 'minnie_bow_ears'
  | 'donald_sailor_beak'
  | 'stitch_alien_ears'
  | 'cowboy_hat'
  | 'buzz_space_dome'
  | 'three_eye_alien'
  | 'baymax_eyes'
  | 'mike_cyclops'
  | 'sulley_horns'
  | 'olaf_snowman'
  | 'maleficent_horns'
  | 'cruella_half_hair'
  | 'hades_flame_hair'
  | 'queen_crown_veil'
  | 'villain_tophat_plume'
  | 'mirabel_glasses_curls'
  | 'boo_twintails'
  | 'incredible_mask'
  | 'pirate_dreads_tricorne'
  | 'anime_spiky_shonen'
  | 'anime_straw_hat'
  | 'anime_headband_spiky'
  | 'anime_slayer_earrings'
  | 'anime_boar_mask'
  | 'anime_blindfold_spiky'
  | 'anime_bald_shine'
  | 'anime_sailor_odango'
  | 'anime_bamboo_muzzle'
  | 'anime_anya_cones'
  | 'anime_elf_twintails'
  | 'anime_maid_bob'
  | 'anime_doraemon_bell'
  | 'anime_shinchan_brows'
  | 'anime_glasses_detective'
  | 'anime_pikachu_ears'
  | 'anime_chopper_hat'
  | 'anime_ninja_mask_silver'
  | 'anime_chainsaw_head'
  | 'anime_korosensei_smile'
  | 'anime_jotaro_cap'
  | 'monster_thai_ghost'
  | 'monster_sheet_ghost'
  | 'monster_jiangshi'
  | 'monster_mummy'
  | 'monster_pumpkin'
  | 'monster_vampire'
  | 'monster_frankenstein'
  | 'monster_kaiju_spikes'
  | 'monster_alien_eyes'
  | 'monster_yokai'
  | 'job_knight_helm'
  | 'job_samurai_kabuto'
  | 'job_wizard_hat'
  | 'job_priest_mitre'
  | 'job_assassin_hood'
  | 'job_cowboy_ranger'
  | 'job_mechanic_goggles'
  | 'job_astronaut_chef';

export interface SpeciesOption {
  id: string;
  category: SpeciesCategoryId;
  name: string;
  nickname: string;
  emoji: string;
  colorHex: string;
  bandColor: string;
  earStyle:
    | 'human'
    | 'bunny'
    | 'lop'
    | 'fox'
    | 'cat'
    | 'folded_cat'
    | 'corgi'
    | 'shiba'
    | 'pug'
    | 'dog_floppy'
    | 'bear'
    | 'pig'
    | 'alpaca'
    | 'duck'
    | 'monkey'
    | 'capybara'
    | 'frog'
    | 'panda'
    | 'seal'
    | 'trex'
    | 'triceratops'
    | 'mammoth'
    | 'sabretooth'
    | 'dodo'
    | 'pterodactyl'
    | 'dragon'
    | 'unicorn'
    | 'phoenix'
    | 'griffin'
    | 'kitsune'
    | 'cerberus'
    | 'lion'
    | 'deer'
    | 'bull'
    | 'shark'
    | 'axolotl'
    | 'elephant'
    | 'jackalope';
  isHero?: boolean;
  heroCategory?: HeroCategoryId;
  animeCategory?: AnimeCategoryId;
  monsterCategory?: MonsterCategoryId;
  jobCategory?: JobCategoryId;
  heroStyle?: HeroHeadStyle;
  skinHex?: string;
  defaultArmor?: string;
  defaultShirtHex?: string;
  defaultPantsHex?: string;
  whiskers?: boolean;
  facePattern?: 'none' | 'mask_white' | 'husky_mask' | 'pug_wrinkle' | 'siamese_points' | 'calico' | 'raccoon_mask' | 'cow_spots' | 'red_panda';
  headTopper?: 'none' | 'alpaca_fluff' | 'capybara_orange';
  tailStyle?: 'normal' | 'curly' | 'fluffy' | 'long' | 'nub' | 'dino_spikes' | 'dragon_spade' | 'rainbow' | 'kitsune_multi';
  desc: string;
}

export const SPECIES_LIST: SpeciesOption[] = [
  // ============================================================================
  // 🐾 1. สัตว์เลี้ยง (Pets - 30 สายพันธุ์)
  // ============================================================================
  { id: 'corgi', category: 'pet', name: 'คอร์กี้', nickname: 'คอร์กี้ขาหมู', emoji: '🐶', colorHex: '#F59E0B', bandColor: '#FEF3C7', earStyle: 'corgi', facePattern: 'mask_white', tailStyle: 'nub', desc: 'ขาสั้นก้นเด้ง หูตั้งใหญ่ วิ่งไวสายอึด' },
  { id: 'pug', category: 'pet', name: 'ปั๊กหน้าย่น', nickname: 'ปั๊กพุงพลุ้ย', emoji: '🐶', colorHex: '#D6B88C', bandColor: '#EF4444', earStyle: 'pug', facePattern: 'pug_wrinkle', tailStyle: 'curly', desc: 'หน้าสั้นจมูกดำย่น พุงกลมแต่ใจสู้' },
  { id: 'husky', category: 'pet', name: 'ไซบีเรียนฮัสกี้', nickname: 'ฮัสกี้เห่าหาบุฟเฟต์', emoji: '🐺', colorHex: '#64748B', bandColor: '#38BDF8', earStyle: 'shiba', facePattern: 'husky_mask', tailStyle: 'fluffy', desc: 'หน้าดุแต่ติ๊งต๊อง พลังดีดทะลุเส้นชัย' },
  { id: 'golden', category: 'pet', name: 'โกลเด้นรีทรีฟเวอร์', nickname: 'โกลเด้นนักชิม', emoji: '🐕‍🦺', colorHex: '#FBBF24', bandColor: '#22C55E', earStyle: 'dog_floppy', tailStyle: 'fluffy', desc: 'ใจดีขี้อ้อน กลิ่นหมูปิ้งอยู่ไหนไปถึงนั่น' },
  { id: 'chihuahua', category: 'pet', name: 'ชิวาวาตาแป๋ว', nickname: 'จิ๋วพริกขี้หนู', emoji: '🐕', colorHex: '#FDE68A', bandColor: '#F43F5E', earStyle: 'corgi', tailStyle: 'long', desc: 'ตัวเล็กหูใหญ่ เสียงดังสั่งข้าวไวสุด' },
  { id: 'dachshund', category: 'pet', name: 'ดัชชุนไส้กรอก', nickname: 'ฮอทดอกเดินได้', emoji: '🌭', colorHex: '#92400E', bandColor: '#FACC15', earStyle: 'dog_floppy', tailStyle: 'long', desc: 'ตัวยาวขาสั้น มุดเข้าเส้นชัยก่อนใคร' },
  { id: 'poodle', category: 'pet', name: 'พุดเดิ้ลขนปุย', nickname: 'คุณหนูสายวิ่ง', emoji: '🐩', colorHex: '#FBCFE8', bandColor: '#A855F7', earStyle: 'dog_floppy', headTopper: 'alpaca_fluff', tailStyle: 'nub', desc: 'ขนหยิกฟูฟ่อง วิ่งสวยไม่เสียทรง' },
  { id: 'orange_cat', category: 'pet', name: 'แมวส้ม', nickname: 'ต้าวส้มกินจุ', emoji: '🐱', colorHex: '#FB923C', bandColor: '#FFFBEB', earStyle: 'cat', whiskers: true, tailStyle: 'long', desc: 'แมวส้มครองโลก จอมป่วนซุ้มอาหาร' },
  { id: 'scottish_fold', category: 'pet', name: 'สก็อตติชโฟลด์', nickname: 'เหมียวหูพับแก้มกลม', emoji: '😺', colorHex: '#CBD5E1', bandColor: '#F472B6', earStyle: 'folded_cat', whiskers: true, tailStyle: 'long', desc: 'หูพับหน้ากลมบ๊อก นั่งอ้อนขอขนมแมวเลีย' },
  { id: 'siamese', category: 'pet', name: 'แมววิเชียรมาศ', nickname: 'คุณชายแต้มน้ำตาล', emoji: '🐈', colorHex: '#FEF3C7', bandColor: '#3B82F6', earStyle: 'cat', whiskers: true, facePattern: 'siamese_points', tailStyle: 'long', desc: 'แมวไทยโบราณมาดนิ่ง สง่างามแต่แอบอ้วน' },
  { id: 'sphynx', category: 'pet', name: 'แมวสฟิงซ์', nickname: 'สฟิงซ์โชว์พุงกะทิ', emoji: '👽', colorHex: '#FBCFE8', bandColor: '#8B5CF6', earStyle: 'cat', whiskers: false, tailStyle: 'long', desc: 'ไร้ขนบังพุง ลดนิดเดียวซิกแพคก็เห็นชัด!' },
  { id: 'calico', category: 'pet', name: 'แมวสามสีนำโชค', nickname: 'เหมียวกวักเรียกแต้ม', emoji: '🐈', colorHex: '#FFFBEB', bandColor: '#EF4444', earStyle: 'cat', whiskers: true, facePattern: 'calico', tailStyle: 'long', desc: 'แมวกวักมงคล เรียกทั้งโชคและของอร่อย' },
  { id: 'bunny', category: 'pet', name: 'กระต่ายหูตั้ง', nickname: 'กระต่ายแก้มโมจิ', emoji: '🐰', colorHex: '#F8FAFC', bandColor: '#F472B6', earStyle: 'bunny', tailStyle: 'nub', desc: 'หูยาวปราดเปรียว แก้มยุ้ยกระโดดไว' },
  { id: 'holland_lop', category: 'pet', name: 'ฮอลแลนด์ลอป', nickname: 'ลอปหูตกขี้อ้อน', emoji: '🐇', colorHex: '#E7E5E4', bandColor: '#A855F7', earStyle: 'lop', tailStyle: 'nub', desc: 'หูตกยาวข้างแก้ม น่ารักจนเพื่อนไม่กล้าแกล้ง' },
  { id: 'hamster', category: 'pet', name: 'แฮมสเตอร์', nickname: 'แก้มตุ่ยตุนเสบียง', emoji: '🐹', colorHex: '#FDBA74', bandColor: '#FEF08A', earStyle: 'bear', facePattern: 'mask_white', tailStyle: 'nub', desc: 'กระพุ้งแก้มป่องสองข้าง อมเมล็ดทานตะวันเต็มปาก' },
  { id: 'guinea_pig', category: 'pet', name: 'หนูตะเภา', nickname: 'แกสบี้ก้อนขนมปัง', emoji: '🐹', colorHex: '#D97706', bandColor: '#4ADE80', earStyle: 'folded_cat', facePattern: 'mask_white', tailStyle: 'nub', desc: 'ร้องวี๊ดๆ ขอผักกาดสดทุกเช้า' },
  { id: 'chinchilla', category: 'pet', name: 'ชินชิลล่า', nickname: 'ก้อนฝุ่นนุ่มนิ่ม', emoji: '🐭', colorHex: '#94A3B8', bandColor: '#F472B6', earStyle: 'bear', whiskers: true, tailStyle: 'fluffy', desc: 'ขนนุ่มละเอียดที่สุดในโลก กระโดดเด้งดึ๋ง' },
  { id: 'ferret', category: 'pet', name: 'เฟอร์เรท', nickname: 'จรวดน้อยจอมมุด', emoji: '🦦', colorHex: '#FEF3C7', bandColor: '#92400E', earStyle: 'bear', facePattern: 'raccoon_mask', tailStyle: 'fluffy', desc: 'ตัวพริ้วไหวซอกแซกไวไม่มีเหนื่อย' },
  { id: 'hedgehog', category: 'pet', name: 'เม่นแคระ', nickname: 'ลูกทุเรียนเดินได้', emoji: '🦔', colorHex: '#A8A29E', bandColor: '#FACC15', earStyle: 'bear', headTopper: 'alpaca_fluff', tailStyle: 'nub', desc: 'ขดตัวกลมกลิ้งเข้าเส้นชัยแบบติดเทอร์โบ' },
  { id: 'sugar_glider', category: 'pet', name: 'ชูการ์ไกลเดอร์', nickname: 'กระรอกบินติดหวาน', emoji: '🐿️', colorHex: '#CBD5E1', bandColor: '#38BDF8', earStyle: 'monkey', facePattern: 'mask_white', tailStyle: 'fluffy', desc: 'ตาโตเท่าไข่มุก ร่อนถลาจากต้นมะพร้าว' },
  { id: 'mini_pig', category: 'pet', name: 'หมูจิ๋วสีชมพู', nickname: 'หมูกรอบเดินได้', emoji: '🐷', colorHex: '#F472B6', bandColor: '#FBCFE8', earStyle: 'pig', tailStyle: 'curly', desc: 'จมูกชมพูหางม้วน พลังพุ่งชนไม่ยั้ง' },
  { id: 'fat_duck', category: 'pet', name: 'เป็ดคอลดั๊ก', nickname: 'เป็ดอ้วนปากส้ม', emoji: '🦆', colorHex: '#FEF08A', bandColor: '#F97316', earStyle: 'duck', tailStyle: 'nub', desc: 'ก๊าบๆ ปากส้ม พุงกลมเดินเตาะแตะริมหาด' },
  { id: 'cockatiel', category: 'pet', name: 'นกค็อกคาเทล', nickname: 'นกหงอนเหลืองแก้มส้ม', emoji: '🦜', colorHex: '#FEF9C3', bandColor: '#FB923C', earStyle: 'dodo', tailStyle: 'long', desc: 'ผิวปากเป็นเพลงเชียร์เพื่อนข้างสนาม' },
  { id: 'macaw', category: 'pet', name: 'นกแก้วมาคอว์', nickname: 'มาคอว์สีรุ้งช่างจ้อ', emoji: '🦜', colorHex: '#EF4444', bandColor: '#38BDF8', earStyle: 'dodo', tailStyle: 'rainbow', desc: 'สีสดแสบตา พูดแซวคนอ้วนได้ทั้งวัน' },
  { id: 'turtle_pet', category: 'pet', name: 'เต่าซูคาต้า', nickname: 'เต่าน้อยสปีดต้น', emoji: '🐢', colorHex: '#65A30D', bandColor: '#A16207', earStyle: 'frog', tailStyle: 'nub', desc: 'ช้าแต่ชัวร์ นิทานเรื่องนี้เต่าชนะกระต่าย!' },
  { id: 'axolotl', category: 'pet', name: 'แอกโซลอเติล', nickname: 'หมาน้ำชมพูยิ้มหวาน', emoji: '🦎', colorHex: '#F9A8D4', bandColor: '#F43F5E', earStyle: 'axolotl', tailStyle: 'long', desc: 'เหงือกชมพูบานแฉ่ง ยิ้มอารมณ์ดีตลอดเวลา' },
  { id: 'koi_fish', category: 'pet', name: 'ปลาคาร์ปมงคล', nickname: 'โคฮากุว่ายทวนน้ำ', emoji: '🎏', colorHex: '#FFFFFF', bandColor: '#EF4444', earStyle: 'axolotl', facePattern: 'calico', tailStyle: 'fluffy', desc: 'ปลาคาร์ปแดงขาว กระโดดข้ามประตูมังกร' },
  { id: 'alpaca', category: 'pet', name: 'อัลปาก้าขนฟู', nickname: 'อัลปาก้าหน้ามึน', emoji: '🦙', colorHex: '#FEF3C7', bandColor: '#EC4899', earStyle: 'alpaca', headTopper: 'alpaca_fluff', tailStyle: 'nub', desc: 'ขนฟูบนหัว นุ่มนิ่มเดินโยกเยก' },
  { id: 'cloud_sheep', category: 'pet', name: 'แกะปุยเมฆ', nickname: 'แกะน้อยขี้เซา', emoji: '🐑', colorHex: '#F8FAFC', bandColor: '#60A5FA', earStyle: 'lop', headTopper: 'alpaca_fluff', tailStyle: 'nub', desc: 'ขนปุยเหมือนสายไหม วิ่งไปสัปหงกไป' },
  { id: 'dairy_cow', category: 'pet', name: 'วัวนมจิ๋วมินิ', nickname: 'วัวนมไข่มุกหวานร้อย', emoji: '🐮', colorHex: '#F8FAFC', bandColor: '#F472B6', earStyle: 'pig', facePattern: 'cow_spots', tailStyle: 'long', desc: 'ลายจุดขาวดำ ขวัญใจสายนมสดปั่น' },

  // ============================================================================
  // 🦁 2. สัตว์ป่า (Wild Animals - 30 สายพันธุ์)
  // ============================================================================
  { id: 'lion', category: 'wild', name: 'สิงโตเจ้าป่า', nickname: 'ราชสีห์แผงคอทอง', emoji: '🦁', colorHex: '#F59E0B', bandColor: '#B45309', earStyle: 'lion', tailStyle: 'long', desc: 'คำรามก้องชายหาด แผงคอฟูสง่างาม' },
  { id: 'tiger', category: 'wild', name: 'เสือโคร่งเบงกอล', nickname: 'พยัคฆ์สายเนื้อย่าง', emoji: '🐯', colorHex: '#EA580C', bandColor: '#18181B', earStyle: 'cat', whiskers: true, facePattern: 'mask_white', tailStyle: 'long', desc: 'ลายพาดกลอนดุดัน วิ่งล่าแคลอรี่ไม่ปรานี' },
  { id: 'cheetah', category: 'wild', name: 'เสือชีตาห์', nickname: 'จรวดทางเรียบซาฟารี', emoji: '🐆', colorHex: '#FACC15', bandColor: '#18181B', earStyle: 'cat', whiskers: true, facePattern: 'cow_spots', tailStyle: 'long', desc: 'ความเร็วสูงสุดในปฐพี สปรินต์เข้าเส้นชัย' },
  { id: 'fox', category: 'wild', name: 'จิ้งจอกแดง', nickname: 'จิ้งจอกสายแซ่บ', emoji: '🦊', colorHex: '#EA580C', bandColor: '#FEF08A', earStyle: 'fox', facePattern: 'mask_white', tailStyle: 'fluffy', desc: 'หูแหลมปลายดำ หางพวงใหญ่ เจ้าเล่ห์ว่องไว' },
  { id: 'wolf', category: 'wild', name: 'หมาป่าสีเทา', nickname: 'จ่าฝูงหอนหาชาบู', emoji: '🐺', colorHex: '#475569', bandColor: '#E2E8F0', earStyle: 'fox', facePattern: 'husky_mask', tailStyle: 'fluffy', desc: 'นักล่าแห่งพงไพร อึดถึกทนทุกสภาพอากาศ' },
  { id: 'bear', category: 'wild', name: 'หมีกริซลี่', nickname: 'พี่หมีจอมพลัง', emoji: '🐻', colorHex: '#78350F', bandColor: '#FDE68A', earStyle: 'bear', tailStyle: 'nub', desc: 'พี่หมีสายยกเวท แข็งแกร่งดั่งหินผา' },
  { id: 'polar_bear', category: 'wild', name: 'หมีขั้วโลก', nickname: 'หมีขาวน้ำแข็งไส', emoji: '🐻‍❄️', colorHex: '#F1F5F9', bandColor: '#38BDF8', earStyle: 'bear', tailStyle: 'nub', desc: 'หมีขาวตัวโต ชอบกินบิงซูริมทะเลเป็นที่สุด' },
  { id: 'panda', category: 'wild', name: 'แพนด้ายักษ์', nickname: 'แพนด้าจอมหม่ำ', emoji: '🐼', colorHex: '#F8FAFC', bandColor: '#18181B', earStyle: 'panda', tailStyle: 'nub', desc: 'ขอบตาดำกลมปุ๊ก กลิ้งหลุนๆ เข้าเส้นชัย' },
  { id: 'red_panda', category: 'wild', name: 'แพนด้าแดง', nickname: 'แพนด้าแดงพุงป่อง', emoji: '🦊', colorHex: '#C2410C', bandColor: '#FDE68A', earStyle: 'cat', facePattern: 'red_panda', tailStyle: 'fluffy', desc: 'ชูสองแขนขู่แบบน่ารักเกินต้านทาน' },
  { id: 'raccoon', category: 'wild', name: 'แรคคูน', nickname: 'จอมโจรคุ้ยซุ้มอาหาร', emoji: '🦝', colorHex: '#64748B', bandColor: '#1E293B', earStyle: 'cat', facePattern: 'raccoon_mask', tailStyle: 'fluffy', desc: 'คาดผ้าปิดตาธรรมชาติ แอบฉกของกินยามดึก' },
  { id: 'koala', category: 'wild', name: 'โคอาล่า', nickname: 'โคอาล่ากอดเสานอน', emoji: '🐨', colorHex: '#94A3B8', bandColor: '#A3E635', earStyle: 'monkey', facePattern: 'pug_wrinkle', tailStyle: 'nub', desc: 'หูฟูจมูกโต นอนวันละ 20 ชั่วโมงก็ยังผอม!' },
  { id: 'kangaroo', category: 'wild', name: 'จิงโจ้นักมวย', nickname: 'จิงโจ้กล้ามท้องแปดลูก', emoji: '🦘', colorHex: '#D97706', bandColor: '#EF4444', earStyle: 'bunny', tailStyle: 'long', desc: 'ฟุตเวิร์คกระโดดคู่ ต่อยไขมันกระจุย' },
  { id: 'sloth', category: 'wild', name: 'สลอธสโลว์ไลฟ์', nickname: 'ขยับวันละนิดจิตแจ่มใส', emoji: '🦥', colorHex: '#A8A29E', bandColor: '#84CC16', earStyle: 'bear', facePattern: 'raccoon_mask', tailStyle: 'nub', desc: 'ไม่เน้นวิ่งไว เน้นยิ้มละมุนเข้าเส้นชัย' },
  { id: 'capybara', category: 'wild', name: 'คาปิบาร่า', nickname: 'กะปิปลาร้าปล่อยจอย', emoji: '🍊', colorHex: '#B45309', bandColor: '#FDE68A', earStyle: 'capybara', headTopper: 'capybara_orange', tailStyle: 'nub', desc: 'วางส้มบนหัว นิ่งสงบสยบทุกแคลอรี่' },
  { id: 'elephant', category: 'wild', name: 'ช้างป่าไอยรา', nickname: 'ช้างน้อยงวงดูดชานม', emoji: '🐘', colorHex: '#64748B', bandColor: '#FACC15', earStyle: 'elephant', tailStyle: 'long', desc: 'หูใหญ่พัดลมเย็นสบาย พลังช้างสารสะท้านลู่' },
  { id: 'rhino', category: 'wild', name: 'แรดหุ้มเกราะ', nickname: 'รถด่วนนอเดียวชนแหลก', emoji: '🦏', colorHex: '#71717A', bandColor: '#FDE047', earStyle: 'triceratops', tailStyle: 'nub', desc: 'ก้มหน้าพุ่งตรงรวดเดียวถึงเส้นชัย' },
  { id: 'hippo', category: 'wild', name: 'ฮิปโปหมูเด้ง', nickname: 'หมูเด้งพุงเด้งระดับโลก', emoji: '🦛', colorHex: '#9D7B8D', bandColor: '#F472B6', earStyle: 'capybara', tailStyle: 'nub', desc: 'ตัวตึงไวรัล แก้มชมพูอ้าปากสวบกะละมัง!' },
  { id: 'giraffe', category: 'wild', name: 'ยีราฟคอยาว', nickname: 'หอคอยส่องเส้นชัย', emoji: '🦒', colorHex: '#FBBF24', bandColor: '#92400E', earStyle: 'deer', facePattern: 'cow_spots', tailStyle: 'long', desc: 'ก้าวขายาวทีเดียวเท่ากับคนอื่นก้าวสามที' },
  { id: 'zebra', category: 'wild', name: 'ม้าลายซาฟารี', nickname: 'เจ้าถิ่นทางม้าลาย', emoji: '🦓', colorHex: '#F8FAFC', bandColor: '#18181B', earStyle: 'alpaca', facePattern: 'husky_mask', tailStyle: 'long', desc: 'พี่ยามไม่กล้าไล่ เพราะตัวเป็นทางม้าลายเอง!' },
  { id: 'deer', category: 'wild', name: 'กวางเรนเดียร์', nickname: 'กวางน้อยเขาแตกกิ่ง', emoji: '🦌', colorHex: '#B45309', bandColor: '#EF4444', earStyle: 'deer', facePattern: 'mask_white', tailStyle: 'nub', desc: 'เขากวางสง่างาม กระโดดพริ้วข้ามสิ่งกีดขวาง' },
  { id: 'buffalo', category: 'wild', name: 'กระทิงป่าเขาโค้ง', nickname: 'กระทิงเปลี่ยวสายปั๊ม', emoji: '🦬', colorHex: '#292524', bandColor: '#EF4444', earStyle: 'bull', tailStyle: 'long', desc: 'กล้ามอกแน่นปั้ก เห็นผ้าแดงแล้วพุ่งเข้าใส่' },
  { id: 'gorilla', category: 'wild', name: 'กอริลล่าหลังเงิน', nickname: 'คิงคองทุบอกโชว์กล้าม', emoji: '🦍', colorHex: '#334155', bandColor: '#FACC15', earStyle: 'monkey', facePattern: 'pug_wrinkle', tailStyle: 'nub', desc: 'ราชาเวทเทรนนิ่งแห่งพงไพร กล้ามแขนล้นจอ' },
  { id: 'monkey', category: 'wild', name: 'ลิงจ๋อป่าดง', nickname: 'ลิงจ๋อจอมซน', emoji: '🐵', colorHex: '#92400E', bandColor: '#FDE047', earStyle: 'monkey', tailStyle: 'long', desc: 'หูกลมกางคล่องตัว ตีลังกาเข้าเส้นชัย' },
  { id: 'penguin', category: 'wild', name: 'เพนกวินจักรพรรดิ', nickname: 'ทักซิโด้ไถลพุง', emoji: '🐧', colorHex: '#1E293B', bandColor: '#38BDF8', earStyle: 'duck', facePattern: 'mask_white', tailStyle: 'nub', desc: 'เดินเตาะแตะแต่สไลด์พุงไปข้างหน้าไวมาก' },
  { id: 'owl', category: 'wild', name: 'นกฮูกตาโต', nickname: 'ฮูกสายหิวดึกตีสอง', emoji: '🦉', colorHex: '#78350F', bandColor: '#FDE047', earStyle: 'griffin', tailStyle: 'fluffy', desc: 'ตาสว่างตอนเที่ยงคืน คอยจับตาดูคนตบะแตก' },
  { id: 'flamingo', category: 'wild', name: 'ฟลามิงโกชมพู', nickname: 'ตัวแม่โพสท่าริมหาด', emoji: '🦩', colorHex: '#F472B6', bandColor: '#FB7185', earStyle: 'dodo', tailStyle: 'fluffy', desc: 'สีชมพูโดดเด่นเข้ากับบรรยากาศชายทะเลสุดๆ' },
  { id: 'crocodile', category: 'wild', name: 'จระเข้เขี้ยวคม', nickname: 'ชาละวันคลานต่ำ', emoji: '🐊', colorHex: '#15803D', bandColor: '#BEF264', earStyle: 'trex', tailStyle: 'dino_spikes', desc: 'ฟันเรียงสวย แหวกว่ายขึ้นหาดมาชิงแชมป์' },
  { id: 'shark_wild', category: 'wild', name: 'ฉลามขาวเจ้าสมุทร', nickname: 'เบบี้ชาร์คบุกหาด', emoji: '🦈', colorHex: '#38BDF8', bandColor: '#F8FAFC', earStyle: 'shark', tailStyle: 'dragon_spade', desc: 'ครีบฉลามโผล่พ้นน้ำ ว่ายขึ้นบกมาวิ่งแข่ง!' },
  { id: 'frog', category: 'wild', name: 'กบเด้งดึ๋ง', nickname: 'กบอ๊บสายอึด', emoji: '🐸', colorHex: '#4ADE80', bandColor: '#FEF08A', earStyle: 'frog', tailStyle: 'nub', desc: 'ตาโปนยิ้มกว้าง กระโดดข้ามด่านรัวๆ' },
  { id: 'seal', category: 'wild', name: 'แมวน้ำอุ๋งๆ', nickname: 'แมวน้ำกลิ้งได้', emoji: '🦭', colorHex: '#94A3B8', bandColor: '#2DD4BF', earStyle: 'seal', tailStyle: 'nub', desc: 'อ้วนกลมลื่นไหล พุงเด้งรับคลื่นทะเล' },

  // ============================================================================
  // 🦖 3. สัตว์สูญพันธุ์ (Extinct & Prehistoric - 30 สายพันธุ์)
  // ============================================================================
  { id: 'trex', category: 'extinct', name: 'ทีเร็กซ์', nickname: 'ทีเร็กซ์แขนสั้นหิวเนื้อ', emoji: '🦖', colorHex: '#16A34A', bandColor: '#FACC15', earStyle: 'trex', tailStyle: 'dino_spikes', desc: 'ราชาไดโนเสาร์เขี้ยวคม แขนสั้นแต่วิ่งสับตีนแตก' },
  { id: 'triceratops', category: 'extinct', name: 'ไทรเซอราทอปส์', nickname: 'สามเขาชนบุฟเฟต์', emoji: '🦕', colorHex: '#0EA5E9', bandColor: '#FDE047', earStyle: 'triceratops', tailStyle: 'dino_spikes', desc: 'แผงเกราะคอสุดเท่ พร้อมเขา 3 เล่มพุ่งทะลวงลู่' },
  { id: 'velociraptor', category: 'extinct', name: 'เวโลซีแรปเตอร์', nickname: 'แรปเตอร์สปรินต์สายฟ้า', emoji: '🦖', colorHex: '#EA580C', bandColor: '#FEF08A', earStyle: 'trex', tailStyle: 'dino_spikes', desc: 'ไดโนเสาร์นักล่าความเร็วสูง วิ่งแซงทางโค้ง' },
  { id: 'spinosaurus', category: 'extinct', name: 'สไปโนซอรัส', nickname: 'จอมอสูรกระโดงหลัง', emoji: '🦖', colorHex: '#0D9488', bandColor: '#F97316', earStyle: 'trex', tailStyle: 'dino_spikes', desc: 'ไดโนเสาร์ครีบหลังยักษ์ ว่ายน้ำก็ได้วิ่งก็โหด' },
  { id: 'stegosaurus', category: 'extinct', name: 'สเตโกซอรัส', nickname: 'แผงเกราะหลังฟาดหาง', emoji: '🦕', colorHex: '#65A30D', bandColor: '#FB923C', earStyle: 'trex', tailStyle: 'dino_spikes', desc: 'แผ่นเกราะเรียงเต็มหลัง ฟาดหางหนามกันคนแย่งข้าว' },
  { id: 'ankylosaurus', category: 'extinct', name: 'แองคิโลซอรัส', nickname: 'รถถังหุ้มเกราะหางลูกตุ้ม', emoji: '🐢', colorHex: '#78716C', bandColor: '#FACC15', earStyle: 'triceratops', tailStyle: 'dragon_spade', desc: 'หุ้มเกราะเหล็กทั้งตัว ไม่มีใครเบียดตกขอบลู่ได้' },
  { id: 'brachiosaurus', category: 'extinct', name: 'แบรคิโอซอรัส', nickname: 'พี่ใหญ่คอยาวสายคลีน', emoji: '🦕', colorHex: '#34D399', bandColor: '#FEF3C7', earStyle: 'alpaca', tailStyle: 'long', desc: 'ไดโนเสาร์กินพืชสายสุขภาพ กินแต่ผักใบเขียวล้วนๆ' },
  { id: 'parasaurolophus', category: 'extinct', name: 'พาราซอโรโลฟัส', nickname: 'ไดโนเสาร์หงอนแตร', emoji: '🦕', colorHex: '#06B6D4', bandColor: '#F472B6', earStyle: 'pterodactyl', tailStyle: 'dino_spikes', desc: 'หงอนยาวด้านหลังเป่าเป็นเสียงแตรเชียร์ตัวเอง' },
  { id: 'pachycephalosaurus', category: 'extinct', name: 'พาคีเซฟาโลซอรัส', nickname: 'หัวโดมเหล็กโหม่งเส้นชัย', emoji: '🦖', colorHex: '#CA8A04', bandColor: '#FEF08A', earStyle: 'bear', headTopper: 'alpaca_fluff', tailStyle: 'dino_spikes', desc: 'กะโหลกหนาทรงโดม พุ่งโหม่งทะลุทุกกำแพงน้ำหนัก' },
  { id: 'carnotaurus', category: 'extinct', name: 'คาร์โนทอรัส', nickname: 'ไดโนเสาร์เขากระทิงดุ', emoji: '🦖', colorHex: '#B91C1C', bandColor: '#18181B', earStyle: 'bull', tailStyle: 'dino_spikes', desc: 'นักล่ามีเขาคู่เหนือตา ดุดันเร่งสปีดทางตรง' },
  { id: 'dilophosaurus', category: 'extinct', name: 'ไดโลโฟซอรัส', nickname: 'แผงคอพัดคู่สุดจี๊ด', emoji: '🦎', colorHex: '#84CC16', bandColor: '#EF4444', earStyle: 'axolotl', tailStyle: 'dino_spikes', desc: 'กางแผงคอสีสดใสขู่คู่แข่งให้ตกใจจนหยุดวิ่ง' },
  { id: 'allosaurus', category: 'extinct', name: 'อัลโลซอรัส', nickname: 'สิงโตแห่งยุคจูราสสิก', emoji: '🦖', colorHex: '#2563EB', bandColor: '#FDE047', earStyle: 'trex', tailStyle: 'dino_spikes', desc: 'จอมเขมือบยุคดึกดำบรรพ์ ไม่เคยยอมแพ้ใคร' },
  { id: 'therizinosaurus', category: 'extinct', name: 'เธอริซิโนซอรัส', nickname: 'กงเล็บยาวคีบหมูชาบู', emoji: '🦖', colorHex: '#9333EA', bandColor: '#FDE047', earStyle: 'dodo', tailStyle: 'fluffy', desc: 'เล็บยาวเฟื้อยใช้แทนตะเกียบคีบผักสลัดได้สบาย' },
  { id: 'iguanodon', category: 'extinct', name: 'อิกัวโนดอน', nickname: 'ไดโนเสาร์ชูนิ้วโป้งเยี่ยม', emoji: '🦕', colorHex: '#10B981', bandColor: '#FBBF24', earStyle: 'trex', tailStyle: 'dino_spikes', desc: 'มีหนามที่นิ้วโป้ง เหมือนยกนิ้วกดไลก์ให้เพื่อนตลอดเวลา!' },
  { id: 'pterodactyl', category: 'extinct', name: 'เทอโรแดคทิล', nickname: 'จ้าวเวหาหงอนแหลม', emoji: '🦅', colorHex: '#E11D48', bandColor: '#FDE047', earStyle: 'pterodactyl', tailStyle: 'long', desc: 'หงอนแหลมยาวเท่โฉบเฉี่ยว พุ่งตัวไวดั่งติดปีก' },
  { id: 'quetzalcoatlus', category: 'extinct', name: 'เควทซัลโคแอทลัส', nickname: 'พญาเวหายักษ์เท่าเครื่องบิน', emoji: '🦅', colorHex: '#F97316', bandColor: '#38BDF8', earStyle: 'pterodactyl', tailStyle: 'long', desc: 'สัตว์บินได้ใหญ่ที่สุดในประวัติศาสตร์โลก!' },
  { id: 'archaeopteryx', category: 'extinct', name: 'อาร์คีออปเทอริกซ์', nickname: 'นกดึกดำบรรพ์ขนสีรุ้ง', emoji: '🐦', colorHex: '#3B82F6', bandColor: '#F43F5E', earStyle: 'phoenix', tailStyle: 'rainbow', desc: 'ครึ่งไดโนเสาร์ครึ่งนก สีสันจัดจ้านสะดุดตา' },
  { id: 'mosasaurus', category: 'extinct', name: 'โมซาซอรัส', nickname: 'ราชันย์ทะเลดึกดำบรรพ์', emoji: '🐊', colorHex: '#0369A1', bandColor: '#38BDF8', earStyle: 'trex', tailStyle: 'dragon_spade', desc: 'กระโจนขึ้นจากน้ำทะเลข้างสนามมาลงแข่ง!' },
  { id: 'plesiosaurus', category: 'extinct', name: 'พลีซิโอซอรัส', nickname: 'เนสซีคอยาวแห่งท้องทะเล', emoji: '🦕', colorHex: '#38BDF8', bandColor: '#BAE6FD', earStyle: 'seal', tailStyle: 'nub', desc: 'ตำนานทะเลสาบล็อกเนส โผล่มาอวดหุ่นเพรียวริมหาด' },
  { id: 'megalodon', category: 'extinct', name: 'เม็กกาโลดอน', nickname: 'โคตรฉลามยักษ์เขี้ยวใบเลื่อย', emoji: '🦈', colorHex: '#475569', bandColor: '#EF4444', earStyle: 'shark', tailStyle: 'dragon_spade', desc: 'ฉลามดึกดำบรรพ์ขนาดมหึมา งับแคลอรี่คำเดียวเกลี้ยง' },
  { id: 'dunkleosteus', category: 'extinct', name: 'ดังเคิลออสเทียส', nickname: 'ปลาเกราะเหล็กขากรรไกรทอง', emoji: '🐟', colorHex: '#334155', bandColor: '#F59E0B', earStyle: 'shark', tailStyle: 'dragon_spade', desc: 'นักล่าหุ้มเกราะยุคโบราณ แรงกัดมหาศาล' },
  { id: 'mammoth', category: 'extinct', name: 'แมมมอธขนฟู', nickname: 'แมมมอธยุคน้ำแข็งไส', emoji: '🦣', colorHex: '#92400E', bandColor: '#38BDF8', earStyle: 'mammoth', tailStyle: 'nub', desc: 'ช้างดึกดำบรรพ์งาโค้งคู่มหึมา จอมพลังยุคน้ำแข็ง' },
  { id: 'mastodon', category: 'extinct', name: 'มาสโตดอน', nickname: 'คชสารโบราณงาตรง', emoji: '🦣', colorHex: '#78350F', bandColor: '#FACC15', earStyle: 'mammoth', tailStyle: 'long', desc: 'ญาติแมมมอธสายถึก ลุยแหลกไม่หวั่นแดดชายหาด' },
  { id: 'sabretooth', category: 'extinct', name: 'เสือเขี้ยวดาบ', nickname: 'สไมโลดอนสวบหมูกระทะ', emoji: '🐯', colorHex: '#D97706', bandColor: '#FEF3C7', earStyle: 'sabretooth', whiskers: true, tailStyle: 'long', desc: 'พยัคฆ์โบราณเขี้ยวยาวโค้งคู่หน้า ดุดันสายเบิร์น' },
  { id: 'dire_wolf', category: 'extinct', name: 'ไดร์วูล์ฟหมาป่ายักษ์', nickname: 'เขี้ยวหิมะแดนเหนือ', emoji: '🐺', colorHex: '#E2E8F0', bandColor: '#0284C7', earStyle: 'fox', facePattern: 'husky_mask', tailStyle: 'fluffy', desc: 'หมาป่ายักษ์ยุคน้ำแข็ง ฝีเท้าจัดจ้านไร้เทียมทาน' },
  { id: 'megatherium', category: 'extinct', name: 'สลอธยักษ์เมกะธีเรียม', nickname: 'สลอธตัวเท่าตึก', emoji: '🦥', colorHex: '#A16207', bandColor: '#84CC16', earStyle: 'bear', facePattern: 'raccoon_mask', tailStyle: 'nub', desc: 'สลอธโบราณขนาดยักษ์ เดินช้าแต่แผ่นดินสะเทือน!' },
  { id: 'woolly_rhino', category: 'extinct', name: 'แรดขนยาวโบราณ', nickname: 'รถเกราะหิมะสองนอ', emoji: '🦏', colorHex: '#78350F', bandColor: '#BAE6FD', earStyle: 'triceratops', tailStyle: 'nub', desc: 'แรดขนปุยยุคน้ำแข็ง พุ่งชนเป้าหมายแบบไม่มีเบรก' },
  { id: 'dodo', category: 'extinct', name: 'นกโดโด้', nickname: 'โดโด้ตุ้ยนุ้ยวิ่งชิล', emoji: '🦤', colorHex: '#60A5FA', bandColor: '#FBBF24', earStyle: 'dodo', tailStyle: 'fluffy', desc: 'นกโบราณปากงุ้มตัวกลมปุ๊ก บินไม่ได้แต่วิ่งน่ารักสุดๆ' },
  { id: 'terror_bird', category: 'extinct', name: 'นกยักษ์เทอร์เรอร์เบิร์ด', nickname: 'วิหคนักวิ่งปากขวาน', emoji: '🦅', colorHex: '#DC2626', bandColor: '#FACC15', earStyle: 'griffin', tailStyle: 'fluffy', desc: 'นกนักล่ายักษ์วิ่งเร็วปานพายุ เจ้าแห่งลู่วิ่งโบราณ' },
  { id: 'thylacine', category: 'extinct', name: 'เสือแทสเมเนียน', nickname: 'หมาป่าลายเสือในตำนาน', emoji: '🐕', colorHex: '#F59E0B', bandColor: '#451A03', earStyle: 'corgi', facePattern: 'cow_spots', tailStyle: 'long', desc: 'สัตว์ลึกลับในตำนานผู้มีลายพาดกลอนสุดเท่' },

  // ============================================================================
  // 🐉 4. สัตว์ในเทพนิยาย (Mythical Creatures - 30 สายพันธุ์)
  // ============================================================================
  { id: 'dragon', category: 'mythical', name: 'มังกรเพลิงทอง', nickname: 'มังกรพ่นไฟปิ้งย่าง', emoji: '🐉', colorHex: '#DC2626', bandColor: '#FACC15', earStyle: 'dragon', tailStyle: 'dragon_spade', desc: 'เขามังกรทองคำคู่สง่างาม พ่นไฟเผาผลาญไขมันกระจาย' },
  { id: 'ice_dragon', category: 'mythical', name: 'มังกรน้ำแข็งเหมันต์', nickname: 'มังกรเกล็ดคริสตัล', emoji: '🐲', colorHex: '#38BDF8', bandColor: '#E0F2FE', earStyle: 'dragon', tailStyle: 'dragon_spade', desc: 'พ่นไอเย็นแช่แข็งความอยากของหวานได้ชะงัด' },
  { id: 'eastern_dragon', category: 'mythical', name: 'มังกรฟ้าชิงหลง', nickname: 'เทพมังกรเหินเมฆา', emoji: '🐉', colorHex: '#10B981', bandColor: '#FDE047', earStyle: 'dragon', whiskers: true, tailStyle: 'dragon_spade', desc: 'มังกรสวรรค์แห่งทิศบูรพา เหาะทะยานสู่เส้นชัย' },
  { id: 'shadow_dragon', category: 'mythical', name: 'มังกรทมิฬบาฮามุท', nickname: 'ราชามังกรรัตติกาล', emoji: '🐉', colorHex: '#312E81', bandColor: '#C084FC', earStyle: 'dragon', tailStyle: 'dragon_spade', desc: 'เกล็ดสีนิลประกายม่วง ทรงพลังระดับบอสลับ' },
  { id: 'hydra', category: 'mythical', name: 'ไฮดราอสูรหลายหัว', nickname: 'ตัดหนึ่งหัวเพิ่มสองพุง', emoji: '🐍', colorHex: '#15803D', bandColor: '#A855F7', earStyle: 'cerberus', tailStyle: 'dragon_spade', desc: 'อสูรพิษหลายหัว แย่งกันซิทอัพฟิตคูณสาม!' },
  { id: 'unicorn', category: 'mythical', name: 'ยูนิคอร์นสายรุ้ง', nickname: 'ม้าวิเศษพาสเทล', emoji: '🦄', colorHex: '#FFF1F2', bandColor: '#F472B6', earStyle: 'unicorn', tailStyle: 'rainbow', desc: 'เขาเกลียวทองเรืองแสง แผงคอสายรุ้งวิ่งโปรยประกายดาว' },
  { id: 'pegasus', category: 'mythical', name: 'เพกาซัสอาชาสวรรค์', nickname: 'ม้าขาวติดปีกเมฆา', emoji: '🪽', colorHex: '#F8FAFC', bandColor: '#38BDF8', earStyle: 'alpaca', headTopper: 'alpaca_fluff', tailStyle: 'fluffy', desc: 'อาชาเทพสีขาวบริสุทธิ์ วิ่งเบาราวกับลอยเหนือพื้นทราย' },
  { id: 'nightmare_steed', category: 'mythical', name: 'อาชาเพลิงโลกันตร์', nickname: 'ม้าศึกไฟนรกเบิร์นไว', emoji: '🐴', colorHex: '#18181B', bandColor: '#F97316', earStyle: 'unicorn', tailStyle: 'fluffy', desc: 'ทุกฝีก้าวทิ้งรอยเท้าเปลวไฟ เผาแคลอรี่ระดับเอ็กซ์ตรีม' },
  { id: 'phoenix', category: 'mythical', name: 'นกฟีนิกซ์อมตะ', nickname: 'ฟีนิกซ์เบิร์นแคลอรี่', emoji: '🔥', colorHex: '#F97316', bandColor: '#FEF08A', earStyle: 'phoenix', tailStyle: 'fluffy', desc: 'หงอนเปลวเพลิงอมตะ ลุกโชนเผาแคลอรี่ไม่มีวันมอด' },
  { id: 'thunderbird', category: 'mythical', name: 'ธันเดอร์เบิร์ดสายฟ้า', nickname: 'วิหคอัสนีบาตฟาดพุง', emoji: '⚡', colorHex: '#0284C7', bandColor: '#FDE047', earStyle: 'phoenix', tailStyle: 'fluffy', desc: 'กระพือปีกเรียกสายฟ้า เร่งสปีดความเร็วแสง' },
  { id: 'garuda', category: 'mythical', name: 'พญาครุฑสุบรรณ', nickname: 'ครุฑทองเจ้าเวหา', emoji: '🦅', colorHex: '#DC2626', bandColor: '#FACC15', earStyle: 'griffin', tailStyle: 'fluffy', desc: 'พญาครุฑกายสีชาดทรงเครื่องทอง สง่างามทรงอำนาจ' },
  { id: 'griffin', category: 'mythical', name: 'กริฟฟินราชสีห์', nickname: 'กริฟฟินจ้าวเวหา', emoji: '🦅', colorHex: '#FBBF24', bandColor: '#38BDF8', earStyle: 'griffin', tailStyle: 'fluffy', desc: 'ครึ่งอินทรีทองครึ่งราชสีห์ สง่างามดุดันเหนือใคร' },
  { id: 'hippogriff', category: 'mythical', name: 'ฮิปโปกริฟฟ์สีเงิน', nickname: 'อาชาอินทรีผู้หยิ่งทะนง', emoji: '🪶', colorHex: '#CBD5E1', bandColor: '#60A5FA', earStyle: 'griffin', tailStyle: 'rainbow', desc: 'ต้องโค้งคำนับก่อนชั่งน้ำหนัก ไม่งั้นมีงอน!' },
  { id: 'sphinx_myth', category: 'mythical', name: 'สฟิงซ์อียิปต์ทองคำ', nickname: 'ผู้พิทักษ์ปริศนาแคลอรี่', emoji: '🦁', colorHex: '#F59E0B', bandColor: '#2563EB', earStyle: 'lion', tailStyle: 'long', desc: 'ทายปัญหาคนจะเข้าซุ้มอาหาร ตอบผิดห้ามกิน!' },
  { id: 'chimera', category: 'mythical', name: 'ไคเมร่าอสูรสามสาย', nickname: 'ราชสีห์มังกรจอมคลั่ง', emoji: '🦁', colorHex: '#B45309', bandColor: '#EF4444', earStyle: 'lion', tailStyle: 'dragon_spade', desc: 'รวมพลังราชสีห์ แพะภูเขา และหางมังกรไว้ในร่างเดียว' },
  { id: 'manticore', category: 'mythical', name: 'แมนติคอร์สีชาด', nickname: 'พยัคฆ์มีเขาหางแมงป่อง', emoji: '🦂', colorHex: '#991B1B', bandColor: '#FACC15', earStyle: 'bull', tailStyle: 'dragon_spade', desc: 'ดุดันน่าเกรงขาม ไม่มีใครกล้าส่งของกินมาล่อ' },
  { id: 'kitsune', category: 'mythical', name: 'จิ้งจอกเก้าหาง', nickname: 'คิตสึเนะมนตราของหวาน', emoji: '🦊', colorHex: '#FFFBEB', bandColor: '#EF4444', earStyle: 'kitsune', tailStyle: 'kitsune_multi', desc: 'จิ้งจอกเทพสีขาวแต้มชาดแดง พร้อมลูกแก้วเวทและพวงหางเทพ' },
  { id: 'fenrir', category: 'mythical', name: 'หมาป่าเฟนริร์', nickname: 'หมาป่ายักษ์กลืนดวงจันทร์', emoji: '🐺', colorHex: '#1E293B', bandColor: '#38BDF8', earStyle: 'fox', facePattern: 'husky_mask', tailStyle: 'fluffy', desc: 'หมาป่าเทพปกรณัมนอร์ส กระชากโซ่ตรวนพุ่งเข้าเส้นชัย' },
  { id: 'cerberus', category: 'mythical', name: 'เซอร์เบอรัส 3 หัว', nickname: 'ตูบเฝ้านรกแย่งกันกิน', emoji: '🐺', colorHex: '#334155', bandColor: '#EF4444', earStyle: 'cerberus', tailStyle: 'dragon_spade', desc: 'สุนัขอสูร 3 หัวตาแดงเพลิง แย่งกันกินหนึ่งตัวอ้วนคูณสาม!' },
  { id: 'qilin', category: 'mythical', name: 'กิเลนหยกมงคล', nickname: 'กิเลนเขาทองนำโชค', emoji: '🦌', colorHex: '#34D399', bandColor: '#FACC15', earStyle: 'deer', whiskers: true, tailStyle: 'fluffy', desc: 'สัตว์เทพมงคล เหยียบเมฆาไม่ทำให้ยอดหญ้าช้ำ' },
  { id: 'pixiu', category: 'mythical', name: 'ปี่เซียะทองคำ', nickname: 'กินแต้มเก่งไม่มีรูออก!', emoji: '🦁', colorHex: '#FACC15', bandColor: '#EF4444', earStyle: 'dragon', tailStyle: 'curly', desc: 'ดูดทรัพย์ดูดแต้มเข้าตัวรัวๆ สายสะสมไอเทมต้องเลือก!' },
  { id: 'baihu', category: 'mythical', name: 'พยัคฆ์ขาวไป๋หู่', nickname: 'เทพเสือขาวเจ้าความเร็ว', emoji: '🐯', colorHex: '#F8FAFC', bandColor: '#38BDF8', earStyle: 'sabretooth', whiskers: true, facePattern: 'husky_mask', tailStyle: 'long', desc: 'จตุรเทพแห่งทิศตะวันตก เร็วดุจสายลมหนาว' },
  { id: 'genbu', category: 'mythical', name: 'เต่ามังกรเสวียนอู่', nickname: 'ปราการเหล็กทิศอุดร', emoji: '🐢', colorHex: '#0F766E', bandColor: '#A7F3D0', earStyle: 'dragon', tailStyle: 'dragon_spade', desc: 'จตุรเทพแห่งความอึด วินัยเหล็กไม่มีหลุดโปรแกรม' },
  { id: 'naga', category: 'mythical', name: 'พญานาคราชสัตตนาคา', nickname: 'นาคาหงอนทองริมหาด', emoji: '🐍', colorHex: '#059669', bandColor: '#FACC15', earStyle: 'phoenix', tailStyle: 'dragon_spade', desc: 'พญานาคเกล็ดมรกตหงอนทองคำ เลื้อยพริ้วเข้าเส้นชัย' },
  { id: 'kotchasi', category: 'mythical', name: 'คชสีห์หิมพานต์', nickname: 'ราชสีห์งวงช้างเผือก', emoji: '🐘', colorHex: '#F3E8FF', bandColor: '#A855F7', earStyle: 'mammoth', tailStyle: 'fluffy', desc: 'กายเป็นสิงห์มีงวงช้าง พลังกายคูณสองจากป่าหิมพานต์' },
  { id: 'hongsa', category: 'mythical', name: 'พญาหงส์ทองคำ', nickname: 'หงส์สวรรค์ร่อนถลา', emoji: '🦢', colorHex: '#FEF08A', bandColor: '#F59E0B', earStyle: 'phoenix', tailStyle: 'fluffy', desc: 'อ่อนช้อยงดงามดั่งหงส์ทอง เปล่งประกายกลางลู่วิ่ง' },
  { id: 'kraken', category: 'mythical', name: 'คราเคนอสูรสมุทร', nickname: 'หมึกยักษ์แปดหนวดจ้วงชาบู', emoji: '🐙', colorHex: '#E11D48', bandColor: '#FDA4AF', earStyle: 'axolotl', tailStyle: 'kitsune_multi', desc: 'ขึ้นมาจากทะเลข้างสนาม ใช้แปดหนวดยกดัมเบลพร้อมกัน!' },
  { id: 'minotaur', category: 'mythical', name: 'มิโนทอร์ขุนศึกเขาวงกต', nickname: 'กระทิงคลั่งกล้ามล่ำบึ้ก', emoji: '🐂', colorHex: '#7C2D12', bandColor: '#FACC15', earStyle: 'bull', tailStyle: 'long', desc: 'เขากระทิงคู่ใหญ่สวมห่วงจมูกทอง บ้าพลังสายเวทตัวจริง' },
  { id: 'yeti', category: 'mythical', name: 'เยติยักษ์หิมะหิมาลัย', nickname: 'เยติขนปุยเขาน้ำแข็ง', emoji: '❄️', colorHex: '#E0F2FE', bandColor: '#0284C7', earStyle: 'bull', headTopper: 'alpaca_fluff', tailStyle: 'nub', desc: 'ยักษ์หิมะขนขาวฟูหนีหนาวมาตากอากาศชายทะเล' },
  { id: 'jackalope', category: 'mythical', name: 'แจ็กคาโลปกระต่ายติดเขา', nickname: 'กระต่ายป่าเขากวางทอง', emoji: '🐰', colorHex: '#FDE68A', bandColor: '#D97706', earStyle: 'jackalope', tailStyle: 'nub', desc: 'สัตว์ลึกลับสุดคิวท์ หูกระต่ายยาวคู่กับเขากวางแตกกิ่ง!' },
];

const LEGACY_SPECIES_FALLBACK: Record<string, string> = {
  shiba: 'corgi',
  frenchie: 'pug',
  pomeranian: 'chihuahua',
  maine_coon: 'lion',
  british_shorthair: 'scottish_fold',
  black_cat: 'orange_cat',
  bengal: 'tiger',
};

export const HERO_LIST: SpeciesOption[] = [
  // ============================================================================
  // 👑 1. เจ้าหญิงดิสนีย์ & นางฟ้า (Disney Princesses & Queens - 14 ตัวละคร)
  // ============================================================================
  { id: 'disney_snow_white', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'snow_bob_bow', skinHex: '#FFE9DE', colorHex: '#18181B', bandColor: '#EF4444', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#2563EB', defaultPantsHex: '#FACC15', earStyle: 'human', name: 'สโนว์ไวท์', nickname: 'เจ้าหญิงหิมะสายแอปเปิลคลีน', emoji: '🍎', desc: 'ผมบ๊อบดำขลับคาดโบว์แดง เสื้อน้ำเงินกระโปรงเหลืองสดใสในตำนาน' },
  { id: 'disney_elsa', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'elsa_side_braid', skinHex: '#FFF0EA', colorHex: '#F8FAFC', bandColor: '#38BDF8', defaultArmor: 'armor_princess', defaultShirtHex: '#38BDF8', defaultPantsHex: '#BAE6FD', earStyle: 'human', name: 'ราชินีเอลซ่า (Frozen)', nickname: 'Let It Go สลัดไขมันเยือกแข็ง', emoji: '❄️', desc: 'ผมบลอนด์เงินถักเปียปัดข้าง สวมรัดเกล้าคริสตัลน้ำแข็งและชุดฟ้าพาสเทล' },
  { id: 'disney_anna', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'anna_twin_braids', skinHex: '#FFE4D4', colorHex: '#9A3412', bandColor: '#DB2777', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#1E293B', defaultPantsHex: '#1D4ED8', earStyle: 'human', name: 'เจ้าหญิงอันนา (Frozen)', nickname: 'เปียคู่สายลุยหิมะไม่กลัวหนาว', emoji: '🌷', desc: 'ผมสีน้ำตาลแดงถักเปียคู่ผูกริบบิ้นบานเย็น พลังบวกวิ่งสู้ไม่ถอย' },
  { id: 'disney_cinderella', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'cinderella_updo', skinHex: '#FFE6D8', colorHex: '#FDE047', bandColor: '#38BDF8', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#60A5FA', defaultPantsHex: '#BAE6FD', earStyle: 'human', name: 'ซินเดอเรลล่า', nickname: 'วิ่งกลับก่อนเที่ยงคืนรองเท้าแก้วไม่หลุด', emoji: '👠', desc: 'ผมบลอนด์เกล้ามวยสูงคาดที่คาดผมสีฟ้า ชุดราตรีสีฟ้าพาสเทลแสนสง่า' },
  { id: 'disney_ariel', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'ariel_wave_flower', skinHex: '#FFE4D6', colorHex: '#DC2626', bandColor: '#A855F7', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#A855F7', defaultPantsHex: '#10B981', earStyle: 'human', name: 'แอเรียล เงือกน้อย', nickname: 'มีขาสองข้างไว้สปรินต์เข้าเส้นชัย!', emoji: '🐚', desc: 'ผมแดงสดแสกปัดลอนใหญ่ทัดปลาดาว เสื้อม่วงคู่กระโปรงสีเขียวน้ำทะเล' },
  { id: 'disney_belle', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'cinderella_updo', skinHex: '#FFE4D4', colorHex: '#78350F', bandColor: '#FACC15', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#FACC15', defaultPantsHex: '#FDE047', earStyle: 'human', name: 'เบลล์ โฉมงาม', nickname: 'หนอนหนังสือสายเต้นรำเบิร์นแคล', emoji: '🌹', desc: 'ผมสีน้ำตาลเกล้ามวยผูกโบว์ทอง สวมชุดราตรีสีเหลืองทองอร่าม' },
  { id: 'disney_rapunzel', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'rapunzel_floral_long', skinHex: '#FFE6D6', colorHex: '#FACC15', bandColor: '#EC4899', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#A855F7', defaultPantsHex: '#F472B6', earStyle: 'human', name: 'ราพันเซล', nickname: 'ผมยาวเจ็ดสิบฟุตประดับดอกไม้', emoji: '🌸', desc: 'ผมทองเปียยาวสลวยประดับดอกไม้หลากสี กระโดดลงจากหอคอยมาวิ่งแข่ง!' },
  { id: 'disney_jasmine', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'jasmine_ponytail_gem', skinHex: '#D99B6C', colorHex: '#18181B', bandColor: '#22D3EE', defaultArmor: 'armor_princess', defaultShirtHex: '#06B6D4', defaultPantsHex: '#67E8F9', earStyle: 'human', name: 'เจ้าหญิงจัสมิน', nickname: 'โฉมงามแห่งอักราบาห์เอวเอสตัวแม่', emoji: '🪔', desc: 'ผมดำยาวมัดพองคาดรัดเกล้าพลอยสีฟ้าเทอร์ควอยซ์พร้อมต่างหูทอง' },
  { id: 'disney_mulan', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'mulan_jade_bun', skinHex: '#F7D2B4', colorHex: '#18181B', bandColor: '#34D399', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#F472B6', defaultPantsHex: '#1D4ED8', earStyle: 'human', name: 'มู่หลาน', nickname: 'ยอดวีรสตรีฝึกหนักฟิตทะลุกองทัพ', emoji: '🗡️', desc: 'ผมดำเกล้ามวยปักปิ่นหยกและดอกเหมย แข็งแกร่งคล่องแคล่วไม่แพ้ใคร' },
  { id: 'disney_moana', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'ariel_wave_flower', skinHex: '#C6865A', colorHex: '#1C1917', bandColor: '#F43F5E', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#EA580C', defaultPantsHex: '#FEF3C7', earStyle: 'human', name: 'โมอาน่า เจ้าหญิงนักเดินเรือ', nickname: 'เสียงเพรียกจากท้องทะเลชายหาด', emoji: '🌊', desc: 'ผิวสีแทนแดดทะเล ผมดำหยักศกทัดดอกชบาชมพู วิ่งสู้คลื่นลมริมหาด!' },
  { id: 'disney_aurora', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'royal_tiara_curls', skinHex: '#FFE8DC', colorHex: '#FDE047', bandColor: '#FACC15', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#EC4899', defaultPantsHex: '#F472B6', earStyle: 'human', name: 'ออโรร่า เจ้าหญิงนิทรา', nickname: 'นอนครบแปดชั่วโมงระบบเผาผลาญดีเลิศ', emoji: '👑', desc: 'ผมทองดัดลอนสลวยสวมมงกุฎทองทรงสูง ชุดเดรสสีชมพูกุหลาบ' },
  { id: 'disney_tiana', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'cinderella_updo', skinHex: '#8D5524', colorHex: '#18181B', bandColor: '#4ADE80', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#4ADE80', defaultPantsHex: '#BBF7D0', earStyle: 'human', name: 'เทียน่า เจ้าหญิงเชฟมือทอง', nickname: 'เชฟสาวสู้ชีวิตคำนวณโภชนาการเป๊ะ', emoji: '🐸', desc: 'ผมดำเกล้ามวยสูงสวมมงกุฎดอกบัวเขียวมิ้นท์ ชุดราตรีใบบัวสุดหรู' },
  { id: 'disney_merida', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'merida_wild_curls', skinHex: '#FFE8DC', colorHex: '#EA580C', bandColor: '#0F766E', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#0F766E', defaultPantsHex: '#115E59', earStyle: 'human', name: 'เมอริด้า นักธนูสาวหัวส้มฟู', nickname: 'ยิงธนูเข้าเป้าเผาแคลอรี่ทะลุพิกัด', emoji: '🏹', desc: 'ผมสีส้มแดงหยิกฟูฟ่องเต็มศีรษะ สวมชุดเขียวมรกตแห่งแดนสกอตแลนด์' },
  { id: 'disney_tinkerbell', category: 'mythical', isHero: true, heroCategory: 'princess', heroStyle: 'tinker_pom_bun', skinHex: '#FFE6D6', colorHex: '#FDE047', bandColor: '#38BDF8', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#84CC16', defaultPantsHex: '#A3E635', earStyle: 'human', name: 'ทิงเกอร์เบลล์ นางฟ้าตัวจิ๋ว', nickname: 'โปรยผงพิกซี่ดัสต์ตัวเบาหวิวเข้าเส้นชัย', emoji: '✨', desc: 'ผมบลอนด์มัดจุกกลมสูงผูกโบว์ฟ้า ชุดใบไม้สีเขียวสดใสตัวปลิว' },

  // ============================================================================
  // 🏰 2. ดิสนีย์คลาสสิกขวัญใจมหาชน (Classic Disney Icons - 14 ตัวละคร)
  // ============================================================================
  { id: 'disney_mickey_cos', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'mickey_ears', skinHex: '#FFE4D0', colorHex: '#18181B', bandColor: '#EF4444', defaultArmor: 'armor_none', defaultShirtHex: '#18181B', defaultPantsHex: '#EF4444', earStyle: 'human', name: 'มิกกี้ ซุปตาร์หูกลม', nickname: 'มาสคอตเบอร์หนึ่งกางเกงแดงในตำนาน', emoji: '🐭', desc: 'หูกลมสีดำคู่เอกลักษณ์ระดับโลก เสื้อดำกางเกงแดงสดใสขวัญใจทุกวัย!' },
  { id: 'disney_minnie_cos', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'minnie_bow_ears', skinHex: '#FFE4D0', colorHex: '#18181B', bandColor: '#EF4444', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#EF4444', defaultPantsHex: '#EF4444', earStyle: 'human', name: 'มินนี่ โบว์แดงลายจุด', nickname: 'หวานใจหูกลมกระโปรงแดงจุดขาว', emoji: '🎀', desc: 'หูกลมสีดำประดับโบว์แดงลายจุดขาวใหญ่กลางหัว น่ารักสดใสสุดๆ' },
  { id: 'disney_donald_cos', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'donald_sailor_beak', skinHex: '#FFFFFF', colorHex: '#2563EB', bandColor: '#F97316', defaultArmor: 'armor_ms_sailor_uniform', defaultShirtHex: '#2563EB', defaultPantsHex: '#FFFFFF', earStyle: 'human', name: 'โดนัลด์ กะลาสีจอมโวยวาย', nickname: 'ก๊าบๆ หัวร้อนวิ่งแซงทุกคน!', emoji: '⚓', desc: 'ตัวขาวปากเป็ดสีส้ม สวมหมวกและเสื้อกะลาสีเรือสีน้ำเงินสุดคลาสสิก' },
  { id: 'disney_stitch_cos', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'stitch_alien_ears', skinHex: '#3B82F6', colorHex: '#1D4ED8', bandColor: '#F472B6', defaultArmor: 'armor_none', defaultShirtHex: '#2563EB', defaultPantsHex: '#1E40AF', earStyle: 'human', name: 'สติทช์ จอมป่วนต่างดาว (626)', nickname: 'โอฮาน่าแปลว่าวิ่งลดพุงด้วยกัน!', emoji: '🛸', desc: 'ตัวสีฟ้าน้ำเงิน หูยาวใหญ่กางสองข้างด้านในสีชมพู จมูกกลมโตสุดแสบซน' },
  { id: 'disney_lilo', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'ariel_wave_flower', skinHex: '#D99B6C', colorHex: '#18181B', bandColor: '#FFFFFF', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#EF4444', defaultPantsHex: '#DC2626', earStyle: 'human', name: 'ลีโล่ สาวน้อยฮาวาย', nickname: 'เต้นฮูล่าริมหาดเบิร์นไขมันกระจาย', emoji: '🌺', desc: 'สาวน้อยชาวเกาะผมดำทัดดอกไม้ขาว สวมชุดเดรสสีแดงสดใสคู่หูสติทช์' },
  { id: 'disney_aladdin', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'aladdin_fez', skinHex: '#D99B6C', colorHex: '#18181B', bandColor: '#DC2626', defaultArmor: 'armor_vest', defaultShirtHex: '#7C3AED', defaultPantsHex: '#F8FAFC', earStyle: 'human', name: 'อะลาดิน จอมโจรพรมวิเศษ', nickname: 'วิ่งไวหลบทหารวังทั้งอักราบาห์', emoji: '🧞‍♂️', desc: 'ผมดำยุ่งเท่สวมหมวกเฟซสีแดงจิ๋ว เสื้อกั๊กม่วงกางเกงขาวพองคล่องตัว' },
  { id: 'disney_genie', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'genie_topknot_beard', skinHex: '#38BDF8', colorHex: '#18181B', bandColor: '#FACC15', defaultArmor: 'armor_none', defaultShirtHex: '#0284C7', defaultPantsHex: '#1D4ED8', earStyle: 'human', name: 'ยักษ์จินนี่ ตะเกียงวิเศษ', nickname: 'ขอพรสามข้อให้ผอมเพรียวเดี๋ยวนี้!', emoji: '💨', desc: 'ผิวกายสีฟ้าสดใส มัดจุกหางม้าบนหัวพร้อมเคราแพะจิ๋วและกำไลทอง' },
  { id: 'disney_peter_pan', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'peter_robin_cap', skinHex: '#FAD6B8', colorHex: '#16A34A', bandColor: '#EF4444', defaultArmor: 'armor_vest', defaultShirtHex: '#16A34A', defaultPantsHex: '#15803D', earStyle: 'human', name: 'ปีเตอร์แพน เด็กชายบินได้', nickname: 'ไม่ยอมแก่และไม่ยอมอ้วนที่เนเวอร์แลนด์', emoji: '🪶', desc: 'สวมหมวกแหลมสีเขียวปักขนนกแดง ชุดสีเขียวใบไม้ตัวเบาบินฉิว' },
  { id: 'disney_alice', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'snow_bob_bow', skinHex: '#FFE8DC', colorHex: '#FDE047', bandColor: '#18181B', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#38BDF8', defaultPantsHex: '#FFFFFF', earStyle: 'human', name: 'อลิซ ในแดนมหัศจรรย์', nickname: 'วิ่งไล่ตามกระต่ายขาวจนผอมเพรียว!', emoji: '🐇', desc: 'ผมทองคาดโบว์ดำ ชุดเดรสสีฟ้าสดใสคู่กระโปรงผ้ากันเปื้อนขาว' },
  { id: 'disney_pinocchio', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'pinocchio_hat_nose', skinHex: '#F5CBA7', colorHex: '#FACC15', bandColor: '#EF4444', defaultArmor: 'armor_ms_denim_overall', defaultShirtHex: '#FDE047', defaultPantsHex: '#EF4444', earStyle: 'human', name: 'พินอคคิโอ หุ่นไม้จมูกยาว', nickname: 'ถ้าโกหกว่ากินคลีนจมูกจะยาวทันที!', emoji: '🤥', desc: 'หมวกเหลืองติดขนนกแดง จมูกไม้ยื่นยาวสุดฮา สวมเสื้อเหลืองเอี๊ยมแดง!' },
  { id: 'disney_hercules', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'incredible_mask', skinHex: '#E5AE86', colorHex: '#EA580C', bandColor: '#38BDF8', defaultArmor: 'armor_gold_paladin', defaultShirtHex: '#D97706', defaultPantsHex: '#2563EB', earStyle: 'human', name: 'เฮอร์คิวลิส บุตรเทพจอมพลัง', nickname: 'จากศูนย์สู่ฮีโร่กล้ามทองแห่งโอลิมปัส', emoji: '⚡', desc: 'ผมส้มทองคาดผ้าคาดหัวสีฟ้า นักรบกรีกจอมพลังยกเวทหนักแค่ไหนก็ไหว' },
  { id: 'disney_tarzan', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'merida_wild_curls', skinHex: '#C6865A', colorHex: '#78350F', bandColor: '#A16207', defaultArmor: 'armor_none', defaultShirtHex: '#C6865A', defaultPantsHex: '#92400E', earStyle: 'human', name: 'ทาร์ซาน เจ้าป่าโหนเถาวัลย์', nickname: 'ซิกแพคธรรมชาติคาร์ดิโอทั่วพงไพร', emoji: '🌿', desc: 'ผิวแทนเข้มผมน้ำตาลเดรดล็อกยาวโหนเถาวัลย์ไวปานพายุ' },
  { id: 'disney_maui', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'merida_wild_curls', skinHex: '#B4764E', colorHex: '#18181B', bandColor: '#22C55E', defaultArmor: 'armor_vest', defaultShirtHex: '#B4764E', defaultPantsHex: '#16A34A', earStyle: 'human', name: 'มาวอิ ครึ่งเทพจอมพลัง (Moana)', nickname: 'ด้วยความยินดี! กล้ามแน่นลากเกาะทั้งใบ', emoji: '🪝', desc: 'ผมดำหยักศกฟูใหญ่เต็มหัว ผิวแทนเข้มร่างบึ้กสายพลังแห่งมหาสมุทร' },
  { id: 'disney_jack_sparrow', category: 'mythical', isHero: true, heroCategory: 'classic', heroStyle: 'pirate_dreads_tricorne', skinHex: '#D99B6C', colorHex: '#292524', bandColor: '#DC2626', defaultArmor: 'armor_vest', defaultShirtHex: '#F8FAFC', defaultPantsHex: '#334155', earStyle: 'human', name: 'กัปตันแจ็ค สแปร์โรว์', nickname: 'ท่าวิ่งเซๆ แต่เข้าเส้นชัยเฉย!', emoji: '🏴‍☠️', desc: 'หมวกโจรสลัดสามมุมโพกผ้าแดงพร้อมผมเดรดล็อกร้อยลูกปัดสุดกวน' },

  // ============================================================================
  // 🚀 3. พิกซาร์ & แอนิเมชันยอดฮิต (Pixar & Modern Hits - 16 ตัวละคร)
  // ============================================================================
  { id: 'disney_woody', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'cowboy_hat', skinHex: '#FAD6B8', colorHex: '#92400E', bandColor: '#EF4444', defaultArmor: 'armor_vest', defaultShirtHex: '#FACC15', defaultPantsHex: '#1D4ED8', earStyle: 'human', name: 'นายอำเภอวู้ดดี้ (Toy Story)', nickname: 'มีงูอยู่ในรองเท้าวิ่งของฉัน!', emoji: '🤠', desc: 'สวมหมวกคาวบอยสีน้ำตาลปีกกว้าง เสื้อเชิ้ตเหลืองกางเกงยีนส์น้ำเงินสุดเท่' },
  { id: 'disney_buzz', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'buzz_space_dome', skinHex: '#FAD6B8', colorHex: '#7C3AED', bandColor: '#84CC16', defaultArmor: 'armor_gold_paladin', defaultShirtHex: '#84CC16', defaultPantsHex: '#F8FAFC', earStyle: 'human', name: 'บัซ ไลท์เยียร์ (Toy Story)', nickname: 'สู่ความเวิ้งว้างอันไกลโพ้นนน!', emoji: '👨‍🚀', desc: 'สวมฮู้ดม่วงครอบโดมแก้วอวกาศใส ชุดสเปซเรนเจอร์สีเขียวมะนาว-ขาวสุดล้ำ' },
  { id: 'disney_jessie', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'cowboy_hat', skinHex: '#FFE4D4', colorHex: '#DC2626', bandColor: '#FFFFFF', defaultArmor: 'armor_vest', defaultShirtHex: '#FFFFFF', defaultPantsHex: '#2563EB', earStyle: 'human', name: 'เจสซี่ คาวเกิร์ลสาวซ่า', nickname: 'ยู้ฮูว์! ควบม้าเข้าเส้นชัยสุดพลัง', emoji: '🐴', desc: 'สวมหมวกคาวบอยสีแดงขอบขาว เสื้อขาวเหลืองคู่กางเกงยีนส์ขาลุย' },
  { id: 'disney_alien_lgm', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'three_eye_alien', skinHex: '#84CC16', colorHex: '#84CC16', bandColor: '#7C3AED', defaultArmor: 'armor_none', defaultShirtHex: '#2563EB', defaultPantsHex: '#1D4ED8', earStyle: 'human', name: 'เอเลี่ยนสามตา (อู๋ววว~)', nickname: 'กงเล็บเลือกให้เราผอมแล้ว~ อู๋ววว!', emoji: '👽', desc: 'ตัวเขียวสามตาเรียงกันพร้อมเสาอากาศบนหัว สวมชุดอวกาศสีน้ำเงินสุดคิวท์!' },
  { id: 'disney_baymax', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'baymax_eyes', skinHex: '#FFFFFF', colorHex: '#FFFFFF', bandColor: '#EF4444', defaultArmor: 'armor_none', defaultShirtHex: '#FFFFFF', defaultPantsHex: '#F8FAFC', earStyle: 'human', name: 'เบย์แมกซ์ หุ่นพยาบาลพุงนุ่ม', nickname: 'สวัสดี ฉันคือเบย์แมกซ์ ผู้ดูแลน้ำหนักของคุณ', emoji: '🤍', desc: 'ตัวกลมสีขาวมาร์ชเมลโลว์ ตาจุดดำคู่ขีดเชื่อมกัน พอง-ยุบพุงได้เหมือนในหนังเป๊ะ!' },
  { id: 'disney_sulley', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'sulley_horns', skinHex: '#38BDF8', colorHex: '#06B6D4', bandColor: '#A855F7', defaultArmor: 'armor_none', defaultShirtHex: '#38BDF8', defaultPantsHex: '#A855F7', earStyle: 'human', name: 'ซัลลี่ มอนสเตอร์ขนฟูฟ้าม่วง', nickname: 'พี่ยักษ์ใจดีตัวฟ้าลายจุดม่วง', emoji: '💙', desc: 'มอนสเตอร์ขนสีฟ้าเทอร์ควอยซ์แต้มม่วง พร้อมเขาคู่โค้งมนบนหัวสุดน่ารัก' },
  { id: 'disney_mike', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'mike_cyclops', skinHex: '#84CC16', colorHex: '#84CC16', bandColor: '#10B981', defaultArmor: 'armor_none', defaultShirtHex: '#84CC16', defaultPantsHex: '#65A30D', earStyle: 'human', name: 'ไมค์ วาซาวสกี้ ตาเดียวตัวกลม', nickname: 'ตัวกลมสีเขียวมีตาดวงเดียวทั้งตัว!', emoji: '👁️', desc: 'มอนสเตอร์ตัวเขียวทรงกลมปุ๊ก ตากลมโตสีเขียวมรกตดวงเดียวกลางหน้า!' },
  { id: 'disney_boo', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'boo_twintails', skinHex: '#FFE4D6', colorHex: '#292524', bandColor: '#EC4899', defaultArmor: 'armor_ms_strawberry_milk', defaultShirtHex: '#F472B6', defaultPantsHex: '#7C3AED', earStyle: 'human', name: 'น้องบู แกละคู่จอมซน', nickname: 'คิตตี้!! วิ่งดุ๊กดิ๊กไม่รู้จักเหนื่อย', emoji: '👧', desc: 'หนูน้อยมัดผมแกละสองข้างผูกยางชมพู สวมเสื้อยืดชมพูคู่กางเกงม่วง' },
  { id: 'disney_mr_incredible', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'incredible_mask', skinHex: '#FAD6B8', colorHex: '#FACC15', bandColor: '#18181B', defaultArmor: 'armor_gold_paladin', defaultShirtHex: '#EF4444', defaultPantsHex: '#18181B', earStyle: 'human', name: 'มิสเตอร์อินเครดิเบิ้ล', nickname: 'คุณพ่อยอดมนุษย์ฟิตหุ่นใส่ชุดฮีโร่แดง!', emoji: '🦸‍♂️', desc: 'ผมทองปาดเท่สวมหน้ากากดำคาดตา ชุดซูเปอร์ฮีโร่สีแดง-ดำสุดแกร่ง' },
  { id: 'disney_vanellope', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'boo_twintails', skinHex: '#FFE4D4', colorHex: '#18181B', bandColor: '#F43F5E', defaultArmor: 'armor_ms_strawberry_milk', defaultShirtHex: '#2DD4BF', defaultPantsHex: '#78350F', earStyle: 'human', name: 'วาเนลโลปี้ นักซิ่งชูการ์รัช', nickname: 'กลิตช์วาร์ปพุ่งเข้าเส้นชัยสายของหวาน!', emoji: '🍬', desc: 'ผมดำติดกิ๊บลูกกวาดสีสด สวมเสื้อฮู้ดดี้สีมิ้นท์คู่กระโปรงช็อกโกแลต' },
  { id: 'disney_joy', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'tinker_pom_bun', skinHex: '#FEF9C3', colorHex: '#2563EB', bandColor: '#FACC15', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#FDE047', defaultPantsHex: '#BEF264', earStyle: 'human', name: 'ลั้ลลา (Joy - Inside Out)', nickname: 'อารมณ์ดี๊ดีวิ่งยิ้มร่าตลอดเส้นทาง!', emoji: '🌟', desc: 'ผมซอยสั้นสีน้ำเงินสดใส ผิวเรืองประกายอุ่นๆ สวมชุดเดรสสีเหลืองมะนาว' },
  { id: 'disney_anger', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'hades_flame_hair', skinHex: '#EF4444', colorHex: '#F97316', bandColor: '#FACC15', defaultArmor: 'armor_silver_knight', defaultShirtHex: '#FFFFFF', defaultPantsHex: '#78350F', earStyle: 'human', name: 'ฉุนเฉียว (Anger - Inside Out)', nickname: 'โมโหหิวแล้วไฟลุกท่วมหัวเผาแคลกระจาย!!', emoji: '🔥', desc: 'ตัวสีแดงสด มีเปลวไฟส้มเหลืองลุกโชนบนหัว สวมเสื้อเชิ้ตขาวกางเกงน้ำตาล!' },
  { id: 'disney_sadness', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'mirabel_glasses_curls', skinHex: '#93C5FD', colorHex: '#1D4ED8', bandColor: '#1E3A8A', defaultArmor: 'armor_ice_cape', defaultShirtHex: '#DBEAFE', defaultPantsHex: '#1E40AF', earStyle: 'human', name: 'ซึมเศร้า (Sadness - Inside Out)', nickname: 'เดินช้าๆ แต่น้ำตาช่วยลดน้ำหนักนะ...', emoji: '💧', desc: 'ผิวและผมบ๊อบสีฟ้าน่ารัก สวมแว่นตากลมใหญ่และสเวตเตอร์ไหมพรมอุ่นๆ' },
  { id: 'disney_mirabel', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'mirabel_glasses_curls', skinHex: '#D99B6C', colorHex: '#1C1917', bandColor: '#22C55E', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#FFFFFF', defaultPantsHex: '#0D9488', earStyle: 'human', name: 'มิราเบล (Encanto)', nickname: 'เต้นจังหวะละตินบ้านมาดริกัลสุดคึกคัก!', emoji: '🦋', desc: 'ผมดำหยิกสั้นสวมแว่นตากลมสีเขียวมรกต เสื้อขาวคู่กระโปรงสีเทอร์ควอยซ์' },
  { id: 'disney_russell', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'cowboy_hat', skinHex: '#FAD6B8', colorHex: '#FACC15', bandColor: '#F97316', defaultArmor: 'armor_vest', defaultShirtHex: '#FACC15', defaultPantsHex: '#78350F', earStyle: 'human', name: 'รัสเซล ลูกเสือจอมป่วน (Up)', nickname: 'สะสมเข็มกลัดนักวิ่งพิชิตพุงกลม!', emoji: '🎈', desc: 'หนูน้อยแก้มยุ้ยสวมหมวกลูกเสือสีเหลือง เสื้อเหลืองผ้าพันคอส้มสดใส' },
  { id: 'disney_olaf', category: 'mythical', isHero: true, heroCategory: 'pixar', heroStyle: 'olaf_snowman', skinHex: '#FFFFFF', colorHex: '#78350F', bandColor: '#F97316', defaultArmor: 'armor_none', defaultShirtHex: '#FFFFFF', defaultPantsHex: '#F8FAFC', earStyle: 'human', name: 'โอลาฟ ตุ๊กตาหิมะกอดอุ่น', nickname: 'วิ่งตากแดดชายหาดก็ไม่ละลายนะ!', emoji: '⛄', desc: 'ตุ๊กตาหิมะขาวกลม จมูกแครอทสีส้มยื่นน่ารัก มีกิ่งไม้สามแฉกชี้บนหัว!' },

  // ============================================================================
  // 😈 4. วายร้ายดิสนีย์สุดปัง (Iconic Disney Villains - 12 ตัวละคร)
  // ============================================================================
  { id: 'disney_maleficent', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'maleficent_horns', skinHex: '#DCFCE7', colorHex: '#0F172A', bandColor: '#A855F7', defaultArmor: 'armor_ice_cape', defaultShirtHex: '#18181B', defaultPantsHex: '#581C87', earStyle: 'human', name: 'มาเลฟิเซนต์ นางพญาปีศาจ', nickname: 'เขาคู่โค้งสง่าเสกคำสาปเผาผลาญไขมัน!', emoji: '🖤', desc: 'สวมหมวกเขาปีศาจโค้งเกลียวคู่สีดำขลับ ผิวอมเขียวอ่อน ชุดคลุมดำ-ม่วงทรงพลัง' },
  { id: 'disney_evil_queen', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'queen_crown_veil', skinHex: '#F8FAFC', colorHex: '#0F172A', bandColor: '#FACC15', defaultArmor: 'armor_ice_cape', defaultShirtHex: '#6B21A8', defaultPantsHex: '#18181B', earStyle: 'human', name: 'ราชินีใจร้าย กระจกวิเศษ', nickname: 'กระจกวิเศษบอกข้าเถิด ใครเอวเอสสุดในปฐพี!', emoji: '🪞', desc: 'คลุมศีรษะสีดำสวมมงกุฎทองยอดแหลมสูง ชุดคลุมม่วง-ดำสุดสง่างาม' },
  { id: 'disney_ursula', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'queen_crown_veil', skinHex: '#C084FC', colorHex: '#F8FAFC', bandColor: '#FACC15', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#18181B', defaultPantsHex: '#3B0764', earStyle: 'human', name: 'เออร์ซูล่า แม่มดแห่งท้องทะเล', nickname: 'ตัวแม่สายแซ่บแห่งมหาสมุทร!', emoji: '🐙', desc: 'ผิวกายสีม่วงลาเวนเดอร์ ผมขาวเซ็ตตั้งฟูสุดมั่น ชุดราตรีสีดำ-ม่วงเข้ม' },
  { id: 'disney_cruella', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'cruella_half_hair', skinHex: '#FFF1F2', colorHex: '#F8FAFC', bandColor: '#EF4444', defaultArmor: 'armor_silver_knight', defaultShirtHex: '#F8FAFC', defaultPantsHex: '#18181B', earStyle: 'human', name: 'ครูเอลล่า เดอ วิล', nickname: 'แฟชั่นนิสต้าผมสองสีขาว-ดำตัวแม่!', emoji: '🐾', desc: 'ผมบ๊อบฟูแบ่งครึ่งขาว-ดำสุดจี๊ด เสื้อโค้ทขาวตัดดำ-แดงรันเวย์สะเทือน!' },
  { id: 'disney_hades', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'hades_flame_hair', skinHex: '#94A3B8', colorHex: '#38BDF8', bandColor: '#0284C7', defaultArmor: 'armor_ice_cape', defaultShirtHex: '#1E293B', defaultPantsHex: '#0F172A', earStyle: 'human', name: 'ฮาเดส เจ้าแห่งยมโลกหัวไฟฟ้า', nickname: 'หัวไฟสีฟ้านีออนลุกโชนพูดรัวไฟแลบ!', emoji: '🔥', desc: 'ผิวกายสีเทาอมฟ้า ทรงผมเป็นเปลวไฟสีฟ้านีออนลุกโชติช่วงตลอดเวลา!' },
  { id: 'disney_captain_hook', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'villain_tophat_plume', skinHex: '#FAD6B8', colorHex: '#991B1B', bandColor: '#A855F7', defaultArmor: 'armor_gold_paladin', defaultShirtHex: '#DC2626', defaultPantsHex: '#18181B', earStyle: 'human', name: 'กัปตันฮุก โจรสลัดหมวกขนนก', nickname: 'ได้ยินเสียงนาฬิกาจระเข้ทีไรวิ่งสับตีนแตก!', emoji: '🪝', desc: 'หมวกกัปตันสีแดงบานใหญ่ปักขนนกม่วงฟูฟ่อง เสื้อโค้ทแดงกัปตันสุดหรู' },
  { id: 'disney_jafar', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'villain_tophat_plume', skinHex: '#C6865A', colorHex: '#18181B', bandColor: '#EF4444', defaultArmor: 'armor_ice_cape', defaultShirtHex: '#18181B', defaultPantsHex: '#991B1B', earStyle: 'human', name: 'จาฟาร์ พ่อมดราชครู', nickname: 'สะกดจิตตัวเองให้งดของหวานยามดึก!', emoji: '🐍', desc: 'หมวกโพกหัวทรงสูงสีดำแถบแดงปักขนนก ชุดคลุมดำ-แดงทรงอำนาจ' },
  { id: 'disney_queen_hearts', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'queen_crown_veil', skinHex: '#FFE4E6', colorHex: '#18181B', bandColor: '#EF4444', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#EF4444', defaultPantsHex: '#18181B', earStyle: 'human', name: 'ราชินีโพแดง', nickname: 'ใครแอบกินชาบูตอนดึก... ตัดพุงมันซะ!!', emoji: '♥️', desc: 'ทรงผมดำพองสวมมงกุฎทองจิ๋ว ชุดกระโปรงแดง-ดำลายหัวใจสุดอลังการ' },
  { id: 'disney_gaston', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'incredible_mask', skinHex: '#F5CBA7', colorHex: '#18181B', bandColor: '#FACC15', defaultArmor: 'armor_vest', defaultShirtHex: '#DC2626', defaultPantsHex: '#18181B', earStyle: 'human', name: 'แกสตัน นักล่ากล้ามโตกินไข่ห้าโหล', nickname: 'กินไข่ไก่วันละห้าโหลโปรตีนล้นกล้าม!', emoji: '💪', desc: 'หนุ่มล่ำผมดำมัดรวบ เสื้อแดงปกทองกางเกงดำ เบ่งกล้ามโชว์ตลอดทาง' },
  { id: 'disney_yzma', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'villain_tophat_plume', skinHex: '#D8B4FE', colorHex: '#7E22CE', bandColor: '#EC4899', defaultArmor: 'armor_snow_dress', defaultShirtHex: '#581C87', defaultPantsHex: '#18181B', earStyle: 'human', name: 'อิซม่า แม่มดปรุงยาเปลี่ยนร่าง', nickname: 'สับคันโยกผิดชีวิตเปลี่ยนผอมเฉียบพลัน!', emoji: '🧪', desc: 'สวมหมวกขนนกสีม่วงบานเย็นทรงสูงอลังการ ผอมเพรียวเปรี้ยวจี๊ด' },
  { id: 'disney_lotso', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'mickey_ears', skinHex: '#F472B6', colorHex: '#DB2777', bandColor: '#9D174D', defaultArmor: 'armor_none', defaultShirtHex: '#EC4899', defaultPantsHex: '#FFFBEB', earStyle: 'human', name: 'หมีล็อตโซ่ กลิ่นสตรอว์เบอร์รี', nickname: 'หน้าตาจิ้มลิ้มตัวหอมหวานแต่บอสใหญ่ตัวจริง!', emoji: '🍓', desc: 'พี่หมีสีชมพูบานเย็นหูกลมคู่ พุงกลมขาวนุ่มหอมกลิ่นสตรอว์เบอร์รี' },
  { id: 'disney_dr_facilier', category: 'mythical', isHero: true, heroCategory: 'villain', heroStyle: 'villain_tophat_plume', skinHex: '#8D5524', colorHex: '#18181B', bandColor: '#EF4444', defaultArmor: 'armor_silver_knight', defaultShirtHex: '#581C87', defaultPantsHex: '#18181B', earStyle: 'human', name: 'ดร.ฟาซิเลียร์ หมอผีเงามืด', nickname: 'มีเพื่อนจากโลกมืดคอยช่วยเบิร์นแคล!', emoji: '🎩', desc: 'สวมหมวกทรงสูง Top Hat สีดำคาดแถบแดงสุดเท่ ชุดสูทม่วงดำมีสไตล์' },
];

export function isAnimeSpecies(breedOrSpecies?: string): boolean {
  if (!breedOrSpecies) return false;
  if (breedOrSpecies.startsWith('anime_')) return true;
  return ANIME_LIST.some((a) => a.id === breedOrSpecies);
}

export function isMonsterSpecies(breedOrSpecies?: string): boolean {
  if (!breedOrSpecies) return false;
  if (breedOrSpecies.startsWith('monster_')) return true;
  return MONSTER_LIST.some((m) => m.id === breedOrSpecies);
}

export function isJobSpecies(breedOrSpecies?: string): boolean {
  if (!breedOrSpecies) return false;
  if (breedOrSpecies.startsWith('job_')) return true;
  return JOB_LIST.some((j) => j.id === breedOrSpecies);
}

export function isHeroSpecies(breedOrSpecies?: string): boolean {
  if (!breedOrSpecies) return false;
  if (
    breedOrSpecies.startsWith('hero_') ||
    breedOrSpecies.startsWith('disney_') ||
    breedOrSpecies.startsWith('anime_') ||
    breedOrSpecies.startsWith('monster_') ||
    breedOrSpecies.startsWith('job_')
  ) {
    return true;
  }
  return (
    HERO_LIST.some((h) => h.id === breedOrSpecies) ||
    ANIME_LIST.some((a) => a.id === breedOrSpecies) ||
    MONSTER_LIST.some((m) => m.id === breedOrSpecies) ||
    JOB_LIST.some((j) => j.id === breedOrSpecies)
  );
}

export function resolveBreedOption(breedOrSpecies?: string): SpeciesOption {
  const mappedId = breedOrSpecies ? LEGACY_SPECIES_FALLBACK[breedOrSpecies] || breedOrSpecies : 'bunny';
  const foundHero = HERO_LIST.find((h) => h.id === mappedId);
  if (foundHero) return foundHero;
  const foundAnime = ANIME_LIST.find((a) => a.id === mappedId);
  if (foundAnime) return foundAnime;
  const foundMonster = MONSTER_LIST.find((m) => m.id === mappedId);
  if (foundMonster) return foundMonster;
  const foundJob = JOB_LIST.find((j) => j.id === mappedId);
  if (foundJob) return foundJob;
  if (mappedId.startsWith('job_')) {
    return JOB_LIST[0];
  }
  if (mappedId.startsWith('monster_')) {
    return MONSTER_LIST[0];
  }
  if (mappedId.startsWith('anime_')) {
    return ANIME_LIST[0];
  }
  if (mappedId.startsWith('hero_') || mappedId.startsWith('disney_')) {
    return HERO_LIST[0];
  }
  const found = SPECIES_LIST.find((b) => b.id === mappedId);
  return found ?? SPECIES_LIST.find((b) => b.id === 'bunny') ?? SPECIES_LIST[0];
}

export type ShopCategory = 'hat' | 'face' | 'armor' | 'weapon' | 'wings' | 'aura' | 'pet' | 'mount' | 'marker';
export type GachaRarity = 'rare' | 'epic' | 'legendary';
export type PropColorKey = 'hat' | 'face' | 'shirt' | 'pants' | 'weapon' | 'wings' | 'aura' | 'pet' | 'mount';
export type PropColorMap = Partial<Record<PropColorKey, string>>;

export function parsePropColors(raw: unknown): PropColorMap {
  if (!raw) return {};
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || typeof obj !== 'object') return {};
    const out: PropColorMap = {};
    const validKeys: PropColorKey[] = ['hat', 'face', 'shirt', 'pants', 'weapon', 'wings', 'aura', 'pet', 'mount'];
    for (const k of validKeys) {
      const val = (obj as Record<string, unknown>)[k];
      if (typeof val === 'string' && /^#[0-9A-Fa-f]{6}$/.test(val)) {
        out[k] = val.toUpperCase();
      }
    }
    return out;
  } catch {
    return {};
  }
}

export const GACHA_SPIN_COST = 180;
export const GACHA_MULTI_COUNT = 8;
export const GACHA_MULTI_COST = 1280;
export const GACHA_DUPLICATE_REFUND: Record<GachaRarity, number> = {
  rare: 50,
  epic: 90,
  legendary: 150,
};

export interface GachaRollResult {
  item: ShopItem;
  isDuplicate: boolean;
  refundPoints: number;
}

export interface ShopItem {
  id: string;
  category: ShopCategory;
  name: string;
  icon: string;
  cost: number;
  desc: string;
  colorHex: number;
  accentHex: number;
  isGachaOnly?: boolean;
  rarity?: GachaRarity;
}

export const SHOP_ITEMS: ShopItem[] = [
  // Category 1: Hat (หมวก / เครื่องหัวแฟชั่น & สปอร์ต — ไล่ระดับ 60..380 🪙)
  { id: 'none', category: 'hat', name: 'ไม่สวมหมวก', icon: '➖', cost: 0, desc: 'โชว์หูน่ารักตามสายพันธุ์', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'hat_red_bow', category: 'hat', name: 'โบว์แดงสดใส', icon: '🎀', cost: 0, desc: 'โบว์แดงผูกผมสุดน่ารัก (ฟรี)', colorHex: 0xEF4444, accentHex: 0xFCA5A5 },
  { id: 'hat_knight_helm', category: 'hat', name: 'หมวกแก๊ปสปอร์ตนักวิ่ง', icon: '🧢', cost: 60, desc: 'หมวกแก๊ปผ้าใบสายสตรีท & วิ่งมาราธอน', colorHex: 0x2563EB, accentHex: 0xF472B6 },
  { id: 'hat_fez', category: 'hat', name: 'หมวกไหมพรมบีนนี่', icon: '🧶', cost: 75, desc: 'หมวกไหมพรมสีแดงอุ่นๆ สไตล์สตรีท', colorHex: 0xDC2626, accentHex: 0xFACC15 },
  { id: 'hat_ms_pink_beret', category: 'hat', name: 'หมวกเบเร่ต์ศิลปินชมพู', icon: '🎨', cost: 80, desc: 'หมวกเบเร่ต์ผ้าสักหลาดสีชมพูซากุระเอียงข้าง (สไตล์ MapleSim)', colorHex: 0xF472B6, accentHex: 0xFFFFFF },
  { id: 'hat_robin', category: 'hat', name: 'หมวกบักเก็ตแคมป์ปิ้ง', icon: '👒', cost: 120, desc: 'หมวกผ้าเดินป่าสไตล์เอาท์ดอร์', colorHex: 0x16A34A, accentHex: 0xEF4444 },
  { id: 'hat_ms_orange_shroom', category: 'hat', name: 'หมวกเห็ดส้มเมเปิ้ล', icon: '🍄', cost: 320, desc: 'หมวกทรงเห็ดสีส้มจุดครีมนุ่มฟูสุดฮิต (สไตล์ MapleSim)', colorHex: 0xF97316, accentHex: 0xFEF3C7 },
  { id: 'hat_ms_floral_wreath', category: 'hat', name: 'มงกุฎดอกไม้ป่าเอลิน่า', icon: '🌼', cost: 320, desc: 'เถาวัลย์ดอกไม้หลากสีสวมรอบหัว (สไตล์ MapleSim)', colorHex: 0x4ADE80, accentHex: 0xFDE047 },
  { id: 'hat_tiara', category: 'hat', name: 'มงกุฎปาร์ตี้มินิ', icon: '👑', cost: 350, desc: 'มงกุฎจิ๋วสีทองสายแฟชั่นระดับพรีเมียม', colorHex: 0xFACC15, accentHex: 0x38BDF8 },
  { id: 'hat_ice_crown', category: 'hat', name: 'ที่คาดผมเกล็ดหิมะ', icon: '❄️', cost: 380, desc: 'ที่คาดผมคริสตัลสีฟ้าสดใสสุดหรู', colorHex: 0x38BDF8, accentHex: 0xE0F2FE },

  // Category 2: Face / Glasses (แว่นตา & แอคเซสเซอรี่หน้า — ของง่ายๆ ซื้อไว 35..130 🪙)
  { id: 'face_none', category: 'face', name: 'หน้าใสธรรมชาติ', icon: '➖', cost: 0, desc: 'โชว์โครงหน้าสัตว์แต่ละสายพันธุ์ชัดๆ', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'face_ms_bandaid', category: 'face', name: 'พลาสเตอร์แปะจมูกจอมซน', icon: '🩹', cost: 35, desc: 'พลาสเตอร์แปะสันจมูกสุดคลาสสิกสายแฟชั่น (สไตล์ MapleSim)', colorHex: 0xFDBA74, accentHex: 0xFFFFFF },
  { id: 'face_sunglasses', category: 'face', name: 'แว่นกันแดดแฟชั่น', icon: '🕶️', cost: 45, desc: 'แว่นดำสุดคูลเดินชิลล์กลางแดด', colorHex: 0x18181B, accentHex: 0xFACC15 },
  { id: 'face_nerd_glasses', category: 'face', name: 'แว่นกลมกรอบทอง', icon: '👓', cost: 45, desc: 'แว่นสายตาแฟชั่นสายคำนวณแคลอรี่', colorHex: 0xFACC15, accentHex: 0xE0F2FE },
  { id: 'face_ms_blush_hearts', category: 'face', name: 'สติกเกอร์แก้มหัวใจชมพู', icon: '💕', cost: 50, desc: 'แก้มชมพูระเรื่อพร้อมหัวใจคู่สองข้างแก้ม (สไตล์ MapleSim)', colorHex: 0xFB7185, accentHex: 0xF43F5E },
  { id: 'face_toast', category: 'face', name: 'คาบขนมปังปิ้งมื้อเช้า', icon: '🍞', cost: 55, desc: 'ตื่นสายรีบวิ่งมาเข้าลู่!', colorHex: 0xD97706, accentHex: 0xFEF3C7 },
  { id: 'face_fox_mask', category: 'face', name: 'หน้ากากงานวัดญี่ปุ่น', icon: '🎭', cost: 130, desc: 'หน้ากากคาดข้างหัวสไตล์เที่ยวงานเทศกาล', colorHex: 0xF8FAFC, accentHex: 0xEF4444 },

  // Category 3: Outfit — เสื้อ & กางเกง (65..750 🪙)
  { id: 'armor_bare', category: 'armor', name: 'ไม่สวมชุด (ตัวกลมขนสัตว์)', icon: '🧸', cost: 0, desc: 'ถอดชุดโชว์พุงกลมขนสัตว์ธรรมชาติ (ฟรี)', colorHex: 0xF8FAFC, accentHex: 0xFFFBEB },
  { id: 'armor_none', category: 'armor', name: 'เสื้อยืดสปอร์ต & กางเกงวอร์ม', icon: '👕', cost: 0, desc: 'ชุดออกกำลังกายเสื้อยืดกางเกงขายาว (ฟรี)', colorHex: 0x3B82F6, accentHex: 0x1E293B },
  { id: 'armor_snow_dress', category: 'armor', name: 'เสื้อครอป & กระโปรงเทนนิส', icon: '👗', cost: 0, desc: 'เสื้อน้ำเงินกระโปรงเหลืองสดใสคล่องตัว (ฟรี)', colorHex: 0x2563EB, accentHex: 0xFACC15 },
  { id: 'armor_vest', category: 'armor', name: 'เสื้อกั๊กยีนส์ & กางเกงคาร์โก้', icon: '🦺', cost: 65, desc: 'ลุคแคมป์ปิ้งเสื้อกั๊กทับเสื้อยืดขาว', colorHex: 0x16A34A, accentHex: 0xD97706 },
  { id: 'armor_ms_denim_overall', category: 'armor', name: 'ชุดเอี๊ยมยีนส์เสื้อเหลือง', icon: '👖', cost: 150, desc: 'เอี๊ยมยีนส์กระดุมทองทับเสื้อเหลืองสดใส (สไตล์ MapleSim)', colorHex: 0xFACC15, accentHex: 0x2563EB },
  { id: 'armor_silver_knight', category: 'armor', name: 'เสื้อฮู้ดดี้ & กางเกงยีนส์', icon: '🧥', cost: 160, desc: 'แจ็คเก็ตฮู้ดสตรีทคู่กับกางเกงยีนส์ขายาว', colorHex: 0x64748B, accentHex: 0x1D4ED8 },
  { id: 'armor_princess', category: 'armor', name: 'เสื้อคาดิแกนฟ้า & กางเกงขาสั้น', icon: '👚', cost: 160, desc: 'ลุคคาเฟ่พาสเทลน่ารักสบายๆ', colorHex: 0x60A5FA, accentHex: 0xF8FAFC },
  { id: 'armor_ms_sailor_uniform', category: 'armor', name: 'ชุดกะลาสีเรือปกน้ำเงินโบว์แดง', icon: '⚓', cost: 340, desc: 'ชุดนักเรียนกะลาสีเรือสุดคิวท์พร้อมกระโปรงกรมท่า (สไตล์ MapleSim)', colorHex: 0xFFFFFF, accentHex: 0x1D4ED8 },
  { id: 'armor_ice_cape', category: 'armor', name: 'สเวตเตอร์ไหมพรม & กางเกงชิโน่', icon: '🧣', cost: 360, desc: 'เสื้อแขนยาวสีฟ้าพาสเทลคู่กางเกงขายาว', colorHex: 0x38BDF8, accentHex: 0xE2E8F0 },
  { id: 'armor_ms_strawberry_milk', category: 'armor', name: 'ฮู้ดดี้โอเวอร์ไซส์นมสตรอว์เบอร์รี', icon: '🍓', cost: 380, desc: 'เสื้อฮู้ดชมพูพาสเทลคู่กางเกงขาสั้นขาว (สไตล์ MapleSim)', colorHex: 0xF472B6, accentHex: 0xFFFBEB },
  { id: 'armor_gold_paladin', category: 'armor', name: 'ชุดแทร็กสูทแชมเปี้ยนสีทอง', icon: '🎽', cost: 750, desc: 'ชุดแชมเปี้ยนแถบทองระดับตำนาน! (ไอเทมหรูสะสม ~2 สัปดาห์)', colorHex: 0xFACC15, accentHex: 0x18181B },
  { id: 'armor_chibi_animal', category: 'armor', name: 'ร่างสัตว์จิบิ 4 ขาธรรมชาติ', icon: '🐾', cost: 0, desc: 'ร่างสัตว์จิบิดุ๊กดิ๊กไม่สวมเสื้อผ้า (ฟรี)', colorHex: 0x10B981, accentHex: 0xFEF08A },

  // Category 4: Handheld Props (70..160 🪙)
  { id: 'weapon_none', category: 'weapon', name: 'มือเปล่าเดินชิลล์', icon: '➖', cost: 0, desc: 'แกว่งแขนวิ่งสบายๆ ตัวปลิว', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'weapon_gold_dumbbell', category: 'weapon', name: 'ดัมเบลฟิตเนสสีทอง', icon: '🏋️', cost: 70, desc: 'ถือวิ่งกระชับต้นแขนคูณสอง', colorHex: 0xFACC15, accentHex: 0x94A3B8 },
  { id: 'weapon_giant_fork', category: 'weapon', name: 'ไอศกรีมซอฟต์เสิร์ฟสตรอว์เบอร์รี', icon: '🍦', cost: 70, desc: 'ของหวานรางวัลวันชีทเดย์', colorHex: 0xF472B6, accentHex: 0xFDE68A },
  { id: 'weapon_light_sword', category: 'weapon', name: 'ขวดเวย์โปรตีนเชค', icon: '🥤', cost: 140, desc: 'เชคเกอร์โปรตีนสีฟ้าสดชื่นหลังเวิร์คเอาท์', colorHex: 0x38BDF8, accentHex: 0xFACC15 },
  { id: 'weapon_broom', category: 'weapon', name: 'ไม้แบดมินตันสปอร์ต', icon: '🏸', cost: 140, desc: 'พร้อมตีแบดเบิร์นแคลอรี่กับเพื่อน', colorHex: 0xEF4444, accentHex: 0xF8FAFC },
  { id: 'weapon_magic_staff', category: 'weapon', name: 'แก้วชานมไข่มุกจัมโบ้', icon: '🥤', cost: 150, desc: 'ชานมไข่มุกแก้วโปรดเพิ่มพลังใจ', colorHex: 0xFDBA74, accentHex: 0x18181B },
  { id: 'weapon_ms_lollipop', category: 'weapon', name: 'อมยิ้มสายรุ้งยักษ์ลูดิเบรียม', icon: '🍭', cost: 160, desc: 'อมยิ้มกลมลายเกลียวหวานแหววอันยักษ์ (สไตล์ MapleSim)', colorHex: 0xF472B6, accentHex: 0x38BDF8 },

  // Category 5: Back / Bag (150..850 🪙)
  { id: 'wings_none', category: 'wings', name: 'ไม่สะพายหลัง', icon: '➖', cost: 0, desc: 'หลังโล่งคล่องตัว', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'wings_magic_carpet', category: 'wings', name: 'เสื่อโยคะม้วนสะพายหลัง', icon: '🧘', cost: 150, desc: 'เสื่อฟิตเนสสีม่วงพกพร้อมออกกำลังกาย', colorHex: 0x7C3AED, accentHex: 0xFACC15 },
  { id: 'wings_apple_sword', category: 'wings', name: 'กระเป๋าเป้แคมป์ปิ้งสุดคิวท์', icon: '🎒', cost: 180, desc: 'เป้สะพายหลังสีแดง-เหลืองพร้อมพวงกุญแจ', colorHex: 0xEF4444, accentHex: 0xFACC15 },
  { id: 'wings_ms_teddy_pack', category: 'wings', name: 'เป้ตุ๊กตาหมีน้อยเกาะหลัง', icon: '🧸', cost: 390, desc: 'ตุ๊กตาหมีสีคาราเมลกอดคอเกาะหลังไปทุกที่ (สไตล์ MapleSim)', colorHex: 0xB45309, accentHex: 0xFEF3C7 },
  { id: 'wings_fairy', category: 'wings', name: 'ปีกผีเสื้อแฟนซีพาสเทล', icon: '🦋', cost: 420, desc: 'พรอพปีกผีเสื้อสีมิ้นท์สดใส', colorHex: 0x6EE7B7, accentHex: 0xFDE68A },
  { id: 'wings_crystal', category: 'wings', name: 'โบว์ริบบิ้นยักษ์ติดหลัง', icon: '🎀', cost: 420, desc: 'โบว์สีฟ้าพาสเทลติดหลังสุดแบ๊ว', colorHex: 0x38BDF8, accentHex: 0xE0F2FE },
  { id: 'wings_gold_archangel', category: 'wings', name: 'ปีกนางฟ้าปาร์ตี้สีทอง', icon: '👼', cost: 850, desc: 'ปีกขนนกสีทองอร่ามระดับมหาเทพ! (ไอเทมหรูสะสม ~2 สัปดาห์)', colorHex: 0xFACC15, accentHex: 0xFEF08A },

  // Category 6: Aura / Effect (450..720 🪙)
  { id: 'aura_none', category: 'aura', name: 'ไม่มีออร่า', icon: '➖', cost: 0, desc: 'โหมดประหยัดพลังงาน', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'aura_magic_circle', category: 'aura', name: 'วงเวทเรืองแสงใต้เท้า', icon: '🔮', cost: 450, desc: 'วงเวทสีฟ้าทองหมุนรอบตัว', colorHex: 0x38BDF8, accentHex: 0xFACC15 },
  { id: 'aura_stars', category: 'aura', name: 'ประกายดาววิบวับ', icon: '✨', cost: 480, desc: 'กลุ่มดาวทองคำลอยวนรอบกาย', colorHex: 0xFDE047, accentHex: 0xFEF9C3 },
  { id: 'aura_sakura', category: 'aura', name: 'กลีบซากุระปลิว', icon: '🌸', cost: 480, desc: 'กลีบดอกไม้ชมพูละมุนรอบตัว', colorHex: 0xF472B6, accentHex: 0xFBCFE8 },
  { id: 'aura_flame', category: 'aura', name: 'ออร่าเปลวไฟนักสู้', icon: '🔥', cost: 720, desc: 'ไฟลุกโชนรอบตัวเผาผลาญแคลอรี่! (ไอเทมหรูสะสม ~2 สัปดาห์)', colorHex: 0xF97316, accentHex: 0xEF4444 },

  // Category 7: Pet + Pet Gear — 20 ชนิด! (ฟรี 2 + ร้านค้า 14 + Gacha 4)
  { id: 'pet_none', category: 'pet', name: 'ไม่มีสัตว์เลี้ยงเดินตาม', icon: '➖', cost: 0, desc: 'ลุยเดี่ยวไม่ง้อใคร', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'pet_fox_scarf', category: 'pet', name: 'จิ้งจอกจิบิอัศวิน', icon: '🦊', cost: 0, desc: 'จิ้งจอกส้มจิบิพันผ้าคลุมวิ่งเคียงข้าง (ฟรี)', colorHex: 0xEA580C, accentHex: 0x2563EB },
  { id: 'pet_bear_shield', category: 'pet', name: 'หมีจิบิผู้พิทักษ์', icon: '🐻‍❄️', cost: 0, desc: 'หมีน้อยจิบิคอยคุ้มกันเข้าเส้นชัย (ฟรี)', colorHex: 0xF1F5F9, accentHex: 0xFACC15 },
  { id: 'pet_corgi_cape', category: 'pet', name: 'คอร์กี้ผ้าคลุมฮีโร่', icon: '🐕', cost: 180, desc: 'น้องหมาคอร์กี้ใส่ผ้าคลุมแดงวิ่งนำ', colorHex: 0xF59E0B, accentHex: 0xEF4444 },
  { id: 'pet_orange_tabby', category: 'pet', name: 'แมวส้มอ้วนกระดิ่งทอง', icon: '🐈', cost: 180, desc: 'น้องแมวส้มลายสลิดพุงกลมผูกกระดิ่งทอง (ย้อมสีได้!)', colorHex: 0xFB923C, accentHex: 0xFACC15 },
  { id: 'pet_hamster', category: 'pet', name: 'แฮมสเตอร์แก้มป่อง', icon: '🐹', cost: 200, desc: 'หนูแฮมสเตอร์ตัวจิ๋วตุนเมล็ดทานตะวันเต็มแก้ม', colorHex: 0xFBBF24, accentHex: 0xFEF3C7 },
  { id: 'pet_shiba', category: 'pet', name: 'ชิบะอินุผ้าพันคอแดง', icon: '🐶', cost: 220, desc: 'น้องชิบะยิ้มหวานพันผ้าพันคอแดงสุดคิวท์', colorHex: 0xD97706, accentHex: 0xEF4444 },
  { id: 'pet_duckling', category: 'pet', name: 'ลูกเป็ดเหลืองจอมซน', icon: '🐥', cost: 240, desc: 'ลูกเป็ดสีเหลืองสดเดินต๊อกแต๊กตามติดไม่ห่าง', colorHex: 0xFACC15, accentHex: 0xF97316 },
  { id: 'pet_panda', category: 'pet', name: 'แพนด้าจิ๋วคาบไผ่', icon: '🐼', cost: 260, desc: 'หมีแพนด้ากลมดุ๊กดิ๊กคาบใบไผ่เขียวสดชื่น', colorHex: 0xF8FAFC, accentHex: 0x18181B },
  { id: 'pet_frog', category: 'pet', name: 'กบเขียวตาโตเด้งดึ๋ง', icon: '🐸', cost: 280, desc: 'กบน้อยสีเขียวมะนาวตาโตกระโดดเชียร์ข้างสนาม', colorHex: 0x22C55E, accentHex: 0xDCFCE7 },
  { id: 'pet_capybara', category: 'pet', name: 'คาปิบาร่าวางส้มบนหัว', icon: '🦫', cost: 300, desc: 'น้องคาปิบาร่าหน้านิ่งวางส้มจี๊ดบนหัวสุดชิล', colorHex: 0xA16207, accentHex: 0xF97316 },
  { id: 'pet_penguin', category: 'pet', name: 'เพนกวินจิ๋วหูกระต่าย', icon: '🐧', cost: 320, desc: 'เพนกวินอ้วนกลมผูกหูกระต่ายแดงเดินเตาะแตะ', colorHex: 0x1E293B, accentHex: 0xEF4444 },
  { id: 'pet_seal', category: 'pet', name: 'แมวน้ำอุ๋งๆ สีขาว', icon: '🦭', cost: 340, desc: 'แมวน้ำหิมะตัวนุ่มนิ่มคลานดุ๊กดิ๊กตามเจ้านาย', colorHex: 0xE2E8F0, accentHex: 0x38BDF8 },
  { id: 'pet_black_cat', category: 'pet', name: 'แมวดำหมวกแม่มด', icon: '🐈‍⬛', cost: 360, desc: 'แมวดำตาสีทองสวมหมวกแม่มดจิ๋วสุดลึกลับ', colorHex: 0x1E293B, accentHex: 0xA855F7 },
  { id: 'pet_cat_crown', category: 'pet', name: 'แมวส้มสวมมงกุฎ', icon: '👑', cost: 380, desc: 'แมวส้มผู้สูงศักดิ์สวมมงกุฎทองคำ', colorHex: 0xFB923C, accentHex: 0xFACC15 },
  { id: 'pet_pig_chef', category: 'pet', name: 'หมูจิ๋วหมวกเชฟทอง', icon: '🐖', cost: 420, desc: 'ลูกหมูสีชมพูใส่หมวกเชฟคอยเชียร์', colorHex: 0xF472B6, accentHex: 0xFACC15 },
  { id: 'pet_bunny_wings', category: 'pet', name: 'กระต่ายน้อยติดปีกนางฟ้า', icon: '🐇', cost: 700, desc: 'กระต่ายขาวติดปีกนางฟ้าบินตามเจ้านาย! (ไอเทมหรูสะสม ~2 สัปดาห์)', colorHex: 0xF8FAFC, accentHex: 0xF472B6 },

  // Category 8: Mounts — 30 ชนิด! (ฟรี 1 + ร้านค้า 20 + Gacha 9)
  { id: 'mount_none', category: 'mount', name: 'เดิน-วิ่งเองฟิตจัด', icon: '➖', cost: 0, desc: 'วิ่งสองขาเบิร์นแคลอรี่ด้วยตัวเอง', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'mount_cloud', category: 'mount', name: 'เมฆวิเศษสีขาวนุ่มฟู', icon: '☁️', cost: 0, desc: 'ก้อนเมฆปุยนุ่นลอยฟ้านุ่มนิ่มสไตล์ MapleSim (ฟรี)', colorHex: 0xFFFFFF, accentHex: 0xBAE6FD },
  // 🟢 Tier 1: สายกิน & ชิลริมหาด (180..280)
  { id: 'mount_skateboard', category: 'mount', name: 'สเก็ตบอร์ดไฟนีออน', icon: '🛹', cost: 180, desc: 'สเก็ตบอร์ดสายสตรีทติดล้อไฟนีออนไถซิ่งเข้าเส้นชัย', colorHex: 0x38BDF8, accentHex: 0xF472B6 },
  { id: 'mount_duck_ring', category: 'mount', name: 'ห่วงยางเป็ดเหลืองยักษ์', icon: '🦆', cost: 200, desc: 'ห่วงยางเป็ดเหลืองริมหาดสุดคิวท์ ลอยเด้งดึ๋งกลางสนาม', colorHex: 0xFACC15, accentHex: 0xF97316 },
  { id: 'mount_sunny_egg', category: 'mount', name: 'พรมไข่ดาวเยิ้มลอยฟ้า', icon: '🍳', cost: 220, desc: 'ไข่ดาวขอบกรอบไข่แดงเด้งดึ๋งขี่ลอยเหนือพื้น (MapleSim)', colorHex: 0xFACC15, accentHex: 0xFFFFFF },
  { id: 'mount_pudding', category: 'mount', name: 'พุดดิ้งคาราเมลจานยักษ์', icon: '🍮', cost: 250, desc: 'พุดดิ้งเด้งดึ๋งราดซอสคาราเมลแต่งคุกกี้โอรีโอ้ (MapleSim)', colorHex: 0xFBBF24, accentHex: 0x78350F },
  { id: 'mount_donut', category: 'mount', name: 'โดนัทสตรอว์เบอร์รีลอยฟ้า', icon: '🍩', cost: 260, desc: 'โดนัทเคลือบชมพูโรยเกล็ดน้ำตาลหลากสีลอยนุ่มนิ่ม', colorHex: 0xF472B6, accentHex: 0xFDE047 },
  { id: 'mount_tricycle', category: 'mount', name: 'จักรยานสามล้อวินเทจ', icon: '🚲', cost: 280, desc: 'จักรยานสามล้อปั่นชิลๆ พร้อมตะกร้าหน้าสุดน่ารัก', colorHex: 0xEF4444, accentHex: 0xFACC15 },
  // 🔵 Tier 2: สัตว์น่ารัก & สายซิ่ง (320..480)
  { id: 'mount_sea_turtle', category: 'mount', name: 'เต่าทะเลจิบิโต้คลื่น', icon: '🐢', cost: 320, desc: 'น้องเต่ากระดองเขียวว่ายโต้คลื่นพาลุยไปข้างหน้า', colorHex: 0x22C55E, accentHex: 0x38BDF8 },
  { id: 'mount_scooter', category: 'mount', name: 'สกู๊ตเตอร์ไฟฟ้าเทอร์โบ', icon: '🛴', cost: 350, desc: 'สกู๊ตเตอร์ไฟฟ้าแถบไฟนีออนสีฟ้า ซิ่งเงียบแต่แรงจัด', colorHex: 0x1E293B, accentHex: 0x38BDF8 },
  { id: 'mount_moodeng', category: 'mount', name: 'หมูเด้งยักษ์พุงกระเพื่อม', icon: '🦛', cost: 380, desc: 'ขี่น้องหมูเด้งฮิปโปแคระแก้มชมพูเด้งดึ๋งขโมยซีนทั้งลู่!', colorHex: 0x94A3B8, accentHex: 0xF472B6 },
  { id: 'mount_green_slime', category: 'mount', name: 'บิ๊กสไลม์เขียวเด้งดึ๋ง', icon: '💧', cost: 420, desc: 'ขี่สไลม์ยักษ์สีเขียวมะนาวกระโดดดึ๋งดั๋งเข้าเส้นชัย (MapleSim)', colorHex: 0x4ADE80, accentHex: 0xDCFCE7 },
  { id: 'mount_corgi', category: 'mount', name: 'น้องหมาคอร์กี้ขาสั้นจัมโบ้', icon: '🐕', cost: 450, desc: 'คอร์กี้ตัวกลมก้นเด้งสับขาสั้นวิ่งรัวๆ น่ารักเกินต้าน!', colorHex: 0xF59E0B, accentHex: 0xFFFFFF },
  { id: 'mount_red_pig', category: 'mount', name: 'หมูแดงผูกโบว์ซิ่งสายฟ้า', icon: '🐷', cost: 480, desc: 'หมูสีแดงผูกริบบิ้นฟ้าในตำนานของนักผจญภัย (MapleSim)', colorHex: 0xEF4444, accentHex: 0x38BDF8 },
  // 🟣 Tier 3: แฟนตาซี & พาหนะสุดเท่ (520..750)
  { id: 'mount_mochi_bunny', category: 'mount', name: 'กระต่ายโมจิซ้อนสองชั้น', icon: '🐰', cost: 520, desc: 'ก้อนโมจิกระต่ายขาวนุ่มนิ่มซ้อนตัวเด้งดึ๋ง (MapleSim)', colorHex: 0xFFFFFF, accentHex: 0x4ADE80 },
  { id: 'mount_witch_broom', category: 'mount', name: 'ไม้กวาดแม่มดเรืองแสง', icon: '🧹', cost: 560, desc: 'ไม้กวาดเวทมนตร์ห้อยโคมดาวม่วงเหาะฉิวเหนือลู่วิ่ง', colorHex: 0x92400E, accentHex: 0xA855F7 },
  { id: 'mount_blue_whale', category: 'mount', name: 'วาฬสีน้ำเงินพ่นน้ำพุ', icon: '🐳', cost: 620, desc: 'น้องวาฬยักษ์สีฟ้าพ่นน้ำพุหมุนติ้วลอยแหวกอากาศสุดอลัง', colorHex: 0x2563EB, accentHex: 0xBAE6FD },
  { id: 'mount_gokart', category: 'mount', name: 'รถโกคาร์ทแชมเปี้ยนสายซิ่ง', icon: '🏎️', cost: 680, desc: 'รถแข่งโกคาร์ทสีแดงติดสปอยเลอร์ซิ่งแซงโค้งทุกคัน!', colorHex: 0xEF4444, accentHex: 0xFACC15 },
  { id: 'mount_trex', category: 'mount', name: 'ทีเร็กซ์จิบิขาสั้นวิ่งดุ๊กดิ๊ก', icon: '🦖', cost: 750, desc: 'ไดโนเสาร์ทีเร็กซ์เขียวมิ้นท์ขาสั้นวิ่งสับตีนแตกเข้าเส้นชัย!', colorHex: 0x10B981, accentHex: 0xF97316 },
  // 🟡 Tier 4: ระดับพรีเมียม (900..1,200)
  { id: 'mount_unicorn', category: 'mount', name: 'ยูนิคอร์นขาวพาสเทล', icon: '🦄', cost: 900, desc: 'ม้ายูนิคอร์นบริสุทธิ์เขาทองระดับแรร์สุดหรู!', colorHex: 0xFFFFFF, accentHex: 0xC084FC },
  { id: 'mount_rocket_shark', category: 'mount', name: 'ฉลามขาวติดไอพ่นจรวด', icon: '🦈', cost: 1000, desc: 'ฉลามเจ้าสมุทรติดท่อไอพ่นคู่พ่นไฟทะยานเข้าเส้นชัย!', colorHex: 0x64748B, accentHex: 0xF97316 },
  { id: 'mount_gold_pegasus', category: 'mount', name: 'เพกาซัสทองคำติดปีกนางฟ้า', icon: '🐎', cost: 1200, desc: 'อาชาสวรรค์สีทองอร่ามสยายปีกขนนกโบยบินเหนือทุกสาย!', colorHex: 0xFACC15, accentHex: 0xFFFFFF },

  // =========================================================================
  // 🎰 GACHAPON EXCLUSIVE ITEMS (หาซื้อไม่ได้! สุ่มได้จากตู้Gachaเท่านั้น!)
  // =========================================================================
  // 🌟 RARE (55%)
  { id: 'hat_gacha_sprout', category: 'hat', name: 'ต้นอ่อนนำโชคงอกบนหัว', icon: '🌱', cost: 0, desc: 'ก้านต้นอ่อนสีเขียวดุ๊กดิ๊กบนหัว (เฉพาะGacha)', colorHex: 0x22C55E, accentHex: 0x86EFAC, isGachaOnly: true, rarity: 'rare' },
  { id: 'hat_gacha_chef', category: 'hat', name: 'หมวกเชฟมิชลินจอมโซ้ย', icon: '👨‍🍳', cost: 0, desc: 'หมวกเชฟทรงสูงสีขาวระดับภัตตาคาร (เฉพาะGacha)', colorHex: 0xFFFFFF, accentHex: 0xE2E8F0, isGachaOnly: true, rarity: 'rare' },
  { id: 'face_gacha_star_shades', category: 'face', name: 'แว่นตาดาวซุปตาร์', icon: '🤩', cost: 0, desc: 'แว่นกันแดดกรอบดาวทองเลนส์ชมพู (เฉพาะGacha)', colorHex: 0xFACC15, accentHex: 0xEC4899, isGachaOnly: true, rarity: 'rare' },
  { id: 'weapon_gacha_jumbo_drumstick', category: 'weapon', name: 'น่องไก่ทอดกรอบจัมโบ้', icon: '🍗', cost: 0, desc: 'น่องไก่ทอดสีทองชิ้นยักษ์ยั่วน้ำลาย (เฉพาะGacha)', colorHex: 0xD97706, accentHex: 0xFEF3C7, isGachaOnly: true, rarity: 'rare' },
  { id: 'hat_gacha_slime_crown', category: 'hat', name: 'สไลม์เขียวนุ่มนิ่มเกาะหัว', icon: '💧', cost: 0, desc: 'น้องสไลม์หยดน้ำสีเขียวมะนาวดุ๊กดิ๊กบนหัว (MapleSim SSB)', colorHex: 0x4ADE80, accentHex: 0xDCFCE7, isGachaOnly: true, rarity: 'rare' },
  { id: 'weapon_gacha_bunny_plush', category: 'weapon', name: 'ตุ๊กตากระต่ายชมพูกอดอุ่น', icon: '🐰', cost: 0, desc: 'ตุ๊กตาผ้ากระต่ายหูยาวถืออุ้มสุดคิวท์ (MapleSim SSB)', colorHex: 0xF9A8D4, accentHex: 0xFFFFFF, isGachaOnly: true, rarity: 'rare' },
  { id: 'mount_gacha_banana_boat', category: 'mount', name: 'เรือกล้วยบานาน่าโบ๊ท', icon: '🍌', cost: 0, desc: 'เรือกล้วยสีเหลืองสดลอยโต้ลมทะเลสุดมันส์! (Rare Gacha)', colorHex: 0xFACC15, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'rare' },
  { id: 'mount_gacha_butter_toast', category: 'mount', name: 'ขนมปังปิ้งทาเนยลอยฟ้า', icon: '🍞', cost: 0, desc: 'ขนมปังปิ้งขอบกรอบโปะเนยสดก้อนโตลอยหอมฉุย! (Rare Gacha)', colorHex: 0xD97706, accentHex: 0xFEF08A, isGachaOnly: true, rarity: 'rare' },
  { id: 'mount_gacha_pepe_frog', category: 'mount', name: 'กบอ้วนเปเป้กระโดดดึ๋ง', icon: '🐸', cost: 0, desc: 'น้องกบอ้วนตาโตบนใบบัวกระโดดเด้งดึ๋งดั๋ง! (Rare Gacha)', colorHex: 0x22C55E, accentHex: 0x86EFAC, isGachaOnly: true, rarity: 'rare' },
  { id: 'pet_gacha_slime', category: 'pet', name: 'สไลม์คริสตัลเด้งดึ๋ง', icon: '🟢', cost: 0, desc: 'น้องสไลม์ใสสีเขียวมะนาวกระโดดดึ๋งตามข้างตัว! (Rare Gacha)', colorHex: 0x4ADE80, accentHex: 0xDCFCE7, isGachaOnly: true, rarity: 'rare' },

  // 💜 EPIC (33%)
  { id: 'pet_gacha_ghost', category: 'pet', name: 'ผีน้อยน่ารักลอยตาม', icon: '👻', cost: 0, desc: 'ผีน้อยผ้าคลุมขาวตาแป๋วลอยปลิวตามเจ้านาย! (Epic Gacha)', colorHex: 0xF8FAFC, accentHex: 0xC084FC, isGachaOnly: true, rarity: 'epic' },
  { id: 'pet_gacha_unicorn', category: 'pet', name: 'ลูกยูนิคอร์นพาสเทล', icon: '🦄', cost: 0, desc: 'ลูกม้ายูนิคอร์นเขาทองแผงคอชมพูวิ่งเคียงข้าง! (Epic Gacha)', colorHex: 0xFDF4FF, accentHex: 0xF472B6, isGachaOnly: true, rarity: 'epic' },
  { id: 'armor_gacha_shiba_pajama', category: 'armor', name: 'ชุดนอนพาสเทลกระดุมดาว', icon: '🔮', cost: 0, desc: 'ชุดนอนลาเวนเดอร์พาสเทลสุดนุ่มนิ่ม (เฉพาะGacha)', colorHex: 0xC084FC, accentHex: 0xFDE047, isGachaOnly: true, rarity: 'epic' },
  { id: 'hat_gacha_angel_halo', category: 'hat', name: 'วงแหวนเทวดาเรืองแสง', icon: '😇', cost: 0, desc: 'วงแหวนทองคำเปล่งแสงลอยเหนือหัว (เฉพาะGacha)', colorHex: 0xFDE047, accentHex: 0xFEF9C3, isGachaOnly: true, rarity: 'epic' },
  { id: 'wings_gacha_ufo_cape', category: 'wings', name: 'พวงลูกโป่งพาสเทลลอยฟ้า', icon: '🎈', cost: 0, desc: 'ลูกโป่ง 3 สีผูกหลังเด้งดึ๋งเวลาวิ่ง (เฉพาะGacha)', colorHex: 0xF472B6, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'epic' },
  { id: 'weapon_gacha_golden_pan', category: 'weapon', name: 'กระทะทองคำทอดไข่ดาว', icon: '🍳', cost: 0, desc: 'กระทะทองคำเงาวับพร้อมไข่ดาวเยิ้มๆ (เฉพาะGacha)', colorHex: 0xFACC15, accentHex: 0xFFFFFF, isGachaOnly: true, rarity: 'epic' },
  { id: 'hat_gacha_pepe_hood', category: 'hat', name: 'หมวกเพนกวินราชาเปเป้', icon: '🐧', cost: 0, desc: 'หมวกหัวเพนกวินอ้วนกลมมีปากส้มและมงกุฎจิ๋ว (MapleSim SSB)', colorHex: 0x1D4ED8, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'epic' },
  { id: 'weapon_gacha_cloud_umbrella', category: 'weapon', name: 'ร่มก้อนเมฆพาสเทลลอยฟ้า', icon: '☂️', cost: 0, desc: 'ร่มโดมสีฟ้าพาสเทลประดับปุยเมฆนุ่มฟู (MapleSim SSB)', colorHex: 0x38BDF8, accentHex: 0xFFFFFF, isGachaOnly: true, rarity: 'epic' },
  { id: 'mount_gacha_pink_bear', category: 'mount', name: 'หมีชมพูคอปเตอร์ไม้ไผ่', icon: '🐻', cost: 0, desc: 'สัตว์ขี่ตุ๊กตาหมีชมพูติดใบพัดไม้ไผ่หมุนติ้วพาบิน! (MapleSim SSB)', colorHex: 0xF472B6, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'epic' },
  { id: 'mount_gacha_cat_bus', category: 'mount', name: 'รถบัสน้องแมวเหมียว', icon: '🐱', cost: 0, desc: 'รถบัสแมวส้มลายเสือตาส่องไฟหน้ารีบวิ่งพาไปเส้นชัย! (Epic Gacha)', colorHex: 0xF97316, accentHex: 0xFEF08A, isGachaOnly: true, rarity: 'epic' },
  { id: 'mount_gacha_magic_carpet', category: 'mount', name: 'พรมวิเศษอะลาดินลอยลม', icon: '🧞', cost: 0, desc: 'พรมวิเศษสีม่วงขลิบทองพู่ 4 มุมลอยพริ้วกลางอากาศ! (Epic Gacha)', colorHex: 0x7C3AED, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'epic' },

  // 🌈 LEGENDARY (12%)
  { id: 'armor_gacha_dino', category: 'armor', name: 'ชุดมาสคอตไดโนเสาร์พุงกลม', icon: '🦖', cost: 0, desc: 'ชุดวันซี่ไดโนเสาร์เขียวมิ้นท์มีหนามหลัง! (Legendary Gacha)', colorHex: 0x10B981, accentHex: 0xF97316, isGachaOnly: true, rarity: 'legendary' },
  { id: 'armor_gacha_pink_bean', category: 'armor', name: 'ชุดวันซี่พิงก์บีนพุงเด้ง', icon: '💖', cost: 0, desc: 'ชุดมอนสเตอร์สีชมพูบับเบิ้ลกัมสุดแรร์ในตำนาน! (MapleSim SSB)', colorHex: 0xF472B6, accentHex: 0xFBCFE8, isGachaOnly: true, rarity: 'legendary' },
  { id: 'wings_gacha_jetpack', category: 'wings', name: 'เจ็ทแพ็คเทอร์โบพ่นไฟ', icon: '🚀', cost: 0, desc: 'กระเป๋าจรวดคู่พ่นไอพ่นสีฟ้า-ส้มสุดล้ำ! (Legendary Gacha)', colorHex: 0xE2E8F0, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'legendary' },
  { id: 'aura_gacha_rainbow', category: 'aura', name: 'ออร่าสายรุ้งปริซึมเจ็ดสี', icon: '🌈', cost: 0, desc: 'วงแหวนสายรุ้ง 5 ชั้นและคริสตัลหลากสีหมุนรอบตัว! (Legendary)', colorHex: 0xEC4899, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'legendary' },
  { id: 'aura_gacha_snack_orbit', category: 'aura', name: 'ออร่าโดนัท & ชานมโคจร', icon: '🍩', cost: 0, desc: 'โดนัทเคลือบชมพูและชานม 3D ลอยโคจรรอบพุง! (Legendary)', colorHex: 0xF472B6, accentHex: 0xFBBF24, isGachaOnly: true, rarity: 'legendary' },
  { id: 'aura_gacha_maple_leaves', category: 'aura', name: 'ออร่าพายุใบเมเปิ้ลสีทอง', icon: '🍁', cost: 0, desc: 'ใบเมเปิ้ลสีส้มทองปลิวหมุนวนรอบตัวสุดคลาสสิก! (MapleSim SSB)', colorHex: 0xF97316, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'legendary' },
  { id: 'mount_gacha_red_dragon', category: 'mount', name: 'มังกรแดงจิบิติดปีกเพลิง', icon: '🐉', cost: 0, desc: 'ขี่มังกรแดงเขาทองกระพือปีกบินโฉบเข้าเส้นชัย! (MapleSim Legendary)', colorHex: 0xEF4444, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'legendary' },
  { id: 'mount_gacha_ufo', category: 'mount', name: 'จานบิน UFO ลำแสงนีออน', icon: '🛸', cost: 0, desc: 'ขี่จานบินอวกาศไฟนีออนหมุนรอบลำพร้อมลำแสงแทรกเตอร์! (MapleSim Legendary)', colorHex: 0x94A3B8, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'legendary' },
  { id: 'mount_gacha_phoenix', category: 'mount', name: 'นกฟีนิกซ์เพลิงอมตะ', icon: '🔥', cost: 0, desc: 'พญาฟีนิกซ์สีเพลิงสยายปีกไฟศักดิ์สิทธิ์ทะยานฟ้า! (Legendary Gacha)', colorHex: 0xF97316, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'legendary' },
  { id: 'pet_gacha_dragon', category: 'pet', name: 'ลูกมังกรทองพ่นไฟ', icon: '🐉', cost: 0, desc: 'ลูกมังกรทองคำติดปีกเพลิงบินวนตามเจ้านาย! (Legendary Gacha)', colorHex: 0xF59E0B, accentHex: 0xEF4444, isGachaOnly: true, rarity: 'legendary' },

  // Category 9: Marker (ป้ายจองลู่ 3D — 10 ชนิด! อัปเกรดได้ตั้งแต่ฟรีถึง 1,200 🪙!)
  { id: 'marker_wood', category: 'marker', name: 'ป้ายไม้ตอกตะปูบ้านๆ', icon: '📍', cost: 0, desc: 'แผ่นไม้ปักดินเอียงนิดๆ จองคิวบนลู่ตอนแวะไปเดินเล่น (ฟรี)', colorHex: 0x92400E, accentHex: 0xFDE68A },
  { id: 'marker_cone', category: 'marker', name: 'กรวยจราจรจองลู่สายฮา', icon: '🚧', cost: 100, desc: 'กรวยส้มคาดแถบขาวสะท้อนแสงตั้งจองลู่แบบชัดเจน!', colorHex: 0xF97316, accentHex: 0xFFFFFF },
  { id: 'marker_flag', category: 'marker', name: 'เสาธงอัศวินโบกสะบัด', icon: '🚩', cost: 150, desc: 'เสาธงประจำตระกูลขลิบทองโบกพริ้วบนลู่วิ่ง', colorHex: 0xEF4444, accentHex: 0xFACC15 },
  { id: 'marker_shrine', category: 'marker', name: 'เสาโทริอิแดงมงคล', icon: '⛩️', cost: 280, desc: 'ซุ้มเสาโทริอิสีแดงสดสไตล์ญี่ปุ่นตั้งตระหง่านกลางลู่', colorHex: 0xDC2626, accentHex: 0x18181B },
  { id: 'marker_scarecrow', category: 'marker', name: 'หุ่นฟางตัวแทนคาดหัว', icon: '🎃', cost: 350, desc: 'ตุ๊กตาหุ่นฟางหน้ายิ้มสวมผ้าคาดหัวยืนเฝ้าลู่แทนเจ้าตัว!', colorHex: 0xF59E0B, accentHex: 0x38BDF8 },
  { id: 'marker_cat_statue', category: 'marker', name: 'แมวกวักทองนำโชค', icon: '🐱', cost: 480, desc: 'น้องแมวกวักสีทองโบกมือกวักแต้มและโชคลาภบนลู่!', colorHex: 0xFACC15, accentHex: 0xEF4444 },
  { id: 'marker_bubble_tea', category: 'marker', name: 'แก้วชานมไข่มุกยักษ์', icon: '🥤', cost: 550, desc: 'แก้วชานมไข่มุกจัมโบ้ปักหลอดยักษ์จองที่แบบสายกิน!', colorHex: 0xD97706, accentHex: 0xFDE68A },
  { id: 'marker_crystal', category: 'marker', name: 'แท่นคริสตัลเวทมนตร์ลอยหมุน', icon: '💎', cost: 650, desc: 'เสาคริสตัลสีฟ้าเรืองแสงหมุนลอยตัวพร้อมวงเวทบนพื้นลู่', colorHex: 0x38BDF8, accentHex: 0xA855F7 },
  { id: 'marker_rocket', category: 'marker', name: 'แท่นปล่อยจรวดอวกาศ', icon: '🚀', cost: 900, desc: 'จรวดสีขาวแดงพร้อมไฟไอพ่นเตรียมทะยานเข้าเส้นชัย!', colorHex: 0xE2E8F0, accentHex: 0xEF4444 },
  { id: 'marker_monument', category: 'marker', name: 'อนุสาวรีย์ถ้วยทองปีกนางฟ้า', icon: '🏆', cost: 1200, desc: 'แท่นหินอ่อนถ้วยทองคำติดปีกนางฟ้าส่องประกายขิงทั้งสนาม!', colorHex: 0xFACC15, accentHex: 0xFFFFFF },

  ...EXTRA_SHOP_ITEMS,
];

export const GACHA_EXCLUSIVE_ITEMS = SHOP_ITEMS.filter((it) => it.isGachaOnly);

export const FREE_DEFAULT_ITEMS = new Set([
  'none',
  'face_none',
  'hat_red_bow',
  'armor_bare',
  'armor_none',
  'armor_chibi_animal',
  'armor_snow_dress',
  'weapon_none',
  'wings_none',
  'aura_none',
  'pet_none',
  'pet_fox_scarf',
  'pet_bear_shield',
  'mount_none',
  'mount_cloud',
  'marker_wood',
  ...EXTRA_FREE_ITEM_IDS,
]);
