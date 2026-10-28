import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceStore, ITransferContext, TRANSFER_CONTEXT, TransferStore } from '@teensyrom-nx/application';
import {
  Device,
  DeviceHardwareVariant,
  DeviceMachine,
  DeviceState,
  DeviceVideoStandard,
  StorageType,
  TransferJobSnapshot,
  TransferJobState,
  TransferLaunchState,
  TransferOriginKind,
} from '@teensyrom-nx/domain';
import { TransfersCardComponent } from './transfers-card.component';

function createDevice(deviceId: string, name: string): Device {
  return {
    deviceId,
    comPort: 'COM3',
    name,
    fwVersion: '1.0.0',
    machine: DeviceMachine.C64,
    videoStandard: DeviceVideoStandard.Ntsc,
    todClockHz: null,
    hardwareVariant: DeviceHardwareVariant.TeensyRom,
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    sdStorage: { deviceId, type: StorageType.Sd, available: true, indexExists: true },
    usbStorage: { deviceId, type: StorageType.Usb, available: false, indexExists: false },
  };
}

const createSnapshot = (overrides: Partial<TransferJobSnapshot> = {}): TransferJobSnapshot => ({
  jobId: 'job-1',
  deviceId: 'device-1',
  storageType: StorageType.Sd,
  destinationDirectory: '/auto-transfer/',
  state: TransferJobState.Receiving,
  filesReceived: 3,
  filesSent: 3,
  filesFailed: 0,
  bytesSent: 0,
  totalFiles: 12,
  currentFile: null,
  origin: { kind: TransferOriginKind.Upload, watchFolderId: null, watchFolderPath: null },
  startedUtc: new Date('2026-01-01T00:00:00Z'),
  lastActivityUtc: new Date('2026-01-01T00:00:00Z'),
  error: null,
  failures: [],
  recentCompletions: [],
  bytesPerSecond: 412 * 1024,
  filesPerSecond: 0,
  expandingArchive: null,
  expansionBytesWritten: 0,
  expansionBytesDeclared: 0,
  expandedFileCount: null,
  launchState: TransferLaunchState.None,
  launchedPath: null,
  launchError: null,
  ...overrides,
});

describe('TransfersCardComponent', () => {
  let fixture: ComponentFixture<TransfersCardComponent>;
  let transferStore: InstanceType<typeof TransferStore>;
  let mockTransferContext: ITransferContext;

  const setup = async () => {
    mockTransferContext = {
      startTransfer: vi.fn().mockResolvedValue(undefined),
      retryCreate: vi.fn().mockResolvedValue(undefined),
      cancelTransfer: vi.fn().mockResolvedValue(undefined),
      closeTransfer: vi.fn().mockResolvedValue(undefined),
      showDetails: vi.fn().mockResolvedValue(undefined),
      hideDetails: vi.fn().mockResolvedValue(undefined),
      releaseOwnRecords: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [TransfersCardComponent],
      providers: [
        provideNoopAnimations(),
        TransferStore,
        {
          provide: DeviceStore,
          useValue: { devices: signal([createDevice('device-1', 'TR-1'), createDevice('device-2', 'Workbench TR')]) },
        },
        { provide: TRANSFER_CONTEXT, useValue: mockTransferContext },
      ],
    }).compileComponents();

    transferStore = TestBed.inject(TransferStore);
  };

  const createFixture = () => {
    fixture = TestBed.createComponent(TransfersCardComponent);
    fixture.detectChanges();
  };

  const native = () => fixture.nativeElement as HTMLElement;
  const rows = () => Array.from(native().querySelectorAll('[data-testid="transfer-row"]'));
  const textOf = (testId: string) => native().querySelector(`[data-testid="${testId}"]`)?.textContent?.trim();

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('shows the Transfers title and a quiet empty state when nothing is under way', async () => {
    await setup();
    createFixture();

    expect(native().querySelector('mat-card-title')?.textContent?.trim()).toBe('Transfers');
    expect(textOf('transfers-empty')).toContain('No active file transfers');
    expect(rows().length).toBe(0);
  });

  it('lists one row per live transfer, from any source', async () => {
    await setup();
    transferStore.foldLiveSnapshot({ snapshot: createSnapshot() });
    transferStore.foldLiveSnapshot({
      snapshot: createSnapshot({
        jobId: 'job-2',
        deviceId: 'device-2',
        startedUtc: new Date('2026-01-01T00:00:05Z'),
      }),
    });
    createFixture();

    expect(rows().length).toBe(2);
    expect(native().querySelector('[data-testid="transfers-empty"]')).toBeNull();
    const names = Array.from(native().querySelectorAll('[data-testid="transfer-row-device"]')).map((el) =>
      el.textContent?.trim()
    );
    expect(names).toEqual(['TR-1', 'Workbench TR']);
  });

  it('falls back to the device id when the device is unknown', async () => {
    await setup();
    transferStore.foldLiveSnapshot({ snapshot: createSnapshot({ deviceId: 'mystery-device' }) });
    createFixture();

    expect(textOf('transfer-row-device')).toBe('mystery-device');
  });

  it('labels a watched transfer with its folder name and an upload as "Upload"', async () => {
    await setup();
    transferStore.foldLiveSnapshot({
      snapshot: createSnapshot({
        origin: {
          kind: TransferOriginKind.WatchFolder,
          watchFolderId: 'wf-1',
          watchFolderPath: 'C:\\Users\\me\\Downloads',
        },
      }),
    });
    transferStore.foldLiveSnapshot({
      snapshot: createSnapshot({
        jobId: 'job-2',
        deviceId: 'device-2',
        startedUtc: new Date('2026-01-01T00:00:05Z'),
      }),
    });
    createFixture();

    const origins = Array.from(native().querySelectorAll('[data-testid="transfer-row-origin"]')).map((el) =>
      el.textContent?.trim()
    );
    expect(origins[0]).toMatch(/Downloads$/);
    expect(origins[0]).not.toContain('Users');
    expect(origins[1]).toMatch(/Upload$/);
  });

  it('shows the percent, labelling the bar with the device and percent written', async () => {
    await setup();
    transferStore.foldLiveSnapshot({ snapshot: createSnapshot() });
    createFixture();

    const percent = transferStore.getLiveTransfers()()[0].devicePercent;
    expect(textOf('transfer-row-percent')).toBe(`${percent}%`);
    expect(native().querySelector('[data-testid="transfer-row-bar"]')?.getAttribute('aria-label')).toBe(
      `TR-1 ${percent}% written`
    );
  });

  it('shows files sent of the total and the write rate in KB/s', async () => {
    await setup();
    transferStore.foldLiveSnapshot({ snapshot: createSnapshot({ filesSent: 3, totalFiles: 12 }) });
    createFixture();

    const total = transferStore.getLiveTransfers()()[0].fileTotal;
    expect(textOf('transfer-row-files')).toBe(`3 of ${total} files`);
    expect(textOf('transfer-row-rate')).toBe('412 KB/s');
  });

  it('opens the details dialog on the row device from its expand button', async () => {
    await setup();
    transferStore.foldLiveSnapshot({ snapshot: createSnapshot({ deviceId: 'device-2', jobId: 'job-2' }) });
    createFixture();

    const button = native().querySelector<HTMLButtonElement>('[data-testid="transfer-row-show"] button');
    expect(button?.getAttribute('aria-label')).toBe('Show transfer to Workbench TR');
    button?.click();

    expect(mockTransferContext.showDetails).toHaveBeenCalledWith('device-2');
  });

  it('announces each row percent in one polite live region', async () => {
    await setup();
    transferStore.foldLiveSnapshot({ snapshot: createSnapshot() });
    createFixture();

    const regions = native().querySelectorAll('[aria-live="polite"]');
    expect(regions.length).toBe(1);
    expect(regions[0].textContent).toContain('TR-1');
    expect(regions[0].textContent).toContain('% written');
  });

  it('advances the elapsed label while rows exist and stops the ticker once they are gone', async () => {
    vi.useFakeTimers();
    await setup();
    createFixture();
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');

    transferStore.foldLiveSnapshot({ snapshot: createSnapshot({ startedUtc: new Date() }) });
    fixture.detectChanges();
    const before = textOf('transfer-row-elapsed');

    await vi.advanceTimersByTimeAsync(3000);
    fixture.detectChanges();

    expect(textOf('transfer-row-elapsed')).not.toBe(before);

    transferStore.foldLiveSnapshot({
      snapshot: createSnapshot({ state: TransferJobState.Completed, startedUtc: new Date() }),
    });
    fixture.detectChanges();

    expect(rows().length).toBe(0);
    expect(clearSpy).toHaveBeenCalled();
  });

  describe('settings gear', () => {
    beforeEach(async () => {
      await setup();
      createFixture();
    });

    const gear = () => native().querySelector<HTMLElement>('[data-testid="transfer-settings-button"]');
    const gearButton = () => gear()?.querySelector('button') as HTMLButtonElement;

    it('sits in the card corner, outside the list', () => {
      expect(gear()?.closest('.corner-content')).toBeTruthy();
      expect(gear()?.closest('[data-testid="transfers-card"]')).toBeNull();
    });

    it('labels the gear as opening the panel while it is closed', () => {
      expect(gearButton().getAttribute('aria-label')).toBe('Open transfer settings');
      expect(gearButton().getAttribute('aria-expanded')).toBe('false');
    });

    it('reports the open state through the label, highlight and aria-expanded', () => {
      fixture.componentRef.setInput('settingsOpen', true);
      fixture.detectChanges();

      expect(gearButton().getAttribute('aria-label')).toBe('Close transfer settings');
      expect(gearButton().getAttribute('aria-expanded')).toBe('true');
      expect(gear()?.querySelector('mat-icon')?.classList.contains('highlight')).toBe(true);
    });

    it('emits settingsToggle when the gear is pressed', () => {
      const toggled = vi.fn();
      fixture.componentInstance.settingsToggle.subscribe(toggled);

      gearButton().click();

      expect(toggled).toHaveBeenCalledTimes(1);
    });

    it('focuses the gear button', () => {
      fixture.componentInstance.focusSettingsButton();

      expect(document.activeElement).toBe(gearButton());
    });
  });
});
