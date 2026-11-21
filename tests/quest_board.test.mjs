import test from 'node:test';
import assert from 'node:assert/strict';
import {
  QUEST_MIN_DURATION_DAYS,
  QUEST_MIN_STAKE,
  QUEST_MAX_STAKE,
  computeBetPayouts,
  computeBettingWindowState,
  computeCoopMultiplier,
  computePerMemberQuestReward,
  computeSponsorPayout,
  validateQuestDateRange,
  validateStakeIncrement,
  buildFallbackQuestSummary,
} from '../lib/quest_board.ts';

test('validateQuestDateRange enforces 30-day minimum and valid calendar dates', () => {
  const shortRange = validateQuestDateRange('2026-05-01', '2026-05-30');
  assert.equal(shortRange.ok, false);

  const exact30 = validateQuestDateRange('2026-05-01', '2026-05-31');
  assert.equal(exact30.ok, true);
  if (exact30.ok) assert.equal(exact30.days, 30);

  const invalidDate = validateQuestDateRange('2026-02-30', '2026-04-01');
  assert.equal(invalidDate.ok, false);

  const customMin45 = validateQuestDateRange('2026-05-01', '2026-06-05', 45);
  assert.equal(customMin45.ok, false);
});

test('computeCoopMultiplier and computePerMemberQuestReward add +10% per extra member', () => {
  assert.equal(computeCoopMultiplier(1), 1);
  assert.equal(computeCoopMultiplier(2), 1.1);
  assert.equal(computeCoopMultiplier(3), 1.2);
  assert.equal(computeCoopMultiplier(4), 1.3);

  assert.equal(computePerMemberQuestReward(200, 1), 200);
  assert.equal(computePerMemberQuestReward(200, 2), 220);
  assert.equal(computePerMemberQuestReward(200, 3), 240);
  assert.equal(computePerMemberQuestReward(0, 3), 0);
});

test('computeSponsorPayout returns 200% on success and 0 on failure', () => {
  assert.equal(computeSponsorPayout(100, true), 200);
  assert.equal(computeSponsorPayout(500, true), 1000);
  assert.equal(computeSponsorPayout(100, false), 0);
  assert.equal(computeSponsorPayout(0, true), 0);
});

test('computeBetPayouts pays pro-rata share when > 2x and guarantees 2x minimum otherwise', () => {
  // Case 1: Large losing pool -> pro-rata beats 2x guarantee
  // Winners: user 1 (100), user 2 (300) => total winning 400
  // Losers: user 3 (1000) => total losing 1000
  // User 1 share = floor(100/400 * 1000) = 250 -> total 350 (> 200)
  // User 2 share = floor(300/400 * 1000) = 750 -> total 1050 (> 600)
  const bigPool = computeBetPayouts(
    [
      { userId: 1, side: 'success', amount: 100 },
      { userId: 2, side: 'success', amount: 300 },
      { userId: 3, side: 'fail', amount: 1000 },
    ],
    'success'
  );
  assert.equal(bigPool[0].payout, 350);
  assert.equal(bigPool[0].usedMinGuarantee, false);
  assert.equal(bigPool[1].payout, 1050);
  assert.equal(bigPool[1].usedMinGuarantee, false);
  assert.equal(bigPool[2].payout, 0);

  // Case 2: No losers (losing pool = 0) -> 2x minimum guarantee applies
  const noLosers = computeBetPayouts(
    [{ userId: 1, side: 'success', amount: 150 }],
    'success'
  );
  assert.equal(noLosers[0].payout, 300);
  assert.equal(noLosers[0].usedMinGuarantee, true);

  // Case 3: Small losing pool -> pro-rata < 2x -> 2x guarantee applies
  const smallPool = computeBetPayouts(
    [
      { userId: 1, side: 'fail', amount: 200 },
      { userId: 2, side: 'success', amount: 50 },
    ],
    'fail'
  );
  assert.equal(smallPool[0].payout, 400);
  assert.equal(smallPool[0].usedMinGuarantee, true);
  assert.equal(smallPool[1].payout, 0);
});

test('validateStakeIncrement enforces min 10 and max 500 per user per quest', () => {
  assert.equal(validateStakeIncrement(0, QUEST_MIN_STAKE - 1).ok, false);
  assert.equal(validateStakeIncrement(0, QUEST_MIN_STAKE).ok, true);
  assert.equal(validateStakeIncrement(0, QUEST_MAX_STAKE).ok, true);
  assert.equal(validateStakeIncrement(0, QUEST_MAX_STAKE + 1).ok, false);
  assert.equal(validateStakeIncrement(450, 50).ok, true);
  assert.equal(validateStakeIncrement(450, 51).ok, false);
  assert.equal(validateStakeIncrement(0, -10).ok, false);
});

test('computeBettingWindowState checks active status and expiry', () => {
  const now = Date.parse('2026-05-01T12:00:00.000Z');
  const open = computeBettingWindowState('active', '2026-05-08T12:00:00.000Z', now);
  assert.equal(open.isBettingOpen, true);
  assert.equal(open.bettingMsRemaining, 7 * 86_400_000);

  const expired = computeBettingWindowState('active', '2026-05-01T11:59:59.000Z', now);
  assert.equal(expired.isBettingOpen, false);

  const voting = computeBettingWindowState('voting', '2026-05-08T12:00:00.000Z', now);
  assert.equal(voting.isBettingOpen, false);
});

test('buildFallbackQuestSummary always produces non-empty Thai summary with >=30 days', () => {
  const res = buildFallbackQuestSummary('งดน้ำหวาน', 'ไม่กินชาไข่มุก', 10);
  assert.ok(res.summary.includes(`${QUEST_MIN_DURATION_DAYS}`));
  assert.ok(res.verificationTip.length > 10);
});
