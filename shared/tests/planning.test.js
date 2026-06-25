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

  // Plusieurs missions
  const m2 = { ...mBase, chargeEstimee: 3 };
  assertEq('getChargeEstimeeTotal somme plusieurs missions',
    P.getChargeEstimeeTotal(makeData({ missions: [mBase, m2] })), 8);
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
  assertEq('scorer 74 %',  P.scorerRemplissage(74),  18);
  assertEq('scorer 75 %',  P.scorerRemplissage(75),  25);
  assertEq('scorer 90 %',  P.scorerRemplissage(90),  25);
  assertEq('scorer 91 %',  P.scorerRemplissage(91),  18);
  assertEq('scorer 100 %', P.scorerRemplissage(100), 18);
  assertEq('scorer 101 %', P.scorerRemplissage(101), 5);
  assertEq('scorer 150 %', P.scorerRemplissage(150), 5);
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

  // cap=28, charge=30 → pct=107 % (>100) → score 5 (surcharge)
  const m30 = { ...m5, chargeEstimee: 30 };
  const D30 = makeData({ ...base, missions: [m30] });
  assertEq('estime 107 % → score 5 (surcharge)', P.getPilierRemplissage(D30).score, 5);

  // details normalisés
  const det = P.getPilierRemplissage(D24).details;
  assertEq('estime details.unite', det.unite, 'h/sem');
  assert('estime details.capacite > 0', det.capacite > 0);
  assert('estime details.libre >= 0',   det.libre   >= 0);
  assert('estime details.taux > 0',     det.taux    > 0);
}

// ── getPilierRemplissage — mode 'calendrier' ──────────────────
{
  const now   = new Date();
  const curMk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const base  = { params: { ...PARAMS_BASE, modePlanning: 'calendrier', dateOuverture: '2026-01' } };

  // Aucune session → score neutre 12
  const D0 = makeData({ ...base, missions: [] });
  assertEq('calendrier sans session → score 12', P.getPilierRemplissage(D0).score, 12);

  // Session sur tout le mois courant → taux élevé → score 18 ou 5
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  const mFull = {
    isManagement: false,
    sessions: [{ debut: `${curMk}-01`, fin: `${curMk}-${pad(lastDay)}` }],
  };
  const Dfull = makeData({ ...base, missions: [mFull] });
  const rfull = P.getPilierRemplissage(Dfull);
  assert('calendrier plein → score ≥ 5', rfull.score >= 5);
  assertEq('calendrier details.unite', rfull.details.unite, 'j');
  assertEq('calendrier methode',       rfull.methode, 'calendrier');

  // details normalisés présents
  assert('calendrier details.capacite > 0', rfull.details.capacite > 0);
  assert('calendrier details.libre >= 0',   rfull.details.libre    >= 0);
}

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
