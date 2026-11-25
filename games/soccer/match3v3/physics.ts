// games/soccer/match3v3/physics.ts
// 60FPS Host-Authoritative 3D Street Mini-Goal 3v3 ("โกลหนู 3v3") Physics & Match Engine
// - True 3v3 (6 players total: B1, B2, B3 vs R1, R2, R3 — ZERO dedicated Goalkeepers!)
// - Compact Street Mini-Goals ("โกลหนู" 3.60m wide × 1.70m high) + Outfield Body & Slide Shot-Blocks
// - Party Multiplayer up to 6 Real Humans: 1 Human = 1 Fixed Character (No Player Switching!)
// - Pass Button passes to aimed teammate when on-ball, or triggers "Call for Pass" from AI teammate when off-ball!

export type FootballTeam = 'blue' | 'red';
export type FootballSlotId = 'B1' | 'B2' | 'B3' | 'R1' | 'R2' | 'R3';
export type FootballMatchPhase =
  | 'kickoff'
  | 'playing'
  | 'goal_celebration'
  | 'tie_to_penalty'
  | 'finished';

export const BLUE_SLOTS: readonly FootballSlotId[] = ['B1', 'B2', 'B3'] as const;
export const RED_SLOTS: readonly FootballSlotId[] = ['R1', 'R2', 'R3'] as const;
export const ALL_FOOTBALL_SLOTS: readonly FootballSlotId[] = [
  'B1',
  'B2',
  'B3',
  'R1',
  'R2',
  'R3',
] as const;

export const PITCH_HALF_W = 19.0; // Total length X = 38m (Blue defends -19, attacks +19)
export const PITCH_HALF_D = 12.0; // Total width Z = 24m (-12..+12)
export const GOAL_3V3_HALF_Z = 1.8; // 3.60m wide Street Mini-Goal ("โกลหนู")
export const GOAL_3V3_HEIGHT = 1.7; // 1.70m high Street Mini-Goal ("โกลหนู")
export const GOAL_3V3_DEPTH = 1.45;
export const PENALTY_BOX_DEPTH_X = 4.5; // Compact mini-goal crease box
export const PENALTY_BOX_HALF_Z = 3.9;
export const BALL_RADIUS = 0.28;
export const MATCH_DURATION_SEC = 180; // 3 minutes per match!

export function getSlotTeam(slotId: FootballSlotId): FootballTeam {
  return slotId.startsWith('B') ? 'blue' : 'red';
}

export function getSlotIndex(slotId: FootballSlotId): 0 | 1 | 2 {
  const num = Number(slotId[1]);
  if (num === 2) return 1;
  if (num === 3) return 2;
  return 0;
}

export interface TeamControlInput {
  /** -1 (left / -X) .. +1 (right / +X) */
  moveX: number;
  /** -1 (up / -Z) .. +1 (down / +Z) */
  moveZ: number;
  /** Incremented each time Pass / Call-for-Pass button is pressed */
  passSeq: number;
  /** True while player is holding down Shoot button to charge power */
  shootCharging: boolean;
  /** Incremented on Shoot release */
  shootSeq: number;
  /** Sprint (on offense / chase) or Slide Tackle (on press while defending) */
  sprint: boolean;
  /** Incremented on fresh press of Sprint/Tackle button to trigger defensive Slide Tackle */
  tackleSeq: number;
}

export const EMPTY_TEAM_INPUT: TeamControlInput = {
  moveX: 0,
  moveZ: 0,
  passSeq: 0,
  shootCharging: false,
  shootSeq: 0,
  sprint: false,
  tackleSeq: 0,
};

export interface FootballSlotInitConfig {
  name: string;
  modelId: string;
  isBot: boolean;
}

export interface FootballPlayerEntity {
  id: FootballSlotId;
  slotId: FootballSlotId;
  team: FootballTeam;
  slotIndex: 0 | 1 | 2; // 0 = Center Pivot/Captain, 1 = Left/Top Wing, 2 = Right/Bottom Sweeper-Wing
  isCaptain: boolean;
  isBot: boolean;
  name: string;
  modelId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  /** Yaw angle in world XZ plane: 0 = +X, Math.PI = -X, -Math.PI/2 = -Z, +Math.PI/2 = +Z */
  facingYaw: number;
  /** 0..100 Stamina bar */
  stamina: number;
  /** 0..100 Current Shot Power Charge while holding Shoot */
  shootCharge: number;
  /** Remaining slide-tackle lunge timer (seconds) */
  slideTimer: number;
  slideDirX: number;
  slideDirZ: number;
  /** Brief cooldown after kicking/blocking/being tackled so ball doesn't re-stick on same frame */
  touchCooldown: number;
  stunTimer: number;
  /** Brief indicator timer when human calls for a pass */
  callForPassTimer: number;
  /** Per-slot input edge trackers */
  lastPassSeq: number;
  lastShootSeq: number;
  lastTackleSeq: number;
  wasCharging: boolean;
}

export interface FootballBallState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Slot ID currently dribbling the ball, or null when ball is in flight / loose */
  ownerId: FootballSlotId | null;
  lastTouchTeam: FootballTeam | null;
  lastTouchSlotId: FootballSlotId | null;
  isPowerShot: boolean;
}

export interface FootballFrameEvents {
  kick?: boolean;
  pass?: boolean;
  tackle?: boolean;
  save?: boolean; // Triggered on heroic outfield body-block / slide-block!
  post?: boolean;
  goalTeam?: FootballTeam;
  scorerSlotId?: FootballSlotId;
  whistle?: boolean;
}

export interface FootballMatchState {
  phase: FootballMatchPhase;
  phaseTimer: number;
  timeRemaining: number;
  scoreBlue: number;
  scoreRed: number;
  kickoffTeam: FootballTeam;
  players: FootballPlayerEntity[];
  ball: FootballBallState;
  winner: FootballTeam | null;
  lastScoredTeam: FootballTeam | null;
  goalsBySlot: Record<FootballSlotId, number>;
  events: FootballFrameEvents;
}

export function getHomeFormationCoords(
  team: FootballTeam,
  slotIndex: 0 | 1 | 2,
  isKickoffTeam: boolean
): { x: number; z: number; yaw: number } {
  const sign = team === 'blue' ? -1 : 1; // Blue on left (-X), Red on right (+X)
  const yaw = team === 'blue' ? 0 : Math.PI;

  if (slotIndex === 0) {
    // B1 / R1: Center Striker / Captain
    return { x: sign * (isKickoffTeam ? 1.5 : 4.4), z: 0, yaw };
  }
  if (slotIndex === 1) {
    // B2 / R2: Upper / Left Wing
    return { x: sign * 7.6, z: -5.0, yaw };
  }
  // B3 / R3: Lower / Right Deeper Sweeper-Wing (triangle balance in front of mini-goal!)
  return { x: sign * 9.8, z: 4.4, yaw };
}

export function createInitialFootballMatchState(opts: {
  slots?: Partial<Record<FootballSlotId, FootballSlotInitConfig>>;
  blueCaptainName?: string;
  blueModelId?: string;
  redCaptainName?: string;
  redModelId?: string;
  redCaptainIsBot?: boolean;
  durationSec?: number;
}): FootballMatchState {
  const defaultBlueModel = opts.blueModelId || 'fox_hero';
  const defaultRedModel = opts.redModelId || 'husky_hero';
  const defaultNames: Record<FootballSlotId, string> = {
    B1: opts.blueCaptainName || 'กัปตันฟ้า',
    B2: 'AI ปีกฟ้า #2',
    B3: 'AI กองหลังฟ้า #3',
    R1: opts.redCaptainName || 'AI กัปตันแดง',
    R2: 'AI ปีกแดง #2',
    R3: 'AI กองหลังแดง #3',
  };

  const players: FootballPlayerEntity[] = ALL_FOOTBALL_SLOTS.map((slotId) => {
    const team = getSlotTeam(slotId);
    const slotIndex = getSlotIndex(slotId);
    const custom = opts.slots?.[slotId];
    const defaultIsBot =
      slotId === 'B1'
        ? false
        : slotId === 'R1'
          ? (opts.redCaptainIsBot ?? true)
          : true;
    const home = getHomeFormationCoords(team, slotIndex, team === 'blue');

    return {
      id: slotId,
      slotId,
      team,
      slotIndex,
      isCaptain: slotIndex === 0,
      isBot: custom ? custom.isBot : defaultIsBot,
      name: custom?.name || defaultNames[slotId],
      modelId: custom?.modelId || (team === 'blue' ? defaultBlueModel : defaultRedModel),
      x: home.x,
      y: 0,
      z: home.z,
      vx: 0,
      vz: 0,
      facingYaw: home.yaw,
      stamina: 100,
      shootCharge: 0,
      slideTimer: 0,
      slideDirX: 0,
      slideDirZ: 0,
      touchCooldown: 0,
      stunTimer: 0,
      callForPassTimer: 0,
      lastPassSeq: 0,
      lastShootSeq: 0,
      lastTackleSeq: 0,
      wasCharging: false,
    };
  });

  return {
    phase: 'playing',
    phaseTimer: 0,
    timeRemaining: opts.durationSec ?? MATCH_DURATION_SEC,
    scoreBlue: 0,
    scoreRed: 0,
    kickoffTeam: 'blue',
    players,
    ball: {
      x: 0,
      y: BALL_RADIUS,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      ownerId: null,
      lastTouchTeam: null,
      lastTouchSlotId: null,
      isPowerShot: false,
    },
    winner: null,
    lastScoredTeam: null,
    goalsBySlot: { B1: 0, B2: 0, B3: 0, R1: 0, R2: 0, R3: 0 },
    events: { whistle: true },
  };
}

export function setFootballSlotBotMode(
  state: FootballMatchState,
  slotId: FootballSlotId,
  isBot: boolean,
  newName?: string
): void {
  const target = state.players.find((p) => p.slotId === slotId);
  if (!target) return;
  target.isBot = isBot;
  target.shootCharge = 0;
  target.wasCharging = false;
  if (newName) target.name = newName;
}

export function resetFootballKickoff(
  state: FootballMatchState,
  kickoffTeam: FootballTeam
): void {
  state.kickoffTeam = kickoffTeam;
  state.ball.x = 0;
  state.ball.y = BALL_RADIUS;
  state.ball.z = 0;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.vz = 0;
  state.ball.ownerId = null;
  state.ball.isPowerShot = false;

  for (const p of state.players) {
    const home = getHomeFormationCoords(p.team, p.slotIndex, p.team === kickoffTeam);
    p.x = home.x;
    p.y = 0;
    p.z = home.z;
    p.vx = 0;
    p.vz = 0;
    p.facingYaw = home.yaw;
    p.shootCharge = 0;
    p.wasCharging = false;
    p.slideTimer = 0;
    p.touchCooldown = 0;
    p.stunTimer = 0;
    p.callForPassTimer = 0;
    p.stamina = Math.min(100, p.stamina + 35);
  }

  state.events.whistle = true;
}

export function findNearestPlayerToBall(
  state: FootballMatchState,
  team: FootballTeam,
  excludeId?: FootballSlotId
): FootballPlayerEntity {
  const candidates = state.players.filter((p) => p.team === team && p.id !== excludeId);
  let best = candidates[0] || state.players.find((p) => p.team === team)!;
  let bestDistSq = Infinity;
  for (const c of candidates) {
    const dx = c.x - state.ball.x;
    const dz = c.z - state.ball.z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      best = c;
    }
  }
  return best;
}

/**
 * Finds the best teammate most aligned with the passer's aim/facing direction (Pass Assist).
 */
export function findBestPassTarget(
  state: FootballMatchState,
  passer: FootballPlayerEntity,
  aimX: number,
  aimZ: number
): FootballPlayerEntity | null {
  const teammates = state.players.filter((p) => p.team === passer.team && p.id !== passer.id);
  if (teammates.length === 0) return null;

  const dirLen = Math.hypot(aimX, aimZ);
  const fx = dirLen > 0.15 ? aimX / dirLen : Math.cos(passer.facingYaw);
  const fz = dirLen > 0.15 ? aimZ / dirLen : Math.sin(passer.facingYaw);

  let best: FootballPlayerEntity | null = null;
  let bestScore = -Infinity;

  for (const tm of teammates) {
    const dx = tm.x - passer.x;
    const dz = tm.z - passer.z;
    const dist = Math.max(0.5, Math.hypot(dx, dz));
    const dot = (dx / dist) * fx + (dz / dist) * fz; // -1..+1 alignment with facing direction
    const score = dot * 2.4 - dist * 0.035;
    if (score > bestScore) {
      bestScore = score;
      best = tm;
    }
  }
  return best;
}

/**
 * Passes the ball to the best-aligned teammate (or `explicitReceiver` for AI Call-for-Pass).
 * NEVER switches which character any human controls — each human stays on their own slot!
 */
export function executePassAction(
  state: FootballMatchState,
  passer: FootballPlayerEntity,
  aimX: number,
  aimZ: number,
  explicitReceiver?: FootballPlayerEntity
): FootballPlayerEntity | null {
  const target =
    explicitReceiver && explicitReceiver.team === passer.team && explicitReceiver.id !== passer.id
      ? explicitReceiver
      : findBestPassTarget(state, passer, aimX, aimZ);
  if (!target) return null;

  // Lead pass slightly ahead of running teammate
  const leadX = target.x + target.vx * 0.22;
  const leadZ = target.z + target.vz * 0.22;
  const dx = leadX - state.ball.x;
  const dz = leadZ - state.ball.z;
  const dist = Math.max(0.5, Math.hypot(dx, dz));
  const passSpeed = Math.min(20.5, Math.max(12.2, 9.5 + dist * 0.56));

  state.ball.ownerId = null;
  state.ball.vx = (dx / dist) * passSpeed;
  state.ball.vz = (dz / dist) * passSpeed;
  state.ball.vy = dist > 12 ? 1.85 : 0.75;
  state.ball.isPowerShot = false;
  state.ball.lastTouchTeam = passer.team;
  state.ball.lastTouchSlotId = passer.slotId;
  passer.touchCooldown = 0.28;
  passer.shootCharge = 0;
  passer.facingYaw = Math.atan2(dz, dx);
  state.events.pass = true;

  return target;
}

/**
 * Executes a shot aimed at the opponent's 3.60m × 1.70m Street Mini-Goal ("โกลหนู").
 * Normal/green charge stays lethal & low under the 1.70m crossbar; overcharging >90% risks skimming high!
 */
export function executeShotAction(
  state: FootballMatchState,
  shooter: FootballPlayerEntity,
  chargePct: number,
  aimX: number,
  aimZ: number
): void {
  const clampedCharge = Math.max(8, Math.min(100, chargePct));
  const targetGoalX = shooter.team === 'blue' ? PITCH_HALF_W : -PITCH_HALF_W;

  // Steer shot toward left/right corner of the 3.60m mini-goal using vertical input (aimZ)
  let targetZ = 0;
  const maxCornerZ = GOAL_3V3_HALF_Z - 0.28; // ±1.52m inside ±1.80m posts
  if (Math.abs(aimZ) > 0.15) {
    targetZ = Math.max(-maxCornerZ, Math.min(maxCornerZ, aimZ * 1.62));
  } else {
    targetZ = Math.max(-1.15, Math.min(1.15, shooter.z * 0.2));
  }

  const dx = targetGoalX - state.ball.x;
  const dz = targetZ - state.ball.z;
  const dist = Math.max(1.0, Math.hypot(dx, dz));

  const ratio = clampedCharge / 100;
  const shotSpeed = 15.2 + ratio * 14.2; // 15.2 -> 29.4 m/s
  const shotLoft = 0.55 + Math.pow(ratio, 2.2) * 6.35; // Tuned for 1.70m mini-goal height!

  state.ball.ownerId = null;
  state.ball.vx = (dx / dist) * shotSpeed;
  state.ball.vz = (dz / dist) * shotSpeed;
  state.ball.vy = shotLoft;
  state.ball.isPowerShot = clampedCharge >= 52;
  state.ball.lastTouchTeam = shooter.team;
  state.ball.lastTouchSlotId = shooter.slotId;

  shooter.touchCooldown = 0.34;
  shooter.shootCharge = 0;
  shooter.facingYaw = Math.atan2(dz, dx);
  state.events.kick = true;

  if (Math.abs(aimX) > 0.9 && Math.sign(aimX) !== Math.sign(dx)) {
    shooter.vx *= 0.5;
  }
}

export function triggerSlideTackle(
  player: FootballPlayerEntity,
  moveX: number,
  moveZ: number,
  ballX: number,
  ballZ: number
): void {
  if (player.slideTimer > 0 || player.stunTimer > 0 || player.stamina < 12) return;
  const mLen = Math.hypot(moveX, moveZ);
  let dirX: number;
  let dirZ: number;
  if (mLen > 0.15) {
    dirX = moveX / mLen;
    dirZ = moveZ / mLen;
  } else {
    const bx = ballX - player.x;
    const bz = ballZ - player.z;
    const bLen = Math.max(0.01, Math.hypot(bx, bz));
    dirX = bx / bLen;
    dirZ = bz / bLen;
  }
  player.slideTimer = 0.36;
  player.slideDirX = dirX;
  player.slideDirZ = dirZ;
  player.facingYaw = Math.atan2(dirZ, dirX);
  player.stamina = Math.max(0, player.stamina - 16);
}

/**
 * Steps a single human-controlled slot (`B1..B3` or `R1..R3`) for 1 physics tick (`dt` sec).
 * Up to 6 humans can run simultaneously on the pitch — each locked to their own character!
 */
function stepHumanControlledPlayer(
  state: FootballMatchState,
  player: FootballPlayerEntity,
  inp: TeamControlInput,
  dt: number
): void {
  const passPressed = inp.passSeq !== player.lastPassSeq;
  const shootReleasedEdge =
    inp.shootSeq !== player.lastShootSeq || (player.wasCharging && !inp.shootCharging);
  const tacklePressed = inp.tackleSeq !== player.lastTackleSeq;

  player.lastPassSeq = inp.passSeq;
  player.lastShootSeq = inp.shootSeq;
  player.lastTackleSeq = inp.tackleSeq;
  player.wasCharging = inp.shootCharging;

  const owner = state.ball.ownerId
    ? state.players.find((p) => p.id === state.ball.ownerId) || null
    : null;
  const myTeamHasBall = owner?.team === player.team;
  const iOwnBall = owner?.id === player.id;
  const distToBall = Math.hypot(state.ball.x - player.x, state.ball.z - player.z);
  const canKickLooseBall = !owner && distToBall < 1.42 && state.ball.y <= 1.45;

  // 1. Pass to Teammate (when on-ball) OR Call for Pass from AI Teammate (when off-ball)!
  if (passPressed) {
    if (iOwnBall || canKickLooseBall) {
      executePassAction(state, player, inp.moveX, inp.moveZ);
      return;
    } else if (myTeamHasBall && owner && owner.id !== player.id) {
      player.callForPassTimer = 0.75;
      if (owner.isBot && owner.stunTimer <= 0) {
        // AI Bot teammate immediately passes the ball straight to the calling human!
        executePassAction(state, owner, player.x - owner.x, player.z - owner.z, player);
      }
    }
  }

  // 2. Hold-to-Charge Shoot Power Gauge & Release Shot!
  if (inp.shootCharging && (iOwnBall || myTeamHasBall || distToBall < 2.6)) {
    player.shootCharge = Math.min(100, player.shootCharge + dt * 118);
  }
  if (shootReleasedEdge && player.shootCharge > 2) {
    if (iOwnBall || canKickLooseBall) {
      executeShotAction(state, player, player.shootCharge, inp.moveX, inp.moveZ);
    } else {
      player.shootCharge = 0;
    }
  } else if (!inp.shootCharging && player.shootCharge > 0) {
    player.shootCharge = Math.max(0, player.shootCharge - dt * 220);
  }

  // 3. Defensive Slide Tackle / Shot-Block Lunge when pressing Sprint/Tackle without possession!
  if (tacklePressed && !myTeamHasBall && !iOwnBall && distToBall < 6.2) {
    triggerSlideTackle(player, inp.moveX, inp.moveZ, state.ball.x, state.ball.z);
  }

  // 4. Locomotion (Stun / Slide Lunge / Normal Run / Stamina Sprint)
  if (player.stunTimer > 0) {
    player.vx *= 0.82;
    player.vz *= 0.82;
    return;
  }

  if (player.slideTimer > 0) {
    const lungeSpeed = 12.6;
    player.vx = player.slideDirX * lungeSpeed;
    player.vz = player.slideDirZ * lungeSpeed;
    return;
  }

  const moveLen = Math.hypot(inp.moveX, inp.moveZ);
  if (moveLen > 0.08) {
    const nx = inp.moveX / Math.max(1, moveLen);
    const nz = inp.moveZ / Math.max(1, moveLen);
    const canSprint = inp.sprint && player.stamina > 6;
    const baseSpeed = iOwnBall ? 6.65 : 7.05;
    const speed = canSprint ? baseSpeed * 1.38 : baseSpeed;

    player.vx = nx * speed;
    player.vz = nz * speed;
    player.facingYaw = Math.atan2(nz, nx);

    if (canSprint) {
      player.stamina = Math.max(0, player.stamina - dt * 26);
    } else {
      player.stamina = Math.min(100, player.stamina + dt * 14);
    }
  } else {
    player.vx *= 0.72;
    player.vz *= 0.72;
    player.stamina = Math.min(100, player.stamina + dt * 20);
  }
}

export interface FootballAiOps {
  executePassAction: typeof executePassAction;
  executeShotAction: typeof executeShotAction;
  findBestPassTarget: typeof findBestPassTarget;
  getHomeFormationCoords: typeof getHomeFormationCoords;
  triggerSlideTackle: typeof triggerSlideTackle;
}

export const FOOTBALL_AI_OPS: FootballAiOps = {
  executePassAction,
  executeShotAction,
  findBestPassTarget,
  getHomeFormationCoords,
  triggerSlideTackle,
};

/**
 * Advances the entire 6-player Street Mini-Goal 3v3 simulation by `dt` seconds (60 FPS on Host / Practice).
 */
export function stepFootballMatch(
  state: FootballMatchState,
  humanSlotInputs: Partial<Record<FootballSlotId, TeamControlInput>>,
  dt: number,
  aiStepCallback?: (state: FootballMatchState, dt: number, ops: FootballAiOps) => void
): void {
  state.events = {};
  if (state.phase === 'finished' || state.phase === 'tie_to_penalty') return;

  // Handle Goal Celebration freeze & center kickoff reset
  if (state.phase === 'goal_celebration') {
    state.phaseTimer -= dt;
    state.ball.x += state.ball.vx * dt * 0.35;
    state.ball.z += state.ball.vz * dt * 0.35;
    state.ball.vx *= 0.9;
    state.ball.vz *= 0.9;
    state.ball.y = Math.max(BALL_RADIUS, state.ball.y - dt * 4);
    if (state.phaseTimer <= 0) {
      const nextKickoff: FootballTeam = state.lastScoredTeam === 'blue' ? 'red' : 'blue';
      resetFootballKickoff(state, nextKickoff);
      state.phase = 'playing';
    }
    return;
  }

  // Countdown 3-minute match clock!
  state.timeRemaining = Math.max(0, state.timeRemaining - dt);
  if (state.timeRemaining <= 0) {
    if (state.scoreBlue === state.scoreRed) {
      state.phase = 'tie_to_penalty';
      state.events.whistle = true;
    } else {
      state.phase = 'finished';
      state.winner = state.scoreBlue > state.scoreRed ? 'blue' : 'red';
      state.events.whistle = true;
    }
    return;
  }

  // Decrement per-player timers
  for (const p of state.players) {
    if (p.touchCooldown > 0) p.touchCooldown = Math.max(0, p.touchCooldown - dt);
    if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);
    if (p.slideTimer > 0) p.slideTimer = Math.max(0, p.slideTimer - dt);
    if (p.callForPassTimer > 0) p.callForPassTimer = Math.max(0, p.callForPassTimer - dt);
  }

  // 1. Step every Human-Controlled Slot independently (`!p.isBot`)
  for (const p of state.players) {
    if (!p.isBot) {
      const inp = humanSlotInputs[p.slotId] || EMPTY_TEAM_INPUT;
      stepHumanControlledPlayer(state, p, inp, dt);
    }
  }

  // 2. Step AI Bots (`p.isBot === true`)
  aiStepCallback?.(state, dt, FOOTBALL_AI_OPS);

  // 3. Integrate Player Positions & Pitch Clamping
  for (const p of state.players) {
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.x = Math.max(-PITCH_HALF_W + 0.55, Math.min(PITCH_HALF_W - 0.55, p.x));
    p.z = Math.max(-PITCH_HALF_D + 0.55, Math.min(PITCH_HALF_D - 0.55, p.z));
  }

  // Soft body separation + Slide Tackle Dispossession Check!
  for (let i = 0; i < state.players.length; i++) {
    for (let j = i + 1; j < state.players.length; j++) {
      const a = state.players[i];
      const b = state.players[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const dist = Math.hypot(dx, dz);

      if (a.team !== b.team && dist < 1.34) {
        if (a.slideTimer > 0.05 && state.ball.ownerId === b.id) {
          state.ball.ownerId = a.id;
          state.ball.lastTouchTeam = a.team;
          state.ball.lastTouchSlotId = a.slotId;
          b.stunTimer = 0.52;
          b.touchCooldown = 0.55;
          b.shootCharge = 0;
          state.events.tackle = true;
        } else if (b.slideTimer > 0.05 && state.ball.ownerId === a.id) {
          state.ball.ownerId = b.id;
          state.ball.lastTouchTeam = b.team;
          state.ball.lastTouchSlotId = b.slotId;
          a.stunTimer = 0.52;
          a.touchCooldown = 0.55;
          a.shootCharge = 0;
          state.events.tackle = true;
        }
      }

      const minSep = 0.78;
      if (dist > 0.001 && dist < minSep) {
        const push = (minSep - dist) * 0.5;
        const nx = dx / dist;
        const nz = dz / dist;
        a.x -= nx * push;
        a.z -= nz * push;
        b.x += nx * push;
        b.z += nz * push;
      }
    }
  }

  // 4. Ball Dribbling Attachment vs Free-Flight Physics + Outfield Shot-Block!
  const ball = state.ball;
  const activeCarrier = ball.ownerId
    ? state.players.find((p) => p.id === ball.ownerId) || null
    : null;

  if (activeCarrier) {
    const offsetDist = 0.66;
    ball.x = activeCarrier.x + Math.cos(activeCarrier.facingYaw) * offsetDist;
    ball.z = activeCarrier.z + Math.sin(activeCarrier.facingYaw) * offsetDist;
    ball.y = BALL_RADIUS;
    ball.vx = activeCarrier.vx;
    ball.vz = activeCarrier.vz;
    ball.vy = 0;
    ball.isPowerShot = false;

    // Close-range standing challenge steal if an opponent steps right onto the ball!
    for (const opp of state.players) {
      if (opp.team !== activeCarrier.team && opp.touchCooldown <= 0 && opp.stunTimer <= 0) {
        const dBall = Math.hypot(opp.x - ball.x, opp.z - ball.z);
        if (dBall < 0.72) {
          ball.ownerId = opp.id;
          ball.lastTouchTeam = opp.team;
          ball.lastTouchSlotId = opp.slotId;
          activeCarrier.touchCooldown = 0.45;
          activeCarrier.shootCharge = 0;
          state.events.tackle = true;
          break;
        }
      }
    }
  } else {
    // Free-flight 3D ball physics with gravity, turf friction, & air drag
    const prevBx = ball.x;
    const prevBz = ball.z;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.z += ball.vz * dt;

    if (ball.y > BALL_RADIUS) {
      ball.vy -= 18.5 * dt; // Gravity
      ball.vx *= Math.pow(0.985, dt * 60);
      ball.vz *= Math.pow(0.985, dt * 60);
    } else {
      ball.y = BALL_RADIUS;
      if (ball.vy < -2.2) {
        ball.vy = -ball.vy * 0.48; // Turf bounce
      } else {
        ball.vy = 0;
      }
      ball.vx *= Math.pow(0.962, dt * 60);
      ball.vz *= Math.pow(0.962, dt * 60);
      if (Math.hypot(ball.vx, ball.vz) < 7.5) {
        ball.isPowerShot = false;
      }
    }

    // Outfield Body-Block / Slide-Block against Shots (anti-tunnel swept segment check!) & Loose-Ball Control
    const ballSpd = Math.hypot(ball.vx, ball.vz);
    const segDx = ball.x - prevBx;
    const segDz = ball.z - prevBz;
    const segLenSq = segDx * segDx + segDz * segDz;

    for (const p of state.players) {
      if (p.touchCooldown > 0 || p.stunTimer > 0) continue;
      let closestT = 1;
      if (segLenSq > 0.0001) {
        closestT = Math.max(
          0,
          Math.min(1, ((p.x - prevBx) * segDx + (p.z - prevBz) * segDz) / segLenSq)
        );
      }
      const nearX = prevBx + segDx * closestT;
      const nearZ = prevBz + segDz * closestT;
      const d = Math.hypot(p.x - nearX, p.z - nearZ);

      if (ball.lastTouchTeam && p.team !== ball.lastTouchTeam) {
        // Opponent standing body-block (1.04m) or sliding shot-block (1.48m)!
        const blockReach = p.slideTimer > 0 ? 1.48 : 1.04;
        const blockHeight = p.slideTimer > 0 ? 1.35 : GOAL_3V3_HEIGHT;
        if (d < blockReach && ball.y <= blockHeight) {
          if (ballSpd >= 13.5) {
            // Heroic outfield shot block! Deflect away from defender's goal
            const clearDirX = p.team === 'blue' ? 1 : -1;
            const sideSign = p.z - nearZ >= 0 ? -1 : 1;
            ball.x = nearX;
            ball.z = nearZ;
            ball.ownerId = null;
            ball.vx = clearDirX * Math.max(8.5, ballSpd * 0.46) + p.vx * 0.35;
            ball.vz = sideSign * 4.4 + p.vz * 0.35;
            ball.vy = Math.min(2.4, Math.max(0.75, ball.vy * 0.45));
            ball.isPowerShot = false;
            ball.lastTouchTeam = p.team;
            ball.lastTouchSlotId = p.slotId;
            p.touchCooldown = 0.35;
            state.events.save = true;
            break;
          } else {
            // Clean pass interception / loose-ball pickup
            ball.ownerId = p.id;
            ball.lastTouchTeam = p.team;
            ball.lastTouchSlotId = p.slotId;
            ball.isPowerShot = false;
            break;
          }
        }
      } else if (d < 1.06 && ball.y <= 1.32) {
        // Teammate receiving pass or player picking up neutral ball
        ball.ownerId = p.id;
        ball.lastTouchTeam = p.team;
        ball.lastTouchSlotId = p.slotId;
        ball.isPowerShot = false;
        break;
      }
    }

    // Touchlines Z (-12..+12): crisp street-court cushion keep-in!
    if (ball.z < -PITCH_HALF_D + BALL_RADIUS) {
      ball.z = -PITCH_HALF_D + BALL_RADIUS;
      ball.vz = Math.abs(ball.vz) * 0.72;
    } else if (ball.z > PITCH_HALF_D - BALL_RADIUS) {
      ball.z = PITCH_HALF_D - BALL_RADIUS;
      ball.vz = -Math.abs(ball.vz) * 0.72;
    }

    // Mini-Goal ("โกลหนู" 3.60m × 1.70m) Detection & Post/Crossbar Collisions at x = ±19!
    if (Math.abs(ball.x) >= PITCH_HALF_W - BALL_RADIUS) {
      const inGoalMouthZ = Math.abs(ball.z) < GOAL_3V3_HALF_Z - BALL_RADIUS * 0.45;
      const underCrossbar = ball.y < GOAL_3V3_HEIGHT - BALL_RADIUS * 0.35;
      const hitPostOrBar =
        Math.abs(ball.z) < GOAL_3V3_HALF_Z + 0.24 &&
        ball.y <= GOAL_3V3_HEIGHT + 0.24 &&
        !(inGoalMouthZ && underCrossbar);

      if (inGoalMouthZ && underCrossbar) {
        const scoringTeam: FootballTeam = ball.x > 0 ? 'blue' : 'red';
        if (scoringTeam === 'blue') state.scoreBlue += 1;
        else state.scoreRed += 1;

        const scorerSlot =
          ball.lastTouchTeam === scoringTeam && ball.lastTouchSlotId
            ? ball.lastTouchSlotId
            : scoringTeam === 'blue'
              ? 'B1'
              : 'R1';
        state.goalsBySlot[scorerSlot] = (state.goalsBySlot[scorerSlot] || 0) + 1;

        state.lastScoredTeam = scoringTeam;
        state.phase = 'goal_celebration';
        state.phaseTimer = 2.25;
        state.ball.ownerId = null;
        state.events.goalTeam = scoringTeam;
        state.events.scorerSlotId = scorerSlot;
        return;
      } else if (hitPostOrBar) {
        ball.x = Math.sign(ball.x) * (PITCH_HALF_W - BALL_RADIUS - 0.05);
        ball.vx = -ball.vx * 0.68;
        ball.vy = Math.max(1.3, ball.vy * 0.5);
        ball.isPowerShot = false;
        state.events.post = true;
      } else {
        ball.x = Math.sign(ball.x) * (PITCH_HALF_W - BALL_RADIUS);
        ball.vx = -ball.vx * 0.62;
        ball.vy *= 0.65;
        ball.isPowerShot = false;
      }
    }
  }
}
