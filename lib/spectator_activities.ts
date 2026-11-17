export interface SpectatorActivity {
  label: string;
  animType:
    | 'dumbbell'
    | 'squat'
    | 'pullup'
    | 'pushup'
    | 'situp'
    | 'cheer'
    | 'boxing'
    | 'badminton'
    | 'picnic_shabu'
    | 'eat_pizza'
    | 'boba_tea'
    | 'food_roll'
    | 'phone_scroll'
    | 'play_cards';
}

export const FIT_ACTIVITIES: SpectatorActivity[] = [
  { label: '🏋️ ยกดัมเบลปั๊มกล้าม', animType: 'dumbbell' },
  { label: '🦵 สควอทปั้นก้น', animType: 'squat' },
  { label: '🤸‍♂️ ดึงข้อบาร์เดี่ยว', animType: 'pullup' },
  { label: '💪 วิดพื้นท้าลม', animType: 'pushup' },
  { label: '🧘‍♂️ ซิทอัพปั้นซิกแพค', animType: 'situp' },
  { label: '📣 เชียร์สุดใจข้างสนาม', animType: 'cheer' },
  { label: '🥊 ชกลมคาร์ดิโอ', animType: 'boxing' },
  { label: '🏸 ซ้อมตีแบด', animType: 'badminton' },
  { label: '🏋️ ไหล่ติดดัมเบล', animType: 'dumbbell' },
  { label: '🦵 สควอท 100 ที', animType: 'squat' },
  { label: '💪 วิดพื้นมือเดียว (มโน)', animType: 'pushup' },
  { label: '🤸‍♂️ โหนบาร์ยืดหลัง', animType: 'pullup' },
  { label: '🧘‍♂️ ซิทอัพสู้ชีวิต', animType: 'situp' },
  { label: '🥊 ต่อยกระสอบลม', animType: 'boxing' },
  { label: '📣 ตะโกนเชียร์เพื่อน', animType: 'cheer' },
  { label: '🏋️ เล่นแขนหน้า', animType: 'dumbbell' },
  { label: '🦵 ลันจ์ข้างสนาม', animType: 'squat' },
  { label: '💪 แพลงก์สลับวิดพื้น', animType: 'pushup' },
  { label: '🤸‍♂️ ดึงข้อโชว์พาว', animType: 'pullup' },
  { label: '🧘‍♂️ ครันช์หน้าท้อง', animType: 'situp' },
  { label: '🥊 แย็บซ้ายแย็บขวา', animType: 'boxing' },
  { label: '🏸 วอร์มข้อมือตีแบด', animType: 'badminton' },
  { label: '📣 โบกมือให้กำลังใจ', animType: 'cheer' },
  { label: '🏋️ ยกเวทเบาๆ', animType: 'dumbbell' },
  { label: '🦵 ย่อเข่าเผาผลาญ', animType: 'squat' },
  { label: '💪 วิดพื้นแบบโปร', animType: 'pushup' },
  { label: '🤸‍♂️ บาร์โหนสายสตรอง', animType: 'pullup' },
  { label: '🧘‍♂️ ซิทอัพไม่พัก', animType: 'situp' },
  { label: '🥊 มวยไทยข้างลู่วิ่ง', animType: 'boxing' },
  { label: '📱 พักดูคลิปสอนออกกำลัง', animType: 'phone_scroll' },
];

export const EAT_ACTIVITIES: SpectatorActivity[] = [
  { label: '🍲 นั่งปิกนิกกินชาบู', animType: 'picnic_shabu' },
  { label: '🍕 กินพิซซ่าหน้าชีสเยิ้ม', animType: 'eat_pizza' },
  { label: '🧋 ยืนดูดชานมไข่มุก', animType: 'boba_tea' },
  { label: '😴 นอนกลิ้งพุงป่อง', animType: 'food_roll' },
  { label: '📱 นอนไถมือถือสั่งของกิน', animType: 'phone_scroll' },
  { label: '🍲 จุ่มหมูสามชั้นชาบู', animType: 'picnic_shabu' },
  { label: '🍕 พิซซ่าถาดใหญ่คนเดียว', animType: 'eat_pizza' },
  { label: '🧋 ชาไทยหวาน 100%', animType: 'boba_tea' },
  { label: '😴 อิ่มจนลุกไม่ขึ้น', animType: 'food_roll' },
  { label: '📱 ส่องรีวิวบุฟเฟต์', animType: 'phone_scroll' },
  { label: '🍲 ซดน้ำซุปหมาล่า', animType: 'picnic_shabu' },
  { label: '🍕 พิซซ่าขอบชีส', animType: 'eat_pizza' },
  { label: '🧋 บุกไข่มุกเพิ่ม 2 ช้อน', animType: 'boba_tea' },
  { label: '😴 กลิ้งไปกลิ้งมาชิลๆ', animType: 'food_roll' },
  { label: '📱 กดโค้ดส่วนลดอาหาร', animType: 'phone_scroll' },
  { label: '🍲 ปิกนิกหม้อไฟข้างลู่', animType: 'picnic_shabu' },
  { label: '🍕 กินพิซซ่ายั่วคนวิ่ง', animType: 'eat_pizza' },
  { label: '🧋 ชานมปั่นวิปครีม', animType: 'boba_tea' },
  { label: '😴 นอนผึ่งพุงรับลม', animType: 'food_roll' },
  { label: '📱 ไถฟีดดูของหวาน', animType: 'phone_scroll' },
  { label: '🍲 ลวกเนื้อวากิว', animType: 'picnic_shabu' },
  { label: '🍕 พิซซ่าเปปเปอโรนี', animType: 'eat_pizza' },
  { label: '🧋 ชาเขียวมัทฉะไข่มุก', animType: 'boba_tea' },
  { label: '😴 กลิ้งหนีการออกกำลัง', animType: 'food_roll' },
  { label: '📱 รอไรเดอร์มาส่งข้าว', animType: 'phone_scroll' },
  { label: '🍲 จิ้มน้ำจิ้มสุกี้ฟินๆ', animType: 'picnic_shabu' },
  { label: '🍕 กินพิซซ่าคำโต', animType: 'eat_pizza' },
  { label: '🧋 ยืนจิบชานมเชียร์เพื่อน', animType: 'boba_tea' },
  { label: '😴 นอนย่อยหลังมื้อใหญ่', animType: 'food_roll' },
  { label: '📱 ถ่ายรูปของกินลงสตอรี่', animType: 'phone_scroll' },
  { label: '🃏 ตั้งวงจั่วไพ่แก้เบื่อ', animType: 'play_cards' },
];

export function isEatPath(workoutType?: string): boolean {
  if (!workoutType) return false;
  if (workoutType === 'eat') return true;
  return ['picnic_shabu', 'eat_pizza', 'boba_tea', 'food_roll'].includes(workoutType);
}

/**
 * Returns YYYY-MM-DD that flips at 07:00 AM Asia/Bangkok (UTC+7),
 * which corresponds directly to 00:00 UTC.
 */
export function getBangkok7AmDayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function getDailySpectatorActivity(
  userId: number,
  workoutType: string | undefined,
  samePathCount: number,
  indexInPath: number
): SpectatorActivity {
  const eat = isEatPath(workoutType);
  const dayKey = getBangkok7AmDayKey();
  const list = eat ? EAT_ACTIVITIES : FIT_ACTIVITIES;

  // Group activity surprise when there are >= 2 spectators on the same path
  if (samePathCount >= 2) {
    const groupSeed = hashString(`${dayKey}-${eat ? 'eat' : 'fit'}-group`);
    if (groupSeed % 3 === 0) {
      if (!eat && indexInPath < 2) {
        return { label: '🏸 ตีแบดคู่ข้างสนาม!', animType: 'badminton' };
      }
      if (eat && indexInPath < 4) {
        return groupSeed % 2 === 0
          ? { label: '🍲 ตั้งวงชาบูหลายคน!', animType: 'picnic_shabu' }
          : { label: '🃏 ตั้งวงเล่นไพ่ข้างสนาม!', animType: 'play_cards' };
      }
    }
  }

  const idx = hashString(`${dayKey}-user-${userId}`) % list.length;
  return list[idx];
}
