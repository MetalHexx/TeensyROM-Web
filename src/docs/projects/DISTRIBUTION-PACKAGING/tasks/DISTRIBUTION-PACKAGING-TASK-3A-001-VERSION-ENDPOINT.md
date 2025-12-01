# Task Handoff: Backend Version Endpoint

## 🎯 Task Identity

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-3A-001-VERSION-ENDPOINT`  
**Task Name**: Add Version to .csproj, Create /api/version Endpoint, Update Scalar Docs  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (5-6 files)

---

## 📋 Objective

**What**: Add semantic versioning support to the backend API, exposing the version via a new endpoint and displaying it in the Scalar API documentation.

**Why**: Users and developers need to identify which version of TeensyROM they're running for support, debugging, and release tracking.

**Success Criteria**:
- [ ] `TeensyRom.Api.csproj` contains `<Version>1.0.0-alpha.1</Version>`
- [ ] `GET /api/version` endpoint exists and returns version string
- [ ] Scalar API docs (`/scalar/v1`) title includes version number
- [ ] Integration test created and passing
- [ ] TypeScript API client regenerated with new endpoint
- [ ] Endpoint follows RadEndpoints patterns (like GetSettings)

---

## 📦 Context & Dependencies

**Prerequisites Completed**:
- ✅ Phase 03: Publishing configuration complete
- ✅ RadEndpoints configured and working

**Dependencies**:
- `System.Reflection` for reading assembly attributes
- No new NuGet packages required

**Constraints**:
- Follow existing RadEndpoints patterns (see `GetSettingsEndpoint.cs`)
- Use `RadEndpointWithoutRequest<TResponse>` - no mapper needed for simple response
- Version must be read from assembly metadata, not hardcoded

---

## 📂 File Scope

**Files to Create**:
- `apps/api/src/TeensyRom.Api/Endpoints/Version/GetVersion/GetVersionEndpoint.cs`
- `apps/api/src/TeensyRom.Api/Endpoints/Version/GetVersion/GetVersionModels.cs`
- `apps/api/src/TeensyRom.Api.Tests.Integration/GetVersionTests.cs`

**Files to Modify**:
- `apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj` - Add Version property
- `apps/api/src/TeensyRom.Api/Startup/ApiDocStartupExtensions.cs` - Version in Scalar title

**Files to Regenerate**:
- TypeScript API client via `pnpm run generate:api-client`

---

## 🔧 Implementation Guidance

**Reference Pattern**: Use `GetSettingsEndpoint.cs` as the template. This is a simple endpoint with no request, just a response.

**Version Property in .csproj**:
Add to the main `<PropertyGroup>`:
- `<Version>1.0.0-alpha.1</Version>`

This sets `AssemblyInformationalVersionAttribute` automatically.

**Endpoint Structure**:
- Route: `GET /api/version`
- Tag: `Version`
- Response: Simple record with `Version` property (string)
- Read version using `Assembly.GetExecutingAssembly().GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion`

**Scalar Configuration**:
Update `MapScalarApiReference` to include version in the title, e.g., `TeensyROM API v1.0.0-alpha.1`. Read version dynamically from assembly.

**API Client Regeneration**:
After creating the endpoint, build the API and regenerate the client:
1. `dotnet build` (generates OpenAPI spec)
2. `pnpm run generate:api-client` (generates TypeScript client)

---

## 🧪 Testing Requirements

**Integration Test**:

Create `GetVersionTests.cs` in `TeensyRom.Api.Tests.Integration` following existing patterns (see `GetSettingsTests.cs`):
- Use `EndpointFixture` and `[Collection("Endpoint")]` attribute
- Test that endpoint returns 200 OK with version string
- Verify version string matches expected semantic version format
- Verify version is not null or empty

**Manual Testing**:

1. Build and run API
2. Call endpoint: `GET http://localhost:5168/api/version`
3. Verify response: `{ "version": "1.0.0-alpha.1" }`
4. Open Scalar docs: `http://localhost:5168/scalar/v1`
5. Verify title includes version number
6. Verify API client regenerated with `VersionApiService`
7. Run integration tests: `dotnet test` in Tests.Integration project

---

## 📚 Reference Materials

**Related Documentation**:
- [Phase 3a Plan](../phases/DISTRIBUTION-PACKAGING-PHASE-3A-SEMANTIC-VERSIONING.md)
- [Master Plan](../DISTRIBUTION-PACKAGING-MASTER-PLAN.md)
- [BACKEND_ARCHITECTURE.md](../../../BACKEND_ARCHITECTURE.md)

**Example Files**:
- `Endpoints/Settings/GetSettings/GetSettingsEndpoint.cs` - Pattern to follow
- `Endpoints/Settings/GetSettings/GetSettingsModels.cs` - Response model pattern
- `TeensyRom.Api.Tests.Integration/GetSettingsTests.cs` - Integration test pattern

**Related Tasks**:
- DISTRIBUTION-PACKAGING-TASK-3A-002: VERSION-UI (next task) - Will consume this endpoint

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-3A-001-REPORT.md`

**Report Template**: Follow [SUBAGENT_REPORT.md](../../../subagent-planning/SUBAGENT_REPORT.md)

**Return Value**: Return the file path of the saved report when complete.

---

## ⚠️ Critical Reminders

1. **Read version from assembly** - Don't hardcode the version string in the endpoint
2. **Regenerate API client** - Task not complete until TypeScript client is updated
3. **Follow RadEndpoints pattern** - Use `RadEndpointWithoutRequest<TResponse>`, no mapper
4. **Test Scalar docs** - Verify version appears in API documentation title
