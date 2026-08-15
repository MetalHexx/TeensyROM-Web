import type { Meta, StoryObj } from '@storybook/angular';
import { ActionLinkComponent } from './action-link.component';

const meta: Meta<ActionLinkComponent> = {
  title: 'Primitives/Action Link',
  component: ActionLinkComponent,
  tags: ['autodocs'],
  argTypes: {
    iconColor: {
      control: 'select',
      options: ['normal', 'primary', 'highlight', 'success', 'error', 'dimmed', 'directory'],
    },
  },
};

export default meta;
type Story = StoryObj<ActionLinkComponent>;

export const Default: Story = {
  args: {
    label: 'Clear filters',
    icon: 'link',
    iconColor: 'primary',
    ariaLabel: '',
    disabled: false,
  },
};

export const Disabled: Story = {
  args: {
    ...Default.args,
    disabled: true,
  },
};
