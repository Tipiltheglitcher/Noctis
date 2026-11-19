/**
 * URL par défaut du relais CORS Cloudflare Worker (optionnel).
 * Une fois ton Cloudflare Worker déployé (Site-Web/cloudflare-worker/worker.js),
 * colle son URL ici (ex: "https://noctis-relay.ton-compte.workers.dev") et pousse sur GitHub :
 * tous tes potes pourront alors se connecter sur Noctis Web sans aucune configuration !
 */
export const DEFAULT_RELAY_URL = '';

const RELAY_STORAGE_KEY = 'noctis_web_relay_url';

export function getRelayUrl(): string {
  try {
    const saved = localStorage.getItem(RELAY_STORAGE_KEY)?.trim();
    if (saved) return saved.replace(/\/$/, '');
  } catch {
    // ignore
  }
  return DEFAULT_RELAY_URL.trim().replace(/\/$/, '');
}

export function setRelayUrl(url: string): void {
  try {
    const cleaned = url.trim().replace(/\/$/, '');
    if (cleaned) {
      localStorage.setItem(RELAY_STORAGE_KEY, cleaned);
    } else {
      localStorage.removeItem(RELAY_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}
