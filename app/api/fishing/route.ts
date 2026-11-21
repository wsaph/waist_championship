import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import {
  FISHING_DAILY_REWARD_LIMIT,
  rollFishingCatch,
  rollGuardTrollCatch,
} from '@/lib/fishing_catalog';

function getBangkok7AmDayKey(nowMs: number = Date.now()): string {
  // Shift by UTC+7 then subtract 7 hours => UTC+0 date changes right at 07:00 Bangkok time
  const shifted = new Date(nowMs);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

let fishingTableReady = false;

async function ensureFishingTable() {
  if (fishingTableReady) return;
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS fishing_daily_counts (
      user_id INTEGER NOT NULL,
      day_key TEXT NOT NULL,
      catch_count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, day_key)
    )
  `);
  fishingTableReady = true;
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    const uid = Number(userId);
    const caught = rollFishingCatch();

    if (!uid || uid <= 0) {
      return NextResponse.json({
        success: true,
        caught,
        coinsEarned: 0,
        points: null,
        dailyRewardCount: 0,
        dailyRewardLimit: FISHING_DAILY_REWARD_LIMIT,
        guestMode: true,
      });
    }

    await ensureFishingTable();

    const userRes = await turso.execute({
      sql: 'SELECT id, name, points FROM users WHERE id = ?',
      args: [uid],
    });
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้เล่นนี้' }, { status: 404 });
    }

    const currentPoints = Number(userRes.rows[0].points ?? 100);
    const dayKey = getBangkok7AmDayKey();

    const countRes = await turso.execute({
      sql: 'SELECT catch_count FROM fishing_daily_counts WHERE user_id = ? AND day_key = ?',
      args: [uid, dayKey],
    });
    const prevCount = countRes.rows.length > 0 ? Number(countRes.rows[0].catch_count ?? 0) : 0;

    if (prevCount >= FISHING_DAILY_REWARD_LIMIT) {
      const trollCatch = rollGuardTrollCatch();
      return NextResponse.json({
        success: true,
        caught: trollCatch,
        coinsEarned: 0,
        points: currentPoints,
        dailyRewardCount: prevCount,
        dailyRewardLimit: FISHING_DAILY_REWARD_LIMIT,
        quotaReached: true,
      });
    }

    const nextCount = prevCount + 1;
    const nextPoints = currentPoints + caught.coins;

    await turso.execute({
      sql: `
        INSERT INTO fishing_daily_counts (user_id, day_key, catch_count)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, day_key) DO UPDATE SET catch_count = excluded.catch_count
      `,
      args: [uid, dayKey, nextCount],
    });

    await turso.execute({
      sql: 'UPDATE users SET points = ? WHERE id = ?',
      args: [nextPoints, uid],
    });

    return NextResponse.json({
      success: true,
      caught,
      coinsEarned: caught.coins,
      points: nextPoints,
      dailyRewardCount: nextCount,
      dailyRewardLimit: FISHING_DAILY_REWARD_LIMIT,
      quotaReached: false,
    });
  } catch (error) {
    console.error('POST /api/fishing error:', error);
    return NextResponse.json({ error: 'ตกปลาไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
