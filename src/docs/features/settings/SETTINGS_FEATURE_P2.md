# Phase 2: Domain Contracts & Infrastructure Layer

## 🎯 Objective

Define domain-layer contracts for settings services and implement the infrastructure-layer service that communicates with the backend API. This establishes Clean Architecture boundaries by creating domain interfaces (contracts) and infrastructure implementations that map API DTOs to domain models. The infrastructure service will be injected into the application layer (Phase 3) via dependency injection tokens.

---

## 📚 Required Reading

> Review these documents before starting implementation. Check the boxes as you read them.

**Feature Documentation:**

- [ ] [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md) - High-level feature overview and architecture
- [ ] [Phase 1 Completion](./SETTINGS_FEATURE_P1.md) - API client generation (prerequisite)

**Standards & Guidelines:**

- [ ] [Coding Standards](../../CODING_STANDARDS.md) - General coding patterns and conventions
- [ ] [Domain Standards](../../DOMAIN_STANDARDS.md) - Domain layer patterns and contracts
- [ ] [Service Standards](../../SERVICE_STANDARDS.md) - Service implementation patterns
- [ ] [NX Library Standards](../../NX_LIBRARY_STANDARDS.md) - Library organization
- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches by layer

---

## 📂 File Structure Overview

> New domain contracts and infrastructure implementation.

```
libs/domain/src/lib/settings/
├── index.ts                                  ✨ New - Barrel export for settings domain
├── settings.contract.ts                      ✨ New - ISettingsService interface
├── settings.models.ts                        ✨ New - Domain models (Settings, PlayerSettings, etc.)
├── settings.tokens.ts                        ✨ New - DI injection token for ISettingsService
└── settings.mappers.ts                       ✨ New - Optional mapper interfaces (if needed)

libs/infrastructure/src/lib/settings/
├── index.ts                                  ✨ New - Barrel export for settings infrastructure
├── settings.service.ts                       ✨ New - SettingsService implementation
└── settings.mappers.ts                       ✨ New - DTO-to-domain mapping functions

libs/infrastructure/src/index.ts              📝 Modified - Export settings infrastructure
```

---

<details open>
<summary><h3>Task 1: Define Domain Models</h3></summary>

**Purpose**: Create TypeScript interfaces representing settings in the domain layer. These models are framework-agnostic and represent the business concepts independent of API DTOs or Angular specifics.

**Related Documentation:**

- [Settings Feature Plan - Phase 2](./SETTINGS_FEATURE_PLAN.md#phase-2-domain-contracts--infrastructure-layer) - Domain model specifications
- [Domain Standards](../../DOMAIN_STANDARDS.md) - Domain layer patterns
- [Coding Standards - TypeScript Interfaces](../../CODING_STANDARDS.md#typescript-conventions) - Interface naming conventions

**Implementation Subtasks:**

- [ ] **Create settings.models.ts**: New file in `libs/domain/src/lib/settings/`
- [ ] **Define Settings interface**: Root interface containing all settings sections
- [ ] **Define PlayerSettings interface**: Includes `repeatMode`, `sidTimerSeconds`, `sidAutoAdvance`, `launchOnStartup`
- [ ] **Define FileTransferSettings interface**: Includes `watchFoldersEnabled`, `watchFolders`, `autoLaunchTransferred`
- [ ] **Define SearchSettings interface**: Includes `weights`, `stopWords`, `enableMetadataSearch`, `showHiddenFiles`
- [ ] **Define SearchWeights interface**: Nested object for search weight values
- [ ] **Define AppSettings interface**: Includes `setupCompleted`
- [ ] **Define RepeatMode type**: Union type `'Off' | 'Single' | 'All'`
- [ ] **Add JSDoc comments**: Document purpose of each interface and property

**Testing Subtask:**

- [ ] **Write Model Tests**: Create type-checking tests that validate model structure (see Testing section)

**Key Implementation Notes:**

- Use TypeScript interfaces (not classes) following existing domain patterns
- All properties should be required unless business logic demands optionality
- Avoid any framework-specific types (no Angular, no RxJS in domain layer)
- Use descriptive property names that match business terminology
- Domain models may differ from DTOs if business needs require it (though they'll be similar here)

**Critical Type Structure** (example only):

```typescript
// Example: Settings interface structure
export interface Settings {
  player: PlayerSettings;
  fileTransfer: FileTransferSettings;
  search: SearchSettings;
  app: AppSettings;
}

export type RepeatMode = 'Off' | 'Single' | 'All';
```

**Testing Focus for Task 1:**

> Focus on **type correctness** - ensure domain models are structurally sound.

**Behaviors to Test:**

- [ ] All interfaces are exportable and usable
- [ ] RepeatMode type restricts to valid values
- [ ] Nested interfaces (SearchWeights) are properly typed
- [ ] Array properties (watchFolders, stopWords) are correctly typed
- [ ] Models compile without TypeScript errors

**Model Type Tests:**

```typescript
describe('Settings Domain Models', () => {
  it('should create valid Settings object', () => {
    const settings: Settings = {
      player: {
        repeatMode: 'Off',
        sidTimerSeconds: 180,
        sidAutoAdvance: false,
        launchOnStartup: false
      },
      // ... other sections
    };
    expect(settings).toBeDefined();
  });

  it('should restrict RepeatMode to valid values', () => {
    const validMode: RepeatMode = 'All';
    // @ts-expect-error - Invalid value should fail type check
    const invalidMode: RepeatMode = 'Invalid';
  });
});
```

</details>

<details open>
<summary><h3>Task 2: Define Domain Service Contract</h3></summary>

**Purpose**: Create the `ISettingsService` interface that defines the contract for settings operations. This interface lives in the domain layer and will be implemented by infrastructure but consumed by application layer.

**Related Documentation:**

- [Domain Standards - Service Contracts](../../DOMAIN_STANDARDS.md#service-contracts) - Contract definition patterns
- [Service Standards](../../SERVICE_STANDARDS.md) - Service interface conventions
- [Settings Feature Plan - Phase 2](./SETTINGS_FEATURE_PLAN.md#phase-2-domain-contracts--infrastructure-layer) - Service operations

**Implementation Subtasks:**

- [ ] **Create settings.contract.ts**: New file in `libs/domain/src/lib/settings/`
- [ ] **Define ISettingsService interface**: Service contract with method signatures
- [ ] **Add getSettings method**: Returns `Observable<Settings>` for loading settings
- [ ] **Add saveSettings method**: Accepts `Settings` parameter, returns `Observable<void>`
- [ ] **Add JSDoc comments**: Document method purpose, parameters, and return values
- [ ] **Document error handling**: Note expected error behaviors in JSDoc

**Testing Subtask:**

- [ ] **Write Contract Tests**: Verify interface structure and type signatures (see Testing section)

**Key Implementation Notes:**

- Use RxJS `Observable` for asynchronous operations (standard for Angular services)
- Methods should be simple and focused (single responsibility)
- Avoid implementation details in contract (no HTTP, no caching logic)
- Contract represents "what" the service does, not "how" it does it
- Error handling is implementation detail (document expected behavior in JSDoc)

**Critical Interface** (example only):

```typescript
export interface ISettingsService {
  /**
   * Loads current settings from persistence layer.
   * @returns Observable emitting Settings on success, error on failure
   */
  getSettings(): Observable<Settings>;

  /**
   * Saves settings to persistence layer.
   * @param settings - Settings to save
   * @returns Observable completing on success, error on failure
   */
  saveSettings(settings: Settings): Observable<void>;
}
```

**Testing Focus for Task 2:**

> Focus on **contract correctness** - ensure interface is well-defined.

**Behaviors to Test:**

- [ ] Interface exports correctly from domain layer
- [ ] Method signatures use correct types (Observable, Settings)
- [ ] Interface is usable in application layer (no dependency issues)
- [ ] TypeScript compiler accepts mock implementations

**Contract Type Tests:**

```typescript
describe('ISettingsService Contract', () => {
  it('should be implementable with correct signatures', () => {
    const mockService: ISettingsService = {
      getSettings: () => of({} as Settings),
      saveSettings: (settings: Settings) => of(void 0)
    };
    expect(mockService).toBeDefined();
  });
});
```

</details>

<details open>
<summary><h3>Task 3: Create Dependency Injection Token</h3></summary>

**Purpose**: Create an Angular injection token that allows the infrastructure implementation to be injected into application layer services. This maintains Clean Architecture by preventing direct infrastructure dependencies.

**Related Documentation:**

- [Domain Standards - Injection Tokens](../../DOMAIN_STANDARDS.md#injection-tokens) - Token creation patterns
- [Coding Standards - Dependency Injection](../../CODING_STANDARDS.md#dependency-injection) - DI conventions

**Implementation Subtasks:**

- [ ] **Create settings.tokens.ts**: New file in `libs/domain/src/lib/settings/`
- [ ] **Define SETTINGS_SERVICE_TOKEN**: `InjectionToken<ISettingsService>`
- [ ] **Add token description**: Use descriptive string for debugging/error messages
- [ ] **Export token**: Make available for infrastructure and application layers

**Testing Subtask:**

- [ ] **Write Token Tests**: Verify token is injectable (see Testing section)

**Key Implementation Notes:**

- Use descriptive token name matching the interface (e.g., "ISettingsService")
- Token must be exported from domain layer barrel export (index.ts)
- Token is generic over the interface type (`InjectionToken<ISettingsService>`)
- Token will be provided in infrastructure layer (Phase 2, Task 5)

**Critical Token Definition** (example only):

```typescript
export const SETTINGS_SERVICE_TOKEN = new InjectionToken<ISettingsService>(
  'ISettingsService',
  {
    providedIn: 'root',
    factory: () => {
      throw new Error('SETTINGS_SERVICE_TOKEN must be provided');
    }
  }
);
```

**Testing Focus for Task 3:**

> Focus on **token usability** - ensure token is properly defined and injectable.

**Behaviors to Test:**

- [ ] Token is defined and exported correctly
- [ ] Token type matches interface type
- [ ] Token can be injected in test environment
- [ ] Token provides clear error if not provided

**Token Tests:**

```typescript
describe('SETTINGS_SERVICE_TOKEN', () => {
  it('should be defined', () => {
    expect(SETTINGS_SERVICE_TOKEN).toBeDefined();
  });

  it('should throw error if not provided', () => {
    TestBed.configureTestingModule({});
    expect(() => TestBed.inject(SETTINGS_SERVICE_TOKEN)).toThrow();
  });
});
```

</details>

<details open>
<summary><h3>Task 4: Implement DTO-to-Domain Mappers</h3></summary>

**Purpose**: Create mapping functions that convert API DTOs (from Phase 1) to domain models and vice versa. These mappers isolate the domain layer from API representation changes.

**Related Documentation:**

- [Service Standards - Mapping Patterns](../../SERVICE_STANDARDS.md#mapping-patterns) - Mapper function conventions
- [Coding Standards - Pure Functions](../../CODING_STANDARDS.md#pure-functions) - Function patterns

**Implementation Subtasks:**

- [ ] **Create infrastructure/settings.mappers.ts**: New file in `libs/infrastructure/src/lib/settings/`
- [ ] **Implement mapSettingsDtoToDomain**: Converts `SettingsDto` to `Settings`
- [ ] **Implement mapSettingsDomainToDto**: Converts `Settings` to `SettingsDto`
- [ ] **Handle enum mapping**: Map `RepeatMode` between DTO and domain types
- [ ] **Handle nested objects**: Properly map `SearchWeights` and collections
- [ ] **Add null safety**: Handle potential null/undefined values from API
- [ ] **Add mapper tests**: Test bidirectional mapping (see Testing section)

**Testing Subtask:**

- [ ] **Write Mapper Tests**: Test DTO-to-domain and domain-to-DTO conversions (see Testing section)

**Key Implementation Notes:**

- Mappers are pure functions (no side effects, no dependencies)
- Handle type conversions if DTO and domain types differ
- Validate that mappings are reversible (round-trip should work)
- Consider defensive copying if domain objects should be immutable
- Mapper functions should be simple and maintainable

**Mapper Function Example** (pattern only):

```typescript
export function mapSettingsDtoToDomain(dto: SettingsDto): Settings {
  return {
    player: {
      repeatMode: dto.player.repeatMode as RepeatMode,
      sidTimerSeconds: dto.player.sidTimerSeconds,
      sidAutoAdvance: dto.player.sidAutoAdvance,
      launchOnStartup: dto.player.launchOnStartup
    },
    // ... other sections
  };
}
```

**Testing Focus for Task 4:**

> Focus on **mapping correctness** - ensure DTOs convert to domain models accurately.

**Behaviors to Test:**

- [ ] DTO maps to domain model with all properties preserved
- [ ] Domain model maps back to DTO with all properties preserved
- [ ] Round-trip conversion produces identical result
- [ ] Enum values map correctly (RepeatMode)
- [ ] Nested objects map correctly (SearchWeights)
- [ ] Arrays map correctly (watchFolders, stopWords)
- [ ] Null/undefined values handled gracefully

**Mapper Tests:**

```typescript
describe('Settings Mappers', () => {
  describe('mapSettingsDtoToDomain', () => {
    it('should convert DTO to domain model', () => {
      const dto: SettingsDto = createTestDto();
      const domain = mapSettingsDtoToDomain(dto);
      expect(domain.player.repeatMode).toBe('Off');
      expect(domain.player.sidTimerSeconds).toBe(180);
    });
  });

  describe('mapSettingsDomainToDto', () => {
    it('should convert domain model to DTO', () => {
      const domain: Settings = createTestSettings();
      const dto = mapSettingsDomainToDto(domain);
      expect(dto.player.repeatMode).toBe('Off');
    });
  });

  describe('round-trip conversion', () => {
    it('should preserve data through DTO->domain->DTO', () => {
      const original: SettingsDto = createTestDto();
      const domain = mapSettingsDtoToDomain(original);
      const final = mapSettingsDomainToDto(domain);
      expect(final).toEqual(original);
    });
  });
});
```

</details>

<details open>
<summary><h3>Task 5: Implement Infrastructure Settings Service</h3></summary>

**Purpose**: Create the `SettingsService` class that implements `ISettingsService` by calling the generated API client and mapping DTOs to domain models. This service lives in the infrastructure layer and handles HTTP communication.

**Related Documentation:**

- [Service Standards - Infrastructure Services](../../SERVICE_STANDARDS.md#infrastructure-layer) - Service implementation patterns
- [Coding Standards - Services](../../CODING_STANDARDS.md#services) - Service class conventions
- [Settings Feature Plan - Phase 2](./SETTINGS_FEATURE_PLAN.md#phase-2-domain-contracts--infrastructure-layer) - Service implementation details

**Implementation Subtasks:**

- [ ] **Create infrastructure/settings.service.ts**: New file in `libs/infrastructure/src/lib/settings/`
- [ ] **Define SettingsService class**: Implements `ISettingsService` interface
- [ ] **Inject SettingsApiService**: Constructor injects generated API client
- [ ] **Implement getSettings method**: Call API client, map DTO to domain, return Observable
- [ ] **Implement saveSettings method**: Map domain to DTO, call API client, return Observable
- [ ] **Add error handling**: Transform API errors to domain-friendly errors if needed
- [ ] **Add providedIn root**: Make service tree-shakable and singleton
- [ ] **Export from barrel**: Add to infrastructure layer index.ts

**Testing Subtask:**

- [ ] **Write Service Tests**: Test service methods with mocked API client (see Testing section)

**Key Implementation Notes:**

- Service uses constructor injection for dependencies
- Use RxJS operators (`map`, `catchError`) for stream transformations
- Don't catch errors unless transforming them (let errors propagate)
- Service should be stateless (no instance variables except dependencies)
- Use Angular's `inject()` function for modern DI patterns if preferred

**Service Class Pattern** (structure only):

```typescript
@Injectable({ providedIn: 'root' })
export class SettingsService implements ISettingsService {
  private readonly apiClient = inject(SettingsApiService);

  getSettings(): Observable<Settings> {
    return this.apiClient.getSettings().pipe(
      map(dto => mapSettingsDtoToDomain(dto))
    );
  }

  saveSettings(settings: Settings): Observable<void> {
    const dto = mapSettingsDomainToDto(settings);
    return this.apiClient.saveSettings(dto);
  }
}
```

**Testing Focus for Task 5:**

> Focus on **service behavior** - ensure service correctly orchestrates API calls and mapping.

**Behaviors to Test:**

- [ ] `getSettings()` calls API client's `getSettings()` method
- [ ] `getSettings()` maps DTO to domain model using mapper
- [ ] `getSettings()` returns Observable with domain model
- [ ] `saveSettings()` maps domain model to DTO using mapper
- [ ] `saveSettings()` calls API client's `saveSettings()` method
- [ ] `saveSettings()` completes Observable on success
- [ ] API errors propagate through service methods
- [ ] Service is injectable and implements contract correctly

**Service Tests:**

```typescript
describe('SettingsService', () => {
  let service: SettingsService;
  let apiClient: jasmine.SpyObj<SettingsApiService>;

  beforeEach(() => {
    const apiClientSpy = jasmine.createSpyObj('SettingsApiService', [
      'getSettings',
      'saveSettings'
    ]);

    TestBed.configureTestingModule({
      providers: [
        SettingsService,
        { provide: SettingsApiService, useValue: apiClientSpy }
      ]
    });

    service = TestBed.inject(SettingsService);
    apiClient = TestBed.inject(SettingsApiService) as jasmine.SpyObj<SettingsApiService>;
  });

  describe('getSettings', () => {
    it('should call API client and map result to domain', (done) => {
      const dto: SettingsDto = createTestDto();
      apiClient.getSettings.and.returnValue(of(dto));

      service.getSettings().subscribe({
        next: (settings) => {
          expect(apiClient.getSettings).toHaveBeenCalled();
          expect(settings.player.repeatMode).toBe('Off');
          done();
        }
      });
    });

    it('should propagate API errors', (done) => {
      const error = new Error('API Error');
      apiClient.getSettings.and.returnValue(throwError(() => error));

      service.getSettings().subscribe({
        error: (err) => {
          expect(err).toBe(error);
          done();
        }
      });
    });
  });

  describe('saveSettings', () => {
    it('should map domain model and call API client', (done) => {
      const settings: Settings = createTestSettings();
      apiClient.saveSettings.and.returnValue(of(void 0));

      service.saveSettings(settings).subscribe({
        complete: () => {
          expect(apiClient.saveSettings).toHaveBeenCalled();
          done();
        }
      });
    });
  });
});
```

</details>

<details open>
<summary><h3>Task 6: Provide Infrastructure Service</h3></summary>

**Purpose**: Configure Angular dependency injection to provide the infrastructure service implementation when the domain contract token is requested. This allows application layer to depend on domain contract while receiving infrastructure implementation.

**Related Documentation:**

- [Coding Standards - Dependency Injection](../../CODING_STANDARDS.md#dependency-injection) - Provider configuration
- [Service Standards - Token Providers](../../SERVICE_STANDARDS.md#token-providers) - Provider patterns

**Implementation Subtasks:**

- [ ] **Update infrastructure index.ts**: Export `provideSettingsService` function
- [ ] **Create provider function**: Define `provideSettingsService()` that returns provider config
- [ ] **Configure token provider**: Map `SETTINGS_SERVICE_TOKEN` to `SettingsService` class
- [ ] **Document provider usage**: Add JSDoc explaining how to use in app config
- [ ] **Test provider**: Verify injection works correctly (see Testing section)

**Testing Subtask:**

- [ ] **Write Provider Tests**: Test that token resolves to service implementation (see Testing section)

**Key Implementation Notes:**

- Use functional provider pattern (`provideX` functions) following Angular modern practices
- Provider should return `EnvironmentProviders` or `Provider` type
- Document provider usage for application configuration
- Provider will be used in app bootstrap configuration (Phase 4)

**Provider Function Pattern** (example only):

```typescript
export function provideSettingsService(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: SETTINGS_SERVICE_TOKEN,
      useClass: SettingsService
    }
  ]);
}
```

**Testing Focus for Task 6:**

> Focus on **DI configuration** - ensure token resolves to implementation correctly.

**Behaviors to Test:**

- [ ] Provider function returns valid provider configuration
- [ ] Token resolves to SettingsService instance
- [ ] Injected service implements ISettingsService contract
- [ ] Multiple injections return same instance (singleton)
- [ ] Service is usable through token injection

**Provider Tests:**

```typescript
describe('provideSettingsService', () => {
  it('should provide SettingsService for SETTINGS_SERVICE_TOKEN', () => {
    TestBed.configureTestingModule({
      providers: [provideSettingsService()]
    });

    const service = TestBed.inject(SETTINGS_SERVICE_TOKEN);
    expect(service).toBeInstanceOf(SettingsService);
  });

  it('should provide singleton instance', () => {
    TestBed.configureTestingModule({
      providers: [provideSettingsService()]
    });

    const service1 = TestBed.inject(SETTINGS_SERVICE_TOKEN);
    const service2 = TestBed.inject(SETTINGS_SERVICE_TOKEN);
    expect(service1).toBe(service2);
  });
});
```

</details>

<details open>
<summary><h3>Task 7: Export Domain and Infrastructure Artifacts</h3></summary>

**Purpose**: Update barrel exports to make domain contracts and infrastructure implementations available to other layers. This ensures proper module boundaries and clean imports.

**Related Documentation:**

- [NX Library Standards - Exports](../../NX_LIBRARY_STANDARDS.md#exports) - Barrel export patterns
- [Coding Standards - Module Organization](../../CODING_STANDARDS.md#module-organization) - Export conventions

**Implementation Subtasks:**

- [ ] **Update domain/settings/index.ts**: Export all domain artifacts (models, contract, token)
- [ ] **Update domain/index.ts**: Re-export settings domain from root barrel
- [ ] **Update infrastructure/settings/index.ts**: Export service and provider function
- [ ] **Update infrastructure/index.ts**: Re-export settings infrastructure from root barrel
- [ ] **Verify no circular dependencies**: Check import graph for cycles
- [ ] **Test imports**: Verify other layers can import cleanly

**Testing Subtask:**

- [ ] **Write Import Tests**: Test that exports are accessible from other layers (see Testing section)

**Key Implementation Notes:**

- Use explicit named exports (avoid `export *` which can cause issues)
- Domain layer should not export infrastructure implementations
- Infrastructure layer exports both service and provider function
- Maintain clear separation between domain and infrastructure exports
- Consider what should be public API vs internal implementation

**Barrel Export Pattern** (example only):

```typescript
// libs/domain/src/lib/settings/index.ts
export * from './settings.models';
export * from './settings.contract';
export * from './settings.tokens';

// libs/infrastructure/src/lib/settings/index.ts
export * from './settings.service';
export { provideSettingsService } from './settings.service';
```

**Testing Focus for Task 7:**

> Focus on **module boundaries** - ensure exports follow Clean Architecture.

**Behaviors to Test:**

- [ ] Domain artifacts importable from domain layer
- [ ] Infrastructure artifacts importable from infrastructure layer
- [ ] No circular dependencies detected
- [ ] Application layer can import domain contracts only
- [ ] Infrastructure can import both domain and infrastructure

**Export Tests:**

```typescript
describe('Settings Module Exports', () => {
  it('should export domain models from domain layer', () => {
    // This test verifies imports work
    const settings: Settings = {} as Settings;
    expect(settings).toBeDefined();
  });

  it('should export service contract from domain layer', () => {
    const service: ISettingsService = {} as ISettingsService;
    expect(service).toBeDefined();
  });

  it('should export service implementation from infrastructure layer', () => {
    expect(SettingsService).toBeDefined();
  });

  it('should export provider function from infrastructure layer', () => {
    expect(provideSettingsService).toBeDefined();
  });
});
```

</details>

---

## ✅ Success Criteria

> Mark these checkboxes as you validate each criterion.

- [ ] **Domain Models Defined**: All settings interfaces exist in domain layer
- [ ] **Service Contract Defined**: `ISettingsService` interface complete with method signatures
- [ ] **Injection Token Created**: `SETTINGS_SERVICE_TOKEN` defined and usable
- [ ] **Mappers Implemented**: Bidirectional DTO-domain mapping works correctly
- [ ] **Service Implemented**: `SettingsService` implements contract and calls API client
- [ ] **Provider Configured**: Token resolves to service implementation
- [ ] **Exports Complete**: All artifacts properly exported from barrel files
- [ ] **All Tests Pass**: Unit tests for models, mappers, service pass
- [ ] **No Circular Dependencies**: Import graph is clean
- [ ] **TypeScript Compiles**: No compilation errors in domain or infrastructure layers

---

## 🧪 Testing Summary

### Testing Approach

This phase focuses on **unit testing domain contracts and infrastructure implementation**:

1. **Type Tests**: Validate domain model structures
2. **Mapper Tests**: Test bidirectional DTO-domain conversions
3. **Service Tests**: Test service behavior with mocked API client
4. **Provider Tests**: Test DI configuration
5. **Export Tests**: Verify module boundaries

### Test Types by Task

| Task | Test Type | Focus |
|------|-----------|-------|
| Task 1 | Type Checking | Model structure validation |
| Task 2 | Type Checking | Contract definition validation |
| Task 3 | Unit | Token configuration |
| Task 4 | Unit | Mapper correctness |
| Task 5 | Unit | Service behavior with mocked dependencies |
| Task 6 | Integration | DI provider configuration |
| Task 7 | Integration | Module boundary validation |

### Testing Standards Reference

- Follow [Testing Standards](../../TESTING_STANDARDS.md) for behavioral testing approach
- Use [Service Standards](../../SERVICE_STANDARDS.md) for service testing patterns
- Mock at infrastructure boundary (API client is mocked in service tests)

---

## 📝 Implementation Notes

> Track discoveries, decisions, and issues encountered during implementation.

### Discoveries During Implementation

- [Add notes here as you implement]

### Blockers & Questions

- [Document any blockers or questions here]

### Deviations from Plan

- [Note any changes from the original plan and why]

---

## 🔗 Related Documentation

- **Previous Phase**: [Phase 1 - Backend API & Type Generation](./SETTINGS_FEATURE_P1.md)
- **Next Phase**: [Phase 3 - Settings Store (Application Layer)](./SETTINGS_FEATURE_P3.md)
- **Feature Overview**: [Settings Feature Plan](./SETTINGS_FEATURE_PLAN.md)
- **Architecture**: [Overview Context](../../OVERVIEW_CONTEXT.md)
- **Domain Patterns**: [Domain Standards](../../DOMAIN_STANDARDS.md)
- **Service Patterns**: [Service Standards](../../SERVICE_STANDARDS.md)

---

_Phase Status: Ready for Implementation_
_Last Updated: 2025-01-11_
_Estimated Effort: 3-4 hours_
