import jsQR from 'jsqr';

export interface PronoteQRPayload {
  jeton: string;
  login: string;
  url: string;
}

export function parsePronoteQRText(raw: string): PronoteQRPayload | null {
  try {
    const parsed = JSON.parse(raw.trim()) as Partial<PronoteQRPayload>;
    if (parsed.jeton && parsed.login && parsed.url) {
      return { jeton: parsed.jeton, login: parsed.login, url: parsed.url };
    }
    return null;
  } catch {
    return null;
  }
}

export async function decodeQRFromBlob(blob: Blob): Promise<PronoteQRPayload | null> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image invalide'));
      el.src = url;
    });

    for (const scale of [1, 0.65, 0.4, 1.4]) {
      const w = Math.max(64, Math.min(1800, Math.round(img.naturalWidth * scale)));
      const h = Math.max(64, Math.min(1800, Math.round(img.naturalHeight * scale)));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const res = jsQR(data.data, w, h, { inversionAttempts: 'attemptBoth' });
      if (res?.data) {
        const parsed = parsePronoteQRText(res.data);
        if (parsed) return parsed;
      }
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function decodeQRFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement
): PronoteQRPayload | null {
  if (video.readyState !== video.HAVE_ENOUGH_DATA) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const res = jsQR(data.data, canvas.width, canvas.height, {
    inversionAttempts: 'attemptBoth',
  });
  return res?.data ? parsePronoteQRText(res.data) : null;
}
