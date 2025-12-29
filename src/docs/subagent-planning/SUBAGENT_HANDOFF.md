# Subagent Task Handoff Document

## 📋 Overview

This document defines the interface between an **Orchestrator Agent** and **Worker Subagents**. The orchestrator breaks down complex projects into focused, context-appropriate tasks and hands them off to specialized worker agents with complete instructions and context.

---

## 🎯 Handoff Protocol

### For Orchestrator Agent

When handing off work to a subagent, provide:

1. **INPUT_DOC**: Complete task instructions (inline or file reference)
2. **OUTPUT_DOC**: File path where worker should save their completion report
3. **CONTEXT**: Any dependencies, prior work, or constraints
4. **SUCCESS_CRITERIA**: Clear definition of "done"

### For Worker Subagent

When receiving a handoff:

1. **Read** this document to understand the handoff protocol
2. **Execute** the task defined in INPUT_DOC
3. **Document** your work following the [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) template
4. **Save** your report to the OUTPUT_DOC path provided
5. **Return** the OUTPUT_DOC path to the orchestrator

---

## 📥 INPUT_DOC Structure

The orchestrator must provide comprehensive task instructions including:

### Required Elements

#### 1. Task Identity
```markdown
**Task ID**: [e.g., "USER-AUTH-TASK-01-001-AUTH-STATE"]
**Task Name**: [Descriptive name of the task]
**Assigned To**: [Backend Wizard | UI Wizard | UI Test Wizard]
**Agent Chatmode**: [Path to chatmode file]
**Priority**: [High/Medium/Low]
**Estimated Context Size**: [Small/Medium/Large - helps with scope awareness]
```

> **⚠️ NAMING CONVENTION AND FILE LOCATION**: See [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) for complete naming rules an locations to read/write handoff docs.
> Pattern: `<PROJECT-NAME>-TASK-<##>-<###>-<NAME>` (e.g., `USER-AUTH-TASK-01-001-DOMAIN-MODELS`)

#### 2. Objective
```markdown
**What**: [1-2 sentence description of what to build/implement/fix]
**Why**: [Business or technical reason this task matters]
**Success Criteria**: 
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] All tests pass
```

#### 3. Context & Dependencies

```markdown
**Prerequisites Completed**:
- Previous Task IDs that must be complete before this one
- Files/features that must exist

**Dependencies**:
- External libraries or APIs this task depends on
- Other system components it interacts with

**Constraints**:
- Technical limitations
- Performance requirements
- Compatibility requirements
```

#### 4. File Scope

```markdown
**Files to Create**:
- `path/to/new-file.ts` - Purpose of this file
- `path/to/another-file.spec.ts` - Test file

**Files to Modify**:
- `path/to/existing-file.ts` - What changes are needed
- `path/to/index.ts` - Add exports

**Files to Review** (for context only):
- `path/to/related-file.ts` - Shows related pattern
- `path/to/interface.ts` - Contains interface definitions
```

#### 5. Implementation Guidance

```markdown
**Standards to Follow**:
- [Coding Standards](./CODING_STANDARDS.md)
- [Testing Standards](./TESTING_STANDARDS.md)
- [State Standards](./STATE_STANDARDS.md) - if working with state
- [Component Standards](./COMPONENT_LIBRARY.md) - if creating UI components

**Key Requirements**:
1. Specific requirement with artifact names (class, method, property)
2. Integration points to be aware of
3. Error handling expectations
4. Testing requirements (unit, integration, e2e)

**Anti-Patterns to Avoid**:
- Common mistakes for this type of work
- Known pitfalls in this area of the codebase
```

#### 6. Code Detail Level (IMPORTANT)

Handoff documents should provide **architectural guidance**, not complete implementations.

**✅ DO include:**
- Class, interface, method, and property **names**
- Key signatures for contracts and public APIs (1-5 lines)
- Brief code snippets to illustrate patterns (max 5-10 lines)
- References to existing similar implementations in codebase
- Default values and edge case behaviors

**❌ DON'T include:**
- Complete method implementations
- Full file contents
- Every line of code the worker should write
- Detailed implementations that belong in the worker's domain

**Example - Good (architectural guidance):**
```markdown
Create selector `getDeviceSettings(deviceId: string)` that:
- Searches `settings.knownDevices` array by `deviceId`
- Returns `DeviceSettings | null`
- Returns `null` when device not found or settings not loaded
- Follow pattern in existing `get-settings.ts` selector
```

**Example - Bad (too much implementation):**
```markdown
[30+ lines of complete implementation code...]
```

The worker subagent is a skilled developer who can implement from architectural specifications. Trust them to write the code—your job is to define *what* to build and *how it fits together*, not *every line of code*.

#### 7. Testing Requirements

```markdown
**Test Coverage Required**:
- [ ] Unit tests for [specific behaviors]
- [ ] Integration tests for [specific interactions]
- [ ] E2E tests for [specific user flows] (if applicable)

**Behavioral Expectations**:
- What should users/consumers observe?
- What are the edge cases?
- What error conditions should be handled?
```

#### 8. Reference Materials

```markdown
**Related Documentation**:
- [Link to planning doc](./path/to/planning.md#section)
- [Link to similar implementation](./path/to/example.ts)
- [Link to API documentation](./path/to/api-docs.md)

**Related Tasks** (for context):
- <PROJECT>-TASK-##-###-NAME: Brief description of related work
- <PROJECT>-TASK-##-###-NAME: Brief description of dependent work

**Reports from Previous Tasks** (if applicable):
- Inline or attached reports from prior subagents
- Key decisions or discoveries from earlier work
```

---

## 📤 OUTPUT_DOC Structure

The orchestrator **must** specify the output location using the standardized project structure:

> **⚠️ NAMING CONVENTION**: See [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) for complete naming rules.

```markdown
**Output Report Location**: `docs/projects/<PROJECT-NAME>/reports/<PROJECT-NAME>-TASK-<##>-<###>-REPORT.md`
**Report Template**: Follow [SUBAGENT_REPORT.md](../../subagent-planning/SUBAGENT_REPORT.md)
**Return Value**: File path of saved report
```

**Example**:
```markdown
**Output Report Location**: `docs/projects/FEATURE-X/reports/FEATURE-X-TASK-02-003-REPORT.md`
```

---

## 🔄 Complete Handoff Example

### Orchestrator's Handoff Message

```markdown
## 🎯 Subagent Task Assignment

I am handing off the following task to a worker subagent:

---

### INPUT_DOC

**Task ID**: FEATURE-X-TASK-02-003-DOMAIN-HANDLERS
**Task Name**: Implement MediatR Command and Query Handlers
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium

**What**: Create MediatR handlers for core domain operations (Create, Read, Update, Delete, List).

**Why**: Handlers implement the business logic layer and coordinate between API endpoints and domain services, following CQRS pattern.

**Success Criteria**:
- [ ] Command handlers created for create/update/delete operations
- [ ] Query handlers created for read/list operations
- [ ] All handlers follow MediatR pipeline patterns
- [ ] Unit tests pass with >90% coverage
- [ ] Integration tests verify handler orchestration
- [ ] Code follows CQRS and Clean Architecture standards

---

**Prerequisites Completed**:
- FEATURE-X-TASK-02-001-API-CONTRACTS: API contracts (DTOs) defined
- FEATURE-X-TASK-02-002-DOMAIN-SERVICES: Domain services implemented

**Dependencies**:
- `TeensyRom.Core` - Domain services and entities
- `MediatR` library - Command/query pattern
- `FluentValidation` - Request validation

**Constraints**:
- Handlers must be stateless
- All database operations through repositories
- No direct HTTP concerns in handlers
- Follow existing handler patterns in codebase

---

**Files to Create**:
- `apps/api/src/TeensyRom.Api/Features/[Domain]/Commands/CreateEntityCommand.cs`
- `apps/api/src/TeensyRom.Api/Features/[Domain]/Commands/CreateEntityCommandHandler.cs`
- `apps/api/src/TeensyRom.Api/Features/[Domain]/Commands/UpdateEntityCommand.cs`
- `apps/api/src/TeensyRom.Api/Features/[Domain]/Commands/UpdateEntityCommandHandler.cs`
- `apps/api/src/TeensyRom.Api/Features/[Domain]/Queries/GetEntityQuery.cs`
- `apps/api/src/TeensyRom.Api/Features/[Domain]/Queries/GetEntityQueryHandler.cs`
- `apps/api/src/TeensyRom.Api/Features/[Domain]/Queries/ListEntitiesQuery.cs`
- `apps/api/src/TeensyRom.Api/Features/[Domain]/Queries/ListEntitiesQueryHandler.cs`
- Test files for all handlers

**Files to Modify**:
- `apps/api/src/TeensyRom.Api/Features/[Domain]/[Domain]Module.cs` - Register handlers

**Files to Review**:
- `docs/BACKEND_ARCHITECTURE.md` - CQRS patterns and pipeline behaviors
- `apps/api/src/TeensyRom.Api/Features/ExampleDomain/` - Similar handler implementation
- `libs/TeensyRom.Core/Services/` - Domain services to call

---

**Standards to Follow**:
- [Backend Architecture](../../../docs/BACKEND_ARCHITECTURE.md) - MediatR patterns
- [Coding Standards](../../../docs/CODING_STANDARDS.md) - C# conventions
- [Testing Standards](../../../docs/TESTING_STANDARDS.md) - Unit/integration tests

**Key Requirements**:

1. Command Handlers:
   - Validate input using FluentValidation
   - Call appropriate domain service methods
   - Return Result<T> with success/failure
   - Log operations for audit trail

2. Query Handlers:
   - Read-only operations (no side effects)
   - Return DTOs (not domain entities)
   - Support filtering and pagination
   - Use efficient data access patterns

3. Error Handling:
   - Use Result pattern (not exceptions for business logic failures)
   - Map domain errors to appropriate responses
   - Log exceptions for system errors

4. Testing:
   - Unit test each handler in isolation (mock dependencies)
   - Integration test handler + service + repository
   - Test validation rules
   - Test error scenarios

**Anti-Patterns to Avoid**:
- Don't put business logic in handlers (belongs in domain services)
- Don't access database directly (use repositories)
- Don't return domain entities to API (use DTOs)
- Don't use exceptions for validation failures (use Result pattern)

---

**Test Coverage Required**:

**Unit Tests**:
- [ ] CreateEntity command validates input correctly
- [ ] CreateEntity calls domain service with correct parameters
- [ ] CreateEntity returns success result on valid input
- [ ] CreateEntity returns failure result on validation error
- [ ] UpdateEntity updates existing entity correctly
- [ ] GetEntity returns correct DTO for valid ID
- [ ] GetEntity returns not found for invalid ID
- [ ] ListEntities returns paginated results

**Integration Tests**:
- [ ] End-to-end command flow (handler → service → repository)
- [ ] Query flow returns correctly mapped DTOs
- [ ] Validation errors propagate correctly

**Behavioral Expectations**:
- Commands modify state and return success/failure
- Queries return data without side effects
- Validation failures return descriptive errors
- All operations complete within acceptable timeouts

---

**Related Documentation**:
- [Master Plan](../FEATURE-X-MASTER-PLAN.md#phase-2)
- [Phase 2 Plan](../phases/FEATURE-X-PHASE-02-BACKEND-API.md)
- [API Contracts Task Report](../reports/FEATURE-X-TASK-02-001-REPORT.md) - DTO definitions
- [Domain Logic Task Report](../reports/FEATURE-X-TASK-02-002-REPORT.md) - Service methods

**Related Tasks**:
- FEATURE-X-TASK-02-001-API-CONTRACTS: API contracts (completed) - defines request/response models
- FEATURE-X-TASK-02-002-DOMAIN-SERVICES: Domain logic (completed) - services handlers will call
- FEATURE-X-TASK-02-004-API-ENDPOINTS: API endpoints (pending) - will consume these handlers

---

### OUTPUT_DOC

**Output Report Location**: `docs/projects/FEATURE-X/reports/FEATURE-X-TASK-02-003-REPORT.md`

**Report Template**: Follow the structure defined in [SUBAGENT_REPORT.md](../../../docs/subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path when complete: `docs/projects/FEATURE-X/reports/FEATURE-X-TASK-02-003-REPORT.md`

---

### Handoff Complete

Worker subagent: Please read this handoff document, execute the task, and save your completion report to the specified OUTPUT_DOC location.
```

---

## 🎛️ Orchestrator Guidelines

### Task Decomposition Principles

1. **Size Appropriately**: Match task to context window (Small: 1-3 files, Medium: 4-8 files, Large: 9-15 files)
2. **Single Responsibility**: One clear objective per task
3. **Minimize Coupling**: Clear boundaries, minimal interdependencies
4. **Order Carefully**: Backend-first, dependencies before dependents
5. **Complete Context**: Provide everything needed—no assumptions

### File Organization

> **⚠️ CRITICAL**: See [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) for complete file structure and naming conventions.

### Task Ordering Strategy

**Typical Execution Order**:

1. **Backend Contracts**: API DTOs, request/response models
2. **Backend Domain**: Services, validation, business logic
3. **Backend Handlers**: MediatR commands/queries
4. **Backend Endpoints**: API controllers/endpoints
5. **Frontend Contracts**: Regenerate API client
6. **Frontend State**: Store, actions, selectors
7. **Frontend Services**: Data access, business logic
8. **Frontend Components**: Dumb components, then smart containers
9. **Integration**: Routing, wiring, orchestration
10. **E2E Testing**: Complete user flows
11. **Documentation**: User guides, API docs

**Conflict Prevention**: See [ORCHESTRATOR_GUIDE](./SUBAGENT_ORCHESTRATOR_GUIDE.md#conflict-prevention) for file ownership strategies.

### Progress Tracking

After each subagent completes:

1. **Read** the OUTPUT_DOC report
2. **Verify** success criteria were met
3. **Update** project tracking (master plan, phase docs)
4. **Delegate Fixes**: If bugs/test failures found, create separate repair tasks
5. **Plan** next task based on progress and discoveries
6. **Pass** relevant context forward to next worker

**Emerging Work**: Bug fixes, test refinements, and improvements discovered during development should be delegated to specialized agents (repair, testing) rather than expanding original task scope.

---

## 🤖 Worker Subagent Guidelines

### Upon Receiving Handoff

1. **Acknowledge** receipt of task
2. **Verify** you have all required information
3. **Ask questions** if anything is unclear before starting
4. **Estimate** effort if it seems larger than expected

### During Execution

1. **Follow standards** linked in the INPUT_DOC
2. **Stay focused** on the assigned scope
3. **Test as you go** - don't save testing for the end
4. **Document discoveries** as you work
5. **Report blockers** immediately if you get stuck

### Before Completing

1. **Verify** all success criteria are met
2. **Run** all required tests
3. **Document** everything in your report
4. **Save** report to OUTPUT_DOC path
5. **Return** the file path to orchestrator

### Report Writing

Follow the [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) template:

- Document what was accomplished
- List all files created/modified with purposes
- Report test results with metrics
- Note discoveries and technical decisions
- Flag blockers or concerns requiring orchestrator attention
- Suggest next logical tasks

---

## ⚠️ Common Pitfalls to Avoid

### Orchestrator Pitfalls

- ❌ Tasks too large (>15 files or complex integration)
- ❌ Missing context (assuming worker knows the codebase)
- ❌ Vague success criteria (hard to verify completion)
- ❌ Poor task ordering (frontend before backend contracts)
- ❌ File conflicts (multiple tasks touching same files)
- ❌ Scope creep (expanding task during execution)
- ❌ **Too much code** (writing full implementations instead of architectural specs)

### Worker Pitfalls

- ❌ Scope creep (doing more than assigned)
- ❌ Skipping tests (leaving them for "later")
- ❌ Incomplete reports (missing key information)
- ❌ Ignoring standards (not following linked guidelines)
- ❌ Silent struggles (not reporting blockers early)

---

## 📚 Related Documentation

- [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) - Report template for workers
- [SUBAGENT_ORCHESTRATOR_GUIDE.md](./SUBAGENT_ORCHESTRATOR_GUIDE.md) - Orchestration methodology
- [PHASE_TEMPLATE.md](../PHASE_TEMPLATE.md) - Phase planning template
- [PLANNING_TEMPLATE.md](../PLANNING_TEMPLATE.md) - Feature planning template
- [BACKEND_ARCHITECTURE.md](../BACKEND_ARCHITECTURE.md) - Backend patterns and flows

---

## 🎯 Success Metrics

A successful handoff system demonstrates:

- ✅ Workers complete tasks without needing clarification
- ✅ Tasks appropriately scoped (1-15 files typically)
- ✅ No file conflicts between concurrent tasks
- ✅ Clear dependency chains with backend-first ordering
- ✅ Comprehensive reports enable informed planning
- ✅ Emerging issues delegated to specialized agents
- ✅ Minimal rework or scope creep
