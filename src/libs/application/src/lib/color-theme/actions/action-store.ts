import { Signal } from '@angular/core';
import { StateSignals, WritableStateSource } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ColorTheme, Device, DeviceColorRecord, IColorThemeService } from '@teensyrom-nx/domain';
import { ColorThemeState } from '../color-theme-state.interface';

/** The color-theme store as the actions see it: writable state plus the selectors they read. */
export type ColorThemeActionStore = StateSignals<ColorThemeState> &
  WritableStateSource<ColorThemeState> & {
    connectedDevices: Signal<Device[]>;
    devicesDiscovered: Signal<boolean>;
    targetDevices: Signal<Device[]>;
    selectedTheme: Signal<ColorTheme | null>;
    unchangedThemeId: Signal<string | null>;
  };

/** Reads a device's record; a failed read counts as no record. */
export function fetchRecord(
  service: IColorThemeService,
  deviceId: string
): Promise<DeviceColorRecord | null> {
  return firstValueFrom(service.getDeviceColors(deviceId)).catch(() => null);
}

/** Resolves once device discovery has finished, so the connected devices are known. */
export async function waitForDeviceDiscovery(store: ColorThemeActionStore): Promise<void> {
  while (!store.devicesDiscovered()) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** How a device is named in labels, confirmations and alerts. */
export function deviceLabel(device: Device): string {
  return device.name || device.deviceId;
}
