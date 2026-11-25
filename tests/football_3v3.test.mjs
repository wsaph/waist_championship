import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALL_FOOTBALL_SLOTS,
  EMPTY_TEAM_INPUT,
  GOAL_3V3_HALF_Z,
  GOAL_3V3_HEIGHT,
  MATCH_DURATION_SEC,
  PITCH_HALF_W,
  createInitialFootballMatchState,
  stepFootballMatch,
} from '../games/soccer/match3v3/physics.ts';
import { stepAllFootballAI } from '../games/soccer/match3v3/ai.ts';

test('Street Mini-Goal 3v3 spawns 6 players (B1..B3 vs R1..R3, zero GK) with compact โกลหนู dimensions', () => {
  const st = createInitialFootballMatchState({
    blueCaptainName: 'กัปตันฟ้า',
    blueModelId: 'fox_hero',
    redCaptainName: 'กัปตันแดง',
    redModelId: 'husky_hero',
  });

  assert.equal(st.players.length, 6);
  assert.deepEqual(
    st.players.map((p) => p.id),
    [...ALL_FOOTBALL_SLOTS]
  );
  assert.equal(st.players.filter((p) => p.team === 'blue').length, 3);
  assert.equal(st.players.filter((p) => p.team === 'red').length, 3);
  assert.equal(GOAL_3V3_HALF_Z, 1.8); // 3.60m wide street mini-goal
  assert.equal(GOAL_3V3_HEIGHT, 1.7); // 1.70m high street mini-goal
  assert.equal(st.timeRemaining, MATCH_DURATION_SEC);
});

test('6-Player Party Controls: humans control their own fixed slots independently & passing never switches character', () => {
  const st = createInitialFootballMatchState({
    slots: {
      B1: { name: 'เอก', modelId: 'fox_hero', isBot: false },
      B2: { name: 'บอย', modelId: 'bunny_hero', isBot: false },
      B3: { name: 'ชัย', modelId: 'panda_hero', isBot: false },
      R1: { name: 'แดง1', modelId: 'husky_hero', isBot: false },
      R2: { name: 'แดง2', modelId: 'tiger_hero', isBot: false },
      R3: { name: 'แดง3', modelId: 'bear_hero', isBot: false },
    },
  });

  const b1 = st.players.find((p) => p.id === 'B1');
  const b2 = st.players.find((p) => p.id === 'B2');
  const r1 = st.players.find((p) => p.id === 'R1');
  b1.x = 0;
  b1.z = 0;
  b2.x = 5;
  b2.z = -5;
  st.ball.ownerId = 'B1';

  const startR1X = r1.x;

  // B1 passes diagonally up-right toward B2 while R1 sprints left simultaneously!
  stepFootballMatch(
    st,
    {
      B1: { ...EMPTY_TEAM_INPUT, moveX: 1, moveZ: -1, passSeq: 1 },
      B2: { ...EMPTY_TEAM_INPUT, moveX: 1, moveZ: 0 },
      R1: { ...EMPTY_TEAM_INPUT, moveX: -1, moveZ: 0, sprint: true },
    },
    1 / 60
  );

  assert.equal(st.ball.ownerId, null);
  assert.equal(st.events.pass, true);
  assert.ok(st.ball.vx > 5 && st.ball.vz < -3, 'Ball launched toward B2');
  assert.equal(b1.isBot, false, 'B1 stays human-controlled');
  assert.equal(b2.isBot, false, 'B2 stays human-controlled');
  assert.ok(r1.x < startR1X, 'R1 moved independently on the same tick');
});

test('Call for Pass: pressing Pass off-ball makes an AI teammate pass straight to the calling human', () => {
  const st = createInitialFootballMatchState({
    slots: {
      B1: { name: 'ผู้เล่นฟ้า', modelId: 'fox_hero', isBot: false },
      B2: { name: 'บอทฟ้า #2', modelId: 'bunny_hero', isBot: true },
      B3: { name: 'บอทฟ้า #3', modelId: 'panda_hero', isBot: true },
    },
  });

  const b1 = st.players.find((p) => p.id === 'B1');
  const b2 = st.players.find((p) => p.id === 'B2');
  b2.x = -2;
  b2.z = -5;
  b1.x = 6;
  b1.z = 2;
  st.ball.x = b2.x + 0.6;
  st.ball.z = b2.z;
  st.ball.ownerId = 'B2'; // AI Bot currently holds the ball

  stepFootballMatch(
    st,
    {
      B1: { ...EMPTY_TEAM_INPUT, passSeq: 1 },
    },
    1 / 60
  );

  assert.equal(st.ball.ownerId, null);
  assert.equal(st.events.pass, true);
  assert.ok(st.ball.vx > 6 && st.ball.vz > 4, 'AI Bot B2 immediately passed toward human B1');
});

test('Outfield Body/Slide Shot-Block: defender standing in front of โกลหนู blocks incoming power shot', () => {
  const st = createInitialFootballMatchState({
    slots: {
      B1: { name: 'คนยิงฟ้า', modelId: 'fox_hero', isBot: false },
      R3: { name: 'ตัวกวาดแดง', modelId: 'husky_hero', isBot: false },
    },
  });

  const b1 = st.players.find((p) => p.id === 'B1');
  const r3 = st.players.find((p) => p.id === 'R3');
  b1.x = 12.5;
  b1.z = 0;
  r3.x = PITCH_HALF_W - 2.2;
  r3.z = 0;
  // Move other Red bots out of the shot lane
  st.players.find((p) => p.id === 'R1').z = -9;
  st.players.find((p) => p.id === 'R2').z = 9;

  st.ball.ownerId = 'B1';
  st.ball.x = b1.x + 0.66;
  st.ball.z = 0;
  b1.shootCharge = 70;
  b1.wasCharging = true;

  // Release shot from B1 straight toward R3 guarding the mini-goal
  stepFootballMatch(st, { B1: { ...EMPTY_TEAM_INPUT, shootCharging: false, shootSeq: 1 } }, 1 / 60);
  assert.equal(st.events.kick, true);

  let blocked = false;
  for (let i = 0; i < 40; i++) {
    stepFootballMatch(st, {}, 1 / 60);
    if (st.events.save) {
      blocked = true;
      break;
    }
  }

  assert.equal(blocked, true, 'Defender R3 body-blocked the fast shot in front of mini-goal');
  assert.equal(st.scoreBlue, 0, 'Goal prevented by defender block');
  assert.ok(st.ball.vx < 0, 'Blocked ball deflected back out toward midfield');
});

test('Scoring into unguarded โกลหนู increments score, credits goalsBySlot, and resets kickoff', () => {
  const st = createInitialFootballMatchState({});
  const b1 = st.players.find((p) => p.id === 'B1');
  b1.x = PITCH_HALF_W - 4.0;
  b1.z = 0;
  // Clear Red players away from goal mouth
  for (const p of st.players) {
    if (p.team === 'red') p.z = 10;
  }
  st.ball.ownerId = 'B1';

  for (let i = 0; i < 20; i++) {
    stepFootballMatch(st, { B1: { ...EMPTY_TEAM_INPUT, shootCharging: true } }, 1 / 60);
  }
  stepFootballMatch(st, { B1: { ...EMPTY_TEAM_INPUT, shootCharging: false, shootSeq: 1 } }, 1 / 60);

  let scored = false;
  for (let i = 0; i < 60; i++) {
    stepFootballMatch(st, {}, 1 / 60);
    if (st.phase === 'goal_celebration') {
      scored = true;
      break;
    }
  }

  assert.equal(scored, true);
  assert.equal(st.scoreBlue, 1);
  assert.equal(st.goalsBySlot.B1, 1);

  // Advance past 2.25s celebration -> resets to center kickoff
  for (let i = 0; i < 160; i++) {
    stepFootballMatch(st, {}, 1 / 60);
  }
  assert.equal(st.phase, 'playing');
  assert.equal(st.ball.x, 0);
  assert.equal(st.ball.z, 0);
});

test('Full-time 3-minute tie triggers tie_to_penalty & AI Last-Man Sweeper guards mini-goal', () => {
  const st = createInitialFootballMatchState({ durationSec: 0.04 });
  st.scoreBlue = 2;
  st.scoreRed = 2;
  stepFootballMatch(st, {}, 0.05);
  assert.equal(st.phase, 'tie_to_penalty');

  // Verify AI Last-Man Sweeper drops back in front of Red mini-goal when Blue holds ball
  const aiSt = createInitialFootballMatchState({});
  const b1 = aiSt.players.find((p) => p.id === 'B1');
  b1.x = -8;
  b1.z = 0;
  aiSt.ball.x = -7.34;
  aiSt.ball.z = 0;
  aiSt.ball.ownerId = 'B1';

  for (let i = 0; i < 95; i++) {
    stepFootballMatch(aiSt, { B1: EMPTY_TEAM_INPUT }, 1 / 60, (s, dt, ops) => {
      stepAllFootballAI(s, dt, ops, 'normal');
    });
  }

  const redBots = aiSt.players.filter((p) => p.team === 'red');
  const maxRedX = Math.max(...redBots.map((p) => p.x));
  assert.ok(maxRedX > 14.5, 'Deepest Red AI bot drops back as Last-Man Sweeper in front of mini-goal');
});
