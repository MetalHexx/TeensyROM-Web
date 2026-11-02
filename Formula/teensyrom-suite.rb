class TeensyromSuite < Formula
  desc "TeensyROM Suite: Trom UI, Trom Terminal and Trom API for your TeensyROM"
  homepage "https://github.com/MetalHexx/TeensyROM-Suite"
  license "MIT"
  version "1.0.0-alpha.8"

  on_arm do
    url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-Web-#{version}-osx-arm64.tar.gz"
    sha256 "1cb226acd193d014d50be4251b00c9498087572a11ed7a717afc8650d884bbc0"
  end

  on_intel do
    url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-Web-#{version}-osx-x64.tar.gz"
    sha256 "ac078715d9b457da2725e4893837c7baa7a5f58e722fa94d461e55abaa70732a"
  end

  depends_on :macos

  conflicts_with "metalhexx/teensyrom-cli/teensyrom-cli", because: "both install the TeensyROM CLI"

  def install
    # Install all files to libexec, create wrapper scripts in bin
    libexec.install Dir["*"]

    if (libexec/"api/TeensyRom.Api").exist?
      # api/ + cli/ package: the engine and the CLI share the default home, ~/.teensyrom
      wrapper = <<~EOS
        #!/bin/zsh
        cd "#{libexec}/api"
        exec "./TeensyRom.Api" "$@"
      EOS

      (bin/"trom").write <<~EOS
        #!/bin/zsh
        exec "#{libexec}/cli/trom" "$@"
      EOS

      chmod 0755, bin/"trom"
    else
      # Older package (no cli/, engine predates ~/.teensyrom): today's wrapper, unchanged
      wrapper = <<~EOS
        #!/bin/zsh
        export TEENSYROM_DATA_DIR="${HOME}/Library/Application Support/TeensyROM-Web"
        mkdir -p "${TEENSYROM_DATA_DIR}"
        cd "#{libexec}"
        exec "./TeensyRom.Api" "$@"
      EOS
    end

    # teensyrom-web is kept so existing habits and scripts keep working
    %w[trom-suite teensyrom-web].each do |name|
      (bin/name).write wrapper
      chmod 0755, bin/name
    end
  end

  def caveats
    <<~EOS
      TeensyROM Suite has been installed!

      To open Trom UI (it starts Trom API if needed):
        trom ui

      To use Trom Terminal, the command-line tool:
        trom

      Run `trom --help` to see every command.

      To run Trom API in this terminal instead:
        trom-suite

      Update with `trom update` or `brew upgrade teensyrom-suite`.

      Trom UI and Trom Terminal keep their data in ~/.teensyrom.

      macOS may block the first launch: open System Settings >
      Privacy & Security and choose Open Anyway.
    EOS
  end

  test do
    if (libexec/"cli/trom").exist?
      assert_match version.to_s, shell_output("#{bin}/trom --version", 0)
    else
      assert_predicate libexec/"TeensyRom.Api", :executable?
    end
  end
end
