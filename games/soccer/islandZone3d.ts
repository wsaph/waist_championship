import * as THREE from 'three';
import { disposeObject3D } from '@/lib/device_perf';
import { createIslandActorShowcaseController } from '../islandActorShowcase3d';
import type { GameIslandZoneContext, GameIslandZoneInstance } from '../types';

export function createSoccerIslandZone(
  ctx: GameIslandZoneContext
): GameIslandZoneInstance {
  const rawPitchZ = 10.5;
  const penaltyPitchPos = new THREE.Vector3(
    ctx.sportsPlazaX,
    0.08,
    Math.max(-(ctx.islandD / 2 - 6.2), Math.min(ctx.islandD / 2 - 6.2, rawPitchZ))
  );
  const penaltyPitchGroup = new THREE.Group();
  penaltyPitchGroup.position.copy(penaltyPitchPos);

  // Frosted snow apron border matching Volleyball's 13.6 × 8.6 stadium footprint
  const snowApron = new THREE.Mesh(
    new THREE.BoxGeometry(14.1, 0.08, 9.1),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.78 })
  );
  snowApron.position.y = 0.04;
  snowApron.receiveShadow = true;
  penaltyPitchGroup.add(snowApron);

  // Full symmetrical stadium turf pad (13.6 × 8.6)
  const penTurf = new THREE.Mesh(
    new THREE.BoxGeometry(13.6, 0.14, 8.6),
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.78 })
  );
  penTurf.position.y = 0.07;
  penTurf.receiveShadow = true;
  penaltyPitchGroup.add(penTurf);

  // Alternating mowed stadium grass stripes across the 11.8 × 7.4 playing field
  const stripeLightMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.22,
  });
  for (let s = 0; s < 8; s++) {
    if (s % 2 === 0) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.46, 7.36), stripeLightMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(-5.12 + s * 1.463, 0.146, 0);
      penaltyPitchGroup.add(stripe);
    }
  }

  // Crisp straight white pitch markings (zero non-uniform RingGeometry skew!)
  const penLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-3.7, 3.7].forEach((sz) => {
    const touchline = new THREE.Mesh(new THREE.BoxGeometry(11.92, 0.035, 0.12), penLineMat);
    touchline.position.set(0, 0.155, sz);
    penaltyPitchGroup.add(touchline);
  });
  [-5.9, 0, 5.9].forEach((gx) => {
    const endOrHalfLine = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.035, 7.52), penLineMat);
    endOrHalfLine.position.set(gx, 0.155, 0);
    penaltyPitchGroup.add(endOrHalfLine);
  });

  // Symmetrical Center Circle & Center Kickoff Spot
  const centerCircle = new THREE.Mesh(
    new THREE.RingGeometry(1.08, 1.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  centerCircle.rotation.x = -Math.PI / 2;
  centerCircle.position.set(0, 0.155, 0);
  const centerSpot = new THREE.Mesh(new THREE.CircleGeometry(0.15, 16), penLineMat);
  centerSpot.rotation.x = -Math.PI / 2;
  centerSpot.position.set(0, 0.156, 0);
  penaltyPitchGroup.add(centerCircle, centerSpot);

  // Netting CanvasTexture shared by both West & East goals
  let netTex: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const gCtx = c.getContext('2d');
    if (gCtx) {
      gCtx.strokeStyle = 'rgba(255,255,255,0.88)';
      gCtx.lineWidth = 3;
      for (let x = 0; x <= 128; x += 16) {
        gCtx.beginPath();
        gCtx.moveTo(x, 0);
        gCtx.lineTo(x, 64);
        gCtx.stroke();
      }
      for (let y = 0; y <= 64; y += 16) {
        gCtx.beginPath();
        gCtx.moveTo(0, y);
        gCtx.lineTo(128, y);
        gCtx.stroke();
      }
    }
    netTex = new THREE.CanvasTexture(c);
    netTex.wrapS = THREE.RepeatWrapping;
    netTex.wrapT = THREE.RepeatWrapping;
    netTex.repeat.set(3, 1);
  }

  const netMat = new THREE.MeshBasicMaterial({
    ...(netTex ? { map: netTex } : { color: 0xffffff }),
    transparent: true,
    opacity: 0.78,
    side: THREE.DoubleSide,
  });
  const penPostMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 0.2,
    roughness: 0.28,
  });
  const stanchionMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.35,
    roughness: 0.4,
  });

  // Symmetrical Left (West, side = -1) & Right (East, side = +1) Penalty Boxes, D-Arcs & Full 3D Goals
  ([-1, 1] as const).forEach((side) => {
    // 18-yard Penalty Area (depth 2.05, width 4.3)
    const penFrontX = side * (5.9 - 2.05);
    const penFront = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 4.3), penLineMat);
    penFront.position.set(penFrontX, 0.155, 0);
    penaltyPitchGroup.add(penFront);
    [-2.15, 2.15].forEach((pz) => {
      const penSide = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.035, 0.1), penLineMat);
      penSide.position.set(side * (5.9 - 1.025), 0.155, pz);
      penaltyPitchGroup.add(penSide);
    });

    // 6-yard Goal Area (depth 0.82, width 2.5)
    const goalBoxFront = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 2.5), penLineMat);
    goalBoxFront.position.set(side * (5.9 - 0.82), 0.155, 0);
    penaltyPitchGroup.add(goalBoxFront);
    [-1.25, 1.25].forEach((gz) => {
      const goalBoxSide = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.035, 0.09), penLineMat);
      goalBoxSide.position.set(side * (5.9 - 0.41), 0.155, gz);
      penaltyPitchGroup.add(goalBoxSide);
    });

    // Penalty Spot & Symmetrical Penalty D-Arc
    const pSpot = new THREE.Mesh(new THREE.CircleGeometry(0.12, 14), penLineMat);
    pSpot.rotation.x = -Math.PI / 2;
    pSpot.position.set(side * 4.45, 0.156, 0);
    const dArc = new THREE.Mesh(
      new THREE.RingGeometry(
        0.86,
        0.96,
        20,
        1,
        (side < 0 ? 0 : Math.PI) - 0.85,
        1.7
      ),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    dArc.rotation.x = -Math.PI / 2;
    dArc.position.set(side * 4.45, 0.155, 0);
    penaltyPitchGroup.add(pSpot, dArc);

    // Full 3D Goal Frame (x = side * 5.9, depth 0.88 to side * 6.78, width 2.9, height 2.1)
    const goalX = side * 5.9;
    const goalBackX = side * 6.78;
    const goalMidX = side * 6.34;
    [-1.45, 1.45].forEach((gz) => {
      const gPost = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 2.12, 10), penPostMat);
      gPost.position.set(goalX, 1.18, gz);
      gPost.castShadow = true;

      const topRunBack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.88, 8),
        stanchionMat
      );
      topRunBack.rotation.z = Math.PI / 2;
      topRunBack.position.set(goalMidX, 2.2, gz);

      const bottomRunBack = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.88, 8),
        stanchionMat
      );
      bottomRunBack.rotation.z = Math.PI / 2;
      bottomRunBack.position.set(goalMidX, 0.17, gz);

      const backSupport = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 2.06, 8),
        stanchionMat
      );
      backSupport.position.set(goalBackX, 1.18, gz);

      const sideNet = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 2.02), netMat);
      sideNet.position.set(goalMidX, 1.18, gz);

      penaltyPitchGroup.add(gPost, topRunBack, bottomRunBack, backSupport, sideNet);
    });

    const gCrossbar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 3.04, 10),
      penPostMat
    );
    gCrossbar.rotation.x = Math.PI / 2;
    gCrossbar.position.set(goalX, 2.22, 0);
    gCrossbar.castShadow = true;

    const backBottomBar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 2.96, 8),
      stanchionMat
    );
    backBottomBar.rotation.x = Math.PI / 2;
    backBottomBar.position.set(goalBackX, 0.17, 0);

    const gBackNet = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.04), netMat);
    gBackNet.rotation.y = Math.PI / 2;
    gBackNet.position.set(goalBackX, 1.18, 0);

    const gTopNet = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 2.9), netMat);
    gTopNet.rotation.x = -Math.PI / 2;
    gTopNet.position.set(goalMidX, 2.19, 0);

    penaltyPitchGroup.add(gCrossbar, backBottomBar, gBackNet, gTopNet);
  });

  // 4 Corner Flags matching team sides (Blue West / Crimson East)
  (
    [
      [-5.95, -3.75, 0x2563eb],
      [-5.95, 3.75, 0x2563eb],
      [5.95, -3.75, 0xe11d48],
      [5.95, 3.75, 0xe11d48],
    ] as const
  ).forEach(([fx, fz, fCol]) => {
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1.25, 6),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.4 })
    );
    pole.position.set(fx, 0.76, fz);
    const pennant = new THREE.Mesh(
      new THREE.ConeGeometry(0.2, 0.48, 3),
      new THREE.MeshStandardMaterial({ color: fCol, roughness: 0.5 })
    );
    pennant.rotation.z = fx < 0 ? Math.PI / 2 : -Math.PI / 2;
    pennant.position.set(fx + (fx < 0 ? -0.22 : 0.22), 1.24, fz);
    penaltyPitchGroup.add(pole, pennant);
  });

  const penBallMascot = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 16, 14),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 })
  );
  penBallMascot.position.set(0, 0.62, 0);
  penBallMascot.castShadow = true;
  penaltyPitchGroup.add(penBallMascot);

  const actorShowcase = createIslandActorShowcaseController(
    penaltyPitchGroup,
    ctx.labelsContainer
  );
  ctx.scene.add(penaltyPitchGroup);

  const penaltyTagEl = document.createElement('div');
  penaltyTagEl.className = 'player-tag cursor-pointer';
  penaltyTagEl.onclick = () => {
    ctx.focusCamera(
      new THREE.Vector3(penaltyPitchPos.x, 1.6, penaltyPitchPos.z),
      new THREE.Vector3(penaltyPitchPos.x, 8.2, penaltyPitchPos.z + 13.5)
    );
    const liveFb = ctx.getLiveLobby('soccer');
    if (ctx.isNearZone('soccer') || liveFb?.status === 'started') {
      ctx.openGame({
        gameId: 'soccer',
        roomCode: '6666',
        mode: liveFb?.mode,
        isHost: false,
      });
    } else if (ctx.getWalkingSpectatorId() !== null) {
      ctx.walkSpectatorTo(new THREE.Vector3(penaltyPitchPos.x - 2.4, 0.2, penaltyPitchPos.z + 1.8));
    }
  };
  ctx.labelsContainer.appendChild(penaltyTagEl);

  let renderedTagSig = '';
  const tempProj = new THREE.Vector3();

  return {
    gameId: 'soccer',
    group: penaltyPitchGroup,
    position: penaltyPitchPos,
    proximityRadius: 6.8,
    update: ({ elapsed, delta, camera, viewportWidth, viewportHeight }) => {
      const liveFb = ctx.getLiveLobby('soccer');
      const isPenaltyMode = liveFb?.mode === 'penalty';

      actorShowcase.syncRoster(
        liveFb?.roster,
        liveFb ? `${liveFb.status}|${liveFb.mode || ''}` : '',
        ctx.getPlayers(),
        (slotEntry, idx) => {
          const isLeftTeam = slotEntry.team
            ? slotEntry.team === 'left'
            : slotEntry.slotId.startsWith('B') || slotEntry.slotId.startsWith('L') || idx % 2 === 0;
          if (isPenaltyMode) {
            return {
              x: isLeftTeam ? 2.85 : 5.35,
              y: 0.15,
              z: idx >= 2 ? (idx % 2 === 0 ? -1.2 : 1.2) : 0,
              rotY: isLeftTeam ? 0 : Math.PI,
              scale: 0.82,
            };
          }
          const parsedSlotNum = Number(slotEntry.slotId.replace(/\D/g, ''));
          const teamRank =
            parsedSlotNum >= 1 && parsedSlotNum <= 3
              ? parsedSlotNum - 1
              : Math.min(2, Math.floor(idx / 2));
          const x = isLeftTeam
            ? teamRank === 0
              ? -1.85
              : teamRank === 1
                ? -3.55
                : -4.85
            : teamRank === 0
              ? 1.85
              : teamRank === 1
                ? 3.55
                : 4.85;
          const z = teamRank === 0 ? 0 : teamRank === 1 ? -1.65 : 1.65;
          return {
            x,
            y: 0.15,
            z,
            rotY: isLeftTeam ? 0 : Math.PI,
            scale: 0.82,
          };
        }
      );

      const nextTagSig = liveFb
        ? `${liveFb.status}|${liveFb.mode || ''}|${liveFb.count}|${liveFb.max}|${liveFb.scoreLeft ?? 0}|${liveFb.scoreRight ?? 0}`
        : 'idle';
      if (nextTagSig !== renderedTagSig) {
        renderedTagSig = nextTagSig;
        if (liveFb?.status === 'started') {
          const modeLbl = liveFb.mode === 'penalty' ? 'ดวลจุดโทษ' : 'โกลหนู 3v3';
          penaltyTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 text-white border-2 border-amber-200 rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🔒 สนามบอลกำลังแข่ง ${modeLbl} (${liveFb.scoreLeft ?? 0} : ${liveFb.scoreRight ?? 0}) • คลิกดูผู้เล่น!
            </div>
          `;
        } else if (liveFb?.status === 'waiting') {
          penaltyTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-emerald-300 via-lime-200 to-amber-300 text-slate-950 border-2 border-white rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🟢 ห้องรอฟุตบอลโกลหนู (${liveFb.count}/${liveFb.max} คน) • เดินเข้าสนามเพื่อร่วมแมตช์!
            </div>
          `;
        } else {
          penaltyTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-emerald-400 via-green-300 to-amber-300 text-slate-950 border-2 border-white rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              ⚽🏟️ สนามฟุตบอลโกลหนู 3v3 (สูงสุด 6 คน!) &amp; ดวลจุดโทษ!
            </div>
          `;
        }
      }

      const actors = actorShowcase.getActors();
      if (liveFb?.status === 'started') {
        if (isPenaltyMode) {
          const kickPhase = (elapsed * 1.9) % 1;
          penBallMascot.position.set(
            2.65 + kickPhase * 3.1,
            0.55 + Math.sin(kickPhase * Math.PI) * 1.05,
            Math.sin(elapsed * 2.2) * 0.75
          );
          penBallMascot.rotation.z = -elapsed * 5.5;
        } else {
          const passSin = Math.sin(elapsed * 2.1);
          penBallMascot.position.set(
            passSin * 4.6,
            0.58 + Math.abs(Math.cos(elapsed * 4.2)) * 0.95,
            Math.sin(elapsed * 1.5) * 1.7
          );
          penBallMascot.rotation.z = -passSin * 4.5;
          penBallMascot.rotation.y = elapsed * 2.4;
        }
        actors.forEach((act, ai) => {
          const hop = Math.abs(Math.sin(elapsed * 5.8 + ai * 1.5)) * 0.32;
          act.root.position.set(act.baseX, act.baseY + hop, act.baseZ);
          act.charParts.mixer?.update(delta);
        });
      } else {
        penBallMascot.position.set(0, 0.62 + Math.abs(Math.sin(elapsed * 3.1)) * 0.28, 0);
        penBallMascot.rotation.y = elapsed * 1.5;
        actors.forEach((act, ai) => {
          const hop = Math.abs(Math.sin(elapsed * 4.0 + ai)) * 0.12;
          act.root.position.set(act.baseX, act.baseY + hop, act.baseZ);
          act.charParts.mixer?.update(delta);
        });
      }

      tempProj.set(penaltyPitchPos.x, penaltyPitchPos.y + 3.6, penaltyPitchPos.z);
      tempProj.project(camera);
      if (tempProj.z < 1) {
        penaltyTagEl.style.setProperty(
          '--tag-x',
          `${((tempProj.x * 0.5 + 0.5) * viewportWidth).toFixed(1)}px`
        );
        penaltyTagEl.style.setProperty(
          '--tag-y',
          `${((-tempProj.y * 0.5 + 0.5) * viewportHeight).toFixed(1)}px`
        );
        penaltyTagEl.style.opacity = '1';
      } else {
        penaltyTagEl.style.opacity = '0';
      }

      actorShowcase.projectLabels(penaltyPitchPos, camera, viewportWidth, viewportHeight, 2.2);
    },
    dispose: () => {
      actorShowcase.dispose();
      penaltyTagEl.remove();
      ctx.scene.remove(penaltyPitchGroup);
      disposeObject3D(penaltyPitchGroup);
    },
  };
}
