export type ScrollRevealPreset =
  | 'none'
  | 'fade-up'
  | 'fade-down'
  | 'fade-left'
  | 'fade-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'blur-up'
  | 'flip-up';

export type HoverInteractionPreset =
  | 'none'
  | 'lift'
  | 'scale-pop'
  | 'glow-ring'
  | 'press-tap'
  | 'tilt-soft'
  | 'border-shimmer';

export type AmbientLoopPreset =
  | 'none'
  | 'float'
  | 'pulse-soft'
  | 'glow-pulse'
  | 'wave';

export type AnimationEasing =
  | 'smooth'
  | 'spring'
  | 'snappy'
  | 'linear';

export interface ElementAnimationConfig {
  reveal: ScrollRevealPreset;
  hover: HoverInteractionPreset;
  loop: AmbientLoopPreset;
  duration: number; // seconds, 0.15..3
  delay: number; // seconds, 0..2
  easing: AnimationEasing;
  staggerChildren: boolean;
  staggerStepMs: number; // 40..250
  once: boolean;
  customCss?: string;
  customClass?: string;
}

export const DEFAULT_ANIMATION_CONFIG: ElementAnimationConfig = {
  reveal: 'none',
  hover: 'none',
  loop: 'none',
  duration: 0.65,
  delay: 0,
  easing: 'smooth',
  staggerChildren: false,
  staggerStepMs: 80,
  once: true,
};

export interface AnimationPresetOption<T extends string> {
  id: T;
  label: string;
  hint: string;
}

export const SCROLL_REVEAL_PRESETS: AnimationPresetOption<ScrollRevealPreset>[] = [
  { id: 'none', label: 'None', hint: 'No scroll entrance' },
  { id: 'fade-up', label: 'Fade Up', hint: 'Rise smoothly into view' },
  { id: 'fade-down', label: 'Fade Down', hint: 'Drop softly from above' },
  { id: 'fade-left', label: 'Slide Left', hint: 'Glide in from right' },
  { id: 'fade-right', label: 'Slide Right', hint: 'Glide in from left' },
  { id: 'zoom-in', label: 'Zoom In', hint: 'Scale up gently' },
  { id: 'zoom-out', label: 'Zoom Out', hint: 'Settle down from larger' },
  { id: 'blur-up', label: 'Blur Reveal', hint: 'Focus + lift cinema reveal' },
  { id: 'flip-up', label: '3D Flip Up', hint: 'Perspective tilt entrance' },
];

export const HOVER_INTERACTION_PRESETS: AnimationPresetOption<HoverInteractionPreset>[] = [
  { id: 'none', label: 'None', hint: 'Default static hover' },
  { id: 'lift', label: 'Lift & Shadow', hint: 'Elevate card on hover' },
  { id: 'scale-pop', label: 'Scale Pop', hint: 'Subtle tactile zoom' },
  { id: 'glow-ring', label: 'Glow Ring', hint: 'Indigo ambient halo' },
  { id: 'press-tap', label: 'Tactile Tap', hint: 'Soft lift + click press' },
  { id: 'tilt-soft', label: 'Micro Tilt', hint: 'Playful 1.5° hover tilt' },
  { id: 'border-shimmer', label: 'Brighten Surface', hint: 'Crisp brightness & lift' },
];

export const AMBIENT_LOOP_PRESETS: AnimationPresetOption<AmbientLoopPreset>[] = [
  { id: 'none', label: 'None', hint: 'No ambient motion' },
  { id: 'float', label: 'Gentle Float', hint: 'Slow vertical hover loop' },
  { id: 'pulse-soft', label: 'Soft Pulse', hint: 'Subtle breathing scale' },
  { id: 'glow-pulse', label: 'Glow Pulse', hint: 'Soft ambient halo pulse' },
  { id: 'wave', label: 'Gentle Wave', hint: 'Micro floating sway' },
];

export const EASING_CURVES: Record<AnimationEasing, { label: string; css: string }> = {
  smooth: { label: 'Smooth Out', css: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  spring: { label: 'Spring Pop', css: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  snappy: { label: 'Snappy UI', css: 'cubic-bezier(0.16, 1, 0.3, 1)' },
  linear: { label: 'Linear', css: 'linear' },
};

export const WEBD_MOTION_CSS_START = '/* WEBD_MOTION_STYLES_START */';
export const WEBD_MOTION_CSS_END = '/* WEBD_MOTION_STYLES_END */';

const ANIM_CLASS_REGEX = /^(?:webd-reveal|webd-reveal-[a-z-]+|webd-reveal-repeat|webd-hover-[a-z-]+|webd-loop-[a-z-]+|webd-stagger-children|webd-in-view)$/;

export function stripAnimationClasses(className: string): string {
  return className
    .split(/\s+/)
    .filter((token) => token && !ANIM_CLASS_REGEX.test(token))
    .join(' ');
}

export function buildAnimationClassesAndStyles(
  existingClassName: string,
  config: ElementAnimationConfig
): {
  className: string;
  styles: Record<string, string | null>;
  hasAnimation: boolean;
} {
  const baseClasses = stripAnimationClasses(existingClassName);
  const addedClasses: string[] = [];
  const styles: Record<string, string | null> = {};

  const duration = Math.max(0.15, Math.min(3, Number(config.duration) || 0.65));
  const delay = Math.max(0, Math.min(2.5, Number(config.delay) || 0));
  const easeCss = EASING_CURVES[config.easing]?.css || EASING_CURVES.smooth.css;
  const staggerMs = Math.max(40, Math.min(300, Math.round(Number(config.staggerStepMs) || 80)));

  if (config.reveal !== 'none') {
    addedClasses.push('webd-reveal', `webd-reveal-${config.reveal}`);
    if (!config.once) {
      addedClasses.push('webd-reveal-repeat');
    }
    styles['--webd-anim-duration'] = `${duration.toFixed(2)}s`;
    styles['--webd-anim-delay'] = `${delay.toFixed(2)}s`;
    styles['--webd-anim-ease'] = easeCss;
  } else {
    styles['--webd-anim-duration'] = null;
    styles['--webd-anim-delay'] = null;
    styles['--webd-anim-ease'] = null;
  }

  if (config.staggerChildren && config.reveal !== 'none') {
    addedClasses.push('webd-stagger-children');
    styles['--webd-stagger-step'] = `${staggerMs}ms`;
  } else {
    styles['--webd-stagger-step'] = null;
  }

  if (config.hover !== 'none') {
    addedClasses.push(`webd-hover-${config.hover}`);
  }

  if (config.loop !== 'none') {
    addedClasses.push(`webd-loop-${config.loop}`);
    styles['--webd-loop-duration'] = `${Math.max(1.2, duration * 3.5).toFixed(2)}s`;
  } else {
    styles['--webd-loop-duration'] = null;
  }
  if (config.customClass && config.customCss) addedClasses.push(config.customClass);

  const combined = [baseClasses, ...addedClasses].filter(Boolean).join(' ').trim();
  if (config.customClass && config.customCss) addedClasses.push(config.customClass);
  const hasAnimation = addedClasses.length > 0;

  return { className: combined, styles, hasAnimation };
}

export function parseAnimationConfigFromElement(
  className: string,
  inlineStyles: Record<string, string>
): ElementAnimationConfig {
  const tokens = (className || '').split(/\s+/).filter(Boolean);
  let reveal: ScrollRevealPreset = 'none';
  let hover: HoverInteractionPreset = 'none';
  let loop: AmbientLoopPreset = 'none';
  let staggerChildren = false;
  let once = true;

  for (const token of tokens) {
    if (token === 'webd-stagger-children') {
      staggerChildren = true;
    } else if (token === 'webd-reveal-repeat') {
      once = false;
    } else if (token.startsWith('webd-reveal-')) {
      const candidate = token.slice('webd-reveal-'.length) as ScrollRevealPreset;
      if (SCROLL_REVEAL_PRESETS.some((p) => p.id === candidate)) {
        reveal = candidate;
      }
    } else if (token.startsWith('webd-hover-')) {
      const candidate = token.slice('webd-hover-'.length) as HoverInteractionPreset;
      if (HOVER_INTERACTION_PRESETS.some((p) => p.id === candidate)) {
        hover = candidate;
      }
    } else if (token.startsWith('webd-loop-')) {
      const candidate = token.slice('webd-loop-'.length) as AmbientLoopPreset;
      if (AMBIENT_LOOP_PRESETS.some((p) => p.id === candidate)) {
        loop = candidate;
      }
    }
  }

  const rawDuration = inlineStyles['--webd-anim-duration'];
  const rawDelay = inlineStyles['--webd-anim-delay'];
  const rawEase = inlineStyles['--webd-anim-ease'];
  const rawStagger = inlineStyles['--webd-stagger-step'];

  const duration = rawDuration ? parseFloat(rawDuration) || 0.65 : 0.65;
  const delay = rawDelay ? parseFloat(rawDelay) || 0 : 0;
  const staggerStepMs = rawStagger ? parseInt(rawStagger, 10) || 80 : 80;

  let easing: AnimationEasing = 'smooth';
  if (rawEase) {
    const matched = (Object.entries(EASING_CURVES) as Array<[AnimationEasing, { css: string }]>).find(
      ([, v]) => v.css === rawEase.trim()
    );
    if (matched) easing = matched[0];
  }

  return {
    reveal,
    hover,
    loop,
    duration,
    delay,
    easing,
    staggerChildren,
    staggerStepMs,
    once,
  };
}

export function buildMotionStylesheetBlock(): string {
  return `${WEBD_MOTION_CSS_START}
/* Scroll-Reveal & Micro-Interaction Studio Styles */
.webd-reveal {
  opacity: 0;
  will-change: transform, opacity, filter;
  transition-property: opacity, transform, filter;
  transition-duration: var(--webd-anim-duration, 0.65s);
  transition-timing-function: var(--webd-anim-ease, cubic-bezier(0.22, 1, 0.36, 1));
  transition-delay: var(--webd-anim-delay, 0s);
}
.webd-reveal-fade-up { transform: translate3d(0, 28px, 0); }
.webd-reveal-fade-down { transform: translate3d(0, -28px, 0); }
.webd-reveal-fade-left { transform: translate3d(34px, 0, 0); }
.webd-reveal-fade-right { transform: translate3d(-34px, 0, 0); }
.webd-reveal-zoom-in { transform: scale(0.92); }
.webd-reveal-zoom-out { transform: scale(1.08); }
.webd-reveal-blur-up { transform: translate3d(0, 22px, 0); filter: blur(10px); }
.webd-reveal-flip-up { transform: perspective(900px) rotateX(16deg) translate3d(0, 24px, 0); transform-origin: 50% 100%; }

.webd-reveal.webd-in-view {
  opacity: 1;
  transform: none;
  filter: blur(0px);
}

/* Staggered child reveals when enabled on a container */
.webd-stagger-children > * {
  opacity: 0;
  transform: translate3d(0, 18px, 0);
  transition-property: opacity, transform;
  transition-duration: var(--webd-anim-duration, 0.6s);
  transition-timing-function: var(--webd-anim-ease, cubic-bezier(0.22, 1, 0.36, 1));
}
.webd-stagger-children.webd-in-view > * {
  opacity: 1;
  transform: none;
}
.webd-stagger-children.webd-in-view > *:nth-child(1) { transition-delay: calc(var(--webd-anim-delay, 0s) + var(--webd-stagger-step, 80ms) * 0); }
.webd-stagger-children.webd-in-view > *:nth-child(2) { transition-delay: calc(var(--webd-anim-delay, 0s) + var(--webd-stagger-step, 80ms) * 1); }
.webd-stagger-children.webd-in-view > *:nth-child(3) { transition-delay: calc(var(--webd-anim-delay, 0s) + var(--webd-stagger-step, 80ms) * 2); }
.webd-stagger-children.webd-in-view > *:nth-child(4) { transition-delay: calc(var(--webd-anim-delay, 0s) + var(--webd-stagger-step, 80ms) * 3); }
.webd-stagger-children.webd-in-view > *:nth-child(5) { transition-delay: calc(var(--webd-anim-delay, 0s) + var(--webd-stagger-step, 80ms) * 4); }
.webd-stagger-children.webd-in-view > *:nth-child(6) { transition-delay: calc(var(--webd-anim-delay, 0s) + var(--webd-stagger-step, 80ms) * 5); }
.webd-stagger-children.webd-in-view > *:nth-child(n+7) { transition-delay: calc(var(--webd-anim-delay, 0s) + var(--webd-stagger-step, 80ms) * 6); }

/* Hover & Tap Micro-Interactions */
.webd-hover-lift,
.webd-hover-scale-pop,
.webd-hover-glow-ring,
.webd-hover-press-tap,
.webd-hover-tilt-soft,
.webd-hover-border-shimmer {
  transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 220ms ease, filter 220ms ease, border-color 220ms ease;
}
.webd-hover-lift:hover {
  transform: translateY(-5px);
  box-shadow: 0 18px 34px -14px rgba(15, 23, 42, 0.24);
}
.webd-hover-scale-pop:hover {
  transform: scale(1.03);
}
.webd-hover-glow-ring:hover {
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.35), 0 14px 28px -10px rgba(79, 70, 229, 0.32);
}
.webd-hover-press-tap:hover {
  transform: translateY(-2px) scale(1.015);
}
.webd-hover-press-tap:active {
  transform: translateY(1px) scale(0.97);
}
.webd-hover-tilt-soft:hover {
  transform: translateY(-3px) rotate(-1.5deg);
}
.webd-hover-border-shimmer:hover {
  transform: translateY(-2px);
  filter: brightness(1.06);
}

/* Continuous Ambient Loops */
@keyframes webd-kf-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}
@keyframes webd-kf-pulse-soft {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}
@keyframes webd-kf-glow-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.15); }
  50% { box-shadow: 0 0 24px 4px rgba(99, 102, 241, 0.4); }
}
@keyframes webd-kf-wave {
  0%, 100% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-3px) rotate(-1deg); }
  75% { transform: translateY(3px) rotate(1deg); }
}
.webd-loop-float { animation: webd-kf-float var(--webd-loop-duration, 3.2s) ease-in-out infinite; }
.webd-loop-pulse-soft { animation: webd-kf-pulse-soft var(--webd-loop-duration, 2.8s) ease-in-out infinite; }
.webd-loop-glow-pulse { animation: webd-kf-glow-pulse var(--webd-loop-duration, 2.6s) ease-in-out infinite; }
.webd-loop-wave { animation: webd-kf-wave var(--webd-loop-duration, 3.4s) ease-in-out infinite; }

@media (prefers-reduced-motion: reduce) {
  .webd-reveal,
  .webd-stagger-children > * {
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
    transition: none !important;
  }
  .webd-loop-float,
  .webd-loop-pulse-soft,
  .webd-loop-glow-pulse,
  .webd-loop-wave {
    animation: none !important;
  }
}
${WEBD_MOTION_CSS_END}`;
}

export function mergeMotionCssIntoGlobalCss(existingCss: string): string {
  const block = buildMotionStylesheetBlock();
  const startIdx = existingCss.indexOf(WEBD_MOTION_CSS_START);
  const endIdx = existingCss.indexOf(WEBD_MOTION_CSS_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return (
      existingCss.slice(0, startIdx) +
      block +
      existingCss.slice(endIdx + WEBD_MOTION_CSS_END.length)
    );
  }
  const trimmed = existingCss.trimEnd();
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

export function countAnimatedElementsInFiles(files: Record<string, string>): {
  revealCount: number;
  hoverCount: number;
  loopCount: number;
  total: number;
} {
  let revealCount = 0;
  let hoverCount = 0;
  let loopCount = 0;
  for (const [path, content] of Object.entries(files)) {
    if (!/\.(tsx|jsx|html|htm)$/i.test(path)) continue;
    revealCount += (content.match(/(?:^|[\s"'`])webd-reveal(?=[\s"'`]|$)/g) || []).length;
    hoverCount += (content.match(/(?:^|[\s"'`])webd-hover-[a-z-]+(?=[\s"'`]|$)/g) || []).length;
    loopCount += (content.match(/(?:^|[\s"'`])webd-loop-[a-z-]+(?=[\s"'`]|$)/g) || []).length;
  }
  return {
    revealCount,
    hoverCount,
    loopCount,
    total: revealCount + hoverCount + loopCount,
  };
}
