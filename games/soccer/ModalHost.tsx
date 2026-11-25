'use client';

import React, { useState } from 'react';
import { LockedArenaShowcaseModal } from '../components/LockedArenaShowcaseModal';
import { isViewerLockedOutOfActiveMatch } from '../islandActorShowcase3d';
import type { GameModalHostProps } from '../types';
import { PenaltyShootoutModal } from './SoccerArenaModal';

export function SoccerModalHost({
  isOpen,
  session,
  onClose,
  players,
  currentUserId,
  qualityMode,
  externalLobbyInfo,
  onLobbyBroadcast,
  onRewardEarned,
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
        gameId="soccer"
        gameTitleTh={
          externalLobbyInfo.mode === 'penalty'
            ? 'ศึกดวลจุดโทษ 3D'
            : 'ศึกฟุตบอลโกลหนู 3v3 (สูงสุด 6 คน)'
        }
        lobby={externalLobbyInfo}
        players={players}
        qualityMode={qualityMode}
        onClose={onClose}
      />
    );
  }

  return (
    <PenaltyShootoutModal
      isOpen={isOpen}
      onClose={() => {
        if (isLocalBroadcastHost) {
          onLobbyBroadcast({
            roomCode: session.roomCode || '6666',
            hostUserId: currentUserId || 0,
            hostName: 'กัปตัน',
            hostEmoji: '⚽',
            count: 0,
            max: session.mode === 'penalty' ? 2 : 6,
            status: 'closed',
            roster: [],
          });
        }
        setIsParticipatingLocally(false);
        setIsLocalBroadcastHost(false);
        onClose();
      }}
      players={players}
      currentUserId={currentUserId}
      initialRoomCode={session.roomCode || '6666'}
      initialIsHost={session.isHost}
      invitedTargetName={session.targetName}
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
        onLobbyBroadcast({
          roomCode: info.roomCode,
          mode: info.mode,
          hostUserId: info.hostUserId,
          hostName: info.hostName,
          hostEmoji: info.hostEmoji,
          targetName: info.targetName,
          count: info.count,
          max: info.max,
          status: info.status,
          scoreLeft: info.scoreLeft,
          scoreRight: info.scoreRight,
          roster: info.roster,
        });
      }}
      onRewardEarned={(earned, totalPoints) => onRewardEarned(earned, totalPoints)}
    />
  );
}
