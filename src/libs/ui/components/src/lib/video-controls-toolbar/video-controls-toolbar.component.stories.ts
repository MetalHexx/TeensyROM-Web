import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { VideoControlsToolbarComponent } from './video-controls-toolbar.component';

const meta: Meta<VideoControlsToolbarComponent> = {
  title: 'Video & CRT/Video Controls Toolbar',
  component: VideoControlsToolbarComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Vertical icon-button rail for video player chrome — CRT toggle, CRT settings, ' +
          'device selector, fullscreen, and close — with active-state styling and per-button ' +
          'tooltips. It only emits click events; it owns no panel-visibility state itself, so ' +
          'a parent wires `crtSettingsClick`/`deviceSelectorClick` to toggle `visible` on its ' +
          'own `CrtSettingsPanelComponent`/`VideoDeviceSelectorComponent` instances (typically ' +
          'siblings in a `ContentOverlayContainerComponent` slot) and reflects the resulting ' +
          'state back through `showCrtControls`/`isDeviceSelectorActive` so the toolbar buttons ' +
          'render active. The visibility inputs (`showCrtToggle`, `showFullscreen`, `showClose`, ' +
          'etc.) let embedded and dialog video views reuse one toolbar with a different button ' +
          'set instead of forking the component.',
      },
    },
  },
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
