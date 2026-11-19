import DOMPurify from 'dompurify';

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function formatDateFull(iso: string): string {
  const d = new Date(iso);
  const str = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function formatDateRelative(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const startNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round(
    (startTarget.getTime() - startNow.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  if (diffDays === -1) return 'Hier';
  if (diffDays > 1 && diffDays <= 6) {
    const weekday = target.toLocaleDateString('fr-FR', { weekday: 'long' });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} (${formatDateShort(iso)})`;
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

export function toDateKey(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

export function getGradeColorClass(pointsOn20: number): string {
  if (pointsOn20 >= 15) return 'text-emerald-400';
  if (pointsOn20 >= 12) return 'text-sky-400';
  if (pointsOn20 >= 10) return 'text-amber-300';
  return 'text-rose-400';
}

export function normalizeHexColor(hex?: string, fallback = '#8B74FF'): string {
  if (!hex) return fallback;
  const cleaned = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return fallback;
  let r = parseInt(cleaned.slice(0, 2), 16);
  let g = parseInt(cleaned.slice(2, 4), 16);
  let b = parseInt(cleaned.slice(4, 6), 16);

  // Ensure subject accents stay luminous & readable on deep black backgrounds
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance < 0.36) {
    const boost = 0.48 - luminance;
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
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'ul',
      'ol',
      'li',
      'a',
      'span',
      'div',
      'h1',
      'h2',
      'h3',
      'h4',
      'blockquote',
      'hr',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });
}

export function stripHtmlToPreview(html: string, maxLen = 140): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = sanitizeHtml(html);
  const text = (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen).trim()}…`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 18 || hour < 5) return 'Bonsoir';
  return 'Bonjour';
}
