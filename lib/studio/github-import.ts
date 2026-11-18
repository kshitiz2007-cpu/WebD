export const GITHUB_ALLOWED_TEXT_EXT =
  /\.(tsx|ts|jsx|js|mjs|cjs|css|scss|html|htm|json|svg|md|txt)$/i;
export const GITHUB_IGNORED_DIRS =
  /(^|\/)(node_modules|\.next|\.git|dist|build|coverage)\//;
export const GITHUB_LOCKFILE_RX =
  /package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$/i;

export interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  branch?: string;
}

export interface SafeJsonSuccess<T> {
  ok: true;
  status: number;
  data: T;
}

export interface SafeJsonFailure {
  ok: false;
  status: number;
  isHtml: boolean;
  error: string;
}

export type SafeJsonResult<T> = SafeJsonSuccess<T> | SafeJsonFailure;

export function isSupportedGitHubImportPath(filePath: string): boolean {
  if (!filePath) return false;
  if (GITHUB_IGNORED_DIRS.test(filePath)) return false;
  if (!GITHUB_ALLOWED_TEXT_EXT.test(filePath)) return false;
  if (GITHUB_LOCKFILE_RX.test(filePath)) return false;
  return true;
}

export function parseGitHubRepoUrl(rawUrl: string): ParsedGitHubRepo | null {
  try {
    const trimmed = rawUrl.trim();
    if (!trimmed) return null;
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProto);
    if (!/^(www\.)?github\.com$/i.test(u.hostname)) return null;
    const parts = u.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, '');
    if (!owner || !repo) return null;
    if ((parts[2] === 'tree' || parts[2] === 'blob') && parts.length >= 4) {
      // Branch names can contain slashes, e.g. recovery/original-full-app
      const branch = parts.slice(3).join('/');
      return { owner, repo, branch };
    }
    return { owner, repo };
  } catch {
    return null;
  }
}

export function looksLikeHtmlPayload(text: string, contentType?: string | null): boolean {
  if (contentType && /text\/html|application\/xhtml\+xml/i.test(contentType)) {
    return true;
  }
  const head = text.trimStart().slice(0, 64).toLowerCase();
  return (
    head.startsWith('<!doctype') ||
    head.startsWith('<html') ||
    head.startsWith('<head') ||
    head.startsWith('<body') ||
    head.startsWith('<!--')
  );
}

export async function safeReadJsonResponse<T = Record<string, unknown>>(
  res: Response
): Promise<SafeJsonResult<T>> {
  const contentType = res.headers?.get?.('content-type') || '';
  let rawText = '';
  try {
    rawText = await res.text();
  } catch {
    return {
      ok: false,
      status: res.status || 500,
      isHtml: false,
      error: `Failed to read server response (HTTP ${res.status || 0}).`,
    };
  }

  if (looksLikeHtmlPayload(rawText, contentType)) {
    return {
      ok: false,
      status: res.status || 502,
      isHtml: true,
      error: `Server returned an HTML page instead of JSON (HTTP ${res.status || 502}).`,
    };
  }

  try {
    const parsed = JSON.parse(rawText) as T;
    if (!res.ok) {
      const msg =
        parsed &&
        typeof parsed === 'object' &&
        'error' in parsed &&
        typeof (parsed as { error?: unknown }).error === 'string'
          ? (parsed as { error: string }).error
          : parsed &&
              typeof parsed === 'object' &&
              'message' in parsed &&
              typeof (parsed as { message?: unknown }).message === 'string'
            ? (parsed as { message: string }).message
            : `Request failed (HTTP ${res.status}).`;
      return {
        ok: false,
        status: res.status,
        isHtml: false,
        error: msg,
      };
    }
    return { ok: true, status: res.status, data: parsed };
  } catch {
    return {
      ok: false,
      status: res.status || 500,
      isHtml: false,
      error: `Server returned invalid JSON (HTTP ${res.status || 500}).`,
    };
  }
}

function encodePathSegments(value: string): string {
  return value
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

interface GitHubTreeEntry {
  path?: string;
  type?: string;
  size?: number;
}

export async function importGitHubRepoFromBrowser(
  rawUrl: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ name: string; branch: string; files: Record<string, string>; fileCount: number }> {
  const parsed = parseGitHubRepoUrl(rawUrl);
  if (!parsed) {
    throw new Error(
      'Please enter a valid GitHub repository URL (for example https://github.com/owner/repo).'
    );
  }

  const { owner, repo, branch } = parsed;
  const candidates: string[] = [];

  if (branch) {
    candidates.push(branch);
    if (branch.includes('/')) {
      candidates.push(branch.split('/')[0]);
    }
  } else {
    try {
      const metaRes = await fetchImpl(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        { headers: { Accept: 'application/vnd.github+json' } }
      );
      const metaParsed = await safeReadJsonResponse<{ default_branch?: string }>(metaRes);
      if (metaParsed.ok && typeof metaParsed.data.default_branch === 'string') {
        candidates.push(metaParsed.data.default_branch);
      }
    } catch {
      // Fall back to main / master
    }
    candidates.push('main', 'master');
  }

  let resolvedBranch: string | null = null;
  let treeEntries: GitHubTreeEntry[] = [];
  let lastApiError: string | null = null;

  for (const cand of [...new Set(candidates)]) {
    const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(cand)}?recursive=1`;
    const treeRes = await fetchImpl(treeUrl, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    const treeJson = await safeReadJsonResponse<{ tree?: GitHubTreeEntry[] }>(treeRes);
    if (treeJson.ok && Array.isArray(treeJson.data.tree)) {
      resolvedBranch = cand;
      treeEntries = treeJson.data.tree;
      break;
    }
    if (!treeJson.ok) {
      lastApiError = treeJson.error;
    }
  }

  if (!resolvedBranch) {
    throw new Error(
      lastApiError && /rate limit/i.test(lastApiError)
        ? 'GitHub API rate limit reached for this IP. Try uploading a ZIP archive or retrying shortly.'
        : `Could not access ${owner}/${repo}. Verify the repository is public and the branch exists.`
    );
  }

  const eligiblePaths = treeEntries
    .filter(
      (entry): entry is Required<Pick<GitHubTreeEntry, 'path' | 'type'>> & GitHubTreeEntry =>
        entry.type === 'blob' &&
        typeof entry.path === 'string' &&
        isSupportedGitHubImportPath(entry.path) &&
        (typeof entry.size !== 'number' || entry.size <= 400_000)
    )
    .map((entry) => entry.path);

  if (eligiblePaths.length === 0) {
    throw new Error('No supported web source files found in this repository.');
  }

  const encodedBranch = encodePathSegments(resolvedBranch);
  const rootPrefix = `${repo}-${resolvedBranch.replace(/\//g, '-')}`;
  const files: Record<string, string> = {};
  const batchSize = 8;

  for (let i = 0; i < eligiblePaths.length; i += batchSize) {
    const batch = eligiblePaths.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (filePath) => {
        const rawFileUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodedBranch}/${encodePathSegments(filePath)}`;
        const res = await fetchImpl(rawFileUrl);
        if (!res.ok) return;
        const text = await res.text();
        if (text.length <= 400_000) {
          files[`${rootPrefix}/${filePath}`] = text;
        }
      })
    );
  }

  return {
    name: `${owner}/${repo}`,
    branch: resolvedBranch,
    files,
    fileCount: Object.keys(files).length,
  };
}
