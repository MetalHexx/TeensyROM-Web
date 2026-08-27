const { app, BrowserWindow, dialog, shell } = require('electron');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');

const STARTUP_TIMEOUT_MS = 30_000;
let apiProcess;
let apiUrl;
let mainWindow;

function backendExecutable() {
  const name = process.platform === 'win32' ? 'TeensyRom.Api.exe' : 'TeensyRom.Api';
  const root = app.isPackaged
    ? path.join(process.resourcesPath, 'backend')
    : path.join(__dirname, 'resources', 'backend');

  return path.join(root, name);
}

function reserveLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = server.address();
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

function waitForApi(baseUrl) {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const response = await fetch(`${baseUrl}/api/version`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // The backend has not opened its socket yet.
      }

      if (Date.now() >= deadline) {
        reject(
          new Error(
            `The local TeensyROM service did not start within ${STARTUP_TIMEOUT_MS / 1000} seconds.`
          )
        );
        return;
      }

      setTimeout(poll, 250);
    };

    void poll();
  });
}

async function startApi() {
  const executable = backendExecutable();
  if (!fs.existsSync(executable)) {
    throw new Error(
      `The packaged API was not found at ${executable}. Run pnpm desktop:prepare before starting Electron.`
    );
  }

  const port = await reserveLoopbackPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const dataDirectory = path.join(app.getPath('userData'), 'backend');
  fs.mkdirSync(dataDirectory, { recursive: true });

  apiProcess = spawn(executable, [], {
    cwd: path.dirname(executable),
    env: {
      ...process.env,
      ASPNETCORE_ENVIRONMENT: 'Production',
      TEENSYROM_DATA_DIR: dataDirectory,
      TEENSYROM_URL: baseUrl,
    },
    stdio: 'pipe',
    windowsHide: true,
  });

  apiProcess.once('error', (error) => {
    console.error('Unable to start the TeensyROM API:', error);
  });
  apiProcess.once('exit', () => {
    apiProcess = undefined;
    apiUrl = undefined;
  });
  apiProcess.stderr?.on('data', (chunk) => console.error(`[api] ${chunk}`));

  await waitForApi(baseUrl);
  apiUrl = baseUrl;
  return baseUrl;
}

function stopApi() {
  if (apiProcess && !apiProcess.killed) {
    apiProcess.kill();
  }
  apiProcess = undefined;
  apiUrl = undefined;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    show: false,
    backgroundColor: '#111111',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  return mainWindow;
}

async function openDesktopApp() {
  const window = createWindow();

  try {
    const localApiUrl = apiUrl ?? (await startApi());
    await window.loadURL(localApiUrl);
  } catch (error) {
    stopApi();
    const message = error instanceof Error ? error.message : String(error);
    await window.loadURL(
      `data:text/html,${encodeURIComponent(`
      <main style="font-family: system-ui; max-width: 42rem; margin: 15vh auto; color: #eee; background: #181818; padding: 2rem; border-radius: 12px">
        <h1>TeensyROM could not start</h1>
        <p>${message}</p>
        <p>Check that the application installation is complete, then try again.</p>
      </main>
    `)}`
    );
    window.show();
    void dialog.showErrorBox('TeensyROM could not start', message);
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(openDesktopApp);
  app.on('before-quit', stopApi);
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void openDesktopApp();
  });
}
