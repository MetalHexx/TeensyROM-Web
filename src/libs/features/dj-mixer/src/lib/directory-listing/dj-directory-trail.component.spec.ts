import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { StorageStore } from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';
import { DjDirectoryTrailComponent } from './dj-directory-trail.component';
import type { ActiveStorage } from '../active-storage';

function createStorageStoreStub(overrides: Record<string, unknown> = {}) {
  return {
    navigationHistory: signal<
      Record<
        string,
        { history: { path: string; storageType: StorageType | null }[]; currentIndex: number }
      >
    >({}),
    getSelectedDirectoryState: vi.fn(() => signal(null)),
    navigateDirectoryBackward: vi.fn().mockResolvedValue(undefined),
    navigateDirectoryForward: vi.fn().mockResolvedValue(undefined),
    navigateUpOneDirectory: vi.fn().mockResolvedValue(undefined),
    refreshDirectory: vi.fn().mockResolvedValue(undefined),
    navigateToDirectory: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function render(activeStorage: ActiveStorage, storageStoreOverrides: Record<string, unknown> = {}) {
  const storageStore = createStorageStoreStub(storageStoreOverrides);

  TestBed.configureTestingModule({
    imports: [DjDirectoryTrailComponent],
    providers: [{ provide: StorageStore, useValue: storageStore }],
  });

  const fixture: ComponentFixture<DjDirectoryTrailComponent> =
    TestBed.createComponent(DjDirectoryTrailComponent);
  fixture.componentRef.setInput('activeStorage', activeStorage);
  fixture.detectChanges();

  return { fixture, component: fixture.componentInstance, storageStore };
}

describe('DjDirectoryTrailComponent', () => {
  const active: ActiveStorage = { deviceId: 'device-a', storageType: StorageType.Sd };

  it('defaults currentPath to root with no selected directory state', () => {
    const { component } = render(active);
    expect(component.currentPath()).toBe('/');
  });

  it('reads currentPath from the selected directory state', () => {
    const { component } = render(active, {
      getSelectedDirectoryState: vi.fn(() => signal({ currentPath: '/games/arcade' })),
    });
    expect(component.currentPath()).toBe('/games/arcade');
  });

  it('labels SD storage as SD Card', () => {
    const { component } = render(active);
    expect(component.storageTypeLabel()).toBe('SD Card');
  });

  it('labels USB storage as USB Drive', () => {
    const { component } = render({ deviceId: 'device-a', storageType: StorageType.Usb });
    expect(component.storageTypeLabel()).toBe('USB Drive');
  });

  it('disallows navigating up at the storage root — the DJ view has no device level', () => {
    const { component } = render(active, {
      getSelectedDirectoryState: vi.fn(() => signal({ currentPath: '/' })),
    });
    expect(component.canNavigateUp()).toBe(false);
  });

  it('allows navigating up once below the storage root', () => {
    const { component } = render(active, {
      getSelectedDirectoryState: vi.fn(() => signal({ currentPath: '/games' })),
    });
    expect(component.canNavigateUp()).toBe(true);
  });

  it('calls navigateUpOneDirectory with the active device and storage type on up click', () => {
    const { component, storageStore } = render(active, {
      getSelectedDirectoryState: vi.fn(() => signal({ currentPath: '/games' })),
    });

    component.onUpClick();

    expect(storageStore.navigateUpOneDirectory).toHaveBeenCalledWith({
      deviceId: 'device-a',
      storageType: StorageType.Sd,
    });
  });

  it('is a no-op on up click at the storage root', () => {
    const { component, storageStore } = render(active);

    component.onUpClick();

    expect(storageStore.navigateUpOneDirectory).not.toHaveBeenCalled();
  });

  it('calls refreshDirectory with the active device and storage type on refresh click', () => {
    const { component, storageStore } = render(active);

    component.onRefreshClick();

    expect(storageStore.refreshDirectory).toHaveBeenCalledWith({
      deviceId: 'device-a',
      storageType: StorageType.Sd,
    });
  });

  it('calls navigateToDirectory with the requested path on a crumb click', () => {
    const { component, storageStore } = render(active);

    component.onNavigationRequested('/games/arcade');

    expect(storageStore.navigateToDirectory).toHaveBeenCalledWith({
      deviceId: 'device-a',
      storageType: StorageType.Sd,
      path: '/games/arcade',
    });
  });

  it('calls navigateDirectoryBackward with the active device id on back click when back navigation is possible', () => {
    const { component, storageStore } = render(active, {
      navigationHistory: signal({
        'device-a': {
          history: [
            { path: '/', storageType: StorageType.Sd },
            { path: '/games', storageType: StorageType.Sd },
          ],
          currentIndex: 1,
        },
      }),
    });

    component.onBackClick();

    expect(storageStore.navigateDirectoryBackward).toHaveBeenCalledWith({ deviceId: 'device-a' });
  });

  it('is a no-op on back click with no navigation history', () => {
    const { component, storageStore } = render(active);

    component.onBackClick();

    expect(storageStore.navigateDirectoryBackward).not.toHaveBeenCalled();
  });

  it('calls navigateDirectoryForward with the active device id on forward click when forward navigation is possible', () => {
    const { component, storageStore } = render(active, {
      navigationHistory: signal({
        'device-a': {
          history: [
            { path: '/', storageType: StorageType.Sd },
            { path: '/games', storageType: StorageType.Sd },
          ],
          currentIndex: 0,
        },
      }),
    });

    component.onForwardClick();

    expect(storageStore.navigateDirectoryForward).toHaveBeenCalledWith({ deviceId: 'device-a' });
  });

  it('is a no-op on forward click at the end of history', () => {
    const { component, storageStore } = render(active, {
      navigationHistory: signal({
        'device-a': { history: [{ path: '/', storageType: StorageType.Sd }], currentIndex: 0 },
      }),
    });

    component.onForwardClick();

    expect(storageStore.navigateDirectoryForward).not.toHaveBeenCalled();
  });
});
