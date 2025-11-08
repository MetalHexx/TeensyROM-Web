# Phase 1: Fix Integration Test Response Type Mismatches

## 🎯 Objective

Fix all integration tests that incorrectly expect `ProblemDetails` responses from endpoints using Minimal API typed response methods (`SendNotFound`, `SendConflict`). These methods return plain strings, not ProblemDetails objects, causing JSON deserialization failures in tests.

**Impact:** Resolves JSON deserialization errors across 10+ endpoint test files, ensuring tests correctly validate actual API behavior.

---

## 📚 Required Reading

> Review these documents before starting implementation.

**Feature Documentation:**

- [x] [Fix Integration Tests Context](./FIX_INTEGRATION_TESTS.md) - Root cause and fix approach

**Standards & Guidelines:**

- [ ] [Testing Standards](../../TESTING_STANDARDS.md) - Testing approaches and best practices (if exists)

---

## 📂 Affected Files Overview

Based on endpoint scan, the following files are affected:

### Endpoints Using `SendNotFound(string)` (26 occurrences across 13 endpoint files):

**Files:**
- `FavoriteFileEndpoint.cs` (4 SendNotFound calls)
- `RemoveFavoriteEndpoint.cs` (4 SendNotFound calls)
- `GetDirectoryEndpoint.cs` (3 SendNotFound calls)
- `IndexEndpoint.cs` (2 SendNotFound calls)
- `SearchEndpoint.cs` (2 SendNotFound calls)
- `LaunchFileEndpoint.cs` (3 SendNotFound calls)
- `LaunchRandomEndpoint.cs` (4 SendNotFound calls)
- `ToggleMusicEndpoint.cs` (1 SendNotFound call)
- `ConnectDeviceEndpoint.cs` (1 SendNotFound call)
- `DisconnectDeviceEndpoint.cs` (1 SendNotFound call)
- `FindDevicesEndpoint.cs` (1 SendNotFound call)
- `PingDeviceEndpoint.cs` (1 SendNotFound call)
- `ResetDeviceEndpoint.cs` (1 SendNotFound call)

### Integration Test Files with ProblemDetails Expectations:

```
TeensyRom.Api.Tests.Integration/
├── ConnectDeviceTests.cs          📝 Fix - expects ProblemDetails for SendNotFound
├── DisconnectDeviceTests.cs       📝 Fix - expects ProblemDetails for SendNotFound
├── FindDevicesTests.cs            📝 Fix - expects ProblemDetails for SendNotFound
├── GetDirectoryTests.cs           📝 Fix - expects ProblemDetails for SendNotFound
├── IndexTests.cs                  📝 Fix - expects ProblemDetails for SendNotFound
├── IndexAllTests.cs               📝 Fix - expects ProblemDetails for SendNotFound
├── LaunchFileTests.cs             📝 Fix - expects ProblemDetails for SendNotFound
├── LaunchRandomTests.cs           📝 Fix - expects ProblemDetails for SendNotFound
├── RemoveFavoriteTests.cs         📝 Fix - expects ProblemDetails for SendNotFound
├── ResetDeviceTests.cs            📝 Fix - expects ProblemDetails for SendNotFound
├── SaveFavoriteTests.cs           📝 Fix - expects ProblemDetails for SendNotFound
├── SearchTests.cs                 📝 Fix - expects ProblemDetails for SendNotFound
└── ToggleMusicTests.cs            📝 Fix - expects ProblemDetails for SendNotFound
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Fix GetDirectoryTests.cs</h3></summary>

**Purpose**: Fix 3 test methods that expect `ProblemDetails` from `SendNotFound` calls in `GetDirectoryEndpoint`

**Endpoint Context:**
- Line 31: `SendNotFound($"The device {r.DeviceId} was not found.")`
- Line 37: `SendNotFound($"The storage {r.StorageType} is not available.")`
- Line 43: `SendNotFound($"The directory {r.Path} was not found.")`

**Implementation Subtasks:**

- [ ] **Fix `When_StorageNotAvailable_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_DirectoryNotFound_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_Directory_IsAFilePath_BadRequestReturned`**: Change response type from `ProblemDetails` to `string`
- [ ] **Update assertions**: Replace `.BeProblem()` fluent assertions with direct `r.Http.StatusCode` and `r.Content` checks

**Expected Pattern:**
```csharp
// FROM:
var r = await f.Client.GetAsync<GetDirectoryEndpoint, GetDirectoryRequest, ProblemDetails>(...)
r.Should().BeProblem().WithStatusCode(HttpStatusCode.NotFound).WithMessage("...");

// TO:
var r = await f.Client.GetAsync<GetDirectoryEndpoint, GetDirectoryRequest, string>(...)
r.Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
r.Content.Should().Be("...");
```

</details>

<details open>
<summary><h3>Task 2: Fix SaveFavoriteTests.cs (FavoriteFileEndpoint)</h3></summary>

**Purpose**: Fix 4 test methods that expect `ProblemDetails` from `SendNotFound` calls in `FavoriteFileEndpoint`

**Endpoint Context:**
- Line 31: Device not found
- Line 41: SD card not available
- Line 50: USB storage not available
- Line 60: File not found

**Implementation Subtasks:**

- [ ] **Fix `When_DeviceNotFound_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_SdCardNotAvailable_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_UsbStorageNotAvailable_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_FileNotFound_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Update assertions**: Replace `.BeProblem()` with direct assertions

</details>

<details open>
<summary><h3>Task 3: Fix RemoveFavoriteTests.cs</h3></summary>

**Purpose**: Fix 4 test methods that expect `ProblemDetails` from `SendNotFound` calls in `RemoveFavoriteEndpoint`

**Endpoint Context:**
- Line 30: Device not found
- Line 40: SD card not available
- Line 49: USB storage not available
- Line 59: File not found

**Implementation Subtasks:**

- [ ] **Fix `When_DeviceNotFound_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_SdCardNotAvailable_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_UsbStorageNotAvailable_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_FileNotFound_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Update assertions**: Replace `.BeProblem()` with direct assertions

</details>

<details open>
<summary><h3>Task 4: Fix LaunchFileTests.cs</h3></summary>

**Purpose**: Fix 3 test methods that expect `ProblemDetails` from `SendNotFound` calls in `LaunchFileEndpoint`

**Endpoint Context:**
- Line 42: Device not found
- Line 51: USB storage not available
- Line 61: File not found

**Implementation Subtasks:**

- [ ] **Fix `When_DeviceNotFound_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_UsbStorageNotAvailable_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_FileNotFound_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Update assertions**: Replace `.BeProblem()` with direct assertions

</details>

<details open>
<summary><h3>Task 5: Fix LaunchRandomTests.cs</h3></summary>

**Purpose**: Fix 4 test methods that expect `ProblemDetails` from `SendNotFound` calls in `LaunchRandomEndpoint`

**Endpoint Context:**
- Line 43: Device not found
- Line 53: SD card not available
- Line 63: USB storage not available
- Line 82: No files found

**Implementation Subtasks:**

- [ ] **Fix `When_DeviceNotFound_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_SdCardNotAvailable_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_UsbStorageNotAvailable_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `When_NoFilesFound_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Update assertions**: Replace `.BeProblem()` with direct assertions

</details>

<details open>
<summary><h3>Task 6: Fix IndexTests.cs and IndexAllTests.cs</h3></summary>

**Purpose**: Fix test methods that expect `ProblemDetails` from `SendNotFound` calls in `IndexEndpoint`

**Endpoint Context:**
- Line 33: Device not found
- Line 36: No devices found

**Implementation Subtasks:**

- [ ] **Fix `IndexTests.cs` affected tests**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `IndexAllTests.cs` affected tests**: Change response type from `ProblemDetails` to `string`
- [ ] **Update assertions**: Replace `.BeProblem()` with direct assertions

</details>

<details open>
<summary><h3>Task 7: Fix SearchTests.cs</h3></summary>

**Purpose**: Fix test methods that expect `ProblemDetails` from `SendNotFound` calls in `SearchEndpoint`

**Endpoint Context:**
- Line 31: Device not found
- Line 37: Storage not available

**Implementation Subtasks:**

- [ ] **Scan `SearchTests.cs`**: Identify all tests expecting `ProblemDetails` for NotFound responses
- [ ] **Fix identified tests**: Change response type from `ProblemDetails` to `string`
- [ ] **Update assertions**: Replace `.BeProblem()` with direct assertions

</details>

<details open>
<summary><h3>Task 8: Fix Serial Endpoint Tests</h3></summary>

**Purpose**: Fix test methods for serial-related endpoints using `SendNotFound`

**Endpoints Affected:**
- `ConnectDeviceEndpoint` (Line 35: Connection failed)
- `DisconnectDeviceEndpoint` (Line 28: Device not found)
- `FindDevicesEndpoint` (Line 33: No devices found)
- `PingDeviceEndpoint` (Line 29: Device not found)
- `ResetDeviceEndpoint` (Line 30: Device not found)

**Implementation Subtasks:**

- [ ] **Fix `ConnectDeviceTests.cs`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `DisconnectDeviceTests.cs`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `FindDevicesTests.cs`**: Change response type from `ProblemDetails` to `string`
- [ ] **Fix `ResetDeviceTests.cs`**: Change response type from `ProblemDetails` to `string`
- [ ] **Update assertions**: Replace `.BeProblem()` with direct assertions

</details>

<details open>
<summary><h3>Task 9: Fix ToggleMusicTests.cs</h3></summary>

**Purpose**: Fix test methods that expect `ProblemDetails` from `SendNotFound` in `ToggleMusicEndpoint`

**Endpoint Context:**
- Line 29: Device not found

**Implementation Subtasks:**

- [ ] **Fix `When_DeviceNotFound_ReturnsNotFound`**: Change response type from `ProblemDetails` to `string`
- [ ] **Update assertions**: Replace `.BeProblem()` with direct assertions

</details>

<details open>
<summary><h3>Task 10: Final Validation</h3></summary>

**Purpose**: Run comprehensive test suite to ensure all fixes are working correctly

**Implementation Subtasks:**

- [ ] **Review all modified files**: Ensure all changes follow the established pattern
- [ ] **Verify no deserialization errors**: Confirm no JSON conversion exceptions remain
- [ ] **Check test coverage**: Ensure all SendNotFound cases are properly tested

</details>

---

## 🧪 Testing Strategy

### Validation Criteria

**Each Fixed Test Must:**
1. Expect `string` response type instead of `ProblemDetails`
2. Assert on `r.Http.StatusCode` directly (e.g., `HttpStatusCode.NotFound`)
3. Assert on `r.Content` for the string message
4. Follow the established pattern shown in Task 1

---

## ✅ Success Criteria

### Completion Checklist

- [ ] All 13 integration test files reviewed and fixed
- [ ] Zero tests expecting `ProblemDetails` from `SendNotFound(string)` or `SendConflict(string)`
- [ ] All assertions updated to validate string responses and status codes
- [ ] Full integration test suite passes without deserialization errors
- [ ] Documentation updated with correct testing patterns

### Quantified Goals

- **Endpoints Scanned**: 13 endpoint files
- **SendNotFound Occurrences**: 26 calls across endpoints
- **Test Files Modified**: ~13 files
- **Tests Fixed**: Estimated 25-30 individual test methods
- **Zero Deserialization Errors**: No `System.Text.Json.JsonException` failures

---

## 📝 Implementation Notes

### Key Patterns

**Validation Tests (400 errors) - Keep as ValidationProblemDetails:**
These tests should NOT be changed as they test validation failures:
```csharp
// Keep this pattern - validation errors DO return ValidationProblemDetails
var r = await f.Client.GetAsync<SomeEndpoint, SomeRequest, ValidationProblemDetails>(...)
r.Should().BeValidationProblem().WithKeyAndValue("PropertyName", "Error message");
```

**NotFound Tests (404 errors) - Change to string:**
```csharp
// Change from ProblemDetails to string
var r = await f.Client.GetAsync<SomeEndpoint, SomeRequest, string>(...)
r.Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
r.Content.Should().Be("Expected message");
```

### Important Considerations

1. **DO NOT modify endpoint implementations** - they use correct Minimal API behavior
2. **Only fix integration tests** - the issue is with test expectations, not endpoint code
3. **Preserve validation tests** - `ValidationProblemDetails` tests are correct as-is
4. **Match exact messages** - ensure `r.Content.Should().Be()` matches the endpoint's SendNotFound message

---

## 🚀 Getting Started

1. Read [FIX_INTEGRATION_TESTS.md](./FIX_INTEGRATION_TESTS.md) for context
2. Start with Task 1 (GetDirectoryTests.cs) as a learning example
3. Follow the pattern established in Task 1 for remaining files
4. Test after each file to catch issues early
5. Run full suite after all fixes complete

---

## 📊 Progress Tracking

**Last Updated**: 2025-11-08

**Status**: Ready to begin

**Completed Tasks**: 0/10

**Next Action**: Begin Task 1 - Fix GetDirectoryTests.cs
