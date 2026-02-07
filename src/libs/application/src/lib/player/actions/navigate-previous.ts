import { updateState } from '@angular-architects/ngrx-toolkit';
import { firstValueFrom } from 'rxjs';
import { LaunchMode, PlayerStatus } from '@teensyrom-nx/domain';
import { IPlayerService } from '@teensyrom-nx/domain';
import { createAction, logInfo, logError, LogType } from '@teensyrom-nx/utils';
import { PlayerState } from '../player-store';
import { IPlayerStorage } from '../player-storage.interface';
import {
  WritableStore,
  setShuffleNavigationSuccess,
  setShuffleNavigationFailure,
  setDirectoryNavigationSuccess,
} from '../player-helpers';

export function navigatePrevious(store: WritableStore<PlayerState>, playerService: IPlayerService, playerStorage: IPlayerStorage) {
  return {
    navigatePrevious: async ({ deviceId }: { deviceId: string }): Promise<void> => {
      const actionMessage = createAction('navigate-previous');

      logInfo(LogType.Start, `Navigating to previous file for ${deviceId}`, {
        deviceId,
        actionMessage,
      });

      const currentState = store.players();
      const playerState = currentState[deviceId];

      if (!playerState) {
        logError(`No player state found for device ${deviceId}`);
        return;
      }

      const { launchMode, fileContext, shuffleSettings } = playerState;

      try {
        if (launchMode === LaunchMode.Shuffle) {
          // In shuffle mode, previous launches another random file (hardcoded behavior)
          logInfo(
            LogType.Info,
            `Shuffle mode: launching another random file for previous on ${deviceId}`
          );

          const launchedFile = await firstValueFrom(
            playerService.launchRandom(
              deviceId,
              shuffleSettings.scope,
              shuffleSettings.filter,
              shuffleSettings.startingDirectory
            )
          );

          const existingStorageKey = playerState.currentFile?.storageKey;
          const isCompatible = launchedFile.isCompatible;

          if (!isCompatible) {
            const errorMessage = 'File is not compatible with TeensyROM hardware';
            logError(
              `Navigate previous: Random file ${launchedFile.name} is incompatible with device ${deviceId}: ${errorMessage}`
            );
            setShuffleNavigationFailure(
              store,
              deviceId,
              launchedFile,
              existingStorageKey,
              errorMessage,
              actionMessage
            );
            return;
          }

          setShuffleNavigationSuccess(
            store,
            deviceId,
            launchedFile,
            existingStorageKey,
            actionMessage
          );

          // Persist state after successful navigation
          try {
            playerStorage.save(deviceId, store.players()[deviceId]);
          } catch (error) {
            logError(
              `Navigate previous: Failed to persist player state to localStorage for device ${deviceId}`,
              { error }
            );
          }
        } else if (
          (launchMode === LaunchMode.Directory || launchMode === LaunchMode.Search) &&
          fileContext
        ) {
          const modeLabel = launchMode === LaunchMode.Search ? 'Search' : 'Directory';
          const { files, currentIndex } = fileContext;

          // Find previous compatible file
          let candidateIndex = (currentIndex - 1 + files.length) % files.length;
          let attempts = 0;
          const maxAttempts = files.length;

          while (attempts < maxAttempts) {
            const candidate = files[candidateIndex];
            if (candidate.isCompatible !== false) {
              // Found compatible file - use candidateIndex
              break;
            }
            candidateIndex = (candidateIndex - 1 + files.length) % files.length;
            attempts++;
          }

          if (attempts >= maxAttempts) {
            throw new Error('All files in context are incompatible');
          }

          const previousFile = files[candidateIndex];

          logInfo(
            LogType.Info,
            `${modeLabel} mode: going to previous file (${candidateIndex + 1}/${
              files.length
            }) for ${deviceId}`,
            { previousFile: previousFile.name }
          );

          const launchedFile = await firstValueFrom(
            playerService.launchFile(deviceId, previousFile)
          );

          setDirectoryNavigationSuccess(
            store,
            deviceId,
            launchedFile,
            fileContext,
            candidateIndex,
            actionMessage
          );

          // Persist state after successful navigation
          try {
            playerStorage.save(deviceId, store.players()[deviceId]);
          } catch (error) {
            logError(
              `Navigate previous: Failed to persist player state to localStorage for device ${deviceId}`,
              { error }
            );
          }
        } else {
          logInfo(LogType.Info, `No file context available for navigation on ${deviceId}`);
        }

        logInfo(LogType.Finish, `Navigate previous completed for ${deviceId}`);
      } catch (error) {
        const errorMessage = (error as Error)?.message || 'Failed to navigate to previous file';
        logError(`Navigate previous failed for ${deviceId}:`, error);

        updateState(store, actionMessage, (state) => ({
          players: {
            ...state.players,
            [deviceId]: {
              ...state.players[deviceId],
              status: PlayerStatus.Stopped,
              error: errorMessage,
              lastUpdated: Date.now(),
            },
          },
        }));

        throw error;
      }
    },
  };
}
