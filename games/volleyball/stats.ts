// lib/volleyball_stats.ts
// Host-only end-of-match persistence & Leaderboard fetcher (Supabase PostgreSQL primary + API fallback)

import { getRealtimeSupabaseClient } from '@/games/shared/realtimeSync';
import type { ChibiSkinId, GameMode, TeamSide } from './2d/physics2d';

export interface PlayerStatRow {
  player_name: string;
  skin: ChibiSkinId;
  wins: number;
  losses: number;
  total_points: number;
  matches_played: number;
  updated_at?: string;
}

export interface MatchHistoryRow {
  id?: number;
  match_uid: string;
  room_code: string;
  mode: GameMode;
  winning_team: TeamSide;
  winners: string[];
  losers: string[];
  score_blue: number;
  score_red: number;
  duration_seconds: number;
  played_at: string;
}

export interface RecordMatchPayload {
  matchUid: string;
  roomCode: string;
  mode: GameMode;
  winningTeam: TeamSide;
  winners: string[];
  losers: string[];
  scoreBlue: number;
  scoreRed: number;
  durationSeconds: number;
  playerEntries: Array<{
    name: string;
    skin: ChibiSkinId;
    won: boolean;
    points: number;
    isBot?: boolean;
  }>;
}

/**
 * Saves match history & player stats ONCE at match end (called strictly by Host).
 * Writes to Supabase PostgreSQL (`match_history` & `player_stats`) when configured,
 * and mirrors to `/api/volleyball/leaderboard` so local Leaderboard always works out-of-the-box.
 */
export async function recordMatchResultByHost(
  payload: RecordMatchPayload
): Promise<{ savedSupabase: boolean; savedLocal: boolean }> {
  const humanEntries = payload.playerEntries.filter(
    (e) => !e.isBot && e.name.trim().length > 0
  );
  if (humanEntries.length === 0) {
    return { savedSupabase: false, savedLocal: false };
  }

  let savedSupabase = false;
  let savedLocal = false;

  const sb = getRealtimeSupabaseClient();
  if (sb) {
    try {
      // 1. Try atomic PostgreSQL RPC defined in supabase_schema.sql
      const { data: rpcOk, error: rpcErr } = await sb.rpc('record_volleyball_match', {
        p_match_uid: payload.matchUid,
        p_room_code: payload.roomCode,
        p_mode: payload.mode,
        p_winning_team: payload.winningTeam,
        p_winners: payload.winners,
        p_losers: payload.losers,
        p_score_blue: payload.scoreBlue,
        p_score_red: payload.scoreRed,
        p_duration_seconds: payload.durationSeconds,
        p_player_entries: humanEntries,
      });

      if (!rpcErr && rpcOk !== null) {
        savedSupabase = Boolean(rpcOk);
      } else {
        // Fallback direct table inserts if RPC wasn't created yet
        const { error: mhErr } = await sb.from('match_history').insert({
          match_uid: payload.matchUid,
          room_code: payload.roomCode,
          mode: payload.mode,
          winning_team: payload.winningTeam,
          winners: payload.winners,
          losers: payload.losers,
          score_blue: payload.scoreBlue,
          score_red: payload.scoreRed,
          duration_seconds: payload.durationSeconds,
        });

        if (!mhErr) {
          savedSupabase = true;
          for (const entry of humanEntries) {
            const cleanName = entry.name.trim();
            const { data: existing } = await sb
              .from('player_stats')
              .select('wins, losses, total_points, matches_played')
              .eq('player_name', cleanName)
              .maybeSingle();

            await sb.from('player_stats').upsert(
              {
                player_name: cleanName,
                skin: entry.skin,
                wins: (existing?.wins ?? 0) + (entry.won ? 1 : 0),
                losses: (existing?.losses ?? 0) + (entry.won ? 0 : 1),
                total_points: (existing?.total_points ?? 0) + entry.points,
                matches_played: (existing?.matches_played ?? 0) + 1,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'player_name' }
            );
          }
        }
      }
    } catch {
      // Fall through to local API backup
    }
  }

  try {
    const res = await fetch('/api/volleyball/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        playerEntries: humanEntries,
      }),
    });
    if (res.ok) {
      savedLocal = true;
    }
  } catch {
    // ignore network error
  }

  return { savedSupabase, savedLocal };
}

export async function fetchVolleyballLeaderboard(): Promise<{
  leaders: PlayerStatRow[];
  recentMatches: MatchHistoryRow[];
  source: 'supabase' | 'local';
}> {
  const sb = getRealtimeSupabaseClient();
  if (sb) {
    try {
      const [statsRes, histRes] = await Promise.all([
        sb
          .from('player_stats')
          .select('player_name, skin, wins, losses, total_points, matches_played, updated_at')
          .order('wins', { ascending: false })
          .order('total_points', { ascending: false })
          .limit(30),
        sb
          .from('match_history')
          .select(
            'id, match_uid, room_code, mode, winning_team, winners, losers, score_blue, score_red, duration_seconds, played_at'
          )
          .order('played_at', { ascending: false })
          .limit(15),
      ]);

      if (!statsRes.error && Array.isArray(statsRes.data) && statsRes.data.length > 0) {
        return {
          leaders: statsRes.data as PlayerStatRow[],
          recentMatches: ((histRes.data || []) as MatchHistoryRow[]).map((m) => ({
            ...m,
            winners: Array.isArray(m.winners) ? m.winners : [],
            losers: Array.isArray(m.losers) ? m.losers : [],
          })),
          source: 'supabase',
        };
      }
    } catch {
      // Fall back to local API
    }
  }

  try {
    const res = await fetch('/api/volleyball/leaderboard', { cache: 'no-store' });
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
