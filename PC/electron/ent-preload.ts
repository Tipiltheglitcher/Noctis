import { contextBridge, ipcRenderer, webFrame } from 'electron';

const deviceUUID = ipcRenderer.sendSync('ent-login:get-device-uuid') as string | null;

contextBridge.exposeInMainWorld('__noctisEntBridge', {
  sendLoginState: (data: unknown) => {
    ipcRenderer.send('ent-login:state', data);
  },
  sendDiscoveredPronoteUrl: (url: string) => {
    ipcRenderer.send('ent-login:discovered-url', url);
  },
  sendDiscoveredUais: (uais: string[]) => {
    ipcRenderer.send('ent-login:discovered-uais', uais);
  },
  sendStatus: (status: string) => {
    ipcRenderer.send('ent-login:status-internal', status);
  },
});

// Install Pronote mobile app hook in the main world BEFORE page scripts execute
if (deviceUUID) {
  const hookCode = `
    (function () {
      window.hookAccesDepuisAppli = function () {
        try {
          this.passerEnModeValidationAppliMobile('', ${JSON.stringify(deviceUUID)});
        } catch (e) {}
      };
    })();
  `;
  webFrame.executeJavaScript(hookCode).catch(() => {});
}
