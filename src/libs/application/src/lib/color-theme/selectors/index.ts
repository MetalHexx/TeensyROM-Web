import { inject } from '@angular/core';
import { StateSignals, withComputed } from '@ngrx/signals';
import { DeviceStore } from '../../device/device-store';
import { ColorThemeState } from '../color-theme-state.interface';
import { deviceSelectors } from './devices';
import { themeSelectors } from './themes';
import { permissionSelectors } from './permissions';
import { recordStateSelector } from './record-state';

export function withColorThemeSelectors() {
  return withComputed((store) => {
    const state = store as unknown as StateSignals<ColorThemeState>;
    const deviceStore = inject(DeviceStore);
    const devices = deviceSelectors(state, deviceStore.usableDevices);
    const themes = themeSelectors(state);
    const permissions = permissionSelectors(state, devices.targetDevices, themes.selectedTheme);
    const record = recordStateSelector(state, devices.connectedDevices);

    return { devicesDiscovered: deviceStore.hasInitialised, ...devices, ...themes, ...permissions, ...record };
  });
}
