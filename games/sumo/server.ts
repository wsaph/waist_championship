import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';
import { assertActiveUserSession } from '@/lib/session_guard';
import { getBangkok7AmDayKey } from '@/lib/spectator_activities';
import { resolveSumoRank, SUMO_RANKS } from './catalog';

const DAILY_WIN_COIN_CAP = 25;
const MATCH_WIN_COINS = 5;

function resolveEquippedTier(rawVal: unknown, maxTier: number): number | null {
  if (rawVal === null || rawVal === undefined || rawVal === '') return null;
  const parsed = Number(rawVal);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(maxTier, Math.floor(parsed)));
}

export async function handleSumoGet(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const uid = Number(url.searchParams.get('userId') || 0);
    const todayKey = getBangkok7AmDayKey();

    let totalXp = 0;
    let wins = 0;
    let matchesPlayed = 0;
    let dailyWinCoins = 0;
    let rawEquippedTier: unknown = null;

    if (uid > 0) {
      const res = await turso.execute({
        sql: `SELECT total_xp, wins, matches_played, equipped_rank_tier, daily_win_date, daily_win_coins
              FROM sumo_progress WHERE user_id = ? LIMIT 1`,
        args: [uid],
      });
      if (res.rows.length > 0) {
        const row = res.rows[0];
        totalXp = Number(row.total_xp ?? 0);
        wins = Number(row.wins ?? 0);
        matchesPlayed = Number(row.matches_played ?? 0);
        rawEquippedTier = row.equipped_rank_tier;
        dailyWinCoins =
          String(row.daily_win_date || '') === todayKey
            ? Number(row.daily_win_coins ?? 0)
            : 0;
      }
    }

    const lbRes = await turso.execute(`
      SELECT s.user_id, s.total_xp, s.wins, s.equipped_rank_tier, u.name, u.avatar_emoji
      FROM sumo_progress s
      JOIN users u ON u.id = s.user_id
      ORDER BY s.total_xp DESC, s.wins DESC
      LIMIT 5
    `);

    const leaderboard = lbRes.rows.map((r) => {
      const xp = Number(r.total_xp ?? 0);
      const { rank } = resolveSumoRank(xp);
      const eqTier = resolveEquippedTier(r.equipped_rank_tier, rank.tier);
      const shownRank = eqTier !== null ? SUMO_RANKS[eqTier] ?? rank : rank;
      return {
        userId: Number(r.user_id),
        name: String(r.name || 'ริกิชิ'),
        emoji: String(r.avatar_emoji || '🏯'),
        totalXp: xp,
        wins: Number(r.wins ?? 0),
        rankName: shownRank.name,
        mawashiHex: shownRank.mawashiHex,
        isYokozuna: Boolean(shownRank.isYokozuna),
      };
    });

    const resolved = resolveSumoRank(totalXp);
    const equippedRankTier = resolveEquippedTier(rawEquippedTier, resolved.rank.tier);

    return NextResponse.json({
      success: true,
      totalXp,
      wins,
      matchesPlayed,
      dailyWinCoins,
      dailyWinCoinCap: DAILY_WIN_COIN_CAP,
      equippedRankTier,
      ...resolved,
      leaderboard,
    });
  } catch (error) {
    console.error('GET /api/sumo error:', error);
    return NextResponse.json({ error: 'โหลดข้อมูลสังเวียนซูโม่ไม่สำเร็จ' }, { status: 500 });
  }
}

export async function handleSumoPatch(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const uid = Number(body.userId || 0);
    const requestedTier =
      body.tier === null || body.tier === undefined ? null : Math.floor(Number(body.tier));

    if (!uid || uid <= 0) {
      return NextResponse.json({
        success: true,
        guestMode: true,
        equippedRankTier: requestedTier,
      });
    }

    const kickResp = await assertActiveUserSession(req, uid);
    if (kickResp) return kickResp;

    const prevRes = await turso.execute({
      sql: 'SELECT total_xp FROM sumo_progress WHERE user_id = ? LIMIT 1',
      args: [uid],
    });
    const totalXp = prevRes.rows.length > 0 ? Number(prevRes.rows[0].total_xp ?? 0) : 0;
    const { rank } = resolveSumoRank(totalXp);

    if (
      requestedTier !== null &&
      (!Number.isFinite(requestedTier) || requestedTier < 0 || requestedTier > rank.tier)
    ) {
      return NextResponse.json({ error: 'ยังไม่ปลดล็อกยศซูโม่นี้' }, { status: 400 });
    }

    const nextEquippedTier = requestedTier === rank.tier ? null : requestedTier;
    await turso.execute({
      sql: `
        INSERT INTO sumo_progress (user_id, total_xp, equipped_rank_tier, updated_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          equipped_rank_tier = excluded.equipped_rank_tier,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [uid, totalXp, nextEquippedTier],
    });

    return NextResponse.json({
      success: true,
      equippedRankTier: nextEquippedTier,
    });
  } catch (error) {
    console.error('PATCH /api/sumo error:', error);
    return NextResponse.json({ error: 'เปลี่ยนผ้าคาดเอวซูโม่ไม่สำเร็จ' }, { status: 500 });
  }
}

export async function handleSumoPost(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const uid = Number(body.userId || 0);
    const won = Boolean(body.won);
    const rawXp = Math.max(
      15,
      Math.min(350, Math.round(Number(body.xpEarned || (won ? 140 : 40))))
    );

    if (!uid || uid <= 0) {
      const resolved = resolveSumoRank(rawXp);
      return NextResponse.json({
        success: true,
        guestMode: true,
        xpGained: rawXp,
        totalXp: rawXp,
        wins: won ? 1 : 0,
        matchesPlayed: 1,
        promotedRanks: [],
        promotionCoins: 0,
        winCoinsEarned: 0,
        coinsEarned: 0,
        ...resolved,
      });
    }

    const kickResp = await assertActiveUserSession(req, uid);
    if (kickResp) return kickResp;

    const userRes = await turso.execute({
      sql: 'SELECT id, points FROM users WHERE id = ? LIMIT 1',
      args: [uid],
    });
    if (userRes.rows.length === 0) {
      return NextResponse.json({ error: 'ไม่พบผู้เล่นนี้' }, { status: 404 });
    }
    const currentPoints = Number(userRes.rows[0].points ?? 0);

    const prevRes = await turso.execute({
      sql: `SELECT total_xp, wins, matches_played, max_rank_rewarded, equipped_rank_tier, daily_win_date, daily_win_coins
            FROM sumo_progress WHERE user_id = ? LIMIT 1`,
      args: [uid],
    });
    const row = prevRes.rows[0];
    const prevXp = row ? Number(row.total_xp ?? 0) : 0;
    const prevWins = row ? Number(row.wins ?? 0) : 0;
    const prevMatches = row ? Number(row.matches_played ?? 0) : 0;
    const prevMaxRewarded = row ? Number(row.max_rank_rewarded ?? 0) : 0;
    const prevEquippedRaw = row ? row.equipped_rank_tier : null;

    const todayKey = getBangkok7AmDayKey();
    const prevDailyDate = row ? String(row.daily_win_date || '') : '';
    const prevDailyWinCoins =
      prevDailyDate === todayKey ? Number(row?.daily_win_coins ?? 0) : 0;

    const prevRank = resolveSumoRank(prevXp).rank;
    const twoRanksAhead = SUMO_RANKS.find((r) => r.tier === prevRank.tier + 2) ?? null;
    let nextXp = prevXp + rawXp;
    if (twoRanksAhead && nextXp >= twoRanksAhead.minXp) {
      nextXp = Math.max(prevXp, twoRanksAhead.minXp - 1);
    }

    const xpGained = Math.max(0, nextXp - prevXp);
    const nextWins = prevWins + (won ? 1 : 0);
    const nextMatches = prevMatches + 1;
    const nextResolved = resolveSumoRank(nextXp);

    const promotedRanks = SUMO_RANKS.filter(
      (r) => r.tier > prevMaxRewarded && r.tier <= nextResolved.rank.tier
    ).slice(0, 1);
    const promotionCoins = promotedRanks.reduce((s, r) => s + r.promotionCoins, 0);
    const nextMaxRewarded = Math.max(prevMaxRewarded, nextResolved.rank.tier);

    const remainingDailyCap = Math.max(0, DAILY_WIN_COIN_CAP - prevDailyWinCoins);
    const winCoinsEarned = won ? Math.min(MATCH_WIN_COINS, remainingDailyCap) : 0;
    const nextDailyWinCoins = prevDailyWinCoins + winCoinsEarned;
    const coinsEarned = promotionCoins + winCoinsEarned;
    const nextPoints = currentPoints + coinsEarned;

    const nextEquippedTier =
      promotedRanks.length > 0
        ? null
        : resolveEquippedTier(prevEquippedRaw, nextResolved.rank.tier);

    await turso.execute({
      sql: `
        INSERT INTO sumo_progress (
          user_id, total_xp, wins, matches_played, max_rank_rewarded, equipped_rank_tier,
          daily_win_date, daily_win_coins, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          total_xp = excluded.total_xp,
          wins = excluded.wins,
          matches_played = excluded.matches_played,
          max_rank_rewarded = excluded.max_rank_rewarded,
          equipped_rank_tier = excluded.equipped_rank_tier,
          daily_win_date = excluded.daily_win_date,
          daily_win_coins = excluded.daily_win_coins,
          updated_at = CURRENT_TIMESTAMP
      `,
      args: [
        uid,
        nextXp,
        nextWins,
        nextMatches,
        nextMaxRewarded,
        nextEquippedTier,
        todayKey,
        nextDailyWinCoins,
      ],
    });

    if (coinsEarned > 0) {
      await turso.execute({
        sql: 'UPDATE users SET points = ? WHERE id = ?',
        args: [nextPoints, uid],
      });
    }

    return NextResponse.json({
      success: true,
      xpGained,
      totalXp: nextXp,
      wins: nextWins,
      matchesPlayed: nextMatches,
      dailyWinCoins: nextDailyWinCoins,
      dailyWinCoinCap: DAILY_WIN_COIN_CAP,
      equippedRankTier: nextEquippedTier,
      promotedRanks,
      promotionCoins,
      winCoinsEarned,
      coinsEarned,
      points: nextPoints,
      ...nextResolved,
    });
  } catch (error) {
    console.error('POST /api/sumo error:', error);
    return NextResponse.json({ error: 'บันทึกผลสังเวียนซูโม่ไม่สำเร็จ' }, { status: 500 });
  }
}
