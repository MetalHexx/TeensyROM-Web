using TeensyRom.Cli.Fonts;

namespace TeensyRom.Cli.Tests;

public sealed class FontConstantsTests
{
    [Fact]
    public void LogoFont_IsEmbeddedInTheAssembly()
    {
        typeof(FontConstants).Assembly.GetManifestResourceNames().Should().Contain(FontConstants.LogoResourceName);
    }

    [Fact]
    public void Logo_LoadsTheEmbeddedFontInsteadOfTheDefault()
    {
        FontConstants.Logo.Should().NotBeSameAs(Spectre.Console.FigletFont.Default);
    }
}
