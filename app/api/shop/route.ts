import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { SHOP_ITEMS, FREE_DEFAULT_ITEMS } from '@/lib/rpg_catalog';
import { assertActiveUserSession } from '@/lib/session_guard';

export async function POST(req: Request) {
  try {
    const { userId, itemId, action, recipientId, giftMessage } = await req.json();
    if (!userId || !itemId) {
      return NextResponse.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    const kickResp = await assertActiveUserSession(req, Number(userId));
    if (kickResp) return kickResp;

    const item = SHOP_ITEMS.find((it) => it.id === itemId);
    if (!item) {
      return NextResponse.json({ error: 'ไม่พบไอเทมนี้ในร้านค้า' }, { status: 404 });
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

    // 🎁 GIFT MODE: ซื้อพรอพส่งเป็นของขวัญให้เพื่อน (หักแต้มคนส่ง → ปลดล็อกเข้าตู้เพื่อนทันที!)
    if (recipientId && Number(recipientId) !== Number(userId)) {
      const targetId = Number(recipientId);
      if (item.isGachaOnly) {
        return NextResponse.json(
          { error: '🎰 ไอเทมจากตู้Gachaส่งเป็นของขวัญไม่ได้ครับ' },
          { status: 400 }
        );
      }
      if (item.cost <= 0 || FREE_DEFAULT_ITEMS.has(itemId)) {
        return NextResponse.json(
          { error: 'ไอเทมนี้เป็นของฟรี เพื่อนมีอยู่แล้วครับ!' },
          { status: 400 }
        );
      }

      const targetRes = await turso.execute({
        sql: `SELECT id, name, avatar_emoji FROM users WHERE id = ? LIMIT 1`,
        args: [targetId],
      });
      if (targetRes.rows.length === 0) {
        return NextResponse.json({ error: 'ไม่พบผู้รับของขวัญนี้' }, { status: 404 });
      }
      const recipient = targetRes.rows[0];

      const recipientOwnedRes = await turso.execute({
        sql: `SELECT item_id FROM user_items WHERE user_id = ?`,
        args: [targetId],
      });
      const recipientOwnedSet = new Set<string>([
        ...Array.from(FREE_DEFAULT_ITEMS),
        ...recipientOwnedRes.rows.map((r) => String(r.item_id)),
      ]);
      if (recipientOwnedSet.has(itemId)) {
        return NextResponse.json(
          { error: `${String(recipient.name)} มี "${item.name}" อยู่ในตู้เสื้อผ้าแล้วครับ!` },
          { status: 400 }
        );
      }

      if (currentPoints < item.cost) {
        return NextResponse.json(
          { error: `Gacha ไม่พอส่งของขวัญ! ต้องการ ${item.cost} 💰 (คุณมี ${currentPoints} 💰)` },
          { status: 400 }
        );
      }

      const nextSenderPoints = currentPoints - item.cost;
      await turso.execute({
        sql: `UPDATE users SET points = ? WHERE id = ?`,
        args: [nextSenderPoints, Number(userId)],
      });
      await turso.execute({
        sql: `INSERT OR IGNORE INTO user_items (user_id, item_id) VALUES (?, ?)`,
        args: [targetId, itemId],
      });

      const cleanGiftMsg =
        typeof giftMessage === 'string' ? giftMessage.trim().slice(0, 100) : '';

      return NextResponse.json({
        success: true,
        gifted: true,
        points: nextSenderPoints,
        item,
        senderName: String(user.name),
        senderEmoji: String(user.avatar_emoji || '🎁'),
        recipientId: targetId,
        recipientName: String(recipient.name),
        recipientEmoji: String(recipient.avatar_emoji || '✨'),
        giftMessage: cleanGiftMsg,
      });
    }

    const ownedRes = await turso.execute({
      sql: `SELECT item_id FROM user_items WHERE user_id = ?`,
      args: [Number(userId)],
    });
    const ownedSet = new Set<string>([
      ...Array.from(FREE_DEFAULT_ITEMS),
      ...ownedRes.rows.map((r) => String(r.item_id)),
    ]);

    // Unlock if not yet owned
    let nextPoints = currentPoints;
    if (!ownedSet.has(itemId)) {
      if (item.isGachaOnly) {
        return NextResponse.json(
          { error: '🎰 ไอเทมสุดแรร์ชิ้นนี้หาซื้อไม่ได้! ต้องสุ่มจากตู้Gachaเท่านั้น' },
          { status: 400 }
        );
      }
      if (currentPoints < item.cost) {
        return NextResponse.json(
          { error: `แต้มไม่พอ! ต้องการ ${item.cost} แต้ม (คุณมี ${currentPoints} แต้ม)` },
          { status: 400 }
        );
      }
      nextPoints = currentPoints - item.cost;
      await turso.execute({
        sql: `UPDATE users SET points = ? WHERE id = ?`,
        args: [nextPoints, Number(userId)],
      });
      await turso.execute({
        sql: `INSERT OR IGNORE INTO user_items (user_id, item_id) VALUES (?, ?)`,
        args: [Number(userId), itemId],
      });
      ownedSet.add(itemId);
    }

    // Equip into its category slot unless action === 'unlock_only'
    if (action !== 'unlock_only') {
      const col =
        item.category === 'hat'
          ? 'equip_hat'
          : item.category === 'face'
          ? 'equip_face'
          : item.category === 'armor'
          ? 'equip_armor'
          : item.category === 'weapon'
          ? 'equip_weapon'
          : item.category === 'wings'
          ? 'equip_wings'
          : item.category === 'aura'
          ? 'equip_aura'
          : item.category === 'mount'
          ? 'equip_mount'
          : item.category === 'marker'
          ? 'equip_marker'
          : 'equip_pet_gear';
      await turso.execute({
        sql: `UPDATE users SET ${col} = ? WHERE id = ?`,
        args: [itemId, Number(userId)],
      });
    }

    return NextResponse.json({
      success: true,
      points: nextPoints,
      unlockedItems: Array.from(ownedSet),
      equippedItem: itemId,
      category: item.category,
    });
  } catch (error) {
    console.error('POST /api/shop error:', error);
    return NextResponse.json({ error: 'ทำรายการร้านค้าไม่สำเร็จ' }, { status: 500 });
  }
}
