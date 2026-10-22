using System.Diagnostics;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Tests;

public class EngineLauncherTests
{
    private const string Log = @"C:\Users\Some One\.teensyrom\api\Assets\System\Logs\engine-console.log";

    [Fact]
    public void ShellStartInfo_OnWindows_RunsAHiddenCmdThatRedirectsIntoTheLog()
    {
        var start = EngineLauncher.ShellStartInfo([@"C:\Program Files\Teensy ROM\TeensyRom.Api.exe"], Log, @"C:\Program Files\Teensy ROM", detached: true, windows: true);

        start.FileName.Should().EndWith("cmd.exe");
        start.Arguments.Should().Be($"/d /c \"\"C:\\Program Files\\Teensy ROM\\TeensyRom.Api.exe\" > \"{Log}\" 2>&1\"");
        start.UseShellExecute.Should().BeTrue();
        start.WindowStyle.Should().Be(ProcessWindowStyle.Hidden);
        start.WorkingDirectory.Should().Be(@"C:\Program Files\Teensy ROM");
    }

    [Fact]
    public void ShellStartInfo_OnWindows_QuotesTheDllWhenRunThroughDotnet()
    {
        var start = EngineLauncher.ShellStartInfo(["dotnet", @"C:\my repo\bin\TeensyRom.Api.dll"], Log, @"C:\my repo\bin", detached: true, windows: true);

        start.Arguments.Should().Be($"/d /c \"\"dotnet\" \"C:\\my repo\\bin\\TeensyRom.Api.dll\" > \"{Log}\" 2>&1\"");
    }

    [Fact]
    public void ShellStartInfo_OnUnix_BackgroundsTheEngineUnderNohupWithEveryStreamRedirected()
    {
        var start = EngineLauncher.ShellStartInfo(["/opt/teensy rom/TeensyRom.Api"], "/home/me/engine console.log", "/opt/teensy rom", detached: true, windows: false);

        start.FileName.Should().Be("/bin/sh");
        start.ArgumentList.Should().Equal("-c", "nohup \"$0\" \"$@\" > \"$LOG\" 2>&1 < /dev/null &", "/opt/teensy rom/TeensyRom.Api");
        start.Environment["LOG"].Should().Be("/home/me/engine console.log");
        start.UseShellExecute.Should().BeFalse();
        start.RedirectStandardInput.Should().BeTrue();
        start.RedirectStandardOutput.Should().BeTrue();
        start.RedirectStandardError.Should().BeTrue();
        start.WorkingDirectory.Should().Be("/opt/teensy rom");
    }

    [Fact]
    public void ShellStartInfo_OnUnix_RunsABuildInTheForegroundSoItCanBeAwaited()
    {
        var start = EngineLauncher.ShellStartInfo(["dotnet", "build", "/repo/Api.csproj"], "/home/me/build.log", "/repo", detached: false, windows: false);

        start.ArgumentList.Should().Equal("-c", "\"$0\" \"$@\" > \"$LOG\" 2>&1 < /dev/null", "dotnet", "build", "/repo/Api.csproj");
    }

    [Fact]
    public void Resolve_OfASourceEngine_PassesTheApiProjectsWwwrootAsTheWebRoot()
    {
        var root = Directory.CreateTempSubdirectory("teensyrom-launcher").FullName;

        try
        {
            var apiFolder = Path.Combine(root, "api", "TeensyRom.Api");
            var built = Path.Combine(apiFolder, "bin", "Debug", "net9.0");
            Directory.CreateDirectory(built);
            File.WriteAllText(Path.Combine(built, "TeensyRom.Api.dll"), "");
            File.WriteAllText(Path.Combine(built, "TeensyRom.Api.runtimeconfig.json"), "{}");

            var launch = EngineLauncher.Resolve(new EngineLocation(EngineMode.Source, root, Path.Combine(apiFolder, "TeensyRom.Api.csproj")));

            launch.Should().NotBeNull();
            launch!.WorkingDirectory.Should().Be(built);
            launch.Arguments.Should().Equal("--webroot", Path.Combine(apiFolder, "wwwroot"));
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    [Fact]
    public void Resolve_OfAPackagedEngine_PassesNoArguments()
    {
        var launch = EngineLauncher.Resolve(new EngineLocation(EngineMode.Packaged, Path.GetTempPath(), null));

        launch!.Arguments.Should().BeEmpty();
    }

    [Fact]
    public async Task BuildAsync_OfAProjectThatDoesNotBuild_FailsAndKeepsTheOutputInTheBuildLog()
    {
        Directory.CreateDirectory(TeensyRomHome.CliLogsPath);
        var missing = Path.Combine(Path.GetTempPath(), "teensyrom-no-such-folder", "NoSuchEngine.csproj");

        var step = await new EngineLauncher().BuildAsync(new EngineLocation(EngineMode.Source, Path.GetTempPath(), missing), default);

        step.Ok.Should().BeFalse();
        File.ReadAllText(TeensyRomHome.EngineBuildLogPath).Should().Contain("NoSuchEngine.csproj");
    }
}
