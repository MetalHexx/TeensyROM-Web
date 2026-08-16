import type { Meta, StoryObj } from '@storybook/angular';
import { LinkComponent } from './link.component';

const meta: Meta<LinkComponent> = {
  title: 'Primitives/Link',
  component: LinkComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "The presentational base for the library's link-shaped components: it renders an icon and a label with `IconLabelComponent` and nothing else — no navigation, no click handling. Feature code should reach for `ExternalLinkComponent` (renders an `<a>`, navigates to a URL) or `ActionLinkComponent` (renders a `<button>`, emits a `linkClick` event) instead of composing `LinkComponent` directly; it exists to keep those two components visually and structurally consistent without duplicating the icon + label markup.",
      },
    },
  },
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
