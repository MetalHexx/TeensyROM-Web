---
name: backend-architecture
description: 'Backend architecture reference for the TeensyROM .NET 9 Web API. Use when working on the backend/API, understanding RadEndpoints structure, MediatR CQRS pipeline behaviors, serial device communication protocol, storage/caching (indexing, favorites, StorageCache), background file transfer to devices (staging, queue, transfer pump, SignalR progress), device connection management, or backend operational concerns (configuration, error handling, retries, observability, logging). Covers Clean Architecture layering, key components, endpoint patterns, MediatR flow diagrams, dependency map, and architecture patterns/anti-patterns to follow or avoid.'
---

# Backend Architecture Skill

Reference for the TeensyROM .NET 9 backend: a layered Web API managing physical TeensyROM devices over serial ports, with CQRS via MediatR, storage indexing/caching, and real-time SignalR streaming to the frontend.

## When to Use This Skill

- Working on the .NET API/backend (`apps/api/src/TeensyRom.*`)
- Understanding endpoint structure (RadEndpoints) or adding new endpoints
- Tracing the MediatR pipeline (LoggingBehavior, ExceptionBehavior, SerialBehavior) or command/handler flow
- Understanding serial device communication (state machine, ACK/NAK protocol, reconnection logic)
- Working with storage/indexing/caching (`StorageService`, `StorageCache`, favorites, metadata enrichment)
- Working on file transfer, upload endpoints, the transfer queue/pump, or the transfer hub
- Investigating backend operational concerns: configuration, error handling, retries/timeouts, health checks, logging/observability
- Reviewing architecture patterns to follow or anti-patterns to avoid in backend code

## Overview

**Core Responsibilities**:
- Device discovery, connection, and health monitoring over serial ports
- Serial protocol command execution with state management and error recovery
- Storage indexing/search/caching of device SD/USB contents
- File launching (transfer + execute on Commodore 64 via TeensyROM cartridge)
- Real-time log/event streaming to the frontend via SignalR
- RESTful API surface via RadEndpoints with auto-generated OpenAPI specs

**Layering**: `TeensyRom.Api` → `TeensyRom.Core.Device` → `TeensyRom.Core.Serial` / `TeensyRom.Core.Storage` → `TeensyRom.Core` (domain entities, contracts, shared utilities — referenced by all other projects).

**Critical pattern**: all device operations flow through MediatR with pipeline behaviors (logging, exception handling, serial locking/state transitions) before reaching handlers that execute serial/storage operations.

## Full Reference

See [references/BACKEND_ARCHITECTURE.md](references/BACKEND_ARCHITECTURE.md) for the complete architecture document, including:

- System architecture diagram and key components per layer (API, Device, Serial, Storage)
- Endpoint organization, versioning/validation conventions, and a typical endpoint code example
- Serial pipeline behaviors, command protocol (ACK/NAK), error handling/reconnection logic
- MediatR sequence diagrams for serial commands and storage indexing
- Storage/indexing deep dive: cache file structure, indexing strategies, read/write paths, metadata enrichment
- Major dependencies and dependency flow between projects
- Operational concerns: configuration, error handling layers, retries/timeouts, health checks, logging/observability
- Architecture patterns to embrace and anti-patterns to avoid
- Integration seams (frontend↔backend, backend↔hardware, storage↔serial)

See [references/FILE_TRANSFER.md](references/FILE_TRANSFER.md) for the file transfer subsystem: job lifecycle, capacity gating, staging-to-device queue, pump coordination, SignalR progress streaming, and abandonment handling.

For OpenAPI spec generation and consuming the generated TypeScript client, see the `api-client-generation` skill.
