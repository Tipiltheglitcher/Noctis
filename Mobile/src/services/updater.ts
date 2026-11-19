import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import type { MobileUpdateInfo } from '@/types';

const GITHUB_OWNER = 'Tipiltheglitcher';
const GITHUB_REPO = 'Noctis';
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const RELEASES_PAGE = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

function parseVer(raw: string): [number, number, number] {
  const clean = raw.trim().replace(/^v/i, '').split('-')[0];
  const p = clean.split('.').map((n) => parseInt(n, 10) || 0);
  return [p[0] || 0, p[1] || 0, p[2] || 0];
}

function isNewer(latest: string, current: string): boolean {
  const [a1, a2, a3] = parseVer(latest);
  const [b1, b2, b3] = parseVer(current);
  if (a1 !== b1) return a1 > b1;
  if (a2 !== b2) return a2 > b2;
  return a3 > b3;
}

export function getAppVersion(): string {
  return typeof __NOCTIS_VERSION__ !== 'undefined' ? __NOCTIS_VERSION__ : '1.0.0';
}

export async function checkMobileUpdate(): Promise<MobileUpdateInfo> {
  const currentVersion = getAppVersion();
  try {
    let status = 200;
    let data: {
      tag_name?: string;
      body?: string;
      html_url?: string;
      assets?: Array<{ name: string; size: number; browser_download_url: string }>;
    };

    if (Capacitor.isNativePlatform()) {
      const res = await CapacitorHttp.get({
        url: LATEST_RELEASE_API,
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': `Noctis-Android/${currentVersion}`,
        },
      });
      status = res.status;
      data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
    } else {
      const res = await fetch(LATEST_RELEASE_API, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      status = res.status;
      data = status === 200 ? await res.json() : {};
    }

    if (status === 404) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseUrl: RELEASES_PAGE,
      };
    }

    if (status < 200 || status >= 300) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseUrl: RELEASES_PAGE,
        error: `GitHub API (${status})`,
      };
    }

    const latestVersion = (data.tag_name || currentVersion).replace(/^v/i, '');
    const apkAsset = (data.assets ?? []).find((a) => /\.apk$/i.test(a.name));

    return {
      updateAvailable: isNewer(latestVersion, currentVersion),
      currentVersion,
      latestVersion,
      releaseNotes: data.body || '',
      apkUrl: apkAsset?.browser_download_url,
      apkName: apkAsset?.name,
      apkSize: apkAsset?.size,
      releaseUrl: data.html_url || RELEASES_PAGE,
    };
  } catch (err) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseUrl: RELEASES_PAGE,
      error: err instanceof Error ? err.message : 'Erreur réseau',
    };
  }
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return;
  if (Capacitor.isNativePlatform()) {
    await Browser.open({ url });
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}
