'use client';

import React, { useMemo, useState } from 'react';
import LogicFlowCanvas from './LogicFlowCanvas';
import { GitBranch, Plus, Trash2, X, Zap } from 'lucide-react';
import type { StudioElementSnapshot } from '@/lib/studio/types';
import type { LogicAction, LogicConditionOperator, LogicTrigger, LogicValueSource, VisualLogicRule } from '@/lib/studio/logic-engine';

interface LogicPanelProps {
  selected: StudioElementSnapshot | null;
  rules: VisualLogicRule[];
  availableTargets?: Array<{ id: string; label: string }>;
  onChange: (rules: VisualLogicRule[]) => void;
  onClose: () => void;
  isBottomSheet?: boolean;
}

const TRIGGERS: { value: LogicTrigger; label: string }[] = [
  { value: 'onClick', label: 'On click' },
  { value: 'onChange', label: 'On change' },
  { value: 'onInput', label: 'While typing (input)' },
  { value: 'onSubmit', label: 'On submit' },
  { value: 'onMouseEnter', label: 'On hover' },
  { value: 'onFocus', label: 'On focus' },
  { value: 'onBlur', label: 'On blur' },
];

const ACTIONS: { value: LogicAction; label: string }[] = [
  { value: 'show', label: 'Show element' },
  { value: 'hide', label: 'Hide element' },
  { value: 'toggle', label: 'Toggle element' },
  { value: 'setText', label: 'Set text' },
  { value: 'setTextFromValue', label: 'Copy event value to text' },
  { value: 'setValue', label: 'Set input / control value' },
  { value: 'increment', label: 'Increment number' },
  { value: 'decrement', label: 'Decrement number' },
  { value: 'navigate', label: 'Navigate to route' },
  { value: 'toast', label: 'Show toast' },
  { value: 'setState', label: 'Set global state' },
  { value: 'incrementState', label: 'Increment global state' },
  { value: 'addToArray', label: 'Add item to state array' },
  { value: 'removeFromArray', label: 'Remove item from state array' },
  { value: 'persistState', label: 'Save state to storage' },
  { value: 'loadState', label: 'Load state from storage' },
];

const CONDITIONS: { value: LogicConditionOperator; label: string }[] = [
  { value: 'always', label: 'Always run' },
  { value: 'equals', label: 'Value equals' },
  { value: 'notEquals', label: 'Value does not equal' },
  { value: 'contains', label: 'Value contains' },
  { value: 'greaterThan', label: 'Value is greater than' },
  { value: 'lessThan', label: 'Value is less than' },
  { value: 'isEmpty', label: 'Value is empty' },
  { value: 'isNotEmpty', label: 'Value is not empty' },
];

const inputClass = 'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500';

function createRule(selected: StudioElementSnapshot | null): VisualLogicRule {
  return {
    id: `logic-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    componentId: selected?.instanceStudioId || selected?.studioId || '',
    componentLabel: selected ? `<${selected.tagName.toLowerCase()}>` : 'Select a component',
    trigger: 'onClick',
    action: 'show',
    target: '',
    value: '',
    enabled: true,
    conditionOperator: 'always',
    conditionValue: '',
    valueSource: 'eventValue',
  };
}

export default function LogicPanel({ selected, rules, availableTargets = [], onChange, onClose, isBottomSheet = false }: LogicPanelProps) {
  const [mode, setMode] = useState<'basic' | 'flow'>('basic');
  const selectedRules = useMemo(
    () => selected ? rules.filter((rule) => rule.componentId === (selected.instanceStudioId || selected.studioId)) : rules,
    [rules, selected]
  );

  const updateRule = (id: string, patch: Partial<VisualLogicRule>) => {
    onChange(rules.map((rule) => rule.id === id ? { ...rule, ...patch } : rule));
  };

  const addRule = () => {
    if (!selected) return;
    onChange([...rules, createRule(selected)]);
  };

  const removeRule = (id: string) => onChange(rules.filter((rule) => rule.id !== id));

  return (
    <aside className={`flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-xl ${isBottomSheet ? 'rounded-t-2xl' : 'max-w-[360px]'}`}>
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><GitBranch className="h-4 w-4" /></span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Logic Builder</h2>
            <p className="text-[11px] text-slate-500">Create interactions visually</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close logic builder" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-4 w-4" /></button>
      </div>

      <div className="flex gap-1 border-b border-slate-100 px-4 py-2">
        <button type="button" onClick={() => setMode('basic')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'basic' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Basic mode</button>
        <button type="button" onClick={() => setMode('flow')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'flow' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Flow view</button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className={labelClass}>Selected component</p>
          {selected ? (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{selected.label || selected.tagName}</p>
                <p className="truncate font-mono text-[10px] text-slate-500">{selected.filePath} · {selected.instanceStudioId || selected.studioId}</p>
              </div>
              <span className="rounded-md bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{selected.tagName}</span>
            </div>
          ) : <p className="text-xs text-slate-500">Select an element on the canvas to add logic to it.</p>}
        </section>

        <div className="flex items-center justify-between">
          <div><h3 className="text-sm font-semibold text-slate-900">Interactions</h3><p className="text-[11px] text-slate-500">{selectedRules.length} rule(s) for this component</p></div>
          <button type="button" onClick={addRule} disabled={!selected} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-3.5 w-3.5" /> Add rule</button>
        </div>

        {selectedRules.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center">
            <Zap className="mx-auto mb-2 h-6 w-6 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">No logic yet</p>
            <p className="mt-1 text-xs text-slate-500">Add a trigger and action to define this component&apos;s behaviour.</p>
          </div>
        )}

        {selectedRules.map((rule, index) => (
          <article key={rule.id} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-700">{index + 1}</span><span className="text-xs font-semibold text-slate-700">Interaction rule</span></div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => updateRule(rule.id, { enabled: !rule.enabled })} className={`rounded-full px-2 py-1 text-[10px] font-semibold ${rule.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>{rule.enabled ? 'Enabled' : 'Disabled'}</button>
                <button type="button" onClick={() => removeRule(rule.id)} aria-label="Delete rule" className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>

            {mode === 'basic' ? (
              <div className="space-y-3 p-3">
                <div><label className={labelClass}>When</label><select value={rule.trigger} onChange={(e) => updateRule(rule.id, { trigger: e.target.value as LogicTrigger })} className={inputClass}>{TRIGGERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                <div className="flex justify-center"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-500">THEN</span></div>
                <div><label className={labelClass}>Action</label><select value={rule.action} onChange={(e) => updateRule(rule.id, { action: e.target.value as LogicAction })} className={inputClass}>{ACTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <label className={labelClass}>Condition</label>
                  <select value={rule.conditionOperator || 'always'} onChange={(e) => updateRule(rule.id, { conditionOperator: e.target.value as LogicConditionOperator })} className={inputClass}>
                    {CONDITIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                  {['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan'].includes(rule.conditionOperator || 'always') && (
                    <input value={rule.conditionValue || ''} onChange={(e) => updateRule(rule.id, { conditionValue: e.target.value })} placeholder="Compare with this value" className={inputClass + ' mt-2'} />
                  )}
                  <p className="mt-1.5 text-[10px] text-slate-500">Condition checks the value/text of the element that triggered this rule.</p>
                </div>
                {['setState', 'incrementState', 'addToArray', 'removeFromArray'].includes(rule.action) ? <div><label className={labelClass}>Global state key</label><input value={rule.target} onChange={(e) => updateRule(rule.id, { target: e.target.value })} placeholder="cart.items" className={inputClass} /></div> : !['toast', 'persistState', 'loadState'].includes(rule.action) && <div><label className={labelClass}>{rule.action === 'navigate' ? 'Route' : 'Target element'}</label><input list={rule.action === 'navigate' ? undefined : 'webd-logic-targets'} value={rule.target} onChange={(e) => updateRule(rule.id, { target: e.target.value })} placeholder={rule.action === 'navigate' ? '/about' : 'Choose an element or enter its ID'} className={inputClass} />{rule.action !== 'navigate' && <datalist id="webd-logic-targets">{availableTargets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</datalist>}</div>}
                {['setText', 'toast', 'increment', 'decrement', 'setState', 'incrementState', 'addToArray', 'removeFromArray'].includes(rule.action) && <div><label className={labelClass}>{rule.action === 'toast' ? 'Message' : rule.action === 'increment' || rule.action === 'decrement' || rule.action === 'incrementState' ? 'Step amount' : rule.action === 'addToArray' || rule.action === 'removeFromArray' ? 'Item JSON / match value' : 'New value'}</label><input value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })} placeholder={rule.action === 'increment' || rule.action === 'decrement' || rule.action === 'incrementState' ? '1' : rule.action === 'addToArray' ? '{"id":"sku-1","name":"Product","price":499,"quantity":1}' : 'Enter a value'} className={inputClass} /></div>}
                {['setState', 'incrementState', 'addToArray', 'removeFromArray', 'persistState', 'loadState'].includes(rule.action) && <p className="rounded-lg bg-violet-50 p-2 text-[10px] leading-relaxed text-violet-800">Global state key: use dot paths such as <code>cart.items</code>. State is shared across pages in Preview and can be persisted to local storage.</p>}
                {['setTextFromValue', 'setValue'].includes(rule.action) && <div><label className={labelClass}>Copy from trigger</label><select value={rule.valueSource || 'eventValue'} onChange={(e) => updateRule(rule.id, { valueSource: e.target.value as LogicValueSource })} className={inputClass}><option value="eventValue">Input / selected value</option><option value="eventText">Visible text</option><option value="literal">Fixed text</option></select>{rule.valueSource === 'literal' && <input value={rule.value} onChange={(e) => updateRule(rule.id, { value: e.target.value })} placeholder="Fixed value" className={inputClass + ' mt-2'} />}</div>}
              </div>
            ) : (
              <LogicFlowCanvas rule={rule} triggers={TRIGGERS} actions={ACTIONS} onChange={(patch) => updateRule(rule.id, patch)} />
            )}
          </article>
        ))}

        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-[11px] leading-relaxed text-violet-900"><p className="font-semibold">Visual workflow + shared state</p><p className="mt-1">Flow view displays each interaction as connected Trigger → Action nodes. Global state actions let workflows share data across routes. Use keys like <code>cart.items</code>; add an <b>Add item to state array</b> action, then <b>Save state to storage</b> before navigating to checkout.</p><p className="mt-2">Rules execute in Preview → Interact mode. Element actions still target canvas elements; state actions operate on the shared app state.</p></div>
      </div>
    </aside>
  );
}
