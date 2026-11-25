'use client';

import React, { useEffect, useState } from 'react';
import { LockedArenaShowcaseModal } from '../components/LockedArenaShowcaseModal';
import { isViewerLockedOutOfActiveMatch } from '../islandActorShowcase3d';
import type { GameModalHostProps } from '../types';
import { ShabuCoopModal } from './ShabuCoopModal';

export function ShabuModalHost({
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
  const [isParticipatingLocally, setIsParticipatingLocally] = useState<boolean>(false);
  const [localClientId, setLocalClientId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setIsParticipatingLocally(false);
    }
  }, [isOpen]);

  const isLocked = isViewerLockedOutOfActiveMatch({
    lobby: externalLobbyInfo,
    viewerClientId: localClientId,
    viewerUserId: currentUserId,
    isCurrentlyPlayingLocally: isParticipatingLocally,
  });

  if (isLocked && externalLobbyInfo) {
    return (
      <LockedArenaShowcaseModal
        gameId="shabu"
        gameTitleTh="ปาร์ตี้ชาบู Co-op เสิร์ฟพี่ยาม"
        lobby={externalLobbyInfo}
        players={players}
        qualityMode={qualityMode}
        onClose={onClose}
      />
    );
  }

  return (
    <ShabuCoopModal
      isOpen={isOpen}
      onClose={onClose}
      players={players}
      currentUserId={currentUserId}
      qualityMode={qualityMode}
      initialRoomCode={session.roomCode || '5555'}
      initialIsHost={session.isHost}
      invitedTargetName={session.targetName}
      onParticipationChange={(participating, clientId) => {
        setIsParticipatingLocally(participating);
        setLocalClientId(clientId);
      }}
      onLobbyBroadcast={(info) =>
        onLobbyBroadcast({
          roomCode: info.roomCode,
          hostUserId: info.hostUserId,
          hostName: info.hostName,
          hostEmoji: info.hostEmoji,
          targetName: info.targetName,
          count: info.count,
          max: info.max,
          status: info.status,
          roster: info.roster,
        })
      }
      onRewardEarned={(earned, newPoints) => onRewardEarned(earned, newPoints)}
    />
  );
}
