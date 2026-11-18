import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import {
  getBangkokLunchRushStatus,
  getOrSpawnLunchCoins,
  LUNCH_COIN_RESPAWN_MS,
  LUNCH_COIN_VALUE,
} from '@/lib/lunch_coins';

const DAILY_CHECKIN_BONUS = 10;

export async function GET() {
  try {
    const state = await getOrSpawnLunchCoins();
    return NextResponse.json(state, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('GET /api/rewards error:', error);
    return NextResponse.json({ isLunchRush: false, coins: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, type, slotId, spawnToken } = await req.json();
    const uid = Number(userId);
    if (!uid || uid <= 0) {
      return NextResponse.json(
        { error: 'กรุณาเข้าสู่ระบบหรือเลือกตัวละครก่อนรับเหรียญรางวัล' },
        { status: 400 }
      );
    }

    const userRes = await turso.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [uid],
    });
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้เล่นนี้' }, { status: 404 });
    }
    const user = userRes.rows[0];
    const currentPoints = Number(user.points ?? 100);
    const todayKey = new Date().toISOString().slice(0, 10);

    if (type === 'daily_checkin') {
      const lastDate = String(user.last_checkin_date || '');
      if (lastDate === todayKey) {
        return NextResponse.json(
          { error: 'รับโบนัสเช็คอินของวันนี้ไปแล้ว! กลับมารับใหม่พรุ่งนี้หลัง 07:00 น. นะ 🌅' },
          { status: 400 }
        );
      }
      const nextPoints = currentPoints + DAILY_CHECKIN_BONUS;
      await turso.execute({
        sql: 'UPDATE users SET points = ?, last_checkin_date = ? WHERE id = ?',
        args: [nextPoints, todayKey, uid],
      });
      return NextResponse.json({
        success: true,
        earned: DAILY_CHECKIN_BONUS,
        points: nextPoints,
        checkedInToday: true,
      });
    }

    if (type === 'beach_coin') {
      const nowMs = Date.now();
      const { isLunchRush } = getBangkokLunchRushStatus(nowMs);
      if (!isLunchRush) {
        return NextResponse.json(
          {
            error: '⏰ ศึกแย่งเหรียญพักเที่ยงเปิดเฉพาะวันจันทร์–ศุกร์ เวลา 12:00 – 13:00 น. เท่านั้น!',
            outsideWindow: true,
          },
          { status: 400 }
        );
      }

      if (typeof slotId !== 'number' || !spawnToken) {
        return NextResponse.json({ error: 'ข้อมูลเหรียญไม่ถูกต้อง' }, { status: 400 });
      }

      // ล็อกแย่งชิงระดับฐานข้อมูล (Atomic Conditional Update): ใครแตะถึงก่อนเสี้ยววินาทีได้ไปคนเดียว!
      const nextSpawnAt = nowMs + LUNCH_COIN_RESPAWN_MS;
      const claimRes = await turso.execute({
        sql: `
          UPDATE arena_coins
          SET claimed_by = ?, spawn_at = ?
          WHERE slot_id = ? AND spawn_token = ? AND claimed_by IS NULL
        `,
        args: [uid, nextSpawnAt, slotId, String(spawnToken)],
      });

      if (Number(claimRes.rowsAffected ?? 0) === 0) {
        const winnerRes = await turso.execute({
          sql: `
            SELECT u.name, u.avatar_emoji
            FROM arena_coins c
            LEFT JOIN users u ON u.id = c.claimed_by
            WHERE c.slot_id = ?
          `,
          args: [slotId],
        });
        const wRow = winnerRes.rows[0];
        const wLabel = wRow?.name ? `${wRow.avatar_emoji || '⚡'} ${wRow.name}` : 'เพื่อนในสนาม';
        return NextResponse.json(
          {
            error: `⚡ ช้าไปเสี้ยววิ! ${wLabel} แย่งเก็บเหรียญนี้ตัดหน้าไปแล้ว!`,
            alreadyTaken: true,
          },
          { status: 409 }
        );
      }

      const nextPoints = currentPoints + LUNCH_COIN_VALUE;
      await turso.execute({
        sql: 'UPDATE users SET points = ? WHERE id = ?',
        args: [nextPoints, uid],
      });

      return NextResponse.json({
        success: true,
        earned: LUNCH_COIN_VALUE,
        points: nextPoints,
        slotId,
        spawnToken: String(spawnToken),
        winnerName: String(user.name),
        winnerEmoji: String(user.avatar_emoji),
      });
    }

    return NextResponse.json({ error: 'ประเภทรางวัลไม่ถูกต้อง' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/rewards error:', error);
    return NextResponse.json({ error: 'รับรางวัลไม่สำเร็จ' }, { status: 500 });
  }
}
