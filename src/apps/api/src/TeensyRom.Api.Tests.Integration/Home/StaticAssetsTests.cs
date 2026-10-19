using TeensyRom.Core.Common;

namespace TeensyRom.Api.Tests.Integration.Home
{
    /// <summary>
    /// Boots the real <c>Program</c> and checks which parts of the home's <c>Assets</c> folder are reachable over
    /// HTTP. Shares the "Transfer" collection for the same reason <see cref="EngineHomeBootTests"/> does.
    /// </summary>
    [Collection("Transfer")]
    public class StaticAssetsTests : IDisposable
    {
        private readonly TransferFixture _fixture = new();
        private readonly List<string> _probes = [];

        private static string AssetsPath => Path.Combine(TeensyRomHome.ApiPath, "Assets");

        public void Dispose()
        {
            _fixture.Dispose();

            foreach (var probe in _probes) File.Delete(probe);
        }

        [Fact]
        public async Task Get_AFileUnderTheSystemFolder_IsNotServed()
        {
            using var client = _fixture.RawClient;

            foreach (var folder in new[] { "Config", "Logs" })
            {
                var secret = $"secret-{Guid.NewGuid():N}";
                var file = $"probe-{Guid.NewGuid():N}.json";
                WriteProbe(Path.Combine("System", folder, file), secret);

                var response = await client.GetAsync($"/Assets/System/{folder}/{file}");

                (await response.Content.ReadAsStringAsync()).Should().NotContain(secret, $"System/{folder} holds settings, records or logs");
            }
        }

        [Fact]
        public async Task Get_AFileUnderTheOtherFolder_IsServed()
        {
            using var client = _fixture.RawClient;
            var bytes = Guid.NewGuid().ToByteArray();
            var file = $"probe-{Guid.NewGuid():N}.png";
            WriteProbe(Path.Combine("Other", file), bytes);

            var response = await client.GetAsync($"/Assets/Other/{file}");

            response.StatusCode.Should().Be(HttpStatusCode.OK);
            response.Content.Headers.ContentType?.MediaType.Should().Be("image/png");
            (await response.Content.ReadAsByteArrayAsync()).Should().Equal(bytes);
        }

        private void WriteProbe(string relativePath, string content) => WriteProbe(relativePath, System.Text.Encoding.UTF8.GetBytes(content));

        private void WriteProbe(string relativePath, byte[] content)
        {
            var path = Path.Combine(AssetsPath, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.WriteAllBytes(path, content);
            _probes.Add(path);
        }
    }
}
