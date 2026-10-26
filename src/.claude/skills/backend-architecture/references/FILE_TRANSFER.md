# File Transfer Architecture

## The Premise

File transfers to TeensyROM devices involve two inherently slow network hops: HTTP upload from the client to the backend staging area, and then serial write from staging to the device over a single shared COM port. The transfer subsystem overlaps these two hops — **while the device is writing one file, the next is uploading in parallel** — via a per-device queue fed by an upload endpoint and drained by a dedicated background pump. This overlap is why we cannot simply serialize files to device memory in the endpoint itself: the endpoint must return immediately after staging, not wait for the slow serial write.

Some files are archives and require expansion (unzipping, extraction) before writing to the device. The expansion stage runs after staging but before queueing, with the expanded children written as individual files to the queue. This order prevents expansion — a CPU and I/O intensive operation — from blocking the device-write loop, which is single-threaded per device and the only path that releases staging capacity. An expansion operation that waited on available queue space could deadlock: it would wait on capacity only its own thread could free.

---

## Component Chain

**Non-archive uploads** flow: **endpoint → capacity gate → staging → queue → pump → device**. **Archive uploads** flow: **endpoint → scratch → expansion → (expanded entries) → capacity gate → staging → queue → pump → device**. When the endpoint detects an archive, it bypasses the capacity gate and staging, writing the raw archive body directly to scratch. The expansion service then walks the archive tree; after all archives are expanded, every extracted entry (including those from nested archives) is admitted through the standard gate-and-staging pipeline, ensuring fair capacity accounting for expanded content.

```mermaid
%%{init: {'theme': 'dark', 'primaryColor': '#5a2c6b', 'primaryBorderColor': '#7d3fa3', 'primaryTextColor': '#fff', 'secondaryColor': '#0066cc', 'secondaryBorderColor': '#0052a3', 'tertiaryColor': '#2d7a3e', 'tertiaryBorderColor': '#1f5a2e', 'lineColor': '#b3b3b3', 'tertiaryTextColor': '#fff'}}%%
graph TB
    Client["HTTP Client"]
    
    subgraph Upload["Upload Endpoint"]
        UPLOAD["UploadFileEndpoint<br/>POST /api/transfers/{jobId}/files"]
    end
    
    subgraph Capacity["Capacity Control"]
        GATE["TransferCapacityGate<br/>Staging quota + flow control"]
    end
    
    subgraph Staging["Staging Layer"]
        STORE["TransferStagingStore<br/>Raw file bytes to disk"]
    end
    
    subgraph Expansion["Archive Expansion (if needed)"]
        SCRATCH["ScratchStore<br/>Archive temp storage"]
        READER["ArchiveReader<br/>Unzip/extract"]
        RESOLVER["EntryPathResolver<br/>Entry path validation"]
        EXPANDER["ArchiveExpansionService<br/>Orchestrate extraction"]
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
    
    UPLOAD -->|"2a. Non-archive:<br/>check capacity"| GATE
    UPLOAD -->|"2b. Archive:<br/>write to scratch"| SCRATCH
    
    GATE -->|"3. Wait for<br/>slot & quota"| GATE
    GATE -->|"4. Stream to disk"| STORE
    STORE -->|"5. Enqueue<br/>staged file"| TQ
    
    SCRATCH -->|"3. Extract archive"| EXPANDER
    EXPANDER -->|"4a. Read entries"| READER
    READER -->|"4b. Resolve paths"| RESOLVER
    EXPANDER -->|"5. Each expanded entry:<br/>check capacity"| GATE
    
    TQ -->|"6. Dequeue per device"| PUMP
    PUMP -->|"7. Lookup job<br/>state"| REGISTRY
    PUMP -->|"8. Check device<br/>lease"| LEASE
    PUMP -->|"9. Send file<br/>via serial"| SERIAL
    PUMP -->|"10. Release<br/>capacity"| GATE
    SERIAL -->|"file sent"| Device
    
    style GATE fill:#d4a574
    style PUMP fill:#0066cc
    style REGISTRY fill:#2d7a3e
    style TQ fill:#d4a574
    style SCRATCH fill:#d4a574
    style EXPANDER fill:#7d3fa3
```

---

## Job State Machine

A `TransferJob` is a mutable, thread-safe aggregate managing one logical transfer operation. Its state machine enforces what files can be accepted and when the pump can finalize it:

```mermaid
%%{init: {'theme': 'dark', 'primaryColor': '#5a2c6b', 'primaryBorderColor': '#7d3fa3', 'primaryTextColor': '#fff', 'secondaryColor': '#0066cc', 'secondaryBorderColor': '#0052a3', 'tertiaryColor': '#2d7a3e', 'tertiaryBorderColor': '#1f5a2e', 'lineColor': '#b3b3b3', 'tertiaryTextColor': '#fff'}}%%
stateDiagram-v2
    Created --> Receiving: UploadFileEndpoint<br/>admits first file
    Created --> Cancelled: Client cancels<br/>before upload
    Created --> Abandoned: Idle sweep,<br/>no subscribers
    Created --> Aborted: Device vanished<br/>mid-pump
    
    Receiving --> Sealed: SealJobEndpoint<br/>stops accepting files
    Receiving --> Cancelled: Client cancels<br/>during upload
    Receiving --> Abandoned: Idle sweep,<br/>no activity
    Receiving --> Aborted: Device vanished<br/>mid-pump
    
    Sealed --> Completed: All pending<br/>files sent
    Sealed --> Cancelled: Client cancels<br/>sealed job
    Sealed --> Aborted: Device vanished<br/>mid-pump
    
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

## Starting a Job

`ITransferJobService` owns the engine-side lifecycle of a job: `Start`, `AddFileAsync` and `Seal`. It does not depend on how the request arrived. `CreateJobEndpoint` and `WatchFolderDelivery` both call it, so the lease, destination checks and sealing live in one place. `Start` returns a `TransferStartError` (`DeviceNotFound`, `StorageUnavailable`, `InvalidDestination` or `DeviceBusy`) when it cannot create the job. `Seal` is idempotent once a job is Sealed.

---

## Device Lease vs. Port Lock

The serial port is single-threaded and locked for the duration of each command via `CommunicationPortBehavior`'s static per-command semaphore. This semaphore **has a five-minute stale-lock disposal** — if a thread acquires it and never releases (e.g. crashes), the lock is recycled automatically to prevent deadlock.

A file transfer job must hold exclusive access to the device **across many serial commands** — reset, then multiple writes. Holding the semaphore itself across the entire job would violate the five-minute contract: the stale-lock cleanup could dispose the job's lock while work is still in progress.

The `DeviceLeaseCoordinator` solves this by being a **separate, timer-less construct** above the port lock:
- When a job starts, `ITransferJobService.Start` acquires a lease: `leaseCoordinator.TryAcquire(deviceId, jobId)`.
- `Start` is the sole exclusivity gate, and both `CreateJobEndpoint` and the watch-folder delivery call it. `TryAcquire` atomically claims the lease only if the device is unheld. On a conflict `Start` removes the new job and returns `DeviceBusy` with the holding job's id as `ActiveJobId`; `CreateJobEndpoint` answers that as a `409 Conflict` carrying it as the `activeJobId` extension. The pump and sweeper never recheck the lease while a job runs — they only call `Release` on it.
- When the job reaches a terminal state, the lease is released.
- No stale-lock cleanup: the lease is held in-memory and released explicitly by the pump.

This design allows long-running transfers to span multiple short-lived serial commands without risking lock disposal in the middle of work.

---

## The Capacity Gate's Three Roles

`TransferCapacityGate` looks simple at first — it's a semaphore for disk quota — but it serves three distinct purposes, and removing any one creates a correctness bug:

**1. Disk Quota**: The gate tracks staged bytes in use and blocks uploads when `bytesInUse >= MaxStagedBytes` (default 4 GB). Without it, a pathological client uploading faster than the device drains could fill the server's disk.

**2. Flow Control**: The gate paces uploads by making `UploadFileEndpoint.Handle()` await `gate.WaitForSlotAsync()`. This is the system's **only pacing mechanism** — there is no HTTP connection pooling, no back-pressure, no rejection. A slow device means uploads simply take longer to return; they never fail.

**3. Abandonment Bound**: The gate bounds the maximum time an abandoned job can monopolize device staging space. When a client vanishes mid-transfer, the `TransferJobSweeper` detects idle >= 2 minutes with no subscribers and transitions the job to `Abandoned`. The sweeper then purges the staging directory and releases the gate capacity. **Without the gate enforcing a quota, an abandoned job could stall forever**, because the pump would have nothing to drain (an abandoned job has no sealing endpoint call to transition it), and without the pump draining, `PendingCount` never reaches zero.

## Scratch Store Quota

The scratch store holds intermediate data during archive expansion and has its own separate quota: `MaxScratchBytes` (default 8 GB). Unlike the staging gate (which **waits** for capacity), the scratch store **refuses** expansion if it would exceed quota — it returns an error to the client rather than blocking. This separation is deliberate: the staging gate is released only when the pump writes to the device, but archive expansion runs on the upload thread. If expansion waited on the staging gate for space, and expansion was slow enough that it blocked the pump's ability to drain staging, a deadlock would occur: expansion would wait on capacity only the pump could release, and the pump couldn't run because it couldn't release staging without first writing an expanded file that expansion hasn't finished yet. By refusing rather than waiting, expansion fails fast and signals the client to retry later, avoiding the deadlock.

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
| GET | `/api/transfers` | ListTransferJobs | Every job the registry holds, as snapshots |
| GET | `/api/devices/{deviceId}/transfers/active` | GetActiveTransferJob | Get the job currently holding device lease |
| POST | `/api/transfers/{jobId}/cancel` | CancelTransferJob | Transition straight to Cancelled, releasing device/staging/scratch; pump discards remaining files |

### SignalR Hub: TransferHub

- **Subscribe(jobId)** → Joins the caller to the job's broadcast group, returns current snapshot. Active subscription counts as liveness for abandonment detection.
- **Unsubscribe(jobId)** → Removes the caller from the group.
- **SubscribeAll()** → Joins the caller to the all-transfers group and returns every current job, newest first.
- **UnsubscribeAll()** → Removes the caller from the all-transfers group.
- **OnDisconnectedAsync()** → Cleans up all subscriptions for the dropped connection.

`SubscribeAll` and `UnsubscribeAll` do not count as liveness. They bypass the subscription tracker and `Touch`, so watching every transfer never keeps a job alive or delays its abandonment.

**Events** (broadcast to job's group):
- **JobSnapshot** → Throttled (250ms) snapshot of job state, sent by pump as files complete and by sweeper on state transitions. The snapshot is authoritative and self-contained — there is no separate per-file event; per-file outcomes ride inside the snapshot's `recentCompletions`/`failures` lists.

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
  "expandingArchive": "album.zip",
  "expansionBytesWritten": 134217728,
  "expansionBytesDeclared": 268435456,
  "expandedFileCount": 42,
  "origin": { "kind": "Upload", "watchFolderId": null, "watchFolderPath": null },
  "launchState": "None",
  "launchedPath": null,
  "launchError": null,
  "failures": [],
  "recentCompletions": [
    {
      "jobId": "abc123...",
      "relativePath": "track-05.sid",
      "targetPath": "/music/track-05.sid",
      "success": true,
      "error": null,
      "sizeBytes": 4096
    }
  ],
  "bytesPerSecond": 131072.0,
  "filesPerSecond": 2.5
}
```

`expandingArchive` (string, nullable) — the filename of the archive currently being expanded; `null` if none. `expansionBytesWritten` (long) — bytes written to scratch so far in the current expansion. `expansionBytesDeclared` (long) — total bytes the archive claims it will expand to; compared against `MaxScratchBytes` to pre-reject expansion. `expandedFileCount` (int, nullable) — count of files extracted from the archive; the browser may compose this into per-entry progress UI.

`origin` (object) — where the job came from. `kind` is `Upload` or `WatchFolder`; for a watch folder, `watchFolderId` and `watchFolderPath` name it. `launchState` is `None`, `Pending`, `Launched`, `Incompatible` or `Failed` (see Auto-Launch). `launchedPath` is the device path of the file chosen to launch, and `launchError` says why a launch failed. The enum values are PascalCase on the HTTP and SignalR wire; the CLI's `--json` camel-cases them.

`failures` and `recentCompletions` are both bounded, most-recent-first lists of the same `TransferFileCompleted` shape — `failures` holds only failed files (oldest-evicted once `RetainedFailuresBound` is exceeded; `filesFailed` itself stays an unbounded lifetime counter), while `recentCompletions` holds the last `RecentCompletionsBound` outcomes of either kind, for a live feed. `bytesPerSecond`/`filesPerSecond` are a rolling rate over `RateWindow` while the job is active, falling back to a lifetime average once terminal and to zero after a quiet window.

**Snapshots are authoritative**, not incremental: each broadcast is a complete job state. The client never needs to merge or track deltas — the latest snapshot is the ground truth. This buys simplicity and resilience: late subscribers and disconnected clients that reconnect both get a correct state immediately without needing to replay events.

---

## Auto-Launch

`TransferPump.TryFinalize` makes the launch decision once a job has sent its last file. `ITransferAutoLauncher.ShouldLaunch` decides whether a launch is due. `TryComplete` then moves the job to `Completed`, leaving a due launch `Pending`, so a poller never sees `Completed` with the launch undecided. The lease is released, staging and scratch are purged, and only then does `StartLaunch` run the launch in the background. Its outcome arrives on a later snapshot as `launchState`, `launchedPath` and `launchError`.

- **Who launches.** An upload launches when `FileTransferSettings.AutoLaunchOnCopyEnabled` is on or the job's `LaunchRequested` is set (`trom file upload --launch`). A watch-folder job launches only when both the setting and its destination's `launch` flag are set.
- **Which file.** As each file completes, `LaunchCandidateRanker.IsBetter` keeps the best candidate so far. Games (`Prg`, `Crt`, `P00`) rank 0, `Sid` 1, images and text (`Kla`, `Koa`, `Art`, `Aas`, `Hpi`, `Seq`, `Txt`) 2, `Hex` 3. A tie goes to the earlier file name, then the earlier full device path. `.trh` never launches. Neither do `D64`, `Zip`, `Nfo` or any other unranked type, such as `.reu`, `.d71`, `.d81`, `.md`, `.ocp` and `.pic`.
- **Failures.** A failed or incompatible launch is logged as a warning and recorded as `launchState` `Failed` or `Incompatible`. The job stays `Completed`.

---

## Watched Folders

`WatchFolderWatcher` runs one loop that watches every enabled watch folder and sends what arrives in it to that folder's destinations. The loop owns all watch state. `FileSystemWatcher` callbacks, settings changes and the poll timer only post messages to its channel, so nothing starts or stops from a callback (a settings change arrives synchronously under the settings lock). The watcher reports each folder's state through `IWatchFolderStatus`: `Watching`, `Off` (turned off) or `Unavailable` (the folder is missing or its watch failed to start).

Folders live in `TeensySettings.WatchFolders` (`Settings.json`). Only the `/api/watch-folders` endpoints change them, through `WatchFolderStore`: add, remove a folder, remove one device from a folder, and enable or disable. `WatchFolderStore` refuses a folder nested in another watched folder, a second destination for a device that already has one on the folder, and a device without a chip id. A whole-settings save keeps the folders.

### Arrival rules

- Only files that arrive after the folder is watched count. Files already there are ignored. A new subfolder is walked, and its files count.
- Only transferable types and archives count: `TransferableFileTypes`, and `IArchiveReader.IsArchiveExtension` for archives. A file renamed from a name the TeensyROM does not take to one it does arrives on the rename, which is how a browser's partial download counts.
- A file is settled once its size and readability hold still for `SettleTime`. Settled files that arrive within `GroupingWindow` of one another form one set. A set closes after a `GroupingWindow` with nothing new settling. While files are still being written, the set waits, for at most `MaxSetHold` from when it opened.

### Delivery

`WatchFolderDelivery` sends each closed set to every destination the folder has at that moment: one `TransferJob` per destination, all in parallel. Each job starts through `ITransferJobService.Start` with origin `WatchFolder` and the destination's `launch` flag. Each file is opened read-only from the watched folder and passed to `AddFileAsync`, archives first. The job is then sealed. Nothing is retried or kept for later. A destination that cannot start is logged and skipped, and a file that fails is logged. Neither holds up another destination. Watched files are never handed to anything that deletes its input.

### Skip log lines

These are engine warnings, so they reach the engine log. The main ones:

- `Watch folder skipped {file or N files} from {folder} for {device} ({storage} {path}): {reason}.` The reason is `not connected`, `storage missing`, `already transferring`, `invalid destination path`, or `could not start`.
- `Watch folder {folder}: {file} was not sent to {device}: {error}.` The job refused the file.
- `Watch folder {folder}: {file} could not be sent to {device}: {message}.` The file threw.
- `Watch folder {folder}: could not seal its transfer to {device}: {error}.`
- `Watch folder {folder}: delivery to {device} failed: {message}.` An unexpected failure.
- `Watch folder {folder}: skipped {file}, it could not be read as an archive ({message}).`

### WatchFolderOptions

Bound from the `WatchFolders` configuration section by `WatchFolderOptionsBinder`. It is a singleton, and every property is settable so tests can override it.

| Option | Default | Purpose |
|--------|---------|---------|
| `SettleTime` | 2 s | How long a file's size and readability must hold still before it counts as arrived |
| `PollInterval` | 500 ms | How often pending files are probed |
| `GroupingWindow` | 3 s | The quiet gap, with nothing new settling, that closes a set |
| `MaxSetHold` | 2 min | The longest a set waits on files still being written, counted from when it opened |
| `UnavailableRetryInterval` | 10 s | How often an unwatchable folder is retried, and a watched folder is checked for being gone |
| `EventBufferBytes` | 64 KB | `InternalBufferSize` of each `FileSystemWatcher` |

---

## Where Things Live

| Component | File Path |
|-----------|-----------|
| **Job & State** | `apps/api/src/TeensyRom.Api/Transfers/TransferJob.cs`<br/>`apps/api/src/TeensyRom.Core/Entities/Transfers/TransferJobState.cs`<br/>`apps/api/src/TeensyRom.Core/Entities/Transfers/TransferJobSnapshot.cs` |
| **Registry** | `apps/api/src/TeensyRom.Api/Transfers/TransferJobRegistry.cs` |
| **Capacity Gate** | `apps/api/src/TeensyRom.Api/Transfers/TransferCapacityGate.cs` |
| **Staging Store** | `apps/api/src/TeensyRom.Api/Transfers/TransferStagingStore.cs` |
| **Scratch Store** | `apps/api/src/TeensyRom.Api/Transfers/TransferScratchStore.cs` |
| **Archive Reader** | `apps/api/src/TeensyRom.Api/Transfers/Archives/SharpCompressArchiveReader.cs` |
| **Entry Path Resolver** | `apps/api/src/TeensyRom.Api/Transfers/Archives/ArchiveEntryPathResolver.cs` |
| **Expansion Service** | `apps/api/src/TeensyRom.Api/Transfers/Archives/ArchiveExpansionService.cs` |
| **Expansion Queue** | `apps/api/src/TeensyRom.Api/Transfers/Archives/ArchiveExpansionQueue.cs` |
| **Expansion Pump** | `apps/api/src/TeensyRom.Api/Transfers/Archives/ArchiveExpansionPump.cs` |
| **Queue** | `apps/api/src/TeensyRom.Api/Transfers/TransferQueue.cs` |
| **Pump** | `apps/api/src/TeensyRom.Api/Transfers/TransferPump.cs` |
| **Lease Coordinator** | `apps/api/src/TeensyRom.Api/Transfers/DeviceLeaseCoordinator.cs` |
| **Progress Notifier** | `apps/api/src/TeensyRom.Api/Transfers/TransferProgressNotifier.cs` |
| **Job Sweeper** | `apps/api/src/TeensyRom.Api/Transfers/TransferJobSweeper.cs` |
| **Endpoints** | `apps/api/src/TeensyRom.Api/Endpoints/Transfers/` |
| **SignalR Hub** | `apps/api/src/TeensyRom.Api/Endpoints/Transfers/Hub/TransferHub.cs` |
| **Serial Command** | `apps/api/src/TeensyRom.Core.Serial/Commands/TransferFiles/TransferFilesCommand.cs`<br/>`apps/api/src/TeensyRom.Core.Serial/Commands/TransferFiles/TransferFilesCommandHandler.cs` |
| **DTO** | `apps/api/src/TeensyRom.Api/Models/TransferJobDto.cs` |
| **Options** | `apps/api/src/TeensyRom.Api/Transfers/TransferOptions.cs` |
| **Job Service** (Start, AddFile, Seal) | `apps/api/src/TeensyRom.Api/Transfers/ITransferJobService.cs`<br/>`apps/api/src/TeensyRom.Api/Transfers/TransferJobService.cs` |
| **Auto-Launch** | `apps/api/src/TeensyRom.Api/Transfers/TransferAutoLauncher.cs`<br/>`apps/api/src/TeensyRom.Api/Transfers/LaunchCandidateRanker.cs`<br/>`apps/api/src/TeensyRom.Api/Transfers/TransferableFileTypes.cs` |
| **Origin and Launch State** | `apps/api/src/TeensyRom.Core/Entities/Transfers/TransferOrigin.cs`<br/>`apps/api/src/TeensyRom.Core/Entities/Transfers/TransferLaunchState.cs` |
| **List Endpoint** | `apps/api/src/TeensyRom.Api/Endpoints/Transfers/ListJobs/` |
| **Watched Folders** | `apps/api/src/TeensyRom.Api/WatchFolders/` (`WatchFolderWatcher.cs`, `ArrivalTracker.cs`, `WatchFolderDelivery.cs`, `WatchFolderStore.cs`, `WatchFolderPaths.cs`, `WatchFolderOptions.cs`, `WatchFolderOptionsBinder.cs`, `WatchedFileSystem.cs`, `FileSystemFolderWatchFactory.cs`) |
| **Watch Folder Endpoints** | `apps/api/src/TeensyRom.Api/Endpoints/WatchFolders/` |
| **Watch Folder Settings** | `apps/api/src/TeensyRom.Core/Settings/WatchFolder.cs` (in `TeensySettings.WatchFolders`) |

---

## Configuration & Tuning

All constants are centralized in `TransferOptions` (a singleton, settable for testing), bound at startup from the `Transfer` section of `appsettings.json` via `TransferOptionsBinder`, which clamps out-of-range values back to the compiled defaults:

| Setting | Default | Purpose |
|---------|---------|---------|
| `MaxStagedBytes` | 4 GB | Disk quota for staged files — the sole ceiling on staging disk usage; there is no separate file-count cap |
| `MaxScratchBytes` | 8 GB | Disk quota for archive expansion scratch storage; separate from staging to prevent expansion from blocking the pump's ability to drain staging |
| `MaxExpansionDepth` | 32 | Maximum nesting depth for archives within archives; prevents zip-bomb-style attacks and stack exhaustion |
| `MaxExpandedBytesPerArchive` | 2 GB | Maximum total size an archive is allowed to expand to; checked before expansion begins and rejected if exceeded |
| `BatchSize` | 25 | Number of staged files the pump batches into a single device write command |
| `RecentCompletionsBound` | 5 | Number of most-recent completed files (success or failure) a job retains for the live feed |
| `RetainedFailuresBound` | 50 | Number of most-recent failures a job retains; `FilesFailed` itself stays an unbounded lifetime counter |
| `RateWindow` | 10 seconds | Sliding window used to compute rolling transfer throughput |
| `IdleAbandonmentThreshold` | 2 minutes | Idle time before job is abandoned |
| `SweepInterval` | 30 seconds | How often sweeper checks for abandoned/evictable jobs |
| `SnapshotThrottle` | 250 ms | Min interval between progress broadcasts |
| `TerminalJobRetention` | 5 minutes | How long a completed job stays queryable |
| `DeviceChunkSize` | 16 KB | Chunk size for device write loop |
| `StagingRoot` | `~/.teensyrom/api/staging` (`TeensyRomHome.ApiPath`) | Directory for staged uploads |
| `ScratchRoot` | `~/.teensyrom/api/scratch` (`TeensyRomHome.ApiPath`) | Directory for archive expansion temporary storage |

---

**Maintainer**: Backend Engineering Team
