export type GoalType =
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
  return GOAL_TYPES.find((g) => g.id === goalType) || GOAL_TYPES[0];
}

export function computeGoalProgress(
  goalType: string,
  startVal: number,
  currentVal: number,
  targetVal: number
): { pct: number; diffLabel: string; isInFoodStall: boolean } {
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

export type HeroCategoryId = 'rpg' | 'super' | 'legend' | 'fitness';

export interface HeroCategoryMeta {
  id: HeroCategoryId;
  name: string;
  emoji: string;
  desc: string;
}

export const HERO_CATEGORIES: HeroCategoryMeta[] = [
  { id: 'rpg', name: 'ผู้กล้า RPG', emoji: '⚔️', desc: 'อัศวิน จอมเวท นินจา ซามูไร แฟนตาซี' },
  { id: 'super', name: 'ซูเปอร์ฮีโร่', emoji: '🦸', desc: 'ฮีโร่หน้ากาก เกราะไซไฟ & นักบินอวกาศ' },
  { id: 'legend', name: 'ตำนาน/อนิเมะ', emoji: '🏮', desc: 'ไซย่า หมวกฟาง เทพปกรณัม & จอมยุทธ์' },
  { id: 'fitness', name: 'สายฟิต/อาชีพ', emoji: '🥊', desc: 'มวยไทย เทรนเนอร์ เชฟ ไรเดอร์ & ขาแดนซ์' },
];

export type HeroHeadStyle =
  | 'knight_crest'
  | 'wizard_hat'
  | 'viking_horns'
  | 'ninja_mask'
  | 'kunoichi_ponytail'
  | 'samurai_kabuto'
  | 'elf_circlet'
  | 'valkyrie_wings'
  | 'demon_lord'
  | 'pirate_captain'
  | 'twintail_princess'
  | 'shaolin_monk'
  | 'bard_feather'
  | 'super_curl'
  | 'wonder_tiara'
  | 'mecha_visor'
  | 'bat_cowl'
  | 'spider_mask'
  | 'flash_wings'
  | 'thor_helm'
  | 'captain_cowl'
  | 'sentai_helmet'
  | 'cyber_mohawk'
  | 'astro_helmet'
  | 'esper_clips'
  | 'jedi_hood'
  | 'secret_agent'
  | 'spiky_saiyan'
  | 'straw_hat'
  | 'slayer_scar'
  | 'blindfold_white'
  | 'spiky_headband'
  | 'bald_hero'
  | 'monkey_king_band'
  | 'pharaoh_nemes'
  | 'spartan_plume'
  | 'laurel_god'
  | 'vampire_slick'
  | 'jiangshi_talisman'
  | 'double_buns'
  | 'muaythai_mongkhon'
  | 'sport_headband'
  | 'top_bun'
  | 'runner_visor'
  | 'sumo_topknot'
  | 'lifeguard_cap'
  | 'chef_toque'
  | 'rider_helmet'
  | 'office_glasses'
  | 'doctor_mirror'
  | 'disco_afro'
  | 'gamer_headset';

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
  heroStyle?: HeroHeadStyle;
  skinHex?: string;
  defaultArmor?: string;
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
  // ⚔️ 1. คลาสผู้กล้า RPG (RPG Heroes - 15 ตัวละครมนุษย์จิบิ)
  // ============================================================================
  { id: 'hero_paladin', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'knight_crest', skinHex: '#FAD6B8', colorHex: '#CBD5E1', bandColor: '#FACC15', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'พาลาดินแสงศักดิ์สิทธิ์', nickname: 'อัศวินเกราะพู่ทอง', emoji: '🛡️', desc: 'สวมหมวกเหล็กอัศวินเปิดหน้าติดพู่ขนม้าทอง สาบานจะปกป้องซิกแพค' },
  { id: 'hero_dark_knight', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'knight_crest', skinHex: '#F3CBB0', colorHex: '#1E293B', bandColor: '#EF4444', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'อัศวินทมิฬผ่าแคลอรี่', nickname: 'ขุนศึกพู่เพลิงแดง', emoji: '⚔️', desc: 'หมวกเกราะเหล็กกล้าสีนิลพู่แดงฉาน ฟันไขมันขาดสะบั้นทุกก้าววิ่ง' },
  { id: 'hero_archmage', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'wizard_hat', skinHex: '#FFE0C8', colorHex: '#2563EB', bandColor: '#FACC15', defaultArmor: 'armor_ice_cape', earStyle: 'human', name: 'จอมเวทดาราพุงยุบ', nickname: 'พ่อมดหมวกดาวทอง', emoji: '🧙‍♂️', desc: 'หมวกพ่อมดปลายงอติดดาวเวทมนตร์ ร่ายคาถาเผาผลาญคูณสอง' },
  { id: 'hero_witch', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'wizard_hat', skinHex: '#FFE4D6', colorHex: '#7C3AED', bandColor: '#F472B6', defaultArmor: 'armor_princess', earStyle: 'human', name: 'แม่มดน้อยปรุงยาคลีน', nickname: 'แม่มดหมวกม่วงสายหวาน', emoji: '🧙‍♀️', desc: 'ต้มสมุนไพรดีท็อกซ์หม้อใหญ่ บินฉิวเข้าเส้นชัยแบบน้ำตาลศูนย์เปอร์เซ็นต์' },
  { id: 'hero_viking', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'viking_horns', skinHex: '#F5C6A5', colorHex: '#64748B', bandColor: '#D97706', defaultArmor: 'armor_vest', earStyle: 'human', name: 'นักรบไวกิ้งจอมพลัง', nickname: 'ไวกิ้งเขาคู่เคราเปีย', emoji: '🪓', desc: 'หมวกเหล็กเขาโค้งคู่พร้อมเคราเปียสุดดุดัน พายเรือข้ามทะเลมาเบิร์น' },
  { id: 'hero_ninja', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'ninja_mask', skinHex: '#F5CBA7', colorHex: '#18181B', bandColor: '#EF4444', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'นินจาเงาวาร์ปหนีตาชั่ง', nickname: 'ชิโนบิผ้าปิดหน้า', emoji: '🥷', desc: 'คลุมหน้ากากนินจามิดชิด คาดแผ่นเหล็กหน้าผาก วิ่งเงียบไวปานสายลม' },
  { id: 'hero_kunoichi', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'kunoichi_ponytail', skinHex: '#FFE2CE', colorHex: '#312E81', bandColor: '#EC4899', defaultArmor: 'armor_snow_dress', earStyle: 'human', name: 'คุโนะอิจิสาวหางม้า', nickname: 'นินจาสาวปิ่นซากุระ', emoji: '🌸', desc: 'มัดผมหางม้าสูงปักปิ่นพิฆาต กระโดดตีลังกาหลบชานมไข่มุกพริ้วไหว' },
  { id: 'hero_samurai', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'samurai_kabuto', skinHex: '#F5CBA7', colorHex: '#991B1B', bandColor: '#FACC15', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'ซามูไรคาบูโตะจันทร์เสี้ยว', nickname: 'ยอดขุนพลอาทิตย์อุทัย', emoji: '⛩️', desc: 'หมวกเกราะซามูไรติดเขาพระจันทร์เสี้ยวทองคำ วิถีแห่งวินัยเหล็ก' },
  { id: 'hero_elf', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'elf_circlet', skinHex: '#FFE7D6', colorHex: '#FDE047', bandColor: '#10B981', defaultArmor: 'armor_vest', earStyle: 'human', name: 'เอลฟ์นักธนูพงไพร', nickname: 'หูยาวรัดเกล้ามรกต', emoji: '🧝', desc: 'เอลฟ์หนุ่มสาวหูแหลมสง่างาม ผมทองสลวยสวมรัดเกล้ามรกต กินแต่สลัดผักสด' },
  { id: 'hero_valkyrie', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'valkyrie_wings', skinHex: '#FFE4D4', colorHex: '#FEF08A', bandColor: '#F8FAFC', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'วาลคีรีนางฟ้าศึกสวรรค์', nickname: 'รัดเกล้าปีกขนนกขาว', emoji: '🪽', desc: 'สวมรัดเกล้าติดปีกนางฟ้าคู่ข้างขมับ นำทัพผู้กล้าบินทะยานสู่เส้นชัย' },
  { id: 'hero_demon_lord', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'demon_lord', skinHex: '#E2E8F0', colorHex: '#18181B', bandColor: '#DC2626', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'จอมมารเขาคู่อสูรฟิตเนส', nickname: 'ราชาปีศาจสายเบิร์น', emoji: '😈', desc: 'ผมตั้งยุ่งเท่พร้อมเขาจอมมารโค้งสีเลือดหมู ยึดครองบัลลังก์เอวเอส' },
  { id: 'hero_pirate', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'pirate_captain', skinHex: '#E5B28A', colorHex: '#292524', bandColor: '#EF4444', defaultArmor: 'armor_vest', earStyle: 'human', name: 'กัปตันโจรสลัดเจ็ดคาบสมุทร', nickname: 'หมวกสามมุมตาเดียว', emoji: '🏴‍☠️', desc: 'สวมหมวกกัปตันโพกผ้าแดง คาดผ้าปิดตาเท่ๆ ออกปล้นเวย์โปรตีนกลางทะเล' },
  { id: 'hero_princess', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'twintail_princess', skinHex: '#FFE6DA', colorHex: '#F472B6', bandColor: '#FACC15', defaultArmor: 'armor_princess', earStyle: 'human', name: 'เจ้าหญิงทวินเทลสายหวาน', nickname: 'แกละคู่มงกุฎเพชร', emoji: '👑', desc: 'มัดผมแกละทวินเทลฟูฟ่องสองข้าง สวมมงกุฎทอง วิ่งสวยไม่หวั่นแดด' },
  { id: 'hero_monk', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'shaolin_monk', skinHex: '#F1C29B', colorHex: '#F97316', bandColor: '#FACC15', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'หลวงจีนเส้าหลินหมัดอรหันต์', nickname: 'ศีรษะแต้มหกจุดทอง', emoji: '📿', desc: 'ฝึกวิชาตัวเบาและคาร์ดิโอขั้นสุดยอด ตบะแข็งแกร่งไม่หวั่นซุ้มหมูกรอบ' },
  { id: 'hero_bard', category: 'mythical', isHero: true, heroCategory: 'rpg', heroStyle: 'bard_feather', skinHex: '#FAD6B8', colorHex: '#059669', bandColor: '#FDE047', defaultArmor: 'armor_vest', earStyle: 'human', name: 'กวีพเนจรหมวกขนนก', nickname: 'นักดนตรีบัฟความเร็ว', emoji: '🪶', desc: 'หมวกเบเร่ต์ปักขนนกยาวพริ้ว ร้องเพลงปลุกใจให้ทุกคนวิ่งเร็วขึ้น' },

  // ============================================================================
  // 🦸 2. ซูเปอร์ฮีโร่ & ไซไฟ (Superheroes & Sci-Fi - 15 ตัวละครมนุษย์จิบิ)
  // ============================================================================
  { id: 'hero_superman', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'super_curl', skinHex: '#FAD4B4', colorHex: '#0F172A', bandColor: '#EF4444', defaultArmor: 'armor_ice_cape', earStyle: 'human', name: 'ยอดมนุษย์ปอยผมตัวเอส', nickname: 'บุรุษเหล็กคาร์ดิโอ', emoji: '🦸‍♂️', desc: 'ผมดำปาดเรียบพร้อมปอยม้วนตัว S กลางหน้าผาก แข็งแกร่งดั่งเหล็กกล้า' },
  { id: 'hero_wonder', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'wonder_tiara', skinHex: '#F3C6A2', colorHex: '#1E1B4B', bandColor: '#FACC15', defaultArmor: 'armor_snow_dress', earStyle: 'human', name: 'เจ้าหญิงนักรบอะเมซอน', nickname: 'รัดเกล้าดาวทองจอมพลัง', emoji: '🌟', desc: 'ผมดำสลวยสวมรัดเกล้าทองติดดาวแดง สะบัดบ่วงบาศก์มัดใจกรรมการ' },
  { id: 'hero_mecha', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'mecha_visor', skinHex: '#F5CBA7', colorHex: '#DC2626', bandColor: '#FACC15', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'ไอรอนไซบอร์กเกราะนาโน', nickname: 'เกราะแดงทองตานีออน', emoji: '🤖', desc: 'สวมหมวกเกราะไฮเทคสองสี ตาเรืองแสงอาร์ครีแอคเตอร์ คำนวณแคลแม่นเป๊ะ' },
  { id: 'hero_bat_vigilante', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'bat_cowl', skinHex: '#F5CBA7', colorHex: '#18181B', bandColor: '#FACC15', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'อัศวินหน้ากากค้างคาว', nickname: 'ฮีโร่รัตติกาลหูแหลม', emoji: '🦇', desc: 'สวมหน้ากากคลุมครึ่งหน้าหูค้างคาวตาขาวคมกริบ ออกวิ่งซ้อมทุกเที่ยงคืน' },
  { id: 'hero_spider', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'spider_mask', skinHex: '#FAD6B8', colorHex: '#EF4444', bandColor: '#2563EB', defaultArmor: 'armor_none', earStyle: 'human', name: 'ฮีโร่หน้ากากแมงมุม', nickname: 'ไอ้แมงมุมเลนส์ตาโต', emoji: '🕸️', desc: 'หน้ากากคลุมเต็มหัวตาขาวขอบดำสุดเท่ โหนใยตีลังกากระโดดข้ามความอ้วน' },
  { id: 'hero_speedster', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'flash_wings', skinHex: '#FAD6B8', colorHex: '#DC2626', bandColor: '#FACC15', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'จ้าวความเร็วสายฟ้าแลบ', nickname: 'หน้ากากสายฟ้าข้างหู', emoji: '⚡', desc: 'วิ่งเร็วทะลุมิติจนไขมันตามไม่ทัน ติดปีกสายฟ้าสีทองคู่ข้างขมับ' },
  { id: 'hero_thunder_god', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'thor_helm', skinHex: '#FAD6B8', colorHex: '#FACC15', bandColor: '#E2E8F0', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'เทพสายฟ้าหมวกปีกเงิน', nickname: 'บุตรแห่งแอสการ์ดกล้ามโต', emoji: '🔨', desc: 'ผมทองประบ่าสวมหมวกเหล็กติดปีกเงินคู่ เรียกสายฟ้าฟาดเบิร์นแคลอรี่' },
  { id: 'hero_captain_shield', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'captain_cowl', skinHex: '#FAD8BC', colorHex: '#2563EB', bandColor: '#F8FAFC', defaultArmor: 'armor_ice_cape', earStyle: 'human', name: 'กัปตันผู้พิทักษ์ติดดาว', nickname: 'ซุปเปอร์โซลเยอร์วิ่งทั้งวัน', emoji: '🛡️', desc: 'สวมหมวกยุทธวิธีติดปีกจิ๋วข้างขมับ วิ่งได้ทั้งวันไม่มีคำว่าหอบ!' },
  { id: 'hero_sentai_red', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'sentai_helmet', skinHex: '#F5CBA7', colorHex: '#EF4444', bandColor: '#FACC15', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'เรนเจอร์เซนไตขบวนการสู้พุง', nickname: 'หมวกชิลด์ดำเขาทอง V-Fin', emoji: '💥', desc: 'แปลงร่างขบวนการห้าสี! เปลี่ยนสีหมวกเรนเจอร์ได้ทุกเฉดตามใจชอบ!' },
  { id: 'hero_cyborg_punk', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'cyber_mohawk', skinHex: '#E5B896', colorHex: '#06B6D4', bandColor: '#EC4899', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'ไซบอร์กพังก์นีออน 2099', nickname: 'โมฮอว์กไฟสแกนเนอร์', emoji: '🦾', desc: 'ทรงผมโมฮอว์กนีออนสุดซ่า พร้อมแว่นสแกนเนอร์วัดระดับไขมันแบบเรียลไทม์' },
  { id: 'hero_astronaut', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'astro_helmet', skinHex: '#FAD6B8', colorHex: '#F8FAFC', bandColor: '#38BDF8', defaultArmor: 'armor_ice_cape', earStyle: 'human', name: 'นักบินอวกาศไร้แรงโน้มถ่วง', nickname: 'หมวกโดมแก้วอวกาศ', emoji: '👨‍🚀', desc: 'ครอบหมวกโดมกระจกอวกาศใสปิ๊ง เพราะอยู่บนดวงจันทร์น้ำหนักเบาลง 6 เท่า!' },
  { id: 'hero_magical_girl', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'twintail_princess', skinHex: '#FFE6DA', colorHex: '#FDE047', bandColor: '#EC4899', defaultArmor: 'armor_snow_dress', earStyle: 'human', name: 'สาวน้อยเวทมนตร์จันทรา', nickname: 'ทวินเทลทองตัวแทนดวงจันทร์', emoji: '🌙', desc: 'ตัวแทนแห่งดวงจันทร์จะลงทัณฑ์ไขมันแกเอง! ผมแกละทองคู่มงกุฎชมพู' },
  { id: 'hero_esper', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'esper_clips', skinHex: '#FFE2CE', colorHex: '#F472B6', bandColor: '#A3E635', defaultArmor: 'armor_princess', earStyle: 'human', name: 'ผู้มีพลังจิตเสาอากาศคู่', nickname: 'หัวชมพูกิ๊บจำกัดพลัง', emoji: '🔮', desc: 'ใช้พลังจิตยกดัมเบลลอยฟ้า! ผมสีชมพูติดกิ๊บเสาอากาศคู่สุดกวน' },
  { id: 'hero_galactic_knight', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'jedi_hood', skinHex: '#F5CBA7', colorHex: '#92400E', bandColor: '#38BDF8', defaultArmor: 'armor_vest', earStyle: 'human', name: 'อัศวินเจไดผู้พิทักษ์จักรวาล', nickname: 'ฮู้ดนักรบแห่งดวงดาว', emoji: '🌌', desc: 'คลุมฮู้ดผ้าคลุมนักรบอวกาศ ขอพลังแห่งการเผาผลาญจงสถิตอยู่กับท่าน' },
  { id: 'hero_agent_spy', category: 'mythical', isHero: true, heroCategory: 'super', heroStyle: 'secret_agent', skinHex: '#F3C8A6', colorHex: '#18181B', bandColor: '#38BDF8', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'สายลับพยัคฆ์แว่นทมิฬ', nickname: 'เอเจนต์หูฟังภารกิจลับ', emoji: '🕶️', desc: 'ผมปาดเรียบเนี้ยบ สวมแว่นดำและหูฟังสายลับ ปฏิบัติการจารกรรมความผอม' },

  // ============================================================================
  // 🏮 3. ตำนาน & อนิเมะสายฮา (Legends & Anime - 15 ตัวละครมนุษย์จิบิ)
  // ============================================================================
  { id: 'hero_saiyan', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'spiky_saiyan', skinHex: '#F5C6A0', colorHex: '#18181B', bandColor: '#F97316', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'นักรบไซย่าผมตั้งทะลุฟ้า', nickname: 'ยอดนักสู้พลังคลื่นเต่า', emoji: '🔥', desc: 'ทรงผมตั้งแหลมชี้ฟ้าหลายแฉกระดับตำนาน ยิ่งเบิร์นพลังต่อสู้ยิ่งพุ่งทะลุหมื่น!' },
  { id: 'hero_straw_pirate', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'straw_hat', skinHex: '#F5C8A4', colorHex: '#FACC15', bandColor: '#EF4444', defaultArmor: 'armor_none', earStyle: 'human', name: 'กัปตันหมวกฟางจอมลุย', nickname: 'ราชาโจรสลัดสายเนื้อย่าง', emoji: '👒', desc: 'สวมหมวกฟางคาดริบบิ้นแดง มีรอยแผลใต้ตา วิ่งยืดแขนคว้าเส้นชัย!' },
  { id: 'hero_demon_slayer', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'slayer_scar', skinHex: '#FAD6B8', colorHex: '#7F1D1D', bandColor: '#EF4444', defaultArmor: 'armor_vest', earStyle: 'human', name: 'นักล่าอสูรปราณเผาผลาญ', nickname: 'ปานไฟต่างหูไพ่ตะวัน', emoji: '🎴', desc: 'เพ่งจิตปราณทั้งปวง! ผมปัดข้างสีแดงเข้มพร้อมปานไฟและต่างหูไพ่สุดเท่' },
  { id: 'hero_sorcerer', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'blindfold_white', skinHex: '#FFE4D4', colorHex: '#F8FAFC', bandColor: '#18181B', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'ผู้ใช้คุณไสยผ้าปิดตาดำ', nickname: 'จอมเวทผมขาวไร้ขีดจำกัด', emoji: '🤞', desc: 'ผมขาวชี้ฟูตั้งขึ้นพร้อมผ้าปิดตาสีดำสุดคูล กางอาณาเขตไร้ไขมัน!' },
  { id: 'hero_leaf_shinobi', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'spiky_headband', skinHex: '#F7CCA8', colorHex: '#FACC15', bandColor: '#2563EB', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'นินจาหัวเหลืองจอมคาถา', nickname: 'คาถาแยกเงาวิ่งพันรอบ', emoji: '🍥', desc: 'ผมทองตั้งแหลมคาดผ้าหน้าผากเหล็ก วิ่งท่าแขนลู่ลมไปข้างหน้าไวสุดใจ' },
  { id: 'hero_one_punch', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'bald_hero', skinHex: '#FAD6B8', colorHex: '#FACC15', bandColor: '#EF4444', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'ฮีโร่หมัดเดียวหัวใสปิ๊ง', nickname: 'วิดพื้นร้อยครั้งวิ่งสิบโล', emoji: '👊', desc: 'ฝึกหนักจนผมร่วงหมดหัว เงาวับสะท้อนแดด แข็งแกร่งระดับต่อยแคลอรี่กระจุย!' },
  { id: 'hero_monkey_king', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'monkey_king_band', skinHex: '#F3C59E', colorHex: '#B45309', bandColor: '#FACC15', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'ซุนหงอคงรัดเกล้าทอง', nickname: 'ฉีเทียนต้าเซิ่งขนไก่ฟ้า', emoji: '👑', desc: 'สวมรัดเกล้าทองประดับขนไก่ฟ้าคู่ยาว ตีลังกาเมฆสีทองพุ่งเข้าเส้นชัย' },
  { id: 'hero_pharaoh', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'pharaoh_nemes', skinHex: '#D99B6C', colorHex: '#FACC15', bandColor: '#1D4ED8', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'ฟาโรห์อียิปต์บัลลังก์ทราย', nickname: 'ผ้าคลุมเนเมสทองคำ', emoji: '🏺', desc: 'สวมเครื่องหัวฟาโรห์ลายทองสลับน้ำเงินติดงูเห่าศักดิ์สิทธิ์ สง่างามเหนือกาลเวลา' },
  { id: 'hero_spartan', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'spartan_plume', skinHex: '#DF9F70', colorHex: '#DC2626', bandColor: '#D97706', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'ขุนศึกสปาร์ตันซิกแพคเหล็ก', nickname: 'หมวกทองสัมฤทธิ์พู่แดง', emoji: '🛡️', desc: 'นี่คือสปาร์ตา!! สวมหมวกเกราะกรีกโบราณพู่แผงขนม้าสีแดงโค้งอลังการ' },
  { id: 'hero_zeus', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'laurel_god', skinHex: '#FAD6B8', colorHex: '#F8FAFC', bandColor: '#FACC15', defaultArmor: 'armor_ice_cape', earStyle: 'human', name: 'มหาเทพโอลิมปัสช่อมะกอกทอง', nickname: 'เทพเจ้าหนวดเมฆา', emoji: '🏛️', desc: 'ผมและหนวดเคราขาวฟูดั่งก้อนเมฆ สวมมงกุฎช่อมะกอกทองคำแห่งผู้ชนะ' },
  { id: 'hero_vampire', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'vampire_slick', skinHex: '#E2E8F0', colorHex: '#0F172A', bandColor: '#DC2626', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'เคานต์แวมไพร์ขุนนางรัตติกาล', nickname: 'ผิวขาวซีดเขี้ยวน้อย', emoji: '🧛', desc: 'ผมดำปาดเรียบหน้าผากแหลม มีเขี้ยวน้อยน่ารัก ดื่มแต่น้ำมะเขือเทศสกัดเย็น' },
  { id: 'hero_jiangshi', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'jiangshi_talisman', skinHex: '#DBEAFE', colorHex: '#1E293B', bandColor: '#FACC15', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'ผีดิบจียงซือกระโดดลดพุง', nickname: 'หมวกขุนนางแปะยันต์เหลือง', emoji: '🧧', desc: 'แปะยันต์เหลืองสะกดความหิวไว้กลางหน้าผาก กระโดดก้าวขาคู่เบิร์นไม่หยุด!' },
  { id: 'hero_chinese_buns', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'double_buns', skinHex: '#FFE4D4', colorHex: '#18181B', bandColor: '#EF4444', defaultArmor: 'armor_snow_dress', earStyle: 'human', name: 'จอมยุทธ์หมวยซาลาเปาคู่', nickname: 'อาหมวยกังฟูเตะสายฟ้า', emoji: '🥟', desc: 'มวยผมซาลาเปาคู่หุ้มผ้าไหมผูกริบบิ้น รัวลูกเตะกังฟูสลายแคลอรี่ร้อยท่า' },
  { id: 'hero_oni_samurai', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'demon_lord', skinHex: '#F87171', colorHex: '#F8FAFC', bandColor: '#FACC15', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'ยักษ์โอนิเขาทองจอมพลัง', nickname: 'อสูรแดงผมขาวสายลุย', emoji: '👹', desc: 'ผิวกายสีแดงเพลิงตัดกับผมขาวฟูและเขาทองคู่ ยกกระบองเหล็กแทนดัมเบล!' },
  { id: 'hero_thai_warrior', category: 'mythical', isHero: true, heroCategory: 'legend', heroStyle: 'muaythai_mongkhon', skinHex: '#C6865A', colorHex: '#18181B', bandColor: '#DC2626', defaultArmor: 'armor_vest', earStyle: 'human', name: 'ขุนศึกบางระจันผ้าประเจียดแดง', nickname: 'นักรบไทยใจเกินร้อย', emoji: '🔥', desc: 'ผิวแทนเข้มโพกผ้าประเจียดสีแดงสด ฮึดสู้วิ่งถวายชีวิตไม่ยอมถอยเข้าซุ้มอาหาร' },

  // ============================================================================
  // 🥊 4. สายฟิตเนส & อาชีพสายปั่น (Fitness & Funny Jobs - 15 ตัวละครมนุษย์จิบิ)
  // ============================================================================
  { id: 'hero_muaythai', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'muaythai_mongkhon', skinHex: '#D99B6C', colorHex: '#18181B', bandColor: '#FACC15', defaultArmor: 'armor_none', earStyle: 'human', name: 'ยอดมวยไทยสวมมงคลทอง', nickname: 'แข้งทองคำรำมวยไหว้ครู', emoji: '🥊', desc: 'สวมมงคลถักเชือกศักดิ์สิทธิ์บนศีรษะ ฟุตเวิร์กเตะกระสอบทรายรีดเหงื่อกระจาย' },
  { id: 'hero_gym_bro', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'sport_headband', skinHex: '#E5AE86', colorHex: '#292524', bandColor: '#EF4444', defaultArmor: 'armor_none', earStyle: 'human', name: 'เทรนเนอร์กล้ามปูสายเวย์', nickname: 'โค้ชฟิตเนสผ้าคาดหัว', emoji: '💪', desc: 'ผมอันเดอร์คัทเท่ๆ คาดผ้าซับเหงื่อสปอร์ต ตะโกนเชียร์ "อีกเซ็ตเดียวน้อง!!"' },
  { id: 'hero_yoga_bun', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'top_bun', skinHex: '#FFE2CE', colorHex: '#78350F', bandColor: '#F472B6', defaultArmor: 'armor_princess', earStyle: 'human', name: 'สาวโยคะมัดจุกสายคลีน', nickname: 'พิลาทิสเกิร์ลหุ่นเป๊ะ', emoji: '🧘‍♀️', desc: 'มัดจุกดังโงะกลมสูงพร้อมที่คาดผมพาสเทล ยืดเหยียดตัวอ่อนจัดระเบียบเอวเอส' },
  { id: 'hero_marathon', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'runner_visor', skinHex: '#E8B48A', colorHex: '#1E293B', bandColor: '#22C55E', defaultArmor: 'armor_ice_cape', earStyle: 'human', name: 'นักวิ่งมาราธอนล่าเหรียญ', nickname: 'หมวกไวเซอร์เพซสี่', emoji: '🏃', desc: 'สวมหมวกไวเซอร์เปิดหัวระบายเหงื่อ ตื่นตีสี่มาวิ่งโซนสองทุกเช้าไม่เคยขาด' },
  { id: 'hero_aerobics', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'disco_afro', skinHex: '#F5C6A5', colorHex: '#92400E', bandColor: '#06B6D4', defaultArmor: 'armor_snow_dress', earStyle: 'human', name: 'ตัวแม่แอโรบิกหน้าลาน 80s', nickname: 'เต้นยับรับเพลงเร็ว', emoji: '💃', desc: 'ผมฟูหยิกคาดผ้านีออนยุค 80s นำเต้นแอโรบิกหน้าห้างจนไขมันสะเทือน!' },
  { id: 'hero_sumo', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'sumo_topknot', skinHex: '#FAD6B8', colorHex: '#18181B', bandColor: '#F8FAFC', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'ริกิชิซูโม่จอมพลัง', nickname: 'จุกชงมาเกะสลัดไขมัน', emoji: '🥋', desc: 'เกล้าจุกชงมาเกะแบบโยโกซึนะ เปลี่ยนมวลพุงเป็นพลังพุ่งชนเส้นชัย!' },
  { id: 'hero_lifeguard', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'lifeguard_cap', skinHex: '#D99868', colorHex: '#EF4444', bandColor: '#FFFFFF', defaultArmor: 'armor_none', earStyle: 'human', name: 'ไลฟ์การ์ดชายหาดกล้ามทอง', nickname: 'ผู้พิทักษ์หาดทราย', emoji: '🛟', desc: 'ผิวแทนแดดทะเลสวมหมวกแก๊ปไลฟ์การ์ด วิ่งสปรินต์เลียบชายหาดสุดเท่' },
  { id: 'hero_chef', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'chef_toque', skinHex: '#FAD6B8', colorHex: '#FFFFFF', bandColor: '#EF4444', defaultArmor: 'armor_ice_cape', earStyle: 'human', name: 'เชฟกระทะเหล็กสายคลีน', nickname: 'หมวกเชฟสูงคำนวณแคล', emoji: '👨‍🍳', desc: 'สวมหมวกเชฟมิชลินทรงสูง ชั่งตวงอกไก่ปั่นและบรอกโคลีแม่นระดับทศนิยม' },
  { id: 'hero_rider', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'rider_helmet', skinHex: '#E5B28A', colorHex: '#22C55E', bandColor: '#FACC15', defaultArmor: 'armor_vest', earStyle: 'human', name: 'พี่ไรเดอร์ส่งด่วนสายซิ่ง', nickname: 'หมวกกันน็อกติดหูแมว', emoji: '🛵', desc: 'วันนี้จอดรถแล้ววิ่งส่งออเดอร์เองเพื่อเบิร์น! หมวกกันน็อกชิลด์ใสติดหูแมวสุดคิวท์' },
  { id: 'hero_office', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'office_glasses', skinHex: '#FAD6B8', colorHex: '#1E293B', bandColor: '#EF4444', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'มนุษย์ออฟฟิศหนีประชุมมาวิ่ง', nickname: 'แว่นกรอบดำเนคไทโพกหัว', emoji: '💼', desc: 'ปิดคอมพ์ปุ๊บเอาเนคไทโพกหัวลงสนามปั๊บ แก้ปวดหลังออฟฟิศซินโดรมด้วยคาร์ดิโอ!' },
  { id: 'hero_doctor', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'doctor_mirror', skinHex: '#FFE4D4', colorHex: '#1E293B', bandColor: '#38BDF8', defaultArmor: 'armor_ice_cape', earStyle: 'human', name: 'คุณหมอตรวจจับคอเลสเตอรอล', nickname: 'กระจกคาดหัวสั่งงดของทอด', emoji: '🩺', desc: 'คุณหมอลงมาวิ่งคุมเองในสนาม! ใครแอบกินของมันเจอใบสั่งวิ่งเพิ่มสิบรอบ' },
  { id: 'hero_disco', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'disco_afro', skinHex: '#C6865A', colorHex: '#18181B', bandColor: '#FACC15', defaultArmor: 'armor_gold_paladin', earStyle: 'human', name: 'ราชาดิสโก้หัวแอฟโฟรยักษ์', nickname: 'ฟลอร์แดนซ์สะท้านทรวง', emoji: '🪩', desc: 'ทรงผมแอฟโฟรกลมยักษ์ใหญ่ฟูฟ่อง เต้นมูนวอล์กเข้าเส้นชัยแบบมีสไตล์' },
  { id: 'hero_rockstar', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'cyber_mohawk', skinHex: '#FAD6B8', colorHex: '#EF4444', bandColor: '#18181B', defaultArmor: 'armor_silver_knight', earStyle: 'human', name: 'ร็อกสตาร์พังก์หัวหนาม', nickname: 'ว้ากเผาผลาญแคลอรี่', emoji: '🎸', desc: 'เซ็ตผมหนามแหลมชี้ฟ้า โยกหัวเฮดแบงก์เบิร์นไขมันมันส์หยดติ๋ง!' },
  { id: 'hero_gamer', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'gamer_headset', skinHex: '#FFE4D6', colorHex: '#6366F1', bandColor: '#22D3EE', defaultArmor: 'armor_ice_cape', earStyle: 'human', name: 'สตรีมเมอร์เกมเมอร์หูฟังไฟ', nickname: 'วางจอยมาซอยเท้า', emoji: '🎧', desc: 'สวมหูฟังเกมมิ่ง RGB พร้อมไมค์ไลฟ์สดวิ่งลดพุง ขอกำลังใจโดเนทเป็นอกไก่!' },
  { id: 'hero_granny_turbo', category: 'mythical', isHero: true, heroCategory: 'fitness', heroStyle: 'top_bun', skinHex: '#FAD6B8', colorHex: '#CBD5E1', bandColor: '#FACC15', defaultArmor: 'armor_snow_dress', earStyle: 'human', name: 'อาม่าเทอร์โบสปรินต์แซงโค้ง', nickname: 'มวยผมเงินปิ่นทองซิ่งไว', emoji: '👵', desc: 'เห็นผมสีเงินใจดีแบบนี้ แต่เวลาป้ายลดราคาเปิด อาม่าสปรินต์แซงวัยรุ่นไม่เห็นฝุ่น!' },
];

export function isHeroSpecies(breedOrSpecies?: string): boolean {
  if (!breedOrSpecies) return false;
  return HERO_LIST.some((h) => h.id === breedOrSpecies);
}

export function resolveBreedOption(breedOrSpecies?: string): SpeciesOption {
  const mappedId = breedOrSpecies ? LEGACY_SPECIES_FALLBACK[breedOrSpecies] || breedOrSpecies : 'bunny';
  const foundHero = HERO_LIST.find((h) => h.id === mappedId);
  if (foundHero) return foundHero;
  const found = SPECIES_LIST.find((b) => b.id === mappedId);
  return found ?? SPECIES_LIST.find((b) => b.id === 'bunny') ?? SPECIES_LIST[0];
}

export type ShopCategory = 'hat' | 'face' | 'armor' | 'weapon' | 'wings' | 'aura' | 'pet' | 'mount';
export type GachaRarity = 'rare' | 'epic' | 'legendary';

export const GACHA_SPIN_COST = 80;

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
  // Category 1: Hat (หมวก / เครื่องหัวแฟชั่น & สปอร์ต)
  { id: 'none', category: 'hat', name: 'ไม่สวมหมวก', icon: '➖', cost: 0, desc: 'โชว์หูน่ารักตามสายพันธุ์', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'hat_red_bow', category: 'hat', name: 'โบว์แดงสดใส', icon: '🎀', cost: 0, desc: 'โบว์แดงผูกผมสุดน่ารัก (ฟรี)', colorHex: 0xEF4444, accentHex: 0xFCA5A5 },
  { id: 'hat_knight_helm', category: 'hat', name: 'หมวกแก๊ปสปอร์ตนักวิ่ง', icon: '🧢', cost: 50, desc: 'หมวกแก๊ปผ้าใบสายสตรีท & วิ่งมาราธอน', colorHex: 0x2563EB, accentHex: 0xF472B6 },
  { id: 'hat_tiara', category: 'hat', name: 'มงกุฎปาร์ตี้มินิ', icon: '👑', cost: 75, desc: 'มงกุฎจิ๋วสีทองสายแฟชั่น', colorHex: 0xFACC15, accentHex: 0x38BDF8 },
  { id: 'hat_ice_crown', category: 'hat', name: 'ที่คาดผมเกล็ดหิมะ', icon: '❄️', cost: 100, desc: 'ที่คาดผมคริสตัลสีฟ้าสดใส', colorHex: 0x38BDF8, accentHex: 0xE0F2FE },
  { id: 'hat_robin', category: 'hat', name: 'หมวกบักเก็ตแคมป์ปิ้ง', icon: '👒', cost: 75, desc: 'หมวกผ้าเดินป่าสไตล์เอาท์ดอร์', colorHex: 0x16A34A, accentHex: 0xEF4444 },
  { id: 'hat_fez', category: 'hat', name: 'หมวกไหมพรมบีนนี่', icon: '🧶', cost: 75, desc: 'หมวกไหมพรมสีแดงอุ่นๆ สไตล์สตรีท', colorHex: 0xDC2626, accentHex: 0xFACC15 },
  { id: 'hat_ms_orange_shroom', category: 'hat', name: 'หมวกเห็ดส้มเมเปิ้ล', icon: '🍄', cost: 80, desc: 'หมวกทรงเห็ดสีส้มจุดครีมนุ่มฟูสุดฮิต (สไตล์ MapleSim)', colorHex: 0xF97316, accentHex: 0xFEF3C7 },
  { id: 'hat_ms_pink_beret', category: 'hat', name: 'หมวกเบเร่ต์ศิลปินชมพู', icon: '🎨', cost: 65, desc: 'หมวกเบเร่ต์ผ้าสักหลาดสีชมพูซากุระเอียงข้าง (สไตล์ MapleSim)', colorHex: 0xF472B6, accentHex: 0xFFFFFF },
  { id: 'hat_ms_floral_wreath', category: 'hat', name: 'มงกุฎดอกไม้ป่าเอลิน่า', icon: '🌼', cost: 70, desc: 'เถาวัลย์ดอกไม้หลากสีสวมรอบหัว (สไตล์ MapleSim)', colorHex: 0x4ADE80, accentHex: 0xFDE047 },

  // Category 2: Face / Glasses (แว่นตา & แอคเซสเซอรี่หน้า)
  { id: 'face_none', category: 'face', name: 'หน้าใสธรรมชาติ', icon: '➖', cost: 0, desc: 'โชว์โครงหน้าสัตว์แต่ละสายพันธุ์ชัดๆ', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'face_ms_bandaid', category: 'face', name: 'พลาสเตอร์แปะจมูกจอมซน', icon: '🩹', cost: 35, desc: 'พลาสเตอร์แปะสันจมูกสุดคลาสสิกสายแฟชั่น (สไตล์ MapleSim)', colorHex: 0xFDBA74, accentHex: 0xFFFFFF },
  { id: 'face_ms_blush_hearts', category: 'face', name: 'สติกเกอร์แก้มหัวใจชมพู', icon: '💕', cost: 45, desc: 'แก้มชมพูระเรื่อพร้อมหัวใจคู่สองข้างแก้ม (สไตล์ MapleSim)', colorHex: 0xFB7185, accentHex: 0xF43F5E },
  { id: 'face_sunglasses', category: 'face', name: 'แว่นกันแดดแฟชั่น', icon: '🕶️', cost: 40, desc: 'แว่นดำสุดคูลเดินชิลล์กลางแดด', colorHex: 0x18181B, accentHex: 0xFACC15 },
  { id: 'face_nerd_glasses', category: 'face', name: 'แว่นกลมกรอบทอง', icon: '👓', cost: 40, desc: 'แว่นสายตาแฟชั่นสายคำนวณแคลอรี่', colorHex: 0xFACC15, accentHex: 0xE0F2FE },
  { id: 'face_fox_mask', category: 'face', name: 'หน้ากากงานวัดญี่ปุ่น', icon: '🎭', cost: 75, desc: 'หน้ากากคาดข้างหัวสไตล์เที่ยวงานเทศกาล', colorHex: 0xF8FAFC, accentHex: 0xEF4444 },
  { id: 'face_toast', category: 'face', name: 'คาบขนมปังปิ้งมื้อเช้า', icon: '🍞', cost: 50, desc: 'ตื่นสายรีบวิ่งมาเข้าลู่!', colorHex: 0xD97706, accentHex: 0xFEF3C7 },

  // Category 3: Outfit — เสื้อ & กางเกง (Casual / Sporty Shirts & Pants)
  { id: 'armor_bare', category: 'armor', name: 'ไม่สวมชุด (ตัวกลมขนสัตว์)', icon: '🧸', cost: 0, desc: 'ถอดชุดโชว์พุงกลมขนสัตว์ธรรมชาติ (ฟรี)', colorHex: 0xF8FAFC, accentHex: 0xFFFBEB },
  { id: 'armor_none', category: 'armor', name: 'เสื้อยืดสปอร์ต & กางเกงวอร์ม', icon: '👕', cost: 0, desc: 'ชุดออกกำลังกายเสื้อยืดกางเกงขายาว (ฟรี)', colorHex: 0x3B82F6, accentHex: 0x1E293B },
  { id: 'armor_snow_dress', category: 'armor', name: 'เสื้อครอป & กระโปรงเทนนิส', icon: '👗', cost: 0, desc: 'เสื้อน้ำเงินกระโปรงเหลืองสดใสคล่องตัว (ฟรี)', colorHex: 0x2563EB, accentHex: 0xFACC15 },
  { id: 'armor_ms_denim_overall', category: 'armor', name: 'ชุดเอี๊ยมยีนส์เสื้อเหลือง', icon: '👖', cost: 65, desc: 'เอี๊ยมยีนส์กระดุมทองทับเสื้อเหลืองสดใส (สไตล์ MapleSim)', colorHex: 0xFACC15, accentHex: 0x2563EB },
  { id: 'armor_ms_sailor_uniform', category: 'armor', name: 'ชุดกะลาสีเรือปกน้ำเงินโบว์แดง', icon: '⚓', cost: 85, desc: 'ชุดนักเรียนกะลาสีเรือสุดคิวท์พร้อมกระโปรงกรมท่า (สไตล์ MapleSim)', colorHex: 0xFFFFFF, accentHex: 0x1D4ED8 },
  { id: 'armor_ms_strawberry_milk', category: 'armor', name: 'ฮู้ดดี้โอเวอร์ไซส์นมสตรอว์เบอร์รี', icon: '🍓', cost: 90, desc: 'เสื้อฮู้ดชมพูพาสเทลคู่กางเกงขาสั้นขาว (สไตล์ MapleSim)', colorHex: 0xF472B6, accentHex: 0xFFFBEB },
  { id: 'armor_silver_knight', category: 'armor', name: 'เสื้อฮู้ดดี้ & กางเกงยีนส์', icon: '🧥', cost: 75, desc: 'แจ็คเก็ตฮู้ดสตรีทคู่กับกางเกงยีนส์ขายาว', colorHex: 0x64748B, accentHex: 0x1D4ED8 },
  { id: 'armor_gold_paladin', category: 'armor', name: 'ชุดแทร็กสูทแชมเปี้ยนสีทอง', icon: '🎽', cost: 150, desc: 'เสื้อแจ็คเก็ตวอร์มแถบทอง & กางเกงสปอร์ต', colorHex: 0xFACC15, accentHex: 0x18181B },
  { id: 'armor_princess', category: 'armor', name: 'เสื้อคาดิแกนฟ้า & กางเกงขาสั้น', icon: '👚', cost: 75, desc: 'ลุคคาเฟ่พาสเทลน่ารักสบายๆ', colorHex: 0x60A5FA, accentHex: 0xF8FAFC },
  { id: 'armor_ice_cape', category: 'armor', name: 'สเวตเตอร์ไหมพรม & กางเกงชิโน่', icon: '🧣', cost: 100, desc: 'เสื้อแขนยาวสีฟ้าพาสเทลคู่กางเกงขายาว', colorHex: 0x38BDF8, accentHex: 0xE2E8F0 },
  { id: 'armor_vest', category: 'armor', name: 'เสื้อกั๊กยีนส์ & กางเกงคาร์โก้', icon: '🦺', cost: 50, desc: 'ลุคแคมป์ปิ้งเสื้อกั๊กทับเสื้อยืดขาว', colorHex: 0x16A34A, accentHex: 0xD97706 },
  { id: 'armor_chibi_animal', category: 'armor', name: 'ร่างสัตว์จิบิ 4 ขาธรรมชาติ', icon: '🐾', cost: 0, desc: 'ร่างสัตว์จิบิดุ๊กดิ๊กไม่สวมเสื้อผ้า (ฟรี)', colorHex: 0x10B981, accentHex: 0xFEF08A },

  // Category 4: Handheld Props (ของถือเล่น / เครื่องดื่ม / อุปกรณ์ฟิตเนส — ไม่ใช่อาวุธ)
  { id: 'weapon_none', category: 'weapon', name: 'มือเปล่าเดินชิลล์', icon: '➖', cost: 0, desc: 'แกว่งแขนวิ่งสบายๆ ตัวปลิว', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'weapon_ms_lollipop', category: 'weapon', name: 'อมยิ้มสายรุ้งยักษ์ลูดิเบรียม', icon: '🍭', cost: 70, desc: 'อมยิ้มกลมลายเกลียวหวานแหววอันยักษ์ (สไตล์ MapleSim)', colorHex: 0xF472B6, accentHex: 0x38BDF8 },
  { id: 'weapon_light_sword', category: 'weapon', name: 'ขวดเวย์โปรตีนเชค', icon: '🥤', cost: 100, desc: 'เชคเกอร์โปรตีนสีฟ้าสดชื่นหลังเวิร์คเอาท์', colorHex: 0x38BDF8, accentHex: 0xFACC15 },
  { id: 'weapon_magic_staff', category: 'weapon', name: 'แก้วชานมไข่มุกจัมโบ้', icon: '🧋', cost: 90, desc: 'ชานมไข่มุกแก้วโปรดเพิ่มพลังใจ', colorHex: 0xFDBA74, accentHex: 0x18181B },
  { id: 'weapon_gold_dumbbell', category: 'weapon', name: 'ดัมเบลฟิตเนสสีทอง', icon: '🏋️', cost: 60, desc: 'ถือวิ่งกระชับต้นแขนคูณสอง', colorHex: 0xFACC15, accentHex: 0x94A3B8 },
  { id: 'weapon_giant_fork', category: 'weapon', name: 'ไอศกรีมซอฟต์เสิร์ฟสตรอว์เบอร์รี', icon: '🍦', cost: 60, desc: 'ของหวานรางวัลวันชีทเดย์', colorHex: 0xF472B6, accentHex: 0xFDE68A },
  { id: 'weapon_broom', category: 'weapon', name: 'ไม้แบดมินตันสปอร์ต', icon: '🏸', cost: 75, desc: 'พร้อมตีแบดเบิร์นแคลอรี่กับเพื่อน', colorHex: 0xEF4444, accentHex: 0xF8FAFC },

  // Category 5: Back / Bag (กระเป๋าเป้ & พรอพติดหลัง)
  { id: 'wings_none', category: 'wings', name: 'ไม่สะพายหลัง', icon: '➖', cost: 0, desc: 'หลังโล่งคล่องตัว', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'wings_ms_teddy_pack', category: 'wings', name: 'เป้ตุ๊กตาหมีน้อยเกาะหลัง', icon: '🧸', cost: 95, desc: 'ตุ๊กตาหมีสีคาราเมลกอดคอเกาะหลังไปทุกที่ (สไตล์ MapleSim)', colorHex: 0xB45309, accentHex: 0xFEF3C7 },
  { id: 'wings_apple_sword', category: 'wings', name: 'กระเป๋าเป้แคมป์ปิ้งสุดคิวท์', icon: '🎒', cost: 100, desc: 'เป้สะพายหลังสีแดง-เหลืองพร้อมพวงกุญแจ', colorHex: 0xEF4444, accentHex: 0xFACC15 },
  { id: 'wings_fairy', category: 'wings', name: 'ปีกผีเสื้อแฟนซีพาสเทล', icon: '🦋', cost: 75, desc: 'พรอพปีกผีเสื้อสีมิ้นท์สดใส', colorHex: 0x6EE7B7, accentHex: 0xFDE68A },
  { id: 'wings_gold_archangel', category: 'wings', name: 'ปีกนางฟ้าปาร์ตี้สีทอง', icon: '🪽', cost: 150, desc: 'พรอพปีกขนนกสีทองฉลองแชมป์', colorHex: 0xFACC15, accentHex: 0xFEF08A },
  { id: 'wings_crystal', category: 'wings', name: 'โบว์ริบบิ้นยักษ์ติดหลัง', icon: '🎀', cost: 100, desc: 'โบว์สีฟ้าพาสเทลติดหลังสุดแบ๊ว', colorHex: 0x38BDF8, accentHex: 0xE0F2FE },
  { id: 'wings_magic_carpet', category: 'wings', name: 'เสื่อโยคะม้วนสะพายหลัง', icon: '🧘', cost: 75, desc: 'เสื่อฟิตเนสสีม่วงพกพร้อมออกกำลังกาย', colorHex: 0x7C3AED, accentHex: 0xFACC15 },

  // Category 6: Aura / Effect (ออร่าเรืองแสงสไตล์ Dragon Nest)
  { id: 'aura_none', category: 'aura', name: 'ไม่มีออร่า', icon: '➖', cost: 0, desc: 'โหมดประหยัดพลังงาน', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'aura_magic_circle', category: 'aura', name: 'วงเวทเรืองแสงใต้เท้า', icon: '🔮', cost: 80, desc: 'วงเวทสีฟ้าทองหมุนรอบตัว', colorHex: 0x38BDF8, accentHex: 0xFACC15 },
  { id: 'aura_flame', category: 'aura', name: 'ออร่าเปลวไฟนักสู้', icon: '🔥', cost: 100, desc: 'ไฟลุกโชนรอบตัวเผาผลาญแคลอรี่', colorHex: 0xF97316, accentHex: 0xEF4444 },
  { id: 'aura_stars', category: 'aura', name: 'ประกายดาววิบวับ', icon: '✨', cost: 90, desc: 'กลุ่มดาวทองคำลอยวนรอบกาย', colorHex: 0xFDE047, accentHex: 0xFEF9C3 },
  { id: 'aura_sakura', category: 'aura', name: 'กลีบซากุระปลิว', icon: '🌸', cost: 90, desc: 'กลีบดอกไม้ชมพูละมุนรอบตัว', colorHex: 0xF472B6, accentHex: 0xFBCFE8 },

  // Category 7: Pet + Pet Gear (สัตว์เลี้ยงคู่ใจ + พรอพสัตว์เลี้ยง)
  { id: 'pet_none', category: 'pet', name: 'ไม่มีสัตว์เลี้ยงเดินตาม', icon: '➖', cost: 0, desc: 'ลุยเดี่ยวไม่ง้อใคร', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'pet_fox_scarf', category: 'pet', name: 'จิ้งจอกจิบิอัศวิน', icon: '🦊', cost: 0, desc: 'จิ้งจอกส้มจิบิพันผ้าคลุมวิ่งเคียงข้าง (ฟรี)', colorHex: 0xEA580C, accentHex: 0x2563EB },
  { id: 'pet_bear_shield', category: 'pet', name: 'หมีจิบิผู้พิทักษ์', icon: '🐻‍❄️', cost: 0, desc: 'หมีน้อยจิบิคอยคุ้มกันเข้าเส้นชัย (ฟรี)', colorHex: 0xF1F5F9, accentHex: 0xFACC15 },
  { id: 'pet_corgi_cape', category: 'pet', name: 'คอร์กี้ผ้าคลุมฮีโร่', icon: '🐕', cost: 50, desc: 'น้องหมาคอร์กี้ใส่ผ้าคลุมแดงวิ่งนำ', colorHex: 0xF59E0B, accentHex: 0xEF4444 },
  { id: 'pet_cat_crown', category: 'pet', name: 'แมวส้มสวมมงกุฎ', icon: '🐈', cost: 75, desc: 'แมวส้มผู้สูงศักดิ์ใส่สร้อยทอง', colorHex: 0xFB923C, accentHex: 0xFACC15 },
  { id: 'pet_bunny_wings', category: 'pet', name: 'กระต่ายน้อยติดปีกนางฟ้า', icon: '🐇', cost: 100, desc: 'กระต่ายขาวติดปีกบินตามเจ้านาย', colorHex: 0xF8FAFC, accentHex: 0xF472B6 },
  { id: 'pet_pig_chef', category: 'pet', name: 'หมูจิ๋วหมวกเชฟทอง', icon: '🐖', cost: 100, desc: 'ลูกหมูสีชมพูใส่หมวกเชฟคอยเชียร์', colorHex: 0xF472B6, accentHex: 0xFACC15 },

  // Category 8: Mounts (สัตว์ขี่ & พาหนะคู่ใจสไตล์ MapleSim)
  { id: 'mount_none', category: 'mount', name: 'เดิน-วิ่งเองฟิตจัด', icon: '➖', cost: 0, desc: 'วิ่งสองขาเบิร์นแคลอรี่ด้วยตัวเอง', colorHex: 0x000000, accentHex: 0x000000 },
  { id: 'mount_cloud', category: 'mount', name: 'เมฆวิเศษสีขาวนุ่มฟู', icon: '☁️', cost: 0, desc: 'ก้อนเมฆปุยนุ่นลอยฟ้านุ่มนิ่มสไตล์ MapleSim (ฟรี)', colorHex: 0xFFFFFF, accentHex: 0xBAE6FD },
  { id: 'mount_sunny_egg', category: 'mount', name: 'พรมไข่ดาวเยิ้มลอยฟ้า', icon: '🍳', cost: 65, desc: 'ไข่ดาวขอบกรอบไข่แดงเด้งดึ๋งขี่ลอยเหนือพื้น (MapleSim)', colorHex: 0xFACC15, accentHex: 0xFFFFFF },
  { id: 'mount_pudding', category: 'mount', name: 'พุดดิ้งคาราเมลจานยักษ์', icon: '🍮', cost: 75, desc: 'พุดดิ้งเด้งดึ๋งราดซอสคาราเมลแต่งคุกกี้โอรีโอ้ (MapleSim)', colorHex: 0xFBBF24, accentHex: 0x78350F },
  { id: 'mount_green_slime', category: 'mount', name: 'บิ๊กสไลม์เขียวเด้งดึ๋ง', icon: '💧', cost: 80, desc: 'ขี่สไลม์ยักษ์สีเขียวมะนาวกระโดดดึ๋งดั๋งเข้าเส้นชัย (MapleSim)', colorHex: 0x4ADE80, accentHex: 0xDCFCE7 },
  { id: 'mount_red_pig', category: 'mount', name: 'หมูแดงผูกโบว์ซิ่งสายฟ้า', icon: '🐷', cost: 85, desc: 'หมูสีแดงผูกริบบิ้นฟ้าในตำนานของนักผจญภัย (MapleSim)', colorHex: 0xEF4444, accentHex: 0x38BDF8 },
  { id: 'mount_mochi_bunny', category: 'mount', name: 'กระต่ายโมจิซ้อนสองชั้น', icon: '🐰', cost: 95, desc: 'ก้อนโมจิกระต่ายขาวนุ่มนิ่มซ้อนตัวเด้งดึ๋ง (MapleSim)', colorHex: 0xFFFFFF, accentHex: 0x4ADE80 },
  { id: 'mount_unicorn', category: 'mount', name: 'ยูนิคอร์นขาวพาสเทล', icon: '🦄', cost: 120, desc: 'ม้ายูนิคอร์นสีขาวบริสุทธิ์เขาทองแผงคอพาสเทล (MapleSim)', colorHex: 0xFFFFFF, accentHex: 0xC084FC },

  // =========================================================================
  // 🎰 GACHAPON EXCLUSIVE ITEMS (หาซื้อไม่ได้! สุ่มได้จากตู้กาชาปองเท่านั้น!)
  // =========================================================================
  // 🌟 RARE (55%)
  { id: 'hat_gacha_sprout', category: 'hat', name: 'ต้นอ่อนนำโชคงอกบนหัว', icon: '🌱', cost: 0, desc: 'ก้านต้นอ่อนสีเขียวดุ๊กดิ๊กบนหัว (เฉพาะกาชาปอง)', colorHex: 0x22C55E, accentHex: 0x86EFAC, isGachaOnly: true, rarity: 'rare' },
  { id: 'hat_gacha_chef', category: 'hat', name: 'หมวกเชฟมิชลินจอมโซ้ย', icon: '👨‍🍳', cost: 0, desc: 'หมวกเชฟทรงสูงสีขาวระดับภัตตาคาร (เฉพาะกาชาปอง)', colorHex: 0xFFFFFF, accentHex: 0xE2E8F0, isGachaOnly: true, rarity: 'rare' },
  { id: 'face_gacha_star_shades', category: 'face', name: 'แว่นตาดาวซุปตาร์', icon: '🤩', cost: 0, desc: 'แว่นกันแดดกรอบดาวทองเลนส์ชมพู (เฉพาะกาชาปอง)', colorHex: 0xFACC15, accentHex: 0xEC4899, isGachaOnly: true, rarity: 'rare' },
  { id: 'weapon_gacha_jumbo_drumstick', category: 'weapon', name: 'น่องไก่ทอดกรอบจัมโบ้', icon: '🍗', cost: 0, desc: 'น่องไก่ทอดสีทองชิ้นยักษ์ยั่วน้ำลาย (เฉพาะกาชาปอง)', colorHex: 0xD97706, accentHex: 0xFEF3C7, isGachaOnly: true, rarity: 'rare' },
  { id: 'hat_gacha_slime_crown', category: 'hat', name: 'สไลม์เขียวนุ่มนิ่มเกาะหัว', icon: '💧', cost: 0, desc: 'น้องสไลม์หยดน้ำสีเขียวมะนาวดุ๊กดิ๊กบนหัว (MapleSim SSB)', colorHex: 0x4ADE80, accentHex: 0xDCFCE7, isGachaOnly: true, rarity: 'rare' },
  { id: 'weapon_gacha_bunny_plush', category: 'weapon', name: 'ตุ๊กตากระต่ายชมพูกอดอุ่น', icon: '🐰', cost: 0, desc: 'ตุ๊กตาผ้ากระต่ายหูยาวถืออุ้มสุดคิวท์ (MapleSim SSB)', colorHex: 0xF9A8D4, accentHex: 0xFFFFFF, isGachaOnly: true, rarity: 'rare' },

  // 💜 EPIC (33%)
  { id: 'armor_gacha_shiba_pajama', category: 'armor', name: 'ชุดนอนพาสเทลกระดุมดาว', icon: '🔮', cost: 0, desc: 'ชุดนอนลาเวนเดอร์พาสเทลสุดนุ่มนิ่ม (เฉพาะกาชาปอง)', colorHex: 0xC084FC, accentHex: 0xFDE047, isGachaOnly: true, rarity: 'epic' },
  { id: 'hat_gacha_angel_halo', category: 'hat', name: 'วงแหวนเทวดาเรืองแสง', icon: '😇', cost: 0, desc: 'วงแหวนทองคำเปล่งแสงลอยเหนือหัว (เฉพาะกาชาปอง)', colorHex: 0xFDE047, accentHex: 0xFEF9C3, isGachaOnly: true, rarity: 'epic' },
  { id: 'wings_gacha_ufo_cape', category: 'wings', name: 'พวงลูกโป่งพาสเทลลอยฟ้า', icon: '🎈', cost: 0, desc: 'ลูกโป่ง 3 สีผูกหลังเด้งดึ๋งเวลาวิ่ง (เฉพาะกาชาปอง)', colorHex: 0xF472B6, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'epic' },
  { id: 'weapon_gacha_golden_pan', category: 'weapon', name: 'กระทะทองคำทอดไข่ดาว', icon: '🍳', cost: 0, desc: 'กระทะทองคำเงาวับพร้อมไข่ดาวเยิ้มๆ (เฉพาะกาชาปอง)', colorHex: 0xFACC15, accentHex: 0xFFFFFF, isGachaOnly: true, rarity: 'epic' },
  { id: 'hat_gacha_pepe_hood', category: 'hat', name: 'หมวกเพนกวินราชาเปเป้', icon: '🐧', cost: 0, desc: 'หมวกหัวเพนกวินอ้วนกลมมีปากส้มและมงกุฎจิ๋ว (MapleSim SSB)', colorHex: 0x1D4ED8, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'epic' },
  { id: 'weapon_gacha_cloud_umbrella', category: 'weapon', name: 'ร่มก้อนเมฆพาสเทลลอยฟ้า', icon: '☂️', cost: 0, desc: 'ร่มโดมสีฟ้าพาสเทลประดับปุยเมฆนุ่มฟู (MapleSim SSB)', colorHex: 0x38BDF8, accentHex: 0xFFFFFF, isGachaOnly: true, rarity: 'epic' },
  { id: 'mount_gacha_pink_bear', category: 'mount', name: 'หมีชมพูคอปเตอร์ไม้ไผ่', icon: '🐻', cost: 0, desc: 'สัตว์ขี่ตุ๊กตาหมีชมพูติดใบพัดไม้ไผ่หมุนติ้วพาบิน! (MapleSim SSB)', colorHex: 0xF472B6, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'epic' },

  // 🌈 LEGENDARY (12%)
  { id: 'armor_gacha_dino', category: 'armor', name: 'ชุดมาสคอตไดโนเสาร์พุงกลม', icon: '🦖', cost: 0, desc: 'ชุดวันซี่ไดโนเสาร์เขียวมิ้นท์มีหนามหลัง! (Legendary กาชาปอง)', colorHex: 0x10B981, accentHex: 0xF97316, isGachaOnly: true, rarity: 'legendary' },
  { id: 'armor_gacha_pink_bean', category: 'armor', name: 'ชุดวันซี่พิงก์บีนพุงเด้ง', icon: '🩷', cost: 0, desc: 'ชุดมอนสเตอร์สีชมพูบับเบิ้ลกัมสุดแรร์ในตำนาน! (MapleSim SSB)', colorHex: 0xF472B6, accentHex: 0xFBCFE8, isGachaOnly: true, rarity: 'legendary' },
  { id: 'wings_gacha_jetpack', category: 'wings', name: 'เจ็ทแพ็คเทอร์โบพ่นไฟ', icon: '🚀', cost: 0, desc: 'กระเป๋าจรวดคู่พ่นไอพ่นสีฟ้า-ส้มสุดล้ำ! (Legendary กาชาปอง)', colorHex: 0xE2E8F0, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'legendary' },
  { id: 'aura_gacha_rainbow', category: 'aura', name: 'ออร่าสายรุ้งปริซึมเจ็ดสี', icon: '🌈', cost: 0, desc: 'วงแหวนสายรุ้ง 5 ชั้นและคริสตัลหลากสีหมุนรอบตัว! (Legendary)', colorHex: 0xEC4899, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'legendary' },
  { id: 'aura_gacha_snack_orbit', category: 'aura', name: 'ออร่าโดนัท & ชานมโคจร', icon: '🍩', cost: 0, desc: 'โดนัทเคลือบชมพูและชานม 3D ลอยโคจรรอบพุง! (Legendary)', colorHex: 0xF472B6, accentHex: 0xFBBF24, isGachaOnly: true, rarity: 'legendary' },
  { id: 'aura_gacha_maple_leaves', category: 'aura', name: 'ออร่าพายุใบเมเปิ้ลสีทอง', icon: '🍁', cost: 0, desc: 'ใบเมเปิ้ลสีส้มทองปลิวหมุนวนรอบตัวสุดคลาสสิก! (MapleSim SSB)', colorHex: 0xF97316, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'legendary' },
  { id: 'mount_gacha_red_dragon', category: 'mount', name: 'มังกรแดงจิบิติดปีกเพลิง', icon: '🐉', cost: 0, desc: 'ขี่มังกรแดงเขาทองกระพือปีกบินโฉบเข้าเส้นชัย! (MapleSim Legendary)', colorHex: 0xEF4444, accentHex: 0xFACC15, isGachaOnly: true, rarity: 'legendary' },
  { id: 'mount_gacha_ufo', category: 'mount', name: 'จานบิน UFO ลำแสงนีออน', icon: '🛸', cost: 0, desc: 'ขี่จานบินอวกาศไฟนีออนหมุนรอบลำพร้อมลำแสงแทรกเตอร์! (MapleSim Legendary)', colorHex: 0x94A3B8, accentHex: 0x38BDF8, isGachaOnly: true, rarity: 'legendary' },
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
]);
