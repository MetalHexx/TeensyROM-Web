import type { Meta, StoryObj } from '@storybook/angular';
import { ImageIconComponent } from './image-icon.component';

const meta: Meta<ImageIconComponent> = {
  title: 'Primitives/Image Icon',
  component: ImageIconComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<ImageIconComponent>;

export const Default: Story = {
  args: {},
};
