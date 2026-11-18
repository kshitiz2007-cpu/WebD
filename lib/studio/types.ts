export type ProjectFramework = 'nextjs-app' | 'nextjs-pages' | 'react-vite' | 'html';

export interface ProjectPage {
  route: string;
  title: string;
  filePath: string;
}

export interface VirtualProject {
  id: string;
  name: string;
  framework: ProjectFramework;
  files: Record<string, string>;
  originalFiles: Record<string, string>;
  pages: ProjectPage[];
  globalCssPaths: string[];
  sourceLabel: string;
}

export interface GradientStop {
  color: string;
  position: number;
}

export interface GradientConfig {
  type: 'solid' | 'linear' | 'radial';
  angle: number;
  stopCount: 2 | 3 | 4;
  stops: GradientStop[];
  target: 'background' | 'text';
}

export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StudioElementSnapshot {
  studioId: string;
  instanceStudioId?: string;
  filePath: string;
  elementIndex: number;
  tagName: string;
  label: string;
  textContent: string;
  isTextEditable: boolean;
  className: string;
  inlineStyles: Record<string, string>;
  computedStyles: Record<string, string>;
  rect: ElementRect;
  parentStudioId: string | null;
  parentRect?: ElementRect | null;
  siblingRects?: ElementRect[];
  viewportSize?: { width: number; height: number };
  siblingIndex: number;
  siblingCount: number;
  canReorderSiblings: boolean;
  href?: string;
  src?: string;
}

export interface LayerTreeNode {
  studioId: string;
  filePath: string;
  elementIndex: number;
  tagName: string;
  label: string;
  children: LayerTreeNode[];
}

export type ViewportPreset = 'desktop' | 'tablet' | 'mobile';
export type CanvasInteractionMode = 'design' | 'interact';

export interface ElementSourcePatch {
  textContent?: string;
  styles?: Record<string, string | null>;
  className?: string;
  href?: string;
  src?: string;
}

export interface StudioDraft {
  id: string;
  title: string;
  projectName: string;
  sourceLabel: string;
  activeRoute: string;
  viewport: ViewportPreset;
  savedAt: string;
  modifiedFileCount: number;
  files: Record<string, string>;
  originalFiles: Record<string, string>;
}

