# Subagent Orchestration System — Overview

## 🎯 Purpose

This document provides a high-level overview of the subagent orchestration system — how the pieces fit together, who does what, and where things live. It is a **reference map**, not an operating manual.

For detailed instructions, each agent reads its own `.agent.md` file and the templates referenced below.

---

## 📚 System Documents

| Document | Purpose | Primary Audience |
|----------|---------|------------------|
| [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) | **Read first** — Naming rules and file structure | All agents |
| [SUBAGENT_FEATURE_TEMPLATE.md](./SUBAGENT_FEATURE_TEMPLATE.md) | Master plan template | Project Planner |
| [SUBAGENT_PHASE_TEMPLATE.md](./SUBAGENT_PHASE_TEMPLATE.md) | Phase document template | Project Planner |
| [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md) | Task handoff file schema | Project Planner (writes), Workers (reads) |
| [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) | Completion report template | Worker agents |
| This document | System overview and reference map | Anyone new to the system |

---

## 🤖 Agent Roles

The orchestration system uses three coordinating agents and multiple worker agents:

| Role | Agent | What It Does | What It Creates |
|------|-------|--------------|-----------------|
| **Plan** | [Project Planner](../agents/Project%20Planner.agent.md) | Decomposes features into phases and tasks | Master plans, phase docs, task handoff files |
| **Execute** | [Orchestrator](../agents/Orchestrator.agent.md) | Dispatches workers, monitors reports, adapts plan | Nothing (read-only) — dispatches only |
| **Track** | [Progress Tracker](../agents/Progress%20Tracker.agent.md) | Updates project docs as tasks complete | STATUS.md updates, checkbox edits |
| **Work** | Worker agents (see `.github/agents/`) | Implements code, writes tests | Source code, tests, completion reports |

### Execution Loop

```
Feature Request
      ↓
 Project Planner ──→ Master plan + phase docs + Phase 1 task handoffs
      ↓
   Orchestrator ──→ Dispatches Phase 1 tasks to workers
      ↓                          ↓
 Workers execute          Progress Tracker
 (write code + reports)   (updates docs)
      ↓                          ↑
   Orchestrator ──→ Reviews reports, dispatches Progress Tracker
      ↓
 Project Planner (subagent) ──→ Reads ALL prior reports, creates Phase N+1 tasks
      ↓
   Orchestrator ──→ Dispatches Phase N+1... loop until complete
```

**Key insight**: The Planner reads all prior task reports before creating next-phase tasks, so each phase's handoffs incorporate every discovery, decision, and issue from previous phases.

---

## 📁 Project File Structure

> See [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) for complete naming rules.

```
docs/projects/<PROJECT-NAME>/
├── <PROJECT-NAME>-MASTER-PLAN.md          ← Feature overview, phases, success criteria
├── STATUS.md                               ← Optional progress tracker (5+ task projects)
├── phases/
│   └── <PROJECT-NAME>-PHASE-##-<NAME>.md  ← Phase objectives, file structure, tasks
├── tasks/
│   └── <PROJECT-NAME>-TASK-##-###-<NAME>.md ← Worker instructions (see HANDOFF.md schema)
└── reports/
    └── <PROJECT-NAME>-TASK-##-###-REPORT.md ← Worker completion reports
```

### Benefits

- **Isolation**: Each project is self-contained
- **Traceability**: Plan → phases → tasks → reports
- **Parallel Work**: Multiple projects can run simultaneously
- **Clean Handoffs**: Workers receive clear file paths
- **Historical Record**: Complete audit trail
- **Easy Cleanup**: Remove a project folder without affecting others

---

## 📊 Example: Full Project Decomposition

### Project: FEATURE-X

**Master Plan**: `docs/projects/FEATURE-X/FEATURE-X-MASTER-PLAN.md`

**Phase 1: Foundation (3 tasks)**
```
FEATURE-X-TASK-01-001-DATA-MODELS     → Define domain interfaces and types
FEATURE-X-TASK-01-002-CONFIGURATION   → Create configuration constants
FEATURE-X-TASK-01-003-UTILITIES       → Build helper functions
```

**Phase 2: Backend API (4 tasks)**
```
FEATURE-X-TASK-02-001-API-CONTRACTS   → Define DTOs and request/response models
FEATURE-X-TASK-02-002-DOMAIN-LOGIC    → Implement domain services
FEATURE-X-TASK-02-003-HANDLERS        → Create MediatR command/query handlers
FEATURE-X-TASK-02-004-ENDPOINTS       → Build API endpoints
```

**Phase 3: Frontend State (3 tasks)**
```
FEATURE-X-TASK-03-001-STORE-SETUP     → Create store structure
FEATURE-X-TASK-03-002-ACTIONS         → Implement store actions
FEATURE-X-TASK-03-003-SELECTORS       → Create selectors and computed state
```

**Phase 4: UI Components (4 tasks)**
```
FEATURE-X-TASK-04-001-LIST-COMPONENT      → Create list display component
FEATURE-X-TASK-04-002-DETAIL-COMPONENT    → Create detail view component
FEATURE-X-TASK-04-003-FORM-COMPONENT      → Create input form component
FEATURE-X-TASK-04-004-CONTAINER           → Create smart container component
```

**Phase 5: Integration (2 tasks)**
```
FEATURE-X-TASK-05-001-WIRE-COMPONENTS → Connect components to store and API
FEATURE-X-TASK-05-002-ADD-ROUTING     → Integrate with application routing
```

**Phase 6: Testing & Polish (2 tasks)**
```
FEATURE-X-TASK-06-001-E2E-TESTS       → Create Cypress end-to-end tests
FEATURE-X-TASK-06-002-DOCUMENTATION   → Update user and developer documentation
```

**Total**: 18 tasks across 6 phases

**Execution Strategy**:
- Sequential within phases (avoid file conflicts)
- Phase 3 can start after Phase 2 task 02-004 completes (API contracts established)
- Phase 4 tasks can run in parallel (different component files)
- Phase 5 waits for Phases 3 & 4 completion
- Phase 6 runs after full integration

---

## 🎯 Success Metrics

A well-orchestrated project demonstrates:

- **Minimal back-and-forth**: Workers don't need clarification
- **No conflicts**: No file access conflicts or blocked tasks
- **Steady progress**: Tasks complete without major rework
- **Quality reports**: Workers provide comprehensive completion reports
- **Predictable timeline**: Tasks complete in expected time
- **Clean handoffs**: Context flows smoothly between tasks
- **Aligned outcomes**: Work matches master plan vision

---

## 🤖 Available Worker Agents

All available agents are documented in [`.github/agents/`](../agents/). Each `.agent.md` file contains the agent's description, expertise, and capabilities.

**To assign a task**: Match the task domain to the agent's expertise. The Project Planner specifies agent assignment in each task handoff file.

---

## 📚 Related Documentation

- [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) - Naming rules (single source of truth)
- [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md) - Task file schema
- [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) - Report template
- [SUBAGENT_FEATURE_TEMPLATE.md](./SUBAGENT_FEATURE_TEMPLATE.md) - Master plan template
- [SUBAGENT_PHASE_TEMPLATE.md](./SUBAGENT_PHASE_TEMPLATE.md) - Phase plan template
- [CODING_STANDARDS.md](../../docs/CODING_STANDARDS.md) - Code conventions
- [TESTING_STANDARDS.md](../../docs/TESTING_STANDARDS.md) - Testing approach
