import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Register lightweight in-memory resolver for Next.js `@/` aliases & extensionless `.ts` imports
const rootUrl = pathToFileURL(path.resolve(import.meta.dirname, '..') + path.sep).href;
const loaderCode = `
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
const ROOT = ${JSON.stringify(rootUrl)};
export async function resolve(specifier, context, nextResolve) {
  let candidate = null;
  if (specifier.startsWith('@/')) {
    candidate = new URL(specifier.slice(2), ROOT);
  } else if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\\.[a-z0-9]+$/i.test(specifier)) {
    candidate = new URL(specifier, context.parentURL);
  }
  if (candidate) {
    for (const ext of ['.ts', '.tsx', '/index.ts']) {
      const u = new URL(candidate.href + ext);
      if (fs.existsSync(fileURLToPath(u))) {
        return nextResolve(u.href, context);
      }
    }
  }
  return nextResolve(specifier, context);
}
`;
register(`data:text/javascript;base64,${Buffer.from(loaderCode).toString('base64')}`);

const { isViewerLockedOutOfActiveMatch } = await import('../games/islandActorShowcase3d.ts');
const {
  ClientStateInterpolator,
  FootballStateInterpolator,
  packNetState,
  resolveLobbyPresence,
  resolvePenaltyLobbyPresence,
  serializeFootballSnapshot,
} = await import('../games/shared/realtimeSync.ts');
const { createMatchState } = await import('../games/volleyball/2d/physics2d.ts');
const { createInitialFootballMatchState } = await import('../games/soccer/match3v3/physics.ts');

test('isViewerLockedOutOfActiveMatch: never locks out invited guests or same-team partners who are playing locally or listed in roster', () => {
  const startedLobby = {
    status: 'started',
    roster: [
      { slotId: 'B1', clientId: 'host-c1', playerId: 10, name: 'HostA', emoji: '🦊', team: 'left', isBot: false },
      { slotId: 'B2', clientId: 'guest-c2', playerId: 0, name: 'InvitedGuestNoLogin', emoji: '🐰', team: 'left', isBot: false },
      { slotId: 'B3', clientId: 'bot_B3', playerId: 99, name: 'AI StandIn', emoji: '🤖', team: 'left', isBot: true },
      { slotId: 'R1', clientId: 'opp-c3', playerId: 25, name: 'OpponentR1', emoji: '🐺', team: 'right', isBot: false },
    ],
  };

  // 1. Invited teammate with userId = 0 (guest tab) playing locally is NEVER locked out
  assert.equal(
    isViewerLockedOutOfActiveMatch({
      lobby: startedLobby,
      viewerClientId: 'guest-c2',
      viewerUserId: null,
      isCurrentlyPlayingLocally: true,
    }),
    false
  );

  // 2. Invited teammate matched by viewerClientId in roster is NEVER locked out even before local flag flips
  assert.equal(
    isViewerLockedOutOfActiveMatch({
      lobby: startedLobby,
      viewerClientId: 'guest-c2',
      viewerUserId: 0,
      isCurrentlyPlayingLocally: false,
    }),
    false
  );

  // 3. Invited player matched by viewerUserId in roster is NEVER locked out
  assert.equal(
    isViewerLockedOutOfActiveMatch({
      lobby: startedLobby,
      viewerClientId: 'other-tab',
      viewerUserId: 25,
      isCurrentlyPlayingLocally: false,
    }),
    false
  );

  // 4. Player whose avatar was borrowed as an AI stand-in (isBot: true) IS properly locked out if opening late!
  assert.equal(
    isViewerLockedOutOfActiveMatch({
      lobby: startedLobby,
      viewerClientId: 'late-viewer',
      viewerUserId: 99,
      isCurrentlyPlayingLocally: false,
    }),
    true
  );

  // 5. External bystander opening while match is started IS locked out
  assert.equal(
    isViewerLockedOutOfActiveMatch({
      lobby: startedLobby,
      viewerClientId: 'stranger-c9',
      viewerUserId: 77,
      isCurrentlyPlayingLocally: false,
    }),
    true
  );

  // 6. Invited friend opening while lobby is 'waiting' is NEVER locked out
  assert.equal(
    isViewerLockedOutOfActiveMatch({
      lobby: { ...startedLobby, status: 'waiting' },
      viewerClientId: 'stranger-c9',
      viewerUserId: 77,
      isCurrentlyPlayingLocally: false,
    }),
    false
  );
});

test('FootballStateInterpolator: seamlessly accepts seq=1 from new Host after mid-match Host Migration (zero freeze!)', () => {
  const match = createInitialFootballMatchState({
    blueCaptainName: 'เอก',
    blueModelId: 'fox_hero',
    redCaptainName: 'บอย',
    redModelId: 'husky_hero',
  });
  const interp = new FootballStateInterpolator();

  // Original Host (B1) streamed up to seq = 420
  match.ball.x = 2.5;
  const oldHostSnap = serializeFootballSnapshot(match, 420, undefined, 'host-b1');
  assert.equal(interp.pushSnapshot(oldHostSnap, 1000), true);

  // Out-of-order stale packet from SAME host is still rejected
  const staleSameHost = serializeFootballSnapshot(match, 419, undefined, 'host-b1');
  assert.equal(interp.pushSnapshot(staleSameHost, 1020), false);

  // B1 disconnects -> Teammate B2 becomes new Host and starts broadcasting at seq = 1!
  match.ball.x = 3.75;
  const newHostFirstSnap = serializeFootballSnapshot(match, 1, undefined, 'teammate-b2');
  assert.equal(interp.pushSnapshot(newHostFirstSnap, 1055), true);

  const sampled = interp.sample(1110);
  assert.ok(sampled);
  assert.equal(sampled.ballX, 3.75);
});

test('ClientStateInterpolator (Volleyball): seamlessly accepts seq=1 from new Host after mid-match Host Migration', () => {
  const vbMatch = createMatchState('2v2', {
    P1: { name: 'L1', skin: 'pikamouse', color: '#38bdf8', isBot: false },
    P2: { name: 'L2', skin: 'bunny', color: '#38bdf8', isBot: false },
    P3: { name: 'R1', skin: 'fox', color: '#f43f5e', isBot: false },
    P4: { name: 'R2', skin: 'panda', color: '#f43f5e', isBot: false },
  });
  const interp = new ClientStateInterpolator();

  const snapOldHost = packNetState(vbMatch, 380, undefined, 'vb-host-1');
  assert.equal(interp.pushSnapshot(snapOldHost, 2000), true);
  assert.equal(interp.pushSnapshot(packNetState(vbMatch, 379, undefined, 'vb-host-1'), 2010), false);

  // L1 leaves -> Teammate L2 migrates to Host starting at seq = 1
  vbMatch.scoreBlue = 6;
  const snapNewHost = packNetState(vbMatch, 1, undefined, 'vb-teammate-2');
  assert.equal(interp.pushSnapshot(snapNewHost, 2050), true);

  interp.applyInterpolated(vbMatch, 2100, 1 / 60);
  assert.equal(vbMatch.scoreBlue, 6);
});

test('resolvePenaltyLobbyPresence & resolveLobbyPresence: syncs same-team invited friends, ready flags, and host migration order', () => {
  // 3 friends all join Blue Team together (B1, B2, B3) to play Co-op 3v3 vs AI!
  const members = [
    {
      clientId: 'c-host',
      userId: 1,
      name: 'กัปตันฟ้า',
      modelId: 'fox_hero',
      desiredSlot: 'B1',
      slotUpdatedAt: 100,
      ready: false, // Host is implicitly ready
      joinedAt: 100,
      isCreator: true,
    },
    {
      clientId: 'c-friend-2',
      userId: 2,
      name: 'เพื่อนทีมฟ้า 2',
      modelId: 'bunny_hero',
      desiredSlot: 'B2',
      slotUpdatedAt: 120,
      ready: false,
      joinedAt: 110,
      isCreator: false,
    },
    {
      clientId: 'c-friend-3',
      userId: 3,
      name: 'เพื่อนทีมฟ้า 3',
      modelId: 'panda_hero',
      desiredSlot: 'B3',
      slotUpdatedAt: 130,
      ready: true,
      joinedAt: 120,
      isCreator: false,
    },
  ];

  const waitingLobby = resolvePenaltyLobbyPresence(members, 'match_3v3');
  assert.equal(waitingLobby.hostClientId, 'c-host');
  assert.equal(waitingLobby.slots.B1?.clientId, 'c-host');
  assert.equal(waitingLobby.slots.B2?.clientId, 'c-friend-2');
  assert.equal(waitingLobby.slots.B3?.clientId, 'c-friend-3');
  assert.equal(waitingLobby.humanCount, 3);
  // Friend 2 hasn't clicked Ready yet -> Host cannot start prematurely!
  assert.equal(waitingLobby.allHumansReady, false);

  // Friend 2 clicks Ready -> allHumansReady becomes true!
  members[1].ready = true;
  const readyLobby = resolvePenaltyLobbyPresence(members, 'match_3v3');
  assert.equal(readyLobby.allHumansReady, true);

  // Host leaves -> Friend 2 (earliest joiner) deterministically becomes new Host!
  const afterHostLeft = resolvePenaltyLobbyPresence(members.slice(1), 'match_3v3');
  assert.equal(afterHostLeft.hostClientId, 'c-friend-2');

  // Volleyball 2v2 same-team claim (P1 + P2 on Left Team)
  const vbResolved = resolveLobbyPresence(
    [
      {
        clientId: 'vb-1',
        name: 'A',
        skin: 'pikachu',
        color: '#fff',
        desiredSlot: 'P1',
        slotUpdatedAt: 10,
        ready: false,
        joinedAt: 10,
        isCreator: true,
      },
      {
        clientId: 'vb-2',
        name: 'B',
        skin: 'bunny',
        color: '#fff',
        desiredSlot: 'P2', // Explicitly picks same team as Host (P1 & P2 = Blue/Left team!)
        slotUpdatedAt: 20,
        ready: true,
        joinedAt: 20,
        isCreator: false,
      },
    ],
    '2v2'
  );
  assert.equal(vbResolved.slots.P1?.clientId, 'vb-1');
  assert.equal(vbResolved.slots.P2?.clientId, 'vb-2');
});
