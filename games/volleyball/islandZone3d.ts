import * as THREE from 'three';
import { disposeObject3D } from '@/lib/device_perf';
import { createIslandActorShowcaseController } from '../islandActorShowcase3d';
import type { GameIslandZoneContext, GameIslandZoneInstance } from '../types';

export function createVolleyballIslandZone(
  ctx: GameIslandZoneContext
): GameIslandZoneInstance {
  const rawVbZ = -10.5;
  const vbCourtPos = new THREE.Vector3(
    ctx.sportsPlazaX,
    0.08,
    Math.max(-(ctx.islandD / 2 - 6.2), Math.min(ctx.islandD / 2 - 6.2, rawVbZ))
  );
  const vbCourtGroup = new THREE.Group();
  vbCourtGroup.position.copy(vbCourtPos);

  const vbSandPad = new THREE.Mesh(
    new THREE.BoxGeometry(13.6, 0.14, 8.6),
    new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.75 })
  );
  vbSandPad.position.y = 0.07;
  vbSandPad.receiveShadow = true;
  vbCourtGroup.add(vbSandPad);

  const vbBlueHalf = new THREE.Mesh(
    new THREE.PlaneGeometry(5.95, 7.3),
    new THREE.MeshBasicMaterial({ color: 0x1d4ed8, transparent: true, opacity: 0.32 })
  );
  vbBlueHalf.rotation.x = -Math.PI / 2;
  vbBlueHalf.position.set(-3.05, 0.15, 0);
  const vbRedHalf = new THREE.Mesh(
    new THREE.PlaneGeometry(5.95, 7.3),
    new THREE.MeshBasicMaterial({ color: 0xe11d48, transparent: true, opacity: 0.32 })
  );
  vbRedHalf.rotation.x = -Math.PI / 2;
  vbRedHalf.position.set(3.05, 0.15, 0);
  vbCourtGroup.add(vbBlueHalf, vbRedHalf);

  const vbLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  [-3.72, 3.72].forEach((lz) => {
    const longLine = new THREE.Mesh(new THREE.BoxGeometry(12.2, 0.04, 0.16), vbLineMat);
    longLine.position.set(0, 0.155, lz);
    vbCourtGroup.add(longLine);
  });
  [-6.05, 0, 6.05].forEach((lx) => {
    const shortLine = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 7.6), vbLineMat);
    shortLine.position.set(lx, 0.155, 0);
    vbCourtGroup.add(shortLine);
  });

  (
    [
      [-6.1, -3.8, 0x2563eb],
      [-6.1, 3.8, 0x2563eb],
      [6.1, -3.8, 0xe11d48],
      [6.1, 3.8, 0xe11d48],
    ] as const
  ).forEach(([fx, fz, fCol]) => {
    const fPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.55, 6),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    fPole.position.set(fx, 0.9, fz);
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.24, 0.62, 3),
      new THREE.MeshStandardMaterial({ color: fCol, roughness: 0.5 })
    );
    flag.rotation.z = fx < 0 ? Math.PI / 2 : -Math.PI / 2;
    flag.position.set(fx + (fx < 0 ? -0.28 : 0.28), 1.48, fz);
    vbCourtGroup.add(fPole, flag);
  });

  const vbPostMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.25,
    roughness: 0.35,
  });
  [-4.1, 4.1].forEach((pz) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.75, 10), vbPostMat);
    post.position.set(0, 1.5, pz);
    post.castShadow = true;
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.65, 6),
      new THREE.MeshStandardMaterial({ color: 0xef4444 })
    );
    antenna.position.set(0, 3.05, pz * 0.9);
    vbCourtGroup.add(post, antenna);
  });

  const vbTopTape = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.16, 8.3),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.25,
    })
  );
  vbTopTape.position.set(0, 2.72, 0);
  vbCourtGroup.add(vbTopTape);

  let vbNetTex: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined') {
    const vbNetCanvas = document.createElement('canvas');
    vbNetCanvas.width = 128;
    vbNetCanvas.height = 64;
    const vnCtx = vbNetCanvas.getContext('2d');
    if (vnCtx) {
      vnCtx.clearRect(0, 0, 128, 64);
      vnCtx.strokeStyle = 'rgba(255,255,255,0.88)';
      vnCtx.lineWidth = 3;
      for (let nx = 0; nx <= 128; nx += 16) {
        vnCtx.beginPath();
        vnCtx.moveTo(nx, 0);
        vnCtx.lineTo(nx, 64);
        vnCtx.stroke();
      }
      for (let ny = 0; ny <= 64; ny += 16) {
        vnCtx.beginPath();
        vnCtx.moveTo(0, ny);
        vnCtx.lineTo(128, ny);
        vnCtx.stroke();
      }
    }
    vbNetTex = new THREE.CanvasTexture(vbNetCanvas);
    vbNetTex.wrapS = THREE.RepeatWrapping;
    vbNetTex.wrapT = THREE.RepeatWrapping;
    vbNetTex.repeat.set(4, 1);
  }

  const vbNetPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(8.1, 1.55),
    new THREE.MeshBasicMaterial({
      ...(vbNetTex ? { map: vbNetTex } : { color: 0xffffff, opacity: 0.45 }),
      transparent: true,
      side: THREE.DoubleSide,
    })
  );
  vbNetPlane.rotation.y = Math.PI / 2;
  vbNetPlane.position.set(0, 1.88, 0);
  vbCourtGroup.add(vbNetPlane);

  const refChair = new THREE.Group();
  const chairWoodMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  (
    [
      [-0.35, -0.35],
      [0.35, -0.35],
      [-0.35, 0.35],
      [0.35, 0.35],
    ] as const
  ).forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.2, 6), chairWoodMat);
    leg.position.set(lx, 1.1, lz);
    refChair.add(leg);
  });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.85), chairWoodMat);
  seat.position.y = 2.2;
  const canopy = new THREE.Mesh(
    new THREE.ConeGeometry(0.95, 0.55, 4),
    new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.5 })
  );
  canopy.rotation.y = Math.PI / 4;
  canopy.position.y = 3.35;
  refChair.add(seat, canopy);
  refChair.position.set(0, 0.12, -4.85);
  vbCourtGroup.add(refChair);

  let vbBallTex: THREE.CanvasTexture | null = null;
  if (typeof document !== 'undefined') {
    const vbBallCanvas = document.createElement('canvas');
    vbBallCanvas.width = 128;
    vbBallCanvas.height = 64;
    const vbcCtx = vbBallCanvas.getContext('2d');
    if (vbcCtx) {
      const cols = ['#ffffff', '#facc15', '#38bdf8', '#f43f5e', '#ffffff', '#facc15'];
      const sw = 128 / cols.length;
      cols.forEach((cHex, ci) => {
        vbcCtx.fillStyle = cHex;
        vbcCtx.fillRect(ci * sw, 0, sw + 1, 64);
      });
    }
    vbBallTex = new THREE.CanvasTexture(vbBallCanvas);
    vbBallTex.colorSpace = THREE.SRGBColorSpace;
  }

  const vbMascotBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.72, 20, 16),
    new THREE.MeshStandardMaterial({
      ...(vbBallTex ? { map: vbBallTex } : { color: 0xfacc15 }),
      roughness: 0.3,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.18,
    })
  );
  vbMascotBall.position.set(0, 3.85, 0);
  vbMascotBall.castShadow = true;
  vbCourtGroup.add(vbMascotBall);

  const actorShowcase = createIslandActorShowcaseController(
    vbCourtGroup,
    ctx.labelsContainer
  );
  ctx.scene.add(vbCourtGroup);

  const vbCourtTagEl = document.createElement('div');
  vbCourtTagEl.className = 'player-tag cursor-pointer';
  vbCourtTagEl.onclick = () => {
    ctx.focusCamera(
      new THREE.Vector3(vbCourtPos.x, 1.8, vbCourtPos.z),
      new THREE.Vector3(vbCourtPos.x, 8.2, vbCourtPos.z + 13.5)
    );
    const liveVb = ctx.getLiveLobby('volleyball');
    if (ctx.isNearZone('volleyball') || liveVb?.status === 'started') {
      ctx.openGame({
        gameId: 'volleyball',
        roomCode: '7777',
        mode: liveVb?.mode || '2v2',
        isHost: false,
      });
    } else if (ctx.getWalkingSpectatorId() !== null) {
      ctx.walkSpectatorTo(new THREE.Vector3(vbCourtPos.x - 2.2, 0.2, vbCourtPos.z + 1.5));
    }
  };
  ctx.labelsContainer.appendChild(vbCourtTagEl);

  let renderedTagSig = '';
  const tempProj = new THREE.Vector3();

  return {
    gameId: 'volleyball',
    group: vbCourtGroup,
    position: vbCourtPos,
    proximityRadius: 6.8,
    update: ({ elapsed, delta, camera, viewportWidth, viewportHeight }) => {
      const liveVb = ctx.getLiveLobby('volleyball');
      const is2v2 = (liveVb?.mode || '2v2') === '2v2';

      actorShowcase.syncRoster(
        liveVb?.roster,
        liveVb ? `${liveVb.status}|${liveVb.mode || '2v2'}` : '',
        ctx.getPlayers(),
        (slotEntry) => {
          const team = slotEntry.slotId.startsWith('L') ? 'left' : 'right';
          const x =
            slotEntry.slotId === 'L1'
              ? is2v2
                ? -2.35
                : -2.85
              : slotEntry.slotId === 'L2'
                ? -4.15
                : slotEntry.slotId === 'R1'
                  ? is2v2
                    ? 2.35
                    : 2.85
                  : 4.15;
          const z = !is2v2 ? 0 : slotEntry.slotId.endsWith('1') ? -1.35 : 1.35;
          return {
            x,
            y: 0.15,
            z,
            rotY: team === 'left' ? 0 : Math.PI,
            scale: 0.84,
          };
        }
      );

      const nextTagSig = liveVb
        ? `${liveVb.status}|${liveVb.mode}|${liveVb.count}|${liveVb.max}|${liveVb.scoreLeft ?? 0}|${liveVb.scoreRight ?? 0}`
        : 'idle';
      if (nextTagSig !== renderedTagSig) {
        renderedTagSig = nextTagSig;
        if (liveVb?.status === 'started') {
          vbCourtTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 text-white border-2 border-amber-200 rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🔒 กำลังแข่ง ${(liveVb.mode || '2v2').toUpperCase()} (${liveVb.scoreLeft ?? 0} : ${liveVb.scoreRight ?? 0}) • ล็อกทีละ 1 รอบ (คลิกดูผู้เล่นในสนาม!)
            </div>
          `;
        } else if (liveVb?.status === 'waiting') {
          vbCourtTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-emerald-300 via-amber-200 to-cyan-300 text-slate-950 border-2 border-white rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🟢 ห้องรอวอลเลย์บอล ${(liveVb.mode || '2v2').toUpperCase()} (${liveVb.count}/${liveVb.max} คน) • เดินเข้าคอร์ทเพื่อร่วมตี้!
            </div>
          `;
        } else {
          vbCourtTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-sky-300 via-cyan-200 to-blue-400 text-slate-950 border-2 border-white rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🏐❄️ สนามวอลเลย์บอลหิมะฮอกไกโด (เดินเข้าคอร์ทเพื่อเข้าห้องรอ 1v1 / 2v2!)
            </div>
          `;
        }
      }

      const actors = actorShowcase.getActors();
      if (liveVb?.status === 'started') {
        const rallyPhase = elapsed * 2.6;
        const rallySin = Math.sin(rallyPhase);
        vbMascotBall.position.set(
          rallySin * 3.35,
          1.85 + Math.abs(Math.cos(rallyPhase)) * 2.25,
          Math.sin(elapsed * 1.35) * 1.15
        );
        vbMascotBall.rotation.y = elapsed * 3.2;
        vbMascotBall.rotation.z = -rallySin * 2.4;

        actors.forEach((act, ai) => {
          const ballTowardMe = act.team === 'left' ? rallySin < -0.55 : rallySin > 0.55;
          const jumpY = ballTowardMe
            ? Math.abs(Math.sin(elapsed * 7.5 + ai)) * 0.72
            : Math.abs(Math.sin(elapsed * 3.8 + ai)) * 0.08;
          const swayX = Math.sin(elapsed * 2.8 + ai * 1.4) * 0.28;
          act.root.position.set(act.baseX + swayX, act.baseY + jumpY, act.baseZ);
          act.charParts.mixer?.update(delta);
          if (!act.charParts.mixer) {
            act.charParts.armL.rotation.z = ballTowardMe ? 2.4 : 0.35;
            act.charParts.armR.rotation.z = ballTowardMe ? 2.4 : -0.35;
          }
        });
      } else {
        vbMascotBall.position.set(0, 3.85 + Math.sin(elapsed * 2.8) * 0.32, 0);
        vbMascotBall.rotation.y = elapsed * 1.4;
        vbMascotBall.rotation.z = elapsed * 0.7;

        actors.forEach((act, ai) => {
          const hop = Math.abs(Math.sin(elapsed * 4.2 + ai * 1.3)) * 0.14;
          act.root.position.set(act.baseX, act.baseY + hop, act.baseZ);
          act.charParts.mixer?.update(delta);
        });
      }

      tempProj.set(vbCourtPos.x, vbCourtPos.y + 5.1, vbCourtPos.z);
      tempProj.project(camera);
      if (tempProj.z < 1) {
        vbCourtTagEl.style.setProperty(
          '--tag-x',
          `${((tempProj.x * 0.5 + 0.5) * viewportWidth).toFixed(1)}px`
        );
        vbCourtTagEl.style.setProperty(
          '--tag-y',
          `${((-tempProj.y * 0.5 + 0.5) * viewportHeight).toFixed(1)}px`
        );
        vbCourtTagEl.style.opacity = '1';
      } else {
        vbCourtTagEl.style.opacity = '0';
      }

      actorShowcase.projectLabels(vbCourtPos, camera, viewportWidth, viewportHeight, 2.25);
    },
    dispose: () => {
      actorShowcase.dispose();
      vbCourtTagEl.remove();
      ctx.scene.remove(vbCourtGroup);
      disposeObject3D(vbCourtGroup);
    },
  };
}
