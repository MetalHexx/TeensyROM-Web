import type { Meta, StoryObj } from '@storybook/angular';
import { RotaryKnobComponent } from './rotary-knob.component';

const meta: Meta<RotaryKnobComponent> = {
  title: 'DJ/Rotary Knob',
  component: RotaryKnobComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A single rotary parameter control — cutoff, resonance, pulse width, key — driven by a " +
          "transparent native range input layered over a decorative SVG dial, so keyboard operation " +
          "and assistive-technology state come for free. A vertical drag sweeps `min()`..`max()` " +
          "(DAW convention, not the native range's own click-and-drag), Shift quarters the " +
          "sensitivity for fine adjustment, and a double-click snaps back to `home()`. Reach for it " +
          "for any bounded numeric parameter that benefits from a compact rotary affordance rather " +
          "than a linear fader like `ChannelFaderComponent`. `size` steps the dial and its own " +
          "label/readout font across the shared `ControlSize` scale; `'large'` is the default and " +
          "renders pixel-identical to every use that predates this input.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<RotaryKnobComponent>;

export const Default: Story = {
  args: { value: 0 }, // seed it — unseeded, `value` starts undefined and the dial draws NaN geometry
  render: (args) => ({
    props: { ...args, onValueChange(v: number) { this['value'] = v; } },
    template: `<lib-rotary-knob label="Cutoff" accessibleName="Cutoff demo"
                 [value]="value" (valueChange)="onValueChange($event)" />`,
  }),
};

/** All four `ControlSize` steps side by side, each still at rest (`value` at `home`). */
export const Sizes: Story = {
  render: () => ({
    template: `
      <div style="display: flex; align-items: flex-end; gap: 24px;">
        <lib-rotary-knob label="Small" accessibleName="Small demo" [value]="0" size="small" />
        <lib-rotary-knob label="Medium" accessibleName="Medium demo" [value]="0" size="medium" />
        <lib-rotary-knob label="Large" accessibleName="Large demo" [value]="0" size="large" />
        <lib-rotary-knob label="Extra Large" accessibleName="Extra Large demo" [value]="0" size="extra-large" />
      </div>
    `,
  }),
};
