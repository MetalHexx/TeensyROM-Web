---
name: device-view-open
description: Open the Device view in the browser
user-invocable: true
disable-model-invocation: true
---

# Open Device View

Opens the TeensyROM Device view at http://localhost:4200/device. If the frontend is not running, starts the development server first.

## Process

### Step 1: Open Device View

Eagerly attempt to open the Device view in the default browser:

**URL**: http://localhost:4200/device

```powershell
Start-Process "http://localhost:4200/device"
```

### Step 2: Start Frontend (if Step 1 fails)

If the page fails to load (connection refused or page not found), start the frontend:

```bash
pnpm nx serve teensyrom-ui
```

Wait for the dev server to be ready (typically shows "Application bundle generation complete" or similar message indicating the server is listening on port 4200).

### Step 3: Retry Opening Device View

After the dev server starts, open the Device view again:

```powershell
Start-Process "http://localhost:4200/device"
```

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

- [Device Feature Documentation](../../../docs/features/devices/)
- [Component Library](../../../docs/COMPONENT_LIBRARY.md)
