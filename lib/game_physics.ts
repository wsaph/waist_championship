// lib/game_physics.ts
// 2D Pikachu Volleyball Physics Engine (1100 x 600 logical court, 1v1 & 2v2, Win-by-2 to 15, NO 3-touch limit!)

export type GameMode = '1v1' | '2v2';
export type TeamSide = 'blue' | 'red';
export type PlayerSlot = 'P1' | 'P2' | 'P3' | 'P4';
export type AiDifficulty = 'easy' | 'normal' | 'hard';
export type MatchPhase = 'serve_wait' | 'playing' | 'point_pause' | 'finished';

export type ChibiSkinId =
  | 'pikamouse'
  | 'bunny'
  | 'shiba'
  | 'kitty'
  | 'panda'
  | 'frog'
  | 'fox'
  | 'capy';

export interface ChibiSkinOption {
  id: ChibiSkinId;
  name: string;
  emoji: string;
  defaultColor: string;
  cheekColor: string;
}

export const CHIBI_SKINS: ChibiSkinOption[] = [
  { id: 'pikamouse', name: 'หนูสายฟ้า', emoji: '⚡', defaultColor: '#FACC15', cheekColor: '#EF4444' },
  { id: 'bunny', name: 'กระต่ายเด้ง', emoji: '🐰', defaultColor: '#F8FAFC', cheekColor: '#FB7185' },
  { id: 'shiba', name: 'ชิบะจัง', emoji: '🐶', defaultColor: '#FB923C', cheekColor: '#FDBA74' },
  { id: 'kitty', name: 'เหมียวซ่า', emoji: '🐱', defaultColor: '#F472B6', cheekColor: '#FDA4AF' },
  { id: 'panda', name: 'แพนด้ากลม', emoji: '🐼', defaultColor: '#E2E8F0', cheekColor: '#F43F5E' },
  { id: 'frog', name: 'กบเขียวซิ่ง', emoji: '🐸', defaultColor: '#4ADE80', cheekColor: '#FB7185' },
  { id: 'fox', name: 'จิ้งจอกส้ม', emoji: '🦊', defaultColor: '#F97316', cheekColor: '#FDE047' },
  { id: 'capy', name: 'คาปิบาร่าชิล', emoji: '🐹', defaultColor: '#D97706', cheekColor: '#FBBF24' },
];

export const SKIN_COLOR_PALETTE = [
  '#FACC15',
  '#38BDF8',
  '#4ADE80',
  '#F472B6',
  '#FB923C',
  '#C084FC',
  '#F8FAFC',
  '#2DD4BF',
];

export const COURT_WIDTH = 1100;
export const COURT_HEIGHT = 600;
export const GROUND_Y = 522;
export const NET_X = COURT_WIDTH / 2; // 550
export const NET_HEIGHT = 208;
export const NET_TOP_Y = GROUND_Y - NET_HEIGHT; // 314
export const NET_HALF_WIDTH = 9;
export const BALL_RADIUS = 31;
export const PLAYER_RADIUS = 38;
export const DEFAULT_WIN_SCORE = 15;
export const FIXED_DT = 1 / 60;

// Tuned 2D pixel physics for authentic snappy jump + floaty Pikachu ball + fiery power spike!
const GRAVITY_PLAYER = 2150;
const GRAVITY_BALL = 940;
const PLAYER_MOVE_SPEED = 450;
const PLAYER_JUMP_VY = -830;
const DIVE_SPEED = 740;
const DIVE_DURATION = 0.28;
const DIVE_COOLDOWN = 0.50;

export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  down: boolean;
  action: boolean; // Space / Enter: Ground = Dive, Air = Power Spike
}

export const EMPTY_PLAYER_INPUT: PlayerInput = {
  left: false,
  right: false,
  jump: false,
  down: false,
  action: false,
};

export interface PlayerState {
  slot: PlayerSlot;
  team: TeamSide;
  name: string;
  skin: ChibiSkinId;
  color: string;
  isBot: boolean;
  x: number;
  y: number; // Foot Y coordinate (GROUND_Y when standing on sand; smaller Y = higher in the air)
  vx: number;
  vy: number;
  facing: 1 | -1;
  diveTimer: number;
  diveDir: 1 | -1;
  diveCooldown: number;
  spikeTimer: number;
  hitCooldown: number;
  animPhase: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  spin: number;
  isSpiked: boolean;
  lastHitSlot: PlayerSlot | null;
  lastHitTeam: TeamSide | null;
}

export interface GameEvents {
  hit?: boolean;
  spike?: boolean;
  dive?: boolean;
  scored?: TeamSide;
  matchWon?: TeamSide;
}

export interface MatchState {
  mode: GameMode;
  winScore: number;
  phase: MatchPhase;
  phaseTimer: number;
  scoreBlue: number;
  scoreRed: number;
  servingTeam: TeamSide;
  lastScoringTeam: TeamSide | null;
  winner: TeamSide | null;
  rallyHits: number;
  screenShake: number;
  players: PlayerState[];
  ball: BallState;
}

export interface SlotProfile {
  name: string;
  skin: ChibiSkinId;
  color: string;
  isBot: boolean;
}

export function getTeamForSlot(slot: PlayerSlot): TeamSide {
  return slot === 'P1' || slot === 'P2' ? 'blue' : 'red';
}

export function getActiveSlots(mode: GameMode): PlayerSlot[] {
  return mode === '2v2' ? ['P1', 'P2', 'P3', 'P4'] : ['P1', 'P3'];
}

export function getSpawnX(slot: PlayerSlot, mode: GameMode): number {
  if (mode === '1v1') {
    return slot === 'P1' ? 275 : COURT_WIDTH - 275;
  }
  switch (slot) {
    case 'P1':
      return 365; // Blue front
    case 'P2':
      return 165; // Blue back
    case 'P3':
      return COURT_WIDTH - 365; // Red front (735)
    case 'P4':
      return COURT_WIDTH - 165; // Red back (935)
  }
}

export function getServeBallX(servingTeam: TeamSide, mode: GameMode): number {
  if (mode === '1v1') {
    return servingTeam === 'blue' ? 275 : COURT_WIDTH - 275;
  }
  return servingTeam === 'blue' ? 265 : COURT_WIDTH - 265;
}

export function mapEmojiToChibiSkin(emoji?: string): ChibiSkinId {
  if (!emoji) return 'pikamouse';
  if (emoji.includes('🐰')) return 'bunny';
  if (emoji.includes('🐶') || emoji.includes('🦁')) return 'shiba';
  if (emoji.includes('🐱')) return 'kitty';
  if (emoji.includes('🐼') || emoji.includes('🐨')) return 'panda';
  if (emoji.includes('🐸')) return 'frog';
  if (emoji.includes('🦊')) return 'fox';
  if (emoji.includes('🐷') || emoji.includes('🐹')) return 'capy';
  return 'pikamouse';
}

export function createMatchState(
  mode: GameMode,
  profiles: Partial<Record<PlayerSlot, SlotProfile>>,
  servingTeam: TeamSide = 'blue',
  winScore = DEFAULT_WIN_SCORE
): MatchState {
  const slots = getActiveSlots(mode);
  const fallbackSkins: Record<PlayerSlot, ChibiSkinOption> = {
    P1: CHIBI_SKINS[0],
    P2: CHIBI_SKINS[1],
    P3: CHIBI_SKINS[6],
    P4: CHIBI_SKINS[2],
  };

  const players: PlayerState[] = slots.map((slot) => {
    const team = getTeamForSlot(slot);
    const prof = profiles[slot];
    const fb = fallbackSkins[slot];
    return {
      slot,
      team,
      name: prof?.name || `${slot} (${fb.name})`,
      skin: prof?.skin || fb.id,
      color: prof?.color || fb.defaultColor,
      isBot: prof?.isBot ?? false,
      x: getSpawnX(slot, mode),
      y: GROUND_Y,
      vx: 0,
      vy: 0,
      facing: team === 'blue' ? 1 : -1,
      diveTimer: 0,
      diveDir: team === 'blue' ? 1 : -1,
      diveCooldown: 0,
      spikeTimer: 0,
      hitCooldown: 0,
      animPhase: 0,
    };
  });

  return {
    mode,
    winScore,
    phase: 'serve_wait',
    phaseTimer: 0.9,
    scoreBlue: 0,
    scoreRed: 0,
    servingTeam,
    lastScoringTeam: null,
    winner: null,
    rallyHits: 0,
    screenShake: 0,
    players,
    ball: {
      x: getServeBallX(servingTeam, mode),
      y: 165,
      vx: 0,
      vy: 0,
      rotation: 0,
      spin: 0,
      isSpiked: false,
      lastHitSlot: null,
      lastHitTeam: null,
    },
  };
}

export function resetForNextServe(state: MatchState, servingTeam: TeamSide): void {
  state.servingTeam = servingTeam;
  state.phase = 'serve_wait';
  state.phaseTimer = 0.85;
  state.rallyHits = 0;

  for (const p of state.players) {
    p.x = getSpawnX(p.slot, state.mode);
    p.y = GROUND_Y;
    p.vx = 0;
    p.vy = 0;
    p.facing = p.team === 'blue' ? 1 : -1;
    p.diveTimer = 0;
    p.diveCooldown = 0;
    p.spikeTimer = 0;
    p.hitCooldown = 0;
  }

  state.ball.x = getServeBallX(servingTeam, state.mode);
  state.ball.y = 165;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.spin = 0;
  state.ball.isSpiked = false;
  state.ball.lastHitSlot = null;
  state.ball.lastHitTeam = null;
}

/**
 * Predicts X where the ball will descend past targetY (for AI bots).
 */
export function predictLandingX(ball: BallState, targetY = GROUND_Y - 68): number {
  let sx = ball.x;
  let sy = ball.y;
  let svx = ball.vx;
  let svy = ball.vy;
  const dt = 0.03;

  for (let i = 0; i < 80; i++) {
    svy += GRAVITY_BALL * dt;
    sx += svx * dt;
    sy += svy * dt;

    if (sx - BALL_RADIUS < 0) {
      sx = BALL_RADIUS;
      svx = Math.abs(svx) * 0.88;
    } else if (sx + BALL_RADIUS > COURT_WIDTH) {
      sx = COURT_WIDTH - BALL_RADIUS;
      svx = -Math.abs(svx) * 0.88;
    }

    if (sy >= targetY && svy > 0) {
      return sx;
    }
  }
  return sx;
}

/**
 * Computes smart AI input for Practice / Local vs AI (supports both 1v1 and 2v2 zone coverage).
 */
export function computeAiInput(
  state: MatchState,
  bot: PlayerState,
  difficulty: AiDifficulty = 'normal'
): PlayerInput {
  const inp: PlayerInput = { ...EMPTY_PLAYER_INPUT };
  const { ball, mode } = state;
  const isBlue = bot.team === 'blue';
  const homeX = getSpawnX(bot.slot, mode);

  const predX = predictLandingX(ball);
  const ballOnOurSide = isBlue ? predX < NET_X + 20 : predX > NET_X - 20;
  const ballHeadingOurWay = isBlue ? ball.vx < 80 : ball.vx > -80;

  let shouldChase = ballOnOurSide || (ballHeadingOurWay && Math.abs(ball.x - NET_X) < 150);

  // In 2v2, coordinate with teammate so the two players cover front & back instead of colliding!
  if (mode === '2v2' && shouldChase) {
    const mate = state.players.find((p) => p.team === bot.team && p.slot !== bot.slot);
    if (mate) {
      const myDist = Math.abs(bot.x - predX);
      const mateDist = Math.abs(mate.x - predX);
      const humanPriorityBias = mate.isBot ? 28 : 65;
      if (mateDist + humanPriorityBias < myDist) {
        shouldChase = false;
      }
    }
  }

  let targetX = homeX;
  if (shouldChase) {
    // Position slightly behind the ball relative to the net so natural bounce arcs forward over the net
    const behindOffset = isBlue ? -22 : 22;
    targetX = predX + behindOffset;
  } else if (mode === '2v2') {
    const isFrontRole = bot.slot === 'P1' || bot.slot === 'P3';
    targetX = isBlue
      ? isFrontRole
        ? 390
        : 165
      : isFrontRole
        ? COURT_WIDTH - 390
        : COURT_WIDTH - 165;
  }

  const minX = isBlue ? PLAYER_RADIUS + 6 : NET_X + NET_HALF_WIDTH + PLAYER_RADIUS + 6;
  const maxX = isBlue ? NET_X - NET_HALF_WIDTH - PLAYER_RADIUS - 6 : COURT_WIDTH - PLAYER_RADIUS - 6;
  targetX = Math.max(minX, Math.min(maxX, targetX));

  const deadzone = difficulty === 'hard' ? 12 : difficulty === 'normal' ? 22 : 36;
  const dx = targetX - bot.x;
  if (dx < -deadzone) inp.left = true;
  else if (dx > deadzone) inp.right = true;

  const distX = Math.abs(ball.x - bot.x);
  const onGround = bot.y >= GROUND_Y - 1;

  if (shouldChase && onGround && state.phase === 'playing') {
    const jumpReachY = difficulty === 'hard' ? 245 : difficulty === 'normal' ? 280 : 320;
    const jumpRangeX = difficulty === 'hard' ? 115 : difficulty === 'normal' ? 92 : 74;
    if (distX < jumpRangeX && ball.y > jumpReachY && ball.y < GROUND_Y - 95 && ball.vy > -90) {
      inp.jump = true;
    }

    // Emergency torpedo dive when ball is dropping fast and out of walking reach
    if (
      difficulty !== 'easy' &&
      bot.diveCooldown <= 0 &&
      ball.y > GROUND_Y - 135 &&
      ball.vy > 110 &&
      distX > 85 &&
      distX < (difficulty === 'hard' ? 230 : 180)
    ) {
      inp.action = true;
      inp.left = ball.x < bot.x;
      inp.right = ball.x > bot.x;
    }
  }

  // Mid-air Power Spike!
  if (!onGround && bot.y < GROUND_Y - 45) {
    const headY = bot.y - 46;
    if (distX < 92 && Math.abs(ball.y - headY) < 88) {
      const spikeProb = difficulty === 'hard' ? 0.9 : difficulty === 'normal' ? 0.58 : 0.22;
      if (Math.random() < spikeProb) {
        inp.action = true;
        inp.right = isBlue;
        inp.left = !isBlue;
        if (difficulty === 'hard' && Math.abs(bot.x - NET_X) < 190) {
          inp.down = true;
        }
      }
    }
  }

  return inp;
}

/**
 * Checks Win-by-2 condition (first to >= winScore AND leading by >= 2 points).
 */
export function checkMatchWinner(scoreBlue: number, scoreRed: number, winScore: number): TeamSide | null {
  if (scoreBlue >= winScore && scoreBlue - scoreRed >= 2) return 'blue';
  if (scoreRed >= winScore && scoreRed - scoreBlue >= 2) return 'red';
  return null;
}

/**
 * Steps 1 physics tick (FIXED_DT = 1/60s) on the authoritative Host (or local Practice match).
 * NOTE: Strictly NO 3-touch rule per game design — teams may touch/volley freely on their side!
 */
export function stepGamePhysics(
  state: MatchState,
  inputs: Partial<Record<PlayerSlot, PlayerInput>>,
  dt: number = FIXED_DT
): GameEvents {
  const events: GameEvents = {};
  const { ball } = state;

  if (state.screenShake > 0) {
    state.screenShake = Math.max(0, state.screenShake - dt * 3.5);
  }

  if (state.phase === 'finished') {
    for (const p of state.players) {
      p.animPhase += dt * 9;
    }
    return events;
  }

  // Point scored celebration pause before resetting for next serve
  if (state.phase === 'point_pause') {
    state.phaseTimer -= dt;
    ball.vy += GRAVITY_BALL * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.rotation += ball.spin * dt;
    if (ball.y + BALL_RADIUS > GROUND_Y) {
      ball.y = GROUND_Y - BALL_RADIUS;
      ball.vy = -Math.abs(ball.vy) * 0.45;
      ball.vx *= 0.8;
    }
    for (const p of state.players) {
      p.animPhase += dt * 10;
      if (p.y < GROUND_Y) {
        p.vy += GRAVITY_PLAYER * dt;
        p.y = Math.min(GROUND_Y, p.y + p.vy * dt);
        if (p.y >= GROUND_Y) p.vy = 0;
      }
    }
    if (state.phaseTimer <= 0) {
      resetForNextServe(state, state.lastScoringTeam || 'blue');
    }
    return events;
  }

  // Update all players (players can position themselves during serve_wait as well)
  for (const p of state.players) {
    const inp = inputs[p.slot] || EMPTY_PLAYER_INPUT;

    if (p.diveCooldown > 0) p.diveCooldown = Math.max(0, p.diveCooldown - dt);
    if (p.spikeTimer > 0) p.spikeTimer = Math.max(0, p.spikeTimer - dt);
    if (p.hitCooldown > 0) p.hitCooldown = Math.max(0, p.hitCooldown - dt);

    const onGround = p.y >= GROUND_Y - 0.5;

    if (p.diveTimer > 0) {
      p.diveTimer = Math.max(0, p.diveTimer - dt);
      p.vx = p.diveDir * DIVE_SPEED;
    } else {
      const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      p.vx = dir * PLAYER_MOVE_SPEED;
      if (dir !== 0) {
        p.facing = dir > 0 ? 1 : -1;
        p.animPhase += dt * 15;
      } else {
        p.animPhase += dt * 3.5;
      }

      if (inp.jump && onGround) {
        p.vy = PLAYER_JUMP_VY;
      } else if (inp.action && onGround && p.diveCooldown <= 0) {
        // Ground Spacebar/Enter = Torpedo Dive! Uses pressed direction or current facing direction.
        const diveDir: 1 | -1 = dir !== 0 ? (dir > 0 ? 1 : -1) : p.facing;
        p.diveTimer = DIVE_DURATION;
        p.diveCooldown = DIVE_COOLDOWN;
        p.diveDir = diveDir;
        p.facing = diveDir;
        p.vy = -255; // Slight hop off the sand like Pikachu's flying dive!
        events.dive = true;
      }
    }

    p.vy += GRAVITY_PLAYER * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.y >= GROUND_Y) {
      p.y = GROUND_Y;
      p.vy = 0;
    }

    // Clamp each player strictly to their team's half of the court
    const minX =
      p.team === 'blue' ? PLAYER_RADIUS : NET_X + NET_HALF_WIDTH + PLAYER_RADIUS;
    const maxX =
      p.team === 'blue'
        ? NET_X - NET_HALF_WIDTH - PLAYER_RADIUS
        : COURT_WIDTH - PLAYER_RADIUS;
    if (p.x < minX) p.x = minX;
    if (p.x > maxX) p.x = maxX;
  }

  // Serve countdown before ball drops
  if (state.phase === 'serve_wait') {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.phase = 'playing';
      ball.vy = 60;
    }
    return events;
  }

  // Step 2D Ball kinematics
  ball.vy += GRAVITY_BALL * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.rotation += ball.spin * dt;

  // Ceiling bounce (keeps high lobs inside visible court)
  if (ball.y - BALL_RADIUS < 18) {
    ball.y = 18 + BALL_RADIUS;
    if (ball.vy < 0) ball.vy = Math.abs(ball.vy) * 0.55;
  }

  // Left & Right court boundary wall bounce (classic Pikachu Volleyball side walls!)
  if (ball.x - BALL_RADIUS < 0) {
    ball.x = BALL_RADIUS;
    ball.vx = Math.abs(ball.vx) * 0.88;
    ball.spin = -ball.spin * 0.8;
  } else if (ball.x + BALL_RADIUS > COURT_WIDTH) {
    ball.x = COURT_WIDTH - BALL_RADIUS;
    ball.vx = -Math.abs(ball.vx) * 0.88;
    ball.spin = -ball.spin * 0.8;
  }

  // Center Net collision (rounded top tape + vertical net sides)
  if (
    Math.abs(ball.x - NET_X) < NET_HALF_WIDTH + BALL_RADIUS &&
    ball.y + BALL_RADIUS > NET_TOP_Y
  ) {
    const dxTop = ball.x - NET_X;
    const dyTop = ball.y - NET_TOP_Y;
    const distTop = Math.hypot(dxTop, dyTop);

    if (ball.y <= NET_TOP_Y + 12 && distTop < BALL_RADIUS + NET_HALF_WIDTH) {
      // Rounded top-tape deflection
      const nx = distTop > 0.001 ? dxTop / distTop : ball.vx >= 0 ? -0.35 : 0.35;
      const ny = distTop > 0.001 ? dyTop / distTop : -1;
      ball.x = NET_X + nx * (BALL_RADIUS + NET_HALF_WIDTH + 1);
      ball.y = NET_TOP_Y + ny * (BALL_RADIUS + NET_HALF_WIDTH + 1);
      const speed = Math.max(260, Math.hypot(ball.vx, ball.vy) * 0.76);
      ball.vx = nx * speed;
      ball.vy = -Math.max(290, Math.abs(ny * speed));
      ball.isSpiked = false;
    } else {
      // Hit left or right vertical face of net
      if (ball.x < NET_X) {
        ball.x = NET_X - NET_HALF_WIDTH - BALL_RADIUS - 1;
        ball.vx = -Math.abs(ball.vx) * 0.75 - 45;
      } else {
        ball.x = NET_X + NET_HALF_WIDTH + BALL_RADIUS + 1;
        ball.vx = Math.abs(ball.vx) * 0.75 + 45;
      }
      ball.isSpiked = false;
    }
  }

  // Player <-> Ball collisions
  for (const p of state.players) {
    if (p.hitCooldown > 0) continue;
    const inp = inputs[p.slot] || EMPTY_PLAYER_INPUT;
    const bodyCenterY = p.y - (p.diveTimer > 0 ? 28 : 48);
    const dx = ball.x - p.x;
    const dy = ball.y - bodyCenterY;
    const dist = Math.hypot(dx, dy);
    const hitRadius = BALL_RADIUS + PLAYER_RADIUS + (p.diveTimer > 0 ? 10 : 4);

    if (dist < hitRadius) {
      const nx = dist > 0.001 ? dx / dist : 0;
      const ny = dist > 0.001 ? dy / dist : -1;

      ball.x = p.x + nx * (hitRadius + 2);
      ball.y = bodyCenterY + ny * (hitRadius + 2);

      const isAirborne = p.y < GROUND_Y - 22;
      const isPowerSpike = inp.action && isAirborne;

      if (isPowerSpike) {
        // Classic Pikachu Volleyball directional Power Spike!
        const forward = p.team === 'blue' ? 1 : -1;
        const moveAim = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
        const holdForward = moveAim === forward;
        const holdBack = moveAim === -forward;
        const holdUp = inp.jump;
        const holdDown = inp.down;

        if (holdDown && holdForward) {
          // Blistering diagonal smash
          ball.vx = forward * 980;
          ball.vy = 490;
        } else if (holdDown) {
          // Sharp steep slam right over the net!
          ball.vx = forward * 590;
          ball.vy = 810;
        } else if (holdUp) {
          // Power high lob toward backline
          ball.vx = forward * (holdForward ? 860 : 720);
          ball.vy = -560;
        } else if (holdForward) {
          // Flat laser rocket across net tape!
          ball.vx = forward * 1060;
          ball.vy = -55;
        } else if (holdBack) {
          // Soft drop-shot feint
          ball.vx = forward * 430;
          ball.vy = -250;
        } else {
          // Neutral crisp downward spike
          ball.vx = forward * 830;
          ball.vy = 260;
        }

        ball.spin = forward * 18;
        ball.isSpiked = true;
        p.spikeTimer = 0.34;
        state.screenShake = 1.0;
        events.spike = true;
      } else if (p.diveTimer > 0) {
        // Diving pancake save -> pops ball high & recoverable!
        const towardCenter = p.team === 'blue' ? 95 : -95;
        ball.vx = nx * 290 + towardCenter;
        ball.vy = -740;
        ball.spin = ball.vx * 0.012;
        ball.isSpiked = false;
        events.hit = true;
      } else {
        // Bouncy Chibi head/body volley
        const forwardBias = p.team === 'blue' ? 58 : -58;
        ball.vx = Math.max(-650, Math.min(650, nx * 480 + p.vx * 0.36 + forwardBias));
        ball.vy = -Math.max(590, Math.min(800, 650 + -ny * 125 + Math.max(0, -p.vy) * 0.16));
        ball.spin = ball.vx * 0.015;
        ball.isSpiked = false;
        events.hit = true;
      }

      p.hitCooldown = 0.14;
      ball.lastHitSlot = p.slot;
      ball.lastHitTeam = p.team;
      state.rallyHits += 1;
      break;
    }
  }

  // Sand Touch -> Point Scored! (Win-by-2 to 15)
  if (ball.y + BALL_RADIUS >= GROUND_Y) {
    ball.y = GROUND_Y - BALL_RADIUS;
    const scoringTeam: TeamSide = ball.x < NET_X ? 'red' : 'blue';
    if (scoringTeam === 'blue') state.scoreBlue += 1;
    else state.scoreRed += 1;

    state.lastScoringTeam = scoringTeam;
    ball.isSpiked = false;
    ball.vy = -Math.abs(ball.vy) * 0.42;
    ball.vx *= 0.62;
    state.screenShake = 0.65;
    events.scored = scoringTeam;

    const matchWinner = checkMatchWinner(state.scoreBlue, state.scoreRed, state.winScore);
    if (matchWinner) {
      state.phase = 'finished';
      state.winner = matchWinner;
      events.matchWon = matchWinner;
    } else {
      state.phase = 'point_pause';
      state.phaseTimer = 1.25;
    }
  }

  return events;
}

// Retro Web Audio Synthesizer (zero external assets required)
let sharedAudioCtx: AudioContext | null = null;

function ensureAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioConstructor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioConstructor) sharedAudioCtx = new AudioConstructor();
  }
  if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playVolleyballSfx(
  effect: 'hit' | 'spike' | 'dive' | 'score' | 'win',
  muted = false
): void {
  if (muted) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (effect === 'hit') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, t);
    osc.frequency.exponentialRampToValueAtTime(195, t + 0.085);
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.start(t);
    osc.stop(t + 0.095);
  } else if (effect === 'spike') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.18);
    gain.gain.setValueAtTime(0.26, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
    osc.start(t);
    osc.stop(t + 0.195);
  } else if (effect === 'dive') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(125, t + 0.13);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.start(t);
    osc.stop(t + 0.145);
  } else if (effect === 'score') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(587.33, t);
    osc.frequency.setValueAtTime(783.99, t + 0.09);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    osc.start(t);
    osc.stop(t + 0.27);
  } else if (effect === 'win') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, t);
    osc.frequency.setValueAtTime(659.25, t + 0.1);
    osc.frequency.setValueAtTime(783.99, t + 0.2);
    osc.frequency.setValueAtTime(1046.5, t + 0.32);
    gain.gain.setValueAtTime(0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.start(t);
    osc.stop(t + 0.62);
  }
}
