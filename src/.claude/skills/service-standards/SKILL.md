---
name: service-standards
description: 'Domain service exposure pattern for TeensyROM: interface + InjectionToken + useExisting provider for testable, swappable DI. Use when creating a new domain service, wiring a service provider into the app shell, injecting a service into a signal store, or mocking a service token in unit tests.'
---

# Service Standards Skill

Pattern for exposing domain services via an interface + `InjectionToken`, keeping consumers decoupled from the concrete class for testability and swappability.

## When to Use This Skill

- Creating a new domain service that other layers (stores, other services) will consume
- Wiring a service's provider into the application shell (`app.config.ts`)
- Injecting a service into a `signalStore` or component via its token instead of its class
- Mocking a service token in a unit test

## Pattern

1. **Define an interface and token** alongside the concrete class:

```ts
export interface IExampleService {
  getData(id: string): Observable<ExampleModel>;
}

export const EXAMPLE_SERVICE = new InjectionToken<IExampleService>('EXAMPLE_SERVICE');

@Injectable({ providedIn: 'root' })
export class ExampleService implements IExampleService {
  constructor(private readonly api: ApiClient) {}
  getData(id: string) { /* ... */ }
}

export const EXAMPLE_SERVICE_PROVIDER = {
  provide: EXAMPLE_SERVICE,
  useExisting: ExampleService,
};
```

2. **Barrel-export** the interface, token, and provider.
3. **Wire the provider** in the app shell's `providers: [...]` (e.g., `apps/app/src/app/app.config.ts`).
4. **Inject the token** at usage sites (e.g., stores) to depend on the interface, not the concrete class:

```ts
export const ExampleStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, service: IExampleService = inject(EXAMPLE_SERVICE)) => ({
    // ... methods using service
  }))
);
```

## Testing

Provide the token with a small, strongly typed mock instead of the concrete class:

```ts
type GetDataFn = (id: string) => Observable<ExampleModel>;
let getDataMock: MockedFunction<GetDataFn>;

TestBed.configureTestingModule({
  providers: [
    { provide: EXAMPLE_SERVICE, useValue: { getData: (getDataMock = vi.fn<GetDataFn>()) } },
  ],
});
```

Full pattern (identical content, kept for consistency with other skills): [references/SERVICE_STANDARDS.md](references/SERVICE_STANDARDS.md)
