import type { Meta, StoryObj } from '@storybook/angular';
import { DirectoryNavigateComponent } from './directory-navigate.component';

const meta: Meta<DirectoryNavigateComponent> = {
  title: 'Navigation & Data/Directory Navigate',
  component: DirectoryNavigateComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<DirectoryNavigateComponent>;

export const Default: Story = {
  args: {
    canNavigateUp: true,
    canNavigateBack: true,
    canNavigateForward: false,
    isLoading: false,
  },
};
