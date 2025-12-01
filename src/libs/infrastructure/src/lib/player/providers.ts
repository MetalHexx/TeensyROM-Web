import { PLAYER_SERVICE, ALERT_SERVICE, API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';
import { PLAYER_STORAGE } from '@teensyrom-nx/application';
import { PlayerService } from './player.service';
import { PlayerStorageService } from './player-storage.service';
import { PlayerApiService, Configuration } from '@teensyrom-nx/data-access/api-client';

export const PLAYER_API_CLIENT_PROVIDER = {
  provide: PlayerApiService,
  useFactory: (apiConfig: IApiConfig) => {
    const config = new Configuration({ basePath: apiConfig.basePath });
    return new PlayerApiService(config);
  },
  deps: [API_CONFIG],
};

export const PLAYER_SERVICE_PROVIDER = {
  provide: PLAYER_SERVICE,
  useClass: PlayerService,
  deps: [PlayerApiService, ALERT_SERVICE, API_CONFIG],
};

export const PLAYER_STORAGE_PROVIDER = {
  provide: PLAYER_STORAGE,
  useClass: PlayerStorageService,
};
