import test from 'node:test';
import assert from 'node:assert';
import {
  loadFavourites,
  saveFavourites,
  toggleFavourite,
  isFavourite,
  FAVORITES_STORAGE_KEY
} from '../src/utils/favorites.js';

// Setup mock window.localStorage for Node environment
function setupMockStorage(initial = {}) {
  let store = { ...initial };
  const mockStorage = {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, val) => { store[key] = String(val); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
  globalThis.window = { localStorage: mockStorage };
  return () => {
    delete globalThis.window;
  };
}

test('Favorites: Loads valid IDs and sanitizes corrupted/non-existent IDs', () => {
  const cleanup = setupMockStorage({
    [FAVORITES_STORAGE_KEY]: JSON.stringify([8118, 6964, 'invalid-id', 99999999, null])
  });

  try {
    const favs = loadFavourites();
    assert.strictEqual(favs.length, 2);
    assert.ok(favs.includes(8118));
    assert.ok(favs.includes(6964));
    assert.ok(!favs.includes(99999999), 'Non-existent station must be purged');
  } finally {
    cleanup();
  }
});

test('Favorites: Handles empty localStorage without crashing', () => {
  const cleanup = setupMockStorage({});

  try {
    const favs = loadFavourites();
    assert.deepStrictEqual(favs, []);
  } finally {
    cleanup();
  }
});

test('Favorites: Toggle adds and removes stations correctly', () => {
  const cleanup = setupMockStorage({});

  try {
    // 1. Add station 8118
    let favs = toggleFavourite(8118, []);
    assert.strictEqual(favs.length, 1);
    assert.strictEqual(favs[0], 8118);
    assert.strictEqual(isFavourite(8118, favs), true);
    assert.strictEqual(isFavourite(6964, favs), false);

    // 2. Add station 6964
    favs = toggleFavourite(6964, favs);
    assert.strictEqual(favs.length, 2);
    assert.ok(favs.includes(8118));
    assert.ok(favs.includes(6964));

    // 3. Remove station 8118
    favs = toggleFavourite(8118, favs);
    assert.strictEqual(favs.length, 1);
    assert.strictEqual(favs[0], 6964);
    assert.strictEqual(isFavourite(8118, favs), false);
  } finally {
    cleanup();
  }
});
