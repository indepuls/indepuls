// ── TESTS : RENTABILITÉ PAR AFFAIRE (shared/core/affaires.js) ────
// Aucune fonction de ce module n'était couverte avant ce fichier — voir
// audit du 2026-07 (question de Faustine sur la couverture des suites).
// Alimente la page Missions (Marge, TH réel, % coût par affaire).

import {
  getDepensesAffaire,
  getDepensesAffairesMap,
  excludeDepensesLiees,
  getMargeAffaire,
  getTHReelAffaire,
  getPctCoutAffaire,
  getAffairesAvecCouts,
  getMargeMoyennePortefeuille,
} from '../core/affaires.js';

// ── Helpers ───────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(label, actual, expected) {
  const ok = Math.abs(actual - expected) <= 0.01;
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${expected}, obtenu ${actual}`); failed++; }
}

function testEq(label, actual, expected) {
  const ok = actual === expected;
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
}

function section(title) { console.log(`\n── ${title}`); }

// Mission minimale : heuresSaisies pilote directement getMissionHeures (pas de timer/tempsManuel).
function mkMission(id, montantDevis, heuresSaisies) {
  return {
    id, montantDevis, heuresSaisies,
    timerAccumulated: 0, timerRunning: false, timerStart: null, tempsManuel: [],
    typeMission: 'individuelle', statut: 'cours',
  };
}

function mkData(depenses = []) {
  return { depenses };
}

// ── 1. Dépenses liées à une affaire ────────────────────────────

section('getDepensesAffaire / getDepensesAffairesMap / excludeDepensesLiees');
const depenses = [
  { chantierId: 'aff-1', montant: 300 },
  { chantierId: 'aff-1', montant: 150 },
  { chantierId: 'aff-2', montant: 500 },
  { montant: 90 }, // dépense structurelle, non rattachée
];
test('total dépenses liées à aff-1', getDepensesAffaire(mkData(depenses), 'aff-1'), 450);
test('total dépenses liées à aff-2', getDepensesAffaire(mkData(depenses), 'aff-2'), 500);
test('affaire sans dépense → 0', getDepensesAffaire(mkData(depenses), 'aff-inconnue'), 0);
const map = getDepensesAffairesMap(mkData(depenses));
test('map aff-1 = 450', map['aff-1'], 450);
test('map aff-2 = 500', map['aff-2'], 500);
testEq('map ne contient pas les dépenses non rattachées', map[undefined], undefined);
testEq('excludeDepensesLiees exclut les dépenses avec chantierId', excludeDepensesLiees(depenses).length, 1);

// ── 2. Marge et TH réel d'une affaire ──────────────────────────

section('getMargeAffaire / getTHReelAffaire / getPctCoutAffaire');
const D = mkData(depenses);
const missionRentable = mkMission('aff-1', 2000, 10); // devis 2000, coûts liés 450, 10h passées
test('marge = devis − dépenses liées (2000 − 450)', getMargeAffaire(D, missionRentable), 1550);
test('TH réel = marge / heures (1550 / 10)', getTHReelAffaire(D, missionRentable), 155);
test('% coût = dépenses / devis (450 / 2000)', getPctCoutAffaire(D, missionRentable), 0.225);

section('Cas limites');
const missionSansHeures = mkMission('aff-2', 1000, 0);
testEq('TH réel = null si aucune heure renseignée', getTHReelAffaire(D, missionSansHeures), null);
const missionSansDevis = mkMission('aff-3', 0, 5);
testEq('% coût = 0 si pas de devis', getPctCoutAffaire(D, missionSansDevis), 0);
const missionSansCout = mkMission('aff-sans-cout', 1000, 5);
test('marge = devis entier si aucune dépense liée', getMargeAffaire(D, missionSansCout), 1000);

// ── 3. Agrégations portefeuille ────────────────────────────────

section('getAffairesAvecCouts / getMargeMoyennePortefeuille');
const missions = [missionRentable, mkMission('aff-2', 1000, 4), missionSansCout];
const avecCouts = getAffairesAvecCouts(D, missions);
testEq('getAffairesAvecCouts retourne une entrée par mission', avecCouts.length, 3);
test('entrée aff-1 : marge cohérente avec getMargeAffaire', avecCouts[0].marge, 1550);
test('entrée aff-1 : thReel cohérent avec getTHReelAffaire', avecCouts[0].thReel, 155);

// Marge moyenne pondérée par CA, uniquement sur les affaires avec coûts directs (dep > 0) :
// aff-1 (devis 2000, marge 1550) + aff-2 (devis 1000, dépenses 500, marge 500)
// = (1550 + 500) / (2000 + 1000) = 2050 / 3000 ≈ 0,6833
test('marge moyenne pondérée par CA (affaires avec coûts uniquement)', getMargeMoyennePortefeuille(D, missions), 2050 / 3000);
testEq('null si aucune affaire n\'a de coûts directs', getMargeMoyennePortefeuille(mkData([]), [missionSansCout]), null);

// ── Résumé ────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
