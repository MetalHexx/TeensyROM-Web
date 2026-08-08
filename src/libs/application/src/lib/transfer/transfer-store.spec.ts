import { TestBed } from '@angular/core/testing';
import { TransferStore } from './transfer-store';

describe('TransferStore', () => {
  let store: InstanceType<typeof TransferStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TransferStore],
    });
    store = TestBed.inject(TransferStore);
  });

  it('should have initial state with null targetDeviceId and empty transfers', () => {
    expect(store.targetDeviceId()).toBeNull();
    expect(store.transfers()).toEqual({});
  });

  it('should set target device', () => {
    const deviceId = 'device-123';
    store.setTargetDevice({ deviceId });
    expect(store.targetDeviceId()).toBe(deviceId);
    expect(store.transfers()).toEqual({});
  });

  it('should replace target device when setting a new one', () => {
    store.setTargetDevice({ deviceId: 'device-1' });
    expect(store.targetDeviceId()).toBe('device-1');

    store.setTargetDevice({ deviceId: 'device-2' });
    expect(store.targetDeviceId()).toBe('device-2');
  });

  it('should clear target device', () => {
    store.setTargetDevice({ deviceId: 'device-123' });
    expect(store.targetDeviceId()).toBe('device-123');

    store.clearTargetDevice();
    expect(store.targetDeviceId()).toBeNull();
  });

  it('should keep transfers empty throughout mutations', () => {
    store.setTargetDevice({ deviceId: 'device-1' });
    expect(store.transfers()).toEqual({});

    store.setTargetDevice({ deviceId: 'device-2' });
    expect(store.transfers()).toEqual({});

    store.clearTargetDevice();
    expect(store.transfers()).toEqual({});
  });

  it('should track targetDeviceId changes as a signal', () => {
    const targetDeviceSignal = store.getTargetDeviceId();

    expect(targetDeviceSignal()).toBeNull();

    store.setTargetDevice({ deviceId: 'device-1' });
    expect(targetDeviceSignal()).toBe('device-1');

    store.setTargetDevice({ deviceId: 'device-2' });
    expect(targetDeviceSignal()).toBe('device-2');

    store.clearTargetDevice();
    expect(targetDeviceSignal()).toBeNull();
  });
});
