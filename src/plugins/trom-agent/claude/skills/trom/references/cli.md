# The command line

`trom` is the command line for the cart. It talks to the same engine as the web UI, and it is what the agent uses for everything. The user can use it directly too.

## The tour

Give this much, then ask what they want to try. Dig into one item at a time.

- **What it does.** Browse and search a cart's SD and USB storage, launch and shuffle files, step next and previous, pause and stop, copy files both ways, favorite and ban (listing and lifting bans too), index storage, manage devices (list, reconnect, ping, reset), and watch folders that send what lands in a folder to a TeensyROM, with a list of every transfer. `trom --help` lists the groups; `trom <group> --help` goes deeper.
- **Built for scripts and agents.** Every command takes `--json`, and results can be piped, like `trom file search commando --json | jq -r '.[0].path' | trom file launch -`.
- **The menu.** `trom` on its own, in a real terminal, opens a guided menu: Launch, Watch Folders, Settings, Index Files, Devices, Generate ASID Patches and Credits. Launch is the star: start a stream and it plays through your library like a streaming service.
- **Chipsynth presets.** `trom chipsynth generate` makes ASID-friendly copies of Chipsynth C64 presets. Bring it up only if the user mentions Chipsynth.

## Opening the menu

The menu needs a real terminal, so it can't run inside this session. Offer to open it in a new terminal window, and confirm before opening anything:

- **Windows:** `start "" cmd /k "<full path to trom.exe>"`
- **macOS:** `osascript -e 'tell application "Terminal" to do script "trom"'`
- **Linux:** the first of `x-terminal-emulator -e trom`, `gnome-terminal -- trom`, `konsole -e trom` that exists. If none does, tell the user to open a terminal and type `trom`.

If the window fails to open, tell the user to open a terminal themselves and type `trom`. Say that the menu and this session control the same engine and cart, and that what is playing may change under you.
