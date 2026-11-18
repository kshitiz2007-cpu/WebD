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
import { compileReactPreviewPayload } from './preview-runner';

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

