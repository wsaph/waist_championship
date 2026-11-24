import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import {
  computeBmiMeta,
  computeGoalProgress,
  computeSideQuestCoins,
  FREE_DEFAULT_ITEMS,
  getGoalTypeMeta,
  parsePropColors,
} from '@/lib/rpg_catalog';
import { getOrSpawnLunchCoins } from '@/lib/lunch_coins';
import {
  StepSyncError,
  getBangkokDateKey,
  parseStepsValue,
  recordStepsWithRewards,
  type StepSyncMode,
  type StepSyncSource,
} from '@/lib/health_sync';
import {
  assertActiveUserSession,
  extractRequestSessionToken,
  verifyOrMigrateSessionToken,
} from '@/lib/session_guard';

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
    const reqSessionToken = extractRequestSessionToken(
      req,
      urlObj.searchParams.get('sessionToken')
    );

    const seasonsRes = await turso.execute(`SELECT * FROM seasons ORDER BY id DESC`);
    const seasons = seasonsRes.rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      endDate: String(r.end_date || ''),
      stepTarget: Math.max(1000, Number(r.step_target || 300000)),
      isActive: Number(r.is_active) === 1,
      createdAt: String(r.created_at || ''),
    }));
    const activeSeason =
      (reqSeasonId ? seasons.find((s) => s.id === Number(reqSeasonId)) : null) ||
      seasons.find((s) => s.isActive) ||
      seasons[0] ||
      null;
    const seasonId = activeSeason ? activeSeason.id : 1;
    const seasonStepTarget = activeSeason ? activeSeason.stepTarget : 300000;

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
    const bkkSyncDate = getBangkokDateKey();

    let effectiveViewerId = viewerId;
    let viewerSessionValid: boolean | undefined = undefined;
    let migratedSessionToken: string | undefined = undefined;
    if (viewerId > 0) {
      const viewerRow = usersRes.rows.find((r) => Number(r.id) === viewerId);
      if (!viewerRow) {
        effectiveViewerId = 0;
        viewerSessionValid = false;
      } else {
        const sessCheck = await verifyOrMigrateSessionToken(
          viewerId,
          viewerRow.active_session_token,
          reqSessionToken
        );
        viewerSessionValid = sessCheck.valid;
        if (!sessCheck.valid) {
          effectiveViewerId = 0;
        } else if (sessCheck.migratedToken) {
          migratedSessionToken = sessCheck.migratedToken;
        }
      }
    }

    let viewerSyncedStepsToday = 0;
    if (effectiveViewerId > 0) {
      const syncRes = await turso.execute({
        sql: `SELECT max_synced_steps FROM daily_step_syncs WHERE season_id = ? AND user_id = ? AND sync_date = ? LIMIT 1`,
        args: [seasonId, effectiveViewerId, bkkSyncDate],
      });
      viewerSyncedStepsToday = Math.max(0, Number(syncRes.rows[0]?.max_synced_steps ?? 0));
    }

    const participants = usersRes.rows.map((u) => {
      const uid = Number(u.id);
      const isOwner = effectiveViewerId > 0 && uid === effectiveViewerId;
      const entry = entryByUser[uid];
      const goalType = entry ? String(entry.goal_type) : 'weight_loss';
      const isCumulative = goalType === 'reps_accumulate' || goalType === 'distance_accumulate';
      const startVal = entry ? Number(entry.start_val) : Number(u.start_weight || 65);
      const currentVal = entry ? Number(entry.current_val) : Number(u.current_weight || startVal);
      const targetVal = entry ? Number(entry.target_val) : Number(u.goal_weight || 55);
      const { pct: sideGoalProgressPct, diffLabel, isInFoodStall } = computeGoalProgress(goalType, startVal, currentVal, targetVal);
      const stepCount = entry ? Math.max(0, Number(entry.step_count ?? 0)) : 0;
      const stepProgressPct = Math.round((stepCount / Math.max(1, seasonStepTarget)) * 1000) / 10;
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
        role: 'competitor',
        isRoaming: Number(u.is_roaming ?? 0) === 1,
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
              todaySyncedSteps: viewerSyncedStepsToday,
            }
          : {}),
        goalType,
        stepCount,
        stepTarget: seasonStepTarget,
        stepProgressPct,
        sideGoalProgressPct,
        progressPct: stepProgressPct,
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
        equipMarker: u.equip_marker ? String(u.equip_marker) : 'marker_wood',
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
        ...(viewerSessionValid !== undefined ? { viewerSessionValid } : {}),
        ...(migratedSessionToken ? { migratedSessionToken } : {}),
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
    const {
      userId,
      pinCode,
      isSelf,
      logType,
      steps,
      stepMode,
      syncSource,
      weight,
      value,
      seasonId,
      excuseTag,
    } = await req.json();
    const isStepLog = logType === 'steps';
    const rawInput = value !== undefined ? Number(value) : Number(weight);

    const userCheck = await turso.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId],
    });

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบรายชื่อผู้เข้าแข่งขัน' }, { status: 404 });
    }

    const user = userCheck.rows[0];
    if (isSelf) {
      const kickResp = await assertActiveUserSession(req, Number(userId));
      if (kickResp) return kickResp;
    } else if (String(user.pin_code) !== String(pinCode)) {
      return NextResponse.json({ error: 'รหัส PIN ไม่ถูกต้อง! อย่าแอบโกงเพื่อนนะ 👀' }, { status: 401 });
    }

    if (isStepLog) {
      const mode: StepSyncMode =
        stepMode === 'daily_sync' ? 'daily_sync' : stepMode === 'set' ? 'set' : 'add';
      const parsedSteps = parseStepsValue(steps, false);
      if (!parsedSteps.ok) {
        return NextResponse.json({ error: parsedSteps.error }, { status: 400 });
      }
      const validSources = new Set<StepSyncSource>([
        'apple_shortcut',
        'ocr_screenshot',
        'web_daily_sync',
        'manual_add',
        'manual_set',
      ]);
      const source: StepSyncSource =
        typeof syncSource === 'string' && validSources.has(syncSource as StepSyncSource)
          ? (syncSource as StepSyncSource)
          : mode === 'daily_sync'
          ? 'web_daily_sync'
          : mode === 'set'
          ? 'manual_set'
          : 'manual_add';

      try {
        const stepResult = await recordStepsWithRewards({
          userId: Number(userId),
          mode,
          stepsInput: parsedSteps.steps,
          seasonId: Number(seasonId || 0) > 0 ? Number(seasonId) : undefined,
          source,
          note: typeof excuseTag === 'string' && excuseTag.trim() ? excuseTag.trim() : undefined,
        });
        return NextResponse.json(stepResult);
      } catch (err) {
        if (err instanceof StepSyncError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
    }

    // Resolve active season & step target
    let targetSeasonId = Number(seasonId || 0);
    let seasonStepTarget = 300000;
    if (targetSeasonId > 0) {
      const sRes = await turso.execute({
        sql: `SELECT id, step_target FROM seasons WHERE id = ? LIMIT 1`,
        args: [targetSeasonId],
      });
      if (sRes.rows.length > 0) {
        seasonStepTarget = Math.max(1000, Number(sRes.rows[0].step_target || 300000));
      }
    } else {
      const sRes = await turso.execute(`SELECT id, step_target FROM seasons WHERE is_active = 1 ORDER BY id DESC LIMIT 1`);
      if (sRes.rows.length > 0) {
        targetSeasonId = Number(sRes.rows[0].id);
        seasonStepTarget = Math.max(1000, Number(sRes.rows[0].step_target || 300000));
      } else {
        targetSeasonId = 1;
      }
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
    let prevSideCoinsAwarded = 0;
    let prevStepCount = 0;

    if (entryRes.rows.length > 0) {
      const eRow = entryRes.rows[0];
      goalType = String(eRow.goal_type || 'weight_loss');
      startVal = Number(eRow.start_val);
      prevVal = Number(eRow.current_val);
      targetVal = Number(eRow.target_val);
      prevMaxAwarded = Number(eRow.max_progress_awarded ?? 0);
      prevSideCoinsAwarded = Number(eRow.side_coins_awarded ?? 0);
      // กรณีข้อมูลเก่าก่อนเพิ่มคอลัมน์ side_coins_awarded: กันจ่ายซ้ำสำหรับผลงานเดิมที่เคยรับเหรียญไปแล้ว
      if (prevSideCoinsAwarded === 0 && prevMaxAwarded > 0) {
        prevSideCoinsAwarded = computeSideQuestCoins(goalType, startVal, prevVal);
      }
      prevStepCount = Math.max(0, Number(eRow.step_count ?? 0));
    } else {
      await turso.execute({
        sql: `INSERT INTO season_entries (season_id, user_id, goal_type, start_val, current_val, target_val, max_progress_awarded, side_coins_awarded, step_count, max_steps_pct_awarded) VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0)`,
        args: [targetSeasonId, userId, goalType, startVal, prevVal, targetVal],
      });
    }

    // โบนัสขยันส่งผลภารกิจประจำวัน (แชร์ร่วมกันระหว่างก้าวเดินและภารกิจรอง): บันทึกครั้งแรกของวัน รับเพิ่ม +10 🪙!
    const [wTodayRes, sTodayRes] = await Promise.all([
      turso.execute({
        sql: `SELECT COUNT(*) AS cnt FROM weight_logs WHERE user_id = ? AND date(logged_at) = date('now')`,
        args: [userId],
      }),
      turso.execute({
        sql: `SELECT COUNT(*) AS cnt FROM step_logs WHERE user_id = ? AND date(logged_at) = date('now') AND steps_added > 0`,
        args: [userId],
      }),
    ]);
    const loggedAnyToday =
      Number(wTodayRes.rows[0]?.cnt ?? 0) + Number(sTodayRes.rows[0]?.cnt ?? 0) > 0;
    const dailyLogBonus = loggedAnyToday ? 0 : 10;

    if (Number.isNaN(rawInput) || rawInput <= 0) {
      return NextResponse.json({ error: 'กรุณากรอกตัวเลขที่ถูกต้องมากกว่า 0' }, { status: 400 });
    }
    const meta = getGoalTypeMeta(goalType);
    const nextVal = meta.isCumulative
      ? Number((prevVal + Math.max(0, rawInput)).toFixed(2))
      : Number(rawInput.toFixed(2));
    const diff = Number((nextVal - prevVal).toFixed(2));

    const sideCalc = computeGoalProgress(goalType, startVal, nextVal, targetVal);
    const nextPct = sideCalc.pct;
    const isInFoodStall = sideCalc.isInFoodStall;

    // แนวทาง A: แจกเหรียญภารกิจรองตาม "ปริมาณที่ทำได้จริง" (ไม่สน % เป้าที่ตั้งเอง) สูงสุด 500 🪙/ซีซั่น
    // - ลด/เพิ่มน้ำหนัก/ปั้นกล้าม: +80 🪙/กก. | สะสมระยะทาง: +10 🪙/กม. | สะสมครั้ง: +1 🪙/10 ครั้ง
    const nextIntPct = Math.min(100, Math.floor(nextPct));
    const nextMaxAwarded = Math.max(prevMaxAwarded, nextIntPct);
    const totalEligibleSideCoins = computeSideQuestCoins(goalType, startVal, nextVal);
    let progressBonus = 0;
    let nextSideCoinsAwarded = prevSideCoinsAwarded;
    if (totalEligibleSideCoins > prevSideCoinsAwarded) {
      progressBonus = totalEligibleSideCoins - prevSideCoinsAwarded;
      nextSideCoinsAwarded = totalEligibleSideCoins;
    }

    const earnedPoints = progressBonus + dailyLogBonus;
    const nextPoints = Number(user.points ?? 100) + earnedPoints;

    await turso.execute({
      sql: `UPDATE season_entries SET current_val = ?, max_progress_awarded = ?, side_coins_awarded = ?, updated_at = CURRENT_TIMESTAMP WHERE season_id = ? AND user_id = ?`,
      args: [nextVal, nextMaxAwarded, nextSideCoinsAwarded, targetSeasonId, userId],
    });

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
    // จำกัดเพดานปันผลสูงสุด 40 🪙/คน/วัน (รีเซ็ต 07:00 น. เวลาไทย = 00:00 UTC) เพื่อกันปั๊มเหรียญกาชาเฟ้อ
    // =========================================================================
    const DAILY_DIVIDEND_CAP = 40;
    const todayKey = new Date().toISOString().slice(0, 10);
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
          SELECT i.sender_id, i.kind, COUNT(*) AS cnt, u.name, u.avatar_emoji,
                 u.dividend_earned_date, u.dividend_earned_today
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
      const earnedTodayMap = new Map<number, number>();

      for (const bRow of backersRes.rows) {
        const sid = Number(bRow.sender_id);
        const bKind = String(bRow.kind) === 'tempt' ? 'tempt' : 'cheer';
        const stacks = Math.min(3, Math.max(1, Number(bRow.cnt)));

        if (!earnedTodayMap.has(sid)) {
          const prevDate = String(bRow.dividend_earned_date || '');
          const prevAmt = prevDate === todayKey ? Number(bRow.dividend_earned_today ?? 0) : 0;
          earnedTodayMap.set(sid, prevAmt);
        }
        const alreadyToday = earnedTodayMap.get(sid) ?? 0;
        const remainingCap = Math.max(0, DAILY_DIVIDEND_CAP - alreadyToday);
        if (remainingCap <= 0) continue;

        if ((isGoodProgress || progressBonus > 0) && bKind === 'cheer') {
          // เพื่อนพัฒนาขึ้น/ได้แต้ม -> คนส่งไฟได้ปันผลเหมือนเล่นแชร์! (+8🪙/ดวง + 25% แต้มความคืบหน้าเพื่อน สูงสุดไม่เกินเพดาน 40🪙/วัน)
          const rawPayout = Math.min(DAILY_DIVIDEND_CAP, stacks * 8 + shareBonusFromProgress);
          const payout = Math.min(rawPayout, remainingCap);
          if (payout > 0) {
            const nextToday = alreadyToday + payout;
            earnedTodayMap.set(sid, nextToday);
            await turso.execute({
              sql: `UPDATE users SET points = points + ?, dividend_earned_date = ?, dividend_earned_today = ? WHERE id = ?`,
              args: [payout, todayKey, nextToday, sid],
            });
            dividends.push({
              userId: sid,
              name: String(bRow.name),
              emoji: String(bRow.avatar_emoji),
              kind: 'cheer',
              stacks,
              payout,
            });
          }
        } else if (isRegressed && bKind === 'tempt') {
          // เพื่อนพัฒนาถอยหลัง -> สายมารที่ส่งของกินแกล้งรับทรัพย์! (ถ้าร่วงเข้าซุ้มอาหารรับแจ็กพอต 20🪙/ชิ้น สูงสุดไม่เกินเพดาน 40🪙/วัน)
          const perTempt = isInFoodStall ? 20 : 12;
          const rawPayout = Math.min(DAILY_DIVIDEND_CAP, stacks * perTempt);
          const payout = Math.min(rawPayout, remainingCap);
          if (payout > 0) {
            const nextToday = alreadyToday + payout;
            earnedTodayMap.set(sid, nextToday);
            await turso.execute({
              sql: `UPDATE users SET points = points + ?, dividend_earned_date = ?, dividend_earned_today = ? WHERE id = ?`,
              args: [payout, todayKey, nextToday, sid],
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
      }

      // เคลียร์รอบบิลเชียร์/แกล้งของตานี้ เพื่อเปิดรอบลงขันใหม่ในการอัปเดตครั้งถัดไป!
      await turso.execute({
        sql: `UPDATE interactions SET dividend_claimed = 1 WHERE target_user_id = ? AND dividend_claimed = 0`,
        args: [userId],
      });
    }

    const roastText =
      isInFoodStall && !isGoodProgress
        ? `🍖 ตบะแตกขั้นสุด! ถูกส่งตัวไปนอนเฝ้าซุ้มอาหารริมหาดเรียบร้อย (${nextPct}%)`
        : isGoodProgress
        ? ROAST_GOOD[Math.floor(Math.random() * ROAST_GOOD.length)]
        : diff === 0
        ? '⚖️ ค่าคงที่เป๊ะ รักษามาตรฐานผู้กล้า!'
        : ROAST_BAD[Math.floor(Math.random() * ROAST_BAD.length)];

    await turso.execute({
      sql: 'INSERT INTO weight_logs (user_id, weight, excuse_tag, roast_message) VALUES (?, ?, ?, ?)',
      args: [userId, nextVal, excuseTag || 'อัปเดตภารกิจผู้กล้า', roastText],
    });

    return NextResponse.json({
      success: true,
      logType: 'side_goal',
      diff,
      roast: roastText,
      progressPct: nextPct,
      stepCount: prevStepCount,
      stepTarget: seasonStepTarget,
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
