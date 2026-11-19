import DOMPurify from 'dompurify';

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatDateFull(iso: string): string {
  const s = new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatDateRelative(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const diff = Math.round(
    (new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86_400_000
  );
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 1 && diff <= 6) {
    const w = target.toLocaleDateString('fr-FR', { weekday: 'long' });
    return `${w.charAt(0).toUpperCase() + w.slice(1)} (${formatDateShort(iso)})`;
  }
  return formatDateFull(iso);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function toDateKey(d: Date | string): string {
  const dt = typeof d === 'string' ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate()
  ).padStart(2, '0')}`;
}

export function formatGradeNumber(val?: number): string {
  if (val === undefined || Number.isNaN(val)) return '—';
  return val.toFixed(2).replace(/\.00$/, '').replace('.', ',');
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function getGradeColorClass(on20: number): string {
  if (on20 >= 15) return 'text-emerald-400';
  if (on20 >= 12) return 'text-sky-400';
  if (on20 >= 10) return 'text-amber-300';
  return 'text-rose-400';
}

export function normalizeHexColor(hex?: string, fallback = '#8B74FF'): string {
  if (!hex) return fallback;
  const cleaned = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return fallback;
  let r = parseInt(cleaned.slice(0, 2), 16);
  let g = parseInt(cleaned.slice(2, 4), 16);
  let b = parseInt(cleaned.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum < 0.36) {
    const boost = 0.48 - lum;
    r = Math.min(255, Math.round(r + (255 - r) * boost * 1.4));
    g = Math.min(255, Math.round(g + (255 - g) * boost * 1.4));
    b = Math.min(255, Math.round(b + (255 - b) * boost * 1.4));
  }
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}`;
}

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'span', 'div', 'h3', 'h4'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

export function stripHtml(html: string, maxLen = 120): string {
  const div = document.createElement('div');
  div.innerHTML = sanitizeHtml(html);
  const text = (div.textContent || '').replace(/\s+/g, ' ').trim();
  return text.length > maxLen ? `${text.slice(0, maxLen).trim()}…` : text;
}
