import { describe, it, expect, vi } from 'vitest';
import { signal } from '@angular/core';
import { of, BehaviorSubject } from 'rxjs';
import { BreakpointObserver, type BreakpointState } from '@angular/cdk/layout';
import { renderPlayerComponent } from '../../../testing/render-player-component';
import { createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { SettingsStore, StorageKeyUtil, type LaunchedFile } from '@teensyrom-nx/application';
import { Device, DeviceState, StorageType } from '@teensyrom-nx/domain';
import { PlayerDeviceContainerComponent } from './player-device-container.component';

const PHONE_QUERY = '(max-width: 639px)';
const TOUCH_QUERY = '(hover: none)';

function createDevice(overrides: Partial<Device> = {}): Device {
  const deviceId = overrides.deviceId ?? 'test-device';
  return {
    deviceId,
    comPort: 'COM3',
    name: 'Test Device',
    fwVersion: '1.0.0',
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    sdStorage: { deviceId, type: StorageType.Sd, available: false, indexExists: false },
    usbStorage: { deviceId, type: StorageType.Usb, available: false, indexExists: false },
    ...overrides,
  };
}

function createLaunchedFile(deviceId = 'test-device'): LaunchedFile {
  return {
    storageKey: StorageKeyUtil.create(deviceId, StorageType.Sd),
    file: createTestFileItem(),
    parentPath: '/',
    launchedAt: Date.now(),
    isCompatible: true,
  };
}

function setPhone(subject: BehaviorSubject<BreakpointState>, matches: boolean): void {
  subject.next({ matches, breakpoints: { [PHONE_QUERY]: matches } });
}

function prop(el: Element | null, name: string): unknown {
  return el === null ? undefined : (el as unknown as Record<string, unknown>)[name];
}

function render(device: Device | undefined = createDevice()) {
  const currentFile = signal<LaunchedFile | null>(null);
  const enableVideo = signal(false);
  const phoneBreakpoint = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });
  const touchBreakpoint = new BehaviorSubject<BreakpointState>({ matches: false, breakpoints: {} });

  const context = {
    initializePlayer: vi.fn(),
    getCurrentFile: vi.fn().mockReturnValue(currentFile),
  };

  const settingsStore = {
    enableVideoForDevice: vi.fn().mockReturnValue(enableVideo),
  };

  const breakpointObserver = {
    observe: (query: string) => {
      if (query === PHONE_QUERY) return phoneBreakpoint.asObservable();
      if (query === TOUCH_QUERY) return touchBreakpoint.asObservable();
      return of({ matches: false, breakpoints: {} });
    },
  };

  const result = renderPlayerComponent(PlayerDeviceContainerComponent, {
    inputs: { device },
    playerContext: context,
    providers: [
      { provide: SettingsStore, useValue: settingsStore },
      { provide: BreakpointObserver, useValue: breakpointObserver },
    ],
  });

  return {
    ...result,
    context,
    settingsStore,
    currentFile,
    enableVideo,
    phoneBreakpoint,
    touchBreakpoint,
  };
}

describe('PlayerDeviceContainerComponent', () => {
  it('creates', () => {
    const { component } = render();

    expect(component).toBeTruthy();
  });

  it('initializes the player for the device on construction', () => {
    const { context } = render(createDevice({ deviceId: 'device-42' }));

    expect(context.initializePlayer).toHaveBeenCalledWith('device-42');
  });

  it('isPhone defaults to false', () => {
    const { component } = render();

    expect(component['isPhone']()).toBe(false);
  });

  describe('enableVideo', () => {
    it('defaults to false', () => {
      const { component } = render();

      expect(component.enableVideo()).toBe(false);
    });

    it('reflects true from settings', () => {
      const { component, enableVideo } = render();
      enableVideo.set(true);

      expect(component.enableVideo()).toBe(true);
    });

    it('updates reactively across true/false/true', () => {
      const { component, enableVideo } = render();

      expect(component.enableVideo()).toBe(false);
      enableVideo.set(true);
      expect(component.enableVideo()).toBe(true);
      enableVideo.set(false);
      expect(component.enableVideo()).toBe(false);
      enableVideo.set(true);
      expect(component.enableVideo()).toBe(true);
    });
  });

  describe('video-capture visibility', () => {
    it('renders when enableVideo is true', () => {
      const { fixture, enableVideo } = render();
      enableVideo.set(true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-video-capture')).toBeTruthy();
    });

    it('is absent when enableVideo is false', () => {
      const { fixture } = render();

      expect(fixture.nativeElement.querySelector('lib-video-capture')).toBeNull();
    });

    it('still renders file-image when video-capture is hidden', () => {
      const { fixture } = render();

      expect(fixture.nativeElement.querySelector('lib-file-image')).toBeTruthy();
    });

    it('still renders file-description when video-capture is hidden', () => {
      const { fixture, currentFile } = render();
      currentFile.set(createLaunchedFile());
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-file-description')).toBeTruthy();
    });
  });

  describe('paneIndicators', () => {
    it('is empty on desktop without video', () => {
      const { component } = render();

      expect(component['paneIndicators']()).toEqual([]);
    });

    it('lists image/description/video on desktop with video', () => {
      const { component, enableVideo } = render();
      enableVideo.set(true);

      expect(component['paneIndicators']()).toEqual([
        { label: 'Show image', index: 0 },
        { label: 'Show description', index: 1 },
        { label: 'Show video', index: 2 },
      ]);
    });

    it('lists 3 panes on phone without video', () => {
      const { component, fixture, phoneBreakpoint } = render();
      setPhone(phoneBreakpoint, true);
      fixture.detectChanges();

      expect(component['paneIndicators']()).toEqual([
        { label: 'Show storage', index: 0 },
        { label: 'Show image', index: 1 },
        { label: 'Show description', index: 2 },
      ]);
    });

    it('lists 4 panes on phone with video', () => {
      const { component, fixture, phoneBreakpoint, enableVideo } = render();
      setPhone(phoneBreakpoint, true);
      enableVideo.set(true);
      fixture.detectChanges();

      expect(component['paneIndicators']()).toEqual([
        { label: 'Show storage', index: 0 },
        { label: 'Show image', index: 1 },
        { label: 'Show description', index: 2 },
        { label: 'Show video', index: 3 },
      ]);
    });
  });

  describe('hasStorageIndex', () => {
    it('is false when device is undefined', () => {
      const { component, setInput } = render();
      setInput('device', undefined);

      expect(component.hasStorageIndex()).toBe(false);
    });

    it('is false when device has no storage properties', () => {
      const { component, setInput } = render();
      setInput('device', { deviceId: 'test-device', name: 'Test', isConnected: true, isEnabled: true });

      expect(component.hasStorageIndex()).toBe(false);
    });

    it('is true when sdStorage has indexExists', () => {
      const { component, setInput } = render();
      setInput(
        'device',
        createDevice({
          sdStorage: { deviceId: 'test-device', type: StorageType.Sd, indexExists: true, available: true },
          usbStorage: { deviceId: 'test-device', type: StorageType.Usb, indexExists: false, available: false },
        })
      );

      expect(component.hasStorageIndex()).toBe(true);
    });

    it('is true when usbStorage has indexExists', () => {
      const { component, setInput } = render();
      setInput(
        'device',
        createDevice({
          sdStorage: { deviceId: 'test-device', type: StorageType.Sd, indexExists: false, available: false },
          usbStorage: { deviceId: 'test-device', type: StorageType.Usb, indexExists: true, available: true },
        })
      );

      expect(component.hasStorageIndex()).toBe(true);
    });

    it('is false when both storages have indexExists false', () => {
      const { component, setInput } = render();
      setInput(
        'device',
        createDevice({
          sdStorage: { deviceId: 'test-device', type: StorageType.Sd, indexExists: false, available: true },
          usbStorage: { deviceId: 'test-device', type: StorageType.Usb, indexExists: false, available: true },
        })
      );

      expect(component.hasStorageIndex()).toBe(false);
    });
  });

  describe('always-visible toolbars', () => {
    it('renders the combined-toolbar when no file is launched', () => {
      const { fixture } = render();

      expect(fixture.nativeElement.querySelector('.combined-toolbar')).toBeTruthy();
    });

    it('renders player-toolbar when no file is launched', () => {
      const { fixture } = render();

      expect(fixture.nativeElement.querySelector('lib-player-toolbar')).toBeTruthy();
    });

    it('renders filter-toolbar when no file is launched', () => {
      const { fixture } = render();

      expect(fixture.nativeElement.querySelector('lib-filter-toolbar')).toBeTruthy();
    });

    it('passes disabled=true to player-toolbar when no file is launched', () => {
      const { fixture } = render();

      const toolbar = fixture.nativeElement.querySelector('lib-player-toolbar');
      expect(prop(toolbar, 'disabled')).toBe(true);
    });

    it('passes disabled=false to player-toolbar when a file is launched', () => {
      const { fixture, currentFile } = render();
      currentFile.set(createLaunchedFile());
      fixture.detectChanges();

      const toolbar = fixture.nativeElement.querySelector('lib-player-toolbar');
      expect(prop(toolbar, 'disabled')).toBe(false);
    });

    it('renders the phone toolbar-mini on the phone breakpoint', () => {
      const { fixture, phoneBreakpoint } = render();
      setPhone(phoneBreakpoint, true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-player-toolbar-mini')).toBeTruthy();
    });
  });

  describe('empty-state messaging', () => {
    it('shows the storage-not-indexed icon and title', () => {
      const { fixture, component } = render();

      expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
      expect(component.emptyStateIcon()).toBe('sd_storage');
      expect(component.emptyStateTitle()).toBe('Index Your Storage');
    });

    it('shows the ready-to-play icon and title when storage is indexed but no file is launched', () => {
      const { fixture, component, setInput } = render();
      setInput(
        'device',
        createDevice({
          sdStorage: { deviceId: 'test-device', type: StorageType.Sd, indexExists: true, available: true },
        })
      );

      expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeTruthy();
      expect(component.emptyStateIcon()).toBe('play_circle');
      expect(component.emptyStateTitle()).toBe('Ready to Play');
    });

    it('replaces the empty-state with file-description once a file is launched', () => {
      const { fixture, currentFile } = render();
      currentFile.set(createLaunchedFile());
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-empty-state-message')).toBeNull();
      expect(fixture.nativeElement.querySelector('lib-file-description')).toBeTruthy();
    });

    it('hides file-description-mini on phone when no file is launched', () => {
      const { fixture, phoneBreakpoint } = render();
      setPhone(phoneBreakpoint, true);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-file-description-mini')).toBeNull();
    });

    it('shows file-description-mini on phone once a file is launched', () => {
      const { fixture, phoneBreakpoint, currentFile } = render();
      setPhone(phoneBreakpoint, true);
      currentFile.set(createLaunchedFile());
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('lib-file-description-mini')).toBeTruthy();
    });
  });
});
