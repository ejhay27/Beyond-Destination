import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GameState,
  MemoryStorage,
  SAVE_PREFIX,
  SELECTED_SLOT_KEY,
} from '../src/game-state.js';

function makeState() {
  return new GameState(new MemoryStorage());
}

test('parcel errand is a one-time, state-gated progression loop', () => {
  const state = makeState();
  assert.equal(state.credits, 85);
  assert.equal(state.taskStage, 'available');

  assert.equal(state.acceptDelivery(), true);
  assert.equal(state.acceptDelivery(), false);
  assert.equal(state.taskStage, 'fetch');
  assert.equal(state.completeDelivery(), false);

  assert.equal(state.collectParcel(), true);
  assert.equal(state.collectParcel(), false);
  assert.equal(state.inventory.sealedParcel, 1);
  assert.equal(state.taskStage, 'return');

  assert.equal(state.completeDelivery(), true);
  assert.equal(state.credits, 120);
  assert.equal(state.inventory.sealedParcel, 0);
  assert.equal(state.taskStage, 'done');
  assert.equal(state.completeDelivery(), false);
});

test('transactions reject negative, fractional, and unaffordable amounts', () => {
  const state = makeState();
  assert.equal(state.spend(86), false);
  assert.equal(state.spend(-1), false);
  assert.equal(state.spend(2.5), false);
  assert.equal(state.credits, 85);
  assert.equal(state.spend(35), true);
  assert.equal(state.credits, 50);
  assert.equal(state.earn(15), true);
  assert.equal(state.credits, 65);
});

test('world clock carries fractional minutes and rolls over the calendar', () => {
  const state = makeState();
  state.advanceClock(0.5);
  assert.equal(state.minuteOfDay, 480);
  state.advanceClock(0.5);
  assert.equal(state.minuteOfDay, 481);

  state.minuteOfDay = 1439;
  state.advanceClock(1);
  assert.equal(state.day, 2);
  assert.equal(state.minuteOfDay, 0);
});

test('rest advances to the next morning and restores energy', () => {
  const state = makeState();
  state.energy = 22;
  state.restUntilMorning();
  assert.equal(state.day, 2);
  assert.equal(state.minuteOfDay, 360);
  assert.equal(state.energy, 100);
});

test('save/load persists progression, inventory, transform, and camera preferences', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  state.acceptDelivery();
  state.collectParcel();
  state.day = 4;
  state.minuteOfDay = 997;
  state.credits = 241;
  state.energy = 61;
  state.graphics.shadows = false;
  state.syncRuntime({
    position: [8.5, 0.2, -11],
    playerYaw: -0.75,
    camera: {
      mode: 'first',
      yaw: -0.75,
      pitch: 0.12,
      distance: 6,
      sensitivity: 0.0031,
      fov: 72,
      invertY: true,
    },
  });

  assert.equal(state.saveSlot(2).ok, true);
  const loaded = new GameState(storage);
  assert.equal(loaded.selectedSlot, 2);
  const result = loaded.loadSlot(2);
  assert.deepEqual(result, { ok: true, slot: 2, recovered: false, source: 'primary' });
  assert.equal(loaded.day, 4);
  assert.equal(loaded.minuteOfDay, 997);
  assert.equal(loaded.credits, 241);
  assert.equal(loaded.energy, 61);
  assert.equal(loaded.graphics.shadows, false);
  assert.equal(loaded.taskStage, 'return');
  assert.equal(loaded.inventory.sealedParcel, 1);
  assert.deepEqual(loaded.player.position, [8.5, 0.2, -11]);
  assert.equal(loaded.camera.mode, 'first');
  assert.equal(loaded.camera.sensitivity, 0.0031);
  assert.equal(loaded.camera.invertY, true);
});

test('a damaged primary save recovers the previous validated copy', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  assert.equal(state.saveSlot(1).ok, true);
  state.credits = 200;
  assert.equal(state.saveSlot(1).ok, true);
  storage.setItem(`${SAVE_PREFIX}1`, '{not valid json');

  const loaded = new GameState(storage);
  const result = loaded.loadSlot(1);
  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.source, 'backup');
  assert.equal(loaded.credits, 85);
});

test('interrupted temporary write can be recovered without trusting invalid data', () => {
  const storage = new MemoryStorage();
  const stagedState = new GameState(storage);
  stagedState.credits = 177;
  storage.setItem(`${SAVE_PREFIX}3`, 'broken');
  storage.setItem(`${SAVE_PREFIX}3.tmp`, JSON.stringify(stagedState.createSaveDocument()));

  const loaded = new GameState(storage);
  const result = loaded.loadSlot(3);
  assert.equal(result.ok, true);
  assert.equal(result.source, 'temporary');
  assert.equal(loaded.credits, 177);

  storage.setItem(`${SAVE_PREFIX}3.tmp`, JSON.stringify({ schemaVersion: 999 }));
  assert.equal(new GameState(storage).loadSlot(3).ok, false);
});

test('selected save slot preference persists and invalid values fall back safely', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  assert.equal(state.setSelectedSlot(3), true);
  assert.equal(new GameState(storage).selectedSlot, 3);
  storage.setItem(SELECTED_SLOT_KEY, '99');
  assert.equal(new GameState(storage).selectedSlot, 1);
});

test('save validation rejects malformed currency and inconsistent inventory', () => {
  const state = makeState();
  const malformed = state.createSaveDocument();
  malformed.state.credits = -50;
  assert.equal(GameState.validateDocument(malformed), null);

  const inconsistent = state.createSaveDocument();
  inconsistent.state.taskStage = 'return';
  inconsistent.state.inventory.sealedParcel = 0;
  assert.equal(GameState.validateDocument(inconsistent), null);
});
