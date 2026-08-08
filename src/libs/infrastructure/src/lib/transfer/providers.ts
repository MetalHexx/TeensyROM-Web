import { Provider } from '@angular/core';
import { TRANSFER_SERVICE, TRANSFER_HUB_SERVICE, API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';
import { TransferService } from './transfer.service';
import { TransferHubService } from './transfer-hub.service';
import { TransfersApiService, Configuration } from '@teensyrom-nx/data-access/api-client';

/**
 * API Client provider for the Transfers API.
 * Configures the TransfersApiService with the backend base URL.
 */
export const TRANSFERS_API_CLIENT_PROVIDER = {
  provide: TransfersApiService,
  useFactory: (apiConfig: IApiConfig) => {
    const config = new Configuration({ basePath: apiConfig.basePath });
    return new TransfersApiService(config);
  },
  deps: [API_CONFIG],
};

/**
 * Provider configuration for transfer infrastructure.
 *
 * Maps the domain TRANSFER_SERVICE injection token to the infrastructure
 * TransferService implementation, with dependencies on the API client and config.
 */
export const TRANSFER_PROVIDERS: Provider[] = [
  TRANSFERS_API_CLIENT_PROVIDER,
  {
    provide: TRANSFER_SERVICE,
    useClass: TransferService,
    deps: [TransfersApiService, API_CONFIG],
  },
  {
    provide: TRANSFER_HUB_SERVICE,
    useClass: TransferHubService,
    deps: [API_CONFIG],
  },
];
