// ── TESTS : SIMULATEUR VFL — COMPARAISON AVEC/SANS VFL (étape 2/5, chantier 2026-09-18) ──────
// Mécanisme du "taux effectif" (source DGFIP/BOFiP, confirmé par Faustine) : sous VFL, le
// bénéfice micro forfaitaire n'est pas réimposé au barème, mais reste intégré au revenu du foyer
// pour déterminer le taux moyen appliqué aux AUTRES revenus. Barème 2026 sur revenus 2025
// (source : service-public.fr) : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % jusqu'à
// 84 577 €, 41 % jusqu'à 181 917 €, 45 % au-delà.

import { getImpotBaremeProgressif, getVFLComparaison } from '../core/calculs.js';

let passed = 0, failed = 0;

function test(label, actual, expected) {
  const ok = Math.abs(actual - expected) <= 1;
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
    params: { statut: 'micro-bnc', activiteMixte: false, versementLiberatoire: false, ...params },
    missions: [], depenses: [], revenus: {},
  };
}

section('getImpotBaremeProgressif : barème 2026, quotient familial simple');
{
  testEq('revenu ou parts nuls → 0', getImpotBaremeProgressif(0, 1), 0);
  testEq('revenu négatif → 0', getImpotBaremeProgressif(-100, 1), 0);
  testEq('pile au haut de la 1ère tranche (11 600) → 0', getImpotBaremeProgressif(11600, 1), 0);
  test('26 400 € (1 part) : (26400-11600)×11% = 1628', getImpotBaremeProgressif(26400, 1), 1628);
  test('pile au haut de la 2e tranche (29 579, 1 part) : (29579-11600)×11% = 1978', getImpotBaremeProgressif(29579, 1), 1978);
  test('40 000 € (1 part) : 1978 + (40000-29579)×30% = 1978 + 3126 = 5104', getImpotBaremeProgressif(40000, 1), 5104);
  test('66 400 € réparti sur 2 parts (33 200 €/part) : quotient familial divise avant application du barème', getImpotBaremeProgressif(66400, 2), 6128);
}

section('getVFLComparaison : exemple de Faustine (CA 40 000 € BNC, abattement 34 %, sans conjoint)');
{
  // Bénéfice forfaitaire attendu : 40000 × (1-0.34) = 26400 €. VFL : 40000 × 2.2% = 880 €.
  const D = mkData({ statut: 'micro-bnc' });
  const c = getVFLComparaison(D, 40000, 0, 0, 1);
  test('bénéfice micro forfaitaire = 26 400', c.beneficeMicro, 26400);
  test('impôt sans VFL (barème sur 26 400, 1 part) = 1628', c.irSansVFL, 1628);
  test('VFL sur le CA = 40000 × 2,2 % = 880', c.vflSurCA, 880);
  testEq('pas de conjoint : rien à ajouter au coût avec VFL au-delà du VFL lui-même', c.irAutresRevenusAvecVFL, 0);
  test('coût avec VFL = 880 (rien d\'autre, pas de conjoint)', c.coutAvecVFL, 880);
  test('écart = 1628 - 880 = 748 (VFL avantageux)', c.difference, 748);
  testEq('avantageux = true', c.avantageux, true);
}

section('getVFLComparaison : même exemple, avec un conjoint imposable (mécanisme du taux effectif)');
{
  // Foyer 2 parts, conjoint 40 000 € imposables. Le bénéfice micro (26 400 €) ne repasse pas au
  // barème sous VFL, mais reste intégré au revenu total pour calculer le taux effectif appliqué
  // au conjoint — jamais un calcul isolé "impôt du conjoint sans la micro".
  const D = mkData({ statut: 'micro-bnc' });
  const c = getVFLComparaison(D, 40000, 0, 40000, 2);
  test('revenu imposable total du foyer = 26400 + 40000 = 66400', c.revenuImposableTotal, 66400);
  test('impôt sans VFL (66400 sur 2 parts) = 6128', c.irSansVFL, 6128);
  test('taux effectif ≈ 9,23 % (6128 / 66400)', c.tauxEffectif * 1000, 92.29);
  test('impôt du conjoint avec VFL = taux effectif × 40000 ≈ 3692', c.irAutresRevenusAvecVFL, 3692);
  test('coût avec VFL = 3692 + 880 (VFL) = 4572', c.coutAvecVFL, 4572);
  test('écart = 6128 - 4572 = 1556 (VFL encore plus avantageux avec un conjoint imposable)', c.difference, 1556);
}

section('getVFLComparaison : foyer non imposable → le VFL est structurellement perdant (jamais un cas particulier à coder à part)');
{
  // CA 15 000 € BNC → bénéfice 9900 €, entièrement dans la tranche à 0 %. Sans VFL : 0 € d'impôt.
  // Avec VFL : 15000 × 2.2% = 330 € payés pour rien. C'est exactement le garde-fou que Faustine
  // demandait ("si la personne n'est pas imposable, elle serait forcément perdante") — obtenu
  // naturellement par la comparaison, sans vérification "est-ce imposable ?" séparée.
  const D = mkData({ statut: 'micro-bnc' });
  const c = getVFLComparaison(D, 15000, 0, 0, 1);
  test('bénéfice = 9900, entièrement sous le seuil d\'imposition', c.beneficeMicro, 9900);
  testEq('impôt sans VFL = 0 (non imposable)', c.irSansVFL, 0);
  test('coût avec VFL = 330 (payé alors que l\'impôt classique aurait été nul)', c.coutAvecVFL, 330);
  test('écart négatif = -330 (VFL perdant)', c.difference, -330);
  testEq('avantageux = false', c.avantageux, false);
}

section('getVFLComparaison : activité mixte (micro-achat), abattements et taux VFL distincts par nature');
{
  // presta 30000€ (abattement 50%) + vente 40000€ (abattement 71%) : abattement total = 15000+28400=43400.
  const D = mkData({ statut: 'micro-achat', activiteMixte: true });
  const c = getVFLComparaison(D, 30000, 40000, 0, 1);
  test('bénéfice = 70000 - 43400 = 26600', c.beneficeMicro, 26600);
  test('impôt sans VFL (26600, 1 part) = 1650', c.irSansVFL, 1650);
  // VFL micro-achat : 2,2 % presta (traité comme BNC) + 1 % vente = 660 + 400 = 1060.
  test('VFL sur CA = 30000×2,2% + 40000×1% = 1060', c.vflSurCA, 1060);
  test('écart = 1650 - 1060 = 590 (VFL avantageux)', c.difference, 590);
}

section('getVFLComparaison : hors micro (SASU) → tout à 0, jamais de fuite vers ce statut');
{
  const D = mkData({ statut: 'sasu' });
  const c = getVFLComparaison(D, 40000, 0, 0, 1);
  testEq('bénéfice micro = 0 (SASU n\'a pas de bénéfice forfaitaire)', c.beneficeMicro, 0);
  testEq('VFL sur CA = 0 (SASU n\'a pas accès au VFL)', c.vflSurCA, 0);
}

// ── Résumé ────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
