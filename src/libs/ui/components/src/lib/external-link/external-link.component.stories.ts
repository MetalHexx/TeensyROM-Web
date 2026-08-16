import type { Meta, StoryObj } from '@storybook/angular';
import { ExternalLinkComponent } from './external-link.component';

const meta: Meta<ExternalLinkComponent> = {
  title: 'Primitives/External Link',
  component: ExternalLinkComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The library's semantic navigation link: a real `<a>` tag with consistent icon + label styling, so every outbound and internal link in the app looks and behaves the same way. For external `https://`/`http://` targets opening in a new tab, it automatically applies `rel=\"noopener noreferrer\"` and appends \"(opens in new window)\" to the accessible name — you don't have to remember either. Use it for navigation (external URLs, internal routes, deep links to other pages); use `ActionLinkComponent` instead when the click should run code rather than change location — file downloads that need a confirmation dialog, or filter/clear actions, are `ActionLinkComponent` territory, not this one.",
      },
    },
  },
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
