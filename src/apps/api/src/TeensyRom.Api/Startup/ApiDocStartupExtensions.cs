using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi.Models;
using Scalar.AspNetCore;
using System.Reflection;
using System.Text.Json.Serialization;
using TeensyRom.Core.Entities.Transfers;

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

                options.AddSchemaTransformer(FixDanglingTransferFileCompletedRef);
            });

            return services;
        }

        /// <summary>
        /// Microsoft.AspNetCore.OpenApi's schema exporter emits a dangling self-reference — not a
        /// <c>$ref</c> to the shared component schema — for every occurrence of a reference type
        /// after its first appearance within the same class's property graph. <c>TransferJobDto</c>
        /// declares two <c>List&lt;TransferFileCompleted&gt;</c> properties (<c>Failures</c>,
        /// <c>RecentCompletions</c>), so the second one loses its item type. This restores it to the
        /// same <c>$ref</c> the first occurrence already resolves to.
        /// </summary>
        private static Task FixDanglingTransferFileCompletedRef(
            OpenApiSchema schema, OpenApiSchemaTransformerContext context, CancellationToken cancellationToken)
        {
            if (context.JsonTypeInfo.Type == typeof(TransferFileCompleted) &&
                schema.Type is null &&
                (schema.Properties is null || schema.Properties.Count == 0))
            {
                schema.Reference = new OpenApiReference
                {
                    Type = ReferenceType.Schema,
                    Id = nameof(TransferFileCompleted)
                };
            }

            return Task.CompletedTask;
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