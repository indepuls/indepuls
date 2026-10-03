// ── MISSIONS COMMUNES : RÉPARTITION EN POURCENTAGE ENTRE ASSOCIÉ·ES ───────────────────────────
// (2026-10-03, chantier multi-associés). Fonctions PURES, utilisées uniquement par la vue par
// personne d'un compte partagé (getDataPourMembre) : un compte solo n'a jamais de `repartition`.
//
// Une mission commune porte `repartition = { idPersonne: pourcentage, ... }` (somme = 100).
// Dans la vue d'UNE personne, la mission est présentée en ne gardant que SA part : tous les
// montants, temps et encaissements sont multipliés par son pourcentage. Le moteur de calcul n'est
// pas modifié : il reçoit simplement une mission dont les chiffres sont déjà ceux de la personne.
// Dans la vue "tout le compte", la mission reste entière (donc les parts se somment exactement).

export const CHAMPS_NOMBRES = [
  'montantDevis', 'montantMensuel', 'montantVente', 'montantPrestation', 'prixParParticipant',
  'heuresSaisies', 'timerAccumulated', 'chargeEstimee', 'tempsPrevu',
  'tempsCreation', 'tempsAnimation', 'tempsSupport',
];

const arrondi = (n) => Math.round(n * 100) / 100;
const copie = (v) => JSON.parse(JSON.stringify(v));

export function aRepartition(m) {
  return !!(m && m.repartition && typeof m.repartition === 'object' && Object.keys(m.repartition).length > 0);
}

// Pourcentage de la personne sur la mission (0 si elle n'y participe pas).
export function partDe(m, id) {
  if (!aRepartition(m)) return null;
  const p = Number(m.repartition[id]);
  return Number.isFinite(p) && p > 0 ? p : 0;
}

// Copie de la mission réduite à la part `pct` (0..100) d'une personne.
export function partMission(m, pct) {
  const f = pct / 100;
  const c = copie(m);
  CHAMPS_NOMBRES.forEach((k) => { if (typeof c[k] === 'number') c[k] = arrondi(c[k] * f); });
  (c.tempsManuel || []).forEach((e) => { if (typeof e.ms === 'number') e.ms = Math.round(e.ms * f); });
  (c.encaissements || []).forEach((e) => {
    if (typeof e.montant === 'number') e.montant = arrondi(e.montant * f);
    if (typeof e.montantTTC === 'number') e.montantTTC = arrondi(e.montantTTC * f);
  });
  (c.tempsPrevuHistorique || []).forEach((h) => { if (typeof h.valeur === 'number') h.valeur = arrondi(h.valeur * f); });
  c._partPct = pct; // pour l'affichage ("votre part : 50 %"), jamais lu par le moteur
  return c;
}

// Validation d'une répartition saisie : pourcentages positifs, somme égale à 100 (tolérance 0,01).
export function verifierRepartition(rep) {
  const ids = Object.keys(rep || {});
  const valeurs = ids.map((i) => Number(rep[i]));
  if (ids.length < 2) return { ok: false, total: valeurs.reduce((s, v) => s + (v || 0), 0), raison: 'Au moins deux personnes.' };
  if (valeurs.some((v) => !Number.isFinite(v) || v < 0)) return { ok: false, total: NaN, raison: 'Pourcentages invalides.' };
  const total = valeurs.reduce((s, v) => s + v, 0);
  if (Math.abs(total - 100) > 0.01) return { ok: false, total, raison: 'Le total doit faire 100 %.' };
  return { ok: true, total };
}

// Répartition égale proposée par défaut (la dernière personne absorbe l'arrondi).
export function repartitionEgale(ids) {
  const n = ids.length;
  const base = Math.floor((100 / n) * 100) / 100;
  const rep = {};
  ids.forEach((id, i) => { rep[id] = i === n - 1 ? arrondi(100 - base * (n - 1)) : base; });
  return rep;
}
