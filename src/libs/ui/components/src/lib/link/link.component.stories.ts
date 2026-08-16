import type { Meta, StoryObj } from '@storybook/angular';
import { LinkComponent } from './link.component';

const meta: Meta<LinkComponent> = {
  title: 'Primitives/Link',
  component: LinkComponent,
  tags: ['autodocs'],
  argTypes: {
    iconColor: {
      control: 'select',
      options: ['normal', 'primary', 'highlight', 'success', 'error', 'dimmed', 'directory'],
    },
  },
};

export default meta;
type Story = StoryObj<LinkComponent>;

export const Default: Story = {
  args: {
    label: 'View details',
    icon: 'link',
    iconColor: 'primary',
  },
};
