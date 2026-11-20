import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

interface SettleEntry {
  userId: number;
  deltaGp: number;
}

async function readGuardBank() {
  const res = await turso.execute({
    sql: 'SELECT guard_balance, guard_total_won, guard_rounds_played FROM casino_bank WHERE id = 1',
    args: [],
  });
  const row = res.rows[0];
  return {
    guardBalance: Number(row?.guard_balance ?? 0),
    guardTotalWon: Number(row?.guard_total_won ?? 0),
    guardRoundsPlayed: Number(row?.guard_rounds_played ?? 0),
  };
}

export async function GET() {
  try {
    const bank = await readGuardBank();
    return NextResponse.json(bank, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('GET /api/pokdeng error:', error);
    return NextResponse.json(
      { guardBalance: 0, guardTotalWon: 0, guardRoundsPlayed: 0 },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const rawEntries: SettleEntry[] = Array.isArray(body.entries) ? body.entries : [];
    const rakeGp = Math.max(0, Math.min(500, Math.round(Number(body.rakeGp || 0))));
    const guardPlays = Boolean(body.guardPlays ?? true);

    const updatedPlayers: Array<{ userId: number; actualDelta: number; points: number }> = [];
    let totalPlayerDelta = 0;

    for (const entry of rawEntries) {
      const uid = Number(entry.userId);
      if (!uid || uid <= 0) continue;
      const requestedDelta = Math.max(-500, Math.min(1000, Math.round(Number(entry.deltaGp || 0))));

      const uRes = await turso.execute({
        sql: 'SELECT points FROM users WHERE id = ? LIMIT 1',
        args: [uid],
      });
      if (uRes.rows.length === 0) continue;

      const curPoints = Number(uRes.rows[0].points ?? 0);
      const nextPoints = Math.max(0, curPoints + requestedDelta);
      const actualDelta = nextPoints - curPoints;

      await turso.execute({
        sql: 'UPDATE users SET points = ? WHERE id = ?',
        args: [nextPoints, uid],
      });

      updatedPlayers.push({ userId: uid, actualDelta, points: nextPoints });
      totalPlayerDelta += actualDelta;
    }

    // Dealer net gain: if Guard is the house dealer (Pok Deng / Blackjack / 1P Holdem),
    // Guard gains -totalPlayerDelta; in PvP games (Holdem 2-5P / Old Maid), Guard collects rakeGp!
    const dealerNetGp = guardPlays ? -totalPlayerDelta : rakeGp;
    const wonGain = dealerNetGp > 0 ? dealerNetGp : 0;

    await turso.execute({
      sql: `
        UPDATE casino_bank
        SET guard_balance = guard_balance + ?,
            guard_total_won = guard_total_won + ?,
            guard_rounds_played = guard_rounds_played + 1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `,
      args: [dealerNetGp, wonGain],
    });

    const bank = await readGuardBank();
    return NextResponse.json({
      success: true,
      dealerNetGp,
      updatedPlayers,
      ...bank,
    });
  } catch (error) {
    console.error('POST /api/pokdeng error:', error);
    return NextResponse.json({ error: 'บันทึกผลวงไพ่ไม่สำเร็จ' }, { status: 500 });
  }
}
