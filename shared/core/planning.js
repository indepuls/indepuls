// ── MOTEUR PLANNING — CAPACITÉ & REMPLISSAGE ──────────────────
// Domaine : gestion du temps de travail (capacité, taux d'occupation, score).
// Ce fichier ne contient aucun calcul financier.
//
// Le pilier Remplissage (getPilierRemplissage) a UNE seule source de vérité : le temps
// planifié estimatif (m.chargeEstimee/chargeUnit, converti en h/semaine). Les sessions
// {debut, fin, heures?} ou récurrentes sans fin {debut, sansFin:true, jours?:[1..5],
// heures?/mois} n'entrent JAMAIS dans ce calcul — elles servent uniquement à positionner la
// mission sur le calendrier (page Planning / vue Calendrier de Missions) et à dériver le
// "temps total estimé" affiché dans la fiche mission (comparaison prévu/réel, indepuls.html).
//
// Historique (chantier "vue calendrier", 2026-07) : une version précédente choisissait entre un
// moteur "estime" (chargeEstimee) et un moteur "calendrier" (sessions) selon la présence de
// données — jugée après coup trop complexe à comprendre et à tester (retour Faustine,
// 2026-07-25), remplacée par cette version à une seule source.
// Point d'entrée unique pour les widgets et le Score Santé : getPilierRemplissage(DATA)
//
// Hiérarchie source de vérité :
//   Temps prévu  = chargeEstimee (remplissage) — jamais les sessions
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

// ── SESSIONS RÉCURRENTES "SANS FIN" (jours de la semaine sélectionnés, 2026-07) ─
// Une session est normalement bornée : {debut, fin, heures?} — heures est un total réparti
// uniformément sur les jours OUVRÉS de la plage. Pour une mission récurrente sans date de fin
// connue (nbMoisRec null), il n'existait aucun moyen de représenter "chaque mercredi,
// indéfiniment" — seule une plage bornée était possible. Nouvelle forme, additive, sans
// migration : {debut, sansFin:true, jours?:[1..5], heures?} — `fin` absent (n'a pas de sens),
// `jours` = jours de la semaine concernés (1=lundi..5=vendredi, Date#getDay ; défaut lun-ven si
// absent), `heures` = total PAR MOIS (retour Faustine : plus parlant qu'un montant par
// occurrence — cohérent avec le modèle des sessions bornées, où heures est déjà un total
// réparti, juste ici réparti sur les jours sélectionnés du mois plutôt que sur tous les jours
// ouvrés de la plage).
//
// Ces deux fonctions sont le SEUL endroit qui sait interpréter une session (bornée ou sans
// fin) — tous les calculs de charge/remplissage de ce fichier les réutilisent, pour éviter de
// dupliquer 5 fois la même logique de dates (c'était déjà le cas avant cette évolution).

// Vrai si la session couvre le jour ds. Bornée : tous les jours de la plage par défaut (week-ends
// inclus, comportement historique) — sauf si `s.jours` est renseigné (2026-07-25 : "jours
// concernés" est désormais disponible aussi pour une session datée, purement cosmétique pour
// l'affichage calendrier, retour Faustine), auquel cas seuls ces jours de semaine sont couverts.
// Sans fin : toujours filtrée par `s.jours` (motif hebdomadaire, défaut lun-ven), à partir de
// debut, sans limite dans le futur.
export function sessionCouvreJour(s, ds) {
  if (ds < s.debut) return false;
  if (s.sansFin) {
    const jours = (s.jours && s.jours.length) ? s.jours : [1, 2, 3, 4, 5];
    return jours.includes(new Date(ds + 'T00:00:00').getDay());
  }
  if (ds > (s.fin || s.debut)) return false;
  if (s.jours && s.jours.length) return s.jours.includes(new Date(ds + 'T00:00:00').getDay());
  return true;
}

// Nombre de jours où la session sans fin s'applique dans la fenêtre [debut, fin] (bornée par
// s.debut si postérieur). Sert à répartir les heures/mois (getChargeSessionJour) et au repli
// rétrocompat sans heures renseigné (_sessionsHeuresMois) — factorisé pour ne pas dupliquer la
// boucle jour par jour deux fois.
function _compterOccurrences(s, debut, fin) {
  const jours = (s.jours && s.jours.length) ? s.jours : [1, 2, 3, 4, 5];
  const debutEffectif = s.debut > debut ? s.debut : debut;
  let n = 0;
  const d = new Date(debutEffectif + 'T00:00:00');
  const finD = new Date(fin + 'T00:00:00');
  while (d <= finD) {
    if (jours.includes(d.getDay())) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

// Charge (h) apportée par la session pour le jour ds (0 si elle ne le couvre pas, ou si aucune
// heure n'est renseignée). Sans fin : heures/mois réparties uniformément sur les occurrences DU
// MOIS de ds (y compris samedi/dimanche si sélectionnés — ex. un photographe qui shoote des
// mariages le samedi) — propriété utile : sur un mois entièrement couvert, la somme reconstitue
// exactement `heures`. Bornée : comportement existant, inchangé (heures / jours OUVRÉS de la
// plage — un jour de week-end ne reçoit jamais de part, même si la plage le traverse, pour ne
// pas fausser le total réparti sur les seuls jours ouvrés).
export function getChargeSessionJour(s, ds) {
  if (!sessionCouvreJour(s, ds)) return 0;
  if (!s.heures || s.heures <= 0) return 0;
  if (s.sansFin) {
    const [y, mo] = ds.split('-').map(Number);
    const pad = n => String(n).padStart(2, '0');
    const mFirst = `${y}-${pad(mo)}-01`;
    const mLast  = `${y}-${pad(mo)}-${pad(new Date(y, mo, 0).getDate())}`;
    const nbJours = _compterOccurrences(s, mFirst, mLast);
    return nbJours > 0 ? s.heures / nbJours : 0;
  }
  const dow = new Date(ds + 'T00:00:00').getDay();
  if (dow === 0 || dow === 6) return 0;
  const fin = s.fin || s.debut;
  return s.heures / joursOuvrésSemaine(s.debut, fin);
}

// Somme des contributions d'une session sans fin sur une période bornée [debut, fin] (incluse).
// getChargeSessionJour calcule sa part relative au MOIS de chaque jour — sommer jour par jour
// donne donc la portion exacte d'une fenêtre partielle (ex. jours restants du mois), jamais un
// simple `+= s.heures` qui surcompterait si la fenêtre ne couvre pas le mois entier.
function _chargeSansFinPeriode(s, debut, fin) {
  let total = 0;
  const pad = n => String(n).padStart(2, '0');
  const d = new Date(debut + 'T00:00:00');
  const finD = new Date(fin + 'T00:00:00');
  while (d <= finD) {
    total += getChargeSessionJour(s, `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return total;
}

// La session touche-t-elle (au moins un jour) la fenêtre [debut, fin] ? Bornée : chevauchement
// classique de plages (comportement existant). Sans fin : pas de fin connue, donc "touche"
// toute fenêtre se terminant après le début de la session.
function _sessionToucheMois(s, debut, fin) {
  if (s.sansFin) return s.debut <= fin;
  return s.debut <= fin && (s.fin || s.debut) >= debut;
}

// Charge prévisionnelle (h) pour une date YYYY-MM-DD donnée.
// Distribue session.heures uniformément sur les jours ouvrés de la session (ou sur les
// occurrences du mois pour une session sans fin — voir getChargeSessionJour). Le filtre
// week-end vit maintenant DANS getChargeSessionJour (branche bornée uniquement) — une session
// sans fin peut couvrir le samedi/dimanche si l'utilisateur les a sélectionnés (ex. un
// photographe qui shoote des mariages le samedi), ce qu'un filtre ici, avant même de regarder
// les sessions, aurait empêché.
export function getChargeJour(DATA, dateStr) {
  let total = 0;
  DATA.missions.forEach(m => {
    if (m.isManagement) return;
    (m.sessions || []).forEach(s => { total += getChargeSessionJour(s, dateStr); });
  });
  return Math.round(total * 10) / 10;
}

// Missions dont une session couvre la date donnée — n'importe quel mois, contrairement à la
// copie locale de renderPlanning() (indepuls.html) qui restreint aux missions du mois affiché
// (colorMap). Sert à présélectionner/proposer une mission à qui rattacher du temps depuis une
// case du Planning (Planning temps, 2026-07).
export function getMissionsSessionDay(DATA, dateStr) {
  return DATA.missions.filter(m =>
    !m.isManagement && (m.sessions || []).some(s => sessionCouvreJour(s, dateStr))
  );
}

// Une récurrente reste "active" tant que sa période courante n'est pas terminée, même si son
// statut administratif est passé à 'fact' (facturé n'est qu'une étape administrative). Fonction
// pure (aucune dépendance à DATA) — source unique désormais : bridgée via unified.js/window.*,
// remplace la copie locale d'indepuls.html (audit externe 2026-07-26 : les deux copies avaient
// déjà divergé une fois — un statut 'ref' exclu dans l'une, pas dans l'autre, pendant un temps ;
// voir "duplication A" dans CLAUDE.md et le test dédié dans shared/tests/planning.test.js).
export function isRecurringStillActive(m) {
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
    .filter(m => !m.isManagement && (m.statut === 'cours' || isRecurringStillActive(m)) && m.chargeEstimee > 0)
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
      if (_sessionToucheMois(s, mFirst, mLast)) sessMois.push(s);
    });
  });

  // Mode heures : uniquement si toutes les sessions ont heures > 0
  const useHeures = sessMois.length > 0 && sessMois.every(s => s.heures > 0);

  if (useHeures) {
    let occupiedH = 0;
    sessMois.forEach(s => {
      if (s.sansFin) { occupiedH += _chargeSansFinPeriode(s, mFirst, mLast); return; }
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
      return m.sessions.some(s => sessionCouvreJour(s, ds));
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
// Zone idéale relevée à 80–100 % (retour Faustine, 2026-07-25) : la capacité (h/semaine) ne
// représente déjà que le temps facturable déclaré par l'utilisateur — le temps de gestion/
// admin/prospection est exclu en amont (voir "Jours/semaine, Heures/jour" dans Paramètres,
// "temps facturable client uniquement"). Être à 100 % de CETTE capacité est donc l'objectif
// recherché, pas un signal d'alerte — l'ancien palier 90–100 %→18 pénalisait à tort un
// remplissage parfait comme s'il fallait "rester vigilant".
// Dépassement de 100 % adouci à 18/25 (au lieu de 5) — même retour Faustine : un léger
// dépassement mérite un rappel bienveillant ("attention à ne pas vous surcharger"), pas une
// sanction aussi sévère qu'un remplissage très faible (<40 %, resté à 5/25).
export function scorerRemplissage(pct) {
  if (pct < 40)   return 5;
  if (pct < 60)   return 12;
  if (pct < 80)   return 18;
  if (pct <= 100) return 25;
  return 18; // surcharge >100 %
}

// ── POINT D'ENTRÉE UNIFIÉ ─────────────────────────────────────
//
// Retourne un objet uniforme consommé par wScoreSante() et wRemplissage() — toujours basé sur
// le temps planifié (m.chargeEstimee), jamais les sessions.
//
// details (normalisé) :
//   { capacite, utilise, libre, taux, unite }
//   capacite : valeur max  (h/sem)
//   utilise  : valeur consommée
//   libre    : capacite - utilise
//   taux     : % arrondi (peut dépasser 100)
//   unite    : 'h/sem'
//
// Mode 'aucun' (aucune charge estimée nulle part) → details: null, score neutre 12.

// Jours travaillés restants dans la semaine ISO en cours (aujourd'hui inclus), en supposant
// une semaine travaillée du lundi au (joursParSemaine)e jour — hypothèse nécessaire, pas une
// vérité terrain (le pilier ne date aucune mission jour par jour).
function _joursRestantsSemaine(DATA) {
  const joursParSemaine = Math.max(1, DATA.params.joursParSemaine || 4);
  const now = new Date();
  const isoDow = now.getDay() === 0 ? 7 : now.getDay(); // 1=lundi..7=dimanche
  let restants = 0;
  for (let d = isoDow; d <= 7; d++) { if (d <= joursParSemaine) restants++; }
  return restants;
}

// Résultat commun aux modes 'estime' et 'additif' — même unité (h/sem), même barème,
// mêmes textes. Seul le calcul de `charge` en amont diffère entre les deux modes.
function resultatHSemaine(DATA, methode, cap, charge) {
  const fmt1 = v => Math.round(v * 10) / 10;
  const pct   = cap > 0 ? Math.round(charge / cap * 100) : 0;
  // Capacité encore disponible CETTE semaine (pas une semaine "type") : un jour déjà passé sans
  // mission ne peut plus être rempli a posteriori (retour Faustine, 2026-07 : "il ne me reste
  // pas 77h, la semaine dernière je n'avais aucun client, ces heures-là sont perdues"). Le
  // score/taux restent basés sur la semaine complète — comparaison stable dans le temps.
  const libreTotal        = Math.max(0, cap - charge);
  const joursParSemaine   = Math.max(1, DATA.params.joursParSemaine || 4);
  const joursRestants     = _joursRestantsSemaine(DATA);
  const libre = Math.round(libreTotal * (joursRestants / joursParSemaine) * 10) / 10;
  // Portion de capacité libre déjà "perdue" (jours de la semaine déjà écoulés sans mission,
  // sous l'hypothèse d'une charge répartie uniformément — même hypothèse que libre ci-dessus).
  const perdu = Math.max(0, Math.round((libreTotal - libre) * 10) / 10);

  if (cap === 0 || charge === 0) {
    return {
      score: 12, valeur: '—', sousTitre: 'Aucune charge renseignée',
      diagnostic: '○ Renseignez vos missions pour activer cet indicateur.',
      conseil: '', methode,
      details: { capacite: cap, utilise: charge, libre, perdu: 0, taux: pct, unite: 'h/sem' },
    };
  }

  const score = scorerRemplissage(pct);
  let diagnostic, conseil;
  if (pct > 100) {
    diagnostic = `Votre capacité facturable est dépassée (${pct} %). Attention à ne pas vous surcharger.`;
    conseil    = "Gardez un œil sur votre rythme — envisagez de déléguer, d'augmenter vos tarifs ou d'espacer les prochaines missions si besoin.";
  } else if (pct >= 80) {
    diagnostic = `Votre planning est à son plein potentiel (${pct} %) — c'est l'objectif recherché : votre temps facturable est optimisé.`;
    conseil    = "Continuez ainsi. Si de nouvelles demandes arrivent, pensez à ajuster vos tarifs plutôt qu'à vous surcharger.";
  } else if (pct >= 60) {
    diagnostic = `Bonne utilisation de votre capacité facturable (${pct} %). Il reste de la place pour de nouvelles missions.`;
    conseil    = `${fmt1(libre)} h de capacité facturable encore disponibles par semaine — une belle marge de développement.`;
  } else if (pct >= 40) {
    diagnostic = "Votre activité progresse mais votre capacité facturable n'est pas encore pleinement utilisée.";
    conseil    = `${fmt1(libre)} h encore disponibles par semaine — cherchez à consolider votre portefeuille client.`;
  } else {
    diagnostic = `Votre capacité est largement sous-utilisée (${pct} %). Le principal enjeu est actuellement de développer votre activité.`;
    conseil    = "Priorité à la prospection. L'objectif de revenu est difficile à atteindre dans ces conditions.";
  }

  return {
    score, methode,
    valeur: Math.min(pct, 999) + ' %',
    sousTitre: `${fmt1(libre)} h libres / sem`,
    diagnostic, conseil,
    details: { capacite: cap, utilise: charge, libre, perdu, taux: pct, unite: 'h/sem' },
  };
}

export function getPilierRemplissage(DATA) {
  // Une seule source de vérité, toujours : le "temps planifié" (m.chargeEstimee/chargeUnit),
  // jamais les sessions/dates (retour Faustine, 2026-07-25 — la version data-driven session>
  // estimation testée juste avant s'est révélée trop complexe à comprendre/tester en pratique).
  // Les sessions servent uniquement à afficher la mission sur le calendrier et à dériver le
  // "temps total estimé" (comparaison prévu/réel côté fiche mission) — jamais ce pilier.
  const hasEstimation = DATA.missions.some(m => !m.isManagement && (m.statut === 'cours' || isRecurringStillActive(m)) && m.chargeEstimee > 0);
  if (!hasEstimation) {
    return {
      score: 12, valeur: '—', sousTitre: 'Non renseigné',
      diagnostic: '○ Renseignez un temps planifié estimatif sur vos missions pour obtenir cet indicateur.',
      conseil: '', methode: 'aucun', details: null,
    };
  }
  const cap    = getCapaciteHSem(DATA);
  const charge = getChargeEstimeeTotal(DATA);
  return resultatHSemaine(DATA, 'estime', cap, charge);
}
