export function nextBackAction({ confirmation = false, dialogue = false, panel = null, construction = false } = {}) {
  if (confirmation) return 'cancel-confirmation';
  if (dialogue) return 'close-dialogue';
  if (panel && panel !== 'settings') return 'close-panel';
  if (construction) return 'exit-construction';
  if (panel === 'settings') return 'offer-exit';
  return 'open-pause';
}

// Native code is loaded only inside the Android shell, never in normal browser play.
export async function bindPlatformLifecycle({ native, onSuspend, onResume, onBack }) {
  const abort = new AbortController();
  const listeners = [];
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) onSuspend('hidden');
    else onResume();
  }, { signal: abort.signal });
  window.addEventListener('pagehide', () => onSuspend('pagehide'), { signal: abort.signal });
  window.addEventListener('pageshow', () => onResume(), { signal: abort.signal });
  window.addEventListener('focus', () => onResume(), { signal: abort.signal });
  window.addEventListener('blur', () => onSuspend('blur'), { signal: abort.signal });
  if (native) {
    const { App } = await import('@capacitor/app');
    listeners.push(await App.addListener('appStateChange', ({ isActive }) => isActive ? onResume() : onSuspend('native')));
    listeners.push(await App.addListener('backButton', () => onBack()));
  }
  return async () => {
    abort.abort();
    await Promise.all(listeners.map((listener) => listener.remove()));
  };
}

export async function exitNativeApp() {
  const { App } = await import('@capacitor/app');
  await App.exitApp();
}

export const GRAPHICS_PRESETS = Object.freeze({
  low: Object.freeze({ maxDpr: 0.85, drawDistance: 105, shadowSize: 512, shadows: false }),
  balanced: Object.freeze({ maxDpr: 1.2, drawDistance: 180, shadowSize: 768, shadows: false }),
  high: Object.freeze({ maxDpr: 1.75, drawDistance: 220, shadowSize: 1024, shadows: true }),
});

export function renderingOptions(graphics, devicePixelRatio = 1) {
  const preset = GRAPHICS_PRESETS[graphics.quality] ?? GRAPHICS_PRESETS.balanced;
  const scale = Number.isFinite(graphics.renderScale) ? Math.min(1, Math.max(0.6, graphics.renderScale)) : 1;
  return { ...preset, pixelRatio: Math.min(devicePixelRatio, preset.maxDpr) * scale, shadows: Boolean(graphics.shadows) };
}
