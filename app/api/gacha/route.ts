import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import {
  GACHA_EXCLUSIVE_ITEMS,
  GACHA_SPIN_COST,
  FREE_DEFAULT_ITEMS,
  type GachaRarity,
} from '@/lib/rpg_catalog';

function rollTargetRarity(): GachaRarity {
  const r = Math.random();
  if (r < 0.12) return 'legendary';
  if (r < 0.45) return 'epic';
  return 'rare';
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบหรือเลือกตัวละครก่อนสุ่มกาชาปอง' }, { status: 400 });
    }

    const userRes = await turso.execute({
      sql: `SELECT * FROM users WHERE id = ?`,
      args: [Number(userId)],
    });
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้เล่นนี้' }, { status: 404 });
    }
    const user = userRes.rows[0];
    const currentPoints = Number(user.points ?? 0);

    const ownedRes = await turso.execute({
      sql: `SELECT item_id FROM user_items WHERE user_id = ?`,
      args: [Number(userId)],
    });
    const ownedSet = new Set<string>([
      ...Array.from(FREE_DEFAULT_ITEMS),
      ...ownedRes.rows.map((r) => String(r.item_id)),
    ]);

    const unownedAll = GACHA_EXCLUSIVE_ITEMS.filter((it) => !ownedSet.has(it.id));
    if (unownedAll.length === 0) {
      return NextResponse.json(
        { error: `🏆 สุดยอด! คุณสะสมไอเทมแรร์จากตู้กาชาปองครบทั้ง ${GACHA_EXCLUSIVE_ITEMS.length} ชิ้นแล้ว!` },
        { status: 400 }
      );
    }

    if (currentPoints < GACHA_SPIN_COST) {
      return NextResponse.json(
        { error: `แต้มไม่พอหมุนกาชาปอง! ใช้ ${GACHA_SPIN_COST} 🪙 (คุณมี ${currentPoints} 🪙)` },
        { status: 400 }
      );
    }

    // สุ่มระดับความแรร์ (Legendary 12% / Epic 33% / Rare 55%) พร้อมระบบการันตีไม่ซ้ำ!
    const rolledRarity = rollTargetRarity();
    const unownedInTier = unownedAll.filter((it) => it.rarity === rolledRarity);
    const candidatePool = unownedInTier.length > 0 ? unownedInTier : unownedAll;
    const wonItem = candidatePool[Math.floor(Math.random() * candidatePool.length)];

    const nextPoints = currentPoints - GACHA_SPIN_COST;
    await turso.execute({
      sql: `UPDATE users SET points = ? WHERE id = ?`,
      args: [nextPoints, Number(userId)],
    });
    await turso.execute({
      sql: `INSERT OR IGNORE INTO user_items (user_id, item_id) VALUES (?, ?)`,
      args: [Number(userId), wonItem.id],
    });
    ownedSet.add(wonItem.id);

    // สวมใส่ไอเทมที่เพิ่งสุ่มได้ให้ทันทีเพื่อเห็นผลบนตัวละครเลย!
    const col =
      wonItem.category === 'hat'
        ? 'equip_hat'
        : wonItem.category === 'face'
        ? 'equip_face'
        : wonItem.category === 'armor'
        ? 'equip_armor'
        : wonItem.category === 'weapon'
        ? 'equip_weapon'
        : wonItem.category === 'wings'
        ? 'equip_wings'
        : wonItem.category === 'aura'
        ? 'equip_aura'
        : wonItem.category === 'mount'
        ? 'equip_mount'
        : 'equip_pet_gear';
    await turso.execute({
      sql: `UPDATE users SET ${col} = ? WHERE id = ?`,
      args: [wonItem.id, Number(userId)],
    });

    return NextResponse.json({
      success: true,
      wonItem,
      points: nextPoints,
      unlockedItems: Array.from(ownedSet),
      remainingUnowned: unownedAll.length - 1,
    });
  } catch (error) {
    console.error('POST /api/gacha error:', error);
    return NextResponse.json({ error: 'หมุนกาชาปองไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
