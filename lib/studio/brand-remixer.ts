export type BrandRadiusScaleId = 'sharp' | 'soft' | 'rounded';
export type BrandShadowMoodId = 'flat' | 'crisp' | 'elevated' | 'dramatic';
export type BrandThemeMode = 'light' | 'dark';

export interface BrandColorPalette {
  id: string;
  name: string;
  tagline: string;
  swatches: [string, string, string, string];
  light: {
    canvas: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    accentText: string;
    border: string;
  };
  dark: {
    canvas: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    accentText: string;
    border: string;
  };
}

export interface BrandFontPairing {
  id: string;
  name: string;
  mood: string;
  headingFamily: string;
  bodyFamily: string;
  googleImportUrl: string;
}

export interface BrandRadiusScale {
  id: BrandRadiusScaleId;
  label: string;
  summary: string;
  sm: string;
  md: string;
  lg: string;
  pill: string;
}

export interface BrandShadowMood {
  id: BrandShadowMoodId;
  label: string;
  summary: string;
  cardShadow: string;
  elevatedShadow: string;
}

export interface BrandRemixConfig {
  paletteId: string;
  fontPairingId: string;
  radiusScaleId: BrandRadiusScaleId;
  shadowMoodId: BrandShadowMoodId;
  themeMode: BrandThemeMode;
}

export const BRAND_PALETTES: BrandColorPalette[] = [
  {
    id: 'nordic-cobalt',
    name: 'Nordic Cobalt',
    tagline: 'Crisp studio white, deep slate ink & electric cobalt',
    swatches: ['#F8FAFC', '#FFFFFF', '#0F172A', '#2563EB'],
    light: {
      canvas: '#F8FAFC',
      surface: '#FFFFFF',
      text: '#0F172A',
      muted: '#475569',
      accent: '#2563EB',
      accentText: '#FFFFFF',
      border: '#E2E8F0',
    },
    dark: {
      canvas: '#0B1120',
      surface: '#111C33',
      text: '#F8FAFC',
      muted: '#94A3B8',
      accent: '#3B82F6',
      accentText: '#FFFFFF',
      border: '#1E293B',
    },
  },
  {
    id: 'warm-editorial',
    name: 'Warm Editorial',
    tagline: 'Stone parchment, espresso ink & burnt terracotta',
    swatches: ['#FAF8F5', '#FFFFFF', '#1C1917', '#C2410C'],
    light: {
      canvas: '#FAF8F5',
      surface: '#FFFFFF',
      text: '#1C1917',
      muted: '#57534E',
      accent: '#C2410C',
      accentText: '#FFFFFF',
      border: '#E7E5E4',
    },
    dark: {
      canvas: '#141210',
      surface: '#1F1C19',
      text: '#FAF8F5',
      muted: '#A8A29E',
      accent: '#EA580C',
      accentText: '#FFFFFF',
      border: '#2E2925',
    },
  },
  {
    id: 'emerald-signal',
    name: 'Emerald Signal',
    tagline: 'Clean mist canvas, graphite type & deep forest green',
    swatches: ['#F6FAF8', '#FFFFFF', '#0F1F18', '#059669'],
    light: {
      canvas: '#F6FAF8',
      surface: '#FFFFFF',
      text: '#0F1F18',
      muted: '#475E54',
      accent: '#059669',
      accentText: '#FFFFFF',
      border: '#D9E7DF',
    },
    dark: {
      canvas: '#081410',
      surface: '#10231B',
      text: '#ECFDF5',
      muted: '#86B3A0',
      accent: '#10B981',
      accentText: '#042F2E',
      border: '#1C3A2E',
    },
  },
  {
    id: 'royal-indigo',
    name: 'Royal Indigo',
    tagline: 'Soft pearl ground, charcoal ink & vibrant indigo',
    swatches: ['#F7F7FC', '#FFFFFF', '#18182F', '#4F46E5'],
    light: {
      canvas: '#F7F7FC',
      surface: '#FFFFFF',
      text: '#18182F',
      muted: '#52527A',
      accent: '#4F46E5',
      accentText: '#FFFFFF',
      border: '#E2E2F2',
    },
    dark: {
      canvas: '#0D0D1D',
      surface: '#171732',
      text: '#F5F5FF',
      muted: '#A1A1C9',
      accent: '#6366F1',
      accentText: '#FFFFFF',
      border: '#28284D',
    },
  },
  {
    id: 'amber-atelier',
    name: 'Amber Atelier',
    tagline: 'Alabaster sand, deep obsidian & refined gold-amber',
    swatches: ['#FDFBF7', '#FFFFFF', '#181512', '#D97706'],
    light: {
      canvas: '#FDFBF7',
      surface: '#FFFFFF',
      text: '#181512',
      muted: '#665C50',
      accent: '#D97706',
      accentText: '#FFFFFF',
      border: '#ECE4D8',
    },
    dark: {
      canvas: '#13110E',
      surface: '#1E1B16',
      text: '#FAF5EB',
      muted: '#B5AA99',
      accent: '#F59E0B',
      accentText: '#181512',
      border: '#322C24',
    },
  },
  {
    id: 'monochrome-noir',
    name: 'Monochrome Noir',
    tagline: 'Gallery white, stark jet black & minimal silver rules',
    swatches: ['#FAFAFA', '#FFFFFF', '#09090B', '#18181B'],
    light: {
      canvas: '#FAFAFA',
      surface: '#FFFFFF',
      text: '#09090B',
      muted: '#52525B',
      accent: '#18181B',
      accentText: '#FFFFFF',
      border: '#E4E4E7',
    },
    dark: {
      canvas: '#09090B',
      surface: '#141417',
      text: '#FAFAFA',
      muted: '#A1A1AA',
      accent: '#F4F4F5',
      accentText: '#09090B',
      border: '#27272A',
    },
  },
];

export const BRAND_FONT_PAIRINGS: BrandFontPairing[] = [
  {
    id: 'jakarta-inter',
    name: 'Plus Jakarta + Inter',
    mood: 'Modern SaaS',
    headingFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    bodyFamily: "'Inter', system-ui, sans-serif",
    googleImportUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap',
  },
  {
    id: 'playfair-dm',
    name: 'Playfair Display + DM Sans',
    mood: 'Editorial Luxury',
    headingFamily: "'Playfair Display', Georgia, serif",
    bodyFamily: "'DM Sans', system-ui, sans-serif",
    googleImportUrl:
      'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700;800&display=swap',
  },
  {
    id: 'bricolage-manrope',
    name: 'Bricolage + Manrope',
    mood: 'Creative Studio',
    headingFamily: "'Bricolage Grotesque', system-ui, sans-serif",
    bodyFamily: "'Manrope', system-ui, sans-serif",
    googleImportUrl:
      'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap',
  },
  {
    id: 'outfit-jakarta',
    name: 'Outfit + Plus Jakarta',
    mood: 'Geometric Tech',
    headingFamily: "'Outfit', system-ui, sans-serif",
    bodyFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    googleImportUrl:
      'https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap',
  },
  {
    id: 'space-jetbrains',
    name: 'Space Grotesk + JetBrains',
    mood: 'Engineering / Dev',
    headingFamily: "'Space Grotesk', system-ui, sans-serif",
    bodyFamily: "'Inter', system-ui, sans-serif",
    googleImportUrl:
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@600;700&display=swap',
  },
];

export const BRAND_RADIUS_SCALES: BrandRadiusScale[] = [
  {
    id: 'sharp',
    label: 'Sharp',
    summary: 'Architectural 2–6px corners',
    sm: '2px',
    md: '4px',
    lg: '6px',
    pill: '6px',
  },
  {
    id: 'soft',
    label: 'Soft',
    summary: 'Balanced 8–16px UI corners',
    sm: '8px',
    md: '12px',
    lg: '16px',
    pill: '9999px',
  },
  {
    id: 'rounded',
    label: 'Rounded',
    summary: 'Expressive 16–28px pill forms',
    sm: '14px',
    md: '20px',
    lg: '28px',
    pill: '9999px',
  },
];

export const BRAND_SHADOW_MOODS: BrandShadowMood[] = [
  {
    id: 'flat',
    label: 'Flat',
    summary: 'Border-driven crispness, no blur',
    cardShadow: 'none',
    elevatedShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
  },
  {
    id: 'crisp',
    label: 'Crisp',
    summary: 'Subtle tactile edge separation',
    cardShadow: '0 2px 8px rgba(15, 23, 42, 0.05), 0 1px 2px rgba(15, 23, 42, 0.04)',
    elevatedShadow: '0 8px 20px rgba(15, 23, 42, 0.08)',
  },
  {
    id: 'elevated',
    label: 'Elevated',
    summary: 'Airy diffused floating cards',
    cardShadow: '0 10px 28px -6px rgba(15, 23, 42, 0.10), 0 4px 10px -4px rgba(15, 23, 42, 0.05)',
    elevatedShadow: '0 20px 44px -10px rgba(15, 23, 42, 0.16)',
  },
  {
    id: 'dramatic',
    label: 'Dramatic',
    summary: 'Deep editorial depth & contrast',
    cardShadow: '0 18px 40px -12px rgba(15, 23, 42, 0.22), 0 4px 12px rgba(15, 23, 42, 0.08)',
    elevatedShadow: '0 28px 60px -14px rgba(15, 23, 42, 0.30)',
  },
];

export const DEFAULT_BRAND_REMIX_CONFIG: BrandRemixConfig = {
  paletteId: 'nordic-cobalt',
  fontPairingId: 'jakarta-inter',
  radiusScaleId: 'soft',
  shadowMoodId: 'crisp',
  themeMode: 'light',
};

const REMIX_START = '/* atelier-brand-remix:start */';
const REMIX_END = '/* atelier-brand-remix:end */';

export function buildBrandRemixCssBlock(config: BrandRemixConfig): string {
  const palette =
    BRAND_PALETTES.find((p) => p.id === config.paletteId) || BRAND_PALETTES[0];
  const fonts =
    BRAND_FONT_PAIRINGS.find((f) => f.id === config.fontPairingId) || BRAND_FONT_PAIRINGS[0];
  const radius =
    BRAND_RADIUS_SCALES.find((r) => r.id === config.radiusScaleId) || BRAND_RADIUS_SCALES[1];
  const shadow =
    BRAND_SHADOW_MOODS.find((s) => s.id === config.shadowMoodId) || BRAND_SHADOW_MOODS[1];

  const activeTokens = config.themeMode === 'dark' ? palette.dark : palette.light;

  return `${REMIX_START}
@import url("${fonts.googleImportUrl}");

:root {
  --bg-canvas: ${activeTokens.canvas};
  --bg-surface: ${activeTokens.surface};
  --text-primary: ${activeTokens.text};
  --text-muted: ${activeTokens.muted};
  --accent-primary: ${activeTokens.accent};
  --accent-foreground: ${activeTokens.accentText};
  --border-subtle: ${activeTokens.border};
  --font-heading: ${fonts.headingFamily};
  --font-body: ${fonts.bodyFamily};
  --radius-sm: ${radius.sm};
  --radius-base: ${radius.md};
  --radius-lg: ${radius.lg};
  --radius-pill: ${radius.pill};
  --shadow-card: ${shadow.cardShadow};
  --shadow-elevated: ${shadow.elevatedShadow};
}

.dark {
  --bg-canvas: ${palette.dark.canvas};
  --bg-surface: ${palette.dark.surface};
  --text-primary: ${palette.dark.text};
  --text-muted: ${palette.dark.muted};
  --accent-primary: ${palette.dark.accent};
  --accent-foreground: ${palette.dark.accentText};
  --border-subtle: ${palette.dark.border};
}

body {
  background-color: var(--bg-canvas);
  color: var(--text-primary);
  font-family: var(--font-body);
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-heading);
}

${
  config.themeMode === 'dark'
    ? `html, body, #root, main {
  background-color: var(--bg-canvas) !important;
  color: var(--text-primary);
}
header, footer, nav, article, .bg-white, .bg-slate-50, .bg-gray-50 {
  background-color: var(--bg-surface) !important;
  border-color: var(--border-subtle) !important;
}
.text-slate-900, .text-slate-800, .text-gray-900, .text-zinc-900 {
  color: var(--text-primary) !important;
}
.text-slate-600, .text-slate-500, .text-gray-600, .text-zinc-500 {
  color: var(--text-muted) !important;
}`
    : `body, main {
  background-color: var(--bg-canvas);
  color: var(--text-primary);
}`
}

article, [class*="rounded-xl"], [class*="rounded-2xl"], [class*="rounded-lg"] {
  border-radius: var(--radius-base);
}

button, a[class*="rounded"] {
  border-radius: var(--radius-sm);
}

article, [class*="shadow-"] {
  box-shadow: var(--shadow-card);
}
${REMIX_END}`;
}

export function applyBrandRemixToGlobalCss(
  currentCss: string,
  config: BrandRemixConfig
): string {
  const block = buildBrandRemixCssBlock(config);
  const startIdx = currentCss.indexOf(REMIX_START);
  const endIdx = currentCss.indexOf(REMIX_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = currentCss.slice(0, startIdx).trimEnd();
    const after = currentCss.slice(endIdx + REMIX_END.length).trimStart();
    return [before, block, after].filter(Boolean).join('\n\n') + '\n';
  }

  // Keep @import "tailwindcss" at top if present, and place our remix block cleanly right after imports
  const lines = currentCss.split('\n');
  let insertLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('@import ') || trimmed.startsWith('@charset ')) {
      insertLine = i + 1;
    } else if (trimmed.length > 0 && !trimmed.startsWith('/*')) {
      break;
    }
  }

  const head = lines.slice(0, insertLine).join('\n').trimEnd();
  const tail = lines.slice(insertLine).join('\n').trimStart();
  return [head, block, tail].filter(Boolean).join('\n\n') + '\n';
}

export function stripBrandRemixFromGlobalCss(currentCss: string): string {
  const startIdx = currentCss.indexOf(REMIX_START);
  const endIdx = currentCss.indexOf(REMIX_END);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return currentCss;
  const before = currentCss.slice(0, startIdx).trimEnd();
  const after = currentCss.slice(endIdx + REMIX_END.length).trimStart();
  return [before, after].filter(Boolean).join('\n\n') + '\n';
}
