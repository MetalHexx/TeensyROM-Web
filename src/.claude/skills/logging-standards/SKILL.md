---
name: logging-standards
description: 'Emoji-enhanced logging helpers for TeensyROM (logInfo/logError/logWarn with LogType from @teensyrom-nx/utils). Use when adding logging to a service or store, following the Start/NetworkRequest/Success/Finish operation lifecycle, or logging errors/warnings/cache-hit info consistently across domains.'
---

# Logging Standards Skill

Use emoji-enhanced logging from `@teensyrom-nx/utils` for consistent operational visibility across all domains.

## When to Use This Skill

- Adding logging to a service, store, or operation
- Deciding which `LogType` to use for a given log statement
- Logging errors or warnings consistently

## Quick Reference

```typescript
import { LogType, logInfo, logError, logWarn } from '@teensyrom-nx/utils';

// Operation lifecycle
logInfo(LogType.Start, `Starting operation for ${key}`);
logInfo(LogType.NetworkRequest, `Making API call for ${key}`);
logInfo(LogType.Success, `API call successful for ${key}:`, data);
logInfo(LogType.Finish, `Operation completed for ${key}`);

// Cache hits and info
logInfo(LogType.Info, `${key} already loaded, skipping operation`);

// Errors and warnings
logError(`Operation failed for ${key}:`, error);
logWarn(`Cannot process - missing data for ${key}`);
```

## Usage Guidelines

### Operation Lifecycle Pattern

1. **Start** → **NetworkRequest** → **Success** → **Finish**
2. Use **Info** for cache hits and skipped operations
3. Use **Error**/**Warning** for failure cases
4. Include relevant context (keys, IDs, paths) in all messages

### Integration

Should be use everywhere.

Full reference (identical content, kept for consistency with other skills): [references/LOGGING_STANDARDS.md](references/LOGGING_STANDARDS.md)
