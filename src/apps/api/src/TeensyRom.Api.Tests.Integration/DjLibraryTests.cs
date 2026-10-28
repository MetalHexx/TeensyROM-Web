using System.Text.Json;
using System.Text.Json.Nodes;
using TeensyRom.Api.Endpoints.DjLibrary;
using TeensyRom.Api.Endpoints.DjLibrary.DeleteDjSet;
using TeensyRom.Api.Endpoints.DjLibrary.GetDjLibraryState;
using TeensyRom.Api.Endpoints.DjLibrary.GetDjSet;
using TeensyRom.Api.Endpoints.DjLibrary.GetTuneMemory;
using TeensyRom.Api.Endpoints.DjLibrary.ListDjSets;
using TeensyRom.Api.Endpoints.DjLibrary.SaveDjLibraryState;
using TeensyRom.Api.Endpoints.DjLibrary.SaveDjSet;
using TeensyRom.Api.Endpoints.DjLibrary.SaveTuneMemory;
using TeensyRom.Core.Common;
using TeensyRom.Core.Dj;

namespace TeensyRom.Api.Tests.Integration
{
    /// <summary>
    /// The DJ library endpoints over HTTP against a throwaway home. Sets and tune files a test leaves behind are removed afterwards.
    /// </summary>
    [Collection("Endpoint")]
    public class DjLibraryTests(EndpointFixture f) : IAsyncLifetime
    {
        private const string SetId = "6f1c2b0e-8d1a-4c7e-9a43-2a1b7c9d0e11";
        private const string SidHash = "0123456789abcdef0123456789abcdef";

        /// <summary>
        /// The set document the library side pins, verbatim.
        /// </summary>
        private const string SetJson = """
            { "id": "6f1c2b0e-8d1a-4c7e-9a43-2a1b7c9d0e11", "name": "Friday warm-up", "placeholder": "Set 3",
              "created": "2026-10-26T20:15:03.120Z", "updated": "2026-10-26T21:02:44.871Z",
              "rows": [{ "id": "0b6e3c1a-5f2d-4e8b-b7a9-1c2d3e4f5a6b",
                "tune": { "sidHash": "0123456789abcdef0123456789abcdef", "title": "Commando", "author": "Rob Hubbard",
                          "released": "1985 Elite", "subtuneCount": 3, "byteLength": 6234 },
                "copiedFrom": { "sidHash": "0123456789abcdef0123456789abcdef", "updated": "2026-10-25T18:00:00.000Z" },
                "lastSubtune": 1,
                "subtunes": [{ "subtune": 1, "settings": { "v": 1 },
                  "markers": [{ "id": "c1", "name": "Drum break", "start": { "frame": 7950, "offsetFrames": 0 },
                                "end": { "frame": 8360, "offsetFrames": 6 }, "voices": [0, 1, 2],
                                "settings": { "v": 1 }, "usesOwnSettings": true }] }],
                "host": { "v": 1 } }] }
            """;

        private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

        private static string DjRoot => Path.Combine(TeensyRomHome.ApiPath, DjLibraryPaths.RootFolder);
        private static string SetFile(string id) => Path.Combine(DjRoot, DjLibraryPaths.SetsFolder, id + ".json");
        private static string TuneFile(string hash) => Path.Combine(DjRoot, DjLibraryPaths.TunesFolder, hash + ".json");

        public Task InitializeAsync() => Task.CompletedTask;

        public async Task DisposeAsync()
        {
            var listed = await f.Client.GetAsync<ListDjSetsEndpoint, ListDjSetsResponse>();
            foreach (var set in listed.Content.Sets)
            {
                await f.Client.DeleteAsync<DeleteDjSetEndpoint, DeleteDjSetRequest, DeleteDjSetResponse>(new() { SetId = set.Id });
            }

            if (Directory.Exists(SetFile(SetId))) Directory.Delete(SetFile(SetId), recursive: true);
            if (File.Exists(SetFile(SetId))) File.Delete(SetFile(SetId));
            if (File.Exists(TuneFile(SidHash))) File.Delete(TuneFile(SidHash));
            var library = Path.Combine(DjRoot, DjLibraryPaths.LibraryFile);
            if (File.Exists(library)) File.Delete(library);
        }

        private static DjSetDto FixtureSet() => JsonSerializer.Deserialize<DjSetDto>(SetJson, Web)!;

        private Task<RadTestResult<TResponse>> SaveSetAsync<TResponse>(string setId, DjSetDto body) =>
            f.Client.PutAsync<SaveDjSetEndpoint, SaveDjSetRequest, TResponse>(new() { SetId = setId, Body = body });

        private Task<RadTestResult<GetDjSetResponse>> GetSetAsync(string setId) =>
            f.Client.GetAsync<GetDjSetEndpoint, GetDjSetRequest, GetDjSetResponse>(new() { SetId = setId });

        private static void AssertSameJson(object actual, string expectedJson)
        {
            var actualNode = JsonSerializer.SerializeToNode(actual, Web);
            var expectedNode = JsonNode.Parse(expectedJson);

            JsonNode.DeepEquals(actualNode, expectedNode).Should().BeTrue($"expected {expectedNode}\nbut found {actualNode}");
        }

        [Fact]
        public async Task SetEndpoints_RoundTrip_FieldForField_ListAndDelete()
        {
            var saved = await SaveSetAsync<SaveDjSetResponse>(SetId, FixtureSet());
            saved.Should().BeSuccessful<SaveDjSetResponse>().WithStatusCode(HttpStatusCode.OK);

            var got = await GetSetAsync(SetId);
            got.Should().BeSuccessful<GetDjSetResponse>().WithStatusCode(HttpStatusCode.OK);
            AssertSameJson(got.Content.Set!, SetJson);

            var listed = await f.Client.GetAsync<ListDjSetsEndpoint, ListDjSetsResponse>();
            listed.Should().BeSuccessful<ListDjSetsResponse>();
            var summary = listed.Content.Sets.Should().ContainSingle(s => s.Id == SetId).Subject;
            summary.Name.Should().Be("Friday warm-up");
            summary.RowCount.Should().Be(1);
            summary.Updated.Should().Be("2026-10-26T21:02:44.871Z");
            File.Exists(SetFile(SetId)).Should().BeTrue();

            var deleted = await f.Client.DeleteAsync<DeleteDjSetEndpoint, DeleteDjSetRequest, DeleteDjSetResponse>(new() { SetId = SetId });
            deleted.Should().BeSuccessful<DeleteDjSetResponse>().WithStatusCode(HttpStatusCode.OK);

            File.Exists(SetFile(SetId)).Should().BeFalse();
            (await GetSetAsync(SetId)).Content.Set.Should().BeNull();
            (await f.Client.GetAsync<ListDjSetsEndpoint, ListDjSetsResponse>()).Content.Sets.Should().NotContain(s => s.Id == SetId);
        }

        [Fact]
        public async Task GetUnknownSet_ReturnsNullSet()
        {
            var got = await GetSetAsync(Guid.NewGuid().ToString("D"));

            got.Should().BeSuccessful<GetDjSetResponse>().WithStatusCode(HttpStatusCode.OK);
            got.Content.Set.Should().BeNull();
        }

        [Fact]
        public async Task DeleteUnknownSet_Succeeds()
        {
            var deleted = await f.Client.DeleteAsync<DeleteDjSetEndpoint, DeleteDjSetRequest, DeleteDjSetResponse>(new() { SetId = Guid.NewGuid().ToString("D") });

            deleted.Should().BeSuccessful<DeleteDjSetResponse>().WithStatusCode(HttpStatusCode.OK);
        }

        [Fact]
        public async Task CorruptSet_ReadsAsNull_StaysOnDisk_AndOthersStillList()
        {
            (await SaveSetAsync<SaveDjSetResponse>(SetId, FixtureSet())).Should().BeSuccessful<SaveDjSetResponse>();
            var corruptId = Guid.NewGuid().ToString("D");
            File.WriteAllText(SetFile(corruptId), "{ not json");

            try
            {
                (await GetSetAsync(corruptId)).Content.Set.Should().BeNull();
                (await f.Client.GetAsync<ListDjSetsEndpoint, ListDjSetsResponse>()).Content.Sets
                    .Should().Contain(s => s.Id == SetId).And.NotContain(s => s.Id == corruptId);
                File.ReadAllText(SetFile(corruptId)).Should().Be("{ not json");
            }
            finally
            {
                File.Delete(SetFile(corruptId));
            }
        }

        [Fact]
        public async Task SaveSet_WithRouteIdThatDiffersFromBody_IsRejectedAndWritesNothing()
        {
            var otherId = Guid.NewGuid().ToString("D");

            var r = await SaveSetAsync<ValidationProblemDetails>(otherId, FixtureSet());

            r.Should().BeValidationProblem().WithKey("Body.Id");
            File.Exists(SetFile(otherId)).Should().BeFalse();
            File.Exists(SetFile(SetId)).Should().BeFalse();
            (await GetSetAsync(otherId)).Content.Set.Should().BeNull();
            (await GetSetAsync(SetId)).Content.Set.Should().BeNull();
        }

        [Fact]
        public async Task SaveSet_WithTheSameSidTwice_IsRejectedAndWritesNothing()
        {
            var set = FixtureSet();
            var second = set.Rows[0] with { Id = Guid.NewGuid().ToString("D") };
            set.Rows = [set.Rows[0], second];

            var r = await SaveSetAsync<ValidationProblemDetails>(SetId, set);

            r.Should().BeValidationProblem().WithKey("Body.Rows[1].Tune.SidHash");
            File.Exists(SetFile(SetId)).Should().BeFalse();
            (await GetSetAsync(SetId)).Content.Set.Should().BeNull();
        }

        [Fact]
        public async Task GetSet_WithABadId_IsRejected()
        {
            var r = await f.Client.GetAsync<GetDjSetEndpoint, GetDjSetRequest, ValidationProblemDetails>(new() { SetId = "NOT-A-SET" });

            r.Should().BeValidationProblem().WithKey("SetId");
        }

        [Fact]
        public async Task SaveSet_WhenTheFileCannotBeReplaced_Returns500()
        {
            Directory.CreateDirectory(SetFile(SetId));

            var r = await SaveSetAsync<ProblemDetails>(SetId, FixtureSet());

            r.Should().BeProblem().WithStatusCode(HttpStatusCode.InternalServerError);
            Directory.Exists(SetFile(SetId)).Should().BeTrue();
        }

        [Fact]
        public async Task TuneMemory_RoundTrips_AndUnknownTuneIsNull()
        {
            (await f.Client.GetAsync<GetTuneMemoryEndpoint, GetTuneMemoryRequest, GetTuneMemoryResponse>(new() { SidHash = SidHash }))
                .Content.Memory.Should().BeNull();

            var memoryJson = $$"""
                { "sidHash": "{{SidHash}}", "lastSubtune": 2,
                  "subtunes": {{JsonSerializer.Serialize(FixtureSet().Rows[0].Subtunes, Web)}},
                  "updated": "2026-10-26T21:02:44.871Z" }
                """;
            var body = JsonSerializer.Deserialize<DjTuneMemoryDto>(memoryJson, Web)!;

            var saved = await f.Client.PutAsync<SaveTuneMemoryEndpoint, SaveTuneMemoryRequest, SaveTuneMemoryResponse>(new() { SidHash = SidHash, Body = body });
            saved.Should().BeSuccessful<SaveTuneMemoryResponse>().WithStatusCode(HttpStatusCode.OK);

            var got = await f.Client.GetAsync<GetTuneMemoryEndpoint, GetTuneMemoryRequest, GetTuneMemoryResponse>(new() { SidHash = SidHash });
            got.Should().BeSuccessful<GetTuneMemoryResponse>();
            AssertSameJson(got.Content.Memory!, memoryJson);
        }

        [Fact]
        public async Task SaveTuneMemory_WithRouteHashThatDiffersFromBody_IsRejectedAndWritesNothing()
        {
            var body = new DjTuneMemoryDto { SidHash = new string('b', 32), LastSubtune = 1, Subtunes = [], Updated = "2026-10-26T21:02:44.871Z" };

            var r = await f.Client.PutAsync<SaveTuneMemoryEndpoint, SaveTuneMemoryRequest, ValidationProblemDetails>(new() { SidHash = SidHash, Body = body });

            r.Should().BeValidationProblem().WithKey("Body.SidHash");
            File.Exists(TuneFile(SidHash)).Should().BeFalse();
            File.Exists(TuneFile(body.SidHash)).Should().BeFalse();
        }

        [Fact]
        public async Task LibraryState_RoundTrips()
        {
            var saved = await f.Client.PutAsync<SaveDjLibraryStateEndpoint, SaveDjLibraryStateRequest, SaveDjLibraryStateResponse>(
                new() { Body = new DjLibraryStateDto { CurrentSetId = SetId } });
            saved.Should().BeSuccessful<SaveDjLibraryStateResponse>().WithStatusCode(HttpStatusCode.OK);

            (await f.Client.GetAsync<GetDjLibraryStateEndpoint, GetDjLibraryStateResponse>()).Content.CurrentSetId.Should().Be(SetId);

            await f.Client.PutAsync<SaveDjLibraryStateEndpoint, SaveDjLibraryStateRequest, SaveDjLibraryStateResponse>(
                new() { Body = new DjLibraryStateDto { CurrentSetId = null } });

            (await f.Client.GetAsync<GetDjLibraryStateEndpoint, GetDjLibraryStateResponse>()).Content.CurrentSetId.Should().BeNull();
        }

        [Fact]
        public async Task SaveLibraryState_WithABadSetId_IsRejected()
        {
            var r = await f.Client.PutAsync<SaveDjLibraryStateEndpoint, SaveDjLibraryStateRequest, ValidationProblemDetails>(
                new() { Body = new DjLibraryStateDto { CurrentSetId = "../x" } });

            r.Should().BeValidationProblem().WithKey("Body.CurrentSetId");
        }
    }
}
