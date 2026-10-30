import { describe, it, expect } from 'vitest';
import { describeSource, describeStyle, ownerLabel } from './mapping-labels';
import type { KnownController } from './mapping.models';

const controllers: KnownController[] = [
  { id: 'lc', name: 'Launch Control XL', lastPortId: null, listening: true },
];

describe('mapping labels', () => {
  it('describes a CC source and a note source, falling back for an unknown controller', () => {
    expect(
      describeSource({ controllerId: 'lc', channel: 1, kind: 'cc', number: 21 }, controllers)
    ).toBe('Launch Control XL · ch 1 · CC 21');
    expect(
      describeSource({ controllerId: 'lc', channel: 2, kind: 'note', number: 36 }, controllers)
    ).toBe('Launch Control XL · ch 2 · Note 36');
    expect(
      describeSource({ controllerId: 'gone', channel: 1, kind: 'cc', number: 1 }, controllers)
    ).toBe('Unknown controller · ch 1 · CC 1');
  });

  it('describes a pitch bend source with no number', () => {
    expect(
      describeSource({ controllerId: 'lc', channel: 1, kind: 'pitch-bend', number: 0 }, controllers)
    ).toBe('Launch Control XL · ch 1 · Pitch bend');
  });

  it('describes a hand style with its reach and grip in milliseconds', () => {
    expect(describeStyle({ kind: 'hand', amount: 0.13, grip: 0.25 }, 'pitch-bend')).toBe(
      'Hand · reach 130 ms · grip 250 ms'
    );
  });

  it.each([
    ['note', { kind: 'press', amount: null }, 'Note On'],
    ['note', { kind: 'release', amount: null }, 'Note Off'],
    ['cc', { kind: 'press', amount: null }, 'CC On'],
    ['cc', { kind: 'release', amount: null }, 'CC Off'],
    ['note', { kind: 'latch', amount: null }, 'Toggle · Note On'],
    ['note', { kind: 'latch-release', amount: null }, 'Toggle · Note Off'],
    ['note', { kind: 'on', amount: null }, 'Turn on · Note On'],
    ['note', { kind: 'on-release', amount: null }, 'Turn on · Note Off'],
    ['cc', { kind: 'off', amount: null }, 'Turn off · CC On'],
    ['cc', { kind: 'off-release', amount: null }, 'Turn off · CC Off'],
    ['note', { kind: 'step', amount: 0.05 }, 'Step +5% · Note On'],
    ['note', { kind: 'step-release', amount: 0.05 }, 'Step +5% · Note Off'],
    ['cc', { kind: 'step-release', amount: -0.05 }, 'Step −5% · CC Off'],
    ['note', { kind: 'hold', amount: null }, 'Hold'],
    ['note', { kind: 'hold', amount: 0.05 }, 'Hold · 5%'],
    ['cc', { kind: 'absolute', amount: null }, 'Absolute'],
    ['cc', { kind: 'relative-offset', amount: 0.01 }, 'Relative (binary offset) · 1%'],
    ['cc', { kind: 'relative-signed', amount: 0.015 }, "Relative (two's complement) · 1.5%"],
  ] as const)('describes a %s source style %j as %s', (sourceKind, style, expected) => {
    expect(describeStyle(style, sourceKind)).toBe(expected);
  });

  it('labels the owner of a control', () => {
    expect(ownerLabel('A')).toBe('deck A');
    expect(ownerLabel('mixer')).toBe('mixer');
    expect(ownerLabel('set')).toBe('set');
  });
});
