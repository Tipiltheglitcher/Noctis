import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { Fetcher, Request as PawnoteRequest, Response as PawnoteResponse } from '@literate.ink/utilities';

function toPlainHeaders(headers?: Record<string, string> | Headers): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      out[key] = value;
    });
    return out;
  }
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export const mobileFetcher: Fetcher = async (req: PawnoteRequest): Promise<PawnoteResponse> => {
  const method = req.method ?? 'GET';
  const headers = toPlainHeaders(req.headers);

  if (Capacitor.isNativePlatform()) {
    const res = await CapacitorHttp.request({
      url: req.url.toString(),
      method,
      headers,
      data: req.content,
      responseType: 'text',
      disableRedirects: req.redirect === 'manual',
    });

    const lowerHeaders = new Map<string, string>();
    for (const [k, v] of Object.entries(res.headers || {})) {
      lowerHeaders.set(k.toLowerCase(), String(v));
    }

    const content =
      typeof res.data === 'string'
        ? res.data
        : res.data === undefined || res.data === null
        ? ''
        : JSON.stringify(res.data);

    return {
      status: res.status,
      content,
      headers: {
        get: (key: string) => lowerHeaders.get(key.toLowerCase()) ?? null,
      },
    };
  }

  // Browser preview fallback
  const res = await fetch(req.url.toString(), {
    method,
    headers,
    body: method === 'POST' ? req.content : undefined,
    redirect: req.redirect ?? 'follow',
  });
  return {
    status: res.status,
    content: await res.text(),
    headers: res.headers,
  };
};
