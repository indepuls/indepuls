// ── MOTEUR PLANNING — CAPACITÉ & REMPLISSAGE ──────────────────
// Domaine : gestion du temps de travail (capacité, taux d'occupation, score).
// Ce fichier ne contient aucun calcul financier.
//
// Deux moteurs coexistent, sélectionnés via DATA.params.modePlanning :
//   'estime'     → charge estimée en h ou j par mission (mode Freelance par défaut)
//   'calendrier' → sessions calendrier {debut, fin} par mission (mode Artisan par défaut)
//   'aucun'      → pas de suivi du temps, score neutre
//
// Point d'entrée unique pour les widgets et le Score Santé : getPilierRemplissage(DATA)

import { getMoisActifsAnnee } from './calculs.js';

// ── UTILITAIRE INTERNE ────────────────────────────────────────
// Copie locale — les HTML gardent leur propre copie pour leurs autres usages.
function _isRecurringStillActive(m) {
  if (!m.isRecurring || !m.dateDebutRec) return false;
  if (!m.nbMoisRec || m.nbMoisRec <= 0) return true;
  const [sy, sm] = m.dateDebutRec.split('-').map(Number);
  return new Date(sy, sm - 1 + m.nbMoisRec, 1) > new Date();
}

// ── MOTEUR TEMPS ESTIMÉ ───────────────────────────────────────

// Convertit une charge vers h/semaine selon l'unité saisie.
export function toHeuresSem(params, v, u) {
  if (!v || v <= 0) return 0;
  const spm = (params.semainesParAn || 44) / 12;
  if (u === 'h_sem')  return v;
  if (u === 'j_mois') return v * (params.heuresParJour || 7) / spm;
  if (u === 'h_mois') return v / spm;
  return v;
}

export function getCapaciteHSem(DATA) {
  const p = DATA.params;
  return (p.heuresParJour || 7) * (p.joursParSemaine || 4);
}

export function getMissionChargeHSem(DATA, m) {
  return toHeuresSem(DATA.params, m.chargeEstimee || 0, m.chargeUnit || 'h_sem');
}

export function getChargeEstimeeTotal(DATA) {
  return DATA.missions
    .filter(m => !m.isManagement && (m.statut === 'cours' || _isRecurringStillActive(m)) && m.chargeEstimee > 0)
    .reduce((s, m) => s + getMissionChargeHSem(DATA, m), 0);
}

// ── MOTEUR CALENDRIER ─────────────────────────────────────────

// Retourne {occupied, ouvrables, taux} pour un mois donné (YYYY-MM).
export function getTauxRemplissageMois(DATA, mk) {
  const [year, month] = mk.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  let occupied = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${pad(month)}-${pad(d)}`;
    const hit = DATA.missions.some(m => {
      if (m.isManagement || !(m.sessions || []).length) return false;
      return m.sessions.some(s => ds >= s.debut && ds <= (s.fin || s.debut));
    });
    if (hit) occupied++;
  }
  const joursParSem = DATA.params.joursParSemaine || 5;
  const ouvrables = Math.max(1, Math.round(daysInMonth * joursParSem / 7));
  return { occupied, ouvrables, taux: Math.min(100, Math.round(occupied / ouvrables * 100)) };
}

// Taux agrégé sur tous les mois actifs de l'année affichée.
export function getTauxRemplissageAnnee(DATA) {
  const mks = getMoisActifsAnnee(DATA);
  if (!mks.length) return { occupied: 0, ouvrables: 0, taux: 0 };
  let totOcc = 0, totOuv = 0;
  mks.forEach(mk => {
    const r = getTauxRemplissageMois(DATA, mk);
    totOcc += r.occupied;
    totOuv += r.ouvrables;
  });
  return { occupied: totOcc, ouvrables: totOuv, taux: totOuv > 0 ? Math.min(100, Math.round(totOcc / totOuv * 100)) : 0 };
}

// ── SCORE ─────────────────────────────────────────────────────

// Barème commun aux deux moteurs : taux d'occupation (%) → points (0–25).
export function scorerRemplissage(pct) {
  if (pct < 40)  return 5;
  if (pct < 60)  return 12;
  if (pct < 75)  return 18;
  if (pct <= 90) return 25;
  if (pct <= 100) return 18;
  return 5; // surcharge >100 %
}

// ── POINT D'ENTRÉE UNIFIÉ ─────────────────────────────────────
//
// Retourne un objet uniforme consommé par wScoreSante() et wRemplissage(),
// quel que soit le mode actif. Les widgets ne connaissent pas le mode.
//
// details (normalisé) :
//   { capacite, utilise, libre, taux, unite }
//   capacite : valeur max  (h/sem en mode estime, j ouvrables en mode calendrier)
//   utilise  : valeur consommée
//   libre    : capacite - utilise
//   taux     : % arrondi (peut dépasser 100 en mode estime)
//   unite    : 'h/sem' | 'j'
//
// Mode 'aucun' ou modePlanning absent → details: null, score neutre 12.

export function getPilierRemplissage(DATA) {
  const mode = DATA.params.modules?.planning || DATA.params.modePlanning || 'aucun';
  const fmt1 = v => Math.round(v * 10) / 10; // 1 décimale

  if (mode === 'estime') {
    const cap    = getCapaciteHSem(DATA);
    const charge = getChargeEstimeeTotal(DATA);
    const pct    = cap > 0 ? Math.round(charge / cap * 100) : 0;
    const libre  = Math.max(0, cap - charge);

    if (cap === 0 || charge === 0) {
      return {
        score: 12, valeur: '—', sousTitre: 'Aucune charge renseignée',
        diagnostic: '○ Renseignez vos missions pour activer cet indicateur.',
        conseil: '', methode: 'estime',
        details: { capacite: cap, utilise: charge, libre, taux: pct, unite: 'h/sem' },
      };
    }

    const score = scorerRemplissage(pct);
    let diagnostic, conseil;
    if (pct > 100) {
      diagnostic = `🔴 Votre capacité facturable est dépassée (${pct} %). Risque de surcharge ou d'épuisement à moyen terme.`;
      conseil    = "Envisagez de déléguer, d'augmenter vos tarifs ou de refuser les missions les moins rentables.";
    } else if (pct >= 90) {
      diagnostic = `🟠 Votre planning est presque plein (${pct} %). Restez vigilant afin de conserver du temps pour le pilotage de votre activité.`;
      conseil    = 'Évitez d\'accepter de nouvelles missions sans ajuster votre organisation ou vos tarifs.';
    } else if (pct >= 75) {
      diagnostic = '🟢 Capacité utilisée de manière saine. Vous conservez une marge pour l\'administratif, la prospection et les imprévus.';
      conseil    = `${fmt1(libre)} h disponibles par semaine — idéal pour le pilotage et les opportunités ponctuelles.`;
    } else if (pct >= 40) {
      diagnostic = "🟠 Votre activité progresse mais votre capacité facturable n'est pas encore pleinement utilisée.";
      conseil    = `${fmt1(libre)} h encore disponibles par semaine — cherchez à consolider votre portefeuille client.`;
    } else {
      diagnostic = `🔴 Votre capacité est largement sous-utilisée (${pct} %). Le principal enjeu est actuellement de développer votre activité.`;
      conseil    = "Priorité à la prospection. L'objectif de revenu est difficile à atteindre dans ces conditions.";
    }

    return {
      score, methode: 'estime',
      valeur: Math.min(pct, 999) + ' %',
      sousTitre: `${fmt1(libre)} h libres / sem`,
      diagnostic, conseil,
      details: { capacite: cap, utilise: charge, libre, taux: pct, unite: 'h/sem' },
    };
  }

  if (mode === 'calendrier') {
    const year  = DATA.currentYear;
    const now   = new Date();
    const curMk = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rm    = getTauxRemplissageMois(DATA, curMk);
    const hasSessions = DATA.missions.some(m => !m.isManagement && (m.sessions || []).length > 0);
    const libre = Math.max(0, rm.ouvrables - rm.occupied);

    if (!hasSessions || rm.ouvrables === 0) {
      return {
        score: 12, valeur: '—', sousTitre: 'Non renseigné',
        diagnostic: '○ Planifiez vos sessions pour activer cet indicateur.',
        conseil: "Ajoutez des sessions dans l'onglet Planning.", methode: 'calendrier',
        details: { capacite: rm.ouvrables, utilise: rm.occupied, libre, taux: rm.taux, unite: 'j' },
      };
    }

    const t     = rm.taux;
    const score = scorerRemplissage(t);
    let diagnostic, conseil;
    if (t > 100) {
      diagnostic = `🔴 Votre capacité facturable est dépassée (${t} %). Risque de surcharge ou d'épuisement à moyen terme.`;
      conseil    = 'Envisagez de déléguer ou de refuser les chantiers les moins rentables.';
    } else if (t >= 90) {
      diagnostic = `🟠 Votre planning est presque plein (${t} %). Restez vigilant afin de conserver du temps pour le pilotage de votre activité.`;
      conseil    = "Évitez d'accepter de nouveaux chantiers sans ajuster votre organisation.";
    } else if (t >= 75) {
      diagnostic = '🟢 Capacité utilisée de manière saine. Vous conservez une marge pour l\'administratif, la prospection et les imprévus.';
      conseil    = libre > 0 ? `${libre} jour${libre > 1 ? 's' : ''} disponibles ce mois — idéal pour le pilotage et les opportunités ponctuelles.` : '';
    } else if (t >= 40) {
      diagnostic = "🟠 Votre activité progresse mais votre capacité facturable n'est pas encore pleinement utilisée.";
      conseil    = `${libre} jour${libre > 1 ? 's' : ''} encore disponibles ce mois — cherchez à consolider votre portefeuille client.`;
    } else {
      diagnostic = `🔴 Votre capacité est largement sous-utilisée (${t} %). Le principal enjeu est actuellement de développer votre activité.`;
      conseil    = "Priorité à la prospection et aux relances. L'objectif de revenu est en danger.";
    }

    return {
      score, methode: 'calendrier',
      valeur: t + ' %',
      sousTitre: `${rm.occupied} j / ${rm.ouvrables} j ouvrables`,
      diagnostic, conseil,
      details: { capacite: rm.ouvrables, utilise: rm.occupied, libre, taux: t, unite: 'j'},
    };
  }

  // Mode 'aucun' ou valeur inconnue
  return {
    score: 12, valeur: '—', sousTitre: 'Suivi du temps désactivé',
    diagnostic: '○ Activez un mode de suivi dans Paramètres pour obtenir cet indicateur.',
    conseil: '', methode: 'aucun', details: null,
  };
}
