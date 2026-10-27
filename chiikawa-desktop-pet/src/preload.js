const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  // 패널 → 메인
  spawn: (type) => ipcRenderer.send('spawn', type),
  clearAll: () => ipcRenderer.send('clear'),
  event: (name) => ipcRenderer.send('event', name),
  openPhotos: () => ipcRenderer.send('open-photos'),
  onDex: (cb) => ipcRenderer.on('dex', (_e, dex) => cb(dex)),
  onPhotoSaved: (cb) => ipcRenderer.on('photo-saved', (_e, info) => cb(info)),
  onCounts: (cb) => ipcRenderer.on('counts', (_e, counts) => cb(counts)),
  // 오버레이 ↔ 메인
  onSpawn: (cb) => ipcRenderer.on('spawn', (_e, type) => cb(type)),
  onClear: (cb) => ipcRenderer.on('clear', () => cb()),
  setIgnore: (ignore) => ipcRenderer.send('set-ignore', ignore),
  reportCounts: (counts) => ipcRenderer.send('counts', counts),
  onEvent: (cb) => ipcRenderer.on('event', (_e, name) => cb(name)),
  onCursor: (cb) => ipcRenderer.on('cursor', (_e, p) => cb(p)),
  onAway: (cb) => ipcRenderer.on('user-away', () => cb()),
  onBack: (cb) => ipcRenderer.on('user-back', () => cb()),
  reportDex: (dex) => ipcRenderer.send('dex', dex),
  takePhoto: (rect) => ipcRenderer.invoke('photo', rect),
});
