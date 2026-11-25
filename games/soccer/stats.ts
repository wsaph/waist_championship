// lib/penalty_stats.ts
// Host-only single write at match end for 3D Penalty Shootout (`penalty_matches` & `player_stats`)

import { getRealtimeSupabaseClient } from '@/games/shared/realtimeSync';

export interface PenaltyLeaderRow {
  player_name: string;
  model_id: string;
  wins: number;
  losses: number;
  goals_scored: number;
  matches_played: number;
  updated_at?: string;
}

export interface PenaltyMatchHistoryRow {
  id?: number;
  match_uid: string;
  room_code: string;
  winner_name: string;
  loser_name: string;
  winner_model: string;
  loser_model: string;
  winner_score: number;
  loser_score: number;
  total_rounds: number;
  sudden_death: boolean;
  duration_seconds: number;
  played_at: string;
}

export interface PenaltyPlayerStatEntry {
  name: string;
  modelId: string;
  won: boolean;
  goals: number;
  isBot?: boolean;
}

export interface RecordPenaltyMatchPayload {
  matchUid: string;
  roomCode: string;
  winnerName: string;
  loserName: string;
  winnerModel: string;
  loserModel: string;
  winnerScore: number;
  loserScore: number;
  totalRounds: number;
  suddenDeath: boolean;
  durationSeconds: number;
  playerEntries?: PenaltyPlayerStatEntry[];
}

/**
 * Saves finished online Street Football 3v3 (up to 6 humans) or 1v1 Penalty Shootout ONCE by Host.
 * Writes to Supabase PostgreSQL (`penalty_matches` & `player_stats`) and mirrors to `/api/penalty/leaderboard`.
 */
export async function recordPenaltyMatchByHost(
  payload: RecordPenaltyMatchPayload
): Promise<{ savedSupabase: boolean; savedLocal: boolean }> {
  const winnerName = payload.winnerName.trim();
  const loserName = payload.loserName.trim();
  if (!winnerName || !loserName) {
    return { savedSupabase: false, savedLocal: false };
  }

  const humanEntries = (payload.playerEntries || []).filter(
    (e) => !e.isBot && e.name.trim().length > 0
  );

  let savedSupabase = false;
  let savedLocal = false;

  const sb = getRealtimeSupabaseClient();
  if (sb) {
    try {
      const useCustomMultiEntries = humanEntries.length > 2;
      const { data: rpcOk, error: rpcErr } = useCustomMultiEntries
        ? { data: null, error: new Error('multi_player_entries') }
        : await sb.rpc('record_penalty_match', {
          p_match_uid: payload.matchUid,
          p_room_code: payload.roomCode,
          p_winner_name: winnerName,
          p_loser_name: loserName,
          p_winner_model: payload.winnerModel,
          p_loser_model: payload.loserModel,
          p_winner_score: payload.winnerScore,
          p_loser_score: payload.loserScore,
          p_total_rounds: payload.totalRounds,
          p_sudden_death: payload.suddenDeath,
          p_duration_seconds: payload.durationSeconds,
        });

      if (!rpcErr && rpcOk !== null) {
        savedSupabase = Boolean(rpcOk);
      } else {
        const { error: insErr } = await sb.from('penalty_matches').insert({
          match_uid: payload.matchUid,
          room_code: payload.roomCode,
          winner_name: winnerName,
          loser_name: loserName,
          winner_model: payload.winnerModel,
          loser_model: payload.loserModel,
          winner_score: payload.winnerScore,
          loser_score: payload.loserScore,
          total_rounds: payload.totalRounds,
          sudden_death: payload.suddenDeath,
          duration_seconds: payload.durationSeconds,
        });

        if (!insErr) {
          savedSupabase = true;
          const entries =
            humanEntries.length > 0
              ? humanEntries.map((e) => ({
                name: e.name.trim(),
                model: e.modelId,
                won: e.won,
                goals: e.goals,
              }))
              : [
                { name: winnerName, model: payload.winnerModel, won: true, goals: payload.winnerScore },
                { name: loserName, model: payload.loserModel, won: false, goals: payload.loserScore },
              ];
          for (const entry of entries) {
            const { data: existing } = await sb
              .from('player_stats')
              .select('wins, losses, total_points, matches_played, penalty_wins, penalty_losses, penalty_goals, penalty_matches_played')
              .eq('player_name', entry.name)
              .maybeSingle();

            await sb.from('player_stats').upsert(
              {
                player_name: entry.name,
                skin: entry.model,
                wins: (existing?.wins ?? 0) + (entry.won ? 1 : 0),
                losses: (existing?.losses ?? 0) + (entry.won ? 0 : 1),
                total_points: (existing?.total_points ?? 0) + entry.goals,
                matches_played: (existing?.matches_played ?? 0) + 1,
                penalty_wins: (existing?.penalty_wins ?? 0) + (entry.won ? 1 : 0),
                penalty_losses: (existing?.penalty_losses ?? 0) + (entry.won ? 0 : 1),
                penalty_goals: (existing?.penalty_goals ?? 0) + entry.goals,
                penalty_matches_played: (existing?.penalty_matches_played ?? 0) + 1,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'player_name' }
            );
          }
        }
      }
    } catch {
      // fall through to local backup
    }
  }

  try {
    const res = await fetch('/api/penalty/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      savedLocal = true;
    }
  } catch {
    // ignore network error
  }

  return { savedSupabase, savedLocal };
}

export async function fetchPenaltyLeaderboard(): Promise<{
  leaders: PenaltyLeaderRow[];
  recentMatches: PenaltyMatchHistoryRow[];
  source: 'supabase' | 'local';
}> {
  const sb = getRealtimeSupabaseClient();
  if (sb) {
    try {
      const [statsRes, histRes] = await Promise.all([
        sb
          .from('player_stats')
          .select('player_name, skin, penalty_wins, penalty_losses, penalty_goals, penalty_matches_played, updated_at')
          .gt('penalty_matches_played', 0)
          .order('penalty_wins', { ascending: false })
          .order('penalty_goals', { ascending: false })
          .limit(30),
        sb
          .from('penalty_matches')
          .select(
            'id, match_uid, room_code, winner_name, loser_name, winner_model, loser_model, winner_score, loser_score, total_rounds, sudden_death, duration_seconds, played_at'
          )
          .order('played_at', { ascending: false })
          .limit(15),
      ]);

      if (!statsRes.error && Array.isArray(statsRes.data) && statsRes.data.length > 0) {
        return {
          leaders: statsRes.data.map((r) => ({
            player_name: String(r.player_name || ''),
            model_id: String(r.skin || 'fox_hero'),
            wins: Number(r.penalty_wins ?? 0),
            losses: Number(r.penalty_losses ?? 0),
            goals_scored: Number(r.penalty_goals ?? 0),
            matches_played: Number(r.penalty_matches_played ?? 0),
            updated_at: r.updated_at ? String(r.updated_at) : undefined,
          })),
          recentMatches: (histRes.data || []) as PenaltyMatchHistoryRow[],
          source: 'supabase',
        };
      }
    } catch {
      // fall through
    }
  }

  try {
    const res = await fetch('/api/penalty/leaderboard', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      return {
        leaders: Array.isArray(data.leaders) ? data.leaders : [],
        recentMatches: Array.isArray(data.recentMatches) ? data.recentMatches : [],
        source: 'local',
      };
    }
  } catch {
    // ignore
  }

  return { leaders: [], recentMatches: [], source: 'local' };
}
