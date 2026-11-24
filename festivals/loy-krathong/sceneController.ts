import * as THREE from 'three';
import { disposeObject3D } from '@/lib/device_perf';
import type {
  FestivalFrameContext,
  FestivalSceneContext,
  FestivalSceneController,
} from '../types';
import { getKrathongStyleMeta, type KrathongItem } from './catalog';
import {
  animateKrathongParts,
  buildKrathongMesh,
  sampleKrathongWorldPosition,
  type KrathongMeshParts,
} from './krathong3d';

interface ActiveKrathongEntry {
  key: string;
  item: KrathongItem;
  isMine: boolean;
  parts: KrathongMeshParts;
  tagEl: HTMLDivElement;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildWishTagHtml(item: KrathongItem, isMine: boolean): string {
  const safeName = escapeHtml(item.userName || 'นักเดินทาง');
  const safeEmoji = escapeHtml(item.userEmoji || '🪷');
  const safeCaption = escapeHtml(item.caption || '');
  if (isMine) {
    return `
      <div class="rounded-2xl bg-gradient-to-r from-amber-950/95 via-rose-950/95 to-indigo-950/95 border-2 border-amber-300 px-2.5 py-1 shadow-[0_3px_12px_rgba(251,191,36,0.55)] text-center max-w-[210px]">
        <div class="text-[9.5px] font-black text-amber-300 truncate">🪷 กระทงของคุณ • ${safeEmoji} ${safeName}</div>
        ${safeCaption ? `<div class="text-[10.5px] font-bold text-white truncate">“${safeCaption}”</div>` : ''}
      </div>
    `;
  }
  return `
    <div class="rounded-2xl bg-slate-950/85 border border-amber-300/55 px-2.5 py-0.5 shadow-md text-center max-w-[195px]">
      <div class="text-[9px] font-extrabold text-amber-200 truncate">${safeEmoji} ${safeName}</div>
      ${safeCaption ? `<div class="text-[10px] font-semibold text-amber-50/95 truncate">“${safeCaption}”</div>` : ''}
    </div>
  `;
}

/**
 * Manages 3D floating Krathongs orbiting the beach island with zero-flicker diffing,
 * HTML wish bubble tags, and raycast click-to-inspect support.
 */
export function createLoyKrathongSceneController(
  ctx: FestivalSceneContext
): FestivalSceneController<KrathongItem> {
  const {
    scene,
    labelsContainer,
    qualityTier,
    islandCenterX,
    islandW,
    islandD,
    showToast,
    onFocusItem,
  } = ctx;

  const krathongSceneGroup = new THREE.Group();
  scene.add(krathongSceneGroup);

  const maxVisibleKrathongs = qualityTier === 'lite' ? 18 : qualityTier === 'medium' ? 28 : 42;
  const maxTagDist = qualityTier === 'lite' ? 36 : 48;
  const activeKrathongMap = new Map<string, ActiveKrathongEntry>();
  const tempProjVec = new THREE.Vector3();
  let lastCamera: THREE.Camera | null = null;
  let lastSyncSig = '';

  return {
    group: krathongSceneGroup,
    update: (frame: FestivalFrameContext<KrathongItem>) => {
      lastCamera = frame.camera;
      const {
        elapsed,
        nowPerfMs,
        nowWallMs,
        isVisible,
        viewerUserId,
        items: rawKrathongs,
        itemsSig,
        focusedItemId,
        focusedUntilPerfMs,
        camera,
        viewportWidth,
        viewportHeight,
      } = frame;

      krathongSceneGroup.visible = isVisible;
      if (!isVisible) {
        activeKrathongMap.forEach((entry) => {
          entry.tagEl.style.opacity = '0';
        });
        return;
      }

      const syncSig = `${viewerUserId ?? 0}|${itemsSig}`;
      if (syncSig !== lastSyncSig) {
        lastSyncSig = syncSig;
        const desiredList: KrathongItem[] = [];
        const pickedKeys = new Set<string>();

        // Always prioritize all of the viewer's own Krathongs first
        if (viewerUserId !== null && viewerUserId > 0) {
          for (const k of rawKrathongs) {
            if (k.userId === viewerUserId) {
              const key = `${k.id}`;
              if (!pickedKeys.has(key)) {
                pickedKeys.add(key);
                desiredList.push(k);
              }
            }
          }
        }
        for (const k of rawKrathongs) {
          if (desiredList.length >= maxVisibleKrathongs) break;
          const key = `${k.id}`;
          if (!pickedKeys.has(key)) {
            pickedKeys.add(key);
            desiredList.push(k);
          }
        }

        Array.from(activeKrathongMap.keys()).forEach((existingKey) => {
          if (!pickedKeys.has(existingKey)) {
            const old = activeKrathongMap.get(existingKey);
            if (old) {
              krathongSceneGroup.remove(old.parts.group);
              disposeObject3D(old.parts.group);
              old.tagEl.remove();
              activeKrathongMap.delete(existingKey);
            }
          }
        });

        for (const item of desiredList) {
          const key = `${item.id}`;
          const isMine =
            viewerUserId !== null && viewerUserId > 0 && item.userId === viewerUserId;
          const existing = activeKrathongMap.get(key);
          if (existing) {
            const ownershipChanged = existing.isMine !== isMine;
            existing.item = item;
            existing.isMine = isMine;
            if (ownershipChanged) {
              existing.parts.group.scale.setScalar(isMine ? 1.18 : 1.05);
              existing.tagEl.innerHTML = buildWishTagHtml(item, isMine);
            }
            continue;
          }

          const parts = buildKrathongMesh(item.styleId, {
            colorHex: item.avatarColor,
            bandColor: item.avatarBand,
            species: item.avatarSpecies,
            emoji: item.userEmoji,
          });
          parts.group.scale.setScalar(isMine ? 1.18 : 1.05);
          parts.group.traverse((obj) => {
            obj.userData.krathongKey = key;
          });
          krathongSceneGroup.add(parts.group);

          const tagEl = document.createElement('div');
          tagEl.className = 'player-tag pointer-events-none transition-opacity duration-200';
          tagEl.innerHTML = buildWishTagHtml(item, isMine);
          labelsContainer.appendChild(tagEl);
          activeKrathongMap.set(key, { key, item, isMine, parts, tagEl });
        }
      }

      let entryOrder = 0;
      activeKrathongMap.forEach((entry) => {
        const idxSeed = entryOrder++;
        const { item, parts, tagEl, isMine } = entry;
        const pos = sampleKrathongWorldPosition(
          item,
          nowWallMs,
          islandCenterX,
          islandW,
          islandD
        );
        const kx = pos.x;
        const kz = pos.z;
        const waveH =
          (Math.sin(kx * 0.18 + elapsed * 1.9) + Math.cos(-kz * 0.21 + elapsed * 1.5)) *
          0.5 *
          0.16;
        const ky = -0.39 + waveH;
        parts.group.position.set(kx, ky, kz);
        parts.group.rotation.y = pos.rotY + Math.sin(elapsed * 0.45 + item.orbitSeed * 25) * 0.28;

        const isFocused =
          focusedItemId !== null &&
          String(focusedItemId) === String(item.id) &&
          nowPerfMs < focusedUntilPerfMs;

        animateKrathongParts(
          parts,
          elapsed,
          item.orbitSeed + (idxSeed % 10) * 0.07,
          isFocused ? 0.65 : isMine ? 0.28 : 0
        );

        const camDist = Math.hypot(
          camera.position.x - kx,
          camera.position.y - ky,
          camera.position.z - kz
        );
        const showLabel = isMine || isFocused || camDist < maxTagDist;
        if (showLabel) {
          tempProjVec.set(kx, ky + 1.18, kz);
          tempProjVec.project(camera);
          if (tempProjVec.z < 1) {
            tagEl.style.setProperty(
              '--tag-x',
              `${((tempProjVec.x * 0.5 + 0.5) * viewportWidth).toFixed(1)}px`
            );
            tagEl.style.setProperty(
              '--tag-y',
              `${((-tempProjVec.y * 0.5 + 0.5) * viewportHeight).toFixed(1)}px`
            );
            const distAlpha =
              isMine || isFocused
                ? 1
                : Math.max(0, Math.min(1, (maxTagDist - camDist) / 10));
            tagEl.style.opacity = distAlpha.toFixed(2);
            tagEl.style.zIndex = isFocused ? '98' : isMine ? '90' : '18';
          } else {
            tagEl.style.opacity = '0';
          }
        } else {
          tagEl.style.opacity = '0';
        }
      });
    },

    onPointerTap: (raycaster: THREE.Raycaster): boolean => {
      if (!krathongSceneGroup.visible || krathongSceneGroup.children.length === 0) {
        return false;
      }
      if (!raycaster.camera && lastCamera) {
        raycaster.camera = lastCamera;
      }
      if (!raycaster.camera) {
        return false;
      }
      const kHits = raycaster.intersectObjects(krathongSceneGroup.children, true);
      if (kHits.length === 0) return false;

      let hitObj: THREE.Object3D | null = kHits[0].object;
      while (hitObj && hitObj.userData.krathongKey === undefined) {
        hitObj = hitObj.parent;
      }
      const kKey = hitObj?.userData.krathongKey as string | undefined;
      const kEntry = kKey ? activeKrathongMap.get(kKey) : undefined;
      if (!kEntry) return false;

      onFocusItem(kEntry.item.id, 8500);
      const stMeta = getKrathongStyleMeta(kEntry.item.styleId);
      showToast(
        stMeta.emoji,
        `กระทงของ ${kEntry.item.userEmoji} ${kEntry.item.userName}`,
        kEntry.item.caption ? `“${kEntry.item.caption}”` : stMeta.name
      );
      return true;
    },

    dispose: () => {
      activeKrathongMap.forEach((entry) => {
        entry.tagEl.remove();
      });
      activeKrathongMap.clear();
      scene.remove(krathongSceneGroup);
      disposeObject3D(krathongSceneGroup);
    },
  };
}
