import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createClient } from '@libsql/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function resolveTsFileCandidate(absBase) {
  const candidates = [
    absBase,
    `${absBase}.ts`,
    `${absBase}.tsx`,
    `${absBase}.js`,
    path.join(absBase, 'index.ts'),
    path.join(absBase, 'index.tsx'),
    path.join(absBase, 'index.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return pathToFileURL(c).href;
    }
  }
  return null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const parentUrl = context.parentURL || '';
    const isWorkspaceParent =
      parentUrl.startsWith('file:') && !parentUrl.includes('/node_modules/');

    if (specifier === 'next/server') {
      return nextResolve(
        `data:text/javascript,${encodeURIComponent(
          'export const NextResponse = { json: (body, init) => Response.json(body, init) };'
        )}`,
        context
      );
    }
    if (specifier === 'next/dynamic') {
      return nextResolve(
        `data:text/javascript,${encodeURIComponent(
          'export default function dynamicMock() { return function DynamicComponent() { return null; }; }'
        )}`,
        context
      );
    }
    if (isWorkspaceParent && specifier.startsWith('@/')) {
      const mapped = resolveTsFileCandidate(path.join(repoRoot, specifier.slice(2)));
      if (mapped) return nextResolve(mapped, context);
    }
    if (
      isWorkspaceParent &&
      (specifier.startsWith('./') || specifier.startsWith('../'))
    ) {
      const parentDir = path.dirname(fileURLToPath(parentUrl));
      const mapped = resolveTsFileCandidate(path.resolve(parentDir, specifier));
      if (mapped) return nextResolve(mapped, context);
    }
    return nextResolve(specifier, context);
  },
});

const {
  computeFestivalPhase,
  resolveIslandWeatherTargets,
  selectActiveFestivalDefinition,
} = await import('../festivals/schedule.ts');

const {
  AMBIENT_NPC_KRATHONGS,
  KRATHONG_STYLES,
  LOY_KRATHONG_DEFINITION,
  LOY_KRATHONG_ENCORE_END_MS,
  LOY_KRATHONG_LIVE_END_MS,
  LOY_KRATHONG_YT_ID,
  getKrathongStyleMeta,
  getLoyKrathongPhase,
  isValidKrathongStyle,
  mapRowToKrathong,
  mergeWithAmbientKrathongs,
  sanitizeKrathongLaunchPayload,
} = await import('../festivals/loy-krathong/catalog.ts');

const {
  animateKrathongParts,
  buildKrathongMesh,
  computeOrbitSeedFromPoint,
  sampleIslandKrathongOrbit,
  sampleKrathongWorldPosition,
} = await import('../festivals/loy-krathong/krathong3d.ts');

const {
  createKrathongRecord,
  ensureLoyKrathongSchema,
  handleGetKrathongs,
  handlePostKrathong,
  listRecentKrathongs,
} = await import('../festivals/loy-krathong/server.ts');

const { dispatchFestivalGet, dispatchFestivalPost, ensureFestivalSchemas } = await import(
  '../festivals/server.ts'
);

const THREE = await import('three');
const { createIslandNightSkyController } = await import('../festivals/defaultSky3d.ts');
const { createLoyKrathongFullMoonSky } = await import('../festivals/loy-krathong/sky3d.ts');
const { createLoyKrathongSceneController } = await import(
  '../festivals/loy-krathong/sceneController.ts'
);
const { registerLoyKrathongBgm } = await import('../festivals/loy-krathong/bgm.ts');
const {
  __resetBgmStateForTests,
  getCurrentBgmTrack,
  isBgmPlaying,
  preloadBgm,
  registerFestivalBgmTrack,
  startBgm,
  stopBgm,
} = await import('../lib/bgm.ts');

test('computeFestivalPhase handles upcoming, live, encore, and ended boundaries accurately', () => {
  const schedule = {
    liveStartMs: 1_000,
    liveEndMs: 2_000,
    encoreEndMs: 3_000,
  };
  assert.equal(computeFestivalPhase(schedule, 999), 'upcoming');
  assert.equal(computeFestivalPhase(schedule, 1_000), 'live');
  assert.equal(computeFestivalPhase(schedule, 1_999), 'live');
  assert.equal(computeFestivalPhase(schedule, 2_000), 'encore');
  assert.equal(computeFestivalPhase(schedule, 2_999), 'encore');
  assert.equal(computeFestivalPhase(schedule, 3_000), 'ended');

  // Schedule without liveStartMs or encoreEndMs
  const simpleSchedule = { liveEndMs: 5_000 };
  assert.equal(computeFestivalPhase(simpleSchedule, 0), 'live');
  assert.equal(computeFestivalPhase(simpleSchedule, 4_999), 'live');
  assert.equal(computeFestivalPhase(simpleSchedule, 5_000), 'ended');
});

test('selectActiveFestivalDefinition prioritizes live over encore and respects priority/overrides', () => {
  const festA = {
    definition: {
      ...LOY_KRATHONG_DEFINITION,
      id: 'fest_encore_high_prio',
      priority: 100,
      schedule: { liveStartMs: 1_000, liveEndMs: 2_000, encoreEndMs: 4_000 },
    },
  };
  const festB = {
    definition: {
      ...LOY_KRATHONG_DEFINITION,
      id: 'fest_live_low_prio',
      priority: 5,
      schedule: { liveStartMs: 2_500, liveEndMs: 5_000, encoreEndMs: 6_000 },
    },
  };
  const festC = {
    definition: {
      ...LOY_KRATHONG_DEFINITION,
      id: 'fest_live_higher_prio',
      priority: 20,
      schedule: { liveStartMs: 3_000, liveEndMs: 5_000 },
    },
  };

  // At t=2_200: festA is in encore, festB & festC are upcoming -> festA ('encore')
  const r1 = selectActiveFestivalDefinition([festA, festB, festC], 2_200);
  assert.equal(r1?.entry.definition.id, 'fest_encore_high_prio');
  assert.equal(r1?.phase, 'encore');

  // At t=2_600: festA is in encore (prio 100), festB is live (prio 5) -> live MUST win!
  const r2 = selectActiveFestivalDefinition([festA, festB, festC], 2_600);
  assert.equal(r2?.entry.definition.id, 'fest_live_low_prio');
  assert.equal(r2?.phase, 'live');

  // At t=3_500: both festB (prio 5) and festC (prio 20) are live -> higher priority wins
  const r3 = selectActiveFestivalDefinition([festA, festB, festC], 3_500);
  assert.equal(r3?.entry.definition.id, 'fest_live_higher_prio');
  assert.equal(r3?.phase, 'live');

  // At t=9_000: all ended -> null
  assert.equal(selectActiveFestivalDefinition([festA, festB, festC], 9_000), null);

  // Forced festival ID & phase override
  const forced = selectActiveFestivalDefinition([festA, festB], 9_000, {
    forceFestivalId: 'fest_encore_high_prio',
    forcePhase: 'encore',
  });
  assert.equal(forced?.entry.definition.id, 'fest_encore_high_prio');
  assert.equal(forced?.phase, 'encore');
  assert.equal(
    selectActiveFestivalDefinition([festA], 1_500, { forceFestivalId: 'unknown_id' }),
    null
  );
});

test('Loy Krathong 2026 schedule cutoffs, YouTube BGM 95s3Y8nVMV4, and encore labels match requirements', () => {
  assert.equal(LOY_KRATHONG_YT_ID, '95s3Y8nVMV4');
  assert.equal(LOY_KRATHONG_DEFINITION.bgm.youtubeVideoId, '95s3Y8nVMV4');
  assert.equal(LOY_KRATHONG_DEFINITION.apiBasePath, '/api/festivals/loy_krathong');
  assert.match(LOY_KRATHONG_DEFINITION.hud.encoreInactiveLabel, /ควันหลง/);
  assert.match(LOY_KRATHONG_DEFINITION.hud.mobileEncoreInactiveLabel, /ควันหลงคืนลอยกระทง/);

  assert.equal(
    getLoyKrathongPhase(Date.parse('2026-11-24T23:30:00+07:00')),
    'live'
  );
  assert.equal(getLoyKrathongPhase(LOY_KRATHONG_LIVE_END_MS - 1), 'live');
  assert.equal(getLoyKrathongPhase(LOY_KRATHONG_LIVE_END_MS), 'encore');
  assert.equal(getLoyKrathongPhase(LOY_KRATHONG_ENCORE_END_MS - 1), 'encore');
  assert.equal(getLoyKrathongPhase(LOY_KRATHONG_ENCORE_END_MS), 'ended');
});

test('resolveIslandWeatherTargets applies full-moon night sky override and falls back cleanly', () => {
  const stormDay = {
    temp: 29,
    isDay: true,
    dayPhase: 'day',
    condition: 'storm',
    label: 'พายุฝน',
    emoji: '⛈️',
  };
  const overridden = resolveIslandWeatherTargets(
    stormDay,
    LOY_KRATHONG_DEFINITION.weatherOverride
  );
  assert.equal(overridden.showNight, true);
  assert.equal(overridden.isRaining, false);
  assert.equal(overridden.targetHex, 0x08122e);

  const normalStorm = resolveIslandWeatherTargets(stormDay, null);
  assert.equal(normalStorm.showNight, false);
  assert.equal(normalStorm.isRaining, true);

  const clearNight = resolveIslandWeatherTargets(
    {
      temp: 25,
      isDay: false,
      dayPhase: 'night',
      condition: 'clear',
      label: 'ฟ้าโปร่ง',
      emoji: '🌙',
    },
    null
  );
  assert.equal(clearNight.showNight, true);
  assert.equal(clearNight.isRaining, false);
});

test('Krathong catalog validation, deduplication, and payload sanitization handle edge cases', () => {
  assert.equal(isValidKrathongStyle('moo_deng'), true);
  assert.equal(isValidKrathongStyle('invalid_style'), false);
  assert.equal(isValidKrathongStyle(null), false);
  assert.equal(getKrathongStyleMeta('non_existent').id, 'lotus_classic');

  // Deduplication and ambient NPC preservation
  const customItem = {
    ...AMBIENT_NPC_KRATHONGS[0],
    id: 501,
    userId: 7,
    userName: 'เมย์',
    caption: 'ขอให้เอวเอส!',
  };
  const merged = mergeWithAmbientKrathongs([customItem, customItem]);
  assert.equal(merged[0].id, 501);
  assert.equal(merged.length, 1 + AMBIENT_NPC_KRATHONGS.length);

  // Sanitization with null / empty strings / multiline / long captions / out-of-bounds numbers
  const s1 = sanitizeKrathongLaunchPayload({
    userId: -5,
    styleId: 'unknown',
    caption: `บรรทัดแรก\r\nบรรทัดสอง ${'ก'.repeat(100)}`,
    userName: '   ',
    userEmoji: '',
    orbitSeed: null,
    laneOffset: '',
    startX: null,
    startZ: '',
  });
  assert.equal(s1.uid, null);
  assert.equal(s1.styleId, 'lotus_classic');
  assert.ok(!s1.cleanCaption.includes('\n'));
  assert.equal(s1.cleanCaption.length, 75);
  assert.equal(s1.userName, 'นักเดินทางริมหาด');
  assert.equal(s1.userEmoji, '🪷');
  assert.equal(s1.startX, null);
  assert.equal(s1.startZ, null);
  assert.ok(s1.laneOffset >= 4.0 && s1.laneOffset <= 8.4);

  const s2 = sanitizeKrathongLaunchPayload({
    userId: '42',
    styleId: 'moo_deng',
    caption: 'เพี้ยง!',
    orbitSeed: 9.5,
    laneOffset: 1.0,
    startX: '12.3456',
    startZ: '-24.789',
  });
  assert.equal(s2.uid, 42);
  assert.equal(s2.styleId, 'moo_deng');
  assert.equal(s2.orbitSeed, 0.9999);
  assert.equal(s2.laneOffset, 3.6);
  assert.equal(s2.startX, 12.35);
  assert.equal(s2.startZ, -24.79);

  const mapped = mapRowToKrathong({
    id: '9',
    user_id: null,
    style_id: 'bad_style',
    orbit_seed: 'NaN',
  });
  assert.equal(mapped.id, 9);
  assert.equal(mapped.styleId, 'lotus_classic');
  assert.equal(mapped.orbitSeed, 0);
});

test('3D Krathong mesh builder and island water orbit math succeed for all 12 styles in headless Node', () => {
  for (const st of KRATHONG_STYLES) {
    const parts = buildKrathongMesh(st.id, {
      colorHex: st.id === 'my_character' ? 'bad-hex' : '#38BDF8',
      bandColor: '#FACC15',
      species: 'dragon',
      emoji: st.emoji,
    });
    assert.ok(parts.group.children.length >= 2);
    animateKrathongParts(parts, 3.45, 0.42, 0.65);
    assert.ok(Number.isFinite(parts.floatBody.position.y));
    assert.ok(Number.isFinite(parts.flameMesh.scale.y));
  }

  const centerX = 5.5;
  const islandW = 84;
  const islandD = 44;
  const p0 = sampleIslandKrathongOrbit(0, 5.2, centerX, islandW, islandD);
  const p1 = sampleIslandKrathongOrbit(1, 5.2, centerX, islandW, islandD);
  assert.ok(Math.abs(p0.x - p1.x) < 1e-6);
  assert.ok(Math.abs(p0.z - p1.z) < 1e-6);

  const pNeg = sampleIslandKrathongOrbit(-0.25, 5.2, centerX, islandW, islandD);
  const pPos = sampleIslandKrathongOrbit(0.75, 5.2, centerX, islandW, islandD);
  assert.ok(Math.abs(pNeg.x - pPos.x) < 1e-6);
  assert.ok(Math.abs(pNeg.z - pPos.z) < 1e-6);

  // Every sampled orbit point must remain outside dry island bounds
  for (let i = 0; i < 60; i++) {
    const pt = sampleIslandKrathongOrbit(i / 60, 4.2, centerX, islandW, islandD);
    const outsideX = Math.abs(pt.x - centerX) > islandW / 2;
    const outsideZ = Math.abs(pt.z) > islandD / 2;
    assert.ok(outsideX || outsideZ, `Point (${pt.x}, ${pt.z}) clipped inside island!`);
  }

  const seed = computeOrbitSeedFromPoint(5.5, -28, 5.0, centerX, islandW, islandD);
  assert.ok(seed >= 0 && seed < 1);

  const item = {
    orbitSeed: seed,
    laneOffset: 5.0,
    startX: 5.5,
    startZ: -24.0,
    createdAt: 10_000,
  };
  const atLaunch = sampleKrathongWorldPosition(item, 10_000, centerX, islandW, islandD);
  assert.equal(atLaunch.x, 5.5);
  assert.equal(atLaunch.z, -24.0);

  const afterGlide = sampleKrathongWorldPosition(item, 16_000, centerX, islandW, islandD);
  assert.ok(afterGlide.z < -24.0);
});

test('Festival DB schema & HTTP handlers persist and retrieve shared Krathongs in SQLite', async () => {
  const memDb = createClient({ url: ':memory:' });
  const safeAlter = async (sql) => {
    try {
      await memDb.execute(sql);
    } catch {
      // ignore
    }
  };

  await memDb.execute(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      avatar_emoji TEXT NOT NULL,
      color_hex TEXT NOT NULL,
      band_color TEXT NOT NULL,
      species TEXT NOT NULL
    )
  `);
  await memDb.execute({
    sql: `INSERT INTO users (id, name, avatar_emoji, color_hex, band_color, species) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [1, 'กัปตันเอวบาง', '🦊', '#FB923C', '#38BDF8', 'fox'],
  });

  // Run schema via generic festival server registry
  await ensureFestivalSchemas(memDb, safeAlter);
  await ensureLoyKrathongSchema(memDb, safeAlter);

  // Create Krathong via HTTP POST handler with user profile lookup
  const postReq = new Request('http://localhost/api/krathong', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: 1,
      styleId: 'my_character',
      caption: 'ขอให้วิ่งครบแสนก้าว! 🔥',
      orbitSeed: 0.25,
      laneOffset: 6.0,
      startX: 10.5,
      startZ: -25.2,
    }),
  });
  const postRes = await handlePostKrathong(postReq, memDb);
  assert.equal(postRes.status, 200);
  const postData = await postRes.json();
  assert.equal(postData.success, true);
  assert.equal(postData.krathong.userName, 'กัปตันเอวบาง');
  assert.equal(postData.krathong.userEmoji, '🦊');
  assert.equal(postData.krathong.avatarSpecies, 'fox');

  // Unlimited launches per user (second Krathong by same user succeeds with no coin side-effects)
  await createKrathongRecord(
    { userId: 1, styleId: 'moo_deng', caption: 'ใบที่สอง หมูเด้งเด้งดึ๋ง!' },
    memDb
  );

  const getRes = await handleGetKrathongs(memDb);
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.krathongs.length, 2);
  const list = await listRecentKrathongs(memDb, 10);
  assert.equal(list.length, 2);

  // Reject malformed JSON & non-object JSON cleanly with 400
  const badJsonRes = await handlePostKrathong(
    new Request('http://localhost/api/krathong', { method: 'POST', body: '{bad' }),
    memDb
  );
  assert.equal(badJsonRes.status, 400);

  const nullBodyRes = await handlePostKrathong(
    new Request('http://localhost/api/krathong', { method: 'POST', body: 'null' }),
    memDb
  );
  assert.equal(nullBodyRes.status, 400);

  // Generic festival dispatcher returns 404 for unknown festival IDs
  const unknownGet = await dispatchFestivalGet(
    'songkran_2099',
    new Request('http://localhost/api/festivals/songkran_2099')
  );
  assert.equal(unknownGet.status, 404);
  const unknownPost = await dispatchFestivalPost(
    'songkran_2099',
    new Request('http://localhost/api/festivals/songkran_2099', { method: 'POST' })
  );
  assert.equal(unknownPost.status, 404);

  // Generic festival POST dispatcher enforces per-tab session guard when userId is present
  const kickedPost = await dispatchFestivalPost(
    'loy-krathong',
    new Request('http://localhost/api/festivals/loy-krathong', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-session-token': 'stale-token' },
      body: JSON.stringify({ userId: 1, styleId: 'moo_deng', caption: 'stale attempt' }),
    }),
    {
      assertSession: async (_req, uid) => {
        assert.equal(uid, 1);
        return Response.json({ error: 'kicked', sessionKicked: true }, { status: 401 });
      },
    }
  );
  assert.equal(kickedPost.status, 401);
  const kickedJson = await kickedPost.json();
  assert.equal(kickedJson.sessionKicked, true);

  // Malformed JSON passes cleanly through dispatchFestivalPost to handler's 400 response
  let sessionCalledOnBadJson = false;
  const malformedViaDispatch = await dispatchFestivalPost(
    'loy_krathong',
    new Request('http://localhost/api/festivals/loy_krathong', {
      method: 'POST',
      body: '{malformed',
    }),
    {
      assertSession: async () => {
        sessionCalledOnBadJson = true;
        return null;
      },
    }
  );
  assert.equal(malformedViaDispatch.status, 400);
  assert.equal(sessionCalledOnBadJson, false);

  memDb.close();
});

test('createIslandNightSkyController isolates Loy Krathong full-moon sky from normal nights', () => {
  // 1. Non-festival night (activeModule = null): allocates ONLY standard night sky
  const normalScene = new THREE.Scene();
  const normalSky = createIslandNightSkyController(null, {
    scene: normalScene,
    islandCenterX: 5.5,
    islandW: 84,
    islandD: 44,
    qualityTier: 'high',
    starCount: 200,
    initialVisible: true,
  });
  assert.equal(normalSky.group.name, 'default-island-night-sky');
  normalSky.update(1.5, false);
  assert.equal(normalSky.group.visible, true);

  // 2. Active Loy Krathong module: switches cleanly between full-moon sky and real-weather night sky
  const festScene = new THREE.Scene();
  const mockLoyModule = {
    definition: LOY_KRATHONG_DEFINITION,
    createSkyController: createLoyKrathongFullMoonSky,
    clientAdapter: null,
    createSceneController: null,
  };
  const festSky = createIslandNightSkyController(mockLoyModule, {
    scene: festScene,
    islandCenterX: 5.5,
    islandW: 84,
    islandD: 44,
    qualityTier: 'lite',
    starCount: 80,
    initialVisible: true,
  });

  const defaultChild = festSky.group.getObjectByName('default-island-night-sky');
  const fullMoonChild = festSky.group.getObjectByName('loy-krathong-full-moon-sky');
  assert.ok(defaultChild);
  assert.ok(fullMoonChild);

  // Festival sky active ("🌕 คืนวันเพ็ญ") -> full moon rabbit + lanterns visible, default hidden
  festSky.update(2.0, true);
  assert.equal(fullMoonChild.visible, true);
  assert.equal(defaultChild.visible, false);

  // Real-weather night mode ("🌤️ อากาศจริง") -> full moon rabbit hidden, default night sky visible
  festSky.update(3.0, false);
  assert.equal(fullMoonChild.visible, false);
  assert.equal(defaultChild.visible, true);

  // Daytime -> entire sky host hidden
  festSky.setVisible(false);
  assert.equal(festSky.group.visible, false);
});

test('createLoyKrathongSceneController syncs ownership, escapes HTML, raycasts, and disposes cleanly', () => {
  const prevDoc = globalThis.document;
  const makeMockElement = () => {
    const el = {
      className: '',
      innerHTML: '',
      parentNode: null,
      children: [],
      style: {
        opacity: '1',
        zIndex: '0',
        props: {},
        setProperty(k, v) {
          this.props[k] = v;
        },
      },
      appendChild(child) {
        child.parentNode = this;
        this.children.push(child);
        return child;
      },
      remove() {
        if (this.parentNode) {
          this.parentNode.children = this.parentNode.children.filter((c) => c !== this);
          this.parentNode = null;
        }
      },
    };
    return el;
  };

  globalThis.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return { width: 2, height: 2, getContext: () => null };
      }
      return makeMockElement();
    },
  };

  try {
    const scene = new THREE.Scene();
    const labelsContainer = makeMockElement();
    const toasts = [];
    const focused = [];

    const controller = createLoyKrathongSceneController({
      scene,
      labelsContainer,
      qualityTier: 'lite',
      islandCenterX: 5.5,
      islandW: 84,
      islandD: 44,
      showToast: (emoji, title, text) => toasts.push({ emoji, title, text }),
      onFocusItem: (id, dur) => focused.push({ id, dur }),
    });

    const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 300);
    camera.position.set(5.5, 18, 36);
    camera.lookAt(5.5, 0, -28);
    camera.updateMatrixWorld();

    const xssItem = {
      id: 777,
      userId: 9,
      userName: '<img src=x onerror=alert(1)>',
      userEmoji: '🦊',
      styleId: 'my_character',
      caption: '<script>evil()</script>',
      avatarColor: '#FB923C',
      avatarBand: '#38BDF8',
      avatarSpecies: 'fox',
      orbitSeed: 0.25,
      laneOffset: 5.0,
      startX: null,
      startZ: null,
      createdAt: 10_000,
    };

    // Frame 1: viewer signed out (viewerUserId = null) -> scale 1.05, escaped HTML
    controller.update({
      elapsed: 1.0,
      nowPerfMs: 1_000,
      nowWallMs: 20_000,
      isVisible: true,
      viewerUserId: null,
      items: [xssItem],
      itemsSig: 'loy_krathong|1|1|777|777',
      focusedItemId: null,
      focusedUntilPerfMs: 0,
      camera,
      viewportWidth: 1280,
      viewportHeight: 720,
    });

    assert.equal(controller.group.children.length, 1);
    assert.equal(labelsContainer.children.length, 1);
    assert.ok(!labelsContainer.children[0].innerHTML.includes('<script>'));
    assert.ok(labelsContainer.children[0].innerHTML.includes('&lt;script&gt;'));
    assert.ok(Math.abs(controller.group.children[0].scale.x - 1.05) < 1e-6);

    // Frame 2: viewer signs in as userId = 9 -> ownership tag & scale upgrade to 1.18 without recreating mesh
    const meshBeforeSignIn = controller.group.children[0];
    controller.update({
      elapsed: 1.5,
      nowPerfMs: 1_500,
      nowWallMs: 20_500,
      isVisible: true,
      viewerUserId: 9,
      items: [xssItem],
      itemsSig: 'loy_krathong|1|1|777|777',
      focusedItemId: null,
      focusedUntilPerfMs: 0,
      camera,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    assert.equal(controller.group.children[0], meshBeforeSignIn);
    assert.ok(Math.abs(controller.group.children[0].scale.x - 1.18) < 1e-6);
    assert.match(labelsContainer.children[0].innerHTML, /กระทงของคุณ/);

    // Raycast tap directly toward the floating Krathong triggers focus & toast
    meshBeforeSignIn.updateMatrixWorld(true);
    const targetPos = meshBeforeSignIn.position.clone().setY(meshBeforeSignIn.position.y + 0.15);
    const rayDir = targetPos.clone().sub(camera.position).normalize();
    const raycaster = new THREE.Raycaster(camera.position.clone(), rayDir);
    const tapped = controller.onPointerTap(raycaster);
    assert.equal(tapped, true);
    assert.equal(focused.length, 1);
    assert.equal(focused[0].id, 777);
    assert.equal(toasts.length, 1);

    // Hiding festival world sets tag opacity to 0
    controller.update({
      elapsed: 2.0,
      nowPerfMs: 2_000,
      nowWallMs: 21_000,
      isVisible: false,
      viewerUserId: 9,
      items: [xssItem],
      itemsSig: 'loy_krathong|1|1|777|777',
      focusedItemId: null,
      focusedUntilPerfMs: 0,
      camera,
      viewportWidth: 1280,
      viewportHeight: 720,
    });
    assert.equal(labelsContainer.children[0].style.opacity, '0');

    // Standalone dispose removes DOM tags AND detaches krathongSceneGroup from scene
    assert.ok(scene.children.includes(controller.group));
    controller.dispose();
    assert.equal(labelsContainer.children.length, 0);
    assert.ok(!scene.children.includes(controller.group));
  } finally {
    globalThis.document = prevDoc;
  }
});

test('lib/bgm switches dynamically across multiple festival YouTube tracks and arena synth cleanly', () => {
  const prevWin = globalThis.window;
  const prevDoc = globalThis.document;

  const ytCalls = [];
  let capturedEvents = null;
  let capturedPlayerVars = null;
  let playerInstance = null;

  class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
    }
    resume() {
      return Promise.resolve();
    }
    createOscillator() {
      return {
        type: 'sine',
        frequency: { setValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      };
    }
    createGain() {
      return {
        gain: {
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
        },
        connect() {},
      };
    }
  }

  class MockYTPlayer {
    constructor(_elId, opts) {
      playerInstance = this;
      capturedPlayerVars = opts.playerVars;
      capturedEvents = opts.events;
      ytCalls.push({ op: 'init', videoId: opts.videoId });
    }
    unMute() {
      ytCalls.push({ op: 'unMute' });
    }
    setVolume(v) {
      ytCalls.push({ op: 'setVolume', volume: v });
    }
    playVideo() {
      ytCalls.push({ op: 'playVideo' });
    }
    pauseVideo() {
      ytCalls.push({ op: 'pauseVideo' });
    }
    stopVideo() {
      ytCalls.push({ op: 'stopVideo' });
    }
    seekTo(sec, ahead) {
      ytCalls.push({ op: 'seekTo', sec, ahead });
    }
    loadVideoById(videoId, startSeconds) {
      ytCalls.push({ op: 'loadVideoById', videoId, startSeconds });
    }
    cueVideoById(videoId, startSeconds) {
      ytCalls.push({ op: 'cueVideoById', videoId, startSeconds });
    }
  }

  const domById = new Map();
  globalThis.document = {
    getElementById: (id) => domById.get(id) || null,
    createElement: () => ({
      id: '',
      style: {},
      setAttribute() {},
      appendChild(child) {
        if (child.id) domById.set(child.id, child);
      },
    }),
    body: {
      appendChild(wrapper) {},
    },
    head: {
      appendChild() {},
    },
  };
  globalThis.window = {
    location: { origin: 'http://localhost:3000' },
    YT: { Player: MockYTPlayer },
    AudioContext: MockAudioContext,
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
  };

  try {
    __resetBgmStateForTests();
    registerLoyKrathongBgm();
    registerFestivalBgmTrack({
      trackId: 'songkran_splash',
      youtubeVideoId: 'SONGKRAN_VID_99',
      volume: 62,
      stepIntervalMs: 200,
      onSynthStep: () => {},
    });

    // 1. Preload & start Loy Krathong BGM
    preloadBgm('loy_krathong');
    assert.equal(ytCalls[0].op, 'init');
    assert.equal(ytCalls[0].videoId, '95s3Y8nVMV4');
    // Must NOT lock playerVars.playlist to initialVideoId
    assert.equal(capturedPlayerVars.playlist, undefined);

    // Simulate YT onReady firing
    capturedEvents.onReady({ target: playerInstance });

    startBgm('loy_krathong');
    assert.equal(isBgmPlaying(), true);
    assert.equal(getCurrentBgmTrack(), 'loy_krathong');
    assert.ok(ytCalls.some((c) => c.op === 'playVideo'));

    // 2. While Loy Krathong is actively playing, preloadBgm for another festival must NOT interrupt via cueVideoById
    const callsBeforePreload = ytCalls.length;
    preloadBgm('songkran_splash');
    assert.equal(ytCalls.length, callsBeforePreload);

    // 3. Switching directly to second festival calls loadVideoById('SONGKRAN_VID_99', 0)
    startBgm('songkran_splash');
    assert.equal(getCurrentBgmTrack(), 'songkran_splash');
    assert.ok(
      ytCalls.some((c) => c.op === 'loadVideoById' && c.videoId === 'SONGKRAN_VID_99'),
      `Expected loadVideoById('SONGKRAN_VID_99'), got: ${JSON.stringify(ytCalls)}`
    );

    // 4. When second festival video ends (state === 0), it loops cleanly via seekTo(0) + playVideo()
    ytCalls.length = 0;
    capturedEvents.onStateChange({ data: 0, target: playerInstance });
    assert.equal(ytCalls[0].op, 'seekTo');
    assert.equal(ytCalls[1].op, 'playVideo');

    // 5. Switching back to normal 'arena' pauses YouTube and starts WebAudio synth, then stopBgm stops all
    ytCalls.length = 0;
    startBgm('arena');
    assert.equal(getCurrentBgmTrack(), 'arena');
    assert.ok(ytCalls.some((c) => c.op === 'pauseVideo'));

    stopBgm();
    assert.equal(isBgmPlaying(), false);
  } finally {
    __resetBgmStateForTests();
    globalThis.window = prevWin;
    globalThis.document = prevDoc;
  }
});
