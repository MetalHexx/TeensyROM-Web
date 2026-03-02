# Agent Frontmatter Quick Reference

All available frontmatter fields for `.agent.md` files, per the [VS Code Custom Agents Documentation](https://code.visualstudio.com/docs/copilot/customization/custom-agents).

## Annotated Frontmatter Template

```yaml
---
# IDENTITY
name: <agent-name>                        # Display name in agents dropdown (default: filename)
description: <brief description>          # Placeholder text in chat input

# INPUT GUIDANCE
argument-hint: <hint text>                # Optional guidance shown in chat input

# MODEL SELECTION
model: <model-name>                       # Single model or array for fallback priority
# Array format for fallback chains:
# model:
#   - Claude Sonnet 4.6 (copilot)
#   - GPT-5.2 (copilot)

# TOOLS & CAPABILITIES
tools:                                    # Available tools (omit = all tools)
  - search/codebase                       # Individual namespaced tool
  - search                                # Tool set (all search/* tools)
  - agent                                 # Required when agents array is set
  - chrome-devtools/*                     # All tools from an MCP server
  - chrome-devtools/take_screenshot       # Specific MCP tool

# SUBAGENTS
agents:                                   # Subagent access control
  - '*'                                   # Allow all agents (REQUIRES agent in tools!)
# agents: []                              # Prevent any subagent use (no agent tool needed)

# VISIBILITY & INVOCATION
user-invokable: true                      # Show in agents dropdown (default: true)
disable-model-invocation: false           # Prevent AI from auto-invoking as subagent (default: false)

# TARGETING
target: vscode                            # 'vscode' (default) or 'github-copilot'

# MCP SERVERS (for github-copilot target only)
# mcp-servers:
#   - url: https://mcp.example.com
#     headers:
#       Authorization: Bearer ${{ secrets.TOKEN }}

# HANDOFFS
handoffs:
  - label: Start Implementation            # Display text on handoff button
    agent: implementer                     # Target agent identifier (name or filename stem)
    prompt: Now implement the plan above.  # Pre-filled prompt for target agent
    send: false                            # Auto-submit prompt (default: false)
    model: GPT-5.2-Codex (copilot)        # Optional model override for the handoff
---
```

## Complete Field Reference

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `name` | string | No | filename | Display name in agents dropdown |
| `description` | string | No | — | Placeholder text shown in chat input when agent is selected |
| `argument-hint` | string | No | — | Hint text in chat input guiding user interaction |
| `model` | string \| string[] | No | current picker | AI model name or prioritized fallback array |
| `tools` | string[] | No | all | List of tool/tool-set/MCP-tool names available to agent |
| `agents` | string[] | No | all | Subagent access: `['*']` = all, `[]` = none, or list names |
| `user-invokable` | boolean | No | `true` | Show in agents dropdown |
| `disable-model-invocation` | boolean | No | `false` | Prevent AI from auto-invoking as subagent |
| `target` | string | No | `vscode` | `vscode` or `github-copilot` |
| `mcp-servers` | object[] | No | — | MCP server configs (for `github-copilot` target only) |
| `handoffs` | object[] | No | — | Transition buttons to other agents |
| `handoffs[].label` | string | Yes* | — | Button display text |
| `handoffs[].agent` | string | Yes* | — | Target agent identifier |
| `handoffs[].prompt` | string | No | — | Pre-filled prompt for target agent |
| `handoffs[].send` | boolean | No | `false` | Auto-submit the prompt |
| `handoffs[].model` | string | No | — | Override model for handoff execution |

*Required when handoffs array is present.

## Current Models (as of March 2026)

Model names use the format `Model Name (copilot)`. An up-to-date list is always available at [docs.github.com: Supported AI models](https://docs.github.com/en/copilot/reference/ai-models/supported-models).

| Model | Vendor | Notes |
|-------|--------|-------|
| `Claude Haiku 4.5 (copilot)` | Anthropic | Fastest/cheapest Anthropic; 0.33x multiplier |
| `Claude Sonnet 4 (copilot)` | Anthropic | Balanced; 1x multiplier |
| `Claude Sonnet 4.5 (copilot)` | Anthropic | Balanced; 1x multiplier |
| `Claude Sonnet 4.6 (copilot)` | Anthropic | Latest Sonnet; 1x multiplier |
| `Claude Opus 4.5 (copilot)` | Anthropic | Most capable; 3x multiplier |
| `Claude Opus 4.6 (copilot)` | Anthropic | Latest Opus; 3x multiplier |
| `GPT-4.1 (copilot)` | OpenAI | Included in free tier; 0x multiplier |
| `GPT-5 mini (copilot)` | OpenAI | Fast, free tier included; 0x multiplier |
| `GPT-5.1 (copilot)` | OpenAI | 1x multiplier |
| `GPT-5.1-Codex-Max (copilot)` | OpenAI | Coding-optimized; 1x multiplier |
| `GPT-5.2 (copilot)` | OpenAI | 1x multiplier |
| `GPT-5.2-Codex (copilot)` | OpenAI | Coding-optimized; 1x multiplier |
| `GPT-5.3-Codex (copilot)` | OpenAI | Latest Codex; 1x multiplier |
| `Gemini 2.5 Pro (copilot)` | Google | Long context; 1x multiplier |
| `Gemini 3 Flash (copilot)` | Google | Fast; 0.33x multiplier (preview) |
| `Gemini 3 Pro (copilot)` | Google | 1x multiplier (preview) |
| `Gemini 3.1 Pro (copilot)` | Google | Latest; 1x multiplier (preview) |
| `Grok Code Fast 1 (copilot)` | xAI | Fast coding; 0.25x multiplier |

> **Retired** (do not use): o3, o3-mini, o4-mini, GPT-5, GPT-5-Codex, Claude Opus 4, Claude Sonnet 3.7, Claude Sonnet 3.7 Thinking, Gemini 2.0 Flash

## Built-in Tools

### ⚠️ Tool Namespacing

**CRITICAL**: Most individual tools are now **namespaced** using the pattern `category/toolname`.

**Example**:
- ❌ Old: `codebase`, `readFile`, `editFiles`
- ✅ New: `search/codebase`, `read/readFile`, `edit/editFiles`

**Exceptions** (no namespace):
- `todo` — Todo list tracking

**When to use tool sets vs individual tools**:
- **Tool sets** (`edit`, `search`, `execute`, etc.) give broad access to all tools in that category
- **Individual namespaced tools** provide precise control over capabilities

### Individual Tools

**Read Tools** (read/):
| Tool Name | Description |
|-----------|-------------|
| `read/readFile` | Read file contents |
| `read/problems` | Workspace errors and warnings |
| `read/getTaskOutput` | Get task output |
| `read/terminalLastCommand` | Get last terminal command and output |
| `read/terminalSelection` | Get current terminal selection |
| `read/getNotebookSummary` | Get notebook cell summary |
| `read/readNotebookCellOutput` | Read notebook cell output |

**Search Tools** (search/):
| Tool Name | Description |
|-----------|-------------|
| `search/codebase` | Semantic code search across workspace |
| `search/usages` | Find references, implementations, definitions |
| `search/fileSearch` | Search for files by glob pattern |
| `search/textSearch` | Search text in files |
| `search/listDirectory` | List directory contents |
| `search/changes` | Source control changes |
| `search/searchResults` | Get Search view results |

**Edit Tools** (edit/):
| Tool Name | Description |
|-----------|-------------|
| `edit/editFiles` | Apply edits to workspace files |
| `edit/createFile` | Create new files |
| `edit/createDirectory` | Create new directories |
| `edit/editNotebook` | Edit notebooks |
| `edit/createJupyterNotebook` | Scaffold a Jupyter notebook |

**Execute Tools** (execute/):
| Tool Name | Description |
|-----------|-------------|
| `execute/runInTerminal` | Execute terminal commands |
| `execute/getTerminalOutput` | Get terminal command output |
| `execute/runTests` | Run unit tests |
| `execute/testFailure` | Get test failure information |
| `execute/runTask` | Run a workspace task |
| `execute/createAndRunTask` | Create and run a new task |
| `execute/runNotebookCell` | Run notebook cells |

**Agent Tools** (agent):
| Tool Name | Description |
|-----------|-----------|
| `agent` | Call other agents as subagents (formerly `runSubagent`) |

**Web Tools** (web/):
| Tool Name | Description |
|-----------|-------------|
| `web/fetch` | Fetch web page content |
| `web/githubRepo` | Search code in a GitHub repo |

**VS Code Tools** (vscode/):
| Tool Name | Description |
|-----------|-------------|
| `vscode/extensions` | Search/ask about VS Code extensions |
| `vscode/installExtension` | Install a VS Code extension |
| `vscode/runCommand` | Run a VS Code command |
| `vscode/vscodeAPI` | Ask about VS Code extension APIs |
| `vscode/openSimpleBrowser` | Open integrated browser |
| `vscode/newWorkspace` | Create a new workspace |
| `vscode/getProjectSetupInfo` | Get project scaffolding info |

**Other Tools** (no namespace):
| Tool Name | Description |
|-----------|-------------|
| `todo` | Track progress with todo lists |
| `selection` | Current editor selection |

### Tool Sets

Tool sets provide broad access to all tools in a category. Use these for simplicity, or use individual namespaced tools for precise control.

| Tool Set | Purpose | Includes |
|----------|---------|----------|
| `edit` | File modification tools | All `edit/*` tools |
| `search` | Code search tools | All `search/*` tools |
| `execute` | Execution tools | All `execute/*` tools |
| `read` | Read-only tools | All `read/*` tools |
| `web` | Web access tools | All `web/*` tools |
| `vscode` | VS Code integration tools | All `vscode/*` tools |

### MCP Server Tools

Use `<server-name>/<tool-name>` for a specific tool, or `<server-name>/*` for all tools from that server.

**Example**: `chrome-devtools/take_screenshot` or `chrome-devtools/*`

---

## 🚨 Critical Rules

### Rule 1: Agent Tool Requirement

**When specifying `agents` array**, you **MUST** include the agent tool:

```yaml
# ✅ Correct - includes agent tool
tools: ['search', 'read/readFile', 'agent']
agents: ['*']

# ❌ Incorrect - missing agent tool
tools: ['search', 'read/readFile']
agents: ['*']  # ERROR: agent tool must be included!

# ✅ Also correct - agents: [] doesn't need agent tool
tools: ['search', 'read/readFile']
agents: []  # No subagents = no agent tool needed
```

**Why**: The `agents` field controls which agents can be called, but `agent/runSubagent` is the tool that enables calling them.

### Rule 2: Tool Namespacing

Always use namespaced format for individual tools:

```yaml
# ✅ Correct
tools: ['search/codebase', 'read/readFile', 'edit/editFiles']

# ❌ Incorrect (will show "has been renamed" error)
tools: ['codebase', 'readFile', 'editFiles']
```

**Exceptions**: `todo` and `selection` have no namespace.

