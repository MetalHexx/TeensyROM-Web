import type { Meta, StoryObj } from '@storybook/angular';
import { fn } from 'storybook/test';
import { VideoStreamComponent } from './video-stream.component';

const meta: Meta<VideoStreamComponent> = {
  title: 'Video & CRT/Video Stream',
  component: VideoStreamComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Pure presentation component that binds a `MediaStream` to a `<video>` element, ' +
          'handling autoplay/muted/srcObject lifecycle and an optional loading overlay while ' +
          'no stream is present. The `stream` is normally acquired upstream via ' +
          '`navigator.mediaDevices.getUserMedia()` against a device chosen with ' +
          '`VideoDeviceSelectorComponent` — this component never requests device access ' +
          'itself, it only renders whatever `MediaStream` it is given. Storybook has no ' +
          'camera/permission access, so this story mounts with `stream: null`, which shows ' +
          'the built-in loading state rather than a live picture. Commonly projected as the ' +
          'content inside `CrtEffectWrapperComponent` so CRT post-processing applies to the ' +
          'live video.',
      },
    },
  },
  argTypes: {
    objectFit: {
      control: 'select',
      options: ['contain', 'cover', 'fill'],
    },
  },
};

export default meta;
type Story = StoryObj<VideoStreamComponent>;

export const Default: Story = {
  args: {
    stream: null,
    objectFit: 'contain',
    showLoadingState: true,
    streamReady: fn(),
    streamError: fn(),
  },
  render: (args) => ({
    props: args,
    template: `
      <div style="width: 400px; height: 300px;">
        <lib-video-stream
          [stream]="stream"
          [objectFit]="objectFit"
          [showLoadingState]="showLoadingState"
          (streamReady)="streamReady()"
          (streamError)="streamError($event)">
        </lib-video-stream>
      </div>
    `,
  }),
};
