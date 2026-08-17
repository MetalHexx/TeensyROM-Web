import type { Meta, StoryObj } from '@storybook/angular';
import { CrtEffectWrapperComponent } from './crt-effect-wrapper.component';
import { CRT_PRESETS, CRT_PRESET_KEYS } from './crt-settings.defaults';

const meta: Meta<CrtEffectWrapperComponent> = {
  title: 'Video & CRT/Crt Effect Wrapper',
  component: CrtEffectWrapperComponent,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Post-processes whatever is projected into its default slot with CRT visual ' +
          'effects (scanlines, vignette, curvature, phosphor pattern, bloom, distortion, ' +
          'chromatic aberration) driven entirely by a `CrtSettings` object. Pair it with ' +
          '`CrtSettingsPanelComponent`/`CrtSettingsPanelOverlayComponent` for live editing, ' +
          'and typically project a `VideoStreamComponent` or an `<img>` as the wrapped ' +
          'content — this component detects and binds to whichever one it finds. ' +
          'Requires a WebGL-capable browser context and a real `<video>`/`<img>` element ' +
          'with actual pixel data to produce a post-processed image; Storybook has neither ' +
          'a camera feed nor guaranteed WebGL in its iframe, so this story mounts the ' +
          'wrapper with default settings and placeholder content to document its inputs ' +
          'rather than to demonstrate a working render. See the `crt-webgl-effects` skill ' +
          'for the full CRT system architecture and CSS custom property reference.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<CrtEffectWrapperComponent>;

export const Default: Story = {
  args: {
    settings: CRT_PRESETS[CRT_PRESET_KEYS.LARGE_VIDEO_WEBGL],
    enabled: true,
    contentAspectRatio: null,
    debugMode: false,
  },
  render: (args) => ({
    props: args,
    template: `
      <lib-crt-effect-wrapper
        [settings]="settings"
        [enabled]="enabled"
        [contentAspectRatio]="contentAspectRatio"
        [debugMode]="debugMode">
        <div style="width: 400px; height: 300px; display: flex; align-items: center; justify-content: center; background: #1a1a1a; color: #888; font-family: sans-serif;">
          Placeholder content — a real post-processed render needs a &lt;video&gt; or &lt;img&gt; element and a WebGL context, neither of which Storybook provides.
        </div>
      </lib-crt-effect-wrapper>
    `,
  }),
};
