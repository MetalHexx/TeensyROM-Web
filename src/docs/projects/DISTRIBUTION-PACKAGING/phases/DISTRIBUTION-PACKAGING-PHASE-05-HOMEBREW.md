# Phase 05: Homebrew Distribution

## 🎯 Objective

Enable macOS users to install TeensyROM via Homebrew with automatic updates when new versions are released.

**Value Delivered**: One-command installation for macOS users with standard package manager integration.

**Prerequisite**: Phase 04 (GitHub Actions) must be complete.

---

## 🔑 Key Design Decisions

### Self-Hosted Tap (Same Repository)
- **Formula lives in `Formula/teensyrom-web.rb`** within TeensyROM-Web repository
- **No separate repository needed** - same approach as TeensyROM-CLI
- **No PAT required** - workflow commits directly to same repo using `GITHUB_TOKEN`
- **Install command**: `brew install MetalHexx/TeensyROM-Web/teensyrom-web`

### Dual Architecture Support
Unlike TeensyROM-CLI (x64 only), TeensyROM-Web supports both:
- **Apple Silicon (M1/M2/M3)**: `osx-arm64.tar.gz`
- **Intel Macs**: `osx-x64.tar.gz`

Formula uses `on_arm` and `on_intel` blocks for platform-specific downloads.

### Workflow Integration
- **Formula updated BEFORE release** - SHA256 calculated from built artifact
- **Commit includes formula update** - then release is created
- **Stable releases only** - pre-releases skip formula update

---

## 📚 Required Reading

- [ ] [DISTRIBUTION_PACKAGING_PLAN.md](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Section 5
- [ ] [TeensyROM-CLI workflow](https://github.com/MetalHexx/TeensyROM-CLI/blob/main/.github/workflows/cli-cicd.yml) - Reference implementation
- [ ] [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook)

---

## 📂 File Structure Overview

```
# In THIS repository: MetalHexx/TeensyROM-Web

Formula/
└── teensyrom-web.rb                         ✨ New - Homebrew formula

.github/
└── workflows/
    └── release.yml                          📝 Modify - Add formula update step
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Create Homebrew Formula</h3></summary>

**Purpose**: Create the Homebrew formula file with dual architecture support.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-05-001-HOMEBREW-FORMULA`

**Task Document**: [DISTRIBUTION-PACKAGING-TASK-05-001-HOMEBREW-FORMULA.md](../tasks/DISTRIBUTION-PACKAGING-TASK-05-001-HOMEBREW-FORMULA.md)

**Implementation Subtasks**:

- [ ] Create `Formula/teensyrom-web.rb` with:
  - Dual architecture support (`on_arm` + `on_intel` blocks)
  - Placeholder SHA256 checksums and version
  - Install instructions (binary → `teensyrom-web` command)
  - Post-install caveats with usage instructions
  - Basic test block
- [ ] Verify formula syntax locally if possible

**Formula Requirements**:
- Class name: `TeensyromWeb`
- File name: `teensyrom-web.rb`
- Binary install: `TeensyRom.Api` → `teensyrom-web`
- Supports both ARM64 and x64 macOS

</details>

---

<details open>
<summary><h3>Task 2: Integrate Formula Updates into Workflow</h3></summary>

**Purpose**: Modify the release workflow to update the formula with correct SHA256 and version before creating the release.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-05-002-WORKFLOW-FORMULA-UPDATE`

**Task Document**: [DISTRIBUTION-PACKAGING-TASK-05-002-WORKFLOW-FORMULA-UPDATE.md](../tasks/DISTRIBUTION-PACKAGING-TASK-05-002-WORKFLOW-FORMULA-UPDATE.md)

**Implementation Subtasks**:

- [ ] Modify `.github/workflows/release.yml` to:
  - Calculate SHA256 for both macOS artifacts after packaging
  - Update formula file with version and SHA256 values
  - Commit formula changes before creating release
  - Skip formula update for pre-releases
- [ ] Test with a stable release

**Workflow Changes**:
- Add step in macOS build jobs to calculate SHA256
- Add step to update formula file using `sed`
- Add step to commit and push formula changes
- Condition: only for stable releases (`is_prerelease == 'false'`)

</details>

---

## 🗂️ Files Modified or Created

**New Files**:
- `Formula/teensyrom-web.rb` - Homebrew formula (in TeensyROM-Web repo)

**Modified Files**:
- `.github/workflows/release.yml` - Add formula update steps

---

## 📝 Testing Summary

**Formula Testing** (on macOS):

1. Add tap: `brew tap MetalHexx/TeensyROM-Web`
2. Install: `brew install teensyrom-web`
3. Run: `teensyrom-web`
4. Verify app starts and serves on port 5168

**Update Testing**:
1. Create a stable release (e.g., `v1.0.0`)
2. Verify formula is updated in same commit
3. Run `brew update && brew upgrade teensyrom-web`
4. Verify new version installed

---

## ✅ Success Criteria

- [ ] `Formula/teensyrom-web.rb` exists in TeensyROM-Web repository
- [ ] Formula has valid Ruby syntax
- [ ] Formula supports both ARM64 and x64 macOS
- [ ] Release workflow updates formula for stable releases
- [ ] Pre-releases skip formula update
- [ ] `brew install MetalHexx/TeensyROM-Web/teensyrom-web` works on macOS
- [ ] Application runs after Homebrew installation
- [ ] Both Intel and Apple Silicon Macs are supported

---

## 📝 Notes & Considerations

### Self-Hosted Tap vs Separate Repository

**This project uses self-hosted tap** (same as TeensyROM-CLI):
- Formula lives in `Formula/` directory within main repository
- Homebrew can use any GitHub repo with `Formula/` as a tap
- User command: `brew install MetalHexx/TeensyROM-Web/teensyrom-web`
- Simpler than separate `homebrew-*` repository approach
- No PAT needed - uses `GITHUB_TOKEN` for same-repo commits

### Dual Architecture Support

Unlike TeensyROM-CLI (x64 only), this formula needs both:
- `on_arm` block for Apple Silicon (M1/M2/M3)
- `on_intel` block for Intel Macs
- Each has its own URL and SHA256 checksum

### Workflow Timing

**Important**: Formula must be updated BEFORE the release is created:
1. Build macOS artifacts
2. Calculate SHA256 checksums
3. Update formula file with version + SHA256
4. Commit formula changes
5. Create GitHub Release with artifacts

This differs from the CLI workflow slightly due to matrix builds.

### SHA256 Checksums

Homebrew requires SHA256 checksums for security:
- Calculated from packaged artifacts (tar.gz files)
- Updated automatically by workflow
- Prevents tampering with downloads

### Pre-release Versions

Pre-releases (e.g., `1.0.0-beta.1`) skip formula update:
- Users should test pre-releases by downloading directly
- Formula always points to latest stable
- Prevents accidental unstable installations

### Serial Port Permissions

macOS may require additional permissions for serial ports:
- User may need to approve app in System Preferences > Privacy & Security
- Mentioned in formula caveats

### Caveats

The formula's caveats section displays after installation:
```
TeensyROM Web has been installed!

To start the application:
  teensyrom-web

Then open your browser to:
  http://localhost:5168

Note: First launch may require granting permissions in
System Preferences > Privacy & Security.
```
