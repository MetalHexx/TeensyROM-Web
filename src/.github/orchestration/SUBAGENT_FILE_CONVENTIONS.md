# Subagent File Structure & Naming Conventions

> **⚠️ SINGLE SOURCE OF TRUTH**: This document defines ALL naming conventions for the subagent planning system. All other documents MUST reference this file rather than duplicating these rules.

---

## 📍 Repository Location

**All project planning documents are stored in the `docs/projects/` folder within this repository.**

- **Base Path**: `docs/projects/` (relative from workspace root)
- **Structure**: All projects live under `docs/projects/<PROJECT-NAME>/`

**Example paths:**
```
docs/projects/USER-AUTH/USER-AUTH-MASTER-PLAN.md
docs/projects/USER-AUTH/design/USER-AUTH-DESIGN.md
docs/projects/USER-AUTH/design/screenshots/current-login-view.png
docs/projects/USER-AUTH/phases/USER-AUTH-PHASE-01-FOUNDATION.md
docs/projects/USER-AUTH/tasks/USER-AUTH-TASK-01-001-DOMAIN-MODELS.md
docs/projects/USER-AUTH/reports/USER-AUTH-TASK-01-001-REPORT.md
```

---

## 🚨 Path Discovery Required

**All agents MUST use the `docs/projects/` folder.**

```bash
# Find existing reports to determine correct path:
find docs/projects -type f -name "*-REPORT.md" | grep <PROJECT-NAME>
```

```powershell
# PowerShell equivalent:
Get-ChildItem -Path docs/projects -Recurse -Filter "*-REPORT.md" | Where-Object { $_.Name -match "<PROJECT-NAME>" }
```

- All project documents are stored in `docs/projects/<PROJECT-NAME>/`
- Always use workspace-relative paths
- Use discovered path in task handoff OUTPUT_DOC section

---

## 📁 Required Project Structure

**All project documents are stored in `docs/projects/`.**

```
docs/projects/<PROJECT-NAME>/
├── <PROJECT-NAME>-MASTER-PLAN.md
├── STATUS.md                                    (optional)
├── design/
│   ├── <PROJECT-NAME>-DESIGN.md                 (optional — for features with UI work)
│   └── screenshots/                             (optional — captured UI references)
│       └── *.png
├── phases/
│   └── <PROJECT-NAME>-PHASE-##-<NAME>.md
├── tasks/
│   └── <PROJECT-NAME>-TASK-##-###-<NAME>.md
└── reports/
    └── <PROJECT-NAME>-TASK-##-###-REPORT.md
```

### STATUS.md (Optional)

A lightweight progress tracker at the project root for instant status visibility. Recommended for projects with 5+ tasks.

```markdown
# Project Status

| Task ID | Status | Agent | Completed |
|---------|--------|-------|-----------|
| PROJ-TASK-01-001-SETUP | ✅ Complete | Backend Agent | 2026-02-15 |
| PROJ-TASK-01-002-MODELS | 🔄 In Progress | Backend Agent | — |
| PROJ-TASK-01-003-TESTS | ⏳ Not Started | Test Agent | — |
| PROJ-TASK-02-001-UI | ⏳ Not Started | UI Agent | — |
```

Update this file after each task completion. The orchestrator or worker agent can maintain it.

---

## 📐 Naming Convention Summary

| Artifact        | Pattern                                    | Example                                        |
| --------------- | ------------------------------------------ | ---------------------------------------------- |
| Project Folder  | `<PROJECT-NAME>/`                          | `USER-AUTH/`                                   |
| Master Plan     | `<PROJECT-NAME>-MASTER-PLAN.md`            | `USER-AUTH-MASTER-PLAN.md`                     |
| Design Folder   | `design/`                                  | `design/`                                      |
| Design Document | `<PROJECT-NAME>-DESIGN.md`                 | `USER-AUTH-DESIGN.md`                          |
| Screenshots     | `design/screenshots/*.png`                 | `design/screenshots/current-player-view.png`   |
| Phase Folder    | `phases/`                                  | `phases/`                                      |
| Phase File      | `<PROJECT-NAME>-PHASE-<##>-<NAME>.md`      | `USER-AUTH-PHASE-01-FOUNDATION.md`             |
| Tasks Folder    | `tasks/`                                   | `tasks/`                                       |
| Task File       | `<PROJECT-NAME>-TASK-<##>-<###>-<NAME>.md` | `USER-AUTH-TASK-01-001-DOMAIN-MODELS.md`       |
| Reports Folder  | `reports/`                                 | `reports/`                                     |
| Report File     | `<PROJECT-NAME>-TASK-<##>-<###>-REPORT.md` | `USER-AUTH-TASK-01-001-REPORT.md`              |

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
- **Template**: Use [SUBAGENT_FEATURE_TEMPLATE.md](./SUBAGENT_FEATURE_TEMPLATE.md)
- ✅ Valid: `USER-AUTH-MASTER-PLAN.md`, `DEVICE-MANAGER-MASTER-PLAN.md`
- ❌ Invalid: `master-plan.md`, `MASTER-PLAN.md`, `UserAuth-Master-Plan.md`

### Design Document (Optional)

- **Pattern**: `<PROJECT-NAME>-DESIGN.md`
- **Location**: `docs/projects/<PROJECT-NAME>/design/<PROJECT-NAME>-DESIGN.md`
- **Template**: Use [SUBAGENT_DESIGN_TEMPLATE.md](./SUBAGENT_DESIGN_TEMPLATE.md)
- **Created by**: The Designer agent during UI/UX planning
- **When to include**: Any project with UI work (new components, layout changes, responsive behavior, styling)
- **Screenshots**: Store captured UI screenshots in `design/screenshots/` — reference or embed them in the design doc
- ✅ Valid: `USER-AUTH-DESIGN.md`, `DEVICE-MANAGER-DESIGN.md`
- ❌ Invalid: `design.md`, `DESIGN.md`, `UserAuth-Design.md`

**Cross-references**: The master plan, phase documents involving UI work, and task handoffs involving UI work should all link to the design document.

### Phase Files

- **Pattern**: `<PROJECT-NAME>-PHASE-<##>-<NAME>.md`
  - `<PROJECT-NAME>` = Project identifier in UPPER-KEBAB-CASE
  - `<##>` = 2-digit phase number, zero-padded (`01`, `02`, `10`)
  - `<NAME>` = UPPER-KEBAB-CASE descriptive name (2-4 words)
- **Location**: `docs/projects/<PROJECT-NAME>/phases/`
- **Template**: Use [SUBAGENT_PHASE_TEMPLATE.md](./SUBAGENT_PHASE_TEMPLATE.md)
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
- **Location**: `docs/projects/<PROJECT-NAME>/reports/`
- **Discovery**: `find docs/projects -type f -name "*-REPORT.md"`
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

### Phase Insertion (Mid-Project)

When new phases need to be added between existing phases, use **decimal sub-phase numbering** to avoid renumbering all subsequent phases and their cross-references.

- **Use decimal notation**: Insert phases as `02.1`, `02.2`, etc. between Phase 02 and Phase 03
- **Filename pattern**: `<PROJECT-NAME>-PHASE-02.1-<NAME>.md`
- **Task numbering**: Tasks in sub-phases use the sub-phase number — e.g., `<PROJECT-NAME>-TASK-02.1-001-<NAME>.md`
- **No renumbering required**: Phase 03 and beyond remain unchanged, preserving all existing cross-references
- **Ordering**: Sub-phases execute after their parent number and before the next whole number (`02` → `02.1` → `02.2` → `03`)

**Example**: After completing Phase 02, you discover additional work needed before Phase 03:
```
USER-AUTH-PHASE-02-STATE-MANAGEMENT.md      ← original (complete)
USER-AUTH-PHASE-02.1-AUTH-REFRESH.md         ← inserted
USER-AUTH-PHASE-02.2-TOKEN-VALIDATION.md     ← inserted
USER-AUTH-PHASE-03-UI-COMPONENTS.md          ← unchanged
```

---

## 📋 Validation Checklist

Before creating any project artifact, verify:

- [ ] Project folder uses UPPER-KEBAB-CASE: `<PROJECT-NAME>/`
- [ ] Master plan includes project name: `<PROJECT-NAME>-MASTER-PLAN.md`
- [ ] Design document (if UI work): `<PROJECT-NAME>-DESIGN.md` in `design/` folder
- [ ] Phase files include project name: `<PROJECT-NAME>-PHASE-##-<NAME>.md`
- [ ] Task files include project name: `<PROJECT-NAME>-TASK-##-###-<NAME>.md`
- [ ] Report files include project name: `<PROJECT-NAME>-TASK-##-###-REPORT.md`
- [ ] ALL names are UPPER-KEBAB-CASE (no lowercase, no underscores)
- [ ] All phase numbers are 2 digits (zero-padded)
- [ ] All sequence numbers are 3 digits (zero-padded)
- [ ] `phases/`, `tasks/`, and `reports/` folders all exist
- [ ] `design/` and `design/screenshots/` folders exist (if design doc is included)

---

## 🔗 Cross-Reference Examples

When referencing files in documents, use consistent relative paths within the `docs/projects/` folder.  These are examples, not real file paths:

```markdown
[Master Plan](../USER-AUTH-MASTER-PLAN.md)
[Design Document](../design/USER-AUTH-DESIGN.md)
[Phase 1 Plan](../phases/USER-AUTH-PHASE-01-FOUNDATION.md)
[Previous Task](./USER-AUTH-TASK-01-001-DOMAIN-MODELS.md)
[Task Report](../reports/USER-AUTH-TASK-01-001-REPORT.md)

[Phase 1: Foundation](./phases/USER-AUTH-PHASE-01-FOUNDATION.md)
[Phase 2: State Management](./phases/USER-AUTH-PHASE-02-STATE-MANAGEMENT.md)

[Master Plan](docs/projects/USER-AUTH/USER-AUTH-MASTER-PLAN.md)
[Design Document](docs/projects/USER-AUTH/design/USER-AUTH-DESIGN.md)
[Task](docs/projects/USER-AUTH/tasks/USER-AUTH-TASK-01-001-DOMAIN-MODELS.md)
```

---

## 📚 Related Documents

- [SUBAGENT_ORCHESTRATOR_GUIDE.md](./SUBAGENT_ORCHESTRATOR_GUIDE.md) - System overview
- [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md) - Task file schema
- [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) - Worker report template
- [SUBAGENT_DESIGN_TEMPLATE.md](./SUBAGENT_DESIGN_TEMPLATE.md) - Design document template
- [SUBAGENT_USER_GUIDE.md](./SUBAGENT_USER_GUIDE.md) - Quick start for users
- [SUBAGENT_FEATURE_TEMPLATE.md](./SUBAGENT_FEATURE_TEMPLATE.md) - Master plan template
- [SUBAGENT_PHASE_TEMPLATE.md](./SUBAGENT_PHASE_TEMPLATE.md) - Phase plan template
