---
description: Create a comprehensive master plan and task decomposition using the subagent orchestration system
tools: ['edit', 'runNotebooks', 'search', 'runCommands', 'runTasks', 'Nx Mcp Server/*', 'usages', 'vscodeAPI', 'problems', 'changes', 'testFailure', 'openSimpleBrowser', 'fetch', 'githubRepo', 'todos', 'runSubagent', 'runTests']
---

# Subagent Project Planning

You are an expert orchestrator agent. Create a complete project plan and task decomposition following the methodology in [SUBAGENT_ORCHESTRATOR_GUIDE.md](../../docs/subagent-planning/SUBAGENT_ORCHESTRATOR_GUIDE.md).

## Your Task

Read the **user's project description** provided as the parameter to this command.

Then execute the **complete orchestration process** from the guide:

1. **Understand the project** - Review requirements, analyze codebase, identify scope
2. **Create project structure** - Set up `docs/projects/[project-name]/` with folders
3. **Generate master plan** - Use [PLANNING_TEMPLATE.md](../../docs/PLANNING_TEMPLATE.md) 
4. **Decompose into phases** - Create phase documents using [PHASE_TEMPLATE.md](../../docs/PHASE_TEMPLATE.md)
5. **Create task handoffs** - Generate task documents following [SUBAGENT_HANDOFF.md](../../docs/subagent-planning/SUBAGENT_HANDOFF.md)
6. **Provide execution summary** - Roadmap with dependencies and first task identified

---

## ⚠️ CRITICAL: File Structure & Naming

> **🔴 MANDATORY**: Read [SUBAGENT_FILE_CONVENTIONS.md](../../docs/subagent-planning/SUBAGENT_FILE_CONVENTIONS.md) BEFORE creating any files.
>
> This is the **single source of truth** for all naming conventions. Do NOT deviate from it.

**Quick Summary** (see conventions doc for full rules):

```
docs/projects/<project-name>/           ← kebab-case
├── master-plan.md                      ← exact filename
├── phases/
│   └── phase-<##>-<name>.md            ← lowercase name
├── tasks/
│   └── TASK-<##>-<###>-<NAME>.md       ← UPPERCASE name
└── reports/
    └── TASK-<##>-<###>-report.md
```

---

## Key Requirements

- **Backend-first sequencing** for full-stack features (see [BACKEND_ARCHITECTURE.md](../../docs/BACKEND_ARCHITECTURE.md))
- **Task sizing**: Small (1-3 files), Medium (4-8 files), Large (9-15 files)
- **No file conflicts** between concurrent tasks
- **Complete context** in every task handoff
- **Project isolation** - each project in its own folder

---

## Deliverables Checklist

Before finishing, verify you created:

- [ ] `docs/projects/<project-name>/master-plan.md`
- [ ] `docs/projects/<project-name>/phases/` folder with all phase files
- [ ] `docs/projects/<project-name>/tasks/` folder with Phase 1 task files
- [ ] `docs/projects/<project-name>/reports/` folder (empty, for worker use)
- [ ] Summary report showing phase breakdown and execution order

## Reference

- **File Conventions**: [SUBAGENT_FILE_CONVENTIONS.md](../../docs/subagent-planning/SUBAGENT_FILE_CONVENTIONS.md) - **READ FIRST**
- **Orchestration Guide**: [SUBAGENT_ORCHESTRATOR_GUIDE.md](../../docs/subagent-planning/SUBAGENT_ORCHESTRATOR_GUIDE.md) - Complete methodology
