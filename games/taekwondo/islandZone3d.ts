import * as THREE from 'three';
import { disposeObject3D } from '@/lib/device_perf';
import { createIslandActorShowcaseController } from '../islandActorShowcase3d';
import type { GameIslandZoneContext, GameIslandZoneInstance } from '../types';

export function createTaekwondoIslandZone(
  ctx: GameIslandZoneContext
): GameIslandZoneInstance {
  const rawDojangZ = 10.5;
  const backPlazaX = ctx.sportsPlazaBackX ?? ctx.sportsPlazaX + 16.8;
  const dojangPos = new THREE.Vector3(
    Math.min(ctx.islandCenterX + ctx.islandW / 2 - 5.2, backPlazaX),
    0.2,
    Math.max(-(ctx.islandD / 2 - 5.2), Math.min(ctx.islandD / 2 - 5.2, rawDojangZ))
  );
  const dojangGroup = new THREE.Group();
  dojangGroup.position.copy(dojangPos);
  dojangGroup.rotation.y = -Math.PI * 0.42; // หันหน้าเบาะประลองและตราแทกึกเข้าหาลานกลางและมุมกล้องหลัก (ซ่อนผนังด้านหลังไว้ฝั่งขวาสุด)

  const roofSnowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
  const dojangDeck = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 0.24, 5.0),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
  );
  dojangDeck.position.y = 0.12;
  dojangDeck.receiveShadow = true;
  dojangGroup.add(dojangDeck);

  const matBlue = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 0.08, 4.0),
    new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.7 })
  );
  matBlue.position.set(0, 0.28, 0);
  matBlue.receiveShadow = true;
  const matRed = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.09, 2.4),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7 })
  );
  matRed.position.set(0, 0.285, 0);
  dojangGroup.add(matBlue, matRed);

  const dojangBackWall = new THREE.Mesh(
    new THREE.BoxGeometry(4.6, 2.6, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 })
  );
  dojangBackWall.position.set(0, 1.54, -1.9);
  dojangBackWall.castShadow = true;
  dojangBackWall.receiveShadow = true;
  dojangGroup.add(dojangBackWall);

  const pillarMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 });
  const tkdPillarCoords: [number, number][] = [
    [-2.25, -1.85],
    [2.25, -1.85],
    [-2.25, 1.85],
    [2.25, 1.85],
  ];
  for (const [px, pz] of tkdPillarCoords) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.7, 10), pillarMat);
    pillar.position.set(px, 1.58, pz);
    pillar.castShadow = true;
    dojangGroup.add(pillar);
  }

  const dojangRoofBase = new THREE.Mesh(
    new THREE.BoxGeometry(6.1, 0.26, 5.4),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 })
  );
  dojangRoofBase.position.set(0, 2.98, 0);
  dojangRoofBase.castShadow = true;
  const dojangRoofTop = new THREE.Mesh(
    new THREE.ConeGeometry(4.15, 1.45, 4),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.55 })
  );
  dojangRoofTop.rotation.y = Math.PI / 4;
  dojangRoofTop.position.set(0, 3.82, 0);
  dojangRoofTop.castShadow = true;
  const dojangRoofSnow = new THREE.Mesh(new THREE.ConeGeometry(3.96, 0.74, 4), roofSnowMat);
  dojangRoofSnow.rotation.y = Math.PI / 4;
  dojangRoofSnow.position.set(0, 4.22, 0);
  const dojangTrim = new THREE.Mesh(
    new THREE.BoxGeometry(6.2, 0.1, 0.16),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
    })
  );
  dojangTrim.position.set(0, 2.94, 2.72);
  dojangGroup.add(dojangRoofBase, dojangRoofTop, dojangRoofSnow, dojangTrim);

  const crestRed = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, 0.14, 18),
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.35,
    })
  );
  crestRed.rotation.x = Math.PI / 2;
  crestRed.position.set(0, 3.45, 1.95);
  const crestBlue = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.17, 16),
    new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.35,
    })
  );
  crestBlue.rotation.x = Math.PI / 2;
  crestBlue.position.set(0, 3.45, 1.97);
  dojangGroup.add(crestRed, crestBlue);

  const padStand = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.42, 0.32, 12),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 })
  );
  padStand.position.set(1.35, 0.44, 0.95);
  const padBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 1.35, 12),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })
  );
  padBody.position.set(1.35, 1.28, 0.95);
  padBody.castShadow = true;
  const padStripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.255, 0.255, 0.22, 12),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.4,
    })
  );
  padStripe.position.set(1.35, 1.38, 0.95);
  dojangGroup.add(padStand, padBody, padStripe);

  const actorShowcase = createIslandActorShowcaseController(dojangGroup, ctx.labelsContainer);
  ctx.scene.add(dojangGroup);

  const dojangTagEl = document.createElement('div');
  dojangTagEl.className = 'player-tag cursor-pointer';
  dojangTagEl.onclick = () => {
    ctx.focusCamera(
      new THREE.Vector3(dojangPos.x, 1.9, dojangPos.z),
      new THREE.Vector3(dojangPos.x - 6.8, 5.4, dojangPos.z + 6.8)
    );
    const liveTkd = ctx.getLiveLobby('taekwondo');
    if (ctx.isNearZone('taekwondo') || liveTkd?.status === 'started') {
      ctx.openGame({ gameId: 'taekwondo', isHost: false });
    } else if (ctx.getWalkingSpectatorId() !== null) {
      ctx.walkSpectatorTo(new THREE.Vector3(dojangPos.x - 3.4, 0.2, dojangPos.z + 0.9));
    }
  };
  ctx.labelsContainer.appendChild(dojangTagEl);

  let renderedTagSig = '';
  const tempProj = new THREE.Vector3();

  return {
    gameId: 'taekwondo',
    group: dojangGroup,
    position: dojangPos,
    proximityRadius: 5.5,
    update: ({ elapsed, delta, camera, viewportWidth, viewportHeight }) => {
      const liveTkd = ctx.getLiveLobby('taekwondo');

      actorShowcase.syncRoster(
        liveTkd?.roster,
        liveTkd ? `${liveTkd.status}` : '',
        ctx.getPlayers(),
        (slotEntry, idx) => {
          const isLeft = idx === 0 || slotEntry.team === 'left';
          return {
            x: isLeft ? -0.95 : 0.95,
            y: 0.34,
            z: 0,
            rotY: isLeft ? 0 : Math.PI,
            scale: 0.8,
          };
        }
      );

      const nextTagSig = liveTkd
        ? `${liveTkd.status}|${liveTkd.count}|${liveTkd.max}`
        : 'idle';
      if (nextTagSig !== renderedTagSig) {
        renderedTagSig = nextTagSig;
        if (liveTkd?.status === 'started') {
          dojangTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-rose-600 via-amber-500 to-blue-600 text-white border-2 border-amber-200 rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🔒 สำนักเทควันโดกำลังดวล PvP • ซ้อมเตะเป้าเดี่ยวได้ / คลิกดูคู่ดวล!
            </div>
          `;
        } else if (liveTkd?.status === 'waiting') {
          dojangTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-emerald-300 via-amber-200 to-sky-300 text-slate-950 border-2 border-white rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🟢 ห้องรอเทควันโด PvP (${liveTkd.count}/${liveTkd.max}) • เดินเข้าสำนักเพื่อดวล!
            </div>
          `;
        } else {
          dojangTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-red-600 via-amber-400 to-blue-600 text-white border-2 border-white rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🥋 สำนักเทควันโด (เดินเข้ามาเตะเป้าเลื่อนสาย &amp; ดวล PvP!)
            </div>
          `;
        }
      }

      const actors = actorShowcase.getActors();
      actors.forEach((act, ai) => {
        const jump = Math.abs(Math.sin(elapsed * 6.2 + ai * 1.6)) * 0.45;
        act.root.position.set(act.baseX, act.baseY + jump, act.baseZ);
        act.charParts.mixer?.update(delta);
      });

      tempProj.set(dojangPos.x, dojangPos.y + 4.75, dojangPos.z);
      tempProj.project(camera);
      if (tempProj.z < 1) {
        dojangTagEl.style.setProperty(
          '--tag-x',
          `${((tempProj.x * 0.5 + 0.5) * viewportWidth).toFixed(1)}px`
        );
        dojangTagEl.style.setProperty(
          '--tag-y',
          `${((-tempProj.y * 0.5 + 0.5) * viewportHeight).toFixed(1)}px`
        );
        dojangTagEl.style.opacity = '1';
      } else {
        dojangTagEl.style.opacity = '0';
      }

      actorShowcase.projectLabels(dojangPos, camera, viewportWidth, viewportHeight, 2.15);
    },
    dispose: () => {
      actorShowcase.dispose();
      dojangTagEl.remove();
      ctx.scene.remove(dojangGroup);
      disposeObject3D(dojangGroup);
    },
  };
}
