using TeensyRom.Core.Storage.Index;

namespace TeensyRom.Core.Storage.Tests.Index
{
    public class IndexPathPatternsTests
    {
        [Theory]
        [InlineData("/music/Hubbard_Rob/", @"/music/Hubbard\_Rob/")]
        [InlineData("/100%/", @"/100\%/")]
        [InlineData(@"/back\slash/", @"/back\\slash/")]
        [InlineData("/music/", "/music/")]
        public void EscapeLike_EscapesEveryWildcardCharacter(string path, string expected) =>
            IndexPathPatterns.EscapeLike(path).Should().Be(expected);

        [Fact]
        public void PrefixPattern_AppendsTheWildcardAfterEscaping() =>
            IndexPathPatterns.PrefixPattern("/music_a/").Should().Be(@"/music\_a/%");

        [Theory]
        [InlineData("/favorites/music/monty.sid", true)]
        [InlineData("/FAVORITES/Music/monty.sid", true)]
        [InlineData("/firmware/teensyrom.hex", true)]
        [InlineData("/music/monty.sid", false)]
        [InlineData("/favorites-not-really/monty.sid", false)]
        public void IsFavoritePath_RecognisesTheFavouriteTrees(string path, bool expected) =>
            IndexPathPatterns.IsFavoritePath(path).Should().Be(expected);
    }
}
