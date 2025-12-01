# Phase 3a: Semantic Versioning

## 🎯 Objective

Add semantic versioning support to the application, displaying the version number in both the Scalar API documentation and the Angular UI header.

**Value Delivered**: Users and developers can easily identify which version of TeensyROM they're running, essential for support and release tracking.

**Prerequisite**: Phase 03 (Publishing Configuration) must be complete.

---

## 📚 Required Reading

- [ ] [BACKEND_ARCHITECTURE.md](../../../BACKEND_ARCHITECTURE.md) - RadEndpoints patterns
- [ ] [OVERVIEW_CONTEXT.md](../../../OVERVIEW_CONTEXT.md) - Clean Architecture layers
- [ ] [SERVICE_STANDARDS.md](../../../SERVICE_STANDARDS.md) - Service implementation patterns
- [ ] Existing endpoint example: `Endpoints/Settings/GetSettings/GetSettingsEndpoint.cs`

---

## 📂 File Structure Overview

### Backend (Task 3a-001)
```
apps/api/src/TeensyRom.Api/
├── TeensyRom.Api.csproj                               📝 Modified - Add Version property
├── Startup/ApiDocStartupExtensions.cs                 📝 Modified - Version in Scalar title
└── Endpoints/Version/GetVersion/
    ├── GetVersionEndpoint.cs                          ✨ New - RadEndpointWithoutRequest
    └── GetVersionModels.cs                            ✨ New - Response record
```

### Frontend (Task 3a-002)
```
libs/
├── domain/src/lib/
│   ├── contracts/version.contract.ts                  ✨ New - IVersionService + token
│   ├── models/version.model.ts                        ✨ New - AppVersion interface
│   └── index.ts                                       📝 Modified - Export new contracts
├── infrastructure/src/lib/version/
│   ├── version.service.ts                             ✨ New - Implementation
│   └── providers.ts                                   ✨ New - DI provider
└── app/shell/src/lib/components/header/
    ├── header.component.ts                            📝 Modified - Inject service
    └── header.component.html                          📝 Modified - Display version
```

---

## 📋 Implementation Tasks

### Task 1: Backend Version Endpoint

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-3A-001-VERSION-ENDPOINT`

**Scope**: Small (4-5 files)

**Work**:
1. Add `<Version>1.0.0-alpha.1</Version>` to `TeensyRom.Api.csproj`
2. Create `GetVersionEndpoint` using `RadEndpointWithoutRequest<TResponse>` pattern (no mapper needed)
3. Create simple response model with `Version` property
4. Read version from `AssemblyInformationalVersionAttribute` at runtime
5. Update Scalar configuration to include version in API docs title
6. Regenerate TypeScript API client

**Endpoint**: `GET /api/version` returns `{ "version": "1.0.0-alpha.1" }`

---

### Task 2: Frontend Version Integration

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-3A-002-VERSION-UI`

**Scope**: Small (5-6 files)

**Work**:
1. Create domain contract `IVersionService` with `getVersion()` method
2. Create `AppVersion` model interface
3. Create infrastructure `VersionService` calling the API client
4. Inject service into `HeaderComponent` via token and display version
5. Position version text left of the dark/light mode toggle icon

**Clean Architecture Flow**:
```
HeaderComponent → IVersionService (token) → VersionService → API
```

---

## 🗂️ Files Modified or Created

**Backend**:
| File | Change |
|------|--------|
| `TeensyRom.Api.csproj` | Add `<Version>1.0.0-alpha.1</Version>` |
| `Startup/ApiDocStartupExtensions.cs` | Include version in Scalar title |
| `Endpoints/Version/GetVersion/GetVersionEndpoint.cs` | NEW |
| `Endpoints/Version/GetVersion/GetVersionModels.cs` | NEW |

**Frontend**:
| File | Change |
|------|--------|
| `libs/domain/src/lib/contracts/version.contract.ts` | NEW |
| `libs/domain/src/lib/models/version.model.ts` | NEW |
| `libs/infrastructure/src/lib/version/version.service.ts` | NEW |
| `libs/infrastructure/src/lib/version/providers.ts` | NEW |
| `libs/app/shell/.../header/header.component.ts` | MODIFY |
| `libs/app/shell/.../header/header.component.html` | MODIFY |

---

## 📝 Testing Summary

**Backend Testing**:
- Build API and verify no errors
- Call `GET /api/version` and verify response contains version string
- Check Scalar docs (`/scalar/v1`) shows version in title

**Frontend Testing**:
- Start dev server with API running
- Verify version appears in header left of theme toggle
- Check browser console for any errors loading version

---

## ✅ Success Criteria

- [ ] `GET /api/version` returns `{ "version": "1.0.0-alpha.1" }`
- [ ] Scalar API docs title includes version number
- [ ] Version displays in Angular UI header
- [ ] Version positioned left of dark/light mode toggle
- [ ] Clean Architecture followed (domain contract → infrastructure impl → application store)
- [ ] No hardcoded version strings in frontend

---

## 📝 Notes & Considerations

### Version Format

Using semantic versioning with prerelease tag: `1.0.0-alpha.1`

- Major.Minor.Patch-prerelease
- GitHub Actions (Phase 04) will increment the prerelease number automatically
- Production releases will drop the prerelease suffix

### Assembly Version vs Informational Version

- `AssemblyVersion` - Used for .NET assembly binding (keep simple: `1.0.0.0`)
- `InformationalVersion` - Human-readable version with prerelease info
- Use `AssemblyInformationalVersionAttribute` to read the full version string

### Version Caching

The frontend should fetch version once on app startup and cache it in the store. No need for periodic refresh since version only changes on app restart.

### Display Format

Display as `v1.0.0-alpha.1` in the header (with 'v' prefix for clarity).
