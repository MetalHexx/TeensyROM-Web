import { describe, it, expect, beforeEach, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import {
  DeviceThemePartDto,
  DeviceThemeRecordDto,
  ResponseError,
  ThemeDto,
  ThemesApiService,
} from '@teensyrom-nx/data-access/api-client';
import {
  ALERT_SERVICE,
  ColorThemeApplyError,
  ColorThemeKind,
  DEVICE_BUSY_PROBLEM_CODE,
  DeviceColors,
} from '@teensyrom-nx/domain';
import { ColorThemeService } from './color-theme.service';

const colors: DeviceColors = {
  background: 0,
  border: 4,
  banner: 4,
  time: 10,
  option: 7,
  sources: 14,
  name: 13,
};
const colorsDto: DeviceThemePartDto = { ...colors };

const themeDto = (overrides: Partial<ThemeDto> = {}): ThemeDto => ({
  id: 'theme-1',
  name: 'Theme One',
  kind: 'Custom',
  parts: { device: colorsDto },
  ...overrides,
});

const problem = (status: number, body: unknown) =>
  new ResponseError(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/problem+json' },
    }),
    'error'
  );

describe('ColorThemeService', () => {
  let service: ColorThemeService;
  let api: {
    listThemes: ReturnType<typeof vi.fn>;
    createTheme: ReturnType<typeof vi.fn>;
    updateTheme: ReturnType<typeof vi.fn>;
    deleteTheme: ReturnType<typeof vi.fn>;
    getDeviceTheme: ReturnType<typeof vi.fn>;
    applyDeviceTheme: ReturnType<typeof vi.fn>;
  };
  let alerts: { error: ReturnType<typeof vi.fn>; success: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      listThemes: vi.fn(),
      createTheme: vi.fn(),
      updateTheme: vi.fn(),
      deleteTheme: vi.fn(),
      getDeviceTheme: vi.fn(),
      applyDeviceTheme: vi.fn(),
    };
    alerts = { error: vi.fn(), success: vi.fn() };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        ColorThemeService,
        { provide: ThemesApiService, useValue: api },
        { provide: ALERT_SERVICE, useValue: alerts },
      ],
    });
    service = TestBed.inject(ColorThemeService);
  });

  describe('listThemes', () => {
    it('maps themes to the domain model', async () => {
      api.listThemes.mockResolvedValue({
        themes: [themeDto(), themeDto({ id: 'tr-default', name: 'TR Default', kind: 'Shipped' })],
      });

      const themes = await firstValueFrom(service.listThemes());

      expect(themes).toEqual([
        {
          id: 'theme-1',
          name: 'Theme One',
          kind: ColorThemeKind.Custom,
          parts: { device: colors },
        },
        {
          id: 'tr-default',
          name: 'TR Default',
          kind: ColorThemeKind.Shipped,
          parts: { device: colors },
        },
      ]);
    });

    it('alerts with the fallback message and rethrows on failure', async () => {
      const failure = 'boom';
      api.listThemes.mockRejectedValue(failure);

      await expect(firstValueFrom(service.listThemes())).rejects.toBe(failure);

      expect(alerts.error).toHaveBeenCalledWith('Failed to load themes');
    });
  });

  describe('createTheme and updateTheme', () => {
    it('sends the name and device colors and maps the saved theme', async () => {
      api.createTheme.mockResolvedValue({ theme: themeDto({ name: 'New' }) });
      api.updateTheme.mockResolvedValue({ theme: themeDto({ name: 'Renamed' }) });

      const created = await firstValueFrom(service.createTheme('New', colors));
      const updated = await firstValueFrom(service.updateTheme('theme-1', 'Renamed', colors));

      expect(api.createTheme).toHaveBeenCalledWith({
        saveThemeBody: { name: 'New', device: colorsDto },
      });
      expect(api.updateTheme).toHaveBeenCalledWith({
        themeId: 'theme-1',
        saveThemeBody: { name: 'Renamed', device: colorsDto },
      });
      expect(created.name).toBe('New');
      expect(updated.name).toBe('Renamed');
    });

    it('alerts with the engine message when the API gives one', async () => {
      api.createTheme.mockRejectedValue(problem(400, { title: 'A theme named X already exists.' }));

      await expect(firstValueFrom(service.createTheme('X', colors))).rejects.toBeInstanceOf(
        ResponseError
      );

      expect(alerts.error).toHaveBeenCalledWith('A theme named X already exists.');
    });
  });

  describe('getDeviceColors', () => {
    const recordDto = (overrides: Partial<DeviceThemeRecordDto> = {}): DeviceThemeRecordDto => ({
      deviceId: 'dev-1',
      colors: colorsDto,
      themeId: 'theme-1',
      appliedAt: new Date('2026-10-28T12:00:00.000Z'),
      isRecorded: true,
      ...overrides,
    });

    it('maps appliedAt to an ISO string', async () => {
      api.getDeviceTheme.mockResolvedValue({ record: recordDto() });

      const record = await firstValueFrom(service.getDeviceColors('dev-1'));

      expect(record).toEqual({
        deviceId: 'dev-1',
        colors,
        themeId: 'theme-1',
        appliedAt: '2026-10-28T12:00:00.000Z',
        isRecorded: true,
      });
    });

    it('maps a missing appliedAt and themeId to null', async () => {
      api.getDeviceTheme.mockResolvedValue({
        record: recordDto({ appliedAt: undefined, themeId: undefined, isRecorded: false }),
      });

      const record = await firstValueFrom(service.getDeviceColors('dev-1'));

      expect(record.appliedAt).toBeNull();
      expect(record.themeId).toBeNull();
    });
  });

  describe('applyDeviceColors', () => {
    const apply = () => firstValueFrom(service.applyDeviceColors('dev-1', colors, 'theme-1'));

    it('sends the colors and theme id and maps the record', async () => {
      api.applyDeviceTheme.mockResolvedValue({
        record: { deviceId: 'dev-1', colors: colorsDto, themeId: 'theme-1', isRecorded: true },
      });

      const record = await apply();

      expect(api.applyDeviceTheme).toHaveBeenCalledWith({
        deviceId: 'dev-1',
        applyDeviceThemeBody: { colors: colorsDto, themeId: 'theme-1' },
      });
      expect(record.isRecorded).toBe(true);
    });

    it('fails as busy with the problem title on a 409 busy problem', async () => {
      api.applyDeviceTheme.mockRejectedValue(
        problem(409, {
          code: DEVICE_BUSY_PROBLEM_CODE,
          deviceId: 'dev-1',
          title: 'Device is busy with a transfer.',
        })
      );

      const error = await apply().catch((e) => e);

      expect(error).toBeInstanceOf(ColorThemeApplyError);
      expect(error.reason).toBe('busy');
      expect(error.deviceId).toBe('dev-1');
      expect(error.message).toBe('Device is busy with a transfer.');
      expect(alerts.error).not.toHaveBeenCalled();
    });

    it('fails as notFound on a 404', async () => {
      api.applyDeviceTheme.mockRejectedValue(problem(404, 'Device not found'));

      const error = await apply().catch((e) => e);

      expect(error).toBeInstanceOf(ColorThemeApplyError);
      expect(error.reason).toBe('notFound');
      expect(alerts.error).not.toHaveBeenCalled();
    });

    it('fails as failed with the API message on a 502', async () => {
      api.applyDeviceTheme.mockRejectedValue(problem(502, { title: 'The device went quiet.' }));

      const error = await apply().catch((e) => e);

      expect(error).toBeInstanceOf(ColorThemeApplyError);
      expect(error.reason).toBe('failed');
      expect(error.message).toBe('The device went quiet.');
      expect(alerts.error).not.toHaveBeenCalled();
    });
  });
});
