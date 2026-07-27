/**
 * Tests unitaires — shared/core/planning.js
 *
 * Couvre : toHeuresSem, getCapaciteHSem, getMissionChargeHSem,
 *          getChargeEstimeeTotal, getTauxRemplissageMois,
 *          getTauxRemplissageAnnee, scorerRemplissage, getPilierRemplissage
 *
 * Exécution : node shared/tests/planning.test.js
 */
'use strict';

// ── Résolution ESM depuis CJS ─────────────────────────────────
import { pathToFileURL } from 'url';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = join(__dirname, '..');

let P;
try {
  P = await import(pathToFileURL(join(ROOT, 'core', 'planning.js')).href);
} catch (e) {
  console.error('❌ Impossible de charger planning.js :', e.message);
  process.exit(1);
}

let PASS = 0, FAIL = 0;
const fails = [];

function assert(label, cond) {
  if (cond) { PASS++; }
  else       { FAIL++; fails.push(label); }
}

function assertEq(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) fails.push(`${label} → attendu ${JSON.stringify(expected)}, reçu ${JSON.stringify(actual)}`);
  ok ? PASS++ : FAIL++;
}

// ── Jeu de données minimal ────────────────────────────────────
const PARAMS_BASE = {
  heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44,
};

function makeData(overrides = {}) {
  return {
    currentYear: 2026,
    params: { ...PARAMS_BASE, modePlanning: 'aucun', ...overrides.params },
    missions: overrides.missions || [],
  };
}

// ── toHeuresSem ───────────────────────────────────────────────
{
  const p = PARAMS_BASE;
  assertEq('toHeuresSem h_sem passthrough',      P.toHeuresSem(p, 5, 'h_sem'),  5);
  assertEq('toHeuresSem 0 → 0',                  P.toHeuresSem(p, 0, 'h_sem'),  0);
  assertEq('toHeuresSem null → 0',               P.toHeuresSem(p, null, 'h_sem'), 0);
  // j_mois : 4 j/mois × 7 h/j ÷ (44/12) sem/mois = 4 × 7 / 3.667 ≈ 7.636
  const spm = 44 / 12;
  const expected_jmois = Math.round((4 * 7 / spm) * 1000) / 1000;
  const actual_jmois   = Math.round(P.toHeuresSem(p, 4, 'j_mois') * 1000) / 1000;
  assertEq('toHeuresSem j_mois', actual_jmois, expected_jmois);
  // h_mois : 20 h/mois ÷ (44/12) ≈ 5.455
  const expected_hmois = Math.round((20 / spm) * 1000) / 1000;
  const actual_hmois   = Math.round(P.toHeuresSem(p, 20, 'h_mois') * 1000) / 1000;
  assertEq('toHeuresSem h_mois', actual_hmois, expected_hmois);
  // unité inconnue → valeur brute
  assertEq('toHeuresSem unité inconnue → v brut', P.toHeuresSem(p, 3, 'xyz'), 3);
}

// ── getCapaciteHSem ───────────────────────────────────────────
{
  assertEq('getCapaciteHSem standard 7h×4j',
    P.getCapaciteHSem(makeData()), 28);
  assertEq('getCapaciteHSem fallback heuresParJour absent',
    P.getCapaciteHSem(makeData({ params: { joursParSemaine: 5 } })), 7 * 5);
  assertEq('getCapaciteHSem fallback joursParSemaine absent',
    P.getCapaciteHSem(makeData({ params: { heuresParJour: 8 } })), 8 * 4);
}

// ── getMissionChargeHSem ──────────────────────────────────────
{
  const D = makeData();
  assertEq('getMissionChargeHSem h_sem',
    P.getMissionChargeHSem(D, { chargeEstimee: 10, chargeUnit: 'h_sem' }), 10);
  assertEq('getMissionChargeHSem chargeEstimee absent → 0',
    P.getMissionChargeHSem(D, {}), 0);
}

// ── getChargeEstimeeTotal ─────────────────────────────────────
{
  const mBase = { isManagement: false, isRecurring: false, statut: 'cours',
                  chargeEstimee: 5, chargeUnit: 'h_sem' };

  assertEq('getChargeEstimeeTotal 0 missions → 0',
    P.getChargeEstimeeTotal(makeData()), 0);

  assertEq('getChargeEstimeeTotal mission en cours comptée',
    P.getChargeEstimeeTotal(makeData({ missions: [mBase] })), 5);

  assertEq('getChargeEstimeeTotal mission isManagement exclue',
    P.getChargeEstimeeTotal(makeData({ missions: [{ ...mBase, isManagement: true }] })), 0);

  assertEq('getChargeEstimeeTotal mission facturée non récurrente exclue',
    P.getChargeEstimeeTotal(makeData({ missions: [{ ...mBase, statut: 'fact', isRecurring: false }] })), 0);

  // Mission récurrente encore active (fin dans le futur)
  const futureDate = `${new Date().getFullYear()}-01`;
  const mRec = { ...mBase, statut: 'fact', isRecurring: true,
                 dateDebutRec: futureDate, nbMoisRec: 120 };
  assertEq('getChargeEstimeeTotal récurrente active comptée',
    P.getChargeEstimeeTotal(makeData({ missions: [mRec] })), 5);

  // Mission récurrente terminée (fin dans le passé)
  const mRecOld = { ...mBase, statut: 'fact', isRecurring: true,
                    dateDebutRec: '2020-01', nbMoisRec: 2 };
  assertEq('getChargeEstimeeTotal récurrente terminée exclue',
    P.getChargeEstimeeTotal(makeData({ missions: [mRecOld] })), 0);

  // Mission récurrente refusée, sans date de fin connue (nbMoisRec null → fenêtre indéfinie) :
  // un statut 'ref' doit toujours exclure du calcul d'activité, même sans fenêtre de dates expirée.
  const mRecRef = { ...mBase, statut: 'ref', isRecurring: true,
                    dateDebutRec: '2020-01', nbMoisRec: null };
  assertEq('getChargeEstimeeTotal récurrente refusée exclue même sans date de fin connue',
    P.getChargeEstimeeTotal(makeData({ missions: [mRecRef] })), 0);

  // Plusieurs missions
  const m2 = { ...mBase, chargeEstimee: 3 };
  assertEq('getChargeEstimeeTotal somme plusieurs missions',
    P.getChargeEstimeeTotal(makeData({ missions: [mBase, m2] })), 8);
}

// ── isRecurringStillActive — test direct (audit externe 2026-07-26, "duplication A") ──
// Fonction désormais publique et bridgée (window.isRecurringStillActive) — remplace la copie
// locale d'indepuls.html, qui avait déjà divergé une fois de celle-ci (statut 'ref' exclu ici,
// mais pas dans l'autre copie, pendant un temps). Testée ici directement (pas seulement via
// getChargeEstimeeTotal ci-dessus) pour ne jamais laisser cette régression précise réapparaître
// silencieusement, même si un futur appelant cesse de passer par getChargeEstimeeTotal.
{
  const futureDate = `${new Date().getFullYear()}-01`;
  assertEq('statut ref → toujours false, même sans nbMoisRec (bug déjà survenu)',
    P.isRecurringStillActive({ isRecurring: true, statut: 'ref', dateDebutRec: '2020-01', nbMoisRec: null }), false);
  assertEq('statut ref → false même avec une fenêtre de dates encore valide',
    P.isRecurringStillActive({ isRecurring: true, statut: 'ref', dateDebutRec: futureDate, nbMoisRec: 120 }), false);
  assertEq('non récurrente → toujours false',
    P.isRecurringStillActive({ isRecurring: false, statut: 'cours', dateDebutRec: futureDate, nbMoisRec: 120 }), false);
  assertEq('récurrente sans dateDebutRec → false',
    P.isRecurringStillActive({ isRecurring: true, statut: 'cours', dateDebutRec: null, nbMoisRec: 120 }), false);
  assertEq('récurrente sans nbMoisRec connu (sans fin) → true tant que statut ≠ ref',
    P.isRecurringStillActive({ isRecurring: true, statut: 'fact', dateDebutRec: '2020-01', nbMoisRec: null }), true);
  assertEq('récurrente avec fenêtre encore active → true',
    P.isRecurringStillActive({ isRecurring: true, statut: 'fact', dateDebutRec: futureDate, nbMoisRec: 120 }), true);
  assertEq('récurrente avec fenêtre expirée → false',
    P.isRecurringStillActive({ isRecurring: true, statut: 'fact', dateDebutRec: '2020-01', nbMoisRec: 2 }), false);
}

// ── getTauxRemplissageMois ────────────────────────────────────
{
  const mkJan = '2026-01'; // 31 jours, joursParSemaine=4 → ouvrables = round(31*4/7) = 18

  assertEq('getTauxRemplissageMois aucune mission → occupied 0',
    P.getTauxRemplissageMois(makeData(), mkJan).occupied, 0);

  assertEq('getTauxRemplissageMois aucune session → taux 0',
    P.getTauxRemplissageMois(makeData(), mkJan).taux, 0);

  // Session sur 3 jours contigus
  const mSession = { isManagement: false, sessions: [{ debut: '2026-01-05', fin: '2026-01-07' }] };
  const r3 = P.getTauxRemplissageMois(makeData({ missions: [mSession] }), mkJan);
  assertEq('getTauxRemplissageMois session 3j → occupied 3', r3.occupied, 3);

  // Session sur 1 jour (fin = debut)
  const mDay = { isManagement: false, sessions: [{ debut: '2026-01-10', fin: '2026-01-10' }] };
  const r1 = P.getTauxRemplissageMois(makeData({ missions: [mDay] }), mkJan);
  assertEq('getTauxRemplissageMois session 1j → occupied 1', r1.occupied, 1);

  // Session sans fin → fin = debut (code : s.fin||s.debut)
  const mNoFin = { isManagement: false, sessions: [{ debut: '2026-01-15' }] };
  assertEq('getTauxRemplissageMois sans fin → occupied 1',
    P.getTauxRemplissageMois(makeData({ missions: [mNoFin] }), mkJan).occupied, 1);

  // isManagement exclue
  const mMgmt = { isManagement: true, sessions: [{ debut: '2026-01-05', fin: '2026-01-10' }] };
  assertEq('getTauxRemplissageMois isManagement exclue',
    P.getTauxRemplissageMois(makeData({ missions: [mMgmt] }), mkJan).occupied, 0);

  // Taux plafonné à 100
  const mFull = { isManagement: false, sessions: [{ debut: '2026-01-01', fin: '2026-01-31' }] };
  assert('getTauxRemplissageMois taux ≤ 100',
    P.getTauxRemplissageMois(makeData({ missions: [mFull] }), mkJan).taux <= 100);

  // Fallback joursParSemaine absent → 5 (ne pas passer PARAMS_BASE qui contient la clé)
  const DnoJPS = { currentYear: 2026, params: { heuresParJour: 7, semainesParAn: 44 }, missions: [] };
  const r5 = P.getTauxRemplissageMois(DnoJPS, mkJan);
  const expected5 = Math.max(1, Math.round(31 * 5 / 7));
  assertEq('getTauxRemplissageMois fallback joursParSemaine→5', r5.ouvrables, expected5);
}

// ── getTauxRemplissageAnnee ───────────────────────────────────
{
  // Sans missions ni mois actifs antérieurs, doit retourner taux 0 sans lever
  const D = makeData({ params: { ...PARAMS_BASE, dateOuverture: '2026-01' } });
  const ra = P.getTauxRemplissageAnnee(D);
  assert('getTauxRemplissageAnnee ne lève pas', typeof ra.taux === 'number');
  assert('getTauxRemplissageAnnee taux ≥ 0', ra.taux >= 0);
}

// ── scorerRemplissage ─────────────────────────────────────────
{
  assertEq('scorer 0 %',   P.scorerRemplissage(0),   5);
  assertEq('scorer 39 %',  P.scorerRemplissage(39),  5);
  assertEq('scorer 40 %',  P.scorerRemplissage(40),  12);
  assertEq('scorer 59 %',  P.scorerRemplissage(59),  12);
  assertEq('scorer 60 %',  P.scorerRemplissage(60),  18);
  assertEq('scorer 79 %',  P.scorerRemplissage(79),  18);
  assertEq('scorer 80 %',  P.scorerRemplissage(80),  25);
  assertEq('scorer 90 %',  P.scorerRemplissage(90),  25);
  assertEq('scorer 100 %', P.scorerRemplissage(100), 25);
  assertEq('scorer 101 %', P.scorerRemplissage(101), 18);
  assertEq('scorer 150 %', P.scorerRemplissage(150), 18);
}

// ── getPilierRemplissage — mode 'aucun' ───────────────────────
{
  const D = makeData({ params: { ...PARAMS_BASE, modePlanning: 'aucun' } });
  const r = P.getPilierRemplissage(D);
  assertEq('aucun → score 12',     r.score,    12);
  assertEq('aucun → valeur —',     r.valeur,   '—');
  assertEq('aucun → details null', r.details,  null);
  assertEq('aucun → methode',      r.methode,  'aucun');
}

// ── getPilierRemplissage — modePlanning absent ────────────────
{
  const D = makeData({ params: { heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44 } });
  assert('modePlanning absent → pas d\'exception',
    (() => { try { P.getPilierRemplissage(D); return true; } catch { return false; } })());
  assertEq('modePlanning absent → score 12', P.getPilierRemplissage(D).score, 12);
}

// ── getPilierRemplissage — mode 'estime' ──────────────────────
{
  const base = { params: { ...PARAMS_BASE, modePlanning: 'estime' } };

  // Aucune charge → score neutre 12
  const D0 = makeData({ ...base, missions: [] });
  assertEq('estime sans charge → score 12', P.getPilierRemplissage(D0).score, 12);
  assertEq('estime sans charge → valeur —', P.getPilierRemplissage(D0).valeur, '—');

  // cap=28, charge=5 → pct=18 % (<40) → score 5
  const m5 = { isManagement: false, isRecurring: false, statut: 'cours', chargeEstimee: 5, chargeUnit: 'h_sem' };
  const D5 = makeData({ ...base, missions: [m5] });
  assertEq('estime 18 % → score 5',  P.getPilierRemplissage(D5).score, 5);

  // cap=28, charge=24 → pct=86 % (75–90) → score 25
  const m24 = { ...m5, chargeEstimee: 24 };
  const D24 = makeData({ ...base, missions: [m24] });
  assertEq('estime 86 % → score 25', P.getPilierRemplissage(D24).score, 25);

  // cap=28, charge=30 → pct=107 % (>100) → score 18 (surcharge, adoucie 2026-07-25)
  const m30 = { ...m5, chargeEstimee: 30 };
  const D30 = makeData({ ...base, missions: [m30] });
  assertEq('estime 107 % → score 18 (surcharge adoucie)', P.getPilierRemplissage(D30).score, 18);

  // details normalisés
  const det = P.getPilierRemplissage(D24).details;
  assertEq('estime details.unite', det.unite, 'h/sem');
  assert('estime details.capacite > 0', det.capacite > 0);
  assert('estime details.libre >= 0',   det.libre   >= 0);
  assert('estime details.taux > 0',     det.taux    > 0);
}

// ── getPilierRemplissage — une seule source de vérité : chargeEstimee, jamais les sessions ──
// (2026-07-25 — remplace la version data-driven "session > estimation" testée juste avant,
// jugée trop complexe à comprendre/tester en pratique, retour Faustine). Les sessions ne
// contribuent plus JAMAIS à ce pilier, quelle que soit leur présence.
{
  const now  = new Date();
  const y = now.getFullYear(), mo = now.getMonth() + 1;
  const curMk = `${y}-${String(mo).padStart(2, '0')}`;
  const daysInMonth = new Date(y, mo, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  const mFirst = `${curMk}-01`, mLast = `${curMk}-${pad(daysInMonth)}`;
  const base = { params: { ...PARAMS_BASE } };

  // 1. chargeEstimee seule (aucune session) → methode estime, utilise=chargeEstimee
  {
    const m = { isManagement: false, isRecurring: true, statut: 'cours', chargeEstimee: 14, chargeUnit: 'h_sem', sessions: [] };
    const r = P.getPilierRemplissage(makeData({ ...base, missions: [m] }));
    assertEq('chargeEstimee seule → methode estime', r.methode, 'estime');
    assertEq('chargeEstimee seule → utilise=14', r.details.utilise, 14);
  }

  // 2. Sessions seules, aucune chargeEstimee → aucun KPI (les sessions ne comptent jamais ici)
  {
    const m = { isManagement: false, isRecurring: false, statut: 'cours', chargeEstimee: 0, sessions: [{ debut: mFirst, fin: mLast, heures: 40 }] };
    const r = P.getPilierRemplissage(makeData({ ...base, missions: [m] }));
    assertEq('sessions seules, sans chargeEstimee → methode aucun', r.methode, 'aucun');
    assertEq('sessions seules, sans chargeEstimee → details null', r.details, null);
  }

  // 3. chargeEstimee ET sessions sur la même mission → seule chargeEstimee compte
  {
    const m = { isManagement: false, isRecurring: true, statut: 'cours', chargeEstimee: 14, chargeUnit: 'h_sem', sessions: [{ debut: mFirst, fin: mLast, heures: 40 }] };
    const r = P.getPilierRemplissage(makeData({ ...base, missions: [m] }));
    assertEq('chargeEstimee + sessions → methode estime (sessions ignorées)', r.methode, 'estime');
    assertEq('chargeEstimee + sessions → utilise=14 (pas 40)', r.details.utilise, 14);
  }

  // 4. Rien de rempli nulle part → aucun KPI
  {
    const m = { isManagement: false, isRecurring: false, statut: 'cours', chargeEstimee: 0, sessions: [] };
    const r = P.getPilierRemplissage(makeData({ ...base, missions: [m] }));
    assertEq('rien de rempli → methode aucun', r.methode, 'aucun');
    assertEq('rien de rempli → details null', r.details, null);
  }

  // 5. Les cases Paramètres modules.estimation/calendrier n'ont plus aucun effet ici
  {
    const m = { isManagement: false, isRecurring: true, statut: 'cours', chargeEstimee: 14, chargeUnit: 'h_sem', sessions: [] };
    const baseAvecModules = { params: { ...PARAMS_BASE, modules: { estimation: false, calendrier: true } } };
    const r = P.getPilierRemplissage(makeData({ ...baseAvecModules, missions: [m] }));
    assertEq('cases Paramètres ignorées → estime', r.methode, 'estime');
  }
}

// ── Sessions récurrentes "sans fin" (jours de la semaine sélectionnés) ───────
// Écrits AVANT l'implémentation (2026-07) — doivent échouer sur le code d'origine, puis passer
// une fois sessionCouvreJour()/getChargeSessionJour() ajoutées et les sites existants refactorés.
{
  const dow = ds => new Date(ds + 'T00:00:00').getDay(); // 0=dim..6=sam
  // Semaine du 5 au 11 janvier 2026 — on dérive les jours sans supposer le calendrier.
  const semaine = ['2026-01-05','2026-01-06','2026-01-07','2026-01-08','2026-01-09','2026-01-10','2026-01-11'];
  const mercredi    = semaine.find(ds => dow(ds) === 3);
  const nonMercredi = semaine.find(ds => dow(ds) !== 3 && dow(ds) !== 0 && dow(ds) !== 6); // jour ouvré ≠ mercredi
  const avantDebut  = '2025-12-01';
  // Mercredi loin dans le futur (6 mois après le début) — prouve que "sans fin" n'est pas
  // borné au mois affiché, contrairement à une session classique. Recherché jour par jour
  // (un simple remplacement du mois ne préserve pas le jour de la semaine).
  let mercrediLointain, nonMercrediLointain;
  for (let d = 1; d <= 31; d++) {
    const ds = `2026-07-${String(d).padStart(2, '0')}`;
    if (dow(ds) === 3 && !mercrediLointain) mercrediLointain = ds;
    if (dow(ds) !== 3 && dow(ds) !== 0 && dow(ds) !== 6 && !nonMercrediLointain) nonMercrediLointain = ds;
  }

  // ── sessionCouvreJour ──
  const sBornee = { debut: '2026-01-05', fin: '2026-01-11' }; // couvre toute la semaine, week-end inclus
  assertEq('sessionCouvreJour bornée · dans la plage (y compris week-end)',
    P.sessionCouvreJour(sBornee, semaine[5]), true); // samedi, dans la plage bornée
  assertEq('sessionCouvreJour bornée · hors plage',
    P.sessionCouvreJour({ debut: '2026-01-05', fin: '2026-01-06' }, mercredi), false);

  const sSansFin = { debut: '2026-01-05', sansFin: true, jours: [3] }; // 3 = mercredi (Date#getDay)
  assertEq('sessionCouvreJour sansFin · jour sélectionné → true',
    P.sessionCouvreJour(sSansFin, mercredi), true);
  assertEq('sessionCouvreJour sansFin · jour non sélectionné → false',
    P.sessionCouvreJour(sSansFin, nonMercredi), false);
  assertEq('sessionCouvreJour sansFin · avant le début → false même le bon jour de semaine',
    P.sessionCouvreJour(sSansFin, avantDebut), false);
  assertEq('sessionCouvreJour sansFin · loin dans le futur → toujours vrai (pas de borne de fin)',
    P.sessionCouvreJour(sSansFin, mercrediLointain), true);
  assertEq('sessionCouvreJour sansFin · loin dans le futur, mauvais jour → false',
    P.sessionCouvreJour(sSansFin, nonMercrediLointain), false);

  const sSansFinDefaut = { debut: '2026-01-05', sansFin: true }; // jours absent → défaut lun-ven
  assertEq('sessionCouvreJour sansFin sans `jours` → défaut lun-ven (mercredi couvert)',
    P.sessionCouvreJour(sSansFinDefaut, mercredi), true);
  assertEq('sessionCouvreJour sansFin sans `jours` → défaut lun-ven (week-end exclu)',
    P.sessionCouvreJour(sSansFinDefaut, semaine[5]), false); // samedi

  // ── sessionCouvreJour bornée + `jours` (2026-07-25, "jours concernés" cosmétique
  // aussi pour une session datée — retour Faustine) ──
  const sBorneeAvecJours = { debut: '2026-01-05', fin: '2026-01-11', jours: [3] }; // mercredi seulement
  assertEq('sessionCouvreJour bornée + jours · jour sélectionné → true',
    P.sessionCouvreJour(sBorneeAvecJours, mercredi), true);
  assertEq('sessionCouvreJour bornée + jours · jour non sélectionné (mais dans la plage) → false',
    P.sessionCouvreJour(sBorneeAvecJours, nonMercredi), false);
  assertEq('sessionCouvreJour bornée + jours · hors plage même le bon jour → false',
    P.sessionCouvreJour(sBorneeAvecJours, mercrediLointain), false);
  assertEq('sessionCouvreJour bornée SANS `jours` (rétrocompat) → tous les jours couverts, week-end inclus',
    P.sessionCouvreJour(sBornee, semaine[5]), true); // samedi, comportement historique inchangé

  // ── getChargeSessionJour ──
  // Bornée : comportement EXISTANT, inchangé — heures = total sur la plage entière.
  const sBorneeH = { debut: '2026-01-05', fin: '2026-01-09', heures: 20 }; // 5 jours ouvrés
  const attenduBornee = 20 / P.joursOuvrésSemaine('2026-01-05', '2026-01-09');
  assertEq('getChargeSessionJour bornée · réparti sur les jours ouvrés',
    P.getChargeSessionJour(sBorneeH, mercredi), attenduBornee);
  assertEq('getChargeSessionJour bornée · hors plage → 0',
    P.getChargeSessionJour(sBorneeH, avantDebut), 0);

  // Sans fin : heures = total PAR MOIS (retour Faustine, 2026-07 : plus parlant que "par
  // occurrence" — cohérent avec le modèle des sessions bornées, où `heures` est déjà un
  // total réparti, juste ici réparti sur les jours sélectionnés du mois plutôt que sur tous
  // les jours ouvrés de la plage). Réparti uniformément sur les occurrences DU MOIS de `ds`.
  let nbMercredisDepuisDebut = 0; // depuis le 5 janvier (date de début), jusqu'à fin janvier
  for (let d = 5; d <= 31; d++) {
    const ds = `2026-01-${String(d).padStart(2, '0')}`;
    if (dow(ds) === 3) nbMercredisDepuisDebut++;
  }
  const sSansFinH = { debut: '2026-01-05', sansFin: true, jours: [3], heures: 16 };
  const attenduSansFin = 16 / nbMercredisDepuisDebut;
  assertEq('getChargeSessionJour sansFin · heures/mois réparties sur les occurrences du mois',
    P.getChargeSessionJour(sSansFinH, mercredi), attenduSansFin);
  assertEq('getChargeSessionJour sansFin · jour non couvert → 0',
    P.getChargeSessionJour(sSansFinH, nonMercredi), 0);
  assertEq('getChargeSessionJour · sans heures renseigné → 0',
    P.getChargeSessionJour({ debut: '2026-01-05', sansFin: true, jours: [3] }, mercredi), 0);

  // ── getChargeJour (intégration) ──
  const mChargeJour = { isManagement: false, sessions: [sSansFinH] };
  const DChargeJour = makeData({ missions: [mChargeJour] });
  assertEq('getChargeJour · sansFin, jour couvert → part du total mensuel',
    P.getChargeJour(DChargeJour, mercredi), attenduSansFin);
  assertEq('getChargeJour · sansFin, jour non couvert → 0',
    P.getChargeJour(DChargeJour, nonMercredi), 0);
  assert('getChargeJour · sansFin, loin dans le futur, bon jour → toujours > 0 (pas de borne de fin)',
    P.getChargeJour(DChargeJour, mercrediLointain) > 0);
  assertEq('getChargeJour · sansFin, loin dans le futur, mauvais jour → 0',
    P.getChargeJour(DChargeJour, nonMercrediLointain), 0);

  // ── getMissionsSessionDay (intégration) ──
  const mCandidate = { id: 'm1', isManagement: false, sessions: [sSansFinH] };
  const DCandidate = makeData({ missions: [mCandidate] });
  assertEq('getMissionsSessionDay · sansFin, loin dans le futur, bon jour → mission retournée',
    P.getMissionsSessionDay(DCandidate, mercrediLointain).length, 1);
  assertEq('getMissionsSessionDay · sansFin, loin dans le futur, mauvais jour → aucune mission',
    P.getMissionsSessionDay(DCandidate, nonMercrediLointain).length, 0);

  // ── getTauxRemplissageMois (intégration) ──
  // Propriété clé du modèle "heures/mois" : pour un mois entièrement couvert (début au 1er du
  // mois ou avant), le total mensuel occupé doit être EXACTEMENT `heures` — quel que soit le
  // nombre de mercredis ce mois-là (4 ou 5) — puisque la répartition par jour est justement
  // calculée pour que la somme reconstitue le total. C'est ce qui rend "heures par mois" plus
  // simple à comprendre qu'un montant par occurrence (pas besoin de connaître le nombre
  // d'occurrences pour savoir combien d'heures on dédie à ce client chaque mois).
  const mMoisH = { isManagement: false, sessions: [{ debut: '2026-01-01', sansFin: true, jours: [3], heures: 16 }] };
  const rMoisH = P.getTauxRemplissageMois(makeData({ missions: [mMoisH] }), '2026-01');
  assertEq('getTauxRemplissageMois sansFin · mode heures activé (heures renseignées)', rMoisH.mode, 'heures');
  assertEq('getTauxRemplissageMois sansFin · occupiedH = heures/mois exactement (mois entièrement couvert)',
    rMoisH.occupiedH, 16);

  // Mode jours (sans heures renseigné) : compte les jours OÙ LA SESSION S'APPLIQUE (les
  // mercredis), pas tous les jours ouvrés — comportement propre au sélecteur de jours.
  let nbMercredisJanvier = 0;
  for (let d = 1; d <= 31; d++) {
    const ds = `2026-01-${String(d).padStart(2, '0')}`;
    if (dow(ds) === 3) nbMercredisJanvier++;
  }
  const mMoisJours = { isManagement: false, sessions: [{ debut: '2026-01-01', sansFin: true, jours: [3] }] }; // sans heures
  const rMoisJours = P.getTauxRemplissageMois(makeData({ missions: [mMoisJours] }), '2026-01');
  assertEq('getTauxRemplissageMois sansFin sans heures · mode jours', rMoisJours.mode, 'jours');
  assertEq('getTauxRemplissageMois sansFin sans heures · occupied = nb mercredis (pas tous les jours ouvrés)',
    rMoisJours.occupied, nbMercredisJanvier);

  // ── Non-régression explicite : une session bornée classique n'est jamais affectée ──
  const mkJanReg = '2026-01';
  const mRegBornee = { isManagement: false, sessions: [{ debut: '2026-01-05', fin: '2026-01-07' }] };
  assertEq('non-régression · session bornée classique inchangée',
    P.getTauxRemplissageMois(makeData({ missions: [mRegBornee] }), mkJanReg).occupied, 3);

  // ── Week-end sélectionnable pour une session sans fin (2026-07, retour Faustine : un
  // photographe peut shooter des mariages le samedi) — mais jamais pour une session bornée,
  // dont le total reste réparti sur les seuls jours ouvrés (comportement historique préservé).
  const samedi = semaine.find(ds => dow(ds) === 6);
  const sSansFinSamedi = { debut: '2026-01-05', sansFin: true, jours: [6], heures: 8 };
  assertEq('getChargeSessionJour sansFin · samedi sélectionné → non nul (photographe le week-end)',
    P.getChargeSessionJour(sSansFinSamedi, samedi) > 0, true);
  assertEq('getChargeSessionJour sansFin · dimanche non sélectionné → 0',
    P.getChargeSessionJour(sSansFinSamedi, semaine.find(ds => dow(ds) === 0)), 0);

  const sBorneeWeekend = { debut: '2026-01-05', fin: '2026-01-11', heures: 35 }; // couvre le samedi
  assertEq('getChargeSessionJour bornée · samedi dans la plage → toujours 0 (jours ouvrés uniquement)',
    P.getChargeSessionJour(sBorneeWeekend, samedi), 0);
  const mBorneeWeekend = { isManagement: false, sessions: [sBorneeWeekend] };
  assertEq('getChargeJour · session bornée un samedi → 0 (non-régression)',
    P.getChargeJour(makeData({ missions: [mBorneeWeekend] }), samedi), 0);
  const mSansFinSamedi = { isManagement: false, sessions: [sSansFinSamedi] };
  assertEq('getChargeJour · session sans fin un samedi sélectionné → non nul',
    P.getChargeJour(makeData({ missions: [mSansFinSamedi] }), samedi) > 0, true);
}

// ── Non-régression — un seul module actif (comportement inchangé) ────────────
// Les sections 'estime' et 'calendrier' ci-dessus couvrent déjà ce cas : la fonction
// resultatHSemaine() partagée reproduit à l'identique le calcul et les textes de la
// branche 'estime' d'origine, et la branche 'calendrier' n'a subi aucune modification.

// ── Rapport ───────────────────────────────────────────────────
console.log('\n' + '═'.repeat(70));
console.log('  TESTS — shared/core/planning.js');
console.log('═'.repeat(70));
console.log(`  ${PASS}/${PASS + FAIL} assertions réussies`);
if (FAIL > 0) {
  console.log(`\n  ÉCHECS (${FAIL}) :`);
  fails.forEach(f => console.log('   ✗ ' + f));
} else {
  console.log('  ✓ Toutes les assertions passent.');
}
console.log('═'.repeat(70) + '\n');
process.exitCode = FAIL > 0 ? 1 : 0;
