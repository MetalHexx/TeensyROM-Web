using System.Diagnostics;
using TeensyRom.Cli.Logging;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// Every <c>TestHost</c> logger writes the one <see cref="LogConstants.LogPath"/> of the test process, so tests that
/// hold, trim, or count that file run apart from everything else.
/// </summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class LoggingCollection
{
    public const string Name = "Logging";
}

[Collection(LoggingCollection.Name)]
public class LoggingServiceTests : IDisposable
{
    private static string OldLogPath => Path.Combine(Path.GetDirectoryName(LogConstants.LogPath)!, "Logs.old.txt");

    public LoggingServiceTests()
    {
        Directory.CreateDirectory(Path.GetDirectoryName(LogConstants.LogPath)!);
        File.Delete(LogConstants.LogPath);
        File.Delete(OldLogPath);
    }

    public void Dispose()
    {
        File.Delete(LogConstants.LogPath);
        File.Delete(OldLogPath);
    }

    [Fact]
    public void Log_WhileAnotherHandleHoldsTheFile_ReturnsWithoutThrowing()
    {
        var logger = new TestLogger();
        using var held = new FileStream(LogConstants.LogPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        var timer = Stopwatch.StartNew();

        var act = () => logger.Internal("dropped while held");

        act.Should().NotThrow();
        timer.Elapsed.Should().BeLessThan(TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void Log_AfterTheHolderLetsGo_WritesAgain()
    {
        var logger = new TestLogger();
        using (new FileStream(LogConstants.LogPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None))
        {
            logger.Internal("dropped while held");
        }

        logger.Internal("written after release");

        var text = ReadLog();
        text.Should().Contain("written after release");
        text.Should().NotContain("dropped while held");
    }

    [Fact]
    public async Task Log_FromManyConcurrentTasks_LandsEveryLine()
    {
        var logger = new TestLogger();
        const int tasks = 8;
        const int linesPerTask = 50;

        await Task.WhenAll(Enumerable.Range(0, tasks).Select(t => Task.Run(() =>
        {
            for (var i = 0; i < linesPerTask; i++) logger.Internal($"task {t} line {i}");
        })));

        var lines = ReadLog().Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
        lines.Should().HaveCount(tasks * linesPerTask);
        lines.Distinct().Should().HaveCount(tasks * linesPerTask);
    }

    [Fact]
    public void Log_FromTwoLoggers_AppendsToTheSameFile()
    {
        var first = new TestLogger();
        var second = new TestLogger();

        first.Internal("from first");
        second.Internal("from second");

        ReadLog().Should().Contain("from first").And.Contain("from second");
    }

    [Fact]
    public void Constructing_OverAnExistingLog_LeavesItsContentsAlone()
    {
        File.WriteAllText(LogConstants.LogPath, "earlier run" + Environment.NewLine);

        _ = new TestLogger();

        ReadLog().Should().Be("earlier run" + Environment.NewLine);
        File.Exists(OldLogPath).Should().BeFalse();
    }

    [Fact]
    public void Constructing_OverAnOversizeLog_MovesItToTheOldLog()
    {
        var oversize = new byte[1024 * 1024 + 1];
        File.WriteAllBytes(LogConstants.LogPath, oversize);
        File.WriteAllText(OldLogPath, "older still");

        var logger = new TestLogger();
        logger.Internal("fresh line");

        new FileInfo(OldLogPath).Length.Should().Be(oversize.Length);
        ReadLog().Should().Be("fresh line" + Environment.NewLine);
    }

    [Fact]
    public void Constructing_OverAnOversizeLogAnotherProcessHolds_DoesNotThrow()
    {
        File.WriteAllBytes(LogConstants.LogPath, new byte[1024 * 1024 + 1]);
        using var held = new FileStream(LogConstants.LogPath, FileMode.Open, FileAccess.Read, FileShare.None);

        var act = () => new TestLogger();

        act.Should().NotThrow();
    }

    private static string ReadLog()
    {
        using var stream = new FileStream(LogConstants.LogPath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    private sealed class TestLogger : LoggingService;
}
