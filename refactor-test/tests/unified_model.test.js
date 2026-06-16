/**
 * Tests — modèle unifié montantDevis = montantPrestation + montantVente
 *
 * Contexte : harmonisation décidée pour préparer les futurs métiers
 * (Artisan, Freelance, UGC, conciergerie, photographe, agence, consultant...)
 * autour d'un seul moteur de calcul. Voir refactor-test/README.md.
 *
 * Couvre :
 *   - getCaBreakdownMois / getMissionVenteRatio en Freelance et Artisan,
 *     prestation seule et prestation+vente
 *   - getRevenuNetMois en activité mixte (impact TVA/charges du split)
 *   - migration de cohérence (applyDefaults) sur une mission Artisan legacy
 *     dont montantPrestation/montantVente ne correspondent pas à montantDevis
 *
 * Exécution : node refactor-test/tests/unified_model.test.js
 */

'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');

let PASS = 0, FAIL = 0;
function eq(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) < 0.0001;
  return JSON.stringify(a) === JSON.stringify(b);
}
function test(label, expected, actual) {
  if (eq(expected, actual)) {
    PASS++;
    console.log(`  ✅ ${label}`);
  } else {
    FAIL++;
    console.log(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
  }
}
function section(title) { console.log(`\n── ${title} ──────────────────────────────`); }

function baseData(overrides = {}) {
  return Object.assign({
    currentYear: 2026,
    params: {
      statut: 'micro-bnc', activiteMixte: false, impotsTaux: 0,
      tauxURSSAF: 25.6, tauxCFP: 0.2, chargesSalariales: 0,
      tauxCotisationsVente: 12.3, tauxCFPVente: 0.1,
    },
    missions: [], depenses: [], revenus: {},
  }, overrides);
}

function mission(overrides = {}) {
  return Object.assign({
    id: 'm1', isManagement: false, isRecurring: false,
    statut: 'fact', dateFact: '2026-03-10',
    montantDevis: 1000, montantPrestation: 1000, montantVente: 0,
    encaissements: [],
  }, overrides);
}

async function main() {
  const C = await import(pathToFileURL(path.join(ROOT, 'core', 'calculs.js')).href);
  const S = await import(pathToFileURL(path.join(ROOT, 'core', 'storage.js')).href);

  section('Freelance — prestation seule (montantVente = 0)');
  {
    const D = baseData({ params: { ...baseData().params, activiteMixte: true } });
    D.missions = [mission({ montantDevis: 1000, montantPrestation: 1000, montantVente: 0 })];
    const bk = C.getCaBreakdownMois(D, '2026-03');
    test('presta = 1000', 1000, bk.presta);
    test('vente = 0', 0, bk.vente);
  }

  section('Freelance — prestation + vente');
  {
    const D = baseData({ params: { ...baseData().params, activiteMixte: true } });
    D.missions = [mission({ montantDevis: 1000, montantPrestation: 600, montantVente: 400 })];
    const bk = C.getCaBreakdownMois(D, '2026-03');
    test('presta = 600', 600, bk.presta);
    test('vente = 400', 400, bk.vente);
    test('ratio vente = 0.4', 0.4, C.getMissionVenteRatio(D, D.missions[0]));
  }

  section('Artisan — prestation + vente (mission cohérente)');
  {
    const D = baseData({ params: { ...baseData().params, activiteMixte: true } });
    D.missions = [mission({ montantDevis: 961, montantPrestation: 711, montantVente: 250 })];
    const bk = C.getCaBreakdownMois(D, '2026-03');
    test('presta = 711', 711, bk.presta);
    test('vente = 250', 250, bk.vente);
  }

  section('Activité mixte + TVA — getRevenuNetMois cohérent avec le split');
  {
    const D = baseData({
      params: {
        statut: 'micro-bnc', activiteMixte: true, impotsTaux: 0,
        tauxURSSAF: 25.6, tauxCFP: 0.2, chargesSalariales: 0,
        tauxCotisationsVente: 12.3, tauxCFPVente: 0.1,
        tvaFranchise: 1000000, tvaTolerance: 1000000, // hors champ TVA pour isoler le test
      },
    });
    D.missions = [mission({ montantDevis: 1000, montantPrestation: 700, montantVente: 300 })];
    const net = C.getRevenuNetMois(D, '2026-03');
    // 700 presta * 25.8% + 300 vente * 12.4% = 180.6 + 37.2 = 217.8 charges
    const expected = 1000 - 217.8;
    test('revenu net mixte = CA - charges pondérées par le split', expected, net);
  }

  section('Migration de cohérence — mission Artisan legacy (devis sans ventilation)');
  {
    // Reproduit le cas réel trouvé en diagnostic : montantDevis renseigné,
    // montantPrestation/montantVente jamais saisis (restent à 0 après import).
    const D = baseData({ params: { ...baseData().params, activiteMixte: true } });
    D.missions = [{
      id: 'legacy1', isManagement: false, isRecurring: false,
      statut: 'fact', dateFact: '2026-06-12',
      montantDevis: 961, montantPrestation: 0, montantVente: 0,
      encaissements: [],
    }];
    const fixed = S.applyDefaults(D, baseData());
    test('montantPrestation rétabli à 961 (devis - vente)', 961, fixed.missions[0].montantPrestation);
    test('montantVente inchangé à 0', 0, fixed.missions[0].montantVente);

    const bk = C.getCaBreakdownMois(fixed, '2026-06');
    test('getCaBreakdownMois retrouve le CA complet après migration', 961, bk.presta);
  }

  section('Migration de cohérence — mission déjà cohérente : aucune altération');
  {
    const D = baseData({ params: { ...baseData().params, activiteMixte: true } });
    D.missions = [mission({ montantDevis: 500, montantPrestation: 300, montantVente: 200 })];
    const fixed = S.applyDefaults(D, baseData());
    test('montantPrestation inchangé', 300, fixed.missions[0].montantPrestation);
    test('montantVente inchangé', 200, fixed.missions[0].montantVente);
  }

  section('Migration de cohérence — mission récurrente non touchée');
  {
    const D = baseData({ params: { ...baseData().params, activiteMixte: true } });
    D.missions = [{
      id: 'rec1', isManagement: false, isRecurring: true,
      statut: 'fact', dateDebutRec: '2026-01', nbMoisRec: 6, montantMensuel: 200,
      montantDevis: 1200, montantPrestation: 0, montantVente: 0,
      encaissements: [],
    }];
    const fixed = S.applyDefaults(D, baseData());
    // Une récurrente n'a pas de notion de ventilation par mission — on ne la backfill pas.
    test('montantPrestation laissé à 0 pour une récurrente', 0, fixed.missions[0].montantPrestation);
  }

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`  ${PASS} PASS  |  ${FAIL} FAIL`);
  console.log(`══════════════════════════════════════════════════`);
  if (FAIL > 0) process.exitCode = 1;
}

main();
