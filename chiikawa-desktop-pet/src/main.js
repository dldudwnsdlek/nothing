const { app, BrowserWindow, ipcMain, screen, powerMonitor } = require('electron');
const path = require('path');

const isMac = process.platform === 'darwin';
const AWAY_SEC = 5 * 60; // 이만큼 컴퓨터를 안 쓰면 다 같이 잠듦
let panel = null;
let overlay = null;

function overlayBounds() {
  // 작업 영역(작업표시줄·Dock 제외) 위를 걸어다니도록
  return screen.getPrimaryDisplay().workArea;
}

function createOverlay() {
  const { x, y, width, height } = overlayBounds();
  overlay = new BrowserWindow({
    x, y, width, height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    fullscreenable: false,
    roundedCorners: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  if (isMac) overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // 기본은 마우스가 아래 창으로 통과. 캐릭터 위에 올라가면 렌더러가 해제 요청
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadFile(path.join(__dirname, 'overlay.html'));
  overlay.on('closed', () => { overlay = null; });
}

function createPanel() {
  panel = new BrowserWindow({
    width: 340,
    height: 370,
    useContentSize: true, // 제목줄을 빼고 내용 영역이 340x370
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: '치이카와 데스크톱 펫',
    backgroundColor: '#fff8ee',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  panel.loadFile(path.join(__dirname, 'panel.html'));
  panel.on('closed', () => { panel = null; app.quit(); });
}

function fitOverlay() {
  if (overlay) overlay.setBounds(overlayBounds());
}

// 커서 위치를 오버레이 기준 좌표로 알려줌 (캐릭터가 쳐다보고 따라오도록)
function watchCursor() {
  setInterval(() => {
    if (!overlay || overlay.isDestroyed()) return;
    const p = screen.getCursorScreenPoint();
    const b = overlay.getBounds();
    overlay.webContents.send('cursor', { x: p.x - b.x, y: p.y - b.y });
  }, 100);
}

// 자리 비움 감지: 오래 안 쓰면 잠들고, 돌아오면 반겨줌
function watchAway() {
  let away = false;
  setInterval(() => {
    if (!overlay || overlay.isDestroyed()) return;
    const idle = powerMonitor.getSystemIdleTime();
    if (!away && idle >= AWAY_SEC) {
      away = true;
      overlay.webContents.send('user-away');
    } else if (away && idle < 3) {
      away = false;
      overlay.webContents.send('user-back');
    }
  }, 2000);
}

ipcMain.on('spawn', (_e, type) => overlay && overlay.webContents.send('spawn', type));
ipcMain.on('clear', () => overlay && overlay.webContents.send('clear'));
ipcMain.on('event', (_e, name) => overlay && overlay.webContents.send('event', name));
ipcMain.on('counts', (_e, counts) => panel && panel.webContents.send('counts', counts));
ipcMain.on('set-ignore', (_e, ignore) => {
  if (!overlay) return;
  if (ignore) overlay.setIgnoreMouseEvents(true, { forward: true });
  else overlay.setIgnoreMouseEvents(false);
});

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (panel) { if (panel.isMinimized()) panel.restore(); panel.show(); panel.focus(); }
  });

  app.whenReady().then(() => {
    createOverlay();
    createPanel();
    watchCursor();
    watchAway();
    screen.on('display-metrics-changed', fitOverlay);
    screen.on('display-added', fitOverlay);
    screen.on('display-removed', fitOverlay);
    app.on('activate', () => { if (!panel) createPanel(); });
  });

  app.on('window-all-closed', () => app.quit());
}
