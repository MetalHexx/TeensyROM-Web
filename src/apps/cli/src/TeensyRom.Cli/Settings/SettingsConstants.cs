using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TeensyRom.Cli.Common;

namespace TeensyRom.Cli.Settings
{
    public static class SettingsConstants
    {
        public static string SettingsPath => Path.Combine(TeensyRomHome.CliPath, "Settings.json");
    }
}
