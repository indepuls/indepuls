// ── UTILITAIRES PURS ─────────────────────────────────────────
// Fonctions sans effet de bord, sans dépendance sur DATA.
// Identiques dans freelance et artisan — source unique.

export function fmt(n, d = 0) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtE(n, d) {
  const v = Number(n || 0);
  const dec = d !== undefined ? d : (v % 1 !== 0 ? 2 : 0);
  return fmt(v, dec) + ' €';
}

export function uuid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function getCurrentMk() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getMonthKey(s) {
  return s ? s.slice(0, 7) : null;
}

export function monthLabel(k) {
  const [y, m] = k.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

export function monthLabelFull(k) {
  const [y, m] = k.split('-');
  return new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

export function heuresMs(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sc).padStart(2, '0')}`;
}

export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function themeColor(v) {
  return getComputedStyle(document.body).getPropertyValue(v).trim();
}
