import type { Meta, StoryObj } from '@storybook/angular';
import { IconButtonComponent } from './icon-button.component';

const meta: Meta<IconButtonComponent> = {
  title: 'Primitives/Icon Button',
  component: IconButtonComponent,
  tags: ['autodocs'],
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
