import { Component, afterNextRender, input } from '@angular/core';
import type { Meta, StoryObj } from '@storybook/angular';
import { C64ColorPickerComponent } from './c64-color-picker.component';
import { C64_PALETTE } from '../c64-color/c64-palette';

/**
 * The picker's popover only attaches on a click, so this host opens it after first render to show
 * the 4x4 grid and its focus ring without an interaction step.
 */
@Component({
  selector: 'lib-c64-color-picker-story-host',
  imports: [C64ColorPickerComponent],
  template: `<lib-c64-color-picker label="Background" [value]="value()" />`,
})
class C64ColorPickerStoryHostComponent {
  readonly value = input<number>(6);

  constructor() {
    afterNextRender(() => {
      const trigger = document.querySelector<HTMLButtonElement>('lib-c64-color-picker .trigger');
      trigger?.click();
    });
  }
}

const meta: Meta<C64ColorPickerComponent> = {
  title: 'C64/Color Picker',
  component: C64ColorPickerComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Chooses one of the C64\'s sixteen colors. A button shows the current color; clicking it ' +
          'opens a 4x4 grid of all sixteen, each with a swatch and its name, and the current one ' +
          'marked with a check. The grid is a radio group with a roving tab stop: arrow keys move ' +
          'by one or by a row, Home and End jump to the ends, Enter, Space or a click chooses ' +
          'and closes, and Escape closes without choosing. `valueChange` fires only when the ' +
          'chosen color differs from `value`.',
      },
    },
  },
  argTypes: {
    value: { description: 'Current color index, 0..15.' },
    label: { description: "The slot being colored, e.g. 'Background'; names the button and the group." },
    disabled: { description: 'Disables the button; the popover cannot open.' },
    valueChange: { description: 'Emits the chosen index when it differs from `value`.' },
  },
};

export default meta;
type Story = StoryObj<C64ColorPickerComponent>;

const render: Story['render'] = (args) => ({
  props: args,
  template: `<lib-c64-color-picker [value]="value" [label]="label" [disabled]="disabled" />`,
});

export const Default: Story = {
  args: { value: 6, label: 'Background', disabled: false },
  render,
};

export const Disabled: Story = { args: { ...Default.args, disabled: true }, render };

export const Open: Story = {
  render: () => ({
    moduleMetadata: { imports: [C64ColorPickerStoryHostComponent] },
    template: `<lib-c64-color-picker-story-host [value]="6" />`,
  }),
};

export const AllValues: Story = {
  render: () => ({
    props: { palette: C64_PALETTE },
    template: `
      <div style="display: grid; grid-template-columns: repeat(4, max-content); gap: 12px; color: #fff;">
        @for (color of palette; track color.index) {
          <lib-c64-color-picker [value]="color.index" label="Background" />
        }
      </div>`,
  }),
};

/** One story per palette value, so each color's button can be checked on its own. */
export const Value0Black: Story = { args: { ...Default.args, value: 0 }, render };
export const Value1White: Story = { args: { ...Default.args, value: 1 }, render };
export const Value2Red: Story = { args: { ...Default.args, value: 2 }, render };
export const Value3Cyan: Story = { args: { ...Default.args, value: 3 }, render };
export const Value4Purple: Story = { args: { ...Default.args, value: 4 }, render };
export const Value5Green: Story = { args: { ...Default.args, value: 5 }, render };
export const Value6Blue: Story = { args: { ...Default.args, value: 6 }, render };
export const Value7Yellow: Story = { args: { ...Default.args, value: 7 }, render };
export const Value8Orange: Story = { args: { ...Default.args, value: 8 }, render };
export const Value9Brown: Story = { args: { ...Default.args, value: 9 }, render };
export const Value10LightRed: Story = { args: { ...Default.args, value: 10 }, render };
export const Value11DarkGrey: Story = { args: { ...Default.args, value: 11 }, render };
export const Value12MediumGrey: Story = { args: { ...Default.args, value: 12 }, render };
export const Value13LightGreen: Story = { args: { ...Default.args, value: 13 }, render };
export const Value14LightBlue: Story = { args: { ...Default.args, value: 14 }, render };
export const Value15LightGrey: Story = { args: { ...Default.args, value: 15 }, render };
