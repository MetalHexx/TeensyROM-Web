# TeensyROM Angular Nx Monorepo Context & Architecture

## Project Overview

This is a **hybrid .NET/Angular application** for TeensyROM device management and media playback. The backend is a .NET 9 Web API using **RadEndpoints** for minimal APIs and **MediatR** for CQRS patterns. The frontend is an **Angular 19 application** built with **Nx monorepo** architecture using **Clean Architecture** principles.

### Technology Stack

**Backend (.NET API)**:

- .NET 9 with RadEndpoints minimal APIs
- MediatR for CQRS patterns
- SignalR for real-time communication
- Scalar API documentation (replaces Swagger)

**Frontend (Angular/Nx)**:

- Angular 19 with standalone components
- Nx workspace with Clean Architecture library organization
- NgRx Signal Store for state management
- Angular Material UI components
- Vitest for unit testing, Cypress for E2E

## Clean Architecture Design

This application follows **Clean Architecture** principles with clear separation of concerns across distinct layers:

### Architecture Layers

1. **Domain Layer** (`libs/domain`) - Pure business logic, contracts, and models
2. **Application Layer** (`libs/application`) - Use cases, state management, and application services
3. **Infrastructure Layer** (`libs/infrastructure`) - External concerns (HTTP clients, SignalR, etc.)
4. **Presentation Layer** (`libs/features`, `libs/ui`) - UI components and user interactions

### Dependency Rules

- **Domain** has no dependencies (pure TypeScript)
- **Application** depends only on Domain
- **Infrastructure** depends on Application and Domain (implements contracts, uses application utilities)
- **Presentation** depends on Application and Domain (not Infrastructure directly)

### Dependency Constraint Enforcement

**ESLint Module Boundaries**: Nx ESLint rules automatically enforce Clean Architecture dependency constraints at build/lint time using project tags:

- **Domain Layer**: `["scope:domain"]` - Cannot depend on any other layers
- **Application Layer**: `["scope:application"]` - Can only depend on domain and shared utilities
- **Infrastructure Layer**: `["scope:infrastructure"]` - Can depend on application, domain, shared, and api-client
- **Features Layer**: `["scope:features", "feature:device|player"]` - Can depend on application, domain, and shared UI (features isolated from each other)
- **App Layer**: `["scope:app"]` - Can import from infrastructure (composition root), features, application, and shared

**Violation Detection**: ESLint will fail builds if any layer imports from forbidden dependencies, preventing architectural violations from entering the codebase.

### Architecture Goals

- Enforce strict dependency boundaries using Clean Architecture principles
- Keep domain logic pure and framework-agnostic (no Angular dependencies in domain)
- Implement dependency inversion with contracts and abstract implementations
- Maintain testable, modular code with clear separation of concerns
- Use dependency injection to wire infrastructure implementations to domain contracts

### Technology Stack

**Backend (.NET API)**:

- .NET 9 with RadEndpoints minimal APIs
- MediatR for CQRS patterns
- SignalR for real-time communication
- Scalar API documentation (replaces Swagger)

**Frontend (Angular/Nx)**:

- Angular 19 with standalone components
- Nx workspace with Clean Architecture library organization
- NgRx Signal Store for state management
- Angular Material UI components
- Vitest for unit testing, Cypress for E2E

---

## Clean Architecture Layer Responsibilities

### 1. Domain Layer (`libs/domain`) - Pure Business Logic

**Purpose**: Contains the core business rules, entities, and contracts that define the application's behavior

- **Models**: Shared domain entities and value objects representing core business concepts (located in `models/` folder)
- **Contracts**: Pure TypeScript interfaces defining service contracts (located in `contracts/` folder)
- **Business Logic**: Pure domain logic and business rules (framework-agnostic)
- **No Dependencies**: Zero external dependencies - pure TypeScript only

**Shared Model Structure**:
All domain models are located in the shared `models/` folder for universal access:

- **Device Models**: `Device`, `DeviceStorage`
- **Storage Models**: `DirectoryItem`, `FileItem`, `ViewableItemImage`, `FileItemType`, `StorageType`, `StorageDirectory`
- **Individual Files**: Each interface/enum is in its own file for better maintainability and tree-shaking

**Shared Contract Structure**:
All domain contracts are located in the shared `contracts/` folder for universal access:

- **Device Contracts**: `IDeviceService`, `IDeviceEventsService`, `IDeviceLogsService` + injection tokens
- **Storage Contracts**: `IStorageService` + injection tokens
- **Individual Files**: Each interface/token is in its own file for better maintainability and tree-shaking

**Contract Examples**:

- `IDeviceService` contract defining device operations
- `IStorageService` contract defining file system operations
- Domain validation rules and business logic

### 2. Application Layer (`libs/application`) - Use Cases & State

**Purpose**: Orchestrates domain objects to perform application use cases and manages application state

- **State Management**: NgRx Signal Stores for reactive application state
- **Use Case Orchestration**: Coordinates domain services to fulfill user requests
- **Application Services**: High-level application logic and workflows
- **Depends Only on Domain**: Uses domain contracts, never infrastructure implementations

**Examples**:

- Device state management with connection workflows
- Storage state management with navigation and file operations
- Application-level orchestration of domain services
- State synchronization and caching logic

### 3. Infrastructure Layer (`libs/infrastructure`) - External Concerns

**Purpose**: Implements domain contracts using external technologies and frameworks

- **Service Implementations**: Concrete implementations of domain service contracts
- **HTTP Clients**: API communication using generated OpenAPI clients
- **SignalR Integration**: Real-time communication implementations
- **Framework Dependencies**: Angular-specific and external library integrations
- **Application Utilities**: Can leverage application layer utilities and patterns when needed

**Examples**:

- `DeviceService` implementing `IDeviceService` using HTTP and SignalR
- `StorageService` implementing `IStorageService` using HTTP API
- Data mapping between API DTOs and domain models
- External service integrations and I/O operations
- Using application-level utilities for common infrastructure patterns

### 4. Presentation Layer (`libs/features`, `libs/ui`) - User Interface

**Purpose**: Handles user interactions and presents data to users

- **Feature Components**: Smart components that coordinate application state and user actions
- **UI Components**: Presentational components for displaying data and capturing input
- **User Workflows**: Complete user interaction flows and navigation
- **Depends on Application**: Uses application state and services (not infrastructure directly)

---

## Implementation Status

### ✅ Completed Clean Architecture Refactor

- **Domain Layer**: Pure TypeScript contracts and models extracted from services
- **Shared Domain Models**: All models moved to shared `models/` folder for universal access
- **Shared Domain Contracts**: All contracts moved to shared `contracts/` folder for universal access
- **Individual Files**: Each model/contract split into own file for better maintainability and tree-shaking
- **Infrastructure Layer**: Concrete service implementations moved from domain
- **Application Layer**: State management and use case orchestration separated
- **Dependency Inversion**: Infrastructure services implement domain contracts
- **Zero Breaking Changes**: All refactors completed with barrel exports maintaining compatibility

### ✅ Completed Features

- **Device Management**: Full discovery, connection, disconnection, and real-time status monitoring
- **SignalR Integration**: Real-time device logs and events with proper connection management
- **OpenAPI Client**: Complete TypeScript client generation with post-processing pipeline
- **Application Shell**: Navigation, layout, header with integrated device state and busy dialogs
- **Clean Architecture**: Proper separation of concerns with dependency inversion
- **State Management**: Application layer Signal Stores for device and storage state

### 🚧 In Progress

- **Storage Navigation**: Directory tree and file listing UI components (scaffolded)
- **File Operations**: Launch, search, and metadata handling functionality
- **Testing Infrastructure**: MSW integration testing and comprehensive test coverage

### 📋 Planned Features

- **Player Controls**: Playback controls, file launching, and media management
- **Settings Domain**: User preferences, application configuration, and persistence
- **DJ Mixer Features**: Advanced audio mixing and MIDI I/O capabilities
- **Theme System**: Complete theming infrastructure and customization
- **File Launch History**: Persistent metadata and usage tracking

---

## Clean Architecture Nx Workspace Structure

```bash
apps/                                           # [group] Applications
├── teensyrom-ui/                               # [app] Main Angular UI (standalone components)
│   └── src/app/
│       ├── app.component.ts                    # [file] Root component with routing
│       ├── app.routes.ts                       # [file] Route configuration (devices, player)
│       └── app.config.ts                       # [file] App providers and DI configuration
└── teensyrom-ui-e2e/                          # [e2e] Cypress end-to-end tests

libs/
├── domain/                                     # 🏛️ [DOMAIN LAYER] - Pure business logic (no dependencies)
│   └── src/lib/                                # [library] Clean domain architecture with shared models and contracts
│       ├── models/                             # [folder] Shared domain models (universal access)
│       │   ├── device.model.ts                 # [file] Device interface
│       │   ├── device-storage.model.ts         # [file] DeviceStorage interface
│       │   ├── directory-item.model.ts         # [file] DirectoryItem interface
│       │   ├── file-item.model.ts              # [file] FileItem interface
│       │   ├── file-item-type.enum.ts          # [file] FileItemType enum
│       │   ├── storage-directory.model.ts      # [file] StorageDirectory interface
│       │   ├── storage-type.enum.ts            # [file] StorageType enum
│       │   ├── viewable-item-image.model.ts    # [file] ViewableItemImage interface
│       │   └── index.ts                        # [file] Models barrel export
│       └── contracts/                          # [folder] Shared domain contracts (universal access)
│           ├── device.contract.ts              # [file] IDeviceService + DEVICE_SERVICE token
│           ├── device-events.contract.ts       # [file] IDeviceEventsService + DEVICE_EVENTS_SERVICE token
│           ├── device-logs.contract.ts         # [file] IDeviceLogsService + DEVICE_LOGS_SERVICE token
│           ├── storage.contract.ts             # [file] IStorageService + STORAGE_SERVICE token
│           ├── device-storage.token.ts         # [file] DEVICE_STORAGE_SERVICE token
│           └── index.ts                        # [file] Contracts barrel export

├── application/                                # 🎯 [APPLICATION LAYER] - Use cases and state management
│   └── src/lib/                                # [library] Application services and state orchestration
│       ├── device/                             # [folder] Device use cases and state
│       │   ├── device-store.ts                 # [file] NgRx Signal Store for device state
│       │   └── methods/                        # [folder] Device use case methods
│       │       ├── connect-device.ts           # [file] Device connection use case
│       │       ├── disconnect-device.ts        # [file] Device disconnection use case
│       │       ├── find-devices.ts             # [file] Device discovery use case
│       │       ├── index-all-storage.ts        # [file] Bulk storage indexing use case
│       │       ├── index-storage.ts            # [file] Storage indexing use case
│       │       ├── ping-devices.ts             # [file] Device connectivity checking
│       │       ├── reset-all-devices.ts        # [file] Bulk device reset use case
│       │       └── index.ts                    # [file] Use case method exports
│       └── storage/                            # [folder] Storage use cases and state
│           ├── storage-store.ts                # [file] NgRx Signal Store for storage state
│           ├── storage-key.util.ts             # [file] Storage key utilities for composite keys
│           ├── storage-helpers.ts              # [file] State update helpers shared across actions
│           ├── actions/                        # [folder] Storage use case actions
│           │   ├── initialize-storage.ts       # [file] Storage initialization use case
│           │   ├── navigate-directory-backward.ts # [file] Backward navigation use case
│           │   ├── navigate-directory-forward.ts # [file] Forward navigation use case
│           │   ├── navigate-to-directory.ts    # [file] Direct navigation use case
│           │   ├── navigate-up-one-directory.ts # [file] Parent navigation use case
│           │   ├── refresh-directory.ts        # [file] Directory refresh use case
│           │   ├── remove-all-storage.ts       # [file] Bulk storage cleanup use case
│           │   ├── remove-storage.ts           # [file] Storage cleanup use case
│           │   └── index.ts                    # [file] Use case action exports
│           └── selectors/                      # [folder] Storage state selectors
│               ├── get-device-directories.ts   # [file] Device directory selection logic
│               ├── get-device-storage-entries.ts # [file] Storage entry retrieval selectors
│               ├── get-selected-directory-for-device.ts # [file] Device-specific selection
│               ├── get-selected-directory-state.ts # [file] Directory state selectors
│               └── index.ts                    # [file] Selector exports

├── infrastructure/                             # 🔧 [INFRASTRUCTURE LAYER] - External integrations
│   └── src/lib/                                # [library] Concrete service implementations
│       ├── device/                             # [folder] Device infrastructure services
│       │   ├── device.service.ts               # [file] DeviceService implementing IDeviceService
│       │   ├── device.mapper.ts                # [file] API DTO ↔ Domain model mapping
│       │   ├── device-logs.service.ts          # [file] SignalR device logs service
│       │   ├── device-events.service.ts        # [file] SignalR device events service
│       │   ├── providers.ts                    # [file] DI providers for device services
│       │   └── *.spec.ts                       # [files] Infrastructure service tests
│       └── storage/                            # [folder] Storage infrastructure services
│           ├── storage.service.ts              # [file] StorageService implementing IStorageService
│           ├── storage.mapper.ts               # [file] API DTO ↔ Domain model mapping
│           ├── providers.ts                    # [file] DI providers for storage services
│           └── *.spec.ts                       # [files] Infrastructure service tests

├── app/                                        # 📱 [PRESENTATION LAYER] - App-level concerns
│   ├── bootstrap/                              # [library] App initialization and startup
│   │   └── app-bootstrap.service.ts            # [file] Application startup orchestration
│   ├── navigation/                             # [library] Navigation service and utilities
│   └── shell/                                  # [library] Layout components and app shell
│       ├── layout.component.ts                 # [file] Main layout with navigation
│       ├── header/                             # [component] App header with device status
│       ├── nav-menu/                           # [component] Side navigation menu
│       └── busy-dialog/                        # [component] Loading dialogs for operations

├── features/                                   # 🎨 [PRESENTATION LAYER] - Feature UI components
│   ├── devices/                                # [library] Device management UI
│   │   ├── device-view.component.ts            # [file] Main device list view with toolbar
│   │   ├── device-item/                        # [component] Individual device card display
│   │   ├── device-logs/                        # [component] Real-time device log display
│   │   └── device-toolbar/                     # [component] Device management actions
│   └── player/                                 # [library] Player UI with storage navigation
│       ├── player-view.component.ts            # [file] Main player view with device containers
│       └── player-device-container/            # [component] Device-specific player interface
│           ├── storage-container/              # [component] File browser container
│           │   ├── directory-tree/             # [component] Folder tree navigation
│           │   ├── directory-files/            # [component] File listing display
│           │   └── search-toolbar/             # [component] File search UI
│           ├── file-image/                     # [component] Image file preview
│           ├── file-other/                     # [component] Generic file display
│           └── player-toolbar/                 # [component] Playback controls

├── ui/                                         # 🎨 [PRESENTATION LAYER] - Pure presentational components
│   ├── components/                             # [library] Reusable presentational components (no business logic)
│   │   ├── action-button/                      # [component] Configurable action button with variants and colors
│   │   ├── card-layout/                        # [component] Flexible card layout container
│   │   ├── compact-card-layout/                # [component] Dense card layout for lists
│   │   ├── icon-button/                        # [component] Icon-only button variations
│   │   ├── icon-label/                         # [component] Icon with label display utility
│   │   ├── input-field/                        # [component] Styled input field with validation states
│   │   ├── menu-item/                          # [component] Consistent menu item presentation
│   │   ├── status-icon-label/                  # [component] Status indicators with icons and labels
│   │   └── styled-icon/                        # [component] Configurable icon component with theming
│   └── styles/                                 # [library] Design system, theming, and style utilities
│       ├── theme/                              # [folder] SCSS design tokens and Material theme customization
│       ├── theme-service/                      # [service] Theme management and persistence service

├── utils/                                      # 🛠️ [SHARED] - Cross-cutting utilities
│   ├── log-helper.ts                           # [file] Logging utilities (info, warn, error)
│   └── store-helper.ts                         # [file] Store action message generation utilities

└── data-access/                                # 🌐 [DATA ACCESS LAYER] - External API integration
    └── api-client/                             # [library] Generated OpenAPI TypeScript client
        ├── apis/                               # [folder] Generated API services (*ApiService naming)
        │   ├── DevicesApiService.ts            # [file] Device API client (post-processed naming)
        │   ├── FilesApiService.ts              # [file] Storage/Files API client
        │   └── PlayerApiService.ts             # [file] Player API client
        ├── models/                             # [folder] Generated DTO models and types
        ├── scripts/                            # [folder] OpenAPI generation and post-processing scripts
        └── runtime.ts                          # [file] Generated runtime configuration
```

---

## Clean Architecture Development Patterns & Standards

### Clean Architecture Principles

- **Dependency Inversion**: Infrastructure implements domain contracts, not the reverse
- **Layer Isolation**: Each layer only depends on inner layers (Domain ← Application ← Infrastructure/Presentation)
- **Framework Independence**: Domain layer has zero framework dependencies (pure TypeScript)
- **Testability**: Mock domain contracts for unit tests, not concrete implementations

### Angular 19 Modern Patterns

- **Standalone Components**: All components use standalone architecture with direct imports
- **Modern Control Flow**: Uses `@if`, `@for`, `@switch` instead of structural directives
- **Signal-based APIs**: Prefers `input()` and `output()` over `@Input()` and `@Output()`
- **Signal State Management**: NgRx Signal Store for reactive state with computed selectors

### Domain Layer Standards

- **Pure TypeScript**: No Angular, RxJS, or external dependencies in domain layer
- **Contracts First**: Define service interfaces before implementations
- **Domain Models**: Rich domain entities with business logic (when applicable)
- **Framework Agnostic**: Domain logic should work in any TypeScript environment
- **Model Organization**: Shared `models/` and `contracts/` folders for universal access and cross-domain reuse
- **Cross-Domain Reuse**: Models designed for reusability across multiple domain contracts

### Application Layer Patterns

- **Use Case Orchestration**: Coordinate domain services to fulfill business requirements
- **State Management**: NgRx Signal Store managing application state and side effects
- **Dependency on Contracts**: Import domain contracts, never infrastructure implementations
- **Business Workflows**: High-level application logic and user journey orchestration

### Infrastructure Layer Implementation

- **Contract Implementation**: Concrete classes implementing domain service contracts
- **External Integration**: HTTP clients, SignalR, file system, database access
- **Data Mapping**: Transform external data (API DTOs) to/from domain models
- **Framework Specific**: Angular services, RxJS, HTTP client integrations
- **Application Utilities**: Can depend on and use application layer utilities and patterns

### UI Layer Principles

- **Pure Presentation**: UI components contain no business logic or state management
- **Configurable**: Components accept inputs for all visual and behavioral variations
- **Composable**: Small, focused components that can be combined for complex UIs
- **Accessible**: Built-in accessibility features and ARIA support
- **Themeable**: Consistent design system with dark/light theme support
- **Framework Agnostic Logic**: Theme and styling logic separated from Angular-specific code

**📖 Documentation**: Run `pnpm component-docs list` (or see the `component-library` skill) for the complete component catalog and [STYLE_GUIDE.md](STYLE_GUIDE.md) for global styles and utility classes

### Dependency Injection Patterns

- **Provider Configuration**: Configure DI to bind domain contracts to infrastructure implementations
- **Injection Tokens**: Use Angular injection tokens for loose coupling
- **Service Registration**: Register services at appropriate levels (root, feature, component)
- **Mock Friendly**: Easy to swap implementations for testing

### API Client Integration

- **Generated Clients**: Build-time OpenAPI generation from .NET API (no running server required)
- **Post-processing**: Automatic renaming of `*Service` to `*ApiService` for clarity
- **Infrastructure Wrapped**: Promise-based TypeScript client wrapped with RxJS in infrastructure
- **Domain Mapping**: Always map through infrastructure mappers, never import API types directly
- **Clean Architecture Compliance**: API clients consumed only by infrastructure layer services

**Integration Pattern**:

```typescript
// ✅ Infrastructure layer service implementing domain contract
@Injectable()
export class DeviceService implements IDeviceService {
  constructor(private readonly apiClient: DevicesApiService) {}

  async getDevices(): Promise<Device[]> {
    const dtos = await this.apiClient.getDevices();
    return DeviceMapper.toDomainModels(dtos);
  }
}

// ❌ Never import API client directly in application or presentation layers
import { DevicesApiService } from '@teensyrom-nx/data-access/api-client'; // BAD
```

### Testing Standards

- **Domain Testing**: Pure unit tests with no mocks (test business logic directly)
- **Application Testing**: Mock domain contracts to test use case orchestration
- **Infrastructure Testing**: Integration tests with MSW (Mock Service Worker) for HTTP
- **E2E Testing**: Cypress for complete user workflows across all layers

### UI Component Usage Patterns

- **Feature Components**: Smart components in `libs/features/*` use application state and coordinate business logic
- **UI Components**: Dumb components in `libs/ui/components` are purely presentational with no dependencies on business logic
- **Composition**: Feature components compose UI components, passing data down and events up
- **Theme Integration**: All components use the theme service and design tokens for consistent styling
- **Import Boundaries**: UI components never import from domain, application, or infrastructure layers

**Example Usage**:

```typescript
// ❌ Bad - UI component importing business logic
import { DeviceService } from '@teensyrom-nx/infrastructure';

// ✅ Good - UI component only imports other UI components and Angular
import { ActionButtonComponent } from '@teensyrom-nx/ui/components';

// ✅ Good - Feature component coordinates business logic
import { DeviceStore } from '@teensyrom-nx/application';
import { ActionButtonComponent } from '@teensyrom-nx/ui/components';
```

**📖 References**:

- `pnpm component-docs get --component-name <name>` (or the `component-library` skill) - Complete component API documentation
- [STYLE_GUIDE.md](STYLE_GUIDE.md) - Global styling patterns and utility classes

### Code Organization Standards

- **Layered Structure**: Clear physical separation of domain, application, infrastructure layers
- **UI Separation**: Pure presentational components separated from business logic
- **Barrel Exports**: Clean public APIs for all libraries via `index.ts`
- **Consistent Naming**: `.contract.ts`, `.service.ts`, `.mapper.ts`, `.models.ts`, `.component.ts` conventions
- **Import Rules**: Enforce dependency directions with linting rules (inner layers only, UI components stay pure)
- **Documentation**: Architecture decision records and layer-specific documentation
