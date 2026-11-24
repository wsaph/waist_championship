import { computeFestivalPhase } from '../schedule';
import type { FestivalDefinition, FestivalPhase, FestivalSchedule } from '../types';

export type KrathongStyleId =
  | 'my_character'
  | 'moo_deng'
  | 'capybara_yuzu'
  | 'corgi_butt'
  | 'orange_cat'
  | 'bunny_mochi'
  | 'guard_pork'
  | 'shabu_pot'
  | 'dragon_gold'
  | 'unicorn_pastel'
  | 'lotus_classic'
  | 'banana_leaf';

export interface KrathongStyleMeta {
  id: KrathongStyleId;
  name: string;
  shortName: string;
  emoji: string;
  desc: string;
  accentHex: string;
  badge?: string;
}

export interface KrathongItem {
  id: string | number;
  userId: number | null;
  userName: string;
  userEmoji: string;
  styleId: KrathongStyleId;
  caption: string;
  avatarColor: string;
  avatarBand: string;
  avatarSpecies: string;
  orbitSeed: number;
  laneOffset: number;
  startX?: number | null;
  startZ?: number | null;
  createdAt: number;
  isAmbientNpc?: boolean;
}

export interface KrathongLaunchInput {
  styleId: KrathongStyleId;
  caption: string;
}

export const LOY_KRATHONG_FESTIVAL_ID = 'loy_krathong';
export const LOY_KRATHONG_YT_ID = '95s3Y8nVMV4';
export const LOY_KRATHONG_BGM_TRACK_ID = 'loy_krathong';
export const LOY_KRATHONG_REALTIME_EVENT = 'krathong_launched';

// คืนวันลอยกระทงสด: ยาวถึงเช้าวันที่ 25 พ.ย. 2026 เวลา 07:00 น. (เวลาไทย)
export const LOY_KRATHONG_LIVE_END_MS = Date.parse('2026-11-25T07:00:00+07:00');
// ช่วงปุ่ม "ควันหลงคืนลอยกระทง" (1 วันหลังวันลอยกระทง): 25 พ.ย. 07:00 น. ถึง 26 พ.ย. 2026 เวลา 07:00 น.
export const LOY_KRATHONG_ENCORE_END_MS = Date.parse('2026-11-26T07:00:00+07:00');

export const LOY_KRATHONG_SCHEDULE: FestivalSchedule = {
  liveEndMs: LOY_KRATHONG_LIVE_END_MS,
  encoreEndMs: LOY_KRATHONG_ENCORE_END_MS,
};

export type LoyKrathongEventPhase = FestivalPhase;

export function getLoyKrathongPhase(nowMs: number = Date.now()): LoyKrathongEventPhase {
  return computeFestivalPhase(LOY_KRATHONG_SCHEDULE, nowMs);
}

export const LOY_KRATHONG_DEFINITION: FestivalDefinition = {
  id: LOY_KRATHONG_FESTIVAL_ID,
  priority: 10,
  nameTh: 'เทศกาลวันลอยกระทง',
  nameEn: 'Loy Krathong Full Moon Festival',
  emoji: '🪷',
  apiBasePath: '/api/festivals/loy_krathong',
  realtimeEvents: [LOY_KRATHONG_REALTIME_EVENT],
  schedule: LOY_KRATHONG_SCHEDULE,
  weatherOverride: {
    skyHex: 0x08122e,
    lightHex: 0xfef3c7,
    hemiIntensity: 0.68,
    dirIntensity: 0.88,
    isRaining: false,
    showNightSky: true,
    oceanColorHex: 0x072b59,
    oceanEmissiveHex: 0x0c4a6e,
    cloudColorHex: 0x475569,
  },
  bgm: {
    trackId: LOY_KRATHONG_BGM_TRACK_ID,
    youtubeVideoId: LOY_KRATHONG_YT_ID,
    volume: 55,
    buttonLabel: 'เพลงลอยกระทง',
    buttonTitle: 'เปิด/ปิดเพลงลอยกระทงประกอบฉาก',
    mobileOnLabel: 'ปิดเพลงลอยกระทง',
    mobileOffLabel: 'เปิดเพลงลอยกระทง',
    autoPlayOnLiveInteraction: true,
  },
  hud: {
    liveActiveIcon: '🌕',
    liveActiveLabel: 'คืนวันเพ็ญ',
    liveInactiveIcon: '🌤️',
    liveInactiveLabel: 'อากาศจริง',
    liveToggleTitle: 'คลิกสลับโหมดท้องฟ้าคืนวันเพ็ญลอยกระทง / สภาพอากาศจริง',
    encoreActiveIcon: '☀️',
    encoreActiveLabel: 'กลับเกาะปกติ',
    encoreInactiveIcon: '🪷',
    encoreInactiveLabel: 'ควันหลงลอยกระทง',
    encoreToggleTitle:
      'ย้อนบรรยากาศคืนวันเพ็ญ ชมกระทงของเพื่อนๆ และร่วมลอยกระทงย้อนหลังได้ 1 วัน!',
    encoreActivatedToast: {
      emoji: '🪷',
      title: 'เปิดโหมดควันหลงคืนวันลอยกระทง!',
      text: 'ย้อนชมพระจันทร์เต็มดวงและขบวนกระทงของเพื่อนๆ รอบเกาะ หรือเดินไปริมน้ำเพื่อลอยตามหลังได้เลย ✨',
    },
    mobileActiveIcon: '☀️',
    mobileActiveLabel: 'กลับสู่โหมดเกาะปกติ',
    mobileLiveInactiveIcon: '🪷',
    mobileLiveInactiveLabel: 'เปิดโหมดคืนวันเพ็ญ',
    mobileEncoreInactiveIcon: '🪷',
    mobileEncoreInactiveLabel: 'ควันหลงคืนลอยกระทง',
    busyModalLabel: '🪷 กำลังอธิษฐานลอยกระทง...',
  },
};

export const KRATHONG_STYLES: KrathongStyleMeta[] = [
  {
    id: 'my_character',
    name: 'กระทงมาสคอตตัวฉัน',
    shortName: 'ธีมตัวฉัน',
    emoji: '✨',
    desc: 'ปั้นตุ๊กตาจิ๋วตามสีตัวละครและสายพันธุ์ของคุณนั่งกลางกระทงดอกบัว!',
    accentHex: '#F472B6',
    badge: 'แนะนำ',
  },
  {
    id: 'moo_deng',
    name: 'กระทงหมูเด้งแก้มชมพู',
    shortName: 'หมูเด้ง',
    emoji: '🦛',
    desc: 'น้องฮิปโปหมูเด้งอ้าปากเด้งดึ๋งบนใบบัวเขียวสด น่ารักไวรัลทั่วเกาะ',
    accentHex: '#EC4899',
    badge: 'ฮิตสุด',
  },
  {
    id: 'capybara_yuzu',
    name: 'กระทงคาปิบาร่าออนเซ็นส้ม',
    shortName: 'คาปิบาร่า',
    emoji: '🍊',
    desc: 'น้องกะปิปลาร่าแช่อ่างไม้ฮิโนกิ เทินส้มยูซุบนหัวแบบปล่อยจอยสุดชิล',
    accentHex: '#F97316',
  },
  {
    id: 'corgi_butt',
    name: 'กระทงคอร์กี้ก้นเด้ง',
    shortName: 'คอร์กี้',
    emoji: '🐶',
    desc: 'น้องคอร์กี้หูตั้งนอนหมอบโชว์อุ้งเท้าชมพูบนกระทงขนมปังหอมกรุ่น',
    accentHex: '#F59E0B',
  },
  {
    id: 'orange_cat',
    name: 'กระทงต้าวแมวส้มกอดปลาทู',
    shortName: 'แมวส้ม',
    emoji: '🐱',
    desc: 'เหมียวส้มพุงป่องนอนกอดปลาทูทองคำข้างแสงเทียนอบอุ่น',
    accentHex: '#FB923C',
  },
  {
    id: 'bunny_mochi',
    name: 'กระทงกระต่ายแก้มโมจิ',
    shortName: 'กระต่ายโมจิ',
    emoji: '🐰',
    desc: 'กระต่ายขาวปุ๊กปิ๊กหูชมพู ประดับกลีบซากุระ ดังโงะ และแครอทจิ๋ว',
    accentHex: '#F9A8D4',
  },
  {
    id: 'guard_pork',
    name: 'กระทงพี่ยามหมูกรอบ',
    shortName: 'พี่ยามหมูกรอบ',
    emoji: '👮',
    desc: 'ซิกเนเจอร์ประจำเกาะ! หมวกพี่ยามคู่จานหมูกรอบทองคำและส้อมเงิน',
    accentHex: '#EAB308',
    badge: 'ตำนานเกาะ',
  },
  {
    id: 'shabu_pot',
    name: 'กระทงหม้อไฟชาบูสองใจ',
    shortName: 'หม้อชาบู',
    emoji: '🍲',
    desc: 'หม้อชาบูซุปหมาล่า-น้ำใส ลอยแคลอรี่และไขมันส่วนเกินทิ้งลงทะเล!',
    accentHex: '#EF4444',
  },
  {
    id: 'dragon_gold',
    name: 'กระทงมังกรทองมงคล',
    shortName: 'มังกรทอง',
    emoji: '🐉',
    desc: 'กระทงเกล็ดมังกรแดง-ทองสุดอลังการ เสริมพลังกายและดวงเฮง',
    accentHex: '#FACC15',
  },
  {
    id: 'unicorn_pastel',
    name: 'กระทงยูนิคอร์นสายรุ้ง',
    shortName: 'ยูนิคอร์น',
    emoji: '🦄',
    desc: 'ปุยเมฆพาสเทลฟรุ้งฟริ้ง เขาเกลียวทองเรืองแสงและดวงดาววิบวับ',
    accentHex: '#C084FC',
  },
  {
    id: 'lotus_classic',
    name: 'กระทงดอกบัวชมพูมงคล',
    shortName: 'ดอกบัวชมพู',
    emoji: '🪷',
    desc: 'กลีบบัวหลวงสีชมพูซ้อนฟูละมุน ประดับดาวเรือง ธูปเทียนทองคลาสสิก',
    accentHex: '#FB7185',
  },
  {
    id: 'banana_leaf',
    name: 'กระทงใบตองพับกลีบ',
    shortName: 'ใบตองไทย',
    emoji: '🌿',
    desc: 'ใบตองเขียวสดพับกลีบประณีต แต่งดอกดาวเรืองและกล้วยไม้ม่วง',
    accentHex: '#22C55E',
  },
];

export const KRATHONG_PRESET_WISHES: string[] = [
  'ขอให้พุงยุบ เอวเอสก่อนสิ้นปี! 🔥',
  'ลอยแคลอรี่ทิ้งทะเล พรุ่งนี้ค่อยลด! 🧋',
  'หมูกรอบจงลอยไป ซิกแพคจงลอยมา 💪',
  'ขอให้เดินครบเป้า สุขภาพแข็งแรงทุกวัน 👟',
  'ขอให้สุ่มกาชาได้ของแรร์ เกลือไม่ถามหา ✨',
  'กินชาบูเท่าไหร่ก็ขอให้ไม่อ้วน เพี้ยง! 🍲',
  'ลอยความเหนื่อยทิ้งไป ขอมีแรงฟิตหุ่นต่อ 🌈',
  'ขอให้ทุกคนบนเกาะมีความสุข สมหวังทุกเรื่อง 🪷',
];

const BASE_ANCHOR_MS = 1732450000000;

export const AMBIENT_NPC_KRATHONGS: KrathongItem[] = [
  {
    id: 'npc-guard',
    userId: null,
    userName: 'พี่ยามคุมลู่',
    userEmoji: '👮',
    styleId: 'guard_pork',
    caption: 'ขอให้ไม่มีคนแอบลัดสนาม! (แต่หมูกรอบร้านนี้อร่อยจริง)',
    avatarColor: '#18181B',
    avatarBand: '#FFE600',
    avatarSpecies: 'human',
    orbitSeed: 0.03,
    laneOffset: 4.8,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
  {
    id: 'npc-moodeng',
    userId: null,
    userName: 'น้องหมูเด้ง',
    userEmoji: '🦛',
    styleId: 'moo_deng',
    caption: 'สวบกะละมังแล้วขอให้พุงเด้งน่ารักตลอดไป เพี้ยง! 🥬',
    avatarColor: '#9D7B8D',
    avatarBand: '#F472B6',
    avatarSpecies: 'hippo',
    orbitSeed: 0.11,
    laneOffset: 6.8,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
  {
    id: 'npc-kaokua',
    userId: null,
    userName: 'น้องข้าวคั่ว',
    userEmoji: '🐺',
    styleId: 'corgi_butt',
    caption: 'โฮ่ง! ขอหมูย่าง 10 ไม้ทุกวัน กับคนมาเกาพุงเยอะๆ 🍖',
    avatarColor: '#64748B',
    avatarBand: '#38BDF8',
    avatarSpecies: 'husky',
    orbitSeed: 0.2,
    laneOffset: 5.5,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
  {
    id: 'npc-capybara',
    userId: null,
    userName: 'กะปิปลาร้า',
    userEmoji: '🍊',
    styleId: 'capybara_yuzu',
    caption: 'ปล่อยจอยปล่อยใจ แคลอรี่เป็นเรื่องสมมติ... 🍊✨',
    avatarColor: '#B45309',
    avatarBand: '#FDE68A',
    avatarSpecies: 'capybara',
    orbitSeed: 0.29,
    laneOffset: 7.6,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
  {
    id: 'npc-orangecat',
    userId: null,
    userName: 'น้องส้มคาเฟ่',
    userEmoji: '🐱',
    styleId: 'orange_cat',
    caption: 'ลอยก้างปลาทู ขอขนมแมวเลียซองใหญ่ให้เหมียวด้วย~ 🐟',
    avatarColor: '#FB923C',
    avatarBand: '#FFFBEB',
    avatarSpecies: 'orange_cat',
    orbitSeed: 0.37,
    laneOffset: 4.9,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
  {
    id: 'npc-bunny',
    userId: null,
    userName: 'กระต่ายแก้มโมจิ',
    userEmoji: '🐰',
    styleId: 'bunny_mochi',
    caption: 'ขอให้ปีนี้วิ่งไวตัวเบา เข้าเส้นชัยเป็นคนแรก! 🌸',
    avatarColor: '#F8FAFC',
    avatarBand: '#F472B6',
    avatarSpecies: 'bunny',
    orbitSeed: 0.46,
    laneOffset: 6.4,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
  {
    id: 'npc-shabu',
    userId: null,
    userName: 'ชมรมคนรักชาบู',
    userEmoji: '🍲',
    styleId: 'shabu_pot',
    caption: 'น้ำซุปหมาล่าจงพาไขมันลอยออกทะเลไปเลยยย 🌶️',
    avatarColor: '#EF4444',
    avatarBand: '#FACC15',
    avatarSpecies: 'mini_pig',
    orbitSeed: 0.55,
    laneOffset: 8.1,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
  {
    id: 'npc-dragon',
    userId: null,
    userName: 'มังกรเพลิงทอง',
    userEmoji: '🐉',
    styleId: 'dragon_gold',
    caption: 'พ่นไฟเบิร์นแคลอรี่ ขอให้ชาวเกาะสุขภาพปังทุกคน! 🔥',
    avatarColor: '#DC2626',
    avatarBand: '#FACC15',
    avatarSpecies: 'dragon',
    orbitSeed: 0.64,
    laneOffset: 5.3,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
  {
    id: 'npc-lotus',
    userId: null,
    userName: 'นางฟ้าสายคลีน',
    userEmoji: '🪷',
    styleId: 'lotus_classic',
    caption: 'อธิษฐานให้หลับเต็มอิ่ม ตื่นมาสดใสเอวบางร่างน้อย 💖',
    avatarColor: '#F472B6',
    avatarBand: '#FFFFFF',
    avatarSpecies: 'bunny',
    orbitSeed: 0.73,
    laneOffset: 7.1,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
  {
    id: 'npc-unicorn',
    userId: null,
    userName: 'โพนี่สายรุ้ง',
    userEmoji: '🦄',
    styleId: 'unicorn_pastel',
    caption: 'ขอให้ความสุขเปล่งประกายเหมือนแสงเทียนคืนลอยกระทง ✨',
    avatarColor: '#FFF1F2',
    avatarBand: '#F472B6',
    avatarSpecies: 'unicorn',
    orbitSeed: 0.82,
    laneOffset: 5.8,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
  {
    id: 'npc-banana',
    userId: null,
    userName: 'โค้ชเต่าสปีดต้น',
    userEmoji: '🐢',
    styleId: 'banana_leaf',
    caption: 'เดินวันละนิด จิตแจ่มใส ไปถึงเส้นชัยด้วยกันนะทุกคน 🌿',
    avatarColor: '#65A30D',
    avatarBand: '#FEF08A',
    avatarSpecies: 'turtle_pet',
    orbitSeed: 0.91,
    laneOffset: 7.5,
    createdAt: BASE_ANCHOR_MS,
    isAmbientNpc: true,
  },
];

export function isValidKrathongStyle(id: unknown): id is KrathongStyleId {
  return typeof id === 'string' && KRATHONG_STYLES.some((s) => s.id === id);
}

export function getKrathongStyleMeta(id?: string): KrathongStyleMeta {
  return (
    KRATHONG_STYLES.find((s) => s.id === id) ||
    KRATHONG_STYLES.find((s) => s.id === 'lotus_classic') ||
    KRATHONG_STYLES[0]
  );
}

export function mergeWithAmbientKrathongs(serverItems: readonly KrathongItem[]): KrathongItem[] {
  const seen = new Set<string>();
  const merged: KrathongItem[] = [];
  for (const item of serverItems) {
    if (!item || item.id === undefined || item.id === null) continue;
    const k = String(item.id);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(item);
  }
  for (const npc of AMBIENT_NPC_KRATHONGS) {
    const k = String(npc.id);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(npc);
  }
  return merged;
}

export function mapRowToKrathong(row: Record<string, unknown>): KrathongItem {
  const rawStyle = String(row.style_id || 'lotus_classic');
  const styleId: KrathongStyleId = isValidKrathongStyle(rawStyle) ? rawStyle : 'lotus_classic';
  const rawOrbitSeed = Number(row.orbit_seed ?? 0);
  const rawLaneOffset = Number(row.lane_offset ?? 5.4);
  const rawStartX = row.start_x !== null && row.start_x !== undefined ? Number(row.start_x) : null;
  const rawStartZ = row.start_z !== null && row.start_z !== undefined ? Number(row.start_z) : null;

  return {
    id: Number(row.id),
    userId: row.user_id !== null && row.user_id !== undefined ? Number(row.user_id) : null,
    userName: String(row.user_name || 'นักเดินทางริมหาด'),
    userEmoji: String(row.user_emoji || '🪷'),
    styleId,
    caption: String(row.caption || ''),
    avatarColor: String(row.avatar_color || '#F472B6'),
    avatarBand: String(row.avatar_band || '#FFE600'),
    avatarSpecies: String(row.avatar_species || 'bunny'),
    orbitSeed: Number.isFinite(rawOrbitSeed) ? rawOrbitSeed : 0,
    laneOffset: Number.isFinite(rawLaneOffset) ? rawLaneOffset : 5.4,
    startX: rawStartX !== null && Number.isFinite(rawStartX) ? rawStartX : null,
    startZ: rawStartZ !== null && Number.isFinite(rawStartZ) ? rawStartZ : null,
    createdAt: Number(row.created_at || Date.now()),
  };
}

export interface SanitizedKrathongPayload {
  uid: number | null;
  styleId: KrathongStyleId;
  cleanCaption: string;
  userName: string;
  userEmoji: string;
  avatarColor: string;
  avatarBand: string;
  avatarSpecies: string;
  orbitSeed: number;
  laneOffset: number;
  startX: number | null;
  startZ: number | null;
}

export function sanitizeKrathongLaunchPayload(
  body: Record<string, unknown>
): SanitizedKrathongPayload {
  const rawUid = Number(body.userId);
  const uid = Number.isFinite(rawUid) && rawUid > 0 ? Math.trunc(rawUid) : null;

  const styleId: KrathongStyleId = isValidKrathongStyle(body.styleId)
    ? body.styleId
    : 'lotus_classic';

  const cleanCaption = String(body.caption ?? '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 75);

  const userName =
    String(body.userName || 'นักเดินทางริมหาด').trim().slice(0, 32) || 'นักเดินทางริมหาด';
  const userEmoji = String(body.userEmoji || '🪷').trim().slice(0, 8) || '🪷';
  const avatarColor = String(body.avatarColor || '#F472B6').trim().slice(0, 16) || '#F472B6';
  const avatarBand = String(body.avatarBand || '#FFE600').trim().slice(0, 16) || '#FFE600';
  const avatarSpecies = String(body.avatarSpecies || 'bunny').trim().slice(0, 32) || 'bunny';

  const rawSeed =
    body.orbitSeed !== null && body.orbitSeed !== undefined && body.orbitSeed !== ''
      ? Number(body.orbitSeed)
      : NaN;
  const orbitSeed = Number.isFinite(rawSeed)
    ? Math.max(0, Math.min(0.9999, rawSeed))
    : Number(Math.random().toFixed(4));

  const rawLane =
    body.laneOffset !== null && body.laneOffset !== undefined && body.laneOffset !== ''
      ? Number(body.laneOffset)
      : NaN;
  const laneOffset = Number.isFinite(rawLane)
    ? Math.max(3.6, Math.min(8.8, rawLane))
    : Number((4.0 + Math.random() * 4.2).toFixed(2));

  const parsedStartX =
    body.startX !== null && body.startX !== undefined && body.startX !== ''
      ? Number(body.startX)
      : NaN;
  const parsedStartZ =
    body.startZ !== null && body.startZ !== undefined && body.startZ !== ''
      ? Number(body.startZ)
      : NaN;

  const startX = Number.isFinite(parsedStartX) ? Number(parsedStartX.toFixed(2)) : null;
  const startZ = Number.isFinite(parsedStartZ) ? Number(parsedStartZ.toFixed(2)) : null;

  return {
    uid,
    styleId,
    cleanCaption,
    userName,
    userEmoji,
    avatarColor,
    avatarBand,
    avatarSpecies,
    orbitSeed,
    laneOffset,
    startX,
    startZ,
  };
}
