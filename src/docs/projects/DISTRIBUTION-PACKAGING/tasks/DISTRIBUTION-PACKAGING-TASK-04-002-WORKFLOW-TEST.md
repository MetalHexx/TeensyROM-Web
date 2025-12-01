# Task: Test Release Workflow

## 📋 Task Identity

**Task ID**: DISTRIBUTION-PACKAGING-TASK-04-002-WORKFLOW-TEST  
**Task Name**: Test Release Workflow with Alpha Version  
**Assigned To**: Backend Wizard (or Human)  
**Priority**: High  
**Estimated Complexity**: Small (manual testing)

---

## 🎯 Objective

**What**: Verify the release workflow executes correctly by triggering a test release with an alpha version tag.

**Why**: Confirm all 4 platform builds work, artifacts are packaged correctly, and GitHub Release is created properly before using for real releases.

**Success Criteria**:
- [ ] Git tag `v1.0.0-alpha.1` pushed successfully
- [ ] Workflow triggers automatically
- [ ] `validate` job extracts version `1.0.0-alpha.1`
- [ ] `validate` job detects pre-release (`is_prerelease=true`)
- [ ] All 4 `build` matrix jobs complete successfully
- [ ] `release` job creates GitHub Release
- [ ] Release has 4 attached artifacts:
  - `TeensyROM-win-x64.zip`
  - `TeensyROM-osx-x64.tar.gz`
  - `TeensyROM-osx-arm64.tar.gz`
  - `TeensyROM-linux-x64.tar.gz`
- [ ] Release is marked as "Pre-release"
- [ ] At least one artifact downloaded and tested (Windows recommended)

---

## 📂 Context & Dependencies

**Prerequisites Completed**:
- DISTRIBUTION-PACKAGING-TASK-04-001: Release workflow created and pushed

**Dependencies**:
- GitHub repository with Actions enabled
- Workflow file committed to `main` branch
- `.csproj` version should match or be close to test version

---

## 📝 Test Procedure

### Step 1: Verify Workflow Exists

1. Go to GitHub repository → Actions tab
2. Confirm "Release" workflow appears in the list
3. Click on it to verify no syntax errors

### Step 2: Update .csproj Version (Optional but Recommended)

If not already set, update the version to match what we're testing:

```xml
<Version>1.0.0-alpha.1</Version>
```

This ensures local dev builds match the release version.

### Step 3: Create and Push Tag

```bash
# Ensure you're on main with latest changes
git checkout main
git pull origin main

# Create tag
git tag v1.0.0-alpha.1

# Push tag (this triggers the workflow)
git push origin v1.0.0-alpha.1
```

### Step 4: Monitor Workflow Execution

1. Go to GitHub → Actions → Release workflow
2. Click on the running workflow
3. Monitor each job:
   - **validate**: Should complete in ~10 seconds
   - **build (4 jobs)**: Should complete in ~5-10 minutes each
   - **release**: Should complete in ~1 minute

### Step 5: Verify Release

1. Go to GitHub → Releases
2. Find `TeensyROM v1.0.0-alpha.1`
3. Verify:
   - [ ] Marked as "Pre-release"
   - [ ] Has 4 asset files attached
   - [ ] Release notes are generated

### Step 6: Test an Artifact

1. Download `TeensyROM-win-x64.zip`
2. Extract to a folder
3. Run `TeensyRom.Api.exe`
4. Open browser to `http://localhost:5168`
5. Verify:
   - [ ] App loads
   - [ ] Version in header shows `v1.0.0-alpha.1`
   - [ ] Basic navigation works

### Step 7: Cleanup (Optional)

If this was just a test and you want to clean up:

```bash
# Delete local tag
git tag -d v1.0.0-alpha.1

# Delete remote tag
git push origin --delete v1.0.0-alpha.1
```

Then delete the release from GitHub Releases page.

**Note**: If this is the actual first release, keep it!

---

## ⏱️ Expected Timeline

| Job | Expected Duration |
|-----|-------------------|
| validate | ~10 seconds |
| build (per platform) | 5-10 minutes |
| build (total, parallel) | 5-10 minutes |
| release | ~1 minute |
| **Total** | **~10-15 minutes** |

---

## 🚨 Troubleshooting

### Workflow doesn't trigger
- Verify tag starts with `v` (e.g., `v1.0.0`, not `1.0.0`)
- Verify workflow file is in `main` branch
- Check Actions tab for any disabled workflows

### Build fails
- Check build logs for specific error
- Common issues:
  - pnpm install failures (network, lockfile mismatch)
  - nx build failures (TypeScript errors)
  - dotnet publish failures (missing dependencies)

### Artifacts not attached
- Check `release` job logs
- Verify artifact names match expected pattern
- Check `upload-artifact` step completed successfully

### Pre-release not detected
- Verify version contains `-` (e.g., `1.0.0-alpha.1`)
- Check `validate` job outputs

---

## 📤 Output

**Output Report Location**: `docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-04-002-REPORT.md`

**Deliverables**:
1. Confirmation that workflow executed successfully
2. Screenshots or logs of key verification steps
3. Notes on any issues encountered and how they were resolved
4. Confirmation that at least one artifact was tested locally
