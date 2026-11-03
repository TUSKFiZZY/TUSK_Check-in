const { app, BrowserWindow, shell } = require("electron");

const APP_URL = "https://tuskfizzy.github.io/TUSK_Check-in/";

function createWindow() {
  const win = new BrowserWindow({
    width: 520,
    height: 820,
    minWidth: 360,
    minHeight: 560,
    title: "TUSKFiZZY",
    autoHideMenuBar: true,
    backgroundColor: "#100e18",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  });

  win.loadURL(APP_URL);

  win.webContents.setWindowOpenHandler(({ url }) => {
    // Keep the tracker inside its own app window.
    if (url.startsWith("https://tuskfizzy.github.io/")) {
      win.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith("https://tuskfizzy.github.io/TUSK_Check-in/")) {
      event.preventDefault();
      if (url.startsWith("https://")) shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
