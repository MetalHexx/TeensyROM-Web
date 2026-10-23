import type { Meta, StoryObj } from '@storybook/angular';
import { PanicButtonComponent } from './panic-button.component';

const meta: Meta<PanicButtonComponent> = {
  title: 'DJ/Panic Button',
  component: PanicButtonComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The panel\'s Panic button: an outlined magenta button with a reset glyph and the ' +
          'visible text "Panic". A native button, so Enter and Space press it. It has no on/off ' +
          'state and no live light; the caller acts on `press`.',
      },
    },
  },
  argTypes: {
    accessibleName: { description: "Accessible name, e.g. 'Panic: silence all voices'; the caller composes it." },
    disabled: { description: 'Disables the button; no `press` is emitted.' },
    press: { description: 'Emits on click, or Enter / Space.' },
  },
};

export default meta;
type Story = StoryObj<PanicButtonComponent>;

export const Default: Story = {
  args: { accessibleName: 'Panic: silence all voices', disabled: false },
  render: (args) => ({
    props: args,
    template: `<lib-panic-button [accessibleName]="accessibleName" [disabled]="disabled" />`,
  }),
};

export const Disabled: Story = { args: { ...Default.args, disabled: true }, render: Default.render };
