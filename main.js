const { app, BrowserWindow } = require('electron');

// main.js
//
// This file boots an Electron instance that wraps the original
// Azgaar's Fantasy Map Generator.  The GPU edition simply loads
// the unmodified web UI from the local filesystem and applies
// GPU‑accelerated hooks via renderer.js.  The browser window
// enables Node integration so that the renderer can require
// modules such as gpu.js.

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  // Load the upstream index.html from the local folder.  This file
  // contains the full web version of the generator.  When loaded,
  // the renderer process will patch it to raise the map cell limit
  // and off‑load heavy computations to the GPU.
  win.loadFile('index.html');

  // Uncomment the line below to open DevTools for debugging.
  // win.webContents.openDevTools();
}

// When Electron is ready, create our window.  On macOS it is
// common to recreate windows when the dock icon is clicked.
app.whenReady().then(() => {
  createWindow();
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS where apps
// generally remain open until the user explicitly quits.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});