import * as THREE from 'three';

export interface FortuneBoothController {
  group: THREE.Group;
  position: THREE.Vector3;
  update: (params: {
    elapsed: number;
    camera: THREE.PerspectiveCamera;
    viewportWidth: number;
    viewportHeight: number;
  }) => void;
  onPointerTap: (raycaster: THREE.Raycaster) => boolean;
  dispose: () => void;
}

export function createFortuneBoothController(opts: {
  scene: THREE.Scene;
  labelsContainer: HTMLElement;
  position: THREE.Vector3;
  rotationY?: number;
  onSelectBooth: () => void;
}): FortuneBoothController {
  const { scene, labelsContainer, position, rotationY = Math.PI * 0.18, onSelectBooth } = opts;

  const boothGroup = new THREE.Group();
  boothGroup.position.copy(position);
  boothGroup.rotation.y = rotationY;

  // 1. Mystic circular carpet & wooden dais right by the Starting Plaza
  const dais = new THREE.Mesh(
    new THREE.CylinderGeometry(2.55, 2.7, 0.16, 24),
    new THREE.MeshStandardMaterial({ color: 0x3b1d5a, roughness: 0.82 })
  );
  dais.position.y = 0.08;
  dais.receiveShadow = true;
  boothGroup.add(dais);

  const goldTrimRing = new THREE.Mesh(
    new THREE.RingGeometry(2.22, 2.42, 32),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
  );
  goldTrimRing.rotation.x = -Math.PI / 2;
  goldTrimRing.position.y = 0.17;
  boothGroup.add(goldTrimRing);

  const innerRuneRing = new THREE.Mesh(
    new THREE.RingGeometry(1.55, 1.66, 24),
    new THREE.MeshBasicMaterial({
      color: 0xe879f9,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
    })
  );
  innerRuneRing.rotation.x = -Math.PI / 2;
  innerRuneRing.position.y = 0.175;
  boothGroup.add(innerRuneRing);

  // 2. Cozy Mystic Canopy Tent Posts & Starry Velvet Pavilion Roof
  const postMat = new THREE.MeshStandardMaterial({ color: 0x4a2511, roughness: 0.75 });
  const canopyCorners: Array<[number, number]> = [
    [-1.65, -1.45],
    [1.65, -1.45],
    [-1.65, 1.45],
    [1.65, 1.45],
  ];
  canopyCorners.forEach(([cx, cz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.75, 8), postMat);
    post.position.set(cx, 1.42, cz);
    post.castShadow = true;
    boothGroup.add(post);

    const orbCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 10, 10),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
        roughness: 0.3,
      })
    );
    orbCap.position.set(cx, 2.85, cz);
    boothGroup.add(orbCap);
  });

  const canopyRoof = new THREE.Mesh(
    new THREE.ConeGeometry(2.68, 1.45, 4),
    new THREE.MeshStandardMaterial({
      color: 0x581c87,
      emissive: 0x3b0764,
      emissiveIntensity: 0.22,
      roughness: 0.65,
    })
  );
  canopyRoof.rotation.y = Math.PI / 4;
  canopyRoof.position.set(0, 3.48, 0);
  canopyRoof.castShadow = true;
  boothGroup.add(canopyRoof);

  const roofSnowCap = new THREE.Mesh(
    new THREE.ConeGeometry(2.54, 0.68, 4),
    new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xe0f2fe,
      emissiveIntensity: 0.08,
      roughness: 0.75,
    })
  );
  roofSnowCap.rotation.y = Math.PI / 4;
  roofSnowCap.position.set(0, 3.86, 0);
  boothGroup.add(roofSnowCap);

  const moonCrest = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.065, 10, 20, Math.PI * 1.45),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfacc15,
      emissiveIntensity: 0.65,
      roughness: 0.25,
    })
  );
  moonCrest.position.set(0, 4.42, 0);
  moonCrest.rotation.z = Math.PI * 0.25;
  boothGroup.add(moonCrest);

  // Front velvet valance drapes
  for (let i = 0; i < 5; i++) {
    const drape = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.28, 0.1),
      new THREE.MeshStandardMaterial({
        color: i % 2 === 0 ? 0x7e22ce : 0xfacc15,
        roughness: 0.55,
      })
    );
    drape.position.set(-1.28 + i * 0.64, 2.72, 1.46);
    boothGroup.add(drape);
  }

  // 3. Fortune Teller Velvet Table (โต๊ะแม่หมอผ้าคลุมกำมะหยี่ม่วงขลิบทอง)
  const tableBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.68, 0.86, 12),
    postMat
  );
  tableBase.position.set(0, 0.58, 0.15);
  tableBase.castShadow = true;
  boothGroup.add(tableBase);

  const tableCloth = new THREE.Mesh(
    new THREE.CylinderGeometry(1.08, 1.22, 0.34, 20),
    new THREE.MeshStandardMaterial({
      color: 0x6b21a8,
      roughness: 0.68,
    })
  );
  tableCloth.position.set(0, 0.96, 0.15);
  tableCloth.castShadow = true;
  tableCloth.receiveShadow = true;
  boothGroup.add(tableCloth);

  const tableGoldRim = new THREE.Mesh(
    new THREE.TorusGeometry(1.12, 0.045, 8, 24),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35, metalness: 0.4 })
  );
  tableGoldRim.rotation.x = Math.PI / 2;
  tableGoldRim.position.set(0, 1.08, 0.15);
  boothGroup.add(tableGoldRim);

  // 4. Props on the Fortune Table: Glowing Crystal Ball, Tarot Spread, Esiimsi Bamboo Cylinder & Candle
  const crystalPedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.26, 0.12, 12),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.35, metalness: 0.5 })
  );
  crystalPedestal.position.set(0, 1.19, 0.18);
  boothGroup.add(crystalPedestal);

  const crystalBallMat = new THREE.MeshStandardMaterial({
    color: 0xe9d5ff,
    emissive: 0xa855f7,
    emissiveIntensity: 0.85,
    roughness: 0.12,
    transparent: true,
    opacity: 0.92,
  });
  const crystalBall = new THREE.Mesh(new THREE.SphereGeometry(0.28, 18, 18), crystalBallMat);
  crystalBall.position.set(0, 1.48, 0.18);
  boothGroup.add(crystalBall);

  const crystalHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.022, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xf0abfc, transparent: true, opacity: 0.8 })
  );
  crystalHalo.position.copy(crystalBall.position);
  boothGroup.add(crystalHalo);

  // Spread of 3 mini Tarot cards in front of the crystal ball
  [-0.32, 0, 0.32].forEach((tx, idx) => {
    const cardMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.02, 0.34),
      new THREE.MeshStandardMaterial({
        color: idx === 1 ? 0xfef08a : 0xc084fc,
        emissive: idx === 1 ? 0xf59e0b : 0x7e22ce,
        emissiveIntensity: 0.22,
        roughness: 0.4,
      })
    );
    cardMesh.position.set(tx, 1.145, 0.68);
    cardMesh.rotation.y = (idx - 1) * -0.18;
    boothGroup.add(cardMesh);
  });

  // Red & Gold Esiimsi Shaker Cylinder on the right side of the table
  const esiimsiCup = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.11, 0.32, 10),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.5 })
  );
  esiimsiCup.position.set(0.62, 1.29, 0.28);
  boothGroup.add(esiimsiCup);

  for (let s = 0; s < 5; s++) {
    const stick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.015, 0.24, 6),
      new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 })
    );
    stick.position.set(0.62 + (s - 2) * 0.025, 1.48, 0.28 + ((s % 2) - 0.5) * 0.03);
    stick.rotation.z = (s - 2) * 0.08;
    boothGroup.add(stick);
  }

  // Warm Mystic Lantern on the left side of the table
  const lanternBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.26, 8),
    new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.75,
      roughness: 0.25,
    })
  );
  lanternBody.position.set(-0.62, 1.27, 0.26);
  boothGroup.add(lanternBody);

  // 5. Cute Chibi Fortune Teller NPC ("แม่หมอจันทรา") seated behind the table
  const npcGroup = new THREE.Group();
  npcGroup.position.set(0, 0.16, -0.68);

  const robeMesh = new THREE.Mesh(
    new THREE.ConeGeometry(0.48, 1.18, 14),
    new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.7 })
  );
  robeMesh.position.y = 0.62;
  robeMesh.castShadow = true;
  npcGroup.add(robeMesh);

  const shawlMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.44, 0.36, 12),
    new THREE.MeshStandardMaterial({ color: 0xbe185d, roughness: 0.65 })
  );
  shawlMesh.position.y = 1.02;
  npcGroup.add(shawlMesh);

  const headMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.32, 16, 16),
    new THREE.MeshStandardMaterial({ color: 0xffedd5, roughness: 0.6 })
  );
  headMesh.position.y = 1.46;
  headMesh.castShadow = true;
  npcGroup.add(headMesh);

  // Mystic headscarf + golden forehead gem + witch/seer hat
  const scarfMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62),
    new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.55 })
  );
  scarfMesh.position.y = 1.48;
  npcGroup.add(scarfMesh);

  const thirdEyeGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.065),
    new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65,
    })
  );
  thirdEyeGem.position.set(0, 1.58, 0.31);
  npcGroup.add(thirdEyeGem);

  // Eyes
  [-0.11, 0.11].forEach((ex) => {
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x1e1b4b })
    );
    eye.position.set(ex, 1.45, 0.29);
    npcGroup.add(eye);
  });

  const hatBrim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.58, 0.58, 0.05, 16),
    new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.65 })
  );
  hatBrim.position.y = 1.72;
  hatBrim.rotation.x = -0.12;
  npcGroup.add(hatBrim);

  const hatCone = new THREE.Mesh(
    new THREE.ConeGeometry(0.36, 0.72, 12),
    new THREE.MeshStandardMaterial({ color: 0x581c87, roughness: 0.65 })
  );
  hatCone.position.set(0, 2.06, -0.05);
  hatCone.rotation.x = -0.18;
  npcGroup.add(hatCone);

  boothGroup.add(npcGroup);

  boothGroup.traverse((obj) => {
    obj.userData.isFortuneBooth = true;
  });
  scene.add(boothGroup);

  // Floating clickable HTML tag above the Fortune Booth
  const tagEl = document.createElement('div');
  tagEl.className = 'player-tag cursor-pointer';
  tagEl.onclick = (ev) => {
    ev.stopPropagation();
    onSelectBooth();
  };
  tagEl.innerHTML = `
    <div class="bg-gradient-to-r from-[#581c87] via-[#9333ea] to-[#db2777] text-amber-100 border-2 border-amber-300 rounded-xl px-2.5 py-0.5 shadow-[0_3px_0_#2e1065,0_4px_12px_rgba(168,85,247,0.55)] text-[10.5px] font-extrabold whitespace-nowrap hover:scale-105 transition">
      🔮 โต๊ะแม่หมอพยากรณ์ (กดดูดวงฟรี!)
    </div>
  `;
  labelsContainer.appendChild(tagEl);

  const projVec = new THREE.Vector3();

  return {
    group: boothGroup,
    position,
    update: ({ elapsed, camera, viewportWidth, viewportHeight }) => {
      // Gentle mystic levitation & rotation on crystal ball + rune ring + NPC idle sway
      crystalBall.position.y = 1.48 + Math.sin(elapsed * 2.4) * 0.045;
      crystalBallMat.emissiveIntensity = 0.7 + Math.sin(elapsed * 3.1) * 0.25;
      crystalHalo.position.y = crystalBall.position.y;
      crystalHalo.rotation.x = Math.sin(elapsed * 1.5) * 0.55 + 0.8;
      crystalHalo.rotation.y = elapsed * 1.25;
      innerRuneRing.rotation.z = elapsed * 0.35;
      moonCrest.rotation.y = Math.sin(elapsed * 1.1) * 0.45;
      npcGroup.rotation.y = Math.sin(elapsed * 1.3) * 0.12;

      projVec.set(position.x, position.y + 4.75, position.z);
      projVec.project(camera);
      if (projVec.z < 1) {
        tagEl.style.setProperty('--tag-x', `${((projVec.x * 0.5 + 0.5) * viewportWidth).toFixed(1)}px`);
        tagEl.style.setProperty('--tag-y', `${((-projVec.y * 0.5 + 0.5) * viewportHeight).toFixed(1)}px`);
        tagEl.style.opacity = '1';
      } else {
        tagEl.style.opacity = '0';
      }
    },
    onPointerTap: (raycaster: THREE.Raycaster) => {
      const hits = raycaster.intersectObject(boothGroup, true);
      if (hits.length > 0) {
        onSelectBooth();
        return true;
      }
      return false;
    },
    dispose: () => {
      tagEl.remove();
    },
  };
}
