using System.Reflection;
using TeensyRom.Core.Common;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// Resolves the on-disk location of the index database.
    /// </summary>
    public static class IndexPaths
    {
        public const string Index_Db_Relative_Path = "Data";
        public const string Index_Db_File_Name = "index.db";

        /// <summary>
        /// Resolves to <c>&lt;data dir&gt;/Data/index.db</c>. The <c>Data</c> directory is deliberately outside
        /// <c>Assets/</c>: startup unpacks asset zips over that tree with overwrite enabled on every run.
        /// </summary>
        public static string ResolveDatabasePath() => Path.Combine(
            Assembly.GetExecutingAssembly().GetDataPath(),
            Index_Db_Relative_Path,
            Index_Db_File_Name);
    }
}
