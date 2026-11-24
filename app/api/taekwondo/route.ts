import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { resolveTaekwondoBelt, TAEKWONDO_BELTS } from '@/lib/taekwondo_catalog';
import { assertActiveUserSession } from '@/lib/session_guard';

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
      equipped_belt_tier INTEGER,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try {
    await turso.execute('ALTER TABLE taekwondo_progress ADD COLUMN equipped_belt_tier INTEGER');
  } catch {
    // Column already exists
  }
  tkdTableReady = true;
}

function resolveEquippedTier(rawVal: unknown, maxTier: number): number | null {
  if (rawVal === null || rawVal === undefined || rawVal === '') return null;
  const parsed = Number(rawVal);
  if (!Number.isFinite(parsed)) return null;
  const clamped = Math.max(0, Math.min(maxTier, Math.floor(parsed)));
  return clamped;
}

export async function GET(req: Request) {
  try {
    await ensureTkdTable();
    const url = new URL(req.url);
    const uid = Number(url.searchParams.get('userId') || 0);

    let totalXp = 0;
    let bestScore = 0;
    let rawEquippedTier: unknown = null;

    if (uid > 0) {
      const res = await turso.execute({
        sql: 'SELECT total_xp, best_score, equipped_belt_tier FROM taekwondo_progress WHERE user_id = ? LIMIT 1',
        args: [uid],
      });
      if (res.rows.length > 0) {
        totalXp = Number(res.rows[0].total_xp ?? 0);
        bestScore = Number(res.rows[0].best_score ?? 0);
        rawEquippedTier = res.rows[0].equipped_belt_tier;
      }
    }

    const lbRes = await turso.execute(`
      SELECT t.user_id, t.total_xp, t.best_score, t.equipped_belt_tier, u.name, u.avatar_emoji
      FROM taekwondo_progress t
      JOIN users u ON u.id = t.user_id
      ORDER BY t.total_xp DESC, t.best_score DESC
      LIMIT 5
    `);

    const leaderboard = lbRes.rows.map((r) => {
      const xp = Number(r.total_xp ?? 0);
      const { belt } = resolveTaekwondoBelt(xp);
      const eqTier = resolveEquippedTier(r.equipped_belt_tier, belt.tier);
      const shownBelt = eqTier !== null ? TAEKWONDO_BELTS[eqTier] ?? belt : belt;
      return {
        userId: Number(r.user_id),
        name: String(r.name || 'ผู้กล้า'),
        emoji: String(r.avatar_emoji || '🥋'),
        totalXp: xp,
        bestScore: Number(r.best_score ?? 0),
        beltName: shownBelt.name,
        beltHex: shownBelt.beltHex,
        secondaryHex: shownBelt.secondaryHex ?? null,
      };
    });

    const resolved = resolveTaekwondoBelt(totalXp);
    const equippedBeltTier = resolveEquippedTier(rawEquippedTier, resolved.belt.tier);

    return NextResponse.json({
      success: true,
      totalXp,
      bestScore,
      equippedBeltTier,
      ...resolved,
      leaderboard,
    });
  } catch (error) {
    console.error('GET /api/taekwondo error:', error);
    return NextResponse.json({ error: 'โหลดข้อมูลสำนักเทควันโดไม่สำเร็จ' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureTkdTable();
    const body = await req.json();
    const uid = Number(body.userId || 0);
    const requestedTier =
      body.tier === null || body.tier === undefined ? null : Math.floor(Number(body.tier));

    if (!uid || uid <= 0) {
      return NextResponse.json({
        success: true,
        guestMode: true,
        equippedBeltTier: requestedTier,
      });
    }

    const patchKickResp = await assertActiveUserSession(req, uid);
    if (patchKickResp) return patchKickResp;

    const prevRes = await turso.execute({
      sql: 'SELECT total_xp, best_score, max_belt_rewarded FROM taekwondo_progress WHERE user_id = ? LIMIT 1',
      args: [uid],
    });
    const totalXp = prevRes.rows.length > 0 ? Number(prevRes.rows[0].total_xp ?? 0) : 0;
    const { belt } = resolveTaekwondoBelt(totalXp);

    if (requestedTier !== null) {
      if (!Number.isFinite(requestedTier) || requestedTier < 0 || requestedTier > belt.tier) {
        return NextResponse.json(
          { error: 'ยังไม่ปลดล็อกสายนี้ (เลือกได้เฉพาะสายที่ปลดล็อกแล้วเท่านั้น)' },
          { status: 400 }
        );
      }
    }

    const nextEquippedTier = requestedTier === belt.tier ? null : requestedTier;

    await turso.execute({
      sql: `
        INSERT INTO taekwondo_progress (user_id, total_xp, best_score, max_belt_rewarded, equipped_belt_tier, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          equipped_belt_tier = excluded.equipped_belt_tier,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [
        uid,
        totalXp,
        prevRes.rows.length > 0 ? Number(prevRes.rows[0].best_score ?? 0) : 0,
        prevRes.rows.length > 0 ? Number(prevRes.rows[0].max_belt_rewarded ?? 0) : 0,
        nextEquippedTier,
      ],
    });

    return NextResponse.json({
      success: true,
      equippedBeltTier: nextEquippedTier,
    });
  } catch (error) {
    console.error('PATCH /api/taekwondo error:', error);
    return NextResponse.json({ error: 'เปลี่ยนสายเทควันโดไม่สำเร็จ' }, { status: 500 });
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
        equippedBeltTier: null,
        promotedBelts: [],
        coinsEarned: 0,
        points: null,
        ...resolved,
      });
    }

    const postKickResp = await assertActiveUserSession(req, uid);
    if (postKickResp) return postKickResp;

    const userRes = await turso.execute({
      sql: 'SELECT id, points FROM users WHERE id = ? LIMIT 1',
      args: [uid],
    });
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้เล่นนี้' }, { status: 404 });
    }
    const currentPoints = Number(userRes.rows[0].points ?? 0);

    const prevRes = await turso.execute({
      sql: 'SELECT total_xp, best_score, max_belt_rewarded, equipped_belt_tier FROM taekwondo_progress WHERE user_id = ? LIMIT 1',
      args: [uid],
    });
    const prevXp = prevRes.rows.length > 0 ? Number(prevRes.rows[0].total_xp ?? 0) : 0;
    const prevBest = prevRes.rows.length > 0 ? Number(prevRes.rows[0].best_score ?? 0) : 0;
    const prevMaxRewarded =
      prevRes.rows.length > 0 ? Number(prevRes.rows[0].max_belt_rewarded ?? 0) : 0;
    const prevEquippedRaw =
      prevRes.rows.length > 0 ? prevRes.rows[0].equipped_belt_tier : null;

    const prevBelt = resolveTaekwondoBelt(prevXp).belt;
    const afterNextBelt = TAEKWONDO_BELTS.find((b) => b.tier === prevBelt.tier + 2) ?? null;

    // จำกัดให้แต่ละรอบเลื่อนได้สูงสุดไม่เกิน 1 สาย (ถ้าแต้มล้นไปถึงสายถัดไปอีกขั้น จะหยุดไว้ที่ 1 XP ก่อนสายนั้น)
    let nextXp = prevXp + xpGained;
    let cappedToOneBelt = false;
    if (afterNextBelt && nextXp >= afterNextBelt.minXp) {
      nextXp = Math.max(prevXp, afterNextBelt.minXp - 1);
      cappedToOneBelt = true;
    }
    const effectiveXpGained = Math.max(0, nextXp - prevXp);
    const nextBest = Math.max(prevBest, rawScore);
    const nextResolved = resolveTaekwondoBelt(nextXp);

    const promotedBelts = TAEKWONDO_BELTS.filter(
      (b) => b.tier > prevMaxRewarded && b.tier <= nextResolved.belt.tier
    ).slice(0, 1);
    const coinsEarned = promotedBelts.reduce((sum, b) => sum + b.promotionCoins, 0);
    const nextMaxRewarded = Math.max(prevMaxRewarded, nextResolved.belt.tier);
    const nextPoints = currentPoints + coinsEarned;

    // ถ้าเพิ่งเลื่อนสายใหม่ ให้สวมสายใหม่อัตโนมัติ (null = สายสูงสุด) แต่ถ้าไม่ได้เลื่อนสาย ให้คงสายที่เลือกย้อนไว้
    const nextEquippedTier =
      promotedBelts.length > 0
        ? null
        : resolveEquippedTier(prevEquippedRaw, nextResolved.belt.tier);

    await turso.execute({
      sql: `
        INSERT INTO taekwondo_progress (user_id, total_xp, best_score, max_belt_rewarded, equipped_belt_tier, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          total_xp = excluded.total_xp,
          best_score = excluded.best_score,
          max_belt_rewarded = excluded.max_belt_rewarded,
          equipped_belt_tier = excluded.equipped_belt_tier,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [uid, nextXp, nextBest, nextMaxRewarded, nextEquippedTier],
    });

    if (coinsEarned > 0) {
      await turso.execute({
        sql: 'UPDATE users SET points = ? WHERE id = ?',
        args: [nextPoints, uid],
      });
    }

    return NextResponse.json({
      success: true,
      xpGained: effectiveXpGained,
      cappedToOneBelt,
      totalXp: nextXp,
      bestScore: nextBest,
      equippedBeltTier: nextEquippedTier,
      promotedBelts,
      coinsEarned,
      points: nextPoints,
      ...nextResolved,
    });
  } catch (error) {
    console.error('POST /api/taekwondo error:', error);
    return NextResponse.json({ error: 'บันทึกผลการฝึกเทควันโดไม่สำเร็จ' }, { status: 500 });
  }
}
