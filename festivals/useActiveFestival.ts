'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { preloadBgm, startBgm, stopBgm } from '@/lib/bgm';
import { ensureFestivalBgmsRegistered, resolveActiveFestival } from './registry';
import type {
  FestivalCameraFocusTarget,
  FestivalDefinition,
  FestivalLaunchOrigin,
  FestivalModule,
  FestivalPhase,
  FestivalPlayerIdentity,
  FestivalWeatherLightingOverride,
} from './types';

export interface UseActiveFestivalOptions {
  currentUserId: number | null;
  walkingSpectatorId: number | null;
  isMusicOn: boolean;
  setIsMusicOn: React.Dispatch<React.SetStateAction<boolean>>;
  getPlayerIdentity: () => FestivalPlayerIdentity;
  prepareShoreLaunchOrigin: () => FestivalLaunchOrigin;
  focusWorldCamera: (target: FestivalCameraFocusTarget) => void;
  showToast: (emoji: string, title: string, text: string) => void;
  broadcastRealtimeEvent: (event: string, payload: Record<string, unknown>) => void;
}

export interface ActiveFestivalController {
  module: FestivalModule | null;
  moduleRef: React.MutableRefObject<FestivalModule | null>;
  definition: FestivalDefinition | null;
  phase: FestivalPhase;
  phaseRef: React.MutableRefObject<FestivalPhase>;
  isWorldActive: boolean;
  isWorldActiveRef: React.MutableRefObject<boolean>;
  activeWeatherOverride: FestivalWeatherLightingOverride | null;
  activeWeatherOverrideRef: React.MutableRefObject<FestivalWeatherLightingOverride | null>;
  activeBgmTrack: string | null;
  activeBgmTrackRef: React.MutableRefObject<string | null>;
  busyModalLabel: string;
  isModalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  submitting: boolean;
  items: unknown[];
  itemsRef: React.MutableRefObject<unknown[]>;
  itemsSigRef: React.MutableRefObject<string>;
  focusedItemIdRef: React.MutableRefObject<string | number | null>;
  focusedUntilPerfMsRef: React.MutableRefObject<number>;
  focusItem: (itemId: string | number, durationMs: number) => void;
  myItemsCount: number;
  cycleMyItems: () => void;
  toggleFestivalMode: () => void;
  submitAction: (input: unknown) => Promise<void>;
  handleRealtimeEvent: (event: string, payload: Record<string, unknown>) => void;
}

function buildItemsSig(
  mod: FestivalModule | null,
  items: readonly unknown[],
  revision: number
): string {
  if (!mod) return 'none';
  const firstId = items.length > 0 ? String(mod.clientAdapter.getItemId(items[0])) : '';
  const lastId =
    items.length > 0 ? String(mod.clientAdapter.getItemId(items[items.length - 1])) : '';
  return `${mod.definition.id}|${revision}|${items.length}|${firstId}|${lastId}`;
}

export function useActiveFestival(
  options: UseActiveFestivalOptions
): ActiveFestivalController {
  ensureFestivalBgmsRegistered();

  const {
    currentUserId,
    walkingSpectatorId,
    isMusicOn,
    setIsMusicOn,
    getPlayerIdentity,
    prepareShoreLaunchOrigin,
    focusWorldCamera,
    showToast,
    broadcastRealtimeEvent,
  } = options;

  const initialResolved = useMemo(() => resolveActiveFestival(), []);
  const [activeState, setActiveState] = useState<{
    module: FestivalModule | null;
    phase: FestivalPhase;
  }>(() => ({
    module: initialResolved?.module ?? null,
    phase: initialResolved?.phase ?? 'ended',
  }));

  const [isWorldActive, setIsWorldActive] = useState<boolean>(
    () => initialResolved?.phase === 'live'
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItemsState] = useState<unknown[]>(
    () => initialResolved?.module.clientAdapter.initialItems ?? []
  );

  const activeModule = activeState.module;
  const phase = activeState.phase;

  const activeModuleRef = useRef<FestivalModule | null>(activeModule);
  activeModuleRef.current = activeModule;

  const phaseRef = useRef<FestivalPhase>(phase);
  phaseRef.current = phase;

  const isWorldActiveRef = useRef<boolean>(isWorldActive);
  isWorldActiveRef.current = isWorldActive;

  const isMusicOnRef = useRef<boolean>(isMusicOn);
  isMusicOnRef.current = isMusicOn;

  const encoreAutoStartedMusicRef = useRef<boolean>(false);

  const itemsRevisionRef = useRef<number>(1);
  const itemsRef = useRef<unknown[]>(items);
  const itemsSigRef = useRef<string>(
    buildItemsSig(activeModule, items, itemsRevisionRef.current)
  );

  const cycleIdxRef = useRef<number>(0);
  const focusedItemIdRef = useRef<string | number | null>(null);
  const focusedUntilPerfMsRef = useRef<number>(0);

  const callbacksRef = useRef({
    getPlayerIdentity,
    prepareShoreLaunchOrigin,
    focusWorldCamera,
    showToast,
    broadcastRealtimeEvent,
  });
  callbacksRef.current = {
    getPlayerIdentity,
    prepareShoreLaunchOrigin,
    focusWorldCamera,
    showToast,
    broadcastRealtimeEvent,
  };

  useEffect(() => {
    if (!isMusicOn) {
      encoreAutoStartedMusicRef.current = false;
    }
  }, [isMusicOn]);

  const setItems = useCallback((nextItems: unknown[]) => {
    itemsRevisionRef.current += 1;
    itemsRef.current = nextItems;
    itemsSigRef.current = buildItemsSig(
      activeModuleRef.current,
      nextItems,
      itemsRevisionRef.current
    );
    setItemsState(nextItems);
  }, []);

  const focusItem = useCallback((itemId: string | number, durationMs: number) => {
    focusedItemIdRef.current = itemId;
    focusedUntilPerfMsRef.current = performance.now() + durationMs;
  }, []);

  const openModal = useCallback(() => {
    if (phaseRef.current === 'ended' || !activeModuleRef.current) return;
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Close festival modal if player stops roaming
  useEffect(() => {
    if (walkingSpectatorId === null) {
      setIsModalOpen(false);
    }
  }, [walkingSpectatorId]);

  const applyResolvedLifecycle = useCallback((): {
    module: FestivalModule | null;
    phase: FestivalPhase;
  } => {
    const resolved = resolveActiveFestival();
    const nextMod = resolved?.module ?? null;
    const nextPhase: FestivalPhase = resolved?.phase ?? 'ended';

    const prevMod = activeModuleRef.current;
    const prevPhase = phaseRef.current;
    const prevId = prevMod?.definition.id ?? null;
    const nextId = nextMod?.definition.id ?? null;

    if (prevId === nextId && prevPhase === nextPhase) {
      return { module: nextMod, phase: nextPhase };
    }

    activeModuleRef.current = nextMod;
    phaseRef.current = nextPhase;
    setActiveState({ module: nextMod, phase: nextPhase });

    if (prevId !== nextId) {
      cycleIdxRef.current = 0;
      focusedItemIdRef.current = null;
      focusedUntilPerfMsRef.current = 0;
      const seedItems = nextMod?.clientAdapter.initialItems ?? [];
      itemsRevisionRef.current += 1;
      itemsRef.current = seedItems;
      itemsSigRef.current = buildItemsSig(nextMod, seedItems, itemsRevisionRef.current);
      setItemsState(seedItems);
      setIsModalOpen(false);

      const nextWorld = nextPhase === 'live';
      isWorldActiveRef.current = nextWorld;
      setIsWorldActive(nextWorld);

      if (prevPhase === 'encore' && encoreAutoStartedMusicRef.current && isMusicOnRef.current) {
        encoreAutoStartedMusicRef.current = false;
        if (!nextWorld) {
          stopBgm();
          setIsMusicOn(false);
        }
      } else {
        encoreAutoStartedMusicRef.current = false;
      }
    } else if (nextPhase === 'encore' || nextPhase === 'ended') {
      isWorldActiveRef.current = false;
      setIsWorldActive(false);
      setIsModalOpen(false);
      if (
        prevPhase === 'encore' &&
        nextPhase === 'ended' &&
        encoreAutoStartedMusicRef.current &&
        isMusicOnRef.current
      ) {
        encoreAutoStartedMusicRef.current = false;
        stopBgm();
        setIsMusicOn(false);
      }
    }

    return { module: nextMod, phase: nextPhase };
  }, [setIsMusicOn]);

  // Automatic lifecycle cutoff check every 30s (e.g., 07:00 AM morning cutoff: 'live' -> 'encore' -> 'ended')
  useEffect(() => {
    applyResolvedLifecycle();
    const iv = setInterval(applyResolvedLifecycle, 30_000);
    return () => clearInterval(iv);
  }, [applyResolvedLifecycle]);

  const fetchFestivalItems = useCallback(async () => {
    const mod = activeModuleRef.current;
    if (!mod || phaseRef.current === 'ended') return;
    const fetched = await mod.clientAdapter.fetchItems();
    if (fetched && activeModuleRef.current?.definition.id === mod.definition.id) {
      setItems(fetched);
    }
  }, [setItems]);

  const activeFestivalId = activeModule?.definition.id ?? null;

  // Poll shared festival items while festival is in 'live' or 'encore'
  useEffect(() => {
    if (!activeModule || phase === 'ended') return;
    void fetchFestivalItems();
    const iv = setInterval(fetchFestivalItems, activeModule.clientAdapter.pollIntervalMs);
    return () => clearInterval(iv);
  }, [activeFestivalId, activeModule, phase, fetchFestivalItems]);

  // Preload & auto-unlock festival BGM on first interaction during 'live' night
  useEffect(() => {
    if (typeof window === 'undefined' || !activeModule || phase === 'ended') return;
    const bgmDesc = activeModule.definition.bgm;
    preloadBgm(bgmDesc.trackId);

    if (phase !== 'live' || !bgmDesc.autoPlayOnLiveInteraction) return;
    let mutedPref = false;
    try {
      mutedPref = localStorage.getItem('waist_bgm_muted') === '1';
    } catch {
      // ignore storage error
    }
    if (mutedPref) return;

    const unlockAndPlay = () => {
      window.removeEventListener('pointerdown', unlockAndPlay);
      window.removeEventListener('keydown', unlockAndPlay);
      try {
        if (localStorage.getItem('waist_bgm_muted') === '1') return;
      } catch {
        // ignore
      }
      if (!isWorldActiveRef.current || phaseRef.current !== 'live') return;
      startBgm(bgmDesc.trackId);
      setIsMusicOn(true);
    };

    window.addEventListener('pointerdown', unlockAndPlay, { passive: true });
    window.addEventListener('keydown', unlockAndPlay);
    return () => {
      window.removeEventListener('pointerdown', unlockAndPlay);
      window.removeEventListener('keydown', unlockAndPlay);
    };
  }, [activeFestivalId, activeModule, phase, setIsMusicOn]);

  // Automatically switch BGM track between festival theme and arena synth when music is on
  const activeBgmTrackId =
    isWorldActive && phase !== 'ended' && activeModule
      ? activeModule.definition.bgm.trackId
      : null;
  const activeBgmTrackRef = useRef<string | null>(activeBgmTrackId);
  activeBgmTrackRef.current = activeBgmTrackId;

  useEffect(() => {
    if (!isMusicOn) return;
    startBgm(activeBgmTrackId ?? 'arena');
  }, [activeBgmTrackId, isMusicOn]);

  const toggleFestivalMode = useCallback(() => {
    const { module: mod, phase: curPhase } = applyResolvedLifecycle();
    if (!mod || curPhase === 'ended') return;

    const next = !isWorldActiveRef.current;
    isWorldActiveRef.current = next;
    setIsWorldActive(next);

    if (next) {
      void fetchFestivalItems();
      let mutedPref = false;
      try {
        mutedPref = localStorage.getItem('waist_bgm_muted') === '1';
      } catch {
        // ignore
      }
      if (!mutedPref) {
        if (curPhase === 'encore' && !isMusicOnRef.current) {
          encoreAutoStartedMusicRef.current = true;
        }
        startBgm(mod.definition.bgm.trackId);
        setIsMusicOn(true);
      }
      if (curPhase === 'encore' && mod.definition.hud.encoreActivatedToast) {
        const t = mod.definition.hud.encoreActivatedToast;
        callbacksRef.current.showToast(t.emoji, t.title, t.text);
      }
    } else {
      setIsModalOpen(false);
      if (curPhase === 'encore' && encoreAutoStartedMusicRef.current && isMusicOnRef.current) {
        encoreAutoStartedMusicRef.current = false;
        stopBgm();
        setIsMusicOn(false);
      }
    }
  }, [applyResolvedLifecycle, fetchFestivalItems, setIsMusicOn]);

  const myItemsCount = useMemo(() => {
    if (!activeModule) return 0;
    return activeModule.clientAdapter.countUserItems(items, currentUserId);
  }, [activeModule, items, currentUserId]);

  const cycleMyItems = useCallback(() => {
    const mod = activeModuleRef.current;
    if (!mod || !mod.clientAdapter.cycleUserItem) return;
    const idx = cycleIdxRef.current;
    cycleIdxRef.current = idx + 1;
    mod.clientAdapter.cycleUserItem(itemsRef.current, currentUserId, idx, {
      focusItem,
      focusWorldCamera: callbacksRef.current.focusWorldCamera,
      prepareShoreLaunchOrigin: callbacksRef.current.prepareShoreLaunchOrigin,
      showToast: callbacksRef.current.showToast,
    });
  }, [currentUserId, focusItem]);

  const submitAction = useCallback(
    async (input: unknown) => {
      const mod = activeModuleRef.current;
      if (!mod || submitting) return;
      setSubmitting(true);
      try {
        await mod.clientAdapter.submitAction(input, {
          currentUserId,
          player: callbacksRef.current.getPlayerIdentity(),
          phase: phaseRef.current,
          isWorldActive: isWorldActiveRef.current,
          items: itemsRef.current,
          setItems,
          closeModal,
          focusItem,
          focusWorldCamera: callbacksRef.current.focusWorldCamera,
          prepareShoreLaunchOrigin: callbacksRef.current.prepareShoreLaunchOrigin,
          showToast: callbacksRef.current.showToast,
          broadcastRealtimeEvent: callbacksRef.current.broadcastRealtimeEvent,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [closeModal, currentUserId, focusItem, setItems, submitting]
  );

  const handleRealtimeEvent = useCallback(
    (event: string, payload: Record<string, unknown>) => {
      const mod = activeModuleRef.current;
      if (!mod || !mod.clientAdapter.onRealtimeEvent) return;
      if (!mod.definition.realtimeEvents.includes(event)) return;
      mod.clientAdapter.onRealtimeEvent(event, payload, {
        items: itemsRef.current,
        setItems,
        isWorldActive: isWorldActiveRef.current,
        phase: phaseRef.current,
        focusItem,
        showToast: callbacksRef.current.showToast,
      });
    },
    [focusItem, setItems]
  );

  const definition = activeModule?.definition ?? null;
  const activeWeatherOverride =
    isWorldActive && phase !== 'ended' && definition?.weatherOverride
      ? definition.weatherOverride
      : null;
  const activeWeatherOverrideRef = useRef<FestivalWeatherLightingOverride | null>(
    activeWeatherOverride
  );
  activeWeatherOverrideRef.current = activeWeatherOverride;

  return {
    module: activeModule,
    moduleRef: activeModuleRef,
    definition,
    phase,
    phaseRef,
    isWorldActive,
    isWorldActiveRef,
    activeWeatherOverride,
    activeWeatherOverrideRef,
    activeBgmTrack: activeBgmTrackId,
    activeBgmTrackRef,
    busyModalLabel: isModalOpen && definition ? definition.hud.busyModalLabel : '',
    isModalOpen,
    openModal,
    closeModal,
    submitting,
    items,
    itemsRef,
    itemsSigRef,
    focusedItemIdRef,
    focusedUntilPerfMsRef,
    focusItem,
    myItemsCount,
    cycleMyItems,
    toggleFestivalMode,
    submitAction,
    handleRealtimeEvent,
  };
}
