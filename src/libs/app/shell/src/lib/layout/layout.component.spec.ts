import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { LayoutComponent } from './layout.component';
import {
  DEVICE_SERVICE,
  DEVICE_STORAGE_SERVICE,
  VERSION_SERVICE,
  ALERT_SERVICE,
  STORAGE_SERVICE,
  PLAYER_SERVICE,
  IDeviceService,
  IStorageService,
  IVersionService,
  IAlertService,
  Device,
  StorageDirectory,
  AppVersion,
  PlayerStatus,
  LaunchMode,
  StorageType,
  TransferJobSnapshot,
  TransferJobState,
} from '@teensyrom-nx/domain';
import {
  PLAYER_CONTEXT,
  IPlayerContext,
  TransferStore,
  PlayerStore,
  PLAYER_STORAGE,
} from '@teensyrom-nx/application';
import { of } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { Component, signal } from '@angular/core';
import { NAV_ITEMS } from '@teensyrom-nx/app/navigation';
import { By } from '@angular/platform-browser';
import { MatDialog } from '@angular/material/dialog';
import { TransferModalComponent } from '@teensyrom-nx/features/file-transfer';
import '../../test-setup';

const createSnapshot = (overrides: Partial<TransferJobSnapshot> = {}): TransferJobSnapshot => ({
  jobId: 'job-1',
  deviceId: 'device-1',
  storageType: StorageType.Sd,
  destinationDirectory: '/music/',
  state: TransferJobState.Receiving,
  filesReceived: 0,
  filesSent: 0,
  filesFailed: 0,
  totalFiles: null,
  currentFile: null,
  startedUtc: new Date('2026-01-01T00:00:00Z'),
  error: null,
  failures: [],
  ...overrides,
});

@Component({ standalone: true, template: '<p>Test</p>' })
class TestComponent {}

describe('LayoutComponent', () => {
  let component: LayoutComponent;
  let fixture: ComponentFixture<LayoutComponent>;
  let router: Router;
  let mockDialog: { open: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockDialog = { open: vi.fn().mockReturnValue({ close: vi.fn() }) };

    const mockDeviceService: Partial<IDeviceService> = {
      findDevices: () => of([]),
      getConnectedDevices: () => of([]),
      connectDevice: () => of({} as Device),
      disconnectDevice: () => of(undefined),
      resetDevice: () => of(undefined),
      pingDevice: () => of(undefined),
    };

    const mockStorageService: Partial<IStorageService> = {
      getDirectory: () => of({} as StorageDirectory),
      index: () => of({}),
      indexAll: () => of({}),
    };

    const mockVersionService: Partial<IVersionService> = {
      getVersion: () => of({ version: '1.0.0-test' } as AppVersion),
    };

    const mockAlertService: Partial<IAlertService> = {
      alerts$: of([]),
      show: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      dismiss: vi.fn(),
    };

    const mockSignal = <T>(value: T) => signal(value).asReadonly();
    const mockPlayerContext: Partial<IPlayerContext> = {
      initializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      startListeningToPopState: vi.fn(),
      stopListeningToPopState: vi.fn(),
      launchFileWithContext: vi.fn().mockResolvedValue(undefined),
      launchRandomFile: vi.fn().mockResolvedValue(undefined),
      updateCurrentFileFavoriteStatus: vi.fn(),
      getCurrentFile: vi.fn().mockReturnValue(mockSignal(null)),
      getFileContext: vi.fn().mockReturnValue(mockSignal(null)),
      getPlayerStatus: vi.fn().mockReturnValue(mockSignal(PlayerStatus.Stopped)),
      getStatus: vi.fn().mockReturnValue(mockSignal(PlayerStatus.Stopped)),
      isLoading: vi.fn().mockReturnValue(mockSignal(false)),
      isSlowLoading: vi.fn().mockReturnValue(mockSignal(false)),
      getError: vi.fn().mockReturnValue(mockSignal(null)),
      toggleShuffleMode: vi.fn(),
      setShuffleScope: vi.fn(),
      setFilterMode: vi.fn(),
      getLaunchMode: vi.fn().mockReturnValue(mockSignal(LaunchMode.Directory)),
      getShuffleSettings: vi.fn().mockReturnValue(mockSignal(null)),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),
      getTimerState: vi.fn().mockReturnValue(mockSignal(null)),
      getPlayTimerConfig: vi.fn().mockReturnValue(mockSignal(null)),
      setCustomTimer: vi.fn(),
      isCurrentFileCompatible: vi.fn().mockReturnValue(mockSignal(true)),
      getPlayHistory: vi.fn().mockReturnValue(mockSignal(null)),
      getCurrentHistoryPosition: vi.fn().mockReturnValue(mockSignal(0)),
      canNavigateBackwardInHistory: vi.fn().mockReturnValue(mockSignal(false)),
      canNavigateForwardInHistory: vi.fn().mockReturnValue(mockSignal(false)),
      clearHistory: vi.fn(),
      toggleHistoryView: vi.fn(),
      isHistoryViewVisible: vi.fn().mockReturnValue(mockSignal(false)),
      navigateToHistoryPosition: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      imports: [LayoutComponent],
      providers: [
        provideNoopAnimations(),
        provideRouter([
          { path: 'player', component: TestComponent },
          { path: 'player/:subpath', component: TestComponent },
          { path: 'devices', component: TestComponent },
          { path: 'settings', component: TestComponent },
        ]),
        { provide: DEVICE_SERVICE, useValue: mockDeviceService },
        { provide: DEVICE_STORAGE_SERVICE, useValue: mockStorageService },
        { provide: STORAGE_SERVICE, useValue: mockStorageService },
        { provide: VERSION_SERVICE, useValue: mockVersionService },
        { provide: ALERT_SERVICE, useValue: mockAlertService },
        { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
        { provide: MatDialog, useValue: mockDialog },
        // PlayerStore's action factories inject these eagerly at construction. TransferPlaybackGuard
        // forces that construction (it injects PlayerStore), so they must be satisfied here too.
        { provide: PLAYER_SERVICE, useValue: {} },
        { provide: PLAYER_STORAGE, useValue: { save: vi.fn(), load: vi.fn(), hasSavedState: vi.fn(), clear: vi.fn() } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(LayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('nav rail integration', () => {
    it('should render nav rail component', () => {
      const navRail = fixture.debugElement.query(By.css('lib-nav-rail'));
      expect(navRail).toBeTruthy();
    });

    it('should pass menu items to nav rail', () => {
      expect(component.menuItems).toBe(NAV_ITEMS);
      expect(component.menuItems.length).toBeGreaterThan(0);
    });

    it('should have active route initialized from current router url', () => {
      // Initial route is empty or root
      expect(component.activeRoute()).toBeDefined();
    });

    it('should update active route after navigation', async () => {
      await router.navigate(['player']);
      fixture.detectChanges();

      expect(component.activeRoute()).toBe('player');
    });

    it('should navigate when onNavItemClick is called', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');

      component.onNavItemClick({ name: 'Devices', icon: 'devices', route: 'devices' });

      expect(navigateSpy).toHaveBeenCalledWith(['devices']);
    });

    it('should extract first path segment for nested routes', async () => {
      // Navigate to a nested path
      await router.navigate(['player', 'browse']);
      fixture.detectChanges();

      // Should only get 'player' from '/player/browse'
      expect(component.activeRoute()).toBe('player');
    });
  });

  describe('transfer modal effect', () => {
    let transferStore: InstanceType<typeof TransferStore>;
    const deviceId = 'device-1';

    beforeEach(() => {
      transferStore = TestBed.inject(TransferStore);
    });

    const transferModalCalls = () =>
      mockDialog.open.mock.calls.filter(([componentType]) => componentType === TransferModalComponent);

    it('opens the transfer modal, disabling close, once store state says a transfer is live', () => {
      transferStore.setTargetDevice({ deviceId });
      transferStore.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      fixture.detectChanges();

      const calls = transferModalCalls();
      expect(calls.length).toBe(1);
      const [, config] = calls[0];
      expect(config.disableClose).toBe(true);
      expect(config.restoreFocus).toBe(true);
      expect(config.panelClass).toBe('glassy-dialog');
      expect(config.backdropClass).toBe('busy-dialog-backdrop');
      expect(config.ariaLabel).toContain('Transferring files to');
      // Material's default 80vw dialog cap would otherwise silently defeat the terminal shape's
      // content-driven width; `width` itself stays unset so that width wins.
      expect(config.maxWidth).toBe('95vw');
      expect(config.width).toBeUndefined();
    });

    it('does not reopen the dialog while the transfer is still live', () => {
      transferStore.setTargetDevice({ deviceId });
      transferStore.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      fixture.detectChanges();
      transferStore.completeScan({ deviceId, scanTotal: 3 });
      fixture.detectChanges();

      expect(transferModalCalls().length).toBe(1);
    });

    it('closes the dialog once the store clears the transfer', () => {
      const dialogRef = { close: vi.fn() };
      mockDialog.open.mockReturnValue(dialogRef);

      transferStore.setTargetDevice({ deviceId });
      transferStore.beginScan({ deviceId, droppedRootName: 'Games', destinationLabel: '/games' });
      fixture.detectChanges();

      transferStore.clearTransfer({ deviceId });
      fixture.detectChanges();

      expect(dialogRef.close).toHaveBeenCalled();
    });
  });

  describe('transfer playback guard', () => {
    it('is constructed at startup, reacting to a live transfer without being injected anywhere else', () => {
      const transferStore = TestBed.inject(TransferStore);
      const playerStore = TestBed.inject(PlayerStore);
      const deviceId = 'device-1';

      transferStore.applyJobSnapshot({ deviceId, snapshot: createSnapshot({ deviceId }) });
      fixture.detectChanges();
      TestBed.flushEffects();

      expect(playerStore.players()[deviceId]?.status).toBe(PlayerStatus.Stopped);
    });
  });
});
