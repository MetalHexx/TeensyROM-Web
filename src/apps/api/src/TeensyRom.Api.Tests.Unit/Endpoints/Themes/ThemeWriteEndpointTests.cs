using System.Net;
using RadEndpoints.Testing;
using TeensyRom.Api.Endpoints.Themes.CreateTheme;
using TeensyRom.Api.Endpoints.Themes.DeleteTheme;
using TeensyRom.Api.Endpoints.Themes.UpdateTheme;
using TeensyRom.Core.Themes;

namespace TeensyRom.Api.Tests.Unit.Endpoints.Themes;

public class ThemeWriteEndpointTests
{
    private readonly IThemeStore _store = Substitute.For<IThemeStore>();

    [Fact]
    public async Task CreateTheme_Saved_ReturnsTheStoredTheme()
    {
        _store.CreateCustom("Mine", Arg.Any<DeviceThemePart>()).Returns(new ThemeSaveResult(ThemeSaveStatus.Saved, ThemeTestData.Custom()));
        var endpoint = EndpointFactory.CreateEndpoint<CreateThemeEndpoint>(_store);

        await endpoint.Handle(new CreateThemeRequest { Body = ThemeTestData.Body() }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response.Theme.Id.Should().Be("mine");
        _store.Received().CreateCustom("Mine", ThemeTestData.Colors());
    }

    [Theory]
    [InlineData(ThemeSaveStatus.NameTaken, HttpStatusCode.BadRequest)]
    [InlineData(ThemeSaveStatus.Failed, HttpStatusCode.InternalServerError)]
    public async Task CreateTheme_StoreStatus_MapsToItsCode(ThemeSaveStatus status, HttpStatusCode expected)
    {
        _store.CreateCustom(Arg.Any<string>(), Arg.Any<DeviceThemePart>()).Returns(new ThemeSaveResult(status));
        var endpoint = EndpointFactory.CreateEndpoint<CreateThemeEndpoint>(_store);

        await endpoint.Handle(new CreateThemeRequest { Body = ThemeTestData.Body() }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(expected);
    }

    [Fact]
    public async Task UpdateTheme_Saved_ReturnsTheStoredTheme()
    {
        _store.UpdateCustom("mine", "Mine", Arg.Any<DeviceThemePart>()).Returns(new ThemeSaveResult(ThemeSaveStatus.Saved, ThemeTestData.Custom()));
        var endpoint = EndpointFactory.CreateEndpoint<UpdateThemeEndpoint>(_store);

        await endpoint.Handle(new UpdateThemeRequest { ThemeId = "mine", Body = ThemeTestData.Body() }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
        endpoint.Response.Theme.Name.Should().Be("Mine");
    }

    [Theory]
    [InlineData(ThemeSaveStatus.NotFound, HttpStatusCode.NotFound)]
    [InlineData(ThemeSaveStatus.ShippedReadOnly, HttpStatusCode.BadRequest)]
    [InlineData(ThemeSaveStatus.NameTaken, HttpStatusCode.BadRequest)]
    [InlineData(ThemeSaveStatus.Failed, HttpStatusCode.InternalServerError)]
    public async Task UpdateTheme_StoreStatus_MapsToItsCode(ThemeSaveStatus status, HttpStatusCode expected)
    {
        _store.UpdateCustom(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<DeviceThemePart>()).Returns(new ThemeSaveResult(status));
        var endpoint = EndpointFactory.CreateEndpoint<UpdateThemeEndpoint>(_store);

        await endpoint.Handle(new UpdateThemeRequest { ThemeId = "mine", Body = ThemeTestData.Body() }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(expected);
    }

    [Fact]
    public async Task DeleteTheme_Deleted_SendsOk()
    {
        _store.DeleteCustom("mine").Returns(ThemeDeleteStatus.Deleted);
        var endpoint = EndpointFactory.CreateEndpoint<DeleteThemeEndpoint>(_store);

        await endpoint.Handle(new DeleteThemeRequest { ThemeId = "mine" }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(HttpStatusCode.OK);
    }

    [Theory]
    [InlineData(ThemeDeleteStatus.NotFound, HttpStatusCode.NotFound)]
    [InlineData(ThemeDeleteStatus.ShippedReadOnly, HttpStatusCode.BadRequest)]
    [InlineData(ThemeDeleteStatus.Failed, HttpStatusCode.InternalServerError)]
    public async Task DeleteTheme_StoreStatus_MapsToItsCode(ThemeDeleteStatus status, HttpStatusCode expected)
    {
        _store.DeleteCustom(Arg.Any<string>()).Returns(status);
        var endpoint = EndpointFactory.CreateEndpoint<DeleteThemeEndpoint>(_store);

        await endpoint.Handle(new DeleteThemeRequest { ThemeId = "mine" }, CancellationToken.None);

        endpoint.GetStatusCode().Should().Be(expected);
    }
}
