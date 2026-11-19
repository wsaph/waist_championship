export type GuardReactionType =
  | 'launch'
  | 'flatten'
  | 'spin'
  | 'shock'
  | 'slip'
  | 'panic'
  | 'bonk'
  | 'dance';

export interface GuardPrank {
  id: string;
  icon: string;
  label: string;
  cost: number;
  reaction: GuardReactionType;
  guardSpeech: string;
}

export const GUARD_PRANKS: GuardPrank[] = [
  { id: 'banana_slip', icon: '🍌', label: 'วางเปลือกกล้วย', cost: 15, reaction: 'slip', guardSpeech: 'ว้ายยย! ลื่นเปลือกกล้วยยย!!' },
  { id: 'cream_pie', icon: '🥧', label: 'ปาพายครีมใส่หน้า', cost: 15, reaction: 'bonk', guardSpeech: 'แอ๊บ! มองไม่เห็นทางแล้วว!' },
  { id: 'giant_hammer', icon: '🔨', label: 'ค้อนยางยักษ์ทุบหัว', cost: 20, reaction: 'flatten', guardSpeech: 'แอ้ก!! แบนเป็นกล้วยปิ้งเลย!' },
  { id: 'electric_zap', icon: '⚡', label: 'ปล่อยไฟช็อตจี้เอว', cost: 25, reaction: 'shock', guardSpeech: 'จี๊ดดดด!! ไฟดูดพี่ยามมม!' },
  { id: 'space_kick', icon: '🚀', label: 'เตะส่งขึ้นอวกาศ', cost: 35, reaction: 'launch', guardSpeech: 'ลาก่อนโลกกกก~!!' },
  { id: 'fart_bomb', icon: '💨', label: 'ปล่อยแก๊สพิษใส่', cost: 15, reaction: 'panic', guardSpeech: 'อ้วกก! ใครกินทุเรียนมา!!' },
  { id: 'super_chili', icon: '🌶️', label: 'แอบใส่พริกในหมูกรอบ', cost: 20, reaction: 'panic', guardSpeech: 'เผ็ดดดด!! ขอน้ำหน่อยยย!!' },
  { id: 'balloon_lift', icon: '🎈', label: 'ผูกลูกโป่งลอยฟ้า', cost: 25, reaction: 'launch', guardSpeech: 'เฮ้ยย! เอาพี่ลงไปที!!' },
  { id: 'ice_bucket', icon: '🧊', label: 'สาดน้ำแข็งถังยักษ์', cost: 20, reaction: 'shock', guardSpeech: 'บรื๋อออ! หนาวจนแข็งแล้ว!' },
  { id: 'air_horn', icon: '🎺', label: 'เป่าแตรลมข้างหู', cost: 15, reaction: 'spin', guardSpeech: 'ปู๊นนน!! หูดับหมดแล้วโว้ย!' },
  { id: 'uppercut', icon: '🥊', label: 'ซัดหมัดฮุคหน้าหัน', cost: 25, reaction: 'spin', guardSpeech: 'อุ๊บ! เห็นดาวเต็มฟ้าเลย!' },
  { id: 'flying_kick', icon: '🦵', label: 'เตะก้านคอสายฟ้า', cost: 30, reaction: 'launch', guardSpeech: 'โอ๊ยย! ปลิวติดเพดาน!!' },
  { id: 'angry_chicken', icon: '🐔', label: 'ปล่อยไก่จิกไล่กวด', cost: 15, reaction: 'panic', guardSpeech: 'ช่วยด้วยย! ไก่จิกตูดด!!' },
  { id: 'firecracker', icon: '💣', label: 'โยนประทัดใต้เท้า', cost: 25, reaction: 'launch', guardSpeech: 'ปัง!! ตกใจหมดเลยโว้ยย!' },
  { id: 'spider_web', icon: '🕸️', label: 'ยิงใยแมงมุมพันตัว', cost: 20, reaction: 'spin', guardSpeech: 'แกะไม่ออกก! พันเป็นมัมมี่!' },
  { id: 'trash_bucket', icon: '🪣', label: 'ครอบถังขยะบนหัว', cost: 20, reaction: 'bonk', guardSpeech: 'ป๊องง! ใครปิดไฟเนี่ยย!!' },
  { id: 'rubber_snake', icon: '🐍', label: 'โยนงูยางใส่จานข้าว', cost: 15, reaction: 'panic', guardSpeech: 'กรี๊ดดด! งูเข้าจานหมูกรอบ!' },
  { id: 'cactus_seat', icon: '🌵', label: 'วางกระบองเพชรบนเก้าอี้', cost: 25, reaction: 'launch', guardSpeech: 'จ๊ากกก!! ทิ่มตูดพี่ยาม!!' },
  { id: 'guitar_smash', icon: '🎸', label: 'ฟาดกีตาร์ร็อกใส่', cost: 30, reaction: 'bonk', guardSpeech: 'แกร๊งง! ร็อกเกอร์บุกป้อม!' },
  { id: 'tornado_spell', icon: '🌀', label: 'เสกพายุหมุนพัดปลิว', cost: 35, reaction: 'spin', guardSpeech: 'ติ้วๆๆๆ!! เวียนหัวแล้วว!' },
  { id: 'steal_pork', icon: '🥓', label: 'ฉกหมูกรอบวิ่งหนี', cost: 20, reaction: 'panic', guardSpeech: 'เฮ้ย! เอาหมูกรอบพี่คืนมา!' },
  { id: 'magnet_whistle', icon: '🧲', label: 'ดูดนกหวีดด้วยแม่เหล็ก', cost: 15, reaction: 'spin', guardSpeech: 'อ้าว! นกหวีดบินหนีไปแล้ว!' },
  { id: 'bowling_strike', icon: '🎳', label: 'กลิ้งโบว์ลิ่งชนสไตรค์', cost: 25, reaction: 'flatten', guardSpeech: 'สไตรค์!! ล้มทั้งยืนเลย!' },
  { id: 'ora_barrage', icon: '👊', label: 'รัวหมัดชุดโอร่าโอร่า', cost: 35, reaction: 'bonk', guardSpeech: 'โอ๊ยๆๆๆ! ยอมแล้วจ้าา!!' },
  { id: 'thunder_cloud', icon: '⛈️', label: 'เสกเมฆฟ้าผ่าลงหัว', cost: 35, reaction: 'shock', guardSpeech: 'เปรี้ยง!! หัวฟูเป็นเงาะเลย!' },
  { id: 'net_trap', icon: '🪤', label: 'วางกับดักตาข่ายจับยาม', cost: 25, reaction: 'spin', guardSpeech: 'ติดกับดัก! ปล่อยพี่ออกปาย!' },
  { id: 'trex_roar', icon: '🦖', label: 'เรียกทีเร็กซ์คำรามใส่', cost: 30, reaction: 'panic', guardSpeech: 'โฮกก!! อย่ากินพี่ยามนะ!!' },
  { id: 'pull_chair', icon: '🪑', label: 'ชักเก้าอี้ออกตอนนั่ง', cost: 20, reaction: 'slip', guardSpeech: 'ตุ้บ!! ก้นจ้ำเบ้าเลยย!' },
  { id: 'morlam_dance', icon: '💃', label: 'เปิดหมอลำบังคับเต้น', cost: 25, reaction: 'dance', guardSpeech: 'เอ้าโย่ว! หยุดเต้นไม่ได้!!' },
  { id: 'meteor_drop', icon: '☄️', label: 'เรียกอุกกาบาตถล่มป้อม', cost: 40, reaction: 'flatten', guardSpeech: 'ตูมมม!! ป้อมยามหายไปแล้ว!' },
];

export function pickRandomGuardPranks(count = 6): GuardPrank[] {
  const pool = [...GUARD_PRANKS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
