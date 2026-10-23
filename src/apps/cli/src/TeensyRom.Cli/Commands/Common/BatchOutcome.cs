using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Commands.Common;

/// <summary>The exit code rule of a command that works through many items and reports each one.</summary>
internal static class BatchOutcome
{
    /// <summary>
    /// 0 when nothing failed; otherwise writes <c>"{failed} of {total} {noun} failed."</c> with <see cref="ICliOutput.Error"/>
    /// and returns 5 when every failure was a not-found, else 1. Nothing is thrown, so <c>CliSession</c> never reports the
    /// run: reporting it here is what keeps <c>--json</c> ending stderr with the error object.
    /// </summary>
    /// <param name="anyFailedForOtherReasons">Some failure was something other than a not-found.</param>
    /// <param name="noun">What the items are, plural: <c>paths</c>, <c>files</c>.</param>
    public static int Finish(ICliOutput output, int total, int failed, bool anyFailedForOtherReasons, string noun)
    {
        if (failed == 0) return 0;

        var code = anyFailedForOtherReasons ? CliExitCode.Failed : CliExitCode.NotFound;

        output.Error(new CliException(code, $"{failed} of {total} {noun} failed."));

        return (int)code;
    }
}
