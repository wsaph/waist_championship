import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { GUARD_PRANKS } from '@/lib/guard_pranks';

export async function POST(req: Request) {
  try {
    const { userId, prankId } = await req.json();
    if (!userId || !prankId) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบและเลือกวิธีแกล้งพี่ยาม' }, { status: 400 });
    }

    const prank = GUARD_PRANKS.find((p) => p.id === prankId);
    if (!prank) {
      return NextResponse.json({ error: 'ไม่พบวิธีแกล้งนี้' }, { status: 404 });
    }

    const userRes = await turso.execute({
      sql: 'SELECT id, name, points, gender FROM users WHERE id = ?',
      args: [Number(userId)],
    });
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้เล่นนี้' }, { status: 404 });
    }

    const actorGender = String(userRes.rows[0].gender || 'female') === 'male' ? 'male' : 'female';
    const currentPoints = Number(userRes.rows[0].points ?? 0);
    if (currentPoints < prank.cost) {
      return NextResponse.json(
        { error: `แต้มไม่พอแกล้งพี่ยาม! ใช้ ${prank.cost} 💰 (คุณมี ${currentPoints} 💰)` },
        { status: 400 }
      );
    }

    const nextPoints = currentPoints - prank.cost;
    await turso.execute({
      sql: 'UPDATE users SET points = ? WHERE id = ?',
      args: [nextPoints, Number(userId)],
    });

    return NextResponse.json({
      success: true,
      prank,
      points: nextPoints,
      actorGender,
    });
  } catch (error) {
    console.error('POST /api/guard-prank error:', error);
    return NextResponse.json({ error: 'แกล้งพี่ยามไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
