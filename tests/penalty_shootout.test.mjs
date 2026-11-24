import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOAL_ZONES,
  classifyPowerZone,
  computePowerBarCursor,
  evaluateShootoutProgress,
  resolvePenaltyTurn,
} from '../lib/penalty_rules.ts';

test('GOAL_ZONES defines all 6 penalty target zones with valid goal coordinates', () => {
  assert.equal(GOAL_ZONES.length, 6);
  const ids = GOAL_ZONES.map((z) => z.id);
  assert.deepEqual(ids, [
    'top_left',
    'top_center',
    'top_right',
    'bottom_left',
    'bottom_center',
    'bottom_right',
  ]);
});

test('Timing Power Bar classifies yellow, green sweet-spot, and red overpower zones accurately', () => {
  assert.equal(classifyPowerZone(30), 'yellow');
  assert.equal(classifyPowerZone(55), 'green');
  assert.equal(classifyPowerZone(72), 'green');
  assert.equal(classifyPowerZone(80), 'green');
  assert.equal(classifyPowerZone(88), 'red');

  const startVal = computePowerBarCursor(0, 1);
  const peakVal = computePowerBarCursor(0.5, 1);
  const bounceBackVal = computePowerBarCursor(1.0, 1);
  assert.equal(startVal, 0);
  assert.equal(peakVal, 100);
  assert.equal(bounceBackVal, 0);
});

test('resolvePenaltyTurn scores on unguessed green shot, saves on matched yellow shot, and misses on high red roll', () => {
  const greenGoal = resolvePenaltyTurn({
    turnIndex: 0,
    shooterSide: 'p1',
    shooter: { zone: 'top_left', power: 68, powerZone: 'green' },
    keeper: { zone: 'bottom_right' },
    roll: 0.5,
  });
  assert.equal(greenGoal.outcome, 'goal');
  assert.equal(greenGoal.scored, true);

  const yellowSaved = resolvePenaltyTurn({
    turnIndex: 1,
    shooterSide: 'p2',
    shooter: { zone: 'bottom_left', power: 40, powerZone: 'yellow' },
    keeper: { zone: 'bottom_left' },
    roll: 0.5,
  });
  assert.equal(yellowSaved.outcome, 'saved');
  assert.equal(yellowSaved.scored, false);

  const redOver = resolvePenaltyTurn({
    turnIndex: 2,
    shooterSide: 'p1',
    shooter: { zone: 'top_center', power: 96, powerZone: 'red' },
    keeper: { zone: 'bottom_left' },
    roll: 0.1,
  });
  assert.equal(redOver.outcome, 'over');
  assert.equal(redOver.scored, false);
});

test('evaluateShootoutProgress handles 5-kick early mathematical clinch and Sudden Death rounds', () => {
  const mkTurn = (turnIndex, shooterSide, scored) => ({
    turnIndex,
    roundNumber: Math.floor(turnIndex / 2) + 1,
    isSuddenDeath: turnIndex >= 10,
    shooterSide,
    keeperSide: shooterSide === 'p1' ? 'p2' : 'p1',
    shooterZone: 'top_left',
    keeperZone: 'bottom_right',
    power: 68,
    powerZone: 'green',
    outcome: scored ? 'goal' : 'saved',
    scored,
    ballEndX: -2.5,
    ballEndY: 2.0,
    curveX: 0.6,
    flightDurationSec: 0.52,
  });

  // 3-0 after 3 kicks each -> P1 leads by 3 with only 2 kicks left -> immediate clinch!
  const earlyClinch = evaluateShootoutProgress([
    mkTurn(0, 'p1', true),
    mkTurn(1, 'p2', false),
    mkTurn(2, 'p1', true),
    mkTurn(3, 'p2', false),
    mkTurn(4, 'p1', true),
    mkTurn(5, 'p2', false),
  ]);
  assert.equal(earlyClinch.isFinished, true);
  assert.equal(earlyClinch.winner, 'p1');
  assert.equal(earlyClinch.p1Goals, 3);
  assert.equal(earlyClinch.p2Goals, 0);

  // 4-4 after 5 kicks each -> enters Sudden Death -> Round 6 P1 scores, P2 misses -> P1 wins!
  const regTied = [
    mkTurn(0, 'p1', true),
    mkTurn(1, 'p2', true),
    mkTurn(2, 'p1', true),
    mkTurn(3, 'p2', true),
    mkTurn(4, 'p1', true),
    mkTurn(5, 'p2', true),
    mkTurn(6, 'p1', true),
    mkTurn(7, 'p2', true),
    mkTurn(8, 'p1', false),
    mkTurn(9, 'p2', false),
  ];
  const sdCheck = evaluateShootoutProgress(regTied);
  assert.equal(sdCheck.isFinished, false);
  assert.equal(sdCheck.isSuddenDeath, true);

  const sdResolved = evaluateShootoutProgress([
    ...regTied,
    mkTurn(10, 'p1', true),
    mkTurn(11, 'p2', false),
  ]);
  assert.equal(sdResolved.isFinished, true);
  assert.equal(sdResolved.isSuddenDeath, true);
  assert.equal(sdResolved.winner, 'p1');
  assert.equal(sdResolved.p1Goals, 5);
  assert.equal(sdResolved.p2Goals, 4);
});
