import type { Meta, StoryObj } from '@storybook/angular';
import { IconLabelComponent } from './icon-label.component';

const meta: Meta<IconLabelComponent> = {
  title: 'Primitives/Icon Label',
  component: IconLabelComponent,
  tags: ['autodocs'],
  argTypes: {
    color: {
      control: 'select',
      options: ['normal', 'primary', 'highlight', 'success', 'error', 'dimmed', 'directory'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large', 'extra-large'],
    },
  },
};

export default meta;
type Story = StoryObj<IconLabelComponent>;

export const Default: Story = {
  args: {
    icon: 'folder',
    label: 'Documents',
    color: 'normal',
    size: 'medium',
    truncate: true,
    secondaryLabel: '',
    secondaryLabelClass: '',
    labelClass: '',
  },
};
