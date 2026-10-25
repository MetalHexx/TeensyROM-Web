import { clamp } from '@sidablist/core';
import type { MappingStyleKind } from '../ports';
import type { MappableControl } from './mappable-controls';
import type { ControlNature, MappingStyle, MidiSourceKind } from './mapping.models';

export type RelativeStyleKind = 'relative-offset' | 'relative-signed';

/** The smallest amount a relative or step style keeps; the server rejects zero. */
const MIN_AMOUNT = 0.001;

/** What a style does, apart from when. `fire` is a one-shot button's only action. */
export type StyleAction =
  | 'fire'
  | 'toggle'
  | 'on'
  | 'off'
  | 'step'
  | 'hold'
  | 'absolute'
  | 'relative-offset'
  | 'relative-signed';

/** The key edge a style acts on. */
export type StyleTrigger = 'press' | 'release';

export function isRelativeKind(kind: MappingStyleKind): kind is RelativeStyleKind {
  return kind === 'relative-offset' || kind === 'relative-signed';
}

export function isStepKind(kind: MappingStyleKind): kind is 'step' | 'step-release' {
  return kind === 'step' || kind === 'step-release';
}

/** The kinds of the actions that have a release variant. Every other action's kind is the action
 *  itself, except that a one-shot or toggle acts on the press edge as `press` or `latch`. */
const RELEASE_KINDS: Partial<Record<StyleAction, MappingStyleKind>> = {
  fire: 'release',
  toggle: 'latch-release',
  on: 'on-release',
  off: 'off-release',
  step: 'step-release',
};

export function actionOf(kind: MappingStyleKind): StyleAction {
  switch (kind) {
    case 'press':
    case 'release':
      return 'fire';
    case 'latch':
    case 'latch-release':
      return 'toggle';
    case 'on':
    case 'on-release':
      return 'on';
    case 'off':
    case 'off-release':
      return 'off';
    case 'step':
    case 'step-release':
      return 'step';
    case 'hold':
    case 'absolute':
    case 'relative-offset':
    case 'relative-signed':
      return kind;
  }
}

/** `null` for a kind with no trigger choice: hold, absolute and the relative kinds. */
export function triggerOf(kind: MappingStyleKind): StyleTrigger | null {
  switch (kind) {
    case 'press':
    case 'latch':
    case 'on':
    case 'off':
    case 'step':
      return 'press';
    case 'release':
    case 'latch-release':
    case 'on-release':
    case 'off-release':
    case 'step-release':
      return 'release';
    case 'hold':
    case 'absolute':
    case 'relative-offset':
    case 'relative-signed':
      return null;
  }
}

/** The kind for an action at a trigger; the trigger is ignored for an action that has none. */
export function kindFor(action: StyleAction, trigger: StyleTrigger): MappingStyleKind {
  const release = RELEASE_KINDS[action];
  if (trigger === 'release' && release) {
    return release;
  }
  return action === 'fire' ? 'press' : action === 'toggle' ? 'latch' : action;
}

/** The styles a control of this nature offers for a source of this kind, in menu order. */
export function stylesFor(nature: ControlNature, sourceKind: MidiSourceKind): MappingStyleKind[] {
  switch (nature) {
    case 'trigger':
      return ['press', 'release'];
    case 'state':
      return ['latch', 'latch-release', 'on', 'on-release', 'off', 'off-release'];
    case 'hold':
      return ['hold'];
    case 'value':
      return sourceKind === 'cc'
        ? ['absolute', 'relative-offset', 'relative-signed', 'step', 'step-release']
        : ['step', 'step-release'];
  }
}

/** The styles this control offers for a source of this kind: its nature's, narrowed to the
 *  control's own `styles` when it declares them. */
export function stylesForControl(
  control: MappableControl,
  sourceKind: MidiSourceKind
): MappingStyleKind[] {
  const styles = stylesFor(control.nature, sourceKind);
  const allowed = control.nature === 'value' ? control.styles : undefined;
  return allowed === undefined ? styles : styles.filter((kind) => allowed.includes(kind));
}

/** The actions this control offers for a source, in menu order. */
export function actionsForControl(
  control: MappableControl,
  sourceKind: MidiSourceKind
): StyleAction[] {
  return [...new Set(stylesForControl(control, sourceKind).map(actionOf))];
}

export function isStyleAvailableFor(
  control: MappableControl,
  sourceKind: MidiSourceKind,
  kind: MappingStyleKind
): boolean {
  return stylesForControl(control, sourceKind).includes(kind);
}

/** The amount a fresh style of this kind starts with: the control's sensitivity for a relative
 *  kind, its step amount for a step kind, a hold's own default for `hold`, and `null` for everything
 *  else. */
export function defaultAmountFor(control: MappableControl, kind: MappingStyleKind): number | null {
  if (control.nature === 'hold') {
    return control.amountDefault;
  }
  if (control.nature !== 'value') {
    return null;
  }
  if (isRelativeKind(kind)) {
    return control.defaults.sensitivity;
  }
  return isStepKind(kind) ? control.defaults.stepAmount : null;
}

/** The style a source gets when first mapped onto a control, from the styles it allows. */
export function defaultStyle(control: MappableControl, sourceKind: MidiSourceKind): MappingStyle {
  switch (control.nature) {
    case 'trigger':
      return { kind: 'press', amount: null };
    case 'state':
      return { kind: 'latch', amount: null };
    case 'hold':
      return { kind: 'hold', amount: control.amountDefault };
    case 'value': {
      const preferred = sourceKind === 'note' ? 'step' : control.defaults.ccStyle;
      const kind = isStyleAvailableFor(control, sourceKind, preferred)
        ? preferred
        : stylesForControl(control, sourceKind)[0];
      return { kind, amount: defaultAmountFor(control, kind) };
    }
  }
}

/** Keeps an amount in what the server accepts for the kind: a relative amount in (0, 1], a hold's
 *  amount in (0, 1] (`null` for a hold that takes none), a step amount (either edge) in [−1, 1] and never zero,
 *  and `null` for every other kind. A missing or non-finite amount falls back to the control's
 *  default. */
export function clampAmount(
  control: MappableControl,
  kind: MappingStyleKind,
  amount: number | null
): number | null {
  if (kind === 'hold') {
    if (control.nature !== 'hold' || control.amountDefault === null) {
      return null;
    }
    return clamp(
      amount !== null && Number.isFinite(amount) ? amount : control.amountDefault,
      MIN_AMOUNT,
      1
    );
  }
  if (!isRelativeKind(kind) && !isStepKind(kind)) {
    return null;
  }
  const raw = amount !== null && Number.isFinite(amount) ? amount : defaultAmountFor(control, kind);
  const bounded = clamp(raw ?? MIN_AMOUNT, isStepKind(kind) ? -1 : MIN_AMOUNT, 1);
  return Math.abs(bounded) < MIN_AMOUNT ? Math.sign(bounded || 1) * MIN_AMOUNT : bounded;
}

/** How many ticks a relative encoder's raw CC value says it turned, signed.
 *  `relative-offset` is 64-centred (binary offset: 64 is no movement);
 *  `relative-signed` counts up from 1 and down from 127 (two's complement: 127 is −1, and 64
 *  itself reads as +64). */
export function relativeTicks(kind: RelativeStyleKind, raw: number): number {
  if (kind === 'relative-offset') {
    return raw - 64;
  }
  if (raw === 0) {
    return 0;
  }
  return raw <= 64 ? raw : raw - 128;
}
