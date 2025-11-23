---
description: Open the Device view in the browser
tools: ['runCommands', 'openSimpleBrowser']
---

# Open Device View

Opens the TeensyROM Device view at http://localhost:4200/device. If the frontend is not running, starts the development server first.

## Process

### Step 1: Check if Frontend is Running

Check if the "Serve Frontend" task is already running:
- If running, proceed to Step 3
- If not running, proceed to Step 2

### Step 2: Start Frontend (if needed)

If the frontend is not running, start it:

```bash
pnpm start
```

Wait for the dev server to be ready (typically shows "Application bundle generation complete" or similar message indicating the server is listening on port 4200).

### Step 3: Open Device View

Open the Device view in the browser:

**URL**: http://localhost:4200/device

Use the Simple Browser to open the URL within VS Code for quick access.

## Expected Outcome

The Device view should load, displaying:
- Connected TeensyROM devices
- Device information and status
- Device management controls
- Device-specific UI components

## Troubleshooting

If the page doesn't load:
- Verify the dev server is running on port 4200
- Check for any compilation errors in the terminal output
- Ensure no other application is using port 4200
- Try accessing http://localhost:4200 first to verify the app is running

## Reference

- [Device Feature Documentation](../../docs/features/devices/)
- [Component Library](../../docs/COMPONENT_LIBRARY.md)
