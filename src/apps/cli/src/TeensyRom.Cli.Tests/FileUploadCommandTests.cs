using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;
using NSubstitute.ExceptionExtensions;
using Spectre.Console.Cli;
using System.Text.Json;
using TeensyRom.Cli.Api;
using TeensyRom.Cli.Api.Generated;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Commands.File;
using TeensyRom.Cli.Commands.Main.Launcher;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Player;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Storage.Entities;
using TeensyStorageType = TeensyRom.Cli.Storage.Entities.TeensyStorageType;

namespace TeensyRom.Cli.Tests;

/// <summary>
/// <c>trom file upload</c> through the real tree over a substituted transfer service, with a throwaway folder tree as the
/// local side. The substitute plays the engine's job: it stays <c>Receiving</c> until sealed, then ends as configured.
/// </summary>
[Collection(ConsoleCollection.Name)]
public sealed class FileUploadCommandTests : IDisposable
{
    private static readonly DeviceSummary Alpha = new("a-1", "Alpha", true, "USB COM3", "Connected", SdAvailable: true, UsbAvailable: true);

    private readonly string _root = Directory.CreateTempSubdirectory("trom-upload-").FullName;
    private readonly string _originalFolder = Directory.GetCurrentDirectory();
    private readonly ITransferService _transfers = Substitute.For<ITransferService>();
    private readonly IStorageService _storage = Substitute.For<IStorageService>();
    private readonly IPlayerService _player = Substitute.For<IPlayerService>();
    private readonly InMemoryLastLaunchStore _store = new();
    private readonly List<TestHost> _hosts = [];
    private readonly List<string> _calls = [];
    private readonly List<(string Relative, string Local)> _uploaded = [];
    private readonly List<TransferFileCompleted> _failures = [];
    private readonly Dictionary<string, Exception> _uploadErrors = [];
    private TeensyStorageType _storageType = TeensyStorageType.SD;
    private TransferJobState _endState = TransferJobState.Completed;
    private string? _jobError;
    private int _archiveEntries;
    private volatile bool _sealed;
    private (TeensyStorageType Storage, string Folder, int Archives)? _created;
    private Exception? _createError;

    public FileUploadCommandTests()
    {
        Directory.SetCurrentDirectory(_root);

        Write("games/a.prg", 2048);
        Write("games/sub/b.prg", 1024);
        Write("games/sub/deep/c.sid", 512);
        Write("games/.DS_Store", 16, hidden: true);
        Write("games/.cache/leftover.bin", 16, hiddenFolder: "games/.cache");
        Write("loose.sid", 100);

        _storage.StorageType.Returns(_ => _storageType);
        _storage.When(s => s.UseStorage(Arg.Any<TeensyStorageType>())).Do(call => _storageType = call.Arg<TeensyStorageType>());

        _transfers.CreateAsync(default, default!, default, default).ReturnsForAnyArgs(call =>
        {
            if (_createError is not null) return Task.FromException<TransferJobDto>(_createError);

            _created = (call.ArgAt<TeensyStorageType>(0), call.ArgAt<string>(1), call.ArgAt<int>(2));
            _calls.Add("create");
            return Task.FromResult(Job(TransferJobState.Created));
        });
        _transfers.UploadAsync(default!, default!, default!, default).ReturnsForAnyArgs(call =>
        {
            var relative = call.ArgAt<string>(1);

            lock (_uploaded)
            {
                _calls.Add($"upload {relative}");

                if (_uploadErrors.TryGetValue(relative, out var error)) return Task.FromException(error);

                _uploaded.Add((relative, call.ArgAt<string>(2)));
            }
            return Task.CompletedTask;
        });
        _transfers.SealAsync(default!, default).ReturnsForAnyArgs(_ =>
        {
            _calls.Add("seal");
            _sealed = true;
            return Task.CompletedTask;
        });
        _transfers.GetAsync(default!, default).ReturnsForAnyArgs(_ => Task.FromResult(Job(_sealed ? _endState : TransferJobState.Receiving)));
        _transfers.CancelAsync(default!).ReturnsForAnyArgs(_ =>
        {
            _calls.Add("cancel");
            return Task.CompletedTask;
        });
    }

    public void Dispose()
    {
        foreach (var host in _hosts) host.Dispose();

        Directory.SetCurrentDirectory(_originalFolder);
        Directory.Delete(_root, recursive: true);
    }

    private TestHost NewHost(bool terminal = false, string stdin = "")
    {
        var host = new TestHost(terminal, services =>
        {
            services.AddSingleton<IDeviceChooser, DeviceChooser>();
            services.Replace(ServiceDescriptor.Singleton(_storage));
            services.Replace(ServiceDescriptor.Singleton<ILastLaunchStore>(_store));
            services.AddSingleton(_player);
            services.AddSingleton(_transfers);
            services.AddSingleton(new UploadRunner(_transfers, _store) { PollInterval = TimeSpan.FromMilliseconds(5) });
            services.AddSingleton(Substitute.For<ITypeResolver>());
            services.AddSingleton<IStdinPaths>(new StdinPaths(new StringReader(stdin), inputIsTerminal: false));
        });
        host.Engine.EnsureRunningAsync(Arg.Any<CancellationToken>()).Returns(EngineReady.Ready);
        host.Devices.GetDevicesAsync(Arg.Any<CancellationToken>()).Returns(new[] { Alpha });
        host.Devices.SelectedDevice.Returns(Alpha);
        _hosts.Add(host);
        return host;
    }

    private void Write(string relative, int size, bool hidden = false, string? hiddenFolder = null)
    {
        var path = Path.Combine(_root, relative);

        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllBytes(path, new byte[size]);

        if (hidden) File.SetAttributes(path, FileAttributes.Hidden);
        if (hiddenFolder is not null) new DirectoryInfo(Path.Combine(_root, hiddenFolder)).Attributes |= FileAttributes.Hidden;
    }

    private void CurrentFolder(string relative) => Directory.SetCurrentDirectory(Path.Combine(_root, relative));

    private TransferJobDto Job(TransferJobState state)
    {
        lock (_uploaded)
        {
            return new TransferJobDto
            {
                JobId = "job-1",
                DeviceId = Alpha.Id,
                State = state,
                FilesSent = _uploaded.Count(upload => !UploadSources.IsArchive(upload.Relative) && _failures.All(failure => failure.RelativePath != upload.Relative)) + _archiveEntries,
                FilesFailed = _failures.Count,
                Error = _jobError,
                Failures = _failures.ToList()
            };
        }
    }

    /// <summary>What an earlier <c>trom</c> run left behind for a device that was playing.</summary>
    internal static LastLaunchRecord PlayingRecord(string deviceId) => new(
        deviceId, "Alpha", TeensyStorageType.SD, new LaunchedFile("/music/old.sid", 1), PlayMode.CurrentDirectory, null,
        TeensyRom.Cli.Settings.TeensyFilterType.Music, StorageScope.DirShallow, "/music", PlayState.Playing, [], 0);

    private static TransferFileCompleted Failure(string relative, string target, string error) =>
        new() { JobId = "job-1", RelativePath = relative, TargetPath = target, Success = false, Error = error };

    private string[] Uploaded() => _uploaded.Select(upload => upload.Relative).ToArray();

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement;

    private static string[] Lines(TestHost host) => host.Consoles.StdOut.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries);

    private static JsonElement LastError(TestHost host) =>
        Parse(host.Consoles.StdErr.TrimEnd().Split('\n')[^1]).GetProperty("error");

    private static async Task AssertEngineNeverStarted(TestHost host) =>
        await host.Engine.DidNotReceiveWithAnyArgs().EnsureRunningAsync(default);

    // ---- sources -----------------------------------------------------------------------------------------------------

    [Fact]
    public async Task ANamedFile_ArrivesAsItsName_AndIsReported()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "loose.sid", "--to", "/music");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        _created.Should().Be((TeensyStorageType.SD, "/music", 0));
        _uploaded.Should().Equal([("loose.sid", Path.Combine(_root, "loose.sid"))]);
        _calls.Should().Equal("create", "upload loose.sid", "seal");
        Lines(host).Should().Equal("/music/loose.sid");
    }

    [Fact]
    public async Task ANamedFolder_ArrivesAsAFolderOfItsOwnName_WithItsLayoutKept_AndHiddenThingsLeftBehind()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "games", "--to", "/");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Uploaded().Should().Equal("games/a.prg", "games/sub/b.prg", "games/sub/deep/c.sid");
        Lines(host).Should().Equal("/games/a.prg", "/games/sub/b.prg", "/games/sub/deep/c.sid");
    }

    [Theory]
    [InlineData(".")]
    [InlineData("./")]
    [InlineData("")]
    public async Task TheCurrentFolder_SendsItsContents_WhetherNamedOrImplied(string named)
    {
        CurrentFolder("games");
        var host = NewHost();
        string[] args = named.Length == 0 ? ["file", "upload", "--to", "/x", "--yes"] : ["file", "upload", named, "--to", "/x"];

        var exitCode = await host.RunAsync(args);

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Uploaded().Should().Equal("a.prg", "sub/b.prg", "sub/deep/c.sid");
        Lines(host).Should().Equal("/x/a.prg", "/x/sub/b.prg", "/x/sub/deep/c.sid");
    }

    [Fact]
    public async Task ADeviceFolderOfTheRoot_DoesNotDoubleTheSlash()
    {
        var host = NewHost();

        await host.RunAsync("file", "upload", "loose.sid", "--to", "/");

        Lines(host).Should().Equal("/loose.sid");
    }

    [Fact]
    public async Task SeveralSources_AreSentInTheOrderNamed_EachWithItsOwnShape()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "loose.sid", "games/sub", "--to", "/mix");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Uploaded().Should().Equal("loose.sid", "sub/b.prg", "sub/deep/c.sid");
    }

    [Fact]
    public async Task APathReadFromStdin_IsSentLikeANamedOne()
    {
        var host = NewHost(stdin: "loose.sid\n");

        var exitCode = await host.RunAsync("file", "upload", "-", "--to", "/music");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Uploaded().Should().Equal("loose.sid");
    }

    [Fact]
    public async Task HiddenFilesAndFolders_AreSkipped_EvenWhenTheirParentIsNamed()
    {
        var host = NewHost();

        await host.RunAsync("file", "upload", "games", "--to", "/");

        Uploaded().Should().NotContain(path => path.Contains(".DS_Store") || path.Contains(".cache"));
    }

    [Fact]
    public async Task Links_AreNeverFollowed()
    {
        var outside = Directory.CreateTempSubdirectory("trom-outside-").FullName;
        var linkedFolder = Path.Combine(_root, "games", "linked-folder");

        try
        {
            File.WriteAllBytes(Path.Combine(outside, "leak.prg"), [1]);

            if (!TryLinkFolder(linkedFolder, outside)) return; // this machine can't make links, so there is nothing to walk past

            TryLinkFile(Path.Combine(_root, "games", "linked-file.prg"), Path.Combine(outside, "leak.prg"));
            var host = NewHost();

            var exitCode = await host.RunAsync("file", "upload", "games", "--to", "/");

            exitCode.Should().Be(0, host.Consoles.StdErr);
            Uploaded().Should().Equal("games/a.prg", "games/sub/b.prg", "games/sub/deep/c.sid");
        }
        finally
        {
            if (Directory.Exists(linkedFolder)) Directory.Delete(linkedFolder);
            Directory.Delete(outside, recursive: true);
        }
    }

    /// <summary>A symbolic link, or on Windows without the privilege a junction (also a reparse point); false when neither can be made.</summary>
    private static bool TryLinkFolder(string link, string target)
    {
        try
        {
            Directory.CreateSymbolicLink(link, target);
            return true;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            if (!OperatingSystem.IsWindows()) return false;
        }
        using var mklink = System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo("cmd.exe", $"/c mklink /J \"{link}\" \"{target}\"") { CreateNoWindow = true, RedirectStandardOutput = true });

        mklink!.WaitForExit();

        return mklink.ExitCode == 0 && Directory.Exists(link);
    }

    private static void TryLinkFile(string link, string target)
    {
        try
        {
            File.CreateSymbolicLink(link, target);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            // Only folders can be linked without a privilege on Windows.
        }
    }

    // ---- the file-type filter, the notice and the total ----------------------------------------------------------------

    [Fact]
    public async Task AFolder_SendsOnlySupportedTypes_IgnoringCase_AndSaysHowManyWereLeftOut()
    {
        Write("mixed/a.sid", 10);
        Write("mixed/B.PRG", 10);
        Write("mixed/notes.md", 10);
        Write("mixed/deep/c.d64", 10);
        Write("mixed/deep/readme.md", 10);
        Write("mixed/deep/pack.ZIP", 10);
        Write("mixed/hidden.sid", 10, hidden: true);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "mixed", "--to", "/x");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Uploaded().Should().Equal("mixed/B.PRG", "mixed/a.sid", "mixed/deep/c.d64", "mixed/deep/pack.ZIP");
        host.Consoles.StdErr.Should().Contain("2 files were left out");
        host.Consoles.StdOut.Should().NotContain("left out");
    }

    [Fact]
    public async Task TheLeftOutNotice_IsNotPartOfTheJsonDocument_AndASingleFileReadsInTheSingular()
    {
        Write("mixed/a.sid", 10);
        Write("mixed/notes.md", 10);
        Write("mixed/hidden.md", 10, hidden: true);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "mixed", "--to", "/x", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Parse(host.Consoles.StdOut).GetProperty("totals").GetProperty("failed").GetInt32().Should().Be(0);
        host.Consoles.StdOut.Should().NotContain("left out");
        host.Consoles.StdErr.Should().Contain("1 file was left out");
    }

    [Fact]
    public async Task AFolderHoldingNothingSupported_HasNothingToUpload_AndMentionsFileTypes()
    {
        Write("docs/notes.md", 10);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "docs", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain("nothing to upload").And.Contain("file type");
        await AssertEngineNeverStarted(host);
    }

    [Fact]
    public async Task ANamedFileOfAnUnsupportedType_IsAFailedRowWithItsOwnMessage_AndExitsOne()
    {
        Write("notes.md", 10);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "notes.md", "--to", "/x", "--json");

        exitCode.Should().Be((int)CliExitCode.Failed);
        var report = Parse(host.Consoles.StdOut);
        var row = report.GetProperty("files")[0];
        row.GetProperty("localPath").GetString().Should().Be("notes.md");
        row.GetProperty("ok").GetBoolean().Should().BeFalse();
        row.GetProperty("message").GetString().Should().Be("not a file type the TeensyROM takes");
        report.GetProperty("totals").GetProperty("failed").GetInt32().Should().Be(1);
        await AssertEngineNeverStarted(host);
    }

    [Fact]
    public async Task ANamedUnsupportedFile_BesideASupportedOne_IsAFailedRow_ThatIsNotANotFound()
    {
        Write("notes.md", 10);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "loose.sid", "notes.md", "--to", "/x", "--json");

        exitCode.Should().Be((int)CliExitCode.Failed);
        Uploaded().Should().Equal("loose.sid");
        var report = Parse(host.Consoles.StdOut);
        report.GetProperty("files")[1].GetProperty("message").GetString().Should().Be("not a file type the TeensyROM takes");
        report.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(1);
        report.GetProperty("totals").GetProperty("failed").GetInt32().Should().Be(1);
    }

    [Theory]
    [InlineData(1, "Copied 1 file.")]
    [InlineData(2, "Copied 2 files.")]
    public async Task ACleanRun_EndsWithTheTotalOnStderr_AndNotInTheJsonDocument(int count, string expected)
    {
        string[] named = count == 1 ? ["loose.sid"] : ["loose.sid", "games/a.prg"];
        var human = NewHost();
        var json = NewHost();

        await human.RunAsync(["file", "upload", .. named, "--to", "/x"]);
        await json.RunAsync(["file", "upload", .. named, "--to", "/x", "--json"]);

        human.Consoles.StdErr.Should().Contain(expected);
        human.Consoles.StdOut.Should().NotContain("Copied ");
        json.Consoles.StdErr.Should().NotContain("Copied ");
        Parse(json.Consoles.StdOut).GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(count);
    }

    [Fact]
    public async Task AFailedRun_WritesNoTotal()
    {
        _failures.Add(Failure("loose.sid", "/x/loose.sid", "boom"));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "loose.sid", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("1 of 1 files failed.").And.NotMatchRegex(@"Copied \d+ file");
    }

    [Fact]
    public async Task Archives_AreSentAsTheyAre_AndCountedWhateverTheirCase()
    {
        Write("packs/one.zip", 10);
        Write("packs/two.7z", 10);
        Write("packs/THREE.RAR", 10);
        Write("packs/plain.txt", 10);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "packs", "--to", "/demos");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        _created.Should().Be((TeensyStorageType.SD, "/demos", 3));
        Uploaded().Should().BeEquivalentTo("packs/one.zip", "packs/two.7z", "packs/THREE.RAR", "packs/plain.txt");
    }

    [Fact]
    public async Task TheChosenStorage_IsTheOneTheJobIsCreatedOn()
    {
        var host = NewHost();

        await host.RunAsync("file", "upload", "loose.sid", "--to", "/music", "--storage", "usb");

        _created!.Value.Storage.Should().Be(TeensyStorageType.USB);
    }

    // ---- the guard ---------------------------------------------------------------------------------------------------

    [Fact]
    public async Task NoPaths_InATerminal_AsksWithTheCountAndSize_AndSendsWhenAnswered_Yes()
    {
        CurrentFolder("games");
        var host = NewHost(terminal: true);
        host.Consoles.Err.Input.PushTextWithEnter("y");

        var exitCode = await host.RunAsync("file", "upload", "--to", "/x");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        host.Consoles.StdErr.Should().Contain($"Send 3 files (3.5 KB) from {Path.Combine(_root, "games")} to /x on the TeensyROM?");
        Uploaded().Should().Equal("a.prg", "sub/b.prg", "sub/deep/c.sid");
        host.Consoles.StdOut.Should().Contain("/x/a.prg");
    }

    [Fact]
    public async Task NoPaths_InATerminal_SendsNothing_WhenAnswered_No_AndNeverStartsTheEngine()
    {
        CurrentFolder("games");
        var host = NewHost(terminal: true);
        host.Consoles.Err.Input.PushTextWithEnter("n");

        var exitCode = await host.RunAsync("file", "upload", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("Cancelled; nothing was sent.");
        _calls.Should().BeEmpty();
        await AssertEngineNeverStarted(host);
    }

    [Fact]
    public async Task NoPaths_InATerminal_DefaultsToNo()
    {
        CurrentFolder("games");
        var host = NewHost(terminal: true);
        host.Consoles.Err.Input.PushKey(ConsoleKey.Enter);

        var exitCode = await host.RunAsync("file", "upload", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.Failed);
        _calls.Should().BeEmpty();
    }

    [Fact]
    public async Task NoPaths_OutsideATerminal_IsAUsageError_AndNeverStartsTheEngine()
    {
        CurrentFolder("games");
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("No files were named.").And.Contain("use . for the current folder").And.Contain("--yes").And.Contain(Path.Combine(_root, "games"));
        _calls.Should().BeEmpty();
        await AssertEngineNeverStarted(host);
    }

    [Fact]
    public async Task NoPaths_WithYes_SendsTheContentsWithoutAsking()
    {
        CurrentFolder("games");
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "--to", "/x", "-y");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        Uploaded().Should().Equal("a.prg", "sub/b.prg", "sub/deep/c.sid");
        host.Consoles.StdErr.Should().NotContain("TeensyROM?");
    }

    [Fact]
    public async Task ANamedSource_IsNeverAskedAbout_EvenInATerminal()
    {
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("file", "upload", ".", "--to", "/x");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        host.Consoles.StdErr.Should().NotContain("TeensyROM?");
    }

    [Fact]
    public async Task AnEmptyCurrentFolder_IsNotAskedAbout_AndIsNothingToUpload()
    {
        var empty = Path.Combine(_root, "empty");
        Directory.CreateDirectory(empty);
        Directory.SetCurrentDirectory(empty);
        var host = NewHost(terminal: true);

        var exitCode = await host.RunAsync("file", "upload", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain($"There's nothing to upload in {empty}.").And.NotContain("TeensyROM?");
        await AssertEngineNeverStarted(host);
    }

    // ---- usage -------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task AMissingTo_IsAUsageError_AndNeverStartsTheEngine()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "loose.sid");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("--to is required: the folder on the TeensyROM the files land in, such as /games");
        await AssertEngineNeverStarted(host);
    }

    [Fact]
    public async Task AToThatIsNotAUnixPath_IsAUsageError()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "loose.sid", "--to", "games");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("valid unix path");
        await AssertEngineNeverStarted(host);
    }

    [Theory]
    [InlineData("games", "is a folder")]
    [InlineData("pack.zip", "an archive")]
    [InlineData("notes.txt", "only launches")]
    [InlineData("nothing-here.prg", "wasn't found")]
    public async Task Launch_OfAnythingButOneLaunchableFile_IsAUsageError_BeforeTheEngineStarts(string path, string reason)
    {
        Write("pack.zip", 10);
        Write("notes.txt", 10);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "--launch", path, "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("--launch").And.Contain(reason);
        _calls.Should().BeEmpty();
        await AssertEngineNeverStarted(host);
    }

    [Fact]
    public async Task Launch_WithTwoPaths_IsAUsageError_ThatExplainsWhy()
    {
        Write("x.prg", 10);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "--launch", "x.prg", "loose.sid", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("--launch takes exactly one file, but 2 paths were given");
        await AssertEngineNeverStarted(host);
    }

    [Fact]
    public async Task Launch_WithNoPath_IsAUsageError()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "--launch", "--to", "/x", "--yes");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("--launch needs the one file");
        await AssertEngineNeverStarted(host);
    }

    [Fact]
    public async Task Launch_WithSeveralPathsFromStdin_IsAUsageError_BeforeTheEngineStarts()
    {
        Write("x.prg", 10);
        var host = NewHost(stdin: "x.prg\nloose.sid\n");

        var exitCode = await host.RunAsync("file", "upload", "--launch", "-", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("2 paths were given");
        await AssertEngineNeverStarted(host);
    }

    // ---- launch ------------------------------------------------------------------------------------------------------

    [Fact]
    public async Task Launch_SendsTheFile_ThenLaunchesIt_WithFileLaunchOutput()
    {
        Write("x.prg", 10);
        var item = new GameItem { Name = "x.prg", Path = "/games/x.prg", Size = 10 };
        _storage.GetFile("/games/x.prg").Returns(item);
        _player.LaunchOnceAsync(item).Returns(new LaunchOutcome(LaunchStatus.Launched, item, "Launched"));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "--launch", "x.prg", "--to", "/games");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        _calls.Should().Equal("create", "upload x.prg", "seal");
        _player.ReceivedCalls().Select(call => call.GetMethodInfo().Name).Where(name => name is "UseStorage" or "LaunchOnceAsync")
            .Should().Equal("UseStorage", "LaunchOnceAsync");
        Lines(host).Should().Equal("/games/x.prg");
    }

    [Fact]
    public async Task Launch_Json_IsTheLaunchDocument_NotTheCopyReport()
    {
        Write("x.prg", 10);
        var item = new GameItem { Name = "x.prg", Path = "/games/x.prg", Size = 10 };
        _storage.GetFile("/games/x.prg").Returns(item);
        _player.LaunchOnceAsync(item).Returns(new LaunchOutcome(LaunchStatus.Launched, item, "Launched"));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "--launch", "x.prg", "--to", "/games", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var document = Parse(host.Consoles.StdOut);
        document.GetProperty("status").GetString().Should().Be("launched");
        document.TryGetProperty("totals", out _).Should().BeFalse();
    }

    [Fact]
    public async Task Launch_OfAFileTheDeviceRefused_DoesNotLaunch_AndReportsTheCopy()
    {
        Write("x.prg", 10);
        _uploadErrors["x.prg"] = new TeensyApiException("The path is not usable.", 400);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "--launch", "x.prg", "--to", "/games");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("The path is not usable.").And.Contain("1 of 1 files failed.");
        await _player.DidNotReceiveWithAnyArgs().LaunchOnceAsync(default!);
    }

    [Fact]
    public async Task Launch_OfAFileThatIsNotThereAfterTheUpload_IsNotFound()
    {
        Write("x.prg", 10);
        _storage.GetFile("/games/x.prg").Returns((ILaunchableItem?)null);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "--launch", "x.prg", "--to", "/games");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain("/games/x.prg wasn't found on the TeensyROM after the upload.");
        await _player.DidNotReceiveWithAnyArgs().LaunchOnceAsync(default!);
    }

    // ---- the run -----------------------------------------------------------------------------------------------------

    [Fact]
    public async Task ABusyDevice_IsExitOne_WithTheBusySentence_AndNothingIsUploaded()
    {
        _createError = new CliException(CliExitCode.Failed, "Alpha is busy with another transfer — try again when it finishes.");
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "loose.sid", "--to", "/music");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("Alpha is busy with another transfer — try again when it finishes.");
        await _transfers.DidNotReceiveWithAnyArgs().UploadAsync(default!, default!, default!, default);
        await _transfers.DidNotReceiveWithAnyArgs().CancelAsync(default!);
    }

    [Fact]
    public async Task AFileTheEngineRefuses_IsThatFilesFailure_AndTheRestCarryOn()
    {
        _uploadErrors["games/sub/b.prg"] = new TeensyApiException("The path is not usable.", 400);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "games", "--to", "/", "--json");

        exitCode.Should().Be((int)CliExitCode.Failed);
        Uploaded().Should().Equal("games/a.prg", "games/sub/deep/c.sid");
        _calls.Should().Contain("seal");
        var report = Parse(host.Consoles.StdOut);
        var files = report.GetProperty("files").EnumerateArray().ToArray();
        files.Select(file => file.GetProperty("ok").GetBoolean()).Should().Equal(true, false, true);
        files[1].GetProperty("devicePath").GetString().Should().Be("/games/sub/b.prg");
        files[1].GetProperty("message").GetString().Should().Be("The path is not usable.");
        report.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(2);
        report.GetProperty("totals").GetProperty("failed").GetInt32().Should().Be(1);
        LastError(host).GetProperty("message").GetString().Should().Be("1 of 3 files failed.");
    }

    [Fact]
    public async Task AFileThatCantBeRead_IsThatFilesFailure_AndTheRestCarryOn()
    {
        _uploadErrors["loose.sid"] = new IOException("The file is in use.");
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "loose.sid", "games/a.prg", "--to", "/x", "--json");

        exitCode.Should().Be((int)CliExitCode.Failed);
        Uploaded().Should().Equal("a.prg");
        Parse(host.Consoles.StdOut).GetProperty("files")[0].GetProperty("message").GetString().Should().Be("The file is in use.");
    }

    [Fact]
    public async Task AFailureTheJobRecorded_MarksThatFile_AndOneInsideAnArchiveIsReportedAgainstTheArchive()
    {
        Write("packs/pack.zip", 10);
        Write("packs/ok.prg", 10);
        _failures.Add(Failure("packs/ok.prg", "/demos/packs/ok.prg", "The TeensyROM ran out of space."));
        _failures.Add(Failure("packs/pack/inside.sid", "/demos/packs/pack/inside.sid", "Entry rejected."));
        _archiveEntries = 4;
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "packs", "--to", "/demos", "--json");

        exitCode.Should().Be((int)CliExitCode.Failed);
        var report = Parse(host.Consoles.StdOut);
        var files = report.GetProperty("files").EnumerateArray().ToArray();
        files.Should().HaveCount(3);
        files[0].GetProperty("localPath").GetString().Should().Be(Path.Combine(_root, "packs", "ok.prg"));
        files[0].GetProperty("ok").GetBoolean().Should().BeFalse();
        files[0].GetProperty("message").GetString().Should().Be("The TeensyROM ran out of space.");
        files[1].GetProperty("ok").GetBoolean().Should().BeTrue();
        files[2].GetProperty("localPath").GetString().Should().Be(Path.Combine(_root, "packs", "pack.zip"));
        files[2].GetProperty("devicePath").GetString().Should().Be("/demos/packs/pack/inside.sid");
        files[2].GetProperty("ok").GetBoolean().Should().BeFalse();
        files[2].GetProperty("message").GetString().Should().Be("Entry rejected.");
        report.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(4);
        report.GetProperty("totals").GetProperty("failed").GetInt32().Should().Be(2);
    }

    [Fact]
    public async Task ANamedPathThatDoesNotExist_IsANotFoundFailure_AndTheRestAreStillSent()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "missing.sid", "loose.sid", "--to", "/x", "--json");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        Uploaded().Should().Equal("loose.sid");
        var files = Parse(host.Consoles.StdOut).GetProperty("files").EnumerateArray().ToArray();
        files.Should().HaveCount(2);
        files[1].GetProperty("localPath").GetString().Should().Be("missing.sid");
        files[1].GetProperty("ok").GetBoolean().Should().BeFalse();
        files[1].GetProperty("message").GetString().Should().Be("not found");
        LastError(host).GetProperty("message").GetString().Should().Be("1 of 2 files failed.");
    }

    [Fact]
    public async Task ANotFoundAlongsideAnotherKindOfFailure_IsExitOne()
    {
        _uploadErrors["loose.sid"] = new TeensyApiException("The path is not usable.", 400);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "missing.sid", "loose.sid", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.Failed);
    }

    [Fact]
    public async Task OnlyNamedPathsThatDoNotExist_IsExitFive_WithoutStartingTheEngine()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "missing.sid", "gone", "--to", "/x", "--json");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        await AssertEngineNeverStarted(host);
        _calls.Should().BeEmpty();
        var report = Parse(host.Consoles.StdOut);
        report.GetProperty("files").GetArrayLength().Should().Be(2);
        report.GetProperty("totals").GetProperty("failed").GetInt32().Should().Be(2);
        LastError(host).GetProperty("message").GetString().Should().Be("2 of 2 files failed.");
    }

    [Fact]
    public async Task AFolderWithNothingToSend_IsExitFive_WithOneSentence()
    {
        var empty = Path.Combine(_root, "empty");
        Directory.CreateDirectory(empty);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "empty", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain($"There's nothing to upload in {empty}.");
        await AssertEngineNeverStarted(host);
    }

    [Fact]
    public async Task Json_IsTheFilesAndTotalsDocument()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "loose.sid", "--to", "/music", "--json");

        exitCode.Should().Be(0, host.Consoles.StdErr);
        var report = Parse(host.Consoles.StdOut);
        report.EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo("files", "totals");
        var file = report.GetProperty("files")[0];
        file.EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo("localPath", "devicePath", "ok", "message");
        file.GetProperty("localPath").GetString().Should().Be(Path.Combine(_root, "loose.sid"));
        file.GetProperty("devicePath").GetString().Should().Be("/music/loose.sid");
        file.GetProperty("ok").GetBoolean().Should().BeTrue();
        report.GetProperty("totals").EnumerateObject().Select(p => p.Name).Should().BeEquivalentTo("copied", "failed");
        report.GetProperty("totals").GetProperty("copied").GetInt32().Should().Be(1);
        report.GetProperty("totals").GetProperty("failed").GetInt32().Should().Be(0);
    }

    [Fact]
    public async Task Plain_ListsTheDevicePathsThatSucceeded_AndReportsFailuresAsNotices()
    {
        _uploadErrors["games/sub/b.prg"] = new TeensyApiException("The path is not usable.", 400);
        var host = NewHost();

        await host.RunAsync("file", "upload", "games", "--to", "/");

        Lines(host).Should().Equal("/games/a.prg", "/games/sub/deep/c.sid");
        host.Consoles.StdErr.Should().Contain("b.prg: The path is not usable.");
    }

    [Fact]
    public async Task InATerminal_TheResultsAreATable_OfLocalPath_DevicePath_AndResult()
    {
        _uploadErrors["games/sub/b.prg"] = new TeensyApiException("The path is not usable.", 400);
        var host = NewHost(terminal: true);

        await host.RunAsync("file", "upload", "games", "--to", "/");

        host.Consoles.StdOut.Should().Contain("Local path").And.Contain("Device path").And.Contain("Result")
            .And.Contain("/games/a.prg").And.Contain("Copied").And.Contain("Failed: The path is not usable.");
    }

    [Fact]
    public async Task AJobThatEndsAborted_ShowsItsError_AndIsExitOne_EvenWithNoFailureRecorded()
    {
        _endState = TransferJobState.Aborted;
        _jobError = "The TeensyROM stopped answering.";
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "upload", "loose.sid", "--to", "/x");

        exitCode.Should().Be((int)CliExitCode.Failed);
        host.Consoles.StdErr.Should().Contain("The TeensyROM stopped answering.").And.Contain("The transfer ended before every file was sent.");
    }

    [Fact]
    public async Task AJobThatSentFiles_StopsTheDevicesLastLaunchRecord()
    {
        _store.Seed(PlayingRecord(Alpha.Id));
        var host = NewHost();

        await host.RunAsync("file", "upload", "loose.sid", "--to", "/x");

        _store.Load(Alpha.Id)!.PlayState.Should().Be(PlayState.Stopped);
    }

    // ---- file launch hint --------------------------------------------------------------------------------------------

    [Fact]
    public async Task FileLaunch_OfALocalFileThatIsNotAUnixPath_PointsToUploadLaunch_BeforeTheEngineStarts()
    {
        Write("x.prg", 10);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "launch", "x.prg");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("x.prg is a file on this computer, not on the TeensyROM — use `trom file upload --launch x.prg --to <device folder>`");
        await AssertEngineNeverStarted(host);
    }

    [Fact]
    public async Task FileLaunch_OfANonUnixPathThatIsNotALocalFile_KeepsTheGenericMessage()
    {
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "launch", "nothing.prg");

        exitCode.Should().Be((int)CliExitCode.Usage);
        host.Consoles.StdErr.Should().Contain("The path must be a valid unix path").And.NotContain("on this computer");
    }

    /// <summary>A unix-style absolute path that also names <paramref name="local"/> on this machine.</summary>
    private static string UnixLookalike(string local) => "/" + local[Path.GetPathRoot(local)!.Length..].Replace('\\', '/');

    [Fact]
    public async Task FileLaunch_OfAUnixPathThatIsOnlyLocal_PointsToUploadLaunch_WhenTheDeviceHasNoSuchFile()
    {
        Write("x.prg", 10);
        var path = UnixLookalike(Path.Combine(_root, "x.prg"));
        _storage.GetFile(path).Returns((ILaunchableItem?)null);
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "launch", path);

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain($"{path} is a file on this computer, not on the TeensyROM — use `trom file upload --launch {path} --to <device folder>`");
    }

    [Fact]
    public async Task FileLaunch_OfAUnixPathThatIsOnlyLocal_PointsToUploadLaunch_WhenTheDevicesFolderIsMissing()
    {
        Write("x.prg", 10);
        var path = UnixLookalike(Path.Combine(_root, "x.prg"));
        _storage.GetFile(path).ThrowsAsyncForAnyArgs(new TeensyApiException("The directory does not exist on this storage.", 404));
        var host = NewHost();

        var exitCode = await host.RunAsync("file", "launch", path);

        exitCode.Should().Be((int)CliExitCode.NotFound);
        host.Consoles.StdErr.Should().Contain("is a file on this computer, not on the TeensyROM");
    }

    [Fact]
    public async Task FileLaunch_OfAUnixPathThatIsNotLocal_KeepsTodaysMessages()
    {
        _storage.GetFile("/nowhere/at/all.prg").Returns((ILaunchableItem?)null);
        var missingFolder = NewHost();
        var missing = await missingFolder.RunAsync("file", "launch", "/nowhere/at/all.prg");
        _storage.GetFile("/nowhere/at/gone.prg").ThrowsAsyncForAnyArgs(new TeensyApiException("The directory does not exist on this storage.", 404));
        var failing = NewHost();

        var failed = await failing.RunAsync("file", "launch", "/nowhere/at/gone.prg");

        missing.Should().Be((int)CliExitCode.NotFound);
        missingFolder.Consoles.StdErr.Should().Contain("There is no launchable file at /nowhere/at/all.prg.");
        failed.Should().Be((int)CliExitCode.NotFound);
        failing.Consoles.StdErr.Should().Contain("The directory does not exist on this storage.").And.NotContain("on this computer");
    }
}

/// <summary>The job lifecycle <c>file upload</c> runs, over a fake engine and with time made short.</summary>
public sealed class UploadRunnerTests
{
    private const string DeviceId = "a-1";

    /// <summary>
    /// An engine whose job stays Receiving until <see cref="SealAsync"/> runs, then ends in <see cref="EndState"/>. Tests
    /// change how it behaves through the hooks rather than by re-stubbing a substitute, which would run the previous
    /// behaviour as a side effect.
    /// </summary>
    private sealed class FakeTransfers : ITransferService
    {
        private readonly object _lock = new();
        private readonly List<string> _calls = [];
        private volatile TransferJobState _state = TransferJobState.Receiving;
        private int _polls;

        public TransferJobState EndState { get; set; } = TransferJobState.Completed;

        public int Sent { get; set; }

        public int Failed { get; set; }

        public int Received { get; set; }

        public int Polls => Volatile.Read(ref _polls);

        public (TeensyStorageType Storage, string Folder, int Archives)? Created { get; private set; }

        public Func<string, CancellationToken, Task> Upload { get; set; } = (_, _) => Task.CompletedTask;

        public Func<Task>? OnSeal { get; set; }

        public Func<Task>? OnCancel { get; set; }

        public Action? OnPoll { get; set; }

        /// <summary>Makes the job end right now, as the engine does when it aborts one.</summary>
        public void EndNow() => _state = EndState;

        public string[] Calls
        {
            get
            {
                lock (_lock) return [.. _calls];
            }
        }

        private void Record(string call)
        {
            lock (_lock) _calls.Add(call);
        }

        private TransferJobDto Job() => new() { JobId = "job-1", DeviceId = DeviceId, State = _state, FilesSent = Sent, FilesFailed = Failed, FilesReceived = Received };

        public Task<TransferJobDto> CreateAsync(TeensyStorageType storage, string deviceFolder, int expectedArchiveCount, CancellationToken ct)
        {
            Created = (storage, deviceFolder, expectedArchiveCount);
            Record("create");
            return Task.FromResult(Job());
        }

        public Task UploadAsync(string jobId, string relativePath, string localFile, CancellationToken ct)
        {
            Record($"upload {relativePath}");
            return Upload(relativePath, ct);
        }

        public async Task SealAsync(string jobId, CancellationToken ct)
        {
            Record("seal");
            _state = EndState;
            if (OnSeal is not null) await OnSeal();
        }

        public Task<TransferJobDto> GetAsync(string jobId, CancellationToken ct)
        {
            Interlocked.Increment(ref _polls);
            OnPoll?.Invoke();
            return Task.FromResult(Job());
        }

        public Task DownloadAsync(TeensyStorageType storage, string devicePath, Stream destination, CancellationToken ct) =>
            throw new NotSupportedException();

        public async Task CancelAsync(string jobId)
        {
            Record("cancel");
            if (OnCancel is not null) await OnCancel();
        }
    }

    private readonly FakeTransfers _transfers = new();
    private readonly InMemoryLastLaunchStore _store = new();

    private static UploadFile Upload(string name, bool archive = false) => new(Path.Combine(Path.GetTempPath(), name), name, 1, archive);

    private static readonly UploadFile[] ThreeFiles = [Upload("a.prg"), Upload("b.prg"), Upload("c.prg")];

    private Task<UploadRunResult> RunAsync(IReadOnlyList<UploadFile> files, Action<UploadProgress>? progress = null, CancellationToken ct = default) =>
        new UploadRunner(_transfers, _store) { PollInterval = TimeSpan.FromMilliseconds(5) }.RunAsync(TeensyStorageType.SD, "/x", files, progress, ct);

    private void SeedPlaying() => _store.Seed(FileUploadCommandTests.PlayingRecord(DeviceId));

    [Fact]
    public async Task Run_CreatesUploadsInOrderSealsAndReturnsTheEndedJob()
    {
        var result = await RunAsync([ThreeFiles[0], ThreeFiles[1]]);

        _transfers.Calls.Should().Equal("create", "upload a.prg", "upload b.prg", "seal");
        result.Job.State.Should().Be(TransferJobState.Completed);
        result.Rejected.Should().BeEmpty();
    }

    [Fact]
    public async Task Run_CreatesTheJobOnTheStorageAndFolder_DeclaringTheArchives()
    {
        await RunAsync([Upload("a.prg"), Upload("pack.zip", archive: true), Upload("b.7z", archive: true)]);

        _transfers.Created.Should().Be((TeensyStorageType.SD, "/x", 2));
    }

    [Fact]
    public async Task Run_PollsTheJobWhileUploadsAreStillInFlight()
    {
        var polledTwiceMore = new TaskCompletionSource();
        var pollsWhenUploadReturned = -1;
        _transfers.OnPoll = () =>
        {
            if (_transfers.Polls >= 3) polledTwiceMore.TrySetResult();
        };
        _transfers.Upload = async (_, _) =>
        {
            await polledTwiceMore.Task.WaitAsync(TimeSpan.FromSeconds(10));
            pollsWhenUploadReturned = _transfers.Polls;
        };

        await RunAsync([ThreeFiles[0]]);

        pollsWhenUploadReturned.Should().BeGreaterThanOrEqualTo(3, "the poll must not wait for the upload, or for the seal");
    }

    [Fact]
    public async Task Run_ReportsProgress_FromTheJobsCountsAndTheLocalCountUntilTheJobKnowsItsTotal()
    {
        _transfers.Sent = 1;
        _transfers.Upload = (_, _) => Task.FromException(new TeensyApiException("Refused.", 400));
        var seen = new List<UploadProgress>();

        await RunAsync([ThreeFiles[0]], progress => { lock (seen) seen.Add(progress); });

        lock (seen)
        {
            seen.Should().NotBeEmpty();
            seen.Should().OnlyContain(progress => progress.Total == 1 && progress.Sent == 1);
            seen[^1].Failed.Should().Be(1, "a rejected upload counts as failed");
        }
    }

    [Fact]
    public async Task Run_ARefused400OrAnUnreadableFile_IsThatFilesRejection_AndTheRestCarryOn()
    {
        var answers = new Queue<Exception?>([new TeensyApiException("Refused.", 400), new FileNotFoundException("Gone."), null]);
        _transfers.Upload = (_, _) => answers.Dequeue() is { } error ? Task.FromException(error) : Task.CompletedTask;

        var result = await RunAsync(ThreeFiles);

        result.Rejected.Select(rejection => (rejection.File.RelativePath, rejection.Message)).Should().Equal(("a.prg", "Refused."), ("b.prg", "Gone."));
        _transfers.Calls.Should().Equal("create", "upload a.prg", "upload b.prg", "upload c.prg", "seal");
    }

    [Theory]
    [InlineData("canceled")]
    [InlineData("api-null-status")]
    [InlineData("api-400")]
    [InlineData("io")]
    public async Task Run_CancelledMidUpload_CancelsTheJob_AndIsNeverAFilesFailure(string how)
    {
        using var cancel = new CancellationTokenSource();
        var uploads = 0;
        _transfers.Upload = (_, _) =>
        {
            if (++uploads == 1) return Task.CompletedTask;

            cancel.Cancel();
            return Task.FromException(how switch
            {
                "canceled" => new OperationCanceledException(cancel.Token),
                "api-null-status" => new TeensyApiException("The request was cancelled.", null, new OperationCanceledException()),
                "api-400" => new TeensyApiException("Refused.", 400),
                _ => new IOException("Read aborted.")
            });
        };

        var act = () => RunAsync(ThreeFiles, ct: cancel.Token);

        var error = (await act.Should().ThrowAsync<CliException>()).Which;
        error.Code.Should().Be(CliExitCode.Failed);
        error.Message.Should().Be("Cancelled; the TeensyROM was released and nothing more was sent.");
        _transfers.Calls.Should().Equal("create", "upload a.prg", "upload b.prg", "cancel");
    }

    [Fact]
    public async Task Run_CancelledWhileWaitingForTheJobToEnd_CancelsIt()
    {
        using var cancel = new CancellationTokenSource();
        _transfers.EndState = TransferJobState.Receiving;
        _transfers.OnSeal = () =>
        {
            cancel.Cancel();
            return Task.CompletedTask;
        };

        var act = () => RunAsync([ThreeFiles[0]], ct: cancel.Token);

        await act.Should().ThrowAsync<CliException>();
        _transfers.Calls.Should().EndWith("cancel");
    }

    [Fact]
    public async Task Run_WhenAnUploadFailsForAnyOtherReason_ReleasesTheDevice_AndLetsTheFailureThrough()
    {
        _transfers.Upload = (_, _) => Task.FromException(new TeensyApiException("tr-web stopped answering.", null, new HttpRequestException()));

        var act = () => RunAsync(ThreeFiles);

        await act.Should().ThrowAsync<TeensyApiException>();
        _transfers.Calls.Should().Equal("create", "upload a.prg", "cancel");
    }

    [Fact]
    public async Task Run_WhenCancellingTheJobFails_StillLetsTheOriginalFailureThrough()
    {
        _transfers.Upload = (_, _) => Task.FromException(new TeensyApiException("Original.", 500));
        _transfers.OnCancel = () => Task.FromException(new TeensyApiException("tr-web stopped answering.", null));

        var act = () => RunAsync(ThreeFiles);

        (await act.Should().ThrowAsync<TeensyApiException>()).Which.Message.Should().Be("Original.");
    }

    [Fact]
    public async Task Run_NeverCancelsAJobThatEndedOnItsOwn()
    {
        await RunAsync(ThreeFiles);

        _transfers.Calls.Should().NotContain("cancel");
    }

    [Fact]
    public async Task Run_WhenTheJobEndsWhileFilesWait_RejectsTheRest_AndDoesNotSeal()
    {
        _transfers.EndState = TransferJobState.Aborted;
        _transfers.Upload = async (_, _) =>
        {
            _transfers.EndNow();
            await Task.Delay(100);
        };

        var result = await RunAsync(ThreeFiles);

        result.Job.State.Should().Be(TransferJobState.Aborted);
        result.Rejected.Select(rejection => rejection.File.RelativePath).Should().Equal("b.prg", "c.prg");
        result.Rejected.Should().OnlyContain(rejection => rejection.Message == "The transfer ended before this file was sent.");
        _transfers.Calls.Should().Equal("create", "upload a.prg");
    }

    [Fact]
    public async Task Run_StopsTheLastLaunchRecord_WhenTheJobSentOrFailedAnything()
    {
        SeedPlaying();
        _transfers.Sent = 2;

        await RunAsync(ThreeFiles);

        _store.Load(DeviceId)!.PlayState.Should().Be(PlayState.Stopped);
    }

    [Fact]
    public async Task Run_StopsTheLastLaunchRecord_WhenTheFirstFileHasOnlyBeenReceived()
    {
        SeedPlaying();
        _transfers.Received = 1;

        await RunAsync(ThreeFiles);

        _store.Load(DeviceId)!.PlayState.Should().Be(PlayState.Stopped);
    }

    [Fact]
    public async Task Run_LeavesTheLastLaunchRecordAlone_WhenNothingWasSentOrFailed()
    {
        SeedPlaying();

        await RunAsync(ThreeFiles);

        _store.Load(DeviceId)!.PlayState.Should().Be(PlayState.Playing);
    }

    [Fact]
    public async Task Run_StopsTheLastLaunchRecord_EvenWhenCancelled()
    {
        SeedPlaying();
        _transfers.Failed = 1;
        using var cancel = new CancellationTokenSource();
        _transfers.Upload = (_, _) =>
        {
            cancel.Cancel();
            return Task.FromCanceled(cancel.Token);
        };

        var act = () => RunAsync(ThreeFiles, ct: cancel.Token);

        await act.Should().ThrowAsync<CliException>();
        _store.Load(DeviceId)!.PlayState.Should().Be(PlayState.Stopped);
    }
}

public sealed class UploadSourcesTests
{
    [Theory]
    [InlineData(0, "0 KB")]
    [InlineData(1536, "1.5 KB")]
    [InlineData(1024 * 1024 - 1, "1024 KB")]
    [InlineData(1024 * 1024, "1 MB")]
    [InlineData(5767168, "5.5 MB")]
    public void FormatSize_IsKilobytesBelowAMegabyte_ThenMegabytes(long bytes, string expected)
    {
        UploadSources.FormatSize(bytes).Should().Be(expected);
    }

    [Theory]
    [InlineData("a.zip", true)]
    [InlineData("a.7Z", true)]
    [InlineData("dir/a.RAR", true)]
    [InlineData("a.tar", false)]
    [InlineData("zip", false)]
    [InlineData("a.zip.prg", false)]
    public void IsArchive_MatchesZip7zAndRar_IgnoringCase(string name, bool expected)
    {
        UploadSources.IsArchive(name).Should().Be(expected);
    }
}
