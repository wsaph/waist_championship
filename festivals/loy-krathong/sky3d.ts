import * as THREE from 'three';
import type { FestivalSkyContext, FestivalSkyController } from '../types';

/**
 * Builds and animates the Full Moon Loy Krathong Night Sky
 * ("ท้องฟ้า กลางคืน แสงจันทร์เต็มดวงส่อง เดือนเพ็ญ"):
 * - Full Moon with golden Moon-Rabbit silhouette & multi-layered radiant corona
 * - Diagonal volumetric moonbeam shafts onto the island & sea
 * - Shimmering golden moonlight reflection path across the sea
 * - 360° celestial starry dome
 * - Distant floating sky lanterns (โคมลอยคืนวันเพ็ญ) active when Loy Krathong sky mode is enabled
 */
function makeCanvas2D(
  width: number,
  height: number,
  draw: (ctx2d: CanvasRenderingContext2D) => void
): THREE.CanvasTexture {
  if (typeof document === 'undefined') {
    const tex = new THREE.CanvasTexture(
      Object.assign({ width, height }) as HTMLCanvasElement
    );
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx2d = canvas.getContext('2d');
  if (ctx2d) draw(ctx2d);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createLoyKrathongFullMoonSky(ctx: FestivalSkyContext): FestivalSkyController {
  const { scene, islandCenterX, islandW, islandD, qualityTier, starCount: baseStarCount, initialVisible } = ctx;

  const nightGroup = new THREE.Group();
  nightGroup.name = 'loy-krathong-full-moon-sky';
  const moonPos = new THREE.Vector3(-10, 15.5, -(islandD / 2 + 38));

  // Detailed Full Moon texture with subtle golden Moon-Rabbit silhouette
  const moonTex = makeCanvas2D(256, 256, (mCtx) => {
    const mGrad = mCtx.createRadialGradient(118, 112, 16, 128, 128, 128);
    mGrad.addColorStop(0, '#ffffff');
    mGrad.addColorStop(0.55, '#fef9c3');
    mGrad.addColorStop(0.88, '#fde047');
    mGrad.addColorStop(1, '#f59e0b');
    mCtx.fillStyle = mGrad;
    mCtx.fillRect(0, 0, 256, 256);

    // Soft lunar maria / cute Moon Rabbit hint
    mCtx.fillStyle = 'rgba(217, 119, 6, 0.16)';
    mCtx.beginPath();
    mCtx.ellipse(134, 146, 34, 24, -0.25, 0, Math.PI * 2);
    mCtx.fill();
    mCtx.beginPath();
    mCtx.ellipse(106, 118, 20, 18, 0.2, 0, Math.PI * 2);
    mCtx.fill();
    mCtx.beginPath();
    mCtx.ellipse(116, 86, 8, 22, 0.35, 0, Math.PI * 2);
    mCtx.fill();
    mCtx.beginPath();
    mCtx.ellipse(130, 90, 7, 20, 0.6, 0, Math.PI * 2);
    mCtx.fill();
  });

  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(5.2, 32, 32),
    new THREE.MeshBasicMaterial({ map: moonTex, fog: false })
  );
  moonMesh.position.copy(moonPos);
  moonMesh.rotation.y = -Math.PI / 2;
  nightGroup.add(moonMesh);

  // Multi-layered radiant full-moon corona & outer atmospheric halo
  const moonHaloTex = makeCanvas2D(256, 256, (hCtx) => {
    const hGrad = hCtx.createRadialGradient(128, 128, 12, 128, 128, 126);
    hGrad.addColorStop(0, 'rgba(255, 253, 235, 0.92)');
    hGrad.addColorStop(0.26, 'rgba(254, 240, 138, 0.52)');
    hGrad.addColorStop(0.58, 'rgba(251, 191, 36, 0.18)');
    hGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    hCtx.fillStyle = hGrad;
    hCtx.fillRect(0, 0, 256, 256);
  });

  const moonInnerHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: moonHaloTex,
      color: 0xfef08a,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
  );
  moonInnerHalo.position.copy(moonPos);
  moonInnerHalo.scale.set(22, 22, 1);
  nightGroup.add(moonInnerHalo);

  const moonOuterHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: moonHaloTex,
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
  );
  moonOuterHalo.position.copy(moonPos);
  moonOuterHalo.scale.set(44, 44, 1);
  nightGroup.add(moonOuterHalo);

  // Volumetric Moonbeam shafts shining diagonally from the full moon onto the island & sea
  const beamTex = makeCanvas2D(64, 256, (bCtx) => {
    const bGrad = bCtx.createLinearGradient(0, 0, 0, 256);
    bGrad.addColorStop(0, 'rgba(254, 249, 195, 0.42)');
    bGrad.addColorStop(0.45, 'rgba(254, 240, 138, 0.14)');
    bGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    bCtx.fillStyle = bGrad;
    bCtx.fillRect(0, 0, 64, 256);
  });
  const moonBeamMeshes: THREE.Mesh[] = [];
  [
    { target: new THREE.Vector3(-4, 0, -4), rTop: 2.6, rBot: 13.5, op: 0.13 },
    { target: new THREE.Vector3(-16, 0, -14), rTop: 2.1, rBot: 9.5, op: 0.09 },
    { target: new THREE.Vector3(9, 0, -10), rTop: 2.1, rBot: 10.5, op: 0.09 },
  ].forEach((bm) => {
    const dir = new THREE.Vector3().subVectors(bm.target, moonPos);
    const len = dir.length();
    const mid = new THREE.Vector3().addVectors(moonPos, bm.target).multiplyScalar(0.5);
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(bm.rTop, bm.rBot, len, 18, 1, true),
      new THREE.MeshBasicMaterial({
        map: beamTex,
        transparent: true,
        opacity: bm.op,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      })
    );
    cone.position.copy(mid);
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir.clone().normalize());
    nightGroup.add(cone);
    moonBeamMeshes.push(cone);
  });

  // Shimmering Golden Moonlight Reflection Path across the Sea
  const shimmerTex = makeCanvas2D(128, 256, (shCtx) => {
    for (let r = 0; r < 46; r++) {
      const py = (r / 46) * 248 + 4;
      const spread = 12 + (r / 46) * 38;
      const alpha = (1 - Math.abs(r / 46 - 0.35)) * 0.48;
      const g = shCtx.createRadialGradient(64, py, 2, 64, py, spread);
      g.addColorStop(0, `rgba(254, 249, 195, ${Math.max(0.08, alpha).toFixed(2)})`);
      g.addColorStop(0.55, `rgba(250, 204, 21, ${(alpha * 0.5).toFixed(2)})`);
      g.addColorStop(1, 'rgba(250, 204, 21, 0)');
      shCtx.fillStyle = g;
      shCtx.fillRect(0, py - 3, 128, 6);
    }
  });
  const moonWaterShimmer = new THREE.Mesh(
    new THREE.PlaneGeometry(19, 34),
    new THREE.MeshBasicMaterial({
      map: shimmerTex,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  moonWaterShimmer.rotation.x = -Math.PI / 2;
  moonWaterShimmer.position.set(moonPos.x * 0.65, -0.32, -(islandD / 2 + 19));
  nightGroup.add(moonWaterShimmer);

  // 360° Celestial Starry Dome surrounding the entire island
  const starCount = Math.max(220, baseStarCount * 2);
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const radius = 58 + Math.random() * 85;
    starPos[i * 3] = islandCenterX + Math.cos(theta) * radius;
    starPos[i * 3 + 1] = 8 + Math.random() * 56;
    starPos[i * 3 + 2] = Math.sin(theta) * radius;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xfef9c3,
    size: 0.42,
    transparent: true,
    opacity: 0.92,
    fog: false,
  });
  nightGroup.add(new THREE.Points(starGeo, starMat));

  // Distant Floating Sky Lanterns (โคมลอยคืนวันเพ็ญ)
  const lanternsGroup = new THREE.Group();
  nightGroup.add(lanternsGroup);
  const skyLanterns: Array<{
    group: THREE.Group;
    baseX: number;
    baseZ: number;
    speed: number;
    phase: number;
  }> = [];
  const lanternCount = qualityTier === 'lite' ? 8 : 16;
  const lanternShellMat = new THREE.MeshBasicMaterial({ color: 0xfdba74, fog: false });
  for (let li = 0; li < lanternCount; li++) {
    const lg = new THREE.Group();
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.2, 0.62, 8),
      lanternShellMat
    );
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: moonHaloTex,
        color: 0xfb923c,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      })
    );
    glow.scale.set(2.4, 2.4, 1);
    lg.add(shell, glow);
    const angle = (li / lanternCount) * Math.PI * 2 + 0.3;
    const dist = Math.max(islandW, islandD) * 0.62 + (li % 3) * 9;
    const bx = islandCenterX + Math.cos(angle) * dist;
    const bz = Math.sin(angle) * dist - 8;
    lg.position.set(bx, 8 + (li % 5) * 4.5, bz);
    lanternsGroup.add(lg);
    skyLanterns.push({
      group: lg,
      baseX: bx,
      baseZ: bz,
      speed: 0.42 + (li % 4) * 0.12,
      phase: li * 1.7,
    });
  }

  nightGroup.visible = initialVisible;
  scene.add(nightGroup);

  return {
    group: nightGroup,
    setVisible: (visible: boolean) => {
      nightGroup.visible = visible;
    },
    update: (elapsed: number, isFestivalSkyActive: boolean) => {
      if (!nightGroup.visible) return;
      const moonPulse = 1 + Math.sin(elapsed * 1.4) * 0.045;
      moonInnerHalo.scale.set(22 * moonPulse, 22 * moonPulse, 1);
      moonOuterHalo.scale.set(44 * (2 - moonPulse), 44 * (2 - moonPulse), 1);
      starMat.opacity = 0.8 + Math.sin(elapsed * 2.2) * 0.14;
      moonWaterShimmer.scale.set(1 + Math.sin(elapsed * 1.9) * 0.06, 1, 1);
      (moonWaterShimmer.material as THREE.MeshBasicMaterial).opacity =
        0.64 + Math.sin(elapsed * 2.7) * 0.12;
      moonBeamMeshes.forEach((bm, bi) => {
        (bm.material as THREE.MeshBasicMaterial).opacity =
          (bi === 0 ? 0.12 : 0.08) + Math.sin(elapsed * 1.3 + bi * 1.5) * 0.025;
      });
      lanternsGroup.visible = isFestivalSkyActive;
      if (isFestivalSkyActive) {
        skyLanterns.forEach((sl) => {
          const h = ((elapsed * sl.speed + sl.phase * 4) % 28) + 6;
          sl.group.position.set(
            sl.baseX + Math.sin(elapsed * 0.6 + sl.phase) * 1.6,
            h,
            sl.baseZ + Math.cos(elapsed * 0.5 + sl.phase) * 1.2
          );
        });
      }
    },
  };
}
