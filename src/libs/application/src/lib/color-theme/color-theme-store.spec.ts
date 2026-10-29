import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError, Observable } from 'rxjs';
import '@analogjs/vitest-angular/setup-zone';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ALERT_SERVICE,
  APPLY_TO_ALL_DEVICES,
  COLOR_THEME_SERVICE,
  ColorTheme,
  ColorThemeApplyError,
  ColorThemeKind,
  Device,
  DeviceColorRecord,
  DeviceColors,
  FACTORY_COLOR_THEME_ID,
} from '@teensyrom-nx/domain';
import { DeviceStore } from '../device/device-store';
import { ColorThemeStore } from './color-theme-store';

const colors = (seed: number): DeviceColors => ({
  background: seed,
  border: seed,
  banner: seed,
  time: seed,
  option: seed,
  sources: seed,
  name: seed,
});

const theme = (id: string, kind: ColorThemeKind, seed: number, name = id): ColorTheme => ({
  id,
  name,
  kind,
  parts: { device: colors(seed) },
});

const factory = theme(FACTORY_COLOR_THEME_ID, ColorThemeKind.Shipped, 1, 'TR Default');
const custom = theme('custom-1', ColorThemeKind.Custom, 2, 'Mine');

const record = (
  deviceId: string,
  seed: number,
  themeId: string | null,
  isRecorded = true
): DeviceColorRecord => ({
  deviceId,
  colors: colors(seed),
  themeId,
  appliedAt: null,
  isRecorded,
});

const device = (deviceId: string, name = deviceId, isConnected = true): Device =>
  ({ deviceId, name, isConnected, isEnabled: true }) as Device;

describe('ColorThemeStore', () => {
  let devices: ReturnType<typeof signal<Device[]>>;
  let service: {
    listThemes: ReturnType<typeof vi.fn>;
    createTheme: ReturnType<typeof vi.fn>;
    updateTheme: ReturnType<typeof vi.fn>;
    deleteTheme: ReturnType<typeof vi.fn>;
    getDeviceColors: ReturnType<typeof vi.fn>;
    applyDeviceColors: ReturnType<typeof vi.fn>;
  };
  let alerts: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof ColorThemeStore>;

  const records = (map: Record<string, DeviceColorRecord | Error>) =>
    service.getDeviceColors.mockImplementation((id: string): Observable<DeviceColorRecord> => {
      const entry = map[id];
      return entry instanceof Error ? throwError(() => entry) : of(entry);
    });

  beforeEach(() => {
    devices = signal<Device[]>([]);
    service = {
      listThemes: vi.fn().mockReturnValue(of([factory, custom])),
      createTheme: vi.fn(),
      updateTheme: vi.fn(),
      deleteTheme: vi.fn(),
      getDeviceColors: vi.fn(),
      applyDeviceColors: vi.fn(),
    };
    alerts = { success: vi.fn(), error: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: COLOR_THEME_SERVICE, useValue: service },
        { provide: ALERT_SERVICE, useValue: alerts },
        { provide: DeviceStore, useValue: { usableDevices: computed(() => devices()) } },
      ],
    });
    store = TestBed.inject(ColorThemeStore);
  });

  describe('initialize', () => {
    it('uses the factory theme when no device is connected', async () => {
      await store.initialize();

      expect(service.getDeviceColors).not.toHaveBeenCalled();
      expect(store.selectedThemeId()).toBe(FACTORY_COLOR_THEME_ID);
      expect(store.draft()).toEqual(colors(1));
      expect(store.recordState()).toEqual({ kind: 'none' });
      expect(store.hasInitialised()).toBe(true);
      expect(store.isLoading()).toBe(false);
    });

    it('follows the connected device record and its theme', async () => {
      devices.set([device('d1')]);
      records({ d1: record('d1', 2, 'custom-1') });

      await store.initialize();

      expect(store.draft()).toEqual(colors(2));
      expect(store.selectedThemeId()).toBe('custom-1');
      expect(store.recordState()).toEqual({ kind: 'recorded' });
      expect(store.isEdited()).toBe(false);
    });

    it('selects nothing when the recorded theme is gone', async () => {
      devices.set([device('d1')]);
      records({ d1: record('d1', 5, 'deleted-theme') });

      await store.initialize();

      expect(store.selectedThemeId()).toBeNull();
      expect(store.draft()).toEqual(colors(5));
    });

    it('ignores disconnected devices', async () => {
      devices.set([device('d1', 'd1', false)]);

      await store.initialize();

      expect(service.getDeviceColors).not.toHaveBeenCalled();
      expect(store.selectedThemeId()).toBe(FACTORY_COLOR_THEME_ID);
    });

    it('reports differing records across two devices and shows the first', async () => {
      devices.set([device('d1', 'Alpha'), device('d2', 'Beta')]);
      records({ d1: record('d1', 2, 'custom-1'), d2: record('d2', 3, null) });

      await store.initialize();

      expect(store.draft()).toEqual(colors(2));
      expect(store.recordState()).toEqual({
        kind: 'differ',
        shownDeviceName: 'Alpha',
        deviceNames: ['Alpha', 'Beta'],
      });
    });

    it('counts a failed record load as no record', async () => {
      devices.set([device('d1'), device('d2')]);
      records({ d1: new Error('offline'), d2: record('d2', 3, null) });

      await store.initialize();

      expect(Object.keys(store.records())).toEqual(['d2']);
      expect(store.hasInitialised()).toBe(true);
    });
  });

  describe('loadMissingRecords', () => {
    it('fetches only missing records and leaves the draft alone', async () => {
      devices.set([device('d1')]);
      records({ d1: record('d1', 2, null), d2: record('d2', 3, null) });
      await store.initialize();
      devices.set([device('d1'), device('d2')]);
      service.getDeviceColors.mockClear();

      await store.loadMissingRecords();

      expect(service.getDeviceColors).toHaveBeenCalledTimes(1);
      expect(service.getDeviceColors).toHaveBeenCalledWith('d2');
      expect(Object.keys(store.records()).sort()).toEqual(['d1', 'd2']);
      expect(store.draft()).toEqual(colors(2));
    });
  });

  describe('selection and editing', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('copies the theme colors into the draft without calling the service', () => {
      store.selectTheme('custom-1');

      expect(store.selectedThemeId()).toBe('custom-1');
      expect(store.draft()).toEqual(colors(2));
      expect(store.isEdited()).toBe(false);
      expect(store.unchangedThemeId()).toBe('custom-1');
      expect(service.applyDeviceColors).not.toHaveBeenCalled();
      expect(service.updateTheme).not.toHaveBeenCalled();
    });

    it('marks the selection edited once a slot changes', () => {
      store.selectTheme('custom-1');
      store.setSlotColor('banner', 9);

      expect(store.draft().banner).toBe(9);
      expect(store.isEdited()).toBe(true);
      expect(store.unchangedThemeId()).toBeNull();
    });

    it('allows saving and deleting only custom themes', () => {
      store.selectTheme(FACTORY_COLOR_THEME_ID);
      expect(store.canSave()).toBe(false);
      expect(store.canDelete()).toBe(false);

      store.selectTheme('custom-1');
      expect(store.canSave()).toBe(true);
      expect(store.canDelete()).toBe(true);
    });
  });

  describe('save, save as and delete', () => {
    beforeEach(async () => {
      await store.initialize();
    });

    it('saves the draft over the selected custom theme under its own name', async () => {
      store.selectTheme('custom-1');
      store.setSlotColor('name', 8);
      const saved = { ...custom, parts: { device: store.draft() } };
      service.updateTheme.mockReturnValue(of(saved));

      const ok = await store.saveSelected();

      expect(ok).toBe(true);
      expect(service.updateTheme).toHaveBeenCalledWith('custom-1', 'Mine', store.draft());
      expect(store.themes().find((t) => t.id === 'custom-1')).toEqual(saved);
      expect(store.isEdited()).toBe(false);
      expect(store.isSaving()).toBe(false);
    });

    it('reports failure without changing the list', async () => {
      store.selectTheme('custom-1');
      service.updateTheme.mockReturnValue(throwError(() => new Error('nope')));

      const ok = await store.saveSelected();

      expect(ok).toBe(false);
      expect(store.themes()).toEqual([factory, custom]);
      expect(store.isSaving()).toBe(false);
    });

    it('saves as a new theme, keeps custom themes sorted by name and selects it', async () => {
      const created = theme('custom-2', ColorThemeKind.Custom, 7, 'Aardvark');
      service.createTheme.mockReturnValue(of(created));
      store.setSlotColor('time', 7);
      const draft = store.draft();

      const ok = await store.saveAs('Aardvark');

      expect(ok).toBe(true);
      expect(service.createTheme).toHaveBeenCalledWith('Aardvark', draft);
      expect(store.themes().map((t) => t.id)).toEqual([FACTORY_COLOR_THEME_ID, 'custom-2', 'custom-1']);
      expect(store.selectedThemeId()).toBe('custom-2');
      expect(store.draft()).toEqual(draft);
    });

    it('deletes the selected theme, clears the selection and keeps the draft', async () => {
      store.selectTheme('custom-1');
      service.deleteTheme.mockReturnValue(of(undefined));

      const ok = await store.deleteSelected();

      expect(ok).toBe(true);
      expect(service.deleteTheme).toHaveBeenCalledWith('custom-1');
      expect(store.themes()).toEqual([factory]);
      expect(store.selectedThemeId()).toBeNull();
      expect(store.draft()).toEqual(colors(2));
    });

    it('refuses to delete a shipped theme', async () => {
      store.selectTheme(FACTORY_COLOR_THEME_ID);

      expect(await store.deleteSelected()).toBe(false);
      expect(service.deleteTheme).not.toHaveBeenCalled();
    });
  });

  describe('apply target', () => {
    it('shows the target only with two or more connected devices', () => {
      devices.set([device('d1')]);
      expect(store.showApplyTarget()).toBe(false);

      devices.set([device('d1'), device('d2')]);
      expect(store.showApplyTarget()).toBe(true);
    });

    it('targets the chosen device and falls back to all when it disconnects', () => {
      devices.set([device('d1'), device('d2')]);
      store.setApplyTarget('d2');
      expect(store.effectiveApplyTarget()).toBe('d2');
      expect(store.targetDevices().map((d) => d.deviceId)).toEqual(['d2']);

      devices.set([device('d1'), device('d2', 'd2', false)]);

      expect(store.effectiveApplyTarget()).toBe(APPLY_TO_ALL_DEVICES);
      expect(store.targetDevices().map((d) => d.deviceId)).toEqual(['d1']);
    });

    it('cannot apply without a connected device', () => {
      expect(store.canApply()).toBe(false);
      devices.set([device('d1')]);
      expect(store.canApply()).toBe(true);
    });
  });

  describe('apply', () => {
    beforeEach(async () => {
      devices.set([device('d1', 'Alpha'), device('d2', '')]);
      records({ d1: record('d1', 2, 'custom-1'), d2: record('d2', 2, 'custom-1') });
      await store.initialize();
    });

    it('applies to each device in parallel, stores records for successes and alerts per device', async () => {
      const applied = record('d1', 2, 'custom-1');
      service.applyDeviceColors.mockImplementation((id: string) =>
        id === 'd1'
          ? of(applied)
          : throwError(() => new ColorThemeApplyError(id, 'busy', 'Device is busy.'))
      );
      store.setApplyTarget(APPLY_TO_ALL_DEVICES);
      const before = store.records()['d2'];

      await store.apply();

      expect(service.applyDeviceColors).toHaveBeenCalledTimes(2);
      expect(service.applyDeviceColors).toHaveBeenCalledWith('d1', colors(2), 'custom-1');
      expect(service.applyDeviceColors).toHaveBeenCalledWith('d2', colors(2), 'custom-1');
      expect(store.records()['d1']).toBe(applied);
      expect(store.records()['d2']).toBe(before);
      expect(alerts.success).toHaveBeenCalledTimes(1);
      expect(alerts.success).toHaveBeenCalledWith('“Mine” was applied to Alpha.');
      expect(alerts.error).toHaveBeenCalledTimes(1);
      expect(alerts.error).toHaveBeenCalledWith(
        'Applying “Mine” to d2 failed because the device is busy with a transfer.'
      );
      expect(store.isApplying()).toBe(false);
    });

    it('sends no theme id and words the alerts generically when the draft was edited', async () => {
      store.setSlotColor('banner', 9);
      service.applyDeviceColors.mockImplementation((id: string) =>
        id === 'd1'
          ? of(record('d1', 2, null))
          : throwError(() => new ColorThemeApplyError(id, 'notFound', 'gone'))
      );

      await store.apply();

      expect(service.applyDeviceColors).toHaveBeenCalledWith('d1', store.draft(), null);
      expect(alerts.success).toHaveBeenCalledWith('The colors were applied to Alpha.');
      expect(alerts.error).toHaveBeenCalledWith(
        'Applying the colors to d2 failed because the device is not connected.'
      );
    });

    it('includes the failure message for any other failure', async () => {
      store.setApplyTarget('d1');
      service.applyDeviceColors.mockReturnValue(
        throwError(() => new ColorThemeApplyError('d1', 'failed', 'The device went quiet.'))
      );

      await store.apply();

      expect(service.applyDeviceColors).toHaveBeenCalledTimes(1);
      expect(alerts.error).toHaveBeenCalledWith(
        'Applying “Mine” to Alpha failed: The device went quiet.'
      );
      expect(alerts.success).not.toHaveBeenCalled();
    });
  });
});
