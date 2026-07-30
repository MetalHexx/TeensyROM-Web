# Bootstrap Service Pattern

## Overview

This document describes the application bootstrap pattern used in TeensyROM for initializing critical services and state before the application becomes interactive. The bootstrap service coordinates async initialization tasks and provides deterministic startup sequencing.

---

## Bootstrap Architecture

### Bootstrap Flow

```
App Initialization
    ↓
AppBootstrapService.bootstrap()
    ↓
Initialize Core Services (Settings, Device Discovery, etc.)
    ↓
Wait for Initialization Complete
    ↓
App Becomes Interactive
```

### Key Components

**AppBootstrapService** (`src/libs/app/bootstrap/src/lib/app-bootstrap.service.ts`)
- Orchestrates application startup sequence
- Coordinates multiple initialization tasks
- Provides deterministic Promise-based flow
- Handles bootstrap errors gracefully

**Feature Bootstrap Services** (e.g., `DeviceBootstrapService`)
- Feature-specific initialization logic
- Injected into AppBootstrapService
- Return Promises for async operations

**Reference Implementation**: See [app-bootstrap.service.ts](../../../../libs/app/bootstrap/src/lib/app-bootstrap.service.ts)

---

## Bootstrap Service Pattern

### AppBootstrapService Structure

```typescript
@Injectable({ providedIn: 'root' })
export class AppBootstrapService {
  private readonly logger = inject(LoggerService);
  private readonly settingsStore = inject(SettingsStore);
  private readonly deviceBootstrap = inject(DeviceBootstrapService);
  
  async bootstrap(): Promise<void> {
    this.logger.info('Application bootstrap started');
    
    try {
      // Initialize settings (loads from backend)
      await this.initializeSettings();
      
      // Initialize device discovery
      await this.deviceBootstrap.initialize();
      
      // Other initialization tasks...
      
      this.logger.info('Application bootstrap complete');
    } catch (error) {
      this.logger.error('Bootstrap failed', error);
      // Handle critical errors (may throw or use defaults)
    }
  }
  
  private async initializeSettings(): Promise<void> {
    this.settingsStore.loadSettings();
    await this.waitForSettingsInit();
  }
  
  private async waitForSettingsInit(): Promise<void> {
    return new Promise((resolve) => {
      const effectRef = effect(() => {
        const isLoading = this.settingsStore.isLoading();
        if (!isLoading) {
          effectRef.destroy();
          resolve();
        }
      });
    });
  }
}
```

---

## Integrating New Features into Bootstrap

### Step 1: Create Feature Initialization Method

Add a private async method to `AppBootstrapService`:

```typescript
private async initializeYourFeature(): Promise<void> {
  this.logger.info('Initializing your feature...');
  this.yourStore.loadData();
  await this.waitForYourFeatureInit();
}
```

### Step 2: Implement Wait Pattern

Use Angular's `effect()` to wait for store signals:

```typescript
private async waitForYourFeatureInit(): Promise<void> {
  return new Promise((resolve) => {
    const effectRef = effect(() => {
      const isLoaded = this.yourStore.isLoaded();
      if (isLoaded) {
        effectRef.destroy();  // Clean up effect
        resolve();
      }
    });
  });
}
```

### Step 3: Call from Bootstrap Method

Add your initialization to the bootstrap sequence:

```typescript
async bootstrap(): Promise<void> {
  try {
    await this.initializeSettings();
    await this.initializeYourFeature();  // Add here
    await this.deviceBootstrap.initialize();
    // ...
  } catch (error) {
    // Error handling
  }
}
```

**Important**: Consider initialization order dependencies. Features that depend on settings should initialize after settings.

---

## Error Handling Strategies

### Critical vs Non-Critical Failures

**Critical Failure** (blocks app startup):
```typescript
private async initializeCriticalFeature(): Promise<void> {
  try {
    await this.criticalStore.load();
  } catch (error) {
    this.logger.error('Critical feature failed', error);
    throw error;  // Blocks bootstrap
  }
}
```

**Non-Critical Failure** (uses defaults, shows warning):
```typescript
private async initializeNonCriticalFeature(): Promise<void> {
  try {
    this.featureStore.load();
    await this.waitForFeatureInit();
  } catch (error) {
    this.logger.warn('Feature failed to load, using defaults', error);
    // App continues with defaults
  }
  
  // Check for errors after wait
  const error = this.featureStore.error();
  if (error) {
    this.logger.warn(`Feature error: ${error}`);
    // Optionally show user notification
  }
}
```

### Bootstrap Error Recovery

**Pattern**: Allow app to start with degraded functionality rather than complete failure

```typescript
async bootstrap(): Promise<void> {
  const errors: string[] = [];
  
  // Try each initialization, collect errors
  try {
    await this.initializeSettings();
  } catch (error) {
    errors.push('Settings failed to load');
    // Use defaults
  }
  
  try {
    await this.deviceBootstrap.initialize();
  } catch (error) {
    errors.push('Device discovery failed');
    // Show empty state
  }
  
  // Log all errors but allow app to start
  if (errors.length > 0) {
    this.logger.warn('Bootstrap completed with errors:', errors);
  }
}
```

---

## Testing Bootstrap Services

### Unit Testing Pattern

```typescript
describe('AppBootstrapService', () => {
  let service: AppBootstrapService;
  let settingsStore: jasmine.SpyObj<SettingsStore>;
  
  beforeEach(() => {
    const settingsStoreSpy = jasmine.createSpyObj('SettingsStore', ['loadSettings']);
    
    TestBed.configureTestingModule({
      providers: [
        AppBootstrapService,
        { provide: SettingsStore, useValue: settingsStoreSpy }
      ]
    });
    
    service = TestBed.inject(AppBootstrapService);
    settingsStore = TestBed.inject(SettingsStore) as jasmine.SpyObj<SettingsStore>;
  });
  
  it('should load settings during bootstrap', async () => {
    await service.bootstrap();
    expect(settingsStore.loadSettings).toHaveBeenCalled();
  });
  
  it('should handle settings load failure gracefully', async () => {
    settingsStore.loadSettings.and.throwError('Network error');
    await expectAsync(service.bootstrap()).toBeResolved();
    // Verify app continues with defaults
  });
});
```

**Key Testing Principles**:
- Mock store dependencies
- Test both success and failure paths
- Verify graceful degradation
- Test initialization order
- Verify cleanup (effect destruction)

---

## Best Practices

### Do's
✅ Use async/await for sequential initialization
✅ Clean up effects with `effectRef.destroy()`
✅ Log bootstrap progress for debugging
✅ Handle errors gracefully (use defaults when possible)
✅ Wait for store state changes via effects
✅ Consider initialization order dependencies
✅ Test both success and failure scenarios

### Don'ts
❌ Block app startup for non-critical features
❌ Forget to clean up effects (memory leaks)
❌ Ignore bootstrap errors silently
❌ Use synchronous initialization for async operations
❌ Initialize features in wrong order (dependency issues)
❌ Throw errors for recoverable failures
❌ Skip bootstrap testing

---

## Timing Considerations

### Effect-Based Waiting

**Why**: Stores use signals for reactive state. Effects watch signal changes and resolve when complete.

**Pattern**:
```typescript
private async waitForInit(): Promise<void> {
  return new Promise((resolve) => {
    const effectRef = effect(() => {
      const isLoading = this.store.isLoading();
      if (!isLoading) {
        effectRef.destroy();  // IMPORTANT: Clean up
        resolve();
      }
    });
  });
}
```

**Common Mistake**: Forgetting to destroy the effect leads to memory leaks and continued signal watching after resolution.

### Timeout Considerations

For production, consider adding timeouts to prevent infinite waiting:

```typescript
private async waitForInit(timeoutMs = 10000): Promise<void> {
  return Promise.race([
    new Promise((resolve) => {
      const effectRef = effect(() => {
        const isLoading = this.store.isLoading();
        if (!isLoading) {
          effectRef.destroy();
          resolve(undefined);
        }
      });
    }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Bootstrap timeout')), timeoutMs)
    )
  ]);
}
```

---

## Integration with APP_INITIALIZER

The bootstrap service is typically called from Angular's `APP_INITIALIZER` token:

```typescript
// In app.config.ts
export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: APP_INITIALIZER,
      useFactory: (bootstrap: AppBootstrapService) => () => bootstrap.bootstrap(),
      deps: [AppBootstrapService],
      multi: true
    },
    // ... other providers
  ]
};
```

This ensures bootstrap completes before Angular initializes components.

---

## Related Documentation

- [STATE_STANDARDS.md](../../state-standards/references/STATE_STANDARDS.md) - Store patterns and effect usage (`state-standards` skill)
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) - General coding patterns
- [DeviceBootstrapService](../../../../libs/app/bootstrap/src/lib/device-bootstrap.service.ts) - Reference implementation
- [Angular APP_INITIALIZER](https://angular.io/api/core/APP_INITIALIZER) - Official Angular documentation
