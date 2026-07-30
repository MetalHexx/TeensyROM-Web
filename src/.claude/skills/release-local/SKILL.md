---
name: release-local
description: Create a local test release of TeensyROM Web for quick validation before official release
user-invocable: true
disable-model-invocation: true
---

# Local Test Release

This skill creates a **local test release** of TeensyROM Web without version bumping, git tagging, or triggering CI/CD. Use this for quick validation and testing before creating an official GitHub release.

## When to Use This

- ✅ Testing a full production build locally before release
- ✅ Validating build process changes
- ✅ Creating test executables for manual QA
- ✅ Verifying frontend/backend integration in production mode
- ❌ NOT for official releases (use the `release` skill instead)

## Prerequisites

- .NET 9 SDK installed
- Node.js 20.x + pnpm installed
- All changes committed (recommended, not required)
- Frontend dev server can be stopped (port 4200 freed)

## Process

### Step 1: Build Frontend Production Assets

**Command:**
```bash
pnpm run build:frontend
```

**What it does:**
1. Runs `nx build teensyrom-ui --configuration=production --skip-nx-cache`
2. Cleans `apps/api/src/TeensyRom.Api/wwwroot/` (preserves .gitkeep)
3. Copies production build to wwwroot (13-15 files)

**Expected output:**
```
═══════════════════════════════════════════════════
  TeensyROM Frontend Build & Copy
═══════════════════════════════════════════════════

📦 Building Angular frontend (production)...
✅ Build completed successfully

🔍 Verifying build output...
   Found 13 files in build output

🧹 Cleaning wwwroot folder...
   Cleaned existing files (preserved .gitkeep)

📋 Copying files to wwwroot...
   Copied 13 files to wwwroot
```

**Common Issues:**
- ❌ **Build fails with TypeScript errors**: Check for type mismatches, missing imports, or stale generated code
- ❌ **Build fails on `connectionType` not found**: Old code referencing removed domain properties (see Troubleshooting section)
- ❌ **"Module not found" errors**: Run `pnpm install` to restore dependencies

### Step 2: Publish Backend (Windows x64)

**Command:**
```bash
dotnet publish apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj \
  -c Release \
  -r win-x64 \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:SkipBuildFrontend=true \
  -p:OpenApiGenerateDocuments=false \
  -p:OpenApiGenerateDocumentsOnBuild=false \
  -o ./publish/win-x64
```

**Parameters explained:**
- `-c Release` - Release configuration (optimized)
- `-r win-x64` - Target Windows 64-bit
- `--self-contained true` - Bundle .NET runtime (no SDK needed to run)
- `-p:PublishSingleFile=true` - Create single executable
- `-p:SkipBuildFrontend=true` - Don't rebuild frontend (already built in Step 1)
- `-p:OpenApiGenerateDocuments=false` - Skip OpenAPI build-time generation
- `-p:OpenApiGenerateDocumentsOnBuild=false` - Prevent platform-specific binary execution
- `-o ./publish/win-x64` - Output directory

**Expected output:**
```
Restore complete (3.0s)
TeensyRom.Core succeeded (5.3s)
TeensyRom.Core.Serial succeeded (1.6s)
TeensyRom.Core.Storage succeeded (1.5s)
TeensyRom.Core.Device succeeded (1.3s)
TeensyRom.Api succeeded (45.0s)
Build succeeded with 23 warning(s) in 58.7s
```

**Output structure:**
```
publish/win-x64/
├── TeensyRom.Api.exe              ← Single executable (~71 MB)
├── TeensyRom.Api.pdb              ← Debug symbols
├── wwwroot/                       ← Angular frontend (50+ files)
├── Assets/                        ← System config & database files
├── api-spec/                      ← OpenAPI schema
├── appsettings.json               ← Runtime configuration
└── ... (other support files)
```

### Step 3: Test the Build

**Run the executable:**
```bash
cd publish/win-x64
.\TeensyRom.Api.exe
```

**Verify functionality:**
1. Open browser: `http://localhost:5000`
2. Check Angular app loads (not Scalar docs redirect)
3. Test device detection (if TeensyROM connected)
4. Check API endpoints: `http://localhost:5000/api/devices`
5. Verify Scalar docs: `http://localhost:5000/scalar/v1`
6. Check SignalR hubs connect (browser DevTools console)

**Common Issues:**
- ❌ **Port 5000 already in use**: Kill existing process or change port in appsettings.json
- ❌ **404 on root**: Frontend not copied to wwwroot (run Step 1)
- ❌ **CORS errors**: Check allowed origins in appsettings.json
- ❌ **Assets not found**: AppContext.BaseDirectory issue (Phase 03 concern)

### Step 4: Report Output Location

**Always provide the user with:**

📍 **Full path to executable:**
```
c:\dev\src\TeensyROM-Web\src\publish\win-x64\TeensyRom.Api.exe
```

**Include:**
- File size (~71 MB expected)
- Number of files in wwwroot (50-60 expected)
- Quick test instructions

## Additional Platforms

### macOS x64 (Intel)
```bash
dotnet publish apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj \
  -c Release \
  -r osx-x64 \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:SkipBuildFrontend=true \
  -p:OpenApiGenerateDocuments=false \
  -p:OpenApiGenerateDocumentsOnBuild=false \
  -o ./publish/osx-x64

# Make executable
chmod +x ./publish/osx-x64/TeensyRom.Api
```

### macOS ARM64 (Apple Silicon)
```bash
dotnet publish apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj \
  -c Release \
  -r osx-arm64 \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:SkipBuildFrontend=true \
  -p:OpenApiGenerateDocuments=false \
  -p:OpenApiGenerateDocumentsOnBuild=false \
  -o ./publish/osx-arm64

chmod +x ./publish/osx-arm64/TeensyRom.Api
```

### Linux x64
```bash
dotnet publish apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj \
  -c Release \
  -r linux-x64 \
  --self-contained true \
  -p:PublishSingleFile=true \
  -p:SkipBuildFrontend=true \
  -p:OpenApiGenerateDocuments=false \
  -p:OpenApiGenerateDocumentsOnBuild=false \
  -o ./publish/linux-x64

chmod +x ./publish/linux-x64/TeensyRom.Api
```

**Note**: Cross-platform builds work from any OS, but testing requires the target OS.

## Troubleshooting

### Build Error: Property 'X' does not exist on type 'Y'

**Cause**: Stale code referencing removed/renamed domain properties

**Example**: `connectionType` property removed from frontend Device model (lives on backend only)

**Fix**: Search and remove obsolete property references:
```bash
# Find all usages
grep -r "connectionType" libs/

# Common locations to check:
- libs/features/*/src/**/*.html (template bindings)
- libs/features/*/src/**/*.spec.ts (test fixtures)
- libs/application/src/**/*.spec.ts (mock data)
- libs/infrastructure/src/**/domain.mapper.ts (DTO mappings)
```

**Pattern for fixes:**
1. Remove property from template conditionals
2. Update test fixtures to match domain model
3. Clean up stale imports (e.g., `ConnectionType` enum)

### Build Warning: IL3000 Assembly.Location always returns empty string

**Cause**: Reading `Assembly.Location` in single-file publish

**Fix**: Replace with `AppContext.BaseDirectory`:
```csharp
// ❌ Don't use
var path = Assembly.GetExecutingAssembly().Location;

// ✅ Use instead
var path = AppContext.BaseDirectory;
```

### Frontend Files Not Served

**Symptoms:**
- Scalar docs shown on root instead of Angular app
- 404 on `/` route
- Static files not loading

**Fix:**
```bash
# Verify wwwroot populated
ls apps/api/src/TeensyRom.Api/wwwroot/
# Should see: index.html, *.js, *.css, images, etc.

# If empty, rebuild frontend
pnpm run build:frontend

# Republish backend
dotnet publish apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj \
  -c Release -r win-x64 --self-contained true \
  -p:PublishSingleFile=true -p:SkipBuildFrontend=true \
  -o ./publish/win-x64
```

### Executable Size Too Large (>100 MB)

**Expected size**: ~70-75 MB for Windows x64

**Causes**:
- Debug symbols included (`.pdb` files are separate)
- Multiple platform runtimes bundled
- Compression disabled on macOS builds

**Not a problem unless exceeding 150+ MB**

## Packaging for Distribution

**Windows (.zip):**
```powershell
cd publish/win-x64
Compress-Archive -Path * -DestinationPath ../TeensyROM-Web-local-win-x64.zip
```

**macOS/Linux (.tar.gz):**
```bash
cd publish/osx-x64
tar -czvf ../TeensyROM-Web-local-osx-x64.tar.gz .
```

## Next Steps

After successful local testing:
1. Verify all functionality works in production mode
2. Check device detection and serial communication
3. Test file operations (launch, favorites, indexing)
4. Validate video capture (if enabled)
5. Confirm SignalR real-time updates work

**When ready for official release:**
Use the `release` skill to version bump, tag, and create GitHub Release with all 4 platforms.

## References

- **Full Release Process**: `release` skill (`.claude/skills/release/SKILL.md`)
- **Distribution Guide**: [docs/DISTRIBUTION.md](../../../docs/DISTRIBUTION.md)
- **Backend Architecture**: [docs/BACKEND_ARCHITECTURE.md](../../../docs/BACKEND_ARCHITECTURE.md)
- **Build Pipeline**: [docs/DISTRIBUTION.md](../../../docs/DISTRIBUTION.md#local-testing-before-release)
