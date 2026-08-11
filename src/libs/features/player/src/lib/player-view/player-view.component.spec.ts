import { describe, it, expect } from 'vitest';
import { signal } from '@angular/core';
import { renderPlayerComponent } from '../../testing/render-player-component';
import { DeviceStore } from '@teensyrom-nx/application';
import { PlayerViewComponent } from './player-view.component';

function render(devices: unknown[] = []) {
  const deviceStore = { devices: signal(devices) };

  return {
    ...renderPlayerComponent(PlayerViewComponent, {
      providers: [{ provide: DeviceStore, useValue: deviceStore }],
    }),
    deviceStore,
  };
}

describe('PlayerViewComponent', () => {
  it('creates', () => {
    const { component } = render();

    expect(component).toBeTruthy();
  });

  it('has the device store injected', () => {
    const { component } = render();

    expect(component.deviceStore).toBeTruthy();
  });

  it('computes enabled devices from the store', () => {
    const { component } = render();

    expect(component.enabledDevices).toBeTruthy();
    expect(component.enabledDevices()).toEqual([]);
  });
});
