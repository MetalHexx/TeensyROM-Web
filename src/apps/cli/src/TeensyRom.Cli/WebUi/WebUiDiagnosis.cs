using TeensyRom.Cli.Api;
using TeensyRom.Cli.Common;
using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.WebUi;

internal static class WebUiDiagnosis
{
    private const string WebUiAddress = EngineAddress.BaseUrl + "/";

    /// <summary>Why a running engine isn't serving the web UI, and what to do about it.</summary>
    public static string Problem(IEngineLocator locator)
    {
        const string Restart = "run `trom api stop`, then `trom api start`";

        if (locator.Locate().Location is not { Mode: EngineMode.Source, ApiProject: { } apiProject } source)
        {
            return $"Trom API is running but isn't serving Trom UI at {WebUiAddress} — check its logs in {TeensyRomHome.EngineLogsPath}.";
        }

        var wwwroot = Path.Combine(Path.GetDirectoryName(apiProject)!, "wwwroot");

        return File.Exists(Path.Combine(wwwroot, "index.html"))
            ? $"Trom API is running but isn't serving Trom UI at {WebUiAddress} although {wwwroot} holds a build — {Restart} to restart it."
            : $"Trom UI isn't served because the front end isn't built: {wwwroot} has no index.html. Run `pnpm run build:frontend` from {Path.Combine(source.Folder, "src")}, then {Restart}.";
    }
}
