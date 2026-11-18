import {
  applyElementPatchToSource,
  readElementMeta,
  scanElements,
} from './source-editor';
import { ElementSourcePatch, ViewportPreset } from './types';

export type AlignBreakpointScope = 'auto' | 'mobile' | 'tablet' | 'desktop' | 'all';
export type EffectiveBreakpoint = 'mobile' | 'tablet' | 'desktop' | 'all';
export type HorizontalAlign = 'left' | 'center' | 'right' | 'between';
export type VerticalAlign = 'top' | 'middle' | 'bottom' | 'stretch';
export type BlockRedesignPattern =
  | 'stack'
  | 'split-2'
  | 'grid-3'
  | 'wrap-row'
  | 'center-hero'
  | 'space-bar'
  | 'card-polish';
export type WidthPreset = 'auto' | 'full' | 'compact' | 'balanced' | 'wide';
export type SpacingDensity = 'tight' | 'normal' | 'airy';
export type AutoAlignMode = 'responsive-all' | 'mobile-first' | 'desktop-balance' | 'center-focus';

const BREAKPOINT_PREFIX: Record<EffectiveBreakpoint, string> = {
  all: '',
  mobile: '',
  tablet: 'md:',
  desktop: 'lg:',
};

export function resolveEffectiveBreakpoint(
  scope: AlignBreakpointScope,
  viewport: ViewportPreset
): EffectiveBreakpoint {
  if (scope !== 'auto') return scope;
  if (viewport === 'mobile') return 'mobile';
  if (viewport === 'tablet') return 'tablet';
  return 'desktop';
}

function splitTokenPrefix(token: string): { prefix: string; bare: string } {
  const match = token.match(/^((?:[a-z0-9-]+:)*)(.+)$/);
  if (!match) return { prefix: '', bare: token };
  return { prefix: match[1], bare: match[2] };
}

function getUtilityGroup(bare: string): string | null {
  if (
    bare === 'block' ||
    bare === 'inline-block' ||
    bare === 'inline' ||
    bare === 'flex' ||
    bare === 'inline-flex' ||
    bare === 'grid' ||
    bare === 'inline-grid' ||
    bare === 'hidden'
  ) {
    return 'display';
  }
  if (
    bare === 'flex-row' ||
    bare === 'flex-row-reverse' ||
    bare === 'flex-col' ||
    bare === 'flex-col-reverse'
  ) {
    return 'flex-dir';
  }
  if (bare === 'flex-wrap' || bare === 'flex-wrap-reverse' || bare === 'flex-nowrap') {
    return 'flex-wrap';
  }
  if (
    bare === 'justify-start' ||
    bare === 'justify-end' ||
    bare === 'justify-center' ||
    bare === 'justify-between' ||
    bare === 'justify-around' ||
    bare === 'justify-evenly' ||
    bare === 'justify-stretch'
  ) {
    return 'justify';
  }
  if (
    bare === 'items-start' ||
    bare === 'items-end' ||
    bare === 'items-center' ||
    bare === 'items-baseline' ||
    bare === 'items-stretch'
  ) {
    return 'items';
  }
  if (
    bare === 'justify-items-start' ||
    bare === 'justify-items-end' ||
    bare === 'justify-items-center' ||
    bare === 'justify-items-stretch'
  ) {
    return 'justify-items';
  }
  if (
    bare === 'self-auto' ||
    bare === 'self-start' ||
    bare === 'self-end' ||
    bare === 'self-center' ||
    bare === 'self-stretch' ||
    bare === 'self-baseline'
  ) {
    return 'self';
  }
  if (
    bare === 'text-left' ||
    bare === 'text-center' ||
    bare === 'text-right' ||
    bare === 'text-justify' ||
    bare === 'text-start' ||
    bare === 'text-end'
  ) {
    return 'text-align';
  }
  if (/^grid-cols-(\d+|none|subgrid|\[.+\])$/.test(bare)) return 'grid-cols';
  if (/^grid-rows-(\d+|none|subgrid|\[.+\])$/.test(bare)) return 'grid-rows';
  if (/^gap-x-(.+)$/.test(bare)) return 'gap-x';
  if (/^gap-y-(.+)$/.test(bare)) return 'gap-y';
  if (/^gap-(.+)$/.test(bare)) return 'gap';
  if (/^pt-(.+)$/.test(bare)) return 'pt';
  if (/^pr-(.+)$/.test(bare)) return 'pr';
  if (/^pb-(.+)$/.test(bare)) return 'pb';
  if (/^pl-(.+)$/.test(bare)) return 'pl';
  if (/^px-(.+)$/.test(bare)) return 'px';
  if (/^py-(.+)$/.test(bare)) return 'py';
  if (/^p-(.+)$/.test(bare)) return 'p';
  if (/^mt-(.+)$/.test(bare)) return 'mt';
  if (/^mb-(.+)$/.test(bare)) return 'mb';
  if (/^ml-(.+)$/.test(bare)) return 'ml';
  if (/^mr-(.+)$/.test(bare)) return 'mr';
  if (/^mx-(.+)$/.test(bare)) return 'mx';
  if (/^my-(.+)$/.test(bare)) return 'my';
  if (/^min-w-(.+)$/.test(bare)) return 'min-w';
  if (/^max-w-(.+)$/.test(bare)) return 'max-w';
  if (/^w-(.+)$/.test(bare)) return 'w';
  if (/^min-h-(.+)$/.test(bare)) return 'min-h';
  if (/^max-h-(.+)$/.test(bare)) return 'max-h';
  if (/^h-(.+)$/.test(bare)) return 'h';
  if (/^overflow-(auto|hidden|clip|visible|scroll)$/.test(bare)) return 'overflow';
  if (/^\[overflow-wrap:(.+)\]$|^break-(normal|words|all|keep)$/.test(bare)) return 'overflow-wrap';
  if (/^box-(border|content)$/.test(bare)) return 'box-sizing';
  if (/^whitespace-(normal|nowrap|pre|pre-line|pre-wrap|break-spaces)$/.test(bare)) return 'whitespace';
  if (/^-?translate-x-(.+)$/.test(bare)) return 'translate-x';
  if (/^-?translate-y-(.+)$/.test(bare)) return 'translate-y';
  if (/^(?:flex-)?grow(?:-0)?$/.test(bare)) return 'flex-grow';
  if (/^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[\d[^\]]*\])$/.test(bare)) return 'text-size';
  return null;
}

export interface MergeClassOptions {
  breakpoint?: EffectiveBreakpoint;
  preserveDesktopOnMobile?: boolean;
  implicitDesktopDefaults?: Record<string, string>;
}

/**
 * Merges Tailwind tokens into a class string while respecting breakpoint isolation:
 * - Editing 'mobile' sets base tokens and preserves any existing unprefixed layout utility (or implicit default)
 *   under `lg:` if no `md:`/`lg:` override already exists for that utility group.
 * - Editing 'tablet' updates `md:` tokens without disturbing mobile base.
 * - Editing 'desktop' updates `lg:` tokens without disturbing mobile base.
 * - Editing 'all' sets unprefixed base tokens and clears conflicting `sm:`/`md:`/`lg:` tokens for replaced groups.
 */
export function mergeResponsiveClasses(
  currentClassName: string,
  bareUtilities: string[],
  options: MergeClassOptions = {}
): string {
  const breakpoint = options.breakpoint ?? 'all';
  const preserveDesktopOnMobile = options.preserveDesktopOnMobile ?? true;
  const implicitDefaults = options.implicitDesktopDefaults ?? {};
  const targetPrefix = BREAKPOINT_PREFIX[breakpoint];

  let tokens = currentClassName
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const bareUtil of bareUtilities) {
    const cleanBare = bareUtil.trim();
    if (!cleanBare) continue;

    // Support callers passing explicit prefixed token like "lg:grid-cols-3"
    const explicit = splitTokenPrefix(cleanBare);
    const effectivePrefix = explicit.prefix || targetPrefix;
    const effectiveBare = explicit.bare;
    const group = getUtilityGroup(effectiveBare);

    if (!group) {
      const candidate = `${effectivePrefix}${effectiveBare}`;
      if (!tokens.includes(candidate)) tokens.push(candidate);
      continue;
    }

    if (breakpoint === 'all' && !explicit.prefix) {
      tokens = tokens.filter((t) => {
        const parsed = splitTokenPrefix(t);
        if (getUtilityGroup(parsed.bare) !== group) return true;
        return parsed.prefix !== '' && parsed.prefix !== 'sm:' && parsed.prefix !== 'md:' && parsed.prefix !== 'lg:';
      });
      tokens.push(effectiveBare);
      continue;
    }

    // If editing mobile (effectivePrefix === '') and preserveDesktopOnMobile is active,
    // promote existing unprefixed token (or implicit desktop default) to `lg:` if no higher breakpoint exists.
    if (breakpoint === 'mobile' && effectivePrefix === '' && preserveDesktopOnMobile) {
      const existingBase = tokens.find((t) => {
        const parsed = splitTokenPrefix(t);
        return parsed.prefix === '' && getUtilityGroup(parsed.bare) === group;
      });
      const hasHigherBreakpoint = tokens.some((t) => {
        const parsed = splitTokenPrefix(t);
        return (
          (parsed.prefix === 'md:' || parsed.prefix === 'lg:' || parsed.prefix === 'xl:') &&
          getUtilityGroup(parsed.bare) === group
        );
      });
      if (!hasHigherBreakpoint) {
        if (existingBase && existingBase !== effectiveBare) {
          tokens.push(`lg:${existingBase}`);
        } else if (!existingBase && implicitDefaults[group] && implicitDefaults[group] !== effectiveBare) {
          tokens.push(`lg:${implicitDefaults[group]}`);
        }
      }
    }

    // Remove existing token in same prefix + group
    tokens = tokens.filter((t) => {
      const parsed = splitTokenPrefix(t);
      return !(parsed.prefix === effectivePrefix && getUtilityGroup(parsed.bare) === group);
    });

    tokens.push(`${effectivePrefix}${effectiveBare}`);
  }

  return tokens.join(' ');
}

export function stripDirectTokens(currentClassName: string, tokensToRemove: string[]): string {
  const removeSet = new Set(tokensToRemove);
  return currentClassName
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t && !removeSet.has(t))
    .join(' ');
}

function isFlexOrGridClassList(cls: string, inlineStyles: Record<string, string>): boolean {
  const disp = inlineStyles.display || '';
  if (disp === 'flex' || disp === 'inline-flex' || disp === 'grid' || disp === 'inline-grid') {
    return true;
  }
  return /\b(?:sm:|md:|lg:|xl:)?(?:inline-)?(?:flex|grid)\b/.test(cls);
}

function isFlexColAtBreakpoint(cls: string, bp: EffectiveBreakpoint): boolean {
  const tokens = cls.split(/\s+/).filter(Boolean);
  const checkPrefix = (p: string) =>
    tokens.some((t) => t === `${p}flex-col` || t === `${p}flex-col-reverse`);
  if (bp === 'desktop' && checkPrefix('lg:')) return true;
  if (bp === 'tablet' && checkPrefix('md:')) return true;
  if (bp === 'mobile' || bp === 'all') return checkPrefix('');
  return checkPrefix('') && !tokens.some((t) => t === 'lg:flex-row' || t === 'md:flex-row');
}

function isTextOrientedTag(tagName: string): boolean {
  return /^(h1|h2|h3|h4|h5|h6|p|span|a|button|label|strong|em|small|blockquote)$/i.test(tagName);
}

function buildImplicitDesktopDefaults(
  cls: string,
  inlineStyles: Record<string, string>
): Record<string, string> {
  const isFlex =
    inlineStyles.display === 'flex' ||
    inlineStyles.display === 'inline-flex' ||
    /\b(?:sm:|md:|lg:)?inline-flex\b|\bflex\b/.test(cls);
  const isGrid =
    inlineStyles.display === 'grid' ||
    inlineStyles.display === 'inline-grid' ||
    /\b(?:sm:|md:|lg:)?(?:inline-)?grid\b/.test(cls);

  const defaults: Record<string, string> = {
    'text-align': 'text-left',
    mx: 'mx-0',
    'max-w': 'max-w-none',
    w: 'w-auto',
    h: 'h-auto',
    overflow: 'overflow-visible',
    'translate-x': 'translate-x-0',
    'translate-y': 'translate-y-0',
    display: isFlex ? 'flex' : isGrid ? 'grid' : 'block',
  };

  if (isFlex) {
    defaults['flex-dir'] = 'flex-row';
    defaults['flex-wrap'] = 'flex-nowrap';
    defaults.justify = 'justify-start';
    defaults.items = 'items-stretch';
  } else if (isGrid) {
    defaults['justify-items'] = 'justify-items-stretch';
    defaults.items = 'items-stretch';
    defaults['grid-cols'] = 'grid-cols-1';
  }
  return defaults;
}

export function alignElementClassName(
  currentClassName: string,
  options: {
    tagName: string;
    inlineStyles?: Record<string, string>;
    breakpoint: EffectiveBreakpoint;
    horizontal?: HorizontalAlign;
    vertical?: VerticalAlign;
    hasChildren?: boolean;
  }
): { className: string; clearInlineStyles: Record<string, null> } {
  const {
    tagName,
    inlineStyles = {},
    breakpoint,
    horizontal,
    vertical,
    hasChildren = false,
  } = options;

  const isContainer = isFlexOrGridClassList(currentClassName, inlineStyles);
  const isGrid =
    inlineStyles.display === 'grid' || /\b(?:sm:|md:|lg:)?grid\b/.test(currentClassName);
  const isTextTag = isTextOrientedTag(tagName) && !isContainer && !hasChildren;

  const bareToAdd: string[] = [];
  const clearInlineStyles: Record<string, null> = {};

  if (isTextTag) {
    if (horizontal === 'left') bareToAdd.push('text-left');
    else if (horizontal === 'center') bareToAdd.push('text-center');
    else if (horizontal === 'right') bareToAdd.push('text-right');
    else if (horizontal === 'between') bareToAdd.push('text-justify');
    if (horizontal) clearInlineStyles.textAlign = null;

    if (vertical && vertical !== 'top') {
      bareToAdd.push('flex', 'flex-col');
      if (vertical === 'middle') bareToAdd.push('justify-center');
      if (vertical === 'bottom') bareToAdd.push('justify-end');
      if (vertical === 'stretch') bareToAdd.push('items-stretch');
    }
  } else if (isContainer) {
    const isCol = isFlexColAtBreakpoint(currentClassName, breakpoint);

    if (horizontal) {
      if (isGrid) {
        if (horizontal === 'left') bareToAdd.push('justify-items-start', 'text-left');
        else if (horizontal === 'center') bareToAdd.push('justify-items-center', 'text-center');
        else if (horizontal === 'right') bareToAdd.push('justify-items-end', 'text-right');
        else if (horizontal === 'between') bareToAdd.push('justify-between');
      } else if (isCol) {
        if (horizontal === 'left') bareToAdd.push('items-start', 'text-left');
        else if (horizontal === 'center') bareToAdd.push('items-center', 'text-center');
        else if (horizontal === 'right') bareToAdd.push('items-end', 'text-right');
        else if (horizontal === 'between') bareToAdd.push('items-stretch', 'justify-between');
      } else {
        if (horizontal === 'left') bareToAdd.push('justify-start');
        else if (horizontal === 'center') bareToAdd.push('justify-center');
        else if (horizontal === 'right') bareToAdd.push('justify-end');
        else if (horizontal === 'between') bareToAdd.push('justify-between');
      }
      clearInlineStyles.justifyContent = null;
      clearInlineStyles.textAlign = null;
    }

    if (vertical) {
      if (isCol && !isGrid) {
        if (vertical === 'top') bareToAdd.push('justify-start');
        else if (vertical === 'middle') bareToAdd.push('justify-center');
        else if (vertical === 'bottom') bareToAdd.push('justify-end');
        else if (vertical === 'stretch') bareToAdd.push('items-stretch');
      } else {
        if (vertical === 'top') bareToAdd.push('items-start');
        else if (vertical === 'middle') bareToAdd.push('items-center');
        else if (vertical === 'bottom') bareToAdd.push('items-end');
        else if (vertical === 'stretch') bareToAdd.push('items-stretch');
      }
      clearInlineStyles.alignItems = null;
    }
  } else {
    // Plain block container (section, div, article, footer, header)
    if (vertical) {
      bareToAdd.push('flex', 'flex-col');
      if (horizontal === 'left') bareToAdd.push('items-start', 'text-left');
      else if (horizontal === 'center') bareToAdd.push('items-center', 'text-center');
      else if (horizontal === 'right') bareToAdd.push('items-end', 'text-right');
      else if (horizontal === 'between') bareToAdd.push('justify-between');

      if (vertical === 'top') bareToAdd.push('justify-start');
      else if (vertical === 'middle') bareToAdd.push('justify-center');
      else if (vertical === 'bottom') bareToAdd.push('justify-end');
      else if (vertical === 'stretch') bareToAdd.push('items-stretch');
    } else if (horizontal) {
      if (horizontal === 'left') bareToAdd.push('text-left');
      else if (horizontal === 'center') bareToAdd.push('mx-auto', 'text-center');
      else if (horizontal === 'right') bareToAdd.push('text-right');
      else if (horizontal === 'between') bareToAdd.push('flex', 'flex-wrap', 'items-center', 'justify-between');
      clearInlineStyles.textAlign = null;
    }
  }

  return {
    className: mergeResponsiveClasses(currentClassName, bareToAdd, {
      breakpoint,
      preserveDesktopOnMobile: true,
      implicitDesktopDefaults: buildImplicitDesktopDefaults(currentClassName, inlineStyles),
    }),
    clearInlineStyles,
  };
}

function ensureMobileGridFallbackForDesktopEdit(className: string): string {
  const tokens = className.split(/\s+/).filter(Boolean);
  const hasHigherGrid = tokens.some((t) => /^(?:md:|lg:|xl:)grid-cols-/.test(t));
  const bareMulti = tokens.find((t) => /^grid-cols-[2-9]$/.test(t));
  const hasBaseGridCols = tokens.some((t) => /^grid-cols-/.test(t));

  if (bareMulti && !hasHigherGrid) {
    // Un-responsified multi-column grid: move to grid-cols-1 on mobile so Desktop edit never breaks Mobile
    return mergeResponsiveClasses(stripDirectTokens(className, [bareMulti]), ['grid-cols-1'], {
      breakpoint: 'mobile',
      preserveDesktopOnMobile: false,
    });
  }
  if (!hasBaseGridCols) {
    return mergeResponsiveClasses(className, ['grid', 'grid-cols-1'], {
      breakpoint: 'mobile',
      preserveDesktopOnMobile: false,
    });
  }
  return className;
}

export function redesignBlockClassName(
  currentClassName: string,
  pattern: BlockRedesignPattern,
  breakpoint: EffectiveBreakpoint
): string {
  const implicitDesktopDefaults = buildImplicitDesktopDefaults(currentClassName, {});

  if (pattern === 'stack') {
    if (breakpoint === 'desktop' || breakpoint === 'tablet') {
      return mergeResponsiveClasses(currentClassName, ['flex', 'flex-col', 'gap-5'], {
        breakpoint,
      });
    }
    if (breakpoint === 'mobile') {
      // Preserve any existing desktop grid-cols-* or flex-row under lg: before stacking on mobile
      return mergeResponsiveClasses(currentClassName, ['flex', 'flex-col', 'gap-4'], {
        breakpoint: 'mobile',
        preserveDesktopOnMobile: true,
        implicitDesktopDefaults,
      });
    }
    const cleaned = stripDirectTokens(currentClassName, [
      'grid',
      'grid-cols-2',
      'grid-cols-3',
      'grid-cols-4',
      'md:grid-cols-2',
      'md:grid-cols-3',
      'lg:grid-cols-2',
      'lg:grid-cols-3',
    ]);
    return mergeResponsiveClasses(cleaned, ['flex', 'flex-col', 'gap-4'], { breakpoint: 'all' });
  }

  if (pattern === 'split-2') {
    if (breakpoint === 'desktop' || breakpoint === 'tablet') {
      const safeBase = ensureMobileGridFallbackForDesktopEdit(currentClassName);
      return mergeResponsiveClasses(
        safeBase,
        ['grid', 'grid-cols-2', 'gap-8', 'items-center'],
        { breakpoint }
      );
    }
    if (breakpoint === 'mobile') {
      return mergeResponsiveClasses(
        currentClassName,
        ['grid', 'grid-cols-2', 'gap-3', 'items-start'],
        {
          breakpoint: 'mobile',
          preserveDesktopOnMobile: true,
          implicitDesktopDefaults,
        }
      );
    }
    const cleaned = stripDirectTokens(currentClassName, [
      'flex-row',
      'flex-col',
      'md:flex-row',
      'lg:flex-row',
      'grid-cols-3',
      'md:grid-cols-3',
      'lg:grid-cols-3',
    ]);
    return mergeResponsiveClasses(
      cleaned,
      ['grid', 'grid-cols-1', 'lg:grid-cols-2', 'gap-6', 'lg:gap-10', 'items-center'],
      { breakpoint: 'all' }
    );
  }

  if (pattern === 'grid-3') {
    if (breakpoint === 'desktop' || breakpoint === 'tablet') {
      const safeBase = ensureMobileGridFallbackForDesktopEdit(currentClassName);
      return mergeResponsiveClasses(
        safeBase,
        ['grid', breakpoint === 'tablet' ? 'grid-cols-2' : 'grid-cols-3', 'gap-6'],
        { breakpoint }
      );
    }
    if (breakpoint === 'mobile') {
      return mergeResponsiveClasses(
        currentClassName,
        ['grid', 'grid-cols-3', 'gap-2'],
        {
          breakpoint: 'mobile',
          preserveDesktopOnMobile: true,
          implicitDesktopDefaults,
        }
      );
    }
    const cleaned = stripDirectTokens(currentClassName, ['flex-row', 'flex-col', 'md:flex-row', 'lg:flex-row']);
    return mergeResponsiveClasses(
      cleaned,
      ['grid', 'grid-cols-1', 'md:grid-cols-2', 'lg:grid-cols-3', 'gap-4', 'lg:gap-6'],
      { breakpoint: 'all' }
    );
  }

  if (pattern === 'wrap-row') {
    return mergeResponsiveClasses(
      currentClassName,
      ['flex', 'flex-wrap', 'items-center', breakpoint === 'mobile' ? 'gap-3' : 'gap-5'],
      {
        breakpoint,
        preserveDesktopOnMobile: breakpoint === 'mobile',
        implicitDesktopDefaults,
      }
    );
  }

  if (pattern === 'center-hero') {
    return mergeResponsiveClasses(
      currentClassName,
      ['flex', 'flex-col', 'items-center', 'text-center', 'mx-auto', 'max-w-3xl', 'gap-4'],
      {
        breakpoint,
        preserveDesktopOnMobile: breakpoint === 'mobile',
        implicitDesktopDefaults,
      }
    );
  }

  if (pattern === 'space-bar') {
    if (breakpoint === 'desktop' || breakpoint === 'tablet') {
      const tokens = currentClassName.split(/\s+/).filter(Boolean);
      const hasMobileStack = tokens.some((t) => t === 'flex-col' || t === 'flex-wrap');
      const withMobileBase = hasMobileStack
        ? currentClassName
        : mergeResponsiveClasses(currentClassName, ['flex', 'flex-col', 'gap-3'], {
            breakpoint: 'mobile',
            preserveDesktopOnMobile: false,
          });
      return mergeResponsiveClasses(
        withMobileBase,
        ['flex', 'flex-row', 'items-center', 'justify-between', 'gap-6'],
        { breakpoint }
      );
    }
    if (breakpoint === 'mobile') {
      return mergeResponsiveClasses(
        currentClassName,
        ['flex', 'flex-row', 'flex-wrap', 'items-center', 'justify-between', 'gap-3'],
        {
          breakpoint: 'mobile',
          preserveDesktopOnMobile: true,
          implicitDesktopDefaults,
        }
      );
    }
    return mergeResponsiveClasses(
      currentClassName,
      ['flex', 'flex-col', 'md:flex-row', 'items-center', 'justify-between', 'gap-4'],
      { breakpoint: 'all' }
    );
  }

  // 'card-polish'
  return mergeResponsiveClasses(
    currentClassName,
    ['rounded-xl', 'border', 'border-slate-200', 'bg-white', 'p-5', 'md:p-6', 'shadow-xs'],
    { breakpoint }
  );
}

export function applyWidthAndSpacingToClassName(
  currentClassName: string,
  options: {
    breakpoint: EffectiveBreakpoint;
    widthPreset?: WidthPreset;
    density?: SpacingDensity;
  }
): string {
  const { breakpoint, widthPreset, density } = options;
  const bare: string[] = [];

  if (widthPreset === 'full') bare.push('w-full', 'max-w-none');
  else if (widthPreset === 'compact') bare.push('w-full', 'max-w-2xl', 'mx-auto');
  else if (widthPreset === 'balanced') bare.push('w-full', 'max-w-5xl', 'mx-auto');
  else if (widthPreset === 'wide') bare.push('w-full', 'max-w-6xl', 'mx-auto');
  else if (widthPreset === 'auto') bare.push('w-auto', 'max-w-none');

  if (density === 'tight') bare.push('px-3', 'py-4', 'gap-3');
  else if (density === 'normal') bare.push('px-5', 'py-8', 'gap-5');
  else if (density === 'airy') bare.push('px-8', 'py-14', 'gap-8');

  return mergeResponsiveClasses(currentClassName, bare, {
    breakpoint,
    preserveDesktopOnMobile: breakpoint === 'mobile',
    implicitDesktopDefaults: buildImplicitDesktopDefaults(currentClassName, {}),
  });
}

function kebabToCamelKey(str: string): string {
  return str.replace(/-([a-z])/g, (_, ch: string) => ch.toUpperCase());
}

function parseGridColsCountFromCss(val: string): number | null {
  const rep = val.match(/repeat\(\s*(\d+)\s*,/i);
  if (rep) {
    const n = Number(rep[1]);
    return n >= 1 && n <= 12 ? n : null;
  }
  const tracks = val.trim().split(/\s+/).filter(Boolean);
  if (tracks.length >= 1 && tracks.length <= 12 && tracks.every((t) => /fr$|px$|%$|auto$/.test(t))) {
    return tracks.length;
  }
  return null;
}

function mapStyleEntryToTailwindTokens(
  camelKey: string,
  value: string | null
): { tokens: string[]; clearOnly?: boolean } | null {
  const v = value === null ? '' : value.trim();
  const safeArbitrary = (s: string) => s.replace(/\s+/g, '_');

  switch (camelKey) {
    case 'width':
      if (!v || v === 'auto') return { tokens: ['w-auto'] };
      if (v === '100%') return { tokens: ['w-full'] };
      return { tokens: [`w-[${safeArbitrary(v)}]`] };
    case 'height':
      if (!v || v === 'auto') return { tokens: ['h-auto'] };
      if (v === '100%') return { tokens: ['h-full'] };
      return { tokens: [`h-[${safeArbitrary(v)}]`] };
    case 'minWidth':
      if (!v) return { tokens: ['min-w-0'] };
      if (v === '0' || v === '0px') return { tokens: ['min-w-0'] };
      if (v === '100%') return { tokens: ['min-w-full'] };
      return { tokens: [`min-w-[${safeArbitrary(v)}]`] };
    case 'minHeight':
      if (!v) return { tokens: ['min-h-0'] };
      if (v === '0' || v === '0px') return { tokens: ['min-h-0'] };
      if (v === '100%') return { tokens: ['min-h-full'] };
      return { tokens: [`min-h-[${safeArbitrary(v)}]`] };
    case 'maxWidth':
      if (!v || v === 'none') return { tokens: ['max-w-none'] };
      if (v === '100%') return { tokens: ['max-w-full'] };
      return { tokens: [`max-w-[${safeArbitrary(v)}]`] };
    case 'maxHeight':
      if (!v || v === 'none') return { tokens: ['max-h-none'] };
      if (v === '100%') return { tokens: ['max-h-full'] };
      return { tokens: [`max-h-[${safeArbitrary(v)}]`] };
    case 'boxSizing':
      return { tokens: [v === 'content-box' ? 'box-content' : 'box-border'] };
    case 'overflow':
      if (!v || v === 'visible') return { tokens: ['overflow-visible'] };
      if (v === 'hidden' || v === 'auto' || v === 'scroll' || v === 'clip') {
        return { tokens: [`overflow-${v}`] };
      }
      return null;
    case 'overflowWrap':
      if (v === 'anywhere') return { tokens: ['[overflow-wrap:anywhere]'] };
      if (v === 'break-word') return { tokens: ['break-words'] };
      return { tokens: ['break-normal'] };
    case 'whiteSpace':
      if (v === 'nowrap') return { tokens: ['whitespace-nowrap'] };
      if (v === 'pre-wrap') return { tokens: ['whitespace-pre-wrap'] };
      return { tokens: ['whitespace-normal'] };
    case 'display':
      if (!v || v === 'block') return { tokens: ['block'] };
      if (v === 'none') return { tokens: ['hidden'] };
      if (
        v === 'inline-block' ||
        v === 'inline' ||
        v === 'flex' ||
        v === 'inline-flex' ||
        v === 'grid' ||
        v === 'inline-grid'
      ) {
        return { tokens: [v] };
      }
      return null;
    case 'flexDirection':
      if (v === 'column') return { tokens: ['flex-col'] };
      if (v === 'row-reverse') return { tokens: ['flex-row-reverse'] };
      if (v === 'column-reverse') return { tokens: ['flex-col-reverse'] };
      return { tokens: ['flex-row'] };
    case 'flexWrap':
      if (v === 'wrap') return { tokens: ['flex-wrap'] };
      if (v === 'wrap-reverse') return { tokens: ['flex-wrap-reverse'] };
      return { tokens: ['flex-nowrap'] };
    case 'justifyContent':
      if (v === 'center') return { tokens: ['justify-center'] };
      if (v === 'flex-end' || v === 'end') return { tokens: ['justify-end'] };
      if (v === 'space-between') return { tokens: ['justify-between'] };
      if (v === 'space-around') return { tokens: ['justify-around'] };
      if (v === 'space-evenly') return { tokens: ['justify-evenly'] };
      return { tokens: ['justify-start'] };
    case 'alignItems':
      if (v === 'flex-start' || v === 'start') return { tokens: ['items-start'] };
      if (v === 'center') return { tokens: ['items-center'] };
      if (v === 'flex-end' || v === 'end') return { tokens: ['items-end'] };
      if (v === 'baseline') return { tokens: ['items-baseline'] };
      return { tokens: ['items-stretch'] };
    case 'justifyItems':
      if (v === 'start') return { tokens: ['justify-items-start'] };
      if (v === 'center') return { tokens: ['justify-items-center'] };
      if (v === 'end') return { tokens: ['justify-items-end'] };
      return { tokens: ['justify-items-stretch'] };
    case 'flexGrow':
      return { tokens: [v === '1' ? 'grow' : 'grow-0'] };
    case 'alignSelf':
      if (v === 'flex-start' || v === 'start') return { tokens: ['self-start'] };
      if (v === 'center') return { tokens: ['self-center'] };
      if (v === 'flex-end' || v === 'end') return { tokens: ['self-end'] };
      if (v === 'stretch') return { tokens: ['self-stretch'] };
      return { tokens: ['self-auto'] };
    case 'gridTemplateColumns': {
      if (!v || v === 'none') return { tokens: ['grid-cols-none'] };
      const count = parseGridColsCountFromCss(v);
      if (count !== null) return { tokens: [`grid-cols-${count}`] };
      return { tokens: [`grid-cols-[${safeArbitrary(v)}]`] };
    }
    case 'gridTemplateRows': {
      if (!v || v === 'auto' || v === 'none') return { tokens: ['grid-rows-none'] };
      const count = parseGridColsCountFromCss(v);
      if (count !== null) return { tokens: [`grid-rows-${count}`] };
      return { tokens: [`grid-rows-[${safeArbitrary(v)}]`] };
    }
    case 'gap':
      return v ? { tokens: [`gap-[${safeArbitrary(v)}]`] } : { tokens: ['gap-0'] };
    case 'rowGap':
      return v ? { tokens: [`gap-y-[${safeArbitrary(v)}]`] } : { tokens: ['gap-y-0'] };
    case 'columnGap':
      return v ? { tokens: [`gap-x-[${safeArbitrary(v)}]`] } : { tokens: ['gap-x-0'] };
    case 'paddingTop':
      return v ? { tokens: [`pt-[${safeArbitrary(v)}]`] } : { tokens: ['pt-0'] };
    case 'paddingRight':
      return v ? { tokens: [`pr-[${safeArbitrary(v)}]`] } : { tokens: ['pr-0'] };
    case 'paddingBottom':
      return v ? { tokens: [`pb-[${safeArbitrary(v)}]`] } : { tokens: ['pb-0'] };
    case 'paddingLeft':
      return v ? { tokens: [`pl-[${safeArbitrary(v)}]`] } : { tokens: ['pl-0'] };
    case 'marginTop':
      return v ? { tokens: [`mt-[${safeArbitrary(v)}]`] } : { tokens: ['mt-0'] };
    case 'marginBottom':
      return v ? { tokens: [`mb-[${safeArbitrary(v)}]`] } : { tokens: ['mb-0'] };
    case 'textAlign':
      if (v === 'center') return { tokens: ['text-center'] };
      if (v === 'right' || v === 'end') return { tokens: ['text-right'] };
      if (v === 'justify') return { tokens: ['text-justify'] };
      return { tokens: ['text-left'] };
    case 'fontSize':
      return v ? { tokens: [`text-[${safeArbitrary(v)}]`] } : null;
    case 'transform': {
      if (!v || v === 'none') return { tokens: ['translate-x-0', 'translate-y-0'] };
      const m = v.match(/translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/);
      if (!m) return null;
      const x = Math.round(parseFloat(m[1]));
      const y = Math.round(parseFloat(m[2]));
      return {
        tokens: [
          x === 0 ? 'translate-x-0' : `translate-x-[${x}px]`,
          y === 0 ? 'translate-y-0' : `translate-y-[${y}px]`,
        ],
      };
    }
    case 'translate': {
      if (!v || v === 'none') return { tokens: ['translate-x-0', 'translate-y-0'] };
      const parts = v.split(/\s+/);
      const x = parts[0] ? Math.round(parseFloat(parts[0]) || 0) : 0;
      const y = parts[1] ? Math.round(parseFloat(parts[1]) || 0) : 0;
      return {
        tokens: [
          x === 0 ? 'translate-x-0' : `translate-x-[${x}px]`,
          y === 0 ? 'translate-y-0' : `translate-y-[${y}px]`,
        ],
      };
    }
    default:
      return null;
  }
}

/**
 * Converts layout, sizing, alignment, spacing, and offset inline style patches
 * into breakpoint-scoped Tailwind classes when editing a specific viewport
 * (`mobile`, `tablet`, or `desktop`) on JSX/TSX elements so Desktop and Mobile
 * layouts never overwrite or corrupt each other.
 */
export function scopeElementPatchToBreakpoint(params: {
  code: string;
  elementIndex: number;
  isHtml: boolean;
  patch: ElementSourcePatch;
  breakpoint: EffectiveBreakpoint;
}): ElementSourcePatch {
  const { code, elementIndex, isHtml, patch, breakpoint } = params;
  if (isHtml || breakpoint === 'all' || !patch.styles || patch.className !== undefined) {
    return patch;
  }

  const meta = readElementMeta(code, elementIndex, false);
  if (!meta || meta.isDynamicClassName) {
    return patch;
  }

  let nextClassName = meta.className;
  const remainingStyles: Record<string, string | null> = {};
  const bareTokens: string[] = [];
  let changedToResponsive = false;

  for (const [rawKey, rawVal] of Object.entries(patch.styles)) {
    const camelKey = kebabToCamelKey(rawKey);
    const mapped = mapStyleEntryToTailwindTokens(camelKey, rawVal);
    if (!mapped) {
      remainingStyles[rawKey] = rawVal;
      continue;
    }

    changedToResponsive = true;
    // Clear any pre-existing inline style for this property so responsive classes take effect
    if (meta.inlineStyles[camelKey] !== undefined || meta.inlineStyles[rawKey] !== undefined) {
      remainingStyles[camelKey] = null;
    }
    if (camelKey === 'transform' && meta.inlineStyles.translate !== undefined) {
      remainingStyles.translate = null;
    }
    if (camelKey === 'translate' && meta.inlineStyles.transform !== undefined) {
      remainingStyles.transform = null;
    }

    // If setting multi-column gridTemplateColumns on Desktop/Tablet, ensure mobile stacks in 1 column
    if (
      camelKey === 'gridTemplateColumns' &&
      (breakpoint === 'desktop' || breakpoint === 'tablet') &&
      rawVal
    ) {
      const colCount = parseGridColsCountFromCss(rawVal);
      if (colCount !== null && colCount >= 2) {
        nextClassName = ensureMobileGridFallbackForDesktopEdit(nextClassName);
      }
    }

    for (const tok of mapped.tokens) {
      bareTokens.push(tok);
    }
  }

  if (!changedToResponsive) {
    return patch;
  }

  nextClassName = mergeResponsiveClasses(nextClassName, bareTokens, {
    breakpoint,
    preserveDesktopOnMobile: breakpoint === 'mobile',
    implicitDesktopDefaults: buildImplicitDesktopDefaults(nextClassName, meta.inlineStyles),
  });

  const result: ElementSourcePatch = { ...patch, className: nextClassName };
  if (Object.keys(remainingStyles).length > 0) {
    result.styles = remainingStyles;
  } else {
    delete result.styles;
  }
  return result;
}

export function detectBreakpointSizeMode(
  className: string,
  inlineValue: string | undefined,
  axis: 'width' | 'height',
  breakpoint: EffectiveBreakpoint
): 'fixed' | 'fill' | 'hug' {
  if (inlineValue) {
    if (inlineValue === 'auto') return 'hug';
    if (inlineValue === '100%') return 'fill';
    return 'fixed';
  }
  const tokens = className.split(/\s+/).filter(Boolean);
  const group = axis === 'width' ? 'w' : 'h';
  const targetPrefix = BREAKPOINT_PREFIX[breakpoint];

  const matchingToken =
    tokens.find((t) => {
      const p = splitTokenPrefix(t);
      return p.prefix === targetPrefix && getUtilityGroup(p.bare) === group;
    }) ||
    tokens.find((t) => {
      const p = splitTokenPrefix(t);
      return p.prefix === '' && getUtilityGroup(p.bare) === group;
    });

  if (!matchingToken) return 'hug';
  const bare = splitTokenPrefix(matchingToken).bare;
  if (bare === `${group}-auto`) return 'hug';
  if (bare === `${group}-full`) return 'fill';
  return 'fixed';
}

export interface ResponsiveDiagnosticItem {
  elementIndex: number;
  tagName: string;
  reason: string;
}

export interface ResponsiveDiagnosticReport {
  totalElements: number;
  multiColGridsNeedingMobile: number;
  rigidFlexRows: number;
  oversizedPaddingBlocks: number;
  oversizedHeadings: number;
  inlineOffsetCount: number;
  issues: ResponsiveDiagnosticItem[];
}

export function scanResponsiveIssues(
  code: string,
  isHtml: boolean,
  scopeElementIndex?: number
): ResponsiveDiagnosticReport {
  const elements = scanElements(code, isHtml);
  const allowedIndices = collectSubtreeIndices(elements, scopeElementIndex);

  const issues: ResponsiveDiagnosticItem[] = [];
  let multiColGridsNeedingMobile = 0;
  let rigidFlexRows = 0;
  let oversizedPaddingBlocks = 0;
  let oversizedHeadings = 0;
  let inlineOffsetCount = 0;

  for (const el of elements) {
    if (allowedIndices && !allowedIndices.has(el.index)) continue;
    const meta = readElementMeta(code, el.index, isHtml);
    if (!meta || meta.isDynamicClassName) continue;

    const cls = meta.className;
    const tokens = cls.split(/\s+/).filter(Boolean);

    // 1. Multi-column grid without base grid-cols-1 (or inline gridTemplateColumns)
    const hasBareMultiGrid = tokens.some((t) => /^grid-cols-[2-9]$/.test(t));
    const inlineGridCols = parseGridColsCountFromCss(meta.inlineStyles.gridTemplateColumns || '');
    if (hasBareMultiGrid || (inlineGridCols !== null && inlineGridCols >= 2)) {
      multiColGridsNeedingMobile += 1;
      issues.push({
        elementIndex: el.index,
        tagName: el.tagName,
        reason: 'Multi-column grid lacks mobile grid-cols-1 fallback',
      });
    }

    // 2. Flex row without flex-col or flex-wrap on mobile
    const hasFlex = tokens.includes('flex');
    const isPinnedToolbar = tokens.includes('fixed') || tokens.includes('sticky');
    const hasColOrWrap = tokens.some((t) =>
      /^(?:sm:|md:|lg:)?(?:flex-col|flex-wrap)$/.test(t) || t === 'flex-col' || t === 'flex-wrap'
    );
    const hasJustifyBetweenOrGap = tokens.some(
      (t) => t === 'justify-between' || /^gap-(4|5|6|8|10|12)$/.test(t)
    );
    if (hasFlex && !isPinnedToolbar && !hasColOrWrap && hasJustifyBetweenOrGap && meta.childIndices.length >= 2) {
      rigidFlexRows += 1;
      issues.push({
        elementIndex: el.index,
        tagName: el.tagName,
        reason: 'Horizontal flex row may crowd or overflow on mobile',
      });
    }

    // 3. Oversized horizontal padding px-8 / px-10 / px-12 without smaller mobile px-*
    const bigPx = tokens.find((t) => /^px-(8|10|12|16)$/.test(t));
    const hasRespPx = tokens.some((t) => /^(?:sm:|md:|lg:)px-/.test(t));
    if (bigPx && !hasRespPx) {
      oversizedPaddingBlocks += 1;
      issues.push({
        elementIndex: el.index,
        tagName: el.tagName,
        reason: `Large ${bigPx} horizontal padding reduces mobile content width`,
      });
    }

    // 4. Oversized heading text-4xl / text-5xl / text-6xl without responsive base
    const bigText = tokens.find((t) => /^text-(4xl|5xl|6xl)$/.test(t));
    const hasRespText = tokens.some((t) => /^(?:sm:|md:|lg:)text-/.test(t));
    if (bigText && !hasRespText && /^h[1-3]$/i.test(el.tagName)) {
      oversizedHeadings += 1;
      issues.push({
        elementIndex: el.index,
        tagName: el.tagName,
        reason: `Heading ${bigText} should scale down cleanly for mobile`,
      });
    }

    // 5. Inline fixed width/height or manual drag translate offset
    const inlineW = parseFloat(meta.inlineStyles.width || '');
    const inlineH = parseFloat(meta.inlineStyles.height || '');
    if (
      (Number.isFinite(inlineW) && inlineW > 40) ||
      (Number.isFinite(inlineH) && inlineH > 40) ||
      Boolean(meta.inlineStyles.transform)
    ) {
      inlineOffsetCount += 1;
      issues.push({
        elementIndex: el.index,
        tagName: el.tagName,
        reason: 'Inline fixed size or drag transform offset may misalign across viewports',
      });
    }
  }

  return {
    totalElements: allowedIndices ? allowedIndices.size : elements.length,
    multiColGridsNeedingMobile,
    rigidFlexRows,
    oversizedPaddingBlocks,
    oversizedHeadings,
    inlineOffsetCount,
    issues,
  };
}

function collectSubtreeIndices(
  elements: ReturnType<typeof scanElements>,
  rootIndex?: number
): Set<number> | null {
  if (rootIndex === undefined || rootIndex < 0 || !elements[rootIndex]) return null;
  const set = new Set<number>();
  const queue = [rootIndex];
  while (queue.length > 0) {
    const idx = queue.shift()!;
    if (set.has(idx)) continue;
    set.add(idx);
    const el = elements[idx];
    if (el) {
      for (const childIdx of el.childIndices) {
        queue.push(childIdx);
      }
    }
  }
  return set;
}

export interface AutoAlignResult {
  updatedCode: string;
  changesCount: number;
  summary: string[];
}

export function autoAlignSourceCode(params: {
  code: string;
  isHtml: boolean;
  mode: AutoAlignMode;
  scopeElementIndex?: number;
  breakpoint?: EffectiveBreakpoint;
}): AutoAlignResult {
  const { code, isHtml, mode, scopeElementIndex, breakpoint = 'all' } = params;
  const elements = scanElements(code, isHtml);
  const allowed = collectSubtreeIndices(elements, scopeElementIndex);

  let working = code;
  let changesCount = 0;
  const summary: string[] = [];

  for (let i = 0; i < elements.length; i++) {
    if (allowed && !allowed.has(i)) continue;
    const meta = readElementMeta(working, i, isHtml);
    if (!meta || meta.isDynamicClassName) continue;

    let nextCls = meta.className;
    const tokens = nextCls.split(/\s+/).filter(Boolean);
    const patchStyles: Record<string, string | null> = {};
    let elementChanged = false;

    if (mode === 'responsive-all' || mode === 'mobile-first') {
      // 1. Multi-col grids (bare Tailwind or inline gridTemplateColumns) -> 1-col mobile + responsive desktop
      const bareMultiGrid = tokens.find((t) => /^grid-cols-([2-9])$/.test(t));
      const existingLgGrid = tokens.find((t) => /^lg:grid-cols-/.test(t));
      const inlineGridCols = parseGridColsCountFromCss(meta.inlineStyles.gridTemplateColumns || '');

      if (bareMultiGrid) {
        const cols = Number(bareMultiGrid.replace('grid-cols-', ''));
        const desktopTokens = existingLgGrid
          ? []
          : cols >= 3
          ? ['md:grid-cols-2', `lg:${bareMultiGrid}`]
          : [`md:${bareMultiGrid}`];
        nextCls = stripDirectTokens(nextCls, [bareMultiGrid]);
        nextCls = mergeResponsiveClasses(nextCls, ['grid-cols-1', ...desktopTokens], {
          breakpoint: 'all',
        });
        summary.push(`<${meta.tagName}> grid → 1-col mobile / ${cols}-col desktop`);
        elementChanged = true;
      } else if (inlineGridCols !== null && inlineGridCols >= 2) {
        patchStyles.gridTemplateColumns = null;
        if (meta.inlineStyles.display === 'grid') patchStyles.display = null;
        const desktopTokens =
          inlineGridCols >= 3
            ? ['md:grid-cols-2', `lg:grid-cols-${inlineGridCols}`]
            : [`md:grid-cols-${inlineGridCols}`];
        nextCls = mergeResponsiveClasses(nextCls, ['grid', 'grid-cols-1', ...desktopTokens], {
          breakpoint: 'all',
        });
        summary.push(`<${meta.tagName}> inline ${inlineGridCols}-col grid → responsive 1→${inlineGridCols} col`);
        elementChanged = true;
      }

      // 2. Non-wrapping flex rows with multiple children -> responsive wrap or stack (skip fixed toolbars)
      const curTokens = nextCls.split(/\s+/).filter(Boolean);
      const hasFlex = curTokens.includes('flex');
      const isPinnedToolbar = curTokens.includes('fixed') || curTokens.includes('sticky');
      const hasColOrWrap = curTokens.some((t) =>
        /^(?:sm:|md:|lg:)?(?:flex-col|flex-wrap)$/.test(t)
      );
      const hasSpacingRow = curTokens.some(
        (t) => t === 'justify-between' || /^gap-(4|5|6|8|10|12)$/.test(t)
      );
      if (hasFlex && !isPinnedToolbar && !hasColOrWrap && hasSpacingRow && meta.childIndices.length >= 2) {
        const isNavLike =
          meta.tagName.toLowerCase() === 'nav' ||
          meta.tagName.toLowerCase() === 'header' ||
          curTokens.includes('gap-8') ||
          curTokens.includes('gap-6');
        const isButtonGroup =
          curTokens.includes('gap-4') &&
          meta.childIndices.every((cid) => {
            const c = elements[cid];
            return c && /^(a|button)$/i.test(c.tagName);
          });

        if (isButtonGroup || meta.tagName.toLowerCase() === 'nav') {
          nextCls = mergeResponsiveClasses(nextCls, ['flex-wrap', 'justify-center', 'md:justify-start', 'gap-3', 'md:gap-5'], {
            breakpoint: 'all',
          });
          summary.push(`<${meta.tagName}> flex row → wrapping mobile bar`);
        } else {
          const stackTokens = isNavLike
            ? ['flex-col', 'md:flex-row', 'items-center', 'gap-3', 'md:gap-6']
            : ['flex-col', 'md:flex-row', 'gap-4', 'md:gap-6'];
          if (!isNavLike && curTokens.includes('items-end') && !curTokens.some((t) => /^(?:sm:|md:|lg:)items-/.test(t))) {
            stackTokens.push('items-start', 'md:items-end');
          }
          nextCls = mergeResponsiveClasses(nextCls, stackTokens, {
            breakpoint: 'all',
          });
          summary.push(`<${meta.tagName}> flex row → vertical stack on mobile`);
        }
        elementChanged = true;
      }

      // 3. Oversized horizontal padding px-8/10/12 without smaller mobile base
      const bigPx = curTokens.find((t) => /^px-(8|10|12|16)$/.test(t));
      const hasRespPx = curTokens.some((t) => /^(?:sm:|md:|lg:)px-/.test(t));
      if (bigPx && !hasRespPx) {
        nextCls = stripDirectTokens(nextCls, [bigPx]);
        nextCls = mergeResponsiveClasses(nextCls, ['px-4', 'sm:px-6', `lg:${bigPx}`], {
          breakpoint: 'all',
        });
        summary.push(`<${meta.tagName}> ${bigPx} → px-4 sm:px-6 lg:${bigPx}`);
        elementChanged = true;
      }

      // 4. Oversized vertical padding py-14/16/20 -> responsive py
      const bigPy = curTokens.find((t) => /^py-(12|14|16|20)$/.test(t));
      const hasRespPy = curTokens.some((t) => /^(?:sm:|md:|lg:)py-/.test(t));
      if (bigPy && !hasRespPy) {
        nextCls = stripDirectTokens(nextCls, [bigPy]);
        nextCls = mergeResponsiveClasses(nextCls, ['py-8', `lg:${bigPy}`], {
          breakpoint: 'all',
        });
        elementChanged = true;
      }

      // 5. Oversized headings text-4xl/5xl/6xl -> responsive typography scale
      const bigText = curTokens.find((t) => /^text-(4xl|5xl|6xl)$/.test(t));
      const hasRespText = curTokens.some((t) => /^(?:sm:|md:|lg:)text-/.test(t));
      if (bigText && !hasRespText && /^h[1-3]$/i.test(meta.tagName)) {
        nextCls = stripDirectTokens(nextCls, [bigText]);
        nextCls = mergeResponsiveClasses(nextCls, ['text-2xl', 'sm:text-3xl', `lg:${bigText}`], {
          breakpoint: 'all',
        });
        summary.push(`<${meta.tagName}> ${bigText} → text-2xl sm:text-3xl lg:${bigText}`);
        elementChanged = true;
      }

      // 6. Fixed inline width/height/overflow -> fluid on mobile, desktop-scoped if needed
      const inlineW = parseFloat(meta.inlineStyles.width || '');
      const inlineH = parseFloat(meta.inlineStyles.height || '');
      if (Number.isFinite(inlineW) && inlineW > 360) {
        patchStyles.width = null;
        nextCls = mergeResponsiveClasses(nextCls, ['w-full', 'max-w-5xl', 'mx-auto'], {
          breakpoint: 'all',
        });
        summary.push(`<${meta.tagName}> fixed ${Math.round(inlineW)}px width → fluid container`);
        elementChanged = true;
      } else if (Number.isFinite(inlineW) && inlineW > 40) {
        patchStyles.width = null;
        nextCls = mergeResponsiveClasses(nextCls, ['w-auto', `lg:w-[${Math.round(inlineW)}px]`], {
          breakpoint: 'all',
        });
        elementChanged = true;
      }
      if (Number.isFinite(inlineH) && inlineH > 40) {
        patchStyles.height = null;
        if (meta.inlineStyles.overflow === 'hidden') {
          patchStyles.overflow = null;
        }
        nextCls = mergeResponsiveClasses(nextCls, ['h-auto', 'overflow-visible'], {
          breakpoint: 'all',
        });
        elementChanged = true;
      }
      if (meta.inlineStyles.transform && meta.inlineStyles.transform.includes('translate')) {
        patchStyles.transform = null;
        summary.push(`<${meta.tagName}> cleared manual drag offset`);
        elementChanged = true;
      }
    }

    if (mode === 'mobile-first' && /^(h1|h2|p)$/i.test(meta.tagName) && !/\btext-(center|left|right)\b/.test(nextCls)) {
      if (meta.tagName.toLowerCase() === 'h1' || meta.tagName.toLowerCase() === 'p') {
        nextCls = mergeResponsiveClasses(nextCls, ['text-center', 'lg:text-left'], {
          breakpoint: 'all',
        });
        elementChanged = true;
      }
    }

    if (mode === 'desktop-balance') {
      // Balance section containers and card grids cleanly for desktop 1280px
      if (/^(section|footer|header)$/i.test(meta.tagName)) {
        const curTokens = nextCls.split(/\s+/).filter(Boolean);
        if (!curTokens.some((t) => /^max-w-/.test(t)) && !curTokens.includes('w-full')) {
          nextCls = mergeResponsiveClasses(nextCls, ['mx-auto', 'max-w-6xl'], {
            breakpoint: 'desktop',
          });
          elementChanged = true;
        }
      }
      if (meta.inlineStyles.transform && meta.inlineStyles.transform.includes('translate')) {
        patchStyles.transform = null;
        elementChanged = true;
      }
    }

    if (mode === 'center-focus') {
      if (/^(section|article|header|footer|h1|h2|h3|p)$/i.test(meta.tagName)) {
        const targetBp = breakpoint;
        const centerTokens = /^(section|article)$/i.test(meta.tagName)
          ? ['text-center', 'mx-auto', 'items-center']
          : ['text-center'];
        nextCls = mergeResponsiveClasses(nextCls, centerTokens, {
          breakpoint: targetBp,
          preserveDesktopOnMobile: targetBp === 'mobile',
          implicitDesktopDefaults: buildImplicitDesktopDefaults(nextCls, meta.inlineStyles),
        });
        elementChanged = true;
      }
    }

    if (elementChanged) {
      const patch: ElementSourcePatch = { className: nextCls };
      if (Object.keys(patchStyles).length > 0) {
        patch.styles = patchStyles;
      }
      const nextWorking = applyElementPatchToSource(working, i, isHtml, patch);
      if (nextWorking !== working) {
        working = nextWorking;
        changesCount += 1;
      }
    }
  }

  return {
    updatedCode: working,
    changesCount,
    summary: Array.from(new Set(summary)).slice(0, 6),
  };
}
