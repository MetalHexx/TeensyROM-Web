using System.Reactive.Linq;
using TeensyRom.Cli.PathSetup;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.Tests.PathSetup;

/// <summary>A user PATH held in memory, so no test touches the real registry.</summary>
internal sealed class FakeUserPathStore(string? value = null) : IUserPathStore
{
    public string? Value { get; private set; } = value;

    public int Writes { get; private set; }

    public string? Read() => Value;

    public void Write(string value)
    {
        Value = value;
        Writes++;
    }
}

/// <summary>Settings kept in memory, so no test touches the settings file.</summary>
internal sealed class InMemorySettings : ISettingsService
{
    private TeensySettings _settings = new();

    public IObservable<TeensySettings> Settings => Observable.Return(_settings);

    public TeensySettings GetSettings() => _settings.GetClone();

    public bool SaveSettings(TeensySettings settings)
    {
        _settings = settings.GetClone();
        return true;
    }
}

/// <summary>A throwaway home and throwaway folders, and the environment over them.</summary>
internal sealed class PathSandbox : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "trom-path-tests", Guid.NewGuid().ToString("N"));

    public PathSandbox()
    {
        Directory.CreateDirectory(Home);
    }

    public string Home => Path.Combine(_root, "home");

    /// <summary>A folder that holds a <c>trom</c> for <paramref name="platform"/>.</summary>
    public string InstallFolder(string name, PathPlatform platform = PathPlatform.Windows)
    {
        var folder = EmptyFolder(name);
        File.WriteAllText(Path.Combine(folder, platform == PathPlatform.Windows ? "trom.exe" : "trom"), string.Empty);
        return folder;
    }

    public string EmptyFolder(string name)
    {
        var folder = Path.Combine(_root, name);
        Directory.CreateDirectory(folder);
        return folder;
    }

    public PathEnvironment Environment(string installFolder, PathPlatform platform, string? shell = null, string? pathVariable = null) =>
        new(installFolder, Home, shell, platform, pathVariable);

    public string HomeFile(string relative) => Path.Combine(Home, relative.Replace('/', Path.DirectorySeparatorChar));

    public void Dispose()
    {
        try { Directory.Delete(_root, recursive: true); }
        catch (IOException) { }
    }
}
