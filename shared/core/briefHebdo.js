// ── BRIEF HEBDOMADAIRE PAR EMAIL — DÉCISION (chantier 2026-07-27, phase 2/4) ──
// Fonction de décision PURE, portable côté navigateur ET côté serveur (futur cron) : ne produit
// jamais de texte final, seulement les ingrédients déterministes dont le gabarit d'email
// (phase 3) a besoin. Ne recalcule jamais le score ou le pilier faible — ce sont les valeurs
// DÉJÀ persistées par wScoreSante() dans DATA.snapshotsHebdo (voir indepuls.html), pour ne
// jamais dupliquer la logique de scoring du Brief in-app.

import { getWeekKey } from './utils.js';

export function getDecisionBriefHebdo(DATA, maintenant = new Date()) {
  const snaps = DATA.snapshotsHebdo || {};
  const wkActuelle = getWeekKey(maintenant);
  const actuel = snaps[wkActuelle];

  if (!actuel) {
    // Aucune session cette semaine — signal réutilisé tel quel pour le rappel intelligent,
    // pas de mécanisme de détection d'activité séparé (voir CLAUDE.md, phase 1).
    return { inactif: true, score: null, delta: null, pilierFaible: null };
  }

  // Comparaison UNIQUEMENT à la semaine ISO immédiatement précédente (jamais "la dernière
  // semaine active trouvée, quelle qu'elle soit") — sinon un delta calculé sur un intervalle de
  // plusieurs semaines serait présenté à tort comme "vs la semaine dernière".
  const semainePrecedente = new Date(maintenant);
  semainePrecedente.setUTCDate(semainePrecedente.getUTCDate() - 7);
  const wkPrecedente = getWeekKey(semainePrecedente);
  const precedent = snaps[wkPrecedente];
  const delta = precedent ? actuel.score - precedent.score : null;

  return { inactif: false, score: actuel.score, delta, pilierFaible: actuel.pilierFaible };
}
