import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { AppSettings, OfflineCacheSnapshot } from '../shared/types';

export interface SavedAuthData {
  url: string;
  username: string;
  token: string;
  deviceUUID: string;
  kind: number;
  navigatorIdentifier?: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  accent: 'violet',
  notificationsEnabled: true,
  refreshIntervalMinutes: 10,
};

function getSessionPath(): string {
  return path.join(app.getPath('userData'), 'noctis-session.dat');
}

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'noctis-settings.json');
}

export function saveAuthSession(data: SavedAuthData): void {
  const payload = JSON.stringify(data);
  const filePath = getSessionPath();

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(payload);
    fs.writeFileSync(
      filePath,
      JSON.stringify({ encrypted: true, data: encrypted.toString('base64') }),
      'utf8'
    );
  } else {
    fs.writeFileSync(
      filePath,
      JSON.stringify({ encrypted: false, data: Buffer.from(payload, 'utf8').toString('base64') }),
      'utf8'
    );
  }
}

export function loadAuthSession(): SavedAuthData | null {
  const filePath = getSessionPath();
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
      encrypted: boolean;
      data: string;
    };
    const buf = Buffer.from(raw.data, 'base64');
    const json = raw.encrypted
      ? safeStorage.decryptString(buf)
      : buf.toString('utf8');
    const parsed = JSON.parse(json) as SavedAuthData;
    if (!parsed.url || !parsed.username || !parsed.token || !parsed.deviceUUID) {
      return null;
    }
    return parsed;
  } catch (err) {
    console.error('[storage] Failed to load saved session:', err);
    return null;
  }
}

export function clearAuthSession(): void {
  const filePath = getSessionPath();
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
}

export function loadSettings(): AppSettings {
  const filePath = getSettingsPath();
  if (!fs.existsSync(filePath)) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<AppSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(partial: Partial<AppSettings>): AppSettings {
  const current = loadSettings();
  const next: AppSettings = { ...current, ...partial };
  fs.writeFileSync(getSettingsPath(), JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function getOfflineCachePath(): string {
  return path.join(app.getPath('userData'), 'noctis-cache.json');
}

export function loadOfflineCache(): OfflineCacheSnapshot | null {
  const filePath = getOfflineCachePath();
  if (!fs.existsSync(filePath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as OfflineCacheSnapshot;
    if (!parsed || !parsed.profile) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOfflineCache(snapshot: OfflineCacheSnapshot): void {
  try {
    fs.writeFileSync(getOfflineCachePath(), JSON.stringify(snapshot), 'utf8');
  } catch (err) {
    console.warn('[storage] Failed to persist offline cache:', err);
  }
}

export function clearOfflineCache(): void {
  const filePath = getOfflineCachePath();
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
}
