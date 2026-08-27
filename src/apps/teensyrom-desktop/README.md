# TeensyROM desktop shell

Electron owns the application window and the lifetime of the bundled .NET API.
At startup it selects an ephemeral loopback port, starts the API on that port,
waits for `/api/version`, and loads the existing Angular app from the API.

The renderer is sandboxed: Node integration is disabled and the preload exposes
no privileged APIs. Persistent application data and upload staging are stored in
Electron's per-user data directory, not in the installed application bundle.

## Commands

From `src/`:

```bash
pnpm desktop:start        # build the UI and local backend, then open Electron
pnpm desktop:package      # create an installable package for the host platform
pnpm desktop:package:dir  # create an unpacked package for smoke testing
```

`desktop:prepare` creates `resources/backend` as a generated, platform-specific
input for Electron Builder. It must be run on each target platform/architecture.
