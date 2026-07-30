---
name: chrome-devtools-mcp
description: 'Visual UI verification workflow using Chrome DevTools MCP. Use when validating component rendering, CSS/styling changes, layout regressions, interactive UI behavior, screenshots, and post-change visual checks.  Use this skill when the user is having trouble with styling or UI work or is trying to change the visual appearance of the app.'
---

# Chrome DevTools MCP Skill

A focused workflow for reliable UI verification with Chrome DevTools MCP.

## ⚠️ Required First Step: Read the Local UI Controls Reference

**Before any DevTools interaction**, read [`UI_CONTROLS.md`](UI_CONTROLS.md). It contains:

- **Routes** — where each view lives (`/devices`, `/player`, `/settings`)
- **Blocking dialogs** — modal dialogs (e.g., `"Finding Devices"`) that block ALL interaction and require wait strategies
- **Control lookup tables** — every button, toggle, filter, and input with its `data-testid`, aria label, and icon
- **Ready signals** — how to know a view has finished loading
- **Common recipes** — step-by-step patterns for navigation, file launch, search, device enable, and settings changes

This lookup eliminates guesswork and reduces snapshot-hunting. Use it as your primary element-finding reference.

## How to Use `UI_CONTROLS.md` During Execution

1. Pick target route and view-ready signal from the **Routes** table.
2. Check **Critical: Blocking Dialogs** before attempting any click/fill.
3. Locate control using the most specific identifier in this order:
	- `data-testid`
	- exact aria label
	- stable heading/section text
4. Execute the minimum interaction, then validate with the matching ready signal.
5. Re-snapshot after any navigation/reload/modal close.

Use this file as the deterministic source of truth for control discovery; avoid exploratory clicking unless identifiers fail.

## When to Use This Skill

Use this skill when the task includes any of the following:

- Verify visual UI changes after implementation
- Invesgate difficult styling/layout bugs with computed style inspection
- Validate responsive behavior across breakpoints
- Validate component styling, spacing, typography, or responsive behavior
- Confirm interactive UI state changes (click, hover, form, dialogs)
- Capture screenshots/snapshots for verification

## Guardrails

### 1) Ask User Before Engaging Chrome DevTools MCP (Required)

Before calling DevTools MCP tools, ask the user for confirmation.

Use a concise confirmation such as:

- "Do you want me to use Chrome DevTools MCP for visual verification now?"

If user declines:

- Continue with non-DevTools validation (code review, tests, lint, static checks)
- Note what visual checks remain unverified

If the user previously consented to DevTools MCP in this session, or explicitly prompted you to use it, you can skip asking for permission.

### 2) Prefer Subagent for Context Efficiency

Use `runSubagent` to make Chrome DevTools MCP tool calls when visual validation is multi-step or broad scope, for example:

- Multiple pages/routes/components need verification
- Baseline vs. after-change comparison across several states
- Combined checks (snapshot, screenshot, console, network) in one run
- Return results to calling agent for final reporting

Keep work in the primary agent when only a single quick check is needed and there is plenty of context window availability.

## Standard Execution Flow

1. **Read `UI_CONTROLS.md`** for element identifiers and ready signals.
2. Confirm DevTools MCP usage with the user.
3. Ensure target app is reachable (reuse running dev server when available).
4. Open or select the target page.
5. **Check for blocking dialogs** (see `UI_CONTROLS.md` § "Critical: Blocking Dialogs"). Wait for them to clear.
6. Take a fresh snapshot before interactions.
7. **Use lookup tables** from `UI_CONTROLS.md` to find elements by `data-testid` or aria label.
8. Perform the minimal interaction sequence required for verification.
9. If action triggers reload/device refresh, follow the reload-wait loop below.
10. Re-snapshot after state settles, then validate expected visual outcomes.
11. Capture screenshot only when needed for proof or diff.
12. Report pass/fail with exact UI expectations checked.

## Device Reload Wait Strategy (Required)
The when refreshing the browser or performing navigation, the application will re-discover devices which can take a few seconds.  To handle this:

- Do not assert immediately after triggering reload
- Wait a few seconds for reload to complete (typically 2-5s)
- Re-query page state (new snapshot and/or targeted wait)
- Validate only after expected content is present

Recommended sequence:

1. Trigger action that reloads devices.
2. Use `wait_for` with a stable readiness signal if available.
3. Add a short buffer wait when needed for post-render hydration.
4. Refresh snapshot (UIDs can change after reload).
5. Re-locate elements and then assert.

If the expected element is still missing:

- Retry once with a slightly longer wait
- Re-snapshot and re-check selectors/UIDs
- Report clearly if app state never stabilized

## Styling Root-Cause Workflow (Computed Styles)

When a visual mismatch is detected, inspect **computed styles** before changing code.

- Compare expected vs actual values for key properties (for example `display`, `position`, `width/height`, `margin`, `padding`, `font-size`, `line-height`, `color`, `background`, `z-index`)
- Check inherited properties from parent containers to understand cascading effects
- Identify whether the final value comes from utility classes, component styles, theme tokens, or inline styles
- Validate state-dependent styling (`:hover`, `:focus`, disabled/selected/active states)
- Trace layout relationships between parent and child computed values before concluding root cause

Use computed-style inspection to answer:

1. Which property is wrong?
2. Which selector/source wins in the cascade?
3. Which parent/container rule contributes to the observed result?
4. Is the issue due to timing/state (pre-load vs settled UI) rather than CSS itself?

## Reliability Rules

- Snapshot-first: always work from a current snapshot before targeting elements.
- Expect stale UIDs after navigation/reload; refresh snapshot before follow-up actions.
- Keep interactions minimal and deterministic.
- Prefer stable text/labels/readiness markers over brittle positional assumptions.
- Include explicit waits around async reload boundaries.
- For styling bugs, prioritize computed-style evidence over visual guessing.
- Re-check computed styles after interactions/reloads to avoid diagnosing transient states.

## Reporting Template

When finishing verification, include:

- What changed was verified (component/style/state)
- Which interactions were executed
- Which computed-style findings explained the root cause (including cascade/inheritance source)
- Result (`pass`/`fail`) and any remaining uncertainty

## Keep `UI_CONTROLS.md` In Sync (Required)

Update `UI_CONTROLS.md` when any of these occur:

- A control label, aria label, `data-testid`, icon, or route changes
- A new blocking dialog, readiness signal, or async wait pattern is observed
- A new high-value control/section appears in Devices, Player, or Settings
- Existing guidance fails during verification and a better deterministic marker is found

### Update style requirements:

- Keep entries concise and table-first
- Prefer durable selectors over visual descriptions
- Add only high-signal items that reduce hunting time
- Remove stale entries immediately when confirmed out of sync