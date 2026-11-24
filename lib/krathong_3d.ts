import * as THREE from 'three';
import type { KrathongStyleId } from '@/lib/krathong_catalog';

export interface KrathongAvatarSpec {
  colorHex?: string;
  bandColor?: string;
  species?: string;
  emoji?: string;
}

export interface KrathongMeshParts {
  group: THREE.Group;
  floatBody: THREE.Group;
  flameMesh: THREE.Mesh;
  glowSprite: THREE.Sprite;
  rippleRing: THREE.Mesh;
  mascotGroup?: THREE.Group;
}

let sharedCandleGlowTex: THREE.CanvasTexture | null = null;

function getCandleGlowTexture(): THREE.CanvasTexture {
  if (sharedCandleGlowTex) return sharedCandleGlowTex;
  if (typeof document === 'undefined') {
    const fallback = new THREE.CanvasTexture(
      Object.assign({ width: 2, height: 2 }) as HTMLCanvasElement
    );
    return fallback;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255, 251, 235, 0.95)');
    grad.addColorStop(0.28, 'rgba(253, 224, 71, 0.65)');
    grad.addColorStop(0.62, 'rgba(249, 115, 22, 0.25)');
    grad.addColorStop(1, 'rgba(249, 115, 22, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.isSharedGltfResource = true;
  sharedCandleGlowTex = tex;
  return tex;
}

function safeColor(hex: string | undefined, fallback: number): THREE.Color {
  try {
    if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex.trim())) {
      return new THREE.Color(hex.trim());
    }
  } catch {
    // ignore invalid hex
  }
  return new THREE.Color(fallback);
}

function addCuteEyesAndCheeks(
  target: THREE.Group,
  headY: number,
  frontZ: number,
  spreadX = 0.095,
  cheekColor = 0xf472b6
) {
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
  const shineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const cheekMat = new THREE.MeshBasicMaterial({
    color: cheekColor,
    transparent: true,
    opacity: 0.75,
  });

  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), eyeMat);
    eye.position.set(side * spreadX, headY + 0.02, frontZ);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 6), shineMat);
    shine.position.set(side * spreadX + 0.01, headY + 0.032, frontZ + 0.024);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.036, 8, 8), cheekMat);
    cheek.scale.set(1.2, 0.75, 0.5);
    cheek.position.set(side * (spreadX + 0.055), headY - 0.025, frontZ - 0.015);
    target.add(eye, shine, cheek);
  });
}

function buildPetalRing(
  parent: THREE.Group,
  count: number,
  radius: number,
  y: number,
  petalColor: THREE.ColorRepresentation,
  tiltOut = 0.45,
  scale = 1,
  angleOffset = 0
) {
  const mat = new THREE.MeshStandardMaterial({
    color: petalColor,
    roughness: 0.45,
    metalness: 0.05,
  });
  for (let i = 0; i < count; i++) {
    const a = angleOffset + (i / count) * Math.PI * 2;
    const pivot = new THREE.Group();
    pivot.rotation.y = a;
    const petal = new THREE.Mesh(new THREE.ConeGeometry(0.16 * scale, 0.36 * scale, 6), mat);
    petal.scale.set(1.05, 1, 0.48);
    petal.position.set(0, y + 0.08 * scale, radius);
    petal.rotation.x = tiltOut;
    pivot.add(petal);
    parent.add(pivot);
  }
}

function buildCandleAndIncense(
  parent: THREE.Group,
  offsetX = 0,
  offsetY = 0.24,
  offsetZ = 0.16,
  candleHex: THREE.ColorRepresentation = 0xfef08a
): { flameMesh: THREE.Mesh; glowSprite: THREE.Sprite } {
  const candleGroup = new THREE.Group();
  candleGroup.position.set(offsetX, offsetY, offsetZ);

  const waxMat = new THREE.MeshStandardMaterial({
    color: candleHex,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.22,
    roughness: 0.4,
  });
  const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.048, 0.3, 10), waxMat);
  candle.position.y = 0.15;
  candleGroup.add(candle);

  // 3 thin incense sticks fanning behind candle
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7 });
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  [-1, 0, 1].forEach((idx) => {
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.38, 6), stickMat);
    stick.position.set(idx * 0.032, 0.18, -0.055);
    stick.rotation.z = -idx * 0.12;
    stick.rotation.x = -0.14;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), emberMat);
    tip.position.set(idx * 0.052, 0.36, -0.08);
    candleGroup.add(stick, tip);
  });

  // Glowing tear-drop flame
  const flamePivot = new THREE.Mesh(
    new THREE.ConeGeometry(0.058, 0.17, 10),
    new THREE.MeshBasicMaterial({ color: 0xfef08a })
  );
  flamePivot.position.y = 0.37;
  const innerCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.038, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  innerCore.position.y = -0.03;
  flamePivot.add(innerCore);
  candleGroup.add(flamePivot);

  const glowMat = new THREE.SpriteMaterial({
    map: getCandleGlowTexture(),
    color: 0xfde047,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glowSprite = new THREE.Sprite(glowMat);
  glowSprite.position.set(offsetX, offsetY + 0.38, offsetZ);
  glowSprite.scale.set(1.15, 1.15, 1);

  parent.add(candleGroup, glowSprite);
  return { flameMesh: flamePivot, glowSprite };
}

function addMarigolds(parent: THREE.Group, count: number, radius: number, y: number) {
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.15,
    roughness: 0.5,
  });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.5 });
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.25;
    const m = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.075, 0),
      i % 2 === 0 ? goldMat : orangeMat
    );
    m.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    parent.add(m);
  }
}

export function buildKrathongMesh(
  styleId: KrathongStyleId,
  avatar?: KrathongAvatarSpec
): KrathongMeshParts {
  const group = new THREE.Group();
  const floatBody = new THREE.Group();
  group.add(floatBody);

  // Subtle glowing water ripple ring around the base
  const rippleRing = new THREE.Mesh(
    new THREE.RingGeometry(0.68, 0.92, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.34,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  rippleRing.rotation.x = -Math.PI / 2;
  rippleRing.position.y = 0.02;
  group.add(rippleRing);

  let flameMesh!: THREE.Mesh;
  let glowSprite!: THREE.Sprite;
  let mascotGroup: THREE.Group | undefined;

  if (styleId === 'moo_deng') {
    // Giant green lotus leaf + pink lotus rim + bouncy baby hippo Moo Deng!
    const leafPad = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.64, 0.12, 20),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 })
    );
    leafPad.position.y = 0.07;
    floatBody.add(leafPad);
    buildPetalRing(floatBody, 10, 0.54, 0.1, 0xf472b6, 0.52, 0.92);

    const hippo = new THREE.Group();
    hippo.position.set(0, 0.14, -0.06);
    const hippoMat = new THREE.MeshStandardMaterial({ color: 0x9d7b8d, roughness: 0.32 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.38 });
    const mouthInMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.5 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), hippoMat);
    body.scale.set(1.08, 0.85, 1.18);
    body.position.set(0, 0.16, -0.06);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), hippoMat);
    head.position.set(0, 0.32, 0.14);

    // Wide open adorable snout
    const upperJaw = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), hippoMat);
    upperJaw.scale.set(1.18, 0.72, 1.0);
    upperJaw.position.set(0, 0.33, 0.3);

    const openMouth = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 10), mouthInMat);
    openMouth.scale.set(1.05, 0.68, 0.9);
    openMouth.position.set(0, 0.24, 0.29);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), pinkMat);
    belly.position.set(0, 0.12, 0.06);

    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), pinkMat);
      ear.position.set(s * 0.17, 0.49, 0.08);
      hippo.add(ear);
    });
    addCuteEyesAndCheeks(hippo, 0.39, 0.29, 0.12, 0xf43f5e);
    hippo.add(body, belly, head, upperJaw, openMouth);
    floatBody.add(hippo);
    mascotGroup = hippo;

    const c = buildCandleAndIncense(floatBody, 0, 0.13, 0.44, 0xfbcfe8);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else if (styleId === 'capybara_yuzu') {
    // Hinoki wooden tub + warm turquoise onsen water + chill Capybara with yuzu orange on head!
    const tub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.58, 0.26, 18),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.72 })
    );
    tub.position.y = 0.14;
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.025, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6 })
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.16;
    const onsenWater = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, 0.05, 18),
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.25,
        roughness: 0.2,
      })
    );
    onsenWater.position.y = 0.26;
    floatBody.add(tub, band, onsenWater);

    const orangeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.35 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 });
    [
      [-0.36, 0.28, 0.18],
      [0.38, 0.28, -0.14],
    ].forEach(([ox, oy, oz]) => {
      const yuzu = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 10), orangeMat);
      yuzu.scale.set(1, 0.85, 1);
      yuzu.position.set(ox, oy, oz);
      floatBody.add(yuzu);
    });

    const capy = new THREE.Group();
    capy.position.set(0, 0.22, -0.05);
    const furMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.75 });
    const snoutMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.75 });
    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), furMat);
    torso.scale.set(1.05, 0.85, 1.15);
    torso.position.y = 0.08;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.38), furMat);
    head.position.set(0, 0.25, 0.08);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.16), snoutMat);
    snout.position.set(0, 0.22, 0.28);
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), snoutMat);
      ear.position.set(s * 0.13, 0.39, -0.02);
      capy.add(ear);
    });
    const headYuzu = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 10), orangeMat);
    headYuzu.scale.set(1, 0.82, 1);
    headYuzu.position.set(0, 0.44, 0.06);
    const yuzuLeaf = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 5), leafMat);
    yuzuLeaf.position.set(0.02, 0.52, 0.06);
    yuzuLeaf.rotation.z = -0.5;
    addCuteEyesAndCheeks(capy, 0.27, 0.275, 0.11, 0xfb923c);
    capy.add(torso, head, snout, headYuzu, yuzuLeaf);
    floatBody.add(capy);
    mascotGroup = capy;

    const c = buildCandleAndIncense(floatBody, 0, 0.26, 0.42, 0xfef08a);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else if (styleId === 'corgi_butt') {
    // Golden braided bread Krathong + loafing Corgi with upright ears & pink toe beans!
    const breadBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.56, 0.2, 18),
      new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.65 })
    );
    breadBase.position.y = 0.11;
    const breadRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.09, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.58 })
    );
    breadRim.rotation.x = Math.PI / 2;
    breadRim.position.y = 0.2;
    floatBody.add(breadBase, breadRim);
    addMarigolds(floatBody, 8, 0.54, 0.28);

    const corgi = new THREE.Group();
    corgi.position.set(0, 0.2, -0.04);
    const orangeFur = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 });
    const creamFur = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.6 });
    const pinkBean = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 });

    const loaf = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.24, 8, 12), orangeFur);
    loaf.rotation.x = Math.PI / 2;
    loaf.position.set(0, 0.14, -0.04);

    const buttFluff = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), creamFur);
    buttFluff.scale.set(1.15, 0.92, 0.75);
    buttFluff.position.set(0, 0.14, -0.22);

    const nubTail = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), creamFur);
    nubTail.position.set(0, 0.25, -0.28);

    [-1, 1].forEach((s) => {
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), creamFur);
      paw.position.set(s * 0.13, 0.08, -0.29);
      const bean = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 6), pinkBean);
      bean.position.set(s * 0.13, 0.08, -0.345);
      corgi.add(paw, bean);
    });

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), orangeFur);
    head.position.set(0, 0.3, 0.15);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), creamFur);
    muzzle.position.set(0, 0.26, 0.31);
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.22, 8), orangeFur);
      ear.position.set(s * 0.14, 0.48, 0.13);
      ear.rotation.z = -s * 0.22;
      corgi.add(ear);
    });
    addCuteEyesAndCheeks(corgi, 0.32, 0.33, 0.095, 0xfb7185);
    corgi.add(loaf, buttFluff, nubTail, head, muzzle);
    floatBody.add(corgi);
    mascotGroup = corgi;

    const c = buildCandleAndIncense(floatBody, 0, 0.22, 0.44, 0xfef08a);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else if (styleId === 'orange_cat') {
    // Lotus cushion + chubby Orange Tabby hugging a golden Mackerel!
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.54, 0.16, 18),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 })
    );
    base.position.y = 0.09;
    floatBody.add(base);
    buildPetalRing(floatBody, 10, 0.52, 0.12, 0xfb7185, 0.48, 0.92);

    const cat = new THREE.Group();
    cat.position.set(0, 0.17, -0.05);
    const catMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.55 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.55 });
    const goldFishMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.45,
      roughness: 0.28,
    });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), catMat);
    body.scale.set(1.12, 0.9, 1.05);
    body.position.y = 0.14;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), bellyMat);
    belly.position.set(0, 0.13, 0.11);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), catMat);
    head.scale.set(1.1, 0.96, 1);
    head.position.set(0, 0.34, 0.08);

    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.17, 6), catMat);
      ear.position.set(s * 0.14, 0.5, 0.07);
      ear.rotation.z = -s * 0.25;
      cat.add(ear);
    });

    // Golden fish hugged across belly
    const fishBody = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), goldFishMat);
    fishBody.scale.set(1.75, 0.68, 0.65);
    fishBody.position.set(0.03, 0.18, 0.24);
    const fishTail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.13, 4), goldFishMat);
    fishTail.rotation.z = Math.PI / 2;
    fishTail.position.set(-0.18, 0.18, 0.24);

    addCuteEyesAndCheeks(cat, 0.35, 0.27, 0.095, 0xf43f5e);
    cat.add(body, belly, head, fishBody, fishTail);
    floatBody.add(cat);
    mascotGroup = cat;

    const c = buildCandleAndIncense(floatBody, 0, 0.18, 0.44, 0xfde047);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else if (styleId === 'bunny_mochi') {
    // Sakura pink petal Krathong + plump snowy Mochi Bunny + mini carrot!
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.52, 0.16, 18),
      new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.45 })
    );
    base.position.y = 0.09;
    floatBody.add(base);
    buildPetalRing(floatBody, 12, 0.52, 0.12, 0xf9a8d4, 0.46, 0.9);
    buildPetalRing(floatBody, 10, 0.42, 0.17, 0xfdf2f8, 0.34, 0.78, 0.3);

    const bunny = new THREE.Group();
    bunny.position.set(0, 0.18, -0.04);
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const pinkMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.45 });
    const mochiBody = new THREE.Mesh(new THREE.SphereGeometry(0.25, 14, 12), whiteMat);
    mochiBody.scale.set(1.15, 0.88, 1.08);
    mochiBody.position.y = 0.14;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), whiteMat);
    head.scale.set(1.12, 0.96, 1.02);
    head.position.set(0, 0.33, 0.06);
    [-1, 1].forEach((s) => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.22, 6, 8), whiteMat);
      ear.position.set(s * 0.1, 0.56, 0.04);
      ear.rotation.z = -s * 0.14;
      const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.16, 4, 6), pinkMat);
      inner.position.set(s * 0.1, 0.55, 0.075);
      inner.rotation.z = -s * 0.14;
      bunny.add(ear, inner);
    });
    const carrot = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.22, 8),
      new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 })
    );
    carrot.rotation.z = Math.PI / 2.3;
    carrot.position.set(0.04, 0.18, 0.24);
    addCuteEyesAndCheeks(bunny, 0.34, 0.26, 0.095, 0xf472b6);
    bunny.add(mochiBody, head, carrot);
    floatBody.add(bunny);
    mascotGroup = bunny;

    const c = buildCandleAndIncense(floatBody, 0, 0.18, 0.43, 0xf9a8d4);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else if (styleId === 'guard_pork') {
    // Arena Guard Signature: Black-and-gold Guard Cap + Golden Crispy Pork Plate + Silver Fork!
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.58, 0.18, 18),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.5 })
    );
    base.position.y = 0.1;
    const goldBand = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.035, 8, 22),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.65, roughness: 0.25 })
    );
    goldBand.rotation.x = Math.PI / 2;
    goldBand.position.y = 0.18;
    floatBody.add(base, goldBand);
    buildPetalRing(floatBody, 10, 0.54, 0.12, 0xfacc15, 0.5, 0.88);

    const guardTop = new THREE.Group();
    guardTop.position.set(0, 0.19, -0.05);

    // Guard Cap on back-left
    const capCrown = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.19, 0.14, 14),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45 })
    );
    capCrown.position.set(-0.14, 0.16, -0.08);
    const capVisor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.03, 12, 1, false, -Math.PI / 2, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.3 })
    );
    capVisor.position.set(-0.14, 0.1, 0.03);
    const capBadge = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.055, 0),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, emissive: 0xf59e0b, emissiveIntensity: 0.4 })
    );
    capBadge.position.set(-0.14, 0.18, 0.11);

    // Crispy Pork Belly Plate on right
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.16, 0.05, 14),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })
    );
    plate.position.set(0.18, 0.06, 0.02);
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.45 });
    const meatMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.55 });
    for (let p = 0; p < 5; p++) {
      const cube = new THREE.Group();
      const meat = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.065, 0.085), meatMat);
      const crackling = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.09), skinMat);
      crackling.position.y = 0.045;
      cube.add(meat, crackling);
      const pa = (p / 5) * Math.PI * 2;
      cube.position.set(
        0.18 + Math.cos(pa) * 0.075,
        0.12 + (p % 2) * 0.045,
        0.02 + Math.sin(pa) * 0.075
      );
      cube.rotation.y = pa;
      guardTop.add(cube);
    }

    // Giant shiny silver fork standing upright
    const silverMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.8,
      roughness: 0.18,
    });
    const forkHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.42, 8), silverMat);
    forkHandle.position.set(0.22, 0.28, -0.14);
    forkHandle.rotation.z = -0.18;
    const forkHead = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.02), silverMat);
    forkHead.position.set(0.26, 0.5, -0.14);
    forkHead.rotation.z = -0.18;

    guardTop.add(capCrown, capVisor, capBadge, plate, forkHandle, forkHead);
    floatBody.add(guardTop);
    mascotGroup = guardTop;

    const c = buildCandleAndIncense(floatBody, 0, 0.19, 0.42, 0xfacc15);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else if (styleId === 'shabu_pot') {
    // Two-flavor Yin-Yang Shabu Hotpot Krathong!
    const lotusBase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.66, 0.58, 0.12, 18),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.6 })
    );
    lotusBase.position.y = 0.07;
    floatBody.add(lotusBase);
    buildPetalRing(floatBody, 10, 0.56, 0.1, 0xfef08a, 0.52, 0.88);

    const potGroup = new THREE.Group();
    potGroup.position.y = 0.13;
    const potMetal = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.65,
      roughness: 0.28,
    });
    const potWall = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.38, 0.24, 20), potMetal);
    potWall.position.y = 0.12;

    // Two soup halves: spicy mala red & golden clear broth
    const malaSoup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16, 1, false, 0, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0xdc2626,
        emissive: 0x991b1b,
        emissiveIntensity: 0.3,
        roughness: 0.25,
      })
    );
    malaSoup.position.y = 0.23;
    const clearSoup = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 0.04, 16, 1, false, Math.PI, Math.PI),
      new THREE.MeshStandardMaterial({
        color: 0xfde68a,
        emissive: 0xd97706,
        emissiveIntensity: 0.2,
        roughness: 0.25,
      })
    );
    clearSoup.position.y = 0.23;
    const divider = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.84), potMetal);
    divider.position.y = 0.23;

    // Handles + cute meatballs & pork rolls
    [-1, 1].forEach((s) => {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.02, 6, 12), potMetal);
      handle.position.set(s * 0.46, 0.18, 0);
      potGroup.add(handle);
    });
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.4 });
    const porkMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.45 });
    const veggieMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.5 });
    [
      [-0.18, 0.26, 0.12, ballMat],
      [-0.16, 0.26, -0.15, porkMat],
      [0.18, 0.26, 0.14, porkMat],
      [0.16, 0.26, -0.14, veggieMat],
    ].forEach(([ix, iy, iz, mat]) => {
      const item = new THREE.Mesh(
        new THREE.SphereGeometry(0.068, 8, 8),
        mat as THREE.MeshStandardMaterial
      );
      item.position.set(ix as number, iy as number, iz as number);
      potGroup.add(item);
    });

    potGroup.add(potWall, malaSoup, clearSoup, divider);
    floatBody.add(potGroup);
    mascotGroup = potGroup;

    const c = buildCandleAndIncense(floatBody, 0, 0.36, 0, 0xfef08a);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else if (styleId === 'dragon_gold') {
    // Auspicious Golden & Crimson Dragon Boat Krathong!
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.64, 0.54, 0.18, 18),
      new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.45 })
    );
    base.position.y = 0.1;
    floatBody.add(base);
    buildPetalRing(floatBody, 12, 0.54, 0.12, 0xfacc15, 0.46, 0.92);

    const dragon = new THREE.Group();
    dragon.position.y = 0.18;
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xb45309,
      emissiveIntensity: 0.2,
      metalness: 0.6,
      roughness: 0.25,
    });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.34, 10), redMat);
    neck.position.set(0, 0.18, 0.22);
    neck.rotation.x = 0.32;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.32), goldMat);
    head.position.set(0, 0.36, 0.32);
    [-1, 1].forEach((s) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 6), goldMat);
      horn.position.set(s * 0.09, 0.52, 0.24);
      horn.rotation.x = -0.35;
      dragon.add(horn);
    });
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.38, 8), goldMat);
    tail.position.set(0, 0.24, -0.34);
    tail.rotation.x = -0.45;
    addCuteEyesAndCheeks(dragon, 0.38, 0.48, 0.085, 0xfef08a);
    dragon.add(neck, head, tail);
    floatBody.add(dragon);
    mascotGroup = dragon;

    const c = buildCandleAndIncense(floatBody, 0, 0.19, -0.02, 0xfef08a);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else if (styleId === 'unicorn_pastel') {
    // Fluffy Pastel Cloud Krathong + Rainbow Unicorn with glowing golden horn!
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.5, 0.14, 16), cloudMat);
    base.position.y = 0.08;
    floatBody.add(base);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const puffColors = [0xfbcfe8, 0xe9d5ff, 0xbae6fd, 0xfef08a];
      const puff = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 10),
        new THREE.MeshStandardMaterial({ color: puffColors[i % puffColors.length], roughness: 0.4 })
      );
      puff.position.set(Math.cos(a) * 0.48, 0.14, Math.sin(a) * 0.48);
      floatBody.add(puff);
    }

    const uni = new THREE.Group();
    uni.position.set(0, 0.18, -0.04);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 12), cloudMat);
    body.position.y = 0.13;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 12), cloudMat);
    head.position.set(0, 0.33, 0.08);
    const horn = new THREE.Mesh(
      new THREE.ConeGeometry(0.045, 0.24, 8),
      new THREE.MeshStandardMaterial({
        color: 0xfef08a,
        emissive: 0xfacc15,
        emissiveIntensity: 0.45,
        metalness: 0.5,
      })
    );
    horn.position.set(0, 0.54, 0.14);
    horn.rotation.x = 0.25;

    [0xf472b6, 0x38bdf8, 0xc084fc].forEach((mCol, mi) => {
      const mane = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 8, 8),
        new THREE.MeshStandardMaterial({ color: mCol, roughness: 0.4 })
      );
      mane.position.set(0, 0.42 - mi * 0.09, -0.08 - mi * 0.03);
      uni.add(mane);
    });
    addCuteEyesAndCheeks(uni, 0.34, 0.27, 0.09, 0xf472b6);
    uni.add(body, head, horn);
    floatBody.add(uni);
    mascotGroup = uni;

    const c = buildCandleAndIncense(floatBody, 0, 0.18, 0.42, 0xe9d5ff);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else if (styleId === 'banana_leaf') {
    // Traditional Thai Folded Banana Leaf Krathong with Marigolds & Orchids
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.52, 0.18, 20),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.65 })
    );
    trunk.position.y = 0.1;
    floatBody.add(trunk);
    buildPetalRing(floatBody, 14, 0.54, 0.12, 0x16a34a, 0.42, 0.95);
    buildPetalRing(floatBody, 12, 0.43, 0.18, 0x4ade80, 0.28, 0.82, 0.26);
    addMarigolds(floatBody, 8, 0.31, 0.24);
    // Purple orchid accents
    const orchidMat = new THREE.MeshStandardMaterial({ color: 0xa855f7, roughness: 0.45 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const orchid = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), orchidMat);
      orchid.position.set(Math.cos(a) * 0.18, 0.26, Math.sin(a) * 0.18);
      floatBody.add(orchid);
    }

    const c = buildCandleAndIncense(floatBody, 0, 0.2, 0, 0xfacc15);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else if (styleId === 'my_character') {
    // Custom Player Mascot Krathong using their own colorHex, bandColor, and species ears!
    const bodyCol = safeColor(avatar?.colorHex, 0xf472b6);
    const bandCol = safeColor(avatar?.bandColor, 0xffe600);
    const sp = (avatar?.species || 'bunny').toLowerCase();

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.54, 0.16, 18),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.58 })
    );
    base.position.y = 0.09;
    floatBody.add(base);
    buildPetalRing(floatBody, 12, 0.53, 0.12, bodyCol, 0.48, 0.92);
    buildPetalRing(floatBody, 10, 0.42, 0.17, bandCol, 0.34, 0.78, 0.28);

    const mascot = new THREE.Group();
    mascot.position.set(0, 0.18, -0.05);
    const mainMat = new THREE.MeshStandardMaterial({ color: bodyCol, roughness: 0.42 });
    const accentMat = new THREE.MeshStandardMaterial({ color: bandCol, roughness: 0.4 });

    const torso = new THREE.Mesh(new THREE.SphereGeometry(0.23, 14, 12), mainMat);
    torso.scale.set(1.08, 0.92, 1);
    torso.position.y = 0.13;
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 8, 16), accentMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.23;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 12), mainMat);
    head.position.set(0, 0.36, 0.05);
    const headband = new THREE.Mesh(
      new THREE.TorusGeometry(0.205, 0.025, 8, 18),
      accentMat
    );
    headband.rotation.x = Math.PI / 2 - 0.15;
    headband.position.set(0, 0.43, 0.05);

    // Species-inspired cute ears/horns
    if (sp.includes('bunny') || sp.includes('lop') || sp.includes('kangaroo')) {
      [-1, 1].forEach((s) => {
        const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.2, 6, 8), mainMat);
        ear.position.set(s * 0.1, 0.58, 0.04);
        ear.rotation.z = -s * 0.15;
        mascot.add(ear);
      });
    } else if (sp.includes('dragon') || sp.includes('unicorn') || sp.includes('bull')) {
      [-1, 1].forEach((s) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.18, 7), accentMat);
        horn.position.set(s * 0.1, 0.56, 0.06);
        horn.rotation.z = -s * 0.22;
        mascot.add(horn);
      });
    } else if (
      sp.includes('bear') ||
      sp.includes('panda') ||
      sp.includes('monkey') ||
      sp.includes('hamster') ||
      sp.includes('hippo') ||
      sp.includes('capybara')
    ) {
      [-1, 1].forEach((s) => {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.068, 8, 8), mainMat);
        ear.position.set(s * 0.16, 0.52, 0.04);
        mascot.add(ear);
      });
    } else {
      // Cat / Fox / Corgi / Husky / Wolf pointed ears
      [-1, 1].forEach((s) => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.17, 6), mainMat);
        ear.position.set(s * 0.13, 0.53, 0.05);
        ear.rotation.z = -s * 0.24;
        mascot.add(ear);
      });
    }

    addCuteEyesAndCheeks(mascot, 0.36, 0.25, 0.09, 0xf472b6);
    mascot.add(torso, scarf, head, headband);
    floatBody.add(mascot);
    mascotGroup = mascot;

    const c = buildCandleAndIncense(floatBody, 0, 0.19, 0.42, 0xfef08a);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  } else {
    // 'lotus_classic' default: Lush Royal 3-Tier Blooming Pink Lotus Krathong
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.52, 0.16, 20),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.58 })
    );
    base.position.y = 0.09;
    floatBody.add(base);
    buildPetalRing(floatBody, 14, 0.54, 0.11, 0xf472b6, 0.54, 0.96);
    buildPetalRing(floatBody, 12, 0.43, 0.17, 0xf9a8d4, 0.38, 0.85, 0.25);
    buildPetalRing(floatBody, 10, 0.3, 0.22, 0xfce7f3, 0.24, 0.72, 0.5);
    addMarigolds(floatBody, 6, 0.2, 0.26);

    const c = buildCandleAndIncense(floatBody, 0, 0.22, 0, 0xfef08a);
    flameMesh = c.flameMesh;
    glowSprite = c.glowSprite;
  }

  return {
    group,
    floatBody,
    flameMesh,
    glowSprite,
    rippleRing,
    mascotGroup,
  };
}

export function animateKrathongParts(
  parts: KrathongMeshParts,
  elapsed: number,
  seed: number,
  highlightBoost = 0
): void {
  const wavePhase = elapsed * 2.1 + seed * 17.3;
  parts.floatBody.position.y = Math.sin(wavePhase) * 0.045;
  parts.floatBody.rotation.z = Math.sin(wavePhase * 0.85) * 0.055;
  parts.floatBody.rotation.x = Math.cos(wavePhase * 0.72) * 0.045;

  // Candle flicker
  const flicker =
    1 + Math.sin(elapsed * 15.7 + seed * 31) * 0.13 + Math.cos(elapsed * 23.3 + seed * 11) * 0.08;
  parts.flameMesh.scale.set(1 + (flicker - 1) * 0.5, flicker, 1 + (flicker - 1) * 0.5);
  parts.flameMesh.rotation.z = Math.sin(elapsed * 9.5 + seed * 19) * 0.12;

  const baseGlow = 1.15 + highlightBoost * 0.55 + (flicker - 1) * 0.35;
  parts.glowSprite.scale.set(baseGlow, baseGlow, 1);
  const gMat = parts.glowSprite.material as THREE.SpriteMaterial;
  gMat.opacity = Math.min(1, 0.78 + highlightBoost * 0.2 + (flicker - 1) * 0.15);

  // Expanding water shimmer ring
  const ripCycle = (elapsed * 0.65 + seed * 3.7) % 1;
  const ripScale = 0.92 + ripCycle * 0.42;
  parts.rippleRing.scale.set(ripScale, ripScale, 1);
  const rMat = parts.rippleRing.material as THREE.MeshBasicMaterial;
  rMat.opacity = (1 - ripCycle) * (0.36 + highlightBoost * 0.28);

  if (parts.mascotGroup) {
    parts.mascotGroup.rotation.y = Math.sin(elapsed * 1.6 + seed * 9) * 0.12;
  }
}

export interface OrbitSample {
  x: number;
  z: number;
  rotY: number;
}

/**
 * Samples a smooth rounded-rectangle water loop surrounding the beach island
 * so Krathongs glide evenly along all 4 shorelines without clipping corners.
 */
export function sampleIslandKrathongOrbit(
  progress01: number,
  laneOffset: number,
  islandCenterX: number,
  islandW: number,
  islandD: number
): OrbitSample {
  const t = ((progress01 % 1) + 1) % 1;
  const hx = islandW / 2 + 1.4;
  const hz = islandD / 2 + 1.4;
  const r = Math.max(3.2, laneOffset);

  const topLen = hx * 2;
  const sideLen = hz * 2;
  const cornerLen = (Math.PI * r) / 2;
  const totalLen = topLen * 2 + sideLen * 2 + cornerLen * 4;
  let d = t * totalLen;

  // 1. Top edge (left -> right) at z = -(hz + r)
  if (d <= topLen) {
    return {
      x: islandCenterX - hx + d,
      z: -(hz + r),
      rotY: 0,
    };
  }
  d -= topLen;

  // 2. Top-right corner arc (-PI/2 -> 0)
  if (d <= cornerLen) {
    const a = -Math.PI / 2 + (d / cornerLen) * (Math.PI / 2);
    return {
      x: islandCenterX + hx + Math.cos(a) * r,
      z: -hz + Math.sin(a) * r,
      rotY: -a - Math.PI / 2,
    };
  }
  d -= cornerLen;

  // 3. Right edge (top -> bottom) at x = islandCenterX + hx + r
  if (d <= sideLen) {
    return {
      x: islandCenterX + hx + r,
      z: -hz + d,
      rotY: -Math.PI / 2,
    };
  }
  d -= sideLen;

  // 4. Bottom-right corner arc (0 -> PI/2)
  if (d <= cornerLen) {
    const a = (d / cornerLen) * (Math.PI / 2);
    return {
      x: islandCenterX + hx + Math.cos(a) * r,
      z: hz + Math.sin(a) * r,
      rotY: -a - Math.PI / 2,
    };
  }
  d -= cornerLen;

  // 5. Bottom edge (right -> left) at z = hz + r
  if (d <= topLen) {
    return {
      x: islandCenterX + hx - d,
      z: hz + r,
      rotY: Math.PI,
    };
  }
  d -= topLen;

  // 6. Bottom-left corner arc (PI/2 -> PI)
  if (d <= cornerLen) {
    const a = Math.PI / 2 + (d / cornerLen) * (Math.PI / 2);
    return {
      x: islandCenterX - hx + Math.cos(a) * r,
      z: hz + Math.sin(a) * r,
      rotY: -a - Math.PI / 2,
    };
  }
  d -= cornerLen;

  // 7. Left edge (bottom -> top) at x = islandCenterX - hx - r
  if (d <= sideLen) {
    return {
      x: islandCenterX - hx - r,
      z: hz - d,
      rotY: Math.PI / 2,
    };
  }
  d -= sideLen;

  // 8. Top-left corner arc (PI -> 3PI/2)
  const a = Math.PI + (Math.min(d, cornerLen) / cornerLen) * (Math.PI / 2);
  return {
    x: islandCenterX - hx + Math.cos(a) * r,
    z: -hz + Math.sin(a) * r,
    rotY: -a - Math.PI / 2,
  };
}

/**
 * Finds the nearest orbit progress [0..1) on the island water loop to a shoreline point (px, pz).
 */
export function computeOrbitSeedFromPoint(
  px: number,
  pz: number,
  laneOffset: number,
  islandCenterX: number,
  islandW: number,
  islandD: number
): number {
  let bestT = 0;
  let bestDistSq = Infinity;
  const steps = 120;
  for (let i = 0; i < steps; i++) {
    const candT = i / steps;
    const pt = sampleIslandKrathongOrbit(candT, laneOffset, islandCenterX, islandW, islandD);
    const dSq = (pt.x - px) * (pt.x - px) + (pt.z - pz) * (pt.z - pz);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestT = candT;
    }
  }
  return Number(bestT.toFixed(4));
}
