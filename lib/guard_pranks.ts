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
  { id: 'giant_hammer', icon: '🔨', label: 'ค้อนยางยักษ์ทุบหัว', cost: 20, reaction: 'flatten', guardSpeech: 'แอ้ก!! แบนเป็นกล้วยปิ้งเลย!' },
  { id: 'balloon_lift', icon: '🎈', label: 'ผูกลูกโป่งลอยฟ้า', cost: 25, reaction: 'launch', guardSpeech: 'เฮ้ยย! เอาพี่ลงไปที!!' },
  { id: 'ice_bucket', icon: '🧊', label: 'แช่แข็งก้อนน้ำแข็ง', cost: 20, reaction: 'shock', guardSpeech: 'บรื๋อออ! หนาวจนแข็งแล้ว!' },
  { id: 'thunder_cloud', icon: '⛈️', label: 'เสกเมฆฟ้าผ่าลงหัว', cost: 30, reaction: 'shock', guardSpeech: 'เปรี้ยง!! หัวฟูเป็นเงาะเลย!' },
  { id: 'meteor_drop', icon: '☄️', label: 'เรียกอุกกาบาตถล่ม', cost: 35, reaction: 'flatten', guardSpeech: 'ตูมมม!! ป้อมยามหายไปแล้ว!' },
  { id: 'tornado_spell', icon: '🌀', label: 'เสกพายุทอร์นาโด', cost: 30, reaction: 'spin', guardSpeech: 'ติ้วๆๆๆ!! เวียนหัวแล้วว!' },
  { id: 'trash_bucket', icon: '🪣', label: 'ครอบถังขยะบนหัว', cost: 15, reaction: 'bonk', guardSpeech: 'ป๊องง! ใครปิดไฟเนี่ยย!!' },
  { id: 'cream_pie', icon: '🥧', label: 'ปาพายครีมใส่หน้า', cost: 15, reaction: 'bonk', guardSpeech: 'แอ๊บ! มองไม่เห็นทางแล้วว!' },
  { id: 'fart_bomb', icon: '💨', label: 'ปล่อยแก๊สทุเรียนพิษ', cost: 15, reaction: 'panic', guardSpeech: 'อ้วกก! ใครกินทุเรียนมา!!' },
  { id: 'space_kick', icon: '🚀', label: 'ติดจรวดส่งอวกาศ', cost: 35, reaction: 'launch', guardSpeech: 'ลาก่อนโลกกกก~!!' },
  { id: 'morlam_dance', icon: '💃', label: 'เปิดหมอลำบังคับเต้น', cost: 25, reaction: 'dance', guardSpeech: 'เอ้าโย่ว! หยุดเต้นไม่ได้!!' },
];

export function pickRandomGuardPranks(count = 6): GuardPrank[] {
  const pool = [...GUARD_PRANKS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
