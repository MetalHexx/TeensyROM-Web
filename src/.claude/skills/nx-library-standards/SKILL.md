---
name: nx-library-standards
description: 'Nx library lifecycle standards for the teensyrom-nx workspace: creating new libraries (domain/feature/UI/data-access) with correct project.json, ESLint scope/type tags, Clean Architecture dependency constraints, and naming conventions; plus the checklist for safely moving, renaming, or changing the path alias of an existing library. Use when generating a new Nx library, choosing library type/location/tags, configuring project.json or vite.config, or when moving/renaming a library and needing to update tsconfig paths, imports, and implicit dependencies consistently.'
---

# Nx Library Standards Skill

Standards for the full lifecycle of libraries in the teensyrom-nx Nx workspace: creating new ones and safely moving/renaming existing ones.

## When to Use This Skill

- **Creating a new Nx library** - choosing library type (domain/feature/UI/data-access), directory structure, import path, `project.json` tags, ESLint dependency constraints → [references/NX_LIBRARY_STANDARDS.md](references/NX_LIBRARY_STANDARDS.md)
- **Moving, renaming, or changing the path alias of an existing library** - updating `tsconfig.base.json`, imports, `implicitDependencies`, and verifying the workspace → [references/NX_LIBRARY_MOVE.md](references/NX_LIBRARY_MOVE.md)

## Library Types (Quick Reference)

| Type        | Location                       | Purpose                                        |
| ----------- | ------------------------------- | ----------------------------------------------- |
| Domain      | `libs/domain/[domain]/[type]/` | Business logic, contracts, models, state       |
| Feature     | `libs/features/[feature]/`     | UI components/pages with business logic        |
| UI          | `libs/ui/[category]/`          | Reusable presentational components             |
| Data Access | `libs/data-access/[source]/`   | External API clients and data fetching         |

All libraries require Clean Architecture `scope:*` and `type:*` tags in `project.json` so ESLint can enforce module boundaries (see reference for the full dependency matrix).

## Creating a New Library

See [references/NX_LIBRARY_STANDARDS.md](references/NX_LIBRARY_STANDARDS.md) for generation commands, `project.json`/`vite.config` templates, required tags, barrel export standards, naming conventions, and the integration verification checklist.

## Moving or Renaming an Existing Library

See [references/NX_LIBRARY_MOVE.md](references/NX_LIBRARY_MOVE.md) for the full checklist: update the path alias, update the project name, search-and-replace all imports and `implicitDependencies`, then verify with `nx graph`, `nx build`, `nx test`, and `nx lint`.

## Related Skills

- **`api-client-generation`** - the data-access library type these standards apply to (`libs/data-access/api-client`)
