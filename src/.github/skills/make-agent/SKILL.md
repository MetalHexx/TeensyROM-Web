---
name: make-agent
description: 'Create custom GitHub Copilot agents (.agent.md files) with interactive configuration. Use when asked to "create an agent", "make an agent", "new agent", "scaffold an agent", "build a custom agent", or when building specialized AI personas for VS Code. Guides users through every frontmatter option with ask_questions tool, then generates a complete .agent.md file.'
---

# Make Agent

A skill for creating custom GitHub Copilot agents (`.agent.md` files) with comprehensive interactive configuration. This skill uses the `ask_questions` tool to walk users through **every available frontmatter option** before generating a polished agent file.

**Reference**: [VS Code Custom Agents Documentation](https://code.visualstudio.com/docs/copilot/customization/custom-agents)

## When to Use This Skill

- User asks to "create an agent", "make an agent", or "scaffold an agent"
- User wants a new custom chat persona for VS Code Copilot
- User needs help configuring agent frontmatter options
- User wants to set up handoffs between agents
- User wants to create subagent-only agents

## Prerequisites

- VS Code 1.106 or later (custom agents require this version)
- GitHub Copilot extension installed
- An idea for the agent's purpose/persona

## Workflow

### Step 1: Gather Agent Purpose

Before asking detailed configuration questions, first understand what the user wants the agent to do. If the user hasn't described the agent's purpose, ask them to describe it briefly. This context helps you make better recommendations for all subsequent questions.

### Step 2: Ask Configuration Questions (MANDATORY)

You MUST use the `ask_questions` tool to interactively configure the agent. Ask questions in **batches of up to 4** (the tool's limit), covering ALL frontmatter options below. Make intelligent recommendations based on the agent's described purpose.

#### Batch 1: Identity & Model

```
Question 1 — "Agent Name"
  What should this agent be called? This name appears in the agents dropdown in VS Code.
  (Free text input — suggest a name based on the described purpose)

Question 2 — "Model"
  Which AI model should this agent use? Leave blank to use whatever model is currently selected in the VS Code model picker. Specifying a model locks the agent to that model (or a prioritized fallback list). See references/frontmatter-reference.md for the full current model list.
  Options:
    - "Use current model (no preference)" [recommended if general-purpose]
    - "Claude Sonnet 4.6 (copilot)" — Latest Sonnet, fast balanced reasoning
    - "Claude Opus 4.6 (copilot)" — Anthropic's most capable model, deep reasoning
    - "Claude Haiku 4.5 (copilot)" — Fastest/cheapest Anthropic model
    - "GPT-5.2 (copilot)" — OpenAI's capable general model
    - "GPT-5.1-Codex-Max (copilot)" — OpenAI coding-optimized model
    - "Gemini 3.1 Pro (copilot)" — Google's latest, long context
    - "Grok Code Fast 1 (copilot)" — xAI fast coding model
  (Allow free text for any other model name)

Question 3 — "Description"
  Provide a short description for this agent. This text appears as placeholder text in the chat input when the agent is selected. Keep it concise (1-2 sentences).
  (Free text input — suggest a description based on the purpose)

Question 4 — "Orchestration Role"
  Is this agent part of the orchestration system (`.github/orchestration/`)? Orchestration agents follow specific protocols for task handoffs and completion reports.
  Options:
    - "No, standalone agent" [recommended] — Standard agent, no orchestration protocol
    - "Yes, subagent worker" — Dispatched by the Orchestrator to execute task handoffs (uses subagent-template.md)
    - "Yes, coordinator/planner" — Manages or plans orchestrated projects (custom setup)
  Note: Selecting "subagent worker" will use the specialized subagent template at templates/subagent-template.md, which enforces orchestration compliance (mandatory task reports, scope discipline, prerequisite verification). Batches 2-4 will be auto-configured with orchestration defaults — only domain-specific questions will be asked.
```

#### Batch 1b: Subagent Specialization (Only if "subagent worker" selected above)

If the user selected "subagent worker" in the Orchestration Role question, skip Batches 2-4 and ask these domain questions instead:

```
Question 1 — "Argument Hint"
  Optional hint text shown in the chat input field. For subagents, something like "Task handoff path..." works well. Leave blank for no hint.
  (Free text input)

Question 2 — "Domain Expertise"  
  What is this subagent's area of expertise? This determines the Domain Expertise section and relevant standards references.
  Options:
    - "Frontend Components" — Angular components, templates, SCSS
    - "Backend API" — .NET endpoints, MediatR handlers, domain services
    - "State Management" — NgRx Signal Stores, reactive patterns
    - "Testing" — Unit tests, integration tests, E2E tests
    - "Styling/CSS" — SCSS, design tokens, responsive layouts
  (Allow free text for custom domain)

Question 3 — "Model"
  Which model for this subagent worker?
  Options:
    - "Claude Sonnet 4.6 (copilot)" [recommended] — Best balance of speed and capability for implementation
    - "Claude Opus 4.6 (copilot)" — For complex multi-concern tasks
    - "Claude Haiku 4.5 (copilot)" — For simple, repetitive file edits
    - "GPT-5.3-Codex (copilot)" — Optimized for code generation
  (Allow free text for other models)

Question 4 — "Personality"
  What personality should this subagent have?
  Options:
    - "Professional & methodical" [recommended] — Structured, standards-focused
    - "Terse & efficient" — Minimal words, maximum action
    - "Careful & thorough" — Double-checks everything, explains rationale
  (Allow free text for custom personality)
```

After collecting answers, **read the subagent template** at [templates/subagent-template.md](templates/subagent-template.md) and fill in the `{{PLACEHOLDER}}` values. Then proceed directly to **Step 4b** (Orchestration Subagent path) to generate the agent file.

#### Batch 2: Visibility & Invocation (Skip if subagent worker)

```
Question 1 — "Visibility"
  Should this agent appear in the agents dropdown in VS Code? Set to false to create agents that are only accessible as subagents or programmatically.
  Options:
    - "Yes, show in dropdown (user-invokable: true)" [recommended]
    - "No, hide from dropdown (user-invokable: false)" — Only usable as a subagent

Question 2 — "Subagent Use"
  Should other agents be PREVENTED from automatically invoking this agent as a subagent? By default, any agent can be called as a subagent by the AI.
  Options:
    - "Allow subagent invocation (default)" [recommended]
    - "Block subagent invocation (disable-model-invocation: true)" — Only manually selectable

Question 3 — "Target"
  Where will this agent run? Most agents target VS Code. Choose 'github-copilot' only for agents designed for GitHub Copilot in the browser/cloud.
  Options:
    - "VS Code (default)" [recommended]
    - "GitHub Copilot (github-copilot)" — For cloud/browser Copilot agents

Question 4 — "Subagents"
  Which other agents should this agent be able to call as subagents? Requires the 'agent' tool to be included in tools. Use '*' to allow all, '[]' to prevent any, or list specific agent names.
  Options:
    - "Allow all agents (*)" [recommended]
    - "No subagents ([])" — This agent works alone
    - "Specific agents only" — You'll specify which ones
  (Allow free text to list specific agent names)
```

#### Batch 3: Tools Configuration

```
Question 1 — "Tool Strategy"
  How should this agent's tools be configured? Tools control what the agent can DO (edit files, run terminals, search code, etc.). Restricting tools creates focused agents.
  Options:
    - "All tools (no restriction)" — Agent can use any available tool [recommended for implementation agents]
    - "Read-only tools" — Only search, read, and analysis tools (good for planners/reviewers)
    - "Custom tool list" — You'll pick exactly which tools to include
    - "Minimal tools" — Bare minimum for conversation only

Question 2 — "Subagent Capability"
  Will this agent call other agents as subagents? (This affects tool selection)
  Options:
    - "Yes, needs subagent capability" — Adds agent/runSubagent tool
    - "No subagent capability needed" — Agent works alone
  Note: If you set agents: ['*'] or agents: ['specific-agent'], you MUST include agent/runSubagent in tools.

Question 3 — "Built-in Tools" (if Custom was selected, otherwise skip)
  Which tools/tool-sets should be available? Use tool SETS (edit, search) for broad access or specific NAMESPACED tools for precision.
  
  Tool Sets (broad access):
    - "edit" — All file modification tools
    - "search" — All code search tools
    - "execute" — Terminal and command execution
  
  Common Individual Tools (namespaced):
    - "search/codebase" — Semantic code search
    - "search/usages" — Find references/implementations
    - "read/readFile" — Read file contents
    - "read/problems" — Workspace errors
    - "edit/editFiles" — Edit workspace files
    - "edit/createFile" — Create new files
    - "web/fetch" — Fetch web content
    - "agent" — Call other agents (REQUIRED if agents array is set)
    - "todo" — Todo list tracking (no namespace)
  
  (Allow free text for full tool specification. Remind: tool names are NAMESPACED like category/toolname)

Question 4 — "MCP Server Tools"
  Should this agent have access to any MCP (Model Context Protocol) server tools? MCP servers extend agent capabilities with external integrations. To include all tools from a server, use '<server-name>/*' format.
  Options:
    - "No MCP tools needed"
    - "chrome-devtools/*" — Browser DevTools for UI testing/screenshots
    - "nx-mcp-server/*" — Nx monorepo workspace tools
    - "Custom MCP tools" — Specify server/tool names
  (Allow free text for custom MCP tool references)
```

#### Batch 4: Handoffs (Optional)

```
Question 1 — "Handoffs"
  Should this agent have handoff buttons? Handoffs let users transition to another agent with a pre-filled prompt after a response completes. Great for sequential workflows (e.g., Plan → Implement → Review).
  Options:
    - "No handoffs needed" [recommended unless workflow agent]
    - "Yes, configure handoffs" — I'll set up transitions to other agents

Question 2 — (Only if handoffs = yes) "Handoff Details"
  Describe each handoff: target agent name, button label, prompt text, and whether it should auto-send. You can define multiple handoffs.
  Format: "label | agent-name | prompt text | auto-send(true/false) | model(optional)"
  Example: "Start Implementation | Implementer | Now implement the plan above. | false"
  (Free text input)

Question 3 — "Agent Personality"
  What personality/tone should this agent have? This shapes the instruction body of the agent file.
  Options:
    - "Professional & methodical" — Structured, standards-focused
    - "Friendly & collaborative" — Approachable, explains decisions
    - "Terse & efficient" — Minimal words, maximum action
    - "Creative & exploratory" — Thinks outside the box, tries novel approaches
  (Allow free text for custom personality description)

Question 4 — "File Location"
  Where should the agent file be created?
  Options:
    - ".github/agents/ (workspace)" [recommended] — Shared with team via source control
    - "User profile" — Personal, available across all workspaces
    - ".claude/agents/ (Claude format)" — Compatible with Claude Code
```

### Step 3: Generate the Agent File

After collecting all answers, generate the `.agent.md` file with:

1. **YAML Frontmatter** — All configured options
2. **Markdown Body** — Agent instructions based on the personality and purpose

#### Frontmatter Reference

See [references/frontmatter-reference.md](references/frontmatter-reference.md) for the complete annotated frontmatter template with all fields, defaults, and format notes.

#### Body Template

The body should include:

1. **Title & Introduction** — Who this agent is and what it does
2. **Core Responsibilities** — Numbered list of what the agent handles
3. **Constraints** — What the agent should NOT do (with ❌/✅ formatting)
4. **Workflow** — Step-by-step process the agent follows
5. **Response Style** — How the agent should communicate
6. **References** — Links to relevant documentation or standards

### Step 4: Write the File

Use `create_file` to write the agent to the chosen location. The filename should be:
- `<Agent Name>.agent.md` for `.github/agents/` (spaces allowed in filename)
- `<agent-name>.md` for `.claude/agents/` (use kebab-case, no `.agent` suffix)

### Step 4b: Orchestration Subagent (Specialized Path)

If the user wants a **subagent worker** for the orchestration system (dispatched by the Orchestrator to execute task handoffs), use the dedicated subagent template instead of the generic agent template:

1. **Read the template**: [templates/subagent-template.md](templates/subagent-template.md)
2. **Fill in placeholders**: Replace all `{{PLACEHOLDER}}` values based on the user's answers
3. **Customize domain expertise**: Write the `{{DOMAIN_EXPERTISE_SECTION}}` based on the agent's specialization
4. **Adjust tools**: Follow the Frontmatter Customization Guide in the template to add/remove tools for the domain
5. **Set visibility**: Subagent workers use `agents: []` and `disable-model-invocation: true` — only the Orchestrator dispatches them

The subagent template enforces orchestration system compliance:
- Mandatory first actions (read handoff → read report template → read standards → verify prerequisites)
- Strict scope discipline (only touch files listed in the handoff)
- Non-negotiable completion reports following `SUBAGENT_REPORT.md`
- Anti-patterns table to prevent common mistakes

For details on the orchestration system, see `.github/orchestration/SUBAGENT_ORCHESTRATOR_GUIDE.md`.

### Step 5: Confirm & Test

After creating the file:
1. Tell the user the agent was created
2. Explain how to access it: select from the agents dropdown in Chat, or type `/agents` to configure
3. Suggest they test it with a sample prompt
4. Mention they can edit the file anytime to refine behavior

## Available Models & Tools Reference

The full current model list, complete tools reference, and annotated frontmatter template live in [references/frontmatter-reference.md](references/frontmatter-reference.md). Consult it when generating an agent or when the user asks about specific options.

> **Model note**: Model availability changes frequently. When in doubt, the user can check the model picker directly in VS Code (`Ctrl+Alt+.`) or visit the [GitHub Copilot supported models](https://docs.github.com/en/copilot/reference/ai-models/supported-models) page.

## Common Agent Archetypes

Use these as starting-point recommendations. Adjust based on what the user describes.

| Archetype | Tools Strategy | Model Suggestion | Personality |
|-----------|---------------|-----------------|-------------|
| **Planner / Architect** | Read-only: `search` + `read/readFile` + `read/problems` + `web/fetch` + `todo` | `Claude Opus 4.6` or `GPT-5.2` | Methodical, structured output; handoff → Implementer |
| **Implementer / Coder** | Full: `edit` + `search` + `execute/runInTerminal` + `execute/runTests` + `todo` | `Claude Sonnet 4.6` or `GPT-5.2-Codex` | Action-oriented, clean code; handoff → Reviewer |
| **Reviewer / Auditor** | Read-only: `search` + `search/changes` + `read/problems` + `search/usages` + `todo` | `Claude Opus 4.6` or `GPT-5.1` | Critical, detailed feedback |
| **Debugger / Fixer** | `edit` + `search` + `execute/runInTerminal` + `execute/testFailure` + `execute/runTests` + `todo` | `Claude Sonnet 4.6` | Systematic, hypothesis-driven |
| **Orchestrator** | Read-only: `search` + `read/readFile` + `web/fetch` + `agent` + `todo` | `Claude Opus 4.6` | Professional, status-driven |
| **Subagent Worker** | Full: `edit` + `search` + `execute/runInTerminal` + `execute/runTests` + `read/readFile` + `read/problems` + `todo` | `Claude Sonnet 4.6` | Task-focused, diligent reporting |
| **Documentation Writer** | `search/codebase` + `read/readFile` + `edit/editFiles` + `edit/createFile` + `web/fetch` + `search/usages` + `todo` | Any capable model | Clear, thorough, well-structured |

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Agent not appearing in dropdown | Check file is in `.github/agents/` with `.agent.md` extension. Ensure `user-invokable` is not `false` |
| Tools not available | Verify tool names use proper namespacing (category/toolname). Use tool sets for broad access. MCP tools require server to be running |
| "Tool has been renamed" error | Use namespaced format: `search/codebase` not `codebase`, `read/readFile` not `readFile`, `edit/editFiles` not `editFiles` |
| Model not found | Check model name spelling. Use exact format: `Model Name (copilot)`. See [supported models](https://docs.github.com/en/copilot/reference/ai-models/supported-models) |
| Handoff button not showing | Verify target agent exists and `agent` field matches its name/filename |
| "agent tool must be included" error | When `agents` array is specified, you MUST include `agent` in the `tools` array |

## References

- [VS Code Custom Agents Documentation](https://code.visualstudio.com/docs/copilot/customization/custom-agents) — Complete official reference
- [Use Tools with Agents](https://code.visualstudio.com/docs/copilot/agents/agent-tools) — Tool types and configuration
- [VS Code Copilot Cheat Sheet](https://code.visualstudio.com/docs/copilot/reference/copilot-vscode-features) — All built-in tools listed
- [Custom Instructions](https://code.visualstudio.com/docs/copilot/customization/custom-instructions) — Pair with agents for richer behavior
- [Prompt Files](https://code.visualstudio.com/docs/copilot/customization/prompt-files) — Reusable prompts that reference agents
