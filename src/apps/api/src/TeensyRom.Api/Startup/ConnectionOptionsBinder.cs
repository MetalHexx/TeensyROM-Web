using Microsoft.Extensions.Configuration;
using TeensyRom.Core.Serial.Recovery;

namespace TeensyRom.Api.Startup
{
    /// <summary>
    /// Binds the "Connection" configuration section onto a fresh <see cref="ConnectionOptions"/> and
    /// clamps every tunable to something sane, mirroring <see cref="TeensyRom.Api.Transfers.TransferOptionsBinder"/>.
    /// </summary>
    public static class ConnectionOptionsBinder
    {
        public static ConnectionOptions BindFrom(IConfiguration configuration)
        {
            var options = new ConnectionOptions();

            configuration.GetSection("Connection").Bind(options);

            options.PollIntervalMs = Math.Max(10, options.PollIntervalMs);
            options.Tcp.ToMinimalMs = Math.Max(1, options.Tcp.ToMinimalMs);
            options.Tcp.ToFullMs = Math.Max(1, options.Tcp.ToFullMs);
            options.Serial.ToMinimalMs = Math.Max(1, options.Serial.ToMinimalMs);
            options.Serial.ToFullMs = Math.Max(1, options.Serial.ToFullMs);
            options.LaunchSettleMs = Math.Max(1, options.LaunchSettleMs);
            options.ConnectTimeoutMs = Math.Max(1, options.ConnectTimeoutMs);

            return options;
        }
    }
}
