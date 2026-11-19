import { app, shell } from 'electron';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { UpdateInfoDTO, UpdateProgressDTO } from '../shared/types';

export const GITHUB_OWNER = 'Tipiltheglitcher';
export const GITHUB_REPO = 'Noctis';
const LATEST_RELEASE_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const RELEASES_PAGE_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

function parseVersion(raw: string): [number, number, number] {
  const cleaned = raw.trim().replace(/^v/i, '').split('-')[0];
  const parts = cleaned.split('.').map((n) => parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}

export function isNewerVersion(latest: string, current: string): boolean {
  const [lMaj, lMin, lPat] = parseVersion(latest);
  const [cMaj, cMin, cPat] = parseVersion(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

interface GitHubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubReleaseResponse {
  tag_name: string;
  name?: string;
  body?: string;
  html_url?: string;
  published_at?: string;
  assets?: GitHubReleaseAsset[];
}

export async function checkForGitHubUpdate(): Promise<UpdateInfoDTO> {
  const currentVersion = app.getVersion();
  try {
    const res = await fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `Noctis-Desktop/${currentVersion}`,
      },
    });

    if (res.status === 404) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseUrl: RELEASES_PAGE_URL,
      };
    }

    if (!res.ok) {
      return {
        updateAvailable: false,
        currentVersion,
        latestVersion: currentVersion,
        releaseUrl: RELEASES_PAGE_URL,
        error: `GitHub API (${res.status})`,
      };
    }

    const data = (await res.json()) as GitHubReleaseResponse;
    const latestTag = data.tag_name || currentVersion;
    const latestVersion = latestTag.replace(/^v/i, '');
    const assets = data.assets ?? [];

    const setupAsset =
      assets.find((a) => /setup.*\.exe$/i.test(a.name)) ||
      assets.find((a) => /\.exe$/i.test(a.name));

    const updateAvailable = isNewerVersion(latestVersion, currentVersion);

    return {
      updateAvailable,
      currentVersion,
      latestVersion,
      releaseName: data.name || `Noctis v${latestVersion}`,
      releaseNotes: data.body || '',
      publishedAt: data.published_at,
      downloadUrl: setupAsset?.browser_download_url,
      assetName: setupAsset?.name,
      assetSize: setupAsset?.size,
      releaseUrl: data.html_url || RELEASES_PAGE_URL,
    };
  } catch (err) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseUrl: RELEASES_PAGE_URL,
      error: err instanceof Error ? err.message : 'Erreur réseau',
    };
  }
}

export async function downloadAndRunInstaller(
  downloadUrl: string,
  assetName: string,
  onProgress: (p: UpdateProgressDTO) => void
): Promise<{ ok: boolean; error?: string }> {
  try {
    const safeName = path.basename(assetName || 'Noctis-Setup.exe');
    if (!/\.exe$/i.test(safeName)) {
      await shell.openExternal(downloadUrl);
      return { ok: true };
    }

    const destPath = path.join(app.getPath('temp'), safeName);
    const res = await fetch(downloadUrl, {
      headers: { 'User-Agent': `Noctis-Desktop/${app.getVersion()}` },
    });

    if (!res.ok || !res.body) {
      return { ok: false, error: `Impossible de télécharger la mise à jour (HTTP ${res.status}).` };
    }

    const totalBytes = Number(res.headers.get('content-length') || 0);
    let downloadedBytes = 0;

    const writer = fs.createWriteStream(destPath);
    const reader = res.body.getReader();

    await new Promise<void>((resolve, reject) => {
      writer.on('error', reject);
      (async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              downloadedBytes += value.byteLength;
              if (!writer.write(Buffer.from(value))) {
                await new Promise<void>((r) => writer.once('drain', r));
              }
              const percent =
                totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
              onProgress({ percent, downloadedBytes, totalBytes });
            }
          }
          writer.end(() => resolve());
        } catch (e) {
          writer.destroy();
          reject(e);
        }
      })();
    });

    onProgress({ percent: 100, downloadedBytes, totalBytes: totalBytes || downloadedBytes });

    // Launch the NSIS installer detached and quit Noctis so it can replace files cleanly
    const child = spawn(destPath, [], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    setTimeout(() => {
      app.quit();
    }, 600);

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Erreur lors du téléchargement.',
    };
  }
}
