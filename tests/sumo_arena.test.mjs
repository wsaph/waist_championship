import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOHYO_RING_RADIUS,
  SUMO_BOT_OPPONENTS,
  SUMO_MOVES,
  SUMO_RANKS,
  resolveSumoRank,
  stepSumoRingPhysics,
} from '../lib/sumo_catalog.ts';

test('resolveSumoRank resolves Banzuke progression from Jonokuchi up to Grand Yokozuna', () => {
  const starter = resolveSumoRank(0);
  assert.equal(starter.rank.id, 'jonokuchi');
  assert.equal(starter.nextRank?.id, 'jonidan');
  assert.equal(starter.progressPct, 0);

  const mid = resolveSumoRank(1500);
  assert.equal(mid.rank.id, 'maegashira');
  assert.equal(mid.nextRank?.id, 'komusubi');

  const top = resolveSumoRank(9999);
  assert.equal(top.rank.id, 'yokozuna');
  assert.equal(top.rank.isYokozuna, true);
  assert.equal(top.nextRank, null);
  assert.equal(top.progressPct, 100);
  assert.equal(SUMO_RANKS.length, 10);
});

test('stepSumoRingPhysics resolves belly-to-belly knockback, brace mitigation, and Tawara ring-out', () => {
  const p1 = { x: -0.4, z: 0, vx: 8.5, vz: 0, rotY: 0, mass: 1.2, bracing: false };
  const p2 = { x: 0.4, z: 0, vx: -1.0, vz: 0, rotY: Math.PI, mass: 0.95, bracing: false };

  const res = stepSumoRingPhysics(p1, p2, 0.016, DOHYO_RING_RADIUS);
  assert.equal(res.collided, true);
  assert.ok(res.impactSpeed > 0);
  assert.ok(p2.vx > 0, 'Lighter defender should be knocked backward in +X');
  assert.equal(res.p1RingOut, false);
  assert.equal(res.p2RingOut, false);

  // Pushing fighter past DOHYO_RING_RADIUS triggers instant ring-out
  const nearEdge = { x: DOHYO_RING_RADIUS - 0.05, z: 0, vx: 6.0, vz: 0, rotY: 0, mass: 1, bracing: false };
  const safeCenter = { x: 0, z: 0, vx: 0, vz: 0, rotY: 0, mass: 1, bracing: true };
  const edgeStep = stepSumoRingPhysics(safeCenter, nearEdge, 0.03, DOHYO_RING_RADIUS);
  assert.equal(edgeStep.p1RingOut, false);
  assert.equal(edgeStep.p2RingOut, true);
});

test('SUMO_BOT_OPPONENTS and SUMO_MOVES have valid positive parameters', () => {
  assert.equal(SUMO_BOT_OPPONENTS.length, 4);
  for (const bot of SUMO_BOT_OPPONENTS) {
    assert.ok(bot.winXp > bot.loseXp);
    assert.ok(bot.massMult > 0);
  }
  assert.ok(SUMO_MOVES.tsuppari.cooldownMs < SUMO_MOVES.yorikiri.cooldownMs);
  assert.ok(SUMO_MOVES.yorikiri.cooldownMs < SUMO_MOVES.shiko_quake.cooldownMs);
  assert.equal(SUMO_MOVES.shiko_quake.isAoe, true);
});
