class TeensyromWeb < Formula
  desc "Web-based control interface for TeensyROM"
  homepage "https://github.com/MetalHexx/TeensyROM-Web"
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

  conflicts_with "metalhexx/teensyrom-cli/teensyrom-cli", because: "both install the TeensyROM CLI"

  def install
    # Install all files to libexec, create wrapper script in bin
    libexec.install Dir["*"]

    if (libexec/"cli/trom").exist?
      # Combined package: the engine and the CLI share the default home, ~/.teensyrom
      (bin/"teensyrom-web").write <<~EOS
        #!/bin/zsh
        cd "#{libexec}"
        exec "./TeensyRom.Api" "$@"
      EOS

      (bin/"trom").write <<~EOS
        #!/bin/zsh
        exec "#{libexec}/cli/trom" "$@"
      EOS

      chmod 0755, bin/"trom"
    else
      # Older package (no cli/, engine predates ~/.teensyrom): today's wrapper, unchanged
      (bin/"teensyrom-web").write <<~EOS
        #!/bin/zsh
        export TEENSYROM_DATA_DIR="${HOME}/Library/Application Support/TeensyROM-Web"
        mkdir -p "${TEENSYROM_DATA_DIR}"
        cd "#{libexec}"
        exec "./TeensyRom.Api" "$@"
      EOS
    end

    chmod 0755, bin/"teensyrom-web"
  end

  def caveats
    <<~EOS
      TeensyROM Web has been installed!

      To start the application:
        teensyrom-web

      Then open your browser to:
        http://localhost:10213

      To use the command-line tool (it starts the engine itself):
        trom

      Run `trom --help` to see every command.

      With the combined package, the engine and the CLI keep their
      data in ~/.teensyrom.

      Note: First launch may require granting permissions in
      System Preferences > Privacy & Security.
    EOS
  end

  test do
    # Basic test that binary shows version
    assert_match version.to_s, shell_output("#{bin}/teensyrom-web --version", 0)
    if (libexec/"cli/trom").exist?
      assert_match version.to_s, shell_output("#{bin}/trom --version", 0)
    end
  end
end
