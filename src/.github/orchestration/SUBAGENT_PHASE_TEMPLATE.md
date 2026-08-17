# Phase Plan: [Descriptive Title]

## 🎯 Objective

[1-2 sentence description of what this phase delivers and why it's valuable.]

---

## 📚 Required Reading

> Review before starting. Check boxes as you read.

- [ ] [Feature Planning Document](./RELATIVE_LINK_TO_PLANNING.md) - High-level feature plan
- [ ] [Relevant Standards](#) - Standards applicable to this phase

---

## 📂 File Structure Overview

> New files (✨) and modified files (📝) for this phase.

```
libs/
├── domain/
│   ├── contracts/
│   │   └── navigation.contract.ts              ✨ New - Navigation service contract
│   └── models/
│       └── navigation.model.ts                 ✨ New - Navigation domain models
├── application/
│   └── navigation/
│       └── navigation-store.ts                 📝 Modified - Add history tracking
├── infrastructure/
│   └── navigation/
│       ├── navigation.service.ts               ✨ New - Navigation service implementation
│       └── navigation.mapper.ts                ✨ New - DTO to domain mapping
├── features/
│   └── navigation/
│       └── nav-controls/
│           ├── nav-controls.component.ts       ✨ New - Navigation control component
│           ├── nav-controls.component.html     ✨ New - Component template
│           └── nav-controls.component.scss     ✨ New - Component styles
└── app/
    └── shell/
        └── app-shell.component.ts              📝 Modified - Integrate nav controls
```

---

## 📋 Task Authoring Rules

_Remove this section from the final plan — these are guardrails for the orchestrator._

- **WHAT not HOW**: Use class/method/interface names, not implementations. Snippets ≤5 lines only for critical types.
- **Behavioral testing**: Each task includes a testing subtask. Test observable behaviors, not internals.
- **Progress tracking**: Mark checkboxes as you complete each subtask.
- **Specificity**: Every checkbox is a clear, actionable item with artifact names. No vague "implement feature" items.

---

<details open>
<summary><h3>Task 1: [High-Level Task Name]</h3></summary>

**Purpose**: [1-2 sentences — why this task is needed]

**Related Documentation:**
- [Relevant planning section](./RELATIVE_LINK.md#section)
- [Reference pattern](./RELATIVE_LINK.md#section)

**Subtasks:**
- [ ] [Specific action with artifact name — e.g., "Add `propertyName` to `InterfaceName` interface"]
- [ ] [Specific action — e.g., "Create `methodName` method in new file"]
- [ ] [Specific action — e.g., "Update `helperFunction` to handle new parameter"]
- [ ] **Write Tests**: Test behaviors for this task

**Notes:**
- [Important constraint, integration point, or dependency]

**Behaviors to Test:**
- [ ] [Observable behavior — e.g., "Component renders controls when initialized"]
- [ ] [Observable behavior — e.g., "Button disabled when no history exists"]

</details>

<details>
<summary><h3>Task 2: [High-Level Task Name]</h3></summary>

**Purpose**: [1-2 sentences]

**Related Documentation:**
- [Link](./RELATIVE_LINK.md#section)

**Subtasks:**
- [ ] [Specific action]
- [ ] [Specific action]
- [ ] **Write Tests**: Test behaviors for this task

**Behaviors to Test:**
- [ ] [Observable behavior]
- [ ] [Observable behavior]

</details>

<details>
<summary><h3>Task N: [Add more as needed]</h3></summary>
</details>

---

## ✅ Success Criteria

**Functional:**
- [ ] [Feature works as designed — e.g., "User can navigate backward through history"]
- [ ] [Feature works as designed — e.g., "State persists across MFE transitions"]

**Technical:**
- [ ] All tests pass (unit, integration, E2E as applicable)
- [ ] Code follows project coding standards
- [ ] TypeScript/C# compilation succeeds with no errors
- [ ] No console errors or warnings

**Integration:**
- [ ] Works in local development environment
- [ ] No linting or TypeScript errors

---

## 🧪 Testing Strategy

| Layer | Location | Focus |
|-------|----------|-------|
| Unit | `libs/` colocated `*.spec.ts` (Vitest) | Service methods, components, utilities |
| Integration | Vitest | Service interactions, store integration |
| E2E | `apps/teensyrom-ui-e2e/` (Cypress) | User workflows, error recovery |

**Principles**: Test public interfaces, mock at infrastructure boundaries, focus on behavioral outcomes. Test as you go — complete each task's tests before moving on.

---

## 🔄 Workflow

### Before Starting
1. Complete Required Reading checklist
2. Review File Structure — know what you're creating/modifying
3. Understand Success Criteria — know what "done" looks like
4. Ensure local environment is running and baseline tests pass

### During Implementation
1. Implement subtask → Write tests → Run all tests → Fix issues → Check off → Next
2. Mark checkboxes incrementally — don't wait until the end
3. Document discoveries, decisions, and blockers in Phase Notes below

### After Phase Completion
- [ ] All success criteria met
- [ ] All tests pass across all suites
- [ ] Code builds successfully
- [ ] Manual smoke test: happy paths, error scenarios, browser console clean

---

## 📝 Phase Notes

> Capture discoveries, decisions, blockers, and future considerations during implementation.

---

## ❓ Open Questions

> Document uncertainties, needed clarifications, or decisions requiring resolution. Update as questions are answered.

---

## 🔗 Related Resources

- [OVERVIEW_CONTEXT.md](../../docs/OVERVIEW_CONTEXT.md) - Architecture overview
- [CODING_STANDARDS.md](../../docs/CODING_STANDARDS.md) - Code conventions
- [TESTING_STANDARDS.md](../../docs/TESTING_STANDARDS.md) - Testing approach
- `pnpm component-docs list` / `pnpm component-docs get --component-name <name>` - Reusable UI components (`component-library` skill)
- [STYLE_GUIDE.md](../../docs/STYLE_GUIDE.md) - Global styles and utilities

---

_Template Version: 2.0 - TeensyROM Workspace_
