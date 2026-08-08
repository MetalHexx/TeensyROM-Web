import { inject } from '@angular/core';
import { ResolveFn, ActivatedRouteSnapshot } from '@angular/router';
import {
  StorageStore,
  PlayerContextService,
  DeviceStore,
  PLAYER_STORAGE,
  SettingsStore,
  StorageKeyUtil,
  IPlayerStorage,
  PlayerStore,
} from '@teensyrom-nx/application';
import { StorageType, LaunchMode, Settings } from '@teensyrom-nx/domain';
import { logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { effect, runInInjectionContext, Injector, untracked } from '@angular/core';

/**
 * Route resolver for player route that kicks off initialization without blocking.
 *
 * Execution flow:
 * 1. Return immediately - component renders instantly
 * 2. Background: initializePlayer() waits for DeviceStore, then settings, then executes startup
 *
 * The component shows loading states as everything initializes in the background.
 *
 * Query Parameters (optional, for deep linking):
 * - `device`: Device ID to navigate to
 * - `storage`: Storage type 'SD' or 'USB'
 * - `path`: Directory path to open
 * - `file`: File name to launch
 *
 * @returns Promise<void> - resolves immediately
 */
export const playerRouteResolver: ResolveFn<void> = async (
  route: ActivatedRouteSnapshot
): Promise<void> => {
  const settingStore = inject(SettingsStore);
  const storageStore = inject(StorageStore);
  const deviceStore = inject(DeviceStore);
  const playerContextService = inject(PlayerContextService);
  const playerStorage = inject(PLAYER_STORAGE);
  const playerStore = inject(PlayerStore);
  const injector = inject(Injector);

  const deviceParam = route.queryParamMap.get('device');
  const storageParam = route.queryParamMap.get('storage');
  const pathParam = route.queryParamMap.get('path');
  const fileParam = route.queryParamMap.get('file');

  logInfo(LogType.Success, 'PlayerResolver: Starting async player initialization');

  // Kick off ALL initialization in background (don't await anything)
  setTimeout(() => {
    initializePlayer(
      injector,
      settingStore,
      storageStore,
      deviceStore,
      playerContextService,
      playerStorage,
      playerStore,
      deviceParam,
      storageParam,
      pathParam,
      fileParam
    ).catch((error) => {
      logError('PlayerResolver: Player initialization failed:', error);
    });
  }, 0);

  // Return immediately - component renders now
  logInfo(LogType.Success, 'PlayerResolver: Returning immediately to render component');
};

/**
 * Complete player initialization - runs entirely in background after component renders
 */
async function initializePlayer(
  injector: Injector,
  settingStore: InstanceType<typeof SettingsStore>,
  storageStore: InstanceType<typeof StorageStore>,
  deviceStore: InstanceType<typeof DeviceStore>,
  playerContextService: PlayerContextService,
  playerStorage: IPlayerStorage,
  playerStore: InstanceType<typeof PlayerStore>,
  deviceParam: string | null,
  storageParam: string | null,
  pathParam: string | null,
  fileParam: string | null
): Promise<void> {
  // Step 1: Wait for DeviceStore
  logInfo(LogType.Start, 'PlayerInit: Waiting for DeviceStore to initialize');

  while (!deviceStore.hasInitialised()) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  logInfo(
    LogType.Success,
    `PlayerInit: DeviceStore initialized: ${deviceStore.devices().length} device(s) found`
  );

  // Step 2: Initialize storage for all devices
  const devices = deviceStore.devices();
  logInfo(LogType.Start, `PlayerInit: Initializing storage for ${devices.length} device(s)`);

  for (const currentDevice of devices) {
    try {
      if (currentDevice.sdStorage?.available) {
        await storageStore.initializeStorage({
          deviceId: currentDevice.deviceId,
          storageType: StorageType.Sd,
        });
      }

      if (currentDevice.usbStorage?.available) {
        await storageStore.initializeStorage({
          deviceId: currentDevice.deviceId,
          storageType: StorageType.Usb,
        });
      }
    } catch (error) {
      logError(
        `PlayerInit: Error initializing storage for device ${currentDevice.deviceId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  logInfo(LogType.Success, 'PlayerInit: Storage initialization complete');

  // Step 3: Start listening to popstate
  playerContextService.startListeningToPopState();
  logInfo(LogType.Info, 'PlayerInit: Popstate listener started');

  // Step 4: Wait for settings
  logInfo(LogType.Start, 'PlayerInit: Waiting for settings to load');

  const settings = await new Promise<Settings>((resolve) => {
    runInInjectionContext(injector, () => {
      const effectRef = effect(() => {
        const loadedSettings = settingStore.getSettings()();
        if (loadedSettings !== null) {
          untracked(() => {
            logInfo(LogType.Success, 'PlayerInit: Settings loaded');
            resolve(loadedSettings);
          });
          effectRef.destroy();
        }
      });
    });
  });

  if (!settings) {
    logError('PlayerInit: Settings failed to load, skipping startup behaviors');
    return;
  }

  // Step 5: Execute startup behaviors
  logInfo(LogType.Start, 'PlayerInit: Executing startup behaviors');

  try {
    for (const currentDevice of devices) {
      // Check if device already has a file playing - skip if so
      const currentFile = playerStore.getCurrentFile(currentDevice.deviceId)();
      if (currentFile !== null) {
        logInfo(
          LogType.Info,
          `PlayerInit: Device ${currentDevice.deviceId} already has file playing, skipping startup behaviors`
        );
        continue;
      }

      const savedState = playerStorage.load(currentDevice.deviceId);

      let pathToNavigate = '/';
      let filenameToLaunch: string | null = null;
      let storageToNavigate = StorageType.Sd;
      let shouldLaunch = settings.playerSettings.startupLaunchEnabled;

      // Check for deep linking parameters
      if (deviceParam === currentDevice.deviceId && pathParam && storageParam) {
        pathToNavigate = pathParam;
        storageToNavigate = storageParam.toUpperCase() === 'USB' ? StorageType.Usb : StorageType.Sd;
        filenameToLaunch = fileParam;
        shouldLaunch = shouldLaunch && true;
      } else if (savedState?.currentFile?.file) {
        // Use saved state if available
        pathToNavigate = savedState.currentFile.file.parentPath;
        storageToNavigate = StorageKeyUtil.parse(savedState.currentFile.storageKey).storageType;
        filenameToLaunch = savedState.currentFile.file.name;
        shouldLaunch = shouldLaunch && true;
      }

      // Navigate to initial directory, unless the device already has a held position and
      // nothing needs to be launched or browsed from a different path.
      const hasPosition =
        storageStore.getSelectedDirectoryForDevice(currentDevice.deviceId)?.storageType != null;
      const navigationNeededForLaunch = shouldLaunch && filenameToLaunch !== null;
      // A saved file or deep link still identifies a folder to browse to even when auto-launch
      // is disabled - only the launch itself is gated on shouldLaunch, not the browsing position.
      const navigationNeededForSavedFolder = filenameToLaunch !== null && !shouldLaunch;

      if (
        !settings.playerSettings.startupLaunchRandom &&
        (navigationNeededForLaunch || navigationNeededForSavedFolder || !hasPosition)
      ) {
        await storageStore.navigateToDirectory({
          deviceId: currentDevice.deviceId,
          storageType: storageToNavigate,
          path: pathToNavigate,
        });
      }

      // Handle auto-launch or random launch
      if (settings.playerSettings.startupLaunchRandom && shouldLaunch) {
        await playerContextService.launchRandomFile(currentDevice.deviceId);
        playerContextService.setFilterMode(
          currentDevice.deviceId,
          settings.playerSettings.startupFilter
        );
      } else if (filenameToLaunch && shouldLaunch) {
        const directoryState = storageStore.getSelectedDirectoryState(currentDevice.deviceId)();
        if (directoryState?.directory?.files) {
          const fileToLaunch = directoryState.directory.files.find(
            (f: { name: string }) => f.name === filenameToLaunch
          );

          if (fileToLaunch) {
            logInfo(LogType.Info, `PlayerInit: Found file: ${filenameToLaunch}, launching...`);

            await playerContextService.launchFileWithContext({
              deviceId: currentDevice.deviceId,
              file: fileToLaunch,
              directoryPath: pathToNavigate,
              files: directoryState.directory.files,
              launchMode: savedState?.launchMode || LaunchMode.Directory,
            });
          }
        }
      }
    }

    logInfo(LogType.Success, 'PlayerInit: All initialization complete');
  } catch (error) {
    logError(
      'PlayerInit: Error during startup behaviors:',
      error instanceof Error ? error.message : error
    );
  }
}
