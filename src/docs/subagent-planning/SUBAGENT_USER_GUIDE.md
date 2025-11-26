# Subagent System - User Guide

## 🎯 Quick Start

The subagent system breaks large features into manageable tasks executed across multiple AI contexts to avoid context overflow and maintain quality.

**Key Concept**: Use specialized AI agents (Backend Wizard, UI Wizard) in **fresh contexts** for each task, with planning artifacts saved to disk as the state bridge.

---

## 📋 Two-Step Workflow

### Step 1: Plan the Feature (Once)

**Command**: Run in Architect mode:
```
Follow instructions in .github/prompts/subagent-plan.prompt.md
Project: [Brief feature description]
```

**What happens**:
- ✅ Creates `docs/projects/[project-name]/` folder structure
- ✅ Generates master plan (high-level overview)
- ✅ Creates Phase 1 detailed plan
- ✅ Creates first task handoff document
- ✅ Saves everything to disk

**Output**: Project folder with master plan, phase 1 plan, and Task 1 handoff ready.

---

### Step 2: Execute Tasks (Iterative Loop)

Repeat this loop until all tasks complete:

#### 2a. Execute Task (Worker Context)

**Switch to the assigned agent**:
- Backend work → Backend Wizard chatmode
- Frontend work → UI Wizard chatmode
- Testing work → UI Test Wizard chatmode

**Command**:
```
Execute task: #file:docs/projects/[project-name]/tasks/TASK-[##]-[###]-[NAME].md
```

**Worker does**:
1. Reads task handoff document
2. Implements changes to code files
3. Writes tests
4. Saves completion report to `reports/TASK-[##]-[###]-report.md`

**You do**:
1. ✅ Review code changes in VS Code
2. ✅ Run tests to verify passing
3. ✅ Commit changes to git

---

#### 2b. Plan Next Task (Architect Context)

**Switch back to Architect mode**

**Command**:
```
Follow instructions in .github/prompts/subagent-execute.prompt.md
Project: [project-name]
```

**Architect does**:
1. Reads previous task report from disk
2. Reviews phase progress
3. Creates next task handoff (or next phase if phase complete)
4. Tells you which agent to switch to

**Repeat** 2a → 2b until project complete.

---

## 🗂️ Project Structure

```
docs/projects/[project-name]/
├── master-plan.md              # High-level feature overview (6-8 phases)
├── execution-summary.md        # Progress tracking dashboard
├── phases/
│   ├── phase-01-[name].md     # Detailed implementation guide for phase 1
│   ├── phase-02-[name].md     # Created when phase 2 starts
│   └── ...
├── tasks/
│   ├── TASK-01-001-[name].md  # Executable handoff for task 1
│   ├── TASK-02-001-[name].md  # Created when task ready
│   └── ...
└── reports/
    ├── TASK-01-001-report.md  # Worker's completion report
    ├── TASK-02-001-report.md  # Next worker's report
    └── ...
```

---

## 🎭 Agent Roles

### Architect (You in Architect Mode)
- Plans features and breaks into phases
- Creates task handoffs
- Reviews completion reports
- Adapts plan based on discoveries
- Coordinates execution flow

### Backend Wizard
- Executes backend tasks (.NET, C#, API, domain models)
- Creates/modifies backend code
- Writes backend tests
- Generates completion reports

### UI Wizard
- Executes frontend tasks (Angular, TypeScript, state, components)
- Creates/modifies frontend code
- Writes frontend tests
- Generates completion reports

### UI Test Wizard
- Focuses on testing tasks
- Creates/fixes E2E Cypress tests
- Debugs test failures
- Refines test coverage

---

## 💡 Why This Works

### Context Management
```
Traditional Single Context:
❌ Load entire feature plan (50K tokens)
❌ Load all phases and tasks
❌ Context overflow, agent confusion

Multi-Context Approach:
✅ Architect: Load current phase only (15K tokens)
✅ Worker: Load single task handoff (30K tokens)
✅ State persisted to disk between contexts
✅ Each agent stays focused on their work
```

### Quality Gates
```
After Each Task:
1. Human reviews code changes (catch issues early)
2. Human runs tests (verify functionality)
3. Human commits to git (version control)
4. Architect reads report (adapt plan)
5. Next task planned with updated context
```

---

## 📊 Typical Feature Timeline

| Phase | Tasks | Agent | Human Effort | Est. Time |
|-------|-------|-------|--------------|-----------|
| Planning | - | Architect | 5 min review | 10 min |
| Backend Domain | 1-2 | Backend Wizard | Code review | 30-60 min |
| Backend API | 3-4 | Backend Wizard | Code review, test | 2-3 hours |
| API Client | 1-2 | UI Wizard | Verify regen | 30 min |
| Frontend State | 2-3 | UI Wizard | Code review | 1-2 hours |
| Frontend UI | 2-3 | UI Wizard | UI testing | 1-2 hours |
| Integration | 2-3 | UI Wizard | E2E testing | 1-2 hours |

**Total**: 8-12 hours for medium feature, split across multiple days/sessions

---

## 🚀 Example Session

```bash
# Day 1: Planning + Phase 1
Session 1 (Architect): Plan feature → 10 min
Session 2 (Backend Wizard): Task 1 → 30 min
[Git commit]
Session 3 (Architect): Review + plan Task 2 → 5 min
Session 4 (Backend Wizard): Task 2 → 45 min
[Git commit]

# Day 2: Phase 2
Session 5 (Architect): Review + plan Task 3 → 5 min
Session 6 (Backend Wizard): Task 3 → 60 min
[Git commit]
Session 7 (Architect): Review + plan Task 4 → 5 min
Session 8 (Backend Wizard): Task 4 → 45 min
[Git commit]

# Day 3: Phase 3-4 (Frontend)
Session 9 (Architect): Review + plan Task 5 → 5 min
Session 10 (UI Wizard): Task 5 → 40 min
[Git commit]
... continue until complete
```

---

## ✅ Quality Checklist

### Before Executing Each Task
- [ ] Previous task report reviewed
- [ ] Code from previous task committed to git
- [ ] Switched to correct agent chatmode
- [ ] Task handoff document loaded

### After Each Task Execution
- [ ] Code changes reviewed in VS Code
- [ ] Tests run and passing
- [ ] No console errors or warnings
- [ ] Changes committed to git with clear message
- [ ] Worker's report saved to reports folder

### At Phase Completion
- [ ] All phase tasks complete
- [ ] All tests passing
- [ ] Feature functionality verified manually
- [ ] Ready to proceed to next phase

---

## 🔧 Troubleshooting

### "Agent seems confused about what to do"
**Fix**: Provide the task handoff file directly:
```
Execute task: #file:docs/projects/[project-name]/tasks/TASK-XX-XXX-[NAME].md
```

### "Tests are failing"
**Options**:
1. Ask current worker to fix tests in same session
2. Create separate TASK-XX-XXX-TEST-FIX handoff for UI Test Wizard
3. Review test expectations in task handoff

### "Code doesn't match standards"
**Fix**: Reference standards docs in task handoff:
- Backend: docs/BACKEND_ARCHITECTURE.md, docs/CODING_STANDARDS.md
- Frontend: docs/OVERVIEW_CONTEXT.md, docs/STATE_STANDARDS.md

### "Need to adjust plan mid-execution"
**Process**:
1. Switch to Architect mode
2. Update phase plan markdown file
3. Create new/adjusted task handoffs
4. Continue execution with updated tasks

### "Worker created wrong files"
**Prevention**: Task handoff should specify:
- Exact file paths to create
- Exact file paths to modify
- Reference files to review (context only)

---

## 📚 Reference Documentation

**For Planning**:
- [SUBAGENT_ORCHESTRATOR_GUIDE.md](./SUBAGENT_ORCHESTRATOR_GUIDE.md) - Detailed methodology
- [PLANNING_TEMPLATE.md](../PLANNING_TEMPLATE.md) - Feature planning template
- [PHASE_TEMPLATE.md](../PHASE_TEMPLATE.md) - Phase planning template

**For Execution**:
- [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md) - Task handoff protocol
- [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) - Worker report template

**Chatmodes**:
- `.github/chatmodes/Backend Wizard.chatmode.md`
- `.github/chatmodes/UI Wizard.chatmode.md`
- `.github/chatmodes/UI Test Wizard.chatmode.md`

---

## 💡 Pro Tips

1. **Commit Often**: Commit after each task completion for easy rollback
2. **Fresh Contexts**: Start new chat for each task to avoid context pollution
3. **Review Reports**: Worker reports contain valuable discoveries and decisions
4. **Adapt Plans**: Don't be afraid to adjust phase plans based on learnings
5. **Batch Similar Work**: Group similar tasks (e.g., all backend, then all frontend)
6. **Test Early**: Run tests after each task, not at the end
7. **Read Handoffs**: Review task handoff before handing to worker (spot issues early)

---

## 🎯 Success Metrics

A well-executed project shows:
- ✅ Steady progress (1-2 tasks per session)
- ✅ High-quality code (tests passing, standards followed)
- ✅ Clear traceability (master plan → phases → tasks → reports)
- ✅ Minimal rework (good planning upfront)
- ✅ Focused contexts (agents don't ask for clarification)
- ✅ Complete reports (workers document decisions)

---

**Remember**: The system is designed for **human-in-the-loop orchestration** with **AI-powered execution**. You're the conductor, the AI agents are the musicians. 🎼
