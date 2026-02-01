import { Injectable, inject, Signal, Injector, signal } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { Location } from '@angular/common';
import {
  LaunchMode,
  PlayerFilterType,
  PlayerScope,
  FileItemType,
  FileItem,
  StorageType,
  StorageTypeUtil,
  ALERT_SERVICE,
  IAlertService,
} from '@teensyrom-nx/domain';
import { PlayerStore, LaunchedFile, HistoryEntry } from './player-store';
import { StorageStore } from '../storage/storage-store';
import { SettingsStore } from '../settings/settings-store';
import { StorageKeyUtil } from '../storage/storage-key.util';
import { IPlayerContext, LaunchFileContextRequest } from './player-context.interface';
import { PLAYER_STORAGE } from './player-storage.interface';
import { PlayerTimerManager } from './player-timer-manager';
import { TimerState } from './timer-state.interface';
import { parsePlayLength } from './timer-utils';
import { DEFAULT_TIMER_MS } from './player.constants';
import { logInfo, logWarn, LogType } from '@teensyrom-nx/utils';
import { Subscription, of, timer } from 'rxjs';
import { map, distinctUntilChanged, switchMap, mapTo } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class PlayerContextService implements IPlayerContext {
  /**
   * Delay in milliseconds before showing busy dialog for slow file launches.
   * Prevents dialog flashing for fast operations while providing feedback for large games/programs.
   */
  private readonly LAUNCH_DELAY_MS = 2000;

  private readonly store = inject(PlayerStore);
  private readonly storageStore = inject(StorageStore);
  private readonly settingsStore = inject(SettingsStore);
  private readonly timerManager = inject(PlayerTimerManager);
  private readonly location = inject(Location);
  private readonly alertService: IAlertService = inject(ALERT_SERVICE);
  private readonly playerStorage = inject(PLAYER_STORAGE);
  private readonly injector = inject(Injector);

  // Constant null signal to return when no timer exists (avoids NG0602 in reactive contexts)
  private readonly nullTimerSignal: Signal<TimerState | null> = signal<TimerState | null>(null).asReadonly();
  
  // Cache signals per device for reuse (eager creation in createTimerWithCompletion)
  private readonly timerSignals = new Map<string, Signal<TimerState | null>>();
  // Cached global signal for slow loading state across all devices
  private slowLoadingSignal: Signal<boolean> | null = null;
  // Track only completion subscriptions for auto-progression
  private readonly completionSubscriptions = new Map<string, Subscription>();
  private popstateListener: ((event: PopStateEvent) => void) | null = null;
  private isHandlingPopState = false;

  initializePlayer(deviceId: string): void {
    // Get default filter and timer settings from settings before initializing player
    const settings = this.settingsStore.settings();
    const defaultFilter = settings?.playerSettings?.startupFilter ?? PlayerFilterType.All;
    const playTimerEnabled = settings?.playerSettings?.playTimerEnabled ?? false;

    // Initialize player (action handles localStorage loading internally)
    this.store.initializePlayer({ deviceId, defaultFilter, playTimerEnabled });
  }

  removePlayer(deviceId: string): void {
    // Phase 5: Cleanup timer before removing player
    this.cleanupTimer(deviceId);

    this.store.removePlayer({ deviceId });
  }

  /**
   * Guard method to prevent duplicate launch commands.
   * Checks if a launch operation is already in progress for the device.
   * Shows a warning alert to the user if a launch is blocked.
   * 
   * @param deviceId - The device identifier
   * @param operation - Description of the operation being attempted (for logging/alerts)
   * @returns true if launch can proceed, false if blocked
   */
  private canLaunch(deviceId: string, operation: string): boolean {
    const isLoading = this.store.isPlayerLoading(deviceId)();
    
    if (isLoading) {
      logWarn(
        `Launch blocked: ${operation} attempted while launch already in progress for device ${deviceId}`
      );
      this.alertService.warning('Please wait - a file is currently loading');
      return false;
    }
    
    return true;
  }

  startListeningToPopState(): void {
    if (typeof window === 'undefined') {
      logWarn('Popstate listener not registered: window is undefined');
      return;
    }

    if (this.popstateListener) {
      return;
    }

    this.popstateListener = () => {
      void this.handlePopState();
    };

    window.addEventListener('popstate', this.popstateListener);
    logInfo(LogType.Info, 'PlayerContextService registered browser popstate listener');
  }

  stopListeningToPopState(): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (!this.popstateListener) {
      return;
    }

    window.removeEventListener('popstate', this.popstateListener);
    this.popstateListener = null;
    logInfo(LogType.Info, 'PlayerContextService removed browser popstate listener');
  }

  async launchFileWithContext(request: LaunchFileContextRequest): Promise<void> {
    // Guard: Prevent duplicate launches
    if (!this.canLaunch(request.deviceId, 'launchFileWithContext')) {
      return;
    }

    const launchMode = request.launchMode ?? LaunchMode.Directory;
    const directoryPath = request.directoryPath ?? '/';
    const files = [...request.files];

    // Hide history view when launching new files (directory clicks, search clicks)
    this.store.updateHistoryViewVisibility({ deviceId: request.deviceId, visible: false });

    await this.store.launchFileWithContext({
      deviceId: request.deviceId,
      file: request.file,
      directoryPath,
      files,
      launchMode,
    });

    // Only setup timer for music files if launch was successful
    // Note: We don't return early on error - the store action already set currentFile
    // and fileContext so the UI can show which file failed
    if (!this.hasErrorAndCleanup(request.deviceId)) {
      this.recordHistoryIfSuccessful(request.deviceId);
      this.setupTimerForFile(request.deviceId, request.file);
      this.updateUrlForLaunchedFile(request.deviceId);
    }
  }

  updateCurrentFileFavoriteStatus(deviceId: string, filePath: string, isFavorite: boolean): void {
    this.store.updateCurrentFileFavoriteStatus({ deviceId, filePath, isFavorite });
  }

  getCurrentFile(deviceId: string) {
    return this.store.getCurrentFile(deviceId);
  }

  getFileContext(deviceId: string) {
    return this.store.getPlayerFileContext(deviceId);
  }

  isLoading(deviceId: string) {
    return this.store.isPlayerLoading(deviceId);
  }

  /**
   * Returns a global signal indicating if ANY device is slow loading (loading for more than 2 seconds).
   * Uses a delayed emission strategy to avoid showing busy dialogs for fast operations:
   * - When ANY device starts loading, waits LAUNCH_DELAY_MS before emitting true
   * - If loading completes before delay, signal stays false (no dialog flash)
   * - When ALL devices finish loading, immediately emits false (instant feedback)
   * 
   * Signal is cached on first call for performance.
   * @returns Signal<boolean> - true if any device has been loading for more than 2 seconds
   */
  isSlowLoading(): Signal<boolean> {
    // Return cached signal if it exists
    if (this.slowLoadingSignal) {
      return this.slowLoadingSignal;
    }

    // Create observable pipeline that tracks ANY device loading
    const slowLoading$ = toObservable(this.store.players, { injector: this.injector }).pipe(
      // Check if ANY device is currently loading
      map((players) => Object.values(players).some((player) => player.isLoading)),
      // Only emit when loading state changes
      distinctUntilChanged(),
      // Apply delay only when transitioning to loading state
      switchMap((isLoading) =>
        isLoading
          ? timer(this.LAUNCH_DELAY_MS).pipe(mapTo(true)) // Delay showing busy dialog
          : of(false) // Immediate feedback when done
      )
    );

    // Convert to signal and cache the result
    this.slowLoadingSignal = toSignal(slowLoading$, {
      injector: this.injector,
      initialValue: false,
    });

    return this.slowLoadingSignal;
  }

  getError(deviceId: string) {
    return this.store.getPlayerError(deviceId);
  }

  getStatus(deviceId: string) {
    return this.store.getPlayerStatus(deviceId);
  }

  async launchRandomFile(deviceId: string): Promise<void> {
    // Guard: Prevent duplicate launches
    if (!this.canLaunch(deviceId, 'launchRandomFile')) {
      return;
    }

    await this.store.launchRandomFile({ deviceId });

    const currentFile = this.store.getCurrentFile(deviceId)();
    if (currentFile) {      
      if (!this.hasErrorAndCleanup(deviceId)) {
        this.setupTimerForFile(deviceId, currentFile.file);
      }
      await this.loadDirectoryContextForRandomFile(currentFile);
      if (!this.hasErrorAndCleanup(deviceId)) {
        this.recordHistoryIfSuccessful(deviceId);
        this.updateUrlForLaunchedFile(deviceId);
      }
    }
  }

  private async loadDirectoryContextForRandomFile(currentFile: LaunchedFile): Promise<void> {
    const { storageKey } = currentFile;
    const { deviceId, storageType } = StorageKeyUtil.parse(storageKey);

    try {
      await this.storageStore.navigateToDirectory({
        deviceId,
        storageType,
        path: currentFile.parentPath,
      });

      const directoryState = this.storageStore.getSelectedDirectoryState(deviceId)();

      if (directoryState?.directory?.files) {
        const currentIndex = directoryState.directory.files.findIndex(
          (file) => file.path === currentFile.file.path
        );

        if (currentIndex >= 0) {
          this.store.loadFileContext({
            deviceId,
            storageType,
            directoryPath: currentFile.parentPath,
            files: directoryState.directory.files,
            currentFileIndex: currentIndex,
            launchMode: this.store.getLaunchMode(deviceId)(),
          });
        }
      }
    } catch {
      // Silently ignore directory loading failures
    }
  }

  toggleShuffleMode(deviceId: string): void {
    const currentMode = this.store.getLaunchMode(deviceId)();
    const newMode = currentMode === LaunchMode.Shuffle ? LaunchMode.Directory : LaunchMode.Shuffle;

    // Update launch mode using the proper action
    this.store.updateLaunchMode({
      deviceId,
      launchMode: newMode,
    });
  }

  setShuffleScope(deviceId: string, scope: PlayerScope): void {
    this.store.updateShuffleSettings({
      deviceId,
      shuffleSettings: { scope },
    });
  }

  setFilterMode(deviceId: string, filter: PlayerFilterType): void {
    this.store.updateShuffleSettings({
      deviceId,
      shuffleSettings: { filter },
    });
  }

  getShuffleSettings(deviceId: string) {
    return this.store.getShuffleSettings(deviceId);
  }

  getLaunchMode(deviceId: string) {
    return this.store.getLaunchMode(deviceId);
  }

  // Phase 3: New playback control methods
  async play(deviceId: string): Promise<void> {
    // Phase 5: Do not allow play if current file is incompatible
    if (!this.store.isCurrentFileCompatible(deviceId)()) {
      logWarn(`Cannot play incompatible file on device ${deviceId}`);
      return;
    }

    await this.store.play({ deviceId });

    // Phase 5: Resume timer for music files
    if (this.isCurrentFileMusicType(deviceId)) {
      this.timerManager.resumeTimer(deviceId);
    }
  }

  async pause(deviceId: string): Promise<void> {
    // Phase 5: Do not allow pause if current file is incompatible
    if (!this.store.isCurrentFileCompatible(deviceId)()) {
      logWarn(`Cannot pause incompatible file on device ${deviceId}`);
      return;
    }

    await this.store.pauseMusic({ deviceId });

    // Phase 5: Pause timer for music files
    if (this.isCurrentFileMusicType(deviceId)) {
      this.timerManager.pauseTimer(deviceId);
    }
  }

  async stop(deviceId: string): Promise<void> {
    await this.store.stopPlayback({ deviceId });

    // Phase 5: Stop timer
    this.timerManager.stopTimer(deviceId);
  }

  async next(deviceId: string): Promise<void> {
    // Guard: Prevent duplicate launches
    if (!this.canLaunch(deviceId, 'next')) {
      return;
    }

    const launchMode = this.store.getLaunchMode(deviceId)();

    // If in shuffle mode AND forward history is available, use history navigation
    if (launchMode === LaunchMode.Shuffle && this.store.canNavigateForwardInHistory(deviceId)()) {
      logInfo(
        LogType.Info,
        `Next: Using forward history navigation for shuffle mode on device ${deviceId}`
      );

      // Navigate forward through history
      await this.store.navigateForwardInHistory({ deviceId });

      // Load directory context for the history file
      const currentFile = this.store.getCurrentFile(deviceId)();
      if (currentFile) {
        await this.loadDirectoryContextForRandomFile(currentFile);
      }

      // Setup timer if navigation was successful (no error)
      if (currentFile && !this.hasErrorAndCleanup(deviceId)) {
        this.setupTimerForFile(deviceId, currentFile.file);
        this.updateUrlForLaunchedFile(deviceId);
        // Important: DO NOT record history when navigating through existing history
      }

      return; // Early exit - don't fall through to default behavior
    }

    // Default behavior: Launch new random file (shuffle) or next in directory
    // Always call the store action first
    await this.store.navigateNext({ deviceId });

    // If in shuffle mode, load directory context for the new random file
    if (launchMode === LaunchMode.Shuffle) {
      const currentFile = this.store.getCurrentFile(deviceId)();
      if (currentFile) {
        await this.loadDirectoryContextForRandomFile(currentFile);
      }
    }

    // Only setup timer for the new file if navigation was successful
    // Note: We still load directory context even on error so UI can show failed file
    const currentFile = this.store.getCurrentFile(deviceId)();
    if (currentFile && !this.hasErrorAndCleanup(deviceId)) {
      this.recordHistoryIfSuccessful(deviceId);
      this.setupTimerForFile(deviceId, currentFile.file);
      this.updateUrlForLaunchedFile(deviceId);
    }
  }

  async previous(deviceId: string): Promise<void> {
    // Guard: Prevent duplicate launches
    if (!this.canLaunch(deviceId, 'previous')) {
      return;
    }

    const launchMode = this.store.getLaunchMode(deviceId)();

    // If in shuffle mode AND history navigation is available, use history navigation
    if (launchMode === LaunchMode.Shuffle && this.store.canNavigateBackwardInHistory(deviceId)()) {
      logInfo(
        LogType.Info,
        `Previous: Using history navigation for shuffle mode on device ${deviceId}`
      );

      // Navigate backward through history
      await this.store.navigateBackwardInHistory({ deviceId });

      // Load directory context for the history file
      const currentFile = this.store.getCurrentFile(deviceId)();
      if (currentFile) {
        await this.loadDirectoryContextForRandomFile(currentFile);
      }

      // Setup timer if successful - DO NOT record history (navigating existing entries)
      if (currentFile && !this.hasErrorAndCleanup(deviceId)) {
        this.setupTimerForFile(deviceId, currentFile.file);
        this.updateUrlForLaunchedFile(deviceId);
      }

      return; // Exit early - don't continue to default behavior
    }

    // Default behavior: call store action (directory/search mode OR shuffle with no history)
    await this.store.navigatePrevious({ deviceId });

    // If in shuffle mode, load directory context for the new random file
    if (launchMode === LaunchMode.Shuffle) {
      const currentFile = this.store.getCurrentFile(deviceId)();
      if (currentFile) {
        await this.loadDirectoryContextForRandomFile(currentFile);
      }
    }

    // Only setup timer for the new file if navigation was successful
    // Note: We still load directory context even on error so UI can show failed file
    const currentFile = this.store.getCurrentFile(deviceId)();
    if (currentFile && !this.hasErrorAndCleanup(deviceId)) {
      this.recordHistoryIfSuccessful(deviceId); // Record history for new file launches
      this.setupTimerForFile(deviceId, currentFile.file);
      this.updateUrlForLaunchedFile(deviceId);
    }
  }

  getPlayerStatus(deviceId: string) {
    return this.store.getPlayerStatus(deviceId);
  }

  isCurrentFileCompatible(deviceId: string) {
    return this.store.isCurrentFileCompatible(deviceId);
  }

  // Helper method to determine if current file is music type
  private isCurrentFileMusicType(deviceId: string): boolean {
    const currentFile = this.getCurrentFile(deviceId)();
    return currentFile?.file?.type === FileItemType.Song;
  }

  /**
   * Check if operation resulted in error state and cleanup timer if so.
   * Returns true if error exists (indicating operation should abort).
   */
  private hasErrorAndCleanup(deviceId: string): boolean {
    const error = this.store.getPlayerError(deviceId)();
    if (error) {
      // Operation failed - cleanup any existing timer
      this.cleanupTimer(deviceId);
      return true;
    }
    return false;
  }

  /**
   * Phase 5 + Custom Timer: Setup timer for file based on custom timer configuration
   * Creates timer, subscribes to updates and completion events
   *
   * Timer Priority Logic:
   * 1. Hex files: Never create timer (incompatible)
   * 2. Song files: Always use metadata duration (ignore custom timer)
   * 3. Custom timer enabled: Use custom duration for non-song files only
   * 4. Other files (games, images, etc.): No timer when custom timer disabled
   */
  private setupTimerForFile(deviceId: string, file: FileItem): void {
    const timerDuration = this.determineTimerDuration(deviceId, file);

    // No timer needed - cleanup and exit
    if (timerDuration === null) {
      this.cleanupTimer(deviceId);
      return;
    }

    // Create timer with determined duration
    this.createTimerWithCompletion(deviceId, timerDuration);
  }

  /**
   * Determine appropriate timer duration based on file type and custom timer settings
   * Returns duration in milliseconds, or null if no timer should be created
   */
  private determineTimerDuration(deviceId: string, file: FileItem): number | null {
    // Hex files never get timers
    if (file.type === FileItemType.Hex) {
      logInfo(LogType.Info, `Hex file excluded from timer: ${file.name}`);
      return null;
    }

    // Song files always use metadata duration
    if (file.type === FileItemType.Song) {
      return this.parseSongDuration(file);
    }

    // Non-song files use custom timer if enabled
    const playTimerConfig = this.store.getPlayTimerConfig(deviceId)();
    if (playTimerConfig?.enabled) {
      logInfo(
        LogType.Start,
        `Setting up custom timer for ${file.name} (${playTimerConfig.durationMs}ms) on device ${deviceId}`
      );
      return playTimerConfig.durationMs;
    }

    // No timer for non-song files when custom timer disabled
    logInfo(LogType.Info, `Skipping timer setup for non-music file: ${file.name}`);
    return null;
  }

  /**
   * Parse song duration from metadata, with fallback to default 3-minute timer
   */
  private parseSongDuration(file: FileItem): number {
    let totalTime = parsePlayLength(file.playLength ?? '');

    // Handle missing or invalid metadata
    if (totalTime === 0) {
      totalTime = DEFAULT_TIMER_MS;

      if (!file.playLength || file.playLength.trim() === '') {
        logWarn(
          `Music file ${file.name} has empty playLength. Using default 3-minute timer. Backend should provide playLength.`
        );
      } else {
        logWarn(
          `Music file ${file.name} has invalid playLength format: "${file.playLength}". Using default 3-minute timer. Backend should provide valid playLength.`
        );
      }
    }

    logInfo(
      LogType.Start,
      `Setting up metadata timer for song ${file.name} (${totalTime}ms)`
    );

    return totalTime;
  }

  /**
   * Create timer and subscribe to completion events only.
   * Timer updates flow through observable-to-signal conversion (no store pollution).
   */
  private createTimerWithCompletion(deviceId: string, durationMs: number): void {
    // Cleanup old timer/signal/subscriptions FIRST
    this.cleanupTimer(deviceId);
    
    // Create NEW timer in manager (must happen before toSignal)
    this.timerManager.createTimer(deviceId, durationMs);

    // Immediately initialize the new signal (outside reactive context)
    // Get current state AFTER creating timer so we have valid initial value
    const currentState = this.timerManager.getTimerState(deviceId);
    
    logInfo(LogType.Info, `Timer signal initialized for device ${deviceId}:`, currentState);
    
    // Create signal with proper initialValue (currentState should always exist after createTimer)
    // Use type assertion since we know the observable will emit TimerState | null
    const signal = currentState
      ? toSignal(this.timerManager.onTimerUpdate$(deviceId), {
          initialValue: currentState,
          injector: this.injector,
        })
      : (toSignal(this.timerManager.onTimerUpdate$(deviceId), {
          injector: this.injector,
        }) as Signal<TimerState | null>);
    
    // Cache the new signal
    this.timerSignals.set(deviceId, signal);

    // Subscribe only to completion for auto-progression
    const completeSub = this.timerManager.onTimerComplete$(deviceId).subscribe(() => {
      logInfo(
        LogType.Success,
        `Timer completed for device ${deviceId}, attempting auto-progression to next file`
      );
      
      // Check if launch is already in progress before auto-progressing
      // Use store directly to avoid showing alert - this is auto-progression, not user action
      const isLoading = this.store.isPlayerLoading(deviceId)();
      if (isLoading) {
        logWarn(
          `Auto-progression skipped: Launch already in progress for device ${deviceId}`
        );
        return;
      }
      
      void this.next(deviceId);
    });

    // Store completion subscription for cleanup
    this.completionSubscriptions.set(deviceId, completeSub);

    logInfo(LogType.Success, `Timer setup complete for device ${deviceId}`);
  }

  /**
   * Phase 5: Cleanup timer, signal cache, and completion subscription
   */
  private cleanupTimer(deviceId: string): void {
    // Destroy timer in manager
    this.timerManager.destroyTimer(deviceId);

    // Remove cached signal
    this.timerSignals.delete(deviceId);

    // Unsubscribe and remove completion subscription
    const completeSub = this.completionSubscriptions.get(deviceId);
    if (completeSub) {
      completeSub.unsubscribe();
      this.completionSubscriptions.delete(deviceId);
    }
  }

  /**
   * Get current timer state for a device.
   * Returns a signal that emits timer updates from the observable stream.
   * Signals are cached per device for referential equality and performance.
   * 
   * IMPORTANT: This method is safe to call from reactive contexts (computed, effect)
   * because it NEVER calls toSignal() - signals are pre-created in createTimerWithCompletion().
   * If no cached signal exists, returns a constant null signal.
   */
  getTimerState(deviceId: string): Signal<TimerState | null> {
    // Return cached signal if it exists (created in createTimerWithCompletion)
    const cachedSignal = this.timerSignals.get(deviceId);
    if (cachedSignal) {
      return cachedSignal;
    }

    // No timer exists for this device - return constant null signal
    // This is safe to call from reactive contexts since we're not calling toSignal()
    return this.nullTimerSignal;
  }

  /**
   * Get custom play timer configuration for a device
   */
  getPlayTimerConfig(deviceId: string) {
    return this.store.getPlayTimerConfig(deviceId);
  }

  /**
   * Set custom play timer configuration for a device.
   * Updates the custom timer enabled state and duration.
   *
   * If a file is currently playing with a timer, the timer will be recreated immediately
   * with the new configuration. This provides instant feedback when users change settings
   * mid-playback. Timer recreation resets currentTime to 0 with the new totalTime.
   *
   * @param deviceId - The device identifier
   * @param enabled - Whether custom timer is active
   * @param durationMs - Custom duration in milliseconds
   */
  setCustomTimer(deviceId: string, enabled: boolean, durationMs: number): void {
    // Update store state
    this.store.updatePlayerTimer({ deviceId, enabled, durationMs });

    logInfo(
      LogType.Info,
      `Custom timer config updated for device ${deviceId}: enabled=${enabled}, duration=${durationMs}ms`
    );

    // Get current file
    const currentFile = this.store.getCurrentFile(deviceId)();

    // Setup timer if file is currently loaded (creates new timer or recreates existing)
    // This ensures timer is created immediately when enabling custom timer on a running game
    if (currentFile?.file) {
      logInfo(
        LogType.Info,
        `Setting up timer for device ${deviceId} with new custom timer config`
      );
      this.setupTimerForFile(deviceId, currentFile.file);
    }
  }

  /**
   * Update browser URL when file is launched
   * Extracts current file info and updates the URL with device, storage, path, and file query parameters
   * Forward slashes in path parameters are preserved for cleaner, more readable URLs
   */
  private updateUrlForLaunchedFile(deviceId: string): void {
    if (this.isHandlingPopState) {
      return; // Skip URL updates while replaying browser history
    }

    const currentFile = this.store.getCurrentFile(deviceId)();
    if (!currentFile) return;

    const { storageType } = StorageKeyUtil.parse(currentFile.storageKey);

    // Build query string manually to preserve forward slashes in path
    // This avoids encoding slashes (%2F) for cleaner, more readable URLs
    const queryString = [
      `device=${encodeURIComponent(deviceId)}`,
      `storage=${encodeURIComponent(StorageTypeUtil.toString(storageType))}`,
      `path=${currentFile.parentPath}`,
      `file=${encodeURIComponent(currentFile.file.name)}`,
    ].join('&');

    // Update URL without triggering route navigation
    this.location.go(`/player?${queryString}`);
  }

  /**
   * Record history if file launch was successful
   */
  private recordHistoryIfSuccessful(deviceId: string): void {
    const currentFile = this.store.getCurrentFile(deviceId)();

    if (!currentFile || !currentFile.isCompatible) {
      return;
    }

    const entry: HistoryEntry = {
      file: currentFile.file,
      storageKey: currentFile.storageKey,
      parentPath: currentFile.parentPath,
      timestamp: currentFile.launchedAt,
      isCompatible: currentFile.isCompatible,
    };

    this.store.recordHistory({ deviceId, entry });
  }

  /**
   * Phase 1: Get play history for a device
   */
  getPlayHistory(deviceId: string) {
    return this.store.getPlayHistory(deviceId);
  }

  /**
   * Phase 1: Get current history position for a device
   */
  getCurrentHistoryPosition(deviceId: string) {
    return this.store.getCurrentHistoryPosition(deviceId);
  }

  /**
   * Phase 1: Check if can navigate backward in history
   */
  canNavigateBackwardInHistory(deviceId: string) {
    return this.store.canNavigateBackwardInHistory(deviceId);
  }

  /**
   * Phase 1: Check if can navigate forward in history
   */
  canNavigateForwardInHistory(deviceId: string) {
    return this.store.canNavigateForwardInHistory(deviceId);
  }

  /**
   * Phase 1: Clear play history for a device
   */
  clearHistory(deviceId: string): void {
    this.store.clearHistory({ deviceId });
  }

  /**
   * Phase 3: Toggle history view visibility for a device
   */
  toggleHistoryView(deviceId: string): void {
    const currentVisibility = this.store.isHistoryViewVisible(deviceId)();
    this.store.updateHistoryViewVisibility({ deviceId, visible: !currentVisibility });
  }

  /**
   * Phase 3: Check if history view is visible for a device
   */
  isHistoryViewVisible(deviceId: string): Signal<boolean> {
    return this.store.isHistoryViewVisible(deviceId);
  }

  /**
   * Navigate to a specific position in history
   * Loads directory context and sets up timer after navigation
   */
  async navigateToHistoryPosition(deviceId: string, position: number): Promise<void> {
    // Guard: Prevent duplicate launches
    if (!this.canLaunch(deviceId, 'navigateToHistoryPosition')) {
      return;
    }

    // Navigate to the history position (launches file and updates position)
    await this.store.navigateToHistoryPosition({ deviceId, position });

    // Check for errors
    if (this.hasErrorAndCleanup(deviceId)) {
      return;
    }

    // Load directory context for the file
    const currentFile = this.store.getCurrentFile(deviceId)();
    if (currentFile) {
      await this.loadDirectoryContextForRandomFile(currentFile);
    }

    // Setup timer if file is compatible
    if (currentFile?.isCompatible) {
      this.setupTimerForFile(deviceId, currentFile.file);
      this.updateUrlForLaunchedFile(deviceId);
    }
  }

  /**
   * Handle browser back/forward navigation and relaunch files based on URL query parameters
   */
  private async handlePopState(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const deviceId = params.get('device');
    const storageParam = params.get('storage');
    const directoryPath = params.get('path');
    const fileName = params.get('file');

    if (!deviceId || !storageParam || !directoryPath) {
      logInfo(LogType.Info, 'Popstate event ignored without deep linking parameters');
      return;
    }

    const normalizedStorage = storageParam.toUpperCase();
    let storageType: StorageType | null = null;

    if (normalizedStorage === StorageType.Sd) {
      storageType = StorageType.Sd;
    } else if (normalizedStorage === StorageType.Usb) {
      storageType = StorageType.Usb;
    }

    if (!storageType) {
      logWarn(`Popstate event ignored due to invalid storage type: ${storageParam}`);
      return;
    }

    logInfo(LogType.Start, 'Handling browser popstate navigation', {
      deviceId,
      storageType,
      directoryPath,
      fileName: fileName ?? 'none',
    });

    try {
      await this.storageStore.navigateToDirectory({
        deviceId,
        storageType,
        path: directoryPath,
      });
    } catch {
      logWarn(`Failed to navigate to directory "${directoryPath}" during browser navigation`);
      this.alertService.warning(`Directory "${directoryPath}" could not be loaded or has no files`);
      return;
    }

    const directoryState = this.storageStore.getSelectedDirectoryState(deviceId)();
    const directoryFiles = directoryState?.directory?.files ?? [];

    if (!fileName) {
      logInfo(LogType.Info, 'Popstate navigation completed without file parameter');
      return;
    }

    if (!directoryFiles.length) {
      logWarn(`Directory "${directoryPath}" has no files during browser navigation`);
      this.alertService.warning(`Directory "${directoryPath}" could not be loaded or has no files`);
      return;
    }

    const targetFile = directoryFiles.find((file) => file.name === fileName);

    if (!targetFile) {
      logWarn(`File "${fileName}" not found during browser navigation`);
      this.alertService.warning(`File "${fileName}" not found in directory "${directoryPath}"`);
      return;
    }

    // Check if launch is already in progress before browser navigation
    const isLoading = this.store.isPlayerLoading(deviceId)();
    if (isLoading) {
      logWarn(
        `Browser navigation skipped: Launch already in progress for device ${deviceId}`
      );
      this.alertService.warning('Please wait - a file is currently loading');
      return;
    }

    this.isHandlingPopState = true;
    try {
      await this.launchFileWithContext({
        deviceId,
        file: targetFile,
        directoryPath,
        files: directoryFiles,
        launchMode: LaunchMode.Directory,
      });
      logInfo(LogType.Success, 'Browser history navigation relaunched file', {
        deviceId,
        file: targetFile.name,
      });
    } finally {
      this.isHandlingPopState = false;
    }
  }
}
