# Subagent System - User Guide

## 🎯 Quick Start

The subagent system breaks large features into manageable tasks executed across multiple AI contexts to avoid context overflow and maintain quality.

**Key Concept**: Use the Coding Wizard agent in **fresh contexts** for each phase or task, with planning artifacts saved to disk as the state bridge.

---

## 📋 Two-Step Workflow

### Step 1: Plan the initial Project

**Command**:

Use the `/subagent-plan` slash command.  For example:

```
/subagent-plan Let's plan to build a new workspace selector feature...<insert more details here>
```

**What happens**:
- ✅ Creates `docs/projects/<PROJECT-NAME>/` folder structure
- ✅ Generates master plan (high-level overview)
- ✅ Creates multiple phase planning documents.
- ✅ Creates task handoff document(s) for the first phase.
- ✅ Saves  the project plan markdown documents to disk.

**Output**: Project folder with master plan, phase plans, and phase 1 task handoffs.  See: [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md)

---

### Step 2: Execute Phase or Individual Tasks (Iterative Loop)

Repeat this loop until all phases / tasks complete:

**Switch Agent**
Select an agent best suited to executing a particular phase or task.

**Command**:
Use the '`/subagent-execute`' slash command.  For example:

```
/subagent-execute Review the docs/projects/WORKSPACE-SELECTOR/phases/WORKSPACE-SELECTOR-PHASE-01-CREATE-COMPONENTS.md and let's execute phase 1 task handoff documents using subagents.
```
> **Note**: You can also chose to execute a single specific task from a phase if you want to work carefully with additional oversight. 

**Worker agent does the following**:
For each task that was specified for execution: 
1. Reads task handoff document
2. Implements changes to code files
3. Writes tests
4. Saves completion report to `docs/projects/<PROJECT-NAME>/reports/<PROJECT-NAME>-TASK-<##>-<###>-REPORT.md`

**You do**:
1. ✅ Review code changes in VS Code
2. ✅ Run tests to verify passing
3. ✅ Commit changes to git

> **⚠️ IMPORTANT**: See [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) for complete file structure and naming conventions.

---

#### 2b. Plan Next Phase

**Switch back to your desired  planning agent**

**Command**:
```
/subagent-plan Review the docs/projects/WORKSPACE-SELECTOR/phases/WORKSPACE-SELECTOR-PHASE-02-INTEGRATE-COMPONENTS.md and create the task handoffs.
```

**Planning Agent does the following**:
1. Reads previous task report from disk
2. Reviews phase progress
3. Creates next task handoff (or next phase if phase complete)
4. Tells you which agent to switch to

**Repeat** 2a → 2b until project complete.

> **Note**:
> Consider your context usage and task complexity.  It often makes sense to use a new chat windows when moving between tasks or phases.  The task report documents that are generated from prior task completions make it very easy to pick up where you left off in a previous chat window.

---

## 💡 Why This Works

### Context Management
```
Traditional Single Context:
❌ Load entire feature plan (50K tokens)
❌ Load all phases and tasks
❌ Context overflow, agent confusion

Multi-Context Approach:
✅ Orchestration Agent: Load current phase only
✅ Worker: Load single task handoff
✅ State persisted to disk between contexts
✅ Each agent stays focused on their work
```
---

## 📚 Reference Documentation

**File Conventions** (read first):
- [SUBAGENT_FILE_CONVENTIONS.md](./SUBAGENT_FILE_CONVENTIONS.md) - **Single source of truth for naming**

**For Planning**:
- [SUBAGENT_ORCHESTRATOR_GUIDE.md](./SUBAGENT_ORCHESTRATOR_GUIDE.md) - System overview
- [SUBAGENT_FEATURE_TEMPLATE.md](./SUBAGENT_FEATURE_TEMPLATE.md) - Feature planning template
- [SUBAGENT_PHASE_TEMPLATE.md](./SUBAGENT_PHASE_TEMPLATE.md) - Phase planning template

**For Execution**:
- [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md) - Task file schema
- [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) - Worker report template

**Agents**:
- See `.github/agents/` for available specialized agents and their capabilities

---

## 💡 Pro Tips

1. **Read Handoffs**: Review task handoff before handing to worker (spot issues early)
2. **Batch Similar Work**: Group similar tasks (e.g., all backend, then all frontend)
3. **Test Early**: Run tests after each task, not at the end
4. **Review Reports**: Worker reports contain valuable discoveries and decisions.  You can review these manually or have an agent review them.  Agents will often automatically read them before starting the next phase.
5. **Commit Often**: Commit after each task completion for easy rollback
6. **Fresh Contexts**: Start new chat for each task or phase to avoid context pollution
7. **Use Subagents**:  
- When using the `/subagent-execute` prompt, give additional instructions to the agent to execute using `subagents`.  
- This will spawn worker subagents that can do the work without consuming your current chat context window and may lead to better results.
8. **Change of plans?**
- The system handles changes in plans quite well.
- Use **decimal sub-phase numbering** (e.g., Phase 2.1, 2.2) to insert new phases without renumbering existing ones. This preserves all cross-references in later phases.
- For example, if you realize you need additional work after Phase 2 but before Phase 3:
```
/subagent-plan We just completed this phase: docs/projects/WORKSPACE-SELECTOR/phases/WORKSPACE-SELECTOR-PHASE-02-INTEGRATE-COMPONENTS.md.  However, I realized we have some additional work before we move onto phase 3.  Create a new phase 02.1.  <Insert your instructions for what needs to be accomplished in the new phase> and create task handoff documents for Phase 02.1.
```