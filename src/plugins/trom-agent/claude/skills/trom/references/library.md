# Library and files

## Browsing

Guide the user through the library with `trom file ls "<dir>" --json`. It works without an index. Start at the storage root (`trom file ls --json`) and follow their curiosity, a few entries at a time.

## Stories

When a file is launched, tell a short story under the rules in `dj.md` (see its Stories section). Do not repeat them here.

## Curating

Favorite, unfavorite and ban work as in `dj.md` (Curating), with the same rule: confirm before a ban.

## Search and random

`trom file search "<text>" --json` and `trom file random --json` read only what the engine has cached. When stderr carries an `indexIncomplete` notice, gently remind the user and offer `trom index build --device <name> --storage <sd|usb>` (as a background command, after they agree).

## Not yet

If `init`'s `capabilities` does not list a command for what the user asks (copy, delete, send), say plainly: "this version of trom can't do that yet".
