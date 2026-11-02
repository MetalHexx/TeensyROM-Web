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
/// <c>wslview</c> then <c>xdg-open</c> inside WSL. An opener that is missing or fails hands over to the next one.
/// </summary>
internal sealed class BrowserOpener : IBrowserOpener
{
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
                failure = $"{info.FileName} couldn't start: {ex.Message}";
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

        if (process.ExitCode == 0) return new BrowserOpenResult(true);

        var error = (await process.StandardError.ReadToEndAsync(ct)).Trim().Split('\n')[0].Trim();

        return new BrowserOpenResult(false, error.Length > 0
            ? $"{info.FileName} failed: {error}"
            : $"{info.FileName} exited with code {process.ExitCode}.");
    }

    private static ProcessStartInfo Opener(string file, string url)
    {
        var info = new ProcessStartInfo(file)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        info.ArgumentList.Add(url);
        return info;
    }
}
