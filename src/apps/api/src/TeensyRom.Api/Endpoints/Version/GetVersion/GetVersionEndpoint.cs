using System.Reflection;

namespace TeensyRom.Api.Endpoints.Version.GetVersion
{
    public class GetVersionEndpoint : RadEndpointWithoutRequest<GetVersionResponse>
    {
        public override void Configure()
        {
            Get("/api/version")
                .Produces<GetVersionResponse>(StatusCodes.Status200OK)
                .ProducesProblem(StatusCodes.Status500InternalServerError)
                .WithName("GetVersion")
                .WithSummary("Get Application Version")
                .WithTags("Version")
                .WithDescription(
                    "Retrieves the current semantic version of the TeensyROM application.\n\n" +
                    "The version follows semantic versioning format: **Major.Minor.Patch[-prerelease]**\n\n" +
                    "**Version Information:**\n" +
                    "- **Major**: Breaking changes or significant new features\n" +
                    "- **Minor**: Backward-compatible new features\n" +
                    "- **Patch**: Backward-compatible bug fixes\n" +
                    "- **Prerelease**: Optional prerelease identifier (e.g., alpha.1, beta.2)\n\n" +
                    "This version is read from the assembly metadata and matches the version " +
                    "specified in the TeensyRom.Api.csproj file."
                );
        }

        public override Task Handle(CancellationToken ct)
        {
            var version = Assembly.GetExecutingAssembly()
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
                .InformationalVersion ?? "0.0.0";

            Response = new GetVersionResponse { Version = version };
            Send();
            return Task.CompletedTask;
        }
    }
}
