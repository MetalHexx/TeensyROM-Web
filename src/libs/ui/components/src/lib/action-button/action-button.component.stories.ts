import type { Meta, StoryObj } from '@storybook/angular';
import { ActionButtonComponent } from './action-button.component';

const meta: Meta<ActionButtonComponent> = {
  title: 'Primitives/Action Button',
  component: ActionButtonComponent,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['stroked', 'flat', 'raised', 'fab'],
    },
    color: {
      control: 'select',
      options: ['primary', 'success', 'error', 'highlight', 'normal'],
    },
  },
};

export default meta;
type Story = StoryObj<ActionButtonComponent>;

export const Default: Story = {
  args: {
    icon: 'save',
    label: 'Save',
    variant: 'stroked',
    color: 'primary',
    disabled: false,
    fullWidth: true,
    ariaLabel: '',
    tooltip: undefined,
  },
};

export const FullWidthFalse: Story = {
  args: {
    ...Default.args,
    fullWidth: false,
  },
};
