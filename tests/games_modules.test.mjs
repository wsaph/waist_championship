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
