using System.Diagnostics;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Tests;

public sealed class SourceFingerprintTests : IDisposable
{
    private readonly string _repo = Path.Combine(Path.GetTempPath(), $"teensyrom-fingerprint-{Guid.NewGuid():N}");
    private readonly SourceFingerprint _sut = new();

    public void Dispose()
    {
        // Git marks its object files read-only.
        foreach (var file in Directory.EnumerateFiles(_repo, "*", SearchOption.AllDirectories))
        {
            File.SetAttributes(file, FileAttributes.Normal);
        }
        Directory.Delete(_repo, recursive: true);
    }

    private void Write(string relativePath, string content)
    {
        var path = Path.Combine(_repo, relativePath);
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, content);
    }

    private void Git(params string[] arguments)
    {
        var start = new ProcessStartInfo("git") { RedirectStandardOutput = true, RedirectStandardError = true };
        string[] config = ["-C", _repo, "-c", "user.name=test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false"];

        foreach (var argument in config.Concat(arguments))
        {
            start.ArgumentList.Add(argument);
        }
        using var process = Process.Start(start)!;
        process.StandardOutput.ReadToEnd();
        process.StandardError.ReadToEnd();
        process.WaitForExit();
        process.ExitCode.Should().Be(0, $"git {string.Join(' ', arguments)} should work in the test repository");
    }

    private string Committed()
    {
        Directory.CreateDirectory(_repo);
        Git("init", "-q");
        Write("src/apps/api/src/TeensyRom.Api/Program.cs", "engine v1");
        Write("src/apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json", "spec v1");
        Write("src/apps/Version.props", "version 1");
        Write("src/apps/cli/Cli.cs", "cli v1");
        Git("add", "-A");
        Git("commit", "-q", "-m", "initial");
        return _sut.Current(_repo);
    }

    [Fact]
    public void Current_ChangesWhenATrackedEngineFileChangesAndReturnsWhenItIsReverted()
    {
        var before = Committed();

        Write("src/apps/api/src/TeensyRom.Api/Program.cs", "engine v2");
        var changed = _sut.Current(_repo);
        Write("src/apps/api/src/TeensyRom.Api/Program.cs", "engine v1");

        changed.Should().NotBe(before);
        _sut.Current(_repo).Should().Be(before);
    }

    [Fact]
    public void Current_ChangesWhenTheVersionFileChanges()
    {
        var before = Committed();

        Write("src/apps/Version.props", "version 2");

        _sut.Current(_repo).Should().NotBe(before);
    }

    [Fact]
    public void Current_IgnoresTheApiSpecEveryBuildRewritesAndTheCliApp()
    {
        var before = Committed();

        Write("src/apps/api/src/TeensyRom.Api/api-spec/TeensyRom.Api.json", "spec v2");
        Write("src/apps/cli/Cli.cs", "cli v2");

        _sut.Current(_repo).Should().Be(before);
    }

    [Fact]
    public void Current_NoticesANewEngineFile()
    {
        var before = Committed();

        Write("src/apps/api/src/TeensyRom.Api/NewFile.cs", "new");

        _sut.Current(_repo).Should().NotBe(before);
    }

    [Fact]
    public void Current_OfAFolderGitCannotRead_IsUnknown()
    {
        Directory.CreateDirectory(_repo);

        _sut.Current(_repo).Should().Be(SourceFingerprint.Unknown);
    }

    [Fact]
    public void Recorded_ReturnsWhatWasRecordedAndNothingBeforeThat()
    {
        Directory.CreateDirectory(_repo);
        if (File.Exists(TeensyRomHome.SourceEngineRecordPath)) File.Delete(TeensyRomHome.SourceEngineRecordPath);

        _sut.Recorded().Should().BeNull();

        _sut.Record("abc:123");

        _sut.Recorded().Should().Be("abc:123");
        File.Delete(TeensyRomHome.SourceEngineRecordPath);
    }
}
