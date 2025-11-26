# Subagent Orchestrator Planning Guide

## 🎯 Purpose

This guide teaches **Orchestrator Agents** how to use the Subagent Planning System to break down complex projects into manageable, well-sequenced tasks for worker subagents. This system maximizes productivity by ensuring tasks are:

- **Context-appropriate** (fit within agent context windows)
- **Well-defined** (clear objectives and success criteria)
- **Properly sequenced** (avoid conflicts and build dependencies logically)
- **Self-contained** (workers have everything they need)

---

## 📚 System Components

The Subagent Planning System consists of:

1. **[SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md)** - Protocol for handing work to subagents
2. **[SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md)** - Template for subagents to report completion
3. **This document** - Planning methodology for orchestrators
4. **[PHASE_TEMPLATE.md](./PHASE_TEMPLATE.md)** - For planning individual phases
5. **[PLANNING_TEMPLATE.md](./PLANNING_TEMPLATE.md)** - For planning entire features

---

## 🚀 Getting Started: The Orchestration Process

### Step 1: Understand the Overall Project

**Before breaking down any work**, ensure you understand:

1. **Scope**: What is the full feature/project being built?
2. **Requirements**: What are the user and technical requirements?
3. **Constraints**: What are the technical, timeline, or resource constraints?
4. **Context**: What existing code/features does this build upon?
5. **Success**: What does "done" look like for the entire project?

**Actions**:
- Read the project requirements document (PRD, spec, or planning doc)
- Review [PLANNING_TEMPLATE.md](./PLANNING_TEMPLATE.md) for feature-level planning
- Understand the codebase area you'll be working in
- Identify external dependencies and integration points

### Step 2: Create the Master Plan

Create a **Master Planning Document** using [PLANNING_TEMPLATE.md](../PLANNING_TEMPLATE.md) that outlines:

1. **Project Overview** - Feature name, description, user value
2. **Architecture & Design** - High-level decisions and integration points
3. **Phase Breakdown** - Divide into 3-7 logical phases
4. **Dependencies Map** - External, internal, and inter-phase dependencies
5. **Success Criteria** - Measurable completion criteria

Refer to [PLANNING_TEMPLATE.md](../PLANNING_TEMPLATE.md) for detailed structure and examples.

### Step 3: Phase Planning

For each phase, create a **Phase Plan** using [PHASE_TEMPLATE.md](./PHASE_TEMPLATE.md):

1. **Phase Objective**: Clear statement of what this phase delivers
2. **Required Reading**: Link all relevant standards and documentation
3. **File Structure**: Map out what files will be created/modified
4. **Task Breakdown**: Break phase into logical tasks (see Task Decomposition below)
5. **Testing Strategy**: Define testing approach for this phase
6. **Success Criteria**: Specific, measurable completion criteria

### Step 4: Task Decomposition

This is the **most critical step**. Break each phase into individual tasks using these principles:

#### Task Sizing Principles

**Context Window Awareness**:
- **Small**: 1-3 files, simple logic, clear scope (~5-10% of context)
- **Medium**: 4-8 files, moderate complexity (~15-25% of context)
- **Large**: 9-15 files, integration work (~30-40% of context)
- **Extra Large**: 16+ files (⚠️ avoid unless repetitive work like building similar components)
- **Never exceed**: Tasks should not consume more than 50% of context window

**Single Responsibility**:
- Each task should do ONE thing well
- If you need "and" to describe it, consider splitting
- Example: ❌ "Create state AND wire up components" → ✅ Two separate tasks

**Clear Boundaries**:
- Task should have well-defined inputs and outputs
- Minimal coupling with other concurrent tasks
- Clear file ownership (no shared files across concurrent tasks)

#### Task Sequencing Strategy

**Backend-First Approach** (recommended for full-stack features):

```
1. Backend: API Contracts & DTOs
   ↓
2. Backend: Domain Models & Validation
   ↓
3. Backend: MediatR Handlers (Commands/Queries)
   ↓
4. Backend: API Endpoints & OpenAPI Spec
   ↓
5. Frontend: Regenerate API Client
   ↓
6. Frontend: State Management (Store/Actions/Selectors)
   ↓
7. Frontend: Services & Infrastructure
   ↓
8. Frontend: UI Components (Dumb → Smart)
   ↓
9. Frontend: Integration & Routing
   ↓
10. E2E Testing
   ↓
11. Documentation
```

**Frontend-Only Approach** (for UI-only features):

```
1. Contracts & Interfaces
   ↓
2. State Management
   ↓
3. Services & Business Logic
   ↓
4. UI Components (Dumb → Smart)
   ↓
5. Integration & Routing
   ↓
6. E2E Testing
   ↓
7. Documentation
```

**Key Principles**:
- Backend contracts before frontend consumption
- Interfaces before implementations
- Foundation before features
- Components before integration
- Unit tests during implementation, E2E tests at end

#### Conflict Prevention

**File-Level Conflicts**:
```markdown
❌ BAD: Multiple tasks modifying same file concurrently
Task A: Modify player-store.ts to add history state
Task B: Modify player-store.ts to add favorites state
↓
✅ GOOD: Sequential or split ownership
Task A: Modify player-store.ts to add history state
Wait for Task A completion
Task B: Modify player-store.ts to add favorites state

OR

Task A: Modify player-store.ts to add history state
Task B: Modify favorites-store.ts to add favorites state (separate file)
```

**Integration Conflicts**:
```markdown
❌ BAD: Integration task before component tasks
Task 1: Wire up history and favorites in main component
Task 2: Create history component (not started yet!)

✅ GOOD: Complete parts before assembly
Task 1: Create history component
Task 2: Create favorites component
Task 3: Wire up history and favorites in main component
```

**Export/Import Conflicts**:
```markdown
❌ BAD: Multiple tasks modifying same index.ts barrel
Task A: Add exports to actions/index.ts
Task B: Add exports to actions/index.ts

✅ GOOD: Assign barrel updates to single task or sequence
Task A: Create action files (doesn't touch index.ts)
Task B: Create more action files (doesn't touch index.ts)
Task C: Update actions/index.ts with all new exports
```

### Step 5: Create Task Handoff Documents

For each task, create a **Task Handoff** following [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md):

#### Essential Elements

1. **Task Identity**
   ```markdown
   **Task ID**: TASK-[Phase#]-[Sequence#]-[ShortName]
   Example: TASK-02-001-HISTORY-STATE
   
   **Task Name**: [Clear, descriptive name]
   **Assigned To**: [Agent capability needed]
   **Priority**: [High/Medium/Low]
   **Estimated Context Size**: [Small/Medium/Large]
   ```

2. **Crystal Clear Objective**
   ```markdown
   **What**: [One sentence describing what to build]
   **Why**: [One sentence explaining the value]
   **Success Criteria**:
   - [ ] Specific, testable criterion 1
   - [ ] Specific, testable criterion 2
   - [ ] All tests pass
   ```

3. **Complete Context**
   ```markdown
   **Prerequisites Completed**: [What must be done first]
   **Dependencies**: [What this relies on]
   **Constraints**: [Limitations and requirements]
   ```

4. **Precise File Scope**
   ```markdown
   **Files to Create**: [New files with purpose]
   **Files to Modify**: [Existing files with what changes]
   **Files to Review**: [Context-only reference files]
   ```

5. **Implementation Guidance**
   ```markdown
   **Standards to Follow**: [Links to standards docs]
   **Key Requirements**: [Specific requirements with artifact names]
   **Anti-Patterns to Avoid**: [Common mistakes]
   ```

6. **Testing Requirements**
   ```markdown
   **Test Coverage Required**: [Types of tests needed]
   **Behavioral Expectations**: [What should be observable]
   ```

7. **Reference Materials**
   ```markdown
   **Related Documentation**: [Planning docs, examples]
   **Related Tasks**: [Context from other tasks]
   **Reports from Previous Tasks**: [Prior work context]
   ```

8. **Output Specification**
   ```markdown
   **Output Report Location**: docs/reports/TASK-XX-XXX-report.md
   **Report Template**: Follow SUBAGENT_REPORT.md
   ```

### Step 6: Execute and Monitor

Once tasks are defined:

1. **Start First Task**: Hand off task to worker subagent
2. **Monitor Progress**: Wait for completion report
3. **Review Report**: Read OUTPUT_DOC thoroughly
4. **Verify Success**: Check success criteria were met
5. **Update Master Plan**: Note completion and discoveries
6. **Handle Emerging Work**: Delegate bug fixes or test refinements as separate tasks if needed
7. **Plan Next Task**: Refine or adjust based on report
8. **Repeat**: Continue until phase/project complete

**Note**: As work progresses, you may discover bugs, test failures, or refinement needs. Treat these as delegable tasks to specialized repair/testing agents rather than expecting the original worker to handle everything.

---

## 🤖 Available Worker Agents

### Agent Selection Guide

Choose the appropriate specialized agent for each task based on the work domain:

#### Backend Wizard

**Description**: Expert backend architect for .NET API, MediatR CQRS, serial protocol, and storage systems

**Best For**:
- Backend API development (endpoints, DTOs, contracts)
- MediatR command/query handlers
- Serial protocol commands
- Storage service implementations
- Database operations and repositories
- Backend domain logic and services
- OpenAPI specification work

**Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`

**Key Expertise**:
- .NET 9 Web API & RadEndpoints
- MediatR pipeline behaviors (CQRS)
- Serial state machine patterns
- Storage & caching strategies
- Multi-device orchestration
- Backend architecture patterns

---

#### UI Wizard (Frontend)

**Description**: Clean Coder who implements phase plans with rigorous testing, coding standards, and Angular best practices

**Best For**:
- Angular component development (smart & dumb components)
- NgRx Signal Store implementation (state/actions/selectors)
- Frontend services and infrastructure
- Component integration and routing
- TypeScript utilities and helpers
- Material UI integration
- Frontend testing (unit, integration)

**Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`

**Key Expertise**:
- Angular 19 standalone components
- NgRx Signal Store patterns
- Reactive programming with RxJS
- Angular Material theming
- Component library maintenance
- Frontend architecture patterns
- Test-first development

---

#### UI Test Wizard

**Description**: Testing specialist focused on component testing, E2E testing, and test refinement

**Best For**:
- Writing/fixing component tests
- Creating E2E Cypress tests
- Test debugging and refinement
- Test infrastructure setup
- Testing strategy implementation
- Behavioral test coverage

**Chatmode**: `.github/chatmodes/UI Test Wizard.chatmode.md`

**Key Expertise**:
- Vitest component testing
- Cypress E2E testing
- Testing best practices
- Mock strategies
- Behavioral testing patterns

---

### Task Assignment Examples

**Backend Tasks** → **Backend Wizard**:
- TASK-01-001-API-CONTRACTS (Create DTOs and request/response models)
- TASK-02-002-DOMAIN-SERVICES (Implement domain services with business logic)
- TASK-02-003-MEDIATR-HANDLERS (Create command/query handlers)
- TASK-02-004-API-ENDPOINTS (Build RadEndpoints)

**Frontend Tasks** → **UI Wizard**:
- TASK-03-001-USER-STORE (Create NgRx Signal Store)
- TASK-04-001-PROFILE-COMPONENT (Build user profile component)
- TASK-04-003-FORM-COMPONENT (Create reactive form component)
- TASK-05-001-INTEGRATION (Wire components to state and routing)

**Testing Tasks** → **UI Test Wizard**:
- TASK-06-001-COMPONENT-TESTS (Write component unit tests)
- TASK-06-002-E2E-TESTS (Create Cypress E2E test suite)
- TASK-06-003-TEST-REFINEMENT (Fix failing tests and improve coverage)

**Full-Stack Tasks**: Break into separate backend and frontend tasks, assign to appropriate agents

---

### Specifying Agent in Task Handoffs

In each task handoff document, include:

```markdown
**Task ID**: TASK-02-003-DOMAIN-HANDLERS
**Task Name**: Implement MediatR Command and Query Handlers
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium
```

This ensures the orchestrator can:
1. Identify the correct specialist for each task
2. Hand off work to the appropriate agent
3. Track which agent completed which work
4. Maintain specialization and expertise boundaries

---

## 📁 Project File Organization

### Standard Project Structure

Each project/feature should have its own isolated folder structure to prevent mixing contexts:

```
docs/
├── subagent-planning/           # System documentation (this folder)
│   ├── SUBAGENT_ORCHESTRATOR_GUIDE.md
│   ├── SUBAGENT_HANDOFF.md
│   └── SUBAGENT_REPORT.md
│
├── projects/                    # Root for all orchestrated projects
│   │
│   ├── [project-name]/         # Individual project folder
│   │   ├── master-plan.md      # High-level project plan
│   │   ├── phases/             # Phase planning documents
│   │   │   ├── phase-01-[name].md
│   │   │   ├── phase-02-[name].md
│   │   │   └── phase-03-[name].md
│   │   ├── tasks/              # Task handoff documents
│   │   │   ├── TASK-01-001-[name].md
│   │   │   ├── TASK-01-002-[name].md
│   │   │   └── TASK-02-001-[name].md
│   │   ├── reports/            # Worker completion reports
│   │   │   ├── TASK-01-001-report.md
│   │   │   ├── TASK-01-002-report.md
│   │   │   └── TASK-02-001-report.md
│   │   └── decisions/          # Architectural decision records (optional)
│   │       ├── ADR-001-state-management.md
│   │       └── ADR-002-api-design.md
│   │
│   └── [another-project]/      # Completely separate project
│       ├── master-plan.md
│       ├── phases/
│       ├── tasks/
│       └── reports/
```

### Naming Conventions

**Projects**: 
- Use kebab-case: `user-authentication`, `device-manager`, `file-browser`
- Be specific and descriptive

**Phases**: 
- Format: `phase-[##]-[descriptive-name].md`
- Example: `phase-01-foundation.md`, `phase-02-state-management.md`

**Tasks**: 
- Format: `TASK-[Phase#]-[Seq#]-[SHORT-NAME].md`
- Example: `TASK-01-001-API-CONTRACTS.md`, `TASK-02-003-USER-STORE.md`

**Reports**: 
- Format: `TASK-[Phase#]-[Seq#]-report.md`
- Example: `TASK-01-001-report.md`
- Always matches corresponding task file name

### Benefits of This Structure

1. **Isolation**: Each project is self-contained with all its artifacts
2. **Traceability**: Clear links from plan → phases → tasks → reports
3. **Parallel Work**: Multiple projects can be orchestrated simultaneously
4. **Clean Handoffs**: Worker agents receive clear file paths for outputs
5. **Historical Record**: Complete audit trail of planning and execution
6. **Easy Cleanup**: Remove completed project folders without affecting others

### Example Handoff Path References

When creating task handoffs, use project-relative paths:

```markdown
**Output Report Location**: `docs/projects/[project-name]/reports/TASK-01-001-report.md`
```

When referencing planning docs:

```markdown
**Related Documentation**:
- [Master Plan](../master-plan.md)
- [Phase 1 Plan](../phases/phase-01-foundation.md)
- [Previous Task Report](../reports/TASK-01-001-report.md)
```

---

## 🎨 Task Planning Templates

### Template: Contract/Interface Task

```markdown
**Task ID**: TASK-[Phase]-[Seq]-[Name]
**Task Name**: Define [Domain] Interfaces and Types
**Assigned To**: Backend Wizard
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`
**Priority**: High (Foundation)
**Estimated Context Size**: Small

**What**: Create TypeScript interfaces and types for [domain]
**Why**: Establish contracts before implementations to prevent rework

**Success Criteria**:
- [ ] All interfaces defined with complete TypeScript types
- [ ] Interfaces exported from module index
- [ ] JSDoc comments on all public interfaces
- [ ] No dependencies on implementation details

**Files to Create**:
- `libs/[area]/models/[domain].interface.ts`
- `libs/[area]/models/[domain].types.ts`
- `libs/[area]/models/index.ts` (if new module)

**Files to Modify**:
- `libs/[area]/models/index.ts` (if existing)

**Key Requirements**:
1. Define `[InterfaceName]` interface with properties: [list]
2. Create type aliases for [specific types]
3. Export all public types from index.ts

**Testing**: 
- [ ] Verify types compile without errors
- [ ] Test type checking with valid/invalid data examples
```

### Template: State Management Task

```markdown
**Task ID**: TASK-[Phase]-[Seq]-[Name]
**Task Name**: Implement [Feature] State Management
**Assigned To**: UI Wizard
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`
**Priority**: High
**Estimated Context Size**: Medium

**What**: Create NgRx Signal Store for [feature] with actions and selectors
**Why**: Centralized state management for [feature functionality]

**Success Criteria**:
- [ ] Store created following State Standards
- [ ] All actions implemented with proper immutability
- [ ] Selectors created for all state access
- [ ] Unit tests pass with >90% coverage
- [ ] Integration tests verify state transitions

**Prerequisites**:
- TASK-XXX: [Interface definitions] completed

**Files to Create**:
- `libs/application/[feature]-store/[feature]-store.ts`
- `libs/application/[feature]-store/actions/*.ts`
- `libs/application/[feature]-store/selectors/*.ts`
- Test files for all of the above

**Standards to Follow**:
- [State Standards](./STATE_STANDARDS.md)
- [Store Testing](./STORE_TESTING.md)

**Key Requirements**:
1. Add state interface with properties: [list]
2. Create actions: [list action names]
3. Create selectors: [list selector names]

**Testing**:
- [ ] Unit test each action in isolation
- [ ] Unit test each selector computation
- [ ] Integration test action sequences
- [ ] Test edge cases and boundaries
```

### Template: Component Task

```markdown
**Task ID**: TASK-[Phase]-[Seq]-[Name]
**Task Name**: Create [ComponentName] Component
**Assigned To**: UI Wizard
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`
**Priority**: Medium
**Estimated Context Size**: Medium

**What**: Build [component type] component for [feature]
**Why**: Provides UI for [user functionality]

**Success Criteria**:
- [ ] Component created as standalone Angular component
- [ ] Component follows Style Guide and Component Library standards
- [ ] All inputs/outputs properly typed
- [ ] Component tested with behavioral tests
- [ ] Accessibility requirements met

**Prerequisites**:
- TASK-XXX: [State management] completed
- TASK-YYY: [Required services] completed

**Files to Create**:
- `libs/features/[feature]/components/[name]/[name].component.ts`
- `libs/features/[feature]/components/[name]/[name].component.html`
- `libs/features/[feature]/components/[name]/[name].component.scss`
- `libs/features/[feature]/components/[name]/[name].component.spec.ts`

**Standards to Follow**:
- [Component Library](./COMPONENT_LIBRARY.md)
- [Style Guide](./STYLE_GUIDE.md)
- [Smart Component Testing](./SMART_COMPONENT_TESTING.md)

**Key Requirements**:
1. Component inputs: [list with types]
2. Component outputs: [list with types]
3. Behaviors: [list expected behaviors]

**Testing**:
- [ ] Test component renders correctly
- [ ] Test user interactions emit correct outputs
- [ ] Test input changes update view
- [ ] Test accessibility (keyboard navigation, ARIA)
```

### Template: Integration Task

```markdown
**Task ID**: TASK-[Phase]-[Seq]-[Name]
**Task Name**: Integrate [Component/Feature] with [System]
**Assigned To**: UI Wizard
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`
**Priority**: Medium
**Estimated Context Size**: Small-Medium

**What**: Wire up [component/feature] to [state/service/API]
**Why**: Complete the feature by connecting all pieces

**Success Criteria**:
- [ ] Components properly injected with dependencies
- [ ] State correctly flows from store to components
- [ ] User actions trigger correct store actions
- [ ] Integration tests verify end-to-end flow

**Prerequisites**:
- TASK-XXX: [Component] completed
- TASK-YYY: [State] completed
- TASK-ZZZ: [Service] completed

**Files to Modify**:
- `libs/features/[feature]/[container].component.ts`
- `libs/features/[feature]/[feature].routes.ts`
- `libs/application/[feature]-store/index.ts` (exports)

**Key Requirements**:
1. Inject [store/service] into [component]
2. Connect component inputs to store selectors
3. Connect component outputs to store actions
4. Update routing configuration

**Testing**:
- [ ] Integration test: User action → Store update → UI update
- [ ] Integration test: Edge cases and error handling
```

---

## 🔄 Adaptive Planning

### Handling Subagent Reports

After each task completion:

1. **Read the Report Thoroughly**
   - Success criteria met?
   - Any blockers or issues?
   - Technical decisions made?
   - Discoveries or insights?

2. **Assess Impact on Plan**
   - Does next task need adjustment?
   - Are there new dependencies discovered?
   - Should task priority change?
   - Is estimated size still accurate?

3. **Update Master Plan**
   - Mark task complete
   - Note any architectural decisions
   - Update dependency graph if needed
   - Adjust remaining task definitions

4. **Refine Next Task**
   - Incorporate learnings from report
   - Pass relevant context forward
   - Adjust scope if needed
   - Update prerequisites

### Handling Blockers

When a subagent reports a blocker:

**High Severity Blockers** (prevent completion):
1. Assess if blocker affects other tasks
2. Determine if blocker needs external resolution
3. Consider alternative approach or workaround
4. Potentially re-sequence tasks to work around
5. Create unblock task if needed

**Medium Severity Blockers** (slow progress):
1. Evaluate if task can proceed with temporary workaround
2. Plan follow-up task to resolve properly
3. Document technical debt introduced

**Low Severity Blockers** (future concern):
1. Note in technical debt log
2. Continue with current task
3. Plan future refactoring task if needed

### Adjusting Task Scope

If a task proves too large:

1. **Split the Task**:
   - Identify natural split points
   - Ensure each part is independently valuable
   - Maintain clear dependencies
   - Re-sequence if needed

2. **Reduce Scope**:
   - Move "nice-to-have" items to future task
   - Focus on core requirements first
   - Plan follow-up enhancement task

3. **Simplify Approach**:
   - Consider simpler implementation
   - Defer optimization to later task
   - Use temporary solution with plan to refine

---

## ✅ Quality Checklist for Task Handoffs

Before handing off any task, verify:

### Clarity
- [ ] Task objective is crystal clear (one sentence "What" and "Why")
- [ ] Success criteria are specific and testable
- [ ] File scope is explicit (create vs modify vs review)
- [ ] Expected outcomes are measurable

### Context
- [ ] All prerequisites are listed and completed
- [ ] Dependencies are clearly identified
- [ ] Relevant prior work reports are attached
- [ ] Standards documents are linked

### Completeness
- [ ] Worker has everything needed to start immediately
- [ ] No assumptions about codebase knowledge
- [ ] Anti-patterns and pitfalls are called out
- [ ] Testing requirements are explicit

### Feasibility
- [ ] Task fits comfortably in context window
- [ ] Task is completable in reasonable time
- [ ] No file conflicts with concurrent tasks
- [ ] Dependencies are available

### Traceability
- [ ] Task has unique ID
- [ ] Task ID follows convention
- [ ] Output report path is specified
- [ ] Links back to master plan

---

## 📊 Example: Full Project Decomposition

### Project: Feature X (Generic Example)

**Master Plan**: `docs/projects/feature-x/master-plan.md`

**Phase 1: Foundation (3 tasks)**
```
TASK-01-001-DATA-MODELS     → Define domain interfaces and types
TASK-01-002-CONFIGURATION   → Create configuration constants
TASK-01-003-UTILITIES       → Build helper functions
```

**Phase 2: Backend API (4 tasks)**
```
TASK-02-001-API-CONTRACTS   → Define DTOs and request/response models
TASK-02-002-DOMAIN-LOGIC    → Implement domain services
TASK-02-003-HANDLERS        → Create MediatR command/query handlers
TASK-02-004-ENDPOINTS       → Build API endpoints
```

**Phase 3: Frontend State (3 tasks)**
```
TASK-03-001-STORE-SETUP     → Create store structure
TASK-03-002-ACTIONS         → Implement store actions
TASK-03-003-SELECTORS       → Create selectors and computed state
```

**Phase 4: UI Components (4 tasks)**
```
TASK-04-001-LIST-COMPONENT      → Create list display component
TASK-04-002-DETAIL-COMPONENT    → Create detail view component
TASK-04-003-FORM-COMPONENT      → Create input form component
TASK-04-004-CONTAINER           → Create smart container component
```

**Phase 5: Integration (2 tasks)**
```
TASK-05-001-WIRE-COMPONENTS → Connect components to store and API
TASK-05-002-ADD-ROUTING     → Integrate with application routing
```

**Phase 6: Testing & Polish (2 tasks)**
```
TASK-06-001-E2E-TESTS       → Create Cypress end-to-end tests
TASK-06-002-DOCUMENTATION   → Update user and developer documentation
```

**Total: 18 tasks across 6 phases**

**Execution Strategy**:
- Sequential within phases (avoid file conflicts)
- Phase 3 can start after Phase 2 Task 4 completes (API contracts established)
- Phase 4 tasks can run in parallel (different component files)
- Phase 5 waits for Phases 3 & 4 completion
- Phase 6 runs after full integration

---

## 🎯 Success Metrics

A well-orchestrated project demonstrates:

- ✅ **Minimal back-and-forth**: Workers don't need clarification
- ✅ **No conflicts**: No file access conflicts or blocked tasks
- ✅ **Steady progress**: Tasks complete without major rework
- ✅ **Quality reports**: Workers provide comprehensive completion reports
- ✅ **Predictable timeline**: Tasks complete in expected time
- ✅ **Clean handoffs**: Context flows smoothly between tasks
- ✅ **Aligned outcomes**: Work matches master plan vision

---

## 📚 Related Documentation

- [SUBAGENT_HANDOFF.md](./SUBAGENT_HANDOFF.md) - Handoff protocol
- [SUBAGENT_REPORT.md](./SUBAGENT_REPORT.md) - Report template
- [PHASE_TEMPLATE.md](./PHASE_TEMPLATE.md) - Phase planning
- [PLANNING_TEMPLATE.md](./PLANNING_TEMPLATE.md) - Feature planning
- [CODING_STANDARDS.md](./CODING_STANDARDS.md) - Code conventions
- [TESTING_STANDARDS.md](./TESTING_STANDARDS.md) - Testing approach

---

## 🚀 Quick Start Checklist

When starting a new project orchestration:

1. [ ] Read and understand project requirements
2. [ ] Review relevant areas of codebase
3. [ ] Create master planning document
4. [ ] Break project into logical phases (3-7 phases)
5. [ ] For first phase, create detailed phase plan
6. [ ] Decompose phase into tasks (layer-based sequencing)
7. [ ] Create handoff document for first task
8. [ ] Hand off first task to worker subagent
9. [ ] Monitor and receive completion report
10. [ ] Review report and plan next task
11. [ ] Repeat until phase complete
12. [ ] Move to next phase

**Remember**: You're not just assigning tasks—you're architecting a workflow that enables autonomous, high-quality execution by specialized agents. Think carefully about dependencies, conflicts, and context needs.

---

**Happy Orchestrating!** 🎭
