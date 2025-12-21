class TeensyromWeb < Formula
  desc "Web-based control interface for TeensyROM"
  homepage "https://github.com/MetalHexx/TeensyROM-Web"
  license "MIT"
  version "1.0.0-alpha.4"

  on_arm do
    url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-Web-#{version}-osx-arm64.tar.gz"
    sha256 "b2914d54df5df0322ef980fd2173c4bd8d3802a37caa3f1e5c72ff69253f8203"
  end

  on_intel do
    url "https://github.com/MetalHexx/TeensyROM-Web/releases/download/v#{version}/TeensyROM-Web-#{version}-osx-x64.tar.gz"
    sha256 "e8e4771900bf12d821a9221e35a5d7a81c6451c65f0883f60a7cd3ea9d48edd8"
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
