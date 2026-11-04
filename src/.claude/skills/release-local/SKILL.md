---
name: release-local
description: Create a local test release of TeensyROM Suite for quick validation before official release
user-invocable: true
disable-model-invocation: true
---

# Local Test Release

This skill creates a **local test release** of TeensyROM Suite without version bumping, git tagging, or triggering CI/CD. Use this for quick validation and testing before creating an official GitHub release.

## When to Use This

- ✅ Testing a full production build locally before release
- ✅ Validating build process changes
- ✅ Creating test executables for manual QA
- ✅ Verifying frontend/backend integration in production mode
- ✅ Verifying the package layout: `README.txt`, `api/` (the engine) and `cli/` (`trom`, one file)
- ✅ Trying `trom update` end to end against a local fake release feed
- ❌ NOT for official releases (use the `release` skill instead)

## Prerequisites

- .NET 9 SDK installed
- Node.js 20.x + pnpm installed
- bash and Python 3 for `.github/scripts/package.sh` (Git Bash, WSL, macOS or Linux)
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

### Step 2: Publish the Engine and the CLI

`.github/scripts/package.sh` is the one place the packages are built; CI (`build-packages.yml`) runs the same script. Run from the repo root:

**Command:**
```bash
bash .github/scripts/package.sh publish win-x64 1.0.0-local ./src/publish/win-x64
```

**What it does:**
- Publishes the engine into `<dir>/api` (`-c Release -r <rid> --self-contained true -p:PublishSingleFile=true -p:SkipBuildFrontend=true -p:OpenApiGenerateDocuments=false -p:OpenApiGenerateDocumentsOnBuild=false -p:Version=<version>`). `SkipBuildFrontend` keeps the Step 1 `wwwroot`; the two OpenApi switches stop the build from running a platform-specific binary.
- Publishes the CLI into `<dir>/cli` (`-r <rid> --self-contained true -p:Version=<version>`).

**Local versions**: the version argument is passed as `-p:Version`, so a local build reports any version you choose (`trom --version` prints `trom <version>`) without touching `src/apps/Version.props`. One call stamps the engine and the CLI alike.

**The CLI is one file**: the CLI project publishes single-file, self-contained, with symbols embedded, so `cli/` holds only `trom[.exe]` (ReadyToRun and native self-extract everywhere except `osx-*`). The logo font is an embedded resource. The CLI project sets these only when a `-r` and `--self-contained true` are given, so a plain `dotnet build` or test run is unaffected. Don't set `SelfContained` without a runtime identifier: the test projects reference the CLI (NETSDK1151).

**Output structure:**
```
src/publish/win-x64/
├── api/
│   ├── TeensyRom.Api.exe          ← The engine (single file)
│   ├── appsettings.json
│   ├── wwwroot/                   ← Angular frontend
│   ├── Assets/                    ← Seed assets (zips unpacked by assemble)
│   └── ...                        (api-spec/, web.config, symbols)
└── cli/
    └── trom.exe                   ← The CLI (single file)
```

### Step 3: Assemble the Package

**Command:**
```bash
bash .github/scripts/package.sh assemble win-x64 1.0.0-local ./src/publish/win-x64 ./src/publish/out
```

**What it does** (in a temp folder on the local file system, because `chmod` does nothing on `/mnt/c` under WSL):
1. Copies `api/` and `cli/`, unpacks the `api/Assets/**/*.zip` files in place and renders `README.txt` from `src/apps/packaging/README.txt`.
2. Validates the layout: `api/<exe>`, `appsettings.json`, `wwwroot/index.html`, `Assets/`, and `cli/` holding only `trom[.exe]` (`.dylib` files are allowed on `osx-*`).
3. Marks both executables `+x`.
4. Archives to `<out>/TeensyROM-Suite-<version>-<rid>.zip` (win) or `.tar.gz`, and prints the archive path last.
5. When the host can run the target, checks `cli/trom --version` reports `trom <version>`.

**Archive layout:**
```
TeensyROM-Suite-<version>-<rid>.zip|tar.gz
├── README.txt
├── api/                           TeensyRom.Api[.exe], appsettings.json, wwwroot/, Assets/
└── cli/                           trom[.exe]
```

The packaged CLI finds the engine at `<cli folder>/../api/TeensyRom.Api[.exe]`, so keep `cli/` and `api/` side by side. An existing PATH entry for `<root>/cli` stays valid across updates.

Cross-platform archives work from any host with bash and Python 3 (a macOS or Linux package built under WSL keeps its executable bits); only the `--version` check needs the target OS.

### Step 4: Test the Build

Unpack the archive into a scratch folder, then work from there. Point `TEENSYROM_DATA_DIR` at a temp folder so the test does not touch your real `~/.teensyrom`.

**Smoke-test with `trom`** (stop any engine on port 10213 first):
```powershell
$env:TEENSYROM_DATA_DIR = Join-Path $env:TEMP 'teensyrom-pkg-test'
cd <unpacked>/cli
.\trom.exe --version             # trom <version>
.\trom.exe api start --json      # starts ../api/TeensyRom.Api.exe; running, at that version
curl http://localhost:10213/api/version
.\trom.exe ui --no-open --json   # available: true; prints the local and LAN addresses
.\trom.exe update --check --json # reads the release feed; see Step 5 for a fake one
.\trom.exe api stop              # stops the engine it started
```
Always finish with `api stop` so no engine is left running. `.github/scripts/package-smoke.sh <trom> <version>` runs this sequence with assertions (it needs `TROM_RELEASES_URL` pointing at a feed).

**Run the engine in a terminal instead** (foreground, console stays open):
```bash
cd <unpacked>/api
./TeensyRom.Api        # TeensyRom.Api.exe on Windows
```

**Verify functionality:**
1. Open browser: `http://localhost:10213` (or `trom ui`)
2. Check Angular app loads (not Scalar docs redirect)
3. Test device detection (if TeensyROM connected)
4. Check API endpoints: `http://localhost:10213/api/devices`
5. Verify Scalar docs: `http://localhost:10213/scalar/v1`
6. Check SignalR hubs connect (browser DevTools console)

**Common Issues:**
- ❌ **Port 10213 already in use**: Stop the other engine (`trom api stop`) or change the port in appsettings.json
- ❌ **404 on root**: Frontend not copied to wwwroot (run Step 1)
- ❌ **CORS errors**: Check allowed origins in appsettings.json
- ❌ **Assets not found**: AppContext.BaseDirectory issue (Phase 03 concern)
- ❌ **CLI cannot find the engine**: `api/` and `cli/` must sit side by side (`../api/TeensyRom.Api[.exe]`)
- ❌ **`assemble` says `wwwroot/index.html` is missing**: run Step 1 before Step 2

### Step 5: Try `trom update` against a fake feed

`trom update` reads a GitHub release list, picks the newest release with an asset for its platform, verifies the asset's `digest` and swaps the install in place. A fake feed on localhost exercises all of that without a release.

1. Build two packages with Steps 2-3: the installed version (for example `1.0.0-beta.1`) and a newer one (`1.0.0-beta.2`), each into its own `out` folder.
2. Unpack the older one to a scratch install folder and set `TEENSYROM_DATA_DIR` to a scratch home.
3. Write the feed and serve it:
   ```bash
   python .github/scripts/fake_release_feed.py <feed-dir> 1.0.0-beta.2 <out2>/TeensyROM-Suite-1.0.0-beta.2-win-x64.zip
   python -m http.server 8765 --bind 127.0.0.1 --directory <feed-dir>
   ```
   The feed holds the newer release (with the asset and its real `sha256:` digest), an older release with no assets and a far newer draft that `trom` must ignore. `--digest wrong` or `--digest none` writes a bad or missing digest.
4. Point `trom` at it with the hidden `TROM_RELEASES_URL=http://127.0.0.1:8765/releases.json` (plain `http` is accepted only with this override).
5. From the scratch install's `cli/`:
   - `trom update --check --json` reports `{installed, latest, available, installKind, checkedAt}` with `available: true`, and changes nothing.
   - `trom update --json` with no terminal and no `--yes` exits 2.
   - A feed with `--digest wrong` or `none`: the update is refused (exit 1) and the install is unchanged.
   - `trom update --yes --json`: the engine is stopped, `api/`, `cli/` and `README.txt` are swapped, and the new `trom` restarts the engine if it was running. The output carries `updated: true`, `from`, `to`, `engineWasRunning` and `engineRestarted`. The running `trom` is renamed aside on every platform (`trom.exe.old` on Windows, `trom.old` on macOS and Linux; `.<n>.old` if that name is taken) and removed by the next `trom` run; `<root>/.trom-update/` is gone afterwards.
   - Holding a file in `api/` open with `FileShare.None` makes the swap fail; it rolls back and the old engine runs again. Hold a file the engine doesn't read at start (`api/wwwroot/index.html`): holding `appsettings.json` also rolls back, but the old engine can't start again until the file is released.
   - Linux under WSL: run scripts with `wsl -d <distro> --exec bash <script>` (from Git Bash, prefix `MSYS_NO_PATHCONV=1`), run the feed server inside WSL, and do the whole flow in one script. WSL in NAT mode can't discover carts; seed `<home>/api/Assets/System/Config/ConnectionRecords.json` with each cart's `ChipId`, `TcpEndpoint` (`ip:2112`) and `TransportInUse: 1` before the first start.
6. Afterwards `trom --version` shows the newer version and `trom api status` agrees. Finish with `trom api stop`, stop the feed server and delete the scratch folders.

### Step 6: Report Output Location

**Always provide the user with:**

📍 **Full path to the archive and the unpacked executables:**
```
c:\dev\src\TeensyROM-Web\src\publish\out\TeensyROM-Suite-1.0.0-local-win-x64.zip
c:\dev\src\TeensyROM-Web\src\publish\win-x64\api\TeensyRom.Api.exe
c:\dev\src\TeensyROM-Web\src\publish\win-x64\cli\trom.exe
```

**Include:**
- File sizes
- Number of files in wwwroot (50-60 expected)
- Quick test instructions

## Additional Platforms

The same two commands cover every platform; only the runtime identifier changes:

```bash
bash .github/scripts/package.sh publish osx-x64    1.0.0-local ./src/publish/osx-x64
bash .github/scripts/package.sh assemble osx-x64   1.0.0-local ./src/publish/osx-x64 ./src/publish/out

bash .github/scripts/package.sh publish osx-arm64  1.0.0-local ./src/publish/osx-arm64
bash .github/scripts/package.sh assemble osx-arm64 1.0.0-local ./src/publish/osx-arm64 ./src/publish/out

bash .github/scripts/package.sh publish linux-x64  1.0.0-local ./src/publish/linux-x64
bash .github/scripts/package.sh assemble linux-x64 1.0.0-local ./src/publish/linux-x64 ./src/publish/out

bash .github/scripts/package.sh publish linux-arm64  1.0.0-local ./src/publish/linux-arm64
bash .github/scripts/package.sh assemble linux-arm64 1.0.0-local ./src/publish/linux-arm64 ./src/publish/out
```

`assemble` sets the executable bits and writes `.tar.gz` for macOS and Linux.

**Note**: Cross-platform builds work from any OS, but testing requires the target OS. Under WSL, run `assemble` from the WSL shell for a Linux package so `chmod` and the tar modes are real.

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

**Cause**: Reading `Assembly.Location` in single-file publish. Both the engine and the CLI publish single-file, so neither may read files beside its assembly.

**Fix**: Replace with `AppContext.BaseDirectory`, or embed the file as a resource (the CLI's logo font is one):
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

# Republish and reassemble (Steps 2-3)
```

### Executable Size Larger Than Expected

**Expected size**: `trom` is a separate self-contained single file with its own runtime (about 97 MB on win-x64 and linux-x64, 83 MB on osx-arm64)

**Causes**:
- Debug symbols included (`.pdb` files are separate for the engine; the CLI embeds them)
- Multiple platform runtimes bundled
- Compression disabled on macOS builds

**Each app carries its own runtime, so ~100 MB per executable is normal; investigate a file far above that**

## Next Steps

After successful local testing:
1. Verify all functionality works in production mode
2. Check device detection and serial communication
3. Test file operations (launch, favorites, indexing)
4. Validate video capture (if enabled)
5. Confirm SignalR real-time updates work

**When ready for official release:**
Use the `release` skill to version bump, tag, and create GitHub Release with all 5 platforms.

## References

- **Full Release Process**: `release` skill (`.claude/skills/release/SKILL.md`)
