// ── TESTS : TRÉSORERIE SASU/EURL ──────────────────────────────
// Couvre les fonctions de shared/core/calculs.js utilisées par renderSasuCard()
// et par le calculateur d'objectifs SASU/EURL — non couvertes avant ce fichier
// (voir audit du 2026-07, question de Faustine sur la couverture des suites).
// EURL suit exactement le même code (isSASU() renvoie true pour les deux
// statuts) — seul coutRemunerationPct change de valeur, pas la formule.

import {
  getSasuCoutMensuelDepuisNet,
  getSasuCoutRemuMensuel,
  getTresorerieDepart,
  getSasuSoldeActuelEstime,
} from '../core/calculs.js';

// ── Helpers ───────────────────────────────────────────────────

let passed = 0, failed = 0;

function test(label, actual, expected) {
  const ok = Math.abs(actual - expected) <= 1; // tolérance arrondi ±1 €
  if (ok) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${expected}, obtenu ${actual}`); failed++; }
}

function mkData(o = {}) {
  return {
    currentYear: o.currentYear || new Date().getFullYear(),
    params: {
      statut: 'sasu', remunerationNette: 0, coutRemunerationPct: 80,
      tva: false, tauxTVA: 20, tvaRegime: 'mensuel', impotsTaux: 0, activiteMixte: false,
      tauxURSSAF: 0, tauxCFP: 0, tresorerieParAnnee: {}, dateOuverture: '',
      ...(o.params || {}),
    },
    missions: o.missions || [],
    depenses: o.depenses || [],
    revenus: o.revenus || {},
  };
}

function section(title) { console.log(`\n── ${title}`); }

// ── 1. Net → coût société ──────────────────────────────────────

section('getSasuCoutMensuelDepuisNet — pure, indépendante de DATA.params.remunerationNette');
test('SASU 3000€ net, 80% → 5400€', getSasuCoutMensuelDepuisNet(mkData(), 3000), 5400);
test('EURL 3000€ net, 45% → 4350€', getSasuCoutMensuelDepuisNet(mkData({ params: { coutRemunerationPct: 45 } }), 3000), 4350);
test('net = 0 → coût = 0', getSasuCoutMensuelDepuisNet(mkData(), 0), 0);
test('coutRemunerationPct absent → 80% par défaut', getSasuCoutMensuelDepuisNet(mkData({ params: { coutRemunerationPct: undefined } }), 1000), 1800);

// ── 2. Coût de la rémunération réellement configurée ────────────

section('getSasuCoutRemuMensuel — délègue à getSasuCoutMensuelDepuisNet avec remunerationNette');
test('remunerationNette=800, 80% → 1440€', getSasuCoutRemuMensuel(mkData({ params: { remunerationNette: 800 } })), 1440);
test('remunerationNette=0 (défaut) → 0', getSasuCoutRemuMensuel(mkData()), 0);

// ── 3. Trésorerie de départ ──────────────────────────────────────

section('getTresorerieDepart');
test('année en cours présente dans le map → valeur exacte', getTresorerieDepart(mkData({ currentYear: 2026, params: { tresorerieParAnnee: { 2026: 5000 } } })), 5000);
test('année absente du map → 0', getTresorerieDepart(mkData({ currentYear: 2026, params: { tresorerieParAnnee: { 2025: 5000 } } })), 0);
test('tresorerieParAnnee absent → 0', getTresorerieDepart(mkData({ currentYear: 2026, params: { tresorerieParAnnee: undefined } })), 0);

// ── 4. Solde actuel estimé ────────────────────────────────────────

section('getSasuSoldeActuelEstime — sans CA ni dépense, seule la rémunération mensuelle est déduite');
{
  const now = new Date();
  const anneeEnCours = now.getFullYear();
  const moisEcoules = now.getMonth() + 1; // janvier..mois courant inclus
  const D = mkData({
    currentYear: anneeEnCours,
    params: { remunerationNette: 800, coutRemunerationPct: 80, tresorerieParAnnee: { [anneeEnCours]: 10000 } },
  });
  // remu mensuelle = 800 × 1,8 = 1440€ ; déduite pour chaque mois écoulé depuis janvier.
  const attendu = 10000 - 1440 * moisEcoules;
  test('solde = trésorerie de départ − (remu mensuelle × mois écoulés)', getSasuSoldeActuelEstime(D), attendu);
}
{
  // EURL : même formule, coefficient différent (45% au lieu de 80%).
  const now = new Date();
  const anneeEnCours = now.getFullYear();
  const moisEcoules = now.getMonth() + 1;
  const D_EURL = mkData({
    currentYear: anneeEnCours,
    params: { statut: 'eurl', remunerationNette: 800, coutRemunerationPct: 45, tresorerieParAnnee: { [anneeEnCours]: 10000 } },
  });
  const attendu = 10000 - 1160 * moisEcoules; // 800 × 1,45 = 1160
  test('EURL — même formule avec coutRemunerationPct=45%', getSasuSoldeActuelEstime(D_EURL), attendu);
}

// ── Résumé ────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
