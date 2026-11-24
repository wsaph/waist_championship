import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STORAGE_ACTIVE_INSTANCE_KEY,
  STORAGE_SESSION_TOKEN_KEY,
  STORAGE_USER_ID_KEY,
  buildSessionHeaders,
  claimBrowserSession,
  clearTabSession,
  evaluateSessionMatch,
  getActiveTabSessionToken,
  getActiveTabUserId,
  getTabInstanceId,
  restoreTabSessionFromStorage,
  shouldClearStorageOnKick,
} from '../lib/client_session.ts';

function createMockLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
}

test('evaluateSessionMatch distinguishes migration, valid match, and stale token kick', () => {
  assert.equal(evaluateSessionMatch('', 'any-token'), 'needs_migration');
  assert.equal(evaluateSessionMatch(null, ''), 'needs_migration');
  assert.equal(evaluateSessionMatch('   ', 'abc'), 'needs_migration');

  assert.equal(evaluateSessionMatch('tok-12345', 'tok-12345'), 'valid');
  assert.equal(evaluateSessionMatch('  tok-12345 ', 'tok-12345'), 'valid');

  assert.equal(evaluateSessionMatch('tok-new-device', 'tok-old-device'), 'invalid');
  assert.equal(evaluateSessionMatch('tok-new-device', ''), 'invalid');
  assert.equal(evaluateSessionMatch('tok-new-device', null), 'invalid');
});

test('shouldClearStorageOnKick preserves localStorage on same-browser tab takeover and clears on cross-device kick', () => {
  // Explicit preserveOverride when kicked by a newer tab in the same browser
  assert.equal(shouldClearStorageOnKick('tab-1', 'tab-1', true), false);

  // Stored instance already belongs to Tab 2 -> Tab 1 must NOT wipe Tab 2's localStorage
  assert.equal(shouldClearStorageOnKick('tab-2', 'tab-1', false), false);

  // Stored instance still belongs to this device -> cross-device kick MUST clear localStorage
  assert.equal(shouldClearStorageOnKick('device-1-tab', 'device-1-tab', false), true);
  assert.equal(shouldClearStorageOnKick(null, 'device-1-tab', false), true);
});

test('per-tab session lifecycle claims, attaches x-session-token header, and isolates kicked tab state', () => {
  const mockStorage = createMockLocalStorage();
  globalThis.window = { localStorage: mockStorage };
  globalThis.localStorage = mockStorage;

  try {
    const myInst = getTabInstanceId();
    assert.ok(myInst.length > 5);

    const claimed = claimBrowserSession(42, 'uuid-device-session-0001');
    assert.equal(getActiveTabUserId(), 42);
    assert.equal(getActiveTabSessionToken(), 'uuid-device-session-0001');
    assert.equal(mockStorage.getItem(STORAGE_USER_ID_KEY), '42');
    assert.equal(mockStorage.getItem(STORAGE_SESSION_TOKEN_KEY), 'uuid-device-session-0001');
    assert.equal(mockStorage.getItem(STORAGE_ACTIVE_INSTANCE_KEY), claimed.instanceId);

    const headers = buildSessionHeaders({ 'Content-Type': 'application/json' });
    assert.equal(headers.get('x-session-token'), 'uuid-device-session-0001');
    assert.equal(headers.get('content-type'), 'application/json');

    // Simulate Tab 2 taking over shared localStorage in the same browser
    mockStorage.setItem(STORAGE_ACTIVE_INSTANCE_KEY, 'newer-tab-instance-999');
    clearTabSession({ preserveLocalStorage: true });

    // Tab 1's in-memory session is wiped, while Tab 2's localStorage remains intact!
    assert.equal(getActiveTabUserId(), null);
    assert.equal(getActiveTabSessionToken(), '');
    assert.equal(buildSessionHeaders().get('x-session-token'), null);
    assert.equal(mockStorage.getItem(STORAGE_USER_ID_KEY), '42');
    assert.equal(mockStorage.getItem(STORAGE_SESSION_TOKEN_KEY), 'uuid-device-session-0001');

    // Simulate restoring on mount and then being kicked by a DIFFERENT device
    const restored = restoreTabSessionFromStorage();
    assert.equal(restored.userId, 42);
    assert.equal(mockStorage.getItem(STORAGE_ACTIVE_INSTANCE_KEY), myInst);

    clearTabSession();
    assert.equal(getActiveTabUserId(), null);
    assert.equal(mockStorage.getItem(STORAGE_USER_ID_KEY), null);
    assert.equal(mockStorage.getItem(STORAGE_SESSION_TOKEN_KEY), null);
    assert.equal(mockStorage.getItem(STORAGE_ACTIVE_INSTANCE_KEY), null);
  } finally {
    delete globalThis.window;
    delete globalThis.localStorage;
  }
});
