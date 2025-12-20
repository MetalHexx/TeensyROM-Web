# Task Handoff: DJ-SIGNALR-HUB-TASK-02-003-PROVIDERS

## 📋 Task Identity

**Task ID**: DJ-SIGNALR-HUB-TASK-02-003-PROVIDERS  
**Task Name**: Create Dependency Injection Providers Configuration  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: Medium  
**Estimated Context Size**: Small (2-3 files)

---

## 🎯 Objective

**What**: Configure dependency injection to bind the IDjService contract to the DjService implementation, making the service available throughout the application.

**Why**: Proper DI configuration ensures application and feature layers can inject DJ_SERVICE without knowing about the concrete implementation, maintaining clean architecture boundaries.

**Success Criteria**:
- [ ] providers.ts created in `libs/infrastructure/src/lib/dj/`
- [ ] DJ_PROVIDERS array exported with correct binding
- [ ] DJ_PROVIDERS exported from infrastructure barrel (`libs/infrastructure/src/lib/index.ts`)
- [ ] Provider configuration follows established patterns
- [ ] TypeScript compilation succeeds
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DJ-SIGNALR-HUB-TASK-02-001-DOMAIN-CONTRACT: IDjService contract and DJ_SERVICE token exist
- DJ-SIGNALR-HUB-TASK-02-002-IMPLEMENT-SERVICE: DjService implementation complete

**Dependencies**:
- Angular @angular/core (Provider type)
- Domain: DJ_SERVICE injection token
- Infrastructure: DjService implementation

**Constraints**:
- Must follow existing provider pattern from device/player infrastructure
- Must use `useClass` binding (not `useExisting` or `useFactory`)
- Must export as named constant `DJ_PROVIDERS` for consistency

---

## 📂 File Scope

**Files to Create**:
- `libs/infrastructure/src/lib/dj/providers.ts` - DI provider configuration

**Files to Modify**:
- `libs/infrastructure/src/lib/index.ts` - Export DJ_PROVIDERS

**Files to Review** (for context):
- `libs/infrastructure/src/lib/device/providers.ts` - Provider pattern reference
- `libs/infrastructure/src/lib/player/providers.ts` - Another provider example
- `apps/teensyrom-ui/src/app/app.config.ts` - Where providers are consumed

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [Service Standards](../../../SERVICE_STANDARDS.md) - DI patterns

**Key Requirements**:

1. **Create providers.ts**:
   - Import `Provider` type from @angular/core
   - Import `DJ_SERVICE` token from domain
   - Import `DjService` class from infrastructure

2. **Export DJ_PROVIDERS Array**:
   - Create constant `DJ_PROVIDERS` of type `Provider[]`
   - Single provider object binding DJ_SERVICE to DjService
   - Use `useClass` binding

3. **Export from Infrastructure Barrel**:
   - Add `export { DJ_PROVIDERS } from './dj/providers';` to `libs/infrastructure/src/lib/index.ts`
   - Maintain alphabetical ordering with other provider exports

4. **No Application Registration Needed**:
   - User will register providers in app.config.ts separately
   - Just create the configuration, don't modify application files

**Anti-Patterns to Avoid**:
- Don't use `useExisting` (creates alias, not needed here)
- Don't use `useFactory` (no complex creation logic needed)
- Don't forget to export from infrastructure barrel
- Don't add to application config (that's user's responsibility)

---

## 📋 Code References

**Provider Configuration Structure**:

```typescript
// libs/infrastructure/src/lib/dj/providers.ts
import { Provider } from '@angular/core';
import { DJ_SERVICE } from '@teensyrom-nx/domain';
import { DjService } from './dj.service';

/**
 * Dependency injection providers for DJ infrastructure services.
 */
export const DJ_PROVIDERS: Provider[] = [
  {
    provide: DJ_SERVICE,
    useClass: DjService,
  },
];
```

**Infrastructure Barrel Export** (add to existing file):

```typescript
// libs/infrastructure/src/lib/index.ts
// ... existing exports ...
export { DJ_PROVIDERS } from './dj/providers';
```

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] No unit tests needed - providers are configuration (tested via integration)

**Verification**:
- Verify TypeScript compilation succeeds
- Verify export from infrastructure barrel works
- Verify provider configuration follows pattern

**Integration Testing Note**:
Providers are tested implicitly when:
1. Application imports DJ_PROVIDERS in app.config.ts
2. Component/service injects DJ_SERVICE token
3. DjService instance is correctly resolved by Angular DI

---

## 📖 Reference Materials

**Related Documentation**:
- [DJ SignalR Hub Master Plan](../DJ-SIGNALR-HUB-MASTER-PLAN.md#phase-2)
- [Phase 2 Plan](../phases/DJ-SIGNALR-HUB-PHASE-02-DJ-SERVICE.md#task-3)
- [Service Standards](../../../SERVICE_STANDARDS.md) - DI configuration patterns

**Reference Implementations**:
- [Device Providers](../../../../libs/infrastructure/src/lib/device/providers.ts) - Provider pattern
- [Player Providers](../../../../libs/infrastructure/src/lib/player/providers.ts) - Another example

**Related Tasks**:
- DJ-SIGNALR-HUB-TASK-02-002-IMPLEMENT-SERVICE (completed): DjService implementation
- DJ-SIGNALR-HUB-TASK-02-004-UNIT-TESTS (next): Will verify service integration

**Reports from Previous Tasks**:
- [Task 02-002 Report](../reports/DJ-SIGNALR-HUB-TASK-02-002-REPORT.md) - Service implementation

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-02-003-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-02-003-REPORT.md`

---

## 🎯 Success Checklist

Before marking this task complete, verify:

- [ ] providers.ts created in libs/infrastructure/src/lib/dj/
- [ ] DJ_PROVIDERS array exported with correct binding
- [ ] DJ_SERVICE token bound to DjService using useClass
- [ ] DJ_PROVIDERS exported from infrastructure barrel index.ts
- [ ] TypeScript compilation succeeds (no errors)
- [ ] Code follows project conventions
- [ ] Code formatted with Prettier
- [ ] Ready for integration testing (Task 02-004)
