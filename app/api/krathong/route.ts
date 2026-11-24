import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import {
  isValidKrathongStyle,
  type KrathongItem,
  type KrathongStyleId,
} from '@/lib/krathong_catalog';

function mapRowToKrathong(row: Record<string, unknown>): KrathongItem {
  const rawStyle = String(row.style_id || 'lotus_classic');
  const styleId: KrathongStyleId = isValidKrathongStyle(rawStyle) ? rawStyle : 'lotus_classic';
  return {
    id: Number(row.id),
    userId: row.user_id !== null && row.user_id !== undefined ? Number(row.user_id) : null,
    userName: String(row.user_name || 'นักเดินทางริมหาด'),
    userEmoji: String(row.user_emoji || '🪷'),
    styleId,
    caption: String(row.caption || ''),
    avatarColor: String(row.avatar_color || '#F472B6'),
    avatarBand: String(row.avatar_band || '#FFE600'),
    avatarSpecies: String(row.avatar_species || 'bunny'),
    orbitSeed: Number(row.orbit_seed ?? 0),
    laneOffset: Number(row.lane_offset ?? 5.4),
    startX: row.start_x !== null && row.start_x !== undefined ? Number(row.start_x) : null,
    startZ: row.start_z !== null && row.start_z !== undefined ? Number(row.start_z) : null,
    createdAt: Number(row.created_at || Date.now()),
  };
}

export async function GET() {
  try {
    const res = await turso.execute(`
      SELECT
        id,
        user_id,
        user_name,
        user_emoji,
        style_id,
        caption,
        avatar_color,
        avatar_band,
        avatar_species,
        orbit_seed,
        lane_offset,
        start_x,
        start_z,
        created_at
      FROM krathongs
      ORDER BY created_at DESC, id DESC
      LIMIT 45
    `);
    const krathongs = res.rows.map((r) => mapRowToKrathong(r as unknown as Record<string, unknown>));
    return NextResponse.json({ krathongs });
  } catch (error) {
    console.error('GET /api/krathong error:', error);
    return NextResponse.json({ krathongs: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawUid = Number(body.userId);
    const uid = Number.isFinite(rawUid) && rawUid > 0 ? rawUid : null;

    const styleId: KrathongStyleId = isValidKrathongStyle(body.styleId)
      ? body.styleId
      : 'lotus_classic';

    const cleanCaption = String(body.caption ?? '')
      .replace(/[\r\n]+/g, ' ')
      .trim()
      .slice(0, 75);

    let userName = String(body.userName || 'นักเดินทางริมหาด').trim().slice(0, 32) || 'นักเดินทางริมหาด';
    let userEmoji = String(body.userEmoji || '🪷').trim().slice(0, 8) || '🪷';
    let avatarColor = String(body.avatarColor || '#F472B6').trim().slice(0, 16);
    let avatarBand = String(body.avatarBand || '#FFE600').trim().slice(0, 16);
    let avatarSpecies = String(body.avatarSpecies || 'bunny').trim().slice(0, 32);

    if (uid) {
      const userRes = await turso.execute({
        sql: 'SELECT name, avatar_emoji, color_hex, band_color, species FROM users WHERE id = ?',
        args: [uid],
      });
      if (userRes.rows.length > 0) {
        const u = userRes.rows[0];
        userName = String(u.name || userName);
        userEmoji = String(u.avatar_emoji || userEmoji);
        avatarColor = String(u.color_hex || avatarColor);
        avatarBand = String(u.band_color || avatarBand);
        avatarSpecies = String(u.species || avatarSpecies);
      }
    }

    const rawSeed = Number(body.orbitSeed);
    const orbitSeed = Number.isFinite(rawSeed)
      ? Math.max(0, Math.min(0.9999, rawSeed))
      : Number(Math.random().toFixed(4));

    const rawLane = Number(body.laneOffset);
    const laneOffset = Number.isFinite(rawLane)
      ? Math.max(3.6, Math.min(8.8, rawLane))
      : Number((4.0 + Math.random() * 4.2).toFixed(2));

    const startX = Number.isFinite(Number(body.startX)) ? Number(Number(body.startX).toFixed(2)) : null;
    const startZ = Number.isFinite(Number(body.startZ)) ? Number(Number(body.startZ).toFixed(2)) : null;
    const createdAt = Date.now();

    const insertRes = await turso.execute({
      sql: `
        INSERT INTO krathongs (
          user_id,
          user_name,
          user_emoji,
          style_id,
          caption,
          avatar_color,
          avatar_band,
          avatar_species,
          orbit_seed,
          lane_offset,
          start_x,
          start_z,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        uid,
        userName,
        userEmoji,
        styleId,
        cleanCaption,
        avatarColor,
        avatarBand,
        avatarSpecies,
        orbitSeed,
        laneOffset,
        startX,
        startZ,
        createdAt,
      ],
    });

    const newId = Number(insertRes.lastInsertRowid || Date.now());
    const krathong: KrathongItem = {
      id: newId,
      userId: uid,
      userName,
      userEmoji,
      styleId,
      caption: cleanCaption,
      avatarColor,
      avatarBand,
      avatarSpecies,
      orbitSeed,
      laneOffset,
      startX,
      startZ,
      createdAt,
    };

    return NextResponse.json({
      success: true,
      krathong,
    });
  } catch (error) {
    console.error('POST /api/krathong error:', error);
    return NextResponse.json(
      { error: 'ปล่อยกระทงไม่สำเร็จ กรุณาลองใหม่อีกครั้งนะ' },
      { status: 500 }
    );
  }
}
