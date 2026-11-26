import { scanProjectStructure } from './project-scanner';
import { StudioDraft, ViewportPreset, VirtualProject } from './types';

export const DRAFT_STORAGE_KEY = 'atelier_studio_drafts_v1';
export const AUTOSAVE_STORAGE_KEY = 'atelier_studio_autosave_v1';
export const DRAFTS_EVENT_NAME = 'atelier:drafts-updated';
export const MAX_SAVED_DRAFTS = 15;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getBrowserStorage(override?: StorageLike | null): StorageLike | null {
  if (override !== undefined) return override;
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function countModifiedFiles(
  files: Record<string, string>,
  originalFiles: Record<string, string>
): number {
  const keys = new Set([...Object.keys(files), ...Object.keys(originalFiles)]);
  let count = 0;
  for (const key of keys) {
    if (files[key] !== originalFiles[key]) count++;
  }
  return count;
}

function isRecordOfStrings(val: unknown): val is Record<string, string> {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return false;
  return Object.values(val).every((v) => typeof v === 'string');
}

function normalizeDraft(raw: unknown): StudioDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<StudioDraft>;
  if (
    typeof obj.id !== 'string' ||
    typeof obj.title !== 'string' ||
    typeof obj.projectName !== 'string' ||
    !isRecordOfStrings(obj.files)
  ) {
    return null;
  }
  const viewport: ViewportPreset =
    obj.viewport === 'mobile' || obj.viewport === 'tablet' ? obj.viewport : 'desktop';
  const originalFiles = isRecordOfStrings(obj.originalFiles) ? obj.originalFiles : obj.files;
  return {
    id: obj.id,
    title: obj.title,
    projectName: obj.projectName,
    sourceLabel: typeof obj.sourceLabel === 'string' ? obj.sourceLabel : obj.projectName,
    activeRoute: typeof obj.activeRoute === 'string' ? obj.activeRoute : '/',
    viewport,
    savedAt: typeof obj.savedAt === 'string' ? obj.savedAt : new Date().toISOString(),
    modifiedFileCount:
      typeof obj.modifiedFileCount === 'number'
        ? obj.modifiedFileCount
        : countModifiedFiles(obj.files, originalFiles),
    files: { ...obj.files },
    originalFiles: { ...originalFiles },
  };
}

export function parseDraftsJson(raw: string | null): StudioDraft[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeDraft)
      .filter((d): d is StudioDraft => d !== null)
      .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  } catch {
    return [];
  }
}

export function parseAutosaveJson(raw: string | null): StudioDraft | null {
  if (!raw) return null;
  try {
    return normalizeDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function subscribeDraftStorage(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(DRAFTS_EVENT_NAME, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(DRAFTS_EVENT_NAME, onChange);
    window.removeEventListener('storage', onChange);
  };
}

function notifyDraftStorageChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(DRAFTS_EVENT_NAME));
  }
}

export function getDraftsJsonSnapshot(): string {
  const storage = getBrowserStorage();
  if (!storage) return '[]';
  try {
    return storage.getItem(DRAFT_STORAGE_KEY) || '[]';
  } catch {
    return '[]';
  }
}

export function getAutosaveJsonSnapshot(): string {
  const storage = getBrowserStorage();
  if (!storage) return '';
  try {
    return storage.getItem(AUTOSAVE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function listSavedDrafts(storageOverride?: StorageLike | null): StudioDraft[] {
  const storage = getBrowserStorage(storageOverride);
  if (!storage) return [];
  try {
    return parseDraftsJson(storage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function createDraftSnapshot(params: {
  project: VirtualProject;
  activeRoute: string;
  viewport: ViewportPreset;
  title?: string;
  id?: string;
}): StudioDraft {
  const now = new Date().toISOString();
  const modifiedFileCount = countModifiedFiles(
    params.project.files,
    params.project.originalFiles
  );
  const cleanTitle = (params.title || '').trim() || `${params.project.name} (${params.activeRoute})`;
  return {
    id: params.id || `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: cleanTitle,
    projectName: params.project.name,
    sourceLabel: params.project.sourceLabel,
    activeRoute: params.activeRoute,
    viewport: params.viewport,
    savedAt: now,
    modifiedFileCount,
    files: { ...params.project.files },
    originalFiles: { ...params.project.originalFiles },
  };
}

export function saveDraftToStorage(
  draft: StudioDraft,
  storageOverride?: StorageLike | null
): { ok: boolean; drafts: StudioDraft[]; error?: string } {
  const storage = getBrowserStorage(storageOverride);
  if (!storage) {
    return { ok: false, drafts: [], error: 'Browser local storage is unavailable.' };
  }

  const existing = listSavedDrafts(storage).filter((d) => d.id !== draft.id);
  let nextList = [draft, ...existing].slice(0, MAX_SAVED_DRAFTS);

  while (nextList.length > 0) {
    try {
      storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(nextList));
      notifyDraftStorageChanged();
      return { ok: true, drafts: nextList };
    } catch {
      if (nextList.length === 1) {
        return {
          ok: false,
          drafts: listSavedDrafts(storage),
          error: 'Project files exceed browser localStorage limit. Try deleting older drafts.',
        };
      }
      // Trim oldest draft and retry
      nextList = nextList.slice(0, nextList.length - 1);
    }
  }

  return { ok: false, drafts: listSavedDrafts(storage), error: 'Unable to save draft.' };
}

export function deleteDraftFromStorage(
  id: string,
  storageOverride?: StorageLike | null
): StudioDraft[] {
  const storage = getBrowserStorage(storageOverride);
  if (!storage) return [];
  const next = listSavedDrafts(storage).filter((d) => d.id !== id);
  try {
    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(next));
    notifyDraftStorageChanged();
  } catch {
    // Ignore storage errors on delete
  }
  return next;
}

export function saveAutosaveProgress(
  draft: StudioDraft,
  storageOverride?: StorageLike | null
): boolean {
  const storage = getBrowserStorage(storageOverride);
  if (!storage) return false;
  try {
    storage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(draft));
    notifyDraftStorageChanged();
    return true;
  } catch {
    return false;
  }
}

export function loadAutosaveProgress(
  storageOverride?: StorageLike | null
): StudioDraft | null {
  const storage = getBrowserStorage(storageOverride);
  if (!storage) return null;
  try {
    return parseAutosaveJson(storage.getItem(AUTOSAVE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearAutosaveProgress(storageOverride?: StorageLike | null): void {
  const storage = getBrowserStorage(storageOverride);
  if (!storage) return;
  try {
    storage.removeItem(AUTOSAVE_STORAGE_KEY);
    notifyDraftStorageChanged();
  } catch {
    // Ignore
  }
}

export function restoreProjectFromDraft(draft: StudioDraft): VirtualProject {
  const scanned = scanProjectStructure(draft.files);
  return {
    id: `proj_${Date.now()}`,
    name: draft.projectName || scanned.projectName,
    framework: scanned.framework,
    files: { ...draft.files },
    originalFiles: { ...draft.originalFiles },
    pages: scanned.pages,
    globalCssPaths: scanned.globalCssPaths,
    sourceLabel: draft.sourceLabel || `Draft: ${draft.title}`,
  };
}
