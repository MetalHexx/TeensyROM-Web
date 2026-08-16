import type { Meta, StoryObj } from '@storybook/angular';
import { ExternalLinkComponent } from './external-link.component';

const meta: Meta<ExternalLinkComponent> = {
  title: 'Primitives/External Link',
  component: ExternalLinkComponent,
  tags: ['autodocs'],
  argTypes: {
    iconColor: {
      control: 'select',
      options: ['normal', 'primary', 'highlight', 'success', 'error', 'dimmed', 'directory'],
    },
    target: {
      control: 'select',
      options: ['_blank', '_self'],
    },
  },
};

export default meta;
type Story = StoryObj<ExternalLinkComponent>;

export const Default: Story = {
  args: {
    href: 'https://example.com',
    label: 'View documentation',
    icon: 'link',
    iconColor: 'primary',
    target: '_blank',
    ariaLabel: '',
  },
};
