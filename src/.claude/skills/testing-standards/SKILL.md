---
name: testing-standards
description: 'Testing philosophy and standards for the teensyrom-nx Angular workspace, covering Clean Architecture layers (domain, infrastructure, application, features, UI, utils), mock contract standards (Partial<IContract> via injection tokens), test description naming, and test commands. Use when writing or reviewing unit/integration tests, deciding what to mock versus test for a given layer, designing behavioral tests for an NgRx Signal Store, facade, or context service in the application layer, testing an Angular smart/feature component in libs/features, or establishing testing conventions before implementing a new service, store, or component.'
---

# Testing Standards Skill

Testing philosophy, standards, and methodology for the teensyrom-nx Angular workspace, aligned with Clean Architecture.

## When to Use This Skill

- Writing or reviewing unit/integration tests for any architectural layer
- Deciding what to mock and what to test for real (mock boundary questions)
- Designing behavioral tests for an NgRx Signal Store, facade, or context service (application layer)
- Testing an Angular smart/feature component (`libs/features`)
- Applying mock contract standards or test description naming conventions
- Understanding the workspace's test commands and coverage targets

## Testing Strategy by Layer

| Layer              | Location              | Testing Approach                                | Mock Boundary                  |
| ------------------ | ---------------------- | ------------------------------------------------ | -------------------------------- |
| **Domain**         | `libs/domain`         | Don't test contracts/models. Test domain logic.  | N/A - Interfaces used as mocks   |
| **Infrastructure** | `libs/infrastructure` | Unit test in isolation                            | Mock generated API clients       |
| **Application**    | `libs/application`    | **Behavioral** - integrate stores/services         | Mock infrastructure only         |
| **Features**       | `libs/features`       | Unit test - Mock the application layer.            |                                   |
| **UI Components**  | `libs/ui`             | Unit test                                          |                                   |
| **Utilities**      | `libs/utils`          | Unit test                                          |                                   |

**Key Principle**: Mock only at infrastructure boundaries. Application and features layers integrate real stores, services, and application logic together.

## Choosing the Right Reference

- **General layer-by-layer philosophy, mock contract standards, test commands, test description naming** → [references/TESTING_STANDARDS.md](references/TESTING_STANDARDS.md)
- **NgRx Signal Store, facade, or application-layer context service** (behavioral testing methodology, fixture libraries, timing and fake-timer rules) → [references/STORE_TESTING.md](references/STORE_TESTING.md)
- **Angular smart/feature component** (`libs/features`) — unit testing with mocked application dependencies, child-component stubbing strategy → [references/SMART_COMPONENT_TESTING.md](references/SMART_COMPONENT_TESTING.md)

## Fixture Libraries and Harnesses

- **Test data and infrastructure mocks**: `@teensyrom-nx/testing/fixtures` — domain model factories and infrastructure-service mocks (e.g., `createTestFileItem`, `createMockPlayerService`)
- **Application-layer mocks**: `@teensyrom-nx/testing/app-mocks` — facades and context services used in feature layer tests (e.g., `createMockPlayerContext`)
- **Behavioral test harnesses**: Feature-specific helpers (e.g., `createPlayerHarness`) provide configured TestBed with real application services and infrastructure mocks. See [references/STORE_TESTING.md](references/STORE_TESTING.md) for details and examples.

## Mock Contract Standards (Quick Reference)

All mocks MUST use domain contracts/interfaces, typed as `Partial<IContract>`, provided via injection tokens - never ad-hoc object literals or inline types. See [references/TESTING_STANDARDS.md](references/TESTING_STANDARDS.md) for the full rationale and examples.

## Test Commands

```bash
npx nx test                    # Run all tests
npx nx test application        # Run application layer tests
npx nx test --coverage         # With coverage
npx nx e2e teensyrom-ui-e2e    # E2E tests
```

## Related Skills

- **`run-unit-tests`** - executes the unit/integration test suite and produces a baseline report
- **`run-e2e-tests`** - executes Cypress E2E tests
