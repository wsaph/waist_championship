import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { assertActiveUserSession } from '@/lib/session_guard';
import { resolveDailyCheckinReward } from '@/lib/morning_champion';
import {
  getBangkokLunchRushStatus,
  getOrSpawnLunchCoins,
  LUNCH_COIN_RESPAWN_MS,
  LUNCH_COIN_VALUE,
} from '@/lib/lunch_coins';

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

    const kickResp = await assertActiveUserSession(req, uid);
    if (kickResp) return kickResp;

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

      const seasonRes = await turso.execute(
        `SELECT id FROM seasons WHERE is_active = 1 ORDER BY id DESC LIMIT 1`
      );
      const activeSeasonId =
        seasonRes.rows.length > 0 ? Number(seasonRes.rows[0].id) : 1;

      const snapRes = await turso.execute({
        sql: `
          SELECT
            se.user_id,
            se.step_count AS current_step_count,
            COALESCE(sl.added_today, 0) AS steps_added_since_cutoff
          FROM season_entries se
          INNER JOIN users u ON u.id = se.user_id
          LEFT JOIN (
            SELECT user_id, SUM(steps_added) AS added_today
            FROM step_logs
            WHERE season_id = ? AND date(logged_at) >= ?
            GROUP BY user_id
          ) sl ON sl.user_id = se.user_id
          WHERE se.season_id = ?
        `,
        args: [activeSeasonId, todayKey, activeSeasonId],
      });

      const snapshotEntries = snapRes.rows.map((r) => ({
        userId: Number(r.user_id),
        currentStepCount: Number(r.current_step_count ?? 0),
        stepsAddedSinceCutoff: Number(r.steps_added_since_cutoff ?? 0),
      }));

      const rewardMeta = resolveDailyCheckinReward(uid, snapshotEntries);

      const updRes = await turso.execute({
        sql: `
          UPDATE users
          SET points = points + ?, last_checkin_date = ?
          WHERE id = ? AND COALESCE(last_checkin_date, '') != ?
        `,
        args: [rewardMeta.earned, todayKey, uid, todayKey],
      });

      if (Number(updRes.rowsAffected ?? 0) === 0) {
        return NextResponse.json(
          { error: 'รับโบนัสเช็คอินของวันนี้ไปแล้ว! กลับมารับใหม่พรุ่งนี้หลัง 07:00 น. นะ 🌅' },
          { status: 400 }
        );
      }

      const latestUserRes = await turso.execute({
        sql: 'SELECT points FROM users WHERE id = ? LIMIT 1',
        args: [uid],
      });
      const nextPoints = Number(
        latestUserRes.rows[0]?.points ?? currentPoints + rewardMeta.earned
      );

      return NextResponse.json({
        success: true,
        earned: rewardMeta.earned,
        points: nextPoints,
        checkedInToday: true,
        isMorningChampion: rewardMeta.isMorningChampion,
        championStepsAt7Am: rewardMeta.championStepsAt7Am,
        coChampionCount: rewardMeta.coChampionCount,
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

    if (type === 'penalty_win') {
      const bkkToday = getBangkokDateKey();
      const prevDate = String(user.penalty_wins_date || '');
      const prevCount = prevDate === bkkToday ? Number(user.penalty_wins_count ?? 0) : 0;

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
        sql: 'UPDATE users SET points = ?, penalty_wins_date = ?, penalty_wins_count = ? WHERE id = ?',
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

    return NextResponse.json({ error: 'ประเภทรางวัลไม่ถูกต้อง' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/rewards error:', error);
    return NextResponse.json({ error: 'รับรางวัลไม่สำเร็จ' }, { status: 500 });
  }
}
