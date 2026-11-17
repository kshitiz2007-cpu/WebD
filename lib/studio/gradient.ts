import { GradientConfig, GradientStop } from './types';

export function normalizeHex(input: string, fallback = '#2563EB'): string {
  const cleaned = input.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
    return cleaned.toUpperCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned.toUpperCase()}`;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(cleaned)) {
    const r = cleaned[1];
    const g = cleaned[2];
    const b = cleaned[3];
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  const rgbMatch = cleaned.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i);
  if (rgbMatch) {
    const toHex = (n: string) =>
      Math.max(0, Math.min(255, Number(n)))
        .toString(16)
        .padStart(2, '0')
        .toUpperCase();
    return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
  }
  return fallback;
}

export function isValidHexInput(input: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(input.trim()) || /^#[0-9a-fA-F]{3}$/.test(input.trim());
}

export function createDefaultStops(count: 2 | 3 | 4, baseHex = '#0F172A'): GradientStop[] {
  const normalizedBase = normalizeHex(baseHex, '#0F172A');
  if (count === 2) {
    return [
      { color: normalizedBase, position: 0 },
      { color: '#2563EB', position: 100 },
    ];
  }
  if (count === 3) {
    return [
      { color: normalizedBase, position: 0 },
      { color: '#1D4ED8', position: 50 },
      { color: '#0EA5E9', position: 100 },
    ];
  }
  return [
    { color: normalizedBase, position: 0 },
    { color: '#1E3A8A', position: 33 },
    { color: '#0284C7', position: 67 },
    { color: '#38BDF8', position: 100 },
  ];
}

export function resizeGradientStops(
  current: GradientStop[],
  newCount: 2 | 3 | 4
): GradientStop[] {
  const defaults = createDefaultStops(newCount, current[0]?.color || '#0F172A');
  const next: GradientStop[] = [];
  for (let i = 0; i < newCount; i++) {
    const pos = Math.round((i / (newCount - 1)) * 100);
    if (i < current.length) {
      next.push({
        color: normalizeHex(current[i].color, defaults[i].color),
        position: current.length === newCount ? current[i].position : pos,
      });
    } else {
      next.push({
        color: defaults[i].color,
        position: pos,
      });
    }
  }
  return next;
}

export function buildGradientCss(config: GradientConfig): string {
  const activeStops = config.stops.slice(0, config.stopCount);
  if (config.type === 'solid') {
    return normalizeHex(activeStops[0]?.color || '#FFFFFF', '#FFFFFF');
  }
  const stopStrings = activeStops.map(
    (s) => `${normalizeHex(s.color, '#000000')} ${Math.max(0, Math.min(100, Math.round(s.position)))}%`
  );
  if (config.type === 'radial') {
    return `radial-gradient(circle at center, ${stopStrings.join(', ')})`;
  }
  const angle = Number.isFinite(config.angle) ? Math.round(config.angle) : 135;
  return `linear-gradient(${angle}deg, ${stopStrings.join(', ')})`;
}

export function parseGradientCss(
  backgroundImage?: string,
  backgroundColor?: string,
  textColor?: string,
  backgroundClip?: string
): GradientConfig {
  const isTextTarget = backgroundClip === 'text';
  const img = (backgroundImage || '').trim();

  if (img && img !== 'none') {
    const linearMatch = img.match(/^linear-gradient\(\s*([^,]+)\s*,\s*(.+)\)$/i);
    if (linearMatch) {
      const anglePart = linearMatch[1].trim();
      const angleNum = anglePart.endsWith('deg') ? parseFloat(anglePart) : 135;
      const stops = extractStopsFromGradientBody(linearMatch[2]);
      if (stops.length >= 2) {
        const stopCount = Math.min(4, Math.max(2, stops.length)) as 2 | 3 | 4;
        return {
          type: 'linear',
          angle: Number.isFinite(angleNum) ? angleNum : 135,
          stopCount,
          stops: stops.slice(0, stopCount),
          target: isTextTarget ? 'text' : 'background',
        };
      }
    }

    const radialMatch = img.match(/^radial-gradient\(\s*(.+)\)$/i);
    if (radialMatch) {
      // Remove optional shape/position prefix before the first color stop
      const parts = splitTopLevelCommas(radialMatch[1]);
      const stopParts = parts.filter((p) => /#|rgb|hsl/i.test(p));
      const stops = extractStopsFromGradientBody(stopParts.join(', '));
      if (stops.length >= 2) {
        const stopCount = Math.min(4, Math.max(2, stops.length)) as 2 | 3 | 4;
        return {
          type: 'radial',
          angle: 135,
          stopCount,
          stops: stops.slice(0, stopCount),
          target: isTextTarget ? 'text' : 'background',
        };
      }
    }
  }

  const solidColor = normalizeHex(
    isTextTarget ? textColor || '#0F172A' : backgroundColor || '#FFFFFF',
    '#FFFFFF'
  );
  return {
    type: 'solid',
    angle: 135,
    stopCount: 3,
    stops: [
      { color: solidColor, position: 0 },
      { color: '#1D4ED8', position: 50 },
      { color: '#0EA5E9', position: 100 },
    ],
    target: isTextTarget ? 'text' : 'background',
  };
}

function splitTopLevelCommas(str: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function extractStopsFromGradientBody(body: string): GradientStop[] {
  const parts = splitTopLevelCommas(body);
  const parsed: GradientStop[] = [];
  parts.forEach((part, idx) => {
    const colorMatch = part.match(/(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\))/i);
    const posMatch = part.match(/(\d+(?:\.\d+)?)%/);
    if (colorMatch) {
      parsed.push({
        color: normalizeHex(colorMatch[1], '#2563EB'),
        position: posMatch
          ? Math.round(parseFloat(posMatch[1]))
          : Math.round((idx / Math.max(1, parts.length - 1)) * 100),
      });
    }
  });
  return parsed;
}

export interface GradientPreset {
  name: string;
  config: Omit<GradientConfig, 'target'>;
}

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    name: 'Nordic Slate (3-Stop)',
    config: {
      type: 'linear',
      angle: 135,
      stopCount: 3,
      stops: [
        { color: '#0F172A', position: 0 },
        { color: '#1E3A8A', position: 52 },
        { color: '#0284C7', position: 100 },
      ],
    },
  },
  {
    name: 'Atelier Horizon (4-Stop)',
    config: {
      type: 'linear',
      angle: 120,
      stopCount: 4,
      stops: [
        { color: '#0F172A', position: 0 },
        { color: '#1D4ED8', position: 34 },
        { color: '#0EA5E9', position: 68 },
        { color: '#BAE6FD', position: 100 },
      ],
    },
  },
  {
    name: 'Warm Sandstone (3-Stop)',
    config: {
      type: 'linear',
      angle: 145,
      stopCount: 3,
      stops: [
        { color: '#FFFBEB', position: 0 },
        { color: '#FDE68A', position: 48 },
        { color: '#F59E0B', position: 100 },
      ],
    },
  },
  {
    name: 'Emerald Mist (4-Stop)',
    config: {
      type: 'linear',
      angle: 135,
      stopCount: 4,
      stops: [
        { color: '#022C22', position: 0 },
        { color: '#065F46', position: 35 },
        { color: '#10B981', position: 72 },
        { color: '#A7F3D0', position: 100 },
      ],
    },
  },
  {
    name: 'Studio Graphite (3-Stop)',
    config: {
      type: 'linear',
      angle: 180,
      stopCount: 3,
      stops: [
        { color: '#FFFFFF', position: 0 },
        { color: '#F1F5F9', position: 55 },
        { color: '#E2E8F0', position: 100 },
      ],
    },
  },
  {
    name: 'Solar Radial (4-Stop)',
    config: {
      type: 'radial',
      angle: 0,
      stopCount: 4,
      stops: [
        { color: '#FEF3C7', position: 0 },
        { color: '#F59E0B', position: 38 },
        { color: '#B45309', position: 72 },
        { color: '#1E1B4B', position: 100 },
      ],
    },
  },
  {
    name: 'Coral Dusk (3-Stop)',
    config: {
      type: 'linear',
      angle: 135,
      stopCount: 3,
      stops: [
        { color: '#FFF1F2', position: 0 },
        { color: '#FB7185', position: 50 },
        { color: '#BE123C', position: 100 },
      ],
    },
  },
  {
    name: 'Indigo Prism (4-Stop)',
    config: {
      type: 'linear',
      angle: 120,
      stopCount: 4,
      stops: [
        { color: '#1E1B4B', position: 0 },
        { color: '#4338CA', position: 34 },
        { color: '#6366F1', position: 68 },
        { color: '#C7D2FE', position: 100 },
      ],
    },
  },
];

export function generateGradientDeclarations(config: GradientConfig): string[] {
  const cssValue = buildGradientCss(config);
  if (config.type === 'solid') {
    return config.target === 'text'
      ? [`color: ${cssValue};`]
      : [`background-color: ${cssValue};`];
  }
  if (config.target === 'text') {
    return [
      `background-image: ${cssValue};`,
      '-webkit-background-clip: text;',
      'background-clip: text;',
      '-webkit-text-fill-color: transparent;',
    ];
  }
  return [`background-image: ${cssValue};`];
}

export type GradientCssFormat = 'rule' | 'declarations' | 'tailwind';

export function generateElementGradientCss(
  config: GradientConfig,
  options?: {
    selector?: string;
    format?: GradientCssFormat;
  }
): string {
  const format = options?.format || 'rule';
  const selector = (options?.selector || '.selected-element').trim() || '.selected-element';

  if (format === 'tailwind') {
    const cssValue = buildGradientCss(config);
    if (config.type === 'solid') {
      return config.target === 'text' ? `text-[${cssValue}]` : `bg-[${cssValue}]`;
    }
    const token = cssValue.replace(/\s+/g, '_');
    return config.target === 'text'
      ? `bg-[${token}] bg-clip-text text-transparent`
      : `bg-[${token}]`;
  }

  const declarations = generateGradientDeclarations(config);
  if (format === 'declarations') {
    return declarations.join('\n');
  }

  return `${selector} {\n  ${declarations.join('\n  ')}\n}`;
}

