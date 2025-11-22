# Player Timer System

## Overview

The Player Timer System provides precise timing functionality for media playback in TeensyROM, supporting automatic progression between files, UI progress indicators, and pause/resume capabilities. The system uses a **multi-layered architecture** with RxJS observables converted to Angular signals for reactive state management.

### Key Characteristics

- **Multi-Device Support**: Independent timer instances per device
- **Observable-to-Signal Pattern**: RxJS streams converted to Angular signals using `toSignal()`
- **100ms Tick Precision**: Consistent update intervals for smooth UI progression
- **Automatic File Progression**: Timer completion triggers next file launch
- **Zero Store Pollution**: Timer state flows directly to components without NgRx store
- **Eager Signal Initialization**: Pre-cached signals prevent reactive context errors

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                        │
│  (player-toolbar.component.ts - consumes timer signals)     │
└────────────────────────┬────────────────────────────────────┘
                         │ Signal<TimerState | null>
┌────────────────────────▼────────────────────────────────────┐
│              Application Orchestration                      │
│  PlayerContextService - Coordinates timer lifecycle         │
│  - Observable → Signal conversion (toSignal)                │
│  - Signal caching per device (Map<string, Signal>)          │
│  - Timer setup/cleanup on file launches                     │
│  - Auto-progression on completion                           │
└────────────────────────┬────────────────────────────────────┘
                         │ Observable<TimerState>
┌────────────────────────▼────────────────────────────────────┐
│             Multi-Device Coordination                       │
│  PlayerTimerManager - Manages multiple timer instances      │
│  - Device-scoped timer instances (Map<string, TimerService>)│
│  - Observable streams per device (Subject<TimerState>)      │
│  - Lifecycle coordination (create/destroy/pause/resume)     │
└────────────────────────┬────────────────────────────────────┘
                         │ RxJS interval()
┌────────────────────────▼────────────────────────────────────┐
│                Core Timer Implementation                    │
│  TimerService - Individual RxJS-based timer instance        │
│  - 100ms tick interval (BehaviorSubject<number>)            │
│  - Pause/resume state management                            │
│  - Completion detection (currentTime >= totalTime)          │
└─────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
libs/application/src/lib/player/
├── player-context.service.ts           # Orchestration layer
│   └── Coordinates timer lifecycle with file launches
│       - setupTimerForFile()           # Determine duration & create timer
│       - createTimerWithCompletion()   # Create + pre-initialize signal
│       - cleanupTimer()                # Destroy timer + cleanup subscriptions
│       - getTimerState()               # Return cached Signal<TimerState | null>
│
├── player-timer-manager.ts             # Multi-device coordination
│   └── Manages multiple TimerService instances
│       - createTimer()                 # Create & start timer for device
│       - destroyTimer()                # Stop & cleanup timer
│       - pauseTimer() / resumeTimer()  # Playback control
│       - onTimerUpdate$()              # Observable stream of updates
│       - onTimerComplete$()            # Observable stream of completions
│
├── timer.service.ts                    # Core RxJS implementation
│   └── Individual timer instance (100ms precision)
│       - start()                       # Begin counting from 0
│       - pause() / resume()            # Pause/resume state
│       - stop()                        # Reset to 0
│       - currentTime$                  # BehaviorSubject<number> stream
│       - completion$                   # Subject<void> stream
│
├── timer-state.interface.ts            # Timer state contract
│   └── TimerState interface
│       - totalTime / currentTime       # Duration tracking
│       - isRunning / isPaused          # Playback state
│       - speed / showProgress          # UI control (speed reserved)
│
├── timer-utils.ts                      # Metadata parsing
│   └── parsePlayLength()               # "MM:SS" or "H:MM:SS" → milliseconds
│
├── player.constants.ts                 # Shared constants
│   └── DEFAULT_TIMER_MS = 180000       # 3-minute fallback
│
└── player-context.interface.ts         # Public contract
    └── IPlayerContext.getTimerState()  # Signal<TimerState | null>
```

---

## Core Components

### 1. [TimerService](./timer.service.ts)

**Purpose**: Single-device RxJS timer with 100ms tick precision

**Key Features**:
- `BehaviorSubject<number>` emits currentTime every 100ms
- `Subject<void>` emits on completion
- Pause/resume preserves currentTime
- Stop resets to 0

**Lifecycle Example**:
```typescript
const timer = new TimerService();
timer.start(180000); // 3 minutes

timer.currentTime$.subscribe(time => {
  console.log(`Current: ${time}ms`);
});

timer.completion$.subscribe(() => {
  console.log('Timer completed!');
});

timer.pause();   // Maintains currentTime
timer.resume();  // Continues from paused position
timer.stop();    // Resets to 0
```

---

### 2. [PlayerTimerManager](./player-timer-manager.ts)

**Purpose**: Multi-device timer coordination with observable streams per device

**Key Responsibilities**:
- Maintains `Map<string, TimerService>` for device-scoped instances
- Provides `onTimerUpdate$(deviceId)` and `onTimerComplete$(deviceId)` observables
- Coordinates lifecycle: `createTimer()`, `destroyTimer()`, `pauseTimer()`, `resumeTimer()`
- Bridges TimerService observables to PlayerContextService

**Observable Streams**:
```typescript
// Timer updates (100ms intervals)
onTimerUpdate$(deviceId: string): Observable<TimerState>

// Completion events
onTimerComplete$(deviceId: string): Observable<void>
```

**Subject Reuse Pattern**:
- Subjects created once per device and reused across timer recreations
- Timer destruction does NOT complete subjects (prevents stream breaks)
- Allows seamless timer replacement during playback

---

### 3. [PlayerContextService](./player-context.service.ts)

**Purpose**: Application orchestration - coordinates timer lifecycle with file launches

**Critical Pattern: Eager Signal Initialization**

The service pre-initializes timer signals **immediately after timer creation** to prevent reactive context errors:

```typescript
private createTimerWithCompletion(deviceId: string, durationMs: number): void {
  this.cleanupTimer(deviceId);
  this.timerManager.createTimer(deviceId, durationMs);
  
  // ⚠️ CRITICAL: Pre-initialize signal before component access
  this.timerSignals.delete(deviceId); // Clear old cache
  
  const currentState = this.timerManager.getTimerState(deviceId);
  const signal = toSignal(
    this.timerManager.onTimerUpdate$(deviceId),
    { initialValue: currentState, injector: this.injector }
  );
  
  this.timerSignals.set(deviceId, signal); // Cache immediately
  
  // Subscribe to completion for auto-progression
  const completeSub = this.timerManager.onTimerComplete$(deviceId)
    .subscribe(() => this.next(deviceId));
  this.completionSubscriptions.set(deviceId, completeSub);
}
```

**Why Eager Initialization?**

Angular's `toSignal()` cannot be called from reactive contexts (computed, effect). By pre-initializing signals when the timer is created, components can safely access cached signals from computed contexts without triggering `NG0602` errors.

**Timer Duration Logic** ([setupTimerForFile](./player-context.service.ts#L444)):

```typescript
┌─────────────────────┬──────────────────────┬─────────────────┐
│ File Type           │ Timer Source         │ Behavior        │
├─────────────────────┼──────────────────────┼─────────────────┤
│ Hex Files           │ None                 │ No timer        │
│ Song Files          │ Metadata duration    │ Always timer    │
│ Other Files         │ Custom timer config  │ If enabled      │
│ (Games/Images)      │                      │                 │
└─────────────────────┴──────────────────────┴─────────────────┘
```

**Signal Caching**:
```typescript
private readonly timerSignals = new Map<string, Signal<TimerState | null>>();

getTimerState(deviceId: string): Signal<TimerState | null> {
  const cached = this.timerSignals.get(deviceId);
  if (cached) return cached; // Referential equality preserved
  
  // Should rarely reach here due to eager initialization
  const signal = toSignal(
    this.timerManager.onTimerUpdate$(deviceId),
    { initialValue: this.timerManager.getTimerState(deviceId) }
  );
  this.timerSignals.set(deviceId, signal);
  return signal;
}
```

---

## Data Flow Sequence

### File Launch with Timer Creation

```
1. User launches file
   └─> launchFileWithContext() called

2. PlayerContextService.setupTimerForFile()
   ├─> Determine duration (metadata vs. custom timer)
   ├─> Call createTimerWithCompletion()
   │   ├─> PlayerTimerManager.createTimer()
   │   │   ├─> Create new TimerService
   │   │   ├─> Start interval (100ms ticks)
   │   │   └─> Subscribe to currentTime$ and completion$
   │   │
   │   ├─> [EAGER] Convert observable to signal with toSignal()
   │   ├─> [EAGER] Cache signal in timerSignals Map
   │   └─> Subscribe to completion for auto-progression
   │
   └─> Timer active

3. Component accesses timer
   └─> playerContext.getTimerState(deviceId)
       └─> Returns pre-cached Signal<TimerState | null>

4. UI updates reactively
   └─> Signal changes trigger Angular change detection
       └─> Progress bar updates every 100ms

5. Timer completes
   └─> PlayerContextService.next(deviceId) called
       └─> Launch next file, repeat from step 2
```

### Playback Control Flow

```
Play/Pause/Stop
   └─> PlayerContextService.play/pause/stop()
       └─> PlayerTimerManager.resumeTimer/pauseTimer/stopTimer()
           └─> TimerService.resume/pause/stop()
               └─> Update isRunning/isPaused flags
                   └─> Emit new TimerState via currentTime$
                       └─> Signal updates via toSignal()
                           └─> Component UI updates
```

---

## Timer Duration Determination

### Metadata Parsing

Song files use [`parsePlayLength()`](./timer-utils.ts#L19) to convert metadata:

```typescript
// Supported formats:
"3:45"      → 225000ms  (MM:SS)
"1:02:30"   → 3750000ms (H:MM:SS)
"invalid"   → 0ms       (triggers DEFAULT_TIMER_MS fallback)
```

**Fallback Strategy**:
```typescript
let totalTime = parsePlayLength(file.playLength ?? '');

if (totalTime === 0) {
  totalTime = DEFAULT_TIMER_MS; // 180000ms (3 minutes)
  logWarn(`Using default 3-minute timer for ${file.name}`);
}
```

### Custom Timer Configuration

Non-song files (games, images) use custom timer when enabled:

```typescript
interface PlayTimerConfig {
  enabled: boolean;
  durationMs: number;  // User-configurable duration
}

// Accessed via PlayerContextService
getPlayTimerConfig(deviceId: string): Signal<PlayTimerConfig | null>
setCustomTimer(deviceId: string, enabled: boolean, durationMs: number): void
```

**Custom Timer Behavior**:
- **Enabled**: Timer created for non-song files using `durationMs`
- **Disabled**: No timer for non-song files
- **Songs**: Always use metadata (custom timer ignored)

---

## Signal Conversion Pattern

### Observable-to-Signal Architecture

**Why Not Store?**

Timer state was previously stored in NgRx state, causing unnecessary store pollution for ephemeral UI state. The refactored approach uses **direct observable-to-signal conversion**:

```typescript
// ❌ OLD: Store pollution
this.store.updateTimerState({ deviceId, timerState });

// ✅ NEW: Direct signal conversion
const signal = toSignal(
  this.timerManager.onTimerUpdate$(deviceId),
  { 
    initialValue: this.timerManager.getTimerState(deviceId),
    injector: this.injector 
  }
);
```

### Reactive Context Safety

**Critical Constraint**: `toSignal()` cannot be called from reactive contexts (computed, effect)

**Problem Scenario**:
```typescript
// ❌ WRONG: Lazy initialization from computed
timerState = computed(() => {
  const deviceId = this.deviceId();
  return this.playerContext.getTimerState(deviceId)(); // NG0602 error!
});
```

**Solution**: Pre-initialize signals in service methods (non-reactive contexts):
```typescript
// ✅ CORRECT: Eager initialization in service
private createTimerWithCompletion(deviceId: string, durationMs: number): void {
  // Called from launchFileWithContext() - non-reactive context
  const signal = toSignal(...); // Safe!
  this.timerSignals.set(deviceId, signal);
}
```

---

## Integration Points

### Component Consumption

Components access timer state through the [IPlayerContext](./player-context.interface.ts#L15) contract:

```typescript
export class PlayerToolbarComponent {
  private playerContext = inject(PLAYER_CONTEXT);
  
  deviceId = input.required<string>();
  
  // Safe: getTimerState() returns pre-cached signal
  timerState = computed(() => 
    this.playerContext.getTimerState(this.deviceId())()
  );
  
  showProgressBar = computed(() => {
    const state = this.timerState();
    return state !== null && state.showProgress;
  });
}
```

### Auto-Progression

Timer completion triggers automatic file progression:

```typescript
// In createTimerWithCompletion()
const completeSub = this.timerManager.onTimerComplete$(deviceId)
  .subscribe(() => {
    logInfo(LogType.Success, 'Timer completed, auto-progressing');
    void this.next(deviceId); // Launch next file
  });
```

### Playback Synchronization

Playback controls coordinate with timer state:

```typescript
async play(deviceId: string): Promise<void> {
  await this.store.play({ deviceId });
  
  if (this.isCurrentFileMusicType(deviceId)) {
    this.timerManager.resumeTimer(deviceId); // Sync timer
  }
}

async pause(deviceId: string): Promise<void> {
  await this.store.pauseMusic({ deviceId });
  
  if (this.isCurrentFileMusicType(deviceId)) {
    this.timerManager.pauseTimer(deviceId); // Sync timer
  }
}
```

---

## State Management

### Timer State Interface

```typescript
interface TimerState {
  totalTime: number;      // Duration in ms
  currentTime: number;    // Current position in ms
  isRunning: boolean;     // Timer actively counting
  isPaused: boolean;      // Timer paused (preserves currentTime)
  speed: number;          // Speed multiplier (1.0 = normal, reserved)
  showProgress: boolean;  // Display progress bar (always true)
}
```

### Cache Lifecycle

```typescript
Signal Cache:
  Create    → createTimerWithCompletion() pre-initializes
  Access    → getTimerState() returns cached signal
  Invalidate → cleanupTimer() deletes cached signal
  Recreate  → Next file launch repeats cycle

Subject Reuse:
  Create    → First timer creation per device
  Reuse     → Subsequent timer recreations
  Persist   → Subjects NOT destroyed on timer cleanup
  Cleanup   → Only on device removal (removePlayer)
```

---

## Testing Considerations

### Unit Testing Pattern

Mock timer observables at the service boundary:

```typescript
const mockTimerManager = {
  createTimer: vi.fn(),
  onTimerUpdate$: vi.fn(() => of({ totalTime: 180000, currentTime: 0 })),
  onTimerComplete$: vi.fn(() => EMPTY),
  getTimerState: vi.fn(() => ({ totalTime: 180000, currentTime: 0 })),
};

TestBed.configureTestingModule({
  providers: [
    PlayerContextService,
    { provide: PlayerTimerManager, useValue: mockTimerManager },
  ],
});
```

### Behavioral Testing

Test timer integration through PlayerContextService actions:

```typescript
it('should create timer on music file launch', async () => {
  await playerContext.launchFileWithContext({
    deviceId: 'device-1',
    file: mockSongFile,
    // ...
  });
  
  expect(mockTimerManager.createTimer).toHaveBeenCalledWith(
    'device-1',
    225000 // Parsed from metadata
  );
});
```

---

## Future Extensions

### Planned Features

1. **Variable Speed Control**: `speed` property currently reserved (always 1.0)
2. **Custom Song Timer Override**: Allow custom duration for music files
3. **Timer Seek/Nudge**: Manual time position adjustment
4. **Multi-Device Sync**: Synchronize timers across devices
5. **Timer Analytics**: Track playback duration metrics

### Architectural Constraints

- **No Store Pollution**: Timer state must never return to NgRx store
- **Signal-Based**: All timer state exposed as signals, not raw observables
- **Device-Scoped**: All timer operations keyed by deviceId
- **Eager Initialization**: Signal creation must remain outside reactive contexts

---

## Related Documentation

- [Player Context Overview](./PLAYER_CONTEXT.md) *(planned)*
- [Player Store Architecture](./PLAYER_STORE.md) *(planned)*
- [Timer Refactoring Plan](../../docs/features/timer/TIMER_REFACTORING.md)
- [Testing Standards](../../docs/TESTING_STANDARDS.md)
- [State Standards](../../docs/STATE_STANDARDS.md)

---

## Quick Reference

| Task | Service Method | Manager Method | Timer Method |
|------|----------------|----------------|--------------|
| Create timer | `setupTimerForFile()` | `createTimer()` | `start()` |
| Pause timer | `pause()` | `pauseTimer()` | `pause()` |
| Resume timer | `play()` | `resumeTimer()` | `resume()` |
| Stop timer | `stop()` | `stopTimer()` | `stop()` |
| Get state | `getTimerState()` | `getTimerState()` | getters |
| Cleanup | `cleanupTimer()` | `destroyTimer()` | `ngOnDestroy()` |

---

*Last Updated: November 22, 2025*  
*Architecture Version: Post-Timer Refactoring (NG0602 Fix)*
