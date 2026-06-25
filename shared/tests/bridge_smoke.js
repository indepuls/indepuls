/**
 * Smoke test du pont modes/*.js — PAS un test de validité métier.
 *
 * Contexte : phase2_sandbox.js et validation.js testent core/calculs.js
 * directement, en contournant modes/artisan.js et modes/freelance.js. Un
 * export manquant dans un wrapper de mode (ex: getMissionVenteRatio oublié
 * dans modes/artisan.js alors que le bridge HTML l'utilisait déjà) passe
 * donc invisible dans ces suites — il ne casse qu'au chargement réel de la
 * page (TypeError: Mode.xxx is not a function), comme observé en navigateur.
 *
 * Ce test ferme ce trou : il importe modes/artisan.js et modes/freelance.js
 * tels qu'ils sont réellement utilisés par le bridge HTML, appelle CHAQUE
 * export attendu par les window.* du bridge sur un jeu de données minimal,
 * et vérifie qu'aucun n'est `undefined` / qu'aucun appel ne lève.
 *
 * Exécution : node shared/tests/bridge_smoke.js
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const REPO_ROOT = path.join(ROOT, '..');

let PASS = 0, FAIL = 0;
const fails = [];

function extractWindowAssignedNames(htmlFile) {
  const html = fs.readFileSync(path.join(REPO_ROOT, htmlFile), 'utf8');
  const names = new Set();
  for (const m of html.matchAll(/window\.(\w+)\s*=/g)) names.add(m[1]);
  return names;
}

function extractModeCalls(htmlFile) {
  const html = fs.readFileSync(path.join(REPO_ROOT, htmlFile), 'utf8');
  const names = new Set();
  for (const m of html.matchAll(/Mode\.(\w+)/g)) names.add(m[1]);
  return names;
}

const DATA_MIN = {
  currentYear: 2026,
  params: {
    statut: 'micro-bnc', activiteMixte: true, impotsTaux: 11,
    tauxURSSAF: 25.6, tauxCFP: 0.2, tauxCotisationsPrestation: 25.6, tauxCFPPrestation: 0.2,
    tauxCotisationsVente: 12.3, tauxCFPVente: 0.1, tva: true, tauxTVA: 20,
    dateOuverture: '2026-01', chargesSalariales: 0, objectifNetMensuel: 3000,
    heuresParJour: 7, joursParSemaine: 4, semainesParAn: 44,
    remunerationNette: 3000, coutRemunerationPct: 80,
  },
  missions: [
    { id: 'm1', isManagement: false, isRecurring: false, statut: 'fact',
      dateFact: '2026-03-10', montantDevis: 1000, montantPrestation: 700, montantVente: 300,
      encaissements: [{ id: 'e1', date: '2026-03-10', montant: 1000 }] },
  ],
  revenus: { '2026-03': { autresList: [] } },
  depenses: [{ id: 'd1', date: '2026-01-01', libelle: 'Test', montant: 50, recurrence: 'mensuelle' }],
};

// Arguments synthétiques par nom de fonction quand un seul `mk`/aucun argument ne suffit pas.
function argsFor(name) {
  if (name === 'getTVADeductibleMois' || name === 'getTVACollecteeMois' || name === 'getDepensesMois'
    || name === 'getPonctuelsCA' || name === 'getPonctuelsPresta' || name === 'getPonctuelsVente'
    || name === 'getPonctuelsTresorerie' || name === 'getCaFromMissions' || name === 'getCaBreakdownMois'
    || name === 'isMonthBeforeOpening' || name === 'getRevenuNetMois') return ['2026-03'];
  if (name === 'getMissionVenteRatio' || name === 'getMissionTotalMs' || name === 'getMissionHeures'
    || name === 'getResteAEncaisser' || name === 'getTotalEncaisse') return [DATA_MIN.missions[0]];
  if (name === 'setData') return [DATA_MIN];
  if (name === 'getTVAZone') return [1000, 37500, 41250];
  if (name === 'tvaZoneFill' || name === 'tvaZoneKpi') return ['tolerance'];
  if (name === 'getTauxRemplissageMois') return ['2026-03'];
  if (name === 'getMissionChargeHSem')   return [DATA_MIN.missions[0]];
  if (name === 'toHeuresSem')            return [5, 'h_sem'];
  if (name === 'scorerRemplissage')      return [75];
  return [];
}

// Exports qui ne sont pas des fonctions de calcul appelables tel quel
// (constantes, fonctions de persistance avec effets de bord réseau/storage).
const SKIP = new Set(['STORAGE_KEY', 'SCHEMA_VERSION', 'getData', 'setData']);

async function checkMode(modeFile, htmlFile, label) {
  const Mode = await import(pathToFileURL(path.join(ROOT, 'modes', modeFile)).href);
  Mode.setData(DATA_MIN);

  const calledByBridge = extractModeCalls(htmlFile);
  for (const name of calledByBridge) {
    const fn = Mode[name];
    if (typeof fn !== 'function') {
      FAIL++;
      fails.push(`[${label}] Mode.${name} n'est PAS une fonction (utilisée par le bridge ${htmlFile}) — export manquant dans modes/${modeFile}`);
      continue;
    }
    if (SKIP.has(name)) { PASS++; continue; }
    try {
      fn(...argsFor(name));
      PASS++;
    } catch (e) {
      FAIL++;
      fails.push(`[${label}] Mode.${name}(...) a levé une exception : ${e.message}`);
    }
  }
}

async function run() {
  await checkMode('freelance.js', 'indepuls_freelance.html', 'freelance (production)');
  await checkMode('artisan.js', 'indepuls_artisan.html', 'artisan (production)');

  console.log('\n' + '═'.repeat(70));
  console.log('  SMOKE TEST — bridge modes/*.js (appelé tel que le HTML l\'utilise)');
  console.log('═'.repeat(70));
  console.log(`  ${PASS}/${PASS + FAIL} appels réussis`);
  if (FAIL > 0) {
    console.log(`\n  ÉCHECS (${FAIL}) :`);
    fails.forEach(f => console.log('   ✗ ' + f));
  } else {
    console.log('  ✓ Chaque fonction appelée par le bridge HTML existe bien sur le');
    console.log('    module de mode correspondant et s\'exécute sans erreur.');
  }
  console.log('═'.repeat(70) + '\n');
  process.exitCode = FAIL > 0 ? 1 : 0;
}

run().catch(err => { console.error('ERREUR SMOKE TEST :', err); process.exitCode = 1; });
