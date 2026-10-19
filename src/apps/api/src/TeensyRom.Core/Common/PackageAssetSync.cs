using System.IO.Compression;

namespace TeensyRom.Core.Common
{
    /// <summary>
    /// Copies the assets shipped beside the program into the per-user home, once per engine version.
    /// The package folder is only ever read; nothing is written to or deleted from it.
    /// </summary>
    public static class PackageAssetSync
    {
        private const string RuntimeDataFolderName = "System";

        private static readonly object _syncGate = new();

        /// <summary>
        /// Brings <paramref name="homeAssets"/> in line with <paramref name="packageAssets"/> when the
        /// <c>.package-version</c> marker is missing or differs from <paramref name="version"/>.
        /// </summary>
        /// <remarks>
        /// A refresh removes every top-level home folder except <c>System</c> (settings, connection records, logs),
        /// then copies the package tree, skipping its own <c>System</c> folder and <c>*.cs</c> files and extracting
        /// <c>*.zip</c> files into their folder. The marker is written last, so an interrupted sync runs again.
        /// A missing package folder is a no-op. Calls are serialized process-wide.
        /// </remarks>
        /// <param name="packageAssets">The <c>Assets</c> folder beside the program (a release holds it unpacked, a Debug build holds zips).</param>
        /// <param name="homeAssets">The <c>Assets</c> folder under <see cref="TeensyRomHome.ApiPath"/>.</param>
        /// <param name="version">The engine's informational version.</param>
        public static void Sync(string packageAssets, string homeAssets, string version)
        {
            lock (_syncGate)
            {
                if (!Directory.Exists(packageAssets)) return;

                var markerPath = Path.Combine(homeAssets, TeensyRomHome.PackageVersionFileName);

                if (File.Exists(markerPath) && File.ReadAllText(markerPath).Trim() == version) return;

                Directory.CreateDirectory(homeAssets);
                DeleteStaleAssets(homeAssets);
                CopyPackage(packageAssets, homeAssets, isRoot: true);

                File.WriteAllText(markerPath, version);
            }
        }

        private static void DeleteStaleAssets(string homeAssets)
        {
            foreach (var folder in Directory.GetDirectories(homeAssets))
            {
                if (IsRuntimeDataFolder(folder)) continue;

                Directory.Delete(folder, recursive: true);
            }
        }

        private static void CopyPackage(string source, string target, bool isRoot)
        {
            Directory.CreateDirectory(target);

            foreach (var file in Directory.EnumerateFiles(source))
            {
                var fileName = Path.GetFileName(file);

                if (fileName.EndsWith(".cs", StringComparison.OrdinalIgnoreCase)) continue;

                if (fileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                {
                    ZipFile.ExtractToDirectory(file, target, overwriteFiles: true);
                    continue;
                }
                File.Copy(file, Path.Combine(target, fileName), overwrite: true);
            }

            foreach (var folder in Directory.EnumerateDirectories(source))
            {
                if (isRoot && IsRuntimeDataFolder(folder)) continue;

                CopyPackage(folder, Path.Combine(target, Path.GetFileName(folder)), isRoot: false);
            }
        }

        private static bool IsRuntimeDataFolder(string folder) =>
            string.Equals(Path.GetFileName(folder), RuntimeDataFolderName, StringComparison.OrdinalIgnoreCase);
    }
}
