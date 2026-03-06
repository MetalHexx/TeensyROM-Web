# Task Handoff File Schema

## 📋 Overview

This document defines the **canonical schema** for task handoff files — the `.md` files in `docs/projects/<PROJECT-NAME>/tasks/` that tell a worker subagent exactly what to build.

**Who creates these files**: The **Project Planner** agent (or a user following this schema).

**Who reads these files**: **Worker subagents** dispatched by the Orchestrator.

**Who dispatches workers**: The **Orchestrator** agent.

For naming rules and file locations, see [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md).

---

## 📥 Task File Sections

> **⚠️ NAMING**: See [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) for naming rules and file locations.
> Pattern: `<PROJECT-NAME>-TASK-<##>-<###>-<NAME>`

### 1. Task Identity
```markdown
**Task ID**: [e.g., USER-AUTH-TASK-01-001-AUTH-STATE]
**Task Name**: [Descriptive name]
**Assigned To**: [Agent role]
**Agent Chatmode**: [Path to chatmode file]
**Priority**: [High/Medium/Low]
**Estimated Context Size**: [Small (1-3 files) / Medium (4-8) / Large (9-15)]
**Risk Level**: [Low/Medium/High]
```

> **Risk Level Guide** (optional): Low = new isolated files, no shared dependencies · Medium = modifies shared code or integrates with existing features · High = changes API contracts, state shape, or shared interfaces

### 2. Objective
```markdown
**What**: [1-2 sentence description]
**Why**: [Business or technical reason]
**Success Criteria**: 
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] All tests pass
```

### 3. Context & Dependencies
```markdown
**Prerequisites Completed**: [Previous Task IDs, files that must exist]
**Dependencies**: [Libraries, APIs, system components]
**Constraints**: [Technical limitations, performance, compatibility]
```

### 4. File Scope
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

### 5. Implementation Guidance
```markdown
**Standards to Follow**: [Links to relevant standards docs]
**Key Requirements**: [Specific requirements with artifact names]
**Anti-Patterns to Avoid**: [Common mistakes for this work]
```

### 6. Code Detail Level

Handoffs provide **architectural guidance**, not implementations. The worker is a skilled developer — define *what* to build and *how it fits together*, not every line of code.

| ✅ Include | ❌ Avoid |
|-----------|----------|
| Class/interface/method **names** | Complete implementations |
| Key signatures (1-5 lines) | Full file contents |
| Pattern references to existing code | Every line they should write |
| Default values and edge cases | Detailed method bodies |
| Behavioral requirements | Copy-paste ready code |

**Good example** — architectural spec, not implementation:

> Create selector `enableVideoForDevice(deviceId: string)`:
> - Search `knownDevices` array for matching device
> - Return `device.videoSettings.enableVideo ?? false`
> - Follow pattern in existing `get-settings.ts`

**Bad example** — over-specified implementation:

> [30+ lines of complete TypeScript implementation...]

**Rule of Thumb**: If your code snippet is longer than 10 lines, you're probably over-specifying. Point to existing patterns in the codebase instead.

### 7. Testing Requirements
```markdown
**Test Coverage**: [Unit/Integration/E2E — specific behaviors]
**Behavioral Expectations**: [What users/consumers observe, edge cases, error conditions]
```

### 8. Reference Materials
```markdown
**Related Documentation**: [Planning docs, similar implementations, API docs]
**Related Tasks**: [Task IDs with brief descriptions]
**Reports from Previous Tasks**: [Key decisions or discoveries]
```

---

### 9. Output Report

```markdown
**Output Report Location**: docs/projects/<PROJECT-NAME>/reports/<PROJECT-NAME>-TASK-<##>-<###>-REPORT.md
**Report Template**: Follow [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md)
```

---

## 🔄 Example Task File (Condensed)

```markdown
**Task ID**: FEATURE-X-TASK-02-003-DOMAIN-HANDLERS
**Task Name**: Implement MediatR Command and Query Handlers
**Assigned To**: Coding Wizard
**Priority**: High | **Context Size**: Medium

**What**: Create MediatR handlers for CRUD domain operations.
**Why**: Handlers implement business logic coordination following CQRS pattern.

**Success Criteria**:
- [ ] Command handlers for create/update/delete
- [ ] Query handlers for read/list
- [ ] Unit tests >90% coverage
- [ ] Follows CQRS and Clean Architecture standards

**Prerequisites**: FEATURE-X-TASK-02-001 (DTOs), FEATURE-X-TASK-02-002 (Domain services)
**Dependencies**: MediatR, FluentValidation
**Constraints**: Stateless handlers, repository-only DB access, no HTTP concerns

**Files to Create**: Command/Query classes + handlers in Features/[Domain]/
**Files to Modify**: [Domain]Module.cs — register handlers
**Files to Review**: ExampleDomain/ — similar handler patterns

**Standards**: [Backend Architecture](./BACKEND_ARCHITECTURE.md), [Coding Standards](./CODING_STANDARDS.md)

**Key Requirements**:
- Commands: validate → call domain service → return Result<T> → log
- Queries: read-only, return DTOs, support pagination
- Use Result pattern (not exceptions) for business failures

**Anti-Patterns**: No business logic in handlers, no direct DB access, no domain entities in responses

**Tests**:
- Unit: handler isolation with mocked deps (validation, success, failure paths)
- Integration: handler → service → repository flow
- Behavioral: commands modify state, queries have no side effects

**References**: [Master Plan](../FEATURE-X-MASTER-PLAN.md#phase-2), prior task reports

**Output Report**: `docs/projects/FEATURE-X/reports/FEATURE-X-TASK-02-003-REPORT.md`
```

---

## 📚 Related Documentation

- [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) - Naming rules and file structure
- [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) - Report template workers must follow
- [SUBAGENT_ORCHESTRATOR_GUIDE.md](./SUBAGENT_ORCHESTRATOR_GUIDE.md) - System overview
- [SUBAGENT_PHASE_TEMPLATE.md](./SUBAGENT_PHASE_TEMPLATE.md) - Phase planning template
- [SUBAGENT_FEATURE_TEMPLATE.md](./SUBAGENT_FEATURE_TEMPLATE.md) - Feature planning template