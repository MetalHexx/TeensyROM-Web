import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  DeviceStore,
  StorageStore,
  TransferStore,
  TRANSFER_CONTEXT,
  ITransferContext,
  SelectedDirectory,
} from '@teensyrom-nx/application';
import { Device, DeviceState, StorageType } from '@teensyrom-nx/domain';
import { DropzoneCardComponent } from './dropzone-card.component';

function createDevice(overrides: Partial<Device> = {}): Device {
  const deviceId = overrides.deviceId ?? 'device-1';
  return {
    deviceId,
    comPort: 'COM3',
    name: 'Test Device',
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

describe('DropzoneCardComponent', () => {
  let fixture: ComponentFixture<DropzoneCardComponent>;
  let transferStore: InstanceType<typeof TransferStore>;
  let transferContext: ITransferContext;
  let getSelectedDirectoryForDevice: ReturnType<typeof vi.fn>;

  const setup = async (devices: Device[], selectedDirectory: SelectedDirectory | null) => {
    const devicesSignal = signal(devices);
    getSelectedDirectoryForDevice = vi.fn().mockReturnValue(selectedDirectory);

    transferContext = {
      startTransfer: vi.fn().mockResolvedValue(undefined),
      retryCreate: vi.fn().mockResolvedValue(undefined),
      cancelTransfer: vi.fn().mockResolvedValue(undefined),
      closeTransfer: vi.fn().mockResolvedValue(undefined),
      refreshDeviceBusyState: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [DropzoneCardComponent],
      providers: [
        provideNoopAnimations(),
        TransferStore,
        { provide: DeviceStore, useValue: { devices: devicesSignal } },
        { provide: StorageStore, useValue: { getSelectedDirectoryForDevice } },
        { provide: TRANSFER_CONTEXT, useValue: transferContext },
      ],
    }).compileComponents();

    transferStore = TestBed.inject(TransferStore);
    fixture = TestBed.createComponent(DropzoneCardComponent);
    fixture.detectChanges();
  };

  const dropzoneEl = (): HTMLElement =>
    (fixture.nativeElement as HTMLElement).querySelector('[data-testid="dropzone-card"]') as HTMLElement;

  const makeDataTransferEvent = (type: string, items: unknown[] = [{}]): DragEvent => {
    const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(event, 'dataTransfer', {
      value: { items },
      configurable: true,
    });
    return event;
  };

  it('should create', async () => {
    await setup([], null);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('at rest', () => {
    it('names the destination from the storage cursor', async () => {
      const device = createDevice();
      await setup([device], { deviceId: device.deviceId, storageType: StorageType.Sd, path: '/games' });
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      expect(fixture.componentInstance.destinationLabel()).toBe('SD · /games');
      expect(dropzoneEl().classList.contains('state-idle')).toBe(true);
    });

    it('calls the busy-state refresh for the target device', async () => {
      const device = createDevice();
      await setup([device], null);
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      expect(transferContext.refreshDeviceBusyState).toHaveBeenCalledWith(device.deviceId);
    });
  });

  describe('drag-over treatment', () => {
    it('applies the drag-over state class on dragenter and clears it on the matching dragleave', async () => {
      const device = createDevice();
      await setup([device], { deviceId: device.deviceId, storageType: StorageType.Sd, path: '/games' });
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      const el = dropzoneEl();
      el.dispatchEvent(makeDataTransferEvent('dragenter'));
      fixture.detectChanges();
      expect(el.classList.contains('state-drag-over')).toBe(true);

      el.dispatchEvent(makeDataTransferEvent('dragleave'));
      fixture.detectChanges();
      expect(el.classList.contains('state-drag-over')).toBe(false);
      expect(el.classList.contains('state-idle')).toBe(true);
    });

    it('mutates no store state on dragenter or dragleave', async () => {
      const device = createDevice();
      await setup([device], { deviceId: device.deviceId, storageType: StorageType.Sd, path: '/games' });
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      const stateBefore = { ...transferStore.transfers() };
      const el = dropzoneEl();
      el.dispatchEvent(makeDataTransferEvent('dragenter'));
      fixture.detectChanges();
      el.dispatchEvent(makeDataTransferEvent('dragleave'));
      fixture.detectChanges();

      expect(transferStore.transfers()).toEqual(stateBefore);
    });

    it('uses a nested-enter counter so a dragleave over a child does not clear it early', async () => {
      const device = createDevice();
      await setup([device], { deviceId: device.deviceId, storageType: StorageType.Sd, path: '/games' });
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      const el = dropzoneEl();
      el.dispatchEvent(makeDataTransferEvent('dragenter')); // enters the card
      el.dispatchEvent(makeDataTransferEvent('dragenter')); // enters a child element
      el.dispatchEvent(makeDataTransferEvent('dragleave')); // leaves the child, back over the card
      fixture.detectChanges();

      expect(el.classList.contains('state-drag-over')).toBe(true);
    });
  });

  describe('device busy', () => {
    it('renders the refusal before any drag and disables the picker', async () => {
      const device = createDevice();
      await setup([device], null);
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      transferStore.setActiveForeignJob({ deviceId: device.deviceId, activeForeignJobId: 'foreign-job' });
      fixture.detectChanges();

      const native = fixture.nativeElement as HTMLElement;
      expect(dropzoneEl().classList.contains('state-device-busy')).toBe(true);
      const chooseFilesButton = native.querySelector<HTMLButtonElement>(
        '[data-testid="dropzone-choose-files"] button'
      );
      expect(chooseFilesButton?.disabled).toBe(true);
    });

    it('ignores a drop', async () => {
      const device = createDevice();
      await setup([device], null);
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      transferStore.setActiveForeignJob({ deviceId: device.deviceId, activeForeignJobId: 'foreign-job' });
      fixture.detectChanges();

      dropzoneEl().dispatchEvent(makeDataTransferEvent('drop'));
      fixture.detectChanges();

      expect(transferContext.startTransfer).not.toHaveBeenCalled();
    });
  });

  describe('starting a transfer', () => {
    it('a drop hands off to ITransferContext.startTransfer with the dropped items', async () => {
      const device = createDevice();
      await setup([device], { deviceId: device.deviceId, storageType: StorageType.Sd, path: '/games' });
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      const items = [{ webkitGetAsEntry: () => null }];
      dropzoneEl().dispatchEvent(makeDataTransferEvent('drop', items));
      fixture.detectChanges();

      expect(transferContext.startTransfer).toHaveBeenCalledWith(device.deviceId, items);
    });

    it('the file picker path produces the same context call as a drop', async () => {
      const device = createDevice();
      await setup([device], { deviceId: device.deviceId, storageType: StorageType.Sd, path: '/games' });
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      const native = fixture.nativeElement as HTMLElement;
      const fileInput = native.querySelector<HTMLInputElement>('input[type="file"]:not([webkitdirectory])');
      expect(fileInput).toBeTruthy();

      const file = new File(['content'], 'game.prg');
      const fileList = { 0: file, length: 1, item: () => file } as unknown as FileList;
      Object.defineProperty(fileInput as HTMLInputElement, 'files', { value: fileList });
      fileInput?.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(transferContext.startTransfer).toHaveBeenCalledWith(device.deviceId, fileList);
    });

    it('the folder picker path produces the same context call as a drop', async () => {
      const device = createDevice();
      await setup([device], { deviceId: device.deviceId, storageType: StorageType.Sd, path: '/games' });
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      const native = fixture.nativeElement as HTMLElement;
      const folderInput = native.querySelector<HTMLInputElement>('input[webkitdirectory]');
      expect(folderInput).toBeTruthy();

      const file = new File(['content'], 'game.prg');
      const fileList = { 0: file, length: 1, item: () => file } as unknown as FileList;
      Object.defineProperty(folderInput as HTMLInputElement, 'files', { value: fileList });
      folderInput?.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(transferContext.startTransfer).toHaveBeenCalledWith(device.deviceId, fileList);
    });
  });

  describe('drop outside the card', () => {
    it('is a no-op', async () => {
      const device = createDevice();
      await setup([device], { deviceId: device.deviceId, storageType: StorageType.Sd, path: '/games' });
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      (fixture.nativeElement as HTMLElement).dispatchEvent(makeDataTransferEvent('drop'));
      fixture.detectChanges();

      expect(transferContext.startTransfer).not.toHaveBeenCalled();
    });
  });

  describe('focus anchor', () => {
    it('renders the focus-return anchor as a focusable button element', async () => {
      const device = createDevice();
      await setup([device], { deviceId: device.deviceId, storageType: StorageType.Sd, path: '/games' });
      transferStore.setTargetDevice({ deviceId: device.deviceId });
      fixture.detectChanges();

      const native = fixture.nativeElement as HTMLElement;
      const focusAnchor = native.querySelector<HTMLButtonElement>(
        '[data-testid="dropzone-choose-files"] button'
      );

      expect(focusAnchor).toBeTruthy();
      expect(focusAnchor?.tagName).toBe('BUTTON');
    });
  });
});
