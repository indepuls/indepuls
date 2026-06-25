// ── RENTABILITÉ PAR AFFAIRE ───────────────────────────────────
// Domaine : une affaire prise individuellement (chantier / mission /
// commande / prestation selon le métier).
//
// Ce module répond à : "Cette affaire est-elle rentable ?"
// Il ne contient aucun calcul de flux mensuel (→ calculs.js),
// aucune logique de planning (→ planning.js), aucun rendu HTML.
//
// Le champ DATA.depenses[].chantierId est la clé de rattachement
// d'une dépense à une affaire. Le nom du champ n'est pas à migrer :
// il est encapsulé ici et ne doit jamais être référencé directement
// en dehors de ce module et des filtres UI nécessaires.

import { getMissionHeures } from './calculs.js';

// ── DÉPENSES LIÉES ────────────────────────────────────────────

// Total des dépenses directes rattachées à une affaire.
export function getDepensesAffaire(DATA, affaireId) {
  return DATA.depenses
    .filter(d => d.chantierId === affaireId)
    .reduce((s, d) => s + (d.montant || 0), 0);
}

// Map affaireId → total (un seul passage sur DATA.depenses).
// Utile quand on calcule les coûts de toutes les affaires d'un coup.
export function getDepensesAffairesMap(DATA) {
  const map = {};
  DATA.depenses.forEach(d => {
    if (d.chantierId) map[d.chantierId] = (map[d.chantierId] || 0) + (d.montant || 0);
  });
  return map;
}

// Filtre les dépenses structurelles (exclut les dépenses liées à une affaire).
// À utiliser dans getDepensesMoyenneMensuelle et tout calcul de charge fixe.
export function excludeDepensesLiees(depenses) {
  return depenses.filter(d => !d.chantierId);
}

// ── CALCULS UNITAIRES ─────────────────────────────────────────

// Marge brute = CA devisé − coûts directs liés.
export function getMargeAffaire(DATA, mission) {
  return (mission.montantDevis || 0) - getDepensesAffaire(DATA, mission.id);
}

// Taux horaire réel = marge brute / heures réellement passées.
// Retourne null si aucune heure n'est renseignée.
export function getTHReelAffaire(DATA, mission) {
  const dep   = getDepensesAffaire(DATA, mission.id);
  const marge = (mission.montantDevis || 0) - dep;
  const h     = getMissionHeures(DATA, mission);
  return h > 0 ? marge / h : null;
}

// Ratio coût direct / CA (0–1). Retourne 0 si pas de devis.
export function getPctCoutAffaire(DATA, mission) {
  const dep = getDepensesAffaire(DATA, mission.id);
  return mission.montantDevis > 0 ? dep / mission.montantDevis : 0;
}

// ── AGRÉGATIONS PORTEFEUILLE ──────────────────────────────────

// Enrichit une liste de missions avec leurs indicateurs de rentabilité.
// Utilise un seul passage sur les dépenses (via getDepensesAffairesMap).
export function getAffairesAvecCouts(DATA, missions) {
  const depMap = getDepensesAffairesMap(DATA);
  return missions.map(m => {
    const dep    = depMap[m.id] || 0;
    const marge  = (m.montantDevis || 0) - dep;
    const h      = getMissionHeures(DATA, m);
    const thReel = h > 0 ? marge / h : null;
    const pctCout = m.montantDevis > 0 ? dep / m.montantDevis : 0;
    return { m, dep, marge, h, thReel, pctCout };
  });
}

// Marge brute moyenne pondérée par CA, sur les affaires avec coûts directs.
// Retourne null si aucune affaire avec coûts.
export function getMargeMoyennePortefeuille(DATA, missions) {
  const avecCouts = getAffairesAvecCouts(DATA, missions).filter(x => x.dep > 0);
  if (!avecCouts.length) return null;
  const totalCA    = avecCouts.reduce((s, x) => s + (x.m.montantDevis || 0), 0);
  const totalMarge = avecCouts.reduce((s, x) => s + x.marge, 0);
  return totalCA > 0 ? totalMarge / totalCA : null;
}
