using TeensyRom.Api.Startup;
using TeensyRom.Core.Common;

namespace TeensyRom.Api.Tests.Startup;

public class EngineInstanceLockTests : IDisposable
{
    private static readonly TimeSpan NoRetry = TimeSpan.Zero;

    private readonly string _apiPath = Directory.CreateDirectory(
        Path.Combine(TeensyRomHome.Root, "engine-lock-tests", Guid.NewGuid().ToString("N"))).FullName;

    private string LockPath => Path.Combine(_apiPath, TeensyRomHome.EngineLockFileName);

    // A successful acquire holds the file for the life of the process, so the folder can outlive the test;
    // it sits in the throwaway test home, which is removed when the process exits.
    public void Dispose()
    {
        try { Directory.Delete(_apiPath, recursive: true); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    [Fact]
    public void TryAcquire_OnAFreeHome_Succeeds()
    {
        EngineInstanceLock.TryAcquire(_apiPath).Should().BeTrue();

        File.Exists(LockPath).Should().BeTrue();
        new FileInfo(LockPath).Length.Should().Be(0);
    }

    [Fact]
    public void TryAcquire_AgainForAPathThisProcessHolds_Succeeds()
    {
        EngineInstanceLock.TryAcquire(_apiPath).Should().BeTrue();

        EngineInstanceLock.TryAcquire(_apiPath).Should().BeTrue();
    }

    [Fact]
    public async Task TryAcquire_FromTwoThreadsAtOnce_SucceedsForBoth()
    {
        var results = await Task.WhenAll(
            Task.Run(() => EngineInstanceLock.TryAcquire(_apiPath)),
            Task.Run(() => EngineInstanceLock.TryAcquire(_apiPath)));

        results.Should().AllBeEquivalentTo(true);
    }

    [Fact]
    public void TryAcquire_WhenAnotherHolderHasTheFileOpen_FailsAfterTheRetryWindow()
    {
        using var otherProcess = new FileStream(LockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);

        var started = DateTime.UtcNow;
        var acquired = EngineInstanceLock.TryAcquire(_apiPath, TimeSpan.FromMilliseconds(300), TimeSpan.FromMilliseconds(50));

        acquired.Should().BeFalse();
        (DateTime.UtcNow - started).Should().BeGreaterThanOrEqualTo(TimeSpan.FromMilliseconds(250));
    }

    [Fact]
    public void TryAcquire_WhenTheOtherHolderReleasesDuringTheRetryWindow_Succeeds()
    {
        var otherProcess = new FileStream(LockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        _ = Task.Run(async () =>
        {
            await Task.Delay(200);
            otherProcess.Dispose();
        });

        EngineInstanceLock.TryAcquire(_apiPath, TimeSpan.FromSeconds(5), TimeSpan.FromMilliseconds(50)).Should().BeTrue();
    }

    [Fact]
    public void TryAcquire_WithNoRetryWindow_FailsImmediatelyWhileAnotherHolderHasTheFileOpen()
    {
        using var otherProcess = new FileStream(LockPath, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);

        EngineInstanceLock.TryAcquire(_apiPath, NoRetry, NoRetry).Should().BeFalse();
    }
}
