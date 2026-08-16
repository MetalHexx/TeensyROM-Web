import type { Meta, StoryObj } from '@storybook/angular';
import { DirectoryNavigateComponent } from './directory-navigate.component';

const meta: Meta<DirectoryNavigateComponent> = {
  title: 'Navigation & Data/Directory Navigate',
  component: DirectoryNavigateComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A cluster of back/forward/up/refresh icon buttons for directory history ' +
          'navigation, each independently enabled by its own input and each emitting its ' +
          'own output — this component holds no navigation state itself. Normally rendered ' +
          'by `DirectoryTrailComponent` alongside `DirectoryBreadcrumbComponent`; use it ' +
          'directly only where a surface needs just the navigation controls without the ' +
          'trail’s breadcrumb.',
      },
    },
  },
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
