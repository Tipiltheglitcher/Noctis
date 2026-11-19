import { BrowserWindow, ipcMain } from 'electron';
import crypto from 'node:crypto';
import path from 'node:path';
import { cleanURL } from '@blockshub/pawnote-lts';

export interface EntLoginResult {
  url: string;
  username: string;
  token: string;
  deviceUUID: string;
}

export type EntLoginMode =
  | 'lyceeconnecte'
  | 'lyceeconnecte-educonnect'
  | 'lyceeconnecte-direct'
  | 'url';

const MOBILE_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const INFO_MOBILE_QUERY = '/InfoMobileApp.json?id=0D264427-EEFC-4810-A9E9-346942A862A4';
const LYCEE_CONNECTE_EDUCONNECT_URL =
  'https://educonnect.education.gouv.fr/idp/profile/SAML2/Unsolicited/SSO?providerId=https%3A%2F%2Fmon.lyceeconnecte.fr%2Fauth%2Fsaml%2Fmetadata%2Fidp.xml';
const LYCEE_CONNECTE_LOGIN_URL = 'https://mon.lyceeconnecte.fr/auth/login#/';

let activeEntWindow: BrowserWindow | null = null;
let activeReject: ((err: Error) => void) | null = null;

export function cancelEntLoginWindow(): void {
  if (activeEntWindow && !activeEntWindow.isDestroyed()) {
    activeEntWindow.close();
  }
  activeEntWindow = null;
  if (activeReject) {
    activeReject(new Error('Connexion ENT annulée.'));
    activeReject = null;
  }
}

/**
 * Extracts a PRONOTE base URL (e.g. https://0330021u.index-education.net/pronote)
 * either directly from a URL or from a CAS/ENT `service=` / `callback=` query parameter.
 */
function extractPronoteBaseUrl(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  try {
    const parsed = new URL(rawUrl);

    // Check if an ENT CAS/SSO URL wraps the real Pronote URL in ?service= or ?callback=
    for (const param of ['service', 'callback', 'url', 'redirect', 'target']) {
      const nested = parsed.searchParams.get(param);
      if (nested) {
        const fromNested = extractPronoteBaseUrl(nested);
        if (fromNested) return fromNested;
      }
    }

    // Never treat ENT login/CAS/marketing hosts themselves as Pronote instances
    const host = parsed.hostname.toLowerCase();
    if (
      host.includes('lyceeconnecte') ||
      host.includes('educonnect') ||
      host.includes('nouvelle-aquitaine.fr') ||
      host.includes('education.gouv.fr')
    ) {
      return null;
    }

    if (host.includes('index-education.net')) {
      const match = parsed.pathname.match(/^(.*\/pronote)(?:\/|$)/i);
      if (match) return `${parsed.origin}${match[1]}`;
      return `${parsed.origin}/pronote`;
    }

    const pathMatch = parsed.pathname.match(/^(.*\/pronote)(?:\/|$)/i);
    if (pathMatch) {
      return `${parsed.origin}${pathMatch[1]}`;
    }

    return null;
  } catch {
    return null;
  }
}

function isAuthenticatedLyceeConnecteUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname.toLowerCase() !== 'mon.lyceeconnecte.fr') return false;
    const p = parsed.pathname.toLowerCase();
    if (
      p === '/' ||
      p.startsWith('/auth/') ||
      p.startsWith('/cas/') ||
      p.startsWith('/assets/') ||
      p.startsWith('/public/')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

interface InfoMobileResponse {
  CAS?: {
    actif?: boolean;
    casURL?: string;
    jetonCAS?: string;
  };
}

async function fetchInfoMobile(baseUrl: string): Promise<InfoMobileResponse | null> {
  try {
    const res = await fetch(`${baseUrl}${INFO_MOBILE_QUERY}`, {
      headers: { 'User-Agent': MOBILE_UA },
    });
    if (!res.ok) return null;
    return (await res.json()) as InfoMobileResponse;
  } catch {
    return null;
  }
}

async function applyPronoteMobileCookies(
  win: BrowserWindow,
  baseUrl: string,
  deviceUUID: string,
  jetonCAS?: string
): Promise<void> {
  const cookies = win.webContents.session.cookies;
  const parsed = new URL(baseUrl);
  const originUrl = `${parsed.origin}/`;
  const pronotePath = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
  const expValidation = Math.floor(Date.now() / 1000) + 30 * 60; // 30 minutes
  const expLang = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

  const setCookie = async (name: string, value: string, exp: number, cookiePath = '/') => {
    try {
      await cookies.set({
        url: originUrl,
        name,
        value,
        path: cookiePath,
        secure: parsed.protocol === 'https:',
        httpOnly: false,
        sameSite: 'no_restriction',
        expirationDate: exp,
      });
    } catch {
      // Fallback without sameSite restriction if http
      await cookies
        .set({
          url: originUrl,
          name,
          value,
          path: cookiePath,
          httpOnly: false,
          expirationDate: exp,
        })
        .catch(() => {});
    }
  };

  if (jetonCAS) {
    await cookies.remove(originUrl, 'appliMobile').catch(() => {});
    await cookies.remove(`${baseUrl}/`, 'appliMobile').catch(() => {});
    await setCookie('validationAppliMobile', jetonCAS, expValidation, '/');
    await setCookie('validationAppliMobile', jetonCAS, expValidation, pronotePath);
    await setCookie('uuidAppliMobile', deviceUUID, expValidation, '/');
    await setCookie('uuidAppliMobile', deviceUUID, expValidation, pronotePath);
    await setCookie('ielang', '1036', expLang, '/');
  } else {
    await setCookie('appliMobile', '1', expValidation, '/');
    await setCookie('ielang', '1036', expLang, '/');
  }
}

export function startEntLoginFlow(
  parentWindow: BrowserWindow | null,
  options: { mode: EntLoginMode; url?: string; schoolName?: string },
  onStatus: (status: string) => void
): Promise<EntLoginResult> {
  cancelEntLoginWindow();

  return new Promise<EntLoginResult>((resolve, reject) => {
    const deviceUUID = crypto.randomUUID();
    const partition = `ent-login-${Date.now()}`;
    let pronoteBaseUrl: string | null =
      options.mode === 'url' && options.url ? cleanURL(options.url).replace(/\/$/, '') : null;
    let mobileLaunchCount = 0;
    let launchingMobile = false;
    let entDiscoveryAttempted = false;
    let settled = false;

    activeReject = reject;

    const entWin = new BrowserWindow({
      width: 560,
      height: 780,
      minWidth: 440,
      minHeight: 580,
      parent: parentWindow ?? undefined,
      modal: false,
      show: true,
      backgroundColor: '#0A0A0E',
      title:
        options.mode === 'url'
          ? `Noctis — Connexion ${options.schoolName || 'ENT'}`
          : 'Noctis — Connexion Lycée Connecté',
      autoHideMenuBar: true,
      webPreferences: {
        partition,
        preload: path.join(__dirname, 'ent-preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    activeEntWindow = entWin;

    const cleanup = () => {
      ipcMain.removeListener('ent-login:get-device-uuid', handleGetUuid);
      ipcMain.removeListener('ent-login:state', handleState);
      ipcMain.removeListener('ent-login:discovered-url', handleDiscoveredUrl);
      ipcMain.removeListener('ent-login:discovered-uais', handleDiscoveredUais);
      ipcMain.removeListener('ent-login:status-internal', handleStatusInternal);
      activeReject = null;
      if (activeEntWindow === entWin) {
        activeEntWindow = null;
      }
      if (!entWin.isDestroyed()) {
        entWin.close();
      }
    };

    const launchMobilePronoteHandshake = async (targetBaseUrl: string) => {
      if (settled || entWin.isDestroyed() || launchingMobile) return;
      if (mobileLaunchCount >= 4) return;
      launchingMobile = true;
      mobileLaunchCount += 1;

      const cleaned = cleanURL(targetBaseUrl).replace(/\/$/, '');
      pronoteBaseUrl = cleaned;

      onStatus('Établissement PRONOTE détecté — validation de la session…');
      if (!entWin.isDestroyed()) {
        entWin.setTitle('Noctis — Connexion PRONOTE en cours…');
      }

      try {
        const info = await fetchInfoMobile(cleaned);
        const jetonCAS = info?.CAS?.jetonCAS;
        await applyPronoteMobileCookies(entWin, cleaned, deviceUUID, jetonCAS);
        if (!settled && !entWin.isDestroyed()) {
          entWin.webContents.setUserAgent(MOBILE_UA);
          await entWin.loadURL(`${cleaned}/mobile.eleve.html?fd=1`, { userAgent: MOBILE_UA });
        }
      } catch (err) {
        console.error('[ent-login] Failed to load mobile Pronote:', err);
      } finally {
        launchingMobile = false;
      }
    };

    const handleGetUuid = (event: Electron.IpcMainEvent) => {
      if (event.sender === entWin.webContents) {
        event.returnValue = deviceUUID;
      }
    };

    const handleState = (
      event: Electron.IpcMainEvent,
      state: { status?: number; login?: string; mdp?: string } | undefined
    ) => {
      if (settled || event.sender !== entWin.webContents) return;
      if (!state || state.status !== 0 || !state.login || !state.mdp) return;

      const resolvedUrl =
        pronoteBaseUrl || extractPronoteBaseUrl(entWin.webContents.getURL());
      if (!resolvedUrl) return;

      settled = true;
      onStatus('Session PRONOTE récupérée ! Connexion à Noctis…');
      cleanup();
      resolve({
        url: resolvedUrl,
        username: state.login,
        token: state.mdp,
        deviceUUID,
      });
    };

    const handleDiscoveredUrl = (event: Electron.IpcMainEvent, url: string) => {
      if (settled || event.sender !== entWin.webContents) return;
      const base = extractPronoteBaseUrl(url);
      if (base) {
        launchMobilePronoteHandshake(base);
      }
    };

    const handleDiscoveredUais = async (event: Electron.IpcMainEvent, uais: string[]) => {
      if (settled || event.sender !== entWin.webContents || pronoteBaseUrl) return;
      for (const rawUai of uais) {
        const uai = rawUai.trim().toLowerCase();
        if (!/^\d{7}[a-z]$/.test(uai)) continue;
        const candidate = `https://${uai}.index-education.net/pronote`;
        const info = await fetchInfoMobile(candidate);
        if (info && !settled && !pronoteBaseUrl) {
          launchMobilePronoteHandshake(candidate);
          return;
        }
      }
    };

    const handleStatusInternal = (event: Electron.IpcMainEvent, status: string) => {
      if (settled || event.sender !== entWin.webContents) return;
      onStatus(status);
    };

    ipcMain.on('ent-login:get-device-uuid', handleGetUuid);
    ipcMain.on('ent-login:state', handleState);
    ipcMain.on('ent-login:discovered-url', handleDiscoveredUrl);
    ipcMain.on('ent-login:discovered-uais', handleDiscoveredUais);
    ipcMain.on('ent-login:status-internal', handleStatusInternal);

    entWin.on('closed', () => {
      if (!settled) {
        settled = true;
        ipcMain.removeListener('ent-login:get-device-uuid', handleGetUuid);
        ipcMain.removeListener('ent-login:state', handleState);
        ipcMain.removeListener('ent-login:discovered-url', handleDiscoveredUrl);
        ipcMain.removeListener('ent-login:discovered-uais', handleDiscoveredUais);
        ipcMain.removeListener('ent-login:status-internal', handleStatusInternal);
        activeReject = null;
        if (activeEntWindow === entWin) activeEntWindow = null;
        reject(new Error('Fenêtre de connexion fermée avant la fin.'));
      }
    });

    // Intercept ANY navigation, popup, iframe, or redirect pointing toward Pronote
    // (only when we haven't already started the mobile handshake, or when landing on desktop eleve.html)
    const maybePivotToPronote = (candidateUrl: string) => {
      if (settled || launchingMobile) return;
      if (
        candidateUrl.includes('mobile.eleve.html') ||
        candidateUrl.includes('InfoMobileApp.json') ||
        candidateUrl.includes('daCas')
      ) {
        return;
      }
      // If we already know the school URL and launched the mobile flow, don't interrupt ENT/CAS redirects
      if (pronoteBaseUrl && mobileLaunchCount > 0) {
        if (/\/pronote\/eleve\.html/i.test(candidateUrl)) {
          launchMobilePronoteHandshake(pronoteBaseUrl);
        }
        return;
      }
      const detected = extractPronoteBaseUrl(candidateUrl);
      if (detected) {
        launchMobilePronoteHandshake(detected);
      }
    };

    entWin.webContents.setWindowOpenHandler(({ url }) => {
      if (!pronoteBaseUrl) {
        const detected = extractPronoteBaseUrl(url);
        if (detected) {
          launchMobilePronoteHandshake(detected);
          return { action: 'deny' };
        }
      }
      entWin.loadURL(url).catch(() => {});
      return { action: 'deny' };
    });

    entWin.webContents.session.webRequest.onBeforeRequest(
      { urls: ['*://*.index-education.net/*', '*://*/*pronote*'] },
      (details, callback) => {
        if (
          !settled &&
          !launchingMobile &&
          !pronoteBaseUrl &&
          !details.url.includes('mobile.eleve.html') &&
          !details.url.includes('InfoMobileApp.json') &&
          !details.url.includes('daCas') &&
          (details.resourceType === 'mainFrame' || details.resourceType === 'subFrame')
        ) {
          const detected = extractPronoteBaseUrl(details.url);
          if (detected) {
            setTimeout(() => launchMobilePronoteHandshake(detected), 0);
            callback({ cancel: true });
            return;
          }
        }
        callback({});
      }
    );

    entWin.webContents.on('will-navigate', (_e, url) => maybePivotToPronote(url));
    entWin.webContents.on('did-navigate', (_e, url) => maybePivotToPronote(url));
    entWin.webContents.on('did-redirect-navigation', (_e, url) => maybePivotToPronote(url));
    entWin.webContents.on('did-frame-navigate', (_e, url) => maybePivotToPronote(url));

    // Injects an OpenENT discovery script on mon.lyceeconnecte.fr to find the student's Pronote automatically!
    const getLyceeConnecteDiscoveryScript = () => `
      (function () {
        if (window.__noctisEntDiscoveryRan) return;
        window.__noctisEntDiscoveryRan = true;

        // Add subtle top helper bar inside the ENT window
        function showHelperBanner(text) {
          let bar = document.getElementById('__noctis_ent_banner');
          if (!bar && document.body) {
            bar = document.createElement('div');
            bar.id = '__noctis_ent_banner';
            bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2147483647;background:#0D0D14;color:#F4F4F6;border-bottom:1px solid rgba(139,116,255,0.4);padding:10px 16px;font:600 13px/1.4 system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;gap:10px;box-shadow:0 8px 24px rgba(0,0,0,0.6);';
            document.body.prepend(bar);
          }
          if (bar) bar.textContent = text;
        }

        showHelperBanner('Noctis — Connecté à Lycée Connecté ! Détection automatique de votre PRONOTE…');

        function findPronoteInString(str) {
          if (!str || typeof str !== 'string') return null;
          const direct = str.match(/https?:\\/\\/[a-z0-9.-]+\\.index-education\\.net(?:\\/[^\\s"'&<>]*)?/i);
          if (direct) return direct[0];
          const encodedMatch = str.match(/https?%3A%2F%2F[a-z0-9.%-]+\\.index-education\\.net(?:%2F[^\\s"'&<>]*)?/i);
          if (encodedMatch) {
            try {
              return decodeURIComponent(encodedMatch[0]);
            } catch (e) {}
          }
          try {
            const decoded = decodeURIComponent(str);
            const enc = decoded.match(/https?:\\/\\/[a-z0-9.-]+\\.index-education\\.net(?:\\/[^\\s"'&<>]*)?/i);
            if (enc) return enc[0];
          } catch (e) {}
          return null;
        }

        async function discover() {
          // 1) Query OpenENT /appregistry/applications
          try {
            const res = await fetch('/appregistry/applications', { credentials: 'include' });
            if (res.ok) {
              const apps = await res.json();
              const list = Array.isArray(apps) ? apps : (apps && Array.isArray(apps.apps) ? apps.apps : []);
              for (const app of list) {
                const hay = JSON.stringify(app || {});
                const url = findPronoteInString(hay);
                if (url && window.__noctisEntBridge) {
                  showHelperBanner('Noctis — PRONOTE trouvé ! Finalisation de la connexion…');
                  window.__noctisEntBridge.sendDiscoveredPronoteUrl(url);
                  return;
                }
              }
              // Check connector apps mentioning pronote even if address is relative
              const pronoteApp = list.find(function (a) {
                const n = ((a && (a.name || a.displayName || a.address)) || '').toLowerCase();
                return n.includes('pronote');
              });
              if (pronoteApp && pronoteApp.address) {
                showHelperBanner('Noctis — Ouverture automatique de PRONOTE…');
                window.location.assign(pronoteApp.address);
                return;
              }
            }
          } catch (e) {}

          // 2) Query OpenENT userinfo / person API for school UAI codes (e.g. 0330021U)
          const uais = new Set();
          for (const ep of ['/auth/oauth2/userinfo', '/userbook/api/person']) {
            try {
              const r = await fetch(ep, { credentials: 'include' });
              if (r.ok) {
                const txt = await r.text();
                const directUrl = findPronoteInString(txt);
                if (directUrl && window.__noctisEntBridge) {
                  showHelperBanner('Noctis — PRONOTE trouvé ! Finalisation…');
                  window.__noctisEntBridge.sendDiscoveredPronoteUrl(directUrl);
                  return;
                }
                const matches = txt.match(/\\b\\d{7}[A-Za-z]\\b/g);
                if (matches) matches.forEach(function (u) { uais.add(u.toUpperCase()); });
              }
            } catch (e) {}
          }

          if (uais.size > 0 && window.__noctisEntBridge) {
            window.__noctisEntBridge.sendDiscoveredUais(Array.from(uais));
          }

          // 3) Scan DOM links for Pronote
          const anchors = document.querySelectorAll('a[href], iframe[src]');
          for (const el of anchors) {
            const href = el.getAttribute('href') || el.getAttribute('src') || '';
            const found = findPronoteInString(href);
            if (found && window.__noctisEntBridge) {
              showHelperBanner('Noctis — PRONOTE trouvé ! Finalisation…');
              window.__noctisEntBridge.sendDiscoveredPronoteUrl(found);
              return;
            }
          }

          // 4) Fallback instructions if user needs to click their Pronote tile manually
          setTimeout(function () {
            showHelperBanner('Noctis — Cliquez sur votre icône PRONOTE dans Lycée Connecté pour terminer la connexion.');
          }, 2500);
        }

        discover();
      })();
    `;

    const getMobileLoginWatcherScript = () => `
      (function () {
        window.hookAccesDepuisAppli = function () {
          try {
            this.passerEnModeValidationAppliMobile('', ${JSON.stringify(deviceUUID)});
          } catch (e) {}
        };

        if (window.__noctisLoginWatcherInstalled) return;
        window.__noctisLoginWatcherInstalled = true;

        function check() {
          try {
            if (
              window.GInterface &&
              typeof window.GInterface.passerEnModeValidationAppliMobile === 'function' &&
              !window.__noctisTriggeredGInterface
            ) {
              window.__noctisTriggeredGInterface = true;
              window.GInterface.passerEnModeValidationAppliMobile(
                '',
                ${JSON.stringify(deviceUUID)},
                '',
                '',
                '{"model":"Noctis","platform":"android"}'
              );
            }
          } catch (e) {}

          const state = window && window.loginState ? window.loginState : undefined;
          if (state && state.status === 0 && state.login && state.mdp) {
            if (window.__noctisEntBridge) {
              window.__noctisEntBridge.sendLoginState(state);
            }
          }
        }

        check();
        setInterval(check, 350);
      })();
    `;

    const handlePageSettled = () => {
      if (settled || entWin.isDestroyed()) return;
      const currentUrl = entWin.webContents.getURL();

      // Case 1: Arrived on Pronote mobile page -> watch window.loginState
      if (currentUrl.includes('mobile.eleve.html')) {
        onStatus('Authentification PRONOTE validée, récupération de la session…');
        entWin.webContents.executeJavaScript(getMobileLoginWatcherScript()).catch(() => {});
        return;
      }

      // Case 2: User just finished logging into Lycée Connecté and landed on the ENT dashboard!
      // Because lyceeconnecte.fr drops ?callback= on its 301 redirect, we bridge straight to Pronote here!
      if (isAuthenticatedLyceeConnecteUrl(currentUrl)) {
        if (pronoteBaseUrl) {
          onStatus('Connecté à Lycée Connecté ! Retour automatique vers PRONOTE…');
          setTimeout(() => {
            if (!settled && !entWin.isDestroyed() && pronoteBaseUrl) {
              launchMobilePronoteHandshake(pronoteBaseUrl);
            }
          }, 350);
          return;
        }

        if (!entDiscoveryAttempted) {
          entDiscoveryAttempted = true;
          onStatus('Connecté à Lycée Connecté ! Recherche automatique de PRONOTE…');
          entWin.webContents.executeJavaScript(getLyceeConnecteDiscoveryScript()).catch(() => {});
        }
        return;
      }

      // Case 3: Landed on desktop eleve.html -> pivot to mobile handshake
      if (/\/pronote\/eleve\.html/i.test(currentUrl)) {
        const detected = extractPronoteBaseUrl(currentUrl);
        if (detected) {
          launchMobilePronoteHandshake(detected);
        }
      }
    };

    entWin.webContents.on('did-finish-load', handlePageSettled);
    entWin.webContents.on('did-navigate-in-page', handlePageSettled);

    // Launch initial URL based on selected mode
    if (options.mode === 'url' && pronoteBaseUrl) {
      onStatus('Ouverture du portail de votre établissement…');
      launchMobilePronoteHandshake(pronoteBaseUrl);
    } else if (options.mode === 'lyceeconnecte-direct') {
      onStatus('Connectez-vous avec vos identifiants Lycée Connecté…');
      entWin.webContents.setUserAgent(DESKTOP_UA);
      entWin.loadURL(LYCEE_CONNECTE_LOGIN_URL, { userAgent: DESKTOP_UA }).catch((err) => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`Impossible d'ouvrir Lycée Connecté : ${err.message}`));
        }
      });
    } else {
      // Default 1-click Lycée Connecté -> go straight to ÉduConnect SAML SSO (skips regional marketing page!)
      onStatus('Connectez-vous avec ÉduConnect (Lycée Connecté)…');
      entWin.webContents.setUserAgent(DESKTOP_UA);
      entWin.loadURL(LYCEE_CONNECTE_EDUCONNECT_URL, { userAgent: DESKTOP_UA }).catch((err) => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(new Error(`Impossible d'ouvrir ÉduConnect / Lycée Connecté : ${err.message}`));
        }
      });
    }
  });
}
