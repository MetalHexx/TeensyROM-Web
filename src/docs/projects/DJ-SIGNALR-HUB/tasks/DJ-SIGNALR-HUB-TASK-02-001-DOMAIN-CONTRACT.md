# Task Handoff: DJ-SIGNALR-HUB-TASK-02-001-DOMAIN-CONTRACT

## 📋 Task Identity

**Task ID**: DJ-SIGNALR-HUB-TASK-02-001-DOMAIN-CONTRACT  
**Task Name**: Create Domain Contract for DJ Service  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Foundation for Phase 2)  
**Estimated Context Size**: Small (2-3 files)

---

## 🎯 Objective

**What**: Define the IDjService domain contract interface and VoiceState enum that abstracts DJ command invocation from implementation details.

**Why**: Domain contracts establish clean architecture boundaries, allowing application and feature layers to depend on abstractions rather than concrete SignalR implementations.

**Success Criteria**:
- [ ] IDjService interface created in `libs/domain/src/lib/contracts/dj.contract.ts`
- [ ] DJ_SERVICE injection token exported from contract file
- [ ] VoiceState enum created in `libs/domain/src/lib/models/voice-state.model.ts`
- [ ] Both contract and model exported from domain barrel exports
- [ ] TypeScript compilation succeeds with no errors
- [ ] Code follows [Coding Standards](../../../CODING_STANDARDS.md)

---

## 📚 Context & Dependencies

**Prerequisites Completed**:
- DJ-SIGNALR-HUB-TASK-01-001-CREATE-HUB: Backend DJHub with MuteSidVoices method exists

**Dependencies**:
- Angular @angular/core (InjectionToken)
- RxJS (Observable)
- No external service dependencies (pure contracts)

**Constraints**:
- Domain layer MUST NOT depend on infrastructure implementations
- Contracts must be framework-agnostic interfaces
- VoiceState enum values must match backend C# enum exactly (`Enabled`, `Disabled`)

---

## 📂 File Scope

**Files to Create**:
- `libs/domain/src/lib/contracts/dj.contract.ts` - IDjService interface + DJ_SERVICE token
- `libs/domain/src/lib/models/voice-state.model.ts` - VoiceState enum

**Files to Modify**:
- `libs/domain/src/lib/contracts/index.ts` - Add dj contract export
- `libs/domain/src/lib/models/index.ts` - Add voice-state model export

**Files to Review** (for context):
- `libs/domain/src/lib/contracts/player.contract.ts` - Example contract pattern
- `libs/domain/src/lib/contracts/device.contract.ts` - Example injection token usage
- `apps/api/src/TeensyRom.Api/Endpoints/DJ/DJHub.cs` - Backend hub method signature (reference)

---

## 🔧 Implementation Guidance

**Standards to Follow**:
- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [Domain Standards](../../../features/DOMAIN_STANDARDS.md) - Contract design principles

**Key Requirements**:

1. **IDjService Interface**:
   - Define `muteVoices` method
   - Parameters: `deviceId: string`, `voice1: VoiceState`, `voice2: VoiceState`, `voice3: VoiceState`
   - Return type: `Observable<void>` (completes when command sent, not when device responds)
   - Add JSDoc comments explaining behavior

2. **DJ_SERVICE Injection Token**:
   - Use `InjectionToken<IDjService>` from @angular/core
   - Token name: `'DJ_SERVICE'`
   - Export alongside interface

3. **VoiceState Enum**:
   - String enum with values: `Enabled = 'Enabled'`, `Disabled = 'Disabled'`
   - Must match backend C# enum exactly (see DJHub.cs for reference)

4. **Barrel Exports**:
   - Add `export * from './dj.contract';` to `libs/domain/src/lib/contracts/index.ts`
   - Add `export * from './voice-state.model';` to `libs/domain/src/lib/models/index.ts`

**Anti-Patterns to Avoid**:
- Don't add SignalR dependencies to domain layer
- Don't add implementation logic to interfaces
- Don't use `any` types - be explicit with Observable<void>

---

## 📋 Code References

**IDjService Interface Structure**:

```typescript
// libs/domain/src/lib/contracts/dj.contract.ts
import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import { VoiceState } from '../models/voice-state.model';

/**
 * Service contract for DJ audio manipulation commands via SignalR.
 */
export interface IDjService {
  /**
   * Mute or unmute individual SID voices on a device.
   * 
   * @param deviceId - Target device identifier
   * @param voice1 - Voice 1 state (Enabled/Disabled)
   * @param voice2 - Voice 2 state (Enabled/Disabled)
   * @param voice3 - Voice 3 state (Enabled/Disabled)
   * @returns Observable that completes when command is sent to hub (not when device confirms)
   */
  muteVoices(
    deviceId: string,
    voice1: VoiceState,
    voice2: VoiceState,
    voice3: VoiceState
  ): Observable<void>;
}

export const DJ_SERVICE = new InjectionToken<IDjService>('DJ_SERVICE');
```

**VoiceState Enum Structure**:

```typescript
// libs/domain/src/lib/models/voice-state.model.ts
/**
 * State of a SID voice (enabled or disabled for playback).
 * Values match backend VoiceState enum in DJHub.
 */
export enum VoiceState {
  Enabled = 'Enabled',
  Disabled = 'Disabled',
}
```

---

## 🧪 Testing Requirements

**Test Coverage Required**:
- [ ] No unit tests needed - domain contracts are compile-time only (TypeScript interfaces)

**Verification**:
- Verify TypeScript compilation succeeds
- Verify imports work correctly from barrel exports
- Verify enum values match backend exactly

---

## 📖 Reference Materials

**Related Documentation**:
- [DJ SignalR Hub Master Plan](../DJ-SIGNALR-HUB-MASTER-PLAN.md#phase-2)
- [Phase 2 Plan](../phases/DJ-SIGNALR-HUB-PHASE-02-DJ-SERVICE.md#task-1)
- [Domain Standards](../../../features/DOMAIN_STANDARDS.md) - Contract design

**Related Tasks**:
- DJ-SIGNALR-HUB-TASK-01-001-CREATE-HUB (completed): Backend hub with MuteSidVoices method
- DJ-SIGNALR-HUB-TASK-02-002-IMPLEMENT-SERVICE (next): Will implement this contract

**Reports from Previous Tasks**:
- [Phase 1 Report](../reports/DJ-SIGNALR-HUB-TASK-01-001-REPORT.md) - Backend hub implementation

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-02-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/DJ-SIGNALR-HUB/reports/DJ-SIGNALR-HUB-TASK-02-001-REPORT.md`

---

## 🎯 Success Checklist

Before marking this task complete, verify:

- [ ] IDjService interface created with correct method signature
- [ ] DJ_SERVICE injection token created and exported
- [ ] VoiceState enum created with Enabled/Disabled values
- [ ] Barrel exports updated in contracts/index.ts and models/index.ts
- [ ] TypeScript compilation succeeds (no errors)
- [ ] Files follow project structure conventions
- [ ] Code formatted with Prettier
- [ ] Ready for infrastructure implementation (Task 02-002)
