using TeensyRom.Cli.Commands.File;
using TeensyRom.Cli.Errors;
using TeensyRom.Cli.Storage.Entities;
using TeensyFilterType = TeensyRom.Cli.Settings.TeensyFilterType;

namespace TeensyRom.Cli.Tests;

public sealed class FileCommandOptionsTests
{
    [Theory]
    [InlineData("all", TeensyFilterType.All)]
    [InlineData("Games", TeensyFilterType.Games)]
    [InlineData("MUSIC", TeensyFilterType.Music)]
    [InlineData("images", TeensyFilterType.Images)]
    [InlineData("hex", TeensyFilterType.Hex)]
    public void ParseFilter_IgnoresCase_AndAcceptsHex(string value, TeensyFilterType expected) =>
        FileCommandOptions.ParseFilter(value).Should().Be(expected);

    [Fact]
    public void ParseFilter_WithoutAValue_IsAll() => FileCommandOptions.ParseFilter(null).Should().Be(TeensyFilterType.All);

    [Theory]
    [InlineData("storage", StorageScope.Storage)]
    [InlineData("DIR-DEEP", StorageScope.DirDeep)]
    [InlineData("Dir-Shallow", StorageScope.DirShallow)]
    public void ParseScope_IgnoresCase(string value, StorageScope expected) =>
        FileCommandOptions.ParseScope(value).Should().Be(expected);

    [Fact]
    public void ParseScope_WithoutAValue_IsDirDeep() => FileCommandOptions.ParseScope(null).Should().Be(StorageScope.DirDeep);

    [Theory]
    [InlineData("5s", 5)]
    [InlineData("15S", 15)]
    [InlineData("30s", 30)]
    [InlineData("1m", 60)]
    [InlineData("3m", 180)]
    [InlineData("5m", 300)]
    [InlineData("15m", 900)]
    [InlineData("30m", 1800)]
    [InlineData("1H", 3600)]
    public void ParseTimer_ReadsEachAcceptedLength(string value, int seconds) =>
        FileCommandOptions.ParseTimer(value).Should().Be(TimeSpan.FromSeconds(seconds));

    [Theory]
    [InlineData("none")]
    [InlineData("NONE")]
    [InlineData(null)]
    public void ParseTimer_NoneAndNoValue_MeanNoTimer(string? value) => FileCommandOptions.ParseTimer(value).Should().BeNull();

    [Theory]
    [InlineData("--filter", "films")]
    [InlineData("--scope", "deep")]
    [InlineData("--timer", "2m")]
    [InlineData("--timer", "")]
    public void ABadValue_IsAUsageError_ListingTheAcceptedOnes(string option, string value)
    {
        var parse = () => option switch
        {
            "--filter" => (object?)FileCommandOptions.ParseFilter(value),
            "--scope" => FileCommandOptions.ParseScope(value),
            _ => FileCommandOptions.ParseTimer(value)
        };

        var error = parse.Should().Throw<CliException>().Which;
        error.Code.Should().Be(CliExitCode.Usage);
        error.Message.Should().StartWith($"{option} must be one of: ");
    }

    [Fact]
    public void ABadFilter_NamesEveryAcceptedFilter() =>
        FileCommandOptions.Check(() => FileCommandOptions.ParseFilter("films")).Message
            .Should().Contain("all").And.Contain("games").And.Contain("music").And.Contain("images").And.Contain("hex");

    [Fact]
    public void Check_TurnsAUsageErrorIntoAFailedValidation_AndPassesAGoodValue()
    {
        FileCommandOptions.Check(() => FileCommandOptions.ParseTimer("5s")).Successful.Should().BeTrue();
        FileCommandOptions.Check(() => FileCommandOptions.ParseTimer("2m")).Successful.Should().BeFalse();
    }
}
