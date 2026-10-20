using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using TeensyRom.Cli.Common;

namespace TeensyRom.Cli.Engine;

/// <summary>
/// Tells whether the engine a source-mode CLI started still matches the engine sources. The engine reports the same
/// version for every build, so the version alone can't say.
/// </summary>
internal interface ISourceFreshness
{
    /// <summary>The fingerprint of the engine sources in the checkout at <paramref name="repoRoot"/>, or <see cref="SourceFingerprint.Unknown"/>.</summary>
    string Current(string repoRoot);

    /// <summary>The fingerprint recorded when this CLI last started an engine from source; null when none.</summary>
    string? Recorded();

    void Record(string fingerprint);
}

/// <summary>
/// The fingerprint is <c>git rev-parse HEAD</c> plus a hash of <c>git status --porcelain</c> and <c>git diff HEAD</c>,
/// limited to the engine's sources. The api-spec file is excluded because every build rewrites it. A checkout git
/// can't read has no fingerprint (<see cref="Unknown"/>), which always counts as fresh.
/// </summary>
internal sealed class SourceFingerprint : ISourceFreshness
{
    public const string Unknown = "unknown";

    private static readonly string[] Pathspecs =
        ["src/apps/api", "src/apps/Version.props", ":!src/apps/api/src/TeensyRom.Api/api-spec"];

    public string Current(string repoRoot)
    {
        var head = RunGit(repoRoot, "rev-parse", "HEAD");
        var status = RunGit(repoRoot, ["--no-optional-locks", "status", "--porcelain", "--", .. Pathspecs]);
        var diff = RunGit(repoRoot, ["--no-optional-locks", "diff", "HEAD", "--", .. Pathspecs]);

        if (head is null || status is null || diff is null) return Unknown;

        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{status}\n--\n{diff}"))).ToLowerInvariant();

        return $"{head.Trim()}:{hash}";
    }

    public string? Recorded()
    {
        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(TeensyRomHome.SourceEngineRecordPath));

            return document.RootElement.TryGetProperty("fingerprint", out var value) ? value.GetString() : null;
        }
        catch (Exception ex) when (ex is IOException or JsonException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    public void Record(string fingerprint)
    {
        Directory.CreateDirectory(TeensyRomHome.CliPath);

        File.WriteAllText(
            TeensyRomHome.SourceEngineRecordPath,
            JsonSerializer.Serialize(new { fingerprint, startedAt = DateTimeOffset.UtcNow }));
    }

    private static string? RunGit(string repoRoot, params string[] arguments)
    {
        var start = new ProcessStartInfo("git")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            RedirectStandardInput = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8
        };
        start.ArgumentList.Add("-C");
        start.ArgumentList.Add(repoRoot);
        foreach (var argument in arguments) start.ArgumentList.Add(argument);

        try
        {
            using var process = Process.Start(start);

            if (process is null) return null;

            process.StandardInput.Close();
            var errors = process.StandardError.ReadToEndAsync();
            var output = process.StandardOutput.ReadToEnd();
            process.WaitForExit();
            errors.GetAwaiter().GetResult();

            return process.ExitCode == 0 ? output : null;
        }
        catch (System.ComponentModel.Win32Exception)
        {
            return null;
        }
    }
}
