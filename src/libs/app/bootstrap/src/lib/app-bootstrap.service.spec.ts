import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi } from 'vitest';
import { DeviceStore, SettingsStore } from '@teensyrom-nx/application';
import { ALERT_SERVICE, DEVICE_LOGS_SERVICE } from '@teensyrom-nx/domain';
import { AppBootstrapService } from './app-bootstrap.service';
import { AudioBootstrapService } from './audio-bootstrap.service';
import { DjBootstrapService } from './dj-bootstrap.service';

describe('AppBootstrapService', () => {
  function configure(): {
    service: AppBootstrapService;
    djBootstrapInit: ReturnType<typeof vi.fn>;
    audioBootstrapInit: ReturnType<typeof vi.fn>;
    findDevicesMock: ReturnType<typeof vi.fn>;
  } {
    const djBootstrapInit = vi.fn();
    const audioBootstrapInit = vi.fn();
    const findDevicesMock = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        AppBootstrapService,
        { provide: SettingsStore, useValue: {} },
        { provide: DeviceStore, useValue: { hasInitialised: () => true, findDevices: findDevicesMock } },
        { provide: DEVICE_LOGS_SERVICE, useValue: { connect: vi.fn() } },
        { provide: ALERT_SERVICE, useValue: {} },
        { provide: AudioBootstrapService, useValue: { init: audioBootstrapInit } },
        { provide: DjBootstrapService, useValue: { init: djBootstrapInit } },
      ],
    });

    const service = TestBed.inject(AppBootstrapService);
    // Settings loading is pre-existing, effect-driven behaviour this spec does not own — bypassed
    // here so the spec's only concern is the new `djBootstrapService.init()` wiring.
    vi.spyOn(service as unknown as { initializeSettings(): Promise<void> }, 'initializeSettings').mockResolvedValue(
      undefined
    );

    return { service, djBootstrapInit, audioBootstrapInit, findDevicesMock };
  }

  it('calls djBootstrapService.init() during bootstrap, alongside audioBootstrapService.init(), after findDevices is issued', async () => {
    const { service, djBootstrapInit, audioBootstrapInit, findDevicesMock } = configure();

    const initPromise = service.init();
    await vi.waitFor(() => {
      TestBed.flushEffects();
      expect(djBootstrapInit).toHaveBeenCalledTimes(1);
    });

    expect(findDevicesMock).toHaveBeenCalledWith(false);
    expect(audioBootstrapInit).toHaveBeenCalledTimes(1);

    await initPromise;
  });
});
