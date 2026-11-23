type Child = Node | string | null | undefined | false;
type Props = Record<string, unknown>;

/**
 * Tiny hyperscript helper: h('button', { class: 'x', onclick: fn }, 'Label').
 * Keys starting with "on" become event listeners; "class"/"text" are shortcuts;
 * other keys are set as properties when they exist on the element, else attributes.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = String(value);
    else if (key === 'text') el.textContent = String(value);
    else if (key.startsWith('on') && typeof value === 'function') {
      el.addEventListener(key.slice(2), value as EventListener);
    } else if (key in el) (el as unknown as Props)[key] = value;
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** Collapsible sidebar section. */
export function panel(title: string, ...children: Child[]): HTMLDetailsElement {
  return h('details', { class: 'panel', open: true }, h('summary', { text: title }), ...children);
}

export interface NumberFieldOptions {
  label: string;
  unit?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  title?: string;
  /** committed value (after clamping), fired on change */
  onChange?: (v: number) => void;
  /** live value while typing/dragging */
  onInput?: (v: number) => void;
}

export interface NumberField {
  readonly row: HTMLElement;
  readonly input: HTMLInputElement;
  value: number;
}

/** Labelled numeric input that clamps to [min, max] on commit. */
export function numberField(o: NumberFieldOptions): NumberField {
  const clamp = (v: number): number => {
    let x = Number.isFinite(v) ? v : o.value;
    if (o.min !== undefined) x = Math.max(o.min, x);
    if (o.max !== undefined) x = Math.min(o.max, x);
    return x;
  };
  const input = h('input', {
    type: 'number',
    value: String(o.value),
    min: o.min !== undefined ? String(o.min) : undefined,
    max: o.max !== undefined ? String(o.max) : undefined,
    step: o.step !== undefined ? String(o.step) : 'any',
    inputMode: 'decimal',
  });
  input.addEventListener('input', () => o.onInput?.(clamp(input.valueAsNumber)));
  input.addEventListener('change', () => {
    const v = clamp(input.valueAsNumber);
    input.value = String(v);
    o.onChange?.(v);
  });
  const label = h('label', { class: 'field', title: o.title }, h('span', { text: o.label }), h('span', { class: 'field-input' }, input, o.unit ? h('span', { class: 'unit', text: o.unit }) : null));
  return {
    row: label,
    input,
    get value() {
      return clamp(input.valueAsNumber);
    },
    set value(v: number) {
      input.value = String(v);
    },
  };
}

export const fmt = (v: number, digits = 3): string => (Math.abs(v) < 5e-13 ? 0 : v).toFixed(digits);
