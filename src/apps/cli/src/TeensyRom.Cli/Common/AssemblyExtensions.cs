using System.Reflection;

namespace TeensyRom.Cli.Common
{

    public static class AssemblyExtensions
    {
        public static string GetVersion(this Assembly assembly)
        {
            string version = assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "Unknown version";
            var plusIndex = version.IndexOf('+');
            version = plusIndex > -1 ? version.Substring(0, plusIndex) : version;
            return version;
        }
    }
}
