import type { Meta, StoryObj } from '@storybook/angular';
import { StatusIconLabelComponent } from './status-icon-label.component';

const meta: Meta<StatusIconLabelComponent> = {
  title: 'Primitives/Status Icon Label',
  component: StatusIconLabelComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<StatusIconLabelComponent>;

export const Default: Story = {
  args: {
    icon: 'sd_storage',
    label: 'SD Card',
    status: undefined,
  },
};

export const StatusTrue: Story = {
  args: {
    icon: 'sd_storage',
    label: 'SD Card',
    status: true,
  },
};

export const StatusFalse: Story = {
  args: {
    icon: 'sd_storage',
    label: 'SD Card',
    status: false,
  },
};

export const StatusUndefined: Story = {
  args: {
    icon: 'sd_storage',
    label: 'SD Card',
    status: undefined,
  },
};
