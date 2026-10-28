# Watch folders and transfers

A watch folder is a folder on this computer. Files that land in it, or in a subfolder, are sent to a TeensyROM, into a folder the user picks on its storage. Once it's on, it keeps working while the engine runs.

Offer watch folders only when `init`'s `capabilities` lists `watch-folder add`.

## Adding one

Confirm each of these with the user before you run anything:

- The folder on this computer to watch.
- The TeensyROM (`--device`) and its storage (`--storage sd|usb`).
- The folder on the TeensyROM the files land in (`--path`, default `/auto-transfer`).
- Whether the TeensyROM launches each file that lands (`--launch`).

Then run `trom watch-folder add "<folder>" --device <name> --storage <sd|usb> --path "<device folder>" [--launch] --json`. The result is `{created, folder}`. `created` is false when the folder was already watched, and then this TeensyROM was added to it as another destination.

A folder can't sit inside another watched folder, or contain one.

## Listing

`trom watch-folder list --json` returns one entry per folder: `id`, `path`, `enabled`, `state` and `destinations`. Each destination has `id`, `deviceId`, `deviceName`, `storage`, `path` and `launch`.

`state` means:

- `watching`: the folder is on and being watched.
- `off`: the user paused it.
- `unavailable`: it is on, but can't be watched right now, usually because the folder is gone. The engine retries on its own.

## Changing a destination

Confirm first. `trom watch-folder set "<folder>" --device <name> [--path "<device folder>"] [--launch | --no-launch] --json` changes the device folder and the launch flag of an existing destination. It needs `--device` unless the folder has just one destination. It changes nothing else: the device and storage stay, and a different storage is a remove and add. Give at least one of `--path`, `--launch` and `--no-launch`. It exits 5 when the folder or that destination isn't there. The change applies to the next files that land.

## Pausing, resuming and removing

Confirm first, every time.

- Pause: `trom watch-folder pause "<folder>" --json`. The folder stays on the list and sends nothing until resumed. Files that land while it is paused are never sent later, not even after resume, so check with the user before pausing while they are still adding files.
- Resume: `trom watch-folder resume "<folder>" --json`.
- Remove: `trom watch-folder remove "<folder>" --json` removes the whole folder. Add `--device <name>` to stop only that TeensyROM getting its files. The result is `{path, deviceId, folderRemoved}`, and `deviceId` is absent when the whole folder went.

Pause, resume and remove exit 5 when the folder isn't watched.

## One destination per device

A folder sends to each TeensyROM once. To change a destination's device folder or launch, use `trom watch-folder set`. Only a different storage needs `remove --device` and then `add`.

## What lands

- Only files of the types the TeensyROM takes are sent. Archives (`.zip`, `.7z`, `.rar`) are expanded on the TeensyROM, as with an upload.
- Only files that arrive after the folder is watched count. Files already there are not sent.
- Files that arrive close together go as one transfer. The batch waits up to two minutes for any file still being written, so a normal download or copy goes as one transfer.
- The engine copies each file and never deletes or moves it from the folder.
- A file landing in a watched folder resets the TeensyROM, the same as an upload does, unless the engine believes the device is idle with nothing launched on it. A reset stops whatever is running. That's by design. Say so before the user turns a folder on while they're playing.

## Skipped files

A TeensyROM takes one transfer at a time. If a file lands while its TeensyROM is still receiving an earlier batch, or during a drag-and-drop, the file is skipped, not queued. A file is also skipped when its TeensyROM:

- was not connected,
- lacked the storage, or
- had a destination path that is not valid.

The engine logs a line for each skip and will not retry. The file is still in the watched folder, so the user can copy it with `trom file upload` once the TeensyROM is free. That copy is a normal upload and needs their confirmation. To find the log line, `trom engine status --json` gives the engine's `logFile`.

While a folder is sending to a TeensyROM, every command to that TeensyROM exits 6.

## Transfer list

`trom transfer list --json` shows every transfer the engine is running or has just finished, including ones the user didn't start. Watch-folder transfers appear here too. Each transfer has:

- `from.kind`: `upload` or `watchFolder`. For a watch folder, `from.watchFolderPath` names the folder.
- `state`, such as `receiving`.
- `launch.state`: `none`, `pending`, `launched`, `incompatible` or `failed`.

If the user asks what has been sent, say which transfers came from a watch folder and that they didn't start them.

## Launching

A watch-folder file launches only when the folder was added with `--launch` and the "Auto-launch after copy" setting is on. An upload launches when that setting is on. Either way, the engine launches one file from the transfer, games first. It never launches `.trh` files.
