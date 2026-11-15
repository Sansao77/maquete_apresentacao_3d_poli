'use strict';

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('node:path');

/** Fundo do app (#101c1b), igual ao body — evita flash branco no primeiro frame. */
const APP_BACKGROUND = '#101c1b';
const APP_TITLE = 'Mangue Verde 3D';
const APP_HTML = path.join(__dirname, 'app', 'index.html');

/** @type {BrowserWindow | null} */
let mainWindow = null;

/**
 * Verifica se a URL pode ser entregue ao navegador do sistema.
 * Somente http(s) e mailto saem do app; qualquer outro esquema é descartado.
 * @param {string} rawUrl
 * @returns {boolean}
 */
function isExternalUrl(rawUrl) {
  try {
    const { protocol } = new URL(rawUrl);
    return protocol === 'http:' || protocol === 'https:' || protocol === 'mailto:';
  } catch {
    return false;
  }
}

/**
 * Abre uma URL no navegador padrão do SO. Falhas são apenas registradas,
 * nunca propagadas para o renderer.
 * @param {string} rawUrl
 */
function openExternal(rawUrl) {
  if (!isExternalUrl(rawUrl)) return;
  shell.openExternal(rawUrl).catch((error) => {
    console.error('[main] falha ao abrir link externo:', error);
  });
}

/** Cria a janela principal e amarra toda a política de navegação. */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: APP_BACKGROUND,
    title: APP_TITLE,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      spellcheck: false,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  // F11 alterna tela cheia e Esc encerra; feito no evento de input porque
  // o menu da aplicação foi removido.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !mainWindow) return;

    if (input.key === 'F11') {
      event.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
      return;
    }

    if (input.key === 'Escape') {
      event.preventDefault();
      mainWindow.close();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    let protocol = '';
    try {
      protocol = new URL(url).protocol;
    } catch {
      protocol = '';
    }

    if (protocol === 'file:') return;

    event.preventDefault();
    openExternal(url);
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error(`[main] falha ao carregar ${url} (${code}): ${description}`);
  });

  mainWindow.loadFile(APP_HTML).catch((error) => {
    console.error('[main] não foi possível carregar o app empacotado:', error);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Instância única: duas janelas abririam dois contextos WebGL e dobrariam
// o consumo de GPU no render 3D.
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
