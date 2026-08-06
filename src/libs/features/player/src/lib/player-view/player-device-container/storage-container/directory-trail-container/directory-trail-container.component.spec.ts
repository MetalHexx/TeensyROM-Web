import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { vi } from 'vitest';
import { signal } from '@angular/core';
import { StorageStore, NavigationHistoryItem } from '@teensyrom-nx/application';
import { StorageType } from '@teensyrom-nx/domain';
import { DirectoryTrailComponent } from '@teensyrom-nx/ui/components';
import { DirectoryTrailContainerComponent } from './directory-trail-container.component';

describe('DirectoryTrailContainerComponent', () => {
  let component: DirectoryTrailContainerComponent;
  let fixture: ComponentFixture<DirectoryTrailContainerComponent>;

  describe('Basic Functionality', () => {
    let mockStorageStore: Partial<InstanceType<typeof StorageStore>>;

    beforeEach(async () => {
      // Create mock storage store with all methods needed
      mockStorageStore = {
        getSelectedDirectoryState: () => signal({
          currentPath: '/games/arcade',
          isLoading: false,
          deviceId: 'test-device',
          storageType: StorageType.Sd,
          directory: null,
          isLoaded: true,
          error: null,
          lastLoadTime: Date.now(),
        }).asReadonly(),
        getSelectedDirectoryForDevice: () => ({
          deviceId: 'test-device',
          storageType: StorageType.Sd,
          path: '/games/arcade',
        }),
        navigationHistory: signal({
          'test-device': {
            history: [
              { path: '/', storageType: StorageType.Sd },
              { path: '/games', storageType: StorageType.Sd },
              { path: '/games/arcade', storageType: StorageType.Sd },
            ] as NavigationHistoryItem[],
            currentIndex: 2,
            maxHistorySize: 50,
          },
        }).asReadonly(),
        navigateUpOneDirectory: vi.fn(),
        refreshDirectory: vi.fn(),
        navigateToDirectory: vi.fn(),
        navigateDirectoryBackward: vi.fn(),
        navigateDirectoryForward: vi.fn(),
      };

      await TestBed.configureTestingModule({
        imports: [DirectoryTrailContainerComponent, DirectoryTrailComponent],
        providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
      }).compileComponents();

      fixture = TestBed.createComponent(DirectoryTrailContainerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('deviceId', 'test-device');
      fixture.detectChanges();
    });

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should get selected directory state from store', () => {
      const state = component.selectedDirectoryState();

      expect(state).toEqual({
        currentPath: '/games/arcade',
        isLoading: false,
        deviceId: 'test-device',
        storageType: StorageType.Sd,
        directory: null,
        isLoaded: true,
        error: null,
        lastLoadTime: expect.any(Number),
      });
    });

    it('should compute current path from state', () => {
      expect(component.currentPath()).toBe('/games/arcade');
    });

    it('should compute storage type label for SD card', () => {
      expect(component.storageTypeLabel()).toBe('SD Card');
    });

    it('should compute canNavigateUp based on current path', () => {
      expect(component.canNavigateUp()).toBe(true);
    });

    it('should compute loading state from store', () => {
      expect(component.isLoading()).toBe(false);
    });

    it('should compute canNavigateBack based on navigation history', () => {
      expect(component.canNavigateBack()).toBe(true); // currentIndex = 2, can go back
    });

    it('should compute canNavigateForward based on navigation history', () => {
      expect(component.canNavigateForward()).toBe(false); // currentIndex = 2, at end of history
    });

    it('should call store navigateUpOneDirectory on up click', () => {
      component.onUpClick();

      expect(mockStorageStore.navigateUpOneDirectory).toHaveBeenCalledWith({
        deviceId: 'test-device',
        storageType: StorageType.Sd,
      });
    });

    it('should call store refreshDirectory on refresh click', () => {
      component.onRefreshClick();

      expect(mockStorageStore.refreshDirectory).toHaveBeenCalledWith({
        deviceId: 'test-device',
        storageType: StorageType.Sd,
      });
    });

    it('should call store navigateToDirectory on navigation request', () => {
      component.onNavigationRequested('/games');

      expect(mockStorageStore.navigateToDirectory).toHaveBeenCalledWith({
        deviceId: 'test-device',
        storageType: StorageType.Sd,
        path: '/games',
      });
    });

    it('should call store navigateDirectoryBackward on back click when can navigate back', () => {
      component.onBackClick();

      expect(mockStorageStore.navigateDirectoryBackward).toHaveBeenCalledWith({
        deviceId: 'test-device',
      });
    });
  });

  describe('Forward Navigation', () => {
    let mockStorageStore: Partial<InstanceType<typeof StorageStore>>;

    beforeEach(async () => {
      // Create mock storage store with forward navigation enabled
      mockStorageStore = {
        getSelectedDirectoryState: () => signal({
          currentPath: '/games',
          isLoading: false,
          deviceId: 'test-device',
          storageType: StorageType.Sd,
          directory: null,
          isLoaded: true,
          error: null,
          lastLoadTime: Date.now(),
        }).asReadonly(),
        getSelectedDirectoryForDevice: () => ({
          deviceId: 'test-device',
          storageType: StorageType.Sd,
          path: '/games',
        }),
        navigationHistory: signal({
          'test-device': {
            history: [
              { path: '/', storageType: StorageType.Sd },
              { path: '/games', storageType: StorageType.Sd },
              { path: '/games/arcade', storageType: StorageType.Sd },
            ] as NavigationHistoryItem[],
            currentIndex: 1, // Can go forward to /games/arcade
            maxHistorySize: 50,
          },
        }).asReadonly(),
        navigateUpOneDirectory: vi.fn(),
        refreshDirectory: vi.fn(),
        navigateToDirectory: vi.fn(),
        navigateDirectoryBackward: vi.fn(),
        navigateDirectoryForward: vi.fn(),
      };

      await TestBed.configureTestingModule({
        imports: [DirectoryTrailContainerComponent, DirectoryTrailComponent],
        providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
      }).compileComponents();

      fixture = TestBed.createComponent(DirectoryTrailContainerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('deviceId', 'test-device');
      fixture.detectChanges();
    });

    it('should call store navigateDirectoryForward on forward click when can navigate forward', () => {
      component.onForwardClick();

      expect(mockStorageStore.navigateDirectoryForward).toHaveBeenCalledWith({
        deviceId: 'test-device',
      });
    });

    it('should compute canNavigateForward correctly when in middle of history', () => {
      expect(component.canNavigateForward()).toBe(true);
    });
  });

  describe('Null State Handling', () => {
    let mockStorageStore: Partial<InstanceType<typeof StorageStore>>;

    beforeEach(async () => {
      mockStorageStore = {
        getSelectedDirectoryState: () => signal(null).asReadonly(),
        getSelectedDirectoryForDevice: () => null,
        navigationHistory: signal({}).asReadonly(),
        navigateUpOneDirectory: vi.fn(),
        refreshDirectory: vi.fn(),
        navigateToDirectory: vi.fn(),
        navigateDirectoryBackward: vi.fn(),
        navigateDirectoryForward: vi.fn(),
      };

      await TestBed.configureTestingModule({
        imports: [DirectoryTrailContainerComponent, DirectoryTrailComponent],
        providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
      }).compileComponents();

      fixture = TestBed.createComponent(DirectoryTrailContainerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('deviceId', 'test-device');
      fixture.detectChanges();
    });

    it('should default to root path when state is null', () => {
      expect(component.currentPath()).toBe('/');
    });

    it('should default storage type label when no selection', () => {
      expect(component.storageTypeLabel()).toBe('Storage');
    });

    it('should handle loading state when no directory state', () => {
      expect(component.isLoading()).toBe(false);
    });

    it('should not call store when no selected directory on up click', () => {
      component.onUpClick();

      expect(mockStorageStore.navigateUpOneDirectory).not.toHaveBeenCalled();
    });

    it('should not call store when no selected directory on refresh click', () => {
      component.onRefreshClick();

      expect(mockStorageStore.refreshDirectory).not.toHaveBeenCalled();
    });

    it('should not call store when no selected directory on navigation request', () => {
      component.onNavigationRequested('/games');

      expect(mockStorageStore.navigateToDirectory).not.toHaveBeenCalled();
    });

    it('should return false for canNavigateBack when no navigation history', () => {
      expect(component.canNavigateBack()).toBe(false);
    });

    it('should return false for canNavigateForward when no navigation history', () => {
      expect(component.canNavigateForward()).toBe(false);
    });

    it('should not call store navigateDirectoryBackward when cannot navigate back', () => {
      component.onBackClick();

      expect(mockStorageStore.navigateDirectoryBackward).not.toHaveBeenCalled();
    });

    it('should not call store navigateDirectoryForward when cannot navigate forward', () => {
      component.onForwardClick();

      expect(mockStorageStore.navigateDirectoryForward).not.toHaveBeenCalled();
    });
  });

  describe('USB Storage Type', () => {
    let mockStorageStore: Partial<InstanceType<typeof StorageStore>>;

    beforeEach(async () => {
      mockStorageStore = {
        getSelectedDirectoryState: () => signal({
          currentPath: '/files',
          isLoading: false,
          deviceId: 'test-device',
          storageType: StorageType.Usb,
          directory: null,
          isLoaded: true,
          error: null,
          lastLoadTime: Date.now(),
        }).asReadonly(),
        getSelectedDirectoryForDevice: () => ({
          deviceId: 'test-device',
          storageType: StorageType.Usb,
          path: '/files',
        }),
        navigationHistory: signal({
          'test-device': {
            history: [{ path: '/files', storageType: StorageType.Usb }] as NavigationHistoryItem[],
            currentIndex: 0,
            maxHistorySize: 50,
          },
        }).asReadonly(),
        navigateUpOneDirectory: vi.fn(),
        refreshDirectory: vi.fn(),
        navigateToDirectory: vi.fn(),
        navigateDirectoryBackward: vi.fn(),
        navigateDirectoryForward: vi.fn(),
      };

      await TestBed.configureTestingModule({
        imports: [DirectoryTrailContainerComponent, DirectoryTrailComponent],
        providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
      }).compileComponents();

      fixture = TestBed.createComponent(DirectoryTrailContainerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('deviceId', 'test-device');
      fixture.detectChanges();
    });

    it('should compute storage type label for USB', () => {
      expect(component.storageTypeLabel()).toBe('USB Drive');
    });
  });

  describe('Root Path Navigation', () => {
    let mockStorageStore: Partial<InstanceType<typeof StorageStore>>;

    beforeEach(async () => {
      mockStorageStore = {
        getSelectedDirectoryState: () => signal({
          currentPath: '/',
          isLoading: false,
          deviceId: 'test-device',
          storageType: StorageType.Sd,
          directory: null,
          isLoaded: true,
          error: null,
          lastLoadTime: Date.now(),
        }).asReadonly(),
        getSelectedDirectoryForDevice: () => ({
          deviceId: 'test-device',
          storageType: StorageType.Sd,
          path: '/',
        }),
        navigationHistory: signal({
          'test-device': {
            history: [{ path: '/', storageType: StorageType.Sd }] as NavigationHistoryItem[],
            currentIndex: 0,
            maxHistorySize: 50,
          },
        }).asReadonly(),
        navigateUpOneDirectory: vi.fn(),
        refreshDirectory: vi.fn(),
        navigateToDirectory: vi.fn(),
        navigateDirectoryBackward: vi.fn(),
        navigateDirectoryForward: vi.fn(),
      };

      await TestBed.configureTestingModule({
        imports: [DirectoryTrailContainerComponent, DirectoryTrailComponent],
        providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
      }).compileComponents();

      fixture = TestBed.createComponent(DirectoryTrailContainerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('deviceId', 'test-device');
      fixture.detectChanges();
    });

    it('should allow navigate up from root path to device level', () => {
      expect(component.canNavigateUp()).toBe(true);
    });

    it('should call navigateUpOneDirectory when up clicked from root', () => {
      component.onUpClick();

      expect(mockStorageStore.navigateUpOneDirectory).toHaveBeenCalledWith({
        deviceId: 'test-device',
        storageType: StorageType.Sd,
      });
    });
  });

  describe('Device Level Navigation', () => {
    let mockStorageStore: Partial<InstanceType<typeof StorageStore>>;

    beforeEach(async () => {
      // Mock device level view (no storage type selected)
      mockStorageStore = {
        getSelectedDirectoryState: () => signal(null).asReadonly(),
        getSelectedDirectoryForDevice: () => null,
        navigationHistory: signal({
          'test-device': { history: [] as NavigationHistoryItem[], currentIndex: -1, maxHistorySize: 50 },
        }).asReadonly(),
        navigateUpOneDirectory: vi.fn(),
        refreshDirectory: vi.fn(),
        navigateToDirectory: vi.fn(),
        navigateDirectoryBackward: vi.fn(),
        navigateDirectoryForward: vi.fn(),
      };

      await TestBed.configureTestingModule({
        imports: [DirectoryTrailContainerComponent, DirectoryTrailComponent],
        providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
      }).compileComponents();

      fixture = TestBed.createComponent(DirectoryTrailContainerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('deviceId', 'test-device');
      fixture.detectChanges();
    });

    it('should not allow navigate up from device level', () => {
      expect(component.canNavigateUp()).toBe(false);
    });

    it('should detect device level view correctly', () => {
      expect(component.isDeviceLevelView()).toBe(true);
    });

    it('should not call navigateUpOneDirectory when up clicked from device level', () => {
      component.onUpClick();

      expect(mockStorageStore.navigateUpOneDirectory).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    let mockStorageStore: Partial<InstanceType<typeof StorageStore>>;

    beforeEach(async () => {
      mockStorageStore = {
        getSelectedDirectoryState: () => signal({
          currentPath: '/games',
          isLoading: true,
          deviceId: 'test-device',
          storageType: StorageType.Sd,
          directory: null,
          isLoaded: false,
          error: null,
          lastLoadTime: null,
        }).asReadonly(),
        getSelectedDirectoryForDevice: () => ({
          deviceId: 'test-device',
          storageType: StorageType.Sd,
          path: '/games',
        }),
        navigationHistory: signal({
          'test-device': {
            history: [{ path: '/games', storageType: StorageType.Sd }] as NavigationHistoryItem[],
            currentIndex: 0,
            maxHistorySize: 50,
          },
        }).asReadonly(),
        navigateUpOneDirectory: vi.fn(),
        refreshDirectory: vi.fn(),
        navigateToDirectory: vi.fn(),
        navigateDirectoryBackward: vi.fn(),
        navigateDirectoryForward: vi.fn(),
      };

      await TestBed.configureTestingModule({
        imports: [DirectoryTrailContainerComponent, DirectoryTrailComponent],
        providers: [provideNoopAnimations(), { provide: StorageStore, useValue: mockStorageStore }],
      }).compileComponents();

      fixture = TestBed.createComponent(DirectoryTrailContainerComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('deviceId', 'test-device');
      fixture.detectChanges();
    });

    it('should reflect loading state in computed properties', () => {
      expect(component.isLoading()).toBe(true);
    });

    it('should pass loading state to the trail component', () => {
      const trailComponent = fixture.debugElement.query(
        (el) => el.componentInstance instanceof DirectoryTrailComponent
      )?.componentInstance;

      expect(trailComponent?.isLoading()).toBe(true);
    });
  });
});
