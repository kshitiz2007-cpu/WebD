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
  const [recipe, setRecipe] = useState('');
  const [testValue, setTestValue] = useState('');
  const [testOpen, setTestOpen] = useState(false);
  const [debugStep, setDebugStep] = useState(0);
  const [debugPaused, setDebugPaused] = useState(true);
  const [runtimeState, setRuntimeState] = useState<Record<string, unknown> | null>(null);
  const [runtimeStateUpdatedAt, setRuntimeStateUpdatedAt] = useState<number | null>(null);
  const [runtimeStateFilter, setRuntimeStateFilter] = useState('');
  const filteredRuntimeKeys = runtimeState ? Object.keys(runtimeState).filter((key) => !runtimeStateFilter || key.toLowerCase().includes(runtimeStateFilter.toLowerCase()) || JSON.stringify(runtimeState[key]).toLowerCase().includes(runtimeStateFilter.toLowerCase())) : [];
  React.useEffect(() => {
    const onRuntimeState = (event: MessageEvent) => {
      const message = event.data;
      if (!message || message.type !== 'studio:workflow-state') return;
      if (!message.state || typeof message.state !== 'object' || Array.isArray(message.state)) return;
      setRuntimeState(message.state as Record<string, unknown>);
      setRuntimeStateUpdatedAt(Date.now());
    };
    window.addEventListener('message', onRuntimeState);
    return () => window.removeEventListener('message', onRuntimeState);
  }, []);
  const applyRecipe = (key: string) => {
    if (!selected) return;
    const base = createRule(selected);
    const recipes: Record<string, Partial<VisualLogicRule>> = {
      showOnClick: { trigger: 'onClick', action: 'show', target: '', conditionOperator: 'always' },
      hideOnClick: { trigger: 'onClick', action: 'hide', target: '', conditionOperator: 'always' },
      toggleOnClick: { trigger: 'onClick', action: 'toggle', target: '', conditionOperator: 'always' },
      toastOnClick: { trigger: 'onClick', action: 'toast', value: 'Done!', conditionOperator: 'always' },
      goToPage: { trigger: 'onClick', action: 'navigate', target: '/page', conditionOperator: 'always' },
      inputRequired: { trigger: 'onSubmit', action: 'toast', value: 'Please fill out this field', conditionOperator: 'isEmpty', conditionValue: '' },
      copyInput: { trigger: 'onChange', action: 'setTextFromValue', target: '', valueSource: 'eventValue', conditionOperator: 'always' },
      incrementCounter: { trigger: 'onClick', action: 'increment', target: '', value: '1', conditionOperator: 'always' },
    };
    const patch = recipes[key]; if (!patch) return;
    onChange([...rules, { ...base, ...patch }]); setRecipe('');
  };
  const conditionPassesOperator = (op: LogicConditionOperator, value: string, compare: string) => {
    const numeric = Number(value), numericCompare = Number(compare);
    switch (op) {
      case 'always': return true;
      case 'equals': return value === compare;
      case 'notEquals': return value !== compare;
      case 'contains': return value.includes(compare);
      case 'greaterThan': return Number.isFinite(numeric) && Number.isFinite(numericCompare) && numeric > numericCompare;
      case 'lessThan': return Number.isFinite(numeric) && Number.isFinite(numericCompare) && numeric < numericCompare;
      case 'isEmpty': return value.trim() === '';
      case 'isNotEmpty': return value.trim() !== '';
      default: return false;
    }
  };
  const conditionPasses = (rule: VisualLogicRule, value: string) => { const base = conditionPassesOperator(rule.conditionOperator || 'always', value, rule.conditionValue || ''); const groups = rule.conditionGroups || []; if (!groups.length) return base; const groupResults = groups.map(g => conditionPassesOperator(g.operator, value, g.value)); const grouped = (rule.conditionGroupsLogic || 'AND') === 'OR' ? groupResults.some(Boolean) : groupResults.every(Boolean); return (rule.conditionOperator || 'always') === 'always' ? grouped : base && grouped; };
  const ruleForTest = selectedRules[selectedRules.length - 1] || selectedRules[0];
  const testResult = ruleForTest ? conditionPasses(ruleForTest, testValue) : null;
  const addConditionGroup = (rule: VisualLogicRule) => updateRule(rule.id, { conditionGroups: [...(rule.conditionGroups || []), { id: `cond-${Date.now()}`, operator: 'isNotEmpty', value: '' }] });
  const updateConditionGroup = (rule: VisualLogicRule, id: string, patch: { operator?: LogicConditionOperator; value?: string }) => updateRule(rule.id, { conditionGroups: (rule.conditionGroups || []).map(g => g.id === id ? { ...g, ...patch } : g) });
  const removeConditionGroup = (rule: VisualLogicRule, id: string) => updateRule(rule.id, { conditionGroups: (rule.conditionGroups || []).filter(g => g.id !== id) });


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

        <section className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-2">
          <div><h3 className="text-sm font-semibold text-emerald-900">Quick-start recipes</h3><p className="text-[11px] text-emerald-700">Ready-made interactions — choose one and customize it.</p></div>
          <select value={recipe} onChange={(e)=>{setRecipe(e.target.value); if(e.target.value) applyRecipe(e.target.value);}} className={inputClass} disabled={!selected}>
            <option value="">Choose a recipe…</option><option value="showOnClick">Click → Show another element</option><option value="hideOnClick">Click → Hide another element</option><option value="toggleOnClick">Click → Toggle another element</option><option value="toastOnClick">Click → Show notification</option><option value="goToPage">Click → Navigate to page</option><option value="inputRequired">Form → Required-field warning</option><option value="copyInput">Input → Copy typed value</option><option value="incrementCounter">Click → Increase counter</option>
          </select>
          {!selected && <p className="text-[10px] text-emerald-700">Select an element first to use recipes.</p>}
        </section>

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
                  <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50/70 p-2.5 space-y-2"><div className="flex items-center justify-between gap-2"><p className="text-[11px] font-semibold text-violet-900">Advanced condition group</p><button type="button" onClick={()=>addConditionGroup(rule)} className="rounded-md bg-violet-600 px-2 py-1 text-[10px] font-semibold text-white">＋ Add condition</button></div>{(rule.conditionGroups||[]).length>0&&<select value={rule.conditionGroupsLogic||'AND'} onChange={(e)=>updateRule(rule.id,{conditionGroupsLogic:e.target.value as 'AND'|'OR'})} className={inputClass}><option value="AND">All conditions must match (AND)</option><option value="OR">Any condition can match (OR)</option></select>}{(rule.conditionGroups||[]).map((group,gi)=><div key={group.id} className="rounded-md border border-violet-100 bg-white p-2 space-y-1.5"><div className="flex items-center justify-between"><span className="text-[10px] font-semibold text-violet-700">Condition {gi+1}</span><button type="button" onClick={()=>removeConditionGroup(rule,group.id)} className="text-[10px] text-rose-600">Remove</button></div><select value={group.operator} onChange={(e)=>updateConditionGroup(rule,group.id,{operator:e.target.value as LogicConditionOperator})} className={inputClass}>{CONDITIONS.filter(x=>x.value!=='always').map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select>{['equals','notEquals','contains','greaterThan','lessThan'].includes(group.operator)&&<input value={group.value} onChange={(e)=>updateConditionGroup(rule,group.id,{value:e.target.value})} placeholder="Compare value" className={inputClass}/>}</div>)}{(rule.conditionGroups||[]).length===0&&<p className="text-[10px] text-violet-700">Add extra checks; they are combined with the main condition.</p>}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5">
                  <div><label className={labelClass}>Delay before action (ms)</label><input type="number" min="0" max="60000" step="100" value={rule.delayMs ?? 0} onChange={(e) => updateRule(rule.id, { delayMs: Math.min(60000, Math.max(0, Number(e.target.value) || 0)) })} className={inputClass}/><p className="mt-1 text-[10px] text-amber-700">0–60,000 ms</p></div>
                  <div><label className={labelClass}>Repeat action</label><input type="number" min="1" max="20" step="1" value={rule.repeatCount ?? 1} onChange={(e) => updateRule(rule.id, { repeatCount: Math.min(20, Math.max(1, Math.floor(Number(e.target.value) || 1))) })} className={inputClass}/><p className="mt-1 text-[10px] text-amber-700">1–20 times (bounded)</p></div>
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

        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
          <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-emerald-900">Workflow variables</h3><p className="text-[11px] text-emerald-700">Shared keys for state actions across logic rules.</p></div><button type="button" onClick={() => { const defs = selectedRules[0]?.variables || []; const next = [...defs, { id: `var-${Date.now()}`, key: `variable${defs.length+1}`, type: 'string' as const, initialValue: '' }]; onChange(rules.map(r => selectedRules.some(s => s.id === r.id) ? { ...r, variables: next } : r)); }} className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs font-medium text-emerald-800">+ Add variable</button></div>
          {(() => { const defs = selectedRules[0]?.variables || []; return defs.length ? defs.map((v, i) => <div key={v.id} className="grid grid-cols-1 gap-2 rounded-lg bg-white p-2 sm:grid-cols-3"><input aria-label="Variable key" value={v.key} onChange={e => { const next = defs.map((d,j)=>j===i?{...d,key:e.target.value.replace(/[^a-zA-Z0-9_.-]/g,'')}:d); onChange(rules.map(r=>selectedRules.some(s=>s.id===r.id)?{...r,variables:next}:r)); }} placeholder="key" className={inputClass}/><select aria-label="Variable type" value={v.type} onChange={e=>{ const type=e.target.value as typeof v.type; const next=defs.map((d,j)=>j===i?{...d,type,initialValue:type==='boolean'?'false':type==='number'?'0':type==='array'?'[]':type==='object'?'{}':''}:d); onChange(rules.map(r=>selectedRules.some(s=>s.id===r.id)?{...r,variables:next}:r)); }} className={inputClass}><option value="string">String</option><option value="number">Number</option><option value="boolean">Boolean</option><option value="array">Array (JSON)</option><option value="object">Object (JSON)</option></select><div className="flex gap-1"><input aria-label="Initial value" value={v.initialValue} onChange={e=>{ const next=defs.map((d,j)=>j===i?{...d,initialValue:e.target.value}:d); onChange(rules.map(r=>selectedRules.some(s=>s.id===r.id)?{...r,variables:next}:r)); }} placeholder="Initial value" className={inputClass}/><button type="button" aria-label="Delete variable" onClick={()=>{ const next=defs.filter((_,j)=>j!==i); onChange(rules.map(r=>selectedRules.some(s=>s.id===r.id)?{...r,variables:next}:r)); }} className="rounded-md border border-red-100 px-2 text-red-600"><Trash2 size={14}/></button></div></div>) : <p className="text-xs text-emerald-700">No variables yet. Add one, then use its key in global-state actions (e.g. cart.count).</p> })()}
        </section>
        <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-2">
          <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-blue-900">Logic test bench</h3><p className="text-[11px] text-blue-700">Try sample values without changing the preview.</p></div><button type="button" onClick={()=>setTestOpen(!testOpen)} className="rounded-md border border-blue-200 bg-white px-2 py-1 text-xs font-medium text-blue-700">{testOpen?'Hide test':'Test rule'}</button></div>
          {testOpen && <div className="space-y-2"><label className={labelClass}>Sample trigger value</label><input value={testValue} onChange={(e)=>setTestValue(e.target.value)} placeholder="Try text, number, or leave blank" className={inputClass}/>{ruleForTest ? <div className="rounded-lg bg-white p-2 text-xs"><p className="font-semibold text-slate-800">Condition: {CONDITIONS.find(x=>x.value===(ruleForTest.conditionOperator||'always'))?.label||'Always run'}</p><p className="mt-1 text-slate-600">Compare with: <code>{ruleForTest.conditionValue||'(empty)'}</code></p><p className="mt-2 font-semibold">{testResult?'✓ IF branch would run':'↪ ELSE / no action branch would run'}</p><p className="mt-1 text-slate-600">Preview action: {testResult?ruleForTest.action:(ruleForTest.elseAction||'No ELSE action')} {testResult?ruleForTest.target:(ruleForTest.elseTarget||'')} {testResult?ruleForTest.value:(ruleForTest.elseValue||'')}</p></div>:<p className="text-xs text-slate-500">Add a rule to test it here.</p>}<button type="button" onClick={()=>setTestValue('')} className="rounded-md border bg-white px-2 py-1 text-xs">Reset sample</button></div>}
        </section>
        <section className="rounded-xl border border-slate-300 bg-slate-50 p-3 space-y-2">
          <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-slate-900">Step debugger</h3><p className="text-[11px] text-slate-500">Inspect selected rules in order (simulation only).</p></div><span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-slate-600">{Math.min(debugStep, selectedRules.length)}/{selectedRules.length}</span></div>
          <div className="flex gap-1.5"><button type="button" onClick={()=>{setDebugStep(0);setDebugPaused(true);}} className="rounded-md border bg-white px-2 py-1 text-xs">Reset</button><button type="button" onClick={()=>setDebugPaused(!debugPaused)} className="rounded-md border bg-white px-2 py-1 text-xs">{debugPaused?'Resume':'Pause'}</button><button type="button" disabled={!debugPaused || debugStep>=selectedRules.length} onClick={()=>setDebugStep(v=>Math.min(selectedRules.length,v+1))} className="rounded-md bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-40">Next step</button></div>
          {selectedRules.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-slate-700">Execution trace</p>
              {selectedRules.map((r, i) => (
                <div key={r.id} className={`rounded-md border px-2 py-1.5 text-[11px] ${i === debugStep - 1 ? 'border-blue-400 bg-blue-50' : i < debugStep ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                  <span className="font-semibold">{i < debugStep ? '✓' : i === debugStep ? '▶' : '○'} Step {i + 1}</span>
                  {' - '}{r.trigger}{' -> '}{r.action}{r.target ? (' - ' + r.target) : ''}{r.delayMs ? (' - wait ' + r.delayMs + 'ms') : ''}{r.repeatCount && r.repeatCount > 1 ? (' x' + r.repeatCount) : ''}
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-500">Add rules to inspect their order here.</p>}
          <p className="text-[10px] text-slate-500">This panel steps through the rule list for inspection; it does not execute preview-side effects.</p>
        </section>
        <section className="rounded-xl border border-teal-200 bg-teal-50/60 p-3 space-y-2">
          <div><h3 className="text-sm font-semibold text-teal-950">Runtime state inspector</h3><p className="text-[11px] text-teal-800">Live snapshots from preview shared state.</p></div>
          <input value={runtimeStateFilter} onChange={(e)=>setRuntimeStateFilter(e.target.value)} placeholder="Filter keys or values" className={inputClass}/>
          {runtimeState===null ? <p className="text-xs text-slate-600">Waiting for a workflow-state snapshot from Preview…</p> : <div className="rounded-lg border border-teal-100 bg-white p-2.5 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-500"><span>{runtimeStateUpdatedAt ? new Date(runtimeStateUpdatedAt).toLocaleTimeString() : 'Snapshot'}</span><button type="button" onClick={()=>{try{navigator.clipboard.writeText(JSON.stringify(runtimeState,null,2));}catch(_){}}} className="rounded border px-2 py-0.5 text-teal-700">Copy JSON</button></div>
            {filteredRuntimeKeys.length===0 ? <p className="text-xs text-slate-500">No matching keys.</p> : filteredRuntimeKeys.map((key)=><div key={key} className="border-b border-slate-100 py-1.5 last:border-0"><div className="text-[11px] font-semibold text-slate-700">{key}</div><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-600">{JSON.stringify(runtimeState[key],null,2)}</pre></div>)}
          </div>}
          <p className="text-[10px] text-teal-800">Read-only snapshot. It updates when preview emits a state change; state editing/reset is not connected yet.</p>
        </section>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-[11px] leading-relaxed text-violet-900"><p className="font-semibold">Visual workflow + shared state</p><p className="mt-1">Flow view displays each interaction as connected Trigger → Action nodes. Global state actions let workflows share data across routes. Use keys like <code>cart.items</code>; add an <b>Add item to state array</b> action, then <b>Save state to storage</b> before navigating to checkout.</p><p className="mt-2">Rules execute in Preview → Interact mode. Element actions still target canvas elements; state actions operate on the shared app state.</p></div>
      </div>
    </aside>
  );
}
