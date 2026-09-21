---
name: backend-domain
description: 'TeensyROM .NET backend domain knowledge — architecture, MediatR CQRS, serial protocol, storage systems, RadEndpoints, and testing patterns. Use when working on backend code, adding endpoints, modifying serial commands, updating storage/caching logic, writing backend tests, or understanding backend architecture. Covers .NET 9 API, pipeline behaviors, the connectivity ring, and multi-device orchestration.'
---

# Backend Domain Skill

Architecture guardrails and task routing for the TeensyROM .NET 9 backend. Enables any agent to understand layer boundaries, enforce patterns, and navigate to the right documentation.

## When to Use

- Implementing or modifying backend endpoints, commands, or services
- Planning backend features or architectural changes
- Working with serial communication or device management
- Modifying storage, caching, or indexing logic
- Writing backend unit or integration tests
- Debugging serial protocol or connectivity-ring issues

## Architecture Overview

Layered .NET 9 Web API bridging the Angular frontend to physical TeensyROM devices via serial ports.

**Layer dependency direction** (core → outer):

```
TeensyRom.Core (entities, abstractions)
  ← TeensyRom.Core.Serial (MediatR commands, the gate, device recovery)
  ← TeensyRom.Core.Storage (indexing, caching, search)
  ← TeensyRom.Core.Device (multi-device orchestration)
  ← TeensyRom.Api (RadEndpoints, SignalR hubs)
```

**All serial operations** flow through MediatR with pipeline behaviors:

```
Endpoint → MediatR → LoggingBehavior → ExceptionBehavior → CommunicationPortBehavior (the gate) → Handler → Serial I/O
```

## Critical Rules

1. **Never open a port outside the ring** — Always go through the gate (`CommunicationPortBehavior`) and `ICommunicationPort`; only `DeviceRecovery` closes and reopens a port, and only while reacquiring. Direct access bypasses locking and recovery, causing race conditions.
2. **All serial commands use MediatR** — Implement `ITeensyCommand<T>`. Pipeline behaviors (logging, locking, exception handling) are applied automatically.
3. **Endpoints are thin adapters** — Extract request, resolve device/service, delegate to MediatR/service, map to DTO, send response. No business logic in endpoints.
4. **Commands carry `DeviceId` so the gate can find the record** — Multi-device commands must set `DeviceId`; the gate uses it to find the right per-device lock and `DeviceConnectionRecord`.
5. **No fixed sleeps — poll with a ceiling** — `DeviceRecovery` polls the version command at `Connection.PollIntervalMs` up to a per-transport, per-reason ceiling; never a hardcoded retry count or delay.
6. **Thread-safe singletons** — `DeviceConnectionManager` is a singleton orchestrating concurrent devices. All state mutation must be thread-safe.
7. **Cache invalidation must cascade** — Storage cache updates/deletes must cascade to children and siblings (e.g., favorites affect original + copy).
8. **Let `ExceptionBehavior` handle errors** — Don't swallow exceptions in handlers. The pipeline converts them to error responses and publishes alerts.
9. **Metadata enrichment at index time** — HVSC (music) and OneLoad64 (games) enrichment runs during indexing, not on-demand reads.

## Implementation Patterns

### Adding an Endpoint

Each endpoint lives in `Endpoints/[Domain]/[Action]/` with `[Action]Endpoint.cs` + `[Action]Models.cs`. Extends `RadEndpoint<TRequest, TResponse>` with `Configure()` for routing and `Handle()` for logic. See [RadEndpoints docs](https://github.com/MetalHexx/RadEndpoints/blob/main/README.md).

### Adding a Serial Command

1. Create command in `TeensyRom.Core.Serial/Commands/[Name]/` implementing `ITeensyCommand<TResult>`
2. Create handler implementing `IRequestHandler<TCommand, TResult>`
3. Pipeline behaviors apply automatically — no registration needed
4. Protocol: send token bytes → wait ACK/NAK → send parameters → parse result

### Connectivity Ring

No state-machine object: each device's `DeviceConnectionRecord` tracks a `DeviceMode` (`FullIdle → FullBusy`, `Minimal`, `Unreachable`) plus its known endpoints. The gate (`CommunicationPortBehavior`) locks one command at a time per device and reacts to what the exchange reports — including a reactive Busy reset when the device answers busy; a transport drop or a `Minimal` device hands off to `DeviceRecovery`, which reacquires the device on its own port and polls the version command up to a per-transport ceiling — no background health-check task. Serial recovery and discovery locate a device's current port by chip id via `TeensyPortLocator` (`apps/api/src/TeensyRom.Core.Serial/Usb/TeensyPortLocator.cs`), falling back to probing every port when the USB descriptor filter is unavailable. Three occasions run discovery: API start (cache-first, confirmed by chip id), the "Discover Devices" full sweep, and a page-load listing that contacts nothing.

### Storage Caching

Three strategies: **lazy** (cache miss → fetch → cache), **full indexing** (recursive walk, 5-10 min for large SD), **incremental** (single path merge). Cache persists to disk as `*.cache.json`.

### SignalR Hubs

`/logHub` for real-time device logs, `/deviceEventHub` for device state changes. Backend pushes via `IAlertService` and `DeviceEventStream`.

### Testing

- **Unit tests**: Mock interfaces (`ICommunicationPort`, `IDeviceRecovery`, `IStorageService`, etc.) with NSubstitute
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

- **Direct port access outside the ring** — Bypasses the gate's locking and recovery, causes race conditions
- **Singleton mutation without locks** — `DeviceConnectionManager` must be thread-safe
- **Blocking serial reads** — Use timeouts and polling loops, never infinite waits
- **Swallowing exceptions** — Let `ExceptionBehavior` handle; don't catch/ignore in handlers
- **Forgetting `DeviceId`** — The gate can't find the right per-device lock and record without it
- **Cache invalidation gaps** — Updates must cascade to children/siblings
- **Business logic in endpoints** — Endpoints delegate to services/MediatR only
