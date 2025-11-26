# Subagent Orchestration System - Quick Reference

## 📋 System Overview

The Subagent Orchestration System enables planning agents to decompose complex projects into focused, context-appropriate tasks for specialized worker agents.

## 🗂️ Core Documents

| Document | Purpose | Audience |
|----------|---------|----------|
| [SUBAGENT_ORCHESTRATOR_GUIDE.md](./SUBAGENT_ORCHESTRATOR_GUIDE.md) | Complete orchestration methodology | Planning/Orchestrator Agents |
| [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md) | Task handoff protocol and structure | Orchestrators & Workers |
| [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) | Completion report template | Worker Agents |

## 📁 File Organization

```
docs/
├── subagent-planning/          # System docs (this folder)
└── projects/                   # All orchestrated projects
    └── [project-name]/
        ├── master-plan.md
        ├── phases/
        ├── tasks/
        └── reports/
```

## 🤖 Available Agents

| Agent | Specialty | Best For |
|-------|-----------|----------|
| **Backend Wizard** | .NET API, MediatR, Serial Protocol | Backend endpoints, handlers, domain logic |
| **UI Wizard** | Angular, NgRx, Components | Frontend components, state, services |
| **UI Test Wizard** | Testing specialist | Unit tests, E2E tests, test refinement |

See [SUBAGENT_ORCHESTRATOR_GUIDE.md](./SUBAGENT_ORCHESTRATOR_GUIDE.md#-available-worker-agents) for detailed agent selection guidance.

1. **Read** [SUBAGENT_ORCHESTRATOR_GUIDE.md](./SUBAGENT_ORCHESTRATOR_GUIDE.md)
2. **Create** master plan using [PLANNING_TEMPLATE.md](../PLANNING_TEMPLATE.md)
3. **Break down** into phases (3-7 typically)
4. **Decompose** phases into tasks (1-15 files per task)
5. **Create** task handoffs using [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md) structure
6. **Monitor** worker reports and adapt plan

## 🎯 Task Sizing

| Size | Files | Complexity | Context Usage |
|------|-------|------------|---------------|
| Small | 1-3 | Simple, clear scope | 5-10% |
| Medium | 4-8 | Moderate | 15-25% |
| Large | 9-15 | Integration work | 30-40% |
| Extra Large | 16+ | ⚠️ Avoid unless repetitive | 40-50% |

## 🔄 Execution Flow

```
1. Orchestrator creates task handoff
   ↓
2. Worker receives INPUT_DOC
   ↓
3. Worker executes task
   ↓
4. Worker writes report to OUTPUT_DOC
   ↓
5. Orchestrator reads report
   ↓
6. Orchestrator plans next task
   ↓
Repeat until project complete
```

## 🏗️ Task Sequencing (Backend-First)

```
Backend Contracts → Backend Domain → Backend Handlers → Backend Endpoints
   ↓
Frontend API Client Regeneration
   ↓
Frontend State → Frontend Services → Frontend Components
   ↓
Integration & Routing → E2E Testing → Documentation
```

## 📝 Task Handoff Checklist

- [ ] Task ID follows convention: `TASK-[Phase#]-[Seq#]-[NAME]`
- [ ] Agent assigned (Backend Wizard | UI Wizard | UI Test Wizard)
- [ ] Agent Chatmode path specified
- [ ] Clear "What" and "Why" (1 sentence each)
- [ ] Specific, testable success criteria
- [ ] Files to create/modify explicitly listed
- [ ] Prerequisites and dependencies identified
- [ ] Standards documents linked
- [ ] Anti-patterns called out
- [ ] Testing requirements specified
- [ ] OUTPUT_DOC path specified in project structure
- [ ] Related tasks and reports referenced

## 📊 Report Checklist (For Workers)

- [ ] Completion status clearly stated
- [ ] All files created/modified documented
- [ ] Test results with metrics
- [ ] Technical decisions explained
- [ ] Blockers flagged with severity
- [ ] Next steps recommended
- [ ] Report saved to OUTPUT_DOC path
- [ ] File path returned to orchestrator

## ⚠️ Common Pitfalls

**Orchestrators:**
- ❌ Tasks > 15 files
- ❌ Missing context/prerequisites
- ❌ Frontend before backend contracts
- ❌ File conflicts between concurrent tasks

**Workers:**
- ❌ Scope creep beyond assignment
- ❌ Skipping tests
- ❌ Incomplete reports
- ❌ Not reporting blockers early

## 🎓 Key Principles

1. **Backend-First**: API contracts before frontend consumption
2. **Small Tasks**: 1-3 files is ideal, 15 is maximum
3. **Complete Context**: Workers shouldn't need to ask questions
4. **Delegate Fixes**: Create separate tasks for bugs/refinements
5. **Test During**: Unit tests with implementation, E2E at end
6. **Document Everything**: Reports enable adaptive planning

## 📚 Related Standards

- [PLANNING_TEMPLATE.md](../PLANNING_TEMPLATE.md) - Feature planning
- [PHASE_TEMPLATE.md](../PHASE_TEMPLATE.md) - Phase planning
- [BACKEND_ARCHITECTURE.md](../BACKEND_ARCHITECTURE.md) - Backend patterns
- [CODING_STANDARDS.md](../CODING_STANDARDS.md) - Code conventions
- [TESTING_STANDARDS.md](../TESTING_STANDARDS.md) - Testing approach

## 💡 Tips

- **For New Orchestrators**: Start with small projects (3-4 phases, 10-15 tasks total)
- **For Project Setup**: Create project folder in `docs/projects/` first
- **For Task Creation**: Use templates in ORCHESTRATOR_GUIDE as starting points
- **For Parallel Work**: Only parallelize tasks with no file overlap
- **For Emerging Issues**: Don't expand task scope—delegate to specialists

---

**Quick Links:**
- [Full Orchestrator Guide](./SUBAGENT_ORCHESTRATOR_GUIDE.md)
- [Handoff Protocol](./SUBAGENT_HANDOFF.md)
- [Report Template](./SUBAGENT_REPORT.md)
- [Projects Folder](../projects/)
