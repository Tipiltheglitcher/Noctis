/**
 * Noctis Web — Relais CORS sans état (Cloudflare Worker)
 * ------------------------------------------------------------------
 * Transmet les requêtes chiffrées entre Noctis Web (GitHub Pages)
 * et les serveurs PRONOTE des établissements scolaires français.
 *
 * Confidentialité :
 *  - Aucune base de données, aucun stockage KV/R2/D1.
 *  - Aucun mot de passe, cookie ou contenu scolaire n'est journalisé.
 *  - Seuls les serveurs PRONOTE (HTTPS) et l'origine Noctis officielle
 *    sont autorisés.
 */

const ALLOWED_ORIGINS = [
  'https://tipiltheglitcher.github.io',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return true;
  return false;
}

function isPrivateOrBlockedHost(hostname) {
  const h = hostname.toLowerCase();
  if (
    h === 'localhost' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(h) ||
    /^\[/.test(h)
  ) {
    return true;
  }
  return false;
}

function isAllowedTarget(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (isPrivateOrBlockedHost(parsed.hostname)) return null;

  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname.toLowerCase();

  const allowed =
    host === 'www.index-education.com' ||
    host === 'index-education.net' ||
    host.endsWith('.index-education.net') ||
    path.includes('/pronote');

  return allowed ? parsed : null;
}

function buildCorsHeaders(origin) {
  const headers = new Headers();
  if (origin && isAllowedOrigin(origin)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, X-Noctis-Target, X-Noctis-Cookie'
  );
  headers.set('Access-Control-Expose-Headers', 'X-Noctis-Set-Cookie, Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  return headers;
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const cors = buildCorsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    const rawTarget = request.headers.get('X-Noctis-Target');
    if (!rawTarget) {
      cors.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(
        JSON.stringify({
          ok: true,
          service: 'noctis-relay',
          privacy: 'stateless-zero-storage',
        }),
        { status: 200, headers: cors }
      );
    }

    if (origin && !isAllowedOrigin(origin)) {
      cors.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(
        JSON.stringify({ error: 'Origine non autorisée.' }),
        { status: 403, headers: cors }
      );
    }

    const targetUrl = isAllowedTarget(rawTarget);
    if (!targetUrl) {
      cors.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(
        JSON.stringify({ error: 'Serveur cible non autorisé (PRONOTE HTTPS uniquement).' }),
        { status: 403, headers: cors }
      );
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Méthode non autorisée.' }), {
        status: 405,
        headers: cors,
      });
    }

    const upstreamHeaders = new Headers();
    upstreamHeaders.set(
      'User-Agent',
      'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
    );
    upstreamHeaders.set('Accept', 'application/json, text/html, */*');

    const ct = request.headers.get('Content-Type');
    if (ct) upstreamHeaders.set('Content-Type', ct);

    const cookie = request.headers.get('X-Noctis-Cookie');
    if (cookie) upstreamHeaders.set('Cookie', cookie);

    try {
      const upstream = await fetch(targetUrl.toString(), {
        method: request.method,
        headers: upstreamHeaders,
        body: request.method === 'POST' ? request.body : undefined,
        redirect: 'follow',
      });

      const respHeaders = new Headers(cors);
      const respCt = upstream.headers.get('Content-Type');
      if (respCt) respHeaders.set('Content-Type', respCt);

      const cookies =
        typeof upstream.headers.getSetCookie === 'function'
          ? upstream.headers.getSetCookie()
          : [];
      const combinedSetCookie =
        cookies.length > 0 ? cookies.join(', ') : upstream.headers.get('Set-Cookie');
      if (combinedSetCookie) {
        respHeaders.set('X-Noctis-Set-Cookie', combinedSetCookie);
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: respHeaders,
      });
    } catch {
      cors.set('Content-Type', 'application/json; charset=utf-8');
      return new Response(
        JSON.stringify({ error: 'Impossible de joindre le serveur PRONOTE.' }),
        { status: 502, headers: cors }
      );
    }
  },
};
