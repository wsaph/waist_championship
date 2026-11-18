import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

export async function POST(req: Request) {
  try {
    const { username } = await req.json();
    const cleanName = typeof username === 'string' ? username.trim() : '';

    if (!cleanName) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อผู้ใช้ (Username)' }, { status: 400 });
    }

    const res = await turso.execute({
      sql: 'SELECT * FROM users WHERE LOWER(name) = LOWER(?) LIMIT 1',
      args: [cleanName],
    });

    if (res.rows.length === 0) {
      return NextResponse.json({ exists: false, username: cleanName });
    }

    const u = res.rows[0];
    return NextResponse.json({
      exists: true,
      user: {
        id: Number(u.id),
        name: String(u.name),
        emoji: String(u.avatar_emoji),
        colorHex: String(u.color_hex),
        accessory: u.accessory ? String(u.accessory) : 'headband',
        bandColor: u.band_color ? String(u.band_color) : '#FFE600',
        role: u.role === 'spectator' ? 'spectator' : 'competitor',
        workoutType: u.workout_type ? String(u.workout_type) : 'fit',
        petType: u.pet_type ? String(u.pet_type) : 'none',
      },
    });
  } catch (error) {
    console.error('POST /api/auth/signin error:', error);
    return NextResponse.json({ error: 'เข้าสู่ระบบไม่สำเร็จ' }, { status: 500 });
  }
}
