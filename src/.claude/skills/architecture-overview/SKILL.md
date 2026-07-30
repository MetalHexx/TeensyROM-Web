---
name: architecture-overview
description: 'High-level architecture and context reference for the TeensyROM Nx monorepo. Use when onboarding to the codebase, understanding the overall tech stack (Angular 19, Nx, .NET 9, RadEndpoints, MediatR, NgRx Signal Store), understanding Clean Architecture layers (domain/application/infrastructure/presentation) and their dependency rules, exploring the workspace file/library tree, or answering general "how is this repo organized" questions. Covers Angular dev patterns and standards per layer, DI patterns, testing standards summary, and code organization conventions.'
---

# Architecture Overview Skill

High-level context for the TeensyROM Nx monorepo — a hybrid .NET/Angular application for TeensyROM device management and media playback.

## When to Use This Skill

- Onboarding to the codebase or getting oriented in the workspace
- Understanding the overall tech stack (backend and frontend)
- Understanding Clean Architecture layers (`libs/domain`, `libs/application`, `libs/infrastructure`, `libs/features`/`libs/ui`) and their dependency rules
- Understanding how ESLint module boundaries enforce dependency constraints
- Exploring the workspace file/library tree to find where something lives
- General "how is this repo organized" questions
- Reviewing Angular 19 dev patterns/standards, DI patterns, or testing standards per layer

## Overview

**Tech stack**: .NET 9 (RadEndpoints + MediatR + SignalR) backend; Angular 19 (standalone components, NgRx Signal Store, Angular Material) frontend in an Nx monorepo.

**Clean Architecture layers** (dependency direction: Presentation/Infrastructure → Application → Domain):
1. **Domain** (`libs/domain`) — pure business logic, contracts, models; zero dependencies
2. **Application** (`libs/application`) — use cases, state management (NgRx Signal Store); depends only on Domain
3. **Infrastructure** (`libs/infrastructure`) — HTTP clients, SignalR, external concerns; depends on Application and Domain
4. **Presentation** (`libs/features`, `libs/ui`) — UI components; depends on Application and Domain, not Infrastructure directly

ESLint module-boundary rules enforce these dependency constraints at build/lint time via project tags (`scope:domain`, `scope:application`, `scope:infrastructure`, `scope:features`, `scope:app`).

## Full Reference

See [references/OVERVIEW_CONTEXT.md](references/OVERVIEW_CONTEXT.md) for the complete document, including:

- Full technology stack (backend and frontend)
- Clean Architecture layer responsibilities in detail, with examples per layer
- Implementation status (Completed / In Progress / Planned features) — **note**: this is a point-in-time snapshot embedded in an otherwise-evergreen doc and can drift from the actual codebase; spot-check against the code if precision matters
- Full Nx workspace file/library tree (apps, domain, application, infrastructure, app, features, ui, utils, data-access)
- Angular 19 development patterns and standards per layer (domain, application, infrastructure, UI)
- Dependency injection patterns and API client integration conventions
- Testing standards summary per layer
- Code organization standards (naming conventions, barrel exports, import rules)
