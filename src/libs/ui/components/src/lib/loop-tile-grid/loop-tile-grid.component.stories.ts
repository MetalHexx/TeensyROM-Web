import type { Meta, StoryObj } from '@storybook/angular';
import { LoopTileGridComponent } from './loop-tile-grid.component';
import type { LoopTileModel } from '../loop-tile/loop-tile.component';

const meta: Meta<LoopTileGridComponent> = {
  title: 'DJ/Loop Tile Grid',
  component: LoopTileGridComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Two columns of loop tiles, scrolling vertically inside the height its parent gives it. ' +
          '`runningProgressPercent` reaches only the running tile. When the selected tile changes ' +
          "it is scrolled into view (`block: 'nearest'`); other changes never scroll. With no tiles " +
          'it shows `emptyText`. Presentational only: the caller supplies every tile model.',
      },
    },
  },
  argTypes: {
    tiles: { description: 'The tiles, in display order.' },
    runningProgressPercent: { description: '0–100; reaches only the running tile.' },
    accessibleName: { description: "Names the list, e.g. 'Loops and cues, deck A'." },
    emptyText: { description: 'Shown when there are no tiles; null shows nothing.' },
    triggerTile: { description: "Emits the tile's id when its trigger key is pressed." },
    playNowTile: { description: "Emits the tile's id when its play-now key is pressed." },
    selectTile: { description: "Emits the tile's id when its select button is pressed." },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 474px; height: 180px; display: flex; flex-direction: column">
        <lib-loop-tile-grid
          [tiles]="tiles"
          [runningProgressPercent]="runningProgressPercent"
          [accessibleName]="accessibleName"
          [emptyText]="emptyText"
        />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LoopTileGridComponent>;

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
    ownSettings: false,
    playNowAccessibleName: `Play now Item ${number}`,
    ...overrides,
  };
}

const args = {
  runningProgressPercent: 53,
  accessibleName: 'Loops and cues, deck A',
  emptyText: null,
};

/** A few tiles: a selected running loop, a queued one, a cue and a loop that is not ready. */
export const FewTiles: Story = {
  args: {
    ...args,
    tiles: [
      tile(1, { selected: true, activity: 'running' }),
      tile(2, { activity: 'queued' }),
      tile(3, { kind: 'cue' }),
      tile(4, { ready: false }),
    ],
  },
};

/** Enough tiles to scroll, with the selection off-screen: the grid brings it into view on load. */
export const ScrollsToSelection: Story = {
  args: {
    ...args,
    tiles: Array.from({ length: 16 }, (_, index) => tile(index + 1, { selected: index === 12 })),
  },
};

/** No tiles: the empty text. */
export const Empty: Story = {
  args: { ...args, tiles: [], emptyText: 'No loops or cues yet' },
};

/** The narrow layout, with the bindings panel open. */
export const Narrow: Story = {
  args: {
    ...args,
    tiles: Array.from({ length: 10 }, (_, index) =>
      tile(index + 1, { selected: index === 1, activity: index === 0 ? 'running' : 'idle' })
    ),
  },
  render: (storyArgs) => ({
    props: storyArgs,
    template: `
      <div style="width: 300px; height: 180px; display: flex; flex-direction: column">
        <lib-loop-tile-grid
          [tiles]="tiles"
          [runningProgressPercent]="runningProgressPercent"
          [accessibleName]="accessibleName"
          [emptyText]="emptyText"
        />
      </div>
    `,
  }),
};
