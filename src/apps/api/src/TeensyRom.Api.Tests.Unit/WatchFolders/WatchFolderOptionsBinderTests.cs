using Microsoft.Extensions.Configuration;
using TeensyRom.Api.WatchFolders;

namespace TeensyRom.Api.Tests.Unit.WatchFolders;

public class WatchFolderOptionsBinderTests
{
    private static IConfiguration ConfigurationFrom(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    [Fact]
    public void BindFrom_PopulatedSection_OverridesBoundValues()
    {
        var options = WatchFolderOptionsBinder.BindFrom(ConfigurationFrom(new()
        {
            ["WatchFolders:SettleTime"] = "00:00:05",
            ["WatchFolders:EventBufferBytes"] = "131072"
        }));

        options.SettleTime.Should().Be(TimeSpan.FromSeconds(5));
        options.EventBufferBytes.Should().Be(131072);
        options.PollInterval.Should().Be(new WatchFolderOptions().PollInterval);
    }

    [Theory]
    [InlineData("00:00:00")]
    [InlineData("-00:00:05")]
    public void BindFrom_NonPositiveDurations_FallBackToTheDefaults(string configured)
    {
        var defaults = new WatchFolderOptions();

        var options = WatchFolderOptionsBinder.BindFrom(ConfigurationFrom(new()
        {
            ["WatchFolders:SettleTime"] = configured,
            ["WatchFolders:PollInterval"] = configured,
            ["WatchFolders:GroupingWindow"] = configured,
            ["WatchFolders:MaxSetHold"] = configured,
            ["WatchFolders:UnavailableRetryInterval"] = configured,
            ["WatchFolders:EventBufferBytes"] = "0"
        }));

        options.SettleTime.Should().Be(defaults.SettleTime);
        options.PollInterval.Should().Be(defaults.PollInterval);
        options.GroupingWindow.Should().Be(defaults.GroupingWindow);
        options.MaxSetHold.Should().Be(defaults.MaxSetHold);
        options.UnavailableRetryInterval.Should().Be(defaults.UnavailableRetryInterval);
        options.EventBufferBytes.Should().Be(defaults.EventBufferBytes);
    }
}
