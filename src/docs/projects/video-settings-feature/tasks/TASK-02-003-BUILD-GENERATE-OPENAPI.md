# Task Handoff: TASK-02-003-BUILD-GENERATE-OPENAPI

## 📋 Task Identity

**Task ID**: TASK-02-003-BUILD-GENERATE-OPENAPI  
**Task Name**: Build Backend and Generate OpenAPI Specification  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `.github/chatmodes/Backend Wizard.chatmode.md`  
**Priority**: High (Enables Phase 3)  
**Estimated Context Size**: Small (build + verification)

---

## 🎯 Objective

**What**: Build the backend API project to generate the updated OpenAPI specification (openapi-spec.json) that includes VideoSettingsDto schema, preparing for frontend API client regeneration in Phase 3.

**Why**: The OpenAPI specification is automatically generated during build and serves as the contract between backend and frontend. Frontend TypeScript API clients are generated from this spec, so it must be up-to-date with VideoSettings before proceeding to Phase 3.

**Success Criteria**:

- [ ] Backend builds successfully with no errors or warnings
- [ ] openapi-spec.json file generated/updated in workspace root
- [ ] VideoSettingsDto schema present in OpenAPI spec (components/schemas)
- [ ] GetSettingsResponse schema references VideoSettings property
- [ ] SaveSettingsRequest schema references VideoSettings property
- [ ] EnableVideo property defined as boolean with required constraint
- [ ] openapi-spec.json committed to source control
- [ ] Ready to proceed to Phase 3 (API Client Regeneration)

---

## 📋 Context & Dependencies

**Prerequisites Completed**:

- ✅ Phase 1: VideoSettings domain model created and integrated
- ✅ TASK-02-001: VideoSettingsDto and VideoSettingsValidator created
- ✅ TASK-02-002: VideoSettings integrated into request/response models and mappers

**Dependencies**:

- `Scalar.AspNetCore` - OpenAPI spec generation during build
- `Swashbuckle.AspNetCore` - OpenAPI schema generation from C# types
- All Phase 2 backend code changes must be complete
- No compiler errors or warnings (build must succeed)

**Constraints**:

- OpenAPI generation is automatic during build - no manual editing
- Generated spec must be committed to source control for frontend tooling
- Spec location is fixed: workspace root `openapi-spec.json`
- Frontend Phase 3 depends on this spec being current

---

## 📂 File Scope

**Files Generated/Modified**:

- `openapi-spec.json` - Regenerated with VideoSettingsDto schema (workspace root)

**Files to Review** (for verification only):

- `openapi-spec.json` - Verify VideoSettingsDto schema is present and correct

**No Code Changes** - This task is purely build and verification

---

## 🛠️ Implementation Guidance

**Standards to Follow**:

- [API Client Generation](../../../API_CLIENT_GENERATION.md) - Complete OpenAPI generation workflow
- [Phase 2 Detailed Plan](../phases/phase-02-backend-api.md) - Task 7 details

**Key Requirements**:

### Step 1: Navigate to API Project Directory

```powershell
# From workspace root (c:\dev\src\TeensyROM-Web\src)
cd apps/api/src
```

### Step 2: Build the Backend Project

```powershell
dotnet build TeensyRom.Api.csproj
```

**Expected Output**:

- Build succeeds with exit code 0
- No compiler errors
- No compiler warnings
- Message: "Build succeeded."

### Step 3: Locate Generated OpenAPI Spec

**File Location**: `c:\dev\src\TeensyROM-Web\src\openapi-spec.json` (workspace root)

**How It Works**:

- OpenAPI spec generation happens automatically during build
- Scalar/Swashbuckle integration generates spec from C# types
- Spec is placed in workspace root via build configuration

### Step 4: Verify VideoSettingsDto Schema

**Open openapi-spec.json** and verify the following sections exist:

**1. VideoSettingsDto in components/schemas**:

```json
{
  "components": {
    "schemas": {
      "VideoSettingsDto": {
        "type": "object",
        "properties": {
          "enableVideo": {
            "type": "boolean"
          }
        },
        "required": ["enableVideo"]
      }
    }
  }
}
```

**2. GetSettingsResponse includes videoSettings**:

```json
{
  "GetSettingsResponse": {
    "properties": {
      "connectionSettings": { "$ref": "#/components/schemas/ConnectionSettingsDto" },
      "playerSettings": { "$ref": "#/components/schemas/PlayerSettingsDto" },
      "videoSettings": { "$ref": "#/components/schemas/VideoSettingsDto" },
      "fileTransferSettings": { "$ref": "#/components/schemas/FileTransferSettingsDto" }
    },
    "required": ["videoSettings"]
  }
}
```

**3. SaveSettingsRequest includes videoSettings**:

```json
{
  "SaveSettingsRequest": {
    "properties": {
      "connectionSettings": { "$ref": "#/components/schemas/ConnectionSettingsDto" },
      "playerSettings": { "$ref": "#/components/schemas/PlayerSettingsDto" },
      "videoSettings": { "$ref": "#/components/schemas/VideoSettingsDto" },
      "fileTransferSettings": { "$ref": "#/components/schemas/FileTransferSettingsDto" }
    },
    "required": ["videoSettings"]
  }
}
```

### Step 5: Commit OpenAPI Spec to Source Control

```powershell
# From workspace root
git add openapi-spec.json
git commit -m "chore: regenerate OpenAPI spec with VideoSettings"
```

**Why Commit?**:

- Frontend API client generation reads from committed spec
- Team members need consistent spec for development
- CI/CD pipeline may depend on committed spec

**Anti-Patterns to Avoid**:

- Don't manually edit openapi-spec.json (always regenerate via build)
- Don't skip verification - spec must be correct before Phase 3
- Don't forget to commit - uncommitted spec blocks frontend work
- Don't proceed if build fails - fix errors first

---

## 🧪 Testing Requirements

**Test Coverage Required**:

- [ ] Backend builds successfully with no errors
- [ ] Backend builds with no warnings
- [ ] openapi-spec.json file exists in workspace root
- [ ] VideoSettingsDto schema present in spec
- [ ] EnableVideo property defined as boolean
- [ ] EnableVideo marked as required in schema
- [ ] GetSettingsResponse references VideoSettingsDto
- [ ] SaveSettingsRequest references VideoSettingsDto
- [ ] Property naming is camelCase (enableVideo, not EnableVideo)

**Behavioral Expectations**:

- Build completes in under 2 minutes (typical)
- openapi-spec.json is well-formed JSON (no syntax errors)
- Spec can be validated by OpenAPI validators (no schema errors)
- Spec matches existing settings patterns (ConnectionSettings, PlayerSettings)

**Testing Reference**:

- See [API Client Generation](../../../API_CLIENT_GENERATION.md) for OpenAPI workflow
- Manual verification of JSON structure is sufficient for this task
- Frontend Phase 3 will validate spec correctness via client generation

**Testing Strategy**:

- **Build Verification**: Ensure build succeeds with no errors/warnings
- **Manual Inspection**: Review openapi-spec.json for VideoSettingsDto
- **Schema Validation**: Use online OpenAPI validator if needed (optional)
- **Consistency Check**: Compare VideoSettingsDto with PlayerSettingsDto for pattern matching

---

## 📚 Reference Materials

**Related Documentation**:

- [Master Plan](../master-plan.md) - Overall feature overview
- [Phase 2 Detailed Plan](../phases/phase-02-backend-api.md) - Task 7 details
- [API Client Generation](../../../API_CLIENT_GENERATION.md) - Complete OpenAPI workflow
- [TASK-02-002 Report](../reports/TASK-02-002-report.md) - API integration (will be available after TASK-02-002)

**Related Tasks** (for context):

- TASK-02-001: Created VideoSettingsDto and VideoSettingsValidator (completed)
- TASK-02-002: Integrated VideoSettings into request/response models and mappers (completed)
- TASK-03-001: Will regenerate frontend TypeScript API client (depends on this task)

**Expected OpenAPI Schema** (reference):

```json
{
  "VideoSettingsDto": {
    "type": "object",
    "properties": {
      "enableVideo": {
        "type": "boolean",
        "description": "Enable video capture component visibility in player view."
      }
    },
    "required": ["enableVideo"],
    "description": "Video capture and display preferences."
  }
}
```

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/video-settings-feature/reports/TASK-02-003-report.md`

**Report Template**: Follow the structure defined in Phase 1's TASK-01-001-report.md

**Return Value**: Return the file path when complete: `docs/projects/video-settings-feature/reports/TASK-02-003-report.md`

**Report Should Include**:

- Build command executed and output (success/failure)
- Location of generated openapi-spec.json
- Verification results (VideoSettingsDto present? Correct schema?)
- Screenshots or JSON snippets showing VideoSettingsDto in spec
- Git commit hash for openapi-spec.json commit
- Time taken vs estimate
- Any warnings or issues encountered

---

## 🎯 Expected Outcomes

After completing this task:

1. Backend builds successfully with no errors or warnings
2. `openapi-spec.json` file generated/updated in workspace root
3. VideoSettingsDto schema present in OpenAPI spec with correct structure
4. GetSettingsResponse and SaveSettingsRequest schemas include videoSettings property
5. EnableVideo property defined as boolean with required constraint
6. openapi-spec.json committed to source control
7. **Phase 2 COMPLETE** - Backend API layer fully implemented
8. Ready to proceed to Phase 3 (API Client Regeneration & Infrastructure)

---

## 💡 Implementation Notes

- **Build Location**: Run build from `apps/api/src/` directory, targeting `TeensyRom.Api.csproj`
- **Spec Location**: Generated spec is placed in workspace root, NOT in API project directory
- **Automatic Generation**: OpenAPI spec generation is configured in API project - no manual steps needed beyond build
- **Verification Focus**: Spend time carefully verifying VideoSettingsDto schema - errors here cascade to frontend
- **Property Naming**: OpenAPI spec uses camelCase (enableVideo) due to JSON serialization settings - this is correct
- **Commit Message**: Use conventional commit format: `chore: regenerate OpenAPI spec with VideoSettings`
- **Next Phase**: Phase 3 will use this spec to regenerate TypeScript API client with VideoSettings support

---

**Task Status**: Ready for Execution (after TASK-02-002 completes)  
**Estimated Time**: 15-20 minutes  
**Complexity**: Low (build + verification, no code changes)
