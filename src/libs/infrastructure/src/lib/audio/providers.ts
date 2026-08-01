import { Provider } from '@angular/core';
import { AUDIO_STREAM_SERVICE, API_CONFIG, IApiConfig } from '@teensyrom-nx/domain';
import { AudioStreamService } from './audio-stream.service';
import { AudioApiService, Configuration } from '@teensyrom-nx/data-access/api-client';

/**
 * API Client provider for Audio API.
 * Configures the AudioApiService with the backend base URL.
 */
export const AUDIO_API_CLIENT_PROVIDER = {
  provide: AudioApiService,
  useFactory: (apiConfig: IApiConfig) => {
    const config = new Configuration({ basePath: apiConfig.basePath });
    return new AudioApiService(config);
  },
  deps: [API_CONFIG],
};

/**
 * Provider configuration for audio streaming infrastructure.
 *
 * Maps the domain AUDIO_STREAM_SERVICE injection token to the infrastructure
 * AudioStreamService implementation, with dependencies on the API client and config.
 */
export const AUDIO_STREAM_PROVIDERS: Provider[] = [
  AUDIO_API_CLIENT_PROVIDER,
  {
    provide: AUDIO_STREAM_SERVICE,
    useClass: AudioStreamService,
    deps: [AudioApiService, API_CONFIG],
  },
];
