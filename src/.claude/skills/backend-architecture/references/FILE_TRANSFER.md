# File Transfer Architecture

## The Premise

File transfers to TeensyROM devices involve two inherently slow network hops: HTTP upload from the client to the backend staging area, and then serial write from staging to the device over a single shared COM port. The transfer subsystem overlaps these two hops — **while the device is writing one file, the next is uploading in parallel** — via a per-device queue fed by an upload endpoint and drained by a dedicated background pump. This overlap is why we cannot simply serialize files to device memory in the endpoint itself: the endpoint must return immediately after staging, not wait for the slow serial write.

---

## Component Chain

Upload flows through: **endpoint → capacity gate → staging → queue → pump → device**.

```mermaid
%%{init: {'theme': 'dark', 'primaryColor': '#5a2c6b', 'primaryBorderColor': '#7d3fa3', 'primaryTextColor': '#fff', 'secondaryColor': '#0066cc', 'secondaryBorderColor': '#0052a3', 'tertiaryColor': '#2d7a3e', 'tertiaryBorderColor': '#1f5a2e', 'lineColor': '#b3b3b3', 'tertiaryTextColor': '#fff'}}%%
graph TB
    Client["HTTP Client"]
    
    subgraph Upload["Upload Endpoint & Capacity Control"]
        UPLOAD["UploadFileEndpoint<br/>POST /api/transfers/{jobId}/files"]
        GATE["TransferCapacityGate<br/>Disk quota + flow control"]
    end
    
    subgraph Staging["Staging Layer"]
        STORE["TransferStagingStore<br/>Raw file bytes to disk"]
    end
    
    subgraph Queue["Transfer Queue"]
        TQ["TransferQueue<br/>Per-device channels"]
    end
    
    subgraph Pump["Background Pump & Device Write"]
        PUMP["TransferPump<br/>Drain queue, coordinate device"]
        REGISTRY["TransferJobRegistry<br/>Job lifecycle"]
        LEASE["DeviceLeaseCoordinator<br/>Exclusive device access"]
    end
    
    subgraph Device["Physical Device"]
        SERIAL["TeensyROM Device<br/>Serial port write"]
    end
    
    Client -->|"1. HTTP POST<br/>raw body"| UPLOAD
    UPLOAD -->|"2. Wait for<br/>capacity"| GATE
    GATE -->|"3. Admit & reserve<br/>bytes"| GATE
    UPLOAD -->|"4. Stream to disk"| STORE
    UPLOAD -->|"5. Enqueue<br/>staged file"| TQ
    TQ -->|"6. Dequeue per device"| PUMP
    PUMP -->|"7. Lookup job<br/>state"| REGISTRY
    PUMP -->|"8. Check device<br/>lease"| LEASE
    PUMP -->|"9. Send file<br/>via serial"| SERIAL
    PUMP -->|"10. Release capacity<br/>& slot"| GATE
    
    style GATE fill:#ff9999
    style PUMP fill:#99ccff
    style REGISTRY fill:#99ff99
    style TQ fill:#ffcc99
```

---

## Job State Machine

A `TransferJob` is a mutable, thread-safe aggregate managing one logical transfer operation. Its state machine enforces what files can be accepted and when the pump can finalize it:

```mermaid
%%{init: {'theme': 'dark', 'primaryColor': '#5a2c6b', 'primaryBorderColor': '#7d3fa3', 'primaryTextColor': '#fff', 'secondaryColor': '#0066cc', 'secondaryBorderColor': '#0052a3', 'tertiaryColor': '#2d7a3e', 'tertiaryBorderColor': '#1f5a2e', 'lineColor': '#b3b3b3', 'tertiaryTextColor': '#fff'}}%%
stateDiagram-v2
    Created --> Receiving: UploadFileEndpoint<br/>admits first file
    Created --> Cancelling: Client cancels<br/>before upload
    Created --> Abandoned: Idle sweep,<br/>no subscribers
    Created --> Aborted: Device vanished<br/>mid-pump
    
    Receiving --> Sealed: SealJobEndpoint<br/>stops accepting files
    Receiving --> Cancelling: Client cancels<br/>during upload
    Receiving --> Abandoned: Idle sweep,<br/>no activity
    Receiving --> Aborted: Device vanished<br/>mid-pump
    
    Sealed --> Completed: All pending<br/>files sent
    Sealed --> Cancelling: Client cancels<br/>sealed job
    Sealed --> Aborted: Device vanished<br/>mid-pump
    
    Cancelling --> Cancelled: All pending<br/>files discarded
    Cancelling --> Aborted: Device vanished<br/>mid-pump
    
    Completed --> [*]
    Cancelled --> [*]
    Abandoned --> [*]
    Aborted --> [*]
    
    note right of Created
        Job created, not yet
        accepting uploads
    end note
    note right of Receiving
        Accepting uploads,
        pump is draining
    end note
    note right of Sealed
        No new uploads;
        pump is draining
    end note
    note right of Completed
        All files sent successfully
        or failed; job is done
    end note
    note right of Abandoned
        Client vanished for
        2 minutes with no work
    end note
    note right of Aborted
        Device disconnected
        or critical error
    end note
```

**Terminal states** (`Completed`, `Cancelled`, `Abandoned`, `Aborted`): job accepts no more transitions and is eligible for eviction after 5 minutes.

---

## Device Lease vs. Port Lock

The serial port is single-threaded and locked for the duration of each command via `CommunicationPortBehavior`'s static per-command semaphore. This semaphore **has a five-minute stale-lock disposal** — if a thread acquires it and never releases (e.g. crashes), the lock is recycled automatically to prevent deadlock.

A file transfer job must hold exclusive access to the device **across many serial commands** — reset, then multiple writes. Holding the semaphore itself across the entire job would violate the five-minute contract: the stale-lock cleanup could dispose the job's lock while work is still in progress.

The `DeviceLeaseCoordinator` solves this by being a **separate, timer-less construct** above the port lock:
- When a job starts (CreateJobEndpoint), it acquires a lease: `leaseCoordinator.TryAcquire(deviceId, jobId)`.
- `CreateJobEndpoint` is the sole exclusivity gate: at job-creation time, `TryAcquire` atomically claims the lease only if the device is unheld, rejecting a second job for an already-leased device with a `409 Conflict` carrying the holding job's id as the `activeJobId` extension. The pump and sweeper never recheck the lease while a job runs — they only call `Release` on it.
- When the job reaches a terminal state, the lease is released.
- No stale-lock cleanup: the lease is held in-memory and released explicitly by the pump.

This design allows long-running transfers to span multiple short-lived serial commands without risking lock disposal in the middle of work.

---

## The Capacity Gate's Three Roles

`TransferCapacityGate` looks simple at first — it's a semaphore for disk quota — but it serves three distinct purposes, and removing any one creates a correctness bug:

**1. Disk Quota**: The gate tracks staged bytes in use and blocks uploads when `bytesInUse >= MaxStagedBytes` (default 2 GB). Without it, a pathological client uploading faster than the device drains could fill the server's disk.

**2. Flow Control**: The gate paces uploads by making `UploadFileEndpoint.Handle()` await `gate.WaitForSlotAsync()`. This is the system's **only pacing mechanism** — there is no HTTP connection pooling, no back-pressure, no rejection. A slow device means uploads simply take longer to return; they never fail.

**3. Abandonment Bound**: The gate bounds the maximum time an abandoned job can monopolize device staging space. When a client vanishes mid-transfer, the `TransferJobSweeper` detects idle >= 2 minutes with no subscribers and transitions the job to `Abandoned`. The sweeper then purges the staging directory and releases the gate capacity. **Without the gate enforcing a quota, an abandoned job could stall forever**, because the pump would have nothing to drain (an abandoned job has no sealing endpoint call to transition it), and without the pump draining, `PendingCount` never reaches zero.

---

## Abandonment: The Idle Sweep

When a client connection drops before calling `SealJobEndpoint`, the job is left in `Receiving` with queued (but not yet sent) files. The `TransferJobSweeper` runs every 30 seconds and closes this gap:

- **Idle Detection**: A job in `Receiving` or `Created` with `PendingCount == 0` (no files in the pump's queue) and `LastActivityUtc > 2 minutes` ago is idle.
- **Subscriber Check**: If the job still has active SignalR subscribers (`TransferHub.Subscribe()` calls), the client may still be alive — the job is **not** abandoned.
- **Transition to Abandoned**: If idle and no subscribers, transition to `Abandoned`, release the lease and staging directory, notify clients.

Queued files are **delivered, not discarded**: the pump drains the queue normally, and as each file completes, the sweeper's condition (`PendingCount == 0`) triggers finalization. Only files still in the queue when the sweeper runs are lost, and this is rare — most jobs complete or the client reconnects with a subscriber.

---

## HTTP and SignalR Surface

### Routes

| Method | Route | Name | Purpose |
|--------|-------|------|---------|
| POST | `/api/devices/{deviceId}/storage/{storageType}/transfers` | CreateTransferJob | Start a new job; acquire lease |
| POST | `/api/transfers/{jobId}/files` | UploadTransferFile | Stream one file to staging |
| POST | `/api/transfers/{jobId}/seal` | SealTransferJob | Stop accepting uploads; let pump drain |
| GET | `/api/transfers/{jobId}` | GetTransferJob | Query job snapshot |
| GET | `/api/devices/{deviceId}/transfers/active` | GetActiveTransferJob | Get the job currently holding device lease |
| POST | `/api/transfers/{jobId}/cancel` | CancelTransferJob | Transition to Cancelling; pump discards remaining files |

### SignalR Hub: TransferHub

- **Subscribe(jobId)** → Joins the caller to the job's broadcast group, returns current snapshot. Active subscription counts as liveness for abandonment detection.
- **Unsubscribe(jobId)** → Removes the caller from the group.
- **OnDisconnectedAsync()** → Cleans up all subscriptions for the dropped connection.

**Events** (broadcast to job's group):
- **JobSnapshot** → Throttled (250ms) snapshot of job state, sent by pump as files complete and by sweeper on state transitions.
- **FileCompleted** → Per-file event with path, success/failure, size.

**Snapshot Structure**: `TransferJobDto` is the single wire shape sent over both HTTP and SignalR:
```json
{
  "jobId": "abc123...",
  "deviceId": "device-id",
  "storageType": "SD",
  "destinationDirectory": "/music",
  "state": "Receiving",
  "filesReceived": 10,
  "filesSent": 5,
  "filesFailed": 0,
  "bytesSent": 52428800,
  "totalFiles": null,
  "currentFile": "track-03.sid",
  "startedUtc": "2026-08-04T10:30:00Z",
  "lastActivityUtc": "2026-08-04T10:31:45Z",
  "error": null,
  "failures": []
}
```

**Snapshots are authoritative**, not incremental: each broadcast is a complete job state. The client never needs to merge or track deltas — the latest snapshot is the ground truth. This buys simplicity and resilience: late subscribers and disconnected clients that reconnect both get a correct state immediately without needing to replay events.

---

## Where Things Live

| Component | File Path |
|-----------|-----------|
| **Job & State** | `apps/api/src/TeensyRom.Api/Transfers/TransferJob.cs`<br/>`apps/api/src/TeensyRom.Core/Entities/Transfers/TransferJobState.cs`<br/>`apps/api/src/TeensyRom.Core/Entities/Transfers/TransferJobSnapshot.cs` |
| **Registry** | `apps/api/src/TeensyRom.Api/Transfers/TransferJobRegistry.cs` |
| **Capacity Gate** | `apps/api/src/TeensyRom.Api/Transfers/TransferCapacityGate.cs` |
| **Staging Store** | `apps/api/src/TeensyRom.Api/Transfers/TransferStagingStore.cs` |
| **Queue** | `apps/api/src/TeensyRom.Api/Transfers/TransferQueue.cs` |
| **Pump** | `apps/api/src/TeensyRom.Api/Transfers/TransferPump.cs` |
| **Lease Coordinator** | `apps/api/src/TeensyRom.Api/Transfers/DeviceLeaseCoordinator.cs` |
| **Progress Notifier** | `apps/api/src/TeensyRom.Api/Transfers/TransferProgressNotifier.cs` |
| **Job Sweeper** | `apps/api/src/TeensyRom.Api/Transfers/TransferJobSweeper.cs` |
| **Endpoints** | `apps/api/src/TeensyRom.Api/Endpoints/Transfers/` |
| **SignalR Hub** | `apps/api/src/TeensyRom.Api/Endpoints/Transfers/Hub/TransferHub.cs` |
| **Serial Command** | `apps/api/src/TeensyRom.Core.Serial/Commands/SaveFile/SaveFileCommand.cs`<br/>`apps/api/src/TeensyRom.Core.Serial/Commands/SaveFile/SaveFileCommandHandler.cs` |
| **DTO** | `apps/api/src/TeensyRom.Api/Models/TransferJobDto.cs` |
| **Options** | `apps/api/src/TeensyRom.Api/Transfers/TransferOptions.cs` |

---

## Configuration & Tuning

All constants are centralized in `TransferOptions` (a singleton, settable for testing):

| Setting | Default | Purpose |
|---------|---------|---------|
| `MaxStagedFiles` | 10,000 | Maximum concurrent uploads in flight |
| `MaxStagedBytes` | 2 GB | Disk quota for staged files |
| `IdleAbandonmentThreshold` | 2 minutes | Idle time before job is abandoned |
| `SweepInterval` | 30 seconds | How often sweeper checks for abandoned/evictable jobs |
| `SnapshotThrottle` | 250 ms | Min interval between progress broadcasts |
| `TerminalJobRetention` | 5 minutes | How long a completed job stays queryable |
| `DeviceChunkSize` | 16 KB | Chunk size for device write loop |
| `StagingRoot` | `{AppDir}/staging` | Directory for staged uploads |

---

**Document Version**: 1.0  
**Describes**: File transfer subsystem as shipped in P01–P04  
**Maintainer**: Backend Engineering Team
