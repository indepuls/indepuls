/**
 * Tests : palier A "multi-associés" (brique dormante, 2026-10-01, retour bêta Florence)
 *
 * Contexte : aucune infrastructure de partage de compte réelle n'existe encore (pas d'invitation,
 * pas de table de membres, pas d'auth partagée, voir CLAUDE.md). Ce chantier pose seulement le
 * terrain en amont, sans rien changer au comportement actuel :
 *   - mission.auteurId : nouveau champ, backfillé à null pour toute mission existante
 *     (applyDefaults), jamais requis, jamais lu nulle part d'autre pour l'instant.
 *   - getDataPourMembre(DATA, membreId) : fonction pure, pas encore appelée depuis l'UI.
 *     Sans membreId, renvoie DATA tel quel (vue globale inchangée). Avec un membreId, filtre
 *     les missions par auteurId : c'est la brique que réutiliseront les futurs widgets "vue
 *     individuelle" sans toucher au moteur de calcul existant.
 *
 * Exécution : node shared/tests/multi_associes.test.js
 */

'use strict';
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');

let PASS = 0, FAIL = 0;
function eq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function test(label, expected, actual) {
  if (eq(expected, actual)) {
    PASS++;
    console.log(`  ✅ ${label}`);
  } else {
    FAIL++;
    console.log(`  ❌ ${label} : attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
  }
}
function section(title) { console.log(`\n── ${title} ──────────────────────────────`); }

async function main() {
  const C = await import(pathToFileURL(path.join(ROOT, 'core', 'calculs.js')).href);
  const S = await import(pathToFileURL(path.join(ROOT, 'core', 'storage.js')).href);

  section('getDataPourMembre : sans membreId, vue globale inchangée');
  {
    const D = { missions: [{ id: 'm1', auteurId: 'florence' }, { id: 'm2', auteurId: 'associe' }] };
    test('membreId undefined → DATA renvoyé tel quel', D, C.getDataPourMembre(D, undefined));
    test('membreId null → DATA renvoyé tel quel', D, C.getDataPourMembre(D, null));
  }

  section('getDataPourMembre : avec membreId, filtre uniquement les missions de cette personne');
  {
    const D = {
      params: { metier: 'prestataire_services' },
      missions: [
        { id: 'm1', auteurId: 'florence' },
        { id: 'm2', auteurId: 'associe' },
        { id: 'm3', auteurId: 'florence' },
        { id: 'm4', auteurId: null },
      ],
    };
    const vue = C.getDataPourMembre(D, 'florence');
    test('2 missions pour florence', 2, vue.missions.length);
    test('les 2 bonnes missions (m1, m3)', ['m1', 'm3'], vue.missions.map(m => m.id));
    test('les autres clés de DATA sont préservées (params)', D.params, vue.params);
    test('DATA original non muté', 4, D.missions.length);
  }

  section('getDataPourMembre : un membre sans aucune mission renvoie une liste vide, pas une erreur');
  {
    const D = { missions: [{ id: 'm1', auteurId: 'florence' }] };
    const vue = C.getDataPourMembre(D, 'personne-jamais-vue');
    test('0 mission, aucun crash', 0, vue.missions.length);
  }

  section('applyDefaults : mission.auteurId backfillé à null pour une mission existante (compte préexistant)');
  {
    const data = { params: {}, missions: [{ id: 'm1' }] };
    const out = S.applyDefaults(data, { params: {} });
    test('auteurId absent → backfillé à null (pas de perte, pas d\'invention d\'identité)', null, out.missions[0].auteurId);
  }

  section('applyDefaults : mission.auteurId déjà présent → jamais écrasé');
  {
    const data = { params: {}, missions: [{ id: 'm1', auteurId: 'florence' }] };
    const out = S.applyDefaults(data, { params: {} });
    test('auteurId existant préservé', 'florence', out.missions[0].auteurId);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Résultat : ${PASS} tests passés, ${FAIL} échoués`);
  if (FAIL > 0) process.exitCode = 1;
}

main();
