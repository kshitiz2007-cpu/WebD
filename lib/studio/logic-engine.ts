export type LogicTrigger =
  | 'onClick'
  | 'onChange'
  | 'onInput'
  | 'onSubmit'
  | 'onMouseEnter'
  | 'onFocus'
  | 'onBlur';

export type LogicAction =
  | 'show'
  | 'hide'
  | 'toggle'
  | 'setText'
  | 'setTextFromValue'
  | 'setValue'
  | 'increment'
  | 'decrement'
  | 'navigate'
  | 'toast'
  | 'setState'
  | 'incrementState'
  | 'addToArray'
  | 'removeFromArray'
  | 'persistState'
  | 'loadState';

export type LogicConditionOperator =
  | 'always'
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'greaterThan'
  | 'lessThan'
  | 'isEmpty'
  | 'isNotEmpty';

export type LogicValueSource = 'literal' | 'eventValue' | 'eventText';

export interface VisualLogicRule {
  id: string;
  componentId: string;
  componentLabel: string;
  trigger: LogicTrigger;
  action: LogicAction;
  target: string;
  value: string;
  enabled: boolean;
  /** Optional v2 condition. Missing means always run (legacy compatibility). */
  conditionOperator?: LogicConditionOperator;
  conditionValue?: string;
  /** Whether an action uses the typed value or the triggering control's value/text. */
  valueSource?: LogicValueSource;
  /** Optional ELSE branch; absent means the rule simply does nothing when its condition fails. */
  elseAction?: LogicAction;
  elseTarget?: string;
  elseValue?: string;
  flowLayout?: Record<string, { x: number; y: number }>;
  flowEdges?: Array<{ id: string; from: string; to: string; label?: string }>;
}

const TRIGGERS = new Set<LogicTrigger>([
  'onClick', 'onChange', 'onInput', 'onSubmit', 'onMouseEnter', 'onFocus', 'onBlur',
]);
const ACTIONS = new Set<LogicAction>([
  'show', 'hide', 'toggle', 'setText', 'setTextFromValue', 'setValue',
  'increment', 'decrement', 'navigate', 'toast',
  'setState', 'incrementState', 'addToArray', 'removeFromArray', 'persistState', 'loadState',
]);
const CONDITIONS = new Set<LogicConditionOperator>([
  'always', 'equals', 'notEquals', 'contains', 'greaterThan',
  'lessThan', 'isEmpty', 'isNotEmpty',
]);
const VALUE_SOURCES = new Set<LogicValueSource>(['literal', 'eventValue', 'eventText']);

/** Validate persisted project data before sending it into the preview iframe. */
export function normalizeLogicRules(value: unknown): VisualLogicRule[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): VisualLogicRule[] => {
    if (!item || typeof item !== 'object') return [];
    const rule = item as Record<string, unknown>;
    if (
      typeof rule.id !== 'string' ||
      typeof rule.componentId !== 'string' ||
      !TRIGGERS.has(rule.trigger as LogicTrigger) ||
      !ACTIONS.has(rule.action as LogicAction)
    ) return [];
    const conditionOperator = CONDITIONS.has(rule.conditionOperator as LogicConditionOperator)
      ? rule.conditionOperator as LogicConditionOperator
      : 'always';
    const valueSource = VALUE_SOURCES.has(rule.valueSource as LogicValueSource)
      ? rule.valueSource as LogicValueSource
      : 'literal';
    return [{
      id: rule.id.slice(0, 160),
      componentId: rule.componentId.slice(0, 512),
      componentLabel: typeof rule.componentLabel === 'string' ? rule.componentLabel.slice(0, 160) : '',
      trigger: rule.trigger as LogicTrigger,
      action: rule.action as LogicAction,
      target: typeof rule.target === 'string' ? rule.target.slice(0, 512) : '',
      value: typeof rule.value === 'string' ? rule.value.slice(0, 4000) : '',
      enabled: rule.enabled !== false,
      conditionOperator,
      conditionValue: typeof rule.conditionValue === 'string' ? rule.conditionValue.slice(0, 1000) : '',
      valueSource,
      elseAction: ACTIONS.has(rule.elseAction as LogicAction) ? rule.elseAction as LogicAction : undefined,
      elseTarget: typeof rule.elseTarget === 'string' ? rule.elseTarget.slice(0, 512) : '',
      elseValue: typeof rule.elseValue === 'string' ? rule.elseValue.slice(0, 4000) : '',
      flowLayout: rule.flowLayout && typeof rule.flowLayout === 'object' ? Object.fromEntries(Object.entries(rule.flowLayout as Record<string, unknown>).flatMap(([key, point]) => {
        if (!point || typeof point !== 'object') return [];
        const candidate = point as Record<string, unknown>;
        return typeof candidate.x === 'number' && Number.isFinite(candidate.x) && typeof candidate.y === 'number' && Number.isFinite(candidate.y)
          ? [[key.slice(0, 80), { x: Math.max(0, Math.min(5000, candidate.x)), y: Math.max(0, Math.min(5000, candidate.y)) }]] : [];
      })) : undefined,
      flowEdges: Array.isArray(rule.flowEdges) ? rule.flowEdges.filter((edge): edge is {id:string;from:string;to:string;label?:string} => !!edge && typeof edge.id === 'string' && typeof edge.from === 'string' && typeof edge.to === 'string').slice(0,100) : undefined,
    }];
  });
}
