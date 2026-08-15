import type { Meta, StoryObj } from '@storybook/angular';
import { moduleMetadata } from '@storybook/angular';
import { fn } from 'storybook/test';
import { CRT_STORAGE, ICrtStorage } from '@teensyrom-nx/domain';
import { CrtSettingsPanelOverlayComponent } from './crt-settings-panel-overlay.component';
import { DEFAULT_CRT_SETTINGS, DEFAULT_CRT_CONFIG } from '../crt-effect-wrapper/crt-settings.defaults';

/**
 * Same DI seam as `crt-settings-panel.component.stories.ts`: the overlay portal-attaches
 * `CrtSettingsPanelComponent`, which injects `CRT_STORAGE`. Not asserted on anywhere - it
 * exists only to satisfy DI so the story renders, not as behavior under test.
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

const meta: Meta<CrtSettingsPanelOverlayComponent> = {
  title: 'Video & CRT/Crt Settings Panel Overlay',
  component: CrtSettingsPanelOverlayComponent,
  tags: ['autodocs'],
  decorators: [moduleMetadata({ providers: [{ provide: CRT_STORAGE, useValue: mockCrtStorage }] })],
};

export default meta;
type Story = StoryObj<CrtSettingsPanelOverlayComponent>;

/**
 * `lib-crt-settings-panel-overlay` is a thin CDK-overlay wrapper that portal-attaches
 * `lib-crt-settings-panel` at an anchored position instead of rendering it inline. See the
 * panel's own story for the full slider/preset control surface - not re-documented here.
 */
export const Default: Story = {
  args: {
    settings: DEFAULT_CRT_SETTINGS,
    config: DEFAULT_CRT_CONFIG,
    validatePresetNameFn: (name: string) => (name.trim() ? { error: null } : { error: 'Name cannot be empty' }),
    settingsChange: fn(),
    presetSelected: fn(),
    closed: fn(),
    debugModeChange: fn(),
  },
};
