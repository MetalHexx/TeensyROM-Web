import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { SettingsStore } from '@teensyrom-nx/application';
import {
  VideoCaptureSession,
  VideoControlsToolbarComponent,
  VideoDeviceSelectorComponent,
} from '@teensyrom-nx/ui/components';
import { ThemePreviewComponent } from './theme-preview.component';

describe('ThemePreviewComponent', () => {
  let fixture: ComponentFixture<ThemePreviewComponent>;
  let el: HTMLElement;
  let session: {
    devices: ReturnType<typeof signal<{ deviceId: string; label: string }[]>>;
    selectedDeviceId: ReturnType<typeof signal<string | null>>;
    stream: ReturnType<typeof signal<MediaStream | null>>;
    permissionDenied: ReturnType<typeof signal<boolean>>;
    hasDevices: ReturnType<typeof signal<boolean>>;
    hasEnumerated: ReturnType<typeof signal<boolean>>;
    start: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  };
  let settingsStore: {
    videoDeviceIdForDevice: ReturnType<typeof vi.fn>;
    updateDeviceVideoDeviceId: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    session = {
      devices: signal([{ deviceId: 'cam-a', label: 'Capture A' }]),
      selectedDeviceId: signal<string | null>('cam-a'),
      stream: signal<MediaStream | null>(null),
      permissionDenied: signal(false),
      hasDevices: signal(true),
      hasEnumerated: signal(true),
      start: vi.fn().mockResolvedValue(undefined),
      select: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn(),
    };
    settingsStore = {
      videoDeviceIdForDevice: vi.fn().mockReturnValue(signal('cam-a')),
      updateDeviceVideoDeviceId: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      imports: [ThemePreviewComponent],
      providers: [{ provide: SettingsStore, useValue: settingsStore }, provideNoopAnimations()],
    });
    TestBed.overrideComponent(ThemePreviewComponent, {
      set: { providers: [{ provide: VideoCaptureSession, useValue: session }] },
    });
    fixture = TestBed.createComponent(ThemePreviewComponent);
    fixture.componentRef.setInput('deviceId', 'dev-1');
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it('starts the session on the remembered camera of the device and restarts when the device changes', () => {
    expect(session.start).toHaveBeenCalledTimes(1);
    const preferred = session.start.mock.calls[0][0] as () => string;
    expect(preferred()).toBe('cam-a');
    expect(settingsStore.videoDeviceIdForDevice).toHaveBeenCalledWith('dev-1');

    fixture.componentRef.setInput('deviceId', 'dev-2');
    fixture.detectChanges();

    expect(session.start).toHaveBeenCalledTimes(2);
    session.start.mock.calls[1][0]();
    expect(settingsStore.videoDeviceIdForDevice).toHaveBeenCalledWith('dev-2');
  });

  it('turns the CRT, fullscreen and close switches off on the toolbar', () => {
    const toolbar = fixture.debugElement.query(By.directive(VideoControlsToolbarComponent))
      .componentInstance as VideoControlsToolbarComponent;

    expect(toolbar.showCrtToggle()).toBe(false);
    expect(toolbar.showCrtSettings()).toBe(false);
    expect(toolbar.showFullscreen()).toBe(false);
    expect(toolbar.showClose()).toBe(false);
    expect(el.querySelector('lib-crt-effect-wrapper')).toBeNull();
  });

  it('selects the camera and remembers it for the device', () => {
    fixture.debugElement
      .query(By.directive(VideoDeviceSelectorComponent))
      .componentInstance.deviceSelected.emit('cam-b');

    expect(session.select).toHaveBeenCalledWith('cam-b');
    expect(settingsStore.updateDeviceVideoDeviceId).toHaveBeenCalledWith({
      deviceId: 'dev-1',
      videoDeviceId: 'cam-b',
    });
  });

  it('shows the no-capture state once enumerated without cameras', () => {
    expect(el.textContent).not.toContain('No video capture device');

    session.devices.set([]);
    session.hasDevices.set(false);
    fixture.detectChanges();

    expect(el.textContent).toContain('No video capture device');
  });

  it('shows the permission state when the camera is denied', () => {
    session.permissionDenied.set(true);
    fixture.detectChanges();

    expect(el.textContent).toContain('Camera permission denied');
  });
});
