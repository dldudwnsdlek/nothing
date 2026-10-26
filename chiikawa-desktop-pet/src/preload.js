const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  // 패널 → 메인
  spawn: (type) => ipcRenderer.send('spawn', type),
  clearAll: () => ipcRenderer.send('clear'),
  onCounts: (cb) => ipcRenderer.on('counts', (_e, counts) => cb(counts)),
  // 오버레이 ↔ 메인
  onSpawn: (cb) => ipcRenderer.on('spawn', (_e, type) => cb(type)),
  onClear: (cb) => ipcRenderer.on('clear', () => cb()),
  setIgnore: (ignore) => ipcRenderer.send('set-ignore', ignore),
  reportCounts: (counts) => ipcRenderer.send('counts', counts),
});
