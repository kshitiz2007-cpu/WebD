import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGradientCss,
  generateElementGradientCss,
  isFullHexInput,
  parseGradientCss,
  resizeGradientStops,
  normalizeHex,
} from './gradient';
import {
  deleteCustomGradientPreset,
  listCustomGradientPresets,
  loadLastGradientConfig,
  saveCustomGradientPreset,
  saveLastGradientConfig,
} from './gradient-persistence';
import { normalizeProjectFiles, scanProjectStructure } from './project-scanner';
import {
  scanElements,
  instrumentSourceWithStudioIds,
  applyElementPatchToSource,
  moveElementSiblingInSource,
  duplicateElementInSource,
  deleteElementInSource,
} from './source-editor';
import {
  createDraftSnapshot,
  deleteDraftFromStorage,
  listSavedDrafts,
  loadAutosaveProgress,
  restoreProjectFromDraft,
  saveAutosaveProgress,
  saveDraftToStorage,
  StorageLike,
} from './draft-storage';
import { createProjectFromFiles, STARTER_NEXTJS_FILES } from './sample-project';

test('normalizeHex handles 3-char, 6-char, unprefixed, and rgb strings', () => {
  assert.equal(normalizeHex('#abc'), '#AABBCC');
  assert.equal(normalizeHex('0f172a'), '#0F172A');
  assert.equal(normalizeHex('rgb(37, 99, 235)'), '#2563EB');
});

test('buildGradientCss and parseGradientCss round-trip 3-stop and 4-stop linear gradients', () => {
  const css3 = buildGradientCss({
    type: 'linear',
    angle: 135,
    stopCount: 3,
    stops: [
      { color: '#0F172A', position: 0 },
      { color: '#1D4ED8', position: 50 },
      { color: '#38BDF8', position: 100 },
    ],
    target: 'background',
  });
  assert.equal(css3, 'linear-gradient(135deg, #0F172A 0%, #1D4ED8 50%, #38BDF8 100%)');

  const parsed3 = parseGradientCss(css3);
  assert.equal(parsed3.type, 'linear');
  assert.equal(parsed3.stopCount, 3);
  assert.equal(parsed3.angle, 135);
  assert.equal(parsed3.stops[1].color, '#1D4ED8');

  const css4 = buildGradientCss({
    type: 'linear',
    angle: 90,
    stopCount: 4,
    stops: [
      { color: '#0F172A', position: 0 },
      { color: '#1E3A8A', position: 33 },
      { color: '#0284C7', position: 67 },
      { color: '#BAE6FD', position: 100 },
    ],
    target: 'text',
  });
  assert.equal(
    css4,
    'linear-gradient(90deg, #0F172A 0%, #1E3A8A 33%, #0284C7 67%, #BAE6FD 100%)'
  );
  const parsed4 = parseGradientCss(css4, undefined, undefined, 'text');
  assert.equal(parsed4.stopCount, 4);
  assert.equal(parsed4.target, 'text');
  assert.equal(parsed4.stops[3].color, '#BAE6FD');
});

test('generateElementGradientCss formats rule, declarations, and Tailwind snippets for 3-stop and 4-stop gradients', () => {
  const cfg3 = {
    type: 'linear' as const,
    angle: 135,
    stopCount: 3 as const,
    stops: [
      { color: '#0F172A', position: 0 },
      { color: '#1D4ED8', position: 50 },
      { color: '#38BDF8', position: 100 },
    ],
    target: 'background' as const,
  };
  assert.equal(
    generateElementGradientCss(cfg3, { selector: 'section.hero', format: 'rule' }),
    'section.hero {\n  background-image: linear-gradient(135deg, #0F172A 0%, #1D4ED8 50%, #38BDF8 100%);\n}'
  );

  const cfg4Text = {
    type: 'linear' as const,
    angle: 90,
    stopCount: 4 as const,
    stops: [
      { color: '#1E1B4B', position: 0 },
      { color: '#4338CA', position: 34 },
      { color: '#6366F1', position: 68 },
      { color: '#C7D2FE', position: 100 },
    ],
    target: 'text' as const,
  };
  const decl = generateElementGradientCss(cfg4Text, { format: 'declarations' });
  assert.ok(decl.includes('background-image: linear-gradient(90deg, #1E1B4B 0%, #4338CA 34%, #6366F1 68%, #C7D2FE 100%);'));
  assert.ok(decl.includes('-webkit-background-clip: text;'));
  assert.ok(decl.includes('-webkit-text-fill-color: transparent;'));

  const tw = generateElementGradientCss(cfg4Text, { format: 'tailwind' });
  assert.ok(tw.startsWith('bg-[linear-gradient(90deg,_#1E1B4B_0%,_#4338CA_34%,_#6366F1_68%,_#C7D2FE_100%)]'));
  assert.ok(tw.includes('bg-clip-text text-transparent'));
});

test('resizeGradientStops expands 2 stops to 4 stops cleanly', () => {
  const next = resizeGradientStops(
    [
      { color: '#111827', position: 0 },
      { color: '#2563EB', position: 100 },
    ],
    4
  );
  assert.equal(next.length, 4);
  assert.equal(next[0].color, '#111827');
  assert.equal(next[0].position, 0);
  assert.equal(next[3].position, 100);
});

test('normalizeProjectFiles strips common archive wrapper folder and ignores node_modules', () => {
  const normalized = normalizeProjectFiles({
    'Civil-recovery-original-full-app/package.json': '{"name":"civilprep-glass"}',
    'Civil-recovery-original-full-app/app/page.tsx': 'export default function Home(){return <div/>}',
    'Civil-recovery-original-full-app/app/dashboard/page.tsx': 'export default function Dash(){return <div/>}',
    'Civil-recovery-original-full-app/node_modules/foo/index.js': 'bad',
  });
  assert.ok(normalized['package.json']);
  assert.ok(normalized['app/page.tsx']);
  assert.equal(normalized['node_modules/foo/index.js'], undefined);

  const scanned = scanProjectStructure(normalized);
  assert.equal(scanned.framework, 'nextjs-app');
  assert.equal(scanned.projectName, 'civilprep-glass');
  assert.equal(scanned.pages.length, 2);
  assert.equal(scanned.pages[0].route, '/');
  assert.equal(scanned.pages[1].route, '/dashboard');
});

test('source-editor scans JSX with generics, apostrophes, and patches styles + text + sibling order', () => {
  const tsx = `
import React, { useState } from 'react';
export default function Page() {
  const [items, setItems] = useState<string[]>(['a']);
  return (
    <main className="p-8">
      <h1 className="text-3xl">It's Studio Ready</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="card">First Card</div>
        <div className="card">Second Card</div>
        <div className="card">Third Card</div>
      </div>
    </main>
  );
}`;
  const els = scanElements(tsx, false);
  // 0: main, 1: h1, 2: div.grid, 3: First, 4: Second, 5: Third
  assert.equal(els.length, 6);
  assert.equal(els[0].tagName, 'main');
  assert.equal(els[1].tagName, 'h1');
  assert.equal(els[2].childIndices.length, 3);

  const instrumented = instrumentSourceWithStudioIds(tsx, 'app/page.tsx', false);
  assert.ok(instrumented.includes('data-studio-id="app/page.tsx::0"'));
  assert.ok(instrumented.includes('data-studio-id="app/page.tsx::5"'));

  const patched = applyElementPatchToSource(tsx, 1, false, {
    textContent: 'Refined Headline',
    styles: {
      backgroundImage: 'linear-gradient(135deg, #0F172A 0%, #1D4ED8 50%, #38BDF8 100%)',
      paddingTop: '16px',
    },
  });
  assert.ok(patched.includes('>Refined Headline</h1>'));
  assert.ok(patched.includes("backgroundImage: 'linear-gradient(135deg, #0F172A 0%, #1D4ED8 50%, #38BDF8 100%)'"));
  assert.ok(patched.includes("paddingTop: '16px'"));

  // Move First Card (elementIndex 3) to position 2 (after Third Card)
  const reordered = moveElementSiblingInSource(tsx, 3, 2, false);
  const idxFirst = reordered.indexOf('First Card');
  const idxSecond = reordered.indexOf('Second Card');
  const idxThird = reordered.indexOf('Third Card');
  assert.ok(idxSecond < idxThird && idxThird < idxFirst);

  const duped = duplicateElementInSource(tsx, 3, false);
  assert.equal(duped.split('First Card').length - 1, 2);

  const deleted = deleteElementInSource(tsx, 4, false);
  assert.equal(deleted.includes('Second Card'), false);
});

test('source-editor patches HTML files cleanly', () => {
  const html = `<!doctype html><html><body><section class="hero"><h1>Hello</h1></section></body></html>`;
  const els = scanElements(html, true);
  const h1 = els.find((e) => e.tagName === 'h1')!;
  const patched = applyElementPatchToSource(html, h1.index, true, {
    textContent: 'Updated Title',
    styles: { color: '#2563EB', fontSize: '48px' },
  });
  assert.ok(patched.includes('style="color: #2563EB; font-size: 48px"'));
  assert.ok(patched.includes('>Updated Title</h1>'));
});

test('draft-storage saves, lists, deletes, autosaves, and restores modified VirtualProject state', () => {
  const mem = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };

  const baseProject = createProjectFromFiles(STARTER_NEXTJS_FILES, 'Starter', 'verve-structural-site');
  const editedProject = {
    ...baseProject,
    files: {
      ...baseProject.files,
      'app/page.tsx': baseProject.files['app/page.tsx'].replace(
        'Precision Load Analysis',
        'Saved Draft Heading'
      ),
    },
  };

  const draft = createDraftSnapshot({
    project: editedProject,
    activeRoute: '/pricing',
    viewport: 'tablet',
    title: 'Hero Typography Pass',
  });
  assert.equal(draft.modifiedFileCount, 1);

  const saveRes = saveDraftToStorage(draft, mockStorage);
  assert.equal(saveRes.ok, true);
  assert.equal(listSavedDrafts(mockStorage).length, 1);

  assert.equal(saveAutosaveProgress(draft, mockStorage), true);
  const auto = loadAutosaveProgress(mockStorage);
  assert.equal(auto?.title, 'Hero Typography Pass');

  const restored = restoreProjectFromDraft(listSavedDrafts(mockStorage)[0]);
  assert.ok(restored.files['app/page.tsx'].includes('Saved Draft Heading'));
  assert.ok(restored.originalFiles['app/page.tsx'].includes('Precision Load Analysis'));
  assert.equal(restored.pages.length >= 3, true);

  const afterDelete = deleteDraftFromStorage(draft.id, mockStorage);
  assert.equal(afterDelete.length, 0);
});

test('gradient-persistence saves and reloads custom multi-stop hex config and presets', () => {
  const mem = new Map<string, string>();
  const mockStorage: StorageLike = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => {
      mem.set(k, v);
    },
    removeItem: (k) => {
      mem.delete(k);
    },
  };

  assert.equal(isFullHexInput('#FF5500'), true);
  assert.equal(isFullHexInput('#FF5'), false);

  const customCfg = {
    type: 'linear' as const,
    angle: 125,
    stopCount: 4 as const,
    stops: [
      { color: '#FF5500', position: 0 },
      { color: '#E11D48', position: 35 },
      { color: '#7C3AED', position: 70 },
      { color: '#0EA5E9', position: 100 },
    ],
    target: 'background' as const,
  };

  assert.equal(saveLastGradientConfig(customCfg, mockStorage), true);
  const reloaded = loadLastGradientConfig(mockStorage);
  assert.equal(reloaded?.stopCount, 4);
  assert.equal(reloaded?.stops[0].color, '#FF5500');
  assert.equal(reloaded?.stops[2].color, '#7C3AED');

  const presets = saveCustomGradientPreset(customCfg, 'Brand Sunset', mockStorage);
  assert.equal(presets.length, 1);
  assert.equal(presets[0].name, 'Brand Sunset');
  assert.equal(listCustomGradientPresets(mockStorage).length, 1);

  const remaining = deleteCustomGradientPreset(presets[0].id, mockStorage);
  assert.equal(remaining.length, 0);
});

import {
  boxShadowToElevationHint,
  clampBorderWidth,
  clampCornerRadius,
  clampElevationLevel,
  clampOpacityPercent,
  elevationLevelToBoxShadow,
  matchShadowPresetLabel,
} from './border-elevation';

test('border-elevation clamps numeric inputs and converts elevation levels cleanly', () => {
  assert.equal(clampCornerRadius(''), null);
  assert.equal(clampCornerRadius('24'), 24);
  assert.equal(clampCornerRadius('999'), 200);
  assert.equal(clampCornerRadius('-5'), 0);

  assert.equal(clampBorderWidth('2'), 2);
  assert.equal(clampBorderWidth('50'), 24);

  assert.equal(clampOpacityPercent(''), null);
  assert.equal(clampOpacityPercent('75'), 75);
  assert.equal(clampOpacityPercent('140'), 100);
  assert.equal(clampOpacityPercent('-10'), 0);

  assert.equal(clampElevationLevel('12'), 12);
  assert.equal(elevationLevelToBoxShadow(0), 'none');
  const shadow10 = elevationLevelToBoxShadow(10);
  assert.equal(shadow10, '0 10px 25px -3px rgba(15,23,42,0.16)');
  assert.equal(boxShadowToElevationHint(shadow10), 10);

  assert.equal(matchShadowPresetLabel('0 10px 25px -5px rgba(15,23,42,0.12)'), 'Card');
  assert.equal(
    matchShadowPresetLabel(undefined, 'rgba(15, 23, 42, 0.08) 0px 2px 8px 0px'),
    'Soft'
  );
  assert.equal(matchShadowPresetLabel(undefined, 'none'), 'None');
});

import { computeDragSnap, computeResizeSnap } from './alignment-snapping';
import {
  applyHorizontalConstraintPatch,
  applySizeConstraintMode,
  applyVerticalConstraintPatch,
  buildResizeContainmentStyles,
  detectConstraintState,
  parseGridColumnCount,
} from './layout-constraints';
import {
  createComponentFileTemplate,
  extractSelectionToComponent,
  patchJsxPropInSource,
  scanComponentUsagesInFile,
  scanProjectComponents,
} from './component-editor';

test('alignment-snapping snaps drag offsets and resize edges to nearby targets and emits guides', () => {
  const candidates = [
    { x: 100, y: 50, width: 200, height: 100, kind: 'sibling' as const },
    { x: 0, y: 0, width: 800, height: 600, kind: 'parent' as const },
  ];
  // Drag originRect (x=50, y=54, w=200, h=100) by rawDx=47 -> movingX=97 (within 6px of 100), rawDy=0 -> y=54 (within 6px of 50)
  const drag = computeDragSnap({
    originRect: { x: 50, y: 54, width: 200, height: 100 },
    rawOffsetX: 47,
    rawOffsetY: 0,
    candidates,
    threshold: 6,
  });
  assert.equal(drag.snappedX, 50); // 50 + 50 = 100
  assert.equal(drag.snappedY, -4); // 54 - 4 = 50
  assert.equal(drag.guides.length, 2);

  // Resize east edge from x=100, width=196 -> rightEdge=296, within 6px of candidate rightEdge=300
  const resize = computeResizeSnap({
    initRect: { x: 100, y: 50, width: 196, height: 100 },
    dir: 'e',
    rawDx: 0,
    rawDy: 0,
    candidates,
    threshold: 6,
  });
  assert.equal(resize.width, 200);
  assert.equal(resize.guides[0].orientation, 'vertical');
  assert.equal(resize.guides[0].position, 300);
});

test('layout-constraints detects constraints, computes pin patches, and parses grid columns', () => {
  const patchCenter = applyHorizontalConstraintPatch(
    'center',
    { x: 100, y: 40, width: 200, height: 80 },
    { x: 0, y: 0, width: 800, height: 400 },
    'static'
  );
  assert.equal(patchCenter.left, '50%');
  assert.equal(patchCenter.transform, 'translateX(-50%)');

  const patchBottom = applyVerticalConstraintPatch(
    'bottom',
    { x: 100, y: 280, width: 200, height: 80 },
    { x: 0, y: 0, width: 800, height: 400 },
    'relative'
  );
  assert.equal(patchBottom.bottom, '40px');
  assert.equal(patchBottom.top, null);

  const detected = detectConstraintState(
    { left: '12px', right: '12px', top: '50%', transform: 'translateY(-50%)' },
    {}
  );
  assert.equal(detected.horizontal, 'left-right');
  assert.equal(detected.vertical, 'center');

  assert.deepEqual(applySizeConstraintMode('width', 'fill', 300), { width: '100%' });
  assert.deepEqual(applySizeConstraintMode('height', 'hug', 120), { height: 'auto' });
  assert.equal(parseGridColumnCount('repeat(3, minmax(0, 1fr))'), 3);
  assert.equal(parseGridColumnCount('100px 200px 1fr 1fr'), 4);
});

test('component-editor scans project components, patches instance props, and extracts selections', () => {
  const comps = scanProjectComponents(STARTER_NEXTJS_FILES);
  assert.equal(comps.length, 1);
  assert.equal(comps[0].name, 'Navbar');
  assert.equal(comps[0].usageCount, 3);
  assert.equal(comps[0].props[0].name, 'active');

  const usages = scanComponentUsagesInFile(
    STARTER_NEXTJS_FILES['app/page.tsx'],
    'app/page.tsx',
    ['Navbar']
  );
  assert.equal(usages.length, 1);
  assert.equal(usages[0].props.active, '/');

  const patchedPage = patchJsxPropInSource(
    STARTER_NEXTJS_FILES['app/page.tsx'],
    usages[0].elementIndex,
    'active',
    '/pricing'
  );
  assert.ok(patchedPage.includes('<Navbar active="/pricing" />'));

  const created = createComponentFileTemplate('Alert Banner');
  assert.equal(created.filePath, 'components/AlertBanner.tsx');
  assert.ok(created.code.includes('export default function AlertBanner'));

  const extracted = extractSelectionToComponent({
    pageCode: STARTER_NEXTJS_FILES['app/page.tsx'],
    pagePath: 'app/page.tsx',
    elementIndex: 2, // <section ...> hero in app/page.tsx
    rawComponentName: 'HeroBanner',
  });
  assert.ok(extracted !== null);
  assert.equal(extracted.componentPath, 'components/HeroBanner.tsx');
  assert.ok(extracted.updatedPageCode.includes("import HeroBanner from '@/components/HeroBanner';"));
  assert.ok(extracted.updatedPageCode.includes('<HeroBanner />'));
  assert.ok(extracted.componentCode.includes('export default function HeroBanner'));
  assert.ok(extracted.componentCode.includes("import Link from 'next/link';"));
  assert.ok(extracted.componentCode.includes('ArrowRight'));
});

import {
  insertComponentIntoSource,
  insertJsxSnippetIntoSource,
  replaceElementWithComponentInSource,
} from './component-editor';
import {
  addPackageDependencyToFiles,
  buildEsmShUrl,
  injectLibraryImportIntoSource,
  isValidPackageName,
  parsePackageDependencies,
  removePackageDependencyFromFiles,
  scanExternalImportsInSource,
} from './library-importer';

test('component-editor replaces existing element/component and inserts designed React components at intended locations', () => {
  const heroPreset = createComponentFileTemplate('PromoBanner', 'hero');
  assert.equal(heroPreset.componentName, 'PromoBanner');
  assert.ok(heroPreset.code.includes('Featured Component'));

  // Replace Navbar on Home page with PromoBanner
  const pageCode = STARTER_NEXTJS_FILES['app/page.tsx'];
  const navbarUsage = scanComponentUsagesInFile(pageCode, 'app/page.tsx', ['Navbar'])[0];
  const replaced = replaceElementWithComponentInSource({
    targetCode: pageCode,
    targetFilePath: 'app/page.tsx',
    elementIndex: navbarUsage.elementIndex,
    componentName: 'PromoBanner',
    componentFilePath: heroPreset.filePath,
    componentCode: heroPreset.code,
    props: { heading: 'New Campaign' },
  });
  assert.ok(replaced !== null);
  assert.ok(replaced.includes("import PromoBanner from '@/components/PromoBanner';"));
  assert.ok(replaced.includes('<PromoBanner heading="New Campaign" />'));
  assert.equal(replaced.includes('<Navbar active="/" />'), false);

  // Insert PromoBanner before/after/inside targeted element
  const afterInserted = insertComponentIntoSource({
    targetCode: pageCode,
    targetFilePath: 'app/page.tsx',
    targetElementIndex: 2, // first <section>
    position: 'after',
    componentName: 'PromoBanner',
    componentFilePath: heroPreset.filePath,
    componentCode: heroPreset.code,
  });
  assert.ok(afterInserted !== null);
  assert.ok(afterInserted.includes('</section>\n<PromoBanner />'));

  const insideInserted = insertComponentIntoSource({
    targetCode: pageCode,
    targetFilePath: 'app/page.tsx',
    targetElementIndex: 2,
    position: 'inside-end',
    componentName: 'PromoBanner',
    componentFilePath: heroPreset.filePath,
    componentCode: heroPreset.code,
  });
  assert.ok(insideInserted !== null);
  assert.ok(/<PromoBanner \/>\s*<\/section>/.test(insideInserted));

  const snippetInserted = insertJsxSnippetIntoSource({
    targetCode: heroPreset.code,
    targetElementIndex: 0,
    position: 'inside-start',
    jsxSnippet: '<Sparkles className="h-5 w-5" />',
  });
  assert.ok(snippetInserted !== null);
  assert.ok(snippetInserted.includes('<Sparkles className="h-5 w-5" />'));
});

test('library-importer validates packages, updates package.json dependencies, and merges imports into source', () => {
  assert.equal(isValidPackageName('recharts'), true);
  assert.equal(isValidPackageName('@tanstack/react-table'), true);
  assert.equal(isValidPackageName('bad package!'), false);
  assert.equal(buildEsmShUrl('sonner'), 'https://esm.sh/sonner?external=react,react-dom');

  const withDep = addPackageDependencyToFiles(STARTER_NEXTJS_FILES, 'recharts', '^2.15.0');
  const deps = parsePackageDependencies(withDep);
  assert.equal(deps.recharts, '^2.15.0');

  const withoutDep = removePackageDependencyFromFiles(withDep, 'recharts');
  assert.equal(parsePackageDependencies(withoutDep).recharts, undefined);

  const sampleComp = `'use client';\nimport React from 'react';\nimport { Sparkles } from 'lucide-react';\n\nexport default function Demo() { return <div />; }\n`;
  const mergedNamed = injectLibraryImportIntoSource(sampleComp, {
    packageName: 'lucide-react',
    importMode: 'named',
    identifiers: ['ArrowRight', 'Sparkles'],
  });
  assert.ok(mergedNamed.includes("import { Sparkles, ArrowRight } from 'lucide-react';"));

  const withDefault = injectLibraryImportIntoSource(mergedNamed, {
    packageName: 'canvas-confetti',
    importMode: 'default',
    identifiers: ['confetti'],
  });
  assert.ok(withDefault.includes("import confetti from 'canvas-confetti';"));

  const scanned = scanExternalImportsInSource(withDefault);
  assert.equal(scanned.some((s) => s.packageName === 'canvas-confetti'), true);
});

import {
  alignElementClassName,
  applyWidthAndSpacingToClassName,
  autoAlignSourceCode,
  detectBreakpointSizeMode,
  mergeResponsiveClasses,
  redesignBlockClassName,
  resolveEffectiveBreakpoint,
  scanResponsiveIssues,
  scopeElementPatchToBreakpoint,
} from './smart-aligner';

test('smart-aligner merges responsive classes while preserving desktop layout on mobile edits', () => {
  assert.equal(resolveEffectiveBreakpoint('auto', 'mobile'), 'mobile');
  assert.equal(resolveEffectiveBreakpoint('auto', 'desktop'), 'desktop');

  // Editing mobile centers text and stacks flex while promoting old unprefixed desktop classes to lg:
  const mobileMerged = mergeResponsiveClasses(
    'flex flex-row items-center justify-between text-left px-10',
    ['flex-col', 'justify-center', 'text-center', 'px-4'],
    { breakpoint: 'mobile', preserveDesktopOnMobile: true }
  );
  assert.ok(mobileMerged.includes('flex-col'));
  assert.ok(mobileMerged.includes('lg:flex-row'));
  assert.ok(mobileMerged.includes('justify-center'));
  assert.ok(mobileMerged.includes('lg:justify-between'));
  assert.ok(mobileMerged.includes('text-center'));
  assert.ok(mobileMerged.includes('lg:text-left'));
  assert.ok(mobileMerged.includes('px-4'));
  assert.ok(mobileMerged.includes('lg:px-10'));

  // Editing desktop applies lg: prefix without clobbering mobile base
  const desktopMerged = mergeResponsiveClasses(mobileMerged, ['justify-start', 'text-right'], {
    breakpoint: 'desktop',
  });
  assert.ok(desktopMerged.includes('justify-center'));
  assert.ok(desktopMerged.includes('lg:justify-start'));
  assert.ok(desktopMerged.includes('text-center'));
  assert.ok(desktopMerged.includes('lg:text-right'));
});

test('smart-aligner aligns containers, text elements, redesign presets, and width/spacing', () => {
  const alignedText = alignElementClassName('text-3xl font-bold text-slate-900', {
    tagName: 'h1',
    breakpoint: 'mobile',
    horizontal: 'center',
  });
  assert.ok(alignedText.className.includes('text-center'));
  assert.ok(alignedText.className.includes('lg:text-left'));
  assert.equal(alignedText.clearInlineStyles.textAlign, null);

  const alignedFlexCol = alignElementClassName('flex flex-col gap-4', {
    tagName: 'div',
    breakpoint: 'desktop',
    horizontal: 'center',
    vertical: 'middle',
  });
  assert.ok(alignedFlexCol.className.includes('lg:items-center'));
  assert.ok(alignedFlexCol.className.includes('lg:justify-center'));

  const splitRedesigned = redesignBlockClassName('p-6 bg-white', 'split-2', 'all');
  assert.ok(splitRedesigned.includes('grid-cols-1'));
  assert.ok(splitRedesigned.includes('lg:grid-cols-2'));

  const sized = applyWidthAndSpacingToClassName('bg-white', {
    breakpoint: 'all',
    widthPreset: 'compact',
    density: 'airy',
  });
  assert.ok(sized.includes('max-w-2xl'));
  assert.ok(sized.includes('mx-auto'));
  assert.ok(sized.includes('px-8'));
});

test('smart-aligner scans responsive issues and auto-aligns starter page and navbar', () => {
  const pageCode = STARTER_NEXTJS_FILES['app/page.tsx'];
  const report = scanResponsiveIssues(pageCode, false);
  assert.ok(report.rigidFlexRows >= 1);
  assert.ok(report.oversizedPaddingBlocks >= 1);
  assert.ok(report.oversizedHeadings >= 1);

  const autoPage = autoAlignSourceCode({
    code: pageCode,
    isHtml: false,
    mode: 'responsive-all',
  });
  assert.ok(autoPage.changesCount >= 3);
  assert.ok(autoPage.updatedCode.includes('lg:px-10'));
  assert.ok(autoPage.updatedCode.includes('lg:text-4xl'));
  assert.ok(autoPage.updatedCode.includes('flex-col'));
  assert.ok(autoPage.updatedCode.includes('md:flex-row'));

  const navCode = STARTER_NEXTJS_FILES['components/Navbar.tsx'];
  const autoNav = autoAlignSourceCode({
    code: navCode,
    isHtml: false,
    mode: 'responsive-all',
  });
  assert.ok(autoNav.changesCount >= 1);
  assert.ok(autoNav.updatedCode.includes('flex-wrap'));
});

test('buildResizeContainmentStyles prevents content leakage across box types on resize', () => {
  const cardResized = buildResizeContainmentStyles({
    width: '240px',
    height: '120px',
    inlineStyles: {},
    computedStyles: { display: 'block', overflow: 'visible' },
    currentRect: { width: 380, height: 220 },
  });
  assert.equal(cardResized.width, '240px');
  assert.equal(cardResized.height, '120px');
  assert.equal(cardResized.boxSizing, 'border-box');
  assert.equal(cardResized.overflow, 'hidden');
  assert.equal(cardResized.overflowWrap, 'anywhere');
  assert.equal(cardResized.minWidth, '0px');
  assert.equal(cardResized.minHeight, '0px');

  const flexRowResized = buildResizeContainmentStyles({
    width: '280px',
    inlineStyles: {},
    computedStyles: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'nowrap',
      overflow: 'visible',
      whiteSpace: 'nowrap',
      maxWidth: '240px',
    },
    currentRect: { width: 420, height: 44 },
  });
  assert.equal(flexRowResized.flexWrap, 'wrap');
  assert.equal(flexRowResized.whiteSpace, 'normal');
  assert.equal(flexRowResized.maxWidth, 'none');
  assert.equal(flexRowResized.overflow, 'hidden');

  const inlineResized = buildResizeContainmentStyles({
    width: '120px',
    height: '32px',
    inlineStyles: { overflow: 'auto' },
    computedStyles: { display: 'inline', overflow: 'auto' },
  });
  assert.equal(inlineResized.display, 'inline-block');
  assert.equal(inlineResized.overflow, undefined);
});

test('scopeElementPatchToBreakpoint isolates Desktop and Mobile resize, grid, and alignment edits', () => {
  const sampleTsx = `
export default function Page() {
  return (
    <main className="p-6">
      <div className="rounded-xl bg-slate-900 p-6">Hero Card</div>
      <div className="grid grid-cols-4 gap-4" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div>KPI 1</div>
        <div>KPI 2</div>
      </div>
      <h1 className="text-3xl font-bold" style={{ textAlign: 'left' }}>Heading</h1>
    </main>
  );
}`;

  // 1. Desktop resize adds lg:w-[520px] lg:h-[240px] lg:overflow-hidden without constraining mobile
  const desktopResize = scopeElementPatchToBreakpoint({
    code: sampleTsx,
    elementIndex: 1, // Hero Card
    isHtml: false,
    breakpoint: 'desktop',
    patch: {
      styles: {
        width: '520px',
        height: '240px',
        overflow: 'hidden',
        boxSizing: 'border-box',
      },
    },
  });
  assert.ok(desktopResize.className?.includes('lg:w-[520px]'));
  assert.ok(desktopResize.className?.includes('lg:h-[240px]'));
  assert.ok(desktopResize.className?.includes('lg:overflow-hidden'));
  assert.equal(/(?:^|\s)w-\[520px\](?:\s|$)/.test(desktopResize.className || ''), false);
  assert.equal(/(?:^|\s)h-\[240px\](?:\s|$)/.test(desktopResize.className || ''), false);
  assert.equal(desktopResize.styles, undefined);

  // 2. Mobile resize adds base w/h/overflow AND preserves Desktop defaults under lg:
  const mobileResize = scopeElementPatchToBreakpoint({
    code: sampleTsx,
    elementIndex: 1,
    isHtml: false,
    breakpoint: 'mobile',
    patch: {
      styles: {
        width: '300px',
        height: '180px',
        overflow: 'hidden',
      },
    },
  });
  assert.ok(mobileResize.className?.includes('w-[300px]'));
  assert.ok(mobileResize.className?.includes('h-[180px]'));
  assert.ok(mobileResize.className?.includes('overflow-hidden'));
  assert.ok(mobileResize.className?.includes('lg:w-auto'));
  assert.ok(mobileResize.className?.includes('lg:h-auto'));
  assert.ok(mobileResize.className?.includes('lg:overflow-visible'));
  assert.equal(detectBreakpointSizeMode(mobileResize.className || '', undefined, 'width', 'mobile'), 'fixed');
  assert.equal(detectBreakpointSizeMode(mobileResize.className || '', undefined, 'width', 'desktop'), 'hug');

  // 3. Desktop 2-col Grid forces grid-cols-1 mobile fallback & clears inline gridTemplateColumns
  const desktopGrid = scopeElementPatchToBreakpoint({
    code: sampleTsx,
    elementIndex: 2,
    isHtml: false,
    breakpoint: 'desktop',
    patch: {
      styles: {
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      },
    },
  });
  assert.ok(desktopGrid.className?.includes('grid-cols-1'));
  assert.ok(desktopGrid.className?.includes('lg:grid-cols-2'));
  assert.equal(desktopGrid.styles?.gridTemplateColumns, null);

  // 4. Mobile textAlign center produces text-center lg:text-left and clears inline textAlign
  const mobileTextAlign = scopeElementPatchToBreakpoint({
    code: sampleTsx,
    elementIndex: 5, // h1
    isHtml: false,
    breakpoint: 'mobile',
    patch: {
      styles: {
        textAlign: 'center',
      },
    },
  });
  assert.ok(mobileTextAlign.className?.includes('text-center'));
  assert.ok(mobileTextAlign.className?.includes('lg:text-left'));
  assert.equal(mobileTextAlign.styles?.textAlign, null);

  // 5. Pure visual styles (gradient/shadow/radius) stay untouched inline patches
  const visualOnly = scopeElementPatchToBreakpoint({
    code: sampleTsx,
    elementIndex: 1,
    isHtml: false,
    breakpoint: 'mobile',
    patch: {
      styles: {
        borderRadius: '16px',
        backgroundImage: 'linear-gradient(135deg, #0F172A 0%, #2563EB 100%)',
      },
    },
  });
  assert.equal(visualOnly.className, undefined);
  assert.equal(visualOnly.styles?.borderRadius, '16px');
});

test('smart-aligner protects desktop and mobile independently across block alignment, redesign, and autoAlign', () => {
  // Plain div block centered on mobile keeps desktop defaults intact
  const blockCenterMobile = alignElementClassName('rounded-xl p-6', {
    tagName: 'div',
    breakpoint: 'mobile',
    horizontal: 'center',
    hasChildren: true,
  });
  assert.ok(blockCenterMobile.className.includes('mx-auto'));
  assert.ok(blockCenterMobile.className.includes('text-center'));
  assert.ok(blockCenterMobile.className.includes('lg:mx-0'));
  assert.ok(blockCenterMobile.className.includes('lg:text-left'));

  // Mobile stack preserves existing lg:grid-cols-3
  const stackedMobile = redesignBlockClassName('grid grid-cols-1 lg:grid-cols-3 gap-4', 'stack', 'mobile');
  assert.ok(stackedMobile.includes('grid-cols-1'));
  assert.ok(stackedMobile.includes('lg:grid-cols-3'));

  // Desktop split-2 adds grid-cols-1 mobile fallback so mobile does not collide in 2 cols
  const splitDesktop = redesignBlockClassName('p-4', 'split-2', 'desktop');
  assert.ok(splitDesktop.includes('grid-cols-1'));
  assert.ok(splitDesktop.includes('lg:grid-cols-2'));

  // Mobile center-hero keeps desktop left alignment & block/width defaults
  const heroMobile = redesignBlockClassName('p-6', 'center-hero', 'mobile');
  assert.ok(heroMobile.includes('text-center'));
  assert.ok(heroMobile.includes('lg:text-left'));
  assert.ok(heroMobile.includes('lg:block'));
  assert.ok(heroMobile.includes('lg:mx-0'));
  assert.ok(heroMobile.includes('lg:max-w-none'));

  // autoAlignSourceCode converts inline gridTemplateColumns & inline height/overflow into responsive classes
  const messedUpCode = `
export default function Dashboard() {
  return (
    <section className="p-10">
      <div className="rounded-xl p-6" style={{ height: '180px', overflow: 'hidden' }}>Hero</div>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div>Card 1</div>
        <div>Card 2</div>
      </div>
      <nav className="fixed bottom-4 left-4 right-4 flex items-center justify-between px-4">
        <span>Tab 1</span>
        <span>Tab 2</span>
      </nav>
    </section>
  );
}`;
  const fixed = autoAlignSourceCode({
    code: messedUpCode,
    isHtml: false,
    mode: 'responsive-all',
    breakpoint: 'mobile',
  });
  assert.ok(fixed.updatedCode.includes('h-auto'));
  assert.ok(fixed.updatedCode.includes('overflow-visible'));
  assert.equal(fixed.updatedCode.includes("height: '180px'"), false);
  assert.ok(fixed.updatedCode.includes('grid-cols-1'));
  assert.ok(fixed.updatedCode.includes('md:grid-cols-2'));
  assert.equal(fixed.updatedCode.includes("gridTemplateColumns: 'repeat(2"), false);
  // Fixed bottom nav should NOT be forced into flex-col
  assert.equal(/<nav[^>]*flex-col/.test(fixed.updatedCode), false);
});

import {
  computeReorderDropTarget,
  parseElementTranslateOffsets,
} from './layout-constraints';
import { buildPreviewDocument, compileReactPreviewPayload } from './preview-runner';

test('parseElementTranslateOffsets reads CSS translate (Tailwind v4), transform translate/matrix, and combined values', () => {
  assert.deepEqual(
    parseElementTranslateOffsets({}, { translate: '120px -40px', transform: 'none' }),
    { x: 120, y: -40 }
  );
  assert.deepEqual(
    parseElementTranslateOffsets({}, { translate: 'none', transform: 'matrix(1, 0, 0, 1, 48, 24)' }),
    { x: 48, y: 24 }
  );
  assert.deepEqual(
    parseElementTranslateOffsets(
      { transform: 'translate(15px, -5px)' },
      { translate: '10px 20px', transform: 'translate(15px, -5px)' }
    ),
    { x: 25, y: 15 }
  );
  assert.deepEqual(parseElementTranslateOffsets({}, { translate: 'none', transform: 'none' }), {
    x: 0,
    y: 0,
  });
});

test('computeReorderDropTarget calculates exact post-splice targetIndex across vertical and horizontal layouts', () => {
  const verticalRects = [
    { x: 20, y: 0, width: 300, height: 80 },
    { x: 20, y: 100, width: 300, height: 80 },
    { x: 20, y: 200, width: 300, height: 80 },
  ];

  // Drag item 0 below item 1 center (y=165 > 140) -> slot=2 -> post-splice targetIndex=1
  const vDownPast1 = computeReorderDropTarget({
    itemRects: verticalRects,
    dragIndex: 0,
    pointerX: 100,
    pointerY: 165,
    isHorizontal: false,
  });
  assert.equal(vDownPast1.targetIndex, 1);
  assert.equal(vDownPast1.indicatorRect?.y, 182);

  // Drag item 0 above item 1 center (y=115 < 140) -> slot=1 -> post-splice targetIndex=0 (no-op)
  const vStay0 = computeReorderDropTarget({
    itemRects: verticalRects,
    dragIndex: 0,
    pointerX: 100,
    pointerY: 115,
    isHorizontal: false,
  });
  assert.equal(vStay0.targetIndex, 0);

  // Drag item 2 above item 1 center (y=115 < 140) -> slot=1 -> post-splice targetIndex=1
  const vUpBefore1 = computeReorderDropTarget({
    itemRects: verticalRects,
    dragIndex: 2,
    pointerX: 100,
    pointerY: 115,
    isHorizontal: false,
  });
  assert.equal(vUpBefore1.targetIndex, 1);

  // Horizontal 3-column grid: drag card 0 past card 2 center
  const horizRects = [
    { x: 0, y: 20, width: 100, height: 80 },
    { x: 120, y: 20, width: 100, height: 80 },
    { x: 240, y: 20, width: 100, height: 80 },
  ];
  const hMoveEnd = computeReorderDropTarget({
    itemRects: horizRects,
    dragIndex: 0,
    pointerX: 310,
    pointerY: 60,
    isHorizontal: true,
  });
  assert.equal(hMoveEnd.targetIndex, 2);
  assert.equal(hMoveEnd.indicatorRect?.x, 342);
});

test('compileReactPreviewPayload and sibling reorder index resolution stay consistent', () => {
  const proj = createProjectFromFiles(STARTER_NEXTJS_FILES, 'Starter', 'verve-structural-site');
  const payload = compileReactPreviewPayload(proj, proj.pages[0], { isolateComponent: false });
  assert.equal(payload.compileErrors.length, 0);
  assert.ok(payload.modules['app/page.tsx'].includes('data-studio-id'));
  assert.equal(payload.entryFile, 'app/page.tsx');
  assert.equal(payload.userCss.includes('@import "tailwindcss"'), false);

  const pageCode = proj.files['app/page.tsx'];
  const elsBefore = scanElements(pageCode, false);
  // Find the 3-card container (div with 3 children inside section)
  const cardGrid = elsBefore.find((e) => e.tagName === 'div' && e.childIndices.length === 3);
  assert.ok(cardGrid);
  const firstCardIdx = cardGrid.childIndices[0];
  const movedCode = moveElementSiblingInSource(pageCode, firstCardIdx, 2, false);
  const elsAfter = scanElements(movedCode, false);
  const gridAfter = elsAfter[cardGrid.index];
  const newMovedIdx = gridAfter.childIndices[2];
  assert.ok(movedCode.slice(elsAfter[newMovedIdx].openStart, elsAfter[newMovedIdx].closeEnd).includes('Precision Load Analysis') || newMovedIdx > firstCardIdx);

  // Validate generated iframe HTML script tags parse with zero JS SyntaxErrors
  const docBundle = buildPreviewDocument(proj, proj.pages[0], '', 'design', null);
  const scriptMatches = Array.from(docBundle.html.matchAll(/<script>([\s\S]*?)<\/script>/g));
  assert.equal(scriptMatches.length >= 2, true);
  for (const sm of scriptMatches) {
    assert.doesNotThrow(() => new Function(sm[1]));
  }
});
import {
  applyGlobalThemePreset,
  createStarterGlobalCss,
  parseGlobalStyles,
  removeGlobalCssVariable,
  removeGlobalCustomRule,
  resolveDefaultGlobalCssPath,
  setDarkCustomVariant,
  setGlobalCssVariable,
  updateGlobalBaseStyles,
  upsertGlobalCustomRule,
} from './global-styles';

test('global-styles parses variables, base typography, custom classes, and mutates CSS cleanly', () => {
  const resolvedStarter = resolveDefaultGlobalCssPath(
    STARTER_NEXTJS_FILES,
    ['app/globals.css'],
    'nextjs-app'
  );
  assert.equal(resolvedStarter.activePath, 'app/globals.css');
  assert.equal(resolvedStarter.exists, true);

  const missingCss = resolveDefaultGlobalCssPath({ 'src/App.tsx': '<div/>' }, [], 'react-vite');
  assert.equal(missingCss.activePath, 'src/index.css');
  assert.equal(missingCss.exists, false);

  let css = createStarterGlobalCss('nextjs-app');
  const parsed0 = parseGlobalStyles(css);
  assert.equal(parsed0.hasTailwindImport, true);
  assert.equal(parsed0.variables.some((v) => v.name === '--accent-primary' && v.value === '#2563EB'), true);
  assert.equal(parsed0.base.backgroundColor, '#f8fafc');

  // Add @theme token and update :root token
  css = setGlobalCssVariable(css, 'brand-gold', '#D97706', '@theme');
  css = setGlobalCssVariable(css, '--accent-primary', '#1D4ED8', ':root');
  const parsed1 = parseGlobalStyles(css);
  assert.equal(
    parsed1.variables.some((v) => v.scope === '@theme' && v.name === '--brand-gold' && v.value === '#D97706'),
    true
  );
  assert.equal(
    parsed1.variables.some((v) => v.scope === ':root' && v.name === '--accent-primary' && v.value === '#1D4ED8'),
    true
  );

  // Remove token cleanly
  css = removeGlobalCssVariable(css, '--brand-gold', '@theme');
  assert.equal(parseGlobalStyles(css).variables.some((v) => v.name === '--brand-gold'), false);

  // Update body font, size, line-height, headings, and links
  css = updateGlobalBaseStyles(css, {
    fontSize: '15px',
    lineHeight: '1.65',
    headingColor: '#0F172A',
    linkColor: '#2563EB',
  });
  const parsed2 = parseGlobalStyles(css);
  assert.equal(parsed2.base.fontSize, '15px');
  assert.equal(parsed2.base.lineHeight, '1.65');
  assert.equal(parsed2.base.headingColor, '#0F172A');
  assert.equal(parsed2.base.linkColor, '#2563EB');

  // Toggle dark custom-variant
  css = setDarkCustomVariant(css, true);
  assert.equal(parseGlobalStyles(css).hasDarkVariant, true);
  css = setDarkCustomVariant(css, false);
  assert.equal(parseGlobalStyles(css).hasDarkVariant, false);

  // Upsert and remove custom class rules
  css = upsertGlobalCustomRule(css, '.surface-card', [
    { property: 'background-color', value: '#FFFFFF' },
    { property: 'border-radius', value: '12px' },
  ]);
  const parsed3 = parseGlobalStyles(css);
  assert.equal(parsed3.customRules.some((r) => r.selector === '.surface-card'), true);

  css = removeGlobalCustomRule(css, '.surface-card');
  assert.equal(parseGlobalStyles(css).customRules.some((r) => r.selector === '.surface-card'), false);

  // Apply Midnight Slate theme preset
  css = applyGlobalThemePreset(css, 'midnight-studio');
  const parsed4 = parseGlobalStyles(css);
  assert.equal(parsed4.base.backgroundColor, '#0F172A');
  assert.equal(parsed4.base.color, '#F1F5F9');
  assert.equal(
    parsed4.variables.some((v) => v.name === '--accent-primary' && v.value === '#38BDF8'),
    true
  );
});

test('global-styles deduplicates repeated CSS variable keys across blocks and resolves edits/removals', () => {
  const duplicateCss = `@import "tailwindcss"
:root {
  --bg-canvas: #F8FAFC;
  --bg-surface: #FFFFFF;
  --bg-canvas: #111827;
}

:root {
  --bg-canvas: #0F172A;
  --accent-primary: #38BDF8;
}
`;

  const parsed = parseGlobalStyles(duplicateCss);
  const ids = parsed.variables.map((v) => v.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(
    parsed.variables.find((v) => v.id === ':root::--bg-canvas')?.value,
    '#0F172A'
  );
  assert.equal(
    parsed.variables.find((v) => v.id === ':root::--accent-primary')?.value,
    '#38BDF8'
  );

  // Updating resolves duplicates across all :root blocks
  const updated = setGlobalCssVariable(duplicateCss, '--bg-canvas', '#2563EB', ':root');
  const parsedUpdated = parseGlobalStyles(updated);
  assert.equal(
    parsedUpdated.variables.filter((v) => v.name === '--bg-canvas').length,
    1
  );
  assert.equal(
    parsedUpdated.variables.find((v) => v.name === '--bg-canvas')?.value,
    '#2563EB'
  );

  // Removing clears variable from all :root blocks
  const removed = removeGlobalCssVariable(updated, '--bg-canvas', ':root');
  assert.equal(
    parseGlobalStyles(removed).variables.some((v) => v.name === '--bg-canvas'),
    false
  );
});

import {
  applyBatchElementPatches,
  wrapElementsInContainer,
} from './source-editor';
import {
  clampZoomScale,
  computeContrastReport,
  computeMultiAlignPatches,
  computeNudgeOffsets,
  computeRedlineMeasurements,
  parseBoxSpacingPx,
  resolveEffectiveBgColor,
  stepZoomScale,
} from './visual-refinement';

test('visual-refinement computes redline gaps, parent insets, box spacing, nudge offsets, and zoom steps', () => {
  // Disjoint siblings -> horizontal gap
  const gapSegments = computeRedlineMeasurements(
    { x: 100, y: 50, width: 120, height: 60 },
    { x: 256, y: 60, width: 100, height: 60 }
  );
  assert.equal(gapSegments.length, 1);
  assert.equal(gapSegments[0].kind, 'gap');
  assert.equal(gapSegments[0].distance, 36);
  assert.equal(gapSegments[0].label, '36px');

  // Child inside parent -> 4 inset segments
  const insetSegments = computeRedlineMeasurements(
    { x: 140, y: 120, width: 200, height: 80 },
    { x: 100, y: 100, width: 400, height: 200 }
  );
  assert.equal(insetSegments.length, 4);
  assert.equal(insetSegments.find((s) => s.id === 'inset-left')?.distance, 40);
  assert.equal(insetSegments.find((s) => s.id === 'inset-right')?.distance, 160);
  assert.equal(insetSegments.find((s) => s.id === 'inset-top')?.distance, 20);
  assert.equal(insetSegments.find((s) => s.id === 'inset-bottom')?.distance, 100);

  const spacing = parseBoxSpacingPx({
    paddingTop: '16px',
    paddingRight: '24px',
    paddingBottom: '16px',
    paddingLeft: '24px',
    marginTop: '8px',
    marginBottom: '12px',
  });
  assert.deepEqual(spacing.padding, { top: 16, right: 24, bottom: 16, left: 24 });
  assert.deepEqual(spacing.margin, { top: 8, right: 0, bottom: 12, left: 0 });

  assert.deepEqual(
    computeNudgeOffsets({ baseX: 10, baseY: -4, key: 'ArrowRight', step: 8 }),
    { nextX: 18, nextY: -4, dx: 8, dy: 0 }
  );
  assert.deepEqual(
    computeNudgeOffsets({ baseX: 10, baseY: 12, key: 'ArrowUp', step: 1 }),
    { nextX: 10, nextY: 11, dx: 0, dy: -1 }
  );

  assert.equal(clampZoomScale(3), 2);
  assert.equal(clampZoomScale(0.2), 0.5);
  assert.equal(stepZoomScale(1, 'in'), 1.25);
  assert.equal(stepZoomScale(1, 'out'), 0.75);
});

test('visual-refinement computes multi-select alignment, distribution, size matching, and WCAG contrast', () => {
  const items = [
    {
      studioId: 'a::1',
      filePath: 'app/page.tsx',
      elementIndex: 1,
      rect: { x: 40, y: 20, width: 100, height: 50 },
      baseX: 0,
      baseY: 0,
    },
    {
      studioId: 'a::2',
      filePath: 'app/page.tsx',
      elementIndex: 2,
      rect: { x: 180, y: 60, width: 80, height: 70 },
      baseX: 10,
      baseY: -5,
    },
    {
      studioId: 'a::3',
      filePath: 'app/page.tsx',
      elementIndex: 3,
      rect: { x: 340, y: 40, width: 100, height: 50 },
      baseX: 0,
      baseY: 0,
    },
  ];

  const alignLeft = computeMultiAlignPatches(items, 'left');
  assert.equal(alignLeft[0].patch.styles?.transform, 'translate(0px, 0px)');
  assert.equal(alignLeft[1].patch.styles?.transform, 'translate(-130px, -5px)');
  assert.equal(alignLeft[2].patch.styles?.transform, 'translate(-300px, 0px)');

  const distH = computeMultiAlignPatches(items, 'distribute-h');
  // Total span = 440 - 40 = 400; total widths = 280; equal gap = 60 -> item 2 target x = 40 + 100 + 60 = 200 -> deltaX = +20 -> baseX 10 + 20 = 30
  assert.equal(distH[1].patch.styles?.transform, 'translate(30px, -5px)');

  const matchWidth = computeMultiAlignPatches(items, 'match-width');
  assert.equal(matchWidth[1].patch.styles?.width, '100px');

  const aaa = computeContrastReport('#0F172A', '#FFFFFF');
  assert.equal(aaa.grade, 'AAA');
  assert.equal(aaa.passesAA, true);

  const fail = computeContrastReport('#CBD5E1', '#FFFFFF');
  assert.equal(fail.grade, 'Fail');
  assert.equal(fail.passesAA, false);

  const bgResolved = resolveEffectiveBgColor({ backgroundColor: 'rgba(15, 23, 42, 0.5)' }, '#FFFFFF');
  assert.ok(bgResolved.startsWith('rgb('));
});

test('source-editor applies descending batch patches and wraps contiguous or non-contiguous siblings cleanly', () => {
  const tsx = `
export default function Page() {
  return (
    <section className="p-6">
      <div className="box-a">A</div>
      <div className="box-b">B</div>
      <div className="box-c">C</div>
    </section>
  );
}`;

  const batched = applyBatchElementPatches(tsx, false, [
    { elementIndex: 1, patch: { styles: { width: '200px' } } },
    { elementIndex: 3, patch: { styles: { width: '200px' } } },
  ]);
  assert.ok(batched.includes(`<div className="box-a" style={{ width: '200px' }}>A</div>`));
  assert.ok(batched.includes(`<div className="box-b">B</div>`));
  assert.ok(batched.includes(`<div className="box-c" style={{ width: '200px' }}>C</div>`));

  const wrappedRow = wrapElementsInContainer(tsx, false, [1, 2], 'row');
  assert.ok(wrappedRow.includes(`flexDirection: 'row'`));
  assert.ok(wrappedRow.includes(`<div className="box-a">A</div>`));
  assert.ok(wrappedRow.includes(`<div className="box-b">B</div>`));

  const wrappedGridNonContig = wrapElementsInContainer(tsx, false, [1, 3], 'grid-2');
  assert.ok(wrappedGridNonContig.includes(`repeat(2, minmax(0, 1fr))`));
  assert.ok(wrappedGridNonContig.includes(`<div className="box-a">A</div>`));
  assert.ok(wrappedGridNonContig.includes(`<div className="box-c">C</div>`));
});

import {
  importGitHubRepoFromBrowser,
  parseGitHubRepoUrl,
  safeReadJsonResponse,
} from './github-import';

test('github-import parses repo URLs, detects HTML proxy errors safely, and falls back to CORS GitHub APIs', async () => {
  assert.deepEqual(parseGitHubRepoUrl('https://github.com/kshitiz2007-cpu/Civil'), {
    owner: 'kshitiz2007-cpu',
    repo: 'Civil',
  });
  assert.deepEqual(
    parseGitHubRepoUrl('https://github.com/kshitiz2007-cpu/Civil/tree/recovery/original-full-app'),
    {
      owner: 'kshitiz2007-cpu',
      repo: 'Civil',
      branch: 'recovery/original-full-app',
    }
  );
  assert.equal(parseGitHubRepoUrl('https://example.com/foo/bar'), null);

  const htmlRes = new Response('<!doctype html><html><body>504 Gateway Timeout</body></html>', {
    status: 504,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
  const htmlParsed = await safeReadJsonResponse(htmlRes);
  assert.equal(htmlParsed.ok, false);
  if (!htmlParsed.ok) {
    assert.equal(htmlParsed.isHtml, true);
    assert.ok(htmlParsed.error.includes('HTML'));
  }

  const okRes = new Response(JSON.stringify({ name: 'owner/repo', fileCount: 2 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  const okParsed = await safeReadJsonResponse<{ name: string; fileCount: number }>(okRes);
  assert.equal(okParsed.ok, true);
  if (okParsed.ok) {
    assert.equal(okParsed.data.name, 'owner/repo');
    assert.equal(okParsed.data.fileCount, 2);
  }

  const mockFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('/git/trees/')) {
      return new Response(
        JSON.stringify({
          tree: [
            { path: 'app/page.tsx', type: 'blob', size: 120 },
            { path: 'node_modules/pkg/index.js', type: 'blob', size: 120 },
            { path: 'package-lock.json', type: 'blob', size: 5000 },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    if (url.includes('raw.githubusercontent.com') && url.endsWith('/app/page.tsx')) {
      return new Response('export default function Page() { return <main>Hi</main>; }', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      });
    }
    return new Response('Not Found', { status: 404 });
  }) as typeof fetch;

  const imported = await importGitHubRepoFromBrowser(
    'https://github.com/kshitiz2007-cpu/Civil/tree/recovery/original-full-app',
    mockFetch
  );
  assert.equal(imported.name, 'kshitiz2007-cpu/Civil');
  assert.equal(imported.branch, 'recovery/original-full-app');
  assert.equal(imported.fileCount, 1);
  assert.ok(imported.files['Civil-recovery-original-full-app/app/page.tsx']?.includes('<main>Hi</main>'));
});

import { transform as sucraseTransform } from 'sucrase';
import {
  REACT_UI_LIBRARY_ITEMS,
  applyUiLibraryToProject,
  filterReactUiCatalog,
  replaceElementWithSnippetInSource,
} from './react-ui-catalog';

test('react-ui-catalog filters items, compiles all templates cleanly, and inserts or replaces in component and inline modes', () => {
  assert.ok(REACT_UI_LIBRARY_ITEMS.length >= 16);
  const charts = filterReactUiCatalog(REACT_UI_LIBRARY_ITEMS, 'recharts', 'Motion & Charts');
  assert.equal(charts.length, 1);
  assert.equal(charts[0].componentName, 'UiBarChartCard');

  // Verify every UI component template compiles cleanly with Sucrase JSX/TS
  for (const item of REACT_UI_LIBRARY_ITEMS) {
    const out = sucraseTransform(item.componentSource, {
      transforms: ['typescript', 'jsx', 'imports'],
      jsxRuntime: 'classic',
      jsxPragma: 'React.createElement',
      jsxFragmentPragma: 'React.Fragment',
      filePath: `components/ui/${item.componentName}.tsx`,
    });
    assert.ok(out.code.length > 0, `Expected compiled output for ${item.id}`);
  }

  const baseFiles: Record<string, string> = {
    'package.json': JSON.stringify({ name: 'demo', dependencies: { react: '^19.0.0' } }),
    'app/page.tsx': `'use client';
import React from 'react';

export default function Page() {
  return (
    <main className="p-6">
      <div className="old-hero">Old Block</div>
      <section className="content">Body</section>
    </main>
  );
}
`,
  };

  // Replace element index 1 (<div className="old-hero">) with UiHeroBanner component + custom prop
  const heroEntry = REACT_UI_LIBRARY_ITEMS.find((i) => i.id === 'ui-hero-banner')!;
  const replacedRes = applyUiLibraryToProject({
    files: baseFiles,
    targetFilePath: 'app/page.tsx',
    targetElementIndex: 1,
    entry: heroEntry,
    action: 'replace',
    integrationMode: 'component',
    customProps: {
      heading: 'Custom Studio Headline',
    },
  });
  assert.equal(replacedRes.ok, true);
  assert.ok(replacedRes.files['components/ui/UiHeroBanner.tsx']);
  assert.ok(replacedRes.files['app/page.tsx'].includes(`import UiHeroBanner from '@/components/ui/UiHeroBanner'`));
  assert.ok(replacedRes.files['app/page.tsx'].includes(`<UiHeroBanner heading="Custom Studio Headline" />`));
  assert.ok(!replacedRes.files['app/page.tsx'].includes('old-hero'));
  assert.ok(JSON.parse(replacedRes.files['package.json']).dependencies['lucide-react']);

  // Insert Framer Motion card inline after <section className="content"> (index 2 in baseFiles)
  const motionEntry = REACT_UI_LIBRARY_ITEMS.find((i) => i.id === 'ui-motion-card')!;
  const inlineInsertRes = applyUiLibraryToProject({
    files: baseFiles,
    targetFilePath: 'app/page.tsx',
    targetElementIndex: 2,
    entry: motionEntry,
    action: 'insert',
    position: 'after',
    integrationMode: 'inline',
  });
  assert.equal(inlineInsertRes.ok, true);
  assert.ok(inlineInsertRes.files['app/page.tsx'].includes(`from 'framer-motion'`));
  assert.ok(inlineInsertRes.files['app/page.tsx'].includes(`<motion.div`));
  assert.ok(JSON.parse(inlineInsertRes.files['package.json']).dependencies['framer-motion']);

  // Direct snippet replace helper
  const snippetReplaced = replaceElementWithSnippetInSource({
    targetCode: baseFiles['app/page.tsx'],
    elementIndex: 1,
    jsxSnippet: '<CustomCard />',
  });
  assert.ok(snippetReplaced?.includes('<CustomCard />'));
  assert.ok(!snippetReplaced?.includes('old-hero'));
});

import { transform as sucraseTransform } from 'sucrase';
import {
  DEFAULT_ANIMATION_CONFIG,
  WEBD_MOTION_CSS_START,
  buildAnimationClassesAndStyles,
  countAnimatedElementsInFiles,
  mergeMotionCssIntoGlobalCss,
  parseAnimationConfigFromElement,
} from './animation-studio';
import {
  buildVirtualAssetMap,
  decodeDataUrlToBytes,
  extractInlineBase64MediaFromFiles,
  registerMediaAssetInProjectFiles,
} from './media-pipeline';
import {
  compileProjectForProductionExport,
  stampWebdIdsInSource,
} from './export-compiler';
import type { VisualLogicRule } from './logic-engine';

test('animation-studio builds, round-trips, merges CSS idempotently, and counts animated elements', () => {
  const built = buildAnimationClassesAndStyles('rounded-xl p-6 webd-reveal-fade-down', {
    reveal: 'fade-up',
    hover: 'lift',
    loop: 'float',
    duration: 0.8,
    delay: 0.15,
    easing: 'spring',
    staggerChildren: true,
    staggerStepMs: 110,
    once: false,
  });

  assert.equal(built.hasAnimation, true);
  assert.ok(built.className.includes('rounded-xl p-6'));
  assert.ok(!built.className.includes('webd-reveal-fade-down'));
  assert.ok(built.className.includes('webd-reveal'));
  assert.ok(built.className.includes('webd-reveal-fade-up'));
  assert.ok(built.className.includes('webd-reveal-repeat'));
  assert.ok(built.className.includes('webd-stagger-children'));
  assert.ok(built.className.includes('webd-hover-lift'));
  assert.ok(built.className.includes('webd-loop-float'));
  assert.equal(built.styles['--webd-anim-duration'], '0.80s');
  assert.equal(built.styles['--webd-anim-delay'], '0.15s');
  assert.equal(built.styles['--webd-stagger-step'], '110ms');

  const parsed = parseAnimationConfigFromElement(
    built.className,
    Object.fromEntries(
      Object.entries(built.styles).filter(([, v]) => typeof v === 'string') as [string, string][]
    )
  );
  assert.equal(parsed.reveal, 'fade-up');
  assert.equal(parsed.hover, 'lift');
  assert.equal(parsed.loop, 'float');
  assert.equal(parsed.easing, 'spring');
  assert.equal(parsed.staggerChildren, true);
  assert.equal(parsed.staggerStepMs, 110);
  assert.equal(parsed.once, false);
  assert.equal(parsed.duration, 0.8);
  assert.equal(parsed.delay, 0.15);

  const cleared = buildAnimationClassesAndStyles(built.className, DEFAULT_ANIMATION_CONFIG);
  assert.equal(cleared.hasAnimation, false);
  assert.equal(cleared.className, 'rounded-xl p-6');
  assert.equal(cleared.styles['--webd-anim-duration'], null);

  const merged1 = mergeMotionCssIntoGlobalCss(':root { --x: 1; }');
  assert.ok(merged1.includes(WEBD_MOTION_CSS_START));
  const merged2 = mergeMotionCssIntoGlobalCss(merged1);
  assert.equal(merged2, merged1);

  const counts = countAnimatedElementsInFiles({
    'app/page.tsx': `<div className="${built.className}">Hi</div>`,
  });
  assert.equal(counts.revealCount, 1);
  assert.equal(counts.hoverCount, 1);
  assert.equal(counts.loopCount, 1);
  assert.equal(counts.total, 3);

  // Verify source-editor preserves CSS custom property keys (--webd-*) in JSX and HTML
  const patchedJsx = applyElementPatchToSource(
    `export default function P() { return <h1 className="text-xl">Hi</h1>; }`,
    0,
    false,
    { className: built.className, styles: built.styles }
  );
  assert.ok(patchedJsx.includes(`'--webd-anim-duration': '0.80s'`));
  assert.ok(!patchedJsx.includes('-WebdAnimDuration'));

  const patchedHtml = applyElementPatchToSource(
    `<h1 class="text-xl">Hi</h1>`,
    0,
    true,
    { className: built.className, styles: built.styles }
  );
  assert.ok(patchedHtml.includes('--webd-anim-duration: 0.80s'));
});

test('media-pipeline registers clean public/assets paths, deduplicates, resolves preview map, and extracts inline base64', () => {
  const pngBase64 =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
  const pngBase64Other =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  const reg1 = registerMediaAssetInProjectFiles({}, 'nextjs-app', {
    name: 'Hero Banner!!.PNG',
    type: 'image/png',
    dataUrl: pngBase64,
  });
  assert.equal(reg1.assetFilePath, 'public/assets/hero-banner.png');
  assert.equal(reg1.publicUrl, '/assets/hero-banner.png');
  assert.equal(reg1.reusedExisting, false);

  // Same content reuses existing file
  const regReuse = registerMediaAssetInProjectFiles(reg1.nextFiles, 'nextjs-app', {
    name: 'Another Name.png',
    type: 'image/png',
    dataUrl: pngBase64,
  });
  assert.equal(regReuse.reusedExisting, true);
  assert.equal(regReuse.publicUrl, '/assets/hero-banner.png');

  // Different content with same slug gets -2 suffix
  const reg2 = registerMediaAssetInProjectFiles(reg1.nextFiles, 'nextjs-app', {
    name: 'Hero Banner.png',
    type: 'image/png',
    dataUrl: pngBase64Other,
  });
  assert.equal(reg2.assetFilePath, 'public/assets/hero-banner-2.png');
  assert.equal(reg2.publicUrl, '/assets/hero-banner-2.png');

  // HTML framework stores in assets/ with ./assets/ URL
  const regHtml = registerMediaAssetInProjectFiles({}, 'html', {
    name: 'Logo.png',
    type: 'image/png',
    dataUrl: pngBase64,
  });
  assert.equal(regHtml.assetFilePath, 'assets/logo.png');
  assert.equal(regHtml.publicUrl, './assets/logo.png');

  // Virtual map and binary decoding
  const assetMap = buildVirtualAssetMap(reg2.nextFiles);
  assert.equal(assetMap['/assets/hero-banner.png'], pngBase64);
  assert.equal(assetMap['./assets/hero-banner.png'], pngBase64);
  const decoded = decodeDataUrlToBytes(pngBase64);
  assert.ok(decoded);
  assert.equal(decoded.mimeType, 'image/png');
  assert.ok(decoded.bytes.byteLength > 20);

  // Extract inline base64 from legacy code
  const longBase64 = `data:image/png;base64,${'A'.repeat(200)}`;
  const extracted = extractInlineBase64MediaFromFiles(
    {
      'app/page.tsx': `export default function P() { return <img src="${longBase64}" alt="legacy" />; }`,
    },
    'nextjs-app'
  );
  assert.equal(extracted.extractedCount, 1);
  assert.ok(extracted.files['app/page.tsx'].includes('src="/assets/page-media.png"'));
  assert.equal(extracted.files['public/assets/page-media.png'], longBase64);
  assert.ok(extracted.bytesSavedInCode > 150);
});

test('export-compiler compiles visual logic + scroll-reveal + binary media into standalone Next.js and HTML bundles', () => {
  const pngDataUrl =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  const nextFiles: Record<string, string> = {
    ...STARTER_NEXTJS_FILES,
    'app/layout.tsx': `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}`,
    'public/assets/hero.png': pngDataUrl,
    'app/page.tsx': `export default function HomePage() {
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold webd-reveal webd-reveal-fade-up">Welcome</h1>
      <button type="button" className="rounded bg-blue-600 px-4 py-2 text-white">Launch</button>
      <img src="/assets/hero.png" alt="Hero" />
    </main>
  );
}`,
  };
  const nextProj = createProjectFromFiles(nextFiles, 'Starter', 'prod-app');
  const rules: VisualLogicRule[] = [
    {
      id: 'rule-1',
      componentId: 'app/page.tsx::2', // <button>
      componentLabel: '<button>',
      trigger: 'onClick',
      action: 'toast',
      target: '',
      value: 'Launched!',
      enabled: true,
    },
  ];

  const compiledNext = compileProjectForProductionExport(nextProj, rules, {
    compileLogic: true,
    includeScrollRevealRuntime: true,
    extractInlineBase64Media: true,
  });

  assert.equal(compiledNext.report.compiledRulesCount, 1);
  assert.equal(compiledNext.report.wiredElementCount, 1);
  assert.equal(compiledNext.report.animatedElementCount, 1);
  assert.equal(compiledNext.report.mediaAssetCount, 1);
  assert.ok(compiledNext.binaryFiles['public/assets/hero.png'] instanceof Uint8Array);
  assert.equal(compiledNext.textFiles['public/assets/hero.png'], undefined);
  assert.ok(compiledNext.textFiles['app/page.tsx'].includes('data-webd-id="webd-app-page-2"'));
  assert.ok(compiledNext.textFiles['components/WebdProductionRuntime.tsx']);
  assert.ok(compiledNext.textFiles['components/WebdProductionRuntime.tsx'].includes('webd-app-page-2'));
  assert.ok(compiledNext.textFiles['components/WebdProductionRuntime.tsx'].includes('IntersectionObserver'));
  assert.ok(compiledNext.textFiles['app/layout.tsx'].includes('<WebdProductionRuntime />'));
  assert.ok(compiledNext.textFiles['app/globals.css'].includes(WEBD_MOTION_CSS_START));

  // Also verify fallback mount inside app/page.tsx when app/layout.tsx is absent
  const noLayoutFiles = { ...nextFiles };
  delete noLayoutFiles['app/layout.tsx'];
  const compiledNoLayout = compileProjectForProductionExport(
    createProjectFromFiles(noLayoutFiles, 'NoLayout', 'no-layout'),
    rules,
    { compileLogic: true, includeScrollRevealRuntime: true, extractInlineBase64Media: true }
  );
  assert.ok(compiledNoLayout.textFiles['app/page.tsx'].includes('<WebdProductionRuntime />'));

  // Verify generated TSX compiles cleanly with Sucrase
  const transpiled = sucraseTransform(compiledNext.textFiles['components/WebdProductionRuntime.tsx'], {
    transforms: ['typescript', 'jsx'],
  });
  assert.ok(transpiled.code.includes('WebdProductionRuntime'));

  // HTML project export
  const htmlProj = createProjectFromFiles(
    {
      'index.html': `<!doctype html><html><head><link rel="stylesheet" href="./styles.css" /></head><body><section class="webd-reveal webd-reveal-zoom-in"><button id="go">Go</button><img src="./assets/pic.png" alt="pic" /></section></body></html>`,
      'styles.css': `body { margin: 0; }`,
      'assets/pic.png': pngDataUrl,
    },
    'HTML Demo',
    'html-demo'
  );
  const htmlRule: VisualLogicRule[] = [
    {
      id: 'html-rule-1',
      componentId: 'index.html::1',
      componentLabel: '<button>',
      trigger: 'onClick',
      action: 'toast',
      target: '',
      value: 'HTML Interactive!',
      enabled: true,
    },
  ];
  const compiledHtml = compileProjectForProductionExport(htmlProj, htmlRule, {
    compileLogic: true,
    includeScrollRevealRuntime: true,
    extractInlineBase64Media: true,
  });
  assert.ok(compiledHtml.textFiles['assets/webd-runtime.js']);
  assert.ok(compiledHtml.textFiles['index.html'].includes('src="./assets/webd-runtime.js"'));
  assert.ok(compiledHtml.binaryFiles['assets/pic.png'] instanceof Uint8Array);
  assert.ok(compiledHtml.textFiles['styles.css'].includes(WEBD_MOTION_CSS_START));

  // Direct stamp check
  const stamped = stampWebdIdsInSource('<div><span>A</span><button>B</button></div>', true, new Map([[2, 'webd-btn']]));
  assert.ok(stamped.includes('<button data-webd-id="webd-btn">B</button>'));
});

import {
  buildCopiedStylePayload,
  buildPasteStylePatch,
  clampContextMenuPosition,
  suggestExtractedComponentName,
} from './workspace-actions';
import {
  StudioCommandItem,
  filterAndRankCommands,
} from './command-palette';

test('35. Workspace Actions: copy/paste styles strips offsets, clamps context menu, and suggests component names', () => {
  const copied = buildCopiedStylePayload(
    {
      tagName: 'h1',
      studioId: 'app/page.tsx::5',
      className: 'text-3xl font-bold text-white',
      inlineStyles: {
        color: '#ffffff',
        backgroundImage: 'linear-gradient(90deg, #111, #222)',
        transform: 'translate(40px, 20px)',
        translate: '40px 20px',
      },
    },
    1000
  );

  assert.equal(copied.sourceTagName, 'h1');
  assert.equal(copied.className, 'text-3xl font-bold text-white');
  assert.equal(copied.inlineStyles.color, '#ffffff');
  assert.equal(copied.inlineStyles.transform, undefined);
  assert.equal(copied.inlineStyles.translate, undefined);

  const patch = buildPasteStylePatch(copied, {
    color: '#000000',
    fontSize: '14px',
    transform: 'translate(10px, 5px)',
  });

  assert.equal(patch.className, 'text-3xl font-bold text-white');
  assert.equal(patch.styles?.color, '#ffffff');
  assert.equal(patch.styles?.fontSize, null);
  assert.equal(patch.styles?.transform, undefined);

  const source = `export default function Demo() {
  return (
    <div>
      <p className="text-sm" style={{ color: '#000000', fontSize: '14px' }}>Target</p>
    </div>
  );
}`;
  const updated = applyElementPatchToSource(source, 1, false, patch);
  assert.ok(updated.includes('text-3xl font-bold text-white'));
  assert.ok(updated.includes("color: '#ffffff'"));
  assert.equal(updated.includes("fontSize: '14px'"), false);

  const clamped = clampContextMenuPosition({
    x: 1400,
    y: 850,
    menuWidth: 276,
    menuHeight: 460,
    viewportWidth: 1440,
    viewportHeight: 900,
    margin: 12,
  });
  assert.equal(clamped.x, 1152);
  assert.equal(clamped.y, 428);

  const clampedNeg = clampContextMenuPosition({
    x: -50,
    y: -10,
    menuWidth: 276,
    menuHeight: 460,
    viewportWidth: 1440,
    viewportHeight: 900,
    margin: 12,
  });
  assert.equal(clampedNeg.x, 12);
  assert.equal(clampedNeg.y, 12);

  assert.equal(suggestExtractedComponentName('section', 'Hero Banner Title'), 'HeroBannerBlock');
  assert.equal(suggestExtractedComponentName('button', ''), 'ButtonComponent');
});

test('36. Command Palette: fuzzy search, multi-token ranking, and category filtering', () => {
  const noop = () => {};
  const sampleItems: StudioCommandItem[] = [
    {
      id: 'tool:global-css',
      label: 'Global CSS & Design Tokens',
      description: 'Edit CSS variables and stylesheets',
      category: 'tools',
      keywords: ['css', 'tokens', 'theme'],
      iconKey: 'palette',
      onExecute: noop,
    },
    {
      id: 'tool:motion',
      label: 'Motion Studio',
      description: 'Scroll-reveal and hover animations',
      category: 'tools',
      keywords: ['animate', 'scroll', 'reveal'],
      iconKey: 'motion',
      onExecute: noop,
    },
    {
      id: 'block:two-col',
      label: 'Insert Two columns Block',
      description: 'Responsive 2-column grid',
      category: 'blocks',
      keywords: ['grid', 'columns', 'layout'],
      iconKey: 'block',
      onExecute: noop,
    },
    {
      id: 'page:pricing',
      label: 'Go to Page: Pricing',
      description: '/pricing · app/pricing/page.tsx',
      category: 'pages',
      keywords: ['route', 'pricing'],
      iconKey: 'page',
      onExecute: noop,
    },
    {
      id: 'el:wrap-row',
      label: 'Wrap <section> in Flex Row',
      description: 'Wrap selection inside flex container',
      category: 'element',
      keywords: ['wrap', 'flex', 'row'],
      iconKey: 'wrap',
      onExecute: noop,
    },
  ];

  // Fuzzy subsequence match ("glc" -> Global CSS)
  const glc = filterAndRankCommands(sampleItems, 'glc');
  assert.equal(glc[0]?.id, 'tool:global-css');

  // Keyword match
  const reveal = filterAndRankCommands(sampleItems, 'scroll');
  assert.equal(reveal[0]?.id, 'tool:motion');

  // Category filter
  const onlyPages = filterAndRankCommands(sampleItems, '', 'pages');
  assert.equal(onlyPages.length, 1);
  assert.equal(onlyPages[0]?.id, 'page:pricing');

  // Multi-word query
  const wrapFlex = filterAndRankCommands(sampleItems, 'wrap flex');
  assert.equal(wrapFlex.length, 1);
  assert.equal(wrapFlex[0]?.id, 'el:wrap-row');
});

test('37. Single-element Wrap in Flex Row / Grid works cleanly in JSX and HTML', () => {
  const jsxCode = `export default function Page() {
  return (
    <main>
      <div className="card">One</div>
      <div className="card">Two</div>
    </main>
  );
}`;
  const wrappedJsx = wrapElementsInContainer(jsxCode, false, [1], 'row');
  assert.ok(wrappedJsx.includes("display: 'flex'"));
  assert.ok(wrappedJsx.includes('<div className="card">One</div>'));

  const htmlCode = `<body><section><article>Card A</article><article>Card B</article></section></body>`;
  const wrappedHtml = wrapElementsInContainer(htmlCode, true, [2], 'grid-2');
  assert.ok(wrappedHtml.includes('grid-template-columns: repeat(2, minmax(0, 1fr))'));
  assert.ok(wrappedHtml.includes('<article>Card A</article>'));
});

import {
  computeSpacingDragResult,
  parseComputedBoxSpacing,
} from './spacing-handles';
import {
  DEFAULT_BRAND_REMIX_CONFIG,
  applyBrandRemixToGlobalCss,
  stripBrandRemixFromGlobalCss,
} from './brand-remixer';
import {
  analyzeDomMetricsForQa,
  computeColorContrastRatio,
  computeQaScore,
  pickAccessibleForeground,
} from './qa-audit';
import {
  addRepeaterItemFromLast,
  detectRepeaterGroups,
  findRepeaterForElement,
  moveRepeaterItem,
  removeRepeaterItem,
  updateRepeaterSlotText,
} from './repeater-detector';

test('38. spacing-handles computes inward padding, outward margin, clamping, and axis/all symmetry', () => {
  const parsed = parseComputedBoxSpacing({
    paddingTop: '16px',
    paddingRight: '24px',
    paddingBottom: '16px',
    paddingLeft: '24px',
    marginTop: '8px',
    marginRight: '0px',
    marginBottom: '12px',
    marginLeft: '0px',
  });
  assert.deepEqual(parsed.padding, { top: 16, right: 24, bottom: 16, left: 24 });
  assert.deepEqual(parsed.margin, { top: 8, right: 0, bottom: 12, left: 0 });

  // Padding top dragged downward (+20px inward) increases paddingTop from 16 -> 36
  const padSingle = computeSpacingDragResult({
    kind: 'padding',
    side: 'top',
    initialValues: parsed.padding,
    deltaX: 0,
    deltaY: 20,
    scale: 1,
    symmetricMode: 'single',
    snapStep: 4,
  });
  assert.equal(padSingle.primaryValue, 36);
  assert.deepEqual(padSingle.stylePatch, { paddingTop: '36px' });

  // Axis symmetry (Shift) mirrors paddingLeft + paddingRight
  const padAxis = computeSpacingDragResult({
    kind: 'padding',
    side: 'left',
    initialValues: parsed.padding,
    deltaX: 16,
    deltaY: 0,
    scale: 1,
    symmetricMode: 'axis',
    snapStep: 4,
  });
  assert.equal(padAxis.primaryValue, 40);
  assert.deepEqual(padAxis.stylePatch, { paddingLeft: '40px', paddingRight: '40px' });

  // Margin top dragged upward (-16px outward) with Alt (all 4 sides) increases all margins to 24px
  const marginAll = computeSpacingDragResult({
    kind: 'margin',
    side: 'top',
    initialValues: parsed.margin,
    deltaX: 0,
    deltaY: -16,
    scale: 1,
    symmetricMode: 'all',
    snapStep: 4,
  });
  assert.equal(marginAll.primaryValue, 24);
  assert.deepEqual(marginAll.stylePatch, {
    marginTop: '24px',
    marginRight: '24px',
    marginBottom: '24px',
    marginLeft: '24px',
  });

  // Clamping prevents negative or >240px values
  const clamped = computeSpacingDragResult({
    kind: 'padding',
    side: 'top',
    initialValues: parsed.padding,
    deltaX: 0,
    deltaY: -500,
    scale: 1,
    symmetricMode: 'single',
    snapStep: 4,
  });
  assert.equal(clamped.primaryValue, 0);
});

test('39. brand-remixer idempotently applies, replaces, and strips Global CSS theme blocks', () => {
  const baseCss = `@import "tailwindcss";\n\nbody {\n  margin: 0;\n}\n`;
  const remixed1 = applyBrandRemixToGlobalCss(baseCss, {
    ...DEFAULT_BRAND_REMIX_CONFIG,
    paletteId: 'emerald-signal',
    fontPairingId: 'playfair-dm',
    radiusScaleId: 'rounded',
    shadowMoodId: 'elevated',
    themeMode: 'dark',
  });
  assert.ok(remixed1.includes('@import "tailwindcss";'));
  assert.ok(remixed1.includes('/* atelier-brand-remix:start */'));
  assert.ok(remixed1.includes('Playfair Display'));
  assert.ok(remixed1.includes('--bg-canvas: #081410'));
  assert.ok(remixed1.includes('--radius-base: 20px'));

  // Applying a second remix replaces the block cleanly without duplicating markers
  const remixed2 = applyBrandRemixToGlobalCss(remixed1, {
    ...DEFAULT_BRAND_REMIX_CONFIG,
    paletteId: 'amber-atelier',
    radiusScaleId: 'sharp',
    themeMode: 'light',
  });
  assert.equal(remixed2.split('atelier-brand-remix:start').length - 1, 1);
  assert.ok(remixed2.includes('--accent-primary: #D97706'));
  assert.ok(remixed2.includes('--radius-base: 4px'));

  // Stripping restores clean CSS
  const stripped = stripBrandRemixFromGlobalCss(remixed2);
  assert.equal(stripped.includes('atelier-brand-remix'), false);
  assert.ok(stripped.includes('body {'));
});

test('40. qa-audit detects low contrast, tiny touch target, horizontal overflow, small text, and missing alt with auto-fix patches', () => {
  const ratioBlackWhite = computeColorContrastRatio('#000000', '#FFFFFF');
  assert.ok(ratioBlackWhite !== null && ratioBlackWhite > 20);
  assert.equal(pickAccessibleForeground('#0F172A'), '#FFFFFF');
  assert.equal(pickAccessibleForeground('#FFFFFF'), '#0F172A');

  const issues = analyzeDomMetricsForQa(
    [
      {
        studioId: 'app/page.tsx::1',
        filePath: 'app/page.tsx',
        elementIndex: 1,
        tagName: 'p',
        label: 'p.muted',
        textContent: 'Low contrast tiny caption',
        color: 'rgb(203, 213, 225)',
        backgroundColor: 'rgb(255, 255, 255)',
        fontSizePx: 10,
        fontWeight: 400,
        rect: { x: 20, y: 40, width: 200, height: 18 },
        isInteractive: false,
      },
      {
        studioId: 'app/page.tsx::2',
        filePath: 'app/page.tsx',
        elementIndex: 2,
        tagName: 'button',
        label: 'button.tiny',
        textContent: 'Go',
        color: 'rgb(255, 255, 255)',
        backgroundColor: 'rgb(37, 99, 235)',
        fontSizePx: 14,
        fontWeight: 600,
        rect: { x: 20, y: 100, width: 28, height: 26 },
        isInteractive: true,
      },
      {
        studioId: 'app/page.tsx::3',
        filePath: 'app/page.tsx',
        elementIndex: 3,
        tagName: 'div',
        label: 'div.wide',
        textContent: '',
        color: 'rgb(15, 23, 42)',
        backgroundColor: 'rgb(255, 255, 255)',
        fontSizePx: 16,
        fontWeight: 400,
        rect: { x: 0, y: 180, width: 520, height: 120 },
        isInteractive: false,
      },
      {
        studioId: 'app/page.tsx::4',
        filePath: 'app/page.tsx',
        elementIndex: 4,
        tagName: 'img',
        label: 'img.hero',
        textContent: '',
        color: 'rgb(15, 23, 42)',
        backgroundColor: 'rgb(255, 255, 255)',
        fontSizePx: 16,
        fontWeight: 400,
        rect: { x: 20, y: 320, width: 280, height: 160 },
        isInteractive: false,
        hasAlt: false,
      },
      {
        studioId: 'app/page.tsx::5',
        filePath: 'app/page.tsx',
        elementIndex: 5,
        tagName: 'section',
        label: 'section',
        textContent: undefined as unknown as string,
        color: 'rgb(15, 23, 42)',
        backgroundColor: 'rgb(255, 255, 255)',
        fontSizePx: 16,
        fontWeight: 400,
        rect: { x: 0, y: 500, width: 320, height: 120 },
        isInteractive: false,
      },
    ],
    390
  );

  assert.ok(issues.some((i) => i.category === 'contrast' && i.autoFixPatch.styles?.color === '#0F172A'));
  assert.ok(issues.some((i) => i.category === 'typography' && i.autoFixPatch.styles?.fontSize === '14px'));
  assert.ok(issues.some((i) => i.category === 'touch-target' && i.autoFixPatch.styles?.minHeight === '44px'));
  assert.ok(issues.some((i) => i.category === 'overflow' && i.autoFixPatch.styles?.maxWidth === '100%'));
  assert.ok(issues.some((i) => i.category === 'accessibility'));
  assert.ok(computeQaScore(issues) < 80);
  assert.equal(computeQaScore([]), 100);
});

test('41. repeater-detector detects card grids, prioritizes grid cards first, resolves enclosing group, adds, edits, reorders, and removes cards', () => {
  const starterPage = STARTER_NEXTJS_FILES['app/page.tsx'];
  const groups = detectRepeaterGroups(starterPage, 'app/page.tsx');
  assert.ok(groups.length >= 1);

  // Homogeneous card grid should rank #1 ahead of outer <section> wrapper
  const cardGrid = groups[0];
  assert.ok(cardGrid);
  assert.equal(cardGrid.containerTagName, 'div');
  assert.equal(cardGrid.items.length, 3);
  assert.ok(cardGrid.containerLabel.includes('Cards'));
  assert.equal(cardGrid.items[0].slots.length >= 2, true);

  // Resolving from a nested heading inside card 1 finds the same repeater group
  const innerHeadingIdx = cardGrid.items[0].slots[0].elementIndex;
  const resolved = findRepeaterForElement(starterPage, 'app/page.tsx', innerHeadingIdx);
  assert.equal(resolved?.containerElementIndex, cardGrid.containerElementIndex);

  // Add 4th card
  const withFourth = addRepeaterItemFromLast(starterPage, 'app/page.tsx', cardGrid);
  const groupsAfterAdd = detectRepeaterGroups(withFourth, 'app/page.tsx');
  const expanded = groupsAfterAdd.find((g) => g.items.length === 4);
  assert.ok(expanded);

  // Update first card title slot
  const updatedText = updateRepeaterSlotText(
    withFourth,
    'app/page.tsx',
    expanded.items[0].slots[0].elementIndex,
    'Updated Beam Solver'
  );
  assert.ok(updatedText.includes('Updated Beam Solver'));

  // Reorder card 0 -> position 2
  const groupsForMove = detectRepeaterGroups(updatedText, 'app/page.tsx').find(
    (g) => g.items.length === 4
  )!;
  const reordered = moveRepeaterItem(
    updatedText,
    'app/page.tsx',
    groupsForMove.items[0].elementIndex,
    2
  );
  const groupsAfterMove = detectRepeaterGroups(reordered, 'app/page.tsx').find(
    (g) => g.items.length === 4
  )!;
  assert.equal(groupsAfterMove.items[2].title, 'Updated Beam Solver');

  // Remove the moved card -> back to 3 cards
  const afterRemove = removeRepeaterItem(
    reordered,
    'app/page.tsx',
    groupsAfterMove.items[2].elementIndex
  );
  assert.equal(afterRemove.includes('Updated Beam Solver'), false);
  const groupsAfterRemove = detectRepeaterGroups(afterRemove, 'app/page.tsx');
  assert.ok(groupsAfterRemove.some((g) => g.items.length === 3));
});






