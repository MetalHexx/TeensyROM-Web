# Phase 05: Homebrew Distribution

## 🎯 Objective

Enable macOS users to install TeensyROM via Homebrew with automatic updates when new versions are released.

**Value Delivered**: One-command installation for macOS users with standard package manager integration.

**Prerequisite**: Phase 04 (GitHub Actions) must be complete.

---

## 📚 Required Reading

- [ ] [DISTRIBUTION_PACKAGING_PLAN.md](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 5
- [ ] [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)
- [ ] [Homebrew Taps](https://docs.brew.sh/Taps)

---

## 📂 File Structure Overview

```
# In SEPARATE repository: MetalHexx/homebrew-TeensyROM

homebrew-TeensyROM/
├── README.md                                ✨ New - Tap documentation
└── Formula/
    └── teensyrom-web.rb                     ✨ New - Homebrew formula
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Create Homebrew Tap Repository</h3></summary>

**Purpose**: Set up the Homebrew tap repository with initial formula structure.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-05-001-HOMEBREW-TAP-SETUP`

**Implementation Subtasks**:

- [ ] Create new GitHub repository: `MetalHexx/homebrew-TeensyROM`
- [ ] Add `README.md` with installation instructions
- [ ] Create `Formula/` directory
- [ ] Create initial `teensyrom-web.rb` formula with placeholder SHA256
- [ ] Configure repository visibility (public for Homebrew)

**Formula Structure**:

The formula should include:
- Package metadata (description, homepage, license)
- Platform-specific URLs (ARM64 vs x64)
- Installation instructions
- User-facing caveats
- Basic test to verify installation

**Key Formula Elements**:
- `on_macos do` block for macOS-specific config
- `on_arm` and `on_intel` blocks for architecture-specific URLs
- `service` block for optional background service support
- `caveats` for post-install user instructions

**Repository README Content**:
```markdown
# TeensyROM Homebrew Tap

This is a Homebrew tap for TeensyROM Web application.

## Installation

brew install MetalHexx/TeensyROM/teensyrom-web

## Usage

teensyrom-web

Then open http://localhost:5168 in your browser.

## Updating

brew update && brew upgrade teensyrom-web
```

**Testing Subtask**:
- [ ] Repository created and publicly accessible
- [ ] Formula file has valid Ruby syntax
- [ ] README provides clear installation instructions

</details>

---

<details open>
<summary><h3>Task 2: Configure Automatic Formula Updates</h3></summary>

**Purpose**: Enable the release workflow to automatically update the Homebrew formula with new versions.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-05-002-FORMULA-UPDATE-AUTOMATION`

**Implementation Subtasks**:

- [ ] Create Personal Access Token (PAT) with repo scope
- [ ] Add `HOMEBREW_TAP_TOKEN` secret to main TeensyROM-Web repository
- [ ] Verify `update-homebrew` job in release workflow (from Phase 04)
- [ ] Test with a non-prerelease version
- [ ] Verify formula is updated in tap repository

**PAT Configuration**:
- Scope: `repo` (full control of private repositories)
- Name: `HOMEBREW_FORMULA_UPDATE`
- No expiration (or long expiration)
- Store as repository secret: `HOMEBREW_TAP_TOKEN`

**Workflow Integration**:

The `update-homebrew` job (from Phase 04) should:
1. Download macOS artifacts
2. Calculate SHA256 checksums
3. Clone tap repository using PAT
4. Update formula with new version and checksums
5. Commit and push changes

**Testing Subtask**:

Full integration test:
1. Trigger release workflow with version `1.0.0` (non-prerelease)
2. Verify `update-homebrew` job runs (not skipped)
3. Check tap repository for updated formula
4. Run `brew install MetalHexx/TeensyROM/teensyrom-web` on macOS
5. Verify application installs and runs

</details>

---

## 🗂️ Files Modified or Created

**In homebrew-TeensyROM repository**:
- `README.md` - Tap documentation
- `Formula/teensyrom-web.rb` - Homebrew formula

**In TeensyROM-Web repository**:
- Repository secret: `HOMEBREW_TAP_TOKEN`

---

## 📝 Testing Summary

**Formula Testing** (on macOS):

1. Add tap: `brew tap MetalHexx/TeensyROM`
2. Install: `brew install teensyrom-web`
3. Run: `teensyrom-web`
4. Verify app starts and serves on port 5168

**Update Testing**:
1. Create a test release (e.g., `1.0.1`)
2. Verify formula auto-updates in tap repo
3. Run `brew update && brew upgrade teensyrom-web`
4. Verify new version installed

---

## ✅ Success Criteria

- [ ] `MetalHexx/homebrew-TeensyROM` repository exists and is public
- [ ] `Formula/teensyrom-web.rb` contains valid Homebrew formula
- [ ] `HOMEBREW_TAP_TOKEN` secret configured in main repository
- [ ] Release workflow successfully updates formula (non-prerelease only)
- [ ] `brew install MetalHexx/TeensyROM/teensyrom-web` works on macOS
- [ ] Application runs after Homebrew installation
- [ ] Both Intel and Apple Silicon Macs are supported
- [ ] README provides clear user instructions

---

## 📝 Notes & Considerations

### Why a Separate Tap Repository?

Homebrew requires formulas in a repo named `homebrew-<tapname>`:
- Enables `brew install user/tapname/formula` syntax
- Follows Homebrew naming conventions
- Allows independent versioning of formulas

### Platform-Specific URLs

The formula uses `on_arm` and `on_intel` blocks:
- Apple Silicon (M1/M2/M3): Downloads `osx-arm64.tar.gz`
- Intel Macs: Downloads `osx-x64.tar.gz`
- Homebrew detects architecture automatically

### SHA256 Checksums

Homebrew requires SHA256 checksums for security:
- Calculated from release artifacts
- Updated automatically by workflow
- Prevents tampering with downloads

### Pre-release Versions

Pre-releases (e.g., `1.0.0-beta.1`) skip Homebrew update:
- Users should test pre-releases manually
- Formula always points to latest stable
- Prevents accidental unstable installations

### Serial Port Permissions

macOS may require additional permissions for serial ports:
- User may need to approve app in System Preferences
- Consider adding instructions to caveats

### Caveats

The formula's caveats section displays after installation:
```
TeensyROM Web has been installed!

To start the application:
  teensyrom-web

Then open your browser to:
  http://localhost:5168
```

### Future Enhancement: Homebrew Service

Formula includes optional service support:
- `brew services start teensyrom-web` for background running
- Logs to `/usr/local/var/log/teensyrom-web.log`
- Auto-restarts on reboot

### Alternative: Homebrew Cask

For GUI apps, Homebrew Cask is sometimes preferred:
- Cask is for apps with GUI (.app bundles)
- TeensyROM is a web server, so regular formula is appropriate
- If future version adds native GUI, consider Cask
