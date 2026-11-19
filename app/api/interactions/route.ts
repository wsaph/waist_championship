import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

const CHEER_GIFTS = [
  '🔥 เชื้อเพลิงเติมไฟแรงกล้า',
  '⚡ พลังงานบูสต์เทอร์โบ',
  '🌟 ถั่วเซียนปลุกพลังไซย่า',
  '💥 ลูกไฟฮึดสู้ทะลุขีดจำกัด',
  '❤️‍🔥 หัวใจเพลิงนักสู้',
  '🚀 ไอพ่นไฟความเร็วแสง',
];

const TEMPT_FOODS = [
  '🍕 พิซซ่าชีสเยิ้ม',
  '🧋 ชานมไข่มุกหวาน 100%',
  '🥓 ชาบูหมูสามชั้น',
  '🍰 เค้กช็อกโกแลต',
  '🍗 ไก่ทอดกรอบ',
  '🍜 หมูกระทะร้อนๆ',
  '🍩 โดนัทเคลือบน้ำตาล',
  '🍟 เฟรนช์ฟรายส์ชีส',
  '🍱 ข้าวกล่องยักษ์คาบิก้อน',
  '🍫 ช็อกโกแลตเสกของจอมมารบู',
];

export async function POST(req: Request) {
  try {
    const { senderId, targetUserId, kind, message } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: 'กรุณาเลือกผู้เข้าแข่งขันปลายทาง' }, { status: 400 });
    }

    const targetRes = await turso.execute({
      sql: 'SELECT id, name, avatar_emoji FROM users WHERE id = ?',
      args: [targetUserId],
    });
    if (targetRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้เข้าแข่งขันปลายทาง' }, { status: 404 });
    }

    let validSenderId: number | null = null;
    let senderName = 'ผู้หวังดีทางบ้าน';
    let senderEmoji = '📣';
    let senderPoints = 0;
    if (senderId && Number(senderId) > 0) {
      const senderRes = await turso.execute({
        sql: 'SELECT id, name, avatar_emoji, points FROM users WHERE id = ?',
        args: [Number(senderId)],
      });
      if (senderRes.rows.length > 0) {
        validSenderId = Number(senderRes.rows[0].id);
        senderName = String(senderRes.rows[0].name);
        senderEmoji = String(senderRes.rows[0].avatar_emoji);
        senderPoints = Number(senderRes.rows[0].points ?? 100);
      }
    }

    if (validSenderId && validSenderId === Number(targetUserId)) {
      return NextResponse.json(
        { error: 'ไม่สามารถเติมไฟหรือส่งของกินแกล้งตัวเองได้! กรุณาเลือกเพื่อนคนอื่นในสนาม 🔥' },
        { status: 400 }
      );
    }

    const finalKind = kind === 'tempt' ? 'tempt' : 'cheer';
    const pool = finalKind === 'tempt' ? TEMPT_FOODS : CHEER_GIFTS;
    const giftItem = pool[Math.floor(Math.random() * pool.length)];
    const cleanMsg = typeof message === 'string' ? message.trim().slice(0, 120) : '';

    const insertRes = await turso.execute({
      sql: 'INSERT INTO interactions (sender_id, sender_name, sender_emoji, target_user_id, kind, gift_item, message, dividend_claimed) VALUES (?, ?, ?, ?, ?, ?, ?, 0)',
      args: [validSenderId, senderName, senderEmoji, Number(targetUserId), finalKind, giftItem, cleanMsg],
    });

    // 1) โบนัสคนกดส่ง: ส่งไฟเชียร์หรือแกล้งเพื่อนคนอื่น รับทันที +2 🪙 (สูงสุด 5 ครั้ง/วัน = +10 🪙)
    let senderBonusEarned = 0;
    let dailyBonusRemaining = 0;
    if (validSenderId && validSenderId !== Number(targetUserId)) {
      const sentTodayRes = await turso.execute({
        sql: `
          SELECT COUNT(*) AS cnt
          FROM interactions
          WHERE sender_id = ? AND target_user_id != ? AND date(created_at) = date('now')
        `,
        args: [validSenderId, validSenderId],
      });
      const sentCount = Number(sentTodayRes.rows[0]?.cnt ?? 0);
      if (sentCount <= 5) {
        senderBonusEarned = 2;
        senderPoints += senderBonusEarned;
        await turso.execute({
          sql: 'UPDATE users SET points = ? WHERE id = ?',
          args: [senderPoints, validSenderId],
        });
      }
      dailyBonusRemaining = Math.max(0, 5 - sentCount);
    }

    // 2) โบนัสคนได้รับไฟเชียร์: เพื่อนส่งไฟให้ คนได้รับไฟก็ได้แต้มกำลังใจทันที +2 🪙 (ไม่จำกัดจำนวนครั้งต่อวัน!)
    let receiverBonusEarned = 0;
    if (finalKind === 'cheer' && (!validSenderId || validSenderId !== Number(targetUserId))) {
      receiverBonusEarned = 2;
      await turso.execute({
        sql: 'UPDATE users SET points = points + ? WHERE id = ?',
        args: [receiverBonusEarned, Number(targetUserId)],
      });
    }

    // คำนวณแต้มเติมไฟ (+) และมารผจญ (-) รายวัน (รีเซ็ตทุก 07:00 น. เวลาไทย = 00:00 UTC)
    const dailyRes = await turso.execute({
      sql: `
        SELECT kind, COUNT(*) AS cnt
        FROM interactions
        WHERE target_user_id = ? AND date(created_at) = date('now')
        GROUP BY kind
      `,
      args: [Number(targetUserId)],
    });
    let cheerCount = 0;
    let temptCount = 0;
    for (const r of dailyRes.rows) {
      if (r.kind === 'tempt') temptCount = Number(r.cnt);
      else cheerCount = Number(r.cnt);
    }

    return NextResponse.json({
      success: true,
      interaction: {
        id: Number(insertRes.lastInsertRowid),
        senderName,
        senderEmoji,
        targetUserId: Number(targetUserId),
        targetName: String(targetRes.rows[0].name),
        targetEmoji: String(targetRes.rows[0].avatar_emoji),
        kind: finalKind,
        giftItem,
        message: cleanMsg,
        cheerCount,
        temptCount,
        netPower: cheerCount - temptCount,
        senderId: validSenderId,
        senderBonusEarned,
        receiverBonusEarned,
        senderPoints,
        dailyBonusRemaining,
      },
    });
  } catch (error) {
    console.error('POST /api/interactions error:', error);
    return NextResponse.json({ error: 'ส่งข้อความไม่สำเร็จ' }, { status: 500 });
  }
}
