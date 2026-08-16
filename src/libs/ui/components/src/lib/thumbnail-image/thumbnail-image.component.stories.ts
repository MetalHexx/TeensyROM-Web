import type { Meta, StoryObj } from '@storybook/angular';
import { ThumbnailImageComponent } from './thumbnail-image.component';

const meta: Meta<ThumbnailImageComponent> = {
  title: 'Primitives/Thumbnail Image',
  component: ThumbnailImageComponent,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
  },
};

export default meta;
type Story = StoryObj<ThumbnailImageComponent>;

export const Default: Story = {
  args: {
    imageUrl: 'https://placehold.co/200x200',
    size: 'medium',
  },
};
