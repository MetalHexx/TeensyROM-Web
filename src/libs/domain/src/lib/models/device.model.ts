import { DeviceStorage } from './device-storage.model';
import { DeviceState } from './device-state.enum';

export interface Device {
  deviceId: string;
  comPort: string;
  name: string;
  fwVersion: string;
  isCompatible: boolean;
  isConnected: boolean;
  deviceState: DeviceState;
  isEnabled: boolean;
  ipAddress?: string;
  tcpPort?: number;
  sdStorage: DeviceStorage;
  usbStorage: DeviceStorage;
}
