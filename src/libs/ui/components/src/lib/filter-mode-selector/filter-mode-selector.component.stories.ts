import type { Meta, StoryObj } from '@storybook/angular';
import { FilterModeSelectorComponent, FilterModeSelectorModel } from './filter-mode-selector.component';

const meta: Meta<FilterModeSelectorComponent> = {
  title: 'DJ/Filter Mode Selector',
  component: FilterModeSelectorComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "Four adjacent single-tap options — LP · BP · HP across a top row, OFF spanning the row " +
          "beneath — for forcing one deck's filter mode. Nothing engaged means the tune's own mode " +
          "passes through untouched, and re-clicking the engaged option deselects it back to that " +
          "same state. Always-visible buttons rather than a dropdown, matching the direct-manipulation " +
          "feel of the rest of a live-performance mixer strip. `size` steps each option's own height " +
          "and font across the shared `ControlSize` scale; `'large'` is the default and renders " +
          "pixel-identical to every use that predates this input.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<FilterModeSelectorComponent>;

const baseModel: FilterModeSelectorModel = {
  engaged: null,
  groupAccessibleName: 'Filter mode deck A',
  optionAccessibleNames: {
    lowPass: 'Filter mode low-pass deck A',
    bandPass: 'Filter mode band-pass deck A',
    highPass: 'Filter mode high-pass deck A',
    off: 'Filter mode off deck A',
  },
};

export const Default: Story = {
  args: { model: baseModel },
};

export const Engaged: Story = {
  args: { model: { ...baseModel, engaged: 'bandPass' } },
};

/** All four `ControlSize` steps side by side, each with `bandPass` engaged. */
export const Sizes: Story = {
  render: () => ({
    props: { model: { ...baseModel, engaged: 'bandPass' } },
    template: `
      <div style="display: flex; align-items: flex-end; gap: 24px; width: 480px;">
        <lib-filter-mode-selector [model]="model" size="small" />
        <lib-filter-mode-selector [model]="model" size="medium" />
        <lib-filter-mode-selector [model]="model" size="large" />
        <lib-filter-mode-selector [model]="model" size="extra-large" />
      </div>
    `,
  }),
};
