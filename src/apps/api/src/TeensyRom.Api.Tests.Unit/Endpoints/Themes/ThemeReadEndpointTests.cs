using System.Net;
using RadEndpoints.Testing;
using TeensyRom.Api.Endpoints.Themes.GetDeviceTheme;
using TeensyRom.Api.Endpoints.Themes.GetTheme;
using TeensyRom.Api.Endpoints.Themes.ListThemes;
using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Themes;

public class ThemeReadEndpointTests
{
    private readonly IThemeStore _store = Substitute.For<IThemeStore>();

    [Fact]
    public async Task ListThemes_ReturnsTheStoreThemesInOrder()
    {
        _store.ListThemes().Returns([ThemeTestData.Custom("a", "A"), ThemeTestData.Custom("b", "B")]);
        var endpoint = EndpointFactory.CreateEndpoint<ListThemesEndpoint>(_store);

        await endpoint.Handle(CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response.Themes.Select(t => t.Id).Should().Equal("a", "b");
        endpoint.Response.Themes[0].Kind.Should().Be(ThemeKind.Custom);
        endpoint.Response.Themes[0].Parts.Device.Border.Should().Be(3);
    }

    [Fact]
    public async Task GetTheme_Known_ReturnsIt()
    {
        _store.GetTheme("mine").Returns(ThemeTestData.Custom());
        var endpoint = EndpointFactory.CreateEndpoint<GetThemeEndpoint>(_store);

        await endpoint.Handle(new GetThemeRequest { ThemeId = "mine" }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response.Theme.Name.Should().Be("Mine");
    }

    [Fact]
    public async Task GetTheme_Unknown_SendsNotFound()
    {
        var endpoint = EndpointFactory.CreateEndpoint<GetThemeEndpoint>(_store);

        await endpoint.Handle(new GetThemeRequest { ThemeId = "nope" }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task GetDeviceTheme_WithRecord_ReturnsItAsRecorded()
    {
        var appliedAt = DateTimeOffset.UtcNow;
        _store.GetDeviceRecord("ABCD2345").Returns(new DeviceThemeRecord("ABCD2345", ThemeTestData.Colors(5), "mine", appliedAt));
        var endpoint = EndpointFactory.CreateEndpoint<GetDeviceThemeEndpoint>(_store);

        await endpoint.Handle(new GetDeviceThemeRequest { DeviceId = "ABCD2345" }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        var record = endpoint.Response.Record;
        record.IsRecorded.Should().BeTrue();
        record.ThemeId.Should().Be("mine");
        record.AppliedAt.Should().Be(appliedAt);
        record.Colors.Should().Be(ThemeTestData.ColorsDto(5));
    }

    [Fact]
    public async Task GetDeviceTheme_WithoutRecord_FallsBackToFactoryColors()
    {
        var endpoint = EndpointFactory.CreateEndpoint<GetDeviceThemeEndpoint>(_store);

        await endpoint.Handle(new GetDeviceThemeRequest { DeviceId = "ABCD2345" }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        var record = endpoint.Response.Record;
        record.IsRecorded.Should().BeFalse();
        record.AppliedAt.Should().BeNull();
        record.DeviceId.Should().Be("ABCD2345");
        record.ThemeId.Should().Be(ThemeDefaults.FactoryThemeId);
        record.Colors.Border.Should().Be(ThemeDefaults.FactoryColors.Border);
        record.Colors.Name.Should().Be(ThemeDefaults.FactoryColors.Name);
    }
}
