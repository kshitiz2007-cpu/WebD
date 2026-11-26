'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  FilePlus2,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import {
  CssVarScope,
  FONT_FAMILY_PRESETS,
  GLOBAL_THEME_PRESETS,
  GlobalCssDeclaration,
  STARTER_CLASS_TEMPLATES,
  applyGlobalThemePreset,
  createStarterGlobalCss,
  isColorLikeValue,
  parseGlobalStyles,
  removeGlobalCssVariable,
  removeGlobalCustomRule,
  resolveDefaultGlobalCssPath,
  setDarkCustomVariant,
  setGlobalCssVariable,
  toPickerHex,
  updateGlobalBaseStyles,
  upsertGlobalCustomRule,
} from '@/lib/studio/global-styles';
import { ProjectFramework } from '@/lib/studio/types';

interface GlobalStylesPanelProps {
  files: Record<string, string>;
  globalCssPaths: string[];
  framework: ProjectFramework;
  onUpdateCssFile: (filePath: string, nextCss: string) => void;
  onOpenInMonaco: (filePath: string) => void;
  onClose: () => void;
  isBottomSheet?: boolean;
}

type GlobalStylesTab = 'tokens' | 'typography' | 'classes';

export default function GlobalStylesPanel({
  files,
  globalCssPaths,
  framework,
  onUpdateCssFile,
  onOpenInMonaco,
  onClose,
  isBottomSheet = false,
}: GlobalStylesPanelProps) {
  const defaultResolution = useMemo(
    () => resolveDefaultGlobalCssPath(files, globalCssPaths, framework),
    [files, globalCssPaths, framework]
  );

  const [selectedPath, setSelectedPath] = useState<string>(defaultResolution.activePath);
  const [prevDefaultPath, setPrevDefaultPath] = useState<string>(defaultResolution.activePath);
  const [activeTab, setActiveTab] = useState<GlobalStylesTab>('tokens');

  // Add Variable draft state
  const [newVarScope, setNewVarScope] = useState<CssVarScope>(':root');
  const [newVarName, setNewVarName] = useState('');
  const [newVarValue, setNewVarValue] = useState('#2563EB');

  // Add Class Rule draft state
  const [newRuleSelector, setNewRuleSelector] = useState('');
  const [newRuleProp, setNewRuleProp] = useState('padding');
  const [newRuleVal, setNewRuleVal] = useState('16px');
  const [newRuleDraftDecls, setNewRuleDraftDecls] = useState<Record<string, { prop: string; val: string }>>({});

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (defaultResolution.activePath !== prevDefaultPath) {
    setPrevDefaultPath(defaultResolution.activePath);
    if (files[selectedPath] === undefined) {
      setSelectedPath(defaultResolution.activePath);
    }
  }

  const activeCssPath =
    files[selectedPath] !== undefined ? selectedPath : defaultResolution.activePath;
  const cssExists = files[activeCssPath] !== undefined;
  const activeCss = files[activeCssPath] ?? '';

  const parsed = useMemo(() => parseGlobalStyles(activeCss), [activeCss]);

  const availableCssPaths = useMemo(() => {
    const set = new Set<string>(globalCssPaths.filter((p) => files[p] !== undefined));
    if (files[activeCssPath] !== undefined) set.add(activeCssPath);
    return Array.from(set).sort();
  }, [globalCssPaths, files, activeCssPath]);

  const handleCopyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      // Ignore clipboard failures in restricted environments
    }
  };

  const handleCreateStarterStylesheet = () => {
    const starter = createStarterGlobalCss(framework);
    onUpdateCssFile(activeCssPath, starter);
  };

  const handleAddVariable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVarName.trim() || !newVarValue.trim()) return;
    const next = setGlobalCssVariable(activeCss, newVarName, newVarValue, newVarScope);
    onUpdateCssFile(activeCssPath, next);
    setNewVarName('');
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const sel = newRuleSelector.trim();
    if (!sel || !newRuleProp.trim() || !newRuleVal.trim()) return;
    const next = upsertGlobalCustomRule(activeCss, sel, [
      { property: newRuleProp.trim(), value: newRuleVal.trim() },
    ]);
    onUpdateCssFile(activeCssPath, next);
    setNewRuleSelector('');
  };

  const handleUpdateRuleDecl = (
    selector: string,
    decls: GlobalCssDeclaration[],
    idx: number,
    patch: Partial<GlobalCssDeclaration>
  ) => {
    const updated = decls.map((d, i) => (i === idx ? { ...d, ...patch } : d));
    onUpdateCssFile(activeCssPath, upsertGlobalCustomRule(activeCss, selector, updated));
  };

  const handleDeleteRuleDecl = (
    selector: string,
    decls: GlobalCssDeclaration[],
    idx: number
  ) => {
    const remaining = decls.filter((_, i) => i !== idx);
    onUpdateCssFile(activeCssPath, upsertGlobalCustomRule(activeCss, selector, remaining));
  };

  const handleAddDeclToRule = (selector: string, decls: GlobalCssDeclaration[]) => {
    const draft = newRuleDraftDecls[selector];
    if (!draft?.prop.trim() || !draft?.val.trim()) return;
    const updated = [...decls, { property: draft.prop.trim(), value: draft.val.trim() }];
    onUpdateCssFile(activeCssPath, upsertGlobalCustomRule(activeCss, selector, updated));
    setNewRuleDraftDecls((prev) => ({
      ...prev,
      [selector]: { prop: '', val: '' },
    }));
  };

  return (
    <section
      aria-label="Global Styles Manager"
      className={`flex w-full flex-col bg-white ${
        isBottomSheet
          ? 'h-full rounded-t-2xl'
          : 'shrink-0 border-t border-slate-200 max-h-[276px]'
      }`}
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Palette className="h-3.5 w-3.5 shrink-0 text-blue-600" />
          <h2 className="text-xs font-semibold text-slate-900 whitespace-nowrap">
            Global Styles Manager
          </h2>

          {availableCssPaths.length > 0 && (
            <>
              <label htmlFor="global-css-file-select" className="sr-only">
                Active global stylesheet
              </label>
              <select
                id="global-css-file-select"
                value={activeCssPath}
                onChange={(e) => setSelectedPath(e.target.value)}
                className="h-7 max-w-[170px] rounded border border-slate-200 bg-white px-2 font-mono text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none"
              >
                {availableCssPaths.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {cssExists && (
            <>
              <div
                className="hidden sm:flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5"
                role="tablist"
                aria-label="Global style sections"
              >
                {(
                  [
                    { id: 'tokens', label: 'Tokens' },
                    { id: 'typography', label: 'Base & Type' },
                    { id: 'classes', label: 'Classes' },
                  ] as Array<{ id: GlobalStylesTab; label: string }>
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white text-blue-700 shadow-xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => onOpenInMonaco(activeCssPath)}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700 whitespace-nowrap"
              >
                <Code2 className="h-3 w-3" />
                <span className="hidden md:inline">Edit in Monaco</span>
                <span className="md:hidden">Monaco</span>
              </button>
            </>
          )}

          <button
            type="button"
            aria-label="Close global styles manager"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mobile Tab Bar */}
      {cssExists && (
        <div className="flex sm:hidden border-b border-slate-200 bg-slate-50 px-3 py-1.5 gap-1">
          {(
            [
              { id: 'tokens', label: 'Tokens & Theme' },
              { id: 'typography', label: 'Base & Type' },
              { id: 'classes', label: 'Classes' },
            ] as Array<{ id: GlobalStylesTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-md py-1 text-[11px] font-medium whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-blue-700 shadow-xs font-semibold border border-slate-200'
                  : 'text-slate-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      {!cssExists ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-6 text-center">
          <p className="text-xs font-medium text-slate-700">
            No global CSS stylesheet found in this project yet.
          </p>
          <p className="max-w-md text-[11px] text-slate-500">
            Create <span className="font-mono text-slate-700">{activeCssPath}</span> to manage
            global design tokens, typography, and reusable CSS classes across all pages.
          </p>
          <button
            type="button"
            onClick={handleCreateStarterStylesheet}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            <span>Create {activeCssPath}</span>
          </button>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto p-3 sm:px-4 lg:grid-cols-12 studio-scroll">
          {/* Left: Interactive Controls */}
          <div className="space-y-3 lg:col-span-7">
            {activeTab === 'tokens' && (
              <div className="space-y-3">
                {/* Theme Presets & Tailwind Dark Variant */}
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 mr-1">
                      <Sparkles className="h-3 w-3 text-blue-600" />
                      Theme Presets
                    </span>
                    {GLOBAL_THEME_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.description}
                        onClick={() =>
                          onUpdateCssFile(
                            activeCssPath,
                            applyGlobalThemePreset(activeCss, preset.id)
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full border border-slate-300"
                          style={{ backgroundColor: preset.backgroundColor }}
                        />
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>

                  {framework !== 'html' && (
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={parsed.hasDarkVariant}
                        onChange={(e) =>
                          onUpdateCssFile(
                            activeCssPath,
                            setDarkCustomVariant(activeCss, e.target.checked)
                          )
                        }
                        className="h-3 w-3 accent-blue-600"
                      />
                      <span className="font-mono">@custom-variant dark</span>
                    </label>
                  )}
                </div>

                {/* Add CSS Variable Form */}
                <form
                  onSubmit={handleAddVariable}
                  className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2"
                >
                  <label htmlFor="global-var-scope" className="sr-only">
                    Token scope
                  </label>
                  <select
                    id="global-var-scope"
                    value={newVarScope}
                    onChange={(e) => setNewVarScope(e.target.value as CssVarScope)}
                    className="h-7 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[11px] text-slate-700"
                  >
                    <option value=":root">:root</option>
                    <option value="@theme">@theme</option>
                    <option value=".dark">.dark</option>
                  </select>

                  <input
                    type="text"
                    aria-label="New CSS variable name"
                    placeholder="--brand-accent"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    className="h-7 min-w-[120px] flex-1 rounded border border-slate-200 px-2 font-mono text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none"
                  />

                  <div className="flex items-center gap-1">
                    {isColorLikeValue(newVarValue) && (
                      <input
                        type="color"
                        aria-label="New CSS variable color swatch"
                        value={toPickerHex(newVarValue)}
                        onChange={(e) => setNewVarValue(e.target.value.toUpperCase())}
                        className="h-7 w-7 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                      />
                    )}
                    <input
                      type="text"
                      aria-label="New CSS variable value"
                      placeholder="#2563EB or 12px"
                      value={newVarValue}
                      onChange={(e) => setNewVarValue(e.target.value)}
                      className="h-7 w-28 rounded border border-slate-200 px-2 font-mono text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    className="inline-flex h-7 items-center gap-1 rounded bg-blue-600 px-2.5 text-[11px] font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Token</span>
                  </button>
                </form>

                {/* Existing CSS Variables List */}
                <div className="space-y-1.5">
                  {parsed.variables.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-200 py-4 text-center text-[11px] text-slate-500">
                      No CSS variables defined yet. Add a token above or pick a theme preset.
                    </p>
                  ) : (
                    parsed.variables.map((variable) => (
                      <div
                        key={variable.id}
                        className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50/60 px-2 py-1.5"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 shrink-0">
                            {variable.scope}
                          </span>
                          <span className="truncate font-mono text-[11px] font-medium text-slate-900">
                            {variable.name}
                          </span>
                        </div>

                        <div className="flex min-w-[160px] flex-1 items-center gap-1">
                          {isColorLikeValue(variable.value) && (
                            <input
                              type="color"
                              aria-label={`${variable.name} color`}
                              value={toPickerHex(variable.value)}
                              onChange={(e) =>
                                onUpdateCssFile(
                                  activeCssPath,
                                  setGlobalCssVariable(
                                    activeCss,
                                    variable.name,
                                    e.target.value.toUpperCase(),
                                    variable.scope
                                  )
                                )
                              }
                              className="h-6 w-6 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                            />
                          )}
                          <input
                            type="text"
                            aria-label={`${variable.name} value`}
                            value={variable.value}
                            onChange={(e) =>
                              onUpdateCssFile(
                                activeCssPath,
                                setGlobalCssVariable(
                                  activeCss,
                                  variable.name,
                                  e.target.value,
                                  variable.scope
                                )
                              )
                            }
                            className="h-6 min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 font-mono text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            title={`Copy var(${variable.name})`}
                            aria-label={`Copy var(${variable.name})`}
                            onClick={() =>
                              handleCopyText(variable.id, `var(${variable.name})`)
                            }
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600 hover:text-blue-700"
                          >
                            {copiedKey === variable.id ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete variable ${variable.name}`}
                            onClick={() =>
                              onUpdateCssFile(
                                activeCssPath,
                                removeGlobalCssVariable(
                                  activeCss,
                                  variable.name,
                                  variable.scope
                                )
                              )
                            }
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'typography' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Body Font Family */}
                <div className="space-y-1.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 sm:col-span-2">
                  <div className="flex items-center gap-1.5">
                    <Type className="h-3.5 w-3.5 text-blue-600" />
                    <span className="text-[11px] font-semibold text-slate-800">
                      Document Body Typography &amp; Surface
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="global-font-preset"
                        className="mb-1 block text-[10px] font-medium text-slate-600"
                      >
                        Font Family Preset
                      </label>
                      <select
                        id="global-font-preset"
                        value={
                          FONT_FAMILY_PRESETS.some((f) => f.value === parsed.base.fontFamily)
                            ? parsed.base.fontFamily
                            : ''
                        }
                        onChange={(e) => {
                          if (!e.target.value) return;
                          onUpdateCssFile(
                            activeCssPath,
                            updateGlobalBaseStyles(activeCss, { fontFamily: e.target.value })
                          );
                        }}
                        className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-[11px] text-slate-800"
                      >
                        <option value="">Custom font stack…</option>
                        {FONT_FAMILY_PRESETS.map((f) => (
                          <option key={f.label} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="global-font-custom"
                        className="mb-1 block text-[10px] font-medium text-slate-600"
                      >
                        Body font-family CSS
                      </label>
                      <input
                        id="global-font-custom"
                        type="text"
                        placeholder="'Plus Jakarta Sans', sans-serif"
                        value={parsed.base.fontFamily}
                        onChange={(e) =>
                          onUpdateCssFile(
                            activeCssPath,
                            updateGlobalBaseStyles(activeCss, { fontFamily: e.target.value })
                          )
                        }
                        className="h-7 w-full rounded border border-slate-200 bg-white px-2 font-mono text-[11px] text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Base Size & Line Height */}
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label
                        htmlFor="global-font-size"
                        className="mb-1 block text-[10px] font-medium text-slate-600"
                      >
                        Base Font Size
                      </label>
                      <input
                        id="global-font-size"
                        type="text"
                        placeholder="16px"
                        value={parsed.base.fontSize}
                        onChange={(e) =>
                          onUpdateCssFile(
                            activeCssPath,
                            updateGlobalBaseStyles(activeCss, { fontSize: e.target.value })
                          )
                        }
                        className="h-7 w-full rounded border border-slate-200 px-2 font-mono text-[11px] tabular-nums text-slate-800"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="global-line-height"
                        className="mb-1 block text-[10px] font-medium text-slate-600"
                      >
                        Line Height
                      </label>
                      <input
                        id="global-line-height"
                        type="text"
                        placeholder="1.6"
                        value={parsed.base.lineHeight}
                        onChange={(e) =>
                          onUpdateCssFile(
                            activeCssPath,
                            updateGlobalBaseStyles(activeCss, { lineHeight: e.target.value })
                          )
                        }
                        className="h-7 w-full rounded border border-slate-200 px-2 font-mono text-[11px] tabular-nums text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-600">
                        Body Background
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          aria-label="Body background color"
                          value={toPickerHex(parsed.base.backgroundColor, '#F8FAFC')}
                          onChange={(e) =>
                            onUpdateCssFile(
                              activeCssPath,
                              updateGlobalBaseStyles(activeCss, {
                                backgroundColor: e.target.value.toUpperCase(),
                              })
                            )
                          }
                          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                        />
                        <input
                          type="text"
                          aria-label="Body background CSS value"
                          placeholder="#F8FAFC"
                          value={parsed.base.backgroundColor}
                          onChange={(e) =>
                            onUpdateCssFile(
                              activeCssPath,
                              updateGlobalBaseStyles(activeCss, { backgroundColor: e.target.value })
                            )
                          }
                          className="h-7 min-w-0 flex-1 rounded border border-slate-200 px-1.5 font-mono text-[11px] text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-600">
                        Body Text Color
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          aria-label="Body text color"
                          value={toPickerHex(parsed.base.color, '#0F172A')}
                          onChange={(e) =>
                            onUpdateCssFile(
                              activeCssPath,
                              updateGlobalBaseStyles(activeCss, {
                                color: e.target.value.toUpperCase(),
                              })
                            )
                          }
                          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                        />
                        <input
                          type="text"
                          aria-label="Body text color CSS value"
                          placeholder="#0F172A"
                          value={parsed.base.color}
                          onChange={(e) =>
                            onUpdateCssFile(
                              activeCssPath,
                              updateGlobalBaseStyles(activeCss, { color: e.target.value })
                            )
                          }
                          className="h-7 min-w-0 flex-1 rounded border border-slate-200 px-1.5 font-mono text-[11px] text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Headings & Links */}
                <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5">
                  <div>
                    <label
                      htmlFor="global-heading-font"
                      className="mb-1 block text-[10px] font-medium text-slate-600"
                    >
                      Headings (h1–h4) Font Family
                    </label>
                    <input
                      id="global-heading-font"
                      type="text"
                      placeholder="Inherit or 'Outfit', sans-serif"
                      value={parsed.base.headingFontFamily}
                      onChange={(e) =>
                        onUpdateCssFile(
                          activeCssPath,
                          updateGlobalBaseStyles(activeCss, {
                            headingFontFamily: e.target.value,
                          })
                        )
                      }
                      className="h-7 w-full rounded border border-slate-200 px-2 font-mono text-[11px] text-slate-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-600">
                        Headings Color
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          aria-label="Headings color picker"
                          value={toPickerHex(parsed.base.headingColor, '#0F172A')}
                          onChange={(e) =>
                            onUpdateCssFile(
                              activeCssPath,
                              updateGlobalBaseStyles(activeCss, {
                                headingColor: e.target.value.toUpperCase(),
                              })
                            )
                          }
                          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                        />
                        <input
                          type="text"
                          aria-label="Headings color value"
                          placeholder="#0F172A"
                          value={parsed.base.headingColor}
                          onChange={(e) =>
                            onUpdateCssFile(
                              activeCssPath,
                              updateGlobalBaseStyles(activeCss, {
                                headingColor: e.target.value,
                              })
                            )
                          }
                          className="h-7 min-w-0 flex-1 rounded border border-slate-200 px-1.5 font-mono text-[11px] text-slate-800"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-slate-600">
                        Links (a) Color
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          aria-label="Link color picker"
                          value={toPickerHex(parsed.base.linkColor, '#2563EB')}
                          onChange={(e) =>
                            onUpdateCssFile(
                              activeCssPath,
                              updateGlobalBaseStyles(activeCss, {
                                linkColor: e.target.value.toUpperCase(),
                              })
                            )
                          }
                          className="h-7 w-7 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                        />
                        <input
                          type="text"
                          aria-label="Link color value"
                          placeholder="#2563EB"
                          value={parsed.base.linkColor}
                          onChange={(e) =>
                            onUpdateCssFile(
                              activeCssPath,
                              updateGlobalBaseStyles(activeCss, {
                                linkColor: e.target.value,
                              })
                            )
                          }
                          className="h-7 min-w-0 flex-1 rounded border border-slate-200 px-1.5 font-mono text-[11px] text-slate-800"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'classes' && (
              <div className="space-y-3">
                {/* Quick Starter Class Templates */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2">
                  <span className="text-[10px] font-semibold text-slate-500 mr-1">
                    Quick Utility Classes:
                  </span>
                  {STARTER_CLASS_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.selector}
                      type="button"
                      onClick={() =>
                        onUpdateCssFile(
                          activeCssPath,
                          upsertGlobalCustomRule(activeCss, tpl.selector, tpl.declarations)
                        )
                      }
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-medium text-slate-700 hover:border-blue-400 hover:text-blue-700"
                    >
                      <Plus className="h-2.5 w-2.5" />
                      <span>{tpl.label}</span>
                    </button>
                  ))}
                </div>

                {/* Add New Rule Form */}
                <form
                  onSubmit={handleAddRule}
                  className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-2"
                >
                  <input
                    type="text"
                    aria-label="New CSS rule selector"
                    placeholder=".badge-accent"
                    value={newRuleSelector}
                    onChange={(e) => setNewRuleSelector(e.target.value)}
                    className="h-7 w-32 rounded border border-slate-200 px-2 font-mono text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    aria-label="Initial CSS property"
                    placeholder="property"
                    value={newRuleProp}
                    onChange={(e) => setNewRuleProp(e.target.value)}
                    className="h-7 w-28 rounded border border-slate-200 px-2 font-mono text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                  <input
                    type="text"
                    aria-label="Initial CSS value"
                    placeholder="value"
                    value={newRuleVal}
                    onChange={(e) => setNewRuleVal(e.target.value)}
                    className="h-7 min-w-[100px] flex-1 rounded border border-slate-200 px-2 font-mono text-[11px] text-slate-800 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-7 items-center gap-1 rounded bg-blue-600 px-2.5 text-[11px] font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Rule</span>
                  </button>
                </form>

                {/* Existing Custom Rules */}
                <div className="space-y-2">
                  {parsed.customRules.length === 0 ? (
                    <p className="rounded-md border border-dashed border-slate-200 py-4 text-center text-[11px] text-slate-500">
                      No custom class rules yet. Add a selector above or insert a quick utility class.
                    </p>
                  ) : (
                    parsed.customRules.map((rule) => {
                      const draftDecl = newRuleDraftDecls[rule.selector] || { prop: '', val: '' };
                      return (
                        <div
                          key={rule.id}
                          className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-1">
                            <span className="font-mono text-[11px] font-semibold text-blue-700">
                              {rule.selector}
                            </span>
                            <button
                              type="button"
                              aria-label={`Delete CSS rule ${rule.selector}`}
                              onClick={() =>
                                onUpdateCssFile(
                                  activeCssPath,
                                  removeGlobalCustomRule(activeCss, rule.selector)
                                )
                              }
                              className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[10px] text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Remove</span>
                            </button>
                          </div>

                          <div className="space-y-1">
                            {rule.declarations.map((decl, idx) => (
                              <div key={`${decl.property}-${idx}`} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  aria-label={`${rule.selector} property ${idx + 1}`}
                                  value={decl.property}
                                  onChange={(e) =>
                                    handleUpdateRuleDecl(rule.selector, rule.declarations, idx, {
                                      property: e.target.value,
                                    })
                                  }
                                  className="h-6 w-32 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[11px] text-slate-700"
                                />
                                {isColorLikeValue(decl.value) && (
                                  <input
                                    type="color"
                                    aria-label={`${rule.selector} ${decl.property} color`}
                                    value={toPickerHex(decl.value)}
                                    onChange={(e) =>
                                      handleUpdateRuleDecl(rule.selector, rule.declarations, idx, {
                                        value: e.target.value.toUpperCase(),
                                      })
                                    }
                                    className="h-6 w-6 shrink-0 cursor-pointer rounded border border-slate-200 p-0.5"
                                  />
                                )}
                                <input
                                  type="text"
                                  aria-label={`${rule.selector} ${decl.property} value`}
                                  value={decl.value}
                                  onChange={(e) =>
                                    handleUpdateRuleDecl(rule.selector, rule.declarations, idx, {
                                      value: e.target.value,
                                    })
                                  }
                                  className="h-6 min-w-0 flex-1 rounded border border-slate-200 px-1.5 font-mono text-[11px] text-slate-800"
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove declaration ${decl.property}`}
                                  onClick={() =>
                                    handleDeleteRuleDecl(rule.selector, rule.declarations, idx)
                                  }
                                  className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}

                            <div className="flex items-center gap-1.5 pt-1">
                              <input
                                type="text"
                                placeholder="new-property"
                                value={draftDecl.prop}
                                onChange={(e) =>
                                  setNewRuleDraftDecls((prev) => ({
                                    ...prev,
                                    [rule.selector]: { ...draftDecl, prop: e.target.value },
                                  }))
                                }
                                className="h-6 w-32 rounded border border-dashed border-slate-300 px-1.5 font-mono text-[10px] text-slate-700"
                              />
                              <input
                                type="text"
                                placeholder="value"
                                value={draftDecl.val}
                                onChange={(e) =>
                                  setNewRuleDraftDecls((prev) => ({
                                    ...prev,
                                    [rule.selector]: { ...draftDecl, val: e.target.value },
                                  }))
                                }
                                className="h-6 min-w-0 flex-1 rounded border border-dashed border-slate-300 px-1.5 font-mono text-[10px] text-slate-700"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddDeclToRule(rule.selector, rule.declarations)}
                                className="inline-flex h-6 items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-2 text-[10px] font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Plus className="h-2.5 w-2.5" />
                                <span>Add</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Live Global CSS Output */}
          <div className="flex flex-col gap-2 self-start rounded-lg border border-slate-200 bg-slate-950 p-2.5 text-slate-100 lg:sticky lg:top-0 lg:col-span-5">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-mono text-[11px] font-semibold text-slate-200">
                {activeCssPath}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyText('full-css', activeCss)}
                  className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-800"
                >
                  {copiedKey === 'full-css' ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedKey === 'full-css' ? 'Copied' : 'Copy CSS'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenInMonaco(activeCssPath)}
                  className="inline-flex items-center gap-1 rounded bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-sky-500"
                >
                  <Code2 className="h-3 w-3" />
                  <span>Monaco</span>
                </button>
              </div>
            </div>

            <pre
              data-testid="global-styles-css-preview"
              className="h-[136px] overflow-y-auto whitespace-pre-wrap break-words rounded bg-slate-900/90 p-2 font-mono text-[11px] leading-relaxed text-sky-200 studio-scroll"
            >
              <code>{activeCss}</code>
            </pre>

            <p className="text-[10px] text-slate-400">
              {parsed.variables.length} token{parsed.variables.length === 1 ? '' : 's'} ·{' '}
              {parsed.customRules.length} class rule{parsed.customRules.length === 1 ? '' : 's'} ·
              Live synced to canvas
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
