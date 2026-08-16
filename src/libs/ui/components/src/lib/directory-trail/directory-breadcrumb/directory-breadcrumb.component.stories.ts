import type { Meta, StoryObj } from '@storybook/angular';
import { DirectoryBreadcrumbComponent } from './directory-breadcrumb.component';

const meta: Meta<DirectoryBreadcrumbComponent> = {
  title: 'Navigation & Data/Directory Breadcrumb',
  component: DirectoryBreadcrumbComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Renders the current directory path as clickable breadcrumb chips, collapsing ' +
          'leading segments into a dropdown when the container is too narrow to show the ' +
          'full path. Normally rendered by `DirectoryTrailComponent` alongside ' +
          '`DirectoryNavigateComponent`; use it directly only where a surface needs just ' +
          'the path trail without back/forward/up/refresh controls.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<DirectoryBreadcrumbComponent>;

export const Default: Story = {
  args: {
    currentPath: '/games/arcade/favorites',
    storageType: 'SD Card',
  },
};
