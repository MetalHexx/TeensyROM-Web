import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugElement, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PlayerToolbarMiniComponent } from './player-toolbar-mini.component';
import { PLAYER_CONTEXT, IPlayerContext, StorageStore } from '@teensyrom-nx/application';
import { LaunchMode, PlayerStatus, FileItemType } from '@teensyrom-nx/domain';
import { IconButtonComponent } from '@teensyrom-nx/ui/components';

describe('PlayerToolbarMiniComponent', () => {
  let component: PlayerToolbarMiniComponent;
  let fixture: ComponentFixture<PlayerToolbarMiniComponent>;
  let mockPlayerContext: IPlayerContext;
  let mockStorageStore: {
    saveFavorite: ReturnType<typeof vi.fn>;
    removeFavorite: ReturnType<typeof vi.fn>;
    favoriteOperationsState: ReturnType<typeof vi.fn>;
    getSearchState: ReturnType<typeof vi.fn>;
    searchFiles: ReturnType<typeof vi.fn>;
  };
  let errorSignal: ReturnType<typeof signal<string | null>>;
  let currentFileSignal: ReturnType<typeof signal>;
  let playerStatusSignal: ReturnType<typeof signal<PlayerStatus>>;
  let fileContextSignal: ReturnType<typeof signal>;
  let launchModeSignal: ReturnType<typeof signal<LaunchMode>>;
  let fileCompatibleSignal: ReturnType<typeof signal<boolean>>;

  const createFileMock = (type: FileItemType) => ({
    name: 'test-file',
    path: '/test/test-file',
    type,
    size: 1024,
    isFavorite: false,
    title: 'Test File',
    creator: 'Test Creator',
    releaseInfo: '',
    description: '',
    shareUrl: '',
    metadataSource: '',
    meta1: '',
    meta2: '',
    metadataSourcePath: '',
    parentPath: '/test',
    playLength: '',
    subtuneLengths: [],
    startSubtuneNum: 0,
    images: [],
  });

  beforeEach(async () => {
    errorSignal = signal<string | null>(null);
    currentFileSignal = signal(null);
    playerStatusSignal = signal(PlayerStatus.Stopped);
    fileContextSignal = signal(null);
    launchModeSignal = signal(LaunchMode.Directory);
    fileCompatibleSignal = signal(true);

    mockStorageStore = {
      saveFavorite: vi.fn().mockResolvedValue(undefined),
      removeFavorite: vi.fn().mockResolvedValue(undefined),
      favoriteOperationsState: vi.fn(() => ({ isProcessing: false, error: null })),
      getSearchState: vi.fn().mockReturnValue(signal(null).asReadonly()),
      searchFiles: vi.fn().mockResolvedValue(undefined),
    };

    mockPlayerContext = {
      initializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      startListeningToPopState: vi.fn(),
      stopListeningToPopState: vi.fn(),
      launchFileWithContext: vi.fn().mockResolvedValue(undefined),
      launchRandomFile: vi.fn().mockResolvedValue(undefined),
      updateCurrentFileFavoriteStatus: vi.fn(),
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),
      getCurrentFile: vi.fn().mockReturnValue(currentFileSignal.asReadonly()),
      getFileContext: vi.fn().mockReturnValue(fileContextSignal.asReadonly()),
      getPlayerStatus: vi.fn().mockReturnValue(playerStatusSignal.asReadonly()),
      getStatus: vi.fn().mockReturnValue(playerStatusSignal.asReadonly()),
      isLoading: vi.fn().mockReturnValue(signal(false).asReadonly()),
      isSlowLoading: vi.fn().mockReturnValue(signal(false).asReadonly()),
      getError: vi.fn().mockReturnValue(errorSignal.asReadonly()),
      toggleShuffleMode: vi.fn(),
      setShuffleScope: vi.fn(),
      setFilterMode: vi.fn(),
      getLaunchMode: vi.fn().mockReturnValue(launchModeSignal.asReadonly()),
      getShuffleSettings: vi.fn().mockReturnValue(signal(null).asReadonly()),
      getTimerState: vi.fn().mockReturnValue(signal(null).asReadonly()),
      isCurrentFileCompatible: vi.fn().mockReturnValue(fileCompatibleSignal.asReadonly()),
      getPlayTimerConfig: vi.fn().mockReturnValue(signal(null).asReadonly()),
      setCustomTimer: vi.fn(),
      getPlayHistory: vi.fn().mockReturnValue(signal(null).asReadonly()),
      getCurrentHistoryPosition: vi.fn().mockReturnValue(signal(0).asReadonly()),
      canNavigateBackwardInHistory: vi.fn().mockReturnValue(signal(false).asReadonly()),
      canNavigateForwardInHistory: vi.fn().mockReturnValue(signal(false).asReadonly()),
      clearHistory: vi.fn(),
      toggleHistoryView: vi.fn(),
      isHistoryViewVisible: vi.fn().mockReturnValue(signal(false).asReadonly()),
      navigateToHistoryPosition: vi.fn().mockResolvedValue(undefined),
    } satisfies IPlayerContext;

    await TestBed.configureTestingModule({
      imports: [PlayerToolbarMiniComponent],
      providers: [
        provideNoopAnimations(),
        { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
        { provide: StorageStore, useValue: mockStorageStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerToolbarMiniComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('deviceId', 'test-device-id');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Playback Controls', () => {
    const testDeviceId = 'test-device-id';

    describe('playPause()', () => {
      it('should call pause when player is currently playing', async () => {
        playerStatusSignal.set(PlayerStatus.Playing);

        await component.playPause();

        expect(mockPlayerContext.pause).toHaveBeenCalledWith(testDeviceId);
        expect(mockPlayerContext.play).not.toHaveBeenCalled();
      });

      it('should call play when player is stopped', async () => {
        playerStatusSignal.set(PlayerStatus.Stopped);

        await component.playPause();

        expect(mockPlayerContext.play).toHaveBeenCalledWith(testDeviceId);
        expect(mockPlayerContext.pause).not.toHaveBeenCalled();
      });

      it('should not call play or pause when deviceId is empty', async () => {
        fixture.componentRef.setInput('deviceId', '');

        await component.playPause();

        expect(mockPlayerContext.play).not.toHaveBeenCalled();
        expect(mockPlayerContext.pause).not.toHaveBeenCalled();
      });
    });

    describe('stop()', () => {
      it('should call playerContext.stop with correct deviceId', async () => {
        await component.stop();

        expect(mockPlayerContext.stop).toHaveBeenCalledWith(testDeviceId);
      });

      it('should not call stop when deviceId is empty', async () => {
        fixture.componentRef.setInput('deviceId', '');

        await component.stop();

        expect(mockPlayerContext.stop).not.toHaveBeenCalled();
      });
    });

    describe('next()', () => {
      it('should call playerContext.next with correct deviceId', async () => {
        await component.next();

        expect(mockPlayerContext.next).toHaveBeenCalledWith(testDeviceId);
      });
    });

    describe('previous()', () => {
      it('should call playerContext.previous with correct deviceId', async () => {
        await component.previous();

        expect(mockPlayerContext.previous).toHaveBeenCalledWith(testDeviceId);
      });
    });
  });

  describe('UI State Computeds', () => {
    it('should return "play_arrow" icon when stopped', () => {
      playerStatusSignal.set(PlayerStatus.Stopped);
      expect(component.getPlayPauseIconComputed()).toBe('play_arrow');
    });

    it('should return "pause" icon when playing', () => {
      playerStatusSignal.set(PlayerStatus.Playing);
      expect(component.getPlayPauseIconComputed()).toBe('pause');
    });

    it('should return "Play" label when stopped', () => {
      playerStatusSignal.set(PlayerStatus.Stopped);
      expect(component.getPlayPauseLabelComputed()).toBe('Play');
    });

    it('should return "Pause" label when playing', () => {
      playerStatusSignal.set(PlayerStatus.Playing);
      expect(component.getPlayPauseLabelComputed()).toBe('Pause');
    });

    it('should detect music file type', () => {
      currentFileSignal.set({ file: createFileMock(FileItemType.Song) });
      expect(component.isCurrentFileMusicTypeComputed()).toBe(true);
    });

    it('should detect non-music file type', () => {
      currentFileSignal.set({ file: createFileMock(FileItemType.Game) });
      expect(component.isCurrentFileMusicTypeComputed()).toBe(false);
    });

    it('should be loaded when current file exists', () => {
      currentFileSignal.set({ file: createFileMock(FileItemType.Song) });
      expect(component.isPlayerLoadedComputed()).toBe(true);
    });

    it('should not be loaded when current file is null', () => {
      currentFileSignal.set(null);
      expect(component.isPlayerLoadedComputed()).toBe(false);
    });
  });

  describe('Navigation', () => {
    it('should allow navigation when multiple files exist', () => {
      fileContextSignal.set({ files: [{ id: '1' }, { id: '2' }] });
      expect(component.canNavigateComputed()).toBe(true);
    });

    it('should allow navigation in shuffle mode regardless of file count', () => {
      fileContextSignal.set({ files: [{ id: '1' }] });
      launchModeSignal.set(LaunchMode.Shuffle);
      expect(component.canNavigateComputed()).toBe(true);
    });

    it('should not allow navigation with single file in directory mode', () => {
      fileContextSignal.set({ files: [{ id: '1' }] });
      launchModeSignal.set(LaunchMode.Directory);
      expect(component.canNavigateComputed()).toBe(false);
    });
  });

  describe('Disabled State', () => {
    /**
     * Helper to find icon button components by their ariaLabel property.
     */
    function findIconButtonByLabel(labelPattern: string | RegExp): DebugElement | null {
      const iconButtons = fixture.debugElement.queryAll(By.directive(IconButtonComponent));
      for (const buttonDebug of iconButtons) {
        const buttonComponent = buttonDebug.componentInstance as IconButtonComponent;
        const ariaLabel = buttonComponent.ariaLabel();
        if (typeof labelPattern === 'string') {
          if (ariaLabel === labelPattern) return buttonDebug;
        } else {
          if (labelPattern.test(ariaLabel)) return buttonDebug;
        }
      }
      return null;
    }

    it('should have disabled input defaulting to false', () => {
      expect(component.disabled()).toBe(false);
    });

    it('should accept disabled input as true', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(component.disabled()).toBe(true);
    });

    it('should add disabled-state class to host when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(fixture.nativeElement.classList.contains('disabled-state')).toBe(true);
    });

    it('should not add disabled-state class when not disabled', () => {
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();
      expect(fixture.nativeElement.classList.contains('disabled-state')).toBe(false);
    });

    it('should disable all playback buttons when disabled is true', () => {
      fixture.componentRef.setInput('disabled', true);

      // Set up a non-music file to show stop button
      currentFileSignal.set({
        file: createFileMock(FileItemType.Game),
      });
      fixture.detectChanges();

      const previousButton = findIconButtonByLabel('Previous');
      const nextButton = findIconButtonByLabel('Next');
      const stopButton = findIconButtonByLabel('Stop');

      expect(previousButton?.componentInstance.disabled()).toBe(true);
      expect(nextButton?.componentInstance.disabled()).toBe(true);
      expect(stopButton?.componentInstance.disabled()).toBe(true);
    });

    it('should enable buttons when disabled is false and navigation is possible', () => {
      fixture.componentRef.setInput('disabled', false);

      currentFileSignal.set({
        file: createFileMock(FileItemType.Song),
      });
      fileContextSignal.set({
        files: [{ id: '1' }, { id: '2' }],
      });
      fixture.detectChanges();

      const previousButton = findIconButtonByLabel('Previous');
      const nextButton = findIconButtonByLabel('Next');
      const playPauseButton = findIconButtonByLabel(/Play|Pause/);

      expect(previousButton?.componentInstance.disabled()).toBe(false);
      expect(nextButton?.componentInstance.disabled()).toBe(false);
      expect(playPauseButton?.componentInstance.disabled()).toBe(false);
    });
  });
});
