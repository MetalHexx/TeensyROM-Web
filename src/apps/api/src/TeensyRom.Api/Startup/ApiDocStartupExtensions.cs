using Scalar.AspNetCore;
using System.Reflection;
using System.Text.Json.Serialization;

namespace TeensyRom.Api.Startup
{
    public static class ApiDocStartupExtensions
    {
        /// <summary>
        /// Adds and configures OpenAPI/Scalar with XML comments and custom UI options.
        /// </summary>
        public static IServiceCollection AddApiDocs(this IServiceCollection services)
        {
            var version = Assembly.GetExecutingAssembly()
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
                .InformationalVersion ?? "0.0.0";

            //Needed to avoid adding patterns to nullable ints.
            services.ConfigureHttpJsonOptions(options =>
            {
                options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
                options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });
            
            services.AddOpenApi(options =>
            {
                options.AddDocumentTransformer((document, context, cancellationToken) =>
                {
                    document.Info.Title = $"TeensyRom.Api | v{version}";
                    document.Info.Version = version;
                    return Task.CompletedTask;
                });
            });
            
            return services;
        }

        /// <summary>
        /// Maps OpenAPI and Scalar endpoints with custom UI options.
        /// </summary>
        public static WebApplication MapApiDocs(this WebApplication app)
        {
            var version = Assembly.GetExecutingAssembly()
                .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
                .InformationalVersion ?? "0.0.0";

            app.MapOpenApi();
            app.MapScalarApiReference(options =>
            {
                options
                    .WithTitle($"TeensyROM API v{version}")
                    .WithTheme(ScalarTheme.Laserwave);
            });
            return app;
        }
    }
}