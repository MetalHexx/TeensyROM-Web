using System.Text;
using Microsoft.Data.Sqlite;
using TeensyRom.Core.Entities.Storage;

namespace TeensyRom.Core.Storage.Index
{
    /// <summary>
    /// Builds the LIKE patterns every prefix and subtree query depends on, and the favourite-tree predicate.
    /// <para>
    /// Underscores are everywhere in this collection's paths (<c>Hubbard_Rob</c>) and an unescaped <c>_</c> is
    /// a single-character wildcard that silently widens the match, so patterns are never hand-built at a call
    /// site — they come from here, escaped.
    /// </para>
    /// </summary>
    public static class IndexPathPatterns
    {
        /// <summary>The escape character every generated pattern is bound with: <c>LIKE :p ESCAPE '\'</c>.</summary>
        public const char Like_Escape_Character = '\\';

        private const string FavoriteParameterPrefix = "$favoritePrefix";
        private const string PlaylistParameterName = "$playlistPrefix";

        private static readonly string[] FavoriteRoots = StorageHelper.FavoritePaths
            .Select(path => path.Value)
            .ToArray();

        /// <summary>
        /// Escapes the LIKE metacharacters (<c>\</c>, <c>%</c>, <c>_</c>) so the value matches literally.
        /// </summary>
        public static string EscapeLike(string value)
        {
            ArgumentNullException.ThrowIfNull(value);

            var escaped = new StringBuilder(value.Length);

            foreach (var character in value)
            {
                if (character is Like_Escape_Character or '%' or '_')
                {
                    escaped.Append(Like_Escape_Character);
                }

                escaped.Append(character);
            }

            return escaped.ToString();
        }

        /// <summary>
        /// Builds the pattern matching <paramref name="prefix"/> and everything beneath it.
        /// </summary>
        public static string PrefixPattern(string prefix) => EscapeLike(prefix) + "%";

        /// <summary>
        /// Builds the pattern matching a path containing <paramref name="value"/> anywhere, mirroring the
        /// application's substring-based exclude-path semantics.
        /// </summary>
        public static string ContainsPattern(string value) => "%" + EscapeLike(value) + "%";

        /// <summary>
        /// True when <paramref name="path"/> sits under one of the favourite trees.
        /// </summary>
        public static bool IsFavoritePath(string path)
        {
            ArgumentNullException.ThrowIfNull(path);

            return FavoriteRoots.Any(root => path.StartsWith(root, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Builds the "is under a favourite tree" predicate over <paramref name="pathColumn"/>. The values are
        /// bound by <see cref="BindFavoriteParameters"/>; only the caller-supplied column name is inlined.
        /// </summary>
        public static string FavoritePredicate(string pathColumn)
        {
            var terms = FavoriteRoots.Select((_, index) =>
                $"{pathColumn} LIKE {FavoriteParameterPrefix}{index} ESCAPE '{Like_Escape_Character}'");

            return $"({string.Join(" OR ", terms)})";
        }

        /// <summary>
        /// Binds the patterns the predicate returned by <see cref="FavoritePredicate"/> refers to.
        /// </summary>
        public static void BindFavoriteParameters(SqliteCommand command)
        {
            ArgumentNullException.ThrowIfNull(command);

            for (var index = 0; index < FavoriteRoots.Length; index++)
            {
                command.Parameters.AddWithValue($"{FavoriteParameterPrefix}{index}", PrefixPattern(FavoriteRoots[index]));
            }
        }

        /// <summary>
        /// Builds the "is under a favourite or playlist tree" predicate over <paramref name="pathColumn"/> —
        /// the set of locations that hold a linked copy of a file rather than its original. The values are
        /// bound by <see cref="BindLinkedCopyParameters"/>.
        /// </summary>
        public static string LinkedCopyPredicate(string pathColumn) =>
            $"({FavoritePredicate(pathColumn)} OR {pathColumn} LIKE {PlaylistParameterName} ESCAPE '{Like_Escape_Character}')";

        /// <summary>
        /// Binds the patterns the predicate returned by <see cref="LinkedCopyPredicate"/> refers to.
        /// </summary>
        public static void BindLinkedCopyParameters(SqliteCommand command)
        {
            ArgumentNullException.ThrowIfNull(command);

            BindFavoriteParameters(command);
            command.Parameters.AddWithValue(PlaylistParameterName, PrefixPattern(StorageHelper.Playlist_Path));
        }
    }
}
