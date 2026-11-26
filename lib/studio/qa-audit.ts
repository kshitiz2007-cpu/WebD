import { ElementRect, ElementSourcePatch } from './types';

export type QaAuditSeverity = 'high' | 'medium' | 'low';
export type QaAuditCategory =
  | 'contrast'
  | 'touch-target'
  | 'overflow'
  | 'accessibility'
  | 'typography';

export interface QaRawNodeMetric {
  studioId: string;
  filePath: string;
  elementIndex: number;
  tagName: string;
  label: string;
  textContent: string;
  color: string;
  backgroundColor: string;
  fontSizePx: number;
  fontWeight: number;
  rect: ElementRect;
  isInteractive: boolean;
  hasAlt?: boolean;
  headingLevel?: number;
}

export interface QaAuditIssue {
  id: string;
  studioId: string;
  filePath: string;
  elementIndex: number;
  tagName: string;
  label: string;
  category: QaAuditCategory;
  severity: QaAuditSeverity;
  title: string;
  detail: string;
  rect: ElementRect;
  fixLabel: string;
  autoFixPatch: ElementSourcePatch;
}

function parseRgb(raw: string): { r: number; g: number; b: number; a: number } | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };

  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*[,\s]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*(\d+(?:\.\d+)?))?\s*\)$/
  );
  if (rgbMatch) {
    return {
      r: Math.min(255, Math.max(0, Number(rgbMatch[1]))),
      g: Math.min(255, Math.max(0, Number(rgbMatch[2]))),
      b: Math.min(255, Math.max(0, Number(rgbMatch[3]))),
      a: rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1,
    };
  }

  const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1,
    };
  }

  return null;
}

function relativeLuminance(rgb: { r: number; g: number; b: number }): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

export function computeColorContrastRatio(fgRaw: string, bgRaw: string): number | null {
  const fg = parseRgb(fgRaw);
  const bg = parseRgb(bgRaw);
  if (!fg || !bg || fg.a < 0.2 || bg.a < 0.2) return null;
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

export function pickAccessibleForeground(bgRaw: string): string {
  const bg = parseRgb(bgRaw);
  if (!bg) return '#0F172A';
  const lum = relativeLuminance(bg);
  return lum > 0.36 ? '#0F172A' : '#FFFFFF';
}

export function analyzeDomMetricsForQa(
  nodes: QaRawNodeMetric[],
  viewportWidth: number
): QaAuditIssue[] {
  const issues: QaAuditIssue[] = [];
  const seenKeys = new Set<string>();

  const pushIssue = (issue: QaAuditIssue) => {
    if (seenKeys.has(issue.id)) return;
    seenKeys.add(issue.id);
    issues.push(issue);
  };

  for (const node of nodes || []) {
    if (!node || !node.rect || node.rect.width <= 0 || node.rect.height <= 0) continue;
    const safeTag = String(node.tagName || 'div');
    const safeLabel = String(node.label || safeTag);
    const safeColor = typeof node.color === 'string' ? node.color : '';
    const safeBg = typeof node.backgroundColor === 'string' ? node.backgroundColor : '';
    const safeText = typeof node.textContent === 'string' ? node.textContent : '';

    // 1. Horizontal overflow check
    if (node.rect.x + node.rect.width > viewportWidth + 4 && node.rect.width > 40) {
      const overflowPx = Math.round(node.rect.x + node.rect.width - viewportWidth);
      pushIssue({
        id: `overflow:${node.studioId}`,
        studioId: node.studioId,
        filePath: node.filePath,
        elementIndex: node.elementIndex,
        tagName: safeTag,
        label: safeLabel,
        category: 'overflow',
        severity: 'high',
        title: `Horizontal overflow (+${overflowPx}px)`,
        detail: `<${safeTag}> extends ${overflowPx}px past the ${viewportWidth}px viewport edge.`,
        rect: node.rect,
        fixLabel: 'Contain within 100% width',
        autoFixPatch: {
          styles: {
            maxWidth: '100%',
            boxSizing: 'border-box',
            overflowX: 'hidden',
          },
        },
      });
    }

    // 2. Touch target minimum 44x44px for interactive controls
    if (
      node.isInteractive &&
      (node.rect.height < 42 || node.rect.width < 42) &&
      node.rect.width >= 10 &&
      node.rect.height >= 10
    ) {
      const w = Math.round(node.rect.width);
      const h = Math.round(node.rect.height);
      pushIssue({
        id: `touch:${node.studioId}`,
        studioId: node.studioId,
        filePath: node.filePath,
        elementIndex: node.elementIndex,
        tagName: safeTag,
        label: safeLabel,
        category: 'touch-target',
        severity: 'medium',
        title: `Small touch target (${w}×${h}px)`,
        detail: `Interactive <${safeTag}> is below the 44×44px mobile touch standard.`,
        rect: node.rect,
        fixLabel: 'Boost to 44px touch target',
        autoFixPatch: {
          styles: {
            minHeight: '44px',
            minWidth: '44px',
            paddingTop: '10px',
            paddingBottom: '10px',
          },
        },
      });
    }

    // 3. Text contrast check (WCAG AA: 4.5:1 normal, 3.0:1 large)
    const trimmedText = safeText.trim();
    if (trimmedText.length > 0 && trimmedText.length < 260) {
      const ratio = computeColorContrastRatio(safeColor, safeBg);
      const isLargeText =
        node.fontSizePx >= 24 || (node.fontSizePx >= 18.66 && node.fontWeight >= 700);
      const threshold = isLargeText ? 3.0 : 4.5;
      if (ratio !== null && ratio < threshold) {
        const fixedColor = pickAccessibleForeground(safeBg);
        pushIssue({
          id: `contrast:${node.studioId}`,
          studioId: node.studioId,
          filePath: node.filePath,
          elementIndex: node.elementIndex,
          tagName: safeTag,
          label: safeLabel,
          category: 'contrast',
          severity: 'high',
          title: `Low text contrast (${ratio.toFixed(1)}:1)`,
          detail: `<${safeTag}> fails WCAG AA (needs ≥ ${threshold.toFixed(1)}:1).`,
          rect: node.rect,
          fixLabel: `Set high-contrast ${fixedColor === '#FFFFFF' ? 'white' : 'dark'} ink`,
          autoFixPatch: {
            styles: {
              color: fixedColor,
            },
          },
        });
      }

      // 4. Tiny body text check
      if (node.fontSizePx > 0 && node.fontSizePx < 12) {
        pushIssue({
          id: `type:${node.studioId}`,
          studioId: node.studioId,
          filePath: node.filePath,
          elementIndex: node.elementIndex,
          tagName: safeTag,
          label: safeLabel,
          category: 'typography',
          severity: 'low',
          title: `Small text size (${Math.round(node.fontSizePx)}px)`,
          detail: `Text under 12px is difficult to read on mobile screens.`,
          rect: node.rect,
          fixLabel: 'Bump to 14px readable size',
          autoFixPatch: {
            styles: {
              fontSize: '14px',
              lineHeight: '1.5',
            },
          },
        });
      }
    }

    // 5. Image missing alt text
    if (safeTag === 'img' && node.hasAlt === false) {
      pushIssue({
        id: `alt:${node.studioId}`,
        studioId: node.studioId,
        filePath: node.filePath,
        elementIndex: node.elementIndex,
        tagName: safeTag,
        label: safeLabel,
        category: 'accessibility',
        severity: 'medium',
        title: 'Image missing alt description',
        detail: 'Screen readers and search engines rely on alt text for images.',
        rect: node.rect,
        fixLabel: 'Add clean framing & radius',
        autoFixPatch: {
          styles: {
            objectFit: 'cover',
          },
        },
      });
    }
  }

  const severityOrder: Record<QaAuditSeverity, number> = { high: 0, medium: 1, low: 2 };
  return issues
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 24);
}

export function computeQaScore(issues: QaAuditIssue[]): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'high') score -= 12;
    else if (issue.severity === 'medium') score -= 6;
    else score -= 3;
  }
  return Math.max(15, Math.min(100, score));
}
