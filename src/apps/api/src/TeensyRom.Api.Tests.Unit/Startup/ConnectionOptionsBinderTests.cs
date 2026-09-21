using Microsoft.Extensions.Configuration;
using TeensyRom.Api.Startup;

namespace TeensyRom.Api.Tests.Unit.Startup;

public class ConnectionOptionsBinderTests
{
    private static IConfiguration ConfigurationFrom(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    [Fact]
    public void BindFrom_EmptyConfiguration_YieldsCompiledDefaults()
    {
        var configuration = new ConfigurationBuilder().Build();
        var defaults = new TeensyRom.Core.Serial.Recovery.ConnectionOptions();

        var options = ConnectionOptionsBinder.BindFrom(configuration);

        options.PollIntervalMs.Should().Be(defaults.PollIntervalMs);
        options.Tcp.ToMinimalMs.Should().Be(defaults.Tcp.ToMinimalMs);
        options.Tcp.ToFullMs.Should().Be(defaults.Tcp.ToFullMs);
        options.Serial.ToMinimalMs.Should().Be(defaults.Serial.ToMinimalMs);
        options.Serial.ToFullMs.Should().Be(defaults.Serial.ToFullMs);
        options.LaunchSettleMs.Should().Be(defaults.LaunchSettleMs);
        options.ConnectTimeoutMs.Should().Be(defaults.ConnectTimeoutMs);
    }

    [Fact]
    public void BindFrom_ZeroPollIntervalMs_ClampsToTen()
    {
        var configuration = ConfigurationFrom(new() { ["Connection:PollIntervalMs"] = "0" });

        var options = ConnectionOptionsBinder.BindFrom(configuration);

        options.PollIntervalMs.Should().Be(10);
    }

    [Fact]
    public void BindFrom_PopulatedSection_OverridesBoundValues()
    {
        var configuration = ConfigurationFrom(new()
        {
            ["Connection:PollIntervalMs"] = "500",
            ["Connection:Tcp:ToMinimalMs"] = "1234",
            ["Connection:Serial:ToFullMs"] = "5678",
            ["Connection:LaunchSettleMs"] = "999",
            ["Connection:ConnectTimeoutMs"] = "111"
        });

        var options = ConnectionOptionsBinder.BindFrom(configuration);

        options.PollIntervalMs.Should().Be(500);
        options.Tcp.ToMinimalMs.Should().Be(1234);
        options.Serial.ToFullMs.Should().Be(5678);
        options.LaunchSettleMs.Should().Be(999);
        options.ConnectTimeoutMs.Should().Be(111);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-5")]
    public void BindFrom_NonPositiveConnectTimeoutMs_ClampsToOne(string configuredValue)
    {
        var configuration = ConfigurationFrom(new() { ["Connection:ConnectTimeoutMs"] = configuredValue });

        var options = ConnectionOptionsBinder.BindFrom(configuration);

        options.ConnectTimeoutMs.Should().Be(1);
    }
}
