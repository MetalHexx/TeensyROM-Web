import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { signal } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { PlayerToolbarComponent } from './player-toolbar.component';
import { PLAYER_CONTEXT, IPlayerContext, StorageStore, SettingsStore, AudioStore } from '@teensyrom-nx/application';
import { LaunchMode, PlayerStatus, FileItemType, StorageType } from '@teensyrom-nx/domain';
import { IconButtonComponent } from '@teensyrom-nx/ui/components';

describe('PlayerToolbarComponent', () => {
  let component: PlayerToolbarComponent;
  let fixture: ComponentFixture<PlayerToolbarComponent>;
  let mockPlayerContext: IPlayerContext;
  let mockStorageStore: {
    saveFavorite: ReturnType<typeof vi.fn>;
    removeFavorite: ReturnType<typeof vi.fn>;
    favoriteOperationsState: ReturnType<typeof vi.fn>;
  };
  let mockSettingsStore: {
    enableAudioStreamForDevice: ReturnType<typeof vi.fn>;
  };
  let mockAudioStore: {
    isMuted: ReturnType<typeof signal<boolean>>;
    masterVolume: ReturnType<typeof signal<number>>;
    toggleMute: ReturnType<typeof vi.fn>;
    setMasterVolume: ReturnType<typeof vi.fn>;
  };
  let audioStreamEnabledSignal: ReturnType<typeof signal<boolean>>;
  let errorSignal: ReturnType<typeof signal<string | null>>;
  let currentFileSignal: ReturnType<typeof signal>;
  let playerStatusSignal: ReturnType<typeof signal<PlayerStatus>>;
  let fileContextSignal: ReturnType<typeof signal>;
  let launchModeSignal: ReturnType<typeof signal<LaunchMode>>;
  let fileCompatibleSignal: ReturnType<typeof signal<boolean>>;

  // Helper to create file mock
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
    // Create writable signals for testing
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
    };

    audioStreamEnabledSignal = signal(false);

    mockSettingsStore = {
      enableAudioStreamForDevice: vi.fn().mockReturnValue(audioStreamEnabledSignal.asReadonly()),
    };

    mockAudioStore = {
      isMuted: signal(false),
      masterVolume: signal(0.75),
      toggleMute: vi.fn(),
      setMasterVolume: vi.fn(),
    };

    // Create a proper interface-based mock that implements all IPlayerContext methods
    mockPlayerContext = {
      // Core player lifecycle
      initializePlayer: vi.fn(),
      removePlayer: vi.fn(),
      startListeningToPopState: vi.fn(),
      stopListeningToPopState: vi.fn(),

      // File launching
      launchFileWithContext: vi.fn().mockResolvedValue(undefined),
      launchRandomFile: vi.fn().mockResolvedValue(undefined),
      updateCurrentFileFavoriteStatus: vi.fn(),

      // Phase 3: Playback control methods (tested in this component)
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      next: vi.fn().mockResolvedValue(undefined),
      previous: vi.fn().mockResolvedValue(undefined),

      // State queries
      getCurrentFile: vi.fn().mockReturnValue(currentFileSignal.asReadonly()),
      getFileContext: vi.fn().mockReturnValue(fileContextSignal.asReadonly()),
      getPlayerStatus: vi.fn().mockReturnValue(playerStatusSignal.asReadonly()),
      getStatus: vi.fn().mockReturnValue(playerStatusSignal.asReadonly()),
      isLoading: vi.fn().mockReturnValue(signal(false).asReadonly()),
      isSlowLoading: vi.fn().mockReturnValue(signal(false).asReadonly()),
      getError: vi.fn().mockReturnValue(errorSignal.asReadonly()),

      // Shuffle functionality
      toggleShuffleMode: vi.fn(),
      setShuffleScope: vi.fn(),
      setFilterMode: vi.fn(),
      getLaunchMode: vi.fn().mockReturnValue(launchModeSignal.asReadonly()),
      getShuffleSettings: vi.fn().mockReturnValue(signal(null).asReadonly()),

      // Phase 5: Timer state (for progress bar)
      getTimerState: vi.fn().mockReturnValue(signal(null).asReadonly()),

      // File compatibility
      isCurrentFileCompatible: vi.fn().mockReturnValue(fileCompatibleSignal.asReadonly()),

      // Custom timer (Phase 3 UI)
      getPlayTimerConfig: vi.fn().mockReturnValue(signal(null).asReadonly()),
      setCustomTimer: vi.fn(),

      // Play history
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
      imports: [PlayerToolbarComponent],
      providers: [
        provideNoopAnimations(),
        { provide: PLAYER_CONTEXT, useValue: mockPlayerContext },
        { provide: StorageStore, useValue: mockStorageStore },
        { provide: SettingsStore, useValue: mockSettingsStore },
        { provide: AudioStore, useValue: mockAudioStore },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayerToolbarComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('deviceId', 'test-device-id');
    fixture.detectChanges();
  });

  /**
   * Helper to find icon button components by their ariaLabel property.
   * Uses Angular's DebugElement API to query through component boundaries.
   */
  function findIconButtonByLabel(labelPattern: string | RegExp): DebugElement | null {
    const iconButtons = fixture.debugElement.queryAll(By.directive(IconButtonComponent));

    // Debug: log how many buttons we found
    if (iconButtons.length === 0) {
      console.log('No IconButtonComponent instances found in DOM');
      console.log('Full HTML:', fixture.nativeElement.innerHTML);
    }

    for (const buttonDebug of iconButtons) {
      const buttonComponent = buttonDebug.componentInstance as IconButtonComponent;
      const ariaLabel = buttonComponent.ariaLabel();

      if (typeof labelPattern === 'string') {
        if (ariaLabel === labelPattern) {
          return buttonDebug;
        }
      } else {
        if (labelPattern.test(ariaLabel)) {
          return buttonDebug;
        }
      }
    }

    return null;
  }

  /**
   * Helper to get the native button element from an icon button component.
   */
  function getNativeButton(iconButtonDebug: DebugElement): HTMLButtonElement | null {
    return iconButtonDebug.nativeElement.querySelector('button');
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Phase 3: Playback Control Integration', () => {
    const testDeviceId = 'test-device-id';

    describe('playPause() method', () => {
      it('should call pause when player is currently playing', async () => {
        playerStatusSignal.set(PlayerStatus.Playing);

        await component.playPause();

        expect(mockPlayerContext.pause).toHaveBeenCalledWith(testDeviceId);
        expect(mockPlayerContext.play).not.toHaveBeenCalled();
      });

      it('should call play when player is currently stopped', async () => {
        playerStatusSignal.set(PlayerStatus.Stopped);

        await component.playPause();

        expect(mockPlayerContext.play).toHaveBeenCalledWith(testDeviceId);
        expect(mockPlayerContext.pause).not.toHaveBeenCalled();
      });

      it('should call play when player is currently paused', async () => {
        playerStatusSignal.set(PlayerStatus.Paused);

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

    describe('stop() method', () => {
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

    describe('next() method', () => {
      it('should call playerContext.next with correct deviceId', async () => {
        await component.next();

        expect(mockPlayerContext.next).toHaveBeenCalledWith(testDeviceId);
      });

      it('should not call next when deviceId is empty', async () => {
        fixture.componentRef.setInput('deviceId', '');

        await component.next();

        expect(mockPlayerContext.next).not.toHaveBeenCalled();
      });
    });

    describe('previous() method', () => {
      it('should call playerContext.previous with correct deviceId', async () => {
        await component.previous();

        expect(mockPlayerContext.previous).toHaveBeenCalledWith(testDeviceId);
      });

      it('should not call previous when deviceId is empty', async () => {
        fixture.componentRef.setInput('deviceId', '');

        await component.previous();

        expect(mockPlayerContext.previous).not.toHaveBeenCalled();
      });
    });
  });

  describe('UI Helper Methods', () => {
    describe('getPlayPauseIcon()', () => {
      it('should return "play_arrow" when status is Stopped', () => {
        playerStatusSignal.set(PlayerStatus.Stopped);

        expect(component.getPlayPauseIconComputed()).toBe('play_arrow');
      });

      it('should return "play_arrow" when status is Paused', () => {
        playerStatusSignal.set(PlayerStatus.Paused);

        expect(component.getPlayPauseIconComputed()).toBe('play_arrow');
      });

      it('should return "pause" when status is Playing', () => {
        playerStatusSignal.set(PlayerStatus.Playing);

        expect(component.getPlayPauseIconComputed()).toBe('pause');
      });

      it('should return "play_arrow" when deviceId is empty', () => {
        fixture.componentRef.setInput('deviceId', '');

        expect(component.getPlayPauseIconComputed()).toBe('play_arrow');
      });
    });

    describe('getPlayPauseLabel()', () => {
      it('should return "Play" when status is Stopped', () => {
        playerStatusSignal.set(PlayerStatus.Stopped);

        expect(component.getPlayPauseLabelComputed()).toBe('Play');
      });

      it('should return "Play" when status is Paused', () => {
        playerStatusSignal.set(PlayerStatus.Paused);

        expect(component.getPlayPauseLabelComputed()).toBe('Play');
      });

      it('should return "Pause" when status is Playing', () => {
        playerStatusSignal.set(PlayerStatus.Playing);

        expect(component.getPlayPauseLabelComputed()).toBe('Pause');
      });

      it('should return "Play" when deviceId is empty', () => {
        fixture.componentRef.setInput('deviceId', '');

        expect(component.getPlayPauseLabelComputed()).toBe('Play');
      });
    });

    describe('isCurrentFileMusicType()', () => {
      it('should return true when current file is a Song', () => {
        const musicFile = createFileMock(FileItemType.Song);
        currentFileSignal.set({
          deviceId: 'test-device-id',
          storageType: 0,
          file: musicFile,
          isShuffleMode: false,
        });

        expect(component.isCurrentFileMusicTypeComputed()).toBe(true);
      });

      it('should return false when current file is a Game', () => {
        const gameFile = createFileMock(FileItemType.Game);
        currentFileSignal.set({
          deviceId: 'test-device-id',
          storageType: 0,
          file: gameFile,
          isShuffleMode: false,
        });

        expect(component.isCurrentFileMusicTypeComputed()).toBe(false);
      });

      it('should return false when current file is an Image', () => {
        const imageFile = createFileMock(FileItemType.Image);
        currentFileSignal.set({
          deviceId: 'test-device-id',
          storageType: 0,
          file: imageFile,
          isShuffleMode: false,
        });

        expect(component.isCurrentFileMusicTypeComputed()).toBe(false);
      });

      it('should return false when no current file', () => {
        currentFileSignal.set(null);

        expect(component.isCurrentFileMusicTypeComputed()).toBe(false);
      });

      it('should return false when deviceId is empty', () => {
        fixture.componentRef.setInput('deviceId', '');

        expect(component.isCurrentFileMusicTypeComputed()).toBe(false);
      });
    });

    describe('canNavigate()', () => {
      it('should return true when file context has multiple files', () => {
        const files = [createFileMock(FileItemType.Song), createFileMock(FileItemType.Song)];
        fileContextSignal.set({
          directoryPath: '/test',
          files,
          currentIndex: 0,
        });

        expect(component.canNavigateComputed()).toBe(true);
      });

      it('should return false when file context has only one file', () => {
        const files = [createFileMock(FileItemType.Song)];
        fileContextSignal.set({
          directoryPath: '/test',
          files,
          currentIndex: 0,
        });

        expect(component.canNavigateComputed()).toBe(false);
      });

      it('should return true when in shuffle mode regardless of file context', () => {
        launchModeSignal.set(LaunchMode.Shuffle);
        fileContextSignal.set(null);

        expect(component.canNavigateComputed()).toBe(true);
      });

      it('should return false when no file context and not in shuffle mode', () => {
        launchModeSignal.set(LaunchMode.Directory);
        fileContextSignal.set(null);

        expect(component.canNavigateComputed()).toBe(false);
      });

      it('should return false when deviceId is empty', () => {
        fixture.componentRef.setInput('deviceId', '');

        expect(component.canNavigateComputed()).toBe(false);
      });
    });

    describe('canNavigatePrevious()', () => {
      it('should use same logic as canNavigate()', () => {
        const files = [createFileMock(FileItemType.Song), createFileMock(FileItemType.Song)];
        fileContextSignal.set({
          directoryPath: '/test',
          files,
          currentIndex: 0,
        });

        expect(component.canNavigatePreviousComputed()).toBe(component.canNavigateComputed());
        expect(component.canNavigatePreviousComputed()).toBe(true);
      });
    });

    describe('getPlayerStatus()', () => {
      it('should return current player status from context', () => {
        playerStatusSignal.set(PlayerStatus.Playing);

        expect(component.getPlayerStatus()).toBe(PlayerStatus.Playing);
      });

      it('should return Stopped when deviceId is empty', () => {
        fixture.componentRef.setInput('deviceId', '');

        expect(component.getPlayerStatus()).toBe(PlayerStatus.Stopped);
      });
    });
  });

  describe('Template Integration', () => {
    beforeEach(() => {
      // Set up a mock file context for button state tests
      const musicFile = createFileMock(FileItemType.Song);
      currentFileSignal.set({
        deviceId: 'test-device-id',
        storageType: 0,
        file: musicFile,
        isShuffleMode: false,
      });
    });

    it('should show play/pause button for music files', () => {
      fixture.detectChanges();

      const playPauseButton = findIconButtonByLabel(/Play|Pause/);
      expect(playPauseButton).toBeTruthy();
      expect(playPauseButton?.componentInstance.icon()).toMatch(/play_arrow|pause/);
    });

    it('should show stop button for non-music files', () => {
      const gameFile = createFileMock(FileItemType.Game);
      currentFileSignal.set({
        deviceId: 'test-device-id',
        storageType: 0,
        file: gameFile,
        isShuffleMode: false,
      });

      fixture.detectChanges();

      const stopButton = findIconButtonByLabel('Stop Playback');
      expect(stopButton).toBeTruthy();
      expect(stopButton?.componentInstance.icon()).toBe('stop');
    });

    it('should disable navigation buttons when canNavigate returns false', () => {
      fileContextSignal.set(null);
      launchModeSignal.set(LaunchMode.Directory);

      fixture.detectChanges();

      const nextButton = findIconButtonByLabel(/launch the next/);
      const previousButton = findIconButtonByLabel(/launch the previous/);

      expect(nextButton).toBeTruthy();
      expect(previousButton).toBeTruthy();
      expect(nextButton?.componentInstance.disabled()).toBe(true);
      expect(previousButton?.componentInstance.disabled()).toBe(true);
    });

    it('should enable navigation buttons when canNavigate returns true', () => {
      const files = [createFileMock(FileItemType.Song), createFileMock(FileItemType.Song)];
      fileContextSignal.set({
        storageKey: 'test-key',
        directoryPath: '/test',
        files,
        currentIndex: 0,
        launchMode: LaunchMode.Directory,
      });

      fixture.detectChanges();

      const nextButton = findIconButtonByLabel(/launch the next/);
      const previousButton = findIconButtonByLabel(/launch the previous/);

      expect(nextButton).toBeTruthy();
      expect(previousButton).toBeTruthy();
      expect(nextButton?.componentInstance.disabled()).toBe(false);
      expect(previousButton?.componentInstance.disabled()).toBe(false);
    });

    // Note: Buttons are not currently disabled during loading state
    // They maintain their normal enabled/disabled state based on canNavigate() etc.
    // If loading state should disable buttons, add [disabled]="isLoading()" to template
  });

  describe('Button Click Integration', () => {
    it('should trigger playPause when play/pause button is clicked', async () => {
      const spy = vi.spyOn(component, 'playPause');

      // Set up music file to show play/pause button
      const musicFile = createFileMock(FileItemType.Song);
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: musicFile,
        isShuffleMode: false,
      });

      fixture.detectChanges();

      const playPauseButton = findIconButtonByLabel(/Play|Pause/);
      expect(playPauseButton).toBeTruthy();

      if (playPauseButton) {
        const nativeButton = getNativeButton(playPauseButton);
        nativeButton?.click();
      }

      expect(spy).toHaveBeenCalled();
    });

    it('should trigger next when next button is clicked', async () => {
      const spy = vi.spyOn(component, 'next');

      // Need to have a file loaded for toolbar to be visible
      const musicFile = createFileMock(FileItemType.Song);
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: musicFile,
        isShuffleMode: false,
      });

      // Enable navigation
      const files = [createFileMock(FileItemType.Song), createFileMock(FileItemType.Song)];
      fileContextSignal.set({
        storageKey: 'test-key',
        directoryPath: '/test',
        files,
        currentIndex: 0,
        launchMode: LaunchMode.Directory,
      });

      fixture.detectChanges();

      const nextButton = findIconButtonByLabel(/launch the next/);
      expect(nextButton).toBeTruthy();

      if (nextButton) {
        const nativeButton = getNativeButton(nextButton);
        nativeButton?.click();
      }

      expect(spy).toHaveBeenCalled();
    });

    it('should trigger previous when previous button is clicked', async () => {
      const spy = vi.spyOn(component, 'previous');

      // Need to have a file loaded for toolbar to be visible
      const musicFile = createFileMock(FileItemType.Song);
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: musicFile,
        isShuffleMode: false,
      });
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: musicFile,
        isShuffleMode: false,
      });

      // Enable navigation
      const files = [createFileMock(FileItemType.Song), createFileMock(FileItemType.Song)];
      fileContextSignal.set({
        storageKey: 'test-key',
        directoryPath: '/test',
        files,
        currentIndex: 0,
        launchMode: LaunchMode.Directory,
      });

      fixture.detectChanges();

      const previousButton = findIconButtonByLabel(/launch the previous/);
      expect(previousButton).toBeTruthy();

      if (previousButton) {
        const nativeButton = getNativeButton(previousButton);
        nativeButton?.click();
      }

      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Phase 4: Error State Visual Feedback', () => {
    it('should show error color on play button when file is incompatible', () => {
      // Set file as incompatible
      fileCompatibleSignal.set(false);

      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: createFileMock(FileItemType.Song),
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.getPlayButtonColorComputed()).toBe('error');
    });

    it('should show normal color on play button when file is compatible', () => {
      // File is compatible (already set up in beforeEach)
      currentFileSignal.set({
        deviceId: 1,
        storageType: StorageType.Sd,
        file: createFileMock(FileItemType.Song),
        isShuffleMode: false,
      });
      fixture.detectChanges();

      expect(component.getPlayButtonColorComputed()).toBe('normal');
    });

    it('should show normal color when no file is loaded', () => {
      currentFileSignal.set(null);
      fixture.detectChanges();

      expect(component.getPlayButtonColorComputed()).toBe('normal');
    });

    it('should show normal color when disabled even if file is incompatible', () => {
      fileCompatibleSignal.set(false);
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      expect(component.getPlayButtonColorComputed()).toBe('normal');
    });

    it('should detect errors with hasError computed property', () => {
      errorSignal.set('Test error');
      fixture.detectChanges();

      expect(component.hasError()).toBe(true);
    });

    it('should show no error when error is null', () => {
      errorSignal.set(null);
      fixture.detectChanges();

      expect(component.hasError()).toBe(false);
    });
  });

  describe('Disabled State', () => {
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

      // Set up a music file to ensure play/pause is shown
      const musicFile = createFileMock(FileItemType.Song);
      currentFileSignal.set({
        deviceId: 'test-device-id',
        storageType: StorageType.Sd,
        file: musicFile,
        isShuffleMode: false,
      });
      fixture.detectChanges();

      const previousButton = findIconButtonByLabel(/launch the previous/);
      const nextButton = findIconButtonByLabel(/launch the next/);
      const playPauseButton = findIconButtonByLabel(/Play|Pause/);

      expect(previousButton?.componentInstance.disabled()).toBe(true);
      expect(nextButton?.componentInstance.disabled()).toBe(true);
      expect(playPauseButton?.componentInstance.disabled()).toBe(true);
    });

    it('should enable buttons when disabled is false and navigation is possible', () => {
      fixture.componentRef.setInput('disabled', false);

      const musicFile = createFileMock(FileItemType.Song);
      currentFileSignal.set({
        deviceId: 'test-device-id',
        storageType: StorageType.Sd,
        file: musicFile,
        isShuffleMode: false,
      });
      fileContextSignal.set({
        storageKey: 'test-key',
        directoryPath: '/test',
        files: [createFileMock(FileItemType.Song), createFileMock(FileItemType.Song)],
        currentIndex: 0,
        launchMode: LaunchMode.Directory,
      });
      fixture.detectChanges();

      const previousButton = findIconButtonByLabel(/launch the previous/);
      const nextButton = findIconButtonByLabel(/launch the next/);
      const playPauseButton = findIconButtonByLabel(/Play|Pause/);

      expect(previousButton?.componentInstance.disabled()).toBe(false);
      expect(nextButton?.componentInstance.disabled()).toBe(false);
      expect(playPauseButton?.componentInstance.disabled()).toBe(false);
    });
  });

  describe('Volume Control Integration', () => {
    it('should render volume control when enableAudioStreamForDevice returns true', () => {
      audioStreamEnabledSignal.set(true);
      fixture.detectChanges();

      const volumeControls = fixture.nativeElement.querySelectorAll('lib-volume-control');
      expect(volumeControls.length).toBeGreaterThan(0);
    });

    it('should NOT render volume control when enableAudioStreamForDevice returns false', () => {
      audioStreamEnabledSignal.set(false);
      fixture.detectChanges();

      const volumeControls = fixture.nativeElement.querySelectorAll('lib-volume-control');
      expect(volumeControls.length).toBe(0);
    });

    it('should pass disabled input to volume control matching toolbar disabled state', () => {
      audioStreamEnabledSignal.set(true);
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();

      const volumeControl = fixture.debugElement.query(
        By.css('lib-volume-control')
      );
      expect(volumeControl).toBeTruthy();
      expect(volumeControl.componentInstance.disabled()).toBe(true);
    });

    it('should not pass disabled when toolbar is enabled', () => {
      audioStreamEnabledSignal.set(true);
      fixture.componentRef.setInput('disabled', false);
      fixture.detectChanges();

      const volumeControl = fixture.debugElement.query(
        By.css('lib-volume-control')
      );
      expect(volumeControl).toBeTruthy();
      expect(volumeControl.componentInstance.disabled()).toBe(false);
    });

    it('should call enableAudioStreamForDevice with the correct deviceId', () => {
      fixture.detectChanges();
      expect(mockSettingsStore.enableAudioStreamForDevice).toHaveBeenCalledWith('test-device-id');
    });

    it('should reactively show/hide volume control when audio stream setting changes', () => {
      audioStreamEnabledSignal.set(false);
      fixture.detectChanges();

      let volumeControls = fixture.nativeElement.querySelectorAll('lib-volume-control');
      expect(volumeControls.length).toBe(0);

      audioStreamEnabledSignal.set(true);
      fixture.detectChanges();

      volumeControls = fixture.nativeElement.querySelectorAll('lib-volume-control');
      expect(volumeControls.length).toBeGreaterThan(0);
    });

    it('should wrap volume control in volume-control-section container', () => {
      audioStreamEnabledSignal.set(true);
      fixture.detectChanges();

      const sections = fixture.nativeElement.querySelectorAll('.volume-control-section');
      expect(sections.length).toBeGreaterThan(0);

      const firstSection = sections[0];
      expect(firstSection.querySelector('lib-volume-control')).toBeTruthy();
    });
  });
});
