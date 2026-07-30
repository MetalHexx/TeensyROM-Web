---
name: settings-architecture
description: 'End-to-end Settings feature data flow for TeensyROM: .NET backend persistence (Settings.json) through Clean Architecture layers (domain contract, infrastructure, NgRx Signal Store, feature UI) to the Angular settings view, plus a settings-usage audit (actively used vs infrastructure-ready vs not implemented). Use when tracing how a setting flows from disk to UI, adding a new settings category, wiring a setting into business logic, or checking whether a given setting is actually consumed anywhere.'
---

# Settings Architecture Skill

How the Settings feature's data flows end-to-end — from `.NET` backend disk persistence through Clean Architecture layers to the Angular UI — plus a snapshot audit of which settings actually drive business logic today.

## When to Use This Skill

- Tracing how a specific setting flows from `Settings.json` through the backend, API DTOs, domain mapper, `SettingsStore`, and into a feature component
- Adding a new settings category (backend record + frontend interface + mapper + UI section)
- Wiring a setting into business logic and wanting to follow the established layering
- Checking whether a setting you're about to change is actually read anywhere, or is inert/not-yet-wired

## Architecture at a Glance

```
Settings.json (disk) ⇄ SettingsService (.NET) ⇄ RadEndpoints (GetSettings/SaveSettings)
    ⇄ Settings DTOs → OpenAPI spec → SettingsApiService (generated)
    → Infrastructure SettingsService (implements ISettingsService) → DomainMapper (DTO ⇄ Model)
    → SettingsStore (NgRx Signal Store) → SettingsFormService (facade) → SettingsViewComponent
```

Load: bootstrap dispatches `SettingsStore.loadSettings()` → infra service calls the API → backend reads/creates `Settings.json` → DTO mapped to domain model → store updates state + history.

Save: `SettingsFormService` debounces form changes (1s) → `updateSettings()` pushes to history → `saveSettings()` persists → DomainMapper converts model → DTO → backend writes to disk and emits via an Rx observable.

Settings categories: Connection, Player, Video, File Transfer, Search, App — each with a backend record, a matching frontend interface, and a dedicated settings-view section component. See [references/SETTINGS_OVERVIEW.md](references/SETTINGS_OVERVIEW.md) for the full file tree, Mermaid architecture diagram, and code samples for the backend persistence and frontend store/auto-save patterns.

## Settings Usage Audit — Spot-Check Before Trusting

The reference doc includes a **point-in-time audit** ("Settings Usage in Codebase") classifying every setting as actively used, infrastructure-ready-but-unwired, or not implemented at all (e.g., search weights are accepted by `BaseStorageCache.Search()` but not yet read from settings; `connectionSettings.connectionType` has no TCP implementation). **This audit can drift as the codebase evolves** — treat it as a starting point and verify against current code (grep the setting's call sites) before relying on it for a decision, rather than trusting it blindly.

## Related Skills

- **`service-standards`** — the `ISettingsService`/`SETTINGS_SERVICE` token pattern this feature's infrastructure layer follows
- **`app-bootstrap`** — how `SettingsStore.loadSettings()` is invoked during app startup
