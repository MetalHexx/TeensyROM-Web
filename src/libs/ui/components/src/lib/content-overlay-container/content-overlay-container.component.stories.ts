import type { Meta, StoryObj } from '@storybook/angular';
import { ContentOverlayContainerComponent } from './content-overlay-container.component';

const meta: Meta<ContentOverlayContainerComponent> = {
  title: 'Layout/Content Overlay Container',
  component: ContentOverlayContainerComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '9-slot layout container for video players and media displays — a background ' +
          '`content` slot plus 8 named overlay slots (corners, top/bottom centers, left/right ' +
          'sides) with hover-to-reveal behavior, an inactivity timer, CDK overlay awareness, ' +
          'and fullscreen support. Reach for this component when building a Netflix-style ' +
          'media interface where controls should hide until the user interacts, rather than ' +
          'a static layout component like `CardLayoutComponent`. Overlays stay visible while ' +
          'a CDK overlay (dropdown, menu) opened from within the container is open, so ' +
          'settings panels and menus don\'t flicker shut mid-interaction; use ' +
          '`overlayLockCount` for programmatic overrides of that behavior.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<ContentOverlayContainerComponent>;

export const Default: Story = {
  args: {
    showOverlaysOnHover: true,
    overlayTransitionMs: 300,
    inactivityTimeoutMs: 3000,
  },
  render: (args) => ({
    props: args,
    template: `<lib-content-overlay-container [showOverlaysOnHover]="showOverlaysOnHover" [overlayTransitionMs]="overlayTransitionMs" [inactivityTimeoutMs]="inactivityTimeoutMs" style="display:block;height:320px;">
      <div content style="width:100%;height:100%;background:#333;"></div>
      <span topLeftCorner>Logo</span>
      <span topOverlay>Filter Toolbar</span>
      <span topRightCorner>Close</span>
      <span bottomOverlay>Now Playing</span>
    </lib-content-overlay-container>`,
  }),
};
