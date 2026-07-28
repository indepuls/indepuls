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

// ── SEUIL DE MATÉRIALITÉ (phase 2bis, 2026-07-28) ─────────────────────────────
// Proposé par un audit externe (Claude Cowork) suite à un constat de Faustine : sans lui, une
// activité stable reçoit littéralement le même email chaque semaine (delta proche de zéro, même
// pilier faible d'une semaine à l'autre) — paradoxal, c'est justement le profil à fidéliser.
// N'envoyer que si au moins une des 4 conditions est vraie, plutôt que de forcer un texte
// différent chaque semaine sans rien de neuf à dire.
//
// Fonction pure : ne recalcule rien elle-même. Les signaux au-delà de `decision` (déjà produite
// par getDecisionBriefHebdo) sont fournis par l'appelant — futur cron, phase 4 — via des
// fonctions déjà existantes, jamais réinventées ici :
//   - echeanceProcheDaysLeft : le plus proche entre getNextUrssafEcheance().daysLeft et
//     getNextTVAEcheance().daysLeft (indepuls.html) quand applicable.
//   - alerteActive : ex. getMissionsImpayees().length > 0 (indepuls.html).
//   - semainesDepuisDernierEnvoi : PAS dérivable de DATA.snapshotsHebdo (qui note des scores, pas
//     des envois réels) — suivi opérationnel propre au cron lui-même (phase 4), à lui fournir ici
//     en entrée plutôt qu'à reconstruire dans cette fonction.
const SEUIL_DELTA_POINTS = 5;
const SEUIL_ECHEANCE_JOURS = 7;
const SEUIL_SEMAINES_SANS_ENVOI = 3;

export function doitEnvoyerBriefHebdo(decision, { echeanceProcheDaysLeft, alerteActive, semainesDepuisDernierEnvoi } = {}) {
  // Le rappel d'inactivité est lui-même le signal — c'est son rôle, jamais soumis au seuil.
  if (decision.inactif) return true;
  if (decision.delta != null && Math.abs(decision.delta) >= SEUIL_DELTA_POINTS) return true;
  if (echeanceProcheDaysLeft != null && echeanceProcheDaysLeft <= SEUIL_ECHEANCE_JOURS) return true;
  if (alerteActive) return true;
  if (semainesDepuisDernierEnvoi != null && semainesDepuisDernierEnvoi >= SEUIL_SEMAINES_SANS_ENVOI) return true;
  return false;
}
