import type { Meta, StoryObj } from '@storybook/angular';
import { ContentOverlayContainerComponent } from './content-overlay-container.component';

const meta: Meta<ContentOverlayContainerComponent> = {
  title: 'Layout/Content Overlay Container',
  component: ContentOverlayContainerComponent,
  tags: ['autodocs'],
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
