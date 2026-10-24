using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;

namespace TeensyRom.Api.Http
{
    /// <summary>
    /// Rate limiting for the device discovery endpoint. Only full scans are limited, to one per 5 seconds;
    /// a plain listing of known devices is never limited.
    /// <remarks>
    /// A full scan opens the serial ports, and a cancellation in the middle of that discovery phase leaves the
    /// serial layer in a bad state. Limiting scans keeps a spammed browser refresh from causing that, and is a
    /// simpler fix than making discovery cancellation-safe.
    /// </remarks>
    /// </summary>
    public static class RateLimitHelper
    {
        public const string FindDevicesRateLimiter = "FindDevicesRateLimiterPolicy";

        /// <summary>
        /// Puts requests with <c>fullScan=true</c> in one shared one-permit-per-5-seconds partition and
        /// every other request in a partition with no limit.
        /// </summary>
        public static RateLimitPartition<string> FindDevicesPartition(HttpContext context) =>
            bool.TryParse(context.Request.Query["fullScan"], out var fullScan) && fullScan
                ? RateLimitPartition.GetFixedWindowLimiter("fullScan", _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 1,
                    Window = TimeSpan.FromSeconds(5),
                    QueueProcessingOrder = QueueProcessingOrder.NewestFirst,
                    QueueLimit = 1
                })
                : RateLimitPartition.GetNoLimiter("listing");

        public static IServiceCollection AddStrictRateLimiting(this IServiceCollection services)
        {
            services.AddRateLimiter(options =>
            {
                options.AddPolicy(FindDevicesRateLimiter, FindDevicesPartition);
            });
            return services;
        }
    }
}
