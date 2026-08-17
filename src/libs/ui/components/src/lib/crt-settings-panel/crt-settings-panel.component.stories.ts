import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { fn } from 'storybook/test';
import { CRT_STORAGE, ICrtStorage } from '@teensyrom-nx/domain';
import { CrtSettingsPanelComponent } from './crt-settings-panel.component';
import { DEFAULT_CRT_SETTINGS, DEFAULT_CRT_CONFIG } from '../crt-effect-wrapper/crt-settings.defaults';

/**
 * Mirrors the test double already used in `crt-settings-panel.component.spec.ts` (same
 * shape), reused here as a story-level mock so the component's `CRT_STORAGE` injection
 * resolves instead of throwing a `NullInjectorError`. Not asserted on anywhere - it exists
 * only to satisfy DI so the story renders, not as behavior under test.
 */
const mockCrtStorage: ICrtStorage = {
  loadCustomPresets: () => [],
  saveCustomPreset: () => undefined,
  updateCustomPreset: () => undefined,
  deleteCustomPreset: () => undefined,
  renameCustomPreset: () => undefined,
  hasCustomPreset: () => false,
  save: () => undefined,
  load: () => null,
  hasSavedSettings: () => false,
  clear: () => undefined,
};

const meta: Meta<CrtSettingsPanelComponent> = {
  title: 'Video & CRT/Crt Settings Panel',
  component: CrtSettingsPanelComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ providers: [{ provide: CRT_STORAGE, useValue: mockCrtStorage }] })],
  parameters: {
    docs: {
      description: {
        component:
          'Full-surface CRT settings editor: sliders and toggles for scanlines, vignette, ' +
          'curvature, color filters, phosphor pattern, bloom, distortion, chromatic ' +
          'aberration, and video-mode detection, plus a built-in/custom preset menu with ' +
          'save/rename/delete. Reads and writes a single `CrtSettings` object shared with ' +
          '`CrtEffectWrapperComponent` — this panel never applies effects itself, it only ' +
          'emits `settingsChange` for the wrapper to consume. The `config` input (see ' +
          '`CRT_CONFIGS`) controls which effect groups are shown, so the same component ' +
          'serves a compact device-capture panel and a fullscreen dialog panel. Renders ' +
          'inline in the component tree; use `CrtSettingsPanelOverlayComponent` instead when ' +
          'the panel needs to render outside a clipping/overflow container via CDK Overlay. ' +
          'Card chrome uses the `glassy-card` token documented in the `style-guide` skill.',
      },
    },
  },
  argTypes: {
    debugMode: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<CrtSettingsPanelComponent>;

export const Default: Story = {
  args: {
    settings: DEFAULT_CRT_SETTINGS,
    config: DEFAULT_CRT_CONFIG,
    debugMode: false,
    validatePresetNameFn: (name: string) => (name.trim() ? { error: null } : { error: 'Name cannot be empty' }),
    settingsChange: fn(),
    presetSelected: fn(),
    closed: fn(),
    debugModeChange: fn(),
    openedChange: fn(),
  },
};
