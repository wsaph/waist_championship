import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

const PALETTE = [
  { bodyColor: 0x38BDF8, bandColor: 0xFFE600, accessory: 'headband' },
  { bodyColor: 0xA3E635, bandColor: 0xFF4D8D, accessory: 'ears' },
  { bodyColor: 0xFACC15, bandColor: 0x18181B, accessory: 'shades' },
  { bodyColor: 0xF472B6, bandColor: 0xFFFFFF, accessory: 'cat' },
  { bodyColor: 0xFB923C, bandColor: 0xEF4444, accessory: 'chubby' },
  { bodyColor: 0xC084FC, bandColor: 0xFFE600, accessory: 'ears' },
];

export async function POST(req: Request) {
  try {
    const { name, avatarEmoji, pinCode, startWeight, goalWeight, taunt } = await req.json();

    if (!name || !pinCode || !startWeight || !goalWeight) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }

    const style = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const colorHex = '#' + style.bodyColor.toString(16).padStart(6, '0');

    const result = await turso.execute({
      sql: 'INSERT INTO users (name, avatar_emoji, color_hex, pin_code, start_weight, goal_weight) VALUES (?, ?, ?, ?, ?, ?)',
      args: [name.trim(), avatarEmoji || '🦊', colorHex, String(pinCode), Number(startWeight), Number(goalWeight)],
    });

    const newUserId = Number(result.lastInsertRowid);

    await turso.execute({
      sql: 'INSERT INTO weight_logs (user_id, weight, excuse_tag, roast_message) VALUES (?, ?, ?, ?)',
      args: [
        newUserId,
        Number(startWeight),
        taunt || 'พร้อมชิงบัลลังก์เอวเอส 🚀',
        '🏁 ลงสนามใหม่แกะกล่อง เตรียมปาดหน้าเพื่อนร่วมแก๊ง!'
      ],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: 'สมัครไม่สำเร็จ ตรวจสอบการเชื่อมต่อ Turso' }, { status: 500 });
  }
}
