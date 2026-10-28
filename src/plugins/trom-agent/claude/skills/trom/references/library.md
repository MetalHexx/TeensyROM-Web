# Library and files

## Browsing

Guide the user through the library with `trom file ls "<dir>" --json`. It works without an index. Start at the storage root (`trom file ls --json`) and follow their curiosity, a few entries at a time.

## Stories

When a file is launched, tell a short story under the rules in `dj.md` (see its Stories section). Do not repeat them here.

## Copying

Copy between this computer and the TeensyROM with `trom file upload` and `trom file download`. Both take `--json`.

- Upload: `trom file upload "<local path>" --to "<device folder>" --device <name> [--storage sd|usb] --json`. Always name the source.
- Download: `trom file download "<device path>" --to "<local folder>" --device <name> --json`.
- Folders keep their layout. `.zip`, `.7z` and `.rar` are expanded on the TeensyROM. Files over 10 MB are skipped on download and reported.
- Upload sends only the types the TeensyROM takes: `.sid`, `.crt`, `.prg`, `.p00`, `.hex`, `.kla`, `.koa`, `.art`, `.aas`, `.hpi`, `.seq`, `.txt`, `.d64`, `.nfo`, `.md`, `.ocp`, `.pic`, `.d71`, `.d81`, `.reu`, `.trh`, `.zip`, `.7z`, `.rar`. A folder upload leaves other files out, and a single file of another type is reported as not sent. Don't promise to copy other types.
- An upload that leaves files out prints a notice on stderr with the count, in `--json` too. Read the count from it and say it in plain words, for example "Two files weren't sent: the TeensyROM doesn't take their file types."
- An empty device folder is "nothing to download", exit 5, not success. Its folder is still created on the computer.
- A saved file's `localPath` is a full path under the chosen folder.
- `totals.copied` counts the files an archive expands to, so it can exceed the number of rows in `files`.
- Ask where files go when the user hasn't said: the device folder for an upload, the folder on the computer for a download. Your own working folder is wherever this session started, which is rarely where the user wants files.
- Before any copy, confirm what goes where. A copy replaces a same-named file at the destination.
- Never pass `--yes`. It sends the whole current folder, which is rarely what the user means; ask for the files instead.
- An upload resets the TeensyROM unless the engine believes it is idle with nothing launched on it, and a reset stops whatever is playing. Say so when you confirm, and don't copy during a timed set unless the user wants the set to end.
- When the "Auto-launch after copy" setting is on, an upload also launches one file once it lands: games first, never `.trh`. Say so when you confirm a copy.
- Report the summary, and each failure in plain words.
- A busy device (exit 6, code `deviceBusy`) is in the middle of a transfer: wait for it to finish, then try again, or use another TeensyROM.
- To copy and launch one file, see `dj.md` (Launching). `--launch` asks the engine to launch that file once it lands, whatever the setting says.

## Curating

Favorite, unfavorite and ban work as in `dj.md` (Curating), with the same rule: confirm before a ban.

- List the bans: `trom file banned --json` returns `[{entry, kind}]`, where `kind` is `file` or `folder`. Takes no `--device`.
- Lift a ban on request: `trom file unban "<entry>" --json`. Give the entry as `trom file banned` prints it, or a device file path. Takes no `--device`.

## Search and random

`trom file search "<text>" --json` and `trom file random --json` read only what the engine has cached. When stderr carries an `indexIncomplete` notice, gently remind the user and offer `trom index build --device <name> --storage <sd|usb>` (as a background command, after they agree).

## Not yet

Deleting files, and copying or moving files on the TeensyROM itself, are not in trom yet. For a move, if `init`'s `capabilities` lists `file download` and `file upload`, offer to download the files and then upload them to the new folder, confirming each copy as under Copying. The originals stay on the TeensyROM, since deleting isn't in trom yet. If `init`'s `capabilities` does not list a command for what the user asks, say plainly: "this version of trom can't do that yet".
