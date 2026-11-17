import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

const COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#A06CD5', '#FF9F1C', '#2EC4B6', '#FF70A6'];

export async function POST(req: Request) {
  try {
    const { name, avatarEmoji, pinCode, startWeight, goalWeight } = await req.json();

    if (!name || !pinCode || !startWeight || !goalWeight) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }

    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    const result = await turso.execute({
      sql: 'INSERT INTO users (name, avatar_emoji, color_hex, pin_code, start_weight, goal_weight) VALUES (?, ?, ?, ?, ?, ?)',
      args: [name.trim(), avatarEmoji || '🦊', randomColor, String(pinCode), Number(startWeight), Number(goalWeight)],
    });

    const newUserId = Number(result.lastInsertRowid);

    await turso.execute({
      sql: 'INSERT INTO weight_logs (user_id, weight, excuse_tag, roast_message) VALUES (?, ?, ?, ?)',
      args: [newUserId, Number(startWeight), 'ลงทะเบียนเข้าสู่สนามแข่ง 🚀', '(0.0 กก.) พร้อมชิงบัลลังก์เอวเอสแล้ว!'],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: 'สมัครไม่สำเร็จ' }, { status: 500 });
  }
}
