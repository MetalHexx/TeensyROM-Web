import type { Meta, StoryObj } from '@storybook/angular';
import { ActionLinkComponent } from './action-link.component';

const meta: Meta<ActionLinkComponent> = {
  title: 'Primitives/Action Link',
  component: ActionLinkComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "A link-styled `<button>` for action triggers — opening a modal, clearing a filter, deleting an item — anywhere a link's visual weight is wanted but the target isn't a URL. It emits `linkClick` instead of navigating, and inherits standard button keyboard behavior (Enter/Space activate it, and it drops out of the tab order entirely when `disabled`). Choose `ActionLinkComponent` over `ExternalLinkComponent` whenever the interaction is 'do something' rather than 'go somewhere' — using the right element (`<button>` vs `<a>`) keeps keyboard and screen-reader behavior correct for free. See also `LinkComponent`, which both compose for their icon + label rendering.",
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
