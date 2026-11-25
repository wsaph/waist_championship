import * as THREE from 'three';
import { buildCharacterMesh, type CharacterMeshParts } from '@/lib/character_3d';
import { disposeObject3D } from '@/lib/device_perf';
import type { GamePlayerSummary, GameRosterSlot } from './types';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface IslandCourtActorSlotPlacement {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale?: number;
}

export interface IslandCourtActorVisual {
  slotId: string;
  playerId: number;
  isBot: boolean;
  team: 'left' | 'right' | 'coop';
  root: THREE.Group;
  charParts: CharacterMeshParts;
  baseX: number;
  baseY: number;
  baseZ: number;
  baseRotY: number;
  tagEl: HTMLDivElement;
}

export interface IslandActorShowcaseController {
  group: THREE.Group;
  getActors: () => readonly IslandCourtActorVisual[];
  syncRoster: (
    roster: readonly GameRosterSlot[] | undefined,
    statusKey: string,
    players: readonly GamePlayerSummary[],
    resolvePlacement: (slot: GameRosterSlot, index: number, total: number) => IslandCourtActorSlotPlacement
  ) => void;
  projectLabels: (
    zoneWorldPos: THREE.Vector3,
    camera: THREE.PerspectiveCamera,
    viewportWidth: number,
    viewportHeight: number,
    labelOffsetY?: number
  ) => void;
  dispose: () => void;
}

/**
 * Reusable zero-flicker 3D character showcase controller for any Island Sport/Game Zone.
 * Rebuilds character meshes ONLY when the roster signature changes, and disposes GPU + DOM cleanly.
 */
export function createIslandActorShowcaseController(
  parentGroup: THREE.Group,
  labelsContainer: HTMLElement
): IslandActorShowcaseController {
  const group = new THREE.Group();
  parentGroup.add(group);

  let actors: IslandCourtActorVisual[] = [];
  let renderedSig = '';
  const projVec = new THREE.Vector3();

  const clearActors = () => {
    for (const a of actors) {
      a.charParts.rootGroup.userData.disposed = true;
      a.tagEl.remove();
    }
    actors = [];
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      disposeObject3D(child);
    }
  };

  return {
    group,
    getActors: () => actors,
    syncRoster: (roster, statusKey, players, resolvePlacement) => {
      const list = roster || [];
      const nextSig =
        list.length === 0
          ? ''
          : `${statusKey}|${list
            .map((r) => `${r.slotId}:${r.playerId}:${r.name}:${r.team || ''}:${r.isBot ? 1 : 0}`)
            .join(',')}`;

      if (nextSig === renderedSig) return;
      renderedSig = nextSig;
      clearActors();

      if (list.length === 0) return;

      list.forEach((slotEntry, sIdx) => {
        const fallback = players.length > 0 ? players[(sIdx + 1) % players.length] : undefined;
        const found = slotEntry.playerId
          ? players.find((p) => p.id === slotEntry.playerId) || fallback
          : fallback;

        const inferredTeam: 'left' | 'right' | 'coop' =
          slotEntry.team ||
          (slotEntry.slotId.startsWith('L') ||
          slotEntry.slotId.startsWith('B') ||
          slotEntry.slotId === 'p1' ||
          slotEntry.slotId === 'blue'
            ? 'left'
            : slotEntry.slotId.startsWith('R') || slotEntry.slotId === 'p2' || slotEntry.slotId === 'red'
              ? 'right'
              : sIdx % 2 === 0
                ? 'left'
                : 'right');

        const bandHex =
          inferredTeam === 'left' ? '#38BDF8' : inferredTeam === 'right' ? '#EF4444' : '#FACC15';
        const bodyFallbackHex =
          inferredTeam === 'left' ? '#38BDF8' : inferredTeam === 'right' ? '#FB7185' : '#FDE047';

        const charParts = buildCharacterMesh({
          colorHex: found?.colorHex || bodyFallbackHex,
          accessory: 'headband',
          bandColor: bandHex,
          bellyScale: found?.bellyScale ?? found?.bmiBellyScale ?? 1,
          muscleScale: found?.muscleScale ?? 1,
          showDumbbells: false,
          species: found?.breed || found?.species || 'bunny',
          equipHat: found?.equipHat || 'none',
          equipFace: found?.equipFace || 'face_none',
          equipArmor: found?.equipArmor || 'armor_none',
          equipWeapon: found?.equipWeapon || 'weapon_none',
          equipWings: found?.equipWings || 'wings_none',
          equipAura: found?.equipAura || 'aura_none',
          equipMount: 'mount_none',
          propColors: found?.propColors,
          animMode: 'cheer',
          animSeed: sIdx * 1.6,
        });

        const placement = resolvePlacement(slotEntry, sIdx, list.length);
        charParts.rootGroup.scale.setScalar(placement.scale ?? 0.84);

        const actorRoot = new THREE.Group();
        actorRoot.add(charParts.rootGroup);

        const ringHex =
          inferredTeam === 'left' ? 0x38bdf8 : inferredTeam === 'right' ? 0xf43f5e : 0xfacc15;
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.48, 0.62, 20),
          new THREE.MeshBasicMaterial({
            color: ringHex,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
          })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.02;
        actorRoot.add(ring);

        actorRoot.position.set(placement.x, placement.y, placement.z);
        actorRoot.rotation.y = placement.rotY;
        group.add(actorRoot);

        const actorTag = document.createElement('div');
        actorTag.className = 'player-tag pointer-events-none';
        const pillStyle =
          inferredTeam === 'left'
            ? 'bg-sky-950/90 border-sky-300 text-sky-100'
            : inferredTeam === 'right'
              ? 'bg-rose-950/90 border-rose-300 text-rose-100'
              : 'bg-amber-950/90 border-amber-300 text-amber-100';
        actorTag.innerHTML = `
          <div class="px-2 py-0.5 rounded-full border ${pillStyle} text-[9.5px] font-extrabold whitespace-nowrap shadow">
            ${escapeHtml(slotEntry.emoji || '🎮')} ${escapeHtml(slotEntry.name || 'ผู้เล่น')}
          </div>
        `;
        labelsContainer.appendChild(actorTag);

        actors.push({
          slotId: slotEntry.slotId,
          playerId: slotEntry.playerId,
          isBot: Boolean(slotEntry.isBot),
          team: inferredTeam,
          root: actorRoot,
          charParts,
          baseX: placement.x,
          baseY: placement.y,
          baseZ: placement.z,
          baseRotY: placement.rotY,
          tagEl: actorTag,
        });
      });
    },
    projectLabels: (_zoneWorldPos, camera, viewportWidth, viewportHeight, labelOffsetY = 2.25) => {
      if (actors.length > 0) {
        parentGroup.updateMatrixWorld();
      }
      for (let i = 0; i < actors.length; i++) {
        const act = actors[i];
        act.root.getWorldPosition(projVec);
        projVec.y += labelOffsetY;
        projVec.project(camera);
        if (projVec.z < 1) {
          act.tagEl.style.setProperty(
            '--tag-x',
            `${((projVec.x * 0.5 + 0.5) * viewportWidth).toFixed(1)}px`
          );
          act.tagEl.style.setProperty(
            '--tag-y',
            `${((-projVec.y * 0.5 + 0.5) * viewportHeight).toFixed(1)}px`
          );
          act.tagEl.style.opacity = '1';
        } else {
          act.tagEl.style.opacity = '0';
        }
      }
    },
    dispose: () => {
      clearActors();
      parentGroup.remove(group);
    },
  };
}

/**
 * Pure helper to determine whether a viewer is locked out of an active single-session round.
 */
export function isViewerLockedOutOfActiveMatch(opts: {
  lobby: { status?: string; roster?: readonly GameRosterSlot[] } | null | undefined;
  viewerClientId?: string | null;
  viewerUserId?: number | null;
  isCurrentlyPlayingLocally: boolean;
}): boolean {
  const { lobby, viewerClientId, viewerUserId, isCurrentlyPlayingLocally } = opts;
  if (isCurrentlyPlayingLocally) return false;
  if (!lobby || lobby.status !== 'started') return false;
  const roster = lobby.roster || [];
  const amIInRoster = roster.some(
    (r) =>
      !r.isBot &&
      ((viewerClientId && r.clientId === viewerClientId) ||
        Boolean(viewerUserId && viewerUserId > 0 && r.playerId === viewerUserId))
  );
  return !amIInRoster;
}
