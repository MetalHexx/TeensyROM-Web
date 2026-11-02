using System.Formats.Tar;
using System.IO.Compression;
using System.Text;
using TeensyRom.Cli.Update;

namespace TeensyRom.Cli.Tests.Update;

/// <summary>A throwaway folder that is deleted with it.</summary>
internal sealed class Scratch : IDisposable
{
    public string Folder { get; } = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "trom-update-tests", Guid.NewGuid().ToString("N"));

    public Scratch() => Directory.CreateDirectory(Folder);

    public string At(string relative) => System.IO.Path.Combine(Folder, relative.Replace('/', System.IO.Path.DirectorySeparatorChar));

    /// <summary>Writes <paramref name="content"/> to <paramref name="relative"/> under the folder and returns the full path.</summary>
    public string Write(string relative, string content = "")
    {
        var path = At(relative);

        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path)!);
        File.WriteAllText(path, content);
        return path;
    }

    public void Dispose()
    {
        try { Directory.Delete(Folder, recursive: true); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }
}

internal static class TreeSnapshot
{
    /// <summary>Every file (with its content) and folder under <paramref name="folder"/>, by relative path; top-level entries named in <paramref name="skip"/> are left out.</summary>
    public static SortedDictionary<string, string> Of(string folder, params string[] skip)
    {
        var snapshot = new SortedDictionary<string, string>(StringComparer.Ordinal);

        foreach (var path in Directory.EnumerateFileSystemEntries(folder, "*", SearchOption.AllDirectories))
        {
            var relative = System.IO.Path.GetRelativePath(folder, path).Replace('\\', '/');

            if (skip.Any(name => relative == name || relative.StartsWith(name + "/", StringComparison.Ordinal))) continue;

            snapshot[relative] = Directory.Exists(path) ? "<folder>" : File.ReadAllText(path);
        }
        return snapshot;
    }
}

/// <summary>A clock that moves only when told to, and fires its timers when it does.</summary>
internal sealed class FakeTimeProvider : TimeProvider
{
    private readonly List<FakeTimer> _timers = [];
    private DateTimeOffset _now = new(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => _now;

    public override long TimestampFrequency => TimeSpan.TicksPerSecond;

    public override long GetTimestamp() => _now.UtcTicks;

    public override ITimer CreateTimer(TimerCallback callback, object? state, TimeSpan dueTime, TimeSpan period)
    {
        var timer = new FakeTimer(this, callback, state);

        lock (_timers) _timers.Add(timer);
        timer.Change(dueTime, period);
        return timer;
    }

    public void Advance(TimeSpan by)
    {
        _now += by;

        FakeTimer[] due;
        lock (_timers) due = _timers.Where(timer => timer.IsDue(_now)).ToArray();

        foreach (var timer in due) timer.Fire(_now);
    }

    private sealed class FakeTimer(FakeTimeProvider owner, TimerCallback callback, object? state) : ITimer
    {
        private DateTimeOffset? _due;
        private TimeSpan _period = Timeout.InfiniteTimeSpan;

        public bool Change(TimeSpan dueTime, TimeSpan period)
        {
            _due = dueTime == Timeout.InfiniteTimeSpan ? null : owner._now + dueTime;
            _period = period;
            return true;
        }

        public bool IsDue(DateTimeOffset now) => _due is { } due && due <= now;

        public void Fire(DateTimeOffset now)
        {
            _due = _period == Timeout.InfiniteTimeSpan || _period == TimeSpan.Zero ? null : now + _period;
            callback(state);
        }

        public void Dispose()
        {
            lock (owner._timers) owner._timers.Remove(this);
        }

        public ValueTask DisposeAsync()
        {
            Dispose();
            return ValueTask.CompletedTask;
        }
    }
}

/// <summary>Forwards everything to <paramref name="inner"/>; a test overrides the one thing it wants to break.</summary>
internal class DecoratedFileOps(IFileOps inner) : IFileOps
{
    public virtual bool FileExists(string path) => inner.FileExists(path);

    public virtual bool DirectoryExists(string path) => inner.DirectoryExists(path);

    public virtual IReadOnlyList<string> Entries(string folder) => inner.Entries(folder);

    public virtual void CreateDirectory(string path) => inner.CreateDirectory(path);

    public virtual void Move(string source, string destination) => inner.Move(source, destination);

    public virtual void WriteFile(string path, byte[] content) => inner.WriteFile(path, content);

    public virtual void DeleteFile(string path) => inner.DeleteFile(path);

    public virtual void DeleteDirectory(string path) => inner.DeleteDirectory(path);

    public virtual void DeleteEmptyDirectory(string path) => inner.DeleteEmptyDirectory(path);

    public virtual long? FreeSpace(string path) => inner.FreeSpace(path);

    public virtual void MakeExecutable(string path) => inner.MakeExecutable(path);

    public virtual string CurrentDirectory
    {
        get => inner.CurrentDirectory;
        set => inner.CurrentDirectory = value;
    }
}

/// <summary>Fails the <paramref name="failFrom"/>th move; with <paramref name="persistent"/>, every move after it too, like a disk that went away.</summary>
internal sealed class FailingMoves(IFileOps inner, int failFrom = int.MaxValue, bool persistent = false) : DecoratedFileOps(inner)
{
    public int Moves { get; private set; }

    public override void Move(string source, string destination)
    {
        Moves++;

        if (Moves == failFrom || (persistent && Moves > failFrom)) throw new IOException($"simulated failure on move {Moves}");

        base.Move(source, destination);
    }
}

/// <summary>Notes every move in the order it is made.</summary>
internal sealed class RecordingMoves(IFileOps inner) : DecoratedFileOps(inner)
{
    public List<(string Source, string Destination)> Moves { get; } = [];

    public override void Move(string source, string destination)
    {
        Moves.Add((source, destination));
        base.Move(source, destination);
    }
}

/// <summary>Fails the <paramref name="failFrom"/>th write; with <paramref name="persistent"/>, every write after it too. The journal is the only thing the swap writes.</summary>
internal sealed class FailingWrites(IFileOps inner, int failFrom = int.MaxValue, bool persistent = false) : DecoratedFileOps(inner)
{
    public int Writes { get; private set; }

    public override void WriteFile(string path, byte[] content)
    {
        Writes++;

        if (Writes == failFrom || (persistent && Writes > failFrom)) throw new IOException($"simulated failure on write {Writes}");

        base.WriteFile(path, content);
    }
}

/// <summary>
/// Notes what is deleted through it. With <paramref name="updateFolder"/>, notes for each delete whether the update lock
/// was held at that moment, by trying to take it.
/// </summary>
internal sealed class RecordingDeletes(IFileOps inner, string? updateFolder = null) : DecoratedFileOps(inner)
{
    /// <summary>Every delete, in order, whatever it deleted.</summary>
    public List<(string Path, bool LockHeld)> Deletes { get; } = [];

    public List<string> DeletedDirectories { get; } = [];

    public List<string> DeletedEmptyDirectories { get; } = [];

    public override void DeleteFile(string path)
    {
        Record(path);
        base.DeleteFile(path);
    }

    public override void DeleteDirectory(string path)
    {
        DeletedDirectories.Add(path);
        Record(path);
        base.DeleteDirectory(path);
    }

    public override void DeleteEmptyDirectory(string path)
    {
        DeletedEmptyDirectories.Add(path);
        Record(path);
        base.DeleteEmptyDirectory(path);
    }

    private void Record(string path)
    {
        using var probe = updateFolder is null ? null : UpdateLock.TryAcquire(updateFolder);

        Deletes.Add((path, updateFolder is not null && probe is null));
    }
}

/// <summary>A working directory, free space and a delete that fails, all under the test's control; the rest is the real disk.</summary>
internal sealed class ScriptedFileOps(IFileOps inner) : DecoratedFileOps(inner)
{
    private string? _currentDirectory;

    public long? Free { get; set; }

    public Func<string, bool> FailDelete { get; set; } = _ => false;

    public override long? FreeSpace(string path) => Free ?? base.FreeSpace(path);

    public override string CurrentDirectory
    {
        get => _currentDirectory ?? base.CurrentDirectory;
        set => _currentDirectory = value;
    }

    public override void DeleteFile(string path)
    {
        if (FailDelete(path)) throw new IOException("in use");

        base.DeleteFile(path);
    }
}

/// <summary>Answers requests from a script and remembers what was asked.</summary>
internal sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> answer) : HttpMessageHandler
{
    internal sealed record Seen(Uri Uri, string UserAgent, string Accept);

    public List<Seen> Requests { get; } = [];

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        Requests.Add(new Seen(request.RequestUri!, request.Headers.UserAgent.ToString(), request.Headers.Accept.ToString()));

        return Task.FromResult(answer(request));
    }
}

internal sealed class FakeProcessRunner(Func<string, IReadOnlyList<string>, ProcessResult> answer) : IProcessRunner
{
    public List<(string File, string[] Args, TimeSpan Timeout)> Calls { get; } = [];

    /// <summary>Whether each call, in the order of <see cref="Calls"/>, asked for the whole process tree to be killed.</summary>
    public List<bool> KillProcessTree { get; } = [];

    public Task<ProcessResult> RunAsync(string file, IReadOnlyList<string> args, TimeSpan timeout, Action<string>? onLine, CancellationToken ct = default, bool killProcessTree = true)
    {
        Calls.Add((file, [.. args], timeout));
        KillProcessTree.Add(killProcessTree);

        var result = answer(file, args);

        foreach (var line in (result.StdOut + result.StdErr).Split('\n', StringSplitOptions.RemoveEmptyEntries)) onLine?.Invoke(line.TrimEnd('\r'));

        return Task.FromResult(result);
    }

    public static ProcessResult Ok(string stdout = "") => new(0, stdout, string.Empty);
}

/// <summary>A release check that has never looked anything up, on a source build: <see cref="CachedStatus"/> is what it knows.</summary>
internal sealed class FakeReleaseCheck : IReleaseCheck
{
    public UpdateStatus? CachedStatus { get; set; }

    public DateTimeOffset? Notified { get; set; }

    public Func<Task> OnRefresh { get; set; } = () => Task.CompletedTask;

    public int Refreshes { get; private set; }

    public int MarkedNotified { get; private set; }

    public List<IReadOnlyList<ReleaseInfo>> Recorded { get; } = [];

    public UpdateStatus? Cached() => CachedStatus;

    public DateTimeOffset? NotifiedAt() => Notified;

    public Task RefreshAsync(TimeSpan timeout, CancellationToken ct = default)
    {
        Refreshes++;
        return OnRefresh();
    }

    public async Task<UpdateStatus> CurrentAsync(TimeSpan timeout, CancellationToken ct = default)
    {
        await RefreshAsync(timeout, ct);
        return CachedStatus ?? new UpdateStatus("0.0.0", null, false, InstallKind.Source, null);
    }

    public void Record(IReadOnlyList<ReleaseInfo> releases) => Recorded.Add(releases);

    public void MarkNotified() => MarkedNotified++;
}

internal sealed class StubInspector(InstallInfo info) : IInstallInspector
{
    public InstallInfo Info { get; set; } = info;

    public InstallInfo Inspect() => Info;
}

/// <summary>Release packages as the release workflow lays them out.</summary>
internal static class PackageBuilder
{
    public static List<(string Name, string Content)> Entries(string rid, string trom = "new trom")
    {
        return
        [
            ("README.txt", "new readme"),
            ($"api/{PlatformRid.ApiExecutable(rid)}", "new api"),
            ("api/appsettings.json", "{ }"),
            ("api/wwwroot/index.html", "<html></html>"),
            ("api/Assets/System/Config/readme.txt", "asset"),
            ($"cli/{PlatformRid.TromExecutable(rid)}", trom)
        ];
    }

    public static void WriteZip(string path, IEnumerable<(string Name, string Content)> entries)
    {
        using var zip = ZipFile.Open(path, ZipArchiveMode.Create);

        foreach (var (name, content) in entries)
        {
            var entry = zip.CreateEntry(name);
            using var writer = new StreamWriter(entry.Open(), new UTF8Encoding(false));
            writer.Write(content);
        }
    }

    /// <param name="prefix">What GNU <c>tar -C dir .</c> puts before every name.</param>
    /// <param name="more">Writes further entries after <paramref name="entries"/>, for ones a package must not hold.</param>
    public static void WriteTarGz(string path, IEnumerable<(string Name, string Content)> entries, string prefix = "./", Action<TarWriter>? more = null)
    {
        using var file = File.Create(path);
        using var gzip = new GZipStream(file, CompressionLevel.Fastest);
        using var tar = new TarWriter(gzip, TarEntryFormat.Pax);

        tar.WriteEntry(new PaxTarEntry(TarEntryType.Directory, prefix));

        foreach (var (name, content) in entries)
        {
            var entry = new PaxTarEntry(TarEntryType.RegularFile, prefix + name)
            {
                DataStream = new MemoryStream(Encoding.UTF8.GetBytes(content)),
                Mode = UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.GroupRead | UnixFileMode.OtherRead
            };
            tar.WriteEntry(entry);
        }

        more?.Invoke(tar);
    }
}
