import { turso } from '@/lib/turso_client';

export const LUNCH_COIN_VALUE = 1;
export const LUNCH_COIN_RESPAWN_MS = 15000;
const LUNCH_COIN_SLOTS = [0];

export interface ActiveLunchCoin {
  slotId: number;
  spawnToken: string;
  x: number;
  z: number;
}

/**
 * ตรวจสอบเวลาประเทศไทย (UTC+7): เปิดศึกแย่งเหรียญเฉพาะวันจันทร์–ศุกร์ เวลา 12:00 – 13:00 น. เท่านั้น!
 */
export function getBangkokLunchRushStatus(nowMs = Date.now()): {
  isLunchRush: boolean;
  bkkDay: number;
  bkkHour: number;
  bkkMinute: number;
} {
  const bkk = new Date(nowMs + 7 * 3600 * 1000);
  const bkkDay = bkk.getUTCDay(); // 0 = อาทิตย์, 1 = จันทร์ ... 5 = ศุกร์, 6 = เสาร์
  const bkkHour = bkk.getUTCHours(); // 12 = 12:00:00 - 12:59:59 เวลาไทย
  const bkkMinute = bkk.getUTCMinutes();
  const isWeekday = bkkDay >= 1 && bkkDay <= 5;
  const isLunchRush = isWeekday && bkkHour === 12;
  return { isLunchRush, bkkDay, bkkHour, bkkMinute };
}

function randomSafeBeachPosition(): { x: number; z: number } {
  const x = Number(((Math.random() - 0.5) * 28).toFixed(2)); // [-14, +14]
  const side = Math.random() < 0.5 ? -1 : 1;
  const z = Number((side * (9.5 + Math.random() * 6.5)).toFixed(2)); // นอกลู่วิ่ง บนหาดทรายทั้งสองฝั่ง
  return { x, z };
}

/**
 * ดึงรายการเหรียญกลางของเซิร์ฟเวอร์ที่ทุกคนต้องแย่งกันเก็บ (สร้างเหรียญใหม่เมื่อถึงเวลาเกิดในช่วง 12:00-13:00 จ.-ศ.)
 */
export async function getOrSpawnLunchCoins(nowMs = Date.now()): Promise<{
  isLunchRush: boolean;
  coins: ActiveLunchCoin[];
}> {
  const { isLunchRush } = getBangkokLunchRushStatus(nowMs);
  if (!isLunchRush) {
    return { isLunchRush: false, coins: [] };
  }

  const res = await turso.execute(`SELECT * FROM arena_coins ORDER BY slot_id ASC`);
  const bySlot = new Map<number, any>();
  for (const r of res.rows) {
    bySlot.set(Number(r.slot_id), r);
  }

  const activeCoins: ActiveLunchCoin[] = [];

  for (const slotId of LUNCH_COIN_SLOTS) {
    const existing = bySlot.get(slotId);
    const isMissing = !existing;
    const isClaimedAndReady =
      existing &&
      existing.claimed_by !== null &&
      existing.claimed_by !== undefined &&
      nowMs >= Number(existing.spawn_at ?? 0);
    // รีเฟรชเหรียญค้างข้ามวันหากเก่าเกิน 2 ชั่วโมง
    const isStale = existing && nowMs - Number(existing.spawn_at ?? 0) > 2 * 3600 * 1000;

    if (isMissing || isClaimedAndReady || isStale) {
      const { x, z } = randomSafeBeachPosition();
      const token = `${nowMs}-${slotId}-${Math.random().toString(36).slice(2, 7)}`;
      await turso.execute({
        sql: `
          INSERT INTO arena_coins (slot_id, spawn_token, pos_x, pos_z, spawn_at, claimed_by)
          VALUES (?, ?, ?, ?, ?, NULL)
          ON CONFLICT(slot_id) DO UPDATE SET
            spawn_token = excluded.spawn_token,
            pos_x = excluded.pos_x,
            pos_z = excluded.pos_z,
            spawn_at = excluded.spawn_at,
            claimed_by = NULL
        `,
        args: [slotId, token, x, z, nowMs],
      });
      activeCoins.push({ slotId, spawnToken: token, x, z });
    } else if (existing.claimed_by === null || existing.claimed_by === undefined) {
      activeCoins.push({
        slotId,
        spawnToken: String(existing.spawn_token),
        x: Number(existing.pos_x),
        z: Number(existing.pos_z),
      });
    }
  }

  return { isLunchRush: true, coins: activeCoins };
}
