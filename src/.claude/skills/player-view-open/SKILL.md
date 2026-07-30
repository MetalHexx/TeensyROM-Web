---
name: player-view-open
description: Open the Player view in the browser
user-invocable: true
disable-model-invocation: true
---

# Open Player View

Opens the TeensyROM Player view at http://localhost:4200/player. If the frontend is not running, starts the development server first.

## Process

### Step 1: Open Player View

Eagerly attempt to open the Player view in the default browser:

**URL**: http://localhost:4200/player

```powershell
Start-Process "http://localhost:4200/player"
```

### Step 2: Start Frontend (if Step 1 fails)

If the page fails to load (connection refused or page not found), start the frontend:

```bash
pnpm nx serve teensyrom-ui
```

Wait for the dev server to be ready (typically shows "Application bundle generation complete" or similar message indicating the server is listening on port 4200).

### Step 3: Retry Opening Player View

After the dev server starts, open the Player view again:

```powershell
Start-Process "http://localhost:4200/player"
```

## Expected Outcome

The Player view should load, displaying:
- Media player controls
- Track information
- Playback status
- Player-specific UI components

## Troubleshooting

If the page doesn't load:
- Verify the dev server is running on port 4200
- Check for any compilation errors in the terminal output
- Ensure no other application is using port 4200
- Try accessing http://localhost:4200 first to verify the app is running

## Reference

- [Player Feature Documentation](../../../docs/features/player/)
- [Component Library](../../../docs/COMPONENT_LIBRARY.md)
