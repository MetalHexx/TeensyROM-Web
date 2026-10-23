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

  it('describes a style, showing an amount as a percentage with at most one decimal', () => {
    expect(describeStyle({ kind: 'press', amount: null })).toBe('On press');
    expect(describeStyle({ kind: 'relative-offset', amount: 0.01 })).toBe('Relative · 1%');
    expect(describeStyle({ kind: 'relative-signed', amount: 0.015 })).toBe('Relative ± · 1.5%');
    expect(describeStyle({ kind: 'step', amount: 0.05 })).toBe('Step +5%');
    expect(describeStyle({ kind: 'step', amount: -0.05 })).toBe('Step −5%');
    expect(describeStyle({ kind: 'hold', amount: null })).toBe('Hold');
    expect(describeStyle({ kind: 'hold', amount: 0.05 })).toBe('Hold · 5%');
  });

  it('labels the owner of a control', () => {
    expect(ownerLabel('A')).toBe('deck A');
    expect(ownerLabel('mixer')).toBe('mixer');
  });
});
