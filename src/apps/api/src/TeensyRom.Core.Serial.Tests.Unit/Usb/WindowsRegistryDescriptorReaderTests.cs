using System.Runtime.CompilerServices;
using System.Runtime.Versioning;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Serial.Tests.Unit.Usb;

/// <summary>
/// Unit tests for <see cref="WindowsRegistryDescriptorReader"/> against the bench-captured registry fixture
/// (see Captured/windows-registry.json) covering the two-hop walk and the present-port cross-check.
/// </summary>
[SupportedOSPlatform("windows")]
public class WindowsRegistryDescriptorReaderTests
{
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly IRegistryView _registry = CapturedRegistryView.Load(FixturePath("windows-registry.json"));

    [Fact]
    public void Read_YieldsFullAndMinimalRows_ForOneUnitSplitAcrossImages()
    {
        var sut = new WindowsRegistryDescriptorReader(_registry, _log);

        var result = sut.Read(["COM12", "COM5", "COM3", "COM13"]);

        result.Should().BeEquivalentTo(new[]
        {
            new UsbSerialDescriptor("COM12", TeensyUsbIds.Vendor, TeensyUsbIds.ProductFull, "TEENSYROM-SERIAL-14470230"),
            new UsbSerialDescriptor("COM5", TeensyUsbIds.Vendor, TeensyUsbIds.ProductMinimal, "14470230")
        });
    }

    [Fact]
    public void Read_YieldsBothUnits_WhenBothAreInFullImage()
    {
        var sut = new WindowsRegistryDescriptorReader(_registry, _log);

        var result = sut.Read(["COM12", "COM4"]);

        result.Should().BeEquivalentTo(new[]
        {
            new UsbSerialDescriptor("COM12", TeensyUsbIds.Vendor, TeensyUsbIds.ProductFull, "TEENSYROM-SERIAL-14470230"),
            new UsbSerialDescriptor("COM4", TeensyUsbIds.Vendor, TeensyUsbIds.ProductFull, "TEENSYROM-SERIAL-19277260")
        });
    }

    [Fact]
    public void Read_ReturnsNothing_WhenOnlyAForeignOrBluetoothPortIsPresent()
    {
        var sut = new WindowsRegistryDescriptorReader(_registry, _log);

        var result = sut.Read(["COM3", "COM13"]);

        result.Should().BeEmpty();
    }

    [Fact]
    public void Read_SkipsKey_WhenItHasNoParentIdPrefix()
    {
        var registry = Substitute.For<IRegistryView>();
        registry.SubKeys(Arg.Is<string>(p => p.EndsWith("PID_0489"))).Returns(["TEENSYROM-SERIAL-BROKEN"]);

        var sut = new WindowsRegistryDescriptorReader(registry, _log);

        var result = sut.Read(["COM99"]);

        result.Should().BeEmpty();
    }

    [Fact]
    public void Read_SkipsKey_WhenNoMatchingMI00Child()
    {
        var registry = Substitute.For<IRegistryView>();
        registry.SubKeys(Arg.Is<string>(p => p.EndsWith("PID_0489"))).Returns(["TEENSYROM-SERIAL-ORPHAN"]);
        registry.Value(Arg.Is<string>(p => p.EndsWith("TEENSYROM-SERIAL-ORPHAN")), "ParentIdPrefix").Returns("b&deadbeef&0");

        var sut = new WindowsRegistryDescriptorReader(registry, _log);

        var result = sut.Read(["COM99"]);

        result.Should().BeEmpty();
    }

    private static string FixturePath(string name, [CallerFilePath] string testFilePath = "") =>
        Path.Combine(Path.GetDirectoryName(testFilePath)!, "Captured", name);
}
