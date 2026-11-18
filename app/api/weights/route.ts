import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { computeBmiMeta, computeGoalProgress, FREE_DEFAULT_ITEMS, getGoalTypeMeta, parsePropColors } from '@/lib/rpg_catalog';
import { getOrSpawnLunchCoins } from '@/lib/lunch_coins';

export const dynamic = 'force-dynamic';

const ROAST_GOOD = [
  '🔥 โหดเกินปุยมุ้ย! พลังผู้กล้าพุ่งทะยานเข้าใกล้เส้นชัยแล้ว!',
  '⚡ ว้าววว อัปเลเวลรัวๆ! เพื่อนร่วมแก๊งเริ่มหนาวๆ ร้อนๆ แล้ว!',
  '👑 ทรงนี้บัลลังก์แชมป์อยู่ไม่ไกล เตรียมตัวรอรับมงทองคำ!',
];

const ROAST_BAD = [
  '🚨 อุ๊ย! พุงป่องขึ้นทันที! สงสัยเมื่อคืนแอบจัดบุฟเฟต์รอบดึก!',
  '🥓 กราฟพุ่งสวนทางเพื่อน ระวังตำแหน่ง "เจ้ามือชาบู" จะถามหานะ!',
  '🧋 แคลอรี่ไม่เคยทรยศใคร กินเข้าไปเท่าไหร่ ออกมาที่พุง 3D หมด!',
];

export async function GET(req: Request) {
  try {
    const urlObj = new URL(req.url);
    const reqSeasonId = urlObj.searchParams.get('seasonId');
    const viewerId = Number(urlObj.searchParams.get('viewerId') || 0);

    const seasonsRes = await turso.execute(`SELECT * FROM seasons ORDER BY id DESC`);
    const seasons = seasonsRes.rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      endDate: String(r.end_date || ''),
      isActive: Number(r.is_active) === 1,
      createdAt: String(r.created_at || ''),
    }));
    const activeSeason =
      (reqSeasonId ? seasons.find((s) => s.id === Number(reqSeasonId)) : null) ||
      seasons.find((s) => s.isActive) ||
      seasons[0] ||
      null;
    const seasonId = activeSeason ? activeSeason.id : 1;

    const usersRes = await turso.execute(`
      SELECT 
        u.*,
        COALESCE(
          (SELECT weight FROM weight_logs WHERE user_id = u.id ORDER BY logged_at DESC, id DESC LIMIT 1),
          u.start_weight
        ) AS current_weight,
        COALESCE(
          (SELECT excuse_tag FROM weight_logs WHERE user_id = u.id ORDER BY logged_at DESC, id DESC LIMIT 1),
          'พร้อมลุย!'
        ) AS latest_taunt
      FROM users u
      ORDER BY u.id ASC
    `);

    const entriesRes = await turso.execute({
      sql: `SELECT * FROM season_entries WHERE season_id = ?`,
      args: [seasonId],
    });
    const entryByUser: Record<number, any> = {};
    for (const row of entriesRes.rows) {
      entryByUser[Number(row.user_id)] = row;
    }

    const itemsRes = await turso.execute(`SELECT user_id, item_id FROM user_items`);
    const itemsByUser: Record<number, string[]> = {};
    for (const row of itemsRes.rows) {
      const uid = Number(row.user_id);
      if (!itemsByUser[uid]) itemsByUser[uid] = [];
      itemsByUser[uid].push(String(row.item_id));
    }

    // รีเซ็ตคะแนนเติมไฟ (+) / มารผจญ (-) ทุกวันตอน 07:00 น. เช้าเวลาไทย (ตรงกับ 00:00 UTC ของ date('now'))
    const dailyCountsRes = await turso.execute(`
      SELECT target_user_id, kind, COUNT(*) AS cnt
      FROM interactions
      WHERE date(created_at) = date('now')
      GROUP BY target_user_id, kind
    `);
    const cheerByUser: Record<number, number> = {};
    const temptByUser: Record<number, number> = {};
    for (const row of dailyCountsRes.rows) {
      const uid = Number(row.target_user_id);
      const cnt = Number(row.cnt);
      if (row.kind === 'tempt') temptByUser[uid] = cnt;
      else cheerByUser[uid] = cnt;
    }

    const todayKey = new Date().toISOString().slice(0, 10);

    const participants = usersRes.rows.map((u) => {
      const uid = Number(u.id);
      const isOwner = viewerId > 0 && uid === viewerId;
      const entry = entryByUser[uid];
      const goalType = entry ? String(entry.goal_type) : 'weight_loss';
      const isCumulative = goalType === 'reps_accumulate' || goalType === 'distance_accumulate';
      const startVal = entry ? Number(entry.start_val) : Number(u.start_weight || 65);
      const currentVal = entry ? Number(entry.current_val) : Number(u.current_weight || startVal);
      const targetVal = entry ? Number(entry.target_val) : Number(u.goal_weight || 55);
      const { pct: progressPct, diffLabel, isInFoodStall } = computeGoalProgress(goalType, startVal, currentVal, targetVal);
      const heightCm = Number(u.height_cm || 0);
      const gender = u.gender === 'male' ? 'male' : 'female';
      const storedBodyWeight = Number(u.body_weight || u.start_weight || 0);
      const liveWeightKg = !isCumulative && currentVal > 0 ? currentVal : storedBodyWeight;
      const bmiMeta = computeBmiMeta(liveWeightKg, heightCm, gender);
      const unlocked = Array.from(
        new Set([...Array.from(FREE_DEFAULT_ITEMS), ...(itemsByUser[uid] || [])])
      );
      const checkedInToday = String(u.last_checkin_date || '') === todayKey;
      const beachCoinsToday =
        String(u.coin_pickups_date || '') === todayKey ? Number(u.coin_pickups_count ?? 0) : 0;

      return {
        id: uid,
        name: String(u.name),
        emoji: String(u.avatar_emoji),
        colorHex: String(u.color_hex),
        accessory: u.accessory ? String(u.accessory) : undefined,
        bandColor: u.band_color ? String(u.band_color) : undefined,
        role: u.role === 'spectator' ? 'spectator' : 'competitor',
        workoutType: u.workout_type ? String(u.workout_type) : 'cheer',
        petType: u.pet_type ? String(u.pet_type) : 'none',
        statusText: u.status_text ? String(u.status_text) : '',
        ...(isOwner
          ? {
              startWeight: startVal,
              currentWeight: currentVal,
              goalWeight: targetVal,
              bodyWeight: liveWeightKg > 0 ? liveWeightKg : undefined,
              heightCm: heightCm > 0 ? heightCm : undefined,
              gender,
              startVal,
              currentVal,
              targetVal,
              diffLabel,
            }
          : {}),
        goalType,
        progressPct,
        isInFoodStall,
        bmiBellyScale: bmiMeta.isValid ? bmiMeta.bellyScale : undefined,
        points: Number(u.points ?? 100),
        checkedInToday,
        beachCoinsToday,
        species: u.species ? String(u.species) : 'bunny',
        breed: u.breed ? String(u.breed) : '',
        themeId: u.theme_id ? String(u.theme_id) : 'none',
        equipHat: u.equip_hat ? String(u.equip_hat) : 'none',
        equipFace: u.equip_face ? String(u.equip_face) : 'face_none',
        equipArmor: u.equip_armor ? String(u.equip_armor) : 'armor_none',
        equipWeapon: u.equip_weapon ? String(u.equip_weapon) : 'weapon_none',
        equipWings: u.equip_wings ? String(u.equip_wings) : 'wings_none',
        equipAura: u.equip_aura ? String(u.equip_aura) : 'aura_none',
        equipPetGear: u.equip_pet_gear ? String(u.equip_pet_gear) : 'pet_none',
        equipMount: u.equip_mount ? String(u.equip_mount) : 'mount_none',
        propColors: parsePropColors(u.prop_colors),
        unlockedItems: unlocked,
        taunt: String(u.latest_taunt),
        cheerCount: cheerByUser[uid] ?? 0,
        temptCount: temptByUser[uid] ?? 0,
      };
    });

    const lunchRush = await getOrSpawnLunchCoins();

    return NextResponse.json(
      {
        participants,
        seasons,
        activeSeason,
        lunchRush,
        feed: [],
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('GET /api/weights error:', error);
    return NextResponse.json({ error: 'ดึงข้อมูลไม่สำเร็จ' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId, pinCode, isSelf, weight, value, seasonId, excuseTag } = await req.json();
    const rawInput = value !== undefined ? Number(value) : Number(weight);

    const userCheck = await turso.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId],
    });

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายชื่อผู้เข้าแข่งขัน' }, { status: 404 });
    }

    const user = userCheck.rows[0];
    if (!isSelf && String(user.pin_code) !== String(pinCode)) {
      return NextResponse.json({ error: 'รหัส PIN ไม่ถูกต้อง! อย่าแอบโกงเพื่อนนะ 👀' }, { status: 401 });
    }

    // Resolve active season
    let targetSeasonId = Number(seasonId || 0);
    if (!targetSeasonId) {
      const sRes = await turso.execute(`SELECT id FROM seasons WHERE is_active = 1 ORDER BY id DESC LIMIT 1`);
      targetSeasonId = sRes.rows.length > 0 ? Number(sRes.rows[0].id) : 1;
    }

    const entryRes = await turso.execute({
      sql: `SELECT * FROM season_entries WHERE season_id = ? AND user_id = ? LIMIT 1`,
      args: [targetSeasonId, userId],
    });

    let goalType = 'weight_loss';
    let startVal = Number(user.start_weight || 65);
    let prevVal = Number(user.start_weight || 65);
    let targetVal = Number(user.goal_weight || 55);
    let prevMaxAwarded = 0;

    if (entryRes.rows.length > 0) {
      const eRow = entryRes.rows[0];
      goalType = String(eRow.goal_type || 'weight_loss');
      startVal = Number(eRow.start_val);
      prevVal = Number(eRow.current_val);
      targetVal = Number(eRow.target_val);
      prevMaxAwarded = Number(eRow.max_progress_awarded ?? 0);
    } else {
      await turso.execute({
        sql: `INSERT INTO season_entries (season_id, user_id, goal_type, start_val, current_val, target_val, max_progress_awarded) VALUES (?, ?, ?, ?, ?, ?, 0)`,
        args: [targetSeasonId, userId, goalType, startVal, prevVal, targetVal],
      });
    }

    const meta = getGoalTypeMeta(goalType);
    const nextVal = meta.isCumulative
      ? Number((prevVal + Math.max(0, rawInput)).toFixed(2))
      : Number(rawInput.toFixed(2));
    const diff = Number((nextVal - prevVal).toFixed(2));

    const { pct: nextPct, isInFoodStall } = computeGoalProgress(goalType, startVal, nextVal, targetVal);
    const nextIntPct = Math.floor(nextPct);
    let progressBonus = 0;
    let nextMaxAwarded = prevMaxAwarded;
    if (nextIntPct > prevMaxAwarded) {
      progressBonus = (nextIntPct - prevMaxAwarded) * 15;
      nextMaxAwarded = nextIntPct;
    }

    // โบนัสขยันส่งผลภารกิจประจำวัน: บันทึกครั้งแรกของวัน รับเพิ่ม +10 🪙!
    const loggedTodayRes = await turso.execute({
      sql: `SELECT COUNT(*) AS cnt FROM weight_logs WHERE user_id = ? AND date(logged_at) = date('now')`,
      args: [userId],
    });
    const dailyLogBonus = Number(loggedTodayRes.rows[0]?.cnt ?? 0) === 0 ? 10 : 0;
    const earnedPoints = progressBonus + dailyLogBonus;

    await turso.execute({
      sql: `UPDATE season_entries SET current_val = ?, max_progress_awarded = ?, updated_at = CURRENT_TIMESTAMP WHERE season_id = ? AND user_id = ?`,
      args: [nextVal, nextMaxAwarded, targetSeasonId, userId],
    });

    const nextPoints = Number(user.points ?? 100) + earnedPoints;
    if (!meta.isCumulative) {
      await turso.execute({
        sql: `UPDATE users SET points = ?, body_weight = ? WHERE id = ?`,
        args: [nextPoints, nextVal, userId],
      });
    } else if (earnedPoints > 0) {
      await turso.execute({
        sql: `UPDATE users SET points = ? WHERE id = ?`,
        args: [nextPoints, userId],
      });
    }

    const isGoodProgress =
      (goalType === 'weight_loss' && diff < 0) ||
      (goalType !== 'weight_loss' && diff > 0);
    const isRegressed =
      (goalType === 'weight_loss' && diff > 0) ||
      (!meta.isCumulative && goalType !== 'weight_loss' && diff < 0);

    // =========================================================================
    // 🤝 ระบบเล่นแชร์ปันผลสายเชียร์ (Cheer Dividend) & แทงสวนแกล้งเพื่อน (Sabotage Bounty)
    // =========================================================================
    const dividends: Array<{
      userId: number;
      name: string;
      emoji: string;
      kind: 'cheer' | 'tempt';
      stacks: number;
      payout: number;
      jackpot?: boolean;
    }> = [];

    if (isGoodProgress || progressBonus > 0 || isRegressed) {
      const backersRes = await turso.execute({
        sql: `
          SELECT i.sender_id, i.kind, COUNT(*) AS cnt, u.name, u.avatar_emoji
          FROM interactions i
          JOIN users u ON u.id = i.sender_id
          WHERE i.target_user_id = ?
            AND i.dividend_claimed = 0
            AND i.sender_id IS NOT NULL
            AND i.sender_id != ?
          GROUP BY i.sender_id, i.kind
        `,
        args: [userId, userId],
      });

      const shareBonusFromProgress = Math.round(progressBonus * 0.25);

      for (const bRow of backersRes.rows) {
        const sid = Number(bRow.sender_id);
        const bKind = String(bRow.kind) === 'tempt' ? 'tempt' : 'cheer';
        const stacks = Math.min(3, Math.max(1, Number(bRow.cnt)));

        if ((isGoodProgress || progressBonus > 0) && bKind === 'cheer') {
          // เพื่อนพัฒนาขึ้น/ได้แต้ม -> คนส่งไฟได้ปันผลเหมือนเล่นแชร์! (+8🪙/ดวง + 25% แต้มความคืบหน้าเพื่อน สูงสุด 60🪙)
          const payout = Math.min(60, stacks * 8 + shareBonusFromProgress);
          await turso.execute({
            sql: `UPDATE users SET points = points + ? WHERE id = ?`,
            args: [payout, sid],
          });
          dividends.push({
            userId: sid,
            name: String(bRow.name),
            emoji: String(bRow.avatar_emoji),
            kind: 'cheer',
            stacks,
            payout,
          });
        } else if (isRegressed && bKind === 'tempt') {
          // เพื่อนพัฒนาถอยหลัง -> สายมารที่ส่งของกินแกล้งรับทรัพย์! (ถ้าร่วงเข้าซุ้มอาหารรับแจ็กพอต 20🪙/ชิ้น!)
          const perTempt = isInFoodStall ? 20 : 12;
          const payout = Math.min(60, stacks * perTempt);
          await turso.execute({
            sql: `UPDATE users SET points = points + ? WHERE id = ?`,
            args: [payout, sid],
          });
          dividends.push({
            userId: sid,
            name: String(bRow.name),
            emoji: String(bRow.avatar_emoji),
            kind: 'tempt',
            stacks,
            payout,
            jackpot: isInFoodStall,
          });
        }
      }

      // เคลียร์รอบบิลเชียร์/แกล้งของตานี้ เพื่อเปิดรอบลงขันใหม่ในการอัปเดตครั้งถัดไป!
      await turso.execute({
        sql: `UPDATE interactions SET dividend_claimed = 1 WHERE target_user_id = ? AND dividend_claimed = 0`,
        args: [userId],
      });
    }

    const baseRoast = isGoodProgress
      ? ROAST_GOOD[Math.floor(Math.random() * ROAST_GOOD.length)]
      : diff === 0
      ? '⚖️ ค่าคงที่เป๊ะ รักษามาตรฐานผู้กล้า!'
      : ROAST_BAD[Math.floor(Math.random() * ROAST_BAD.length)];
    const roastText =
      isInFoodStall && !isGoodProgress
        ? `🍖 ตบะแตกขั้นสุด! ถูกส่งตัวไปนอนเฝ้าซุ้มอาหารริมหาดเรียบร้อย (${nextPct}%)`
        : baseRoast;

    await turso.execute({
      sql: 'INSERT INTO weight_logs (user_id, weight, excuse_tag, roast_message) VALUES (?, ?, ?, ?)',
      args: [userId, nextVal, excuseTag || 'อัปเดตภารกิจผู้กล้า', roastText],
    });

    return NextResponse.json({
      success: true,
      diff,
      roast: roastText,
      progressPct: nextPct,
      isInFoodStall,
      progressBonus,
      dailyLogBonus,
      earnedPoints,
      dividends,
      points: nextPoints,
      currentVal: nextVal,
    });
  } catch (error) {
    console.error('POST /api/weights error:', error);
    return NextResponse.json({ error: 'บันทึกข้อมูลไม่สำเร็จ' }, { status: 500 });
  }
}
