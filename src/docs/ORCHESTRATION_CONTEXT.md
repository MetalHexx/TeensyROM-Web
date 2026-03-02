# Orchestration Agent System — Session Context

> **Purpose**: Carry this document into a new chat to continue development of the orchestration agent system. It captures what was built, key decisions, and what comes next.

---

## What Was Built Today

### Two New Agents

#### 1. Orchestrator ([.github/agents/Orchestrator.agent.md](../.github/agents/Orchestrator.agent.md))

A dedicated project execution coordinator that dispatches work to specialized subagents, monitors their completion reports, and adapts the plan as the project evolves. Key design principles:

- **Model**: Claude Opus 4.6 — heavy reasoning for sequencing and dependency decisions
- **Tools**: Read-only workspace access + `agent` tool for subagent dispatch — NO file editing
- **Subagents**: All agents (`*`)

**Critical rules enforced in the agent instructions**:

1. **Subagents MUST read the handoff doc** — The dispatch prompt must tell the worker to read the task file directly. Never summarize it inline. Includes a correct vs. incorrect example to make this concrete.
2. **Subagents MUST write completion reports** — Every dispatch includes explicit OUTPUT_DOC path and instructions to follow the `SUBAGENT_REPORT.md` template.
3. **Use Progress Tracker for doc updates** — Orchestrator has no file editing tools; it dispatches the Progress Tracker companion for all doc changes.
4. **Delegate emerging work** — Bugs/failures discovered by workers become new dedicated repair tasks, not scope expansions to the original worker.

**Quality checklists and emerging issues table** are embedded directly in the agent (not in a separate skill) so it is fully self-contained.

#### 2. Progress Tracker ([.github/agents/Progress Tracker.agent.md](../.github/agents/Progress%20Tracker.agent.md))

A lightweight companion agent the Orchestrator dispatches to update project documentation. It is the only agent allowed to modify `docs/projects/` files.

- **Model**: Claude Sonnet 4.6 — lightweight doc editing doesn't need Opus
- **Tools**: `edit` + `search` + `todo` — only what's needed to read and update markdown
- **Subagents**: None (`[]`), `disable-model-invocation: true` — only the Orchestrator should call it
- **Scope guardrail**: Instructed to refuse any edits outside `docs/projects/`

Originally named "Plan Scribe" — renamed to "Progress Tracker" to avoid confusion with planning agents.

---

### make-agent Skill Updates ([.github/skills/make-agent/](../.github/skills/make-agent/))

The skill used to create new agents was updated to prevent tool configuration errors that were discovered during this session:

**SKILL.md changes**:
- Added "Subagent Capability" question explaining that `agent` tool is required when `agents` array is set
- Replaced the flat "Built-in Tools" question with a namespaced tool guide (`category/toolname` format)
- Added "Orchestrator" archetype to the Common Agent Archetypes table
- Added two new troubleshooting entries for the errors we encountered

**frontmatter-reference.md changes**:
- Added "Tool Namespacing" critical section at the top explaining the `category/toolname` pattern
- Reorganized individual tools into namespaced categories: `read/`, `search/`, `edit/`, `execute/`, `agent`, `web/`, `vscode/`
- Added "Critical Rules" section with code examples for the two most common errors:
  - `agent` tool required when `agents` array is specified
  - All individual tools must use namespaced format (e.g., `search/codebase` not `codebase`)

---

## Key Decisions Made

### Orchestrator is Self-Contained (No Skill Dependency)

The `subagent-execute` skill exists in `.github/skills/subagent-execute/SKILL.md` but the Orchestrator does NOT use it. Reasons:

- ~90% overlap — the skill and agent covered the same ground
- Agent instructions are stronger — especially Critical Rules 1-4 which the skill doesn't emphasize
- The skill was designed for generic orchestration by any agent; the dedicated Orchestrator agent supersedes it
- Instead, the two valuable additions from the skill (quality checklists + emerging issues table) were folded directly into the agent

The `subagent-execute` skill remains in place unchanged (could be used as a reference or for future purposes).

### Separation of Concerns: Orchestrate vs. Edit

Orchestrator has zero file editing capability by design. All documentation updates are delegated to the Progress Tracker companion. This keeps the Orchestrator's role clear: *coordinate agents*, not *touch files*.

---

## Orchestration System

The orchestration system the agents plug into lives in `.github/orchestration/`:

| File | Purpose |
|------|---------|
| `SUBAGENT_FILE_CONVENTIONS.md` | Single source of truth for all naming rules and file structures |
| `SUBAGENT_ORCHESTRATOR_GUIDE.md` | System overview — how pieces fit together, agent roles, execution loop |
| `SUBAGENT_HANDOFF.md` | Task handoff file schema — canonical definition of task file sections |
| `SUBAGENT_REPORT.md` | Report template workers must follow |
| `SUBAGENT_PHASE_TEMPLATE.md` | Phase document template |
| `SUBAGENT_FEATURE_TEMPLATE.md` | Master plan template |
| `SUBAGENT_USER_GUIDE.md` | User-facing quick start |

Project plans are stored in `docs/projects/<PROJECT-NAME>/` with this structure:

```
docs/projects/<PROJECT-NAME>/
├── <PROJECT-NAME>-MASTER-PLAN.md
├── STATUS.md                    (optional, for 5+ task projects)
├── phases/
│   └── <PROJECT-NAME>-PHASE-<##>-<NAME>.md
├── tasks/
│   └── <PROJECT-NAME>-TASK-<##>-<###>-<NAME>.md
└── reports/
    └── <PROJECT-NAME>-TASK-<##>-<###>-REPORT.md
```

There are also two existing skills that support the planning side:

- `.github/skills/subagent-plan/SKILL.md` — creates master plans, phase plans, and task handoff docs
- `.github/skills/subagent-execute/SKILL.md` — execution skill (now superseded by the Orchestrator agent)

---

## What Was Built: Project Planner Agent

### 3. Project Planner ([.github/agents/Project Planner.agent.md](../.github/agents/Project%20Planner.agent.md))

A dedicated planning agent that decomposes feature requests into orchestration-ready project plans. It creates the master plans, phase documents, and task handoff files that the Orchestrator executes.

- **Model**: Claude Opus 4.6 — deep reasoning for dependency analysis and task decomposition
- **Tools**: `edit` + `search` + `read/readFile` + `read/problems` + `web/fetch` + `todo` + `agent` — needs file editing to create project docs
- **Subagents**: All agents (`*`) — can dispatch research agents (e.g., Architect for design input)
- **Handoff**: "Execute Plan" button → Orchestrator with a prompt to begin Phase 1 execution

**Self-contained design** (same pattern as Orchestrator): The `subagent-plan` skill exists but the Project Planner absorbs its methodology directly. The skill remains as reference material.

**Key design decisions**:

1. **Has file editing tools** — Unlike the Orchestrator (read-only), the Planner creates docs. It writes to `docs/projects/` only.
2. **One-Phase Invariant** — Creates task handoffs for exactly one phase per invocation. Phase 2+ tasks are created by the Orchestrator re-invoking the Planner as a subagent when entering a new phase.
3. **Report-informed planning** — When creating Phase 2+ tasks, reads ALL prior task reports to incorporate discoveries, decisions, and issues. The plan evolves with reality.
4. **Dual invocation** — Works as a primary agent (user-invoked for new projects) and as a subagent (Orchestrator-invoked at phase transitions).
5. **Optimized for Orchestrator consumption** — Task handoffs explicitly include dependency info, file ownership, agent assignment, and parallelization notes.
6. **Two collaboration modes** — `/collaborate` (ask questions, present options) and `/quick-plan` (skip questions, best-judgment defaults).
7. **Complements the Architect** — The Architect designs systems and writes PLANNING_TEMPLATE.md docs. The Planner creates operational orchestration artifacts (master plans, phase docs, task handoffs). Different concerns, different outputs.

### Prompt Files Created

Two prompt files in `.github/prompts/` control the Planner's collaboration style:

| Prompt | Purpose |
|--------|---------|
| `collaborate.prompt.md` | Collaborative mode — asks clarifying questions, presents options, iterates before finalizing |
| `quick-plan.prompt.md` | Quick mode — skips questions, uses defaults, creates all artifacts in one pass |

---

## Complete Orchestration Pipeline

The three orchestration agents form a **loop**, not a one-shot pipeline. The Planner is re-invoked by the Orchestrator at each phase transition:

```
Feature Request
      ↓
 Project Planner        Creates: master plan, phase docs, Phase 1 task handoffs
      ↓ (handoff)
   Orchestrator          Dispatches: Phase 1 tasks to workers, monitors reports
      ↓                       ↓
 Progress Tracker        Project Planner (subagent)
 (updates docs)          (reads prior reports, creates Phase N+1 task handoffs)
      ↑                       ↓
      └──── Orchestrator ─────┘
             Dispatches Phase N+1 tasks... loop until project complete
```

**Key insight**: The Planner reads ALL prior task reports before creating next-phase tasks. This means each phase's task handoffs incorporate every discovery, decision, and issue from previous phases — the plan gets smarter as execution progresses.

**One-Phase Invariant**: The Planner creates task handoffs for exactly one phase per invocation, whether invoked by the user (Phase 1) or by the Orchestrator (Phase N+1). This ensures tasks are always grounded in the latest reality.

---

## What Comes Next

### Potential Improvements

- **Architect → Planner handoff**: Consider adding a handoff button from the Architect agent to the Project Planner, creating a full Design → Plan → Execute → Track pipeline
- **Plan validation**: Could add a review step where the Orchestrator validates a plan's feasibility before execution begins
- **Template evolution**: As more projects are planned, refine the templates based on what works best in practice

---

## Doc Simplification (Completed)

The orchestration docs and agents were originally written for a single-orchestrator model. After splitting into three dedicated agents (Project Planner, Orchestrator, Progress Tracker), the docs had significant duplication and stale content. A simplification pass was completed to align everything:

### Changes Made

**SUBAGENT_HANDOFF.md → "Task Handoff File Schema"**
- Renamed from "Subagent Task Handoff Document" to "Task Handoff File Schema"
- Removed duplicated workflow sections (Handoff Protocol, Worker Guidelines, Progress Tracking, Common Pitfalls) — these now live only in the agent that owns them
- Added clear audience labels: who creates, who reads, who dispatches
- Made section 6 (Code Detail Level) the canonical source — moved include/avoid table and 10-line rule here from the Orchestrator Guide
- Added section 9 (Output Report) as a slim replacement for the old OUTPUT_DOC section
- Flattened the example to remove the INPUT_DOC/OUTPUT_DOC wrapper terminology

**SUBAGENT_ORCHESTRATOR_GUIDE.md → "System Overview"**
- Rewritten from 498-line planning/execution methodology to ~160-line system reference map
- Removed all planning methodology (→ Project Planner agent owns this)
- Removed all execution methodology (→ Orchestrator agent owns this)
- Removed task decomposition, quality checklists, code detail level (→ owned by agents/HANDOFF.md)
- Kept: system documents table, agent roles table, execution loop diagram, project file structure, full decomposition example, success metrics

**Project Planner agent**
- Replaced 10-item Task Handoff Quality Standards (restated HANDOFF.md schema) with a reference to HANDOFF.md + a quality lens checklist
- Updated all reference labels

**Orchestrator agent**
- Updated reference labels (no structural changes — its content was already authoritative)

**All cross-references updated**: User Guide, File Conventions, both agents — all labels now say "System overview" and "Task file schema" instead of the old names

### Ownership Model (Post-Simplification)

| Concern | Single Owner |
|---------|-------------|
| Task file schema | HANDOFF.md |
| Code detail level / 10-line rule | HANDOFF.md §6 |
| Post-task workflow | Orchestrator agent |
| Task sizing & sequencing | Project Planner agent |
| Emerging work policy | Orchestrator agent |
| Quality checklists | Orchestrator agent |
| Worker guidelines | Individual worker agents |

---

## Agent Roster (Current State)

| Agent File | Role | Can Code? | Can Call Subagents? |
|-----------|------|-----------|---------------------|
| `Architect.agent.md` | System design, feature planning | ❌ | ❌ |
| `Senior Engineer.agent.md` | Phase implementation planning | ❌ | — |
| `Product Owner.agent.md` | Requirements and user value | ❌ | — |
| `UI Wizard.agent.md` | Frontend implementation | ✅ | ✅ |
| `UI Test Wizard.agent.md` | Frontend testing | ✅ | — |
| `Backend Wizard.agent.md` | Backend implementation | ✅ | ✅ |
| `Repair Dude.agent.md` | Bug fixing and cleanup | ✅ | — |
| `Doctor Hacker.agent.md` | Fast pragmatic problem-solving | ✅ | — |
| `Mad Scientist.agent.md` | Experimental rapid prototyping | ✅ | — |
| **`Project Planner.agent.md`** | **Project decomposition & planning** | **❌ (docs only)** | **✅ (all)** |
| **`Orchestrator.agent.md`** | **Project execution coordination** | **❌** | **✅ (all)** |
| **`Progress Tracker.agent.md`** | **Project doc updates** | **❌** | **❌** |
