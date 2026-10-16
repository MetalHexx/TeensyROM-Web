import type {
  ControlIdentity,
  ControlMapping,
  KnownController,
  MappableControl,
} from '@teensyrom-nx/application';
import { buildOverlayTargets } from './mapping-overlay-targets';

const SPEED_A: ControlIdentity = { owner: 'A', control: 'speed' };
const STOP_B: ControlIdentity = { owner: 'B', control: 'stop' };
const CROSSFADER: ControlIdentity = { owner: 'mixer', control: 'crossfader' };

const CONTROLS: readonly MappableControl[] = [
  {
    identity: SPEED_A,
    name: 'Speed',
    nature: 'value',
    min: 0.5,
    max: 1.5,
    home: 1,
    step: null,
    defaults: { ccStyle: 'relative-offset', sensitivity: 0.01, stepAmount: 0.05 },
    read: () => 1,
    set: () => undefined,
  },
  { identity: STOP_B, name: 'Stop', nature: 'trigger', fire: () => undefined },
  {
    identity: CROSSFADER,
    name: 'Crossfader',
    nature: 'value',
    min: -1,
    max: 1,
    home: 0,
    step: null,
    defaults: { ccStyle: 'absolute', sensitivity: 0.01, stepAmount: 0.1 },
    read: () => 0,
    set: () => undefined,
  },
];

const CONTROLLERS: readonly KnownController[] = [
  { id: 'xl', name: 'Launch Control XL', lastPortId: 'p1', listening: true },
  { id: 'nano', name: 'nanoKONTROL', lastPortId: 'p2', listening: true },
];

function mapping(id: string, control: ControlIdentity, controllerId: string, number: number) {
  return {
    id,
    control,
    source: { controllerId, channel: 1, kind: 'cc', number },
    style: { kind: 'absolute', amount: null },
  } as ControlMapping;
}

describe('buildOverlayTargets', () => {
  it('builds one target per control, keyed and anchored, all selectable on an empty store', () => {
    const targets = buildOverlayTargets(CONTROLS, {
      learn: null,
      mappings: [],
      controllers: CONTROLLERS,
    });

    expect(targets).toEqual([
      {
        id: 'A:speed',
        anchor: '[data-deck="A"] [data-control="speed"]',
        state: 'selectable',
        accessibleName: 'Map Speed, deck A, not bound',
      },
      {
        id: 'B:stop',
        anchor: '[data-deck="B"] [data-control="stop"]',
        state: 'selectable',
        accessibleName: 'Map Stop, deck B, not bound',
      },
      {
        id: 'mixer:crossfader',
        anchor: '[data-control="crossfader"]',
        state: 'selectable',
        accessibleName: 'Map Crossfader, mixer, not bound',
      },
    ]);
  });

  it('marks a control with mappings bound and names every source it is bound to', () => {
    const targets = buildOverlayTargets(CONTROLS, {
      learn: null,
      mappings: [mapping('m1', SPEED_A, 'xl', 21), mapping('m2', SPEED_A, 'nano', 5)],
      controllers: CONTROLLERS,
    });

    expect(targets[0].state).toBe('bound');
    expect(targets[0].accessibleName).toBe(
      'Map Speed, deck A, bound to Launch Control XL · ch 1 · CC 21; nanoKONTROL · ch 1 · CC 5'
    );
    expect(targets[1].state).toBe('selectable');
  });

  it('marks the control being learned selected, ahead of bound', () => {
    const targets = buildOverlayTargets(CONTROLS, {
      learn: { control: SPEED_A, phase: 'waiting', replacing: null, source: null },
      mappings: [mapping('m1', SPEED_A, 'xl', 21), mapping('m2', CROSSFADER, 'xl', 8)],
      controllers: CONTROLLERS,
    });

    expect(targets.map((t) => t.state)).toEqual(['selected', 'selectable', 'bound']);
  });
});
