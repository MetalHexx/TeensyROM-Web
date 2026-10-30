import type { Meta, StoryObj } from '@storybook/angular';
import { C64ColorSwatchComponent } from './c64-color-swatch.component';

const meta: Meta<C64ColorSwatchComponent> = {
  title: 'C64/Color Swatch',
  component: C64ColorSwatchComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A square showing one of the C64's sixteen colors, with an optional name beside it. A " +
          'translucent border keeps Black and Blue visible on the dark surface. Alone it is an ' +
          'image named after its color; set `decorative` inside a control that already names the ' +
          'color. An index outside 0..15 shows an empty outlined square named "Unknown color".',
      },
    },
  },
  argTypes: {
    colorIndex: { description: 'Palette index 0..15.' },
    size: { description: 'Square size: small 12px, medium 18px, large 24px.' },
    showName: { description: 'Renders the color name as text beside the square.' },
    decorative: { description: 'Hides the swatch from assistive technology; use inside a labelled control.' },
  },
};

export default meta;
type Story = StoryObj<C64ColorSwatchComponent>;

const render: Story['render'] = (args) => ({
  props: args,
  template: `<lib-c64-color-swatch [colorIndex]="colorIndex" [size]="size" [showName]="showName" [decorative]="decorative" />`,
});

export const Default: Story = {
  args: { colorIndex: 14, size: 'medium', showName: false, decorative: false },
  render,
};

export const WithName: Story = { args: { ...Default.args, showName: true }, render };

export const Sizes: Story = {
  render: () => ({
    template: `
      <div style="display: flex; gap: 16px; align-items: center; color: #fff;">
        <lib-c64-color-swatch [colorIndex]="6" size="small" [showName]="true" />
        <lib-c64-color-swatch [colorIndex]="6" size="medium" [showName]="true" />
        <lib-c64-color-swatch [colorIndex]="6" size="large" [showName]="true" />
      </div>`,
  }),
};

export const Unknown: Story = { args: { ...Default.args, colorIndex: 16 }, render };
