import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

const ROAST_DOWN = [
  '🔥 โหดเกินปุยมุ้ย! พุงยุบเห็นๆ ตัวละครพุ่งทะยานไปข้างหน้าแล้ว!',
  '⚡ ว้าววว ลีนจัด! เพื่อนร่วมแก๊งเริ่มหนาวๆ ร้อนๆ แล้ว!',
  '👑 ทรงนี้แชมป์เอวเอสอยู่ไม่ไกล เตรียมตัวรอรับมง!'
];

const ROAST_UP = [
  '🚨 อุ๊ย! พุงป่องขึ้นทันที! สงสัยเมื่อคืนแอบจัดบุฟเฟต์รอบดึก!',
  '🥓 กราฟพุ่งสวนทางเพื่อน ระวังตำแหน่ง "เจ้ามือชาบู" จะถามหานะ!',
  '🧋 แคลอรี่ไม่เคยทรยศใคร กินเข้าไปเท่าไหร่ ออกมาที่พุง 3D หมด!'
];

export async function GET() {
  try {
    const usersRes = await turso.execute(`
      SELECT 
        u.*,
        COALESCE(
          (SELECT weight FROM weight_logs WHERE user_id = u.id ORDER BY logged_at DESC, id DESC LIMIT 1),
          u.start_weight
        ) AS current_weight,
        COALESCE(
          (SELECT excuse_tag FROM weight_logs WHERE user_id = u.id ORDER BY logged_at DESC, id DESC LIMIT 1),
          'พร้อมลุย!'
        ) AS latest_taunt
      FROM users u
      ORDER BY u.id ASC
    `);

    const logsRes = await turso.execute(`
      SELECT 
        w.id, w.user_id, w.weight, w.excuse_tag, w.roast_message, w.logged_at,
        u.name, u.avatar_emoji
      FROM weight_logs w
      JOIN users u ON w.user_id = u.id
      ORDER BY w.logged_at DESC, w.id DESC
      LIMIT 25
    `);

    const allLogsAsc = await turso.execute(`
      SELECT id, user_id, weight FROM weight_logs ORDER BY logged_at ASC, id ASC
    `);
    const prevByUser: Record<number, number> = {};
    const diffByLogId: Record<number, number> = {};
    for (const row of allLogsAsc.rows) {
      const uid = Number(row.user_id);
      const lid = Number(row.id);
      const w = Number(row.weight);
      if (prevByUser[uid] !== undefined) {
        diffByLogId[lid] = Number((w - prevByUser[uid]).toFixed(1));
      } else {
        diffByLogId[lid] = 0;
      }
      prevByUser[uid] = w;
    }

    const dailyCountsRes = await turso.execute(`
      SELECT target_user_id, kind, COUNT(*) AS cnt
      FROM interactions
      WHERE date(created_at) = date('now')
      GROUP BY target_user_id, kind
    `);
    const cheerByUser: Record<number, number> = {};
    const temptByUser: Record<number, number> = {};
    for (const row of dailyCountsRes.rows) {
      const uid = Number(row.target_user_id);
      const cnt = Number(row.cnt);
      if (row.kind === 'tempt') temptByUser[uid] = cnt;
      else cheerByUser[uid] = cnt;
    }

    const participants = usersRes.rows.map((u) => ({
      id: Number(u.id),
      name: String(u.name),
      emoji: String(u.avatar_emoji),
      colorHex: String(u.color_hex),
      accessory: u.accessory ? String(u.accessory) : undefined,
      bandColor: u.band_color ? String(u.band_color) : undefined,
      role: u.role === 'spectator' ? 'spectator' : 'competitor',
      workoutType: u.workout_type ? String(u.workout_type) : 'cheer',
      petType: u.pet_type ? String(u.pet_type) : 'none',
      statusText: u.status_text ? String(u.status_text) : '',
      startWeight: Number(u.start_weight),
      currentWeight: Number(u.current_weight),
      goalWeight: Number(u.goal_weight),
      taunt: String(u.latest_taunt),
      cheerCount: cheerByUser[Number(u.id)] ?? 0,
      temptCount: temptByUser[Number(u.id)] ?? 0,
    }));

    const interactionsRes = await turso.execute(`
      SELECT
        i.id, i.sender_name, i.sender_emoji, i.target_user_id, i.kind, i.gift_item, i.message, i.created_at,
        t.name AS target_name, t.avatar_emoji AS target_emoji
      FROM interactions i
      JOIN users t ON i.target_user_id = t.id
      ORDER BY i.created_at DESC, i.id DESC
      LIMIT 25
    `);

    const weightFeed = logsRes.rows.map((l) => ({
      id: `w-${Number(l.id)}`,
      type: 'weight' as const,
      user: String(l.name),
      emoji: String(l.avatar_emoji),
      weight: Number(l.weight),
      diff: diffByLogId[Number(l.id)] ?? 0,
      roast: String(l.roast_message || 'อัปเดตน้ำหนักเรียบร้อย!'),
      excuse: String(l.excuse_tag || ''),
      time: String(l.logged_at),
    }));

    const interactionFeed = interactionsRes.rows.map((i) => ({
      id: `i-${Number(i.id)}`,
      type: (i.kind === 'tempt' ? 'tempt' : 'cheer') as 'cheer' | 'tempt',
      user: String(i.sender_name),
      emoji: String(i.sender_emoji),
      targetName: String(i.target_name),
      targetEmoji: String(i.target_emoji),
      giftItem: String(i.gift_item),
      roast: String(i.message || ''),
      time: String(i.created_at),
    }));

    const feed = [...weightFeed, ...interactionFeed]
      .sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0))
      .slice(0, 30);

    return NextResponse.json({ participants, feed });
  } catch (error) {
    console.error('GET /api/weights error:', error);
    return NextResponse.json({ error: 'ดึงข้อมูลไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, pinCode, isSelf, weight, excuseTag } = await req.json();

    const userCheck = await turso.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId],
    });

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายชื่อผู้เข้าแข่งขัน' }, { status: 404 });
    }

    const user = userCheck.rows[0];
    if (!isSelf && String(user.pin_code) !== String(pinCode)) {
      return NextResponse.json({ error: 'รหัส PIN ไม่ถูกต้อง! อย่าแอบโกงน้ำหนักเพื่อนนะ 👀' }, { status: 401 });
    }

    const prevLog = await turso.execute({
      sql: 'SELECT weight FROM weight_logs WHERE user_id = ? ORDER BY logged_at DESC, id DESC LIMIT 1',
      args: [userId],
    });
    const prevWeight = prevLog.rows.length > 0 ? Number(prevLog.rows[0].weight) : Number(user.start_weight);
    const diff = Number((weight - prevWeight).toFixed(1));

    let roastText = '⚖️ น้ำหนักนิ่งสนิทเหมือนรูปปั้น รักษามาตรฐานได้เป๊ะ!';
    if (diff < 0) {
      roastText = ROAST_DOWN[Math.floor(Math.random() * ROAST_DOWN.length)];
    } else if (diff > 0) {
      roastText = ROAST_UP[Math.floor(Math.random() * ROAST_UP.length)];
    }

    await turso.execute({
      sql: 'INSERT INTO weight_logs (user_id, weight, excuse_tag, roast_message) VALUES (?, ?, ?, ?)',
      args: [userId, weight, excuseTag || 'ชั่งแบบลุ้นระทึก', roastText],
    });

    return NextResponse.json({ success: true, diff, roast: roastText });
  } catch (error) {
    console.error('POST /api/weights error:', error);
    return NextResponse.json({ error: 'บันทึกน้ำหนักไม่สำเร็จ' }, { status: 500 });
  }
}
