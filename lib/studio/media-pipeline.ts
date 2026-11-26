import type { ProjectFramework } from './types';

export interface RegisteredMediaAssetResult {
  nextFiles: Record<string, string>;
  assetFilePath: string;
  publicUrl: string;
  reusedExisting: boolean;
}

export interface DecodedDataUrl {
  mimeType: string;
  bytes: Uint8Array;
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/ogg': 'ogv',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'weba',
};

export function isVirtualMediaDataUrlFile(path: string, content: string): boolean {
  return (
    /^(?:public\/)?assets\//i.test(path) &&
    typeof content === 'string' &&
    content.startsWith('data:')
  );
}

export function getExtensionForMedia(fileName: string, mimeType: string): string {
  const fromMime = MIME_TO_EXT[mimeType.toLowerCase().split(';')[0].trim()];
  if (fromMime) return fromMime;
  const dotIdx = fileName.lastIndexOf('.');
  if (dotIdx > 0) {
    const raw = fileName.slice(dotIdx + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
    if (raw.length >= 2 && raw.length <= 5) return raw;
  }
  return 'bin';
}

export function sanitizeAssetSlug(fileName: string): string {
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  const slug = withoutExt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'media-asset';
}

export function resolveUniqueAssetPaths(
  originalName: string,
  mimeType: string,
  existingFiles: Record<string, string>,
  framework: ProjectFramework,
  dataUrlForReuse?: string
): { assetFilePath: string; publicUrl: string; reusedExisting: boolean } {
  const prefixDir = framework === 'html' ? 'assets' : 'public/assets';
  const urlPrefix = framework === 'html' ? './assets' : '/assets';

  // Reuse identical already-registered asset to avoid duplicates
  if (dataUrlForReuse) {
    for (const [existingPath, content] of Object.entries(existingFiles)) {
      if (existingPath.startsWith(`${prefixDir}/`) && content === dataUrlForReuse) {
        const fileName = existingPath.slice(prefixDir.length + 1);
        return {
          assetFilePath: existingPath,
          publicUrl: `${urlPrefix}/${fileName}`,
          reusedExisting: true,
        };
      }
    }
  }

  const slug = sanitizeAssetSlug(originalName);
  const ext = getExtensionForMedia(originalName, mimeType);
  let candidateName = `${slug}.${ext}`;
  let assetFilePath = `${prefixDir}/${candidateName}`;
  let counter = 2;

  while (existingFiles[assetFilePath] !== undefined) {
    candidateName = `${slug}-${counter}.${ext}`;
    assetFilePath = `${prefixDir}/${candidateName}`;
    counter++;
  }

  return {
    assetFilePath,
    publicUrl: `${urlPrefix}/${candidateName}`,
    reusedExisting: false,
  };
}

export function registerMediaAssetInProjectFiles(
  files: Record<string, string>,
  framework: ProjectFramework,
  asset: { name: string; type: string; dataUrl: string }
): RegisteredMediaAssetResult {
  const resolved = resolveUniqueAssetPaths(
    asset.name,
    asset.type,
    files,
    framework,
    asset.dataUrl
  );
  if (resolved.reusedExisting) {
    return {
      nextFiles: files,
      assetFilePath: resolved.assetFilePath,
      publicUrl: resolved.publicUrl,
      reusedExisting: true,
    };
  }

  return {
    nextFiles: {
      ...files,
      [resolved.assetFilePath]: asset.dataUrl,
    },
    assetFilePath: resolved.assetFilePath,
    publicUrl: resolved.publicUrl,
    reusedExisting: false,
  };
}

/**
 * Maps public asset URLs (`/assets/foo.png`, `./assets/foo.png`, `assets/foo.png`)
 * to their stored data URLs so the sandboxed srcDoc preview renders them instantly.
 */
export function buildVirtualAssetMap(files: Record<string, string>): Record<string, string> {
  const map: Record<string, string> = {};
  for (const [path, content] of Object.entries(files)) {
    if (typeof content !== 'string' || !content.startsWith('data:')) continue;
    if (path.startsWith('public/')) {
      const publicRel = path.slice('public/'.length); // e.g. assets/hero.png
      map[`/${publicRel}`] = content;
      map[`./${publicRel}`] = content;
      map[publicRel] = content;
    } else if (path.startsWith('assets/')) {
      map[`/${path}`] = content;
      map[`./${path}`] = content;
      map[path] = content;
    }
  }
  return map;
}

/**
 * Decodes a base64 or URI-encoded data URL into binary bytes for ZIP export.
 */
export function decodeDataUrlToBytes(dataUrl: string): DecodedDataUrl | null {
  if (!dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx === -1) return null;

  const meta = dataUrl.slice(5, commaIdx);
  const payload = dataUrl.slice(commaIdx + 1);
  const isBase64 = /;base64$/i.test(meta);
  const mimeType = meta.replace(/;base64$/i, '').trim() || 'application/octet-stream';

  if (isBase64) {
    try {
      if (typeof Buffer !== 'undefined') {
        return { mimeType, bytes: new Uint8Array(Buffer.from(payload, 'base64')) };
      }
      const binaryStr = atob(payload);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      return { mimeType, bytes };
    } catch {
      return null;
    }
  }

  try {
    const decoded = decodeURIComponent(payload);
    const bytes = new TextEncoder().encode(decoded);
    return { mimeType, bytes };
  } catch {
    return null;
  }
}

/**
 * Scans source files (TSX/JSX/HTML/CSS) for any legacy inline `data:(image|video|audio)/...`
 * URLs, extracts them into clean `public/assets/` (or `assets/`) files, and replaces the
 * inline strings with clean public paths.
 */
export function extractInlineBase64MediaFromFiles(
  files: Record<string, string>,
  framework: ProjectFramework
): {
  files: Record<string, string>;
  extractedCount: number;
  extractedPaths: string[];
  bytesSavedInCode: number;
} {
  let nextFiles: Record<string, string> = { ...files };
  let extractedCount = 0;
  let bytesSavedInCode = 0;
  const extractedPaths: string[] = [];

  const dataUrlRegex = /data:((?:image|video|audio)\/[a-zA-Z0-9.+-]+);base64,[A-Za-z0-9+/=]+/g;

  for (const [path, content] of Object.entries(files)) {
    if (!/\.(tsx|jsx|ts|js|html|htm|css)$/i.test(path)) continue;
    if (!content.includes('data:')) continue;

    let changed = false;
    const replaced = content.replace(dataUrlRegex, (fullMatch, mimeType: string) => {
      if (fullMatch.length < 120) return fullMatch;
      const baseHint = path
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '') || 'asset';
      const registered = registerMediaAssetInProjectFiles(nextFiles, framework, {
        name: `${baseHint}-media`,
        type: mimeType,
        dataUrl: fullMatch,
      });
      nextFiles = registered.nextFiles;
      if (!registered.reusedExisting) {
        extractedPaths.push(registered.assetFilePath);
      }
      extractedCount++;
      bytesSavedInCode += Math.max(0, fullMatch.length - registered.publicUrl.length);
      changed = true;
      return registered.publicUrl;
    });

    if (changed) {
      nextFiles[path] = replaced;
    }
  }

  return {
    files: nextFiles,
    extractedCount,
    extractedPaths,
    bytesSavedInCode,
  };
}

export function listVirtualMediaAssets(files: Record<string, string>): Array<{
  filePath: string;
  publicUrl: string;
  mimeType: string;
  estimatedBytes: number;
}> {
  const results: Array<{
    filePath: string;
    publicUrl: string;
    mimeType: string;
    estimatedBytes: number;
  }> = [];

  for (const [path, content] of Object.entries(files)) {
    if (!isVirtualMediaDataUrlFile(path, content)) continue;
    const decoded = decodeDataUrlToBytes(content);
    const publicUrl = path.startsWith('public/')
      ? `/${path.slice('public/'.length)}`
      : `./${path}`;
    results.push({
      filePath: path,
      publicUrl,
      mimeType: decoded?.mimeType || 'application/octet-stream',
      estimatedBytes: decoded?.bytes.byteLength || 0,
    });
  }

  return results.sort((a, b) => a.filePath.localeCompare(b.filePath));
}
