import type { Meta, StoryObj } from '@storybook/angular';
import { IconButtonComponent } from './icon-button.component';

const meta: Meta<IconButtonComponent> = {
  title: 'Components/IconButton',
  component: IconButtonComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<IconButtonComponent>;

export const Default: Story = {
  args: {
    icon: 'tv_off',
    ariaLabel: 'Turn off display',
  },
};
