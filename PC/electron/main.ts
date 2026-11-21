import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron';
import path from 'node:path';
import type { AppSettings } from '../shared/types';
import { cancelEntLoginWindow, startEntLoginFlow } from './ent-login';
import { pronoteService } from './pronote';
import { loadSettings, saveSettings } from './storage';
import { checkForGitHubUpdate, downloadAndRunInstaller } from './updater';

let mainWindow: BrowserWindow | null = null;

const isDev = !app.isPackaged;

// Single instance lock so double-clicking the .exe focuses the open window
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function getIconPath(): string {
  return path.join(__dirname, '..', 'build', 'icon.ico');
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 840,
    minWidth: 1024,
    minHeight: 680,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#060608',
    icon: getIconPath(),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      v8CacheOptions: 'code',
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-changed', false);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url).catch(() => {});
    }
    return { action: 'deny' };
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch(() => {});
  } else if (isDev) {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      mainWindow?.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

function registerIpcHandlers(): void {
  // Window controls
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:toggleMaximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }
    mainWindow.maximize();
    return true;
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() ?? false;
  });

  // Auth
  ipcMain.handle('auth:restore', async () => {
    return pronoteService.restoreSession();
  });

  ipcMain.handle('auth:reconnect', async () => {
    return pronoteService.reconnectOnline();
  });

  ipcMain.handle(
    'auth:loginQR',
    async (_e, payload: { qr: { jeton: string; login: string; url: string }; pin: string }) => {
      return pronoteService.loginWithQR(payload);
    }
  );

  ipcMain.handle(
    'auth:loginENT',
    async (
      _e,
      options: {
        mode: 'lyceeconnecte' | 'lyceeconnecte-educonnect' | 'lyceeconnecte-direct' | 'url';
        url?: string;
        schoolName?: string;
      }
    ) => {
      try {
        const result = await startEntLoginFlow(mainWindow, options, (status) => {
          mainWindow?.webContents.send('auth:ent-status', status);
        });
        return await pronoteService.loginWithToken({
          url: result.url,
          username: result.username,
          token: result.token,
          deviceUUID: result.deviceUUID,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { ok: false, error: message };
      }
    }
  );

  ipcMain.handle('auth:cancelENT', () => {
    cancelEntLoginWindow();
  });

  ipcMain.handle(
    'auth:loginCredentials',
    async (_e, payload: { url: string; username: string; password: string }) => {
      return pronoteService.loginWithCredentials(payload);
    }
  );

  ipcMain.handle('auth:loginDemo', async () => {
    return pronoteService.loginDemo();
  });

  ipcMain.handle(
    'auth:completeSecurity',
    async (_e, payload: { pin?: string; deviceName?: string }) => {
      return pronoteService.completeSecurityChallenge(payload);
    }
  );

  ipcMain.handle('auth:logout', () => {
    pronoteService.logout();
  });

  ipcMain.handle('auth:searchSchools', async (_e, query: string) => {
    return pronoteService.searchSchools(query);
  });

  // Data
  ipcMain.handle('data:getProfile', () => pronoteService.getProfile());
  ipcMain.handle('data:getOfflineSnapshot', () => pronoteService.getOfflineSnapshot());
  ipcMain.handle('data:getMessagingDisabled', () => pronoteService.getMessagingDisabled());
  ipcMain.handle('data:getTimetable', (_e, dateISO: string) => pronoteService.getTimetable(dateISO));
  ipcMain.handle('data:getLessonDetails', (_e, resourceId: string) =>
    pronoteService.getLessonDetails(resourceId)
  );
  ipcMain.handle('data:getHomework', (_e, fromISO: string, toISO: string) =>
    pronoteService.getHomework(fromISO, toISO)
  );
  ipcMain.handle('data:setHomeworkDone', (_e, id: string, done: boolean) =>
    pronoteService.setHomeworkDone(id, done)
  );
  ipcMain.handle('data:getGrades', (_e, periodId?: string) => pronoteService.getGrades(periodId));
  ipcMain.handle('data:getAttendance', (_e, periodId?: string) =>
    pronoteService.getAttendance(periodId)
  );
  ipcMain.handle('data:getNews', () => pronoteService.getNews());
  ipcMain.handle('data:getNewsDetail', (_e, newsId: string) =>
    pronoteService.getNewsDetail(newsId)
  );
  ipcMain.handle('data:markNewsRead', (_e, newsId: string) => pronoteService.markNewsRead(newsId));
  ipcMain.handle('data:acknowledgeNews', (_e, newsId: string) =>
    pronoteService.acknowledgeNews(newsId)
  );
  ipcMain.handle(
    'data:answerSurvey',
    (
      _e,
      newsId: string,
      answers: Array<{
        questionId: string;
        selectedAnswers?: number[];
        textInputAnswer?: string;
      }>
    ) => pronoteService.answerSurvey(newsId, answers)
  );
  ipcMain.handle('data:getDiscussions', () => pronoteService.getDiscussions());
  ipcMain.handle('data:getDiscussionMessages', (_e, id: string) =>
    pronoteService.getDiscussionMessages(id)
  );
  ipcMain.handle('data:sendDiscussionMessage', (_e, id: string, content: string) =>
    pronoteService.sendDiscussionReply(id, content)
  );
  ipcMain.handle('data:getMenus', (_e, dateISO?: string) => pronoteService.getMenus(dateISO));

  // System
  ipcMain.handle('system:openExternal', async (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) {
      await shell.openExternal(url);
    }
  });

  ipcMain.handle('system:getSettings', () => loadSettings());
  ipcMain.handle('system:saveSettings', (_e, partial: Partial<AppSettings>) =>
    saveSettings(partial)
  );

  ipcMain.handle('system:notify', (_e, title: string, body: string) => {
    const settings = loadSettings();
    if (!settings.notificationsEnabled) return;
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  // Auto-updater (GitHub Releases)
  ipcMain.handle('updater:getVersion', () => app.getVersion());
  ipcMain.handle('updater:check', () => checkForGitHubUpdate());
  ipcMain.handle('updater:downloadAndInstall', (_e, downloadUrl: string, assetName: string) =>
    downloadAndRunInstaller(downloadUrl, assetName, (progress) => {
      mainWindow?.webContents.send('updater:progress', progress);
    })
  );
}

app.setAppUserModelId('com.noctis.desktop');

app.whenReady().then(() => {
  registerIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
