import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

const ROAST_GAIN = [
  'น้ำหนักดีดขึ้น! สงสัยเมื่อคืนหมกระทะเรียกหา 🥓',
  'บวมน้ำหรือบวมชาบ เอาดีๆ! 🧋',
  'ตัวเลขขยับขึ้น ระวังตำแหน่งเจ้ามือชาบนะเพื่อน 🔥',
  'ก้าวถอยหลังเพื่อก้าวกระดด (หรือเปล่า?) 🐘',
];

const ROAST_LOSS = [
  'หดจัด! ไขมันกำลังร้องไห้แล้ว ⚡',
  'พุ่งทะยานส่ร่างทองอย่างสวยงาม ✨',
  'วินัยดีเยี่ยม เอาไปเลยมงกุชั่วคราว 👑',
  'ลดลงอีกแล้ว ใครจะตามทันวะเนี่ย! 🚀',
];

export async function GET() {
  try {
    const usersRes = await turso.execute(`
      SELECT 
        u.*,
        COALESCE(
          (SELECT weight FROM weight_logs WHERE user_id = u.id ORDER BY logged_at DESC, id DESC LIMIT 1),
          u.start_weight
        ) AS current_weight
      FROM users u
    `);

    const logsRes = await turso.execute(`
      SELECT 
        w.id, w.weight, w.excuse_tag, w.roast_message, w.logged_at,
        u.name, u.avatar_emoji, u.color_hex
      FROM weight_logs w
      JOIN users u ON w.user_id = u.id
      ORDER BY w.logged_at DESC, w.id DESC
      LIMIT 20
    `);

    const participants = usersRes.rows.map((u) => {
      const start = Number(u.start_weight);
      const goal = Number(u.goal_weight);
      const current = Number(u.current_weight);
      const lostKg = Number((start - current).toFixed(1));
      const totalToLose = start - goal;
      const progressPct =
        totalToLose > 0
          ? Math.max(-20, Math.min(100, Math.round((lostKg / totalToLose) * 100)))
          : 0;

      return {
        id: Number(u.id),
        name: String(u.name),
        avatar_emoji: String(u.avatar_emoji),
        color_hex: String(u.color_hex),
        start_weight: start,
        goal_weight: goal,
        current_weight: current,
        lost_kg: lostKg,
        progress_pct: progressPct,
      };
    });

    participants.sort((a, b) => b.progress_pct - a.progress_pct);

    return NextResponse.json({ participants, feed: logsRes.rows });
  } catch (error) {
    console.error('GET /api/weights error:', error);
    return NextResponse.json({ error: 'ดึงข้อมลไม่สำเรจ' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, pinCode, weight, excuseTag } = await req.json();

    const userCheck = await turso.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId],
    });

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายชื่อผ้เข้าแข่งขัน' }, { status: 404 });
    }

    const user = userCheck.rows[0];
    if (String(user.pin_code) !== String(pinCode)) {
      return NextResponse.json({ error: 'รหัส PIN ไม่ถกต้อง! อย่าแอบกงน้ำหนักเพื่อนนะ 👀' }, { status: 401 });
    }

    const prevLog = await turso.execute({
      sql: 'SELECT weight FROM weight_logs WHERE user_id = ? ORDER BY logged_at DESC, id DESC LIMIT 1',
      args: [userId],
    });
    const prevWeight = prevLog.rows.length > 0 ? Number(prevLog.rows[0].weight) : Number(user.start_weight);
    const diff = Number((weight - prevWeight).toFixed(1));

    const pool = diff > 0 ? ROAST_GAIN : ROAST_LOSS;
    const randomRoast = pool[Math.floor(Math.random() * pool.length)];
    const diffText = diff > 0 ? `(+${diff} กก.)` : `(${diff} กก.)`;
    const fullRoast = `${diffText} ${randomRoast}`;

    await turso.execute({
      sql: 'INSERT INTO weight_logs (user_id, weight, excuse_tag, roast_message) VALUES (?, ?, ?, ?)',
      args: [userId, weight, excuseTag || 'ชั่งแบบลุ้นระทึก', fullRoast],
    });

    return NextResponse.json({ success: true, diff, roast: fullRoast });
  } catch (error) {
    console.error('POST /api/weights error:', error);
    return NextResponse.json({ error: 'บันทึกน้ำหนักไม่สำเรจ' }, { status: 500 });
  }
}
