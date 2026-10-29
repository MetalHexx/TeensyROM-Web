using TeensyRom.Api.Endpoints.Themes;
using TeensyRom.Api.Endpoints.Themes.ApplyDeviceTheme;
using TeensyRom.Api.Endpoints.Themes.CreateTheme;
using TeensyRom.Api.Endpoints.Themes.DeleteTheme;
using TeensyRom.Api.Endpoints.Themes.GetDeviceTheme;
using TeensyRom.Api.Endpoints.Themes.GetTheme;
using TeensyRom.Api.Endpoints.Themes.ListThemes;
using TeensyRom.Api.Endpoints.Themes.UpdateTheme;
using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Tests.Integration.Themes
{
    /// <summary>
    /// The theme endpoints over HTTP against the fake-port fixture. Custom themes a test leaves behind are deleted afterwards.
    /// </summary>
    [Collection("Transfer")]
    public class ThemeEndpointTests(TransferFixture f) : IAsyncLifetime
    {
        private static DeviceThemePartDto Colors(int color) => new()
        {
            Background = color, Border = color, Banner = color, Time = color, Option = color, Sources = color, Name = color
        };

        public Task InitializeAsync() => Task.CompletedTask;

        public async Task DisposeAsync()
        {
            var listed = await f.Client.GetAsync<ListThemesEndpoint, ListThemesResponse>();
            foreach (var theme in listed.Content.Themes.Where(t => t.Kind == ThemeKind.Custom))
            {
                await f.Client.DeleteAsync<DeleteThemeEndpoint, DeleteThemeRequest, DeleteThemeResponse>(new() { ThemeId = theme.Id });
            }

            await f.WaitForQuiescenceAsync();
        }

        [Fact]
        public async Task List_ReturnsTheSixShippedThemes()
        {
            var listed = await f.Client.GetAsync<ListThemesEndpoint, ListThemesResponse>();

            listed.Should().BeSuccessful<ListThemesResponse>().WithStatusCode(HttpStatusCode.OK);
            listed.Content.Themes.Where(t => t.Kind == ThemeKind.Shipped).Should().HaveCount(6);
        }

        [Fact]
        public async Task CreateUpdateDelete_RoundTrip()
        {
            var created = await f.Client.PostAsync<CreateThemeEndpoint, CreateThemeRequest, SaveThemeResponse>(
                new() { Body = new() { Name = "Integration Blue", Device = Colors(6) } });
            created.Should().BeSuccessful<SaveThemeResponse>().WithStatusCode(HttpStatusCode.OK);
            var id = created.Content.Theme.Id;
            created.Content.Theme.Kind.Should().Be(ThemeKind.Custom);

            var updated = await f.Client.PutAsync<UpdateThemeEndpoint, UpdateThemeRequest, SaveThemeResponse>(
                new() { ThemeId = id, Body = new() { Name = "Integration Blue", Device = Colors(2) } });
            updated.Should().BeSuccessful<SaveThemeResponse>().WithStatusCode(HttpStatusCode.OK);

            var got = await f.Client.GetAsync<GetThemeEndpoint, GetThemeRequest, GetThemeResponse>(new() { ThemeId = id });
            got.Content.Theme.Parts.Device.Should().Be(Colors(2));

            var deleted = await f.Client.DeleteAsync<DeleteThemeEndpoint, DeleteThemeRequest, DeleteThemeResponse>(new() { ThemeId = id });
            deleted.Should().BeSuccessful<DeleteThemeResponse>().WithStatusCode(HttpStatusCode.OK);

            var listed = await f.Client.GetAsync<ListThemesEndpoint, ListThemesResponse>();
            listed.Content.Themes.Should().NotContain(t => t.Id == id);
        }

        [Fact]
        public async Task UpdatingAShippedTheme_AnswersBadRequest()
        {
            var r = await f.Client.PutAsync<UpdateThemeEndpoint, UpdateThemeRequest, ProblemDetails>(
                new() { ThemeId = ThemeDefaults.FactoryThemeId, Body = new() { Name = "Changed", Device = Colors(1) } });

            r.Should().BeProblem().WithStatusCode(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task ApplyToADevice_ResetsItAndRecordsTheColors()
        {
            var id = f.DeviceManager.Devices[0].DeviceId;
            var port = f.DeviceManager.PortFor(id);
            var resetsBefore = port.ResetCount;

            var applied = await f.Client.PutAsync<ApplyDeviceThemeEndpoint, ApplyDeviceThemeRequest, ApplyDeviceThemeResponse>(
                new() { DeviceId = id, Body = new() { Colors = Colors(5) } });

            applied.Should().BeSuccessful<ApplyDeviceThemeResponse>().WithStatusCode(HttpStatusCode.OK);
            port.ResetCount.Should().Be(resetsBefore + 1);

            var read = await f.Client.GetAsync<GetDeviceThemeEndpoint, GetDeviceThemeRequest, GetDeviceThemeResponse>(new() { DeviceId = id });
            read.Content.Record.IsRecorded.Should().BeTrue();
            read.Content.Record.Colors.Should().Be(Colors(5));
        }
    }
}
