import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import {
  getBangkokLunchRushStatus,
  getOrSpawnLunchCoins,
  LUNCH_COIN_RESPAWN_MS,
  LUNCH_COIN_VALUE,
} from '@/lib/lunch_coins';

const DAILY_CHECKIN_BONUS = 10;
const VOLLEYBALL_WIN_BONUS = 5;
const VOLLEYBALL_DAILY_WIN_CAP = 3;
const SHABU_DAILY_GP_CAP = 20;
const SHABU_MAX_GP_PER_GAME = 15;

function getBangkokDateKey() {
  const bkk = new Date(Date.now() + 7 * 3600 * 1000);
  return bkk.toISOString().slice(0, 10);
}

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
    const { userId, type, slotId, spawnToken, score } = await req.json();
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

    if (type === 'volleyball_win') {
      const bkkToday = getBangkokDateKey();
      const prevDate = String(user.volleyball_wins_date || '');
      const prevCount = prevDate === bkkToday ? Number(user.volleyball_wins_count ?? 0) : 0;

      if (prevCount >= VOLLEYBALL_DAILY_WIN_CAP) {
        return NextResponse.json({
          success: true,
          earned: 0,
          points: currentPoints,
          winsToday: prevCount,
          dailyCap: VOLLEYBALL_DAILY_WIN_CAP,
          capReached: true,
        });
      }

      const nextWins = prevCount + 1;
      const nextPoints = currentPoints + VOLLEYBALL_WIN_BONUS;
      await turso.execute({
        sql: 'UPDATE users SET points = ?, volleyball_wins_date = ?, volleyball_wins_count = ? WHERE id = ?',
        args: [nextPoints, bkkToday, nextWins, uid],
      });

      return NextResponse.json({
        success: true,
        earned: VOLLEYBALL_WIN_BONUS,
        points: nextPoints,
        winsToday: nextWins,
        dailyCap: VOLLEYBALL_DAILY_WIN_CAP,
        capReached: false,
      });
    }

    if (type === 'shabu_coop_finish') {
      const bkkToday = getBangkokDateKey();
      const prevDate = String(user.shabu_gp_date || '');
      const prevEarned = prevDate === bkkToday ? Number(user.shabu_gp_earned_today ?? 0) : 0;
      const rawScore = Math.max(0, Math.min(50000, Math.round(Number(score || 0))));
      const potentialGp = Math.min(SHABU_MAX_GP_PER_GAME, Math.floor(rawScore / 100));
      const remainingCap = Math.max(0, SHABU_DAILY_GP_CAP - prevEarned);
      const earned = Math.min(potentialGp, remainingCap);

      if (earned <= 0) {
        return NextResponse.json({
          success: true,
          earned: 0,
          points: currentPoints,
          earnedToday: prevEarned,
          dailyCap: SHABU_DAILY_GP_CAP,
          capReached: remainingCap <= 0,
        });
      }

      const nextEarnedToday = prevEarned + earned;
      const nextPoints = currentPoints + earned;
      await turso.execute({
        sql: 'UPDATE users SET points = ?, shabu_gp_date = ?, shabu_gp_earned_today = ? WHERE id = ?',
        args: [nextPoints, bkkToday, nextEarnedToday, uid],
      });

      return NextResponse.json({
        success: true,
        earned,
        points: nextPoints,
        earnedToday: nextEarnedToday,
        dailyCap: SHABU_DAILY_GP_CAP,
        capReached: nextEarnedToday >= SHABU_DAILY_GP_CAP,
      });
    }

    return NextResponse.json({ error: 'ประเภทรางวัลไม่ถูกต้อง' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/rewards error:', error);
    return NextResponse.json({ error: 'รับรางวัลไม่สำเร็จ' }, { status: 500 });
  }
}
