// ── TESTS : ABATTEMENT FORFAITAIRE MICRO & PLAFONDS ──────────
// Valide les nouvelles fonctions getAbattementMicro, getRevenuImposableMicro,
// getImpotEstimeMicro et getMicroPlafondInfo ajoutées dans core/calculs.js.

import {
  getAbattementMicro,
  getRevenuImposableMicro,
  getImpotEstimeMicro,
  getMicroPlafondInfo,
} from '../core/calculs.js';
import { TVA_SEUILS, MICRO_LIMITS } from '../core/taux.js';

// ── Helpers ───────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(label, actual, expected) {
  const ok = Math.abs(actual - expected) <= 1; // tolérance arrondi ±1 €
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — attendu ${expected}, obtenu ${actual}`);
    failed++;
  }
}

function testEq(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
    failed++;
  }
}

function section(title) { console.log(`\n── ${title}`); }

// ── Jeux de données minimaux ──────────────────────────────────

function mkData(statut, impotsTaux = 10, activiteMixte = false, dateOuverture = null) {
  return {
    currentYear: 2026,
    params: { statut, impotsTaux, activiteMixte, tauxURSSAF: 25.6, tauxCFP: 0.2 },
    missions: [],
    depenses: [],
    revenus: {},
    ...(dateOuverture ? { params: { statut, impotsTaux, activiteMixte, tauxURSSAF: 25.6, tauxCFP: 0.2, dateOuverture } } : {}),
  };
}

// ── 1. Abattement forfaitaire ─────────────────────────────────

section('getAbattementMicro — micro-BNC 34 %');
// CA = 10 000 €, BNC → abattement 34 % = 3 400 €
test('BNC abattement sur 10 000 €', getAbattementMicro(mkData('micro-bnc'), 10000, 0), 3400);
// Revenu imposable = 10 000 − 3 400 = 6 600 €
test('BNC revenu imposable sur 10 000 €', getRevenuImposableMicro(mkData('micro-bnc'), 10000, 0), 6600);
// Impôt 10 % × 6 600 = 660 €
test('BNC impôt 10 % sur 10 000 €', getImpotEstimeMicro(mkData('micro-bnc'), 10000, 0), 660);

section('getAbattementMicro — micro-BIC prestation 50 %');
// CA = 10 000 €, BIC non mixte → abattement 50 % = 5 000 €
test('BIC prestation abattement sur 10 000 €', getAbattementMicro(mkData('micro-bic'), 10000, 0), 5000);
test('BIC prestation revenu imposable sur 10 000 €', getRevenuImposableMicro(mkData('micro-bic'), 10000, 0), 5000);
test('BIC prestation impôt 10 % sur 10 000 €', getImpotEstimeMicro(mkData('micro-bic'), 10000, 0), 500);

section('getAbattementMicro — micro-achat / vente 71 %');
// CA = 10 000 €, micro-achat non mixte → 71 % sur tout le CA
test('micro-achat abattement sur 10 000 €', getAbattementMicro(mkData('micro-achat'), 10000, 0), 7100);
test('micro-achat revenu imposable sur 10 000 €', getRevenuImposableMicro(mkData('micro-achat'), 10000, 0), 2900);
test('micro-achat impôt 10 % sur 10 000 €', getImpotEstimeMicro(mkData('micro-achat'), 10000, 0), 290);

section('getAbattementMicro — activité mixte BIC (50 % presta + 71 % vente)');
// CA presta = 10 000, CA vente = 10 000
// abattement = 10 000 × 50 % + 10 000 × 71 % = 5 000 + 7 100 = 12 100 €
// revenu imposable = 20 000 − 12 100 = 7 900 €
// impôt 10 % = 790 €
const D_MIXTE_BIC = { ...mkData('micro-bic', 10, true), params: { statut: 'micro-bic', impotsTaux: 10, activiteMixte: true, tauxURSSAF: 21.2, tauxCFP: 0.3 } };
test('mixte BIC abattement presta 10 000 + vente 10 000', getAbattementMicro(D_MIXTE_BIC, 10000, 10000), 12100);
test('mixte BIC revenu imposable presta 10 000 + vente 10 000', getRevenuImposableMicro(D_MIXTE_BIC, 10000, 10000), 7900);
test('mixte BIC impôt 10 % presta 10 000 + vente 10 000', getImpotEstimeMicro(D_MIXTE_BIC, 10000, 10000), 790);

section('Cas limites');
// impotsTaux = 0 → impôt = 0
test('BNC impôt avec taux 0', getImpotEstimeMicro(mkData('micro-bnc', 0), 10000, 0), 0);

// CA = 0 → abattement = 0, revenu imposable = 0, impôt = 0
test('CA nul → abattement = 0', getAbattementMicro(mkData('micro-bnc'), 0, 0), 0);
test('CA nul → revenu imposable = 0', getRevenuImposableMicro(mkData('micro-bnc'), 0, 0), 0);
test('CA nul → impôt = 0', getImpotEstimeMicro(mkData('micro-bnc'), 0, 0), 0);

// Abattement minimum de 305 € : si CA < 305/taux, l'abattement est 305 €
// BNC : 34 % de 500 = 170 < 305 → abattement = 305, revenu imposable = 195
test('abattement minimum 305 € appliqué (BNC, CA 500 €)', getAbattementMicro(mkData('micro-bnc'), 500, 0), 305);
test('revenu imposable avec minimum 305 € (BNC, CA 500 €)', getRevenuImposableMicro(mkData('micro-bnc'), 500, 0), 195);

// Abattement minimum plafonné au CA (évite revenu imposable négatif)
// CA = 100 €, BNC : 34 % = 34 < 305, mais l'abattement ne peut pas dépasser le CA
test('abattement plafonné au CA (BNC, CA 100 €)', getAbattementMicro(mkData('micro-bnc'), 100, 0), 100);
test('revenu imposable plancher = 0 (BNC, CA 100 €)', getRevenuImposableMicro(mkData('micro-bnc'), 100, 0), 0);

section('SASU — pas d\'abattement micro');
const D_SASU = { ...mkData('sasu', 0), params: { statut: 'sasu', impotsTaux: 0, activiteMixte: false, remunerationNette: 3000, coutRemunerationPct: 80 } };
test('SASU getAbattementMicro = 0', getAbattementMicro(D_SASU, 10000, 0), 0);
test('SASU getRevenuImposableMicro = 0', getRevenuImposableMicro(D_SASU, 10000, 0), 0);
test('SASU getImpotEstimeMicro = 0', getImpotEstimeMicro(D_SASU, 10000, 0), 0);

// ── 2. Seuils TVA inchangés ───────────────────────────────────

section('Seuils TVA inchangés');
testEq('TVA_SEUILS prestation franchise = 37 500', TVA_SEUILS.prestation.franchise, 37500);
testEq('TVA_SEUILS prestation tolerance = 41 250', TVA_SEUILS.prestation.tolerance, 41250);
testEq('TVA_SEUILS achat franchise = 85 000', TVA_SEUILS.achat.franchise, 85000);
testEq('TVA_SEUILS achat tolerance = 93 500', TVA_SEUILS.achat.tolerance, 93500);

// ── 3. Plafonds régime micro distincts des seuils TVA ─────────

section('MICRO_LIMITS — distincts des seuils TVA');
testEq('micro-bnc plafond = 83 600', MICRO_LIMITS['micro-bnc'].global, 83600);
testEq('micro-bic plafond = 83 600', MICRO_LIMITS['micro-bic'].global, 83600);
testEq('micro-achat plafond = 203 100', MICRO_LIMITS['micro-achat'].global, 203100);
testEq('micro-achat sous-plafond prestation = 83 600', MICRO_LIMITS['micro-achat'].sousPlafondPresta, 83600);
// Les plafonds micro sont différents des seuils TVA
testEq('micro-bnc plafond ≠ seuil TVA franchise prestation', MICRO_LIMITS['micro-bnc'].global !== TVA_SEUILS.prestation.franchise, true);
testEq('micro-achat plafond ≠ seuil TVA franchise vente', MICRO_LIMITS['micro-achat'].global !== TVA_SEUILS.achat.franchise, true);

section('getMicroPlafondInfo — sans CA (missions vides)');
const D_BNC_VIDE = mkData('micro-bnc', 10);
const info_bnc = getMicroPlafondInfo(D_BNC_VIDE);
testEq('BNC plafond base = 83 600', info_bnc.plafondBase, 83600);
testEq('BNC pas de sous-plafond (non mixte)', info_bnc.sousPlafond, null);
testEq('BNC CA annuel = 0', info_bnc.caAnnuel, 0);
testEq('BNC pct = 0', info_bnc.pct, 0);
testEq('BNC hasProrata false (pas de dateOuverture)', info_bnc.hasProrata, false);

section('getMicroPlafondInfo — activité mixte micro-achat');
const D_MIXTE_ACHAT = { ...mkData('micro-achat', 10, true), params: { statut: 'micro-achat', impotsTaux: 10, activiteMixte: true, tauxURSSAF: 12.3, tauxCFP: 0.1 } };
const info_mixte = getMicroPlafondInfo(D_MIXTE_ACHAT);
testEq('mixte achat plafond global = 203 100', info_mixte.plafondBase, 203100);
testEq('mixte achat sous-plafond prestation = 83 600', info_mixte.sousPlafondBase, 83600);
testEq('mixte achat est mixte = true', info_mixte.mixte, true);

section('getMicroPlafondInfo — prorata ouverture en cours d\'année');
const D_OUVERTURE = {
  currentYear: 2026,
  params: { statut: 'micro-bnc', impotsTaux: 10, activiteMixte: false, tauxURSSAF: 25.6, tauxCFP: 0.2, dateOuverture: '2026-07-01' },
  missions: [], depenses: [], revenus: {},
};
const info_prorata = getMicroPlafondInfo(D_OUVERTURE);
testEq('prorata hasProrata = true', info_prorata.hasProrata, true);
// Ouverture en juillet = 6 mois actifs → plafond proraté = 83 600 × 6/12 = 41 800
test('prorata plafond = 83 600 × 6/12 = 41 800', info_prorata.plafond, 41800);

section('getMicroPlafondInfo — SASU → null');
testEq('SASU getMicroPlafondInfo = null', getMicroPlafondInfo(D_SASU), null);

// ── Résumé ────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
