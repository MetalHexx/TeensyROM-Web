---
name: make-skill-template
description: 'Create new Agent Skills for GitHub Copilot from prompts or by duplicating this template. Use when asked to "create a skill", "make a new skill", "scaffold a skill", or when building specialized AI capabilities with bundled resources. Generates SKILL.md files with proper frontmatter, directory structure, and optional scripts/references/assets folders.'
---

# Make Skill Template

A meta-skill for creating new Agent Skills. Use this skill when you need to scaffold a new skill folder, generate a SKILL.md file, or help users understand the Agent Skills specification.

## When to Use This Skill

- User asks to "create a skill", "make a new skill", or "scaffold a skill"
- User wants to add a specialized capability to their GitHub Copilot setup
- User needs help structuring a skill with bundled resources
- User wants to duplicate this template as a starting point

## Prerequisites

- Understanding of what the skill should accomplish
- A clear, keyword-rich description of capabilities and triggers
- Knowledge of any bundled resources needed (scripts, references, assets, templates)

## Creating a New Skill

### Step 1: Create the Skill Directory

Create a new folder with a lowercase, hyphenated name:

```
skills/<skill-name>/
└── SKILL.md          # Required
```

### Step 2: Generate SKILL.md with Frontmatter

Every skill requires YAML frontmatter with `name` and `description`:

```yaml
---
name: <skill-name>
description: '<What it does>. Use when <specific triggers, scenarios, keywords users might say>.'
---
```

#### Frontmatter Field Requirements

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | **Yes** | 1-64 chars, lowercase letters/numbers/hyphens only, must match folder name |
| `description` | **Yes** | 1-1024 chars, must describe WHAT it does AND WHEN to use it |
| `license` | No | License name or reference to bundled LICENSE.txt |
| `compatibility` | No | 1-500 chars, environment requirements if needed |
| `metadata` | No | Key-value pairs for additional properties |
| `allowed-tools` | No | Space-delimited list of pre-approved tools (experimental) |

#### Description Best Practices

**CRITICAL**: The `description` is the PRIMARY mechanism for automatic skill discovery. Include:

1. **WHAT** the skill does (capabilities)
2. **WHEN** to use it (triggers, scenarios, file types)
3. **Keywords** users might mention in prompts

**Good example:**

```yaml
description: 'Toolkit for testing local web applications using Playwright. Use when asked to verify frontend functionality, debug UI behavior, capture browser screenshots, or view browser console logs. Supports Chrome, Firefox, and WebKit.'
```

**Poor example:**

```yaml
description: 'Web testing helpers'
```

### Step 3: Write the Skill Body

After the frontmatter, add markdown instructions. Recommended sections:

| Section | Purpose |
|---------|---------|
| `# Title` | Brief overview |
| `## When to Use This Skill` | Reinforces description triggers |
| `## Prerequisites` | Required tools, dependencies |
| `## Step-by-Step Workflows` | Numbered steps for tasks |
| `## Troubleshooting` | Common issues and solutions |
| `## References` | Links to bundled docs |

### Step 4: Add Optional Directories (If Needed)

| Folder | Purpose | When to Use |
|--------|---------|-------------|
| `scripts/` | Executable code (Python, Bash, JS) | Automation that performs operations |
| `references/` | Documentation agent reads | API references, schemas, guides |
| `assets/` | Static files used AS-IS | Images, fonts, templates |
| `templates/` | Starter code agent modifies | Scaffolds to extend |

### Step 5: Remove References from Existing Documentation (CRITICAL)

**When creating a skill from existing documentation**, you MUST systematically remove all references to that documentation from the rest of the codebase. Skills are auto-discovered via frontmatter - duplication wastes context.

#### Why This Matters

- **Context Efficiency**: Skills load ONLY when needed via auto-discovery. Documentation references pre-load content unnecessarily.
- **Single Source of Truth**: All instructions for a capability should live in the skill, not scattered across docs.
- **Cleaner Agent Context**: Agents work more efficiently with lean, focused documentation.

#### Systematic Cleanup Process

**1. Search for ALL References**

Use workspace-wide search (NOT directory-limited) for:
- Original documentation filename (e.g., `API_CLIENT_GENERATION.md`)
- Topic keywords (e.g., "API client generation", "regenerate TypeScript client")
- Links to original docs or skill paths
- Instructional phrases (e.g., "run `pnpm generate:api-client`")

**2. Remove from Core Documentation**

Clean these files completely:
- `docs/*.md` - All main documentation files
- `CLAUDE.md`, `AGENTS.md` - Agent instruction files
- `.github/copilot-instructions.md` - Copilot configuration
- `.github/chatmodes/*.chatmode.md` - All chat mode files

**3. What to Remove**

✅ **Remove entirely:**
- Instructional content (how-to steps, commands)
- Links to original documentation or skill paths
- Detailed explanations covered by the skill
- Duplicate examples/workflows

✅ **Keep (these are OK):**
- Brief architectural mentions (e.g., "Generated API client exists")
- Configuration references (e.g., `package.json` scripts needed for execution)
- Historical project documentation (`docs/projects/`, `docs/features/`)

**4. Create Redirect File (Optional)**

If the original documentation file had many external links, consider leaving a redirect:

```markdown
# [Original Topic Name]

**This documentation has moved to a specialized skill.**

See: `.github/skills/<skill-name>/SKILL.md`

This skill is auto-discovered by agents when needed.
```

**5. Use Subagents for Large Cleanups**

For comprehensive cleanup:
1. **Recon subagent**: Catalog ALL references (files, lines, context)
2. **Cleanup subagents**: Parallel cleanup of different file categories
3. **Verification subagent**: Final sweep to confirm completeness

**Example Cleanup Checklist:**
- [ ] Searched entire workspace (not just specific folders)
- [ ] Removed references from `/docs/*.md`
- [ ] Removed references from `CLAUDE.md`, `AGENTS.md`
- [ ] Removed references from `.github/copilot-instructions.md`
- [ ] Removed references from all `.chatmode.md` files
- [ ] Verified configuration files still work (e.g., `package.json` scripts)
- [ ] Preserved historical project docs (`docs/projects/`, `docs/features/`)
- [ ] Created redirect file if needed (optional)
- [ ] Tested that skill is auto-discovered correctly

#### Lessons from API Client Generation Skill Migration

**What worked well:**
- Using multiple subagents for parallel cleanup
- Creating comprehensive inventory before making changes
- Preserving historical project documentation for archival integrity
- Creating redirect file for backward compatibility

**What to avoid:**
- Directory-limited searches (use workspace-wide instead)
- Updating links instead of removing (links still waste context)
- Leaving "see skill for details" references (redundant - auto-discovery handles it)
- Touching historical project docs (breaks archival integrity)

## Example: Complete Skill Structure

```
my-awesome-skill/
├── SKILL.md                    # Required instructions
├── LICENSE.txt                 # Optional license file
├── scripts/
│   └── helper.py               # Executable automation
├── references/
│   ├── api-reference.md        # Detailed docs
│   └── examples.md             # Usage examples
├── assets/
│   └── diagram.png             # Static resources
└── templates/
    └── starter.ts              # Code scaffold
```

## ⚠️ Do NOT Wrap SKILL.md in Code Fences

The examples in this file show skill content inside ` ```skill ` code fences for **documentation display purposes only**. Actual `SKILL.md` files must be plain Markdown — do **not** wrap the file content in any code fence. The frontmatter must start at line 1 with `---`.

## Quick Start: Duplicate This Template

1. Copy the `make-skill-template/` folder
2. Rename to your skill name (lowercase, hyphens)
3. Update `SKILL.md`:
   - Change `name:` to match folder name
   - Write a keyword-rich `description:`
   - Replace body content with your instructions
4. Add bundled resources as needed
5. Validate with `npm run skill:validate`

## Validation Checklist

- [ ] Folder name is lowercase with hyphens
- [ ] `name` field matches folder name exactly
- [ ] `description` is 10-1024 characters
- [ ] `description` explains WHAT and WHEN
- [ ] `description` is wrapped in single quotes
- [ ] Body content is under 500 lines
- [ ] Bundled assets are under 5MB each

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Skill not discovered | Improve description with more keywords and triggers |
| Validation fails on name | Ensure lowercase, no consecutive hyphens, matches folder |
| Description too short | Add capabilities, triggers, and keywords |
| Assets not found | Use relative paths from skill root |

## References

- Agent Skills official spec: <https://agentskills.io/specification>
