using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Tests;

public sealed class EngineLockTests : IDisposable
{
    private readonly string _folder = Path.Combine(Path.GetTempPath(), $"teensyrom-lock-{Guid.NewGuid():N}");
    private readonly string _lockFile;
    private readonly EngineLock _sut;

    public EngineLockTests()
    {
        Directory.CreateDirectory(_folder);
        _lockFile = Path.Combine(_folder, "engine.lock");
        _sut = new EngineLock(() => _lockFile);
    }

    public void Dispose() => Directory.Delete(_folder, recursive: true);

    [Fact]
    public void IsHeld_WithoutALockFile_IsFree()
    {
        _sut.IsHeld().Should().BeFalse();
    }

    [Fact]
    public void IsHeld_WhileAnEngineHoldsTheFileOpen_IsHeld()
    {
        using var engine = new FileStream(_lockFile, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);

        _sut.IsHeld().Should().BeTrue();
    }

    [Fact]
    public void IsHeld_AfterTheEngineLetsGo_IsFreeAndLeavesTheFileOpenForTheEngineToTake()
    {
        new FileStream(_lockFile, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None).Dispose();

        _sut.IsHeld().Should().BeFalse();

        using var engine = new FileStream(_lockFile, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
    }
}
