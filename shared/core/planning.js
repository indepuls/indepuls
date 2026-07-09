// ── MOTEUR PLANNING — CAPACITÉ & REMPLISSAGE ──────────────────
// Domaine : gestion du temps de travail (capacité, taux d'occupation, score).
// Ce fichier ne contient aucun calcul financier.
//
// Deux modules indépendants (booléens) :
//   modules.estimation  → charge estimée en h/sem par affaire
//   modules.calendrier  → sessions {debut, fin, heures?} + page Planning visible
//
// Les deux peuvent être actifs simultanément (hybride).
// Point d'entrée unique pour les widgets et le Score Santé : getPilierRemplissage(DATA)
//
// Hiérarchie source de vérité :
//   Temps prévu  = session.heures / chargeEstimee (planning, remplissage)
//   Temps réel   = timerAccumulated + tempsManuel + confirmFacturation
//   → jamais additionnés automatiquement

import { getMoisActifsAnnee } from './calculs.js';

// ── UTILITAIRES ───────────────────────────────────────────────

// Compte les jours ouvrés lun–ven entre deux dates YYYY-MM-DD incluses.
export function joursOuvrésSemaine(debut, fin) {
  const d = new Date((debut || fin) + 'T00:00:00');
  const end = new Date((fin || debut) + 'T00:00:00');
  let count = 0;
  while (d <= end) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return Math.max(1, count);
}

// Charge prévisionnelle (h) pour une date YYYY-MM-DD donnée.
// Distribue session.heures uniformément sur les jours ouvrés de la session.
// Ne touche jamais timerAccumulated / temps réel.
export function getChargeJour(DATA, dateStr) {
  const dow = new Date(dateStr + 'T00:00:00').getDay();
  if (dow === 0 || dow === 6) return 0; // week-end → aucune charge
  let total = 0;
  DATA.missions.forEach(m => {
    if (m.isManagement) return;
    (m.sessions || []).forEach(s => {
      const fin = s.fin || s.debut;
      if (dateStr < s.debut || dateStr > fin) return;
      if (!s.heures || s.heures <= 0) return;
      total += s.heures / joursOuvrésSemaine(s.debut, fin);
    });
  });
  return Math.round(total * 10) / 10;
}

// Copie locale — les HTML gardent leur propre copie pour leurs autres usages.
function _isRecurringStillActive(m) {
  if (m.statut === 'ref') return false;
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

// Retourne {occupied, ouvrables, taux, mode, occupiedH?, capaciteH?} pour un mois (YYYY-MM).
// mode='heures' si toutes les sessions du mois ont session.heures renseigné, sinon mode='jours'.
export function getTauxRemplissageMois(DATA, mk) {
  const [year, month] = mk.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  const mFirst = `${year}-${pad(month)}-01`;
  const mLast  = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  const joursParSem  = DATA.params.joursParSemaine || 5;
  const heuresParJour = DATA.params.heuresParJour  || 7;
  const ouvrables = Math.max(1, Math.round(daysInMonth * joursParSem / 7));

  // Collecte des sessions qui touchent ce mois
  const sessMois = [];
  DATA.missions.forEach(m => {
    if (m.isManagement || !(m.sessions || []).length) return;
    m.sessions.forEach(s => {
      if (s.debut <= mLast && (s.fin || s.debut) >= mFirst) sessMois.push(s);
    });
  });

  // Mode heures : uniquement si toutes les sessions ont heures > 0
  const useHeures = sessMois.length > 0 && sessMois.every(s => s.heures > 0);

  if (useHeures) {
    let occupiedH = 0;
    sessMois.forEach(s => {
      const fin = s.fin || s.debut;
      const clipDebut = s.debut < mFirst ? mFirst : s.debut;
      const clipFin   = fin    > mLast  ? mLast  : fin;
      const joursTotal = joursOuvrésSemaine(s.debut, fin);
      const joursClip  = joursOuvrésSemaine(clipDebut, clipFin);
      occupiedH += (s.heures / joursTotal) * joursClip;
    });
    occupiedH = Math.round(occupiedH * 10) / 10;
    const capaciteH = ouvrables * heuresParJour;
    return {
      mode: 'heures', occupiedH, capaciteH, ouvrables,
      occupied: Math.round(occupiedH / heuresParJour * 10) / 10,
      taux: Math.min(100, Math.round(occupiedH / capaciteH * 100)),
    };
  }

  // Mode jours (comportement historique, toujours valide)
  let occupied = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${year}-${pad(month)}-${pad(d)}`;
    const hit = DATA.missions.some(m => {
      if (m.isManagement || !(m.sessions || []).length) return false;
      return m.sessions.some(s => ds >= s.debut && ds <= (s.fin || s.debut));
    });
    if (hit) occupied++;
  }
  return { mode: 'jours', occupied, ouvrables, taux: Math.min(100, Math.round(occupied / ouvrables * 100)) };
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

// Résultat commun aux modes 'estime' et 'additif' — même unité (h/sem), même barème,
// mêmes textes. Seul le calcul de `charge` en amont diffère entre les deux modes.
function resultatHSemaine(methode, cap, charge) {
  const fmt1 = v => Math.round(v * 10) / 10;
  const pct   = cap > 0 ? Math.round(charge / cap * 100) : 0;
  const libre = Math.max(0, cap - charge);

  if (cap === 0 || charge === 0) {
    return {
      score: 12, valeur: '—', sousTitre: 'Aucune charge renseignée',
      diagnostic: '○ Renseignez vos missions pour activer cet indicateur.',
      conseil: '', methode,
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
    score, methode,
    valeur: Math.min(pct, 999) + ' %',
    sousTitre: `${fmt1(libre)} h libres / sem`,
    diagnostic, conseil,
    details: { capacite: cap, utilise: charge, libre, taux: pct, unite: 'h/sem' },
  };
}

// Heures de sessions d'UNE mission touchant le mois [mFirst, mLast] (mêmes clips que
// getTauxRemplissageMois). Repli jours×heuresParJour par session sans `heures` renseigné
// (rétrocompat) — aucune session avec une date réelle ne doit contribuer pour 0.
function _sessionsHeuresMois(DATA, m, mFirst, mLast) {
  const heuresParJour = DATA.params.heuresParJour || 7;
  let total = 0;
  (m.sessions || []).forEach(s => {
    const fin = s.fin || s.debut;
    if (s.debut > mLast || fin < mFirst) return; // ne touche pas la période
    const clipDebut = s.debut < mFirst ? mFirst : s.debut;
    const clipFin   = fin    > mLast  ? mLast  : fin;
    const joursClip = joursOuvrésSemaine(clipDebut, clipFin);
    if (s.heures > 0) {
      const joursTotal = joursOuvrésSemaine(s.debut, fin);
      total += (s.heures / joursTotal) * joursClip;
    } else {
      total += joursClip * heuresParJour;
    }
  });
  return total;
}

// Agrégation additive par mission (modules.calendrier ET modules.estimation actifs) —
// voir ARCHITECTURE_PRODUIT.md § "Agrégation additive par mission". Chaque mission active
// contribue via son champ principal selon isRecurring, avec repli symétrique si ce champ
// est vide mais que l'autre est renseigné. Retourne le total en h/semaine, mois courant.
function _getChargeAdditiveMois(DATA) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth() + 1;
  const daysInMonth = new Date(year, month, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  const mFirst = `${year}-${pad(month)}-01`;
  const mLast  = `${year}-${pad(month)}-${pad(daysInMonth)}`;
  const joursParSem   = DATA.params.joursParSemaine || 4; // aligné sur getCapaciteHSem
  const ouvrablesMois = Math.max(1, Math.round(daysInMonth * joursParSem / 7));
  const semainesMois  = ouvrablesMois / joursParSem; // ≈ jours du mois / 7, indépendant de joursParSem

  let total = 0;
  DATA.missions.forEach(m => {
    if (m.isManagement) return;
    const estActive = m.statut === 'cours' || _isRecurringStillActive(m);
    const hasSessionsPeriode = (m.sessions || []).some(s => s.debut <= mLast && (s.fin || s.debut) >= mFirst);

    if (m.isRecurring) {
      // Principal : charge estimée. Repli : sessions de cette mission sur la période.
      if (estActive && m.chargeEstimee > 0) {
        total += getMissionChargeHSem(DATA, m);
      } else if (hasSessionsPeriode) {
        total += _sessionsHeuresMois(DATA, m, mFirst, mLast) / semainesMois;
      }
    } else {
      // Principal : sessions sur la période. Repli : charge estimée.
      if (hasSessionsPeriode) {
        total += _sessionsHeuresMois(DATA, m, mFirst, mLast) / semainesMois;
      } else if (estActive && m.chargeEstimee > 0) {
        total += getMissionChargeHSem(DATA, m);
      }
    }
  });
  return Math.round(total * 10) / 10;
}

export function getPilierRemplissage(DATA) {
  const mods = DATA.params.modules || {};
  // Rétrocompat : ancienne clé planning
  const legacyPlanning = DATA.params.modePlanning || mods.planning;
  const modeCalendrier = mods.calendrier ?? (legacyPlanning === 'calendrier');
  const modeEstimation = mods.estimation ?? (legacyPlanning === 'estime' || legacyPlanning == null);
  const mode = (modeCalendrier && modeEstimation) ? 'additif' : modeCalendrier ? 'calendrier' : modeEstimation ? 'estime' : 'aucun';

  if (mode === 'additif') {
    const cap    = getCapaciteHSem(DATA);
    const charge = _getChargeAdditiveMois(DATA);
    return resultatHSemaine('additif', cap, charge);
  }

  if (mode === 'estime') {
    const cap    = getCapaciteHSem(DATA);
    const charge = getChargeEstimeeTotal(DATA);
    return resultatHSemaine('estime', cap, charge);
  }

  if (mode === 'calendrier') {
    const fmt1 = v => Math.round(v * 10) / 10; // 1 décimale
    const year  = DATA.currentYear;
    const now   = new Date();
    const curMk = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const rm    = getTauxRemplissageMois(DATA, curMk);
    const hasSessions = DATA.missions.some(m => !m.isManagement && (m.sessions || []).length > 0);

    // Adapte les labels et details selon le mode retourné (heures ou jours)
    const isH    = rm.mode === 'heures';
    const libres = isH
      ? Math.max(0, rm.capaciteH - rm.occupiedH)
      : Math.max(0, rm.ouvrables - (rm.occupied || 0));
    const sousTitre = isH
      ? `${fmt1(rm.occupiedH)} h / ${rm.capaciteH} h capacité`
      : `${rm.occupied} j / ${rm.ouvrables} j ouvrables`;
    const details = isH
      ? { capacite: rm.capaciteH, utilise: rm.occupiedH, libre: libres, taux: rm.taux, unite: 'h' }
      : { capacite: rm.ouvrables, utilise: rm.occupied || 0, libre: libres, taux: rm.taux, unite: 'j' };

    if (!hasSessions || rm.ouvrables === 0) {
      return {
        score: 12, valeur: '—', sousTitre: 'Non renseigné',
        diagnostic: '○ Planifiez vos sessions pour activer cet indicateur.',
        conseil: "Ajoutez des sessions dans l'onglet Planning.", methode: 'calendrier',
        details,
      };
    }

    const t     = rm.taux;
    const score = scorerRemplissage(t);
    let diagnostic, conseil;
    const uniteLibre = isH ? 'h' : `jour${libres > 1 ? 's' : ''}`;
    if (t > 100) {
      diagnostic = `🔴 Votre capacité facturable est dépassée (${t} %). Risque de surcharge ou d'épuisement à moyen terme.`;
      conseil    = 'Envisagez de déléguer ou de refuser les chantiers les moins rentables.';
    } else if (t >= 90) {
      diagnostic = `🟠 Votre planning est presque plein (${t} %). Restez vigilant afin de conserver du temps pour le pilotage de votre activité.`;
      conseil    = "Évitez d'accepter de nouveaux chantiers sans ajuster votre organisation.";
    } else if (t >= 75) {
      diagnostic = '🟢 Capacité utilisée de manière saine. Vous conservez une marge pour l\'administratif, la prospection et les imprévus.';
      conseil    = libres > 0 ? `${fmt1(libres)} ${uniteLibre} disponibles ce mois — idéal pour le pilotage et les opportunités ponctuelles.` : '';
    } else if (t >= 40) {
      diagnostic = "🟠 Votre activité progresse mais votre capacité facturable n'est pas encore pleinement utilisée.";
      conseil    = `${fmt1(libres)} ${uniteLibre} encore disponibles ce mois — cherchez à consolider votre portefeuille client.`;
    } else {
      diagnostic = `🔴 Votre capacité est largement sous-utilisée (${t} %). Le principal enjeu est actuellement de développer votre activité.`;
      conseil    = "Priorité à la prospection et aux relances. L'objectif de revenu est en danger.";
    }

    return { score, methode: 'calendrier', valeur: t + ' %', sousTitre, diagnostic, conseil, details };
  }

  // Mode 'aucun' ou valeur inconnue
  return {
    score: 12, valeur: '—', sousTitre: 'Suivi du temps désactivé',
    diagnostic: '○ Activez un mode de suivi dans Paramètres pour obtenir cet indicateur.',
    conseil: '', methode: 'aucun', details: null,
  };
}
