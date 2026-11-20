import * as THREE from 'three';

export type DeviceTier = 'desktop' | 'tablet' | 'mobile';
export type QualityMode = 'auto' | 'high' | 'medium' | 'lite';
export type ResolvedQualityTier = 'high' | 'medium' | 'lite';

export interface QualityConfig {
  tier: ResolvedQualityTier;
  device: DeviceTier;
  maxPixelRatio: number;
  antialias: boolean;
  shadowMapSize: number;
  shadowType: THREE.ShadowMapType;
  enableBloom: boolean;
  bloomResolutionScale: number;
  oceanSegments: number;
  oceanFrameSkip: number;
  rainCount: number;
  starCount: number;
}

const QUALITY_STORAGE_KEY = 'waist_quality_mode';

export function detectDeviceTier(): DeviceTier {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'desktop';
  }
  const ua = navigator.userAgent || '';
  const w = Math.min(window.innerWidth || 1280, window.screen?.width || 1280);
  const maxTouch = navigator.maxTouchPoints || 0;

  const isIpad =
    /iPad/i.test(ua) || (/Macintosh/i.test(ua) && maxTouch > 1);
  const isAndroidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
  if (isIpad || isAndroidTablet) return 'tablet';

  const isMobileUa = /iPhone|iPod|Android.*Mobile|Windows Phone|Mobile/i.test(ua);
  if (isMobileUa || (maxTouch > 0 && w < 768)) return 'mobile';

  if (maxTouch > 0 && w < 1024) return 'tablet';
  return 'desktop';
}

export function loadQualityMode(): QualityMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = localStorage.getItem(QUALITY_STORAGE_KEY);
    if (raw === 'auto' || raw === 'high' || raw === 'medium' || raw === 'lite') {
      return raw;
    }
  } catch {
    // ignore storage errors
  }
  return 'auto';
}

export function saveQualityMode(mode: QualityMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUALITY_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
}

export function resolveQualityTier(mode: QualityMode, device?: DeviceTier): ResolvedQualityTier {
  if (mode === 'high' || mode === 'medium' || mode === 'lite') {
    return mode;
  }
  const d = device ?? detectDeviceTier();
  if (d === 'mobile') return 'lite';
  if (d === 'tablet') return 'medium';
  return 'high';
}

export function getQualityConfig(mode: QualityMode = 'auto'): QualityConfig {
  const device = detectDeviceTier();
  const tier = resolveQualityTier(mode, device);

  if (tier === 'lite') {
    return {
      tier: 'lite',
      device,
      maxPixelRatio: 1.25,
      antialias: false,
      shadowMapSize: 512,
      shadowType: THREE.BasicShadowMap,
      enableBloom: false,
      bloomResolutionScale: 0,
      oceanSegments: 20,
      oceanFrameSkip: 4,
      rainCount: 160,
      starCount: 80,
    };
  }

  if (tier === 'medium') {
    return {
      tier: 'medium',
      device,
      maxPixelRatio: 1.5,
      antialias: true,
      shadowMapSize: 1024,
      shadowType: THREE.PCFSoftShadowMap,
      enableBloom: true,
      bloomResolutionScale: 0.5,
      oceanSegments: 32,
      oceanFrameSkip: 3,
      rainCount: 280,
      starCount: 120,
    };
  }

  return {
    tier: 'high',
    device,
    maxPixelRatio: 2,
    antialias: true,
    shadowMapSize: 2048,
    shadowType: THREE.PCFSoftShadowMap,
    enableBloom: true,
    bloomResolutionScale: 1,
    oceanSegments: 58,
    oceanFrameSkip: 2,
    rainCount: 520,
    starCount: 200,
  };
}

export const QUALITY_MODE_OPTIONS: Array<{ id: QualityMode; label: string; short: string }> = [
  { id: 'auto', label: 'อัตโนมัติ (ตามเครื่อง)', short: 'Auto' },
  { id: 'high', label: 'สวยสุด (Desktop)', short: 'High' },
  { id: 'medium', label: 'สมดุล (iPad)', short: 'Med' },
  { id: 'lite', label: 'ประหยัดแบต (มือถือ)', short: 'Lite' },
];

function disposeMaterial(mat: THREE.Material): void {
  if (mat.userData?.isSharedGltfResource) return;
  const record = mat as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const val = record[key];
    if (val && typeof val === 'object' && (val as THREE.Texture).isTexture) {
      const tex = val as THREE.Texture;
      if (!tex.userData?.isSharedGltfResource) {
        tex.dispose();
      }
    }
  }
  mat.dispose();
}

/**
 * Safely dispose geometries, materials, and non-shared textures inside a Three.js scene/group.
 * Shared resources loaded via gltfCache (marked with userData.isSharedGltfResource = true)
 * are preserved so cached GLB models continue rendering cleanly across scene rebuilds.
 */
export function disposeObject3D(root: THREE.Object3D | null | undefined): void {
  if (!root) return;
  const disposedGeos = new Set<THREE.BufferGeometry>();
  const disposedMats = new Set<THREE.Material>();

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh & {
      geometry?: THREE.BufferGeometry;
      material?: THREE.Material | THREE.Material[];
    };

    if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
      if (!mesh.userData?.isSharedGltfResource && !mesh.geometry.userData?.isSharedGltfResource) {
        disposedGeos.add(mesh.geometry);
        mesh.geometry.dispose();
      }
    }

    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (!m || disposedMats.has(m)) continue;
        if (mesh.userData?.isSharedGltfResource && m.userData?.isSharedGltfResource !== false) {
          continue;
        }
        disposedMats.add(m);
        disposeMaterial(m);
      }
    }
  });
}
