import { NextResponse } from 'next/server';
import { turso } from '@/lib/turso_client';

export async function handleVolleyballLeaderboardGet(): Promise<Response> {
  try {
    const [leadersRes, matchesRes] = await Promise.all([
      turso.execute(`
        SELECT player_name, skin, wins, losses, total_points, matches_played, updated_at
        FROM vb_player_stats
        ORDER BY wins DESC, total_points DESC, matches_played ASC
        LIMIT 30
      `),
      turso.execute(`
        SELECT id, match_uid, room_code, mode, winning_team, winners_json, losers_json,
               score_blue, score_red, duration_seconds, played_at
        FROM vb_match_history
        ORDER BY id DESC
        LIMIT 15
      `),
    ]);

    const leaders = leadersRes.rows.map((r) => ({
      player_name: String(r.player_name || ''),
      skin: String(r.skin || 'pikamouse'),
      wins: Number(r.wins ?? 0),
      losses: Number(r.losses ?? 0),
      total_points: Number(r.total_points ?? 0),
      matches_played: Number(r.matches_played ?? 0),
      updated_at: String(r.updated_at || ''),
    }));

    const recentMatches = matchesRes.rows.map((r) => {
      let winners: string[] = [];
      let losers: string[] = [];
      try {
        winners = JSON.parse(String(r.winners_json || '[]'));
      } catch {
        winners = [];
      }
      try {
        losers = JSON.parse(String(r.losers_json || '[]'));
      } catch {
        losers = [];
      }
      return {
        id: Number(r.id ?? 0),
        match_uid: String(r.match_uid || ''),
        room_code: String(r.room_code || ''),
        mode: String(r.mode || '1v1'),
        winning_team: String(r.winning_team || 'blue'),
        winners,
        losers,
        score_blue: Number(r.score_blue ?? 0),
        score_red: Number(r.score_red ?? 0),
        duration_seconds: Number(r.duration_seconds ?? 0),
        played_at: String(r.played_at || ''),
      };
    });

    return NextResponse.json(
      { leaders, recentMatches },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error) {
    console.error('GET /api/volleyball/leaderboard error:', error);
    return NextResponse.json({ leaders: [], recentMatches: [] }, { status: 500 });
  }
}

export async function handleVolleyballLeaderboardPost(req: Request): Promise<Response> {
  try {
    const body = await req.json();
    const matchUid = String(body.matchUid || '').trim();
    const roomCode = String(body.roomCode || 'LOCAL').trim().slice(0, 8);
    const mode = body.mode === '2v2' ? '2v2' : '1v1';
    const winningTeam = body.winningTeam === 'red' ? 'red' : 'blue';
    const winners = Array.isArray(body.winners) ? body.winners.map(String) : [];
    const losers = Array.isArray(body.losers) ? body.losers.map(String) : [];
    const scoreBlue = Math.max(0, Number(body.scoreBlue ?? 0));
    const scoreRed = Math.max(0, Number(body.scoreRed ?? 0));
    const durationSeconds = Math.max(0, Math.round(Number(body.durationSeconds ?? 0)));
    const playerEntries: Array<{
      name: string;
      skin?: string;
      won?: boolean;
      points?: number;
      isBot?: boolean;
    }> = Array.isArray(body.playerEntries) ? body.playerEntries : [];

    if (!matchUid) {
      return NextResponse.json({ error: 'Missing matchUid' }, { status: 400 });
    }

    const insertHist = await turso.execute({
      sql: `
        INSERT OR IGNORE INTO vb_match_history
          (match_uid, room_code, mode, winning_team, winners_json, losers_json, score_blue, score_red, duration_seconds)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        matchUid,
        roomCode,
        mode,
        winningTeam,
        JSON.stringify(winners),
        JSON.stringify(losers),
        scoreBlue,
        scoreRed,
        durationSeconds,
      ],
    });

    if (Number(insertHist.rowsAffected ?? 0) > 0) {
      for (const entry of playerEntries) {
        if (entry.isBot) continue;
        const cleanName = String(entry.name || '').trim().slice(0, 28);
        if (!cleanName) continue;
        const skin = String(entry.skin || 'pikamouse').slice(0, 24);
        const won = entry.won ? 1 : 0;
        const lost = entry.won ? 0 : 1;
        const pts = Math.max(0, Math.round(Number(entry.points ?? 0)));

        await turso.execute({
          sql: `
            INSERT INTO vb_player_stats (player_name, skin, wins, losses, total_points, matches_played, updated_at)
            VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
            ON CONFLICT(player_name) DO UPDATE SET
              skin = excluded.skin,
              wins = vb_player_stats.wins + excluded.wins,
              losses = vb_player_stats.losses + excluded.losses,
              total_points = vb_player_stats.total_points + excluded.total_points,
              matches_played = vb_player_stats.matches_played + 1,
              updated_at = CURRENT_TIMESTAMP
          `,
          args: [cleanName, skin, won, lost, pts],
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('POST /api/volleyball/leaderboard error:', error);
    return NextResponse.json({ error: 'Failed to record match' }, { status: 500 });
  }
}
