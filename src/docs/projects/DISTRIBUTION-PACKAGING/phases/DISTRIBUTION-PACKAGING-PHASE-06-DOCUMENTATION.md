# Phase 06: Documentation

## 🎯 Objective

Create comprehensive distribution documentation and update the main README with installation instructions for all supported platforms.

**Value Delivered**: End users can easily find and follow installation instructions for their platform.

**Prerequisite**: Phases 01-05 must be complete (distribution infrastructure in place).

---

## 📚 Required Reading

- [ ] [DISTRIBUTION_PACKAGING_PLAN.md](../../../features/DISTRIBUTION_PACKAGING_PLAN.md) - Overall distribution strategy
- [ ] Phase 04 & 05 documents - For GitHub Releases and Homebrew details
- [ ] Existing README.md - To understand current structure

---

## 📂 File Structure Overview

```
docs/
└── DISTRIBUTION.md                          ✨ New - Complete distribution guide

README.md (root repo: TeensyROM-Web)         📝 Modified - Add installation section
```

---

## 📋 Implementation Tasks

<details open>
<summary><h3>Task 1: Create Distribution Documentation</h3></summary>

**Purpose**: Create a comprehensive guide for distribution, installation, and troubleshooting.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-06-001-DISTRIBUTION-DOCS`

**Implementation Subtasks**:

- [ ] Create `docs/DISTRIBUTION.md`
- [ ] Document Windows installation (download, extract, run)
- [ ] Document macOS installation (Homebrew preferred, manual download alternative)
- [ ] Document Linux installation (download, extract, run, permissions)
- [ ] Document first-run experience (what to expect, browser URL)
- [ ] Document troubleshooting section (common issues)
- [ ] Document building from source (for developers)

**Content Outline**:

1. **Quick Start** - TL;DR for each platform
2. **Windows Installation** - Step-by-step with screenshots/examples
3. **macOS Installation** - Homebrew and manual options
4. **Linux Installation** - Including permission notes
5. **First Run** - What happens, what to expect
6. **Configuration** - Any user-configurable options
7. **Troubleshooting** - Common issues and solutions
8. **Building from Source** - Developer setup

**Testing Subtask**:
- [ ] Follow Windows instructions on a fresh system
- [ ] Follow macOS instructions (both methods)
- [ ] Follow Linux instructions
- [ ] Verify all links work

</details>

---

<details open>
<summary><h3>Task 2: Update Main README</h3></summary>

**Purpose**: Add prominent installation section to the main repository README.

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-06-002-README-UPDATE`

**Implementation Subtasks**:

- [ ] Add "Installation" section near the top of README
- [ ] Include quick-start commands for each platform
- [ ] Link to full DISTRIBUTION.md for details
- [ ] Add badge/link to latest GitHub Release
- [ ] Ensure download links point to correct release assets

**README Section Structure**:

```markdown
## Installation

### Windows
1. Download `TeensyROM-win-x64.zip` from [latest release](link)
2. Extract to any folder
3. Run `TeensyRom.Api.exe`
4. Open browser to http://localhost:5168

### macOS (Homebrew)
```bash
brew install MetalHexx/TeensyROM/teensyrom-web
teensyrom-web
```

### macOS (Manual)
1. Download `TeensyROM-osx-arm64.tar.gz` (Apple Silicon) or `TeensyROM-osx-x64.tar.gz` (Intel)
2. Extract and run

### Linux
1. Download `TeensyROM-linux-x64.tar.gz` from [latest release](link)
2. Extract and run `./TeensyRom.Api`

See [DISTRIBUTION.md](docs/DISTRIBUTION.md) for detailed instructions.
```

**Note**: The README is in the root `TeensyROM-Web` repo, not in the `src/` folder.

**Testing Subtask**:
- [ ] All release links work
- [ ] Quick-start commands are accurate
- [ ] Link to DISTRIBUTION.md works

</details>

---

## 🗂️ Files Modified or Created

**New Files**:
- `docs/DISTRIBUTION.md` - Full distribution guide (in src/ docs folder)

**Modified Files**:
- `README.md` - Root repository README

**Note on File Locations**:
- `docs/DISTRIBUTION.md` goes in `src/docs/` (the workspace docs folder)
- `README.md` is at the root of the `TeensyROM-Web` repository (parent of `src/`)

---

## 📝 Content Guidelines

### DISTRIBUTION.md Content

**Platform-Specific Sections**:

For each platform, include:
1. Download location (GitHub Releases)
2. Installation steps (numbered)
3. How to run
4. How to access (browser URL)
5. Platform-specific notes (permissions, Gatekeeper, etc.)

**Troubleshooting Section**:

| Issue | Platform | Solution |
|-------|----------|----------|
| "App can't be opened" | macOS | Right-click → Open, or System Preferences |
| Port already in use | All | Kill existing process or change port |
| Permission denied | Linux | `chmod +x TeensyRom.Api` |
| Serial port access | Linux | Add user to `dialout` group |

### README.md Updates

Keep it concise - just enough to get started, link to full docs for details.

**Required Badges/Links**:
- Latest Release badge
- Download links for each platform

---

## 📝 Testing Summary

**Documentation Testing**:

1. **Windows Verification**:
   - Follow README quick-start
   - Application runs successfully
   - Browser connects to correct URL

2. **macOS Verification**:
   - Homebrew install works: `brew install MetalHexx/TeensyROM/teensyrom-web`
   - Manual download works
   - Application runs successfully

3. **Linux Verification**:
   - Download and extract works
   - Permissions set correctly
   - Application runs successfully

4. **Link Verification**:
   - All GitHub Release links work
   - DISTRIBUTION.md link from README works
   - Any internal cross-references work

---

## ✅ Success Criteria

- [ ] `docs/DISTRIBUTION.md` exists with complete installation guide
- [ ] All three platforms documented (Windows, macOS, Linux)
- [ ] Homebrew instructions included for macOS
- [ ] Troubleshooting section covers common issues
- [ ] `README.md` updated with installation section
- [ ] Release download links are correct
- [ ] Instructions have been tested on at least one platform
- [ ] No broken links

---

## 📝 Notes & Considerations

### GitHub Release Link Format

Use these URL patterns for release assets:
```
https://github.com/MetalHexx/TeensyROM-Web/releases/latest/download/TeensyROM-win-x64.zip
https://github.com/MetalHexx/TeensyROM-Web/releases/latest/download/TeensyROM-osx-x64.tar.gz
https://github.com/MetalHexx/TeensyROM-Web/releases/latest/download/TeensyROM-osx-arm64.tar.gz
https://github.com/MetalHexx/TeensyROM-Web/releases/latest/download/TeensyROM-linux-x64.tar.gz
```

The `/latest/download/` pattern always points to the most recent release.

### macOS Gatekeeper Notes

First-time users on macOS may see "App can't be opened" warning. Document the workaround:
1. Right-click the app → Open
2. Or: System Preferences → Security & Privacy → "Open Anyway"

### Linux Serial Port Access

Linux users may need to add themselves to the `dialout` group for serial port access:
```bash
sudo usermod -a -G dialout $USER
# Log out and back in for changes to take effect
```

### Version-Specific vs Latest Links

- Use `/latest/download/` for general documentation
- Specific versions can be linked with `/download/v1.0.0/filename`
- Consider noting this for users who need a specific version

### Documentation Should Be Updated After First Real Release

These documents are created with placeholder assumptions. After the first real release:
1. Verify all download links work
2. Update any file names if they differ
3. Add screenshots if helpful
4. Incorporate any feedback from early users
