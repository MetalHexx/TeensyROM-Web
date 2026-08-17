import type { Meta, StoryObj } from '@storybook/angular';

const meta: Meta = {
  title: 'Systems/CRT Effects',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
The CRT emulation system recreates the visual experience of vintage monitors using WebGL-based post-processing (scanlines, vignette, phosphor patterns, barrel distortion, bloom, chromatic aberration, color filters) layered with CSS (screen curvature, container styling).

**Component Catalog**

\`CrtEffectWrapperComponent\` (\`lib-crt-effect-wrapper\`) applies these effects to any projected content. It is paired with \`CrtSettingsPanelComponent\` (\`lib-crt-settings-panel\`) for real-time adjustment via presets and sliders, and composed with the rest of the video stack — \`VideoStreamComponent\`, \`VideoControlsToolbarComponent\`, \`VideoDeviceSelectorComponent\`, and \`ContentOverlayContainerComponent\` — to build a full video player. All of these are exported from \`@teensyrom-nx/ui/components\`, along with the \`CrtSettings\`, \`CrtSettingsConfig\` domain types and the \`CRT_PRESETS\` / \`DEFAULT_CRT_SETTINGS\` presets. See each component's own Storybook docs (via \`pnpm component-docs get --component-name <name>\`) for inputs, outputs, and usage examples.

**Adding a New Effect**

A new WebGL effect is a four-layer change: the domain model (\`CrtSettings\`), the GLSL fragment shader, the \`CrtRenderer\` uniform binding, and the settings-panel slider. That recipe — including naming conventions, the mandatory zero-intensity shader optimization, and two full reference implementations (barrel distortion, chromatic aberration) — lives in the \`crt-webgl-effects\` skill, not here. This entry only orients the system; reach for that skill when implementing shader-level changes.
        `.trim(),
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Overview: Story = {
  render: () => ({ template: '<p>See the Docs tab.</p>' }),
};
