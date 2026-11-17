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

const ALLOWED_ACCESSORIES = new Set(['headband', 'ears', 'cat', 'shades', 'cap', 'none', 'chubby']);
const ALLOWED_WORKOUTS = new Set([
  'fit',
  'eat',
  'squat',
  'dumbbell',
  'cheer',
  'pullup',
  'pushup',
  'situp',
  'picnic_shabu',
  'eat_pizza',
  'boba_tea',
  'food_roll',
]);
const ALLOWED_PETS = new Set(['none', 'dog', 'cat', 'rabbit', 'pig']);
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9A-Fa-f]{6}$/.test(v);

export async function POST(req: Request) {
  try {
    const {
      name,
      avatarEmoji,
      pinCode,
      startWeight,
      goalWeight,
      taunt,
      colorHex,
      accessory,
      bandColor,
      role,
      workoutType,
      petType,
    } = await req.json();

    const finalRole = role === 'spectator' ? 'spectator' : 'competitor';

    if (!name || !pinCode || (finalRole === 'competitor' && (!startWeight || !goalWeight))) {
      return NextResponse.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
    }

    const style = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    const finalColorHex = isHex(colorHex) ? colorHex : '#' + style.bodyColor.toString(16).padStart(6, '0');
    const finalBandColor = isHex(bandColor) ? bandColor : '#' + style.bandColor.toString(16).padStart(6, '0');
    const finalAccessory = typeof accessory === 'string' && ALLOWED_ACCESSORIES.has(accessory) ? accessory : style.accessory;
    const finalWorkout = typeof workoutType === 'string' && ALLOWED_WORKOUTS.has(workoutType) ? workoutType : 'fit';
    const finalPet = finalRole === 'competitor' && typeof petType === 'string' && ALLOWED_PETS.has(petType) ? petType : 'none';
    const safeStart = finalRole === 'competitor' ? Number(startWeight) : 0;
    const safeGoal = finalRole === 'competitor' ? Number(goalWeight) : 0;

    const result = await turso.execute({
      sql: 'INSERT INTO users (name, avatar_emoji, color_hex, accessory, band_color, role, workout_type, pet_type, pin_code, start_weight, goal_weight) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        name.trim(),
        avatarEmoji || '🦊',
        finalColorHex,
        finalAccessory,
        finalBandColor,
        finalRole,
        finalWorkout,
        finalPet,
        String(pinCode),
        safeStart,
        safeGoal,
      ],
    });

    const newUserId = Number(result.lastInsertRowid);

    if (finalRole === 'competitor') {
      await turso.execute({
        sql: 'INSERT INTO weight_logs (user_id, weight, excuse_tag, roast_message) VALUES (?, ?, ?, ?)',
        args: [
          newUserId,
          safeStart,
          taunt || 'พร้อมชิงบัลลังก์เอวเอส 🚀',
          '🏁 ลงสนามใหม่แกะกล่อง เตรียมปาดหน้าเพื่อนร่วมแก๊ง!'
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
    const { userId, pinCode, name, avatarEmoji, colorHex, accessory, bandColor, workoutType, petType } = await req.json();

    if (!userId || !pinCode) {
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
    if (String(user.pin_code) !== String(pinCode)) {
      return NextResponse.json({ error: 'รหัส PIN ไม่ถูกต้อง! อย่าแอบเปลี่ยนชุดเพื่อนนะ 👀' }, { status: 401 });
    }

    const nextName = typeof name === 'string' && name.trim() ? name.trim() : String(user.name);
    const nextEmoji = typeof avatarEmoji === 'string' && avatarEmoji ? avatarEmoji : String(user.avatar_emoji);
    const nextColor = isHex(colorHex) ? colorHex : String(user.color_hex);
    const nextAccessory =
      typeof accessory === 'string' && ALLOWED_ACCESSORIES.has(accessory)
        ? accessory
        : String(user.accessory || 'headband');
    const nextBandColor = isHex(bandColor) ? bandColor : String(user.band_color || '#FFE600');
    const nextWorkout =
      typeof workoutType === 'string' && ALLOWED_WORKOUTS.has(workoutType)
        ? workoutType
        : String(user.workout_type || 'jumping_jacks');
    const nextPet =
      typeof petType === 'string' && ALLOWED_PETS.has(petType)
        ? petType
        : String(user.pet_type || 'none');

    await turso.execute({
      sql: 'UPDATE users SET name = ?, avatar_emoji = ?, color_hex = ?, accessory = ?, band_color = ?, workout_type = ?, pet_type = ? WHERE id = ?',
      args: [nextName, nextEmoji, nextColor, nextAccessory, nextBandColor, nextWorkout, nextPet, userId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/users error:', error);
    return NextResponse.json({ error: 'อัปเดตตัวละครไม่สำเร็จ' }, { status: 500 });
  }
}
