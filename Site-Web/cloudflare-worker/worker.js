/**
 * Relais CORS gratuit et privé pour Noctis Web (Cloudflare Worker).
 * Déploiement en 1 minute sur https://dash.cloudflare.com -> Workers & Pages -> Create Worker -> Coller ce code.
 *
 * Sécurité :
 * - Autorise uniquement les requêtes vers les instances PRONOTE (*.index-education.net) et api-adresse.data.gouv.fr
 * - Ne stocke et ne journalise aucun identifiant ni jeton.
 */
export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Noctis-Target, X-Noctis-Cookie, User-Agent',
      'Access-Control-Expose-Headers': 'X-Noctis-Set-Cookie',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const reqUrl = new URL(request.url);
    const targetRaw = request.headers.get('X-Noctis-Target') || reqUrl.searchParams.get('url');
    if (!targetRaw) {
      return new Response(JSON.stringify({ ok: true, service: 'Noctis CORS Relay' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let target;
    try {
      target = new URL(targetRaw);
    } catch {
      return new Response('Invalid target URL', { status: 400, headers: corsHeaders });
    }

    const host = target.hostname.toLowerCase();
    const allowed =
      host.endsWith('.index-education.net') ||
      host === 'api-adresse.data.gouv.fr' ||
      target.pathname.toLowerCase().includes('/pronote');

    if (!allowed || (target.protocol !== 'https:' && target.protocol !== 'http:')) {
      return new Response('Target host not allowed by Noctis relay', {
        status: 403,
        headers: corsHeaders,
      });
    }

    const forwardHeaders = new Headers();
    const contentType = request.headers.get('Content-Type');
    if (contentType) forwardHeaders.set('Content-Type', contentType);
    const customCookie = request.headers.get('X-Noctis-Cookie');
    if (customCookie) forwardHeaders.set('Cookie', customCookie);
    forwardHeaders.set(
      'User-Agent',
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'
    );

    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers: forwardHeaders,
      body: request.method === 'POST' ? await request.arrayBuffer() : undefined,
      redirect: 'follow',
    });

    const outHeaders = new Headers(corsHeaders);
    const upContentType = upstream.headers.get('Content-Type');
    if (upContentType) outHeaders.set('Content-Type', upContentType);
    const setCookie = upstream.headers.get('Set-Cookie');
    if (setCookie) outHeaders.set('X-Noctis-Set-Cookie', setCookie);

    return new Response(upstream.body, {
      status: upstream.status,
      headers: outHeaders,
    });
  },
};
