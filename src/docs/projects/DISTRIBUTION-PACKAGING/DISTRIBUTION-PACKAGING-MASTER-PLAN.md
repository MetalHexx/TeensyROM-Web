# Distribution Packaging Master Plan

**Project Name**: DISTRIBUTION-PACKAGING  
**Status**: 📋 Planning  
**Created**: 2025-11-30  
**Last Updated**: 2025-11-30

---

## 🎯 Project Objective

Create a single, self-contained executable distribution for Windows, Mac, and Linux that eliminates the need for end users to have development tools installed.

**Problem Statement**: Currently, running TeensyROM requires .NET 9 SDK, Node.js/pnpm, and running two separate servers. This creates a high barrier for non-technical users.

**Solution**: Bundle the .NET API with the production Angular frontend into a single executable that:
- Serves the Angular SPA directly from the API
- Requires no external dependencies (self-contained .NET runtime)
- Runs as a single process
- Distributes via GitHub Releases and Homebrew (macOS)

**User Experience Goal**:
```
# Windows/Linux: Download zip, extract, run exe, open browser
# macOS: brew install MetalHexx/TeensyROM/teensyrom-web && teensyrom-web
```

---

## 📋 Implementation Phases

| Phase | Name | Description | Agent | Status |
|-------|------|-------------|-------|--------|
| 01 | Relative URL Migration | Remove hardcoded localhost:5168 URLs from infrastructure | UI Wizard | ✅ Complete |
| 02 | API Static File Serving | Configure .NET API to serve Angular production build | Backend Wizard | ✅ Complete |
| 03 | Publishing Configuration | Self-contained single-file publish for all platforms | Backend Wizard | 📋 Planning |
| 04 | GitHub Actions Workflow | Automated release pipeline with semantic versioning | Backend Wizard | ⏳ Pending |
| 05 | Homebrew Distribution | macOS distribution via Homebrew tap | Backend Wizard | ⏳ Pending |
| 06 | Documentation | Create distribution docs and update README | Documentation | ⏳ Pending |

---

## 🏗️ Architecture Overview

### Build Pipeline

```
Angular Source → nx build (prod) → dist/apps/teensyrom-ui/browser
                                           ↓
                                   Copy to API wwwroot
                                           ↓
                              dotnet publish (self-contained)
                                           ↓
                    ┌──────────┬──────────┬──────────┐
                    ↓          ↓          ↓          ↓
             win-x64.zip  osx-x64.tar  osx-arm64.tar  linux-x64.tar
```

### Static File Serving

The API serves both:
1. **API Routes**: `/devices/*`, `/files/*`, `/player/*` (RadEndpoints)
2. **SignalR Hubs**: `/logHub`, `/deviceEventHub`
3. **Static Files**: Angular production build from `wwwroot/`
4. **SPA Fallback**: Unknown routes → `index.html` (Angular routing)

### Key Design Decisions

1. **`isDevMode()` for URL switching**: Angular's built-in function distinguishes dev vs prod builds without environment files
2. **API_CONFIG injection token**: Centralized configuration pattern aligns with Clean Architecture
3. **SPA fallback routing**: API routes take precedence, unknown routes serve Angular
4. **Self-contained publish**: Bundles .NET runtime for zero-dependency distribution

---

## 📊 Phase Dependencies

```
Phase 01 (Relative URLs)
    ↓
Phase 02 (Static Files) ← depends on Phase 01 for production builds
    ↓
Phase 03 (Publishing) ← depends on Phase 02 for complete executable
    ↓
Phase 04 (GitHub Actions) ← depends on Phase 03 for build process
    ↓
Phase 05 (Homebrew) ← depends on Phase 04 for release artifacts
    ↓
Phase 06 (Documentation) ← depends on all phases for accurate instructions
```

**Critical Path**: Phases must be executed sequentially. Each phase builds on the previous.

---

## 🧪 Testing Strategy

### Phase 01 Testing
- Verify all API routes respond at `/api/*` paths
- Verify development server still works with `pnpm start`
- Verify production build uses relative URLs (inspect network requests)
- All existing unit tests pass

### Phase 02 Testing
- Build frontend production, copy to wwwroot, run API
- Angular app loads from `http://localhost:5168`
- SPA routes work (deep links like `/player/music`)
- API endpoints and SignalR hubs function correctly

### Phase 03 Testing
- Publish for Windows, run on machine without .NET installed
- Application starts and serves Angular app
- All device functionality works

### Phase 04 Testing
- Manual workflow trigger with test version (e.g., `1.0.0-alpha.1`)
- All 4 platform artifacts produced
- GitHub Release created correctly

### Phase 05 Testing
- Formula updates automatically after release
- `brew install MetalHexx/TeensyROM/teensyrom-web` works
- Application runs after Homebrew install

### Phase 06 Testing
- DISTRIBUTION.md contains complete installation instructions
- README.md updated with release download links
- Instructions work for Windows, macOS, and Linux
- Links to GitHub Releases are correct

---

## ✅ Success Criteria

### Project Complete When:

- [x] **Phase 01**: No hardcoded `localhost:5168` in infrastructure; dev still works
- [x] **Phase 02**: API serves Angular production build with correct routing
- [ ] **Phase 03**: Single-file executable runs on Windows without .NET SDK
- [ ] **Phase 04**: GitHub Actions creates releases for all 4 platforms
- [ ] **Phase 05**: Homebrew installation works on macOS (Intel + ARM)
- [ ] **Phase 06**: DISTRIBUTION.md created with complete instructions
- [ ] **Phase 06**: README.md updated with installation instructions for all platforms

---

## 📁 Key Files Affected

### Phase 01 - Frontend (Infrastructure Layer)
| File | Change |
|------|--------|
| `libs/domain/src/lib/contracts/api-config.contract.ts` | NEW - API configuration interface |
| `libs/infrastructure/src/lib/config/api-config.provider.ts` | NEW - Environment-based provider |
| `libs/infrastructure/src/lib/device/providers.ts` | MODIFY - Use API_CONFIG |
| `libs/infrastructure/src/lib/storage/providers.ts` | MODIFY - Use API_CONFIG |
| `libs/infrastructure/src/lib/player/providers.ts` | MODIFY - Use API_CONFIG |
| `libs/infrastructure/src/lib/settings/providers.ts` | MODIFY - Use API_CONFIG |
| `libs/infrastructure/src/lib/device/device-logs.service.ts` | MODIFY - Use API_CONFIG |
| `libs/infrastructure/src/lib/device/device-events.service.ts` | MODIFY - Use API_CONFIG |

### Phase 02 - Backend (.NET API)
| File | Change |
|------|--------|
| `apps/api/src/TeensyRom.Api/wwwroot/` | NEW - Directory for Angular build |
| `apps/api/src/TeensyRom.Api/Program.cs` | MODIFY - Static files + SPA fallback |

### Phase 03 - Backend (Publishing)
| File | Change |
|------|--------|
| `apps/api/src/TeensyRom.Api/TeensyRom.Api.csproj` | MODIFY - Publish settings |

### Phase 04 - DevOps
| File | Change |
|------|--------|
| `.github/workflows/release.yml` | NEW - Release automation |

### Phase 05 - External
| Repository | Change |
|------------|--------|
| `MetalHexx/homebrew-TeensyROM` | NEW - Homebrew tap with formula |

### Phase 06 - Documentation
| File | Change |
|------|--------|
| `docs/DISTRIBUTION.md` | NEW - Complete distribution/installation guide |
| `README.md` (root repo) | MODIFY - Add installation section |

---

## 🚨 Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Relative URL breaks development | High | Medium | Use `isDevMode()` check; test thoroughly |
| Large binary size | Medium | Low | Accept for simplicity; monitor size |
| Native SerialPort dependencies | High | Low | Test on each platform before release |
| macOS Gatekeeper blocks app | Low | Medium | Document workaround in caveats |
| Angular routing conflicts with API | High | High | Add `/api/` prefix to all backend routes |

---

## 📚 Related Documentation

- **Source Plan**: [DISTRIBUTION_PACKAGING_PLAN.md](../../features/DISTRIBUTION_PACKAGING_PLAN.md)
- **Backend Architecture**: [BACKEND_ARCHITECTURE.md](../../BACKEND_ARCHITECTURE.md)
- **Clean Architecture**: [OVERVIEW_CONTEXT.md](../../OVERVIEW_CONTEXT.md)
- **Domain Standards**: [DOMAIN_STANDARDS.md](../../DOMAIN_STANDARDS.md)
- **Service Standards**: [SERVICE_STANDARDS.md](../../SERVICE_STANDARDS.md)

---

## 📋 Task Summary by Phase

### Phase 01: Relative URL Migration (5 tasks)
| Task ID | Name | Description |
|---------|------|-------------|
| DISTRIBUTION-PACKAGING-TASK-01-000 | API-ROUTE-PREFIX | Add /api/ prefix to all backend routes |
| DISTRIBUTION-PACKAGING-TASK-01-001 | API-CONFIG-CONTRACT | Create domain contract and injection token |
| DISTRIBUTION-PACKAGING-TASK-01-002 | API-CONFIG-PROVIDER | Create environment-based provider factory |
| DISTRIBUTION-PACKAGING-TASK-01-003 | UPDATE-PROVIDERS | Update all API client providers |
| DISTRIBUTION-PACKAGING-TASK-01-004 | UPDATE-SIGNALR-SERVICES | Update SignalR hub URLs |

### Phase 02: API Static File Serving (2 tasks)
| Task ID | Name | Description |
|---------|------|-------------|
| DISTRIBUTION-PACKAGING-TASK-02-001 | STATIC-FILES-CONFIG | Configure ASP.NET Core static file middleware |
| DISTRIBUTION-PACKAGING-TASK-02-002 | BUILD-INTEGRATION | Create build script for frontend → wwwroot copy |

### Phase 03: Publishing Configuration (2 tasks)
| Task ID | Name | Description |
|---------|------|-------------|
| DISTRIBUTION-PACKAGING-TASK-03-001 | CSPROJ-PUBLISH-SETTINGS | Add self-contained publish properties |
| DISTRIBUTION-PACKAGING-TASK-03-002 | LOCAL-PUBLISH-TEST | Test local publish and verify functionality |

### Phase 04: GitHub Actions Workflow (2 tasks)
| Task ID | Name | Description |
|---------|------|-------------|
| DISTRIBUTION-PACKAGING-TASK-04-001 | RELEASE-WORKFLOW | Create complete release.yml workflow |
| DISTRIBUTION-PACKAGING-TASK-04-002 | WORKFLOW-TEST | Test workflow with alpha release |

### Phase 05: Homebrew Distribution (2 tasks)
| Task ID | Name | Description |
|---------|------|-------------|
| DISTRIBUTION-PACKAGING-TASK-05-001 | HOMEBREW-TAP-SETUP | Create homebrew-TeensyROM repository |
| DISTRIBUTION-PACKAGING-TASK-05-002 | FORMULA-UPDATE-AUTOMATION | Configure automatic formula updates |

### Phase 06: Documentation (2 tasks)
| Task ID | Name | Description |
|---------|------|-------------|
| DISTRIBUTION-PACKAGING-TASK-06-001 | DISTRIBUTION-DOCS | Create docs/DISTRIBUTION.md with complete guide |
| DISTRIBUTION-PACKAGING-TASK-06-002 | README-UPDATE | Update root README.md with installation instructions |

---

## 🚀 Execution Order

**Start**: DISTRIBUTION-PACKAGING-TASK-01-000 (API Route Prefix) ← **Backend Wizard**

Execute phases sequentially. Within each phase, tasks proceed in order as listed.

**Phase 01 Execution**:
1. TASK-01-000: Add /api/ prefix (Backend) ← **BLOCKING: Must complete first**
2. TASK-01-001: API Config Contract (Frontend)
3. TASK-01-002: API Config Provider (Frontend)
4. TASK-01-003: Update Providers (Frontend)
5. TASK-01-004: Update SignalR Services (Frontend)

**Estimated Total Tasks**: 15 tasks across 6 phases
