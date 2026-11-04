# Trom API

Trom API is the server at the heart of TeensyROM Suite. It talks to your carts, and [Trom UI](trom-ui.md) and [Trom Terminal](trom-terminal.md) both work through it. A full database behind it tracks your files and their file and scene metadata, and powers search. You can also run it on its own, without the UI, to build your own client or automation.

## Run it

`trom` and `trom ui` start Trom API when they need it. To start, check on or stop it yourself:

- `trom api start` starts it in the background.
- `trom api status` shows whether it is running, and which version.
- `trom api stop` stops it, and the Trom UI it serves.

To run it in a terminal window instead, run `trom-suite` on Homebrew, or run `./TeensyRom.Api` (`TeensyRom.Api.exe` on Windows) from inside the `api` folder of the download. [Getting started](getting-started.md) covers the download.

It listens on port `10213`.

## HTTPS

Trom API also serves the same app over HTTPS, on port `10214`. The port is set by `Https:Port` in `api/appsettings.json`. Both ports serve the same app, and nothing redirects http to https, so each address works on its own. `trom ui` lists the secure address for each network address; [getting started](getting-started.md#secure-address) explains how to use it.

- **Certificate:** Trom API makes a self-signed certificate on your computer the first time it starts with HTTPS, and keeps it in the data home at `~/.teensyrom/api/Https/engine-https.pfx` (`%USERPROFILE%\.teensyrom\api\Https\engine-https.pfx` on Windows). `TEENSYROM_DATA_DIR` moves the data home.
- **Coverage:** the certificate covers `localhost`, this computer's name and its network addresses. It lasts two years. Trom API re-issues it when the computer's name or address changes, or when it is within 30 days of expiry, and each re-issue is reported.
- **Port in use:** if port `10214` is taken or the certificate can't be made, Trom API keeps serving http alone, and `trom api status` says why.
- **Status:** `GET /api/engine/https` reports the port, whether HTTPS is listening, the certificate's names, dates and change, and the reason for any problem.
- **Trusted local network:** HTTPS here protects against passive snooping on your home network. It is not for exposing Trom API to the internet.

## Build your own tools

Your tools can do what Trom UI and Trom Terminal do: launch files, browse and search your library, copy files, manage favorites and bans, and set themes. Call it over HTTP from any language, or generate a client from its OpenAPI spec at [http://localhost:10213/openapi/v1.json](http://localhost:10213/openapi/v1.json).

## API docs

With Trom API running, its API documentation is at [http://localhost:10213/scalar/v1](http://localhost:10213/scalar/v1).

<img width="2560" height="1440" alt="Trom API documentation page" src="../.github/images/trom-api-docs.png" />

<img width="2560" height="1440" alt="Trom API Search Files endpoint" src="../.github/images/trom-api-files.png" />
