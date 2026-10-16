export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_SLOT_COUNT = 3;
export const SAVE_PREFIX = 'beyond-destination.v1.slot-';
export const SELECTED_SLOT_KEY = 'beyond-destination.settings.selectedSlot';

const VALID_STAGES = new Set(['available', 'fetch', 'return', 'done']);
const CAMERA_MODES = new Set(['first', 'third']);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const integerInRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export class MemoryStorage {
  #values = new Map();

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.#values.set(String(key), String(value));
  }

  removeItem(key) {
    this.#values.delete(key);
  }
}

function getBrowserStorage() {
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      const probe = `${SAVE_PREFIX}probe`;
      globalThis.localStorage.setItem(probe, '1');
      globalThis.localStorage.removeItem(probe);
      return globalThis.localStorage;
    }
  } catch {
    // Private browsing policies and opaque file origins may deny storage.
  }
  return null;
}

function parseAndValidateSave(raw) {
  if (typeof raw !== 'string') return null;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.schemaVersion !== SAVE_SCHEMA_VERSION) return null;
  if (typeof value.savedAt !== 'string' || value.savedAt.length > 80) return null;

  const state = value.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  if (!integerInRange(state.day, 1, 1_000_000)) return null;
  if (!integerInRange(state.minuteOfDay, 0, 1439)) return null;
  if (!integerInRange(state.credits, 0, 1_000_000_000)) return null;
  if (!finite(state.energy) || state.energy < 0 || state.energy > 100) return null;
  if (!VALID_STAGES.has(state.taskStage)) return null;
  if (!state.graphics || typeof state.graphics !== 'object' || typeof state.graphics.shadows !== 'boolean') return null;

  const inventory = state.inventory;
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) return null;
  if (!integerInRange(inventory.sealedParcel, 0, 1)) return null;
  if (!integerInRange(inventory.shells, 0, 99)) return null;
  if ((state.taskStage === 'return') !== (inventory.sealedParcel === 1)) return null;

  const player = state.player;
  if (!player || typeof player !== 'object' || Array.isArray(player)) return null;
  if (!Array.isArray(player.position) || player.position.length !== 3 || !player.position.every(finite)) return null;
  if (player.position.some((coordinate) => Math.abs(coordinate) > 100)) return null;
  if (!finite(player.yaw) || Math.abs(player.yaw) > 1_000_000) return null;

  const camera = state.camera;
  if (!camera || typeof camera !== 'object' || Array.isArray(camera)) return null;
  if (!CAMERA_MODES.has(camera.mode)) return null;
  if (!finite(camera.yaw) || Math.abs(camera.yaw) > 1_000_000) return null;
  if (!finite(camera.pitch) || camera.pitch < -1.2 || camera.pitch > 1.35) return null;
  if (!finite(camera.distance) || camera.distance < 3.5 || camera.distance > 13) return null;
  if (!finite(camera.sensitivity) || camera.sensitivity < 0.0004 || camera.sensitivity > 0.008) return null;
  if (!finite(camera.fov) || camera.fov < 45 || camera.fov > 90) return null;
  if (typeof camera.invertY !== 'boolean') return null;

  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: value.savedAt,
    state: {
      day: state.day,
      minuteOfDay: state.minuteOfDay,
      credits: state.credits,
      energy: state.energy,
      taskStage: state.taskStage,
      graphics: { shadows: state.graphics.shadows },
      inventory: {
        sealedParcel: inventory.sealedParcel,
        shells: inventory.shells,
      },
      player: {
        position: [...player.position],
        yaw: player.yaw,
      },
      camera: {
        mode: camera.mode,
        yaw: camera.yaw,
        pitch: camera.pitch,
        distance: camera.distance,
        sensitivity: camera.sensitivity,
        fov: camera.fov,
        invertY: camera.invertY,
      },
    },
  };
}

export class GameState {
  constructor(storage = getBrowserStorage()) {
    this.storage = storage;
    this.persistentStorage = Boolean(storage && storage === getBrowserStorage());
    this.selectedSlot = 1;
    try {
      const preferredSlot = Number(this.storage?.getItem(SELECTED_SLOT_KEY));
      if (integerInRange(preferredSlot, 1, SAVE_SLOT_COUNT)) this.selectedSlot = preferredSlot;
    } catch {
      // Saving remains available for the active session even if this preference cannot be read.
    }
    this.restoreDefaults();
  }

  restoreDefaults() {
    this.day = 1;
    this.minuteOfDay = 8 * 60;
    this.credits = 85;
    this.energy = 100;
    this.taskStage = 'available';
    this.graphics = { shadows: false };
    this.inventory = { sealedParcel: 0, shells: 0 };
    this.player = { position: [0, 0, 10], yaw: 0 };
    this.camera = {
      mode: 'third',
      yaw: 0,
      pitch: 0.22,
      distance: 7.5,
      sensitivity: 0.0024,
      fov: 58,
      invertY: false,
    };
    this.minuteRemainder = 0;
  }

  setSelectedSlot(slot) {
    if (!integerInRange(slot, 1, SAVE_SLOT_COUNT)) return false;
    this.selectedSlot = slot;
    try {
      this.storage?.setItem(SELECTED_SLOT_KEY, String(slot));
    } catch {
      // Slot selection still works for this session if browser storage is full or restricted.
    }
    return true;
  }

  advanceClock(realSeconds) {
    if (!finite(realSeconds) || realSeconds <= 0) return;
    this.minuteRemainder += realSeconds;
    const elapsedMinutes = Math.floor(this.minuteRemainder);
    if (elapsedMinutes < 1) return;
    this.minuteRemainder -= elapsedMinutes;
    const totalMinutes = this.minuteOfDay + elapsedMinutes;
    this.day += Math.floor(totalMinutes / 1440);
    this.minuteOfDay = totalMinutes % 1440;
  }

  restUntilMorning() {
    this.day += 1;
    this.minuteOfDay = 6 * 60;
    this.energy = 100;
  }

  addEnergy(amount) {
    if (!finite(amount)) return;
    this.energy = clamp(this.energy + amount, 0, 100);
  }

  acceptDelivery() {
    if (this.taskStage !== 'available') return false;
    this.taskStage = 'fetch';
    return true;
  }

  collectParcel() {
    if (this.taskStage !== 'fetch' || this.inventory.sealedParcel !== 0) return false;
    this.inventory.sealedParcel = 1;
    this.taskStage = 'return';
    return true;
  }

  completeDelivery() {
    if (this.taskStage !== 'return' || this.inventory.sealedParcel !== 1) return false;
    this.inventory.sealedParcel = 0;
    this.credits += 35;
    this.taskStage = 'done';
    return true;
  }

  earn(amount) {
    if (!integerInRange(amount, 0, 1_000_000_000)) return false;
    this.credits = Math.min(1_000_000_000, this.credits + amount);
    return true;
  }

  spend(amount) {
    if (!integerInRange(amount, 1, 1_000_000_000) || amount > this.credits) return false;
    this.credits -= amount;
    return true;
  }

  syncRuntime({ position, playerYaw, camera } = {}) {
    if (Array.isArray(position) && position.length === 3 && position.every(finite)) {
      this.player.position = [...position];
    }
    if (finite(playerYaw)) this.player.yaw = playerYaw;
    if (camera && typeof camera === 'object') {
      const next = { ...this.camera, ...camera };
      if (CAMERA_MODES.has(next.mode)) this.camera.mode = next.mode;
      if (finite(next.yaw)) this.camera.yaw = next.yaw;
      if (finite(next.pitch)) this.camera.pitch = clamp(next.pitch, -1.2, 1.35);
      if (finite(next.distance)) this.camera.distance = clamp(next.distance, 3.5, 13);
      if (finite(next.sensitivity)) this.camera.sensitivity = clamp(next.sensitivity, 0.0004, 0.008);
      if (finite(next.fov)) this.camera.fov = clamp(next.fov, 45, 90);
      if (typeof next.invertY === 'boolean') this.camera.invertY = next.invertY;
    }
  }

  hasSave(slot) {
    if (!integerInRange(slot, 1, SAVE_SLOT_COUNT) || !this.storage) return false;
    const key = `${SAVE_PREFIX}${slot}`;
    try {
      return [key, `${key}.tmp`, `${key}.bak`]
        .some((candidate) => parseAndValidateSave(this.storage.getItem(candidate)) !== null);
    } catch {
      return false;
    }
  }

  createSaveDocument() {
    return {
      schemaVersion: SAVE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      state: {
        day: this.day,
        minuteOfDay: this.minuteOfDay,
        credits: this.credits,
        energy: this.energy,
        taskStage: this.taskStage,
        graphics: { ...this.graphics },
        inventory: { ...this.inventory },
        player: {
          position: [...this.player.position],
          yaw: this.player.yaw,
        },
        camera: { ...this.camera },
      },
    };
  }

  saveSlot(slot = this.selectedSlot) {
    if (!integerInRange(slot, 1, SAVE_SLOT_COUNT)) return { ok: false, reason: 'invalid-slot' };
    if (!this.storage) return { ok: false, reason: 'storage-unavailable' };

    const key = `${SAVE_PREFIX}${slot}`;
    const tempKey = `${key}.tmp`;
    const backupKey = `${key}.bak`;
    const document = this.createSaveDocument();
    const serialized = JSON.stringify(document);
    if (!parseAndValidateSave(serialized)) return { ok: false, reason: 'invalid-state' };

    try {
      const current = this.storage.getItem(key);
      if (current && parseAndValidateSave(current)) this.storage.setItem(backupKey, current);

      this.storage.setItem(tempKey, serialized);
      const staged = parseAndValidateSave(this.storage.getItem(tempKey));
      if (!staged) return { ok: false, reason: 'write-verification-failed' };

      this.storage.setItem(key, JSON.stringify(staged));
      this.storage.removeItem(tempKey);
      this.setSelectedSlot(slot);
      return { ok: true, slot, persistent: this.persistentStorage };
    } catch {
      return { ok: false, reason: 'storage-write-failed' };
    }
  }

  loadSlot(slot = this.selectedSlot) {
    if (!integerInRange(slot, 1, SAVE_SLOT_COUNT)) return { ok: false, reason: 'invalid-slot' };
    if (!this.storage) return { ok: false, reason: 'storage-unavailable' };

    const key = `${SAVE_PREFIX}${slot}`;
    const candidates = [
      { key, source: 'primary' },
      { key: `${key}.tmp`, source: 'temporary' },
      { key: `${key}.bak`, source: 'backup' },
    ];

    try {
      for (const candidate of candidates) {
        const parsed = parseAndValidateSave(this.storage.getItem(candidate.key));
        if (!parsed) continue;
        this.applySaveDocument(parsed);
        this.setSelectedSlot(slot);
        return { ok: true, slot, recovered: candidate.source !== 'primary', source: candidate.source };
      }
    } catch {
      return { ok: false, reason: 'storage-read-failed' };
    }
    return { ok: false, reason: 'no-valid-save' };
  }

  applySaveDocument(document) {
    const state = document.state;
    this.day = state.day;
    this.minuteOfDay = state.minuteOfDay;
    this.credits = state.credits;
    this.energy = state.energy;
    this.taskStage = state.taskStage;
    this.graphics = { ...state.graphics };
    this.inventory = { ...state.inventory };
    this.player = {
      position: [...state.player.position],
      yaw: state.player.yaw,
    };
    this.camera = { ...state.camera };
    this.minuteRemainder = 0;
  }

  static validateDocument(value) {
    return parseAndValidateSave(typeof value === 'string' ? value : JSON.stringify(value));
  }
}
