using Spectre.Console;

namespace TeensyRom.Cli.Fonts;

internal static class FontConstants
{
    internal const string LogoResourceName = "TeensyRom.Cli.Fonts.Chunky.flf";

    /// <summary>The banner font, read from the assembly so a single-file publish needs no font folder.</summary>
    public static FigletFont Logo { get; } = LoadLogo();

    private static FigletFont LoadLogo()
    {
        using var stream = typeof(FontConstants).Assembly.GetManifestResourceStream(LogoResourceName);
        return stream is null ? FigletFont.Default : FigletFont.Load(stream);
    }
}
