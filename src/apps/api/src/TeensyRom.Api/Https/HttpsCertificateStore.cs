using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;

namespace TeensyRom.Api.Https;

public enum HttpsCertificateChange { None, Created, Reissued }

public enum HttpsCertificateChangeReason { Unreadable, Expiring, HostNameChanged, NewAddress }

/// <summary>The outcome of <see cref="HttpsCertificateStore.Ensure"/>.</summary>
/// <param name="Certificate">The certificate to serve; null when it could not be created or loaded.</param>
/// <param name="Change">What the store did to the stored certificate.</param>
/// <param name="Reason">Why it was re-issued; set only when <paramref name="Change"/> is <see cref="HttpsCertificateChange.Reissued"/>.</param>
/// <param name="Names">DNS names then IP addresses the certificate covers; empty when <paramref name="Certificate"/> is null.</param>
/// <param name="IssuedAt">When the certificate became valid.</param>
/// <param name="ExpiresAt">When the certificate expires.</param>
/// <param name="Problem">Why <paramref name="Certificate"/> is null, as a sentence for the user.</param>
public sealed record HttpsCertificateResult(
    X509Certificate2? Certificate,
    HttpsCertificateChange Change,
    HttpsCertificateChangeReason? Reason,
    IReadOnlyList<string> Names,
    DateTimeOffset? IssuedAt,
    DateTimeOffset? ExpiresAt,
    string? Problem);

/// <summary>What the coverage decision needs to know about the certificate already on disk.</summary>
public sealed record StoredCertificateFacts(
    IReadOnlyList<string> DnsNames,
    IReadOnlyList<IPAddress> IPAddresses,
    DateTimeOffset NotAfter);

/// <summary>
/// Keeps a usable self-signed HTTPS certificate in <paramref name="folder"/>: creates one when there is none,
/// keeps it while it still covers this machine, and re-issues it (recording why) when it does not.
/// </summary>
public sealed class HttpsCertificateStore(string folder, TimeProvider clock)
{
    public const string FileName = "engine-https.pfx";

    /// <summary>Kept at or under Apple's 825-day limit for trusted server certificates.</summary>
    public static readonly TimeSpan Validity = TimeSpan.FromDays(730);
    public static readonly TimeSpan RenewWithin = TimeSpan.FromDays(30);

    private const string ServerAuthOid = "1.3.6.1.5.5.7.3.1";
    private const string SubjectAlternativeNameOid = "2.5.29.17";

    private string FilePath => Path.Combine(folder, FileName);

    /// <summary>Loads the stored certificate, or creates/re-issues it. Never throws: failures come back in Problem.</summary>
    public HttpsCertificateResult Ensure(string hostName, IReadOnlyList<IPAddress> lanAddresses)
    {
        try
        {
            var dnsNames = RequiredDnsNames(hostName);
            var ipAddresses = RequiredIPAddresses(lanAddresses);
            var now = clock.GetUtcNow();

            if (!File.Exists(FilePath))
            {
                return Issue(dnsNames, ipAddresses, now, HttpsCertificateChange.Created, null);
            }

            var existing = TryLoadStored();
            var decision = Decide(existing is null ? null : ReadFacts(existing), dnsNames, ipAddresses, now);

            if (decision is null)
            {
                RestrictFile(FilePath);
                return Describe(existing!, HttpsCertificateChange.None, null);
            }

            existing?.Dispose();
            return Issue(dnsNames, ipAddresses, now, HttpsCertificateChange.Reissued, decision);
        }
        catch (Exception ex)
        {
            return new HttpsCertificateResult(
                null, HttpsCertificateChange.None, null, [], null, null,
                $"The HTTPS certificate couldn't be saved in {folder}: {ex.Message}");
        }
    }

    /// <summary>
    /// Decides whether a certificate that exists on disk must be re-issued, and why. Rules in order: unreadable,
    /// expiring (an expired certificate included), a required DNS name missing, a required address missing.
    /// Names the certificate lists beyond the required ones never matter.
    /// </summary>
    /// <param name="existing">The stored certificate's facts; null when it could not be read or has no private key.</param>
    /// <param name="requiredDnsNames">DNS names the certificate must cover.</param>
    /// <param name="requiredIPAddresses">IP addresses the certificate must cover.</param>
    /// <param name="now">The current time.</param>
    /// <returns>The reason to re-issue, or null to keep the certificate.</returns>
    public static HttpsCertificateChangeReason? Decide(
        StoredCertificateFacts? existing,
        IReadOnlyList<string> requiredDnsNames,
        IReadOnlyList<IPAddress> requiredIPAddresses,
        DateTimeOffset now)
    {
        if (existing is null)
        {
            return HttpsCertificateChangeReason.Unreadable;
        }

        if (existing.NotAfter - now < RenewWithin)
        {
            return HttpsCertificateChangeReason.Expiring;
        }

        if (requiredDnsNames.Any(required => !existing.DnsNames.Contains(required, StringComparer.OrdinalIgnoreCase)))
        {
            return HttpsCertificateChangeReason.HostNameChanged;
        }

        if (requiredIPAddresses.Any(required => !existing.IPAddresses.Contains(required)))
        {
            return HttpsCertificateChangeReason.NewAddress;
        }

        return null;
    }

    /// <summary>The DNS names a client may use to reach this machine: localhost, the host name, and its <c>.local</c> form.</summary>
    public static IReadOnlyList<string> RequiredDnsNames(string hostName)
    {
        var names = new List<string> { "localhost" };

        if (!string.IsNullOrWhiteSpace(hostName))
        {
            names.Add(hostName);

            if (!hostName.Contains('.'))
            {
                names.Add(hostName + ".local");
            }
        }

        return names.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
    }

    private static IReadOnlyList<IPAddress> RequiredIPAddresses(IReadOnlyList<IPAddress> lanAddresses) =>
        new[] { IPAddress.Loopback }.Concat(lanAddresses).Distinct().ToList();

    private X509Certificate2? TryLoadStored()
    {
        try
        {
            var certificate = X509CertificateLoader.LoadPkcs12FromFile(FilePath, password: null);

            if (certificate.HasPrivateKey)
            {
                return certificate;
            }

            certificate.Dispose();
            return null;
        }
        catch (Exception ex) when (ex is CryptographicException or IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private HttpsCertificateResult Issue(
        IReadOnlyList<string> dnsNames,
        IReadOnlyList<IPAddress> ipAddresses,
        DateTimeOffset now,
        HttpsCertificateChange change,
        HttpsCertificateChangeReason? reason)
    {
        var pfx = CreatePfx(dnsNames, ipAddresses, now);
        WriteFile(pfx);

        // Serve the certificate loaded back from the file: Windows SChannel cannot use the ephemeral key of the in-memory one.
        var certificate = X509CertificateLoader.LoadPkcs12FromFile(FilePath, password: null);
        return Describe(certificate, change, reason);
    }

    private static byte[] CreatePfx(IReadOnlyList<string> dnsNames, IReadOnlyList<IPAddress> ipAddresses, DateTimeOffset now)
    {
        using var key = RSA.Create(2048);
        var request = new CertificateRequest("CN=TeensyROM Suite", key, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);

        request.CertificateExtensions.Add(new X509BasicConstraintsExtension(false, false, 0, true));
        request.CertificateExtensions.Add(new X509KeyUsageExtension(
            X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.KeyEncipherment, true));
        request.CertificateExtensions.Add(new X509EnhancedKeyUsageExtension(
            [new Oid(ServerAuthOid)], false));

        var names = new SubjectAlternativeNameBuilder();

        foreach (var dnsName in dnsNames)
        {
            names.AddDnsName(dnsName);
        }

        foreach (var ipAddress in ipAddresses)
        {
            names.AddIpAddress(ipAddress);
        }

        request.CertificateExtensions.Add(names.Build());

        // Backdated a day so a client whose clock runs a little behind still accepts it.
        var notBefore = now - TimeSpan.FromDays(1);
        using var certificate = request.CreateSelfSigned(notBefore, notBefore + Validity);

        return certificate.Export(X509ContentType.Pkcs12);
    }

    private void WriteFile(byte[] pfx)
    {
        var tempPath = Path.Combine(folder, $"{FileName}.{Guid.NewGuid():N}.tmp");

        try
        {
            if (OperatingSystem.IsWindows())
            {
                Directory.CreateDirectory(folder);
                File.WriteAllBytes(tempPath, pfx);
            }
            else
            {
                Directory.CreateDirectory(folder, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);

                using var stream = new FileStream(tempPath, new FileStreamOptions
                {
                    Mode = FileMode.CreateNew,
                    Access = FileAccess.Write,
                    UnixCreateMode = UnixFileMode.UserRead | UnixFileMode.UserWrite
                });
                stream.Write(pfx);
            }

            File.Move(tempPath, FilePath, overwrite: true);
        }
        finally
        {
            if (File.Exists(tempPath))
            {
                File.Delete(tempPath);
            }
        }
    }

    private static void RestrictFile(string path)
    {
        if (!OperatingSystem.IsWindows())
        {
            File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        }
    }

    private static StoredCertificateFacts ReadFacts(X509Certificate2 certificate)
    {
        var (dnsNames, ipAddresses) = ReadNames(certificate);
        return new StoredCertificateFacts(dnsNames, ipAddresses, new DateTimeOffset(certificate.NotAfter.ToUniversalTime()));
    }

    private static (List<string> DnsNames, List<IPAddress> IPAddresses) ReadNames(X509Certificate2 certificate)
    {
        var extension = certificate.Extensions[SubjectAlternativeNameOid];

        if (extension is null)
        {
            return ([], []);
        }

        var names = new X509SubjectAlternativeNameExtension(extension.RawData, extension.Critical);
        return (names.EnumerateDnsNames().ToList(), names.EnumerateIPAddresses().ToList());
    }

    private static HttpsCertificateResult Describe(
        X509Certificate2 certificate,
        HttpsCertificateChange change,
        HttpsCertificateChangeReason? reason)
    {
        var (dnsNames, ipAddresses) = ReadNames(certificate);

        return new HttpsCertificateResult(
            certificate,
            change,
            reason,
            dnsNames.Concat(ipAddresses.Select(a => a.ToString())).ToList(),
            new DateTimeOffset(certificate.NotBefore.ToUniversalTime()),
            new DateTimeOffset(certificate.NotAfter.ToUniversalTime()),
            null);
    }
}
