// ── TESTS : SIMULATEUR VFL — COMPARAISON AVEC/SANS VFL (étape 2/5, chantier 2026-09-18) ──────
// Mécanisme du "taux effectif" (source DGFIP/BOFiP, confirmé par Faustine) : sous VFL, le
// bénéfice micro forfaitaire n'est pas réimposé au barème, mais reste intégré au revenu du foyer
// pour déterminer le taux moyen appliqué aux AUTRES revenus. Barème 2026 sur revenus 2025
// (source : service-public.fr) : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % jusqu'à
// 84 577 €, 41 % jusqu'à 181 917 €, 45 % au-delà. Décote 2026 (source : economie.gouv.fr) :
// 897 − 45,25 % de l'impôt brut (personne seule, sous 1 982 €), 1 483 − 45,25 % (couple, sous
// 3 277 €), repérée manquante lors d'une relecture externe (ChatGPT) du premier jet de ce
// moteur, vérifiée indépendamment ici avant correction.

import { getImpotBaremeProgressif, getDecoteIR, getVFLComparaison } from '../core/calculs.js';

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

section('getImpotBaremeProgressif : barème 2026, quotient familial simple (impôt BRUT, avant décote)');
{
  testEq('revenu ou parts nuls → 0', getImpotBaremeProgressif(0, 1), 0);
  testEq('revenu négatif → 0', getImpotBaremeProgressif(-100, 1), 0);
  testEq('pile au haut de la 1ère tranche (11 600) → 0', getImpotBaremeProgressif(11600, 1), 0);
  test('26 400 € (1 part) : (26400-11600)×11% = 1628', getImpotBaremeProgressif(26400, 1), 1628);
  test('pile au haut de la 2e tranche (29 579, 1 part) : (29579-11600)×11% = 1978', getImpotBaremeProgressif(29579, 1), 1978);
  test('40 000 € (1 part) : 1978 + (40000-29579)×30% = 1978 + 3126 = 5104', getImpotBaremeProgressif(40000, 1), 5104);
  test('66 400 € réparti sur 2 parts (33 200 €/part) : quotient familial divise avant application du barème', getImpotBaremeProgressif(66400, 2), 6128);
}

section('getDecoteIR : formule officielle (economie.gouv.fr), personne seule et couple');
{
  testEq('impôt brut nul → décote nulle (rien à réduire)', getDecoteIR(0, false), 0);
  test('exemple economie.gouv.fr (couple, 2250 € brut) : 1483 - 2250×45,25% ≈ 465', getDecoteIR(2250, true), 465);
  test('1628 € brut, seul : 897 - 1628×45,25% ≈ 160', getDecoteIR(1628, false), 160);
  test('1000 € brut, seul : 897 - 1000×45,25% ≈ 445', getDecoteIR(1000, false), 445);
  testEq('pile au seuil (1982, seul) : décote ≈ 0 (le barème est calibré pour s\'annuler ici)', getDecoteIR(1982, false), 0);
  testEq('juste au-dessus du seuil (1983, seul) : plus aucune décote, pas de saut brutal attendu au-delà de ce point', getDecoteIR(1983, false), 0);
  testEq('pile au seuil couple (3277) : décote ≈ 0', getDecoteIR(3277, true), 0);
  testEq('au-dessus du seuil couple (3278) : décote nulle', getDecoteIR(3278, true), 0);
}

section('getVFLComparaison : exemple de Faustine (CA 40 000 € BNC, sans conjoint), CORRIGÉ avec la décote');
{
  // Impôt brut 1628 € (comme avant), mais la décote (personne seule, sous 1982 €) retire ~160 €.
  const D = mkData({ statut: 'micro-bnc' });
  const c = getVFLComparaison(D, 40000, 0, 0, 1, false);
  test('bénéfice micro forfaitaire = 26 400', c.beneficeMicro, 26400);
  test('impôt brut (avant décote) = 1628', c.impotBrutSansVFL, 1628);
  test('décote ≈ 160 (personne seule)', c.decoteSansVFL, 160);
  test('impôt sans VFL après décote = 1628 - 160 = 1468 (et non 1628)', c.irSansVFL, 1468);
  test('VFL sur le CA = 40000 × 2,2 % = 880', c.vflSurCA, 880);
  test('écart = 1468 - 880 = 588 (VFL avantageux, mais moins qu\'un calcul sans décote ne le suggérait)', c.difference, 588);
  testEq('avantageux = true', c.avantageux, true);
}

section('getVFLComparaison : couple à 40 000 € + 40 000 €, décote sans effet (impôt brut au-dessus du seuil couple)');
{
  const D = mkData({ statut: 'micro-bnc' });
  const c = getVFLComparaison(D, 40000, 0, 40000, 2, true);
  test('revenu imposable total du foyer = 26400 + 40000 = 66400', c.revenuImposableTotal, 66400);
  test('impôt brut (66400 sur 2 parts) = 6128', c.impotBrutSansVFL, 6128);
  testEq('décote nulle : 6128 dépasse largement le seuil couple (3277)', c.decoteSansVFL, 0);
  test('impôt sans VFL = 6128 (inchangé, pas de décote ici)', c.irSansVFL, 6128);
  test('taux effectif ≈ 9,23 % (6128 / 66400)', c.tauxEffectif * 1000, 92.29);
  test('impôt du conjoint avec VFL = taux effectif × 40000 ≈ 3692', c.irAutresRevenusAvecVFL, 3692);
  test('coût avec VFL = 3692 + 880 (VFL) = 4572', c.coutAvecVFL, 4572);
  test('écart = 6128 - 4572 = 1556 (inchangé, confirmé par la relecture externe)', c.difference, 1556);
}

section('getVFLComparaison : foyer non imposable → le VFL est structurellement perdant (jamais un cas particulier à coder à part)');
{
  // CA 15 000 € BNC → bénéfice 9900 €, entièrement dans la tranche à 0 %, décote sans objet ici
  // (impôt brut déjà nul). Sans VFL : 0 € d'impôt. Avec VFL : 15000 × 2.2% = 330 € payés pour rien.
  const D = mkData({ statut: 'micro-bnc' });
  const c = getVFLComparaison(D, 15000, 0, 0, 1, false);
  test('bénéfice = 9900, entièrement sous le seuil d\'imposition', c.beneficeMicro, 9900);
  testEq('impôt sans VFL = 0 (non imposable)', c.irSansVFL, 0);
  test('coût avec VFL = 330 (payé alors que l\'impôt classique aurait été nul)', c.coutAvecVFL, 330);
  test('écart négatif = -330 (VFL perdant)', c.difference, -330);
  testEq('avantageux = false', c.avantageux, false);
}

section('getVFLComparaison : BIC prestations (abattement 50 %, VFL 1,7 %)');
{
  // CA 50000€ BIC presta (non mixte) : bénéfice = 50000×50% = 25000.
  const D = mkData({ statut: 'micro-bic' });
  const c = getVFLComparaison(D, 50000, 0, 0, 1, false);
  test('bénéfice = 50000 × 50 % = 25000', c.beneficeMicro, 25000);
  test('impôt brut (25000, 1 part) = 1474', c.impotBrutSansVFL, 1474);
  test('décote ≈ 230 (seul, sous 1982)', c.decoteSansVFL, 230);
  test('impôt après décote = 1474 - 230 = 1244', c.irSansVFL, 1244);
  test('VFL = 50000 × 1,7 % = 850', c.vflSurCA, 850);
  test('écart = 1244 - 850 = 394 (avantageux)', c.difference, 394);
}

section('getVFLComparaison : achat-revente / BIC vente non mixte (abattement 71 %, VFL 1 %)');
{
  // CA 90000€ vente pure (micro-achat, non mixte) : bénéfice = 90000×29% = 26100.
  const D = mkData({ statut: 'micro-achat', activiteMixte: false });
  const c = getVFLComparaison(D, 0, 90000, 0, 1, false);
  test('bénéfice = 90000 × 29 % = 26100', c.beneficeMicro, 26100);
  test('impôt brut (26100, 1 part) = 1595', c.impotBrutSansVFL, 1595);
  test('décote ≈ 175', c.decoteSansVFL, 175);
  test('impôt après décote = 1595 - 175 = 1420', c.irSansVFL, 1420);
  test('VFL = 90000 × 1 % = 900', c.vflSurCA, 900);
  test('écart = 1420 - 900 = 520 (avantageux)', c.difference, 520);
}

section('getVFLComparaison : activité mixte (micro-achat), abattements et taux VFL distincts par nature, avec décote');
{
  // presta 30000€ (abattement 50%) + vente 40000€ (abattement 71%) : abattement total = 15000+28400=43400.
  const D = mkData({ statut: 'micro-achat', activiteMixte: true });
  const c = getVFLComparaison(D, 30000, 40000, 0, 1, false);
  test('bénéfice = 70000 - 43400 = 26600', c.beneficeMicro, 26600);
  test('impôt brut (26600, 1 part) = 1650', c.impotBrutSansVFL, 1650);
  test('décote ≈ 150', c.decoteSansVFL, 150);
  test('impôt après décote = 1650 - 150 = 1500', c.irSansVFL, 1500);
  // VFL micro-achat : 2,2 % presta (traité comme BNC) + 1 % vente = 660 + 400 = 1060.
  test('VFL sur CA = 30000×2,2% + 40000×1% = 1060', c.vflSurCA, 1060);
  test('écart = 1500 - 1060 = 440 (avantageux, moins qu\'un calcul sans décote ne le suggérait)', c.difference, 440);
}

section('getVFLComparaison : foyer avec enfants (2,5 parts), quotient familial simple fonctionne, PAS de plafonnement (limite assumée, à signaler dans l\'UI)');
{
  const D = mkData({ statut: 'micro-bnc' });
  const c = getVFLComparaison(D, 50000, 0, 60000, 2.5, true);
  test('bénéfice = 50000 × 66 % = 33000', c.beneficeMicro, 33000);
  test('revenu imposable total = 33000 + 60000 = 93000', c.revenuImposableTotal, 93000);
  test('impôt brut (93000 sur 2,5 parts) = 10660', c.impotBrutSansVFL, 10660);
  testEq('décote nulle (bien au-dessus du seuil couple)', c.decoteSansVFL, 0);
  test('taux effectif ≈ 11,46 %', c.tauxEffectif * 1000, 114.6);
  test('écart ≈ 2683 (sans tenir compte d\'un éventuel plafonnement du quotient familial, non modélisé)', c.difference, 2683);
}

section('getVFLComparaison : hors micro (SASU) → tout à 0, jamais de fuite vers ce statut');
{
  const D = mkData({ statut: 'sasu' });
  const c = getVFLComparaison(D, 40000, 0, 0, 1, false);
  testEq('bénéfice micro = 0 (SASU n\'a pas de bénéfice forfaitaire)', c.beneficeMicro, 0);
  testEq('VFL sur CA = 0 (SASU n\'a pas accès au VFL)', c.vflSurCA, 0);
}

// ── Résumé ────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
