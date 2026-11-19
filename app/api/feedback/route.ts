import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

function getBangkokDateKey() {
  const bkk = new Date(Date.now() + 7 * 3600 * 1000);
  return bkk.toISOString().slice(0, 10);
}

const VALID_CATEGORIES = new Set(['bug', 'idea', 'cosmetic']);

export async function GET() {
  try {
    const res = await turso.execute({
      sql: `
        SELECT id, user_id, user_name, user_emoji, category, message, device_info, status, created_at
        FROM beta_feedback
        ORDER BY id DESC
        LIMIT 80
      `,
      args: [],
    });

    const items = res.rows.map((r) => ({
      id: Number(r.id),
      userId: r.user_id !== null && r.user_id !== undefined ? Number(r.user_id) : null,
      userName: String(r.user_name || 'ผู้เล่นนิรนาม'),
      userEmoji: String(r.user_emoji || '💬'),
      category: String(r.category || 'bug'),
      message: String(r.message || ''),
      deviceInfo: String(r.device_info || ''),
      status: r.status === 'resolved' ? 'resolved' : 'open',
      createdAt: String(r.created_at || ''),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('GET /api/feedback error:', error);
    return NextResponse.json({ error: 'โหลดรายการฟีดแบ็กไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawMsg = typeof body.message === 'string' ? body.message.trim() : '';
    const category = VALID_CATEGORIES.has(String(body.category)) ? String(body.category) : 'bug';
    const deviceInfo =
      typeof body.deviceInfo === 'string' ? body.deviceInfo.trim().slice(0, 120) : '';
    const userId = body.userId ? Number(body.userId) : null;

    if (rawMsg.length < 3) {
      return NextResponse.json(
        { error: 'กรุณาพิมพ์รายละเอียดอย่างน้อย 3 ตัวอักษรครับ' },
        { status: 400 }
      );
    }
    const cleanMsg = rawMsg.slice(0, 500);

    let userName = typeof body.userName === 'string' && body.userName.trim() ? body.userName.trim().slice(0, 40) : 'ผู้เล่นนิรนาม';
    let userEmoji = typeof body.userEmoji === 'string' && body.userEmoji.trim() ? body.userEmoji.trim().slice(0, 8) : '💬';
    let bonusEarned = 0;
    let nextPoints: number | null = null;

    if (userId && userId > 0) {
      const userRes = await turso.execute({
        sql: 'SELECT id, name, avatar_emoji, points, last_feedback_bonus_date FROM users WHERE id = ? LIMIT 1',
        args: [userId],
      });
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        userName = String(u.name || userName);
        userEmoji = String(u.avatar_emoji || userEmoji);
        const todayKey = getBangkokDateKey();
        const lastBonusDate = String(u.last_feedback_bonus_date || '');
        if (lastBonusDate !== todayKey) {
          bonusEarned = 5;
          nextPoints = Number(u.points ?? 100) + bonusEarned;
          await turso.execute({
            sql: 'UPDATE users SET points = ?, last_feedback_bonus_date = ? WHERE id = ?',
            args: [nextPoints, todayKey, userId],
          });
        } else {
          nextPoints = Number(u.points ?? 100);
        }
      }
    }

    const insertRes = await turso.execute({
      sql: `
        INSERT INTO beta_feedback (user_id, user_name, user_emoji, category, message, device_info, status)
        VALUES (?, ?, ?, ?, ?, ?, 'open')
      `,
      args: [userId && userId > 0 ? userId : null, userName, userEmoji, category, cleanMsg, deviceInfo],
    });

    return NextResponse.json({
      ok: true,
      id: Number(insertRes.lastInsertRowid),
      bonusEarned,
      points: nextPoints,
    });
  } catch (error) {
    console.error('POST /api/feedback error:', error);
    return NextResponse.json({ error: 'ส่งฟีดแบ็กไม่สำเร็จ' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const id = Number(body.id);
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: 'ไม่พบรหัสรายการ' }, { status: 400 });
    }

    if (body.action === 'delete') {
      await turso.execute({
        sql: 'DELETE FROM beta_feedback WHERE id = ?',
        args: [id],
      });
      return NextResponse.json({ ok: true, deleted: true });
    }

    const nextStatus = body.status === 'resolved' ? 'resolved' : 'open';
    await turso.execute({
      sql: 'UPDATE beta_feedback SET status = ? WHERE id = ?',
      args: [nextStatus, id],
    });
    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    console.error('PATCH /api/feedback error:', error);
    return NextResponse.json({ error: 'อัปเดตสถานะไม่สำเร็จ' }, { status: 500 });
  }
}
