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
    }
}
