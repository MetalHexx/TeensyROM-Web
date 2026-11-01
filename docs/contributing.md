# Contributing

TeensyROM Suite is mostly a one-person project, and ideas and testing help are welcome. Come and talk on the [TeensyROM Discord](https://discord.com/invite/ubSAb74S5U) before you start on something big.

This page builds the suite from source. If you only want to use it, [get started](getting-started.md) with a release instead.

## What you need

- git
- .NET 9 SDK
- Node 20
- pnpm 9 or later
- PowerShell 7 (`pwsh`) on every OS, Windows included. Windows PowerShell 5.1 is not `pwsh`. The frontend build runs a PowerShell script.

## Build from source

1. Clone `https://github.com/MetalHexx/TeensyROM-Suite` and `https://github.com/MetalHexx/SIDablist` as **siblings** in the same folder. The suite finds SIDablist at `../../SIDablist` from its `src` folder.
2. Build SIDablist first. In `SIDablist`, run `pnpm install`, then `pnpm -r run build`.
3. In `TeensyROM-Suite/src`, run `pnpm install`.
4. Build the frontend into Trom API. Create the folder `apps/api/src/TeensyRom.Api/wwwroot` if it does not exist (it is git-ignored, so a fresh clone lacks it, and the build script fails without it), then run `pnpm run build:frontend` from `src`. Without this step Trom API starts but serves no Trom UI.
5. Build `trom`, the Trom Terminal client, from `src`: `dotnet build apps/cli/TeensyRom.Cli.sln -c Release`.
6. Put it on your PATH by running the built `trom` once with `path add`. Open a new terminal afterwards.
7. Run `trom init` to start Trom API. It builds Trom API from the same checkout on first use, and Trom UI is served at [http://localhost:10213](http://localhost:10213).

The installs and builds can take a few minutes, especially the first `trom init`. If the frontend build seems stuck after it finished, check that `wwwroot` holds an `index.html`, and run `pnpm nx daemon --stop` from `src` to release the helper process.

To update, `git pull` in both repos and repeat the build steps.

## Working on the code

[`src/AGENTS.md`](../src/AGENTS.md) is the guide to the repository: the project layout, the architecture rules, the build, test and lint commands, and the conventions the code follows. Read it before you change anything.
