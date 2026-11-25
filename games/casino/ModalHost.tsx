'use client';

import React, { useEffect, useState } from 'react';
import { LockedArenaShowcaseModal } from '../components/LockedArenaShowcaseModal';
import { isViewerLockedOutOfActiveMatch } from '../islandActorShowcase3d';
import type { GameModalHostProps } from '../types';
import { CasinoCardModal } from './CasinoCardModal';

const CASINO_MODE_TITLES: Record<string, string> = {
  pokdeng: 'วงไพ่ป๊อกเด้งเจ้ามือพี่ยาม',
  blackjack: 'โต๊ะแบล็คแจ็ค 21 เจ้ามือพี่ยาม',
  holdem: "โต๊ะโป๊กเกอร์ Texas Hold'em",
  oldmaid: 'วงไพ่อีแก่กินน้ำ 52 ใบ',
};

export function CasinoModalHost({
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
    const title =
      (externalLobbyInfo.gameType && CASINO_MODE_TITLES[externalLobbyInfo.gameType]) ||
      'คาสิโนพี่ยาม (วงไพ่ 3D)';
    return (
      <LockedArenaShowcaseModal
        gameId="casino"
        gameTitleTh={title}
        lobby={externalLobbyInfo}
        players={players}
        qualityMode={qualityMode}
        onClose={onClose}
      />
    );
  }

  const me = players.find((p) => p.id === currentUserId);

  return (
    <CasinoCardModal
      isOpen={isOpen}
      onClose={onClose}
      players={players}
      currentUserId={currentUserId}
      currentUserPoints={me?.points ?? 0}
      qualityMode={qualityMode}
      initialRoomCode={session.roomCode || '9999'}
      initialIsHost={session.isHost}
      invitedTargetName={session.targetName}
      onParticipationChange={(participating, clientId) => {
        setIsParticipatingLocally(participating);
        setLocalClientId(clientId);
      }}
      onLobbyBroadcast={(info) =>
        onLobbyBroadcast({
          roomCode: info.roomCode,
          mode: info.gameType,
          gameType: info.gameType,
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
      onPointsUpdated={onPointsUpdated}
    />
  );
}
