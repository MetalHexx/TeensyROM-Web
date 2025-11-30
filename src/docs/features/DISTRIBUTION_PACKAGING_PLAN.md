# TeensyROM Application Distribution & Packaging Plan

**Status**: 📋 Planning  
**Created**: 2025-11-30  
**Last Updated**: 2025-11-30 (v2)  
**Author**: Architect Mode

---

## 1. Feature Overview

### Problem Statement

Currently, running the TeensyROM application requires:
1. .NET 9 SDK installed
2. Node.js/pnpm for frontend development
3. Running two separate servers (API + Angular dev server)
4. Technical knowledge to set up the development environment

This creates a high barrier to entry for end users who just want to use the application.

### Proposed Solution

Create a single, self-contained executable for Windows, Mac, and Linux that:
- Bundles the .NET API with the production Angular frontend
- Runs as a single process
- Serves the Angular SPA directly from the API
- Requires no external dependencies (self-contained .NET runtime)
- Distributable via GitHub Releases and Homebrew (macOS)

### User Experience Goal

```
# Windows/Linux
1. Download TeensyROM-v1.0.0-win-x64.zip
2. Extract and run TeensyROM.exe
3. Open browser to http://localhost:5168
4. Use the application

# macOS (via Homebrew)
1. brew install MetalHexx/TeensyROM/teensyrom-web
2. Run: teensyrom-web
3. Open browser to http://localhost:5168
```

---

## 2. Architecture Design

### High-Level Build Pipeline

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#5a2c6b', 'primaryTextColor': '#fff', 'primaryBorderColor': '#7d3fa3', 'lineColor': '#b3b3b3', 'secondaryColor': '#0066cc', 'tertiaryColor': '#2d7a3e'}}}%%
flowchart LR
    subgraph Frontend["Frontend Build"]
        A[Angular Source] --> B[nx build teensyrom-ui --prod]
        B --> C[dist/apps/teensyrom-ui/browser]
    end
    
    subgraph Integration["Integration"]
        C --> D[Copy to API wwwroot]
        D --> E[TeensyRom.Api with Static Files]
    end
    
    subgraph Backend["Backend Publish"]
        E --> F[dotnet publish -r win-x64]
        E --> G[dotnet publish -r osx-x64]
        E --> H[dotnet publish -r linux-x64]
        E --> I[dotnet publish -r osx-arm64]
    end
    
    subgraph Output["Release Artifacts"]
        F --> J[TeensyROM-win-x64.zip]
        G --> K[TeensyROM-osx-x64.tar.gz]
        H --> L[TeensyROM-linux-x64.tar.gz]
        I --> M[TeensyROM-osx-arm64.tar.gz]
    end
    
    style A fill:#5a2c6b,color:#fff,stroke:#7d3fa3
    style E fill:#0066cc,color:#fff,stroke:#0052a3
    style J fill:#2d7a3e,color:#fff,stroke:#1f5a2e
    style K fill:#2d7a3e,color:#fff,stroke:#1f5a2e
    style L fill:#2d7a3e,color:#fff,stroke:#1f5a2e
    style M fill:#2d7a3e,color:#fff,stroke:#1f5a2e
```

### Static File Serving Architecture

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#5a2c6b', 'primaryTextColor': '#fff', 'primaryBorderColor': '#7d3fa3', 'lineColor': '#b3b3b3'}}}%%
sequenceDiagram
    participant Browser
    participant API as TeensyRom.Api
    participant FS as wwwroot/

    Browser->>API: GET /
    API->>FS: Serve index.html
    FS-->>API: index.html
    API-->>Browser: index.html
    
    Browser->>API: GET /main.abc123.js
    API->>FS: Serve static asset
    FS-->>API: main.abc123.js
    API-->>Browser: JavaScript bundle
    
    Browser->>API: GET /api/devices
    API-->>Browser: JSON response
    
    Note over Browser,API: SPA Fallback for client routes
    Browser->>API: GET /player/music
    API->>FS: index.html (SPA fallback)
    FS-->>API: index.html
    API-->>Browser: index.html
```

---

## 3. Technical Approach

### 3.1 Relative URL Migration (Critical Pre-requisite)

**Current Problem**: Hardcoded `http://localhost:5168` URLs scattered across infrastructure layer:

| File | Usage |
|------|-------|
| `device/providers.ts` | API client basePath |
| `storage/providers.ts` | API client basePath |
| `player/providers.ts` | API client basePath |
| `settings/providers.ts` | API client basePath |
| `device-logs.service.ts` | SignalR hub URL |
| `device-events.service.ts` | SignalR hub URL |
| `storage.service.ts` | Base URL for image paths |
| `player.service.ts` | Base URL fallback |

**Solution Strategy**: Use relative URLs with environment-based configuration

#### 3.1.1 API Configuration Token Pattern

Create a centralized API configuration in the domain layer:

```typescript
// libs/domain/contracts/api-config.contract.ts
export interface IApiConfig {
  basePath: string;      // '' for production (relative), 'http://localhost:5168' for dev
  signalRBasePath: string; // Same pattern
}

export const API_CONFIG = new InjectionToken<IApiConfig>('ApiConfig');
```

#### 3.1.2 Environment-Based Provider

```typescript
// libs/infrastructure/config/api-config.provider.ts
import { isDevMode } from '@angular/core';

export function provideApiConfig(): IApiConfig {
  return {
    basePath: isDevMode() ? 'http://localhost:5168' : '',
    signalRBasePath: isDevMode() ? 'http://localhost:5168' : '',
  };
}

export const API_CONFIG_PROVIDER = {
  provide: API_CONFIG,
  useFactory: provideApiConfig,
};
```

#### 3.1.3 Updated Providers (Example)

```typescript
// libs/infrastructure/src/lib/device/providers.ts
export const DEVICES_API_CLIENT_PROVIDER = {
  provide: DevicesApiService,
  useFactory: (apiConfig: IApiConfig) => {
    const config = new Configuration({ basePath: apiConfig.basePath });
    return new DevicesApiService(config);
  },
  deps: [API_CONFIG],
};
```

#### 3.1.4 SignalR Hub Updates

```typescript
// device-logs.service.ts
constructor(@Inject(API_CONFIG) private apiConfig: IApiConfig) {}

connect() {
  this.hubConnection = new signalR.HubConnectionBuilder()
    .withUrl(`${this.apiConfig.signalRBasePath}/logHub`)
    .withAutomaticReconnect()
    .build();
}
```

**Key Insight**: Angular's `isDevMode()` returns `true` during development (`ng serve`) and `false` in production builds. This allows seamless switching without environment files.

### 3.2 Frontend Build Changes

**Current State**: Angular app builds to `dist/apps/teensyrom-ui/browser`

**Required Changes**:
1. ✅ Ensure `baseHref` is `/` for production builds (already default)
2. Configure output to be copied to API's `wwwroot` folder during build
3. Production build with full optimization

**Build Command**:
```bash
pnpm nx build teensyrom-ui --configuration=production
```

### 3.3 .NET API Static File Configuration

**Current State**: API serves assets from unpacked embedded resources

**Required Changes**:
1. Add `wwwroot` folder to the API project
2. Configure static file middleware for SPA serving
3. Add SPA fallback for Angular routing
4. Ensure API routes take precedence over static files

**Key Configuration** (Program.cs additions):
```csharp
// Serve static files from wwwroot (Angular app)
app.UseDefaultFiles();  // Serves index.html for root
app.UseStaticFiles();

// API routes first - MUST come before SPA fallback
app.MapRadEndpoints();
app.MapHub<LogsHub>("/logHub");
app.MapHub<DeviceEventHub>("/deviceEventHub");

// SPA fallback - MUST be last
app.MapFallbackToFile("index.html");
```

### 3.4 Self-Contained Publishing

**Runtime Identifiers (RIDs)**:
| Platform | RID | Output |
|----------|-----|--------|
| Windows x64 | `win-x64` | `TeensyROM.exe` |
| macOS x64 | `osx-x64` | `teensyrom` (executable) |
| macOS ARM64 | `osx-arm64` | `teensyrom` (executable) |
| Linux x64 | `linux-x64` | `teensyrom` (executable) |

**Publish Configuration** (.csproj additions):
```xml
<PropertyGroup>
  <PublishSingleFile>true</PublishSingleFile>
  <SelfContained>true</SelfContained>
  <EnableCompressionInSingleFile>true</EnableCompressionInSingleFile>
  <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
</PropertyGroup>
```

### 3.5 Embedded Assets (Bundled)

The following assets are embedded in the .NET executable and unpacked on startup:
- `OneLoad64.zip` → Game images
- `Composers.zip` → Musician images  
- `vice-bins.zip` → VICE emulator binaries
- `deepsid_db.zip` → DeepSID database

These will be included in the self-contained publish and extracted to the user's local app data on first run.

---

## 4. Release Automation with Semantic Versioning

### 4.1 Semantic Versioning Strategy

**Version Format**: `MAJOR.MINOR.PATCH` (e.g., `1.0.0`, `1.2.3`)

| Type | When to Use | Example |
|------|-------------|---------|
| MAJOR | Breaking changes | `1.0.0` → `2.0.0` |
| MINOR | New features (backward compatible) | `1.0.0` → `1.1.0` |
| PATCH | Bug fixes | `1.0.0` → `1.0.1` |

### 4.2 Release Trigger Workflow

```mermaid
%%{init: {'theme': 'dark', 'themeVariables': {'primaryColor': '#5a2c6b', 'primaryTextColor': '#fff', 'primaryBorderColor': '#7d3fa3', 'lineColor': '#b3b3b3'}}}%%
flowchart TB
    subgraph Trigger["Release Trigger Options"]
        T1["Manual: workflow_dispatch<br/>Enter version: 1.2.0"]
        T2["Automatic: Push tag v*<br/>git tag v1.2.0 && git push --tags"]
    end
    
    subgraph Workflow["GitHub Actions"]
        W1[Validate semantic version]
        W2[Build frontend + backend]
        W3[Create platform artifacts]
        W4[Create GitHub Release]
        W5[Update Homebrew formula]
    end
    
    Trigger --> Workflow
    
    style T1 fill:#5a2c6b,color:#fff,stroke:#7d3fa3
    style T2 fill:#5a2c6b,color:#fff,stroke:#7d3fa3
    style W4 fill:#2d7a3e,color:#fff,stroke:#1f5a2e
```

### 4.3 How to Trigger a Release

**Option A: Manual Release (Recommended for control)**
1. Go to GitHub Actions → Release workflow
2. Click "Run workflow"
3. Enter version number (e.g., `1.2.0`)
4. Workflow validates format, builds, and creates release

**Option B: Git Tag Push (Automated)**
```bash
# Create and push a version tag
git tag v1.2.0
git push origin v1.2.0
# Workflow triggers automatically
```

### 4.4 Version Validation

The workflow validates semantic version format:
```yaml
- name: Validate version
  run: |
    VERSION="${{ github.event.inputs.version || github.ref_name }}"
    VERSION="${VERSION#v}"  # Remove 'v' prefix if present
    if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
      echo "Invalid version format: $VERSION"
      echo "Expected format: X.Y.Z or X.Y.Z-suffix"
      exit 1
    fi
    echo "VERSION=$VERSION" >> $GITHUB_ENV
```

### 4.5 Pre-release Versions

Support for pre-release versions:
- `1.0.0-alpha.1` - Alpha releases
- `1.0.0-beta.1` - Beta releases  
- `1.0.0-rc.1` - Release candidates

Pre-release versions are marked as such in GitHub Releases.

---

## 5. Homebrew Distribution (macOS)

### 5.1 Homebrew Tap Repository

Create a separate repository: `MetalHexx/homebrew-TeensyROM`

This follows the standard Homebrew tap naming convention (`homebrew-<tap-name>`), allowing users to install with:
```bash
brew install MetalHexx/TeensyROM/teensyrom-web
```

### 5.2 Formula Structure

```ruby
# Formula/teensyrom-web.rb
class TeensyromWeb < Formula
  desc "TeensyROM device management and media playback application"
  homepage "https://github.com/MetalHexx/TeensyROM-Web"
  version "1.0.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-osx-arm64.tar.gz"
      sha256 "PLACEHOLDER_ARM64_SHA256"
    end
    on_intel do
      url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-osx-x64.tar.gz"
      sha256 "PLACEHOLDER_X64_SHA256"
    end
  end

  def install
    bin.install "TeensyRom.Api" => "teensyrom-web"
  end

  def caveats
    <<~EOS
      TeensyROM Web has been installed!

      To start the application:
        teensyrom-web

      Then open your browser to:
        http://localhost:5168

      For device access, you may need to grant serial port permissions.
    EOS
  end

  service do
    run [opt_bin/"teensyrom-web"]
    keep_alive true
    log_path var/"log/teensyrom-web.log"
    error_log_path var/"log/teensyrom-web.log"
  end

  test do
    assert_predicate bin/"teensyrom-web", :executable?
  end
end
```

### 5.3 Automated Formula Updates

The release workflow will automatically update the Homebrew formula:

```yaml
- name: Update Homebrew Formula
  if: success()
  env:
    HOMEBREW_TAP_TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}
  run: |
    # Calculate SHA256 for macOS artifacts
    SHA_ARM64=$(sha256sum TeensyROM-osx-arm64.tar.gz | cut -d' ' -f1)
    SHA_X64=$(sha256sum TeensyROM-osx-x64.tar.gz | cut -d' ' -f1)
    
    # Clone homebrew tap
    git clone https://x-access-token:${HOMEBREW_TAP_TOKEN}@github.com/MetalHexx/homebrew-TeensyROM.git
    cd homebrew-TeensyROM
    
    # Update formula with new version and SHA256
    sed -i "s/version \".*\"/version \"${VERSION}\"/" Formula/teensyrom-web.rb
    sed -i "s/PLACEHOLDER_ARM64_SHA256/${SHA_ARM64}/" Formula/teensyrom-web.rb
    sed -i "s/PLACEHOLDER_X64_SHA256/${SHA_X64}/" Formula/teensyrom-web.rb
    
    # Commit and push
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
    git add Formula/teensyrom-web.rb
    git commit -m "Update teensyrom to ${VERSION}"
    git push
```

### 5.4 User Installation Flow

```bash
# Install (tap is automatic)
brew install MetalHexx/TeensyROM/teensyrom-web

# Run
teensyrom-web

# Or run as a service (background)
brew services start teensyrom-web

# Update to latest
brew update && brew upgrade teensyrom-web
```

---

## 6. GitHub Actions Workflow

### 6.1 Complete Workflow File

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release (e.g., 1.0.0)'
        required: true
        type: string

env:
  DOTNET_VERSION: '9.0.x'
  NODE_VERSION: '20.x'

jobs:
  validate:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      is_prerelease: ${{ steps.version.outputs.is_prerelease }}
    steps:
      - name: Determine version
        id: version
        run: |
          if [ "${{ github.event_name }}" == "workflow_dispatch" ]; then
            VERSION="${{ github.event.inputs.version }}"
          else
            VERSION="${{ github.ref_name }}"
          fi
          VERSION="${VERSION#v}"  # Remove 'v' prefix
          
          # Validate semver format
          if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
            echo "::error::Invalid version format: $VERSION. Expected: X.Y.Z or X.Y.Z-suffix"
            exit 1
          fi
          
          # Check for pre-release
          if [[ "$VERSION" =~ -[a-zA-Z] ]]; then
            echo "is_prerelease=true" >> $GITHUB_OUTPUT
          else
            echo "is_prerelease=false" >> $GITHUB_OUTPUT
          fi
          
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "::notice::Building version $VERSION"

  build:
    needs: validate
    runs-on: ubuntu-latest
    strategy:
      matrix:
        include:
          - rid: win-x64
            artifact: TeensyROM-win-x64
            extension: zip
          - rid: osx-x64
            artifact: TeensyROM-osx-x64
            extension: tar.gz
          - rid: osx-arm64
            artifact: TeensyROM-osx-arm64
            extension: tar.gz
          - rid: linux-x64
            artifact: TeensyROM-linux-x64
            extension: tar.gz
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - name: Setup .NET
        uses: actions/setup-dotnet@v4
        with:
          dotnet-version: ${{ env.DOTNET_VERSION }}
      
      - name: Install frontend dependencies
        run: pnpm install --frozen-lockfile
        working-directory: src
      
      - name: Build frontend (production)
        run: pnpm nx build teensyrom-ui --configuration=production
        working-directory: src
      
      - name: Copy frontend to wwwroot
        run: |
          mkdir -p src/apps/api/src/TeensyRom.Api/wwwroot
          cp -r src/dist/apps/teensyrom-ui/browser/* src/apps/api/src/TeensyRom.Api/wwwroot/
      
      - name: Restore .NET dependencies
        run: dotnet restore
        working-directory: src/apps/api/src/TeensyRom.Api
      
      - name: Publish for ${{ matrix.rid }}
        run: |
          dotnet publish -c Release -r ${{ matrix.rid }} \
            --self-contained true \
            -p:PublishSingleFile=true \
            -p:Version=${{ needs.validate.outputs.version }} \
            -o ./publish/${{ matrix.rid }}
        working-directory: src/apps/api/src/TeensyRom.Api
      
      - name: Package (zip)
        if: matrix.extension == 'zip'
        run: |
          cd src/apps/api/src/TeensyRom.Api/publish/${{ matrix.rid }}
          zip -r ../../${{ matrix.artifact }}.zip .
      
      - name: Package (tar.gz)
        if: matrix.extension == 'tar.gz'
        run: |
          cd src/apps/api/src/TeensyRom.Api/publish/${{ matrix.rid }}
          chmod +x TeensyRom.Api
          tar -czvf ../../${{ matrix.artifact }}.tar.gz .
      
      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: src/apps/api/src/TeensyRom.Api/${{ matrix.artifact }}.${{ matrix.extension }}
          retention-days: 5

  release:
    needs: [validate, build]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    outputs:
      release_url: ${{ steps.create_release.outputs.upload_url }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts
          merge-multiple: true
      
      - name: List artifacts
        run: ls -la artifacts/
      
      - name: Create Release
        id: create_release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v${{ needs.validate.outputs.version }}
          name: TeensyROM v${{ needs.validate.outputs.version }}
          draft: false
          prerelease: ${{ needs.validate.outputs.is_prerelease }}
          generate_release_notes: true
          files: |
            artifacts/TeensyROM-win-x64.zip
            artifacts/TeensyROM-osx-x64.tar.gz
            artifacts/TeensyROM-osx-arm64.tar.gz
            artifacts/TeensyROM-linux-x64.tar.gz

  update-homebrew:
    needs: [validate, release]
    runs-on: ubuntu-latest
    if: needs.validate.outputs.is_prerelease == 'false'
    
    steps:
      - name: Download macOS artifacts
        uses: actions/download-artifact@v4
        with:
          pattern: TeensyROM-osx-*
          merge-multiple: true
      
      - name: Calculate SHA256
        id: sha
        run: |
          SHA_ARM64=$(sha256sum TeensyROM-osx-arm64.tar.gz | cut -d' ' -f1)
          SHA_X64=$(sha256sum TeensyROM-osx-x64.tar.gz | cut -d' ' -f1)
          echo "sha_arm64=$SHA_ARM64" >> $GITHUB_OUTPUT
          echo "sha_x64=$SHA_X64" >> $GITHUB_OUTPUT
      
      - name: Update Homebrew Formula
        env:
          HOMEBREW_TAP_TOKEN: ${{ secrets.HOMEBREW_TAP_TOKEN }}
          VERSION: ${{ needs.validate.outputs.version }}
          SHA_ARM64: ${{ steps.sha.outputs.sha_arm64 }}
          SHA_X64: ${{ steps.sha.outputs.sha_x64 }}
        run: |
          git clone https://x-access-token:${HOMEBREW_TAP_TOKEN}@github.com/MetalHexx/homebrew-TeensyROM.git
          cd homebrew-TeensyROM
          
          cat > Formula/teensyrom-web.rb << 'EOF'
          class TeensyromWeb < Formula
            desc "TeensyROM device management and media playback application"
            homepage "https://github.com/MetalHexx/TeensyROM-Web"
            version "${{ env.VERSION }}"
            license "MIT"

            on_macos do
              on_arm do
                url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v${{ env.VERSION }}/TeensyROM-osx-arm64.tar.gz"
                sha256 "${{ env.SHA_ARM64 }}"
              end
              on_intel do
                url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v${{ env.VERSION }}/TeensyROM-osx-x64.tar.gz"
                sha256 "${{ env.SHA_X64 }}"
              end
            end

            def install
              bin.install "TeensyRom.Api" => "teensyrom-web"
            end

            def caveats
              <<~EOS
                TeensyROM Web has been installed!

                To start the application:
                  teensyrom-web

                Then open your browser to:
                  http://localhost:5168
              EOS
            end

            test do
              assert_predicate bin/"teensyrom-web", :executable?
            end
          end
          EOF
          
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Formula/teensyrom-web.rb
          git commit -m "Update teensyrom-web to ${VERSION}"
          git push
```

### 6.2 Required Secrets

| Secret | Purpose |
|--------|---------|
| `HOMEBREW_TAP_TOKEN` | Personal Access Token with repo scope for homebrew-TeensyROM repo |

---

## 7. Phased Implementation

### Phase 0: Relative URL Migration 🎯
**Goal**: Remove hardcoded localhost URLs without breaking development

**Tasks**:
1. Create `IApiConfig` interface and `API_CONFIG` token in domain
2. Create `provideApiConfig()` factory using `isDevMode()`
3. Update all infrastructure providers to use injected config
4. Update SignalR services to use injected config
5. Update image URL builders to use injected config
6. Test: Dev server works, production build uses relative URLs

**Files to Modify**:
- `libs/domain/contracts/api-config.contract.ts` (new)
- `libs/infrastructure/config/api-config.provider.ts` (new)
- `libs/infrastructure/src/lib/device/providers.ts`
- `libs/infrastructure/src/lib/storage/providers.ts`
- `libs/infrastructure/src/lib/player/providers.ts`
- `libs/infrastructure/src/lib/settings/providers.ts`
- `libs/infrastructure/src/lib/device/device-logs.service.ts`
- `libs/infrastructure/src/lib/device/device-events.service.ts`
- `libs/infrastructure/src/lib/storage/storage.service.ts`
- `libs/infrastructure/src/lib/player/player.service.ts`

### Phase 1: API Static File Serving 🎯
**Goal**: API can serve Angular production build locally

**Tasks**:
1. Create `wwwroot` folder in API project
2. Update `Program.cs` to serve static files and SPA fallback
3. Add MSBuild target to copy frontend build output
4. Test locally: build frontend, copy to wwwroot, run API
5. Verify Angular app loads from API endpoint

**Testing**:
- Build frontend: `pnpm nx build teensyrom-ui --configuration=production`
- Copy output to wwwroot
- Run API: `dotnet run`
- Navigate to `http://localhost:5168` - Angular app loads
- All SPA routes work
- API endpoints continue to function
- SignalR hubs connect successfully

### Phase 2: Publishing Configuration 🎯
**Goal**: Single-file self-contained publish works for all platforms

**Tasks**:
1. Add publishing properties to `.csproj`
2. Update Nx target for `publish` with RID support
3. Test local publish for Windows
4. Verify executable runs without .NET installed

**Testing**:
- Publish: `dotnet publish -c Release -r win-x64 --self-contained`
- Copy to clean machine (or VM without .NET)
- Run executable
- Application works

### Phase 3: GitHub Actions Workflow 🎯
**Goal**: Automated releases on version tags

**Tasks**:
1. Create `.github/workflows/release.yml`
2. Define build matrix for all platforms
3. Configure artifact uploads
4. Configure release creation with auto-generated notes
5. Test with manual workflow trigger

**Testing**:
- Run workflow manually with version `1.0.0-alpha.1`
- Workflow runs successfully
- Release created with 4 platform artifacts
- Download and verify Windows artifact locally

### Phase 4: Homebrew Distribution 🎯
**Goal**: macOS users can install via Homebrew

**Tasks**:
1. Create `MetalHexx/homebrew-TeensyROM` repository
2. Create initial `Formula/teensyrom-web.rb` template
3. Add `HOMEBREW_TAP_TOKEN` secret to main repo
4. Test formula update workflow
5. Document installation process

**Testing**:
- Create test release
- Formula auto-updates
- `brew install MetalHexx/TeensyROM/teensyrom-web` works
- Application runs after install

---

## 8. Success Criteria

### Phase 0 Complete When:
- [ ] No hardcoded `localhost:5168` in infrastructure code
- [ ] Development (`pnpm start`) still works with API on 5168
- [ ] Production build uses relative URLs
- [ ] All unit tests pass

### Phase 1 Complete When:
- [ ] Angular production build served from API
- [ ] All SPA routes work (including deep links)
- [ ] API endpoints continue to function
- [ ] SignalR hubs connect successfully
- [ ] Asset serving (/Assets/*) still works

### Phase 2 Complete When:
- [ ] Single-file executable produced for Windows
- [ ] Executable runs on clean Windows (no .NET installed)
- [ ] All functionality works from published executable

### Phase 3 Complete When:
- [ ] GitHub Action triggers on version tag OR manual dispatch
- [ ] Version validated for semver format
- [ ] All 4 platform artifacts produced
- [ ] GitHub Release created automatically
- [ ] Pre-releases marked correctly

### Phase 4 Complete When:
- [ ] Homebrew tap repository (`MetalHexx/homebrew-TeensyROM`) exists
- [ ] Formula auto-updates on release
- [ ] `brew install MetalHexx/TeensyROM/teensyrom-web` works on macOS
- [ ] Intel and ARM Macs both work

---

## 9. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large binary size due to embedded assets | Medium | Accept for simplicity; monitor size |
| macOS Gatekeeper blocks unsigned app | Low | Document workaround in README/caveats |
| Native dependencies (SerialPort) | High | Test on each platform thoroughly |
| Angular routing conflicts with API routes | Medium | Ensure API routes are specific |
| Build matrix complexity | Medium | Start with Windows; add platforms incrementally |
| Relative URL breaks development | High | Use `isDevMode()` check; test thoroughly |

---

## 10. References

- [.NET Self-Contained Deployment](https://docs.microsoft.com/en-us/dotnet/core/deploying/self-contained)
- [ASP.NET Core Static Files](https://docs.microsoft.com/en-us/aspnet/core/fundamentals/static-files)
- [GitHub Actions Releases](https://docs.github.com/en/actions/publishing-packages)
- [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [Angular isDevMode](https://angular.io/api/core/isDevMode)
- [Semantic Versioning](https://semver.org/)

---

## Appendix A: File System Structure After Implementation

```
.github/
└── workflows/
    └── release.yml              # Release automation

TeensyRom.Api/
├── wwwroot/                     # Angular production build
│   ├── index.html
│   ├── main.abc123.js
│   ├── polyfills.def456.js
│   ├── styles.ghi789.css
│   └── assets/
│       └── ... (Angular assets)
├── Assets/                      # Embedded resources (existing)
│   └── ... (game images, etc.)
├── Program.cs                   # MODIFIED: Static file + SPA fallback
├── TeensyRom.Api.csproj         # MODIFIED: Publish configuration
└── ...

libs/domain/contracts/
└── api-config.contract.ts       # NEW: API configuration interface

libs/infrastructure/
├── config/
│   └── api-config.provider.ts   # NEW: Environment-based config
└── src/lib/
    ├── device/
    │   ├── providers.ts         # MODIFIED: Use API_CONFIG
    │   ├── device-logs.service.ts    # MODIFIED: Use API_CONFIG
    │   └── device-events.service.ts  # MODIFIED: Use API_CONFIG
    ├── storage/
    │   ├── providers.ts         # MODIFIED: Use API_CONFIG
    │   └── storage.service.ts   # MODIFIED: Use API_CONFIG
    ├── player/
    │   ├── providers.ts         # MODIFIED: Use API_CONFIG
    │   └── player.service.ts    # MODIFIED: Use API_CONFIG
    └── settings/
        └── providers.ts         # MODIFIED: Use API_CONFIG

# Separate repository: MetalHexx/homebrew-TeensyROM
homebrew-TeensyROM/
└── Formula/
    └── teensyrom-web.rb         # Homebrew formula
```

## Appendix B: Quick Reference Commands

```bash
# First release (alpha)
# Go to Actions → Release → Run workflow → Enter version "1.0.0-alpha.1"

# Manual release (from GitHub Actions UI)
# Go to Actions → Release → Run workflow → Enter version "1.2.0"

# Tag-based release
git tag v1.2.0
git push origin v1.2.0

# Pre-release
git tag v1.2.0-beta.1
git push origin v1.2.0-beta.1

# Homebrew installation
brew install MetalHexx/TeensyROM/teensyrom-web
teensyrom-web

# Update
brew update && brew upgrade teensyrom-web
```
