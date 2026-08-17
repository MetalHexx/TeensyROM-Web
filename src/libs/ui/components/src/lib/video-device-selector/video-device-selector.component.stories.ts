import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { VideoDeviceSelectorComponent, VideoDevice } from './video-device-selector.component';

const mockDevices: VideoDevice[] = [
  { deviceId: 'device-1', label: 'USB Video Capture (046d:0825)' },
  { deviceId: 'device-2', label: 'Integrated Webcam' },
];

const meta: Meta<VideoDeviceSelectorComponent> = {
  title: 'Video & CRT/Video Device Selector',
  component: VideoDeviceSelectorComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Reusable dropdown for choosing a video capture device, with Material select, ' +
          'card styling, and slide show/hide animation built in. `devices` is normally ' +
          'populated upstream from `navigator.mediaDevices.enumerateDevices()` — this ' +
          'component is a pure display/selection surface and never calls the Media Devices ' +
          'API itself. Storybook has no camera/permission access, so this story supplies a ' +
          'hardcoded, plausible device list rather than mocking the API. Pairs with ' +
          '`VideoStreamComponent` (renders the stream from the chosen device) and typically ' +
          'sits alongside `VideoControlsToolbarComponent` in a ' +
          '`ContentOverlayContainerComponent` slot, whose `deviceSelectorClick` output ' +
          'toggles this panel\'s `visible` input.',
      },
    },
  },
  argTypes: {
    slideDirection: {
      control: 'select',
      options: ['left', 'right'],
    },
  },
};

export default meta;
type Story = StoryObj<VideoDeviceSelectorComponent>;

export const Default: Story = {
  args: {
    devices: mockDevices,
    selectedDeviceId: mockDevices[0].deviceId,
    visible: true,
    slideDirection: 'right',
    deviceSelected: fn(),
    openedChange: fn(),
  },
  render: (args) => ({
    props: args,
    template: `
      <lib-video-device-selector
        [devices]="devices"
        [selectedDeviceId]="selectedDeviceId"
        [visible]="visible"
        [slideDirection]="slideDirection"
        (deviceSelected)="deviceSelected($event)"
        (openedChange)="openedChange($event)">
      </lib-video-device-selector>
    `,
  }),
};
