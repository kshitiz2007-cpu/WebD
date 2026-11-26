export type CommandCategory = 'element' | 'tools' | 'blocks' | 'pages' | 'canvas';

export interface StudioCommandItem {
  id: string;
  label: string;
  description: string;
  category: CommandCategory;
  keywords?: string[];
  shortcut?: string;
  badge?: string;
  disabled?: boolean;
  iconKey:
    | 'sparkles'
    | 'images'
    | 'logic'
    | 'motion'
    | 'layout'
    | 'align'
    | 'library'
    | 'palette'
    | 'gradient'
    | 'code'
    | 'layers'
    | 'inspector'
    | 'export'
    | 'import'
    | 'save'
    | 'drafts'
    | 'page'
    | 'component'
    | 'copy'
    | 'paste'
    | 'wrap'
    | 'duplicate'
    | 'delete'
    | 'undo'
    | 'redo'
    | 'play'
    | 'viewport'
    | 'replay'
    | 'block';
  onExecute?: () => void;
}

export const COMMAND_CATEGORY_LABELS: Record<CommandCategory | 'all', string> = {
  all: 'All',
  element: 'Selection',
  tools: 'Tools',
  blocks: 'Blocks',
  pages: 'Pages',
  canvas: 'Canvas',
};

/**
 * Computes a fuzzy match score for a query against a candidate text.
 * Returns -1 if no match, or a positive relevance score (higher = better match).
 */
export function scoreFuzzyText(query: string, text: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const target = text.toLowerCase();
  if (!target) return -1;

  if (target === q) return 120;
  if (target.startsWith(q)) return 95;

  const wordBoundaryIdx = target.indexOf(` ${q}`);
  if (wordBoundaryIdx !== -1) return 80;

  const substringIdx = target.indexOf(q);
  if (substringIdx !== -1) return 65 - Math.min(20, substringIdx * 0.5);

  // Ordered subsequence fuzzy match (e.g. "glc" -> "Global CSS")
  let qi = 0;
  let score = 0;
  let consecutive = 0;
  let prevMatchIdx = -2;

  for (let ti = 0; ti < target.length && qi < q.length; ti++) {
    if (target[ti] === q[qi]) {
      const isStartOfWord = ti === 0 || /[\s/_-]/.test(target[ti - 1]);
      if (ti === prevMatchIdx + 1) {
        consecutive += 1;
        score += 6 + consecutive * 2;
      } else {
        consecutive = 0;
        score += isStartOfWord ? 10 : 3;
      }
      prevMatchIdx = ti;
      qi += 1;
    }
  }

  return qi === q.length ? Math.max(10, score) : -1;
}

export function filterAndRankCommands(
  items: StudioCommandItem[],
  query: string,
  category: CommandCategory | 'all' = 'all'
): StudioCommandItem[] {
  const trimmed = query.trim();
  const pool =
    category === 'all' ? items : items.filter((item) => item.category === category);

  if (!trimmed) {
    return pool;
  }

  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);

  const scored: Array<{ item: StudioCommandItem; score: number; index: number }> = [];
  for (let i = 0; i < pool.length; i++) {
    const item = pool[i];
    const keywordBlob = (item.keywords || []).join(' ');
    const fullBlob = `${item.label} ${item.description} ${item.category} ${keywordBlob}`;

    let totalScore = 0;
    let matchedAll = true;
    for (const token of tokens) {
      const labelScore = scoreFuzzyText(token, item.label);
      const descScore = scoreFuzzyText(token, item.description);
      const kwScore = scoreFuzzyText(token, keywordBlob);
      const blobScore = scoreFuzzyText(token, fullBlob);
      const best = Math.max(
        labelScore >= 0 ? labelScore * 1.4 : -1,
        kwScore >= 0 ? kwScore * 1.15 : -1,
        descScore >= 0 ? descScore * 0.85 : -1,
        blobScore >= 0 ? blobScore * 0.7 : -1
      );
      if (best < 0) {
        matchedAll = false;
        break;
      }
      totalScore += best;
    }

    if (matchedAll) {
      if (item.disabled) totalScore *= 0.4;
      scored.push({ item, score: totalScore, index: i });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.index - b.index);
  return scored.map((entry) => entry.item);
}
