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


