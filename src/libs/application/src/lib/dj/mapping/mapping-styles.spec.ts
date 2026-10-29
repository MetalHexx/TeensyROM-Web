import { describe, it, expect } from 'vitest';
import type { MappableControl, ValueDefaults } from './mappable-controls';
import type { MappingStyleKind } from '../ports';
import {
  actionOf,
  actionsForControl,
  clampAmount,
  clampGrip,
  defaultAmountFor,
  defaultStyle,
  isStyleAvailableFor,
  kindFor,
  relativeTicks,
  stylesFor,
  stylesForControl,
  triggerOf,
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
const held: MappableControl = {
  identity,
  name: 'H',
  nature: 'hold',
  amountDefault: null,
  set: () => undefined,
};
const nudge: MappableControl = {
  identity,
  name: 'N',
  nature: 'hold',
  amountDefault: 0.05,
  set: () => undefined,
};

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
    ['state', 'cc', ['latch', 'latch-release', 'on', 'on-release', 'off', 'off-release']],
    ['state', 'note', ['latch', 'latch-release', 'on', 'on-release', 'off', 'off-release']],
    ['hold', 'note', ['hold']],
    ['hold', 'cc', ['hold']],
    ['value', 'cc', ['absolute', 'relative-offset', 'relative-signed', 'step', 'step-release']],
    ['value', 'note', ['step', 'step-release']],
  ] as const)('%s from a %s source offers %j', (nature, sourceKind, expected) => {
    expect(stylesFor(nature, sourceKind)).toEqual(expected);
  });

  it('agrees with isStyleAvailableFor on a control with no style list', () => {
    expect(isStyleAvailableFor(knob, 'note', 'absolute')).toBe(false);
    expect(isStyleAvailableFor(knob, 'cc', 'absolute')).toBe(true);
    expect(isStyleAvailableFor(trigger, 'cc', 'latch')).toBe(false);
  });
});

const ALL_KINDS: MappingStyleKind[] = [
  'press',
  'release',
  'latch',
  'latch-release',
  'on',
  'on-release',
  'off',
  'off-release',
  'hold',
  'absolute',
  'relative-offset',
  'relative-signed',
  'step',
  'step-release',
];

describe('action and trigger', () => {
  it.each(ALL_KINDS)('splits %s into an action and a trigger that rebuild it', (kind) => {
    expect(kindFor(actionOf(kind), triggerOf(kind) ?? 'press')).toBe(kind);
  });

  it('gives no trigger to hold, absolute and the relative kinds', () => {
    for (const kind of ['hold', 'absolute', 'relative-offset', 'relative-signed'] as const) {
      expect(triggerOf(kind)).toBeNull();
      expect(kindFor(kind, 'release')).toBe(kind);
    }
  });

  it('reads the release kinds as the release trigger of their press kind', () => {
    expect(triggerOf('step-release')).toBe('release');
    expect(actionOf('latch-release')).toBe('toggle');
    expect(kindFor('fire', 'release')).toBe('release');
    expect(kindFor('off', 'release')).toBe('off-release');
  });

  it.each([
    ['trigger', 'note', trigger, ['fire']],
    ['trigger', 'cc', trigger, ['fire']],
    ['state', 'note', toggle, ['toggle', 'on', 'off']],
    ['state', 'cc', toggle, ['toggle', 'on', 'off']],
    ['hold', 'note', held, ['hold']],
    ['value', 'note', knob, ['step']],
    ['value', 'cc', knob, ['absolute', 'relative-offset', 'relative-signed', 'step']],
  ] as const)(
    '%s from a %s source offers the actions',
    (_nature, sourceKind, control, expected) => {
      expect(actionsForControl(control, sourceKind)).toEqual(expected);
    }
  );
});

const selector = {
  ...value({ ccStyle: 'relative-offset', sensitivity: 1, stepAmount: 1 }),
  styles: ['relative-offset', 'relative-signed', 'step', 'step-release'],
  wholeSteps: true,
} as MappableControl;

describe('the control-aware styles', () => {
  it('offer a control with no style list what its nature offers', () => {
    expect(stylesForControl(knob, 'cc')).toEqual(stylesFor('value', 'cc'));
    expect(stylesForControl(trigger, 'note')).toEqual(stylesFor('trigger', 'note'));
    expect(actionsForControl(knob, 'cc')).toEqual([
      'absolute',
      'relative-offset',
      'relative-signed',
      'step',
    ]);
  });

  it('narrow a whole-step selection to the relative and step styles', () => {
    expect(stylesForControl(selector, 'cc')).toEqual([
      'relative-offset',
      'relative-signed',
      'step',
      'step-release',
    ]);
    expect(stylesForControl(selector, 'note')).toEqual(['step', 'step-release']);
    expect(actionsForControl(selector, 'cc')).toEqual([
      'relative-offset',
      'relative-signed',
      'step',
    ]);
    expect(actionsForControl(selector, 'note')).toEqual(['step']);
  });

  it('refuse absolute on a whole-step selection and keep it on an ordinary value', () => {
    expect(isStyleAvailableFor(selector, 'cc', 'absolute')).toBe(false);
    expect(isStyleAvailableFor(selector, 'cc', 'relative-signed')).toBe(true);
    expect(isStyleAvailableFor(knob, 'cc', 'absolute')).toBe(true);
  });

  it('default a whole-step selection to a relative encoder from a CC and a step from a note', () => {
    expect(defaultStyle(selector, 'cc')).toEqual({ kind: 'relative-offset', amount: 1 });
    expect(defaultStyle(selector, 'note')).toEqual({ kind: 'step', amount: 1 });
  });

  it('fall back to an allowed style when the preferred default is not allowed', () => {
    const absoluteFirst = {
      ...selector,
      defaults: { ccStyle: 'absolute', sensitivity: 1, stepAmount: 1 },
    } as MappableControl;

    expect(defaultStyle(absoluteFirst, 'cc').kind).toBe('relative-offset');
  });
});

describe('defaultStyle', () => {
  it.each([
    ['a trigger', trigger, 'cc', { kind: 'press', amount: null }],
    ['a state', toggle, 'note', { kind: 'latch', amount: null }],
    ['a hold with no amount', held, 'note', { kind: 'hold', amount: null }],
    ['a hold with an amount', nudge, 'note', { kind: 'hold', amount: 0.05 }],
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
    expect(defaultAmountFor(knob, 'step-release')).toBe(0.05);
    expect(defaultAmountFor(toggle, 'on-release')).toBeNull();
    expect(defaultAmountFor(knob, 'absolute')).toBeNull();
    expect(defaultAmountFor(trigger, 'step')).toBeNull();
  });

  it("is a hold control's own default for hold", () => {
    expect(defaultAmountFor(nudge, 'hold')).toBe(0.05);
    expect(defaultAmountFor(held, 'hold')).toBeNull();
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
    expect(clampAmount(knob, 'step-release', -3)).toBe(-1);
    expect(clampAmount(knob, 'step-release', 0)).not.toBe(0);
    expect(clampAmount(knob, 'step-release', Number.NaN)).toBe(0.05);
    expect(clampAmount(toggle, 'latch-release', 0.5)).toBeNull();
  });

  it('keeps a nudge hold in [0.001, 1], falling back to its default, and a voice hold at null', () => {
    expect(clampAmount(nudge, 'hold', 0.2)).toBe(0.2);
    expect(clampAmount(nudge, 'hold', null)).toBe(0.05);
    expect(clampAmount(nudge, 'hold', Number.NaN)).toBe(0.05);
    expect(clampAmount(nudge, 'hold', 0)).toBe(0.001);
    expect(clampAmount(nudge, 'hold', 5)).toBe(1);
    expect(clampAmount(held, 'hold', 0.5)).toBeNull();
    expect(clampAmount(held, 'hold', null)).toBeNull();
  });

  it('is null for a kind that takes no amount and falls back to the default for a missing one', () => {
    expect(clampAmount(knob, 'absolute', 0.5)).toBeNull();
    expect(clampAmount(trigger, 'press', 0.5)).toBeNull();
    expect(clampAmount(knob, 'relative-offset', null)).toBe(0.02);
    expect(clampAmount(knob, 'step', Number.NaN)).toBe(0.05);
  });

  it("keeps a hand's reach in 0.02-2 seconds, falling back to home for a missing one", () => {
    expect(clampAmount(knob, 'hand', 0.5)).toBe(0.5);
    expect(clampAmount(knob, 'hand', 0.001)).toBe(0.02);
    expect(clampAmount(knob, 'hand', 9)).toBe(2);
    expect(clampAmount(knob, 'hand', null)).toBe(0.13);
    expect(clampAmount(knob, 'hand', Number.NaN)).toBe(0.13);
  });
});

describe('clampGrip', () => {
  it("keeps a hand's grip in 0.05-3 seconds, falling back to home for a missing one", () => {
    expect(clampGrip('hand', 1)).toBe(1);
    expect(clampGrip('hand', 0.01)).toBe(0.05);
    expect(clampGrip('hand', 10)).toBe(3);
    expect(clampGrip('hand', undefined)).toBe(0.25);
    expect(clampGrip('hand', Number.NaN)).toBe(0.25);
  });

  it('is undefined for every other kind', () => {
    expect(clampGrip('relative-offset', 1)).toBeUndefined();
    expect(clampGrip('press', 0.25)).toBeUndefined();
  });
});

describe('pitch bend', () => {
  it('offers no styles on any control yet and defaults to the hand', () => {
    for (const nature of ['trigger', 'state', 'hold', 'value'] as const) {
      expect(stylesFor(nature, 'pitch-bend')).toEqual([]);
    }
    expect(defaultStyle(fader, 'pitch-bend')).toEqual({ kind: 'hand', amount: 0.13, grip: 0.25 });
    expect(isStyleAvailableFor(fader, 'pitch-bend', 'hand')).toBe(false);
  });

  it('reads the hand as its own action with no trigger', () => {
    expect(actionOf('hand')).toBe('hand');
    expect(triggerOf('hand')).toBeNull();
  });
});
