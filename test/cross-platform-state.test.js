import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState, MemoryStorage, SAVE_PREFIX, SAVE_SCHEMA_VERSION, SELECTED_SLOT_KEY } from '../src/game-state.js';
import { PreferencesStorage } from '../src/storage.js';
import { nextBackAction, renderingOptions } from '../src/platform.js';

function oldSave() {
  const document = new GameState(new MemoryStorage()).createSaveDocument();
  document.schemaVersion = 1;
  document.state.graphics = { shadows: false };
  delete document.state.settings;
  document.state.day = 12;
  document.state.credits = 321;
  document.state.taskStage = 'return';
  document.state.inventory = { sealedParcel: 1, shells: 7 };
  document.state.player.position = [0, 0.13, -20];
  return document;
}

test('schema-1 migration preserves every original gameplay and camera field', () => {
  const old = oldSave();
  const migrated = GameState.validateDocument(old);
  assert.equal(migrated.schemaVersion, SAVE_SCHEMA_VERSION);
  for (const field of ['day', 'minuteOfDay', 'credits', 'energy', 'taskStage', 'inventory', 'player', 'camera']) assert.deepEqual(migrated.state[field], old.state[field]);
  assert.deepEqual(migrated.state.graphics, { quality: 'balanced', shadows: false, renderScale: 1 });
  assert.equal(migrated.state.settings.touchControls, 'auto');
});

test('old saves are found under the unchanged original slot keys', () => {
  const storage = new MemoryStorage();
  storage.setItem(`${SAVE_PREFIX}2`, JSON.stringify(oldSave()));
  const state = new GameState(storage);
  assert.equal(state.loadSlot(2).ok, true);
  assert.equal(state.credits, 321);
  assert.equal(state.saveSlot(2).ok, true);
  assert.equal(JSON.parse(storage.getItem(`${SAVE_PREFIX}2`)).schemaVersion, 2);
  assert.equal(JSON.parse(storage.getItem(`${SAVE_PREFIX}2.bak`)).schemaVersion, 1);
});

test('missing presentation settings default safely; malformed gameplay never imports', () => {
  const document = oldSave();
  delete document.state.graphics;
  assert.equal(GameState.validateDocument(document).state.graphics.shadows, false);
  delete document.state.inventory;
  assert.equal(GameState.validateDocument(document), null);
  assert.equal(GameState.validateDocument('null'), null);
  assert.equal(GameState.validateDocument('{bad'), null);
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(GameState.validateDocument(cyclic), null);
  assert.equal(GameState.validateDocument('x'.repeat(1_000_001)), null);
});

test('future primary is protected, even if an older backup can be validated', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  state.saveSlot(1);
  const future = { ...oldSave(), schemaVersion: 99 };
  storage.setItem(`${SAVE_PREFIX}1.bak`, JSON.stringify(oldSave()));
  storage.setItem(`${SAVE_PREFIX}1`, JSON.stringify(future));
  assert.equal(state.loadSlot(1).reason, 'newer-schema');
  assert.equal(state.saveSlot(1).reason, 'protected-save');
  assert.deepEqual(JSON.parse(storage.getItem(`${SAVE_PREFIX}1`)), future);
});

test('repairing a corrupt primary does not destroy its valid recovery backup', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  storage.setItem(`${SAVE_PREFIX}1`, 'bad');
  const good = JSON.stringify(oldSave());
  storage.setItem(`${SAVE_PREFIX}1.bak`, good);
  assert.equal(state.loadSlot(1).source, 'backup');
  assert.equal(state.saveSlot(1).reason, 'protected-save');
  assert.equal(state.saveSlot(1, { allowOverwrite: true }).ok, true);
  assert.equal(storage.getItem(`${SAVE_PREFIX}1.bak`), good);
});

test('portable import requires overwrite consent and is atomic on validation failure', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  state.saveSlot(1);
  const original = storage.getItem(`${SAVE_PREFIX}1`);
  assert.equal(state.importSave(JSON.stringify(oldSave()), 1).reason, 'slot-occupied');
  assert.equal(state.importSave('{bad', 1, { overwrite: true }).reason, 'invalid-import');
  assert.equal(storage.getItem(`${SAVE_PREFIX}1`), original);
  assert.equal(state.credits, 85);
  assert.equal(state.importSave(JSON.stringify(oldSave()), 1, { overwrite: true }).ok, true);
  assert.equal(state.credits, 321);
  assert.equal(storage.getItem(`${SAVE_PREFIX}1.bak`), original);
});

test('PC-to-Android-to-PC JSON round-trip preserves progression and settings', () => {
  const pc = new GameState(new MemoryStorage());
  pc.applySaveDocument(oldSave());
  pc.graphics = { quality: 'low', shadows: false, renderScale: 0.7 };
  pc.settings.touchControls = 'on';
  const android = new GameState(new MemoryStorage());
  assert.equal(android.importSave(JSON.stringify(pc.createSaveDocument()), 3).ok, true);
  const backOnPC = new GameState(new MemoryStorage());
  backOnPC.importSave(JSON.stringify(android.createSaveDocument()), 2);
  assert.deepEqual(backOnPC.createSaveDocument().state, pc.createSaveDocument().state);
});

test('selecting an export/load target does not redirect autosave to another journey', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  state.credits = 500; state.saveSlot(2);
  state.credits = 85; state.saveSlot(1);
  state.setSelectedSlot(2);
  state.credits = 120; state.saveSlot(1, { select: false });
  assert.equal(state.selectedSlot, 2);
  assert.equal(storage.getItem(SELECTED_SLOT_KEY), '2');
  assert.equal(JSON.parse(storage.getItem(`${SAVE_PREFIX}2`)).state.credits, 500);
});

test('storage write failures keep a recoverable primary or staged document', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  state.saveSlot(1);
  const original = storage.getItem(`${SAVE_PREFIX}1`);
  const originalSet = storage.setItem.bind(storage);
  storage.setItem = (key, value) => { if (key === `${SAVE_PREFIX}1`) throw new Error('quota'); originalSet(key, value); };
  state.credits = 200;
  assert.equal(state.saveSlot(1).reason, 'storage-write-failed');
  assert.equal(storage.getItem(`${SAVE_PREFIX}1`), original);
  assert.ok(GameState.validateDocument(storage.getItem(`${SAVE_PREFIX}1.tmp`)));
});

function fakePreferences(values = new Map()) {
  return {
    values, operations: [],
    async get({ key }) { return { value: values.get(key) ?? null }; },
    async set({ key, value }) { this.operations.push(`set:${key}`); values.set(key, value); },
    async remove({ key }) { this.operations.push(`remove:${key}`); values.delete(key); },
  };
}

test('native write queue persists staged operations in order and survives restart', async () => {
  const plugin = fakePreferences();
  const native = await new PreferencesStorage(plugin).initialize();
  const state = new GameState(native);
  state.acceptDelivery(); state.collectParcel(); state.setSelectedSlot(3);
  assert.equal(state.saveSlot(3).persistent, true);
  assert.equal(plugin.values.has(`${SAVE_PREFIX}3`), false);
  await native.flush();
  assert.ok(plugin.operations.indexOf(`set:${SAVE_PREFIX}3.tmp`) < plugin.operations.indexOf(`set:${SAVE_PREFIX}3`));
  assert.ok(plugin.operations.indexOf(`set:${SAVE_PREFIX}3`) < plugin.operations.indexOf(`remove:${SAVE_PREFIX}3.tmp`));
  const restarted = new GameState(await new PreferencesStorage(plugin).initialize());
  assert.equal(restarted.selectedSlot, 3);
  assert.equal(restarted.loadSlot(3).ok, true);
  assert.equal(restarted.taskStage, 'return');
});

test('native persistence failures reject flush, retain queued writes and allow retry', async () => {
  const plugin = fakePreferences();
  const storage = await new PreferencesStorage(plugin).initialize();
  storage.setItem('test', 'life');
  const set = plugin.set.bind(plugin);
  plugin.set = async () => { throw new Error('disk failure'); };
  await assert.rejects(storage.flush(), /disk failure/);
  assert.equal(storage.queue.length, 1);
  plugin.set = set;
  await storage.flush();
  assert.equal(plugin.values.get('test'), 'life');
  assert.equal(storage.queue.length, 0);
});

test('native adapter can migrate existing WebView local saves without deleting them', async () => {
  const browser = new MemoryStorage();
  browser.setItem(`${SAVE_PREFIX}2`, JSON.stringify(oldSave()));
  const plugin = fakePreferences();
  const adapter = await new PreferencesStorage(plugin).initialize(browser);
  assert.equal(new GameState(adapter).loadSlot(2).ok, true);
  assert.equal(plugin.values.get(`${SAVE_PREFIX}2`), browser.getItem(`${SAVE_PREFIX}2`));
});

test('Back navigation has one explicit, tested priority order', () => {
  assert.equal(nextBackAction({ confirmation: true, dialogue: true, panel: 'settings' }), 'cancel-confirmation');
  assert.equal(nextBackAction({ dialogue: true }), 'close-dialogue');
  assert.equal(nextBackAction({ panel: 'inventory', construction: true }), 'close-panel');
  assert.equal(nextBackAction({ construction: true }), 'exit-construction');
  assert.equal(nextBackAction(), 'open-pause');
  assert.equal(nextBackAction({ panel: 'settings' }), 'offer-exit');
});

test('graphics presets change only rendering limits, not gameplay state', () => {
  const state = new GameState(new MemoryStorage());
  const original = JSON.stringify(state.createSaveDocument().state);
  assert.equal(renderingOptions({ quality: 'low', shadows: false, renderScale: 1 }, 3).pixelRatio, 0.85);
  assert.equal(renderingOptions({ quality: 'high', shadows: true, renderScale: 0.6 }, 3).pixelRatio, 1.75 * 0.6);
  assert.equal(renderingOptions({ quality: 'balanced', shadows: false, renderScale: 1 }, 1).shadows, false);
  assert.equal(JSON.stringify(state.createSaveDocument().state), original);
});

test('a silently rejected primary write is detected and its staged copy is retained', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  state.saveSlot(1);
  const oldPrimary = storage.getItem(`${SAVE_PREFIX}1`);
  const set = storage.setItem.bind(storage);
  storage.setItem = (key, value) => { if (key !== `${SAVE_PREFIX}1`) set(key, value); };
  state.credits = 300;
  assert.equal(state.saveSlot(1).reason, 'write-verification-failed');
  assert.equal(storage.getItem(`${SAVE_PREFIX}1`), oldPrimary);
  assert.equal(GameState.validateDocument(storage.getItem(`${SAVE_PREFIX}1.tmp`)).state.credits, 300);
});

test('unrecognized gameplay fields/items are protected, not silently stripped by a reused schema', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  const otherMilestone = state.createSaveDocument();
  otherMilestone.state.housing = { property: 'a-different-milestone' };
  assert.equal(GameState.validateDocument(otherMilestone), null);
  const raw = JSON.stringify(otherMilestone);
  storage.setItem(`${SAVE_PREFIX}1`, raw);
  assert.equal(state.saveSlot(1).reason, 'protected-save');
  assert.equal(storage.getItem(`${SAVE_PREFIX}1`), raw);
  const foreignItems = state.createSaveDocument();
  foreignItems.state.inventory.unrecognizedFurniture = 3;
  assert.equal(state.importSave(JSON.stringify(foreignItems), 2).reason, 'invalid-import');
  assert.equal(storage.getItem(`${SAVE_PREFIX}2`), null);
});
