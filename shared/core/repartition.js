// ── MISSIONS COMMUNES : RÉPARTITION EN POURCENTAGE ENTRE ASSOCIÉ·ES ───────────────────────────
// (2026-10-03, chantier multi-associés). Fonctions PURES, utilisées uniquement par la vue par
// personne d'un compte partagé (getDataPourMembre) : un compte solo n'a jamais de `repartition`.
//
// Une mission commune porte `repartition = { idPersonne: pourcentage, ... }` (somme = 100).
// Dans la vue d'UNE personne, la mission est présentée ainsi (le moteur de calcul n'est pas modifié : il
// reçoit une mission dont les chiffres sont déjà ceux de la personne) :
//   - l'ARGENT est réparti selon son pourcentage : montants, encaissements ;
//   - le TEMPS RÉEL n'est jamais réparti : c'est du temps travaillé, il appartient à qui l'a saisi. Une
//     personne ne voit que SES saisies (tempsManuel.auteurId). Le temps sans auteur (chrono, heures
//     saisies, entrées d'avant le partage) revient à l'auteur de la mission, à défaut au propriétaire ;
//   - le temps PRÉVU (charge estimée, temps estimé) est un plan : réparti selon son pourcentage.
// Dans la vue "tout le compte", la mission reste entière (donc les parts d'argent se somment exactement).

// Argent : réparti selon le pourcentage.
export const CHAMPS_ARGENT = ['montantDevis', 'montantMensuel', 'montantVente', 'montantPrestation', 'prixParParticipant'];
// Temps PRÉVU (un plan, pas du temps travaillé) : réparti selon le pourcentage.
export const CHAMPS_TEMPS_PREVU = ['chargeEstimee', 'tempsPrevu', 'tempsCreation', 'tempsAnimation', 'tempsSupport'];
// Temps RÉEL sans auteur (scalaires) : attribué à la personne qui porte la mission, jamais réparti.
export const CHAMPS_TEMPS_REEL_SANS_AUTEUR = ['heuresSaisies', 'timerAccumulated'];

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

// Copie de la mission vue par la personne `id` : argent et temps prévu à hauteur de `pct` (0..100), temps
// réel selon qui l'a travaillé (voir l'en-tête). `proprietaireId` : à qui revient le temps sans auteur quand la
// mission n'a pas d'auteur ; s'il est inconnu, le temps sans auteur est réparti selon `pct` (ancien comportement).
export function partMission(m, pct, id, proprietaireId) {
  const f = pct / 100;
  const c = copie(m);
  CHAMPS_ARGENT.concat(CHAMPS_TEMPS_PREVU).forEach((k) => { if (typeof c[k] === 'number') c[k] = arrondi(c[k] * f); });
  const porteur = m.auteurId || proprietaireId || null;   // qui porte le temps sans auteur
  if (porteur) {
    const aMoi = id === porteur;
    c.tempsManuel = (c.tempsManuel || []).filter((e) => (e.auteurId ? e.auteurId === id : aMoi));
    CHAMPS_TEMPS_REEL_SANS_AUTEUR.forEach((k) => { if (typeof c[k] === 'number' && !aMoi) c[k] = 0; });
    if (!aMoi) { c.timerRunning = false; c.timerStart = null; }   // un chrono en cours appartient à la personne qui le porte
  } else {
    (c.tempsManuel || []).forEach((e) => { if (!e.auteurId && typeof e.ms === 'number') e.ms = Math.round(e.ms * f); });
    c.tempsManuel = (c.tempsManuel || []).filter((e) => !e.auteurId || e.auteurId === id);
    CHAMPS_TEMPS_REEL_SANS_AUTEUR.forEach((k) => { if (typeof c[k] === 'number') c[k] = arrondi(c[k] * f); });
  }
  (c.encaissements || []).forEach((e) => {
    if (typeof e.montant === 'number') e.montant = arrondi(e.montant * f);
    if (typeof e.montantTTC === 'number') e.montantTTC = arrondi(e.montantTTC * f);
  });
  (c.tempsPrevuHistorique || []).forEach((h) => { if (typeof h.valeur === 'number') h.valeur = arrondi(h.valeur * f); });
  c._partPct = pct; // pour l'affichage ("votre part : 50 %"), jamais lu par le moteur
  return c;
}

// Dépense commune : montant (et TVA déductible) réduits à la part de la personne.
export function partDepense(d, pct) {
  const f = pct / 100;
  const c = copie(d);
  ['montant', 'montantTVA'].forEach((k) => { if (typeof c[k] === 'number') c[k] = arrondi(c[k] * f); });
  c._partPct = pct;
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
