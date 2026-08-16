import type { Meta, StoryObj } from '@storybook/angular';
import { ActionButtonComponent } from './action-button.component';

const meta: Meta<ActionButtonComponent> = {
  title: 'Primitives/Action Button',
  component: ActionButtonComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Labeled icon-and-text button for toolbar and dialog actions such as "Refresh Data", "Index All", or "Reset Devices". Pairs a Material button variant with an \`IconLabelComponent\` and overlays semantic text color for \`success\`/\`error\`/\`highlight\`, leaving Material's native borders, elevation, and spacing untouched.

Choose \`ActionButtonComponent\` over \`IconButtonComponent\` when the action needs a visible text label alongside its icon — toolbars, dialog footers, empty-state calls to action. Choose \`IconButtonComponent\` instead when space is constrained and the icon alone (with \`ariaLabel\`/tooltip for accessibility) is sufficient, such as a dense row of controls in a card header.

\`color\` and \`variant\` compose independently: any semantic color can be paired with any Material variant (\`stroked\`, \`flat\`, \`raised\`, \`fab\`). \`fullWidth\` (default \`true\`) stretches the button to its container; set it to \`false\` for inline, content-sized buttons.
        `.trim(),
      },
    },
  },
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
