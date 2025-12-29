using System.Net;
using NSubstitute;
using TeensyRom.Core.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial;

namespace TeensyRom.Core.Serial.Tests.Integration;

/// <summary>
/// Integration tests for TcpDeviceFinder using real network scanning.
/// These tests scan the actual local network for TeensyROM devices and generate Markdown reports.
/// </summary>
public class TcpDeviceFinderIntegrationTests : IAsyncDisposable
{
    private readonly ILoggingService _log;

    public TcpDeviceFinderIntegrationTests()
    {
        _log = Substitute.For<ILoggingService>();
    }

    [Fact]
    public async Task TcpDeviceFinder_ScanLocalSubnet_GeneratesDiscoveryReport()
    {
        var report = new TeensyRomDiscoveryReport("local-subnet-scan-report.md");
        var finder = new TcpDeviceFinder(_log);

        report.WriteHeader("TeensyROM TCP Device Discovery - Local Subnet Scan");
        report.WriteSection("Scan Configuration");

        var subnetRange = NetworkHelper.GetLocalSubnetRange();
        if (subnetRange.HasValue)
        {
            var (start, end) = subnetRange.Value;
            report.WriteKeyValue("Subnet Range", $"{start} to {end}");
            report.WriteKeyValue("Port", "80 (TeensyROM default)");
            report.WriteKeyValue("Max Parallelism", "4");
            report.WriteKeyValue("Connection Timeout", "150ms");
            report.WriteKeyValue("Read Timeout", "100ms");
            report.WriteKeyValue("Estimated Time", "~10 seconds for /24 subnet (with 4-way parallelism)");
        }
        else
        {
            report.WriteWarning("Could not detect local subnet range - no active network interface found");
        }

        report.WriteSection("Scan Results");

        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        List<TcpDiscoveredDevice> discoveredDevices;

        try
        {
            discoveredDevices = await finder.ScanLocalSubnet(CancellationToken.None);
        }
        catch (Exception ex)
        {
            report.WriteError($"Scan failed: {ex.Message}");
            discoveredDevices = new List<TcpDiscoveredDevice>();
        }

        stopwatch.Stop();

        report.WriteKeyValue("Scan Duration", $"{stopwatch.ElapsedMilliseconds}ms");
        report.WriteKeyValue("Devices Found", discoveredDevices.Count.ToString());

        if (discoveredDevices.Count > 0)
        {
            report.WriteSection("Discovered Devices");
            report.WriteDeviceTable(discoveredDevices);
            report.WriteSuccess($"TeensyROM device(s) found on network: {discoveredDevices.Count}");
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

    [Fact]
    public async Task TcpDeviceFinder_ScanCommonRanges_GeneratesDiscoveryReport()
    {
        var report = new TeensyRomDiscoveryReport("common-ranges-scan-report.md");
        var finder = new TcpDeviceFinder(_log);

        report.WriteHeader("TeensyROM TCP Device Discovery - Common Network Ranges");
        report.WriteSection("Scan Configuration");

        var rangesToScan = new List<(IPAddress Start, IPAddress End)>
        {
            (IPAddress.Parse("192.168.1.1"), IPAddress.Parse("192.168.1.30")),
            (IPAddress.Parse("192.168.0.1"), IPAddress.Parse("192.168.0.30")),
            (IPAddress.Parse("10.0.0.1"), IPAddress.Parse("10.0.0.30")),
            (IPAddress.Parse("172.16.0.1"), IPAddress.Parse("172.16.0.30")),
        };

        foreach (var (start, end) in rangesToScan)
        {
            report.WriteKeyValue("Range", $"{start} to {end}");
        }

        report.WriteSection("Scan Results");

        var allDiscoveredDevices = new List<TcpDiscoveredDevice>();
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        var rangeResults = new List<string>();

        foreach (var (start, end) in rangesToScan)
        {
            try
            {
                var devices = await finder.ScanNetwork(start, end, CancellationToken.None);
                allDiscoveredDevices.AddRange(devices);
                rangeResults.Add($"- {start} to {end}: **{devices.Count} device(s)** found");
            }
            catch (Exception ex)
            {
                rangeResults.Add($"- {start} to {end}: Error - {ex.Message}");
            }
        }

        stopwatch.Stop();

        report.WriteKeyValue("Total Scan Time", $"{stopwatch.ElapsedMilliseconds}ms");
        report.WriteKeyValue("Total Devices Found", allDiscoveredDevices.Count.ToString());
        report.WriteBlankLine();

        report.WriteSubsection("Results by Range");
        report.WriteLine(string.Join(Environment.NewLine, rangeResults));
        report.WriteBlankLine();

        if (allDiscoveredDevices.Count > 0)
        {
            report.WriteSection("Discovered Devices");
            report.WriteDeviceTable(allDiscoveredDevices);
            report.WriteSuccess($"TeensyROM device(s) found: {allDiscoveredDevices.Count}");
        }
        else
        {
            report.WriteSection("No Devices Found");
            report.WriteLine("No TeensyROM devices found in any scanned range.");
            report.WriteBlankLine();
            report.WriteSubsection("Troubleshooting");
            report.WriteList(new[]
            {
                "Ensure device is powered on",
                "Ensure device is on the same network as this machine",
                "Ensure device is listening on TCP port 80",
                "Ensure network firewall allows TCP port 80",
                "Ensure device IP is within one of the scanned ranges"
            });
        }

        report.Save();
        report.WriteInfo($"Report saved to: {report.GetReportPath()}");

        Assert.True(true);
    }

    [Fact]
    public void NetworkHelper_DiagnosticReport()
    {
        var report = new TeensyRomDiscoveryReport("network-diagnostic-report.md");

        report.WriteHeader("Network Configuration Diagnostic Report");
        report.WriteSection("Network Interfaces");

        var interfaces = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces();
        report.WriteKeyValue("Total Interfaces", interfaces.Length.ToString());
        report.WriteBlankLine();

        foreach (var nic in interfaces.Where(nic => nic.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up))
        {
            report.WriteSubsection(nic.Name);
            report.WriteKeyValue("Description", nic.Description);
            report.WriteKeyValue("Type", nic.NetworkInterfaceType.ToString());
            report.WriteKeyValue("Status", nic.OperationalStatus.ToString());
            report.WriteKeyValue("Speed", $"{nic.Speed:N0} bps");

            var ipProps = nic.GetIPProperties();
            var unicastAddresses = ipProps.UnicastAddresses.Where(addr => addr.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork).ToList();

            if (unicastAddresses.Any())
            {
                report.WriteBlankLine();
                report.WriteBold("IPv4 Addresses:");
                foreach (var addr in unicastAddresses)
                {
                    report.WriteLine($"  - {addr.Address}/{addr.PrefixLength}");
                }
            }
            report.WriteBlankLine();
        }

        report.WriteSection("Local Subnet Detection");

        var subnetRange = NetworkHelper.GetLocalSubnetRange();
        if (subnetRange.HasValue)
        {
            var (start, end) = subnetRange.Value;
            report.WriteSuccess($"Detected local subnet: {start} to {end}");
            report.WriteBlankLine();
            report.WriteInfo("This subnet will be used by TcpDeviceFinder.ScanLocalSubnet()");
        }
        else
        {
            report.WriteWarning("Could not detect local subnet");
            report.WriteBlankLine();
            report.WriteSubsection("Possible Causes");
            report.WriteList(new[]
            {
                "No active network interface",
                "All interfaces are loopback or disconnected",
                "No IPv4 addresses configured"
            });
            report.WriteInfo("TcpDeviceFinder will return an empty device list.");
        }

        report.Save();
        report.WriteInfo($"Report saved to: {report.GetReportPath()}");

        Assert.True(true);
    }

    [Fact]
    public async Task TcpDeviceFinder_ScanSpecificDevice_GeneratesDetailedReport()
    {
        var report = new TeensyRomDiscoveryReport("specific-device-scan-report.md");
        var finder = new TcpDeviceFinder(_log);

        // Test specific device at 192.168.1.37
        var targetIp = IPAddress.Parse("192.168.1.37");

        report.WriteHeader("TeensyROM TCP Device Discovery - Specific Device Test");
        report.WriteSection("Target Device");
        report.WriteKeyValue("IP Address", targetIp.ToString());
        report.WriteKeyValue("Port", "80 (TeensyROM default)");
        report.WriteSection("Performance Test");

        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            // Scan just this single IP
            var devices = await finder.ScanNetwork(targetIp, targetIp, CancellationToken.None);
            sw.Stop();

            report.WriteKeyValue("Total Scan Time", $"{sw.ElapsedMilliseconds}ms");
            report.WriteBlankLine();
            report.WriteSection("Test Results");

            report.WriteKeyValue("Devices Found", devices.Count.ToString());
            report.WriteBlankLine();

            if (devices.Count > 0)
            {
                report.WriteSuccess("TEENSYROM DEVICE FOUND!");
                report.WriteSection("Device Details");
                report.WriteDeviceTable(devices);

                // Performance analysis
                report.WriteBlankLine();
                report.WriteSection("Performance Analysis");
                report.WriteInfo($"Scan completed in {sw.ElapsedMilliseconds}ms for single IP");
                report.WriteBlankLine();
                report.WriteSubsection("Timeout Recommendations");

                // Calculate what timeout would work based on scan time
                // We want some buffer for network variability
                var recommendedTimeout = Math.Max(100, sw.ElapsedMilliseconds * 2);
                report.WriteKeyValue("Current Read Timeout", "100ms");
                report.WriteKeyValue("Recommended Read Timeout", $"{recommendedTimeout}ms");
                report.WriteBlankLine();
                report.WriteInfo("For parallel scanning of 254 IPs:");
                report.WriteKeyValue("With 4-way parallelism", $"~{(sw.ElapsedMilliseconds * 254 / 4):F0}ms theoretical (if all same speed)");
                report.WriteKeyValue("With network variability", "Add 50-100% buffer for reliable scanning");
            }
            else
            {
                report.WriteWarning("No TeensyROM device found at this address");
                report.WriteBlankLine();
                report.WriteSubsection("Debugging Information");
                report.WriteList(new[]
                {
                    "Device did not respond to TeensyROM ping token (0x6455)",
                    "Or response did not contain 'teensyrom' or 'busy' (case-insensitive)",
                    "Scan completed in " + $"{sw.ElapsedMilliseconds}ms",
                    "Try testing with: Test-NetConnection -ComputerName 192.168.1.37 -Port 80"
                });
            }
        }
        catch (Exception ex)
        {
            sw.Stop();
            report.WriteKeyValue("Total Scan Time", $"{sw.ElapsedMilliseconds}ms (failed)");
            report.WriteBlankLine();
            report.WriteError($"Scan error: {ex.Message}");
            report.WriteBlankLine();
            report.WriteSubsection("Exception Details");
            report.WriteCodeBlock(ex.ToString(), "text");
        }

        report.Save();
        Assert.True(true);
    }

    public ValueTask DisposeAsync()
    {
        return ValueTask.CompletedTask;
    }
}
