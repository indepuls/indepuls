// ── TESTS : SIMULATEUR VFL — ÉLIGIBILITÉ (étape 1/5, chantier 2026-09-18) ──────
// Condition d'accès au versement libératoire : RFR du foyer N-2 ÷ nombre de parts N-2, comparé
// au plafond légal par part (29 579 € en 2026). Distinct de l'intérêt financier (étape 2, pas
// encore construite) : ce module répond uniquement à "ai-je le droit ?".

import { getVFLEligibilite } from '../core/calculs.js';

let passed = 0, failed = 0;

function test(label, actual, expected) {
  const ok = Math.abs(actual - expected) <= 0.5;
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} : attendu ${expected}, obtenu ${actual}`); failed++; }
}
function testEq(label, actual, expected) {
  const ok = actual === expected;
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} : attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

function mkData(params) {
  return {
    currentYear: 2026,
    params: { statut: 'micro-bnc', ...params },
    missions: [], depenses: [], revenus: {},
  };
}

section('getVFLEligibilite : rien de saisi, résultat neutre (pas encore de réponse)');
{
  const r = getVFLEligibilite(mkData({}));
  testEq('renseigne = false tant que RFR ou parts manquent', r.renseigne, false);
  testEq('eligible = null (ni oui ni non, question pas encore posée)', r.eligible, null);
}

section('getVFLEligibilite : sous le plafond → éligible');
{
  // Exemple des captures Faustine : RFR 25 123 €, 1 part → largement sous 29 579 €/part.
  const r = getVFLEligibilite(mkData({ vflRfrN2: 25123, vflPartsN2: 1 }));
  testEq('renseigne = true', r.renseigne, true);
  testEq('eligible = true', r.eligible, true);
  test('rfrParPart = 25123', r.rfrParPart, 25123);
  test('plafondFoyer = 29579 (1 part)', r.plafondFoyer, 29579);
  test('marge = 29579 - 25123 = 4456', r.marge, 4456);
}

section('getVFLEligibilite : au-dessus du plafond → non éligible');
{
  // Foyer 2 parts : plafond = 59 158 €. RFR 65 000 € → dépassement.
  const r = getVFLEligibilite(mkData({ vflRfrN2: 65000, vflPartsN2: 2 }));
  testEq('eligible = false', r.eligible, false);
  test('rfrParPart = 32500', r.rfrParPart, 32500);
  test('plafondFoyer = 59158 (2 parts)', r.plafondFoyer, 59158);
  test('marge négative = 59158 - 65000 = -5842 (dépassement)', r.marge, -5842);
}

section('getVFLEligibilite : pile au plafond → éligible (limite inclusive)');
{
  const r = getVFLEligibilite(mkData({ vflRfrN2: 29579, vflPartsN2: 1 }));
  testEq('eligible = true à l\'euro près du plafond', r.eligible, true);
}

section('getVFLEligibilite : parts à 0 ou négatives traitées comme non renseigné (évite une division par 0)');
{
  const r = getVFLEligibilite(mkData({ vflRfrN2: 25123, vflPartsN2: 0 }));
  testEq('renseigne = false', r.renseigne, false);
  testEq('eligible = null', r.eligible, null);
}

// ── Résumé ────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
