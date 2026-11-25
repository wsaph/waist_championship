import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';
import * as THREE from 'three';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function resolveTsFileCandidate(absBase) {
  const candidates = [
    absBase,
    `${absBase}.ts`,
    `${absBase}.tsx`,
    `${absBase}.js`,
    path.join(absBase, 'index.ts'),
    path.join(absBase, 'index.tsx'),
    path.join(absBase, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return pathToFileURL(c).href;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parentUrl = context.parentURL || '';
    const isWorkspaceParent =
      parentUrl.startsWith('file:') && !parentUrl.includes('/node_modules/');

    if (specifier === 'next/server') {
      return nextResolve(
        `data:text/javascript,${encodeURIComponent(
          'export const NextResponse = { json: (body, init) => Response.json(body, init) };'
        )}`,
        context
      );
    }
    if (specifier === 'next/dynamic') {
      return nextResolve(
        `data:text/javascript,${encodeURIComponent(
          'export default function dynamicMock() { return function DynamicComponent() { return null; }; }'
        )}`,
        context
      );
    }
    if (isWorkspaceParent && specifier.startsWith('@/')) {
      const mapped = resolveTsFileCandidate(path.join(repoRoot, specifier.slice(2)));
      if (mapped) return nextResolve(mapped, context);
    }
    if (
      isWorkspaceParent &&
      (specifier.startsWith('./') || specifier.startsWith('../'))
    ) {
      const parentDir = path.dirname(fileURLToPath(parentUrl));
      const mapped = resolveTsFileCandidate(path.resolve(parentDir, specifier));
      if (mapped) return nextResolve(mapped, context);
    }
    return nextResolve(specifier, context);
  },
});

// Minimal DOM mock for headless 3D island zone tests
function makeMockElement(tag = 'div') {
  const styleProps = new Map();
  const children = [];
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    innerHTML: '',
    onclick: null,
    width: 128,
    height: 64,
    children,
    style: {
      opacity: '1',
      setProperty(k, v) {
        styleProps.set(k, v);
      },
      getPropertyValue(k) {
        return styleProps.get(k) || '';
      },
    },
    appendChild(child) {
      child.parentElement = el;
      children.push(child);
      return child;
    },
    remove() {
      if (el.parentElement) {
        const idx = el.parentElement.children.indexOf(el);
        if (idx !== -1) el.parentElement.children.splice(idx, 1);
        el.parentElement = null;
      }
    },
    getContext() {
      return {
        clearRect() { },
        fillRect() { },
        beginPath() { },
        moveTo() { },
        lineTo() { },
        stroke() { },
        arc() { },
        fill() { },
        fillText() { },
      };
    },
  };
  return el;
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement: (tag) => makeMockElement(tag),
  };
}

const {
  GAME_MODULES,
  ALL_GAME_REALTIME_EVENTS,
  getGameModuleById,
  createIslandGameZonesController,
} = await import('../games/registry.ts');
const { isViewerLockedOutOfActiveMatch } = await import('../games/islandActorShowcase3d.ts');
const { ensureGameSchemas } = await import('../games/schema.ts');
const {
  evaluatePokDengHand,
  comparePokDeng,
  evaluateBlackjackHand,
  compareBlackjack,
  evaluateTexasHoldem7,
  createOldMaidDeck52,
  discardOldMaidPairs,
} = await import('../games/casino/modes/index.ts');

test('GAME_MODULES registers all 6 competitive & party games with singleSessionLock and unique events', () => {
  const ids = GAME_MODULES.map((m) => m.definition.id);
  assert.deepEqual(ids, ['volleyball', 'soccer', 'sumo', 'taekwondo', 'casino', 'shabu']);
  assert.equal(new Set(ALL_GAME_REALTIME_EVENTS).size, 6);

  for (const mod of GAME_MODULES) {
    assert.equal(mod.definition.singleSessionLock, true);
    assert.equal(typeof mod.ModalComponent, 'function');
    assert.equal(getGameModuleById(mod.definition.id), mod);
  }

  assert.equal(getGameModuleById('casino').definition.proximitySource, 'guard');
  assert.equal(getGameModuleById('shabu').definition.proximitySource, 'food_stall');
  assert.equal(getGameModuleById('volleyball').definition.proximitySource, 'own_zone');
  assert.equal(getGameModuleById('soccer').definition.proximitySource, 'own_zone');
});

test('isViewerLockedOutOfActiveMatch locks non-participants out of started matches while allowing active players', () => {
  const waitingLobby = {
    gameId: 'volleyball',
    roomCode: '7777',
    hostUserId: 1,
    hostName: 'Host',
    hostEmoji: '🏐',
    count: 2,
    max: 4,
    status: 'waiting',
    roster: [{ slotId: 'L1', playerId: 1, name: 'Host', emoji: '🏐' }],
    updatedAt: Date.now(),
  };
  assert.equal(
    isViewerLockedOutOfActiveMatch({
      lobby: waitingLobby,
      viewerUserId: 99,
      isCurrentlyPlayingLocally: false,
    }),
    false
  );

  const startedLobby = {
    ...waitingLobby,
    status: 'started',
    roster: [
      { slotId: 'L1', playerId: 1, name: 'Host', emoji: '🏐' },
      { slotId: 'R1', playerId: 2, name: 'Guest', emoji: '🦊' },
    ],
  };

  // Outsider user #99 is locked out
  assert.equal(
    isViewerLockedOutOfActiveMatch({
      lobby: startedLobby,
      viewerUserId: 99,
      isCurrentlyPlayingLocally: false,
    }),
    true
  );

  // Active participant user #2 in roster is NOT locked out
  assert.equal(
    isViewerLockedOutOfActiveMatch({
      lobby: startedLobby,
      viewerUserId: 2,
      isCurrentlyPlayingLocally: false,
    }),
    false
  );

  // Local active player is NOT locked out
  assert.equal(
    isViewerLockedOutOfActiveMatch({
      lobby: startedLobby,
      viewerUserId: 99,
      isCurrentlyPlayingLocally: true,
    }),
    false
  );
});

test('games/casino/modes evaluators resolve Pok Deng, Blackjack, Holdem, and Old Maid rules accurately', () => {
  // Pok Deng: Pok 9 two-deng beats Pok 8
  const pok9Suited = [
    { id: '4S', suit: 'S', rank: 4 },
    { id: '5S', suit: 'S', rank: 5 },
  ];
  const pok8 = [
    { id: '3H', suit: 'H', rank: 3 },
    { id: '5D', suit: 'D', rank: 5 },
  ];
  const pd = comparePokDeng(pok9Suited, pok8);
  assert.equal(pd.outcome, 'win');
  assert.equal(pd.multiplier, 2);
  assert.equal(evaluatePokDengHand(pok9Suited).isPok, true);

  // Blackjack: Ace + King = 21 Blackjack (1.5x payout)
  const bjHand = [
    { id: '1S', suit: 'S', rank: 1 },
    { id: '13H', suit: 'H', rank: 13 },
  ];
  const dealer20 = [
    { id: '10D', suit: 'D', rank: 10 },
    { id: '12C', suit: 'C', rank: 12 },
  ];
  assert.equal(evaluateBlackjackHand(bjHand).isBlackjack, true);
  assert.deepEqual(compareBlackjack(bjHand, dealer20), { outcome: 'win', payoutRatio: 1.5 });

  // Texas Hold'em 7-card evaluator: Royal Flush = category 9
  const royal7 = [
    { id: '1S', suit: 'S', rank: 1 },
    { id: '13S', suit: 'S', rank: 13 },
    { id: '12S', suit: 'S', rank: 12 },
    { id: '11S', suit: 'S', rank: 11 },
    { id: '10S', suit: 'S', rank: 10 },
    { id: '2H', suit: 'H', rank: 2 },
    { id: '7D', suit: 'D', rank: 7 },
  ];
  assert.equal(evaluateTexasHoldem7(royal7).category, 9);

  // Old Maid 52-card mystery deck: 51 dealt + 1 hidden = 52 unique cards
  const { dealDeck, hiddenCard } = createOldMaidDeck52();
  assert.equal(dealDeck.length, 51);
  assert.ok(hiddenCard?.id);
  const { remaining, discardedPairs } = discardOldMaidPairs([
    { id: '7S', suit: 'S', rank: 7 },
    { id: '7H', suit: 'H', rank: 7 },
    { id: '9D', suit: 'D', rank: 9 },
  ]);
  assert.equal(discardedPairs, 1);
  assert.equal(remaining.length, 1);
  assert.equal(remaining[0].rank, 9);
});

test('ensureGameSchemas migrates all 6 game tables and user columns idempotently on SQLite', async () => {
  const client = createClient({ url: ':memory:' });
  await client.execute(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 100
    )
  `);
  const safeAlter = async (sql) => {
    try {
      await client.execute(sql);
    } catch {
      // column exists
    }
  };

  // Run twice to verify idempotency
  await ensureGameSchemas(client, safeAlter);
  await ensureGameSchemas(client, safeAlter);

  const tablesRes = await client.execute(
    `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`
  );
  const tableNames = tablesRes.rows.map((r) => String(r.name));
  for (const expected of [
    'casino_bank',
    'penalty_matches',
    'penalty_player_stats',
    'sumo_progress',
    'taekwondo_progress',
    'vb_match_history',
    'vb_player_stats',
  ]) {
    assert.ok(tableNames.includes(expected), `Expected table ${expected}`);
  }

  const bankRow = await client.execute('SELECT guard_balance FROM casino_bank WHERE id = 1');
  assert.equal(bankRow.rows.length, 1);
});

test('createIslandGameZonesController mounts 4 3D Sports Plaza zones, renders live actors, and disposes cleanly', () => {
  const scene = new THREE.Scene();
  const labelsContainer = makeMockElement('div');
  const liveLobbies = new Map();

  const controller = createIslandGameZonesController({
    scene,
    labelsContainer,
    qualityTier: 'high',
    islandCenterX: 11.5,
    islandW: 102,
    islandD: 60,
    sportsPlazaX: 35,
    sportsPlazaBackX: 51.8,
    getPlayers: () => [
      { id: 1, name: 'มีนา', emoji: '🐰', colorHex: '#38BDF8', species: 'bunny' },
      { id: 2, name: 'ไคโตะ', emoji: '🦊', colorHex: '#FB7185', species: 'fox' },
    ],
    getLiveLobby: (gid) => liveLobbies.get(gid) || null,
    getWalkingSpectatorId: () => 1,
    isNearZone: () => false,
    focusCamera: () => { },
    walkSpectatorTo: () => { },
    openGame: () => { },
  });

  assert.equal(controller.zones.length, 4);
  assert.equal(labelsContainer.children.length, 4);

  // Verify symmetrical 2×2 Hokkaido Grand Sports Park layout & facing angles
  const vbZone = controller.getZone('volleyball');
  const scZone = controller.getZone('soccer');
  const sumoZone = controller.getZone('sumo');
  const tkdZone = controller.getZone('taekwondo');
  assert.equal(vbZone.position.x, 35);
  assert.equal(vbZone.position.z, -10.5);
  assert.equal(scZone.position.x, 35);
  assert.equal(scZone.position.z, 10.5);
  assert.equal(scZone.proximityRadius, 6.8);
  assert.equal(sumoZone.position.x, 51.8);
  assert.equal(sumoZone.position.z, -10.5);
  assert.equal(tkdZone.position.x, 51.8);
  assert.equal(tkdZone.position.z, 10.5);
  assert.ok(tkdZone.group.rotation.y < -Math.PI * 0.35);
  assert.ok(sumoZone.group.rotation.y < -Math.PI * 0.2);

  // Start an active soccer 3v3 match -> 3D showcase characters + floating tags appear on the pitch!
  liveLobbies.set('soccer', {
    gameId: 'soccer',
    roomCode: '6666',
    mode: '3v3',
    hostUserId: 1,
    hostName: 'มีนา',
    hostEmoji: '🐰',
    count: 2,
    max: 2,
    status: 'started',
    scoreLeft: 2,
    scoreRight: 1,
    roster: [
      { slotId: 'L1', playerId: 1, name: 'มีนา', emoji: '🐰', team: 'left' },
      { slotId: 'R1', playerId: 2, name: 'ไคโตะ', emoji: '🦊', team: 'right' },
    ],
    updatedAt: Date.now(),
  });

  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 200);
  camera.position.set(38, 12, 28);
  camera.lookAt(38, 1, 10);
  camera.updateMatrixWorld();

  const proximities = {};
  const soccerZone = controller.getZone('soccer');
  controller.updateAll(
    { elapsed: 1.5, delta: 0.016, camera, viewportWidth: 1280, viewportHeight: 720 },
    new THREE.Vector3(soccerZone.position.x, 0.2, soccerZone.position.z),
    (gid, near) => {
      proximities[gid] = near;
    }
  );

  assert.equal(proximities.soccer, true);
  assert.equal(labelsContainer.children.length, 6); // 4 zone tags + 2 live soccer player tags!

  controller.disposeAll();
  assert.equal(labelsContainer.children.length, 0);
  assert.equal(scene.children.length, 0);
});

test('Multiplayer sync engines enforce exact 20Hz (50ms) tick rate, 0ms Client-side Prediction, Smooth Reconciliation, and Ball Lerp', async () => {
  const {
    HOST_BROADCAST_INTERVAL_MS,
    FOOTBALL_BROADCAST_INTERVAL_MS,
    ClientStateInterpolator,
    FootballStateInterpolator,
  } = await import('../games/shared/realtimeSync.ts');
  const { createMatchState } = await import('../games/volleyball/2d/physics2d.ts');
  const { createInitialMatchState, stepLocalVolleyballPlayer } = await import(
    '../games/volleyball/engine.ts'
  );
  const { createInitialShabuState, stepLocalShabuPlayer } = await import(
    '../games/shabu/engine.ts'
  );

  // 1. Both Host broadcast rates are strictly 20 Hz (50ms)
  assert.equal(HOST_BROADCAST_INTERVAL_MS, 50);
  assert.equal(FOOTBALL_BROADCAST_INTERVAL_MS, 50);

  // 2. 2D Volleyball: Guest local slot moves immediately via Client-side Prediction before any Host packet!
  const vb2dState = createMatchState('1v1', {});
  vb2dState.phase = 'rally';
  const p3Player = vb2dState.players.find((p) => p.slot === 'P3');
  const p3StartX = p3Player.x;
  const interp2d = new ClientStateInterpolator();
  interp2d.applyInterpolated(vb2dState, 1000, 1 / 60, {
    slot: 'P3',
    input: { left: true, right: false, jump: false, down: false, action: false },
  });
  assert.ok(
    p3Player.x < p3StartX,
    'Guest P3 should move left immediately without waiting for Host snapshot'
  );

  // 3. 3D Volleyball & Shabu local prediction steppers respect court/table boundaries
  const vb3d = createInitialMatchState('1v1', { L1: false, L2: false, R1: false, R2: false });
  const r1Vb3d = vb3d.players.find((p) => p.slotId === 'R1');
  const r1Vb3dStart = r1Vb3d.x;
  stepLocalVolleyballPlayer(
    r1Vb3d,
    { left: true, right: false, jump: true, action: false },
    vb3d.court,
    1 / 60
  );
  assert.ok(r1Vb3d.x < r1Vb3dStart);
  assert.ok(r1Vb3d.vy > 0, 'Predicted jump applies upward velocity immediately');

  const shabu = createInitialShabuState(['P1', 'P2']);
  const guestChef = shabu.players.find((p) => p.slotId === 'P2');
  const startChefX = guestChef.x;
  const dashed = stepLocalShabuPlayer(
    guestChef,
    { mx: 1, mz: 0, interact: false, dash: true },
    1 / 60
  );
  assert.equal(dashed, true);
  assert.ok(guestChef.x > startChefX);

  // 4. 3v3 Football Interpolator: Guest local prediction + ball Linear Interpolation & dead-reckoning bridge
  const fbInterp = new FootballStateInterpolator();
  const baseSnap = {
    seq: 1,
    ts: 1000,
    ph: 'playing',
    tm: 120,
    sb: 0,
    sr: 0,
    w: null,
    bx: 0,
    by: 0.42,
    bz: 0,
    bvx: 10,
    bvz: 0,
    pw: 0,
    pl: [
      { id: 'B1', x: -4, z: 0, vx: 4, vz: 0, y: 0, st: 100, ch: 0, sl: 0 },
      { id: 'R1', x: 4, z: 0, vx: 0, vz: 0, y: Math.PI, st: 100, ch: 0, sl: 0 },
    ],
  };
  fbInterp.pushSnapshot(baseSnap, 1000);
  fbInterp.pushSnapshot(
    {
      ...baseSnap,
      seq: 2,
      ts: 1050,
      bx: 0.5,
      pl: [
        { id: 'B1', x: -3.8, z: 0, vx: 4, vz: 0, y: 0, st: 100, ch: 0, sl: 0 },
        { id: 'R1', x: 4, z: 0, vx: 0, vz: 0, y: Math.PI, st: 100, ch: 0, sl: 0 },
      ],
    },
    1050
  );

  // Mid-frame (25ms after seq 2 => alpha = 0.5): ball lerps halfway (0.25) while Guest R1 predicts moving -X!
  const mid = fbInterp.sample(1075, {
    slot: 'R1',
    input: {
      moveX: -1,
      moveZ: 0,
      sprintHeld: true,
      shootHeld: false,
      passPressed: false,
      slidePressed: false,
    },
    dt: 1 / 60,
  });
  assert.ok(Math.abs(mid.ballX - 0.25) < 0.02, `Expected lerped ballX ~0.25, got ${mid.ballX}`);
  const r1Mid = mid.players.find((p) => p.id === 'R1');
  assert.ok(r1Mid.x < 4, 'Guest R1 moves immediately via Client-side Prediction');

  // Slight packet jitter (70ms after seq 2 => 20ms past 50ms window): ball smoothly extrapolates forward instead of freezing!
  const jitter = fbInterp.sample(1120);
  assert.ok(jitter.ballX > 0.5, 'Ball dead-reckons smoothly during slight packet delay');
});

test('Realtime Resilience: Host yields immediately when hidden (`isHidden`), preserving player slots, and GuestInputWatchdog prevents stuck keys', async () => {
  const {
    GuestInputWatchdog,
    STALE_GUEST_INPUT_MS,
    resolveLobbyPresence,
    resolvePenaltyLobbyPresence,
  } = await import('../games/shared/realtimeSync.ts');

  // 1. Volleyball Host Election yields to visible peer when creator hides tab, WITHOUT changing assigned slots!
  const vbMembers = [
    {
      clientId: 'host-mobile',
      name: 'Host',
      skin: 'bunny',
      color: '#38BDF8',
      desiredSlot: 'P1',
      slotUpdatedAt: 100,
      ready: true,
      joinedAt: 100,
      isCreator: true,
      isHidden: true, // Host minimized phone!
    },
    {
      clientId: 'guest-active',
      name: 'Guest',
      skin: 'fox',
      color: '#FB7185',
      desiredSlot: 'P3',
      slotUpdatedAt: 200,
      ready: true,
      joinedAt: 200,
      isCreator: false,
      isHidden: false,
    },
  ];
  const vbResolved = resolveLobbyPresence(vbMembers, '1v1');
  assert.equal(
    vbResolved.hostClientId,
    'guest-active',
    'Visible peer immediately takes over Host duty when creator minimizes app'
  );
  assert.equal(vbResolved.slots.P1?.clientId, 'host-mobile', 'Original P1 slot never swaps');
  assert.equal(vbResolved.slots.P3?.clientId, 'guest-active', 'Original P3 slot never swaps');

  // 2. 3v3 Football Host Election yields to visible peer while preserving B1/R1 slots!
  const fbMembers = [
    {
      clientId: 'cap-b1',
      name: 'Cap Blue',
      modelId: 'fox_hero',
      desiredSlot: 'B1',
      slotUpdatedAt: 100,
      ready: true,
      joinedAt: 100,
      isCreator: true,
      isHidden: true,
    },
    {
      clientId: 'cap-r1',
      name: 'Cap Red',
      modelId: 'husky_hero',
      desiredSlot: 'R1',
      slotUpdatedAt: 150,
      ready: true,
      joinedAt: 150,
      isCreator: false,
      isHidden: false,
    },
  ];
  const fbResolved = resolvePenaltyLobbyPresence(fbMembers, 'match_3v3');
  assert.equal(fbResolved.hostClientId, 'cap-r1');
  assert.equal(fbResolved.slots.B1?.clientId, 'cap-b1');
  assert.equal(fbResolved.slots.R1?.clientId, 'cap-r1');

  // 3. GuestInputWatchdog keeps active input with keepalives, and auto-releases stuck input after STALE_GUEST_INPUT_MS!
  const watchdog = new GuestInputWatchdog();
  const neutral = { left: false, right: false };
  watchdog.record('P2', { left: false, right: true }, 1000);
  assert.deepEqual(watchdog.read('P2', 2200, neutral), { left: false, right: true });

  // Keepalive refreshes timestamp at t=2200ms -> still valid at t=4500ms!
  watchdog.record('P2', { left: false, right: true }, 2200);
  assert.deepEqual(watchdog.read('P2', 4500, neutral), { left: false, right: true });

  // Lost connection / dropped keyup past 2200 + STALE_GUEST_INPUT_MS -> automatically resets to neutral!
  assert.deepEqual(
    watchdog.read('P2', 2200 + STALE_GUEST_INPUT_MS + 50, neutral),
    neutral,
    'Stale held input auto-decays to neutral so player never walks into wall forever'
  );
});
