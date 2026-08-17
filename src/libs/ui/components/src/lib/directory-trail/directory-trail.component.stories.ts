import type { Meta, StoryObj } from '@storybook/angular';
import { DirectoryTrailComponent } from './directory-trail.component';

const meta: Meta<DirectoryTrailComponent> = {
  title: 'Navigation & Data/Directory Trail',
  component: DirectoryTrailComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The top toolbar of a directory browser, composing `DirectoryNavigateComponent` ' +
          '(back/forward/up/refresh) with `DirectoryBreadcrumbComponent` (the responsive ' +
          'path breadcrumb) into a single header. Use `lib-directory-trail` whenever both ' +
          'history navigation and a path breadcrumb are needed together — the common case ' +
          'for a directory browser header — rather than composing the two children by hand.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<DirectoryTrailComponent>;

/**
 * Composed from the trail's own `directory-navigate` and `directory-breadcrumb` children,
 * showing a full multi-segment path with back/up navigation both available.
 */
export const Default: Story = {
  args: {
    currentPath: '/games/arcade/favorites',
    storageTypeLabel: 'SD Card',
    canNavigateUp: true,
    canNavigateBack: true,
    canNavigateForward: false,
    isLoading: false,
  },
};
