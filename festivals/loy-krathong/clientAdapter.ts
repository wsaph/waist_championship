import confetti from 'canvas-confetti';
import type { FestivalClientAdapter } from '../types';
import {
  AMBIENT_NPC_KRATHONGS,
  LOY_KRATHONG_DEFINITION,
  LOY_KRATHONG_REALTIME_EVENT,
  getKrathongStyleMeta,
  mergeWithAmbientKrathongs,
  type KrathongItem,
  type KrathongLaunchInput,
} from './catalog';
import { playKrathongLaunchSfx } from './bgm';
import { computeOrbitSeedFromPoint, sampleKrathongWorldPosition } from './krathong3d';
import { sessionFetch } from '@/lib/client_session';

export const loyKrathongClientAdapter: FestivalClientAdapter<
  KrathongItem,
  KrathongLaunchInput
> = {
  initialItems: AMBIENT_NPC_KRATHONGS,
  pollIntervalMs: 35_000,
  getItemId: (item) => item.id,

  fetchItems: async () => {
    try {
      const res = await fetch(LOY_KRATHONG_DEFINITION.apiBasePath, { cache: 'no-store' });
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data?.krathongs)) {
        return mergeWithAmbientKrathongs(data.krathongs);
      }
    } catch {
      // ignore transient network errors
    }
    return null;
  },

  countUserItems: (items, userId) => {
    if (userId === null || userId <= 0) return 0;
    let count = 0;
    for (const k of items) {
      if (k.userId === userId) count++;
    }
    return count;
  },

  cycleUserItem: (items, userId, cycleIndex, ctx) => {
    if (userId === null || userId <= 0) return;
    const myList = items.filter((k) => k.userId === userId);
    if (myList.length === 0) return;

    const idx = cycleIndex % myList.length;
    const target = myList[idx];
    const origin = ctx.prepareShoreLaunchOrigin();
    const pos = sampleKrathongWorldPosition(
      target,
      Date.now(),
      origin.islandCenterX,
      origin.islandW,
      origin.islandD
    );

    ctx.focusItem(target.id, 8500);
    const dirX = pos.x - origin.islandCenterX;
    const dirZ = pos.z;
    const len = Math.hypot(dirX, dirZ) || 1;
    ctx.focusWorldCamera({
      lookAtX: pos.x,
      lookAtY: 0.2,
      lookAtZ: pos.z,
      posX: pos.x + (dirX / len) * 11.5,
      posY: 8.5,
      posZ: pos.z + (dirZ / len) * 11.5 + 4.5,
    });

    const stMeta = getKrathongStyleMeta(target.styleId);
    ctx.showToast(
      stMeta.emoji,
      `กระทงใบที่ ${idx + 1}/${myList.length} ของคุณ`,
      target.caption ? `“${target.caption}”` : stMeta.name
    );
  },

  submitAction: async ({ styleId, caption }, ctx) => {
    const origin = ctx.prepareShoreLaunchOrigin();
    const laneOffset = Number((4.0 + Math.random() * 4.4).toFixed(2));
    const orbitSeed =
      origin.startX !== null && origin.startZ !== null
        ? computeOrbitSeedFromPoint(
            origin.startX,
            origin.startZ,
            laneOffset,
            origin.islandCenterX,
            origin.islandW,
            origin.islandD
          )
        : Number(Math.random().toFixed(4));

    try {
      const res = await sessionFetch(LOY_KRATHONG_DEFINITION.apiBasePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: ctx.player.id ?? ctx.currentUserId,
          userName: ctx.player.name || 'นักเดินทางริมหาด',
          userEmoji: ctx.player.emoji || '🪷',
          styleId,
          caption,
          avatarColor: ctx.player.colorHex || '#F472B6',
          avatarBand: ctx.player.bandColor || '#FFE600',
          avatarSpecies: ctx.player.species || 'bunny',
          orbitSeed,
          laneOffset,
          startX: origin.startX,
          startZ: origin.startZ,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.krathong) {
        ctx.showToast(
          '🚫',
          'ปล่อยกระทงไม่สำเร็จ',
          data?.error || 'กรุณาลองใหม่อีกครั้งนะ'
        );
        return;
      }

      const launched: KrathongItem = data.krathong;
      const nextList = mergeWithAmbientKrathongs([launched, ...ctx.items]);
      ctx.setItems(nextList);
      ctx.closeModal();

      playKrathongLaunchSfx();
      confetti({
        particleCount: 65,
        spread: 75,
        origin: { y: 0.65 },
        colors: ['#FDE047', '#F472B6', '#38BDF8', '#FB923C'],
      });

      ctx.focusItem(launched.id, 9000);
      const stMeta = getKrathongStyleMeta(launched.styleId);
      ctx.showToast(
        '🪷',
        `ปล่อย${stMeta.name}ลงน้ำแล้ว!`,
        launched.caption
          ? `“${launched.caption}”`
          : 'กระทงของคุณกำลังค่อยๆ ลอยวนรอบเกาะ ✨'
      );

      ctx.broadcastRealtimeEvent(LOY_KRATHONG_REALTIME_EVENT, { krathong: launched });
    } catch {
      ctx.showToast(
        '🚫',
        'เชื่อมต่อไม่ได้',
        'ไม่สามารถปล่อยกระทงได้ในขณะนี้ ลองใหม่อีกครั้งนะ'
      );
    }
  },

  onRealtimeEvent: (event, payload, ctx) => {
    if (event !== LOY_KRATHONG_REALTIME_EVENT) return;
    const incoming = payload.krathong as KrathongItem | undefined;
    if (!incoming || incoming.id === undefined || incoming.id === null) return;

    const exists = ctx.items.some((k) => String(k.id) === String(incoming.id));
    if (!exists) {
      ctx.setItems(mergeWithAmbientKrathongs([incoming, ...ctx.items]));
    }
    if (ctx.isWorldActive && ctx.phase !== 'ended') {
      ctx.focusItem(incoming.id, 7000);
      ctx.showToast(
        '🪷',
        `${incoming.userEmoji || '🪷'} ${incoming.userName} ลอยกระทงริมเกาะ!`,
        incoming.caption ? `“${incoming.caption}”` : 'ปล่อยกระทงลงสู่สายน้ำรอบเกาะแล้ว ✨'
      );
    }
  },
};
