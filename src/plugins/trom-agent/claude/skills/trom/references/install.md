# Install or update trom from source

Until a release exists, `trom` is built from source. Explain this plan and get a yes before running anything. Show each command before running it.

## Prerequisites

Check each; for a missing one, offer to install it from its official source or the OS package manager only with the user's permission, otherwise tell them how.

- git
- .NET 9 SDK
- Node 20
- pnpm 9 or later (tr-web's CI pins pnpm 9; SIDablist's CI build runs `npx --yes pnpm@10.11.0`)
- PowerShell 7 (`pwsh`) on every OS, Windows included. Windows PowerShell 5.1 is not `pwsh`. `pnpm run build:frontend` runs `pwsh scripts/copy-frontend.ps1`.

## Steps

1. Pick a folder with the user's agreement. Clone these as **siblings** in it (tr-web's `src/package.json` resolves SIDablist at `../../SIDablist`):
   - `https://github.com/MetalHexx/TeensyROM-Web`
   - `https://github.com/MetalHexx/SIDablist`
2. Build SIDablist: in `SIDablist`, `pnpm install`, then `pnpm -r run build`.
3. In `TeensyROM-Web/src`: `pnpm install`.
4. Create `apps/api/src/TeensyRom.Api/wwwroot` if it does not exist. It is git-ignored, so a fresh clone lacks it, and the build script exits 1 without it.
5. In `TeensyROM-Web/src`: `pnpm run build:frontend`. This builds the web UI into the engine's `wwwroot`.
6. Build `trom`: `dotnet build apps/cli/TeensyRom.Cli.sln -c Release`.
7. Put it on the PATH: run the built `trom` once with `path add` (this adds the folder holding the built `trom`). Open a new terminal, or use the full path, for the rest of the session.
8. Verify: `trom init --json`. `engine.running` must be true (the CLI builds and starts the engine from the same checkout) and `webUi.available` must be true.

## Long steps

`pnpm install`, `pnpm -r run build`, `pnpm run build:frontend`, `dotnet build`, and the first `trom init` (which builds the engine) can run past the harness's default command timeout (two minutes in Claude Code). Run them with a long timeout, or as background commands, and wait for them to finish.

## Updating

Only when asked: `git pull` in both repos, then repeat the build steps above.
