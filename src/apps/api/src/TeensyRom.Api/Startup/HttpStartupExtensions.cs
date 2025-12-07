namespace TeensyRom.Api.Startup
{
    public static class HttpStartupExtensions
    {
        /// <summary>
        /// Adds permissive CORS policy for local-only app.
        /// Allows any origin to support dev (localhost:4200) and production (any port) scenarios.
        /// </summary>
        public static IServiceCollection AddUiCors(this IServiceCollection services)
        {
            services.AddCors(options =>
            {
                options.AddPolicy("AllowAll",
                    builder =>
                    {
                        builder.SetIsOriginAllowed(_ => true) // Allow any origin
                               .AllowAnyMethod()
                               .AllowAnyHeader()
                               .AllowCredentials(); // Required for SignalR
                    });
            });
            return services;
        }

        /// <summary>
        /// Applies permissive CORS policy.
        /// </summary>
        public static WebApplication UseUiCors(this WebApplication app) 
        {
            app.UseCors("AllowAll");
            return app;
        }
    }
}