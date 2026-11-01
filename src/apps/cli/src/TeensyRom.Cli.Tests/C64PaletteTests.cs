using TeensyRom.Cli.Themes;

namespace TeensyRom.Cli.Tests;

public class C64PaletteTests
{
    [Fact]
    public void Colors_AreTheWebAppsSixteenInIndexOrder()
    {
        var expected = new (int Index, string Name, string Hex)[]
        {
            (0, "Black", "#000000"), (1, "White", "#FFFFFF"), (2, "Red", "#813338"), (3, "Cyan", "#75CEC8"),
            (4, "Purple", "#8E3C97"), (5, "Green", "#56AC4D"), (6, "Blue", "#2E2C9B"), (7, "Yellow", "#EDF171"),
            (8, "Orange", "#8E5029"), (9, "Brown", "#553800"), (10, "Light Red", "#C46C71"), (11, "Dark Grey", "#4A4A4A"),
            (12, "Medium Grey", "#7B7B7B"), (13, "Light Green", "#A9FF9F"), (14, "Light Blue", "#706DEB"), (15, "Light Grey", "#B2B2B2")
        };

        C64Palette.Colors.Select(c => (c.Index, c.Name, c.Hex)).Should().Equal(expected);
    }

    [Fact]
    public void ValidNames_AreLowerCaseInIndexOrder()
    {
        C64Palette.ValidNames.Should().StartWith("black, white, red, cyan").And.EndWith("medium grey, light green, light blue, light grey");
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(16)]
    public void Get_OutsideTheRange_Throws(int index)
    {
        var get = () => C64Palette.Get(index);

        get.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void TryParse_AcceptsEveryNameInAnyCase()
    {
        foreach (var expected in C64Palette.Colors)
        {
            C64Palette.TryParse(expected.Name.ToUpperInvariant(), out var upper).Should().BeTrue();
            C64Palette.TryParse(expected.Name.ToLowerInvariant(), out var lower).Should().BeTrue();

            upper.Should().Be(expected);
            lower.Should().Be(expected);
        }
    }

    [Theory]
    [InlineData(" light red ", 10)]
    [InlineData("0", 0)]
    [InlineData("15", 15)]
    [InlineData(" 7 ", 7)]
    public void TryParse_AcceptsTrimmedNamesAndNumbers(string text, int index)
    {
        C64Palette.TryParse(text, out var color).Should().BeTrue();

        color.Index.Should().Be(index);
    }

    [Theory]
    [InlineData("pink")]
    [InlineData("16")]
    [InlineData("-1")]
    [InlineData("")]
    [InlineData("1.5")]
    [InlineData(null)]
    public void TryParse_RejectsAnythingElse(string? text)
    {
        C64Palette.TryParse(text, out _).Should().BeFalse();
    }
}
