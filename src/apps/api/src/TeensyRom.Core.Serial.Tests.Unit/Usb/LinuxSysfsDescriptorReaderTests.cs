using System.Runtime.CompilerServices;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Serial.Tests.Unit.Usb;

/// <summary>
/// Unit tests for <see cref="LinuxSysfsDescriptorReader"/> against a captured sysfs directory tree (see
/// Captured/linux-sysfs).
/// </summary>
public class LinuxSysfsDescriptorReaderTests
{
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();
    private readonly string _sysfsRoot = FixturePath("linux-sysfs");

    [Fact]
    public void Read_YieldsBothTeensyRomRows_FromTheCapturedTree()
    {
        var sut = new LinuxSysfsDescriptorReader(_sysfsRoot, _log);

        var result = sut.Read(["/dev/ttyACM0", "/dev/ttyACM1"]);

        result.Should().BeEquivalentTo(new[]
        {
            new UsbSerialDescriptor("/dev/ttyACM0", TeensyUsbIds.Vendor, TeensyUsbIds.ProductFull, "TeensyROM-Serial-14470230"),
            new UsbSerialDescriptor("/dev/ttyACM1", TeensyUsbIds.Vendor, TeensyUsbIds.ProductMinimal, "19277260")
        });
    }

    [Fact]
    public void Read_ReturnsEmpty_WhenSysfsRootDoesNotExist()
    {
        var sut = new LinuxSysfsDescriptorReader(Path.Combine(_sysfsRoot, "does-not-exist"), _log);

        var result = sut.Read([]);

        result.Should().BeEmpty();
    }

    private static string FixturePath(string name, [CallerFilePath] string testFilePath = "") =>
        Path.Combine(Path.GetDirectoryName(testFilePath)!, "Captured", name);
}
