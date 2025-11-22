import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { runInInjectionContext, inject } from '@angular/core';
import { AppBootstrapService } from '@teensyrom-nx/app/bootstrap';
import { LogType, logInfo, logError } from '@teensyrom-nx/utils';

async function bootstrap() {
  logInfo(LogType.Start, 'Starting application bootstrap...');

  // Create application instance - this allows UI to render
  const app = await bootstrapApplication(AppComponent, appConfig);

  // Run bootstrap initialization in the injection context (non-blocking for UI)
  runInInjectionContext(app.injector, () => {
    const bootstrapService = inject(AppBootstrapService);
    bootstrapService.init().catch((error) => {
      logError('Failed to initialize application:', error);
    });
  });
}

// Bootstrap the application
logInfo(LogType.Info, 'About to bootstrap application...');
bootstrap().catch((err) => logError('Bootstrap failed:', err));
