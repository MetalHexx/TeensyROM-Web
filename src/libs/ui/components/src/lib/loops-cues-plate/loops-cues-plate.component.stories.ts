import type { Meta, StoryObj } from '@storybook/angular';
import type { LoopBoundaryModel } from '../loop-boundary/loop-boundary.component';
import type { LoopSelectedRowModel } from '../loop-selected-row/loop-selected-row.component';
import type { LoopTileModel } from '../loop-tile/loop-tile.component';
import { LoopsCuesPlateComponent, type LoopsCuesPlateModel } from './loops-cues-plate.component';

/** How far the running tile's timeline fills: what a painter sets live through `setLiveProgress`
 *  (the `--loop-tile-progress` the tiles inherit). A story arg here, set on the wrapper. */
interface ProgressArgs {
  runningProgressPercent: number;
}

const meta: Meta<LoopsCuesPlateComponent & ProgressArgs> = {
  title: 'DJ/Loops Cues Plate',
  component: LoopsCuesPlateComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's loops/cues faceplate: an engraved caption with the Add and Stop keys, the " +
          'fixed selected-loop row (In and Out keys, a Length row and a Move row), and a two-column tile ' +
          'grid that takes the remaining height and ' +
          'scrolls. Purely presentational — it holds no state of its own; the caller owns every ' +
          'marker, the drag offsets and the running tile’s progress, which a painter sets live ' +
          'through `setLiveProgress`. Each tile and the selected row ' +
          'carry a play-now key; the selected row adds the GBL switch, and a marker with its own ' +
          'settings shows a lit dot on its tile.',
      },
    },
  },
  argTypes: {
    model: { description: "Everything the plate draws: names, flags, the selected row and the tiles." },
    runningProgressPercent: {
      description: '0–100, as `setLiveProgress` sets it; reaches only the running tile.',
    },
    playNowSelected: { description: "Emits when the selected row's play-now key is pressed." },
    toggleGlobal: { description: "Emits when the selected row's GBL switch is pressed." },
    toggleWrap: { description: "Emits when the selected row's WRAP switch is pressed." },
    playNowTile: { description: "Emits a tile's id when its play-now key is pressed." },
  },
  render: (args) => ({
    props: args,
    template: `
      <div
        style="width: 474px; height: 360px; display: flex; flex-direction: column"
        [style.--loop-tile-progress]="runningProgressPercent + '%'"
      >
        <lib-loops-cues-plate [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LoopsCuesPlateComponent & ProgressArgs>;

function boundary(tag: 'Start' | 'End', overrides: Partial<LoopBoundaryModel> = {}): LoopBoundaryModel {
  const lower = tag.toLowerCase();
  const isStart = tag === 'Start';
  return {
    key: {
      label: isStart ? 'In' : 'Out',
      accessibleName: `Loop ${isStart ? 'in' : 'out'} selected deck A`,
      control: isStart ? 'loop-in' : 'loop-set-end',
      disabled: false,
    },
    empty: false,
    disabled: false,
    offsetFrames: 0,
    rangeFrames: 50,
    tickPercents: [12, 38, 64, 90],
    nudgeAccessibleName: `Nudge ${lower} deck A`,
    earlierAccessibleName: `Move ${lower} earlier deck A`,
    laterAccessibleName: `Move ${lower} later deck A`,
    ...overrides,
  };
}

const LENGTH_BEATS = [1, 2, 4, 8, 16, 32];
const MOVE_STEPS = [1, 2, 4, 8, 16] as const;

function beatsLabel(beats: number): string {
  return beats === 1 ? '1 BEAT' : `${beats} BEATS`;
}

function lengthModel(text: string, onGrid: boolean): LoopSelectedRowModel['length'] {
  return {
    text,
    options: onGrid
      ? LENGTH_BEATS.map((beats) => ({
          beats,
          label: beatsLabel(beats),
          selected: text === beatsLabel(beats),
        }))
      : [],
    halveAccessibleName: 'Halve selected deck A',
    doubleAccessibleName: 'Double selected deck A',
    pickAccessibleName: 'Loop length selected deck A',
  };
}

function moveModel(onGrid: boolean): LoopSelectedRowModel['move'] {
  return {
    stepText: '1 BEAT',
    options: onGrid
      ? MOVE_STEPS.map((beats) => ({ beats, label: beatsLabel(beats), selected: beats === 1 }))
      : [],
    earlierAccessibleName: 'Move selected earlier deck A',
    laterAccessibleName: 'Move selected later deck A',
    pickAccessibleName: 'Move step deck A',
  };
}

function emptySelected(onGrid = true): LoopSelectedRowModel {
  return {
    empty: true,
    name: '',
    kindLabel: '',
    spanText: '',
    activity: 'idle',
    ready: true,
    triggerDisabled: true,
    clearEndDisabled: true,
    deleteDisabled: true,
    start: boundary('Start', {
      disabled: true,
      tickPercents: [],
      key: { ...boundary('Start').key, disabled: true },
    }),
    end: boundary('End', {
      empty: true,
      disabled: true,
      tickPercents: [],
      key: { ...boundary('End').key, disabled: true },
    }),
    length: lengthModel('—', false),
    move: moveModel(onGrid),
    triggerAccessibleName: 'Trigger selected deck A',
    clearEndAccessibleName: 'Clear end deck A',
    deleteAccessibleName: 'Delete selected deck A',
    playNowDisabled: true,
    playNowAccessibleName: 'Play now selected deck A',
    sharesGlobal: true,
    globalDisabled: true,
    globalAccessibleName: 'GBL selected deck A',
    wraps: false,
    wrapDisabled: true,
    wrapAccessibleName: 'WRAP selected deck A',
    renameDisabled: false,
    renameLabel: 'Rename selected deck A',
    nameMaxLength: 48,
  };
}

function selectedFor(tile: LoopTileModel, onGrid = true): LoopSelectedRowModel {
  const isCue = tile.kind === 'cue';
  return {
    ...emptySelected(onGrid),
    empty: false,
    name: tile.name,
    kindLabel: isCue ? 'CUE' : 'LOOP',
    spanText: isCue ? '02:43.2' : '02:39.4–02:47.5',
    activity: tile.activity,
    ready: tile.ready,
    triggerDisabled: false,
    clearEndDisabled: isCue,
    deleteDisabled: false,
    playNowDisabled: false,
    playNowAccessibleName: `Play now ${tile.name} deck A`,
    sharesGlobal: !tile.ownSettings,
    globalDisabled: false,
    globalAccessibleName: `GBL ${tile.name} deck A`,
    wrapDisabled: isCue,
    wrapAccessibleName: `WRAP ${tile.name} deck A`,
    renameDisabled: false,
    renameLabel: `Rename ${tile.name}`,
    nameMaxLength: 48,
    start: boundary('Start'),
    end: boundary('End', { empty: isCue }),
    length: lengthModel(isCue ? 'NO END' : tile.lengthText, onGrid),
  };
}

function tile(number: number, overrides: Partial<LoopTileModel> = {}): LoopTileModel {
  const kind = overrides.kind ?? 'loop';
  return {
    id: `item-${number}`,
    name: `Item ${number}`,
    kind,
    lengthText: kind === 'cue' ? 'CUE' : `${number * 4} BEATS`,
    activity: 'idle',
    selected: false,
    ready: true,
    triggerAccessibleName: `Trigger Item ${number}`,
    selectAccessibleName: `Select Item ${number}, ${kind}`,
    ownSettings: false,
    playNowAccessibleName: `Play now Item ${number}`,
    ...overrides,
  };
}

function plateModel(
  tiles: readonly LoopTileModel[],
  overrides: Partial<LoopsCuesPlateModel> = {}
): LoopsCuesPlateModel {
  const selected = tiles.find((candidate) => candidate.selected);
  return {
    accessibleName: 'Loops/Cues deck A',
    addAccessibleName: 'Add marker deck A',
    stopAccessibleName: 'Stop loop deck A',
    addDisabled: false,
    stopDisabled: false,
    gridAccessibleName: 'Loops and cues, deck A',
    emptyText: null,
    selected: selected ? selectedFor(selected) : emptySelected(),
    tiles,
    ...overrides,
  };
}

/** No tune loaded: Add and Stop are disabled and the grid says why. */
export const EmptyNoTune: Story = {
  args: {
    runningProgressPercent: 0,
    model: plateModel([], {
      addDisabled: true,
      stopDisabled: true,
      emptyText: 'Load a tune to add loops',
    }),
  },
};

/** A tune is loaded but nothing has been captured yet: Add is live. */
export const NoMarkers: Story = {
  args: {
    runningProgressPercent: 0,
    model: plateModel([], { stopDisabled: true, emptyText: 'No loops or cues yet' }),
  },
};

/** A few markers: the selected loop is running and another is queued. */
export const FewMarkers: Story = {
  args: {
    runningProgressPercent: 53,
    model: plateModel([
      tile(1, { selected: true, activity: 'running' }),
      tile(2, { activity: 'queued' }),
      tile(3, { kind: 'cue' }),
    ]),
  },
};

/** A mix: Items 2 and 4 keep their own settings (lit dot), the selected Item 2's GBL is unlit. */
export const MixedSettings: Story = {
  args: {
    runningProgressPercent: 40,
    model: plateModel([
      tile(1),
      tile(2, { selected: true, activity: 'running', ownSettings: true }),
      tile(3, { kind: 'cue' }),
      tile(4, { ownSettings: true }),
    ]),
  },
};

/** A loop on the grid selected: lengths in beats, the Length and Move pickers live. */
export const LoopOnGrid: Story = {
  args: {
    runningProgressPercent: 0,
    model: plateModel([
      tile(1, { selected: true, lengthText: '16 BEATS' }),
      tile(2, { lengthText: '8 BEATS' }),
    ]),
  },
};

/** A cue selected: the Length readout says NO END and the End row keeps an enabled Out key. */
export const CueNoEnd: Story = {
  args: {
    runningProgressPercent: 0,
    model: plateModel([
      tile(1, { lengthText: '16 BEATS' }),
      tile(2, { kind: 'cue', selected: true }),
    ]),
  },
};

/** A loop off the grid: its length reads in seconds and the Length picker is plain text. */
export const OffGridLoop: Story = {
  args: {
    runningProgressPercent: 0,
    model: (() => {
      const loop = tile(1, { selected: true, lengthText: '7.8s' });
      return plateModel([loop, tile(2, { lengthText: '13.4s' })], {
        selected: { ...selectedFor(loop), length: lengthModel('7.8s', false) },
      });
    })(),
  },
};

/** No grid on the deck: the Length and Move readouts are plain text, with no pickers. */
export const NoGrid: Story = {
  args: {
    runningProgressPercent: 0,
    model: (() => {
      const loop = tile(1, { selected: true, lengthText: '7.8s' });
      return plateModel([loop, tile(2, { lengthText: '13.4s' })], {
        selected: selectedFor(loop, false),
      });
    })(),
  },
};

/** Many markers: the grid scrolls, the selected row stays put, and the selection sits lower. */
export const ManyMarkers: Story = {
  args: {
    runningProgressPercent: 30,
    model: plateModel(
      Array.from({ length: 14 }, (_, index) => {
        const number = index + 1;
        return tile(number, {
          kind: number % 4 === 0 ? 'cue' : 'loop',
          selected: number === 9,
          activity: number === 2 ? 'running' : 'idle',
        });
      })
    ),
  },
};

/** The six items of the queued-jump sequence, with the given states applied by item number. */
function jumpTiles(states: Record<number, Partial<LoopTileModel>>): LoopTileModel[] {
  const lengths = ['8 BEATS', '16 BEATS', 'CUE', '8 BEATS', '4 BEATS', 'CUE'];
  return lengths.map((lengthText, index) =>
    tile(index + 1, {
      kind: lengthText === 'CUE' ? 'cue' : 'loop',
      lengthText,
      ...states[index + 1],
    })
  );
}

/** A queued jump, step 1: Item 2 runs, Item 4 is queued, and the knob has moved on to Item 5. */
export const QueuedJumpKnobMovedOn: Story = {
  args: {
    runningProgressPercent: 53,
    model: plateModel(
      jumpTiles({ 2: { activity: 'running' }, 4: { activity: 'queued' }, 5: { selected: true } })
    ),
  },
};

/** A queued jump, step 2: the lap ended, Item 4 runs, and the selection stays on Item 5. */
export const QueuedJumpLapEnded: Story = {
  args: {
    runningProgressPercent: 12,
    model: plateModel(jumpTiles({ 4: { activity: 'running' }, 5: { selected: true } })),
  },
};

/** A queued jump, step 3: the knob was left alone, so the selection follows to Item 4. */
export const QueuedJumpSelectionFollows: Story = {
  args: {
    runningProgressPercent: 12,
    model: plateModel(jumpTiles({ 4: { activity: 'running', selected: true } })),
  },
};

/** The narrow layout at about 300px. */
export const Narrow: Story = {
  args: FewMarkers.args,
  render: (args) => ({
    props: args,
    template: `
      <div
        style="width: 300px; height: 360px; display: flex; flex-direction: column"
        [style.--loop-tile-progress]="runningProgressPercent + '%'"
      >
        <lib-loops-cues-plate [model]="model" />
      </div>
    `,
  }),
};
