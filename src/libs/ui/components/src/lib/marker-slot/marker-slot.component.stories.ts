import type { Meta, StoryObj } from '@storybook/angular';
import { MarkerSlotComponent, MarkerSlotModel } from './marker-slot.component';

const meta: Meta<MarkerSlotComponent> = {
  title: 'DJ/Marker Slot',
  component: MarkerSlotComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "One marker boundary's frame label, two snap buttons, a bipolar nudge slider with tick " +
          'marks for reachable moments, and an offset readout. Purely presentational: it holds no ' +
          "drag state of its own, so `nudgeValue` is whatever the caller decides to show. `model: " +
          'null` renders the empty placeholder in its place — same box, same height, so a row does ' +
          'not shift when an end is added to or reverted from a marker.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<MarkerSlotComponent>;

function slotModel(overrides: Partial<MarkerSlotModel> = {}): MarkerSlotModel {
  return {
    frameLabel: 'frame 460',
    offsetLabel: '+0 fr',
    nudgeValue: 0,
    nudgeRange: 50,
    tickOffsets: [-30, -10, 15, 40],
    previousDisabled: false,
    nextDisabled: false,
    nudgeAccessibleName: 'Nudge marker 1 start deck A',
    previousAccessibleName: 'Snap marker 1 start to previous moment deck A',
    nextAccessibleName: 'Snap marker 1 start to next moment deck A',
    ...overrides,
  };
}

function offsetLabel(offset: number): string {
  return `${offset < 0 ? '−' : '+'}${Math.abs(offset)} fr`;
}

export const Interactive: Story = {
  render: () => ({
    props: {
      model: slotModel(),
      tag: 'Start',
      onNudgeInput(value: number) {
        this['model'] = {
          ...(this['model'] as MarkerSlotModel),
          nudgeValue: value,
          offsetLabel: offsetLabel(value),
        };
      },
    },
    template: `<lib-marker-slot [model]="model" [tag]="tag" (nudgeInput)="onNudgeInput($event)" />`,
  }),
};

export const Empty: Story = {
  args: {
    model: null,
    tag: 'End',
  },
};

export const SnapButtonsDisabled: Story = {
  args: {
    model: slotModel({ previousDisabled: true, nextDisabled: true }),
    tag: 'Start',
  },
};
