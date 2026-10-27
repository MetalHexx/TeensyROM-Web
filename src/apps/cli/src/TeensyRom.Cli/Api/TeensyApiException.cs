namespace TeensyRom.Cli.Api;

/// <summary>
/// A tr-web failure with a message that is ready to show the user as is.
/// </summary>
/// <param name="message">Plain text for the console.</param>
/// <param name="statusCode">The HTTP status when tr-web answered; null when it didn't (gone, timed out).</param>
/// <param name="inner">The underlying failure.</param>
/// <param name="details">What the failed request knew, when there is more to say than the message.</param>
/// <param name="problemCode">The machine-readable <c>code</c> of the problem body, when tr-web sent one.</param>
internal sealed class TeensyApiException(string message, int? statusCode = null, Exception? inner = null, ErrorDetails? details = null, string? problemCode = null) : Exception(message, inner)
{
    public const string DeviceBusyProblemCode = "deviceBusyWithTransfer";

    public int? StatusCode { get; } = statusCode;

    public string? ProblemCode { get; } = problemCode;

    /// <summary>True when tr-web refused because the device is in the middle of a transfer.</summary>
    public bool IsDeviceBusy => StatusCode == 409 && ProblemCode == DeviceBusyProblemCode;

    public ErrorDetails? Details { get; } = details;
}
