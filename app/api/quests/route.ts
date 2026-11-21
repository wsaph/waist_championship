import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { fetchAllQuests } from '@/lib/quest_board_db';
import {
  QUEST_MIN_STAKE,
  QUEST_MAX_STAKE,
} from '@/lib/quest_board';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const quests = await fetchAllQuests();
    const activeBettingQuests = quests
      .filter((q) => q.isBettingOpen)
      .map((q) => ({
        id: q.id,
        title: q.title,
        bettingEndsAt: q.bettingEndsAt,
        bettingMsRemaining: q.bettingMsRemaining,
        totalSponsorPool: q.totalSponsorPool,
        totalBetPool: q.totalBetPool,
        partyNames: q.party
          .filter((m) => m.inviteStatus === 'accepted')
          .map((m) => `${m.userEmoji} ${m.userName}`),
      }));

    return NextResponse.json({
      quests,
      activeBettingQuests,
    });
  } catch (err) {
    console.error('GET /api/quests error:', err);
    return NextResponse.json({ error: 'โหลดกระดานเควสไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const creatorId = Number(body.creatorId);
    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    const questType = body.questType === 'template' ? 'template' : 'custom';
    const templateKey = String(body.templateKey ?? '').trim();
    const targetValue = Number(body.targetValue ?? 0) || 0;
    const targetUnit = String(body.targetUnit ?? '').trim();
    const durationDays = Math.max(0, Math.floor(Number(body.durationDays ?? 0) || 0));
    const initialSponsorAmount = Math.floor(Number(body.initialSponsorAmount ?? 0)) || 0;
    const aiSummary = String(body.aiSummary ?? '').trim();

    if (!Number.isFinite(creatorId) || creatorId <= 0) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนสร้างเควส' }, { status: 400 });
    }
    if (!title || title.length < 3) {
      return NextResponse.json({ error: 'กรุณาตั้งชื่อเควสอย่างน้อย 3 ตัวอักษร' }, { status: 400 });
    }
    if (!description || description.length < 5) {
      return NextResponse.json({ error: 'กรุณาอธิบายรายละเอียด/เงื่อนไขเควสให้ชัดเจน' }, { status: 400 });
    }
    if (
      initialSponsorAmount < 0 ||
      (initialSponsorAmount > 0 &&
        (initialSponsorAmount < QUEST_MIN_STAKE || initialSponsorAmount > QUEST_MAX_STAKE))
    ) {
      return NextResponse.json(
        { error: `สมทบรางวัลได้ 0 หรือ ${QUEST_MIN_STAKE} – ${QUEST_MAX_STAKE} 💰 ต่อคน/เควส` },
        { status: 400 }
      );
    }

    const userRes = await turso.execute({
      sql: `SELECT id, points FROM users WHERE id = ?`,
      args: [creatorId],
    });
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบข้อมูลผู้เล่น' }, { status: 404 });
    }
    const currentPoints = Number(userRes.rows[0].points ?? 0);

    if (initialSponsorAmount > 0 && currentPoints < initialSponsorAmount) {
      return NextResponse.json(
        { error: `เหรียญ Gacha ไม่พอ (มี ${currentPoints} 💰 แต่ต้องการลง ${initialSponsorAmount} 💰)` },
        { status: 400 }
      );
    }

    if (initialSponsorAmount > 0) {
      const deductRes = await turso.execute({
        sql: `UPDATE users SET points = points - ? WHERE id = ? AND points >= ?`,
        args: [initialSponsorAmount, creatorId, initialSponsorAmount],
      });
      if ((deductRes.rowsAffected ?? 0) === 0) {
        return NextResponse.json({ error: 'เหรียญ Gacha ไม่พอสำหรับสมทบรางวัล' }, { status: 400 });
      }
    }

    const insertRes = await turso.execute({
      sql: `
        INSERT INTO quests (
          creator_id, title, description, quest_type, template_key,
          target_value, target_unit, ai_summary, duration_days, status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
      `,
      args: [
        creatorId,
        title.slice(0, 80),
        description.slice(0, 600),
        questType,
        templateKey.slice(0, 40),
        targetValue,
        targetUnit.slice(0, 24),
        aiSummary.slice(0, 350),
        durationDays,
      ],
    });

    const questId = Number(insertRes.lastInsertRowid);

    if (initialSponsorAmount > 0 && questId > 0) {
      await turso.execute({
        sql: `INSERT INTO quest_sponsors (quest_id, user_id, amount) VALUES (?, ?, ?)`,
        args: [questId, creatorId, initialSponsorAmount],
      });
    }

    const updatedUser = await turso.execute({
      sql: `SELECT points FROM users WHERE id = ?`,
      args: [creatorId],
    });
    const quests = await fetchAllQuests();

    return NextResponse.json({
      questId,
      userPoints: Number(updatedUser.rows[0]?.points ?? currentPoints),
      quests,
    });
  } catch (err) {
    console.error('POST /api/quests error:', err);
    return NextResponse.json({ error: 'สร้างเควสไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
