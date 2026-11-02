using System.ComponentModel;
using System.Diagnostics;

namespace TeensyRom.Cli.WebUi;

internal enum BrowserPlatform { Windows, MacOS, Linux, Wsl }

/// <summary>Whether a browser was asked to open a page; <see cref="Failure"/> says why not.</summary>
internal sealed record BrowserOpenResult(bool Opened, string? Failure = null);

/// <summary>Opens a page in the user's default browser.</summary>
internal interface IBrowserOpener
{
    Task<BrowserOpenResult> OpenAsync(string url, CancellationToken ct = default);
}

/// <summary>
/// Opens a page with the platform's own opener: the shell on Windows, <c>open</c> on macOS, <c>xdg-open</c> on Linux, and
/// <c>wslview</c> then <c>xdg-open</c> inside WSL. An opener that is missing or fails hands over to the next one. Outside
/// Windows an opener runs under <c>/bin/sh</c> with its output sent to <c>/dev/null</c>.
/// </summary>
internal sealed class BrowserOpener : IBrowserOpener
{
    /// <summary>The exit code a shell gives for a program it can't find.</summary>
    private const int NotFound = 127;

    /// <summary>How long a non-Windows opener is waited for; one still running then has most likely started a browser in the foreground.</summary>
    public static readonly TimeSpan OpenerWait = TimeSpan.FromSeconds(5);

    public static BrowserPlatform Current { get; } =
        Detect(OperatingSystem.IsWindows(), OperatingSystem.IsMacOS(), Environment.GetEnvironmentVariable("WSL_DISTRO_NAME"));

    public static BrowserPlatform Detect(bool isWindows, bool isMacOs, string? wslDistro) =>
        isWindows ? BrowserPlatform.Windows
        : isMacOs ? BrowserPlatform.MacOS
        : string.IsNullOrEmpty(wslDistro) ? BrowserPlatform.Linux
        : BrowserPlatform.Wsl;

    /// <summary>The openers to try for <paramref name="url"/>, in order.</summary>
    public static IReadOnlyList<ProcessStartInfo> StartInfos(string url, BrowserPlatform platform) => platform switch
    {
        BrowserPlatform.Windows => [new ProcessStartInfo(url) { UseShellExecute = true }],
        BrowserPlatform.MacOS => [Opener("open", url)],
        BrowserPlatform.Wsl => [Opener("wslview", url), Opener("xdg-open", url)],
        _ => [Opener("xdg-open", url)]
    };

    public async Task<BrowserOpenResult> OpenAsync(string url, CancellationToken ct = default)
    {
        string? failure = null;

        foreach (var info in StartInfos(url, Current))
        {
            try
            {
                var result = await TryOpenAsync(info, ct);

                if (result.Opened) return result;

                failure = result.Failure;
            }
            catch (Win32Exception ex)
            {
                failure = $"{NameOf(info)} couldn't start: {ex.Message}";
            }
        }
        return new BrowserOpenResult(false, failure ?? "No browser opener is available.");
    }

    private static async Task<BrowserOpenResult> TryOpenAsync(ProcessStartInfo info, CancellationToken ct)
    {
        using var process = Process.Start(info);

        if (process is null || info.UseShellExecute) return new BrowserOpenResult(true);

        using var wait = CancellationTokenSource.CreateLinkedTokenSource(ct);
        wait.CancelAfter(OpenerWait);

        try
        {
            await process.WaitForExitAsync(wait.Token);
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            return new BrowserOpenResult(true);
        }

        return process.ExitCode switch
        {
            0 => new BrowserOpenResult(true),
            NotFound => new BrowserOpenResult(false, $"{NameOf(info)} isn't installed."),
            var code => new BrowserOpenResult(false, $"{NameOf(info)} exited with code {code}.")
        };
    }

    /// <summary>The opener to name in a failure: the program the shell runs, or the address a Windows shell opens.</summary>
    private static string NameOf(ProcessStartInfo info) => info.UseShellExecute ? info.FileName : info.ArgumentList[^2];

    // The opener's output goes to /dev/null inside the shell: redirected pipes that nobody reads would stall it, or kill a
    // browser it starts that outlives trom once the pipes close. Its exit code still says whether it worked.
    private static ProcessStartInfo Opener(string file, string url)
    {
        var info = new ProcessStartInfo("/bin/sh")
        {
            UseShellExecute = false,
            CreateNoWindow = true
        };
        info.ArgumentList.Add("-c");
        info.ArgumentList.Add("\"$0\" \"$1\" >/dev/null 2>&1");
        info.ArgumentList.Add(file);
        info.ArgumentList.Add(url);
        return info;
    }
}
