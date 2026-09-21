using NSubstitute.ExceptionExtensions;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Serial.Tests.Unit.Usb;

/// <summary>
/// Unit tests for <see cref="TeensyPortLocator"/> covering descriptor classification, the three
/// "unavailable" reasons, and chip-id lookup, all against fake <see cref="IUsbSerialDescriptorReader"/>s so
/// the tests are independent of any platform's real descriptor source.
/// </summary>
public class TeensyPortLocatorTests
{
    private readonly ILoggingService _log = Substitute.For<ILoggingService>();

    private static IUsbSerialDescriptorReader SupportedReader(params UsbSerialDescriptor[] rows)
    {
        var reader = Substitute.For<IUsbSerialDescriptorReader>();
        reader.IsSupported.Returns(true);
        reader.Read(Arg.Any<IReadOnlyCollection<string>>()).Returns(rows);
        return reader;
    }

    [Fact]
    public void ListPorts_ClassifiesFullMinimalUnknown_AndDropsForeignVidPid()
    {
        var rows = new[]
        {
            new UsbSerialDescriptor("COM12", TeensyUsbIds.Vendor, TeensyUsbIds.ProductFull, "TeensyROM-Serial-14470230"),
            new UsbSerialDescriptor("COM5", TeensyUsbIds.Vendor, TeensyUsbIds.ProductMinimal, "19277260"),
            new UsbSerialDescriptor("/dev/cu.usbmodem1", null, null, "12345678"),
            new UsbSerialDescriptor("COM3", 0x0403, 0x6001, "A12345")
        };
        var locator = new TeensyPortLocator([SupportedReader(rows)], _log, () => ["COM12", "COM5", "/dev/cu.usbmodem1", "COM3"]);

        var result = locator.ListPorts();

        result.FilterAvailable.Should().BeTrue();
        result.Ports.Should().BeEquivalentTo(new[]
        {
            new TeensyRomPort("COM12", "14470230", TeensyRomImage.Full),
            new TeensyRomPort("COM5", "19277260", TeensyRomImage.Minimal),
            new TeensyRomPort("/dev/cu.usbmodem1", "12345678", TeensyRomImage.Unknown)
        });
    }

    [Fact]
    public void ListPorts_ReportsUnavailable_WhenNoReaderSupportsThePlatform()
    {
        var unsupportedReader = Substitute.For<IUsbSerialDescriptorReader>();
        unsupportedReader.IsSupported.Returns(false);
        var locator = new TeensyPortLocator([unsupportedReader], _log, () => []);

        var result = locator.ListPorts();

        result.FilterAvailable.Should().BeFalse();
        result.Ports.Should().BeEmpty();
        result.UnavailableReason.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void ListPorts_ReportsUnavailable_WithExceptionMessage_WhenReaderThrows()
    {
        var reader = Substitute.For<IUsbSerialDescriptorReader>();
        reader.IsSupported.Returns(true);
        reader.Read(Arg.Any<IReadOnlyCollection<string>>()).Throws(new InvalidOperationException("registry access denied"));
        var locator = new TeensyPortLocator([reader], _log, () => ["COM1"]);

        var result = locator.ListPorts();

        result.FilterAvailable.Should().BeFalse();
        result.Ports.Should().BeEmpty();
        result.UnavailableReason.Should().Be("registry access denied");
    }

    [Fact]
    public void ListPorts_ReportsUnavailable_WhenReaderFindsNothingButPortsExist()
    {
        var locator = new TeensyPortLocator([SupportedReader()], _log, () => ["COM1", "COM2"]);

        var result = locator.ListPorts();

        result.FilterAvailable.Should().BeFalse();
        result.Ports.Should().BeEmpty();
        result.UnavailableReason.Should().Be("descriptor filter found no TeensyROM among 2 present ports");
    }

    [Fact]
    public void ListPorts_IsAvailable_WithNoPorts_WhenNothingIsPluggedInAtAll()
    {
        var locator = new TeensyPortLocator([SupportedReader()], _log, () => []);

        var result = locator.ListPorts();

        result.FilterAvailable.Should().BeTrue();
        result.Ports.Should().BeEmpty();
    }

    [Fact]
    public void FindByChipId_ReturnsMatchingPort_WhenPresent()
    {
        var rows = new[]
        {
            new UsbSerialDescriptor("COM12", TeensyUsbIds.Vendor, TeensyUsbIds.ProductFull, "TeensyROM-Serial-14470230"),
            new UsbSerialDescriptor("COM4", TeensyUsbIds.Vendor, TeensyUsbIds.ProductFull, "TeensyROM-Serial-19277260")
        };
        var locator = new TeensyPortLocator([SupportedReader(rows)], _log, () => ["COM12", "COM4"]);

        var result = locator.FindByChipId("14470230");

        result.FilterAvailable.Should().BeTrue();
        result.Port.Should().Be(new TeensyRomPort("COM12", "14470230", TeensyRomImage.Full));
    }

    [Fact]
    public void FindByChipId_ReturnsNullPort_WhenChipIsNotAmongPresentPorts()
    {
        var rows = new[]
        {
            new UsbSerialDescriptor("COM4", TeensyUsbIds.Vendor, TeensyUsbIds.ProductFull, "TeensyROM-Serial-19277260")
        };
        var locator = new TeensyPortLocator([SupportedReader(rows)], _log, () => ["COM4"]);

        var result = locator.FindByChipId("14470230");

        result.FilterAvailable.Should().BeTrue();
        result.Port.Should().BeNull();
    }

    [Fact]
    public void FindByChipId_ReturnsUnavailable_WhenReaderThrows()
    {
        var reader = Substitute.For<IUsbSerialDescriptorReader>();
        reader.IsSupported.Returns(true);
        reader.Read(Arg.Any<IReadOnlyCollection<string>>()).Throws(new InvalidOperationException("boom"));
        var locator = new TeensyPortLocator([reader], _log, () => ["COM1"]);

        var result = locator.FindByChipId("14470230");

        result.FilterAvailable.Should().BeFalse();
        result.Port.Should().BeNull();
        result.UnavailableReason.Should().Be("boom");
    }

    [Fact]
    public void FindByChipId_ReturnsFirstMatch_AndLogsWarning_WhenSeveralPresentPortsClaimTheSameChip()
    {
        var rows = new[]
        {
            new UsbSerialDescriptor("COM12", TeensyUsbIds.Vendor, TeensyUsbIds.ProductFull, "TeensyROM-Serial-14470230"),
            new UsbSerialDescriptor("COM5", TeensyUsbIds.Vendor, TeensyUsbIds.ProductMinimal, "14470230")
        };
        var locator = new TeensyPortLocator([SupportedReader(rows)], _log, () => ["COM12", "COM5"]);

        var result = locator.FindByChipId("14470230");

        result.FilterAvailable.Should().BeTrue();
        result.Port!.PortName.Should().Be("COM12");
        _log.Received(1).InternalWarning(Arg.Is<string>(m => m.Contains("14470230")), Arg.Any<string>());
    }
}
