using System.Reflection;

namespace TeensyRom.Core.Common
{
    public static class AssemblyExtensions
    {
        /// <summary>
        /// Get the full path of the assembly.
        /// For single-file executables, returns AppContext.BaseDirectory instead of Assembly.Location.
        /// </summary>
        public static string GetPath(this Assembly assembly) 
        {
            // For single-file executables, Assembly.Location returns empty string
            // Use AppContext.BaseDirectory which works for both regular and single-file deployments
            var location = assembly.Location;
            
            if (string.IsNullOrEmpty(location))
            {
                // Single-file executable - use base directory
                return AppContext.BaseDirectory;
            }
            
            // Regular deployment - use assembly location
            return Path.GetDirectoryName(location) ?? AppContext.BaseDirectory;
        }

        /// <summary>
        /// Get the writable data directory path.
        /// Checks TEENSYROM_DATA_DIR environment variable first, then falls back to assembly path.
        /// This allows package managers (like Homebrew) to specify a writable location
        /// while maintaining backward compatibility for manual installations.
        /// </summary>
        public static string GetDataPath(this Assembly assembly)
        {
            var envDataDir = Environment.GetEnvironmentVariable("TEENSYROM_DATA_DIR");
            
            if (!string.IsNullOrWhiteSpace(envDataDir))
            {
                return envDataDir;
            }
            
            // Fallback to assembly path for backward compatibility
            return assembly.GetPath();
        }
    }
}
