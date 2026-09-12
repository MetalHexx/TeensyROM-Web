# TeensyROM desktop shell

Optional Electron packaging around the existing standalone web app. Electron owns
the application window and the lifetime of the bundled .NET API.

At startup the shell:

1. Sets `Kestrel__Endpoints__Http__Url` so the child API binds as configured by the
   shell (standalone `appsettings.json` / `Program.cs` stay unchanged)
2. Sets `TEENSYROM_DATA_DIR` under the OS user-data directory
3. Waits for `/api/version`, then loads the Angular app from that API

Without those environment variables, the API keeps its standalone defaults
(`http://0.0.0.0:213` and assembly-relative data paths).

The renderer is sandboxed: Node integration is disabled and the preload exposes
no privileged APIs.

## Status vs upstream design requirements

This shell is an early additive slice. Still outstanding: fixed port 213, LAN
"Share on my network" toggle, remote-host mode, Nx `project.json`, Windows
`prepare-backend` spawn fix, and MIDI secure-origin handling.

## Commands

From `src/`:

```bash
pnpm desktop:start        # build the UI and local backend, then open Electron
pnpm desktop:package      # create an installable package for the host platform
pnpm desktop:package:dir  # create an unpacked package for smoke testing
```

`desktop:prepare` creates `resources/backend` as a generated, platform-specific
input for Electron Builder. It must be run on each target platform/architecture.
