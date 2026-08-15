import type { Meta, StoryObj } from '@storybook/angular';
import { StyledIconComponent } from './styled-icon.component';

const meta: Meta<StyledIconComponent> = {
  title: 'Primitives/Styled Icon',
  component: StyledIconComponent,
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
type Story = StoryObj<StyledIconComponent>;

export const Default: Story = {
  args: {
    icon: 'star',
    color: 'normal',
    size: 'medium',
  },
};
