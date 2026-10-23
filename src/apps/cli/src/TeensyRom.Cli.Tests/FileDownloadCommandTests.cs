using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;
using Spectre.Console.Cli;
using System.Text;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Commands.File;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Storage.Entities;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom file download</c> through the real tree over substituted storage and transfer services that serve a small
/// in-memory device, saving into a throwaway folder.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class FileDownloadCommandTests : IDisposable
{
    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected", SdAvailable: true, UsbAvailable: true);

    private readonly string _root = Directory.CreateTempSubdirectory("trom-download-").FullName;
    private readonly string _originalFolder = Directory.GetCurrentDirectory();
    private readonly ITransferService _transfers = Substitute.For<ITransferService>();
    private readonly IStorageService _storage = Substitute.For<IStorageService>();
    private readonly List<TestHost> _hosts = [];
    private readonly Dictionary<string, DirectoryListing> _folders = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Exception> _failWith = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, Exception> _failMidCopy = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<string> _downloaded = [];
    private Func<string, Stream, Task>? _download;
    private Exception? _directoryError;

    public FileDownloadCommandTests()
    {
        Directory.SetCurrentDirectory(_root);

        _storage.StorageType.Returns(TeensyStorageType.SD);
        _storage.GetDirectory(default!).ReturnsForAnyArgs(call =>
        {
            if (_directoryError is not null) return Task.FromException<DirectoryListing>(_directoryError);

            var path = call.Arg<string>().TrimEnd('/');
            var key = path.Length == 0 ? "/" : path;

            return _folders.TryGetValue(key, out var listing)
                ? Task.FromResult(listing)
                : Task.FromException<DirectoryListing>(new TeensyApiException($"The directory {key} was not found.", 404));
        });
        _transfers.DownloadAsync(default, default!, default!, default).ReturnsForAnyArgs(async call =>
        {
            var path = call.ArgAt<string>(1);
            var destination = call.ArgAt<Stream>(2);

            if (_download is not null)
            {
                await _download(path, destination);
                return;
            }
            _downloaded.Add(path);

            if (_failWith.TryGetValue(path, out var error)) throw error;

            await destination.WriteAsync(Encoding.UTF8.GetBytes($"content of {path}"));

            if (_failMidCopy.TryGetValue(path, out var midCopy)) throw midCopy;
        });

        Folder("/", dirs: ["music", "games"], files: ["readme.txt"]);
        Folder("/music", files: ["Commando.sid", "Delta.sid"]);
        Folder("/games", dirs: ["sub"], files: ["a.prg"]);
        Folder("/games/sub", dirs: ["deep"], files: ["b.prg"]);
        Folder("/games/sub/deep", files: ["c.sid"]);
    }

    public void Dispose()
    {
        foreach (var host in _hosts) host.Dispose();

        Directory.SetCurrentDirectory(_originalFolder);
        Directory.Delete(_root, recursive: true);
    }

    private string Target => Path.Combine(_root, "target");

    private void Folder(string path, string[]? dirs = null, string[]? files = null)
    {
        var parent = path == "/" ? string.Empty : path;
        var listing = new DirectoryListing { Path = path };

        foreach (var dir in dirs ?? []) listing.Directories.Add(new DirectoryItem { Name = dir, Path = $"{parent}/{dir}" });
        foreach (var file in files ?? []) listing.Files.Add(Named($"{parent}/{file}", file));

        _folders[path] = listing;
    }

    private static IFileItem Named(string path, string name)
    {
        var item = FileItem.Create(path);

        item.Name = name;
        item.Path = path;
        return item;
    }

    private TestHost NewHost(string stdin = "")
    {
        var host = new TestHost(false, services =>
        {
            services.AddSingleton<IDeviceChooser, DeviceChooser>();
            services.Replace(ServiceDescriptor.Singleton(_storage));
            services.AddSingleton(_transfers);
            services.AddSingleton(new DownloadRunner(_storage, _transfers));
            services.AddSingleton(Substitute.For<ITypeResolver>());
            services.AddSingleton<IStdinPaths>(new StdinPaths(new StringReader(stdin), inputIsTerminal: false));
        });
        host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { Alpha });
        host.Devices.SelectedDevice.Returns(Alpha);
        _hosts.Add(host);
        return host;
    }

    private string[] Saved(string? folder = null) =>
        Directory.GetFiles(folder ?? _root, "*", SearchOption.AllDirectories)
            .Select(file => Path.GetRelativePath(folder ?? _root, file).Replace('\\', '/'))
            .Order(StringComparer.Ordinal)
            .ToArray();

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    private static string[] Lines(TestHost host) => host.Consoles.StdOut.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries);

    // ---- classifying -------------------------------------------------------------------------------------------------

    [Fact]
    public async Task ANamedFile_IsSavedAsItsName_IntoTheCurrentFolderByDefault()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/music/Commando.sid");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Saved().Should().Equal("Commando.sid");
        File.ReadAllText(Path.Combine(_root, "Commando.sid")).Should().Be("content of /music/Commando.sid");
        Lines(host).Should().Equal("/music/Commando.sid");
    }

    [Fact]
    public async Task ANamedFolder_ArrivesAsAFolderOfItsOwnName_WithItsLayoutRecreated_AndTheTargetCreated()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/games", "--to", Target);

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Saved(Target).Should().Equal("games/a.prg", "games/sub/b.prg", "games/sub/deep/c.sid");
    }

    [Fact]
    public async Task TheRoot_SavesItsContentsStraightIntoTheTarget()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/", "--to", Target);

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Saved(Target).Should().Equal("games/a.prg", "games/sub/b.prg", "games/sub/deep/c.sid", "music/Commando.sid", "music/Delta.sid", "readme.txt");
    }

    [Fact]
    public async Task ANameMatchedIgnoringCase_IsClassified()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/MUSIC/commando.SID", "/GAMES", "--to", Target);

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Saved(Target).Should().Equal("Commando.sid", "games/a.prg", "games/sub/b.prg", "games/sub/deep/c.sid");
    }

    [Fact]
    public async Task AMissingPath_IsANotFound_ThatDoesNotStopTheRest()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/music/missing.sid", "/music/Delta.sid", "--to", Target, "--json");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        var report = Parse(host.Consoles.StdOut);
        report.GetProperty("files")[0].GetProperty("ok").GetBoolean().Should().BeFalse();
        report.GetProperty("files")[0].GetProperty("message").GetString().Should().Be("not found");
        report.GetProperty("files")[1].GetProperty("ok").GetBoolean().Should().BeTrue();
        Saved(Target).Should().Equal("Delta.sid");
    }

    [Fact]
    public async Task AMissingFolderParent_IsANotFound()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/nowhere/x.sid", "--to", Target);

        exitCode.Should().Be((int)CliExitCode.NotFound);
    }

    [Fact]
    public async Task APathReadFromStdin_IsDownloadedLikeANamedOne()
    {
        var host = NewHost(stdin: "/music/Delta.sid\n");

        var exitCode = await host.RunAsync("file", "download", "-", "--to", Target);

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Saved(Target).Should().Equal("Delta.sid");
    }

    [Fact]
    public async Task APathReadFromStdin_ThatIsNotAValidUnixPath_IsAUsageError_BeforeAnythingIsSaved()
    {
        var host = NewHost(stdin: "not-a-path\n");

        var exitCode = await host.RunAsync("file", "download", "-", "--to", Target);

        exitCode.Should().Be((int)CliExitCode.Usage);
        _downloaded.Should().BeEmpty();
        Directory.Exists(Target).Should().BeFalse();
    }

    [Fact]
    public async Task AnArgumentThatIsNotAUnixPath_IsAUsageError()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "music", "--to", Target);

        exitCode.Should().Be((int)CliExitCode.Usage);
    }

    // ---- failures ----------------------------------------------------------------------------------------------------

    [Fact]
    public async Task AFileOverTheLimit_IsAFailure_AndTheRestAreSaved()
    {
        _failWith["/music/Commando.sid"] = new TeensyApiException("tr-web's own wording", 413);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/music", "--to", Target, "--json");

        exitCode.Should().Be((int)CliExitCode.Failed);
        var report = Parse(host.Consoles.StdOut);
        report.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(1);
        report.GetProperty("totals").GetProperty("failed").GetInt32().Should().Be(1);
        report.GetProperty("files")[0].GetProperty("message").GetString().Should().Be("larger than the 10 MB limit");
        Saved(Target).Should().Equal("music/Delta.sid");
        host.Consoles.StdErr.Should().Contain("1 of 2 files failed.");
    }

    [Fact]
    public async Task AStreamThatFailsMidCopy_LeavesNoFile_AndNoPartial()
    {
        _failMidCopy["/music/Commando.sid"] = new IOException("The connection was closed.");
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/music", "--to", Target);

        exitCode.Should().Be((int)CliExitCode.Failed);
        Saved(Target).Should().Equal("music/Delta.sid");
    }

    [Fact]
    public async Task ASameNamedFile_IsReplaced()
    {
        Directory.CreateDirectory(Target);
        File.WriteAllText(Path.Combine(Target, "Delta.sid"), "old");
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/music/Delta.sid", "--to", Target);

        exitCode.Should().Be(0, host.Consoles.StdErr);
        File.ReadAllText(Path.Combine(Target, "Delta.sid")).Should().Be("content of /music/Delta.sid");
        Saved(Target).Should().Equal("Delta.sid");
    }

    [Fact]
    public async Task HostileDeviceNames_AreFailures_AndNothingIsWrittenOutsideTheFolder()
    {
        var listing = new DirectoryListing { Path = "/bad" };

        listing.Files.Add(Named("/bad/..", ".."));
        listing.Files.Add(Named("/bad/C:evil.prg", "C:evil.prg"));
        listing.Files.Add(Named("/bad/a:b.prg", "a:b.prg"));
        listing.Files.Add(Named("/bad/ok.prg", "ok.prg"));
        listing.Directories.Add(new DirectoryItem { Name = "..", Path = "/bad/dotdot" });
        _folders["/bad"] = listing;
        _folders["/"].Directories.Add(new DirectoryItem { Name = "bad", Path = "/bad" });
        Folder("/bad/dotdot", files: ["escape.prg"]);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/bad", "--to", Target, "--json");

        exitCode.Should().Be((int)CliExitCode.Failed);
        var files = Parse(host.Consoles.StdOut).GetProperty("files").EnumerateArray().ToList();
        files.Where(file => !file.GetProperty("ok").GetBoolean()).Select(file => file.GetProperty("message").GetString())
            .Should().OnlyContain(message => message!.EndsWith("can't be saved on this computer under that name."))
            .And.HaveCount(4);
        Saved().Should().Equal("target/bad/ok.prg");
        _downloaded.Should().Equal("/bad/ok.prg");
    }

    // ---- output ------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Json_CarriesTheLocalAndDevicePathsAndTheTotals()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/music/Delta.sid", "--to", Target, "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var report = Parse(host.Consoles.StdOut);
        var file = report.GetProperty("files")[0];
        file.GetProperty("localPath").GetString().Should().Be(Path.Combine(Target, "Delta.sid"));
        file.GetProperty("devicePath").GetString().Should().Be("/music/Delta.sid");
        file.GetProperty("ok").GetBoolean().Should().BeTrue();
        report.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(1);
        report.GetProperty("totals").GetProperty("failed").GetInt32().Should().Be(0);
    }

    // ---- cancellation (the runner, driven with a token the test owns) ------------------------------------------------

    [Theory]
    [InlineData("canceled")]
    [InlineData("api-null-status")]
    public async Task ACancellationMidFile_IsNotThatFilesFailure_AndLeavesNoFileAndNoPartial(string how)
    {
        using var cancel = new CancellationTokenSource();
        var runner = new DownloadRunner(_storage, _transfers);

        _download = async (path, destination) =>
        {
            await destination.WriteAsync(new byte[] { 1, 2, 3 });
            _downloaded.Add(path);
            cancel.Cancel();

            throw how == "canceled"
                ? new OperationCanceledException(cancel.Token)
                : new TeensyApiException("The request was cancelled.", null, new OperationCanceledException());
        };

        var act = () => runner.RunAsync(["/music"], Target, null, cancel.Token);

        var error = (await act.Should().ThrowAsync<CliException>()).Which;
        error.Code.Should().Be(CliExitCode.Failed);
        error.Message.Should().Be("Cancelled; nothing more was saved.");
        _downloaded.Should().Equal("/music/Commando.sid");
        Saved().Should().BeEmpty();
    }

    [Fact]
    public async Task APathThatCannotBeClassified_BecauseTheDeviceFailed_IsReportedWithTheDevicesSentence()
    {
        _directoryError = new TeensyApiException("Storage isn't available.", 500);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "download", "/music/Delta.sid", "--to", Target);

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("1 of 1 files failed.");
    }
}
