using TeensyRom.Core.Entities.Storage;
using TeensyRom.Core.Serial.Commands.LaunchFile;
using TeensyRom.Core.ValueObjects;
using Xunit.Abstractions;

namespace TeensyRom.Core.Device.Tests.Integration;

/// <summary>
/// Hardware-backed coverage for the three discovery occasions <see cref="IDeviceConnectionManager"/>
/// sequences: a page-load listing must not touch a unit sitting in minimal, a full scan resets it back to
/// the menu, and a fresh manager reconnecting from the cache the first manager wrote confirms every row
/// without a sweep. Written as one scripted flow rather than three independent facts because each phase's
/// starting state is the previous phase's end state - splitting them would just re-derive the same
/// sequence with extra setup. With no hardware attached the test reports skipped, not failed - see
/// <see cref="HardwareFixture.HasHardware"/>. Shares its fixture with <see cref="ConnectionTransitionsTests"/>
/// via <see cref="HardwareCollection"/> so the two classes never race for the same physical connection.
/// </summary>
[Collection(HardwareCollection.Name)]
public class DiscoveryOccasionsTests(HardwareFixture fixture, ITestOutputHelper output)
{
    // Same large bench file ConnectionTransitionsTests uses to force minimal firmware deliberately.
    private static readonly LaunchableItem LargeLaunchItem = new()
    {
        Name = "Lemmings [EasyFlash].crt",
        Path = new FilePath("/games/Very Large/Lemmings [EasyFlash].crt")
    };

    [SkippableFact]
    public async Task DiscoveryOccasions_PageLoadFullScanThenCachedRestart()
    {
        var device = GivenDevice();

        await EnsureMinimalAsync(device);

        // Occasion 1: a page-load listing while the unit sits in minimal must not contact it - the
        // version command afterwards still reporting minimal is the proof no probe went out.
        var (pageLoadDevices, _) = await fixture.MeasureAsync(output, "FindDevices(fullScan: false) while minimal",
            () => fixture.Manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: false));

        pageLoadDevices.Should().Contain(d => d.DeviceId == device.DeviceId && d.Connection.Mode == DeviceMode.Minimal);

        var versionAfterPageLoad = fixture.Interrogator.ReadVersion(device.CommunicationPort);
        versionAfterPageLoad.IsMinimalFirmware.Should().BeTrue("a page-load listing must not have contacted the device");

        // Occasion 2: a full scan resets the unit back to the menu.
        var (fullScanDevices, _) = await fixture.MeasureAsync(output, "FindDevices(fullScan: true) from minimal",
            () => fixture.Manager.FindDevices(autoConnect: false, CancellationToken.None, fullScan: true));

        fullScanDevices.Should().Contain(d => d.DeviceId == device.DeviceId &&
            (d.Connection.Mode == DeviceMode.FullIdle || d.Connection.Mode == DeviceMode.FullBusy));

        // Occasion 3: a second, independent manager reconnecting from the cache the first manager wrote
        // confirms every row without a sweep - the fixture disposes the first manager's device ports
        // first, since a held COM port or socket would otherwise read as a miss and trigger the sweep
        // this occasion must not take.
        var secondManager = fixture.BuildFreshManager();

        var (secondStartDevices, secondStartElapsed) = await fixture.MeasureAsync(output, "Second ConnectAtStartAsync (cached)",
            () => secondManager.ConnectAtStartAsync(CancellationToken.None));

        secondStartDevices.Should().Contain(d => d.DeviceId == device.DeviceId);
        secondStartElapsed.Should().BeLessThan(TimeSpan.FromMilliseconds(fixture.Options.ConnectTimeoutMs) + TimeSpan.FromSeconds(4));

        foreach (var restarted in secondStartDevices)
        {
            restarted.CommunicationPort.Dispose();
        }
    }

    private TeensyRomDevice GivenDevice()
    {
        Skip.If(!fixture.HasHardware, "no TeensyROM attached");
        var device = fixture.Device;
        Skip.If(device is null, $"no device confirmed on {fixture.Transport}");
        return device!;
    }

    private async Task EnsureMinimalAsync(TeensyRomDevice device)
    {
        if (device.Connection.Mode == DeviceMode.Minimal) return;

        var handler = new LaunchFileHandler(fixture.Log, fixture.Recovery, fixture.Manager, fixture.Interrogator, fixture.Options);
        var command = new LaunchFileCommand
        {
            StorageType = TeensyStorageType.SD,
            LaunchItem = LargeLaunchItem,
            DeviceId = device.DeviceId,
            CommunicationPort = device.CommunicationPort
        };

        var result = await handler.Handle(command, CancellationToken.None);
        result.LaunchResult.Should().Be(LaunchFileResultType.Success, "priming minimal requires the large launch to succeed");
        device.Connection.Mode.Should().Be(DeviceMode.Minimal);
    }
}
