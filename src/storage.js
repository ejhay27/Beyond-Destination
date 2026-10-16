import { getBrowserStorage, SAVE_PREFIX, SELECTED_SLOT_KEY } from './game-state.js';

// Synchronous validated save API backed by an ordered native write-through queue.
// The caller MUST await flush() before reporting a native save as durable.
export class PreferencesStorage {
  constructor(preferences) {
    this.preferences = preferences;
    this.values = new Map();
    this.queue = [];
    this.flushing = null;
    this.persistentStorage = true;
  }

  async initialize(legacyStorage = null) {
    const keys = [SELECTED_SLOT_KEY];
    for (let slot = 1; slot <= 3; slot += 1) for (const suffix of ['', '.tmp', '.bak']) keys.push(`${SAVE_PREFIX}${slot}${suffix}`);
    for (const key of keys) {
      const { value } = await this.preferences.get({ key });
      if (value !== null) this.values.set(key, value);
      else {
        const legacy = legacyStorage?.getItem(key);
        if (legacy !== null && legacy !== undefined) this.setItem(key, legacy);
      }
    }
    await this.flush();
    return this;
  }

  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) {
    this.values.set(key, String(value));
    this.queue.push({ type: 'set', key, value: String(value) });
  }
  removeItem(key) {
    this.values.delete(key);
    this.queue.push({ type: 'remove', key });
  }

  flush() {
    if (this.flushing) return this.flushing;
    this.flushing = (async () => {
      while (this.queue.length) {
        const op = this.queue[0];
        if (op.type === 'set') await this.preferences.set({ key: op.key, value: op.value });
        else await this.preferences.remove({ key: op.key });
        this.queue.shift(); // A failed operation stays queued for the next explicit retry.
      }
    })().finally(() => { this.flushing = null; });
    return this.flushing;
  }
}

export async function createPersistence() {
  const { Capacitor } = await import('@capacitor/core');
  const native = Capacitor.isNativePlatform();
  if (!native) {
    const storage = getBrowserStorage();
    return { storage, native, flush: async () => {}, warning: storage ? null : 'Storage is unavailable. Export this life before closing; progress is not persistent.' };
  }
  try {
    const { Preferences } = await import('@capacitor/preferences');
    const storage = await new PreferencesStorage(Preferences).initialize(getBrowserStorage());
    return { storage, native, flush: () => storage.flush(), warning: null };
  } catch {
    return { storage: null, native, flush: async () => {}, warning: 'Native save storage could not be opened. Progress is not persistent; export before closing and restart the app.' };
  }
}

export async function exportSaveFile(saveDocument, native) {
  const text = JSON.stringify(saveDocument, null, 2);
  const fileName = `Beyond-Destination-day-${saveDocument.state.day}.beyond.json`;
  if (native) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'), import('@capacitor/share'),
    ]);
    const { uri } = await Filesystem.writeFile({ path: `exports/${fileName}`, data: text, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true });
    await Share.share({ title: 'Beyond Destination · portable save', files: [uri], dialogTitle: 'Keep or transfer this life' });
  } else {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = fileName;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
