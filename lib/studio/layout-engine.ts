export type LayoutAxis = 'horizontal' | 'vertical' | 'grid';
export type SizingMode = 'fixed' | 'hug' | 'fill';
export interface LayoutOptions { axis?: LayoutAxis; gap?: number; padding?: number; wrap?: boolean; align?: 'start' | 'center' | 'end' | 'stretch'; }
export interface LayoutSizing { width: SizingMode; height: SizingMode; }
export function normalizeLayoutOptions(options: LayoutOptions = {}): Required<LayoutOptions> {
  return { axis: options.axis ?? 'vertical', gap: Math.max(0, options.gap ?? 8), padding: Math.max(0, options.padding ?? 0),
    wrap: options.wrap ?? false, align: options.align ?? 'start' };
}
export function layoutContainerCss(options: LayoutOptions = {}): Record<string, string> {
  const o = normalizeLayoutOptions(options);
  return { display: o.axis === 'grid' ? 'grid' : 'flex', flexDirection: o.axis === 'vertical' ? 'column' : 'row',
    flexWrap: o.wrap ? 'wrap' : 'nowrap', gap: `${o.gap}px`, padding: `${o.padding}px`,
    alignItems: o.align === 'start' ? 'flex-start' : o.align === 'end' ? 'flex-end' : o.align === 'stretch' ? 'stretch' : 'center',
    ...(o.axis === 'grid' ? { gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))' } : {}) };
}
export function sizingModeCss(mode: SizingMode, axis: 'width' | 'height'): Record<string, string> {
  if (mode === 'fill') return { [axis]: '100%', [axis === 'width' ? 'flexGrow' : 'alignSelf']: '1' } as Record<string, string>;
  if (mode === 'hug') return { [axis]: 'fit-content' };
  return { [axis]: 'auto' };
}
export function layoutGapPreset(value: number): number { return Math.max(0, Math.min(128, Math.round(value))); }
export function layoutWrapCss(enabled: boolean): Record<string, string> { return { flexWrap: enabled ? 'wrap' : 'nowrap' };}