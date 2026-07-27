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

// Semaine ISO 8601 (lundi-dimanche, la semaine 01 est celle qui contient le 4 janvier) —
// chantier "brief hebdomadaire par email" (2026-07-27), fondation du snapshot hebdo. Extraite
// ici (plutôt que locale à indepuls.html) car cette même clé doit pouvoir être recalculée à
// l'identique côté serveur (cron) plus tard, sans dupliquer l'algorithme une seconde fois.
export function getWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7; // lundi=0 … dimanche=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // jeudi de cette semaine
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const weekNum = 1 + Math.round((date - firstThursday) / (7 * 24 * 3600 * 1000));
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
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
