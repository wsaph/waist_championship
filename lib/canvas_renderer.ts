// lib/canvas_renderer.ts
// Vibrant 2D HTML5 Canvas Renderer (1100 x 600) for Pikachu-style Chibi Beach Volleyball

import {
  BALL_RADIUS,
  CHIBI_SKINS,
  COURT_HEIGHT,
  COURT_WIDTH,
  GROUND_Y,
  NET_HALF_WIDTH,
  NET_TOP_Y,
  NET_X,
  PLAYER_RADIUS,
  type BallState,
  type ChibiSkinId,
  type MatchState,
  type PlayerSlot,
  type PlayerState,
} from '@/lib/game_physics';

export interface SpikeTrailPoint {
  x: number;
  y: number;
  alpha: number;
  radius: number;
}

export interface SandParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export class CanvasFxState {
  trail: SpikeTrailPoint[] = [];
  particles: SandParticle[] = [];
  lastBallSpiked = false;

  update(state: MatchState, dt: number): void {
    const { ball } = state;

    if (ball.isSpiked) {
      this.trail.unshift({
        x: ball.x,
        y: ball.y,
        alpha: 0.85,
        radius: BALL_RADIUS * 0.96,
      });
      if (this.trail.length > 10) this.trail.pop();

      // Emit fiery sparks behind spiked ball
      if (Math.random() < 0.75) {
        this.particles.push({
          x: ball.x + (Math.random() - 0.5) * 24,
          y: ball.y + (Math.random() - 0.5) * 24,
          vx: -ball.vx * 0.14 + (Math.random() - 0.5) * 70,
          vy: -ball.vy * 0.14 - Math.random() * 60,
          life: 0.28,
          maxLife: 0.28,
          color: Math.random() < 0.5 ? '#EF4444' : '#FACC15',
          size: 4 + Math.random() * 5,
        });
      }
    } else {
      for (const t of this.trail) {
        t.alpha -= dt * 4.5;
      }
      this.trail = this.trail.filter((t) => t.alpha > 0.02);
    }

    // Spawn sand splash when diving
    for (const p of state.players) {
      if (p.diveTimer > 0.22 && Math.random() < 0.65) {
        this.particles.push({
          x: p.x - p.diveDir * 22,
          y: GROUND_Y - 4,
          vx: -p.diveDir * (60 + Math.random() * 90),
          vy: -(50 + Math.random() * 90),
          life: 0.35,
          maxLife: 0.35,
          color: '#FDE68A',
          size: 4 + Math.random() * 4,
        });
      }
    }

    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 260 * dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    this.lastBallSpiked = ball.isSpiked;
  }
}

function getCheekColor(skin: ChibiSkinId): string {
  return CHIBI_SKINS.find((s) => s.id === skin)?.cheekColor || '#FB7185';
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function drawCloud(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.arc(0, 0, 26, 0, Math.PI * 2);
  ctx.arc(24, -6, 22, 0, Math.PI * 2);
  ctx.arc(48, 2, 20, 0, Math.PI * 2);
  ctx.arc(-22, 4, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPalmTree(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  leanDir: 1 | -1,
  timeSec: number
): void {
  ctx.save();
  const sway = Math.sin(timeSec * 1.6 + baseX * 0.02) * 5;
  const topX = baseX + leanDir * 28 + sway;
  const topY = baseY - 165;

  // Curved trunk
  ctx.strokeStyle = '#92400E';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + leanDir * 8, baseY - 88, topX, topY);
  ctx.stroke();

  ctx.strokeStyle = '#B45309';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(baseX + leanDir * 8, baseY - 88, topX, topY);
  ctx.stroke();

  // Coconuts
  ctx.fillStyle = '#78350F';
  ctx.beginPath();
  ctx.arc(topX - 6, topY + 8, 6, 0, Math.PI * 2);
  ctx.arc(topX + 6, topY + 9, 6, 0, Math.PI * 2);
  ctx.fill();

  // Fronds
  const angles = [-2.5, -1.9, -1.1, -0.45, 0.25, 0.85];
  for (const ang of angles) {
    ctx.save();
    ctx.translate(topX, topY);
    ctx.rotate(ang + sway * 0.012);
    ctx.fillStyle = '#16A34A';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(36, -18, 74, 8);
    ctx.quadraticCurveTo(34, 4, 0, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawBeachBackground(ctx: CanvasRenderingContext2D, timeSec: number): void {
  // 1. Bright tropical sky gradient
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 395);
  skyGrad.addColorStop(0, '#0284C7');
  skyGrad.addColorStop(0.55, '#38BDF8');
  skyGrad.addColorStop(1, '#BAE6FD');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, COURT_WIDTH, 395);

  // 2. Cheerful Summer Sun
  const sunX = 955;
  const sunY = 86;
  const sunGlow = ctx.createRadialGradient(sunX, sunY, 16, sunX, sunY, 82);
  sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
  sunGlow.addColorStop(0.45, 'rgba(253, 224, 71, 0.45)');
  sunGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 82, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#FEF08A';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();

  // 3. Drifting clouds
  const c1 = ((timeSec * 14) % (COURT_WIDTH + 220)) - 110;
  const c2 = ((timeSec * 9 + 440) % (COURT_WIDTH + 220)) - 110;
  const c3 = ((timeSec * 11 + 830) % (COURT_WIDTH + 220)) - 110;
  drawCloud(ctx, c1, 78, 1.05);
  drawCloud(ctx, c2, 128, 0.82);
  drawCloud(ctx, c3, 66, 0.9);

  // 4. Sparkling turquoise ocean strip
  const seaGrad = ctx.createLinearGradient(0, 365, 0, 432);
  seaGrad.addColorStop(0, '#0369A1');
  seaGrad.addColorStop(0.6, '#0EA5E9');
  seaGrad.addColorStop(1, '#67E8F9');
  ctx.fillStyle = seaGrad;
  ctx.fillRect(0, 365, COURT_WIDTH, 68);

  // Gentle white foam waves
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= COURT_WIDTH; x += 18) {
    const waveY = 426 + Math.sin(x * 0.03 + timeSec * 3.0) * 3.5;
    if (x === 0) ctx.moveTo(x, waveY);
    else ctx.lineTo(x, waveY);
  }
  ctx.stroke();

  // 5. Golden Beach Sand
  const sandGrad = ctx.createLinearGradient(0, 428, 0, COURT_HEIGHT);
  sandGrad.addColorStop(0, '#FDE68A');
  sandGrad.addColorStop(0.45, '#FCD34D');
  sandGrad.addColorStop(1, '#F59E0B');
  ctx.fillStyle = sandGrad;
  ctx.fillRect(0, 428, COURT_WIDTH, COURT_HEIGHT - 428);

  // Palm trees framing left & right sidelines
  drawPalmTree(ctx, 42, 442, 1, timeSec);
  drawPalmTree(ctx, COURT_WIDTH - 42, 442, -1, timeSec);

  // 6. Beach Court Boundary Lines (Perspective trapezoid on sand)
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(46, GROUND_Y - 30);
  ctx.lineTo(COURT_WIDTH - 46, GROUND_Y - 30);
  ctx.lineTo(COURT_WIDTH - 16, GROUND_Y + 30);
  ctx.lineTo(16, GROUND_Y + 30);
  ctx.closePath();
  ctx.stroke();

  // Subtle team tint zones on sand (Blue Left vs Red Right)
  ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
  ctx.fillRect(24, GROUND_Y - 28, NET_X - 24, 56);
  ctx.fillStyle = 'rgba(244, 63, 94, 0.08)';
  ctx.fillRect(NET_X, GROUND_Y - 28, COURT_WIDTH - 24 - NET_X, 56);
  ctx.restore();
}

function drawCenterNet(ctx: CanvasRenderingContext2D): void {
  ctx.save();

  // Net ground shadow
  ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
  ctx.beginPath();
  ctx.ellipse(NET_X, GROUND_Y + 4, 20, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Net mesh grid
  const meshLeft = NET_X - NET_HALF_WIDTH + 1;
  const meshW = (NET_HALF_WIDTH - 1) * 2;
  const meshTop = NET_TOP_Y + 12;
  const meshH = GROUND_Y - 24 - meshTop;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.28)';
  ctx.fillRect(meshLeft, meshTop, meshW, meshH);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.lineWidth = 1.6;
  for (let y = meshTop; y <= meshTop + meshH; y += 14) {
    ctx.beginPath();
    ctx.moveTo(meshLeft, y);
    ctx.lineTo(meshLeft + meshW, y);
    ctx.stroke();
  }

  // Sturdy central pole
  const poleGrad = ctx.createLinearGradient(NET_X - 6, 0, NET_X + 6, 0);
  poleGrad.addColorStop(0, '#CBD5E1');
  poleGrad.addColorStop(0.5, '#F8FAFC');
  poleGrad.addColorStop(1, '#64748B');
  ctx.fillStyle = poleGrad;
  drawRoundedRect(ctx, NET_X - 5, NET_TOP_Y + 2, 10, GROUND_Y - NET_TOP_Y + 2, 4);
  ctx.fill();

  // Bright yellow/red top tape cap (helps players judge tape-skimming spikes!)
  ctx.fillStyle = '#FACC15';
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;
  drawRoundedRect(ctx, NET_X - NET_HALF_WIDTH - 2, NET_TOP_Y - 4, (NET_HALF_WIDTH + 2) * 2, 20, 7);
  ctx.fill();
  ctx.stroke();

  // Red antenna stripe on top of net
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(NET_X - 3, NET_TOP_Y - 14, 6, 12);

  ctx.restore();
}

function drawGroundShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  heightAboveSand: number,
  baseRadiusX: number
): void {
  const ratio = Math.max(0.24, 1 - heightAboveSand / 490);
  ctx.save();
  ctx.fillStyle = `rgba(15, 23, 42, ${(0.38 * ratio).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 5, baseRadiusX * ratio, 9 * ratio, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAnimalEarsAndTail(
  ctx: CanvasRenderingContext2D,
  skin: ChibiSkinId,
  bodyColor: string,
  facing: 1 | -1,
  animPhase: number
): void {
  const wag = Math.sin(animPhase * 1.4) * 0.18;

  // Tail behind body
  ctx.save();
  ctx.translate(-facing * 26, -24);
  ctx.rotate(wag);
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.5;

  if (skin === 'pikamouse') {
    // Lightning bolt tail!
    ctx.fillStyle = '#FACC15';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-facing * 12, -10);
    ctx.lineTo(-facing * 6, -12);
    ctx.lineTo(-facing * 20, -24);
    ctx.lineTo(-facing * 8, -18);
    ctx.lineTo(-facing * 13, -15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (skin === 'fox' || skin === 'shiba' || skin === 'kitty') {
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(-facing * 10, -8, 12, 7, -facing * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    // Cute pom-pom tail
    ctx.fillStyle = skin === 'panda' ? '#1E293B' : '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-facing * 6, -4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();

  // Ears on top of head (head center around y = -58)
  ctx.save();
  ctx.lineWidth = 2.8;
  ctx.strokeStyle = '#1E293B';

  if (skin === 'bunny') {
    [-11, 11].forEach((ex, idx) => {
      ctx.save();
      ctx.translate(ex, -80);
      ctx.rotate((idx === 0 ? -0.14 : 0.14) + wag * 0.4);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(0, -14, 7.5, 18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#FDA4AF';
      ctx.beginPath();
      ctx.ellipse(0, -13, 3.8, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  } else if (skin === 'pikamouse') {
    [-14, 14].forEach((ex, idx) => {
      ctx.save();
      ctx.translate(ex, -78);
      ctx.rotate(idx === 0 ? -0.38 : 0.38);
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.ellipse(0, -13, 7, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Black ear tips
      ctx.fillStyle = '#1E293B';
      ctx.beginPath();
      ctx.ellipse(0, -23, 5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  } else if (skin === 'kitty' || skin === 'fox' || skin === 'shiba') {
    [-15, 15].forEach((ex, idx) => {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.moveTo(ex - 9, -74);
      ctx.lineTo(ex + (idx === 0 ? -3 : 3), -96);
      ctx.lineTo(ex + 9, -74);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = skin === 'fox' ? '#FEF3C7' : '#FDA4AF';
      ctx.beginPath();
      ctx.moveTo(ex - 4.5, -76);
      ctx.lineTo(ex + (idx === 0 ? -2 : 2), -89);
      ctx.lineTo(ex + 4.5, -76);
      ctx.closePath();
      ctx.fill();
    });
  } else if (skin === 'panda' || skin === 'capy') {
    [-17, 17].forEach((ex) => {
      ctx.fillStyle = skin === 'panda' ? '#1E293B' : '#92400E';
      ctx.beginPath();
      ctx.arc(ex, -80, 9.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  } else if (skin === 'frog') {
    [-13, 13].forEach((ex) => {
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(ex, -82, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }
  ctx.restore();
}

function drawChibiPlayer(
  ctx: CanvasRenderingContext2D,
  p: PlayerState,
  state: MatchState,
  mySlot: PlayerSlot | null,
  hostSlot: PlayerSlot | null,
  timeSec: number
): void {
  const heightAboveSand = Math.max(0, GROUND_Y - p.y);
  drawGroundShadow(ctx, p.x, heightAboveSand, 34);

  const isLocal = mySlot === p.slot;
  const isCelebrating =
    (state.phase === 'point_pause' && state.lastScoringTeam === p.team) ||
    (state.phase === 'finished' && state.winner === p.team);
  const isSad =
    (state.phase === 'point_pause' && state.lastScoringTeam !== null && state.lastScoringTeam !== p.team) ||
    (state.phase === 'finished' && state.winner !== null && state.winner !== p.team);

  // Ring indicator on sand under local player for instant visibility in 2v2!
  if (isLocal) {
    ctx.save();
    ctx.strokeStyle = '#FACC15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, GROUND_Y + 5, 38, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  const celebrateBounce = isCelebrating ? Math.abs(Math.sin(timeSec * 11 + p.x * 0.02)) * 18 : 0;
  const walkBob =
    heightAboveSand < 2 && Math.abs(p.vx) > 20 && p.diveTimer <= 0
      ? Math.abs(Math.sin(p.animPhase)) * 5
      : 0;

  ctx.save();
  ctx.translate(p.x, p.y - celebrateBounce - walkBob);

  // Spike electric/fire aura behind player
  if (p.spikeTimer > 0) {
    ctx.save();
    const glowR = 54 + Math.sin(timeSec * 40) * 6;
    const aura = ctx.createRadialGradient(0, -48, 10, 0, -48, glowR);
    aura.addColorStop(0, 'rgba(254, 240, 138, 0.85)');
    aura.addColorStop(0.5, 'rgba(249, 115, 22, 0.5)');
    aura.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = aura;
    ctx.beginPath();
    ctx.arc(0, -48, glowR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Squash & Stretch + Dive rotation
  if (p.diveTimer > 0) {
    ctx.translate(0, -18);
    ctx.rotate(p.diveDir * 1.12);
    ctx.translate(0, 18);
  } else if (heightAboveSand > 8) {
    const stretch = Math.max(0.9, Math.min(1.14, 1 - p.vy * 0.00014));
    ctx.scale(1 / Math.sqrt(stretch), stretch);
  }

  // Ears & Tail
  drawAnimalEarsAndTail(ctx, p.skin, p.color, p.facing, p.animPhase);

  // Stubby Chibi Feet
  const stride =
    heightAboveSand < 2 && Math.abs(p.vx) > 20 ? Math.sin(p.animPhase) * 9 : 0;
  ctx.fillStyle = p.skin === 'panda' ? '#1E293B' : p.color;
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.6;
  [-11 + stride * 0.5, 11 - stride * 0.5].forEach((fx) => {
    ctx.beginPath();
    ctx.ellipse(fx, -6, 9, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });

  // Plump Bouncy Chibi Body + Head Silhouette (classic Pikachu bean shape!)
  ctx.fillStyle = p.color;
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 3;

  // Lower tummy
  ctx.beginPath();
  ctx.ellipse(0, -28, 28, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cute white belly patch
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.beginPath();
  ctx.ellipse(p.facing * 4, -25, 15, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // Big Chibi Head
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.ellipse(0, -58, 29, 25, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Stubby Arms (raise up on jump / spike / celebration!)
  const armsUp = heightAboveSand > 12 || isCelebrating || p.spikeTimer > 0;
  ctx.fillStyle = p.skin === 'panda' ? '#1E293B' : p.color;
  [-25, 25].forEach((ax, idx) => {
    ctx.save();
    ctx.translate(ax, -34);
    const armAngle = armsUp
      ? idx === 0
        ? -2.2
        : 2.2
      : (idx === 0 ? 0.45 : -0.45) + stride * 0.04;
    ctx.rotate(armAngle);
    ctx.beginPath();
    ctx.ellipse(0, 7, 6.5, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  });

  // Team Headband (Blue Team vs Red Team!) with fluttering ribbon tails
  const headbandColor = p.team === 'blue' ? '#2563EB' : '#E11D48';
  const headbandHighlight = p.team === 'blue' ? '#60A5FA' : '#FB7185';
  const flutter = Math.sin(timeSec * 12 + p.x * 0.05) * 4;

  // Ribbon tails behind headband
  ctx.strokeStyle = headbandColor;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-p.facing * 24, -67);
  ctx.quadraticCurveTo(-p.facing * 36, -69 + flutter, -p.facing * 44, -61 + flutter);
  ctx.moveTo(-p.facing * 24, -65);
  ctx.quadraticCurveTo(-p.facing * 34, -59 - flutter, -p.facing * 41, -52 - flutter);
  ctx.stroke();

  // Main headband strap across forehead
  ctx.fillStyle = headbandColor;
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.2;
  drawRoundedRect(ctx, -28, -72, 56, 10, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = headbandHighlight;
  ctx.fillRect(-18, -70, 36, 3);

  // Face details shifted slightly toward facing direction
  const faceX = p.facing * 6;

  // Panda eye patches
  if (p.skin === 'panda') {
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(faceX - 9, -54, 6, 7, -0.2, 0, Math.PI * 2);
    ctx.ellipse(faceX + 9, -54, 6, 7, 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Rosy / Electric Cheeks
  ctx.fillStyle = getCheekColor(p.skin);
  ctx.beginPath();
  ctx.ellipse(faceX - 15, -48, 5.5, 4, 0, 0, Math.PI * 2);
  ctx.ellipse(faceX + 15, -48, 5.5, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Expressive Eyes & Mouth
  ctx.strokeStyle = '#0F172A';
  ctx.fillStyle = '#0F172A';
  ctx.lineWidth = 2.4;

  if (isCelebrating) {
    // Happy ^ ^ eyes
    [-9, 9].forEach((ex) => {
      ctx.beginPath();
      ctx.arc(faceX + ex, -53, 5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    });
    // Big cheerful open smile
    ctx.fillStyle = '#F43F5E';
    ctx.beginPath();
    ctx.arc(faceX, -47, 5.5, 0, Math.PI);
    ctx.fill();
    ctx.stroke();
  } else if (p.diveTimer > 0 || isSad) {
    // > < effort / ouch eyes
    ctx.beginPath();
    ctx.moveTo(faceX - 12, -57);
    ctx.lineTo(faceX - 6, -54);
    ctx.lineTo(faceX - 12, -51);
    ctx.moveTo(faceX + 12, -57);
    ctx.lineTo(faceX + 6, -54);
    ctx.lineTo(faceX + 12, -51);
    ctx.stroke();

    // Sweat drop if opponent scored
    if (isSad) {
      ctx.fillStyle = '#38BDF8';
      ctx.beginPath();
      ctx.ellipse(faceX + 19, -60, 3.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Cute shiny eyes
    [-9, 9].forEach((ex) => {
      ctx.fillStyle = p.skin === 'panda' ? '#FFFFFF' : '#0F172A';
      ctx.beginPath();
      ctx.arc(faceX + ex, -54, 4.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.skin === 'panda' ? '#0F172A' : '#FFFFFF';
      ctx.beginPath();
      ctx.arc(faceX + ex + 1.3, -55.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    });

    // Determined eyebrows when spiking!
    if (p.spikeTimer > 0) {
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(faceX - 13, -61);
      ctx.lineTo(faceX - 5, -58);
      ctx.moveTo(faceX + 13, -61);
      ctx.lineTo(faceX + 5, -58);
      ctx.stroke();
    }

    // Cute :3 cat/pikachu mouth
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(faceX - 3, -47, 3, 0.1, Math.PI - 0.1);
    ctx.arc(faceX + 3, -47, 3, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  ctx.restore();

  // Floating Name Tag Pill above character's head (does NOT tilt when diving!)
  ctx.save();
  const labelY = p.y - celebrateBounce - 108;
  const hostPrefix = hostSlot === p.slot ? '👑 ' : '';
  const displayName =
    p.name.length > 12 ? `${p.name.slice(0, 11)}…` : p.name;
  const labelText = `${hostPrefix}${p.slot} • ${displayName}`;

  ctx.font = '700 12px "Prompt", "Kanit", sans-serif';
  const textW = ctx.measureText(labelText).width;
  const pillW = textW + 16;
  const pillH = 21;
  const pillX = p.x - pillW / 2;
  const pillY = labelY - pillH / 2;

  ctx.fillStyle =
    p.team === 'blue' ? 'rgba(30, 58, 138, 0.88)' : 'rgba(136, 19, 55, 0.88)';
  ctx.strokeStyle = isLocal ? '#FACC15' : p.team === 'blue' ? '#60A5FA' : '#FDA4AF';
  ctx.lineWidth = isLocal ? 2.4 : 1.5;
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(labelText, p.x, labelY + 0.5);

  if (isCelebrating) {
    ctx.font = '700 16px sans-serif';
    ctx.fillText('✨🎉✨', p.x, pillY - 11);
  }
  ctx.restore();
}

function drawVolleyball(
  ctx: CanvasRenderingContext2D,
  ball: BallState,
  fx: CanvasFxState,
  timeSec: number
): void {
  const heightAboveSand = Math.max(0, GROUND_Y - (ball.y + BALL_RADIUS));
  drawGroundShadow(ctx, ball.x, heightAboveSand, BALL_RADIUS * 1.15);

  // Off-screen / high-ball marker near top edge
  if (ball.y < 42) {
    ctx.save();
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ball.x, 8);
    ctx.lineTo(ball.x - 9, 22);
    ctx.lineTo(ball.x + 9, 22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Power Spike Comet Afterimages!
  for (let i = fx.trail.length - 1; i >= 0; i--) {
    const tr = fx.trail[i];
    const ratio = (fx.trail.length - i) / fx.trail.length;
    ctx.save();
    ctx.fillStyle =
      i % 2 === 0
        ? `rgba(239, 68, 68, ${(tr.alpha * 0.52 * ratio).toFixed(3)})`
        : `rgba(250, 204, 21, ${(tr.alpha * 0.52 * ratio).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, tr.radius * (0.45 + 0.5 * ratio), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(ball.x, ball.y);

  // Outer Fire Aura when Power Spiked!
  if (ball.isSpiked) {
    const pulse = BALL_RADIUS * (1.52 + Math.sin(timeSec * 36) * 0.14);
    const fireGrad = ctx.createRadialGradient(0, 0, BALL_RADIUS * 0.5, 0, 0, pulse);
    fireGrad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
    fireGrad.addColorStop(0.55, 'rgba(239, 68, 68, 0.78)');
    fireGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    ctx.fillStyle = fireGrad;
    ctx.beginPath();
    ctx.arc(0, 0, pulse, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.rotate(ball.rotation);

  // Clip circle for crisp volleyball stripes
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();

  ctx.fillStyle = ball.isSpiked ? '#FCA5A5' : '#FFFFFF';
  ctx.fillRect(-BALL_RADIUS, -BALL_RADIUS, BALL_RADIUS * 2, BALL_RADIUS * 2);

  // Classic colorful beach/Pikachu volleyball curved bands
  ctx.fillStyle = ball.isSpiked ? '#EF4444' : '#3B82F6';
  ctx.beginPath();
  ctx.arc(-BALL_RADIUS * 0.65, 0, BALL_RADIUS * 0.95, -1.2, 1.2);
  ctx.lineTo(-BALL_RADIUS, BALL_RADIUS);
  ctx.lineTo(-BALL_RADIUS, -BALL_RADIUS);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ball.isSpiked ? '#F97316' : '#FACC15';
  ctx.beginPath();
  ctx.arc(BALL_RADIUS * 0.65, 0, BALL_RADIUS * 0.95, Math.PI - 1.2, Math.PI + 1.2);
  ctx.lineTo(BALL_RADIUS, -BALL_RADIUS);
  ctx.lineTo(BALL_RADIUS, BALL_RADIUS);
  ctx.closePath();
  ctx.fill();

  // Seam lines
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, -BALL_RADIUS);
  ctx.lineTo(0, BALL_RADIUS);
  ctx.stroke();

  // Specular highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.beginPath();
  ctx.ellipse(-9, -10, 9, 5, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Crisp outer ball outline
  ctx.strokeStyle = ball.isSpiked ? '#B91C1C' : '#0F172A';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D, fx: CanvasFxState): void {
  for (const pt of fx.particles) {
    const alpha = Math.max(0, pt.life / pt.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawServeIndicator(ctx: CanvasRenderingContext2D, state: MatchState, timeSec: number): void {
  if (state.phase !== 'serve_wait') return;
  const bounce = Math.sin(timeSec * 8) * 5;
  ctx.save();
  ctx.font = '800 15px "Kanit", "Prompt", sans-serif';
  ctx.textAlign = 'center';
  const label = state.servingTeam === 'blue' ? '🔵 ทีมฟ้าเตรียมเสิร์ฟ!' : '🔴 ทีมแดงเตรียมเสิร์ฟ!';
  const bx = state.ball.x;
  const by = state.ball.y - 54 + bounce;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  drawRoundedRect(ctx, bx - 84, by - 15, 168, 28, 14);
  ctx.fill();
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#FEF08A';
  ctx.fillText(label, bx, by + 4);
  ctx.restore();
}

/**
 * Main entry point to render a single 60 FPS frame onto the 1100 x 600 HTML5 Canvas.
 */
export function renderVolleyballCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  state: MatchState,
  fx: CanvasFxState,
  opts: {
    mySlot: PlayerSlot | null;
    hostSlot: PlayerSlot | null;
    timeSec: number;
  }
): void {
  // Maintain crisp HiDPI backing store at exact 1100:600 aspect ratio
  const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const targetW = Math.round(COURT_WIDTH * dpr);
  const targetH = Math.round(COURT_HEIGHT * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }

  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Screen shake offset on Power Spike / Point impact
  if (state.screenShake > 0.02) {
    const mag = state.screenShake * 7;
    ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
  }

  drawBeachBackground(ctx, opts.timeSec);
  drawCenterNet(ctx);

  // Draw back-row players slightly before front-row players for natural 2v2 layering
  const renderOrder: PlayerSlot[] = ['P2', 'P4', 'P1', 'P3'];
  for (const slot of renderOrder) {
    const pl = state.players.find((p) => p.slot === slot);
    if (pl) {
      drawChibiPlayer(ctx, pl, state, opts.mySlot, opts.hostSlot, opts.timeSec);
    }
  }

  drawParticles(ctx, fx);
  drawVolleyball(ctx, state.ball, fx, opts.timeSec);
  drawServeIndicator(ctx, state, opts.timeSec);

  ctx.restore();
}
