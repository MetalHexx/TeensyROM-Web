using Microsoft.Extensions.Configuration;
using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferOptionsBinderTests
{
    private static IConfiguration ConfigurationFrom(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    [Fact]
    public void BindFrom_NoTransferSection_ReturnsCompiledDefaults()
    {
        var configuration = new ConfigurationBuilder().Build();
        var defaults = new TransferOptions();

        var options = TransferOptionsBinder.BindFrom(configuration);

        options.MaxStagedBytes.Should().Be(defaults.MaxStagedBytes);
        options.BatchSize.Should().Be(defaults.BatchSize);
        options.RecentCompletionsBound.Should().Be(defaults.RecentCompletionsBound);
        options.RetainedFailuresBound.Should().Be(defaults.RetainedFailuresBound);
        options.RateWindow.Should().Be(defaults.RateWindow);
    }

    [Fact]
    public void BindFrom_PopulatedSection_OverridesBoundValues()
    {
        var configuration = ConfigurationFrom(new()
        {
            ["Transfer:BatchSize"] = "10",
            ["Transfer:MaxStagedBytes"] = "123456",
            ["Transfer:RateWindow"] = "00:00:05"
        });

        var options = TransferOptionsBinder.BindFrom(configuration);

        options.BatchSize.Should().Be(10);
        options.MaxStagedBytes.Should().Be(123456);
        options.RateWindow.Should().Be(TimeSpan.FromSeconds(5));
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-5")]
    public void BindFrom_OutOfRangeBatchSize_ClampsToOne(string configuredBatchSize)
    {
        var configuration = ConfigurationFrom(new() { ["Transfer:BatchSize"] = configuredBatchSize });

        var options = TransferOptionsBinder.BindFrom(configuration);

        options.BatchSize.Should().Be(1);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-5")]
    public void BindFrom_OutOfRangeMaxStagedBytes_ClampsToOne(string configuredMaxStagedBytes)
    {
        var configuration = ConfigurationFrom(new() { ["Transfer:MaxStagedBytes"] = configuredMaxStagedBytes });

        var options = TransferOptionsBinder.BindFrom(configuration);

        options.MaxStagedBytes.Should().Be(1);
    }

    [Fact]
    public void BindFrom_ZeroRecentCompletionsBound_ClampsToAtLeastOne()
    {
        var configuration = ConfigurationFrom(new() { ["Transfer:RecentCompletionsBound"] = "0" });

        var options = TransferOptionsBinder.BindFrom(configuration);

        options.RecentCompletionsBound.Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public void BindFrom_NegativeRetainedFailuresBound_ClampsToAtLeastOne()
    {
        var configuration = ConfigurationFrom(new() { ["Transfer:RetainedFailuresBound"] = "-1" });

        var options = TransferOptionsBinder.BindFrom(configuration);

        options.RetainedFailuresBound.Should().BeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public void BindFrom_NonPositiveRateWindow_FallsBackToCompiledDefault()
    {
        var configuration = ConfigurationFrom(new() { ["Transfer:RateWindow"] = "00:00:00" });

        var options = TransferOptionsBinder.BindFrom(configuration);

        options.RateWindow.Should().Be(new TransferOptions().RateWindow);
    }

    [Fact]
    public void BindFrom_SnapshotThrottleWithFractionalSeconds_BindsToExactDuration()
    {
        var configuration = ConfigurationFrom(new() { ["Transfer:SnapshotThrottle"] = "00:00:00.250" });

        var options = TransferOptionsBinder.BindFrom(configuration);

        options.SnapshotThrottle.Should().Be(TimeSpan.FromMilliseconds(250));
    }
}
