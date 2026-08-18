using TeensyRom.Core.Storage.Index.Search;

namespace TeensyRom.Core.Storage.Tests.Index
{
    /// <summary>
    /// Covers the loader against inline oracle text — no fixture on disk, so a malformed-oracle bug is caught
    /// on every machine rather than only the ones with a local fixture.
    /// </summary>
    public class SearchOracleLoaderTests
    {
        [Fact]
        public void Load_AValidInlineOracle_RoundTripsEveryField()
        {
            var path = WriteOracle("""
                {
                  "version": 1,
                  "notes": "inline test oracle",
                  "cases": [
                    {
                      "term": "Hubbard",
                      "intent": "creator name from projected metadata",
                      "expectedPaths": ["/music/MUSICIANS/H/Hubbard_Rob/Commando.sid"],
                      "mustNotMatch": ["/music/mob/other.sid"],
                      "minResults": 1,
                      "maxResults": 500
                    }
                  ]
                }
                """);

            try
            {
                var cases = SearchOracle.Load(path);

                cases.Should().HaveCount(1);

                var loaded = cases[0];
                loaded.Term.Should().Be("Hubbard");
                loaded.Intent.Should().Be("creator name from projected metadata");
                loaded.ExpectedPaths.Should().ContainSingle().Which.Should().Be("/music/MUSICIANS/H/Hubbard_Rob/Commando.sid");
                loaded.MustNotMatch.Should().ContainSingle().Which.Should().Be("/music/mob/other.sid");
                loaded.MinResults.Should().Be(1);
                loaded.MaxResults.Should().Be(500);
            }
            finally
            {
                File.Delete(path);
            }
        }

        [Fact]
        public void Load_ACaseWithAnEmptyTerm_ThrowsNamingTheCase()
        {
            var path = WriteOracle("""
                {
                  "version": 1,
                  "cases": [
                    { "term": "", "intent": "empty term case", "minResults": 0, "maxResults": 1 }
                  ]
                }
                """);

            try
            {
                var act = () => SearchOracle.Load(path);

                act.Should().Throw<InvalidDataException>().WithMessage("*empty term case*");
            }
            finally
            {
                File.Delete(path);
            }
        }

        [Fact]
        public void Load_ACaseWithAnInvertedBound_ThrowsNamingTheCase()
        {
            var path = WriteOracle("""
                {
                  "version": 1,
                  "cases": [
                    { "term": "inverted", "intent": "bounds reversed", "minResults": 10, "maxResults": 1 }
                  ]
                }
                """);

            try
            {
                var act = () => SearchOracle.Load(path);

                act.Should().Throw<InvalidDataException>().WithMessage("*inverted*");
            }
            finally
            {
                File.Delete(path);
            }
        }

        [Fact]
        public void Load_ACaseMissingItsTermField_ThrowsNamingTheCaseByIntent()
        {
            var path = WriteOracle("""
                {
                  "version": 1,
                  "cases": [
                    { "intent": "term field omitted entirely", "minResults": 0, "maxResults": 1 }
                  ]
                }
                """);

            try
            {
                var act = () => SearchOracle.Load(path);

                act.Should().Throw<InvalidDataException>().WithMessage("*term field omitted entirely*");
            }
            finally
            {
                File.Delete(path);
            }
        }

        [Fact]
        public void Load_ACaseWithANegativeBound_Throws()
        {
            var path = WriteOracle("""
                {
                  "version": 1,
                  "cases": [
                    { "term": "negative", "minResults": -1, "maxResults": 1 }
                  ]
                }
                """);

            try
            {
                var act = () => SearchOracle.Load(path);

                act.Should().Throw<InvalidDataException>().WithMessage("*negative*");
            }
            finally
            {
                File.Delete(path);
            }
        }

        private static string WriteOracle(string json)
        {
            var path = Path.Combine(Path.GetTempPath(), $"search-oracle-{Guid.NewGuid():N}.json");
            File.WriteAllText(path, json);

            return path;
        }
    }
}
