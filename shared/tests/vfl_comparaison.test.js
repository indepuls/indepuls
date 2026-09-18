// ── TESTS : SIMULATEUR VFL — COMPARAISON AVEC/SANS VFL (étape 2/5, chantier 2026-09-18) ──────
// Mécanisme du "taux effectif" (source DGFIP/BOFiP, confirmé par Faustine) : sous VFL, le
// bénéfice micro forfaitaire n'est pas réimposé au barème, mais reste intégré au revenu du foyer
// pour déterminer le taux moyen appliqué aux AUTRES revenus. Barème 2026 sur revenus 2025
// (source : service-public.fr) : 0 % jusqu'à 11 600 €, 11 % jusqu'à 29 579 €, 30 % jusqu'à
// 84 577 €, 41 % jusqu'à 181 917 €, 45 % au-delà. Décote 2026 (source : economie.gouv.fr) :
// 897 − 45,25 % de l'impôt brut (personne seule, sous 1 982 €), 1 483 − 45,25 % (couple, sous
// 3 277 €), repérée manquante lors d'une relecture externe (ChatGPT) du premier jet de ce
// moteur, vérifiée indépendamment ici avant correction.

import { getImpotBaremeProgressif, getDecoteIR, getImpotAvecPlafonnementQF, getVFLComparaison, getVFLPointBascule } from '../core/calculs.js';

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

section('getImpotAvecPlafonnementQF : vérifié sur l\'exemple chiffré officiel du BOFiP (BOI-IR-LIQ-20-20-20)');
{
  // Couple marié, 4 enfants (5 parts : 2 + 0,5 + 0,5 + 1 + 1, les enfants à partir du 3e comptant
  // pour une part entière), 130 000 € de revenu imposable. Le BOFiP donne lui-même le résultat
  // intermédiaire à chaque étape : 7 920 € avec 5 parts, 25 208 € avec 2 parts, plafond total
  // 6 demi-parts × 1 807 € = 10 842 €, impôt plafonné 25 208 - 10 842 = 14 366 €, retenu car
  // supérieur aux 7 920 € du calcul à 5 parts.
  const r = getImpotAvecPlafonnementQF(130000, 5, true);
  test('impôt avec quotient familial complet (5 parts) = 7920 (donné par le BOFiP)', getImpotBaremeProgressif(130000, 5), 7920);
  test('impôt avec les seules parts de référence (2 parts) = 25208 (donné par le BOFiP)', getImpotBaremeProgressif(130000, 2), 25208);
  testEq('le plafonnement s\'applique (14366 > 7920)', r.plafonnementApplique, true);
  test('impôt final = 25208 - (6 × 1807) = 14366, exactement la valeur du BOFiP', r.impotBrut, 14366);
}

section('getVFLComparaison : foyer avec enfants, cas 1/3 demandés par Faustine, revenus modestes, le plafonnement NE s\'applique PAS');
{
  // Couple + 1 enfant (2,5 parts), revenu total 43 100 €. L'avantage de la demi-part supplémentaire
  // (638 €) reste sous le plafond (1807 €) : le calcul classique du quotient familial suffit.
  const D = mkData({ statut: 'micro-bnc' });
  const c = getVFLComparaison(D, 35000, 0, 20000, 2.5, true);
  test('bénéfice = 35000 × 66 % = 23100', c.beneficeMicro, 23100);
  test('revenu imposable total = 23100 + 20000 = 43100', c.revenuImposableTotal, 43100);
  testEq('plafonnement non déclenché (avantage des parts sous le plafond)', c.plafonnementQFApplique, false);
  test('impôt brut = 1551 (calcul classique du quotient familial, sans correction)', c.impotBrutSansVFL, 1551);
}

section('getVFLComparaison : cas 2/3, même type de foyer, revenus plus élevés, le plafonnement S\'APPLIQUE');
{
  // Même composition (couple + 1 enfant, 2,5 parts), revenu total 93 000 €. Cette fois l'avantage
  // de la demi-part (3448 €) dépasse largement le plafond (1807 €) : l'impôt est recalculé à la
  // hausse par rapport au simple quotient familial (10 660 € → 12 301 €).
  const D = mkData({ statut: 'micro-bnc' });
  const c = getVFLComparaison(D, 50000, 0, 60000, 2.5, true);
  test('bénéfice = 50000 × 66 % = 33000', c.beneficeMicro, 33000);
  test('revenu imposable total = 33000 + 60000 = 93000', c.revenuImposableTotal, 93000);
  testEq('plafonnement déclenché (avantage des parts au-dessus du plafond)', c.plafonnementQFApplique, true);
  test('impôt brut plafonné = 12301 (et non 10660 sans plafonnement)', c.impotBrutSansVFL, 12301);
  testEq('décote nulle (bien au-dessus du seuil couple)', c.decoteSansVFL, 0);
  test('écart VFL = 12301 - (taux effectif × 60000 + VFL) ≈ 3265', c.difference, 3265);
}

section('getVFLComparaison : cas 3/3, le plafonnement modifie sensiblement l\'écart VFL/barème (famille nombreuse, hauts revenus)');
{
  // Couple + 3 enfants (parts : 2 + 0,5 + 0,5 + 1 = 4, le 3e enfant comptant pour une part
  // entière), revenu total 152 800 €. Sans tenir compte du plafonnement, l'écart calculé serait
  // ≈ 4547 € ; avec, il est de ≈ 6817 €, soit environ 50 % de plus, exactement le genre d'écart
  // que Faustine redoutait de voir faussé si le plafonnement n'était pas modélisé.
  const D = mkData({ statut: 'micro-bnc' });
  const c = getVFLComparaison(D, 80000, 0, 100000, 4, true);
  test('bénéfice = 80000 × 66 % = 52800', c.beneficeMicro, 52800);
  test('revenu imposable total = 52800 + 100000 = 152800', c.revenuImposableTotal, 152800);
  testEq('plafonnement déclenché', c.plafonnementQFApplique, true);
  test('impôt brut plafonné = 24820 (contre 18256 sans plafonnement, +36 %)', c.impotBrutSansVFL, 24820);
  test('écart VFL avec plafonnement correctement pris en compte ≈ 6817 (et non ≈ 4547 sans plafonnement)', c.difference, 6817);
}

section('getVFLComparaison : hors micro (SASU) → tout à 0, jamais de fuite vers ce statut');
{
  const D = mkData({ statut: 'sasu' });
  const c = getVFLComparaison(D, 40000, 0, 0, 1, false);
  testEq('bénéfice micro = 0 (SASU n\'a pas de bénéfice forfaitaire)', c.beneficeMicro, 0);
  testEq('VFL sur CA = 0 (SASU n\'a pas accès au VFL)', c.vflSurCA, 0);
}

section('getVFLPointBascule : personne seule, sans autre revenu, micro-bnc (cas courant, crossing attendu dans la fenêtre micro)');
{
  const D = mkData({ statut: 'micro-bnc' });
  const plafondBnc = 83600;
  const b = getVFLPointBascule(D, 1, 0, 1, false, plafondBnc);
  testEq('un point de bascule existe dans la limite du plafond micro-bnc', b.existe, true);
  if (b.existe && b.caBascule > 0) {
    const avant = getVFLComparaison(D, Math.max(0, b.caBascule - 2000), 0, 0, 1, false);
    const apres = getVFLComparaison(D, b.caBascule, 0, 0, 1, false);
    testEq('juste avant le point de bascule, le VFL est désavantageux', avant.avantageux, false);
    testEq('au point de bascule, le VFL est avantageux (ou à l\'équilibre)', apres.avantageux || apres.difference === 0, true);
  }
}

section('getVFLPointBascule : conjoint à très hauts revenus (tranche à 45 %) → VFL avantageux dès un CA quasi nul');
{
  const D = mkData({ statut: 'micro-bnc' });
  const b = getVFLPointBascule(D, 1, 300000, 2, true, 83600);
  testEq('un point de bascule existe', b.existe, true);
  testEq('point de bascule quasi nul (sous 1 000 €, avantageux dès un CA symbolique)', b.caBascule < 1000, true);
  const c = getVFLComparaison(D, 1000, 0, 300000, 2, true);
  testEq('vérification directe : dès 1 000 € de CA, le VFL est déjà avantageux', c.avantageux, true);
}

section('getVFLPointBascule : fenêtre de recherche trop courte → aucun point de bascule trouvé (existe:false), jamais un résultat inventé');
{
  const D = mkData({ statut: 'micro-bnc' });
  const caMaxCourt = 3000; // largement sous le CA nécessaire pour dépasser l'abattement + décote
  const b = getVFLPointBascule(D, 1, 0, 1, false, caMaxCourt);
  testEq('aucun point de bascule trouvé sous 3 000 € de CA', b.existe, false);
  const c = getVFLComparaison(D, caMaxCourt, 0, 0, 1, false);
  testEq('vérification directe : le VFL est toujours désavantageux à ce niveau de CA', c.avantageux, false);
}

section('getVFLPointBascule : garde-fou, caMaxRecherche nul ou négatif → existe:false sans tenter le calcul');
{
  const D = mkData({ statut: 'micro-bnc' });
  testEq('caMaxRecherche = 0', getVFLPointBascule(D, 1, 0, 1, false, 0).existe, false);
  testEq('caMaxRecherche négatif', getVFLPointBascule(D, 1, 0, 1, false, -1000).existe, false);
}

// ── Résumé ────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
