using Spectre.Console;
using TeensyRom.Cli.Engine;
using TeensyRom.Cli.Output;
using TeensyRom.Cli.Services;
using TeensyRom.Cli.Settings;

namespace TeensyRom.Cli.PathSetup;

/// <summary>
/// Offers, once, to put <c>trom</c> on the user's PATH. It runs before the session picks its consoles, so it talks
/// on stderr explicitly: stdout may be about to carry data.
/// </summary>
internal sealed class PathOffer(ICliOutput output, ISettingsService settingsService, IEngineLocator locator, PathRegistrar registrar)
{
    /// <summary>
    /// Asks one yes/no question when every condition holds: all three streams are terminals; the command line is not
    /// help, the version or a <c>path</c> command; the offer hasn't been answered; this CLI is a packaged install, not a
    /// source tree; and <c>trom</c> is not on the PATH. The answer is recorded whatever it is. A failure to add is
    /// one sentence on stderr and never stops the command the user ran.
    /// </summary>
    /// <returns>True when the question was asked.</returns>
    public Task<bool> MaybeOfferAsync(string[] args)
    {
        if (!ShouldOffer(args)) return Task.FromResult(false);

        var accepted = output.Err.Confirm("Add trom to your PATH so you can run it from any folder?", defaultValue: true);

        var settings = settingsService.GetSettings();
        settings.PathOfferAnswered = true;
        settingsService.SaveSettings(settings);

        if (accepted) Add();

        return Task.FromResult(true);
    }

    private bool ShouldOffer(string[] args) =>
        output.CanPrompt
        && !IsHelpVersionOrPath(args)
        && !settingsService.GetSettings().PathOfferAnswered
        && locator.Locate().Location?.Mode == EngineMode.Packaged
        && !registrar.IsOnPath();

    private static bool IsHelpVersionOrPath(string[] args) =>
        CommandRouting.AsksForHelp(args)
        || args.Any(arg => arg is "--version" or "-v")
        || args.FirstOrDefault(arg => !arg.StartsWith('-')) == "path";

    private void Add()
    {
        try
        {
            var change = registrar.Add();

            output.Err.MarkupLine(Markup.Escape($"Added {change.Folder} to {string.Join(", ", change.Locations)}. New terminals will see it."));
        }
        catch (Exception ex)
        {
            output.Err.MarkupLine(Markup.Escape($"Couldn't add trom to your PATH: {ex.Message.TrimEnd('.')}. Try `trom path add` later."));
        }
    }
}
