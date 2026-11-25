// games/soccer/match3v3/ai.ts
// Smart Street Mini-Goal 3v3 ("โกลหนู 3v3") AI for Bot-Controlled Slots (`p.isBot === true`):
// - Zero Goalkeepers! Each team has 3 outfield street players.
// - On Defense: Closest AI presses the ball (unless a human teammate is already closer), while
//   the deepest AI acts as a Last-Man Mini-Goal Sweeper ("ตัวกวาดหน้าโกลหนู") blocking shots!
// - On Offense: Dribbling, smart 1-2 passing to open human/AI teammates, & crisp low mini-goal shots!

import type { PenaltyDifficulty } from '../penalty/rules';
import type {
  FootballAiOps,
  FootballMatchState,
  FootballPlayerEntity,
  FootballTeam,
} from './physics';

const PITCH_HALF_W = 19.0;
const PITCH_HALF_D = 12.0;
const GOAL_3V3_HALF_Z = 1.8;

function steerToward(
  player: FootballPlayerEntity,
  targetX: number,
  targetZ: number,
  maxSpeed: number,
  arriveRadius = 0.5
): void {
  if (player.stunTimer > 0 || player.slideTimer > 0) return;
  const dx = targetX - player.x;
  const dz = targetZ - player.z;
  const dist = Math.hypot(dx, dz);
  if (dist < arriveRadius) {
    player.vx *= 0.7;
    player.vz *= 0.7;
    return;
  }
  const spd = dist < 1.5 ? maxSpeed * (dist / 1.5) : maxSpeed;
  player.vx = (dx / dist) * spd;
  player.vz = (dz / dist) * spd;
  player.facingYaw = Math.atan2(dz, dx);
}

/**
 * AI when this bot currently dribbles the ball (`ball.ownerId === bot.id`).
 */
function stepOnBallBotAI(
  state: FootballMatchState,
  bot: FootballPlayerEntity,
  difficulty: PenaltyDifficulty,
  dt: number,
  ops: FootballAiOps
): void {
  const targetGoalX = bot.team === 'blue' ? PITCH_HALF_W : -PITCH_HALF_W;
  const attackDir = bot.team === 'blue' ? 1 : -1;
  const speedBoost = difficulty === 'hard' ? 1.06 : difficulty === 'easy' ? 0.85 : 0.96;

  const distToGoal = Math.abs(targetGoalX - bot.x);
  let closestDefDist = Infinity;
  let goalLaneBlocked = false;

  for (const opp of state.players) {
    if (opp.team !== bot.team) {
      const d = Math.hypot(opp.x - bot.x, opp.z - bot.z);
      if (d < closestDefDist) closestDefDist = d;
      if (
        (opp.x - bot.x) * attackDir > 0 &&
        Math.abs(opp.x - targetGoalX) < 5.0 &&
        Math.abs(opp.z) < GOAL_3V3_HALF_Z
      ) {
        goalLaneBlocked = true;
      }
    }
  }

  // Look for an open human or bot teammate making a forward run if pressured
  const teammates = state.players.filter((p) => p.team === bot.team && p.id !== bot.id);
  const callingHuman = teammates.find((t) => !t.isBot && t.callForPassTimer > 0);
  if (callingHuman) {
    ops.executePassAction(state, bot, callingHuman.x - bot.x, callingHuman.z - bot.z, callingHuman);
    return;
  }

  if (closestDefDist < 2.5 && Math.random() < (difficulty === 'easy' ? 0.05 : 0.11)) {
    const mate = ops.findBestPassTarget(state, bot, attackDir, 0);
    if (mate && (mate.x - bot.x) * attackDir > -1.2) {
      ops.executePassAction(state, bot, mate.x - bot.x, mate.z - bot.z, mate);
      return;
    }
  }

  // Shoot at the 3.60m × 1.70m Mini-Goal when in range!
  if (distToGoal < 11.8) {
    bot.shootCharge = Math.min(100, bot.shootCharge + dt * 138);
    const desiredCharge = difficulty === 'hard' ? 66 : 52; // Crisp low-to-mid shot under 1.70m crossbar!
    if (bot.shootCharge >= desiredCharge || distToGoal < 6.8) {
      // Pick opposite corner from any sweeper standing in front of mini-goal
      const aimZ = goalLaneBlocked
        ? bot.z >= 0
          ? -0.88
          : 0.88
        : bot.z > 0.5
          ? -0.65
          : 0.65;
      ops.executeShotAction(state, bot, bot.shootCharge, attackDir, aimZ);
      return;
    }
  }

  const weaveZ = Math.sin(bot.x * 0.38 + bot.slotIndex) * 2.2;
  steerToward(bot, targetGoalX - attackDir * 3.2, weaveZ, 6.45 * speedBoost, 0.3);
}

/**
 * Steps all AI bots for one team (`blue` or `red`) using coordinated 3v3 roles:
 * - Presser/Chaser (closest to ball)
 * - Last-Man Mini-Goal Sweeper (guards 2.6m in front of own mini-goal to block shots)
 * - Wing Support / Midfield Marker
 */
function stepTeamBots(
  state: FootballMatchState,
  team: FootballTeam,
  carrier: FootballPlayerEntity | null,
  difficulty: PenaltyDifficulty,
  dt: number,
  ops: FootballAiOps
): void {
  const { ball } = state;
  const teamPlayers = state.players.filter((p) => p.team === team);
  const bots = teamPlayers.filter((p) => p.isBot);
  if (bots.length === 0) return;

  const ownGoalX = team === 'blue' ? -PITCH_HALF_W : PITCH_HALF_W;
  const attackDir = team === 'blue' ? 1 : -1;
  const speedScale = difficulty === 'hard' ? 1.05 : difficulty === 'easy' ? 0.85 : 0.96;
  const myTeamHasBall = carrier?.team === team;

  // Determine who on the entire team (humans + bots) is closest to the ball
  let closestTeamMemberToBall = teamPlayers[0];
  let bestBallDist = Infinity;
  for (const tp of teamPlayers) {
    const d = Math.hypot(tp.x - ball.x, tp.z - ball.z);
    if (d < bestBallDist) {
      bestBallDist = d;
      closestTeamMemberToBall = tp;
    }
  }

  // Check if a human teammate is already guarding deep near our own mini-goal
  const humanGuardingGoal = teamPlayers.some(
    (tp) => !tp.isBot && Math.abs(tp.x - ownGoalX) < 6.2 && Math.abs(tp.z) < 4.5
  );

  // Pick a dedicated Last-Man Sweeper bot when defending (or as safety pivot) if no human is deep
  let sweeperBotId: string | null = null;
  if (!myTeamHasBall && !humanGuardingGoal) {
    let deepestDist = Infinity;
    for (const b of bots) {
      // If there's more than 1 bot, don't pull the ball-presser away from the ball
      if (bots.length > 1 && b.id === closestTeamMemberToBall.id) continue;
      const dGoal = Math.abs(b.x - ownGoalX);
      if (dGoal < deepestDist) {
        deepestDist = dGoal;
        sweeperBotId = b.id;
      }
    }
  }

  // Also choose 1 presser bot when our team doesn't have the ball and no human is right on the ball
  let presserBotId: string | null = null;
  if (!myTeamHasBall) {
    const humanCloseToBall = teamPlayers.some(
      (tp) => !tp.isBot && Math.hypot(tp.x - ball.x, tp.z - ball.z) < 3.0
    );
    if (closestTeamMemberToBall.isBot || !humanCloseToBall) {
      let bestBotD = Infinity;
      for (const b of bots) {
        if (b.id === sweeperBotId && bots.length > 1) continue;
        const d = Math.hypot(b.x - ball.x, b.z - ball.z);
        if (d < bestBotD) {
          bestBotD = d;
          presserBotId = b.id;
        }
      }
    }
  }

  const opponents = state.players.filter((p) => p.team !== team);

  for (const bot of bots) {
    bot.stamina = Math.min(100, bot.stamina + dt * 16);

    // 1. On-Ball Dribbler AI
    if (carrier?.id === bot.id) {
      stepOnBallBotAI(state, bot, difficulty, dt, ops);
      continue;
    }

    bot.shootCharge = 0;

    // 2. Teammate (Human or Bot) Has the Ball -> Triangle Support & Counter-Safety!
    if (myTeamHasBall && carrier) {
      const isSafetyPivot = bot.slotIndex === 2 && !humanGuardingGoal;
      if (isSafetyPivot) {
        // Hold smart half-back cover behind the ball so our mini-goal isn't completely unguarded
        const pivotX = Math.max(
          -PITCH_HALF_W + 4.5,
          Math.min(PITCH_HALF_W - 4.5, carrier.x - attackDir * 6.5)
        );
        const pivotZ = Math.max(-5.5, Math.min(5.5, carrier.z * 0.45));
        steerToward(bot, pivotX, pivotZ, 6.1 * speedScale, 0.7);
      } else {
        // Make an incisive wing support run ahead for a 1-2 pass!
        const laneZ =
          bot.slotIndex === 1
            ? -6.0
            : carrier.z >= 0
              ? -4.8
              : 4.8;
        const rawTargetX = carrier.x + attackDir * 5.8;
        const clampedX = Math.max(-PITCH_HALF_W + 2.8, Math.min(PITCH_HALF_W - 2.8, rawTargetX));
        steerToward(bot, clampedX, laneZ, 6.4 * speedScale, 0.7);
      }
      continue;
    }

    // 3. Defending: Active Ball Presser / Loose-Ball Chaser
    if (bot.id === presserBotId) {
      const dToBall = Math.hypot(ball.x - bot.x, ball.z - bot.z);
      if (
        ball.ownerId &&
        dToBall < 2.4 &&
        dToBall > 0.95 &&
        difficulty !== 'easy' &&
        Math.random() < (difficulty === 'hard' ? 0.045 : 0.022)
      ) {
        ops.triggerSlideTackle(bot, ball.x - bot.x, ball.z - bot.z, ball.x, ball.z);
        continue;
      }
      steerToward(bot, ball.x, ball.z, 6.8 * speedScale, 0.18);
      continue;
    }

    // 4. Defending: Last-Man Mini-Goal Sweeper ("ตัวกวาดหน้าโกลหนู")
    if (bot.id === sweeperBotId) {
      const guardX = ownGoalX + attackDir * 2.55;
      const guardZ = Math.max(
        -GOAL_3V3_HALF_Z + 0.15,
        Math.min(GOAL_3V3_HALF_Z - 0.15, ball.z * 0.62)
      );

      // Lunge slide-block if a fast power shot is flying straight toward our mini-goal!
      const shotFlyingAtMyGoal =
        !ball.ownerId &&
        (team === 'blue' ? ball.vx < -12 && ball.x < -4 : ball.vx > 12 && ball.x > 4);
      if (shotFlyingAtMyGoal && difficulty !== 'easy' && bot.slideTimer <= 0) {
        const tGoal = Math.abs((guardX - ball.x) / Math.max(0.1, Math.abs(ball.vx)));
        if (tGoal > 0 && tGoal < 0.45) {
          const predZ = ball.z + ball.vz * tGoal;
          const zDiff = predZ - bot.z;
          if (Math.abs(predZ) <= GOAL_3V3_HALF_Z + 0.4 && Math.abs(zDiff) > 0.55 && Math.abs(zDiff) < 2.2) {
            ops.triggerSlideTackle(bot, 0, zDiff, guardX, predZ);
            continue;
          }
        }
      }

      steerToward(bot, guardX, guardZ, 6.35 * speedScale, 0.22);
      bot.facingYaw = team === 'blue' ? 0 : Math.PI;
      continue;
    }

    // 5. Defending: Midfield Man-Marker
    const assignedOpp =
      opponents.find((o) => o.id !== carrier?.id) ||
      opponents[bot.slotIndex % Math.max(1, opponents.length)];
    if (assignedOpp) {
      const markX = assignedOpp.x * 0.62 + ownGoalX * 0.38;
      const markZ = Math.max(-PITCH_HALF_D + 1.5, Math.min(PITCH_HALF_D - 1.5, assignedOpp.z * 0.82));
      steerToward(bot, markX, markZ, 6.2 * speedScale, 0.65);
    } else {
      const home = ops.getHomeFormationCoords(bot.team, bot.slotIndex, false);
      steerToward(bot, home.x * 0.6 + ball.x * 0.4, home.z * 0.6 + ball.z * 0.4, 6.1 * speedScale, 0.6);
    }
  }
}

/**
 * Master AI Stepper invoked every physics frame by `stepFootballMatch(...)`.
 * Steps ONLY slots marked `p.isBot === true` so all 1..6 human players retain 100% control!
 */
export function stepAllFootballAI(
  state: FootballMatchState,
  dt: number,
  ops: FootballAiOps,
  difficulty: PenaltyDifficulty = 'normal'
): void {
  const carrier = state.ball.ownerId
    ? state.players.find((p) => p.id === state.ball.ownerId) || null
    : null;

  stepTeamBots(state, 'blue', carrier, difficulty, dt, ops);
  stepTeamBots(state, 'red', carrier, difficulty, dt, ops);
}
