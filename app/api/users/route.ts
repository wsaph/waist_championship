import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { GOAL_TYPES, parsePropColors } from '@/lib/rpg_catalog';

const VALID_GOAL_TYPES = new Set<string>(GOAL_TYPES.map((g) => g.id));
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);

async function getActiveSeasonId(requestedSeasonId?: number): Promise<number> {
  if (requestedSeasonId && requestedSeasonId > 0) return requestedSeasonId;
  const sRes = await turso.execute(`SELECT id FROM seasons WHERE is_active = 1 ORDER BY id DESC LIMIT 1`);
  return sRes.rows.length > 0 ? Number(sRes.rows[0].id) : 1;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      avatarEmoji,
      pinCode,
      startWeight,
      goalWeight,
      bodyWeight,
      heightCm,
      gender,
      startVal,
      targetVal,
      goalType,
      seasonId,
      taunt,
      colorHex,
      accessory,
      bandColor,
      role,
      workoutType,
      petType,
      species,
      breed,
      themeId,
      equipHat,
      equipFace,
      equipArmor,
      equipWeapon,
      equipWings,
      equipAura,
      equipPetGear,
      equipMount,
      equipMarker,
      propColors,
    } = body;

    // Everyone participates in the Step Challenge as a competitor; the 5 goal types are optional side quests!
    const finalRole = 'competitor';
    const finalGoalType =
      typeof goalType === 'string' && VALID_GOAL_TYPES.has(goalType) ? goalType : 'weight_loss';
    const isCumulative = finalGoalType === 'reps_accumulate' || finalGoalType === 'distance_accumulate';

    const rawBodyWeight =
      bodyWeight !== undefined && Number(bodyWeight) > 0 ? Number(bodyWeight) : 0;
    const rawHeightCm = heightCm !== undefined && Number(heightCm) > 0 ? Number(heightCm) : 0;
    const finalGender = gender === 'male' ? 'male' : 'female';

    const rawStartInput = startVal !== undefined ? Number(startVal) : Number(startWeight || 0);
    const rawStart = !isCumulative && !rawStartInput && rawBodyWeight > 0 ? rawBodyWeight : rawStartInput;
    const rawTarget = targetVal !== undefined ? Number(targetVal) : Number(goalWeight || 0);
    const effectiveBodyWeight = rawBodyWeight > 0 ? rawBodyWeight : !isCumulative ? rawStart : 0;

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'กรุณากรอกชื่อตัวละคร' }, { status: 400 });
    }
    if (effectiveBodyWeight < 16 || effectiveBodyWeight > 300 || rawHeightCm < 80 || rawHeightCm > 250) {
      return NextResponse.json(
        { error: 'กรุณากรอกน้ำหนัก (16–300 กก.) และส่วนสูง (80–250 ซม.) เพื่อคำนวณรูปร่าง BMI' },
        { status: 400 }
      );
    }

    const existing = await turso.execute({
      sql: 'SELECT id FROM users WHERE LOWER(name) = LOWER(?) LIMIT 1',
      args: [name.trim()],
    });
    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: 'ชื่อผู้ใช้นี้มีคนใช้แล้ว กรุณาใช้ชื่ออื่นหรือเลือกจากรายชื่อที่มีอยู่' },
        { status: 409 }
      );
    }

    const finalPin = pinCode ? String(pinCode) : '1234';
    const finalColorHex = isHex(colorHex) ? colorHex : '#F8FAFC';
    const finalBandColor = isHex(bandColor) ? bandColor : '#FFE600';
    const finalAccessory = typeof accessory === 'string' ? accessory : 'headband';
    const finalWorkout = typeof workoutType === 'string' ? workoutType : 'fit';
    const finalPet = typeof petType === 'string' ? petType : 'none';
    const finalSpecies = typeof species === 'string' && species ? species : 'farm';
    const finalBreed = typeof breed === 'string' && breed ? breed : 'bunny';
    const finalTheme = typeof themeId === 'string' && themeId ? themeId : 'none';
    const finalHat = typeof equipHat === 'string' && equipHat ? equipHat : 'none';
    const finalFace = typeof equipFace === 'string' && equipFace ? equipFace : 'face_none';
    const finalArmor = typeof equipArmor === 'string' && equipArmor ? equipArmor : 'armor_none';
    const finalWeapon = typeof equipWeapon === 'string' && equipWeapon ? equipWeapon : 'weapon_none';
    const finalWings = typeof equipWings === 'string' && equipWings ? equipWings : 'wings_none';
    const finalAura = typeof equipAura === 'string' && equipAura ? equipAura : 'aura_none';
    const finalPetGear = typeof equipPetGear === 'string' && equipPetGear ? equipPetGear : 'pet_none';
    const finalMount = typeof equipMount === 'string' && equipMount ? equipMount : 'mount_none';
    const finalMarker = typeof equipMarker === 'string' && equipMarker ? equipMarker : 'marker_wood';
    const finalPropColors = JSON.stringify(parsePropColors(propColors));

    const safeStart = finalRole === 'competitor' ? (isCumulative ? 0 : rawStart) : 0;
    const safeGoal = finalRole === 'competitor' ? rawTarget : 0;
    const safeBodyWeight = effectiveBodyWeight > 0 ? effectiveBodyWeight : 0;
    const safeHeightCm = rawHeightCm > 0 ? rawHeightCm : 0;

    const result = await turso.execute({
      sql: `INSERT INTO users (
        name, avatar_emoji, color_hex, accessory, band_color, role, workout_type, pet_type,
        pin_code, start_weight, goal_weight, body_weight, height_cm, gender, points, species, breed, theme_id,
        equip_hat, equip_face, equip_armor, equip_weapon, equip_wings, equip_aura, equip_pet_gear, equip_mount, equip_marker, prop_colors
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 60, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        name.trim(),
        avatarEmoji || '🐰',
        finalColorHex,
        finalAccessory,
        finalBandColor,
        finalRole,
        finalWorkout,
        finalPet,
        finalPin,
        safeStart,
        safeGoal,
        safeBodyWeight,
        safeHeightCm,
        finalGender,
        finalSpecies,
        finalBreed,
        finalTheme,
        finalHat,
        finalFace,
        finalArmor,
        finalWeapon,
        finalWings,
        finalAura,
        finalPetGear,
        finalMount,
        finalMarker,
        finalPropColors,
      ],
    });

    const newUserId = Number(result.lastInsertRowid);
    const activeSeasonId = await getActiveSeasonId(Number(seasonId || 0));

    if (finalRole === 'competitor') {
      await turso.execute({
        sql: `INSERT INTO season_entries (
          season_id, user_id, goal_type, start_val, current_val, target_val, max_progress_awarded
        ) VALUES (?, ?, ?, ?, ?, ?, 0)`,
        args: [activeSeasonId, newUserId, finalGoalType, safeStart, safeStart, safeGoal],
      });

      await turso.execute({
        sql: 'INSERT INTO weight_logs (user_id, weight, excuse_tag, roast_message) VALUES (?, ?, ?, ?)',
        args: [
          newUserId,
          safeStart,
          taunt || 'พร้อมชิงบัลลังก์เอวเอส 🚀',
          '🏁 ผู้กล้าหน้าใหม่ก้าวเข้าสู่อารีน่าแล้ว!',
        ],
      });
    }

    return NextResponse.json({ success: true, id: newUserId });
  } catch (error) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: 'สมัครไม่สำเร็จ ตรวจสอบการเชื่อมต่อ Turso' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const {
      userId,
      pinCode,
      isSelf,
      name,
      avatarEmoji,
      colorHex,
      accessory,
      bandColor,
      workoutType,
      petType,
      role,
      startWeight,
      goalWeight,
      bodyWeight,
      heightCm,
      gender,
      startVal,
      targetVal,
      goalType,
      seasonId,
      statusText,
      species,
      breed,
      themeId,
      equipHat,
      equipFace,
      equipArmor,
      equipWeapon,
      equipWings,
      equipAura,
      equipPetGear,
      equipMount,
      equipMarker,
      propColors,
    } = body;

    if (body.roamOnly && userId && isSelf) {
      await turso.execute({
        sql: `UPDATE users SET is_roaming = ? WHERE id = ?`,
        args: [body.isRoaming ? 1 : 0, Number(userId)],
      });
      return NextResponse.json({ success: true, isRoaming: Boolean(body.isRoaming) });
    }

    if (!userId || (!isSelf && !pinCode)) {
      return NextResponse.json({ error: 'กรุณาระบุตัวละครและรหัส PIN' }, { status: 400 });
    }

    const userCheck = await turso.execute({
      sql: 'SELECT * FROM users WHERE id = ?',
      args: [userId],
    });

    if (userCheck.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบตัวละครนี้' }, { status: 404 });
    }

    const user = userCheck.rows[0];
    if (!isSelf && String(user.pin_code) !== String(pinCode)) {
      return NextResponse.json({ error: 'รหัส PIN ไม่ถูกต้อง!' }, { status: 401 });
    }

    const nextRole = 'competitor';
    const rawStart = startVal !== undefined ? Number(startVal) : startWeight !== undefined ? Number(startWeight) : undefined;
    const rawTarget = targetVal !== undefined ? Number(targetVal) : goalWeight !== undefined ? Number(goalWeight) : undefined;

    const nextStart = rawStart !== undefined && rawStart >= 0 ? rawStart : Number(user.start_weight || 0);
    const nextGoal = rawTarget !== undefined && rawTarget >= 0 ? rawTarget : Number(user.goal_weight || 0);
    const nextBodyWeight =
      bodyWeight !== undefined && Number(bodyWeight) > 0
        ? Number(bodyWeight)
        : Number(user.body_weight || nextStart || 0);
    const nextHeightCm =
      heightCm !== undefined && Number(heightCm) > 0
        ? Number(heightCm)
        : Number(user.height_cm || 0);
    const nextGender =
      gender === 'male' || gender === 'female'
        ? gender
        : String(user.gender || 'female') === 'male'
        ? 'male'
        : 'female';

    if (
      nextRole === 'competitor' &&
      goalType !== undefined &&
      (nextBodyWeight < 16 || nextBodyWeight > 300 || nextHeightCm < 80 || nextHeightCm > 250)
    ) {
      return NextResponse.json(
        { error: 'กรุณากรอกน้ำหนัก (16–300 กก.) และส่วนสูง (80–250 ซม.) เพื่อคำนวณรูปร่าง BMI' },
        { status: 400 }
      );
    }

    const nextName = typeof name === 'string' && name.trim() ? name.trim() : String(user.name);
    if (nextName.toLowerCase() !== String(user.name).trim().toLowerCase()) {
      const dupCheck = await turso.execute({
        sql: 'SELECT id FROM users WHERE LOWER(name) = LOWER(?) AND id != ? LIMIT 1',
        args: [nextName, userId],
      });
      if (dupCheck.rows.length > 0) {
        return NextResponse.json(
          { error: 'ชื่อตัวละครนี้มีคนใช้แล้ว กรุณาตั้งชื่ออื่นนะ!' },
          { status: 409 }
        );
      }
    }
    const nextEmoji = typeof avatarEmoji === 'string' && avatarEmoji ? avatarEmoji : String(user.avatar_emoji);
    const nextColor = isHex(colorHex) ? colorHex : String(user.color_hex);
    const nextAccessory = typeof accessory === 'string' ? accessory : String(user.accessory || 'headband');
    const nextBandColor = isHex(bandColor) ? bandColor : String(user.band_color || '#FFE600');
    const nextWorkout = typeof workoutType === 'string' ? workoutType : String(user.workout_type || 'fit');
    const nextPet = typeof petType === 'string' ? petType : String(user.pet_type || 'none');
    const nextStatus =
      typeof statusText === 'string' ? statusText.trim().slice(0, 60) : String(user.status_text || '');
    const nextSpecies = typeof species === 'string' && species ? species : String(user.species || 'bunny');
    const nextBreed = typeof breed === 'string' ? breed : String(user.breed || '');
    const nextTheme = typeof themeId === 'string' && themeId ? themeId : String(user.theme_id || 'none');
    const nextHat = typeof equipHat === 'string' && equipHat ? equipHat : String(user.equip_hat || 'none');
    const nextFace = typeof equipFace === 'string' && equipFace ? equipFace : String(user.equip_face || 'face_none');
    const nextArmor = typeof equipArmor === 'string' && equipArmor ? equipArmor : String(user.equip_armor || 'armor_none');
    const nextWeapon = typeof equipWeapon === 'string' && equipWeapon ? equipWeapon : String(user.equip_weapon || 'weapon_none');
    const nextWings = typeof equipWings === 'string' && equipWings ? equipWings : String(user.equip_wings || 'wings_none');
    const nextAura = typeof equipAura === 'string' && equipAura ? equipAura : String(user.equip_aura || 'aura_none');
    const nextPetGear =
      typeof equipPetGear === 'string' && equipPetGear ? equipPetGear : String(user.equip_pet_gear || 'pet_none');
    const nextMount =
      typeof equipMount === 'string' && equipMount ? equipMount : String(user.equip_mount || 'mount_none');
    const nextMarker =
      typeof equipMarker === 'string' && equipMarker ? equipMarker : String(user.equip_marker || 'marker_wood');
    const nextPropColors =
      propColors !== undefined ? JSON.stringify(parsePropColors(propColors)) : String(user.prop_colors || '{}');

    await turso.execute({
      sql: `UPDATE users SET
        name = ?, avatar_emoji = ?, color_hex = ?, accessory = ?, band_color = ?,
        role = ?, workout_type = ?, pet_type = ?, status_text = ?,
        start_weight = ?, goal_weight = ?, body_weight = ?, height_cm = ?, gender = ?,
        species = ?, breed = ?, theme_id = ?,
        equip_hat = ?, equip_face = ?, equip_armor = ?, equip_weapon = ?, equip_wings = ?, equip_aura = ?, equip_pet_gear = ?, equip_mount = ?, equip_marker = ?, prop_colors = ?
      WHERE id = ?`,
      args: [
        nextName,
        nextEmoji,
        nextColor,
        nextAccessory,
        nextBandColor,
        nextRole,
        nextWorkout,
        nextPet,
        nextStatus,
        nextStart,
        nextGoal,
        nextBodyWeight,
        nextHeightCm,
        nextGender,
        nextSpecies,
        nextBreed,
        nextTheme,
        nextHat,
        nextFace,
        nextArmor,
        nextWeapon,
        nextWings,
        nextAura,
        nextPetGear,
        nextMount,
        nextMarker,
        nextPropColors,
        userId,
      ],
    });

    if (nextRole === 'competitor' && (goalType !== undefined || rawStart !== undefined || rawTarget !== undefined)) {
      const activeSeasonId = await getActiveSeasonId(Number(seasonId || 0));
      const existingEntry = await turso.execute({
        sql: `SELECT * FROM season_entries WHERE season_id = ? AND user_id = ? LIMIT 1`,
        args: [activeSeasonId, userId],
      });
      const finalGoalType =
        typeof goalType === 'string' && VALID_GOAL_TYPES.has(goalType)
          ? goalType
          : existingEntry.rows.length > 0
          ? String(existingEntry.rows[0].goal_type)
          : 'weight_loss';
      const isCumulative = finalGoalType === 'reps_accumulate' || finalGoalType === 'distance_accumulate';
      const entryStart = isCumulative ? 0 : nextStart;

      if (existingEntry.rows.length > 0) {
        const prevGoalType = String(existingEntry.rows[0].goal_type);
        const prevStartVal = Number(existingEntry.rows[0].start_val);
        const prevCurVal = Number(existingEntry.rows[0].current_val);
        const explicitBodyWeight =
          bodyWeight !== undefined && Number(bodyWeight) > 0 ? Number(bodyWeight) : 0;
        const bodyWeightChanged =
          !isCumulative &&
          explicitBodyWeight > 0 &&
          Math.abs(explicitBodyWeight - prevCurVal) >= 0.001;
        const curVal =
          prevGoalType !== finalGoalType
            ? entryStart
            : bodyWeightChanged
            ? explicitBodyWeight
            : Math.abs(prevCurVal - prevStartVal) < 0.001
            ? entryStart
            : prevCurVal;
        await turso.execute({
          sql: `UPDATE season_entries SET goal_type = ?, start_val = ?, current_val = ?, target_val = ?, updated_at = CURRENT_TIMESTAMP WHERE season_id = ? AND user_id = ?`,
          args: [finalGoalType, entryStart, curVal, nextGoal, activeSeasonId, userId],
        });
      } else {
        await turso.execute({
          sql: `INSERT INTO season_entries (season_id, user_id, goal_type, start_val, current_val, target_val, max_progress_awarded) VALUES (?, ?, ?, ?, ?, ?, 0)`,
          args: [activeSeasonId, userId, finalGoalType, entryStart, entryStart, nextGoal],
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/users error:', error);
    return NextResponse.json({ error: 'แก้ไขข้อมูลไม่สำเร็จ' }, { status: 500 });
  }
}
