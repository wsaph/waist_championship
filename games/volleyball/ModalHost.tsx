'use client';

import React from 'react';
import type { GameModalHostProps } from '../types';
import {
  BeachVolleyballModal,
  type VbCourtRosterSlot,
  type VbLobbyBroadcastInfo,
} from './VolleyballModal';

export function VolleyballModalHost({
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
  const mappedExternal: VbLobbyBroadcastInfo | null = externalLobbyInfo
    ? {
        roomCode: externalLobbyInfo.roomCode,
        mode: externalLobbyInfo.mode === '1v1' ? '1v1' : '2v2',
        hostUserId: externalLobbyInfo.hostUserId,
        hostName: externalLobbyInfo.hostName,
        hostEmoji: externalLobbyInfo.hostEmoji,
        targetName: externalLobbyInfo.targetName,
        count: externalLobbyInfo.count,
        max: externalLobbyInfo.max,
        status: externalLobbyInfo.status,
        scoreLeft: externalLobbyInfo.scoreLeft,
        scoreRight: externalLobbyInfo.scoreRight,
        roster: (externalLobbyInfo.roster || []) as VbCourtRosterSlot[],
      }
    : null;

  return (
    <BeachVolleyballModal
      isOpen={isOpen}
      onClose={onClose}
      players={players}
      currentUserId={currentUserId}
      qualityMode={qualityMode}
      initialRoomCode={session.roomCode}
      initialMode={session.mode === '1v1' ? '1v1' : '2v2'}
      initialIsHost={session.isHost}
      invitedTargetName={session.targetName}
      externalLobbyInfo={mappedExternal}
      onLobbyBroadcast={(info) =>
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
          roster: (info.roster || []).map((r) => ({
            ...r,
            team: r.slotId.startsWith('L') ? ('left' as const) : ('right' as const),
          })),
        })
      }
      onRewardEarned={(earned, newPoints) => onRewardEarned(earned, newPoints)}
    />
  );
}
