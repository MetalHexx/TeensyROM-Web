namespace TeensyRom.Cli.Api;

/// <summary>
/// A tr-web failure with a message that is ready to show the user as is.
/// </summary>
/// <param name="message">Plain text for the console.</param>
/// <param name="statusCode">The HTTP status when tr-web answered; null when it didn't (gone, timed out).</param>
/// <param name="inner">The underlying failure.</param>
/// <param name="details">What the failed request knew, when there is more to say than the message.</param>
internal sealed class TeensyApiException(string message, int? statusCode = null, Exception? inner = null, ErrorDetails? details = null) : Exception(message, inner)
{
    public int? StatusCode { get; } = statusCode;

    public ErrorDetails? Details { get; } = details;
}
