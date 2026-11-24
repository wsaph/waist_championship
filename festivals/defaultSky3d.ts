import * as THREE from 'three';
import type { FestivalModule, FestivalSkyContext, FestivalSkyController } from './types';

/**
 * Standard crisp starry night sky & moon used on normal non-festival nights
 * and whenever a player toggles off a seasonal festival sky override ("อากาศจริง").
 */
export function createDefaultIslandNightSky(ctx: FestivalSkyContext): FestivalSkyController {
  const { scene, islandCenterX, islandD, starCount: baseStarCount, initialVisible } = ctx;

  const nightGroup = new THREE.Group();
  nightGroup.name = 'default-island-night-sky';

  const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xfef08a, fog: false })
  );
  moonMesh.position.set(islandCenterX - 24, 28, -(islandD / 2 + 24));
  nightGroup.add(moonMesh);

  const starCount = Math.max(120, baseStarCount);
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = (i / starCount) * Math.PI * 2 + (i % 7) * 0.41;
    const radius = 56 + ((i * 19) % 75);
    starPos[i * 3] = islandCenterX + Math.cos(theta) * radius;
    starPos[i * 3 + 1] = 12 + ((i * 13) % 48);
    starPos[i * 3 + 2] = Math.sin(theta) * radius;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xfef9c3,
    size: 0.36,
    transparent: true,
    opacity: 0.86,
    fog: false,
  });
  nightGroup.add(new THREE.Points(starGeo, starMat));

  nightGroup.visible = initialVisible;
  scene.add(nightGroup);

  return {
    group: nightGroup,
    setVisible: (visible: boolean) => {
      nightGroup.visible = visible;
    },
    update: (elapsed: number) => {
      if (!nightGroup.visible) return;
      starMat.opacity = 0.76 + Math.sin(elapsed * 2.0) * 0.12;
    },
  };
}

/**
 * Builds the 3D night/festival sky controller for the island scene.
 * - When no festival is active (or the active festival defines no custom sky),
 *   renders only the lightweight standard starry night sky (zero festival GPU assets allocated).
 * - When an active festival provides `createSkyController`, switches cleanly between the
 *   custom festival sky (`isFestivalSkyActive = true`) and the standard night sky
 *   (`isFestivalSkyActive = false`, e.g. when toggled to real-weather mode at night).
 */
export function createIslandNightSkyController(
  activeModule: Pick<FestivalModule, 'definition' | 'createSkyController'> | null,
  ctx: FestivalSkyContext
): FestivalSkyController {
  if (!activeModule?.createSkyController) {
    return createDefaultIslandNightSky(ctx);
  }

  const rootGroup = new THREE.Group();
  rootGroup.name = `island-sky-host-${activeModule.definition.id}`;
  rootGroup.visible = ctx.initialVisible;
  ctx.scene.add(rootGroup);

  const defaultSky = createDefaultIslandNightSky({ ...ctx, initialVisible: false });
  const festivalSky = activeModule.createSkyController({
    ...ctx,
    initialVisible: ctx.initialVisible,
  });

  // Re-parent both sky groups under rootGroup so visibility & disposal stay unified
  rootGroup.add(defaultSky.group);
  rootGroup.add(festivalSky.group);

  return {
    group: rootGroup,
    setVisible: (visible: boolean) => {
      rootGroup.visible = visible;
    },
    update: (elapsed: number, isFestivalSkyActive: boolean) => {
      if (!rootGroup.visible) return;
      festivalSky.setVisible(isFestivalSkyActive);
      defaultSky.setVisible(!isFestivalSkyActive);
      if (isFestivalSkyActive) {
        festivalSky.update(elapsed, true);
      } else {
        defaultSky.update(elapsed, false);
      }
    },
  };
}
