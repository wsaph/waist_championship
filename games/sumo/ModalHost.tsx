'use client';

import React, { useState } from 'react';
import { LockedArenaShowcaseModal } from '../components/LockedArenaShowcaseModal';
import { isViewerLockedOutOfActiveMatch } from '../islandActorShowcase3d';
import type { GameModalHostProps } from '../types';
import { SumoArenaModal } from './SumoArenaModal';

export function SumoModalHost({
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
  const [isParticipatingLocally, setIsParticipatingLocally] = useState(false);
  const [isLocalBroadcastHost, setIsLocalBroadcastHost] = useState(false);
  const [localClientId, setLocalClientId] = useState<string | null>(null);

  const isLocked = isViewerLockedOutOfActiveMatch({
    lobby: externalLobbyInfo,
    viewerClientId: localClientId,
    viewerUserId: currentUserId,
    isCurrentlyPlayingLocally: isParticipatingLocally,
  });

  if (isLocked && externalLobbyInfo) {
    return (
      <LockedArenaShowcaseModal
        gameId="sumo"
        gameTitleTh="สังเวียนซูโม่ฮอกไกโด"
        lobby={externalLobbyInfo}
        players={players}
        qualityMode={qualityMode}
        onClose={onClose}
      />
    );
  }

  const me = players.find((p) => p.id === currentUserId);
  const shouldAutoJoinPvp =
    Boolean(externalLobbyInfo && externalLobbyInfo.status === 'waiting') ||
    Boolean(session.targetName);
  const autoJoinRoomCode = shouldAutoJoinPvp
    ? session.roomCode || externalLobbyInfo?.roomCode || 'SUMO'
    : undefined;

  return (
    <SumoArenaModal
      isOpen={isOpen}
      onClose={() => {
        if (isLocalBroadcastHost) {
          onLobbyBroadcast({
            roomCode: session.roomCode || 'SUMO',
            hostUserId: currentUserId || 0,
            hostName: me?.name || 'นักซูโม่',
            hostEmoji: me?.emoji || '🏯',
            count: 0,
            max: 2,
            status: 'closed',
            roster: [],
          });
        }
        setIsParticipatingLocally(false);
        setIsLocalBroadcastHost(false);
        onClose();
      }}
      players={players}
      qualityMode={qualityMode}
      currentUserId={currentUserId}
      playerName={me?.name || 'นักซูโม่'}
      playerEmoji={me?.emoji || '🏯'}
      autoJoinPvpRoomCode={autoJoinRoomCode}
      onParticipationChange={(participating, clientId, isHostNow) => {
        setIsParticipatingLocally(participating);
        setLocalClientId(clientId);
        setIsLocalBroadcastHost(isHostNow);
      }}
      onLobbyBroadcast={(info) => {
        if (info.status === 'started') {
          setIsParticipatingLocally(true);
          setIsLocalBroadcastHost(true);
        } else if (info.status === 'closed') {
          setIsLocalBroadcastHost(false);
        }
        onLobbyBroadcast(info);
      }}
      onPointsUpdated={onPointsUpdated}
    />
  );
}
