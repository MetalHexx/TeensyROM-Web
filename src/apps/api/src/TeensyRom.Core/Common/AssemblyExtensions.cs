using System.Reflection;

namespace TeensyRom.Core.Common
{
    public static class AssemblyExtensions
    {
        /// <summary>
        /// Get the full path of the assembly
        /// </summary>
        public static string GetPath(this Assembly assembly) 
        {                         
            var location = assembly.Location;
            return Path.GetDirectoryName(location) ?? string.Empty;
        }
    }
}
