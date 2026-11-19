import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, PronoteAPI, UpdateProgressDTO } from '../shared/types';

const api: PronoteAPI = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggleMaximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizedChange: (cb) => {
      const listener = (_event: Electron.IpcRendererEvent, maximized: boolean) => cb(maximized);
      ipcRenderer.on('window:maximized-changed', listener);
      return () => ipcRenderer.removeListener('window:maximized-changed', listener);
    },
  },
  auth: {
    restoreSession: () => ipcRenderer.invoke('auth:restore'),
    loginQR: (payload) => ipcRenderer.invoke('auth:loginQR', payload),
    loginENT: (options) => ipcRenderer.invoke('auth:loginENT', options),
    cancelENT: () => ipcRenderer.invoke('auth:cancelENT'),
    loginCredentials: (payload) => ipcRenderer.invoke('auth:loginCredentials', payload),
    loginDemo: () => ipcRenderer.invoke('auth:loginDemo'),
    completeSecurityChallenge: (payload) => ipcRenderer.invoke('auth:completeSecurity', payload),
    logout: () => ipcRenderer.invoke('auth:logout'),
    searchSchools: (query) => ipcRenderer.invoke('auth:searchSchools', query),
    onEntStatus: (cb) => {
      const listener = (_event: Electron.IpcRendererEvent, status: string) => cb(status);
      ipcRenderer.on('auth:ent-status', listener);
      return () => ipcRenderer.removeListener('auth:ent-status', listener);
    },
  },
  data: {
    getProfile: () => ipcRenderer.invoke('data:getProfile'),
    getTimetable: (dateISO) => ipcRenderer.invoke('data:getTimetable', dateISO),
    getLessonDetails: (resourceId) => ipcRenderer.invoke('data:getLessonDetails', resourceId),
    getHomework: (fromISO, toISO) => ipcRenderer.invoke('data:getHomework', fromISO, toISO),
    setHomeworkDone: (assignmentId, done) =>
      ipcRenderer.invoke('data:setHomeworkDone', assignmentId, done),
    getGrades: (periodId) => ipcRenderer.invoke('data:getGrades', periodId),
    getAttendance: (periodId) => ipcRenderer.invoke('data:getAttendance', periodId),
    getNews: () => ipcRenderer.invoke('data:getNews'),
    getNewsDetail: (newsId) => ipcRenderer.invoke('data:getNewsDetail', newsId),
    markNewsRead: (newsId) => ipcRenderer.invoke('data:markNewsRead', newsId),
    acknowledgeNews: (newsId) => ipcRenderer.invoke('data:acknowledgeNews', newsId),
    answerSurvey: (newsId, answers) => ipcRenderer.invoke('data:answerSurvey', newsId, answers),
    getDiscussions: () => ipcRenderer.invoke('data:getDiscussions'),
    getDiscussionMessages: (discussionId) =>
      ipcRenderer.invoke('data:getDiscussionMessages', discussionId),
    sendDiscussionMessage: (discussionId, content) =>
      ipcRenderer.invoke('data:sendDiscussionMessage', discussionId, content),
    getMenus: (dateISO) => ipcRenderer.invoke('data:getMenus', dateISO),
  },
  system: {
    openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),
    getSettings: () => ipcRenderer.invoke('system:getSettings'),
    saveSettings: (settings: Partial<AppSettings>) =>
      ipcRenderer.invoke('system:saveSettings', settings),
    notify: (title, body) => ipcRenderer.invoke('system:notify', title, body),
  },
  updater: {
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('updater:check'),
    downloadAndInstall: (downloadUrl, assetName) =>
      ipcRenderer.invoke('updater:downloadAndInstall', downloadUrl, assetName),
    onDownloadProgress: (cb) => {
      const listener = (_e: Electron.IpcRendererEvent, progress: UpdateProgressDTO) => cb(progress);
      ipcRenderer.on('updater:progress', listener);
      return () => ipcRenderer.removeListener('updater:progress', listener);
    },
  },
};

contextBridge.exposeInMainWorld('pronoteAPI', api);
