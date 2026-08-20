using System.Reflection;
using System.Security.Cryptography;
using TeensyRom.Core.Common;
using TeensyRom.Core.Games;
using TeensyRom.Core.Music;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// Stamps a metadata projection with a snapshot of the local databases it was built from, so staleness is
    /// detectable: a release shipping updated metadata leaves every previously projected row carrying an old
    /// stamp, and rebuilding is just re-running the projection.
    /// </summary>
    public interface IMetadataSourceVersion
    {
        /// <summary>A composite of the three local sources, computed once per run.</summary>
        string Current { get; }
    }

    /// <inheritdoc cref="IMetadataSourceVersion"/>
    public sealed class MetadataSourceVersion : IMetadataSourceVersion
    {
        /// <summary>Resolves every source under the assembly's data directory.</summary>
        public MetadataSourceVersion() : this(Assembly.GetExecutingAssembly().GetDataPath()) { }

        /// <summary>Resolves every source under <paramref name="dataDirectory"/> — the seam tests use.</summary>
        public MetadataSourceVersion(string dataDirectory)
        {
            ArgumentException.ThrowIfNullOrWhiteSpace(dataDirectory);

            Current = string.Join(";",
                ResolveHvscComponent(dataDirectory),
                ResolveHashedComponent("deepsid", Path.Combine(dataDirectory, MusicConstants.DeepSid_Db_Local_Path, "deepsid_db.json")),
                ResolveHashedComponent("games", Path.Combine(dataDirectory, GameConstants.Game_Image_Metadata_File_Path)));
        }

        public string Current { get; }

        /// <summary>
        /// The HVSC component names the CSV rather than hashing it — the file is large and its name already
        /// changes release to release (e.g. <c>SIDlist_82_UTF8.csv</c>).
        /// </summary>
        private static string ResolveHvscComponent(string dataDirectory)
        {
            var sidListPath = Path.Combine(dataDirectory, MusicConstants.SidList_Local_Path);

            if (!Directory.Exists(sidListPath))
            {
                return "hvsc=absent";
            }

            var csvFile = Directory.GetFiles(sidListPath, "*.csv")
                .Select(file => new FileInfo(file))
                .OrderByDescending(file => file.LastWriteTimeUtc)
                .FirstOrDefault();

            return csvFile is null ? "hvsc=absent" : $"hvsc={csvFile.Name}";
        }

        private static string ResolveHashedComponent(string name, string filePath)
        {
            if (!File.Exists(filePath))
            {
                return $"{name}=absent";
            }

            using var stream = File.OpenRead(filePath);
            var hash = SHA256.HashData(stream);
            var hex = Convert.ToHexString(hash)[..12].ToLowerInvariant();

            return $"{name}={hex}";
        }
    }
}
