# Task: Create Homebrew Formula

## 📋 Task Identity

**Task ID**: `DISTRIBUTION-PACKAGING-TASK-05-001-HOMEBREW-FORMULA`  
**Task Name**: Create Homebrew Formula with Dual Architecture Support  
**Assigned To**: Backend Wizard  
**Agent Chatmode**: `c:\dev\src\TeensyROM-Web\src\.github\chatmodes\backend-wizard.chatmode.md`  
**Priority**: High  
**Estimated Context Size**: Small (1 new file)

---

## 🎯 Objective

**What**: Create a Homebrew formula (`Formula/teensyrom-web.rb`) in the TeensyROM-Web repository that supports both Apple Silicon and Intel Macs.

**Why**: Homebrew is the standard package manager for macOS. Using a self-hosted tap (formula in same repo) allows one-command installation without needing a separate repository.

**Success Criteria**:
- [ ] `Formula/teensyrom-web.rb` exists in TeensyROM-Web repository
- [ ] Formula supports both ARM64 (Apple Silicon) and x64 (Intel) architectures
- [ ] Formula has valid Ruby syntax
- [ ] Formula installs binary as `teensyrom-web` command
- [ ] Formula includes helpful post-install caveats

---

## 📚 Required Reading

Before starting, review these resources:

- [ ] [Phase 05 Document](../phases/DISTRIBUTION-PACKAGING-PHASE-05-HOMEBREW.md) - Phase context
- [ ] [TeensyROM-CLI Formula](https://github.com/MetalHexx/TeensyROM-CLI/blob/main/Formula/teensyrom-cli.rb) - Reference (x64 only)
- [ ] [Homebrew Formula Cookbook](https://docs.brew.sh/Formula-Cookbook) - Official guide

---

## 🔗 Context & Dependencies

**Prerequisites Completed**:
- ✅ Phase 04: GitHub Actions workflow creates releases
- ✅ Artifacts named: `TeensyROM-Web-{version}-osx-x64.tar.gz` and `TeensyROM-Web-{version}-osx-arm64.tar.gz`
- ✅ GitHub Releases URL pattern: `https://github.com/MetalHexx/TeensyROM-Web/releases/download/v{version}/...`

**Reference Implementation**:
The TeensyROM-CLI formula (`teensyrom-cli.rb`) provides a working example, but only supports x64. This formula needs to add `on_arm` and `on_intel` blocks.

**Constraints**:
- Formula filename MUST be lowercase: `teensyrom-web.rb`
- Ruby class name MUST be PascalCase without dashes: `TeensyromWeb`
- Binary name in archive is `TeensyRom.Api`

---

## 📁 File Scope

**Files to Create**:
- `Formula/teensyrom-web.rb` - Homebrew formula

**Repository Structure After**:
```
TeensyROM-Web/
├── Formula/
│   └── teensyrom-web.rb    ✨ New
├── .github/
│   └── workflows/
│       └── release.yml
└── src/
    └── ...
```

**Note**: The `Formula/` directory goes at the repository root (alongside `.github/` and `src/`), NOT inside `src/`.

---

## 🛠️ Implementation Guidance

### Formula Structure

The formula needs to support two architectures using Homebrew's `on_arm` and `on_intel` blocks:

```ruby
class TeensyromWeb < Formula
  desc "Web-based control interface for TeensyROM"
  homepage "https://github.com/MetalHexx/TeensyROM-Web"
  license "MIT"
  version "1.0.0"  # Placeholder - updated by workflow

  on_arm do
    url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-Web-#{version}-osx-arm64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_ARM64"  # Updated by workflow
  end

  on_intel do
    url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-Web-#{version}-osx-x64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_X64"  # Updated by workflow
  end

  def install
    # Install all files to libexec, create wrapper script in bin
    libexec.install Dir["*"]
    (bin/"teensyrom-web").write <<~EOS
      #!/bin/zsh
      exec "#{libexec}/TeensyRom.Api" "$@"
    EOS
    chmod 0755, bin/"teensyrom-web"
  end

  def caveats
    <<~EOS
      TeensyROM Web has been installed!

      To start the application:
        teensyrom-web

      Then open your browser to:
        http://localhost:5168

      Note: First launch may require granting permissions in
      System Preferences > Privacy & Security.
    EOS
  end

  test do
    # Basic test that binary shows version
    assert_match version.to_s, shell_output("#{bin}/teensyrom-web --version", 0)
  end
end
```

### Key Differences from CLI Formula

| Aspect | CLI Formula | Web Formula |
|--------|-------------|-------------|
| Architecture | x64 only | ARM64 + x64 |
| URL blocks | Single `url` | `on_arm` + `on_intel` |
| SHA256 | Single | Two (one per arch) |
| Binary name | `TeensyRom.Cli` | `TeensyRom.Api` |
| Command name | `TeensyRom.Cli` | `teensyrom-web` |

### URL Pattern

The artifact URLs use the version interpolation:
```
https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-Web-#{version}-osx-arm64.tar.gz
https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-Web-#{version}-osx-x64.tar.gz
```

Note: Tag has `v` prefix (`v1.0.0`), artifact name does not have `v` prefix (`TeensyROM-Web-1.0.0-osx-arm64.tar.gz`).

### Placeholder Values

Use these exact placeholder strings (the workflow will replace them):
- Version: `"1.0.0"`
- ARM64 SHA256: `"PLACEHOLDER_SHA256_ARM64"`
- x64 SHA256: `"PLACEHOLDER_SHA256_X64"`

---

## ⚠️ Anti-Patterns to Avoid

1. **Don't use `url` at class level** - Must use `on_arm` and `on_intel` blocks for dual architecture
2. **Don't hardcode version in URL string** - Use `#{version}` interpolation
3. **Don't use dashes in Ruby class name** - Use `TeensyromWeb` not `Teensyrom-Web`
4. **Don't put Formula in src/** - It goes at repository root
5. **Don't forget the test block** - Homebrew requires it

---

## 🧪 Testing

### Syntax Validation

The formula Ruby syntax should be valid. If you have access to macOS with Homebrew, you can validate:

```bash
brew audit --new-formula Formula/teensyrom-web.rb
```

### Manual Verification

After creating the formula:
1. Check that placeholders are present (workflow will replace them)
2. Verify URL patterns match expected artifact names
3. Confirm binary name matches what's in the tar.gz (`TeensyRom.Api`)

---

## 📤 Deliverables

1. **Create `Formula/teensyrom-web.rb`** at repository root
2. **Completion report** documenting:
   - Formula content created
   - Any decisions made
   - Notes for Task 05-002 (workflow integration)

---

## 📝 Report Requirements

Save completion report to:
```
docs/projects/DISTRIBUTION-PACKAGING/reports/DISTRIBUTION-PACKAGING-TASK-05-001-REPORT.md
```

Include in report:
- Confirmation that formula file was created
- Location of file (repository root, not src/)
- Any deviations from the template and why
- Notes about placeholder values for workflow integration
