import * as THREE from 'three';

export interface CharacterMeshParts {
  rootGroup: THREE.Group;
  bounceGroup: THREE.Group;
  bodyMesh: THREE.Mesh;
  legL: THREE.Mesh;
  legR: THREE.Mesh;
  armL: THREE.Mesh;
  armR: THREE.Mesh;
  normalEyes: THREE.Group;
  happyFace: THREE.Group;
  angryFace: THREE.Group;
}

export interface BuildCharacterOptions {
  colorHex: string | number;
  accessory: string;
  bandColor: string | number;
  bellyScale?: number;
  showDumbbells?: boolean;
  spectatorProp?: string;
}

export function buildCharacterMesh({
  colorHex,
  accessory,
  bandColor,
  bellyScale = 1,
  showDumbbells = false,
  spectatorProp = '',
}: BuildCharacterOptions): CharacterMeshParts {
  const rootGroup = new THREE.Group();
  const bounceGroup = new THREE.Group();
  rootGroup.add(bounceGroup);

  const bodyMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.35,
    metalness: 0.05,
  });

  const bodyMesh = new THREE.Mesh(new THREE.SphereGeometry(0.75, 24, 24), bodyMat);
  bodyMesh.position.y = 1.05;
  bodyMesh.scale.set(bellyScale, 1.0, bellyScale);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyMesh.userData.isBelly = true;
  bounceGroup.add(bodyMesh);

  const bellyMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xFFFBEB, roughness: 0.5 })
  );
  bellyMesh.position.set(0.32, 0.0, 0);
  bellyMesh.userData.isBelly = true;
  bodyMesh.add(bellyMesh);

  const headGroup = new THREE.Group();
  headGroup.position.set(0.05, 2.05, 0);
  bounceGroup.add(headGroup);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.58, 24, 24), bodyMat);
  headMesh.castShadow = true;
  headGroup.add(headMesh);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18181B });
  const normalEyes = new THREE.Group();
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), eyeMat);
  eyeL.position.set(0.48, 0.08, -0.22);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), eyeMat);
  eyeR.position.set(0.48, 0.08, 0.22);
  normalEyes.add(eyeL, eyeR);
  headGroup.add(normalEyes);

  const happyFace = new THREE.Group();
  happyFace.visible = false;
  const arcGeo = new THREE.TorusGeometry(0.09, 0.028, 8, 14, Math.PI);
  const happyEyeL = new THREE.Mesh(arcGeo, eyeMat);
  happyEyeL.position.set(0.5, 0.06, -0.22);
  happyEyeL.rotation.y = Math.PI / 2;
  const happyEyeR = new THREE.Mesh(arcGeo, eyeMat);
  happyEyeR.position.set(0.5, 0.06, 0.22);
  happyEyeR.rotation.y = Math.PI / 2;
  const smileMesh = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 14, Math.PI), eyeMat);
  smileMesh.position.set(0.53, -0.05, 0);
  smileMesh.rotation.y = Math.PI / 2;
  smileMesh.rotation.z = Math.PI;
  happyFace.add(happyEyeL, happyEyeR, smileMesh);
  headGroup.add(happyFace);

  const angryFace = new THREE.Group();
  angryFace.visible = false;
  const browGeo = new THREE.BoxGeometry(0.05, 0.045, 0.2);
  const browL = new THREE.Mesh(browGeo, eyeMat);
  browL.position.set(0.53, 0.2, -0.2);
  browL.rotation.x = 0.45;
  const browR = new THREE.Mesh(browGeo, eyeMat);
  browR.position.set(0.53, 0.2, 0.2);
  browR.rotation.x = -0.45;
  const frownMesh = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.025, 8, 12, Math.PI), eyeMat);
  frownMesh.position.set(0.53, -0.14, 0);
  frownMesh.rotation.y = Math.PI / 2;
  angryFace.add(browL, browR, frownMesh);
  headGroup.add(angryFace);

  const cheekMat = new THREE.MeshBasicMaterial({ color: 0xFB7185 });
  const cheekL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), cheekMat);
  cheekL.position.set(0.46, -0.06, -0.32);
  const cheekR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 10), cheekMat);
  cheekR.position.set(0.46, -0.06, 0.32);
  headGroup.add(cheekL, cheekR);

  const accMat = new THREE.MeshStandardMaterial({ color: bandColor, roughness: 0.3 });
  if (accessory === 'headband' || accessory === 'chubby') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.07, 10, 24), accMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.2;
    headGroup.add(band);
  } else if (accessory === 'ears' || accessory === 'cat') {
    const earGeo =
      accessory === 'ears'
        ? new THREE.CylinderGeometry(0.08, 0.1, 0.65, 12)
        : new THREE.ConeGeometry(0.16, 0.38, 12);
    const earL = new THREE.Mesh(earGeo, bodyMat);
    earL.position.set(0, 0.65, -0.22);
    const earR = new THREE.Mesh(earGeo, bodyMat);
    earR.position.set(0, 0.65, 0.22);
    headGroup.add(earL, earR);
  } else if (accessory === 'shades') {
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.18, 0.65), accMat);
    glass.position.set(0.52, 0.08, 0);
    headGroup.add(glass);
  } else if (accessory === 'cap') {
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.52),
      accMat
    );
    capDome.position.y = 0.12;
    const capVisor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.06, 16, 1, false, -Math.PI * 0.45, Math.PI * 0.9),
      accMat
    );
    capVisor.position.set(0.38, 0.15, 0);
    capVisor.rotation.y = Math.PI / 2;
    headGroup.add(capDome, capVisor);
  }

  const legGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.45, 12);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x18181B });
  const legL = new THREE.Mesh(legGeo, legMat);
  legL.position.set(0, 0.25, -0.25);
  const legR = new THREE.Mesh(legGeo, legMat);
  legR.position.set(0, 0.25, 0.25);

  const armGeo = new THREE.SphereGeometry(0.18, 12, 12);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(0, 1.15, -0.78);
  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(0, 1.15, 0.78);

  if (showDumbbells || spectatorProp === 'dumbbell') {
    const dbBarMat = new THREE.MeshStandardMaterial({ color: 0x3F3F46, metalness: 0.6, roughness: 0.3 });
    const dbPlateMat = new THREE.MeshStandardMaterial({ color: 0x18181B, roughness: 0.4 });
    [armL, armR].forEach((arm) => {
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42, 8), dbBarMat);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0.18, 0, 0);
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 10), dbPlateMat);
      p1.rotation.z = Math.PI / 2;
      p1.position.set(0.36, 0, 0);
      const p2 = p1.clone();
      p2.position.set(0.0, 0, 0);
      arm.add(bar, p1, p2);
    });
  } else if (spectatorProp === 'eat_pizza') {
    const pizzaGroup = new THREE.Group();
    const cheese = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.28, 0.04, 3),
      new THREE.MeshStandardMaterial({ color: 0xFACC15, roughness: 0.5 })
    );
    const crust = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.05, 0.46),
      new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.7 })
    );
    crust.position.set(-0.14, 0.01, 0);
    const pep = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10),
      new THREE.MeshStandardMaterial({ color: 0xEF4444 })
    );
    pep.position.set(0.03, 0.01, 0);
    pizzaGroup.add(cheese, crust, pep);
    pizzaGroup.position.set(0.26, 0.12, -0.05);
    pizzaGroup.rotation.z = -0.3;
    armR.add(pizzaGroup);
  } else if (spectatorProp === 'boba_tea') {
    const cupGroup = new THREE.Group();
    const cup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.1, 0.36, 14),
      new THREE.MeshStandardMaterial({ color: 0xFDE68A, roughness: 0.3 })
    );
    const bobaBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.1, 0.08, 12),
      new THREE.MeshStandardMaterial({ color: 0x18181B })
    );
    bobaBase.position.y = -0.13;
    const lid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 0.04, 14),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF })
    );
    lid.position.y = 0.19;
    const straw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0xFF4D8D })
    );
    straw.position.set(0.03, 0.28, 0);
    straw.rotation.z = -0.2;
    cupGroup.add(cup, bobaBase, lid, straw);
    cupGroup.position.set(0.24, 0.12, -0.06);
    armR.add(cupGroup);
  } else if (spectatorProp === 'picnic_shabu') {
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.04, 1.8),
      new THREE.MeshStandardMaterial({ color: 0xFB7185, roughness: 0.8 })
    );
    mat.position.set(0.45, -0.12, 0);
    mat.receiveShadow = true;
    const matStripe = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.045, 1.55),
      new THREE.MeshStandardMaterial({ color: 0xFFFBEB, roughness: 0.8 })
    );
    matStripe.position.set(0.45, -0.12, 0);
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.3, 0.24, 16),
      new THREE.MeshStandardMaterial({ color: 0x3F3F46, metalness: 0.5, roughness: 0.3 })
    );
    pot.position.set(0.95, 0.02, 0);
    pot.castShadow = true;
    const soup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.2 })
    );
    soup.position.set(0.95, 0.13, 0);
    const chopstick = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.01, 0.45, 6),
      new THREE.MeshStandardMaterial({ color: 0xD97706 })
    );
    chopstick.rotation.z = -0.9;
    chopstick.position.set(0.24, 0.08, -0.05);
    armR.add(chopstick);
    rootGroup.add(mat, matStripe, pot, soup);
  } else if (spectatorProp === 'play_cards') {
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.04, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x16A34A, roughness: 0.75 })
    );
    mat.position.set(0.45, -0.12, 0);
    mat.receiveShadow = true;
    rootGroup.add(mat);

    const cardWhite = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4 });
    const cardRed = new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.4 });
    [-0.18, 0, 0.18].forEach((cz, idx) => {
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.14), idx === 1 ? cardRed : cardWhite);
      card.position.set(0.9 + (idx % 2) * 0.08, -0.08 + idx * 0.005, cz);
      card.rotation.y = (idx - 1) * 0.35;
      rootGroup.add(card);
    });

    const handCard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.15), cardWhite);
    handCard.position.set(0.22, 0.12, -0.04);
    handCard.rotation.z = -0.35;
    armR.add(handCard);
  } else if (spectatorProp === 'pullup') {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3F3F46, metalness: 0.6, roughness: 0.3 });
    const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.0, 10), poleMat);
    poleL.position.set(0, 1.5, -1.05);
    poleL.castShadow = true;
    const poleR = poleL.clone();
    poleR.position.set(0, 1.5, 1.05);
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.25, 10), poleMat);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, 2.95, 0);
    bar.castShadow = true;
    rootGroup.add(poleL, poleR, bar);
  } else if (spectatorProp === 'pushup' || spectatorProp === 'situp' || spectatorProp === 'food_roll' || spectatorProp === 'phone_scroll') {
    const matColor =
      spectatorProp === 'pushup'
        ? 0x38BDF8
        : spectatorProp === 'situp'
        ? 0xA3E635
        : spectatorProp === 'phone_scroll'
        ? 0xC084FC
        : 0xFEF08A;
    const mat = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.04, 1.5),
      new THREE.MeshStandardMaterial({ color: matColor, roughness: 0.7 })
    );
    mat.position.set(0.15, -0.1, 0);
    mat.receiveShadow = true;
    rootGroup.add(mat);
    if (spectatorProp === 'phone_scroll') {
      const phone = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.26, 0.15),
        new THREE.MeshStandardMaterial({ color: 0x18181B, emissive: 0x38BDF8, emissiveIntensity: 0.45 })
      );
      phone.position.set(0.22, 0.14, -0.05);
      phone.rotation.z = 0.4;
      armR.add(phone);
    }
  } else if (spectatorProp === 'badminton') {
    const racket = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8),
      new THREE.MeshStandardMaterial({ color: 0x18181B })
    );
    const hoop = new THREE.Mesh(
      new THREE.TorusGeometry(0.18, 0.022, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xEF4444 })
    );
    hoop.position.y = 0.36;
    hoop.scale.set(0.85, 1.15, 1);
    racket.add(handle, hoop);
    racket.position.set(0.22, 0.22, 0);
    racket.rotation.z = -0.35;
    armR.add(racket);
  } else if (spectatorProp === 'boxing') {
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0xEF4444, roughness: 0.35 });
    [armL, armR].forEach((arm) => {
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 12), gloveMat);
      glove.position.set(0.12, 0, 0);
      arm.add(glove);
    });
  }

  bounceGroup.add(legL, legR, armL, armR);

  return { rootGroup, bounceGroup, bodyMesh, legL, legR, armL, armR, normalEyes, happyFace, angryFace };
}

export function setCharacterExpression(
  parts: Pick<CharacterMeshParts, 'normalEyes' | 'happyFace' | 'angryFace'>,
  mood: 'normal' | 'happy' | 'angry'
) {
  parts.normalEyes.visible = mood !== 'happy';
  parts.happyFace.visible = mood === 'happy';
  parts.angryFace.visible = mood === 'angry';
}

export function animateCharacterMotion(
  c: CharacterMeshParts & { isSpectator: boolean; workoutType: string },
  elapsed: number,
  idx: number,
  bellyScale: number
) {
  if (c.isSpectator) {
    const t = elapsed * 5 + idx * 0.9;
    if (c.workoutType === 'jumping_jacks') {
      const jump = Math.max(0, Math.sin(t));
      c.bounceGroup.position.y = jump * 0.45;
      c.armL.position.y = 1.15 + jump * 0.65;
      c.armR.position.y = 1.15 + jump * 0.65;
      c.legL.rotation.x = jump * 0.4;
      c.legR.rotation.x = -jump * 0.4;
    } else if (c.workoutType === 'squat') {
      const squat = (Math.sin(t * 0.75) + 1) * 0.5;
      c.bounceGroup.position.y = -squat * 0.16;
      c.bodyMesh.scale.set(bellyScale * (1 + squat * 0.1), 1 - squat * 0.15, bellyScale * (1 + squat * 0.1));
      c.armL.position.x = squat * 0.35;
      c.armR.position.x = squat * 0.35;
    } else if (c.workoutType === 'dumbbell') {
      const curl = (Math.sin(t * 0.9) + 1) * 0.5;
      c.bounceGroup.position.y = Math.abs(Math.sin(t * 0.45)) * 0.08;
      c.armL.position.y = 1.05 + curl * 0.55;
      c.armR.position.y = 1.05 + curl * 0.55;
      c.armL.position.x = 0.25;
      c.armR.position.x = 0.25;
    } else if (c.workoutType === 'jog') {
      const speed = 9.0 + idx * 0.3;
      c.bounceGroup.position.y = Math.abs(Math.sin(elapsed * speed)) * 0.2;
      c.legL.rotation.z = Math.sin(elapsed * speed) * 0.6;
      c.legR.rotation.z = -Math.sin(elapsed * speed) * 0.6;
      c.armL.position.x = Math.sin(elapsed * speed) * 0.22;
      c.armR.position.x = -Math.sin(elapsed * speed) * 0.22;
    } else if (c.workoutType === 'pullup') {
      const pull = (Math.sin(t * 0.75) + 1) * 0.5;
      c.bounceGroup.position.y = 0.28 + pull * 0.55;
      c.armL.position.set(0, 2.15 - pull * 0.45, -0.68);
      c.armR.position.set(0, 2.15 - pull * 0.45, 0.68);
      c.legL.rotation.z = -0.25;
      c.legR.rotation.z = -0.25;
    } else if (c.workoutType === 'pushup') {
      const push = (Math.sin(t * 0.9) + 1) * 0.5;
      c.bounceGroup.rotation.z = -Math.PI / 2;
      c.bounceGroup.position.set(0.85, 0.66 + push * 0.16, 0);
      c.armL.position.set(-0.45 - push * 0.15, 1.35, -0.58);
      c.armR.position.set(-0.45 - push * 0.15, 1.35, 0.58);
    } else if (c.workoutType === 'badminton') {
      const swing = Math.sin(t * 1.1);
      c.bounceGroup.position.y = Math.abs(Math.sin(t * 0.9)) * 0.22;
      c.armR.position.set(0.2 + swing * 0.25, 1.35 + Math.abs(swing) * 0.35, 0.72);
      c.armR.rotation.z = swing * 0.7;
      c.armL.position.set(0, 1.15, -0.78);
    } else if (c.workoutType === 'boxing') {
      const jabL = Math.max(0, Math.sin(t * 1.6));
      const jabR = Math.max(0, -Math.sin(t * 1.6));
      c.bounceGroup.position.y = Math.abs(Math.sin(t * 1.2)) * 0.14;
      c.armL.position.set(0.25 + jabL * 0.55, 1.25, -0.62);
      c.armR.position.set(0.25 + jabR * 0.55, 1.25, 0.62);
    } else if (c.workoutType === 'phone_scroll') {
      c.bounceGroup.rotation.z = 1.48;
      c.bounceGroup.position.set(0.55, 0.54, 0);
      c.legL.position.set(0.2, 0.2, -0.25);
      c.legR.position.set(0.2, 0.2, 0.25);
      c.legL.rotation.z = -0.9;
      c.legR.rotation.z = -0.9;
      c.armR.position.set(0.55, 1.55 + Math.sin(t * 1.5) * 0.04, 0.38);
      c.armL.position.set(0.1, 1.1, -0.68);
    } else if (c.workoutType === 'situp') {
      const sit = (Math.sin(t * 0.85) + 1) * 0.5;
      c.bounceGroup.rotation.z = 1.48 - sit * 1.15;
      c.bounceGroup.position.set(0.45 - sit * 0.25, 0.52 - sit * 0.35, 0);
      c.legL.position.set(0.25, 0.2, -0.25);
      c.legR.position.set(0.25, 0.2, 0.25);
      c.legL.rotation.z = -1.1;
      c.legR.rotation.z = -1.1;
      c.armL.position.set(0.25, 1.45, -0.58);
      c.armR.position.set(0.25, 1.45, 0.58);
    } else if (c.workoutType === 'food_roll') {
      const roll = Math.sin(t * 0.65);
      c.bounceGroup.rotation.z = Math.PI / 2;
      c.bounceGroup.rotation.x = roll * 1.25;
      c.bounceGroup.position.set(0.75, 0.65, roll * 0.38);
      c.bodyMesh.scale.set(bellyScale * 1.15, 1.0, bellyScale * 1.15);
    } else if (c.workoutType === 'picnic_shabu' || c.workoutType === 'play_cards') {
      const eat = (Math.sin(t * 0.8) + 1) * 0.5;
      c.bounceGroup.position.y = -0.3 + Math.sin(t * 0.8) * 0.03;
      c.legL.position.set(0.35, 0.25, -0.25);
      c.legR.position.set(0.35, 0.25, 0.25);
      c.legL.rotation.z = Math.PI / 2;
      c.legR.rotation.z = Math.PI / 2;
      c.armR.position.set(0.35, 1.15 + eat * 0.35, 0.45);
      c.armL.position.set(0.1, 1.05, -0.65);
    } else if (c.workoutType === 'eat_pizza' || c.workoutType === 'boba_tea') {
      const munch = (Math.sin(t * 0.85) + 1) * 0.5;
      c.bounceGroup.position.y = Math.abs(Math.sin(t * 0.6)) * 0.08;
      c.bounceGroup.rotation.z = Math.sin(t * 0.4) * 0.04;
      c.armR.position.set(0.28 + munch * 0.12, 1.18 + munch * 0.38, 0.48);
      c.armL.position.set(0, 1.12, -0.75);
    } else {
      const hop = Math.abs(Math.sin(t * 1.1));
      c.bounceGroup.position.y = hop * 0.35;
      c.bounceGroup.rotation.z = Math.sin(t * 1.1) * 0.08;
      c.armL.position.y = 1.2 + hop * 0.5;
      c.armR.position.y = 1.2 + hop * 0.5;
    }
  } else {
    c.bodyMesh.scale.set(bellyScale, 1.0, bellyScale);
    const speed = 7.5 + idx * 0.4;
    const bounce = Math.abs(Math.sin(elapsed * speed));
    c.bounceGroup.position.y = bounce * 0.22;
    c.bounceGroup.rotation.z = Math.sin(elapsed * speed) * 0.06;

    c.legL.rotation.z = Math.sin(elapsed * speed) * 0.65;
    c.legR.rotation.z = -Math.sin(elapsed * speed) * 0.65;
    c.armL.position.x = Math.sin(elapsed * speed) * 0.25;
    c.armR.position.x = -Math.sin(elapsed * speed) * 0.25;
  }
}

export interface PetMeshParts {
  petGroup: THREE.Group;
  tailMesh: THREE.Mesh;
  leashMesh?: THREE.Mesh;
}

const PET_COLORS: Record<string, { body: number; accent: number }> = {
  dog: { body: 0xF59E0B, accent: 0x92400E },
  cat: { body: 0xFB923C, accent: 0xFFFBEB },
  rabbit: { body: 0xF8FAFC, accent: 0xF472B6 },
  pig: { body: 0xF472B6, accent: 0xFB7185 },
};

export function buildPetMesh(petType: string): PetMeshParts | null {
  if (!petType || petType === 'none' || !PET_COLORS[petType]) return null;
  const palette = PET_COLORS[petType];
  const petGroup = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.45 });
  const accentMat = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.45 });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18181B });

  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 16), bodyMat);
  torso.scale.set(1.25, 0.85, 0.85);
  torso.position.y = 0.36;
  torso.castShadow = true;
  petGroup.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), bodyMat);
  head.position.set(0.32, 0.54, 0);
  head.castShadow = true;
  petGroup.add(head);

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), eyeMat);
  eyeL.position.set(0.51, 0.59, -0.09);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.038, 8, 8), eyeMat);
  eyeR.position.set(0.51, 0.59, 0.09);
  petGroup.add(eyeL, eyeR);

  if (petType === 'dog') {
    const earGeo = new THREE.BoxGeometry(0.08, 0.2, 0.09);
    const earL = new THREE.Mesh(earGeo, accentMat);
    earL.position.set(0.3, 0.54, -0.22);
    earL.rotation.x = 0.25;
    const earR = new THREE.Mesh(earGeo, accentMat);
    earR.position.set(0.3, 0.54, 0.22);
    earR.rotation.x = -0.25;
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 10), accentMat);
    snout.position.set(0.52, 0.5, 0);
    petGroup.add(earL, earR, snout);
  } else if (petType === 'cat') {
    const earGeo = new THREE.ConeGeometry(0.07, 0.18, 8);
    const earL = new THREE.Mesh(earGeo, bodyMat);
    earL.position.set(0.3, 0.78, -0.12);
    const earR = new THREE.Mesh(earGeo, bodyMat);
    earR.position.set(0.3, 0.78, 0.12);
    petGroup.add(earL, earR);
  } else if (petType === 'rabbit') {
    const earGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.34, 10);
    const earL = new THREE.Mesh(earGeo, bodyMat);
    earL.position.set(0.28, 0.85, -0.09);
    const earR = new THREE.Mesh(earGeo, bodyMat);
    earR.position.set(0.28, 0.85, 0.09);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), accentMat);
    nose.position.set(0.55, 0.52, 0);
    petGroup.add(earL, earR, nose);
  } else if (petType === 'pig') {
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.08, 12), accentMat);
    snout.rotation.z = Math.PI / 2;
    snout.position.set(0.55, 0.5, 0);
    const earGeo = new THREE.ConeGeometry(0.06, 0.12, 8);
    const earL = new THREE.Mesh(earGeo, accentMat);
    earL.position.set(0.3, 0.76, -0.13);
    const earR = new THREE.Mesh(earGeo, accentMat);
    earR.position.set(0.3, 0.76, 0.13);
    petGroup.add(snout, earL, earR);
  }

  const legGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.24, 8);
  [
    [0.2, 0.12, -0.14],
    [0.2, 0.12, 0.14],
    [-0.2, 0.12, -0.14],
    [-0.2, 0.12, 0.14],
  ].forEach(([lx, ly, lz]) => {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(lx, ly, lz);
    petGroup.add(leg);
  });

  const tailMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.045, petType === 'rabbit' ? 0.12 : 0.26, 8),
    petType === 'rabbit' ? accentMat : bodyMat
  );
  tailMesh.position.set(-0.38, 0.45, 0);
  tailMesh.rotation.z = 0.7;
  petGroup.add(tailMesh);

  let leashMesh: THREE.Mesh | undefined;
  if (petType === 'dog') {
    leashMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 1, 8),
      new THREE.MeshBasicMaterial({ color: 0xEF4444 })
    );
    leashMesh.rotation.z = Math.PI / 2;
  }

  return { petGroup, tailMesh, leashMesh };
}

export function animatePetMotion(
  petParts: PetMeshParts,
  ownerParts: CharacterMeshParts,
  petType: string,
  isCloseToFinish: boolean,
  elapsed: number,
  idx: number
) {
  const t = elapsed * 8 + idx;
  let targetX = 0.9;
  let targetZ = 0.65;
  let hop = Math.abs(Math.sin(t)) * 0.15;

  if (petType === 'dog') {
    if (!isCloseToFinish) {
      // Dog drags owner from the front!
      targetX = 1.35;
      targetZ = 0.35;
      hop = Math.abs(Math.sin(t * 1.3)) * 0.2;
      ownerParts.bounceGroup.rotation.z = 0.14 + Math.sin(t) * 0.04;
    } else {
      // Close to finish: owner leads the dog!
      targetX = -1.25;
      targetZ = 0.45;
      hop = Math.abs(Math.sin(t)) * 0.14;
    }
  } else if (petType === 'cat') {
    if (!isCloseToFinish) {
      targetX = -1.15;
      targetZ = 0.55;
      hop = Math.abs(Math.sin(t * 0.4)) * 0.04;
    } else {
      targetX = 0.75;
      targetZ = 0.65;
      hop = Math.abs(Math.sin(t * 1.1)) * 0.18;
    }
  } else if (petType === 'rabbit') {
    targetX = isCloseToFinish ? 0.85 : 1.25;
    targetZ = -0.58;
    hop = Math.abs(Math.sin(t * 1.4)) * 0.34;
  } else if (petType === 'pig') {
    targetX = isCloseToFinish ? 1.2 : -1.05;
    targetZ = 0.58;
    hop = Math.abs(Math.sin(t * (isCloseToFinish ? 1.2 : 0.6))) * 0.12;
  }

  petParts.petGroup.position.set(targetX, hop, targetZ);
  petParts.tailMesh.rotation.y = Math.sin(elapsed * 14) * 0.5;

  if (petParts.leashMesh) {
    const start = new THREE.Vector3(0.1, 1.05, 0.72);
    const end = new THREE.Vector3(targetX + 0.25, hop + 0.48, targetZ);
    const mid = start.clone().add(end).multiplyScalar(0.5);
    const dist = start.distanceTo(end);
    petParts.leashMesh.position.copy(mid);
    petParts.leashMesh.scale.set(1, dist, 1);
    petParts.leashMesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize()
    );
  }
}
