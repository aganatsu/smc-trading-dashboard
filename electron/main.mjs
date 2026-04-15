/**
 * SMC Trading Dashboard — Electron Main Process
 *
 * Architecture:
 *   1. App ready → fork the Express/tRPC server as a child process
 *   2. Server emits "Server running on http://localhost:<port>" on stdout
 *   3. Open a BrowserWindow pointing at that port
 *   4. On quit → SIGTERM the child, wait for exit, then quit Electron
 *
 * The SQLite database file is stored in app.getPath('userData') so it
 * persists across app updates and is never inside the .app bundle.
 */

import {
  app,
  BrowserWindow,
  shell,
  Menu,
  Tray,
  nativeImage,
  dialog,
} from 'electron';
import { fork, execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ─── Globals ───────────────────────────────────────────────────────

let mainWindow = null;
let serverProcess = null;
let tray = null;
let serverPort = 3000;
let isQuitting = false;
let splashWindow = null;

// Persistent JWT secret — generated once, stored in userData
function getOrCreateJwtSecret() {
  const secretPath = path.join(app.getPath('userData'), '.jwt-secret');
  try {
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf-8').trim();
    }
  } catch { /* regenerate */ }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  fs.writeFileSync(secretPath, secret, 'utf-8');
  return secret;
}

// ─── Server Management ─────────────────────────────────────────────

function getServerScript() {
  if (app.isPackaged) {
    // Production: compiled JS in dist/
    return { script: path.join(ROOT, 'dist', 'index.js'), useTsx: false };
  }
  // Development: run TypeScript via tsx
  return { script: path.join(ROOT, 'server', '_core', 'index.ts'), useTsx: true };
}

function startServer() {
  return new Promise((resolve, reject) => {
    const { script, useTsx } = getServerScript();

    const dbPath = path.join(app.getPath('userData'), 'smc-trading.db');

    const env = {
      ...process.env,
      NODE_ENV: app.isPackaged ? 'production' : 'development',
      PORT: String(serverPort),
      SQLITE_DB_PATH: dbPath,
      OWNER_OPEN_ID: process.env.OWNER_OPEN_ID || 'electron-local-user',
      OWNER_NAME: process.env.OWNER_NAME || 'Trader',
      STANDALONE_MODE: 'true',
      JWT_SECRET: getOrCreateJwtSecret(),
    };

    console.log('[Electron] Starting server...');
    console.log('[Electron] Database path:', dbPath);
    console.log('[Electron] Server script:', script);
    console.log('[Electron] Packaged:', app.isPackaged);

    const forkOpts = {
      env,
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      cwd: ROOT,
    };

    if (useTsx) {
      // In dev, use tsx via --import flag so Node can handle TypeScript
      const tsxPath = path.join(ROOT, 'node_modules', '.bin', 'tsx');
      // Fork with tsx as the execPath — tsx is a Node.js wrapper
      try {
        serverProcess = fork(script, [], {
          ...forkOpts,
          execPath: tsxPath,
        });
      } catch (err) {
        // Fallback: try running with node --import tsx
        console.warn('[Electron] tsx fork failed, trying node --import tsx:', err.message);
        serverProcess = fork(script, [], {
          ...forkOpts,
          execArgv: ['--import', 'tsx'],
        });
      }
    } else {
      serverProcess = fork(script, [], forkOpts);
    }

    let resolved = false;

    serverProcess.stdout?.on('data', (data) => {
      const msg = data.toString();
      console.log('[Server]', msg.trim());

      if (!resolved && msg.includes('Server running on')) {
        const portMatch = msg.match(/:(\d+)/);
        if (portMatch) {
          serverPort = parseInt(portMatch[1], 10);
        }
        resolved = true;
        resolve(serverPort);
      }
    });

    serverProcess.stderr?.on('data', (data) => {
      const text = data.toString().trim();
      // Filter out noisy deprecation warnings
      if (text.includes('DeprecationWarning') || text.includes('ExperimentalWarning')) return;
      console.error('[Server Error]', text);
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron] Failed to start server:', err);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    serverProcess.on('exit', (code) => {
      console.log('[Electron] Server process exited with code:', code);
      if (!isQuitting && !resolved) {
        resolved = true;
        reject(new Error(`Server exited with code ${code} during startup`));
      } else if (!isQuitting) {
        dialog.showErrorBox(
          'Server Error',
          'The trading server has stopped unexpectedly. The app will now close.'
        );
        app.quit();
      }
    });

    // Timeout after 45 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error('Server startup timed out after 45 seconds'));
      }
    }, 45000);
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (!serverProcess) return resolve();

    const proc = serverProcess;
    serverProcess = null;

    // Give the server 5 seconds to shut down gracefully
    const forceKillTimer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* already dead */ }
      resolve();
    }, 5000);

    proc.on('exit', () => {
      clearTimeout(forceKillTimer);
      resolve();
    });

    try {
      proc.kill('SIGTERM');
    } catch {
      clearTimeout(forceKillTimer);
      resolve();
    }
  });
}

// ─── Splash Screen ─────────────────────────────────────────────────

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    transparent: true,
    resizable: false,
    center: true,
    alwaysOnTop: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #0a0a1a 0%, #0f1629 50%, #0a0a1a 100%);
          color: #e0e0e0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(0, 212, 255, 0.15);
        }
        .logo {
          font-size: 48px;
          margin-bottom: 16px;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.8; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        h1 {
          font-size: 20px;
          font-weight: 600;
          color: #00d4ff;
          margin-bottom: 8px;
          letter-spacing: 1px;
        }
        .subtitle {
          font-size: 12px;
          color: #666;
          margin-bottom: 32px;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .loader {
          width: 200px;
          height: 3px;
          background: rgba(0, 212, 255, 0.1);
          border-radius: 3px;
          overflow: hidden;
        }
        .loader-bar {
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, #00d4ff, #7b2ff7);
          border-radius: 3px;
          animation: loading 1.5s ease-in-out infinite;
        }
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
        .status {
          margin-top: 16px;
          font-size: 11px;
          color: #555;
        }
      </style>
    </head>
    <body>
      <div class="logo">📊</div>
      <h1>SMC Trading Dashboard</h1>
      <div class="subtitle">Smart Money Concepts</div>
      <div class="loader"><div class="loader-bar"></div></div>
      <div class="status">Starting trading engine...</div>
    </body>
    </html>
  `;

  splashWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.close();
  }
  splashWindow = null;
}

// ─── Main Window ───────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'SMC Trading Dashboard',
    backgroundColor: '#0a0a0f',
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${serverPort}`);

  mainWindow.once('ready-to-show', () => {
    closeSplash();
    mainWindow.show();
    mainWindow.focus();
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http') && !url.includes(`localhost:${serverPort}`)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Navigate external links in default browser
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.includes(`localhost:${serverPort}`)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // macOS: hide to dock instead of quitting
  mainWindow.on('close', (e) => {
    if (!isQuitting && process.platform === 'darwin') {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Set up application menu
  const isMac = process.platform === 'darwin';
  const menuTemplate = [
    ...(isMac
      ? [{
          label: 'SMC Trading',
          submenu: [
            { label: 'About SMC Trading Dashboard', role: 'about' },
            { type: 'separator' },
            { label: 'Preferences...', accelerator: 'Cmd+,', click: () => mainWindow?.webContents.executeJavaScript("window.location.hash = '#/settings'") },
            { type: 'separator' },
            { role: 'services' },
            { type: 'separator' },
            { role: 'hide' },
            { role: 'hideOthers' },
            { role: 'unhide' },
            { type: 'separator' },
            { label: 'Quit', accelerator: 'Cmd+Q', click: () => { isQuitting = true; app.quit(); } },
          ],
        }]
      : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [{ type: 'separator' }, { role: 'front' }]
          : [{ role: 'close' }]),
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Data Folder',
          click: () => shell.openPath(app.getPath('userData')),
        },
        {
          label: 'Open Database File',
          click: () => {
            const dbPath = path.join(app.getPath('userData'), 'smc-trading.db');
            if (fs.existsSync(dbPath)) {
              shell.showItemInFolder(dbPath);
            } else {
              dialog.showMessageBox({ message: 'Database file not found yet. Start trading first!' });
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Reset Database',
          click: async () => {
            const result = await dialog.showMessageBox(mainWindow, {
              type: 'warning',
              buttons: ['Cancel', 'Reset'],
              defaultId: 0,
              title: 'Reset Database',
              message: 'This will delete all your trading data. Are you sure?',
            });
            if (result.response === 1) {
              const dbPath = path.join(app.getPath('userData'), 'smc-trading.db');
              try {
                // Stop server, delete DB, restart
                isQuitting = true;
                await stopServer();
                if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
                if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
                if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
                app.relaunch();
                app.exit(0);
              } catch (err) {
                dialog.showErrorBox('Error', `Failed to reset database: ${err.message}`);
              }
            }
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
}

// ─── App Lifecycle ──────────────────────────────────────────────────

app.on('ready', async () => {
  console.log('[Electron] App ready');
  console.log('[Electron] User data path:', app.getPath('userData'));
  console.log('[Electron] App path:', app.getAppPath());

  // Show splash screen while server starts
  createSplash();

  try {
    const port = await startServer();
    console.log(`[Electron] Server ready on port ${port}`);
    createWindow();
  } catch (err) {
    closeSplash();
    console.error('[Electron] Failed to start:', err);
    dialog.showErrorBox(
      'Startup Error',
      `Failed to start the trading server:\n\n${err.message}\n\nPlease try restarting the app. If the problem persists, delete the database file and try again.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', async () => {
  isQuitting = true;
  await stopServer();
});

// Handle uncaught exceptions gracefully
process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught exception:', err);
  if (!isQuitting) {
    dialog.showErrorBox('Error', `An unexpected error occurred:\n\n${err.message}`);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('[Electron] Unhandled rejection:', reason);
});
