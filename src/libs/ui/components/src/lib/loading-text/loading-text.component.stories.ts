import type { Meta, StoryObj } from '@storybook/angular';
import { LoadingTextComponent } from './loading-text.component';

const meta: Meta<LoadingTextComponent> = {
  title: 'Primitives/Loading Text',
  component: LoadingTextComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<LoadingTextComponent>;

export const Default: Story = {
  args: {
    visible: true,
    text: 'Loading...',
    showSpinner: true,
    animationDuration: 1000,
  },
};
