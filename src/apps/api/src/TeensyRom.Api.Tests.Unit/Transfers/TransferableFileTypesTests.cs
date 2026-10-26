using TeensyRom.Api.Transfers;

namespace TeensyRom.Api.Tests.Unit.Transfers;

public class TransferableFileTypesTests
{
    [Theory]
    [InlineData("/music/disk.d81", true)]
    [InlineData("/music/INFO.NFO", true)]
    [InlineData("/music/readme.md", true)]
    [InlineData("/music/notes.doc", false)]
    [InlineData("/music/pack.zip", false)]
    public void IsTransferable_AdmitsFirmwareTypesCaseInsensitively_AndRejectsEverythingElse(string path, bool expected)
    {
        TransferableFileTypes.IsTransferable(path).Should().Be(expected);
    }
}
