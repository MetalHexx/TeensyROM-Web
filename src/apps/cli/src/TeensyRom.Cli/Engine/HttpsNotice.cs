namespace TeensyRom.Cli.Engine;

/// <summary>The wording of the certificate notice, kept in one place.</summary>
internal static class HttpsNotice
{
    /// <summary>What to tell the user about this run's certificate change; null when the engine changed nothing.</summary>
    public static string? For(CertificateChange change, CertificateChangeReason? reason, int port) => change switch
    {
        CertificateChange.Created =>
            $"Trom API created a security certificate for its secure address (port {port}). Browsers on other devices warn once the first time they open it; accept the warning to continue.",
        CertificateChange.Reissued =>
            $"Trom API re-issued its security certificate because {Reason(reason)}. Browsers on devices that had accepted the old one will warn again.",
        _ => null
    };

    private static string Reason(CertificateChangeReason? reason) => reason switch
    {
        CertificateChangeReason.Unreadable => "the old one couldn't be read",
        CertificateChangeReason.Expiring => "the old one was about to expire",
        CertificateChangeReason.HostNameChanged => "this computer's name changed",
        CertificateChangeReason.NewAddress => "this computer has a new network address",
        _ => "it needed replacing"
    };
}
