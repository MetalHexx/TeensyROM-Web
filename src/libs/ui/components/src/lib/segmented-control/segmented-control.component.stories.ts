import type { Meta, StoryObj } from '@storybook/angular';
import { SegmentedControlComponent, SegmentedControlOption } from './segmented-control.component';

const meta: Meta<SegmentedControlComponent> = {
  title: 'DJ/Segmented Control',
  component: SegmentedControlComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A group of mutually exclusive options, all visible at once, drawn as a row of adjacent ' +
          "cells in the filter mode selector's look. The selected cell is filled and bold, so the " +
          'state never rests on colour alone. Announces as a radio group; the selected option ' +
          '(else the first enabled one) is the single tab stop, and the arrow keys move focus and ' +
          'select, skipping disabled options, with Home and End jumping to the ends. The caller ' +
          'owns `selectedId` and updates it from `optionSelect`. Reach for it for a small set of ' +
          "exclusive choices that should stay visible — a binding's style, for one — rather than " +
          'a dropdown. `size` steps the cells across the shared `ControlSize` scale.',
      },
    },
  },
  argTypes: {
    options: {
      description:
        'The options, left to right: `{ id, label, disabled? }`. A disabled option is skipped by ' +
        'the keyboard and cannot be selected.',
    },
    selectedId: {
      description: 'The `id` of the selected option, or `null` for none.',
    },
    accessibleName: {
      description: "Accessible name for the whole radio group, e.g. 'Style'.",
    },
    size: {
      description: "The cells' height and font across the shared `ControlSize` scale.",
      control: 'select',
      options: ['small', 'medium', 'large', 'extra-large'],
    },
    optionSelect: {
      description:
        'Emits the id of the option the user chose, by click or by arrow, Home or End key. Does ' +
        'not emit for the option that is already selected.',
    },
  },
};

export default meta;
type Story = StoryObj<SegmentedControlComponent>;

const styleOptions: readonly SegmentedControlOption[] = [
  { id: 'absolute', label: 'Absolute' },
  { id: 'relative', label: 'Relative' },
  { id: 'step', label: 'Step' },
];

/** Interactive: the story owns `selectedId` and updates it from `optionSelect`, as a caller would.
 *  Tab into the group and use the arrow keys. */
export const Default: Story = {
  args: {
    options: styleOptions,
    selectedId: 'relative',
    accessibleName: 'Style',
    size: 'medium',
  },
  render: (args) => ({
    props: {
      ...args,
      onSelect(this: { selectedId: string | null }, id: string) {
        this.selectedId = id;
      },
    },
    template: `
      <div style="width: 320px;">
        <lib-segmented-control
          [options]="options"
          [selectedId]="selectedId"
          [accessibleName]="accessibleName"
          [size]="size"
          (optionSelect)="onSelect($event)"
        />
      </div>
    `,
  }),
};

export const NothingSelected: Story = {
  args: { ...Default.args, selectedId: null },
  render: Default.render,
};

/** A disabled option is dimmed, skipped by the arrow keys, and cannot be selected. */
export const WithDisabledOption: Story = {
  args: {
    ...Default.args,
    options: [
      { id: 'absolute', label: 'Absolute' },
      { id: 'relative', label: 'Relative' },
      { id: 'step', label: 'Step', disabled: true },
    ],
  },
  render: Default.render,
};

/** All four `ControlSize` steps, each with the middle option selected. */
export const Sizes: Story = {
  render: () => ({
    props: { options: styleOptions },
    template: `
      <div style="display: flex; flex-direction: column; gap: 16px; width: 320px;">
        <lib-segmented-control [options]="options" selectedId="relative" accessibleName="Small" size="small" />
        <lib-segmented-control [options]="options" selectedId="relative" accessibleName="Medium" size="medium" />
        <lib-segmented-control [options]="options" selectedId="relative" accessibleName="Large" size="large" />
        <lib-segmented-control [options]="options" selectedId="relative" accessibleName="Extra large" size="extra-large" />
      </div>
    `,
  }),
};
