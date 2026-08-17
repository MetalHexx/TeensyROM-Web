import type { Meta, StoryObj } from '@storybook/angular';
import { IconButtonComponent } from './icon-button.component';

const meta: Meta<IconButtonComponent> = {
  title: 'Primitives/Icon Button',
  component: IconButtonComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Icon-only Material button for dense controls — toolbars, card corners, filter rows — where the icon alone conveys the action and a text label would take up too much space. Accepts a Material icon ligature via \`icon\`, or a projected custom icon component (\`ImageIconComponent\`, \`JoystickIconComponent\`) via content projection; the two are mutually exclusive per instance. \`ariaLabel\` is always required so the action remains accessible without a visible label.

Choose \`IconButtonComponent\` over \`ActionButtonComponent\` when space is constrained and the icon alone is enough. Choose \`ActionButtonComponent\` instead when the action needs a visible text label next to its icon, such as a dialog footer or empty-state call to action.

\`size\` and \`variant\` compose independently and map to \`icon-button-*\` utility classes; \`color\` maps to the design system's semantic \`--color-*\` tokens. See the \`style-guide\` skill for the underlying values.
        `.trim(),
      },
    },
  },
  argTypes: {
    color: {
      control: 'select',
      options: ['normal', 'highlight', 'success', 'error', 'dimmed', 'dimmed-light'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
    variant: {
      control: 'select',
      options: ['standard', 'rounded-primary', 'rounded-transparent'],
    },
  },
};

export default meta;
type Story = StoryObj<IconButtonComponent>;

export const Default: Story = {
  args: {
    icon: 'play_arrow',
    ariaLabel: 'Play',
    color: 'normal',
    size: 'medium',
    variant: 'standard',
    disabled: false,
  },
};

export const StandardVariant: Story = {
  args: {
    ...Default.args,
    variant: 'standard',
  },
};

export const RoundedPrimaryVariant: Story = {
  args: {
    ...Default.args,
    variant: 'rounded-primary',
  },
};

export const RoundedTransparentVariant: Story = {
  args: {
    ...Default.args,
    variant: 'rounded-transparent',
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};
