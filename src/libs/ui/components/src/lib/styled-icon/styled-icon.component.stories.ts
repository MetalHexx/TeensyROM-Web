import type { Meta, StoryObj } from '@storybook/angular';
import { StyledIconComponent } from './styled-icon.component';

const meta: Meta<StyledIconComponent> = {
  title: 'Primitives/Styled Icon',
  component: StyledIconComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
Standalone, non-interactive Material icon with consistent sizing and semantic coloring — the building block used for directory listings, file browsers, navigation trees, and status indicators throughout the app.

Choose \`StyledIconComponent\` when the icon is purely presentational. Choose \`IconButtonComponent\` instead once the icon needs to be clickable, and \`IconLabelComponent\` when the icon needs an adjacent text label (it's built on top of \`StyledIconComponent\` for that purpose).

\`size\` and \`color\` map to \`styled-icon-*\` utility classes backed by the design system's \`--color-*\` tokens; see the \`style-guide\` skill for the underlying values.
        `.trim(),
      },
    },
  },
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
type Story = StoryObj<StyledIconComponent>;

export const Default: Story = {
  args: {
    icon: 'star',
    color: 'normal',
    size: 'medium',
  },
};
