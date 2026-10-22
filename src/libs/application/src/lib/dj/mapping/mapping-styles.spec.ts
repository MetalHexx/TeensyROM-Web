import { describe, it, expect } from 'vitest';
import type { MappableControl, ValueDefaults } from './mappable-controls';
import {
  clampAmount,
  defaultAmountFor,
  defaultStyle,
  isStyleAvailable,
  relativeTicks,
  stylesFor,
} from './mapping-styles';

const identity = { owner: 'A', control: 'speed' } as const;

const trigger: MappableControl = { identity, name: 'T', nature: 'trigger', fire: () => undefined };
const toggle: MappableControl = {
  identity,
  name: 'S',
  nature: 'state',
  read: () => false,
  set: () => undefined,
};
const held: MappableControl = { identity, name: 'H', nature: 'hold', set: () => undefined };

function value(defaults: ValueDefaults): MappableControl {
  return {
    identity,
    name: 'V',
    nature: 'value',
    min: 0,
    max: 1,
    home: 0,
    step: null,
    defaults,
    read: () => 0,
    set: () => undefined,
  };
}

const fader = value({ ccStyle: 'absolute', sensitivity: 0.01, stepAmount: 0.1 });
const knob = value({ ccStyle: 'relative-offset', sensitivity: 0.02, stepAmount: 0.05 });

describe('relativeTicks', () => {
  it.each([
    ['relative-offset', 64, 0],
    ['relative-offset', 65, 1],
    ['relative-offset', 63, -1],
    ['relative-offset', 127, 63],
    ['relative-offset', 0, -64],
    ['relative-signed', 0, 0],
    ['relative-signed', 1, 1],
    ['relative-signed', 64, 64],
    ['relative-signed', 65, -63],
    ['relative-signed', 127, -1],
  ] as const)('%s reads %i as %i ticks', (kind, raw, ticks) => {
    expect(relativeTicks(kind, raw)).toBe(ticks);
  });
});

describe('stylesFor', () => {
  it.each([
    ['trigger', 'cc', ['press', 'release']],
    ['trigger', 'note', ['press', 'release']],
    ['state', 'cc', ['latch', 'on', 'off']],
    ['state', 'note', ['latch', 'on', 'off']],
    ['hold', 'note', ['hold']],
    ['hold', 'cc', ['hold']],
    ['value', 'cc', ['absolute', 'relative-offset', 'relative-signed', 'step']],
    ['value', 'note', ['step']],
  ] as const)('%s from a %s source offers %j', (nature, sourceKind, expected) => {
    expect(stylesFor(nature, sourceKind)).toEqual(expected);
  });

  it('agrees with isStyleAvailable', () => {
    expect(isStyleAvailable('value', 'note', 'absolute')).toBe(false);
    expect(isStyleAvailable('value', 'cc', 'absolute')).toBe(true);
    expect(isStyleAvailable('trigger', 'cc', 'latch')).toBe(false);
  });
});

describe('defaultStyle', () => {
  it.each([
    ['a trigger', trigger, 'cc', { kind: 'press', amount: null }],
    ['a state', toggle, 'note', { kind: 'latch', amount: null }],
    ['a hold', held, 'note', { kind: 'hold', amount: null }],
    ['a value from a note', knob, 'note', { kind: 'step', amount: 0.05 }],
    [
      'a value that defaults to absolute from a CC',
      fader,
      'cc',
      { kind: 'absolute', amount: null },
    ],
    [
      'a value that defaults to relative from a CC',
      knob,
      'cc',
      { kind: 'relative-offset', amount: 0.02 },
    ],
  ] as const)('gives %s the desktop default', (_label, control, sourceKind, expected) => {
    expect(defaultStyle(control, sourceKind)).toEqual(expected);
  });
});

describe('defaultAmountFor', () => {
  it('is the sensitivity for a relative kind, the step amount for step, and null otherwise', () => {
    expect(defaultAmountFor(knob, 'relative-signed')).toBe(0.02);
    expect(defaultAmountFor(knob, 'step')).toBe(0.05);
    expect(defaultAmountFor(knob, 'absolute')).toBeNull();
    expect(defaultAmountFor(trigger, 'step')).toBeNull();
  });
});

describe('clampAmount', () => {
  it('keeps a relative amount in (0, 1] and a step amount in [-1, 1] but never zero', () => {
    expect(clampAmount(knob, 'relative-offset', 5)).toBe(1);
    expect(clampAmount(knob, 'relative-signed', 0)).toBeGreaterThan(0);
    expect(clampAmount(knob, 'relative-offset', -0.5)).toBeGreaterThan(0);
    expect(clampAmount(knob, 'step', -3)).toBe(-1);
    expect(clampAmount(knob, 'step', 0)).not.toBe(0);
    expect(clampAmount(knob, 'step', -0.25)).toBe(-0.25);
  });

  it('is null for a kind that takes no amount and falls back to the default for a missing one', () => {
    expect(clampAmount(knob, 'absolute', 0.5)).toBeNull();
    expect(clampAmount(trigger, 'press', 0.5)).toBeNull();
    expect(clampAmount(knob, 'relative-offset', null)).toBe(0.02);
    expect(clampAmount(knob, 'step', Number.NaN)).toBe(0.05);
  });
});
