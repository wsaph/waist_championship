import * as THREE from 'three';

export interface GuardAnimTarget {
  rootGroup: THREE.Group;
  bounceGroup: THREE.Group;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
}

export interface GuardPrankFxRig {
  update: (
    prankId: string,
    pNorm: number,
    elapsed: number,
    gPos: THREE.Vector3,
    guardPostPos: THREE.Vector3,
    guardParts: GuardAnimTarget
  ) => void;
  hideAll: () => void;
}

export function createGuardPrankFxRig(scene: THREE.Scene): GuardPrankFxRig {
  const root = new THREE.Group();
  root.visible = false;
  scene.add(root);

  // 1. 🍌 Banana Peel
  const bananaGroup = new THREE.Group();
  const bananaMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 });
  const bananaTipMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.55), bananaMat);
    petal.position.set(Math.cos(angle) * 0.25, 0.08, Math.sin(angle) * 0.25);
    petal.rotation.y = -angle;
    petal.rotation.x = 0.25;
    bananaGroup.add(petal);
  }
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.22, 6), bananaTipMat);
  stem.position.y = 0.16;
  bananaGroup.add(stem);
  root.add(bananaGroup);

  // 2. 🔨 Giant Carnival Hammer
  const hammerGroup = new THREE.Group();
  const hammerPivot = new THREE.Group();
  const handle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.12, 3.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.5 })
  );
  handle.position.y = 1.6;
  hammerPivot.add(handle);
  const head = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.62, 1.55, 14),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 })
  );
  head.rotation.z = Math.PI / 2;
  head.position.y = 3.1;
  hammerPivot.add(head);
  const capL = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.65, 0.16, 14),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 })
  );
  capL.rotation.z = Math.PI / 2;
  capL.position.set(-0.78, 3.1, 0);
  const capR = capL.clone();
  capR.position.x = 0.78;
  hammerPivot.add(capL, capR);
  hammerGroup.add(hammerPivot);
  const bonkRingMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const bonkRing = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.9, 20), bonkRingMat);
  bonkRing.rotation.x = -Math.PI / 2;
  bonkRing.position.y = 0.12;
  hammerGroup.add(bonkRing);
  root.add(hammerGroup);

  // 3. 🎈 Balloon Bunch
  const balloonGroup = new THREE.Group();
  const balloonColors = [0xef4444, 0xfacc15, 0x38bdf8, 0xf472b6, 0x4ade80];
  const balloonOffsets = [
    [0, 3.8, 0],
    [-0.55, 3.55, 0.25],
    [0.55, 3.5, -0.2],
    [-0.3, 3.35, -0.45],
    [0.35, 3.4, 0.45],
  ];
  balloonOffsets.forEach(([bx, by, bz], idx) => {
    const bMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 12, 10),
      new THREE.MeshStandardMaterial({ color: balloonColors[idx], roughness: 0.2, metalness: 0.1 })
    );
    bMesh.scale.set(1, 1.18, 1);
    bMesh.position.set(bx, by, bz);
    balloonGroup.add(bMesh);

    const strGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 1.4, 0),
      new THREE.Vector3(bx, by - 0.45, bz),
    ]);
    const str = new THREE.Line(
      strGeo,
      new THREE.LineBasicMaterial({ color: 0xf8fafc, transparent: true, opacity: 0.85 })
    );
    balloonGroup.add(str);
  });
  root.add(balloonGroup);

  // 4. 🧊 Giant Ice Cube
  const iceGroup = new THREE.Group();
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0284c7,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 0.56,
    roughness: 0.1,
    metalness: 0.15,
  });
  const iceCube = new THREE.Mesh(new THREE.BoxGeometry(1.75, 2.5, 1.75), iceMat);
  iceCube.position.y = 1.25;
  iceGroup.add(iceCube);
  const iceWire = new THREE.Mesh(
    new THREE.BoxGeometry(1.79, 2.54, 1.79),
    new THREE.MeshBasicMaterial({ color: 0xe0f2fe, wireframe: true, transparent: true, opacity: 0.38 })
  );
  iceWire.position.y = 1.25;
  iceGroup.add(iceWire);
  root.add(iceGroup);

  // 5. ⛈️ Thunder Cloud + Lightning Bolt
  const thunderGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
  const cloudPuffs = [
    [0, 3.85, 0, 0.72],
    [-0.65, 3.7, 0.15, 0.54],
    [0.65, 3.72, -0.1, 0.56],
    [0.15, 3.95, 0.42, 0.48],
    [-0.2, 3.8, -0.45, 0.48],
  ];
  cloudPuffs.forEach(([cx, cy, cz, cr]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(cr, 10, 8), cloudMat);
    puff.position.set(cx, cy, cz);
    thunderGroup.add(puff);
  });
  const boltMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
  const boltGroup = new THREE.Group();
  const seg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 1.1, 6), boltMat);
  seg1.position.set(0.12, 3.05, 0);
  seg1.rotation.z = 0.28;
  const seg2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 1.15, 6), boltMat);
  seg2.position.set(-0.08, 2.15, 0);
  seg2.rotation.z = -0.32;
  boltGroup.add(seg1, seg2);
  thunderGroup.add(boltGroup);
  root.add(thunderGroup);

  // 6. ☄️ Meteor Drop + Fire Blast
  const meteorGroup = new THREE.Group();
  const meteorRock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.95, 0),
    new THREE.MeshStandardMaterial({
      color: 0x7c2d12,
      emissive: 0xea580c,
      emissiveIntensity: 0.8,
      roughness: 0.7,
    })
  );
  const meteorHalo = new THREE.Mesh(
    new THREE.SphereGeometry(1.22, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.45 })
  );
  meteorRock.add(meteorHalo);
  meteorGroup.add(meteorRock);

  const blastRingMat = new THREE.MeshBasicMaterial({
    color: 0xf97316,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const blastRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.25, 24), blastRingMat);
  blastRing.rotation.x = -Math.PI / 2;
  blastRing.position.y = 0.15;
  meteorGroup.add(blastRing);
  root.add(meteorGroup);

  // 7. 🌀 Tornado Funnel
  const tornadoGroup = new THREE.Group();
  const tornadoRings: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const r = 0.45 + i * 0.26;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.09, 8, 20),
      new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0xbae6fd : 0x94a3b8,
        transparent: true,
        opacity: 0.65 - i * 0.05,
      })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.4 + i * 0.62;
    tornadoGroup.add(ring);
    tornadoRings.push(ring);
  }
  root.add(tornadoGroup);

  // 8. 🪣 Trash Bucket on Head
  const bucketGroup = new THREE.Group();
  const bucketMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.65, roughness: 0.35 });
  const bucketBody = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.64, 0.92, 14), bucketMat);
  bucketBody.position.y = 1.95;
  const bucketRim = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.05, 8, 16), bucketMat);
  bucketRim.rotation.x = Math.PI / 2;
  bucketRim.position.y = 1.5;
  bucketGroup.add(bucketBody, bucketRim);
  root.add(bucketGroup);

  // 9. 🥧 Cream Pie Splat
  const pieGroup = new THREE.Group();
  const pieFly = new THREE.Group();
  const pieCrust = new THREE.Mesh(
    new THREE.CylinderGeometry(0.45, 0.35, 0.16, 14),
    new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 })
  );
  pieCrust.rotation.x = Math.PI / 2;
  const pieCream = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 12, 10),
    new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.4 })
  );
  pieCream.scale.set(1, 1, 0.55);
  pieCream.position.z = 0.08;
  pieFly.add(pieCrust, pieCream);
  pieGroup.add(pieFly);
  root.add(pieGroup);

  // 10. 💨 Toxic Durian Gas Clouds
  const gasGroup = new THREE.Group();
  const gasPuffs: THREE.Mesh[] = [];
  const gasMat = new THREE.MeshStandardMaterial({
    color: 0x84cc16,
    emissive: 0x4d7c0f,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.62,
    roughness: 0.9,
  });
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.45 + (i % 3) * 0.18, 10, 8), gasMat);
    gasGroup.add(puff);
    gasPuffs.push(puff);
  }
  root.add(gasGroup);

  // 11. 🚀 Back Rocket + Flame
  const rocketGroup = new THREE.Group();
  const rocketBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.24, 1.35, 10),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.35 })
  );
  const rocketNose = new THREE.Mesh(
    new THREE.ConeGeometry(0.23, 0.45, 10),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
  );
  rocketNose.position.y = 0.9;
  const rocketFlame = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 1.2, 8),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.9 })
  );
  rocketFlame.rotation.x = Math.PI;
  rocketFlame.position.y = -1.2;
  rocketGroup.add(rocketBody, rocketNose, rocketFlame);
  root.add(rocketGroup);

  // 12. 💃 Morlam Disco Ball + Colorful Floor Lights
  const discoGroup = new THREE.Group();
  const discoBall = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.48, 1),
    new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.4,
      metalness: 0.9,
      roughness: 0.15,
    })
  );
  discoBall.position.y = 3.7;
  discoGroup.add(discoBall);
  const discoLights: THREE.Mesh[] = [];
  const discoColors = [0xf472b6, 0x38bdf8, 0xfacc15];
  discoColors.forEach((hex) => {
    const spot = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 18),
      new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.55, side: THREE.DoubleSide })
    );
    spot.rotation.x = -Math.PI / 2;
    spot.position.y = 0.12;
    discoGroup.add(spot);
    discoLights.push(spot);
  });
  root.add(discoGroup);

  const allSubGroups = [
    bananaGroup,
    hammerGroup,
    balloonGroup,
    iceGroup,
    thunderGroup,
    meteorGroup,
    tornadoGroup,
    bucketGroup,
    pieGroup,
    gasGroup,
    rocketGroup,
    discoGroup,
  ];

  const hideAll = () => {
    root.visible = false;
    allSubGroups.forEach((g) => {
      g.visible = false;
    });
  };

  const update = (
    prankId: string,
    pNorm: number,
    elapsed: number,
    gPos: THREE.Vector3,
    guardPostPos: THREE.Vector3,
    guardParts: GuardAnimTarget
  ) => {
    root.visible = true;
    allSubGroups.forEach((g) => {
      g.visible = false;
    });

    // Reset guard transforms before applying prank-specific motion
    guardParts.rootGroup.scale.set(1, 1, 1);
    guardParts.rootGroup.rotation.x = 0;
    guardParts.rootGroup.rotation.z = 0;
    gPos.copy(guardPostPos);

    if (prankId === 'banana_slip') {
      bananaGroup.visible = true;
      bananaGroup.position.set(guardPostPos.x, guardPostPos.y, guardPostPos.z);
      guardParts.rootGroup.rotation.z = Math.PI * 0.48;
      guardParts.bounceGroup.position.y = 0.34;
      guardParts.legL.rotation.z = Math.sin(elapsed * 26) * 0.9;
      guardParts.legR.rotation.z = -Math.sin(elapsed * 26) * 0.9;
      guardParts.armL.rotation.z = Math.sin(elapsed * 22) * 0.75;
      guardParts.armR.rotation.z = -Math.sin(elapsed * 22) * 0.75;
    } else if (prankId === 'giant_hammer') {
      hammerGroup.visible = true;
      hammerGroup.position.set(guardPostPos.x, guardPostPos.y, guardPostPos.z);
      const swing = pNorm < 0.22 ? pNorm / 0.22 : 1;
      hammerPivot.position.set(-1.5, 0.2, 0);
      hammerPivot.rotation.z = -0.35 - swing * 1.15;
      hammerPivot.visible = pNorm < 0.7;
      if (pNorm >= 0.22) {
        const ringP = Math.min(1, (pNorm - 0.22) / 0.4);
        bonkRing.visible = ringP < 1;
        bonkRing.scale.setScalar(1 + ringP * 3.8);
        bonkRingMat.opacity = (1 - ringP) * 0.9;
        const squish = pNorm < 0.82 ? 0.22 : 0.22 + ((pNorm - 0.82) / 0.18) * 0.78;
        const widen = 1 + (1 - squish) * 0.85;
        guardParts.rootGroup.scale.set(widen, squish, widen);
      } else {
        bonkRing.visible = false;
      }
    } else if (prankId === 'balloon_lift') {
      balloonGroup.visible = true;
      const lift = pNorm < 0.8 ? Math.sin((pNorm / 0.8) * Math.PI * 0.5) * 6.2 : (1 - (pNorm - 0.8) / 0.2) * 6.2;
      gPos.y = guardPostPos.y + lift;
      balloonGroup.position.set(gPos.x, gPos.y, gPos.z);
      balloonGroup.rotation.z = Math.sin(elapsed * 4) * 0.1;
      guardParts.rootGroup.rotation.z = Math.sin(elapsed * 4) * 0.12;
      guardParts.legL.rotation.z = Math.sin(elapsed * 14) * 0.55;
      guardParts.legR.rotation.z = -Math.sin(elapsed * 14) * 0.55;
      guardParts.armL.rotation.z = 1.25;
      guardParts.armR.rotation.z = -1.25;
    } else if (prankId === 'ice_bucket') {
      iceGroup.visible = true;
      iceGroup.position.set(guardPostPos.x, guardPostPos.y, guardPostPos.z);
      const melt = pNorm > 0.85 ? 1 - (pNorm - 0.85) / 0.15 : 1;
      iceGroup.scale.setScalar(Math.max(0.05, melt));
      guardParts.rootGroup.rotation.z = Math.sin(elapsed * 52) * 0.08;
      guardParts.armL.rotation.z = 0.3;
      guardParts.armR.rotation.z = -0.3;
    } else if (prankId === 'thunder_cloud') {
      thunderGroup.visible = true;
      thunderGroup.position.set(guardPostPos.x, guardPostPos.y, guardPostPos.z);
      const zapping = Math.sin(elapsed * 22) > -0.15;
      boltGroup.visible = zapping;
      guardParts.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 45)) * 0.26;
      guardParts.rootGroup.rotation.z = Math.sin(elapsed * 60) * 0.22;
      guardParts.armL.rotation.z = 1.15 + Math.sin(elapsed * 55) * 0.35;
      guardParts.armR.rotation.z = -1.15 - Math.sin(elapsed * 55) * 0.35;
    } else if (prankId === 'meteor_drop') {
      meteorGroup.visible = true;
      meteorGroup.position.set(guardPostPos.x, guardPostPos.y, guardPostPos.z);
      if (pNorm < 0.3) {
        const fallP = pNorm / 0.3;
        meteorRock.visible = true;
        meteorRock.position.set((1 - fallP) * 5.5, (1 - fallP) * 14 + 0.9, (1 - fallP) * 3.5);
        meteorRock.rotation.x = elapsed * 8;
        meteorRock.rotation.z = elapsed * 6;
        blastRing.visible = false;
      } else {
        meteorRock.visible = pNorm < 0.65;
        meteorRock.position.set(0, 0.65, 0);
        const blastP = Math.min(1, (pNorm - 0.3) / 0.45);
        blastRing.visible = blastP < 1;
        blastRing.scale.setScalar(1 + blastP * 5.2);
        blastRingMat.opacity = (1 - blastP) * 0.9;
        const squish = pNorm < 0.84 ? 0.18 : 0.18 + ((pNorm - 0.84) / 0.16) * 0.82;
        const widen = 1 + (1 - squish) * 0.95;
        guardParts.rootGroup.scale.set(widen, squish, widen);
      }
    } else if (prankId === 'tornado_spell') {
      tornadoGroup.visible = true;
      tornadoGroup.position.set(guardPostPos.x, guardPostPos.y, guardPostPos.z);
      tornadoRings.forEach((ring, i) => {
        ring.rotation.z = elapsed * (8 + i * 2.5);
        ring.position.x = Math.sin(elapsed * 9 + i) * 0.18;
        ring.position.z = Math.cos(elapsed * 9 + i) * 0.18;
      });
      gPos.y = guardPostPos.y + Math.sin(pNorm * Math.PI) * 2.4;
      guardParts.rootGroup.rotation.y += 0.52;
      guardParts.armL.rotation.z = 1.3;
      guardParts.armR.rotation.z = -1.3;
    } else if (prankId === 'trash_bucket') {
      bucketGroup.visible = true;
      const stumble = Math.sin(elapsed * 5.5) * 0.95;
      gPos.x = guardPostPos.x + stumble;
      gPos.z = guardPostPos.z + Math.cos(elapsed * 4.2) * 0.55;
      bucketGroup.position.set(gPos.x, gPos.y, gPos.z);
      bucketGroup.rotation.z = Math.sin(elapsed * 14) * 0.15;
      guardParts.rootGroup.rotation.z = Math.sin(elapsed * 14) * 0.18;
      guardParts.armL.rotation.z = 0.9;
      guardParts.armR.rotation.z = -0.9;
    } else if (prankId === 'cream_pie') {
      pieGroup.visible = true;
      pieGroup.position.set(gPos.x, gPos.y, gPos.z);
      if (pNorm < 0.22) {
        const flyP = pNorm / 0.22;
        pieFly.position.set(0, 1.85 + Math.sin(flyP * Math.PI) * 0.6, (1 - flyP) * 4.5 + 0.42);
        pieFly.scale.set(1, 1, 1);
      } else {
        pieFly.position.set(0, 1.82, 0.44);
        pieFly.scale.set(1.28, 1.28, 0.4);
        guardParts.rootGroup.rotation.z = Math.sin(elapsed * 16) * 0.34;
        guardParts.rootGroup.rotation.x = Math.cos(elapsed * 14) * 0.2;
      }
    } else if (prankId === 'fart_bomb') {
      gasGroup.visible = true;
      gasGroup.position.set(guardPostPos.x, guardPostPos.y, guardPostPos.z);
      gasPuffs.forEach((puff, i) => {
        const a = elapsed * 2.2 + (i / gasPuffs.length) * Math.PI * 2;
        const rad = 0.6 + ((elapsed * 0.9 + i * 0.3) % 1.4);
        puff.position.set(Math.cos(a) * rad, 0.5 + ((elapsed * 0.8 + i * 0.35) % 2.2), Math.sin(a) * rad);
        puff.scale.setScalar(0.85 + Math.sin(elapsed * 4 + i) * 0.25);
      });
      const orbit = elapsed * 6.8;
      gPos.x = guardPostPos.x + Math.cos(orbit) * 1.55;
      gPos.z = guardPostPos.z + Math.sin(orbit) * 1.55;
      guardParts.rootGroup.rotation.y = -orbit;
      guardParts.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 22)) * 0.32;
      guardParts.legL.rotation.z = Math.sin(elapsed * 22) * 0.85;
      guardParts.legR.rotation.z = -Math.sin(elapsed * 22) * 0.85;
      guardParts.armL.rotation.z = 1.3;
      guardParts.armR.rotation.z = 1.3;
    } else if (prankId === 'space_kick') {
      rocketGroup.visible = true;
      const arc = Math.sin(pNorm * Math.PI);
      gPos.y = guardPostPos.y + arc * 9.5;
      rocketGroup.position.set(gPos.x, gPos.y + 1.15, gPos.z - 0.52);
      rocketFlame.scale.set(1, 0.85 + Math.sin(elapsed * 40) * 0.35, 1);
      guardParts.rootGroup.rotation.y += 0.26;
      guardParts.armL.rotation.z = 1.45;
      guardParts.armR.rotation.z = -1.45;
      guardParts.legL.rotation.z = Math.sin(elapsed * 28) * 0.7;
      guardParts.legR.rotation.z = -Math.sin(elapsed * 28) * 0.7;
    } else if (prankId === 'morlam_dance') {
      discoGroup.visible = true;
      discoGroup.position.set(guardPostPos.x, guardPostPos.y, guardPostPos.z);
      discoBall.rotation.y = elapsed * 4.5;
      discoLights.forEach((spot, i) => {
        const a = elapsed * 3.8 + (i / discoLights.length) * Math.PI * 2;
        spot.position.x = Math.cos(a) * 1.25;
        spot.position.z = Math.sin(a) * 1.25;
      });
      guardParts.bounceGroup.position.y = Math.abs(Math.sin(elapsed * 13)) * 0.36;
      guardParts.rootGroup.rotation.y = Math.sin(elapsed * 6.5) * 0.95;
      guardParts.armL.rotation.z = Math.sin(elapsed * 13) * 1.3;
      guardParts.armR.rotation.z = -Math.sin(elapsed * 13) * 1.3;
      guardParts.legL.rotation.z = Math.sin(elapsed * 13) * 0.55;
      guardParts.legR.rotation.z = -Math.sin(elapsed * 13) * 0.55;
    }
  };

  return { update, hideAll };
}
