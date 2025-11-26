# Task Handoff: TASK-03-001-REGENERATE-API-CLIENT

## 📋 Task Identity

**Task ID**: TASK-03-001-REGENERATE-API-CLIENT  
**Task Name**: Regenerate TypeScript API Client with VideoSettings  
**Assigned To**: UI Wizard  
**Agent Chatmode**: `.github/chatmodes/UI Wizard.chatmode.md`  
**Priority**: High (Foundation for frontend integration)  
**Estimated Context Size**: Small (automated generation + verification)

---

## 🎯 Objective

**What**: Regenerate the frontend TypeScript API client from the updated OpenAPI specification that now includes VideoSettingsDto schema from Phase 2 backend work.

**Why**: The API client must be regenerated whenever the backend OpenAPI spec changes. This ensures the frontend has type-safe access to the new VideoSettings endpoint contracts.

**Success Criteria**:

- [ ] OpenAPI spec verified to contain VideoSettingsDto schema
- [ ] TypeScript API client regenerated successfully
- [ ] VideoSettingsDto.ts file created in models folder
- [ ] GetSettingsResponse includes videoSettings property
- [ ] SaveSettingsRequest includes videoSettings property
- [ ] All generated code compiles without TypeScript errors
- [ ] Barrel exports updated automatically

---

## 📋 Context & Dependencies

**Prerequisites Completed**:

- ✅ Phase 1: VideoSettings domain model created (backend)
- ✅ Phase 2: VideoSettingsDto and API endpoints updated (backend)
- ✅ Phase 2: OpenAPI spec regenerated with VideoSettingsDto

**Dependencies**:

- OpenAPI spec at `apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json`
- pnpm package manager
- openapi-generator-cli installed
- Generate script at `libs/data-access/api-client/scripts/generate-client.js`

**Constraints**:

- API client generation is automated - do NOT manually edit generated files
- Generated files use TypeScript interfaces (not classes or types)
- Property names are camelCase (enableVideo, not EnableVideo)
- Generation overwrites existing files - custom changes would be lost

---

## 📂 File Scope

**Files Generated** (by script):

- `libs/data-access/api-client/src/lib/models/VideoSettingsDto.ts` - New VideoSettings DTO
- `libs/data-access/api-client/src/lib/models/GetSettingsResponse.ts` - Updated with videoSettings
- `libs/data-access/api-client/src/lib/models/SaveSettingsRequest.ts` - Updated with videoSettings
- `libs/data-access/api-client/src/lib/models/index.ts` - Updated barrel exports

**Files to Verify** (for context only):

- `apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json` - Source OpenAPI specification

**No Manual Code Changes** - This task is purely automated generation + verification

---

## 🛠️ Implementation Guidance

**Standards to Follow**:

- [API Client Generation](../../../API_CLIENT_GENERATION.md) - Complete generation workflow
- [Coding Standards](../../../CODING_STANDARDS.md) - TypeScript conventions
- [Phase 3 Detailed Plan](../phases/phase-03-api-client-infra.md) - Task 1 details

**Key Requirements**:

### Step 1: Verify OpenAPI Spec Contains VideoSettingsDto

**File Location**: `c:\dev\src\TeensyROM-Web\src\apps\api\src\TeensyRom.Api\api-spec\TeensyRom.Api.json`

**What to Check**:

1. Open OpenAPI spec file
2. Find `components.schemas.VideoSettingsDto` section
3. Verify structure:
   ```json
   {
     "VideoSettingsDto": {
       "required": ["enableVideo"],
       "type": "object",
       "properties": {
         "enableVideo": { "type": "boolean" }
       }
     }
   }
   ```
4. Verify GetSettingsResponse includes `videoSettings` property
5. Verify SaveSettingsRequest includes `videoSettings` property

### Step 2: Navigate to Workspace Root

```powershell
# From anywhere in the repository
cd c:\dev\src\TeensyROM-Web\src
```

### Step 3: Run API Client Generation Script

```powershell
pnpm run generate:api-client
```

**What This Does**:

- Reads OpenAPI spec from `apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json`
- Invokes `openapi-generator-cli` with TypeScript Fetch template
- Generates models and APIs in `libs/data-access/api-client/src/lib/`
- Post-processes files (renames *Api → *ApiService)
- Updates barrel exports

**Expected Output**:

```
Generating TypeScript client from OpenAPI spec...
✓ Cleaned output directory
✓ Generated models and APIs
✓ Post-processed files (renamed services)
✓ Updated barrel exports
Generation complete!
```

### Step 4: Verify Generated Files

**Check 1: VideoSettingsDto Created**

File: `libs/data-access/api-client/src/lib/models/VideoSettingsDto.ts`

Expected content:
```typescript
/* tslint:disable */
/* eslint-disable */
/**
 * TeensyRom.Api | v1
 * ...
 */

export interface VideoSettingsDto {
    enableVideo: boolean;
}
```

**Check 2: GetSettingsResponse Updated**

File: `libs/data-access/api-client/src/lib/models/GetSettingsResponse.ts`

Verify includes:
```typescript
export interface GetSettingsResponse {
    connectionSettings: ConnectionSettingsDto;
    playerSettings: PlayerSettingsDto;
    videoSettings: VideoSettingsDto; // NEW
    fileTransferSettings: FileTransferSettingsDto;
    searchSettings: SearchSettingsDto;
    appSettings: AppSettingsDto;
}
```

**Check 3: SaveSettingsRequest Updated**

File: `libs/data-access/api-client/src/lib/models/SaveSettingsRequest.ts`

Verify includes:
```typescript
export interface SaveSettingsRequest {
    connectionSettings: ConnectionSettingsDto;
    playerSettings: PlayerSettingsDto;
    videoSettings: VideoSettingsDto; // NEW
    fileTransferSettings: FileTransferSettingsDto;
    searchSettings: SearchSettingsDto;
    appSettings: AppSettingsDto;
}
```

**Check 4: Barrel Export Updated**

File: `libs/data-access/api-client/src/lib/models/index.ts`

Verify includes:
```typescript
export * from './VideoSettingsDto';
```

### Step 5: Verify TypeScript Compilation

```powershell
pnpm nx build data-access-api-client
```

**Expected Output**: Build succeeds with no errors

---

## 🧪 Testing Requirements

**Test Coverage Required**:

- [ ] OpenAPI spec contains VideoSettingsDto schema
- [ ] VideoSettingsDto.ts file exists after generation
- [ ] VideoSettingsDto has enableVideo property (boolean)
- [ ] GetSettingsResponse includes videoSettings property
- [ ] SaveSettingsRequest includes videoSettings property
- [ ] Barrel exports include VideoSettingsDto
- [ ] TypeScript compilation succeeds (no errors)

**Behavioral Expectations**:

- Generation script completes without errors
- All generated files are well-formed TypeScript
- Type definitions match OpenAPI spec exactly
- Property names are camelCase (enableVideo, not EnableVideo)

**Testing Reference**:

- See [API Client Generation](../../../API_CLIENT_GENERATION.md) for generation workflow
- Manual verification of file contents is sufficient
- TypeScript compiler serves as automated validation

**Testing Strategy**:

- **Generation Verification**: Script runs without errors
- **File Verification**: Manually inspect generated files for VideoSettingsDto
- **Compilation Verification**: Build succeeds with no TypeScript errors

---

## 📚 Reference Materials

**Related Documentation**:

- [Master Plan](../master-plan.md) - Overall feature overview
- [Phase 3 Detailed Plan](../phases/phase-03-api-client-infra.md) - Complete Phase 3 guidance
- [API Client Generation](../../../API_CLIENT_GENERATION.md) - Generation workflow
- [Phase 2 Completion Report](../reports/TASK-02-CONSOLIDATED-report.md) - Backend API work

**Related Tasks** (for context):

- TASK-01-001: Created VideoSettings domain model (completed)
- TASK-02-001/002/003: Created VideoSettingsDto and API layer (completed)
- TASK-03-002: Will integrate VideoSettings into frontend domain and mappers (depends on this task)

**OpenAPI Spec Location**:

- Source: `apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json`
- Generated by: Backend build in Phase 2
- Used by: API client generation script

---

## 📤 Output Specification

**Output Report Location**: `docs/projects/video-settings-feature/reports/TASK-03-001-report.md`

**Report Template**: Follow the structure defined in Phase 1's TASK-01-001-report.md

**Return Value**: Return the file path when complete: `docs/projects/video-settings-feature/reports/TASK-03-001-report.md`

**Report Should Include**:

- Generation command executed and output
- Files generated (list with relative paths)
- Verification results (VideoSettingsDto present? Correct structure?)
- Compilation results (build succeeded?)
- Screenshots or code snippets showing VideoSettingsDto in generated files
- Time taken vs estimate

---

## 🎯 Expected Outcomes

After completing this task:

1. `VideoSettingsDto.ts` exists in `libs/data-access/api-client/src/lib/models/`
2. `GetSettingsResponse` includes `videoSettings: VideoSettingsDto` property
3. `SaveSettingsRequest` includes `videoSettings: VideoSettingsDto` property
4. Barrel exports include `export * from './VideoSettingsDto'`
5. All generated code compiles without TypeScript errors
6. API client library builds successfully
7. Ready for TASK-03-002 (frontend domain and mapper integration)

---

## 💡 Implementation Notes

- **Automated Process**: API client generation is fully automated - no manual coding required
- **Workspace Root**: Must run generation from workspace root (src/ directory)
- **Overwrite Warning**: Generation overwrites existing files - do not manually edit API client code
- **Property Naming**: OpenAPI spec uses camelCase for properties (enableVideo), matches TypeScript conventions
- **Post-Processing**: Script automatically renames *Api → *ApiService for consistency with infrastructure naming
- **Build Verification**: TypeScript compiler is the authoritative verification - if build succeeds, generation succeeded

---

**Task Status**: Ready for Execution  
**Estimated Time**: 15-20 minutes  
**Complexity**: Low (automated generation + verification)
