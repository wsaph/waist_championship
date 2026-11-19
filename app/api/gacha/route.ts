import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import {
  GACHA_EXCLUSIVE_ITEMS,
  GACHA_SPIN_COST,
  GACHA_MULTI_COUNT,
  GACHA_MULTI_COST,
  GACHA_DUPLICATE_REFUND,
  FREE_DEFAULT_ITEMS,
  type GachaRarity,
  type GachaRollResult,
} from '@/lib/rpg_catalog';

function rollTargetRarity(): GachaRarity {
  const r = Math.random();
  if (r < 0.12) return 'legendary';
  if (r < 0.45) return 'epic';
  return 'rare';
}

const RARITY_RANK: Record<GachaRarity, number> = {
  rare: 1,
  epic: 2,
  legendary: 3,
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, count } = body;
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

    const actualCount = Number(count) === GACHA_MULTI_COUNT ? GACHA_MULTI_COUNT : 1;
    const totalCost = actualCount === GACHA_MULTI_COUNT ? GACHA_MULTI_COST : GACHA_SPIN_COST;

    if (currentPoints < totalCost) {
      return NextResponse.json(
        { error: `แต้มไม่พอสุ่มกาชาปอง ×${actualCount}! ใช้ ${totalCost.toLocaleString()} 🪙 (คุณมี ${currentPoints.toLocaleString()} 🪙)` },
        { status: 400 }
      );
    }

    // สุ่มจากตู้ทั้งหมด (Legendary 12% / Epic 33% / Rare 55%) — ออกซ้ำได้พร้อมคืนแต้มทันที!
    // ถ้าสุ่ม ×8 การันตีอย่างน้อย 1 ชิ้นระดับ Epic ขึ้นไป
    const results: GachaRollResult[] = [];
    const newItemIds: string[] = [];
    let totalRefund = 0;

    for (let i = 0; i < actualCount; i++) {
      const isLastOfMulti = actualCount >= GACHA_MULTI_COUNT && i === actualCount - 1;
      const hasHighTierAlready = results.some(
        (r) => r.item.rarity === 'epic' || r.item.rarity === 'legendary'
      );

      let candidatePool = GACHA_EXCLUSIVE_ITEMS;
      if (isLastOfMulti && !hasHighTierAlready) {
        const highTier = GACHA_EXCLUSIVE_ITEMS.filter(
          (it) => it.rarity === 'epic' || it.rarity === 'legendary'
        );
        if (highTier.length > 0) candidatePool = highTier;
      } else {
        const rolledRarity = rollTargetRarity();
        const inTier = GACHA_EXCLUSIVE_ITEMS.filter((it) => it.rarity === rolledRarity);
        if (inTier.length > 0) candidatePool = inTier;
      }

      const picked = candidatePool[Math.floor(Math.random() * candidatePool.length)];
      const isDuplicate = ownedSet.has(picked.id);
      const refundPoints = isDuplicate ? GACHA_DUPLICATE_REFUND[picked.rarity || 'rare'] : 0;

      if (isDuplicate) {
        totalRefund += refundPoints;
      } else {
        ownedSet.add(picked.id);
        newItemIds.push(picked.id);
      }

      results.push({ item: picked, isDuplicate, refundPoints });
    }

    const nextPoints = currentPoints - totalCost + totalRefund;
    await turso.execute({
      sql: `UPDATE users SET points = ? WHERE id = ?`,
      args: [nextPoints, Number(userId)],
    });

    for (const itemId of newItemIds) {
      await turso.execute({
        sql: `INSERT OR IGNORE INTO user_items (user_id, item_id) VALUES (?, ?)`,
        args: [Number(userId), itemId],
      });
    }

    const wonItems = results.map((r) => r.item);
    const bestNew = results
      .filter((r) => !r.isDuplicate)
      .sort(
        (a, b) =>
          (RARITY_RANK[b.item.rarity || 'rare'] || 1) - (RARITY_RANK[a.item.rarity || 'rare'] || 1)
      )[0]?.item;

    const bestItem =
      bestNew ||
      [...wonItems].sort(
        (a, b) => (RARITY_RANK[b.rarity || 'rare'] || 1) - (RARITY_RANK[a.rarity || 'rare'] || 1)
      )[0];

    // สวมใส่ชิ้นใหม่ที่แรร์ที่สุดให้อัตโนมัติ (ถ้าออกซ้ำทั้งหมดจะไม่ไปเปลี่ยนชุดที่ใส่อยู่)
    if (bestNew) {
      const col =
        bestNew.category === 'hat'
          ? 'equip_hat'
          : bestNew.category === 'face'
          ? 'equip_face'
          : bestNew.category === 'armor'
          ? 'equip_armor'
          : bestNew.category === 'weapon'
          ? 'equip_weapon'
          : bestNew.category === 'wings'
          ? 'equip_wings'
          : bestNew.category === 'aura'
          ? 'equip_aura'
          : bestNew.category === 'mount'
          ? 'equip_mount'
          : 'equip_pet_gear';
      await turso.execute({
        sql: `UPDATE users SET ${col} = ? WHERE id = ?`,
        args: [bestNew.id, Number(userId)],
      });
    }

    const remainingUnowned = GACHA_EXCLUSIVE_ITEMS.filter((it) => !ownedSet.has(it.id)).length;

    return NextResponse.json({
      success: true,
      wonItem: bestItem,
      wonItems,
      results,
      totalRefund,
      points: nextPoints,
      spentPoints: totalCost,
      unlockedItems: Array.from(ownedSet),
      remainingUnowned,
    });
  } catch (error) {
    console.error('POST /api/gacha error:', error);
    return NextResponse.json({ error: 'หมุนกาชาปองไม่สำเร็จ กรุณาลองใหม่' }, { status: 500 });
  }
}
