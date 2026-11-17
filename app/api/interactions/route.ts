import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

const CHEER_GIFTS = [
  '🌸 ดอกไม้ให้กำลังใจ',
  '💐 ช่อดอกไม้สุดสวย',
  '🎁 กล่องของขวัญ',
  '🏆 ถ้วยกำลังใจ',
  '🌻 ดอกทานตะวัน',
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

    let senderName = 'ผู้หวังดีทางบ้าน';
    let senderEmoji = '📣';
    if (senderId) {
      const senderRes = await turso.execute({
        sql: 'SELECT name, avatar_emoji FROM users WHERE id = ?',
        args: [senderId],
      });
      if (senderRes.rows.length > 0) {
        senderName = String(senderRes.rows[0].name);
        senderEmoji = String(senderRes.rows[0].avatar_emoji);
      }
    }

    const finalKind = kind === 'tempt' ? 'tempt' : 'cheer';
    const pool = finalKind === 'tempt' ? TEMPT_FOODS : CHEER_GIFTS;
    const giftItem = pool[Math.floor(Math.random() * pool.length)];
    const cleanMsg = typeof message === 'string' ? message.trim().slice(0, 120) : '';

    const insertRes = await turso.execute({
      sql: 'INSERT INTO interactions (sender_name, sender_emoji, target_user_id, kind, gift_item, message) VALUES (?, ?, ?, ?, ?, ?)',
      args: [senderName, senderEmoji, Number(targetUserId), finalKind, giftItem, cleanMsg],
    });

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
      },
    });
  } catch (error) {
    console.error('POST /api/interactions error:', error);
    return NextResponse.json({ error: 'ส่งข้อความไม่สำเร็จ' }, { status: 500 });
  }
}
