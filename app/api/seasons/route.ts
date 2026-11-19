import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

export const dynamic = 'force-dynamic';

const ADMIN_PIN = '9999';
const DEFAULT_STEP_TARGET = 300000;

export async function GET() {
  try {
    const res = await turso.execute(`SELECT * FROM seasons ORDER BY id DESC`);
    const seasons = res.rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      endDate: String(r.end_date || ''),
      stepTarget: Math.max(1000, Number(r.step_target || DEFAULT_STEP_TARGET)),
      isActive: Number(r.is_active) === 1,
      createdAt: String(r.created_at || ''),
    }));
    const activeSeason = seasons.find((s) => s.isActive) || seasons[0] || null;
    return NextResponse.json({ seasons, activeSeason });
  } catch (error) {
    console.error('GET /api/seasons error:', error);
    return NextResponse.json({ error: 'ดึงข้อมูลซีซันไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { adminPin, name, endDate, stepTarget } = await req.json();
    if (String(adminPin) !== ADMIN_PIN) {
      return NextResponse.json({ error: 'รหัส Admin PIN ไม่ถูกต้อง! (ต้องใช้ 9999)' }, { status: 401 });
    }
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'กรุณาตั้งชื่อ Season' }, { status: 400 });
    }
    const safeStepTarget = Math.max(
      1000,
      Math.min(10000000, Math.round(Number(stepTarget) || DEFAULT_STEP_TARGET))
    );

    await turso.execute(`UPDATE seasons SET is_active = 0`);
    const ins = await turso.execute({
      sql: `INSERT INTO seasons (name, end_date, step_target, is_active) VALUES (?, ?, ?, 1)`,
      args: [String(name).trim(), endDate ? String(endDate).trim() : '', safeStepTarget],
    });

    const newSeasonId = Number(ins.lastInsertRowid);
    return NextResponse.json({ success: true, id: newSeasonId, stepTarget: safeStepTarget });
  } catch (error) {
    console.error('POST /api/seasons error:', error);
    return NextResponse.json({ error: 'สร้าง Season ใหม่ไม่สำเร็จ' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { adminPin, seasonId, name, endDate, stepTarget, setActive } = await req.json();
    if (String(adminPin) !== ADMIN_PIN) {
      return NextResponse.json({ error: 'รหัส Admin PIN ไม่ถูกต้อง! (ต้องใช้ 9999)' }, { status: 401 });
    }
    if (!seasonId) {
      return NextResponse.json({ error: 'ไม่พบรหัส Season' }, { status: 400 });
    }

    if (setActive) {
      await turso.execute(`UPDATE seasons SET is_active = 0`);
      await turso.execute({
        sql: `UPDATE seasons SET is_active = 1 WHERE id = ?`,
        args: [Number(seasonId)],
      });
    }

    if (typeof name === 'string' && name.trim()) {
      await turso.execute({
        sql: `UPDATE seasons SET name = ?, end_date = ? WHERE id = ?`,
        args: [name.trim(), typeof endDate === 'string' ? endDate.trim() : '', Number(seasonId)],
      });
    }

    if (stepTarget !== undefined && Number(stepTarget) >= 1000) {
      const safeStepTarget = Math.max(1000, Math.min(10000000, Math.round(Number(stepTarget))));
      await turso.execute({
        sql: `UPDATE seasons SET step_target = ? WHERE id = ?`,
        args: [safeStepTarget, Number(seasonId)],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/seasons error:', error);
    return NextResponse.json({ error: 'อัปเดต Season ไม่สำเร็จ' }, { status: 500 });
  }
}
