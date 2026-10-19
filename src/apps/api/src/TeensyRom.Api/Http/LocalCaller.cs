using System.Net;

namespace TeensyRom.Api.Http
{
    /// <summary>
    /// Tells whether a request came from the machine the engine runs on.
    /// </summary>
    public static class LocalCaller
    {
        /// <summary>
        /// True when <paramref name="remote"/> is a loopback address, including an IPv4 loopback
        /// carried in an IPv6 socket. A missing address is never loopback.
        /// </summary>
        public static bool IsLoopback(IPAddress? remote)
        {
            if (remote is null) return false;

            if (remote.IsIPv4MappedToIPv6)
            {
                remote = remote.MapToIPv4();
            }

            return IPAddress.IsLoopback(remote);
        }
    }
}
