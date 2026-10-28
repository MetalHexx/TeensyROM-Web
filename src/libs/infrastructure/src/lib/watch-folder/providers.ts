import { Provider } from '@angular/core';
import { WATCH_FOLDER_SERVICE, API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';
import { WatchFoldersApiService, Configuration } from '@teensyrom-nx/data-access/api-client';
import { WatchFolderService } from './watch-folder.service';

/**
 * API Client provider for the Watch Folders API.
 * Configures the WatchFoldersApiService with the backend base URL.
 */
export const WATCH_FOLDERS_API_CLIENT_PROVIDER = {
  provide: WatchFoldersApiService,
  useFactory: (apiConfig: IApiConfig) => {
    const config = new Configuration({ basePath: apiConfig.basePath });
    return new WatchFoldersApiService(config);
  },
  deps: [API_CONFIG],
};

/**
 * Provider configuration for watch-folder infrastructure: the generated client, and the
 * domain WATCH_FOLDER_SERVICE token mapped to WatchFolderService.
 */
export const WATCH_FOLDER_PROVIDERS: Provider[] = [
  WATCH_FOLDERS_API_CLIENT_PROVIDER,
  {
    provide: WATCH_FOLDER_SERVICE,
    useClass: WatchFolderService,
    deps: [WatchFoldersApiService],
  },
];
