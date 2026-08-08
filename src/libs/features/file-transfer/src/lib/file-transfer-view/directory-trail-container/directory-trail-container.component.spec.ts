import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { StorageStore, NavigationHistory } from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';
import { DirectoryTrailContainerComponent } from './directory-trail-container.component';

interface MockStorageStore {
  getSelectedDirectoryState: ReturnType<typeof vi.fn>;
  getSelectedDirectoryForDevice: ReturnType<typeof vi.fn>;
  navigationHistory: ReturnType<typeof vi.fn>;
  navigateToDirectory: ReturnType<typeof vi.fn>;
  navigateDirectoryBackward: ReturnType<typeof vi.fn>;
  navigateDirectoryForward: ReturnType<typeof vi.fn>;
  navigateUpOneDirectory: ReturnType<typeof vi.fn>;
  refreshDirectory: ReturnType<typeof vi.fn>;
}

function seedHistory(paths: string[], currentIndex: number): NavigationHistory {
  const history = new NavigationHistory();
  history.history = paths.map((path) => ({ path, storageType: StorageType.Sd }));
  history.currentIndex = currentIndex;
  return history;
}

describe('DirectoryTrailContainerComponent', () => {
  let fixture: ComponentFixture<DirectoryTrailContainerComponent>;
  let component: DirectoryTrailContainerComponent;
  let mockStorageStore: MockStorageStore;

  const setup = async (deviceId = 'device-1') => {
    await TestBed.configureTestingModule({
      imports: [DirectoryTrailContainerComponent],
      providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(DirectoryTrailContainerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('deviceId', deviceId);
    fixture.detectChanges();
  };

  beforeEach(() => {
    mockStorageStore = {
      getSelectedDirectoryState: vi.fn(() =>
        signal({
          currentPath: '/games/arcade',
          isLoading: false,
          deviceId: 'device-1',
          storageType: StorageType.Sd,
          directory: null,
          isLoaded: true,
          error: null,
          lastLoadTime: Date.now(),
        }).asReadonly()
      ),
      getSelectedDirectoryForDevice: vi.fn(() => ({
        deviceId: 'device-1',
        storageType: StorageType.Sd,
        path: '/games/arcade',
      })),
      navigationHistory: vi.fn(
        () =>
          ({
            'device-1': seedHistory(['/', '/games', '/games/arcade'], 1),
          } as Record<string, NavigationHistory>)
      ),
      navigateToDirectory: vi.fn(),
      navigateDirectoryBackward: vi.fn(),
      navigateDirectoryForward: vi.fn(),
      navigateUpOneDirectory: vi.fn(),
      refreshDirectory: vi.fn(),
    };
  });

  it('creates', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  describe('derived navigation state', () => {
    it('allows both back and forward from the middle of a seeded history', async () => {
      await setup();
      expect(component.canNavigateBack()).toBe(true);
      expect(component.canNavigateForward()).toBe(true);
    });

    it('disallows back at the start of history', async () => {
      mockStorageStore.navigationHistory = vi.fn(() => ({
        'device-1': seedHistory(['/', '/games'], 0),
      }));
      await setup();
      expect(component.canNavigateBack()).toBe(false);
    });

    it('disallows forward at the end of history', async () => {
      mockStorageStore.navigationHistory = vi.fn(() => ({
        'device-1': seedHistory(['/', '/games'], 1),
      }));
      await setup();
      expect(component.canNavigateForward()).toBe(false);
    });

    it('disallows both when there is no history entry for the device', async () => {
      mockStorageStore.navigationHistory = vi.fn(() => ({}));
      await setup();
      expect(component.canNavigateBack()).toBe(false);
      expect(component.canNavigateForward()).toBe(false);
    });
  });

  describe('control wiring', () => {
    it('calls navigateDirectoryBackward on back click', async () => {
      await setup();
      component.onBackClick();
      expect(mockStorageStore.navigateDirectoryBackward).toHaveBeenCalledWith({
        deviceId: 'device-1',
      });
    });

    it('calls navigateDirectoryForward on forward click', async () => {
      await setup();
      component.onForwardClick();
      expect(mockStorageStore.navigateDirectoryForward).toHaveBeenCalledWith({
        deviceId: 'device-1',
      });
    });

    it('calls navigateUpOneDirectory on up click', async () => {
      await setup();
      component.onUpClick();
      expect(mockStorageStore.navigateUpOneDirectory).toHaveBeenCalledWith({
        deviceId: 'device-1',
        storageType: StorageType.Sd,
      });
    });

    it('calls refreshDirectory on refresh click', async () => {
      await setup();
      component.onRefreshClick();
      expect(mockStorageStore.refreshDirectory).toHaveBeenCalledWith({
        deviceId: 'device-1',
        storageType: StorageType.Sd,
      });
    });

    it('calls navigateToDirectory with the requested path on breadcrumb activation', async () => {
      await setup();
      component.onNavigationRequested('/games');
      expect(mockStorageStore.navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'device-1',
        storageType: StorageType.Sd,
        path: '/games',
      });
    });

    it('does not call back/forward when navigation is not possible', async () => {
      mockStorageStore.navigationHistory = vi.fn(() => ({
        'device-1': seedHistory(['/'], 0),
      }));
      await setup();
      component.onBackClick();
      component.onForwardClick();
      expect(mockStorageStore.navigateDirectoryBackward).not.toHaveBeenCalled();
      expect(mockStorageStore.navigateDirectoryForward).not.toHaveBeenCalled();
    });

    it('does not call navigateUpOneDirectory or refresh at device level', async () => {
      mockStorageStore.getSelectedDirectoryForDevice = vi.fn(() => null);
      await setup();
      component.onUpClick();
      component.onRefreshClick();
      expect(mockStorageStore.navigateUpOneDirectory).not.toHaveBeenCalled();
      expect(mockStorageStore.refreshDirectory).not.toHaveBeenCalled();
    });
  });
});
