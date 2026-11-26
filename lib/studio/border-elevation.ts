export interface ShadowPresetOption {
  label: 'None' | 'Soft' | 'Card' | 'Deep';
  val: string;
}

export const SHADOW_PRESETS: ShadowPresetOption[] = [
  { label: 'None', val: 'none' },
  { label: 'Soft', val: '0 2px 8px rgba(15,23,42,0.08)' },
  { label: 'Card', val: '0 10px 25px -5px rgba(15,23,42,0.12)' },
  { label: 'Deep', val: '0 20px 45px -10px rgba(15,23,42,0.25)' },
];

export function clampNumericInput(
  raw: string | number,
  min: number,
  max: number
): number | null {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || !/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
    const n = Math.round(parseFloat(trimmed));
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, n));
  }
  if (!Number.isFinite(raw)) return null;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

export function clampCornerRadius(raw: string | number): number | null {
  return clampNumericInput(raw, 0, 200);
}

export function clampBorderWidth(raw: string | number): number | null {
  return clampNumericInput(raw, 0, 24);
}

export function clampOpacityPercent(raw: string | number): number | null {
  return clampNumericInput(raw, 0, 100);
}

export function clampElevationLevel(raw: string | number): number | null {
  return clampNumericInput(raw, 0, 24);
}

export function elevationLevelToBoxShadow(level: number): string {
  const clamped = clampElevationLevel(level) ?? 0;
  if (clamped <= 0) return 'none';
  const y = clamped;
  const blur = Math.round(clamped * 2.5);
  const spread = -Math.max(1, Math.round(clamped * 0.25));
  const alpha = Math.min(0.35, Number((0.06 + clamped * 0.01).toFixed(2)));
  return `0 ${y}px ${blur}px ${spread}px rgba(15,23,42,${alpha})`;
}

export function boxShadowToElevationHint(boxShadow?: string): number {
  if (!boxShadow || boxShadow === 'none') return 0;
  const firstLayer = boxShadow.replace(/rgba?\([^)]*\)/gi, '').trim();
  const tokens = firstLayer.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return 0;
  const y = Math.abs(Math.round(parseFloat(tokens[1])));
  if (!Number.isFinite(y)) return 0;
  return clampElevationLevel(y) ?? 0;
}

export function matchShadowPresetLabel(
  inlineShadow?: string,
  computedShadow?: string
): ShadowPresetOption['label'] | null {
  const inlineNorm = (inlineShadow || '').replace(/\s+/g, '').toLowerCase();
  if (inlineNorm) {
    const match = SHADOW_PRESETS.find(
      (p) => p.val.replace(/\s+/g, '').toLowerCase() === inlineNorm
    );
    if (match) return match.label;
  }
  const compNorm = (computedShadow || '').replace(/\s+/g, '').toLowerCase();
  if (!compNorm || compNorm === 'none') return 'None';
  if (compNorm.includes('0px2px8px')) return 'Soft';
  if (compNorm.includes('0px10px25px')) return 'Card';
  if (compNorm.includes('0px20px45px')) return 'Deep';
  return null;
}
