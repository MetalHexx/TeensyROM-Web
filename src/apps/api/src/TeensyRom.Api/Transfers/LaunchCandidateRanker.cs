using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Api.Transfers
{
    /// <summary>
    /// Chooses which transferred file a completed job launches: best type rank first, then file name.
    /// </summary>
    public static class LaunchCandidateRanker
    {
        /// <summary>
        /// 0 games (Prg, Crt, P00), 1 Sid, 2 images and text (Kla, Koa, Art, Aas, Hpi, Seq, Txt), 3 Hex;
        /// null for everything else: D64, Zip, Nfo, Unknown - which covers .trh, .reu, .d71, .d81, .md, .ocp, .pic.
        /// </summary>
        public static int? RankOf(string devicePath)
        {
            var extension = Path.GetExtension(devicePath);

            if (extension.Equals(".trh", StringComparison.OrdinalIgnoreCase))
            {
                return null;
            }

            return extension.GetFileType() switch
            {
                TeensyFileType.Prg or TeensyFileType.Crt or TeensyFileType.P00 => 0,
                TeensyFileType.Sid => 1,
                TeensyFileType.Kla or TeensyFileType.Koa or TeensyFileType.Art or TeensyFileType.Aas
                    or TeensyFileType.Hpi or TeensyFileType.Seq or TeensyFileType.Txt => 2,
                TeensyFileType.Hex => 3,
                _ => null
            };
        }

        /// <summary>
        /// True when candidate should replace current: lower rank; or equal rank and an OrdinalIgnoreCase-earlier
        /// file name; or equal rank and name and an OrdinalIgnoreCase-earlier full device path (the last tie-break only).
        /// An unranked candidate never wins; a ranked one always beats a null or unranked current.
        /// </summary>
        public static bool IsBetter(string candidatePath, string? currentPath)
        {
            var candidateRank = RankOf(candidatePath);

            if (candidateRank is null)
            {
                return false;
            }

            var currentRank = currentPath is null ? null : RankOf(currentPath);

            if (currentRank is null)
            {
                return true;
            }

            if (candidateRank != currentRank)
            {
                return candidateRank < currentRank;
            }

            var nameOrder = StringComparer.OrdinalIgnoreCase.Compare(Path.GetFileName(candidatePath), Path.GetFileName(currentPath));

            return nameOrder != 0
                ? nameOrder < 0
                : StringComparer.OrdinalIgnoreCase.Compare(candidatePath, currentPath) < 0;
        }
    }
}
