import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  DIVINATION_METHODS,
  FORTUNE_TOPICS,
  drawRandomTarotSpread,
  drawRandomEsiimsiStick,
  drawRandomCrystalAura,
  drawRandomRuneCast,
  buildFallbackFortuneReading,
} from '../lib/fortune_teller.ts';

test('DIVINATION_METHODS and FORTUNE_TOPICS include all 5 divination arts, 5 topics, and sample questions', () => {
  assert.equal(DIVINATION_METHODS.length, 5);
  assert.equal(FORTUNE_TOPICS.length, 5);
  const methodIds = DIVINATION_METHODS.map((m) => m.id);
  assert.deepEqual(methodIds, ['tarot', 'esiimsi', 'crystal_aura', 'zodiac', 'runes']);
  for (const t of FORTUNE_TOPICS) {
    assert.ok(Array.isArray(t.sampleQuestions) && t.sampleQuestions.length >= 3);
  }
});

test('Ritual generators produce valid unique draws across Tarot, Esiimsi, Aura, and Runes', () => {
  const tarot = drawRandomTarotSpread();
  assert.equal(tarot.length, 3);
  assert.equal(new Set(tarot.map((t) => t.card.id)).size, 3);

  const stick = drawRandomEsiimsiStick();
  assert.ok(stick.number >= 1 && stick.number <= 28);
  assert.equal(stick.poem.length, 4);

  const aura = drawRandomCrystalAura();
  assert.ok(aura.nameTh.length > 0);

  const runeCast = drawRandomRuneCast();
  assert.equal(runeCast.runes.length, 3);
  assert.equal(new Set(runeCast.runes.map((r) => r.id)).size, 3);
  assert.ok(runeCast.lifePathCode >= 1 && runeCast.lifePathCode <= 9);
});

test('buildFallbackFortuneReading incorporates custom question, player name, and valid star rating', () => {
  const res = buildFallbackFortuneReading({
    methodId: 'tarot',
    topicId: 'health',
    question: 'เดือนนี้จะลดเอวทันเป้าไหม',
    artifactSummary: 'ไพ่ The Sun ตั้งตรง',
    playerName: 'มินนี่',
  });
  assert.equal(res.source, 'fallback');
  assert.ok(res.reading.includes('คุณมินนี่'));
  assert.ok(res.reading.includes('เดือนนี้จะลดเอวทันเป้าไหม'));
  assert.ok(res.starRating >= 1 && res.starRating <= 5);
  assert.ok(res.luckyColor.length > 0);
  assert.ok(res.luckyNumbers.length > 0);
});

test('3D Fortune Booth controller mounts, raycasts, and disposes tag cleanly', async () => {
  const { createFortuneBoothController } = await import('../lib/fortune_booth_3d.ts');
  let removed = false;
  let clicked = false;
  const fakeTag = {
    className: '',
    onclick: null,
    innerHTML: '',
    style: {
      opacity: '0',
      setProperty: () => {},
    },
    remove: () => {
      removed = true;
    },
  };
  globalThis.document = {
    createElement: () => fakeTag,
  };
  const fakeLabels = {
    appendChild: () => {},
  };

  const scene = new THREE.Scene();
  const pos = new THREE.Vector3(-20, 0.2, -12);
  const ctrl = createFortuneBoothController({
    scene,
    labelsContainer: fakeLabels,
    position: pos,
    onSelectBooth: () => {
      clicked = true;
    },
  });

  assert.equal(scene.children.includes(ctrl.group), true);
  ctrl.group.updateMatrixWorld(true);

  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(-20, 1.2, -8),
    new THREE.Vector3(0, 0, -1)
  );
  const hit = ctrl.onPointerTap(raycaster);
  assert.equal(hit, true);
  assert.equal(clicked, true);

  ctrl.dispose();
  assert.equal(removed, true);
  delete globalThis.document;
});
