---
name: backend-domain
description: 'TeensyROM .NET backend domain knowledge — architecture, MediatR CQRS, serial protocol, storage systems, RadEndpoints, and testing patterns. Use when working on backend code, adding endpoints, modifying serial commands, updating storage/caching logic, writing backend tests, or understanding backend architecture. Covers .NET 9 API, pipeline behaviors, state machines, and multi-device orchestration.'
---

# Backend Domain Skill

Architecture guardrails and task routing for the TeensyROM .NET 9 backend. Enables any agent to understand layer boundaries, enforce patterns, and navigate to the right documentation.

## When to Use

- Implementing or modifying backend endpoints, commands, or services
- Planning backend features or architectural changes
- Working with serial communication or device management
- Modifying storage, caching, or indexing logic
- Writing backend unit or integration tests
- Debugging serial protocol or state machine issues

## Architecture Overview

Layered .NET 9 Web API bridging the Angular frontend to physical TeensyROM devices via serial ports.

**Layer dependency direction** (core → outer):

```
TeensyRom.Core (entities, abstractions)
  ← TeensyRom.Core.Serial (MediatR commands, state machine)
  ← TeensyRom.Core.Storage (indexing, caching, search)
  ← TeensyRom.Core.Device (multi-device orchestration)
  ← TeensyRom.Api (RadEndpoints, SignalR hubs)
```

**All serial operations** flow through MediatR with pipeline behaviors:

```
Endpoint → MediatR → LoggingBehavior → ExceptionBehavior → SerialBehavior → Handler → Serial I/O
```

## Critical Rules

1. **Never access `SerialPort` directly** — Always use `ISerialStateContext` to respect the serial state machine. Direct port access causes race conditions.
2. **All serial commands use MediatR** — Implement `ITeensyCommand<T>`. Pipeline behaviors (logging, locking, exception handling) are applied automatically.
3. **Endpoints are thin adapters** — Extract request, resolve device/service, delegate to MediatR/service, map to DTO, send response. No business logic in endpoints.
4. **Multi-device: always bind DeviceId** — Commands must set `DeviceId` so `SerialBehavior` binds the correct `ISerialStateContext`.
5. **Thread-safe singletons** — `DeviceConnectionManager` is a singleton orchestrating concurrent devices. All state mutation must be thread-safe.
6. **Cache invalidation must cascade** — Storage cache updates/deletes must cascade to children and siblings (e.g., favorites affect original + copy).
7. **Let `ExceptionBehavior` handle errors** — Don't swallow exceptions in handlers. The pipeline converts them to error responses and publishes alerts.
8. **Metadata enrichment at index time** — HVSC (music) and OneLoad64 (games) enrichment runs during indexing, not on-demand reads.

## Implementation Patterns

### Adding an Endpoint

Each endpoint lives in `Endpoints/[Domain]/[Action]/` with `[Action]Endpoint.cs` + `[Action]Models.cs`. Extends `RadEndpoint<TRequest, TResponse>` with `Configure()` for routing and `Handle()` for logic. See [RadEndpoints docs](https://github.com/MetalHexx/RadEndpoints/blob/main/README.md).

### Adding a Serial Command

1. Create command in `TeensyRom.Core.Serial/Commands/[Name]/` implementing `ITeensyCommand<TResult>`
2. Create handler implementing `IRequestHandler<TCommand, TResult>`
3. Pipeline behaviors apply automatically — no registration needed
4. Protocol: send token bytes → wait ACK/NAK → send parameters → parse result

### Serial State Machine

Five states: `Start → Connectable → Connected ↔ Busy`, with `ConnectionLost` for recovery. Health check polls every 2s. Reconnection logic handles COM port reassignment after device reset.

### Storage Caching

Three strategies: **lazy** (cache miss → fetch → cache), **full indexing** (recursive walk, 5-10 min for large SD), **incremental** (single path merge). Cache persists to disk as `*.cache.json`.

### SignalR Hubs

`/logHub` for real-time device logs, `/deviceEventHub` for device state changes. Backend pushes via `IAlertService` and `DeviceEventStream`.

### Testing

- **Unit tests**: Mock interfaces (`ISerialStateContext`, `IStorageService`, etc.) with NSubstitute
- **Integration tests**: `WebApplicationFactory` with real DI container
- **Handler tests**: Mock serial port operations, verify command/response flow
- **Frameworks**: xUnit, FluentAssertions, NSubstitute

## Task Routing

| Task | Read First |
|------|-----------|
| Full architecture, diagrams, sequences | `docs/BACKEND_ARCHITECTURE.md` |
| Frontend ↔ backend integration | `docs/OVERVIEW_CONTEXT.md` |
| API client generation workflow | `.github/skills/api-client-generation/SKILL.md` |
| RadEndpoints patterns | [RadEndpoints README](https://github.com/MetalHexx/RadEndpoints/blob/main/README.md) |
| Endpoint examples | `apps/api/src/TeensyRom.Api/Endpoints/` |
| Serial commands & behaviors | `apps/api/src/TeensyRom.Core.Serial/Commands/` |
| Storage service & cache | `apps/api/src/TeensyRom.Core.Storage/` |
| Device management | `apps/api/src/TeensyRom.Core.Device/` |
| Domain entities & abstractions | `apps/api/src/TeensyRom.Core/` |

## Anti-Patterns

- **Direct `SerialPort` access** — Bypasses state machine, causes race conditions
- **Singleton mutation without locks** — `DeviceConnectionManager` must be thread-safe
- **Blocking serial reads** — Use timeouts and polling loops, never infinite waits
- **Swallowing exceptions** — Let `ExceptionBehavior` handle; don't catch/ignore in handlers
- **Forgetting `DeviceId`** — Multi-device commands silently bind wrong serial context
- **Cache invalidation gaps** — Updates must cascade to children/siblings
- **Business logic in endpoints** — Endpoints delegate to services/MediatR only
