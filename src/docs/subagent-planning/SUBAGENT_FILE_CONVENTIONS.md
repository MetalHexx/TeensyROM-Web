# Subagent File Structure & Naming Conventions

> **⚠️ SINGLE SOURCE OF TRUTH**: This document defines ALL naming conventions for the subagent planning system. All other documents MUST reference this file rather than duplicating these rules.

---

## 📁 Required Project Structure

Every subagent project MUST use this exact folder structure:

```
docs/projects/<project-name>/
├── master-plan.md
├── phases/
│   ├── phase-01-<name>.md
│   ├── phase-02-<name>.md
│   └── ...
├── tasks/
│   ├── TASK-01-001-<NAME>.md
│   ├── TASK-01-002-<NAME>.md
│   └── ...
└── reports/
    ├── TASK-01-001-report.md
    ├── TASK-01-002-report.md
    └── ...
```

---

## 📐 Naming Conventions

### Summary Table

| Artifact | Naming Convention | Example |
|----------|-------------------|---------|
| Project folder | `kebab-case` | `user-authentication` |
| Master plan | `master-plan.md` (exact) | `master-plan.md` |
| Phase folder | `phases` (exact) | `phases/` |
| Phase file | `phase-<##>-<name>.md` | `phase-01-foundation.md` |
| Tasks folder | `tasks` (exact) | `tasks/` |
| Task file | `TASK-<##>-<###>-<NAME>.md` | `TASK-01-001-API-CONTRACTS.md` |
| Reports folder | `reports` (exact) | `reports/` |
| Report file | `TASK-<##>-<###>-report.md` | `TASK-01-001-report.md` |

---

## 📝 Detailed Rules

### Project Folder
- **Convention**: `kebab-case` (lowercase with hyphens)
- **Location**: `docs/projects/<project-name>/`
- ✅ Valid: `user-authentication`, `device-manager`, `file-browser-v2`
- ❌ Invalid: `UserAuthentication`, `user_auth`, `File Browser`

### Master Plan
- **Filename**: Always exactly `master-plan.md`
- **Location**: `docs/projects/<project-name>/master-plan.md`
- **Template**: Use [PLANNING_TEMPLATE.md](../PLANNING_TEMPLATE.md)
- ❌ Never: `masterplan.md`, `plan.md`, `Master-Plan.md`

### Phase Files
- **Convention**: `phase-<##>-<name>.md`
  - `<##>` = 2-digit phase number, zero-padded (`01`, `02`, `10`)
  - `<name>` = kebab-case descriptive name (lowercase)
- **Location**: `docs/projects/<project-name>/phases/`
- **Template**: Use [PHASE_TEMPLATE.md](../PHASE_TEMPLATE.md)
- ✅ Valid: `phase-01-foundation.md`, `phase-02-state-management.md`, `phase-10-final-polish.md`
- ❌ Invalid: `Phase1.md`, `phase-1-foundation.md`, `phase-01-Foundation.md`

### Task Files
- **Convention**: `TASK-<##>-<###>-<NAME>.md`
  - `TASK` = Literal uppercase prefix
  - `<##>` = 2-digit phase number, zero-padded (`01`, `02`, `10`)
  - `<###>` = 3-digit sequence number, zero-padded (`001`, `002`, `010`)
  - `<NAME>` = UPPER-KEBAB-CASE short name (2-4 words)
- **Location**: `docs/projects/<project-name>/tasks/`
- **Template**: Use [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md)
- ✅ Valid: `TASK-01-001-DOMAIN-MODELS.md`, `TASK-02-003-USER-STORE.md`, `TASK-10-015-FINAL-CLEANUP.md`
- ❌ Invalid: `task-01-001-domain-models.md`, `TASK-1-1-Models.md`, `TASK-01-001.md`

### Task ID (used in content, not just filenames)
- **Convention**: `TASK-<##>-<###>-<NAME>`
- Same rules as task filenames, without the `.md` extension
- Use consistently in: task handoffs, reports, cross-references, master plan tracking

### Report Files
- **Convention**: `TASK-<##>-<###>-report.md`
  - Must match the corresponding task's phase and sequence numbers
  - Always lowercase `report` suffix
- **Location**: `docs/projects/<project-name>/reports/`
- **Template**: Use [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md)
- ✅ Valid: `TASK-01-001-report.md`, `TASK-02-003-report.md`
- ❌ Invalid: `report-01-001.md`, `TASK-01-001-REPORT.md`, `task-01-001-report.md`

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

### Examples by Phase

```
Phase 1 tasks:  TASK-01-001, TASK-01-002, TASK-01-003
Phase 2 tasks:  TASK-02-001, TASK-02-002, TASK-02-003
Phase 10 tasks: TASK-10-001, TASK-10-002, TASK-10-003
```

---

## 📋 Validation Checklist

Before creating any project artifact, verify:

- [ ] Project folder uses `kebab-case`
- [ ] Master plan is exactly `master-plan.md`
- [ ] Phase files use `phase-##-<name>.md` format (lowercase name)
- [ ] Task files use `TASK-##-###-<NAME>.md` format (UPPERCASE name)
- [ ] Report files use `TASK-##-###-report.md` format
- [ ] All phase numbers are 2 digits (zero-padded)
- [ ] All sequence numbers are 3 digits (zero-padded)
- [ ] `phases/`, `tasks/`, and `reports/` folders all exist

---

## 🔗 Cross-References

When referencing files in documents, use consistent relative paths:

```markdown
<!-- From a task file to other artifacts -->
[Master Plan](../master-plan.md)
[Phase 1 Plan](../phases/phase-01-foundation.md)
[Previous Task](./TASK-01-001-DOMAIN-MODELS.md)
[Task Report](../reports/TASK-01-001-report.md)

<!-- From master plan to phases -->
[Phase 1: Foundation](./phases/phase-01-foundation.md)
[Phase 2: State Management](./phases/phase-02-state-management.md)
```

---

## 📚 Related Documents

- [SUBAGENT_ORCHESTRATOR_GUIDE.md](./SUBAGENT_ORCHESTRATOR_GUIDE.md) - How to plan and decompose projects
- [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md) - Task handoff protocol
- [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) - Worker report template
- [SUBAGENT_USER_GUIDE.md](./SUBAGENT_USER_GUIDE.md) - Quick start for users
- [PLANNING_TEMPLATE.md](../PLANNING_TEMPLATE.md) - Master plan template
- [PHASE_TEMPLATE.md](../PHASE_TEMPLATE.md) - Phase plan template
