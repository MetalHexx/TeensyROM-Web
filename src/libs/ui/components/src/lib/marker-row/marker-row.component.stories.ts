import type { Meta, StoryObj } from '@storybook/angular';
import { MarkerRowComponent, MarkerRowModel } from './marker-row.component';
import type { MarkerSlotModel } from '../marker-slot/marker-slot.component';

const meta: Meta<MarkerRowComponent> = {
  title: 'DJ/Marker Row',
  component: MarkerRowComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One marker's whole row: the number/trigger/loop-length header with its Set End / " +
          'Revert / Delete actions, the Start and End `MarkerSlotComponent`s, and the progress ' +
          'strip that fills while this row is looping. Purely presentational — it composes ' +
          '`MarkerSlotComponent` and holds no state of its own.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<MarkerRowComponent>;

function slotModel(side: 'start' | 'end', overrides: Partial<MarkerSlotModel> = {}): MarkerSlotModel {
  return {
    frameLabel: side === 'start' ? 'frame 460' : 'frame 780',
    offsetLabel: '+0 fr',
    nudgeValue: 0,
    nudgeRange: 50,
    tickOffsets: [-30, -10, 15, 40],
    previousDisabled: false,
    nextDisabled: false,
    nudgeAccessibleName: `Nudge marker 1 ${side} deck A`,
    previousAccessibleName: `Snap marker 1 ${side} to previous moment deck A`,
    nextAccessibleName: `Snap marker 1 ${side} to next moment deck A`,
    ...overrides,
  };
}

function rowModel(overrides: Partial<MarkerRowModel> = {}): MarkerRowModel {
  return {
    number: '1',
    state: 'idle',
    triggerDisabled: false,
    deleteDisabled: false,
    loopLengthLabel: null,
    start: slotModel('start'),
    end: null,
    triggerAccessibleName: 'Trigger marker 1 deck A',
    setEndAccessibleName: 'Set end for marker 1 deck A',
    revertAccessibleName: 'Revert marker 1 to cue deck A',
    deleteAccessibleName: 'Delete marker 1 deck A',
    ...overrides,
  };
}

export const CueRow: Story = {
  args: { model: rowModel(), progressPercent: 0 },
};

export const LoopRow: Story = {
  args: {
    model: rowModel({ loopLengthLabel: 'Loop Length: 320 fr', end: slotModel('end') }),
    progressPercent: 40,
  },
};

/** A cue row (no end) and a loop row (with end) rendered next to each other — the Revert
 *  placeholder and the empty End slot are what keep the two the same height. */
export const CueAndLoopSideBySide: Story = {
  render: () => ({
    props: {
      cue: rowModel(),
      loop: rowModel({ loopLengthLabel: 'Loop Length: 320 fr', end: slotModel('end') }),
    },
    template: `
      <div style="display: flex; align-items: flex-start; gap: 1rem;">
        <lib-marker-row [model]="cue" style="width: 24rem;" />
        <lib-marker-row [model]="loop" [progressPercent]="40" style="width: 24rem;" />
      </div>
    `,
  }),
};
