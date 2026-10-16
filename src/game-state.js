export const SAVE_SCHEMA_VERSION = 2;
export const SAVE_SLOT_COUNT = 3;
// Keep the original namespace: upgrading must not strand schema-1 journeys.
export const SAVE_PREFIX = 'beyond-destination.v1.slot-';
export const SELECTED_SLOT_KEY = 'beyond-destination.settings.selectedSlot';

const VALID_STAGES = new Set(['available', 'fetch', 'return', 'done']);
const CAMERA_MODES = new Set(['first', 'third']);
const QUALITY_LEVELS = new Set(['low', 'balanced', 'high']);
const TOUCH_MODES = new Set(['auto', 'on', 'off']);
const STATE_FIELDS = new Set(['day', 'minuteOfDay', 'credits', 'energy', 'taskStage', 'graphics', 'settings', 'inventory', 'player', 'camera']);
const INVENTORY_FIELDS = new Set(['sealedParcel', 'shells']);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const integerInRange = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;

export class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(String(key), String(value)); }
  removeItem(key) { this.#values.delete(key); }
}

export function getBrowserStorage() {
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      const probe = `${SAVE_PREFIX}probe`;
      globalThis.localStorage.setItem(probe, '1');
      globalThis.localStorage.removeItem(probe);
      return globalThis.localStorage;
    }
  } catch { /* Private browsing/storage policies may deny persistence. */ }
  return null;
}

function parseAndValidateSave(raw) {
  if (typeof raw !== 'string' || raw.length > 1_000_000) return null;
  let value;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (![1, SAVE_SCHEMA_VERSION].includes(value.schemaVersion)) return null;
  if (typeof value.savedAt !== 'string' || value.savedAt.length > 80 || !Number.isFinite(Date.parse(value.savedAt))) return null;
  const state = value.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  // Reject unsupported gameplay extensions rather than silently stripping progress
  // from another milestone that happened to reuse a schema number.
  if (Object.keys(state).some((key) => !STATE_FIELDS.has(key))) return null;
  if (!integerInRange(state.day, 1, 1_000_000)) return null;
  if (!integerInRange(state.minuteOfDay, 0, 1439)) return null;
  if (!integerInRange(state.credits, 0, 1_000_000_000)) return null;
  if (!finite(state.energy) || state.energy < 0 || state.energy > 100) return null;
  if (!VALID_STAGES.has(state.taskStage)) return null;

  const inventory = state.inventory;
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) return null;
  if (Object.keys(inventory).some((key) => !INVENTORY_FIELDS.has(key))) return null;
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

  // Schema 1 -> 2: gameplay is unchanged. Only optional presentation settings are new.
  // Missing or malformed non-gameplay preferences safely revert to conservative values.
  const graphics = {
    quality: QUALITY_LEVELS.has(state.graphics?.quality) ? state.graphics.quality : 'balanced',
    shadows: typeof state.graphics?.shadows === 'boolean' ? state.graphics.shadows : false,
    renderScale: finite(state.graphics?.renderScale) ? clamp(state.graphics.renderScale, 0.6, 1) : 1,
  };
  const settings = { touchControls: TOUCH_MODES.has(state.settings?.touchControls) ? state.settings.touchControls : 'auto' };
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: value.savedAt,
    state: {
      day: state.day, minuteOfDay: state.minuteOfDay, credits: state.credits,
      energy: state.energy, taskStage: state.taskStage, graphics, settings,
      inventory: { sealedParcel: inventory.sealedParcel, shells: inventory.shells },
      player: { position: [...player.position], yaw: player.yaw },
      camera: {
        mode: camera.mode, yaw: camera.yaw, pitch: camera.pitch, distance: camera.distance,
        sensitivity: camera.sensitivity, fov: camera.fov, invertY: camera.invertY,
      },
    },
  };
}

function isFutureSave(raw) {
  try { const value = JSON.parse(raw); return Number.isInteger(value?.schemaVersion) && value.schemaVersion > SAVE_SCHEMA_VERSION; }
  catch { return false; }
}

export class GameState {
  constructor(storage = getBrowserStorage()) {
    this.storage = storage;
    this.persistentStorage = Boolean(storage && (storage.persistentStorage || storage === getBrowserStorage()));
    this.selectedSlot = 1;
    try {
      const preferredSlot = Number(this.storage?.getItem(SELECTED_SLOT_KEY));
      if (integerInRange(preferredSlot, 1, SAVE_SLOT_COUNT)) this.selectedSlot = preferredSlot;
    } catch { /* Preference failures must not prevent playing. */ }
    this.restoreDefaults();
  }

  restoreDefaults() {
    this.day = 1;
    this.minuteOfDay = 8 * 60;
    this.credits = 85;
    this.energy = 100;
    this.taskStage = 'available';
    this.graphics = { quality: 'balanced', shadows: false, renderScale: 1 };
    this.settings = { touchControls: 'auto' };
    this.inventory = { sealedParcel: 0, shells: 0 };
    this.player = { position: [0, 0, 10], yaw: 0 };
    this.camera = { mode: 'third', yaw: 0, pitch: 0.22, distance: 7.5, sensitivity: 0.0024, fov: 58, invertY: false };
    this.minuteRemainder = 0;
  }

  setSelectedSlot(slot) {
    if (!integerInRange(slot, 1, SAVE_SLOT_COUNT)) return false;
    this.selectedSlot = slot;
    try { this.storage?.setItem(SELECTED_SLOT_KEY, String(slot)); } catch { /* Session selection still works. */ }
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

  restUntilMorning() { this.day += 1; this.minuteOfDay = 6 * 60; this.energy = 100; this.minuteRemainder = 0; }
  addEnergy(amount) { if (finite(amount)) this.energy = clamp(this.energy + amount, 0, 100); }
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
    this.earn(35);
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
    if (Array.isArray(position) && position.length === 3 && position.every(finite)) this.player.position = [...position];
    if (finite(playerYaw)) this.player.yaw = playerYaw;
    if (!camera || typeof camera !== 'object') return;
    const next = { ...this.camera, ...camera };
    if (CAMERA_MODES.has(next.mode)) this.camera.mode = next.mode;
    if (finite(next.yaw)) this.camera.yaw = next.yaw;
    if (finite(next.pitch)) this.camera.pitch = clamp(next.pitch, -1.2, 1.35);
    if (finite(next.distance)) this.camera.distance = clamp(next.distance, 3.5, 13);
    if (finite(next.sensitivity)) this.camera.sensitivity = clamp(next.sensitivity, 0.0004, 0.008);
    if (finite(next.fov)) this.camera.fov = clamp(next.fov, 45, 90);
    if (typeof next.invertY === 'boolean') this.camera.invertY = next.invertY;
  }

  slotHasData(slot) {
    if (!integerInRange(slot, 1, SAVE_SLOT_COUNT) || !this.storage) return false;
    try {
      const key = `${SAVE_PREFIX}${slot}`;
      return [key, `${key}.tmp`, `${key}.bak`].some((name) => this.storage.getItem(name) !== null);
    } catch { return true; } // Cannot read? Do not assume it is safe to overwrite.
  }

  hasSave(slot) {
    if (!integerInRange(slot, 1, SAVE_SLOT_COUNT) || !this.storage) return false;
    try {
      const key = `${SAVE_PREFIX}${slot}`;
      return [key, `${key}.tmp`, `${key}.bak`].some((name) => parseAndValidateSave(this.storage.getItem(name)) !== null);
    } catch { return false; }
  }

  createSaveDocument() {
    return {
      schemaVersion: SAVE_SCHEMA_VERSION, savedAt: new Date().toISOString(),
      state: {
        day: this.day, minuteOfDay: this.minuteOfDay, credits: this.credits, energy: this.energy,
        taskStage: this.taskStage, graphics: { ...this.graphics }, settings: { ...this.settings },
        inventory: { ...this.inventory }, player: { position: [...this.player.position], yaw: this.player.yaw },
        camera: { ...this.camera },
      },
    };
  }

  writeDocument(document, slot, { allowOverwrite = false, select = true } = {}) {
    if (!integerInRange(slot, 1, SAVE_SLOT_COUNT)) return { ok: false, reason: 'invalid-slot' };
    if (!this.storage) return { ok: false, reason: 'storage-unavailable' };
    const validated = GameState.validateDocument(document);
    if (!validated) return { ok: false, reason: 'invalid-state' };
    const serialized = JSON.stringify(validated);
    const key = `${SAVE_PREFIX}${slot}`;
    try {
      const current = this.storage.getItem(key);
      // Unknown/newer schemas and damaged data must never be autosaved over.
      if (!allowOverwrite && ((current !== null && !parseAndValidateSave(current)) || isFutureSave(this.storage.getItem(`${key}.tmp`)))) return { ok: false, reason: 'protected-save' };
      if (current !== null && (parseAndValidateSave(current) || (allowOverwrite && !parseAndValidateSave(this.storage.getItem(`${key}.bak`))))) this.storage.setItem(`${key}.bak`, current);
      this.storage.setItem(`${key}.tmp`, serialized);
      const staged = parseAndValidateSave(this.storage.getItem(`${key}.tmp`));
      if (!staged) return { ok: false, reason: 'write-verification-failed' };
      const committed = JSON.stringify(staged);
      this.storage.setItem(key, committed);
      if (this.storage.getItem(key) !== committed) return { ok: false, reason: 'write-verification-failed' };
      this.storage.removeItem(`${key}.tmp`);
      if (select) this.setSelectedSlot(slot);
      return { ok: true, slot, persistent: this.persistentStorage };
    } catch { return { ok: false, reason: 'storage-write-failed' }; }
  }

  saveSlot(slot = this.selectedSlot, options = {}) { return this.writeDocument(this.createSaveDocument(), slot, options); }

  loadSlot(slot = this.selectedSlot) {
    if (!integerInRange(slot, 1, SAVE_SLOT_COUNT)) return { ok: false, reason: 'invalid-slot' };
    if (!this.storage) return { ok: false, reason: 'storage-unavailable' };
    const key = `${SAVE_PREFIX}${slot}`;
    try {
      // A future primary is authoritative: do not silently boot an older backup and lose new fields.
      if (isFutureSave(this.storage.getItem(key)) || isFutureSave(this.storage.getItem(`${key}.tmp`))) return { ok: false, reason: 'newer-schema' };
      for (const [suffix, source] of [['', 'primary'], ['.tmp', 'temporary'], ['.bak', 'backup']]) {
        const parsed = parseAndValidateSave(this.storage.getItem(`${key}${suffix}`));
        if (!parsed) continue;
        this.applySaveDocument(parsed);
        this.setSelectedSlot(slot);
        return { ok: true, slot, recovered: source !== 'primary', source };
      }
    } catch { return { ok: false, reason: 'storage-read-failed' }; }
    return { ok: false, reason: 'no-valid-save' };
  }

  importSave(raw, slot = this.selectedSlot, { overwrite = false } = {}) {
    const parsed = GameState.validateDocument(raw);
    if (!parsed) return { ok: false, reason: 'invalid-import' };
    if (this.slotHasData(slot) && !overwrite) return { ok: false, reason: 'slot-occupied' };
    const result = this.writeDocument(parsed, slot, { allowOverwrite: overwrite });
    if (result.ok) this.applySaveDocument(parsed);
    return result;
  }

  applySaveDocument(document) {
    const validated = GameState.validateDocument(document);
    if (!validated) return false;
    const state = validated.state;
    this.day = state.day; this.minuteOfDay = state.minuteOfDay; this.credits = state.credits;
    this.energy = state.energy; this.taskStage = state.taskStage;
    this.graphics = { ...state.graphics }; this.settings = { ...state.settings };
    this.inventory = { ...state.inventory };
    this.player = { position: [...state.player.position], yaw: state.player.yaw };
    this.camera = { ...state.camera }; this.minuteRemainder = 0;
    return true;
  }

  static validateDocument(value) {
    try { return parseAndValidateSave(typeof value === 'string' ? value : JSON.stringify(value)); } catch { return null; }
  }
}
