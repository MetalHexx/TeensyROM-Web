using TeensyRom.Cli.Engine;

namespace TeensyRom.Cli.Tests;

public class HttpsNoticeTests
{
    [Theory]
    [InlineData("Unreadable", "read")]
    [InlineData("Expiring", "expire")]
    [InlineData("HostNameChanged", "name changed")]
    [InlineData("NewAddress", "new network address")]
    public void Reissued_NamesTheReason(string reason, string text)
    {
        var notice = HttpsNotice.For(CertificateChange.Reissued, Enum.Parse<CertificateChangeReason>(reason), 10214);

        notice.Should().Contain("re-issued").And.Contain(text);
    }

    [Fact]
    public void Created_NamesThePort()
    {
        HttpsNotice.For(CertificateChange.Created, null, 10214).Should().Contain("created").And.Contain("10214");
    }

    [Fact]
    public void None_HasNoNotice()
    {
        HttpsNotice.For(CertificateChange.None, null, 10214).Should().BeNull();
    }
}
