export type VbMode = '1v1' | '2v2';
export type VbDifficulty = 'chill' | 'normal' | 'pro';
export type VbTeam = 'left' | 'right';
export type VbSlotId = 'L1' | 'L2' | 'R1' | 'R2';

export interface VbInputState {
  left: boolean;
  right: boolean;
  jump: boolean; // Up / Jump (also aims upward lob on mid-air spike)
  down?: boolean; // Down (aims steep downward slam on mid-air spike, Pikachu 1997 style!)
  action: boolean; // Power Hit / Spike (in air) or Torpedo Dive (on ground)
}

export interface VbPlayerPhysics {
  slotId: VbSlotId;
  team: VbTeam;
  roleIndex: 0 | 1; // 0 = front/primary, 1 = back/secondary (for 2v2)
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  diveTimer: number;
  diveDir: 1 | -1;
  diveCooldown: number;
  spikeFlash: number;
  hitCooldown: number;
  isBot: boolean;
}

export interface VbBallPhysics {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  isSpiked: boolean;
  lastTouchTeam: VbTeam | null;
  lastTouchSlot: VbSlotId | null;
}

export interface VbCourtConfig {
  mode: VbMode;
  halfWidth: number;
  netHeight: number;
  netHalfThickness: number;
  ballRadius: number;
  playerRadius: number;
  playerHeight: number;
  winScore: number;
}

export interface VbMatchState {
  court: VbCourtConfig;
  players: VbPlayerPhysics[];
  ball: VbBallPhysics;
  scoreLeft: number;
  scoreRight: number;
  servingTeam: VbTeam;
  phase: 'serve_wait' | 'playing' | 'point_pause' | 'finished';
  phaseTimer: number;
  lastScorer: VbTeam | null;
  winner: VbTeam | null;
  rallyCount: number;
  screenShake: number;
}

export interface VbStepEvents {
  hit?: boolean;
  spike?: boolean;
  dive?: boolean;
  score?: VbTeam;
  win?: VbTeam;
}

export const VB_WIN_SCORE = 7;

export function getCourtConfig(mode: VbMode): VbCourtConfig {
  if (mode === '2v2') {
    return {
      mode: '2v2',
      halfWidth: 8.2,
      netHeight: 2.55,
      netHalfThickness: 0.16,
      ballRadius: 0.56,
      playerRadius: 0.72,
      playerHeight: 1.6,
      winScore: VB_WIN_SCORE,
    };
  }
  // Authentic 1997 Pikachu Volleyball 1v1 proportions (432x304 court ratio)
  return {
    mode: '1v1',
    halfWidth: 6.6,
    netHeight: 2.45,
    netHalfThickness: 0.16,
    ballRadius: 0.56,
    playerRadius: 0.72,
    playerHeight: 1.6,
    winScore: VB_WIN_SCORE,
  };
}

function getSlotStartX(slotId: VbSlotId, mode: VbMode, halfWidth: number): number {
  if (mode === '1v1') {
    return slotId === 'L1' ? -halfWidth * 0.5 : halfWidth * 0.5;
  }
  switch (slotId) {
    case 'L1':
      return -halfWidth * 0.34;
    case 'L2':
      return -halfWidth * 0.72;
    case 'R1':
      return halfWidth * 0.34;
    case 'R2':
      return halfWidth * 0.72;
  }
}

export function createInitialMatchState(
  mode: VbMode,
  botFlags: Record<VbSlotId, boolean>,
  servingTeam: VbTeam = 'left'
): VbMatchState {
  const court = getCourtConfig(mode);
  const slotList: Array<{ id: VbSlotId; team: VbTeam; role: 0 | 1 }> =
    mode === '2v2'
      ? [
        { id: 'L1', team: 'left', role: 0 },
        { id: 'L2', team: 'left', role: 1 },
        { id: 'R1', team: 'right', role: 0 },
        { id: 'R2', team: 'right', role: 1 },
      ]
      : [
        { id: 'L1', team: 'left', role: 0 },
        { id: 'R1', team: 'right', role: 0 },
      ];

  const players: VbPlayerPhysics[] = slotList.map((s) => ({
    slotId: s.id,
    team: s.team,
    roleIndex: s.role,
    x: getSlotStartX(s.id, mode, court.halfWidth),
    y: 0,
    vx: 0,
    vy: 0,
    facing: s.team === 'left' ? 1 : -1,
    diveTimer: 0,
    diveDir: s.team === 'left' ? 1 : -1,
    diveCooldown: 0,
    spikeFlash: 0,
    hitCooldown: 0,
    isBot: Boolean(botFlags[s.id]),
  }));

  const state: VbMatchState = {
    court,
    players,
    ball: {
      x: servingTeam === 'left' ? -court.halfWidth * 0.45 : court.halfWidth * 0.45,
      y: 5.4,
      vx: 0,
      vy: 0,
      spin: 0,
      isSpiked: false,
      lastTouchTeam: null,
      lastTouchSlot: null,
    },
    scoreLeft: 0,
    scoreRight: 0,
    servingTeam,
    phase: 'serve_wait',
    phaseTimer: 0.9,
    lastScorer: null,
    winner: null,
    rallyCount: 0,
    screenShake: 0,
  };

  return state;
}

export function resetRallyPositions(state: VbMatchState, servingTeam: VbTeam): void {
  const { court } = state;
  state.servingTeam = servingTeam;
  state.phase = 'serve_wait';
  state.phaseTimer = 0.85;
  state.rallyCount = 0;

  for (const p of state.players) {
    p.x = getSlotStartX(p.slotId, court.mode, court.halfWidth);
    p.y = 0;
    p.vx = 0;
    p.vy = 0;
    p.facing = p.team === 'left' ? 1 : -1;
    p.diveTimer = 0;
    p.diveCooldown = 0;
    p.spikeFlash = 0;
    p.hitCooldown = 0;
  }

  state.ball.x = servingTeam === 'left' ? -court.halfWidth * 0.45 : court.halfWidth * 0.45;
  state.ball.y = 5.4;
  state.ball.vx = 0;
  state.ball.vy = 0;
  state.ball.spin = 0;
  state.ball.isSpiked = false;
  state.ball.lastTouchTeam = null;
  state.ball.lastTouchSlot = null;
}

// Tuned to match 1997 Pikachu Volleyball: floaty ball + high snappy jump + torpedo dive!
const GRAVITY_PLAYER = 31.0;
const GRAVITY_BALL = 13.2;
const PLAYER_SPEED = 7.8;
const PLAYER_JUMP_VY = 13.6;
const DIVE_SPEED = 13.0;
const DIVE_DURATION = 0.28;
const DIVE_COOLDOWN = 0.52;

/**
 * Predict where the ball will cross y = targetY (used by AI bots).
 */
function predictBallLandingX(ball: VbBallPhysics, court: VbCourtConfig, targetY = 1.2): number {
  let simX = ball.x;
  let simY = ball.y;
  let simVx = ball.vx;
  let simVy = ball.vy;
  const dt = 0.04;
  for (let i = 0; i < 65; i++) {
    simVy -= GRAVITY_BALL * dt;
    simX += simVx * dt;
    simY += simVy * dt;
    if (simX < -court.halfWidth + court.ballRadius) {
      simX = -court.halfWidth + court.ballRadius;
      simVx = Math.abs(simVx) * 0.9;
    } else if (simX > court.halfWidth - court.ballRadius) {
      simX = court.halfWidth - court.ballRadius;
      simVx = -Math.abs(simVx) * 0.9;
    }
    if (simY <= targetY && simVy < 0) {
      return simX;
    }
  }
  return simX;
}

export function computeBotInput(
  state: VbMatchState,
  bot: VbPlayerPhysics,
  difficulty: VbDifficulty
): VbInputState {
  const input: VbInputState = { left: false, right: false, jump: false, action: false };
  const { ball, court } = state;
  const isLeft = bot.team === 'left';
  const sign = isLeft ? -1 : 1;

  const predX = predictBallLandingX(ball, court, 1.3);
  const ballOnMySide = isLeft ? predX < 0.35 : predX > -0.35;
  const ballMovingToMe = isLeft ? ball.vx <= 1.2 : ball.vx >= -1.2;

  // Determine home X for idle / secondary role in 2v2
  const homeX = getSlotStartX(bot.slotId, court.mode, court.halfWidth);

  let shouldChase = ballOnMySide || (ballMovingToMe && Math.abs(ball.x) < 2.2);

  // In 2v2, coordinate with teammate so bots don't clump onto the exact same spot
  if (court.mode === '2v2' && shouldChase) {
    const mate = state.players.find((p) => p.team === bot.team && p.slotId !== bot.slotId);
    if (mate) {
      const myDist = Math.abs(bot.x - predX);
      const mateDist = Math.abs(mate.x - predX);
      // If teammate is clearly closer (or human is already near the ball), cover the other zone
      const bias = mate.isBot ? 0.55 : 1.1;
      if (mateDist + bias < myDist) {
        shouldChase = false;
      }
    }
  }

  const deadzone = difficulty === 'pro' ? 0.22 : difficulty === 'normal' ? 0.38 : 0.6;
  let targetX = homeX;

  if (shouldChase) {
    // Slightly stand behind the ball relative to net so it bounces forward over the net
    const offset = difficulty === 'pro' ? 0.32 * sign : 0.22 * sign;
    targetX = predX + offset;
  } else if (court.mode === '2v2') {
    // Cover front or back zone cleanly
    targetX = bot.roleIndex === 0 ? sign * court.halfWidth * 0.28 : sign * court.halfWidth * 0.7;
  }

  // Clamp target within own court
  const minX = isLeft ? -court.halfWidth + court.playerRadius : court.netHalfThickness + court.playerRadius + 0.1;
  const maxX = isLeft ? -court.netHalfThickness - court.playerRadius - 0.1 : court.halfWidth - court.playerRadius;
  targetX = Math.max(minX, Math.min(maxX, targetX));

  const dx = targetX - bot.x;
  if (dx < -deadzone) input.left = true;
  else if (dx > deadzone) input.right = true;

  // Jump & Spike decision
  const distToBallX = Math.abs(ball.x - bot.x);
  const ballApproachingDown = ball.vy < 1.5;

  if (shouldChase && bot.y <= 0.05) {
    const jumpHeightWindow = difficulty === 'pro' ? 4.3 : difficulty === 'normal' ? 3.8 : 3.2;
    const jumpDistWindow = difficulty === 'pro' ? 1.85 : difficulty === 'normal' ? 1.55 : 1.25;
    if (distToBallX < jumpDistWindow && ball.y > 1.8 && ball.y < jumpHeightWindow && ballApproachingDown) {
      input.jump = true;
    }

    // Emergency dive for low fast ball on normal/pro
    if (
      difficulty !== 'chill' &&
      bot.diveCooldown <= 0 &&
      ball.y < 1.55 &&
      ball.vy < -1.5 &&
      distToBallX > 1.35 &&
      distToBallX < (difficulty === 'pro' ? 3.4 : 2.6)
    ) {
      input.action = true;
      input.left = ball.x < bot.x;
      input.right = ball.x > bot.x;
    }
  }

  // Mid-air Power Spike!
  if (bot.y > 0.65 && distToBallX < 1.5 && Math.abs(ball.y - (bot.y + 1.1)) < 1.4) {
    const spikeChance = difficulty === 'pro' ? 0.92 : difficulty === 'normal' ? 0.55 : 0.18;
    if (Math.random() < spikeChance) {
      input.action = true;
      // Aim toward opponent side
      input.right = isLeft;
      input.left = !isLeft;
    }
  }

  return input;
}

export function stepVolleyballMatch(
  state: VbMatchState,
  inputs: Record<VbSlotId, VbInputState>,
  dtRaw: number,
  isClientPrediction = false
): VbStepEvents {
  const dt = Math.min(0.033, Math.max(0.001, dtRaw));
  const events: VbStepEvents = {};
  const { court, ball } = state;

  if (state.screenShake > 0) {
    state.screenShake = Math.max(0, state.screenShake - dt * 3.2);
  }

  if (state.phase === 'finished') {
    return events;
  }

  if (state.phase === 'point_pause') {
    state.phaseTimer -= dt;
    // Let ball bounce gently on sand during pause
    ball.vy -= GRAVITY_BALL * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    if (ball.y < court.ballRadius) {
      ball.y = court.ballRadius;
      ball.vy = Math.abs(ball.vy) * 0.45;
      ball.vx *= 0.82;
    }
    if (!isClientPrediction && state.phaseTimer <= 0) {
      resetRallyPositions(state, state.lastScorer || 'left');
    }
    return events;
  }

  // Update players (allowed during both serve_wait and playing)
  for (const p of state.players) {
    const inp = inputs[p.slotId] || { left: false, right: false, jump: false, action: false };
    if (p.diveCooldown > 0) p.diveCooldown = Math.max(0, p.diveCooldown - dt);
    if (p.spikeFlash > 0) p.spikeFlash = Math.max(0, p.spikeFlash - dt);
    if (p.hitCooldown > 0) p.hitCooldown = Math.max(0, p.hitCooldown - dt);

    if (p.diveTimer > 0) {
      p.diveTimer = Math.max(0, p.diveTimer - dt);
      p.vx = p.diveDir * DIVE_SPEED;
    } else {
      const moveDir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
      p.vx = moveDir * PLAYER_SPEED;
      if (moveDir !== 0) {
        p.facing = moveDir > 0 ? 1 : -1;
      }

      // Ground jump
      if (inp.jump && p.y <= 0.001) {
        p.vy = PLAYER_JUMP_VY;
      }

      // Ground dive (1997 Pikachu Volleyball torpedo dive!)
      if (inp.action && p.y <= 0.001 && p.diveCooldown <= 0 && moveDir !== 0) {
        p.diveTimer = DIVE_DURATION;
        p.diveCooldown = DIVE_COOLDOWN;
        p.diveDir = moveDir > 0 ? 1 : -1;
        p.facing = p.diveDir;
        p.vy = 5.2;
        events.dive = true;
      }
    }

    p.vy -= GRAVITY_PLAYER * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.y < 0) {
      p.y = 0;
      p.vy = 0;
    }

    // Clamp to own side of net
    const minX =
      p.team === 'left'
        ? -court.halfWidth + court.playerRadius
        : court.netHalfThickness + court.playerRadius;
    const maxX =
      p.team === 'left'
        ? -court.netHalfThickness - court.playerRadius
        : court.halfWidth - court.playerRadius;
    if (p.x < minX) p.x = minX;
    if (p.x > maxX) p.x = maxX;
  }

  // Wait briefly before dropping ball for serve
  if (state.phase === 'serve_wait') {
    state.phaseTimer -= dt;
    if (!isClientPrediction && state.phaseTimer <= 0) {
      state.phase = 'playing';
      ball.vy = -1.2;
    }
    return events;
  }

  // Ball physics
  ball.vy -= GRAVITY_BALL * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  ball.spin += ball.vx * dt * 0.9;

  // Ceiling soft clamp
  const maxCeiling = 11.2;
  if (ball.y > maxCeiling) {
    ball.y = maxCeiling;
    if (ball.vy > 0) ball.vy = -ball.vy * 0.55;
  }

  // Side walls bounce
  if (ball.x - court.ballRadius < -court.halfWidth) {
    ball.x = -court.halfWidth + court.ballRadius;
    ball.vx = Math.abs(ball.vx) * 0.88;
  } else if (ball.x + court.ballRadius > court.halfWidth) {
    ball.x = court.halfWidth - court.ballRadius;
    ball.vx = -Math.abs(ball.vx) * 0.88;
  }

  // Net collision (top rounded cap + vertical post)
  const netTopY = court.netHeight;
  const nearNetX = Math.abs(ball.x) < court.netHalfThickness + court.ballRadius;
  if (nearNetX && ball.y - court.ballRadius < netTopY) {
    const distTopX = ball.x;
    const distTopY = ball.y - netTopY;
    const distTop = Math.hypot(distTopX, distTopY);
    if (ball.y >= netTopY - 0.18 && distTop < court.ballRadius + court.netHalfThickness) {
      // Bounce off top tape of the net
      const nx = distTop > 0.001 ? distTopX / distTop : ball.vx >= 0 ? -0.3 : 0.3;
      const ny = distTop > 0.001 ? distTopY / distTop : 1;
      ball.y = netTopY + ny * (court.ballRadius + court.netHalfThickness + 0.02);
      ball.vx = nx * Math.max(3.5, Math.abs(ball.vx) * 0.85);
      ball.vy = Math.max(4.8, Math.abs(ball.vy) * 0.72);
      ball.isSpiked = false;
    } else {
      // Bounce off left or right face of net
      if (ball.x < 0) {
        ball.x = -(court.netHalfThickness + court.ballRadius);
        ball.vx = -Math.abs(ball.vx) * 0.78 - 0.8;
      } else {
        ball.x = court.netHalfThickness + court.ballRadius;
        ball.vx = Math.abs(ball.vx) * 0.78 + 0.8;
      }
      ball.isSpiked = false;
    }
  }

  // Player-ball collisions (Host-authoritative only so Guest never sees fake/divergent bounces!)
  if (!isClientPrediction) {
  for (const p of state.players) {
    if (p.hitCooldown > 0) continue;
    const inp = inputs[p.slotId] || { left: false, right: false, jump: false, action: false };
    const pCenterY = p.y + (p.diveTimer > 0 ? 0.55 : 0.92);
    const dx = ball.x - p.x;
    const dy = ball.y - pCenterY;
    const dist = Math.hypot(dx, dy);
    const hitRadius = court.ballRadius + court.playerRadius + (p.diveTimer > 0 ? 0.16 : 0.08);

    if (dist < hitRadius) {
      const nx = dist > 0.001 ? dx / dist : 0;
      const ny = dist > 0.001 ? dy / dist : 1;
      // Push ball outside player collider
      ball.x = p.x + nx * (hitRadius + 0.03);
      ball.y = pCenterY + ny * (hitRadius + 0.03);

      const isAirSpike = inp.action && p.y > 0.32;
      if (isAirSpike) {
        // Authentic 1997 Pikachu Volleyball 5-Direction Power Spike!
        const forward = p.team === 'left' ? 1 : -1;
        const aimDir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
        const holdingForward = aimDir === forward;
        const holdingBack = aimDir === -forward;
        const holdingUp = Boolean(inp.jump);
        const holdingDown = Boolean(inp.down);

        if (holdingDown && holdingForward) {
          // Diagonal fast slam
          ball.vx = forward * 15.2;
          ball.vy = -7.8;
        } else if (holdingDown) {
          // Steep vertical net-front slam!
          ball.vx = forward * 9.2;
          ball.vy = -12.6;
        } else if (holdingUp) {
          // High power lob over blockers to deep backline
          ball.vx = forward * (holdingForward ? 13.6 : 11.2);
          ball.vy = 8.4;
        } else if (holdingForward) {
          // Flat high-speed rocket across the tape
          ball.vx = forward * 16.4;
          ball.vy = 0.7;
        } else if (holdingBack) {
          // Cheeky soft drop-shot feint
          ball.vx = forward * 6.8;
          ball.vy = 3.6;
        } else {
          // Classic neutral downward spike
          ball.vx = forward * 12.6;
          ball.vy = -4.2;
        }
        ball.isSpiked = true;
        p.spikeFlash = 0.35;
        state.screenShake = 0.55;
        events.spike = true;
      } else if (p.diveTimer > 0) {
        // Pikachu Torpedo Diving Save -> pops ball high up for a clean recovery set!
        const centerBias = p.team === 'left' ? 1.4 : -1.4;
        ball.vx = nx * 4.5 + centerBias;
        ball.vy = 11.4;
        ball.isSpiked = false;
        events.hit = true;
      } else {
        // Classic Pikachu rounded head bounce / set
        const forwardBias = p.team === 'left' ? 0.85 : -0.85;
        ball.vx = nx * 7.4 + p.vx * 0.38 + forwardBias;
        ball.vx = Math.max(-10.2, Math.min(10.2, ball.vx));
        ball.vy = Math.max(9.2, Math.min(12.6, 10.0 + ny * 2.2 + Math.max(0, p.vy) * 0.18));
        ball.isSpiked = false;
        events.hit = true;
      }

      p.hitCooldown = 0.14;
      ball.lastTouchTeam = p.team;
      ball.lastTouchSlot = p.slotId;
      state.rallyCount++;
      break;
    }
  }
  }

  // Ground touch -> Point scored! (Host-authoritative only; Guest prediction never mutates score/phase!)
  if (ball.y - court.ballRadius <= 0) {
    ball.y = court.ballRadius;
    if (isClientPrediction) {
      ball.vy = Math.abs(ball.vy) * 0.42;
      ball.vx *= 0.6;
      return events;
    }
    const scorer: VbTeam = ball.x < 0 ? 'right' : 'left';
    if (scorer === 'left') state.scoreLeft++;
    else state.scoreRight++;

    state.lastScorer = scorer;
    ball.isSpiked = false;
    ball.vy = Math.abs(ball.vy) * 0.42;
    ball.vx *= 0.6;
    state.screenShake = 0.4;
    events.score = scorer;

    if (state.scoreLeft >= court.winScore || state.scoreRight >= court.winScore) {
      state.phase = 'finished';
      state.winner = state.scoreLeft >= court.winScore ? 'left' : 'right';
      events.win = state.winner;
    } else {
      state.phase = 'point_pause';
      state.phaseTimer = 1.15;
    }
  }

  return events;
}

// Lightweight Web Audio API sound effects (zero external audio files needed)
let vbAudioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!vbAudioCtx) {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) vbAudioCtx = new Ctx();
  }
  if (vbAudioCtx && vbAudioCtx.state === 'suspended') {
    vbAudioCtx.resume().catch(() => { });
  }
  return vbAudioCtx;
}

export function playVbSound(kind: 'hit' | 'spike' | 'dive' | 'score' | 'win', muted = false): void {
  if (muted) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  if (kind === 'hit') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, now);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.08);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    osc.start(now);
    osc.stop(now + 0.09);
  } else if (kind === 'spike') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.16);
    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
    osc.start(now);
    osc.stop(now + 0.17);
  } else if (kind === 'dive') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 0.12);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    osc.start(now);
    osc.stop(now + 0.13);
  } else if (kind === 'score') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.09);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    osc.start(now);
    osc.stop(now + 0.25);
  } else if (kind === 'win') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.setValueAtTime(659.25, now + 0.1);
    osc.frequency.setValueAtTime(783.99, now + 0.2);
    osc.frequency.setValueAtTime(1046.5, now + 0.32);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.start(now);
    osc.stop(now + 0.56);
  }
}
