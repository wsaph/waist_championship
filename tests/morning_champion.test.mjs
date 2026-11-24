import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_CHECKIN_CHAMPION_BONUS,
  DAILY_CHECKIN_NORMAL_BONUS,
  computeMorningChampionsAt7Am,
  resolveDailyCheckinReward,
} from '../lib/morning_champion.ts';

test('awards normal 10 GP to everyone when all players have 0 steps at 07:00 AM', () => {
  const entries = [
    { userId: 1, currentStepCount: 0, stepsAddedSinceCutoff: 0 },
    { userId: 2, currentStepCount: 0, stepsAddedSinceCutoff: 0 },
  ];
  const champ = computeMorningChampionsAt7Am(entries);
  assert.equal(champ.maxStepsAt7Am, 0);
  assert.deepEqual(champ.championUserIds, []);

  assert.equal(resolveDailyCheckinReward(1, entries).earned, DAILY_CHECKIN_NORMAL_BONUS);
  assert.equal(resolveDailyCheckinReward(1, entries).isMorningChampion, false);
});

test('awards 15 GP only to the true 07:00 AM leader even if overtaken later in the morning', () => {
  // At 07:00 AM: User 1 had 50,000 steps; User 2 had 48,000 steps.
  // At 08:00 AM: User 2 synced +6,000 steps (now 54,000 total).
  const entries = [
    { userId: 1, currentStepCount: 50000, stepsAddedSinceCutoff: 0 },
    { userId: 2, currentStepCount: 54000, stepsAddedSinceCutoff: 6000 },
    { userId: 3, currentStepCount: 32000, stepsAddedSinceCutoff: 2000 },
  ];

  const r1 = resolveDailyCheckinReward(1, entries);
  assert.equal(r1.earned, DAILY_CHECKIN_CHAMPION_BONUS);
  assert.equal(r1.isMorningChampion, true);
  assert.equal(r1.championStepsAt7Am, 50000);
  assert.equal(r1.coChampionCount, 1);

  // User 2 overtook after 07:00 AM -> still gets normal 10 GP today!
  const r2 = resolveDailyCheckinReward(2, entries);
  assert.equal(r2.earned, DAILY_CHECKIN_NORMAL_BONUS);
  assert.equal(r2.isMorningChampion, false);
});

test('reconstructs 07:00 AM steps accurately even when a manual set correction reduced steps today', () => {
  // At 07:00 AM: User 1 had 60,000 steps. At 09:00 AM they corrected total steps down by -2,000 to 58,000.
  const entries = [
    { userId: 1, currentStepCount: 58000, stepsAddedSinceCutoff: -2000 },
    { userId: 2, currentStepCount: 59000, stepsAddedSinceCutoff: 0 },
  ];
  const r1 = resolveDailyCheckinReward(1, entries);
  assert.equal(r1.earned, DAILY_CHECKIN_CHAMPION_BONUS);
  assert.equal(r1.championStepsAt7Am, 60000);
});

test('awards 15 GP to all co-champions when tied for highest step count at 07:00 AM', () => {
  const entries = [
    { userId: 10, currentStepCount: 42000, stepsAddedSinceCutoff: 2000 }, // 40,000 at 7 AM
    { userId: 20, currentStepCount: 40000, stepsAddedSinceCutoff: 0 }, // 40,000 at 7 AM
    { userId: 30, currentStepCount: 39999, stepsAddedSinceCutoff: 0 }, // 39,999 at 7 AM
  ];

  const r10 = resolveDailyCheckinReward(10, entries);
  const r20 = resolveDailyCheckinReward(20, entries);
  const r30 = resolveDailyCheckinReward(30, entries);

  assert.equal(r10.earned, 15);
  assert.equal(r10.isMorningChampion, true);
  assert.equal(r10.coChampionCount, 2);

  assert.equal(r20.earned, 15);
  assert.equal(r20.isMorningChampion, true);
  assert.equal(r20.coChampionCount, 2);

  assert.equal(r30.earned, 10);
  assert.equal(r30.isMorningChampion, false);
});
