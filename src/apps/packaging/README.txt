TeensyROM Suite {{VERSION}}

Start
  cli/trom ui              (Windows: cli\trom ui)
  Starts Trom API if it is not running, opens Trom UI in your browser
  and prints the addresses other devices on your network can use.

Put trom on your PATH
  Say yes when trom offers to put itself on your PATH, then open a
  new terminal. cli/trom path add does the same later.

Commands
  trom                         guided menu
  trom ui                      open Trom UI
  trom api start|status|stop   start, check on or stop Trom API
  trom update                  update to the newest release
  trom --help                  every command

Folders
  api/   Trom API (TeensyRom.Api), appsettings.json, Trom UI (wwwroot), Assets
  cli/   trom, the command-line tool

Run Trom API in a terminal instead
  cd api
  ./TeensyRom.Api          (Windows: TeensyRom.Api.exe)

Data
  ~/.teensyrom             (Windows: %USERPROFILE%\.teensyrom)

Docs
  https://github.com/MetalHexx/TeensyROM-Suite/blob/main/docs/getting-started.md
