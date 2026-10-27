/** The engine refused a device command because the device is busy with a transfer. */
export class DeviceBusyError extends Error {
  constructor(readonly deviceId: string, readonly activeJobId: string | null, message: string) {
    super(message);
    this.name = 'DeviceBusyError';
  }
}

/** The code the engine's 409 carries for a device busy with a transfer. */
export const DEVICE_BUSY_PROBLEM_CODE = 'deviceBusyWithTransfer';
