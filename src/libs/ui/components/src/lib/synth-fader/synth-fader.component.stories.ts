import type { Meta, StoryObj } from '@storybook/angular';
import { SynthFaderComponent } from './synth-fader.component';

const meta: Meta<SynthFaderComponent> = {
  title: 'DJ/Synth Fader',
  component: SynthFaderComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A vertical fader drawn as hardware: a dark slot, tick marks, an optional magenta home ' +
          'line and a cap with a white line. It is still a native range input, so drag and the ' +
          'arrow keys work, and it emits the raw unrounded value. The home line is a mark only — ' +
          'there is no detent. Disabled, it dims and emits nothing.',
      },
    },
  },
  argTypes: {
    value: { description: 'The current position, between `min` and `max`.' },
    min: { description: 'Minimum of the range.' },
    max: { description: 'Maximum of the range.' },
    step: { description: 'Granularity of the native range.' },
    home: { description: 'Draws the home line at this value; `null` draws none.' },
    accessibleName: { description: "Accessible name of the range, e.g. 'Speed multiplier deck A'." },
    disabled: { description: 'Disables the range; it emits nothing.' },
    valueChange: { description: 'The raw, unrounded value read off the range.' },
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="height: 200px; display: flex">
        <lib-synth-fader
          [value]="value"
          [min]="min"
          [max]="max"
          [step]="step"
          [home]="home"
          [accessibleName]="accessibleName"
          [disabled]="disabled"
        />
      </div>
    `,
  }),
};

export default meta;
type Story = StoryObj<SynthFaderComponent>;

const base = {
  value: 1,
  min: 0.5,
  max: 2,
  step: 0.001,
  home: 1.25,
  accessibleName: 'Speed multiplier deck A',
  disabled: false,
};

export const AtHome: Story = { args: { ...base, value: 1.25 } };

export const Raised: Story = { args: { ...base, value: 1.8 } };

export const WithoutHome: Story = { args: { ...base, home: null } };

export const Disabled: Story = { args: { ...base, disabled: true } };
