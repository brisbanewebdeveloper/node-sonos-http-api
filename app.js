// Electron
const os = require('os');
const {
  app,
  BrowserWindow,
  ipcMain,
  // shell,
} = require('electron');
// eslint-disable-next-line import/no-unresolved
const path = require('node:path');
const settings = require('./settings');

module.exports = {
  run: () => {
    const version = app.getVersion();

    function getIPAddress() {
      const interfaces = os.networkInterfaces();
      let found = false;

      Object.keys(interfaces).forEach((interfaceName) => {
        const netInterface = interfaces[interfaceName];

        found = netInterface.find((iface) => {
          // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
          if (iface.family === 'IPv4' && !iface.internal) {
            return true;
          }
          return false;
        });
      });

      if (found && found.address) return found.address;

      return 'Unable to determine IP address';
    }

    function createWindow() {
      const win = new BrowserWindow({
        width: 600,
        height: 300,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
        },
      });

      // Remove the window's menu bar
      // - This should be commented to debug so that you can open the developer tools
      win.removeMenu();

      const baseUrl = `http://${getIPAddress()}:${settings.port}`;

      ipcMain.handle('version', () => version);
      ipcMain.handle('baseUrl', () => baseUrl);

      win.loadFile('index.html');
    }

    app.whenReady().then(() => {
      createWindow();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
    });

    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });
  },
};
