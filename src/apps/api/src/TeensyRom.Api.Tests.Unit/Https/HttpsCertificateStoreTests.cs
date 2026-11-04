using System.Net;
using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.Time.Testing;
using TeensyRom.Api.Https;

namespace TeensyRom.Api.Tests.Unit.Https;

public sealed class HttpsCertificateStoreTests : IDisposable
{
    private static readonly IPAddress Lan = IPAddress.Parse("192.168.1.20");
    private static readonly IPAddress OtherLan = IPAddress.Parse("10.0.0.7");

    private readonly string _folder = Path.Combine(Path.GetTempPath(), "teensyrom-https-tests-" + Guid.NewGuid().ToString("N"));
    private readonly FakeTimeProvider _clock = new(new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero));

    private HttpsCertificateStore CreateStore() => new(_folder, _clock);

    private string PfxPath => Path.Combine(_folder, HttpsCertificateStore.FileName);

    public void Dispose()
    {
        if (Directory.Exists(_folder))
        {
            Directory.Delete(_folder, recursive: true);
        }
    }

    [Fact]
    public void Ensure_CreatesTheCertificate_WhenThereIsNone()
    {
        var result = CreateStore().Ensure("studio-pc", [Lan]);

        result.Change.Should().Be(HttpsCertificateChange.Created);
        result.Reason.Should().BeNull();
        result.Problem.Should().BeNull();
        result.Certificate.Should().NotBeNull();
        result.Certificate!.HasPrivateKey.Should().BeTrue();
        result.Names.Should().BeEquivalentTo("localhost", "studio-pc", "studio-pc.local", "127.0.0.1", "192.168.1.20");
        File.Exists(PfxPath).Should().BeTrue();
    }

    [Fact]
    public void Ensure_ReusesTheCertificate_WhenItStillCoversTheMachine()
    {
        var first = CreateStore().Ensure("studio-pc", [Lan]);

        var second = CreateStore().Ensure("studio-pc", [Lan]);

        second.Change.Should().Be(HttpsCertificateChange.None);
        second.Reason.Should().BeNull();
        second.Certificate!.Thumbprint.Should().Be(first.Certificate!.Thumbprint);
    }

    [Fact]
    public void Ensure_DoesNotAddALocalName_WhenTheHostNameAlreadyHasADot()
    {
        var result = CreateStore().Ensure("studio.example.org", []);

        result.Names.Should().BeEquivalentTo("localhost", "studio.example.org", "127.0.0.1");
    }

    [Fact]
    public void Ensure_MatchesHostNamesCaseInsensitively()
    {
        CreateStore().Ensure("Studio-PC", [Lan]);

        var result = CreateStore().Ensure("studio-pc", [Lan]);

        result.Change.Should().Be(HttpsCertificateChange.None);
    }

    [Fact]
    public void Ensure_ReissuesAsUnreadable_WhenTheFileIsCorrupt()
    {
        var first = CreateStore().Ensure("studio-pc", [Lan]);
        first.Certificate!.Dispose();
        File.WriteAllBytes(PfxPath, [1, 2, 3, 4]);

        var result = CreateStore().Ensure("studio-pc", [Lan]);

        result.Change.Should().Be(HttpsCertificateChange.Reissued);
        result.Reason.Should().Be(HttpsCertificateChangeReason.Unreadable);
        result.Certificate!.HasPrivateKey.Should().BeTrue();
    }

    [Fact]
    public void Ensure_ReissuesAsUnreadable_WhenTheFileHasNoPrivateKey()
    {
        var first = CreateStore().Ensure("studio-pc", [Lan]);
        var publicOnly = first.Certificate!.Export(X509ContentType.Cert);
        first.Certificate.Dispose();
        File.WriteAllBytes(PfxPath, publicOnly);

        var result = CreateStore().Ensure("studio-pc", [Lan]);

        result.Reason.Should().Be(HttpsCertificateChangeReason.Unreadable);
    }

    [Fact]
    public void Ensure_ReissuesAsExpiring_WhenLessThanThirtyDaysRemain()
    {
        var first = CreateStore().Ensure("studio-pc", [Lan]);
        _clock.Advance(HttpsCertificateStore.Validity - TimeSpan.FromDays(1) - TimeSpan.FromDays(29));

        var result = CreateStore().Ensure("studio-pc", [Lan]);

        result.Change.Should().Be(HttpsCertificateChange.Reissued);
        result.Reason.Should().Be(HttpsCertificateChangeReason.Expiring);
        result.Certificate!.Thumbprint.Should().NotBe(first.Certificate!.Thumbprint);
        result.ExpiresAt.Should().BeAfter(_clock.GetUtcNow() + TimeSpan.FromDays(700));
    }

    [Fact]
    public void Ensure_ReissuesAsExpiring_WhenTheCertificateHasAlreadyExpired()
    {
        CreateStore().Ensure("studio-pc", [Lan]);
        _clock.Advance(TimeSpan.FromDays(1000));

        var result = CreateStore().Ensure("studio-pc", [Lan]);

        result.Reason.Should().Be(HttpsCertificateChangeReason.Expiring);
    }

    [Fact]
    public void Ensure_KeepsTheCertificate_WhenMoreThanThirtyDaysRemain()
    {
        CreateStore().Ensure("studio-pc", [Lan]);
        _clock.Advance(HttpsCertificateStore.Validity - TimeSpan.FromDays(1) - TimeSpan.FromDays(31));

        var result = CreateStore().Ensure("studio-pc", [Lan]);

        result.Change.Should().Be(HttpsCertificateChange.None);
    }

    [Fact]
    public void Ensure_ReissuesAsHostNameChanged_WhenTheHostIsRenamed()
    {
        CreateStore().Ensure("studio-pc", [Lan]);

        var result = CreateStore().Ensure("raspberrypi", [Lan]);

        result.Change.Should().Be(HttpsCertificateChange.Reissued);
        result.Reason.Should().Be(HttpsCertificateChangeReason.HostNameChanged);
        result.Names.Should().BeEquivalentTo("localhost", "raspberrypi", "raspberrypi.local", "127.0.0.1", "192.168.1.20");
    }

    [Fact]
    public void Ensure_ReissuesAsNewAddress_WhenTheMachineGainsAnAddress()
    {
        CreateStore().Ensure("studio-pc", [Lan]);

        var result = CreateStore().Ensure("studio-pc", [Lan, OtherLan]);

        result.Change.Should().Be(HttpsCertificateChange.Reissued);
        result.Reason.Should().Be(HttpsCertificateChangeReason.NewAddress);
        result.Names.Should().Contain(["192.168.1.20", "10.0.0.7"]);
    }

    [Fact]
    public void Ensure_KeepsTheCertificate_WhenAnAddressIsRemoved()
    {
        var first = CreateStore().Ensure("studio-pc", [Lan, OtherLan]);

        var result = CreateStore().Ensure("studio-pc", [Lan]);

        result.Change.Should().Be(HttpsCertificateChange.None);
        result.Certificate!.Thumbprint.Should().Be(first.Certificate!.Thumbprint);
    }

    [Fact]
    public void Ensure_IssuesTheMaximumValidityServerAuthCertificate_BackdatedOneDay()
    {
        var result = CreateStore().Ensure("studio-pc", [Lan]);

        var now = _clock.GetUtcNow();
        result.IssuedAt.Should().Be(now - TimeSpan.FromDays(1));
        (result.ExpiresAt - result.IssuedAt).Should().Be(TimeSpan.FromDays(730));

        var usage = result.Certificate!.Extensions.OfType<X509EnhancedKeyUsageExtension>().Single();
        usage.EnhancedKeyUsages.Cast<System.Security.Cryptography.Oid>().Select(o => o.Value).Should().Contain("1.3.6.1.5.5.7.3.1");
    }

    [Fact]
    public void Ensure_RestrictsTheFileToTheOwner_OnUnix()
    {
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        CreateStore().Ensure("studio-pc", [Lan]);
        File.SetUnixFileMode(PfxPath, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.GroupRead | UnixFileMode.OtherRead);

        File.GetUnixFileMode(PfxPath).Should().NotBe(UnixFileMode.UserRead | UnixFileMode.UserWrite);

        CreateStore().Ensure("studio-pc", [Lan]);

        File.GetUnixFileMode(PfxPath).Should().Be(UnixFileMode.UserRead | UnixFileMode.UserWrite);
        File.GetUnixFileMode(_folder).Should().Be(UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
    }

    [Fact]
    public void Ensure_LeavesNoTemporaryFilesBehind()
    {
        CreateStore().Ensure("studio-pc", [Lan]);
        CreateStore().Ensure("other-host", [Lan]);

        Directory.GetFiles(_folder).Should().ContainSingle().Which.Should().Be(PfxPath);
    }

    [Fact]
    public void Ensure_ReturnsAProblemWithoutThrowing_WhenTheFolderCannotBeUsed()
    {
        Directory.CreateDirectory(_folder);
        var blockingFile = Path.Combine(_folder, "not-a-folder");
        File.WriteAllText(blockingFile, "x");
        var store = new HttpsCertificateStore(blockingFile, _clock);

        var result = store.Ensure("studio-pc", [Lan]);

        result.Certificate.Should().BeNull();
        result.Problem.Should().NotBeNullOrWhiteSpace();
        result.Names.Should().BeEmpty();
    }

    [Fact]
    public void Decide_ReportsUnreadable_BeforeAnyOtherRule()
    {
        HttpsCertificateStore.Decide(null, ["localhost"], [IPAddress.Loopback], DateTimeOffset.UnixEpoch)
            .Should().Be(HttpsCertificateChangeReason.Unreadable);
    }

    [Fact]
    public void Decide_ReportsExpiring_BeforeMissingNames()
    {
        var now = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var facts = new StoredCertificateFacts(["localhost"], [IPAddress.Loopback], now + TimeSpan.FromDays(10));

        HttpsCertificateStore.Decide(facts, ["localhost", "new-host"], [IPAddress.Loopback, Lan], now)
            .Should().Be(HttpsCertificateChangeReason.Expiring);
    }

    [Fact]
    public void Decide_ReportsHostNameChanged_BeforeNewAddress()
    {
        var now = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var facts = new StoredCertificateFacts(["localhost"], [IPAddress.Loopback], now + TimeSpan.FromDays(300));

        HttpsCertificateStore.Decide(facts, ["localhost", "new-host"], [IPAddress.Loopback, Lan], now)
            .Should().Be(HttpsCertificateChangeReason.HostNameChanged);
    }
}
