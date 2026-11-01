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

  conflicts_with "metalhexx/teensyrom-cli/teensyrom-cli", because: "both install the TeensyROM CLI"

  def install
    # Install all files to libexec, create wrapper scripts in bin
    libexec.install Dir["*"]

    if (libexec/"cli/trom").exist?
      # Combined package: the engine and the CLI share the default home, ~/.teensyrom
      wrapper = <<~EOS
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

      To start the application:
        trom-suite

      Then open Trom UI in your browser at:
        http://localhost:10213

      To use Trom Terminal, the command-line tool (it starts Trom API itself):
        trom

      Run `trom --help` to see every command.

      Trom UI and Trom Terminal keep their data in ~/.teensyrom.

      Note: First launch may require granting permissions in
      System Preferences > Privacy & Security.
    EOS
  end

  test do
    # Basic test that binary shows version
    assert_match version.to_s, shell_output("#{bin}/trom-suite --version", 0)
    if (libexec/"cli/trom").exist?
      assert_match version.to_s, shell_output("#{bin}/trom --version", 0)
    end
  end
end
