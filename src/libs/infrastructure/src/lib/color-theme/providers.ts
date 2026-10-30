import { Provider } from '@angular/core';
import { Configuration, ThemesApiService } from '@teensyrom-nx/data-access/api-client';
import { API_CONFIG, COLOR_THEME_SERVICE, IApiConfig } from '@teensyrom-nx/domain';
import { ColorThemeService } from './color-theme.service';

/** API client provider for the Themes API, configured with the backend base URL. */
export const THEMES_API_CLIENT_PROVIDER = {
  provide: ThemesApiService,
  useFactory: (apiConfig: IApiConfig) =>
    new ThemesApiService(new Configuration({ basePath: apiConfig.basePath })),
  deps: [API_CONFIG],
};

/** Provider configuration for color-theme infrastructure. */
export const COLOR_THEME_PROVIDERS: Provider[] = [
  THEMES_API_CLIENT_PROVIDER,
  { provide: COLOR_THEME_SERVICE, useClass: ColorThemeService },
];
