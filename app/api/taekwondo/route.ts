import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { resolveTaekwondoBelt, TAEKWONDO_BELTS } from '@/lib/taekwondo_catalog';

export const dynamic = 'force-dynamic';

let tkdTableReady = false;

async function ensureTkdTable() {
  if (tkdTableReady) return;
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS taekwondo_progress (
      user_id INTEGER PRIMARY KEY,
      total_xp INTEGER NOT NULL DEFAULT 0,
      best_score INTEGER NOT NULL DEFAULT 0,
      max_belt_rewarded INTEGER NOT NULL DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tkdTableReady = true;
}

export async function GET(req: Request) {
  try {
    await ensureTkdTable();
    const url = new URL(req.url);
    const uid = Number(url.searchParams.get('userId') || 0);

    let totalXp = 0;
    let bestScore = 0;
    if (uid > 0) {
      const res = await turso.execute({
        sql: 'SELECT total_xp, best_score FROM taekwondo_progress WHERE user_id = ? LIMIT 1',
        args: [uid],
      });
      if (res.rows.length > 0) {
        totalXp = Number(res.rows[0].total_xp ?? 0);
        bestScore = Number(res.rows[0].best_score ?? 0);
      }
    }

    const lbRes = await turso.execute(`
      SELECT t.user_id, t.total_xp, t.best_score, u.name, u.avatar_emoji
      FROM taekwondo_progress t
      JOIN users u ON u.id = t.user_id
      ORDER BY t.total_xp DESC, t.best_score DESC
      LIMIT 5
    `);

    const leaderboard = lbRes.rows.map((r) => {
      const xp = Number(r.total_xp ?? 0);
      const { belt } = resolveTaekwondoBelt(xp);
      return {
        userId: Number(r.user_id),
        name: String(r.name || 'ผู้กล้า'),
        emoji: String(r.avatar_emoji || '🥋'),
        totalXp: xp,
        bestScore: Number(r.best_score ?? 0),
        beltName: belt.name,
        beltHex: belt.beltHex,
      };
    });

    const resolved = resolveTaekwondoBelt(totalXp);
    return NextResponse.json({
      success: true,
      totalXp,
      bestScore,
      ...resolved,
      leaderboard,
    });
  } catch (error) {
    console.error('GET /api/taekwondo error:', error);
    return NextResponse.json({ error: 'โหลดข้อมูลสำนักเทควันโดไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTkdTable();
    const body = await req.json();
    const uid = Number(body.userId || 0);
    const rawScore = Math.max(0, Math.min(2000, Math.round(Number(body.score || 0))));
    // Cap per-round XP gain to 350 to keep belt progression rewarding and balanced
    const xpGained = Math.min(350, rawScore);

    if (!uid || uid <= 0) {
      const resolved = resolveTaekwondoBelt(xpGained);
      return NextResponse.json({
        success: true,
        guestMode: true,
        xpGained,
        totalXp: xpGained,
        bestScore: rawScore,
        promotedBelts: [],
        coinsEarned: 0,
        points: null,
        ...resolved,
      });
    }

    const userRes = await turso.execute({
      sql: 'SELECT id, points FROM users WHERE id = ? LIMIT 1',
      args: [uid],
    });
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้เล่นนี้' }, { status: 404 });
    }
    const currentPoints = Number(userRes.rows[0].points ?? 0);

    const prevRes = await turso.execute({
      sql: 'SELECT total_xp, best_score, max_belt_rewarded FROM taekwondo_progress WHERE user_id = ? LIMIT 1',
      args: [uid],
    });
    const prevXp = prevRes.rows.length > 0 ? Number(prevRes.rows[0].total_xp ?? 0) : 0;
    const prevBest = prevRes.rows.length > 0 ? Number(prevRes.rows[0].best_score ?? 0) : 0;
    const prevMaxRewarded =
      prevRes.rows.length > 0 ? Number(prevRes.rows[0].max_belt_rewarded ?? 0) : 0;

    const nextXp = prevXp + xpGained;
    const nextBest = Math.max(prevBest, rawScore);
    const nextResolved = resolveTaekwondoBelt(nextXp);

    const promotedBelts = TAEKWONDO_BELTS.filter(
      (b) => b.tier > prevMaxRewarded && b.tier <= nextResolved.belt.tier
    );
    const coinsEarned = promotedBelts.reduce((sum, b) => sum + b.promotionCoins, 0);
    const nextMaxRewarded = Math.max(prevMaxRewarded, nextResolved.belt.tier);
    const nextPoints = currentPoints + coinsEarned;

    await turso.execute({
      sql: `
        INSERT INTO taekwondo_progress (user_id, total_xp, best_score, max_belt_rewarded, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          total_xp = excluded.total_xp,
          best_score = excluded.best_score,
          max_belt_rewarded = excluded.max_belt_rewarded,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [uid, nextXp, nextBest, nextMaxRewarded],
    });

    if (coinsEarned > 0) {
      await turso.execute({
        sql: 'UPDATE users SET points = ? WHERE id = ?',
        args: [nextPoints, uid],
      });
    }

    return NextResponse.json({
      success: true,
      xpGained,
      totalXp: nextXp,
      bestScore: nextBest,
      promotedBelts,
      coinsEarned,
      points: nextPoints,
      ...nextResolved,
    });
  } catch (error) {
    console.error('POST /api/taekwondo error:', error);
    return NextResponse.json({ error: 'บันทึกคะแนนเทควันโดไม่สำเร็จ' }, { status: 500 });
  }
}
