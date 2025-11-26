---
description: Open the Settings view in the browser
tools: ['runCommands', 'openSimpleBrowser']
---

# Open Settings View

Opens the TeensyROM Settings view at http://localhost:4200/settings. If the frontend is not running, starts the development server first.

## Process

### Step 1: Open Settings View

Eagerly attempt to open the Settings view in the browser:

**URL**: http://localhost:4200/settings

Use the Simple Browser to open the URL within VS Code for quick access.

### Step 2: Start Frontend (if Step 1 fails)

If the page fails to load (connection refused or page not found), start the frontend:

```bash
pnpm nx serve teensyrom-ui
```

Wait for the dev server to be ready (typically shows "Application bundle generation complete" or similar message indicating the server is listening on port 4200).

### Step 3: Retry Opening Settings View

After the dev server starts, open the Settings view again:

**URL**: http://localhost:4200/settings

## Expected Outcome

The Settings view should load, displaying:
- Application configuration options
- User preferences
- System settings
- Settings-specific UI components

## Troubleshooting

If the page doesn't load:
- Verify the dev server is running on port 4200
- Check for any compilation errors in the terminal output
- Ensure no other application is using port 4200
- Try accessing http://localhost:4200 first to verify the app is running

## Reference

- [Settings Feature Documentation](../../docs/features/settings/)
- [Component Library](../../docs/COMPONENT_LIBRARY.md)
