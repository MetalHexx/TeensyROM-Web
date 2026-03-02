---
name: subagent-plan
description: 'Creates a comprehensive master plan and task decomposition for complex features using the subagent orchestration system. Use when asked to "plan a feature", "create a project plan", "break down a feature", "scaffold tasks", "orchestrate subagents", or any request to plan multi-phase work before execution. Generates master plan, phase documents, and task handoff files in docs/projects/<PROJECT-NAME>/.'
---

# Subagent Project Planning

A meta-orchestration skill for breaking down complex projects into well-sequenced task plans that worker subagents can execute in isolated contexts.

## When to Use This Skill

- User says "plan a feature", "create a project plan", or "break this down into tasks"
- User invokes `/subagent-plan` slash command followed by a project description
- A feature spans multiple layers (backend + frontend) or multiple sessions
- The work is too large for a single agent context window
- User wants to generate master plan + phase + task handoff documents before execution

---

## Prerequisites

- Clear project description or requirements from the user
- Access to existing codebase for architecture analysis

---

## Complete Orchestration Process

### Step 1: Understand the Project

Before creating any files:

1. Review the user's project description thoroughly
2. Explore the relevant codebase areas with search tools
3. Identify:
   - **Scope**: Full feature being built
   - **Layers affected**: Backend, frontend, infra, domain, etc.
   - **External dependencies**: APIs, packages, integrations
   - **Success definition**: What does "done" look like?

### Step 2: Read Required Conventions

> **🔴 MANDATORY**: Read `SUBAGENT_FILE_CONVENTIONS.md` BEFORE creating any files.

```
.github/orchestration/SUBAGENT_FILE_CONVENTIONS.md   ← Naming rules (single source of truth)
.github/orchestration/SUBAGENT_ORCHESTRATOR_GUIDE.md ← System overview
.github/orchestration/SUBAGENT_FEATURE_TEMPLATE.md   ← Master plan template
.github/orchestration/SUBAGENT_PHASE_TEMPLATE.md     ← Phase document template
.github/orchestration/SUBAGENT_HANDOFF.md            ← Task file schema
```

### Step 3: Create the Project Structure

All files go in the `docs/projects/` folder within the repository:

```
docs/projects/<PROJECT-NAME>/
├── <PROJECT-NAME>-MASTER-PLAN.md
├── STATUS.md                          (optional, recommended for 5+ tasks)
├── phases/
│   └── <PROJECT-NAME>-PHASE-<##>-<NAME>.md
├── tasks/
│   └── <PROJECT-NAME>-TASK-<##>-<###>-<NAME>.md
└── reports/
    └── (empty — workers write reports here)
```

**Naming rules** (UPPER-KEBAB-CASE throughout):

| File | Pattern |
|------|---------|
| Project folder | `<PROJECT-NAME>/` |
| Master plan | `<PROJECT-NAME>-MASTER-PLAN.md` |
| Phase file | `<PROJECT-NAME>-PHASE-<##>-<NAME>.md` |
| Task file | `<PROJECT-NAME>-TASK-<##>-<###>-<NAME>.md` |
| Report file | `<PROJECT-NAME>-TASK-<##>-<###>-REPORT.md` |

**Example** (`USER-AUTH` project):
```
docs/projects/USER-AUTH/
├── USER-AUTH-MASTER-PLAN.md
├── phases/
│   ├── USER-AUTH-PHASE-01-FOUNDATION.md
│   └── USER-AUTH-PHASE-02-UI.md
├── tasks/
│   ├── USER-AUTH-TASK-01-001-DOMAIN-MODELS.md
│   └── USER-AUTH-TASK-01-002-API-ENDPOINTS.md
└── reports/
```

### Step 4: Generate the Master Plan

Use [SUBAGENT_FEATURE_TEMPLATE.md](../../orchestration/SUBAGENT_FEATURE_TEMPLATE.md) as a base. Include:

1. **Project Overview** — Feature name, description, user value
2. **Architecture & Design** — High-level decisions, integration points
3. **Phase Breakdown** — 3–7 logical phases in execution order
4. **Dependencies Map** — External, internal, inter-phase dependencies
5. **Success Criteria** — Measurable completion indicators

### Step 5: Create Phase Plans

For each phase, use [SUBAGENT_PHASE_TEMPLATE.md](../../orchestration/SUBAGENT_PHASE_TEMPLATE.md). Each phase document includes:

1. Phase objective and deliverables
2. Required reading (standards, docs, prior phases)
3. File structure (created/modified files)
4. Task breakdown with sizing
5. Testing strategy
6. Success criteria

### Step 6: Task Decomposition (Most Critical Step)

Break each phase into tasks following these sizing principles:

| Principle | Rule |
|-----------|------|
| **Single Responsibility** | One task = one logical concern (e.g., domain models, API endpoint, UI component) |
| **Context Fit** | Each task must fit within a single agent context window |
| **No Conflicts** | Concurrent tasks must not touch the same files |
| **Self-Contained** | Every task handoff has all context the worker needs |
| **Backend First** | For full-stack features, backend tasks precede frontend tasks |

**Task sizing targets**:
- 1–4 files created or modified per task
- 30–90 minutes of estimated work
- Clear before/after state

For each task, create a handoff document using [SUBAGENT_HANDOFF.md](../../orchestration/SUBAGENT_HANDOFF.md):

```markdown
## Task: <PROJECT-NAME>-TASK-<##>-<###>-<NAME>

### Objective
[Single sentence describing what this task produces]

### Context
[Architecture background, relevant existing code, design decisions]

### Required Reading
[Links to standards, prior task reports, existing implementations]

### Files to Create/Modify
[Explicit file list with descriptions]

### Implementation Steps
[Numbered, actionable steps]

### Success Criteria
[Testable, measurable outcomes]

### Output Document
[Path where worker saves their report]
```

### Step 7: Create Phase 1 Task Handoffs

Create task handoff files for Phase 1 only (not all phases upfront — plans evolve):

- One `.md` file per task in `tasks/` folder
- Include all context the worker needs
- Reference prior tasks' output reports where relevant
- Specify which agent type is best suited (e.g., Backend Wizard, UI Wizard)

---

## Deliverables Checklist

Before finishing, verify you created:

- [ ] `docs/projects/<PROJECT-NAME>/<PROJECT-NAME>-MASTER-PLAN.md`
- [ ] `docs/projects/<PROJECT-NAME>/phases/` folder with all phase files
- [ ] `docs/projects/<PROJECT-NAME>/tasks/` folder with Phase 1 task files
- [ ] `docs/projects/<PROJECT-NAME>/reports/` folder (empty, for worker use)
- [ ] Execution summary showing phase breakdown, dependencies, and first task to run

---

## Execution Summary Format

End every planning session with a summary:

```markdown
## Project Plan Complete: <PROJECT-NAME>

### Phases
| Phase | Name | Tasks | Status |
|-------|------|-------|--------|
| 01 | Foundation | 3 | Ready |
| 02 | UI Components | 4 | Pending Phase 01 |
| 03 | Integration | 2 | Pending Phase 02 |

### Phase 1 Tasks (Ready to Execute)
1. `<PROJECT-NAME>-TASK-01-001-<NAME>` — [description] → **Backend Wizard**
2. `<PROJECT-NAME>-TASK-01-002-<NAME>` — [description] → **Backend Wizard**
3. `<PROJECT-NAME>-TASK-01-003-<NAME>` — [description] → **UI Wizard**

### Next Step
Run `/subagent-execute` and reference the Phase 1 task files to begin execution.
```

---

## What Happens Next (Execution)

After planning is complete, users execute the plan using `/subagent-execute`:

```
/subagent-execute Review docs/projects/<PROJECT-NAME>/phases/<PROJECT-NAME>-PHASE-01-<NAME>.md and execute the Phase 1 task handoffs using subagents.
```

Each worker agent:
1. Reads their task handoff document
2. Implements code changes
3. Writes tests
4. Saves a completion report to `reports/`

---

## References

- [SUBAGENT_FILE_CONVENTIONS.md](../../orchestration/SUBAGENT_FILE_CONVENTIONS.md) — **Read first** — file structure and naming
- [SUBAGENT_ORCHESTRATOR_GUIDE.md](../../orchestration/SUBAGENT_ORCHESTRATOR_GUIDE.md) — System overview
- [SUBAGENT_FEATURE_TEMPLATE.md](../../orchestration/SUBAGENT_FEATURE_TEMPLATE.md) — Master plan template
- [SUBAGENT_PHASE_TEMPLATE.md](../../orchestration/SUBAGENT_PHASE_TEMPLATE.md) — Phase document template
- [SUBAGENT_HANDOFF.md](../../orchestration/SUBAGENT_HANDOFF.md) — Task file schema
- [SUBAGENT_USER_GUIDE.md](../../orchestration/SUBAGENT_USER_GUIDE.md) — User-facing quick start
