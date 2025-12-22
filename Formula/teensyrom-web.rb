class TeensyromWeb < Formula
  desc "Web-based control interface for TeensyROM"
  homepage "https://github.com/MetalHexx/TeensyROM-Web"
  license "MIT"
  version "1.0.0-alpha.6"

  on_arm do
    url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-Web-#{version}-osx-arm64.tar.gz"
    sha256 "c1df76256c08a485fe945cc576a0d07ede411734185ad5b58275c7882c56cd6f"
  end

  on_intel do
    url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-Web-#{version}-osx-x64.tar.gz"
    sha256 "ffe316d8b57896a62e5bf30e7ee3a2dd62b9c73874d75d95d677d74076ae2ea7"
  end

  def install
    # Install all files to libexec, create wrapper script in bin
    libexec.install Dir["*"]

    (bin/"teensyrom-web").write <<~EOS
      #!/bin/zsh
      export TEENSYROM_DATA_DIR="${HOME}/Library/Application Support/TeensyROM-Web"
      mkdir -p "${TEENSYROM_DATA_DIR}"
      cd "#{libexec}"
      exec "./TeensyRom.Api" "$@"
    EOS

    chmod 0755, bin/"teensyrom-web"
  end

  def caveats
    <<~EOS
      TeensyROM Web has been installed!

      To start the application:
        teensyrom-web

      Then open your browser to:
        http://localhost:5000

      Note: First launch may require granting permissions in
      System Preferences > Privacy & Security.
    EOS
  end

  test do
    # Basic test that binary shows version
    assert_match version.to_s, shell_output("#{bin}/teensyrom-web --version", 0)
  end
end
