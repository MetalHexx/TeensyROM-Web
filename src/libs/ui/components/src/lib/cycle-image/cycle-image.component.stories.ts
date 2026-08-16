import type { Meta, StoryObj } from '@storybook/angular';
import { CycleImageComponent } from './cycle-image.component';

const meta: Meta<CycleImageComponent> = {
  title: 'Primitives/Cycle Image',
  component: CycleImageComponent,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['thumbnail', 'small', 'medium', 'large'],
    },
  },
};

export default meta;
type Story = StoryObj<CycleImageComponent>;

export const Default: Story = {
  args: {
    images: ['https://placehold.co/400x300', 'https://placehold.co/400x300/222/fff'],
    intervalMs: 8000,
    placeholderUrl: '/placeholder.jpg',
    size: 'large',
    width: undefined,
    height: undefined,
  },
};
