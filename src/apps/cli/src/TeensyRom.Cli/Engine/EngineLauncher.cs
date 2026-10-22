using System.ComponentModel;
using System.Diagnostics;
using TeensyRom.Cli.Common;

namespace TeensyRom.Cli.Engine;

/// <summary>The OS side of starting an engine: building it from source and launching it detached.</summary>
internal interface IEngineLauncher
{
    /// <summary>The build configuration a source engine is built and run in.</summary>
    string Configuration { get; }

    /// <summary>Builds the engine from source in <see cref="Configuration"/>; the failure names the build log.</summary>
    Task<EngineStep> BuildAsync(EngineLocation location, CancellationToken ct);

    /// <summary>Starts the engine detached from this process and returns without waiting for it to listen.</summary>
    EngineStep Launch(EngineLocation location);
}

/// <summary>
/// What to run to start the engine: the executable, the dll it needs when run through <c>dotnet</c>, where, and the
/// arguments the engine itself gets (none for a packaged engine).
/// </summary>
internal sealed record EngineLaunch(string Executable, string? Dll, string WorkingDirectory, IReadOnlyList<string> Arguments);

/// <summary>
/// Builds and starts the engine through the shell, with every standard stream redirected away from this process.
/// The engine outlives the CLI and the terminal, shows no window, and writes its console output to a log: a test host
/// or CI step reading this process's pipes would otherwise wait for the engine to exit.
/// </summary>
internal sealed class EngineLauncher : IEngineLauncher
{
    private const string BuildTarget = "net9.0";

    public string Configuration => EngineConfiguration.Current;

    public async Task<EngineStep> BuildAsync(EngineLocation location, CancellationToken ct)
    {
        var project = location.ApiProject ?? throw new InvalidOperationException("Only a source engine is built.");

        var command = BuildCommand(project, Configuration);

        try
        {
            using var process = Process.Start(ShellStartInfo(command, TeensyRomHome.EngineBuildLogPath, location.Folder, detached: false, OperatingSystem.IsWindows()))
                ?? throw new Win32Exception("the build process did not start");

            try
            {
                await process.WaitForExitAsync(ct);
            }
            catch (OperationCanceledException)
            {
                process.Kill(entireProcessTree: true);
                throw;
            }

            return process.ExitCode == 0 ? EngineStep.Success : EngineStep.Fail("the build failed");
        }
        catch (Win32Exception ex)
        {
            return EngineStep.Fail($"the build couldn't run: {ex.Message}");
        }
    }

    internal static string[] BuildCommand(string project, string configuration) =>
        ["dotnet", "build", project, "-c", configuration, "--nologo", "-v:minimal", "-nodeReuse:false"];

    public EngineStep Launch(EngineLocation location)
    {
        var launch = Resolve(location, Configuration);

        if (launch is null) return EngineStep.Fail("no built engine was found");

        TeensyRomHome.ExportToProcess();

        string[] command = [launch.Executable, .. launch.Dll is null ? [] : new[] { launch.Dll }, .. launch.Arguments];
        var logPath = Path.Combine(TeensyRomHome.EngineLogsPath, "engine-console.log");

        try
        {
            using var process = Process.Start(ShellStartInfo(command, logPath, launch.WorkingDirectory, detached: true, OperatingSystem.IsWindows()))
                ?? throw new Win32Exception("the engine process did not start");

            if (OperatingSystem.IsWindows()) return EngineStep.Success;

            process.StandardInput.Close();
            var errors = process.StandardError.ReadToEnd();
            process.WaitForExit();

            return process.ExitCode == 0
                ? EngineStep.Success
                : EngineStep.Fail($"the shell couldn't start it: {errors.Trim()}");
        }
        catch (Win32Exception ex)
        {
            return EngineStep.Fail($"it couldn't be launched: {ex.Message}");
        }
    }

    /// <summary>
    /// Wraps <paramref name="command"/> so the shell redirects its output into <paramref name="logPath"/>.
    /// Windows uses a hidden <c>cmd.exe</c> in its own console; macOS and Linux use <c>sh</c> with <c>nohup</c>
    /// (the shell's background job ignores SIGINT, so Ctrl+C in the CLI leaves the engine running).
    /// </summary>
    internal static ProcessStartInfo ShellStartInfo(IReadOnlyList<string> command, string logPath, string workingDirectory, bool detached, bool windows)
    {
        if (windows)
        {
            var quoted = string.Join(' ', command.Select(part => $"\"{part}\""));

            return new ProcessStartInfo(Path.Combine(Environment.SystemDirectory, "cmd.exe"))
            {
                Arguments = $"/d /c \"{quoted} > \"{logPath}\" 2>&1\"",
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Hidden,
                WorkingDirectory = workingDirectory
            };
        }

        var start = new ProcessStartInfo("/bin/sh")
        {
            UseShellExecute = false,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            WorkingDirectory = workingDirectory
        };
        start.ArgumentList.Add("-c");
        start.ArgumentList.Add(detached
            ? "nohup \"$0\" \"$@\" > \"$LOG\" 2>&1 < /dev/null &"
            : "\"$0\" \"$@\" > \"$LOG\" 2>&1 < /dev/null");
        foreach (var part in command) start.ArgumentList.Add(part);
        start.Environment["LOG"] = logPath;

        return start;
    }

    internal static EngineLaunch? Resolve(EngineLocation location, string configuration) => location.Mode == EngineMode.Packaged
        ? new EngineLaunch(Path.Combine(location.Folder, EngineLocator.ExecutableName), null, location.Folder, [])
        : ResolveBuilt(Path.GetDirectoryName(location.ApiProject!)!, configuration);

    // The newest build of the configuration wins; it may sit in a runtime-identifier subfolder such as win-x64. The engine runs from the
    // build folder, which has no wwwroot, so it is pointed at the API project's wwwroot to serve the built front end.
    private static EngineLaunch? ResolveBuilt(string apiProjectFolder, string configuration)
    {
        var binFolder = Path.Combine(apiProjectFolder, "bin", configuration, BuildTarget);

        if (!Directory.Exists(binFolder)) return null;

        var dll = Directory.EnumerateFiles(binFolder, "TeensyRom.Api.dll", SearchOption.AllDirectories)
            .Where(path => File.Exists(Path.ChangeExtension(path, ".runtimeconfig.json")))
            .OrderByDescending(File.GetLastWriteTimeUtc)
            .FirstOrDefault();

        if (dll is null) return null;

        var folder = Path.GetDirectoryName(dll)!;
        var apphost = Path.Combine(folder, EngineLocator.ExecutableName);

        string[] arguments = ["--webroot", Path.Combine(apiProjectFolder, "wwwroot")];

        return File.Exists(apphost)
            ? new EngineLaunch(apphost, null, folder, arguments)
            : new EngineLaunch("dotnet", dll, folder, arguments);
    }
}
