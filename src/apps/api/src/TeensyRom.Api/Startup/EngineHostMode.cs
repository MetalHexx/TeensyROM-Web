using System.Reflection;

namespace TeensyRom.Api.Startup
{
    public static class EngineHostMode
    {
        /// <summary>
        /// True when the OpenAPI build step (<c>GetDocument.Insider</c>) is executing <c>Program</c> to read the
        /// endpoints. It runs the whole startup path and starts the host, so nothing may touch the real home,
        /// take the instance lock, or run hosted services in this mode.
        /// </summary>
        public static bool IsBuildTimeDocumentGeneration =>
            Assembly.GetEntryAssembly()?.GetName().Name == "GetDocument.Insider";
    }
}
