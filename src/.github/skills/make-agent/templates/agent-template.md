---
# ============================================================
# IDENTITY
# ============================================================
name: {{AGENT_NAME}}
description: {{DESCRIPTION}}
{{#if ARGUMENT_HINT}}
argument-hint: {{ARGUMENT_HINT}}
{{/if}}

# ============================================================
# MODEL SELECTION
# ============================================================
{{#if MODEL}}
model: {{MODEL}}
{{/if}}
{{#if MODEL_ARRAY}}
model:
{{#each MODEL_ARRAY}}
  - {{this}}
{{/each}}
{{/if}}

# ============================================================
# TOOLS & CAPABILITIES
# ============================================================
{{#if TOOLS}}
tools:
{{#each TOOLS}}
  - '{{this}}'
{{/each}}
{{/if}}

# ============================================================
# SUBAGENTS
# ============================================================
{{#if AGENTS}}
agents:
{{#each AGENTS}}
  - '{{this}}'
{{/each}}
{{/if}}

# ============================================================
# VISIBILITY & INVOCATION
# ============================================================
{{#if USER_INVOKABLE_FALSE}}
user-invokable: false
{{/if}}
{{#if DISABLE_MODEL_INVOCATION}}
disable-model-invocation: true
{{/if}}

# ============================================================
# TARGETING
# ============================================================
{{#if TARGET}}
target: {{TARGET}}
{{/if}}

# ============================================================
# HANDOFFS
# ============================================================
{{#if HANDOFFS}}
handoffs:
{{#each HANDOFFS}}
  - label: {{this.label}}
    agent: {{this.agent}}
    prompt: {{this.prompt}}
    send: {{this.send}}
    {{#if this.model}}
    model: {{this.model}}
    {{/if}}
{{/each}}
{{/if}}
---

# {{AGENT_NAME}}

{{INTRODUCTION}}

## Core Responsibilities

{{RESPONSIBILITIES}}

## Constraints

### ❌ You CANNOT:
{{CANNOT_LIST}}

### ✅ You CAN:
{{CAN_LIST}}

## Workflow

{{WORKFLOW}}

## Response Style

{{RESPONSE_STYLE}}
