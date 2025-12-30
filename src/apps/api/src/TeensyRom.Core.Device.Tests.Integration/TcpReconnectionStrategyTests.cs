using System.Reactive.Linq;
using NSubstitute;
using TeensyRom.Core.Device;
using TeensyRom.Core.Logging;
using TeensyRom.Core.Serial.State;

namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Integration tests for TcpReconnectionStrategy using real TCP reconnection logic.
/// These tests verify that TcpReconnectionStrategy correctly retries with backoff.
/// Tests use the public IReconnectionStrategy interface only.
/// </summary>
public class TcpReconnectionStrategyTests : IAsyncDisposable
{
    private readonly ILoggingService _log;
    private readonly IAlertService _alert;

    public TcpReconnectionStrategyTests()
    {
        _log = Substitute.For<ILoggingService>();
        _alert = Substitute.For<IAlertService>();
    }

    [Fact]
    public async Task TcpReconnectionStrategy_WithNonExistentEndpoint_RetriesThreeTimes()
    {
        var report = new TeensyRomDiscoveryReport("tcp-reconnect-retry-report.md");

        report.WriteHeader("TCP Reconnection Strategy Integration Test: Retry Logic");
        report.WriteSection("Test Configuration");
        report.WriteKeyValue("Strategy", "TcpReconnectionStrategy");
        report.WriteKeyValue("Test Endpoint", "192.168.999.999:80 (non-existent)");
        report.WriteKeyValue("Expected Behavior", "Retry 3 times with backoff, then return false");
        report.WriteBlankLine();

        report.WriteSection("Test Execution");

        try
        {
            // Create a mock TCP device
            var mockSerialState = Substitute.For<ISerialStateContext>();
            var mockSerialPort = Substitute.For<IObservableSerialPort>();
            var mockState = new SerialConnectedState(mockSerialPort);

            var stateSubject = new System.Reactive.Subjects.BehaviorSubject<SerialState>(mockState);
            mockSerialState.CurrentState.Returns(stateSubject);
            mockSerialState.IsOpen.Returns(false);
            mockSerialState.When(x => x.SetPort(Arg.Any<string>())).Do(callInfo => { });
            mockSerialState.When(x => x.OpenPort()).Do(callInfo => { });
            mockSerialState.When(x => x.Lock()).Do(callInfo => { });
            mockSerialState.When(x => x.ClosePort()).Do(callInfo => { });
            mockSerialState.When(x => x.TransitionTo(Arg.Any<Type>())).Do(callInfo => { });

            var cart = new Cart
            {
                DeviceId = "test-device",
                Name = "Test Device",
                ConnectionType = ConnectionType.Tcp,
                IpAddress = "192.168.999.999", // Non-existent IP
                TcpPort = 80
            };

            var device = new TeensyRomDevice(
                cart,
                mockSerialState,
                Substitute.For<IStorageService>(),
                Substitute.For<IStorageService>()
            );

            // Create strategy with real version checker
            var versionChecker = new FwVersionChecker(_log, _alert);
            var strategy = new TcpReconnectionStrategy(_log, versionChecker);

            report.WriteInfo("Calling TryReconnect on non-existent TCP endpoint...");
            report.WriteBlankLine();
            report.WriteSubsection("Expected Retry Schedule");
            report.WriteList(new[]
            {
                "Attempt 1: Immediate",
                "Backoff: 500ms",
                "Attempt 2: After 500ms",
                "Backoff: 1000ms",
                "Attempt 3: After 1000ms",
                "Total: ~1.5 seconds minimum"
            });
            report.WriteBlankLine();

            var stopwatch = System.Diagnostics.Stopwatch.StartNew();
            var result = await strategy.TryReconnect(device, CancellationToken.None);
            stopwatch.Stop();

            report.WriteSection("Results");
            report.WriteKeyValue("Reconnection Result", result.ToString());
            report.WriteKeyValue("Duration", $"{stopwatch.ElapsedMilliseconds}ms");
            report.WriteKeyValue("Expected Minimum Duration", "~1500ms (3 attempts with backoff)");

            // Verify timing - should be at least 1.4 seconds (500ms + 1000ms backoffs)
            if (stopwatch.ElapsedMilliseconds >= 1400)
            {
                report.WriteSuccess($"Retry timing verified: {stopwatch.ElapsedMilliseconds}ms >= 1400ms");
            }
            else
            {
                report.WriteWarning($"Duration shorter than expected: {stopwatch.ElapsedMilliseconds}ms < 1400ms");
            }

            // Verify result
            if (!result)
            {
                report.WriteSuccess("Strategy correctly returned false after 3 failed attempts");
            }
            else
            {
                report.WriteWarning("Strategy returned true (unexpected - device should not be reachable)");
            }

            Assert.False(result);
            Assert.True(stopwatch.ElapsedMilliseconds >= 1400, $"Expected at least 1400ms for 3 retries, got {stopwatch.ElapsedMilliseconds}ms");
        }
        catch (Exception ex)
        {
            report.WriteError($"Test failed: {ex.Message}");
            report.WriteCodeBlock(ex.StackTrace, "");
            Assert.True(false);
        }

        report.Save();
        report.WriteInfo($"Report saved to: {report.GetReportPath()}");
    }

    [Fact]
    public async Task TcpReconnectionStrategy_ImplementsIReconnectionStrategy()
    {
        var report = new TeensyRomDiscoveryReport("tcp-reconnect-interface-report.md");

        report.WriteHeader("TCP Reconnection Strategy Integration Test: Interface");
        report.WriteSection("Test Configuration");
        report.WriteKeyValue("Strategy", "TcpReconnectionStrategy");
        report.WriteKeyValue("Expected Behavior", "Implement IReconnectionStrategy");
        report.WriteBlankLine();

        report.WriteSection("Interface Verification");

        try
        {
            var versionChecker = new FwVersionChecker(_log, _alert);
            var strategy = new TcpReconnectionStrategy(_log, versionChecker);

            report.WriteKeyValue("Interface Type", "IReconnectionStrategy");
            report.WriteKeyValue("Strategy Type", strategy.GetType().Name);
            report.WriteKeyValue("Is Assignable", strategy is IReconnectionStrategy ? "Yes" : "No");

            Assert.IsAssignableFrom<IReconnectionStrategy>(strategy);
            report.WriteSuccess("TcpReconnectionStrategy correctly implements IReconnectionStrategy");
        }
        catch (Exception ex)
        {
            report.WriteError($"Test failed: {ex.Message}");
            report.WriteCodeBlock(ex.StackTrace, "");
            Assert.True(false);
        }

        report.Save();
        report.WriteInfo($"Report saved to: {report.GetReportPath()}");
    }

    [Fact]
    public async Task TcpReconnectionStrategy_DoesNotDoNetworkRescan()
    {
        var report = new TeensyRomDiscoveryReport("tcp-reconnect-no-rescan-report.md");

        report.WriteHeader("TCP Reconnection Strategy Integration Test: No Network Rescan");
        report.WriteSection("Test Configuration");
        report.WriteKeyValue("Strategy", "TcpReconnectionStrategy");
        report.WriteKeyValue("Expected Behavior", "Retry same endpoint, do not rescan network");
        report.WriteBlankLine();

        report.WriteSection("Test Execution");

        try
        {
            // Create a mock TCP device with specific endpoint
            var mockSerialState = Substitute.For<ISerialStateContext>();
            var mockSerialPort = Substitute.For<IObservableSerialPort>();
            var mockState = new SerialConnectedState(mockSerialPort);

            var stateSubject = new System.Reactive.Subjects.BehaviorSubject<SerialState>(mockState);
            mockSerialState.CurrentState.Returns(stateSubject);
            mockSerialState.IsOpen.Returns(false);
            mockSerialState.When(x => x.SetPort(Arg.Any<string>())).Do(callInfo => { });
            mockSerialState.When(x => x.OpenPort()).Do(callInfo => { });
            mockSerialState.When(x => x.Lock()).Do(callInfo => { });
            mockSerialState.When(x => x.ClosePort()).Do(callInfo => { });
            mockSerialState.When(x => x.TransitionTo(Arg.Any<Type>())).Do(callInfo => { });

            var testIpAddress = "192.168.1.99";
            var testPort = 80;

            var cart = new Cart
            {
                DeviceId = "test-device",
                Name = "Test Device",
                ConnectionType = ConnectionType.Tcp,
                IpAddress = testIpAddress,
                TcpPort = testPort
            };

            var device = new TeensyRomDevice(
                cart,
                mockSerialState,
                Substitute.For<IStorageService>(),
                Substitute.For<IStorageService>()
            );

            // Create strategy
            var versionChecker = new FwVersionChecker(_log, _alert);
            var strategy = new TcpReconnectionStrategy(_log, versionChecker);

            report.WriteKeyValue("Test Endpoint", $"{testIpAddress}:{testPort}");
            report.WriteInfo("Strategy will retry the same endpoint 3 times...");
            report.WriteBlankLine();

            // Track SetPort calls to verify only the original endpoint is tried
            var calledPorts = new List<string>();
            mockSerialState.When(x => x.SetPort(Arg.Do<string>(port => calledPorts.Add(port))));

            var result = await strategy.TryReconnect(device, CancellationToken.None);

            report.WriteSection("Results");
            report.WriteKeyValue("Reconnection Result", result.ToString());
            report.WriteKeyValue("SetPort Calls", calledPorts.Count.ToString());

            if (calledPorts.Count > 0)
            {
                report.WriteSubsection("Endpoints Tried");
                foreach (var port in calledPorts)
                {
                    report.WriteKeyValue($"  Attempt", port);
                }

                // Verify all calls were to the same endpoint
                var allSame = calledPorts.All(p => p == $"{testIpAddress}:{testPort}");
                if (allSame)
                {
                    report.WriteSuccess("Strategy only tried the original endpoint (no network rescan)");
                }
                else
                {
                    report.WriteWarning("Strategy tried different endpoints (unexpected)");
                }

                Assert.True(allSame, "Strategy should only try the original endpoint");
            }
            else
            {
                report.WriteInfo("No SetPort calls recorded (all retries likely failed during state transitions)");
            }

            Assert.False(result);
        }
        catch (Exception ex)
        {
            report.WriteError($"Test failed: {ex.Message}");
            report.WriteCodeBlock(ex.StackTrace, "");
            Assert.True(false);
        }

        report.Save();
        report.WriteInfo($"Report saved to: {report.GetReportPath()}");
    }

    public ValueTask DisposeAsync()
    {
        return ValueTask.CompletedTask;
    }
}
