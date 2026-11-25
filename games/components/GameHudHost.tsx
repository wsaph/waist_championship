'use client';

import React from 'react';
import type { QualityMode } from '@/lib/device_perf';
import { GAME_MODULES, getGameModuleById } from '../registry';
import type { GamePlayerSummary } from '../types';
import type { IslandGamesController } from '../useIslandGames';

export function GameFloatingBanners({
  games,
  isJoinOpen,
  currentPlayerName,
}: {
  games: IslandGamesController;
  isJoinOpen: boolean;
  currentPlayerName?: string | null;
}) {
  if (games.isAnyGameOpen || isJoinOpen) return null;

  const activeBanners = GAME_MODULES.map((mod) => ({
    mod,
    lobby: games.liveLobbies[mod.definition.id],
  }))
    .filter((entry): entry is { mod: (typeof GAME_MODULES)[number]; lobby: NonNullable<typeof entry.lobby> } =>
      Boolean(entry.lobby)
    )
    .slice(0, 2);

  if (activeBanners.length === 0) return null;

  return (
    <>
      {activeBanners.map(({ mod, lobby }, idx) => {
        const def = mod.definition;
        const topCls = idx === 0 ? 'top-16 md:top-20' : 'top-28 md:top-32';
        const isStarted = lobby.status === 'started';
        const borderCls = isStarted ? 'border-rose-400' : def.bannerBorderClass;
        const modeText = lobby.mode ? ` ${lobby.mode.toUpperCase()}` : '';
        const scoreText =
          isStarted && typeof lobby.scoreLeft === 'number' && typeof lobby.scoreRight === 'number'
            ? ` (${lobby.scoreLeft}-${lobby.scoreRight})`
            : '';
        const rosterNames = (lobby.roster || [])
          .filter((r) => !r.isBot)
          .map((r) => `${r.emoji}${r.name}`)
          .join(', ');
        const isPersonalInvite = Boolean(
          !isStarted &&
            lobby.targetName &&
            currentPlayerName &&
            lobby.targetName.trim() === currentPlayerName.trim()
        );

        return (
          <div
            key={def.id}
            className={`fixed ${topCls} left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-[92vw]`}
          >
            <div
              className={`rpg-banner rounded-full px-3.5 py-1.5 flex items-center gap-2.5 shadow-2xl border-2 ${
                isPersonalInvite ? 'border-yellow-300 ring-2 ring-amber-400/70' : borderCls
              }`}
            >
              <span className="text-base animate-bounce">
                {isStarted ? '🔒' : isPersonalInvite ? '🎯' : def.emoji}
              </span>
              {isPersonalInvite && (
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black whitespace-nowrap shrink-0">
                  ชวนคุณโดยตรง!
                </span>
              )}
              <span className="text-xs font-extrabold text-amber-100 truncate">
                {isStarted
                  ? `${def.shortNameTh}กำลังแข่ง${modeText}${scoreText}: ${
                      rosterNames || `${lobby.hostEmoji}${lobby.hostName}`
                    }`
                  : `${lobby.hostEmoji} ${lobby.hostName} ชวน${isPersonalInvite ? 'คุณ' : ''}เล่น${def.nameTh}${modeText} (${lobby.count}/${lobby.max})`}
              </span>
              <button
                type="button"
                onClick={() =>
                  games.openGame({
                    gameId: def.id,
                    roomCode: lobby.roomCode,
                    mode: lobby.mode,
                    isHost: false,
                    targetName: lobby.hostName,
                  })
                }
                className="rpg-btn-gold px-3 py-1 rounded-full text-xs font-extrabold cursor-pointer shrink-0"
              >
                {isStarted
                  ? '👀 ดูผู้เล่น'
                  : lobby.count >= lobby.max
                    ? 'เต็มแล้ว'
                    : 'เข้าร่วมเลย!'}
              </button>
              <button
                type="button"
                onClick={() => games.dismissLobbyBanner(def.id)}
                className="text-amber-200/80 hover:text-white text-xs font-bold px-1 cursor-pointer"
                title="ซ่อนแจ้งเตือน"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function GameProximityActions({
  games,
  isPairMenuOpen,
  isNearGuard,
  isNearFoodStall,
  filterSource,
}: {
  games: IslandGamesController;
  isPairMenuOpen: boolean;
  isNearGuard: boolean;
  isNearFoodStall: boolean;
  filterSource?: 'own_zone' | 'guard' | 'food_stall';
}) {
  if (isPairMenuOpen) return null;

  return (
    <>
      {GAME_MODULES.map((mod) => {
        const def = mod.definition;
        if (filterSource && def.proximitySource !== filterSource) return null;

        const isNear =
          def.proximitySource === 'guard'
            ? isNearGuard
            : def.proximitySource === 'food_stall'
              ? isNearFoodStall
              : Boolean(games.nearZones[def.id]);

        if (!isNear) return null;
        const lobby = games.liveLobbies[def.id];
        const isLockedActive = Boolean(lobby?.status === 'started' && def.singleSessionLock);
        const isFullWaiting = Boolean(
          lobby && lobby.status === 'waiting' && lobby.count >= lobby.max
        );
        const hasScore =
          isLockedActive &&
          typeof lobby?.scoreLeft === 'number' &&
          typeof lobby?.scoreRight === 'number';

        return (
          <button
            key={def.id}
            type="button"
            onClick={() =>
              games.openGame({
                gameId: def.id,
                roomCode: lobby?.roomCode || def.defaultRoomCode,
                mode: lobby?.mode || def.defaultMode,
                isHost: false,
              })
            }
            className={`neo-btn font-[family-name:var(--font-kanit)] font-extrabold text-[11.5px] sm:text-sm px-3.5 sm:px-5 py-1.5 sm:py-2 rounded-full cursor-pointer shadow-[0_3px_0_#000] whitespace-nowrap ${
              isLockedActive
                ? 'bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 text-white border-2 border-white'
                : def.proximityBtnClass
            }`}
          >
            {isLockedActive ? (
              <>
                🔒 {def.shortNameTh}กำลังแข่ง
                {hasScore ? ` (${lobby!.scoreLeft}-${lobby!.scoreRight})` : ''}
                <span className="hidden sm:inline"> • กดดูตัวละครที่กำลังเล่น</span>
              </>
            ) : isFullWaiting ? (
              <>
                ⏳ ห้องรอ{def.shortNameTh}เต็ม ({lobby!.count}/{lobby!.max}) • รอรอบถัดไป
              </>
            ) : (
              <>
                {def.emoji} {def.proximityIdleText}
                {lobby && lobby.count > 0 ? (
                  <span> ({lobby.count}/{lobby.max} คนรอ!)</span>
                ) : def.proximitySubText ? (
                  <span className="hidden sm:inline"> {def.proximitySubText}</span>
                ) : null}
              </>
            )}
          </button>
        );
      })}
    </>
  );
}

export function GameModalHost({
  games,
  players,
  currentUserId,
  qualityMode,
  onShowRewardToast,
  onRefreshArenaData,
}: {
  games: IslandGamesController;
  players: GamePlayerSummary[];
  currentUserId: number | null;
  qualityMode: QualityMode;
  onShowRewardToast: (emoji: string, title: string, desc: string) => void;
  onRefreshArenaData: () => void;
}) {
  const session = games.activeSession;
  if (!session) return null;
  const mod = getGameModuleById(session.gameId);
  if (!mod) return null;

  const ModalComp = mod.ModalComponent;
  const def = mod.definition;

  return (
    <ModalComp
      isOpen={true}
      session={session}
      onClose={games.closeGame}
      players={players}
      currentUserId={currentUserId}
      qualityMode={qualityMode}
      externalLobbyInfo={games.liveLobbies[def.id] ?? null}
      onLobbyBroadcast={(info) => games.emitLobbyBroadcast(def.id, info)}
      onRewardEarned={(earned, newPoints) => {
        onShowRewardToast(
          def.emoji,
          `${def.rewardWinTitleTh || `ชนะ${def.nameTh}!`} (+${earned} 💰)`,
          newPoints !== undefined
            ? `รับโบนัสผู้ชนะแล้ว สะสมรวมเป็น ${newPoints} 💰 GP!`
            : `รับโบนัส +${earned} 💰 GP เรียบร้อยแล้ว!`
        );
        onRefreshArenaData();
      }}
      onPointsUpdated={onRefreshArenaData}
    />
  );
}
