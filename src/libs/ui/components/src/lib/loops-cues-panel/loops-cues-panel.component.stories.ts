import type { Meta, StoryObj } from '@storybook/angular';
import { LoopsCuesPanelComponent, LoopsCuesPanelModel } from './loops-cues-panel.component';
import type { MarkerRowModel } from '../marker-row/marker-row.component';
import type { MarkerSlotModel } from '../marker-slot/marker-slot.component';

const meta: Meta<LoopsCuesPanelComponent> = {
  title: 'DJ/Loops Cues Panel',
  component: LoopsCuesPanelComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's whole marker list: an Add/Stop header and one `MarkerRowComponent` per " +
          'row. Purely presentational — it holds no state of its own; the caller owns every drag ' +
          'offset and every frame/millisecond conversion, and re-reads the twelve row-level ' +
          'controls off the single index-carrying `rowAction` output.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<LoopsCuesPanelComponent>;

function slotModel(
  number: number,
  side: 'start' | 'end',
  overrides: Partial<MarkerSlotModel> = {}
): MarkerSlotModel {
  return {
    frameLabel: side === 'start' ? 'frame 460' : 'frame 780',
    offsetLabel: '+0 fr',
    nudgeValue: 0,
    nudgeRange: 50,
    tickOffsets: [-30, -10, 15, 40],
    previousDisabled: false,
    nextDisabled: false,
    nudgeAccessibleName: `Nudge marker ${number} ${side} deck A`,
    previousAccessibleName: `Snap marker ${number} ${side} to previous moment deck A`,
    nextAccessibleName: `Snap marker ${number} ${side} to next moment deck A`,
    ...overrides,
  };
}

function rowModel(number: number, overrides: Partial<MarkerRowModel> = {}): MarkerRowModel {
  return {
    number: String(number),
    state: 'idle',
    triggerDisabled: false,
    deleteDisabled: false,
    loopLengthLabel: null,
    start: slotModel(number, 'start'),
    end: null,
    triggerAccessibleName: `Trigger marker ${number} deck A`,
    setEndAccessibleName: `Set end for marker ${number} deck A`,
    revertAccessibleName: `Revert marker ${number} to cue deck A`,
    deleteAccessibleName: `Delete marker ${number} deck A`,
    ...overrides,
  };
}

function panelModel(rows: readonly MarkerRowModel[]): LoopsCuesPanelModel {
  return {
    accessibleName: 'Loops/Cues deck A',
    addAccessibleName: 'Add marker deck A',
    stopAccessibleName: 'Stop loop deck A',
    rows,
  };
}

/** Nothing captured yet — the header is all there is to press. */
export const Empty: Story = {
  args: { model: panelModel([]) },
};

/** One cue: no end, so the End slot renders its placeholder and the Revert button is inert. */
export const CueOnly: Story = {
  args: { model: panelModel([rowModel(1)]) },
};

/** A cue above a looping row whose progress strip is part-way through its lap. */
export const Looping: Story = {
  args: {
    model: panelModel([
      rowModel(1),
      rowModel(2, {
        state: 'active',
        loopLengthLabel: 'Loop Length: 320 fr',
        end: slotModel(2, 'end'),
      }),
    ]),
    rowProgressPercents: [0, 40],
  },
};
