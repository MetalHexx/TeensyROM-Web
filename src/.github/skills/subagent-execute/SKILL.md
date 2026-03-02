---
name: subagent-execute
description: 'Executes a pre-planned subagent orchestration project by handing off tasks to specialized worker agents, monitoring reports, and adapting the plan. Use when asked to "execute a plan", "run subagents", "start execution", "hand off tasks", or when given a project name to execute against an existing docs/projects/<PROJECT-NAME>/ plan folder.'
---

# Subagent Plan Execution

An orchestration skill for executing pre-planned projects by handing tasks to specialized worker agents, monitoring their completion reports, and adapting the plan as work progresses.

## When to Use This Skill

- User invokes `/subagent-execute` followed by a project name or phase reference
- A plan already exists in `docs/projects/<PROJECT-NAME>/` and is ready to execute
- User wants to hand off one or more task handoff documents to worker agents
- User wants to resume a partially-completed project by checking reports and continuing

---

## Prerequisites

- A completed project plan in `docs/projects/<PROJECT-NAME>/` (created via `/subagent-plan`)
- At least one task handoff file in `docs/projects/<PROJECT-NAME>/tasks/`

---

## Complete Execution Process

### Step 1: Read Required Conventions

Before executing, read these files:

```
.github/orchestration/SUBAGENT_FILE_CONVENTIONS.md   ← File structure and naming rules
.github/orchestration/SUBAGENT_ORCHESTRATOR_GUIDE.md ← System overview
```

### Step 2: Load the Project Plan

Read the master plan and current phase to understand state:

```
docs/projects/<PROJECT-NAME>/<PROJECT-NAME>-MASTER-PLAN.md
docs/projects/<PROJECT-NAME>/phases/<PROJECT-NAME>-PHASE-<##>-<NAME>.md
```

**Identify:**
- Current phase number
- Completed tasks (check `reports/` folder for existing `*-REPORT.md` files)
- Next task to execute
- Task dependencies

### Step 3: Select Next Task

Determine the next task based on:
- Task sequence in the phase plan
- Prerequisites completed (check for task reports)
- No file conflicts with concurrent tasks
- Dependencies satisfied

If all Phase N tasks are complete → move to Phase N+1.

### Step 4: Prepare Task Handoff

Read the task handoff document from `tasks/`:

**Verify the task is ready:**
- [ ] All prerequisites completed
- [ ] Dependencies available
- [ ] Agent assigned and available
- [ ] Output report path specified
- [ ] No blocking issues

### Step 5: Hand Off to Worker Agent

Present the task handoff to the user for execution:

```markdown
## 🎯 Task Ready for Execution

**Task**: <PROJECT-NAME>-TASK-<##>-<###>-<NAME>
**Assigned Agent**: [Backend Wizard | UI Wizard | UI Test Wizard]
**Priority**: [High/Medium/Low]

### Task Handoff Document
[Display or link to complete task handoff document]

### Instructions for Worker Agent
1. Read the complete task handoff document
2. Execute all task requirements
3. Write completion report following SUBAGENT_REPORT.md
4. Return report file path when complete

---
**To proceed**: Switch to **[Agent Name]** and provide the task handoff document.
```

### Step 6: Monitor and Adapt (After Task Completion)

When the worker agent returns a report:

1. **Read the Report** at `docs/projects/<PROJECT-NAME>/reports/<PROJECT-NAME>-TASK-<##>-<###>-REPORT.md`

2. **Verify Completion:**
   - [ ] Success criteria met
   - [ ] All files documented
   - [ ] Tests passed
   - [ ] No critical blockers

3. **Handle Outcomes:**

   **COMPLETE** → Mark task done, identify next task, continue
   
   **PARTIAL** → Review blockers, create follow-up task if needed, adjust plan
   
   **BLOCKED** → Assess severity, create unblock task or adjust sequence

4. **Handle Emerging Work** — if worker discovers bugs or failures, create separate repair tasks rather than expanding original scope

5. **Update Planning Docs** — mark completed tasks, update master plan progress, adjust estimates

### Step 7: Continue Execution Loop

Repeat Steps 3–6 until the phase or project is complete, or a blocking issue requires human intervention.

---

## Execution Modes

### Sequential (Default)
Execute tasks one at a time: hand off → wait for report → review → hand off next.
Best for tasks with dependencies or when learning-as-you-go.

### Batch (Optional)
Hand off 2–3 non-conflicting tasks simultaneously to different agents.
Best for parallel components or independent modules with no shared files.

---

## Quality Checks

**Before each handoff:**
- [ ] Prerequisites satisfied
- [ ] Correct agent type assigned
- [ ] No file conflicts with active tasks
- [ ] Success criteria are clear and testable
- [ ] Output report path specified

**After each report:**
- [ ] Success criteria addressed
- [ ] Files match what was planned
- [ ] Tests documented
- [ ] Technical decisions explained
- [ ] Next steps recommended

---

## Progress Communication Format

```markdown
## 📊 Execution Status

**Project**: <project-name>
**Current Phase**: Phase <##> - <name>
**Progress**: [X] of [Y] tasks complete

### Completed Tasks
✅ <PROJECT-NAME>-TASK-<##>-<###>-<NAME> (Agent: [Name])

### Current Task
🔄 <PROJECT-NAME>-TASK-<##>-<###>-<NAME>
   Assigned to: [Agent Name]
   Status: [In Progress | Ready for Handoff]

### Upcoming Tasks
⏳ <PROJECT-NAME>-TASK-XX-XXX-<NAME> (Waiting on: [prerequisites])

---
### Next Action
[Specific instruction for what to do next]
```

---

## Emerging Issues

When workers report problems, create dedicated fix tasks:

| Issue | Task Name Pattern | Assign To |
|-------|------------------|-----------|
| Bug found | `<PROJECT-NAME>-TASK-XX-XXX-BUG-FIX` | Original agent or Repair Dude |
| Tests failing | `<PROJECT-NAME>-TASK-XX-XXX-TEST-FIX` | UI Test Wizard |
| Refactoring needed | `<PROJECT-NAME>-TASK-XX-XXX-REFACTOR` | Appropriate specialist |

---

## References

- [SUBAGENT_FILE_CONVENTIONS.md](../../orchestration/SUBAGENT_FILE_CONVENTIONS.md) — File structure and naming
- [SUBAGENT_ORCHESTRATOR_GUIDE.md](../../orchestration/SUBAGENT_ORCHESTRATOR_GUIDE.md) — System overview
- [SUBAGENT_HANDOFF.md](../../orchestration/SUBAGENT_HANDOFF.md) — Task file schema
- [SUBAGENT_REPORT.md](../../orchestration/SUBAGENT_REPORT.md) — Report template
- [SUBAGENT_USER_GUIDE.md](../../orchestration/SUBAGENT_USER_GUIDE.md) — User-facing quick start
