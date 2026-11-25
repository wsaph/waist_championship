import * as THREE from 'three';
import { disposeObject3D } from '@/lib/device_perf';
import { createIslandActorShowcaseController } from '../islandActorShowcase3d';
import type { GameIslandZoneContext, GameIslandZoneInstance } from '../types';

export function createSumoIslandZone(
  ctx: GameIslandZoneContext
): GameIslandZoneInstance {
  const rawSumoZ = -10.5;
  const backPlazaX = ctx.sportsPlazaBackX ?? ctx.sportsPlazaX + 16.8;
  const sumoPos = new THREE.Vector3(
    Math.min(ctx.islandCenterX + ctx.islandW / 2 - 5.2, backPlazaX),
    0.2,
    Math.max(-(ctx.islandD / 2 - 5.2), Math.min(ctx.islandD / 2 - 5.2, rawSumoZ))
  );
  const sumoGroup = new THREE.Group();
  sumoGroup.position.copy(sumoPos);
  sumoGroup.rotation.y = -Math.PI * 0.28; // หันหน้าเวทีซูโม่เข้าหาลานประติมากรรมน้ำแข็งกลางสวนและมุมกล้องหลัก

  const roofSnowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.72 });
  const clayEarthMat = new THREE.MeshStandardMaterial({ color: 0xc8a276, roughness: 0.88 });
  const clayInnerMat = new THREE.MeshStandardMaterial({ color: 0xdfc198, roughness: 0.82 });

  const dohyoMound = new THREE.Mesh(
    new THREE.CylinderGeometry(3.85, 4.25, 0.36, 4),
    clayEarthMat
  );
  dohyoMound.rotation.y = Math.PI / 4;
  dohyoMound.position.y = 0.28;
  dohyoMound.receiveShadow = true;
  dohyoMound.castShadow = true;
  sumoGroup.add(dohyoMound);

  const hinokiMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.72 });
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.14, 0.46), hinokiMat);
  step1.position.set(0, 0.12, 2.95);
  const step2 = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.14, 0.38), hinokiMat);
  step2.position.set(0, 0.26, 2.72);
  sumoGroup.add(step1, step2);

  const dohyoCircle = new THREE.Mesh(
    new THREE.CylinderGeometry(2.15, 2.15, 0.05, 32),
    clayInnerMat
  );
  dohyoCircle.position.y = 0.47;
  dohyoCircle.receiveShadow = true;
  const strawRingMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    emissive: 0xa16207,
    emissiveIntensity: 0.12,
    roughness: 0.75,
  });
  const tawaraRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.15, 0.11, 10, 36),
    strawRingMat
  );
  tawaraRing.rotation.x = Math.PI / 2;
  tawaraRing.position.y = 0.5;
  tawaraRing.castShadow = true;
  sumoGroup.add(dohyoCircle, tawaraRing);

  [-2.58, 2.58].forEach((edgePos) => {
    const strawX = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.06, 0.09), strawRingMat);
    strawX.position.set(0, 0.48, edgePos);
    const strawZ = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 5.2), strawRingMat);
    strawZ.position.set(edgePos, 0.48, 0);
    sumoGroup.add(strawX, strawZ);
  });

  const shikiriLineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const shikiriAccentMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
  [-0.46, 0.46].forEach((sx) => {
    const lineWhite = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.92), shikiriLineMat);
    lineWhite.position.set(sx, 0.505, 0);
    const lineTip = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.032, 0.16), shikiriAccentMat);
    lineTip.position.set(sx, 0.506, 0);
    sumoGroup.add(lineWhite, lineTip);
  });

  const saltBucket = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.19, 0.24, 10), hinokiMat);
  saltBucket.position.set(-2.15, 0.58, 2.05);
  const saltPile = new THREE.Mesh(new THREE.ConeGeometry(0.21, 0.18, 10), roofSnowMat);
  saltPile.position.set(-2.15, 0.76, 2.05);
  sumoGroup.add(saltBucket, saltPile);

  const kohakuRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.55 });
  const kohakuWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
  const sumoPillarCoords: [number, number, number][] = [
    [-2.35, -2.25, 0x16a34a],
    [2.35, -2.25, 0xdc2626],
    [-2.35, 2.25, 0xf8fafc],
    [2.35, 2.25, 0x1e293b],
  ];
  for (const [px, pz, tasselHex] of sumoPillarCoords) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.21, 2.95, 12), hinokiMat);
    pillar.position.set(px, 1.92, pz);
    pillar.castShadow = true;
    sumoGroup.add(pillar);

    for (let b = 0; b < 4; b++) {
      const wrap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.215, 0.22, 0.26, 12),
        b % 2 === 0 ? kohakuRedMat : kohakuWhiteMat
      );
      wrap.position.set(px, 0.72 + b * 0.26, pz);
      sumoGroup.add(wrap);
    }

    const tassel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.16, 0.62, 10),
      new THREE.MeshStandardMaterial({ color: tasselHex, roughness: 0.5 })
    );
    tassel.position.set(px * 0.78, 2.76, pz * 0.78);
    sumoGroup.add(tassel);
  }

  const purpleCurtainMat = new THREE.MeshStandardMaterial({
    color: 0x581c87,
    emissive: 0x3b0764,
    emissiveIntensity: 0.25,
    roughness: 0.65,
  });
  const curtainFront = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.42, 0.12), purpleCurtainMat);
  curtainFront.position.set(0, 3.02, 2.28);
  const curtainBack = new THREE.Mesh(new THREE.BoxGeometry(5.1, 0.42, 0.12), purpleCurtainMat);
  curtainBack.position.set(0, 3.02, -2.28);
  const curtainLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 4.65), purpleCurtainMat);
  curtainLeft.position.set(-2.36, 3.02, 0);
  const curtainRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.42, 4.65), purpleCurtainMat);
  curtainRight.position.set(2.36, 3.02, 0);
  sumoGroup.add(curtainFront, curtainBack, curtainLeft, curtainRight);

  const sumoRoofBase = new THREE.Mesh(
    new THREE.BoxGeometry(6.4, 0.28, 6.1),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.52 })
  );
  sumoRoofBase.position.set(0, 3.34, 0);
  sumoRoofBase.castShadow = true;
  const sumoRoofTop = new THREE.Mesh(
    new THREE.ConeGeometry(4.45, 1.55, 4),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.52 })
  );
  sumoRoofTop.rotation.y = Math.PI / 4;
  sumoRoofTop.position.set(0, 4.2, 0);
  sumoRoofTop.castShadow = true;
  const sumoRoofSnow = new THREE.Mesh(new THREE.ConeGeometry(4.26, 0.82, 4), roofSnowMat);
  sumoRoofSnow.rotation.y = Math.PI / 4;
  sumoRoofSnow.position.set(0, 4.62, 0);
  const sumoTrim = new THREE.Mesh(
    new THREE.BoxGeometry(6.5, 0.11, 0.18),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.4,
    })
  );
  sumoTrim.position.set(0, 3.28, 3.06);
  sumoGroup.add(sumoRoofBase, sumoRoofTop, sumoRoofSnow, sumoTrim);

  const gunbaiGoldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.4,
    metalness: 0.5,
    roughness: 0.3,
  });
  const gunbaiFan = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.12, 24), kohakuRedMat);
  gunbaiFan.rotation.x = Math.PI / 2;
  gunbaiFan.position.set(0, 3.82, 2.26);
  const gunbaiRim = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.055, 8, 24), gunbaiGoldMat);
  gunbaiRim.position.set(0, 3.82, 2.28);
  const gunbaiHandle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.48, 0.12), gunbaiGoldMat);
  gunbaiHandle.position.set(0, 3.35, 2.28);
  sumoGroup.add(gunbaiFan, gunbaiRim, gunbaiHandle);

  const teppoPost = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 1.65, 12), hinokiMat);
  teppoPost.position.set(1.95, 1.28, 1.85);
  teppoPost.castShadow = true;
  const teppoBand = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.24, 12), kohakuWhiteMat);
  teppoBand.position.set(1.95, 1.55, 1.85);
  sumoGroup.add(teppoPost, teppoBand);

  const actorShowcase = createIslandActorShowcaseController(sumoGroup, ctx.labelsContainer);
  ctx.scene.add(sumoGroup);

  const sumoTagEl = document.createElement('div');
  sumoTagEl.className = 'player-tag cursor-pointer';
  sumoTagEl.onclick = () => {
    ctx.focusCamera(
      new THREE.Vector3(sumoPos.x, 2.1, sumoPos.z),
      new THREE.Vector3(sumoPos.x - 5.2, 5.8, sumoPos.z + 8.6)
    );
    const liveSumo = ctx.getLiveLobby('sumo');
    if (ctx.isNearZone('sumo') || liveSumo?.status === 'started') {
      ctx.openGame({ gameId: 'sumo', isHost: false });
    } else if (ctx.getWalkingSpectatorId() !== null) {
      ctx.walkSpectatorTo(new THREE.Vector3(sumoPos.x - 2.6, 0.2, sumoPos.z + 2.4));
    }
  };
  ctx.labelsContainer.appendChild(sumoTagEl);

  let renderedTagSig = '';
  const tempProj = new THREE.Vector3();

  return {
    gameId: 'sumo',
    group: sumoGroup,
    position: sumoPos,
    proximityRadius: 5.8,
    update: ({ elapsed, delta, camera, viewportWidth, viewportHeight }) => {
      const liveSumo = ctx.getLiveLobby('sumo');

      actorShowcase.syncRoster(
        liveSumo?.roster,
        liveSumo ? `${liveSumo.status}` : '',
        ctx.getPlayers(),
        (slotEntry, idx) => {
          const isLeft = idx === 0 || slotEntry.team === 'left';
          return {
            x: isLeft ? -0.95 : 0.95,
            y: 0.5,
            z: 0,
            rotY: isLeft ? 0 : Math.PI,
            scale: 0.85,
          };
        }
      );

      const nextTagSig = liveSumo
        ? `${liveSumo.status}|${liveSumo.count}|${liveSumo.max}|${liveSumo.scoreLeft ?? 0}|${liveSumo.scoreRight ?? 0}`
        : 'idle';
      if (nextTagSig !== renderedTagSig) {
        renderedTagSig = nextTagSig;
        if (liveSumo?.status === 'started') {
          sumoTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-rose-600 via-amber-500 to-rose-600 text-white border-2 border-amber-200 rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🔒 สังเวียนซูโม่กำลังประลอง (${liveSumo.scoreLeft ?? 0} : ${liveSumo.scoreRight ?? 0}) • คลิกส่องริกิชิ!
            </div>
          `;
        } else if (liveSumo?.status === 'waiting') {
          sumoTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-emerald-300 via-amber-200 to-orange-300 text-slate-950 border-2 border-white rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🟢 ห้องรอซูโม่ PvP (${liveSumo.count}/${liveSumo.max}) • เดินขึ้นเวทีรับคำท้า!
            </div>
          `;
        } else {
          sumoTagEl.innerHTML = `
            <div class="bg-gradient-to-r from-purple-900 via-red-700 to-amber-500 text-amber-100 border-2 border-amber-200 rounded-xl px-2.5 py-0.5 shadow-[2px_2px_0px_#000] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
              🏯 สังเวียนซูโม่ฮอกไกโด (ชนพุงดันตกเวที 1v1 / ไต่ยศโยโกซึนะ!)
            </div>
          `;
        }
      }

      const actors = actorShowcase.getActors();
      actors.forEach((act, ai) => {
        const clash =
          liveSumo?.status === 'started'
            ? Math.sin(elapsed * 6.5) * (act.team === 'left' ? 0.25 : -0.25)
            : 0;
        const stomp = Math.abs(Math.sin(elapsed * 4.5 + ai)) * 0.14;
        act.root.position.set(act.baseX + clash, act.baseY + stomp, act.baseZ);
        act.charParts.mixer?.update(delta);
      });

      tempProj.set(sumoPos.x, sumoPos.y + 5.15, sumoPos.z);
      tempProj.project(camera);
      if (tempProj.z < 1) {
        sumoTagEl.style.setProperty(
          '--tag-x',
          `${((tempProj.x * 0.5 + 0.5) * viewportWidth).toFixed(1)}px`
        );
        sumoTagEl.style.setProperty(
          '--tag-y',
          `${((-tempProj.y * 0.5 + 0.5) * viewportHeight).toFixed(1)}px`
        );
        sumoTagEl.style.opacity = '1';
      } else {
        sumoTagEl.style.opacity = '0';
      }

      actorShowcase.projectLabels(sumoPos, camera, viewportWidth, viewportHeight, 2.2);
    },
    dispose: () => {
      actorShowcase.dispose();
      sumoTagEl.remove();
      ctx.scene.remove(sumoGroup);
      disposeObject3D(sumoGroup);
    },
  };
}
