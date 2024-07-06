// eslint-disable-next-line import/no-extraneous-dependencies
const { contextBridge, ipcRenderer } = require('electron');

// contextBridge.exposeInMainWorld(
//   'versions',
//   {
//     node: () => process.versions.node,
//     chrome: () => process.versions.chrome,
//     electron: () => process.versions.electron,
//     ping: () => ipcRenderer.invoke('ping'),
//     // we can also expose variables, not just functions
//   },
// );

contextBridge.exposeInMainWorld(
  'app',
  {
    version: () => ipcRenderer.invoke('version'),
    baseUrl: () => ipcRenderer.invoke('baseUrl'),
  },
);
