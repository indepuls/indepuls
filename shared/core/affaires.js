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

// Prix de référence d'une mission — montantMensuel pour une récurrente, montantDevis sinon.
// Note (2026-07) : pour une récurrente déjà active depuis plusieurs mois, ce n'est qu'UN mois
// de prix, pas le CA cumulé (voir getCaRecurrenteADate dans calculs.js pour ça) — ces 4
// fonctions ne sont aujourd'hui appelées nulle part dans indepuls.html (code mort mais public
// via le bridge), donc corrigé pour ne plus renvoyer un prix systématiquement faux/nul sur une
// récurrente, sans reconstruire ici la logique de cumul (hors scope tant que rien ne l'utilise).
function _prixMission(mission) {
  return mission.isRecurring ? (mission.montantMensuel || 0) : (mission.montantDevis || 0);
}

// Marge brute = prix − coûts directs liés.
export function getMargeAffaire(DATA, mission) {
  return _prixMission(mission) - getDepensesAffaire(DATA, mission.id);
}

// Taux horaire réel = marge brute / heures réellement passées.
// Retourne null si aucune heure n'est renseignée.
export function getTHReelAffaire(DATA, mission) {
  const dep   = getDepensesAffaire(DATA, mission.id);
  const marge = _prixMission(mission) - dep;
  const h     = getMissionHeures(DATA, mission);
  return h > 0 ? marge / h : null;
}

// Ratio coût direct / CA (0–1). Retourne 0 si pas de prix.
export function getPctCoutAffaire(DATA, mission) {
  const dep = getDepensesAffaire(DATA, mission.id);
  const prix = _prixMission(mission);
  return prix > 0 ? dep / prix : 0;
}

// ── AGRÉGATIONS PORTEFEUILLE ──────────────────────────────────

// Enrichit une liste de missions avec leurs indicateurs de rentabilité.
// Utilise un seul passage sur les dépenses (via getDepensesAffairesMap).
export function getAffairesAvecCouts(DATA, missions) {
  const depMap = getDepensesAffairesMap(DATA);
  return missions.map(m => {
    const dep    = depMap[m.id] || 0;
    const prix   = _prixMission(m);
    const marge  = prix - dep;
    const h      = getMissionHeures(DATA, m);
    const thReel = h > 0 ? marge / h : null;
    const pctCout = prix > 0 ? dep / prix : 0;
    return { m, dep, marge, h, thReel, pctCout };
  });
}

// Marge brute moyenne pondérée par CA, sur les affaires avec coûts directs.
// Retourne null si aucune affaire avec coûts.
export function getMargeMoyennePortefeuille(DATA, missions) {
  const avecCouts = getAffairesAvecCouts(DATA, missions).filter(x => x.dep > 0);
  if (!avecCouts.length) return null;
  const totalCA    = avecCouts.reduce((s, x) => s + _prixMission(x.m), 0);
  const totalMarge = avecCouts.reduce((s, x) => s + x.marge, 0);
  return totalCA > 0 ? totalMarge / totalCA : null;
}

// ── LOTS D'INVESTISSEMENT (achat_revente) ─────────────────────
// Domaine : un lot regroupe plusieurs dépenses (achat groupé, livraison, réparation...) et
// plusieurs ventes distinctes (mission.lotId) — répond à "ce lot est-il rentabilisé ?", à la
// différence d'une affaire prise isolément (ci-dessus, une seule mission). Retour bêta Pauline
// (achat-revente), 2026-07 : achète des lots de produits groupés, revend chaque produit
// séparément — veut suivre coût/CA/marge par lot, pas de gestion de stock article par article.
//
// Rattachement : DATA.depenses[].lotId (dépense liée au lot dans son ensemble) et
// DATA.depenses[].chantierId (déjà existant — dépense liée à UNE vente précise, mutuellement
// exclusif avec lotId dans l'usage). DATA.missions[].lotId (vente appartenant au lot). Le retour
// d'une vente (DATA.retours[].missionId) n'a pas de lotId propre — il se retrouve via sa vente.

// CA reconnu d'une vente confirmée — même logique de repli (encaissements détaillés, sinon
// dateFact) que le reste du moteur pour achat_revente/fabrication.
function getCaVenteReconnu(m) {
  const encs = m.encaissements || [];
  if (encs.length > 0) return encs.reduce((a, e) => a + (parseFloat(e.montant) || 0), 0);
  return m.statut === 'fact' ? (m.montantDevis || 0) : 0;
}

export function getVentesDuLot(DATA, lotId) {
  return DATA.missions.filter(m => !m.isManagement && m.lotId === lotId);
}

export function getCoutTotalLot(DATA, lotId) {
  const ventesIds = new Set(getVentesDuLot(DATA, lotId).map(m => m.id));
  return (DATA.depenses || []).reduce((s, d) => {
    if (d.lotId === lotId) return s + (d.montant || 0);
    if (d.chantierId && ventesIds.has(d.chantierId)) return s + (d.montant || 0);
    return s;
  }, 0);
}

export function getCaBrutLot(DATA, lotId) {
  return getVentesDuLot(DATA, lotId)
    .filter(m => m.statut === 'fact')
    .reduce((s, m) => s + getCaVenteReconnu(m), 0);
}

// 0 tant que DATA.retours n'existe pas (chantier retours/statuts non livré) — pas de duplication
// de logique, pas de blocage.
export function getRemboursementsLot(DATA, lotId) {
  const ventesIds = new Set(getVentesDuLot(DATA, lotId).map(m => m.id));
  return (DATA.retours || [])
    .filter(r => r.statut === 'rembourse' && ventesIds.has(r.missionId))
    .reduce((s, r) => s + (r.montant || 0), 0);
}

// Point d'entrée unique pour tous les chiffres d'un lot (fiche lot, liste des lots) — jamais
// de duplication de cette logique ailleurs.
export function getLotStats(DATA, lotId) {
  const lot = (DATA.lots || []).find(l => l.id === lotId);
  const coutTotal = getCoutTotalLot(DATA, lotId);
  const caBrut = getCaBrutLot(DATA, lotId);
  const remboursements = getRemboursementsLot(DATA, lotId);
  const revenusNets = caBrut - remboursements;
  const resultat = revenusNets - coutTotal;
  const pourcentRecupere = coutTotal > 0 ? (revenusNets / coutTotal) * 100 : null;
  // Même convention que getRentabComparateur() (Missions, objectif "marge de chaque commande") :
  // marge = (CA - coûts) / CA × 100. Ici CA = revenusNets (déjà net des retours remboursés),
  // pour rester cohérent avec "Résultat" juste à côté, qui est lui aussi calculé sur revenusNets.
  const margePct = revenusNets > 0 ? (resultat / revenusNets) * 100 : null;
  const statut = (lot && lot.statutManuel === 'cloture')
    ? 'cloture'
    : (revenusNets >= coutTotal ? 'rentabilise' : 'en_cours');
  return { coutTotal, caBrut, remboursements, revenusNets, resultat, margePct, pourcentRecupere, statut };
}

// Rentabilité d'UNE vente à l'intérieur d'un lot — uniquement ce qui est rattaché directement à
// cette vente (charge.chantierId===vente.id), jamais de quote-part des dépenses de lot
// (charge.lotId) ni de lot.tempsPasse. Une vente peut afficher une perte volontaire compensée
// par une autre vente du même lot — ne jamais répartir automatiquement les coûts du lot dessus.
export function getResultatVente(DATA, vente) {
  const remb = (DATA.retours || [])
    .filter(r => r.statut === 'rembourse' && r.missionId === vente.id)
    .reduce((s, r) => s + (r.montant || 0), 0);
  const montantNet = getCaVenteReconnu(vente) - remb;
  const charges = (DATA.depenses || [])
    .filter(d => d.chantierId === vente.id)
    .reduce((s, d) => s + (d.montant || 0), 0);
  return montantNet - charges;
}
