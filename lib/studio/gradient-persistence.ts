import { normalizeHex } from './gradient';
import { StorageLike } from './draft-storage';
import { GradientConfig, GradientStop } from './types';

export const PERSISTED_GRADIENT_KEY = 'atelier_studio_last_gradient_v1';
export const CUSTOM_GRADIENTS_KEY = 'atelier_studio_custom_gradients_v1';
export const GRADIENT_EVENT_NAME = 'atelier:gradient-updated';
export const MAX_CUSTOM_GRADIENTS = 12;

export interface CustomGradientPreset {
  id: string;
  name: string;
  config: GradientConfig;
  createdAt: string;
}

function getStorage(override?: StorageLike | null): StorageLike | null {
  if (override !== undefined) return override;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function subscribeGradientStorage(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(GRADIENT_EVENT_NAME, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(GRADIENT_EVENT_NAME, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function notifyGradientStorageChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(GRADIENT_EVENT_NAME));
  }
}

function normalizeStop(raw: unknown, fallbackColor: string, fallbackPos: number): GradientStop {
  if (!raw || typeof raw !== 'object') {
    return { color: fallbackColor, position: fallbackPos };
  }
  const obj = raw as Partial<GradientStop>;
  return {
    color: normalizeHex(typeof obj.color === 'string' ? obj.color : fallbackColor, fallbackColor),
    position:
      typeof obj.position === 'number' && Number.isFinite(obj.position)
        ? Math.max(0, Math.min(100, Math.round(obj.position)))
        : fallbackPos,
  };
}

export function normalizeGradientConfig(raw: unknown): GradientConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<GradientConfig>;
  if (!Array.isArray(obj.stops) || obj.stops.length < 2) return null;

  const stopCount: 2 | 3 | 4 =
    obj.stopCount === 4 ? 4 : obj.stopCount === 2 ? 2 : 3;
  const type: 'solid' | 'linear' | 'radial' =
    obj.type === 'radial' ? 'radial' : obj.type === 'solid' ? 'solid' : 'linear';
  const target: 'background' | 'text' = obj.target === 'text' ? 'text' : 'background';
  const angle =
    typeof obj.angle === 'number' && Number.isFinite(obj.angle)
      ? Math.max(0, Math.min(360, Math.round(obj.angle)))
      : 135;

  const stops = obj.stops.slice(0, 4).map((s, idx) =>
    normalizeStop(s, '#2563EB', Math.round((idx / Math.max(1, stopCount - 1)) * 100))
  );

  return {
    type,
    angle,
    stopCount,
    stops,
    target,
  };
}

export function parseLastGradientJson(raw: string | null): GradientConfig | null {
  if (!raw) return null;
  try {
    return normalizeGradientConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function getLastGradientSnapshot(): string {
  const storage = getStorage();
  if (!storage) return '';
  try {
    return storage.getItem(PERSISTED_GRADIENT_KEY) || '';
  } catch {
    return '';
  }
}

export function saveLastGradientConfig(
  config: GradientConfig,
  storageOverride?: StorageLike | null
): boolean {
  const storage = getStorage(storageOverride);
  if (!storage) return false;
  const clean = normalizeGradientConfig(config);
  if (!clean) return false;
  try {
    storage.setItem(PERSISTED_GRADIENT_KEY, JSON.stringify(clean));
    notifyGradientStorageChanged();
    return true;
  } catch {
    return false;
  }
}

export function loadLastGradientConfig(
  storageOverride?: StorageLike | null
): GradientConfig | null {
  const storage = getStorage(storageOverride);
  if (!storage) return null;
  try {
    return parseLastGradientJson(storage.getItem(PERSISTED_GRADIENT_KEY));
  } catch {
    return null;
  }
}

export function parseCustomGradientPresetsJson(raw: string | null): CustomGradientPreset[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item): CustomGradientPreset | null => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Partial<CustomGradientPreset>;
        const cfg = normalizeGradientConfig(obj.config);
        if (typeof obj.id !== 'string' || typeof obj.name !== 'string' || !cfg) return null;
        return {
          id: obj.id,
          name: obj.name,
          config: cfg,
          createdAt: typeof obj.createdAt === 'string' ? obj.createdAt : new Date().toISOString(),
        };
      })
      .filter((p): p is CustomGradientPreset => p !== null);
  } catch {
    return [];
  }
}

export function getCustomGradientsSnapshot(): string {
  const storage = getStorage();
  if (!storage) return '[]';
  try {
    return storage.getItem(CUSTOM_GRADIENTS_KEY) || '[]';
  } catch {
    return '[]';
  }
}

export function listCustomGradientPresets(
  storageOverride?: StorageLike | null
): CustomGradientPreset[] {
  const storage = getStorage(storageOverride);
  if (!storage) return [];
  try {
    return parseCustomGradientPresetsJson(storage.getItem(CUSTOM_GRADIENTS_KEY));
  } catch {
    return [];
  }
}

export function saveCustomGradientPreset(
  config: GradientConfig,
  name?: string,
  storageOverride?: StorageLike | null
): CustomGradientPreset[] {
  const storage = getStorage(storageOverride);
  if (!storage) return [];
  const clean = normalizeGradientConfig({
    ...config,
    type: config.type === 'solid' ? 'linear' : config.type,
  });
  if (!clean) return listCustomGradientPresets(storage);

  const activeStops = clean.stops.slice(0, clean.stopCount);
  const autoName =
    (name || '').trim() ||
    `${clean.stopCount}-Stop (${activeStops[0]?.color || '#0F172A'} → ${
      activeStops[activeStops.length - 1]?.color || '#38BDF8'
    })`;

  // Avoid duplicate identical stop signatures at top
  const sig = JSON.stringify({
    type: clean.type,
    angle: clean.angle,
    stopCount: clean.stopCount,
    stops: activeStops,
  });
  const existing = listCustomGradientPresets(storage).filter((p) => {
    const pSig = JSON.stringify({
      type: p.config.type,
      angle: p.config.angle,
      stopCount: p.config.stopCount,
      stops: p.config.stops.slice(0, p.config.stopCount),
    });
    return pSig !== sig;
  });

  const entry: CustomGradientPreset = {
    id: `grad_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: autoName,
    config: clean,
    createdAt: new Date().toISOString(),
  };

  const next = [entry, ...existing].slice(0, MAX_CUSTOM_GRADIENTS);
  try {
    storage.setItem(CUSTOM_GRADIENTS_KEY, JSON.stringify(next));
    notifyGradientStorageChanged();
  } catch {
    // Ignore quota failure
  }
  return next;
}

export function deleteCustomGradientPreset(
  id: string,
  storageOverride?: StorageLike | null
): CustomGradientPreset[] {
  const storage = getStorage(storageOverride);
  if (!storage) return [];
  const next = listCustomGradientPresets(storage).filter((p) => p.id !== id);
  try {
    storage.setItem(CUSTOM_GRADIENTS_KEY, JSON.stringify(next));
    notifyGradientStorageChanged();
  } catch {
    // Ignore storage error
  }
  return next;
}
