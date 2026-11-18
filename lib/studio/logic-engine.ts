export type LogicTrigger = 'onClick' | 'onChange' | 'onSubmit' | 'onMouseEnter';
export type LogicAction = 'show' | 'hide' | 'toggle' | 'setText' | 'navigate' | 'toast';

export interface VisualLogicRule {
  id: string;
  componentId: string;
  componentLabel: string;
  trigger: LogicTrigger;
  action: LogicAction;
  target: string;
  value: string;
  enabled: boolean;
}

const TRIGGERS = new Set<LogicTrigger>(['onClick', 'onChange', 'onSubmit', 'onMouseEnter']);
const ACTIONS = new Set<LogicAction>(['show', 'hide', 'toggle', 'setText', 'navigate', 'toast']);

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
    return [{
      id: rule.id.slice(0, 160),
      componentId: rule.componentId.slice(0, 512),
      componentLabel: typeof rule.componentLabel === 'string' ? rule.componentLabel.slice(0, 160) : '',
      trigger: rule.trigger as LogicTrigger,
      action: rule.action as LogicAction,
      target: typeof rule.target === 'string' ? rule.target.slice(0, 512) : '',
      value: typeof rule.value === 'string' ? rule.value.slice(0, 4000) : '',
      enabled: rule.enabled !== false,
    }];
  });
}
