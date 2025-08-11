const { app, BrowserWindow } = require('electron');

// Create the Electron browser window.  In a production build
// you might want to tweak these settings and enable GPU acceleration
// flags.  Electron runs on top of Chromium and will automatically
// leverage hardware acceleration when available.
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

  // Load our custom index.html.  This file pulls in the original
  // generator UI and patches the point limit and heavy computational
  // functions to use GPU.js kernels.
  win.loadFile('index.html');

  // Uncomment to open DevTools for debugging.
  // win.webContents.openDevTools();
}

// When Electron is ready, create the window.  On macOS it is
// common to recreate the window when the dock icon is clicked.
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