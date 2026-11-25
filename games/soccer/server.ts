import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

export async function handleSoccerLeaderboardGet(): Promise<Response> {
  try {
    const [leadersRes, matchesRes] = await Promise.all([
      turso.execute(`
        SELECT player_name, model_id, wins, losses, goals_scored, matches_played, updated_at
        FROM penalty_player_stats
        ORDER BY wins DESC, goals_scored DESC, matches_played ASC
        LIMIT 30
      `),
      turso.execute(`
        SELECT id, match_uid, room_code, winner_name, loser_name, winner_model, loser_model,
               winner_score, loser_score, total_rounds, sudden_death, duration_seconds, played_at
        FROM penalty_matches
        ORDER BY id DESC
        LIMIT 15
      `),
    ]);

    const leaders = leadersRes.rows.map((r) => ({
      player_name: String(r.player_name || ''),
      model_id: String(r.model_id || 'fox_hero'),
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      goals_scored: Number(r.goals_scored ?? 0),
      matches_played: Number(r.matches_played ?? 0),
      updated_at: String(r.updated_at || ''),
    }));

    const recentMatches = matchesRes.rows.map((r) => ({
      id: Number(r.id ?? 0),
      match_uid: String(r.match_uid || ''),
      room_code: String(r.room_code || ''),
      winner_name: String(r.winner_name || ''),
      loser_name: String(r.loser_name || ''),
      winner_model: String(r.winner_model || 'fox_hero'),
      loser_model: String(r.loser_model || 'bunny_hero'),
      winner_score: Number(r.winner_score ?? 0),
      loser_score: Number(r.loser_score ?? 0),
      total_rounds: Number(r.total_rounds ?? 5),
      sudden_death: Boolean(Number(r.sudden_death ?? 0)),
      duration_seconds: Number(r.duration_seconds ?? 0),
      played_at: String(r.played_at || ''),
    }));

    return NextResponse.json(
      { leaders, recentMatches },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('GET /api/penalty/leaderboard error:', error);
    return NextResponse.json({ leaders: [], recentMatches: [] }, { status: 500 });
  }
}

export async function handleSoccerLeaderboardPost(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const matchUid = String(body.matchUid || '').trim();
    const roomCode = String(body.roomCode || 'LOCAL').trim().slice(0, 8);
    const winnerName = String(body.winnerName || '').trim().slice(0, 28);
    const loserName = String(body.loserName || '').trim().slice(0, 28);
    const winnerModel = String(body.winnerModel || 'fox_hero').slice(0, 48);
    const loserModel = String(body.loserModel || 'bunny_hero').slice(0, 48);
    const winnerScore = Math.max(0, Math.round(Number(body.winnerScore ?? 0)));
    const loserScore = Math.max(0, Math.round(Number(body.loserScore ?? 0)));
    const totalRounds = Math.max(1, Math.round(Number(body.totalRounds ?? 5)));
    const suddenDeath = body.suddenDeath ? 1 : 0;
    const durationSeconds = Math.max(0, Math.round(Number(body.durationSeconds ?? 0)));

    if (!matchUid || !winnerName || !loserName) {
      return NextResponse.json({ error: 'Missing required match fields' }, { status: 400 });
    }

    const ins = await turso.execute({
      sql: `
        INSERT OR IGNORE INTO penalty_matches
          (match_uid, room_code, winner_name, loser_name, winner_model, loser_model,
           winner_score, loser_score, total_rounds, sudden_death, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        matchUid,
        roomCode,
        winnerName,
        loserName,
        winnerModel,
        loserModel,
        winnerScore,
        loserScore,
        totalRounds,
        suddenDeath,
        durationSeconds,
      ],
    });

    if (Number(ins.rowsAffected ?? 0) > 0) {
      const rawEntries = Array.isArray(body.playerEntries) ? body.playerEntries : [];
      const humanEntries = rawEntries
        .filter((e: Record<string, unknown>) => !e?.isBot && String(e?.name || '').trim().length > 0)
        .slice(0, 6);

      if (humanEntries.length > 0) {
        for (const e of humanEntries) {
          const pName = String(e.name || '').trim().slice(0, 28);
          const pModel = String(e.modelId || 'fox_hero').slice(0, 48);
          const won = Boolean(e.won);
          const goals = Math.max(0, Math.round(Number(e.goals ?? 0)));
          await turso.execute({
            sql: `
              INSERT INTO penalty_player_stats (player_name, model_id, wins, losses, goals_scored, matches_played, updated_at)
              VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
              ON CONFLICT(player_name) DO UPDATE SET
                model_id = excluded.model_id,
                wins = penalty_player_stats.wins + excluded.wins,
                losses = penalty_player_stats.losses + excluded.losses,
                goals_scored = penalty_player_stats.goals_scored + excluded.goals_scored,
                matches_played = penalty_player_stats.matches_played + 1,
                updated_at = CURRENT_TIMESTAMP
            `,
            args: [pName, pModel, won ? 1 : 0, won ? 0 : 1, goals],
          });
        }
      } else {
        await turso.execute({
          sql: `
            INSERT INTO penalty_player_stats (player_name, model_id, wins, losses, goals_scored, matches_played, updated_at)
            VALUES (?, ?, 1, 0, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(player_name) DO UPDATE SET
              model_id = excluded.model_id,
              wins = penalty_player_stats.wins + 1,
              goals_scored = penalty_player_stats.goals_scored + excluded.goals_scored,
              matches_played = penalty_player_stats.matches_played + 1,
              updated_at = CURRENT_TIMESTAMP
          `,
          args: [winnerName, winnerModel, winnerScore],
        });

        await turso.execute({
          sql: `
            INSERT INTO penalty_player_stats (player_name, model_id, wins, losses, goals_scored, matches_played, updated_at)
            VALUES (?, ?, 0, 1, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(player_name) DO UPDATE SET
              model_id = excluded.model_id,
              losses = penalty_player_stats.losses + 1,
              goals_scored = penalty_player_stats.goals_scored + excluded.goals_scored,
              matches_played = penalty_player_stats.matches_played + 1,
              updated_at = CURRENT_TIMESTAMP
          `,
          args: [loserName, loserModel, loserScore],
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/penalty/leaderboard error:', error);
    return NextResponse.json({ error: 'Failed to save penalty match' }, { status: 500 });
  }
}
