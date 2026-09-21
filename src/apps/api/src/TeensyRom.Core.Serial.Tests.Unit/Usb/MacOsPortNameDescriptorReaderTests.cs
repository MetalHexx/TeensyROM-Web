using System.Runtime.CompilerServices;
using System.Text.Json;
using TeensyRom.Core.Serial.Usb;

namespace TeensyRom.Core.Serial.Tests.Unit.Usb;

/// <summary>
/// Unit tests for <see cref="MacOsPortNameDescriptorReader"/> against the captured device-node list (see
/// Captured/macos-dev-nodes.json).
/// </summary>
public class MacOsPortNameDescriptorReaderTests
{
    private readonly IReadOnlyList<string> _capturedNodes = LoadCapturedNodes();

    [Fact]
    public void Read_YieldsBothTeensyRomRows_ClassifiedByChipDigitsOnly()
    {
        var sut = new MacOsPortNameDescriptorReader(() => _capturedNodes);

        var result = sut.Read([]);

        result.Should().BeEquivalentTo(new[]
        {
            new UsbSerialDescriptor("/dev/cu.usbmodem144702301", null, null, "14470230"),
            new UsbSerialDescriptor("/dev/cu.usbmodemTeensyROM_Serial_192772601", null, null, "19277260")
        });
    }

    private static IReadOnlyList<string> LoadCapturedNodes([CallerFilePath] string testFilePath = "")
    {
        var path = Path.Combine(Path.GetDirectoryName(testFilePath)!, "Captured", "macos-dev-nodes.json");
        var json = File.ReadAllText(path);
        return JsonSerializer.Deserialize<List<string>>(json) ?? [];
    }
}
