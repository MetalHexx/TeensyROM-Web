import type { Meta, StoryObj } from '@storybook/angular';
import { FoldHandleComponent } from './fold-handle.component';

const meta: Meta<FoldHandleComponent> = {
  title: 'DJ/Fold Handle',
  component: FoldHandleComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The fold control of a card that collapses into a vertical strip. Open, it is a ' +
          'left-pointing chevron button in the card’s top-right corner; folded, the same button ' +
          'becomes a right-pointing chevron at the top of the strip, with the card’s label rotated ' +
          'and centred on it, reading bottom to top. It fills its positioned parent, so the card ' +
          'must be `position: relative`; the caller sizes the folded card. The caller owns the state: ' +
          '`foldedChange` is a request. Set `animationDuration` to 0 for reduced motion.',
      },
    },
  },
  argTypes: {
    folded: { description: 'Whether the card is folded into its strip.' },
    label: { description: 'The vertical label shown on the strip while folded.' },
    foldAccessibleName: { description: 'The button’s accessible name while the card is open.' },
    unfoldAccessibleName: { description: 'The button’s accessible name while the card is folded.' },
    animationDuration: {
      control: { type: 'number', min: 0, step: 100 },
      description:
        'The label’s fade-in (and, in the cards story, the width animation), in ms; 0 for reduced motion.',
    },
    foldedChange: { description: 'The request to fold (true) or unfold (false); carries the new state.' },
  },
  args: {
    label: 'Files',
    foldAccessibleName: 'Collapse the file listing',
    unfoldAccessibleName: 'Expand the file listing',
    animationDuration: 400,
  },
};

export default meta;
type Story = StoryObj<FoldHandleComponent>;

/** Open: a left-pointing chevron button in the card's corner. */
export const Open: Story = {
  args: { folded: false },
  render: (args) => ({
    props: args,
    template: `
      <div style="position: relative; width: 280px; height: 200px; border: 1px solid var(--color-dimmed); border-radius: 8px">
        <lib-fold-handle
          [folded]="folded"
          [label]="label"
          [foldAccessibleName]="foldAccessibleName"
          [unfoldAccessibleName]="unfoldAccessibleName"
          [animationDuration]="animationDuration"
        />
      </div>
    `,
  }),
};

/** Folded: a chevron on the strip with the rotated label. */
export const Folded: Story = {
  args: { folded: true },
  render: (args) => ({
    props: args,
    template: `
      <div style="position: relative; width: 44px; height: 200px; border: 1px solid var(--color-dimmed); border-radius: 8px">
        <lib-fold-handle
          [folded]="folded"
          [label]="label"
          [foldAccessibleName]="foldAccessibleName"
          [unfoldAccessibleName]="unfoldAccessibleName"
          [animationDuration]="animationDuration"
        />
      </div>
    `,
  }),
};

/** Two cards side by side: pressing the handle folds the left one and the right one takes the room. */
export const PairOfCards: Story = {
  args: { folded: false },
  render: (args) => ({
    props: {
      ...args,
      toggle(this: { folded: boolean }, folded: boolean) {
        this.folded = folded;
      },
    },
    template: `
      <div style="display: flex; gap: 8px; width: 640px; height: 200px">
        <div
          style="position: relative; flex: none; overflow: hidden; border: 1px solid var(--color-dimmed); border-radius: 8px"
          [style.width.px]="folded ? 44 : 300"
          [style.transition]="'width ' + animationDuration + 'ms ease'"
        >
          <lib-fold-handle
            [folded]="folded"
            [label]="label"
            [foldAccessibleName]="foldAccessibleName"
            [unfoldAccessibleName]="unfoldAccessibleName"
            [animationDuration]="animationDuration"
            (foldedChange)="toggle($event)"
          />
        </div>
        <div style="flex: 1; border: 1px solid var(--color-dimmed); border-radius: 8px; padding: 12px">
          The neighbouring card takes the room.
        </div>
      </div>
    `,
  }),
};
