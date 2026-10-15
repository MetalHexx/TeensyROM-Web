import { describe, it, expect } from 'vitest';
import type { Device } from '@teensyrom-nx/domain';
import { cartridgeOptions } from './cartridge-options';
import type { DeckBindingState } from './dj-store';
import type { MidiPortOption } from './ports';
import type { Slot } from './slot';

const unbound: DeckBindingState = { device: null, portId: null, present: false, error: null };

function bindings(
  overrides: Partial<Record<Slot, DeckBindingState>> = {}
): Record<Slot, DeckBindingState> {
  return { A: unbound, B: unbound, ...overrides };
}

function bound(id: string, name: string, present = false): DeckBindingState {
  return { device: { id, name }, portId: present ? `port-${id}` : null, present, error: null };
}

function device(deviceId: string, name: string): Device {
  return { deviceId, name } as Device;
}

function output(token: string, manufacturer = 'Microsoft Corporation'): MidiPortOption {
  return { id: `port-${token}`, name: `TeensyROM-${token}`, manufacturer };
}

describe('cartridgeOptions', () => {
  it('lists a known device that is plugged in with its name, port and manufacturer', () => {
    const options = cartridgeOptions(
      'A',
      bindings(),
      [output('14470230')],
      [device('14470230', 'TR-1')]
    );

    expect(options).toEqual([
      {
        id: '14470230',
        label: 'TR-1: TeensyROM-14470230 (Microsoft Corporation)',
        present: true,
        takenBy: null,
      },
    ]);
  });

  it('lists a known device whose port is missing as absent', () => {
    const options = cartridgeOptions('A', bindings(), [], [device('19277260', 'TR-2')]);

    expect(options).toEqual([
      { id: '19277260', label: 'TR-2: TeensyROM-19277260 · absent', present: false, takenBy: null },
    ]);
  });

  it('lists an output the server does not know by the port part alone', () => {
    const options = cartridgeOptions('A', bindings(), [output('55555')], []);

    expect(options).toEqual([
      {
        id: '55555',
        label: 'TeensyROM-55555 (Microsoft Corporation)',
        present: true,
        takenBy: null,
      },
    ]);
  });

  it("lists this slot's bound cartridge when neither a device nor an output names it", () => {
    const options = cartridgeOptions('A', bindings({ A: bound('19277260', 'TR-2') }), [], []);

    expect(options).toEqual([
      { id: '19277260', label: 'TR-2: TeensyROM-19277260 · absent', present: false, takenBy: null },
    ]);
  });

  it("does not list the other slot's bound cartridge unless a source names it", () => {
    expect(cartridgeOptions('A', bindings({ B: bound('19277260', 'TR-2') }), [], [])).toEqual([]);
  });

  it('deduplicates a device and the output that carries it into one option', () => {
    const options = cartridgeOptions(
      'A',
      bindings({ A: bound('14470230', 'TR-1', true) }),
      [output('14470230')],
      [device('14470230', 'TR-1')]
    );

    expect(options).toHaveLength(1);
  });

  it('orders options by label', () => {
    const options = cartridgeOptions(
      'A',
      bindings(),
      [output('2')],
      [device('3', 'Zed'), device('1', 'Alpha'), device('2', 'Mid')]
    );

    expect(options.map((option) => option.id)).toEqual(['1', '2', '3']);
  });

  it('does not list outputs with no TeensyROM token', () => {
    const options = cartridgeOptions(
      'A',
      bindings(),
      [{ id: 'synth', name: 'Wavetable Synth', manufacturer: 'Acme' }],
      []
    );

    expect(options).toEqual([]);
  });

  it('skips a token the server would refuse as a device id', () => {
    const tooLong = 'A'.repeat(33);

    const options = cartridgeOptions('A', bindings(), [output(tooLong)], []);

    expect(options).toEqual([]);
  });

  it('marks a cartridge the other slot holds as taken by that slot, in either direction', () => {
    const held = bindings({ B: bound('14470230', 'TR-1', true) });
    const devices = [device('14470230', 'TR-1'), device('19277260', 'TR-2')];

    expect(cartridgeOptions('A', held, [], devices).map((o) => o.takenBy)).toEqual(['B', null]);
    expect(
      cartridgeOptions('B', bindings({ A: bound('19277260', 'TR-2') }), [], devices).map(
        (o) => o.takenBy
      )
    ).toEqual([null, 'A']);
  });

  it("never marks the slot's own cartridge as taken", () => {
    const options = cartridgeOptions(
      'A',
      bindings({ A: bound('14470230', 'TR-1', true) }),
      [output('14470230')],
      [device('14470230', 'TR-1')]
    );

    expect(options[0].takenBy).toBeNull();
  });

  it('reports presence from the output, not from the device being connected', () => {
    const connected = { ...device('14470230', 'TR-1'), isConnected: true } as Device;

    const [option] = cartridgeOptions('A', bindings(), [], [connected]);

    expect(option.present).toBe(false);
  });
});
