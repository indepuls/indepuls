// ── TESTS : VERSEMENT FISCAL LIBÉRATOIRE (VFL) ────────────────
// Le VFL applique un taux fixe légal directement sur le CA brut, SANS abattement forfaitaire —
// contrairement au barème classique (impotsTaux appliqué après abattement). Réservé au régime
// micro (SASU/EURL n'y ont pas accès). Voir shared/core/taux.js (TAUX_VFL) et le retour Faustine
// 2026-09-17 : "getTauxHoraireMinCible() n'appliquait pas du tout l'abattement sur l'impôt".

import {
  isVersementLiberatoire,
  getImpotEstimeMicro,
  getTauxImpotEffectifPresta,
  getTauxHoraireMinCible,
  getTauxHoraireMinCibleSimule,
} from '../core/calculs.js';

let passed = 0, failed = 0;

function test(label, actual, expected) {
  const ok = Math.abs(actual - expected) <= 1; // tolérance arrondi ±1 €
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${expected}, obtenu ${actual}`); failed++; }
}
function testEq(label, actual, expected) {
  const ok = actual === expected;
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
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

section('isVersementLiberatoire — micro uniquement, jamais SASU/EURL même si le champ est vrai');
{
  testEq('micro-bnc avec le flag = true', isVersementLiberatoire(mkData({ statut: 'micro-bnc', versementLiberatoire: true })), true);
  testEq('SASU avec le flag = true → false (le mécanisme n\'existe pas pour ce statut)', isVersementLiberatoire(mkData({ statut: 'sasu', versementLiberatoire: true })), false);
  testEq('micro-bnc sans le flag → false', isVersementLiberatoire(mkData({ statut: 'micro-bnc' })), false);
}

section('getImpotEstimeMicro — VFL : taux fixe sur le CA brut, sans abattement');
{
  const D = mkData({ statut: 'micro-bnc', versementLiberatoire: true });
  // 2000€ presta, taux BNC 2.2%, aucun abattement déduit avant
  test('micro-bnc VFL : 2000 × 2,2 % = 44', getImpotEstimeMicro(D, 2000, 0), 44);

  const Dmixte = mkData({ statut: 'micro-bic', versementLiberatoire: true, activiteMixte: true });
  // 1000€ presta (BIC service 1,7%) + 2000€ vente (1%) = 17 + 20 = 37
  test('micro-bic mixte VFL : 1000×1,7% + 2000×1% = 37', getImpotEstimeMicro(Dmixte, 1000, 2000), 37);

  const Dachat = mkData({ statut: 'micro-achat', versementLiberatoire: true, activiteMixte: true });
  // micro-achat mixte : la colonne presta suit la convention BNC (2,2%), pas BIC (voir applyStatutParams)
  test('micro-achat mixte VFL : presta traité comme BNC (2,2%) : 1000×2,2% + 2000×1% = 42', getImpotEstimeMicro(Dachat, 1000, 2000), 42);
}

section('getImpotEstimeMicro — SASU reste à 0 même avec le flag VFL activé par erreur');
{
  const D = mkData({ statut: 'sasu', versementLiberatoire: true, remunerationNette: 3000, coutRemunerationPct: 82 });
  testEq('SASU + VFL = 0 (isSASU coupe avant toute logique VFL)', getImpotEstimeMicro(D, 2000, 0), 0);
}

section('getTauxImpotEffectifPresta — barème classique applique bien l\'abattement (régression du bug 2026-09-17)');
{
  const D = mkData({ statut: 'micro-bnc', impotsTaux: 30 });
  // 30% × (1 - 34% d'abattement) = 30% × 0,66 = 19,8%
  test('micro-bnc, TMI 30% : taux effectif = 19,8% (0.198)', getTauxImpotEffectifPresta(D) * 1000, 198);
}

section('getTauxImpotEffectifPresta — VFL ignore l\'abattement, taux fixe direct');
{
  const D = mkData({ statut: 'micro-bnc', versementLiberatoire: true, impotsTaux: 30 });
  // Le TMI (30%) ne doit plus intervenir du tout : seul le taux VFL (2,2%) compte
  test('micro-bnc VFL : taux effectif = 2,2% (0.022), le TMI est ignoré', getTauxImpotEffectifPresta(D) * 1000, 22);
}

section('getTauxHoraireMinCible — l\'objectif de taux horaire baisse une fois l\'abattement pris en compte (barème classique)');
{
  // hAn = 7×5×44 = 1540h. Urssaf = 25,8%. Sans dépenses ni charges complémentaires.
  const D = mkData({ statut: 'micro-bnc', impotsTaux: 30, objectifNetMensuel: 3000 });
  // r = 1 − 0,258 − (0,30×0,66) = 0,544 → CA annuel = 36000/0,544 ≈ 66176 → TH ≈ 42,97 €/h
  test('micro-bnc, TMI 30%, objectif 3000€/mois : TH cible ≈ 42,97 €/h (abattement pris en compte)', getTauxHoraireMinCible(D), 42.97);
}

section('getTauxHoraireMinCible — VFL donne un objectif différent (taux fixe, pas de TMI)');
{
  const D = mkData({ statut: 'micro-bnc', versementLiberatoire: true, impotsTaux: 30, objectifNetMensuel: 3000 });
  // r = 1 − 0,258 − 0,022 = 0,72 → CA annuel = 36000/0,72 = 50000 → TH = 50000/1540 ≈ 32,47 €/h
  test('micro-bnc VFL, objectif 3000€/mois : TH cible ≈ 32,47 €/h (le TMI à 30% est sans effet)', getTauxHoraireMinCible(D), 32.47);
}

section('getTauxHoraireMinCibleSimule — même correction appliquée à la variante "Et si ?"');
{
  const D = mkData({ statut: 'micro-bnc', impotsTaux: 30 });
  const th = getTauxHoraireMinCibleSimule(D, { objectifNetMensuel: 3000 });
  test('Et si ? : même résultat que getTauxHoraireMinCible avec le même objectif', th, 42.97);
}

// ── Résumé ────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
