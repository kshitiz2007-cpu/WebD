import {
  type ElementAnimationConfig,
  DEFAULT_ANIMATION_CONFIG,
  SCROLL_REVEAL_PRESETS,
  HOVER_INTERACTION_PRESETS,
  AMBIENT_LOOP_PRESETS,
  type AnimationEasing,
} from './animation-studio';

export type MotionRuleTarget = 'h1' | 'h2' | 'h3' | 'p' | 'a' | 'button' | '.card' | 'img' | 'section' | '*';
export type MotionPresetRule = {
  id: string;
  name: string;
  target: MotionRuleTarget;
  config: ElementAnimationConfig;
  enabled: boolean;
};

export type MotionPreset = {
  schema: 'webd.motion-preset';
  version: 1;
  name: string;
  description?: string;
  createdAt?: string;
  settings: {
    enabled: boolean;
    intensity: number;
    respectReducedMotion: boolean;
  };
  rules: MotionPresetRule[];
};

export const MOTION_PRESET_FILE = 'webd.motion-preset.json';

export const DEFAULT_MOTION_PRESET: MotionPreset = {
  schema: 'webd.motion-preset',
  version: 1,
  name: 'WebD Extreme Motion',
  description: 'Expressive global motion with scroll reveals, tactile hover and ambient movement.',
  settings: { enabled: true, intensity: 1, respectReducedMotion: true },
  rules: [
    { id: 'headings', name: 'Heading reveal', target: 'h1', enabled: true, config: { ...DEFAULT_ANIMATION_CONFIG, reveal: 'blur-up', duration: 0.9, easing: 'smooth' } },
    { id: 'subheadings', name: 'Subheading reveal', target: 'h2', enabled: true, config: { ...DEFAULT_ANIMATION_CONFIG, reveal: 'fade-up', duration: 0.75, delay: 0.08 } },
    { id: 'paragraphs', name: 'Body copy reveal', target: 'p', enabled: true, config: { ...DEFAULT_ANIMATION_CONFIG, reveal: 'fade-up', duration: 0.65, delay: 0.04 } },
    { id: 'buttons', name: 'Button interaction', target: 'button', enabled: true, config: { ...DEFAULT_ANIMATION_CONFIG, hover: 'scale-pop', duration: 0.3, easing: 'snappy' } },
    { id: 'links', name: 'Link interaction', target: 'a', enabled: true, config: { ...DEFAULT_ANIMATION_CONFIG, hover: 'lift', duration: 0.25 } },
    { id: 'cards', name: 'Card reveal + tilt', target: '.card', enabled: true, config: { ...DEFAULT_ANIMATION_CONFIG, reveal: 'fade-up', hover: 'tilt-soft', duration: 0.7, staggerChildren: true } },
    { id: 'images', name: 'Image reveal', target: 'img', enabled: true, config: { ...DEFAULT_ANIMATION_CONFIG, reveal: 'zoom-in', duration: 0.9 } },
  ],
};

const reveals = new Set(SCROLL_REVEAL_PRESETS.map((item) => item.id));
const hovers = new Set(HOVER_INTERACTION_PRESETS.map((item) => item.id));
const loops = new Set(AMBIENT_LOOP_PRESETS.map((item) => item.id));
const easings = new Set<AnimationEasing>(['smooth', 'spring', 'snappy', 'linear']);
const targets = new Set<MotionRuleTarget>(['h1', 'h2', 'h3', 'p', 'a', 'button', '.card', 'img', 'section', '*']);

function normalizeConfig(input: unknown): ElementAnimationConfig {
  if (!input || typeof input !== 'object') throw new Error('Each rule needs a config object.');
  const value = input as Record<string, unknown>;
  const reveal = String(value.reveal || 'none');
  const hover = String(value.hover || 'none');
  const loop = String(value.loop || 'none');
  const easing = String(value.easing || 'smooth') as AnimationEasing;
  if (!reveals.has(reveal as never)) throw new Error(`Unsupported reveal animation: ${reveal}`);
  if (!hovers.has(hover as never)) throw new Error(`Unsupported hover animation: ${hover}`);
  if (!loops.has(loop as never)) throw new Error(`Unsupported loop animation: ${loop}`);
  if (!easings.has(easing)) throw new Error(`Unsupported easing: ${easing}`);
  const number = (key: string, fallback: number, min: number, max: number) => {
    const parsed = Number(value[key] ?? fallback);
    if (!Number.isFinite(parsed)) throw new Error(`${key} must be a finite number.`);
    return Math.min(max, Math.max(min, parsed));
  };
  return {
    ...DEFAULT_ANIMATION_CONFIG,
    reveal: reveal as ElementAnimationConfig['reveal'],
    hover: hover as ElementAnimationConfig['hover'],
    loop: loop as ElementAnimationConfig['loop'],
    easing,
    duration: number('duration', 0.65, 0.15, 3),
    delay: number('delay', 0, 0, 2.5),
    staggerChildren: value.staggerChildren === true,
    staggerStepMs: Math.round(number('staggerStepMs', 80, 40, 300)),
    once: value.once !== false,
  };
}

export function parseMotionPreset(raw: string): MotionPreset {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error('This file is not valid JSON.'); }
  return normalizeMotionPreset(parsed);
}

export function normalizeMotionPreset(parsed: unknown): MotionPreset {
  if (!parsed || typeof parsed !== 'object') throw new Error('Preset must be a JSON object.');
  const value = parsed as Record<string, unknown>;
  if (value.schema !== 'webd.motion-preset') throw new Error('This is not a WebD motion preset.');
  if (value.version !== 1) throw new Error('Unsupported motion preset version.');
  if (!Array.isArray(value.rules)) throw new Error('Preset rules must be an array.');
  if (value.rules.length > 100) throw new Error('A preset can contain at most 100 rules.');
  const settings = (value.settings && typeof value.settings === 'object' ? value.settings : {}) as Record<string, unknown>;
  const intensity = Number(settings.intensity ?? 1);
  if (!Number.isFinite(intensity)) throw new Error('Intensity must be a finite number.');
  const rules = value.rules.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`Rule ${index + 1} is invalid.`);
    const rule = item as Record<string, unknown>;
    const target = String(rule.target || '*') as MotionRuleTarget;
    if (!targets.has(target)) throw new Error(`Rule ${index + 1} has an unsupported target.`);
    return {
      id: String(rule.id || `rule-${index + 1}`).slice(0, 80),
      name: String(rule.name || `Rule ${index + 1}`).slice(0, 100),
      target,
      enabled: rule.enabled !== false,
      config: normalizeConfig(rule.config),
    };
  });
  return {
    schema: 'webd.motion-preset',
    version: 1,
    name: String(value.name || 'Imported Motion Preset').slice(0, 100),
    description: String(value.description || '').slice(0, 500),
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : undefined,
    settings: { enabled: settings.enabled !== false, intensity: Math.min(2, Math.max(0, intensity)), respectReducedMotion: settings.respectReducedMotion !== false },
    rules,
  };
}

export function serializeMotionPreset(preset: MotionPreset): string {
  return JSON.stringify({ ...preset, createdAt: preset.createdAt || new Date().toISOString() }, null, 2);
}

/** Apply rules to the project's actual files; custom code/CSS in a preset is never executed. */
export function applyMotionPresetToFiles(files: Record<string, string>, preset: MotionPreset): Record<string, string> {
  const next = { ...files };
  if (!preset.settings.enabled) {
    const cssPath = Object.keys(next).find((path) => /(^|\/)globals\.css$/i.test(path)) || Object.keys(next).find((path) => /\.css$/i.test(path));
    if (cssPath) {
      const start = '/* WEBD_GLOBAL_MOTION_START */';
      const end = '/* WEBD_GLOBAL_MOTION_END */';
      const css = next[cssPath] || '';
      const from = css.indexOf(start);
      const to = css.indexOf(end);
      if (from >= 0 && to > from) next[cssPath] = css.slice(0, from) + css.slice(to + end.length);
    }
    return next;
  }
  const cssPath = Object.keys(next).find((path) => /(^|\/)globals\.css$/i.test(path)) ||
    Object.keys(next).find((path) => /\.css$/i.test(path));
  if (!cssPath) throw new Error('Add a global CSS file before applying project-wide motion.');
  const safeRules = preset.rules.filter((rule) => rule.enabled && (rule.config.reveal !== 'none' || rule.config.hover !== 'none' || rule.config.loop !== 'none'));
  const css = safeRules.map((rule) => {
    const selector = rule.target === '*' ? '[data-webd-motion]' : rule.target;
    const id = rule.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60);
    const duration = Math.max(0.15, Math.min(3, rule.config.duration / Math.max(0.25, preset.settings.intensity || 1)));
    const delay = rule.config.delay;
    const easing = ({ smooth: 'cubic-bezier(.22,1,.36,1)', spring: 'cubic-bezier(.34,1.56,.64,1)', snappy: 'cubic-bezier(.16,1,.3,1)', linear: 'linear' } as const)[rule.config.easing];
    const blocks: string[] = [];
    if (rule.config.reveal !== 'none') {
      const transforms: Record<string, string> = { 'fade-up': 'translateY(28px)', 'fade-down': 'translateY(-28px)', 'fade-left': 'translateX(28px)', 'fade-right': 'translateX(-28px)', 'zoom-in': 'scale(.92)', 'zoom-out': 'scale(1.08)', 'blur-up': 'translateY(22px)', 'flip-up': 'perspective(800px) rotateX(12deg) translateY(18px)' };
      blocks.push(`${selector}.webd-motion-${id} { opacity: 0; transform: ${transforms[rule.config.reveal] || 'translateY(20px)'}; ${rule.config.reveal === 'blur-up' ? 'filter: blur(8px);' : ''} transition: opacity ${duration}s ${easing} ${delay}s, transform ${duration}s ${easing} ${delay}s, filter ${duration}s ${easing} ${delay}s; }`);
      blocks.push(`${selector}.webd-motion-${id}.webd-motion-visible { opacity: 1; transform: none; filter: none; }`);
    }
    if (rule.config.hover !== 'none') {
      const hover = rule.config.hover === 'tilt-soft' ? 'translateY(-3px) rotateX(2deg) rotateY(-2deg)' : rule.config.hover === 'scale-pop' ? 'translateY(-1px) scale(1.04)' : rule.config.hover === 'press-tap' ? 'translateY(-1px) scale(1.02)' : 'translateY(-4px)';
      const shadow = rule.config.hover === 'glow-ring' ? '0 0 0 1px rgba(139,92,246,.55), 0 12px 36px rgba(139,92,246,.22)' : '0 14px 34px rgba(0,0,0,.14)';
      blocks.push(`${selector}.webd-motion-${id} { transition: transform ${duration}s ${easing}, box-shadow ${duration}s ${easing}; }`);
      blocks.push(`${selector}.webd-motion-${id}:hover { transform: ${hover}; box-shadow: ${shadow}; }`);
    }
    if (rule.config.loop !== 'none') {
      const animation = rule.config.loop === 'float' ? 'webd-preset-float' : rule.config.loop === 'pulse-soft' ? 'webd-preset-pulse' : rule.config.loop === 'wave' ? 'webd-preset-wave' : 'webd-preset-glow';
      blocks.push(`${selector}.webd-motion-${id} { animation: ${animation} ${Math.max(1.2, duration * 3.5)}s ease-in-out infinite; }`);
    }
    return blocks.join('\n');
  }).join('\n');
  const startMarker = '/* WEBD_GLOBAL_MOTION_START */';
  const endMarker = '/* WEBD_GLOBAL_MOTION_END */';
  const existing = next[cssPath] || '';
  const markerStart = existing.indexOf(startMarker);
  const markerEnd = existing.indexOf(endMarker);
  const without = markerStart >= 0 && markerEnd > markerStart ? existing.slice(0, markerStart) + existing.slice(markerEnd + endMarker.length) : existing;
  const keyframes = `
@keyframes webd-preset-float { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-9px) } }
@keyframes webd-preset-pulse { 0%,100% { transform: scale(1) } 50% { transform: scale(1.035) } }
@keyframes webd-preset-wave { 0%,100% { transform: translateY(0) rotate(0) } 50% { transform: translateY(-5px) rotate(1deg) } }
@keyframes webd-preset-glow { 0%,100% { filter: drop-shadow(0 0 0 transparent) } 50% { filter: drop-shadow(0 0 14px rgba(139,92,246,.36)) } }`;
  const reduced = preset.settings.respectReducedMotion ? `@media (prefers-reduced-motion: reduce) { ${safeRules.map((rule) => `${rule.target === '*' ? '[data-webd-motion]' : rule.target}.webd-motion-${rule.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60)}`).join(', ')} { transition: none !important; animation: none !important; transform: none !important; filter: none !important; opacity: 1 !important; } }` : '';
  const outputBlock = `\n\n${startMarker}\n/* Preset: ${preset.name.replace(/[\*\/]/g, '')} */\n${keyframes}\n${css}\n${reduced}\n${endMarker}\n`;
  next[cssPath] = without + outputBlock;

  // Attach stable classes to matching JSX/HTML tags. Imported preset data is schema-validated; no code is executed.
  for (const [filePath, source] of Object.entries(next)) {
    if (!/\.(tsx|jsx|html)$/i.test(filePath)) continue;
    let updated = source;
    for (const rule of safeRules) {
      const id = rule.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 60);
      const tag = rule.target;
      if (tag === '*') continue;
      const matcher = new RegExp(`(<${tag}(?=[\\\\s/>])[^>]*?)(\\\\s*/?>)`, 'gi');
      updated = updated.replace(matcher, (match, before: string, close: string) => {
        const existingClass = before.match(/\\bclassName?=(["'])(.*?)\\1/i);
        if (existingClass) {
          if (existingClass[2].split(/\\s+/).includes(`webd-motion-${id}`)) return match;
          const nextClass = `${existingClass[2]} webd-motion-${id}`;
          return before.replace(existingClass[0], `className=${existingClass[1]}${nextClass}${existingClass[1]}`) + close;
        }
        return `${before} className="webd-motion-${id}"${close}`;
      });;
    }
    next[filePath] = updated;
  }

  return next;
}
