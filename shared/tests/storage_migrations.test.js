// ── TESTS : migrate()/applyDefaults() — réconciliation storage.js ↔ indepuls.html ──
// Contexte (audit externe 2026-07-26, "duplication B") : storage.js est mort en production
// (import inutilisé dans unified.js) mais testé isolément par unified_model.test.js — les tests
// passaient donc sur une version qui n'est plus celle réellement utilisée par les utilisateurs.
// indepuls.html a accumulé 7 évolutions réelles dans ses copies inline de migrate()/applyDefaults()
// jamais reportées ici : migration modePlanning → modules.calendrier/estimation, migration
// modules.planning (string) → booléens, datation du temps réel accumulé (timerAccumulated →
// tempsManuel), v32 (retours[]), v33 (lots[]), défaut recettesManuel/sessions, et la migration
// "collectif" (tempsCreation/Animation/Support → tempsManuel catégorisé, chantier vue calendrier
// Phase 3 2026-07). Ces tests couvrent chaque évolution pour que storage.js redevienne un miroir
// fidèle avant toute tentative de le re-brancher.

import { migrate, applyDefaults } from '../core/storage.js';

let passed = 0, failed = 0;
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function test(label, actual, expected) {
  if (eq(actual, expected)) { console.log(`  ✅ ${label}`); passed++; }
  else { console.error(`  ❌ ${label} — attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`); failed++; }
}
function section(title) { console.log(`\n── ${title}`); }

let _uuidCounter = 0;
const uuid = () => `uuid-${++_uuidCounter}`;
const today = () => '2026-07-27';
const getDefaultModules = (metier) => ({ calendrier: false, estimation: true, objectif: true, uniteTemps: 'heure' });

section('migrate — modePlanning → modules.calendrier/estimation');
{
  const data = { params: { modePlanning: 'calendrier' }, missions: [] };
  const out = migrate(data, 31, { getDefaultModules, uuid, today });
  test('modules.calendrier=true', out.params.modules.calendrier, true);
  test('modules.estimation=false', out.params.modules.estimation, false);
  test('modePlanning supprimé', out.params.modePlanning, undefined);
}
section('migrate — modePlanning=estimation → estimation seule');
{
  const data = { params: { modePlanning: 'estimation' }, missions: [] };
  const out = migrate(data, 31, { getDefaultModules, uuid, today });
  test('modules.calendrier=false', out.params.modules.calendrier, false);
  test('modules.estimation=true', out.params.modules.estimation, true);
}
section('migrate — sans deps fournies, la branche modePlanning est ignorée (pas de crash)');
{
  const data = { params: { modePlanning: 'calendrier' }, missions: [] };
  const out = migrate(data, 31);
  test('modePlanning laissé intact si getDefaultModules absent', out.params.modePlanning, 'calendrier');
}

section('migrate — modules.planning (string) → booléens');
{
  const data = { params: { modules: { planning: 'calendrier' } }, missions: [] };
  const out = migrate(data, 31, { getDefaultModules, uuid, today });
  test('modules.calendrier=true', out.params.modules.calendrier, true);
  test('modules.estimation=false', out.params.modules.estimation, false);
  test('modules.planning supprimé', out.params.modules.planning, undefined);
}

section('migrate — datation du temps réel (timerAccumulated → tempsManuel)');
{
  const data = { params: {}, missions: [{ id: 'm1', timerAccumulated: 3600000 }] };
  const out = migrate(data, 31, { getDefaultModules, uuid, today });
  test('timerAccumulated remis à 0', out.missions[0].timerAccumulated, 0);
  test('tempsManuel contient une entrée datée', out.missions[0].tempsManuel.length, 1);
  test('entrée datée du jour', out.missions[0].tempsManuel[0].date, '2026-07-27');
  test('ms conservés', out.missions[0].tempsManuel[0].ms, 3600000);
}
section('migrate — timerAccumulated=0 → aucune entrée créée');
{
  const data = { params: {}, missions: [{ id: 'm1', timerAccumulated: 0, tempsManuel: [] }] };
  const out = migrate(data, 31, { getDefaultModules, uuid, today });
  test('tempsManuel reste vide', out.missions[0].tempsManuel.length, 0);
}

section('migrate — v32 : retours[] par défaut si absent');
{
  const out = migrate({ params: {}, missions: [] }, 31, { getDefaultModules, uuid, today });
  test('retours=[]', out.retours, []);
}
section('migrate — v32 : retours[] existant préservé');
{
  const out = migrate({ params: {}, missions: [], retours: [{ id: 'r1' }] }, 31, { getDefaultModules, uuid, today });
  test('retours préservé', out.retours, [{ id: 'r1' }]);
}
section('migrate — v33 : lots[] par défaut si absent');
{
  const out = migrate({ params: {}, missions: [] }, 31, { getDefaultModules, uuid, today });
  test('lots=[]', out.lots, []);
}

section('applyDefaults — modules manquants entièrement complétés via getDefaultModules');
{
  const data = { params: {}, missions: [] };
  const def = { params: {} };
  const out = applyDefaults(data, def, { getDefaultModules, uuid, today });
  test('modules créés', out.params.modules, { calendrier: false, estimation: true, objectif: true, uniteTemps: 'heure' });
}
section('applyDefaults — modules partiels complétés champ par champ (jamais écrasés)');
{
  const data = { params: { modules: { calendrier: true } }, missions: [] };
  const def = { params: {} };
  const out = applyDefaults(data, def, { getDefaultModules, uuid, today });
  test('calendrier existant préservé (true, pas écrasé par le défaut false)', out.params.modules.calendrier, true);
  test('estimation complété depuis le défaut', out.params.modules.estimation, true);
}
section('applyDefaults — sans deps fournies, pas de crash, modules non touchés');
{
  const data = { params: {}, missions: [] };
  const def = { params: {} };
  const out = applyDefaults(data, def);
  test('modules absent si getDefaultModules non fourni', out.params.modules, undefined);
}

section('applyDefaults — recettesManuel défaut []');
{
  const out = applyDefaults({ params: {}, missions: [] }, { params: {} });
  test('recettesManuel=[]', out.recettesManuel, []);
}
section('applyDefaults — mission.sessions défaut []');
{
  const out = applyDefaults({ params: {}, missions: [{ id: 'm1' }] }, { params: {} });
  test('sessions=[]', out.missions[0].sessions, []);
}

section('applyDefaults — migration collectif : temps réparti en tempsManuel catégorisé, idempotente');
{
  const data = {
    params: {}, categoriesTemps: ['Autre'],
    missions: [{
      id: 'coll1', typeMission: 'collectif', dateFact: '2026-05-01',
      tempsCreation: 2, tempsAnimation: 1, tempsSupport: 0,
    }],
  };
  const out = applyDefaults(data, { params: {} }, { getDefaultModules, uuid, today });
  const m = out.missions[0];
  test('tempsCreation remis à 0', m.tempsCreation, 0);
  test('tempsAnimation remis à 0', m.tempsAnimation, 0);
  test('2 entrées tempsManuel créées (Création + Animation, Suivi=0 ignoré)', m.tempsManuel.length, 2);
  test('catégorie Création présente', m.tempsManuel[0].categorie, 'Création');
  test('ms convertis depuis les heures (2h → 7200000ms)', m.tempsManuel[0].ms, 7200000);
  test('_collectifTempsMigre=true (idempotence)', m._collectifTempsMigre, true);
  test('categoriesTemps enrichi (Création, Animation ajoutées)', out.categoriesTemps.includes('Création') && out.categoriesTemps.includes('Animation'), true);

  // Deuxième passage : ne doit rien re-générer (idempotent)
  const out2 = applyDefaults(out, { params: {} }, { getDefaultModules, uuid, today });
  test('idempotent : pas de doublon au second passage', out2.missions[0].tempsManuel.length, 2);
}
section('applyDefaults — migration collectif ignorée sans deps (pas de crash)');
{
  const data = { params: {}, missions: [{ id: 'coll1', typeMission: 'collectif', tempsCreation: 2 }] };
  const out = applyDefaults(data, { params: {} });
  test('tempsCreation intact si uuid/today non fournis', out.missions[0].tempsCreation, 2);
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`Résultat : ${passed} tests passés, ${failed} échoués`);
if (failed > 0) process.exit(1);
