# Task: Integrate Formula Updates into Release Workflow

## 📋 Task Identity

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-05-002-WORKFLOW-FORMULA-UPDATE`  
**Task Name**: Add Homebrew Formula Updates to Release Workflow  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `c:\dev\src\TeensyROM-Web\src\.github\chatmodes\backend-wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Medium (workflow modification)

---

## 🎯 Objective

**What**: Modify the GitHub Actions release workflow to automatically update the Homebrew formula with correct version and SHA256 checksums when a stable release is created.

**Why**: Manual formula updates are error-prone. Automating this ensures macOS users can always install the latest stable version via Homebrew.

**Success Criteria**:
- [ ] Workflow calculates SHA256 for both macOS artifacts
- [ ] Workflow updates formula file with version and SHA256 values
- [ ] Workflow commits formula changes before creating release
- [ ] Pre-releases skip formula update (formula always points to stable)
- [ ] Stable release successfully updates formula

---

## 📚 Required Reading

Before starting, review:

- [ ] [Phase 05 Document](../phases/DISTRIBUTION-PACKAGING-PHASE-05-HOMEBREW.md) - Phase context
- [ ] [Task 05-001 Report](../reports/DISTRIBUTION-PACKAGING-TASK-05-001-REPORT.md) - Formula structure
- [ ] [TeensyROM-CLI Workflow](https://github.com/MetalHexx/TeensyROM-CLI/blob/main/.github/workflows/cli-cicd.yml) - Reference (x64 only)
- [ ] Current `release.yml` workflow

---

## 🔗 Context & Dependencies

**Prerequisites Completed**:
- ✅ Task 05-001: `Formula/teensyrom-web.rb` created with placeholder values
- ✅ Phase 04: Release workflow creates GitHub releases with artifacts
- ✅ Artifacts: `TeensyROM-Web-{version}-osx-arm64.tar.gz` and `TeensyROM-Web-{version}-osx-x64.tar.gz`

**Key Difference from CLI**:
- CLI workflow: Single architecture (x64), update one SHA256
- Web workflow: Dual architecture (ARM64 + x64), update two SHA256 values

**Constraints**:
- Formula update must happen BEFORE release is created (so formula points to valid artifacts)
- Must handle matrix build (SHA256 calculated on separate runners)
- Must skip formula update for pre-releases

---

## 📁 File Scope

**Files to Modify**:
- `.github/workflows/release.yml` - Add formula update steps

**Files Referenced**:
- `Formula/teensyrom-web.rb` - Target of updates (created in Task 05-001)

---

## 🛠️ Implementation Guidance

### Workflow Architecture Challenge

The current workflow uses matrix builds:
```
validate → build (4 parallel: win-x64, osx-x64, osx-arm64, linux-x64) → release
```

**Challenge**: SHA256 values are calculated on different runners during matrix build. Need to:
1. Pass SHA256 values from build jobs to a formula update step
2. Update formula before release is created

### Recommended Approach

Add a new job between `build` and `release`:

```
validate → build (matrix) → update-formula → release
                                  ↓
                    (only for stable releases)
                    1. Download osx artifacts
                    2. Calculate SHA256
                    3. Update formula
                    4. Commit and push
```

### Implementation Steps

#### 1. Add `update-formula` Job

```yaml
update-formula:
  name: Update Homebrew Formula
  needs: [validate, build]
  if: needs.validate.outputs.is_prerelease == 'false'
  runs-on: ubuntu-latest
  permissions:
    contents: write
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      with:
        token: ${{ secrets.GITHUB_TOKEN }}
    
    - name: Download macOS artifacts
      uses: actions/download-artifact@v4
      with:
        pattern: TeensyROM-Web-*-osx-*
        path: artifacts
        merge-multiple: true
    
    - name: Calculate SHA256 checksums
      id: sha256
      run: |
        VERSION="${{ needs.validate.outputs.version }}"
        SHA_ARM64=$(sha256sum artifacts/TeensyROM-Web-${VERSION}-osx-arm64.tar.gz | cut -d ' ' -f1)
        SHA_X64=$(sha256sum artifacts/TeensyROM-Web-${VERSION}-osx-x64.tar.gz | cut -d ' ' -f1)
        echo "arm64=$SHA_ARM64" >> $GITHUB_OUTPUT
        echo "x64=$SHA_X64" >> $GITHUB_OUTPUT
        echo "ARM64 SHA256: $SHA_ARM64"
        echo "x64 SHA256: $SHA_X64"
    
    - name: Update Homebrew formula
      run: |
        VERSION="${{ needs.validate.outputs.version }}"
        FORMULA="Formula/teensyrom-web.rb"
        
        # Update version
        sed -i 's/version ".*"/version "'$VERSION'"/' $FORMULA
        
        # Update ARM64 SHA256 (in on_arm block)
        sed -i '/on_arm do/,/end/ s/sha256 ".*"/sha256 "${{ steps.sha256.outputs.arm64 }}"/' $FORMULA
        
        # Update x64 SHA256 (in on_intel block)  
        sed -i '/on_intel do/,/end/ s/sha256 ".*"/sha256 "${{ steps.sha256.outputs.x64 }}"/' $FORMULA
        
        echo "Updated formula:"
        cat $FORMULA
    
    - name: Commit formula changes
      run: |
        git config user.name "github-actions[bot]"
        git config user.email "github-actions[bot]@users.noreply.github.com"
        git add Formula/teensyrom-web.rb
        git commit -m "chore: update Homebrew formula for v${{ needs.validate.outputs.version }}"
        git push
```

#### 2. Update `release` Job Dependency

The release job should wait for formula update:

```yaml
release:
  name: Create GitHub Release
  needs: [validate, build, update-formula]
  if: always() && needs.build.result == 'success'
  # ... rest of release job
```

Note: Use `if: always()` with explicit check so release still happens if formula update is skipped (pre-releases).

### Handling Pre-releases

The `update-formula` job has:
```yaml
if: needs.validate.outputs.is_prerelease == 'false'
```

This means:
- Stable releases (`v1.0.0`): Formula is updated, then release is created
- Pre-releases (`v1.0.0-alpha.1`): Formula update is skipped, release is created

### sed Command Explanation

The formula has this structure:
```ruby
  on_arm do
    url "..."
    sha256 "PLACEHOLDER_SHA256_ARM64"
  end

  on_intel do
    url "..."
    sha256 "PLACEHOLDER_SHA256_X64"
  end
```

The sed commands:
- `/on_arm do/,/end/` - Match lines between `on_arm do` and the next `end`
- `s/sha256 ".*"/sha256 "NEW_VALUE"/` - Replace SHA256 line within that range

---

## ⚠️ Anti-Patterns to Avoid

1. **Don't update formula AFTER release** - Artifacts must exist when formula points to them
2. **Don't update formula for pre-releases** - Formula should always point to stable
3. **Don't fail release if formula update fails** - Consider using `continue-on-error` if needed
4. **Don't forget to checkout with write permissions** - Need `contents: write` for push

---

## 🧪 Testing

### Test with Pre-release

1. Create pre-release: `git tag v1.0.1-beta.1 && git push origin v1.0.1-beta.1`
2. Verify `update-formula` job is **skipped**
3. Verify release is created without formula changes

### Test with Stable Release

1. Update `.csproj` version to `1.0.1` (or next stable version)
2. Commit and tag: `git tag v1.0.1 && git push origin v1.0.1`
3. Monitor workflow:
   - Verify `update-formula` job **runs**
   - Verify SHA256 values are calculated
   - Verify formula is committed
   - Verify release is created
4. Check `Formula/teensyrom-web.rb` has correct version and SHA256 values
5. Test on macOS:
   ```bash
   brew tap MetalHexx/TeensyROM-Web
   brew install teensyrom-web
   teensyrom-web --version
   ```

---

## 📤 Deliverables

1. **Modified `.github/workflows/release.yml`** with formula update job
2. **Completion report** documenting:
   - Changes made to workflow
   - Test results
   - Any issues encountered

---

## 📝 Report Requirements

Save completion report to:
```
docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-05-002-REPORT.md
```

Include in report:
- Complete YAML of new `update-formula` job
- Changes to `release` job dependencies
- Test results (if able to test)
- Known limitations or edge cases
