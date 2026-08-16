import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { VideoControlsToolbarComponent } from './video-controls-toolbar.component';

const meta: Meta<VideoControlsToolbarComponent> = {
  title: 'Video & CRT/Video Controls Toolbar',
  component: VideoControlsToolbarComponent,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<VideoControlsToolbarComponent>;

export const Default: Story = {
  args: {
    isCrtEnabled: true,
    showCrtControls: false,
    isDeviceSelectorActive: false,
    isFullscreen: false,
    showCrtToggle: true,
    showCrtSettings: true,
    showDeviceSelector: true,
    showFullscreen: true,
    showClose: false,
    crtToggleClick: fn(),
    crtSettingsClick: fn(),
    deviceSelectorClick: fn(),
    fullscreenClick: fn(),
    closeClick: fn(),
  },
};
