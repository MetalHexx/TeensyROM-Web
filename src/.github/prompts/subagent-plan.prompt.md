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

## Key Requirements

- **Backend-first sequencing** for full-stack features (see [BACKEND_ARCHITECTURE.md](../../docs/BACKEND_ARCHITECTURE.md))
- **Task sizing**: Small (1-3 files), Medium (4-8 files), Large (9-15 files)
- **No file conflicts** between concurrent tasks
- **Complete context** in every task handoff
- **Project isolation** - each project in its own folder

## Deliverables

Create all planning documents and provide a summary report showing:
- Project structure created
- Phase breakdown
- Task list for Phase 1 (ready for execution)
- Execution recommendations (dependencies, parallel opportunities, critical path)

## Reference

Follow **all guidance** from [SUBAGENT_ORCHESTRATOR_GUIDE.md](../../docs/subagent-planning/SUBAGENT_ORCHESTRATOR_GUIDE.md) - it contains the complete methodology, templates, examples, and quality standards.
