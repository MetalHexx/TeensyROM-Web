import type { Meta, StoryObj } from '@storybook/angular';
import { LoopsCuesPlateComponent } from './loops-cues-plate.component';
import type { LoopsCuesPanelModel } from '../loops-cues-panel/loops-cues-panel.component';
import type { MarkerRowModel } from '../marker-row/marker-row.component';
import type { MarkerSlotModel } from '../marker-slot/marker-slot.component';

const meta: Meta<LoopsCuesPlateComponent> = {
  title: 'DJ/Loops Cues Plate',
  component: LoopsCuesPlateComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One deck's loops/cues faceplate: an engraved caption, the Add and Stop keys, and one " +
          "marker row per entry. It fills its slot's height and scrolls the rows once they outgrow " +
          'it. Purely presentational — it holds no state of its own; the caller owns every marker.',
      },
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 248px; height: 460px; display: flex; flex-direction: column">
        <lib-loops-cues-plate [model]="model" />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<LoopsCuesPlateComponent>;

function slotModel(number: number, side: 'start' | 'end'): MarkerSlotModel {
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

function plateModel(rows: readonly MarkerRowModel[]): LoopsCuesPanelModel {
  return {
    accessibleName: 'Loops/Cues deck A',
    addAccessibleName: 'Add marker deck A',
    stopAccessibleName: 'Stop loop deck A',
    rows,
  };
}

/** Nothing captured yet — the Add and Stop keys are all there is to press. */
export const Empty: Story = {
  args: { model: plateModel([]) },
};

/** A cue above a loop, so the list shows both a cue row and a row with an end. */
export const WithRows: Story = {
  args: {
    model: plateModel([
      rowModel(1),
      rowModel(2, {
        state: 'active',
        loopLengthLabel: 'Loop Length: 320 fr',
        end: slotModel(2, 'end'),
      }),
    ]),
  },
};
