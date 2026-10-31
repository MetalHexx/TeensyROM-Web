using System.Text.Json;
using TeensyRom.Cli.Api.Generated;

namespace TeensyRom.Cli.Tests.Integration;

/// <summary>
/// <c>trom theme</c> against the real engine. Nothing here needs a TeensyROM: list, save and delete work on the saved
/// themes, and the refusals happen before any device is touched.
/// </summary>
[Collection(RealApiCollection.Name)]
public sealed class ThemeScenarios(SharedApiFixture api)
{
    private static readonly string[] ShippedThemes = ["TR Default", "C64 Mono", "The Blues"];

    private static string UniqueName() => $"cli-{Guid.NewGuid():N}"[..24];

    private static async Task<(int ExitCode, string Output, string Error)> RunAsync(params string[] args)
    {
        using var cli = new CliHarness();
        var exitCode = await cli.RunAsync(args);

        return (exitCode, cli.Output, cli.Error);
    }

    [Fact]
    public async Task List_IsAnArrayThatHoldsTheSixShippedThemes()
    {
        var (exitCode, output, error) = await RunAsync("theme", "list", "--json");

        exitCode.Should().Be(0, error);
        var themes = JsonDocument.Parse(output).RootElement;
        themes.ValueKind.Should().Be(JsonValueKind.Array);
        var shipped = themes.EnumerateArray().Where(t => t.GetProperty("kind").GetString() == "shipped").ToList();
        shipped.Should().HaveCount(6);
        shipped.Select(t => t.GetProperty("name").GetString()).Should().Contain(ShippedThemes);
        shipped.Should().OnlyContain(t => t.GetProperty("colors").EnumerateObject().Count() == 7);
    }

    [Fact]
    public async Task SaveListOverwriteDelete_RoundTrip_ThroughTheEngine()
    {
        var name = UniqueName();

        try
        {
            var (created, createdOutput, createdError) = await RunAsync("theme", "save", name, "C64 Mono", "--border", "blue", "--json");

            created.Should().Be(0, createdError);
            var saved = JsonDocument.Parse(createdOutput).RootElement;
            saved.GetProperty("overwritten").GetBoolean().Should().BeFalse();
            saved.GetProperty("theme").GetProperty("colors").GetProperty("border").GetProperty("index").GetInt32().Should().Be(6);

            var (listed, listedOutput, listedError) = await RunAsync("theme", "list", "--json");

            listed.Should().Be(0, listedError);
            var viaCli = JsonDocument.Parse(listedOutput).RootElement.EnumerateArray().Single(t => t.GetProperty("name").GetString() == name);
            viaCli.GetProperty("kind").GetString().Should().Be("custom");
            var viaApi = (await api.Api.ListThemesAsync()).Themes.Single(t => t.Name == name);
            viaApi.Id.Should().Be(viaCli.GetProperty("id").GetString());
            viaApi.Parts.Device.Border.Should().Be(6);

            (await RunAsync("theme", "save", name, "C64 Mono", "--border", "blue")).ExitCode.Should().Be(2);

            var (replaced, replacedOutput, replacedError) = await RunAsync("theme", "save", name, "C64 Mono", "--border", "red", "--overwrite", "--json");

            replaced.Should().Be(0, replacedError);
            var overwritten = JsonDocument.Parse(replacedOutput).RootElement;
            overwritten.GetProperty("overwritten").GetBoolean().Should().BeTrue();
            overwritten.GetProperty("theme").GetProperty("colors").GetProperty("border").GetProperty("index").GetInt32().Should().Be(2);

            var (deleted, deletedOutput, deletedError) = await RunAsync("theme", "delete", name, "--yes", "--json");

            deleted.Should().Be(0, deletedError);
            JsonDocument.Parse(deletedOutput).RootElement.GetProperty("name").GetString().Should().Be(name);
            (await api.Api.ListThemesAsync()).Themes.Should().NotContain(t => t.Name == name);
        }
        finally
        {
            await RunAsync("theme", "delete", name, "--yes");
        }
    }

    [Fact]
    public async Task Delete_OfAnUnknownTheme_ExitsNotFound()
    {
        (await RunAsync("theme", "delete", $"no-such-{Guid.NewGuid():N}", "--yes")).ExitCode.Should().Be(5);
    }

    [Fact]
    public async Task Delete_OfAShippedTheme_ExitsUsage()
    {
        (await RunAsync("theme", "delete", "TR Default", "--yes")).ExitCode.Should().Be(2);
    }

    [Fact]
    public async Task Apply_WithNoThemeAndNoFlags_ExitsUsage()
    {
        (await RunAsync("theme", "apply")).ExitCode.Should().Be(2);
    }
}
