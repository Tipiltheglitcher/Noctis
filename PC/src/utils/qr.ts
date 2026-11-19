import jsQR from 'jsqr';

export interface PronoteQRPayload {
  jeton: string;
  login: string;
  url: string;
}

export function parsePronoteQRText(raw: string): PronoteQRPayload | null {
  try {
    const parsed = JSON.parse(raw.trim()) as Partial<PronoteQRPayload>;
    if (
      typeof parsed.jeton === 'string' &&
      typeof parsed.login === 'string' &&
      typeof parsed.url === 'string' &&
      parsed.jeton.length > 0 &&
      parsed.login.length > 0 &&
      parsed.url.length > 0
    ) {
      return {
        jeton: parsed.jeton,
        login: parsed.login,
        url: parsed.url,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function scanCanvas(canvas: HTMLCanvasElement): string | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  });
  return result?.data ?? null;
}

export async function decodeQRFromImageBlob(blob: Blob): Promise<PronoteQRPayload | null> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image invalide'));
      el.src = url;
    });

    // Try multiple scales for crisp decoding on both tiny crops and 4K screenshots
    const scales = [1, 0.75, 0.5, 1.5];
    for (const scale of scales) {
      const w = Math.max(64, Math.min(2000, Math.round(img.naturalWidth * scale)));
      const h = Math.max(64, Math.min(2000, Math.round(img.naturalHeight * scale)));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const raw = scanCanvas(canvas);
      if (raw) {
        const parsed = parsePronoteQRText(raw);
        if (parsed) return parsed;
      }
    }

    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function decodeQRFromVideoFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): PronoteQRPayload | null {
  if (video.readyState !== video.HAVE_ENOUGH_DATA) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const raw = scanCanvas(canvas);
  if (!raw) return null;
  return parsePronoteQRText(raw);
}
