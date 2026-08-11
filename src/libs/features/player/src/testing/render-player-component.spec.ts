import { signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ISettingsService, SETTINGS_SERVICE, STORAGE_SERVICE, StorageType } from '@teensyrom-nx/domain';
import { createMockStorageService, createTestFileItem } from '@teensyrom-nx/testing/fixtures';
import { PlayerDeviceContainerComponent } from '../lib/player-view/player-device-container/player-device-container.component';
import { StorageContainerComponent } from '../lib/player-view/player-device-container/storage-container/storage-container.component';
import { renderPlayerComponent } from './render-player-component';

/**
 * Worked example for the player feature specs: render through the harness, then assert on the
 * component's own state rather than reaching into a child's DOM.
 */
describe('renderPlayerComponent', () => {
  const mockSettingsService: Partial<ISettingsService> = {
    getSettings: vi.fn().mockReturnValue(of(null)),
    saveSettings: vi.fn().mockReturnValue(of(undefined)),
  };

  const providers = [
    { provide: SETTINGS_SERVICE, useValue: mockSettingsService },
    { provide: STORAGE_SERVICE, useValue: createMockStorageService() },
  ];

  const device = {
    deviceId: 'test-device',
    name: 'Test Device',
    isConnected: true,
    isEnabled: true,
  };

  it('renders the component under test', () => {
    const { component } = renderPlayerComponent(PlayerDeviceContainerComponent, { providers });

    expect(component).toBeInstanceOf(PlayerDeviceContainerComponent);
  });

  it('applies inputs before the first change-detection pass', () => {
    const { component } = renderPlayerComponent(PlayerDeviceContainerComponent, {
      providers,
      inputs: { device },
    });

    expect(component.deviceId()).toBe('test-device');
  });

  it('applies inputs assigned after render', () => {
    const { component, setInput } = renderPlayerComponent(PlayerDeviceContainerComponent, {
      providers,
    });
    expect(component.deviceId()).toBe('');

    setInput('device', device);

    expect(component.deviceId()).toBe('test-device');
  });

  it('exposes overridden player context state through the component', () => {
    const file = createTestFileItem({ name: 'overridden.sid' });
    const launchedFile = {
      storageKey: { deviceId: 'test-device', storageType: StorageType.Sd },
      file,
      parentPath: '/music',
      launchedAt: 0,
      isCompatible: true,
    };

    const { component } = renderPlayerComponent(PlayerDeviceContainerComponent, {
      providers,
      inputs: { device },
      playerContext: {
        getCurrentFile: vi.fn().mockReturnValue(signal(launchedFile).asReadonly()),
      },
    });

    expect(component.currentFile()?.file.name).toBe('overridden.sid');
    expect(component.isPlayerLoaded()).toBe(true);
  });

  it('does not instantiate descendant components when children are stubbed', () => {
    const { fixture } = renderPlayerComponent(PlayerDeviceContainerComponent, {
      providers,
      inputs: { device },
    });

    expect(fixture.debugElement.query(By.directive(StorageContainerComponent))).toBeNull();
  });

  it('instantiates only the named realChildren, leaving the rest stubbed', () => {
    const { fixture } = renderPlayerComponent(PlayerDeviceContainerComponent, {
      providers,
      inputs: { device },
      realChildren: [StorageContainerComponent],
    });

    expect(fixture.debugElement.query(By.directive(StorageContainerComponent))).not.toBeNull();
  });
});
