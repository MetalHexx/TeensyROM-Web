using System.ComponentModel.DataAnnotations;
using System.Net;
using TeensyRom.Core.Serial;

namespace TeensyRom.Api.Endpoints.Serial.ConnectTcpDevice;

/// <summary>Request to connect directly to a TeensyROM device over TCP.</summary>
public class ConnectTcpDeviceRequest
{
    /// <summary>The IPv4 or IPv6 address of the TeensyROM device.</summary>
    [Required]
    public string IpAddress { get; set; } = string.Empty;

    /// <summary>The TeensyROM TCP port. Defaults to 2112.</summary>
    public int Port { get; set; } = TcpConstants.TeensyRomPort;
}

public class ConnectTcpDeviceRequestValidator : AbstractValidator<ConnectTcpDeviceRequest>
{
    public ConnectTcpDeviceRequestValidator()
    {
        RuleFor(request => request.IpAddress)
            .NotEmpty().WithMessage("A device IP address is required.")
            .Must(address => IPAddress.TryParse(address, out _))
            .WithMessage("Enter a valid IPv4 or IPv6 address.");
        RuleFor(request => request.Port)
            .InclusiveBetween(1, 65535)
            .WithMessage("TCP port must be between 1 and 65535.");
    }
}

public class ConnectTcpDeviceResponse
{
    [Required] public CartDto Device { get; set; } = new();
    [Required] public string Message { get; set; } = "Connected.";
}
