import type { Meta, StoryObj } from '@storybook/angular';
import { EmptyStateMessageComponent } from './empty-state-message.component';

const meta: Meta<EmptyStateMessageComponent> = {
  title: 'Navigation & Data/Empty State Message',
  component: EmptyStateMessageComponent,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
  },
};

export default meta;
type Story = StoryObj<EmptyStateMessageComponent>;

export const Default: Story = {
  args: {
    icon: 'devices',
    title: 'No Connected Devices',
    size: 'medium',
  },
};

export const WithMessages: Story = {
  args: {
    icon: 'search_off',
    title: 'No Results Found',
    message: 'Try adjusting your search terms.',
    secondaryMessage: 'Visit the Device View to manage your devices.',
    size: 'large',
  },
};
