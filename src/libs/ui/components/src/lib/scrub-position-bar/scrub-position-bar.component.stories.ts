import type { Meta, StoryObj } from '@storybook/angular';
import { ScrubPositionBarComponent } from './scrub-position-bar.component';

const meta: Meta<ScrubPositionBarComponent> = {
  title: 'DJ/Scrub Position Bar',
  component: ScrubPositionBarComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A range input overlaid with colored regions and an optional tick. Purely presentational: ' +
          'it holds no drag-pin state of its own, so `positionPercent` is whatever the caller decides ' +
          'to show — the live playhead or a pinned drag value — and `scrubInput`/`scrubCommit` are ' +
          "the caller's only way to find out what the operator did with the thumb.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<ScrubPositionBarComponent>;

export const Interactive: Story = {
  args: {
    barState: { kind: 'loop', introPercent: 25 },
    positionPercent: 40,
    accessibleName: 'Position deck A',
  },
  render: (args) => ({
    props: {
      ...args,
      onScrubInput(v: number) {
        this['positionPercent'] = v;
      },
    },
    template: `<lib-scrub-position-bar [barState]="barState" [positionPercent]="positionPercent"
                 [accessibleName]="accessibleName" (scrubInput)="onScrubInput($event)" />`,
  }),
};

export const Loop: Story = {
  args: {
    barState: { kind: 'loop', introPercent: 25 },
    positionPercent: 40,
    accessibleName: 'Position deck A',
  },
};

export const Ended: Story = {
  args: {
    barState: { kind: 'ended', musicPercent: 70 },
    positionPercent: 85,
    accessibleName: 'Position deck A',
  },
};

export const Unknown: Story = {
  args: {
    barState: { kind: 'unknown' },
    positionPercent: 0,
    accessibleName: 'Position deck A',
  },
};

export const Analyzing: Story = {
  args: {
    barState: { kind: 'analyzing' },
    positionPercent: 0,
    accessibleName: 'Position deck A',
  },
};
