'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GAME_MODULES, getGameModuleById } from './registry';
import type {
  GameActiveSession,
  GameId,
  GameLobbyBroadcastInfo,
  GameLobbyBroadcastInput,
  GameRosterSlot,
} from './types';

const STALE_LOBBY_TIMEOUT_MS = 15000;

export interface UseIslandGamesOptions {
  currentUserId: number | null;
  broadcastRealtimeEvent: (event: string, payload: Record<string, unknown>) => void;
}

export interface IslandGamesController {
  activeSession: GameActiveSession | null;
  isAnyGameOpen: boolean;
  activeBusyLabel: string;
  liveLobbies: Partial<Record<GameId, GameLobbyBroadcastInfo>>;
  nearZones: Partial<Record<GameId, boolean>>;
  getLiveLobby: (gameId: GameId) => GameLobbyBroadcastInfo | null;
  isNearZone: (gameId: GameId) => boolean;
  setZoneProximity: (gameId: GameId, isNear: boolean) => void;
  resetAllProximities: () => void;
  openGame: (opts: {
    gameId: GameId;
    roomCode?: string;
    mode?: string;
    isHost?: boolean;
    targetName?: string;
  }) => void;
  closeGame: () => void;
  closeAllGames: () => void;
  dismissLobbyBanner: (gameId: GameId) => void;
  emitLobbyBroadcast: (gameId: GameId, info: GameLobbyBroadcastInput) => void;
  handleRealtimeEvent: (event: string, payload: Record<string, unknown>) => boolean;
  handlePairActivityClick: (animType: string, targetName: string) => boolean;
  formatPairActivityLabel: (animType: string, fallbackLabel: string) => string;
}

function parseRosterPayload(rawRoster: unknown): GameRosterSlot[] {
  if (!Array.isArray(rawRoster)) return [];
  return rawRoster
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
    .map((r) => ({
      slotId: String(r.slotId || ''),
      clientId: r.clientId ? String(r.clientId) : undefined,
      playerId: Number(r.playerId || 0),
      name: String(r.name || 'ผู้เล่น'),
      emoji: String(r.emoji || '🎮'),
      team:
        r.team === 'left' || r.team === 'right' || r.team === 'coop'
          ? (r.team as GameRosterSlot['team'])
          : undefined,
      isBot: Boolean(r.isBot),
    }))
    .filter((r) => Boolean(r.slotId));
}

export function serializeLobbySnapshot(info: GameLobbyBroadcastInput): string {
  const rosterSig = (info.roster || [])
    .map(
      (r) =>
        `${r.slotId}:${r.clientId || ''}:${r.playerId}:${r.name}:${r.emoji}:${r.team || ''}:${r.isBot ? 1 : 0}`
    )
    .join(',');
  return [
    info.status,
    info.roomCode,
    info.mode || '',
    info.gameType || '',
    info.hostUserId,
    info.hostName,
    info.hostEmoji,
    info.targetName || '',
    info.count,
    info.max,
    info.scoreLeft ?? '',
    info.scoreRight ?? '',
    rosterSig,
  ].join('|');
}

export function useIslandGames({
  currentUserId,
  broadcastRealtimeEvent,
}: UseIslandGamesOptions): IslandGamesController {
  const [activeSession, setActiveSession] = useState<GameActiveSession | null>(null);
  const [liveLobbies, setLiveLobbies] = useState<
    Partial<Record<GameId, GameLobbyBroadcastInfo>>
  >({});
  const [nearZones, setNearZones] = useState<Partial<Record<GameId, boolean>>>({});

  const liveLobbiesRef = useRef(liveLobbies);
  liveLobbiesRef.current = liveLobbies;
  const nearZonesRef = useRef(nearZones);
  nearZonesRef.current = nearZones;
  const currentUserIdRef = useRef(currentUserId);
  currentUserIdRef.current = currentUserId;
  const broadcastRef = useRef(broadcastRealtimeEvent);
  broadcastRef.current = broadcastRealtimeEvent;

  // Auto-expire stale lobbies/matches if a host tab closes abruptly (>15s without heartbeat)
  const hasAnyLiveLobby = Object.keys(liveLobbies).length > 0;
  useEffect(() => {
    if (!hasAnyLiveLobby) return;
    const iv = setInterval(() => {
      const now = Date.now();
      setLiveLobbies((prev) => {
        let mutated = false;
        const next: Partial<Record<GameId, GameLobbyBroadcastInfo>> = {};
        for (const [gid, entry] of Object.entries(prev) as [GameId, GameLobbyBroadcastInfo | undefined][]) {
          if (!entry) continue;
          if (now - entry.updatedAt > STALE_LOBBY_TIMEOUT_MS) {
            mutated = true;
          } else {
            next[gid] = entry;
          }
        }
        return mutated ? next : prev;
      });
    }, 3500);
    return () => clearInterval(iv);
  }, [hasAnyLiveLobby]);

  const getLiveLobby = useCallback((gameId: GameId): GameLobbyBroadcastInfo | null => {
    return liveLobbiesRef.current[gameId] ?? null;
  }, []);

  const isNearZone = useCallback((gameId: GameId): boolean => {
    return Boolean(nearZonesRef.current[gameId]);
  }, []);

  const setZoneProximity = useCallback((gameId: GameId, isNear: boolean) => {
    if (Boolean(nearZonesRef.current[gameId]) === isNear) return;
    nearZonesRef.current = { ...nearZonesRef.current, [gameId]: isNear };
    setNearZones((prev) => (Boolean(prev[gameId]) === isNear ? prev : { ...prev, [gameId]: isNear }));
  }, []);

  const resetAllProximities = useCallback(() => {
    nearZonesRef.current = {};
    setNearZones({});
  }, []);

  const openGame = useCallback(
    (opts: {
      gameId: GameId;
      roomCode?: string;
      mode?: string;
      isHost?: boolean;
      targetName?: string;
    }) => {
      const mod = getGameModuleById(opts.gameId);
      const existingLobby = liveLobbiesRef.current[opts.gameId];
      setActiveSession({
        gameId: opts.gameId,
        roomCode:
          opts.roomCode ||
          existingLobby?.roomCode ||
          mod?.definition.defaultRoomCode ||
          '7777',
        mode: opts.mode || existingLobby?.mode || mod?.definition.defaultMode,
        isHost: Boolean(opts.isHost),
        targetName: opts.targetName,
      });
    },
    []
  );

  const closeGame = useCallback(() => {
    setActiveSession((cur) => {
      if (cur) {
        const uid = currentUserIdRef.current;
        setLiveLobbies((prev) => {
          const existing = prev[cur.gameId];
          if (existing && existing.hostUserId === uid && existing.status === 'waiting') {
            const copy = { ...prev };
            delete copy[cur.gameId];
            return copy;
          }
          return prev;
        });
      }
      return null;
    });
  }, []);

  const closeAllGames = useCallback(() => {
    setActiveSession(null);
  }, []);

  const dismissLobbyBanner = useCallback((gameId: GameId) => {
    setLiveLobbies((prev) => {
      if (!prev[gameId]) return prev;
      const copy = { ...prev };
      delete copy[gameId];
      return copy;
    });
  }, []);

  const lastBroadcastSentRef = useRef<Partial<Record<GameId, { sig: string; sentAt: number }>>>({});

  const emitLobbyBroadcast = useCallback(
    (gameId: GameId, info: GameLobbyBroadcastInput) => {
      const mod = getGameModuleById(gameId);
      if (!mod) return;
      const now = Date.now();
      const nextSig = serializeLobbySnapshot(info);

      if (info.status === 'waiting' || info.status === 'started') {
        const nextEntry: GameLobbyBroadcastInfo = {
          ...info,
          gameId,
          updatedAt: now,
        };
        setLiveLobbies((prev) => {
          const existing = prev[gameId];
          // Prevent synchronous/rapid duplicate state updates from triggering parent-child render loops,
          // while still refreshing `updatedAt` every >=2.5s for the 15s stale-lobby expiry heartbeat.
          if (
            existing &&
            now - existing.updatedAt < 2500 &&
            serializeLobbySnapshot(existing) === nextSig
          ) {
            return prev;
          }
          return { ...prev, [gameId]: nextEntry };
        });
      } else {
        setLiveLobbies((prev) => {
          if (!prev[gameId]) return prev;
          const copy = { ...prev };
          delete copy[gameId];
          return copy;
        });
      }

      const prevSent = lastBroadcastSentRef.current[gameId];
      if (prevSent && prevSent.sig === nextSig && now - prevSent.sentAt < 1200) {
        return;
      }
      lastBroadcastSentRef.current[gameId] = { sig: nextSig, sentAt: now };
      broadcastRef.current(mod.definition.realtimeEvent, {
        ...info,
        gameId,
      });
    },
    []
  );

  const handleRealtimeEvent = useCallback(
    (event: string, payload: Record<string, unknown>): boolean => {
      const mod = GAME_MODULES.find((m) => m.definition.realtimeEvent === event);
      if (!mod) return false;
      const gid = mod.definition.id;
      const status = payload.status;
      if ((status === 'waiting' || status === 'started') && payload.roomCode) {
        const entry: GameLobbyBroadcastInfo = {
          gameId: gid,
          roomCode: String(payload.roomCode),
          mode: payload.mode ? String(payload.mode) : mod.definition.defaultMode,
          gameType: payload.gameType ? String(payload.gameType) : undefined,
          hostUserId: Number(payload.hostUserId || 0),
          hostName: String(payload.hostName || 'เพื่อน'),
          hostEmoji: String(payload.hostEmoji || mod.definition.emoji),
          targetName: payload.targetName ? String(payload.targetName) : undefined,
          count: Math.max(1, Number(payload.count || 1)),
          max: Math.max(1, Number(payload.max || 2)),
          status: status === 'started' ? 'started' : 'waiting',
          scoreLeft: typeof payload.scoreLeft === 'number' ? payload.scoreLeft : 0,
          scoreRight: typeof payload.scoreRight === 'number' ? payload.scoreRight : 0,
          roster: parseRosterPayload(payload.roster),
          updatedAt: Date.now(),
        };
        setLiveLobbies((prev) => ({ ...prev, [gid]: entry }));
      } else {
        setLiveLobbies((prev) => {
          const existing = prev[gid];
          if (!existing) return prev;
          if (payload.roomCode && existing.roomCode !== String(payload.roomCode)) {
            return prev;
          }
          const copy = { ...prev };
          delete copy[gid];
          return copy;
        });
      }
      return true;
    },
    []
  );

  const handlePairActivityClick = useCallback(
    (animType: string, targetName: string): boolean => {
      const mod = GAME_MODULES.find((m) => m.definition.pairActivityAnimType === animType);
      if (!mod) return false;
      openGame({
        gameId: mod.definition.id,
        isHost: false,
        targetName,
      });
      return true;
    },
    [openGame]
  );

  const formatPairActivityLabel = useCallback(
    (animType: string, fallbackLabel: string): string => {
      const mod = GAME_MODULES.find((m) => m.definition.pairActivityAnimType === animType);
      if (!mod) return fallbackLabel;
      const lobby = liveLobbies[mod.definition.id];
      if (!lobby) return fallbackLabel;
      if (lobby.status === 'started') {
        const hasScores =
          typeof lobby.scoreLeft === 'number' && typeof lobby.scoreRight === 'number';
        return `🔒 ${mod.definition.shortNameTh}กำลังแข่ง${
          hasScores ? ` (${lobby.scoreLeft}-${lobby.scoreRight})` : ''
        }`;
      }
      if (lobby.count < lobby.max) {
        return `${mod.definition.emoji} เข้าตี้${mod.definition.shortNameTh} (${lobby.count}/${lobby.max})`;
      }
      return `⏳ ${mod.definition.shortNameTh}เต็ม (${lobby.count}/${lobby.max})`;
    },
    [liveLobbies]
  );

  const activeBusyLabel = useMemo(() => {
    if (!activeSession) return '';
    const mod = getGameModuleById(activeSession.gameId);
    return mod?.definition.busyStatusLabel || '';
  }, [activeSession]);

  return {
    activeSession,
    isAnyGameOpen: Boolean(activeSession),
    activeBusyLabel,
    liveLobbies,
    nearZones,
    getLiveLobby,
    isNearZone,
    setZoneProximity,
    resetAllProximities,
    openGame,
    closeGame,
    closeAllGames,
    dismissLobbyBanner,
    emitLobbyBroadcast,
    handleRealtimeEvent,
    handlePairActivityClick,
    formatPairActivityLabel,
  };
}
