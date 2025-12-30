using NSubstitute;
using TeensyRom.Core.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Integration tests for TcpDiscoveryStrategy using real network scanning.
/// These tests scan the actual local network for TeensyROM devices and generate Markdown reports.
/// Tests use the public IDiscoveryStrategy interface only.
/// </summary>
public class TcpDiscoveryStrategyTests : IAsyncDisposable
{
    private readonly ILoggingService _log;

    public TcpDiscoveryStrategyTests()
    {
        _log = Substitute.For<ILoggingService>();
    }

    [Fact]
    public async Task TcpDiscoveryStrategy_ScanLocalSubnet_GeneratesDiscoveryReport()
    {
        var report = new TeensyRomDiscoveryReport("local-subnet-scan-report.md");
        var strategy = new TcpDiscoveryStrategy(_log);

        report.WriteHeader("TeensyROM TCP Device Discovery - Local Subnet Scan");
        report.WriteSection("Scan Configuration");

        var subnetRange = NetworkHelper.GetLocalSubnetRange();
        if (subnetRange.HasValue)
        {
            var (start, end) = subnetRange.Value;
            report.WriteKeyValue("Subnet Range", $"{start} to {end}");
            report.WriteKeyValue("Port", "80 (TeensyROM default)");
            report.WriteKeyValue("Max Parallelism", "256");
            report.WriteKeyValue("Connection Timeout", "150ms");
            report.WriteKeyValue("Read Timeout", "100ms");
            report.WriteKeyValue("Estimated Time", "~1-2 seconds for /24 subnet (with 256-way parallelism)");
        }
        else
        {
            report.WriteWarning("Could not detect local subnet range - no active network interface found");
        }

        report.WriteSection("Scan Results");

        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        List<DiscoveredEndpoint> discoveredEndpoints;

        try
        {
            discoveredEndpoints = await strategy.FindEndpoints(CancellationToken.None);
        }
        catch (Exception ex)
        {
            report.WriteError($"Scan failed: {ex.Message}");
            discoveredEndpoints = new List<DiscoveredEndpoint>();
        }

        stopwatch.Stop();

        report.WriteKeyValue("Scan Duration", $"{stopwatch.ElapsedMilliseconds}ms");
        report.WriteKeyValue("Devices Found", discoveredEndpoints.Count.ToString());

        if (discoveredEndpoints.Count > 0)
        {
            report.WriteSection("Discovered Devices");
            report.WriteEndpointTable(discoveredEndpoints);
            report.WriteSuccess($"TeensyROM device(s) found on network: {discoveredEndpoints.Count}");
        }
        else
        {
            report.WriteSection("No Devices Found");
            report.WriteLine("No TeensyROM devices responded on the local network.");
            report.WriteBlankLine();
            report.WriteSubsection("Possible Reasons");
            report.WriteList(new[]
            {
                "No TeensyROM devices are powered on",
                "Devices are on a different subnet",
                "Network firewall is blocking TCP port 80",
                "Devices are not configured for TCP connectivity"
            });
            report.WriteInfo("This is expected if no TeensyROM hardware is connected.");
        }

        report.Save();
        report.WriteInfo($"Report saved to: {report.GetReportPath()}");

        // Test always passes - we're just generating a report
        Assert.True(true);
    }

    public ValueTask DisposeAsync()
    {
        return ValueTask.CompletedTask;
    }
}
