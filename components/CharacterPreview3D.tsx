'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  buildCharacterMesh,
  animateCharacterMotion,
  buildPetMesh,
  animatePetMotion,
  type CharacterMeshParts,
  type PetMeshParts,
} from '@/lib/character_3d';
import { isEatPath } from '@/lib/spectator_activities';

interface CharacterPreview3DProps {
  colorHex: string;
  accessory: string;
  bandColor: string;
  isSpectator: boolean;
  workoutType: string;
  petType?: string;
}

export default function CharacterPreview3D({
  colorHex,
  accessory,
  bandColor,
  isSpectator,
  workoutType,
  petType = 'none',
}: CharacterPreview3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previewGroupRef = useRef<THREE.Group | null>(null);
  const activePartsRef = useRef<{
    charParts: CharacterMeshParts | null;
    petParts: PetMeshParts | null;
    isSpectator: boolean;
    workoutType: string;
    petType: string;
  }>({
    charParts: null,
    petParts: null,
    isSpectator,
    workoutType,
    petType,
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = '';
    const width = container.clientWidth || 240;
    const height = container.clientHeight || 240;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 50);
    camera.position.set(2.5, 1.9, 2.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 2.0;
    controls.maxDistance = 8.0;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2.0;
    controls.target.set(0, 1.2, 0);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfef08a, 0.9);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight.position.set(4, 8, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const previewGroup = new THREE.Group();
    scene.add(previewGroup);
    previewGroupRef.current = previewGroup;

    const clock = new THREE.Clock();
    let frameId: number;
    let elapsed = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min(0.05, clock.getDelta());
      elapsed += delta;
      const state = activePartsRef.current;
      if (state.charParts) {
        state.charParts.mixer?.update(delta);
        state.petParts?.mixer?.update(delta);
        animateCharacterMotion(
          { ...state.charParts, isSpectator: state.isSpectator, workoutType: state.workoutType },
          elapsed,
          0,
          1
        );
        if (state.petParts) {
          animatePetMotion(state.petParts, state.charParts, state.petType, false, elapsed, 0);
        }
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 240;
      const h = container.clientHeight || 240;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      previewGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const previewGroup = previewGroupRef.current;
    if (!previewGroup) return;

    previewGroup.clear();

    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.25, 1.35, 0.25, 24),
      new THREE.MeshStandardMaterial({ color: isSpectator ? 0x86EFAC : 0xFB7185, roughness: 0.6 })
    );
    pedestal.position.y = -0.12;
    pedestal.receiveShadow = true;
    previewGroup.add(pedestal);

    const previewAnim = isSpectator
      ? workoutType === 'fit'
        ? 'dumbbell'
        : workoutType === 'eat' || isEatPath(workoutType)
        ? 'picnic_shabu'
        : workoutType
      : '';

    const state = {
      isSpectator,
      workoutType: previewAnim,
    };

    const charParts = buildCharacterMesh({
      colorHex,
      accessory,
      bandColor,
      bellyScale: 1,
      spectatorProp: previewAnim,
    });
    previewGroup.add(charParts.rootGroup);

    const petParts = !isSpectator ? buildPetMesh(petType) : null;
    if (petParts) {
      charParts.rootGroup.add(petParts.petGroup);
      if (petParts.leashMesh) charParts.rootGroup.add(petParts.leashMesh);
    }

    activePartsRef.current = {
      charParts,
      petParts,
      isSpectator: state.isSpectator,
      workoutType: state.workoutType,
      petType,
    };
  }, [colorHex, accessory, bandColor, isSpectator, workoutType, petType]);

  return (
    <div className="relative w-full h-64 md:h-full min-h-[300px] rounded-2xl border-2 border-black bg-gradient-to-b from-[#bae6fd] via-[#e0f2fe] to-[#fef08a] overflow-hidden shadow-[3px_3px_0px_#18181B]">
      <div ref={containerRef} className="w-full h-full touch-none cursor-grab active:cursor-grabbing" />
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 border border-black rounded-full px-2.5 py-0.5 text-[10px] font-bold text-zinc-700 whitespace-nowrap pointer-events-none">
        🔄 ลากหมุน • 🔍 ซูมเข้า-ออกได้
      </div>
    </div>
  );
}
