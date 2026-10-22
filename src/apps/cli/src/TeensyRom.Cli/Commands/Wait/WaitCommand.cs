using Spectre.Console;
using Spectre.Console.Cli;
using System.ComponentModel;
using System.Globalization;
using System.Text.RegularExpressions;
using TeensyRom.Cli.Commands.Common;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Output;

namespace TeensyRom.Cli.Commands.Wait;

/// <summary>
/// The duration <c>trom wait</c> takes: unit strings (<c>45s</c>, <c>3m20s</c>, <c>1h2m3s</c>) or clock strings
/// (<c>3:20</c> is minutes and seconds, <c>00:03:20</c> hours, minutes and seconds; seconds may carry a fraction).
/// </summary>
internal static partial class WaitDuration
{
    public static readonly TimeSpan Min = TimeSpan.FromSeconds(1);

    public static readonly TimeSpan Max = TimeSpan.FromHours(6);

    public const string AcceptedForms = "a duration like 45s, 3m, 3m20s, 1h2m3s, 3:20 (minutes:seconds) or 00:03:20 (hours:minutes:seconds), between 1 second and 6 hours";

    [GeneratedRegex(@"^(?=.)(?:(?<h>\d{1,9})h)?(?:(?<m>\d{1,9})m)?(?:(?<s>\d{1,9})s)?$", RegexOptions.IgnoreCase)]
    private static partial Regex UnitForm();

    [GeneratedRegex(@"^(?<a>\d{1,9}):(?:(?<b>\d{1,2}):)?(?<sec>\d{1,2}(?:\.\d{1,9})?)$")]
    private static partial Regex ClockForm();

    /// <summary>Parses <paramref name="text"/>; false when it is not an accepted form or is outside 1 second to 6 hours.</summary>
    public static bool TryParse(string? text, out TimeSpan duration)
    {
        duration = default;

        if (string.IsNullOrWhiteSpace(text)) return false;

        var value = text.Trim();
        decimal seconds;

        if (UnitForm().Match(value) is { Success: true } unit)
        {
            seconds = Number(unit, "h") * 3600 + Number(unit, "m") * 60 + Number(unit, "s");
        }
        else if (ClockForm().Match(value) is { Success: true } clock)
        {
            var secondPart = decimal.Parse(clock.Groups["sec"].Value, CultureInfo.InvariantCulture);

            if (secondPart >= 60) return false;

            if (clock.Groups["b"].Success)
            {
                var minutes = Number(clock, "b");

                if (minutes >= 60) return false;

                seconds = Number(clock, "a") * 3600 + minutes * 60 + secondPart;
            }
            else
            {
                seconds = Number(clock, "a") * 60 + secondPart;
            }
        }
        else
        {
            return false;
        }

        if (seconds > (decimal)Max.TotalSeconds) return false;

        duration = TimeSpan.FromTicks((long)Math.Round(seconds * TimeSpan.TicksPerSecond));

        return duration >= Min && duration <= Max;
    }

    private static decimal Number(Match match, string group) =>
        match.Groups[group].Success ? decimal.Parse(match.Groups[group].Value, CultureInfo.InvariantCulture) : 0;
}

internal sealed class WaitSettings : TromSettings
{
    [Description("How long to wait: 45s, 3m, 3m20s, 1h2m3s, 3:20 (minutes:seconds) or 00:03:20 (hours:minutes:seconds). From 1 second to 6 hours.")]
    [CommandArgument(0, "<DURATION>")]
    public string Duration { get; set; } = "";

    public override ValidationResult Validate() =>
        WaitDuration.TryParse(Duration, out _)
            ? base.Validate()
            : ValidationResult.Error($"'{Duration}' isn't a duration trom wait accepts — use {WaitDuration.AcceptedForms}.");
}

/// <summary>The JSON result of <c>trom wait</c>: <c>{ "waited": "00:03:20" }</c>.</summary>
internal sealed record WaitDocument(string Waited);

/// <summary>
/// <c>trom wait</c>: a timer that behaves the same on every operating system, for scripts and agents. Needs no
/// engine and no device. Ctrl+C cancels it and exits 1.
/// </summary>
internal sealed class WaitCommand(ICliOutput output, IEngineClock clock) : TromCommand<WaitSettings>(output)
{
    protected override async Task<int> RunAsync(CommandContext context, WaitSettings settings, CancellationToken ct)
    {
        WaitDuration.TryParse(settings.Duration, out var duration);

        using var cancel = new CancellationTokenSource();
        ConsoleCancelEventHandler onCancel = (_, args) =>
        {
            args.Cancel = true;
            cancel.Cancel();
        };

        Console.CancelKeyPress += onCancel;

        try
        {
            await clock.DelayAsync(duration, cancel.Token);
        }
        catch (OperationCanceledException)
        {
            throw new CliException(CliExitCode.Failed, "The wait was cancelled.");
        }
        finally
        {
            Console.CancelKeyPress -= onCancel;
        }

        if (Output.Mode == OutputMode.Json) Output.Json(new WaitDocument(duration.ToString("c", CultureInfo.InvariantCulture)));

        return 0;
    }
}
