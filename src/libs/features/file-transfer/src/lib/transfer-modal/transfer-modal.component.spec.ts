import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  DeviceStore,
  ITransferContext,
  TRANSFER_CONTEXT,
  TransferModalState,
  TransferStore,
} from '@teensyrom-nx/application';
import { Device, DeviceState, StorageType, TransferJobSnapshot, TransferJobState } from '@teensyrom-nx/domain';
import { TransferModalComponent } from './transfer-modal.component';

function createDevice(overrides: Partial<Device> = {}): Device {
  const deviceId = overrides.deviceId ?? 'device-1';
  return {
    deviceId,
    comPort: 'COM3',
    name: 'My TeensyROM',
    fwVersion: '1.0.0',
    isCompatible: true,
    isConnected: true,
    deviceState: DeviceState.Connected,
    isEnabled: true,
    sdStorage: { deviceId, type: StorageType.Sd, available: true, indexExists: true },
    usbStorage: { deviceId, type: StorageType.Usb, available: false, indexExists: false },
    ...overrides,
  };
}

const createSnapshot = (overrides: Partial<TransferJobSnapshot> = {}): TransferJobSnapshot => ({
  jobId: 'job-1',
  deviceId: 'device-1',
  storageType: StorageType.Sd,
  destinationDirectory: '/music/',
  state: TransferJobState.Receiving,
  filesReceived: 3,
  filesSent: 1,
  filesFailed: 0,
  totalFiles: 5,
  currentFile: 'music/song.sid',
  startedUtc: new Date('2026-01-01T00:00:00Z'),
  error: null,
  failures: [],
  recentCompletions: [],
  bytesPerSecond: 0,
  filesPerSecond: 0,
  ...overrides,
});

const JOB_BACKED_JOB_STATES: Record<string, TransferJobState> = {
  receiving: TransferJobState.Receiving,
  draining: TransferJobState.Sealed,
  cancelling: TransferJobState.Cancelling,
  completed: TransferJobState.Completed,
  cancelled: TransferJobState.Cancelled,
  aborted: TransferJobState.Aborted,
  abandoned: TransferJobState.Abandoned,
};

const ALL_MODAL_STATES: TransferModalState[] = [
  'scanning',
  'starting',
  'device-busy',
  'nothing-to-transfer',
  'failed',
  'receiving',
  'draining',
  'cancelling',
  'completed',
  'cancelled',
  'aborted',
  'abandoned',
];

/** Drives the real `TransferStore` through whatever action sequence yields the given modal state. */
function driveToState(
  store: InstanceType<typeof TransferStore>,
  deviceId: string,
  state: TransferModalState
): void {
  store.beginScan({ deviceId, droppedRootName: 'HVSC', destinationLabel: '/games' });

  if (state === 'scanning') return;

  if (state === 'nothing-to-transfer') {
    store.completeScan({ deviceId, scanTotal: 0 });
    return;
  }

  store.completeScan({ deviceId, scanTotal: 5 });
  store.beginJob({ deviceId });

  if (state === 'starting') return;

  if (state === 'device-busy') {
    store.setDeviceBusy({ deviceId, activeForeignJobId: 'foreign-job', error: 'Device is busy' });
    return;
  }

  if (state === 'failed') {
    store.setTransferError({ deviceId, error: 'Create rejected' });
    return;
  }

  store.applyJobSnapshot({ deviceId, snapshot: createSnapshot({ deviceId, state: JOB_BACKED_JOB_STATES[state] }) });
}

describe('TransferModalComponent', () => {
  let fixture: ComponentFixture<TransferModalComponent>;
  let component: TransferModalComponent;
  let transferStore: InstanceType<typeof TransferStore>;
  let mockTransferContext: ITransferContext;
  let mockDialog: { open: ReturnType<typeof vi.fn> };
  let mockOwnDialogRef: { close: ReturnType<typeof vi.fn>; afterClosed: () => Subject<void> };
  let afterClosedSubject: Subject<void>;
  const deviceId = 'device-1';

  const setup = async (devices: Device[] = [createDevice({ deviceId })]) => {
    TestBed.resetTestingModule();

    mockTransferContext = {
      startTransfer: vi.fn().mockResolvedValue(undefined),
      retryCreate: vi.fn().mockResolvedValue(undefined),
      cancelTransfer: vi.fn().mockResolvedValue(undefined),
      closeTransfer: vi.fn().mockResolvedValue(undefined),
      refreshDeviceBusyState: vi.fn().mockResolvedValue(undefined),
    };

    mockDialog = { open: vi.fn() };

    afterClosedSubject = new Subject<void>();
    mockOwnDialogRef = {
      close: vi.fn(),
      afterClosed: () => afterClosedSubject,
    };

    await TestBed.configureTestingModule({
      imports: [TransferModalComponent],
      providers: [
        provideNoopAnimations(),
        TransferStore,
        { provide: DeviceStore, useValue: { devices: signal(devices) } },
        { provide: TRANSFER_CONTEXT, useValue: mockTransferContext },
        { provide: MatDialog, useValue: mockDialog },
        { provide: MatDialogRef, useValue: mockOwnDialogRef },
      ],
    }).compileComponents();

    transferStore = TestBed.inject(TransferStore);
  };

  const createFixture = () => {
    fixture = TestBed.createComponent(TransferModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  afterEach(() => {
    fixture?.destroy();
    document.body.querySelectorAll('[data-testid="dropzone-choose-files"]').forEach((el) => el.remove());
  });

  describe('view model assembly', () => {
    // Runs a full TestBed setup + fixture per modal state (12 iterations), which is
    // genuinely ~700-1000ms of real work locally and can tip past the suite's 2000ms
    // default under CI's parallel CPU contention - give it real headroom instead.
    it('yields a non-null view model for every modal state the store can produce', async () => {
      for (const state of ALL_MODAL_STATES) {
        await setup();
        transferStore.setTargetDevice({ deviceId });
        driveToState(transferStore, deviceId, state);

        createFixture();

        expect(component.vm().state).toBe(state);
        fixture.destroy();
      }
    }, 10000);

    it('reads deviceName from the matching device, falling back to the deviceId when unmatched', async () => {
      await setup([createDevice({ deviceId: 'other-device', name: 'Someone Else' })]);
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'scanning');

      createFixture();

      expect(component.vm().deviceName).toBe(deviceId);
    });

    it('renders destinationLabel from the captured pre-job destination before a job exists', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'scanning');

      createFixture();

      expect(component.vm().destinationLabel).toBe('/games');
    });

    it('renders destinationLabel as storage · path once a job exists', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'receiving');

      createFixture();

      expect(component.vm().destinationLabel).toBe(`${StorageType.Sd} · /music/`);
    });

    it('passes metrics and summary through without recomputing them', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'receiving');

      createFixture();

      const vm = component.vm();
      const metrics = transferStore.getTransferMetrics(deviceId)();
      const summary = transferStore.getTransferSummary(deviceId)();

      expect(vm.uploaded).toBe(metrics.uploaded);
      expect(vm.written).toBe(metrics.written);
      expect(vm.failed).toBe(metrics.failed);
      expect(vm.apiPercent).toBe(metrics.apiPct);
      expect(vm.devicePercent).toBe(metrics.devicePct);
      expect(vm.failureOverflow).toBe(summary.failureOverflow);
      expect(vm.reason).toBe(summary.reason);
    });

    it('carries the rate figures through from the job snapshot', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'receiving');
      transferStore.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({ deviceId, state: TransferJobState.Receiving, filesPerSecond: 9.8, bytesPerSecond: 1_500_000 }),
      });

      createFixture();

      const vm = component.vm();
      expect(vm.filesPerSecond).toBe(9.8);
      expect(vm.bytesPerSecond).toBe(1_500_000);
    });

    it('defaults the rate figures to 0 when there is no job', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'scanning');

      createFixture();

      const vm = component.vm();
      expect(vm.filesPerSecond).toBe(0);
      expect(vm.bytesPerSecond).toBe(0);
    });
  });

  describe('elapsed ticker', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('advances the elapsed label once per second while the transfer is running', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'receiving');
      createFixture();

      const before = component.vm().elapsedLabel;
      expect(before).not.toBeNull();

      await vi.advanceTimersByTimeAsync(1000);

      expect(component.vm().elapsedLabel).not.toBe(before);
    });

    it('freezes the elapsed label once a running transfer reaches a terminal state', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'receiving');
      createFixture();

      await vi.advanceTimersByTimeAsync(1000);

      transferStore.applyJobSnapshot({
        deviceId,
        snapshot: createSnapshot({ deviceId, state: TransferJobState.Completed }),
      });
      fixture.detectChanges();

      const frozen = component.vm().elapsedLabel;
      await vi.advanceTimersByTimeAsync(5000);

      expect(component.vm().elapsedLabel).toBe(frozen);
    });
  });

  describe('cancel handling', () => {
    it('cancels immediately, without a confirmation dialog, before a job exists', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'scanning');
      createFixture();

      component.onCancelRequested();

      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockTransferContext.cancelTransfer).toHaveBeenCalledWith(deviceId);
    });

    it('routes cancel through the confirmation dialog once a job exists, and only cancels on confirmation', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'receiving');
      createFixture();

      const confirmed = new Subject<void>();
      const cancelled = new Subject<void>();
      const confirmRef = {
        close: vi.fn(),
        componentInstance: { confirmed, cancelled },
        componentRef: { setInput: vi.fn() },
      };
      mockDialog.open.mockReturnValue(confirmRef);

      component.onCancelRequested();

      expect(mockDialog.open).toHaveBeenCalledTimes(1);
      expect(mockTransferContext.cancelTransfer).not.toHaveBeenCalled();

      const written = transferStore.getTransferMetrics(deviceId)().written;
      expect(confirmRef.componentRef.setInput).toHaveBeenCalledWith(
        'message',
        expect.stringContaining(`${written}`)
      );
      expect(confirmRef.componentRef.setInput).toHaveBeenCalledWith('confirmLabel', 'Cancel transfer');
      expect(confirmRef.componentRef.setInput).toHaveBeenCalledWith('cancelLabel', 'Keep transferring');
      expect(confirmRef.componentRef.setInput).toHaveBeenCalledWith('showLabels', true);
      expect(confirmRef.componentRef.setInput).not.toHaveBeenCalledWith('confirmIcon', 'delete');

      confirmed.next();

      expect(mockTransferContext.cancelTransfer).toHaveBeenCalledWith(deviceId);
      expect(confirmRef.close).toHaveBeenCalled();
    });

    it('does not cancel when the confirmation dialog is dismissed', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'receiving');
      createFixture();

      const confirmed = new Subject<void>();
      const cancelled = new Subject<void>();
      const confirmRef = {
        close: vi.fn(),
        componentInstance: { confirmed, cancelled },
        componentRef: { setInput: vi.fn() },
      };
      mockDialog.open.mockReturnValue(confirmRef);

      component.onCancelRequested();
      cancelled.next();

      expect(mockTransferContext.cancelTransfer).not.toHaveBeenCalled();
      expect(confirmRef.close).toHaveBeenCalled();
    });
  });

  describe('retry handling', () => {
    it('delegates to retryCreate for the resolved device', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'device-busy');
      createFixture();

      component.onRetryRequested();

      expect(mockTransferContext.retryCreate).toHaveBeenCalledWith(deviceId);
    });
  });

  describe('close handling', () => {
    it('closes the transfer before closing the dialog ref', async () => {
      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'completed');
      createFixture();

      let resolveClose: () => void = () => undefined;
      (mockTransferContext.closeTransfer as ReturnType<typeof vi.fn>).mockReturnValue(
        new Promise<void>((resolve) => (resolveClose = resolve))
      );

      const closePromise = component.onCloseRequested();

      expect(mockTransferContext.closeTransfer).toHaveBeenCalledWith(deviceId);
      expect(mockOwnDialogRef.close).not.toHaveBeenCalled();

      resolveClose();
      await closePromise;

      expect(mockOwnDialogRef.close).toHaveBeenCalled();
    });
  });

  describe('focus restoration', () => {
    it('focuses the dropzone picker button once the dialog closes', async () => {
      const wrapper = document.createElement('div');
      wrapper.setAttribute('data-testid', 'dropzone-choose-files');
      const button = document.createElement('button');
      wrapper.appendChild(button);
      document.body.appendChild(wrapper);
      const focusSpy = vi.spyOn(button, 'focus');

      await setup();
      transferStore.setTargetDevice({ deviceId });
      driveToState(transferStore, deviceId, 'scanning');
      createFixture();

      expect(focusSpy).not.toHaveBeenCalled();

      afterClosedSubject.next();

      expect(focusSpy).toHaveBeenCalledTimes(1);
    });
  });
});
