using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Spectre.Console;
using Spectre.Console.Cli;
using System;
using TeensyRom.Cli.Services;

public sealed class TypeResolver : ITypeResolver
{
    private readonly IServiceProvider _provider;

    public TypeResolver(IServiceProvider provider)
    {
        _provider = provider ?? throw new ArgumentNullException(nameof(provider));
    }

    public object? Resolve(Type? type)
    {
        if (type == null)
        {
            return null;
        }
        var service = _provider.GetService(type);

        if (service is null)
        {
            throw new InvalidOperationException($"TypeResolver.cs: Could not resolve type '{type.FullName}'.");
        }

        return service;
    }
}

/// <summary>
/// Spectre's registrar over a service collection, shared by every app of the process so they share one provider.
/// </summary>
/// <remarks>
/// Registrations are ignored once the provider is built, and a service type already registered keeps its first
/// registration: Spectre registers settings types as singletons, which would carry option values from one run into the
/// next, so the CLI registers its own (transient) instances first and Spectre's later ones change nothing.
/// </remarks>
public sealed class TypeRegistrar : ITypeRegistrar
{
    private readonly IServiceCollection _builder;
    private ServiceProvider? _provider;

    public TypeRegistrar(IServiceCollection builder)
    {
        _builder = builder;
    }

    public ITypeResolver Build()
    {
        if (_provider is not null) 
        {
            return new TypeResolver(_provider);
        }
        _provider = _builder.BuildServiceProvider();

        return new TypeResolver(_provider);
    }

    public void Register(Type service, Type implementation)
    {
        if (_provider is not null) return;

        _builder.TryAddSingleton(service, implementation);
    }

    public void RegisterInstance(Type service, object implementation)
    {
        if (_provider is not null) return;

        _builder.TryAdd(ServiceDescriptor.Singleton(service, implementation));
    }

    public void RegisterLazy(Type service, Func<object> func)
    {
        if (_provider is not null) return;

        if (func is null)
        {
            throw new ArgumentNullException(nameof(func));
        }
        _builder.TryAddSingleton(service, (provider) => func());
    }
}