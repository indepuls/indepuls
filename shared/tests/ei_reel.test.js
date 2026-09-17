// ── TESTS : EI AU RÉEL ────────────────────────────────────────
// Nouveau régime fiscal (chantier 2026-09-17, feu vert Faustine "Ok go pour B, step by step").
// Contrairement à la micro-entreprise : pas d'abattement forfaitaire, base = bénéfice réel
// (CA - dépenses réelles). Cotisations TNS approximées par un taux forfaitaire ajustable
// (tauxChargesTNS, défaut 35%), impôt appliqué directement sur le bénéfice réel (TMI).

import {
  isEIReel,
  isMicro,
  getBeneficeReelMois,
  getTauxChargesTNS,
  getCotisationsTNSEstimees,
  getImpotEIReel,
  getTauxHoraireMinCible,
  getTauxHoraireMinCibleSimule,
  getComparateurStatuts,
} from '../core/calculs.js';

let passed = 0, failed = 0;

function test(label, actual, expected) {
  const ok = Math.abs(actual - expected) <= 1; // tolérance arrondi ±1 €
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
    params: { tauxURSSAF: 25.6, tauxCFP: 0.2, impotsTaux: 0, activiteMixte: false,
      heuresParJour: 7, joursParSemaine: 5, semainesParAn: 44, ...params },
    missions: [], depenses: [], revenus: {},
  };
}

section('isEIReel / isMicro : reconnaissance des statuts');
{
  testEq('ei-reel → isEIReel true', isEIReel(mkData({ statut: 'ei-reel' })), true);
  testEq('micro-bnc → isEIReel false', isEIReel(mkData({ statut: 'micro-bnc' })), false);
  testEq('sasu → isEIReel false', isEIReel(mkData({ statut: 'sasu' })), false);
  testEq('micro-bnc → isMicro true', isMicro(mkData({ statut: 'micro-bnc' })), true);
  testEq('micro-bic → isMicro true', isMicro(mkData({ statut: 'micro-bic' })), true);
  testEq('micro-achat → isMicro true', isMicro(mkData({ statut: 'micro-achat' })), true);
  testEq('ei-reel → isMicro false', isMicro(mkData({ statut: 'ei-reel' })), false);
  testEq('sasu → isMicro false', isMicro(mkData({ statut: 'sasu' })), false);
}

section('getTauxChargesTNS : taux forfaitaire ajustable, défaut 35%');
{
  test('défaut (non renseigné) = 35%', getTauxChargesTNS(mkData({ statut: 'ei-reel' })) * 1000, 350);
  test('valeur personnalisée à 40%', getTauxChargesTNS(mkData({ statut: 'ei-reel', tauxChargesTNS: 40 })) * 1000, 400);
}

section('getBeneficeReelMois : CA du mois moins dépenses réelles du mois, jamais négatif');
{
  const D = mkData({ statut: 'ei-reel' });
  D.revenus['2026-03'] = { autresList: [{ montantPrestation: 10000 }] };
  D.depenses = [{ date: '2026-03-01', recurrence: 'ponctuelle', montant: 2000 }];
  test('CA 10000 - dépenses 2000 = bénéfice 8000', getBeneficeReelMois(D, '2026-03'), 8000);

  const D2 = mkData({ statut: 'ei-reel' });
  D2.revenus['2026-03'] = { autresList: [{ montantPrestation: 1000 }] };
  D2.depenses = [{ date: '2026-03-01', recurrence: 'ponctuelle', montant: 5000 }];
  testEq('dépenses > CA → bénéfice plancher à 0 (jamais négatif)', getBeneficeReelMois(D2, '2026-03'), 0);
}

section('getCotisationsTNSEstimees / getImpotEIReel : deux provisions indépendantes sur le même bénéfice');
{
  const D = mkData({ statut: 'ei-reel', tauxChargesTNS: 35, impotsTaux: 11 });
  test('cotisations TNS : 8000 × 35% = 2800', getCotisationsTNSEstimees(D, 8000), 2800);
  test('impôt : 8000 × 11% = 880', getImpotEIReel(D, 8000), 880);

  const Dmicro = mkData({ statut: 'micro-bnc', tauxChargesTNS: 35, impotsTaux: 11 });
  testEq('hors EI-réel, les deux fonctions renvoient 0 (pas de fuite vers les autres statuts)', getCotisationsTNSEstimees(Dmicro, 8000), 0);
  testEq('hors EI-réel, impôt EI-réel = 0', getImpotEIReel(Dmicro, 8000), 0);
}

section('getTauxHoraireMinCible : EI au réel, formule inversée spécifique (dépenses avant le taux, pas après)');
{
  // hAn = 7×5×44 = 1540h. tauxChargesTNS 35%, TMI 11%, objectif net 4320€/mois, dépenses 2000€/mois.
  // r = 1 − 0,35 − 0,11 = 0,54 → bénéfice mensuel = 4320/0,54 = 8000 → CA mensuel = 8000+2000 = 10000
  // → CA annuel = 120000 → TH = 120000/1540 ≈ 77,92 €/h
  const D = mkData({ statut: 'ei-reel', tauxChargesTNS: 35, impotsTaux: 11, objectifNetMensuel: 4320 });
  D.depenses = [{ date: '2026-01-01', recurrence: 'mensuelle', montant: 2000 }];
  test('EI-réel, TMI 11%, objectif 4320€/mois, dépenses 2000€/mois : TH cible ≈ 77,92 €/h', getTauxHoraireMinCible(D), 77.92);
}

section('getTauxHoraireMinCibleSimule : même correction appliquée à la variante "Et si ?"');
{
  const D = mkData({ statut: 'ei-reel', tauxChargesTNS: 35, impotsTaux: 11 });
  D.depenses = [{ date: '2026-01-01', recurrence: 'mensuelle', montant: 2000 }];
  const th = getTauxHoraireMinCibleSimule(D, { objectifNetMensuel: 4320 });
  test('Et si ? : même résultat que getTauxHoraireMinCible avec le même objectif', th, 77.92);
}

section('getComparateurStatuts : colonne "EI au réel" du comparateur "Et si je changeais de statut ?"');
{
  // Compte actuellement micro-bnc simulant "et si j'étais en EI au réel" avec un CA de 10000€/mois,
  // 35% de TNS et un TMI de 11% déjà configurés (comparateur toujours basé sur les taux du compte,
  // peu importe le statut réel — même logique que microSansTVA/eurl/sasu ci-dessus).
  const D = mkData({ statut: 'micro-bnc', tauxChargesTNS: 35, impotsTaux: 11 });
  const comp = getComparateurStatuts(D, 10000, true, ['2026-01'], 'micro-bnc');
  // bénéfice réel = 10000 (aucune dépense saisie) ; cotisTNS = 3500 ; impôt = 1100 ; eiReel = 5400
  test('eiReel : bénéfice 10000, cotisations 35% + impôt 11% = 5400 restants', comp.eiReel, 5400);
}

// ── Résumé ────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
