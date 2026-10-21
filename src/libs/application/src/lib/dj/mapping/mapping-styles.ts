import { clamp } from '@sidablist/core';
import type { MappingStyleKind } from '../ports';
import type { MappableControl } from './mappable-controls';
import type { ControlNature, MappingStyle, MidiSourceKind } from './mapping.models';

export type RelativeStyleKind = 'relative-offset' | 'relative-signed';

/** The smallest amount a relative or step style keeps; the server rejects zero. */
const MIN_AMOUNT = 0.001;

export function isRelativeKind(kind: MappingStyleKind): kind is RelativeStyleKind {
  return kind === 'relative-offset' || kind === 'relative-signed';
}

/** The styles a control of this nature offers for a source of this kind, in menu order. */
export function stylesFor(nature: ControlNature, sourceKind: MidiSourceKind): MappingStyleKind[] {
  switch (nature) {
    case 'trigger':
      return ['press', 'release'];
    case 'state':
      return ['latch', 'on', 'off'];
    case 'hold':
      return ['hold'];
    case 'value':
      return sourceKind === 'cc'
        ? ['absolute', 'relative-offset', 'relative-signed', 'step']
        : ['step'];
  }
}

export function isStyleAvailable(
  nature: ControlNature,
  sourceKind: MidiSourceKind,
  kind: MappingStyleKind
): boolean {
  return stylesFor(nature, sourceKind).includes(kind);
}

/** The amount a fresh style of this kind starts with: the control's sensitivity for a relative
 *  kind, its step amount for `step`, and `null` for everything else. */
export function defaultAmountFor(control: MappableControl, kind: MappingStyleKind): number | null {
  if (control.nature !== 'value') {
    return null;
  }
  if (isRelativeKind(kind)) {
    return control.defaults.sensitivity;
  }
  return kind === 'step' ? control.defaults.stepAmount : null;
}

/** The style a source gets when first mapped onto a control. */
export function defaultStyle(control: MappableControl, sourceKind: MidiSourceKind): MappingStyle {
  switch (control.nature) {
    case 'trigger':
      return { kind: 'press', amount: null };
    case 'state':
      return { kind: 'latch', amount: null };
    case 'hold':
      return { kind: 'hold', amount: null };
    case 'value': {
      const kind = sourceKind === 'note' ? 'step' : control.defaults.ccStyle;
      return { kind, amount: defaultAmountFor(control, kind) };
    }
  }
}

/** Keeps an amount in what the server accepts for the kind: a relative amount in (0, 1], a step
 *  amount in [−1, 1] and never zero, and `null` for every other kind. A missing or non-finite
 *  amount falls back to the control's default. */
export function clampAmount(
  control: MappableControl,
  kind: MappingStyleKind,
  amount: number | null
): number | null {
  if (!isRelativeKind(kind) && kind !== 'step') {
    return null;
  }
  const raw = amount !== null && Number.isFinite(amount) ? amount : defaultAmountFor(control, kind);
  const bounded = clamp(raw ?? MIN_AMOUNT, kind === 'step' ? -1 : MIN_AMOUNT, 1);
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
