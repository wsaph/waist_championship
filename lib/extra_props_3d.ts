import * as THREE from 'three';
import { SHOP_ITEMS } from '@/lib/rpg_catalog';

function getItemColors(itemId: string): { main: number; accent: number } {
  const it = SHOP_ITEMS.find((x) => x.id === itemId);
  return {
    main: it?.colorHex || 0xfacc15,
    accent: it?.accentHex || 0xffffff,
  };
}

/** 🎩 Extra Hats (8 new 3D styles) */
export function buildExtraHat3D(hatId: string, parent: THREE.Group): boolean {
  if (!hatId || hatId === 'none') return false;
  const { main, accent } = getItemColors(hatId);
  const mainMat = new THREE.MeshStandardMaterial({ color: main, roughness: 0.42 });
  const accMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35, metalness: 0.25 });

  if (hatId === 'hat_bucket_beach') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.78, 0.08, 20), mainMat);
    brim.position.y = 0.08;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.52, 0.34, 18), mainMat);
    crown.position.y = 0.26;
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.51, 0.53, 0.09, 18), accMat);
    ribbon.position.y = 0.14;
    parent.add(brim, crown, ribbon);
    return true;
  }
  if (hatId === 'hat_frog_beanie') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.56, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mainMat);
    dome.position.y = 0.02;
    parent.add(dome);
    [-0.24, 0.24].forEach((ez) => {
      const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), accMat);
      eyeW.position.set(0.18, 0.48, ez);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), new THREE.MeshBasicMaterial({ color: 0x18181b }));
      pupil.position.set(0.3, 0.5, ez);
      parent.add(eyeW, pupil);
    });
    return true;
  }
  if (hatId === 'hat_cowboy_gold') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.86, 0.06, 20), mainMat);
    brim.scale.set(1.06, 1, 0.86);
    brim.position.y = 0.1;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.36, 16), mainMat);
    crown.position.y = 0.28;
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), accMat);
    star.position.set(0.48, 0.3, 0);
    parent.add(brim, crown, star);
    return true;
  }
  if (hatId === 'hat_viking_helm') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.56, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mainMat);
    helm.position.y = 0.04;
    parent.add(helm);
    [-0.46, 0.46].forEach((hz) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.48, 8), accMat);
      horn.position.set(0, 0.38, hz);
      horn.rotation.x = hz < 0 ? -0.68 : 0.68;
      parent.add(horn);
    });
    return true;
  }
  if (hatId === 'hat_witch_pointy') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.88, 0.06, 20), mainMat);
    brim.position.y = 0.08;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.96, 16), mainMat);
    cone.position.set(-0.06, 0.54, 0);
    cone.rotation.z = 0.22;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.16), accMat);
    buckle.position.set(0.46, 0.18, 0);
    parent.add(brim, cone, buckle);
    return true;
  }
  if (hatId === 'hat_samurai_crest') {
    const kabuto = new THREE.Mesh(new THREE.SphereGeometry(0.58, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mainMat);
    kabuto.position.y = 0.04;
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.05, 8, 16, Math.PI * 1.25), accMat);
    crescent.rotation.y = Math.PI / 2;
    crescent.position.set(0.46, 0.52, 0);
    parent.add(kabuto, crescent);
    return true;
  }
  if (hatId === 'hat_gacha_cat_ears_neon') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.055, 8, 22, Math.PI), mainMat);
    band.rotation.y = Math.PI / 2;
    band.position.y = 0.04;
    parent.add(band);
    [-0.36, 0.36].forEach((ez) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 6), new THREE.MeshBasicMaterial({ color: accent }));
      ear.position.set(0, 0.62, ez);
      ear.rotation.x = ez < 0 ? -0.25 : 0.25;
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 14), mainMat);
      cup.rotation.x = Math.PI / 2;
      cup.position.set(0, 0.02, ez * 1.62);
      parent.add(ear, cup);
    });
    return true;
  }
  if (hatId === 'hat_gacha_galaxy_crown') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.06, 10, 22), mainMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.28;
    parent.add(ring);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.1, 0),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? accent : 0x38bdf8 })
      );
      gem.position.set(Math.cos(a) * 0.42, 0.48, Math.sin(a) * 0.42);
      parent.add(gem);
    }
    return true;
  }
  return false;
}

/** 🕶️ Extra Face Accessories (15 new 3D styles) */
export function buildExtraFace3D(faceId: string, parent: THREE.Group): boolean {
  if (!faceId || faceId === 'face_none') return false;
  const { main, accent } = getItemColors(faceId);
  const mainMat = new THREE.MeshStandardMaterial({ color: main, roughness: 0.35 });
  const accMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3 });

  if (faceId === 'face_smile_sticker') {
    [-0.32, 0.32].forEach((cz) => {
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.075, 0), mainMat);
      star.scale.set(0.35, 1, 1);
      star.position.set(0.55, -0.06, cz);
      parent.add(star);
    });
    return true;
  }
  if (faceId === 'face_clown_nose') {
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 14), mainMat);
    nose.position.set(0.62, -0.02, 0);
    parent.add(nose);
    return true;
  }
  if (faceId === 'face_cat_whiskers' || faceId === 'face_mustache_gent') {
    const isCat = faceId === 'face_cat_whiskers';
    [-1, 1].forEach((side) => {
      if (isCat) {
        [-0.04, 0.04].forEach((wy) => {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.32, 6), mainMat);
          w.rotation.x = Math.PI / 2;
          w.position.set(0.56, -0.06 + wy, side * 0.3);
          parent.add(w);
        });
      } else {
        const stache = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), mainMat);
        stache.scale.set(0.45, 0.65, 1.65);
        stache.position.set(0.58, -0.1, side * 0.16);
        parent.add(stache);
      }
    });
    if (isCat) {
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), accMat);
      nose.position.set(0.6, -0.04, 0);
      parent.add(nose);
    }
    return true;
  }
  if (faceId === 'face_pirate_patch' || faceId === 'face_monocle_gold') {
    const isPatch = faceId === 'face_pirate_patch';
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.05, 14),
      isPatch ? mainMat : new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.45 })
    );
    disc.rotation.z = Math.PI / 2;
    disc.position.set(0.58, 0.1, 0.22);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 16), isPatch ? mainMat : mainMat);
    rim.rotation.y = Math.PI / 2;
    rim.position.set(0.59, 0.1, 0.22);
    parent.add(disc, rim);
    return true;
  }
  if (faceId === 'face_ninja_mask') {
    const mask = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.56, 0.3, 18, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
      mainMat
    );
    mask.rotation.y = Math.PI / 2;
    mask.position.set(0.05, -0.16, 0);
    parent.add(mask);
    return true;
  }
  if (faceId === 'face_oni_mask' || faceId === 'face_gacha_masquerade') {
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.78), mainMat);
    mask.position.set(0.56, 0.08, 0);
    parent.add(mask);
    if (faceId === 'face_oni_mask') {
      [-0.22, 0.22].forEach((hz) => {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), accMat);
        horn.position.set(0.58, 0.3, hz);
        parent.add(horn);
      });
    } else {
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), accMat);
      gem.position.set(0.64, 0.18, 0);
      parent.add(gem);
    }
    return true;
  }
  // Glasses / Visors (heart, snorkel, pixel, sport, cyber, laser)
  const isGlowing = faceId === 'face_gacha_cyber_visor' || faceId === 'face_gacha_laser_eyes';
  const lensMat = isGlowing
    ? new THREE.MeshBasicMaterial({ color: main })
    : new THREE.MeshStandardMaterial({ color: main, roughness: 0.18, metalness: 0.45 });
  if (faceId === 'face_visor_sport' || faceId === 'face_gacha_cyber_visor' || faceId === 'face_gacha_laser_eyes' || faceId === 'face_snorkel_mask') {
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.22, 0.82), lensMat);
    visor.position.set(0.58, 0.1, 0);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.86), accMat);
    frame.position.set(0.56, 0.1, 0);
    parent.add(frame, visor);
    return true;
  }
  [-0.22, 0.22].forEach((ez) => {
    const lens = new THREE.Mesh(
      faceId === 'face_pixel_shades'
        ? new THREE.BoxGeometry(0.08, 0.16, 0.26)
        : new THREE.CylinderGeometry(0.15, 0.15, 0.06, 14),
      lensMat
    );
    if (faceId !== 'face_pixel_shades') lens.rotation.z = Math.PI / 2;
    lens.position.set(0.58, 0.1, ez);
    parent.add(lens);
  });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.22), accMat);
  bridge.position.set(0.58, 0.12, 0);
  parent.add(bridge);
  return true;
}

/** ⚔️ Extra Weapons / Handheld Props (12 new 3D styles) */
export function buildExtraWeapon3D(weaponId: string, parent: THREE.Object3D): boolean {
  if (!weaponId || weaponId === 'weapon_none') return false;
  const { main, accent } = getItemColors(weaponId);
  const mainMat = new THREE.MeshStandardMaterial({ color: main, roughness: 0.32, metalness: 0.35 });
  const accMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.3, metalness: 0.4 });
  const g = new THREE.Group();

  if (weaponId === 'weapon_water_bottle') {
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.42, 12), mainMat);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 10), accMat);
    cap.position.y = 0.26;
    g.add(bottle, cap);
  } else if (weaponId === 'weapon_boxing_glove') {
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 14), mainMat);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.14, 12), accMat);
    cuff.position.y = -0.22;
    g.add(glove, cuff);
  } else if (weaponId === 'weapon_shabu_pot') {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.2, 16), mainMat);
    const soup = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.04, 16), accMat);
    soup.position.y = 0.09;
    g.add(pot, soup);
  } else if (weaponId === 'weapon_gacha_pizza_slice') {
    const slice = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.56, 3), mainMat);
    slice.rotation.z = -0.4;
    slice.scale.set(1, 1, 0.22);
    const pep = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), accMat);
    pep.rotation.x = Math.PI / 2;
    g.add(slice, pep);
  } else if (weaponId === 'weapon_tennis_racket' || weaponId === 'weapon_guitar_rock') {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.52, 8), accMat);
    handle.position.y = 0.2;
    const head =
      weaponId === 'weapon_tennis_racket'
        ? new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.038, 8, 18), mainMat)
        : new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.48, 0.1), mainMat);
    head.position.y = 0.62;
    g.add(handle, head);
  } else {
    // Swords / Wands / Glowsticks / Trident / Laser Saber / Excalibur
    const isGlowing = weaponId === 'weapon_glowstick' || weaponId === 'weapon_gacha_laser_saber' || weaponId === 'weapon_gacha_excalibur';
    const bladeMat = isGlowing ? new THREE.MeshBasicMaterial({ color: main }) : mainMat;
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 8), accMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.34), accMat);
    guard.position.y = 0.16;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.85, 0.14), bladeMat);
    blade.position.y = 0.6;
    g.add(hilt, guard, blade);
    if (weaponId === 'weapon_magic_wand' || weaponId === 'weapon_trident_sea') {
      const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 0), accMat);
      tip.position.y = 1.06;
      g.add(tip);
    }
  }
  g.position.set(0.18, -0.08, 0.08);
  g.rotation.z = -0.35;
  parent.add(g);
  return true;
}

/** 🎒 Extra Wings & Backpacks (14 new 3D styles) */
export function buildExtraWings3D(wingsId: string, parent: THREE.Group): boolean {
  if (!wingsId || wingsId === 'wings_none') return false;
  const { main, accent } = getItemColors(wingsId);
  const mainMat = new THREE.MeshStandardMaterial({ color: main, roughness: 0.38, side: THREE.DoubleSide });
  const accMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.32, side: THREE.DoubleSide });

  if (wingsId === 'wings_beach_towel' || wingsId === 'wings_hero_cape') {
    const cape = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.92, 0.86), mainMat);
    cape.position.set(-0.52, -0.1, 0);
    cape.rotation.z = 0.24;
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.055, 8, 18), accMat);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(-0.15, 0.34, 0);
    parent.add(cape, collar);
    return true;
  }
  if (wingsId === 'wings_swim_float') {
    const buoy = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.12, 10, 20), mainMat);
    buoy.rotation.y = Math.PI / 2;
    buoy.position.set(-0.56, 0.08, 0);
    parent.add(buoy);
    return true;
  }
  if (wingsId === 'wings_shark_fin') {
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.72, 4), mainMat);
    fin.scale.set(1.2, 1, 0.28);
    fin.rotation.z = 0.65;
    fin.position.set(-0.56, 0.22, 0);
    parent.add(fin);
    return true;
  }
  if (wingsId === 'wings_duck_pack' || wingsId === 'wings_guitar_case' || wingsId === 'wings_gacha_cloud_pack') {
    const pack = new THREE.Mesh(
      wingsId === 'wings_guitar_case'
        ? new THREE.BoxGeometry(0.22, 0.98, 0.44)
        : new THREE.SphereGeometry(0.38, 14, 14),
      mainMat
    );
    pack.position.set(-0.54, 0.1, 0);
    const badge = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), accMat);
    badge.position.set(-0.78, 0.16, 0);
    parent.add(pack, badge);
    return true;
  }
  if (wingsId === 'wings_samurai_flags') {
    [-0.28, 0.28].forEach((fz) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 8), accMat);
      pole.position.set(-0.52, 0.48, fz);
      const banner = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.68, 0.34), mainMat);
      banner.position.set(-0.62, 0.76, fz);
      parent.add(pole, banner);
    });
    return true;
  }
  // Winged pairs (bat, bee, dragon, cyber, phoenix, cat_tail_bow)
  const isGlowing = wingsId === 'wings_gacha_cyber_wings' || wingsId === 'wings_gacha_phoenix_wings';
  const wingMat = isGlowing ? new THREE.MeshBasicMaterial({ color: main, transparent: true, opacity: 0.88, side: THREE.DoubleSide }) : mainMat;
  [-1, 1].forEach((side) => {
    for (let f = 0; f < 3; f++) {
      const feather = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.95 - f * 0.14, 6), f % 2 === 0 ? wingMat : accMat);
      feather.scale.set(0.32, 1, 0.9);
      feather.position.set(-0.54 - f * 0.05, 0.28 - f * 0.16, side * (0.45 + f * 0.16));
      feather.rotation.x = side * (1.1 + f * 0.18);
      parent.add(feather);
    }
  });
  return true;
}

/** ✨ Extra Auras (15 new 3D styles) */
export function buildExtraAura3D(auraId: string, parent: THREE.Group): boolean {
  if (!auraId || auraId === 'aura_none') return false;
  const { main, accent } = getItemColors(auraId);
  const ringMat = new THREE.MeshBasicMaterial({ color: main, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
  const orbMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.85 });

  const baseRing = new THREE.Mesh(new THREE.RingGeometry(0.88, 1.18, 28), ringMat);
  baseRing.rotation.x = -Math.PI / 2;
  baseRing.position.y = 0.06;
  parent.add(baseRing);

  const count = auraId === 'aura_gacha_galaxy_orbit' || auraId === 'aura_gacha_dragon_ring' ? 8 : 6;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const radius = 0.96 + (i % 2) * 0.22;
    const h = 0.42 + (i % 3) * 0.48;
    const geo =
      auraId === 'aura_gold_coins'
        ? new THREE.CylinderGeometry(0.14, 0.14, 0.04, 14)
        : auraId === 'aura_lightning' || auraId === 'aura_snow'
        ? new THREE.OctahedronGeometry(0.13, 0)
        : new THREE.SphereGeometry(0.12, 10, 10);
    const particle = new THREE.Mesh(geo, i % 2 === 0 ? orbMat : ringMat);
    particle.position.set(Math.cos(a) * radius, h, Math.sin(a) * radius);
    parent.add(particle);
  }
  return true;
}

/** 📍 Extra Track Markers (12 new 3D styles) */
export function buildExtraMarker3D(
  markerId: string,
  group: THREE.Group
): { spinner?: THREE.Object3D; waver?: THREE.Object3D; runeRing?: THREE.Object3D } | null {
  const { main, accent } = getItemColors(markerId);
  const mainMat = new THREE.MeshStandardMaterial({ color: main, roughness: 0.42 });
  const accMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.35 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });

  if (markerId === 'marker_beach_cone') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 0.85), mainMat);
    base.position.y = 0.05;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.35, 16), mainMat);
    cone.position.y = 0.72;
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.24, 0.22, 16), accMat);
    stripe.position.y = 0.78;
    group.add(base, cone, stripe);
    return { waver: cone };
  }
  if (markerId === 'marker_umbrella') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.0, 8), accMat);
    pole.position.y = 1.0;
    const top = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.52, 8), mainMat);
    top.position.y = 1.95;
    group.add(pole, top);
    return { spinner: top };
  }
  if (markerId === 'marker_tiki_torch' || markerId === 'marker_lantern_jp') {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1.85, 8), woodMat);
    pole.position.y = 0.92;
    const glow = new THREE.Mesh(
      markerId === 'marker_tiki_torch' ? new THREE.ConeGeometry(0.24, 0.56, 8) : new THREE.SphereGeometry(0.36, 14, 14),
      new THREE.MeshBasicMaterial({ color: markerId === 'marker_tiki_torch' ? accent : main })
    );
    glow.position.y = 2.0;
    group.add(pole, glow);
    return { waver: glow };
  }
  if (markerId === 'marker_cactus_pot' || markerId === 'marker_snowman' || markerId === 'marker_cherry_tree') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.34, 0.45, 12), accMat);
    base.position.y = 0.22;
    const body = new THREE.Mesh(
      markerId === 'marker_snowman' ? new THREE.SphereGeometry(0.46, 14, 14) : new THREE.CylinderGeometry(0.24, 0.26, 1.25, 12),
      mainMat
    );
    body.position.y = markerId === 'marker_snowman' ? 0.65 : 1.0;
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(markerId === 'marker_cherry_tree' ? 0.72 : 0.32, 14, 14),
      markerId === 'marker_cherry_tree' ? mainMat : mainMat
    );
    top.position.y = markerId === 'marker_snowman' ? 1.28 : 1.78;
    group.add(base, body, top);
    return { waver: top };
  }
  // Portal / Shrine / Sword in Stone / Gold Statue / Dragon Pillar
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.74, 0.42, 12), accMat);
  ped.position.y = 0.21;
  const runeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 1.12, 24),
    new THREE.MeshBasicMaterial({ color: main, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
  );
  runeRing.rotation.x = -Math.PI / 2;
  runeRing.position.y = 0.04;
  const spinner = new THREE.Group();
  spinner.position.y = 1.55;
  const core = new THREE.Mesh(
    markerId === 'marker_gacha_portal_gate'
      ? new THREE.TorusGeometry(0.68, 0.14, 12, 24)
      : new THREE.OctahedronGeometry(0.48, 0),
    mainMat
  );
  const accentGem = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshBasicMaterial({ color: accent }));
  spinner.add(core, accentGem);
  group.add(ped, runeRing, spinner);
  return { spinner, runeRing };
}
