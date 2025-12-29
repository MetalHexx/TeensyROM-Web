# Subagent File Structure & Naming Conventions

> **⚠️ SINGLE SOURCE OF TRUTH**: This document defines ALL naming conventions for the subagent planning system. All other documents MUST reference this file rather than duplicating these rules.

---

## 🚨 Path Discovery Required

**All agents MUST discover the actual path by finding existing files before writing.**

```bash
# Find existing reports to determine correct path:
find . -type f -name "*-REPORT.md" | grep <PROJECT-NAME>
```

- Paths may be `docs/projects/` OR `src/docs/projects/` depending on repo structure
- Always match existing file locations - NEVER assume from current directory
- Use discovered path in task handoff OUTPUT_DOC section

---

## 📁 Required Project Structure

```
docs/projects/<PROJECT-NAME>/  (or src/docs/projects/<PROJECT-NAME>/)
├── <PROJECT-NAME>-MASTER-PLAN.md
├── phases/
│   └── <PROJECT-NAME>-PHASE-##-<NAME>.md
├── tasks/
│   └── <PROJECT-NAME>-TASK-##-###-<NAME>.md
└── reports/
    └── <PROJECT-NAME>-TASK-##-###-REPORT.md
```

---

## 📐 Naming Convention Summary

| Artifact       | Pattern                                    | Example                                        |
| -------------- | ------------------------------------------ | ---------------------------------------------- |
| Project Folder | `<PROJECT-NAME>/`                          | `USER-AUTH/`                                   |
| Master Plan    | `<PROJECT-NAME>-MASTER-PLAN.md`            | `USER-AUTH-MASTER-PLAN.md`                     |
| Phase Folder   | `phases/`                                  | `phases/`                                      |
| Phase File     | `<PROJECT-NAME>-PHASE-<##>-<NAME>.md`      | `USER-AUTH-PHASE-01-FOUNDATION.md`             |
| Tasks Folder   | `tasks/`                                   | `tasks/`                                       |
| Task File      | `<PROJECT-NAME>-TASK-<##>-<###>-<NAME>.md` | `USER-AUTH-TASK-01-001-DOMAIN-MODELS.md`       |
| Reports Folder | `reports/`                                 | `reports/`                                     |
| Report File    | `<PROJECT-NAME>-TASK-<##>-<###>-REPORT.md` | `USER-AUTH-TASK-01-001-REPORT.md`              |

**ALL file and folder names use UPPER-KEBAB-CASE** (uppercase letters with hyphens).

---

## 📝 Detailed Rules

### Project Folder

- **Pattern**: `<PROJECT-NAME>/`
- **Convention**: UPPER-KEBAB-CASE (uppercase with hyphens)
- **Location**: `docs/projects/<PROJECT-NAME>/`
- ✅ Valid: `USER-AUTH/`, `DEVICE-MANAGER/`, `FILE-BROWSER-V2/`
- ❌ Invalid: `user-authentication/`, `UserAuthentication/`, `user_auth/`

### Master Plan

- **Pattern**: `<PROJECT-NAME>-MASTER-PLAN.md`
- **Location**: `docs/projects/<PROJECT-NAME>/<PROJECT-NAME>-MASTER-PLAN.md`
- **Template**: Use [PLANNING_TEMPLATE.md](../PLANNING_TEMPLATE.md)
- ✅ Valid: `USER-AUTH-MASTER-PLAN.md`, `DEVICE-MANAGER-MASTER-PLAN.md`
- ❌ Invalid: `master-plan.md`, `MASTER-PLAN.md`, `UserAuth-Master-Plan.md`

### Phase Files

- **Pattern**: `<PROJECT-NAME>-PHASE-<##>-<NAME>.md`
  - `<PROJECT-NAME>` = Project identifier in UPPER-KEBAB-CASE
  - `<##>` = 2-digit phase number, zero-padded (`01`, `02`, `10`)
  - `<NAME>` = UPPER-KEBAB-CASE descriptive name (2-4 words)
- **Location**: `docs/projects/<PROJECT-NAME>/phases/`
- **Template**: Use [PHASE_TEMPLATE.md](../PHASE_TEMPLATE.md)
- ✅ Valid: `USER-AUTH-PHASE-01-FOUNDATION.md`, `USER-AUTH-PHASE-02-STATE-MANAGEMENT.md`
- ❌ Invalid: `PHASE-01-FOUNDATION.md`, `phase-01-foundation.md`, `USER-AUTH-Phase-01-Foundation.md`

### Task Files

- **Pattern**: `<PROJECT-NAME>-TASK-<##>-<###>-<NAME>.md`
  - `<PROJECT-NAME>` = Project identifier in UPPER-KEBAB-CASE
  - `<##>` = 2-digit phase number, zero-padded (`01`, `02`, `10`)
  - `<###>` = 3-digit sequence number, zero-padded (`001`, `002`, `010`)
  - `<NAME>` = UPPER-KEBAB-CASE short name (2-4 words)
- **Location**: `docs/projects/<PROJECT-NAME>/tasks/`
- **Template**: Use [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md)
- ✅ Valid: `USER-AUTH-TASK-01-001-DOMAIN-MODELS.md`, `USER-AUTH-TASK-02-003-USER-STORE.md`
- ❌ Invalid: `TASK-01-001-DOMAIN-MODELS.md`, `task-01-001-domain-models.md`

### Task ID (In-Content References)

- **Pattern**: `<PROJECT-NAME>-TASK-<##>-<###>-<NAME>`
- Same rules as task filenames, without the `.md` extension
- Use consistently in: task handoffs, reports, cross-references, master plan tracking
- ✅ Valid: `USER-AUTH-TASK-01-001-DOMAIN-MODELS`
- ❌ Invalid: `TASK-01-001-DOMAIN-MODELS`, `User-Auth-Task-01-001`

### Report Files

- **Pattern**: `<PROJECT-NAME>-TASK-<##>-<###>-REPORT.md`
- **Location**: Discover via `find . -type f -name "*-REPORT.md"` first
- **Template**: [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md)
- ✅ Valid: `USER-AUTH-TASK-01-001-REPORT.md`
- ❌ Invalid: `task-01-001-report.md`, `report.md`

---

## 🔢 Numbering Rules

### Phase Numbers

- Always 2 digits: `01`, `02`, `03`, ... `10`, `11`, ...
- Never single digit: ~~`1`~~, ~~`2`~~
- Start at `01` for each project

### Sequence Numbers

- Always 3 digits: `001`, `002`, `003`, ... `010`, `011`, ... `100`
- Never less than 3 digits: ~~`1`~~, ~~`01`~~
- Restart at `001` for each phase (tasks are phase-scoped)

### Complete Examples

```
Project: USER-AUTH

Phase 1 Tasks:
  USER-AUTH-TASK-01-001-DOMAIN-MODELS.md
  USER-AUTH-TASK-01-002-API-CONTRACTS.md
  USER-AUTH-TASK-01-003-VALIDATION.md

Phase 2 Tasks:
  USER-AUTH-TASK-02-001-USER-STORE.md
  USER-AUTH-TASK-02-002-AUTH-SERVICE.md
  USER-AUTH-TASK-02-003-TOKEN-REFRESH.md

Phase 10 Tasks:
  USER-AUTH-TASK-10-001-FINAL-CLEANUP.md
  USER-AUTH-TASK-10-002-DOCUMENTATION.md
```

---

## 📋 Validation Checklist

Before creating any project artifact, verify:

- [ ] Project folder uses UPPER-KEBAB-CASE: `<PROJECT-NAME>/`
- [ ] Master plan includes project name: `<PROJECT-NAME>-MASTER-PLAN.md`
- [ ] Phase files include project name: `<PROJECT-NAME>-PHASE-##-<NAME>.md`
- [ ] Task files include project name: `<PROJECT-NAME>-TASK-##-###-<NAME>.md`
- [ ] Report files include project name: `<PROJECT-NAME>-TASK-##-###-REPORT.md`
- [ ] ALL names are UPPER-KEBAB-CASE (no lowercase, no underscores)
- [ ] All phase numbers are 2 digits (zero-padded)
- [ ] All sequence numbers are 3 digits (zero-padded)
- [ ] `phases/`, `tasks/`, and `reports/` folders all exist

---

## 🔗 Cross-Reference Examples

When referencing files in documents, use consistent relative paths:

```markdown
<!-- From a task file to other artifacts -->
[Master Plan](../USER-AUTH-MASTER-PLAN.md)
[Phase 1 Plan](../phases/USER-AUTH-PHASE-01-FOUNDATION.md)
[Previous Task](./USER-AUTH-TASK-01-001-DOMAIN-MODELS.md)
[Task Report](../reports/USER-AUTH-TASK-01-001-REPORT.md)

<!-- From master plan to phases -->
[Phase 1: Foundation](./phases/USER-AUTH-PHASE-01-FOUNDATION.md)
[Phase 2: State Management](./phases/USER-AUTH-PHASE-02-STATE-MANAGEMENT.md)
```

---

## 📚 Related Documents

- [SUBAGENT_ORCHESTRATOR_GUIDE.md](./SUBAGENT_ORCHESTRATOR_GUIDE.md) - How to plan and decompose projects
- [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md) - Task handoff protocol
- [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) - Worker report template
- [SUBAGENT_USER_GUIDE.md](./SUBAGENT_USER_GUIDE.md) - Quick start for users
- [PLANNING_TEMPLATE.md](../PLANNING_TEMPLATE.md) - Master plan template
- [PHASE_TEMPLATE.md](../PHASE_TEMPLATE.md) - Phase plan template
