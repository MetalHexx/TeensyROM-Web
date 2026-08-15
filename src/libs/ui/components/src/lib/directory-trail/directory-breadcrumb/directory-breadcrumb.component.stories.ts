import type { Meta, StoryObj } from '@storybook/angular';
import { DirectoryBreadcrumbComponent } from './directory-breadcrumb.component';

const meta: Meta<DirectoryBreadcrumbComponent> = {
  title: 'Navigation & Data/Directory Breadcrumb',
  component: DirectoryBreadcrumbComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<DirectoryBreadcrumbComponent>;

export const Default: Story = {
  args: {
    currentPath: '/games/arcade/favorites',
    storageType: 'SD Card',
  },
};
