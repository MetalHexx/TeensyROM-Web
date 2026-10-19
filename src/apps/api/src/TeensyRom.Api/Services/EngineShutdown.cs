namespace TeensyRom.Api.Services
{
    /// <summary>
    /// Stops the engine process gracefully.
    /// </summary>
    public interface IEngineShutdown
    {
        /// <summary>
        /// Requests a graceful shutdown and returns immediately; the stop begins after a short delay
        /// so the response to the request that asked for it can flush.
        /// </summary>
        void RequestStop();
    }

    /// <summary>
    /// Stops the host through <see cref="IHostApplicationLifetime"/>.
    /// </summary>
    public class EngineShutdown(IHostApplicationLifetime lifetime) : IEngineShutdown
    {
        private static readonly TimeSpan FlushDelay = TimeSpan.FromMilliseconds(500);

        public void RequestStop()
        {
            Task.Run(async () =>
            {
                await Task.Delay(FlushDelay);
                lifetime.StopApplication();
            });
        }
    }
}
