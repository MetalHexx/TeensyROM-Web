import type { Meta, StoryObj } from '@storybook/angular';
import { SelectableRowComponent } from './selectable-row.component';

const meta: Meta<SelectableRowComponent> = {
  title: 'Lists/Selectable Row',
  component: SelectableRowComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A selectable list row (`role="option"`) with a truncating label and three optional ' +
          'slots: `[rowLeading]`, `[rowAfterLabel]` and `[rowTrailing]`. It selects on click, ' +
          'Enter and Space and does nothing while disabled. The parent supplies the ' +
          '`role="listbox"` container and its accessible name; every story below wraps the row ' +
          'in one.',
      },
    },
  },
  argTypes: {
    label: { description: 'Row label; truncated with an ellipsis when it does not fit.' },
    selected: { description: 'Marks the row as the selected option (`aria-selected`).' },
    disabled: { description: 'Disables selection and removes the row from the tab order.' },
    selectedChange: { description: 'Emits on click, tap, Enter or Space; never while disabled.' },
  },
};

export default meta;
type Story = StoryObj<SelectableRowComponent>;

const listbox = (row: string) =>
  `<div role="listbox" aria-label="Themes" style="width: 320px">${row}</div>`;

export const Default: Story = {
  args: { label: 'Neon', selected: false, disabled: false },
  render: (args) => ({
    props: args,
    template: listbox(
      `<lib-selectable-row [label]="label" [selected]="selected" [disabled]="disabled" />`
    ),
  }),
};

export const Selected: Story = { args: { ...Default.args, selected: true }, render: Default.render };

export const Disabled: Story = { args: { ...Default.args, disabled: true }, render: Default.render };

export const WithSlots: Story = {
  args: { label: 'Midnight', selected: true },
  render: (args) => ({
    props: args,
    template: listbox(`
      <lib-selectable-row [label]="label" [selected]="selected">
        <span rowLeading class="material-symbols-outlined">palette</span>
        <span rowAfterLabel class="material-symbols-outlined" style="font-size: 16px">lock</span>
        <span rowTrailing style="display: flex; gap: 2px">
          <span style="width: 12px; height: 12px; background: #00f7ff"></span>
          <span style="width: 12px; height: 12px; background: #ff00aa"></span>
          <span style="width: 12px; height: 12px; background: #6a5acd"></span>
        </span>
      </lib-selectable-row>
    `),
  }),
};

export const LongLabel: Story = {
  args: { ...Default.args, label: 'A very long theme name that cannot possibly fit on a single row' },
  render: Default.render,
};
