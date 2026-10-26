import type { Meta, StoryObj } from '@storybook/angular';
import type { LoopBoundaryModel } from '../loop-boundary/loop-boundary.component';
import type { LoopSelectedRowModel } from '../loop-selected-row/loop-selected-row.component';
import type { LoopTileModel } from '../loop-tile/loop-tile.component';
import { LoopsCuesPlateComponent, type LoopsCuesPlateModel } from './loops-cues-plate.component';

const meta: Meta<LoopsCuesPlateComponent> = {
  title: 'DJ/Loops Cues Plate',
  component: LoopsCuesPlateComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's loops/cues faceplate: an engraved caption with the Add and Stop keys, the " +
          'fixed selected-loop row, and a two-column tile grid that takes the remaining height and ' +
          'scrolls. Purely presentational — it holds no state of its own; the caller owns every ' +
          'marker, the drag offsets and the running tile’s progress.',
      },
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 474px; height: 360px; display: flex; flex-direction: column">
        <lib-loops-cues-plate
          [model]="model"
          [runningProgressPercent]="runningProgressPercent"
        />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LoopsCuesPlateComponent>;

function boundary(tag: string, overrides: Partial<LoopBoundaryModel> = {}): LoopBoundaryModel {
  const lower = tag.toLowerCase();
  return {
    tag,
    empty: false,
    disabled: false,
    offsetFrames: 0,
    rangeFrames: 50,
    tickPercents: [12, 38, 64, 90],
    previousDisabled: false,
    nextDisabled: false,
    nudgeAccessibleName: `Nudge ${lower} deck A`,
    previousAccessibleName: `Snap ${lower} to previous moment deck A`,
    nextAccessibleName: `Snap ${lower} to next moment deck A`,
    ...overrides,
  };
}

function emptySelected(): LoopSelectedRowModel {
  return {
    empty: true,
    name: '',
    kindLabel: '',
    spanText: '',
    activity: 'idle',
    ready: true,
    triggerDisabled: true,
    setEndDisabled: true,
    clearEndDisabled: true,
    deleteDisabled: true,
    start: boundary('Start', { disabled: true }),
    end: boundary('End', { empty: true, disabled: true }),
    triggerAccessibleName: 'Trigger selected deck A',
    setEndAccessibleName: 'Set end deck A',
    clearEndAccessibleName: 'Clear end deck A',
    deleteAccessibleName: 'Delete selected deck A',
  };
}

function selectedFor(tile: LoopTileModel): LoopSelectedRowModel {
  const isCue = tile.kind === 'cue';
  return {
    ...emptySelected(),
    empty: false,
    name: tile.name,
    kindLabel: isCue ? 'CUE' : 'LOOP',
    spanText: isCue ? '02:43.2' : '02:39.4–02:47.5',
    activity: tile.activity,
    ready: tile.ready,
    triggerDisabled: false,
    setEndDisabled: !isCue,
    clearEndDisabled: isCue,
    deleteDisabled: false,
    start: boundary('Start'),
    end: boundary('End', { empty: isCue, disabled: isCue }),
  };
}

function tile(number: number, overrides: Partial<LoopTileModel> = {}): LoopTileModel {
  const kind = overrides.kind ?? 'loop';
  return {
    id: `item-${number}`,
    name: `Item ${number}`,
    kind,
    lengthText: kind === 'cue' ? 'CUE' : `${(number * 1.3 + 2).toFixed(1)}s`,
    activity: 'idle',
    selected: false,
    ready: true,
    triggerAccessibleName: `Trigger Item ${number}`,
    selectAccessibleName: `Select Item ${number}, ${kind}`,
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
  const lengths = ['7.8s', '13.4s', 'CUE', '8.0s', '8.0s', 'CUE'];
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
      <div style="width: 300px; height: 360px; display: flex; flex-direction: column">
        <lib-loops-cues-plate
          [model]="model"
          [runningProgressPercent]="runningProgressPercent"
        />
      </div>
    `,
  }),
};
