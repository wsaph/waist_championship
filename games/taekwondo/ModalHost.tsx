'use client';

import React from 'react';
import type { GameModalHostProps } from '../types';
import { TaekwondoModal } from './TaekwondoModal';

export function TaekwondoModalHost({
  isOpen,
  session,
  onClose,
  players,
  currentUserId,
  qualityMode,
  externalLobbyInfo,
  onLobbyBroadcast,
  onPointsUpdated,
}: GameModalHostProps) {
  const me = players.find((p) => p.id === currentUserId);
  const shouldAutoJoinPvp =
    Boolean(externalLobbyInfo && externalLobbyInfo.status === 'waiting') ||
    Boolean(session.targetName);
  const autoJoinRoomCode = shouldAutoJoinPvp
    ? session.roomCode || externalLobbyInfo?.roomCode || 'DOJO'
    : undefined;

  return (
    <TaekwondoModal
      isOpen={isOpen}
      onClose={onClose}
      players={players}
      qualityMode={qualityMode}
      currentUserId={currentUserId}
      playerName={me?.name || 'ผู้กล้า'}
      playerEmoji={me?.emoji || '🥋'}
      autoJoinPvpRoomCode={autoJoinRoomCode}
      externalLobbyInfo={externalLobbyInfo}
      onLobbyBroadcast={onLobbyBroadcast}
      onPointsUpdated={onPointsUpdated}
    />
  );
}
