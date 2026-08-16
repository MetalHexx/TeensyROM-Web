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
